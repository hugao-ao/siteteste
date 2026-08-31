// hermo-documentos.js — Geração de PROPOSTA (PDF/Excel) e CONTRATO (Word/PDF).
// O layout reproduz o padrão que a HVC já usa nos arquivos do acervo:
// cabeçalho com razão social, corpo em seções numeradas e rodapé com endereço/CNPJ.

import { fmtMoeda, esc } from './hermo-common.js';

// ============================================================
// DADOS FIXOS DA EMPRESA (conferem com contratos e notas do acervo)
// ============================================================
export const EMPRESA = {
    razao: 'HVC IMPERMEABILIZAÇÕES LTDA',
    nomeCurto: 'HVC Impermeabilizações Ltda.',
    cnpj: '22.335.667/0001-88',
    inscricaoMunicipal: '5394139',
    endereco: 'Rua Professora Anunciada da Rocha Melo, 214 – Sala 104',
    complemento: 'Empresarial Melo Gouveia – Madalena',
    cidade: 'Recife',
    uf: 'PE',
    cep: '50710-390',
    fone: '(81) 3228-3025',
    email: 'hvcimpermeabilizacoes@gmail.com',
    representante: 'HERMÓGENES CAVALCANTI PIRAJÁ VIANA',
    banco: 'Banco Itaú',
    agencia: '6878',
    conta: '20702-3',
    pix: '22.335.667/0001-88',
    foro: 'Recife'
};

export const RODAPE = `${EMPRESA.endereco} – ${EMPRESA.complemento} – CEP: ${EMPRESA.cep}\n` +
    `Fone: ${EMPRESA.fone} – ${EMPRESA.cidade}/${EMPRESA.uf} / E-mail: ${EMPRESA.email} – CNPJ ${EMPRESA.cnpj}`;

// ============================================================
// VALOR POR EXTENSO (o contrato traz sempre "R$ X (extenso)")
// ============================================================
const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** Escreve por extenso um número de 1 a 999. */
function ate999(n) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), d = Math.floor((n % 100) / 10), u = n % 10;
    const partes = [];
    if (c) partes.push(CENTENAS[c]);
    if (d === 1) partes.push(DEZ_A_DEZENOVE[u]);
    else {
        if (d) partes.push(DEZENAS[d]);
        if (u) partes.push(UNI[u]);
    }
    return partes.join(' e ');
}

