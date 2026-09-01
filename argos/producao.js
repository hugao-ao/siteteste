// producao.js — Card "Produção e Assiduidade" da área Argos
// =========================================================
// Lê o mês pelo motor de argos-producao.js e mostra três recortes:
// o que cada profissional gerou e custou, as sessões que foram pagas a
// quem cobriu, e os horários cuja frequência ainda não foi marcada.

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    formataMoeda, formataBR, hojeISO, fechamentoPaciente, definirRepassePadrao
} from './argos-recorrencia.js';
import { producaoDoMes, STATUS_PROF, ORDEM_STATUS_PROF } from './argos-producao.js';
import { mesBR } from './argos-cobranca.js';
import {
    usarFechamento, abertoPorPaciente, retencoesSugeridas,
    acertoDoMes, mensagemAcerto, mesCurto
} from './argos-repasses.js';

usarFechamento(fechamentoPaciente);

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], presencas = [];
let alocacoes = [], retencoes = [], acertos = [], mensagens = [];
let mesAtual = hojeISO().slice(0, 7);
let resultado = null, repasses = [];
const producaoCache = new Map();   // 'YYYY-MM' → resultado de producaoDoMes

const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '—';

const REMUNERACAO = {
    producao: 'Recebe por produção',
    fixo: 'Remuneração fixa mensal',
    producao_fixo: 'Fixo mensal + produção'
};

async function carregarTudo() {
    const [rPac, rDin, rSes, rProf, rPF, rAloc, rRet, rAc, rMsg] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_prof_frequencia').select('*')),
        todas(() => sb.from('argos_mov_alocacoes').select('*')),
        sb.from('argos_repasse_retencoes').select('*'),
        sb.from('argos_repasse_acertos').select('*'),
        sb.from('argos_repasse_mensagens').select('*')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error || rPF.error
        || rAloc.error || rRet.error || rAc.error || rMsg.error;
    if (erro) { console.error(erro); toast('Erro ao carregar a produção.', true); return; }
    pacientes = rPac.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    profissionais = rProf.data || [];
    presencas = rPF.data || [];
    alocacoes = rAloc.data || [];
    retencoes = rRet.data || [];
    acertos = rAc.data || [];
    mensagens = rMsg.data || [];
    definirRepassePadrao(profissionais);
    render();
}

function render() {
    mesAtual = document.getElementById('mes-ref').value || mesAtual;
    producaoCache.clear();
    resultado = producaoDe(mesAtual);
    renderProfissionais();
    renderSubstituicoes();
    renderRepasses();
    renderPendentes();
}

