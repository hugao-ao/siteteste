// clientes.js — Página CLIENTES (mesma base usada pelas visitas)
import { sb, toast, esc } from './hermo-common.js';
import { abrirModalCliente } from './hermo-cliente-modal.js';

let clientes = [];
const $ = id => document.getElementById(id);

async function carregar() {
    const { data, error } = await sb.from('hermo_clientes')
        .select('*, indicador:indicado_por_cliente_id(nome)')
        .order('nome');
    if (error) { toast('Erro ao carregar clientes: ' + error.message, true); return; }
    clientes = data || [];
    renderResumo();
    render();
}

function renderResumo() {
    const pf = clientes.filter(c => c.tipo_pessoa === 'PF').length;
    const pj = clientes.filter(c => c.tipo_pessoa === 'PJ').length;
    const indicados = clientes.filter(c => c.indicado_por_cliente_id || c.indicado_por_nome).length;
    $('resumo').innerHTML = `
        <div class="stat"><div class="num">${clientes.length}</div><div class="lbl">Total</div></div>
        <div class="stat s-marcada"><div class="num">${pf}</div><div class="lbl">Pessoa Física</div></div>
        <div class="stat s-concluida"><div class="num">${pj}</div><div class="lbl">Pessoa Jurídica</div></div>
        <div class="stat s-pendencias"><div class="num">${indicados}</div><div class="lbl">Vieram por indicação</div></div>`;
}

function filtrados() {
    const q = $('busca').value.trim().toLowerCase();
    if (!q) return clientes;
    // busca por dígitos ignora máscara (documento e whatsapp são salvos formatados)
    const qDigitos = q.replace(/\D/g, '');
    return clientes.filter(c =>
        (c.nome || '').toLowerCase().includes(q) ||
        (c.whatsapp || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.cpf_cnpj || '').toLowerCase().includes(q) ||
        (qDigitos && (
            (c.cpf_cnpj || '').replace(/\D/g, '').includes(qDigitos) ||
            (c.whatsapp || '').replace(/\D/g, '').includes(qDigitos)
        )));
}

/** O que ainda falta no cadastro para o contrato sair com as partes qualificadas. */
function faltaParaContrato(c) {
    const falta = [];
    if (!c.cpf_cnpj) falta.push('CPF/CNPJ');
    if (!c.endereco) falta.push('endereço');
    if (!c.cep) falta.push('CEP');
    // pessoa física assina por si; PJ precisa de quem assine
    if (c.tipo_pessoa !== 'PF' && !c.representante) falta.push('representante');
    return falta;
}

function render() {
    const lista = filtrados();
    $('vazio').style.display = lista.length ? 'none' : '';
    $('corpo').innerHTML = lista.map(c => `
        <tr>
            <td><b>${esc(c.nome)}</b></td>
            <td>${esc(c.whatsapp)}</td>
            <td>${esc(c.email || '—')}</td>
            <td>${c.cpf_cnpj ? `${c.tipo_pessoa || ''} ${esc(c.cpf_cnpj)}` : '—'}</td>
            <td>${faltaParaContrato(c).length
                ? `<span class="cli-falta" title="Falta para gerar contrato: ${esc(faltaParaContrato(c).join(', '))}">⚠ ${faltaParaContrato(c).length} campo(s)</span>`
                : '<span class="cli-ok" title="Dados completos para gerar contrato">✓ completo</span>'}</td>
            <td>${esc(c.indicador?.nome || c.indicado_por_nome || '—')}</td>
            <td>
                <button class="hermo-btn small ghost" data-editar="${c.id}">✎</button>
                <button class="hermo-btn small danger" data-excluir="${c.id}">🗑</button>
            </td>
        </tr>`).join('');

    document.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => {
        const c = clientes.find(x => x.id === b.dataset.editar);
        abrirModalCliente(c, carregar);
    }));
    document.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', () => excluir(b.dataset.excluir)));
}

async function excluir(id) {
    const c = clientes.find(x => x.id === id);
    if (!confirm(`Excluir o cliente "${c?.nome}"?\nVisitas associadas a ele NÃO serão excluídas — apenas ficarão sem cliente.`)) return;
    const { error } = await sb.from('hermo_clientes').delete().eq('id', id);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast('Cliente excluído.');
    carregar();
}

$('btn-novo').addEventListener('click', () => abrirModalCliente(null, carregar));
$('busca').addEventListener('input', render);
carregar();
