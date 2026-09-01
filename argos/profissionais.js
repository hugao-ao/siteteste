// profissionais.js — Card "Profissionais" da área Argos
// CRUD de profissionais (nome) e dos serviços que cada um presta.
// A base de serviços é única (sem homônimos, ignorando maiúsculas/minúsculas)
// e serviços não podem ser excluídos da base por esta tela.

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    repassesDe, divisaoRepasses, formataBR, hojeISO,
    definirRepassePadrao, repassePadraoDe, STATUS_SESSAO
} from './argos-recorrencia.js';
import {
    gravarFrequencia, registrarFaltasJustificadas, avisarMudanca
} from './argos-frequencia.js';
import { fatorNFDoMes } from './argos-cobranca.js';
import {
    atendimentosDoProfissional, resumoDaValidacao, fraseDaValidacao, filtrar,
    ordenarValidacao, cobradosSemSessao, textoDoRelatorio, MOTIVOS, SITUACOES
} from './argos-validacao.js';
import { cobradoPorPaciente } from './argos-fechamento.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let profissionais = [], servicos = [], vinculos = [], dinamicas = [], pacientes = [];

const REMUNERACAO_LABELS = {
    fixo: '💼 Repasse fixo mensal',
    producao: '💼 % por produção',
    producao_fixo: '💼 Produção + fixo mensal'
};
let editandoProfId = null;
let profServicoAtual = null; // profissional do modal de serviços

// normaliza para comparar nomes: minúsculas, sem acentos, espaços únicos
export function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ').trim();
}

async function carregarTudo() {
    const [rProf, rServ, rVinc, rDin, rPac] = await Promise.all([
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_servicos_base').select('*').order('nome'),
        sb.from('argos_profissional_servicos').select('*'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        sb.from('argos_pacientes').select('id, nome, cadastro_removido')
    ]);
    const erro = rProf.error || rServ.error || rVinc.error || rDin.error || rPac.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    profissionais = rProf.data || [];
    servicos = rServ.data || [];
    vinculos = rVinc.data || [];
    dinamicas = rDin.data || [];
    pacientes = rPac.data || [];
    definirRepassePadrao(profissionais);
    renderLista();
}

function formataMoeda(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const pctFmt = x => (Math.round(x * 100) / 100).toLocaleString('pt-BR');

function renderLista() {
    const busca = normalizar(document.getElementById('busca').value);
    const podeGerenciar = perm.pode('profissionais_gerenciar');
    const podeServicos = perm.pode('profissional_servicos_gerenciar');
    const lista = profissionais.filter(p => !busca || normalizar(p.nome).includes(busca));

    document.getElementById('lista-profissionais').innerHTML = lista.map(p => {
        const meus = vinculos.filter(v => v.profissional_id === p.id)
            .map(v => servicos.find(s => s.id === v.servico_id)).filter(Boolean)
            .sort((a, b) => a.nome.localeCompare(b.nome));
        const remun = REMUNERACAO_LABELS[p.remuneracao_tipo || 'producao'];
        const fixoTxt = (p.remuneracao_tipo === 'fixo' || p.remuneracao_tipo === 'producao_fixo') && p.valor_fixo_mensal != null
            ? ` — ${formataMoeda(p.valor_fixo_mensal)}/mês` : '';
        const recebeProducao = (p.remuneracao_tipo || 'producao') !== 'fixo';
        const padraoTxt = !recebeProducao ? ''
            : p.repasse_padrao != null
                ? `<div class="mini-info">Repasse padrão: <b>${pctFmt(Number(p.repasse_padrao))}%</b> da produção</div>`
                : `<div class="mini-info" style="color:var(--argos-warn)">⚠ Sem repasse padrão — a produção
                    dele calcula R$ 0,00 nas dinâmicas que não definem o repasse.</div>`;
        return `
        <div class="argos-minicard">
          <div class="mini-topo">
            <div class="mini-nome">${esc(p.nome)}</div>
            <span>
              ${podeGerenciar ? `<button class="argos-btn small" data-acao="editar" data-id="${p.id}">✏️</button>
              <button class="argos-btn small danger" data-acao="excluir" data-id="${p.id}">🗑️</button>` : ''}
            </span>
          </div>
          <div class="mini-info">${esc(remun)}${esc(fixoTxt)}</div>
          ${padraoTxt}
          <div class="chips-servicos">
            ${meus.map(s => `<span class="chip-servico">${esc(s.nome)}${podeServicos ? `<button data-acao="desvincular" data-id="${p.id}" data-servico="${s.id}" title="Remover este serviço do profissional">×</button>` : ''}</span>`).join('')
              || '<span class="dim">Nenhum serviço vinculado.</span>'}
          </div>
          <div class="mini-acoes">
            ${podeServicos ? `<button class="argos-btn small primary" data-acao="servicos" data-id="${p.id}">+ Serviço</button>` : ''}
            ${perm.pode('agenda_ver') ? `<a class="argos-btn small" href="agenda.html?profissional=${p.id}">🗓️ Agenda</a>` : ''}
            ${perm.pode('validacao_atendimentos') ? `<button class="argos-btn small" data-acao="validar" data-id="${p.id}">📋 Atendimentos do mês</button>` : ''}
          </div>
        </div>`;
    }).join('');
    document.getElementById('prof-vazio').style.display = lista.length ? 'none' : '';
}

document.getElementById('busca').addEventListener('input', renderLista);

document.getElementById('lista-profissionais').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const p = profissionais.find(x => x.id === btn.dataset.id);
    if (!p) return;
    if (btn.dataset.acao === 'editar') {
        editandoProfId = p.id;
        document.getElementById('modal-prof-titulo').textContent = 'Editar profissional';
        document.getElementById('prof-nome').value = p.nome;
        document.getElementById('prof-remuneracao').value = p.remuneracao_tipo || 'producao';
        document.getElementById('prof-fixo').value = p.valor_fixo_mensal != null ? p.valor_fixo_mensal : '';
        document.getElementById('prof-repasse-padrao').value = p.repasse_padrao != null ? p.repasse_padrao : '';
        atualizarCampoFixo();
        abrirModal('modal-prof');
    }
    if (btn.dataset.acao === 'excluir') {
        if (!confirm(`Excluir o profissional "${p.nome}"?\nOs serviços continuam na base da clínica; sessões e dinâmicas que o usavam ficarão sem profissional.`)) return;
        const { error } = await sb.from('argos_profissionais').delete().eq('id', p.id);
        if (error) { toast('Erro ao excluir.', true); return; }
        toast('Profissional excluído.');
        await carregarTudo();
    }
    if (btn.dataset.acao === 'servicos') {
        profServicoAtual = p;
        document.getElementById('modal-servico-titulo').textContent = `Serviços de ${p.nome}`;
        document.getElementById('servico-busca').value = '';
        renderListaServicos();
        abrirModal('modal-servico');
    }
    if (btn.dataset.acao === 'validar') { await abrirValidacao(p); return; }
    if (btn.dataset.acao === 'desvincular') {
        const s = servicos.find(x => x.id === btn.dataset.servico);
        if (!confirm(`Remover "${s.nome}" dos serviços de ${p.nome}?\n(O serviço continua na base da clínica.)`)) return;
        const { error } = await sb.from('argos_profissional_servicos').delete()
            .eq('profissional_id', p.id).eq('servico_id', s.id);
        if (error) { toast('Erro ao remover vínculo.', true); return; }
        await carregarTudo();
    }
});

