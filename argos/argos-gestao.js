// argos-gestao.js — contas de gestão compartilhadas (painel e relatórios)
// ======================================================================
// Pequenas funções puras que várias telas de gestão precisam: despesas
// previstas de um mês, contagem de sessões por situação, entradas do
// extrato ainda sem paciente. Recebem listas prontas; não vão ao banco.

import { fimDoMes, mesclarSessoes, aplicarFimDeProcesso } from './argos-recorrencia.js';

/** Despesas cadastradas que caem num mês, já com a recorrência expandida. */
export function despesasDoMes(despesas = [], mes) {
    const de = mes + '-01', ate = fimDoMes(mes), itens = [];
    for (const d of despesas) {
        if (d.sistema || d.ativo === false || !d.data_inicio) continue;
        const ini = d.data_inicio, fim = d.fim_data || null, v = Number(d.valor) || 0;
        if (d.recorrencia === 'unica') { if (ini >= de && ini <= ate) itens.push({ nome: d.nome, valor: v }); }
        else if (d.recorrencia === 'mensal') { if (ini <= ate && (!fim || fim >= de)) itens.push({ nome: d.nome, valor: v }); }
        else if (d.recorrencia === 'anual') { if (ini.slice(5, 7) === mes.slice(5, 7) && ini <= ate && (!fim || fim >= de)) itens.push({ nome: d.nome, valor: v }); }
        else if (d.recorrencia === 'semanal') {
            const dow = new Date(ini + 'T12:00').getDay(); let n = 0;
            for (let dt = new Date(de + 'T12:00'); ; dt.setDate(dt.getDate() + 1)) {
                const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                if (iso > ate) break;
                if (dt.getDay() === dow && iso >= ini && (!fim || iso <= fim)) n++;
            }
            if (n) itens.push({ nome: `${d.nome} (${n}×)`, valor: v * n });
        }
    }
    return itens.sort((a, b) => b.valor - a.valor);
}

/** Todas as sessões (reais e projetadas) entre duas datas, com o fim de processo aplicado. */
export function sessoesEntre({ dinamicas = [], sessoes = [], pacientes = [] }, de, ate) {
    const c = aplicarFimDeProcesso(dinamicas, sessoes, pacientes);
    const dins = c.dinamicas.map(d => d.ativo === false ? { ...d, ativo: true } : d);
    return mesclarSessoes(dins, c.sessoes, de, ate);
}

/** Quantas sessões em cada situação; «pend» só conta as vencidas. */
export function contagemSessoes(lista = [], hoje) {
    const c = { ok: 0, fc: 0, fj: 0, nc: 0, pend: 0, futuras: 0, semValidar: 0, propostas: 0, total: lista.length };
    for (const s of lista) {
        if (s.status === '??') { if (s.data <= hoje) c.pend++; else c.futuras++; }
        else c[s.status] = (c[s.status] || 0) + 1;
        if (s.id && s.status !== '??' && !s.validado_em) c.semValidar++;
        if (s.status_proposto && !s.validado_em) c.propostas++;
    }
    c.contabilizadas = c.ok + c.fc;
    return c;
}

/** Entradas do extrato que ainda não foram (totalmente) ligadas a um paciente/locação. */
export function entradasSemAlocacao(movimentacoes = [], alocacoes = []) {
    const soma = new Map();
    for (const a of alocacoes) soma.set(a.movimentacao_id, (soma.get(a.movimentacao_id) || 0) + (Number(a.valor) || 0));
    const lista = [];
    for (const m of movimentacoes) {
        if (m.tipo !== 'entrada') continue;
        const falta = Math.abs(Number(m.valor) || 0) - (soma.get(m.id) || 0);
        if (falta > 0.009) lista.push({ mov: m, falta });
    }
    return { lista, total: lista.reduce((s, x) => s + x.falta, 0) };
}
