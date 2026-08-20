// pacientes.js — Card "Pacientes" da área Argos
// Cadastro e informações, anamnese, dinâmicas financeiras, sessões avulsas,
// espaços de atendimento e exclusão com opções de histórico.

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    DOW_NOMES, PACOTE_MODOS, STATUS_SESSAO, acordoLabel, mesclarSessoes,
    fechamentoPaciente, hojeISO, somarDias, formataBR, formataMoeda
} from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };

let pacientes = [], salas = [], profissionais = [], servicos = [], profServ = [], dinamicas = [];
let pacienteAtual = null;    // paciente aberto no modal de dinâmicas/exclusão
let editandoPacienteId = null;
let editandoDinamicaId = null;

// ============================================================
// CARGA
// ============================================================
async function carregarTudo() {
    const [rPac, rSalas, rProf, rServ, rPS, rDin] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_salas').select('*').order('nome'),
        sb.from('argos_profissionais').select('*').order('nome'),
        sb.from('argos_servicos_base').select('*').order('nome'),
        sb.from('argos_profissional_servicos').select('*'),
        sb.from('argos_dinamicas').select('*').order('created_at')
    ]);
    const erro = rPac.error || rSalas.error || rProf.error || rServ.error || rPS.error || rDin.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    pacientes = rPac.data || [];
    salas = rSalas.data || [];
    profissionais = rProf.data || [];
    servicos = rServ.data || [];
    profServ = rPS.data || [];
    dinamicas = rDin.data || [];
    renderLista();
}

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

    document.getElementById('lista-pacientes').innerHTML = lista.map(p => {
        const dins = dinamicas.filter(d => d.paciente_id === p.id && d.ativo !== false);
        return `
        <div class="argos-minicard ${p.ativo && !p.cadastro_removido ? '' : 'inativo'}">
          <div class="mini-topo">
            <div class="mini-nome">${esc(p.nome)}</div>
            ${p.cadastro_removido ? '<span class="badge vermelho">Cadastro removido</span>'
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
    if (btn.dataset.acao === 'excluir') { pacienteAtual = p; document.getElementById('modal-excluir-titulo').textContent = `Excluir: ${p.nome}`; abrirModal('modal-excluir'); }
});

// ============================================================
// CADASTRO DO PACIENTE
// ============================================================
document.getElementById('btn-novo-paciente').addEventListener('click', () => abrirModalPaciente(null));

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
    v('pac-indicacao', p && p.indicacao);
    v('pac-observacoes', p && p.observacoes);
    v('pac-anamnese-data', p && p.anamnese_data); v('pac-anamnese-valor', p && p.anamnese_valor);
    document.getElementById('pac-anamnese-cobrar').checked = p ? !!p.anamnese_cobrar : false;
    document.getElementById('pac-ativo').checked = p ? !!p.ativo : true;
    abrirModal('modal-paciente');
}

document.getElementById('form-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = id => document.getElementById(id).value.trim() || null;
    const registro = {
        nome: g('pac-nome'), nascimento: g('pac-nascimento'), cpf: g('pac-cpf'),
        colegio: g('pac-colegio'), serie: g('pac-serie'), turno: g('pac-turno'),
        mae_nome: g('pac-mae-nome'), mae_profissao: g('pac-mae-profissao'),
        mae_fone: g('pac-mae-fone'), mae_cpf: g('pac-mae-cpf'),
        pai_nome: g('pac-pai-nome'), pai_profissao: g('pac-pai-profissao'),
        pai_fone: g('pac-pai-fone'), pai_cpf: g('pac-pai-cpf'),
        email: g('pac-email'), endereco: g('pac-endereco'),
        responsavel_financeiro: g('pac-resp-financeiro'),
        indicacao: g('pac-indicacao'),
        observacoes: g('pac-observacoes'),
        anamnese_data: g('pac-anamnese-data'),
        anamnese_valor: g('pac-anamnese-valor'),
        anamnese_cobrar: document.getElementById('pac-anamnese-cobrar').checked,
        ativo: document.getElementById('pac-ativo').checked
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

function abrirModalDinamicas(p) {
    pacienteAtual = p;
    document.getElementById('modal-dinamicas-titulo').textContent = `Dinâmicas de ${p.nome}`;
    renderDinamicas();
    abrirModal('modal-dinamicas');
}

async function renderDinamicas() {
    const p = pacienteAtual;
    const dins = dinamicas.filter(d => d.paciente_id === p.id);
    // sessões avulsas futuras (sem dinâmica)
    const { data: avulsas } = await sb.from('argos_sessoes').select('*')
        .eq('paciente_id', p.id).is('dinamica_ref', null).gte('data', hojeISO()).order('data');

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
                ${d.recorrencia_tipo === 'avulsa' ? '🗓️ Sessões avulsas (marcadas uma a uma)' : `🗓️ ${r.dias || '—'} — ${r.freq}, a partir de ${formataBR(d.data_inicio)}, ${r.fim}`}<br>
                ${d.modalidade === 'grupo' ? '👥 Em grupo' : '👤 Individual'} · 🚪 ${esc(nomeSala(d.sala_id))} · 🧑‍⚕️ ${esc(nomeProf(d.profissional_id))} (${esc(nomeServ(d.servico_id))})<br>
                💰 ${esc(acordoLabel(d))}${d.acordo_tipo === 'pacote' && d.pacote_pagamento ? ` — ${esc(PACOTE_MODOS[d.pacote_pagamento.modo] || '')}` : ''}
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
              <div class="bloco-info">🗓️ ${formataBR(s.data)} ${s.hora} · 🚪 ${esc(nomeSala(s.sala_id))} · 🧑‍⚕️ ${esc(nomeProf(s.profissional_id))}${s.valor != null ? ' · ' + formataMoeda(s.valor) : ''}</div>
              <div class="mini-acoes"><button class="argos-btn small danger" data-avulsa-del="${s.id}">🗑️ Remover</button></div>
            </div>`).join('')}` : '');
}

document.getElementById('lista-dinamicas').addEventListener('click', async (e) => {
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
      <input type="number" step="0.01" min="0" class="par-valor" placeholder="R$" value="${p && p.valor || ''}" />
      <button type="button" class="argos-btn small danger dia-remover">×</button>`;
    el.querySelector('.dia-remover').addEventListener('click', () => el.remove());
    return el;
}
document.getElementById('btn-add-parcela').addEventListener('click', () =>
    document.getElementById('lista-parcelas').appendChild(linhaParcela()));

