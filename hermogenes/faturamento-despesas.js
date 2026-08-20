// faturamento-despesas.js — Extrato financeiro por período/obra/categoria.
// Lançamentos MANUAIS + linhas DERIVADAS (sem redigitação):
//   receitas ← medições (paga = realizada; faturada ou com previsão de recebimento = prevista)
//   despesas ← custo de pessoal (diárias × dias presentes das alocações; faltas não custam)
import { sb, toast, ligarFecharPorBackdrop, esc, fmtMoeda } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

let lancamentos = [];   // manuais
let categorias = [];
let obras = [];
let medicoes = [];
let integrantes = [];
let alocacoes = [];
let ausencias = [];
let flEditando = null;

const hojeStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [l, c, o, m, i, al, au] = await Promise.all([
        sb.from('hermo_lancamentos').select('*').order('data_competencia', { ascending: false }),
        sb.from('hermo_categorias_fin').select('*').order('nome'),
        sb.from('hermo_obras').select('id, numero, ano, nome, valor_contratado').order('ano', { ascending: false }).order('numero'),
        sb.from('hermo_medicoes').select('*'),
        sb.from('hermo_integrantes').select('id, nome, apelido, vinculo, valor_diaria, salario_mensal'),
        sb.from('hermo_alocacoes').select('*, obra_servico:hermo_obra_servicos(obra_id)'),
        sb.from('hermo_ausencias').select('*')
    ]);
    const erro = l.error || c.error || o.error || m.error || i.error || al.error || au.error;
    if (erro) { toast('Erro ao carregar dados: ' + erro.message, true); return; }
    lancamentos = l.data || [];
    categorias = c.data || [];
    obras = o.data || [];
    medicoes = m.data || [];
    integrantes = i.data || [];
    alocacoes = al.data || [];
    ausencias = au.data || [];
    popularFiltros();
    renderTudo();
}

const fmtObra = o => o ? `OB-${String(o.numero).padStart(4, '0')} — ${o.nome}` : '';

// ============================================================
// DERIVADOS
// ============================================================
/** Receitas derivadas das medições (líquido): paga = realizada; demais = prevista.
 *  Entram: faturadas/pagas (como sempre) e QUALQUER medição com previsão de
 *  recebimento informada — na data da previsão. */
function receitasDeMedicoes() {
    return medicoes
        .filter(m => m.status === 'faturada' || m.status === 'paga' || m.previsao_recebimento)
        .map(m => {
            const o = obras.find(x => x.id === m.obra_id);
            return {
                id: 'med:' + m.id,
                derivado: 'medição',
                tipo: 'receita',
                descricao: `Medição MED-${m.numero} — ${o ? o.nome : 'obra'}`,
                categoriaNome: 'Medição de obra',
                obra_id: m.obra_id,
                // paga sem data de recebimento NÃO usa a previsão (poderia cair em mês futuro
                // como "realizado"); cai no fim do período medido, como sempre foi
                data: m.status === 'paga'
                    ? (m.data_pagamento || m.periodo_ate || m.created_at.slice(0, 10))
                    : (m.previsao_recebimento || m.periodo_ate || m.created_at.slice(0, 10)),
                valor: num(m.valor_liquido),
                status: m.status === 'paga' ? 'realizado' : 'previsto',
                medicao_id: m.id
            };
        });
}

// ---- custo de pessoal (mesma regra da página de Integrantes) ----
function minutosTurno(turno, hi, hf) {
    if (turno === 'dia') return [420, 1020];
    if (turno === 'manha') return [420, 720];
    if (turno === 'tarde') return [780, 1020];
    const m = s => { const [h, mi] = String(s || '0:0').split(':').map(Number); return h * 60 + mi; };
    return [m(hi), m(hf)];
}
function periodosConflitam(a, b) {
    if (a.data_fim < b.data_inicio || b.data_fim < a.data_inicio) return false;
    const [ai, af] = minutosTurno(a.turno, a.hora_inicio, a.hora_fim);
    const [bi, bf] = minutosTurno(b.turno, b.hora_inicio, b.hora_fim);
    return Math.max(ai, bi) < Math.min(af, bf);
}
function pesoTurno(turno, hi, hf) {
    if (turno === 'dia') return 1;
    if (turno === 'manha' || turno === 'tarde') return 0.5;
    const [a, b] = minutosTurno('horario', hi, hf);
    return Math.max(0, (b - a) / 60) / 8;
}
/** Peso PRESENTE do dia: desconta proporcionalmente a sobreposição com ausências
 *  (falta de dia inteiro zera; ausência 'em rota' de 2h desconta 2/8 do dia). */
