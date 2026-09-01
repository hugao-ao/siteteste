// argos-validacao.js — o que o profissional confere antes de receber
// ==================================================================
// O repasse do mês é uma conta feita pelo sistema, e o profissional só
// consegue conferi-la se enxergar o que ela conta: sessão por sessão, com
// data, paciente, frequência e por que aquela sessão é dele.
//
// "Dele" é mais largo que "ele atendeu". Um paciente do profissional pode
// ter sido atendido por outra pessoa numa semana — cobertura, troca de
// horário, o que for — e o repasse continuar vindo para ele, porque quem
// responde pelo processo é ele. O contrário também acontece: ele cobriu
// alguém e aquela sessão, de um paciente que não é seu, gera repasse a ele.
//
// As duas coisas entram na lista, com o motivo escrito. É a lista inteira
// que o profissional valida — confirmando o que reconhece e contestando o
// que não reconhece, sem precisar mexer na frequência de ninguém.

import { repassesDe, fechamentoPaciente, fimDoMes, hojeISO } from './argos-recorrencia.js';

/** Por que esta sessão está na lista do profissional. */
export const MOTIVOS = {
    atendeu: { rotulo: 'Atendeu', icone: '🧑‍⚕️',
        ajuda: 'A sessão está registrada no nome dele.' },
    responsavel: { rotulo: 'Paciente dele, outro atendeu', icone: '🤝',
        ajuda: 'O repasse é dele pela dinâmica, mas quem atendeu foi outra pessoa.' },
    cobriu: { rotulo: 'Cobriu outro profissional', icone: '🔁',
        ajuda: 'A sessão é de um paciente de outro, e o repasse daquela sessão foi redirecionado para ele.' }
};

export const SITUACOES = {
    confirmada: { rotulo: 'Confirmada', icone: '✔', cor: '#22c55e' },
    contestada: { rotulo: 'Contestada', icone: '⚠', cor: '#ef4444' }
};

/** Frequências que entram na conta do mês. */
const CONTABILIZA = new Set(['ok', 'fc']);

/**
 * Todas as sessões do mês que dizem respeito a este profissional.
 *
 * Devolve [{ sessao, paciente, motivo, atendidoPor, contabiliza, valor,
 *            validacao }], ordenado por data.
 *
 * `valor` é a parte que aquela sessão põe no repasse dele — o número que ele
 * está conferindo. Sessão que não contabiliza aparece do mesmo jeito, com
 * valor zero: o profissional precisa ver a falta que registraram no nome
 * dele tanto quanto a presença.
 */
export function atendimentosDoProfissional({ profissional_id, mes, pacientes = [],
    dinamicas = [], sessoes = [], profissionais = [], validacoes = [] } = {}) {
    if (!profissional_id || !mes) return [];

    const de = `${mes}-01`, ate = fimDoMes(mes);
    const hoje = hojeISO();
    const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
    const validacaoDe = id => validacoes.find(v =>
        v.sessao_id === id && v.profissional_id === profissional_id) || null;

    const linhas = [];

    for (const p of pacientes) {
        const dinsP = dinamicas.filter(d => d.paciente_id === p.id);
        const sessP = sessoes.filter(s => s.paciente_id === p.id
            && s.data >= de && s.data <= ate);
        if (!sessP.length) continue;

        // quanto cada sessão daquela dinâmica vale para este profissional,
        // pela mesma conta que o fechamento faz — nada de regra paralela
        const fech = fechamentoPaciente(p, dinsP, sessoes.filter(s => s.paciente_id === p.id), mes);
        const valorPorDinamica = new Map();
        for (const pd of (fech.porDinamica || [])) {
            const meu = (pd.repasses || []).find(r => r.profissional_id === profissional_id);
            const contadas = (fech.sessoes || []).filter(s => s.dinamica_ref === pd.dinamica_id
                && (CONTABILIZA.has(s.status) || (s.status === '??' && s.data >= hoje)));
            const pool = (pd.repasses || []).reduce((t, r) => t + (Number(r.valor) || 0), 0);
            valorPorDinamica.set(pd.dinamica_id, {
                // a minha parte por sessão, e a parte de TODOS os profissionais
                // por sessão: quem cobre uma sessão leva a segunda, não a primeira
                minha: meu && contadas.length ? meu.valor / contadas.length : 0,
                pool: contadas.length ? pool / contadas.length : 0
            });
        }

        for (const s of sessP) {
            const din = dinsP.find(d => d.id === (s.dinamica_ref || s.dinamica_id));
            const donos = din ? repassesDe(din).map(r => r.profissional_id) : [];
            const redirecionada = s.repasse_profissional_id || null;

            let motivo = null;
            if (redirecionada === profissional_id) motivo = 'cobriu';
            else if (redirecionada && donos.includes(profissional_id)) motivo = 'responsavel';
            else if (s.profissional_id === profissional_id) motivo = 'atendeu';
            else if (donos.includes(profissional_id)) motivo = 'responsavel';
            if (!motivo) continue;

            // uma sessão redirecionada deixa de pagar o dono e passa a pagar
            // quem cobriu: a lista mostra as duas pontas, com o valor certo
            const v = valorPorDinamica.get(s.dinamica_ref || s.dinamica_id) || { minha: 0, pool: 0 };
            const contabiliza = CONTABILIZA.has(s.status);
            const meu = redirecionada
                ? (redirecionada === profissional_id ? v.pool : 0)
                : v.minha;

            linhas.push({
                sessao: s, paciente: p, motivo,
                atendidoPor: s.profissional_id ? nomeProf(s.profissional_id) : '—',
                data: s.data, hora: s.hora || '', status: s.status || '??',
                contabiliza, valor: contabiliza ? meu : 0,
                validacao: validacaoDe(s.id)
            });
        }
    }

    linhas.sort((a, b) => String(a.data).localeCompare(String(b.data))
        || String(a.hora).localeCompare(String(b.hora))
        || String(a.paciente.nome).localeCompare(String(b.paciente.nome)));
    return linhas;
}

