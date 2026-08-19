// servicos.js — Catálogo de serviços + precificação completa (custos, preços, imposto, DRE, fornecedores)
// A precificação é editável APENAS aqui; nas demais páginas ela é somente leitura.
import { sb, toast, ligarFecharPorBackdrop, esc, fmtMoeda } from './hermo-common.js';

let servicos = [];
let editando = null;          // serviço em edição (null = novo)
const $ = id => document.getElementById(id);

// ---------- estado da precificação (só na edição) ----------
let precos = null;            // {custo_mo, mo_propria, preco_mo, preco_material, preco_final, aliquota}
let itens = [];               // [{tipo:'material'|'outro', nome, modo, preco_direto, preco_embalagem, rendimento, custo_unit, locais:[]}]
let moLocais = [];            // [{nome, contato, observacao}]
let dirty = { p4: false, p5: false, p6: false };   // se o usuário editou 4/5/6 na mão
let itemEditIndex = null;     // índice em `itens` sendo editado no sub-modal (null = novo)
let itemTipoAtual = 'material';
let itemLocais = [];          // locais do item aberto no sub-modal
let mslEditIndex = null;      // índice em moLocais sendo editado
let ilEditIndex = null;       // índice em itemLocais sendo editado
let precificacaoOk = false;   // as 3 consultas de precificação carregaram sem erro
let precificacaoExistia = false; // já havia linha em hermo_servico_precos

const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
// comparação monetária com tolerância de 1 centavo (evita falso "editado na mão" por float)
const aprox = (a, b) => Math.abs(num(a) - num(b)) < 0.01;

// ============================================================
// LISTAGEM
// ============================================================
async function carregar() {
    const { data, error } = await sb.from('hermo_servicos')
        .select('*, precos:hermo_servico_precos(*), custos:hermo_servico_custo_itens(tipo, custo_unit)')
        .order('codigo');
    if (error) { toast('Erro ao carregar serviços: ' + error.message, true); return; }
    servicos = (data || []).map(s => ({
        ...s,
        precos: Array.isArray(s.precos) ? s.precos[0] || null : s.precos
    }));
    renderResumo();
    render();
}

function somaOutros(s) {
    return (s.custos || []).filter(c => c.tipo === 'outro').reduce((t, c) => t + num(c.custo_unit), 0);
}

function somaMateriais(s) {
    return (s.custos || []).filter(c => c.tipo === 'material').reduce((t, c) => t + num(c.custo_unit), 0);
}

function resultadoReal(s) {
    const p = s.precos;
    if (!p) return null;
    const a = num(p.aliquota) / 100;
    // preço final líquido de imposto − outros custos − custo MO − custo material
    return num(p.preco_final) * (1 - a) - somaOutros(s) - num(p.custo_mo) - somaMateriais(s);
}

