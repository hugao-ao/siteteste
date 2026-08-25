// faturamento-despesas.js — Extrato financeiro por período/obra/categoria.
// Lançamentos MANUAIS + linhas DERIVADAS (sem redigitação):
//   receitas ← medições (paga = realizada; faturada ou com previsão de recebimento = prevista)
//   receitas ← parcelas do contrato (o que as medições ainda não cobriram)
//   despesas ← custo de pessoal (diárias × dias presentes das alocações; faltas não custam)
import {
    sb, toast, ligarFecharPorBackdrop, esc, fmtMoeda,
    dataDaParcela, parcelaPorMedicao, dataLocalDe
} from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

let lancamentos = [];   // manuais
let categorias = [];
let obras = [];
let medicoes = [];
let integrantes = [];
let alocacoes = [];
let ausencias = [];
let obraPropostas = [];  // vínculo obra→proposta com as parcelas contratadas
let flEditando = null;

const hojeStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [l, c, o, m, i, al, au, op] = await Promise.all([
        sb.from('hermo_lancamentos').select('*').order('data_competencia', { ascending: false }),
        sb.from('hermo_categorias_fin').select('*').order('nome'),
        sb.from('hermo_obras')
            // prazo = data prevista de término; é o marco da parcela "na conclusão"
            // enquanto a obra não é concluída de fato
            .select('id, numero, ano, nome, valor_contratado, inicio_previsto, inicio_real, conclusao, prazo')
            .order('ano', { ascending: false }).order('numero'),
        sb.from('hermo_medicoes').select('*'),
        sb.from('hermo_integrantes').select('id, nome, apelido, vinculo, valor_diaria, salario_mensal'),
        sb.from('hermo_alocacoes').select('*, obra_servico:hermo_obra_servicos(obra_id)'),
        sb.from('hermo_ausencias').select('*'),
        sb.from('hermo_obra_propostas').select(`obra_id,
            proposta:hermo_propostas(id, numero, ano, data_proposta,
                parcelas:hermo_proposta_parcelas(*))`)
    ]);
    const erro = l.error || c.error || o.error || m.error || i.error || al.error || au.error;
    if (erro) { toast('Erro ao carregar dados: ' + erro.message, true); return; }
    if (op.error) toast('Aviso: não deu para carregar as parcelas dos contratos (' + op.error.message + ') — a previsão por contrato não aparece.', true);
    lancamentos = l.data || [];
    categorias = c.data || [];
    obras = o.data || [];
    medicoes = m.data || [];
    integrantes = i.data || [];
    alocacoes = al.data || [];
    ausencias = au.data || [];
    obraPropostas = op.data || [];
    popularFiltros();
    renderTudo();
}

const fmtObra = o => o ? `OB-${String(o.numero).padStart(4, '0')} — ${o.nome}` : '';

// ============================================================
// DERIVADOS
// ============================================================
/** Soma dos lançamentos de RECEITA atrelados a cada medição (recebimentos). */
function ligadosPorMedicao() {
    const mapa = new Map();
    lancamentos.forEach(l => {
        if (l.tipo !== 'receita' || !l.medicao_id) return;
        const ac = mapa.get(l.medicao_id) || { total: 0, realizado: 0 };
        ac.total += num(l.valor);
        if (l.status === 'realizado') ac.realizado += num(l.valor);
        mapa.set(l.medicao_id, ac);
    });
    return mapa;
}

/** Receitas derivadas das medições, CONCILIADAS com os recebimentos atrelados:
 *  - medição SEM lançamentos: paga = realizada (líquido, legado); com previsão
 *    de recebimento ou faturada = prevista (líquido) na data prevista;
 *  - medição COM lançamentos atrelados: os recebimentos já aparecem como
 *    lançamentos — aqui entra só o SALDO ainda previsto (líquido − lançado)
 *    enquanto ela não estiver paga. Paga recebendo menos = RETENÇÃO (não gera
 *    saldo previsto); recebendo mais = BÔNUS (só constatado). */
