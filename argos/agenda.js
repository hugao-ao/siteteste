// agenda.js — Card "Agenda e Logística" da área Argos
// Agenda semanal geral e por espaço, preenchida pelas dinâmicas financeiras;
// lista de sessões vencidas «??» para marcar Ok/Fj/Fc/Nc.

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    STATUS_SESSAO, DOW_NOMES, mesclarSessoes, hojeISO, somarDias, paraData,
    paraISO, formataBR, fimDoMes, expandirDinamica, conflitosDeSessao,
    conflitosDeDinamica, repassesDe, aplicarFimDeProcesso
} from './argos-recorrencia.js';
import { gravarFrequencia, registrarFaltasJustificadas, avisarMudanca, ouvirMudancas }
    from './argos-frequencia.js';
import { STATUS_PROF, ORDEM_STATUS_PROF, responsaveisDe } from './argos-producao.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], salas = [], profissionais = [], dinamicas = [], sessoes = [];
let grupos = [], grupoMembros = [], grupoProfs = [];
let profFreq = [];                        // presença dos profissionais nos horários
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
    const [rPac, rSalas, rProf, rDin, rSes, rGru, rMem, rGP, rPF] = await Promise.all([
        sb.from('argos_pacientes').select('id, nome, ativo, cadastro_removido, processo_fim_data, processo_fim_tipo').order('nome'),
        sb.from('argos_salas').select('*').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        sb.from('argos_grupos').select('*').order('hora'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*'),
        todas(() => sb.from('argos_prof_frequencia').select('*'))
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
    profFreq = rPF.data || [];
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
// A regra: sessão que já venceu e ninguém classificou é «??» até alguém
// dizer o que houve. Vale do primeiro dia da clínica até ONTEM — a de hoje
// ainda pode acontecer, e cobrar o preenchimento dela seria cobrar o futuro.
//
// O banco garante metade disso sozinho: status é NOT NULL, nasce '??' e só
// aceita os cinco valores, então linha gravada nunca fica sem classificação.
// A outra metade é a projeção: o horário fixo que ainda não virou linha
// aparece como «??» pela mesma regra.
function sessoesPendentes() {
    const hoje = hojeISO();
    const inicio = dinamicas.map(d => d.data_inicio).filter(Boolean).sort()[0];
    const deSessoes = sessoes.map(s => s.data).sort()[0];
    const de = [inicio, deSessoes].filter(Boolean).sort()[0];
    if (!de) return [];
    const c = aplicarFimDeProcesso(dinamicas, sessoes, pacientes);
    // Desligar uma dinâmica encerra o futuro dela, não apaga o passado: o que
    // já venceu sem classificação continua pendente. Sem isto, desmarcar
    // "ativa" faria a obrigação de preencher sumir em silêncio, e as sessões
    // sairiam do fechamento sem ninguém ter dito o que aconteceu.
    // O corte por fim de processo do paciente continua valendo por cima.
    const paraPendencia = c.dinamicas.map(d => d.ativo === false ? { ...d, ativo: true } : d);
    return mesclarSessoes(paraPendencia, c.sessoes, de, somarDias(hoje, -1))
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

// Preencher a frequência atrasada é conferência a duas mãos: a planilha ou o
// WhatsApp de um lado, o sistema do outro. Numa janela à parte, a agenda
// continua visível atrás — como modal, obrigava a fechar tudo para consultar.
// Reusa a janela já aberta em vez de empilhar cópias.
let janelaPendencias = null;
document.getElementById('btn-abrir-pendentes').addEventListener('click', () => {
    if (janelaPendencias && !janelaPendencias.closed) { janelaPendencias.focus(); return; }
    const larg = Math.min(980, Math.max(560, Math.round(screen.availWidth * 0.6)));
    const alt = Math.min(900, Math.round(screen.availHeight * 0.85));
    janelaPendencias = window.open('pendencias.html', 'argos_pendencias',
        `popup=yes,width=${larg},height=${alt},left=${Math.max(0, screen.availWidth - larg - 40)},top=60,`
        + 'resizable=yes,scrollbars=yes');
    if (!janelaPendencias) {
        // bloqueador de pop-up: melhor abrir na mesma aba que não abrir nada
        toast('O navegador bloqueou a janela. Abrindo na própria aba.', true);
        window.location.href = 'pendencias.html';
        return;
    }
    janelaPendencias.focus();
});

// a janela de pendências avisa quando alguém marca alguma coisa
ouvirMudancas(dados => { if (dados.origem !== 'agenda') recarregarSessoes(); });


const chaves = new Map(); // chave -> objeto sessão (para achar no clique)
function chaveSessao(s) {
    const k = s.id || `${s.dinamica_ref}|${s.data}|${s.hora}`;
    chaves.set(k, s);
    return k;
}

// ---------- marcação (materializa a projeção se preciso) ----------

/**
 * Marca uma ou muitas sessões de uma vez.
 *
 * Marcar em lote não é marcar N vezes: a justificativa é pedida uma só vez,
 * o banco leva um único insert e um único update, e a agenda é redesenhada no
 * fim. Resolver o mês inteiro de um paciente costumava recarregar as milhares
 * de sessões uma vez por clique.
 */
async function marcarSessoes(lista, status) {
    if (!perm.pode('sessoes_status')) { toast('Sem permissão para marcar frequência.', true); return; }
    const alvos = (lista || []).filter(Boolean);
    if (!alvos.length) return;

    // Falta justificada pede o motivo escrito. Quem tem a permissão de dispensa
    // pode deixar em branco — é o caso da importação das planilhas antigas e de
    // quando o responsável só manda o motivo depois.
    let justificativa = alvos.length === 1 ? (alvos[0].justificativa || null) : null;
    if (status === 'fj') {
        const dispensa = perm.pode('sessao_fj_sem_justificativa');
        const quantas = alvos.length > 1 ? ` (vale para as ${alvos.length})` : '';
        const j = prompt(dispensa
            ? `Justificativa da falta${quantas} (pode deixar em branco):`
            : `Justificativa da falta${quantas} (obrigatória):`, justificativa || '');
        if (j === null) return; // cancelou
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
    renderTudo();
    // a janela de pendências, se estiver aberta, acompanha
    avisarMudanca({ origem: 'agenda', quantas: alvos.length });
}

/** Uma sessão só — o caminho de sempre, pelos cartões da agenda. */
const marcarSessao = (s, status) => marcarSessoes([s], status);

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
    // processo encerrado/interrompido: o paciente some da agenda a partir da data
    const c = aplicarFimDeProcesso(dinamicas, sessoes, pacientes);
    let lista = mesclarSessoes(c.dinamicas, c.sessoes, de, ate);
    if (filtro === 'sem') lista = lista.filter(s => !s.sala_id);
    else if (filtro !== 'geral') lista = lista.filter(s => s.sala_id === filtro);
    if (filtroProf && filtroProf !== 'todos') {
        // o profissional pode ser qualquer um dos responsáveis da dinâmica
        // (lista de repasses), não só o "principal" gravado na sessão
        const dinsDoProf = new Set(dinamicas
            .filter(d => repassesDe(d).some(r => r.profissional_id === filtroProf))
            .map(d => d.id));
        lista = lista.filter(s => s.profissional_id === filtroProf
            || (s.dinamica_ref && dinsDoProf.has(s.dinamica_ref)));
    }
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
    const titulo = `${nomePac(s.paciente_id)} · ${nomeSala(s.sala_id)} · ${nomeProf(s.profissional_id)}${s.remarcada_de_data ? ` · ↪️ remarcada de ${formataBR(s.remarcada_de_data)} às ${s.remarcada_de_hora}` : ''}${s.justificativa ? ' · 📝 ' + s.justificativa : ''}${conflita(s) ? ' · ⚠️ CONFLITO de espaço/horário' : ''}`;
    return `
      <div class="agenda-chip ${compacta ? 'compacta' : ''} ${vencida ? 'vencida' : ''} ${conflita(s) ? 'conflito' : ''}"
           ${s.status === '??' ? 'draggable="true"' : ''}
           style="--c:${STATUS_SESSAO[s.status].cor}" data-chave="${chaveSessao(s)}" title="${esc(titulo)}">
        <b>${s.hora}</b> ${s.remarcada_de_data ? '↪️ ' : ''}${esc(nomePac(s.paciente_id))}
        ${compacta ? '' : `<div class="chip-sub">${esc(nomeSala(s.sala_id))}${s.modalidade === 'grupo' ? ' · 👥' : ''}${s.remarcada_de_data ? ` · ↪️ de ${formataBR(s.remarcada_de_data).slice(0, 5)}` : ''} · <span class="chip-status" style="--c:${STATUS_SESSAO[s.status].cor}">${STATUS_SESSAO[s.status].label}</span>${conflita(s) ? ' ⚠️' : ''}</div>`}
      </div>`;
}

// ---------- grupos terapêuticos: helpers de exibição ----------
const dowDe = iso => paraData(iso).getDay();

function membrosDoGrupo(gid) { return grupoMembros.filter(m => m.grupo_id === gid); }

// sessão do paciente que FOI movida desta ocorrência do grupo para outro dia/hora
function sessaoMovidaDaOcorrencia(pacId, g, iso) {
    return sessoes.find(s => s.paciente_id === pacId
        && s.remarcada_de_data === iso && s.remarcada_de_hora === g.hora
        && !(s.data === iso && s.hora === g.hora)) || null;
}

// O membro participa da ocorrência do grupo naquele dia? Dinâmicas encerradas
// (ex.: continuação por novo horário fixo) tiram o paciente das ocorrências
// seguintes, mas as anteriores e as já registradas continuam aparecendo.
function participaDaOcorrencia(pacId, g, iso) {
    const pac = pacientes.find(p => p.id === pacId);
    if (pac && pac.processo_fim_data && iso >= pac.processo_fim_data) return false;
    if (sessoes.some(s => s.paciente_id === pacId
        && (s.grupo_ref === g.id || s.grupo_id === g.id)
        && (s.data === iso || s.remarcada_de_data === iso))) return true;
    const doGrupo = dinamicas.filter(d => d.paciente_id === pacId && d.grupo_id === g.id);
    if (!doGrupo.length) return true; // membro sem dinâmica ligada ao grupo: sempre presente
    return doGrupo.some(d => d.ativo !== false
        && expandirDinamica({ ...d, ativo: true }, iso, iso).some(o => o.data === iso));
}
function membrosNaOcorrencia(g, iso) {
    return membrosDoGrupo(g.id).filter(m => participaDaOcorrencia(m.paciente_id, g, iso));
}

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
    const n = membrosNaOcorrencia(g, iso).length;
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
let voltarAoDia = null;   // reabre o modal do dia ao fechar o modal aberto por ele
let diaAberto = null;     // ISO do dia exibido no modal "Agenda do dia"

function aoClicarSessao(e) {
    const chipGrupo = e.target.closest('[data-grupo]');
    if (chipGrupo) { voltarAoDia = null; abrirModalGrupo(chipGrupo.dataset.grupo, chipGrupo.dataset.grupoIso); return; }
    const chip = e.target.closest('[data-chave]');
    if (chip) {
        const s = chaves.get(chip.dataset.chave);
        if (!s || !perm.pode('sessoes_status')) return;
        voltarAoGrupo = null;
        voltarAoDia = null;
        abrirModalSessaoPara(s);
        return;
    }
    // toque no card do dia (fora dos chips): abre a agenda daquele dia
    const dia = e.target.closest('[data-iso]');
    if (dia && perm.pode('agenda_dia_modal')) abrirModalDia(dia.dataset.iso);
}

// ---------- modal "Agenda do dia" ----------
function abrirModalDia(iso) {
    diaAberto = iso;
    renderModalDia();
    abrirModal('modal-dia');
}

function renderModalDia() {
    if (!diaAberto) return;
    const iso = diaAberto;
    document.getElementById('modal-dia-titulo').textContent =
        `📅 ${DOW_NOMES[paraData(iso).getDay()]} · ${formataBR(iso)}`;
    const lista = sessoesDoIntervalo(iso, iso);
    const conflita = detectorConflito(lista);
    document.getElementById('dia-conteudo').innerHTML =
        conteudoDoDia(iso, lista, conflita, false)
        || '<p class="dim">Nenhuma sessão neste dia.</p>';
}

// chips dentro do modal do dia abrem o grupo/sessão e depois voltam ao dia
document.getElementById('dia-conteudo').addEventListener('click', (e) => {
    const chipGrupo = e.target.closest('[data-grupo]');
    if (chipGrupo) {
        voltarAoDia = diaAberto;
        fecharModal('modal-dia');
        abrirModalGrupo(chipGrupo.dataset.grupo, chipGrupo.dataset.grupoIso);
        return;
    }
    const chip = e.target.closest('[data-chave]');
    if (!chip) return;
    const s = chaves.get(chip.dataset.chave);
    if (!s || !perm.pode('sessoes_status')) return;
    voltarAoGrupo = null;
    voltarAoDia = diaAberto;
    fecharModal('modal-dia');
    abrirModalSessaoPara(s);
});

function abrirModalSessaoPara(s) {
    sessaoAberta = s;
    document.getElementById('sessao-info').innerHTML =
        `<b>${formataBR(s.data)} ${s.hora}</b> — ${esc(nomePac(s.paciente_id))}<br>
         <span class="dim">${esc(nomeSala(s.sala_id))} · ${esc(nomeProf(s.profissional_id))} · situação atual:
         <span class="chip-status" style="--c:${STATUS_SESSAO[s.status].cor}">${STATUS_SESSAO[s.status].label}</span></span>
         ${s.remarcada_de_data ? `<br><span class="dim">↪️ Sessão remarcada: era ${DOW_NOMES[paraData(s.remarcada_de_data).getDay()]} ${formataBR(s.remarcada_de_data)} às ${s.remarcada_de_hora}</span>` : ''}
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
    // restauração: sessão remarcada e ainda pendente volta ao horário original
    const podeRestaurar = !!(s.id && s.remarcada_de_data && s.status === '??' && perm.pode('sessao_restaurar'));
    document.getElementById('bloco-restaurar').style.display = podeRestaurar ? '' : 'none';
    if (podeRestaurar) {
        document.getElementById('restaurar-texto').textContent =
            `Desfazer a remarcação e devolver esta sessão para ${formataBR(s.remarcada_de_data)} às ${s.remarcada_de_hora}.`;
    }
    renderProfFreq(s);
    renderRepasseSessao(s);
    // interrupção/finalização do processo do paciente a partir de uma data
    const pacSessao = pacientes.find(p => p.id === s.paciente_id);
    const podeProcesso = perm.pode('processo_encerrar') && pacSessao && !pacSessao.processo_fim_data;
    document.getElementById('bloco-processo').style.display = podeProcesso ? '' : 'none';
    if (podeProcesso) {
        document.getElementById('proc-tipo').value = 'interrompido';
        document.getElementById('proc-data').value = s.data;
        document.getElementById('proc-motivo').value = '';
    }
    abrirModal('modal-sessao');
}

// aplica a interrupção/finalização do processo a partir do modal da sessão
document.getElementById('btn-proc-aplicar').addEventListener('click', async () => {
    const s = sessaoAberta;
    if (!s) return;
    const tipo = document.getElementById('proc-tipo').value;
    const data = document.getElementById('proc-data').value;
    const motivo = document.getElementById('proc-motivo').value.trim() || null;
    if (!data) { toast('Informe a data a partir da qual o processo para.', true); return; }
    const rotulo = tipo === 'finalizado' ? 'finalizado' : 'interrompido';
    if (!confirm(`Marcar o processo de ${nomePac(s.paciente_id)} como ${rotulo.toUpperCase()} a partir de ${formataBR(data)}?\nO paciente deixa de constar na agenda e nas finanças a partir dessa data.`)) return;
    const { error } = await sb.from('argos_pacientes').update({
        processo_fim_tipo: tipo, processo_fim_data: data, processo_fim_motivo: motivo
    }).eq('id', s.paciente_id);
    if (error) { console.error(error); toast('Erro ao registrar o encerramento.', true); return; }
    await registrarEvento(s.paciente_id, 'processo_' + tipo,
        `Processo ${rotulo} a partir de ${formataBR(data)}: o paciente deixa de constar na agenda e nas finanças a partir dessa data.`,
        { tipo, data }, motivo);
    toast(`Processo ${rotulo} a partir de ${formataBR(data)}.`);
    fecharModal('modal-sessao');
    voltarAoGrupo = null;
    retornarAoDiaSePreciso();
    await carregarTudo();
});

// desfaz a remarcação: a sessão volta para a data/hora original
document.getElementById('btn-restaurar').addEventListener('click', async () => {
    const s = sessaoAberta;
    if (!s || !s.id || !s.remarcada_de_data) return;
    const candidata = { ...s, data: s.remarcada_de_data, hora: s.remarcada_de_hora };
    const conflitos = conflitosDeSessao(candidata, dinamicas.filter(d => d.ativo !== false), sessoes);
    if (conflitos.length) {
        toast(`⛔ Conflito: ${nomePac(conflitos[0].paciente_id)} já ocupa o horário original no mesmo espaço/profissional.`, true);
        return;
    }
    const { error } = await sb.from('argos_sessoes').update({
        data: s.remarcada_de_data, hora: s.remarcada_de_hora,
        remarcada_de_data: null, remarcada_de_hora: null
    }).eq('id', s.id);
    if (error) { console.error(error); toast('Erro ao restaurar a sessão.', true); return; }
    await registrarEvento(s.paciente_id, 'remarcacao_desfeita',
        `Remarcação desfeita: a sessão voltou para ${formataBR(s.remarcada_de_data)} às ${s.remarcada_de_hora} (estava em ${formataBR(s.data)} às ${s.hora}).`,
        { de: { data: s.data, hora: s.hora }, para: { data: s.remarcada_de_data, hora: s.remarcada_de_hora } }, null);
    toast(`Sessão restaurada para ${formataBR(s.remarcada_de_data)} às ${s.remarcada_de_hora}.`);
    fecharModal('modal-sessao');
    retornarAoGrupoSePreciso();
    await recarregarSessoes();
});
document.getElementById('agenda-grade').addEventListener('click', aoClicarSessao);
document.getElementById('agenda-periodo').addEventListener('click', aoClicarSessao);

// ao sair de um modal aberto pelo modal do dia, volta ao dia
function retornarAoDiaSePreciso() {
    if (!voltarAoDia) return;
    const iso = voltarAoDia;
    voltarAoDia = null;
    setTimeout(() => abrirModalDia(iso), 60);
}

// ao sair do modal da sessão, volta ao modal do grupo (se veio de lá)
// ou ao modal do dia (se foi ele que abriu a sessão)
function retornarAoGrupoSePreciso() {
    if (!voltarAoGrupo) { retornarAoDiaSePreciso(); return; }
    const v = voltarAoGrupo;
    voltarAoGrupo = null;
    setTimeout(() => abrirModalGrupo(v.gid, v.iso), 60);
}
document.getElementById('modal-sessao').addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]') || e.target.id === 'modal-sessao') retornarAoGrupoSePreciso();
});
document.getElementById('modal-grupo').addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]') || e.target.id === 'modal-grupo') retornarAoDiaSePreciso();
});

document.getElementById('botoes-status').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-marcar]');
    if (!btn || !sessaoAberta) return;
    await marcarSessao(sessaoAberta, btn.dataset.marcar);
    fecharModal('modal-sessao');
    retornarAoGrupoSePreciso();
});


// ============================================================
// FREQUÊNCIA DO PROFISSIONAL E PAGAMENTO DA SESSÃO AVULSA
// ============================================================
// A presença do profissional vale para o HORÁRIO, não para o paciente: num
// grupo de seis, quem conduziu conduziu para todos. Por isso a linha é
// identificada por (profissional, data, hora, dinâmica).

const freqDoSlot = (s, profId) => profFreq.find(f =>
    f.profissional_id === profId && f.data === s.data && f.hora === s.hora
    && (f.dinamica_ref || null) === (s.dinamica_ref || null));

/** Quem já está no horário: os responsáveis da dinâmica mais os substitutos. */
function profissionaisDoSlot(s) {
    const d = dinamicas.find(x => x.id === s.dinamica_ref);
    const donos = d ? responsaveisDe(d) : (s.profissional_id ? [s.profissional_id] : []);
    const extras = profFreq.filter(f => f.data === s.data && f.hora === s.hora
        && (f.dinamica_ref || null) === (s.dinamica_ref || null))
        .map(f => f.profissional_id);
    return [...new Set([...donos, ...extras])];
}

function renderProfFreq(s) {
    const bloco = document.getElementById('bloco-prof-freq');
    if (!perm.pode('prof_frequencia')) { bloco.style.display = 'none'; return; }
    bloco.style.display = '';
    const lista = profissionaisDoSlot(s);
    const d = dinamicas.find(x => x.id === s.dinamica_ref);
    const donos = d ? responsaveisDe(d) : [];

    document.getElementById('prof-freq-lista').innerHTML = lista.length
        ? lista.map(id => {
            const f = freqDoSlot(s, id);
            const st = f ? f.status : '??';
            return `
          <div class="pendente-linha">
            <div><b>${esc(nomeProf(id))}</b>
              ${donos.includes(id) ? '' : '<span class="badge azul">cobrindo</span>'}
              ${f && f.obs ? `<br><span class="dim">📝 ${esc(f.obs)}</span>` : ''}</div>
            <span class="botoes-status compacto">
              ${ORDEM_STATUS_PROF.map(k => `
                <button class="btn-status ${st === k ? 'ativo' : ''}"
                  style="--c:${STATUS_PROF[k].cor}" title="${esc(STATUS_PROF[k].desc)}"
                  data-pf="${id}" data-pf-status="${k}">${STATUS_PROF[k].label}</button>`).join('')}
            </span>
            ${donos.includes(id) ? '' : `<button class="argos-btn small danger"
              data-pf-remover="${id}" title="Tirar do horário">🗑️</button>`}
          </div>`;
        }).join('')
        : '<p class="dica">Esta dinâmica não tem profissional responsável definido.</p>';

    const sel = document.getElementById('prof-freq-outro');
    const fora = profissionais.filter(p => !lista.includes(p.id));
    sel.innerHTML = fora.length
        ? fora.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')
        : '<option value="">(todos já estão no horário)</option>';
    sel.disabled = !fora.length;
}

async function gravarProfFreq(s, profId, status) {
    const d = dinamicas.find(x => x.id === s.dinamica_ref);
    const donos = d ? responsaveisDe(d) : [];
    const existente = freqDoSlot(s, profId);
    const linha = {
        profissional_id: profId, data: s.data, hora: s.hora,
        dinamica_ref: s.dinamica_ref || null, grupo_ref: s.grupo_ref || s.grupo_id || null,
        status, substituto: !donos.includes(profId), atualizado_em: new Date().toISOString()
    };
    const { error } = existente
        ? await sb.from('argos_prof_frequencia').update(linha).eq('id', existente.id)
        : await sb.from('argos_prof_frequencia').insert(linha);
    if (error) { console.error(error); toast('Erro ao marcar a frequência do profissional.', true); return; }
    const { data } = await todas(() => sb.from('argos_prof_frequencia').select('*'));
    profFreq = data || profFreq;
    renderProfFreq(s);
    toast(`${nomeProf(profId)}: ${STATUS_PROF[status].label}.`);
}

document.getElementById('prof-freq-lista').addEventListener('click', async (e) => {
    if (!sessaoAberta) return;
    const btn = e.target.closest('[data-pf-status]');
    if (btn) return gravarProfFreq(sessaoAberta, btn.dataset.pf, btn.dataset.pfStatus);
    const rm = e.target.closest('[data-pf-remover]');
    if (rm) {
        const f = freqDoSlot(sessaoAberta, rm.dataset.pfRemover);
        if (!f) return;
        const { error } = await sb.from('argos_prof_frequencia').delete().eq('id', f.id);
        if (error) { console.error(error); return toast('Erro ao tirar do horário.', true); }
        profFreq = profFreq.filter(x => x.id !== f.id);
        renderProfFreq(sessaoAberta);
        toast('Profissional tirado deste horário.');
    }
});

document.getElementById('btn-prof-freq-add').addEventListener('click', () => {
    const id = document.getElementById('prof-freq-outro').value;
    if (!id || !sessaoAberta) return;
    // entra já como presente: só se acrescenta quem de fato atendeu
    gravarProfFreq(sessaoAberta, id, 'ok');
});

function renderRepasseSessao(s) {
    const bloco = document.getElementById('bloco-repasse-sessao');
    // só faz sentido em sessão que existe de verdade e tem dinâmica com divisão
    const d = dinamicas.find(x => x.id === s.dinamica_ref);
    const temDivisao = d && repassesDe(d).some(r => r.valor);
    if (!perm.pode('sessao_repasse_avulso') || !s.id || !temDivisao) {
        bloco.style.display = 'none';
        return;
    }
    bloco.style.display = '';
    const sel = document.getElementById('repasse-prof');
    sel.innerHTML = '<option value="">Segue a divisão da dinâmica</option>'
        + profissionais.map(p => `<option value="${p.id}">${esc(p.nome)} recebe esta sessão</option>`).join('');
    sel.value = s.repasse_profissional_id || '';
    document.getElementById('repasse-motivo').value = s.repasse_motivo || '';
    document.getElementById('repasse-atual').innerHTML = s.repasse_profissional_id
        ? `💸 Hoje esta sessão é paga a <b>${esc(nomeProf(s.repasse_profissional_id))}</b>`
          + `${s.repasse_motivo ? ` — ${esc(s.repasse_motivo)}` : ''}.`
        : `Divisão atual: ${repassesDe(d).filter(r => r.valor)
            .map(r => `${esc(nomeProf(r.profissional_id))} ${r.tipo === 'valor' ? 'R$ ' + r.valor : r.valor + '%'}`)
            .join(' · ')}.`;
}

document.getElementById('btn-repasse-salvar').addEventListener('click', async () => {
    const s = sessaoAberta;
    if (!s || !s.id) return;
    const quem = document.getElementById('repasse-prof').value || null;
    const motivo = document.getElementById('repasse-motivo').value.trim() || null;
    const { error } = await sb.from('argos_sessoes').update({
        repasse_profissional_id: quem, repasse_motivo: quem ? motivo : null
    }).eq('id', s.id);
    if (error) { console.error(error); return toast('Erro ao salvar o pagamento da sessão.', true); }
    s.repasse_profissional_id = quem;
    s.repasse_motivo = quem ? motivo : null;
    const alvo = sessoes.find(x => x.id === s.id);
    if (alvo) { alvo.repasse_profissional_id = quem; alvo.repasse_motivo = s.repasse_motivo; }
    await registrarEvento(s.paciente_id, 'repasse_sessao',
        quem ? `Sessão de ${formataBR(s.data)} às ${s.hora} passa a ser paga a ${nomeProf(quem)}.`
             : `Sessão de ${formataBR(s.data)} às ${s.hora} volta a seguir a divisão da dinâmica.`,
        { data: s.data, hora: s.hora, profissional_id: quem }, motivo);
    toast(quem ? `Esta sessão será paga a ${nomeProf(quem)}.` : 'A sessão voltou a seguir a dinâmica.');
    renderRepasseSessao(s);
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
    const [rSes, rDin, rGru, rMem, rGP, rPF] = await Promise.all([
        todas(() => sb.from('argos_sessoes').select('*')),
        todas(() => sb.from('argos_dinamicas').select('*')),
        sb.from('argos_grupos').select('*').order('hora'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*'),
        todas(() => sb.from('argos_prof_frequencia').select('*'))
    ]);
    sessoes = rSes.data || sessoes;
    dinamicas = rDin.data || dinamicas;
    grupos = rGru.data || grupos;
    grupoMembros = rMem.data || grupoMembros;
    grupoProfs = rGP.data || grupoProfs;
    profFreq = rPF.data || profFreq;
    renderTudo();
    const modalGrupo = document.getElementById('modal-grupo');
    if (modalGrupo && modalGrupo.classList.contains('aberto') && grupoAberto) renderModalGrupo();
    const modalDia = document.getElementById('modal-dia');
    if (modalDia && modalDia.classList.contains('aberto') && diaAberto) renderModalDia();
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
    let error, voltar;
    if (s.id) {
        // o inverso é escrito ANTES de gravar, com os valores que a linha tinha
        const antes = { data: s.data, hora: s.hora,
            remarcada_de_data: s.remarcada_de_data || null,
            remarcada_de_hora: s.remarcada_de_hora || null };
        ({ error } = await sb.from('argos_sessoes').update({
            data: novaData, hora: novaHora,
            // guarda sempre a ocorrência ORIGINAL (1ª remarcação), para exibir
            // a origem e permitir restaurar
            remarcada_de_data: s.remarcada_de_data || s.data,
            remarcada_de_hora: s.remarcada_de_hora || s.hora
        }).eq('id', s.id));
        voltar = async () => {
            const { error: e } = await sb.from('argos_sessoes').update(antes).eq('id', s.id);
            if (e) throw e;
        };
    } else {
        // a sessão era só projeção: desfazer é apagar a linha que nasceu agora
        const { data: criada, error: e } = await sb.from('argos_sessoes').insert({
            paciente_id: s.paciente_id, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
            data: novaData, hora: novaHora, duracao_min: s.duracao_min || 60,
            sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
            servico_id: s.servico_id || null, status: '??',
            grupo_id: s.grupo_id || null, grupo_ref: s.grupo_ref || null,
            remarcada_de_data: s.data, remarcada_de_hora: s.hora
        }).select('id').single();
        error = e;
        voltar = async () => {
            const { error: e2 } = await sb.from('argos_sessoes').delete().eq('id', criada.id);
            if (e2) throw e2;
        };
    }
    if (error) { console.error(error); toast('Erro ao remarcar a sessão.', true); return; }
    armarDesfazer(`Remarcação de ${nomePac(s.paciente_id)} para ${formataBR(novaData)} ${novaHora}`, voltar);
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
        // saindo de um grupo, a continuação vira um horário individual próprio
        modalidade: d.grupo_id ? 'individual' : d.modalidade,
        grupo_id: null,
        sala_id: d.sala_id,
        profissional_id: d.profissional_id, servico_id: d.servico_id,
        acordo_tipo: d.acordo_tipo, valor: d.valor,
        repasses: repassesDe(d), // divisão com profissionais segue na continuação
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

    // guardado antes de mexer: a dinâmica velha volta ao fim que tinha, e a
    // sessão apagada volta com a linha inteira, não com uma aproximação
    const fimAntes = { fim_tipo: d.fim_tipo, fim_data: d.fim_data || null };
    const linhaDaSessao = s.id ? sessoes.find(x => x.id === s.id) : null;

    const { data: criada, error: e1 } = await sb.from('argos_dinamicas')
        .insert(nova).select('id').single();
    if (e1) { console.error(e1); toast('Erro ao criar a nova dinâmica.', true); return; }
    const { error: e2 } = await sb.from('argos_dinamicas')
        .update({ fim_tipo: 'data', fim_data: cutoff }).eq('id', d.id);
    if (e2) { console.error(e2); toast('Erro ao encerrar a dinâmica anterior.', true); return; }
    if (s.id) await sb.from('argos_sessoes').delete().eq('id', s.id);

    armarDesfazer(`Novo horário fixo de ${nomePac(d.paciente_id)}`, async () => {
        const { error: x1 } = await sb.from('argos_dinamicas').delete().eq('id', criada.id);
        if (x1) throw x1;
        const { error: x2 } = await sb.from('argos_dinamicas').update(fimAntes).eq('id', d.id);
        if (x2) throw x2;
        if (linhaDaSessao) {
            const { id, created_at, ...campos } = linhaDaSessao;
            const { error: x3 } = await sb.from('argos_sessoes').insert(campos);
            if (x3) throw x3;
        }
        await carregarTudo();
    });

    let extras = '';
    if (d.grupo_id) {
        const gAntigo = grupos.find(x => x.id === d.grupo_id);
        extras += ` O paciente deixa de frequentar o grupo "${gAntigo ? gAntigo.nome : ''}" a partir dessa data (as ocorrências anteriores ficam registradas no grupo).`;
    }
    if (d.fim_tipo === 'apos_ocorrencias') extras += ` Restavam ${nova.fim_ocorrencias} de ${d.fim_ocorrencias} ocorrências contratadas, que seguem na nova dinâmica.`;
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
    const participantes = membrosNaOcorrencia(g, iso);
    document.getElementById('modal-grupo-titulo').textContent = `👥 ${g.nome}`;
    document.getElementById('grupo-info').innerHTML =
        `<b>${DOW_NOMES[g.dow]} às ${g.hora}</b> · ocorrência de <b>${formataBR(iso)}</b> · 🚪 ${esc(nomeSala(g.sala_id))}${nomesProfsDoGrupo(g) ? ' · 🧑‍⚕️ ' + esc(nomesProfsDoGrupo(g)) : ''} · ${participantes.length} paciente(s) nesta ocorrência`;

    const mesclado = mesclarSessoes(dinamicas, sessoes, iso, iso);
    const outrosGrupos = grupos.filter(x => x.id !== g.id && x.ativo !== false);
    const podeStatus = perm.pode('sessoes_status');

    document.getElementById('grupo-membros').innerHTML = participantes.map(m => {
        const p = pacientes.find(x => x.id === m.paciente_id) || { nome: '(paciente?)' };
        const movida = sessaoMovidaDaOcorrencia(m.paciente_id, g, iso);
        if (movida) {
            // a sessão desta ocorrência foi remarcada: tudo se faz no novo horário
            return `
            <div class="argos-bloco pendente-linha" data-membro="${m.paciente_id}">
              <div class="bloco-info">
                <b>${esc(p.nome)}</b> — ↪️ movida para <b>${formataBR(movida.data)} às ${movida.hora}</b>
                <span class="chip-status" style="--c:${STATUS_SESSAO[movida.status].cor}">${STATUS_SESSAO[movida.status].label}</span>
                <br><span class="dim">Toque para abrir a sessão no novo horário (marcar, remarcar de novo ou restaurar).</span>
              </div>
              <div class="agenda-nav">
                <select class="argos-input" data-membro-acao>
                  <option value="">⋯</option>
                  ${outrosGrupos.map(o => `<option value="mover:${o.id}">→ Mover para ${esc(o.nome)}</option>`).join('')}
                  <option value="remover">✖ Remover do grupo</option>
                </select>
              </div>
            </div>`;
        }
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
    }).join('') || '<p class="dim">Nenhum paciente nesta ocorrência do grupo.</p>';

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
    // ocorrência remarcada: as ações acontecem na sessão do NOVO horário
    const movida = sessaoMovidaDaOcorrencia(pacId, g, iso);
    if (movida) return { ...movida };
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
    // a troca com quem já ocupava o destino também precisa voltar: fotografa
    // os dois lados antes, e desfazer restaura ambos
    const ocupante = grupoOcupante(registro, g.id);
    const fotos = [fotoDoGrupo(g.id), ocupante ? fotoDoGrupo(ocupante.id) : null].filter(Boolean);
    const dowAntes = g.dow;
    const ok = await salvarSlotDeGrupo(g.id, registro);
    if (!ok) return;
    armarDesfazer(`Grupo "${g.nome}" de ${DOW_NOMES[dowAntes]} para ${DOW_NOMES[novoDow]}`,
        async () => {
            for (const f of fotos) await restaurarFotoDeGrupo(f);
            await carregarTudo();
        });
    toast(`Grupo "${g.nome}" movido para ${DOW_NOMES[novoDow]}.`);
    await recarregarSessoes();
}

// ---------- desfazer a última mudança de horário ----------
// A "dança das cadeiras" da agenda é onde mais se erra: arrastou para o dia
// errado, mudou o horário fixo sem querer, trocou o grupo de dia. Cada uma
// dessas mudanças guarda o SEU INVERSO exato — não um "recarregar e torcer" —
// e Ctrl+Z (ou o botão) desfaz a última. Um nível só: desfazer o desfazer
// seria refazer, e aí a conta de quem mexeu em quê deixa de fechar.
//
// De propósito, só as mudanças de horário entram aqui. Marcar frequência,
// apagar grupo ou mexer em espaço continuam sem desfazer: são coisas que a
// pessoa faz olhando, não arrastando.
let desfazerPendente = null;

function armarDesfazer(descricao, executar) {
    desfazerPendente = { descricao, executar };
    mostrarDesfazer();
}

function mostrarDesfazer() {
    const barra = document.getElementById('aviso-desfazer');
    if (!desfazerPendente) { barra.style.display = 'none'; return; }
    document.getElementById('aviso-desfazer-texto').textContent =
        `↩️ ${desfazerPendente.descricao}`;
    barra.style.display = '';
}

async function executarDesfazer() {
    if (!desfazerPendente) { toast('Não há mudança de horário para desfazer.', true); return; }
    const { descricao, executar } = desfazerPendente;
    // solta antes de executar: se der erro no meio, não fica um desfazer
    // pela metade esperando um segundo clique que repetiria o estrago
    desfazerPendente = null;
    mostrarDesfazer();
    try {
        await executar();
    } catch (e) {
        console.error(e);
        toast('Não deu para desfazer. Confira a agenda.', true);
        return;
    }
    toast(`Desfeito: ${descricao.charAt(0).toLowerCase()}${descricao.slice(1)}`);
    await recarregarSessoes();
}

document.getElementById('btn-desfazer').addEventListener('click', executarDesfazer);
document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
    // dentro de um campo, Ctrl+Z é do campo — desfazer o que se está digitando
    const alvo = e.target;
    if (alvo && alvo.closest && alvo.closest('input, textarea, select, [contenteditable]')) return;
    if (!desfazerPendente) return;
    e.preventDefault();
    executarDesfazer();
});

/** Foto do grupo e das dinâmicas presas a ele, para poder voltar tudo. */
function fotoDoGrupo(gid) {
    const g = grupos.find(x => x.id === gid);
    if (!g) return null;
    return {
        grupo: { id: g.id, dow: g.dow, hora: g.hora, sala_id: g.sala_id, duracao_min: g.duracao_min },
        dinamicas: dinamicas.filter(d => d.grupo_id === gid).map(d => ({
            id: d.id, dias: d.dias, sala_id: d.sala_id, duracao_min: d.duracao_min
        }))
    };
}

async function restaurarFotoDeGrupo(foto) {
    if (!foto) return;
    const { id, ...campos } = foto.grupo;
    const { error } = await sb.from('argos_grupos').update(campos).eq('id', id);
    if (error) throw error;
    for (const d of foto.dinamicas) {
        const { id: did, ...camposD } = d;
        await sb.from('argos_dinamicas').update(camposD).eq('id', did);
    }
}

// ---------- confirmação de mudança ----------
// Arrastar é fácil de fazer sem querer: um clique que escorrega já remarca a
// sessão de alguém, ou muda o dia fixo de um grupo inteiro. Antes de gravar,
// a janela diz em palavras o que vai acontecer — de onde, para onde, e a quem
// isso afeta.
let confirmarResolve = null;

function pedirConfirmacao({ titulo, texto, detalhe = '', aviso = '', botao = 'Confirmar' }) {
    document.getElementById('confirma-titulo').textContent = titulo;
    document.getElementById('confirma-texto').textContent = texto;
    document.getElementById('confirma-detalhe').innerHTML = detalhe;
    document.getElementById('confirma-aviso').textContent = aviso;
    document.getElementById('btn-confirma-sim').textContent = botao;
    abrirModal('modal-confirma');
    return new Promise(resolve => { confirmarResolve = resolve; });
}

function responderConfirmacao(valor) {
    const resolve = confirmarResolve;
    confirmarResolve = null;
    fecharModal('modal-confirma');
    if (resolve) resolve(valor);
}

document.getElementById('btn-confirma-sim').addEventListener('click', () => responderConfirmacao(true));
document.getElementById('btn-confirma-nao').addEventListener('click', () => responderConfirmacao(false));
// fechar pelo × ou pelo fundo é o mesmo que desistir — nunca "sim" por omissão
document.getElementById('modal-confirma').addEventListener('click', e => {
    if (e.target.closest('[data-fechar]') || e.target.id === 'modal-confirma') {
        responderConfirmacao(false);
    }
});

const diaPorExtenso = iso => `${formataBR(iso)} (${DOW_NOMES[paraData(iso).getDay()]})`;

/** Ler antes de mover: de onde sai, para onde vai. */
const deParaHTML = (de, para) =>
    `<div class="confirma-de-para"><span class="de">${esc(de)}</span>
       <span class="seta">→</span><span class="para">${esc(para)}</span></div>`;

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
            if (!g) return;
            const novoDow = dowDe(alvoIso);
            if (g.dow === novoDow) return;
            const quantos = membrosDoGrupo(g.id).length;
            const sim = await pedirConfirmacao({
                titulo: 'Mudar o dia do grupo?',
                texto: `O grupo "${g.nome}" passa a acontecer noutro dia da semana.`,
                detalhe: deParaHTML(`${DOW_NOMES[g.dow]} ${g.hora}`, `${DOW_NOMES[novoDow]} ${g.hora}`),
                aviso: quantos
                    ? `Muda o horário fixo de ${quantos} paciente(s) do grupo.`
                    : 'O grupo ainda não tem pacientes.',
                botao: 'Mudar o dia'
            });
            if (sim) await moverGrupo(g, novoDow);
        } else {
            const s = chaves.get(payload.chave);
            if (!s) return;
            if (s.status !== '??') { toast('Só sessões pendentes («??») podem ser movidas.', true); return; }
            if (s.data === alvoIso) return;
            const sim = await pedirConfirmacao({
                titulo: 'Remarcar a sessão?',
                texto: `A sessão de ${nomePac(s.paciente_id)} muda de dia.`,
                detalhe: deParaHTML(`${diaPorExtenso(s.data)} ${s.hora}`,
                                    `${diaPorExtenso(alvoIso)} ${s.hora}`),
                aviso: 'O horário continua o mesmo. A sessão original fica registrada como remarcada.',
                botao: 'Remarcar'
            });
            if (sim) await iniciarRemarcacao(s, alvoIso, s.hora, null);
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

// ---------------------------------------------------------------------------
// Importar a frequência do mês, com conferência item a item
// ---------------------------------------------------------------------------
// A planilha chega em cima de um mês que já está em uso: alguém já preencheu
// faltas na agenda, cobranças já podem ter sido enviadas. Por isso nada é
// gravado direto — o sistema mostra o que mudaria e quem está olhando aprova.

let imesPlano = null;                  // último plano conferido
const imesAprovadas = new Set();       // ids das mudanças marcadas

const imesEl = id => document.getElementById(id);

document.getElementById('btn-imp-mes').addEventListener('click', () => {
    imesPlano = null; imesAprovadas.clear();
    imesEl('imes-mes').value = hojeISO().slice(0, 7);
    imesEl('imes-texto').value = '';
    imesEl('imes-arquivo').value = '';
    imesEl('imes-nome-arquivo').textContent = '';
    imesEl('imes-resumo').innerHTML = '';
    imesEl('imes-lista').innerHTML = '';
    imesEl('imes-barra-selecao').style.display = 'none';
    imesEl('imes-acoes').style.display = 'none';
    abrirModal('modal-imp-mes');
});

document.getElementById('btn-imes-arquivo').addEventListener('click', () => imesEl('imes-arquivo').click());

document.getElementById('imes-arquivo').addEventListener('change', async (e) => {
    const arq = e.target.files && e.target.files[0];
    if (!arq) return;
    imesEl('imes-nome-arquivo').textContent = arq.name;
    // o nome do arquivo costuma dizer o mês ("…_AGO.xlsx"); se disser, obedece
    const { mesDoArquivo } = await import('./argos-import-freq.js');
    const m = mesDoArquivo(arq.name);
    if (m) {
        const ano = (/(20\d{2})/.exec(arq.name) || [])[1] || String(new Date().getFullYear());
        imesEl('imes-mes').value = `${ano}-${String(m).padStart(2, '0')}`;
    }
    try {
        imesEl('imes-texto').value = /\.xlsx?$/i.test(arq.name)
            ? await textoDeXlsx(arq) : await arq.text();
        toast('Arquivo lido. Confira o que vai mudar.');
    } catch (err) {
        console.error(err);
        toast(String(err.message || err), true);
    }
});

/** XLSX → CSV, pela primeira aba. Sem internet, pede o CSV em vez de quebrar. */
async function textoDeXlsx(arq) {
    let XLSX;
    try {
        XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    } catch (e) {
        throw new Error('Não consegui carregar o leitor de XLSX. Salve a aba como CSV e envie o CSV.');
    }
    const wb = XLSX.read(await arq.arrayBuffer(), { type: 'array' });
    const aba = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(aba);
}

document.getElementById('btn-imes-conferir').addEventListener('click', async () => {
    const texto = imesEl('imes-texto').value.trim();
    const mesRef = imesEl('imes-mes').value;
    if (!texto) { toast('Envie o arquivo ou cole o conteúdo da planilha.', true); return; }
    if (!mesRef) { toast('Diga de que mês é esta planilha.', true); return; }
    const [ano, mes] = mesRef.split('-').map(Number);

    const { lerFrequencia } = await import('./argos-import-freq.js');
    const { planoDoMes } = await import('./argos-import-mes.js');
    const { linhas, avisos } = lerFrequencia(texto, { ano, mes });
    if (!linhas.length) {
        imesEl('imes-resumo').innerHTML =
            `<p class="dica">⛔ Não reconheci nenhuma linha de frequência nesse conteúdo.${
                avisos.length ? ' ' + esc(avisos[0]) : ''}</p>`;
        imesEl('imes-lista').innerHTML = '';
        imesEl('imes-barra-selecao').style.display = 'none';
        imesEl('imes-acoes').style.display = 'none';
        return;
    }
    imesPlano = planoDoMes({ linhas, pacientes, profissionais, sessoes, dinamicas, ano, mes });
    imesPlano.avisosLeitura = avisos;
    // por padrão tudo o que dá para aplicar vem marcado: o caso comum é
    // aprovar o mês inteiro, e desmarcar o que destoa é menos trabalho
    imesAprovadas.clear();
    imesPlano.mudancas.forEach(m => { if (m.aplicavel) imesAprovadas.add(m.id); });
    renderImes();
});

function renderImes() {
    if (!imesPlano) return;
    const { mudancas, resumo, avisosLeitura } = imesPlano;
    import('./argos-import-mes.js').then(({ TIPOS, ORDEM_TIPOS, frase }) => {
        imesEl('imes-resumo').innerHTML =
            `<p class="dica"><b>${esc(frase(resumo))}</b>${
                resumo.bloqueada ? ` ${resumo.bloqueada} linha(s) não dá para aplicar.` : ''}${
                (avisosLeitura || []).length ? `<br><span class="dim">${avisosLeitura.length} aviso(s) de leitura: ${
                    esc(avisosLeitura.slice(0, 3).join(' '))}</span>` : ''}</p>`;

        const blocos = ORDEM_TIPOS
            .map(t => ({ tipo: t, meta: TIPOS[t], itens: mudancas.filter(m => m.tipo === t) }))
            .filter(b => b.itens.length);

        imesEl('imes-lista').innerHTML = blocos.map(b => `
          <div class="argos-bloco">
            <div class="bloco-topo">
              <b>${b.meta.icone} ${b.meta.rotulo} <span class="dim">(${b.itens.length})</span></b>
              ${b.itens.some(i => i.aplicavel)
                ? `<span>
                     <button class="argos-btn small" data-imes-bloco="${b.tipo}" data-marcar="1">☑️ marcar bloco</button>
                     <button class="argos-btn small" data-imes-bloco="${b.tipo}" data-marcar="">☐ desmarcar</button>
                   </span>` : ''}
            </div>
            <p class="dica" style="margin:2px 0 6px">${b.meta.ajuda}</p>
            <div class="bloco-info">
              ${b.itens.map(i => `
                <label class="linha-check imes-item${i.aplicavel ? '' : ' dim'}">
                  <input type="checkbox" data-imes-id="${esc(i.id)}"
                    ${i.aplicavel ? '' : 'disabled'} ${imesAprovadas.has(i.id) ? 'checked' : ''} />
                  <span><b>${esc(i.rotulo)}</b> — ${esc(i.detalhe)}</span>
                </label>`).join('')}
            </div>
          </div>`).join('') || '<p class="dim">Nada a mudar.</p>';

        imesEl('imes-barra-selecao').style.display = resumo.aplicaveis ? '' : 'none';
        imesEl('imes-acoes').style.display = resumo.aplicaveis ? '' : 'none';
        atualizarContadorImes();
    });
}

function atualizarContadorImes() {
    const total = imesPlano ? imesPlano.resumo.aplicaveis : 0;
    imesEl('imes-contador').textContent = `${imesAprovadas.size} de ${total} aprovada(s)`;
    imesEl('btn-imes-aplicar').disabled = !imesAprovadas.size;
}

document.getElementById('imes-lista').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-imes-id]');
    if (!cb) return;
    if (cb.checked) imesAprovadas.add(cb.dataset.imesId); else imesAprovadas.delete(cb.dataset.imesId);
    atualizarContadorImes();
});

document.getElementById('imes-lista').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-imes-bloco]');
    if (!btn || !imesPlano) return;
    const marcar = !!btn.dataset.marcar;
    for (const m of imesPlano.mudancas) {
        if (m.tipo !== btn.dataset.imesBloco || !m.aplicavel) continue;
        if (marcar) imesAprovadas.add(m.id); else imesAprovadas.delete(m.id);
    }
    renderImes();
});

const marcarTodasImes = (marcar) => {
    if (!imesPlano) return;
    imesAprovadas.clear();
    if (marcar) imesPlano.mudancas.forEach(m => { if (m.aplicavel) imesAprovadas.add(m.id); });
    renderImes();
};
document.getElementById('btn-imes-todos').addEventListener('click', () => marcarTodasImes(true));
document.getElementById('btn-imes-nenhum').addEventListener('click', () => marcarTodasImes(false));

document.getElementById('btn-imes-aplicar').addEventListener('click', async () => {
    if (!imesPlano || !imesAprovadas.size) return;
    const { loteDeAcoes } = await import('./argos-import-mes.js');
    const escolhidas = imesPlano.mudancas.filter(m => m.aplicavel && imesAprovadas.has(m.id));
    const conta = escolhidas.reduce((c, m) => (c[m.tipo] = (c[m.tipo] || 0) + 1, c), {});
    if (conta.sobra && !confirm(
        `${conta.sobra} sessão(ões) serão EXCLUÍDAS do sistema por não estarem na planilha.\n\n`
        + 'Isso não pode ser desfeito. Confirmar a importação?')) return;

    const lote = loteDeAcoes(escolhidas);
    const btn = imesEl('btn-imes-aplicar');
    btn.disabled = true; btn.textContent = 'Aplicando…';
    try {
        for (const { tabela, registros } of lote.inserir) {
            for (let i = 0; i < registros.length; i += 200) {
                const { error } = await sb.from(tabela).insert(registros.slice(i, i + 200));
                if (error) throw error;
            }
        }
        for (const u of lote.atualizar) {
            const { error } = await sb.from(u.tabela).update(u.campos).eq('id', u.id);
            if (error) throw error;
        }
        for (const { tabela, ids } of lote.excluir) {
            for (let i = 0; i < ids.length; i += 200) {
                const { error } = await sb.from(tabela).delete().in('id', ids.slice(i, i + 200));
                if (error) throw error;
            }
        }
    } catch (err) {
        console.error(err);
        toast('Erro ao aplicar a importação. Nada mais foi gravado.', true);
        btn.disabled = false; btn.textContent = 'Aplicar as aprovadas';
        return;
    }
    toast(`${escolhidas.length} alteração(ões) aplicada(s).`);
    btn.disabled = false; btn.textContent = 'Aplicar as aprovadas';
    fecharModal('modal-imp-mes');
    imesPlano = null; imesAprovadas.clear();
    avisarMudanca({ origem: 'importacao-mes' });
    await carregarTudo();
});
