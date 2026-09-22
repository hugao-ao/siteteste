// frequencia.js — Conferência de frequência
// ==========================================
// Três filas, por profissional e período:
//   • propostas   — a recepção marcou, o profissional ainda não aprovou;
//   • a validar   — status oficial preenchido (financeiro, importação…) sem a
//                   validação do profissional;
//   • sem nada    — sessão vencida ainda «??», sem proposta (é da recepção).
// O profissional vê só as suas; o financeiro e a gestão veem todas e podem
// cobrar por WhatsApp quem está devendo.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    STATUS_SESSAO, mesclarSessoes, aplicarFimDeProcesso, hojeISO, somarDias, formataBR,
    paraData, DOW_NOMES, fimDoMes, definirMesesCongelados
} from './argos-recorrencia.js';
import {
    configurarFrequencia, gravarFrequencia, validarSessoes, marcaDeCamada,
    registrarFaltasJustificadas, avisarMudanca, ouvirMudancas
} from './argos-frequencia.js';
import { sessaoNoEscopo } from './argos-escopo.js';
import { linkWhatsApp, conferirFone } from './argos-cobranca.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true, escopo: { geral: true } };
let pacientes = [], profissionais = [], dinamicas = [], sessoes = [];
let linhas = [];              // as sessões do período, já classificadas
const chaves = new Map();     // chave da linha → sessão

const el = id => document.getElementById(id);
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '—';
const profDe = id => profissionais.find(p => p.id === id) || null;
const nomeProf = id => (profDe(id) || {}).nome || 'Sem profissional';
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0] || '';

// ---------------------------------------------------------------- período
function periodo() { return { de: el('fq-de').value, ate: el('fq-ate').value }; }
function definirPeriodo(qual) {
    const hoje = hojeISO();
    let de, ate;
    if (qual === 'hoje') { de = ate = hoje; }
    else if (qual === 'semana') { const dow = paraData(hoje).getDay(); de = somarDias(hoje, -((dow + 6) % 7)); ate = hoje; }
    else if (qual === 'anterior') {
        const [a, m] = hoje.slice(0, 7).split('-').map(Number);
        const mes = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
        de = `${mes}-01`; ate = fimDoMes(mes);
    } else { de = hoje.slice(0, 7) + '-01'; ate = hoje; }
    el('fq-de').value = de; el('fq-ate').value = ate;
}

// ---------------------------------------------------------------- carga
async function carregarTudo() {
    const [rPac, rProf, rDin, rSes, rCong] = await Promise.all([
        sb.from('argos_pacientes').select('id, nome, ativo, cadastro_removido, processo_fim_data, processo_fim_tipo').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        todas(() => sb.from('argos_meses_congelados').select('*'))
    ]);
    const erro = rPac.error || rProf.error || rDin.error || rSes.error;
    if (erro) { console.error(erro); toast('Erro ao carregar a frequência.', true); return; }
    pacientes = rPac.data || []; profissionais = rProf.data || [];
    dinamicas = rDin.data || []; sessoes = rSes.data || [];
    definirMesesCongelados((rCong && rCong.data) || []);
    montarFiltros();
    render();
}

async function recarregarSessoes() {
    const { data } = await todas(() => sb.from('argos_sessoes').select('*'));
    if (data) sessoes = data;
    render();
}

function montarFiltros() {
    const selP = el('fq-prof');
    const atual = selP.value;
    if (!perm.escopo.geral) {
        selP.innerHTML = `<option value="${perm.escopo.profissionalId}">🧑‍⚕️ ${esc(nomeProf(perm.escopo.profissionalId))}</option>`;
        selP.disabled = true;
    } else {
        selP.innerHTML = '<option value="">🧑‍⚕️ Todos os profissionais</option>'
            + profissionais.map(p => `<option value="${p.id}">🧑‍⚕️ ${esc(p.nome)}</option>`).join('');
        selP.value = atual || new URLSearchParams(location.search).get('profissional') || '';
    }
    const selPac = el('fq-paciente');
    const atualPac = selPac.value || new URLSearchParams(location.search).get('paciente') || '';
    selPac.innerHTML = '<option value="">🧑‍⚕️ Todos os pacientes</option>'
        + pacientes.filter(p => !p.cadastro_removido).map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    selPac.value = atualPac;
    if (selPac.value !== atualPac) selPac.value = '';
}