// ---------- CRUD do profissional ----------
function atualizarCampoFixo() {
    const tipo = document.getElementById('prof-remuneracao').value;
    document.getElementById('rotulo-fixo').style.display =
        (tipo === 'fixo' || tipo === 'producao_fixo') ? '' : 'none';
    // quem é só fixo não recebe por produção — o padrão não se aplica
    document.getElementById('rotulo-repasse-padrao').style.display =
        tipo === 'fixo' ? 'none' : '';
}
document.getElementById('prof-remuneracao').addEventListener('change', atualizarCampoFixo);

document.getElementById('btn-novo-prof').addEventListener('click', () => {
    editandoProfId = null;
    document.getElementById('modal-prof-titulo').textContent = 'Novo profissional';
    document.getElementById('prof-nome').value = '';
    document.getElementById('prof-remuneracao').value = 'producao';
    document.getElementById('prof-fixo').value = '';
    document.getElementById('prof-repasse-padrao').value = '';
    atualizarCampoFixo();
    abrirModal('modal-prof');
});

document.getElementById('form-prof').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('prof-nome').value.trim();
    if (!nome) return;
    const remuneracao_tipo = document.getElementById('prof-remuneracao').value;
    const fixoBruto = document.getElementById('prof-fixo').value;
    const padraoBruto = document.getElementById('prof-repasse-padrao').value;
    if (padraoBruto !== '' && (Number(padraoBruto) < 0 || Number(padraoBruto) > 100)) {
        toast('O repasse padrão é uma % entre 0 e 100.', true);
        return;
    }
    const registro = {
        nome, remuneracao_tipo,
        valor_fixo_mensal: (remuneracao_tipo === 'fixo' || remuneracao_tipo === 'producao_fixo') && fixoBruto !== ''
            ? Number(fixoBruto) : null,
        repasse_padrao: remuneracao_tipo !== 'fixo' && padraoBruto !== '' ? Number(padraoBruto) : null
    };
    const q = editandoProfId
        ? sb.from('argos_profissionais').update(registro).eq('id', editandoProfId)
        : sb.from('argos_profissionais').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar.', true); return; }
    fecharModal('modal-prof');
    toast(editandoProfId ? 'Profissional atualizado.' : 'Profissional criado.');
    await carregarTudo();
});

