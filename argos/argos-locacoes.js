// argos-locacoes.js — aluguel de espaço da clínica
// ================================================
// A clínica atende e também aluga. O aluguel não é sempre a sala inteira o
// mês todo: vai do integral (todos os turnos, todos os dias) ao turno solto
// — uma terça à tarde por mês, ou segunda e quinta de manhã toda semana.
//
// Por isso a unidade aqui é o TURNO DE UM DIA DA SEMANA, não a hora: é assim
// que o aluguel é negociado e é assim que ele precisa ser conferido depois.
// Uma locação é um punhado desses turnos, com uma recorrência e uma vigência.
//
// Tudo o que a tela mostra sai daqui — as ocorrências no calendário, o
// choque com outra locação, o quanto se cobra no mês. Nada disso é olhômetro:
// o dia 5 de um mês pode ter a 1ª ou a 2ª terça, e o valor "por turno" muda
// de mês para mês porque nem todo mês tem quatro terças.

/** Os três turnos do dia, com as horas que cada um cobre. */
export const TURNOS = [
    { chave: 'manha', rotulo: 'Manhã', de: '06:00', ate: '12:00' },
    { chave: 'tarde', rotulo: 'Tarde', de: '12:00', ate: '18:00' },
    { chave: 'noite', rotulo: 'Noite', de: '18:00', ate: '23:59' }
];

export const TURNO_ROTULO = TURNOS.reduce((r, t) => (r[t.chave] = t.rotulo, r), {});

/** Domingo é 0, como em Date.getDay(). */
export const DOW = [
    { dow: 1, curto: '2ª', rotulo: 'Segunda' }, { dow: 2, curto: '3ª', rotulo: 'Terça' },
    { dow: 3, curto: '4ª', rotulo: 'Quarta' }, { dow: 4, curto: '5ª', rotulo: 'Quinta' },
    { dow: 5, curto: '6ª', rotulo: 'Sexta' }, { dow: 6, curto: 'Sáb', rotulo: 'Sábado' },
    { dow: 0, curto: 'Dom', rotulo: 'Domingo' }
];
const DOW_CURTO = DOW.reduce((r, d) => (r[d.dow] = d.curto, r), {});

export const RECORRENCIAS = {
    semanal: 'Toda semana', quinzenal: 'De 15 em 15 dias',
    mensal: 'Uma vez por mês', unica: 'Uma vez só'
};
export const COBRANCAS = {
    mensal: 'Valor fixo por mês', por_turno: 'Valor por turno usado', unica: 'Valor único'
};

const data = iso => new Date(String(iso) + 'T12:00:00');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somarDias = (i, n) => { const d = data(i); d.setDate(d.getDate() + n); return iso(d); };
const ultimoDiaDoMes = mes => {
    const [a, m] = String(mes).split('-').map(Number);
    return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
};

/** Qual turno cobre esta hora. Fora dos três, null. */
export function turnoDaHora(hora) {
    const h = String(hora || '');
    for (const t of TURNOS) if (h >= t.de && h < t.ate) return t.chave;
    return null;
}

/** Os turnos que a locação fecha, já resolvido o integral. */
export function turnosDaLocacao(loc) {
    if (!loc) return [];
    if (loc.tipo === 'integral') {
        return DOW.flatMap(d => TURNOS.map(t => ({ dow: d.dow, turno: t.chave })));
    }
    return (loc.turnos || []).filter(t => t && TURNO_ROTULO[t.turno] && t.dow != null)
        .map(t => ({ dow: Number(t.dow), turno: t.turno }));
}

/** «2ª e 5ª de manhã · 4ª à tarde» — como um humano leria o contrato. */
export function descreveTurnos(loc) {
    if (!loc) return '';
    if (loc.tipo === 'integral') return 'Integral (todos os turnos, todos os dias)';
    const porTurno = new Map();
    for (const t of turnosDaLocacao(loc)) {
        if (!porTurno.has(t.turno)) porTurno.set(t.turno, []);
        porTurno.get(t.turno).push(t.dow);
    }
    if (!porTurno.size) return 'Nenhum turno marcado';
    const ordemDow = DOW.map(d => d.dow);
    return TURNOS.filter(t => porTurno.has(t.chave)).map(t => {
        const dias = porTurno.get(t.chave)
            .sort((a, b) => ordemDow.indexOf(a) - ordemDow.indexOf(b))
            .map(d => DOW_CURTO[d]);
        const lista = dias.length === 1 ? dias[0]
            : `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`;
        return `${lista} ${t.chave === 'manha' ? 'de manhã' : t.chave === 'tarde' ? 'à tarde' : 'à noite'}`;
    }).join(' · ');
}

