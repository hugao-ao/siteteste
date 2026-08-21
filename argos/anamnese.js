// anamnese.js — Ficha de anamnese do paciente
// Roteiro de perguntas organizado pelas áreas da Evolução Terapêutica.
// Cada pergunta tem a caixa de anotação do terapeuta; em cada área, o
// terapeuta marca a opção que melhor descreve o paciente em cada subárea —
// e daí a avaliação inicial pode ser gerada já preenchida (com os níveis
// sugeridos e tudo marcado para conferência).

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { hojeISO } from './argos-recorrencia.js';
import { ANAMNESE_BLOCOS, ANAMNESE_TOTAL } from './argos-anamnese.js';
import { IMPORTANCIAS } from './argos-evolucao.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let paciente = null, catalogo = [], respostas = {}, mapa = {};
let abertos = new Set(), sujo = false;

const pacienteId = new URLSearchParams(location.search).get('paciente');
const voltarPara = () => `pacientes.html?paciente=${pacienteId}`;

// ============================================================
// CARGA
// ============================================================
async function carregarTudo() {
    const [rP, rA, rS, rO, rR, rM] = await Promise.all([
        sb.from('argos_pacientes').select('*').eq('id', pacienteId).single(),
        sb.from('argos_ev_areas').select('*').order('ordem'),
        sb.from('argos_ev_subareas').select('*').order('ordem'),
        sb.from('argos_ev_opcoes').select('*').order('ordem'),
        sb.from('argos_anamnese_respostas').select('*').eq('paciente_id', pacienteId),
        sb.from('argos_anamnese_mapa').select('*').eq('paciente_id', pacienteId)
    ]);
    paciente = rP.data || null;
    const subs = (rS.data || []).filter(x => x.ativo !== false);
    const ops = (rO.data || []).filter(x => x.ativo !== false);
    catalogo = (rA.data || []).filter(x => x.ativo !== false).map(a => ({
        ...a,
        subareas: subs.filter(s => s.area_id === a.id).map(s => ({
            ...s, opcoes: ops.filter(o => o.subarea_id === s.id)
        }))
    }));
    respostas = {};
    (rR.data || []).forEach(r => { respostas[r.pergunta] = r.anotacao || ''; });
    mapa = {};
    (rM.data || []).forEach(m => { if (m.opcao_id) mapa[m.subarea_id] = m.opcao_id; });
    render();
}

const areaDoBloco = b => b.area ? catalogo.find(a => a.ordem === b.area) : null;

