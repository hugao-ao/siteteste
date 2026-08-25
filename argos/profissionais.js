// profissionais.js — Card "Profissionais" da área Argos
// CRUD de profissionais (nome) e dos serviços que cada um presta.
// A base de serviços é única (sem homônimos, ignorando maiúsculas/minúsculas)
// e serviços não podem ser excluídos da base por esta tela.

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { repassesDe, fracaoRepasse } from './argos-recorrencia.js';

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
    renderLista();
}

function formataMoeda(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const pctFmt = x => (Math.round(x * 100) / 100).toLocaleString('pt-BR');

// pacientes ligados ao profissional (responsável e/ou recebe repasse),
// lidos da lista de repasses das dinâmicas ativas — a fonte única
function pacientesDoProfissional(profId) {
    const porPaciente = new Map();
    dinamicas.filter(d => d.ativo !== false).forEach(d => {
        const meusRep = repassesDe(d).filter(r => r.profissional_id === profId);
        if (!meusRep.length) return;
        const p = pacientes.find(x => x.id === d.paciente_id);
        if (!p || p.cadastro_removido) return;
        const atual = porPaciente.get(p.id) || { nome: p.nome, rotulos: [] };
        meusRep.forEach(r => atual.rotulos.push(!(Number(r.valor) > 0) ? 'sem repasse'
            : r.tipo === 'valor'
                ? `${formataMoeda(r.valor)} (${pctFmt(fracaoRepasse(d, r) * 100)}%)`
                : `${pctFmt(Number(r.valor))}%`));
        porPaciente.set(p.id, atual);
    });
    return [...porPaciente.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

function renderLista() {
    const busca = normalizar(document.getElementById('busca').value);
    const podeGerenciar = perm.pode('profissionais_gerenciar');
    const podeServicos = perm.pode('profissional_servicos_gerenciar');
    const lista = profissionais.filter(p => !busca || normalizar(p.nome).includes(busca));

    document.getElementById('lista-profissionais').innerHTML = lista.map(p => {
        const meus = vinculos.filter(v => v.profissional_id === p.id)
            .map(v => servicos.find(s => s.id === v.servico_id)).filter(Boolean)
            .sort((a, b) => a.nome.localeCompare(b.nome));
        const meusPacientes = pacientesDoProfissional(p.id);
        const remun = REMUNERACAO_LABELS[p.remuneracao_tipo || 'producao'];
        const fixoTxt = (p.remuneracao_tipo === 'fixo' || p.remuneracao_tipo === 'producao_fixo') && p.valor_fixo_mensal != null
            ? ` — ${formataMoeda(p.valor_fixo_mensal)}/mês` : '';
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
          ${meusPacientes.length ? `
          <div class="mini-info">
            <b>Pacientes e repasses:</b><br>
            ${meusPacientes.map(mp =>
                `${esc(mp.nome)} — <b>${esc(mp.rotulos.join(' / '))}</b>`
            ).join('<br>')}
          </div>` : ''}
          <div class="chips-servicos">
            ${meus.map(s => `<span class="chip-servico">${esc(s.nome)}${podeServicos ? `<button data-acao="desvincular" data-id="${p.id}" data-servico="${s.id}" title="Remover este serviço do profissional">×</button>` : ''}</span>`).join('')
              || '<span class="dim">Nenhum serviço vinculado.</span>'}
          </div>
          <div class="mini-acoes">
            ${podeServicos ? `<button class="argos-btn small primary" data-acao="servicos" data-id="${p.id}">+ Serviço</button>` : ''}
            ${perm.pode('agenda_ver') ? `<a class="argos-btn small" href="agenda.html?profissional=${p.id}">🗓️ Agenda</a>` : ''}
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
}
document.getElementById('prof-remuneracao').addEventListener('change', atualizarCampoFixo);

document.getElementById('btn-novo-prof').addEventListener('click', () => {
    editandoProfId = null;
    document.getElementById('modal-prof-titulo').textContent = 'Novo profissional';
    document.getElementById('prof-nome').value = '';
    document.getElementById('prof-remuneracao').value = 'producao';
    document.getElementById('prof-fixo').value = '';
    atualizarCampoFixo();
    abrirModal('modal-prof');
});

document.getElementById('form-prof').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('prof-nome').value.trim();
    if (!nome) return;
    const remuneracao_tipo = document.getElementById('prof-remuneracao').value;
    const fixoBruto = document.getElementById('prof-fixo').value;
    const registro = {
        nome, remuneracao_tipo,
        valor_fixo_mensal: (remuneracao_tipo === 'fixo' || remuneracao_tipo === 'producao_fixo') && fixoBruto !== ''
            ? Number(fixoBruto) : null
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
