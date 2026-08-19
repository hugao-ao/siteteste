// propostas.js — Página de PROPOSTAS da área Hermogenes
// Kanban por status (com valores), mapa, código NNNN/AAAA, itens com 2 modos de
// preço, preços praticados por cliente, importação de propostas e associação
// com visitas (com trava de status das visitas na página de Visitas).
import {
    sb, toast, fmtDataHora, ligarFecharPorBackdrop, esc, fmtMoeda, STATUS_VISITA
} from './hermo-common.js';
import { abrirModalCliente } from './hermo-cliente-modal.js';
import { listarAnexos, renderGaleria, excluirAnexo, ligarUpload } from './hermo-anexos.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

export const STATUS_PROPOSTA = {
    conferir:           { label: 'Conferir',           cor: '#f97316' },
    preparando:         { label: 'Preparando',         cor: '#eab308' },
    esperando_resposta: { label: 'Esperando resposta', cor: '#3b82f6' },
    contratada:         { label: 'Contratada',         cor: '#22c55e' },
    recusada:           { label: 'Recusada',           cor: '#ef4444' },
    adiada:             { label: 'Adiada',             cor: '#a855f7' }
};
const KANBAN_ORDEM = ['conferir', 'preparando', 'esperando_resposta', 'contratada', 'recusada', 'adiada'];
const VISITA_STATUS_ASSOCIAVEIS = ['concluida', 'concluida_pendencias', 'desistiu'];

// ---------- Estado ----------
let propostas = [];
let visitas = [];             // todas com coords/serviços (associação, prefill e mapa)
let servicosCatalogo = [];
let selecionadas = new Set();
let buscaColuna = {};
let colunasOcultas = lerLS('hermo_prop_kanban_ocultas', {});
let colunasLarguras = lerLS('hermo_prop_kanban_larguras', {});
let larguraObserver = null;
let ocultasMapa = new Set(lerLS('hermo_prop_mapa_ocultas', []));
let statusOcultosMapa = new Set(lerLS('hermo_prop_mapa_status_ocultos', []));
let mapa = null;
let marcadores = [];

// draft do modal
let propostaEditando = null;
let itensDraft = [];          // {sel, servico_id, codigo, descricao, local_execucao, quantidade, unidade, modo_preco, preco_mo, preco_material, preco_unit, total}
let visitasDraft = [];        // ids das visitas associadas
let localEscolhido = null;
let itemEditIndex = null;
let pcAcoes = [];             // checklist de pré-preenchimento pendente

// mini-mapa de escolha de local
let pmMapa = null, pmMarcador = null, pmPendente = null;

function lerLS(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) || padrao; }
    catch (e) { return padrao; }
}

const fmtCodigo = p => `${String(p.numero).padStart(4, '0')}/${p.ano}`;

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [p, v, s] = await Promise.all([
        sb.from('hermo_propostas')
            .select(`*, cliente:hermo_clientes(id, nome, whatsapp),
                itens:hermo_proposta_itens(*, servico:hermo_servicos(id, codigo, descricao, unidade)),
                visitas:hermo_proposta_visitas(visita_id)`)
            .order('ano', { ascending: false }).order('numero', { ascending: false }),
        sb.from('hermo_visitas')
            .select(`id, endereco, latitude, longitude, status, data_visita, cliente_id,
                cliente:hermo_clientes(id, nome),
                servicos:hermo_visita_servicos(servico_id, local_execucao, quantidade, unidade,
                    servico:hermo_servicos(id, codigo, descricao, unidade))`),
        sb.from('hermo_servicos').select('*, precos:hermo_servico_precos(preco_final)').order('codigo')
    ]);
    if (p.error) { toast('Erro ao carregar propostas: ' + p.error.message, true); return; }
    if (v.error) { toast('Erro ao carregar visitas: ' + v.error.message, true); return; }
    if (s.error) { toast('Erro ao carregar serviços: ' + s.error.message, true); return; }
    propostas = (p.data || []).map(x => ({
        ...x,
        itens: (x.itens || []).sort((a, b) => a.ordem - b.ordem),
        visitaIds: (x.visitas || []).map(pv => pv.visita_id)
    }));
    visitas = v.data || [];
    servicosCatalogo = (s.data || []).map(x => ({
        ...x, precos: Array.isArray(x.precos) ? x.precos[0] || null : x.precos
    }));
    ocultasMapa = new Set([...ocultasMapa].filter(id => propostas.some(x => x.id === id)));
    selecionadas.clear();
    renderResumo();
    renderLista();
    renderSelbar();
    atualizarMapa();
}

// ============================================================
// PREÇOS PRATICADOS (por cliente + serviço)
// ============================================================
/** Último preço praticado de um serviço para um cliente (propostas mais recentes primeiro). */
function precoPraticado(clienteId, servicoId, ignorarPropostaId = null) {
    if (!clienteId) return null;
    for (const p of propostas) { // já vem ordenado por ano/numero desc
        if (p.id === ignorarPropostaId || p.cliente_id !== clienteId) continue;
        // procura qualquer linha PRECIFICADA do serviço (o mesmo serviço pode repetir com linha zerada)
        const item = p.itens.find(i => i.servico_id === servicoId && num(i.preco_unit) > 0);
        if (item) {
            return { preco_unit: num(item.preco_unit), modo_preco: item.modo_preco,
                     preco_mo: item.preco_mo, preco_material: item.preco_material, codigo: fmtCodigo(p) };
        }
    }
    return null;
}

/** Preço sugerido para um serviço: praticado do cliente > precificação do catálogo > 0. */
function precoSugerido(clienteId, servicoId) {
    const prat = precoPraticado(clienteId, servicoId, propostaEditando?.id);
    if (prat) return { ...prat, origem: `praticado (${prat.codigo})` };
    const cat = servicosCatalogo.find(x => x.id === servicoId);
    if (cat?.precos?.preco_final > 0) {
        return { preco_unit: num(cat.precos.preco_final), modo_preco: 'global',
                 preco_mo: null, preco_material: null, origem: 'precificação do catálogo' };
    }
    return null;
}

// ============================================================
// RESUMO (quantidades E valores)
// ============================================================
function renderResumo() {
    const porStatus = {};
    KANBAN_ORDEM.forEach(st => porStatus[st] = { n: 0, valor: 0 });
    propostas.forEach(p => {
        if (porStatus[p.status]) { porStatus[p.status].n++; porStatus[p.status].valor += num(p.valor_total); }
    });
    const anoAtual = new Date().getFullYear();
    const contratadasAno = propostas.filter(p => p.status === 'contratada' && p.ano === anoAtual)
        .reduce((t, p) => t + num(p.valor_total), 0);
    let destaque;
    if (porStatus.conferir.n > 0) {
        destaque = `⚠️ <b>${porStatus.conferir.n}</b> proposta(s) aguardando conferência (criadas a partir de visitas).`;
    } else if (porStatus.esperando_resposta.n > 0) {
        destaque = `📨 <b>${fmtMoeda(porStatus.esperando_resposta.valor)}</b> em ${porStatus.esperando_resposta.n} proposta(s) esperando resposta.`;
    } else {
        destaque = `✅ Contratado em ${anoAtual}: <b>${fmtMoeda(contratadasAno)}</b>.`;
    }
    $('resumo').innerHTML = KANBAN_ORDEM.map(st => `
        <div class="stat" style="border-left-color:${STATUS_PROPOSTA[st].cor}">
            <div class="num">${porStatus[st].n} · ${fmtMoeda(porStatus[st].valor)}</div>
            <div class="lbl">${STATUS_PROPOSTA[st].label}</div>
        </div>`).join('') +
        `<div class="stat destaque"><div class="num">${destaque}</div></div>`;
}

