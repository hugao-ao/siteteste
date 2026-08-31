// medicoes-notas.js — Medições por obra (kanban 5 status) e registro de notas fiscais.
// Salvar a medição atualiza automaticamente o % executado do escopo da obra.
// Medições FATURADAS/PAGAS viram receitas no Faturamento (derivadas, sem redigitação).
import { sb, toast, ligarFecharPorBackdrop, esc, fmtMoeda, somarPrazo } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
// data LOCAL (toISOString seria UTC e viraria "amanhã" à noite no fuso de Recife)
const hojeLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const STATUS_MEDICAO = {
    em_elaboracao: { label: 'Em elaboração', cor: '#eab308' },
    enviada:       { label: 'Enviada',       cor: '#f97316' },
    aprovada:      { label: 'Aprovada',      cor: '#3b82f6' },
    faturada:      { label: 'Faturada',      cor: '#a855f7' },
    paga:          { label: 'Paga',          cor: '#22c55e' }
};
const KANBAN_ORDEM = ['em_elaboracao', 'enviada', 'aprovada', 'faturada', 'paga'];

let medicoes = [];
let obras = [];               // com escopo (itens) para montar a medição
let buscaColuna = {};
let colunasOcultas = lerLS('hermo_med_kanban_ocultas', {});
let colunasLarguras = lerLS('hermo_med_kanban_larguras', {});
let larguraObserver = null;

let medEditando = null;
let itensMedicao = [];        // [{obra_servico_id, codigo, descricao, contratado, unidade, preco_unit, acumuladoAnterior, qtd}]
let nfs = [];

function lerLS(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) || padrao; }
    catch (e) { return padrao; }
}

const fmtCod = m => {
    const o = obras.find(x => x.id === m.obra_id);
    return `MED-${m.numero}${o ? ' · OB-' + String(o.numero).padStart(4, '0') : ''}`;
};

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [m, o] = await Promise.all([
        sb.from('hermo_medicoes')
            .select('*, nfs:hermo_notas_fiscais(id, status), itens:hermo_medicao_itens(obra_servico_id, qtd_medida, valor)')
            .order('created_at', { ascending: false }),
        sb.from('hermo_obras')
            .select('id, numero, ano, nome, status, cliente:hermo_clientes(nome), itens:hermo_obra_servicos(id, vigente, descricao_livre, quantidade, unidade, preco_unit, total, perc_executado, qtd_executada, local_execucao, servico:hermo_servicos(codigo, descricao), alocacoes:hermo_alocacoes(id))')
            .order('ano', { ascending: false }).order('numero', { ascending: false })
    ]);
    if (m.error) { toast('Erro ao carregar medições: ' + m.error.message, true); return; }
    if (o.error) { toast('Erro ao carregar obras: ' + o.error.message, true); return; }
    medicoes = m.data || [];
    obras = o.data || [];
    renderResumo();
    renderLista();
}

// ============================================================
// RESUMO
// ============================================================
function renderResumo() {
    const porStatus = {};
    KANBAN_ORDEM.forEach(st => porStatus[st] = { n: 0, valor: 0 });
    medicoes.forEach(m => {
        if (porStatus[m.status]) { porStatus[m.status].n++; porStatus[m.status].valor += num(m.valor_liquido); }
    });
    const aReceber = porStatus.aprovada.valor + porStatus.faturada.valor;
    const d = new Date();
    const mesAtual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // mês LOCAL
    const recebidoMes = medicoes
        .filter(m => m.status === 'paga' && (m.data_pagamento || '').startsWith(mesAtual))
        .reduce((t, m) => t + num(m.valor_liquido), 0);
    let destaque;
    if (porStatus.enviada.n > 0) {
        destaque = `📨 <b>${fmtMoeda(porStatus.enviada.valor)}</b> em ${porStatus.enviada.n} medição(ões) aguardando aprovação.`;
    } else if (aReceber > 0) {
        destaque = `💰 A receber (aprovadas + faturadas): <b>${fmtMoeda(aReceber)}</b>.`;
    } else {
        destaque = `✅ Recebido este mês: <b>${fmtMoeda(recebidoMes)}</b>.`;
    }
    $('resumo').innerHTML = KANBAN_ORDEM.map(st => `
        <div class="stat" style="border-left-color:${STATUS_MEDICAO[st].cor}">
            <div class="num">${porStatus[st].n} · ${fmtMoeda(porStatus[st].valor)}</div>
            <div class="lbl">${STATUS_MEDICAO[st].label}</div>
        </div>`).join('') +
        `<div class="stat destaque"><div class="num">${destaque}</div></div>`;
}

