// planejamento.js — Card "Planejamento Financeiro" da área Argos
// Projeção por período das contas da clínica: faturamento puxado direto das
// sessões (mesma conta do Fechamento Mensal), repasses automáticos aos
// profissionais e despesas cadastradas com recorrências variadas.
// Visões: anual (mês a mês) e mensal (detalhada).

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { fechamentoPaciente, formataMoeda, formataBR, hojeISO, fimDoMes } from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], despesas = [];
let editandoDespesaId = null;

const MES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const RECORRENCIA_LABELS = { unica: 'Única', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' };

async function carregarTudo() {
    const [rPac, rDin, rSes, rProf, rDesp] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_despesas').select('*').order('created_at')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error || rDesp.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    pacientes = rPac.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    profissionais = rProf.data || [];
    despesas = rDesp.data || [];
    render();
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
function calculaMes(mes) {
    let faturamento = 0;
    const porPaciente = [];
    const producao = {};
    for (const p of pacientes) {
        const f = fechamentoPaciente(p,
            dinamicas.filter(d => d.paciente_id === p.id),
            sessoes.filter(s => s.paciente_id === p.id), mes);
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
        faturamento, porPaciente, repProf, repasses,
        itensDespesas, totalDespesas,
        resultado: faturamento - repasses - totalDespesas
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
        const cor = v => opts.sinal ? (v < 0 ? 'neg' : (v > 0 ? 'pos' : '')) : '';
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

    const linhas = [];
    linhas.push(linhaHTML('📥 ENTRADAS — Faturamento (sessões e anamneses)', dados.map(c => c.faturamento), { grupo: 'entradas' }));
    ordenado(porPac).forEach(l => linhas.push(linhaHTML(esc(l.nome), l.valores, { detalheDe: 'entradas' })));
    linhas.push(linhaHTML('💼 SAÍDAS — Repasses aos profissionais', dados.map(c => c.repasses), { grupo: 'repasses' }));
    ordenado(porRep).forEach(l => linhas.push(linhaHTML(esc(l.nome), l.valores, { detalheDe: 'repasses' })));
    linhas.push(linhaHTML('💸 SAÍDAS — Despesas', dados.map(c => c.totalDespesas), { grupo: 'despesas' }));
    ordenado(porDesp).forEach(l => linhas.push(linhaHTML(esc(l.nome), l.valores, { detalheDe: 'despesas' })));
    linhas.push(linhaHTML('<b>🟰 RESULTADO (entradas − saídas)</b>', dados.map(c => c.resultado), { classeExtra: 'linha-total', sinal: true }));

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
    document.getElementById('tbody-resumo-mes').innerHTML = `
      <tr><td><b>📥 Faturamento (sessões e anamneses)</b></td><td>${formataMoeda(c.faturamento)}</td></tr>
      <tr><td><b>💼 Repasses aos profissionais</b></td><td>− ${formataMoeda(c.repasses)}</td></tr>
      <tr><td><b>💸 Despesas</b></td><td>− ${formataMoeda(c.totalDespesas)}</td></tr>
      <tr class="linha-total"><td><b>Resultado do mês</b></td><td><b style="color:${corResultado(c.resultado)}">${formataMoeda(c.resultado)}</b></td></tr>`;
    document.getElementById('tbody-mes-faturamento').innerHTML =
        c.porPaciente.map(x => `<tr><td>${esc(x.nome)}</td><td>${formataMoeda(x.valor)}</td></tr>`).join('')
        || '<tr><td colspan="2" class="dim">Sem faturamento neste mês.</td></tr>';
    document.getElementById('tbody-mes-repasses').innerHTML =
        c.repProf.map(x => `<tr><td>${esc(x.nome)}</td><td>${x.fixo ? formataMoeda(x.fixo) : '—'}</td><td>${x.prod ? formataMoeda(x.prod) : '—'}</td><td><b>${formataMoeda(x.total)}</b></td></tr>`).join('')
        || '<tr><td colspan="4" class="dim">Nenhum repasse neste mês.</td></tr>';
    document.getElementById('tbody-mes-despesas').innerHTML =
        c.itensDespesas.map(x => `<tr><td>${esc(x.nome)}${x.extra ? ` <span class="dim">(${esc(x.extra)})</span>` : ''}</td><td>${RECORRENCIA_LABELS[x.recorrencia]}</td><td>${formataMoeda(x.valor)}</td></tr>`).join('')
        || '<tr><td colspan="3" class="dim">Nenhuma despesa neste mês.</td></tr>';
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
    document.getElementById('mes-ref').value = hojeISO().slice(0, 7);
    await carregarTudo();
})();