// ============================================================
// KANBAN
// ============================================================
function propostasDaColuna(status) {
    const q = (buscaColuna[status] || '').trim().toLowerCase();
    let lista = propostas.filter(p => p.status === status);
    if (q) {
        lista = lista.filter(p =>
            fmtCodigo(p).includes(q) ||
            (p.titulo || '').toLowerCase().includes(q) ||
            (p.cliente?.nome || '').toLowerCase().includes(q) ||
            (p.endereco || '').toLowerCase().includes(q));
    }
    return lista; // já ordenado por ano/numero desc
}

function cardMini(p) {
    const nItens = p.itens.length;
    const nVisitas = p.visitaIds.length;
    return `
    <div class="kb-card ${selecionadas.has(p.id) ? 'selecionado' : ''}" data-id="${p.id}">
        <div class="kb-l1">
            <input type="checkbox" class="check" data-check="${p.id}" ${selecionadas.has(p.id) ? 'checked' : ''} />
            <span class="kb-end">${fmtCodigo(p)} — ${esc(p.titulo)}</span>
        </div>
        <div class="kb-meta">👤 ${p.cliente ? esc(p.cliente.nome) : '<i>avulsa</i>'}</div>
        <div class="kb-meta">💰 <b>${fmtMoeda(p.valor_total)}</b>${nItens ? ` · 🛠️ ${nItens} item(ns)` : ''}${nVisitas ? ` · 🔗 ${nVisitas} visita(s)` : ''}${(ocultasMapa.has(p.id) || statusOcultosMapa.has(p.status)) ? ' · 🙈 oculta no mapa' : ''}</div>
        <div class="kb-acoes">
            ${p.status === 'contratada' ? `<button class="hermo-btn small" data-gerar-obra="${p.id}" title="Gerar obra a partir desta proposta">🏗️</button>` : ''}
            <button class="hermo-btn small ghost" data-editar="${p.id}" title="Editar">✎</button>
            <button class="hermo-btn small danger" data-excluir="${p.id}" title="Excluir">🗑</button>
        </div>
    </div>`;
}

function ligarEventosCards(container) {
    container.querySelectorAll('[data-check]').forEach(ch => ch.addEventListener('change', e => {
        const id = e.target.dataset.check;
        if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
        e.target.closest('.kb-card').classList.toggle('selecionado', e.target.checked);
        renderSelbar();
    }));
    container.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click',
        () => abrirModalProposta(propostas.find(p => p.id === b.dataset.editar))));
    container.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click',
        () => excluirPropostas([b.dataset.excluir])));
    container.querySelectorAll('[data-gerar-obra]').forEach(b => b.addEventListener('click',
        () => gerarObraDaProposta(propostas.find(p => p.id === b.dataset.gerarObra))));
}

/** Cria uma OBRA a partir de uma proposta CONTRATADA: escopo, cliente e endereço herdados. */
async function gerarObraDaProposta(p) {
    if (!p) return;
    // já existe obra desta proposta? avisa antes de duplicar o valor no kanban de obras
    const { data: jaTem } = await sb.from('hermo_obra_propostas')
        .select('obra:hermo_obras(numero, ano, nome)').eq('proposta_id', p.id);
    let avisoDup = '';
    if (jaTem && jaTem.length > 0) {
        const o = jaTem[0].obra;
        avisoDup = `\n\n⚠ ATENÇÃO: esta proposta JÁ está associada à obra ` +
            `${o ? 'OB-' + String(o.numero).padStart(4, '0') + '/' + o.ano + ' — ' + o.nome : 'existente'}. ` +
            `Gerar outra obra duplicaria o valor contratado.`;
    }
    if (!confirm(`Gerar uma obra a partir da proposta ${fmtCodigo(p)} — "${p.titulo}"?\n\n` +
        `O escopo (${p.itens.length} item(ns)), o cliente e o endereço vêm pré-preenchidos, e a proposta fica associada à obra.` + avisoDup)) return;
    try {
        const anoAtual = new Date().getFullYear();
        const { data: ult, error: eNum } = await sb.from('hermo_obras')
            .select('numero').eq('ano', anoAtual).order('numero', { ascending: false }).limit(1);
        if (eNum) throw eNum;
        const numero = (ult && ult[0] ? ult[0].numero : 0) + 1;
        // cria a obra "casca" e aplica a proposta como PRIMEIRO ADITIVO
        // (o escopo passa a ser controlado exclusivamente pelos aditivos)
        const payload = {
            id: null,
            numero,
            ano: anoAtual,
            nome: p.titulo,
            cliente_id: p.cliente_id || null,
            status: 'a_iniciar',
            endereco: p.endereco || null,
            latitude: p.latitude,
            longitude: p.longitude,
            observacoes: null,
            itens: []
        };
        const { data: oid, error } = await sb.rpc('hermo_salvar_obra', { p: payload });
        if (error) throw error;
        const { error: eAd } = await sb.rpc('hermo_aplicar_aditivo', { p_obra: oid, p_proposta: p.id });
        if (eAd) throw eAd;
        toast(`Obra OB-${String(numero).padStart(4, '0')}/${anoAtual} criada — abrindo…`);
        window.location.href = `obras.html?editar=${oid}`;
    } catch (e) {
        if ((e.code || '') === '23505') toast('O número da obra acabou de ser usado — tente novamente.', true);
        else toast('Erro ao gerar obra: ' + e.message, true);
    }
}

function atualizarCorpoColuna(status) {
    const corpo = document.querySelector(`.kb-col[data-col="${status}"] .kb-corpo`);
    if (!corpo) return;
    const lista = propostasDaColuna(status);
    corpo.innerHTML = lista.length ? lista.map(cardMini).join('')
        : `<div class="kb-vazia">${(buscaColuna[status] || '').trim() ? 'nada encontrado' : 'nenhuma proposta aqui'}</div>`;
    ligarEventosCards(corpo);
}

function renderLista() {
    const board = $('kanban');
    board.innerHTML = KANBAN_ORDEM.map(st => {
        const info = STATUS_PROPOSTA[st];
        const doStatus = propostas.filter(p => p.status === st);
        const valor = doStatus.reduce((t, p) => t + num(p.valor_total), 0);
        const oculta = !!colunasOcultas[st];
        const largura = (!oculta && colunasLarguras[st]) ? `width:${colunasLarguras[st]}px;` : '';
        return `
        <div class="kb-col ${oculta ? 'colapsada' : ''}" data-col="${st}" style="${largura}--cor-col:${info.cor}"
             ${oculta ? `title="Clique para mostrar a lista ${info.label}"` : ''}>
            <div class="kb-head">
                <span class="dot" style="background:${info.cor}"></span>
                <span class="kb-titulo">${info.label}</span>
                <span class="kb-count" title="${fmtMoeda(valor)}">${doStatus.length}</span>
                <button class="kb-toggle" data-toggle="${st}" title="${oculta ? 'Mostrar lista' : 'Ocultar lista'}">${oculta ? '⊞' : '—'}</button>
            </div>
            ${oculta ? '' : `<div style="font-size:.72rem;color:var(--hermo-text-dim);text-align:right">${fmtMoeda(valor)}</div>`}
            <input class="kb-busca" data-busca="${st}" type="text" placeholder="Buscar nesta lista…" value="${esc(buscaColuna[st] || '')}" />
            <div class="kb-corpo"></div>
        </div>`;
    }).join('');

    KANBAN_ORDEM.forEach(atualizarCorpoColuna);

    board.querySelectorAll('[data-busca]').forEach(inp => inp.addEventListener('input', e => {
        buscaColuna[e.target.dataset.busca] = e.target.value;
        atualizarCorpoColuna(e.target.dataset.busca);
    }));

    const alternarColuna = st => {
        colunasOcultas[st] = !colunasOcultas[st];
        try { localStorage.setItem('hermo_prop_kanban_ocultas', JSON.stringify(colunasOcultas)); } catch (e) {}
        renderLista();
    };
    board.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        alternarColuna(b.dataset.toggle);
    }));
    board.querySelectorAll('.kb-col.colapsada').forEach(col =>
        col.addEventListener('click', () => alternarColuna(col.dataset.col)));

    if (larguraObserver) larguraObserver.disconnect();
    larguraObserver = new ResizeObserver(() => {
        clearTimeout(renderLista._t);
        renderLista._t = setTimeout(salvarLargurasVisiveis, 400);
    });
    board.querySelectorAll('.kb-col:not(.colapsada)').forEach(c => larguraObserver.observe(c));
}

