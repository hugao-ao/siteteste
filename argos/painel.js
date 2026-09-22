// painel.js — Meu painel (o profissional)
// ========================================
// A mesma conta da produção e do acerto, recortada para uma pessoa só:
// quanto o mês já rendeu, quanto ainda está agendado, a média por sessão,
// quantos atendimentos faltam para uma meta, quem está devendo (e vai
// gerar retenção), o que já está retido, e as evoluções por fazer.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    formataMoeda, formataBR, hojeISO, fechamentoPaciente, definirRepassePadrao, repassesDe, fimDoMes
} from './argos-recorrencia.js';
import { producaoDoMes } from './argos-producao.js';
import { atendimentosDoProfissional } from './argos-validacao.js';
import { mesBR, fatorNFDoMes } from './argos-cobranca.js';
import { cobradoPorPaciente, valorDoMes } from './argos-fechamento.js';
import { usarFechamento, abertoPorPaciente, retencoesSugeridas, mesAnterior, mesCurto, agruparPorPaciente } from './argos-repasses.js';
import { pacientesDoProfissional } from './argos-escopo.js';
import { pendenciasDeEvolucao, contarPendenciasEv, emAtendimento } from './argos-evolucao-pendencias.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true, escopo: { geral: true } };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], ajustes = [], notasMes = [];
let alocacoes = [], retencoes = [], grupos = [], grupoMembros = [], grupoProfs = [];
let avaliacoes = [], comAnamnese = new Set();
let profId = null;
const producaoCache = new Map();
const el = id => document.getElementById(id);
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '—';

usarFechamento((p, dins, sess, mes) => {
    const fech = fechamentoPaciente(p, dins, sess, mes);
    const ajuste = ajustes.find(a => a.paciente_id === p.id && a.mes === mes) || null;
    return { valor: valorDoMes({ fech, ajuste }).valor };
});
const baixasComoRecebido = () => ajustes.filter(a => Number(a.baixa_valor) > 0)
    .map(a => ({ vinculo_tipo: 'paciente', vinculo_id: a.paciente_id, mes_ref: a.mes, valor: Number(a.baixa_valor) }));

function producaoDe(mes) {
    if (!producaoCache.has(mes)) {
        producaoCache.set(mes, producaoDoMes({
            pacientes, dinamicas, sessoes, profissionais, presencas: [], mes,
            notaFator: fatorNFDoMes({ pacientes, dinamicas, excecoes: notasMes, mes }),
            cobrado: cobradoPorPaciente(ajustes, mes)
        }));
    }
    return producaoCache.get(mes);
}
function atendimentosDe(mes) {
    return atendimentosDoProfissional({
        profissional_id: profId, mes, pacientes, dinamicas, sessoes, profissionais,
        notaFator: fatorNFDoMes({ pacientes, dinamicas, excecoes: notasMes, mes }),
        cobrado: cobradoPorPaciente(ajustes, mes)
    });
}

