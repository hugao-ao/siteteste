// pendencias.js — janela "Sessões pendentes de preenchimento"
// ============================================================
// Vive numa janela própria de propósito: preencher a frequência atrasada é
// trabalho de conferência a duas mãos — a planilha ou o WhatsApp de um lado,
// o sistema do outro. Como modal, obrigava a fechar tudo para consultar a
// agenda; solta, fica ao lado.
//
// Quando algo é marcado aqui, a agenda aberta na outra janela é avisada e se
// redesenha sozinha (argos-frequencia.js). As duas nunca mostram contagens
// diferentes da mesma coisa.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    STATUS_SESSAO, DOW_NOMES, mesclarSessoes, hojeISO, somarDias, paraData,
    formataBR, aplicarFimDeProcesso
} from './argos-recorrencia.js';
import { conferirFone, linkWhatsApp, mensagemPendencias } from './argos-cobranca.js';
import { AGRUPAMENTOS, ORDENS, agrupamento, agruparPendencias, contarPendencias }
    from './argos-pendencias.js';
import { gravarFrequencia, registrarFaltasJustificadas, avisarMudanca, ouvirMudancas }
    from './argos-frequencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], salas = [], profissionais = [], dinamicas = [], sessoes = [];

let pendAgrupar = 'paciente';
let pendOrdem = 'alfabetica';
let pendBusca = '';
let pendMostradas = [];               // o que está na tela — é o que vai no recado
const chaves = new Map();             // chave → sessão (para achar no clique)
const grupoDeChave = new Map();       // chave do bloco → sessões dele

const el = id => document.getElementById(id);
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '(paciente?)';
const nomeSala = id => (salas.find(s => s.id === id) || {}).nome || 'Sem espaço';
const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';

// ===========================================================================
// CARGA
// ===========================================================================
async function carregarTudo() {
    const [rPac, rSalas, rProf, rDin, rSes] = await Promise.all([
        sb.from('argos_pacientes')
          .select('id, nome, ativo, cadastro_removido, processo_fim_data, processo_fim_tipo').order('nome'),
        sb.from('argos_salas').select('*').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*'))
    ]);
    const erro = rPac.error || rSalas.error || rProf.error || rDin.error || rSes.error;
    if (erro) { console.error(erro); toast('Erro ao carregar as pendências.', true); return; }
    pacientes = rPac.data || [];
    salas = rSalas.data || [];
    profissionais = rProf.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    render();
}

// ===========================================================================
// QUEM ESTÁ PENDENTE
// ===========================================================================
// A regra: sessão que já venceu e ninguém classificou é «??» até alguém dizer
// o que houve. Vale do primeiro dia da clínica até ONTEM — a de hoje ainda
// pode acontecer, e cobrar o preenchimento dela seria cobrar o futuro.
function sessoesPendentes() {
    const hoje = hojeISO();
    const inicio = dinamicas.map(d => d.data_inicio).filter(Boolean).sort()[0];
    const deSessoes = sessoes.map(s => s.data).sort()[0];
    const de = [inicio, deSessoes].filter(Boolean).sort()[0];
    if (!de) return [];
    const c = aplicarFimDeProcesso(dinamicas, sessoes, pacientes);
    // Desligar uma dinâmica encerra o futuro dela, não apaga o passado: o que
    // já venceu sem classificação continua pendente. O corte por fim de
    // processo do paciente continua valendo por cima.
    const paraPendencia = c.dinamicas.map(d => d.ativo === false ? { ...d, ativo: true } : d);
    return mesclarSessoes(paraPendencia, c.sessoes, de, somarDias(hoje, -1))
        .filter(s => s.status === '??');
}

function chaveSessao(s) {
    const k = s.id || `${s.dinamica_ref}|${s.data}|${s.hora}`;
    chaves.set(k, s);
    return k;
}

// ===========================================================================
// A LISTA
// ===========================================================================
const STATUS_MARCAVEIS = ['ok', 'fj', 'fc', 'nc'];

const botoesStatus = (attr, valor, titulo) => `
  <div class="botoes-status compacto">
    ${STATUS_MARCAVEIS.map(st => `
      <button class="btn-status" style="--c:${STATUS_SESSAO[st].cor}"
        data-${attr}="${valor}" data-status="${st}"
        title="${titulo ? `${titulo}: ` : ''}${STATUS_SESSAO[st].desc}">${STATUS_SESSAO[st].label}</button>`).join('')}
  </div>`;

/** A sessão da agenda com os ids já virados nome, como o módulo espera. */
const itemDePendencia = s => ({
    paciente: nomePac(s.paciente_id), profissional: nomeProf(s.profissional_id),
    espaco: nomeSala(s.sala_id), data: s.data, hora: s.hora, ref: s
});

