// servicos-planejamento.js — Subpágina PLANEJAMENTOS.
// Cada planejamento congela um período (datas + alocações travadas na linha do
// tempo). Aqui: lista cronológica, linha do tempo do período com um marcador de
// DIA arrastável, mapa que acompanha esse dia (serviços que começam/terminam e
// as TRAJETÓRIAS de quem sai de um serviço para outro) e a confirmação do que
// foi executado — que volta para os cards das obras.
import { sb, toast, esc, fmtMoeda } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const PXS = [4, 8, 14, 24, 40];
// largura da coluna de rótulos — espelha o @media do CSS (igual à outra timeline)
const rotuloW = () => window.matchMedia('(max-width: 700px)').matches ? 130 : 210;
let pxIdx = 2;
let planos = [];
let atual = null;              // planejamento aberto (com itens/alocações)
let diaCursor = null;          // dia mostrado no mapa
let mapa = null, camadas = [];
let tocando = null;            // timer do ▶ Percorrer

const pxDia = () => PXS[Math.max(0, Math.min(PXS.length - 1, pxIdx))];
const fmtData = iso => (iso || '').split('-').reverse().join('/');
const ddmm = iso => fmtData(iso).slice(0, 5);
const fmtQtd = v => String(Math.round(num(v) * 100) / 100).replace('.', ',');
function addDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
const difDias = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const codObra = o => o ? `OB-${String(o.numero).padStart(4, '0')}/${o.ano}` : '';
const SITUACAO = {
    com_equipe: { rot: 'com equipe', cor: 'var(--hermo-info)' },
    sem_avanco: { rot: 'sem avanço', cor: 'var(--hermo-warn)' },
    adiado: { rot: 'adiado', cor: 'var(--hermo-text-dim)' }
};

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarPlanos() {
    const { data, error } = await sb.from('hermo_planejamentos')
        .select(`*,
            itens:hermo_planejamento_itens(*,
                servico:hermo_obra_servicos(id, quantidade, unidade, total, preco_unit, qtd_executada,
                    inicio_real, fim_real, local_execucao,
                    servico:hermo_servicos(codigo, descricao),
                    obra:hermo_obras(id, numero, ano, nome, latitude, longitude))),
            alocacoes:hermo_planejamento_alocacoes(*,
                integrante:hermo_integrantes(id, nome, apelido),
                equipe:hermo_equipes(id, nome, cor))`)
        .order('periodo_de', { ascending: false });
    if (error) { toast('Erro ao carregar planejamentos: ' + error.message, true); return false; }
    planos = data || [];
    return true;
}

function popularSelect() {
    const sel = $('pl-lista-sel');
    sel.innerHTML = planos.length
        ? planos.map(p => `<option value="${p.id}">${esc(p.nome || 'Planejamento')} · ${ddmm(p.periodo_de)}–${ddmm(p.periodo_ate)} · ${p.status}</option>`).join('')
        : '<option value="">— nenhum planejamento ainda —</option>';
    if (atual && planos.some(p => p.id === atual.id)) sel.value = atual.id;
}

// ============================================================
// RENDER
// ============================================================
function abrirPlano(id) {
    atual = planos.find(p => p.id === id) || planos[0] || null;
    diaCursor = atual ? atual.periodo_de : null;
    render();
}