function pesoPresenteNoDia(integranteId, diaStr, turno, hi, hf) {
    const [ai, af] = minutosTurno(turno, hi, hf);
    let ocupado = 0;
    ausencias.filter(a => a.integrante_id === integranteId &&
        a.data_inicio <= diaStr && a.data_fim >= diaStr).forEach(a => {
        const [bi, bf] = minutosTurno(a.turno, a.hora_inicio, a.hora_fim);
        ocupado += Math.max(0, Math.min(af, bf) - Math.max(ai, bi));
    });
    const base = pesoTurno(turno, hi, hf);
    return Math.max(0, base - Math.min(ocupado, af - ai) / 60 / 8);
}

/** Despesas derivadas de pessoal no mês: por integrante×obra, separadas em realizado (até hoje) e previsto. */
function despesasDePessoal(mesIni, mesFim) {
    const hj = hojeStr();
    const acc = new Map(); // `${intId}|${obraId}|${real?1:0}` -> {dias, custo}
    alocacoes.forEach(a => {
        const i = integrantes.find(x => x.id === a.integrante_id);
        if (!i) return;
        const custoDia = i.vinculo === 'diarista' ? num(i.valor_diaria)
            : i.vinculo === 'mensalista' ? num(i.salario_mensal) / 22 : 0;
        if (custoDia <= 0) return;
        const ini = a.data_inicio > mesIni ? a.data_inicio : mesIni;
        const fim = a.data_fim < mesFim ? a.data_fim : mesFim;
        if (fim < ini) return;
        let d = new Date(ini + 'T12:00:00');
        const limite = new Date(fim + 'T12:00:00');
        while (d <= limite) {
            const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const peso = pesoPresenteNoDia(a.integrante_id, dia, a.turno, a.hora_inicio, a.hora_fim);
            if (peso > 0) {
                const chave = `${a.integrante_id}|${a.obra_servico?.obra_id || ''}|${dia <= hj ? 1 : 0}`;
                const v = acc.get(chave) || { dias: 0, custo: 0 };
                v.dias += peso;
                v.custo += custoDia * peso;
                acc.set(chave, v);
            }
            d.setDate(d.getDate() + 1);
        }
    });
    return [...acc.entries()].map(([chave, v]) => {
        const [intId, obraId, real] = chave.split('|');
        const i = integrantes.find(x => x.id === intId);
        return {
            id: 'pes:' + chave,
            derivado: 'pessoal',
            tipo: 'despesa',
            descricao: `${real === '1' ? 'Diárias' : 'Diárias previstas'} — ${i?.apelido || i?.nome || '?'} (${v.dias.toFixed(1)} dia(s))`,
            categoriaNome: 'Mão de obra / diárias',
            obra_id: obraId || null,
            // mês passado: data = fim do mês (não "hoje"); mês corrente: hoje
            data: real === '1' ? (mesFim < hojeStr() ? mesFim : hojeStr()) : mesFim,
            valor: Math.round(v.custo * 100) / 100,
            status: real === '1' ? 'realizado' : 'previsto'
        };
    });
}

/** Todas as linhas (manuais + derivadas) do mês filtrado. */
function linhasDoMes() {
    const mes = $('ft-mes').value; // YYYY-MM
    if (!mes) return [];
    const mesIni = mes + '-01';
    const [y, mo] = mes.split('-').map(Number);
    const mesFim = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;

    const manuais = lancamentos
        .filter(x => x.data_competencia >= mesIni && x.data_competencia <= mesFim)
        .map(x => ({
            id: x.id,
            derivado: null,
            tipo: x.tipo,
            descricao: x.descricao,
            categoriaNome: categorias.find(cc => cc.id === x.categoria_id)?.nome || '',
            obra_id: x.obra_id,
            data: x.data_competencia,
            valor: num(x.valor),
            status: x.status,
            bruto: x
        }));
    const derivadas = [
        ...receitasDeMedicoes().filter(x => x.data >= mesIni && x.data <= mesFim),
        ...despesasDePessoal(mesIni, mesFim)
    ];

    let linhas = [...manuais, ...derivadas];
    const tipo = $('ft-tipo').value;
    const obraF = $('ft-obra').value;
    const catF = $('ft-categoria').value;
    if (tipo) linhas = linhas.filter(x => x.tipo === tipo);
    if (obraF) linhas = linhas.filter(x => x.obra_id === obraF);
    if (catF) {
        const catNome = categorias.find(c => c.id === catF)?.nome;
        linhas = linhas.filter(x => x.categoriaNome === catNome);
    }
    linhas.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    return linhas;
}