function receitasDeMedicoes() {
    const ligados = ligadosPorMedicao();
    const linhas = [];
    medicoes.forEach(m => {
        const o = obras.find(x => x.id === m.obra_id);
        const liq = num(m.valor_liquido);
        const lig = ligados.get(m.id);
        const base = {
            id: 'med:' + m.id,
            derivado: 'medição',
            tipo: 'receita',
            descricao: `Medição MED-${m.numero} — ${o ? o.nome : 'obra'}`,
            categoriaNome: 'Medição de obra',
            obra_id: m.obra_id,
            medicao_id: m.id
        };
        if (lig) {
            if (m.status !== 'paga') {
                const saldo = Math.round((liq - lig.total) * 100) / 100;
                if (saldo > 0.005 && (m.previsao_recebimento || m.status === 'faturada')) {
                    linhas.push({
                        ...base,
                        descricao: base.descricao + ' (saldo a receber)',
                        data: m.previsao_recebimento || m.periodo_ate || dataLocalDe(m.created_at),
                        valor: saldo,
                        status: 'previsto'
                    });
                }
            }
            return; // os recebimentos em si já são lançamentos visíveis
        }
        if (m.status === 'paga') {
            linhas.push({
                ...base,
                // paga sem data de recebimento não usa a previsão (cairia em mês futuro)
                data: m.data_pagamento || m.periodo_ate || dataLocalDe(m.created_at),
                valor: liq,
                status: 'realizado'
            });
        } else if (m.status === 'faturada' || m.previsao_recebimento) {
            linhas.push({
                ...base,
                data: m.previsao_recebimento || m.periodo_ate || dataLocalDe(m.created_at),
                valor: liq,
                status: 'previsto'
            });
        }
    });
    return linhas;
}

/** A medição já colocou dinheiro no extrato por conta própria? É exatamente o
 *  mesmo critério que receitasDeMedicoes() usa para emitir linha (incluindo as
 *  conciliadas por lançamento, cujo dinheiro aparece como lançamento manual).
 *  Medição em elaboração ou enviada sem data de recebimento não gera linha
 *  nenhuma — nesse caso o plano do contrato tem de continuar de pé, senão o
 *  dinheiro simplesmente some da previsão. */
const medicaoJaNoExtrato = (m, ligados) =>
    m.status === 'paga' || m.status === 'faturada' ||
    !!m.previsao_recebimento || !!ligados.get(m.id);

/** Previsão de recebimento vinda das PARCELAS do contrato — o plano combinado
 *  com o cliente, que existe antes de haver medição.
 *  Para não contar duas vezes, abate do plano só o que as medições JÁ COLOCARAM
 *  no extrato por receitasDeMedicoes(). */
