// evolucao.js — Página de preenchimento da Evolução Terapêutica
// Uma avaliação por vez: importância de cada área, classificação de cada
// subárea, nivelamento de cada opção e os campos subjetivos.
// Rascunho salva a qualquer momento; concluir exige tudo preenchido, as
// badges de conferência resolvidas e o prazo da próxima avaliação.

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { hojeISO, formataBR, somarDias } from './argos-recorrencia.js';
import {
    IMPORTANCIAS, NIVEIS, MAX_FUNDAMENTAIS, MEMORIA_GRUPOS, AREA_TEXTOS,
    indexarRespostas, calcularAvaliacao, pendencias, fundamentaisExcedentes,
    limiteProxima, avaliacaoTravada, radarSVG, COMPETENCIA_MAX, FOCO_MAX
} from './argos-evolucao.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let paciente = null, catalogo = [], avaliacoes = [], atual = null;
let resp = { importancia: {}, selecao: {}, nivelamento: {}, conferir: {} };
let textos = {};
let sujo = false;   // há alterações não salvas
let respIniciais = null;   // respostas da avaliação inicial concluída (referência)
let abertas = new Set();      // áreas expandidas
let subAbertas = new Set();   // subáreas expandidas
let graficosOcultos = false;

const pacienteId = new URLSearchParams(location.search).get('paciente');

// ============================================================
// CARGA
// ============================================================
async function carregarCatalogo() {
    const [rA, rS, rO] = await Promise.all([
        sb.from('argos_ev_areas').select('*').order('ordem'),
        sb.from('argos_ev_subareas').select('*').order('ordem'),
        sb.from('argos_ev_opcoes').select('*').order('ordem')
    ]);
    const subs = (rS.data || []).filter(x => x.ativo !== false);
    const ops = (rO.data || []).filter(x => x.ativo !== false);
    catalogo = (rA.data || []).filter(x => x.ativo !== false).map(a => ({
        ...a,
        subareas: subs.filter(s => s.area_id === a.id).map(s => ({
            ...s, opcoes: ops.filter(o => o.subarea_id === s.id)
        }))
    }));
}

async function carregarAvaliacoes() {
    const { data } = await sb.from('argos_ev_avaliacoes').select('*')
        .eq('paciente_id', pacienteId).order('numero');
    avaliacoes = data || [];
}

async function carregarAvaliacao(id) {
    atual = avaliacoes.find(a => a.id === id) || null;
    resp = { importancia: {}, selecao: {}, nivelamento: {}, conferir: {} };
    textos = {};
    if (!atual) { render(); return; }
    const [rR, rT] = await Promise.all([
        sb.from('argos_ev_respostas').select('*').eq('avaliacao_id', atual.id),
        sb.from('argos_ev_textos').select('*').eq('avaliacao_id', atual.id)
    ]);
    resp = indexarRespostas(rR.data || []);
    (rT.data || []).forEach(t => { textos[t.campo] = t.texto || ''; });
    // referência dos gráficos: a avaliação inicial já concluída
    respIniciais = null;
    const inicial = avaliacoes.find(a => a.numero === 1 && a.status === 'concluida' && a.id !== atual.id);
    if (inicial) {
        const { data: ri } = await sb.from('argos_ev_respostas').select('*').eq('avaliacao_id', inicial.id);
        respIniciais = indexarRespostas(ri || []);
    }
    sujo = false;
    render();
}

const travada = () => !!atual && avaliacaoTravada(atual, hojeISO());
const somenteLeitura = () => travada() || !perm.pode('evolucao_editar');

// ============================================================
// RENDER
// ============================================================
function selectAvaliacoes() {
    const el = document.getElementById('ev-avaliacao');
    el.innerHTML = avaliacoes.map(a => {
        const lim = limiteProxima(a);
        const tag = a.status === 'rascunho' ? '✏️ rascunho'
            : (avaliacaoTravada(a, hojeISO()) ? '🔒 concluída' : '✅ concluída');
        return `<option value="${a.id}">${a.numero === 1 ? 'Avaliação inicial' : `${a.numero}ª avaliação`} — ${formataBR(a.data)} · ${tag}${lim ? ` · próxima até ${formataBR(lim)}` : ''}</option>`;
    }).join('') || '<option value="">— nenhuma avaliação —</option>';
    if (atual) el.value = atual.id;
}

