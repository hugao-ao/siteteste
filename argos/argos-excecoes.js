// argos-excecoes.js — Exceções de cobrança e de nota fiscal
// ==========================================================
// O acordo com o paciente é uma coisa; o que o plano de saúde aceita ver na
// nota é outra. Uma sessão de R$ 180 pode precisar sair como duas de R$ 90;
// um acordo de R$ 200 por sessão pode só poder mandar linhas de R$ 100, e aí
// cada atendimento vira dois, em dias diferentes. Uma criança com pai e mãe
// separados recebe dois fechamentos e duas notas, metade para cada.
//
// Nada disso muda o quanto a clínica recebe — muda como o mês é ESCRITO. Por
// isso a regra de ouro deste arquivo: o total sempre se conserva. Desdobrar
// não cria dinheiro, ratear não perde centavo.
//
// Cada exceção vale por um tempo: só um mês, de um mês a outro, ou dali em
// diante (o novo normal). É comum a mesma clínica ter as três coisas ao mesmo
// tempo em pacientes diferentes.

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

export const TIPOS_EXCECAO = [
    { valor: 'desdobrar', rotulo: '✂️ Desdobrar sessões na nota',
      desc: 'A nota mostra mais sessões, de valor menor, somando o mesmo total.' },
    { valor: 'rateio', rotulo: '👥 Dividir entre responsáveis',
      desc: 'O mês vira um fechamento e uma nota para cada responsável.' }
];

export const ESCOPOS_EXCECAO = [
    { valor: 'mes', rotulo: '📌 Só neste mês',
      desc: 'Pontual: vale para um mês e acabou.' },
    { valor: 'periodo', rotulo: '📆 De um mês a outro',
      desc: 'Temporário: vale no intervalo e depois volta ao normal.' },
    { valor: 'sempre', rotulo: '♾️ O novo normal',
      desc: 'Passa a valer daquele mês em diante, sem data para acabar.' }
];

/** Como as linhas extras do desdobramento ganham data. */
export const DATAS_DESDOBRAMENTO = [
    { valor: 'mesma', rotulo: 'No mesmo dia',
      desc: 'Duas sessões de R$ 90 no mesmo dia do atendimento.' },
    { valor: 'extra', rotulo: 'Em outro dia da semana',
      desc: 'Cada atendimento leva junto um outro dia da mesma semana.' }
];

/** Situações que a nota conta como sessão prestada. */
const CONTA = new Set(['ok', 'fc', '??']);

const rotuloDe = (lista, v) => (lista.find(x => x.valor === v) || {}).rotulo || v;
export const rotuloTipo = v => rotuloDe(TIPOS_EXCECAO, v);
export const rotuloEscopo = v => rotuloDe(ESCOPOS_EXCECAO, v);

// ---------------------------------------------------------------------------
// Vigência
// ---------------------------------------------------------------------------

/** A exceção vale neste mês ('YYYY-MM')? */
export function vigenteNoMes(e, mes) {
    if (!e || e.ativo === false || !mes) return false;
    const de = e.mes_de || '';
    const ate = e.mes_ate || '';
    if (e.escopo === 'mes') return de === mes;
    if (e.escopo === 'periodo') return (!de || mes >= de) && (!ate || mes <= ate);
    return !de || mes >= de; // 'sempre'
}

// Quanto mais estreita a vigência, mais ela manda: um ajuste feito para
// ESTE mês existe justamente para sobrepor o combinado permanente.
const PESO = { mes: 3, periodo: 2, sempre: 1 };

/**
 * A exceção que vale para o paciente naquele mês, por tipo.
 * Devolve { desdobrar, rateio } — cada uma podendo ser null.
 */
export function excecoesVigentes(lista, pacienteId, mes) {
    const escolhida = {};
    for (const e of lista || []) {
        if (pacienteId && e.paciente_id !== pacienteId) continue;
        if (!vigenteNoMes(e, mes)) continue;
        const atual = escolhida[e.tipo];
        if (!atual || PESO[e.escopo] > PESO[atual.escopo]
            || (PESO[e.escopo] === PESO[atual.escopo]
                && String(e.created_at || '') > String(atual.created_at || ''))) {
            escolhida[e.tipo] = e;
        }
    }
    return { desdobrar: escolhida.desdobrar || null, rateio: escolhida.rateio || null };
}

