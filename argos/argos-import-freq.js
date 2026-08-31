// argos-import-freq.js — leitura das abas ARGOS_FREQUENCIA
// ========================================================
// Cada LINHA da aba é um par paciente × profissional, não um paciente: o
// mesmo paciente aparece uma vez para cada profissional que o atende,
// marcado por um sufixo no nome — (HUM), (ELIS), (ANA)… Sem sufixo, é da
// Patricia.
//
// As colunas depois de HORA vêm em três blocos, achados pelo cabeçalho:
// GRUPO, INDIVIDUAL e FAMILIA. Dentro de cada bloco os campos vêm aos
// pares: dia do mês, situação. Situação é OK, Fj, F ou ?? — não existe
// "Nc" nesta planilha.
//
// Conferido contra a aba Análises Sessões: a contagem do bloco FAMILIA
// bate exatamente nos sete meses fechados, e os Pontos Ativos por
// profissional batem com o mapa de sufixos abaixo.

import { dividirTabela } from './argos-cadastro-import.js';

/** Sufixo no nome do paciente → profissional que o atende. */
export const SUFIXO_PROFISSIONAL = {
    ANA: 'Ana Paula', HUM: 'Humberto', ELIS: 'Elisangela', CLA: 'Clarissa',
    CAT: 'Catarina', BRUNO: 'Bruno', TAT: 'Tatiana'
};
/** Sufixos que não são profissional: convênio, projeto social, locação. */
export const SUFIXO_OUTROS = ['SOCIAL', 'MOVICIDADE', 'UNIMED', 'ALUGUEL', 'PM', 'PP', 'MAE'];

/** Sem sufixo de profissional, o atendimento é da dona da clínica. */
export const PROFISSIONAL_PADRAO = 'Patricia';

const TODOS = [...Object.keys(SUFIXO_PROFISSIONAL), ...SUFIXO_OUTROS];
const RE_SUFIXO = new RegExp(`\\((${TODOS.join('|')})\\)`, 'gi');

/** Situação na planilha → status da sessão no sistema. */
export const STATUS_PLANILHA = {
    OK: 'ok',    // presente, cobra
    F: 'fc',     // falta contabilizada
    FJ: 'fj',    // falta justificada, não contabiliza
    '??': '??'   // ainda não preenchida
};

/** Os que entram no faturamento do mês. */
export const COBRA = new Set(['ok', 'fc']);

export const MESES_SIGLA = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
    'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** '2ª' → 0 (segunda). A planilha não usa domingo. */
export const DIA_SEMANA = { '2ª': 1, '3ª': 2, '4ª': 3, '5ª': 4, '6ª': 5, 'SÁB': 6, 'SAB': 6 };

export const sufixos = nome =>
    [...String(nome || '').matchAll(RE_SUFIXO)].map(m => m[1].toUpperCase());

export function nomeSemSufixo(nome) {
    return String(nome || '').replace(RE_SUFIXO, ' ')
        .replace(/\s+/g, ' ').trim().replace(/[\s\-.]+$/, '');
}