function salvarLargurasVisiveis() {
    document.querySelectorAll('.kb-col:not(.colapsada)').forEach(c => {
        const st = c.dataset.col;
        const w = Math.round(c.getBoundingClientRect().width);
        if (st && w > 60) colunasLarguras[st] = w;
    });
    try { localStorage.setItem('hermo_prop_kanban_larguras', JSON.stringify(colunasLarguras)); } catch (e) {}
}

// ============================================================
// SELEÇÃO MÚLTIPLA
// ============================================================
function renderSelbar() {
    $('selbar').classList.toggle('ativa', selecionadas.size > 0);
    $('selbar-info').textContent = `${selecionadas.size} selecionada(s)`;
}

function salvarOcultasMapa() {
    try {
        localStorage.setItem('hermo_prop_mapa_ocultas', JSON.stringify([...ocultasMapa]));
        localStorage.setItem('hermo_prop_mapa_status_ocultos', JSON.stringify([...statusOcultosMapa]));
    } catch (e) {}
}

async function excluirPropostas(ids) {
    const n = ids.length;
    if (!confirm(n === 1 ? 'Excluir esta proposta?' : `Excluir ${n} propostas?`)) return;
    const { error } = await sb.from('hermo_propostas').delete().in('id', ids);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast(n === 1 ? 'Proposta excluída.' : `${n} propostas excluídas.`);
    ids.forEach(id => selecionadas.delete(id));
    await carregarTudo();
}

