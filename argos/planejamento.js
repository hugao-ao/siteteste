// planejamento.js — Card "Planejamento Financeiro" da área Argos
// Projeção por período das contas da clínica: faturamento puxado direto das
// sessões (mesma conta do Fechamento Mensal), repasses automáticos aos
// profissionais e despesas cadastradas com recorrências variadas.
// Visões: anual (mês a mês) e mensal (detalhada).

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { fechamentoPaciente, formataMoeda, formataBR, hojeISO, fimDoMes } from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], despesas = [], movimentacoes = [], alocacoes = [], depara = [];
let editandoDespesaId = null;

const MES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const RECORRENCIA_LABELS = { unica: 'Única', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' };

async function carregarTudo() {
    const [rPac, rDin, rSes, rProf, rDesp, rMov, rAloc, rDp] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_despesas').select('*').order('created_at'),
        sb.from('argos_movimentacoes').select('*').order('data', { ascending: false }),
        sb.from('argos_mov_alocacoes').select('*'),
        sb.from('argos_mov_depara').select('*')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error || rDesp.error || rMov.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    pacientes = rPac.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    profissionais = rProf.data || [];
    despesas = rDesp.data || [];
    movimentacoes = rMov.data || [];
    alocacoes = (rAloc && rAloc.data) || [];
    depara = (rDp && rDp.data) || [];
    render();
}

/** Mês anterior de 'YYYY-MM'. */
function mesAnterior(mes) {
    const [a, m] = mes.split('-').map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

// ---------- realizado: movimentações reais confrontadas por MÊS DE REFERÊNCIA ----------
// Cada movimentação pode ser rateada em alocações (destino + mês + valor):
// um pagamento pode cobrir vários meses, ou só parte de um mês (outras
// movimentações completam depois). O que não foi alocado conta como
// "não classificado" no mês da própria movimentação (pela data).
const alocDaMov = movId => alocacoes.filter(a => a.movimentacao_id === movId);
const alocadoDaMov = m => alocDaMov(m.id).reduce((s2, a) => s2 + (Number(a.valor) || 0), 0);
const restanteDaMov = m => Math.max(0, (Number(m.valor) || 0) - alocadoDaMov(m));

function realizadoDoMes(mes) {
    const de = mes + '-01';
    const ate = fimDoMes(mes);
    const tipoDe = {};
    movimentacoes.forEach(m => { tipoDe[m.id] = m.tipo; });
    const alocMes = alocacoes.filter(a => a.mes_ref === mes);
    const soma = l => l.reduce((s2, x) => s2 + (Number(x.valor) || 0), 0);
    const entradasClass = soma(alocMes.filter(a => tipoDe[a.movimentacao_id] === 'entrada'));
    const repasses = soma(alocMes.filter(a => tipoDe[a.movimentacao_id] === 'saida' && a.vinculo_tipo === 'profissional'));
    const despesasClass = soma(alocMes.filter(a => tipoDe[a.movimentacao_id] === 'saida' && (a.vinculo_tipo === 'despesa' || a.vinculo_tipo === 'outro')));
    const noMesPorData = movimentacoes.filter(m => m.data >= de && m.data <= ate);
    const entradasNaoClass = noMesPorData.filter(m => m.tipo === 'entrada').reduce((s2, m) => s2 + restanteDaMov(m), 0);
    const saidasNaoClass = noMesPorData.filter(m => m.tipo === 'saida').reduce((s2, m) => s2 + restanteDaMov(m), 0);
    const porVinculo = {};
    alocMes.forEach(a => {
        if (a.vinculo_id) {
            const k = a.vinculo_tipo + ':' + a.vinculo_id;
            porVinculo[k] = (porVinculo[k] || 0) + (Number(a.valor) || 0);
        }
    });
    const entradas = entradasClass + entradasNaoClass;
    const saidasTotal = repasses + despesasClass + saidasNaoClass;
    return {
        entradas, entradasNaoClass, repasses,
        despesas: despesasClass,
        naoClassificadas: saidasNaoClass,
        saidasTotal,
        resultado: entradas - saidasTotal,
        outrasSaidas: soma(alocMes.filter(a => tipoDe[a.movimentacao_id] === 'saida' && a.vinculo_tipo === 'outro')),
        porVinculo
    };
}

// ---------- despesas expandidas num mês ----------
function despesasDoMes(mes) {
    const de = mes + '-01';
    const ate = fimDoMes(mes);
    const itens = [];
    for (const d of despesas) {
        if (d.ativo === false || !d.data_inicio) continue;
        const ini = d.data_inicio;
        const fim = d.fim_data || null;
        const v = Number(d.valor) || 0;
        if (d.recorrencia === 'unica') {
            if (ini >= de && ini <= ate) itens.push({ id: d.id, nome: d.nome, recorrencia: 'unica', valor: v, extra: formataBR(ini) });
        } else if (d.recorrencia === 'mensal') {
            if (ini <= ate && (!fim || fim >= de)) itens.push({ id: d.id, nome: d.nome, recorrencia: 'mensal', valor: v });
        } else if (d.recorrencia === 'anual') {
            if (ini.slice(5, 7) === mes.slice(5, 7) && ini <= ate && (!fim || fim >= de))
                itens.push({ id: d.id, nome: d.nome, recorrencia: 'anual', valor: v });
        } else if (d.recorrencia === 'semanal') {
            // conta as ocorrências do dia-da-semana da data inicial dentro do mês
            const dow = new Date(ini + 'T12:00').getDay();
            let n = 0;
            for (let dt = new Date(de + 'T12:00'); ; dt.setDate(dt.getDate() + 1)) {
                const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                if (iso > ate) break;
                if (dt.getDay() === dow && iso >= ini && (!fim || iso <= fim)) n++;
            }
            if (n) itens.push({ id: d.id, nome: d.nome, recorrencia: 'semanal', valor: v * n, extra: `${n}× ${formataMoeda(v)}` });
        }
    }
    return itens;
}

// ---------- conta de um mês: faturamento + repasses + despesas ----------
// REGRA DE CAIXA: o que é PRODUZIDO no mês X (sessões do mês X) é a
// perspectiva de faturamento do mês X+1 — por isso as entradas previstas
// (e a produção dos repasses) de cada mês vêm da produção do mês anterior.
// Repasses fixos e despesas pertencem ao próprio mês.
function calculaMes(mes) {
    const mesProducao = mesAnterior(mes);
    let faturamento = 0;
    const porPaciente = [];
    const producao = {};
    for (const p of pacientes) {
        const f = fechamentoPaciente(p,
            dinamicas.filter(d => d.paciente_id === p.id),
            sessoes.filter(s => s.paciente_id === p.id), mesProducao);
        if (f.valor) porPaciente.push({ id: p.id, nome: p.nome, valor: f.valor });
        faturamento += f.valor;
        for (const pd of (f.porDinamica || [])) {
            for (const r of (pd.repasses || [])) {
                producao[r.profissional_id] = (producao[r.profissional_id] || 0) + r.valor;
            }
        }
    }
    const repProf = profissionais.map(pr => {
        const temFixo = pr.remuneracao_tipo === 'fixo' || pr.remuneracao_tipo === 'producao_fixo';
        const fixo = temFixo ? (Number(pr.valor_fixo_mensal) || 0) : 0;
        const prod = pr.remuneracao_tipo === 'fixo' ? 0 : (producao[pr.id] || 0);
        return { id: pr.id, nome: pr.nome, fixo, prod, total: fixo + prod };
    }).filter(x => x.total > 0);
    const repasses = repProf.reduce((s, x) => s + x.total, 0);
    const itensDespesas = despesasDoMes(mes);
    const totalDespesas = itensDespesas.reduce((s, x) => s + x.valor, 0);
    return {
        mesProducao, faturamento, porPaciente, repProf, repasses,
        itensDespesas, totalDespesas,
        resultado: faturamento - repasses - totalDespesas,
        realizado: realizadoDoMes(mes)
    };
}

// ---------- render ----------
function render() {
    const modo = document.getElementById('modo-visao').value;
    document.getElementById('secao-anual').style.display = modo === 'anual' ? '' : 'none';
    document.getElementById('secao-mensal').style.display = modo === 'mensal' ? '' : 'none';
    document.getElementById('rotulo-ano').style.display = modo === 'anual' ? '' : 'none';
    document.getElementById('rotulo-mes').style.display = modo === 'mensal' ? '' : 'none';
    if (modo === 'anual') renderAnual(); else renderMensal();
    renderMovimentacoes();
}

const corResultado = v => v >= 0 ? '#22c55e' : '#ef4444';

let gruposFechados = new Set(); // blocos com a memória de cálculo oculta

function renderAnual() {
    const ano = Number(document.getElementById('ano-ref').value) || new Date().getFullYear();
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
    const dados = meses.map(calculaMes);

    // memória de cálculo: uma linha por paciente, por profissional (fixo e
    // produção separados) e por despesa, com um valor em cada mês
    const porPac = new Map(), porRep = new Map(), porDesp = new Map();
    const linha = (map, chave, nome) => {
        if (!map.has(chave)) map.set(chave, { nome, valores: Array(12).fill(0) });
        return map.get(chave);
    };
    dados.forEach((c, i) => {
        c.porPaciente.forEach(x => { linha(porPac, x.id, x.nome).valores[i] += x.valor; });
        c.repProf.forEach(x => {
            if (x.fixo) linha(porRep, x.id + '|fixo', `${x.nome} — fixo mensal`).valores[i] += x.fixo;
            if (x.prod) linha(porRep, x.id + '|prod', `${x.nome} — produção`).valores[i] += x.prod;
        });
        c.itensDespesas.forEach(x =>
            { linha(porDesp, x.id, `${x.nome} (${RECORRENCIA_LABELS[x.recorrencia] || x.recorrencia})`).valores[i] += x.valor; });
    });

    const fmt = v => Math.abs(v) < 0.005 ? '—'
        : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const soma = vs => vs.reduce((s2, v) => s2 + v, 0);

    function linhaHTML(rotulo, valores, opts = {}) {
        const total = soma(valores);
        // sinal: true = positivo bom (verde); 'invertido' = positivo ruim (vermelho)
        const cor = v => !opts.sinal ? ''
            : (opts.sinal === 'invertido' ? (v > 0.004 ? 'neg' : (v < -0.004 ? 'pos' : ''))
                : (v < -0.004 ? 'neg' : (v > 0.004 ? 'pos' : '')));
        const cls = opts.grupo ? 'grupo-linha' : (opts.detalheDe ? 'linha-detalhe-plan' : '') + (opts.classeExtra ? ' ' + opts.classeExtra : '');
        const attrs = (opts.grupo ? ` data-grupo="${opts.grupo}"` : '')
            + (opts.detalheDe ? ` data-detalhe-de="${opts.detalheDe}"` : '')
            + (opts.detalheDe && gruposFechados.has(opts.detalheDe) ? ' style="display:none"' : '');
        return `<tr class="${cls}"${attrs}>
          <td>${opts.grupo ? `<span class="chev">${gruposFechados.has(opts.grupo) ? '▸' : '▾'}</span> ` : ''}${rotulo}</td>
          ${valores.map(v => `<td class="${cor(v)}">${fmt(v)}</td>`).join('')}
          <td class="col-total ${cor(total)}">${fmt(total)}</td>
        </tr>`;
    }
    const ordenado = map => [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));

    const temMov = movimentacoes.length > 0;
    const linhas = [];
    linhas.push(linhaHTML('📥 ENTRADAS previstas — produção do mês anterior', dados.map(c => c.faturamento), { grupo: 'entradas' }));
    if (temMov) {
        linhas.push(linhaHTML('✔ Entradas realizadas (movimentações)', dados.map(c => c.realizado.entradas), { classeExtra: 'linha-real' }));
        linhas.push(linhaHTML('Δ diferença (real − previsto)', dados.map(c => c.realizado.entradas - c.faturamento), { classeExtra: 'linha-real', sinal: true }));
    }
    ordenado(porPac).forEach(l => linhas.push(linhaHTML(esc(l.nome), l.valores, { detalheDe: 'entradas' })));
    linhas.push(linhaHTML('💼 SAÍDAS previstas — Repasses aos profissionais', dados.map(c => c.repasses), { grupo: 'repasses' }));
    if (temMov) {
        linhas.push(linhaHTML('✔ Repasses realizados (movimentações)', dados.map(c => c.realizado.repasses), { classeExtra: 'linha-real' }));
        linhas.push(linhaHTML('Δ diferença (real − previsto)', dados.map(c => c.realizado.repasses - c.repasses), { classeExtra: 'linha-real', sinal: 'invertido' }));
    }
    ordenado(porRep).forEach(l => linhas.push(linhaHTML(esc(l.nome), l.valores, { detalheDe: 'repasses' })));
    linhas.push(linhaHTML('💸 SAÍDAS previstas — Despesas', dados.map(c => c.totalDespesas), { grupo: 'despesas' }));
    if (temMov) {
        linhas.push(linhaHTML('✔ Despesas realizadas (movimentações)', dados.map(c => c.realizado.despesas), { classeExtra: 'linha-real' }));
        linhas.push(linhaHTML('Δ diferença (real − previsto)', dados.map(c => c.realizado.despesas - c.totalDespesas), { classeExtra: 'linha-real', sinal: 'invertido' }));
        if (dados.some(c => c.realizado.naoClassificadas > 0)) {
            linhas.push(linhaHTML('⚠ Saídas reais ainda não classificadas', dados.map(c => c.realizado.naoClassificadas), { classeExtra: 'linha-real' }));
        }
    }
    ordenado(porDesp).forEach(l => linhas.push(linhaHTML(esc(l.nome), l.valores, { detalheDe: 'despesas' })));
    linhas.push(linhaHTML('<b>🟰 RESULTADO previsto (entradas − saídas)</b>', dados.map(c => c.resultado), { classeExtra: 'linha-total', sinal: true }));
    if (temMov) {
        linhas.push(linhaHTML('<b>✔ RESULTADO realizado (movimentações)</b>', dados.map(c => c.realizado.resultado), { classeExtra: 'linha-total linha-real', sinal: true }));
    }

    document.getElementById('thead-anual').innerHTML = `<tr>
      <th>${ano}</th>
      ${meses.map((m, i) => `<th data-mes="${m}" title="Abrir o detalhe de ${MES_NOMES[i]}">${MES_NOMES[i].slice(0, 3)}</th>`).join('')}
      <th class="col-total">Total ${ano}</th></tr>`;
    document.getElementById('tbody-anual').innerHTML = linhas.join('');
}

function renderMensal() {
    const mes = document.getElementById('mes-ref').value;
    if (!mes) return;
    const c = calculaMes(mes);
    const r = c.realizado;
    const [aP, mP] = c.mesProducao.split('-').map(Number);
    const rotuloProducao = `${MES_NOMES[mP - 1]}/${aP}`;
    const difHTML = (real, prev, invertido) => {
        const d = real - prev;
        if (Math.abs(d) < 0.005) return '<span class="dim">—</span>';
        const boa = invertido ? d < 0 : d > 0;
        return `<span style="color:${boa ? '#22c55e' : '#ef4444'}">${d > 0 ? '+' : ''}${formataMoeda(d)}</span>`;
    };

    document.getElementById('tbody-resumo-mes').innerHTML = `
      <tr><th></th><th>Previsto</th><th>Realizado (movimentações)</th><th>Δ</th></tr>
      <tr><td><b>📥 Entradas</b> <span class="dim">(produção de ${rotuloProducao})</span></td>
        <td>${formataMoeda(c.faturamento)}</td><td>${formataMoeda(r.entradas)}</td><td>${difHTML(r.entradas, c.faturamento, false)}</td></tr>
      <tr><td><b>💼 Repasses aos profissionais</b></td>
        <td>− ${formataMoeda(c.repasses)}</td><td>− ${formataMoeda(r.repasses)}</td><td>${difHTML(r.repasses, c.repasses, true)}</td></tr>
      <tr><td><b>💸 Despesas</b>${r.naoClassificadas ? ` <span class="badge vermelho">+ ${formataMoeda(r.naoClassificadas)} de saídas não classificadas</span>` : ''}</td>
        <td>− ${formataMoeda(c.totalDespesas)}</td><td>− ${formataMoeda(r.despesas)}</td><td>${difHTML(r.despesas, c.totalDespesas, true)}</td></tr>
      <tr class="linha-total"><td><b>Resultado do mês</b></td>
        <td><b style="color:${corResultado(c.resultado)}">${formataMoeda(c.resultado)}</b></td>
        <td><b style="color:${corResultado(r.resultado)}">${formataMoeda(r.resultado)}</b></td>
        <td>${difHTML(r.resultado, c.resultado, false)}</td></tr>`;

    // por paciente: previsto (produção do mês anterior) × entradas classificadas
    const linhasPac = [];
    const previstoPac = new Map(c.porPaciente.map(x => [x.id, x]));
    const idsPac = new Set([...previstoPac.keys(),
        ...pacientes.filter(p => r.porVinculo['paciente:' + p.id]).map(p => p.id)]);
    [...idsPac].map(id => pacientes.find(p => p.id === id)).filter(Boolean)
        .sort((a, b) => a.nome.localeCompare(b.nome)).forEach(p => {
            const prev = (previstoPac.get(p.id) || {}).valor || 0;
            const real = r.porVinculo['paciente:' + p.id] || 0;
            linhasPac.push(`<tr><td>${esc(p.nome)}</td><td>${formataMoeda(prev)}</td><td>${real ? formataMoeda(real) : '—'}</td><td>${difHTML(real, prev, false)}</td></tr>`);
        });
    document.getElementById('tbody-mes-faturamento').innerHTML = linhasPac.join('')
        || '<tr><td colspan="4" class="dim">Sem faturamento neste mês.</td></tr>';

    document.getElementById('tbody-mes-repasses').innerHTML =
        c.repProf.map(x => {
            const real = r.porVinculo['profissional:' + x.id] || 0;
            return `<tr><td>${esc(x.nome)}</td><td>${x.fixo ? formataMoeda(x.fixo) : '—'}</td><td>${x.prod ? formataMoeda(x.prod) : '—'}</td><td><b>${formataMoeda(x.total)}</b></td><td>${real ? formataMoeda(real) : '—'}</td><td>${difHTML(real, x.total, true)}</td></tr>`;
        }).join('')
        || '<tr><td colspan="6" class="dim">Nenhum repasse neste mês.</td></tr>';

    const linhasDesp = c.itensDespesas.map(x => {
        const real = r.porVinculo['despesa:' + x.id] || 0;
        return `<tr><td>${esc(x.nome)}${x.extra ? ` <span class="dim">(${esc(x.extra)})</span>` : ''}</td><td>${RECORRENCIA_LABELS[x.recorrencia]}</td><td>${formataMoeda(x.valor)}</td><td>${real ? formataMoeda(real) : '—'}</td><td>${difHTML(real, x.valor, true)}</td></tr>`;
    });
    // saídas reais classificadas como "outro" (fora das despesas previstas)
    if (r.outrasSaidas) linhasDesp.push(`<tr><td>Outras saídas (classificadas como "outro")</td><td>—</td><td>—</td><td>${formataMoeda(r.outrasSaidas)}</td><td></td></tr>`);
    document.getElementById('tbody-mes-despesas').innerHTML = linhasDesp.join('')
        || '<tr><td colspan="5" class="dim">Nenhuma despesa neste mês.</td></tr>';
}

// ocultar/mostrar a memória de cálculo de um bloco
document.getElementById('tbody-anual').addEventListener('click', (e) => {
    const g = e.target.closest('tr[data-grupo]');
    if (!g) return;
    const chave = g.dataset.grupo;
    if (gruposFechados.has(chave)) gruposFechados.delete(chave); else gruposFechados.add(chave);
    const fechado = gruposFechados.has(chave);
    document.querySelectorAll(`#tbody-anual tr[data-detalhe-de="${chave}"]`)
        .forEach(tr => tr.style.display = fechado ? 'none' : '');
    g.querySelector('.chev').textContent = fechado ? '▸' : '▾';
});

// clicar no mês do cabeçalho abre o detalhe mensal daquele mês
document.getElementById('thead-anual').addEventListener('click', (e) => {
    const th = e.target.closest('[data-mes]');
    if (!th) return;
    document.getElementById('mes-ref').value = th.dataset.mes;
    document.getElementById('modo-visao').value = 'mensal';
    render();
});

// ---------- movimentações financeiras reais ----------
function periodoMovimentacoes() {
    const modo = document.getElementById('modo-visao').value;
    if (modo === 'mensal') {
        const mes = document.getElementById('mes-ref').value;
        const [a, m] = mes.split('-').map(Number);
        return { de: mes + '-01', ate: fimDoMes(mes), rotulo: `${MES_NOMES[m - 1]} de ${a}` };
    }
    const ano = Number(document.getElementById('ano-ref').value) || new Date().getFullYear();
    return { de: `${ano}-01-01`, ate: `${ano}-12-31`, rotulo: `ano de ${ano}` };
}

const nomeVinculo = (tipo, id) => {
    if (tipo === 'paciente') return (pacientes.find(p => p.id === id) || {}).nome || '?';
    if (tipo === 'profissional') return (profissionais.find(p => p.id === id) || {}).nome || '?';
    if (tipo === 'despesa') return (despesas.find(d => d.id === id) || {}).nome || '?';
    return 'Outro';
};
const mesRefBR = mes => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

// resumo da classificação de uma movimentação (célula da tabela)
function resumoClassificacao(m) {
    const aloc = alocDaMov(m.id);
    if (!aloc.length) return '<span class="badge vermelho">não classificada</span>';
    const partes = aloc.map(a =>
        `${esc(nomeVinculo(a.vinculo_tipo, a.vinculo_id))} · ${mesRefBR(a.mes_ref)}: ${formataMoeda(a.valor)}`);
    const resto = restanteDaMov(m);
    return partes.join('<br>') + (resto > 0.004 ? `<br><span class="badge vermelho">parcial — falta ${formataMoeda(resto)}</span>` : '');
}

function renderMovimentacoes() {
    const { de, ate, rotulo } = periodoMovimentacoes();
    const lista = movimentacoes.filter(m => m.data >= de && m.data <= ate)
        .sort((a, b) => (b.data + b.created_at).localeCompare(a.data + a.created_at));
    const naoClass = lista.filter(m => restanteDaMov(m) > 0.004).length;
    document.getElementById('mov-periodo').textContent =
        `Movimentações do ${rotulo}: ${lista.length} lançamento(s)` +
        (naoClass ? ` — ⚠️ ${naoClass} sem classificação completa` : '');
    document.getElementById('tbody-mov').innerHTML = lista.map(m => `
      <tr>
        <td>${formataBR(m.data)}</td>
        <td>${esc(m.descricao)}${m.origem === 'importacao' ? ' <span class="dim">(importada)</span>' : ''}</td>
        <td>${m.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</td>
        <td style="color:${m.tipo === 'entrada' ? '#22c55e' : '#ef4444'}">${m.tipo === 'entrada' ? '' : '− '}${formataMoeda(m.valor)}</td>
        <td>${resumoClassificacao(m)}</td>
        <td class="acoes">
          <button class="argos-btn small primary" data-mov-classificar="${m.id}">🏷️ Classificar</button>
          <button class="argos-btn small danger" data-mov-excluir="${m.id}" title="Excluir lançamento">🗑️</button>
        </td>
      </tr>`).join('');
    document.getElementById('mov-vazio').style.display = lista.length ? 'none' : '';
}

document.getElementById('form-mov').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registro = {
        data: document.getElementById('mov-data').value,
        descricao: document.getElementById('mov-descricao').value.trim(),
        tipo: document.getElementById('mov-tipo').value,
        valor: Number(document.getElementById('mov-valor').value) || 0,
        origem: 'manual'
    };
    if (!registro.data || !registro.descricao || registro.valor <= 0) {
        toast('Informe data, descrição e um valor maior que zero.', true);
        return;
    }
    const { data: criada, error } = await sb.from('argos_movimentacoes').insert(registro).select().single();
    if (error) { console.error(error); toast('Erro ao lançar a movimentação.', true); return; }
    const auto = criada ? await aplicarDeParaEm([criada]) : 0;
    toast(auto ? 'Movimentação lançada e classificada automaticamente pelo de-para. ✔'
        : 'Movimentação lançada — classifique-a para o confronto com o previsto.');
    document.getElementById('mov-descricao').value = '';
    document.getElementById('mov-valor').value = '';
    await carregarTudo();
});

