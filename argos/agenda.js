// agenda.js — Card "Agenda e Logística" da área Argos
// Agenda semanal geral e por espaço, preenchida pelas dinâmicas financeiras;
// lista de sessões vencidas «??» para marcar Ok/Fj/Fc/Nc.

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    STATUS_SESSAO, DOW_NOMES, mesclarSessoes, hojeISO, somarDias, paraData,
    paraISO, formataBR, fimDoMes, expandirDinamica, conflitosDeSessao,
    conflitosDeDinamica
} from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], salas = [], profissionais = [], dinamicas = [], sessoes = [];
let grupos = [], grupoMembros = [], grupoProfs = [];
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
    const [rPac, rSalas, rProf, rDin, rSes, rGru, rMem, rGP] = await Promise.all([
        sb.from('argos_pacientes').select('id, nome, ativo, cadastro_removido').order('nome'),
        sb.from('argos_salas').select('*').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*'),
        sb.from('argos_grupos').select('*').order('hora'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*')
    ]);
    const erro = rPac.error || rSalas.error || rProf.error || rDin.error || rSes.error || rGru.error || rMem.error || rGP.error;
    if (erro) { console.error(erro); toast('Erro ao carregar a agenda.', true); return; }
    pacientes = rPac.data || [];
    salas = rSalas.data || [];
    profissionais = rProf.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    grupos = rGru.data || [];
    grupoMembros = rMem.data || [];
    grupoProfs = rGP.data || [];
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
    // Falta justificada exige justificativa registrada
    let justificativa = s.justificativa || null;
    if (status === 'fj') {
        const j = prompt('Justificativa da falta (obrigatória):', s.justificativa || '');
        if (j === null) return; // cancelou
        if (!j.trim()) { toast('A falta justificada precisa de uma justificativa.', true); return; }
        justificativa = j.trim();
    }
    let error;
    if (s.id) {
        ({ error } = await sb.from('argos_sessoes').update({ status, justificativa }).eq('id', s.id));
    } else {
        ({ error } = await sb.from('argos_sessoes').insert({
            paciente_id: s.paciente_id, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
            data: s.data, hora: s.hora, duracao_min: s.duracao_min || 60,
            sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
            servico_id: s.servico_id || null, status, justificativa,
            grupo_id: s.grupo_id || null, grupo_ref: s.grupo_ref || null
        }));
    }
    if (error) { console.error(error); toast('Erro ao marcar sessão.', true); return; }
    if (status === 'fj') {
        await registrarEvento(s.paciente_id, 'falta_justificada',
            `Falta justificada na sessão de ${formataBR(s.data)} às ${s.hora}.`,
            { data: s.data, hora: s.hora }, justificativa);
    }
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
    const titulo = `${nomePac(s.paciente_id)} · ${nomeSala(s.sala_id)} · ${nomeProf(s.profissional_id)}${s.justificativa ? ' · 📝 ' + s.justificativa : ''}${conflita(s) ? ' · ⚠️ CONFLITO de espaço/horário' : ''}`;
    return `
      <div class="agenda-chip ${compacta ? 'compacta' : ''} ${vencida ? 'vencida' : ''} ${conflita(s) ? 'conflito' : ''}"
           ${s.status === '??' ? 'draggable="true"' : ''}
           style="--c:${STATUS_SESSAO[s.status].cor}" data-chave="${chaveSessao(s)}" title="${esc(titulo)}">
        <b>${s.hora}</b> ${esc(nomePac(s.paciente_id))}
        ${compacta ? '' : `<div class="chip-sub">${esc(nomeSala(s.sala_id))}${s.modalidade === 'grupo' ? ' · 👥' : ''} · <span class="chip-status" style="--c:${STATUS_SESSAO[s.status].cor}">${STATUS_SESSAO[s.status].label}</span>${conflita(s) ? ' ⚠️' : ''}</div>`}
      </div>`;
}

// ---------- grupos terapêuticos: helpers de exibição ----------
const dowDe = iso => paraData(iso).getDay();

function membrosDoGrupo(gid) { return grupoMembros.filter(m => m.grupo_id === gid); }

function profsDoGrupo(gid) { return grupoProfs.filter(x => x.grupo_id === gid).map(x => x.profissional_id); }
function nomesProfsDoGrupo(g) {
    const ids = profsDoGrupo(g.id);
    if (!ids.length && g.profissional_id) ids.push(g.profissional_id);
    return ids.map(nomeProf).join(', ');
}

// sessão individual fica escondida quando o paciente é membro de um grupo
// que acontece naquele mesmo dia-da-semana e horário (a agenda mostra o GRUPO)
function cobertaPorGrupo(s) {
    const dw = dowDe(s.data);
    return grupos.some(g => g.ativo !== false && g.dow === dw && g.hora === s.hora
        && grupoMembros.some(m => m.grupo_id === g.id && m.paciente_id === s.paciente_id));
}

