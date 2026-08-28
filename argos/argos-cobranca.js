// argos-cobranca.js — textos de cobrança e de nota fiscal
// =======================================================
// Reproduz o que a planilha da clínica gera hoje: a descrição que vai para
// a nota fiscal e a mensagem de fechamento enviada ao responsável pelo
// WhatsApp. O texto é conferido contra a planilha, então mudanças aqui
// mudam o que chega no cliente — mexer com cuidado.

import { excecoesVigentes, desdobrar, ratear } from './argos-excecoes.js';

export const MESES_EXTENSO = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

/**
 * Como cada status de sessão aparece na mensagem do responsável.
 * Sessão ainda pendente ('??') vale como presente no fechamento: o mês é
 * enviado com ela contando, e a correção, se houver, vem pela conferência
 * do próprio responsável.
 */
export const FREQUENCIA_TEXTO = {
    ok: 'Presente',
    '??': 'Presente',
    fj: 'Falta *não* contabilizada',
    fc: 'Falta *contabilizada*',
    nc: 'Não houve atendimento'
};

/** Meses de férias escolares, em que o fechamento sai mais bagunçado. */
export const MESES_FERIAS = [1, 7];

export const OBSERVACAO_FERIAS = 'Pois esse mês envolve recesso e muita junção de grupos, '
    + 'além de atendimentos fora do horário normal, ou seja, há maior possibilidade de erros.';

/** Recado que entra na mensagem daquele mês — vazio fora das férias. */
export function observacaoPadrao(mes) {
    const m = Number(String(mes || '').split('-')[1]);
    return MESES_FERIAS.includes(m) ? OBSERVACAO_FERIAS : '';
}

const SEPARADOR = '------------------------';

/**
 * Situação da nota fiscal do paciente naquele mês.
 * `emite` diz se sai nota; `atencao` marca as que não são rotina.
 */
export const SITUACAO_NOTA = [
    { valor: 'normal',     rotulo: 'Normal',     emite: true,  atencao: false,
      desc: 'Emissão comum, com a descrição padrão.' },
    { valor: 'especial',   rotulo: 'Especial',   emite: true,  atencao: true,
      desc: 'Sai do padrão: descrição diferente, assinatura da diretora ou documentos junto.' },
    { valor: 'nao',        rotulo: 'Não emitir', emite: false, atencao: false,
      desc: 'Este paciente não recebe nota fiscal.' },
    { valor: 'indefinido', rotulo: 'Indefinido', emite: false, atencao: true,
      desc: 'Faltam os dados de nota do paciente. É o estado de quem entrou pela frequência sem ficha financeira — resolver antes de cobrar.' }
];

/** Sem definição no cadastro, a situação é "indefinido" — e vira pendência. */
export const situacaoNota = v => SITUACAO_NOTA.find(s => s.valor === v) || SITUACAO_NOTA[3];