// ============================================================
// KANBAN
// ============================================================
function medicoesDaColuna(status) {
    const q = (buscaColuna[status] || '').trim().toLowerCase();
    let lista = medicoes.filter(m => m.status === status);
    if (q) {
        lista = lista.filter(m => {
            const o = obras.find(x => x.id === m.obra_id);
            return fmtCod(m).toLowerCase().includes(q) ||
                (o?.nome || '').toLowerCase().includes(q) ||
                (o?.cliente?.nome || '').toLowerCase().includes(q);
        });
    }
    return lista;
}

function cardMini(m) {
    const o = obras.find(x => x.id === m.obra_id);
    const nfsAtivas = (m.nfs || []).filter(n => n.status === 'emitida').length;
    const periodo = m.periodo_de
        ? `${m.periodo_de.split('-').reverse().slice(0, 2).join('/')}–${(m.periodo_ate || m.periodo_de).split('-').reverse().slice(0, 2).join('/')}`
        : '';
    return `
    <div class="kb-card" data-id="${m.id}">
        <div class="kb-l1"><span class="kb-end">${fmtCod(m)}</span></div>
        <div class="kb-meta">🏗️ ${esc(o?.nome || 'obra removida')}</div>
        <div class="kb-meta">💰 <b>${fmtMoeda(m.valor_liquido)}</b>${periodo ? ` · 📅 ${periodo}` : ''}${nfsAtivas ? ` · 🧾 ${nfsAtivas} NF` : ''}${m.status !== 'paga' && m.previsao_recebimento ? ` · 📥 ${m.previsao_recebimento.split('-').reverse().slice(0, 2).join('/')}` : ''}</div>
        <div class="kb-acoes">
            <button class="hermo-btn small ghost" data-editar="${m.id}">✎</button>
            <button class="hermo-btn small danger" data-excluir="${m.id}">🗑</button>
        </div>
    </div>`;
}

function atualizarCorpoColuna(status) {
    const corpo = document.querySelector(`.kb-col[data-col="${status}"] .kb-corpo`);
    if (!corpo) return;
    const lista = medicoesDaColuna(status);
    corpo.innerHTML = lista.length ? lista.map(cardMini).join('')
        : `<div class="kb-vazia">nenhuma medição aqui</div>`;
    corpo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click',
        () => abrirModal(medicoes.find(m => m.id === b.dataset.editar))));
    corpo.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click',
        () => excluirMedicao(b.dataset.excluir)));
}

