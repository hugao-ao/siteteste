// argos-cadastro-import.js — leitura da aba CADASTRO da planilha da clínica
// =========================================================================
// A aba tem 12 colunas fixas + 12 blocos de 3 (MES / MESF / MESS): regime de
// nota, valor fixo do mês e valor por sessão do mês — nunca os dois ao mesmo
// tempo. Cada LINHA é um par paciente × profissional, não um paciente: o
// mesmo paciente aparece várias vezes, marcado por sufixos no nome.

/** Sufixos que aparecem no nome do paciente e o que cada um significa. */
export const TAG_PROFISSIONAL = {
    ANA: 'Ana Paula', HUM: 'Humberto', ELIS: 'Elisangela', CLA: 'Clarissa',
    CAT: 'Catarina', BRUNO: 'Bruno', TAT: 'Tatiana'
};
export const TAG_OUTRAS = ['SOCIAL', 'MOVICIDADE', 'UNIMED', 'ALUGUEL', 'PM', 'PP', 'MAE'];
const TODAS_TAGS = [...Object.keys(TAG_PROFISSIONAL), ...TAG_OUTRAS];
const RE_TAG = new RegExp(`\\((${TODAS_TAGS.join('|')})\\)`, 'gi');

export const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Marcadores de "não sei" usados na planilha. */
const VAZIOS = new Set(['', '?????', '-', '—']);

/**
 * Divide texto colado (TSV do Google Sheets ou CSV) respeitando aspas —
 * células com quebra de linha ou tabulação dentro vêm entre aspas.
 */