// ============================================================
// MAPA (locais das visitas associadas; senão, endereço próprio)
// ============================================================
function iniciarMapa() {
    if (typeof L === 'undefined') return;
    mapa = L.map('hermo-mapa').setView([-8.0476, -34.877], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(mapa);
}

function renderLegenda() {
    const el = $('mapa-legenda');
    el.innerHTML = Object.entries(STATUS_PROPOSTA).map(([k, v]) =>
        `<span class="leg leg-toggle ${statusOcultosMapa.has(k) ? 'oculto' : ''}" data-leg="${k}"
            title="Clique para ${statusOcultosMapa.has(k) ? 'mostrar' : 'ocultar'} no mapa">
            <span class="dot" style="background:${v.cor}"></span>${v.label}</span>`).join('') +
        (ocultasMapa.size > 0
            ? `<span class="leg"><button class="hermo-btn small ghost" id="btn-mostrar-ocultas">👁 Mostrar ${ocultasMapa.size} proposta(s) oculta(s)</button></span>`
            : '');
    el.querySelectorAll('[data-leg]').forEach(l => l.addEventListener('click', () => {
        const st = l.dataset.leg;
        if (statusOcultosMapa.has(st)) statusOcultosMapa.delete(st);
        else statusOcultosMapa.add(st);
        salvarOcultasMapa();
        atualizarMapa();
        renderLista();
    }));
    const btn = el.querySelector('#btn-mostrar-ocultas');
    if (btn) btn.addEventListener('click', () => {
        ocultasMapa.clear();
        salvarOcultasMapa();
        atualizarMapa();
        renderLista();
        toast('Todas as propostas ocultas voltaram ao mapa.');
    });
}

/** Pontos de uma proposta no mapa: visitas associadas com coords; senão o endereço próprio. */
function pontosDaProposta(p) {
    const viaVisitas = p.visitaIds
        .map(id => visitas.find(v => v.id === id))
        .filter(v => v && v.latitude != null)
        .map(v => ({ lat: v.latitude, lng: v.longitude, rotulo: v.endereco }));
    if (viaVisitas.length > 0) return viaVisitas;
    if (p.latitude != null && p.longitude != null) return [{ lat: p.latitude, lng: p.longitude, rotulo: p.endereco || '' }];
    return [];
}

function atualizarMapa() {
    if (!mapa) return;
    renderLegenda();
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    const bounds = [];
    propostas
        .filter(p => !ocultasMapa.has(p.id) && !statusOcultosMapa.has(p.status))
        .forEach(p => {
            const st = STATUS_PROPOSTA[p.status] || { cor: '#94a3b8', label: p.status };
            pontosDaProposta(p).forEach(pt => {
                const m = L.circleMarker([pt.lat, pt.lng], {
                    radius: 9, color: '#0f172a', weight: 2, fillColor: st.cor, fillOpacity: 1
                }).addTo(mapa);
                m.bindPopup(`<div style="font-size:.85rem;max-width:240px">
                    <b>${fmtCodigo(p)} — ${esc(p.titulo)}</b><br>
                    Status: ${st.label}<br>
                    Valor: ${fmtMoeda(p.valor_total)}<br>
                    ${p.cliente ? 'Cliente: ' + esc(p.cliente.nome) + '<br>' : ''}
                    ${pt.rotulo ? esc(pt.rotulo) : ''}
                </div>`);
                marcadores.push(m);
                bounds.push([pt.lat, pt.lng]);
            });
        });
    if (bounds.length === 1) mapa.setView(bounds[0], 15);
    else if (bounds.length > 1) mapa.fitBounds(bounds, { padding: [40, 40] });
}

// ============================================================
// MODAL DA PROPOSTA
// ============================================================
async function carregarClientesSelect(selecionarId = null) {
    const { data, error } = await sb.from('hermo_clientes').select('id, nome, whatsapp').order('nome');
    if (error) { toast('Erro ao carregar clientes: ' + error.message, true); return; }
    const sel = $('pp-cliente');
    sel.innerHTML = '<option value="">— proposta avulsa (sem cliente) —</option>';
    (data || []).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.nome} (${c.whatsapp})`;
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
}

function proximoNumero(ano) {
    const doAno = propostas.filter(p => p.ano === ano);
    return doAno.length ? Math.max(...doAno.map(p => p.numero)) + 1 : 1;
}

async function abrirModalProposta(proposta) {
    propostaEditando = proposta || null;
    itensDraft = (proposta?.itens || []).map(i => ({
        sel: false,
        servico_id: i.servico_id,
        codigo: i.servico?.codigo || '?',
        descricao: i.servico?.descricao || '?',
        local_execucao: i.local_execucao || '',
        quantidade: num(i.quantidade) || 1,
        unidade: i.unidade || '',
        modo_preco: i.modo_preco || 'global',
        preco_mo: i.preco_mo,
        preco_material: i.preco_material,
        preco_unit: num(i.preco_unit),
        total: num(i.total)
    }));
    visitasDraft = [...(proposta?.visitaIds || [])];
    localEscolhido = null;
    $('pp-local-info').style.display = 'none';

    $('pp-titulo-modal').textContent = proposta ? `Editar proposta ${fmtCodigo(proposta)}` : 'Nova proposta';
    const anoAtual = new Date().getFullYear();
    $('pp-numero').value = proposta ? proposta.numero : proximoNumero(anoAtual);
    $('pp-ano').value = proposta ? proposta.ano : anoAtual;
    $('pp-titulo').value = proposta?.titulo || '';
    $('pp-endereco').value = proposta?.endereco || '';
    $('pp-obs').value = proposta?.observacoes || '';

    // status: 'conferir' nunca é opção selecionável — só aparece se a proposta já está nele
    const sel = $('pp-status');
    const opcaoConferir = sel.querySelector('option[value="conferir"]');
    if (opcaoConferir) opcaoConferir.remove();
    if (proposta?.status === 'conferir') {
        const o = document.createElement('option');
        o.value = 'conferir';
        o.textContent = 'Conferir (automático)';
        sel.insertBefore(o, sel.firstChild);
        sel.value = 'conferir';
        $('pp-status-conferir-aviso').style.display = '';
    } else {
        sel.value = proposta?.status || 'preparando';
        $('pp-status-conferir-aviso').style.display = 'none';
    }

    await carregarClientesSelect(proposta?.cliente_id || null);
    renderItensDraft();
    renderVisitasDraft();
    carregarAnexosProposta();

    $('pp-overlay').classList.add('aberto');
    $('pp-titulo').focus();
}

function fecharModalProposta() {
    $('pp-overlay').classList.remove('aberto');
    propostaEditando = null;
    itensDraft = [];
    visitasDraft = [];
    localEscolhido = null;
}

function totalDraft() {
    return itensDraft.reduce((t, i) => t + num(i.total), 0);
}

/** Anexos da proposta + HERDADOS das visitas associadas (somente leitura). */
async function carregarAnexosProposta() {
    const salva = !!propostaEditando?.id;
    $('pp-anexos-aviso').style.display = salva ? 'none' : '';
    $('pp-btn-anexo').style.display = salva ? '' : 'none';
    const anexos = await listarAnexos({
        propostaIds: salva ? [propostaEditando.id] : [],
        visitaIds: visitasDraft
    });
    renderGaleria($('pp-anexos'), anexos, {
        podeExcluir: true,
        rotuloOrigem: a => a.visita_id ? 'da visita' : null, // herdado: sem excluir aqui
        aoExcluir: async a => { if (await excluirAnexo(a)) await carregarAnexosProposta(); }
    });
}

function renderItensDraft() {
    const cont = $('pp-itens');
    if (itensDraft.length === 0) {
        cont.innerHTML = '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhum item — use "+ Adicionar serviços".</div>';
    } else {
        cont.innerHTML = itensDraft.map((i, idx) => `
        <div class="pp-item">
            <input type="checkbox" class="check" data-isel="${idx}" ${i.sel ? 'checked' : ''} />
            <div class="txt">
                <b>${esc(i.codigo)}</b> — ${esc(i.descricao)}
                <small>
                    ${i.local_execucao ? '📍 ' + esc(i.local_execucao) + ' · ' : ''}
                    ${i.quantidade} ${esc(i.unidade || 'un')} × ${fmtMoeda(i.preco_unit)}
                    ${i.modo_preco === 'mo_material' ? ` (MO ${fmtMoeda(i.preco_mo)} + mat. ${fmtMoeda(i.preco_material)})` : ''}
                </small>
            </div>
            <span class="valor">${fmtMoeda(i.total)}</span>
            <button class="hermo-btn small ghost" data-ieditar="${idx}">✎</button>
            <button class="hermo-btn small danger" data-iremover="${idx}">🗑</button>
        </div>`).join('');
    }
    $('pp-total').textContent = fmtMoeda(totalDraft());
    atualizarItensSelbar();

    cont.querySelectorAll('[data-isel]').forEach(ch => ch.addEventListener('change', e => {
        itensDraft[parseInt(e.target.dataset.isel)].sel = e.target.checked;
        atualizarItensSelbar();
    }));
    cont.querySelectorAll('[data-ieditar]').forEach(b => b.addEventListener('click',
        () => abrirItemModal(parseInt(b.dataset.ieditar))));
    cont.querySelectorAll('[data-iremover]').forEach(b => b.addEventListener('click', () => {
        itensDraft.splice(parseInt(b.dataset.iremover), 1);
        renderItensDraft();
    }));
}

function atualizarItensSelbar() {
    const n = itensDraft.filter(i => i.sel).length;
    $('pp-itens-selbar').classList.toggle('ativa', n > 0);
    $('pp-itens-selinfo').textContent = `${n} item(ns) marcado(s)`;
}

function renderVisitasDraft() {
    const cont = $('pp-visitas');
    if (visitasDraft.length === 0) {
        cont.innerHTML = '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Nenhuma visita associada.</div>';
        return;
    }
    cont.innerHTML = visitasDraft.map(id => {
        const v = visitas.find(x => x.id === id);
        if (!v) return '';
        const opcoes = ['marcada', 'concluida', 'concluida_pendencias', 'desistiu']
            .map(st => `<option value="${st}" ${v.status === st ? 'selected' : ''}>${STATUS_VISITA[st].label}</option>`).join('');
        return `
        <div class="pp-visita">
            <div class="txt"><b>${esc(v.endereco)}</b>
                <small style="display:block;color:var(--hermo-text-dim)">${v.cliente ? esc(v.cliente.nome) + ' · ' : ''}${v.data_visita ? fmtDataHora(v.data_visita) : ''}</small>
            </div>
            <label style="font-size:.72rem;color:var(--hermo-text-dim)">Status da visita:</label>
            <select data-vstatus="${v.id}">${opcoes}</select>
        </div>`;
    }).join('');
    // mudança de status da visita — permitida SÓ por aqui (na pág. de Visitas fica travado)
    // e SÓ para associações já salvas (rascunho não gravado não deve mexer no banco)
    cont.querySelectorAll('[data-vstatus]').forEach(selEl => selEl.addEventListener('change', async e => {
        const vid = e.target.dataset.vstatus;
        const v = visitas.find(x => x.id === vid);
        const anterior = v?.status;
        const novo = e.target.value;
        const persistida = !!propostaEditando?.visitaIds?.includes(vid);
        if (!persistida) {
            e.target.value = anterior;
            toast('Salve a proposta primeiro — a associação ainda é rascunho.', true);
            return;
        }
        const { error } = await sb.from('hermo_visitas').update({ status: novo }).eq('id', vid);
        if (error) {
            e.target.value = anterior; // reverte o select se o banco recusar
            toast('Erro ao mudar status da visita: ' + error.message, true);
            return;
        }
        if (v) v.status = novo;
        toast(`Status da visita atualizado para "${STATUS_VISITA[novo].label}".`);
    }));
}

// ============================================================
// SUB-MODAL: ITEM
// ============================================================
function popularSelectServicoItem(selecionarId = null) {
    const sel = $('pi-servico');
    sel.innerHTML = '<option value="">— selecione —</option>';
    servicosCatalogo.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = `${s.codigo} — ${s.descricao}`;
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
}

function abrirItemModal(editIndex) {
    itemEditIndex = editIndex;
    const item = editIndex != null ? itensDraft[editIndex] : null;
    $('pi-titulo').textContent = item ? 'Editar item' : 'Adicionar item';
    popularSelectServicoItem(item?.servico_id || null);
    $('pi-local').value = item?.local_execucao || '';
    $('pi-qtd').value = item?.quantidade ?? 1;
    $('pi-unidade').value = item?.unidade || '';
    $('pi-modo').value = item?.modo_preco || 'global';
    $('pi-preco-global').value = item?.modo_preco === 'global' ? (item?.preco_unit || '') : '';
    $('pi-preco-mo').value = item?.preco_mo ?? '';
    $('pi-preco-material').value = item?.preco_material ?? '';
    aoMudarModoItem();
    atualizarPraticadoHint();
    $('pi-overlay').classList.add('aberto');
}

function fecharItemModal() {
    $('pi-overlay').classList.remove('aberto');
    itemEditIndex = null;
}

function unitAtual() {
    if ($('pi-modo').value === 'mo_material') {
        return num($('pi-preco-mo').value) + num($('pi-preco-material').value);
    }
    return num($('pi-preco-global').value);
}

function aoMudarModoItem() {
    const mm = $('pi-modo').value === 'mo_material';
    $('pi-wrap-global').style.display = mm ? 'none' : '';
    $('pi-wrap-mm').style.display = mm ? '' : 'none';
    recalcItemPreview();
}

function recalcItemPreview() {
    const u = unitAtual();
    $('pi-unit-preview').textContent = fmtMoeda(u);
    $('pi-total-preview').textContent = fmtMoeda(u * num($('pi-qtd').value));
}

/** Dica de preço praticado para o cliente atual (com botão de aplicar). */
function atualizarPraticadoHint() {
    const el = $('pi-praticado');
    const clienteId = $('pp-cliente').value || null;
    const servicoId = $('pi-servico').value || null;
    const prat = (clienteId && servicoId) ? precoPraticado(clienteId, servicoId, propostaEditando?.id) : null;
    if (!prat) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `💲 Último preço praticado p/ este cliente: <b>${fmtMoeda(prat.preco_unit)}</b> (proposta ${prat.codigo})
        <button class="hermo-btn small primary" id="pi-btn-praticado">Usar este preço</button>`;
    el.querySelector('#pi-btn-praticado').addEventListener('click', () => {
        $('pi-modo').value = prat.modo_preco || 'global';
        aoMudarModoItem();
        if ((prat.modo_preco || 'global') === 'mo_material') {
            $('pi-preco-mo').value = prat.preco_mo ?? '';
            $('pi-preco-material').value = prat.preco_material ?? '';
        } else {
            $('pi-preco-global').value = prat.preco_unit;
        }
        recalcItemPreview();
    });
}

function confirmarItem() {
    const servicoId = $('pi-servico').value;
    if (!servicoId) { toast('Selecione um serviço.', true); return; }
    const qtd = num($('pi-qtd').value);
    if (qtd <= 0) { toast('Quantidade deve ser maior que zero.', true); return; }
    const modo = $('pi-modo').value;
    const unit = unitAtual();
    if (unit <= 0) { toast('Informe o preço unitário.', true); return; }
    const cat = servicosCatalogo.find(s => s.id === servicoId);
    const item = {
        sel: itemEditIndex != null ? itensDraft[itemEditIndex].sel : false,
        servico_id: servicoId,
        codigo: cat?.codigo || '?',
        descricao: cat?.descricao || '?',
        local_execucao: $('pi-local').value.trim(),
        quantidade: qtd,
        unidade: $('pi-unidade').value.trim() || cat?.unidade || '',
        modo_preco: modo,
        preco_mo: modo === 'mo_material' ? num($('pi-preco-mo').value) : null,
        preco_material: modo === 'mo_material' ? num($('pi-preco-material').value) : null,
        // arredonda o unitário PRIMEIRO e calcula o total a partir dele
        // (invariante: total = quantidade × preco_unit, sem resíduo de 3ª casa)
        preco_unit: Math.round(unit * 100) / 100,
        total: Math.round((Math.round(unit * 100) / 100) * qtd * 100) / 100
    };
    if (itemEditIndex != null) itensDraft[itemEditIndex] = item;
    else itensDraft.push(item);
    fecharItemModal();
    renderItensDraft();
}

// ============================================================
// SUB-MODAL: ADICIONAR VÁRIOS SERVIÇOS
// ============================================================
let pselMarcados = new Set(); // sobrevive à busca (re-render não perde marcações)

function abrirSelecaoServicos() {
    $('psel-busca').value = '';
    pselMarcados = new Set();
    renderSelecaoServicos();
    $('psel-overlay').classList.add('aberto');
}

function renderSelecaoServicos() {
    const q = $('psel-busca').value.trim().toLowerCase();
    const lista = servicosCatalogo.filter(s =>
        !q || (s.codigo || '').toLowerCase().includes(q) || (s.descricao || '').toLowerCase().includes(q));
    $('psel-lista').innerHTML = lista.length === 0
        ? '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhum serviço encontrado.</div>'
        : lista.map(s => {
            const sug = precoSugerido($('pp-cliente').value || null, s.id);
            return `
            <label class="lc-item">
                <input type="checkbox" data-psel="${s.id}" ${pselMarcados.has(s.id) ? 'checked' : ''} />
                <div class="txt"><b>${esc(s.codigo)}</b> — ${esc(s.descricao)}
                    <small>${sug ? `preço sugerido: ${fmtMoeda(sug.preco_unit)} (${sug.origem})` : 'sem preço sugerido'}</small>
                </div>
            </label>`;
        }).join('');
    $('psel-lista').querySelectorAll('[data-psel]').forEach(c => c.addEventListener('change', e => {
        if (e.target.checked) pselMarcados.add(e.target.dataset.psel);
        else pselMarcados.delete(e.target.dataset.psel);
    }));
}

function confirmarSelecaoServicos() {
    const marcados = [...pselMarcados].filter(id => servicosCatalogo.some(s => s.id === id));
    if (marcados.length === 0) { toast('Marque ao menos um serviço.', true); return; }
    const clienteId = $('pp-cliente').value || null;
    marcados.forEach(sid => {
        const cat = servicosCatalogo.find(s => s.id === sid);
        const sug = precoSugerido(clienteId, sid);
        const unit = sug ? sug.preco_unit : 0;
        itensDraft.push({
            sel: false,
            servico_id: sid,
            codigo: cat?.codigo || '?',
            descricao: cat?.descricao || '?',
            local_execucao: '',
            quantidade: 1,
            unidade: cat?.unidade || '',
            modo_preco: (sug?.modo_preco === 'mo_material') ? 'mo_material' : 'global',
            preco_mo: sug?.modo_preco === 'mo_material' ? num(sug.preco_mo) : null,
            preco_material: sug?.modo_preco === 'mo_material' ? num(sug.preco_material) : null,
            preco_unit: unit,
            total: unit
        });
    });
    $('psel-overlay').classList.remove('aberto');
    renderItensDraft();
    toast(`${marcados.length} serviço(s) adicionado(s) — ajuste quantidades e preços no ✎.`);
}

// ============================================================
// PREÇOS PRATICADOS EM MASSA
// ============================================================
function aplicarPraticados() {
    const clienteId = $('pp-cliente').value || null;
    if (!clienteId) { toast('Escolha um cliente para buscar os preços praticados.', true); return; }
    const aplicaveis = itensDraft
        .map((i, idx) => ({ i, idx, prat: precoPraticado(clienteId, i.servico_id, propostaEditando?.id) }))
        .filter(x => x.prat);
    if (aplicaveis.length === 0) { toast('Nenhum item tem preço praticado anterior para este cliente.', true); return; }
    const linhas = aplicaveis.map(x =>
        `• ${x.i.codigo} — ${fmtMoeda(x.i.preco_unit)} → ${fmtMoeda(x.prat.preco_unit)} (${x.prat.codigo})`).join('\n');
    if (!confirm(`Aplicar os últimos preços praticados para este cliente?\n\n${linhas}`)) return;
    aplicaveis.forEach(x => {
        const it = itensDraft[x.idx];
        it.modo_preco = x.prat.modo_preco || 'global';
        it.preco_mo = x.prat.preco_mo;
        it.preco_material = x.prat.preco_material;
        it.preco_unit = x.prat.preco_unit;
        it.total = Math.round(x.prat.preco_unit * it.quantidade * 100) / 100;
    });
    renderItensDraft();
    toast(`${aplicaveis.length} item(ns) atualizados com preços praticados.`);
}

// ============================================================
// IMPORTAR DE OUTRA PROPOSTA (sem quantitativos)
// ============================================================
function abrirImportar() {
    const sel = $('pimp-proposta');
    sel.innerHTML = '<option value="">— escolha a proposta —</option>';
    propostas.filter(p => p.id !== propostaEditando?.id && p.itens.length > 0).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${fmtCodigo(p)} — ${p.titulo} (${p.cliente?.nome || 'avulsa'} · ${fmtMoeda(p.valor_total)})`;
        sel.appendChild(o);
    });
    $('pimp-overlay').classList.add('aberto');
}

