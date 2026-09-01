// argos-xlsx.js — ler .xlsx sem biblioteca de fora
// ================================================
// Um .xlsx é um ZIP com XML dentro. O navegador já sabe descompactar
// (DecompressionStream) e o XML das planilhas é regular o bastante para se
// ler direto — então não há por que depender de uma biblioteca em CDN que
// pode não carregar bem na hora em que a clínica mais precisa importar.
//
// O que este leitor entende é o que os arquivos da clínica usam: células de
// texto compartilhado, texto embutido e números. Fórmulas voltam pelo valor
// calculado que o Excel gravou. É deliberadamente pequeno; se um dia chegar
// um arquivo exótico, a mensagem de erro pede o CSV — que sempre funciona.

// ---------------------------------------------------------------------------
// O ZIP
// ---------------------------------------------------------------------------

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

async function inflar(bytes, metodo) {
    if (metodo === 0) return bytes;                       // guardado sem compactar
    if (metodo !== 8) throw new Error(`Compactação ${metodo} não suportada.`);
    const ds = new DecompressionStream('deflate-raw');
    const resposta = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await resposta.arrayBuffer());
}

/** Os arquivos de dentro do ZIP: Map(nome → () => Promise<texto>). */
export function arquivosDoZip(arrayBuffer) {
    const b = new Uint8Array(arrayBuffer);
    // o fim do diretório central fica no rabo do arquivo (assinatura 0x06054b50)
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
        if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Isto não parece um arquivo .xlsx (ZIP sem diretório).');
    const total = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);

    const decoder = new TextDecoder('utf-8');
    const mapa = new Map();
    for (let n = 0; n < total; n++) {
        if (u32(b, p) !== 0x02014b50) break;
        const metodo = u16(b, p + 10);
        const tamanhoComp = u32(b, p + 20);
        const nomeLen = u16(b, p + 28), extraLen = u16(b, p + 30), comentLen = u16(b, p + 32);
        const offsetLocal = u32(b, p + 42);
        const nome = decoder.decode(b.subarray(p + 46, p + 46 + nomeLen));
        mapa.set(nome, async () => {
            // o cabeçalho local repete nome e extra com tamanhos próprios
            const nl = u16(b, offsetLocal + 26), el = u16(b, offsetLocal + 28);
            const ini = offsetLocal + 30 + nl + el;
            const dados = await inflar(b.subarray(ini, ini + tamanhoComp), metodo);
            return decoder.decode(dados);
        });
        p += 46 + nomeLen + extraLen + comentLen;
    }
    return mapa;
}

// ---------------------------------------------------------------------------
// O XML das planilhas
// ---------------------------------------------------------------------------

const desescapar = t => String(t)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Junta todos os <t> de um trecho (texto simples ou em pedaços formatados). */
const textoDosT = trecho => {
    let saida = '';
    for (const m of trecho.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) saida += desescapar(m[1]);
    return saida;
};

function lerSharedStrings(xml) {
    if (!xml) return [];
    return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoDosT(m[1]));
}

/** "AB7" → coluna 27 (zero-based) . */
const colunaDe = ref => {
    let c = 0;
    for (const ch of ref) {
        if (ch >= 'A' && ch <= 'Z') c = c * 26 + (ch.charCodeAt(0) - 64);
        else break;
    }
    return c - 1;
};

function lerAba(xml, strings) {
    const linhas = [];
    for (const mRow of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
        const numero = Number(mRow[1]);
        const celulas = [];
        for (const mC of mRow[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const attrs = mC[1], corpo = mC[2] || '';
            const ref = (/r="([A-Z]+)\d+"/.exec(attrs) || [])[1];
            if (!ref) continue;
            const tipo = (/t="([^"]+)"/.exec(attrs) || [])[1] || '';
            let valor = '';
            if (tipo === 'inlineStr') {
                valor = textoDosT(corpo);
            } else {
                const v = (/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(corpo) || [])[1];
                if (v == null) valor = '';
                else if (tipo === 's') valor = strings[Number(v)] ?? '';
                else valor = desescapar(v);        // número, texto de fórmula, booleano
            }
            celulas[colunaDe(ref)] = valor;
        }
        while (linhas.length < numero - 1) linhas.push([]);
        linhas.push(Array.from(celulas, c => c == null ? '' : c));
    }
    return linhas;
}

// ---------------------------------------------------------------------------
// O arquivo inteiro
// ---------------------------------------------------------------------------

/**
 * Todas as abas do .xlsx, na ordem do arquivo: [{ nome, linhas }].
 *
 * As abas vêm com nome porque escolher "a primeira" é armadilha: o arquivo
 * da clínica tem seis, e a de frequência é a última.
 */
export async function abasDoXlsx(arrayBuffer) {
    const zip = arquivosDoZip(arrayBuffer);
    const pegar = async nome => zip.has(nome) ? await zip.get(nome)() : '';

    const wb = await pegar('xl/workbook.xml');
    if (!wb) throw new Error('Arquivo sem xl/workbook.xml — não é um .xlsx.');
    const rels = await pegar('xl/_rels/workbook.xml.rels');
    const alvoDoRid = {};
    for (const m of rels.matchAll(/<Relationship\s[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*?\/>/g)) {
        alvoDoRid[m[1]] = m[2].replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/');
    }
    const strings = lerSharedStrings(await pegar('xl/sharedStrings.xml'));

    const abas = [];
    for (const m of wb.matchAll(/<sheet\s[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"[^>]*?\/>/g)) {
        const caminho = alvoDoRid[m[2]];
        if (!caminho) continue;
        const xml = await pegar(caminho);
        if (!xml) continue;
        abas.push({ nome: desescapar(m[1]), linhas: lerAba(xml, strings) });
    }
    if (!abas.length) throw new Error('Nenhuma aba legível dentro do arquivo.');
    return abas;
}

/** Linhas → CSV que o resto do sistema já sabe ler (aspas escapadas). */
export function linhasParaCsv(linhas) {
    const campo = v => {
        const t = String(v == null ? '' : v);
        return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    return linhas.map(l => l.map(campo).join(',')).join('\n');
}

const SIGLAS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
    'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/**
 * A aba de frequência do arquivo, com o mês que ela mesma anuncia.
 *
 * Primeiro tenta a aba cujo nome é a sigla de um mês (é assim que a planilha
 * da clínica nomeia); senão, a primeira cujo cabeçalho parece frequência.
 * Devolve { aba, mes } — mes vem null quando o nome não diz.
 */
export function abaDeFrequencia(abas, pareceFrequencia) {
    for (const aba of abas) {
        const sigla = String(aba.nome || '').trim().toUpperCase();
        const m = SIGLAS.indexOf(sigla);
        if (m >= 0) return { aba, mes: m + 1 };
    }
    for (const aba of abas) {
        if (pareceFrequencia && pareceFrequencia(linhasParaCsv(aba.linhas.slice(0, 1)))) {
            return { aba, mes: null };
        }
    }
    return { aba: null, mes: null };
}
