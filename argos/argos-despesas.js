// argos-despesas.js — o catálogo de despesas e a ponte com o extrato
// ==================================================================
// O catálogo é a lista fechada de para onde o dinheiro da clínica pode ir:
// é ele que aparece no menu ao classificar uma saída e é ele que forma as
// linhas de despesa da previsão. O de-para liga o que vem escrito no extrato
// do banco («PATRICIA TAVORA T SOUZA») à categoria do catálogo («PATRICIA»),
// para a saída do mês que vem se classificar sozinha.
//
// A previsão é a parte que ninguém tem no primeiro dia: o nome da categoria
// se sabe, quanto ela vai custar não. Mas o extrato já classificado sabe —
// e é daí que sai a sugestão. Por isso as duas coisas moram no mesmo lugar:
// classificar o passado é o que ensina o sistema a prever o futuro.

import { dinheiro } from './argos-import-financeiro.js';

/** Como as chaves do de-para são comparadas: sem acento, sem caixa. */
export const normalizaChave = t =>
    String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ---------------------------------------------------------------------------
// De-para: do extrato para a categoria
// ---------------------------------------------------------------------------

/** Entrada só casa com paciente; saída, com profissional ou despesa. */
export function deparaCompativel(mov, d) {
    if (!mov || !d) return false;
    if (d.vinculo_tipo === 'outro') return true;
    return mov.tipo === 'entrada' ? d.vinculo_tipo === 'paciente'
        : (d.vinculo_tipo === 'profissional' || d.vinculo_tipo === 'despesa');
}

/**
 * A associação que vale para esta movimentação, ou null.
 *
 * O trecho mais longo ganha, e é isso que resolve os pagadores que se
 * repetem: «DANIEL RODRIGUES DE LIMA - Salario» e «DANIEL RODRIGUES DE LIMA
 * - Alimentação» são a mesma pessoa e despesas diferentes, e a descrição
 * completa contém as duas chaves.
 */
export function encontraDePara(mov, depara = []) {
    const desc = normalizaChave(mov && mov.descricao);
    if (!desc) return null;
    const candidatos = (depara || []).filter(d =>
        deparaCompativel(mov, d) && d.chave_norm && desc.includes(d.chave_norm));
    if (!candidatos.length) return null;
    return candidatos.sort((a, b) => b.chave_norm.length - a.chave_norm.length)[0];
}

/**
 * Saídas que o de-para ainda não sabe classificar, agrupadas pela descrição.
 *
 * É a lista de trabalho de quem mantém o de-para: cada linha é um pagador
 * novo que apareceu no extrato e ainda não tem para onde ir.
 */
export function saidasSemAssociacao(movs = [], alocacoes = [], depara = []) {
    const temAloc = new Set((alocacoes || []).map(a => a.movimentacao_id));
    const grupos = new Map();
    for (const m of movs) {
        if (m.tipo !== 'saida' || temAloc.has(m.id)) continue;
        if (encontraDePara(m, depara)) continue;
        const g = grupos.get(m.descricao)
            || { descricao: m.descricao, quantas: 0, total: 0, primeira: m.data, ultima: m.data };
        g.quantas++;
        g.total += Number(m.valor) || 0;
        if (m.data < g.primeira) g.primeira = m.data;
        if (m.data > g.ultima) g.ultima = m.data;
        grupos.set(m.descricao, g);
    }
    return [...grupos.values()].sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// O realizado de cada despesa
// ---------------------------------------------------------------------------

const mediana = ns => {
    if (!ns.length) return 0;
    const o = [...ns].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * Quanto cada despesa custou de fato, mês a mês.
 *
 * `tipico` é a mediana dos meses em que houve gasto, não a média: uma
 * despesa que costuma ser R$ 1.050 e teve um mês de R$ 14.000 continua
 * sendo R$ 1.050 para efeito de previsão, e a média diria R$ 3.000.
 * `meses` diz em quantos dos meses observados ela apareceu — é o que revela
 * que uma despesa é eventual, e não mensal.
 */
export function realizadoPorDespesa(despesas = [], movs = [], alocacoes = []) {
    const porMov = new Map((movs || []).map(m => [m.id, m]));
    const acum = new Map();
    for (const a of alocacoes || []) {
        if (a.vinculo_tipo !== 'despesa' || !a.vinculo_id) continue;
        const m = porMov.get(a.movimentacao_id);
        if (!m || m.tipo !== 'saida') continue;
        if (!acum.has(a.vinculo_id)) acum.set(a.vinculo_id, new Map());
        const meses = acum.get(a.vinculo_id);
        meses.set(a.mes_ref, (meses.get(a.mes_ref) || 0) + (Number(a.valor) || 0));
    }
    return (despesas || []).map(d => {
        const meses = acum.get(d.id) || new Map();
        const valores = [...meses.values()].filter(v => Math.abs(v) > 0.004);
        const total = valores.reduce((s, v) => s + v, 0);
        return {
            id: d.id, nome: d.nome, previsao: Number(d.valor) || 0,
            porMes: meses, meses: valores.length, total,
            media: valores.length ? total / valores.length : 0,
            tipico: mediana(valores),
            ultimoMes: [...meses.keys()].sort().pop() || null
        };
    });
}

/** Quantos meses distintos o extrato cobre — o denominador de "3 de 8 meses". */
export function mesesObservados(movs = []) {
    return new Set((movs || []).filter(m => m.tipo === 'saida')
        .map(m => String(m.data || '').slice(0, 7)).filter(Boolean)).size;
}

/**
 * As despesas que ainda não têm previsão mas já têm histórico.
 *
 * São as que a adoção em lote resolve de uma vez: o catálogo entra na
 * previsão com o número que o próprio extrato mostrou, em vez de zero.
 */
export function semPrevisaoComHistorico(realizado = []) {
    return realizado.filter(r => r.previsao <= 0.004 && r.tipico > 0.004);
}

// ---------------------------------------------------------------------------
// Colar a previsão da planilha
// ---------------------------------------------------------------------------

/**
 * Lê «NOME <tab> VALOR» colado da planilha, casando pelo nome do catálogo.
 *
 * Aceita a coluna do dia no meio (é assim que a planilha da clínica é: dia,
 * nome, previsto), e ignora as linhas que não casam com nenhuma categoria —
 * elas voltam em `semCasar` para a tela poder dizer o que ficou de fora, em
 * vez de criar despesa nova por engano de digitação.
 */
export function lerPrevisoes(texto, despesas = []) {
    const porNome = new Map((despesas || []).map(d => [normalizaChave(d.nome).trim(), d]));
    const casadas = [], semCasar = [];
    for (const linha of String(texto || '').split('\n')) {
        if (!linha.trim()) continue;
        const cels = linha.split('\t').map(c => c.trim());
        // o nome é a primeira célula que casa com o catálogo; o valor, o
        // primeiro número que vier depois dela
        let iNome = -1, despesa = null;
        for (let i = 0; i < cels.length; i++) {
            const d = porNome.get(normalizaChave(cels[i]).trim());
            if (d) { iNome = i; despesa = d; break; }
        }
        if (!despesa) {
            const rotulo = cels.find(c => c && dinheiro(c) == null);
            if (rotulo) semCasar.push(rotulo);
            continue;
        }
        let valor = null;
        for (let i = iNome + 1; i < cels.length; i++) {
            const v = dinheiro(cels[i]);
            if (v != null) { valor = v; break; }
        }
        if (valor == null) continue;
        casadas.push({ id: despesa.id, nome: despesa.nome, de: Number(despesa.valor) || 0, para: valor });
    }
    return { casadas, semCasar };
}
