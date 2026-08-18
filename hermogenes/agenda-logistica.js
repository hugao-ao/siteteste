// agenda-logistica.js — Montagem de rotas/agenda do dia a partir das visitas MARCADAS
// Deslocamentos estimados via OSRM (OpenStreetMap) — gratuito, sem chave.
import { sb, toast, fmtDataHora, inputParaISO, isoParaInput, esc, STATUS_VISITA } from './hermo-common.js';

const $ = id => document.getElementById(id);

const CORES_ROTA = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#fb7185'];
const COR_MARCADA = '#3b82f6';

// ---------- Estado ----------
let visitas = [];            // visitas marcadas com coordenadas
let rotas = [];              // rotas salvas (com paradas embutidas)
let mapa = null;
let marcadores = new Map();  // visita_id -> marker
let linhasSalvas = [];       // polylines das rotas salvas
let linhaDraft = null;       // polyline da rota calculada (OSRM)
let linhaEsboco = null;      // prévia tracejada durante a montagem (linha reta)

let draft = { paradas: [] }; // [{visita_id, permanencia_min}]
let editandoRotaId = null;
let calcResultado = null;    // resultado do último "Calcular rota" (invalida ao mexer no draft)

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarTudo() {
    const [v, r] = await Promise.all([
        sb.from('hermo_visitas')
            .select('id, endereco, latitude, longitude, status, data_visita, cliente:hermo_clientes(nome)')
            .neq('status', 'pendente_marcacao'),
        sb.from('hermo_rotas')
            .select('*, paradas:hermo_rota_paradas(*, visita:hermo_visitas(id, endereco, latitude, longitude))')
            .order('inicio')
    ]);
    if (v.error) { toast('Erro ao carregar visitas: ' + v.error.message, true); return; }
    if (r.error) { toast('Erro ao carregar rotas: ' + r.error.message, true); return; }
    visitas = (v.data || []).filter(x => x.latitude != null && x.longitude != null);
    rotas = (r.data || []).map(x => ({
        ...x,
        paradas: (x.paradas || []).sort((a, b) => a.ordem - b.ordem)
    }));
    renderResumo();
    renderMarcadores();
    renderRotasSalvas();
    popularEncadeamento();
    renderParadasDraft();
}

