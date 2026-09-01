// argos-fechamento.js — o valor final do mês de cada paciente
// ============================================================
// O fechamento calcula um valor a partir da frequência. Mas o que se cobra
// nem sempre é o que a conta deu: um mês fechado num acordo, um desconto
// combinado no telefone, uma sessão que a clínica decide não cobrar. Por isso
// o valor final tem três camadas, nesta ordem:
//
//   1. CALCULADO   — o que a frequência e o acordo dizem;
//   2. AJUSTADO    — o que a clínica decidiu cobrar neste mês, se decidiu;
//   3. CONGELADO   — o que foi efetivamente cobrado, no instante do envio.
//
// A terceira é a que protege a conversa: depois que o responsável recebeu
// "são R$ 660,00", esse número não pode mudar sozinho porque alguém preencheu
// uma falta atrasada. Ele congela, e qualquer divergência posterior aparece
// como aviso para uma pessoa decidir o que fazer — corrigir a cobrança,
// reenviar, ou aceitar como está.

const num = v => (v == null || v === '' ? null : Number(v));
const cent = v => Math.round((Number(v) || 0) * 100);

/** Situações que valem como sessão realizada e contabilizada. */
const REALIZADA = new Set(['ok', 'fc']);

// ---------------------------------------------------------------------------
// Fixo mensal sem sessão no mês
// ---------------------------------------------------------------------------

/**
 * Acordos fixos mensais que estão sendo cobrados num mês em que não houve
 * NENHUMA sessão realizada.
 *
 * Cobrar é o comportamento certo por padrão — o acordo é mensal, não por
 * sessão, e o horário ficou reservado. Mas é exatamente o mês em que alguém
 * precisa olhar antes de mandar a mensagem: pode ter sido férias, pode ter
 * sido a clínica que fechou, pode ser um encerramento que ninguém registrou.
 */
export function fixosSemSessao(fech, dinamicas = []) {
    const porId = new Map((dinamicas || []).map(d => [d.id, d]));
    const sessoes = (fech && fech.sessoes) || [];
    const achados = [];
    for (const pd of (fech && fech.porDinamica) || []) {
        const d = porId.get(pd.dinamica_id);
        if (!d || d.acordo_tipo !== 'fixo_mensal') continue;
        const realizadas = sessoes.filter(s =>
            s.dinamica_ref === d.id && REALIZADA.has(s.status)).length;
        if (realizadas) continue;
        const pendentes = sessoes.filter(s =>
            s.dinamica_ref === d.id && s.status === '??').length;
        achados.push({
            dinamica_id: d.id, rotulo: d.rotulo || 'Acordo fixo mensal',
            valor: Number(pd.valor) || 0, pendentes
        });
    }
    return achados;
}

// ---------------------------------------------------------------------------
// O valor final
// ---------------------------------------------------------------------------

/**
 * O valor que vale para este mês, dito com a sua origem.
 *
 * ajuste — linha de argos_cobranca_mes, ou null
 *
 * `congelado` ganha de tudo: depois de enviada, a cobrança é o que o
 * responsável viu. O valor calculado continua ao lado, para a tela poder
 * mostrar que os dois deixaram de bater.
 */
export function valorDoMes({ fech, ajuste = null } = {}) {
    const calculado = Number((fech && fech.valor) || 0);
    const ajustado = ajuste ? num(ajuste.valor_ajustado) : null;
    const congelado = ajuste ? num(ajuste.congelado_valor) : null;

    if (congelado != null) {
        return { valor: congelado, origem: 'congelado', calculado,
                 ajustado, congelado, editado: ajustado != null };
    }
    if (ajustado != null) {
        return { valor: ajustado, origem: 'ajustado', calculado,
                 ajustado, congelado: null, editado: true };
    }
    return { valor: calculado, origem: 'calculado', calculado,
             ajustado: null, congelado: null, editado: false };
}