function gruposDoDia(iso) {
    const filtroSala = document.getElementById('filtro-sala').value;
    const filtroProf = document.getElementById('filtro-prof').value;
    return grupos.filter(g => g.ativo !== false && g.dow === dowDe(iso))
        .filter(g => filtroSala === 'geral' ? true : (filtroSala === 'sem' ? !g.sala_id : g.sala_id === filtroSala))
        .filter(g => (!filtroProf || filtroProf === 'todos') ? true
            : (profsDoGrupo(g.id).includes(filtroProf) || g.profissional_id === filtroProf))
        .sort((a, b) => a.hora.localeCompare(b.hora));
}

function grupoChipHTML(g, iso, compacta) {
    const n = membrosDoGrupo(g.id).length;
    return `
      <div class="agenda-chip grupo ${compacta ? 'compacta' : ''}" draggable="true"
           data-grupo="${g.id}" data-grupo-iso="${iso}" style="--c:#38bdf8"
           title="Grupo ${esc(g.nome)} · ${esc(nomeSala(g.sala_id))}${nomesProfsDoGrupo(g) ? ' · 🧑‍⚕️ ' + esc(nomesProfsDoGrupo(g)) : ''} · ${n} paciente(s) — toque para abrir">
        <b>${g.hora}</b> 👥 ${esc(g.nome)}
        ${compacta ? '' : `<div class="chip-sub">${esc(nomeSala(g.sala_id))} · ${n} paciente(s)</div>`}
      </div>`;
}

function conteudoDoDia(iso, lista, conflita, compacta) {
    const doDia = lista.filter(s => s.data === iso && !cobertaPorGrupo(s));
    return gruposDoDia(iso).map(g => grupoChipHTML(g, iso, compacta)).join('')
        + doDia.map(s => chipSessao(s, conflita, compacta)).join('');
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
        const conteudo = conteudoDoDia(iso, lista, conflita, false);
        return `
        <div class="agenda-dia ${iso === hoje ? 'hoje' : ''}" data-iso="${iso}">
          <div class="agenda-dia-titulo">${DOW_NOMES[paraData(iso).getDay()]} <span>${iso.slice(8)}/${iso.slice(5, 7)}</span></div>
          ${conteudo || '<div class="dim agenda-vazio">—</div>'}
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
        celulas += `
        <div class="agenda-dia mes-dia ${fora ? 'fora' : ''} ${iso === hoje ? 'hoje' : ''}" ${fora ? '' : `data-iso="${iso}"`}>
          <div class="agenda-dia-titulo">${Number(iso.slice(8))}</div>
          ${fora ? '' : conteudoDoDia(iso, lista, conflita, true)}
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

    const hoje = hojeISO();
    const blocos = [];
    for (let iso = de; iso <= ate; iso = somarDias(iso, 1)) {
        const conteudo = conteudoDoDia(iso, lista, conflita, false);
        if (!conteudo) continue;
        blocos.push(`
          <div class="periodo-dia ${iso === hoje ? 'hoje' : ''}" data-iso="${iso}">
            <div class="periodo-data">${DOW_NOMES[paraData(iso).getDay()]} · ${formataBR(iso)}</div>
            <div class="periodo-chips">${conteudo}</div>
          </div>`);
    }
    document.getElementById('agenda-periodo').innerHTML = blocos.join('')
        || '<div class="argos-tabela-vazia">Nenhuma sessão neste período.</div>';
}

let voltarAoGrupo = null; // reabre o modal do grupo ao fechar o modal da sessão

function aoClicarSessao(e) {
    const chipGrupo = e.target.closest('[data-grupo]');
    if (chipGrupo) { abrirModalGrupo(chipGrupo.dataset.grupo, chipGrupo.dataset.grupoIso); return; }
    const chip = e.target.closest('[data-chave]');
    if (!chip) return;
    const s = chaves.get(chip.dataset.chave);
    if (!s || !perm.pode('sessoes_status')) return;
    voltarAoGrupo = null;
    abrirModalSessaoPara(s);
}

function abrirModalSessaoPara(s) {
    sessaoAberta = s;
    document.getElementById('sessao-info').innerHTML =
        `<b>${formataBR(s.data)} ${s.hora}</b> — ${esc(nomePac(s.paciente_id))}<br>
         <span class="dim">${esc(nomeSala(s.sala_id))} · ${esc(nomeProf(s.profissional_id))} · situação atual:
         <span class="chip-status" style="--c:${STATUS_SESSAO[s.status].cor}">${STATUS_SESSAO[s.status].label}</span></span>
         ${s.justificativa ? `<br><span class="dim">📝 Justificativa: ${esc(s.justificativa)}</span>` : ''}`;
    document.getElementById('botoes-status').innerHTML =
        ['??', 'ok', 'fj', 'fc', 'nc'].map(st => `
          <button class="btn-status" style="--c:${STATUS_SESSAO[st].cor}" data-marcar="${st}">
            ${STATUS_SESSAO[st].label}<small>${STATUS_SESSAO[st].desc}</small></button>`).join('');
    // remarcação: só para sessões ainda pendentes («??»)
    const podeRemarcar = s.status === '??' && perm.pode('sessao_remarcar');
    document.getElementById('bloco-remarcar').style.display = podeRemarcar ? '' : 'none';
    if (podeRemarcar) {
        document.getElementById('rem-data').value = s.data;
        document.getElementById('rem-hora').value = s.hora;
        document.getElementById('rem-motivo').value = '';
    }
    abrirModal('modal-sessao');
}
document.getElementById('agenda-grade').addEventListener('click', aoClicarSessao);
document.getElementById('agenda-periodo').addEventListener('click', aoClicarSessao);