// ---------------------------------------------------------------- classificação
// 'proposta' → recepção marcou, sem validação  · 'validar' → oficial sem validação
// 'sem'      → vencida e «??» sem proposta      · 'ok'      → validada
function situacao(s) {
    if (s.validado_em) return 'ok';
    if (s.status_proposto) return 'proposta';
    if (s.id && s.status && s.status !== '??') return 'validar';
    return 'sem';
}

function chaveDe(s) {
    const k = s.id || `${s.dinamica_ref}|${s.data}|${s.hora}`;
    chaves.set(k, s);
    return k;
}

function calcular() {
    const { de, ate } = periodo();
    const hoje = hojeISO();
    if (!de || !ate) return [];
    const ateReal = ate > hoje ? hoje : ate;
    const c = aplicarFimDeProcesso(dinamicas, sessoes, pacientes);
    const paraLista = c.dinamicas.map(d => d.ativo === false ? { ...d, ativo: true } : d);
    const dinPorId = new Map(dinamicas.map(d => [d.id, d]));
    const prof = el('fq-prof').value;
    const pac = el('fq-paciente').value;
    const soPend = el('fq-so-pendentes').checked;
    return mesclarSessoes(paraLista, c.sessoes, de, ateReal)
        .filter(s => sessaoNoEscopo(perm, s, dinPorId))
        .filter(s => !prof || s.profissional_id === prof || s.repasse_profissional_id === prof)
        .filter(s => !pac || s.paciente_id === pac)
        .map(s => ({ s, sit: situacao(s) }))
        .filter(l => !soPend || l.sit !== 'ok')
        .sort((a, b) => (a.s.data + a.s.hora).localeCompare(b.s.data + b.s.hora));
}

