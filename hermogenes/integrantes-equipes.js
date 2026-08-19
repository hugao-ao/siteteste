// integrantes-equipes.js — Cadastro de integrantes (funções gerenciáveis, vínculos)
// e equipes (cor, líder, membros, custo/dia). Agenda e Produção×Custo: próxima etapa.
import { sb, toast, ligarFecharPorBackdrop, esc, fmtMoeda, mascaraCPF } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const VINCULO_LABEL = { diarista: 'Diarista', mensalista: 'Mensalista', empreiteiro: 'Empreiteiro' };

let funcoes = [];
let integrantes = [];
let equipes = [];
let selecionados = new Set();
let intEditando = null;
let eqEditando = null;
let membrosMarcados = new Set();

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [f, i, e] = await Promise.all([
        sb.from('hermo_funcoes').select('*').order('nome'),
        sb.from('hermo_integrantes').select('*, funcao:hermo_funcoes(id, nome)').order('nome'),
        sb.from('hermo_equipes').select('*, lider:hermo_integrantes!hermo_equipes_lider_id_fkey(id, nome), membros:hermo_equipe_membros(integrante_id)').order('nome')
    ]);
    if (f.error) { toast('Erro ao carregar funções: ' + f.error.message, true); return; }
    if (i.error) { toast('Erro ao carregar integrantes: ' + i.error.message, true); return; }
    if (e.error) { toast('Erro ao carregar equipes: ' + e.error.message, true); return; }
    funcoes = f.data || [];
    integrantes = i.data || [];
    equipes = (e.data || []).map(q => ({ ...q, membroIds: (q.membros || []).map(m => m.integrante_id) }));
    selecionados = new Set([...selecionados].filter(id => integrantes.some(x => x.id === id)));
    popularFiltroFuncao();
    renderResumo();
    renderIntegrantes();
    renderEquipes();
    renderSelbar();
}

function custoDia(i) {
    if (i.vinculo === 'diarista') return num(i.valor_diaria);
    if (i.vinculo === 'mensalista') return num(i.salario_mensal) / 22; // ~22 dias úteis
    return 0; // empreiteiro: por serviço combinado
}

function renderResumo() {
    const ativos = integrantes.filter(i => i.ativo);
    const emEquipe = new Set(equipes.flatMap(q => q.membroIds));
    const semEquipe = ativos.filter(i => !emEquipe.has(i.id)).length;
    const custoTotalDia = ativos.reduce((t, i) => t + custoDia(i), 0);
    $('resumo').innerHTML = `
        <div class="stat"><div class="num">${ativos.length}</div><div class="lbl">Integrantes ativos</div></div>
        <div class="stat s-marcada"><div class="num">${equipes.length}</div><div class="lbl">Equipes</div></div>
        <div class="stat s-pendente"><div class="num">${semEquipe}</div><div class="lbl">Ativos sem equipe</div></div>
        <div class="stat s-concluida"><div class="num">${fmtMoeda(custoTotalDia)}</div><div class="lbl">Custo/dia da folha ativa</div></div>
        <div class="stat s-pendencias"><div class="num">${integrantes.length - ativos.length}</div><div class="lbl">Inativos</div></div>`;
}

// ============================================================
// INTEGRANTES
// ============================================================
function popularFiltroFuncao() {
    const sel = $('filtro-funcao');
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas as funções</option>';
    funcoes.forEach(f => {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.nome;
        sel.appendChild(o);
    });
    if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
}

function integrantesFiltrados() {
    const q = $('busca').value.trim().toLowerCase();
    const fn = $('filtro-funcao').value;
    const inativos = $('mostrar-inativos').checked;
    return integrantes.filter(i =>
        (inativos || i.ativo) &&
        (!fn || i.funcao_id === fn) &&
        (!q || (i.nome || '').toLowerCase().includes(q) ||
               (i.apelido || '').toLowerCase().includes(q) ||
               (i.funcao?.nome || '').toLowerCase().includes(q)));
}

