// agenda.js — Card "Agenda e Logística" da área Argos
// Agenda semanal geral e por espaço, preenchida pelas dinâmicas financeiras;
// lista de sessões vencidas «??» para marcar Ok/Fj/Fc/Nc.

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    STATUS_SESSAO, DOW_NOMES, mesclarSessoes, hojeISO, somarDias, paraData,
    paraISO, formataBR, fimDoMes
} from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], salas = [], profissionais = [], dinamicas = [], sessoes = [];
let segunda = segundaDaSemana(hojeISO()); // início da semana exibida
let sessaoAberta = null;                  // sessão do modal de marcação

function segundaDaSemana(iso) {
    const dow = paraData(iso).getDay();
    return somarDias(iso, -((dow + 6) % 7));
}

const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '(paciente?)';
const nomeSala = id => (salas.find(s => s.id === id) || {}).nome || 'Sem espaço';
const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';

async function carregarTudo() {
    const [rPac, rSalas, rProf, rDin, rSes] = await Promise.all([
        sb.from('argos_pacientes').select('id, nome, cadastro_removido').order('nome'),
        sb.from('argos_salas').select('*').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*')
    ]);
    const erro = rPac.error || rSalas.error || rProf.error || rDin.error || rSes.error;
    if (erro) { console.error(erro); toast('Erro ao carregar a agenda.', true); return; }
    pacientes = rPac.data || [];
    salas = rSalas.data || [];
    profissionais = rProf.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    montarFiltroSalas();
    renderTudo();
}

function montarFiltroSalas() {
    const sel = document.getElementById('filtro-sala');
    const atual = sel.value;
    sel.innerHTML = '<option value="geral">🏥 Agenda geral (todos os espaços)</option>' +
        salas.map(s => `<option value="${s.id}">🚪 ${esc(s.nome)}</option>`).join('') +
        '<option value="sem">Sem espaço definido</option>';
    if (atual) sel.value = atual;
    if (!sel.value) sel.value = 'geral';

    const selP = document.getElementById('filtro-prof');
    const atualP = selP.value || new URLSearchParams(location.search).get('profissional') || '';
    selP.innerHTML = '<option value="todos">🧑‍⚕️ Todos os profissionais</option>' +
        profissionais.map(p => `<option value="${p.id}">🧑‍⚕️ ${esc(p.nome)}</option>`).join('');
    if (atualP) selP.value = atualP;
    if (!selP.value) selP.value = 'todos';
}

function renderTudo() { renderAgenda(); renderAvisoPendentes(); }

// ---------- pendências (sessões vencidas «??») ----------
function sessoesPendentes() {
    const hoje = hojeISO();
    const inicio = dinamicas.map(d => d.data_inicio).filter(Boolean).sort()[0];
    const deSessoes = sessoes.map(s => s.data).sort()[0];
    const de = [inicio, deSessoes].filter(Boolean).sort()[0];
    if (!de) return [];
    return mesclarSessoes(dinamicas, sessoes, de, somarDias(hoje, -1))
        .filter(s => s.status === '??');
}

function renderAvisoPendentes() {
    const pend = sessoesPendentes();
    const aviso = document.getElementById('aviso-pendentes');
    if (!pend.length || !perm.pode('sessoes_status')) { aviso.style.display = 'none'; return; }
    aviso.style.display = '';
    document.getElementById('aviso-pendentes-texto').textContent =
        `⚠️ ${pend.length} sessão(ões) já vencida(s) aguardando preenchimento da frequência.`;
}

document.getElementById('btn-abrir-pendentes').addEventListener('click', () => {
    renderPendentes(); abrirModal('modal-pendentes');
});

function renderPendentes() {
    const pend = sessoesPendentes();
    document.getElementById('lista-pendentes').innerHTML = pend.map(s => `
      <div class="argos-bloco pendente-linha" data-chave="${chaveSessao(s)}">
        <div class="bloco-info">
          <b>${formataBR(s.data)} ${s.hora}</b> — ${esc(nomePac(s.paciente_id))}<br>
          <span class="dim">${esc(nomeSala(s.sala_id))} · ${esc(nomeProf(s.profissional_id))}</span>
        </div>
        <div class="botoes-status compacto">
          ${['ok', 'fj', 'fc', 'nc'].map(st => `
            <button class="btn-status" style="--c:${STATUS_SESSAO[st].cor}" data-marcar="${st}" title="${STATUS_SESSAO[st].desc}">${STATUS_SESSAO[st].label}</button>`).join('')}
        </div>
      </div>`).join('') || '<p class="dim">Nenhuma pendência. 🎉</p>';
}

