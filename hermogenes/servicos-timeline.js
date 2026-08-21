// servicos-timeline.js — Linha do tempo (Gantt) + mapa dos serviços das OBRAS.
// Arrastar barra/bordas reagenda o serviço pela MESMA RPC do card da obra
// (hermo_salvar_obra → recalcula cadeias, prazos, %, e valida datas reais);
// arrastar as faixas de alocação move a agenda do integrante em hermo_alocacoes
// (com bloqueio de conflito) — nada precisa ser refeito em outros cards.
import { sb, toast, esc, fmtMoeda, ligarFecharPorBackdrop } from './hermo-common.js';

const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const PXS = [4, 8, 14, 24, 40];   // pixels por dia (níveis de zoom)
// largura da coluna de rótulos — espelha o CSS (@media max-width:700px usa 130)
const rotuloW = () => window.matchMedia('(max-width: 700px)').matches ? 130 : 210;

let obras = [];
let ausencias = [];
let integrantes = [];
let equipes = [];
let pxIdx = lerLS('hermo_tlx_px', 2);
let obraFiltro = '';
let mapa = null, marcadores = [];
let intervalo = null;             // {min, max, dias}
let reguaA = null;                // data da régua vermelha (padrão: hoje) — arrastável
let reguaB = null;                // data da 2ª régua (null = desligada)
let prodBusca = '';               // filtro da tabela do recorte
let prodOrdem = lerLS('hermo_tlx_prod_ord', { col: 'valor', dir: 'desc' });
let planTravaItem = new Map();    // obra_servico_id → planejamento que o trava
let planTravaAloc = new Map();    // alocacao_id → planejamento que a trava

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
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** dia da semana da data (vazio se não houver data) */
const diaSemana = iso => iso ? DOW[new Date(iso + 'T00:00:00').getDay()] : '';
/** "seg 17/08" — data curta com o dia da semana */
const ddmmSem = iso => iso ? `${diaSemana(iso)} ${ddmm(iso)}` : '';
/** "seg, 17/08/2026" — data completa com o dia da semana */
const dataSem = iso => iso ? `${diaSemana(iso)}, ${fmtData(iso)}` : '';
const fmtQtd = v => String(Math.round(num(v) * 100) / 100).replace('.', ',');
const fmtTurno = a => a.turno === 'horario'
    ? `${(a.hora_inicio || '').slice(0, 5)}–${(a.hora_fim || '').slice(0, 5)}`
    : ({ dia: 'dia inteiro', manha: 'manhã', tarde: 'tarde' }[a.turno || 'dia'] || a.turno);
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
    const [o, au, pl, ie] = await Promise.all([
        sb.from('hermo_obras')
            .select(`id, numero, ano, nome, status, cliente_id, endereco, latitude, longitude,
                inicio_previsto, prazo, inicio_real, conclusao, observacoes,
                itens:hermo_obra_servicos(*, servico:hermo_servicos(codigo, descricao),
                    alocacoes:hermo_alocacoes(*, integrante:hermo_integrantes(id, nome, apelido), equipe:hermo_equipes(id, nome, cor))),
                dependencias:hermo_obra_dependencias(item_id, depende_de_id)`)
            .order('ano', { ascending: false }).order('numero', { ascending: false }),
        sb.from('hermo_ausencias').select('*'),
        sb.from('hermo_planejamentos')
            .select('id, nome, periodo_de, periodo_ate, status, itens:hermo_planejamento_itens(obra_servico_id), alocacoes:hermo_planejamento_alocacoes(alocacao_id)')
            .in('status', ['confirmado', 'executado']),
        Promise.all([
            sb.from('hermo_integrantes').select('id, nome, apelido, ativo, funcao:hermo_funcoes(nome)').order('nome'),
            sb.from('hermo_equipes').select('id, nome, cor, membros:hermo_equipe_membros(integrante_id)').order('nome')
        ])
    ]);
    if (o.error) { toast('Erro ao carregar a linha do tempo: ' + o.error.message, true); return false; }
    if (au.error) { toast('Aviso: ausências não carregadas (' + au.error.message + ') — conflitos podem passar.', true); }
    obras = (o.data || []).map(x => ({
        ...x,
        itens: (x.itens || []).sort((a, b) => a.ordem - b.ordem),
        dependencias: x.dependencias || []
    }));
    ausencias = au.data || [];
    const [ri, re] = ie || [];
    if (ri?.error || re?.error) toast('Aviso: integrantes/equipes não carregados — a alocação pela tabela pode não funcionar.', true);
    integrantes = (ri?.data || []).filter(i => i.ativo !== false);
    equipes = (re?.data || []).map(q => ({ ...q, membroIds: (q.membros || []).map(m => m.integrante_id) }));
    // travas: o que já pertence a um planejamento confirmado não se mexe aqui
    planTravaItem = new Map();
    planTravaAloc = new Map();
    if (pl.error) toast('Aviso: planejamentos não carregados (' + pl.error.message + ') — as travas podem não aparecer.', true);
    (pl.data || []).forEach(p => {
        const info = { id: p.id, nome: p.nome || 'sem nome', de: p.periodo_de, ate: p.periodo_ate, status: p.status };
        (p.itens || []).forEach(x => planTravaItem.set(x.obra_servico_id, info));
        (p.alocacoes || []).forEach(x => { if (x.alocacao_id) planTravaAloc.set(x.alocacao_id, info); });
    });
    return true;
}

const rotuloTrava = t => `🔒 no planejamento "${t.nome}" (${ddmm(t.de)}–${ddmm(t.ate)})`;

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
    [reguaA, reguaB].forEach(d => {   // réguas sempre visíveis no intervalo
        if (!d) return;
        if (d < min) min = d;
        if (d > max) max = d;
    });
    min = addDias(min, -3);
    max = addDias(max, 7);
    intervalo = { min, max, dias: difDias(min, max) + 1 };
}

const xDe = iso => difDias(intervalo.min, iso) * pxDia();

/** Qual régua fecha o intervalo pela direita (desenhada no fim do seu dia).
 *  Empate no mesmo dia: A fecha, B abre — a faixa fica com 1 dia de largura. */