// ---------------------------------------------------------------- render
function render() {
    chaves.clear();
    linhas = calcular();
    const podeValidar = perm.pode('frequencia_validar');
    const podeOficial = perm.pode('frequencia_oficial');
    const podeCobrar = perm.pode('frequencia_cobrar');

    const conta = { proposta: 0, validar: 0, sem: 0, ok: 0 };
    linhas.forEach(l => conta[l.sit]++);
    el('fq-contagem').textContent = linhas.length
        ? `${linhas.length} sessão(ões) · ${conta.proposta} proposta(s) · ${conta.validar} a validar · ${conta.sem} sem preenchimento${conta.ok ? ` · ${conta.ok} validada(s)` : ''}`
        : 'Nada neste período.';

    // ações do período inteiro
    el('fq-topo-acoes').innerHTML = podeValidar && (conta.proposta || conta.validar) ? `
      ${conta.proposta ? `<button class="argos-btn small primary" data-lote="proposta" data-prof="">✔ Aprovar todas as propostas (${conta.proposta})</button>` : ''}
      ${conta.validar ? `<button class="argos-btn small" data-lote="validar" data-prof="">✔ Validar todas as preenchidas (${conta.validar})</button>` : ''}` : '';

    // resumo por profissional
    const porProf = new Map();
    for (const l of linhas) {
        const id = l.s.profissional_id || '';
        if (!porProf.has(id)) porProf.set(id, { id, proposta: 0, validar: 0, sem: 0, ok: 0, antiga: null });
        const r = porProf.get(id); r[l.sit]++;
        if (l.sit !== 'ok' && (!r.antiga || l.s.data < r.antiga)) r.antiga = l.s.data;
    }
    el('fq-resumo').innerHTML = [...porProf.values()]
        .sort((a, b) => (b.proposta + b.validar + b.sem) - (a.proposta + a.validar + a.sem))
        .map(r => {
            const p = profDe(r.id);
            const pend = r.proposta + r.validar;
            return `
          <div class="fq-prof">
            <h3><span>🧑‍⚕️ ${esc(nomeProf(r.id))}</span>${pend ? `<span class="badge amarelo">${pend} a validar</span>` : '<span class="badge verde">em dia</span>'}</h3>
            <div class="nums">
              <span class="${r.proposta ? 'alerta' : ''}">propostas <b>${r.proposta}</b></span>
              <span class="${r.validar ? 'alerta' : ''}">a validar <b>${r.validar}</b></span>
              <span class="${r.sem ? 'erro' : ''}">sem preenchimento <b>${r.sem}</b></span>
              ${r.antiga ? `<span>mais antiga <b>${formataBR(r.antiga)}</b></span>` : ''}
            </div>
            <div class="acoes">
              ${podeValidar && r.proposta ? `<button class="argos-btn small primary" data-lote="proposta" data-prof="${r.id}">✔ Aprovar propostas</button>` : ''}
              ${podeValidar && r.validar ? `<button class="argos-btn small" data-lote="validar" data-prof="${r.id}">✔ Validar preenchidas</button>` : ''}
              ${podeCobrar && r.id && pend ? `<button class="argos-btn small ghost" data-cobrar="${r.id}" title="${p && p.telefone ? 'WhatsApp ' + esc(p.telefone) : 'Sem telefone no cadastro — vai pedir'}">📲 Cobrar validação</button>` : ''}
            </div>
          </div>`;
        }).join('');

    // a lista, por dia
    const alvo = el('fq-lista');
    if (!linhas.length) { alvo.innerHTML = '<p class="fq-vazio">Nenhuma sessão para conferir neste período. 🎉</p>'; return; }
    let html = '', diaAtual = '';
    for (const { s, sit } of linhas) {
        if (s.data !== diaAtual) {
            diaAtual = s.data;
            html += `<div class="fq-dia">${DOW_NOMES[paraData(s.data).getDay()]} ${formataBR(s.data)}</div>`;
        }
        const st = STATUS_SESSAO[s.status] || STATUS_SESSAO['??'];
        const prop = s.status_proposto ? STATUS_SESSAO[s.status_proposto] : null;
        const marca = marcaDeCamada(s, formataBR);
        html += `
        <div class="fq-linha ${sit === 'ok' ? 'validada' : ''}" data-chave="${esc(chaveDe(s))}">
          <div><b>${esc(s.hora)}</b></div>
          <div class="quem">${esc(nomePac(s.paciente_id))}<small>${esc(nomeProf(s.profissional_id))}${s.repasse_profissional_id && s.repasse_profissional_id !== s.profissional_id ? ` · paga a ${esc(nomeProf(s.repasse_profissional_id))}` : ''}</small></div>
          <div class="estado">
            oficial <span class="chip-status" style="--c:${st.cor}">${st.label}</span>
            ${prop && sit === 'proposta' ? `· proposta <span class="chip-status" style="--c:${prop.cor}">${prop.label}</span>` : ''}
            ${s.justificativa ? `· 📝 ${esc(s.justificativa)}` : ''}${sit === 'proposta' && s.justificativa_proposta ? `· 📝 ${esc(s.justificativa_proposta)}` : ''}
            ${marca ? `<br>${esc(marca)}` : sit === 'sem' ? '<br>⚠️ vencida sem preenchimento' : ''}
          </div>
          <div class="btns">
            ${podeValidar && sit === 'proposta' ? `<button class="argos-btn small primary" data-validar="1">✔ Aprovar ${prop.label}</button>` : ''}
            ${podeValidar && sit === 'validar' ? `<button class="argos-btn small primary" data-validar="1">✔ Validar</button>` : ''}
            ${podeOficial ? ['ok', 'fj', 'fc', 'nc'].map(k => `<button class="btn-status" style="--c:${STATUS_SESSAO[k].cor}" data-marcar="${k}" title="${STATUS_SESSAO[k].desc}">${STATUS_SESSAO[k].label}</button>`).join('') : ''}
          </div>
        </div>`;
    }
    alvo.innerHTML = html;
    perm.aplicarVisibilidade(document);
}

