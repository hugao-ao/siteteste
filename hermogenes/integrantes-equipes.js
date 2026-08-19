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
// agenda / produção
let alocacoes = [];
let ausencias = [];
let semanaBase = inicioDaSemana(new Date());

function hojeStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dataStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function inicioDaSemana(d) {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // segunda-feira
    x.setHours(0, 0, 0, 0);
    return x;
}
function somarDias(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [f, i, e, al, au] = await Promise.all([
        sb.from('hermo_funcoes').select('*').order('nome'),
        sb.from('hermo_integrantes').select('*, funcao:hermo_funcoes(id, nome)').order('nome'),
        sb.from('hermo_equipes').select('*, lider:hermo_integrantes!hermo_equipes_lider_id_fkey(id, nome), membros:hermo_equipe_membros(integrante_id)').order('nome'),
        sb.from('hermo_alocacoes')
            .select(`*, equipe:hermo_equipes(id, nome, cor),
                obra_servico:hermo_obra_servicos(id, total, perc_executado,
                    servico:hermo_servicos(codigo, descricao),
                    obra:hermo_obras(numero, ano, nome))`),
        sb.from('hermo_ausencias').select('*').order('data_inicio', { ascending: false })
    ]);
    if (f.error) { toast('Erro ao carregar funções: ' + f.error.message, true); return; }
    if (i.error) { toast('Erro ao carregar integrantes: ' + i.error.message, true); return; }
    if (e.error) { toast('Erro ao carregar equipes: ' + e.error.message, true); return; }
    if (al.error || au.error) { toast('Erro ao carregar agenda: ' + (al.error || au.error).message, true); }
    funcoes = f.data || [];
    integrantes = i.data || [];
    equipes = (e.data || []).map(q => ({ ...q, membroIds: (q.membros || []).map(m => m.integrante_id) }));
    alocacoes = al.data || [];
    ausencias = au.data || [];
    selecionados = new Set([...selecionados].filter(id => integrantes.some(x => x.id === id)));
    popularFiltroFuncao();
    renderResumo();
    renderIntegrantes();
    renderEquipes();
    renderSelbar();
    popularFiltroEquipeAgenda();
    renderAgenda();
    renderAusencias();
    renderProducao();
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
// AGENDA SEMANAL
// ============================================================
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

/** peso de produção/custo de um período do dia: dia=1, turno=0,5, horário=horas/8 */
function pesoTurno(turno, hi, hf) {
    if (turno === 'dia') return 1;
    if (turno === 'manha' || turno === 'tarde') return 0.5;
    const [a, b] = minutosTurno('horario', hi, hf);
    return Math.max(0, (b - a) / 60) / 8;
}

function ausenteNoDia(integranteId, diaStr, turno, hi, hf) {
    const bloco = { data_inicio: diaStr, data_fim: diaStr, turno, hora_inicio: hi, hora_fim: hf };
    return ausencias.some(a => a.integrante_id === integranteId && periodosConflitam(bloco, a));
}

function popularFiltroEquipeAgenda() {
    const sel = $('ag-filtro-equipe');
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas as equipes</option>';
    equipes.forEach(q => {
        const o = document.createElement('option');
        o.value = q.id;
        o.textContent = q.nome;
        sel.appendChild(o);
    });
    if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
}

function renderAgenda() {
    const dias = Array.from({ length: 7 }, (_, k) => somarDias(semanaBase, k));
    const diasStr = dias.map(dataStr);
    const hj = hojeStr();
    const fmt = d => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    $('ag-semana-label').textContent =
        `Semana de ${dias[0].toLocaleDateString('pt-BR')} a ${dias[6].toLocaleDateString('pt-BR')}`;

    const filtroEq = $('ag-filtro-equipe').value;
    const eq = equipes.find(q => q.id === filtroEq);
    const linhas = integrantes.filter(i => i.ativo && (!eq || eq.membroIds.includes(i.id)));

    let html = '<thead><tr><th style="min-width:130px">Integrante</th>' +
        dias.map((d, k) => `<th class="${diasStr[k] === hj ? 'hoje-col' : ''}">${fmt(d)}</th>`).join('') +
        '</tr></thead><tbody>';
    for (const i of linhas) {
        html += `<tr><td class="nome-col">${esc(i.apelido || i.nome.split(' ')[0])}<small>${esc(i.funcao?.nome || '')}</small></td>`;
        for (let k = 0; k < 7; k++) {
            const dia = diasStr[k];
            const blocos = [];
            alocacoes
                .filter(a => a.integrante_id === i.id && a.data_inicio <= dia && a.data_fim >= dia)
                .forEach(a => {
                    const ob = a.obra_servico?.obra;
                    const rotulo = `${ob ? 'OB-' + String(ob.numero).padStart(4, '0') : '?'} · ${a.obra_servico?.servico?.codigo || ''}`;
                    const turno = a.turno === 'horario'
                        ? `${(a.hora_inicio || '').slice(0, 5)}-${(a.hora_fim || '').slice(0, 5)}` : TURNO_LABEL_AG[a.turno];
                    blocos.push(`<span class="ag-bloco" style="background:${a.equipe?.cor || 'var(--hermo-primary)'}"
                        title="${esc(ob?.nome || '')} — ${esc(a.obra_servico?.servico?.descricao || '')} (${turno})">${rotulo} · ${turno}</span>`);
                });
            ausencias
                .filter(a => a.integrante_id === i.id && a.data_inicio <= dia && a.data_fim >= dia)
                .forEach(a => {
                    blocos.push(`<span class="ag-bloco ausencia ${a.tipo === 'falta' ? '' : 'suave'}"
                        title="${esc(a.motivo || a.tipo)}">${a.tipo}${a.turno !== 'dia' ? ' (' + TURNO_LABEL_AG[a.turno] + ')' : ''}</span>`);
                });
            html += `<td class="${dia === hj ? 'hoje-col' : ''}">${blocos.join('')}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';
    $('ag-grid').innerHTML = html;
}

const TURNO_LABEL_AG = { dia: 'dia', manha: 'manhã', tarde: 'tarde', horario: 'horário' };

// ---------- ausências ----------
function renderAusencias() {
    const cont = $('aus-lista');
    if (ausencias.length === 0) {
        cont.innerHTML = '<div style="font-size:.78rem;color:var(--hermo-text-dim)">Nenhuma ausência lançada.</div>';
        return;
    }
    cont.innerHTML = ausencias.slice(0, 30).map(a => {
        const i = integrantes.find(x => x.id === a.integrante_id);
        return `
        <div class="ob-item" style="background:var(--hermo-surface);border:1px solid var(--hermo-border);border-radius:8px;padding:7px 10px;display:flex;align-items:center;gap:8px;font-size:.82rem">
            <div style="flex:1"><b>${esc(i?.nome || '?')}</b> — ${a.tipo}${a.turno !== 'dia' ? ' (' + TURNO_LABEL_AG[a.turno] + ')' : ''}
                <small style="display:block;color:var(--hermo-text-dim)">${a.data_inicio.split('-').reverse().join('/')} a ${a.data_fim.split('-').reverse().join('/')}${a.motivo ? ' · ' + esc(a.motivo) : ''}</small>
            </div>
            <button class="hermo-btn small danger" data-aus-remover="${a.id}">🗑</button>
        </div>`;
    }).join('');
    cont.querySelectorAll('[data-aus-remover]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Remover esta ausência? O dia volta a contar para produção e custo.')) return;
        const { error } = await sb.from('hermo_ausencias').delete().eq('id', b.dataset.ausRemover);
        if (error) { toast('Erro: ' + error.message, true); return; }
        toast('Ausência removida.');
        await carregarTudo();
    }));
}

function abrirModalAusencia() {
    const sel = $('ma-integrante');
    sel.innerHTML = '';
    integrantes.filter(i => i.ativo).forEach(i => {
        const o = document.createElement('option');
        o.value = i.id;
        o.textContent = i.nome;
        sel.appendChild(o);
    });
    $('ma-inicio').value = hojeStr();
    $('ma-fim').value = hojeStr();
    $('ma-turno').value = 'dia';
    $('ma-horas-wrap').style.display = 'none';
    $('ma-motivo').value = '';
    $('ma-overlay').classList.add('aberto');
}

async function confirmarAusencia() {
    const integranteId = $('ma-integrante').value;
    const inicio = $('ma-inicio').value;
    const fim = $('ma-fim').value;
    if (!integranteId || !inicio || !fim) { toast('Preencha integrante e período.', true); return; }
    if (fim < inicio) { toast('A data final não pode ser antes da inicial.', true); return; }
    const turno = $('ma-turno').value;
    const hi = $('ma-hora-ini').value || null;
    const hf = $('ma-hora-fim').value || null;
    if (turno === 'horario' && (!hi || !hf || hf <= hi)) { toast('Horário inválido.', true); return; }
    const { error } = await sb.from('hermo_ausencias').insert({
        integrante_id: integranteId,
        tipo: $('ma-tipo').value,
        data_inicio: inicio,
        data_fim: fim,
        turno,
        hora_inicio: turno === 'horario' ? hi : null,
        hora_fim: turno === 'horario' ? hf : null,
        motivo: $('ma-motivo').value.trim() || null
    });
    if (error) { toast('Erro ao lançar: ' + error.message, true); return; }
    $('ma-overlay').classList.remove('aberto');
    toast('Ausência lançada — produção e custo do período foram zerados.');
    await carregarTudo();
}

// ============================================================
// PRODUÇÃO × CUSTO
// ============================================================
/** dias presentes (com peso) de uma alocação dentro de [de, ate] */
function diasPresentes(aloc, de, ate) {
    const ini = aloc.data_inicio > de ? aloc.data_inicio : de;
    const fim = aloc.data_fim < ate ? aloc.data_fim : ate;
    if (fim < ini) return 0;
    let peso = 0;
    let d = new Date(ini + 'T12:00:00');
    const limite = new Date(fim + 'T12:00:00');
    while (d <= limite) {
        const dia = dataStr(d);
        if (!ausenteNoDia(aloc.integrante_id, dia, aloc.turno, aloc.hora_inicio, aloc.hora_fim)) {
            peso += pesoTurno(aloc.turno, aloc.hora_inicio, aloc.hora_fim);
        }
        d = somarDias(d, 1);
    }
    return peso;
}

function renderProducao() {
    const de = $('pc-de').value;
    const ate = $('pc-ate').value;
    if (!de || !ate) return;

    // pesos totais por serviço (TODO o histórico) para o rateio
    const pesosTotaisServico = new Map();
    alocacoes.forEach(a => {
        const sid = a.obra_servico_id;
        pesosTotaisServico.set(sid, (pesosTotaisServico.get(sid) || 0) + diasPresentes(a, '2000-01-01', '2100-12-31'));
    });

    const porInt = new Map(); // id -> {dias, producao, custo}
    alocacoes.forEach(a => {
        const pesoPeriodo = diasPresentes(a, de, ate);
        if (pesoPeriodo <= 0) return;
        const os = a.obra_servico;
        const valorRec = os ? num(os.total) * num(os.perc_executado) / 100 : 0;
        const totalPesos = pesosTotaisServico.get(a.obra_servico_id) || 0;
        const producao = totalPesos > 0 ? valorRec * (pesoPeriodo / totalPesos) : 0;
        const i = integrantes.find(x => x.id === a.integrante_id);
        let custo = 0;
        if (i?.vinculo === 'diarista') custo = num(i.valor_diaria) * pesoPeriodo;
        else if (i?.vinculo === 'mensalista') custo = (num(i.salario_mensal) / 22) * pesoPeriodo;
        const acc = porInt.get(a.integrante_id) || { dias: 0, producao: 0, custo: 0 };
        acc.dias += pesoPeriodo;
        acc.producao += producao;
        acc.custo += custo;
        porInt.set(a.integrante_id, acc);
    });

    const linhas = [...porInt.entries()]
        .map(([id, v]) => ({ i: integrantes.find(x => x.id === id), ...v }))
        .filter(x => x.i)
        .sort((a, b) => b.producao - a.producao);
    $('pc-corpo').innerHTML = linhas.length === 0
        ? '<tr><td colspan="5" style="color:var(--hermo-text-dim)">Nenhuma alocação no período.</td></tr>'
        : linhas.map(x => {
            const margem = x.producao - x.custo;
            return `<tr>
                <td><b>${esc(x.i.nome)}</b>${x.i.apelido ? ` (${esc(x.i.apelido)})` : ''}</td>
                <td>${x.dias.toFixed(1)}</td>
                <td>${fmtMoeda(x.producao)}</td>
                <td>${fmtMoeda(x.custo)}</td>
                <td><b class="val ${margem >= 0 ? 'pos' : 'neg'}" style="color:${margem >= 0 ? 'var(--hermo-success)' : 'var(--hermo-danger)'}">${fmtMoeda(margem)}</b></td>
            </tr>`;
        }).join('');

    // agregado por equipe (soma dos membros)
    $('pc-corpo-eq').innerHTML = equipes.map(q => {
        const acc = { dias: 0, producao: 0, custo: 0 };
        q.membroIds.forEach(id => {
            const v = porInt.get(id);
            if (v) { acc.dias += v.dias; acc.producao += v.producao; acc.custo += v.custo; }
        });
        if (acc.dias === 0) return '';
        const margem = acc.producao - acc.custo;
        return `<tr>
            <td><span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${q.cor};margin-right:6px"></span><b>${esc(q.nome)}</b></td>
            <td>${acc.dias.toFixed(1)}</td>
            <td>${fmtMoeda(acc.producao)}</td>
            <td>${fmtMoeda(acc.custo)}</td>
            <td><b style="color:${margem >= 0 ? 'var(--hermo-success)' : 'var(--hermo-danger)'}">${fmtMoeda(margem)}</b></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" style="color:var(--hermo-text-dim)">Sem dados de equipe no período.</td></tr>';
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

// agenda / ausências / produção
$('ag-prev').addEventListener('click', () => { semanaBase = somarDias(semanaBase, -7); renderAgenda(); });
$('ag-hoje').addEventListener('click', () => { semanaBase = inicioDaSemana(new Date()); renderAgenda(); });
$('ag-next').addEventListener('click', () => { semanaBase = somarDias(semanaBase, 7); renderAgenda(); });
$('ag-filtro-equipe').addEventListener('change', renderAgenda);
$('btn-ausencia').addEventListener('click', abrirModalAusencia);
$('ma-fechar').addEventListener('click', () => $('ma-overlay').classList.remove('aberto'));
$('ma-cancelar').addEventListener('click', () => $('ma-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('ma-overlay'), () => $('ma-overlay').classList.remove('aberto'));
$('ma-confirmar').addEventListener('click', confirmarAusencia);
$('ma-turno').addEventListener('change', () => {
    $('ma-horas-wrap').style.display = $('ma-turno').value === 'horario' ? '' : 'none';
});
$('pc-de').addEventListener('change', renderProducao);
$('pc-ate').addEventListener('change', renderProducao);
// período padrão: mês corrente
(() => {
    const d = new Date();
    $('pc-de').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    $('pc-ate').value = dataStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
})();

$('btn-nova-eq').addEventListener('click', () => abrirModalEquipe(null));
$('me-fechar').addEventListener('click', () => $('me-overlay').classList.remove('aberto'));
$('me-cancelar').addEventListener('click', () => $('me-overlay').classList.remove('aberto'));
ligarFecharPorBackdrop($('me-overlay'), () => $('me-overlay').classList.remove('aberto'));
$('me-salvar').addEventListener('click', salvarEquipe);
$('me-busca-membro').addEventListener('input', renderMembrosCheck);

carregarTudo();
