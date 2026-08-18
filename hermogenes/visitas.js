// visitas.js — Página de VISITAS da área Hermogenes
import {
    sb, STATUS_VISITA, toast, fmtDataHora, inputParaISO, isoParaInput,
    ligarFecharPorBackdrop, esc, fmtMoeda
} from './hermo-common.js';
import { abrirModalCliente } from './hermo-cliente-modal.js';

// ---------- Estado ----------
let visitas = [];
let servicosCatalogo = [];
let selecionadas = new Set();
let visitaEditando = null;        // registro em edição (ou null = nova)
let servicosDaVisita = [];        // lista de trabalho do modal de visita
let subEditIndex = null;          // índice em servicosDaVisita sendo editado no sub-modal
let mapa = null;
let marcadores = [];
let localEscolhido = null;   // {lat,lng} definido pelo mini-mapa do modal
let mpMapa = null;           // Leaflet do modal de escolha de local
let mpMarcador = null;
let mpPendente = null;       // clique ainda não confirmado
let visitaPropostas = new Map(); // visita_id -> [propostas associadas] (trava status)
let statusTravado = false;   // visita do modal atual está associada a proposta?

const $ = id => document.getElementById(id);

const fmtCodigoProposta = p => `${String(p.numero).padStart(4, '0')}/${p.ano}`;

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [v, s, pv] = await Promise.all([
        sb.from('hermo_visitas')
            .select(`*,
                cliente:hermo_clientes(id, nome, whatsapp),
                servicos:hermo_visita_servicos(id, servico_id, local_execucao, quantidade, unidade,
                    servico:hermo_servicos(id, codigo, descricao))`)
            .order('created_at', { ascending: false }),
        sb.from('hermo_servicos').select('*, precos:hermo_servico_precos(preco_final, aliquota)').order('codigo'),
        sb.from('hermo_proposta_visitas').select('visita_id, proposta:hermo_propostas(id, numero, ano, titulo)')
    ]);
    if (v.error) { toast('Erro ao carregar visitas: ' + v.error.message, true); return; }
    if (s.error) { toast('Erro ao carregar serviços: ' + s.error.message, true); return; }
    visitas = v.data || [];
    // visita_id -> propostas associadas (trava o status na página de Visitas)
    visitaPropostas = new Map();
    if (pv.error) {
        toast('Aviso: não consegui verificar as propostas associadas — a trava de status pode não aparecer.', true);
    } else {
        (pv.data || []).forEach(l => {
            if (!l.proposta) return;
            const arr = visitaPropostas.get(l.visita_id) || [];
            arr.push(l.proposta);
            visitaPropostas.set(l.visita_id, arr);
        });
    }
    servicosCatalogo = (s.data || []).map(x => ({
        ...x,
        precos: Array.isArray(x.precos) ? x.precos[0] || null : x.precos
    }));
    // descarta ocultações de visitas que não existem mais
    ocultasMapa = new Set([...ocultasMapa].filter(id => visitas.some(x => x.id === id)));
    salvarOcultasMapa();
    selecionadas.clear();
    renderResumo();
    renderLista();
    renderSelbar();
    atualizarMapa();
    geocodificarPendentes();
}