function valorVinculo(i) {
    if (i.vinculo === 'diarista') return i.valor_diaria ? fmtMoeda(i.valor_diaria) + '/dia' : '—';
    if (i.vinculo === 'mensalista') return i.salario_mensal ? fmtMoeda(i.salario_mensal) + '/mês' : '—';
    return 'por serviço';
}

function renderIntegrantes() {
    const lista = integrantesFiltrados();
    $('vazio-int').style.display = lista.length ? 'none' : '';
    $('corpo-int').innerHTML = lista.map(i => `
        <tr style="${i.ativo ? '' : 'opacity:.55'}">
            <td><input type="checkbox" class="check" data-check="${i.id}" ${selecionados.has(i.id) ? 'checked' : ''} style="transform:scale(1.15);accent-color:var(--hermo-primary)" /></td>
            <td><b>${esc(i.nome)}</b>${i.apelido ? ` <span style="color:var(--hermo-text-dim)">(${esc(i.apelido)})</span>` : ''}${i.ativo ? '' : ' <span class="badge-inativo">inativo</span>'}</td>
            <td>${esc(i.funcao?.nome || '—')}</td>
            <td>${VINCULO_LABEL[i.vinculo] || i.vinculo}</td>
            <td>${valorVinculo(i)}</td>
            <td>${esc(i.whatsapp || '—')}</td>
            <td>
                <button class="hermo-btn small ghost" data-editar="${i.id}">✎</button>
                <button class="hermo-btn small danger" data-excluir="${i.id}">🗑</button>
            </td>
        </tr>`).join('');

    $('corpo-int').querySelectorAll('[data-check]').forEach(ch => ch.addEventListener('change', e => {
        if (e.target.checked) selecionados.add(e.target.dataset.check);
        else selecionados.delete(e.target.dataset.check);
        renderSelbar();
    }));
    $('corpo-int').querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click',
        () => abrirModalIntegrante(integrantes.find(i => i.id === b.dataset.editar))));
    $('corpo-int').querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click',
        () => excluirIntegrantes([b.dataset.excluir])));
}

function renderSelbar() {
    $('selbar').classList.toggle('ativa', selecionados.size > 0);
    $('selbar-info').textContent = `${selecionados.size} selecionado(s)`;
}

async function excluirIntegrantes(ids) {
    const n = ids.length;
    const nomes = ids.map(id => integrantes.find(i => i.id === id)?.nome).filter(Boolean).slice(0, 4).join(', ');
    if (!confirm(`Excluir ${n === 1 ? 'o integrante ' + nomes : n + ' integrantes'}?\n\n` +
        `⚠ Alocações de cronograma e ausências dele(s) serão removidas junto. ` +
        `Se quiser preservar o histórico, use "Inativar" em vez de excluir.`)) return;
    const { error } = await sb.from('hermo_integrantes').delete().in('id', ids);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast(n === 1 ? 'Integrante excluído.' : `${n} integrantes excluídos.`);
    await carregarTudo();
}

async function mudarAtivo(ids, ativo) {
    if (ids.length === 0) return;
    const { error } = await sb.from('hermo_integrantes').update({ ativo }).in('id', ids);
    if (error) { toast('Erro: ' + error.message, true); return; }
    toast(`${ids.length} integrante(s) ${ativo ? 'reativado(s)' : 'inativado(s)'}.`);
    selecionados.clear();
    await carregarTudo();
}