const dinheiro = v => (Number(v) || 0).toLocaleString('pt-BR',
    { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');

/** Primeiro nome, capitalizado — "LUCRECIA" → "Lucrecia". */
export function primeiroNome(nome) {
    const p = String(nome || '').trim().split(/\s+/)[0] || '';
    return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '';
}

/** "ALLAN DE SOUZA" → "Allan De Souza" (como a planilha escreve na mensagem). */
export function nomeTitulo(nome) {
    return String(nome || '').trim().toLowerCase()
        .replace(/(^|\s|')([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
}

/**
 * Deixa o telefone no formato que o link do WhatsApp aceita: só dígitos,
 * com o código do país na frente. Números que já vêm com país (+44…) são
 * respeitados; os brasileiros ganham o 55.
 */
export function normalizarFone(bruto, paisPadrao = '55') {
    const cru = String(bruto == null ? '' : bruto).trim();
    if (!cru) return '';
    const temMais = cru.startsWith('+');
    let d = cru.replace(/\D/g, '');
    if (!d) return '';
    if (temMais) return d;                       // veio com país declarado
    if (d.startsWith('00')) return d.slice(2);   // 00 + país
    if (d.length >= 12 && d.startsWith(paisPadrao)) return d;  // já tem o 55
    return paisPadrao + d;
}

/** Link que abre a conversa no WhatsApp com a mensagem pronta. */
export function linkWhatsApp(fone, texto) {
    const f = normalizarFone(fone);
    if (!f) return '';
    return `https://api.whatsapp.com/send?phone=${f}&text=${encodeURIComponent(texto || '')}`;
}

/**
 * Confere se o número tem cara de telefone do jeito que a clínica digita:
 * código do país, DDD e o número. Devolve { ok, fone, erro } — `fone` já
 * normalizado, pronto para o link.
 *
 * Aceita 8 ou 9 dígitos no número: fixo antigo ainda aparece na agenda de
 * alguns responsáveis, e recusá-lo seria inventar uma regra que a clínica
 * não tem.
 */
export function conferirFone(bruto) {
    const d = String(bruto == null ? '' : bruto).replace(/\D/g, '');
    if (!d) return { ok: false, fone: '', erro: 'Digite o número.' };
    const fone = normalizarFone(bruto);
    // país (1 a 3) + DDD (2) + número (8 ou 9)
    if (fone.length < 12 || fone.length > 14) {
        return { ok: false, fone,
            erro: 'Use código do país + DDD + número. Ex.: 55 81 99999-9999.' };
    }
    return { ok: true, fone, erro: '' };
}

/** "2026-08-03" → "03/08 (seg)" — como se lê num aviso, sem o ano repetido. */
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function dataCurta(iso) {
    const [a, m, d] = String(iso || '').split('-').map(Number);
    if (!a || !m || !d) return String(iso || '');
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} `
        + `(${DIAS_CURTOS[new Date(a, m - 1, d, 12).getDay()]})`;
}

/**
 * Mensagem de WhatsApp com as sessões que ainda faltam preencher.
 *
 * itens — [{ paciente, profissional, sala, data, hora }]
 *
 * Vai agrupada do mesmo jeito que está na tela: quem olha a lista e quem
 * recebe a mensagem precisam estar vendo a mesma coisa, senão a conferência
 * a quatro mãos não fecha.
 *
 * `limite` corta a lista quando o atraso é grande — a URL do WhatsApp tem
 * tamanho, e uma mensagem de duzentas linhas ninguém responde. O que ficou
 * de fora é anunciado, nunca escondido.
 */
export function mensagemPendencias({ itens = [], agrupar = 'paciente',
    hoje = '', limite = 60 } = {}) {
    if (!itens.length) return '';

    const porPaciente = agrupar !== 'data';
    const chave = i => porPaciente ? String(i.paciente || '') : String(i.data || '');
    const ordenados = [...itens].sort((a, b) =>
        chave(a).localeCompare(chave(b), 'pt-BR')
        || String(a.data + a.hora).localeCompare(String(b.data + b.hora)));

    const mostrados = ordenados.slice(0, limite);
    const sobraram = ordenados.length - mostrados.length;
    const pacientes = new Set(itens.map(i => i.paciente)).size;

    const linhas = ['*Sessões pendentes de preenchimento*'];
    if (hoje) linhas.push(`_Argos Gestão · ${formataDataBR(hoje)}_`);
    linhas.push('');
    linhas.push(`Faltam marcar *${itens.length}* sessão(ões) já vencida(s)`
        + (porPaciente ? ` de *${pacientes}* paciente(s):` : ':'));
    linhas.push('');

    let atual = null;
    for (const i of mostrados) {
        const k = chave(i);
        if (k !== atual) {
            if (atual !== null) linhas.push('');
            atual = k;
            const doGrupo = mostrados.filter(x => chave(x) === k);
            linhas.push(porPaciente
                ? `*${i.paciente}*${i.profissional ? ` (${i.profissional})` : ''} — ${doGrupo.length}`
                : `*${dataCurta(i.data)}* — ${doGrupo.length}`);
        }
        linhas.push(porPaciente
            ? `• ${dataCurta(i.data)} ${i.hora}`
            : `• ${i.hora} ${i.paciente}${i.profissional ? ` (${i.profissional})` : ''}`);
    }

    if (sobraram > 0) {
        linhas.push('');
        linhas.push(`_… e mais ${sobraram} sessão(ões). A lista completa está no sistema._`);
    }
    linhas.push('');
    linhas.push('Como foi cada uma? *Ok* (veio), *Fj* (faltou com justificativa), '
        + '*Fc* (faltou sem avisar) ou *Nc* (não houve atendimento).');
    return linhas.join('\n');
}

const formataDataBR = iso => {
    const [a, m, d] = String(iso || '').split('-');
    return a && m && d ? `${d}/${m}/${a}` : String(iso || '');
};

/**
 * Descrição que vai para a nota fiscal.
 *
 * mes  — 'YYYY-MM'
 * dias — números dos dias atendidos, em ordem (vazio = não detalha os dias)
 * acordo — { tipo: 'sessao' | 'fixo', valor }
 */
export function descricaoNota({ servico, paciente, cpf, mes, dias = [], sessoes,
    duracaoMin = 60, acordo = {} }) {
    const [ano, m] = String(mes || '').split('-');
    const mesNome = MESES_EXTENSO[Number(m) - 1] || '';
    const quem = `${String(paciente || '').trim()}${cpf ? ` (cpf nº ${cpf})` : ''}`;
    const dur = duracaoTexto(duracaoMin);
    const custo = acordo.tipo === 'fixo'
        ? `ao custo fixo mensal de ${dinheiro(acordo.valor)}`
        : `ao custo de ${dinheiro(acordo.valor)} por sessão`;
    const base = `Serviços de ${servico} devidamente prestados a ${quem}`;

    const n = sessoes == null ? dias.length : sessoes;
    const ondeQuando = dias.length
        ? `, no(s) dia(s): ${dias.join(', ')}, no mês de ${mesNome} do ano de ${ano}. `
        : `, no mês de ${mesNome} do ano de ${ano}. `;
    // sem dias, ou com dias que não somam sessão nenhuma (mês só de
    // atendimento familiar), a frase não anuncia total — dizer "Total de 0
    // sessões" numa nota fiscal seria pior que não dizer nada
    if (!dias.length || !n) {
        return `${base}${ondeQuando}Sessões com duração aproximada de ${dur} e ${custo}.`;
    }
    return `${base}${ondeQuando}Total de ${n} sessões com duração aproximada de ${dur} e ${custo}.`;
}

/**
 * Duração como a nota fiscal escreve: o número seguido dele por extenso,
 * entre parênteses — "1 (uma) hora", "30 (trinta) minutos". É o estilo da
 * casa e é o que aparece nas notas já emitidas.
 */
const POR_EXTENSO = {
    1: 'uma', 2: 'duas', 3: 'três', 4: 'quatro', 5: 'cinco', 10: 'dez',
    15: 'quinze', 20: 'vinte', 25: 'vinte e cinco', 30: 'trinta',
    40: 'quarenta', 45: 'quarenta e cinco', 50: 'cinquenta'
};
const extenso = n => POR_EXTENSO[n] ? ` (${POR_EXTENSO[n]})` : '';

export function duracaoTexto(min) {
    const n = Number(min) || 60;
    if (n === 60) return '1 (uma) hora';
    if (n % 60 === 0) {
        const h = n / 60;
        return `${h}${extenso(h)} horas`;
    }
    if (n < 60) return `${n}${extenso(n)} minutos`;
    return `${Math.floor(n / 60)}h${String(n % 60).padStart(2, '0')}`;
}

/**
 * Como o acordo é descrito na mensagem do responsável. Aceita um acordo só
 * ou a lista de acordos do mês (paciente com mais de uma dinâmica) — nesse
 * caso todos aparecem, separados por ponto.
 */
export function acordoTexto(acordo = {}) {
    if (Array.isArray(acordo)) {
        const itens = acordo.filter(a => a && (a.valor || a.tipo));
        if (!itens.length) return '';
        const iguais = itens.every(a => a.tipo === itens[0].tipo && a.valor === itens[0].valor);
        if (iguais) return acordoTexto(itens[0]);
        return itens.map(a => {
            const t = acordoTexto(a);
            return a.rotulo ? `${a.rotulo}: ${t}` : t;
        }).join(' · ');
    }
    if (acordo.tipo === 'fixo') return `Fixo mensal de ${dinheiro(acordo.valor)}`;
    if (acordo.tipo === 'pacote') return `Pacote — ${dinheiro(acordo.valor)} no mês`;
    if (acordo.tipo === 'avulso') return `Sessão avulsa — ${dinheiro(acordo.valor)}`;
    return `${dinheiro(acordo.valor)} por sessão`;
}

/**
 * Mensagem de fechamento enviada ao responsável.
 *
 * contato    — nome de quem recebe (vira o primeiro nome da saudação)
 * saudacao   — "Bom dia" | "Boa tarde" | "Boa noite"
 * observacao — recado do mês (recesso, junção de grupos…); opcional
 * frequencia — [{ dia, status }] em ordem; vazio não imprime o bloco
 * bancarios  — linhas dos dados de pagamento da clínica
 */
export function mensagemCobranca({ saudacao = 'Boa tarde', contato, mes, paciente,
    observacao = '', frequencia = [], sessoes, acordo = {}, total, bancarios = [] }) {
    const [, m] = String(mes || '').split('-');
    const mesNome = MESES_EXTENSO[Number(m) - 1] || '';
    const partes = [];

    // fora das férias o pedido é só "COM CUIDADO"; o "MAIS" acompanha o
    // recado do mês, que é o que justifica a atenção extra
    partes.push(`${saudacao} ${primeiroNome(contato)}, tudo bem?`);
    partes.push(`Por favor, você pode *CONFERIR COM ${observacao ? 'MAIS ' : ''}CUIDADO* as informações do fechamento do mês de *${mesNome}*?`
        + (observacao ? ` ${observacao}` : ''));
    partes.push('');
    partes.push(SEPARADOR);
    partes.push(`Paciente: *${nomeTitulo(paciente)}*`);

    if (frequencia.length) {
        partes.push('Frequência:');
        frequencia.forEach(f => partes.push(
            `- Dia: ${String(f.dia).padStart(2, '0')} {${FREQUENCIA_TEXTO[f.status] || f.status}}`));
        partes.push(`[ Total ${sessoes == null ? '' : sessoes} sessões ]`);
    }

    partes.push('');
    partes.push(`Acordo Financeiro: ${acordoTexto(acordo)}`);
    partes.push('');
    partes.push(`Valor total: *${dinheiro(total)}*`);
    partes.push(SEPARADOR);
    partes.push('');
    partes.push('Caso haja divergência, favor nos informar para corrigirmos o mais rápido possível!');
    partes.push('');
    partes.push('Caso não haja, seguem os dados bancários para o acerto:');
    bancarios.forEach(l => partes.push(l));
    partes.push('');
    partes.push('Favor encaminhar o comprovante.');
    partes.push('');
    partes.push('Obrigado! :)');
    return partes.join('\n');
}

/** Status que contam como sessão feita no fechamento. */
export const CONTA_COMO_SESSAO = new Set(['ok', '??', 'fc']);

/** Quantas sessões o mês fecha, pela lista de frequência. */
export function contarSessoes(frequencia = []) {
    return frequencia.filter(f => CONTA_COMO_SESSAO.has(f.status)).length;
}

/** Saudação pela hora do dia. */
export function saudacaoDe(hora) {
    const h = hora == null ? new Date().getHours() : hora;
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// ---------------------------------------------------------------------------
// Ponte com o fechamento
// ---------------------------------------------------------------------------
// O fechamento (argos-recorrencia.js) devolve as sessões do mês com data e
// status. A cobrança precisa disso em outro formato: a lista de dias que vai
// na mensagem e os dias que entram na descrição da nota.

/** Sessões do fechamento viram [{ dia, data, hora, status }], em ordem. */
export function frequenciaDoFechamento(fech) {
    return (fech && fech.sessoes ? [...fech.sessoes] : [])
        .sort((a, b) => String(a.data).localeCompare(String(b.data))
            || String(a.hora || '').localeCompare(String(b.hora || '')))
        .map(s => ({ dia: Number(String(s.data).slice(8, 10)), data: s.data,
            hora: s.hora || '', status: s.status }));
}

/** Só os dias que contam como sessão feita — é o que vai para a nota. */
export function diasCobrados(frequencia = []) {
    const dias = frequencia.filter(f => CONTA_COMO_SESSAO.has(f.status))
        .map(f => Number(f.dia));
    return [...new Set(dias)].sort((a, b) => a - b);
}

/**
 * Como o acordo do mês é descrito. Um paciente pode ter mais de uma dinâmica
 * (dois profissionais, dois grupos), e cada uma tem o seu acordo — todas
 * aparecem, porque o responsável confere o valor pela soma delas.
 */
export function acordosDoFechamento(fech, dinamicas = []) {
    const porId = new Map((dinamicas || []).map(d => [d.id, d]));
    const vistos = new Set();
    const itens = [];
    for (const pd of (fech && fech.porDinamica ? fech.porDinamica : [])) {
        const d = porId.get(pd.dinamica_id);
        if (!d) {                                   // sessão avulsa, sem dinâmica
            itens.push({ tipo: 'avulso', valor: pd.valor, rotulo: 'Sessão avulsa' });
            continue;
        }
        if (vistos.has(d.id)) continue;
        vistos.add(d.id);
        itens.push({
            tipo: d.acordo_tipo === 'fixo_mensal' ? 'fixo'
                : d.acordo_tipo === 'pacote' ? 'pacote' : 'sessao',
            valor: Number(d.acordo_tipo === 'pacote' ? pd.valor : d.valor) || 0,
            rotulo: d.rotulo || ''
        });
    }
    return itens;
}

// ---------------------------------------------------------------------------
// Regime de nota fiscal
// ---------------------------------------------------------------------------

/**
 * Qual é o regime de nota do paciente naquele mês.
 * A exceção do mês (argos_nota_mes) manda; sem ela, vale o que está nas
 * dinâmicas. Dinâmicas em desacordo resolvem pelo lado mais cuidadoso:
 * qualquer uma sem definição deixa o mês indefinido, e uma especial faz o
 * mês inteiro pedir atenção.
 */
export function notaEfetiva({ dinamicas = [], excecao = null } = {}) {
    if (excecao && excecao.nota_tipo) {
        return { valor: excecao.nota_tipo, origem: 'mes', observacao: excecao.observacao || '' };
    }
    const tipos = (dinamicas || []).map(d => d.nota_tipo || 'indefinido');
    if (!tipos.length) return { valor: 'indefinido', origem: 'ausente', observacao: '' };
    const escolha = tipos.includes('indefinido') ? 'indefinido'
        : tipos.includes('especial') ? 'especial'
        : tipos.every(t => t === 'nao') ? 'nao' : 'normal';
    return { valor: escolha, origem: 'dinamica', observacao: '' };
}

/**
 * Retrato do mês para a nota: é isto que se congela na emissão e é contra
 * isto que o fechamento vivo é comparado depois.
 */
export function retratoDaNota({ paciente = {}, fech, dinamicas = [], mes,
    servico, excecao = null, excecoes = [] } = {}) {
    const frequencia = frequenciaDoFechamento(fech);
    const itens = acordosDoFechamento(fech, dinamicas);
    const fixo = itens.length && itens.every(i => i.tipo === 'fixo');
    const total = fech ? fech.valor : 0;
    const acordoReal = { tipo: fixo ? 'fixo' : 'sessao',
        valor: fixo ? itens.reduce((s, i) => s + i.valor, 0)
             : (itens.find(i => i.tipo === 'sessao') || {}).valor || 0 };
    const situacao = notaEfetiva({ dinamicas, excecao }).valor;

    // O que o plano aceita ver na nota pode não ser o acordo real: uma sessão
    // de R$ 180 sai como duas de R$ 90. A exceção só troca os dias, a
    // contagem e o valor unitário — a descrição continua sendo montada pela
    // mesma função de sempre, e o total do mês não se mexe.
    const vigentes = excecoesVigentes(excecoes, paciente.id, mes);
    const quebra = vigentes.desdobrar
        ? desdobrar({ frequencia, acordo: acordoReal, total,
                      params: vigentes.desdobrar.params || {} })
        : { aplicou: false, avisos: [] };

    const dias = quebra.aplicou ? quebra.dias : diasCobrados(frequencia);
    const sessoes = quebra.aplicou ? quebra.sessoes : contarSessoes(frequencia);
    const acordo = quebra.aplicou ? quebra.acordo : acordoReal;

    const texto = alvo => descricaoNota({
        servico: servico || 'Psicomotricidade Relacional',
        paciente: paciente.nome, cpf: paciente.rf_cpf || paciente.cpf,
        mes, dias: alvo.dias, sessoes: alvo.sessoes, acordo: alvo.acordo
    });

    const retrato = {
        mes, valor: total, sessoes, dias, nota_tipo: situacao,
        descricao: texto({ dias, sessoes, acordo }),
        // o que a exceção mudou, para a tela poder mostrar e conferir
        desdobrado: !!quebra.aplicou, acordo_real: acordoReal,
        avisos: [...(quebra.avisos || [])], partes: []
    };

    // Pai e mãe recebem metade cada: um fechamento e uma nota para cada um.
    // O valor de cada parte é do responsável; o do mês continua sendo o da
    // clínica, e é ele que fecha a produção.
    if (vigentes.rateio) {
        const divisao = ratear({ total, partes: (vigentes.rateio.params || {}).partes || [] });
        retrato.avisos.push(...divisao.avisos);
        retrato.partes = divisao.partes.map(x => ({
            ...x, parte_total: divisao.partes.length,
            // cada nota fala das sessões do mês inteiro, mas do valor da parte
            descricao: texto({ dias, sessoes,
                acordo: { tipo: acordo.tipo,
                          valor: sessoes ? arredondar(x.valor / sessoes) : x.valor } })
        }));
    }
    return retrato;
}

const arredondar = v => Math.round((Number(v) || 0) * 100) / 100;

/** Campos do retrato que, mudando, obrigam a refazer a nota. */
const CAMPOS_RETRATO = [
    ['valor', 'o valor do mês'],
    ['sessoes', 'a quantidade de sessões'],
    ['dias', 'os dias atendidos'],
    ['descricao', 'a descrição da nota'],
    ['nota_tipo', 'o regime de nota']
];

const mesmoValor = (a, b) => Array.isArray(a) || Array.isArray(b)
    ? JSON.stringify(a || []) === JSON.stringify(b || [])
    : String(a == null ? '' : a) === String(b == null ? '' : b);

/**
 * O que mudou entre a nota emitida e o fechamento de agora.
 * Devolve [] quando a nota continua de pé.
 */
export function compararRetrato(nota = {}, atual = {}) {
    const mudou = [];
    for (const [campo, texto] of CAMPOS_RETRATO) {
        if (mesmoValor(nota[campo], atual[campo])) continue;
        mudou.push({ campo, texto, antes: nota[campo], depois: atual[campo] });
    }
    return mudou;
}

/** Frase da pendência, para o histórico e para a lista. */
export function motivoDaDivergencia(mudou = []) {
    if (!mudou.length) return '';
    return `Mudou ${mudou.map(m => m.texto).join(', ')} depois da nota emitida.`;
}

// ---------------------------------------------------------------------------
// Detalhes financeiros e contatos
// ---------------------------------------------------------------------------

/** Anotações que valem naquele mês: as gerais e as do período que o contém. */
export function detalhesDoMes(lista = [], mes) {
    return (lista || []).filter(d => {
        if (d.escopo !== 'periodo') return true;
        if (!mes) return true;
        if (d.mes_de && mes < d.mes_de) return false;
        if (d.mes_ate && mes > d.mes_ate) return false;
        return true;
    });
}

/**
 * Para quem mandar o fechamento. Os contatos cadastrados vêm primeiro (o
 * principal na frente); sem nenhum, cai no whatsapp do responsável
 * financeiro, que é o que veio da planilha.
 */
export function contatosParaCobranca(paciente = {}, contatos = []) {
    const lista = (contatos || []).filter(c => c.ativo !== false)
        .sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0))
        .map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone,
            papel: c.papel || '', origem: 'cadastro' }));
    if (lista.length) return lista;
    if (paciente.rf_whatsapp) {
        return [{ id: null, nome: paciente.responsavel_financeiro || paciente.nome,
            telefone: paciente.rf_whatsapp, papel: 'Responsável financeiro',
            origem: 'planilha' }];
    }
    return [];
}

/** 'YYYY-MM' → 'julho/2026'. */
export function mesBR(mes) {
    const [ano, m] = String(mes || '').split('-');
    const nome = MESES_EXTENSO[Number(m) - 1];
    return nome ? `${nome[0] + nome.slice(1).toLowerCase()}/${ano}` : String(mes || '');
}
