// pacientes.js — Card "Pacientes" da área Argos
// Cadastro e informações, anamnese, dinâmicas financeiras, sessões avulsas,
// espaços de atendimento e exclusão com opções de histórico.

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    DOW_NOMES, PACOTE_MODOS, STATUS_SESSAO, acordoLabel, mesclarSessoes,
    fechamentoPaciente, hojeISO, somarDias, formataBR, formataMoeda,
    conflitosDeDinamica, conflitosDeSessao, mesmaAgenda,
    divisaoRepasses, repassesDe, unidadeRepasse, aplicarFimDeProcesso,
    definirRepassePadrao, tipoSessaoLabel,
    SITUACAO_PROCESSO, situacaoLabel
} from './argos-recorrencia.js';
import {
    indexarRespostas, calcularAvaliacao, radarSVG, limiteProxima,
    avaliacaoTravada, COMPETENCIA_MAX, FOCO_MAX, formataNota
} from './argos-evolucao.js';
import { SITUACAO_NOTA, situacaoNota } from './argos-cobranca.js';
import { montarCobrancaUI } from './argos-cobranca-ui.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };

let pacientes = [], salas = [], profissionais = [], servicos = [], profServ = [], dinamicas = [], grupos = [];
let pacienteAtual = null;    // paciente aberto no modal de dinâmicas/exclusão
let editandoPacienteId = null;
let editandoDinamicaId = null;
let cobUI = null;            // modais de contatos, detalhes financeiros e extrato

// ============================================================
// CARGA
// ============================================================
async function carregarTudo() {
    const [rPac, rSalas, rProf, rServ, rPS, rDin, rGru] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_salas').select('*').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_servicos_base').select('*').order('nome'),
        sb.from('argos_profissional_servicos').select('*'),
        todas(() => sb.from('argos_dinamicas').select('*').order('created_at')),
        sb.from('argos_grupos').select('*').order('hora')
    ]);
    const erro = rPac.error || rSalas.error || rProf.error || rServ.error || rPS.error || rDin.error || rGru.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    pacientes = rPac.data || [];
    salas = rSalas.data || [];
    profissionais = rProf.data || [];
    servicos = rServ.data || [];
    profServ = rPS.data || [];
    dinamicas = rDin.data || [];
    grupos = rGru.data || [];
    definirRepassePadrao(profissionais);
    renderLista();
}

const nomeGrupo = id => (grupos.find(g => g.id === id) || {}).nome || '—';

function selectGrupos(el, valor) {
    el.innerHTML = '<option value="">— Escolher grupo —</option>' +
        grupos.filter(g => g.ativo !== false).map(g =>
            `<option value="${g.id}">👥 ${esc(g.nome)} — ${DOW_NOMES[g.dow]} ${g.hora} · ${esc(nomeSala(g.sala_id))}</option>`).join('');
    el.value = valor || '';
    atualizarResumoGrupo();
}
function atualizarResumoGrupo() {
    const g = grupos.find(x => x.id === document.getElementById('din-grupo').value);
    document.getElementById('resumo-grupo').textContent = g
        ? `O paciente será encaixado em "${g.nome}": ${DOW_NOMES[g.dow]} às ${g.hora}, ${nomeSala(g.sala_id)}${g.profissional_id ? ', com ' + nomeProf(g.profissional_id) : ''}.`
        : '';
}
document.getElementById('din-grupo').addEventListener('change', atualizarResumoGrupo);

const nomeSala = id => (salas.find(s => s.id === id) || {}).nome || '—';
const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
const nomeServ = id => (servicos.find(s => s.id === id) || {}).nome || '—';

function idade(nasc) {
    if (!nasc) return '';
    const n = new Date(nasc + 'T12:00');
    const h = new Date();
    let i = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i--;
    return i + ' anos';
}

// ============================================================
// LISTA DE MINICARDS (filtrável e classificável)
// ============================================================
function renderLista() {
    const busca = (document.getElementById('busca').value || '').toLowerCase();
    const situacao = document.getElementById('filtro-situacao').value;
    const ordem = document.getElementById('ordenar').value;

    let lista = pacientes.filter(p => {
        if (situacao === 'ativos' && (!p.ativo || p.cadastro_removido)) return false;
        if (situacao === 'inativos' && p.ativo && !p.cadastro_removido) return false;
        if (!busca) return true;
        return [p.nome, p.mae_nome, p.pai_nome, p.mae_fone, p.pai_fone, p.email, p.responsavel_financeiro]
            .some(v => (v || '').toLowerCase().includes(busca));
    });
    if (ordem === 'nome') lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    if (ordem === 'recente') lista.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (ordem === 'antigo') lista.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

    const podeEditar = perm.pode('pacientes_editar');
    const podeExcluir = perm.pode('pacientes_excluir');
    const podeDinamicas = perm.pode('dinamicas_gerenciar');
    const podeFinanceiro = perm.pode('cobranca_contatos_gerenciar') || perm.pode('paciente_financeiro_detalhes');
    const podeExtrato = perm.pode('paciente_extrato');

    document.getElementById('lista-pacientes').innerHTML = lista.map(p => {
        const dins = dinamicas.filter(d => d.paciente_id === p.id && d.ativo !== false);
        return `
        <div class="argos-minicard ${p.ativo && !p.cadastro_removido ? '' : 'inativo'}">
          <div class="mini-topo">
            <div class="mini-nome">${esc(p.nome)}</div>
            ${p.cadastro_removido ? '<span class="badge vermelho">Cadastro removido</span>'
              : p.processo_fim_tipo
                ? `<span class="badge vermelho">${situacaoLabel(p.processo_fim_tipo)}${p.processo_fim_data ? ' em ' + formataBR(p.processo_fim_data) : ''}</span>`
                : (p.ativo ? '' : '<span class="badge vermelho">Inativo</span>')}
          </div>
          <div class="mini-info">
            ${p.nascimento ? `🎂 ${formataBR(p.nascimento)} (${idade(p.nascimento)})<br>` : ''}
            ${p.mae_fone || p.pai_fone ? `📞 ${esc(p.mae_fone || p.pai_fone)}${p.mae_fone ? ' (mãe)' : ' (pai)'}<br>` : ''}
            ${p.colegio ? `🏫 ${esc(p.colegio)}${p.serie ? ' — ' + esc(p.serie) : ''}<br>` : ''}
            ${p.anamnese_data ? `📋 Anamnese: ${formataBR(p.anamnese_data)}${p.anamnese_cobrar ? ' (cobrada)' : ''}<br>` : ''}
            <span class="badge azul">${dins.length} dinâmica(s) ativa(s)</span>
          </div>
          ${p.cadastro_removido ? '' : `
          <div class="mini-acoes">
            ${podeDinamicas ? `<button class="argos-btn small" data-acao="dinamicas" data-id="${p.id}">💰 Dinâmicas</button>` : ''}
            ${podeFinanceiro ? `<button class="argos-btn small" data-acao="financeiro" data-id="${p.id}">📱 Cobrança</button>` : ''}
            ${podeExtrato ? `<button class="argos-btn small" data-acao="extrato" data-id="${p.id}">📊 Extrato</button>` : ''}
            ${perm.pode('evolucao_ver') ? `<button class="argos-btn small" data-acao="evolucao" data-id="${p.id}">📈 Evolução</button>` : ''}
            ${perm.pode('anamnese_ficha') ? `<a class="argos-btn small" href="anamnese.html?paciente=${p.id}">📋 Anamnese</a>` : ''}
            ${podeEditar ? `<button class="argos-btn small" data-acao="editar" data-id="${p.id}">✏️ Editar</button>` : ''}
            ${podeExcluir ? `<button class="argos-btn small danger" data-acao="excluir" data-id="${p.id}">🗑️</button>` : ''}
          </div>`}
        </div>`;
    }).join('');
    document.getElementById('pacientes-vazio').style.display = lista.length ? 'none' : '';
}

['busca', 'filtro-situacao', 'ordenar'].forEach(id =>
    document.getElementById(id).addEventListener('input', renderLista));

document.getElementById('lista-pacientes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const p = pacientes.find(x => x.id === btn.dataset.id);
    if (!p) return;
    if (btn.dataset.acao === 'editar') abrirModalPaciente(p.id);
    if (btn.dataset.acao === 'dinamicas') abrirModalDinamicas(p);
    if (btn.dataset.acao === 'evolucao') abrirModalEvolucao(p);
    if (btn.dataset.acao === 'financeiro') cobUI.abrirFinanceiro(p);
    if (btn.dataset.acao === 'extrato') cobUI.abrirExtrato(p, {
        dinamicas: dinamicas.filter(d => d.paciente_id === p.id) });
    if (btn.dataset.acao === 'excluir') { pacienteAtual = p; document.getElementById('modal-excluir-titulo').textContent = `Excluir: ${p.nome}`; abrirModal('modal-excluir'); }
});