function render() {
    document.getElementById('ev-paciente').innerHTML = paciente
        ? `Paciente: <b>${esc(paciente.nome)}</b>` : 'Paciente não encontrado.';
    selectAvaliacoes();
    const campoData = document.getElementById('rotulo-data');
    const inputData = document.getElementById('ev-data');
    campoData.style.display = atual ? '' : 'none';
    if (atual) {
        inputData.value = atual.data || '';
        // a data só é editável enquanto a avaliação é rascunho
        inputData.disabled = atual.status !== 'rascunho' || somenteLeitura();
        inputData.title = inputData.disabled
            ? 'A data só pode ser alterada enquanto a avaliação é rascunho.'
            : 'Data desta avaliação — pode ser anterior a hoje.';
    }
    if (!atual) {
        document.getElementById('ev-areas').innerHTML =
            '<p class="dim" style="padding:20px">Nenhuma avaliação ainda. Use <b>+ Nova avaliação</b> para começar a avaliação inicial.</p>';
        document.getElementById('ev-memoria').innerHTML = '';
        document.getElementById('ev-status').textContent = '';
        document.getElementById('ev-barra').style.width = '0%';
        return;
    }
    renderAreas();
    renderMemoria();
    renderGraficos();
    atualizarStatus();
}

/** Radares da avaliação aberta, redesenhados a cada alteração. */
function renderGraficos() {
    const painel = document.getElementById('ev-painel');
    const cont = document.getElementById('ev-graficos-pagina');
    if (!atual) { painel.style.display = 'none'; return; }
    painel.style.display = '';
    const calc = calcularAvaliacao(catalogo, resp);
    const eixos = catalogo.map(a => a.nome);
    const rot = `${atual.numero === 1 ? 'Avaliação inicial' : atual.numero + 'ª avaliação'} — ${formataBR(atual.data)}`;
    const feitas = calc.filter(c => c.competencia != null).length;

    // série de referência: a avaliação inicial concluída (quando não é esta)
    const inicial = avaliacoes.find(a => a.numero === 1 && a.status === 'concluida' && a.id !== atual.id);
    const calcIni = inicial && respIniciais ? calcularAvaliacao(catalogo, respIniciais) : null;

    const series = (campo, cor) => [
        ...(calcIni ? [{ nome: `Avaliação inicial — ${formataBR(inicial.data)}`, cor, tracejada: true,
                          valores: calcIni.map(c => c[campo]) }] : []),
        { nome: rot, cor, valores: calc.map(c => c[campo]) }
    ];
    cont.innerHTML = [
        radarSVG({ titulo: 'Competências — escala proporcional', eixos, series: series('competencia', '#38bdf8'), max: 'auto' }),
        radarSVG({ titulo: `Competências — escala fixa (0–${COMPETENCIA_MAX})`, eixos, series: series('competencia', '#38bdf8'), max: COMPETENCIA_MAX, aneis: 5 }),
        radarSVG({ titulo: 'Foco Terapêutico — escala proporcional', eixos, series: series('foco', '#e879f9'), max: 'auto' }),
        radarSVG({ titulo: `Foco Terapêutico — escala fixa (0–${FOCO_MAX})`, eixos, series: series('foco', '#e879f9'), max: FOCO_MAX })
    ].join('');
    document.getElementById('ev-graf-dica').textContent = feitas === catalogo.length
        ? 'Todas as áreas têm nota — os gráficos refletem a avaliação completa.'
        : `Formando-se conforme você preenche: ${feitas} de ${catalogo.length} áreas já têm nota (as demais entram como zero).`;
}