export function dividirTabela(texto) {
    const t = String(texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const primeira = t.slice(0, t.indexOf('\n') === -1 ? t.length : t.indexOf('\n'));
    const sep = primeira.includes('\t') ? '\t' : ',';
    const linhas = [];
    let campo = '', linha = [], aspas = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (aspas) {
            if (c === '"') {
                if (t[i + 1] === '"') { campo += '"'; i++; }
                else aspas = false;
            } else campo += c;
        } else if (c === '"') {
            aspas = true;
        } else if (c === sep) {
            linha.push(campo); campo = '';
        } else if (c === '\n') {
            linha.push(campo); linhas.push(linha); linha = []; campo = '';
        } else campo += c;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(l => l.length > 1 || (l[0] || '').trim());
}

const limpar = v => {
    const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    return VAZIOS.has(s) ? '' : s;
};

/** Nome do paciente sem os sufixos, com espaços e pontuação solta aparados. */
export function nomeLimpo(bruto) {
    return String(bruto || '').replace(RE_TAG, ' ').replace(/\s+/g, ' ').trim().replace(/[\s\-.]+$/, '');
}

/** Chave de comparação: sem acento, sem pontuação, maiúscula. */
export function chaveNome(nome) {
    return nomeLimpo(nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function tagsDe(bruto) {
    return [...String(bruto || '').matchAll(RE_TAG)].map(m => m[1].toUpperCase());
}

/** "R$ 1.300,00" → 1300 ; célula vazia → null (vazio ≠ zero). */
export function moeda(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    const n = Number(s.replace(/[R$\s.]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

/** "70,00%" → 70 */
export function percentual(v) {
    const s = String(v == null ? '' : v).replace('%', '').replace(',', '.').trim();
    const n = Number(s);
    return Number.isFinite(n) && s !== '' ? n : null;
}

/** "13/09/2024" → "2024-09-13"; qualquer outra coisa → null. */
export function dataBR(v) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Comprime os 12 meses em blocos contíguos de mesmo acordo.
 * tipo: 'fixo' | 'sessao' | 'zero' (cobrança zerada) | null (célula em branco).
 */
export function blocosDeAcordo(linha) {
    const blocos = [];
    for (const m of MESES) {
        const f = moeda(linha[m + 'F']);
        const s = moeda(linha[m + 'S']);
        let tipo = null, valor = null;
        if (f === null && s === null) { tipo = null; valor = null; }
        else if ((f || 0) > 0) { tipo = 'fixo'; valor = f; }
        else if ((s || 0) > 0) { tipo = 'sessao'; valor = s; }
        else { tipo = 'zero'; valor = 0; }
        const ult = blocos[blocos.length - 1];
        if (ult && ult.tipo === tipo && ult.valor === valor) ult.ate = m;
        else blocos.push({ de: m, ate: m, tipo, valor });
    }
    return blocos;
}

/** Mesma compressão para o regime de nota. */
export function blocosDeNota(linha) {
    const blocos = [];
    for (const m of MESES) {
        const v = String(linha[m] || '').trim();
        const ult = blocos[blocos.length - 1];
        if (ult && ult.valor === v) ult.ate = m;
        else blocos.push({ de: m, ate: m, valor: v });
    }
    return blocos;
}

/**
 * Lê o texto colado e devolve { linhas, pacientes, avisos }.
 * `linhas` = uma por par paciente × profissional (só as que têm PACIENTE).
 * `pacientes` = consolidado por nome, pronto para virar cadastro.
 */
export function lerCadastro(texto) {
    const tabela = dividirTabela(texto);
    const avisos = [];
    if (!tabela.length) return { linhas: [], pacientes: [], avisos: ['Nada para ler.'], descartadas: 0 };

    const cab = tabela[0].map(c => String(c || '').trim());
    const idx = {};
    cab.forEach((c, i) => { if (c && idx[c] === undefined) idx[c] = i; });
    const faltando = ['PACIENTE', 'Profissional', 'Repasse', 'inicio']
        .filter(c => idx[c] === undefined);
    if (faltando.length) {
        return { linhas: [], pacientes: [], descartadas: 0,
            avisos: [`Cabeçalho não reconhecido — faltam as colunas: ${faltando.join(', ')}. Cole a aba inteira, com a linha de títulos.`] };
    }
    const pega = (arr, c) => idx[c] === undefined ? '' : (arr[idx[c]] || '');

    const linhas = [];
    let descartadas = 0;
    for (let i = 1; i < tabela.length; i++) {
        const bruta = tabela[i];
        const pacienteRaw = String(pega(bruta, 'PACIENTE') || '').trim();
        if (!pacienteRaw) { descartadas++; continue; }   // sobra de arrasto de fórmula
        const reg = {};
        for (const c of cab) if (c) reg[c] = pega(bruta, c);
        const iniRaw = String(pega(bruta, 'inicio') || '').trim();
        const data = dataBR(iniRaw);
        const tags = tagsDe(pacienteRaw);
        linhas.push({
            linha: i + 1,
            paciente_raw: pacienteRaw,
            paciente_nome: nomeLimpo(pacienteRaw),
            paciente_chave: chaveNome(pacienteRaw),
            tags,
            aluguel: tags.includes('ALUGUEL'),
            profissional: String(pega(bruta, 'Profissional') || '').trim(),
            repasse: percentual(pega(bruta, 'Repasse')),
            inicio_raw: iniRaw,
            inicio_data: data,
            situacao: data ? 'ativo' : (iniRaw || 'sem_info'),
            cpf_rf: limpar(pega(bruta, 'CPF')),
            rf: limpar(pega(bruta, 'RF')),
            contato: limpar(pega(bruta, 'CONTATO')),
            whatsapp: limpar(pega(bruta, 'WHATSAPP')),
            cpf_pac: limpar(pega(bruta, 'CPF PAC')),
            email: limpar(pega(bruta, 'EMAIL')),
            pasta_url: limpar(pega(bruta, 'Link Pasta')),
            acordos: blocosDeAcordo(reg),
            notas: blocosDeNota(reg)
        });
    }

    // consolida por paciente: primeiro valor não vazio de cada campo
    const mapa = new Map();
    for (const l of linhas) {
        if (l.aluguel) continue;                       // locação de sala não é paciente
        let p = mapa.get(l.paciente_chave);
        if (!p) {
            p = { chave: l.paciente_chave, nome: l.paciente_nome, cpf: '', email: '', telefone: '',
                contato: '', responsavel_financeiro: '', rf_cpf: '', pasta_url: '',
                situacoes: [], profissionais: [], linhas: 0 };
            mapa.set(l.paciente_chave, p);
        }
        p.linhas++;
        if (l.paciente_nome.length > p.nome.length) p.nome = l.paciente_nome;
        if (!p.cpf) p.cpf = l.cpf_pac;
        if (!p.email) p.email = l.email;
        if (!p.telefone) p.telefone = l.whatsapp;
        if (!p.contato) p.contato = l.contato;
        if (!p.responsavel_financeiro) p.responsavel_financeiro = l.rf;
        if (!p.rf_cpf) p.rf_cpf = l.cpf_rf;
        if (!p.pasta_url) p.pasta_url = l.pasta_url;
        p.situacoes.push(l.situacao);
        if (l.profissional && !p.profissionais.includes(l.profissional)) p.profissionais.push(l.profissional);
    }
    const pacientes = [...mapa.values()].map(p => ({
        ...p,
        // inativo em TODAS as linhas → entra desmarcado; basta uma linha viva para ficar ativo
        ativo: !p.situacoes.every(s => s === 'inativo')
    })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const alugueis = linhas.filter(l => l.aluguel);
    if (alugueis.length) {
        avisos.push(`${alugueis.length} linha(s) marcada(s) (ALUGUEL) — locação de sala, não viram paciente: ${alugueis.map(l => l.paciente_nome).join(', ')}.`);
    }
    const semProf = linhas.filter(l => !l.profissional).length;
    if (semProf) avisos.push(`${semProf} linha(s) sem profissional.`);
    if (descartadas) avisos.push(`${descartadas} linha(s) sem nome de paciente foram descartadas (sobra de arrasto da planilha).`);

    return { linhas, pacientes, avisos, descartadas };
}