/** Valor monetário por extenso, no formato usado nos contratos da HVC. */
export function valorPorExtenso(valor) {
    const v = Math.round((Number(valor) || 0) * 100) / 100;
    const inteiro = Math.floor(v);
    const centavos = Math.round((v - inteiro) * 100);

    const escreveInteiro = n => {
        if (n === 0) return 'zero';
        // cada grupo guarda o texto E o número que representa — a ligação depende
        // do valor do ÚLTIMO grupo, não do que sobrou das unidades
        const grupos = [];
        let resto = n;
        const escalas = [
            { div: 1e9, sing: 'bilhão', plur: 'bilhões' },
            { div: 1e6, sing: 'milhão', plur: 'milhões' },
            { div: 1e3, sing: 'mil', plur: 'mil' }
        ];
        for (const e of escalas) {
            const q = Math.floor(resto / e.div);
            if (q > 0) {
                grupos.push({
                    txt: `${e.div === 1e3 && q === 1 ? '' : ate999(q) + ' '}${q === 1 ? e.sing : e.plur}`.trim(),
                    val: q
                });
                resto -= q * e.div;
            }
        }
        if (resto > 0) grupos.push({ txt: ate999(resto), val: resto });
        if (grupos.length === 1) return grupos[0].txt;
        // classes separam por vírgula; a última liga com "e" quando vale menos de
        // cem ou é centena redonda ("um milhão e quinhentos mil",
        // "dois milhões, duzentos e trinta e sete mil, oitocentos e cinquenta e cinco")
        const ultimo = grupos.pop();
        const ligaComE = ultimo.val < 100 || ultimo.val % 100 === 0;
        return grupos.map(g => g.txt).join(', ') + (ligaComE ? ' e ' : ', ') + ultimo.txt;
    };

    const partes = [];
    if (inteiro > 0) {
        // milhão/bilhão exato pede "de reais" ("um milhão de reais"), mas
        // "um milhão e quinhentos mil reais" não
        const de = inteiro >= 1e6 && inteiro % 1e6 === 0 ? 'de ' : '';
        partes.push(`${escreveInteiro(inteiro)} ${de}${inteiro === 1 ? 'real' : 'reais'}`);
    }
    if (centavos > 0) partes.push(`${escreveInteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
    if (!partes.length) return 'zero reais';
    return partes.join(' e ');
}

/** Maiúscula em cada palavra, menos os conectivos — como nos contratos: "Dezenove Mil Reais",
 *  "Setenta e Um Mil e Duzentos Reais". */
export function extensoTitulo(valor) {
    const conectivos = new Set(['e', 'de']);
    return valorPorExtenso(valor)
        .split(' ')
        .map((p, i) => (i > 0 && conectivos.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
}

// ============================================================
// FORMATAÇÃO AUXILIAR
// ============================================================
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function dataExtenso(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function dataBR(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

/** Quantidade de anos válida, ou o padrão. Campo vazio vira NaN no parseInt e o
 *  operador ?? NÃO pega NaN — sem isto o documento sairia com "até  anos". */
export function anosOu(v, padrao) {
    const n = parseInt(v);
    return Number.isFinite(n) && n > 0 ? n : padrao;
}

/** Número por extenso entre parênteses, como nos prazos: "15 (quinze) dias úteis". */
export function numeroExtenso(n) {
    const v = parseInt(n) || 0;
    if (v < 1) return '';
    return v <= 999 ? ate999(v) : String(v);
}

/** Endereço do cliente numa linha só. */
export function enderecoCliente(c) {
    if (!c) return '';
    const p = [c.endereco, c.bairro, [c.cidade, c.uf].filter(Boolean).join(' - ')].filter(Boolean);
    let s = p.join(', ');
    if (c.cep) s += `, CEP ${c.cep}`;
    return s;
}

/** Dispara o download de um Blob com o nome informado. */
export function baixar(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Nome de arquivo sem caracteres proibidos. */
export function nomeSeguro(s) {
    return String(s || 'documento').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);
}

/** Entrega o arquivo: baixa (padrão) ou devolve {blob, nome} quando `retornarBlob`
 *  — usado por testes e por quem quiser anexar o documento em vez de baixar. */
function entregar(blob, nome, opts) {
    if (opts?.retornarBlob) return { blob, nome };
    baixar(blob, nome);
    return { nome };
}

// ============================================================
// CARGA SOB DEMANDA DAS BIBLIOTECAS (só baixa quando o usuário gera)
// ============================================================
const carregados = new Map();

function carregarScript(url) {
    if (carregados.has(url)) return carregados.get(url);
    const p = new Promise((ok, erro) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = () => ok();
        s.onerror = () => {
            // sem isto a promessa rejeitada ficaria no cache e o botão nunca mais
            // funcionaria, mesmo depois de a internet voltar
            s.remove();
            carregados.delete(url);
            erro(new Error('Não foi possível carregar ' + url));
        };
        document.head.appendChild(s);
    });
    carregados.set(url, p);
    return p;
}

export async function carregarJsPDF() {
    await carregarScript('https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js');
    await carregarScript('https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');
    const ctor = window.jspdf?.jsPDF;
    if (!ctor) throw new Error('jsPDF não inicializou.');
    return ctor;
}

export async function carregarXLSX() {
    await carregarScript('https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js');
    if (!window.XLSX) throw new Error('SheetJS não inicializou.');
    return window.XLSX;
}

// ============================================================
// TEXTOS FIXOS (transcritos dos documentos do acervo)
// ============================================================
export const TEXTOS = {
    apresentacao:
        'A HVC Impermeabilizações é uma empresa do ramo da construção e tem como principal objetivo a ' +
        'aplicação das mais atuais e eficientes técnicas de engenharia na elaboração de projetos de ' +
        'impermeabilização e execução de obras, fornecendo serviços de qualidade. Nossa equipe técnica é ' +
        'formada por profissionais altamente capacitados para atender as diversas necessidades de nossos clientes.',
    // Cada documento tem a SUA cláusula, como sempre foi no acervo da empresa:
    // a proposta fala em três anos citando o art. 618; o contrato, em cinco anos
    // citando o art. 1245. Os prazos vêm de campos separados da proposta.
    garantiaProposta: anos =>
        `A garantia legal é válida para os serviços executados e a qualidade dos materiais empregados que ` +
        `por ventura apresentem falhas no seu rendimento, por um prazo de até ${numeroExtenso(anos)} anos a ` +
        `contar da data de entrega dos mesmos, conforme Capítulo oito, Artigo 618 do Código Civil Brasileiro. ` +
        `É restrita à impermeabilização defeituosa e inválida caso haja danos causados por terceiros e/ou ` +
        `deficiência estrutural.`,
    garantiaContrato: anos =>
        `A garantia legal é válida para os serviços executados e a qualidade dos materiais empregados que ` +
        `porventura apresentem falhas no seu rendimento por um prazo de até ${numeroExtenso(anos)} anos a contar ` +
        `da data de entrega dos mesmos conforme artigo 1245 do Código Civil Brasileiro.`,
    reajuste: '- Preço fixo.',
    encargosContratada: [
        'Manter em regime de tempo parcial na obra um técnico qualificado para dirigir e supervisionar os ' +
        'trabalhos contratados, bem como o pronto atendimento às solicitações da contratante no que se refere ' +
        'às obrigações contratuais;',
        'Fornecimento de mão de obra especializada para execução dos serviços e alguns materiais necessários.',
        'Obedecer às normas de higiene e segurança do trabalho;',
        'Obedecer às normas da ABNT em todos os serviços.',
        'Manter sempre limpo o ambiente e interferir o mínimo possível nos objetos existentes.'
    ],
    encargosContratante: [
        'Fornecer local adequado para a guarda de nossos materiais e equipamentos bem como assumir a ' +
        'responsabilidade dos mesmos na obra;',
        'Fornecer água, luz e força.',
        'Manter a área isolada.'
    ],
    foro:
        `Fica eleito o Foro da Cidade do ${EMPRESA.foro} (PE) para dirimir quaisquer divergências oriundas do ` +
        `presente Contrato, renunciando as partes a qualquer outro, por mais especial que se apresente.`,
    fechoContrato: 'E por estarem juntos e acordados, assinam o presente instrumento em duas vias de teor igual e forma.'
};

/** A proposta inteira tem a divisão mão de obra / material informada?
 *  Só então vale mostrar a divisão no documento — proposta antiga com preço
 *  fechado mantém o layout de coluna única do acervo. */
export function temDivisaoMoMaterial(itens) {
    return (itens || []).length > 0 && itens.every(i => i.modo_preco === 'mo_material');
}

/** Linha "Mão de obra R$ X + material R$ Y" que acompanha a descrição. */
export function linhaMoMaterial(i) {
    if (i.modo_preco !== 'mo_material') return '';
    return `Mão de obra ${fmtMoeda(i.preco_mo)} + material ${fmtMoeda(i.preco_material)}`;
}

/** Unidade como aparece nos documentos ("m2" vira "m²"). */
export function unidadeDoc(u) {
    const m = { m2: 'm²', m3: 'm³', m: 'm', un: 'un', vb: 'vb', kg: 'kg' };
    return m[String(u || '').toLowerCase()] || (u || 'un');
}

/** Junta as parcelas num bloco de texto no formato usado em "CONDIÇÕES DE PAGAMENTO". */
export function blocoPagamento(parcelas, obs) {
    const BASE = {
        assinatura: 'da assinatura do contrato',
        inicio: 'do início dos serviços',
        medicao: 'da medição',
        conclusao: 'da conclusão dos serviços',
        data: ''
    };
    const linhas = (parcelas || []).map(p => {
        // com descrição escrita pelo usuário, ela manda ("Com 30 dias – R$ 5.500,00",
        // que é como o acervo escreve); sem descrição, monta a frase pelo prazo
        if (p.descricao) {
            const quando = p.base === 'data' && p.data_prevista ? ` em ${dataBR(p.data_prevista)}` : '';
            return `- ${p.descricao}${quando} – ${fmtMoeda(p.valor)}`;
        }
        const rot = p.tipo === 'sinal' ? 'Sinal' : p.tipo === 'medicao' ? 'Medição' : 'Parcela';
        if (p.base === 'data' && p.data_prevista) return `- ${rot} em ${dataBR(p.data_prevista)} – ${fmtMoeda(p.valor)}`;
        if (p.dias) return `- ${rot}, com ${p.dias} dias ${BASE[p.base] || ''} – ${fmtMoeda(p.valor)}`;
        return `- ${rot} – ${fmtMoeda(p.valor)}`;
    });
    if (obs) linhas.push(`- ${obs}`);
    if (!linhas.length) linhas.push('- A combinar');
    return linhas;
}

const CRONOGRAMA_DA_OBRA = 'De acordo com o cronograma da obra.';

/** Fecha a frase com ponto quando quem escreveu não fechou. */
function comPonto(s) {
    const t = String(s || '').trim();
    return t && !/[.!?…]$/.test(t) ? t + '.' : t;
}

/** Como o prazo desta proposta deve ser lido. Proposta antiga que só tem os dias
 *  gravados (sem tipo) continua valendo como prazo em dias. */
function tipoDePrazo(prop) {
    return prop?.prazo_tipo || (prop?.prazo_dias ? 'uteis' : 'cronograma');
}

/** Frase do prazo de execução da PROPOSTA, na redação que a empresa usa.
 *  'cronograma' é o caso mais comum do acervo (obra tocada por construtora);
 *  'texto' deixa o prazo escrito à mão para os casos fora do padrão. */
export function frasePrazo(prop) {
    const tipo = tipoDePrazo(prop);
    if (tipo === 'texto') return comPonto(prop.prazo_texto) || CRONOGRAMA_DA_OBRA;
    if (tipo === 'cronograma' || !prop?.prazo_dias) return CRONOGRAMA_DA_OBRA;
    const un = tipo === 'corridos' ? 'dias corridos' : 'dias úteis';
    return `${prop.prazo_dias} (${numeroExtenso(prop.prazo_dias)}) ${un}.`;
}

/** Cláusula 7.0 do CONTRATO: o mesmo prazo, na redação do instrumento. */
export function clausulaPrazoContrato(prop, inicioISO) {
    const tipo = tipoDePrazo(prop);
    const abre = 'O prazo de vigência do presente CONTRATO, bem como de execução dos serviços';
    if (tipo === 'texto' && comPonto(prop.prazo_texto)) {
        return `${abre}, é o seguinte: ${comPonto(prop.prazo_texto)}`;
    }
    if (tipo === 'cronograma' || !prop?.prazo_dias) {
        return `${abre}, será de acordo com o cronograma da obra.`;
    }
    const un = tipo === 'corridos' ? 'dias corridos' : 'dias úteis';
    return `${abre} é de ${prop.prazo_dias} (${numeroExtenso(prop.prazo_dias)}) ${un}, ` +
        `com início em ${dataBR(inicioISO) || '____/____/______'}.`;
}

// ============================================================
// PROPOSTA — PDF (Layout carta, o modelo predominante do acervo)
// ============================================================
const MARGEM = 18;      // mm
const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const UTIL = LARGURA_A4 - MARGEM * 2;

function novaPagina(doc, y, precisa = 12) {
    if (y + precisa <= ALTURA_A4 - 28) return y;
    doc.addPage();
    return MARGEM + 4;
}

/** Escreve um parágrafo justificado quebrando página quando preciso. Devolve o novo y. */
function paragrafo(doc, texto, y, opts = {}) {
    const { size = 10, style = 'normal', x = MARGEM, largura = UTIL, espaco = 4.6, align = 'justify' } = opts;
    doc.setFont('helvetica', style).setFontSize(size);
    const linhas = doc.splitTextToSize(String(texto ?? ''), largura);
    for (const l of linhas) {
        y = novaPagina(doc, y, espaco);
        // a última linha de um bloco justificado não estica
        doc.text(l, x, y, { maxWidth: largura, align: align === 'justify' ? 'left' : align });
        y += espaco;
    }
    return y;
}

function tituloSecao(doc, texto, y) {
    y = novaPagina(doc, y, 12);
    y += 3;
    doc.setFont('helvetica', 'bold').setFontSize(10.5);
    doc.text(texto, MARGEM, y);
    return y + 5;
}

function rodapeTodasPaginas(doc) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setDrawColor(170).setLineWidth(0.3);
        doc.line(MARGEM, ALTURA_A4 - 22, LARGURA_A4 - MARGEM, ALTURA_A4 - 22);
        doc.setFont('helvetica', 'normal').setFontSize(7.6).setTextColor(90);
        doc.text(
            `${EMPRESA.endereco} – ${EMPRESA.complemento} – CEP: ${EMPRESA.cep} – Fone: ${EMPRESA.fone} – ${EMPRESA.cidade}/${EMPRESA.uf}`,
            LARGURA_A4 / 2, ALTURA_A4 - 17, { align: 'center' });
        doc.text(
            `E-mail: ${EMPRESA.email} – CNPJ ${EMPRESA.cnpj}`,
            LARGURA_A4 / 2, ALTURA_A4 - 13, { align: 'center' });
        doc.text(`${i}/${n}`, LARGURA_A4 - MARGEM, ALTURA_A4 - 13, { align: 'right' });
        doc.setTextColor(0);
    }
}

function cabecalhoEmpresa(doc, y) {
    doc.setFont('helvetica', 'bold').setFontSize(15);
    doc.text(EMPRESA.razao, LARGURA_A4 / 2, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
    doc.text(`CNPJ ${EMPRESA.cnpj} – ${EMPRESA.cidade}/${EMPRESA.uf}`, LARGURA_A4 / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 3;
    doc.setDrawColor(150).setLineWidth(0.4);
    doc.line(MARGEM, y, LARGURA_A4 - MARGEM, y);
    return y + 8;
}

export async function gerarPropostaPDF(d, opts) {
    const jsPDF = await carregarJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { proposta: p, cliente: c, itens } = d;
    let y = MARGEM;

    y = cabecalhoEmpresa(doc, y);

    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text(`Proposta nº ${String(p.numero).padStart(4, '0')}/${p.ano}`, LARGURA_A4 - MARGEM, y, { align: 'right' });
    y += 8;

    // destinatário
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text('Ao', MARGEM, y); y += 4.8;
    doc.setFont('helvetica', 'bold');
    doc.text(c?.nome || '(cliente não informado)', MARGEM, y); y += 4.8;
    doc.setFont('helvetica', 'normal');
    if (p.contato_nome) { doc.text(`Att: ${p.contato_nome}`, MARGEM, y); y += 4.8; }
    if (p.titulo) { y = paragrafo(doc, `Obra: ${p.titulo}`, y, { espaco: 4.8 }); }
    if (p.endereco) { y = paragrafo(doc, `Local: ${p.endereco}`, y, { espaco: 4.8 }); }
    y += 4;

    y = paragrafo(doc, TEXTOS.apresentacao, y);
    y += 2;

    y = tituloSecao(doc, 'ESPECIFICAÇÃO DA OBRA:', y);

    doc.autoTable({
        startY: y,
        margin: { left: MARGEM, right: MARGEM, bottom: 30 },
        head: [['ITEM', 'ESPEC. DOS SERVIÇOS', 'UND', 'QUANT.', 'P. UNITÁRIO', 'P. TOTAL']],
        body: itens.map((i, n) => [
            String(n + 1),
            // a divisão entra como segunda linha da descrição: mantém a tabela
            // estreita e legível em A4, sem inventar colunas novas
            i.descricao + (linhaMoMaterial(i) ? '\n' + linhaMoMaterial(i) : ''),
            unidadeDoc(i.unidade),
            Number(i.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
            fmtMoeda(i.preco_unit),
            fmtMoeda(i.total)
        ]),
        styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 1.8, overflow: 'linebreak', textColor: 20 },
        headStyles: { fillColor: [42, 62, 90], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 11, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 13, halign: 'center' },
            3: { cellWidth: 17, halign: 'right' },
            4: { cellWidth: 24, halign: 'right' },
            5: { cellWidth: 26, halign: 'right' }
        },
        alternateRowStyles: { fillColor: [244, 246, 249] }
    });
    y = doc.lastAutoTable.finalY + 6;

    const total = itens.reduce((t, i) => t + (Number(i.total) || 0), 0);
    y = novaPagina(doc, y, 10);
    doc.setFont('helvetica', 'bold').setFontSize(10.5);
    y = paragrafo(doc, `Total dos serviços – ${fmtMoeda(total)} (${extensoTitulo(total)}).`, y,
        { style: 'bold', size: 10.5, espaco: 5 });
    y += 3;

    y = tituloSecao(doc, 'CONDIÇÕES DE PAGAMENTO', y);
    for (const l of blocoPagamento(d.parcelas, p.pagamento_obs)) y = paragrafo(doc, l, y);

    y = tituloSecao(doc, 'PRAZO DE EXECUÇÃO', y);
    y = paragrafo(doc, '- ' + frasePrazo(p), y);

    y = tituloSecao(doc, 'GARANTIA', y);
    y = paragrafo(doc, TEXTOS.garantiaProposta(anosOu(p.garantia_anos, 3)), y);

    if (p.validade_dias) {
        y = tituloSecao(doc, 'VALIDADE DA PROPOSTA', y);
        y = paragrafo(doc, `- ${p.validade_dias} (${numeroExtenso(p.validade_dias)}) dias a contar da data desta proposta.`, y);
    }
    if (p.observacoes) {
        y = tituloSecao(doc, 'OBS.:', y);
        y = paragrafo(doc, p.observacoes, y);
    }

    y = novaPagina(doc, y + 4, 34);
    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`${EMPRESA.cidade}, ${dataExtenso(p.data_proposta)}.`, LARGURA_A4 - MARGEM, y, { align: 'right' });
    y += 10;
    doc.text('Atenciosamente,', MARGEM, y);
    y += 14;
    doc.setDrawColor(60).setLineWidth(0.3);
    doc.line(MARGEM, y, MARGEM + 70, y);
    y += 4.5;
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text('Hermógenes C. P. Viana', MARGEM, y);
    y += 4.2;
    doc.setFont('helvetica', 'normal').setFontSize(8.6).setTextColor(90);
    doc.text(EMPRESA.nomeCurto, MARGEM, y);
    doc.setTextColor(0);

    rodapeTodasPaginas(doc);
    return entregar(doc.output('blob'),
        nomeSeguro(`Proposta ${String(p.numero).padStart(4, '0')}-${p.ano} - ${c?.nome || 'sem cliente'}`) + '.pdf', opts);
}

// ============================================================
// PROPOSTA — EXCEL (Layout planilha orçamentária do acervo)
// ============================================================
export async function gerarPropostaExcel(d, opts) {
    const XLSX = await carregarXLSX();
    const { proposta: p, cliente: c, itens } = d;
    const total = itens.reduce((t, i) => t + (Number(i.total) || 0), 0);
    const cod = `${String(p.numero).padStart(4, '0')}-${p.ano}`;

    const linhas = [
        [EMPRESA.razao.replace(' LTDA', '')],
        [`${EMPRESA.endereco} – ${EMPRESA.complemento}`],
        [`CEP: ${EMPRESA.cep} – Fone: ${EMPRESA.fone} – ${EMPRESA.cidade}/${EMPRESA.uf}`],
        [`E-mail: ${EMPRESA.email} – CNPJ ${EMPRESA.cnpj}`],
        [],
        ['PROPOSTA:', cod, '', 'DATA:', dataBR(p.data_proposta)],
        ['CLIENTE:', c?.nome || '', '', 'ATT:', p.contato_nome || ''],
        ['OBRA:', p.titulo || '', '', 'LOCAL:', p.endereco || ''],
        []
    ];
    // na planilha há espaço para as colunas de mão de obra e material
    const comDivisao = temDivisaoMoMaterial(itens);
    linhas.push(comDivisao
        ? ['ITEM', 'ESPEC. DOS SERVIÇOS', 'UND', 'QUANT.', 'MÃO DE OBRA', 'MATERIAL', 'P. UNITÁRIO', 'P. TOTAL']
        : ['ITEM', 'ESPEC. DOS SERVIÇOS', 'UND', 'QUANT.', 'P. UNITÁRIO', 'P. TOTAL']);
    itens.forEach((i, n) => linhas.push(comDivisao
        ? [n + 1, i.descricao, unidadeDoc(i.unidade), Number(i.quantidade) || 0,
           Number(i.preco_mo) || 0, Number(i.preco_material) || 0,
           Number(i.preco_unit) || 0, Number(i.total) || 0]
        : [n + 1, i.descricao, unidadeDoc(i.unidade), Number(i.quantidade) || 0,
           Number(i.preco_unit) || 0, Number(i.total) || 0]));
    linhas.push([]);
    const linhaTotal = ['', 'VALOR TOTAL DA OBRA', '', '', '', ''];
    if (comDivisao) linhaTotal.push('', '');
    linhaTotal[comDivisao ? 7 : 5] = total;
    linhas.push(linhaTotal);
    linhas.push([]);
    linhas.push([`Importa este orçamento a quantia de ${fmtMoeda(total)} (${extensoTitulo(total)}).`]);
    linhas.push([]);
    linhas.push(['Forma de Pagamento']);
    blocoPagamento(d.parcelas, p.pagamento_obs).forEach(l => linhas.push([l]));
    linhas.push([]);
    linhas.push(['PRAZO DE EXECUÇÃO']);
    linhas.push(['- ' + frasePrazo(p)]);
    linhas.push([]);
    linhas.push(['GARANTIA']);
    linhas.push([TEXTOS.garantiaProposta(anosOu(p.garantia_anos, 3))]);
    if (p.observacoes) { linhas.push([]); linhas.push(['OBS.:']); linhas.push([p.observacoes]); }
    linhas.push([]);
    linhas.push([`${EMPRESA.cidade}, ${dataExtenso(p.data_proposta)}.`]);
    linhas.push(['Hermógenes C. P. Viana — ' + EMPRESA.nomeCurto]);

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws['!cols'] = comDivisao
        ? [{ wch: 6 }, { wch: 56 }, { wch: 7 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }]
        : [{ wch: 6 }, { wch: 62 }, { wch: 7 }, { wch: 10 }, { wch: 14 }, { wch: 15 }];
    // moeda e quantidade nas linhas de item
    const colValor = comDivisao ? ['E', 'F', 'G', 'H'] : ['E', 'F'];
    const colTotal = comDivisao ? 'H' : 'F';
    const primeiraItem = 11;                       // 1-based: cabeçalho da tabela está na linha 10
    for (let r = 0; r < itens.length; r++) {
        const lin = primeiraItem + r;
        if (ws[`D${lin}`]) ws[`D${lin}`].z = '#,##0.00';
        colValor.forEach(col => { if (ws[`${col}${lin}`]) ws[`${col}${lin}`].z = 'R$ #,##0.00'; });
    }
    const linTotal = primeiraItem + itens.length + 1;
    if (ws[`${colTotal}${linTotal}`]) ws[`${colTotal}${linTotal}`].z = 'R$ #,##0.00';
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: comDivisao ? 7 : 5 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proposta');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return entregar(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        nomeSeguro(`Proposta ${cod} - ${c?.nome || 'sem cliente'}`) + '.xlsx', opts);
}

// ============================================================
// CONTRATO — corpo comum (Modelo A: seções 1.0 a 9.0)
// ============================================================
/** Monta as seções do contrato já com os dados preenchidos. */
export function montarContrato(d) {
    const { proposta: p, cliente: c, itens } = d;
    const total = itens.reduce((t, i) => t + (Number(i.total) || 0), 0);
    const cod = `${String(p.numero).padStart(4, '0')}/${p.ano}`;
    const pf = (c?.tipo_pessoa || 'PJ') === 'PF';

    const qualificaContratante = pf
        ? `de um lado como outorgante o(a) Sr(a). ${c?.nome || '____________'}` +
          `${c?.cpf_cnpj ? `, CPF nº ${c.cpf_cnpj}` : ''}` +
          `${enderecoCliente(c) ? `, residente na ${enderecoCliente(c)}` : ''}, denominado(a) CONTRATANTE`
        : `de um lado como outorgante ao ${c?.nome || '____________'}` +
          `${enderecoCliente(c) ? `, localizado na ${enderecoCliente(c)}` : ''}` +
          `${c?.cpf_cnpj ? `, inscrito no CNPJ ${c.cpf_cnpj}` : ''}` +
          `${c?.representante ? `, neste ato representado, pelo(a) Sr(a). ${c.representante}` : ''}` +
          `${c?.cpf_representante ? `, CPF nº ${c.cpf_representante}` : ''}, denominado CONTRATANTE`;

    const partes =
        `Contrato de prestação de serviços que fazem entre si, ${qualificaContratante}, do outro lado a ` +
        `${EMPRESA.razao}, situada na ${EMPRESA.endereco} – ${EMPRESA.cidade} / ${EMPRESA.uf}, CNPJ ` +
        `${EMPRESA.cnpj}, neste instrumento denominado CONTRATADA, aqui representado pelo Sr. ` +
        `${EMPRESA.representante}, nos termos das cláusulas e condições a seguir:`;

    const objeto =
        `Serviços de: ${itens.map(i => i.descricao).join(', ')}. Conforme proposta nº ${cod}.`;

    return {
        titulo: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
        codigo: cod,
        total,
        cliente: c,
        secoes: [
            { n: '1.0', titulo: 'DAS PARTES', paragrafos: [partes] },
            {
                n: '2.0', titulo: 'OBJETO', paragrafos: [objeto],
                tabela: itens.map((i, k) => [
                    String(k + 1), i.descricao, unidadeDoc(i.unidade),
                    Number(i.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
                    fmtMoeda(i.preco_unit), fmtMoeda(i.total)
                ])
            },
            { n: '3.0', titulo: 'PREÇO TOTAL DOS SERVIÇOS', paragrafos: [`${fmtMoeda(total)} (${extensoTitulo(total)}).`] },
            {
                n: '4.0', titulo: 'CONDIÇÕES DE PAGAMENTO',
                itens: blocoPagamento(d.parcelas, p.pagamento_obs),
                subtitulo: 'Dados Bancários',
                paragrafosFinais: [
                    EMPRESA.banco,
                    `Agência: ${EMPRESA.agencia}`,
                    `Conta Corrente: ${EMPRESA.conta}`,
                    `Pix: ${EMPRESA.pix} (CNPJ)`
                ]
            },
            { n: '5.0', titulo: 'REAJUSTE', paragrafos: [TEXTOS.reajuste] },
            {
                n: '6.0', titulo: 'ENCARGOS',
                subsecoes: [
                    { n: '6.1', titulo: 'Ficará por conta da contratada', itens: TEXTOS.encargosContratada },
                    { n: '6.2', titulo: 'Ficará por conta da contratante', itens: TEXTOS.encargosContratante }
                ]
            },
            {
                n: '7.0', titulo: 'PRAZO DE EXECUÇÃO',
                paragrafos: [clausulaPrazoContrato(p, d.inicioPrevisto)]
            },
            { n: '8.0', titulo: 'GARANTIA', paragrafos: [TEXTOS.garantiaContrato(anosOu(p.garantia_contrato_anos, 5))] },
            { n: '9.0', titulo: 'FORO', paragrafos: [TEXTOS.foro] }
        ]
    };
}

// ============================================================
// CONTRATO — PDF
// ============================================================
export async function gerarContratoPDF(d, opts) {
    const jsPDF = await carregarJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ct = montarContrato(d);
    const { proposta: p, cliente: c } = d;
    let y = MARGEM + 2;

    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text(ct.titulo, LARGURA_A4 / 2, y, { align: 'center' });
    y += 9;

    for (const s of ct.secoes) {
        y = novaPagina(doc, y, 14);
        y += 2;
        doc.setFont('helvetica', 'bold').setFontSize(10.5);
        doc.text(`${s.n} ${s.titulo}`, MARGEM, y);
        y += 5.5;

        for (const par of s.paragrafos || []) y = paragrafo(doc, par, y);

        if (s.tabela && s.tabela.length) {
            y += 2;
            doc.autoTable({
                startY: y,
                margin: { left: MARGEM, right: MARGEM, bottom: 26 },
                head: [['ITEM', 'DESCRIÇÃO', 'UND', 'QUANT.', 'P. UNIT.', 'TOTAL']],
                body: s.tabela,
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
                headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold', halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 11, halign: 'center' }, 1: { cellWidth: 'auto' },
                    2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 17, halign: 'right' },
                    4: { cellWidth: 24, halign: 'right' }, 5: { cellWidth: 26, halign: 'right' }
                }
            });
            y = doc.lastAutoTable.finalY + 4;
        }

        for (const it of s.itens || []) y = paragrafo(doc, it, y, { x: MARGEM + 4, largura: UTIL - 4 });

        if (s.subtitulo) {
            y = novaPagina(doc, y + 3, 10);
            doc.setFont('helvetica', 'bold').setFontSize(10);
            doc.text(s.subtitulo, MARGEM, y);
            y += 5;
        }
        for (const par of s.paragrafosFinais || []) y = paragrafo(doc, par, y);

        for (const sub of s.subsecoes || []) {
            y = novaPagina(doc, y + 2, 12);
            doc.setFont('helvetica', 'bold').setFontSize(10);
            doc.text(`${sub.n} ${sub.titulo}`, MARGEM + 3, y);
            y += 5;
            for (const it of sub.itens) y = paragrafo(doc, '• ' + it, y, { x: MARGEM + 7, largura: UTIL - 7 });
            y += 1;
        }
    }

    // fecho e assinaturas
    y = novaPagina(doc, y + 6, 60);
    y = paragrafo(doc, TEXTOS.fechoContrato, y);
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`${EMPRESA.cidade}, ${dataExtenso(p.data_proposta)}.`, LARGURA_A4 - MARGEM, y, { align: 'right' });
    y += 18;

    const assinatura = (nome, sub) => {
        y = novaPagina(doc, y, 22);
        doc.setDrawColor(60).setLineWidth(0.3);
        doc.line(MARGEM, y, MARGEM + 80, y);
        y += 4.6;
        doc.setFont('helvetica', 'bold').setFontSize(9.6);
        doc.text(nome, MARGEM, y);
        if (sub) { y += 4.2; doc.setFont('helvetica', 'normal').setFontSize(9); doc.text(sub, MARGEM, y); }
        y += 16;
    };
    assinatura(EMPRESA.nomeCurto, EMPRESA.representante);
    assinatura(c?.nome || '____________________', c?.representante || '');

    rodapeTodasPaginas(doc);
    return entregar(doc.output('blob'),
        nomeSeguro(`Contrato ${String(p.numero).padStart(4, '0')}-${p.ano} - ${c?.nome || 'sem cliente'}`) + '.pdf', opts);
}

// ============================================================
// CONTRATO — WORD (.doc em HTML: abre e edita no Word sem plugin)
// ============================================================
export function gerarContratoWord(d, opts) {
    const ct = montarContrato(d);
    const { proposta: p, cliente: c } = d;

    const bloco = s => {
        const partes = [`<h2>${esc(s.n)} ${esc(s.titulo)}</h2>`];
        (s.paragrafos || []).forEach(t => partes.push(`<p class="just">${esc(t)}</p>`));
        if (s.tabela?.length) {
            partes.push(`<table class="itens"><thead><tr>
                <th>ITEM</th><th>DESCRIÇÃO</th><th>UND</th><th>QUANT.</th><th>P. UNIT.</th><th>TOTAL</th>
              </tr></thead><tbody>` +
                s.tabela.map(l => `<tr>${l.map((v, k) =>
                    `<td class="${k === 0 || k === 2 ? 'c' : k >= 3 ? 'r' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('') +
                `</tbody></table>`);
        }
        (s.itens || []).forEach(t => partes.push(`<p class="ind">${esc(t)}</p>`));
        if (s.subtitulo) partes.push(`<p class="sub">${esc(s.subtitulo)}</p>`);
        (s.paragrafosFinais || []).forEach(t => partes.push(`<p class="ind">${esc(t)}</p>`));
        (s.subsecoes || []).forEach(sub => {
            partes.push(`<p class="sub">${esc(sub.n)} ${esc(sub.titulo)}</p>`);
            partes.push('<ul>' + sub.itens.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>');
        });
        return partes.join('\n');
    };

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8" />
<title>${esc(ct.titulo)} ${esc(ct.codigo)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2.5cm 2cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000; }
  h1 { font-size: 14pt; text-align: center; margin: 0 0 18pt; text-transform: uppercase; }
  h2 { font-size: 11.5pt; margin: 14pt 0 5pt; }
  p { margin: 0 0 6pt; line-height: 1.35; }
  p.just { text-align: justify; }
  p.ind { margin-left: 14pt; }
  p.sub { font-weight: bold; margin: 8pt 0 4pt 8pt; }
  ul { margin: 0 0 8pt 26pt; padding: 0; }
  li { margin-bottom: 4pt; text-align: justify; }
  table.itens { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 6pt 0 10pt; }
  table.itens th { background: #3c3c3c; color: #fff; padding: 4pt; border: 1px solid #999; }
  table.itens td { padding: 3pt 4pt; border: 1px solid #999; }
  table.itens td.c { text-align: center; }
  table.itens td.r { text-align: right; }
  .data { text-align: right; margin: 16pt 0 26pt; }
  .assina { margin-top: 30pt; }
  .assina .linha { border-top: 1px solid #000; width: 8cm; margin-bottom: 3pt; }
  .assina b { display: block; }
</style></head>
<body>
<h1>${esc(ct.titulo)}</h1>
${ct.secoes.map(bloco).join('\n')}
<p class="just" style="margin-top:14pt">${esc(TEXTOS.fechoContrato)}</p>
<p class="data">${esc(EMPRESA.cidade)}, ${esc(dataExtenso(p.data_proposta))}.</p>
<div class="assina">
  <div class="linha"></div><b>${esc(EMPRESA.nomeCurto)}</b><span>${esc(EMPRESA.representante)}</span>
</div>
<div class="assina">
  <div class="linha"></div><b>${esc(c?.nome || '____________________')}</b><span>${esc(c?.representante || '')}</span>
</div>
</body></html>`;

    return entregar(new Blob(['﻿', html], { type: 'application/msword' }),
        nomeSeguro(`Contrato ${String(p.numero).padStart(4, '0')}-${p.ano} - ${c?.nome || 'sem cliente'}`) + '.doc', opts);
}

export { esc, fmtMoeda };