async function carregarClientesSelect(selecionarId = null) {
    const { data, error } = await sb.from('hermo_clientes').select('id, nome, whatsapp').order('nome');
    if (error) { toast('Erro ao carregar clientes: ' + error.message, true); return; }
    const sel = $('mv-cliente');
    sel.innerHTML = '<option value="">— sem cliente associado —</option>';
    (data || []).forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.nome} (${c.whatsapp})`;
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
}

// ============================================================
// RESUMO INTELIGENTE
// ============================================================
function renderResumo() {
    const agora = new Date();
    const cont = Object.fromEntries(Object.keys(STATUS_VISITA).map(k => [k, 0]));
    visitas.forEach(v => { if (cont[v.status] !== undefined) cont[v.status]++; });

    const marcadas = visitas.filter(v => v.status === 'marcada' && v.data_visita);
    const futuras = marcadas
        .filter(v => new Date(v.data_visita) >= agora)
        .sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
    const atrasadas = marcadas.filter(v => new Date(v.data_visita) < agora);

    let destaque;
    if (atrasadas.length > 0) {
        destaque = `⚠️ <b>${atrasadas.length}</b> visita(s) marcada(s) com data já passada — conclua ou remarque.`;
    } else if (futuras.length > 0) {
        const p = futuras[0];
        destaque = `📍 Próxima visita: <b>${esc(fmtDataHora(p.data_visita))}</b> — ${esc(p.endereco)}` +
            (p.cliente ? ` (${esc(p.cliente.nome)})` : '');
    } else if (cont.pendente_marcacao > 0) {
        destaque = `🕐 Nenhuma visita futura marcada. Há <b>${cont.pendente_marcacao}</b> pendente(s) de marcação.`;
    } else {
        destaque = `✅ Nenhuma visita aguardando ação.`;
    }

    $('resumo').innerHTML = `
        <div class="stat"><div class="num">${visitas.length}</div><div class="lbl">Total</div></div>
        <div class="stat s-marcada"><div class="num">${cont.marcada}</div><div class="lbl">Marcadas</div></div>
        <div class="stat s-pendente"><div class="num">${cont.pendente_marcacao}</div><div class="lbl">Pend. marcação</div></div>
        <div class="stat s-concluida"><div class="num">${cont.concluida}</div><div class="lbl">Concluídas</div></div>
        <div class="stat s-pendencias"><div class="num">${cont.concluida_pendencias}</div><div class="lbl">C/ pendências</div></div>
        <div class="stat s-desistiu"><div class="num">${cont.desistiu}</div><div class="lbl">Desistiram</div></div>
        <div class="stat destaque"><div class="num">${destaque}</div></div>`;
}

// ============================================================
// QUADRO KANBAN (5 listas por status)
// ============================================================
const KANBAN_ORDEM = ['pendente_marcacao', 'marcada', 'concluida_pendencias', 'concluida', 'desistiu'];
let buscaColuna = {};   // status -> texto da busca daquela lista
let colunasOcultas = lerLS('hermo_kanban_ocultas', {});
let colunasLarguras = lerLS('hermo_kanban_larguras', {});
let larguraObserver = null;
// visibilidade no MAPA (persistida no navegador)
let ocultasMapa = new Set(lerLS('hermo_mapa_ocultas', []));
let statusOcultosMapa = new Set(lerLS('hermo_mapa_status_ocultos', []));

function salvarOcultasMapa() {
    try {
        localStorage.setItem('hermo_mapa_ocultas', JSON.stringify([...ocultasMapa]));
        localStorage.setItem('hermo_mapa_status_ocultos', JSON.stringify([...statusOcultosMapa]));
    } catch (e) {}
}

function lerLS(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) || padrao; }
    catch (e) { return padrao; }
}

function visitasDaColuna(status) {
    const q = (buscaColuna[status] || '').trim().toLowerCase();
    let lista = visitas.filter(v => v.status === status);
    if (q) {
        lista = lista.filter(v =>
            (v.endereco || '').toLowerCase().includes(q) ||
            (v.cliente?.nome || '').toLowerCase().includes(q) ||
            (v.problema || '').toLowerCase().includes(q));
    }
    lista.sort((a, b) => {
        const da = a.data_visita ? new Date(a.data_visita).getTime() : 0;
        const db = b.data_visita ? new Date(b.data_visita).getTime() : 0;
        // marcadas: mais próxima primeiro; demais: mais recente primeiro
        return status === 'marcada' ? da - db : db - da;
    });
    return lista;
}

function cardMini(v) {
    const servN = (v.servicos || []).length;
    // resumo (somente leitura) dos serviços com preço estimado, no tooltip e no rodapé se couber
    let estTotal = 0, temPreco = false;
    const servResumo = (v.servicos || []).map(sv => {
        const cat = servicosCatalogo.find(x => x.id === sv.servico_id);
        const preco = cat?.precos?.preco_final;
        const qtd = (sv.quantidade != null && sv.quantidade !== '') ? Number(sv.quantidade) : null;
        if (preco && qtd) { estTotal += preco * qtd; temPreco = true; }
        return `${cat?.codigo || '?'} ${cat?.descricao || ''}` +
            (preco ? ` — ${fmtMoeda(preco)}/${cat.unidade || 'un'}` : '') +
            (qtd ? ` × ${qtd}` : '');
    }).join('\n');
    return `
    <div class="kb-card ${selecionadas.has(v.id) ? 'selecionado' : ''}" data-id="${v.id}">
        <div class="kb-l1">
            <input type="checkbox" class="check" data-check="${v.id}" ${selecionadas.has(v.id) ? 'checked' : ''} />
            <span class="kb-end">${esc(v.endereco)}</span>
        </div>
        ${v.cliente ? `<div class="kb-meta">👤 ${esc(v.cliente.nome)} · ${esc(v.cliente.whatsapp)}</div>` : ''}
        <div class="kb-meta" ${servN ? `title="${esc(servResumo)}"` : ''}>🗓️ ${v.data_visita ? fmtDataHora(v.data_visita) : '<i>sem data</i>'}${servN ? ` · 🛠️ ${servN} serviço(s)` : ''}${temPreco ? ` · 💰 ≈ ${fmtMoeda(estTotal)}` : ''}${(ocultasMapa.has(v.id) || statusOcultosMapa.has(v.status)) ? ' · 🙈 oculta no mapa' : ''}</div>
        ${(visitaPropostas.get(v.id) || []).length ? `<div class="kb-meta" title="Status travado — mude pela página de Propostas">🔒 Proposta(s): ${(visitaPropostas.get(v.id) || []).map(fmtCodigoProposta).join(', ')}</div>` : ''}
        ${v.problema ? `<div class="kb-prob">${esc(v.problema)}</div>` : ''}
        <div class="kb-acoes">
            ${['concluida', 'concluida_pendencias'].includes(v.status) ? `<button class="hermo-btn small primary" data-proposta="${v.id}" title="Criar proposta pré-preenchida a partir desta visita">📄 Proposta</button>` : ''}
            <button class="hermo-btn small ghost" data-editar="${v.id}" title="Editar">✎</button>
            <button class="hermo-btn small danger" data-excluir="${v.id}" title="Excluir">🗑</button>
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
        () => abrirModalVisita(visitas.find(v => v.id === b.dataset.editar))));
    container.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click',
        () => excluirVisitas([b.dataset.excluir])));
    container.querySelectorAll('[data-proposta]').forEach(b => b.addEventListener('click',
        () => criarPropostaDaVisita(visitas.find(v => v.id === b.dataset.proposta))));
}

