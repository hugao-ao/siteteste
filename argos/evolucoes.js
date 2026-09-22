// evolucoes.js — Gestão das evoluções (financeiro e gestora)
// ===========================================================
// A mesma régua do painel do profissional, para todo mundo de uma vez:
// por profissional, quantas anamneses e avaliações estão faltando ou
// vencendo, com a lista e o WhatsApp de cobrança.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { hojeISO, formataBR } from './argos-recorrencia.js';
import { linkWhatsApp, conferirFone } from './argos-cobranca.js';
import { pacientesDoProfissional } from './argos-escopo.js';
import { pendenciasDeEvolucao, contarPendenciasEv, emAtendimento, TIPOS_PENDENCIA_EV } from './argos-evolucao-pendencias.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true, escopo: { geral: true } };
let pacientes = [], dinamicas = [], profissionais = [], grupos = [], grupoMembros = [], grupoProfs = [];
let avaliacoes = [], comAnamnese = new Set();
let profSel = '';
const el = id => document.getElementById(id);
const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || 'Sem profissional';

async function carregarTudo() {
    const [rPac, rDin, rProf, rGru, rMem, rGP, rAv, rAn] = await Promise.all([
        sb.from('argos_pacientes').select('id, nome, ativo, cadastro_removido, processo_fim_data, processo_fim_tipo').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('id, paciente_id, profissional_id, repasses, ativo')),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_grupos').select('*'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*'),
        todas(() => sb.from('argos_ev_avaliacoes').select('*')),
        todas(() => sb.from('argos_anamnese_respostas').select('paciente_id'))
    ]);
    const erro = rPac.error || rDin.error || rProf.error || rAv.error;
    if (erro) { console.error(erro); toast('Erro ao carregar as evoluções.', true); return; }
    pacientes = rPac.data || []; dinamicas = rDin.data || []; profissionais = rProf.data || [];
    grupos = rGru.data || []; grupoMembros = rMem.data || []; grupoProfs = rGP.data || [];
    avaliacoes = rAv.data || []; comAnamnese = new Set((rAn.data || []).map(r => r.paciente_id));
    render();
}

/** paciente → profissionais que o atendem hoje (dinâmica/grupo ativo). */
function mapaProfissionais() {
    const ativos = emAtendimento(pacientes, hojeISO());
    const dinsAtivas = dinamicas.filter(d => d.ativo !== false);
    const porPac = new Map();
    for (const pr of profissionais) {
        const ids = pacientesDoProfissional(pr.id, { dinamicas: dinsAtivas, grupos: grupos.filter(g => g.ativo !== false), grupoMembros, grupoProfs });
        for (const id of ids) { if (!porPac.has(id)) porPac.set(id, []); porPac.get(id).push(pr.id); }
    }
    return { ativos, porPac };
}

function render() {
    const hoje = hojeISO();
    const janela = Number(el('ev-janela').value) || 0;
    const { ativos, porPac } = mapaProfissionais();
    // quem não tem profissional ativo aparece num bloco próprio, para não sumir
    const lista = pendenciasDeEvolucao({ pacientes: ativos, avaliacoes, comAnamnese, hoje, janelaDias: janela })
        .map(i => ({ ...i, profs: porPac.get(i.paciente.id) || [] }));

    // resumo por profissional
    const porProf = new Map();
    const soma = (id, i) => { if (!porProf.has(id)) porProf.set(id, { id, itens: [], pacientes: new Set() }); porProf.get(id).itens.push(i); porProf.get(id).pacientes.add(i.paciente.id); };
    for (const i of lista) { if (i.profs.length) i.profs.forEach(id => soma(id, i)); else soma('', i); }
    const podeCobrar = perm.pode('evolucoes_cobrar');
    el('ev-resumo').innerHTML = [...porProf.values()].sort((a, b) => b.itens.length - a.itens.length).map(r => {
        const c = contarPendenciasEv(r.itens);
        const p = profissionais.find(x => x.id === r.id);
        return `<div class="ev-prof ${profSel === r.id ? 'ativo' : ''}" data-prof="${r.id}">
          <h3><span>🧑‍⚕️ ${esc(nomeProf(r.id))}</span><span class="badge ${c.total ? 'vermelho' : 'verde'}">${c.total} em ${c.pacientes}</span></h3>
          <div class="nums">
            ${Object.entries(TIPOS_PENDENCIA_EV).filter(([k]) => c[k]).map(([k, t]) => `<span>${t.icone} ${esc(t.rotulo.toLowerCase())} <b>${c[k]}</b></span>`).join('')}
          </div>
          ${podeCobrar && r.id && c.total ? `<div class="acoes"><button class="argos-btn small ghost" data-cobrar="${r.id}" title="${p && p.telefone ? 'WhatsApp ' + esc(p.telefone) : 'Sem telefone no cadastro — vai pedir'}">📲 Cobrar</button>
            <a class="argos-btn small ghost" href="painel.html?profissional=${r.id}">📌 Painel</a></div>` : ''}
        </div>`;
    }).join('') || '<p class="ev-ok">Nenhuma pendência de evolução. 🎉</p>';

    // lista filtrada
    const busca = el('ev-busca').value.trim().toLowerCase();
    const tipo = el('ev-tipo').value;
    const visiveis = lista
        .filter(i => !profSel || i.profs.includes(profSel) || (profSel === '-' && !i.profs.length))
        .filter(i => !tipo || i.tipo === tipo)
        .filter(i => !busca || i.paciente.nome.toLowerCase().includes(busca));
    const c = contarPendenciasEv(lista);
    el('ev-contagem').textContent = `${c.total} pendência(s) em ${c.pacientes} paciente(s) de ${ativos.length} em atendimento${visiveis.length !== lista.length ? ` · mostrando ${visiveis.length}` : ''}`;
    el('ev-lista').innerHTML = visiveis.length ? visiveis.map(i => `
      <div class="ev-item">
        <span class="quem">${esc(i.paciente.nome)}<small>${i.profs.length ? i.profs.map(nomeProf).map(esc).join(', ') : 'sem profissional ativo'}</small></span>
        <span class="oque"><b>${i.icone} ${esc(i.rotulo)}</b><br>${esc(i.detalhe)}</span>
        <a class="argos-btn small primary" href="${i.link}">Abrir →</a>
      </div>`).join('') : '<p class="ev-ok">Nada com esse filtro.</p>';
    perm.aplicarVisibilidade(document);
}