// ao sair do modal da sessão, volta ao modal do grupo (se veio de lá)
function retornarAoGrupoSePreciso() {
    if (!voltarAoGrupo) return;
    const v = voltarAoGrupo;
    voltarAoGrupo = null;
    setTimeout(() => abrirModalGrupo(v.gid, v.iso), 60);
}
document.getElementById('modal-sessao').addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]') || e.target.id === 'modal-sessao') retornarAoGrupoSePreciso();
});

document.getElementById('botoes-status').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-marcar]');
    if (!btn || !sessaoAberta) return;
    await marcarSessao(sessaoAberta, btn.dataset.marcar);
    fecharModal('modal-sessao');
    retornarAoGrupoSePreciso();
});

// ============================================================
// REMARCAÇÃO DE SESSÃO
// ============================================================
let remarcarCtx = null;

async function registrarEvento(pacienteId, tipo, descricao, dados, justificativa) {
    const { error } = await sb.from('argos_paciente_eventos')
        .insert({ paciente_id: pacienteId, tipo, descricao, dados: dados || null, justificativa: justificativa || null });
    if (error) console.error(error);
}

async function recarregarSessoes() {
    const [rSes, rDin, rGru, rMem, rGP] = await Promise.all([
        sb.from('argos_sessoes').select('*'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_grupos').select('*').order('hora'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*')
    ]);
    sessoes = rSes.data || sessoes;
    dinamicas = rDin.data || dinamicas;
    grupos = rGru.data || grupos;
    grupoMembros = rMem.data || grupoMembros;
    grupoProfs = rGP.data || grupoProfs;
    renderTudo();
    const modalGrupo = document.getElementById('modal-grupo');
    if (modalGrupo && modalGrupo.classList.contains('aberto') && grupoAberto) renderModalGrupo();
}

// inicia o fluxo de remarcação (usado pelo modal e pelo arrastar-e-soltar)
async function iniciarRemarcacao(s, novaData, novaHora, motivo) {
    if (!novaData || !novaHora) { toast('Informe o novo dia e a nova hora.', true); return; }
    if (novaData === s.data && novaHora === s.hora) { toast('A sessão já está nesse dia/horário.', true); return; }

    // conflito no destino (respeita individual × grupo)
    const candidata = { ...s, id: s.id, data: novaData, hora: novaHora };
    const conflitos = conflitosDeSessao(candidata, dinamicas.filter(d => d.ativo !== false),
        sessoes.filter(x => x.id !== s.id));
    if (conflitos.length) {
        const quem = nomePac(conflitos[0].paciente_id);
        toast(`⛔ Conflito: ${quem} já tem sessão nesse horário no mesmo espaço/profissional.`, true);
        return;
    }

    const d = s.dinamica_ref ? dinamicas.find(x => x.id === s.dinamica_ref) : null;
    if (d && d.ativo !== false && d.recorrencia_tipo === 'recorrente') {
        remarcarCtx = { s, novaData, novaHora, d, motivo };
        document.getElementById('pergunta-horario-texto').innerHTML =
            `A sessão de <b>${esc(nomePac(s.paciente_id))}</b> de ${formataBR(s.data)} às ${s.hora} será movida para <b>${formataBR(novaData)} às ${novaHora}</b>.<br><br>Esse passa a ser o novo horário fixo do paciente?`;
        fecharModal('modal-sessao');
        abrirModal('modal-pergunta-horario');
    } else {
        await moverSessaoUnica(s, novaData, novaHora, motivo);
        fecharModal('modal-sessao');
    }
}

document.getElementById('btn-remarcar').addEventListener('click', async () => {
    const s = sessaoAberta;
    if (!s) return;
    await iniciarRemarcacao(s,
        document.getElementById('rem-data').value,
        document.getElementById('rem-hora').value,
        document.getElementById('rem-motivo').value.trim() || null);
});

document.getElementById('btn-so-esta').addEventListener('click', async () => {
    if (!remarcarCtx) return;
    const { s, novaData, novaHora, motivo } = remarcarCtx;
    await moverSessaoUnica(s, novaData, novaHora, motivo);
    fecharModal('modal-pergunta-horario');
    remarcarCtx = null;
});