// ============================================================
// CRIAR PROPOSTA A PARTIR DA VISITA (única origem do status CONFERIR)
// ============================================================
async function criarPropostaDaVisita(v) {
    if (!v) return;
    if (!confirm(
        `Criar proposta a partir da visita "${v.endereco}"?\n\n` +
        `• Nasce com status CONFERIR, já associada a esta visita\n` +
        `• Cliente, endereço, serviços (com quantidades) e preços praticados são pré-preenchidos\n` +
        `• O status desta visita passa a ser controlado pela proposta`)) return;

    // propostas existentes: próximo código do ano + preços praticados do cliente
    const { data: props, error } = await sb.from('hermo_propostas')
        .select('id, numero, ano, cliente_id, itens:hermo_proposta_itens(servico_id, modo_preco, preco_mo, preco_material, preco_unit)')
        .order('ano', { ascending: false }).order('numero', { ascending: false });
    if (error) { toast('Erro ao consultar propostas: ' + error.message, true); return; }

    const anoAtual = new Date().getFullYear();
    const doAno = (props || []).filter(p => p.ano === anoAtual);
    const numero = doAno.length ? Math.max(...doAno.map(p => p.numero)) + 1 : 1;

    const praticado = servicoId => {
        if (!v.cliente_id) return null;
        for (const p of (props || [])) {
            if (p.cliente_id !== v.cliente_id) continue;
            const it = (p.itens || []).find(i => i.servico_id === servicoId && Number(i.preco_unit) > 0);
            if (it) return it;
        }
        return null;
    };

    const itens = (v.servicos || []).map(sv => {
        const cat = servicosCatalogo.find(x => x.id === sv.servico_id);
        const prat = praticado(sv.servico_id);
        const unit = prat ? Number(prat.preco_unit) : (Number(cat?.precos?.preco_final) || 0);
        const qtd = Number(sv.quantidade) || 1;
        return {
            servico_id: sv.servico_id,
            local_execucao: sv.local_execucao || null,
            quantidade: qtd,
            unidade: sv.unidade || cat?.unidade || null,
            modo_preco: prat?.modo_preco === 'mo_material' ? 'mo_material' : 'global',
            preco_mo: prat?.modo_preco === 'mo_material' ? prat.preco_mo : null,
            preco_material: prat?.modo_preco === 'mo_material' ? prat.preco_material : null,
            preco_unit: unit,
            total: Math.round(unit * qtd * 100) / 100
        };
    });

    const payload = {
        id: null,
        numero,
        ano: anoAtual,
        titulo: `Proposta — ${v.endereco}`,
        cliente_id: v.cliente_id || null,
        status: 'conferir',
        endereco: v.endereco || null,
        latitude: v.latitude,
        longitude: v.longitude,
        valor_total: Math.round(itens.reduce((t, i) => t + i.total, 0) * 100) / 100,
        observacoes: null,
        itens,
        visitas: [v.id]
    };
    const { data: pid, error: e2 } = await sb.rpc('hermo_salvar_proposta', { p: payload });
    if (e2) {
        if ((e2.code || '') === '23505') {
            toast('O número da proposta acabou de ser usado por outra criação — tente novamente.', true);
        } else {
            toast('Erro ao criar proposta: ' + e2.message, true);
        }
        return;
    }
    toast(`Proposta ${String(numero).padStart(4, '0')}/${anoAtual} criada em CONFERIR — abrindo…`);
    window.location.href = `propostas.html?editar=${pid}`;
}

function atualizarCorpoColuna(status) {
    const corpo = document.querySelector(`.kb-col[data-col="${status}"] .kb-corpo`);
    if (!corpo) return;
    const lista = visitasDaColuna(status);
    corpo.innerHTML = lista.length ? lista.map(cardMini).join('')
        : `<div class="kb-vazia">${(buscaColuna[status] || '').trim() ? 'nada encontrado na busca' : 'nenhuma visita aqui'}</div>`;
    ligarEventosCards(corpo);
}

