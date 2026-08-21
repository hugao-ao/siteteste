// argos-evolucao.js — Motor da Evolução Terapêutica
// ==================================================
// Regras (conforme a planilha de origem):
//   valor da SUBÁREA  = peso do nivelamento (1..5) da OPÇÃO SELECIONADA nela
//   COMPETÊNCIA da área = (Σ subáreas) / (5 × nº subáreas) × 5  ≡  média simples  → [1,5]
//   FOCO da área        = (5 − competência) × peso da área                        → [0,16]
// A precisão é mantida cheia; o arredondamento acontece só na exibição.

export const IMPORTANCIAS = [
    { valor: 1, nome: 'Secundária',      desc: 'Pouco observada no momento, ou em segundo plano para este paciente.' },
    { valor: 2, nome: 'Complementar',    desc: 'Relevante de forma secundária, dá suporte a outras funções.' },
    { valor: 3, nome: 'Alta Relevância', desc: 'Tem papel importante, mas não é o centro do trabalho no momento.' },
    { valor: 4, nome: 'Fundamental',     desc: 'Essencial para o desenvolvimento atual do paciente.' }
];
export const MAX_FUNDAMENTAIS = 2;

export const NIVEIS = [
    { valor: 1, nome: 'Indesejável', cor: '#ef4444' },
    { valor: 2, nome: 'Negativo',    cor: '#f97316' },
    { valor: 3, nome: 'Indiferente', cor: '#94a3b8' },
    { valor: 4, nome: 'Positivo',    cor: '#38bdf8' },
    { valor: 5, nome: 'Desejável',   cor: '#22c55e' }
];

export const COMPETENCIA_MAX = 5;                                  // nivelamento máximo
export const FOCO_MAX = (5 - 1) * Math.max(...IMPORTANCIAS.map(i => i.valor)); // (5−1)×4 = 16

export const MEMORIA_CAMPOS = [
    { chave: 'evoluindo',        rotulo: 'O QUE ESTÁ EVOLUINDO?' },
    { chave: 'nao_evoluindo',    rotulo: 'O QUE NÃO ESTÁ EVOLUINDO?' },
    { chave: 'escola_ultima',    rotulo: 'COMO FOI A ÚLTIMA VISITA À ESCOLA?' },
    { chave: 'escola_proxima',   rotulo: 'COMO DEVERÁ SER A PRÓXIMA VISITA À ESCOLA?' },
    { chave: 'familia_ultima',   rotulo: 'COMO FOI A ÚLTIMA SESSÃO COM A FAMÍLIA? (ou ANAMNESE)' },
    { chave: 'familia_proxima',  rotulo: 'COMO DEVERÁ SER A PRÓXIMA SESSÃO COM A FAMÍLIA?' },
    { chave: 'evitar',           rotulo: 'O QUE EVITAR FAZER DAQUI PRA FRENTE?' },
    { chave: 'procurar',         rotulo: 'O QUE PROCURAR FAZER DAQUI PRA FRENTE?' },
    { chave: 'observacoes',      rotulo: 'OBSERVAÇÕES, ANOTAÇÕES, INSIGHTS ETC…' },
    { chave: 'quem_e',           rotulo: 'DEPOIS DISSO TUDO, QUEM É {PACIENTE} (HUM)?' }
];

// ============================================================
// ÍNDICE DAS RESPOSTAS
// ============================================================
/** Indexa as respostas de UMA avaliação: {importancia, selecao, nivelamento, conferir}. */
export function indexarRespostas(respostas) {
    const ix = { importancia: {}, selecao: {}, nivelamento: {}, conferir: {} };
    for (const r of respostas || []) {
        if (r.tipo === 'importancia') ix.importancia[r.ref_id] = r.valor;
        else if (r.tipo === 'selecao') ix.selecao[r.ref_id] = r.opcao_id;
        else if (r.tipo === 'nivelamento') ix.nivelamento[r.ref_id] = r.valor;
        if (r.conferir) ix.conferir[`${r.tipo}:${r.ref_id}`] = true;
    }
    return ix;
}

// ============================================================
// CÁLCULO
// ============================================================
/**
 * Calcula competência e foco de cada área de uma avaliação.
 * catalogo = [{id, nome, ordem, subareas:[{id, nome, opcoes:[{id, nome}]}]}]
 * Retorna [{area_id, nome, peso, competencia, foco, subareas:[{id,nome,valor,opcao_id}], completa}]
 */
