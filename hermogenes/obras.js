// obras.js — Página de OBRAS: kanban com valores e % execução, mapa, escopo,
// cronograma com ALOCAÇÕES (dia/turno/horário) e bloqueio de conflitos de agenda,
// diário de obra e associação com propostas contratadas (aditivos).
import {
    sb, toast, fmtDataHora, ligarFecharPorBackdrop, esc, fmtMoeda
} from './hermo-common.js';
import { abrirModalCliente } from './hermo-cliente-modal.js';
import { listarAnexos, renderGaleria, excluirAnexo, uploadAnexo } from './hermo-anexos.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

export const STATUS_OBRA = {
    a_iniciar:    { label: 'A iniciar',    cor: '#eab308' },
    em_andamento: { label: 'Em andamento', cor: '#3b82f6' },
    pausada:      { label: 'Pausada',      cor: '#f97316' },
    concluida:    { label: 'Concluída',    cor: '#22c55e' },
    entregue:     { label: 'Entregue',     cor: '#a855f7' }
};
const KANBAN_ORDEM = ['a_iniciar', 'em_andamento', 'pausada', 'concluida', 'entregue'];
const TURNO_LABEL = { dia: 'dia inteiro', manha: 'manhã', tarde: 'tarde', horario: 'horário' };

// ---------- Estado ----------
let obras = [];
let integrantes = [];
let equipes = [];
let servicosCatalogo = [];
let propostasContratadas = [];
let selecionadas = new Set();
let buscaColuna = {};
let colunasOcultas = lerLS('hermo_obras_kanban_ocultas', {});
let colunasLarguras = lerLS('hermo_obras_kanban_larguras', {});
let larguraObserver = null;
let ocultasMapa = new Set(lerLS('hermo_obras_mapa_ocultas', []));
let statusOcultosMapa = new Set(lerLS('hermo_obras_mapa_status_ocultos', []));
let mapa = null;
let marcadores = [];

// draft do modal
let obraEditando = null;
let itensDraft = [];          // {id?, sel, servico_id, codigo, descricao, local_execucao, quantidade, unidade, preco_unit, total, perc_executado, inicio_previsto, fim_previsto, alocacoes:[]}
let propostasDraft = [];      // ids
let diarioEntradas = [];
let localEscolhido = null;
let alocItemIndex = null;     // índice em itensDraft do serviço sendo alocado
let oaMarcados = new Set();
let depsDraft = [];           // [{item_id, depende_de_id}] — dependências entre serviços da obra aberta
let depItemIndex = null;      // índice em itensDraft do serviço cujas dependências estão sendo editadas

// mini-mapa
let omMapa = null, omMarcador = null, omPendente = null;

function lerLS(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) || padrao; }
    catch (e) { return padrao; }
}

const fmtCodigo = o => `OB-${String(o.numero).padStart(4, '0')}/${o.ano}`;
// data LOCAL (toISOString seria UTC e viraria "amanhã" à noite no fuso de Recife)
const hoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [o, i, e, s, p] = await Promise.all([
        sb.from('hermo_obras')
            .select(`*, cliente:hermo_clientes(id, nome, whatsapp),
                itens:hermo_obra_servicos(*, servico:hermo_servicos(id, codigo, descricao, unidade),
                    alocacoes:hermo_alocacoes(*, integrante:hermo_integrantes(id, nome, apelido), equipe:hermo_equipes(id, nome, cor))),
                propostas:hermo_obra_propostas(proposta_id),
                dependencias:hermo_obra_dependencias(item_id, depende_de_id)`)
            .order('ano', { ascending: false }).order('numero', { ascending: false }),
        sb.from('hermo_integrantes').select('*, funcao:hermo_funcoes(nome)').order('nome'),
        sb.from('hermo_equipes').select('*, membros:hermo_equipe_membros(integrante_id)').order('nome'),
        sb.from('hermo_servicos').select('*, precos:hermo_servico_precos(preco_final)').order('codigo'),
        sb.from('hermo_propostas')
            .select('id, numero, ano, titulo, valor_total, cliente_id, endereco, latitude, longitude, cliente:hermo_clientes(nome), itens:hermo_proposta_itens(*, servico:hermo_servicos(id, codigo, descricao, unidade))')
            .eq('status', 'contratada')
    ]);
    if (o.error) { toast('Erro ao carregar obras: ' + o.error.message, true); return; }
    if (i.error || e.error || s.error || p.error) {
        toast('Erro ao carregar dados de apoio: ' + (i.error || e.error || s.error || p.error).message, true);
    }
    obras = (o.data || []).map(x => ({
        ...x,
        itens: (x.itens || []).sort((a, b) => a.ordem - b.ordem),
        propostaIds: (x.propostas || []).map(op => op.proposta_id),
        dependencias: x.dependencias || []
    }));
    integrantes = i.data || [];
    equipes = (e.data || []).map(q => ({ ...q, membroIds: (q.membros || []).map(m => m.integrante_id) }));
    servicosCatalogo = (s.data || []).map(x => ({
        ...x, precos: Array.isArray(x.precos) ? x.precos[0] || null : x.precos
    }));
    propostasContratadas = p.data || [];
    ocultasMapa = new Set([...ocultasMapa].filter(id => obras.some(x => x.id === id)));
    selecionadas.clear();
    renderResumo();
    renderLista();
    renderSelbar();
    atualizarMapa();
}

function progressoObra(o) {
    const vigentes = o.itens.filter(it => it.vigente !== false);
    const totalV = vigentes.reduce((t, it) => t + num(it.total), 0);
    if (totalV === 0) return 0;
    const exec = vigentes.reduce((t, it) => t + num(it.total) * num(it.perc_executado) / 100, 0);
    return Math.round(exec / totalV * 100);
}

function prazoEstourado(o) {
    return o.prazo && o.prazo < hoje() && !['concluida', 'entregue'].includes(o.status);
}

/** Executado acima do contratado em algum serviço vigente → precisa de aditivo. */
function itemExcedente(it) {
    return it.qtd_executada != null && it.qtd_executada !== '' && num(it.qtd_executada) > num(it.quantidade);
}
function obraTemExcedente(o) {
    return (o.itens || []).some(it => it.vigente !== false && itemExcedente(it));
}

const fmtData = iso => (iso || '').split('-').reverse().join('/');
const fmtQtd = v => {
    const n = Math.round(num(v) * 100) / 100;
    return String(n).replace('.', ',');
};

// ---------- cadeia de dependências (espelho do recálculo do banco) ----------
const somarDias = (iso, dias) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + dias);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const difDias = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

/** Itens que dependem (direta ou indiretamente) do item — não podem virar dependência dele (ciclo). */
function descendentesDe(itemId) {
    const desc = new Set();
    let fronteira = [itemId];
    while (fronteira.length) {
        const novos = depsDraft
            .filter(d => fronteira.includes(d.depende_de_id) && !desc.has(d.item_id))
            .map(d => d.item_id);
        novos.forEach(id => desc.add(id));
        fronteira = novos;
    }
    return desc;
}

function predsDe(itemId) {
    return depsDraft.filter(d => d.item_id === itemId)
        .map(d => itensDraft.find(i => i.id === d.depende_de_id))
        .filter(i => i && i.vigente !== false);
}

/**
 * Recalcula as datas previstas do draft seguindo a cadeia (prévia do que o banco fará ao salvar):
 * concluído (fim_real) congela; início real manda; com dependências, o início é a última
 * data-fim dos prévios (fim_real ou fim previsto); a duração prevista é preservada.
 */
function recalcCadeiaDraft() {
    const vig = itensDraft.filter(i => i.id && i.vigente !== false);
    for (let passe = 0; passe < vig.length; passe++) {
        let mudou = false;
        vig.forEach(i => {
            if (i.fim_real) return;
            let base = null;
            if (i.inicio_real) {
                base = i.inicio_real;
            } else {
                const fins = predsDe(i.id).map(p => p.fim_real || p.fim_previsto).filter(Boolean);
                if (fins.length) base = fins.sort().pop();
            }
            if (!base) return;
            const dur = (i.inicio_previsto && i.fim_previsto)
                ? Math.max(0, difDias(i.inicio_previsto, i.fim_previsto)) : 0;
            const novoFim = somarDias(base, dur);
            if (i.inicio_previsto !== base || i.fim_previsto !== novoFim) {
                i.inicio_previsto = base;
                i.fim_previsto = novoFim;
                mudou = true;
            }
        });
        if (!mudou) break;
    }
}