const chaves = new Map(); // chave -> objeto sessão (para achar no clique)
function chaveSessao(s) {
    const k = s.id || `${s.dinamica_ref}|${s.data}|${s.hora}`;
    chaves.set(k, s);
    return k;
}

document.getElementById('lista-pendentes').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-marcar]');
    if (!btn) return;
    const linha = btn.closest('[data-chave]');
    const s = chaves.get(linha.dataset.chave);
    if (!s) return;
    await marcarSessao(s, btn.dataset.marcar);
    renderPendentes();
});

// ---------- marcação (materializa a projeção se preciso) ----------
async function marcarSessao(s, status) {
    if (!perm.pode('sessoes_status')) { toast('Sem permissão para marcar frequência.', true); return; }
    let error;
    if (s.id) {
        ({ error } = await sb.from('argos_sessoes').update({ status }).eq('id', s.id));
    } else {
        ({ error } = await sb.from('argos_sessoes').insert({
            paciente_id: s.paciente_id, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
            data: s.data, hora: s.hora, duracao_min: s.duracao_min || 60,
            sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
            servico_id: s.servico_id || null, status
        }));
    }
    if (error) { console.error(error); toast('Erro ao marcar sessão.', true); return; }
    toast(`Sessão marcada: ${STATUS_SESSAO[status].label} — ${STATUS_SESSAO[status].desc}`);
    const { data } = await sb.from('argos_sessoes').select('*');
    sessoes = data || sessoes;
    renderTudo();
}

// ---------- visões: semana, mês e período (máx. 365 dias) ----------
let modo = 'semana';
let mesRef = hojeISO().slice(0, 7);
let periodo = { de: hojeISO(), ate: somarDias(hojeISO(), 29) };

const MES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mudarMes(mes, delta) {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

document.getElementById('modo-visao').addEventListener('change', (e) => {
    modo = e.target.value;
    document.getElementById('controles-navegacao').style.display = modo === 'periodo' ? 'none' : '';
    document.getElementById('controles-periodo').style.display = modo === 'periodo' ? '' : 'none';
    if (modo === 'periodo') {
        document.getElementById('periodo-de').value = periodo.de;
        document.getElementById('periodo-ate').value = periodo.ate;
    }
    renderAgenda();
});
document.getElementById('btn-ant').addEventListener('click', () => {
    if (modo === 'semana') segunda = somarDias(segunda, -7);
    if (modo === 'mes') mesRef = mudarMes(mesRef, -1);
    renderAgenda();
});
document.getElementById('btn-prox').addEventListener('click', () => {
    if (modo === 'semana') segunda = somarDias(segunda, 7);
    if (modo === 'mes') mesRef = mudarMes(mesRef, 1);
    renderAgenda();
});
document.getElementById('btn-hoje').addEventListener('click', () => {
    segunda = segundaDaSemana(hojeISO());
    mesRef = hojeISO().slice(0, 7);
    renderAgenda();
});
document.getElementById('btn-aplicar-periodo').addEventListener('click', () => {
    const de = document.getElementById('periodo-de').value;
    const ate = document.getElementById('periodo-ate').value;
    if (!de || !ate) { toast('Informe as duas datas do período.', true); return; }
    if (ate < de) { toast('A data final deve ser igual ou depois da inicial.', true); return; }
    const dias = Math.round((paraData(ate) - paraData(de)) / 86400000) + 1;
    if (dias > 365) { toast('O período pode ter no máximo 365 dias.', true); return; }
    periodo = { de, ate };
    renderAgenda();
});
document.getElementById('filtro-sala').addEventListener('change', renderAgenda);
document.getElementById('filtro-prof').addEventListener('change', renderAgenda);

function sessoesDoIntervalo(de, ate) {
    const filtro = document.getElementById('filtro-sala').value;
    const filtroProf = document.getElementById('filtro-prof').value;
    let lista = mesclarSessoes(dinamicas, sessoes, de, ate);
    if (filtro === 'sem') lista = lista.filter(s => !s.sala_id);
    else if (filtro !== 'geral') lista = lista.filter(s => s.sala_id === filtro);
    if (filtroProf && filtroProf !== 'todos') lista = lista.filter(s => s.profissional_id === filtroProf);
    return lista;
}

// conflitos: mesmo espaço + mesmo horário + pacientes diferentes, com alguma individual
function detectorConflito(lista) {
    const porSlot = {};
    lista.forEach(s => {
        const k = `${s.sala_id || 'x'}|${s.data}|${s.hora}`;
        (porSlot[k] = porSlot[k] || []).push(s);
    });
    return s => {
        const grupo = porSlot[`${s.sala_id || 'x'}|${s.data}|${s.hora}`];
        return grupo.length > 1 && new Set(grupo.map(g => g.paciente_id)).size > 1
            && grupo.some(g => g.modalidade === 'individual');
    };
}

function chipSessao(s, conflita, compacta) {
    const hoje = hojeISO();
    const vencida = s.status === '??' && s.data < hoje;
    const titulo = `${nomePac(s.paciente_id)} · ${nomeSala(s.sala_id)} · ${nomeProf(s.profissional_id)}${conflita(s) ? ' · ⚠️ CONFLITO de espaço/horário' : ''}`;
    return `
      <div class="agenda-chip ${compacta ? 'compacta' : ''} ${vencida ? 'vencida' : ''} ${conflita(s) ? 'conflito' : ''}"
           style="--c:${STATUS_SESSAO[s.status].cor}" data-chave="${chaveSessao(s)}" title="${esc(titulo)}">
        <b>${s.hora}</b> ${esc(nomePac(s.paciente_id))}
        ${compacta ? '' : `<div class="chip-sub">${esc(nomeSala(s.sala_id))}${s.modalidade === 'grupo' ? ' · 👥' : ''} · <span class="chip-status" style="--c:${STATUS_SESSAO[s.status].cor}">${STATUS_SESSAO[s.status].label}</span>${conflita(s) ? ' ⚠️' : ''}</div>`}
      </div>`;
}

function renderAgenda() {
    const grade = document.getElementById('agenda-grade');
    const listaPer = document.getElementById('agenda-periodo');
    grade.style.display = modo === 'periodo' ? 'none' : '';
    listaPer.style.display = modo === 'periodo' ? '' : 'none';
    if (modo === 'semana') renderSemana();
    else if (modo === 'mes') renderMes();
    else renderPeriodo();
}

function renderSemana() {
    const fim = somarDias(segunda, 6);
    document.getElementById('rotulo-intervalo').textContent = `${formataBR(segunda)} — ${formataBR(fim)}`;
    const hoje = hojeISO();
    const grade = document.getElementById('agenda-grade');
    grade.classList.remove('mes');
    const lista = sessoesDoIntervalo(segunda, fim);
    const conflita = detectorConflito(lista);

    grade.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const iso = somarDias(segunda, i);
        const doDia = lista.filter(s => s.data === iso);
        return `
        <div class="agenda-dia ${iso === hoje ? 'hoje' : ''}">
          <div class="agenda-dia-titulo">${DOW_NOMES[paraData(iso).getDay()]} <span>${iso.slice(8)}/${iso.slice(5, 7)}</span></div>
          ${doDia.map(s => chipSessao(s, conflita, false)).join('') || '<div class="dim agenda-vazio">—</div>'}
        </div>`;
    }).join('');
}