function confirmarImportar() {
    const p = propostas.find(x => x.id === $('pimp-proposta').value);
    if (!p) { toast('Escolha a proposta de origem.', true); return; }
    p.itens.forEach(i => {
        itensDraft.push({
            sel: false,
            servico_id: i.servico_id,
            codigo: i.servico?.codigo || '?',
            descricao: i.servico?.descricao || '?',
            local_execucao: i.local_execucao || '',
            quantidade: 1,   // sem quantitativos
            unidade: i.unidade || i.servico?.unidade || '',
            modo_preco: i.modo_preco || 'global',
            preco_mo: i.preco_mo,
            preco_material: i.preco_material,
            preco_unit: num(i.preco_unit),
            total: num(i.preco_unit)
        });
    });
    $('pimp-overlay').classList.remove('aberto');
    renderItensDraft();
    toast(`${p.itens.length} item(ns) importados de ${fmtCodigo(p)} (quantidades zeradas para 1).`);
}

// ============================================================
// ASSOCIAR VISITAS + CHECKLIST DE PRÉ-PREENCHIMENTO
// ============================================================
function abrirAssociarVisitas() {
    // elegíveis por status + as JÁ associadas (mesmo que o status tenha mudado depois),
    // para nunca desassociar em silêncio uma visita que não aparece na lista
    const listadas = visitas.filter(v =>
        VISITA_STATUS_ASSOCIAVEIS.includes(v.status) || visitasDraft.includes(v.id));
    $('pv-lista').innerHTML = listadas.length === 0
        ? '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhuma visita concluída/desistiu disponível.</div>'
        : listadas.map(v => {
            const foraDosElegiveis = !VISITA_STATUS_ASSOCIAVEIS.includes(v.status);
            return `
            <label class="lc-item">
                <input type="checkbox" data-pv="${v.id}" ${visitasDraft.includes(v.id) ? 'checked' : ''} />
                <div class="txt"><b>${esc(v.endereco)}</b>
                    <small>${STATUS_VISITA[v.status]?.label || v.status}${v.cliente ? ' · ' + esc(v.cliente.nome) : ''}${v.data_visita ? ' · ' + fmtDataHora(v.data_visita) : ''} · ${(v.servicos || []).length} serviço(s)${foraDosElegiveis ? ' · <span style="color:var(--hermo-warn)">status atual fora dos elegíveis — desmarcar remove a associação</span>' : ''}</small>
                </div>
            </label>`;
        }).join('');
    $('pv-overlay').classList.add('aberto');
}

