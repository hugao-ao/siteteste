// servicos-timeline.js — Linha do tempo (Gantt) + mapa dos serviços das OBRAS.
// Arrastar barra/bordas reagenda o serviço pela MESMA RPC do card da obra
// (hermo_salvar_obra → recalcula cadeias, prazos, %, e valida datas reais);
// arrastar as faixas de alocação move a agenda do integrante em hermo_alocacoes
// (com bloqueio de conflito) — nada precisa ser refeito em outros cards.
import { sb, toast, esc, fmtMoeda } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const PXS = [4, 8, 14, 24, 40];   // pixels por dia (níveis de zoom)
// largura da coluna de rótulos — espelha o CSS (@media max-width:700px usa 130)
const rotuloW = () => window.matchMedia('(max-width: 700px)').matches ? 130 : 210;

let obras = [];
let ausencias = [];
let pxIdx = lerLS('hermo_tlx_px', 2);
let obraFiltro = '';
let mapa = null, marcadores = [];
let intervalo = null;             // {min, max, dias}

function lerLS(chave, padrao) {
    try { const v = JSON.parse(localStorage.getItem(chave)); return v == null ? padrao : v; }
    catch (e) { return padrao; }
}
function gravarLS(chave, v) { try { localStorage.setItem(chave, JSON.stringify(v)); } catch (e) {} }

const pxDia = () => PXS[Math.max(0, Math.min(PXS.length - 1, pxIdx))];
const hoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtData = iso => (iso || '').split('-').reverse().join('/');
const ddmm = iso => fmtData(iso).slice(0, 5);
function addDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function difDias(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
const fmtCodObra = o => `OB-${String(o.numero).padStart(4, '0')}/${o.ano}`;

// mesma régua de conflito do card da obra (dia 07-17, manhã 07-12, tarde 13-17)
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
    const [bi, bf] = minutosTurno(b.turno || 'dia', b.hora_inicio, b.hora_fim);
    return Math.max(ai, bi) < Math.min(af, bf);
}

// ============================================================
// CARREGAMENTO
// ============================================================
async function carregarDados() {
    const [o, au] = await Promise.all([
        sb.from('hermo_obras')
            .select(`id, numero, ano, nome, status, cliente_id, endereco, latitude, longitude,
                inicio_previsto, prazo, inicio_real, conclusao, observacoes,
                itens:hermo_obra_servicos(*, servico:hermo_servicos(codigo, descricao),
                    alocacoes:hermo_alocacoes(*, integrante:hermo_integrantes(id, nome, apelido), equipe:hermo_equipes(id, nome, cor))),
                dependencias:hermo_obra_dependencias(item_id, depende_de_id)`)
            .order('ano', { ascending: false }).order('numero', { ascending: false }),
        sb.from('hermo_ausencias').select('*')
    ]);
    if (o.error) { toast('Erro ao carregar a linha do tempo: ' + o.error.message, true); return false; }
    if (au.error) { toast('Aviso: ausências não carregadas (' + au.error.message + ') — conflitos podem passar.', true); }
    obras = (o.data || []).map(x => ({
        ...x,
        itens: (x.itens || []).sort((a, b) => a.ordem - b.ordem),
        dependencias: x.dependencias || []
    }));
    ausencias = au.data || [];
    return true;
}

function itensDatados(o) {
    return o.itens.filter(i => i.vigente !== false && i.inicio_previsto && i.fim_previsto);
}
function obrasVisiveis() {
    return obras.filter(o => itensDatados(o).length > 0 && (!obraFiltro || o.id === obraFiltro));
}

// ============================================================
// RENDER
// ============================================================
function calcularIntervalo() {
    let min = null, max = null;
    obrasVisiveis().forEach(o => itensDatados(o).forEach(i => {
        if (!min || i.inicio_previsto < min) min = i.inicio_previsto;
        if (!max || i.fim_previsto > max) max = i.fim_previsto;
        (i.alocacoes || []).forEach(a => {
            if (a.data_inicio < min) min = a.data_inicio;
            if (a.data_fim > max) max = a.data_fim;
        });
    }));
    if (!min) { intervalo = null; return; }
    const h = hoje();
    if (h < min) min = h;
    if (h > max) max = h;
    min = addDias(min, -3);
    max = addDias(max, 7);
    intervalo = { min, max, dias: difDias(min, max) + 1 };
}

