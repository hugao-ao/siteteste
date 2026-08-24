// argos-cobranca.js — textos de cobrança e de nota fiscal
// =======================================================
// Reproduz o que a planilha da clínica gera hoje: a descrição que vai para
// a nota fiscal e a mensagem de fechamento enviada ao responsável pelo
// WhatsApp. O texto é conferido contra a planilha, então mudanças aqui
// mudam o que chega no cliente — mexer com cuidado.

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

    if (!dias.length) {
        return `${base}, no mês de ${mesNome} do ano de ${ano}. `
            + `Sessões com duração aproximada de ${dur} e ${custo}.`;
    }
    const n = sessoes == null ? dias.length : sessoes;
    return `${base}, no(s) dia(s): ${dias.join(', ')}, no mês de ${mesNome} do ano de ${ano}. `
        + `Total de ${n} sessões com duração aproximada de ${dur} e ${custo}.`;
}

/** 60 → "1 (uma) hora"; 90 → "1h30"; 30 → "30 minutos". */
export function duracaoTexto(min) {
    const n = Number(min) || 60;
    if (n === 60) return '1 (uma) hora';
    if (n % 60 === 0) return `${n / 60} horas`;
    if (n < 60) return `${n} minutos`;
    return `${Math.floor(n / 60)}h${String(n % 60).padStart(2, '0')}`;
}

/** Como o acordo é descrito na mensagem do responsável. */
export function acordoTexto(acordo = {}) {
    return acordo.tipo === 'fixo'
        ? `Fixo mensal de ${dinheiro(acordo.valor)}`
        : `${dinheiro(acordo.valor)} por sessão`;
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