document.getElementById('btn-horario-fixo').addEventListener('click', async () => {
    if (!remarcarCtx) return;
    await novoHorarioFixo(remarcarCtx);
    remarcarCtx = null;
});

// Move APENAS a sessão: a linha materializada guarda a ocorrência original
// (remarcada_de_*), então a projeção antiga não reaparece e o financeiro
// passa a contar pela data nova.
async function moverSessaoUnica(s, novaData, novaHora, motivo) {
    let error;
    if (s.id) {
        ({ error } = await sb.from('argos_sessoes').update({
            data: novaData, hora: novaHora,
            remarcada_de_data: s.remarcada_de_data || (s.dinamica_ref ? s.data : null),
            remarcada_de_hora: s.remarcada_de_hora || (s.dinamica_ref ? s.hora : null)
        }).eq('id', s.id));
    } else {
        ({ error } = await sb.from('argos_sessoes').insert({
            paciente_id: s.paciente_id, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
            data: novaData, hora: novaHora, duracao_min: s.duracao_min || 60,
            sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
            servico_id: s.servico_id || null, status: '??',
            remarcada_de_data: s.data, remarcada_de_hora: s.hora
        }));
    }
    if (error) { console.error(error); toast('Erro ao remarcar a sessão.', true); return; }
    await registrarEvento(s.paciente_id, 'remarcacao_sessao',
        `Sessão de ${formataBR(s.data)} às ${s.hora} remarcada para ${formataBR(novaData)} às ${novaHora} (apenas esta sessão; o horário fixo não mudou).`,
        { de: { data: s.data, hora: s.hora }, para: { data: novaData, hora: novaHora }, dinamica: s.dinamica_ref || null }, motivo);
    toast(`Sessão remarcada para ${formataBR(novaData)} às ${novaHora}.`);
    await recarregarSessoes();
}

// Novo horário FIXO: encerra a dinâmica na véspera da sessão movida e cria
// uma continuação com o mesmo acordo financeiro. Pacotes e contagens de
// ocorrências seguem valendo pela cadeia (raiz + continuações).
async function novoHorarioFixo({ s, novaData, novaHora, d, motivo }) {
    const cutoff = somarDias(s.data, -1);
    const jaOcorridas = d.data_inicio && d.data_inicio <= cutoff
        ? expandirDinamica({ ...d, ativo: true }, d.data_inicio, cutoff).length : 0;

    const dowOrig = paraData(s.data).getDay();
    const dowNovo = paraData(novaData).getDay();
    let trocou = false;
    const dias = (d.dias || []).map(x => {
        if (!trocou && Number(x.dow) === dowOrig && x.hora === s.hora) { trocou = true; return { dow: dowNovo, hora: novaHora }; }
        return x;
    });
    if (!trocou) dias.push({ dow: dowNovo, hora: novaHora });

    const nova = {
        paciente_id: d.paciente_id,
        rotulo: (d.rotulo || 'Dinâmica') + ' — novo horário',
        recorrencia_tipo: 'recorrente', dias,
        duracao_min: d.duracao_min || 60,
        freq_qtd: d.freq_qtd, freq_periodo: d.freq_periodo,
        data_inicio: novaData,
        fim_tipo: d.fim_tipo,
        fim_ocorrencias: d.fim_tipo === 'apos_ocorrencias' ? Math.max(1, (d.fim_ocorrencias || 0) - jaOcorridas) : null,
        fim_data: d.fim_tipo === 'data' ? d.fim_data : null,
        modalidade: d.modalidade, sala_id: d.sala_id,
        profissional_id: d.profissional_id, servico_id: d.servico_id,
        acordo_tipo: d.acordo_tipo, valor: d.valor,
        // pacote fica na RAIZ da cadeia; a continuação herda pelo vínculo
        pacote_qtd: null, pacote_valor: null, pacote_pagamento: null,
        continuacao_de: d.id, ativo: true
    };

    const outras = dinamicas.filter(x => x.id !== d.id && x.ativo !== false);
    const conflitos = conflitosDeDinamica(nova, outras, sessoes.filter(x => x.id !== s.id));
    if (conflitos.length) {
        const c = conflitos[0];
        toast(`⛔ O novo horário fixo conflita com ${nomePac(c.outra.paciente_id)} em ${formataBR(c.minha.data)} às ${c.minha.hora}. Nada foi alterado.`, true);
        fecharModal('modal-pergunta-horario');
        return;
    }

    const { error: e1 } = await sb.from('argos_dinamicas').insert(nova);
    if (e1) { console.error(e1); toast('Erro ao criar a nova dinâmica.', true); return; }
    const { error: e2 } = await sb.from('argos_dinamicas')
        .update({ fim_tipo: 'data', fim_data: cutoff }).eq('id', d.id);
    if (e2) { console.error(e2); toast('Erro ao encerrar a dinâmica anterior.', true); return; }
    if (s.id) await sb.from('argos_sessoes').delete().eq('id', s.id);

    let extras = '';
    if (d.fim_tipo === 'apos_ocorrencias') extras = ` Restavam ${nova.fim_ocorrencias} de ${d.fim_ocorrencias} ocorrências contratadas, que seguem na nova dinâmica.`;
    if (d.acordo_tipo === 'pacote') extras += ` O pacote contratado (${d.pacote_qtd} sessões, ${d.pacote_valor != null ? 'R$ ' + d.pacote_valor : ''}) continua valendo pelo conjunto: sessões e pagamentos seguem na contagem única.`;
    await registrarEvento(d.paciente_id, 'mudanca_horario_fixo',
        `Horário fixo alterado a partir de ${formataBR(novaData)}: ${DOW_NOMES[dowOrig]} ${s.hora} → ${DOW_NOMES[dowNovo]} ${novaHora}. A dinâmica "${d.rotulo || 'sem rótulo'}" foi encerrada em ${formataBR(cutoff)} e uma continuação foi criada com o mesmo acordo financeiro.${extras}`,
        { dinamica_encerrada: d.id, de: { dow: dowOrig, hora: s.hora }, para: { dow: dowNovo, hora: novaHora }, ocorridas_antes: jaOcorridas }, motivo);

    toast('Novo horário fixo aplicado; a alteração ficou registrada no card do paciente.');
    fecharModal('modal-pergunta-horario');
    await recarregarSessoes();
}