// ---------- modal integrante ----------
function popularSelectFuncao(selecionarId = null) {
    const sel = $('mi-funcao');
    sel.innerHTML = '<option value="">— sem função —</option>';
    funcoes.forEach(f => {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.nome;
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
}

function aoMudarVinculo() {
    const v = $('mi-vinculo').value;
    $('mi-valor-label').textContent =
        v === 'diarista' ? 'Valor da diária (R$)' :
        v === 'mensalista' ? 'Salário mensal (R$)' : 'Valor combinado (informativo)';
}

function abrirModalIntegrante(i) {
    intEditando = i || null;
    $('mi-titulo').textContent = i ? 'Editar integrante' : 'Novo integrante';
    $('mi-nome').value = i?.nome || '';
    $('mi-apelido').value = i?.apelido || '';
    popularSelectFuncao(i?.funcao_id || null);
    $('mi-whatsapp').value = i?.whatsapp || '';
    $('mi-cpf').value = i?.cpf || '';
    $('mi-pix').value = i?.pix || '';
    $('mi-vinculo').value = i?.vinculo || 'diarista';
    $('mi-valor').value = i ? (i.vinculo === 'mensalista' ? (i.salario_mensal ?? '') : (i.valor_diaria ?? '')) : '';
    $('mi-obs').value = i?.observacoes || '';
    $('mi-ativo-wrap').style.display = i ? '' : 'none';
    $('mi-ativo').checked = i ? !!i.ativo : true;
    $('mi-nova-funcao-wrap').style.display = 'none';
    aoMudarVinculo();
    $('mi-overlay').classList.add('aberto');
    $('mi-nome').focus();
}

function fecharModalIntegrante() {
    $('mi-overlay').classList.remove('aberto');
    intEditando = null;
}

async function salvarIntegrante() {
    const nome = $('mi-nome').value.trim();
    if (!nome) { toast('Nome é obrigatório.', true); return; }
    const vinculo = $('mi-vinculo').value;
    const valor = num($('mi-valor').value);
    const registro = {
        nome,
        apelido: $('mi-apelido').value.trim() || null,
        funcao_id: $('mi-funcao').value || null,
        whatsapp: $('mi-whatsapp').value.trim() || null,
        cpf: $('mi-cpf').value.trim() || null,
        pix: $('mi-pix').value.trim() || null,
        vinculo,
        valor_diaria: vinculo === 'diarista' ? (valor || null) : null,
        salario_mensal: vinculo === 'mensalista' ? (valor || null) : null,
        ativo: intEditando ? $('mi-ativo').checked : true,
        observacoes: $('mi-obs').value.trim() || null
    };
    const btn = $('mi-salvar');
    btn.disabled = true;
    try {
        const res = intEditando
            ? await sb.from('hermo_integrantes').update(registro).eq('id', intEditando.id)
            : await sb.from('hermo_integrantes').insert(registro);
        if (res.error) throw res.error;
        toast(intEditando ? 'Integrante atualizado.' : 'Integrante adicionado.');
        fecharModalIntegrante();
        await carregarTudo();
    } catch (e) {
        toast('Erro ao salvar: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

async function salvarNovaFuncao() {
    const nome = $('mi-nova-funcao').value.trim();
    if (!nome) { toast('Informe o nome da função.', true); return; }
    const { data, error } = await sb.from('hermo_funcoes').insert({ nome }).select().single();
    if (error) {
        toast((error.code || '') === '23505' ? 'Essa função já existe.' : 'Erro: ' + error.message, true);
        return;
    }
    funcoes.push(data);
    funcoes.sort((a, b) => a.nome.localeCompare(b.nome));
    popularSelectFuncao(data.id);
    popularFiltroFuncao();
    $('mi-nova-funcao-wrap').style.display = 'none';
    $('mi-nova-funcao').value = '';
    toast('Função criada.');
}

// ============================================================
// EQUIPES
// ============================================================
function custoDiaEquipe(q) {
    return q.membroIds.reduce((t, id) => {
        const i = integrantes.find(x => x.id === id);
        return t + (i ? custoDia(i) : 0);
    }, 0);
}

function renderEquipes() {
    $('vazio-eq').style.display = equipes.length ? 'none' : '';
    $('lista-equipes').innerHTML = equipes.map(q => {
        const tags = q.membroIds.map(id => {
            const i = integrantes.find(x => x.id === id);
            return i ? `<span class="tag">${esc(i.apelido || i.nome.split(' ')[0])}${i.ativo ? '' : ' (inativo)'}</span>` : '';
        }).join('');
        return `
        <div class="ie-equipe" style="border-left-color:${q.cor || '#f59e0b'}">
            <div class="nome">${esc(q.nome)}</div>
            <div class="meta">👑 ${esc(q.lider?.nome || 'sem líder')} · ${q.membroIds.length} membro(s) · custo/dia ${fmtMoeda(custoDiaEquipe(q))}</div>
            <div class="membros">${tags || '<span style="color:var(--hermo-text-dim);font-size:.78rem">sem membros</span>'}</div>
            ${q.observacoes ? `<div class="meta">${esc(q.observacoes)}</div>` : ''}
            <div class="acoes">
                <button class="hermo-btn small ghost" data-eq-editar="${q.id}">✎ Editar</button>
                <button class="hermo-btn small danger" data-eq-excluir="${q.id}">🗑 Excluir</button>
            </div>
        </div>`;
    }).join('');
    $('lista-equipes').querySelectorAll('[data-eq-editar]').forEach(b => b.addEventListener('click',
        () => abrirModalEquipe(equipes.find(q => q.id === b.dataset.eqEditar))));
    $('lista-equipes').querySelectorAll('[data-eq-excluir]').forEach(b => b.addEventListener('click',
        () => excluirEquipe(b.dataset.eqExcluir)));
}

function abrirModalEquipe(q) {
    eqEditando = q || null;
    membrosMarcados = new Set(q?.membroIds || []);
    $('me-titulo').textContent = q ? 'Editar equipe' : 'Nova equipe';
    $('me-nome').value = q?.nome || '';
    $('me-cor').value = q?.cor || '#f59e0b';
    $('me-obs').value = q?.observacoes || '';
    $('me-busca-membro').value = '';
    popularLiderSelect(q?.lider_id || null);
    renderMembrosCheck();
    $('me-overlay').classList.add('aberto');
    $('me-nome').focus();
}

function popularLiderSelect(selecionarId = null) {
    const sel = $('me-lider');
    sel.innerHTML = '<option value="">— sem líder definido —</option>';
    // ativos + o líder atual mesmo se inativo (para não apagá-lo em silêncio ao salvar)
    integrantes.filter(i => i.ativo || i.id === selecionarId).forEach(i => {
        const o = document.createElement('option');
        o.value = i.id;
        o.textContent = i.nome + (i.funcao?.nome ? ` (${i.funcao.nome})` : '') + (i.ativo ? '' : ' (inativo)');
        sel.appendChild(o);
    });
    if (selecionarId) sel.value = selecionarId;
}

function renderMembrosCheck() {
    const q = $('me-busca-membro').value.trim().toLowerCase();
    const lista = integrantes.filter(i =>
        (i.ativo || membrosMarcados.has(i.id)) &&
        (!q || i.nome.toLowerCase().includes(q) || (i.apelido || '').toLowerCase().includes(q)));
    // aviso quando o integrante já está em outra equipe
    $('me-membros').innerHTML = lista.length === 0
        ? '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhum integrante encontrado.</div>'
        : lista.map(i => {
            const outras = equipes
                .filter(e => e.id !== eqEditando?.id && e.membroIds.includes(i.id))
                .map(e => e.nome);
            return `
            <label class="lc-item ${outras.length ? 'conflito' : ''}">
                <input type="checkbox" data-membro="${i.id}" ${membrosMarcados.has(i.id) ? 'checked' : ''} />
                <div class="txt"><b>${esc(i.nome)}</b>${i.apelido ? ' (' + esc(i.apelido) + ')' : ''}
                    <small>${esc(i.funcao?.nome || 'sem função')} · ${valorVinculo(i)}${outras.length ? ' · ⚠ também na equipe: ' + esc(outras.join(', ')) : ''}</small>
                </div>
            </label>`;
        }).join('');
    $('me-membros').querySelectorAll('[data-membro]').forEach(c => c.addEventListener('change', e => {
        if (e.target.checked) membrosMarcados.add(e.target.dataset.membro);
        else membrosMarcados.delete(e.target.dataset.membro);
        atualizarCustoDiaPreview();
    }));
    atualizarCustoDiaPreview();
}

function atualizarCustoDiaPreview() {
    const total = [...membrosMarcados].reduce((t, id) => {
        const i = integrantes.find(x => x.id === id);
        return t + (i ? custoDia(i) : 0);
    }, 0);
    $('me-custo-dia').textContent = fmtMoeda(total);
}

async function salvarEquipe() {
    const nome = $('me-nome').value.trim();
    if (!nome) { toast('Nome da equipe é obrigatório.', true); return; }
    const lider = $('me-lider').value || null;
    // líder entra como membro SEM mutar o estado do modal (falha no RPC não deixa resíduo)
    const membros = [...membrosMarcados];
    if (lider && !membros.includes(lider)) membros.push(lider);
    const btn = $('me-salvar');
    btn.disabled = true;
    try {
        const { error } = await sb.rpc('hermo_salvar_equipe', { p: {
            id: eqEditando?.id || null,
            nome,
            cor: $('me-cor').value,
            lider_id: lider,
            observacoes: $('me-obs').value.trim() || null,
            membros
        } });
        if (error) throw error;
        toast(eqEditando ? 'Equipe atualizada.' : 'Equipe criada.');
        $('me-overlay').classList.remove('aberto');
        eqEditando = null;
        await carregarTudo();
    } catch (e) {
        toast('Erro ao salvar equipe: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

async function excluirEquipe(id) {
    const q = equipes.find(x => x.id === id);
    if (!confirm(`Excluir a equipe "${q?.nome}"?\nOs integrantes continuam cadastrados — só o agrupamento é removido.`)) return;
    const { error } = await sb.from('hermo_equipes').delete().eq('id', id);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast('Equipe excluída.');
    await carregarTudo();
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('btn-novo-int').addEventListener('click', () => abrirModalIntegrante(null));
$('busca').addEventListener('input', renderIntegrantes);
$('filtro-funcao').addEventListener('change', renderIntegrantes);
$('mostrar-inativos').addEventListener('change', renderIntegrantes);

$('btn-sel-todos').addEventListener('click', () => {
    integrantesFiltrados().forEach(i => selecionados.add(i.id));
    renderIntegrantes();
    renderSelbar();
});
$('btn-sel-limpar').addEventListener('click', () => { selecionados.clear(); renderIntegrantes(); renderSelbar(); });
$('btn-sel-inativar').addEventListener('click', () => mudarAtivo([...selecionados], false));
$('btn-sel-ativar').addEventListener('click', () => mudarAtivo([...selecionados], true));
$('btn-sel-excluir').addEventListener('click', () => excluirIntegrantes([...selecionados]));

$('mi-fechar').addEventListener('click', fecharModalIntegrante);
$('mi-cancelar').addEventListener('click', fecharModalIntegrante);
ligarFecharPorBackdrop($('mi-overlay'), fecharModalIntegrante);
$('mi-salvar').addEventListener('click', salvarIntegrante);
$('mi-vinculo').addEventListener('change', aoMudarVinculo);
$('mi-cpf').addEventListener('input', e => { e.target.value = mascaraCPF(e.target.value); });
$('mi-btn-nova-funcao').addEventListener('click', () => {
    const w = $('mi-nova-funcao-wrap');
    w.style.display = w.style.display === 'none' ? '' : 'none';
});
$('mi-btn-salvar-funcao').addEventListener('click', salvarNovaFuncao);

$('btn-nova-eq').addEventListener('click', () => abrirModalEquipe(null));
$('me-fechar').addEventListener('click', () => $('me-overlay').classList.remove('aberto'));
$('me-cancelar').addEventListener('click', () => $('me-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('me-overlay'), () => $('me-overlay').classList.remove('aberto'));
$('me-salvar').addEventListener('click', salvarEquipe);
$('me-busca-membro').addEventListener('input', renderMembrosCheck);

carregarTudo();