function renderMes() {
    const de = mesRef + '-01';
    const ate = fimDoMes(mesRef);
    const [a, m] = mesRef.split('-').map(Number);
    document.getElementById('rotulo-intervalo').textContent = `${MES_NOMES[m - 1]} de ${a}`;
    const hoje = hojeISO();
    const grade = document.getElementById('agenda-grade');
    grade.classList.add('mes');
    const lista = sessoesDoIntervalo(de, ate);
    const conflita = detectorConflito(lista);

    const inicioGrade = segundaDaSemana(de);
    const fimGrade = somarDias(segundaDaSemana(ate), 6);
    const cabecalho = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        .map(n => `<div class="agenda-cabecalho">${n}</div>`).join('');

    let celulas = '';
    for (let iso = inicioGrade; iso <= fimGrade; iso = somarDias(iso, 1)) {
        const fora = iso < de || iso > ate;
        const doDia = fora ? [] : lista.filter(s => s.data === iso);
        celulas += `
        <div class="agenda-dia mes-dia ${fora ? 'fora' : ''} ${iso === hoje ? 'hoje' : ''}">
          <div class="agenda-dia-titulo">${Number(iso.slice(8))}</div>
          ${doDia.map(s => chipSessao(s, conflita, true)).join('')}
        </div>`;
    }
    grade.innerHTML = cabecalho + celulas;
}