function confirmarAssociacao() {
    const marcadas = [...document.querySelectorAll('[data-pv]:checked')].map(c => c.dataset.pv);
    const novas = marcadas.filter(id => !visitasDraft.includes(id));
    visitasDraft = marcadas;
    $('pv-overlay').classList.remove('aberto');
    renderVisitasDraft();
    carregarAnexosProposta(); // os anexos herdados acompanham as visitas associadas
    if (novas.length > 0) montarChecklistPrefill(novas);
}

/** Monta o checklist de pré-preenchimento a partir das visitas recém-associadas. */
function montarChecklistPrefill(visitaIds) {
    pcAcoes = [];
    const vs = visitaIds.map(id => visitas.find(v => v.id === id)).filter(Boolean);
    const clienteId = $('pp-cliente').value || null;
    // detecta também conflitos ENTRE as visitas recém-associadas (cliente/endereço)
    let clientePrimeiraVisita = null;
    let enderecoPrimeiraVisita = null;

    for (const v of vs) {
        // cliente
        if (v.cliente_id) {
            if (clientePrimeiraVisita && clientePrimeiraVisita !== v.cliente_id) {
                pcAcoes.push({ tipo: 'cliente', valor: v.cliente_id, conflito: true, marcado: false,
                    rotulo: `Cliente: ${v.cliente?.nome || '?'}`,
                    sub: `⚠ outra visita associada define um cliente diferente — o marcado por último vence` });
            } else if (!clienteId) {
                clientePrimeiraVisita = clientePrimeiraVisita || v.cliente_id;
                if (clientePrimeiraVisita === v.cliente_id && !pcAcoes.some(a => a.tipo === 'cliente' && a.valor === v.cliente_id)) {
                    pcAcoes.push({ tipo: 'cliente', valor: v.cliente_id, conflito: false, marcado: true,
                        rotulo: `Cliente: ${v.cliente?.nome || '?'}`, sub: `da visita "${v.endereco}"` });
                }
            } else if (clienteId !== v.cliente_id) {
                clientePrimeiraVisita = clientePrimeiraVisita || v.cliente_id;
                const atual = $('pp-cliente').selectedOptions[0]?.textContent || 'atual';
                pcAcoes.push({ tipo: 'cliente', valor: v.cliente_id, conflito: true, marcado: false,
                    rotulo: `Cliente: ${v.cliente?.nome || '?'}`, sub: `substitui "${atual}"` });
            }
        }
        // endereço (usa o da visita, conforme combinado)
        if (v.endereco) {
            const atual = $('pp-endereco').value.trim();
            if (enderecoPrimeiraVisita && enderecoPrimeiraVisita !== v.endereco) {
                pcAcoes.push({ tipo: 'endereco', valor: v, conflito: true, marcado: false,
                    rotulo: `Endereço: ${v.endereco}`,
                    sub: `⚠ outra visita associada define endereço diferente — o marcado por último vence` });
            } else if (!atual) {
                enderecoPrimeiraVisita = enderecoPrimeiraVisita || v.endereco;
                if (!pcAcoes.some(a => a.tipo === 'endereco' && a.valor.endereco === v.endereco)) {
                    pcAcoes.push({ tipo: 'endereco', valor: v, conflito: false, marcado: true,
                        rotulo: `Endereço: ${v.endereco}`, sub: 'proposta está sem endereço' });
                }
            } else if (atual !== v.endereco) {
                enderecoPrimeiraVisita = enderecoPrimeiraVisita || v.endereco;
                pcAcoes.push({ tipo: 'endereco', valor: v, conflito: true, marcado: false,
                    rotulo: `Endereço: ${v.endereco}`, sub: `substitui "${atual}"` });
            }
        }
        // serviços da visita (com quantidades) — preço praticado/catálogo sugerido
        for (const sv of (v.servicos || [])) {
            const jaTem = itensDraft.some(i => i.servico_id === sv.servico_id);
            pcAcoes.push({
                tipo: 'servico', valor: { sv, visita: v }, conflito: jaTem, marcado: !jaTem,
                rotulo: `Serviço ${sv.servico?.codigo || '?'} — ${sv.servico?.descricao || '?'}`,
                sub: `${sv.quantidade ? 'qtd ' + sv.quantidade + ' ' + (sv.unidade || '') : 'sem quantidade'}${sv.local_execucao ? ' · ' + sv.local_execucao : ''}` +
                     (jaTem ? ' — substitui o item já existente deste serviço' : '')
            });
        }
    }

    if (pcAcoes.length === 0) { toast('Visitas associadas — nada novo para pré-preencher.'); return; }
    $('pc-lista').innerHTML = pcAcoes.map((a, i) => `
        <label class="lc-item ${a.conflito ? 'conflito' : ''}">
            <input type="checkbox" data-pc="${i}" ${a.marcado ? 'checked' : ''} />
            <div class="txt"><b>${esc(a.rotulo)}</b> ${a.conflito ? '<span class="lc-conflito-tag">⚠ SOBRESCREVE</span>' : ''}
                <small>${esc(a.sub)}</small>
            </div>
        </label>`).join('');
    $('pc-overlay').classList.add('aberto');
}

