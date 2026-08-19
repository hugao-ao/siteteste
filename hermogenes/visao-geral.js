// visao-geral.js — Dashboard somente leitura: funil comercial, valores do ano,
// pendências que pedem ação e mapa geral de tudo.
import { sb, toast, esc, fmtMoeda, STATUS_VISITA } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const hojeStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_OBRA_COR = { a_iniciar: '#eab308', em_andamento: '#3b82f6', pausada: '#f97316', concluida: '#22c55e', entregue: '#a855f7' };

let visitas = [], propostas = [], obras = [], medicoes = [], pontosApoio = [];
let mapa = null;

async function carregarTudo() {
    const [v, p, o, m, pa] = await Promise.all([
        sb.from('hermo_visitas').select('id, endereco, latitude, longitude, status, data_visita'),
        sb.from('hermo_propostas').select('id, numero, ano, titulo, status, valor_total, created_at'),
        sb.from('hermo_obras').select('id, numero, ano, nome, status, prazo, valor_contratado, latitude, longitude, endereco'),
        sb.from('hermo_medicoes').select('id, obra_id, numero, status, valor_liquido, data_pagamento'),
        sb.from('hermo_pontos_apoio').select('*')
    ]);
    const erro = v.error || p.error || o.error || m.error || pa.error;
    if (erro) { toast('Erro ao carregar: ' + erro.message, true); return; }
    visitas = v.data || [];
    propostas = p.data || [];
    obras = o.data || [];
    medicoes = m.data || [];
    pontosApoio = pa.data || [];
    renderResumo();
    renderFunil();
    renderPendencias();
    renderMapa();
}

function renderResumo() {
    const ano = new Date().getFullYear();
    const contratadoAno = propostas.filter(p => p.status === 'contratada' && p.ano === ano)
        .reduce((t, p) => t + num(p.valor_total), 0);
    const emAndamento = obras.filter(o => o.status === 'em_andamento');
    const valorAndamento = emAndamento.reduce((t, o) => t + num(o.valor_contratado), 0);
    const aReceber = medicoes.filter(m => ['aprovada', 'faturada'].includes(m.status))
        .reduce((t, m) => t + num(m.valor_liquido), 0);
    const recebidoAno = medicoes.filter(m => m.status === 'paga' && (m.data_pagamento || '').startsWith(String(ano)))
        .reduce((t, m) => t + num(m.valor_liquido), 0);
    const esperando = propostas.filter(p => p.status === 'esperando_resposta')
        .reduce((t, p) => t + num(p.valor_total), 0);
    $('resumo').innerHTML = `
        <div class="stat s-concluida"><div class="num">${fmtMoeda(contratadoAno)}</div><div class="lbl">Contratado em ${ano}</div></div>
        <div class="stat s-marcada"><div class="num">${emAndamento.length} · ${fmtMoeda(valorAndamento)}</div><div class="lbl">Obras em andamento</div></div>
        <div class="stat s-pendente"><div class="num">${fmtMoeda(aReceber)}</div><div class="lbl">Medições a receber</div></div>
        <div class="stat s-pendencias"><div class="num">${fmtMoeda(esperando)}</div><div class="lbl">Propostas esperando resposta</div></div>
        <div class="stat"><div class="num">${fmtMoeda(recebidoAno)}</div><div class="lbl">Recebido em ${ano} (medições)</div></div>`;
}

function renderFunil() {
    const totalVisitas = visitas.length;
    const concluidas = visitas.filter(v => ['concluida', 'concluida_pendencias'].includes(v.status)).length;
    const totalProp = propostas.length;
    const valorProp = propostas.reduce((t, p) => t + num(p.valor_total), 0);
    const contratadas = propostas.filter(p => p.status === 'contratada');
    const valorContr = contratadas.reduce((t, p) => t + num(p.valor_total), 0);
    const taxa = (a, b) => b > 0 ? Math.round(a / b * 100) + '%' : '—';
    $('vg-funil').innerHTML = `
        <div class="vg-etapa" style="border-top-color:#3b82f6">
            <div class="num">${totalVisitas}</div><div class="lbl">Visitas</div>
            <span class="sub">${concluidas} concluídas</span>
        </div>
        <div class="vg-etapa" style="border-top-color:#eab308">
            <div class="num">${totalProp}</div><div class="lbl">Propostas</div>
            <span class="sub">${fmtMoeda(valorProp)}</span>
            <span class="taxa">▲ conversão visita→proposta: ${taxa(totalProp, concluidas || totalVisitas)}</span>
        </div>
        <div class="vg-etapa" style="border-top-color:#22c55e">
            <div class="num">${contratadas.length}</div><div class="lbl">Contratadas</div>
            <span class="sub">${fmtMoeda(valorContr)}</span>
            <span class="taxa">▲ conversão proposta→contrato: ${taxa(contratadas.length, totalProp)}</span>
        </div>
        <div class="vg-etapa" style="border-top-color:#a855f7">
            <div class="num">${obras.length}</div><div class="lbl">Obras</div>
            <span class="sub">${fmtMoeda(obras.reduce((t, o) => t + num(o.valor_contratado), 0))}</span>
        </div>`;
}