function renderLista() {
    const board = $('kanban');
    board.innerHTML = KANBAN_ORDEM.map(st => {
        const info = STATUS_VISITA[st];
        const total = visitas.filter(v => v.status === st).length;
        const oculta = !!colunasOcultas[st];
        const largura = (!oculta && colunasLarguras[st]) ? `width:${colunasLarguras[st]}px;` : '';
        return `
        <div class="kb-col ${oculta ? 'colapsada' : ''}" data-col="${st}" style="${largura}--cor-col:${info.cor}"
             ${oculta ? `title="Clique para mostrar a lista ${info.label}"` : ''}>
            <div class="kb-head">
                <span class="dot" style="background:${info.cor}"></span>
                <span class="kb-titulo">${info.label}</span>
                <span class="kb-count">${total}</span>
                <button class="kb-toggle" data-toggle="${st}" title="${oculta ? 'Mostrar lista' : 'Ocultar lista'}">${oculta ? '⊞' : '—'}</button>
            </div>
            <input class="kb-busca" data-busca="${st}" type="text" placeholder="Buscar nesta lista…" value="${esc(buscaColuna[st] || '')}" />
            <div class="kb-corpo"></div>
        </div>`;
    }).join('');

    KANBAN_ORDEM.forEach(atualizarCorpoColuna);

    // busca por coluna (atualiza só o corpo — não perde o foco do input)
    board.querySelectorAll('[data-busca]').forEach(inp => inp.addEventListener('input', e => {
        buscaColuna[e.target.dataset.busca] = e.target.value;
        atualizarCorpoColuna(e.target.dataset.busca);
    }));

    // ocultar / mostrar coluna
    const alternarColuna = st => {
        colunasOcultas[st] = !colunasOcultas[st];
        try { localStorage.setItem('hermo_kanban_ocultas', JSON.stringify(colunasOcultas)); } catch (e) {}
        renderLista();
    };
    board.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        alternarColuna(b.dataset.toggle);
    }));
    board.querySelectorAll('.kb-col.colapsada').forEach(col =>
        col.addEventListener('click', () => alternarColuna(col.dataset.col)));

    // persistir larguras ajustadas manualmente (alça de resize do CSS)
    if (larguraObserver) larguraObserver.disconnect();
    larguraObserver = new ResizeObserver(() => {
        clearTimeout(renderLista._salvarLarguras);
        renderLista._salvarLarguras = setTimeout(salvarLargurasVisiveis, 400);
    });
    board.querySelectorAll('.kb-col:not(.colapsada)').forEach(c => larguraObserver.observe(c));
}

function salvarLargurasVisiveis() {
    document.querySelectorAll('.kb-col:not(.colapsada)').forEach(c => {
        const st = c.dataset.col;
        const w = Math.round(c.getBoundingClientRect().width);
        if (st && w > 60) colunasLarguras[st] = w;
    });
    try { localStorage.setItem('hermo_kanban_larguras', JSON.stringify(colunasLarguras)); } catch (e) {}
}

// ============================================================
// SELEÇÃO MÚLTIPLA
// ============================================================
function renderSelbar() {
    const bar = $('selbar');
    bar.classList.toggle('ativa', selecionadas.size > 0);
    $('selbar-info').textContent = `${selecionadas.size} selecionada(s)`;
}

function selecionarTodas() {
    // seleciona todas as visíveis (listas não ocultas, respeitando a busca de cada uma)
    KANBAN_ORDEM.filter(st => !colunasOcultas[st])
        .forEach(st => visitasDaColuna(st).forEach(v => selecionadas.add(v.id)));
    renderLista();
    renderSelbar();
}

function limparSelecao() {
    selecionadas.clear();
    renderLista();
    renderSelbar();
}

async function excluirVisitas(ids) {
    const n = ids.length;
    let msg = n === 1
        ? 'Excluir esta visita? Os serviços prováveis vinculados a ela também serão removidos.'
        : `Excluir ${n} visitas? Os serviços prováveis vinculados também serão removidos.`;
    const comProposta = ids.filter(id => (visitaPropostas.get(id) || []).length > 0);
    if (comProposta.length > 0) {
        const codigos = [...new Set(comProposta.flatMap(id => (visitaPropostas.get(id) || []).map(fmtCodigoProposta)))];
        msg += `\n\n⚠ ${comProposta.length} dela(s) está(ão) associada(s) à(s) proposta(s) ${codigos.join(', ')} — a associação será removida junto (as propostas continuam existindo).`;
    }
    if (!confirm(msg)) return;
    const { error } = await sb.from('hermo_visitas').delete().in('id', ids);
    if (error) {
        if ((error.code || '') === '23503') {
            toast('Alguma dessas visitas faz parte de uma rota na Agenda — remova-a da rota primeiro.', true);
        } else {
            toast('Erro ao excluir: ' + error.message, true);
        }
        return;
    }
    toast(n === 1 ? 'Visita excluída.' : `${n} visitas excluídas.`);
    ids.forEach(id => selecionadas.delete(id));
    await carregarTudo();
}

// ============================================================
// MODAL DE VISITA
// ============================================================
async function abrirModalVisita(visita) {
    visitaEditando = visita || null;
    servicosDaVisita = (visita?.servicos || []).map(sv => ({
        servico_id: sv.servico_id,
        codigo: sv.servico?.codigo || '?',
        descricao: sv.servico?.descricao || '?',
        local_execucao: sv.local_execucao || '',
        quantidade: sv.quantidade,
        unidade: sv.unidade || ''
    }));

    $('mv-titulo').textContent = visita ? 'Editar visita' : 'Nova visita';
    $('mv-endereco').value = visita?.endereco || '';
    localEscolhido = null;
    $('mv-local-info').style.display = 'none';
    $('mv-data').value = isoParaInput(visita?.data_visita);
    $('mv-status').value = visita?.status || 'pendente_marcacao';
    $('mv-problema').value = visita?.problema || '';

    await carregarClientesSelect(visita?.cliente_id || null);

    // TRAVA: visita associada a proposta(s) só muda de status pela página de Propostas
    const associacoes = visitaPropostas.get(visita?.id) || [];
    statusTravado = associacoes.length > 0;
    $('mv-status').disabled = statusTravado;
    aplicarRegraDataStatus();
    if (statusTravado) {
        $('mv-regra-aviso').textContent =
            `🔒 Status travado: esta visita está associada à(s) proposta(s) ${associacoes.map(fmtCodigoProposta).join(', ')} — mude o status pelo card da proposta, na página de Propostas.`;
    }
    renderServicosDaVisita();

    $('mv-overlay').classList.add('aberto');
    $('mv-endereco').focus();
}