// ============================================================
// RENDER
// ============================================================
function popularFiltros() {
    if (!$('ft-mes').value) {
        const d = new Date();
        $('ft-mes').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const selO = $('ft-obra');
    const atualO = selO.value;
    selO.innerHTML = '<option value="">Todas as obras</option>';
    obras.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = fmtObra(o);
        selO.appendChild(opt);
    });
    if ([...selO.options].some(x => x.value === atualO)) selO.value = atualO;

    const selC = $('ft-categoria');
    const atualC = selC.value;
    selC.innerHTML = '<option value="">Todas as categorias</option>';
    categorias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome;
        selC.appendChild(opt);
    });
    if ([...selC.options].some(x => x.value === atualC)) selC.value = atualC;
}

function renderTudo() {
    const linhas = linhasDoMes();
    renderResumo(linhas);
    renderGrafico();
    renderTabela(linhas);
    renderPorObra();
}

function renderResumo(linhas) {
    const soma = (tipo, status) => linhas
        .filter(x => x.tipo === tipo && x.status === status)
        .reduce((t, x) => t + x.valor, 0);
    const recebido = soma('receita', 'realizado');
    const aReceber = soma('receita', 'previsto');
    const pago = soma('despesa', 'realizado');
    const aPagar = soma('despesa', 'previsto');
    const resultado = recebido - pago;
    const projetado = recebido + aReceber - pago - aPagar;
    $('resumo').innerHTML = `
        <div class="stat s-concluida"><div class="num">${fmtMoeda(recebido)}</div><div class="lbl">Recebido no mês</div></div>
        <div class="stat s-marcada"><div class="num">${fmtMoeda(aReceber)}</div><div class="lbl">A receber</div></div>
        <div class="stat s-desistiu"><div class="num">${fmtMoeda(pago)}</div><div class="lbl">Despesas pagas</div></div>
        <div class="stat s-pendente"><div class="num">${fmtMoeda(aPagar)}</div><div class="lbl">A pagar</div></div>
        <div class="stat ${resultado >= 0 ? 's-concluida' : 's-desistiu'}"><div class="num">${fmtMoeda(resultado)}</div><div class="lbl">Resultado realizado</div></div>
        <div class="stat destaque"><div class="num">${projetado >= 0 ? '📈' : '📉'} Resultado projetado do mês (com previstos): <b>${fmtMoeda(projetado)}</b></div></div>`;
}