function renderAreas() {
    if (!atual) {
        document.getElementById('ev-areas').innerHTML =
            '<p class="dim" style="padding:20px">Nenhuma avaliação aberta. Use <b>+ Nova avaliação</b> para começar.</p>';
        return;
    }
    const ro = somenteLeitura();
    const calc = calcularAvaliacao(catalogo, resp);
    document.getElementById('ev-areas').innerHTML = catalogo.map((area, i) => {
        const c = calc[i];
        const nBadges = badgesDaArea(area).length;
        const classe = nBadges ? 'tem-badge' : (c.completa ? 'completa' : 'incompleta');
        const feitos = c.subareas.filter(x => x.valor != null).length;
        return `
        <div class="ev-area ${abertas.has(area.id) ? 'aberta' : ''} ${classe} ${ro ? 'ev-travada' : ''}" data-area="${area.id}">
          <div class="ev-area-topo" data-toggle="${area.id}">
            <span class="chev">${abertas.has(area.id) ? '▼' : '▶'}</span>
            <span class="nome">${i + 1}. ${esc(area.nome)}</span>
            <span>${nBadges ? `<button class="badge-conferir" data-conferir-area="${area.id}">🔎 conferir ${nBadges}</button>` : ''}</span>
            <span class="linha2">
              <span class="ev-chip ${feitos === c.subareas.length ? 'ok' : 'erro'}">${feitos}/${c.subareas.length} subáreas</span>
              <span class="ev-chip">competência <b>${fmt(c.competencia)}</b></span>
              <span class="ev-chip">foco <b>${fmt(c.foco)}</b></span>
              ${c.peso ? `<span class="ev-chip">${esc(IMPORTANCIAS.find(x => x.valor === c.peso).nome)}</span>`
                       : '<span class="ev-chip erro">sem importância definida</span>'}
            </span>
            <label class="importancia" onclick="event.stopPropagation()">
              <select class="argos-input" data-importancia="${area.id}" ${ro ? 'disabled' : ''}
                      style="width:100%; ${resp.importancia[area.id] ? '' : 'border-color:var(--argos-danger)'}">
                <option value="">⚠️ Escolha a importância desta área nesta avaliação…</option>
                ${IMPORTANCIAS.map(im => `<option value="${im.valor}" ${resp.importancia[area.id] === im.valor ? 'selected' : ''}>${im.nome} — ${im.desc}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="ev-area-corpo">
            ${area.subareas.map(sa => renderSubarea(sa, ro)).join('')}
            <div class="ev-textos">
              ${AREA_TEXTOS.map(t => campoTexto(
                  `area:${area.id}:${t.sufixo}`, `${t.icone} ${t.rotulo}`, t.cor, ro, 3)).join('')}
            </div>
          </div>
        </div>`;
    }).join('');
}

/** Campo de texto livre com faixa colorida do assunto. */
function campoTexto(chave, rotulo, cor, ro, linhas) {
    return `<label class="ev-campo" style="--c:${cor}">
      <span>${esc(rotulo)}</span>
      <textarea rows="${linhas || 3}" data-texto="${chave}" ${ro ? 'disabled' : ''}>${esc(textos[chave] || '')}</textarea>
    </label>`;
}

function renderSubarea(sa, ro) {
    const escolhida = resp.selecao[sa.id];
    const nBadges = (sa.opcoes || []).filter(o => resp.conferir[`nivelamento:${o.id}`]).length
        + (resp.conferir[`selecao:${sa.id}`] ? 1 : 0);
    const nivelados = (sa.opcoes || []).filter(o => resp.nivelamento[o.id] != null).length;
    const nomeEscolhida = escolhida ? (sa.opcoes.find(o => o.id === escolhida) || {}).nome : null;
    const aberta = subAbertas.has(sa.id);
    return `
    <div class="ev-sub ${aberta ? 'aberta' : ''}" data-sub="${sa.id}">
      <div class="ev-sub-cab" data-toggle-sub="${sa.id}">
        <span class="chev">${aberta ? '▼' : '▶'}</span>
        <b>${esc(sa.nome)}</b>
        ${nBadges ? `<button class="badge-conferir" data-conferir-sub="${sa.id}">🔎 conferir ${nBadges}</button>` : ''}
        <span class="ev-chip ${nivelados === sa.opcoes.length ? 'ok' : 'erro'}">${nivelados}/${sa.opcoes.length} nivelados</span>
        ${!aberta ? `<span class="ev-chip ${escolhida ? 'ok' : 'erro'}">${escolhida ? esc(nomeEscolhida) : 'sem classificação'}</span>` : ''}
      </div>
      <div class="ev-sub-corpo">
      <label class="ev-sub-escolha ${escolhida ? '' : 'vazio'}">
        <select data-selecao="${sa.id}" ${ro ? 'disabled' : ''}>
          <option value="">⚠️ Como o paciente está nesta subárea?</option>
          ${sa.opcoes.map(o => `<option value="${o.id}" ${escolhida === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}
        </select>
      </label>
      <div class="ev-niveis-titulo">Nivelamento das opções — o que cada comportamento representa para este paciente agora</div>
      <div class="ev-niveis">
        ${sa.opcoes.map(o => {
            const n = resp.nivelamento[o.id];
            const cor = n ? (NIVEIS.find(x => x.valor === n) || {}).cor : null;
            return `
            <div class="ev-opcao ${escolhida === o.id ? 'escolhida' : ''}">
              <span class="rot">${escolhida === o.id ? '▶ ' : ''}${esc(o.nome)}
                ${resp.conferir[`nivelamento:${o.id}`] ? `<button class="badge-conferir" data-conferir-item="nivelamento:${o.id}">🔎</button>` : ''}</span>
              <select data-nivel="${o.id}" class="${n ? '' : 'vazio'}" ${ro ? 'disabled' : ''}
                      style="${cor ? `color:${cor}` : ''}">
                <option value="">— nivelar —</option>
                ${NIVEIS.map(x => `<option value="${x.valor}" ${n === x.valor ? 'selected' : ''}>${x.valor} · ${x.nome}</option>`).join('')}
              </select>
            </div>`;
        }).join('')}
      </div>
      </div>
    </div>`;
}

function renderMemoria() {
    if (!atual) { document.getElementById('ev-memoria').innerHTML = ''; return; }
    const ro = somenteLeitura();
    const nome = (paciente && paciente.nome) || '';
    document.getElementById('ev-memoria').innerHTML = MEMORIA_GRUPOS.map(g => `
      <div class="ev-memoria-grupo" style="--c:${g.cor}">
        <h3>${g.icone} ${esc(g.titulo)}</h3>
        <div class="ev-memoria-campos">
          ${g.campos.map(c => campoTexto('memoria:' + c.chave,
              c.rotulo.replace('{PACIENTE}', nome), g.cor, ro, 3)).join('')}
        </div>
      </div>`).join('');
}

const fmt = v => v == null ? '—' : (Math.round(v * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function badgesDaArea(area) {
    const out = [];
    if (resp.conferir[`importancia:${area.id}`]) out.push(`importancia:${area.id}`);
    for (const sa of area.subareas || []) {
        if (resp.conferir[`selecao:${sa.id}`]) out.push(`selecao:${sa.id}`);
        for (const o of sa.opcoes || []) if (resp.conferir[`nivelamento:${o.id}`]) out.push(`nivelamento:${o.id}`);
    }
    return out;
}

function atualizarStatus() {
    const p = pendencias(catalogo, resp);
    const pct = p.total ? Math.round((p.preenchidos / p.total) * 100) : 0;
    document.getElementById('ev-barra').style.width = pct + '%';
    const nBadges = Object.keys(resp.conferir).length;
    document.getElementById('btn-conferir-tudo').style.display = nBadges ? '' : 'none';
    document.getElementById('btn-conferir-tudo').textContent = `✔ Conferir tudo (${nBadges})`;
    const fund = fundamentaisExcedentes(catalogo, resp);
    const chips = [`<span class="ev-chip ${pct === 100 ? 'ok' : ''}">${p.preenchidos} de ${p.total} campos objetivos (${pct}%)</span>`];
    if (nBadges) chips.push(`<span class="ev-chip alerta">🔎 ${nBadges} item(ns) aguardando conferência</span>`);
    if (fund.excede) chips.push(`<span class="ev-chip erro">⛔ ${fund.nomes.length} áreas como Fundamental (máximo ${MAX_FUNDAMENTAIS})</span>`);
    if (travada()) chips.push('<span class="ev-chip erro">🔒 avaliação travada</span>');
    else if (sujo) chips.push('<span class="ev-chip alerta">• alterações não salvas</span>');
    document.getElementById('ev-status').innerHTML = `<span class="ev-chips">${chips.join('')}</span>`;

    const aviso = document.getElementById('ev-aviso');
    if (travada()) {
        aviso.style.display = '';
        aviso.textContent = '🔒 Esta avaliação está travada: o prazo definido para a próxima já passou. Crie/abra a avaliação seguinte para continuar o acompanhamento.';
    } else if (fund.excede) {
        aviso.style.display = '';
        aviso.textContent = `⛔ Apenas ${MAX_FUNDAMENTAIS} áreas podem ser "Fundamental" numa mesma avaliação. Hoje estão assim: ${fund.nomes.join(', ')}.`;
    } else aviso.style.display = 'none';
}

// ============================================================
// EDIÇÃO
// ============================================================
document.getElementById('ev-areas').addEventListener('click', (e) => {
    const tog = e.target.closest('[data-toggle]');
    if (tog && !e.target.closest('select') && !e.target.closest('button')) {
        const id = tog.dataset.toggle;
        if (abertas.has(id)) abertas.delete(id); else abertas.add(id);
        renderAreas();
        return;
    }
    const togSub = e.target.closest('[data-toggle-sub]');
    if (togSub && !e.target.closest('button')) {
        const id = togSub.dataset.toggleSub;
        if (subAbertas.has(id)) subAbertas.delete(id); else subAbertas.add(id);
        renderAreas();
        return;
    }
    const bArea = e.target.closest('[data-conferir-area]');
    if (bArea) {
        const area = catalogo.find(a => a.id === bArea.dataset.conferirArea);
        conferir(badgesDaArea(area));
        return;
    }
    const bSub = e.target.closest('[data-conferir-sub]');
    if (bSub) {
        const sa = catalogo.flatMap(a => a.subareas).find(s => s.id === bSub.dataset.conferirSub);
        const chaves = [`selecao:${sa.id}`, ...sa.opcoes.map(o => `nivelamento:${o.id}`)]
            .filter(k => resp.conferir[k]);
        conferir(chaves);
        return;
    }
    const bItem = e.target.closest('[data-conferir-item]');
    if (bItem) conferir([bItem.dataset.conferirItem]);
});

function conferir(chaves) {
    (chaves || []).forEach(k => { delete resp.conferir[k]; });
    sujo = true;
    renderAreas();
    atualizarStatus();
}

document.getElementById('btn-conferir-tudo').addEventListener('click', () => {
    const n = Object.keys(resp.conferir).length;
    if (!n || !confirm(`Marcar como conferidos os ${n} item(ns) herdados da avaliação anterior?`)) return;
    conferir(Object.keys(resp.conferir));
    toast('Itens conferidos.');
});

document.getElementById('ev-areas').addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.importancia != null) {
        const v = el.value ? Number(el.value) : null;
        if (v == null) delete resp.importancia[el.dataset.importancia];
        else resp.importancia[el.dataset.importancia] = v;
        delete resp.conferir[`importancia:${el.dataset.importancia}`];
    } else if (el.dataset.selecao != null) {
        if (el.value) resp.selecao[el.dataset.selecao] = el.value;
        else delete resp.selecao[el.dataset.selecao];
        delete resp.conferir[`selecao:${el.dataset.selecao}`];
    } else if (el.dataset.nivel != null) {
        const v = el.value ? Number(el.value) : null;
        if (v == null) delete resp.nivelamento[el.dataset.nivel];
        else resp.nivelamento[el.dataset.nivel] = v;
        delete resp.conferir[`nivelamento:${el.dataset.nivel}`];
    } else if (el.dataset.texto != null) {
        textos[el.dataset.texto] = el.value;
        sujo = true;
        return;
    } else return;
    sujo = true;
    renderAreas();
    renderGraficos();
    atualizarStatus();
});

document.getElementById('ev-memoria').addEventListener('input', (e) => {
    if (e.target.dataset.texto != null) { textos[e.target.dataset.texto] = e.target.value; sujo = true; }
});
document.getElementById('ev-areas').addEventListener('input', (e) => {
    if (e.target.dataset.texto != null) { textos[e.target.dataset.texto] = e.target.value; sujo = true; }
});

document.getElementById('btn-expandir').addEventListener('click', () => {
    catalogo.forEach(a => { abertas.add(a.id); a.subareas.forEach(s2 => subAbertas.add(s2.id)); });
    renderAreas();
});
document.getElementById('btn-recolher').addEventListener('click', () => {
    abertas.clear(); subAbertas.clear(); renderAreas();
});
document.getElementById('btn-graficos').addEventListener('click', () => {
    graficosOcultos = !graficosOcultos;
    document.getElementById('ev-painel').classList.toggle('oculto', graficosOcultos);
    document.getElementById('btn-graficos').textContent = graficosOcultos ? '▸ mostrar' : '▾ ocultar';
});
document.getElementById('ev-data').addEventListener('change', async (e) => {
    if (!atual || atual.status !== 'rascunho') return;
    const nova = e.target.value;
    if (!nova) { e.target.value = atual.data; return; }
    const { error } = await sb.from('argos_ev_avaliacoes').update({ data: nova }).eq('id', atual.id);
    if (error) { console.error(error); toast('Erro ao alterar a data.', true); e.target.value = atual.data; return; }
    atual.data = nova;
    const naLista = avaliacoes.find(a => a.id === atual.id);
    if (naLista) naLista.data = nova;
    toast(`Data da avaliação: ${formataBR(nova)}.`);
    selectAvaliacoes();
    renderGraficos();
});

document.getElementById('ev-avaliacao').addEventListener('change', async (e) => {
    if (sujo && !confirm('Há alterações não salvas nesta avaliação. Trocar mesmo assim?')) {
        e.target.value = atual ? atual.id : '';
        return;
    }
    await carregarAvaliacao(e.target.value);
});

// ============================================================
// PERSISTÊNCIA
// ============================================================
function rotuloDe(tipo, refId, opcaoId) {
    if (tipo === 'importancia') return (catalogo.find(a => a.id === refId) || {}).nome || null;
    if (tipo === 'selecao') {
        const op = catalogo.flatMap(a => a.subareas).flatMap(s => s.opcoes).find(o => o.id === opcaoId);
        return op ? op.nome : null;
    }
    const op = catalogo.flatMap(a => a.subareas).flatMap(s => s.opcoes).find(o => o.id === refId);
    return op ? op.nome : null;
}

function respostasParaGravar() {
    const linhas = [];
    for (const area of catalogo) {
        if (resp.importancia[area.id] != null) linhas.push({
            tipo: 'importancia', ref_id: area.id, valor: resp.importancia[area.id],
            opcao_id: null, rotulo: rotuloDe('importancia', area.id),
            conferir: !!resp.conferir[`importancia:${area.id}`]
        });
        for (const sa of area.subareas) {
            if (resp.selecao[sa.id]) linhas.push({
                tipo: 'selecao', ref_id: sa.id, valor: null, opcao_id: resp.selecao[sa.id],
                rotulo: rotuloDe('selecao', sa.id, resp.selecao[sa.id]),
                conferir: !!resp.conferir[`selecao:${sa.id}`]
            });
            for (const o of sa.opcoes) {
                if (resp.nivelamento[o.id] != null) linhas.push({
                    tipo: 'nivelamento', ref_id: o.id, valor: resp.nivelamento[o.id],
                    opcao_id: null, rotulo: rotuloDe('nivelamento', o.id),
                    conferir: !!resp.conferir[`nivelamento:${o.id}`]
                });
            }
        }
    }
    return linhas;
}

async function salvar(silencioso) {
    if (!atual || somenteLeitura()) return false;
    const linhas = respostasParaGravar().map(l => ({ ...l, avaliacao_id: atual.id }));
    const { error: e1 } = await sb.from('argos_ev_respostas').delete().eq('avaliacao_id', atual.id);
    if (e1) { console.error(e1); toast('Erro ao salvar.', true); return false; }
    if (linhas.length) {
        const { error: e2 } = await sb.from('argos_ev_respostas').insert(linhas);
        if (e2) { console.error(e2); toast('Erro ao salvar as respostas.', true); return false; }
    }
    const tLinhas = Object.entries(textos)
        .filter(([, v]) => (v || '').trim())
        .map(([campo, texto]) => ({ avaliacao_id: atual.id, campo, texto }));
    await sb.from('argos_ev_textos').delete().eq('avaliacao_id', atual.id);
    if (tLinhas.length) await sb.from('argos_ev_textos').insert(tLinhas);
    sujo = false;
    atualizarStatus();
    if (!silencioso) toast('Rascunho salvo.');
    return true;
}
document.getElementById('btn-salvar').addEventListener('click', () => salvar(false));
document.getElementById('btn-salvar2').addEventListener('click', () => salvar(false));

// ---------- nova avaliação ----------
document.getElementById('btn-nova').addEventListener('click', async () => {
    if (!perm.pode('evolucao_editar')) { toast('Sem permissão para criar avaliações.', true); return; }
    const rascunho = avaliacoes.find(a => a.status === 'rascunho');
    if (rascunho) {
        toast('Já existe uma avaliação em rascunho — conclua-a antes de iniciar a próxima.', true);
        await carregarAvaliacao(rascunho.id);
        return;
    }
    const anterior = avaliacoes.filter(a => a.status === 'concluida').slice(-1)[0] || null;
    if (anterior && !confirm(`Iniciar a ${avaliacoes.length + 1}ª avaliação?\nOs preenchimentos objetivos da anterior virão pré-preenchidos e marcados para conferência.`)) return;
    if (!anterior && avaliacoes.length === 0 && !confirm('Iniciar a avaliação inicial deste paciente?')) return;
    await criarAvaliacao(anterior);
});

async function criarAvaliacao(anterior) {
    const numero = (avaliacoes.reduce((m, a) => Math.max(m, a.numero), 0) || 0) + 1;
    const { data: nova, error } = await sb.from('argos_ev_avaliacoes')
        .insert({ paciente_id: pacienteId, numero, data: hojeISO(), status: 'rascunho' })
        .select().single();
    if (error) { console.error(error); toast('Erro ao criar a avaliação.', true); return null; }
    if (anterior) {
        // herda os objetivos da anterior, todos marcados para conferência
        const { data: ant } = await sb.from('argos_ev_respostas').select('*').eq('avaliacao_id', anterior.id);
        const herdadas = (ant || []).map(r => ({
            avaliacao_id: nova.id, tipo: r.tipo, ref_id: r.ref_id, valor: r.valor,
            opcao_id: r.opcao_id, rotulo: r.rotulo, conferir: true
        }));
        if (herdadas.length) await sb.from('argos_ev_respostas').insert(herdadas);
    }
    await carregarAvaliacoes();
    await carregarAvaliacao(nova.id);
    toast(anterior ? 'Nova avaliação criada com os dados anteriores para conferência.' : 'Avaliação inicial criada.');
    return nova;
}

// ---------- conclusão ----------
function abrirConcluir() {
    if (!atual) return;
    if (somenteLeitura()) { toast('Esta avaliação está travada.', true); return; }
    const p = pendencias(catalogo, resp);
    const fund = fundamentaisExcedentes(catalogo, resp);
    const bloqueios = [];
    if (p.faltando.length) bloqueios.push({ titulo: `${p.faltando.length} campo(s) objetivo(s) sem preencher`, itens: p.faltando.map(f => `${f.area} — ${f.item}`) });
    if (p.conferir.length) bloqueios.push({ titulo: `${p.conferir.length} item(ns) aguardando conferência 🔎`, itens: p.conferir.map(f => `${f.area} — ${f.item}`) });
    if (fund.excede) bloqueios.push({ titulo: `Máximo de ${MAX_FUNDAMENTAIS} áreas "Fundamental" excedido`, itens: fund.nomes });

    document.getElementById('concluir-pendencias').innerHTML = bloqueios.length ? `
      <div class="argos-aviso" style="display:block">⛔ A avaliação não pode ser concluída enquanto houver pendências:</div>
      ${bloqueios.map(b => `
        <h3 class="form-secao">${esc(b.titulo)}</h3>
        <ul style="max-height:180px; overflow:auto">${b.itens.slice(0, 60).map(i => `<li>${esc(i)}</li>`).join('')}
        ${b.itens.length > 60 ? `<li class="dim">…e mais ${b.itens.length - 60}</li>` : ''}</ul>`).join('')}
      <p class="dica">Você pode salvar como rascunho e voltar depois — a avaliação continua pendente.</p>`
      : '<p class="dica">✔ Todos os campos objetivos estão preenchidos e conferidos.</p>';
    document.getElementById('concluir-prazo').style.display = bloqueios.length ? 'none' : '';
    document.getElementById('btn-confirmar-concluir').style.display = bloqueios.length ? 'none' : '';
    document.getElementById('prazo-data').value = somarDias(atual.data, 90);
    atualizarPrevisao();
    abrirModal('modal-concluir');
}
document.getElementById('btn-concluir').addEventListener('click', abrirConcluir);
document.getElementById('btn-concluir2').addEventListener('click', abrirConcluir);

function atualizarPrevisao() {
    const modo = document.getElementById('prazo-modo').value;
    document.getElementById('rotulo-prazo-dias').style.display = modo === 'dias' ? '' : 'none';
    document.getElementById('rotulo-prazo-data').style.display = modo === 'data' ? '' : 'none';
    if (!atual) return;
    const lim = modo === 'dias'
        ? limiteProxima({ data: atual.data, proximo_prazo_dias: Number(document.getElementById('prazo-dias').value) || 0 })
        : document.getElementById('prazo-data').value;
    document.getElementById('prazo-previsao').textContent = lim
        ? `Esta avaliação poderá ser editada até ${formataBR(lim)}; a partir dessa data ela trava e a próxima é criada para conferência.`
        : '';
}
['prazo-modo', 'prazo-dias', 'prazo-data'].forEach(id =>
    document.getElementById(id).addEventListener('input', atualizarPrevisao));

document.getElementById('btn-confirmar-concluir').addEventListener('click', async () => {
    if (!atual) return;
    const modo = document.getElementById('prazo-modo').value;
    const dias = Number(document.getElementById('prazo-dias').value) || 0;
    const data = document.getElementById('prazo-data').value;
    if (modo === 'dias' && dias < 1) { toast('Informe o prazo em dias (mínimo 1).', true); return; }
    if (modo === 'data' && (!data || data <= atual.data)) { toast('Informe uma data posterior à desta avaliação.', true); return; }
    if (!(await salvar(true))) return;
    const { error } = await sb.from('argos_ev_avaliacoes').update({
        status: 'concluida',
        proximo_prazo_dias: modo === 'dias' ? dias : null,
        proximo_prazo_data: modo === 'data' ? data : null,
        concluida_em: new Date().toISOString()
    }).eq('id', atual.id);
    if (error) { console.error(error); toast('Erro ao concluir.', true); return; }
    fecharModal('modal-concluir');
    toast('Avaliação concluída. Os gráficos já refletem estes dados.');
    await carregarAvaliacoes();
    await carregarAvaliacao(atual.id);
});

window.addEventListener('beforeunload', (e) => {
    if (sujo) { e.preventDefault(); e.returnValue = ''; }
});

// ============================================================
// INÍCIO
// ============================================================
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('evolucao_ver') && !perm.master) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Sem permissão para ver a Evolução Terapêutica.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    const volta = `pacientes.html?paciente=${pacienteId}`;
    document.getElementById('btn-voltar').href = volta;
    document.getElementById('btn-voltar2').href = volta;
    if (!pacienteId) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Paciente não informado. Abra pela lista de pacientes.</p>';
        return;
    }
    const { data: p } = await sb.from('argos_pacientes').select('*').eq('id', pacienteId).single();
    paciente = p || null;
    await carregarCatalogo();
    await carregarAvaliacoes();
    const alvo = new URLSearchParams(location.search).get('avaliacao')
        || (avaliacoes.find(a => a.status === 'rascunho') || avaliacoes[avaliacoes.length - 1] || {}).id;
    if (alvo) await carregarAvaliacao(alvo); else render();
})();