/** Produção de um mês qualquer, calculada uma vez só por carga. */
function producaoDe(mes) {
    if (!producaoCache.has(mes)) {
        producaoCache.set(mes, producaoDoMes({
            pacientes, dinamicas, sessoes, profissionais, presencas, mes }));
    }
    return producaoCache.get(mes);
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

// ------------------------------------------------------------------- repasses
// O acerto do mês: produção + fixo − o que ficou retido + o que foi liberado.
// A retenção é uma linha guardada, não uma conta refeita — o profissional
// precisa saber o que a clínica está devendo a ele e por causa de quem.

function acertosDoMes() {
    const porId = new Map(resultado.porProfissional.map(c => [c.profissional.id, c]));
    // quem só aparece por causa de retenção/liberação também precisa de card
    for (const r of retencoes) {
        if (porId.has(r.profissional_id)) continue;
        const toca = r.retido_em === mesAtual || r.liberado_em === mesAtual || r.status === 'retido';
        if (!toca) continue;
        porId.set(r.profissional_id, {
            profissional: profissionais.find(p => p.id === r.profissional_id)
                || { id: r.profissional_id, nome: '—' },
            producao: 0, fixo: 0
        });
    }
    return [...porId.values()].map(c => acertoDoMes({
        profissional: c.profissional,
        producao: c.producao, fixo: c.fixo, mes: mesAtual,
        retencoes: retencoes.filter(r => r.profissional_id === c.profissional.id)
    })).filter(a => a.total !== 0 || a.retidasAgora.length || a.liberadasAgora.length
        || a.aindaRetidas.length)
      .sort((a, b) => b.total - a.total);
}

const fechamentoDe = (profId, mes) =>
    acertos.find(a => a.profissional_id === profId && a.mes === mes);

function renderRepasses() {
    repasses = acertosDoMes();
    const soma = campo => repasses.reduce((s, a) => s + a[campo], 0);
    const fechados = repasses.filter(a => fechamentoDe(a.profissional.id, mesAtual)).length;

    document.getElementById('rp-resumo').innerHTML = repasses.length ? `
      <span>Produção do mês <b>${formataMoeda(soma('producao') + soma('fixo'))}</b></span>
      ${soma('retido') ? `<span class="alerta">Retido <b>${formataMoeda(soma('retido'))}</b></span>` : ''}
      ${soma('liberado') ? `<span class="ok">Liberado <b>${formataMoeda(soma('liberado'))}</b></span>` : ''}
      <span>A pagar <b>${formataMoeda(soma('total'))}</b></span>
      ${soma('saldoAReceber') ? `<span class="alerta">Aguardando pagamento
          <b>${formataMoeda(soma('saldoAReceber'))}</b></span>` : ''}
      <span class="${fechados === repasses.length ? 'ok' : ''}">Acertos fechados
        <b>${fechados}/${repasses.length}</b></span>`
      : '<span>Nada a repassar neste mês.</span>';

    document.getElementById('rp-cards').innerHTML = repasses.map(cartaoAcerto).join('');
    document.getElementById('rp-vazio').style.display = repasses.length ? 'none' : '';
}

function cartaoAcerto(a) {
    const podeReter = perm.master || perm.pode('repasses_reter');
    const fechado = fechamentoDe(a.profissional.id, mesAtual);
    const linha = (r, sinal) => {
        const menos = sinal === '−';
        // no MENOS interessa por que o valor está saindo; no MAIS, que o
        // paciente regularizou e de qual mês era o repasse que voltou
        const quem = menos
            ? esc(r.motivo || nomePac(r.paciente_id))
            : `${esc(nomePac(r.paciente_id))} regularizou ${esc(mesCurto(r.mes_producao))}`;
        return `
      <div class="rp-item">
        <span class="quem">${quem}
          ${menos && r.observacao ? `<span class="obs">${esc(r.observacao)}</span>` : ''}</span>
        <span class="valor ${menos ? 'menos' : 'mais'}">${sinal} ${formataMoeda(r.valor)}</span>
        ${menos && podeReter
            ? `<button class="argos-btn ghost" data-rp="desfazer" data-id="${r.id}"
                 title="Tirar esta retenção">✕</button>` : ''}
      </div>`;
    };

    return `
      <div class="pr-card rp-card">
        <div class="cabeca">
          <div>
            <h3>${esc(a.profissional.nome)}</h3>
            <div class="papel">${esc(REMUNERACAO[a.profissional.remuneracao_tipo]
                || 'Sem forma de remuneração definida')}</div>
          </div>
          <button class="argos-btn ghost" data-rp="mensagem" data-prof="${a.profissional.id}">
            ✉️ Mensagem</button>
        </div>

        ${a.fixo ? `<div class="pr-linha"><span class="dim">Fixo mensal</span>
            <span>${formataMoeda(a.fixo)}</span></div>` : ''}
        <div class="pr-linha"><span class="dim">Produção de ${esc(mesBR(mesAtual))}</span>
          <span>${formataMoeda(a.producao)}</span></div>

        <div class="rp-bloco">
          <div class="titulo">Menos — ${formataMoeda(a.retido)}</div>
          ${a.retidasAgora.length ? a.retidasAgora.map(r => linha(r, '−')).join('')
            : '<div class="rp-item"><span class="quem dim">Nada retido neste mês.</span></div>'}
        </div>

        <div class="rp-bloco">
          <div class="titulo">Mais — ${formataMoeda(a.liberado)}</div>
          ${a.liberadasAgora.length ? a.liberadasAgora.map(r => linha(r, '+')).join('')
            : '<div class="rp-item"><span class="quem dim">Nada liberado neste mês.</span></div>'}
        </div>

        <div class="rp-final"><span>Acerto de ${esc(mesBR(mesAtual))}</span>
          <b>${formataMoeda(a.total)}</b></div>

        ${a.aindaRetidas.length ? `
          <div class="rp-saldo">
            Aguardando pagamento <b>${formataMoeda(a.saldoAReceber)}</b>
            ${a.aindaRetidas.map(r => `
              <div class="rp-item">
                <span class="quem">${esc(nomePac(r.paciente_id))}
                  · ${esc(mesCurto(r.mes_producao))} — ${formataMoeda(r.valor)}</span>
                ${podeReter ? `<button class="argos-btn ghost" data-rp="liberar" data-id="${r.id}"
                    title="O paciente regularizou: devolver no acerto deste mês">↩︎ Liberar</button>` : ''}
              </div>`).join('')}
          </div>` : ''}

        ${fechado ? `<div class="rp-fechado">✅ Acerto fechado em
            ${formataBR(String(fechado.fechado_em).slice(0, 10))} —
            ${formataMoeda(fechado.total)}
            ${Math.abs(Number(fechado.total) - a.total) > 0.01
                ? `<b style="color:var(--argos-warn)">· a conta mudou depois disso
                   (hoje daria ${formataMoeda(a.total)})</b>` : ''}</div>` : ''}
        ${(() => {
            const env = enviosDe(a.profissional.id, mesAtual);
            return env.length ? `<div class="rp-fechado">📨 Mensagem registrada em
                ${quandoBR(env[0].enviado_em)}${env.length > 1 ? ` (+${env.length - 1} anterior(es))` : ''}</div>` : '';
        })()}
      </div>`;
}

// --- sugerir retenções a partir da inadimplência real -----------------------
async function sugerirRetencoes() {
    const btn = document.getElementById('btn-rp-sugerir');
    btn.disabled = true; btn.textContent = 'Conferindo quem não pagou…';
    try {
        const aberto = abertoPorPaciente({ pacientes, dinamicas, sessoes, alocacoes, ate: mesAtual });
        const meses = new Set();
        for (const linhas of aberto.values()) for (const l of linhas) meses.add(l.mes);
        const producaoPorMes = {};
        for (const m of meses) producaoPorMes[m] = producaoDe(m);

        const sug = retencoesSugeridas({ producaoPorMes, aberto, pacientes, mes: mesAtual });
        // o que já foi registrado alguma vez não volta a ser sugerido
        const chave = r => `${r.profissional_id}|${r.paciente_id}|${r.mes_producao}`;
        const jaTem = new Set(retencoes.map(chave));
        const novas = sug.filter(r => !jaTem.has(chave(r)));
        if (!novas.length) {
            toast('Nenhuma retenção nova: tudo que estava em aberto já está registrado.');
            return;
        }
        const total = novas.reduce((s, r) => s + r.valor, 0);
        if (!confirm(`Reter ${novas.length} valor(es), somando ${formataMoeda(total)}, `
            + `no acerto de ${mesBR(mesAtual)}?`)) return;

        const linhas = novas.map(r => ({
            profissional_id: r.profissional_id, paciente_id: r.paciente_id,
            mes_producao: r.mes_producao, valor: Number(r.valor.toFixed(2)),
            motivo: r.motivo, origem: 'inadimplencia', status: 'retido', retido_em: mesAtual
        }));
        const { data, error } = await sb.from('argos_repasse_retencoes').insert(linhas).select();
        if (error) { console.error(error); toast('Não consegui gravar as retenções.', true); return; }
        retencoes = retencoes.concat(data || []);
        renderRepasses();
        toast(`${linhas.length} retenção(ões) registrada(s).`);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔎 Sugerir retenções pela inadimplência';
    }
}

// --- reter à mão, liberar, desfazer ----------------------------------------
function abrirReter() {
    document.getElementById('ret-prof').innerHTML = profissionais
        .map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    document.getElementById('ret-pac').innerHTML = '<option value="">— sem paciente —</option>'
        + pacientes.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    document.getElementById('ret-mes').value = mesAtual;
    document.getElementById('ret-valor').value = '';
    document.getElementById('ret-motivo').value = '';
    document.getElementById('ret-obs').value = '';
    document.getElementById('ret-origem').value = 'manual';
    abrirModal('modal-reter');
}

async function salvarRetencao() {
    const valor = Number(document.getElementById('ret-valor').value);
    if (!(valor > 0)) { toast('Informe o valor a reter.', true); return; }
    const pac = document.getElementById('ret-pac').value || null;
    const motivo = document.getElementById('ret-motivo').value.trim();
    const registro = {
        profissional_id: document.getElementById('ret-prof').value,
        paciente_id: pac,
        mes_producao: document.getElementById('ret-mes').value || mesAtual,
        valor, motivo: motivo || (pac ? nomePac(pac) : 'Retenção'),
        observacao: document.getElementById('ret-obs').value.trim() || null,
        origem: document.getElementById('ret-origem').value,
        status: 'retido', retido_em: mesAtual
    };
    const { data, error } = await sb.from('argos_repasse_retencoes').insert(registro).select();
    if (error) { console.error(error); toast('Não consegui reter esse valor.', true); return; }
    retencoes = retencoes.concat(data || []);
    fecharModal('modal-reter');
    renderRepasses();
    toast('Valor retido.');
}

async function liberarRetencao(id) {
    const r = retencoes.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`Liberar ${formataMoeda(r.valor)} de ${nomePac(r.paciente_id)} `
        + `no acerto de ${mesBR(mesAtual)}?`)) return;
    const dados = { status: 'liberado', liberado_em: mesAtual, atualizado_em: new Date().toISOString() };
    const { error } = await sb.from('argos_repasse_retencoes').update(dados).eq('id', id);
    if (error) { console.error(error); toast('Não consegui liberar.', true); return; }
    Object.assign(r, dados);
    renderRepasses();
    toast('Liberado — entra como «MAIS» neste acerto.');
}