export function calcularAvaliacao(catalogo, respostas) {
    const ix = respostas && respostas.importancia ? respostas : indexarRespostas(respostas);
    return (catalogo || []).map(area => {
        const peso = ix.importancia[area.id] || null;
        const subs = (area.subareas || []).map(sa => {
            const opcaoId = ix.selecao[sa.id] || null;
            const valor = opcaoId ? (ix.nivelamento[opcaoId] || null) : null;
            return { id: sa.id, nome: sa.nome, opcao_id: opcaoId, valor };
        });
        const validas = subs.filter(s => s.valor != null);
        const completa = peso != null && subs.length > 0 && validas.length === subs.length;
        // fórmula original: (Σ / (5·n)) · 5 — idêntica à média simples
        const competencia = validas.length
            ? (validas.reduce((s, x) => s + x.valor, 0) / (5 * validas.length)) * 5
            : null;
        const foco = (competencia != null && peso != null) ? (5 - competencia) * peso : null;
        return { area_id: area.id, nome: area.nome, ordem: area.ordem, peso, subareas: subs, competencia, foco, completa };
    });
}

/** Pendências de preenchimento de uma avaliação (objetivos + badges de conferência). */
export function pendencias(catalogo, respostas) {
    const ix = respostas && respostas.importancia ? respostas : indexarRespostas(respostas);
    const faltando = [], conferir = [];
    let total = 0, preenchidos = 0;
    for (const area of catalogo || []) {
        total++;
        if (ix.importancia[area.id] != null) preenchidos++;
        else faltando.push({ area: area.nome, item: 'Importância da área', tipo: 'importancia', ref_id: area.id });
        if (ix.conferir[`importancia:${area.id}`]) conferir.push({ area: area.nome, item: 'Importância da área' });
        for (const sa of area.subareas || []) {
            total++;
            if (ix.selecao[sa.id]) preenchidos++;
            else faltando.push({ area: area.nome, item: `Classificação de "${sa.nome}"`, tipo: 'selecao', ref_id: sa.id });
            if (ix.conferir[`selecao:${sa.id}`]) conferir.push({ area: area.nome, item: `Classificação de "${sa.nome}"` });
            for (const op of sa.opcoes || []) {
                total++;
                if (ix.nivelamento[op.id] != null) preenchidos++;
                else faltando.push({ area: area.nome, item: `Nivelamento de "${op.nome}" (${sa.nome})`, tipo: 'nivelamento', ref_id: op.id });
                if (ix.conferir[`nivelamento:${op.id}`]) conferir.push({ area: area.nome, item: `Nivelamento de "${op.nome}" (${sa.nome})` });
            }
        }
    }
    return { total, preenchidos, faltando, conferir };
}

/** Áreas marcadas como Fundamental (peso 4) — a regra permite no máximo MAX_FUNDAMENTAIS. */
export function fundamentaisExcedentes(catalogo, respostas) {
    const ix = respostas && respostas.importancia ? respostas : indexarRespostas(respostas);
    const nomes = (catalogo || []).filter(a => ix.importancia[a.id] === 4).map(a => a.nome);
    return { nomes, excede: nomes.length > MAX_FUNDAMENTAIS };
}