document.getElementById('tbody-mov').addEventListener('click', async (e) => {
    const clf = e.target.closest('[data-mov-classificar]');
    if (clf) {
        const m = movimentacoes.find(x => x.id === clf.dataset.movClassificar);
        if (m) abrirModalClassificar(m);
        return;
    }
    const btn = e.target.closest('[data-mov-excluir]');
    if (!btn) return;
    const m = movimentacoes.find(x => x.id === btn.dataset.movExcluir);
    if (!m || !confirm(`Excluir o lançamento "${m.descricao}" (${formataMoeda(m.valor)})?`)) return;
    const { error } = await sb.from('argos_movimentacoes').delete().eq('id', m.id);
    if (error) { toast('Erro ao excluir.', true); return; }
    toast('Lançamento excluído.');
    await carregarTudo();
});

// ---------- modal de classificação (filtro + rateio por mês) ----------
let clfMov = null;        // movimentação sendo classificada
let clfAlocacoes = [];    // cópia de trabalho: [{vinculo_tipo, vinculo_id, mes_ref, valor}]

function abrirModalClassificar(m) {
    clfMov = m;
    clfAlocacoes = alocDaMov(m.id).map(a => ({
        vinculo_tipo: a.vinculo_tipo, vinculo_id: a.vinculo_id || null,
        mes_ref: a.mes_ref, valor: Number(a.valor) || 0
    }));
    document.getElementById('clf-info').innerHTML =
        `<b>${formataBR(m.data)}</b> — ${esc(m.descricao)} · ${m.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'} de <b>${formataMoeda(m.valor)}</b>`;
    document.getElementById('clf-busca').value = '';
    document.getElementById('clf-lembrar').checked = false;
    document.getElementById('clf-chave').value = m.descricao;
    renderOpcoesClassificacao();
    renderAlocacoes();
    abrirModal('modal-classificar');
}