async function desfazerRetencao(id) {
    const r = retencoes.find(x => x.id === id);
    if (!r || !confirm('Tirar esta retenção? O valor volta inteiro para o acerto.')) return;
    const { error } = await sb.from('argos_repasse_retencoes').delete().eq('id', id);
    if (error) { console.error(error); toast('Não consegui desfazer.', true); return; }
    retencoes = retencoes.filter(x => x.id !== id);
    renderRepasses();
}

// --- mensagem e fechamento do acerto ---------------------------------------
let acertoAberto = null;

const enviosDe = (profId, mes) => mensagens
    .filter(m => m.profissional_id === profId && m.mes === mes)
    .sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em)));

const quandoBR = ts => {
    const t = String(ts || '');
    return `${formataBR(t.slice(0, 10))} ${t.slice(11, 16)}`;
};

function renderEnvios() {
    const el = document.getElementById('ac-envios');
    if (!el || !acertoAberto) return;
    const lista = enviosDe(acertoAberto.profissional.id, mesAtual);
    el.innerHTML = lista.length
        ? `<div class="titulo">Mensagens já registradas neste mês</div>`
          + lista.map(m => `
            <div class="rp-item">
              <span class="quem">📨 ${quandoBR(m.enviado_em)}${m.quem ? ` — ${esc(m.quem)}` : ''}</span>
              <button class="argos-btn ghost small" data-envio-ver="${m.id}"
                title="Colocar esta mensagem no campo acima">👁 Ver</button>
            </div>`).join('')
        : '<span class="dim">Nenhum envio registrado neste mês ainda.</span>';
}

