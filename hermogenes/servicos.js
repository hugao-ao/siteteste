// servicos.js — Página SERVIÇOS (catálogo usado pelas visitas e demais módulos)
import { sb, toast, ligarFecharPorBackdrop, esc } from './hermo-common.js';

let servicos = [];
let editando = null;
const $ = id => document.getElementById(id);

async function carregar() {
    const { data, error } = await sb.from('hermo_servicos').select('*').order('codigo');
    if (error) { toast('Erro ao carregar serviços: ' + error.message, true); return; }
    servicos = data || [];
    renderResumo();
    render();
}

function renderResumo() {
    const comUnidade = servicos.filter(s => s.unidade).length;
    $('resumo').innerHTML = `
        <div class="stat"><div class="num">${servicos.length}</div><div class="lbl">Serviços no catálogo</div></div>
        <div class="stat s-marcada"><div class="num">${comUnidade}</div><div class="lbl">Com unidade padrão</div></div>`;
}

function filtrados() {
    const q = $('busca').value.trim().toLowerCase();
    if (!q) return servicos;
    return servicos.filter(s =>
        (s.codigo || '').toLowerCase().includes(q) ||
        (s.descricao || '').toLowerCase().includes(q) ||
        (s.detalhe || '').toLowerCase().includes(q));
}

function render() {
    const lista = filtrados();
    $('vazio').style.display = lista.length ? 'none' : '';
    $('corpo').innerHTML = lista.map(s => `
        <tr>
            <td><b>${esc(s.codigo)}</b></td>
            <td>${esc(s.descricao)}</td>
            <td>${esc(s.detalhe || '—')}</td>
            <td>${esc(s.unidade || '—')}</td>
            <td>
                <button class="hermo-btn small ghost" data-editar="${s.id}">✎</button>
                <button class="hermo-btn small danger" data-excluir="${s.id}">🗑</button>
            </td>
        </tr>`).join('');

    document.querySelectorAll('[data-editar]').forEach(b =>
        b.addEventListener('click', () => abrirModal(servicos.find(x => x.id === b.dataset.editar))));
    document.querySelectorAll('[data-excluir]').forEach(b =>
        b.addEventListener('click', () => excluir(b.dataset.excluir)));
}

function abrirModal(servico) {
    editando = servico || null;
    $('msv-titulo').textContent = servico ? 'Editar serviço' : 'Novo serviço';
    $('msv-codigo').value = servico?.codigo || '';
    $('msv-descricao').value = servico?.descricao || '';
    $('msv-detalhe').value = servico?.detalhe || '';
    $('msv-unidade').value = servico?.unidade || '';
    $('msv-overlay').classList.add('aberto');
    $('msv-codigo').focus();
}

function fecharModal() {
    $('msv-overlay').classList.remove('aberto');
    editando = null;
}

async function salvar() {
    const codigo = $('msv-codigo').value.trim();
    const descricao = $('msv-descricao').value.trim();
    if (!codigo) { toast('Código é obrigatório.', true); return; }
    if (!descricao) { toast('Descrição é obrigatória.', true); return; }
    const registro = {
        codigo,
        descricao,
        detalhe: $('msv-detalhe').value.trim() || null,
        unidade: $('msv-unidade').value.trim() || null
    };
    const btn = $('msv-salvar');
    btn.disabled = true;
    try {
        let res;
        if (editando) {
            res = await sb.from('hermo_servicos').update(registro).eq('id', editando.id);
        } else {
            res = await sb.from('hermo_servicos').insert(registro);
        }
        if (res.error) throw res.error;
        toast(editando ? 'Serviço atualizado.' : 'Serviço criado.');
        fecharModal();
        carregar();
    } catch (e) {
        if ((e.code || '') === '23505') toast('Já existe um serviço com esse código.', true);
        else toast('Erro ao salvar: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

async function excluir(id) {
    const s = servicos.find(x => x.id === id);
    if (!confirm(`Excluir o serviço "${s?.codigo} — ${s?.descricao}"?`)) return;
    const { error } = await sb.from('hermo_servicos').delete().eq('id', id);
    if (error) {
        if ((error.code || '') === '23503') {
            toast('Este serviço está vinculado a visitas e não pode ser excluído.', true);
        } else {
            toast('Erro ao excluir: ' + error.message, true);
        }
        return;
    }
    toast('Serviço excluído.');
    carregar();
}

$('btn-novo').addEventListener('click', () => abrirModal(null));
$('busca').addEventListener('input', render);
$('msv-fechar').addEventListener('click', fecharModal);
$('msv-cancelar').addEventListener('click', fecharModal);
ligarFecharPorBackdrop($('msv-overlay'), fecharModal);
$('msv-salvar').addEventListener('click', salvar);
carregar();