// ---------- modal de serviços (lista filtrável da base única) ----------
document.getElementById('servico-busca').addEventListener('input', renderListaServicos);

function renderListaServicos() {
    const termo = document.getElementById('servico-busca').value;
    const norm = normalizar(termo);
    const meusIds = vinculos.filter(v => v.profissional_id === profServicoAtual.id).map(v => v.servico_id);
    const lista = servicos
        .filter(s => !norm || s.nome_norm.includes(norm))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    const existeExato = servicos.some(s => s.nome_norm === norm);

    document.getElementById('servico-lista').innerHTML =
        lista.map(s => {
            const meu = meusIds.includes(s.id);
            return `
            <div class="servico-item ${meu ? 'vinculado' : ''}">
              <span>${esc(s.nome)}</span>
              ${meu ? '<span class="badge verde">Já presta</span>'
                    : `<button class="argos-btn small primary" data-vincular="${s.id}">Adicionar</button>`}
            </div>`;
        }).join('')
        + (norm && !existeExato ? `
          <div class="servico-item novo">
            <span>Criar novo serviço: <b>${esc(termo.trim())}</b></span>
            <button class="argos-btn small primary" id="btn-criar-servico">Criar e adicionar</button>
          </div>` : '')
        + (!lista.length && !norm ? '<p class="dim" style="padding:10px">Nenhum serviço na base ainda — digite um nome para criar o primeiro.</p>' : '');
}

document.getElementById('servico-lista').addEventListener('click', async (e) => {
    const vincular = e.target.closest('[data-vincular]');
    if (vincular) {
        const { error } = await sb.from('argos_profissional_servicos')
            .insert({ profissional_id: profServicoAtual.id, servico_id: vincular.dataset.vincular });
        if (error && error.code !== '23505') { toast('Erro ao vincular.', true); return; }
        toast('Serviço adicionado.');
        await carregarTudo();
        renderListaServicos();
        return;
    }
    if (e.target.closest('#btn-criar-servico')) {
        const nome = document.getElementById('servico-busca').value.replace(/\s+/g, ' ').trim();
        const norm = normalizar(nome);
        if (!nome) return;
        if (servicos.some(s => s.nome_norm === norm)) { toast('Já existe um serviço com esse nome.', true); return; }
        const { data, error } = await sb.from('argos_servicos_base')
            .insert({ nome, nome_norm: norm }).select().single();
        if (error) {
            toast(error.code === '23505' ? 'Já existe um serviço com esse nome.' : 'Erro ao criar serviço.', true);
            return;
        }
        const { error: e2 } = await sb.from('argos_profissional_servicos')
            .insert({ profissional_id: profServicoAtual.id, servico_id: data.id });
        if (e2 && e2.code !== '23505') { toast('Serviço criado, mas houve erro ao vincular.', true); }
        else toast('Serviço criado e adicionado.');
        await carregarTudo();
        renderListaServicos();
    }
});

// ---------- início ----------
(async function init() {
    perm = await carregarPermissoes();
    perm.aplicarVisibilidade();
    await carregarTudo();
})();

// ---------------------------------------------------------------------------
// Atendimentos do mês: o que o profissional confere antes do acerto
// ---------------------------------------------------------------------------
// O repasse é uma conta que o sistema faz. Para o profissional poder conferi-la
// ele precisa ver o que ela conta — e ver também as sessões que são dele sem
// ele ter atendido, e as que ele atendeu no lugar de outro.

let valProf = null;        // profissional em conferência
let valSessoes = [], valDinamicas = [], valPacientes = [], valValidacoes = [];
let valNotasMes = [], valAjustes = [], valLinhas = [], valFixos = [];

const valEl = id => document.getElementById(id);

async function abrirValidacao(prof) {
    valProf = prof;
    valEl('val-titulo').textContent = `📋 Atendimentos de ${prof.nome}`;
    valEl('val-mes').value = valEl('val-mes').value || hojeISO().slice(0, 7);
    valEl('val-filtro').value = 'todas';
    valEl('val-busca').value = '';
    valEl('val-lista').innerHTML = '<p class="dim">Carregando…</p>';
    valEl('val-resumo').innerHTML = '';
    abrirModal('modal-validacao');
    await carregarValidacao();
}