function renderLista() {
    const board = $('kanban');
    board.innerHTML = KANBAN_ORDEM.map(st => {
        const info = STATUS_MEDICAO[st];
        const doStatus = medicoes.filter(m => m.status === st);
        const valor = doStatus.reduce((t, m) => t + num(m.valor_liquido), 0);
        const oculta = !!colunasOcultas[st];
        const largura = (!oculta && colunasLarguras[st]) ? `width:${colunasLarguras[st]}px;` : '';
        return `
        <div class="kb-col ${oculta ? 'colapsada' : ''}" data-col="${st}" style="${largura}--cor-col:${info.cor}">
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
        try { localStorage.setItem('hermo_med_kanban_ocultas', JSON.stringify(colunasOcultas)); } catch (e) {}
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
        renderLista._t = setTimeout(() => {
            document.querySelectorAll('.kb-col:not(.colapsada)').forEach(c => {
                const st = c.dataset.col;
                const w = Math.round(c.getBoundingClientRect().width);
                if (st && w > 60) colunasLarguras[st] = w;
            });
            try { localStorage.setItem('hermo_med_kanban_larguras', JSON.stringify(colunasLarguras)); } catch (e) {}
        }, 400);
    });
    board.querySelectorAll('.kb-col:not(.colapsada)').forEach(c => larguraObserver.observe(c));
}

async function excluirMedicao(id) {
    const m = medicoes.find(x => x.id === id);
    if (!confirm(`Excluir a medição ${fmtCod(m)}?\nAs NFs registradas nela também serão removidas, e o % executado da obra será recalculado no próximo salvamento de medição.`)) return;
    const { error } = await sb.from('hermo_medicoes').delete().eq('id', id);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast('Medição excluída.');
    await carregarTudo();
}

// ============================================================
// MODAL
// ============================================================
function popularObrasSelect(selecionarId = null) {
    const sel = $('md-obra');
    sel.innerHTML = '<option value="">— selecione a obra —</option>';
    obras.filter(o => (o.itens || []).length > 0).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = `OB-${String(o.numero).padStart(4, '0')}/${o.ano} — ${o.nome}`;
        sel.appendChild(opt);
    });
    if (selecionarId) sel.value = selecionarId;
}

async function abrirModal(medicao) {
    medEditando = medicao || null;
    nfs = [];
    $('md-titulo').textContent = medicao ? `Editar ${fmtCod(medicao)}` : 'Nova medição';
    popularObrasSelect(medicao?.obra_id || null);
    $('md-obra').disabled = !!medicao; // obra não muda depois de criada
    $('md-numero').value = medicao?.numero || '';
    $('md-de').value = medicao?.periodo_de || '';
    $('md-ate').value = medicao?.periodo_ate || '';
    $('md-status').value = medicao?.status || 'em_elaboracao';
    $('md-pgto').value = medicao?.data_pagamento || '';
    $('md-prazo-receb').value = medicao?.prazo_receb_dias || '';
    $('md-prazo-receb-tipo').value = medicao?.prazo_receb_tipo || 'corridos';
    $('md-previsao').value = medicao?.previsao_recebimento || '';
    $('md-retencao').value = medicao?.retencao_perc || '';
    $('md-desconto').value = medicao?.desconto || '';
    $('md-obs').value = medicao?.observacoes || '';
    aoMudarStatus();
    await montarItens();
    await carregarNfs();
    $('md-overlay').classList.add('aberto');
}

function fecharModal() {
    $('md-overlay').classList.remove('aberto');
    medEditando = null;
    itensMedicao = [];
    nfs = [];
}

function aoMudarStatus() {
    $('md-pgto-wrap').style.display = $('md-status').value === 'paga' ? '' : 'none';
}

/** Monta as linhas de medição a partir do escopo da obra + acumulado das outras medições. */
async function montarItens() {
    const obraId = $('md-obra').value;
    // proteção contra corrida: só o carregamento mais recente pode aplicar o resultado
    const seq = (montarItens._seq = (montarItens._seq || 0) + 1);
    itensMedicao = [];
    if (!obraId) { renderItens(); return; }
    const obra = obras.find(o => o.id === obraId);

    // nº sugerido = maior nº da obra + 1
    if (!medEditando) {
        const daObra = medicoes.filter(m => m.obra_id === obraId);
        $('md-numero').value = daObra.length ? Math.max(...daObra.map(m => m.numero)) + 1 : 1;
    }

    // acumulado por serviço nas OUTRAS medições da obra (as desta ficam no próprio draft)
    const { data: acum, error } = await sb.from('hermo_medicao_itens')
        .select('obra_servico_id, qtd_medida, medicao:hermo_medicoes!inner(obra_id, id)')
        .eq('medicao.obra_id', obraId);
    if (seq !== montarItens._seq) return; // o usuário trocou de obra durante a consulta
    if (error) { toast('Erro ao carregar acumulado: ' + error.message, true); return; }
    const acumPorServico = new Map();
    (acum || []).forEach(r => {
        if (medEditando && r.medicao?.id === medEditando.id) return;
        acumPorServico.set(r.obra_servico_id,
            (acumPorServico.get(r.obra_servico_id) || 0) + num(r.qtd_medida));
    });
    const nestaMedicao = new Map();
    (medEditando?.itens || []).forEach(i => nestaMedicao.set(i.obra_servico_id, num(i.qtd_medida)));

    itensMedicao = (obra?.itens || []).filter(it => it.vigente !== false).map(it => ({
        obra_servico_id: it.id,
        codigo: it.servico?.codigo || '?',
        // mesma redação que o cliente contratou — a medição vai para ele
        descricao: it.descricao_livre || it.servico?.descricao || '?',
        local: it.local_execucao || '',
        contratado: num(it.quantidade),
        unidade: it.unidade || 'un',
        preco_unit: num(it.preco_unit),
        executadoObra: it.qtd_executada != null ? num(it.qtd_executada) : null,
        // toda produção medida é produção de alguém — sem alocação, não se mede
        semEquipe: (it.alocacoes || []).length === 0,
        acumuladoAnterior: acumPorServico.get(it.id) || 0,
        qtd: nestaMedicao.get(it.id) || 0
    }));
    renderItens();
}

function renderItens() {
    const cont = $('md-itens');
    if (itensMedicao.length === 0) {
        cont.innerHTML = '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Escolha uma obra com escopo para medir.</div>';
        recalcTotais();
        return;
    }
    cont.innerHTML = itensMedicao.map((i, idx) => {
        const totalAcum = i.acumuladoAnterior + i.qtd;
        const excede = totalAcum > i.contratado;
        return `
        <div class="md-item ${excede ? 'excedente' : ''}">
            <div class="txt">
                <b>${esc(i.codigo)}</b> — ${esc(i.descricao)}
                <small>${i.local ? '📍 ' + esc(i.local) + ' · ' : ''}contratado ${i.contratado} ${esc(i.unidade)} · já medido ${i.acumuladoAnterior}${i.executadoObra != null ? ` · 🏗️ executado na obra ${i.executadoObra}` : ''} · ${fmtMoeda(i.preco_unit)}/${esc(i.unidade)}</small>
            </div>
            <label style="font-size:.7rem;color:var(--hermo-text-dim)">nesta:</label>
            <input class="qtd" type="number" step="any" min="0" value="${i.qtd || ''}" placeholder="0" data-qtd="${idx}"
                ${i.semEquipe ? 'disabled title="Ninguém alocado neste serviço — toda produção precisa ser atribuída a alguém. Aloque a equipe no cronograma da obra antes de medir."' : ''} />
            <span class="valor">${fmtMoeda(i.qtd * i.preco_unit)}</span>
            ${i.semEquipe ? '<div class="md-aviso-exc">⚠ ninguém alocado no serviço — aloque a equipe no cronograma da obra para poder medir.</div>' : ''}
            ${excede ? `<div class="md-aviso-exc">⚠ acumulado ${totalAcum} passa do contratado (${i.contratado}) — permitido (aditivo), mas confira.</div>` : ''}
        </div>`;
    }).join('');
    // enquanto digita: atualiza só o valor da linha e os totais (não re-renderiza —
    // re-render a cada tecla impediria digitar decimais); aviso de excedente no blur
    cont.querySelectorAll('[data-qtd]').forEach(inp => {
        inp.addEventListener('input', e => {
            const idx = parseInt(e.target.dataset.qtd);
            itensMedicao[idx].qtd = Math.max(0, num(e.target.value));
            const valorEl = e.target.closest('.md-item')?.querySelector('.valor');
            if (valorEl) valorEl.textContent = fmtMoeda(itensMedicao[idx].qtd * itensMedicao[idx].preco_unit);
            recalcTotais();
        });
        inp.addEventListener('change', () => renderItens());
    });
    recalcTotais();
}

function retencaoClamp() { return Math.min(100, Math.max(0, num($('md-retencao').value))); }
function descontoClamp() { return Math.max(0, num($('md-desconto').value)); }

function recalcTotais() {
    const bruto = itensMedicao.reduce((t, i) => t + i.qtd * i.preco_unit, 0);
    const ret = bruto * retencaoClamp() / 100;
    const desc = descontoClamp();
    $('md-bruto').textContent = fmtMoeda(bruto);
    $('md-abate').textContent = fmtMoeda(ret + desc);
    $('md-liquido').textContent = fmtMoeda(Math.max(0, bruto - ret - desc));
}

async function salvarMedicao() {
    const obraId = $('md-obra').value;
    const numero = parseInt($('md-numero').value);
    if (!obraId) { toast('Escolha a obra.', true); return; }
    if (!numero || numero < 1) { toast('Número da medição inválido.', true); return; }
    const comQtd = itensMedicao.filter(i => i.qtd > 0);
    if (comQtd.length === 0) { toast('Informe a quantidade medida de ao menos um serviço.', true); return; }
    const dup = medicoes.find(m => m.obra_id === obraId && m.numero === numero && m.id !== medEditando?.id);
    if (dup) { toast(`Já existe a medição nº ${numero} nesta obra.`, true); return; }

    const bruto = itensMedicao.reduce((t, i) => t + i.qtd * i.preco_unit, 0);
    const ret = bruto * retencaoClamp() / 100;
    const liquido = Math.max(0, bruto - ret - descontoClamp());

    const btn = $('md-salvar');
    btn.disabled = true;
    try {
        const payload = {
            id: medEditando?.id || null,
            obra_id: obraId,
            numero,
            periodo_de: $('md-de').value || null,
            periodo_ate: $('md-ate').value || null,
            status: $('md-status').value,
            retencao_perc: retencaoClamp(),
            desconto: descontoClamp(),
            valor_bruto: Math.round(bruto * 100) / 100,
            valor_liquido: Math.round(liquido * 100) / 100,
            data_pagamento: $('md-status').value === 'paga' ? ($('md-pgto').value || null) : null,
            observacoes: $('md-obs').value.trim() || null,
            previsao_recebimento: $('md-previsao').value || null,
            prazo_receb_dias: parseInt($('md-prazo-receb').value) >= 1 ? parseInt($('md-prazo-receb').value) : null,
            prazo_receb_tipo: parseInt($('md-prazo-receb').value) >= 1 ? $('md-prazo-receb-tipo').value : null,
            itens: comQtd.map(i => ({
                obra_servico_id: i.obra_servico_id,
                qtd_medida: i.qtd,
                valor: Math.round(i.qtd * i.preco_unit * 100) / 100
            }))
        };
        const eraEdicao = !!medEditando;
        const { data: mid, error } = await sb.rpc('hermo_salvar_medicao', { p: payload });
        if (error) throw error;
        toast(eraEdicao ? 'Medição atualizada — % executado da obra recalculado.'
                        : 'Medição criada — % executado da obra recalculado.');
        fecharModal();
        await carregarTudo();
        // recém-criada: reabre já em modo edição para permitir registrar as NFs
        if (!eraEdicao && mid) {
            const nova = medicoes.find(x => x.id === mid);
            if (nova) await abrirModal(nova);
        }
    } catch (e) {
        if ((e.code || '') === '23505') toast('Já existe uma medição com esse número nesta obra.', true);
        else toast('Erro ao salvar medição: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// NOTAS FISCAIS (por medição salva)
// ============================================================
async function carregarNfs() {
    const salva = !!medEditando;
    $('md-nf-aviso').style.display = salva ? 'none' : '';
    $('md-nf-form').style.display = salva ? '' : 'none';
    $('md-nf-form2').style.display = salva ? '' : 'none';
    nfs = [];
    if (!salva) { renderNfs(); return; }
    const { data, error } = await sb.from('hermo_notas_fiscais')
        .select('*').eq('medicao_id', medEditando.id).order('data_emissao');
    if (error) { toast('Erro ao carregar NFs: ' + error.message, true); return; }
    nfs = data || [];
    renderNfs();
    prefixarNf();
}

/** Pré-preenche o formulário de NF com o que ainda falta faturar desta medição. */
function prefixarNf() {
    if (!medEditando) return;
    const emitido = nfs.filter(n => n.status !== 'cancelada').reduce((t, n) => t + num(n.valor), 0);
    const falta = Math.round((num(medEditando.valor_liquido) - emitido) * 100) / 100;
    if (!$('nf-data').value) $('nf-data').value = hojeLocal();
    // só sugere enquanto o campo estiver vazio — nunca sobrescreve o que o usuário digitou
    if (!$('nf-valor').value && falta > 0.005) $('nf-valor').value = falta;
    const aviso = $('nf-falta');
    if (!aviso) return;
    if (falta > 0.005) {
        aviso.style.display = '';
        aviso.textContent = emitido > 0
            ? `Falta faturar ${fmtMoeda(falta)} desta medição (${fmtMoeda(emitido)} já em NF).`
            : `Valor líquido da medição: ${fmtMoeda(falta)}.`;
    } else if (Math.abs(falta) <= 0.005) {
        aviso.style.display = '';
        aviso.textContent = 'Medição totalmente faturada.';
    } else {
        aviso.style.display = '';
        aviso.textContent = `⚠ NFs somam ${fmtMoeda(emitido)} — ${fmtMoeda(-falta)} acima do líquido da medição.`;
    }
}

function renderNfs() {
    $('md-nfs').innerHTML = nfs.length === 0
        ? '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Nenhuma NF registrada.</div>'
        : nfs.map(n => `
            <div class="nf-item ${n.status === 'cancelada' ? 'nf-cancelada' : ''}">
                <div class="txt"><b>NF ${esc(n.numero)}</b> — ${fmtMoeda(n.valor)}
                    <small>${n.data_emissao.split('-').reverse().join('/')}${num(n.iss_retido) ? ' · ISS retido ' + fmtMoeda(n.iss_retido) : ''}${n.emitida_via !== 'manual' ? ' · via ' + esc(n.emitida_via) : ''}</small>
                </div>
                ${n.status === 'emitida'
                    ? `<button class="hermo-btn small ghost" data-nf-cancelar="${n.id}" title="Marcar como cancelada">✖ Cancelar</button>`
                    : '<span style="font-size:.7rem;color:var(--hermo-text-dim)">cancelada</span>'}
                <button class="hermo-btn small danger" data-nf-excluir="${n.id}">🗑</button>
            </div>`).join('');
    $('md-nfs').querySelectorAll('[data-nf-cancelar]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Marcar esta NF como cancelada?')) return;
        const { error } = await sb.from('hermo_notas_fiscais').update({ status: 'cancelada' }).eq('id', b.dataset.nfCancelar);
        if (error) { toast('Erro: ' + error.message, true); return; }
        await carregarNfs();
    }));
    $('md-nfs').querySelectorAll('[data-nf-excluir]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Excluir este registro de NF?')) return;
        const { error } = await sb.from('hermo_notas_fiscais').delete().eq('id', b.dataset.nfExcluir);
        if (error) { toast('Erro: ' + error.message, true); return; }
        await carregarNfs();
    }));
}

async function registrarNf() {
    const numero = $('nf-numero').value.trim();
    const valor = num($('nf-valor').value);
    if (!numero) { toast('Informe o número da NF.', true); return; }
    if (valor <= 0) { toast('Informe o valor da NF.', true); return; }
    const { error } = await sb.from('hermo_notas_fiscais').insert({
        medicao_id: medEditando.id,
        numero,
        data_emissao: $('nf-data').value || hojeLocal(),
        valor,
        iss_retido: num($('nf-iss').value)
    });
    if (error) { toast('Erro ao registrar NF: ' + error.message, true); return; }
    $('nf-numero').value = $('nf-valor').value = $('nf-iss').value = '';
    toast('NF registrada.');
    await carregarNfs();
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('btn-nova').addEventListener('click', () => abrirModal(null));
$('md-fechar').addEventListener('click', fecharModal);
$('md-cancelar').addEventListener('click', fecharModal);
ligarFecharPorBackdrop($('md-overlay'), fecharModal);
$('md-salvar').addEventListener('click', salvarMedicao);
$('md-obra').addEventListener('change', montarItens);
$('md-status').addEventListener('change', aoMudarStatus);
// previsão de recebimento: prazo (a partir do fim do período, ou de hoje) preenche a data;
// digitar a data à mão limpa o prazo — o último que você mexer vale
const mdAtualizarPrevisao = () => {
    const n = parseInt($('md-prazo-receb').value);
    if (isFinite(n) && n >= 1) {
        $('md-previsao').value = somarPrazo($('md-ate').value || hojeLocal(), n, $('md-prazo-receb-tipo').value);
    }
};
$('md-prazo-receb').addEventListener('change', mdAtualizarPrevisao);
$('md-prazo-receb-tipo').addEventListener('change', mdAtualizarPrevisao);
$('md-ate').addEventListener('change', mdAtualizarPrevisao);
$('md-previsao').addEventListener('change', () => { $('md-prazo-receb').value = ''; });
$('md-retencao').addEventListener('input', recalcTotais);
$('md-desconto').addEventListener('input', recalcTotais);
$('nf-btn-add').addEventListener('click', registrarNf);

carregarTudo().then(() => {
    const id = new URLSearchParams(window.location.search).get('editar');
    if (id) {
        const m = medicoes.find(x => x.id === id);
        if (m) abrirModal(m);
    }
});