function abrirMensagem(profId) {
    acertoAberto = repasses.find(a => a.profissional.id === profId);
    if (!acertoAberto) return;
    document.getElementById('ac-titulo').textContent =
        `Acerto de ${acertoAberto.profissional.nome} — ${mesBR(mesAtual)}`;
    const jaFechado = fechamentoDe(profId, mesAtual);
    document.getElementById('ac-texto').value = (jaFechado && jaFechado.mensagem)
        || mensagemAcerto(acertoAberto, { nomePaciente: nomePac });
    renderEnvios();
    abrirModal('modal-acerto');
}

/** Guarda a mensagem do campo como "enviada ao profissional" agora. */
async function registrarEnvio() {
    if (!acertoAberto) return;
    const texto = document.getElementById('ac-texto').value.trim();
    if (!texto) { toast('A mensagem está vazia.', true); return; }
    const { data, error } = await sb.from('argos_repasse_mensagens').insert({
        profissional_id: acertoAberto.profissional.id, mes: mesAtual, texto,
        quem: sessionStorage.getItem('usuario') || null
    }).select();
    if (error) { console.error(error); toast('Não consegui registrar o envio.', true); return; }
    mensagens = mensagens.concat(data || []);
    renderEnvios();
    renderRepasses();
    toast('Envio registrado — fica no histórico do profissional.');
}

