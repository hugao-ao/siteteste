// hermo-cliente-modal.js — Modal REUTILIZÁVEL de adição/edição de cliente.
// Usado pela página CLIENTES e pelo modal de VISITAS (mesma base, zero retrabalho).

import { sb, toast, ligarMascaraDocumento, ligarFecharPorBackdrop, esc } from './hermo-common.js';

let overlay = null;
let onSalvoCallback = null;
let clienteEditando = null; // objeto cliente ou null (novo)

function html() {
    return `
    <div class="hermo-modal compacto">
        <div class="hermo-modal-head">
            <h2 id="hcm-titulo">Novo cliente</h2>
            <button class="fechar" id="hcm-fechar" title="Fechar">&times;</button>
        </div>
        <div class="hermo-modal-body">
            <div class="hermo-field">
                <label>Nome <span class="req">*</span></label>
                <input id="hcm-nome" type="text" placeholder="Nome completo" />
            </div>
            <div class="hermo-form-row">
                <div class="hermo-field">
                    <label>WhatsApp <span class="req">*</span></label>
                    <input id="hcm-whatsapp" type="text" placeholder="(81) 9XXXX-XXXX" />
                </div>
                <div class="hermo-field">
                    <label>E-mail</label>
                    <input id="hcm-email" type="email" placeholder="opcional" />
                </div>
            </div>
            <div class="hermo-form-row">
                <div class="hermo-field">
                    <label>Tipo de pessoa</label>
                    <select id="hcm-tipo">
                        <option value="">— não informar —</option>
                        <option value="PF">PF (CPF)</option>
                        <option value="PJ">PJ (CNPJ)</option>
                    </select>
                </div>
                <div class="hermo-field">
                    <label id="hcm-doc-label">CPF / CNPJ</label>
                    <input id="hcm-doc" type="text" inputmode="numeric" placeholder="apenas números" disabled />
                </div>
            </div>
            <div class="hermo-field">
                <label>Indicado por</label>
                <select id="hcm-indicado-sel">
                    <option value="">— ninguém / não sei —</option>
                    <option value="__outro__">Outra pessoa (fora da lista)…</option>
                </select>
            </div>
            <div class="hermo-field" id="hcm-indicado-outro-wrap" style="display:none">
                <label>Nome de quem indicou</label>
                <input id="hcm-indicado-outro" type="text" placeholder="Nome" />
            </div>
        </div>
        <div class="hermo-modal-foot">
            <button class="hermo-btn ghost" id="hcm-cancelar">Cancelar</button>
            <button class="hermo-btn primary" id="hcm-salvar">Salvar cliente</button>
        </div>
    </div>`;
}

function garantirDOM() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'hermo-modal-overlay';
    overlay.id = 'hcm-overlay';
    overlay.innerHTML = html();
    document.body.appendChild(overlay);

    const tipoSel = overlay.querySelector('#hcm-tipo');
    const doc = overlay.querySelector('#hcm-doc');

    tipoSel.addEventListener('change', () => {
        const t = tipoSel.value;
        doc.disabled = !t;
        doc.value = '';
        overlay.querySelector('#hcm-doc-label').textContent =
            t === 'PJ' ? 'CNPJ' : t === 'PF' ? 'CPF' : 'CPF / CNPJ';
        doc.placeholder = t === 'PJ' ? 'xx.xxx.xxx/xxxx-xx' : t === 'PF' ? 'xxx.xxx.xxx-xx' : 'apenas números';
    });
    ligarMascaraDocumento(doc, () => tipoSel.value);

    overlay.querySelector('#hcm-indicado-sel').addEventListener('change', e => {
        overlay.querySelector('#hcm-indicado-outro-wrap').style.display =
            e.target.value === '__outro__' ? '' : 'none';
    });

    overlay.querySelector('#hcm-fechar').addEventListener('click', fechar);
    overlay.querySelector('#hcm-cancelar').addEventListener('click', fechar);
    ligarFecharPorBackdrop(overlay, fechar);
    overlay.querySelector('#hcm-salvar').addEventListener('click', salvar);
}