/** Em que semana do mês cai esta data: 1 para o primeiro dia daquele dow. */
export function semanaDoMes(isoData) {
    return Math.floor((data(isoData).getDate() - 1) / 7) + 1;
}

/** A locação está vigente nesta data? (só a vigência, sem olhar turno) */
export function vigenteEm(loc, isoData) {
    if (!loc || loc.ativo === false) return false;
    if (!loc.data_inicio || isoData < loc.data_inicio) return false;
    if (loc.data_fim && isoData > loc.data_fim) return false;
    return true;
}

/** Esta data cai no ritmo da recorrência? */
function noRitmo(loc, isoData) {
    if (loc.recorrencia === 'unica') return isoData === loc.data_inicio;
    if (loc.recorrencia === 'semanal') return true;
    if (loc.recorrencia === 'quinzenal') {
        const dias = Math.round((data(isoData) - data(loc.data_inicio)) / 86400000);
        return Math.floor(dias / 7) % 2 === 0;
    }
    if (loc.recorrencia === 'mensal') {
        // uma vez por mês quer dizer sempre a mesma posição: se começou na
        // 2ª terça, é a 2ª terça de todo mês — não o dia 8 de todo mês
        return semanaDoMes(isoData) === semanaDoMes(loc.data_inicio);
    }
    return false;
}

/**
 * As ocorrências da locação entre duas datas: [{ data, dow, turno }].
 *
 * É o calendário do aluguel — o que a agenda mostra e o que a conta do mês
 * conta. Uma locação de dois turnos na mesma semana devolve dois itens.
 */
export function ocorrencias(loc, de, ate) {
    const turnos = turnosDaLocacao(loc);
    if (!turnos.length || !loc.data_inicio) return [];
    const inicio = de > loc.data_inicio ? de : loc.data_inicio;
    const fim = loc.data_fim && loc.data_fim < ate ? loc.data_fim : ate;
    const saida = [];
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
        if (!vigenteEm(loc, d) || !noRitmo(loc, d)) continue;
        const dow = data(d).getDay();
        for (const t of turnos) if (t.dow === dow) saida.push({ data: d, dow, turno: t.turno });
        if (saida.length > 5000) break;      // trava de segurança
    }
    return saida;
}

/** As ocorrências dentro de um mês 'YYYY-MM'. */
export const ocorrenciasNoMes = (loc, mes) =>
    ocorrencias(loc, `${mes}-01`, ultimoDiaDoMes(mes));

// ---------------------------------------------------------------------------
// Quem está ocupando a sala
// ---------------------------------------------------------------------------

/** As locações que ocupam este dia, com os turnos de cada uma. */
export function ocupacaoDoDia(locacoes = [], isoData) {
    const saida = [];
    for (const loc of locacoes) {
        const turnos = ocorrencias(loc, isoData, isoData).map(o => o.turno);
        if (turnos.length) saida.push({ locacao: loc, turnos: [...new Set(turnos)] });
    }
    return saida;
}

/**
 * A locação que ocupa esta sala neste dia e hora, se houver.
 *
 * É a pergunta que a agenda faz antes de marcar alguém: aquele horário é da
 * clínica ou já foi alugado?
 */
export function locacaoNoHorario(locacoes = [], { sala_id, data: isoData, hora }) {
    const turno = turnoDaHora(hora);
    if (!turno) return null;
    for (const loc of locacoes) {
        if (sala_id && loc.sala_id && loc.sala_id !== sala_id) continue;
        if (ocorrencias(loc, isoData, isoData).some(o => o.turno === turno)) return loc;
    }
    return null;
}

/**
 * Locações da mesma sala que disputam o mesmo turno no mesmo dia.
 *
 * Alugar duas vezes o mesmo turno é o erro caro deste cadastro: descobrir na
 * hora que duas pessoas têm a chave da mesma sala não dá para consertar.
 */