export function chaveNome(nome) {
    return nomeSemSufixo(nome).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function profissionalDe(nome) {
    for (const s of sufixos(nome)) {
        if (SUFIXO_PROFISSIONAL[s]) return SUFIXO_PROFISSIONAL[s];
    }
    return PROFISSIONAL_PADRAO;
}

/** "09'10"" → "09:10". A planilha escreve a hora com minuto entre aspas. */
export function horaDaPlanilha(bruto) {
    const m = /^(\d{1,2})['h:](\d{2})/.exec(String(bruto || '').trim());
    return m ? `${String(Number(m[1])).padStart(2, '0')}:${m[2]}` : '';
}

/** Sigla do mês achada no nome do arquivo. Volta null se não achar. */
export function mesDoArquivo(nome) {
    const m = /(?:^|[^A-Z])(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)(?:[^A-Z]|$)/i
        .exec(String(nome || '').toUpperCase());
    return m ? MESES_SIGLA.indexOf(m[1].toUpperCase()) + 1 : null;
}

/** Reconhece a aba pelo cabeçalho, para o arquivo poder ter qualquer nome. */
export function pareceFrequencia(texto) {
    const primeira = String(texto || '').split('\n')[0].toUpperCase();
    return primeira.includes('SITUAÇÃO') && primeira.includes('HORA')
        && primeira.includes('GRUPO') && primeira.includes('INDIVIDUAL');
}

/**
 * Lê uma aba de frequência.
 *
 * ano/mes dizem a que mês o arquivo se refere — sem eles não dá para
 * transformar "06" num dia de calendário.
 *
 * Devolve { linhas, avisos }, onde cada linha é um par paciente ×
 * profissional com as sessões do mês já datadas.
 */
export function lerFrequencia(texto, { ano, mes } = {}) {
    const tabela = dividirTabela(texto);
    const avisos = [];
    if (!tabela.length) return { linhas: [], avisos: ['Arquivo vazio.'] };
    if (!ano || !mes) return { linhas: [], avisos: ['Não sei de que mês é este arquivo.'] };

    const cab = tabela[0].map(c => String(c || '').trim().toUpperCase());
    const blocos = [];
    cab.forEach((c, i) => {
        if (c.startsWith('GRUPO')) blocos.push({ bloco: 'grupo', ini: i });
        else if (c.startsWith('INDIVIDUAL')) blocos.push({ bloco: 'individual', ini: i });
        else if (c.startsWith('FAMILIA') || c.startsWith('FAMÍLIA')) blocos.push({ bloco: 'familia', ini: i });
    });
    if (!blocos.length) return { linhas: [], avisos: ['Cabeçalho sem os blocos GRUPO/INDIVIDUAL/FAMILIA.'] };
    blocos.forEach((b, i) => { b.fim = i + 1 < blocos.length ? blocos[i + 1].ini : cab.length; });

    const linhas = [];
    let secao = (tabela[0][1] || PROFISSIONAL_PADRAO).trim();
    for (let i = 1; i < tabela.length; i++) {
        const l = tabela[i];
        const bruto = String(l[1] || '').trim();
        if (!bruto) continue;
        // a aba tem uma segunda seção ("OUTROS") com o mesmo cabeçalho
        if (String(l[2] || '').trim().toUpperCase() === 'SITUAÇÃO') { secao = bruto; continue; }

        const hora = horaDaPlanilha(l[4]);
        const sessoes = [];
        for (const { bloco, ini, fim } of blocos) {
            for (let j = ini; j + 1 < Math.min(fim, l.length); j += 2) {
                const dia = String(l[j] || '').trim();
                const sit = String(l[j + 1] || '').trim();
                if (!dia || !sit) continue;
                const n = Number(dia);
                if (!Number.isInteger(n) || n < 1 || n > 31) {
                    avisos.push(`Linha ${i + 1} (${bruto}): dia "${dia}" ignorado.`);
                    continue;
                }
                const status = STATUS_PLANILHA[sit.toUpperCase()];
                if (!status) {
                    avisos.push(`Linha ${i + 1} (${bruto}): situação "${sit}" desconhecida.`);
                    continue;
                }
                sessoes.push({ dia: n, bloco, status,
                    data: `${ano}-${String(mes).padStart(2, '0')}-${String(n).padStart(2, '0')}` });
            }
        }
        sessoes.sort((a, b) => a.dia - b.dia
            || ['grupo', 'individual', 'familia'].indexOf(a.bloco)
             - ['grupo', 'individual', 'familia'].indexOf(b.bloco));

        linhas.push({
            linha: i + 1, ano, mes, secao,
            paciente_raw: bruto, paciente: nomeSemSufixo(bruto), chave: chaveNome(bruto),
            profissional: profissionalDe(bruto), sufixos: sufixos(bruto),
            situacao: String(l[2] || '').trim(),
            dia_semana: String(l[3] || '').trim(), dow: DIA_SEMANA[String(l[3] || '').trim()],
            hora, sessoes
        });
    }
    return { linhas, avisos };
}

/**
 * Duas sessões no mesmo dia existem de verdade (dois atendimentos), mas
 * não podem ficar no mesmo horário. A segunda em diante é empurrada uma
 * hora para a frente — o horário exato é irrelevante para o faturamento,
 * o que importa é a sessão existir.
 */
export function desempatarHorarios(sessoes, horaBase) {
    const usados = new Map();
    return sessoes.map(s => {
        const n = usados.get(s.data) || 0;
        usados.set(s.data, n + 1);
        return { ...s, hora: somarHoras(horaBase || '09:00', n) };
    });
}

export function somarHoras(hora, horas) {
    const [h, m] = String(hora || '09:00').split(':').map(Number);
    const t = (h + (horas || 0)) % 24;
    return `${String(t).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}
