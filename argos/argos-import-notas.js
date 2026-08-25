// argos-import-notas.js — a aba NOTAS, mês a mês
// ==============================================
// Para cada paciente e cada mês a planilha guarda seis colunas: a situação
// da nota, o valor VIVO do fechamento, o valor CONGELADO na hora em que a
// nota foi emitida, os dias atendidos, a descrição e o número da nota.
//
// Os dois valores são a peça central: enquanto batem, a nota está de pé;
// quando divergem, alguma coisa mudou na frequência depois da emissão e a
// nota precisa ser refeita. É exatamente o retrato que o sistema guarda em
// argos_notas_fiscais e a divergência que abre pendência.

import { dividirTabela } from './argos-cadastro-import.js';
import { chaveNome, nomeSemSufixo, MESES_SIGLA } from './argos-import-freq.js';
import { dinheiro } from './argos-import-financeiro.js';

/** Situação na planilha → regime de nota do sistema. */
export const REGIME_NOTA = {
    'NORMAL': 'normal',
    'ESPECIAL': 'especial',
    'NÃO': 'nao', 'NAO': 'nao',
    'INDEFINIDO': 'indefinido',
    'ALUGUEL': 'nao'      // locação de sala não recebe nota de atendimento
};

export const COLUNAS_POR_MES = 6;
export const PRIMEIRA_COLUNA_MES = 3;

export function pareceNotas(texto) {
    const p = String(texto || '').split('\n')[0].toUpperCase();
    return p.includes('CLIENTE') && p.includes('SIT NOTA') && p.includes('VAL NOTA');
}

/** "2 - 9 - 16" → [2, 9, 16]. */
export function diasDaNota(bruto) {
    return String(bruto || '').split(/[-,;]/)
        .map(s => Number(String(s).trim()))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 31);
}

/**
 * Lê a aba NOTAS.
 * Devolve [{ paciente, chave, rf, rf_cpf, meses: { 1: {...}, … } }], onde
 * cada mês traz regime, valor vivo, valor da nota, dias, descrição e número.
 */
export function lerNotas(texto) {
    const t = dividirTabela(texto);
    const avisos = [];
    if (!t.length) return { linhas: [], avisos: ['Arquivo vazio.'] };

    const linhas = [];
    for (let i = 1; i < t.length; i++) {
        const l = t[i];
        const bruto = String(l[0] || '').trim();
        if (!bruto) continue;
        const meses = {};
        for (let m = 1; m <= 12; m++) {
            const c = PRIMEIRA_COLUNA_MES + (m - 1) * COLUNAS_POR_MES;
            const sit = String(l[c] || '').trim().toUpperCase();
            const regime = REGIME_NOTA[sit];
            if (sit && !regime) avisos.push(`Linha ${i + 1} (${bruto}): situação de nota "${sit}" desconhecida.`);
            const valor = dinheiro(l[c + 1]);
            const valorNota = dinheiro(l[c + 2]);
            const dias = diasDaNota(l[c + 3]);
            const descricao = String(l[c + 4] || '').trim();
            const numero = String(l[c + 5] || '').trim();
            if (!sit && valor === null && !numero && !descricao) continue;
            meses[m] = {
                mes: `${m}`.padStart(2, '0'), regime: regime || null, situacao_planilha: sit,
                valor, valor_nota: valorNota, dias, descricao, numero,
                // enquanto os dois valores batem a nota está de pé
                divergente: valor !== null && valorNota !== null
                    && Math.abs(valor - valorNota) > 0.005
            };
        }
        linhas.push({
            linha: i + 1, paciente_raw: bruto, paciente: nomeSemSufixo(bruto),
            chave: chaveNome(bruto), rf_cpf: String(l[1] || '').trim(),
            rf: String(l[2] || '').trim(), meses
        });
    }
    return { linhas, avisos };
}

/** Regime que vale num mês, caindo para o mês anterior quando em branco. */
export function regimeNoMes(linha, mes) {
    for (let m = mes; m >= 1; m--) {
        const r = linha.meses[m];
        if (r && r.regime) return r.regime;
    }
    return 'indefinido';
}

/** Meses em que o regime muda — viram exceção em argos_nota_mes. */
export function mudancasDeRegime(linha) {
    const saida = [];
    let anterior = null;
    for (let m = 1; m <= 12; m++) {
        const r = linha.meses[m];
        if (!r || !r.regime) continue;
        if (anterior !== null && r.regime !== anterior) saida.push({ mes: m, de: anterior, para: r.regime });
        anterior = r.regime;
    }
    return saida;
}

export { MESES_SIGLA };