async function carregarValidacao() {
    if (!valProf) return;
    const [rPac, rDin, rSes, rVal, rNM, rAj] = await Promise.all([
        sb.from('argos_pacientes').select('id, nome, ativo, cadastro_removido, processo_fim_data, processo_fim_tipo').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        todas(() => sb.from('argos_sessao_validacao').select('*').eq('profissional_id', valProf.id)),
        todas(() => sb.from('argos_nota_mes').select('*')),
        todas(() => sb.from('argos_cobranca_mes').select('*'))
    ]);
    if (rPac.error || rDin.error || rSes.error) {
        console.error(rPac.error || rDin.error || rSes.error);
        toast('Erro ao carregar os atendimentos.', true);
        return;
    }
    valPacientes = rPac.data || [];
    valDinamicas = rDin.data || [];
    valSessoes = rSes.data || [];
    valValidacoes = (rVal && rVal.data) || [];
    valNotasMes = (rNM && rNM.data) || [];
    valAjustes = (rAj && rAj.data) || [];
    renderValidacao();
}

function renderValidacao() {
    if (!valProf) return;
    const mes = valEl('val-mes').value;
    // paciente com nota fiscal no mês repassa sobre total − 10%; cobrança
    // ajustada/enviada na página de cobrança muda a base na mesma proporção
    const notaFator = fatorNFDoMes({
        pacientes: valPacientes, dinamicas: valDinamicas,
        excecoes: valNotasMes, mes });
    const cobrado = cobradoPorPaciente(valAjustes, mes);
    valLinhas = atendimentosDoProfissional({
        profissional_id: valProf.id, mes, pacientes: valPacientes,
        dinamicas: valDinamicas, sessoes: valSessoes,
        profissionais, validacoes: valValidacoes,
        notaFator, cobrado
    });
    valFixos = cobradosSemSessao({
        profissional_id: valProf.id, mes, pacientes: valPacientes,
        dinamicas: valDinamicas, sessoes: valSessoes, notaFator, cobrado
    });
    const resumo = resumoDaValidacao(valLinhas);

    // o sintoma clássico de padrão não definido: sessões contabilizando R$ 0,00.
    // O aviso traz o campo junto — dá para resolver sem sair do modal.
    // só é sintoma de padrão faltando quando a linha zerada vem de dinâmica
    // cujo repasse deste profissional está VAZIO (herdaria o padrão). Sessão
    // redirecionada a quem cobriu, ou de dinâmica em que ele não tem repasse,
    // vale 0 de propósito.
    const semPadrao = (valProf.remuneracao_tipo || 'producao') !== 'fixo'
        && valProf.repasse_padrao == null
        && valLinhas.some(l => {
            if (!l.contabiliza || l.valor > 0) return false;
            if (l.sessao.repasse_profissional_id
                && l.sessao.repasse_profissional_id !== valProf.id) return false;
            const d = valDinamicas.find(x =>
                x.id === (l.sessao.dinamica_ref || l.sessao.dinamica_id));
            return d && repassesDe(d).some(r =>
                r.profissional_id === valProf.id && r.valor == null);
        });
    const podeDefinir = perm.master || perm.pode('profissionais_gerenciar');
    const aviso = !semPadrao ? '' : `
      <div class="linha-alerta" style="padding:10px 12px; margin-bottom:10px; border-radius:8px">
        ⚠ <b>${esc(valProf.nome)} está sem repasse padrão definido</b> — por isso as sessões
        estão valendo R$ 0,00. ${podeDefinir ? `Defina a % combinada:
        <input type="number" id="val-padrao-pct" class="argos-input" min="0" max="100"
          step="0.01" placeholder="%" style="width:90px" />
        <button type="button" class="argos-btn small primary" id="btn-val-padrao">Salvar e recalcular</button>`
        : 'Peça a quem gerencia os profissionais para definir a % no cadastro dele.'}
      </div>`;

    valEl('val-resumo').innerHTML = `${aviso}
      <div class="resumo-linha">
        <span class="resumo-item">${esc(fraseDaValidacao(resumo))}</span>
        <span class="resumo-item"><b>${resumo.contabilizadas}</b> contabilizam ·
          <b>${formataMoeda(resumo.valor)}</b></span>
        ${resumo.contestadas ? `<span class="resumo-item" style="color:#ef4444">⚠ ${
            resumo.contestadas} contestada(s) — ${formataMoeda(resumo.valorContestado)}</span>` : ''}
      </div>
      <p class="dica">${Object.entries(resumo.porMotivo).filter(([, n]) => n)
          .map(([k, n]) => `${MOTIVOS[k].icone} ${n} ${MOTIVOS[k].rotulo.toLowerCase()}`).join(' · ')
          || 'Nada captado neste mês.'}</p>
      ${valFixos.length ? `<p class="dica">💼 Fixos cobrados sem sessão no mês:
        <b>${formataMoeda(valFixos.reduce((s, f) => s + f.valor, 0))}</b> de repasse
        (${valFixos.length} paciente(s)) — entram no acerto e estão no fim da lista.</p>` : ''}`;

    const visiveis = ordenarValidacao(
        filtrar(valLinhas, valEl('val-filtro').value, valEl('val-busca').value),
        valEl('val-ordem').value);

    // um bloco por paciente: cabeçalho com nome, % do par e subtotal, e a
    // tabela só com as sessões dele — marcar em série fica muito mais fácil
    const grupos = [];
    for (const l of visiveis) {
        const g = grupos[grupos.length - 1];
        if (g && g.paciente.id === l.paciente.id) g.linhas.push(l);
        else grupos.push({ paciente: l.paciente, linhas: [l] });
    }

    const podeFreq = perm.master || perm.pode('sessoes_status');
    const linhaHTML = l => {
        const sit = l.validacao && l.validacao.situacao;
        const m = MOTIVOS[l.motivo];
        const st = l.sessao.status || '??';
        const freqTd = podeFreq
            ? `<select class="argos-input" data-freq-sessao="${l.sessao.id}"
                 style="padding:2px 6px; color:${STATUS_SESSAO[st] ? STATUS_SESSAO[st].cor : 'inherit'}"
                 title="${esc((STATUS_SESSAO[st] || {}).desc || '')} — mudar aqui grava a frequência da sessão">
                 ${Object.keys(STATUS_SESSAO).map(k =>
                    `<option value="${k}"${k === st ? ' selected' : ''}>${STATUS_SESSAO[k].label}</option>`).join('')}
               </select>${l.sessao.justificativa
                 ? `<br><span class="dim">${esc(l.sessao.justificativa)}</span>` : ''}`
            : esc(l.status.toUpperCase());
        return `<tr class="${sit === 'contestada' ? 'linha-alerta' : ''}">
          <td>${formataBR(l.data)} <span class="dim">${esc(l.hora)}</span></td>
          <td title="${esc(m.ajuda)}">${m.icone} ${esc(m.rotulo)}${
            l.motivo !== 'atendeu' ? ` <span class="dim">${esc(l.atendidoPor)}</span>` : ''}</td>
          <td>${freqTd}</td>
          <td>${l.contabiliza ? formataMoeda(l.valor) : '<span class="dim">—</span>'}</td>
          <td class="acoes">
            <button class="argos-btn small ${sit === 'confirmada' ? 'primary' : ''}"
              data-val-sit="confirmada" data-val-id="${l.sessao.id}"
              title="${sit === 'confirmada' ? 'Clique de novo para desfazer a confirmação' : 'Confirmar'}">✔</button>
            <button class="argos-btn small ${sit === 'contestada' ? 'danger' : ''}"
              data-val-sit="contestada" data-val-id="${l.sessao.id}"
              title="${sit === 'contestada' ? 'Clique de novo para desfazer a contestação' : 'Contestar'}">⚠</button>
            ${l.validacao && l.validacao.observacao
                ? `<br><span class="dim">${esc(l.validacao.observacao)}</span>` : ''}
          </td>
        </tr>`;
    };

    // os fixos cobrados sem sessão fecham a lista: não têm o que conferir,
    // mas o repasse deles existe e precisa estar à vista
    const termoBusca = String(valEl('val-busca').value || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const fixosVisiveis = ['todas', 'contabilizadas'].includes(valEl('val-filtro').value)
        ? valFixos.filter(f => !termoBusca || f.paciente.nome.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '').includes(termoBusca))
        : [];
    const blocosFixos = fixosVisiveis.map(f => `
        <div class="imes-bloco" style="--cor:#a78bfa">
          <div class="imes-bloco-topo">
            <b>${esc(f.paciente.nome)}</b>
            <span class="dim">💼 fixo cobrado sem sessão no mês</span>
            ${f.ajustadoPara != null ? `<span class="imes-conta" style="--cor:#eab308"
                title="A cobrança deste mês foi alterada na página de cobrança — o repasse acompanha">
                ⚖️ cobrado ${formataMoeda(f.ajustadoPara)}</span>` : ''}
            ${f.nf > 0.005 ? `<span class="imes-conta" style="--cor:#f97316"
                title="Este mês emite nota fiscal: o repasse incide sobre o total menos os 10% da nota">
                🧾 NF ${formataMoeda(f.nf)}</span>` : ''}
            <span class="imes-conta">repasse ${formataMoeda(f.valor)}</span>
          </div>
        </div>`).join('');

    valEl('val-lista').innerHTML = (grupos.length || fixosVisiveis.length) ? grupos.map(g => {
        const soma = g.linhas.reduce((s, l) => s + (l.contabiliza ? l.valor : 0), 0);
        const contam = g.linhas.filter(l => l.contabiliza).length;
        const pendentes = g.linhas.filter(l => !l.validacao).length;
        return `
        <div class="imes-bloco" style="--cor:#38bdf8">
          <div class="imes-bloco-topo">
            <b>${esc(g.paciente.nome)}</b>
            ${repasseDoParHTML(g.paciente.id)}
            ${g.linhas[0].ajustadoPara != null ? `<span class="imes-conta" style="--cor:#eab308"
                title="A cobrança deste mês foi alterada na página de cobrança — o repasse acompanha o valor cobrado">
                ⚖️ cobrado ${formataMoeda(g.linhas[0].ajustadoPara)}</span>` : ''}
            ${g.linhas[0].nf > 0.005 ? `<span class="imes-conta" style="--cor:#f97316"
                title="Este mês emite nota fiscal: o repasse incide sobre o total menos os 10% da nota">
                🧾 NF ${formataMoeda(g.linhas[0].nf)}</span>` : ''}
            <span class="imes-conta">${contam} de ${g.linhas.length} contabilizam · ${formataMoeda(soma)}</span>
            <span class="imes-bloco-acoes">
              ${pendentes ? `<button class="argos-btn small" data-val-bloco="${g.paciente.id}"
                  title="Confirmar as sessões deste paciente que ainda não foram conferidas">
                  ✔ Confirmar ${pendentes} pendente(s)</button>`
                : '<span class="dim">tudo conferido</span>'}
            </span>
          </div>
          <div class="tabela-rolagem"><table class="argos-tabela compacta imes-tabela">
            <thead><tr>
              <th>Dia</th><th>Por quê</th><th>Freq.</th><th>Vale</th><th>Conferência</th>
            </tr></thead>
            <tbody>${g.linhas.map(linhaHTML).join('')}</tbody>
          </table></div>
        </div>`;
    }).join('') + blocosFixos : '<p class="dim">Nenhuma sessão com esses filtros.</p>';
}