const xDe = iso => difDias(intervalo.min, iso) * pxDia();

function render() {
    const grade = $('tlx-grade');
    popularFiltro();
    calcularIntervalo();
    if (!intervalo) {
        grade.innerHTML = '<div style="padding:16px;font-size:.8rem;color:var(--hermo-text-dim)">Nenhum serviço de obra com datas previstas ainda — programe o cronograma no card da obra (ou arraste aqui depois).</div>';
        atualizarMapa();
        return;
    }
    const px = pxDia();
    const W = intervalo.dias * px;
    const partes = [];

    // escala: meses + dias
    let m = intervalo.min.slice(0, 7);
    while (true) {
        const iniMes = m + '-01';
        const vis = iniMes < intervalo.min ? intervalo.min : iniMes;
        if (vis > intervalo.max) break;
        const [y, mm] = m.split('-').map(Number);
        const nome = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][mm - 1] + '/' + y;
        partes.push(`<div class="tlx-mes" style="left:${xDe(vis)}px">${nome}</div>`);
        m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
    }
    let dias = '';
    if (px >= 14) {
        for (let d = 0; d < intervalo.dias; d++) {
            const iso = addDias(intervalo.min, d);
            dias += `<div class="tlx-dia" style="left:${d * px}px;width:${px}px">${iso.slice(8, 10)}</div>`;
        }
    }
    const escala = `
        <div class="tlx-linha tlx-escala-topo">
            <div class="tlx-rotulo"></div>
            <div class="tlx-faixa" style="width:${W}px;min-height:32px">${partes.join('')}${dias}</div>
        </div>`;

    // fundo: fins de semana + hoje (uma camada por linha seria caro; camada única atrás)
    const rotW = rotuloW();
    let fundo = '';
    for (let d = 0; d < intervalo.dias; d++) {
        const iso = addDias(intervalo.min, d);
        const dow = new Date(iso + 'T00:00:00').getDay();
        if (dow === 0 || dow === 6) {
            fundo += `<div class="tlx-fundo-fds" style="left:${rotW + d * px}px;width:${px}px"></div>`;
        }
    }
    fundo += `<div class="tlx-hoje" style="left:${rotW + xDe(hoje())}px" title="hoje"></div>`;

    // linhas
    const linhas = [];
    obrasVisiveis().forEach(o => {
        linhas.push(`
        <div class="tlx-linha obra" data-obra-linha="${o.id}">
            <div class="tlx-rotulo"><b>🏗️ ${fmtCodObra(o)}</b> — ${esc(o.nome)}</div>
            <div class="tlx-faixa" style="width:${W}px;min-height:24px"></div>
        </div>`);
        itensDatados(o).forEach(i => {
            const alocs = (i.alocacoes || []);
            const altura = Math.max(30, 28 + alocs.length * 15);
            const temDeps = o.dependencias.some(d => d.item_id === i.id);
            const concluido = !!i.fim_real;
            const atrasado = !concluido && i.fim_previsto < hoje();
            const travas = [];
            if (concluido) travas.push('✓ concluído — travado');
            else {
                if (temDeps) travas.push('🔗 início definido pela cadeia (arraste só a borda final)');
                if (i.inicio_real) travas.push('📍 início real informado (arraste só a borda final)');
                if (i.prazo_dias) travas.push(`prazo de ${i.prazo_dias} dias ${i.prazo_tipo === 'uteis' ? 'úteis' : 'corridos'} — arrastar a borda final substitui o prazo`);
            }
            const barras = `
            <div class="tlx-bar ${concluido ? 'concluido' : ''} ${atrasado ? 'atrasado' : ''}"
                 style="left:${xDe(i.inicio_previsto)}px;width:${Math.max((difDias(i.inicio_previsto, i.fim_previsto) + 1) * px, 8)}px"
                 data-bar-obra="${o.id}" data-bar-item="${i.id}"
                 title="${esc(i.servico?.codigo || '')} ${esc(i.servico?.descricao || '')} · ${ddmm(i.inicio_previsto)}–${ddmm(i.fim_previsto)}${travas.length ? ' · ' + esc(travas.join(' · ')) : ''}">
                <span class="alca ini"></span>${concluido ? '✓ ' : ''}${temDeps ? '🔗 ' : ''}${esc(i.servico?.codigo || '')}<span class="alca fim"></span>
            </div>` +
            alocs.map((a, ai) => {
                const nome = a.integrante?.apelido || (a.integrante?.nome || '?').split(' ')[0];
                const turno = a.turno === 'horario' ? `${(a.hora_inicio || '').slice(0, 5)}-${(a.hora_fim || '').slice(0, 5)}` : { dia: 'dia inteiro', manha: 'manhã', tarde: 'tarde' }[a.turno];
                return `
                <div class="tlx-aloc" style="left:${xDe(a.data_inicio)}px;width:${Math.max((difDias(a.data_inicio, a.data_fim) + 1) * px, 8)}px;top:${27 + ai * 15}px;border-left-color:${a.equipe?.cor || 'var(--hermo-primary)'}"
                     data-aloc="${a.id}" data-aloc-obra="${o.id}" data-aloc-item="${i.id}"
                     title="👷 ${esc(a.integrante?.nome || '')}${a.equipe ? ' · equipe ' + esc(a.equipe.nome) : ''} · ${ddmm(a.data_inicio)}–${ddmm(a.data_fim)} · ${turno} — arraste para mover/redimensionar">
                    ${esc(nome)}
                </div>`;
            }).join('');
            linhas.push(`
            <div class="tlx-linha">
                <div class="tlx-rotulo" title="${esc(i.servico?.descricao || '')}${i.local_execucao ? ' · 📍 ' + esc(i.local_execucao) : ''}">
                    <b>${esc(i.servico?.codigo || '?')}</b> ${esc(i.servico?.descricao || '')}
                    <small>${fmtMoeda(i.total)}${i.local_execucao ? ' · ' + esc(i.local_execucao) : ''}</small>
                </div>
                <div class="tlx-faixa" style="width:${W}px;min-height:${altura}px">${barras}</div>
            </div>`);
        });
    });

    grade.innerHTML = fundo + escala + linhas.join('');
    ligarArrastos();
    atualizarMapa();
}