async function fecharAcerto() {
    if (!acertoAberto) return;
    const a = acertoAberto;
    const registro = {
        profissional_id: a.profissional.id, mes: mesAtual,
        producao: Number(a.producao.toFixed(2)), fixo: Number(a.fixo.toFixed(2)),
        retido: Number(a.retido.toFixed(2)), liberado: Number(a.liberado.toFixed(2)),
        total: Number(a.total.toFixed(2)),
        mensagem: document.getElementById('ac-texto').value,
        fechado_em: new Date().toISOString()
    };
    const { data, error } = await sb.from('argos_repasse_acertos')
        .upsert(registro, { onConflict: 'profissional_id,mes' }).select();
    if (error) { console.error(error); toast('Não consegui fechar o acerto.', true); return; }
    acertos = acertos.filter(x => !(x.profissional_id === a.profissional.id && x.mes === mesAtual))
        .concat(data || []);
    fecharModal('modal-acerto');
    renderRepasses();
    toast('Acerto fechado.');
}

document.getElementById('rp-cards').addEventListener('click', e => {
    const b = e.target.closest('[data-rp]');
    if (!b) return;
    if (b.dataset.rp === 'mensagem') abrirMensagem(b.dataset.prof);
    if (b.dataset.rp === 'liberar') liberarRetencao(b.dataset.id);
    if (b.dataset.rp === 'desfazer') desfazerRetencao(b.dataset.id);
});
document.getElementById('btn-rp-sugerir').addEventListener('click', sugerirRetencoes);
document.getElementById('btn-rp-reter').addEventListener('click', abrirReter);
document.getElementById('btn-ret-salvar').addEventListener('click', salvarRetencao);
document.getElementById('btn-ac-fechar').addEventListener('click', fecharAcerto);
document.getElementById('btn-ac-registrar').addEventListener('click', registrarEnvio);
document.getElementById('ac-envios').addEventListener('click', e => {
    const b = e.target.closest('[data-envio-ver]');
    if (!b) return;
    const m = mensagens.find(x => x.id === b.dataset.envioVer);
    if (m) document.getElementById('ac-texto').value = m.texto;
});
document.getElementById('btn-ac-copiar').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(document.getElementById('ac-texto').value);
        toast('Mensagem copiada.');
    } catch { toast('Não consegui copiar — selecione e copie à mão.', true); }
});

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
    // producao.html#repasses abre direto no acerto do mês (o link vem da
    // página de profissionais); só se a aba estiver visível para o usuário
    if (location.hash === '#repasses') {
        const aba = document.querySelector('#pr-abas [data-aba="repasses"]');
        if (aba && aba.style.display !== 'none') aba.click();
    }
})();