async function aplicarChecklist() {
    const marcados = [...document.querySelectorAll('[data-pc]:checked')].map(c => pcAcoes[parseInt(c.dataset.pc)]);
    $('pc-overlay').classList.remove('aberto');
    if (marcados.length === 0) { toast('Nada aplicado.'); return; }

    for (const a of marcados) {
        if (a.tipo === 'cliente') {
            await carregarClientesSelect(a.valor);
        } else if (a.tipo === 'endereco') {
            $('pp-endereco').value = a.valor.endereco;
            if (a.valor.latitude != null) {
                localEscolhido = { lat: a.valor.latitude, lng: a.valor.longitude };
                $('pp-local-info').style.display = '';
            }
        } else if (a.tipo === 'servico') {
            const { sv } = a.valor;
            // sobrescreve: remove itens existentes do mesmo serviço
            itensDraft = itensDraft.filter(i => i.servico_id !== sv.servico_id || !a.conflito);
            const clienteId = $('pp-cliente').value || null;
            const sug = precoSugerido(clienteId, sv.servico_id);
            const unit = sug ? sug.preco_unit : 0;
            const qtd = num(sv.quantidade) || 1;
            itensDraft.push({
                sel: false,
                servico_id: sv.servico_id,
                codigo: sv.servico?.codigo || '?',
                descricao: sv.servico?.descricao || '?',
                local_execucao: sv.local_execucao || '',
                quantidade: qtd,
                unidade: sv.unidade || sv.servico?.unidade || '',
                modo_preco: (sug?.modo_preco === 'mo_material') ? 'mo_material' : 'global',
                preco_mo: sug?.modo_preco === 'mo_material' ? num(sug.preco_mo) : null,
                preco_material: sug?.modo_preco === 'mo_material' ? num(sug.preco_material) : null,
                preco_unit: unit,
                total: Math.round(unit * qtd * 100) / 100
            });
        }
    }
    renderItensDraft();
    toast(`${marcados.length} pré-preenchimento(s) aplicado(s).`);
}