function popularFiltro() {
    const sel = $('tlx-obra');
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas as obras</option>';
    obras.filter(o => itensDatados(o).length > 0).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = `${fmtCodObra(o)} — ${o.nome}`;
        sel.appendChild(opt);
    });
    sel.value = obraFiltro && [...sel.options].some(x => x.value === obraFiltro) ? obraFiltro : (atual || '');
}

// ============================================================
// ARRASTAR (serviços e alocações)
// ============================================================
function mostrarTooltip(e, texto) {
    const t = $('tlx-tooltip');
    t.style.display = '';
    t.textContent = texto;
    t.style.left = Math.min(e.clientX + 14, window.innerWidth - 220) + 'px';
    t.style.top = (e.clientY + 16) + 'px';
}
function esconderTooltip() { $('tlx-tooltip').style.display = 'none'; }

function ligarArrastos() {
    $('tlx-grade').querySelectorAll('[data-bar-item]').forEach(bar => {
        bar.addEventListener('pointerdown', e => iniciarArrastoBarra(e, bar));
    });
    $('tlx-grade').querySelectorAll('[data-aloc]').forEach(el => {
        el.addEventListener('pointerdown', e => iniciarArrastoAloc(e, el));
    });
}

function zonaDoClique(el, e, soFim = false) {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    // início travado: metade direita já vale como borda final (barras estreitas)
    if (soFim && x >= r.width / 2) return 'fim';
    const z = Math.min(9, Math.max(4, r.width / 3)); // proporcional — barra estreita mantém as 3 zonas
    if (x <= z) return 'ini';
    if (x >= r.width - z) return 'fim';
    return 'meio';
}