// ---------------------------------------------------------------- carga
async function carregarTudo() {
    const [rPac, rDin, rSes, rProf, rAj, rNM, rAloc, rGru, rMem, rGP] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_cobranca_mes').select('*')),
        todas(() => sb.from('argos_nota_mes').select('*')),
        todas(() => sb.from('argos_mov_alocacoes').select('*')),
        sb.from('argos_grupos').select('*'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error;
    if (erro) { console.error(erro); toast('Erro ao carregar o painel.', true); return false; }
    pacientes = rPac.data || []; dinamicas = rDin.data || []; sessoes = rSes.data || [];
    profissionais = rProf.data || []; ajustes = rAj.data || []; notasMes = rNM.data || [];
    alocacoes = rAloc.data || []; grupos = rGru.data || []; grupoMembros = rMem.data || []; grupoProfs = rGP.data || [];
    definirRepassePadrao(profissionais);
    return true;
}

async function carregarDoProfissional() {
    const meus = [...meusPacientesAtivos().map(p => p.id)];
    const [rRet, rAv, rAn] = await Promise.all([
        sb.from('argos_repasse_retencoes').select('*').eq('profissional_id', profId),
        meus.length ? sb.from('argos_ev_avaliacoes').select('*').in('paciente_id', meus) : { data: [] },
        meus.length ? sb.from('argos_anamnese_respostas').select('paciente_id').in('paciente_id', meus) : { data: [] }
    ]);
    retencoes = rRet.data || []; avaliacoes = rAv.data || [];
    comAnamnese = new Set((rAn.data || []).map(r => r.paciente_id));
}

/** Pacientes em atendimento com este profissional: dinâmica/grupo ativo dele. */
function meusPacientesAtivos() {
    const hoje = hojeISO();
    const dinsAtivas = dinamicas.filter(d => d.ativo !== false);
    const ids = pacientesDoProfissional(profId, { dinamicas: dinsAtivas, sessoes: [], grupos: grupos.filter(g => g.ativo !== false), grupoMembros, grupoProfs });
    return emAtendimento(pacientes.filter(p => ids.has(p.id)), hoje);
}

// ---------------------------------------------------------------- render
function render() {
    const mes = el('pn-mes').value || hojeISO().slice(0, 7);
    const hoje = hojeISO();
    const prof = profissionais.find(p => p.id === profId);
    el('pn-titulo').textContent = `📌 ${perm.escopo.geral ? 'Painel de ' + (prof ? prof.nome : '—') : 'Meu painel'} — ${mesBR(mes)}`;

    if (perm.pode('painel_financeiro')) renderFinanceiro(mes, hoje, prof);
    renderEvolucoes(hoje);
    renderFrequencia(mes, hoje);
    perm.aplicarVisibilidade(document);
    el('pn-carregando').textContent = '';
}

let sim = { fixo: 0, realizado: 0, media: 0, agendadas: 0, projecao: 0 };

function renderFinanceiro(mes, hoje, prof) {
    const prod = producaoDe(mes).porProfissional.find(c => c.profissional.id === profId)
        || { fixo: 0, producao: 0, total: 0, detalhePorPaciente: {} };
    const at = atendimentosDe(mes);
    const feitas = at.filter(l => l.contabiliza && l.data <= hoje);
    const realizado = feitas.reduce((s, l) => s + l.valor, 0);
    const projecao = prod.total;
    const restante = Math.max(0, projecao - prod.fixo - realizado);
    // sessões ainda por vir: projeção das dinâmicas em que ele recebe
    let agendadas = 0;
    for (const p of pacientes) {
        const dins = dinamicas.filter(d => d.paciente_id === p.id);
        if (!dins.some(d => repassesDe(d).some(r => r.profissional_id === profId) || d.profissional_id === profId)) continue;
        const f = fechamentoPaciente(p, dins, sessoes.filter(s => s.paciente_id === p.id), mes);
        agendadas += f.sessoes.filter(s => s.status === '??' && s.data > hoje
            && (s.profissional_id === profId || (dins.find(d => d.id === s.dinamica_ref) && repassesDe(dins.find(d => d.id === s.dinamica_ref)).some(r => r.profissional_id === profId)))).length;
    }
    // médias dos 3 meses anteriores
    const hist = [];
    let m = mesAnterior(mes);
    for (let i = 0; i < 3; i++) { hist.push(m); m = mesAnterior(m); }
    const histDados = hist.map(h => {
        const a = atendimentosDe(h).filter(l => l.contabiliza);
        const pr = producaoDe(h).porProfissional.find(c => c.profissional.id === profId);
        return { mes: h, sessoes: a.length, valor: pr ? pr.total : 0, producao: pr ? pr.producao : 0 };
    }).filter(h => h.sessoes || h.valor);
    const mediaSessoesMes = histDados.length ? histDados.reduce((s, h) => s + h.sessoes, 0) / histDados.length : 0;
    const mediaRepasseMes = histDados.length ? histDados.reduce((s, h) => s + h.valor, 0) / histDados.length : 0;
    const somaHistSess = histDados.reduce((s, h) => s + h.sessoes, 0);
    const mediaSessaoHist = somaHistSess ? histDados.reduce((s, h) => s + h.producao, 0) / somaHistSess : 0;
    const mediaSessao = feitas.length ? realizado / feitas.length : mediaSessaoHist;
    sim = { fixo: prod.fixo, realizado, media: mediaSessao, agendadas, projecao };

    el('pn-kpis').innerHTML = `
      <div class="pn-kpi destaque"><div class="rot">Repasse projetado de ${esc(mesBR(mes))}</div>
        <div class="val">${formataMoeda(projecao)}</div>
        <div class="sub">se tudo que está agendado acontecer${prod.fixo ? ` · inclui fixo de ${formataMoeda(prod.fixo)}` : ''}. Atualiza a cada frequência confirmada.</div></div>
      <div class="pn-kpi"><div class="rot">Já realizado até hoje</div>
        <div class="val">${formataMoeda(realizado + prod.fixo)}</div>
        <div class="sub">${feitas.length} sessão(ões) contabilizada(s)${prod.fixo ? ' + fixo' : ''}</div></div>
      <div class="pn-kpi"><div class="rot">Ainda agendado no mês</div>
        <div class="val">${agendadas}</div>
        <div class="sub">sessão(ões) até ${formataBR(fimDoMes(mes))} · ≈ ${formataMoeda(restante)}</div></div>
      <div class="pn-kpi"><div class="rot">Valor médio por sessão</div>
        <div class="val">${formataMoeda(mediaSessao)}</div>
        <div class="sub">${feitas.length ? 'neste mês' : 'pelos meses anteriores'}, já descontada a nota fiscal quando há</div></div>
      <div class="pn-kpi"><div class="rot">Média dos últimos ${histDados.length || 3} meses</div>
        <div class="val">${Math.round(mediaSessoesMes)} <small style="font-size:.9rem;font-weight:600">atend./mês</small></div>
        <div class="sub">${formataMoeda(mediaRepasseMes)} de repasse por mês${histDados.length ? ` (${histDados.map(h => mesCurto(h.mes)).join(', ')})` : ''}</div></div>`;
    renderSimulador();

    // pendências que vão gerar retenção no acerto do mês que vem
    const aberto = abertoPorPaciente({ pacientes, dinamicas, sessoes, alocacoes: alocacoes.concat(baixasComoRecebido()), ate: mes });
    const meses = new Set();
    for (const linhas of aberto.values()) for (const l of linhas) if (l.aberto > 0.01 && l.mes <= mes) meses.add(l.mes);
    const producaoPorMes = {};
    for (const mm of meses) producaoPorMes[mm] = producaoDe(mm);
    const chave = r => `${r.profissional_id}|${r.paciente_id}|${r.mes_producao}`;
    const jaTem = new Set(retencoes.map(chave));
    // o acerto deste mês (pago no mês que vem) retém os meses vencidos até o anterior
    const sug = retencoesSugeridas({ producaoPorMes, aberto, pacientes, mes })
        .filter(r => r.profissional_id === profId && !jaTem.has(chave(r)));
    const grupos = agruparPorPaciente(sug);
    el('pn-ret-prev-qtd').textContent = grupos.length ? `${grupos.length} paciente(s) · ${formataMoeda(sug.reduce((s, r) => s + r.valor, 0))}` : '';
    el('pn-ret-prev').innerHTML = grupos.length ? grupos.map(g => `
      <div class="pn-item"><span class="quem">${esc(nomePac(g.paciente_id))}<small>em aberto: ${g.meses.map(mesCurto).join(', ')}</small></span>
        <span class="num" style="color:var(--argos-warn)">− ${formataMoeda(g.valor)}</span></div>`).join('')
      : '<p class="pn-vazio">Nenhum paciente seu com mês vencido em aberto. 🎉</p>';

    const retidas = retencoes.filter(r => r.status === 'retido');
    const gruposRet = agruparPorPaciente(retidas);
    el('pn-ret-qtd').textContent = retidas.length ? formataMoeda(retidas.reduce((s, r) => s + (Number(r.valor) || 0), 0)) : '';
    el('pn-retidos').innerHTML = gruposRet.length ? gruposRet.map(g => `
      <div class="pn-item"><span class="quem">${esc(nomePac(g.paciente_id))}<small>retido: ${g.meses.map(mesCurto).join(', ')}</small></span>
        <span class="num">${formataMoeda(g.valor)}</span></div>`).join('')
      : '<p class="pn-vazio">Nada retido no momento.</p>';
}

function renderSimulador() {
    const meta = Number(el('pn-meta').value) || 0;
    const r = el('pn-sim-res');
    if (!meta) { r.innerHTML = `<span class="dim">Digite um valor para ver quantos atendimentos faltam. Média por sessão: <b>${formataMoeda(sim.media)}</b>.</span>`; return; }
    const jaTem = sim.realizado + sim.fixo;
    if (meta <= jaTem) { r.innerHTML = `✅ Meta de <b>${formataMoeda(meta)}</b> já alcançada: o realizado até hoje é <b class="ok">${formataMoeda(jaTem)}</b>.`; return; }
    if (!sim.media) { r.innerHTML = 'Sem valor médio por sessão ainda (nenhuma sessão contabilizada) — não dá para simular.'; return; }
    const faltam = Math.ceil((meta - jaTem) / sim.media);
    const dif = faltam - sim.agendadas;
    r.innerHTML = `Para receber <b>${formataMoeda(meta)}</b> faltam <b class="${dif > 0 ? 'alerta' : 'ok'}">${faltam} atendimento(s)</b> contabilizados até o fim do mês
      (você tem <b>${sim.agendadas}</b> agendado(s)${dif > 0 ? `: precisa de mais <b class="alerta">${dif}</b> além da agenda` : ': a agenda de hoje já cobre'}).
      <span class="dim">Conta feita com a média de ${formataMoeda(sim.media)} por sessão; faltas contabilizadas também contam.</span>`;
}

function renderEvolucoes(hoje) {
    if (!perm.pode('painel_evolucoes')) return;
    const meus = meusPacientesAtivos();
    const lista = pendenciasDeEvolucao({ pacientes: meus, avaliacoes, comAnamnese, hoje });
    const c = contarPendenciasEv(lista);
    el('pn-ev-qtd').textContent = c.total ? `${c.total} em ${c.pacientes} paciente(s)` : '';
    el('pn-evolucoes').innerHTML = lista.length ? lista.map(i => `
      <div class="pn-item"><span class="quem">${i.icone} ${esc(i.paciente.nome)}<small>${esc(i.rotulo)} — ${esc(i.detalhe)}</small></span>
        <a class="argos-btn small primary" href="${i.link}">Preencher →</a></div>`).join('')
      : `<p class="pn-vazio">${meus.length ? 'Todas as evoluções dos seus pacientes estão em dia. 🎉' : 'Nenhum paciente em atendimento com este profissional.'}</p>`;
}

function renderFrequencia(mes, hoje) {
    const minhas = sessoes.filter(s => s.data >= mes + '-01' && s.data <= hoje
        && (s.profissional_id === profId || s.repasse_profissional_id === profId) && !s.validado_em
        && (s.status_proposto || (s.status && s.status !== '??')));
    const prop = minhas.filter(s => s.status_proposto).length;
    el('pn-freq-qtd').textContent = minhas.length ? String(minhas.length) : '';
    el('pn-freq').innerHTML = minhas.length
        ? `<p>${minhas.length} sessão(ões) de ${esc(mesBR(mes))} aguardando a sua validação${prop ? ` (${prop} proposta(s) da recepção)` : ''}.
           <a class="argos-btn small primary" href="frequencia.html?mes=${mes}${perm.escopo.geral ? `&profissional=${profId}` : ''}">Conferir →</a></p>`
        : '<p class="pn-vazio">Frequência em dia. ✔</p>';
}

// ---------------------------------------------------------------- eventos
el('pn-mes').addEventListener('change', render);
el('pn-meta').addEventListener('input', renderSimulador);
el('pn-prof').addEventListener('change', async () => {
    profId = el('pn-prof').value; el('pn-carregando').textContent = 'Calculando…';
    await carregarDoProfissional(); render();
});

(async function init() {
    perm = await carregarPermissoes();
    if (!perm.exigirPagina('painel_pagina', 'o painel')) return;
    perm.aplicarVisibilidade();
    el('pn-mes').value = hojeISO().slice(0, 7);
    if (!(await carregarTudo())) return;
    const sel = el('pn-prof');
    if (perm.escopo.geral) {
        sel.innerHTML = profissionais.map(p => `<option value="${p.id}">🧑‍⚕️ ${esc(p.nome)}</option>`).join('');
        const pedido = new URLSearchParams(location.search).get('profissional');
        profId = (pedido && profissionais.some(p => p.id === pedido)) ? pedido : (perm.escopo.profissionalId || (profissionais[0] || {}).id);
        sel.value = profId;
    } else {
        profId = perm.escopo.profissionalId;
        sel.innerHTML = `<option value="${profId}">🧑‍⚕️ ${esc((profissionais.find(p => p.id === profId) || {}).nome || '')}</option>`;
        sel.disabled = true;
    }
    if (!profId) { el('pn-carregando').textContent = 'Nenhum profissional vinculado a este usuário.'; return; }
    el('pn-carregando').textContent = 'Calculando…';
    await carregarDoProfissional();
    render();
})();