['val-mes', 'val-filtro', 'val-ordem'].forEach(id =>
    valEl(id).addEventListener('change', renderValidacao));
valEl('val-busca').addEventListener('input', renderValidacao);

// mudar a frequência de uma sessão pelo próprio relatório — as mesmas regras
// da agenda: mesma permissão, Fj pede justificativa, e as outras janelas
// abertas ficam sabendo
valEl('val-lista').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-freq-sessao]');
    if (!sel || !valProf) return;
    const linha = valLinhas.find(l => l.sessao.id === sel.dataset.freqSessao);
    if (!linha) return;
    const status = sel.value;
    if (status === (linha.sessao.status || '??')) return;
    if (!perm.pode('sessoes_status')) {
        toast('Sem permissão para marcar frequência.', true);
        renderValidacao();
        return;
    }
    let justificativa = linha.sessao.justificativa || null;
    if (status === 'fj') {
        const dispensa = perm.pode('sessao_fj_sem_justificativa');
        const j = prompt(dispensa
            ? 'Justificativa da falta (pode deixar em branco):'
            : 'Justificativa da falta (obrigatória):', justificativa || '');
        if (j === null) { renderValidacao(); return; } // cancelou
        if (!j.trim() && !dispensa) {
            toast('A falta justificada precisa de uma justificativa.', true);
            renderValidacao();
            return;
        }
        justificativa = j.trim() || null;
    }
    const { erro } = await gravarFrequencia(sb, [linha.sessao], status, justificativa);
    if (erro) {
        console.error(erro);
        toast('Erro ao marcar a sessão.', true);
        renderValidacao();
        return;
    }
    if (status === 'fj') {
        await registrarFaltasJustificadas(sb, [linha.sessao], justificativa, formataBR);
    }
    const s = valSessoes.find(x => x.id === linha.sessao.id);
    if (s) { s.status = status; s.justificativa = justificativa; }
    renderValidacao();
    avisarMudanca({ origem: 'validacao', quantas: 1 });
    toast(`Sessão de ${formataBR(linha.data)} marcada: ${STATUS_SESSAO[status].label}`
        + ` — ${STATUS_SESSAO[status].desc}`);
});