// opções filtráveis: entradas → pacientes; saídas → profissionais e despesas
function opcoesDoTipo() {
    if (!clfMov) return [];
    if (clfMov.tipo === 'entrada') {
        return pacientes.filter(p => !p.cadastro_removido)
            .map(p => ({ tipo: 'paciente', id: p.id, nome: p.nome, grupo: '🧑 Pagamento de paciente' }))
            .concat([{ tipo: 'outro', id: null, nome: 'Outra entrada (sem vínculo)', grupo: '📦 Outros' }]);
    }
    return profissionais.map(p => ({ tipo: 'profissional', id: p.id, nome: p.nome, grupo: '💼 Repasse a profissional' }))
        .concat(despesas.map(d => ({ tipo: 'despesa', id: d.id, nome: d.nome, grupo: '💸 Despesa cadastrada' })))
        .concat([{ tipo: 'outro', id: null, nome: 'Outra saída (sem vínculo)', grupo: '📦 Outros' }]);
}

const normaliza = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function renderOpcoesClassificacao() {
    const termo = normaliza(document.getElementById('clf-busca').value);
    const lista = opcoesDoTipo().filter(o => !termo || normaliza(o.nome).includes(termo));
    let grupoAtual = '';
    document.getElementById('clf-opcoes').innerHTML = lista.map(o => {
        const cab = o.grupo !== grupoAtual ? `<p class="dica" style="margin:8px 0 2px"><b>${o.grupo}</b></p>` : '';
        grupoAtual = o.grupo;
        return `${cab}
          <div class="servico-item">
            <span>${esc(o.nome)}</span>
            <button class="argos-btn small primary" data-clf-add="${o.tipo}:${o.id || ''}">+ Alocar</button>
          </div>`;
    }).join('') || '<p class="dim" style="padding:8px">Nada encontrado com esse filtro.</p>';
}
document.getElementById('clf-busca').addEventListener('input', renderOpcoesClassificacao);