/** Texto curto da vigência, para listar na tela. */
export function vigenciaTexto(e) {
    if (!e) return '';
    const mesBR = m => {
        const [a, x] = String(m || '').split('-');
        return a && x ? `${x}/${a}` : '';
    };
    if (e.escopo === 'mes') return `só em ${mesBR(e.mes_de)}`;
    if (e.escopo === 'periodo') {
        return e.mes_ate ? `de ${mesBR(e.mes_de)} a ${mesBR(e.mes_ate)}`
                         : `de ${mesBR(e.mes_de)} em diante`;
    }
    return e.mes_de ? `de ${mesBR(e.mes_de)} em diante (novo normal)` : 'sempre';
}

// ---------------------------------------------------------------------------
// Desdobramento
// ---------------------------------------------------------------------------

const somaDias = (iso, n) => {
    const [a, m, d] = String(iso).split('-').map(Number);
    const dt = new Date(a, m - 1, d, 12);
    dt.setDate(dt.getDate() + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const centavos = v => Math.round((Number(v) || 0) * 100);

/**
 * Desdobra as sessões cobradas em linhas de valor menor.
 *
 * frequencia — [{ dia, data, status }] como frequenciaDoFechamento devolve
 * acordo     — { tipo: 'sessao'|'fixo', valor } o acordo REAL do mês
 * total      — o valor fechado do mês (manda sobre tudo: é o que se conserva)
 * params     — { valor_linha, datas: 'mesma'|'extra', deslocamento_dias }
 *
 * Devolve { linhas, dias, sessoes, acordo, avisos } — pronto para alimentar
 * a mesma descricaoNota de sempre, sem que ela precise saber de nada disto.
 */
export function desdobrar({ frequencia = [], acordo = {}, total = 0, params = {} } = {}) {
    const avisos = [];
    const vLinha = Number(params.valor_linha) || 0;
    const cobradas = (frequencia || []).filter(f => CONTA.has(f.status));

    if (vLinha <= 0) {
        avisos.push('Sem valor por linha definido: a nota sai como sempre.');
        return { linhas: [], dias: [], sessoes: 0, acordo, avisos, aplicou: false };
    }

    const totalCent = centavos(total);
    if (totalCent % centavos(vLinha) !== 0) {
        avisos.push(`O total do mês (${moeda(total)}) não é múltiplo de ${moeda(vLinha)}: `
            + 'a última linha ficaria quebrada. Confira o valor por linha.');
    }

    // Quantas linhas cada atendimento vira. Com acordo por sessão é o valor
    // da sessão dividido pelo da linha; com acordo fixo, o mês inteiro é
    // dividido e as linhas se espalham pelos dias atendidos.
    const porSessao = acordo.tipo !== 'fixo' && Number(acordo.valor) > 0
        ? Math.max(1, Math.round(centavos(acordo.valor) / centavos(vLinha)))
        : 0;

    const linhas = [];
    if (porSessao) {
        for (const f of cobradas) {
            for (let k = 0; k < porSessao; k++) linhas.push({ data: dataDaLinha(f, k, params), valor: vLinha });
        }
    } else {
        // acordo fixo (ou sem valor por sessão): reparte o total do mês em
        // linhas inteiras, distribuídas pelos dias em que houve atendimento
        const n = Math.max(1, Math.round(totalCent / centavos(vLinha)));
        const base = cobradas.length ? cobradas : [{ data: null, dia: null }];
        for (let i = 0; i < n; i++) {
            const f = base[i % base.length];
            const volta = Math.floor(i / base.length);
            linhas.push({ data: dataDaLinha(f, volta, params), valor: vLinha });
        }
    }

    if (!linhas.length) {
        return { linhas: [], dias: [], sessoes: 0, acordo, avisos, aplicou: false };
    }

    const somaCent = linhas.reduce((s, l) => s + centavos(l.valor), 0);
    if (totalCent && somaCent !== totalCent) {
        avisos.push(`As linhas somam ${moeda(somaCent / 100)}, mas o mês fechou em ${moeda(total)}.`);
    }

    return {
        linhas, aplicou: true, avisos,
        dias: linhas.map(l => l.dia ?? Number(String(l.data || '').slice(8, 10))).filter(Boolean),
        sessoes: linhas.length,
        acordo: { tipo: 'sessao', valor: vLinha }
    };
}

/**
 * A data de cada linha. A primeira é o próprio atendimento; as seguintes
 * ganham dias a mais na mesma semana, ou repetem o dia, conforme combinado.
 */
function dataDaLinha(f, k, params) {
    if (!f || !f.data) return null;
    if (!k || params.datas !== 'extra') return f.data;
    const passo = Number(params.deslocamento_dias) || 2;
    return somaDias(f.data, passo * k);
}

const moeda = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------------------------------------------------------------------------
// Rateio entre responsáveis
// ---------------------------------------------------------------------------

/**
 * Divide o valor do mês entre os responsáveis.
 *
 * partes — [{ nome, contato_id, percentual }]
 *
 * O último a receber absorve a sobra do arredondamento: dividir R$ 100,00 em
 * três dá 33,33 + 33,33 + 33,34, e não 99,99. Centavo que some é centavo que
 * alguém vai ter de explicar depois.
 */
export function ratear({ total = 0, partes = [] } = {}) {
    const validas = (partes || []).filter(p => p && (p.nome || p.contato_id));
    if (!validas.length) return { partes: [], avisos: ['Nenhum responsável definido.'], aplicou: false };

    const avisos = [];
    const soma = validas.reduce((s, p) => s + (Number(p.percentual) || 0), 0);
    if (Math.abs(soma - 100) > 0.01) {
        avisos.push(`Os percentuais somam ${soma.toLocaleString('pt-BR')}%, não 100%.`);
    }

    const totalCent = centavos(total);
    let distribuido = 0;
    const saida = validas.map((p, i) => {
        const ultimo = i === validas.length - 1;
        const cent = ultimo ? totalCent - distribuido
            : Math.round(totalCent * (Number(p.percentual) || 0) / 100);
        distribuido += cent;
        return { nome: p.nome || '', contato_id: p.contato_id || null,
                 percentual: Number(p.percentual) || 0, valor: cent / 100, parte: i + 1 };
    });
    return { partes: saida, avisos, aplicou: true };
}

/** Partes iguais para N responsáveis — o caso comum (pai e mãe, metade). */
export function partesIguais(nomes = []) {
    const n = nomes.length || 1;
    const pct = Math.round((100 / n) * 100) / 100;
    return nomes.map((nome, i) => ({
        nome,
        // a última parte fecha os 100% para não sobrar 0,01% de percentual
        percentual: i === nomes.length - 1
            ? Math.round((100 - pct * (n - 1)) * 100) / 100 : pct
    }));
}

// ---------------------------------------------------------------------------
// Resumo legível — é o que a tela mostra na lista e na conferência
// ---------------------------------------------------------------------------

export function resumoExcecao(e) {
    if (!e) return '';
    const p = e.params || {};
    if (e.tipo === 'desdobrar') {
        const onde = p.datas === 'extra'
            ? `, cada uma levando um dia a mais (+${Number(p.deslocamento_dias) || 2})`
            : ', no mesmo dia';
        return `Sessões desdobradas em linhas de ${moeda(p.valor_linha)}${onde}`;
    }
    if (e.tipo === 'rateio') {
        const partes = (p.partes || []).map(x =>
            `${x.nome || '?'} ${Number(x.percentual) || 0}%`).join(' · ');
        return `Dividido entre ${(p.partes || []).length} responsáveis: ${partes}`;
    }
    return '';
}