function render() {
    popularSelect();
    const resumo = $('pl-resumo'), grade = $('pl-grade');
    if (!atual) {
        resumo.innerHTML = '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Nenhum planejamento ainda — use <b>📏 2ª régua</b> na aba “Execução no tempo”, escolha o período e clique em <b>📋 Planejar este período</b>.</div>';
        grade.innerHTML = '';
        $('pl-dia-info').innerHTML = '';
        return;
    }
    const p = atual;
    const itens = (p.itens || []).slice().sort((a, b) => (a.inicio_previsto || '').localeCompare(b.inicio_previsto || ''));
    const comEquipe = itens.filter(i => i.situacao === 'com_equipe');
    const executados = itens.filter(i => i.executado);
    const previsto = itens.reduce((t, i) => t + num(i.valor_previsto), 0);
    resumo.innerHTML = `
    <div class="pl-cartao">
        <span class="st ${p.status}">${p.status}</span>
        <b>${esc(p.nome || 'Planejamento')}</b>
        <span>${fmtData(p.periodo_de)} → ${fmtData(p.periodo_ate)} (${difDias(p.periodo_de, p.periodo_ate) + 1} dias)</span>
        <span>· ${itens.length} serviço(s), ${comEquipe.length} com equipe</span>
        <span>· previsto <b>${fmtMoeda(previsto)}</b></span>
        ${executados.length ? `<span>· ✅ ${executados.length} confirmado(s)</span>` : ''}
        ${p.observacoes ? `<span style="color:var(--hermo-text-dim)">· ${esc(p.observacoes)}</span>` : ''}
    </div>`;

    // ----- linha do tempo do período -----
    const px = pxDia();
    const min = p.periodo_de, max = p.periodo_ate;
    const dias = difDias(min, max) + 1;
    const W = dias * px;
    const xDe = iso => Math.max(0, difDias(min, iso)) * px;

    let escala = '';
    for (let d = 0; d < dias; d++) {
        const iso = addDias(min, d);
        const dow = new Date(iso + 'T00:00:00').getDay();
        escala += `<div class="tlx-dia" style="left:${d * px}px;width:${px}px;${dow === 0 || dow === 6 ? 'opacity:.5' : ''}">${px >= 14 ? iso.slice(8, 10) : ''}</div>`;
    }
    const linhas = itens.map(i => {
        const s = i.servico;
        const ini = i.inicio_previsto || min, fim = i.fim_previsto || max;
        const vIni = ini < min ? min : ini, vFim = fim > max ? max : fim;
        const larg = Math.max((difDias(vIni, vFim) + 1) * px, 6);
        const sit = SITUACAO[i.situacao] || SITUACAO.com_equipe;
        const alocs = (p.alocacoes || []).filter(a => a.obra_servico_id === i.obra_servico_id);
        const nomes = [...new Set(alocs.map(a => a.integrante?.apelido || a.integrante?.nome || '?'))];
        const comeca = ini >= min, termina = fim <= max;
        return `
        <div class="tlx-linha">
            <div class="tlx-rotulo" title="${esc(s?.servico?.descricao || '')}">
                <b>${esc(s?.servico?.codigo || '?')}</b> ${esc(s?.servico?.descricao || '')}
                <small>${esc(codObra(s?.obra))} · ${sit.rot}${i.executado ? ' · ✅ executado' : ''}</small>
            </div>
            <div class="tlx-faixa" style="width:${W}px;min-height:30px">
                <div class="tlx-bar" style="left:${xDe(vIni)}px;width:${larg}px;background:rgba(59,130,246,.3);border-color:${sit.cor};cursor:default"
                     title="${esc(s?.servico?.codigo || '')} · ${ddmm(ini)}–${ddmm(fim)} · ${sit.rot}${nomes.length ? ' · 👷 ' + esc(nomes.join(', ')) : ''}">
                    ${comeca ? '▶ ' : ''}${esc(s?.servico?.codigo || '')}${termina ? ' ⏹' : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    grade.innerHTML = `
        <div class="tlx-linha tlx-escala-topo">
            <div class="tlx-rotulo"></div>
            <div class="tlx-faixa" style="width:${W}px;min-height:22px">${escala}</div>
        </div>
        ${linhas}
        <div class="pl-dia-cursor" data-rot="${ddmm(diaCursor || min)}" style="left:${rotuloW() + xDe(diaCursor || min)}px"></div>`;
    ligarCursor(min, max, px);
    renderDia();
}

function ligarCursor(min, max, px) {
    const el = $('pl-grade').querySelector('.pl-dia-cursor');
    if (!el) return;
    el.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        pararPlay();
        const x0 = e.clientX, base = diaCursor, left0 = parseFloat(el.style.left);
        const mover = ev => {
            let d = Math.round((ev.clientX - x0) / px);
            let novo = addDias(base, d);
            if (novo < min) novo = min;
            if (novo > max) novo = max;
            diaCursor = novo;
            el.style.left = (left0 + difDias(base, novo) * px) + 'px';
            el.dataset.rot = ddmm(novo);
            renderDia();
        };
        const soltar = () => {
            el.removeEventListener('pointermove', mover);
            el.removeEventListener('pointerup', soltar);
            el.removeEventListener('pointercancel', soltar);   // gesto abortado: solta os listeners
        };
        el.addEventListener('pointermove', mover);
        el.addEventListener('pointerup', soltar);
        el.addEventListener('pointercancel', soltar);
    });
}

/** O que acontece no dia do cursor: quem começa, quem termina, quem está onde. */
function fotoDoDia(dia) {
    const p = atual;
    const comecam = [], terminam = [], ativos = [];
    (p.itens || []).forEach(i => {
        if (i.situacao !== 'com_equipe') return;
        const s = i.servico;
        if (!s) return;
        if (i.inicio_previsto === dia) comecam.push(i);
        if (i.fim_previsto === dia) terminam.push(i);
        if ((i.inicio_previsto || dia) <= dia && (i.fim_previsto || dia) >= dia) ativos.push(i);
    });
    // onde cada integrante está hoje e onde estava ontem (trajetórias)
    const ontem = addDias(dia, -1);
    const posicao = (quando) => {
        const m = new Map();
        (p.alocacoes || []).forEach(a => {
            if (a.data_inicio > quando || a.data_fim < quando) return;
            const it = (p.itens || []).find(x => x.obra_servico_id === a.obra_servico_id);
            const ob = it?.servico?.obra;
            if (!ob || ob.latitude == null) return;
            m.set(a.integrante_id, { ob, aloc: a, item: it });
        });
        return m;
    };
    const hoje = posicao(dia), antes = posicao(ontem);
    const trajetos = [];
    hoje.forEach((v, k) => {
        const a = antes.get(k);
        if (a && a.ob.id !== v.ob.id) trajetos.push({ de: a.ob, para: v.ob, integrante: v.aloc.integrante, cor: v.aloc.equipe?.cor });
    });
    return { comecam, terminam, ativos, hoje, trajetos };
}

function renderDia() {
    if (!atual || !diaCursor) { $('pl-dia-info').innerHTML = ''; return; }
    const f = fotoDoDia(diaCursor);
    const lista = (arr, ic) => arr.length
        ? arr.map(i => `${ic} <b>${esc(i.servico?.servico?.codigo || '')}</b> ${esc(i.servico?.servico?.descricao || '')} <small style="color:var(--hermo-text-dim)">(${esc(codObra(i.servico?.obra))})</small>`).join(' · ')
        : '<span style="color:var(--hermo-text-dim)">—</span>';
    $('pl-dia-info').innerHTML = `
    <div class="pl-cartao" style="align-items:flex-start;flex-direction:column;gap:6px">
        <div><b>📅 ${fmtData(diaCursor)}</b> · ${f.ativos.length} serviço(s) em execução · 👷 ${f.hoje.size} pessoa(s) em campo</div>
        <div style="font-size:.78rem">▶ Começam: ${lista(f.comecam, '▶')}</div>
        <div style="font-size:.78rem">⏹ Terminam: ${lista(f.terminam, '⏹')}</div>
        ${f.trajetos.length ? `<div style="font-size:.78rem">🧭 Deslocamentos hoje: ${f.trajetos.map(t =>
            `${esc(t.integrante?.apelido || t.integrante?.nome || '?')} <span style="color:var(--hermo-text-dim)">${esc(codObra(t.de))} → ${esc(codObra(t.para))}</span>`).join(' · ')}</div>` : ''}
    </div>`;
    atualizarMapaDia(f);
}

// ============================================================
// MAPA DO DIA (trajetórias)
// ============================================================
function atualizarMapaDia(f) {
    const div = $('pl-mapa');
    if (!div || div.offsetParent === null || typeof L === 'undefined') return;
    if (!mapa) {
        mapa = L.map('pl-mapa').setView([-8.0476, -34.877], 11);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 19
        }).addTo(mapa);
        setTimeout(() => mapa.invalidateSize(), 150);
    }
    camadas.forEach(c => mapa.removeLayer(c));
    camadas = [];
    const bounds = [];
    // obras do plano com gente/serviço no dia
    const porObra = new Map();
    f.ativos.forEach(i => {
        const ob = i.servico?.obra;
        if (!ob || ob.latitude == null) return;
        const reg = porObra.get(ob.id) || { ob, servicos: [], comecam: 0, terminam: 0, pessoas: new Set() };
        reg.servicos.push(i);
        if (f.comecam.includes(i)) reg.comecam++;
        if (f.terminam.includes(i)) reg.terminam++;
        porObra.set(ob.id, reg);
    });
    f.hoje.forEach(v => {
        const reg = porObra.get(v.ob.id);
        if (reg) reg.pessoas.add(v.aloc.integrante?.apelido || v.aloc.integrante?.nome || '?');
    });
    porObra.forEach(reg => {
        const cor = reg.comecam ? '#22c55e' : (reg.terminam ? '#a855f7' : '#3b82f6');
        const m = L.circleMarker([reg.ob.latitude, reg.ob.longitude], {
            radius: 8 + Math.min(reg.pessoas.size, 6), color: '#0f172a', weight: 2,
            fillColor: cor, fillOpacity: .95
        }).addTo(mapa);
        m.bindPopup(`<div style="font-size:.82rem;max-width:250px">
            <b>${esc(codObra(reg.ob))} — ${esc(reg.ob.nome)}</b><br>
            ${reg.servicos.map(i => `• ${esc(i.servico?.servico?.codigo || '')} ${esc(i.servico?.servico?.descricao || '').slice(0, 26)}`).join('<br>')}
            ${reg.pessoas.size ? `<br>👷 ${esc([...reg.pessoas].join(', '))}` : ''}
            ${reg.comecam ? '<br>▶ começa hoje' : ''}${reg.terminam ? '<br>⏹ termina hoje' : ''}
        </div>`);
        camadas.push(m);
        bounds.push([reg.ob.latitude, reg.ob.longitude]);
    });
    // trajetórias de quem trocou de obra
    f.trajetos.forEach(t => {
        if (t.de.latitude == null || t.para.latitude == null) return;
        const linha = L.polyline([[t.de.latitude, t.de.longitude], [t.para.latitude, t.para.longitude]], {
            color: t.cor || '#eab308', weight: 3, opacity: .9, dashArray: '6 6'
        }).addTo(mapa);
        linha.bindTooltip(`🧭 ${t.integrante?.apelido || t.integrante?.nome || '?'}: ${codObra(t.de)} → ${codObra(t.para)}`);
        camadas.push(linha);
        // seta no meio do trajeto
        const mx = (t.de.latitude + t.para.latitude) / 2, my = (t.de.longitude + t.para.longitude) / 2;
        const seta = L.marker([mx, my], {
            icon: L.divIcon({
                className: '', html: `<div style="font-size:16px;filter:drop-shadow(0 0 3px #000)">🧭</div>`,
                iconSize: [18, 18], iconAnchor: [9, 9]
            })
        }).addTo(mapa);
        camadas.push(seta);
        bounds.push([t.de.latitude, t.de.longitude], [t.para.latitude, t.para.longitude]);
    });
    const chave = bounds.map(b => b.join(',')).sort().join(';');
    if (chave && chave !== atualizarMapaDia._chave) {
        atualizarMapaDia._chave = chave;
        if (bounds.length === 1) mapa.setView(bounds[0], 13);
        else if (bounds.length > 1) mapa.fitBounds(bounds, { padding: [30, 30] });
    }
}

// ============================================================
// ▶ PERCORRER
// ============================================================
function pararPlay() {
    if (tocando) { clearInterval(tocando); tocando = null; $('pl-play').textContent = '▶ Percorrer'; }
}
function alternarPlay() {
    if (tocando) { pararPlay(); return; }
    if (!atual) return;
    $('pl-play').textContent = '⏸ Pausar';
    tocando = setInterval(() => {
        if (!atual) { pararPlay(); return; }
        diaCursor = diaCursor >= atual.periodo_ate ? atual.periodo_de : addDias(diaCursor, 1);
        const el = $('pl-grade').querySelector('.pl-dia-cursor');
        if (el) {
            el.style.left = (rotuloW() + Math.max(0, difDias(atual.periodo_de, diaCursor)) * pxDia()) + 'px';
            el.dataset.rot = ddmm(diaCursor);
        }
        renderDia();
    }, 900);
}

// ============================================================
// CONFIRMAR EXECUÇÃO
// ============================================================
function abrirExecucao() {
    if (!atual) { toast('Escolha um planejamento.', true); return; }
    const p = atual;
    $('ple-cabeca').innerHTML = `<b>${esc(p.nome || 'Planejamento')}</b> · ${fmtData(p.periodo_de)} → ${fmtData(p.periodo_ate)}`;
    $('ple-itens').innerHTML = (p.itens || []).map((i, idx) => {
        const s = i.servico;
        const contratado = num(s?.quantidade);
        // ACUMULADO da obra (não a fatia do período): já executado + a fatia prevista aqui
        const jaExec = i.qtd_executada != null
            ? i.qtd_executada
            : (i.qtd_prevista != null
                ? Math.round((num(s?.qtd_executada) + num(i.qtd_prevista)) * 100) / 100
                : (s?.qtd_executada ?? ''));
        return `
        <div class="ple-item">
            <div class="txt"><b>${esc(s?.servico?.codigo || '?')}</b> ${esc(s?.servico?.descricao || '')}
                <small>${esc(codObra(s?.obra))} · fatia do período: ${i.qtd_prevista != null ? fmtQtd(i.qtd_prevista) : '—'} · já na obra: ${fmtQtd(s?.qtd_executada)} de ${fmtQtd(contratado)} ${esc(s?.unidade || 'un')} · ${SITUACAO[i.situacao]?.rot || i.situacao}</small>
            </div>
            <label title="Total acumulado do serviço na obra (não só o período)">executado acumulado</label>
            <input type="number" step="any" min="0" value="${jaExec}" data-ple-qtd="${idx}" />
            <label>iniciou</label>
            <input type="date" value="${i.iniciou_em || s?.inicio_real || ''}" data-ple-ini="${idx}" />
            <label>concluiu</label>
            <input type="date" value="${i.concluiu_em || s?.fim_real || ''}" data-ple-fim="${idx}" />
        </div>`;
    }).join('') || '<div style="font-size:.8rem;color:var(--hermo-text-dim)">Sem itens.</div>';
    const alocs = p.alocacoes || [];
    $('ple-presencas').innerHTML = alocs.length ? `
        <div style="font-size:.76rem;color:var(--hermo-text-dim);margin-top:6px">Presenças no período (desmarque quem faltou):</div>
        ${alocs.map((a, i) => `
        <label class="lc-item">
            <input type="checkbox" data-ple-pres="${i}" ${a.presente === false ? '' : 'checked'} />
            <div class="txt"><b>${esc(a.integrante?.nome || '?')}</b>
                <small>${ddmm(a.data_inicio)}–${ddmm(a.data_fim)}${a.equipe ? ' · equipe ' + esc(a.equipe.nome) : ''}</small>
            </div>
        </label>`).join('')}` : '';
    $('ple-overlay').classList.add('aberto');
}

async function gravarExecucao() {
    if (!atual) return;
    const p = atual;
    const itens = (p.itens || []).map((i, idx) => ({
        obra_servico_id: i.obra_servico_id,
        qtd_executada: $(`ple-itens`).querySelector(`[data-ple-qtd="${idx}"]`)?.value || null,
        iniciou_em: document.querySelector(`[data-ple-ini="${idx}"]`)?.value || null,
        concluiu_em: document.querySelector(`[data-ple-fim="${idx}"]`)?.value || null
    }));
    const alocacoes = (p.alocacoes || []).map((a, i) => ({
        alocacao_id: a.alocacao_id,
        presente: document.querySelector(`[data-ple-pres="${i}"]`)?.checked !== false
    })).filter(x => x.alocacao_id);
    const btn = $('ple-confirmar');
    btn.disabled = true;
    try {
        const { data, error } = await sb.rpc('hermo_confirmar_execucao', {
            p: { planejamento_id: p.id, itens, alocacoes }
        });
        if (error) throw error;
        $('ple-overlay').classList.remove('aberto');
        await carregarPlanos();
        abrirPlano(p.id);
        // a linha do tempo precisa recarregar (datas/percentuais/travas mudaram)
        window.dispatchEvent(new CustomEvent('plan-mudou'));
        toast(`✅ Execução gravada: ${data?.itens || 0} serviço(s) atualizados em ${data?.obras || 0} obra(s) — % executado, medições e projeções recalculados.`);
    } catch (e) {
        toast('Erro ao gravar a execução: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

async function reabrir() {
    if (!atual) return;
    if (!confirm(`Reabrir "${atual.nome || 'planejamento'}"?\n\nAs datas e alocações do período voltam a ser editáveis na linha do tempo.`)) return;
    const { error } = await sb.rpc('hermo_reabrir_planejamento', { p_id: atual.id });
    if (error) { toast('Erro ao reabrir: ' + error.message, true); return; }
    await carregarPlanos();
    abrirPlano(atual.id);
    window.dispatchEvent(new CustomEvent('plan-mudou'));   // destrava a linha do tempo sem F5
    toast('🔓 Planejamento reaberto — o período voltou a ser editável na linha do tempo.');
}

// ============================================================
// EVENTOS / BOOT
// ============================================================
$('pl-lista-sel').addEventListener('change', e => { pararPlay(); abrirPlano(e.target.value); });
$('pl-zoom-mais').addEventListener('click', () => { if (pxIdx < PXS.length - 1) { pxIdx++; render(); } });
$('pl-zoom-menos').addEventListener('click', () => { if (pxIdx > 0) { pxIdx--; render(); } });
$('pl-play').addEventListener('click', alternarPlay);
$('pl-reabrir').addEventListener('click', reabrir);
$('pl-executar').addEventListener('click', abrirExecucao);
$('ple-fechar').addEventListener('click', () => $('ple-overlay').classList.remove('aberto'));
$('ple-cancelar').addEventListener('click', () => $('ple-overlay').classList.remove('aberto'));
$('ple-confirmar').addEventListener('click', gravarExecucao);

window.addEventListener('plan-visivel', async () => {
    if (!planos.length) { await carregarPlanos(); }
    if (!atual && planos.length) abrirPlano(planos[0].id); else render();
    setTimeout(() => { if (mapa) mapa.invalidateSize(); }, 200);
});
window.addEventListener('plan-criado', async ev => {
    await carregarPlanos();
    if (ev.detail?.id) abrirPlano(ev.detail.id);
});
window.addEventListener('beforeunload', pararPlay);

(async () => {
    if (await carregarPlanos()) {
        popularSelect();
        if (planos.length && $('pl-secao')?.style.display !== 'none') abrirPlano(planos[0].id);
    }
})();