/** Barras dos últimos 6 meses (receitas × despesas, realizado+previsto). */
function renderGrafico() {
    const meses = [];
    const base = $('ft-mes').value ? new Date($('ft-mes').value + '-15T12:00:00') : new Date();
    for (let k = 5; k >= 0; k--) {
        const d = new Date(base.getFullYear(), base.getMonth() - k, 15);
        meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const dados = meses.map(mes => {
        const mesIni = mes + '-01';
        const [y, mo] = mes.split('-').map(Number);
        const mesFim = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
        const man = lancamentos.filter(x => x.data_competencia >= mesIni && x.data_competencia <= mesFim);
        const med = receitasDeMedicoes().filter(x => x.data >= mesIni && x.data <= mesFim);
        const pes = despesasDePessoal(mesIni, mesFim);
        const rec = man.filter(x => x.tipo === 'receita').reduce((t, x) => t + num(x.valor), 0)
            + med.reduce((t, x) => t + x.valor, 0);
        const desp = man.filter(x => x.tipo === 'despesa').reduce((t, x) => t + num(x.valor), 0)
            + pes.reduce((t, x) => t + x.valor, 0);
        return { mes, rec, desp };
    });
    const max = Math.max(1, ...dados.flatMap(d => [d.rec, d.desp]));
    $('ft-grafico').innerHTML = dados.map(d => `
        <div class="ft-mes">
            <div class="ft-barras">
                <div class="ft-barra rec" style="height:${Math.round(d.rec / max * 110)}px" title="Receitas ${fmtMoeda(d.rec)}"></div>
                <div class="ft-barra desp" style="height:${Math.round(d.desp / max * 110)}px" title="Despesas ${fmtMoeda(d.desp)}"></div>
            </div>
            <small>${d.mes.split('-').reverse().join('/')}</small>
        </div>`).join('') +
        `<div style="font-size:.7rem;color:var(--hermo-text-dim);align-self:flex-start">
            <span style="color:var(--hermo-success)">■</span> receitas &nbsp;
            <span style="color:var(--hermo-danger)">■</span> despesas</div>`;
}

function renderTabela(linhas) {
    $('ft-corpo').innerHTML = linhas.length === 0
        ? '<tr><td colspan="7" style="color:var(--hermo-text-dim)">Nenhum lançamento no período.</td></tr>'
        : linhas.map(x => {
            const o = obras.find(ob => ob.id === x.obra_id);
            return `<tr>
                <td>${(x.data || '').split('-').reverse().slice(0, 2).join('/')}</td>
                <td>${esc(x.descricao)} ${x.derivado ? `<span class="badge-origem">auto · ${x.derivado}</span>` : ''}</td>
                <td>${esc(x.categoriaNome || '—')}</td>
                <td>${o ? esc('OB-' + String(o.numero).padStart(4, '0')) : '—'}</td>
                <td class="${x.tipo === 'receita' ? 'vlr-rec' : 'vlr-desp'}">${x.tipo === 'receita' ? '+' : '−'} ${fmtMoeda(x.valor)}</td>
                <td><span class="badge-origem ${x.status === 'realizado' ? 'badge-real' : 'badge-prev'}">${x.status}</span></td>
                <td>${x.derivado
                    ? (x.derivado === 'medição'
                        ? `<a class="hermo-btn small ghost" href="medicoes-notas.html?editar=${x.medicao_id}" title="Abrir medição">↗</a>`
                        : '<span style="font-size:.7rem;color:var(--hermo-text-dim)">via alocações</span>')
                    : `<button class="hermo-btn small ghost" data-editar="${x.id}">✎</button>
                       <button class="hermo-btn small ghost" data-duplicar="${x.id}" title="Duplicar">⧉</button>
                       <button class="hermo-btn small danger" data-excluir="${x.id}">🗑</button>`}</td>
            </tr>`;
        }).join('');
    $('ft-corpo').querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click',
        () => abrirModal(lancamentos.find(x => x.id === b.dataset.editar))));
    $('ft-corpo').querySelectorAll('[data-duplicar]').forEach(b => b.addEventListener('click', () => {
        const x = lancamentos.find(l => l.id === b.dataset.duplicar);
        if (x) abrirModal({ ...x, id: null });
    }));
    $('ft-corpo').querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click',
        () => excluirLancamento(b.dataset.excluir)));
}

/** Resultado por obra (todas as datas): contratado × medido × recebido × despesas × margem. */
function renderPorObra() {
    const medDaObra = id => medicoes.filter(m => m.obra_id === id);
    // pessoal por obra em toda a história (janela larga)
    const pessoal = despesasDePessoal('2000-01-01', '2100-12-31');
    $('ft-obras-corpo').innerHTML = obras.map(o => {
        const meds = medDaObra(o.id);
        const medido = meds.filter(m => ['aprovada', 'faturada', 'paga'].includes(m.status))
            .reduce((t, m) => t + num(m.valor_liquido), 0);
        const recebido = meds.filter(m => m.status === 'paga')
            .reduce((t, m) => t + num(m.valor_liquido), 0);
        // receitas manuais da obra entram no recebido (simetria com as despesas manuais)
        const recManual = lancamentos.filter(x => x.tipo === 'receita' && x.obra_id === o.id && x.status === 'realizado')
            .reduce((t, x) => t + num(x.valor), 0);
        const recebidoTotal = recebido + recManual;
        const despManual = lancamentos.filter(x => x.tipo === 'despesa' && x.obra_id === o.id)
            .reduce((t, x) => t + num(x.valor), 0);
        const despPessoal = pessoal.filter(x => x.obra_id === o.id).reduce((t, x) => t + x.valor, 0);
        const despesas = despManual + despPessoal;
        const margem = recebidoTotal - despesas;
        if (num(o.valor_contratado) === 0 && medido === 0 && despesas === 0) return '';
        return `<tr>
            <td><b>${esc(fmtObra(o))}</b></td>
            <td>${fmtMoeda(o.valor_contratado)}</td>
            <td>${fmtMoeda(medido)}</td>
            <td>${fmtMoeda(recebidoTotal)}</td>
            <td>${fmtMoeda(despesas)}</td>
            <td><b style="color:${margem >= 0 ? 'var(--hermo-success)' : 'var(--hermo-danger)'}">${fmtMoeda(margem)}</b></td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" style="color:var(--hermo-text-dim)">Nenhuma obra com movimento.</td></tr>';
}

// ============================================================
// MODAL LANÇAMENTO
// ============================================================
function popularSelectsModal(cat = null, obra = null) {
    const selC = $('fl-categoria');
    selC.innerHTML = '<option value="">— sem categoria —</option>';
    categorias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nome} (${c.tipo})`;
        selC.appendChild(opt);
    });
    if (cat) selC.value = cat;
    const selO = $('fl-obra');
    selO.innerHTML = '<option value="">— sem obra —</option>';
    obras.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = fmtObra(o);
        selO.appendChild(opt);
    });
    if (obra) selO.value = obra;
}

