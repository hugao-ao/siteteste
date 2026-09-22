// argos-evolucao-pendencias.js — o que falta fazer nas evoluções
// ==============================================================
// Regras únicas para o painel do profissional e para a gestão das
// evoluções (financeiro e gestora): quem está sem anamnese, sem avaliação
// inicial, com rascunho parado, ou com a próxima avaliação vencendo.
//
// Recebe listas já carregadas; não consulta o banco.

import { limiteProxima } from './argos-evolucao.js';
import { somarDias } from './argos-recorrencia.js';

/** Tipos de pendência, do mais grave para o menos. */
export const TIPOS_PENDENCIA_EV = {
    sem_anamnese:     { rotulo: 'Sem anamnese',                 icone: '📋', peso: 5, para: 'anamnese' },
    sem_inicial:      { rotulo: 'Sem avaliação inicial',        icone: '📈', peso: 4, para: 'evolucao' },
    proxima_vencida:  { rotulo: 'Próxima avaliação vencida',    icone: '⏰', peso: 3, para: 'evolucao' },
    rascunho:         { rotulo: 'Avaliação em rascunho',        icone: '✏️', peso: 2, para: 'evolucao' },
    proxima_vencendo: { rotulo: 'Próxima avaliação vencendo',   icone: '📅', peso: 1, para: 'evolucao' }
};

/**
 * Pendências de evolução de uma lista de pacientes.
 *
 * pacientes  — os pacientes a olhar (já filtrados por profissional/ativos)
 * avaliacoes — linhas de argos_ev_avaliacoes desses pacientes
 * comAnamnese — Set de paciente_id que têm anamnese preenchida
 * hoje       — 'YYYY-MM-DD'
 * janelaDias — quantos dias antes do prazo a próxima avaliação já "vence"
 *
 * Devolve [{ paciente, tipo, rotulo, detalhe, prazo, avaliacao, link }],
 * um item por pendência, do mais grave para o menos, e por paciente.
 */
export function pendenciasDeEvolucao({ pacientes = [], avaliacoes = [], comAnamnese = new Set(),
    hoje, janelaDias = 15 } = {}) {
    const saida = [];
    const limite = somarDias(hoje, janelaDias);
    for (const p of pacientes) {
        const avs = avaliacoes.filter(a => a.paciente_id === p.id)
            .sort((a, b) => (a.numero || 0) - (b.numero || 0));
        const concluidas = avs.filter(a => a.status === 'concluida');
        const rascunho = avs.find(a => a.status === 'rascunho');
        const inicial = concluidas.find(a => a.numero === 1);
        const push = (tipo, extra = {}) => saida.push({
            paciente: p, tipo, rotulo: TIPOS_PENDENCIA_EV[tipo].rotulo, icone: TIPOS_PENDENCIA_EV[tipo].icone,
            peso: TIPOS_PENDENCIA_EV[tipo].peso,
            link: TIPOS_PENDENCIA_EV[tipo].para === 'anamnese'
                ? `anamnese.html?paciente=${p.id}`
                : `evolucao.html?paciente=${p.id}${extra.avaliacao ? `&avaliacao=${extra.avaliacao.id}` : ''}`,
            detalhe: '', prazo: null, avaliacao: null, ...extra
        });

        if (!comAnamnese.has(p.id)) push('sem_anamnese', { detalhe: 'A ficha de anamnese ainda não foi preenchida.' });

        if (!inicial) {
            if (rascunho) push('rascunho', { avaliacao: rascunho,
                detalhe: `Avaliação inicial começada em ${br(rascunho.data)} e não concluída.` });
            else push('sem_inicial', { detalhe: 'Nenhuma avaliação inicial concluída.' });
            continue;
        }
        if (rascunho) {
            push('rascunho', { avaliacao: rascunho,
                detalhe: `${rascunho.numero}ª avaliação começada em ${br(rascunho.data)} e não concluída.` });
            continue; // a próxima já está em andamento; não cobrar duas vezes
        }
        const ultima = concluidas[concluidas.length - 1];
        const prazo = limiteProxima(ultima);
        if (!prazo) continue;
        if (prazo < hoje) push('proxima_vencida', { prazo, avaliacao: ultima,
            detalhe: `A ${ultima.numero + 1}ª avaliação venceu em ${br(prazo)} (${diasEntre(prazo, hoje)} dias).` });
        else if (prazo <= limite) push('proxima_vencendo', { prazo, avaliacao: ultima,
            detalhe: `A ${ultima.numero + 1}ª avaliação vence em ${br(prazo)} (${diasEntre(hoje, prazo)} dias).` });
    }
    return saida.sort((a, b) => b.peso - a.peso
        || String(a.prazo || '').localeCompare(String(b.prazo || ''))
        || String(a.paciente.nome).localeCompare(String(b.paciente.nome)));
}

/** Resumo por tipo, para os cartões. */
export function contarPendenciasEv(lista = []) {
    const c = {};
    for (const k of Object.keys(TIPOS_PENDENCIA_EV)) c[k] = 0;
    lista.forEach(i => { c[i.tipo]++; });
    c.total = lista.length;
    c.pacientes = new Set(lista.map(i => i.paciente.id)).size;
    return c;
}

/** Pacientes que ainda estão em atendimento: ativos, sem fim de processo passado. */
export function emAtendimento(pacientes = [], hoje) {
    return pacientes.filter(p => p.ativo !== false && !p.cadastro_removido
        && !(p.processo_fim_tipo && p.processo_fim_data && p.processo_fim_data <= hoje));
}

const br = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