// ============================================================
// RESUMO
// ============================================================
function renderResumo() {
    const porStatus = {};
    KANBAN_ORDEM.forEach(st => porStatus[st] = { n: 0, valor: 0 });
    obras.forEach(o => {
        if (porStatus[o.status]) { porStatus[o.status].n++; porStatus[o.status].valor += num(o.valor_contratado); }
    });
    const andamento = obras.filter(o => o.status === 'em_andamento');
    const progMedio = andamento.length
        ? Math.round(andamento.reduce((t, o) => t + progressoObra(o), 0) / andamento.length) : 0;
    const estouradas = obras.filter(prazoEstourado);
    const excedentes = obras.filter(obraTemExcedente);
    let destaque;
    if (estouradas.length > 0) {
        destaque = `⚠️ <b>${estouradas.length}</b> obra(s) com prazo estourado: ${estouradas.slice(0, 3).map(o => esc(o.nome)).join(', ')}${estouradas.length > 3 ? '…' : ''}`;
    } else if (andamento.length > 0) {
        destaque = `🏗️ ${andamento.length} obra(s) em andamento — execução média de <b>${progMedio}%</b>.`;
    } else {
        destaque = `✅ Nenhuma obra em andamento no momento.`;
    }
    if (excedentes.length > 0) {
        destaque += `<br>🧾 <b>${excedentes.length}</b> obra(s) com serviço executado acima do contratado — gerar aditivo: ${excedentes.slice(0, 3).map(o => esc(o.nome)).join(', ')}${excedentes.length > 3 ? '…' : ''}`;
    }
    $('resumo').innerHTML = KANBAN_ORDEM.map(st => `
        <div class="stat" style="border-left-color:${STATUS_OBRA[st].cor}">
            <div class="num">${porStatus[st].n} · ${fmtMoeda(porStatus[st].valor)}</div>
            <div class="lbl">${STATUS_OBRA[st].label}</div>
        </div>`).join('') +
        `<div class="stat destaque"><div class="num">${destaque}</div></div>`;
}

// ============================================================
// KANBAN
// ============================================================
function obrasDaColuna(status) {
    const q = (buscaColuna[status] || '').trim().toLowerCase();
    let lista = obras.filter(o => o.status === status);
    if (q) {
        lista = lista.filter(o =>
            fmtCodigo(o).toLowerCase().includes(q) ||
            (o.nome || '').toLowerCase().includes(q) ||
            (o.cliente?.nome || '').toLowerCase().includes(q) ||
            (o.endereco || '').toLowerCase().includes(q));
    }
    return lista;
}

function cardMini(o) {
    const prog = progressoObra(o);
    const estourou = prazoEstourado(o);
    return `
    <div class="kb-card ${selecionadas.has(o.id) ? 'selecionado' : ''}" data-id="${o.id}">
        <div class="kb-l1">
            <input type="checkbox" class="check" data-check="${o.id}" ${selecionadas.has(o.id) ? 'checked' : ''} />
            <span class="kb-end">${fmtCodigo(o)} — ${esc(o.nome)}</span>
        </div>
        <div class="kb-meta">👤 ${o.cliente ? esc(o.cliente.nome) : '<i>sem cliente</i>'}</div>
        <div class="kb-meta">💰 <b>${fmtMoeda(o.valor_contratado)}</b> · 🛠️ ${o.itens.filter(it => it.vigente !== false).length} serviço(s)${o.prazo ? ` · <span class="${estourou ? 'prazo-estourado' : ''}">📅 ${o.prazo.split('-').reverse().join('/')}</span>` : ''}${obraTemExcedente(o) ? ' · <span class="prazo-estourado" title="Serviço executado acima do contratado — gere um aditivo">⚠ aditivo</span>' : ''}${(ocultasMapa.has(o.id) || statusOcultosMapa.has(o.status)) ? ' · 🙈' : ''}</div>
        <div style="display:flex;align-items:center;gap:6px">
            <div class="ob-progresso" style="flex:1"><div style="width:${prog}%"></div></div>
            <span style="font-size:.72rem;font-weight:700">${prog}%</span>
        </div>
        <div class="kb-acoes">
            <button class="hermo-btn small ghost" data-editar="${o.id}" title="Abrir obra">✎</button>
            <button class="hermo-btn small danger" data-excluir="${o.id}" title="Excluir">🗑</button>
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
        () => abrirModalObra(obras.find(o => o.id === b.dataset.editar))));
    container.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click',
        () => excluirObras([b.dataset.excluir])));
}

function atualizarCorpoColuna(status) {
    const corpo = document.querySelector(`.kb-col[data-col="${status}"] .kb-corpo`);
    if (!corpo) return;
    const lista = obrasDaColuna(status);
    corpo.innerHTML = lista.length ? lista.map(cardMini).join('')
        : `<div class="kb-vazia">${(buscaColuna[status] || '').trim() ? 'nada encontrado' : 'nenhuma obra aqui'}</div>`;
    ligarEventosCards(corpo);
}

function renderLista() {
    const board = $('kanban');
    board.innerHTML = KANBAN_ORDEM.map(st => {
        const info = STATUS_OBRA[st];
        const doStatus = obras.filter(o => o.status === st);
        const valor = doStatus.reduce((t, o) => t + num(o.valor_contratado), 0);
        const oculta = !!colunasOcultas[st];
        const largura = (!oculta && colunasLarguras[st]) ? `width:${colunasLarguras[st]}px;` : '';
        return `
        <div class="kb-col ${oculta ? 'colapsada' : ''}" data-col="${st}" style="${largura}--cor-col:${info.cor}"
             ${oculta ? `title="Clique para mostrar a lista ${info.label}"` : ''}>
            <div class="kb-head">
                <span class="dot" style="background:${info.cor}"></span>
                <span class="kb-titulo">${info.label}</span>
                <span class="kb-count" title="${fmtMoeda(valor)}">${doStatus.length}</span>
                <button class="kb-toggle" data-toggle="${st}">${oculta ? '⊞' : '—'}</button>
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
        try { localStorage.setItem('hermo_obras_kanban_ocultas', JSON.stringify(colunasOcultas)); } catch (e) {}
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
    try { localStorage.setItem('hermo_obras_kanban_larguras', JSON.stringify(colunasLarguras)); } catch (e) {}
}

// ============================================================
// SELEÇÃO / EXCLUSÃO / MAPA
// ============================================================
function renderSelbar() {
    $('selbar').classList.toggle('ativa', selecionadas.size > 0);
    $('selbar-info').textContent = `${selecionadas.size} selecionada(s)`;
}

function salvarOcultasMapa() {
    try {
        localStorage.setItem('hermo_obras_mapa_ocultas', JSON.stringify([...ocultasMapa]));
        localStorage.setItem('hermo_obras_mapa_status_ocultos', JSON.stringify([...statusOcultosMapa]));
    } catch (e) {}
}

async function excluirObras(ids) {
    const n = ids.length;
    if (!confirm((n === 1 ? 'Excluir esta obra?' : `Excluir ${n} obras?`) +
        '\n\n⚠ O escopo, o cronograma (alocações) e o diário dela(s) serão removidos. As propostas continuam existindo.')) return;
    const { error } = await sb.from('hermo_obras').delete().in('id', ids);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast(n === 1 ? 'Obra excluída.' : `${n} obras excluídas.`);
    ids.forEach(id => selecionadas.delete(id));
    await carregarTudo();
}

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
    el.innerHTML = Object.entries(STATUS_OBRA).map(([k, v]) =>
        `<span class="leg leg-toggle ${statusOcultosMapa.has(k) ? 'oculto' : ''}" data-leg="${k}">
            <span class="dot" style="background:${v.cor}"></span>${v.label}</span>`).join('') +
        (ocultasMapa.size > 0
            ? `<span class="leg"><button class="hermo-btn small ghost" id="btn-mostrar-ocultas">👁 Mostrar ${ocultasMapa.size} obra(s) oculta(s)</button></span>`
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
    });
}