// ============================================================
// RENDER
// ============================================================
function render() {
    document.getElementById('an-paciente').innerHTML = paciente
        ? `Paciente: <b>${esc(paciente.nome)}</b>` : 'Paciente não encontrado.';
    document.getElementById('an-blocos').innerHTML = ANAMNESE_BLOCOS.map(b => {
        const area = areaDoBloco(b);
        const respondidas = b.perguntas.filter(p => (respostas[p.chave] || '').trim()).length;
        const mapeadas = area ? area.subareas.filter(s => mapa[s.id]).length : 0;
        const totalSub = area ? area.subareas.length : 0;
        return `
        <div class="an-bloco ${abertos.has(b.chave) ? 'aberto' : ''}" style="--c:${b.cor}" data-bloco="${b.chave}">
          <div class="an-bloco-topo" data-toggle="${b.chave}">
            <span>${abertos.has(b.chave) ? '▼' : '▶'}</span>
            <h3>${b.icone} ${esc(b.titulo)}</h3>
            <span class="an-chip ${respondidas === b.perguntas.length ? 'ok' : ''}">${respondidas}/${b.perguntas.length} anotadas</span>
            ${totalSub ? `<span class="an-chip ${mapeadas === totalSub ? 'ok' : 'alerta'}">${mapeadas}/${totalSub} subáreas mapeadas</span>` : ''}
          </div>
          <div class="an-bloco-corpo">
            <p class="an-bloco-intro">${esc(b.intro)}</p>
            ${b.perguntas.map(p => `
              <label class="an-pergunta ${(respostas[p.chave] || '').trim() ? 'respondida' : ''}" style="--c:${b.cor}">
                <span class="txt">${esc(p.texto)}</span>
                <textarea rows="2" data-pergunta="${p.chave}" placeholder="Anotações do terapeuta…">${esc(respostas[p.chave] || '')}</textarea>
              </label>`).join('')}
            ${area ? `
            <div class="an-mapa">
              <h4>🎯 Do que você ouviu, o que descreve melhor o paciente hoje?</h4>
              <p class="dica">Alimenta a avaliação inicial da área <b>${esc(area.nome)}</b>.</p>
              ${area.subareas.map(s => `
                <div class="an-mapa-linha">
                  <b>${esc(s.nome)}</b>
                  <select data-subarea="${s.id}" class="${mapa[s.id] ? '' : 'vazio'}">
                    <option value="">— ainda não sei dizer —</option>
                    ${s.opcoes.map(o => `<option value="${o.id}" ${mapa[s.id] === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}
                  </select>
                </div>`).join('')}
            </div>` : ''}
          </div>
        </div>`;
    }).join('');
    atualizarStatus();
}

function totaisMapa() {
    const subs = catalogo.flatMap(a => a.subareas);
    return { total: subs.length, feitas: subs.filter(s => mapa[s.id]).length };
}

function atualizarStatus() {
    const anotadas = Object.values(respostas).filter(v => (v || '').trim()).length;
    const m = totaisMapa();
    const pct = ANAMNESE_TOTAL ? Math.round((anotadas / ANAMNESE_TOTAL) * 100) : 0;
    document.getElementById('an-barra').style.width = pct + '%';
    const chips = [
        `<span class="an-chip ${pct === 100 ? 'ok' : ''}">${anotadas} de ${ANAMNESE_TOTAL} perguntas anotadas (${pct}%)</span>`,
        `<span class="an-chip ${m.feitas === m.total ? 'ok' : 'alerta'}">${m.feitas} de ${m.total} subáreas mapeadas</span>`
    ];
    if (sujo) chips.push('<span class="an-chip alerta">• alterações não salvas</span>');
    document.getElementById('an-status').innerHTML = `<span class="an-chips">${chips.join('')}</span>`;
}

// ============================================================
// EDIÇÃO
// ============================================================
document.getElementById('an-blocos').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t || e.target.closest('select') || e.target.closest('textarea')) return;
    const k = t.dataset.toggle;
    if (abertos.has(k)) abertos.delete(k); else abertos.add(k);
    render();
});
document.getElementById('an-blocos').addEventListener('input', (e) => {
    if (e.target.dataset.pergunta == null) return;
    respostas[e.target.dataset.pergunta] = e.target.value;
    sujo = true;
    atualizarStatus();
});
document.getElementById('an-blocos').addEventListener('change', (e) => {
    if (e.target.dataset.subarea == null) return;
    const id = e.target.dataset.subarea;
    if (e.target.value) mapa[id] = e.target.value; else delete mapa[id];
    e.target.classList.toggle('vazio', !e.target.value);
    sujo = true;
    // atualiza os contadores do cabeçalho sem perder o foco
    const bloco = e.target.closest('[data-bloco]');
    const b = ANAMNESE_BLOCOS.find(x => x.chave === bloco.dataset.bloco);
    const area = areaDoBloco(b);
    if (area) {
        const feitas = area.subareas.filter(s => mapa[s.id]).length;
        const chip = bloco.querySelectorAll('.an-chip')[1];
        if (chip) {
            chip.textContent = `${feitas}/${area.subareas.length} subáreas mapeadas`;
            chip.classList.toggle('ok', feitas === area.subareas.length);
            chip.classList.toggle('alerta', feitas !== area.subareas.length);
        }
    }
    atualizarStatus();
});

document.getElementById('btn-expandir').addEventListener('click', () => {
    ANAMNESE_BLOCOS.forEach(b => abertos.add(b.chave)); render();
});
document.getElementById('btn-recolher').addEventListener('click', () => { abertos.clear(); render(); });
document.getElementById('btn-imprimir').addEventListener('click', () => {
    ANAMNESE_BLOCOS.forEach(b => abertos.add(b.chave)); render(); setTimeout(() => window.print(), 120);
});

// ============================================================
// PERSISTÊNCIA
// ============================================================
async function salvar(silencioso) {
    if (!perm.pode('anamnese_ficha')) { toast('Sem permissão para editar a anamnese.', true); return false; }
    const linhasR = Object.entries(respostas)
        .filter(([, v]) => (v || '').trim())
        .map(([pergunta, anotacao]) => ({ paciente_id: pacienteId, pergunta, anotacao }));
    await sb.from('argos_anamnese_respostas').delete().eq('paciente_id', pacienteId);
    if (linhasR.length) {
        const { error } = await sb.from('argos_anamnese_respostas').insert(linhasR);
        if (error) { console.error(error); toast('Erro ao salvar a anamnese.', true); return false; }
    }
    const linhasM = Object.entries(mapa).map(([subarea_id, opcao_id]) => ({ paciente_id: pacienteId, subarea_id, opcao_id }));
    await sb.from('argos_anamnese_mapa').delete().eq('paciente_id', pacienteId);
    if (linhasM.length) {
        const { error } = await sb.from('argos_anamnese_mapa').insert(linhasM);
        if (error) { console.error(error); toast('Erro ao salvar o mapeamento.', true); return false; }
    }
    sujo = false;
    atualizarStatus();
    if (!silencioso) toast('Anamnese salva.');
    return true;
}
document.getElementById('btn-salvar').addEventListener('click', () => salvar(false));
document.getElementById('btn-salvar2').addEventListener('click', () => salvar(false));

// ============================================================
// GERAR A AVALIAÇÃO INICIAL
// ============================================================
async function abrirGerar() {
    if (!perm.pode('anamnese_gerar_avaliacao')) { toast('Sem permissão para gerar a avaliação.', true); return; }
    const m = totaisMapa();
    const { data: avs } = await sb.from('argos_ev_avaliacoes').select('*')
        .eq('paciente_id', pacienteId).order('numero');
    const existente = (avs || [])[0] || null;
    const faltando = catalogo.flatMap(a => a.subareas.filter(s => !mapa[s.id]).map(s => `${a.nome} — ${s.nome}`));

    document.getElementById('gerar-resumo').innerHTML = `
      <p class="bloco-info">Serão preenchidas <b>${m.feitas} de ${m.total}</b> subáreas a partir do que você mapeou na anamnese.</p>
      ${faltando.length ? `
        <div class="argos-aviso" style="display:block">⚠️ ${faltando.length} subárea(s) ficarão em branco e precisarão ser preenchidas na avaliação:</div>
        <ul style="max-height:150px; overflow:auto">${faltando.slice(0, 30).map(f => `<li>${esc(f)}</li>`).join('')}
        ${faltando.length > 30 ? `<li class="dim">…e mais ${faltando.length - 30}</li>` : ''}</ul>` : ''}
      ${existente ? `<div class="argos-aviso" style="display:block">Este paciente já tem a <b>${existente.numero === 1 ? 'avaliação inicial' : existente.numero + 'ª avaliação'}</b> (${existente.status}). ${existente.status === 'rascunho' ? 'Ela será <b>preenchida</b> com o que veio da anamnese.' : 'Uma avaliação concluída não é alterada — gere a partir da própria Evolução Terapêutica.'}</div>` : ''}`;

    const podeGerar = !existente || existente.status === 'rascunho';
    document.getElementById('gerar-form').style.display = podeGerar ? '' : 'none';
    document.getElementById('btn-confirmar-gerar').style.display = podeGerar ? '' : 'none';
    document.getElementById('ger-data').value = (existente && existente.data) || paciente.anamnese_data || hojeISO();
    document.getElementById('ger-importancia').innerHTML = IMPORTANCIAS.map(i =>
        `<option value="${i.valor}" ${i.valor === 2 ? 'selected' : ''}>${i.nome} — ${i.desc}</option>`).join('');
    abrirModal('modal-gerar');
}
document.getElementById('btn-gerar').addEventListener('click', abrirGerar);
document.getElementById('btn-gerar2').addEventListener('click', abrirGerar);

document.getElementById('btn-confirmar-gerar').addEventListener('click', async () => {
    if (!(await salvar(true))) return;
    const data = document.getElementById('ger-data').value || hojeISO();
    const importancia = Number(document.getElementById('ger-importancia').value) || 2;

    const { data: avs } = await sb.from('argos_ev_avaliacoes').select('*')
        .eq('paciente_id', pacienteId).order('numero');
    let aval = (avs || [])[0] || null;
    if (aval && aval.status !== 'rascunho') { toast('A avaliação inicial já foi concluída.', true); return; }
    if (!aval) {
        const { data: nova, error } = await sb.from('argos_ev_avaliacoes')
            .insert({ paciente_id: pacienteId, numero: 1, data, status: 'rascunho' })
            .select().single();
        if (error) { console.error(error); toast('Erro ao criar a avaliação.', true); return; }
        aval = nova;
    } else {
        await sb.from('argos_ev_avaliacoes').update({ data }).eq('id', aval.id);
    }

    // monta as respostas: importância da área, opção escolhida e o nível
    // sugerido de CADA opção — tudo marcado para conferência
    const linhas = [];
    for (const area of catalogo) {
        linhas.push({ avaliacao_id: aval.id, tipo: 'importancia', ref_id: area.id,
            valor: importancia, opcao_id: null, rotulo: area.nome, conferir: true });
        for (const s of area.subareas) {
            if (mapa[s.id]) {
                const op = s.opcoes.find(o => o.id === mapa[s.id]);
                linhas.push({ avaliacao_id: aval.id, tipo: 'selecao', ref_id: s.id,
                    valor: null, opcao_id: mapa[s.id], rotulo: op ? op.nome : null, conferir: true });
            }
            for (const o of s.opcoes) {
                linhas.push({ avaliacao_id: aval.id, tipo: 'nivelamento', ref_id: o.id,
                    valor: o.nivel_sugerido || 3, opcao_id: null, rotulo: o.nome, conferir: true });
            }
        }
    }
    await sb.from('argos_ev_respostas').delete().eq('avaliacao_id', aval.id);
    const { error: e2 } = await sb.from('argos_ev_respostas').insert(linhas);
    if (e2) { console.error(e2); toast('Erro ao preencher a avaliação.', true); return; }

    // as anotações da anamnese viram texto na avaliação: cada bloco de área
    // alimenta as "Relevâncias" daquela área; os blocos gerais (identificação,
    // queixa, histórico) vão para as observações da Memória da Terapia
    const textos = [];
    const gerais = [];
    const anotadas = b => b.perguntas
        .filter(p => (respostas[p.chave] || '').trim())
        .map(p => `• ${p.texto}\n${respostas[p.chave].trim()}`);
    for (const b of ANAMNESE_BLOCOS) {
        const trechos = anotadas(b);
        if (!trechos.length) continue;
        const area = areaDoBloco(b);
        if (area) textos.push({
            avaliacao_id: aval.id, campo: `area:${area.id}:relevancias`,
            texto: `[da anamnese]\n${trechos.join('\n\n')}`
        });
        else gerais.push(`${b.icone} ${b.titulo}\n${trechos.join('\n\n')}`);
    }
    if (gerais.length) textos.push({
        avaliacao_id: aval.id, campo: 'memoria:observacoes',
        texto: `[da anamnese]\n${gerais.join('\n\n')}`
    });
    await sb.from('argos_ev_textos').delete().eq('avaliacao_id', aval.id);
    if (textos.length) await sb.from('argos_ev_textos').insert(textos);

    fecharModal('modal-gerar');
    toast('Avaliação inicial gerada — confira os itens marcados com 🔎.');
    location.href = `evolucao.html?paciente=${pacienteId}&avaliacao=${aval.id}`;
});

window.addEventListener('beforeunload', (e) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

// ============================================================
// INÍCIO
// ============================================================
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('anamnese_ficha') && !perm.master) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Sem permissão para ver a anamnese.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    if (!pacienteId) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Paciente não informado. Abra pela lista de pacientes.</p>';
        return;
    }
    document.getElementById('btn-voltar').href = voltarPara();
    document.getElementById('btn-voltar2').href = voltarPara();
    abertos.add(ANAMNESE_BLOCOS[0].chave);
    await carregarTudo();
})();