// salvar o repasse padrão sem sair do modal (o aviso de R$ 0,00 traz o campo)
valEl('val-resumo').addEventListener('click', async e => {
    if (e.target.id !== 'btn-val-padrao' || !valProf) return;
    const campo = document.getElementById('val-padrao-pct');
    const v = Number(campo.value);
    if (campo.value === '' || !(v >= 0 && v <= 100)) {
        toast('Informe a % combinada, entre 0 e 100.', true);
        return;
    }
    const { error } = await sb.from('argos_profissionais')
        .update({ repasse_padrao: v }).eq('id', valProf.id);
    if (error) { console.error(error); toast('Não consegui salvar o padrão.', true); return; }
    valProf.repasse_padrao = v;
    const p = profissionais.find(x => x.id === valProf.id);
    if (p) p.repasse_padrao = v;
    definirRepassePadrao(profissionais);
    renderLista();
    renderValidacao();
    toast(`Repasse padrão de ${valProf.nome}: ${v}% — valores recalculados.`);
});

// ---- a % de repasse do par paciente×profissional, editável do próprio modal

/** Dinâmicas deste paciente em que o profissional em conferência tem repasse. */
const dinamicasDoPar = pacId => valDinamicas.filter(d => d.paciente_id === pacId
    && repassesDe(d).some(r => r.profissional_id === valProf.id));