// ============================================================
// CADASTRO DO PACIENTE
// ============================================================
document.getElementById('btn-novo-paciente').addEventListener('click', () => abrirModalPaciente(null));

/** Preenche um <select> com o vocabulário de situação do processo. */
function opcoesSituacao(sel) {
    if (!sel) return;
    sel.innerHTML = SITUACAO_PROCESSO.map(o =>
        `<option value="${o.valor}">${o.rotulo}</option>`).join('');
}
opcoesSituacao(document.getElementById('pac-situacao'));
opcoesSituacao(document.getElementById('pac-proc-tipo'));

/**
 * Regime de nota fiscal do paciente. Fica na dinâmica porque é lá que o
 * acordo financeiro mora: mudou o acordo, muda a nota junto. Exceções de um
 * mês só se resolvem na página de Cobrança e Notas, sem mexer na dinâmica.
 */
(function opcoesNota() {
    const sel = document.getElementById('din-nota-tipo');
    if (!sel) return;
    sel.innerHTML = SITUACAO_NOTA.map(o =>
        `<option value="${o.valor}">${o.rotulo}</option>`).join('');
    sel.addEventListener('change', dicaNota);
})();

function dicaNota() {
    const el = document.getElementById('din-nota-dica');
    const sel = document.getElementById('din-nota-tipo');
    if (!el || !sel) return;
    const s = situacaoNota(sel.value);
    el.textContent = s.desc + (s.valor === 'indefinido'
        ? ' Enquanto estiver assim, o paciente aparece nas pendências da página de Cobrança e Notas.'
        : '');
}

/** Explica, abaixo do campo, o que a situação escolhida faz. */
function explicarSituacao() {
    const tipo = document.getElementById('pac-situacao').value;
    const o = SITUACAO_PROCESSO.find(x => x.valor === tipo);
    const data = document.getElementById('pac-situacao-data').value;
    const alvo = document.getElementById('pac-situacao-dica');
    if (!o || !tipo) {
        alvo.textContent = 'Paciente em atendimento: continua na agenda, nos grupos e nas finanças.';
        return;
    }
    alvo.innerHTML = `${esc(o.desc)} O paciente fica <b>inativo</b> e sai da agenda, dos grupos e das finanças `
        + (data ? `a partir de <b>${formataBR(data)}</b>.` : 'a partir de <b>hoje</b> — informe a data se souber quando parou.');
}
['pac-situacao', 'pac-situacao-data'].forEach(id =>
    document.getElementById(id).addEventListener('change', explicarSituacao));

/** Os quatro campos de situação, coerentes entre si, a partir do formulário. */
function situacaoDoFormulario() {
    const tipo = document.getElementById('pac-situacao').value || null;
    const txt = id => document.getElementById(id).value.trim() || null;
    return tipo
        ? { ativo: false, processo_fim_tipo: tipo,
            processo_fim_data: txt('pac-situacao-data'),
            processo_fim_motivo: txt('pac-situacao-motivo') }
        : { ativo: true, processo_fim_tipo: null,
            processo_fim_data: null, processo_fim_motivo: null };
}