function iniciarArrastoBarra(e, bar) {
    const obra = obras.find(o => o.id === bar.dataset.barObra);
    const item = obra?.itens.find(i => i.id === bar.dataset.barItem);
    if (!obra || !item) return;
    if (item.fim_real) { toast('Serviço concluído — as datas estão travadas.', true); return; }
    const iniTravado = obra.dependencias.some(d => d.item_id === item.id) || !!item.inicio_real;
    const zona = zonaDoClique(bar, e, iniTravado);
    if (iniTravado && zona !== 'fim') {
        toast(item.inicio_real
            ? '📍 O início vem do INÍCIO REAL informado — arraste só a borda final.'
            : '🔗 O início deste serviço é definido pela cadeia de dependências — arraste só a borda final (a duração).', true);
        return;
    }
    e.preventDefault();
    try { bar.setPointerCapture(e.pointerId); } catch (err) {}
    bar.classList.add('arrastando');
    const px = pxDia();
    const x0 = e.clientX;
    const left0 = parseFloat(bar.style.left);
    const w0 = parseFloat(bar.style.width);
    const durDias = Math.max(0, difDias(item.inicio_previsto, item.fim_previsto));
    let diasDelta = 0;
    const mover = ev => {
        diasDelta = Math.round((ev.clientX - x0) / px);
        if (zona === 'meio') bar.style.left = (left0 + diasDelta * px) + 'px';
        else if (zona === 'ini') {
            // clamp por DIAS reais (a largura em px tem piso e engana)
            diasDelta = Math.min(diasDelta, durDias);
            bar.style.left = (left0 + diasDelta * px) + 'px';
            bar.style.width = Math.max(w0 - diasDelta * px, px) + 'px';
        } else {
            diasDelta = Math.max(diasDelta, -durDias);
            bar.style.width = Math.max(w0 + diasDelta * px, px) + 'px';
        }
        const nIni = zona === 'fim' ? item.inicio_previsto : addDias(item.inicio_previsto, diasDelta);
        let nFim = zona === 'ini' ? item.fim_previsto : addDias(item.fim_previsto, diasDelta);
        if (nFim < nIni) nFim = nIni;
        mostrarTooltip(ev, `${ddmm(nIni)} → ${ddmm(nFim)}`);
    };
    const limpar = () => {
        bar.removeEventListener('pointermove', mover);
        bar.removeEventListener('pointerup', soltar);
        bar.removeEventListener('pointercancel', cancelar);
        bar.classList.remove('arrastando');
        esconderTooltip();
    };
    const cancelar = () => { limpar(); render(); }; // gesto abortado pelo sistema = descarta
    const soltar = async () => {
        limpar();
        if (!diasDelta) { render(); return; }
        let nIni = item.inicio_previsto, nFim = item.fim_previsto, limpaPrazo = false;
        if (zona === 'meio') { nIni = addDias(nIni, diasDelta); nFim = addDias(nFim, diasDelta); }
        else if (zona === 'ini') {
            nIni = addDias(nIni, Math.min(diasDelta, durDias));
            if (nIni > nFim) nIni = nFim;
        } else {
            nFim = addDias(nFim, diasDelta);
            if (nFim < nIni) nFim = nIni;
            if (item.prazo_dias) limpaPrazo = true; // borda final manual substitui o prazo
        }
        await salvarDatasServico(obra, item, nIni, nFim, limpaPrazo);
    };
    bar.addEventListener('pointermove', mover);
    bar.addEventListener('pointerup', soltar);
    bar.addEventListener('pointercancel', cancelar);
}