function atualizarMapa() {
    if (!mapa) return;
    renderLegenda();
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    const bounds = [];
    obras
        .filter(o => o.latitude != null && o.longitude != null
            && !ocultasMapa.has(o.id) && !statusOcultosMapa.has(o.status))
        .forEach(o => {
            const st = STATUS_OBRA[o.status] || { cor: '#94a3b8', label: o.status };
            const m = L.circleMarker([o.latitude, o.longitude], {
                radius: 9, color: '#0f172a', weight: 2, fillColor: st.cor, fillOpacity: 1
            }).addTo(mapa);
            m.bindPopup(`<div style="font-size:.85rem;max-width:240px">
                <b>${fmtCodigo(o)} — ${esc(o.nome)}</b><br>
                ${st.label} · ${progressoObra(o)}% executado<br>
                ${fmtMoeda(o.valor_contratado)}<br>
                ${o.cliente ? 'Cliente: ' + esc(o.cliente.nome) + '<br>' : ''}
                <a href="agenda-logistica.html" style="color:#b45309">🧭 Rotear na Agenda</a>
            </div>`);
            marcadores.push(m);
            bounds.push([o.latitude, o.longitude]);
        });
    if (bounds.length === 1) mapa.setView(bounds[0], 15);
    else if (bounds.length > 1) mapa.fitBounds(bounds, { padding: [40, 40] });
}