// ============================================================
// SALVAR PROPOSTA
// ============================================================
async function salvarProposta() {
    const numero = parseInt($('pp-numero').value);
    const ano = parseInt($('pp-ano').value);
    const titulo = $('pp-titulo').value.trim();
    if (!numero || numero < 1 || numero > 9999) { toast('Número inválido (1 a 9999).', true); return; }
    if (!ano || ano < 2000 || ano > 2100) { toast('Ano inválido.', true); return; }
    if (!titulo) { toast('Título é obrigatório.', true); return; }
    // código único por ano
    const duplicada = propostas.find(p => p.numero === numero && p.ano === ano && p.id !== propostaEditando?.id);
    if (duplicada) { toast(`Já existe a proposta ${fmtCodigo(duplicada)} — escolha outro número.`, true); return; }

    const btn = $('pp-salvar');
    btn.disabled = true;
    try {
        const endereco = $('pp-endereco').value.trim();
        let lat = propostaEditando?.latitude ?? null;
        let lng = propostaEditando?.longitude ?? null;
        if (localEscolhido) {
            lat = localEscolhido.lat; lng = localEscolhido.lng;
        } else if (endereco && (!propostaEditando || propostaEditando.endereco !== endereco || lat == null)) {
            const geo = await geocodificar(endereco);
            lat = geo?.lat ?? null;
            lng = geo?.lng ?? null;
        } else if (!endereco) {
            lat = null; lng = null;
        }

        const payload = {
            id: propostaEditando?.id || null,
            numero, ano, titulo,
            cliente_id: $('pp-cliente').value || null,
            status: $('pp-status').value,
            endereco: endereco || null,
            latitude: lat,
            longitude: lng,
            valor_total: Math.round(totalDraft() * 100) / 100,
            observacoes: $('pp-obs').value.trim() || null,
            itens: itensDraft.map(i => ({
                servico_id: i.servico_id,
                local_execucao: i.local_execucao || null,
                quantidade: i.quantidade,
                unidade: i.unidade || null,
                modo_preco: i.modo_preco,
                preco_mo: i.preco_mo,
                preco_material: i.preco_material,
                preco_unit: i.preco_unit,
                total: i.total
            })),
            visitas: visitasDraft
        };
        const eraEdicao = !!propostaEditando;
        const { data: pid, error } = await sb.rpc('hermo_salvar_proposta', { p: payload });
        if (error) throw error;
        if (!propostaEditando && pid) propostaEditando = { id: pid };
        toast(eraEdicao ? 'Proposta atualizada.' : 'Proposta criada.');
        fecharModalProposta();
        await carregarTudo();
    } catch (e) {
        if ((e.code || '') === '23505') toast('Já existe uma proposta com esse número/ano.', true);
        else toast('Erro ao salvar proposta: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// GEOCODE / MINI-MAPA DE LOCAL
// ============================================================
async function geocodificar(endereco) {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const resp = await fetch(
            'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' +
            encodeURIComponent(endereco), { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
        clearTimeout(t);
        if (!resp.ok) return null;
        const arr = await resp.json();
        return (arr && arr[0]) ? { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) } : null;
    } catch (e) { return null; }
}

function abrirModalLocal() {
    if (typeof L === 'undefined') { toast('Mapa indisponível no momento.', true); return; }
    $('pm2-overlay').classList.add('aberto');
    pmPendente = localEscolhido
        || (propostaEditando?.latitude != null ? { lat: propostaEditando.latitude, lng: propostaEditando.longitude } : null);
    const centro = pmPendente ? [pmPendente.lat, pmPendente.lng] : [-8.0476, -34.877];
    if (!pmMapa) {
        pmMapa = L.map('pm2-mapa').setView(centro, pmPendente ? 16 : 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 19
        }).addTo(pmMapa);
        pmMapa.on('click', e => {
            pmPendente = { lat: e.latlng.lat, lng: e.latlng.lng };
            posicionarPmMarcador();
            $('pm2-confirmar').disabled = false;
        });
    } else {
        pmMapa.setView(centro, pmPendente ? 16 : 12);
    }
    posicionarPmMarcador();
    $('pm2-confirmar').disabled = !pmPendente;
    setTimeout(() => pmMapa.invalidateSize(), 150);
}

function posicionarPmMarcador() {
    if (pmMarcador) { pmMapa.removeLayer(pmMarcador); pmMarcador = null; }
    if (pmPendente) pmMarcador = L.marker([pmPendente.lat, pmPendente.lng]).addTo(pmMapa);
}

async function confirmarLocal() {
    if (!pmPendente) return;
    localEscolhido = pmPendente;
    $('pp-local-info').style.display = '';
    $('pm2-overlay').classList.remove('aberto');
    if (!$('pp-endereco').value.trim()) {
        try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 6000);
            const resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${localEscolhido.lat}&lon=${localEscolhido.lng}`,
                { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
            clearTimeout(t);
            if (resp.ok) {
                const j = await resp.json();
                if (j.display_name) $('pp-endereco').value = j.display_name;
            }
        } catch (e) { /* endereço fica manual */ }
    }
    toast('Local definido pelo mapa.');
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('btn-nova').addEventListener('click', () => abrirModalProposta(null));

$('btn-sel-todas').addEventListener('click', () => {
    KANBAN_ORDEM.filter(st => !colunasOcultas[st])
        .forEach(st => propostasDaColuna(st).forEach(p => selecionadas.add(p.id)));
    renderLista();
    renderSelbar();
});
$('btn-sel-limpar').addEventListener('click', () => { selecionadas.clear(); renderLista(); renderSelbar(); });
$('btn-sel-ocultar').addEventListener('click', () => {
    if (selecionadas.size === 0) return;
    selecionadas.forEach(id => ocultasMapa.add(id));
    salvarOcultasMapa(); atualizarMapa(); renderLista();
    toast(`${selecionadas.size} proposta(s) oculta(s) do mapa.`);
});
$('btn-sel-mostrar').addEventListener('click', () => {
    if (selecionadas.size === 0) return;
    selecionadas.forEach(id => ocultasMapa.delete(id));
    salvarOcultasMapa(); atualizarMapa(); renderLista();
    toast(`${selecionadas.size} proposta(s) de volta ao mapa.`);
});
$('btn-sel-excluir').addEventListener('click', () => excluirPropostas([...selecionadas]));

// modal proposta
$('pp-fechar').addEventListener('click', fecharModalProposta);
$('pp-cancelar').addEventListener('click', fecharModalProposta);
ligarFecharPorBackdrop($('pp-overlay'), fecharModalProposta);
$('pp-salvar').addEventListener('click', salvarProposta);
$('pp-btn-mapa').addEventListener('click', abrirModalLocal);
ligarUpload($('pp-btn-anexo'), () => {
    if (!propostaEditando?.id) { toast('Salve a proposta antes de anexar.', true); return null; }
    return { tipo_ref: 'proposta', proposta_id: propostaEditando.id };
}, carregarAnexosProposta);
$('pp-btn-novo-cliente').addEventListener('click', () =>
    abrirModalCliente(null, c => carregarClientesSelect(c.id)));
$('pp-btn-editar-cliente').addEventListener('click', async () => {
    const id = $('pp-cliente').value;
    if (!id) { toast('Selecione um cliente para editar.', true); return; }
    const { data, error } = await sb.from('hermo_clientes').select('*').eq('id', id).single();
    if (error) { toast('Erro ao carregar cliente: ' + error.message, true); return; }
    abrirModalCliente(data, c => carregarClientesSelect(c.id));
});

// itens: seleção múltipla
$('pp-itens-sel-todos').addEventListener('click', () => { itensDraft.forEach(i => i.sel = true); renderItensDraft(); });
$('pp-itens-sel-limpar').addEventListener('click', () => { itensDraft.forEach(i => i.sel = false); renderItensDraft(); });
$('pp-itens-sel-excluir').addEventListener('click', () => {
    const n = itensDraft.filter(i => i.sel).length;
    if (n === 0) return;
    if (!confirm(`Remover ${n} item(ns) da proposta?`)) return;
    itensDraft = itensDraft.filter(i => !i.sel);
    renderItensDraft();
});
$('pp-btn-add-servicos').addEventListener('click', abrirSelecaoServicos);
$('pp-btn-praticados').addEventListener('click', aplicarPraticados);
$('pp-btn-importar').addEventListener('click', abrirImportar);
$('pp-btn-visitas').addEventListener('click', abrirAssociarVisitas);

// sub-modal item
$('pi-fechar').addEventListener('click', fecharItemModal);
$('pi-cancelar').addEventListener('click', fecharItemModal);
ligarFecharPorBackdrop($('pi-overlay'), fecharItemModal);
$('pi-confirmar').addEventListener('click', confirmarItem);
$('pi-modo').addEventListener('change', aoMudarModoItem);
$('pi-servico').addEventListener('change', atualizarPraticadoHint);
['pi-qtd', 'pi-preco-global', 'pi-preco-mo', 'pi-preco-material'].forEach(id =>
    $(id).addEventListener('input', recalcItemPreview));

// sub-modal seleção de serviços
$('psel-fechar').addEventListener('click', () => $('psel-overlay').classList.remove('aberto'));
$('psel-cancelar').addEventListener('click', () => $('psel-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('psel-overlay'), () => $('psel-overlay').classList.remove('aberto'));
$('psel-confirmar').addEventListener('click', confirmarSelecaoServicos);
$('psel-busca').addEventListener('input', renderSelecaoServicos);
$('psel-todos').addEventListener('click', () => document.querySelectorAll('[data-psel]').forEach(c => {
    c.checked = true;
    pselMarcados.add(c.dataset.psel);
}));
$('psel-nenhum').addEventListener('click', () => document.querySelectorAll('[data-psel]').forEach(c => {
    c.checked = false;
    pselMarcados.delete(c.dataset.psel);
}));

// sub-modal importar
$('pimp-fechar').addEventListener('click', () => $('pimp-overlay').classList.remove('aberto'));
$('pimp-cancelar').addEventListener('click', () => $('pimp-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('pimp-overlay'), () => $('pimp-overlay').classList.remove('aberto'));
$('pimp-confirmar').addEventListener('click', confirmarImportar);

// sub-modal visitas
$('pv-fechar').addEventListener('click', () => $('pv-overlay').classList.remove('aberto'));
$('pv-cancelar').addEventListener('click', () => $('pv-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('pv-overlay'), () => $('pv-overlay').classList.remove('aberto'));
$('pv-confirmar').addEventListener('click', confirmarAssociacao);

// sub-modal checklist
$('pc-fechar').addEventListener('click', () => $('pc-overlay').classList.remove('aberto'));
$('pc-cancelar').addEventListener('click', () => { $('pc-overlay').classList.remove('aberto'); toast('Nada aplicado.'); });
ligarFecharPorBackdrop($('pc-overlay'), () => $('pc-overlay').classList.remove('aberto'));
$('pc-confirmar').addEventListener('click', aplicarChecklist);
$('pc-todos').addEventListener('click', () => document.querySelectorAll('[data-pc]').forEach(c => c.checked = true));
$('pc-nenhum').addEventListener('click', () => document.querySelectorAll('[data-pc]').forEach(c => c.checked = false));

// sub-modal local no mapa
$('pm2-fechar').addEventListener('click', () => $('pm2-overlay').classList.remove('aberto'));
$('pm2-cancelar').addEventListener('click', () => $('pm2-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('pm2-overlay'), () => $('pm2-overlay').classList.remove('aberto'));
$('pm2-confirmar').addEventListener('click', confirmarLocal);

// boot (+ ?editar=ID vindo de outras páginas)
iniciarMapa();
carregarTudo().then(() => {
    const id = new URLSearchParams(window.location.search).get('editar');
    if (id) {
        const p = propostas.find(x => x.id === id);
        if (p) abrirModalProposta(p);
    }
});