function fecharModalVisita() {
    $('mv-overlay').classList.remove('aberto');
    visitaEditando = null;
    servicosDaVisita = [];
    statusTravado = false;
    $('mv-status').disabled = false;
}

/** Regra: com data => NUNCA 'pendente_marcacao'; sem data => SOMENTE 'pendente_marcacao'. */
function aplicarRegraDataStatus() {
    if (statusTravado) return; // status controlado pela proposta associada
    const temData = !!$('mv-data').value;
    const sel = $('mv-status');
    const aviso = $('mv-regra-aviso');
    [...sel.options].forEach(o => {
        if (temData) {
            o.disabled = (o.value === 'pendente_marcacao');
        } else {
            o.disabled = (o.value !== 'pendente_marcacao');
        }
    });
    if (temData) {
        if (sel.value === 'pendente_marcacao') sel.value = 'marcada';
        aviso.textContent = 'Com data preenchida, a visita não pode ficar "Pendente de marcação".';
    } else {
        sel.value = 'pendente_marcacao';
        aviso.textContent = 'Sem data, o status é sempre "Pendente de marcação". Preencha a data para liberar os demais.';
    }
}

function renderServicosDaVisita() {
    const cont = $('mv-servicos-lista');
    if (servicosDaVisita.length === 0) {
        cont.innerHTML = '<div style="font-size:.82rem;color:var(--hermo-text-dim)">Nenhum serviço adicionado.</div>';
        return;
    }
    cont.innerHTML = servicosDaVisita.map((s, i) => {
        const cat = servicosCatalogo.find(x => x.id === s.servico_id);
        const preco = cat?.precos?.preco_final;
        const qtd = (s.quantidade != null && s.quantidade !== '') ? Number(s.quantidade) : null;
        // resumo somente leitura da precificação (edição só na página Serviços)
        const resumoPreco = preco
            ? ` · 💰 ${fmtMoeda(preco)}/${esc(cat.unidade || 'un')}` +
              (qtd ? ` (≈ ${fmtMoeda(preco * qtd)})` : '')
            : '';
        return `
        <div class="subitem">
            <div class="txt">
                <b>${esc(s.codigo)}</b> — ${esc(s.descricao)}
                <small>
                    ${s.local_execucao ? 'Local: ' + esc(s.local_execucao) + ' · ' : ''}
                    ${qtd != null ? 'Qtd: ' + esc(s.quantidade) + (s.unidade ? ' ' + esc(s.unidade) : '') : ''}${resumoPreco}
                </small>
            </div>
            <button class="hermo-btn small ghost" data-sub-editar="${i}">✎</button>
            <button class="hermo-btn small danger" data-sub-remover="${i}">🗑</button>
        </div>`;
    }).join('');
    cont.querySelectorAll('[data-sub-editar]').forEach(b =>
        b.addEventListener('click', () => abrirSubModal(parseInt(b.dataset.subEditar))));
    cont.querySelectorAll('[data-sub-remover]').forEach(b =>
        b.addEventListener('click', () => {
            servicosDaVisita.splice(parseInt(b.dataset.subRemover), 1);
            renderServicosDaVisita();
        }));
}

