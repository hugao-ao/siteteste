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

/**
 * Grava o status de uma ou muitas sessões.
 *
 * As que já existem levam um update só; as que ainda são projeção do horário
 * fixo nascem agora, num insert só. Devolve { erro, criadas }.
 */
export async function gravarFrequencia(sb, alvos, status, justificativa) {
    const lista = (alvos || []).filter(Boolean);
    if (!lista.length) return { erro: null, criadas: [] };

    const jaGravadas = lista.filter(s => s.id);
    const projetadas = lista.filter(s => !s.id);

    if (jaGravadas.length) {
        const { error } = await sb.from('argos_sessoes')
            .update({ status, justificativa }).in('id', jaGravadas.map(s => s.id));
        if (error) return { erro: error, criadas: [] };
    }
    let criadas = [];
    if (projetadas.length) {
        const { data, error } = await sb.from('argos_sessoes').insert(projetadas.map(s => ({
            paciente_id: s.paciente_id, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
            data: s.data, hora: s.hora, duracao_min: s.duracao_min || 60,
            sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
            servico_id: s.servico_id || null, status, justificativa,
            grupo_id: s.grupo_id || null, grupo_ref: s.grupo_ref || null
        }))).select('id');
        if (error) return { erro: error, criadas: [] };
        criadas = data || [];
    }
    return { erro: null, criadas };
}

/** Registra no histórico do paciente cada falta justificada do lote. */
export async function registrarFaltasJustificadas(sb, alvos, justificativa, formataBR) {
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