function renderPendencias() {
    const hj = hojeStr();
    const blocos = [];

    const conferir = propostas.filter(p => p.status === 'conferir');
    blocos.push({
        titulo: `📄 Propostas em Conferir (${conferir.length})`,
        itens: conferir.slice(0, 5).map(p => `${String(p.numero).padStart(4, '0')}/${p.ano} — ${p.titulo}`),
        link: 'propostas.html', vazio: 'nenhuma aguardando conferência'
    });
    const enviadas = medicoes.filter(m => m.status === 'enviada');
    blocos.push({
        titulo: `📐 Medições aguardando aprovação (${enviadas.length})`,
        itens: enviadas.slice(0, 5).map(m => {
            const o = obras.find(x => x.id === m.obra_id);
            return `MED-${m.numero} — ${o?.nome || 'obra'} (${fmtMoeda(m.valor_liquido)})`;
        }),
        link: 'medicoes-notas.html', vazio: 'nenhuma enviada pendente'
    });
    const estouradas = obras.filter(o => o.prazo && o.prazo < hj && !['concluida', 'entregue'].includes(o.status));
    blocos.push({
        titulo: `⏰ Obras com prazo estourado (${estouradas.length})`,
        itens: estouradas.slice(0, 5).map(o => `OB-${String(o.numero).padStart(4, '0')} — ${o.nome} (prazo ${o.prazo.split('-').reverse().join('/')})`),
        link: 'obras.html', vazio: 'nenhum prazo estourado'
    });
    const pendMarc = visitas.filter(v => v.status === 'pendente_marcacao');
    blocos.push({
        titulo: `📍 Visitas pendentes de marcação (${pendMarc.length})`,
        itens: pendMarc.slice(0, 5).map(v => v.endereco),
        link: 'visitas.html', vazio: 'nenhuma visita sem data'
    });

    $('vg-pend').innerHTML = blocos.map(b => `
        <div class="vg-pend-card ${b.itens.length === 0 ? 'vg-ok' : ''}">
            <h3>${b.titulo}</h3>
            <ul>${b.itens.length
                ? b.itens.map(i => `<li>• ${esc(i)}</li>`).join('')
                : `<li>✅ ${b.vazio}</li>`}</ul>
            <a href="${b.link}">abrir página ↗</a>
        </div>`).join('');
}

function renderMapa() {
    if (typeof L === 'undefined') return;
    mapa = L.map('hermo-mapa').setView([-8.0476, -34.877], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(mapa);
    const bounds = [];
    visitas.filter(v => v.latitude != null).forEach(v => {
        L.circleMarker([v.latitude, v.longitude], {
            radius: 7, color: '#0f172a', weight: 1.5,
            fillColor: STATUS_VISITA[v.status]?.cor || '#94a3b8', fillOpacity: .95
        }).addTo(mapa).bindTooltip(`${esc(v.endereco)} — ${STATUS_VISITA[v.status]?.label || v.status}`, { sticky: true });
        bounds.push([v.latitude, v.longitude]);
    });
    obras.filter(o => o.latitude != null).forEach(o => {
        L.marker([o.latitude, o.longitude], {
            icon: L.divIcon({ className: '', html: '<div style="font-size:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">🏗️</div>', iconSize: [20, 20] })
        }).addTo(mapa).bindTooltip(
            `OB-${String(o.numero).padStart(4, '0')} — ${esc(o.nome)}<br>` +
            `<span style="color:${STATUS_OBRA_COR[o.status] || '#94a3b8'}">●</span> ${o.status.replace('_', ' ')}`, { sticky: true });
        bounds.push([o.latitude, o.longitude]);
    });
    pontosApoio.filter(p => p.latitude != null).forEach(p => {
        L.marker([p.latitude, p.longitude], {
            icon: L.divIcon({ className: '', html: '<div style="font-size:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">📦</div>', iconSize: [20, 20] })
        }).addTo(mapa).bindTooltip(esc(p.nome), { sticky: true });
        bounds.push([p.latitude, p.longitude]);
    });
    $('mapa-legenda').innerHTML =
        Object.entries(STATUS_VISITA).map(([k, v]) =>
            `<span class="leg"><span class="dot" style="background:${v.cor}"></span>${v.label}</span>`).join('') +
        `<span class="leg">🏗️ obra</span><span class="leg">📦 apoio</span>`;
    if (bounds.length > 1) mapa.fitBounds(bounds, { padding: [40, 40] });
    else if (bounds.length === 1) mapa.setView(bounds[0], 14);
}

carregarTudo();