/** Data-limite da próxima avaliação (dias a partir da data OU data fixa). */
export function limiteProxima(avaliacao) {
    if (!avaliacao) return null;
    if (avaliacao.proximo_prazo_data) return avaliacao.proximo_prazo_data;
    if (avaliacao.proximo_prazo_dias && avaliacao.data) {
        const d = new Date(avaliacao.data + 'T12:00');
        d.setDate(d.getDate() + Number(avaliacao.proximo_prazo_dias));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return null;
}

/** Uma avaliação concluída trava quando o prazo da próxima vence. */
export function avaliacaoTravada(avaliacao, hojeISO) {
    if (!avaliacao || avaliacao.status !== 'concluida') return false;
    const lim = limiteProxima(avaliacao);
    return !!(lim && hojeISO >= lim);
}

// ============================================================
// RADAR (SVG puro, sem dependências externas)
// ============================================================
/**
 * Desenha um radar de N eixos com até 2 séries.
 * opts = { titulo, eixos:[nome], series:[{nome, valores:[], cor, tracejada}],
 *          max (número) | 'auto', tamanho, aneis }
 */
export function radarSVG(opts) {
    const eixos = opts.eixos || [];
    const series = (opts.series || []).filter(s => s && (s.valores || []).some(v => v != null));
    const n = eixos.length;
    const tam = opts.tamanho || 460;
    const cx = tam / 2, cy = tam / 2 + 6;
    const raio = Math.min(tam, tam) * 0.31;
    const aneis = opts.aneis || 4;

    let max = opts.max;
    if (max === 'auto' || max == null) {
        const vals = series.flatMap(s => (s.valores || []).filter(v => v != null));
        max = vals.length ? Math.max(...vals) : 1;
    }
    if (!(max > 0)) max = 1;

    const ponto = (i, v) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = raio * Math.max(0, Math.min(1, v / max));
        return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    };
    const pontoEixo = (i, f) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        return [cx + raio * f * Math.cos(ang), cy + raio * f * Math.sin(ang)];
    };

    // teia: anéis + raios
    let teia = '';
    for (let k = 1; k <= aneis; k++) {
        const f = k / aneis;
        const pts = Array.from({ length: n }, (_, i) => pontoEixo(i, f).map(x => x.toFixed(1)).join(',')).join(' ');
        teia += `<polygon points="${pts}" fill="none" stroke="var(--argos-border,#334155)" stroke-width="1" opacity="${k === aneis ? .9 : .45}" />`;
    }
    for (let i = 0; i < n; i++) {
        const [x, y] = pontoEixo(i, 1);
        teia += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--argos-border,#334155)" stroke-width="1" opacity=".7" />`;
    }

    // rótulos dos eixos
    let rotulos = '';
    for (let i = 0; i < n; i++) {
        const [x, y] = pontoEixo(i, 1.19);
        const meio = Math.abs(x - cx) < 6;
        const anchor = meio ? 'middle' : (x > cx ? 'start' : 'end');
        const palavras = String(eixos[i]).split(' ');
        const linhas = [];
        let atual = '';
        for (const p of palavras) {
            if ((atual + ' ' + p).trim().length > 18) { linhas.push(atual.trim()); atual = p; }
            else atual += ' ' + p;
        }
        if (atual.trim()) linhas.push(atual.trim());
        const dy0 = y - (linhas.length - 1) * 6;
        rotulos += linhas.map((l, k) =>
            `<text x="${x.toFixed(1)}" y="${(dy0 + k * 12).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
                   font-size="11" fill="var(--argos-text-dim,#94a3b8)">${escapar(l)}</text>`).join('');
    }

    // séries
    let poligonos = '';
    for (const s of series) {
        const vals = s.valores || [];
        const pts = vals.map((v, i) => ponto(i, v == null ? 0 : v));
        const d = pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ');
        poligonos += `<polygon points="${d}" fill="${s.cor}" fill-opacity=".12" stroke="${s.cor}" stroke-width="2"
                       ${s.tracejada ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" />`;
        poligonos += pts.map(p =>
            `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${s.cor}" />`).join('');
    }

    const legenda = series.map((s, i) =>
        `<g transform="translate(${12 + i * 190}, ${tam - 8})">
           <line x1="0" y1="-4" x2="22" y2="-4" stroke="${s.cor}" stroke-width="2.5" ${s.tracejada ? 'stroke-dasharray="5 4"' : ''} />
           <text x="28" y="-4" dominant-baseline="middle" font-size="11" fill="var(--argos-text,#e2e8f0)">${escapar(s.nome)}</text>
         </g>`).join('');

    return `<svg viewBox="0 0 ${tam} ${tam}" width="100%" role="img" aria-label="${escapar(opts.titulo || 'Radar')}" style="max-width:${tam}px">
      <text x="12" y="18" font-size="13" font-weight="700" fill="var(--argos-primary,#38bdf8)">${escapar(opts.titulo || '')}</text>
      <text x="12" y="34" font-size="10.5" fill="var(--argos-text-dim,#94a3b8)">escala 0 – ${fmt(max)}</text>
      ${teia}${poligonos}${rotulos}${legenda}
    </svg>`;
}

// rótulo curto (eixo do radar): sem casas desnecessárias
const fmt = v => (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
// nota exibida em tabelas: sempre com 2 casas, como na planilha de origem
export const formataNota = v => v == null ? '—'
    : (Math.round(v * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapar(t) {
    return String(t == null ? '' : t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