document.getElementById('clf-opcoes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-clf-add]');
    if (!btn || !clfMov) return;
    const [tipo, id] = btn.dataset.clfAdd.split(':');
    const alocado = clfAlocacoes.reduce((s2, a) => s2 + a.valor, 0);
    clfAlocacoes.push({
        vinculo_tipo: tipo, vinculo_id: id || null,
        mes_ref: clfMov.data.slice(0, 7),
        valor: Math.max(0, Math.round(((Number(clfMov.valor) || 0) - alocado) * 100) / 100)
    });
    renderAlocacoes();
});

// mês seguinte de 'YYYY-MM'
function mesSeguinte(mes) {
    const [a, m] = mes.split('-').map(Number);
    return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

// Extrato do paciente escolhido: honorários previstos por mês (regra de
// caixa), o que já foi pago/associado em cada mês (incluindo as alocações
// deste modal, ao vivo) e o saldo — para correlacionar os lançamentos.
function renderExtratoPaciente() {
    const el = document.getElementById('clf-extrato');
    if (!clfMov) { el.innerHTML = ''; return; }
    const alocPac = clfAlocacoes.find(a => a.vinculo_tipo === 'paciente' && a.vinculo_id);
    if (!alocPac) { el.innerHTML = ''; return; }
    const pacId = alocPac.vinculo_id;
    const p = pacientes.find(x => x.id === pacId);
    if (!p) { el.innerHTML = ''; return; }

    const mesMov = clfMov.data.slice(0, 7);
    let inicio = mesMov;
    for (let i = 0; i < 6; i++) inicio = mesAnterior(inicio);
    const meses = [];
    for (let m = inicio, guarda = 0; guarda < 9; m = mesSeguinte(m), guarda++) {
        meses.push(m);
        if (m === mesSeguinte(mesMov)) break;
    }

    const dinsP = dinamicas.filter(d => d.paciente_id === pacId);
    const sessP = sessoes.filter(s2 => s2.paciente_id === pacId);
    const previstoDe = mes => fechamentoPaciente(p, dinsP, sessP, mesAnterior(mes)).valor;
    const pagoDe = mes =>
        alocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.vinculo_id === pacId
            && a.mes_ref === mes && a.movimentacao_id !== clfMov.id)
            .reduce((s2, a) => s2 + (Number(a.valor) || 0), 0)
        + clfAlocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.vinculo_id === pacId && a.mes_ref === mes)
            .reduce((s2, a) => s2 + (Number(a.valor) || 0), 0);

    const linhas = meses.map(mes => ({ mes, prev: previstoDe(mes), pago: pagoDe(mes) }))
        .filter(l => l.prev > 0.004 || l.pago > 0.004);

    const hist = alocacoes
        .filter(a => a.vinculo_tipo === 'paciente' && a.vinculo_id === pacId && a.movimentacao_id !== clfMov.id)
        .map(a => ({ a, m: movimentacoes.find(x => x.id === a.movimentacao_id) }))
        .filter(x => x.m)
        .sort((x, y) => String(y.m.data).localeCompare(String(x.m.data)))
        .slice(0, 12);

    el.innerHTML = `
      <h3 class="form-secao">📋 Extrato de ${esc(p.nome)} — para correlacionar</h3>
      <div class="argos-tabela-wrap"><table class="argos-tabela">
        <thead><tr><th>Mês</th><th>Honorários previstos</th><th>Pago/associado</th><th>Saldo</th></tr></thead>
        <tbody>${linhas.map(l => {
            const saldo = Math.round((l.prev - l.pago) * 100) / 100;
            const quit = Math.abs(saldo) < 0.005;
            const cor = quit ? '#22c55e' : (saldo > 0 ? '#eab308' : '#ef4444');
            return `<tr><td>${mesRefBR(l.mes)}</td><td>${l.prev ? formataMoeda(l.prev) : '—'}</td>
              <td>${l.pago ? formataMoeda(l.pago) : '—'}</td>
              <td style="color:${cor}">${quit ? '✔ quitado' : (saldo > 0 ? 'falta ' + formataMoeda(saldo) : 'excedente ' + formataMoeda(-saldo))}</td></tr>`;
        }).join('') || '<tr><td colspan="4" class="dim">Sem honorários nem pagamentos na janela.</td></tr>'}
        </tbody></table></div>
      ${hist.length ? `<p class="dica" style="margin-top:6px"><b>Pagamentos já associados a ${esc(p.nome)}:</b><br>${hist.map(x =>
          `${formataBR(x.m.data)} — ${esc(x.m.descricao)}: ${formataMoeda(x.a.valor)} → ${mesRefBR(x.a.mes_ref)}`).join('<br>')}</p>` : ''}`;
}