/** O que vale hoje para o par, dito em uma palavra. */
function repasseAtualDoPar(pacId) {
    const rotulos = new Set(dinamicasDoPar(pacId).map(d => {
        const r = repassesDe(d).find(x => x.profissional_id === valProf.id);
        return r.valor == null
            ? (repassePadraoDe(valProf.id) != null
                ? `${pctFmt(repassePadraoDe(valProf.id))}% (padrão)` : 'sem % definida')
            : r.tipo === 'valor' ? formataMoeda(r.valor) : `${pctFmt(Number(r.valor))}%`;
    }));
    if (!rotulos.size) return null;                    // o par não existe em dinâmica
    return rotulos.size === 1 ? [...rotulos][0] : 'varia por dinâmica';
}

function repasseDoParHTML(pacId) {
    const atual = repasseAtualDoPar(pacId);
    if (atual == null) return '';
    const podeEditar = perm.master || perm.pode('dinamica_repasses');
    return `<span class="dim" style="white-space:nowrap">💼 ${esc(atual)}
        ${podeEditar ? `<input type="number" class="argos-input" data-rep-pac="${pacId}"
            min="0" max="100" step="0.01" placeholder="%"
            style="width:70px; padding:2px 6px" title="Nova % deste paciente para ${esc(valProf.nome)}
(vazio = voltar ao padrão do profissional)" />
        <button type="button" class="argos-btn small" data-rep-salvar="${pacId}"
            title="Gravar esta % nas dinâmicas deste paciente">💾</button>` : ''}</span>`;
}

/** Grava a % nas dinâmicas do paciente para este profissional e recalcula. */
async function salvarRepasseDoPar(pacId) {
    const campo = valEl('val-lista').querySelector(`[data-rep-pac="${pacId}"]`);
    if (!campo) return;
    const bruto = campo.value.trim();
    const valor = bruto === '' ? null : Number(bruto);
    if (bruto !== '' && !(valor >= 0 && valor <= 100)) {
        toast('A % fica entre 0 e 100 — ou vazio para voltar ao padrão do profissional.', true);
        return;
    }
    const alvos = dinamicasDoPar(pacId);
    if (!alvos.length) { toast('Este paciente não tem dinâmica com este profissional.', true); return; }

    let feitas = 0;
    const estouradas = [];
    for (const d of alvos) {
        const novos = repassesDe(d).map(r => r.profissional_id === valProf.id
            ? { ...r, tipo: 'percentual', valor } : r);
        // a soma dos repasses da dinâmica continua não podendo passar de 100%
        if (divisaoRepasses({ ...d, repasses: novos }).pctProfs > 100.0001) {
            estouradas.push(d.rotulo || 'dinâmica');
            continue;
        }
        const { error } = await sb.from('argos_dinamicas')
            .update({ repasses: novos }).eq('id', d.id);
        if (error) { console.error(error); toast('Erro ao gravar numa das dinâmicas.', true); return; }
        d.repasses = novos;
        const naPagina = dinamicas.find(x => x.id === d.id);
        if (naPagina) naPagina.repasses = novos;
        feitas++;
    }
    renderValidacao();
    renderLista();
    const nomePac = (valPacientes.find(p => p.id === pacId) || {}).nome || 'paciente';
    if (feitas) {
        toast(valor == null
            ? `${nomePac} voltou ao padrão de ${valProf.nome} em ${feitas} dinâmica(s).`
            : `${pctFmt(valor)}% de ${nomePac} gravado em ${feitas} dinâmica(s) — valores recalculados.`);
    }
    if (estouradas.length) {
        toast(`⛔ Não gravei em ${estouradas.join(', ')}: a soma dos repasses passaria de 100%.`, true);
    }
}