async function salvarVisita() {
    const endereco = $('mv-endereco').value.trim();
    if (!endereco) { toast('Endereço é obrigatório.', true); return; }

    const dataISO = inputParaISO($('mv-data').value);
    let status = $('mv-status').value;
    // visita travada por proposta não pode perder a data (o status dela exige data)
    if (statusTravado && !dataISO) {
        toast('Esta visita está associada a proposta(s) e precisa manter uma data.', true);
        return;
    }
    // travada: usa o status ATUAL do banco (pode ter sido mudado pela proposta em outra aba)
    if (statusTravado && visitaEditando?.id) {
        const { data: atual } = await sb.from('hermo_visitas').select('status').eq('id', visitaEditando.id).single();
        if (atual?.status) status = atual.status;
    }
    // validação redundante da regra (o banco também bloqueia via CHECK)
    if (dataISO && status === 'pendente_marcacao') { toast('Visita com data não pode ficar pendente de marcação.', true); return; }
    if (!dataISO && status !== 'pendente_marcacao') { toast('Visita sem data só pode ficar pendente de marcação.', true); return; }

    const btn = $('mv-salvar');
    btn.disabled = true;
    try {
        // local escolhido no mapa tem prioridade; senão, geocodifica o endereço
        let lat = visitaEditando?.latitude ?? null;
        let lng = visitaEditando?.longitude ?? null;
        if (localEscolhido) {
            lat = localEscolhido.lat;
            lng = localEscolhido.lng;
        } else if (!visitaEditando || visitaEditando.endereco !== endereco || lat == null) {
            const geo = await geocodificar(endereco);
            lat = geo?.lat ?? null;
            lng = geo?.lng ?? null;
            if (!geo) toast('Endereço salvo, mas não localizado no mapa.', true);
        }

        // Gravação ATÔMICA (visita + serviços) via função transacional no banco
        const payload = {
            id: visitaEditando?.id || null,
            endereco,
            latitude: lat,
            longitude: lng,
            cliente_id: $('mv-cliente').value || null,
            status,
            data_visita: dataISO,
            problema: $('mv-problema').value.trim() || null,
            servicos: servicosDaVisita.map(s => ({
                servico_id: s.servico_id,
                local_execucao: s.local_execucao || null,
                quantidade: (s.quantidade === '' || s.quantidade == null) ? null : Number(s.quantidade),
                unidade: s.unidade || null
            }))
        };
        const eraEdicao = !!visitaEditando;
        const { data: visitaId, error } = await sb.rpc('hermo_salvar_visita', { p: payload });
        if (error) throw error;
        // se o salvar de uma visita nova falhar num retry, já vira update
        if (!visitaEditando && visitaId) visitaEditando = { id: visitaId, endereco, latitude: lat, longitude: lng };

        toast(eraEdicao ? 'Visita atualizada.' : 'Visita criada.');
        fecharModalVisita();
        await carregarTudo();
    } catch (e) {
        toast('Erro ao salvar visita: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// SUB-MODAL: SERVIÇO PROVÁVEL
// ============================================================
function popularSelectServicos(selecionarId = null) {
    const sel = $('ms-servico');
    sel.innerHTML = '<option value="">— selecione —</option>';
    servicosCatalogo.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        const preco = s.precos?.preco_final;
        o.textContent = `${s.codigo} — ${s.descricao}` +
            (preco ? ` (${fmtMoeda(preco)}/${s.unidade || 'un'})` : '');
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
    atualizarResumoServicoSelecionado();
}

/** Resumo somente leitura da precificação do serviço escolhido (edição só na página Serviços). */
function atualizarResumoServicoSelecionado() {
    const info = $('ms-precificacao-info');
    if (!info) return;
    const s = servicosCatalogo.find(x => x.id === $('ms-servico').value);
    if (!s) { info.style.display = 'none'; return; }
    info.style.display = '';
    if (s.precos?.preco_final) {
        const a = (Number(s.precos.aliquota) || 0);
        info.innerHTML = `💰 Preço: <b>${fmtMoeda(s.precos.preco_final)}/${esc(s.unidade || 'un')}</b>` +
            (a ? ` · imposto ${a}%` : '') +
            ` — <a href="servicos.html?editar=${s.id}" target="_blank" rel="noopener" style="color:var(--hermo-primary)">editar precificação na página Serviços ↗</a>`;
    } else {
        info.innerHTML = `Este serviço ainda não tem precificação — ` +
            `<a href="servicos.html?editar=${s.id}" target="_blank" rel="noopener" style="color:var(--hermo-primary)">preencher na página Serviços ↗</a>`;
    }
}

function abrirSubModal(editIndex = null) {
    subEditIndex = editIndex;
    const item = editIndex != null ? servicosDaVisita[editIndex] : null;
    $('ms-titulo').textContent = item ? 'Editar serviço provável' : 'Adicionar serviço provável';
    popularSelectServicos(item?.servico_id || null);
    $('ms-novo-wrap').style.display = 'none';
    $('ms-local').value = item?.local_execucao || '';
    $('ms-qtd').value = item?.quantidade ?? '';
    $('ms-unidade').value = item?.unidade || '';
    $('ms-overlay').classList.add('aberto');
}

function fecharSubModal() {
    $('ms-overlay').classList.remove('aberto');
    subEditIndex = null;
}

async function salvarNovoServicoCatalogo() {
    const codigo = $('ms-novo-codigo').value.trim();
    const descricao = $('ms-novo-descricao').value.trim();
    if (!codigo || !descricao) { toast('Código e descrição são obrigatórios.', true); return; }
    const { data, error } = await sb.from('hermo_servicos')
        .insert({ codigo, descricao, unidade: $('ms-novo-unidade').value.trim() || null })
        .select().single();
    if (error) { toast('Erro ao criar serviço: ' + error.message, true); return; }
    servicosCatalogo.push(data);
    servicosCatalogo.sort((a, b) => a.codigo.localeCompare(b.codigo));
    popularSelectServicos(data.id);
    if (data.unidade) $('ms-unidade').value = data.unidade; // select mudou sem evento 'change'
    $('ms-novo-wrap').style.display = 'none';
    $('ms-novo-codigo').value = $('ms-novo-descricao').value = $('ms-novo-unidade').value = '';
    toast('Serviço adicionado ao catálogo.');
}

function confirmarServicoDaVisita() {
    const servicoId = $('ms-servico').value;
    if (!servicoId) { toast('Selecione um serviço.', true); return; }
    const qtd = $('ms-qtd').value;
    const unidade = $('ms-unidade').value.trim();
    if (unidade && !qtd) { toast('Unidade de medida só pode ser informada se houver quantidade.', true); return; }
    const cat = servicosCatalogo.find(s => s.id === servicoId);
    const item = {
        servico_id: servicoId,
        codigo: cat?.codigo || '?',
        descricao: cat?.descricao || '?',
        local_execucao: $('ms-local').value.trim(),
        quantidade: qtd === '' ? null : Number(qtd),
        unidade
    };
    if (subEditIndex != null) servicosDaVisita[subEditIndex] = item;
    else servicosDaVisita.push(item);
    renderServicosDaVisita();
    fecharSubModal();
}

// ============================================================
// MAPA
// ============================================================
function iniciarMapa() {
    if (typeof L === 'undefined') return;
    mapa = L.map('hermo-mapa').setView([-8.0476, -34.877], 11); // Recife
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapa);
    renderLegenda();
}

/** Legenda clicável: cada status liga/desliga suas visitas no mapa. */
function renderLegenda() {
    const el = $('mapa-legenda');
    el.innerHTML = Object.entries(STATUS_VISITA).map(([k, v]) =>
        `<span class="leg leg-toggle ${statusOcultosMapa.has(k) ? 'oculto' : ''}" data-leg="${k}"
            title="Clique para ${statusOcultosMapa.has(k) ? 'mostrar' : 'ocultar'} no mapa">
            <span class="dot" style="background:${v.cor}"></span>${v.label}</span>`).join('') +
        (ocultasMapa.size > 0
            ? `<span class="leg"><button class="hermo-btn small ghost" id="btn-mostrar-ocultas">👁 Mostrar ${ocultasMapa.size} visita(s) oculta(s) individualmente</button></span>`
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
        toast('Todas as visitas ocultas individualmente voltaram ao mapa.');
    });
}

function atualizarMapa() {
    if (!mapa) return;
    renderLegenda();
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    const pontos = [];
    visitas.filter(v => v.latitude != null && v.longitude != null
        && !ocultasMapa.has(v.id) && !statusOcultosMapa.has(v.status)).forEach(v => {
        const st = STATUS_VISITA[v.status] || { cor: '#94a3b8', label: v.status };
        const marker = L.circleMarker([v.latitude, v.longitude], {
            radius: 9,
            color: '#0f172a',
            weight: 2,
            fillColor: st.cor,
            fillOpacity: 1
        }).addTo(mapa);
        marker.bindPopup(`<div style="font-size:.85rem;max-width:240px">
            <b>${esc(v.endereco)}</b><br>
            Status: ${st.label}<br>
            ${v.data_visita ? 'Data: ' + fmtDataHora(v.data_visita) + '<br>' : ''}
            ${v.cliente ? 'Cliente: ' + esc(v.cliente.nome) : ''}
        </div>`);
        marcadores.push(marker);
        pontos.push([v.latitude, v.longitude]);
    });
    if (pontos.length === 1) {
        // fitBounds com 1 ponto iria ao zoom máximo; centraliza com contexto
        mapa.setView(pontos[0], 15);
    } else if (pontos.length > 1) {
        mapa.fitBounds(pontos, { padding: [40, 40] });
    }
}

/** Geocodifica via Nominatim (OpenStreetMap) — gratuito, sem chave.
 *  Nunca trava o salvar: timeout de 6s e qualquer erro vira null. */
async function geocodificar(endereco) {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const resp = await fetch(
            'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' +
            encodeURIComponent(endereco),
            { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
        clearTimeout(t);
        if (!resp.ok) return null;
        const arr = await resp.json();
        if (arr && arr[0]) return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
        return null;
    } catch (e) {
        return null;
    }
}

/** Tenta geocodificar (aos poucos) visitas antigas sem coordenadas e persiste. */
async function geocodificarPendentes() {
    const pendentes = visitas.filter(v => v.latitude == null).slice(0, 8);
    let alterou = false;
    for (const v of pendentes) {
        const geo = await geocodificar(v.endereco);
        if (geo) {
            const { error } = await sb.from('hermo_visitas')
                .update({ latitude: geo.lat, longitude: geo.lng }).eq('id', v.id);
            if (!error) { v.latitude = geo.lat; v.longitude = geo.lng; alterou = true; }
        }
        // política de uso do Nominatim: no máx. 1 requisição/segundo
        await new Promise(r => setTimeout(r, 1100));
    }
    if (alterou) atualizarMapa();
}

// ============================================================
// MODAL: ESCOLHER LOCAL NO MAPA
// ============================================================
function abrirModalLocal() {
    if (typeof L === 'undefined') { toast('Mapa indisponível no momento.', true); return; }
    $('mp-overlay').classList.add('aberto');
    mpPendente = localEscolhido
        || (visitaEditando?.latitude != null ? { lat: visitaEditando.latitude, lng: visitaEditando.longitude } : null);
    const centro = mpPendente ? [mpPendente.lat, mpPendente.lng] : [-8.0476, -34.877];
    if (!mpMapa) {
        mpMapa = L.map('mp-mapa').setView(centro, mpPendente ? 16 : 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 19
        }).addTo(mpMapa);
        mpMapa.on('click', e => {
            mpPendente = { lat: e.latlng.lat, lng: e.latlng.lng };
            posicionarMpMarcador();
            $('mp-confirmar').disabled = false;
        });
    } else {
        mpMapa.setView(centro, mpPendente ? 16 : 12);
    }
    posicionarMpMarcador();
    $('mp-confirmar').disabled = !mpPendente;
    // o Leaflet precisa recalcular o tamanho depois que o modal fica visível
    setTimeout(() => mpMapa.invalidateSize(), 150);
}

function posicionarMpMarcador() {
    if (mpMarcador) { mpMapa.removeLayer(mpMarcador); mpMarcador = null; }
    if (mpPendente) {
        mpMarcador = L.marker([mpPendente.lat, mpPendente.lng]).addTo(mpMapa);
    }
}

function fecharModalLocal() {
    $('mp-overlay').classList.remove('aberto');
}

async function confirmarLocal() {
    if (!mpPendente) return;
    localEscolhido = mpPendente;
    $('mv-local-info').style.display = '';
    fecharModalLocal();
    // endereço vazio? tenta preencher via geocodificação reversa (editável depois)
    if (!$('mv-endereco').value.trim()) {
        try {
            const ctl = new AbortController();
            const t = setTimeout(() => ctl.abort(), 6000);
            const resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${localEscolhido.lat}&lon=${localEscolhido.lng}`,
                { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
            clearTimeout(t);
            if (resp.ok) {
                const j = await resp.json();
                if (j.display_name) $('mv-endereco').value = j.display_name;
            }
        } catch (e) { /* endereço fica manual */ }
    }
    toast('Local definido pelo mapa — será usado no lugar da busca por endereço.');
}

// ============================================================
// EVENTOS
// ============================================================
/** Reflete alteração de cliente nos cards/resumo/mapa já carregados (sem reload) */
function refletirClienteAtualizado(c) {
    visitas.forEach(v => {
        if (v.cliente_id === c.id) v.cliente = { id: c.id, nome: c.nome, whatsapp: c.whatsapp };
    });
    renderResumo();
    renderLista();
    atualizarMapa();
}

function ligarEventos() {
    $('btn-nova-visita').addEventListener('click', () => abrirModalVisita(null));
    // salvar largura das listas ao terminar o arraste da alça (independe do ResizeObserver)
    $('kanban').addEventListener('pointerup', () => setTimeout(salvarLargurasVisiveis, 50));

    $('btn-sel-todas').addEventListener('click', selecionarTodas);
    $('btn-sel-limpar').addEventListener('click', limparSelecao);
    $('btn-sel-ocultar').addEventListener('click', () => {
        if (selecionadas.size === 0) return;
        selecionadas.forEach(id => ocultasMapa.add(id));
        salvarOcultasMapa();
        atualizarMapa();
        renderLista();
        toast(`${selecionadas.size} visita(s) oculta(s) do mapa.`);
    });
    $('btn-sel-mostrar').addEventListener('click', () => {
        if (selecionadas.size === 0) return;
        selecionadas.forEach(id => ocultasMapa.delete(id));
        salvarOcultasMapa();
        atualizarMapa();
        renderLista();
        toast(`${selecionadas.size} visita(s) de volta ao mapa.`);
    });
    $('btn-sel-excluir').addEventListener('click', () => excluirVisitas([...selecionadas]));

    // modal visita
    $('mv-fechar').addEventListener('click', fecharModalVisita);
    $('mv-cancelar').addEventListener('click', fecharModalVisita);
    ligarFecharPorBackdrop($('mv-overlay'), fecharModalVisita);
    $('mv-salvar').addEventListener('click', salvarVisita);
    $('mv-data').addEventListener('input', aplicarRegraDataStatus);
    $('mv-btn-add-servico').addEventListener('click', () => abrirSubModal(null));

    $('mv-btn-novo-cliente').addEventListener('click', () =>
        abrirModalCliente(null, c => carregarClientesSelect(c.id)));
    $('mv-btn-editar-cliente').addEventListener('click', async () => {
        const id = $('mv-cliente').value;
        if (!id) { toast('Selecione um cliente para editar.', true); return; }
        const { data, error } = await sb.from('hermo_clientes').select('*').eq('id', id).single();
        if (error) { toast('Erro ao carregar cliente: ' + error.message, true); return; }
        abrirModalCliente(data, c => {
            carregarClientesSelect(c.id);
            refletirClienteAtualizado(c);
        });
    });

    // modal de escolha de local no mapa
    $('mv-btn-mapa').addEventListener('click', abrirModalLocal);
    $('mp-fechar').addEventListener('click', fecharModalLocal);
    $('mp-cancelar').addEventListener('click', fecharModalLocal);
    $('mp-confirmar').addEventListener('click', confirmarLocal);
    ligarFecharPorBackdrop($('mp-overlay'), fecharModalLocal);

    // sub-modal serviço
    $('ms-fechar').addEventListener('click', fecharSubModal);
    $('ms-cancelar').addEventListener('click', fecharSubModal);
    ligarFecharPorBackdrop($('ms-overlay'), fecharSubModal);
    $('ms-confirmar').addEventListener('click', confirmarServicoDaVisita);
    // unidade pré-preenchida com a unidade padrão do serviço selecionado (se houver)
    $('ms-servico').addEventListener('change', () => {
        const cat = servicosCatalogo.find(s => s.id === $('ms-servico').value);
        if (cat?.unidade) $('ms-unidade').value = cat.unidade;
        atualizarResumoServicoSelecionado();
    });
    $('ms-btn-novo-servico').addEventListener('click', () => {
        const w = $('ms-novo-wrap');
        w.style.display = w.style.display === 'none' ? 'flex' : 'none';
    });
    $('ms-btn-salvar-novo-servico').addEventListener('click', salvarNovoServicoCatalogo);
}

// ---------- Boot ----------
ligarEventos();
iniciarMapa();
carregarTudo();