// ---------------------------------------------------------------- ações
async function validar(lista, rotulo) {
    if (!perm.pode('frequencia_validar')) { toast('Sem permissão para validar.', true); return; }
    const alvos = lista.filter(s => s.id);
    if (!alvos.length) { toast('Nada a validar.', true); return; }
    if (alvos.length > 1 && !confirm(`${rotulo} ${alvos.length} sessão(ões)?`)) return;
    const { erro, quantas } = await validarSessoes(sb, alvos);
    if (erro) { console.error(erro); toast('Erro ao validar.', true); return; }
    toast(`${quantas} sessão(ões) validada(s).`);
    await recarregarSessoes();
    avisarMudanca({ origem: 'frequencia', quantas });
}

async function marcar(s, status) {
    if (!perm.pode('frequencia_oficial')) { toast('Sem permissão para marcar a frequência oficial.', true); return; }
    let justificativa = s.justificativa || s.justificativa_proposta || null;
    if (status === 'fj') {
        const dispensa = perm.pode('sessao_fj_sem_justificativa');
        const j = prompt(dispensa ? 'Justificativa da falta (pode deixar em branco):' : 'Justificativa da falta (obrigatória):', justificativa || '');
        if (j === null) return;
        if (!j.trim() && !dispensa) { toast('A falta justificada precisa de uma justificativa.', true); return; }
        justificativa = j.trim() || null;
    }
    const { erro } = await gravarFrequencia(sb, [s], status, justificativa, { modo: 'oficial' });
    if (erro) { console.error(erro); toast('Erro ao marcar a sessão.', true); return; }
    if (status === 'fj') await registrarFaltasJustificadas(sb, [s], justificativa, formataBR);
    toast(`Sessão marcada: ${STATUS_SESSAO[status].label} — ${STATUS_SESSAO[status].desc}`);
    await recarregarSessoes();
    avisarMudanca({ origem: 'frequencia', quantas: 1 });
}

function textoCobranca(profId) {
    const p = profDe(profId);
    const minhas = linhas.filter(l => l.s.profissional_id === profId && l.sit !== 'ok');
    const prop = minhas.filter(l => l.sit === 'proposta'), val = minhas.filter(l => l.sit === 'validar'), sem = minhas.filter(l => l.sit === 'sem');
    const { de, ate } = periodo();
    const t = [`*Frequência a validar — ${p ? p.nome : ''}*`, `_Argos Gestão · ${formataBR(hojeISO())}_`, ''];
    t.push(`Olá, ${primeiroNome(p && p.nome)}! Entre ${formataBR(de)} e ${formataBR(ate)} ainda faltam *${prop.length + val.length}* sessão(ões) com a sua validação`
        + (prop.length ? ` (${prop.length} proposta(s) da recepção` + (val.length ? ` e ${val.length} já preenchida(s))` : ')') : '')
        + (sem.length ? `, e *${sem.length}* sem preenchimento nenhum.` : '.'));
    const lista = [...prop, ...val].slice(0, 25);
    if (lista.length) {
        t.push('');
        lista.forEach(l => t.push(`• ${formataBR(l.s.data)} ${l.s.hora} — ${nomePac(l.s.paciente_id)}${l.sit === 'proposta' ? ` (proposta ${STATUS_SESSAO[l.s.status_proposto].label})` : ''}`));
        if (prop.length + val.length > lista.length) t.push(`_(+${prop.length + val.length - lista.length})_`);
    }
    t.push('', `Para validar: ${location.origin}${location.pathname}`);
    return t.join('\n');
}