async function salvarDatasServico(obra, item, nIni, nFim, limpaPrazo) {
    if (nIni > nFim) nIni = nFim;
    // dados FRESCOS do banco (a página pode ficar aberta por horas — nunca
    // sobrescrever o que outra aba gravou) e payload com SÓ o item arrastado:
    // as chaves de execução real/qtd/prazo dos demais nem são enviadas
    const { data: o, error: eF } = await sb.from('hermo_obras')
        .select(`id, numero, ano, nome, status, cliente_id, endereco, latitude, longitude,
            inicio_previsto, prazo, inicio_real, conclusao, observacoes,
            itens:hermo_obra_servicos(id, vigente, fim_real, prazo_dias, prazo_tipo)`)
        .eq('id', obra.id).single();
    if (eF || !o) {
        toast('Não deu para reagendar (obra não recarregada): ' + (eF?.message || ''), true);
        render();
        return;
    }
    const alvo = (o.itens || []).find(i => i.id === item.id);
    if (!alvo || alvo.vigente === false) {
        toast('Este serviço mudou em outra aba (aditivo?) — recarregando a linha do tempo.', true);
        await carregarDados(); render();
        return;
    }
    if (alvo.fim_real) {
        toast('Este serviço foi CONCLUÍDO em outra aba — as datas ficaram travadas.', true);
        await carregarDados(); render();
        return;
    }
    const itemPayload = {
        id: item.id,
        inicio_previsto: nIni || null,
        fim_previsto: nFim || null
    };
    if (limpaPrazo) { itemPayload.prazo_dias = null; itemPayload.prazo_tipo = null; }
    const payload = {
        id: o.id, numero: o.numero, ano: o.ano, nome: o.nome,
        cliente_id: o.cliente_id || null, status: o.status,
        endereco: o.endereco || null, latitude: o.latitude, longitude: o.longitude,
        inicio_previsto: o.inicio_previsto || null, prazo: o.prazo || null,
        inicio_real: o.inicio_real || null, conclusao: o.conclusao || null,
        observacoes: o.observacoes || null,
        itens: [itemPayload]
    };
    const { error } = await sb.rpc('hermo_salvar_obra', { p: payload });
    if (error) {
        toast('Não deu para reagendar: ' + error.message, true);
        render();
        return;
    }
    await carregarDados();
    render();
    toast(`${item.servico?.codigo || 'Serviço'} reagendado — cronograma da obra recalculado${limpaPrazo ? ' (prazo em dias substituído pela data)' : ''}.`);
}