function atualizarCondicionais() {
    const tipo = document.getElementById('din-tipo').value;
    document.getElementById('bloco-recorrencia').style.display = tipo === 'avulsa' ? 'none' : '';
    const periodo = document.getElementById('din-freq-periodo').value;
    document.querySelectorAll('#lista-dias .dia-dow').forEach(s => s.style.display = periodo === 'dia' ? 'none' : '');
    const fim = document.getElementById('din-fim-tipo').value;
    document.getElementById('rotulo-fim-ocorr').style.display = fim === 'apos_ocorrencias' ? '' : 'none';
    document.getElementById('rotulo-fim-data').style.display = fim === 'data' ? '' : 'none';
    const acordo = document.getElementById('din-acordo').value;
    document.getElementById('rotulo-valor').style.display = acordo === 'pacote' ? 'none' : '';
    document.getElementById('rotulo-valor').firstChild.textContent =
        acordo === 'fixo_mensal' ? 'Valor fixo mensal (R$)' : 'Valor por sessão (R$)';
    document.getElementById('bloco-pacote').style.display = acordo === 'pacote' ? '' : 'none';
    const modo = document.getElementById('din-pacote-modo').value;
    document.getElementById('pp-valor-inicio').style.display = modo === 'inicio_final' ? '' : 'none';
    document.getElementById('pp-x').style.display = modo === 'a_cada_x' ? '' : 'none';
    document.getElementById('pp-entrada').style.display = modo === 'entrada_parcelas' ? '' : 'none';
    document.getElementById('pp-nparcelas').style.display = modo === 'entrada_parcelas' ? '' : 'none';
    document.getElementById('pp-parcelas').style.display = modo === 'parcelas_datas' ? '' : 'none';
}
['din-tipo', 'din-freq-periodo', 'din-fim-tipo', 'din-acordo', 'din-pacote-modo'].forEach(id =>
    document.getElementById(id).addEventListener('change', atualizarCondicionais));