// ============================================================
// GRUPOS TERAPÊUTICOS
// ============================================================
let grupoAberto = null;   // { gid, iso }
let editandoGrupoId = null;

function proximaOcorrencia(g) {
    let iso = hojeISO();
    for (let i = 0; i < 7; i++) { if (dowDe(iso) === g.dow) return iso; iso = somarDias(iso, 1); }
    return hojeISO();
}

// sessão (mesclada) do paciente no horário do grupo naquele dia
function sessaoDoMembro(pacId, g, iso, mesclado) {
    const candidatos = mesclado.filter(s => s.paciente_id === pacId && s.hora === g.hora);
    return candidatos.find(s => s.id) || candidatos[0] || null;
}

function abrirModalGrupo(gid, iso) {
    grupoAberto = { gid, iso };
    renderModalGrupo();
    abrirModal('modal-grupo');
}

function renderModalGrupo() {
    const g = grupos.find(x => x.id === grupoAberto.gid);
    if (!g) { fecharModal('modal-grupo'); return; }
    const iso = grupoAberto.iso;
    const membrosG = membrosDoGrupo(g.id);
    document.getElementById('modal-grupo-titulo').textContent = `👥 ${g.nome}`;
    document.getElementById('grupo-info').innerHTML =
        `<b>${DOW_NOMES[g.dow]} às ${g.hora}</b> · ocorrência de <b>${formataBR(iso)}</b> · 🚪 ${esc(nomeSala(g.sala_id))}${nomesProfsDoGrupo(g) ? ' · 🧑‍⚕️ ' + esc(nomesProfsDoGrupo(g)) : ''} · ${membrosG.length} paciente(s)`;

    const mesclado = mesclarSessoes(dinamicas, sessoes, iso, iso);
    const outrosGrupos = grupos.filter(x => x.id !== g.id && x.ativo !== false);
    const podeStatus = perm.pode('sessoes_status');

    document.getElementById('grupo-membros').innerHTML = membrosG.map(m => {
        const p = pacientes.find(x => x.id === m.paciente_id) || { nome: '(paciente?)' };
        const s = sessaoDoMembro(m.paciente_id, g, iso, mesclado);
        const st = s ? s.status : '??';
        return `
        <div class="argos-bloco pendente-linha" data-membro="${m.paciente_id}">
          <div class="bloco-info">
            <b>${esc(p.nome)}</b> — <span class="chip-status" style="--c:${STATUS_SESSAO[st].cor}">${STATUS_SESSAO[st].label}</span>
            ${s && s.justificativa ? `<br><span class="dim">📝 ${esc(s.justificativa)}</span>` : ''}
          </div>
          <div class="agenda-nav">
            ${podeStatus ? `<span class="botoes-status compacto">
              ${['??', 'ok', 'fj', 'fc', 'nc'].map(x => `
                <button class="btn-status" style="--c:${STATUS_SESSAO[x].cor}" data-membro-marcar="${x}" title="${STATUS_SESSAO[x].desc}">${STATUS_SESSAO[x].label}</button>`).join('')}
            </span>` : ''}
            <select class="argos-input" data-membro-acao>
              <option value="">⋯</option>
              ${outrosGrupos.map(o => `<option value="mover:${o.id}">→ Mover para ${esc(o.nome)}</option>`).join('')}
              <option value="remover">✖ Remover do grupo</option>
            </select>
          </div>
        </div>`;
    }).join('') || '<p class="dim">Nenhum paciente neste grupo ainda.</p>';

    const foraDoGrupo = pacientes.filter(p => p.ativo && !p.cadastro_removido
        && !membrosG.some(m => m.paciente_id === p.id));
    document.getElementById('grupo-add-paciente').innerHTML =
        '<option value="">— Escolher paciente —</option>' +
        foraDoGrupo.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
}