/** Mostra o link da pasta abaixo do campo, para abrir sem copiar e colar. */
function mostrarLinkPasta(url) {
    const alvo = document.getElementById('pac-pasta-link');
    if (!alvo) return;
    alvo.innerHTML = url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="text-decoration:none">📁 <u>Abrir a pasta em outra aba</u></a>`
        : '';
}
document.getElementById('pac-pasta-url').addEventListener('input', e => mostrarLinkPasta(e.target.value.trim()));

function abrirModalPaciente(id) {
    editandoPacienteId = id;
    const p = id ? pacientes.find(x => x.id === id) : null;
    document.getElementById('modal-paciente-titulo').textContent = p ? 'Editar paciente' : 'Novo paciente';
    const v = (campo, val) => document.getElementById(campo).value = val || '';
    v('pac-nome', p && p.nome); v('pac-nascimento', p && p.nascimento);
    v('pac-cpf', p && p.cpf);
    v('pac-colegio', p && p.colegio); v('pac-serie', p && p.serie); v('pac-turno', p && p.turno);
    v('pac-mae-nome', p && p.mae_nome); v('pac-mae-profissao', p && p.mae_profissao);
    v('pac-mae-fone', p && p.mae_fone); v('pac-mae-cpf', p && p.mae_cpf);
    v('pac-pai-nome', p && p.pai_nome); v('pac-pai-profissao', p && p.pai_profissao);
    v('pac-pai-fone', p && p.pai_fone); v('pac-pai-cpf', p && p.pai_cpf);
    v('pac-email', p && p.email); v('pac-endereco', p && p.endereco);
    v('pac-resp-financeiro', p && p.responsavel_financeiro);
    v('pac-rf-cpf', p && p.rf_cpf); v('pac-rf-whatsapp', p && p.rf_whatsapp);
    v('pac-contato', p && p.contato);
    v('pac-pasta-url', p && p.pasta_url);
    mostrarLinkPasta(p && p.pasta_url);
    v('pac-indicacao', p && p.indicacao);
    v('pac-observacoes', p && p.observacoes);
    v('pac-anamnese-data', p && p.anamnese_data); v('pac-anamnese-valor', p && p.anamnese_valor);
    document.getElementById('pac-anamnese-cobrar').checked = p ? !!p.anamnese_cobrar : false;
    v('pac-situacao', p && p.processo_fim_tipo);
    v('pac-situacao-data', p && p.processo_fim_data);
    v('pac-situacao-motivo', p && p.processo_fim_motivo);
    explicarSituacao();
    abrirModal('modal-paciente');
}

document.getElementById('form-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = id => document.getElementById(id).value.trim() || null;
    // contatos são guardados como escritos: só as bordas são aparadas,
    // as quebras de linha entre um responsável e outro ficam de pé
    const gBruto = id => document.getElementById(id).value.replace(/^\n+|\s+$/g, '') || null;
    const registro = {
        nome: g('pac-nome'), nascimento: g('pac-nascimento'), cpf: g('pac-cpf'),
        colegio: g('pac-colegio'), serie: g('pac-serie'), turno: g('pac-turno'),
        mae_nome: g('pac-mae-nome'), mae_profissao: g('pac-mae-profissao'),
        mae_fone: g('pac-mae-fone'), mae_cpf: g('pac-mae-cpf'),
        pai_nome: g('pac-pai-nome'), pai_profissao: g('pac-pai-profissao'),
        pai_fone: g('pac-pai-fone'), pai_cpf: g('pac-pai-cpf'),
        email: g('pac-email'), endereco: g('pac-endereco'),
        responsavel_financeiro: g('pac-resp-financeiro'),
        rf_cpf: g('pac-rf-cpf'), rf_whatsapp: g('pac-rf-whatsapp'),
        contato: gBruto('pac-contato'),
        pasta_url: g('pac-pasta-url'),
        indicacao: g('pac-indicacao'),
        observacoes: g('pac-observacoes'),
        anamnese_data: g('pac-anamnese-data'),
        anamnese_valor: g('pac-anamnese-valor'),
        anamnese_cobrar: document.getElementById('pac-anamnese-cobrar').checked,
        // uma verdade só: quem tem situação de saída está inativo, e voltar
        // para "em andamento" limpa data e motivo junto
        ...situacaoDoFormulario()
    };
    if (!registro.nome) { toast('Informe o nome.', true); return; }
    const q = editandoPacienteId
        ? sb.from('argos_pacientes').update(registro).eq('id', editandoPacienteId)
        : sb.from('argos_pacientes').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar paciente.', true); return; }
    fecharModal('modal-paciente');
    toast(editandoPacienteId ? 'Paciente atualizado.' : 'Paciente cadastrado.');
    await carregarTudo();
});

// ============================================================
// EVOLUÇÃO TERAPÊUTICA (consulta: 4 radares + histórico)
// ============================================================
let evCatalogo = [], evAvaliacoes = [], evRespostas = {}; // respostas por avaliacao_id

async function abrirModalEvolucao(p) {
    pacienteAtual = p;
    document.getElementById('modal-evolucao-titulo').textContent = `📈 Evolução Terapêutica — ${p.nome}`;
    document.getElementById('btn-ev-abrir').href = `evolucao.html?paciente=${p.id}`;
    document.getElementById('btn-ev-anamnese').href = `anamnese.html?paciente=${p.id}`;
    document.getElementById('ev-graficos').innerHTML = '<p class="dim">Carregando…</p>';
    document.getElementById('ev-tabela').innerHTML = '';
    document.getElementById('ev-historico').innerHTML = '';
    abrirModal('modal-evolucao');

    if (!evCatalogo.length) {
        const [rA, rS, rO] = await Promise.all([
            sb.from('argos_ev_areas').select('*').order('ordem'),
            sb.from('argos_ev_subareas').select('*').order('ordem'),
            sb.from('argos_ev_opcoes').select('*').order('ordem')
        ]);
        const subs = rS.data || [], ops = rO.data || [];
        evCatalogo = (rA.data || []).map(a => ({
            ...a,
            subareas: subs.filter(x => x.area_id === a.id).map(x => ({
                ...x, opcoes: ops.filter(o => o.subarea_id === x.id)
            }))
        }));
    }
    const { data: avs } = await sb.from('argos_ev_avaliacoes').select('*')
        .eq('paciente_id', p.id).order('numero');
    evAvaliacoes = (avs || []).filter(a => a.status === 'concluida');
    evRespostas = {};
    if (evAvaliacoes.length) {
        const { data: rr } = await sb.from('argos_ev_respostas').select('*')
            .in('avaliacao_id', evAvaliacoes.map(a => a.id));
        evAvaliacoes.forEach(a => {
            evRespostas[a.id] = indexarRespostas((rr || []).filter(x => x.avaliacao_id === a.id));
        });
    }
    montarSeletoresEv(avs || []);
    renderEvolucao();
}

function rotuloAvaliacao(a) {
    return `${a.numero === 1 ? 'Avaliação inicial' : a.numero + 'ª avaliação'} — ${formataBR(a.data)}`;
}

function montarSeletoresEv(todas) {
    const opts = evAvaliacoes.map(a => `<option value="${a.id}">${esc(rotuloAvaliacao(a))}</option>`).join('');
    const selA = document.getElementById('ev-serie-a');
    const selB = document.getElementById('ev-serie-b');
    selA.innerHTML = opts; selB.innerHTML = opts;
    if (evAvaliacoes.length) {
        selA.value = evAvaliacoes[0].id;
        selB.value = evAvaliacoes[evAvaliacoes.length - 1].id;
    }
    const rascunhos = (todas || []).filter(a => a.status === 'rascunho').length;
    document.getElementById('ev-historico').innerHTML = (todas || []).map(a => {
        const lim = limiteProxima(a);
        const estado = a.status === 'rascunho'
            ? '<span class="badge vermelho">rascunho — pendente de conclusão</span>'
            : (avaliacaoTravada(a, hojeISO())
                ? '<span class="badge azul">concluída · travada</span>'
                : '<span class="badge verde">concluída · editável</span>');
        return `<div class="argos-bloco">
            <div class="bloco-topo"><b>${esc(rotuloAvaliacao(a))}</b>${estado}</div>
            <div class="bloco-info">${lim ? `Próxima avaliação até <b>${formataBR(lim)}</b>` : 'Prazo da próxima ainda não definido'}
              · <a href="evolucao.html?paciente=${a.paciente_id}&avaliacao=${a.id}">abrir</a></div>
          </div>`;
    }).join('') || '<p class="dim">Nenhuma avaliação ainda.</p>'
      + (rascunhos ? '' : '');
}

function renderEvolucao() {
    const cont = document.getElementById('ev-graficos');
    if (evAvaliacoes.length < 1) {
        cont.innerHTML = '<p class="dim">Os gráficos aparecem quando houver pelo menos uma avaliação <b>concluída</b>.</p>';
        return;
    }
    const idA = document.getElementById('ev-serie-a').value;
    const idB = document.getElementById('ev-serie-b').value;
    const avA = evAvaliacoes.find(a => a.id === idA);
    const avB = evAvaliacoes.find(a => a.id === idB);
    const calcA = avA ? calcularAvaliacao(evCatalogo, evRespostas[avA.id]) : [];
    const calcB = avB ? calcularAvaliacao(evCatalogo, evRespostas[avB.id]) : [];
    const eixos = evCatalogo.map(a => a.nome);
    const serie = (calc, nome, cor, tracejada, campo) => calc.length
        ? [{ nome, cor, tracejada, valores: calc.map(c => c[campo]) }] : [];
    const mesmo = idA === idB;

    const compSeries = [
        ...serie(calcA, rotuloAvaliacao(avA), '#38bdf8', true, 'competencia'),
        ...(mesmo ? [] : serie(calcB, rotuloAvaliacao(avB), '#38bdf8', false, 'competencia'))
    ];
    const focoSeries = [
        ...serie(calcA, rotuloAvaliacao(avA), '#e879f9', true, 'foco'),
        ...(mesmo ? [] : serie(calcB, rotuloAvaliacao(avB), '#e879f9', false, 'foco'))
    ];

    cont.innerHTML = [
        radarSVG({ titulo: 'Competências — escala proporcional', eixos, series: compSeries, max: 'auto' }),
        radarSVG({ titulo: `Competências — escala fixa (0–${COMPETENCIA_MAX})`, eixos, series: compSeries, max: COMPETENCIA_MAX, aneis: 5 }),
        radarSVG({ titulo: 'Foco Terapêutico — escala proporcional', eixos, series: focoSeries, max: 'auto' }),
        radarSVG({ titulo: `Foco Terapêutico — escala fixa (0–${FOCO_MAX})`, eixos, series: focoSeries, max: FOCO_MAX, aneis: 4 })
    ].join('');

    document.getElementById('ev-tabela').innerHTML = `
      <div class="argos-tabela-wrap" style="margin-top:12px"><table class="argos-tabela">
        <thead>
          <tr><th></th><th class="grupo" colspan="3">${esc(rotuloAvaliacao(avA))}</th>
            ${mesmo ? '' : `<th class="grupo sep" colspan="3">${esc(rotuloAvaliacao(avB))}</th><th class="grupo sep">Evolução</th>`}</tr>
          <tr><th>Área</th><th>Peso</th><th>Comp.</th><th>Foco</th>
            ${mesmo ? '' : '<th class="sep">Peso</th><th>Comp.</th><th>Foco</th><th class="sep">Δ competência</th>'}</tr>
        </thead>
        <tbody>${evCatalogo.map((a, i) => {
            const A = calcA[i] || {}, B = calcB[i] || {};
            const d = (B.competencia != null && A.competencia != null) ? B.competencia - A.competencia : null;
            const cor = d == null ? '' : (d > 0.004 ? '#22c55e' : (d < -0.004 ? '#ef4444' : 'var(--argos-text-dim)'));
            return `<tr><td>${esc(a.nome)}</td>
              <td>${A.peso || '—'}</td><td>${formataNota(A.competencia)}</td><td>${formataNota(A.foco)}</td>
              ${mesmo ? '' : `<td class="sep">${B.peso || '—'}</td><td>${formataNota(B.competencia)}</td><td>${formataNota(B.foco)}</td>
              <td class="sep" style="color:${cor}"><b>${d == null ? '—' : (d > 0 ? '+' : '') + formataNota(d)}</b></td>`}</tr>`;
        }).join('')}</tbody>
      </table></div>`;
}

document.getElementById('ev-serie-a').addEventListener('change', renderEvolucao);
document.getElementById('ev-serie-b').addEventListener('change', renderEvolucao);

// ============================================================
// DINÂMICAS FINANCEIRAS
// ============================================================
function resumoDinamica(d) {
    const dias = (d.dias || []).map(x =>
        d.freq_periodo === 'dia' ? x.hora : `${DOW_NOMES[x.dow]} ${x.hora}`).join(' · ');
    const freq = d.recorrencia_tipo === 'avulsa' ? 'Sessões avulsas'
        : `${d.freq_qtd || (d.dias || []).length} sessão(ões) por ${({ dia: 'dia', semana: 'semana', mes: 'mês' })[d.freq_periodo]}`;
    const fim = d.fim_tipo === 'indeterminado' ? 'sem fim'
        : d.fim_tipo === 'apos_ocorrencias' ? `após ${d.fim_ocorrencias} ocorrências`
        : `até ${formataBR(d.fim_data)}`;
    return { dias, freq, fim };
}

const pctFmt = x => (Math.round(x * 100) / 100).toLocaleString('pt-BR');

// profissionais responsáveis (com serviço), vindos da lista de repasses
function profissionaisDaDinamicaHTML(d) {
    const resp = repassesDe(d);
    if (!resp.length) return '<span class="dim">sem profissional definido</span>';
    return resp.map(r =>
        `${esc(nomeProf(r.profissional_id))} (${esc(nomeServ(r.servico_id))})`).join(', ');
}

// resumo da divisão do acordo com os profissionais, para o bloco da dinâmica
function resumoRepassesHTML(d) {
    const div = divisaoRepasses(d);
    const comValor = div.itens.filter(r => r.pct > 0);
    if (!comValor.length) return '';
    const partes = comValor.map(r => r.valor == null
        ? `${esc(nomeProf(r.profissional_id))} ${pctFmt(r.pct)}% (padrão)`
        : r.tipo === 'valor'
            ? `${esc(nomeProf(r.profissional_id))} ${formataMoeda(r.valor)} (${pctFmt(r.pct)}%)`
            : `${esc(nomeProf(r.profissional_id))} ${pctFmt(r.pct)}%`);
    return `<br>💼 Repasses: <b>${partes.join(' + ')}</b> · clínica fica com <b>${pctFmt(div.pctClinica)}%</b> (${formataMoeda(div.valorClinica)} ${unidadeRepasse(d)})`;
}

function abrirModalDinamicas(p) {
    pacienteAtual = p;
    document.getElementById('modal-dinamicas-titulo').textContent = `Dinâmicas de ${p.nome}`;
    renderProcesso();
    renderDinamicas();
    abrirModal('modal-dinamicas');
}

// ---------- situação do processo (em andamento / interrompido / finalizado) ----------
function renderProcesso() {
    const p = pacienteAtual;
    document.getElementById('pac-proc-tipo').value = p.processo_fim_tipo || '';
    document.getElementById('pac-proc-data').value = p.processo_fim_data || '';
    document.getElementById('pac-proc-motivo').value = p.processo_fim_motivo || '';
}

document.getElementById('btn-proc-salvar').addEventListener('click', async () => {
    const p = pacienteAtual;
    if (!p) return;
    const tipo = document.getElementById('pac-proc-tipo').value || null;
    const data = document.getElementById('pac-proc-data').value || null;
    const motivo = document.getElementById('pac-proc-motivo').value.trim() || null;
    const registro = tipo
        ? { processo_fim_tipo: tipo, processo_fim_data: data, processo_fim_motivo: motivo, ativo: false }
        : { processo_fim_tipo: null, processo_fim_data: null, processo_fim_motivo: null, ativo: true };
    const { error } = await sb.from('argos_pacientes').update(registro).eq('id', p.id);
    if (error) { console.error(error); toast('Erro ao salvar a situação do processo.', true); return; }
    const desde = data ? `a partir de ${formataBR(data)}` : 'a partir de hoje (data não informada)';
    const descricao = tipo
        ? `${situacaoLabel(tipo)} ${desde}: o paciente fica inativo e deixa de constar na agenda e nas finanças.`
        : 'Processo retomado (em andamento): o paciente volta a ficar ativo e o corte foi desfeito.';
    await sb.from('argos_paciente_eventos').insert({
        paciente_id: p.id, tipo: tipo ? 'processo_' + tipo : 'processo_retomado',
        descricao, dados: { tipo, data }, justificativa: motivo
    });
    toast(tipo ? `${situacaoLabel(tipo)} ${desde}.` : 'Processo em andamento novamente.');
    await carregarTudo();
    pacienteAtual = pacientes.find(x => x.id === p.id) || p;
    renderProcesso();
    renderDinamicas();
});

async function renderDinamicas() {
    const p = pacienteAtual;
    const dins = dinamicas.filter(d => d.paciente_id === p.id);
    // sessões avulsas futuras (sem dinâmica) + histórico de alterações
    const [{ data: avulsas }, { data: eventos }] = await Promise.all([
        todas(() => sb.from('argos_sessoes').select('*')
            .eq('paciente_id', p.id).is('dinamica_ref', null).gte('data', hojeISO()).order('data')),
        sb.from('argos_paciente_eventos').select('*').eq('paciente_id', p.id)
            .order('created_at', { ascending: false })
    ]);

    document.getElementById('lista-dinamicas').innerHTML =
        (dins.map(d => {
            const r = resumoDinamica(d);
            return `
            <div class="argos-bloco ${d.ativo === false ? 'inativo' : ''}">
              <div class="bloco-topo">
                <b>${esc(d.rotulo || 'Dinâmica sem rótulo')}</b>
                ${d.ativo === false ? '<span class="badge vermelho">Inativa</span>' : '<span class="badge verde">Ativa</span>'}
              </div>
              <div class="bloco-info">
                ${d.grupo_id ? `👥 Grupo: <b>${esc(nomeGrupo(d.grupo_id))}</b> · ` : ''}${d.recorrencia_tipo === 'avulsa' ? '🗓️ Sessões avulsas (marcadas uma a uma)' : `🗓️ ${r.dias || '—'} — ${r.freq}, a partir de ${formataBR(d.data_inicio)}, ${r.fim}`}<br>
                ${d.modalidade === 'grupo' ? '👥 Em grupo' : '👤 Individual'} · 🚪 ${esc(nomeSala(d.sala_id))} · 🧑‍⚕️ ${profissionaisDaDinamicaHTML(d)}<br>
                💰 ${esc(acordoLabel(d))}${d.acordo_tipo === 'pacote' && d.pacote_pagamento ? ` — ${esc(PACOTE_MODOS[d.pacote_pagamento.modo] || '')}` : ''}${resumoRepassesHTML(d)}
              </div>
              <div class="mini-acoes">
                <button class="argos-btn small" data-din="editar" data-id="${d.id}">✏️ Editar</button>
                <button class="argos-btn small danger" data-din="excluir" data-id="${d.id}">🗑️ Excluir</button>
              </div>
            </div>`;
        }).join('') || '<p class="dim">Nenhuma dinâmica cadastrada ainda.</p>')
        + ((avulsas || []).length ? `
          <h3 class="form-secao">Sessões avulsas futuras</h3>
          ${avulsas.map(s => `
            <div class="argos-bloco">
              <div class="bloco-info">🗓️ ${formataBR(s.data)} ${s.hora} · 🚪 ${esc(nomeSala(s.sala_id))} · 🧑‍⚕️ ${esc(nomeProf(s.profissional_id))}${s.valor != null ? ' · ' + formataMoeda(s.valor) : ''}${s.modalidade ? ' · ' + esc(tipoSessaoLabel(s.modalidade, nomeGrupo(s.grupo_id))) : ''}</div>
              <div class="mini-acoes"><button class="argos-btn small danger" data-avulsa-del="${s.id}">🗑️ Remover</button></div>
            </div>`).join('')}` : '')
        + ((eventos || []).length && perm.pode('paciente_historico') ? `
          <h3 class="form-secao">📜 Histórico de alterações</h3>
          ${(eventos || []).slice(0, 30).map(ev => `
            <div class="argos-bloco">
              <div class="bloco-info"><b>${formataBR(String(ev.created_at).slice(0, 10))}</b> — ${esc(ev.descricao)}
                ${ev.justificativa ? `<br>📝 <i>${esc(ev.justificativa)}</i>` : ''}</div>
              <div class="mini-acoes">
                <button class="argos-btn small" data-evento-just="${ev.id}">${ev.justificativa ? '✏️ Editar justificativa' : '📝 Justificar'}</button>
                ${perm.master || perm.pode('historico_editar') ? `
                <button class="argos-btn small" data-evento-editar="${ev.id}" title="Reescrever o texto deste registro">✏️ Editar texto</button>
                <button class="argos-btn small danger" data-evento-del="${ev.id}" title="Apagar este registro do histórico">🗑️</button>` : ''}
              </div>
            </div>`).join('')}` : '');
}

document.getElementById('lista-dinamicas').addEventListener('click', async (e) => {
    const jbtn = e.target.closest('[data-evento-just]');
    if (jbtn) {
        const id = jbtn.dataset.eventoJust;
        const { data: ev } = await sb.from('argos_paciente_eventos').select('*').eq('id', id).single();
        const j = prompt('Justificativa / causa desta alteração:', (ev && ev.justificativa) || '');
        if (j === null) return;
        const { error } = await sb.from('argos_paciente_eventos')
            .update({ justificativa: j.trim() || null }).eq('id', id);
        if (error) { toast('Erro ao salvar a justificativa.', true); return; }
        toast('Justificativa registrada.');
        renderDinamicas();
        return;
    }
    // editar o texto de um registro do histórico (não mexe na alteração em si)
    const ebtn = e.target.closest('[data-evento-editar]');
    if (ebtn) {
        const { data: ev } = await sb.from('argos_paciente_eventos')
            .select('*').eq('id', ebtn.dataset.eventoEditar).single();
        const d = prompt('Texto deste registro do histórico:', (ev && ev.descricao) || '');
        if (d === null) return;
        if (!d.trim()) { toast('O texto não pode ficar vazio — para apagar o registro, use o 🗑️.', true); return; }
        const { error } = await sb.from('argos_paciente_eventos')
            .update({ descricao: d.trim() }).eq('id', ebtn.dataset.eventoEditar);
        if (error) { toast('Erro ao salvar o registro.', true); return; }
        toast('Registro do histórico atualizado.');
        renderDinamicas();
        return;
    }
    const evDel = e.target.closest('[data-evento-del]');
    if (evDel) {
        if (!confirm('Apagar este registro do histórico?\nIsso não desfaz a alteração em si — só remove a anotação.')) return;
        const { error } = await sb.from('argos_paciente_eventos')
            .delete().eq('id', evDel.dataset.eventoDel);
        if (error) { toast('Erro ao apagar o registro.', true); return; }
        toast('Registro apagado do histórico.');
        renderDinamicas();
        return;
    }
    const del = e.target.closest('[data-avulsa-del]');
    if (del) {
        if (!confirm('Remover esta sessão avulsa?')) return;
        const { error } = await sb.from('argos_sessoes').delete().eq('id', del.dataset.avulsaDel);
        if (error) { toast('Erro ao remover.', true); return; }
        toast('Sessão removida.'); renderDinamicas(); return;
    }
    const btn = e.target.closest('[data-din]');
    if (!btn) return;
    if (btn.dataset.din === 'editar') abrirFormDinamica(btn.dataset.id);
    if (btn.dataset.din === 'excluir') {
        if (!confirm('Excluir esta dinâmica?\nAs sessões já registradas (frequência) NÃO serão apagadas; as projeções futuras deixam de existir.')) return;
        const { error } = await sb.from('argos_dinamicas').delete().eq('id', btn.dataset.id);
        if (error) { toast('Erro ao excluir dinâmica.', true); return; }
        toast('Dinâmica excluída.');
        await carregarTudo(); renderDinamicas();
    }
});

document.getElementById('btn-nova-dinamica').addEventListener('click', () => abrirFormDinamica(null));

// ---------- formulário da dinâmica ----------
function selectSalas(el, valor) {
    el.innerHTML = '<option value="">— Sem espaço definido —</option>' +
        salas.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    el.value = valor || '';
}
function selectProfissionais(el, valor) {
    el.innerHTML = '<option value="">— Selecionar —</option>' +
        profissionais.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    el.value = valor || '';
}
function selectServicosDoProf(el, profId, valor) {
    const ids = profServ.filter(x => x.profissional_id === profId).map(x => x.servico_id);
    const lista = servicos.filter(s => ids.includes(s.id));
    el.innerHTML = '<option value="">' + (profId ? (lista.length ? '— Selecionar —' : 'Profissional sem serviços cadastrados') : '— Selecione o profissional antes —') + '</option>' +
        lista.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    el.value = valor || '';
}

function linhaDia(dia) {
    const el = document.createElement('div');
    el.className = 'linha-dia';
    el.innerHTML = `
      <select class="dia-dow">${DOW_NOMES.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select>
      <input type="time" class="dia-hora" value="${dia && dia.hora || '09:00'}" />
      <button type="button" class="argos-btn small danger dia-remover">×</button>`;
    if (dia && dia.dow != null) el.querySelector('.dia-dow').value = dia.dow;
    el.querySelector('.dia-remover').addEventListener('click', () => el.remove());
    return el;
}
document.getElementById('btn-add-dia').addEventListener('click', () =>
    document.getElementById('lista-dias').appendChild(linhaDia()));

function linhaParcela(p) {
    const el = document.createElement('div');
    el.className = 'linha-dia';
    el.innerHTML = `
      <input type="date" class="par-data" value="${p && p.data || ''}" />
      <span class="campo-moeda"><input type="number" step="0.01" min="0" class="par-valor"
        placeholder="0,00" value="${p && p.valor || ''}" /></span>
      <button type="button" class="argos-btn small danger dia-remover">×</button>`;
    el.querySelector('.dia-remover').addEventListener('click', () => el.remove());
    return el;
}
document.getElementById('btn-add-parcela').addEventListener('click', () =>
    document.getElementById('lista-parcelas').appendChild(linhaParcela()));

// ---------- profissionais responsáveis e repasses (fonte única do
// profissional e do serviço da dinâmica) ----------
function linhaRepasse(r) {
    const el = document.createElement('div');
    el.className = 'linha-dia';
    el.innerHTML = `
      <select class="rep-prof" style="flex:2; min-width:130px" title="Profissional responsável">
        <option value="">— Profissional —</option>
        ${profissionais.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
      </select>
      <select class="rep-servico" style="flex:2; min-width:130px" title="Serviço prestado por este profissional"></select>
      <select class="rep-tipo" title="Forma do repasse">
        <option value="percentual">% do acordo</option>
        <option value="valor">R$ (valor nominal)</option>
      </select>
      <input type="number" class="rep-valor" min="0" step="0.01" placeholder="Repasse"
        title="Valor do repasse (vazio = usa o repasse padrão do profissional; 0 = sem repasse por produção)" value="${r && r.valor != null ? r.valor : ''}" />
      <button type="button" class="argos-btn small danger dia-remover">×</button>`;
    if (r && r.profissional_id) el.querySelector('.rep-prof').value = r.profissional_id;
    selectServicosDoProf(el.querySelector('.rep-servico'), (r && r.profissional_id) || null, (r && r.servico_id) || null);
    if (r && r.tipo) el.querySelector('.rep-tipo').value = r.tipo;
    el.querySelector('.rep-prof').addEventListener('change', () =>
        selectServicosDoProf(el.querySelector('.rep-servico'), el.querySelector('.rep-prof').value, null));
    el.querySelector('.dia-remover').addEventListener('click', () => { el.remove(); atualizarResumoRepasses(); });
    return el;
}
document.getElementById('btn-add-repasse').addEventListener('click', () => {
    document.getElementById('lista-repasses').appendChild(linhaRepasse());
    atualizarResumoRepasses();
});

function repassesDoFormulario() {
    return Array.from(document.querySelectorAll('#lista-repasses .linha-dia')).map(l => ({
        profissional_id: l.querySelector('.rep-prof').value || null,
        servico_id: l.querySelector('.rep-servico').value || null,
        tipo: l.querySelector('.rep-tipo').value,
        valor: l.querySelector('.rep-valor').value === '' ? null : Number(l.querySelector('.rep-valor').value)
    }));
}

// dinâmica "de mentira" só com o que a divisão precisa (acordo + repasses do formulário)
function dinamicaParaResumo() {
    const g = id => document.getElementById(id).value;
    return {
        acordo_tipo: g('din-acordo'),
        valor: g('din-valor') === '' ? null : Number(g('din-valor')),
        pacote_valor: g('din-pacote-valor') === '' ? null : Number(g('din-pacote-valor')),
        // valor null fica na lista: é a linha que herda o padrão do profissional
        repasses: repassesDoFormulario().filter(r => r.profissional_id && (r.valor == null || r.valor > 0))
    };
}

// mostra ao vivo quanto vai para os profissionais e quanto fica para a clínica
function atualizarResumoRepasses() {
    const el = document.getElementById('resumo-repasses');
    const d = dinamicaParaResumo();
    if (!d.repasses.length) { el.textContent = ''; el.style.color = ''; return; }
    const div = divisaoRepasses(d);
    if (!div.base && d.repasses.some(r => r.tipo === 'valor' && r.valor != null)) {
        el.style.color = '#e05555';
        el.textContent = '⚠️ Para usar repasse em R$, informe antes o valor do acordo financeiro.';
        return;
    }
    const estoura = div.pctProfs > 100.0001;
    el.style.color = estoura ? '#e05555' : '';
    el.textContent = `Profissionais: ${pctFmt(div.pctProfs)}% (${formataMoeda(div.base * div.pctProfs / 100)} ${unidadeRepasse(d)}) · Clínica: ${pctFmt(div.pctClinica)}% (${formataMoeda(div.valorClinica)} ${unidadeRepasse(d)})`
        + (estoura ? ' — ⛔ a soma passa de 100%!' : '');
}
['input', 'change'].forEach(ev => {
    document.getElementById('lista-repasses').addEventListener(ev, atualizarResumoRepasses);
    document.getElementById('din-valor').addEventListener(ev, atualizarResumoRepasses);
    document.getElementById('din-pacote-valor').addEventListener(ev, atualizarResumoRepasses);
    document.getElementById('din-acordo').addEventListener(ev, atualizarResumoRepasses);
});

function atualizarCondicionais() {
    const tipo = document.getElementById('din-tipo').value;
    document.getElementById('bloco-recorrencia').style.display = tipo === 'avulsa' ? 'none' : '';
    // em grupo: dia/horário/espaço vêm do grupo escolhido
    const emGrupo = tipo !== 'avulsa' && document.getElementById('din-modalidade').value === 'grupo';
    document.getElementById('bloco-grupo').style.display = emGrupo ? '' : 'none';
    document.getElementById('bloco-dias').style.display = emGrupo ? 'none' : '';
    document.getElementById('rotulo-freq-qtd').style.display = emGrupo ? 'none' : '';
    document.getElementById('rotulo-freq-periodo').style.display = emGrupo ? 'none' : '';
    document.getElementById('rotulo-duracao').style.display = emGrupo ? 'none' : '';
    document.getElementById('rotulo-sala').style.display = emGrupo ? 'none' : '';
    const periodo = document.getElementById('din-freq-periodo').value;
    document.querySelectorAll('#lista-dias .dia-dow').forEach(s => s.style.display = periodo === 'dia' ? 'none' : '');
    const fim = document.getElementById('din-fim-tipo').value;
    document.getElementById('rotulo-fim-ocorr').style.display = fim === 'apos_ocorrencias' ? '' : 'none';
    document.getElementById('rotulo-fim-data').style.display = fim === 'data' ? '' : 'none';
    const acordo = document.getElementById('din-acordo').value;
    document.getElementById('rotulo-valor').style.display = acordo === 'pacote' ? 'none' : '';
    document.getElementById('rotulo-valor').firstChild.textContent =
        acordo === 'fixo_mensal' ? 'Valor fixo mensal' : 'Valor por sessão';
    document.getElementById('bloco-pacote').style.display = acordo === 'pacote' ? '' : 'none';
    const modo = document.getElementById('din-pacote-modo').value;
    document.getElementById('pp-valor-inicio').style.display = modo === 'inicio_final' ? '' : 'none';
    document.getElementById('pp-x').style.display = modo === 'a_cada_x' ? '' : 'none';
    document.getElementById('pp-entrada').style.display = modo === 'entrada_parcelas' ? '' : 'none';
    document.getElementById('pp-nparcelas').style.display = modo === 'entrada_parcelas' ? '' : 'none';
    document.getElementById('pp-parcelas').style.display = modo === 'parcelas_datas' ? '' : 'none';
}
['din-tipo', 'din-modalidade', 'din-freq-periodo', 'din-fim-tipo', 'din-acordo', 'din-pacote-modo'].forEach(id =>
    document.getElementById(id).addEventListener('change', atualizarCondicionais));

function abrirFormDinamica(id) {
    editandoDinamicaId = id;
    const d = id ? dinamicas.find(x => x.id === id) : null;
    document.getElementById('modal-dinamica-titulo').textContent = d ? 'Editar dinâmica financeira' : 'Nova dinâmica financeira';

    document.getElementById('din-pacote-modo').innerHTML =
        Object.entries(PACOTE_MODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

    const v = (campo, val) => document.getElementById(campo).value = (val == null ? '' : val);
    v('din-rotulo', d && d.rotulo);
    v('din-tipo', d ? d.recorrencia_tipo : 'recorrente');
    v('din-freq-qtd', d && d.freq_qtd);
    v('din-freq-periodo', d ? (d.freq_periodo || 'semana') : 'semana');
    v('din-inicio', d && d.data_inicio);
    v('din-duracao', d ? d.duracao_min : 60);
    v('din-fim-tipo', d ? d.fim_tipo : 'indeterminado');
    v('din-fim-ocorrencias', d && d.fim_ocorrencias);
    v('din-fim-data', d && d.fim_data);
    v('din-modalidade', d ? d.modalidade : 'individual');
    selectGrupos(document.getElementById('din-grupo'), d && d.grupo_id);
    selectSalas(document.getElementById('din-sala'), d && d.sala_id);
    v('din-acordo', d ? d.acordo_tipo : 'por_sessao');
    v('din-valor', d && d.valor);
    v('din-nota-tipo', (d && d.nota_tipo) || 'indefinido');
    dicaNota();
    document.getElementById('lista-repasses').innerHTML = '';
    (d ? repassesDe(d) : []).forEach(r =>
        document.getElementById('lista-repasses').appendChild(linhaRepasse(r)));
    v('din-pacote-qtd', d && d.pacote_qtd);
    v('din-pacote-valor', d && d.pacote_valor);
    const pg = (d && d.pacote_pagamento) || {};
    v('din-pacote-modo', pg.modo || 'inicio');
    v('din-pp-valor-inicio', pg.valor_inicio);
    v('din-pp-x', pg.x);
    v('din-pp-entrada', pg.entrada);
    v('din-pp-nparcelas', pg.n_parcelas);
    document.getElementById('lista-parcelas').innerHTML = '';
    (pg.parcelas || []).forEach(p => document.getElementById('lista-parcelas').appendChild(linhaParcela(p)));
    document.getElementById('din-ativo').checked = d ? d.ativo !== false : true;

    document.getElementById('lista-dias').innerHTML = '';
    ((d && d.dias) || [{ dow: 1, hora: '09:00' }]).forEach(x =>
        document.getElementById('lista-dias').appendChild(linhaDia(x)));

    atualizarCondicionais();
    atualizarResumoRepasses();
    abrirModal('modal-dinamica-form');
}

document.getElementById('form-dinamica').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = id => document.getElementById(id).value;
    const num = id => g(id) === '' ? null : Number(g(id));
    const tipo = g('din-tipo');
    const dias = Array.from(document.querySelectorAll('#lista-dias .linha-dia')).map(l => ({
        dow: Number(l.querySelector('.dia-dow').value),
        hora: l.querySelector('.dia-hora').value
    })).filter(x => x.hora);

    const emGrupo = tipo === 'recorrente' && g('din-modalidade') === 'grupo';
    if (tipo === 'recorrente') {
        if (!g('din-inicio')) { toast('Informe a data de início.', true); return; }
        if (!emGrupo && !dias.length) { toast('Adicione pelo menos um dia/horário.', true); return; }
    }
    const acordo = g('din-acordo');
    const pg = { modo: g('din-pacote-modo') };
    if (pg.modo === 'inicio_final') pg.valor_inicio = num('din-pp-valor-inicio');
    if (pg.modo === 'a_cada_x') pg.x = num('din-pp-x');
    if (pg.modo === 'entrada_parcelas') { pg.entrada = num('din-pp-entrada'); pg.n_parcelas = num('din-pp-nparcelas'); }
    if (pg.modo === 'parcelas_datas') {
        pg.parcelas = Array.from(document.querySelectorAll('#lista-parcelas .linha-dia')).map(l => ({
            data: l.querySelector('.par-data').value, valor: Number(l.querySelector('.par-valor').value) || 0
        })).filter(p => p.data);
    }

    // profissionais responsáveis e repasses (fonte única do profissional/serviço)
    const repasses = repassesDoFormulario();
    if (repasses.some(r => !r.profissional_id)) {
        toast('Escolha o profissional em cada linha de repasse (ou remova a linha).', true);
        return;
    }
    if (repasses.some(r => r.valor != null && r.valor < 0)) {
        toast('O repasse não pode ser negativo.', true);
        return;
    }
    const idsRep = repasses.map(r => r.profissional_id);
    if (new Set(idsRep).size !== idsRep.length) {
        toast('O mesmo profissional aparece mais de uma vez nos repasses.', true);
        return;
    }

    const registro = {
        paciente_id: pacienteAtual.id,
        rotulo: g('din-rotulo').trim() || null,
        recorrencia_tipo: tipo,
        dias: tipo === 'recorrente' ? dias : [],
        duracao_min: num('din-duracao') || 60,
        freq_qtd: num('din-freq-qtd'),
        freq_periodo: g('din-freq-periodo'),
        data_inicio: g('din-inicio') || null,
        fim_tipo: g('din-fim-tipo'),
        fim_ocorrencias: num('din-fim-ocorrencias'),
        fim_data: g('din-fim-data') || null,
        modalidade: g('din-modalidade'),
        sala_id: g('din-sala') || null,
        // o profissional/serviço "principal" da dinâmica é o da primeira linha
        // de repasses (agenda, conflitos e filtros continuam funcionando)
        profissional_id: (repasses[0] && repasses[0].profissional_id) || null,
        servico_id: (repasses[0] && repasses[0].servico_id) || null,
        acordo_tipo: acordo,
        nota_tipo: g('din-nota-tipo') || 'indefinido',
        valor: acordo === 'pacote' ? null : num('din-valor'),
        pacote_qtd: acordo === 'pacote' ? num('din-pacote-qtd') : null,
        pacote_valor: acordo === 'pacote' ? num('din-pacote-valor') : null,
        pacote_pagamento: acordo === 'pacote' ? pg : null,
        repasses,
        repasse_percentual: null, // substituído pela lista de repasses
        grupo_id: null,
        ativo: document.getElementById('din-ativo').checked
    };

    // soma dos repasses (% + nominais convertidos) nunca pode passar de 100% do acordo
    if (repasses.length) {
        const div = divisaoRepasses(registro);
        if (!div.base && repasses.some(r => r.tipo === 'valor' && r.valor != null)) {
            toast('Para repasse em R$, informe antes o valor do acordo financeiro.', true);
            return;
        }
        if (div.pctProfs > 100.0001) {
            toast(`⛔ A soma dos repasses dá ${pctFmt(div.pctProfs)}% do acordo — não pode passar de 100%. Ajuste para sobrar a parte da clínica.`, true);
            return;
        }
    }

    // Em grupo: dia/horário/espaço/duração vêm do grupo escolhido
    if (emGrupo) {
        const grupoSel = grupos.find(x => x.id === document.getElementById('din-grupo').value);
        if (!grupoSel) { toast('Escolha o grupo terapêutico (ou crie um novo).', true); return; }
        registro.grupo_id = grupoSel.id;
        registro.dias = [{ dow: grupoSel.dow, hora: grupoSel.hora }];
        registro.freq_qtd = 1;
        registro.freq_periodo = 'semana';
        registro.duracao_min = grupoSel.duracao_min || 60;
        registro.sala_id = grupoSel.sala_id;
    }
    const dinamicaAntes = editandoDinamicaId ? dinamicas.find(x => x.id === editandoDinamicaId) : null;
    const grupoAnterior = dinamicaAntes ? (dinamicaAntes.grupo_id || null) : null; // capturado ANTES do update
    // Bloqueio de conflito: individual não divide espaço/profissional/horário
    // com ninguém, e ninguém entra em cima de uma individual existente.
    // quem só mexeu no acordo não criou choque nenhum: o que houver já estava
    // lá antes, e recusar o salvamento não o desfaz
    if (registro.recorrencia_tipo === 'recorrente' && registro.ativo
        && !mesmaAgenda(registro, dinamicaAntes)) {
        const outras = dinamicas.filter(d => d.id !== editandoDinamicaId && d.ativo !== false);
        const { data: sessTodas } = await todas(() => sb.from('argos_sessoes').select('*'));
        const sessOutras = (sessTodas || []).filter(s => s.dinamica_ref !== editandoDinamicaId);
        // pacientes com processo encerrado liberam os horários a partir do corte
        const cc = aplicarFimDeProcesso(outras, sessOutras, pacientes);
        const conflitos = conflitosDeDinamica({ ...registro, id: editandoDinamicaId || 'nova' }, cc.dinamicas, cc.sessoes);
        if (conflitos.length) {
            const c = conflitos[0];
            const quem = (pacientes.find(x => x.id === c.outra.paciente_id) || {}).nome || 'outro paciente';
            toast(`⛔ Conflito de agenda: ${formataBR(c.minha.data)} às ${c.minha.hora} já tem sessão ${(c.outra.modalidade || 'individual') === 'individual' ? 'INDIVIDUAL' : 'em grupo'} de ${quem} no mesmo espaço/profissional${conflitos.length > 1 ? ` (+${conflitos.length - 1} outro(s) conflito(s))` : ''}. A dinâmica não foi salva.`, true);
            return;
        }
    }

    const q = editandoDinamicaId
        ? sb.from('argos_dinamicas').update(registro).eq('id', editandoDinamicaId)
        : sb.from('argos_dinamicas').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar dinâmica.', true); return; }

    // sincroniza a participação do paciente no grupo terapêutico
    if (registro.grupo_id) {
        if (grupoAnterior && grupoAnterior !== registro.grupo_id) {
            await sb.from('argos_grupo_membros').delete()
                .eq('grupo_id', grupoAnterior).eq('paciente_id', pacienteAtual.id);
        }
        const { error: eM } = await sb.from('argos_grupo_membros')
            .insert({ grupo_id: registro.grupo_id, paciente_id: pacienteAtual.id });
        if (eM && eM.code !== '23505') console.error(eM);
    } else if (grupoAnterior) {
        await sb.from('argos_grupo_membros').delete()
            .eq('grupo_id', grupoAnterior).eq('paciente_id', pacienteAtual.id);
    }

    fecharModal('modal-dinamica-form');
    toast('Dinâmica salva.');
    await carregarTudo();
    renderDinamicas();
});

// ---------- novo grupo criado a partir da dinâmica ----------
document.getElementById('btn-novo-grupo-inline').addEventListener('click', () => {
    document.getElementById('gn-dow').innerHTML = DOW_NOMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
    document.getElementById('gn-sala').innerHTML = '<option value="">— Sem espaço definido —</option>' +
        salas.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    document.getElementById('gn-nome').value = '';
    abrirModal('modal-grupo-novo');
});

const minutosDe = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + (b || 0); };

document.getElementById('form-grupo-novo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registro = {
        nome: document.getElementById('gn-nome').value.trim(),
        dow: Number(document.getElementById('gn-dow').value),
        hora: document.getElementById('gn-hora').value,
        duracao_min: Number(document.getElementById('gn-duracao').value) || 60,
        sala_id: document.getElementById('gn-sala').value || null,
        ativo: true
    };
    if (!registro.nome || !registro.hora) { toast('Informe nome e hora do grupo.', true); return; }
    // mesmo horário/espaço de outro grupo não pode (troca entre grupos é na Agenda)
    const ocupante = grupos.find(gr => gr.ativo !== false && gr.dow === registro.dow
        && ((gr.sala_id && registro.sala_id && gr.sala_id === registro.sala_id) || (!gr.sala_id && !registro.sala_id))
        && minutosDe(gr.hora) < minutosDe(registro.hora) + registro.duracao_min
        && minutosDe(registro.hora) < minutosDe(gr.hora) + (gr.duracao_min || 60));
    if (ocupante) {
        toast(`⛔ Esse horário já é do grupo "${ocupante.nome}". Escolha outro horário/espaço (a troca entre grupos é feita na Agenda).`, true);
        return;
    }
    const { data, error } = await sb.from('argos_grupos').insert(registro).select().single();
    if (error) { console.error(error); toast('Erro ao criar grupo.', true); return; }
    fecharModal('modal-grupo-novo');
    toast('Grupo criado.');
    const { data: gs } = await sb.from('argos_grupos').select('*').order('hora');
    grupos = gs || grupos;
    selectGrupos(document.getElementById('din-grupo'), data.id);
});

// ============================================================
// SESSÃO AVULSA
// ============================================================
document.getElementById('btn-nova-avulsa').addEventListener('click', () => {
    selectSalas(document.getElementById('avu-sala'), null);
    selectProfissionais(document.getElementById('avu-profissional'), null);
    selectServicosDoProf(document.getElementById('avu-servico'), null, null);
    document.getElementById('avu-tipo').value = 'individual';
    document.getElementById('avu-rotulo-grupo').style.display = 'none';
    abrirModal('modal-avulsa');
});

// tipo «em grupo» pede qual grupo — só os grupos ativos entram na lista
document.getElementById('avu-tipo').addEventListener('change', () => {
    const emGrupo = document.getElementById('avu-tipo').value === 'grupo';
    document.getElementById('avu-rotulo-grupo').style.display = emGrupo ? '' : 'none';
    if (emGrupo) {
        document.getElementById('avu-grupo').innerHTML =
            '<option value="">— Escolher grupo —</option>'
            + grupos.filter(g => g.ativo !== false).map(g =>
                `<option value="${g.id}">👥 ${esc(g.nome)} — ${DOW_NOMES[g.dow]} ${g.hora}</option>`).join('');
    }
});
document.getElementById('avu-profissional').addEventListener('change', () =>
    selectServicosDoProf(document.getElementById('avu-servico'), document.getElementById('avu-profissional').value, null));

document.getElementById('form-avulsa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = id => document.getElementById(id).value;
    const registro = {
        paciente_id: pacienteAtual.id, dinamica_id: null, dinamica_ref: null,
        data: g('avu-data'), hora: g('avu-hora'),
        duracao_min: Number(g('avu-duracao')) || 60,
        valor: g('avu-valor') === '' ? null : Number(g('avu-valor')),
        sala_id: g('avu-sala') || null,
        profissional_id: g('avu-profissional') || null,
        servico_id: g('avu-servico') || null,
        modalidade: g('avu-tipo') || 'individual',
        grupo_id: g('avu-tipo') === 'grupo' ? (g('avu-grupo') || null) : null,
        status: '??'
    };
    if (registro.modalidade === 'grupo' && !registro.grupo_id) {
        toast('Diga em qual grupo a sessão aconteceu.', true);
        return;
    }
    // Sessão avulsa é individual: não pode cair em cima de outra sessão
    const { data: sessTodas } = await todas(() => sb.from('argos_sessoes').select('*'));
    const ca = aplicarFimDeProcesso(dinamicas.filter(d => d.ativo !== false), sessTodas || [], pacientes);
    const conflitos = conflitosDeSessao(registro, ca.dinamicas, ca.sessoes);
    if (conflitos.length) {
        const quem = (pacientes.find(x => x.id === conflitos[0].paciente_id) || {}).nome || 'outro paciente';
        toast(`⛔ Conflito de agenda: já existe sessão de ${quem} nesse horário no mesmo espaço/profissional. A sessão não foi criada.`, true);
        return;
    }
    const { error } = await sb.from('argos_sessoes').insert(registro);
    if (error) { console.error(error); toast('Erro ao criar sessão.', true); return; }
    fecharModal('modal-avulsa');
    toast('Sessão avulsa criada.');
    renderDinamicas();
});

// ============================================================
// ESPAÇOS (salas)
// ============================================================
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

// ============================================================
// EXCLUSÃO COM OPÇÕES DE HISTÓRICO
// ============================================================

// Materializa como '??' todas as projeções passadas ainda não registradas,
// para que o histórico de frequência sobreviva à remoção das dinâmicas.
async function materializarHistorico(pacId) {
    const dins = dinamicas.filter(d => d.paciente_id === pacId);
    const { data: sess } = await todas(() => sb.from('argos_sessoes').select('*').eq('paciente_id', pacId));
    const inicio = dins.map(d => d.data_inicio).filter(Boolean).sort()[0];
    if (!inicio) return sess || [];
    const mescladas = mesclarSessoes(dins, sess || [], inicio, hojeISO());
    const novas = mescladas.filter(s => s.projetada).map(s => ({
        paciente_id: pacId, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
        data: s.data, hora: s.hora, duracao_min: s.duracao_min,
        sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
        servico_id: s.servico_id || null, status: '??'
    }));
    if (novas.length) {
        const { error } = await sb.from('argos_sessoes').insert(novas);
        if (error) console.error(error);
    }
    return mescladas;
}

function htmlHistorico(p, dins, sessoes) {
    const meses = [...new Set(sessoes.map(s => s.data.slice(0, 7)))].sort();
    const linhasMes = meses.map(m => {
        const f = fechamentoPaciente(p, dins, sessoes.filter(s => !s.projetada), m);
        return `<tr><td>${m.split('-').reverse().join('/')}</td>
          <td>${f.contagens.ok}</td><td>${f.contagens.fj}</td><td>${f.contagens.fc}</td>
          <td>${f.contagens.nc}</td><td>${f.contagens['??']}</td><td>${formataMoeda(f.valor)}</td></tr>`;
    }).join('');
    const linhasSessao = sessoes.map(s => `
      <tr><td>${formataBR(s.data)}</td><td>${s.hora}</td>
      <td>${(STATUS_SESSAO[s.status] || {}).label || s.status} — ${(STATUS_SESSAO[s.status] || {}).desc || ''}</td>
      <td>${esc(nomeProf(s.profissional_id))}</td><td>${esc(nomeSala(s.sala_id))}</td></tr>`).join('');
    return `<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8">
      <title>Histórico — ${esc(p.nome)}</title>
      <style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:1.3rem}h2{font-size:1.05rem;margin-top:22px}
      table{border-collapse:collapse;width:100%;font-size:.85rem}td,th{border:1px solid #999;padding:5px 8px;text-align:left}</style></head><body>
      <h1>Histórico de frequência e financeiro — ${esc(p.nome)}</h1>
      <p>Gerado em ${formataBR(hojeISO())}. Legenda: Ok presente (contabiliza) · Fj falta não contabilizada · Fc falta contabilizada · Nc não houve · ?? pendente.</p>
      <h2>Resumo mensal</h2>
      <table><tr><th>Mês</th><th>Ok</th><th>Fj</th><th>Fc</th><th>Nc</th><th>??</th><th>Valor do mês</th></tr>${linhasMes || '<tr><td colspan="7">Sem registros</td></tr>'}</table>
      <h2>Todas as sessões</h2>
      <table><tr><th>Data</th><th>Hora</th><th>Status</th><th>Profissional</th><th>Espaço</th></tr>${linhasSessao || '<tr><td colspan="5">Sem sessões</td></tr>'}</table>
      <script>window.print()<\/script></body></html>`;
}

document.getElementById('btn-confirmar-exclusao').addEventListener('click', async () => {
    const modo = document.querySelector('input[name="modo-excluir"]:checked').value;
    const p = pacienteAtual;
    if (!p) return;

    if (modo === 'manter') {
        await materializarHistorico(p.id);
        const { error: e1 } = await sb.from('argos_dinamicas').update({ ativo: false }).eq('paciente_id', p.id);
        const { error: e2 } = await sb.from('argos_pacientes').update({
            nome: '(cadastro removido)', nascimento: null, cpf: null,
            colegio: null, serie: null, turno: null,
            mae_nome: null, mae_profissao: null, mae_fone: null, mae_cpf: null,
            pai_nome: null, pai_profissao: null, pai_fone: null, pai_cpf: null,
            email: null, endereco: null, responsavel_financeiro: null, indicacao: null,
            observacoes: null, anamnese_info: null, ativo: false, cadastro_removido: true
        }).eq('id', p.id);
        if (e1 || e2) { console.error(e1 || e2); toast('Erro ao remover cadastro.', true); return; }
        toast('Cadastro removido; históricos mantidos.');
    } else {
        if (modo === 'pdf') {
            const todas = await materializarHistorico(p.id);
            const dins = dinamicas.filter(d => d.paciente_id === p.id);
            const w = window.open('', '_blank');
            if (w) { w.document.write(htmlHistorico(p, dins, todas)); w.document.close(); }
            if (!confirm('O histórico foi aberto para impressão/PDF em outra aba.\nConfirmar a exclusão DEFINITIVA de tudo?')) return;
        } else {
            if (!confirm(`Apagar DEFINITIVAMENTE "${p.nome}" e todos os históricos?`)) return;
        }
        const { error } = await sb.from('argos_pacientes').delete().eq('id', p.id);
        if (error) { console.error(error); toast('Erro ao excluir paciente.', true); return; }
        toast('Paciente e históricos excluídos.');
    }
    fecharModal('modal-excluir');
    await carregarTudo();
});

// ============================================================
// INÍCIO
// ============================================================
(async function init() {
    perm = await carregarPermissoes();
    perm.aplicarVisibilidade();
    cobUI = montarCobrancaUI(perm);
    await carregarTudo();
    // voltar da Evolução/Anamnese reabre o painel daquele paciente
    const alvo = new URLSearchParams(location.search).get('paciente');
    if (alvo) {
        const p = pacientes.find(x => x.id === alvo);
        if (p && perm.pode('evolucao_ver')) abrirModalEvolucao(p);
        history.replaceState(null, '', 'pacientes.html');
    }
})();