function renderResumo() {
    const precificados = servicos.filter(s => s.precos).length;
    $('resumo').innerHTML = `
        <div class="stat"><div class="num">${servicos.length}</div><div class="lbl">Serviços no catálogo</div></div>
        <div class="stat s-concluida"><div class="num">${precificados}</div><div class="lbl">Com precificação</div></div>
        <div class="stat s-pendente"><div class="num">${servicos.length - precificados}</div><div class="lbl">Sem precificação</div></div>`;
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
    $('corpo').innerHTML = lista.map(s => {
        const rr = resultadoReal(s);
        return `
        <tr>
            <td><b>${esc(s.codigo)}</b></td>
            <td>${esc(s.descricao)}</td>
            <td>${esc(s.unidade || '—')}</td>
            <td>${s.precos ? fmtMoeda(s.precos.preco_final) : '—'}</td>
            <td>${rr == null ? '—' : `<span class="val ${rr >= 0 ? 'pos' : 'neg'}" style="font-weight:700">${fmtMoeda(rr)}</span>`}</td>
            <td>
                <button class="hermo-btn small ghost" data-editar="${s.id}" title="Editar (inclui custos e preços)">✎</button>
                <button class="hermo-btn small danger" data-excluir="${s.id}" title="Excluir">🗑</button>
            </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('[data-editar]').forEach(b =>
        b.addEventListener('click', () => abrirModal(servicos.find(x => x.id === b.dataset.editar))));
    document.querySelectorAll('[data-excluir]').forEach(b =>
        b.addEventListener('click', () => excluir(b.dataset.excluir)));
}

// ============================================================
// MODAL DO SERVIÇO
// ============================================================
async function abrirModal(servico) {
    editando = servico || null;
    $('msv-titulo').textContent = servico ? `Editar serviço ${servico.codigo}` : 'Novo serviço';
    $('msv-codigo').value = servico?.codigo || '';
    $('msv-descricao').value = servico?.descricao || '';
    $('msv-detalhe').value = servico?.detalhe || '';
    $('msv-unidade').value = servico?.unidade || '';

    $('sv-aviso-novo').style.display = servico ? 'none' : '';
    $('sv-aviso-erro').style.display = 'none';
    $('sv-precificacao').style.display = servico ? 'flex' : 'none';

    if (servico) {
        atualizarUnidadeLabels();
        popularImportSelect();
        await carregarPrecificacao(servico.id);
    }

    $('msv-overlay').classList.add('aberto');
    $('msv-codigo').focus();
}

function atualizarUnidadeLabels() {
    const un = $('msv-unidade').value.trim() || 'un';
    document.querySelectorAll('.sv-un').forEach(el => el.textContent = un);
}

/** Busca a precificação completa de um serviço (usada na carga do modal e na importação). */
async function buscarPrecificacaoDe(servicoId) {
    const [pRes, iRes, lRes] = await Promise.all([
        sb.from('hermo_servico_precos').select('*').eq('servico_id', servicoId).maybeSingle(),
        sb.from('hermo_servico_custo_itens').select('*, locais:hermo_servico_locais(*)').eq('servico_id', servicoId).order('ordem'),
        sb.from('hermo_servico_locais').select('*').eq('servico_id', servicoId).eq('tipo_ref', 'mao_obra')
    ]);
    const erro = pRes.error || iRes.error || lRes.error;
    if (erro) return { erro };
    return {
        erro: null,
        existia: !!pRes.data,
        precos: pRes.data || { custo_mo: 0, mo_propria: true, preco_mo: 0, preco_material: 0, preco_final: 0, aliquota: 0 },
        itens: (iRes.data || []).map(i => ({
            tipo: i.tipo, nome: i.nome, modo: i.modo,
            preco_direto: i.preco_direto, preco_embalagem: i.preco_embalagem, rendimento: i.rendimento,
            custo_unit: num(i.custo_unit),
            locais: (i.locais || []).map(l => ({ nome: l.nome, contato: l.contato || '', observacao: l.observacao || '' }))
        })),
        moLocais: (lRes.data || []).map(l => ({ nome: l.nome, contato: l.contato || '', observacao: l.observacao || '' }))
    };
}

async function carregarPrecificacao(servicoId) {
    const r = await buscarPrecificacaoDe(servicoId);
    if (r.erro) {
        // NUNCA deixar salvar por cima de dados que não conseguimos ler:
        // esconde a precificação e o salvar() pula a RPC (precificacaoOk=false)
        precificacaoOk = false;
        $('sv-precificacao').style.display = 'none';
        $('sv-aviso-erro').style.display = '';
        toast('Erro ao carregar precificação: ' + r.erro.message, true);
        return;
    }
    precificacaoOk = true;
    precificacaoExistia = r.existia;
    precos = r.precos;
    itens = r.itens;
    moLocais = r.moLocais;

    // um preço manual anterior conta como "editado na mão" se difere do espelho
    // (tolerância de 1 centavo — arredondamento de float não pode desligar o espelho)
    dirty.p4 = !aprox(precos.preco_mo, precos.custo_mo);
    dirty.p5 = !aprox(precos.preco_material, totalTipo('material'));
    dirty.p6 = !aprox(precos.preco_final, num(precos.preco_mo) + num(precos.preco_material));

    $('sv-custo-mo').value = precos.custo_mo || '';
    $('sv-mo-propria').value = String(precos.mo_propria !== false);
    $('sv-preco-mo').value = precos.preco_mo || '';
    $('sv-preco-material').value = precos.preco_material || '';
    $('sv-preco-final').value = precos.preco_final || '';
    $('sv-aliquota').value = precos.aliquota || '';

    renderItens();
    renderMoLocais();
    recalc();
}

function fecharModal() {
    $('msv-overlay').classList.remove('aberto');
    editando = null;
    precos = null;
    itens = [];
    moLocais = [];
    dirty = { p4: false, p5: false, p6: false };
}

function totalTipo(tipo) {
    return itens.filter(i => i.tipo === tipo).reduce((t, i) => t + num(i.custo_unit), 0);
}

/** Recalcula prefills (4←1, 5←2, 6←4+5), imposto e demonstrativo. */
function recalc() {
    if (!editando) return;
    const c1 = num($('sv-custo-mo').value);
    const c2 = totalTipo('material');
    const c3 = totalTipo('outro');

    if (!dirty.p4) $('sv-preco-mo').value = c1 ? c1.toFixed(2) : '';
    const p4 = num($('sv-preco-mo').value);
    if (!dirty.p5) $('sv-preco-material').value = c2 ? c2.toFixed(2) : '';
    const p5 = num($('sv-preco-material').value);
    if (!dirty.p6) $('sv-preco-final').value = (p4 + p5) ? (p4 + p5).toFixed(2) : '';
    const p6 = num($('sv-preco-final').value);

    const a = num($('sv-aliquota').value) / 100;

    $('sv-total-material').textContent = fmtMoeda(c2);
    $('sv-total-outros').textContent = fmtMoeda(c3);
    $('sv-imposto-valor').textContent = fmtMoeda(p6 * a);

    const dre = [
        ['dre-mo', p4 - p4 * a - c1],
        ['dre-mat', p5 - p5 * a - c2],
        ['dre-parcial', p6 - p6 * a],
        // resultado REAL: desconta outros custos E os custos de MO e material
        ['dre-real', p6 - p6 * a - c3 - c1 - c2]
    ];
    dre.forEach(([id, v]) => {
        const el = $(id);
        el.textContent = fmtMoeda(v);
        el.classList.toggle('pos', v >= 0);
        el.classList.toggle('neg', v < 0);
    });

    $('sv-mo-locais-wrap').style.display = $('sv-mo-propria').value === 'false' ? 'flex' : 'none';
}

// ---------- listas de itens ----------
function renderItens() {
    ['material', 'outro'].forEach(tipo => {
        const cont = $(tipo === 'material' ? 'sv-materiais' : 'sv-outros');
        const doTipo = itens.map((i, idx) => ({ i, idx })).filter(x => x.i.tipo === tipo);
        cont.innerHTML = doTipo.length === 0
            ? `<div style="font-size:.78rem;color:var(--hermo-text-dim)">Nenhum item.</div>`
            : doTipo.map(({ i, idx }) => `
                <div class="sv-item">
                    <div class="txt">
                        <b>${esc(i.nome)}</b> — ${fmtMoeda(i.custo_unit)}/${esc($('msv-unidade').value.trim() || 'un')}
                        <small>${i.modo === 'embalagem'
                            ? `embalagem ${fmtMoeda(i.preco_embalagem)} ÷ rende ${i.rendimento}`
                            : 'preço direto na unidade'}${i.locais.length ? ` · 📍 ${i.locais.length} local(is)` : ''}</small>
                    </div>
                    <button class="hermo-btn small ghost" data-item-editar="${idx}">✎</button>
                    <button class="hermo-btn small danger" data-item-remover="${idx}">🗑</button>
                </div>`).join('');
    });
    document.querySelectorAll('[data-item-editar]').forEach(b =>
        b.addEventListener('click', () => abrirItemModal(null, parseInt(b.dataset.itemEditar))));
    document.querySelectorAll('[data-item-remover]').forEach(b =>
        b.addEventListener('click', () => {
            itens.splice(parseInt(b.dataset.itemRemover), 1);
            renderItens();
            recalc();
        }));
}

function renderMoLocais() {
    const cont = $('sv-mo-locais');
    cont.innerHTML = moLocais.length === 0
        ? `<div style="font-size:.76rem;color:var(--hermo-text-dim)">Nenhum local cadastrado.</div>`
        : moLocais.map((l, i) => `
            <div class="sv-local">
                <div class="txt"><b>${esc(l.nome)}</b>${l.contato ? ' · ' + esc(l.contato) : ''}${l.observacao ? ' · ' + esc(l.observacao) : ''}</div>
                <button class="hermo-btn small ghost" data-mol-editar="${i}">✎</button>
                <button class="hermo-btn small danger" data-mol-remover="${i}">🗑</button>
            </div>`).join('');
    cont.querySelectorAll('[data-mol-editar]').forEach(b =>
        b.addEventListener('click', () => abrirMoLocalModal(parseInt(b.dataset.molEditar))));
    cont.querySelectorAll('[data-mol-remover]').forEach(b =>
        b.addEventListener('click', () => { moLocais.splice(parseInt(b.dataset.molRemover), 1); renderMoLocais(); }));
}

// ============================================================
// IMPORTAR PRECIFICAÇÃO DE OUTRO SERVIÇO
// ============================================================
function popularImportSelect() {
    const sel = $('sv-import-servico');
    sel.innerHTML = '<option value="">— escolha o serviço de origem —</option>';
    servicos
        .filter(s => s.id !== editando?.id && (s.precos || (s.custos || []).length > 0))
        .forEach(s => {
            const o = document.createElement('option');
            o.value = s.id;
            o.textContent = `${s.codigo} — ${s.descricao}` +
                (s.precos?.preco_final ? ` (${fmtMoeda(s.precos.preco_final)}/${s.unidade || 'un'})` : '');
            sel.appendChild(o);
        });
    $('sv-import-aviso-un').style.display = 'none';
}

function avisarUnidadeImport() {
    const s = servicos.find(x => x.id === $('sv-import-servico').value);
    const el = $('sv-import-aviso-un');
    const unAtual = $('msv-unidade').value.trim() || 'un';
    if (s && (s.unidade || 'un') !== unAtual) {
        el.style.display = '';
        el.textContent = `⚠ Unidades diferentes: a origem é por "${s.unidade || 'un'}" e este serviço é por "${unAtual}" — confira os valores após importar.`;
    } else {
        el.style.display = 'none';
    }
}

const copiaItem = i => ({ ...i, locais: (i.locais || []).map(l => ({ ...l })) });

async function importarPrecificacao() {
    const srcId = $('sv-import-servico').value;
    if (!srcId) { toast('Escolha o serviço de origem.', true); return; }
    const secoes = {
        mo: $('sv-imp-mo').checked,
        materiais: $('sv-imp-materiais').checked,
        outros: $('sv-imp-outros').checked,
        precos: $('sv-imp-precos').checked,
        imposto: $('sv-imp-imposto').checked
    };
    if (!Object.values(secoes).some(Boolean)) { toast('Marque ao menos uma seção para importar.', true); return; }

    const btn = $('sv-import-btn');
    btn.disabled = true;
    try {
        const src = await buscarPrecificacaoDe(srcId);
        if (src.erro) { toast('Erro ao ler o serviço de origem: ' + src.erro.message, true); return; }

        // aviso antes de substituir seções que já têm dados
        const sobrescreve =
            (secoes.mo && (num($('sv-custo-mo').value) !== 0 || moLocais.length > 0)) ||
            (secoes.materiais && itens.some(i => i.tipo === 'material')) ||
            (secoes.outros && itens.some(i => i.tipo === 'outro')) ||
            (secoes.precos && ['sv-preco-mo', 'sv-preco-material', 'sv-preco-final'].some(id => num($(id).value) !== 0)) ||
            (secoes.imposto && num($('sv-aliquota').value) !== 0);
        if (sobrescreve && !confirm('As seções marcadas que já têm dados serão SUBSTITUÍDAS pelos valores importados. Continuar?')) return;

        if (secoes.mo) {
            $('sv-custo-mo').value = src.precos.custo_mo || '';
            $('sv-mo-propria').value = String(src.precos.mo_propria !== false);
            moLocais = src.moLocais.map(l => ({ ...l }));
            renderMoLocais();
        }
        if (secoes.materiais) {
            itens = itens.filter(i => i.tipo !== 'material')
                .concat(src.itens.filter(i => i.tipo === 'material').map(copiaItem));
        }
        if (secoes.outros) {
            itens = itens.filter(i => i.tipo !== 'outro')
                .concat(src.itens.filter(i => i.tipo === 'outro').map(copiaItem));
        }
        if (secoes.materiais || secoes.outros) renderItens();
        if (secoes.precos) {
            $('sv-preco-mo').value = src.precos.preco_mo || '';
            $('sv-preco-material').value = src.precos.preco_material || '';
            $('sv-preco-final').value = src.precos.preco_final || '';
        }
        if (secoes.imposto) $('sv-aliquota').value = src.precos.aliquota || '';

        // recalibra os espelhos 4/5/6 para o novo estado (mesma regra da carga)
        dirty.p4 = !aprox($('sv-preco-mo').value, $('sv-custo-mo').value);
        dirty.p5 = !aprox($('sv-preco-material').value, totalTipo('material'));
        dirty.p6 = !aprox($('sv-preco-final').value, num($('sv-preco-mo').value) + num($('sv-preco-material').value));
        recalc();
        toast('Importação concluída — confira os valores e clique em Salvar para gravar.');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// SUB-MODAL: ITEM DE CUSTO
// ============================================================
function abrirItemModal(tipo, editIndex = null) {
    itemEditIndex = editIndex;
    const item = editIndex != null ? itens[editIndex] : null;
    itemTipoAtual = item ? item.tipo : tipo;
    itemLocais = item ? item.locais.map(l => ({ ...l })) : [];

    $('msi-titulo').textContent = (item ? 'Editar ' : 'Adicionar ') + (itemTipoAtual === 'material' ? 'material' : 'outro custo');
    $('msi-nome').value = item?.nome || '';
    $('msi-modo').value = item?.modo || 'direto';
    $('msi-preco-direto').value = item?.preco_direto ?? '';
    $('msi-preco-embalagem').value = item?.preco_embalagem ?? '';
    $('msi-rendimento').value = item?.rendimento ?? '';
    resetFormLocalItem();
    atualizarUnidadeLabels();
    aoMudarModoItem();
    renderItemLocais();
    $('msi-overlay').classList.add('aberto');
    $('msi-nome').focus();
}

function fecharItemModal() {
    $('msi-overlay').classList.remove('aberto');
    itemEditIndex = null;
    itemLocais = [];
}

function custoUnitAtual() {
    if ($('msi-modo').value === 'embalagem') {
        const pe = num($('msi-preco-embalagem').value);
        const r = num($('msi-rendimento').value);
        return r > 0 ? pe / r : 0;
    }
    return num($('msi-preco-direto').value);
}

function aoMudarModoItem() {
    const emb = $('msi-modo').value === 'embalagem';
    $('msi-wrap-direto').style.display = emb ? 'none' : '';
    $('msi-wrap-embalagem').style.display = emb ? 'flex' : 'none';
    recalcItem();
}

function recalcItem() {
    $('msi-custo-unit').textContent = fmtMoeda(custoUnitAtual());
    // simulador de embalagens (arredonda para cima o nº de embalagens)
    const pe = num($('msi-preco-embalagem').value);
    const r = num($('msi-rendimento').value);
    const sim = $('msi-simulador');
    if ($('msi-modo').value === 'embalagem' && pe > 0 && r > 0) {
        const un = $('msv-unidade').value.trim() || 'un';
        const exemplos = [1.5, 2.5].map(f => {
            const qtd = f * r;
            const emb = Math.ceil(qtd / r);
            return `${qtd} ${un} → ${emb} embalagem(ns) = ${fmtMoeda(emb * pe)} (${fmtMoeda((emb * pe) / qtd)}/${un})`;
        }).join('<br>');
        sim.innerHTML = `💡 Numa obra real as embalagens são inteiras (arredonda para cima). Ex.:<br>${exemplos}`;
    } else {
        sim.innerHTML = '';
    }
}

function renderItemLocais() {
    const cont = $('msi-locais');
    cont.innerHTML = itemLocais.length === 0
        ? `<div style="font-size:.76rem;color:var(--hermo-text-dim)">Nenhum local cadastrado.</div>`
        : itemLocais.map((l, i) => `
            <div class="sv-local">
                <div class="txt"><b>${esc(l.nome)}</b>${l.contato ? ' · ' + esc(l.contato) : ''}${l.observacao ? ' · ' + esc(l.observacao) : ''}</div>
                <button class="hermo-btn small ghost" data-il-editar="${i}">✎</button>
                <button class="hermo-btn small danger" data-il-remover="${i}">🗑</button>
            </div>`).join('');
    cont.querySelectorAll('[data-il-editar]').forEach(b =>
        b.addEventListener('click', () => {
            ilEditIndex = parseInt(b.dataset.ilEditar);
            const l = itemLocais[ilEditIndex];
            $('msi-local-nome').value = l.nome;
            $('msi-local-contato').value = l.contato || '';
            $('msi-local-obs').value = l.observacao || '';
            $('msi-btn-add-local').textContent = '✔ Salvar alteração do local';
            $('msi-local-nome').focus();
        }));
    cont.querySelectorAll('[data-il-remover]').forEach(b =>
        b.addEventListener('click', () => {
            const i = parseInt(b.dataset.ilRemover);
            itemLocais.splice(i, 1);
            if (ilEditIndex === i) resetFormLocalItem();
            else if (ilEditIndex != null && ilEditIndex > i) ilEditIndex--;
            renderItemLocais();
        }));
}

function resetFormLocalItem() {
    ilEditIndex = null;
    $('msi-local-nome').value = $('msi-local-contato').value = $('msi-local-obs').value = '';
    $('msi-btn-add-local').textContent = '+ Adicionar local';
}

function confirmarItem() {
    const nome = $('msi-nome').value.trim();
    if (!nome) { toast('Nome do item é obrigatório.', true); return; }
    const modo = $('msi-modo').value;
    if (modo === 'direto' && !$('msi-preco-direto').value) { toast('Informe o preço por unidade.', true); return; }
    if (modo === 'embalagem' && (!$('msi-preco-embalagem').value || num($('msi-rendimento').value) <= 0)) {
        toast('Informe o preço da embalagem e um rendimento maior que zero.', true); return;
    }
    const item = {
        tipo: itemTipoAtual,
        nome,
        modo,
        preco_direto: modo === 'direto' ? num($('msi-preco-direto').value) : null,
        preco_embalagem: modo === 'embalagem' ? num($('msi-preco-embalagem').value) : null,
        rendimento: modo === 'embalagem' ? num($('msi-rendimento').value) : null,
        custo_unit: Math.round(custoUnitAtual() * 10000) / 10000,
        locais: itemLocais
    };
    if (itemEditIndex != null) itens[itemEditIndex] = item;
    else itens.push(item);
    fecharItemModal();
    renderItens();
    recalc();
}

// ============================================================
// SUB-MODAL: LOCAL DE MÃO DE OBRA
// ============================================================
function abrirMoLocalModal(editIndex = null) {
    mslEditIndex = editIndex;
    const l = editIndex != null ? moLocais[editIndex] : null;
    $('msl-nome').value = l?.nome || '';
    $('msl-contato').value = l?.contato || '';
    $('msl-obs').value = l?.observacao || '';
    $('msl-overlay').classList.add('aberto');
    $('msl-nome').focus();
}

function confirmarMoLocal() {
    const nome = $('msl-nome').value.trim();
    if (!nome) { toast('Nome é obrigatório.', true); return; }
    const l = { nome, contato: $('msl-contato').value.trim(), observacao: $('msl-obs').value.trim() };
    if (mslEditIndex != null) moLocais[mslEditIndex] = l;
    else moLocais.push(l);
    $('msl-overlay').classList.remove('aberto');
    mslEditIndex = null;
    renderMoLocais();
}

// ============================================================
// SALVAR / EXCLUIR
// ============================================================
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
        let servicoId = editando?.id;
        if (editando) {
            const { error } = await sb.from('hermo_servicos').update(registro).eq('id', editando.id);
            if (error) throw error;
        } else {
            const { data, error } = await sb.from('hermo_servicos').insert(registro).select('id').single();
            if (error) throw error;
            servicoId = data.id;
        }

        // precificação: só na edição (regra do módulo), só se a carga dela funcionou,
        // e só se há algo a gravar (evita criar linha zerada num serviço nunca precificado)
        const temAlgo = ['sv-custo-mo', 'sv-preco-mo', 'sv-preco-material', 'sv-preco-final', 'sv-aliquota']
            .some(id => num($(id).value) !== 0) ||
            itens.length > 0 || moLocais.length > 0 || $('sv-mo-propria').value === 'false';
        if (editando && precificacaoOk && (precificacaoExistia || temAlgo)) {
            const payload = {
                servico_id: servicoId,
                precos: {
                    custo_mo: num($('sv-custo-mo').value),
                    mo_propria: $('sv-mo-propria').value === 'true',
                    preco_mo: num($('sv-preco-mo').value),
                    preco_material: num($('sv-preco-material').value),
                    preco_final: num($('sv-preco-final').value),
                    aliquota: num($('sv-aliquota').value)
                },
                itens: itens.map(i => ({
                    tipo: i.tipo, nome: i.nome, modo: i.modo,
                    preco_direto: i.preco_direto, preco_embalagem: i.preco_embalagem,
                    rendimento: i.rendimento, custo_unit: i.custo_unit,
                    locais: i.locais
                })),
                // sempre preserva os locais de MO — alternar para "própria" só os oculta na UI
                mo_locais: moLocais
            };
            const { error: ePrec } = await sb.rpc('hermo_salvar_servico_precos', { p: payload });
            if (ePrec) throw ePrec;
        }

        toast(editando ? 'Serviço e precificação salvos.' : 'Serviço criado — edite-o para preencher custos e preços.');
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
    if (!confirm(`Excluir o serviço "${s?.codigo} — ${s?.descricao}"?\nA precificação e os fornecedores dele também serão removidos.`)) return;
    const { error } = await sb.from('hermo_servicos').delete().eq('id', id);
    if (error) {
        if ((error.code || '') === '23503') {
            toast('Este serviço está vinculado a visitas, propostas ou obras e não pode ser excluído.', true);
        } else {
            toast('Erro ao excluir: ' + error.message, true);
        }
        return;
    }
    toast('Serviço excluído.');
    carregar();
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('btn-novo').addEventListener('click', () => abrirModal(null));
$('busca').addEventListener('input', render);
$('msv-fechar').addEventListener('click', fecharModal);
$('msv-cancelar').addEventListener('click', fecharModal);
ligarFecharPorBackdrop($('msv-overlay'), fecharModal);
$('msv-salvar').addEventListener('click', salvar);
$('msv-unidade').addEventListener('input', () => { atualizarUnidadeLabels(); renderItens(); });

// precificação
$('sv-custo-mo').addEventListener('input', recalc);
$('sv-mo-propria').addEventListener('change', recalc);
$('sv-preco-mo').addEventListener('input', () => { dirty.p4 = true; recalc(); });
$('sv-preco-material').addEventListener('input', () => { dirty.p5 = true; recalc(); });
$('sv-preco-final').addEventListener('input', () => { dirty.p6 = true; recalc(); });
$('sv-aliquota').addEventListener('input', recalc);
$('sv-reset-4').addEventListener('click', () => { dirty.p4 = false; recalc(); });
$('sv-reset-5').addEventListener('click', () => { dirty.p5 = false; recalc(); });
$('sv-reset-6').addEventListener('click', () => { dirty.p6 = false; recalc(); });
$('sv-import-btn').addEventListener('click', importarPrecificacao);
$('sv-import-servico').addEventListener('change', avisarUnidadeImport);
$('sv-btn-add-material').addEventListener('click', () => abrirItemModal('material'));
$('sv-btn-add-outro').addEventListener('click', () => abrirItemModal('outro'));
$('sv-btn-mo-local').addEventListener('click', () => abrirMoLocalModal(null));

// sub-modal item
$('msi-fechar').addEventListener('click', fecharItemModal);
$('msi-cancelar').addEventListener('click', fecharItemModal);
ligarFecharPorBackdrop($('msi-overlay'), fecharItemModal);
$('msi-confirmar').addEventListener('click', confirmarItem);
$('msi-modo').addEventListener('change', aoMudarModoItem);
['msi-preco-direto', 'msi-preco-embalagem', 'msi-rendimento'].forEach(id =>
    $(id).addEventListener('input', recalcItem));
$('msi-btn-add-local').addEventListener('click', () => {
    const nome = $('msi-local-nome').value.trim();
    if (!nome) { toast('Informe o nome do local.', true); return; }
    const l = {
        nome,
        contato: $('msi-local-contato').value.trim(),
        observacao: $('msi-local-obs').value.trim()
    };
    if (ilEditIndex != null) itemLocais[ilEditIndex] = l;
    else itemLocais.push(l);
    resetFormLocalItem();
    renderItemLocais();
});

// sub-modal local MO
$('msl-fechar').addEventListener('click', () => $('msl-overlay').classList.remove('aberto'));
$('msl-cancelar').addEventListener('click', () => $('msl-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('msl-overlay'), () => $('msl-overlay').classList.remove('aberto'));
$('msl-confirmar').addEventListener('click', confirmarMoLocal);

// abre direto em edição via ?editar=<id> (atalho vindo de outras páginas)
carregar().then(() => {
    const id = new URLSearchParams(window.location.search).get('editar');
    if (id) {
        const s = servicos.find(x => x.id === id);
        if (s) abrirModal(s);
    }
});