// monta (ou cria em memória) a sessão de um membro na ocorrência do grupo
function sessaoParaMembro(pacId) {
    const g = grupos.find(x => x.id === grupoAberto.gid);
    const iso = grupoAberto.iso;
    const mesclado = mesclarSessoes(dinamicas, sessoes, iso, iso);
    let s = sessaoDoMembro(pacId, g, iso, mesclado);
    if (!s) {
        // paciente sem dinâmica nesse horário: sessão ligada ao grupo
        s = {
            id: null, paciente_id: pacId, dinamica_ref: null,
            data: iso, hora: g.hora, duracao_min: g.duracao_min || 60,
            sala_id: g.sala_id, profissional_id: profsDoGrupo(g.id)[0] || g.profissional_id || null,
            servico_id: g.servico_id, status: '??', grupo_id: g.id, grupo_ref: g.id
        };
    }
    return { ...s, grupo_id: s.grupo_id || g.id, grupo_ref: s.grupo_ref || g.id };
}

document.getElementById('grupo-membros').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-membro-marcar]');
    if (btn) {
        const pacId = btn.closest('[data-membro]').dataset.membro;
        await marcarSessao(sessaoParaMembro(pacId), btn.dataset.membroMarcar);
        renderModalGrupo();
        return;
    }
    // toque no nome/linha do paciente: abre o modal completo da sessão
    // (mesmas ações de um paciente fora do grupo, incl. remarcar)
    const info = e.target.closest('.bloco-info');
    if (info && perm.pode('sessoes_status')) {
        const pacId = info.closest('[data-membro]').dataset.membro;
        voltarAoGrupo = { gid: grupoAberto.gid, iso: grupoAberto.iso };
        fecharModal('modal-grupo');
        abrirModalSessaoPara(sessaoParaMembro(pacId));
    }
});

document.getElementById('grupo-membros').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-membro-acao]');
    if (!sel || !sel.value) return;
    const g = grupos.find(x => x.id === grupoAberto.gid);
    const pacId = sel.closest('[data-membro]').dataset.membro;
    const nomeP = nomePac(pacId);
    if (sel.value === 'remover') {
        if (!confirm(`Remover ${nomeP} do grupo "${g.nome}"?\n(As presenças já registradas são mantidas.)`)) { sel.value = ''; return; }
        await sb.from('argos_grupo_membros').delete().eq('grupo_id', g.id).eq('paciente_id', pacId);
        toast(`${nomeP} removido(a) do grupo.`);
    } else if (sel.value.startsWith('mover:')) {
        const destinoId = sel.value.slice(6);
        const destino = grupos.find(x => x.id === destinoId);
        await sb.from('argos_grupo_membros').delete().eq('grupo_id', g.id).eq('paciente_id', pacId);
        const { error } = await sb.from('argos_grupo_membros').insert({ grupo_id: destinoId, paciente_id: pacId });
        if (error && error.code !== '23505') { toast('Erro ao mover paciente.', true); return; }
        toast(`${nomeP} movido(a) para "${destino.nome}".`);
    }
    await recarregarSessoes();
    renderModalGrupo();
});

document.getElementById('btn-grupo-add').addEventListener('click', async () => {
    const pacId = document.getElementById('grupo-add-paciente').value;
    if (!pacId) return;
    const { error } = await sb.from('argos_grupo_membros')
        .insert({ grupo_id: grupoAberto.gid, paciente_id: pacId });
    if (error && error.code !== '23505') { toast('Erro ao adicionar.', true); return; }
    await recarregarSessoes();
    renderModalGrupo();
});

document.getElementById('btn-grupo-add-todos').addEventListener('click', async () => {
    const g = grupos.find(x => x.id === grupoAberto.gid);
    const faltam = pacientes.filter(p => p.ativo && !p.cadastro_removido
        && !membrosDoGrupo(g.id).some(m => m.paciente_id === p.id));
    if (!faltam.length) { toast('Todos os pacientes já estão no grupo.'); return; }
    if (!confirm(`Adicionar ${faltam.length} paciente(s) ao grupo "${g.nome}"?`)) return;
    const { error } = await sb.from('argos_grupo_membros')
        .insert(faltam.map(p => ({ grupo_id: g.id, paciente_id: p.id })));
    if (error && error.code !== '23505') { toast('Erro ao adicionar todos.', true); return; }
    await recarregarSessoes();
    renderModalGrupo();
});