// ============================================================
// MODAL DA OBRA
// ============================================================
async function carregarClientesSelect(selecionarId = null) {
    const { data, error } = await sb.from('hermo_clientes').select('id, nome, whatsapp').order('nome');
    if (error) { toast('Erro ao carregar clientes: ' + error.message, true); return; }
    const sel = $('ob-cliente');
    sel.innerHTML = '<option value="">— sem cliente —</option>';
    (data || []).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.nome} (${c.whatsapp})`;
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
}

function proximoNumero(ano) {
    const doAno = obras.filter(o => o.ano === ano);
    return doAno.length ? Math.max(...doAno.map(o => o.numero)) + 1 : 1;
}

async function abrirModalObra(obra) {
    obraEditando = obra || null;
    itensDraft = (obra?.itens || []).map(it => ({
        id: it.id,
        vigente: it.vigente !== false,
        proposta_id: it.proposta_id || null,
        substituido_por: it.substituido_por || null,
        created_at: it.created_at,
        sel: false,
        servico_id: it.servico_id,
        codigo: it.servico?.codigo || '?',
        descricao: it.servico?.descricao || '?',
        local_execucao: it.local_execucao || '',
        quantidade: num(it.quantidade) || 1,
        unidade: it.unidade || '',
        preco_unit: num(it.preco_unit),
        total: num(it.total),
        perc_executado: num(it.perc_executado),
        inicio_previsto: it.inicio_previsto || '',
        fim_previsto: it.fim_previsto || '',
        inicio_real: it.inicio_real || '',
        fim_real: it.fim_real || '',
        qtd_executada: it.qtd_executada != null ? num(it.qtd_executada) : null,
        alocacoes: it.alocacoes || []
    }));
    depsDraft = (obra?.dependencias || []).map(d => ({ item_id: d.item_id, depende_de_id: d.depende_de_id }));
    propostasDraft = [...(obra?.propostaIds || [])];
    localEscolhido = null;
    $('ob-local-info').style.display = 'none';

    $('ob-titulo-modal').textContent = obra ? `${fmtCodigo(obra)} — ${obra.nome}` : 'Nova obra';
    const anoAtual = new Date().getFullYear();
    $('ob-numero').value = obra ? obra.numero : proximoNumero(anoAtual);
    $('ob-ano').value = obra ? obra.ano : anoAtual;
    $('ob-nome').value = obra?.nome || '';
    $('ob-status').value = obra?.status || 'a_iniciar';
    $('ob-endereco').value = obra?.endereco || '';
    $('ob-inicio-prev').value = obra?.inicio_previsto || '';
    $('ob-prazo').value = obra?.prazo || '';
    $('ob-inicio-real').value = obra?.inicio_real || '';
    $('ob-conclusao').value = obra?.conclusao || '';
    $('ob-obs').value = obra?.observacoes || '';

    await carregarClientesSelect(obra?.cliente_id || null);
    renderPropostasDraft();
    renderItensDraft();
    renderCronograma();
    await carregarDiario();
    await carregarAnexosHerdados();

    $('ob-overlay').classList.add('aberto');
    $('ob-nome').focus();
}

function fecharModalObra() {
    $('ob-overlay').classList.remove('aberto');
    obraEditando = null;
    itensDraft = [];
    depsDraft = [];
    propostasDraft = [];
    diarioEntradas = [];
    localEscolhido = null;
}

// ---------- propostas associadas ----------
function renderPropostasDraft() {
    const cont = $('ob-props');
    if (propostasDraft.length === 0) {
        cont.innerHTML = '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Nenhuma proposta associada — obra avulsa.</div>';
        return;
    }
    cont.innerHTML = propostasDraft.map(id => {
        const p = propostasContratadas.find(x => x.id === id);
        if (!p) return `<div class="ob-item"><div class="txt">proposta não encontrada (pode ter saído de "contratada")</div></div>`;
        return `
        <div class="ob-item">
            <div class="txt"><b>${String(p.numero).padStart(4, '0')}/${p.ano}</b> — ${esc(p.titulo)}
                <small>${p.cliente?.nome ? esc(p.cliente.nome) + ' · ' : ''}${fmtMoeda(p.valor_total)} · ${(p.itens || []).length} item(ns)</small>
            </div>
            <a class="hermo-btn small ghost" href="propostas.html?editar=${p.id}" target="_blank" rel="noopener" title="Abrir proposta">↗</a>
        </div>`;
    }).join('');
}

function abrirAssociarPropostas() {
    // associações existentes aparecem marcadas E travadas (aditivo não se desfaz);
    // propostas que já pertencem a OUTRA obra ficam bloqueadas (1 proposta = 1 obra)
    $('op-lista').innerHTML = propostasContratadas.length === 0
        ? '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhuma proposta contratada disponível.</div>'
        : propostasContratadas.map(p => {
            const jaAssociada = propostasDraft.includes(p.id);
            const outraObra = !jaAssociada
                ? obras.find(o => o.id !== obraEditando?.id && (o.propostaIds || []).includes(p.id))
                : null;
            const travada = jaAssociada || !!outraObra;
            return `
            <label class="lc-item" style="${travada ? 'opacity:.65' : ''}">
                <input type="checkbox" data-op="${p.id}" ${jaAssociada ? 'checked' : ''} ${travada ? 'disabled' : ''} />
                <div class="txt"><b>${String(p.numero).padStart(4, '0')}/${p.ano}</b> — ${esc(p.titulo)}
                    <small>${p.cliente?.nome ? esc(p.cliente.nome) + ' · ' : ''}${fmtMoeda(p.valor_total)} · ${(p.itens || []).length} item(ns)${jaAssociada ? ' · ✔ já aplicada' : ''}${outraObra ? ` · 🚫 já pertence à obra ${fmtCodigo(outraObra)}` : ''}</small>
                </div>
            </label>`;
        }).join('');
    $('op-overlay').classList.add('aberto');
}

async function confirmarAssociarPropostas() {
    const marcadas = [...document.querySelectorAll('[data-op]:checked')].map(c => c.dataset.op);
    const novas = marcadas.filter(id => !propostasDraft.includes(id));
    $('op-overlay').classList.remove('aberto');
    if (novas.length === 0) { toast('Nenhuma proposta nova marcada.'); return; }
    if (!obraEditando?.id) {
        toast('Salve a obra antes de aplicar aditivos.', true);
        return;
    }
    if (!confirm(`Aplicar ${novas.length} aditivo(s)?\n\nOs serviços da(s) proposta(s) entram no escopo. ` +
        `Se um serviço equivalente já existir, o item novo passa a valer e o antigo vai para o histórico — nada é apagado. ` +
        `A associação não pode ser desfeita.`)) return;

    let aplicados = 0;
    for (const pid of novas) {
        const { error } = await sb.rpc('hermo_aplicar_aditivo', { p_obra: obraEditando.id, p_proposta: pid });
        if (error) {
            toast(`Erro ao aplicar aditivo: ${error.message}`, true);
            continue;
        }
        aplicados++;
        // cliente/endereço/nome herdados quando vazios
        const p = propostasContratadas.find(x => x.id === pid);
        if (p) {
            if (!$('ob-cliente').value && p.cliente_id) await carregarClientesSelect(p.cliente_id);
            if (!$('ob-endereco').value.trim() && p.endereco) {
                $('ob-endereco').value = p.endereco;
                if (p.latitude != null) {
                    localEscolhido = { lat: p.latitude, lng: p.longitude };
                    $('ob-local-info').style.display = '';
                }
            }
            if (!$('ob-nome').value.trim()) $('ob-nome').value = p.titulo;
        }
    }
    if (aplicados === 0) return;
    toast(`${aplicados} aditivo(s) aplicado(s) — escopo atualizado.`);
    // recarrega a obra fresca (escopo/valor mudaram no banco) mantendo o modal aberto
    await carregarTudo();
    const atualizada = obras.find(o => o.id === obraEditando.id);
    if (atualizada) await abrirModalObra(atualizada);
}

// ---------- histórico de aditivos ----------
function abrirHistorico() {
    const cont = $('oh-lista');
    if (itensDraft.length === 0) {
        cont.innerHTML = '<div style="color:var(--hermo-text-dim)">Escopo vazio — nenhum evento ainda.</div>';
    } else {
        const porProposta = new Map();
        itensDraft.forEach(i => {
            const chave = i.proposta_id || '__inicial__';
            const arr = porProposta.get(chave) || [];
            arr.push(i);
            porProposta.set(chave, arr);
        });
        cont.innerHTML = [...porProposta.entries()].map(([pid, itens]) => {
            const p = propostasContratadas.find(x => x.id === pid);
            const titulo = pid === '__inicial__'
                ? 'Escopo inicial (antes do controle de aditivos)'
                : `📄 Proposta ${p ? String(p.numero).padStart(4, '0') + '/' + p.ano + ' — ' + esc(p.titulo) : 'não encontrada'}`;
            const linhas = itens.map(i => {
                const substituto = i.substituido_por ? itensDraft.find(x => x.id === i.substituido_por) : null;
                return `<div style="padding-left:12px;${i.vigente === false ? 'opacity:.6' : ''}">
                    ${i.vigente === false ? '✖' : '✔'} <b>${esc(i.codigo)}</b> ${esc(i.descricao)}
                    — ${i.quantidade} ${esc(i.unidade || 'un')} × ${fmtMoeda(i.preco_unit)}
                    ${i.local_execucao ? ' · 📍 ' + esc(i.local_execucao) : ''}
                    ${i.vigente === false
                        ? `<span style="color:var(--hermo-warn)"> · substituído${substituto ? ` por aditivo (${substituto.quantidade} ${esc(substituto.unidade || 'un')} × ${fmtMoeda(substituto.preco_unit)})` : ''}</span>`
                        : ''}
                </div>`;
            }).join('');
            return `<div style="border:1px solid var(--hermo-border);border-radius:8px;padding:10px">
                <b>${titulo}</b>${linhas}</div>`;
        }).join('');
    }
    $('oh-overlay').classList.add('aberto');
}

// ---------- escopo ----------
function totalObraDraft() {
    return itensDraft.filter(i => i.vigente !== false).reduce((t, i) => t + num(i.total), 0);
}

function renderItensDraft() {
    const cont = $('ob-itens');
    const vigentes = itensDraft.filter(i => i.vigente !== false);
    if (vigentes.length === 0) {
        cont.innerHTML = '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Escopo vazio — aplique um aditivo (associe uma proposta contratada).</div>';
    } else {
        // escopo SOMENTE leitura (muda apenas via aditivo); só o % executado é editável
        cont.innerHTML = vigentes.map(i => {
            const idx = itensDraft.indexOf(i);
            const prop = propostasContratadas.find(p => p.id === i.proposta_id);
            const origem = prop ? `${String(prop.numero).padStart(4, '0')}/${prop.ano}` : (i.proposta_id ? 'proposta' : 'escopo inicial');
            return `
        <div class="ob-item">
            <div class="txt">
                <b>${esc(i.codigo)}</b> — ${esc(i.descricao)}
                <small>${i.local_execucao ? '📍 ' + esc(i.local_execucao) + ' · ' : ''}${i.quantidade} ${esc(i.unidade || 'un')} × ${fmtMoeda(i.preco_unit)} · <span style="color:var(--hermo-info)">📄 ${esc(origem)}</span></small>
            </div>
            <span class="valor">${fmtMoeda(i.total)}</span>
            <label style="font-size:.72rem;color:var(--hermo-text-dim)">%</label>
            <input class="perc" type="number" min="0" max="100" step="1" value="${i.perc_executado}" data-iperc="${idx}" />
        </div>`;
        }).join('');
    }
    atualizarProgressoETotal();

    cont.querySelectorAll('[data-iperc]').forEach(inp => inp.addEventListener('change', e => {
        const v = Math.max(0, Math.min(100, num(e.target.value)));
        itensDraft[parseInt(e.target.dataset.iperc)].perc_executado = v;
        e.target.value = v;
        atualizarProgressoETotal();
    }));
}

function atualizarProgressoETotal() {
    const totalV = totalObraDraft();
    const exec = itensDraft.filter(i => i.vigente !== false)
        .reduce((t, i) => t + num(i.total) * num(i.perc_executado) / 100, 0);
    const prog = totalV > 0 ? Math.round(exec / totalV * 100) : 0;
    $('ob-progresso-fill').style.width = prog + '%';
    $('ob-progresso-txt').textContent = prog + '%';
    $('ob-total').textContent = fmtMoeda(totalV);
}

// ============================================================
// CRONOGRAMA E ALOCAÇÕES
// ============================================================
function renderCronograma() {
    const salva = !!obraEditando;
    $('ob-crono-aviso').style.display = salva ? 'none' : '';
    const cont = $('ob-crono');
    if (!salva) { cont.innerHTML = ''; return; }
    const comId = itensDraft.filter(i => i.id && i.vigente !== false);
    if (comId.length === 0) {
        cont.innerHTML = '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Adicione serviços ao escopo e salve para programar.</div>';
        return;
    }
    recalcCadeiaDraft();
    cont.innerHTML = comId.map(i => {
        const idx = itensDraft.indexOf(i);
        const concluido = !!i.fim_real;
        const preds = predsDe(i.id);
        const iniAuto = preds.length > 0 || !!i.inicio_real;
        const chips = (i.alocacoes || []).map(a => {
            const nome = a.integrante?.apelido || a.integrante?.nome?.split(' ')[0] || '?';
            const per = a.data_inicio === a.data_fim
                ? a.data_inicio.split('-').reverse().slice(0, 2).join('/')
                : `${a.data_inicio.split('-').reverse().slice(0, 2).join('/')}–${a.data_fim.split('-').reverse().slice(0, 2).join('/')}`;
            const turno = a.turno === 'horario' ? `${(a.hora_inicio || '').slice(0, 5)}-${(a.hora_fim || '').slice(0, 5)}` : TURNO_LABEL[a.turno];
            const fora = i.inicio_previsto && i.fim_previsto
                && (a.data_fim < i.inicio_previsto || a.data_inicio > i.fim_previsto);
            return `<span class="chip" style="border-left-color:${a.equipe?.cor || 'var(--hermo-primary)'}"
                title="${esc(a.integrante?.nome || '')}${a.equipe ? ' · equipe ' + esc(a.equipe.nome) : ''}${fora ? ' · ⚠ fora do período previsto atual do serviço' : ''}">
                ${fora ? '⚠ ' : ''}${esc(nome)} · ${per} · ${turno}
                <button data-aloc-remover="${a.id}" title="Remover alocação">×</button>
            </span>`;
        }).join('');
        const excedente = itemExcedente(i);
        const badges =
            (concluido ? `<span class="ob-badge ok" title="Serviço finalizado">✓ concluído em ${fmtData(i.fim_real)}</span>` : '') +
            (excedente ? `<span class="ob-badge aditivo" title="A quantidade executada passou do contratado — gere um aditivo (associe uma nova proposta) para cobrir o excedente.">⚠ +${fmtQtd(num(i.qtd_executada) - num(i.quantidade))} ${esc(i.unidade || 'un')} acima do contratado — aditivo</span>` : '');
        const chipsDeps = preds.length
            ? `<div class="ob-deps">⛓ só inicia após concluir: ${preds.map(p =>
                `<b title="${esc(p.descricao)}">${esc(p.codigo)}${p.fim_real ? ' ✓' : ''}</b>`).join(', ')}</div>`
            : '';
        return `
        <div class="ob-crono-item ${concluido ? 'concluido' : ''}">
            <div class="linha1">
                <span class="nome-serv">${esc(i.codigo)} — ${esc(i.descricao)} ${badges}</span>
                <label style="font-size:.72rem;color:var(--hermo-text-dim)">previsto:</label>
                <input type="date" value="${i.inicio_previsto || ''}" data-crono-ini="${idx}"
                    ${(iniAuto || concluido) ? `disabled title="${i.inicio_real ? 'Definido pelo início real informado' : concluido ? 'Serviço concluído' : 'Definido automaticamente pela conclusão dos serviços prévios'}"` : ''} />
                <span style="color:var(--hermo-text-dim)">→</span>
                <input type="date" value="${i.fim_previsto || ''}" data-crono-fim="${idx}" ${concluido ? 'disabled title="Serviço concluído"' : ''} />
                <button class="hermo-btn small ghost" data-deps="${idx}" title="Este serviço só pode iniciar após a conclusão de quais serviços?">⛓ Depende${preds.length ? ` (${preds.length})` : ''}</button>
                <button class="hermo-btn small primary" data-alocar="${idx}">👷 Alocar</button>
            </div>
            ${chipsDeps}
            <div class="linha-real">
                <label>real:</label>
                <span>iniciou</span>
                <input type="date" value="${i.inicio_real || ''}" data-real-ini="${idx}" ${concluido ? 'disabled title="Serviço concluído"' : ''} />
                <span>· concluiu</span>
                <input type="date" value="${i.fim_real || ''}" data-real-fim="${idx}" />
                <span>· executado</span>
                <input type="number" class="qtd-exec" min="0" step="0.01" value="${i.qtd_executada ?? ''}" data-qtd-exec="${idx}" />
                <span>de ${fmtQtd(i.quantidade)} ${esc(i.unidade || 'un')}</span>
            </div>
            <div class="ob-aloc-chips">${chips || '<span style="font-size:.72rem;color:var(--hermo-text-dim)">ninguém alocado ainda</span>'}</div>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-crono-ini]').forEach(inp => inp.addEventListener('change', e => {
        itensDraft[parseInt(e.target.dataset.cronoIni)].inicio_previsto = e.target.value;
        renderCronograma();
    }));
    cont.querySelectorAll('[data-crono-fim]').forEach(inp => inp.addEventListener('change', e => {
        itensDraft[parseInt(e.target.dataset.cronoFim)].fim_previsto = e.target.value;
        renderCronograma();
    }));
    cont.querySelectorAll('[data-real-ini]').forEach(inp => inp.addEventListener('change', e => {
        itensDraft[parseInt(e.target.dataset.realIni)].inicio_real = e.target.value;
        renderCronograma();
        toast(e.target.value
            ? 'Início real informado — as datas da cadeia foram recalculadas (salve a obra para gravar).'
            : 'Início real removido — datas recalculadas (salve a obra para gravar).');
    }));
    cont.querySelectorAll('[data-real-fim]').forEach(inp => inp.addEventListener('change', e => {
        const item = itensDraft[parseInt(e.target.dataset.realFim)];
        if (e.target.value && item.inicio_real && e.target.value < item.inicio_real) {
            toast('A conclusão real não pode ser antes do início real.', true);
            e.target.value = item.fim_real || '';
            return;
        }
        item.fim_real = e.target.value;
        renderCronograma();
        toast(e.target.value
            ? 'Serviço marcado como concluído — dependentes recalculados (salve a obra para gravar).'
            : 'Conclusão real removida (salve a obra para gravar).');
    }));
    cont.querySelectorAll('[data-qtd-exec]').forEach(inp => inp.addEventListener('change', e => {
        const item = itensDraft[parseInt(e.target.dataset.qtdExec)];
        const bruto = e.target.value.trim();
        item.qtd_executada = bruto === '' ? null : Math.max(0, num(bruto));
        if (item.qtd_executada != null && num(item.quantidade) > 0) {
            item.perc_executado = Math.min(100, Math.round(item.qtd_executada / num(item.quantidade) * 1000) / 10);
        }
        renderItensDraft();
        renderCronograma();
        if (itemExcedente(item)) {
            toast(`⚠ ${item.codigo}: executado passou do contratado — gere um aditivo para cobrir o excedente.`, true);
        }
    }));
    cont.querySelectorAll('[data-deps]').forEach(b => b.addEventListener('click',
        () => abrirDepsModal(parseInt(b.dataset.deps))));
    cont.querySelectorAll('[data-alocar]').forEach(b => b.addEventListener('click',
        () => abrirAlocacaoModal(parseInt(b.dataset.alocar))));
    cont.querySelectorAll('[data-aloc-remover]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Remover esta alocação do cronograma?')) return;
        const { error } = await sb.from('hermo_alocacoes').delete().eq('id', b.dataset.alocRemover);
        if (error) { toast('Erro: ' + error.message, true); return; }
        itensDraft.forEach(i => { i.alocacoes = (i.alocacoes || []).filter(a => a.id !== b.dataset.alocRemover); });
        sincronizarAlocacoesNaLista();
        renderCronograma();
        toast('Alocação removida.');
    }));
}

