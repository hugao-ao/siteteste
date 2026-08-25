// argos-import-financeiro.js — abas financeiras da planilha da clínica
// ====================================================================
// ENTRADAS e SAÍDAS são o extrato: uma linha por lançamento, com a data em
// que o dinheiro andou. A coluna MÊS é outra coisa — é o mês de PRODUÇÃO a
// que aquele dinheiro se refere. Um pagamento feito em maio pode quitar
// abril, e é essa associação que o sistema guarda em argos_mov_alocacoes.
//
// PagPacientes e Saídas Ref são de-para: "quem paga" → paciente, e
// "o que aparece no extrato" → categoria. É o que faz o lançamento do mês
// seguinte se classificar sozinho.
//
// DET. FINANC são as anotações financeiras do paciente, gerais ou válidas
// só em certos meses.

import { dividirTabela } from './argos-cadastro-import.js';
import { chaveNome, nomeSemSufixo, MESES_SIGLA } from './argos-import-freq.js';

const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "sexta-feira, 2 de janeiro de 2026" → "2026-01-02". */
export function dataPorExtenso(bruto) {
    const t = String(bruto || '').toLowerCase();
    const m = /(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/.exec(t);
    if (!m) return null;
    const mes = MES_LONGO.indexOf(m[2]);
    if (mes < 0) return null;
    return `${m[3]}-${String(mes + 1).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

/** "dez.-25" → "2025-12". "sm" e vazio viram null: sem mês de produção. */
export function mesDeReferencia(bruto) {
    const t = String(bruto || '').trim().toLowerCase().replace(/\./g, '');
    const m = /^([a-zç]{3})-?(\d{2,4})$/.exec(t);
    if (!m) return null;
    const mes = MES_CURTO.indexOf(m[1]);
    if (mes < 0) return null;
    const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

/** "R$ 1.234,56" → 1234.56. Vazio vira null, que não é zero. */
export function dinheiro(bruto) {
    const s = String(bruto == null ? '' : bruto).trim();
    if (!s) return null;
    const neg = s.startsWith('-') || /^\(.*\)$/.test(s);
    const n = Number(s.replace(/[R$\s().-]/g, '').replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return neg ? -n : n;
}

/** Categorias que são repasse a profissional, não despesa da clínica. */
export const RE_REPASSE = /^REPASSE\s+(.+)$/i;

/** Marcador de erro que a própria planilha usa. */
export const CATEGORIA_ERRO = /^-+ERRO-+$/;

const cabecalho = (linha, nomes) => {
    const idx = {};
    linha.forEach((c, i) => {
        const t = String(c || '').trim().toUpperCase();
        if (nomes.includes(t) && idx[t] === undefined) idx[t] = i;
    });
    return idx;
};

export function pareceEntradas(texto) {
    const p = String(texto || '').split('\n')[0].toUpperCase();
    return p.includes('DATA') && p.includes('PAGADOR') && p.includes('PACIENTE');
}
export function pareceSaidas(texto) {
    const p = String(texto || '').split('\n')[0].toUpperCase();
    return p.includes('DATA') && p.includes('DESPESA') && p.includes('CATEGORIA');
}

/**
 * ENTRADAS → lançamentos de entrada com a associação ao mês de produção.
 * [{ data, valor, pagador, paciente, chave, mes_ref }]
 */
export function lerEntradas(texto) {
    const t = dividirTabela(texto);
    const avisos = [];
    if (!t.length) return { linhas: [], avisos: ['Arquivo vazio.'] };
    const idx = cabecalho(t[0], ['DATA', 'VALOR', 'PAGADOR', 'PACIENTE', 'MÊS', 'MES']);
    const cMes = idx['MÊS'] !== undefined ? idx['MÊS'] : idx.MES;
    if (idx.DATA === undefined || idx.VALOR === undefined) {
        return { linhas: [], avisos: ['Cabeçalho sem DATA e VALOR.'] };
    }
    const linhas = [];
    for (let i = 1; i < t.length; i++) {
        const l = t[i];
        const data = dataPorExtenso(l[idx.DATA]);
        const valor = dinheiro(l[idx.VALOR]);
        if (!data || valor === null) {
            if (String(l[idx.DATA] || '').trim()) avisos.push(`Linha ${i + 1}: data ou valor ilegível.`);
            continue;
        }
        const paciente = String(l[idx.PACIENTE] || '').trim();
        linhas.push({
            linha: i + 1, data, valor,
            pagador: String(l[idx.PAGADOR] || '').trim(),
            paciente: nomeSemSufixo(paciente), paciente_raw: paciente,
            chave: paciente ? chaveNome(paciente) : '',
            mes_ref: cMes === undefined ? null : mesDeReferencia(l[cMes])
        });
    }
    return { linhas, avisos };
}

/**
 * SAÍDAS → lançamentos de saída já classificados pela categoria da planilha.
 * `repasse` traz o nome do profissional quando a categoria é um repasse.
 */
export function lerSaidas(texto) {
    const t = dividirTabela(texto);
    const avisos = [];
    if (!t.length) return { linhas: [], avisos: ['Arquivo vazio.'] };
    const idx = cabecalho(t[0], ['DATA', 'VALOR', 'DESPESA', 'CATEGORIA', 'MÊS', 'MES']);
    const cMes = idx['MÊS'] !== undefined ? idx['MÊS'] : idx.MES;
    if (idx.DATA === undefined || idx.VALOR === undefined) {
        return { linhas: [], avisos: ['Cabeçalho sem DATA e VALOR.'] };
    }
    const linhas = [];
    for (let i = 1; i < t.length; i++) {
        const l = t[i];
        const data = dataPorExtenso(l[idx.DATA]);
        const valor = dinheiro(l[idx.VALOR]);
        if (!data || valor === null) {
            if (String(l[idx.DATA] || '').trim()) avisos.push(`Linha ${i + 1}: data ou valor ilegível.`);
            continue;
        }
        const categoria = String(l[idx.CATEGORIA] || '').trim();
        const rep = RE_REPASSE.exec(categoria);
        linhas.push({
            linha: i + 1, data, valor,
            despesa: String(l[idx.DESPESA] || '').trim(),
            categoria,
            erro: CATEGORIA_ERRO.test(categoria),
            repasse: rep ? rep[1].trim() : null,
            mes_sigla: cMes === undefined ? '' : String(l[cMes] || '').trim().toUpperCase()
        });
    }
    return { linhas, avisos };
}

/** PagPacientes / Saídas Ref → de-para de duas colunas. */
export function lerDePara(texto, { chaveCol = 0, valorCol = 1 } = {}) {
    const t = dividirTabela(texto);
    const linhas = [];
    for (let i = 0; i < t.length; i++) {
        const de = String(t[i][chaveCol] || '').trim();
        const para = String(t[i][valorCol] || '').trim();
        if (!de || !para) continue;
        if (i === 0 && /PAGADOR|DESPESA/i.test(de)) continue;  // cabeçalho
        linhas.push({ de, para });
    }
    return { linhas, avisos: [] };
}

/**
 * DET. FINANC → anotações financeiras do paciente.
 * A coluna MÊS lista as siglas em que a anotação vale; quando estão todas
 * as doze (ou nenhuma), a anotação é geral.
 */
export function lerDetalhesFinanceiros(texto) {
    const t = dividirTabela(texto);
    const linhas = [];
    for (let i = 1; i < t.length; i++) {
        const nome = String(t[i][0] || '').trim();
        const obs = String(t[i][1] || '').trim();
        if (!nome || !obs) continue;
        const meses = String(t[i][2] || '').split(',')
            .map(s => s.trim().toUpperCase()).filter(s => MESES_SIGLA.includes(s));
        const geral = meses.length === 0 || meses.length === 12;
        linhas.push({
            paciente: nomeSemSufixo(nome), chave: chaveNome(nome), texto: obs,
            escopo: geral ? 'geral' : 'periodo',
            meses: geral ? [] : meses.map(s => MESES_SIGLA.indexOf(s) + 1).sort((a, b) => a - b)
        });
    }
    return { linhas, avisos: [] };
}

/** Blocos contíguos de meses, para virar mes_de/mes_ate sem uma linha por mês. */
export function blocosDeMeses(meses, ano) {
    const saida = [];
    const dois = n => String(n).padStart(2, '0');
    for (const m of [...meses].sort((a, b) => a - b)) {
        const ult = saida[saida.length - 1];
        if (ult && ult.fim === m - 1) { ult.fim = m; ult.mes_ate = `${ano}-${dois(m)}`; }
        else saida.push({ ini: m, fim: m, mes_de: `${ano}-${dois(m)}`, mes_ate: `${ano}-${dois(m)}` });
    }
    return saida;
}