function preencherSelect(id, lista, atual) {
    const alvo = el(id);
    if (alvo.options.length !== lista.length) {
        alvo.innerHTML = lista.map(x =>
            `<option value="${x.valor}" title="${esc(x.dica)}">${esc(x.rotulo)}</option>`).join('');
    }
    alvo.value = atual;
}

function render() {
    const todasPend = sessoesPendentes();
    const busca = pendBusca.trim().toLowerCase();
    const casa = s => !busca
        || nomePac(s.paciente_id).toLowerCase().includes(busca)
        || nomeProf(s.profissional_id).toLowerCase().includes(busca)
        || nomeSala(s.sala_id).toLowerCase().includes(busca);
    const pend = todasPend.filter(casa);

    preencherSelect('pend-agrupar', AGRUPAMENTOS, pendAgrupar);
    preencherSelect('pend-ordem', ORDENS, pendOrdem);

    const { sessoes: qtd, pacientes: quantos } = contarPendencias(todasPend.map(itemDePendencia));
    el('pend-resumo').textContent = qtd
        ? `${qtd} pendência(s) em ${quantos} paciente(s)`
          + (busca ? ` · mostrando ${pend.length}` : '')
          + ` · ${agrupamento(pendAgrupar).dica}`
        : '';

    const alvo = el('lista-pendentes');
    pendMostradas = pend;
    if (!pend.length) {
        alvo.innerHTML = todasPend.length
            ? '<p class="dim">Nenhuma pendência com esse filtro.</p>'
            : '<p class="dim">Nenhuma pendência. 🎉</p>';
        return;
    }

    const blocos = agruparPendencias(pend.map(itemDePendencia),
        { agrupar: pendAgrupar, ordem: pendOrdem });
    alvo.innerHTML = blocos.map(b => {
        grupoDeChave.set(b.chave, b.itens.map(i => i.ref));
        return `
      <div class="pend-grupo">
        <div class="pend-grupo-topo">
          <div class="bloco-info">
            <b>${esc(tituloDoBloco(b))}</b>
            ${subtituloDoBloco(b)}
            <span class="pend-conta">${b.itens.length}</span>
            ${b.itens.length > 1 ? '<span class="dim"> — marcar todas:</span>' : ''}
          </div>
          ${b.itens.length > 1 ? botoesStatus('marcar-grupo', esc(b.chave), `Todas as ${b.itens.length}`) : ''}
        </div>
        ${b.itens.map(i => `
          <div class="argos-bloco pendente-linha" data-chave="${chaveSessao(i.ref)}">
            <div class="bloco-info">
              <b>${esc(linhaDoBloco(i))}</b><br>
              <span class="dim">${esc(subLinhaDoBloco(i))}</span>
            </div>
            ${botoesStatus('marcar', '')}
          </div>`).join('')}
      </div>`;
    }).join('');
    perm.aplicarVisibilidade(document);
}

const diaDaSemana = iso => DOW_NOMES[paraData(iso).getDay()];

const tituloDoBloco = b => pendAgrupar === 'data'
    ? `${formataBR(b.nome)} (${diaDaSemana(b.nome)})` : b.nome;

/** Quando o bloco não é o paciente, o subtítulo diz o que ele tem em comum. */
function subtituloDoBloco(b) {
    if (pendAgrupar !== 'paciente') return '';
    const profs = [...new Set(b.itens.map(i => i.profissional).filter(Boolean))];
    return profs.length ? `<span class="dim"> · ${esc(profs.join(', '))}</span>` : '';
}

/** A linha diz o que o bloco ainda não disse — nunca repete o título. */
function linhaDoBloco(i) {
    if (pendAgrupar === 'paciente') return `${formataBR(i.data)} ${i.hora}`;
    if (pendAgrupar === 'data') return `${i.hora} — ${i.paciente}`;
    if (pendAgrupar === 'horario') return `${formataBR(i.data)} — ${i.paciente}`;
    return `${formataBR(i.data)} ${i.hora} — ${i.paciente}`;
}

function subLinhaDoBloco(i) {
    if (pendAgrupar === 'paciente') return i.espaco;
    if (pendAgrupar === 'espaco') return i.profissional;
    if (pendAgrupar === 'profissional') return i.espaco;
    return `${i.espaco} · ${i.profissional}`;
}