export function conflitosDeLocacao(nova, existentes = [], { de, ate } = {}) {
    if (!nova || !nova.data_inicio) return [];
    const ini = de || nova.data_inicio;
    const fim = ate || nova.data_fim || somarDias(ini, 365);
    const minhas = new Set(ocorrencias(nova, ini, fim).map(o => `${o.data}|${o.turno}`));
    if (!minhas.size) return [];
    const achados = [];
    for (const outra of existentes) {
        if (!outra || outra.id === nova.id || outra.ativo === false) continue;
        if (String(outra.sala_id || '') !== String(nova.sala_id || '')) continue;
        const choques = ocorrencias(outra, ini, fim)
            .filter(o => minhas.has(`${o.data}|${o.turno}`));
        if (choques.length) achados.push({
            locacao: outra, quantos: choques.length,
            primeiro: choques[0], turnos: [...new Set(choques.map(c => c.turno))]
        });
    }
    return achados;
}

// ---------------------------------------------------------------------------
// A conta do mês
// ---------------------------------------------------------------------------

/**
 * Quanto esta locação vale no mês, e por quê.
 *
 * O "por turno" é o que muda: um mês com cinco terças custa mais que um com
 * quatro, e é por isso que o número de turnos vem junto do valor.
 */
export function valorNoMes(loc, mes) {
    const turnos = ocorrenciasNoMes(loc, mes).length;
    const valor = Number(loc.valor) || 0;
    if (!turnos) return { valor: 0, turnos: 0, base: 'sem uso no mês' };
    if (loc.cobranca === 'por_turno') {
        return { valor: valor * turnos, turnos, base: `${turnos} × ${valor.toFixed(2)}` };
    }
    if (loc.cobranca === 'unica') {
        const doMes = String(loc.data_inicio || '').slice(0, 7) === mes;
        return { valor: doMes ? valor : 0, turnos, base: doMes ? 'valor único' : 'já cobrado no mês de início' };
    }
    return { valor, turnos, base: 'mensal' };
}

/** O quadro do mês: uma linha por locação, mais o total. */
export function resumoDoMes(locacoes = [], mes, salas = []) {
    const nomeSala = id => (salas.find(s => s.id === id) || {}).nome || 'Sem espaço';
    const linhas = locacoes.map(loc => {
        const v = valorNoMes(loc, mes);
        return {
            id: loc.id, locatario: loc.locatario, sala: nomeSala(loc.sala_id),
            sala_id: loc.sala_id, turnos: v.turnos, valor: v.valor, base: v.base,
            descricao: descreveTurnos(loc), recorrencia: RECORRENCIAS[loc.recorrencia] || loc.recorrencia,
            vencimento: loc.dia_vencimento || null, ativo: loc.ativo !== false
        };
    }).filter(l => l.turnos || l.valor);
    linhas.sort((a, b) => b.valor - a.valor || String(a.locatario).localeCompare(String(b.locatario)));
    return {
        linhas,
        total: linhas.reduce((s, l) => s + l.valor, 0),
        turnos: linhas.reduce((s, l) => s + l.turnos, 0),
        locatarios: new Set(linhas.map(l => l.locatario)).size
    };
}

/**
 * Quanto de cada sala está alugado no mês, em turnos.
 *
 * A pergunta de gestão por trás: sobra espaço para vender? O denominador é
 * quantos turnos aquela sala tem no mês — 3 por dia, todos os dias.
 */
export function ocupacaoDasSalas(locacoes = [], mes, salas = []) {
    const [a, m] = String(mes).split('-').map(Number);
    const diasNoMes = new Date(a, m, 0).getDate();
    const total = diasNoMes * TURNOS.length;
    return salas.map(sala => {
        const usados = new Set();
        for (const loc of locacoes.filter(l => l.sala_id === sala.id)) {
            for (const o of ocorrenciasNoMes(loc, mes)) usados.add(`${o.data}|${o.turno}`);
        }
        return {
            sala_id: sala.id, nome: sala.nome, turnos: usados.size, total,
            percentual: total ? Math.round((usados.size / total) * 1000) / 10 : 0
        };
    }).sort((x, y) => y.turnos - x.turnos);
}