/**
 * O valor que a cobrança REALMENTE definiu para cada paciente num mês:
 * congelado (enviado) ganha do ajustado, e quem não tem nenhum dos dois nem
 * entra no mapa — vale o calculado. É a base sobre a qual o repasse incide:
 * se a cobrança do mês foi alterada, o repasse acompanha.
 * Devolve Map(paciente_id → valor cobrado).
 */
export function cobradoPorPaciente(ajustes = [], mes) {
    const mapa = new Map();
    for (const a of ajustes || []) {
        if (!a || a.mes !== mes) continue;
        const v = num(a.congelado_valor) != null ? num(a.congelado_valor) : num(a.valor_ajustado);
        if (v != null) mapa.set(a.paciente_id, v);
    }
    return mapa;
}

// ---------------------------------------------------------------------------
// Congelar e conferir
// ---------------------------------------------------------------------------

/** O retrato que se guarda no envio: é contra ele que o mês vivo é conferido. */
export function retratoDaCobranca({ fech, valor }) {
    const c = (fech && fech.contagens) || {};
    return {
        valor: Number(valor) || 0,
        ok: c.ok || 0, fc: c.fc || 0, fj: c.fj || 0, nc: c.nc || 0,
        pendentes: c['??'] || 0
    };
}

const CAMPOS_COBRANCA = [
    ['valor', 'o valor cobrado'],
    ['ok', 'as sessões presentes'],
    ['fc', 'as faltas contabilizadas'],
    ['fj', 'as faltas justificadas'],
    ['nc', 'as sessões que não houve']
];

/**
 * O que mudou desde que a cobrança foi enviada.
 *
 * Só compara o que o responsável viu na mensagem. Preencher uma pendência que
 * não muda contagem nem valor não é divergência — é a clínica se organizando,
 * e avisar disso seria alarme falso.
 */
export function divergenciaDaCobranca(congelado, atual) {
    if (!congelado || !atual) return [];
    const mudou = [];
    for (const [campo, rotulo] of CAMPOS_COBRANCA) {
        const antes = campo === 'valor' ? cent(congelado[campo]) : (congelado[campo] || 0);
        const depois = campo === 'valor' ? cent(atual[campo]) : (atual[campo] || 0);
        if (antes !== depois) {
            mudou.push({ campo, rotulo,
                antes: campo === 'valor' ? antes / 100 : antes,
                depois: campo === 'valor' ? depois / 100 : depois });
        }
    }
    return mudou;
}

/** Frase curta do que mudou, para o aviso da linha. */
export function motivoDaDivergenciaDeCobranca(mudou = []) {
    if (!mudou.length) return '';
    const partes = mudou.map(m => m.rotulo);
    const lista = partes.length === 1 ? partes[0]
        : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
    return `Mudou ${lista} depois que a cobrança foi enviada.`;
}

// ---------------------------------------------------------------------------
// O painel do mês
// ---------------------------------------------------------------------------

/**
 * Quanto do mês já foi cobrado e quanto ainda falta.
 *
 * linhas — [{ valor, enviada }]
 *
 * O que interessa a quem está no meio do trabalho não é só "quantas enviei",
 * é "quanto do dinheiro do mês já saiu daqui" — e, principalmente, quanto
 * ainda falta, que é o tamanho do que resta fazer.
 */
export function totaisDoMes(linhas = []) {
    const t = { pacientes: 0, enviadas: 0, aEnviar: 0,
                valorTotal: 0, valorEnviado: 0, valorAEnviar: 0, divergentes: 0 };
    for (const l of linhas) {
        const v = Number(l.valor) || 0;
        t.pacientes++;
        t.valorTotal += v;
        if (l.enviada) { t.enviadas++; t.valorEnviado += v; }
        else { t.aEnviar++; t.valorAEnviar += v; }
        if (l.divergente) t.divergentes++;
    }
    return t;
}
