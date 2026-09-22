// argos-frequencia.js — gravar a frequência das sessões
// ======================================================
// Marcar em lote não é marcar N vezes: a justificativa é pedida uma vez só,
// o banco leva um único insert e um único update, e quem chamou redesenha no
// fim. Resolver o mês inteiro de um paciente chegava a recarregar as milhares
// de sessões uma vez por clique.
//
// Vive fora das telas porque hoje são duas: a agenda (pelo cartão da sessão)
// e a janela de pendências. Se a regra morasse numa delas, a outra ia acabar
// com a sua própria versão — e uma das duas ficaria para trás.

/** Canal por onde as janelas abertas avisam umas às outras que algo mudou. */
export const CANAL_FREQUENCIA = 'argos-frequencia';

/** Avisa as outras janelas (agenda ⇄ pendências) que a frequência mudou. */
export function avisarMudanca(detalhe = {}) {
    try {
        const canal = new BroadcastChannel(CANAL_FREQUENCIA);
        canal.postMessage({ tipo: 'frequencia', quando: Date.now(), ...detalhe });
        canal.close();
    } catch (e) { /* navegador sem BroadcastChannel: quem ouve recarrega ao focar */ }
}

/** Escuta as mudanças vindas de outra janela. Devolve como parar de ouvir. */
export function ouvirMudancas(aoMudar) {
    let canal = null;
    try {
        canal = new BroadcastChannel(CANAL_FREQUENCIA);
        canal.onmessage = e => { if (e.data && e.data.tipo === 'frequencia') aoMudar(e.data); };
    } catch (e) { /* sem canal: o foco da janela é o gatilho de reserva */ }
    return () => { if (canal) canal.close(); };
}

// ---------------------------------------------------------------------------
// As duas camadas
// ---------------------------------------------------------------------------
// A recepção preenche a frequência, mas o que ela marca não entra no
// fechamento sozinho: fica em `status_proposto` até o profissional (ou o
// financeiro) validar. Quem tem `frequencia_oficial` grava direto no
// `status`; quem só tem `frequencia_propor` escreve na proposta. Quem não
// tem `frequencia_ver_oficial` enxerga apenas a própria camada — para ela,
// a sessão validada sem proposta aparece como «??» com a marca ✔ conferida.

let cfg = { modo: null, quem: null, verOficial: true, validaProprias: false, profissionalId: null, master: false, configurado: false };

/** Diz ao módulo quem está logado e o que pode. Chamar depois de carregarPermissoes(). */
export function configurarFrequencia(perm) {
    const pode = k => !!(perm && (perm.master || perm.pode(k)));
    cfg = {
        modo: pode('frequencia_oficial') ? 'oficial' : pode('frequencia_propor') ? 'proposta' : null,
        quem: sessionStorage.getItem('usuario') || null,
        verOficial: pode('frequencia_ver_oficial'),
        validaProprias: pode('frequencia_validar'),
        profissionalId: perm && perm.escopo ? perm.escopo.profissionalId : null,
        master: !!(perm && perm.master),
        configurado: true
    };
    return cfg;
}

export const modoFrequencia = () => cfg.modo;
export const veOficial = () => cfg.verOficial;

/**
 * A lista de sessões como o usuário logado deve vê-la. Quem vê a oficial
 * recebe tudo como está; quem só vê a proposta recebe a proposta no lugar
 * do status (ou «??»), e a marca `conferida` nas que já foram validadas.
 */
export function aplicarCamada(sessoes) {
    if (cfg.verOficial) return sessoes || [];
    return (sessoes || []).map(s => ({
        ...s,
        status: s.status_proposto || '??',
        justificativa: s.status_proposto ? (s.justificativa_proposta || null) : null,
        conferida: !!s.validado_em,
        oficialOculto: true
    }));
}

const agora = () => new Date().toISOString();

/** Quem grava o oficial numa sessão sua já a valida; nos outros casos a validação é do profissional. */
function validacaoAoGravar(s) {
    if (cfg.validaProprias && cfg.profissionalId && s && s.profissional_id === cfg.profissionalId) {
        return { validado_por: cfg.quem, validado_em: agora() };
    }
    return { validado_por: null, validado_em: null };
}

/**
 * Grava o status de uma ou muitas sessões, na camada que o usuário pode
 * escrever (ou na que `opcoes.modo` mandar).
 *
 * As que já existem levam um update só; as que ainda são projeção do horário
 * fixo nascem agora, num insert só. Devolve { erro, criadas, modo }.
 */