function renderPeriodo() {
    const { de, ate } = periodo;
    const dias = Math.round((paraData(ate) - paraData(de)) / 86400000) + 1;
    const lista = sessoesDoIntervalo(de, ate);
    const conflita = detectorConflito(lista);
    document.getElementById('rotulo-intervalo').textContent =
        `${formataBR(de)} — ${formataBR(ate)} (${dias} dia(s), ${lista.length} sessão(ões))`;

    const porData = {};
    lista.forEach(s => { (porData[s.data] = porData[s.data] || []).push(s); });
    const datas = Object.keys(porData).sort();
    const hoje = hojeISO();

    document.getElementById('agenda-periodo').innerHTML = datas.map(iso => `
      <div class="periodo-dia ${iso === hoje ? 'hoje' : ''}">
        <div class="periodo-data">${DOW_NOMES[paraData(iso).getDay()]} · ${formataBR(iso)}</div>
        <div class="periodo-chips">${porData[iso].map(s => chipSessao(s, conflita, false)).join('')}</div>
      </div>`).join('')
      || '<div class="argos-tabela-vazia">Nenhuma sessão neste período.</div>';
}

function aoClicarSessao(e) {
    const chip = e.target.closest('[data-chave]');
    if (!chip) return;
    const s = chaves.get(chip.dataset.chave);
    if (!s || !perm.pode('sessoes_status')) return;
    sessaoAberta = s;
    document.getElementById('sessao-info').innerHTML =
        `<b>${formataBR(s.data)} ${s.hora}</b> — ${esc(nomePac(s.paciente_id))}<br>
         <span class="dim">${esc(nomeSala(s.sala_id))} · ${esc(nomeProf(s.profissional_id))} · situação atual:
         <span class="chip-status" style="--c:${STATUS_SESSAO[s.status].cor}">${STATUS_SESSAO[s.status].label}</span></span>`;
    document.getElementById('botoes-status').innerHTML =
        ['??', 'ok', 'fj', 'fc', 'nc'].map(st => `
          <button class="btn-status" style="--c:${STATUS_SESSAO[st].cor}" data-marcar="${st}">
            ${STATUS_SESSAO[st].label}<small>${STATUS_SESSAO[st].desc}</small></button>`).join('');
    abrirModal('modal-sessao');
}
document.getElementById('agenda-grade').addEventListener('click', aoClicarSessao);
document.getElementById('agenda-periodo').addEventListener('click', aoClicarSessao);

document.getElementById('botoes-status').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-marcar]');
    if (!btn || !sessaoAberta) return;
    await marcarSessao(sessaoAberta, btn.dataset.marcar);
    fecharModal('modal-sessao');
});

// ---------- espaços (salas) ----------
document.getElementById('btn-salas').addEventListener('click', () => { renderSalas(); abrirModal('modal-salas'); });

function renderSalas() {
    document.getElementById('lista-salas').innerHTML = salas.map(s => `
      <div class="argos-bloco">
        <div class="bloco-topo"><b>${esc(s.nome)}</b>
          <span>
            <button class="argos-btn small" data-sala-ren="${s.id}">✏️</button>
            <button class="argos-btn small danger" data-sala-del="${s.id}">🗑️</button>
          </span>
        </div>
      </div>`).join('') || '<p class="dim">Nenhum espaço cadastrado.</p>';
}

document.getElementById('lista-salas').addEventListener('click', async (e) => {
    const ren = e.target.closest('[data-sala-ren]');
    const del = e.target.closest('[data-sala-del]');
    if (ren) {
        const s = salas.find(x => x.id === ren.dataset.salaRen);
        const nome = prompt('Novo nome do espaço:', s.nome);
        if (!nome || !nome.trim()) return;
        const { error } = await sb.from('argos_salas').update({ nome: nome.trim() }).eq('id', s.id);
        if (error) { toast(error.code === '23505' ? 'Já existe um espaço com esse nome.' : 'Erro ao renomear.', true); return; }
        await carregarTudo(); renderSalas();
    }
    if (del) {
        const s = salas.find(x => x.id === del.dataset.salaDel);
        if (!confirm(`Excluir o espaço "${s.nome}"?\nAs sessões e dinâmicas que o usavam ficarão sem espaço definido.`)) return;
        const { error } = await sb.from('argos_salas').delete().eq('id', s.id);
        if (error) { toast('Erro ao excluir espaço.', true); return; }
        await carregarTudo(); renderSalas();
    }
});

document.getElementById('form-sala').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('sala-nome').value.trim();
    if (!nome) return;
    const { error } = await sb.from('argos_salas').insert({ nome });
    if (error) { toast(error.code === '23505' ? 'Já existe um espaço com esse nome.' : 'Erro ao adicionar.', true); return; }
    document.getElementById('sala-nome').value = '';
    await carregarTudo(); renderSalas();
});

// ---------- início ----------
(async function init() {
    perm = await carregarPermissoes();
    perm.aplicarVisibilidade();
    await carregarTudo();
})();