/** O placar da conferência: quanto já foi olhado e quanto falta. */
export function resumoDaValidacao(linhas = []) {
    const r = {
        total: linhas.length, confirmadas: 0, contestadas: 0, pendentes: 0,
        contabilizadas: 0, valor: 0, valorContestado: 0,
        porMotivo: { atendeu: 0, responsavel: 0, cobriu: 0 }
    };
    for (const l of linhas) {
        r.porMotivo[l.motivo] = (r.porMotivo[l.motivo] || 0) + 1;
        if (l.contabiliza) { r.contabilizadas++; r.valor += l.valor; }
        const sit = l.validacao && l.validacao.situacao;
        if (sit === 'confirmada') r.confirmadas++;
        else if (sit === 'contestada') { r.contestadas++; r.valorContestado += l.valor; }
        else r.pendentes++;
    }
    return r;
}

/** Frase do estado da conferência, para o topo do relatório. */
export function fraseDaValidacao(resumo) {
    if (!resumo.total) return 'Nenhuma sessão captada para este profissional neste mês.';
    if (resumo.pendentes === resumo.total) return `${resumo.total} sessão(ões) a conferir.`;
    const partes = [`${resumo.confirmadas} confirmada(s)`];
    if (resumo.contestadas) partes.push(`${resumo.contestadas} contestada(s)`);
    if (resumo.pendentes) partes.push(`${resumo.pendentes} ainda sem conferir`);
    return `${partes.join(', ')} de ${resumo.total}.`;
}

/**
 * As linhas que o filtro da tela deixa passar.
 *
 * filtro — 'todas' | 'pendentes' | 'confirmadas' | 'contestadas' | 'contabilizadas'
 */
export function filtrar(linhas = [], filtro = 'todas', busca = '') {
    const termo = String(busca || '').toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').trim();
    return linhas.filter(l => {
        const sit = l.validacao && l.validacao.situacao;
        if (filtro === 'pendentes' && sit) return false;
        if (filtro === 'confirmadas' && sit !== 'confirmada') return false;
        if (filtro === 'contestadas' && sit !== 'contestada') return false;
        if (filtro === 'contabilizadas' && !l.contabiliza) return false;
        if (!termo) return true;
        const alvo = `${l.paciente.nome} ${l.atendidoPor}`.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return alvo.includes(termo);
    });
}

/** O texto que o profissional recebe para conferir fora do sistema. */
export function textoDoRelatorio({ profissional, mes, linhas = [], resumo,
    formataBR, formataMoeda }) {
    const cab = `*Atendimentos de ${profissional} — ${mes.slice(5)}/${mes.slice(0, 4)}*`;
    const corpo = linhas.map(l => {
        const sit = l.validacao && l.validacao.situacao;
        const marca = sit === 'confirmada' ? '✔' : sit === 'contestada' ? '⚠' : '·';
        return `${marca} ${formataBR(l.data)} ${l.hora} — ${l.paciente.nome}`
            + ` (${l.status.toUpperCase()})`
            + (l.motivo !== 'atendeu' ? ` [${MOTIVOS[l.motivo].rotulo}: ${l.atendidoPor}]` : '')
            + (l.valor ? ` — ${formataMoeda(l.valor)}` : '');
    }).join('\n');
    const pe = `\n_${resumo.contabilizadas} sessão(ões) contabilizada(s) · ${formataMoeda(resumo.valor)}_`
        + (resumo.contestadas ? `\n_⚠ ${resumo.contestadas} contestada(s)_` : '');
    return `${cab}\n\n${corpo || '(nenhuma sessão)'}\n${pe}`;
}