export async function gravarFrequencia(sb, alvos, status, justificativa, opcoes = {}) {
    const lista = (alvos || []).filter(Boolean);
    if (!lista.length) return { erro: null, criadas: [], modo: cfg.modo };
    // página que não chamou configurarFrequencia: comportamento antigo (oficial);
    // usuário configurado e sem permissão nenhuma: o mais seguro é a proposta
    const modo = opcoes.modo || cfg.modo || (cfg.configurado ? 'proposta' : 'oficial');
    const quem = cfg.quem;

    const jaGravadas = lista.filter(s => s.id);
    const projetadas = lista.filter(s => !s.id);

    const camposProposta = { status_proposto: status === '??' ? null : status,
        justificativa_proposta: status === '??' ? null : (justificativa || null),
        proposto_por: quem, proposto_em: agora() };

    if (jaGravadas.length) {
        if (modo === 'proposta') {
            const { error } = await sb.from('argos_sessoes').update(camposProposta).in('id', jaGravadas.map(s => s.id));
            if (error) return { erro: error, criadas: [], modo };
        } else {
            // a validação depende de cada sessão (é minha ou não?) — agrupa
            const grupos = new Map();
            for (const s of jaGravadas) {
                const v = validacaoAoGravar(s);
                const k = v.validado_em ? 'v' : 'n';
                if (!grupos.has(k)) grupos.set(k, { v, ids: [] });
                grupos.get(k).ids.push(s.id);
            }
            for (const { v, ids } of grupos.values()) {
                const { error } = await sb.from('argos_sessoes')
                    .update({ status, justificativa, status_por: quem, status_em: agora(), ...v }).in('id', ids);
                if (error) return { erro: error, criadas: [], modo };
            }
        }
    }
    let criadas = [];
    if (projetadas.length) {
        const { data, error } = await sb.from('argos_sessoes').insert(projetadas.map(s => ({
            paciente_id: s.paciente_id, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
            data: s.data, hora: s.hora, duracao_min: s.duracao_min || 60,
            sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
            servico_id: s.servico_id || null,
            grupo_id: s.grupo_id || null, grupo_ref: s.grupo_ref || null,
            ...(modo === 'proposta'
                ? { status: '??', justificativa: null, ...camposProposta }
                : { status, justificativa, status_por: quem, status_em: agora(), ...validacaoAoGravar(s) })
        }))).select('id');
        if (error) return { erro: error, criadas: [], modo };
        criadas = data || [];
    }
    return { erro: null, criadas, modo };
}

/**
 * Valida sessões: a proposta vira oficial (quando houver) e a sessão fica
 * marcada como validada por quem está logado. Sessões sem status oficial e
 * sem proposta não têm o que validar e são ignoradas. Devolve { erro, quantas }.
 */
export async function validarSessoes(sb, alvos, { aprovarPropostas = true } = {}) {
    const lista = (alvos || []).filter(s => s && s.id);
    if (!lista.length) return { erro: null, quantas: 0 };
    const quem = cfg.quem;
    const grupos = new Map(); // chave: status a gravar (ou '' = só validar)
    for (const s of lista) {
        const proposta = aprovarPropostas && s.status_proposto ? s.status_proposto : null;
        if (!proposta && (!s.status || s.status === '??')) continue;
        const k = proposta ? `${proposta}|${s.justificativa_proposta || ''}` : '';
        if (!grupos.has(k)) grupos.set(k, { proposta, justificativa: s.justificativa_proposta || null, ids: [] });
        grupos.get(k).ids.push(s.id);
    }
    let quantas = 0;
    for (const g of grupos.values()) {
        const campos = { validado_por: quem, validado_em: agora() };
        if (g.proposta) Object.assign(campos, { status: g.proposta, justificativa: g.justificativa, status_por: quem, status_em: agora() });
        const { error } = await sb.from('argos_sessoes').update(campos).in('id', g.ids);
        if (error) return { erro: error, quantas };
        quantas += g.ids.length;
    }
    return { erro: null, quantas };
}

/** Rótulo curto de quem/quando, para as marcas nas telas. */
export function marcaDeCamada(s, formataBR) {
    const partes = [];
    const dia = iso => iso ? formataBR(String(iso).slice(0, 10)) : '';
    if (s.status_proposto && !s.validado_em) partes.push(`📝 proposta ${s.status_proposto.toUpperCase()} por ${s.proposto_por || '?'} em ${dia(s.proposto_em)}`);
    if (s.validado_em) partes.push(`✔ validada por ${s.validado_por || '?'} em ${dia(s.validado_em)}`);
    else if (s.id && s.status && s.status !== '??') partes.push('⏳ sem validação do profissional');
    return partes.join(' · ');
}

/** Registra no histórico do paciente cada falta justificada do lote (só na camada oficial). */
export async function registrarFaltasJustificadas(sb, alvos, justificativa, formataBR) {
    if (cfg.modo === 'proposta') return;
    for (const s of alvos || []) {
        const { error } = await sb.from('argos_paciente_eventos').insert({
            paciente_id: s.paciente_id, tipo: 'falta_justificada',
            descricao: `Falta justificada na sessão de ${formataBR(s.data)} às ${s.hora}`
                + (justificativa ? '.' : ', sem motivo registrado.'),
            dados: { data: s.data, hora: s.hora },
            justificativa: justificativa || null
        });
        if (error) console.error(error);
    }
}
