// argos-repasses.js — o acerto do mês com retenção por inadimplência
// ==================================================================
// A clínica repassa como se todo mundo já tivesse pago no começo do mês, e
// depois acerta a diferença:
//
//   acerto = produção do mês  −  o que fica retido  +  o que é liberado
//
// Fica RETIDO o repasse referente a paciente que ainda não pagou um mês já
// vencido. É LIBERADO quando esse paciente regulariza — o valor volta no
// acerto do mês em que a regularização aconteceu, não no mês de origem.
//
// Cada valor retido continua existindo como saldo a receber do profissional
// até ser liberado. É por isso que a retenção é uma linha guardada, e não
// uma conta refeita toda vez: o profissional precisa saber o que a clínica
// está devendo a ele e por causa de quem.

import { producaoDoMes } from './argos-producao.js';
import { formataMoeda } from './argos-recorrencia.js';
import { MESES_EXTENSO, mesBR } from './argos-cobranca.js';

/** Mês anterior a 'YYYY-MM'. */
export function mesAnterior(mes) {
    let [a, m] = String(mes || '').split('-').map(Number);
    m -= 1;
    if (m < 1) { m = 12; a -= 1; }
    return `${a}-${String(m).padStart(2, '0')}`;
}

/** Todos os meses de 'de' até 'ate', inclusive. */
export function mesesAte(de, ate) {
    const saida = [];
    let [a, m] = String(de).split('-').map(Number);
    const [aF, mF] = String(ate).split('-').map(Number);
    while (a < aF || (a === aF && m <= mF)) {
        saida.push(`${a}-${String(m).padStart(2, '0')}`);
        m++; if (m > 12) { m = 1; a++; }
        if (saida.length > 240) break;
    }
    return saida;
}

/**
 * Quanto cada paciente ainda deve, mês a mês, até o mês informado.
 * Devolve Map(paciente_id → [{ mes, producao, pago, aberto }]).
 */
export function abertoPorPaciente({ pacientes = [], dinamicas = [], sessoes = [],
    alocacoes = [], ate } = {}) {
    const mapa = new Map();
    for (const p of pacientes) {
        const dins = dinamicas.filter(d => d.paciente_id === p.id);
        const sess = sessoes.filter(s => s.paciente_id === p.id);
        const pagos = alocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.vinculo_id === p.id);
        if (!dins.length && !sess.length && !pagos.length) continue;
        const inicios = [...sess.map(s => s.data), ...dins.map(d => d.data_inicio),
            ...pagos.map(a => a.mes_ref + '-01')].filter(Boolean).sort();
        if (!inicios.length) continue;
        const linhas = [];
        for (const mes of mesesAte(inicios[0].slice(0, 7), ate)) {
            const f = fechamentoDoMes(p, dins, sess, mes);
            const pago = pagos.filter(a => a.mes_ref === mes)
                .reduce((s, a) => s + (Number(a.valor) || 0), 0);
            const aberto = f.valor - pago;
            if (f.valor > 0 || pago > 0) linhas.push({ mes, producao: f.valor, pago, aberto });
        }
        if (linhas.length) mapa.set(p.id, linhas);
    }
    return mapa;
}

// injetado para o motor poder ser testado sem arrastar o de recorrência
let fechamentoDoMes = () => ({ valor: 0 });
export function usarFechamento(fn) { fechamentoDoMes = fn; }

/**
 * O que deveria ficar retido no acerto de `mes`: o repasse dos pacientes
 * que não pagaram algum mês já vencido.
 *
 * Devolve [{ profissional_id, paciente_id, mes_producao, valor, motivo }].
 */
export function retencoesSugeridas({ producaoPorMes = {}, aberto = new Map(),
    pacientes = [], mes, tolerancia = 0.01 } = {}) {
    const nome = id => (pacientes.find(p => p.id === id) || {}).nome || 'paciente';
    const limite = mesAnterior(mes);
    const saida = [];
    for (const [pid, linhas] of aberto) {
        for (const l of linhas) {
            if (l.mes > limite) continue;          // mês ainda não venceu
            if (l.aberto <= tolerancia) continue;  // pagou
            const prod = producaoPorMes[l.mes];
            if (!prod) continue;
            // fatia de cada profissional na produção daquele paciente naquele mês
            for (const c of prod.porProfissional) {
                const doPaciente = (c.detalhePorPaciente || {})[pid] || 0;
                if (doPaciente <= tolerancia) continue;
                const proporcao = l.producao > 0 ? Math.min(1, l.aberto / l.producao) : 1;
                const valor = doPaciente * proporcao;
                if (valor <= tolerancia) continue;
                saida.push({
                    profissional_id: c.profissional.id, paciente_id: pid,
                    mes_producao: l.mes, valor,
                    motivo: `${nome(pid)} não pagou ${mesBR(l.mes)}`
                });
            }
        }
    }
    return saida;
}