/** Grava a conferência de uma ou muitas sessões, num upsert só. */
async function gravarValidacao(itens) {
    if (!itens.length) return false;
    const { error } = await sb.from('argos_sessao_validacao')
        .upsert(itens.map(i => ({
            sessao_id: i.sessao_id, profissional_id: valProf.id,
            situacao: i.situacao, observacao: i.observacao || null,
            quem: sessionStorage.getItem('usuario') || null,
            atualizado_em: new Date().toISOString()
        })), { onConflict: 'sessao_id,profissional_id' });
    if (error) { console.error(error); toast('Erro ao gravar a conferência.', true); return false; }
    const { data } = await todas(() => sb.from('argos_sessao_validacao')
        .select('*').eq('profissional_id', valProf.id));
    valValidacoes = data || valValidacoes;
    renderValidacao();
    return true;
}

valEl('val-lista').addEventListener('click', async (e) => {
    const salvarRep = e.target.closest('[data-rep-salvar]');
    if (salvarRep && valProf) { await salvarRepasseDoPar(salvarRep.dataset.repSalvar); return; }
    // confirmar de uma vez as pendentes de um paciente só
    const bloco = e.target.closest('[data-val-bloco]');
    if (bloco && valProf) {
        const pend = valLinhas.filter(l =>
            l.paciente.id === bloco.dataset.valBloco && !l.validacao);
        if (!pend.length) return;
        if (await gravarValidacao(pend.map(l =>
            ({ sessao_id: l.sessao.id, situacao: 'confirmada' })))) {
            toast(`${pend.length} sessão(ões) confirmada(s).`);
        }
        return;
    }
    const btn = e.target.closest('[data-val-sit]');
    if (!btn || !valProf) return;
    const situacao = btn.dataset.valSit;
    const linha = valLinhas.find(l => l.sessao.id === btn.dataset.valId);
    if (!linha) return;
    // clicar de novo no que já está marcado desfaz a conferência
    if (linha.validacao && linha.validacao.situacao === situacao) {
        const { error } = await sb.from('argos_sessao_validacao').delete()
            .eq('sessao_id', linha.sessao.id).eq('profissional_id', valProf.id);
        if (error) { console.error(error); toast('Erro ao desfazer a conferência.', true); return; }
        valValidacoes = valValidacoes.filter(v =>
            !(v.sessao_id === linha.sessao.id && v.profissional_id === valProf.id));
        renderValidacao();
        toast('Conferência desfeita — a sessão volta a «sem conferir».');
        return;
    }
    // contestar sem dizer o motivo não ajuda ninguém a resolver depois
    let observacao = linha.validacao ? linha.validacao.observacao : '';
    if (situacao === 'contestada') {
        const dito = prompt(`O que está errado nesta sessão de ${linha.paciente.nome} `
            + `em ${formataBR(linha.data)}?`, observacao || '');
        if (dito === null) return;
        observacao = dito.trim();
    } else observacao = '';
    if (await gravarValidacao([{ sessao_id: linha.sessao.id, situacao, observacao }])) {
        toast(situacao === 'confirmada' ? 'Sessão confirmada.' : 'Sessão contestada.');
    }
});

valEl('btn-val-confirmar-todas').addEventListener('click', async () => {
    const pendentes = filtrar(valLinhas, 'pendentes');
    if (!pendentes.length) { toast('Nada pendente para confirmar.'); return; }
    if (!confirm(`Confirmar ${pendentes.length} sessão(ões) que ainda não foram conferidas?\n\n`
        + 'As já contestadas não são tocadas.')) return;
    if (await gravarValidacao(pendentes.map(l =>
        ({ sessao_id: l.sessao.id, situacao: 'confirmada' })))) {
        toast(`${pendentes.length} sessão(ões) confirmada(s).`);
    }
});

valEl('btn-val-copiar').addEventListener('click', async () => {
    if (!valProf) return;
    const texto = textoDoRelatorio({
        profissional: valProf.nome, mes: valEl('val-mes').value,
        linhas: ordenarValidacao(
            filtrar(valLinhas, valEl('val-filtro').value, valEl('val-busca').value),
            valEl('val-ordem').value),
        resumo: resumoDaValidacao(valLinhas), formataBR, formataMoeda
    });
    try {
        await navigator.clipboard.writeText(texto);
        toast('Relatório copiado — é só colar onde quiser.');
    } catch (e) {
        // sem permissão de área de transferência: mostra para copiar à mão
        window.prompt('Copie o relatório:', texto);
    }
});

valEl('btn-val-imprimir').addEventListener('click', () => window.print());