// ---------- dependências entre serviços (od) ----------
function abrirDepsModal(itemIndex) {
    depItemIndex = itemIndex;
    const item = itensDraft[itemIndex];
    const bloqueados = descendentesDe(item.id); // marcá-los criaria ciclo
    const atuais = new Set(depsDraft.filter(d => d.item_id === item.id).map(d => d.depende_de_id));
    $('od-titulo').textContent = `Dependências — ${item.codigo} ${item.descricao}`;
    const outros = itensDraft.filter(i => i.id && i.vigente !== false && i.id !== item.id);
    $('od-lista').innerHTML = outros.length === 0
        ? '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Não há outros serviços no escopo.</div>'
        : outros.map(i => {
            const ciclo = bloqueados.has(i.id);
            return `
            <label class="lc-item" style="${ciclo ? 'opacity:.5' : ''}">
                <input type="checkbox" data-od="${i.id}" ${atuais.has(i.id) ? 'checked' : ''} ${ciclo ? 'disabled' : ''} />
                <div class="txt"><b>${esc(i.codigo)}</b> — ${esc(i.descricao)}
                    <small>${i.fim_real
                        ? '✓ concluído em ' + fmtData(i.fim_real)
                        : (i.fim_previsto ? 'fim previsto ' + fmtData(i.fim_previsto) : 'sem data prevista ainda')}${ciclo ? ' · ⚠ já depende deste serviço (criaria ciclo)' : ''}</small>
                </div>
            </label>`;
        }).join('');
    $('od-transpor').checked = false;
    $('od-overlay').classList.add('aberto');
}