/**
 * Fecha a conta do mês para um profissional.
 * `retencoes` são as linhas já guardadas: as retidas NESTE mês saem, as
 * liberadas NESTE mês entram, e as retidas em meses anteriores que ainda
 * não voltaram formam o saldo a receber.
 */
export function acertoDoMes({ profissional, producao = 0, fixo = 0,
    retencoes = [], mes } = {}) {
    const retidasAgora = retencoes.filter(r => r.retido_em === mes && r.status === 'retido');
    const liberadasAgora = retencoes.filter(r => r.liberado_em === mes && r.status === 'liberado');
    const aindaRetidas = retencoes.filter(r => r.status === 'retido');

    const soma = xs => xs.reduce((s, r) => s + (Number(r.valor) || 0), 0);
    const retido = soma(retidasAgora);
    const liberado = soma(liberadasAgora);
    return {
        profissional, mes, producao, fixo,
        retido, liberado,
        total: producao + fixo - retido + liberado,
        retidasAgora, liberadasAgora, aindaRetidas,
        saldoAReceber: soma(aindaRetidas)
    };
}

/**
 * A mensagem do acerto, no formato que a clínica já usa com os
 * profissionais — produção, o que saiu, o que voltou, o acerto final e o
 * acumulado que continua aguardando.
 */
export function mensagemAcerto(acerto, { nomePaciente = () => 'paciente' } = {}) {
    const [ano, m] = String(acerto.mes).split('-');
    const mesNome = MESES_EXTENSO[Number(m) - 1] || '';
    const bonito = `${mesNome[0]}${mesNome.slice(1).toLowerCase()}/${String(ano).slice(2)}`;
    const linhas = [];

    linhas.push(`Produção de ${bonito}:`);
    linhas.push(formataMoeda(acerto.producao + acerto.fixo));
    linhas.push('');

    if (acerto.retidasAgora.length) {
        linhas.push(`*MENOS*: ${formataMoeda(acerto.retido)}`);
        for (const r of acerto.retidasAgora) {
            linhas.push(`-${formataMoeda(r.valor)} -> ${r.motivo || nomePaciente(r.paciente_id)}`
                + `${r.observacao ? ` (${r.observacao})` : ''};`);
        }
    } else {
        linhas.push('Sem *MENOS*');
    }
    linhas.push('');

    if (acerto.liberadasAgora.length) {
        linhas.push(`*MAIS*: ${formataMoeda(acerto.liberado)}`);
        for (const r of acerto.liberadasAgora) {
            linhas.push(`+${formataMoeda(r.valor)} -> ${nomePaciente(r.paciente_id)} `
                + `regularizou ${mesBR(r.mes_producao)};`);
        }
    } else {
        linhas.push('Sem *MAIS*');
    }
    linhas.push('');

    linhas.push(`Acerto Final ${bonito}:`);
    linhas.push(formataMoeda(acerto.total));

    if (acerto.aindaRetidas.length) {
        linhas.push('');
        linhas.push(`Totais acumulados aguardando pagamento ${formataMoeda(acerto.saldoAReceber)}`);
        for (const g of agruparPorPaciente(acerto.aindaRetidas)) {
            linhas.push(`-${nomePaciente(g.paciente_id)} (${g.meses.map(mesCurto).join(', ')}) = `
                + formataMoeda(g.valor));
        }
    }
    return linhas.join('\n');
}

/** "2026-07" → "Jul/26", como a mensagem escreve. */
export function mesCurto(mes) {
    const [ano, m] = String(mes).split('-');
    const n = MESES_EXTENSO[Number(m) - 1] || '';
    return `${n[0]}${n.slice(1, 3).toLowerCase()}/${String(ano).slice(2)}`;
}

/** Junta as retenções do mesmo paciente numa linha só do acumulado. */
export function agruparPorPaciente(retencoes) {
    const mapa = new Map();
    for (const r of retencoes) {
        const k = r.paciente_id || 'sem-paciente';
        let g = mapa.get(k);
        if (!g) { g = { paciente_id: r.paciente_id, meses: [], valor: 0 }; mapa.set(k, g); }
        if (!g.meses.includes(r.mes_producao)) g.meses.push(r.mes_producao);
        g.valor += Number(r.valor) || 0;
    }
    return [...mapa.values()].map(g => ({ ...g, meses: g.meses.sort() }))
        .sort((a, b) => b.valor - a.valor);
}

export { producaoDoMes };