function renderAlocacoes() {
    document.getElementById('clf-alocacoes').innerHTML = clfAlocacoes.map((a, i) => `
      <div class="linha-dia" data-aloc="${i}">
        <span style="flex:2; min-width:120px">${esc(nomeVinculo(a.vinculo_tipo, a.vinculo_id))}</span>
        <input type="month" class="argos-input aloc-mes" value="${a.mes_ref}" title="Mês de referência" />
        <input type="number" step="0.01" min="0.01" class="argos-input aloc-valor" value="${a.valor || ''}" placeholder="R$" title="Valor desta parte" />
        <button type="button" class="argos-btn small danger aloc-remover">×</button>
      </div>`).join('') || '<p class="dim">Nenhuma alocação ainda — escolha um destino acima.</p>';
    atualizarResumoClassificacao();
    renderExtratoPaciente();
}

function lerAlocacoesDoModal() {
    document.querySelectorAll('#clf-alocacoes [data-aloc]').forEach(el => {
        const a = clfAlocacoes[Number(el.dataset.aloc)];
        if (!a) return;
        a.mes_ref = el.querySelector('.aloc-mes').value || a.mes_ref;
        a.valor = Number(el.querySelector('.aloc-valor').value) || 0;
    });
}

function atualizarResumoClassificacao() {
    if (!clfMov) return;
    const total = Number(clfMov.valor) || 0;
    const alocado = clfAlocacoes.reduce((s2, a) => s2 + (Number(a.valor) || 0), 0);
    const resto = Math.round((total - alocado) * 100) / 100;
    const el = document.getElementById('clf-resumo');
    if (alocado > total + 0.004) {
        el.style.color = '#e05555';
        el.textContent = `⛔ Alocado ${formataMoeda(alocado)} — mais que o valor da movimentação (${formataMoeda(total)}).`;
    } else {
        el.style.color = '';
        el.textContent = `Alocado ${formataMoeda(alocado)} de ${formataMoeda(total)}` +
            (resto > 0.004 ? ` — falta ${formataMoeda(resto)} (pode ficar parcial).` : ' — tudo alocado. ✔');
    }
}

document.getElementById('clf-alocacoes').addEventListener('input', () => { lerAlocacoesDoModal(); atualizarResumoClassificacao(); renderExtratoPaciente(); });
document.getElementById('clf-alocacoes').addEventListener('click', (e) => {
    const btn = e.target.closest('.aloc-remover');
    if (!btn) return;
    lerAlocacoesDoModal();
    clfAlocacoes.splice(Number(btn.closest('[data-aloc]').dataset.aloc), 1);
    renderAlocacoes();
});