async function carregarListaIndicacao(excluirId) {
    const sel = overlay.querySelector('#hcm-indicado-sel');
    // limpa opções dinâmicas
    [...sel.querySelectorAll('option[data-dyn]')].forEach(o => o.remove());
    const { data, error } = await sb.from('hermo_clientes').select('id, nome').order('nome');
    if (error) { toast('Erro ao carregar clientes: ' + error.message, true); return; }
    const outroOpt = sel.querySelector('option[value="__outro__"]');
    (data || []).filter(c => c.id !== excluirId).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.nome;
        o.dataset.dyn = '1';
        sel.insertBefore(o, outroOpt);
    });
}

/**
 * Abre o modal de cliente.
 * @param {object|null} cliente — objeto para edição, ou null para novo
 * @param {function} onSalvo — callback(clienteSalvo) após persistir
 */
export async function abrirModalCliente(cliente, onSalvo) {
    garantirDOM();
    clienteEditando = cliente || null;
    onSalvoCallback = onSalvo || null;

    overlay.querySelector('#hcm-titulo').textContent = cliente ? 'Editar cliente' : 'Novo cliente';
    overlay.querySelector('#hcm-nome').value = cliente?.nome || '';
    overlay.querySelector('#hcm-whatsapp').value = cliente?.whatsapp || '';
    overlay.querySelector('#hcm-email').value = cliente?.email || '';

    const tipoSel = overlay.querySelector('#hcm-tipo');
    tipoSel.value = cliente?.tipo_pessoa || '';
    tipoSel.dispatchEvent(new Event('change'));
    if (cliente?.cpf_cnpj) overlay.querySelector('#hcm-doc').value = cliente.cpf_cnpj;

    await carregarListaIndicacao(cliente?.id);

    const sel = overlay.querySelector('#hcm-indicado-sel');
    const outroWrap = overlay.querySelector('#hcm-indicado-outro-wrap');
    const outroInput = overlay.querySelector('#hcm-indicado-outro');
    outroInput.value = '';
    if (cliente?.indicado_por_cliente_id) {
        sel.value = cliente.indicado_por_cliente_id;
        outroWrap.style.display = 'none';
    } else if (cliente?.indicado_por_nome) {
        sel.value = '__outro__';
        outroWrap.style.display = '';
        outroInput.value = cliente.indicado_por_nome;
    } else {
        sel.value = '';
        outroWrap.style.display = 'none';
    }

    overlay.classList.add('aberto');
    overlay.querySelector('#hcm-nome').focus();
}

function fechar() {
    overlay.classList.remove('aberto');
    clienteEditando = null;
    onSalvoCallback = null;
}

async function salvar() {
    const nome = overlay.querySelector('#hcm-nome').value.trim();
    const whatsapp = overlay.querySelector('#hcm-whatsapp').value.trim();
    if (!nome) { toast('Nome é obrigatório.', true); return; }
    if (!whatsapp) { toast('WhatsApp é obrigatório.', true); return; }

    const tipo = overlay.querySelector('#hcm-tipo').value || null;
    const docBruto = overlay.querySelector('#hcm-doc').value.replace(/\D/g, '');
    if (tipo === 'PF' && docBruto && docBruto.length !== 11) { toast('CPF deve ter 11 dígitos.', true); return; }
    if (tipo === 'PJ' && docBruto && docBruto.length !== 14) { toast('CNPJ deve ter 14 dígitos.', true); return; }

    const sel = overlay.querySelector('#hcm-indicado-sel').value;
    const registro = {
        nome,
        whatsapp,
        email: overlay.querySelector('#hcm-email').value.trim() || null,
        tipo_pessoa: tipo,
        cpf_cnpj: docBruto ? overlay.querySelector('#hcm-doc').value : null,
        indicado_por_cliente_id: (sel && sel !== '__outro__') ? sel : null,
        indicado_por_nome: sel === '__outro__'
            ? (overlay.querySelector('#hcm-indicado-outro').value.trim() || null)
            : null
    };

    const btn = overlay.querySelector('#hcm-salvar');
    btn.disabled = true;
    try {
        let res;
        if (clienteEditando) {
            res = await sb.from('hermo_clientes').update(registro)
                .eq('id', clienteEditando.id).select().single();
        } else {
            res = await sb.from('hermo_clientes').insert(registro).select().single();
        }
        if (res.error) throw res.error;
        toast(clienteEditando ? 'Cliente atualizado.' : 'Cliente adicionado.');
        const cb = onSalvoCallback;
        fechar();
        if (cb) cb(res.data);
    } catch (e) {
        toast('Erro ao salvar cliente: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}