async function confirmarDeps() {
    const item = itensDraft[depItemIndex];
    if (!item?.id || !obraEditando?.id) return;
    const marcados = [...document.querySelectorAll('[data-od]:checked')].map(c => c.dataset.od);
    const transpor = $('od-transpor').checked;
    const btn = $('od-confirmar');
    btn.disabled = true;
    try {
        // grava antes as edições do modal (datas/percentuais) para o recálculo usar o que está na tela
        const oid = await salvarObraCore({ silencioso: true });
        if (!oid) return;
        const { data, error } = await sb.rpc('hermo_salvar_dependencias',
            { p_item: item.id, p_depende: marcados, p_transpor: transpor });
        if (error) throw error;
        $('od-overlay').classList.remove('aberto');
        let msg = marcados.length
            ? 'Dependências salvas — datas da cadeia recalculadas.'
            : 'Dependências removidas.';
        if (transpor && marcados.length) {
            if (data?.sem_datas) {
                msg += ' O serviço ainda não tem data prevista, então ninguém foi transposto.';
            } else {
                msg += ` ${data?.transpostos ?? 0} alocação(ões) transposta(s) dos serviços prévios.`;
            }
            if ((data?.ja_alocados || []).length) {
                msg += ` Já estavam alocados neste serviço: ${data.ja_alocados.join(', ')}.`;
            }
            if ((data?.pulados || []).length) {
                msg += ` Pulados por conflito de agenda: ${data.pulados.join(', ')}.`;
            }
        }
        toast(msg);
        await carregarTudo();
        const atualizada = obras.find(o => o.id === obraEditando?.id);
        if (atualizada) await abrirModalObra(atualizada);
    } catch (e) {
        toast('Erro ao salvar dependências: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ---------- alocação (oa) ----------
function abrirAlocacaoModal(itemIndex) {
    alocItemIndex = itemIndex;
    const item = itensDraft[itemIndex];
    oaMarcados = new Set();
    $('oa-titulo').textContent = `Alocar — ${item.codigo} ${item.descricao}`;
    const selEq = $('oa-equipe');
    selEq.innerHTML = '<option value="">— escolher individualmente —</option>';
    equipes.forEach(q => {
        const o = document.createElement('option');
        o.value = q.id;
        o.textContent = `${q.nome} (${q.membroIds.length} membros)`;
        selEq.appendChild(o);
    });
    $('oa-inicio').value = item.inicio_previsto || hoje();
    $('oa-fim').value = item.fim_previsto || item.inicio_previsto || hoje();
    $('oa-turno').value = 'dia';
    $('oa-horas-wrap').style.display = 'none';
    $('oa-conflitos').style.display = 'none';
    renderOaIntegrantes();
    $('oa-overlay').classList.add('aberto');
}

function renderOaIntegrantes() {
    $('oa-integrantes').innerHTML = integrantes.filter(i => i.ativo).map(i => `
        <label class="lc-item">
            <input type="checkbox" data-oa="${i.id}" ${oaMarcados.has(i.id) ? 'checked' : ''} />
            <div class="txt"><b>${esc(i.nome)}</b>${i.apelido ? ' (' + esc(i.apelido) + ')' : ''}
                <small>${esc(i.funcao?.nome || 'sem função')}</small>
            </div>
        </label>`).join('') || '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhum integrante ativo — cadastre em Integrantes e Equipes.</div>';
    $('oa-integrantes').querySelectorAll('[data-oa]').forEach(c => c.addEventListener('change', e => {
        if (e.target.checked) oaMarcados.add(e.target.dataset.oa);
        else oaMarcados.delete(e.target.dataset.oa);
    }));
}

function minutosTurno(turno, hi, hf) {
    if (turno === 'dia') return [420, 1020];
    if (turno === 'manha') return [420, 720];
    if (turno === 'tarde') return [780, 1020];
    const m = s => { const [h, mi] = String(s || '0:0').split(':').map(Number); return h * 60 + mi; };
    return [m(hi), m(hf)];
}

function periodosConflitam(a, b) {
    if (a.data_fim < b.data_inicio || b.data_fim < a.data_inicio) return false;
    const [ai, af] = minutosTurno(a.turno, a.hora_inicio, a.hora_fim);
    const [bi, bf] = minutosTurno(b.turno, b.hora_inicio, b.hora_fim);
    return Math.max(ai, bi) < Math.min(af, bf);
}

async function confirmarAlocacao() {
    const ids = [...oaMarcados];
    if (ids.length === 0) { toast('Marque ao menos um integrante (ou escolha uma equipe).', true); return; }
    const inicio = $('oa-inicio').value;
    const fim = $('oa-fim').value;
    if (!inicio || !fim) { toast('Informe o período (de/até).', true); return; }
    if (fim < inicio) { toast('A data final não pode ser antes da inicial.', true); return; }
    const turno = $('oa-turno').value;
    const hi = $('oa-hora-ini').value || null;
    const hf = $('oa-hora-fim').value || null;
    if (turno === 'horario' && (!hi || !hf || hf <= hi)) { toast('Informe um horário válido (início < fim).', true); return; }

    const btn = $('oa-confirmar');
    btn.disabled = true;
    try {
        const nova = { data_inicio: inicio, data_fim: fim, turno, hora_inicio: hi, hora_fim: hf };
        // busca compromissos existentes dos integrantes no período (todas as obras) + ausências
        const [aloc, aus] = await Promise.all([
            sb.from('hermo_alocacoes')
                .select('*, integrante:hermo_integrantes(id, nome), obra_servico:hermo_obra_servicos(id, servico:hermo_servicos(codigo, descricao), obra:hermo_obras(nome, numero, ano))')
                .in('integrante_id', ids)
                .lte('data_inicio', fim)
                .gte('data_fim', inicio),
            sb.from('hermo_ausencias')
                .select('*, integrante:hermo_integrantes(id, nome)')
                .in('integrante_id', ids)
                .lte('data_inicio', fim)
                .gte('data_fim', inicio)
        ]);
        if (aloc.error || aus.error) throw (aloc.error || aus.error);

        // BLOQUEIO de conflito: ninguém pode estar em dois lugares no mesmo período
        const conflitos = [];
        (aloc.data || []).forEach(a => {
            if (periodosConflitam(nova, a)) {
                const ob = a.obra_servico?.obra;
                conflitos.push(`• ${a.integrante?.nome}: já alocado em "${ob ? 'OB-' + String(ob.numero).padStart(4, '0') + '/' + ob.ano + ' — ' + ob.nome : 'outra obra'}" (${a.obra_servico?.servico?.codigo || ''} ${a.obra_servico?.servico?.descricao || ''}), ${a.data_inicio} a ${a.data_fim}, ${a.turno === 'horario' ? (a.hora_inicio || '').slice(0, 5) + '-' + (a.hora_fim || '').slice(0, 5) : TURNO_LABEL[a.turno]}`);
            }
        });
        (aus.data || []).forEach(a => {
            if (periodosConflitam(nova, a)) {
                conflitos.push(`• ${a.integrante?.nome}: ausência registrada (${a.tipo}) de ${a.data_inicio} a ${a.data_fim}`);
            }
        });
        if (conflitos.length > 0) {
            const box = $('oa-conflitos');
            box.style.display = '';
            box.textContent = '🚫 Conflito de agenda — ajuste o período ou os integrantes:\n' + conflitos.join('\n');
            return;
        }

        const equipeSel = $('oa-equipe').value || null;
        const equipe = equipes.find(q => q.id === equipeSel);
        const linhas = ids.map(intId => ({
            obra_servico_id: itensDraft[alocItemIndex].id,
            integrante_id: intId,
            // etiqueta de equipe só para quem realmente é membro dela
            equipe_id: (equipe && equipe.membroIds.includes(intId)) ? equipeSel : null,
            data_inicio: inicio,
            data_fim: fim,
            turno,
            hora_inicio: turno === 'horario' ? hi : null,
            hora_fim: turno === 'horario' ? hf : null
        }));
        const { data: inseridas, error } = await sb.from('hermo_alocacoes')
            .insert(linhas)
            .select('*, integrante:hermo_integrantes(id, nome, apelido), equipe:hermo_equipes(id, nome, cor)');
        if (error) throw error;

        // proteção contra corrida entre sessões: re-verifica após inserir; se outra aba
        // criou um conflito na mesma janela, desfaz esta alocação e mostra o conflito
        const idsInseridos = (inseridas || []).map(a => a.id);
        const { data: recheck } = await sb.from('hermo_alocacoes')
            .select('id, integrante_id, data_inicio, data_fim, turno, hora_inicio, hora_fim, integrante:hermo_integrantes(nome)')
            .in('integrante_id', ids)
            .lte('data_inicio', fim)
            .gte('data_fim', inicio);
        const corrida = (recheck || []).filter(a =>
            !idsInseridos.includes(a.id) &&
            (inseridas || []).some(n => n.integrante_id === a.integrante_id && periodosConflitam(n, a)));
        if (corrida.length > 0) {
            await sb.from('hermo_alocacoes').delete().in('id', idsInseridos);
            const box = $('oa-conflitos');
            box.style.display = '';
            box.textContent = '🚫 Outra sessão alocou ' +
                [...new Set(corrida.map(a => a.integrante?.nome))].join(', ') +
                ' neste período agora há pouco — a alocação foi desfeita. Ajuste e tente de novo.';
            return;
        }

        itensDraft[alocItemIndex].alocacoes = [...(itensDraft[alocItemIndex].alocacoes || []), ...(inseridas || [])];
        sincronizarAlocacoesNaLista();
        $('oa-overlay').classList.remove('aberto');
        renderCronograma();
        toast(`${ids.length} alocação(ões) criadas — sem conflitos.`);
    } catch (e) {
        toast('Erro ao alocar: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

/** Reflete as alocações do draft na lista `obras` — cancelar/reabrir não mostra chips fantasma. */
function sincronizarAlocacoesNaLista() {
    if (!obraEditando?.id) return;
    const obra = obras.find(o => o.id === obraEditando.id);
    if (!obra) return;
    itensDraft.filter(i => i.id).forEach(i => {
        const item = obra.itens.find(x => x.id === i.id);
        if (item) item.alocacoes = i.alocacoes || [];
    });
}

// ============================================================
// DIÁRIO
// ============================================================
async function carregarDiario() {
    const salva = !!obraEditando;
    $('ob-diario-aviso').style.display = salva ? 'none' : '';
    $('ob-diario-form').style.display = salva ? '' : 'none';
    diarioEntradas = [];
    if (!salva) { $('ob-diario').innerHTML = ''; return; }
    const { data, error } = await sb.from('hermo_obra_diario')
        .select('*').eq('obra_id', obraEditando.id).order('data', { ascending: false }).limit(60);
    if (error) { toast('Erro ao carregar diário: ' + error.message, true); return; }
    diarioEntradas = data || [];
    await carregarAnexosDiario();
}

let anexosDiario = [];   // anexos de todas as entradas carregadas
let diarioUploadInput = null;
let diarioUploadAlvo = null;

function renderDiario() {
    $('ob-diario').innerHTML = diarioEntradas.length === 0
        ? '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Nenhum registro ainda.</div>'
        : diarioEntradas.map(d => `
            <div class="entrada">
                ${esc(d.texto)}<small>${fmtDataHora(d.data)}</small>
                <div class="anx-galeria" data-diario-galeria="${d.id}" style="margin-top:6px"></div>
                <button class="hermo-btn small ghost" data-diario-anexo="${d.id}" style="margin-top:4px">📎 Anexar</button>
            </div>`).join('');
    // galerias por entrada
    diarioEntradas.forEach(d => {
        const cont = document.querySelector(`[data-diario-galeria="${d.id}"]`);
        const doItem = anexosDiario.filter(a => a.diario_id === d.id);
        if (doItem.length === 0) { if (cont) cont.innerHTML = ''; return; }
        renderGaleria(cont, doItem, {
            podeExcluir: true,
            aoExcluir: async a => { if (await excluirAnexo(a)) await carregarAnexosDiario(); }
        });
    });
    // upload por entrada (um input escondido compartilhado)
    if (!diarioUploadInput) {
        diarioUploadInput = document.createElement('input');
        diarioUploadInput.type = 'file';
        diarioUploadInput.multiple = true;
        diarioUploadInput.style.display = 'none';
        document.body.appendChild(diarioUploadInput);
        diarioUploadInput.addEventListener('change', async () => {
            if (!diarioUploadAlvo || diarioUploadInput.files.length === 0) return;
            let ok = 0;
            for (const f of diarioUploadInput.files) {
                const r = await uploadAnexo({ tipo_ref: 'diario', diario_id: diarioUploadAlvo }, f);
                if (r) ok++;
            }
            diarioUploadInput.value = '';
            if (ok > 0) toast(`${ok} anexo(s) enviado(s).`);
            await carregarAnexosDiario();
        });
    }
    $('ob-diario').querySelectorAll('[data-diario-anexo]').forEach(b => b.addEventListener('click', () => {
        diarioUploadAlvo = b.dataset.diarioAnexo;
        diarioUploadInput.click();
    }));
}

async function carregarAnexosDiario() {
    anexosDiario = diarioEntradas.length
        ? await listarAnexos({ diarioIds: diarioEntradas.map(d => d.id) })
        : [];
    renderDiario();
}

/** Anexos herdados: das propostas associadas e das visitas dessas propostas. */
async function carregarAnexosHerdados() {
    const cont = $('ob-anexos-herdados');
    if (propostasDraft.length === 0) {
        cont.innerHTML = '<div style="font-size:.76rem;color:var(--hermo-text-dim)">Associe propostas para ver os anexos delas (e das visitas ligadas a elas).</div>';
        return;
    }
    const { data: pv } = await sb.from('hermo_proposta_visitas')
        .select('visita_id').in('proposta_id', propostasDraft);
    const visitaIds = [...new Set((pv || []).map(x => x.visita_id))];
    const anexos = await listarAnexos({ propostaIds: propostasDraft, visitaIds });
    renderGaleria(cont, anexos, {
        podeExcluir: false,
        rotuloOrigem: a => a.proposta_id ? 'da proposta' : 'da visita'
    });
}

async function registrarDiario() {
    const texto = $('ob-diario-texto').value.trim();
    if (!texto) { toast('Escreva o registro.', true); return; }
    const { data, error } = await sb.from('hermo_obra_diario')
        .insert({ obra_id: obraEditando.id, texto }).select().single();
    if (error) { toast('Erro ao registrar: ' + error.message, true); return; }
    diarioEntradas.unshift(data);
    $('ob-diario-texto').value = '';
    renderDiario();
}

// ============================================================
// SALVAR OBRA
// ============================================================
/** Valida e grava a obra via RPC. Retorna o id gravado ou null (erros já mostrados em toast). */
async function salvarObraCore({ silencioso = false } = {}) {
    const numero = parseInt($('ob-numero').value);
    const ano = parseInt($('ob-ano').value);
    const nome = $('ob-nome').value.trim();
    if (!numero || numero < 1 || numero > 9999) { toast('Número inválido (1 a 9999).', true); return null; }
    if (!ano || ano < 2000 || ano > 2100) { toast('Ano inválido.', true); return null; }
    if (!nome) { toast('Nome da obra é obrigatório.', true); return null; }
    const dup = obras.find(o => o.numero === numero && o.ano === ano && o.id !== obraEditando?.id);
    if (dup) { toast(`Já existe a obra ${fmtCodigo(dup)} — escolha outro número.`, true); return null; }

    try {
        const endereco = $('ob-endereco').value.trim();
        let lat = obraEditando?.latitude ?? null;
        let lng = obraEditando?.longitude ?? null;
        if (localEscolhido) {
            lat = localEscolhido.lat; lng = localEscolhido.lng;
        } else if (endereco && (!obraEditando || obraEditando.endereco !== endereco || lat == null)) {
            const geo = await geocodificar(endereco);
            lat = geo?.lat ?? null;
            lng = geo?.lng ?? null;
        } else if (!endereco) {
            lat = null; lng = null;
        }

        const payload = {
            id: obraEditando?.id || null,
            numero, ano, nome,
            cliente_id: $('ob-cliente').value || null,
            status: $('ob-status').value,
            endereco: endereco || null,
            latitude: lat,
            longitude: lng,
            inicio_previsto: $('ob-inicio-prev').value || null,
            prazo: $('ob-prazo').value || null,
            inicio_real: $('ob-inicio-real').value || null,
            conclusao: $('ob-conclusao').value || null,
            observacoes: $('ob-obs').value.trim() || null,
            // escopo é imutável aqui — só CRONOGRAMA e EXECUÇÃO dos itens existentes são atualizados
            itens: itensDraft.filter(i => i.id).map(i => ({
                id: i.id,
                perc_executado: i.perc_executado,
                inicio_previsto: i.inicio_previsto || null,
                fim_previsto: i.fim_previsto || null,
                inicio_real: i.inicio_real || null,
                fim_real: i.fim_real || null,
                qtd_executada: i.qtd_executada != null ? String(i.qtd_executada) : null
            }))
        };
        const { data: oid, error } = await sb.rpc('hermo_salvar_obra', { p: payload });
        if (error) throw error;
        if (!obraEditando && oid) obraEditando = { id: oid };
        return oid || obraEditando?.id || null;
    } catch (e) {
        if ((e.code || '') === '23505') toast('Já existe uma obra com esse número/ano.', true);
        else toast('Erro ao salvar obra: ' + e.message, true);
        return null;
    }
}

async function salvarObra() {
    const btn = $('ob-salvar');
    btn.disabled = true;
    try {
        const eraEdicao = !!obraEditando;
        const oid = await salvarObraCore();
        if (!oid) return;
        toast(eraEdicao ? 'Obra atualizada.' : 'Obra criada — reabra o card para programar o cronograma.');
        fecharModalObra();
        await carregarTudo();
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// GEOCODE / MINI-MAPA
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
    $('om-overlay').classList.add('aberto');
    omPendente = localEscolhido
        || (obraEditando?.latitude != null ? { lat: obraEditando.latitude, lng: obraEditando.longitude } : null);
    const centro = omPendente ? [omPendente.lat, omPendente.lng] : [-8.0476, -34.877];
    if (!omMapa) {
        omMapa = L.map('om-mapa').setView(centro, omPendente ? 16 : 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 19
        }).addTo(omMapa);
        omMapa.on('click', e => {
            omPendente = { lat: e.latlng.lat, lng: e.latlng.lng };
            posicionarOmMarcador();
            $('om-confirmar').disabled = false;
        });
    } else {
        omMapa.setView(centro, omPendente ? 16 : 12);
    }
    posicionarOmMarcador();
    $('om-confirmar').disabled = !omPendente;
    setTimeout(() => omMapa.invalidateSize(), 150);
}

function posicionarOmMarcador() {
    if (omMarcador) { omMapa.removeLayer(omMarcador); omMarcador = null; }
    if (omPendente) omMarcador = L.marker([omPendente.lat, omPendente.lng]).addTo(omMapa);
}

async function confirmarLocal() {
    if (!omPendente) return;
    localEscolhido = omPendente;
    $('ob-local-info').style.display = '';
    $('om-overlay').classList.remove('aberto');
    if (!$('ob-endereco').value.trim()) {
        try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 6000);
            const resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${localEscolhido.lat}&lon=${localEscolhido.lng}`,
                { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
            clearTimeout(t);
            if (resp.ok) {
                const j = await resp.json();
                if (j.display_name) $('ob-endereco').value = j.display_name;
            }
        } catch (e) {}
    }
    toast('Local definido pelo mapa.');
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('btn-nova').addEventListener('click', () => abrirModalObra(null));

$('btn-sel-todas').addEventListener('click', () => {
    KANBAN_ORDEM.filter(st => !colunasOcultas[st])
        .forEach(st => obrasDaColuna(st).forEach(o => selecionadas.add(o.id)));
    renderLista();
    renderSelbar();
});
$('btn-sel-limpar').addEventListener('click', () => { selecionadas.clear(); renderLista(); renderSelbar(); });
$('btn-sel-ocultar').addEventListener('click', () => {
    if (selecionadas.size === 0) return;
    selecionadas.forEach(id => ocultasMapa.add(id));
    salvarOcultasMapa(); atualizarMapa(); renderLista();
    toast(`${selecionadas.size} obra(s) oculta(s) do mapa.`);
});
$('btn-sel-mostrar').addEventListener('click', () => {
    if (selecionadas.size === 0) return;
    selecionadas.forEach(id => ocultasMapa.delete(id));
    salvarOcultasMapa(); atualizarMapa(); renderLista();
    toast(`${selecionadas.size} obra(s) de volta ao mapa.`);
});
$('btn-sel-excluir').addEventListener('click', () => excluirObras([...selecionadas]));

// modal obra
$('ob-fechar').addEventListener('click', fecharModalObra);
$('ob-cancelar').addEventListener('click', fecharModalObra);
ligarFecharPorBackdrop($('ob-overlay'), fecharModalObra);
$('ob-salvar').addEventListener('click', salvarObra);
$('ob-btn-mapa').addEventListener('click', abrirModalLocal);
$('ob-btn-novo-cliente').addEventListener('click', () =>
    abrirModalCliente(null, c => carregarClientesSelect(c.id)));
$('ob-btn-editar-cliente').addEventListener('click', async () => {
    const id = $('ob-cliente').value;
    if (!id) { toast('Selecione um cliente para editar.', true); return; }
    const { data, error } = await sb.from('hermo_clientes').select('*').eq('id', id).single();
    if (error) { toast('Erro: ' + error.message, true); return; }
    abrirModalCliente(data, c => carregarClientesSelect(c.id));
});

// escopo imutável: só o histórico e os aditivos
$('ob-btn-historico').addEventListener('click', abrirHistorico);
$('oh-fechar').addEventListener('click', () => $('oh-overlay').classList.remove('aberto'));
$('oh-fechar2').addEventListener('click', () => $('oh-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('oh-overlay'), () => $('oh-overlay').classList.remove('aberto'));
$('ob-btn-propostas').addEventListener('click', abrirAssociarPropostas);

$('op-fechar').addEventListener('click', () => $('op-overlay').classList.remove('aberto'));
$('op-cancelar').addEventListener('click', () => $('op-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('op-overlay'), () => $('op-overlay').classList.remove('aberto'));
$('op-confirmar').addEventListener('click', confirmarAssociarPropostas);

$('od-fechar').addEventListener('click', () => $('od-overlay').classList.remove('aberto'));
$('od-cancelar').addEventListener('click', () => $('od-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('od-overlay'), () => $('od-overlay').classList.remove('aberto'));
$('od-confirmar').addEventListener('click', confirmarDeps);

$('oa-fechar').addEventListener('click', () => $('oa-overlay').classList.remove('aberto'));
$('oa-cancelar').addEventListener('click', () => $('oa-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('oa-overlay'), () => $('oa-overlay').classList.remove('aberto'));
$('oa-confirmar').addEventListener('click', confirmarAlocacao);
$('oa-turno').addEventListener('change', () => {
    $('oa-horas-wrap').style.display = $('oa-turno').value === 'horario' ? '' : 'none';
});
$('oa-equipe').addEventListener('change', () => {
    const q = equipes.find(x => x.id === $('oa-equipe').value);
    if (q) {
        oaMarcados = new Set(q.membroIds.filter(id => integrantes.find(i => i.id === id)?.ativo));
        renderOaIntegrantes();
        toast(`Equipe "${q.nome}" marcada (${oaMarcados.size} ativos).`);
    }
});

$('om-fechar').addEventListener('click', () => $('om-overlay').classList.remove('aberto'));
$('om-cancelar').addEventListener('click', () => $('om-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('om-overlay'), () => $('om-overlay').classList.remove('aberto'));
$('om-confirmar').addEventListener('click', confirmarLocal);

$('ob-btn-diario').addEventListener('click', registrarDiario);
$('ob-diario-texto').addEventListener('keydown', e => { if (e.key === 'Enter') registrarDiario(); });

// boot (+ ?editar=ID)
iniciarMapa();
carregarTudo().then(() => {
    const id = new URLSearchParams(window.location.search).get('editar');
    if (id) {
        const o = obras.find(x => x.id === id);
        if (o) abrirModalObra(o);
    }
});