document.getElementById('btn-clf-salvar').addEventListener('click', async () => {
    if (!clfMov) return;
    lerAlocacoesDoModal();
    const validas = clfAlocacoes.filter(a => a.valor > 0 && a.mes_ref);
    const total = Number(clfMov.valor) || 0;
    const alocado = validas.reduce((s2, a) => s2 + a.valor, 0);
    if (alocado > total + 0.004) {
        toast('A soma das alocações não pode passar do valor da movimentação.', true);
        return;
    }
    const { error: e1 } = await sb.from('argos_mov_alocacoes').delete().eq('movimentacao_id', clfMov.id);
    if (e1) { console.error(e1); toast('Erro ao salvar a classificação.', true); return; }
    if (validas.length) {
        const { error: e2 } = await sb.from('argos_mov_alocacoes').insert(validas.map(a => ({
            movimentacao_id: clfMov.id, vinculo_tipo: a.vinculo_tipo,
            vinculo_id: a.vinculo_id, mes_ref: a.mes_ref, valor: a.valor
        })));
        if (e2) { console.error(e2); toast('Erro ao salvar a classificação.', true); return; }
    }
    // compatibilidade: guarda o vínculo "principal" no próprio lançamento
    const principal = validas[0] || null;
    await sb.from('argos_movimentacoes').update({
        vinculo_tipo: principal ? principal.vinculo_tipo : null,
        vinculo_id: principal ? principal.vinculo_id : null
    }).eq('id', clfMov.id);
    // "lembrar este pagador": grava o de-para para classificar as próximas sozinho
    if (document.getElementById('clf-lembrar').checked && validas.length) {
        const chave = document.getElementById('clf-chave').value.trim();
        if (chave) {
            let r = await salvarDePara(chave, validas[0].vinculo_tipo, validas[0].vinculo_id);
            if (r.conflito) {
                const trocar = confirm(`«${chave}» já está associado a ${nomeVinculo(r.conflito.vinculo_tipo, r.conflito.vinculo_id)}.\nUm pagador só pode apontar para um destino. Substituir pela nova associação?`);
                if (trocar) r = await salvarDePara(chave, validas[0].vinculo_tipo, validas[0].vinculo_id, { forcar: true });
            }
        }
    }
    toast(validas.length ? 'Classificação salva.' : 'Classificação removida.');
    fecharModal('modal-classificar');
    clfMov = null;
    await carregarTudo(); // replaneja: o realizado muda na planilha e no mensal
});

// ---------- importação de planilha (Excel / Google Sheets) ----------
// Hoje: colar as linhas copiadas. Próxima etapa: leitura de arquivo .xlsx e
// link do Google Sheets caem NESTE mesmo fluxo (mesma prévia e deduplicação
// por origem_ref).
let impLinhas = [];