function abrirModal(lanc) {
    flEditando = lanc?.id ? lanc : null;
    $('fl-titulo').textContent = flEditando ? 'Editar lançamento' : (lanc ? 'Duplicar lançamento' : 'Novo lançamento');
    $('fl-tipo').value = lanc?.tipo || 'despesa';
    $('fl-valor').value = lanc?.valor || '';
    $('fl-descricao').value = lanc?.descricao || '';
    popularSelectsModal(lanc?.categoria_id || null, lanc?.obra_id || null);
    $('fl-competencia').value = lanc?.data_competencia || hojeStr();
    $('fl-pagamento').value = lanc?.data_pagamento || '';
    $('fl-status').value = lanc?.status || 'previsto';
    $('fl-forma').value = lanc?.forma_pagamento || '';
    $('fl-obs').value = lanc?.observacoes || '';
    $('fl-nova-cat-wrap').style.display = 'none';
    $('fl-overlay').classList.add('aberto');
    $('fl-descricao').focus();
}

async function salvarLancamento() {
    const descricao = $('fl-descricao').value.trim();
    const valor = num($('fl-valor').value);
    if (!descricao) { toast('Descrição é obrigatória.', true); return; }
    if (valor <= 0) { toast('Informe um valor maior que zero.', true); return; }
    if (!$('fl-competencia').value) { toast('Informe a data de competência.', true); return; }
    const registro = {
        tipo: $('fl-tipo').value,
        descricao,
        categoria_id: $('fl-categoria').value || null,
        obra_id: $('fl-obra').value || null,
        data_competencia: $('fl-competencia').value,
        data_pagamento: $('fl-pagamento').value || null,
        valor,
        status: $('fl-status').value,
        forma_pagamento: $('fl-forma').value.trim() || null,
        observacoes: $('fl-obs').value.trim() || null
    };
    const btn = $('fl-salvar');
    btn.disabled = true;
    try {
        const res = flEditando
            ? await sb.from('hermo_lancamentos').update(registro).eq('id', flEditando.id)
            : await sb.from('hermo_lancamentos').insert(registro);
        if (res.error) throw res.error;
        toast(flEditando ? 'Lançamento atualizado.' : 'Lançamento criado.');
        $('fl-overlay').classList.remove('aberto');
        flEditando = null;
        await carregarTudo();
    } catch (e) {
        toast('Erro ao salvar: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

async function excluirLancamento(id) {
    if (!confirm('Excluir este lançamento?')) return;
    const { error } = await sb.from('hermo_lancamentos').delete().eq('id', id);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast('Lançamento excluído.');
    await carregarTudo();
}

async function salvarNovaCategoria() {
    const nome = $('fl-nova-cat').value.trim();
    if (!nome) { toast('Informe o nome da categoria.', true); return; }
    const { data, error } = await sb.from('hermo_categorias_fin')
        .insert({ nome, tipo: $('fl-tipo').value }).select().single();
    if (error) {
        toast((error.code || '') === '23505' ? 'Essa categoria já existe.' : 'Erro: ' + error.message, true);
        return;
    }
    categorias.push(data);
    categorias.sort((a, b) => a.nome.localeCompare(b.nome));
    popularSelectsModal(data.id, $('fl-obra').value || null);
    popularFiltros();
    $('fl-nova-cat-wrap').style.display = 'none';
    $('fl-nova-cat').value = '';
    toast('Categoria criada.');
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('btn-novo').addEventListener('click', () => abrirModal(null));
['ft-mes', 'ft-tipo', 'ft-obra', 'ft-categoria'].forEach(id =>
    $(id).addEventListener('change', renderTudo));
$('fl-fechar').addEventListener('click', () => $('fl-overlay').classList.remove('aberto'));
$('fl-cancelar').addEventListener('click', () => $('fl-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('fl-overlay'), () => $('fl-overlay').classList.remove('aberto'));
$('fl-salvar').addEventListener('click', salvarLancamento);
$('fl-btn-nova-cat').addEventListener('click', () => {
    const w = $('fl-nova-cat-wrap');
    w.style.display = w.style.display === 'none' ? '' : 'none';
});
$('fl-btn-salvar-cat').addEventListener('click', salvarNovaCategoria);

carregarTudo();