function textoCobranca(profId, itens) {
    const p = profissionais.find(x => x.id === profId);
    const nome = String(p && p.nome || '').split(/\s+/)[0];
    const t = [`*Evoluções pendentes — ${p ? p.nome : ''}*`, `_Argos Gestão · ${formataBR(hojeISO())}_`, '',
        `Olá, ${nome}! Há *${itens.length}* pendência(s) de evolução nos seus pacientes:`, ''];
    const porPac = new Map();
    itens.forEach(i => { if (!porPac.has(i.paciente.id)) porPac.set(i.paciente.id, { nome: i.paciente.nome, itens: [] }); porPac.get(i.paciente.id).itens.push(i); });
    [...porPac.values()].slice(0, 40).forEach(g => t.push(`• *${g.nome}*: ${g.itens.map(i => i.rotulo.toLowerCase() + (i.prazo ? ` (${formataBR(i.prazo)})` : '')).join('; ')}`));
    if (porPac.size > 40) t.push(`_(+${porPac.size - 40} pacientes)_`);
    t.push('', `Os atalhos estão no seu painel: ${location.origin}${location.pathname.replace('evolucoes.html', 'painel.html')}`);
    return t.join('\n');
}

async function cobrar(profId) {
    if (!perm.pode('evolucoes_cobrar')) { toast('Sem permissão para cobrar.', true); return; }
    const hoje = hojeISO();
    const { ativos, porPac } = mapaProfissionais();
    const itens = pendenciasDeEvolucao({ pacientes: ativos, avaliacoes, comAnamnese, hoje, janelaDias: Number(el('ev-janela').value) || 0 })
        .filter(i => (porPac.get(i.paciente.id) || []).includes(profId));
    if (!itens.length) { toast('Nada a cobrar deste profissional.'); return; }
    const p = profissionais.find(x => x.id === profId);
    let fone = p && p.telefone;
    if (!fone) {
        fone = prompt(`WhatsApp de ${p ? p.nome : 'profissional'} (país, DDD e número). Fica salvo no cadastro.`) || '';
        const c0 = conferirFone(fone);
        if (!c0.ok) { if (fone) toast(c0.erro, true); return; }
        fone = c0.fone;
        await sb.from('argos_profissionais').update({ telefone: fone }).eq('id', profId);
        if (p) p.telefone = fone;
    }
    const c = conferirFone(fone);
    if (!c.ok) { toast(c.erro, true); return; }
    window.open(linkWhatsApp(c.fone, textoCobranca(profId, itens)), '_blank', 'noopener');
}

document.addEventListener('click', e => {
    const cob = e.target.closest('[data-cobrar]');
    if (cob) { e.stopPropagation(); return cobrar(cob.dataset.cobrar); }
    if (e.target.closest('a')) return;
    const card = e.target.closest('.ev-prof');
    if (card) { const id = card.dataset.prof; profSel = profSel === (id || '-') ? '' : (id || '-'); render(); }
});
['ev-busca', 'ev-tipo', 'ev-janela'].forEach(id => el(id).addEventListener('input', render));

(async function init() {
    perm = await carregarPermissoes();
    if (!perm.exigirPagina('evolucoes_gestao_pagina', 'a gestão das evoluções')) return;
    perm.aplicarVisibilidade();
    await carregarTudo();
})();
