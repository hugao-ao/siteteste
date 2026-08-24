// producao.js — Card "Produção e Assiduidade" da área Argos
// =========================================================
// Lê o mês pelo motor de argos-producao.js e mostra três recortes:
// o que cada profissional gerou e custou, as sessões que foram pagas a
// quem cobriu, e os horários cuja frequência ainda não foi marcada.

import { sb, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { formataMoeda, formataBR, hojeISO } from './argos-recorrencia.js';
import { producaoDoMes, STATUS_PROF, ORDEM_STATUS_PROF } from './argos-producao.js';
import { mesBR } from './argos-cobranca.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], presencas = [];
let mesAtual = hojeISO().slice(0, 7);
let resultado = null;

const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '—';

const REMUNERACAO = {
    producao: 'Recebe por produção',
    fixo: 'Remuneração fixa mensal',
    producao_fixo: 'Fixo mensal + produção'
};

async function carregarTudo() {
    const [rPac, rDin, rSes, rProf, rPF] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_prof_frequencia').select('*')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error || rPF.error;
    if (erro) { console.error(erro); toast('Erro ao carregar a produção.', true); return; }
    pacientes = rPac.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    profissionais = rProf.data || [];
    presencas = rPF.data || [];
    render();
}

function render() {
    mesAtual = document.getElementById('mes-ref').value || mesAtual;
    resultado = producaoDoMes({ pacientes, dinamicas, sessoes, profissionais, presencas, mes: mesAtual });
    renderProfissionais();
    renderSubstituicoes();
    renderPendentes();
}

// ------------------------------------------------------------ por profissional
function renderProfissionais() {
    const { porProfissional, faturamento, totalRepasses, clinica } = resultado;
    const aPreencher = porProfissional.reduce((s, c) => s + c.aPreencher, 0);
    const faltas = porProfissional.reduce((s, c) => s + c.faltas, 0);

    document.getElementById('pr-resumo').innerHTML = `
      <span>Faturamento do mês <b>${formataMoeda(faturamento)}</b></span>
      <span>Repasses <b>${formataMoeda(totalRepasses)}</b></span>
      <span class="${clinica >= 0 ? 'ok' : 'alerta'}">Parte da clínica <b>${formataMoeda(clinica)}</b></span>
      <span>Profissionais com movimento <b>${porProfissional.length}</b></span>
      ${faltas ? `<span class="alerta">Faltas no mês <b>${faltas}</b></span>` : ''}
      ${aPreencher ? `<span class="alerta">Horários sem frequência <b>${aPreencher}</b></span>` : ''}`;

    document.getElementById('pr-cards').innerHTML = porProfissional.map(c => {
        const pct = c.assiduidade == null ? null : Math.round(c.assiduidade * 100);
        const classe = pct == null ? '' : pct >= 90 ? '' : pct >= 70 ? 'media' : 'ruim';
        return `
      <div class="pr-card">
        <h3>${esc(c.profissional.nome)}</h3>
        <div class="papel">${esc(REMUNERACAO[c.profissional.remuneracao_tipo] || 'Sem forma de remuneração definida')}</div>

        ${c.fixo ? `<div class="pr-linha"><span class="dim">Fixo mensal</span><span>${formataMoeda(c.fixo)}</span></div>` : ''}
        <div class="pr-linha"><span class="dim">Produção</span><span>${formataMoeda(c.producao)}</span></div>
        ${c.recebidoDeOutros ? `<div class="pr-linha"><span class="dim">— atendendo para outros</span>
            <span>${formataMoeda(c.recebidoDeOutros)}</span></div>` : ''}
        ${c.cedidoAOutros ? `<div class="pr-linha"><span class="dim">— cedido a quem cobriu</span>
            <span style="color:var(--argos-warn)">− ${formataMoeda(c.cedidoAOutros)}</span></div>` : ''}
        <div class="pr-linha total"><span>Total a receber</span><span>${formataMoeda(c.total)}</span></div>

        <div class="pr-linha" style="margin-top:10px">
          <span class="dim">Assiduidade</span>
          <span>${pct == null ? '<span class="dim">sem marcação</span>' : pct + '%'}</span>
        </div>
        <div class="pr-barra ${classe}"><i style="width:${pct == null ? 0 : pct}%"></i></div>
        <div class="pr-freq">
          ${ORDEM_STATUS_PROF.filter(k => c.contagens[k]).map(k =>
            `<span style="--c:${STATUS_PROF[k].cor}" title="${esc(STATUS_PROF[k].desc)}">${STATUS_PROF[k].label}: ${c.contagens[k]}</span>`).join('')
            || '<span style="--c:var(--argos-border)">Nenhum horário no mês</span>'}
        </div>

        ${c.coberturas.length ? `<ul class="pr-cobertura">${c.coberturas.map(x =>
            `<li>🔁 Atendeu ${x.sessoes}× no lugar de <b>${esc(nomeProf(x.de))}</b> e recebeu ${formataMoeda(x.valor)}</li>`).join('')}</ul>` : ''}
        ${c.cobertoPor.length ? `<ul class="pr-cobertura">${c.cobertoPor.map(x =>
            `<li>🤝 Foi coberto ${x.sessoes}× por <b>${esc(nomeProf(x.por))}</b>, cedendo ${formataMoeda(x.valor)}</li>`).join('')}</ul>` : ''}
      </div>`;
    }).join('');
    document.getElementById('pr-vazio').style.display = porProfissional.length ? 'none' : '';
}

// -------------------------------------------------------------- substituições
function renderSubstituicoes() {
    const lista = [...resultado.substituicoes]
        .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
    const total = lista.reduce((s, x) => s + x.valor, 0);
    document.getElementById('sub-resumo').innerHTML = lista.length ? `
      <span>Sessões redirecionadas <b>${lista.length}</b></span>
      <span>Valor redirecionado <b>${formataMoeda(total)}</b></span>
      <span>Profissionais que cobriram <b>${new Set(lista.map(x => x.recebeu)).size}</b></span>`
      : '<span>Nenhuma sessão redirecionada neste mês.</span>';

    document.getElementById('tbody-sub').innerHTML = lista.map(x => `
      <tr>
        <td>${formataBR(x.data)} ${esc(x.hora)}</td>
        <td class="livre">${esc(nomePac(x.paciente_id))}</td>
        <td class="livre">${esc(x.rotulo || '—')}</td>
        <td><b>${esc(nomeProf(x.recebeu))}</b></td>
        <td class="livre">${x.donos.map(d => esc(nomeProf(d))).join(', ') || '—'}</td>
        <td>${formataMoeda(x.valor)}</td>
        <td class="livre">${esc(x.motivo || '—')}</td>
      </tr>`).join('');
    document.getElementById('sub-vazio').style.display = lista.length ? 'none' : '';
}

// ------------------------------------------------------------------ pendentes
function renderPendentes() {
    const lista = resultado.porProfissional.filter(c => c.aPreencher > 0)
        .sort((a, b) => b.aPreencher - a.aPreencher);
    const total = lista.reduce((s, c) => s + c.aPreencher, 0);
    document.getElementById('pend-resumo').innerHTML = total
        ? `<span class="alerta">Horários sem frequência <b>${total}</b></span>
           <span>Profissionais <b>${lista.length}</b></span>`
        : '<span class="ok">Nenhum horário pendente neste mês.</span>';

    document.getElementById('tbody-pend').innerHTML = lista.map(c => `
      <tr>
        <td>${esc(c.profissional.nome)}</td>
        <td>${c.slots}</td>
        <td><b style="color:var(--argos-warn)">${c.aPreencher}</b></td>
        <td>${c.slots - c.aPreencher}</td>
      </tr>`).join('');
    document.getElementById('pend-vazio').style.display = lista.length ? 'none' : '';
}

// ---------------------------------------------------------------------- eventos
document.getElementById('pr-abas').addEventListener('click', e => {
    const b = e.target.closest('[data-aba]');
    if (!b) return;
    document.querySelectorAll('#pr-abas .aba').forEach(x =>
        x.classList.toggle('ativa', x === b));
    document.querySelectorAll('[data-painel]').forEach(s =>
        s.style.display = s.dataset.painel === b.dataset.aba ? '' : 'none');
});

function mudarMes(delta) {
    const el = document.getElementById('mes-ref');
    let [a, m] = (el.value || mesAtual).split('-').map(Number);
    m += delta;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    el.value = `${a}-${String(m).padStart(2, '0')}`;
    render();
}
document.getElementById('btn-mes-ant').addEventListener('click', () => mudarMes(-1));
document.getElementById('btn-mes-prox').addEventListener('click', () => mudarMes(1));
document.getElementById('mes-ref').addEventListener('change', render);
document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('producao_ver') && !perm.master) {
        document.querySelector('main').innerHTML =
            '<p class="dim" style="padding:30px">Sem permissão para ver a produção.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    document.getElementById('mes-ref').value = mesAtual;
    await carregarTudo();
})();