function receitasDeParcelas() {
    const linhas = [];
    const ligados = ligadosPorMedicao();
    obras.forEach(o => {
        const vinculos = obraPropostas.filter(x => x.obra_id === o.id && x.proposta);
        const todas = vinculos
            .flatMap(v => (v.proposta.parcelas || []).map(p => ({ p, proposta: v.proposta })))
            .sort((a, b) =>
                (a.proposta.ano - b.proposta.ano) ||
                (a.proposta.numero - b.proposta.numero) ||
                (a.p.ordem - b.p.ordem));
        // parcela atrelada a medição já vira previsão pela própria medição
        const parcelas = todas.filter(x => !parcelaPorMedicao(x.p));
        if (!parcelas.length) return;

        let coberto = medicoes.filter(m => m.obra_id === o.id && medicaoJaNoExtrato(m, ligados))
            .reduce((t, m) => t + num(m.valor_liquido), 0);
        // a fatia do plano que era "por medição" JÁ saiu do plano acima; o medido
        // consome essa fatia primeiro e só o excedente abate as parcelas fixas —
        // sem isto, um contrato "sinal + resto por medição" perderia o sinal.
        const fatiaPorMedicao = todas.filter(x => parcelaPorMedicao(x.p))
            .reduce((t, x) => t + num(x.p.valor), 0);
        coberto = Math.max(0, coberto - fatiaPorMedicao);

        parcelas.forEach(({ p, proposta }) => {
            let valor = num(p.valor);
            if (coberto > 0.005) {
                const usa = Math.min(coberto, valor);
                coberto -= usa;
                valor -= usa;
            }
            if (valor < 0.005) return;
            const data = dataDaParcela(p, o, proposta);
            if (!data) return;   // sem marco definido não dá para prever o mês
            linhas.push({
                id: 'parc:' + p.id,
                derivado: 'contrato',
                tipo: 'receita',
                descricao: `${p.descricao || 'Parcela'} — ${o.nome} (proposta ${String(proposta.numero).padStart(4, '0')}/${proposta.ano})`,
                categoriaNome: 'Parcela de contrato',
                obra_id: o.id,
                data,
                valor: Math.round(valor * 100) / 100,
                status: 'previsto'
            });
        });
    });
    return linhas;
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
        ...receitasDeParcelas().filter(x => x.data >= mesIni && x.data <= mesFim),
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
    // as derivadas não dependem do mês: calcula uma vez e recorta (antes rodava 6×)
    const derivadasReceita = [...receitasDeMedicoes(), ...receitasDeParcelas()];
    const dados = meses.map(mes => {
        const mesIni = mes + '-01';
        const [y, mo] = mes.split('-').map(Number);
        const mesFim = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
        const man = lancamentos.filter(x => x.data_competencia >= mesIni && x.data_competencia <= mesFim);
        const med = derivadasReceita.filter(x => x.data >= mesIni && x.data <= mesFim);
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
                        : x.derivado === 'contrato'
                            ? '<span style="font-size:.7rem;color:var(--hermo-text-dim)">parcela da proposta</span>'
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
    const ligados = ligadosPorMedicao();
    // pessoal por obra em toda a história (janela larga)
    const pessoal = despesasDePessoal('2000-01-01', '2100-12-31');
    $('ft-obras-corpo').innerHTML = obras.map(o => {
        const meds = medDaObra(o.id);
        const medido = meds.filter(m => ['aprovada', 'faturada', 'paga'].includes(m.status))
            .reduce((t, m) => t + num(m.valor_liquido), 0);
        // medição paga COM lançamentos atrelados é conciliada pelos lançamentos
        // (evita contar o líquido E o recebimento — mesma regra do extrato)
        const recebido = meds.filter(m => m.status === 'paga' && !ligados.get(m.id))
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

/** Preenche o select de medições (recebimentos são atrelados a uma medição). */
function popularMedicoesModal(selecionarId = null) {
    const sel = $('fl-medicao');
    sel.innerHTML = '<option value="">— escolha a medição —</option>';
    const ordenadas = [...medicoes].sort((a, b) => (a.obra_id + a.numero).localeCompare(b.obra_id + b.numero));
    ordenadas.forEach(m => {
        const o = obras.find(x => x.id === m.obra_id);
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `MED-${m.numero} · ${o ? fmtObra(o) : 'obra removida'} — líquido ${fmtMoeda(m.valor_liquido)} (${m.status})`;
        sel.appendChild(opt);
    });
    if (selecionarId) sel.value = selecionarId;
    atualizarInfoMedicao();
}

function atualizarInfoMedicao() {
    const m = medicoes.find(x => x.id === $('fl-medicao').value);
    const info = $('fl-medicao-info');
    if (!m) { info.textContent = ''; return; }
    const lig = ligadosPorMedicao().get(m.id) || { total: 0, realizado: 0 };
    // em edição, o próprio lançamento não conta no "já lançado"
    let jaLancado = lig.total;
    if (flEditando?.medicao_id === m.id) jaLancado -= num(flEditando.valor);
    const saldo = Math.round((num(m.valor_liquido) - jaLancado) * 100) / 100;
    info.textContent = `Líquido ${fmtMoeda(m.valor_liquido)} · já lançado ${fmtMoeda(jaLancado)} · saldo ${fmtMoeda(saldo)}` +
        (saldo < -0.005 ? ' (acima da medição = bônus)' : '');
}

function aoMudarTipoLanc() {
    $('fl-medicao-wrap').style.display = $('fl-tipo').value === 'receita' ? '' : 'none';
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
    popularMedicoesModal(lanc?.medicao_id || null);
    $('fl-obra').disabled = !!lanc?.medicao_id;
    $('fl-obra').title = lanc?.medicao_id ? 'A obra vem da medição escolhida' : '';
    aoMudarTipoLanc();
    $('fl-overlay').classList.add('aberto');
    $('fl-descricao').focus();
}

async function salvarLancamento() {
    const descricao = $('fl-descricao').value.trim();
    const valor = num($('fl-valor').value);
    if (!descricao) { toast('Descrição é obrigatória.', true); return; }
    if (valor <= 0) { toast('Informe um valor maior que zero.', true); return; }
    if (!$('fl-competencia').value) { toast('Informe a data de competência.', true); return; }
    const ehReceita = $('fl-tipo').value === 'receita';
    const medicaoSel = ehReceita ? medicoes.find(m => m.id === $('fl-medicao').value) : null;
    // medição é obrigatória para recebimentos NOVOS; editar um lançamento antigo
    // que nunca teve medição continua possível (registro histórico não é bloqueado)
    if (ehReceita && !medicaoSel && !(flEditando && !flEditando.medicao_id)) {
        toast('Todo recebimento deve ser atrelado a uma medição — escolha a medição.', true);
        return;
    }
    const registro = {
        tipo: $('fl-tipo').value,
        descricao,
        categoria_id: $('fl-categoria').value || null,
        // receita atrelada: a obra vem da medição (evita divergência)
        obra_id: medicaoSel ? medicaoSel.obra_id : ($('fl-obra').value || null),
        medicao_id: medicaoSel ? medicaoSel.id : null,
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
$('fl-tipo').addEventListener('change', aoMudarTipoLanc);
$('fl-medicao').addEventListener('change', () => {
    const m = medicoes.find(x => x.id === $('fl-medicao').value);
    atualizarInfoMedicao();
    // obra fica travada quando a medição manda nela (evita escolha ignorada no salvar)
    $('fl-obra').disabled = !!m;
    $('fl-obra').title = m ? 'A obra vem da medição escolhida' : '';
    if (!m) return;
    const o = obras.find(x => x.id === m.obra_id);
    $('fl-obra').value = m.obra_id || '';
    // pré-preenche com o SALDO da medição SOMENTE se o valor ainda não foi digitado
    if (!num($('fl-valor').value)) {
        const lig = ligadosPorMedicao().get(m.id) || { total: 0 };
        let jaLancado = lig.total;
        if (flEditando?.medicao_id === m.id) jaLancado -= num(flEditando.valor);
        const saldo = Math.round((num(m.valor_liquido) - jaLancado) * 100) / 100;
        $('fl-valor').value = Math.max(saldo, 0) || '';
    }
    if (!$('fl-descricao').value.trim()) {
        $('fl-descricao').value = `Recebimento MED-${m.numero} — ${o ? o.nome : 'obra'}`;
    }
});
$('fl-btn-nova-cat').addEventListener('click', () => {
    const w = $('fl-nova-cat-wrap');
    w.style.display = w.style.display === 'none' ? '' : 'none';
});
$('fl-btn-salvar-cat').addEventListener('click', salvarNovaCategoria);

carregarTudo();