document.getElementById('din-profissional').addEventListener('change', () =>
    selectServicosDoProf(document.getElementById('din-servico'), document.getElementById('din-profissional').value, null));

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
    selectSalas(document.getElementById('din-sala'), d && d.sala_id);
    selectProfissionais(document.getElementById('din-profissional'), d && d.profissional_id);
    selectServicosDoProf(document.getElementById('din-servico'), d && d.profissional_id, d && d.servico_id);
    v('din-acordo', d ? d.acordo_tipo : 'por_sessao');
    v('din-valor', d && d.valor);
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

    if (tipo === 'recorrente') {
        if (!g('din-inicio')) { toast('Informe a data de início.', true); return; }
        if (!dias.length) { toast('Adicione pelo menos um dia/horário.', true); return; }
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
        profissional_id: g('din-profissional') || null,
        servico_id: g('din-servico') || null,
        acordo_tipo: acordo,
        valor: acordo === 'pacote' ? null : num('din-valor'),
        pacote_qtd: acordo === 'pacote' ? num('din-pacote-qtd') : null,
        pacote_valor: acordo === 'pacote' ? num('din-pacote-valor') : null,
        pacote_pagamento: acordo === 'pacote' ? pg : null,
        ativo: document.getElementById('din-ativo').checked
    };
    const q = editandoDinamicaId
        ? sb.from('argos_dinamicas').update(registro).eq('id', editandoDinamicaId)
        : sb.from('argos_dinamicas').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar dinâmica.', true); return; }
    fecharModal('modal-dinamica-form');
    toast('Dinâmica salva.');
    await carregarTudo();
    renderDinamicas();
});

// ============================================================
// SESSÃO AVULSA
// ============================================================
document.getElementById('btn-nova-avulsa').addEventListener('click', () => {
    selectSalas(document.getElementById('avu-sala'), null);
    selectProfissionais(document.getElementById('avu-profissional'), null);
    selectServicosDoProf(document.getElementById('avu-servico'), null, null);
    abrirModal('modal-avulsa');
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
        status: '??'
    };
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
    const { data: sess } = await sb.from('argos_sessoes').select('*').eq('paciente_id', pacId);
    const inicio = dins.map(d => d.data_inicio).filter(Boolean).sort()[0];
    if (!inicio) return sess || [];
    const todas = mesclarSessoes(dins, sess || [], inicio, hojeISO());
    const novas = todas.filter(s => s.projetada).map(s => ({
        paciente_id: pacId, dinamica_id: s.dinamica_ref, dinamica_ref: s.dinamica_ref,
        data: s.data, hora: s.hora, duracao_min: s.duracao_min,
        sala_id: s.sala_id || null, profissional_id: s.profissional_id || null,
        servico_id: s.servico_id || null, status: '??'
    }));
    if (novas.length) {
        const { error } = await sb.from('argos_sessoes').insert(novas);
        if (error) console.error(error);
    }
    return todas;
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
      <p>Gerado em ${formataBR(hojeISO())}. Legenda: Ok presente (cobra) · Fj falta não cobrável · Fc falta cobrável · Nc não houve · ?? pendente.</p>
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
    await carregarTudo();
})();