document.getElementById('btn-grupo-editar').addEventListener('click', () => abrirFormGrupo(grupoAberto.gid));
document.getElementById('btn-grupo-excluir').addEventListener('click', async () => {
    const g = grupos.find(x => x.id === grupoAberto.gid);
    if (!confirm(`Excluir o grupo "${g.nome}"?\nAs presenças já registradas dos pacientes são mantidas no histórico.`)) return;
    const { error } = await sb.from('argos_grupos').delete().eq('id', g.id);
    if (error) { toast('Erro ao excluir grupo.', true); return; }
    toast('Grupo excluído.');
    fecharModal('modal-grupo');
    await recarregarSessoes();
});

// ---------- lista e formulário de grupos ----------
document.getElementById('btn-grupos').addEventListener('click', () => { renderListaGrupos(); abrirModal('modal-grupos-lista'); });
document.getElementById('btn-novo-grupo').addEventListener('click', () => abrirFormGrupo(null));

function renderListaGrupos() {
    document.getElementById('lista-grupos').innerHTML = grupos.filter(g => g.ativo !== false).map(g => `
      <div class="argos-bloco pendente-linha">
        <div class="bloco-info"><b>👥 ${esc(g.nome)}</b><br>
          <span class="dim">${DOW_NOMES[g.dow]} às ${g.hora} · ${esc(nomeSala(g.sala_id))} · ${membrosDoGrupo(g.id).length} paciente(s)</span></div>
        <div class="agenda-nav">
          <button class="argos-btn small primary" data-grupo-abrir="${g.id}">Abrir</button>
          <button class="argos-btn small" data-grupo-editar="${g.id}">✏️</button>
        </div>
      </div>`).join('') || '<p class="dim">Nenhum grupo criado ainda.</p>';
}

document.getElementById('lista-grupos').addEventListener('click', (e) => {
    const abrir = e.target.closest('[data-grupo-abrir]');
    const editar = e.target.closest('[data-grupo-editar]');
    if (abrir) {
        const g = grupos.find(x => x.id === abrir.dataset.grupoAbrir);
        fecharModal('modal-grupos-lista');
        abrirModalGrupo(g.id, proximaOcorrencia(g));
    }
    if (editar) abrirFormGrupo(editar.dataset.grupoEditar);
});

function abrirFormGrupo(id) {
    editandoGrupoId = id;
    const g = id ? grupos.find(x => x.id === id) : null;
    document.getElementById('modal-grupo-form-titulo').textContent = g ? `Editar grupo: ${g.nome}` : 'Novo grupo terapêutico';
    document.getElementById('gru-dow').innerHTML = DOW_NOMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
    document.getElementById('gru-sala').innerHTML = '<option value="">— Sem espaço definido —</option>' +
        salas.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    const marcados = g ? profsDoGrupo(g.id) : [];
    document.getElementById('gru-profs').innerHTML = profissionais.map(p => `
        <label class="linha-check" style="margin:2px 0">
          <input type="checkbox" value="${p.id}" ${marcados.includes(p.id) ? 'checked' : ''} /> ${esc(p.nome)}
        </label>`).join('') || '<span class="dim">Nenhum profissional cadastrado ainda.</span>';
    document.getElementById('gru-nome').value = g ? g.nome : '';
    document.getElementById('gru-dow').value = g ? g.dow : dowDe(hojeISO());
    document.getElementById('gru-hora').value = g ? g.hora : '09:00';
    document.getElementById('gru-duracao').value = g ? g.duracao_min : 60;
    document.getElementById('gru-sala').value = g ? (g.sala_id || '') : '';
    abrirModal('modal-grupo-form');
}

const minutosDe = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + (b || 0); };

// outro grupo já ocupa o mesmo espaço/dia/horário?
function grupoOcupante(candidato, ignorarId) {
    return grupos.find(g => g.id !== ignorarId && g.ativo !== false && g.dow === candidato.dow
        && ((g.sala_id && candidato.sala_id && g.sala_id === candidato.sala_id) || (!g.sala_id && !candidato.sala_id))
        && minutosDe(g.hora) < minutosDe(candidato.hora) + (candidato.duracao_min || 60)
        && minutosDe(candidato.hora) < minutosDe(g.hora) + (g.duracao_min || 60));
}