function reguaDireita(qual, a = reguaA, b = reguaB) {
    if (!b || !a) return false;
    return qual === 'A' ? a >= b : b > a;
}

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
    // faixa entre as réguas (quando a 2ª está ligada) + as duas réguas arrastáveis
    if (!reguaA) reguaA = hoje();
    if (reguaB) {
        const e = reguaA < reguaB ? reguaA : reguaB;
        const d = reguaA < reguaB ? reguaB : reguaA;
        fundo += `<div class="tlx-faixa-sel" style="left:${rotW + xDe(e)}px;width:${(difDias(e, d) + 1) * px}px"></div>`;
    }
    // o intervalo inclui os DOIS dias inteiros; por isso a régua da direita é
    // desenhada no FIM do seu dia — assim a faixa fica exatamente entre as linhas
    const rotA = reguaA === hoje() ? 'hoje' : fmtData(reguaA).slice(0, 5);
    fundo += `<div class="tlx-hoje" data-regua="A" data-rot="${rotA}" style="left:${rotW + xDe(reguaA) + (reguaDireita('A') ? px : 0)}px"
        title="Régua ${reguaA === hoje() ? '(hoje)' : fmtData(reguaA)} — arraste para medir; o botão Hoje devolve ao dia de hoje"></div>`;
    if (reguaB) {
        fundo += `<div class="tlx-hoje b" data-regua="B" data-rot="${fmtData(reguaB).slice(0, 5)}" style="left:${rotW + xDe(reguaB) + (reguaDireita('B') ? px : 0)}px"
            title="2ª régua (${fmtData(reguaB)}) — arraste para medir a produção no intervalo"></div>`;
    }

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
            const travaPlan = planTravaItem.get(i.id);
            const travas = [];
            if (travaPlan) travas.push(rotuloTrava(travaPlan));
            if (concluido) travas.push('✓ concluído — travado');
            else {
                if (temDeps) travas.push('🔗 início definido pela cadeia (arraste só a borda final)');
                if (i.inicio_real) travas.push('📍 início real informado (arraste só a borda final)');
                if (i.prazo_dias) travas.push(`prazo de ${i.prazo_dias} dias ${i.prazo_tipo === 'uteis' ? 'úteis' : 'corridos'} — arrastar a borda final substitui o prazo`);
            }
            const barras = `
            <div class="tlx-bar ${concluido ? 'concluido' : ''} ${atrasado ? 'atrasado' : ''} ${travaPlan ? 'planejado' : ''}"
                 style="left:${xDe(i.inicio_previsto)}px;width:${Math.max((difDias(i.inicio_previsto, i.fim_previsto) + 1) * px, 8)}px"
                 data-bar-obra="${o.id}" data-bar-item="${i.id}"
                 title="${esc(i.servico?.codigo || '')} ${esc(i.servico?.descricao || '')} · ${ddmm(i.inicio_previsto)}–${ddmm(i.fim_previsto)}${travas.length ? ' · ' + esc(travas.join(' · ')) : ''}">
                <span class="alca ini"></span>${travaPlan ? '🔒 ' : ''}${concluido ? '✓ ' : ''}${temDeps ? '🔗 ' : ''}${esc(i.servico?.codigo || '')}<span class="alca fim"></span>
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
    ligarArrastoReguas();
    renderProducao();
    atualizarMapa();
}

// ============================================================
// PRODUÇÃO ENTRE AS RÉGUAS (rateio proporcional aos dias)
// ============================================================
/**
 * Valor "produzido" no intervalo entre as réguas: para cada serviço com datas,
 * a fração = dias do serviço DENTRO do intervalo ÷ dias totais do serviço
 * (contagem inclusiva nas duas pontas), aplicada ao valor contratado do item.
 */
function producaoNoIntervalo(de, ate) {
    const linhas = [];
    let total = 0;
    obrasVisiveis().forEach(o => itensDatados(o).forEach(i => {
        const ini = i.inicio_previsto, fim = i.fim_previsto;
        if (fim < de || ini > ate) return;             // fora da janela
        const dTot = difDias(ini, fim) + 1;            // dias do serviço (inclusivo)
        const sIni = ini > de ? ini : de;
        const sFim = fim < ate ? fim : ate;
        const dDentro = difDias(sIni, sFim) + 1;       // dias dentro da janela
        const frac = dTot > 0 ? Math.min(1, dDentro / dTot) : 0;
        const valor = num(i.total) * frac;
        total += valor;
        // quem trabalha nesse serviço DENTRO da janela (integrante avulso ou via equipe)
        const equipe = (i.alocacoes || []).filter(a => a.data_inicio <= ate && a.data_fim >= de);
        linhas.push({
            itemId: i.id, obraId: o.id,
            obra: fmtCodObra(o), obraNome: o.nome,
            cod: i.servico?.codigo || '?',
            desc: i.servico?.descricao || '',
            ini, fim,
            periodo: `${ddmmSem(ini)} – ${ddmmSem(fim)}`,
            diasDentro: dDentro, diasTotais: dTot,
            dias: `${dDentro}/${dTot}`,
            perc: Math.round(frac * 1000) / 10,
            contratado: num(i.total),
            valor,
            qtdPrevista: Math.round(num(i.quantidade) * frac * 100) / 100,
            unidade: i.unidade || 'un',
            equipe,
            nomesEquipe: [...new Set(equipe.map(a => a.integrante?.apelido || a.integrante?.nome || '?'))],
            travadoPor: planTravaItem.get(i.id) || null
        });
    }));
    return { linhas, total };
}

/** Aplica busca e ordenação escolhidas pelo usuário na tabela do recorte. */
function linhasProducaoVisiveis(linhas) {
    const q = prodBusca.trim().toLowerCase();
    let lista = q ? linhas.filter(l =>
        `${l.cod} ${l.desc} ${l.obra} ${l.obraNome} ${l.nomesEquipe.join(' ')}`.toLowerCase().includes(q)) : [...linhas];
    const { col, dir } = prodOrdem;
    const chave = {
        codigo: l => l.cod.toLowerCase(),
        servico: l => l.desc.toLowerCase(),
        obra: l => `${l.obra} ${l.obraNome}`.toLowerCase(),
        periodo: l => l.ini,
        dias: l => l.diasDentro,
        perc: l => l.perc,
        contratado: l => l.contratado,
        valor: l => l.valor,
        equipe: l => l.nomesEquipe.length
    }[col] || (l => l.valor);
    lista.sort((a, b) => {
        const x = chave(a), y = chave(b);
        const c = typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : (x - y);
        return dir === 'asc' ? c : -c;
    });
    return lista;
}

function renderProducao() {
    const box = $('tlx-producao');
    if (!reguaB || !reguaA) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const de = reguaA < reguaB ? reguaA : reguaB;
    const ate = reguaA < reguaB ? reguaB : reguaA;
    const { linhas, total } = producaoNoIntervalo(de, ate);
    const lista = linhasProducaoVisiveis(linhas);
    const dias = difDias(de, ate) + 1;
    const semEquipe = linhas.filter(l => l.equipe.length === 0).length;
    const jaTravados = linhas.filter(l => l.travadoPor).length;
    const seta = c => prodOrdem.col === c ? (prodOrdem.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const th = (c, rot, extra = '') => `<th data-prod-ord="${c}" class="ord" ${extra}>${rot}${seta(c)}</th>`;
    box.style.display = '';
    box.innerHTML = `
    <div class="tlx-prod">
        <div class="tot">📏 Entre <b>${dataSem(de)}</b> e <b>${dataSem(ate)}</b> (${dias} dia${dias > 1 ? 's' : ''}):
            produção prevista de <b>${fmtMoeda(total)}</b>
            <span style="color:var(--hermo-text-dim);font-size:.74rem">· ${linhas.length} serviço(s) no intervalo${obraFiltro ? ' · obra filtrada' : ''}</span>
        </div>
        <div class="tlx-prod-barra">
            <input id="tlx-prod-busca" type="text" placeholder="Filtrar por serviço, obra ou integrante…" value="${esc(prodBusca)}" />
            <span style="font-size:.72rem;color:var(--hermo-text-dim)">${lista.length} de ${linhas.length}</span>
            <span style="flex:1"></span>
            ${semEquipe ? `<span class="tlx-chip-alerta" title="Serviços do recorte sem ninguém alocado no período">⚠ ${semEquipe} sem equipe</span>` : ''}
            ${jaTravados ? `<span class="tlx-chip-trava" title="Já fazem parte de um planejamento confirmado">🔒 ${jaTravados} em planejamento</span>` : ''}
            <button class="hermo-btn small primary" id="tlx-planejar" ${lista.length === 0 ? 'disabled' : ''}
                title="Planeja exatamente os serviços listados abaixo (o filtro vale)">📋 Planejar ${lista.length} serviço(s)</button>
        </div>
        ${lista.length === 0 ? '<div style="font-size:.76rem;color:var(--hermo-text-dim)">Nenhum serviço no intervalo com esse filtro.</div>' : `
        <div class="tlx-prod-wrap"><table>
            <tr>${th('codigo', 'Cód.')}${th('servico', 'Serviço')}${th('obra', 'Obra')}${th('periodo', 'Período')}${th('dias', 'Dias no intervalo')}${th('perc', '%')}${th('equipe', 'Equipe no período')}${th('contratado', 'Contratado')}${th('valor', 'No intervalo')}</tr>
            ${lista.map((l, idx) => `<tr>
                <td><b>${esc(l.cod)}</b>${l.travadoPor ? ' <span title="Em planejamento confirmado">🔒</span>' : ''}</td>
                <td>${esc(l.desc)}</td>
                <td><b>${esc(l.obra)}</b><br><small style="color:var(--hermo-text-dim)">${esc(l.obraNome)}</small></td>
                <td style="white-space:nowrap">${esc(l.periodo)}</td><td>${l.dias}</td><td>${fmtQtd(l.perc)}%</td>
                <td>
                    ${l.equipe.length
                        ? `<small>${esc(l.nomesEquipe.slice(0, 3).join(', '))}${l.nomesEquipe.length > 3 ? ` +${l.nomesEquipe.length - 3}` : ''}</small>`
                        : '<span class="tlx-sem-equipe">⚠ ninguém alocado</span>'}
                    ${l.travadoPor ? '' : `<button class="hermo-btn small ghost tlx-btn-alocar" data-alocar-linha="${idx}" title="Alocar integrantes ou equipe neste serviço, dentro do período">👷 ${l.equipe.length ? '+' : 'Alocar'}</button>`}
                </td>
                <td>${fmtMoeda(l.contratado)}</td><td><b>${fmtMoeda(l.valor)}</b></td>
            </tr>`).join('')}
        </table></div>`}
        <div style="font-size:.7rem;color:var(--hermo-text-dim)">
            Rateio proporcional aos dias de execução previstos (valor contratado do serviço × dias dentro do intervalo ÷ dias totais).
            Clique nos títulos das colunas para ordenar.
        </div>
    </div>`;

    const inp = $('tlx-prod-busca');
    inp.addEventListener('input', e => {
        prodBusca = e.target.value;
        clearTimeout(renderProducao._t);
        renderProducao._t = setTimeout(() => {
            renderProducao();
            const novo = $('tlx-prod-busca');
            if (novo) { novo.focus(); novo.setSelectionRange(novo.value.length, novo.value.length); }
        }, 200);
    });
    box.querySelectorAll('[data-prod-ord]').forEach(t => t.addEventListener('click', () => {
        const c = t.dataset.prodOrd;
        if (prodOrdem.col === c) prodOrdem.dir = prodOrdem.dir === 'asc' ? 'desc' : 'asc';
        else prodOrdem = { col: c, dir: ['codigo', 'servico', 'obra', 'periodo'].includes(c) ? 'asc' : 'desc' };
        gravarLS('hermo_tlx_prod_ord', prodOrdem);
        renderProducao();
    }));
    // planeja o que está NA TELA (respeitando o filtro) — o rótulo diz quantos
    $('tlx-planejar')?.addEventListener('click', () => abrirPlanejamento(de, ate, lista));
    box.querySelectorAll('[data-alocar-linha]').forEach(b => b.addEventListener('click',
        () => abrirAlocacaoRecorte(lista[parseInt(b.dataset.alocarLinha)], de, ate)));
}

// ============================================================
// ALOCAR PELA TABELA DO RECORTE (ta-)
// ============================================================
let taAlvo = null;              // { linha, de, ate }
let taMarcados = new Set();

function abrirAlocacaoRecorte(linha, de, ate) {
    if (!linha) return;
    if (linha.travadoPor) {
        toast(`Serviço ${rotuloTrava(linha.travadoPor)} — reabra o planejamento para mudar a equipe.`, true);
        return;
    }
    if (!integrantes.length) { toast('Nenhum integrante ativo cadastrado.', true); return; }
    taAlvo = { linha, de, ate };
    taMarcados = new Set();
    $('ta-titulo').textContent = `Alocar — ${linha.cod} ${linha.desc}`;
    $('ta-contexto').innerHTML =
        `${esc(linha.obra)} — ${esc(linha.obraNome)} · serviço previsto ${esc(linha.periodo)}` +
        (linha.equipe.length ? `<br>👷 já no período: ${esc(linha.nomesEquipe.join(', '))}` : '');
    // sugestão: interseção do serviço com o recorte (o que está na tela)
    const ini = linha.ini > de ? linha.ini : de;
    const fim = linha.fim < ate ? linha.fim : ate;
    $('ta-de').value = ini;
    $('ta-ate').value = fim;
    $('ta-turno').value = 'dia';
    $('ta-horas').style.display = 'none';
    $('ta-conflitos').style.display = 'none';
    const selEq = $('ta-equipe');
    selEq.innerHTML = '<option value="">— escolher individualmente —</option>';
    equipes.forEach(q => {
        const o = document.createElement('option');
        o.value = q.id;
        o.textContent = `${q.nome} (${q.membroIds.length} membros)`;
        selEq.appendChild(o);
    });
    renderTaIntegrantes();
    $('ta-overlay').classList.add('aberto');
}

function renderTaIntegrantes() {
    $('ta-integrantes').innerHTML = integrantes.map(i => `
        <label class="lc-item">
            <input type="checkbox" data-ta="${i.id}" ${taMarcados.has(i.id) ? 'checked' : ''} />
            <div class="txt"><b>${esc(i.nome)}</b>${i.apelido ? ' (' + esc(i.apelido) + ')' : ''}
                <small>${esc(i.funcao?.nome || 'sem função')}</small>
            </div>
        </label>`).join('');
    $('ta-integrantes').querySelectorAll('[data-ta]').forEach(c => c.addEventListener('change', e => {
        if (e.target.checked) taMarcados.add(e.target.dataset.ta);
        else taMarcados.delete(e.target.dataset.ta);
    }));
}

async function confirmarAlocacaoRecorte() {
    if (!taAlvo) return;
    const ids = [...taMarcados];
    if (!ids.length) { toast('Marque ao menos um integrante (ou escolha uma equipe).', true); return; }
    const ini = $('ta-de').value, fim = $('ta-ate').value;
    if (!ini || !fim) { toast('Informe o período da alocação.', true); return; }
    if (fim < ini) { toast('A data final não pode ser antes da inicial.', true); return; }
    const turno = $('ta-turno').value;
    const hi = $('ta-hora-ini').value || null, hf = $('ta-hora-fim').value || null;
    if (turno === 'horario' && (!hi || !hf || hf <= hi)) { toast('Informe um horário válido (início < fim).', true); return; }

    const btn = $('ta-confirmar');
    btn.disabled = true;
    try {
        // conflito por integrante, com consulta fresca (mesma régua do resto do app)
        const conflitos = [];
        for (const id of ids) {
            const res = await conflitosFrescos(
                { id: null, integrante_id: id, turno, hora_inicio: hi, hora_fim: hf }, ini, fim);
            if (res.erro) { toast('Não deu para checar conflitos: ' + res.erro, true); return; }
            res.conflitos.forEach(c => {
                const nome = integrantes.find(x => x.id === id)?.nome || 'Integrante';
                conflitos.push(`• ${nome}: ${c.descr}`);
            });
        }
        if (conflitos.length) {
            const box = $('ta-conflitos');
            box.style.display = '';
            box.textContent = '🚫 Conflito de agenda — ajuste o período, o turno ou as pessoas:\n' + conflitos.join('\n');
            return;
        }
        const eq = equipes.find(q => q.id === $('ta-equipe').value);
        const linhas = ids.map(id => ({
            obra_servico_id: taAlvo.linha.itemId,
            integrante_id: id,
            equipe_id: (eq && eq.membroIds.includes(id)) ? eq.id : null,   // etiqueta só para membro real
            data_inicio: ini, data_fim: fim, turno,
            hora_inicio: turno === 'horario' ? hi : null,
            hora_fim: turno === 'horario' ? hf : null
        }));
        const { error } = await sb.from('hermo_alocacoes').insert(linhas);
        if (error) throw error;
        $('ta-overlay').classList.remove('aberto');
        taAlvo = null;
        await carregarDados();
        render();
        toast(`👷 ${ids.length} alocação(ões) criada(s) em ${ddmmSem(ini)} – ${ddmmSem(fim)} — sem conflitos.`);
    } catch (e) {
        toast('Erro ao alocar: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// CRIAR PLANEJAMENTO A PARTIR DO RECORTE
// ============================================================
let planDraft = null;   // { de, ate, linhas }

function abrirPlanejamento(de, ate, linhas) {
    const livres = linhas.filter(l => !l.travadoPor);
    if (!livres.length) {
        toast('Todos os serviços deste recorte já pertencem a um planejamento confirmado.', true);
        return;
    }
    planDraft = { de, ate, linhas: livres };
    $('plc-periodo').textContent = `${fmtData(de)} a ${fmtData(ate)} (${difDias(de, ate) + 1} dias)`;
    $('plc-nome').value = `Semana ${ddmm(de)}–${ddmm(ate)}`;
    const bloqueados = linhas.length - livres.length;
    $('plc-aviso').innerHTML = bloqueados
        ? `<span class="tlx-chip-trava">🔒 ${bloqueados} serviço(s) do recorte já estão em outro planejamento e ficaram de fora.</span>` : '';
    $('plc-itens').innerHTML = livres.map((l, i) => `
        <div class="plc-item ${l.equipe.length ? '' : 'sem'}">
            <div class="txt">
                <b>${esc(l.cod)}</b> ${esc(l.desc)}
                <small>${esc(l.obra)} · ${l.periodo} · ${l.diasDentro}/${l.diasTotais} dia(s) no período · previsto ${fmtMoeda(l.valor)}</small>
                <small>${l.equipe.length
                    ? '👷 ' + esc(l.nomesEquipe.join(', '))
                    : '<span class="tlx-sem-equipe">⚠ ninguém alocado no período — escolha o que fazer</span>'}</small>
            </div>
            ${l.equipe.length ? '<span class="plc-ok">com equipe</span>' : `
            <select data-plc-sit="${i}">
                <option value="">— escolha —</option>
                <option value="sem_avanco">Sem avanço no período</option>
                <option value="adiado">Adiado para depois</option>
            </select>`}
        </div>`).join('');
    $('plc-overlay').classList.add('aberto');
}

async function confirmarPlanejamento() {
    if (!planDraft) return;
    const { de, ate, linhas } = planDraft;
    const itens = [];
    for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i];
        let situacao = 'com_equipe';
        if (!l.equipe.length) {
            situacao = document.querySelector(`[data-plc-sit="${i}"]`)?.value || '';
            if (!situacao) {
                toast(`Diga o que acontece com ${l.cod} — sem ninguém alocado, marque "sem avanço" ou "adiado".`, true);
                return;
            }
        }
        itens.push({
            obra_servico_id: l.itemId,
            inicio_previsto: l.ini, fim_previsto: l.fim,
            dias_no_intervalo: l.diasDentro, dias_totais: l.diasTotais,
            valor_previsto: situacao === 'com_equipe' ? l.valor : 0,
            qtd_prevista: situacao === 'com_equipe' ? String(l.qtdPrevista) : null,
            situacao,
            motivo: situacao === 'com_equipe' ? null : 'sem alocação no período'
        });
    }
    const btn = $('plc-confirmar');
    btn.disabled = true;
    try {
        const { data: pid, error } = await sb.rpc('hermo_criar_planejamento', {
            p: {
                nome: $('plc-nome').value.trim() || null,
                periodo_de: de, periodo_ate: ate,
                observacoes: $('plc-obs').value.trim() || null,
                itens
            }
        });
        if (error) throw error;
        $('plc-overlay').classList.remove('aberto');
        planDraft = null;
        await carregarDados();
        render();
        const comEquipe = itens.filter(x => x.situacao === 'com_equipe').length;
        toast(`📋 Planejamento criado com ${itens.length} serviço(s) (${comEquipe} com equipe) — o período ficou travado na linha do tempo. Veja na aba Planejamentos.`);
        window.dispatchEvent(new CustomEvent('plan-criado', { detail: { id: pid } }));
    } catch (e) {
        toast('Erro ao criar o planejamento: ' + e.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ---------- arrastar as réguas ----------
function ligarArrastoReguas() {
    $('tlx-grade').querySelectorAll('[data-regua]').forEach(el => {
        el.addEventListener('pointerdown', e => {
            e.preventDefault();
            e.stopPropagation();
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
            const qual = el.dataset.regua;
            const px = pxDia();
            const x0 = e.clientX;
            const base = qual === 'A' ? reguaA : reguaB;
            const outra = qual === 'A' ? reguaB : reguaA;
            const rotW = rotuloW();
            const faixa = $('tlx-grade').querySelector('.tlx-faixa-sel');
            let nova = base;
            const mover = ev => {
                const d = Math.round((ev.clientX - x0) / px);
                nova = addDias(base, d);
                if (nova < intervalo.min) nova = intervalo.min;
                if (nova > intervalo.max) nova = intervalo.max;
                // a régua que fecha o intervalo fica no FIM do seu dia (a faixa
                // cobre os dois dias inteiros) — recalculado a cada passo porque
                // a régua pode ultrapassar a outra durante o arrasto
                const a = qual === 'A' ? nova : outra;
                const b = qual === 'A' ? outra : nova;
                el.style.left = (rotW + xDe(nova) + (reguaDireita(qual, a, b) ? px : 0)) + 'px';
                el.dataset.rot = fmtData(nova).slice(0, 5);
                if (faixa && outra) {
                    const ini = nova < outra ? nova : outra;
                    const fim = nova < outra ? outra : nova;
                    faixa.style.left = (rotW + xDe(ini)) + 'px';
                    faixa.style.width = ((difDias(ini, fim) + 1) * px) + 'px';
                }
                mostrarTooltip(ev, `📏 ${fmtData(nova)}`);
            };
            const limpar = () => {
                el.removeEventListener('pointermove', mover);
                el.removeEventListener('pointerup', soltar);
                el.removeEventListener('pointercancel', limpar);
                esconderTooltip();
            };
            const soltar = () => {
                limpar();
                if (qual === 'A') reguaA = nova; else reguaB = nova;
                gravarLS('hermo_tlx_reguas', { a: reguaA, b: reguaB });
                render();
            };
            el.addEventListener('pointermove', mover);
            el.addEventListener('pointerup', soltar);
            el.addEventListener('pointercancel', limpar);
        });
    });
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
    const trava = planTravaItem.get(item.id);
    if (trava) {
        toast(`Este serviço está ${rotuloTrava(trava)} — reabra o planejamento para reprogramá-lo.`, true);
        return;
    }
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
        if (zona === 'meio') {
            // mover o serviço leva as ALOCAÇÕES junto — checando se alguém ficaria
            // em dois lugares (avulso ou via equipe) e oferecendo resolução
            await moverServicoComAlocacoes(obra, item, nIni, nFim, diasDelta);
        } else {
            const snap = {
                obraId: obra.id, itemId: item.id,
                inicio: item.inicio_previsto, fim: item.fim_previsto,
                prazo_dias: item.prazo_dias ?? null, prazo_tipo: item.prazo_tipo ?? null
            };
            const ok = await salvarDatasServico(obra, item, nIni, nFim, limpaPrazo);
            if (ok) {
                registrarUndo(`mudar ${zona === 'ini' ? 'o início' : 'o fim'} de ${item.servico?.codigo || 'serviço'}`,
                    { servico: snap });
                await carregarDados();
                render();
                toast(`${item.servico?.codigo || 'Serviço'} reagendado — cronograma da obra recalculado${limpaPrazo ? ' (prazo em dias substituído pela data)' : ''}. Ctrl+Z desfaz.`);
            }
        }
    };
    bar.addEventListener('pointermove', mover);
    bar.addEventListener('pointerup', soltar);
    bar.addEventListener('pointercancel', cancelar);
}

/** Re-consulta os "outros" por id e mantém só os que AINDA conflitam com a janela
 *  do par (o painel pode ficar aberto — a outra sessão pode ter movido/removido). */
async function outrosAindaConflitantes(pares) {
    const ids = [...new Set(pares.map(p => p.id))];
    if (!ids.length) return { manter: [], pulados: 0 };
    const { data, error } = await sb.from('hermo_alocacoes').select('*').in('id', ids);
    if (error) return { erro: error.message };
    const manter = new Set();
    let pulados = 0;
    pares.forEach(p => {
        const row = (data || []).find(x => x.id === p.id);
        if (row && periodosConflitam(p.ref, row)) manter.add(p.id);
        else pulados++; // sumiu ou moveu para janela sem conflito — não remover à toa
    });
    return { manter: [...manter], pulados };
}

/** Move o serviço E suas alocações (dados FRESCOS); conflitos abrem o painel de resolução. */
async function moverServicoComAlocacoes(obra, item, nIni, nFim, delta) {
    // alocações FRESCAS do serviço — o snapshot da página pode estar velho e o
    // deslocamento absoluto sobrescreveria movimentos feitos em outra aba
    const { data: alocs, error: eA } = await sb.from('hermo_alocacoes')
        .select('*, integrante:hermo_integrantes(id, nome, apelido)')
        .eq('obra_servico_id', item.id);
    if (eA) { toast('Não deu para carregar as alocações do serviço: ' + eA.message, true); render(); return; }
    const conflitos = [];
    for (const a of (alocs || [])) {
        const aIni = addDias(a.data_inicio, delta), aFim = addDias(a.data_fim, delta);
        const res = await conflitosFrescos(a, aIni, aFim, item.id);
        if (res.erro) { toast('Não deu para checar conflitos: ' + res.erro, true); render(); return; }
        res.conflitos.forEach(o => conflitos.push({
            aloc: a, nIni: aIni, nFim: aFim, outro: o,
            obraArrastada: `${fmtCodObra(obra)} — ${obra.nome}`
        }));
    }
    const rotulo = `${item.servico?.codigo || ''} — ${item.servico?.descricao || ''}`.trim();
    if (conflitos.length) {
        abrirResolucaoConflitos(rotulo, conflitos, async (cs, escolhas) => {
            // "tirar do arrastado" tem prioridade: remove a alocação e TODOS os conflitos
            // dela somem — os 'outro' das demais linhas dessa mesma alocação são ignorados
            // (senão o outro serviço perderia gente sem necessidade)
            const removerDeste = new Set(cs.filter((c, i) => escolhas[i] === 'deste').map(c => c.aloc.id));
            const paresOutros = cs
                .filter((c, i) => escolhas[i] === 'outro' && !removerDeste.has(c.aloc.id) && c.outro.tipo === 'aloc')
                .map(c => ({ id: c.outro.row.id, ref: { data_inicio: c.nIni, data_fim: c.nFim, turno: c.aloc.turno, hora_inicio: c.aloc.hora_inicio, hora_fim: c.aloc.hora_fim } }));
            const rev = await outrosAindaConflitantes(paresOutros);
            if (rev.erro) { toast('Não deu para revalidar os conflitos: ' + rev.erro, true); render(); return; }
            if (rev.pulados) toast(`${rev.pulados} alocação(ões) do outro lado já não conflita(m) mais — mantida(s).`);
            await aplicarMovimentoServico(obra, item, nIni, nFim, delta, alocs || [], new Set(rev.manter), removerDeste);
        });
        return;
    }
    await aplicarMovimentoServico(obra, item, nIni, nFim, delta, alocs || [], new Set(), new Set());
}

async function aplicarMovimentoServico(obra, item, nIni, nFim, delta, alocsFrescas, removerOutros, removerDeste) {
    // snapshot para o Ctrl+Z (estado ANTES de qualquer gravação)
    const snapServico = {
        obraId: obra.id, itemId: item.id,
        inicio: item.inicio_previsto, fim: item.fim_previsto,
        prazo_dias: item.prazo_dias ?? null, prazo_tipo: item.prazo_tipo ?? null
    };
    const remover = [...new Set([...removerOutros, ...removerDeste])];
    // snapshot das que serão APAGADAS — se a leitura falhar, não apaga (sem snapshot
    // não há como desfazer, e o Ctrl+Z não pode mentir que devolveu)
    const snapRem = await linhasDeAlocacoes(remover);
    if (snapRem.erro) {
        toast('Não deu para preparar o desfazer das remoções (' + snapRem.erro + ') — nada foi alterado. Tente de novo.', true);
        render();
        return;
    }
    const snapAlocs = alocsFrescas
        .filter(a => !removerDeste.has(a.id) && !removerOutros.has(a.id))
        .map(limparAloc);
    // 1) datas do serviço pela RPC (regras/cadeia validam; se falhar, nada mais acontece)
    const ok = await salvarDatasServico(obra, item, nIni, nFim, false);
    if (!ok) return;
    registrarUndo(`mover ${item.servico?.codigo || 'serviço'}${snapAlocs.length ? ' e suas alocações' : ''}`,
        { servico: snapServico, alocs: [...snapAlocs, ...snapRem.rows] });
    // 2) remoções escolhidas no painel — se falhar, ABORTA antes do deslocamento
    //    (deslocar por cima das conflitantes criaria exatamente o double-booking)
    if (remover.length) {
        const { error } = await sb.from('hermo_alocacoes').delete().in('id', remover);
        if (error) {
            toast('As remoções da resolução falharam (' + error.message + ') — o serviço foi movido, mas as alocações ficaram onde estavam. Ajuste-as pela linha do tempo.', true);
            await carregarDados(); render();
            return;
        }
    }
    // 3) alocações restantes acompanham o deslocamento (datas FRESCAS + delta)
    let movidas = 0, falhas = 0;
    for (const a of alocsFrescas) {
        if (removerDeste.has(a.id) || removerOutros.has(a.id)) continue;
        const { error } = await sb.from('hermo_alocacoes')
            .update({ data_inicio: addDias(a.data_inicio, delta), data_fim: addDias(a.data_fim, delta) })
            .eq('id', a.id);
        if (error) { falhas++; toast(`Aviso: a alocação de ${a.integrante?.nome || '?'} não acompanhou: ` + error.message, true); }
        else movidas++;
    }
    await carregarDados();
    render();
    toast(`${item.servico?.codigo || 'Serviço'} movido${movidas ? ` com ${movidas} alocação(ões) junto` : ''}${remover.length ? ` · ${remover.length} removida(s) na resolução` : ''}${falhas ? ` · ⚠ ${falhas} não acompanhou(aram) — arraste manualmente` : ''} — cronograma recalculado.`);
}

// ============================================================
// DESFAZER (Ctrl+Z) — um passo, cobrindo o último arrasto inteiro
// ============================================================
// undoUltimo = { descricao, servico, alocs } — `alocs` são LINHAS COMPLETAS no
// estado anterior (upsert devolve tanto as movidas quanto as removidas).
let undoUltimo = null;
let undoRodando = false;

const CAMPOS_ALOC = ['id', 'obra_servico_id', 'integrante_id', 'equipe_id',
    'data_inicio', 'data_fim', 'turno', 'hora_inicio', 'hora_fim'];
const limparAloc = r => Object.fromEntries(CAMPOS_ALOC.map(k => [k, r[k] ?? null]));

function registrarUndo(descricao, { servico = null, alocs = [] } = {}) {
    undoUltimo = { descricao, servico, alocs };
    atualizarBotaoUndo();
}
function limparUndo() { undoUltimo = null; atualizarBotaoUndo(); }
function atualizarBotaoUndo() {
    const b = $('tlx-undo');
    if (!b) return;
    b.style.display = undoUltimo ? '' : 'none';
    if (undoUltimo) b.title = `Desfazer: ${undoUltimo.descricao} (Ctrl+Z)`;
}

/** Linhas completas de alocações por id. Retorna { rows } ou { erro } — nunca
 *  confunde "falha de leitura" com "não existe" (o chamador apaga em seguida). */
async function linhasDeAlocacoes(ids) {
    if (!ids.length) return { rows: [] };
    const { data, error } = await sb.from('hermo_alocacoes').select('*').in('id', ids);
    if (error) return { erro: error.message };
    return { rows: (data || []).map(limparAloc) };
}

async function desfazerUltimo() {
    if (undoRodando) return;
    if (!undoUltimo) { toast('Não há arrasto recente para desfazer.'); return; }
    if ($('tlxc-overlay')?.classList.contains('aberto')) return; // resolução aberta: nada gravado ainda
    const u = undoUltimo;
    undoRodando = true;
    const btn = $('tlx-undo');
    if (btn) btn.disabled = true;
    let concluido = false;
    try {
        const problemas = [], avisos = [];
        // 1) o serviço ainda aceita voltar? (mesmas guardas do arrasto normal —
        //    concluído ou substituído por aditivo em outra aba trava as datas)
        let obraFresca = null;
        if (u.servico) {
            const { data: o, error: eF } = await sb.from('hermo_obras')
                .select(`id, numero, ano, nome, status, cliente_id, endereco, latitude, longitude,
                    inicio_previsto, prazo, inicio_real, conclusao, observacoes,
                    itens:hermo_obra_servicos(id, vigente, fim_real)`)
                .eq('id', u.servico.obraId).single();
            if (eF || !o) {
                toast('Não deu para desfazer agora (obra não recarregada): ' + (eF?.message || '') + ' — tente de novo.', true);
                return;
            }
            const alvo = (o.itens || []).find(i => i.id === u.servico.itemId);
            if (!alvo || alvo.vigente === false) {
                toast('Não dá para desfazer: este serviço mudou em outra aba (aditivo?). O arrasto continua valendo.', true);
                limparUndo(); concluido = true;
                await carregarDados(); render();
                return;
            }
            if (alvo.fim_real) {
                toast('Não dá para desfazer: este serviço foi CONCLUÍDO em outra aba — as datas ficaram travadas.', true);
                limparUndo(); concluido = true;
                await carregarDados(); render();
                return;
            }
            obraFresca = o;
        }
        // 2) alocações: só volta o que NÃO recria choque de agenda criado nesse meio-tempo
        const idsLote = new Set(u.alocs.map(a => a.id));
        const paraGravar = [];
        for (const a of u.alocs) {
            const res = await conflitosFrescos(a, a.data_inicio, a.data_fim);
            if (res.erro) { problemas.push('conflitos não checados (' + res.erro + ')'); continue; }
            const reais = (res.conflitos || []).filter(c => !(c.tipo === 'aloc' && idsLote.has(c.row.id)));
            if (reais.length) {
                avisos.push(`a alocação de ${a.integrante_id ? 'um integrante' : '?'} não voltou: ${reais[0].descr}`);
                continue;
            }
            paraGravar.push(a);
        }
        if (paraGravar.length) {
            const { error } = await sb.from('hermo_alocacoes').upsert(paraGravar);
            if (error) problemas.push('alocações não voltaram (' + error.message + ')');
        }
        // 3) datas (e prazo) do serviço pela mesma RPC do card da obra
        if (obraFresca) {
            const s = u.servico, o = obraFresca;
            const { error } = await sb.rpc('hermo_salvar_obra', {
                p: {
                    id: o.id, numero: o.numero, ano: o.ano, nome: o.nome,
                    cliente_id: o.cliente_id || null, status: o.status,
                    endereco: o.endereco || null, latitude: o.latitude, longitude: o.longitude,
                    inicio_previsto: o.inicio_previsto || null, prazo: o.prazo || null,
                    inicio_real: o.inicio_real || null, conclusao: o.conclusao || null,
                    observacoes: o.observacoes || null,
                    itens: [{
                        id: s.itemId,
                        inicio_previsto: s.inicio || null,
                        fim_previsto: s.fim || null,
                        prazo_dias: s.prazo_dias != null ? String(s.prazo_dias) : null,
                        prazo_tipo: s.prazo_dias != null ? (s.prazo_tipo || 'corridos') : null
                    }]
                }
            });
            if (error) problemas.push('datas do serviço não voltaram (' + error.message + ')');
        }
        // desfazer só "gasta" o passo quando deu tudo certo — com falha, o botão
        // continua ali para nova tentativa
        if (!problemas.length) { limparUndo(); concluido = true; }
        await carregarDados();
        render();
        const extra = avisos.length ? ` · ${avisos.join('; ')}` : '';
        toast(problemas.length
            ? `↩ Desfeito só em parte — ${problemas.join('; ')}${extra}. Tente novamente.`
            : `↩ Desfeito: ${u.descricao}${extra}.`, problemas.length > 0 || avisos.length > 0);
    } catch (e) {
        toast('Erro ao desfazer: ' + e.message + ' — tente novamente.', true);
    } finally {
        undoRodando = false;
        if (btn) { btn.disabled = false; }
        if (!concluido) atualizarBotaoUndo();   // mantém o botão quando não concluiu
    }
}

document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    if (String(e.key).toLowerCase() !== 'z') return;
    const t = e.target;
    const digitando = t && (t.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    if (digitando) return;                                    // Ctrl+Z do campo é do campo
    // offsetParent nulo cobre os dois casos: linha do tempo recolhida E aba inativa
    if (!$('tlx-corpo') || $('tlx-corpo').offsetParent === null) return;
    if (!undoUltimo) return;                                   // deixa o Ctrl+Z padrão passar
    e.preventDefault();
    desfazerUltimo();
});

/** Grava as datas do serviço pela RPC do card da obra. Retorna true em sucesso
 *  (o chamador recarrega/avisa); em falha já mostra o toast e re-renderiza. */
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
        return false;
    }
    const alvo = (o.itens || []).find(i => i.id === item.id);
    if (!alvo || alvo.vigente === false) {
        toast('Este serviço mudou em outra aba (aditivo?) — recarregando a linha do tempo.', true);
        await carregarDados(); render();
        return false;
    }
    if (alvo.fim_real) {
        toast('Este serviço foi CONCLUÍDO em outra aba — as datas ficaram travadas.', true);
        await carregarDados(); render();
        return false;
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
        return false;
    }
    return true;
}

function iniciarArrastoAloc(e, el) {
    e.stopPropagation();
    const obra = obras.find(o => o.id === el.dataset.alocObra);
    const item = obra?.itens.find(i => i.id === el.dataset.alocItem);
    const aloc = item?.alocacoes.find(a => a.id === el.dataset.aloc);
    if (!aloc) return;
    const travaA = planTravaAloc.get(aloc.id);
    if (travaA) {
        toast(`Esta alocação está ${rotuloTrava(travaA)} — reabra o planejamento para alterá-la.`, true);
        return;
    }
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

/**
 * TODOS os conflitos do integrante na janela nova, consultados FRESCOS no banco.
 * A checagem é por INTEGRANTE — vale igual para quem foi alocado avulso ou via equipe.
 * excluirServicoId: ignora as alocações do próprio serviço arrastado (elas se movem juntas).
 * Retorna { erro } ou { conflitos: [{tipo:'aloc'|'ausencia', row, descr}] }.
 */
async function conflitosFrescos(aloc, nIni, nFim, excluirServicoId = null) {
    const nova = { data_inicio: nIni, data_fim: nFim, turno: aloc.turno, hora_inicio: aloc.hora_inicio, hora_fim: aloc.hora_fim };
    const [al, au] = await Promise.all([
        sb.from('hermo_alocacoes')
            .select('*, integrante:hermo_integrantes(nome, apelido), equipe:hermo_equipes(nome), obra_servico:hermo_obra_servicos(id, servico:hermo_servicos(codigo, descricao), obra:hermo_obras(id, nome, numero, ano))')
            .eq('integrante_id', aloc.integrante_id)
            .lte('data_inicio', nFim).gte('data_fim', nIni),
        sb.from('hermo_ausencias').select('*')
            .eq('integrante_id', aloc.integrante_id)
            .lte('data_inicio', nFim).gte('data_fim', nIni)
    ]);
    if (al.error || au.error) return { erro: (al.error || au.error).message };
    const conflitos = [];
    (al.data || []).forEach(x => {
        if (x.id === aloc.id) return;
        if (excluirServicoId && x.obra_servico_id === excluirServicoId) return;
        if (!periodosConflitam(nova, x)) return;
        const ob = x.obra_servico?.obra;
        const servico = `${x.obra_servico?.servico?.codigo || '?'} — ${x.obra_servico?.servico?.descricao || 'serviço'}`;
        const obraTxt = ob ? `OB-${String(ob.numero).padStart(4, '0')}/${ob.ano} — ${ob.nome}` : 'outra obra';
        conflitos.push({
            tipo: 'aloc', row: x,
            servico, obra: obraTxt, obraId: ob?.id || null,
            periodo: `${ddmm(x.data_inicio)}–${ddmm(x.data_fim)}`,
            turno: fmtTurno(x),
            equipe: x.equipe?.nome || null,
            descr: `${servico} · ${obraTxt} · ${ddmm(x.data_inicio)}–${ddmm(x.data_fim)}`
        });
    });
    (au.data || []).forEach(x => {
        if (!periodosConflitam(nova, x)) return;
        // ausência automática de deslocamento (criada pela Agenda/Logística) é
        // recriada a cada salvamento da rota — a origem real fica lá, não em Integrantes
        const deRota = (x.motivo || '').includes('[rota:');
        conflitos.push({
            tipo: 'ausencia', row: x, deRota,
            servico: `Ausência — ${x.tipo}${deRota ? ' (deslocamento de rota)' : ''}`,
            obra: null, obraId: null,
            motivo: (x.motivo || '').replace(/\s*\[rota:[^\]]*\]/, '').trim() || null,
            periodo: `${ddmm(x.data_inicio)}–${ddmm(x.data_fim)}`,
            turno: fmtTurno(x), equipe: null,
            descr: `ausência (${x.tipo}) de ${ddmm(x.data_inicio)} a ${ddmm(x.data_fim)}`
        });
    });
    return { conflitos };
}

// ============================================================
// PAINEL DE RESOLUÇÃO DE CONFLITOS
// ============================================================
let tlxcEstado = null; // { conflitos:[{aloc,nIni,nFim,outro}], aoAplicar(escolhas), rotuloArrastado }

function abrirResolucaoConflitos(rotuloArrastado, conflitos, aoAplicar) {
    tlxcEstado = { conflitos, aoAplicar };
    $('tlxc-intro').innerHTML =
        `O arrasto de <b>${esc(rotuloArrastado)}</b> deixaria integrante(s) em dois lugares ao mesmo tempo. ` +
        `Escolha como resolver cada caso — ou desfaça o arrasto (nada foi gravado ainda).`;
    $('tlxc-lista').innerHTML = conflitos.map((c, i) => {
        const nome = c.aloc.integrante?.nome || c.aloc.integrante?.apelido || 'Integrante';
        const o = c.outro;
        const ehAus = o.tipo === 'ausencia';
        const curto = s => (s || '').length > 46 ? s.slice(0, 46) + '…' : s;
        return `
        <div class="tlxc-conflito">
            <div class="quem">👷 ${esc(nome)}</div>
            <div class="tlxc-lado arrastado">
                <span class="tag">arrastado</span>
                <span class="txt"><b>${esc(rotuloArrastado)}</b>
                    <small>${ddmm(c.nIni)}–${ddmm(c.nFim)} · ${esc(fmtTurno(c.aloc))}${c.obraArrastada ? ' · ' + esc(c.obraArrastada) : ''}</small>
                </span>
            </div>
            <div class="tlxc-lado conflita">
                <span class="tag">conflita</span>
                <span class="txt"><b>${esc(o.servico)}</b>
                    <small>${o.obra ? esc(o.obra) + ' · ' : ''}${esc(o.periodo)} · ${esc(o.turno)}${o.equipe ? ' · equipe ' + esc(o.equipe) : ''}${o.motivo ? ' · ' + esc(o.motivo) : ''}</small>
                </span>
                ${o.obraId ? `<a class="hermo-btn small ghost" href="obras.html?editar=${o.obraId}" target="_blank" rel="noopener" title="Abrir a obra deste serviço">↗</a>` : ''}
            </div>
            <label class="${ehAus ? 'desabilitada' : ''}">
                <input type="radio" name="tlxc-${i}" value="outro" ${ehAus ? 'disabled' : ''} />
                <span>${ehAus
                    ? (o.deRota
                        ? `Esta ausência é automática do <b>deslocamento de uma rota</b> — remover aqui não adianta (a rota a recria). Ajuste a rota em <b>Agenda e Logística</b>.`
                        : `Remover a ausência não é possível por aqui — ajuste-a em <b>Integrantes e Equipes</b>.`)
                    : `Tirar <b>${esc(nome)}</b> de <b>${esc(curto(o.servico))}</b>${o.obra ? ` <small>(${esc(o.obra)})</small>` : ''}`}</span>
            </label>
            <label>
                <input type="radio" name="tlxc-${i}" value="deste" />
                <span>Tirar <b>${esc(nome)}</b> de <b>${esc(curto(rotuloArrastado))}</b> <small>(o serviço arrastado)</small></span>
            </label>
        </div>`;
    }).join('');
    $('tlxc-overlay').classList.add('aberto');
}

function fecharResolucao(desfazer = true) {
    $('tlxc-overlay').classList.remove('aberto');
    tlxcEstado = null;
    if (desfazer) {
        render();
        toast('↩ Arrasto desfeito — cronograma mantido como estava.');
    }
}

$('tlxc-fechar').addEventListener('click', () => fecharResolucao(true));
$('tlxc-desfazer').addEventListener('click', () => fecharResolucao(true));
ligarFecharPorBackdrop($('tlxc-overlay'), () => fecharResolucao(true));
$('tlxc-aplicar').addEventListener('click', async () => {
    if (!tlxcEstado) return;
    const escolhas = tlxcEstado.conflitos.map((c, i) =>
        document.querySelector(`input[name="tlxc-${i}"]:checked`)?.value || null);
    if (escolhas.some(e => !e)) {
        toast('Escolha uma opção para cada conflito (ou use "Desfazer o arrasto").', true);
        return;
    }
    const aoAplicar = tlxcEstado.aoAplicar;
    const conflitos = tlxcEstado.conflitos;
    $('tlxc-overlay').classList.remove('aberto');
    tlxcEstado = null;
    await aoAplicar(conflitos, escolhas);
});

async function salvarAloc(obra, item, aloc, nIni, nFim) {
    // conflito com consulta fresca (mesma régua do card da obra) → painel de resolução
    const pre = await conflitosFrescos(aloc, nIni, nFim);
    if (pre.erro) { toast('Não deu para checar conflitos: ' + pre.erro, true); render(); return; }
    if (pre.conflitos.length) {
        const rotulo = `${item.servico?.codigo || '?'} — ${item.servico?.descricao || 'serviço'}`;
        abrirResolucaoConflitos(rotulo, pre.conflitos.map(o => ({
            aloc, nIni, nFim, outro: o, obraArrastada: `${fmtCodObra(obra)} — ${obra.nome}`
        })), async (cs, escolhas) => {
            if (escolhas.includes('deste')) {
                // tirar o integrante do serviço arrastado resolve TODOS os conflitos dele
                // de uma vez — os 'outro' marcados nas demais linhas são ignorados
                // (removê-los também tiraria gente do outro serviço sem necessidade)
                const snap = await linhasDeAlocacoes([aloc.id]);
                if (snap.erro) {
                    toast('Não deu para preparar o desfazer (' + snap.erro + ') — nada foi removido. Tente de novo.', true);
                    render(); return;
                }
                const { error } = await sb.from('hermo_alocacoes').delete().eq('id', aloc.id);
                if (error) { toast('Erro ao remover a alocação: ' + error.message, true); render(); return; }
                registrarUndo(`remover ${aloc.integrante?.apelido || aloc.integrante?.nome || 'integrante'} de ${item.servico?.codigo || 'serviço'}`,
                    { alocs: snap.rows });
                await carregarDados(); render();
                toast(`👷 ${aloc.integrante?.nome || 'Integrante'} removido de ${item.servico?.codigo || 'serviço'} — conflito resolvido. Ctrl+Z desfaz.`);
                return;
            }
            // re-valida os "outros" antes de remover (o painel pode ter ficado aberto)
            const pares = cs.filter((c, i) => escolhas[i] === 'outro' && c.outro.tipo === 'aloc')
                .map(c => ({ id: c.outro.row.id, ref: { data_inicio: nIni, data_fim: nFim, turno: aloc.turno, hora_inicio: aloc.hora_inicio, hora_fim: aloc.hora_fim } }));
            const rev = await outrosAindaConflitantes(pares);
            if (rev.erro) { toast('Não deu para revalidar os conflitos: ' + rev.erro, true); render(); return; }
            if (rev.pulados) toast(`${rev.pulados} alocação(ões) do outro lado já não conflita(m) mais — mantida(s).`);
            let removidas = [];
            if (rev.manter.length) {
                const snap = await linhasDeAlocacoes(rev.manter);
                if (snap.erro) {
                    toast('Não deu para preparar o desfazer das remoções (' + snap.erro + ') — nada foi alterado. Tente de novo.', true);
                    render(); return;
                }
                removidas = snap.rows;
                const { error } = await sb.from('hermo_alocacoes').delete().in('id', rev.manter);
                if (error) { toast('Erro ao remover alocação(ões) conflitante(s): ' + error.message, true); render(); return; }
            }
            await executarMoveAloc(aloc, nIni, nFim, rev.manter.length, removidas);
        });
        return;
    }
    await executarMoveAloc(aloc, nIni, nFim);
}

async function executarMoveAloc(aloc, nIni, nFim, houveRemocoes = 0, removidas = []) {
    const antesIni = aloc.data_inicio, antesFim = aloc.data_fim;
    // linha completa ANTES de mover (base do Ctrl+Z); se não conseguir ler, o undo
    // desta alocação fica sem snapshot — avisa em vez de prometer o que não pode
    const snapMovida = await linhasDeAlocacoes([aloc.id]);
    const { error } = await sb.from('hermo_alocacoes')
        .update({ data_inicio: nIni, data_fim: nFim }).eq('id', aloc.id);
    if (error) { toast('Erro ao mover alocação: ' + error.message, true); render(); return; }
    // corrida entre sessões: re-verifica após gravar; se um conflito surgiu agora
    // há pouco, desfaz o movimento (mesmo padrão do card da obra)
    const pos = await conflitosFrescos(aloc, nIni, nFim);
    if (pos.conflitos?.length) {
        await sb.from('hermo_alocacoes')
            .update({ data_inicio: antesIni, data_fim: antesFim }).eq('id', aloc.id);
        // as remoções da resolução continuam válidas para o Ctrl+Z devolvê-las
        if (removidas.length) {
            registrarUndo(`remoção de ${removidas.length} alocação(ões) na resolução`, { alocs: removidas });
        }
        toast(`🚫 Outra sessão criou um conflito agora há pouco (${pos.conflitos[0].descr}) — o movimento foi desfeito${houveRemocoes ? ' (as remoções escolhidas na resolução foram mantidas — Ctrl+Z devolve)' : ''}.`, true);
        await carregarDados(); render();
        return;
    }
    const antes = snapMovida.rows?.length
        ? snapMovida.rows
        : [limparAloc({ ...aloc, data_inicio: antesIni, data_fim: antesFim })];
    registrarUndo(`mover ${aloc.integrante?.apelido || aloc.integrante?.nome || 'alocação'}`,
        { alocs: [...antes, ...removidas] });
    await carregarDados();
    render();
    toast(`👷 ${aloc.integrante?.apelido || aloc.integrante?.nome || 'Integrante'} agora em ${ddmm(nIni)}–${ddmm(nFim)} — agenda atualizada. Ctrl+Z desfaz.`);
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
$('tlx-hoje-btn').addEventListener('click', () => {
    reguaA = hoje();                       // devolve a régua vermelha ao momento atual
    gravarLS('hermo_tlx_reguas', { a: reguaA, b: reguaB });
    render();
    irParaHoje();
});
$('tlx-undo').addEventListener('click', desfazerUltimo);
$('plc-fechar').addEventListener('click', () => { $('plc-overlay').classList.remove('aberto'); planDraft = null; });
$('plc-cancelar').addEventListener('click', () => { $('plc-overlay').classList.remove('aberto'); planDraft = null; });
$('plc-confirmar').addEventListener('click', confirmarPlanejamento);
$('ta-fechar').addEventListener('click', () => { $('ta-overlay').classList.remove('aberto'); taAlvo = null; });
$('ta-cancelar').addEventListener('click', () => { $('ta-overlay').classList.remove('aberto'); taAlvo = null; });
$('ta-confirmar').addEventListener('click', confirmarAlocacaoRecorte);
$('ta-turno').addEventListener('change', () => {
    $('ta-horas').style.display = $('ta-turno').value === 'horario' ? '' : 'none';
});
$('ta-equipe').addEventListener('change', () => {
    const q = equipes.find(x => x.id === $('ta-equipe').value);
    if (!q) return;
    taMarcados = new Set(q.membroIds.filter(id => integrantes.some(i => i.id === id)));
    renderTaIntegrantes();
    toast(`Equipe "${q.nome}" marcada (${taMarcados.size} ativo(s)).`);
});
$('tlx-regua2').addEventListener('click', () => {
    if (reguaB) {
        reguaB = null;
        toast('2ª régua removida.');
    } else {
        // nasce 7 dias à frente da régua A (dentro do intervalo visível)
        reguaB = addDias(reguaA || hoje(), 7);
        if (intervalo && reguaB > intervalo.max) reguaB = intervalo.max;
        toast('2ª régua ligada — arraste as réguas para medir a produção do intervalo.');
    }
    gravarLS('hermo_tlx_reguas', { a: reguaA, b: reguaB });
    render();
});
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

// planejamento criado/reaberto/executado em outra aba do app: os dados daqui
// (datas, % e principalmente as TRAVAS) ficaram velhos — marca para recarregar
let planSujo = false;
window.addEventListener('plan-mudou', async () => {
    planSujo = true;
    if ($('tlx-secao')?.offsetParent !== null) {   // aba visível: recarrega já
        planSujo = false;
        if (await carregarDados()) render();
    }
});

// a aba "Execução no tempo" pode estar oculta no load — ao aparecer, mede e desenha
window.addEventListener('tlx-visivel', async () => {
    if ($('tlx-corpo').style.display === 'none') return;
    if (planSujo) { planSujo = false; await carregarDados(); }
    render();
    irParaHoje();
    if ($('tlx-mapa').style.display !== 'none') setTimeout(atualizarMapa, 60);
});

(async () => {
    if (lerLS('hermo_tlx_oculto', false)) {
        $('tlx-corpo').style.display = 'none';
        $('tlx-toggle').textContent = '⊞';
    }
    if (lerLS('hermo_tlx_mapa', false)) $('tlx-mapa').style.display = '';
    const rg = lerLS('hermo_tlx_reguas', null);
    reguaA = rg?.a || hoje();
    reguaB = rg?.b || null;
    if (await carregarDados()) {
        if ($('tlx-corpo').style.display !== 'none') {
            render();
            // só rola até hoje se a aba já estiver visível (senão as medidas são 0)
            if ($('tlx-secao').style.display !== 'none') irParaHoje();
        }
    }
})();