function textoRecepcao() {
    const sem = linhas.filter(l => l.sit === 'sem');
    const { de, ate } = periodo();
    const t = ['*Sessões sem preenchimento*', `_Argos Gestão · ${formataBR(hojeISO())}_`, '',
        `Entre ${formataBR(de)} e ${formataBR(ate)} há *${sem.length}* sessão(ões) vencida(s) ainda em «??»:`, ''];
    sem.slice(0, 40).forEach(l => t.push(`• ${formataBR(l.s.data)} ${l.s.hora} — ${nomePac(l.s.paciente_id)} (${nomeProf(l.s.profissional_id)})`));
    if (sem.length > 40) t.push(`_(+${sem.length - 40})_`);
    return t.join('\n');
}

async function cobrarProfissional(profId) {
    if (!perm.pode('frequencia_cobrar')) { toast('Sem permissão para cobrar.', true); return; }
    const p = profDe(profId);
    let fone = p && p.telefone;
    if (!fone) {
        fone = prompt(`WhatsApp de ${p ? p.nome : 'profissional'} (país, DDD e número). Fica salvo no cadastro.`) || '';
        const c = conferirFone(fone);
        if (!c.ok) { if (fone) toast(c.erro, true); return; }
        fone = c.fone;
        await sb.from('argos_profissionais').update({ telefone: fone }).eq('id', profId);
        if (p) p.telefone = fone;
    }
    const c = conferirFone(fone);
    if (!c.ok) { toast(c.erro, true); return; }
    window.open(linkWhatsApp(c.fone, textoCobranca(profId)), '_blank', 'noopener');
}

// ---------------------------------------------------------------- eventos
document.addEventListener('click', async (e) => {
    const per = e.target.closest('[data-periodo]');
    if (per) { definirPeriodo(per.dataset.periodo); render(); return; }
    const lote = e.target.closest('[data-lote]');
    if (lote) {
        const sit = lote.dataset.lote, prof = lote.dataset.prof;
        const lista = linhas.filter(l => l.sit === sit && (!prof || l.s.profissional_id === prof)).map(l => l.s);
        return validar(lista, sit === 'proposta' ? 'Aprovar as propostas de' : 'Validar');
    }
    const cob = e.target.closest('[data-cobrar]');
    if (cob) return cobrarProfissional(cob.dataset.cobrar);
    const linha = e.target.closest('.fq-linha');
    if (!linha) return;
    const s = chaves.get(linha.dataset.chave);
    if (!s) return;
    if (e.target.closest('[data-validar]')) return validar([s], 'Validar');
    const m = e.target.closest('[data-marcar]');
    if (m) return marcar(s, m.dataset.marcar);
});
['fq-de', 'fq-ate', 'fq-prof', 'fq-paciente', 'fq-so-pendentes'].forEach(id => el(id).addEventListener('change', render));
el('btn-cobrar-recepcao').addEventListener('click', () => {
    if (!perm.pode('frequencia_cobrar')) { toast('Sem permissão para cobrar.', true); return; }
    if (!linhas.some(l => l.sit === 'sem')) { toast('Não há sessões sem preenchimento no período.', true); return; }
    const c = conferirFone(el('fq-fone-recepcao').value);
    if (!c.ok) { toast(c.erro, true); el('fq-fone-recepcao').focus(); return; }
    try { localStorage.setItem('argos_pend_fone', c.fone); } catch (x) {}
    window.open(linkWhatsApp(c.fone, textoRecepcao()), '_blank', 'noopener');
});
ouvirMudancas(d => { if (d.origem !== 'frequencia') recarregarSessoes(); });

(async function init() {
    perm = await carregarPermissoes();
    if (!perm.exigirPagina('frequencia_pagina', 'a conferência de frequência')) return;
    configurarFrequencia(perm);
    perm.aplicarVisibilidade();
    const mes = new URLSearchParams(location.search).get('mes');
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
        const hoje = hojeISO();
        el('fq-de').value = mes + '-01';
        el('fq-ate').value = fimDoMes(mes) > hoje ? hoje : fimDoMes(mes);
    } else definirPeriodo('mes');
    try { el('fq-fone-recepcao').value = localStorage.getItem('argos_pend_fone') || ''; } catch (e) {}
    await carregarTudo();
})();