// aplica novo horário/espaço a um grupo, com a regra de troca entre grupos
async function salvarSlotDeGrupo(gid, registro) {
    const ocupante = grupoOcupante(registro, gid);
    if (ocupante) {
        const atual = gid ? grupos.find(x => x.id === gid) : null;
        if (!atual) {
            toast(`⛔ Esse horário já é do grupo "${ocupante.nome}". Realoque-o primeiro ou escolha outro horário/espaço.`, true);
            return null;
        }
        const trocar = confirm(`O horário escolhido já é do grupo "${ocupante.nome}".\n\nDeseja TROCAR os horários entre "${atual.nome}" e "${ocupante.nome}"?\n(OK = trocar · Cancelar = não fazer nada)`);
        if (!trocar) return null;
        const { error: eT } = await sb.from('argos_grupos').update({
            dow: atual.dow, hora: atual.hora, sala_id: atual.sala_id, duracao_min: atual.duracao_min
        }).eq('id', ocupante.id);
        if (eT) { toast('Erro ao trocar os grupos.', true); return null; }
        // dinâmicas atreladas ao grupo trocado acompanham o novo horário dele
        await sb.from('argos_dinamicas').update({
            dias: [{ dow: atual.dow, hora: atual.hora }],
            sala_id: atual.sala_id, duracao_min: atual.duracao_min
        }).eq('grupo_id', ocupante.id);
    }
    let error, salvoId = gid;
    if (gid) ({ error } = await sb.from('argos_grupos').update(registro).eq('id', gid));
    else {
        const { data, error: e2 } = await sb.from('argos_grupos').insert(registro).select().single();
        error = e2; salvoId = data && data.id;
    }
    if (error) { console.error(error); toast('Erro ao salvar grupo.', true); return null; }
    if (gid) {
        // dinâmicas atreladas a este grupo acompanham o novo dia/horário/espaço
        await sb.from('argos_dinamicas').update({
            dias: [{ dow: registro.dow, hora: registro.hora }],
            sala_id: registro.sala_id, duracao_min: registro.duracao_min
        }).eq('grupo_id', gid);
    }
    return salvoId;
}

document.getElementById('form-grupo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const profIds = Array.from(document.querySelectorAll('#gru-profs input:checked')).map(x => x.value);
    const registro = {
        nome: document.getElementById('gru-nome').value.trim(),
        dow: Number(document.getElementById('gru-dow').value),
        hora: document.getElementById('gru-hora').value,
        duracao_min: Number(document.getElementById('gru-duracao').value) || 60,
        sala_id: document.getElementById('gru-sala').value || null,
        profissional_id: profIds[0] || null,
        ativo: true
    };
    if (!registro.nome || !registro.hora) { toast('Informe nome e hora do grupo.', true); return; }
    const salvoId = await salvarSlotDeGrupo(editandoGrupoId, registro);
    if (!salvoId) return;
    // sincroniza os profissionais condutores do grupo
    await sb.from('argos_grupo_profissionais').delete().eq('grupo_id', salvoId);
    if (profIds.length) {
        await sb.from('argos_grupo_profissionais')
            .insert(profIds.map(id => ({ grupo_id: salvoId, profissional_id: id })));
    }
    fecharModal('modal-grupo-form');
    toast('Grupo salvo.');
    await recarregarSessoes();
    renderListaGrupos();
    if (grupoAberto && grupoAberto.gid === editandoGrupoId) renderModalGrupo();
});

// mover grupo (arrastar para outro dia): muda o dia fixo, com regra de troca
async function moverGrupo(g, novoDow) {
    if (g.dow === novoDow) return;
    const registro = { dow: novoDow, hora: g.hora, sala_id: g.sala_id, duracao_min: g.duracao_min };
    const ok = await salvarSlotDeGrupo(g.id, registro);
    if (!ok) return;
    toast(`Grupo "${g.nome}" movido para ${DOW_NOMES[novoDow]}.`);
    await recarregarSessoes();
}

// ---------- arrastar e soltar (mouse) ----------
function configurarDragDrop(container) {
    container.addEventListener('dragstart', (e) => {
        const chip = e.target.closest('.agenda-chip');
        if (!chip) return;
        const payload = chip.dataset.grupo
            ? { tipo: 'grupo', id: chip.dataset.grupo }
            : { tipo: 'sessao', chave: chip.dataset.chave };
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
    });
    container.addEventListener('dragover', (e) => {
        const dia = e.target.closest('[data-iso]');
        if (dia) { e.preventDefault(); dia.classList.add('drop-alvo'); }
    });
    container.addEventListener('dragleave', (e) => {
        const dia = e.target.closest('[data-iso]');
        if (dia) dia.classList.remove('drop-alvo');
    });
    container.addEventListener('drop', async (e) => {
        const dia = e.target.closest('[data-iso]');
        if (!dia) return;
        e.preventDefault();
        dia.classList.remove('drop-alvo');
        let payload;
        try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; }
        const alvoIso = dia.dataset.iso;
        if (payload.tipo === 'grupo') {
            const g = grupos.find(x => x.id === payload.id);
            if (g) await moverGrupo(g, dowDe(alvoIso));
        } else {
            const s = chaves.get(payload.chave);
            if (!s) return;
            if (s.status !== '??') { toast('Só sessões pendentes («??») podem ser movidas.', true); return; }
            if (s.data === alvoIso) return;
            await iniciarRemarcacao(s, alvoIso, s.hora, null);
        }
    });
}
configurarDragDrop(document.getElementById('agenda-grade'));
configurarDragDrop(document.getElementById('agenda-periodo'));

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