function iniciarArrastoAloc(e, el) {
    e.stopPropagation();
    const obra = obras.find(o => o.id === el.dataset.alocObra);
    const item = obra?.itens.find(i => i.id === el.dataset.alocItem);
    const aloc = item?.alocacoes.find(a => a.id === el.dataset.aloc);
    if (!aloc) return;
    const zona = zonaDoClique(el, e);
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.classList.add('arrastando');
    const px = pxDia();
    const x0 = e.clientX;
    const left0 = parseFloat(el.style.left);
    const w0 = parseFloat(el.style.width);
    const durDias = Math.max(0, difDias(aloc.data_inicio, aloc.data_fim));
    let diasDelta = 0;
    const mover = ev => {
        diasDelta = Math.round((ev.clientX - x0) / px);
        if (zona === 'meio') el.style.left = (left0 + diasDelta * px) + 'px';
        else if (zona === 'ini') {
            diasDelta = Math.min(diasDelta, durDias);
            el.style.left = (left0 + diasDelta * px) + 'px';
            el.style.width = Math.max(w0 - diasDelta * px, px) + 'px';
        } else {
            diasDelta = Math.max(diasDelta, -durDias);
            el.style.width = Math.max(w0 + diasDelta * px, px) + 'px';
        }
        const nIni = zona === 'fim' ? aloc.data_inicio : addDias(aloc.data_inicio, diasDelta);
        let nFim = zona === 'ini' ? aloc.data_fim : addDias(aloc.data_fim, diasDelta);
        if (nFim < nIni) nFim = nIni;
        mostrarTooltip(ev, `👷 ${ddmm(nIni)} → ${ddmm(nFim)}`);
    };
    const limpar = () => {
        el.removeEventListener('pointermove', mover);
        el.removeEventListener('pointerup', soltar);
        el.removeEventListener('pointercancel', cancelar);
        el.classList.remove('arrastando');
        esconderTooltip();
    };
    const cancelar = () => { limpar(); render(); };
    const soltar = async () => {
        limpar();
        if (!diasDelta) { render(); return; }
        let nIni = aloc.data_inicio, nFim = aloc.data_fim;
        if (zona === 'meio') { nIni = addDias(nIni, diasDelta); nFim = addDias(nFim, diasDelta); }
        else if (zona === 'ini') { nIni = addDias(nIni, Math.min(diasDelta, durDias)); if (nIni > nFim) nIni = nFim; }
        else { nFim = addDias(nFim, diasDelta); if (nFim < nIni) nFim = nIni; }
        await salvarAloc(obra, item, aloc, nIni, nFim);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', cancelar);
}

/** Conflitos do integrante na janela, consultados FRESCOS no banco (a página pode ficar aberta). */
async function conflitoFresco(aloc, nIni, nFim) {
    const nova = { data_inicio: nIni, data_fim: nFim, turno: aloc.turno, hora_inicio: aloc.hora_inicio, hora_fim: aloc.hora_fim };
    const [al, au] = await Promise.all([
        sb.from('hermo_alocacoes')
            .select('*, obra_servico:hermo_obra_servicos(servico:hermo_servicos(codigo), obra:hermo_obras(nome))')
            .eq('integrante_id', aloc.integrante_id)
            .lte('data_inicio', nFim).gte('data_fim', nIni),
        sb.from('hermo_ausencias').select('*')
            .eq('integrante_id', aloc.integrante_id)
            .lte('data_inicio', nFim).gte('data_fim', nIni)
    ]);
    if (al.error || au.error) return { erro: (al.error || au.error).message };
    const a = (al.data || []).find(x => x.id !== aloc.id && periodosConflitam(nova, x));
    if (a) {
        return { conflito: `já está em "${a.obra_servico?.obra?.nome || 'outra obra'}" (${a.obra_servico?.servico?.codigo || ''}) de ${ddmm(a.data_inicio)} a ${ddmm(a.data_fim)}` };
    }
    const x = (au.data || []).find(y => periodosConflitam(nova, y));
    if (x) return { conflito: `ausência (${x.tipo}) de ${ddmm(x.data_inicio)} a ${ddmm(x.data_fim)}` };
    return {};
}

async function salvarAloc(obra, item, aloc, nIni, nFim) {
    // BLOQUEIO de conflito com consulta fresca (mesma régua do card da obra)
    const pre = await conflitoFresco(aloc, nIni, nFim);
    if (pre.erro) { toast('Não deu para checar conflitos: ' + pre.erro, true); render(); return; }
    if (pre.conflito) {
        toast(`🚫 ${aloc.integrante?.nome || 'Integrante'}: ${pre.conflito} — alocação mantida como estava.`, true);
        render();
        return;
    }
    const antesIni = aloc.data_inicio, antesFim = aloc.data_fim;
    const { error } = await sb.from('hermo_alocacoes')
        .update({ data_inicio: nIni, data_fim: nFim }).eq('id', aloc.id);
    if (error) { toast('Erro ao mover alocação: ' + error.message, true); render(); return; }
    // corrida entre sessões: re-verifica após gravar; se um conflito surgiu agora
    // há pouco, desfaz o movimento (mesmo padrão do card da obra)
    const pos = await conflitoFresco(aloc, nIni, nFim);
    if (pos.conflito) {
        await sb.from('hermo_alocacoes')
            .update({ data_inicio: antesIni, data_fim: antesFim }).eq('id', aloc.id);
        toast(`🚫 Outra sessão criou um conflito agora há pouco (${pos.conflito}) — o movimento foi desfeito.`, true);
        await carregarDados(); render();
        return;
    }
    await carregarDados();
    render();
    toast(`👷 ${aloc.integrante?.apelido || aloc.integrante?.nome || 'Integrante'} agora em ${ddmm(nIni)}–${ddmm(nFim)} — agenda atualizada.`);
}

// ============================================================
// MAPA
// ============================================================
function atualizarMapa() {
    const div = $('tlx-mapa');
    // offsetParent null = algum ancestral oculto (corpo recolhido) — inicializar
    // o Leaflet num container 0x0 quebra o enquadramento
    if (div.style.display === 'none' || div.offsetParent === null) return;
    if (typeof L === 'undefined') return;
    if (!mapa) {
        mapa = L.map('tlx-mapa').setView([-8.0476, -34.877], 11);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 19
        }).addTo(mapa);
    }
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    const bounds = [];
    obrasVisiveis().filter(o => o.latitude != null && o.longitude != null).forEach(o => {
        const pendentes = itensDatados(o).filter(i => !i.fim_real)
            .sort((a, b) => a.inicio_previsto.localeCompare(b.inicio_previsto));
        const mk = L.circleMarker([o.latitude, o.longitude], {
            radius: 9, color: '#0f172a', weight: 2,
            fillColor: pendentes.length ? '#3b82f6' : '#22c55e', fillOpacity: 1
        }).addTo(mapa);
        mk.bindPopup(`<div style="font-size:.82rem;max-width:250px">
            <b>${fmtCodObra(o)} — ${esc(o.nome)}</b><br>
            ${pendentes.length === 0 ? 'Sem serviços pendentes.'
                : pendentes.slice(0, 3).map(i =>
                    `• ${esc(i.servico?.codigo || '')} ${esc(i.servico?.descricao || '').slice(0, 28)} — ${ddmm(i.inicio_previsto)}–${ddmm(i.fim_previsto)}`).join('<br>')}
            ${pendentes.length > 3 ? `<br>… +${pendentes.length - 3} serviço(s)` : ''}
            <br><a href="#" data-tlx-ir="${o.id}" style="color:#b45309">📜 ver na linha do tempo</a>
        </div>`);
        marcadores.push(mk);
        bounds.push([o.latitude, o.longitude]);
    });
    // reenquadra só quando o CONJUNTO de obras muda — pan/zoom do usuário é preservado
    const chave = bounds.map(b => b.join(',')).sort().join(';');
    if (chave !== atualizarMapa._chave) {
        atualizarMapa._chave = chave;
        if (bounds.length === 1) mapa.setView(bounds[0], 14);
        else if (bounds.length > 1) mapa.fitBounds(bounds, { padding: [30, 30] });
    }
    mapa.off('popupopen');
    mapa.on('popupopen', ev => {
        const link = ev.popup.getElement()?.querySelector('[data-tlx-ir]');
        if (link) link.addEventListener('click', e2 => {
            e2.preventDefault();
            const alvo = document.querySelector(`[data-obra-linha="${link.dataset.tlxIr}"]`);
            if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
    setTimeout(() => mapa.invalidateSize(), 120);
}

// ============================================================
// CONTROLES / BOOT
// ============================================================
function irParaHoje() {
    if (!intervalo) return;
    const wrap = $('tlx-wrap');
    wrap.scrollLeft = Math.max(0, xDe(hoje()) - wrap.clientWidth / 3);
}

$('tlx-zoom-mais').addEventListener('click', () => {
    if (pxIdx < PXS.length - 1) { pxIdx++; gravarLS('hermo_tlx_px', pxIdx); render(); }
});
$('tlx-zoom-menos').addEventListener('click', () => {
    if (pxIdx > 0) { pxIdx--; gravarLS('hermo_tlx_px', pxIdx); render(); }
});
$('tlx-hoje-btn').addEventListener('click', irParaHoje);
$('tlx-obra').addEventListener('change', () => { obraFiltro = $('tlx-obra').value; render(); });
$('tlx-mapa-toggle').addEventListener('click', () => {
    // com a linha do tempo recolhida, abre o corpo junto (mapa em container oculto tem tamanho 0)
    if ($('tlx-corpo').style.display === 'none') $('tlx-toggle').click();
    const div = $('tlx-mapa');
    const mostrar = div.style.display === 'none';
    div.style.display = mostrar ? '' : 'none';
    gravarLS('hermo_tlx_mapa', mostrar);
    if (mostrar) atualizarMapa();
});
$('tlx-toggle').addEventListener('click', () => {
    const corpo = $('tlx-corpo');
    const mostrar = corpo.style.display === 'none';
    corpo.style.display = mostrar ? '' : 'none';
    $('tlx-toggle').textContent = mostrar ? '—' : '⊞';
    gravarLS('hermo_tlx_oculto', !mostrar);
    if (mostrar) { render(); irParaHoje(); }
});

(async () => {
    if (lerLS('hermo_tlx_oculto', false)) {
        $('tlx-corpo').style.display = 'none';
        $('tlx-toggle').textContent = '⊞';
    }
    if (lerLS('hermo_tlx_mapa', false)) $('tlx-mapa').style.display = '';
    if (await carregarDados()) {
        if ($('tlx-corpo').style.display !== 'none') {
            render();
            irParaHoje();
        }
    }
})();
