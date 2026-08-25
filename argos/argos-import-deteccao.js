// argos-import-deteccao.js — que aba é cada arquivo
// =================================================
// O reconhecimento é pelo CABEÇALHO, não pelo nome do arquivo: o download do
// Google Sheets sai com nomes longos que às vezes são renomeados, e o
// conteúdo é o que não mente. O nome só serve para descobrir o mês das abas
// de frequência, que são doze arquivos iguais.

import { pareceFrequencia, mesDoArquivo, MESES_SIGLA } from './argos-import-freq.js';
import { pareceEntradas, pareceSaidas } from './argos-import-financeiro.js';
import { pareceNotas } from './argos-import-notas.js';

export const TIPOS = {
    frequencia:  { rotulo: 'Frequência do mês', icone: '🗓️', ordem: 3 },
    cadastro:    { rotulo: 'Cadastro, acordos e notas', icone: '🧑‍⚕️', ordem: 1 },
    geral:       { rotulo: 'Geral (contatos e fechamento)', icone: '📇', ordem: 0 },
    notas:       { rotulo: 'Notas fiscais', icone: '📄', ordem: 4 },
    entradas:    { rotulo: 'Entradas financeiras', icone: '💵', ordem: 5 },
    saidas:      { rotulo: 'Saídas financeiras', icone: '💸', ordem: 6 },
    pagpacientes:{ rotulo: 'De-para pagador → paciente', icone: '🔁', ordem: 2 },
    saidasref:   { rotulo: 'De-para despesa → categoria', icone: '🔁', ordem: 2 },
    detfinanc:   { rotulo: 'Detalhes financeiros', icone: '📝', ordem: 7 },
    planejamento:{ rotulo: 'Planejamento anual', icone: '📊', ordem: 8 },
    derivada:    { rotulo: 'Aba calculada — o site refaz esta conta', icone: '🧮', ordem: 98 },
    desconhecido:{ rotulo: 'Não reconhecida', icone: '❓', ordem: 99 }
};

/**
 * Abas que não são fonte de dado: são resumos que a própria planilha
 * calcula a partir das outras. Não têm o que importar — o site refaz a
 * conta a partir da frequência e dos lançamentos, e passa a ser ele a
 * manter o número em dia.
 */
export const DERIVADAS = [
    { re: /^MÊS\s*,\s*PATRICIA/i,      nome: 'Pontos Ativos' },
    { re: /^PROFISSINAL\s*,\s*JANEIRO/i, nome: 'Controle de Repasses' },
    { re: /PONTOS ATIVOS/i,             nome: 'Análises de Sessões' },
    { re: /PUXAR DO MÊS/i,              nome: 'Acertos Financeiros' },
    { re: /PLANILHA MORTA/i,            nome: 'Fichas de cobrança do WhatsApp' },
    { re: /RESULTADO [A-Z]{3}\/\d{2}/i, nome: 'Extratos' }
];

const primeiraLinha = t => String(t || '').split('\n')[0].toUpperCase();

/** Devolve { tipo, mes } — mes só faz sentido para as abas de frequência. */
export function detectar(nomeArquivo, texto) {
    const p = primeiraLinha(texto);
    const inicio = String(texto || '').slice(0, 2000);
    for (const d of DERIVADAS) {
        if (d.re.test(p) || d.re.test(inicio)) return { tipo: 'derivada', aba: d.nome };
    }

    if (pareceFrequencia(texto)) {
        return { tipo: 'frequencia', mes: mesDoArquivo(nomeArquivo) };
    }
    if (pareceNotas(texto)) return { tipo: 'notas' };
    if (pareceEntradas(texto)) return { tipo: 'entradas' };
    if (pareceSaidas(texto)) return { tipo: 'saidas' };

    // CADASTRO e GERAL compartilham colunas; o que separa é o PACIENTE do
    // cadastro vir com Profissional e Repasse ao lado
    if (p.includes('PACIENTE') && p.includes('PROFISSIONAL') && p.includes('REPASSE')) {
        return { tipo: 'cadastro' };
    }
    if (p.includes('PACIENTE') && p.includes('CONTATO') && p.includes('WHATSAPP')) {
        return { tipo: 'geral' };
    }
    if (/^PAGADOR\s*,\s*PACIENTE/.test(p.replace(/"/g, ''))) return { tipo: 'pagpacientes' };
    if (p.includes('OBSERVAÇÕES ATUAIS')) return { tipo: 'detfinanc' };
    if (p.includes('DESPESAS') || texto.toUpperCase().includes('ENTRADAS ESTIMADAS PARA O')) {
        return { tipo: 'planejamento' };
    }
    // Saídas Ref não tem cabeçalho: são duas colunas de texto, a segunda
    // repetindo categorias que também aparecem na aba de saídas
    const linhas = String(texto || '').split('\n').filter(Boolean);
    if (linhas.length > 5 && linhas.every(l => l.split(',').length <= 4)) {
        return { tipo: 'saidasref' };
    }
    return { tipo: 'desconhecido' };
}

/** Ordem de carga: o que depende de outra coisa entra depois. */
export const ordenarParaCarga = arquivos =>
    [...arquivos].sort((a, b) =>
        (TIPOS[a.tipo]?.ordem ?? 99) - (TIPOS[b.tipo]?.ordem ?? 99)
        || (a.mes || 0) - (b.mes || 0));

/** O que ainda falta para a carga fazer sentido. */
export function faltando(arquivos) {
    const tem = t => arquivos.some(a => a.tipo === t);
    const avisos = [];
    if (!tem('geral') && !tem('cadastro')) {
        avisos.push('Sem a aba GERAL ou CADASTRO não dá para saber quem são os pacientes.');
    }
    const meses = arquivos.filter(a => a.tipo === 'frequencia').map(a => a.mes).filter(Boolean);
    if (arquivos.some(a => a.tipo === 'frequencia' && !a.mes)) {
        avisos.push('Uma aba de frequência não diz de que mês é — renomeie o arquivo com a sigla do mês (JAN, FEV…).');
    }
    if (meses.length) {
        const faltam = MESES_SIGLA.filter((_, i) => !meses.includes(i + 1)).slice(0, 12);
        if (faltam.length && faltam.length < 12) {
            avisos.push(`Frequência ausente de: ${faltam.join(', ')} — esses meses ficam sem sessão.`);
        }
    }
    return avisos;
}