function parseValorPlanilha(txt) {
    let t = String(txt || '').replace(/R\$|\s/g, '').trim();
    if (!t) return NaN;
    let neg = /^\(.*\)$/.test(t) || t.startsWith('-') || t.startsWith('\u2212');
    t = t.replace(/^\((.*)\)$/, '$1').replace(/^[-\u2212]/, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    const v = Number(t);
    return Number.isFinite(v) ? (neg ? -v : v) : NaN;
}

function parseDataPlanilha(txt) {
    const t = String(txt || '').trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
        const ano = m[3].length === 2 ? '20' + m[3] : m[3];
        return `${ano}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
    return null;
}

const origemRef = (data, descricao, valor) =>
    `${data}|${String(descricao).trim().toLowerCase()}|${Math.abs(valor).toFixed(2)}`;

function parseImportacao(texto) {
    const linhas = String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const refsExistentes = new Set(movimentacoes.map(m =>
        m.origem_ref || origemRef(m.data, m.descricao, Number(m.valor) * (m.tipo === 'saida' ? -1 : 1))));
    return linhas.map(l => {
        let cols = l.split('\t');
        if (cols.length < 2) cols = l.split(';');
        cols = cols.map(c => c.trim()).filter(c => c !== '');
        const data = parseDataPlanilha(cols[0]);
        const valor = parseValorPlanilha(cols[cols.length - 1]);
        if (!data || !Number.isFinite(valor) || valor === 0 || cols.length < 3) {
            return { bruta: l, status: 'invalida' };
        }
        const descricao = cols.slice(1, -1).join(' — ');
        const tipo = valor < 0 ? 'saida' : 'entrada';
        const ref = origemRef(data, descricao, valor);
        return {
            bruta: l, data, descricao, tipo, valor: Math.abs(valor), ref,
            status: refsExistentes.has(ref) ? 'duplicada' : 'nova'
        };
    });
}

document.getElementById('btn-importar').addEventListener('click', () => {
    document.getElementById('imp-texto').value = '';
    document.getElementById('imp-previa').innerHTML = '';
    document.getElementById('btn-imp-confirmar').style.display = 'none';
    impLinhas = [];
    abrirModal('modal-importar');
});

document.getElementById('btn-imp-previa').addEventListener('click', () => {
    impLinhas = parseImportacao(document.getElementById('imp-texto').value);
    const novas = impLinhas.filter(x => x.status === 'nova').length;
    const dup = impLinhas.filter(x => x.status === 'duplicada').length;
    const inv = impLinhas.filter(x => x.status === 'invalida').length;
    document.getElementById('imp-previa').innerHTML = impLinhas.length ? `
      <p class="dica" id="imp-resumo" style="font-weight:600">${novas} nova(s) · ${dup} já importada(s) · ${inv} inválida(s)</p>
      <div class="argos-tabela-wrap"><table class="argos-tabela">
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Situação</th></tr></thead>
        <tbody>${impLinhas.map(x => x.status === 'invalida'
            ? `<tr><td colspan="4" class="dim">${esc(x.bruta)}</td><td><span class="badge vermelho">inválida</span></td></tr>`
            : `<tr><td>${formataBR(x.data)}</td><td>${esc(x.descricao)}</td>
                 <td>${x.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</td><td>${formataMoeda(x.valor)}</td>
                 <td>${x.status === 'nova' ? '<span class="badge verde">nova</span>' : '<span class="badge azul">já importada</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="dim">Nada para importar.</p>';
    document.getElementById('btn-imp-confirmar').style.display = novas ? '' : 'none';
});

document.getElementById('btn-imp-confirmar').addEventListener('click', async () => {
    const novas = impLinhas.filter(x => x.status === 'nova');
    if (!novas.length) return;
    const { data: criadas, error } = await sb.from('argos_movimentacoes').insert(novas.map(x => ({
        data: x.data, descricao: x.descricao, tipo: x.tipo, valor: x.valor,
        origem: 'importacao', origem_ref: x.ref
    }))).select();
    if (error) { console.error(error); toast('Erro ao importar.', true); return; }
    const auto = await aplicarDeParaEm(criadas || []);
    toast(`${novas.length} movimentação(ões) importada(s)` +
        (auto ? ` — ${auto} classificada(s) automaticamente pelo de-para.` : ' — classifique-as para o confronto.'));
    fecharModal('modal-importar');
    await carregarTudo();
});

// ---------- De-Para de pagadores: classificação automática ----------
// Como a aba de suporte da planilha: um trecho do pagador (como vem no
// extrato) aponta para um destino; movimentações cuja descrição contém o
// trecho são classificadas sozinhas (valor integral, mês da data).
function deparaCompativel(m, d) {
    if (d.vinculo_tipo === 'outro') return true;
    return m.tipo === 'entrada' ? d.vinculo_tipo === 'paciente'
        : (d.vinculo_tipo === 'profissional' || d.vinculo_tipo === 'despesa');
}

function encontraDePara(m) {
    const desc = normaliza(m.descricao);
    const candidatos = depara.filter(d => deparaCompativel(m, d) && d.chave_norm && desc.includes(d.chave_norm));
    if (!candidatos.length) return null;
    // o trecho mais longo (mais específico) vence
    return candidatos.sort((a, b) => b.chave_norm.length - a.chave_norm.length)[0];
}

// aplica o de-para às movimentações informadas que ainda não têm alocação
async function aplicarDeParaEm(movs) {
    const novas = [];
    for (const m of movs || []) {
        if (!m || alocDaMov(m.id).length) continue;
        const d = encontraDePara(m);
        if (!d) continue;
        novas.push({
            movimentacao_id: m.id, vinculo_tipo: d.vinculo_tipo,
            vinculo_id: d.vinculo_id || null,
            mes_ref: m.data.slice(0, 7), valor: Number(m.valor) || 0
        });
        await sb.from('argos_movimentacoes').update({
            vinculo_tipo: d.vinculo_tipo, vinculo_id: d.vinculo_id || null
        }).eq('id', m.id);
    }
    if (novas.length) {
        const { error } = await sb.from('argos_mov_alocacoes').insert(novas);
        if (error) { console.error(error); return 0; }
    }
    return novas.length;
}

function selectDestinoDePara(el) {
    el.innerHTML = '<option value="">— Destino —</option>'
        + '<optgroup label="🧑 Paciente (entradas)">'
        + pacientes.filter(p => !p.cadastro_removido).map(p => `<option value="paciente:${p.id}">${esc(p.nome)}</option>`).join('')
        + '</optgroup><optgroup label="💼 Repasse a profissional (saídas)">'
        + profissionais.map(p => `<option value="profissional:${p.id}">${esc(p.nome)}</option>`).join('')
        + '</optgroup><optgroup label="💸 Despesa cadastrada (saídas)">'
        + despesas.map(d => `<option value="despesa:${d.id}">${esc(d.nome)}</option>`).join('')
        + '</optgroup><option value="outro:">📦 Outro (entrada ou saída)</option>';
}

const TIPO_ICONE = { paciente: '🧑', profissional: '💼', despesa: '💸', outro: '📦' };

let editandoDeParaId = null;

// lista agrupada por DESTINO: um paciente pode ter vários pagadores,
// mas cada pagador aponta para um único destino
function renderDePara() {
    const termo = normaliza(document.getElementById('dp-busca').value);
    const grupos = new Map(); // 'tipo:id' -> {tipo, id, nome, itens: []}
    depara.forEach(d => {
        const k = d.vinculo_tipo + ':' + (d.vinculo_id || '');
        if (!grupos.has(k)) grupos.set(k, {
            tipo: d.vinculo_tipo, id: d.vinculo_id || null,
            nome: nomeVinculo(d.vinculo_tipo, d.vinculo_id), itens: []
        });
        grupos.get(k).itens.push(d);
    });
    const visiveis = [...grupos.values()]
        .map(g => ({
            ...g,
            itens: g.itens.filter(d => !termo
                || normaliza(d.chave).includes(termo) || normaliza(g.nome).includes(termo))
        }))
        .filter(g => g.itens.length)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    document.getElementById('lista-depara').innerHTML = visiveis.map(g => `
      <div class="argos-bloco">
        <div class="bloco-topo">
          <b>${TIPO_ICONE[g.tipo] || ''} ${esc(g.nome)}</b>
          <span class="dim">${g.itens.length} pagador(es)</span>
        </div>
        <div class="bloco-info">
          ${g.itens.sort((a, b) => a.chave.localeCompare(b.chave)).map(d => `
            <div style="display:flex; align-items:center; gap:8px; margin:3px 0">
              <span style="flex:1">«${esc(d.chave)}»</span>
              <button class="argos-btn small" data-dp-editar="${d.id}" title="Editar">✏️</button>
              <button class="argos-btn small danger" data-dp-excluir="${d.id}" title="Excluir">🗑️</button>
            </div>`).join('')}
        </div>
      </div>`).join('')
        || (termo ? '<p class="dim">Nada encontrado com esse filtro.</p>'
            : '<p class="dim">Nenhuma associação ainda. Você também pode criá-las marcando "Lembrar este pagador" ao classificar uma movimentação.</p>');
}
document.getElementById('dp-busca').addEventListener('input', renderDePara);

// procura um de-para existente com a mesma chave (opcionalmente ignorando um id)
function deparaExistente(chave_norm, ignorarId) {
    return depara.find(d => d.chave_norm === chave_norm && d.id !== ignorarId) || null;
}
const mesmoDestino = (d, tipo, id) =>
    d.vinculo_tipo === tipo && (d.vinculo_id || null) === (id || null);

/** Salva uma associação. Se a chave já apontar para OUTRO destino, só
 *  substitui com forcar=true; senão devolve {conflito}. */
async function salvarDePara(chave, vinculo_tipo, vinculo_id, opts = {}) {
    const chave_norm = normaliza(chave);
    if (!chave_norm) return { ok: false };
    const existente = deparaExistente(chave_norm, opts.ignorarId || null);
    if (existente && !mesmoDestino(existente, vinculo_tipo, vinculo_id) && !opts.forcar) {
        return { ok: false, conflito: existente };
    }
    if (existente) await sb.from('argos_mov_depara').delete().eq('id', existente.id);
    const registro = { chave: chave.trim(), chave_norm, vinculo_tipo, vinculo_id: vinculo_id || null };
    const q = opts.ignorarId
        ? sb.from('argos_mov_depara').update(registro).eq('id', opts.ignorarId)
        : sb.from('argos_mov_depara').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar o de-para.', true); return { ok: false }; }
    const { data } = await sb.from('argos_mov_depara').select('*');
    depara = data || depara;
    return { ok: true };
}

function limparFormDePara() {
    editandoDeParaId = null;
    document.getElementById('dp-form-titulo').textContent = 'Nova associação';
    document.getElementById('btn-dp-add').textContent = '+ Adicionar';
    document.getElementById('btn-dp-cancelar').style.display = 'none';
    document.getElementById('dp-chave').value = '';
    document.getElementById('dp-destino').value = '';
}

document.getElementById('btn-depara').addEventListener('click', () => {
    selectDestinoDePara(document.getElementById('dp-destino'));
    document.getElementById('dp-busca').value = '';
    limparFormDePara();
    renderDePara();
    abrirModal('modal-depara');
});
document.getElementById('btn-dp-cancelar').addEventListener('click', limparFormDePara);

document.getElementById('btn-dp-add').addEventListener('click', async () => {
    const chave = document.getElementById('dp-chave').value.trim();
    const destino = document.getElementById('dp-destino').value;
    if (!chave || !destino) { toast('Informe o trecho do pagador e o destino.', true); return; }
    const [vTipo, vId] = destino.split(':');
    const r = await salvarDePara(chave, vTipo, vId || null, { ignorarId: editandoDeParaId });
    if (r.conflito) {
        toast(`⛔ «${chave}» já está associado a ${nomeVinculo(r.conflito.vinculo_tipo, r.conflito.vinculo_id)}. Um pagador só pode apontar para um destino — edite ou exclua a associação existente.`, true);
        return;
    }
    if (!r.ok) return;
    toast(editandoDeParaId ? 'Associação atualizada.' : 'Associação salva.');
    limparFormDePara();
    renderDePara();
});

document.getElementById('lista-depara').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-dp-editar]');
    if (ed) {
        const d = depara.find(x => x.id === ed.dataset.dpEditar);
        if (!d) return;
        editandoDeParaId = d.id;
        document.getElementById('dp-form-titulo').textContent = `Editando: «${d.chave}»`;
        document.getElementById('btn-dp-add').textContent = 'Salvar alteração';
        document.getElementById('btn-dp-cancelar').style.display = '';
        document.getElementById('dp-chave').value = d.chave;
        document.getElementById('dp-destino').value = d.vinculo_tipo + ':' + (d.vinculo_id || '');
        return;
    }
    const btn = e.target.closest('[data-dp-excluir]');
    if (!btn) return;
    const d = depara.find(x => x.id === btn.dataset.dpExcluir);
    if (!d || !confirm(`Remover a associação «${d.chave}» → ${nomeVinculo(d.vinculo_tipo, d.vinculo_id)}?\n(As classificações já feitas não mudam.)`)) return;
    await sb.from('argos_mov_depara').delete().eq('id', d.id);
    const { data } = await sb.from('argos_mov_depara').select('*');
    depara = data || [];
    if (editandoDeParaId === d.id) limparFormDePara();
    renderDePara();
});

document.getElementById('btn-dp-aplicar').addEventListener('click', async () => {
    const semClassificacao = movimentacoes.filter(m => !alocDaMov(m.id).length);
    const n = await aplicarDeParaEm(semClassificacao);
    toast(n ? `${n} movimentação(ões) classificada(s) automaticamente pelo de-para.` : 'Nenhuma movimentação não classificada combina com o de-para.');
    if (n) { await carregarTudo(); renderDePara(); }
});

// ---------- CRUD de despesas ----------
function renderDespesas() {
    document.getElementById('lista-despesas').innerHTML = despesas.map(d => `
      <div class="argos-bloco ${d.ativo === false ? 'inativo' : ''}">
        <div class="bloco-topo">
          <b>${esc(d.nome)}</b>
          <span>
            <button class="argos-btn small" data-desp-editar="${d.id}">✏️</button>
            <button class="argos-btn small danger" data-desp-excluir="${d.id}">🗑️</button>
          </span>
        </div>
        <div class="bloco-info">
          ${formataMoeda(d.valor)} · ${RECORRENCIA_LABELS[d.recorrencia] || d.recorrencia} · a partir de ${formataBR(d.data_inicio)}${d.fim_data ? ` até ${formataBR(d.fim_data)}` : ''}${d.ativo === false ? ' · <span class="badge vermelho">Inativa</span>' : ''}
          ${d.observacoes ? `<br><span class="dim">${esc(d.observacoes)}</span>` : ''}
        </div>
      </div>`).join('') || '<p class="dim">Nenhuma despesa cadastrada ainda.</p>';
}

function limparFormDespesa() {
    editandoDespesaId = null;
    document.getElementById('form-despesa-titulo').textContent = 'Nova despesa';
    document.getElementById('btn-desp-cancelar').style.display = 'none';
    ['desp-nome', 'desp-valor', 'desp-fim', 'desp-obs'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('desp-recorrencia').value = 'mensal';
    document.getElementById('desp-inicio').value = hojeISO();
    document.getElementById('desp-ativo').checked = true;
}

document.getElementById('btn-despesas').addEventListener('click', () => {
    limparFormDespesa();
    renderDespesas();
    abrirModal('modal-despesas');
});
document.getElementById('btn-desp-cancelar').addEventListener('click', limparFormDespesa);

document.getElementById('lista-despesas').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-desp-editar]');
    if (ed) {
        const d = despesas.find(x => x.id === ed.dataset.despEditar);
        if (!d) return;
        editandoDespesaId = d.id;
        document.getElementById('form-despesa-titulo').textContent = `Editando: ${d.nome}`;
        document.getElementById('btn-desp-cancelar').style.display = '';
        document.getElementById('desp-nome').value = d.nome;
        document.getElementById('desp-valor').value = d.valor;
        document.getElementById('desp-recorrencia').value = d.recorrencia;
        document.getElementById('desp-inicio').value = d.data_inicio;
        document.getElementById('desp-fim').value = d.fim_data || '';
        document.getElementById('desp-obs').value = d.observacoes || '';
        document.getElementById('desp-ativo').checked = d.ativo !== false;
        return;
    }
    const del = e.target.closest('[data-desp-excluir]');
    if (del) {
        const d = despesas.find(x => x.id === del.dataset.despExcluir);
        if (!d || !confirm(`Excluir a despesa "${d.nome}"?`)) return;
        const { error } = await sb.from('argos_despesas').delete().eq('id', d.id);
        if (error) { toast('Erro ao excluir despesa.', true); return; }
        toast('Despesa excluída.');
        await carregarTudo();
        renderDespesas();
        if (editandoDespesaId === d.id) limparFormDespesa();
    }
});

document.getElementById('form-despesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registro = {
        nome: document.getElementById('desp-nome').value.trim(),
        valor: Number(document.getElementById('desp-valor').value) || 0,
        recorrencia: document.getElementById('desp-recorrencia').value,
        data_inicio: document.getElementById('desp-inicio').value || null,
        fim_data: document.getElementById('desp-fim').value || null,
        observacoes: document.getElementById('desp-obs').value.trim() || null,
        ativo: document.getElementById('desp-ativo').checked
    };
    if (!registro.nome || !registro.data_inicio) { toast('Informe nome e data de início.', true); return; }
    if (registro.fim_data && registro.fim_data < registro.data_inicio) { toast('A data final não pode ser antes do início.', true); return; }
    const q = editandoDespesaId
        ? sb.from('argos_despesas').update(registro).eq('id', editandoDespesaId)
        : sb.from('argos_despesas').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar despesa.', true); return; }
    toast(editandoDespesaId ? 'Despesa atualizada.' : 'Despesa cadastrada.');
    await carregarTudo();
    renderDespesas();
    limparFormDespesa();
});

// ---------- controles ----------
document.getElementById('modo-visao').addEventListener('change', render);
document.getElementById('ano-ref').addEventListener('change', render);
document.getElementById('mes-ref').addEventListener('change', render);
document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

// ---------- início ----------
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('planejamento_ver') && !perm.master) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Sem permissão para ver o planejamento financeiro.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    document.getElementById('ano-ref').value = new Date().getFullYear();
    document.getElementById('mov-data').value = hojeISO();
    document.getElementById('mes-ref').value = hojeISO().slice(0, 7);
    await carregarTudo();
})();