// ===========================================================================
// MARCAR
// ===========================================================================
async function marcarSessoes(lista, status) {
    if (!perm.pode('sessoes_status')) { toast('Sem permissão para marcar frequência.', true); return; }
    const alvos = (lista || []).filter(Boolean);
    if (!alvos.length) return;

    // Falta justificada pede o motivo escrito. Quem tem a permissão de dispensa
    // pode deixar em branco — é o caso de quando o responsável só manda o
    // motivo depois. Em lote, o motivo é pedido uma vez e vale para todas.
    let justificativa = alvos.length === 1 ? (alvos[0].justificativa || null) : null;
    if (status === 'fj') {
        const dispensa = perm.pode('sessao_fj_sem_justificativa');
        const quantas = alvos.length > 1 ? ` (vale para as ${alvos.length})` : '';
        const j = prompt(dispensa
            ? `Justificativa da falta${quantas} (pode deixar em branco):`
            : `Justificativa da falta${quantas} (obrigatória):`, justificativa || '');
        if (j === null) return;
        if (!j.trim() && !dispensa) {
            toast('A falta justificada precisa de uma justificativa.', true);
            return;
        }
        justificativa = j.trim() || null;
    }

    const { erro } = await gravarFrequencia(sb, alvos, status, justificativa);
    if (erro) {
        console.error(erro);
        toast(alvos.length > 1 ? 'Erro ao marcar as sessões.' : 'Erro ao marcar sessão.', true);
        return;
    }
    if (status === 'fj') await registrarFaltasJustificadas(sb, alvos, justificativa, formataBR);

    toast(alvos.length > 1
        ? `${alvos.length} sessões marcadas: ${STATUS_SESSAO[status].label} — ${STATUS_SESSAO[status].desc}`
        : `Sessão marcada: ${STATUS_SESSAO[status].label} — ${STATUS_SESSAO[status].desc}`);

    const { data } = await todas(() => sb.from('argos_sessoes').select('*'));
    sessoes = data || sessoes;
    render();
    avisarMudanca({ origem: 'pendencias', quantas: alvos.length });
}

// ===========================================================================
// EVENTOS
// ===========================================================================
el('lista-pendentes').addEventListener('click', async e => {
    const emLote = e.target.closest('[data-marcar-grupo]');
    if (emLote) {
        const lista = grupoDeChave.get(emLote.dataset.marcarGrupo) || [];
        if (!lista.length) return;
        const st = emLote.dataset.status;
        if (!confirm(`Marcar as ${lista.length} sessões como `
            + `«${STATUS_SESSAO[st].label} — ${STATUS_SESSAO[st].desc}»?`)) return;
        return marcarSessoes(lista, st);
    }
    const btn = e.target.closest('[data-marcar]');
    if (!btn) return;
    const linha = btn.closest('[data-chave]');
    const s = chaves.get(linha.dataset.chave);
    if (s) await marcarSessoes([s], btn.dataset.status);
});

el('pend-busca').addEventListener('input', e => { pendBusca = e.target.value; render(); });
el('pend-agrupar').addEventListener('change', e => { pendAgrupar = e.target.value; render(); });
el('pend-ordem').addEventListener('change', e => { pendOrdem = e.target.value; render(); });

// A lista costuma virar recado para a secretária ou para o profissional que
// não preencheu. Manda o que está na tela — com o filtro, o agrupamento e a
// ordem que a pessoa escolheu.
el('btn-pend-whats').addEventListener('click', () => {
    if (!pendMostradas.length) { toast('Não há pendências para enviar.', true); return; }
    const campo = el('pend-fone');
    const { ok, fone, erro } = conferirFone(campo.value);
    if (!ok) { toast(erro, true); campo.focus(); return; }
    const texto = mensagemPendencias({
        agrupar: pendAgrupar, ordem: pendOrdem, hoje: hojeISO(),
        itens: pendMostradas.map(itemDePendencia)
    });
    try { localStorage.setItem('argos_pend_fone', fone); } catch (x) {}
    window.open(linkWhatsApp(fone, texto), '_blank', 'noopener');
});

// Numa janela aberta pela agenda, "← Agenda" é fechar e voltar para ela, não
// abrir uma segunda cópia por cima.
if (window.opener && !window.opener.closed) {
    el('link-agenda').addEventListener('click', e => {
        e.preventDefault();
        try { window.opener.focus(); } catch (x) {}
        window.close();
    });
    el('link-agenda').textContent = '← Voltar para a agenda';
}

// se a agenda mexer na frequência, esta lista acompanha
ouvirMudancas(dados => { if (dados.origem !== 'pendencias') carregarTudo(); });

(async () => {
    try { el('pend-fone').value = localStorage.getItem('argos_pend_fone') || ''; } catch (e) {}
    perm = await carregarPermissoes();
    perm.aplicarVisibilidade(document);
    await carregarTudo();
})();