// ============================================================
// RESUMO
// ============================================================
function fmtDuracao(seg) {
    const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function paresSobrepostos() {
    const pares = [];
    for (let i = 0; i < rotas.length; i++)
        for (let j = i + 1; j < rotas.length; j++)
            if (janelasSobrepoem(rotas[i], rotas[j])) pares.push([rotas[i], rotas[j]]);
    return pares;
}

function renderResumo() {
    const totParadas = rotas.reduce((s, r) => s + r.paradas.length, 0);
    const totDesloc = rotas.reduce((s, r) => s + (r.desloc_total_seg || 0), 0);
    const totPerm = rotas.reduce((s, r) => s + (r.perman_total_seg || 0), 0);
    const sobre = paresSobrepostos().length;
    $('resumo').innerHTML = `
        <div class="stat"><div class="num">${rotas.length}</div><div class="lbl">Rotas</div></div>
        <div class="stat s-marcada"><div class="num">${totParadas}</div><div class="lbl">Paradas planejadas</div></div>
        <div class="stat s-concluida"><div class="num">${fmtDuracao(totPerm)}</div><div class="lbl">Tempo em visitas</div></div>
        <div class="stat s-pendente"><div class="num">${fmtDuracao(totDesloc)}</div><div class="lbl">Tempo em deslocamento</div></div>
        <div class="stat ${sobre ? 's-desistiu' : ''}"><div class="num">${sobre}</div><div class="lbl">Sobreposições</div></div>
        <div class="stat s-pendencias"><div class="num">${visitas.length}</div><div class="lbl">Visitas roteáveis</div></div>`;
}

// ============================================================
// MAPA
// ============================================================
function iniciarMapa() {
    if (typeof L === 'undefined') return;
    mapa = L.map('al-mapa').setView([-8.0476, -34.877], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(mapa);
    $('mapa-legenda').innerHTML =
        Object.entries(STATUS_VISITA)
            .filter(([k]) => k !== 'pendente_marcacao')
            .map(([k, v]) => `<span class="leg"><span class="dot" style="background:${v.cor}"></span>${v.label}</span>`)
            .join('') +
        `<span class="leg"><span class="dot" style="background:var(--hermo-primary)"></span>Nº = parada da rota em montagem</span>`;
}

let mapaEnquadrado = false;

function renderMarcadores() {
    if (!mapa) return;
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores.clear();
    const pontos = [];
    visitas.forEach(v => {
        const idx = draft.paradas.findIndex(p => p.visita_id === v.id);
        let marker;
        if (idx >= 0) {
            marker = L.marker([v.latitude, v.longitude], {
                icon: L.divIcon({ className: 'al-marker-num', html: String(idx + 1), iconSize: [26, 26] })
            });
        } else {
            marker = L.circleMarker([v.latitude, v.longitude], {
                radius: 9, color: '#0f172a', weight: 2,
                fillColor: STATUS_VISITA[v.status]?.cor || COR_MARCADA, fillOpacity: 1
            });
        }
        marker.addTo(mapa);
        const emRotas = rotas.filter(r => r.paradas.some(p => p.visita_id === v.id)).map(r => r.nome);
        marker.bindTooltip(
            `${esc(v.endereco)}${v.cliente ? ' — ' + esc(v.cliente.nome) : ''}` +
            `<br>Status: ${STATUS_VISITA[v.status]?.label || v.status}` +
            `${v.data_visita ? '<br>Data: ' + fmtDataHora(v.data_visita) : ''}` +
            `${emRotas.length ? '<br>⚠ já na rota: ' + esc(emRotas.join(', ')) : ''}`,
            { sticky: true });
        marker.on('click', () => alternarParada(v.id));
        marcadores.set(v.id, marker);
        pontos.push([v.latitude, v.longitude]);
    });
    // enquadrar só na primeira renderização — cliques de seleção não podem
    // resetar o zoom/pan que o usuário ajustou
    if (!mapaEnquadrado && pontos.length > 0) {
        if (pontos.length === 1) mapa.setView(pontos[0], 14);
        else mapa.fitBounds(pontos, { padding: [40, 40] });
        mapaEnquadrado = true;
    }
}

function desenharRotasSalvas() {
    if (!mapa) return;
    linhasSalvas.forEach(l => mapa.removeLayer(l));
    linhasSalvas = [];
    rotas.forEach(r => {
        if (!r.geom) return;
        const linha = L.polyline(decodePolyline(r.geom), {
            color: r.cor || '#f59e0b', weight: 4, opacity: .7
        }).addTo(mapa);
        linha.bindTooltip(`${esc(r.nome)} (${horaCurta(r.inicio)}–${horaCurta(r.fim_previsto)})`, { sticky: true });
        linhasSalvas.push(linha);
    });
}

// ============================================================
// DRAFT (rota em montagem)
// ============================================================
function invalidarCalculo() {
    calcResultado = null;
    $('al-salvar').disabled = true;
    $('al-timeline').classList.remove('aberta');
    if (linhaDraft && mapa) { mapa.removeLayer(linhaDraft); linhaDraft = null; }
    desenharEsboco();
}

/**
 * Prévia ao vivo da rota em montagem: liga as paradas na ordem dos cliques
 * (linha reta tracejada) e mostra um resumo instantâneo, antes do cálculo.
 */
function desenharEsboco() {
    const info = $('al-esboco-info');
    if (mapa && linhaEsboco) { mapa.removeLayer(linhaEsboco); linhaEsboco = null; }
    if (calcResultado || draft.paradas.length === 0) {
        info.style.display = 'none';
        return;
    }
    const pts = draft.paradas
        .map(p => visitas.find(x => x.id === p.visita_id))
        .filter(v => v && v.latitude != null)
        .map(v => [v.latitude, v.longitude]);
    if (mapa && pts.length >= 2) {
        linhaEsboco = L.polyline(pts, { color: '#f59e0b', weight: 3, opacity: .85, dashArray: '4 10' }).addTo(mapa);
    }
    let km = 0;
    for (let i = 0; i < pts.length - 1; i++) km += haversineKm(pts[i], pts[i + 1]);
    const permMin = draft.paradas.reduce((s, p) => s + (p.permanencia_min || 0), 0);
    info.style.display = '';
    info.innerHTML = `Prévia: <b>${draft.paradas.length}</b> parada(s) · permanência <b>${fmtDuracao(permMin * 60)}</b>` +
        (pts.length >= 2 ? ` · ~<b>${km.toFixed(1)} km</b> em linha reta` : '') +
        ' — use 🧭 Calcular para os tempos reais de deslocamento.';
}

function alternarParada(visitaId) {
    const i = draft.paradas.findIndex(p => p.visita_id === visitaId);
    if (i >= 0) draft.paradas.splice(i, 1);
    else draft.paradas.push({ visita_id: visitaId, permanencia_min: 60 });
    invalidarCalculo();
    renderMarcadores();
    renderParadasDraft();
}

function moverParada(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= draft.paradas.length) return;
    [draft.paradas[i], draft.paradas[j]] = [draft.paradas[j], draft.paradas[i]];
    invalidarCalculo();
    renderMarcadores();
    renderParadasDraft();
}

/**
 * Lista-espelho das visitas marcadas, fora do mapa: mostra em tempo real o que
 * está na rota (com o nº da ordem) e permite adicionar/remover por botão.
 */
function renderListaVisitas() {
    const cont = $('al-vlista');
    if (!cont) return;
    if (visitas.length === 0) {
        cont.innerHTML = '<div class="al-dica">Nenhuma visita roteável — precisa ter localização e não estar "Pendente de marcação".</div>';
        return;
    }
    cont.innerHTML = visitas.map(v => {
        const idx = draft.paradas.findIndex(p => p.visita_id === v.id);
        const na = idx >= 0;
        const st = STATUS_VISITA[v.status] || { label: v.status, cor: '#94a3b8' };
        return `
        <div class="al-vitem ${na ? 'na-rota' : ''}">
            <span class="num ${na ? '' : 'vazio'}">${na ? idx + 1 : ''}</span>
            <div class="txt">
                ${esc(v.endereco)}
                <small><span style="color:${st.cor}">●</span> ${st.label}${v.cliente ? ' · ' + esc(v.cliente.nome) : ''}${v.data_visita ? ' · ' + fmtDataHora(v.data_visita) : ''}</small>
            </div>
            <button class="hermo-btn small ${na ? 'danger' : 'primary'}" data-vtoggle="${v.id}">${na ? '× Remover' : '+ Rota'}</button>
        </div>`;
    }).join('');
    cont.querySelectorAll('[data-vtoggle]').forEach(b =>
        b.addEventListener('click', () => alternarParada(b.dataset.vtoggle)));
}

function renderParadasDraft() {
    renderListaVisitas();
    $('al-num-paradas').textContent = draft.paradas.length;
    const cont = $('al-paradas');
    if (draft.paradas.length === 0) {
        cont.innerHTML = '<div class="al-dica">Nenhuma visita selecionada — clique nos marcadores azuis do mapa.</div>';
        return;
    }
    cont.innerHTML = draft.paradas.map((p, i) => {
        const v = visitas.find(x => x.id === p.visita_id);
        return `
        <div class="al-parada">
            <span class="num">${i + 1}</span>
            <div class="txt">
                ${esc(v?.endereco || '?')}
                <small>${v?.cliente ? esc(v.cliente.nome) + ' · ' : ''}${v?.data_visita ? 'marcada p/ ' + fmtDataHora(v.data_visita) : ''}</small>
            </div>
            <input class="perm" type="number" min="5" step="5" value="${p.permanencia_min}" data-perm="${i}" title="Permanência (minutos)" /> min
            <button class="hermo-btn small ghost" data-sobe="${i}" title="Subir">↑</button>
            <button class="hermo-btn small ghost" data-desce="${i}" title="Descer">↓</button>
            <button class="hermo-btn small danger" data-tira="${i}" title="Remover">×</button>
        </div>`;
    }).join('');
    cont.querySelectorAll('[data-perm]').forEach(inp => inp.addEventListener('change', e => {
        const v = Math.max(5, parseInt(e.target.value) || 60);
        draft.paradas[parseInt(e.target.dataset.perm)].permanencia_min = v;
        e.target.value = v;
        invalidarCalculo();
    }));
    cont.querySelectorAll('[data-sobe]').forEach(b => b.addEventListener('click', () => moverParada(parseInt(b.dataset.sobe), -1)));
    cont.querySelectorAll('[data-desce]').forEach(b => b.addEventListener('click', () => moverParada(parseInt(b.dataset.desce), 1)));
    cont.querySelectorAll('[data-tira]').forEach(b => b.addEventListener('click', () => alternarParada(draft.paradas[parseInt(b.dataset.tira)].visita_id)));
}

/** Ids de todas as rotas encadeadas (direta ou indiretamente) após a rota dada. */
function descendentesDe(id, set = new Set()) {
    rotas.filter(r => r.encadeada_apos === id && !set.has(r.id)).forEach(r => {
        set.add(r.id);
        descendentesDe(r.id, set);
    });
    return set;
}

function popularEncadeamento() {
    const sel = $('al-encadear');
    const atual = sel.value;
    sel.innerHTML = '<option value="">— rota independente —</option>';
    // nunca oferecer a própria rota NEM suas descendentes (criaria ciclo)
    const bloqueadas = editandoRotaId ? descendentesDe(editandoRotaId) : new Set();
    rotas.filter(r => r.id !== editandoRotaId && !bloqueadas.has(r.id)).forEach(r => {
        const o = document.createElement('option');
        o.value = r.id;
        o.textContent = `iniciar após: ${r.nome} (termina ${horaCurta(r.fim_previsto)})`;
        sel.appendChild(o);
    });
    sel.value = atual && [...sel.options].some(o => o.value === atual) ? atual : '';
    aoMudarEncadeamento();
}

function aoMudarEncadeamento() {
    const pai = rotas.find(r => r.id === $('al-encadear').value);
    const dica = $('al-encadear-dica');
    if (pai) {
        $('al-inicio').value = isoParaInput(pai.fim_previsto);
        $('al-inicio').disabled = true;
        // não apagar o valor digitado — só desabilitar (é ignorado quando encadeada)
        $('al-partida-end').disabled = true;
        const ult = pai.paradas[pai.paradas.length - 1];
        dica.style.display = '';
        dica.textContent = `Partida automática: ${fmtDataHora(pai.fim_previsto)}, saindo de "${ult?.visita?.endereco || 'última parada'}".`;
    } else {
        $('al-inicio').disabled = false;
        $('al-partida-end').disabled = false;
        dica.style.display = 'none';
    }
    invalidarCalculo();
}

// ============================================================
// CÁLCULO (OSRM + fallback)
// ============================================================
function haversineKm(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Consulta OSRM com todos os waypoints; null se indisponível. */
async function osrmRota(pontos) { // pontos: [[lat,lng],...]
    try {
        const coords = pontos.map(p => `${p[1]},${p[0]}`).join(';');
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 10000);
        const resp = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=false`,
            { signal: ctl.signal });
        clearTimeout(t);
        if (!resp.ok) return null;
        const j = await resp.json();
        if (j.code !== 'Ok' || !j.routes?.[0]) return null;
        return j.routes[0]; // { legs:[{duration,distance}], geometry }
    } catch (e) {
        return null;
    }
}

async function calcularRota() {
    // paradas cuja visita saiu do mapa (mudou de status / perdeu coordenadas em outra aba)
    const perdidas = draft.paradas.filter(p => !visitas.some(v => v.id === p.visita_id));
    if (perdidas.length > 0) {
        draft.paradas = draft.paradas.filter(p => visitas.some(v => v.id === p.visita_id));
        renderMarcadores();
        renderParadasDraft();
        toast(`${perdidas.length} parada(s) saíram do mapa (status mudou ou sem localização) e foram removidas.`, true);
    }
    if (draft.paradas.length === 0) { toast('Selecione ao menos uma visita no mapa.', true); return; }
    const pai = rotas.find(r => r.id === $('al-encadear').value);
    if (!pai && !$('al-inicio').value) { toast('Informe a data e hora de partida.', true); return; }
    if (pai && pai.paradas.length === 0) { toast('A rota anterior não tem paradas — não dá para encadear.', true); return; }

    const btn = $('al-calcular');
    btn.disabled = true;
    btn.textContent = 'Calculando…';
    try {
        // ponto de origem
        let origem = null, origemLabel = null, partidaGeo = null;
        if (pai) {
            const ult = pai.paradas[pai.paradas.length - 1];
            if (ult?.visita?.latitude == null || ult?.visita?.longitude == null) {
                toast('A última parada da rota anterior está sem localização no mapa — não dá para encadear a partir dela.', true);
                return;
            }
            origem = [ult.visita.latitude, ult.visita.longitude];
            origemLabel = `Saída da rota "${pai.nome}"`;
        } else if ($('al-partida-end').value.trim()) {
            partidaGeo = await geocodificar($('al-partida-end').value.trim());
            if (!partidaGeo) { toast('Não localizei o ponto de partida — verifique o endereço.', true); return; }
            origem = [partidaGeo.lat, partidaGeo.lng];
            origemLabel = $('al-partida-end').value.trim();
        }

        const stops = draft.paradas.map(p => {
            const v = visitas.find(x => x.id === p.visita_id);
            return { ...p, visita: v, ponto: [v.latitude, v.longitude] };
        });
        const pontos = (origem ? [origem] : []).concat(stops.map(s => s.ponto));

        // deslocamentos
        let legs = [], geom = null, aproximado = false;
        if (pontos.length >= 2) {
            const rota = await osrmRota(pontos);
            if (rota) {
                legs = rota.legs.map(l => ({ seg: Math.round(l.duration), km: l.distance / 1000 }));
                geom = rota.geometry;
            } else {
                aproximado = true;
                for (let i = 0; i < pontos.length - 1; i++) {
                    const km = haversineKm(pontos[i], pontos[i + 1]) * 1.35; // fator viário urbano
                    legs.push({ seg: Math.round(km / 28 * 3600), km }); // ~28 km/h média urbana
                }
                toast('Roteador indisponível — usando estimativa aproximada em linha reta.', true);
            }
        }

        // linha do tempo
        const inicio = pai ? new Date(pai.fim_previsto) : new Date($('al-inicio').value);
        let t = inicio.getTime();
        let deslocTotal = 0, kmTotal = 0, permTotal = 0;
        const temLegParaPrimeira = origem != null;
        stops.forEach((s, i) => {
            const leg = temLegParaPrimeira ? legs[i] : (i === 0 ? null : legs[i - 1]);
            if (leg) { t += leg.seg * 1000; deslocTotal += leg.seg; kmTotal += leg.km; }
            s.leg = leg;
            s.chegada = new Date(t);
            permTotal += s.permanencia_min * 60;
            t += s.permanencia_min * 60 * 1000;
            s.saida = new Date(t);
        });

        calcResultado = {
            inicio, fim: new Date(t), stops, geom, aproximado,
            deslocTotal, kmTotal, permTotal,
            encadeadaApos: pai?.id || null,
            partidaEndereco: pai ? null : ($('al-partida-end').value.trim() || null),
            partidaGeo
        };
        renderTimeline(origemLabel);
        desenharEsboco(); // remove a prévia — a linha calculada assume
        desenharDraft();
        $('al-salvar').disabled = false;
    } finally {
        btn.disabled = false;
        btn.textContent = '🧭 Calcular rota';
    }
}

function horaCurta(d) {
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderTimeline(origemLabel) {
    const c = calcResultado;
    const tl = $('al-timeline');
    let html = `<div class="tl-linha"><span class="tl-hora">${horaCurta(c.inicio)}</span>
        <span>🚩 Partida${origemLabel ? ' — ' + esc(origemLabel) : ' (início na 1ª visita)'}</span></div>`;
    c.stops.forEach((s, i) => {
        if (s.leg) html += `<div class="tl-desloc">🚗 ${fmtDuracao(s.leg.seg)} · ${s.leg.km.toFixed(1)} km${c.aproximado ? ' (aprox.)' : ''}</div>`;
        html += `<div class="tl-linha"><span class="tl-hora">${horaCurta(s.chegada)}–${horaCurta(s.saida)}</span>
            <span>📍 ${i + 1}. ${esc(s.visita.endereco)} <small style="color:var(--hermo-text-dim)">(${s.permanencia_min} min)</small></span></div>`;
    });
    html += `<div class="tl-linha tl-total"><span class="tl-hora">${horaCurta(c.fim)}</span><span>🏁 Fim previsto</span></div>
        <div class="tl-total">Permanência ${fmtDuracao(c.permTotal)} · Deslocamento ${fmtDuracao(c.deslocTotal)} (${c.kmTotal.toFixed(1)} km) · <b>Duração total ${fmtDuracao((c.fim - c.inicio) / 1000)}</b></div>`;
    tl.innerHTML = html;
    tl.classList.add('aberta');
}

function desenharDraft() {
    if (!mapa) return;
    if (linhaDraft) { mapa.removeLayer(linhaDraft); linhaDraft = null; }
    if (calcResultado?.geom) {
        linhaDraft = L.polyline(decodePolyline(calcResultado.geom), {
            color: '#ffffff', weight: 5, opacity: .9, dashArray: '8 6'
        }).addTo(mapa);
        mapa.fitBounds(linhaDraft.getBounds(), { padding: [40, 40] });
    }
}

// ============================================================
// SOBREPOSIÇÃO
// ============================================================
function janelasSobrepoem(a, b) {
    return new Date(a.inicio) < new Date(b.fim_previsto) && new Date(b.inicio) < new Date(a.fim_previsto);
}

/**
 * Conflitos considerando o estado PÓS-salvamento: aplica a nova janela da rota
 * editada e simula o deslize das rotas encadeadas a ela (evita alarme falso com
 * a própria filha e detecta conflitos NOVOS criados pelo deslize).
 */
function conflitosSimulados(c, nomeNova) {
    const janelas = new Map();
    rotas.forEach(r => janelas.set(r.id, { inicio: new Date(r.inicio), fim: new Date(r.fim_previsto), nome: r.nome }));
    const idEditada = editandoRotaId || '__nova__';
    janelas.set(idEditada, { inicio: c.inicio, fim: c.fim, nome: nomeNova });

    const alteradas = new Set([idEditada]);
    const deslizar = (paiId, novoFim, vis = new Set()) => {
        if (vis.has(paiId)) return;
        vis.add(paiId);
        rotas.filter(r => r.encadeada_apos === paiId && !vis.has(r.id)).forEach(r => {
            const j = janelas.get(r.id);
            const delta = novoFim - j.inicio;
            j.inicio = new Date(j.inicio.getTime() + delta);
            j.fim = new Date(j.fim.getTime() + delta);
            alteradas.add(r.id);
            deslizar(r.id, j.fim, vis);
        });
    };
    if (editandoRotaId) deslizar(editandoRotaId, c.fim);

    const ids = [...janelas.keys()];
    const avisos = [];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            if (!alteradas.has(ids[i]) && !alteradas.has(ids[j])) continue;
            const A = janelas.get(ids[i]), B = janelas.get(ids[j]);
            if (A.inicio < B.fim && B.inicio < A.fim) {
                avisos.push(`• "${A.nome}" (${horaCurta(A.inicio)}–${horaCurta(A.fim)}) × "${B.nome}" (${horaCurta(B.inicio)}–${horaCurta(B.fim)})`);
            }
        }
    }
    return avisos;
}

// ============================================================
// SALVAR / EDITAR / EXCLUIR
// ============================================================
async function salvarRota() {
    const nome = $('al-nome').value.trim();
    if (!nome) { toast('Dê um nome à rota.', true); return; }
    if (!calcResultado) { toast('Calcule a rota antes de salvar.', true); return; }
    const c = calcResultado;

    // defesa contra ciclo de encadeamento (A após B após A…)
    if (c.encadeadaApos && editandoRotaId) {
        let p = c.encadeadaApos, guarda = 0;
        while (p && guarda++ < 100) {
            if (p === editandoRotaId) {
                toast('Encadeamento inválido: criaria um ciclo entre as rotas.', true);
                return;
            }
            p = rotas.find(r => r.id === p)?.encadeada_apos || null;
        }
    }

    // notificação de sobreposição (permitido, mas avisado — conforme combinado),
    // simulando o realinhamento das rotas encadeadas
    const conflitos = conflitosSimulados(c, nome);
    if (conflitos.length > 0) {
        const ok = confirm(
            `⚠ ATENÇÃO: após salvar, haverá execução simultânea (total ou parcial) entre:\n\n` +
            conflitos.join('\n') + '\n\nSalvar mesmo assim?');
        if (!ok) return;
    }

    const btn = $('al-salvar');
    btn.disabled = true;
    try {
        const rotaExistente = rotas.find(r => r.id === editandoRotaId);
        const cor = rotaExistente?.cor || CORES_ROTA[rotas.length % CORES_ROTA.length];
        const payload = {
            id: editandoRotaId || null,
            nome,
            inicio: c.inicio.toISOString(),
            fim_previsto: c.fim.toISOString(),
            partida_endereco: c.partidaEndereco,
            partida_lat: c.partidaGeo?.lat ?? null,
            partida_lng: c.partidaGeo?.lng ?? null,
            encadeada_apos: c.encadeadaApos,
            desloc_total_seg: c.deslocTotal,
            desloc_total_km: Math.round(c.kmTotal * 100) / 100,
            perman_total_seg: c.permTotal,
            cor,
            geom: c.geom,
            paradas: c.stops.map((s, i) => ({
                visita_id: s.visita_id,
                ordem: i + 1,
                permanencia_min: s.permanencia_min,
                chegada: s.chegada.toISOString(),
                saida: s.saida.toISOString(),
                desloc_seg: s.leg?.seg || 0,
                desloc_km: s.leg ? Math.round(s.leg.km * 100) / 100 : 0,
                desloc_aproximado: c.aproximado
            }))
        };
        const { data: rotaId, error } = await sb.rpc('hermo_salvar_rota', { p: payload });
        if (error) throw error;
        if (!editandoRotaId && rotaId) editandoRotaId = rotaId;

        // realinhar rotas encadeadas a esta (horários deslizam em cadeia)
        await realinharDependentes(editandoRotaId, c.fim.toISOString());

        toast('Rota salva.');
        limparDraft();
        await carregarTudo();
        desenharRotasSalvas();
    } catch (e) {
        toast('Erro ao salvar rota: ' + e.message, true);
    } finally {
        // no sucesso o draft foi limpo (calcResultado=null) — salvar continua travado
        btn.disabled = !calcResultado;
    }
}

/**
 * Desloca em cadeia os horários das rotas encadeadas quando a rota-pai muda.
 * Cada rota desliza ATOMICAMENTE via RPC; `visitados` protege contra ciclos
 * que porventura já estejam persistidos no banco.
 */
async function realinharDependentes(rotaPaiId, novoFimISO, visitados = new Set()) {
    if (visitados.has(rotaPaiId)) return;
    visitados.add(rotaPaiId);
    const filhas = rotas.filter(r => r.encadeada_apos === rotaPaiId && !visitados.has(r.id));
    for (const filha of filhas) {
        const deltaSeg = Math.round((new Date(novoFimISO) - new Date(filha.inicio)) / 1000);
        if (deltaSeg === 0) { visitados.add(filha.id); continue; }
        const { error } = await sb.rpc('hermo_deslizar_rota', { p_rota: filha.id, p_delta_seg: deltaSeg });
        if (error) {
            toast(`Não consegui realinhar a rota "${filha.nome}": ${error.message}`, true);
            visitados.add(filha.id);
            continue;
        }
        const novoInicio = new Date(new Date(filha.inicio).getTime() + deltaSeg * 1000);
        const novoFim = new Date(new Date(filha.fim_previsto).getTime() + deltaSeg * 1000);
        toast(`Rota encadeada "${filha.nome}" foi realinhada para começar ${horaCurta(novoInicio)}.`);
        await realinharDependentes(filha.id, novoFim.toISOString(), visitados);
    }
}

function limparDraft() {
    draft = { paradas: [] };
    editandoRotaId = null;
    $('al-titulo').textContent = 'Nova rota';
    $('al-nome').value = '';
    $('al-inicio').value = '';
    $('al-partida-end').value = '';
    $('al-encadear').value = '';
    aoMudarEncadeamento();
    invalidarCalculo();
    renderMarcadores();
    renderParadasDraft();
}

function editarRota(id) {
    const r = rotas.find(x => x.id === id);
    if (!r) return;
    editandoRotaId = id;
    draft.paradas = r.paradas.map(p => ({ visita_id: p.visita_id, permanencia_min: p.permanencia_min }));
    // paradas cuja visita saiu de "marcada" não estão no mapa — avisa e mantém as roteáveis
    const perdidas = draft.paradas.filter(p => !visitas.some(v => v.id === p.visita_id));
    if (perdidas.length > 0) {
        draft.paradas = draft.paradas.filter(p => visitas.some(v => v.id === p.visita_id));
        toast(`${perdidas.length} parada(s) desta rota saíram do mapa (voltaram a "Pendente de marcação" ou perderam a localização) e foram removidas do rascunho.`, true);
    }
    $('al-titulo').textContent = `Editando: ${r.nome}`;
    $('al-nome').value = r.nome;
    $('al-inicio').value = isoParaInput(r.inicio);
    $('al-partida-end').value = r.partida_endereco || '';
    popularEncadeamento();
    $('al-encadear').value = r.encadeada_apos || '';
    aoMudarEncadeamento();
    if (!r.encadeada_apos) $('al-inicio').value = isoParaInput(r.inicio);
    renderMarcadores();
    renderParadasDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Rota carregada no painel — recalcule antes de salvar.');
}

async function excluirRota(id) {
    const r = rotas.find(x => x.id === id);
    const filhas = rotas.filter(x => x.encadeada_apos === id);
    let msg = `Excluir a rota "${r?.nome}"?`;
    if (filhas.length > 0) msg += `\n\nAs rotas encadeadas a ela (${filhas.map(f => f.nome).join(', ')}) passarão a ser independentes.`;
    if (!confirm(msg)) return;
    const { error } = await sb.from('hermo_rotas').delete().eq('id', id);
    if (error) { toast('Erro ao excluir: ' + error.message, true); return; }
    toast('Rota excluída.');
    if (editandoRotaId === id) limparDraft();
    await carregarTudo();
    desenharRotasSalvas();
}

// ============================================================
// LISTA DE ROTAS SALVAS
// ============================================================
function renderRotasSalvas() {
    const cont = $('al-rotas');
    $('al-rotas-vazio').style.display = rotas.length ? 'none' : '';
    cont.innerHTML = rotas.map(r => {
        const sobre = rotas.filter(o => o.id !== r.id && janelasSobrepoem(r, o));
        const pai = rotas.find(o => o.id === r.encadeada_apos);
        const dia = new Date(r.inicio).toLocaleDateString('pt-BR');
        return `
        <div class="rota-card" style="border-left-color:${r.cor || '#f59e0b'}">
            <div class="rc-head">
                <span class="rc-nome">${esc(r.nome)}</span>
                <span class="rc-meta">${dia}</span>
            </div>
            <div class="rc-meta">🕒 ${horaCurta(r.inicio)} → ${horaCurta(r.fim_previsto)}
                · ${r.paradas.length} parada(s)</div>
            <div class="rc-meta">📍 Permanência ${fmtDuracao(r.perman_total_seg || 0)}
                · 🚗 Deslocamento ${fmtDuracao(r.desloc_total_seg || 0)} (${Number(r.desloc_total_km || 0).toFixed(1)} km)</div>
            ${pai ? `<div class="rc-chain">🔗 Inicia após "${esc(pai.nome)}"</div>` : ''}
            ${sobre.length ? `<div class="rc-aviso">⚠ Sobrepõe: ${sobre.map(o => esc(o.nome) + ' (' + horaCurta(o.inicio) + '–' + horaCurta(o.fim_previsto) + ')').join('; ')}</div>` : ''}
            <div class="acoes">
                <button class="hermo-btn small ghost" data-editar="${r.id}">✎ Editar</button>
                <button class="hermo-btn small danger" data-excluir="${r.id}">🗑 Excluir</button>
            </div>
        </div>`;
    }).join('');
    cont.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => editarRota(b.dataset.editar)));
    cont.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', () => excluirRota(b.dataset.excluir)));
}

// ============================================================
// GEOCODE (Nominatim) e POLYLINE
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

function decodePolyline(str) {
    let index = 0, lat = 0, lng = 0;
    const pontos = [];
    while (index < str.length) {
        for (const alvo of ['lat', 'lng']) {
            let shift = 0, result = 0, b;
            do {
                b = str.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const delta = (result & 1) ? ~(result >> 1) : (result >> 1);
            if (alvo === 'lat') lat += delta; else lng += delta;
        }
        pontos.push([lat / 1e5, lng / 1e5]);
    }
    return pontos;
}

// ============================================================
// BOOT
// ============================================================
$('al-calcular').addEventListener('click', calcularRota);
$('al-salvar').addEventListener('click', salvarRota);
$('al-limpar').addEventListener('click', limparDraft);
$('al-encadear').addEventListener('change', aoMudarEncadeamento);
$('al-inicio').addEventListener('input', invalidarCalculo);
$('al-partida-end').addEventListener('input', invalidarCalculo);

iniciarMapa();
carregarTudo().then(() => desenharRotasSalvas());
