// argos-producao.js — produção, despesa e assiduidade dos profissionais
// =====================================================================
// Duas contas que andam juntas mas não se misturam:
//
//   • O DINHEIRO vem da frequência do PACIENTE. Se o paciente veio, a sessão
//     é cobrada e o valor vai para quem é responsável por ela na dinâmica —
//     não importa quem conduziu o grupo naquele dia.
//   • A ASSIDUIDADE vem da frequência do PROFISSIONAL, que é registrada à
//     parte e não mexe em valor nenhum.
//
// A ponte entre as duas é a exceção: uma sessão pode ser marcada para ser
// paga a quem de fato atendeu (argos_sessoes.repasse_profissional_id). Aí, e
// só aí, o dinheiro daquela sessão muda de dono.

import { fechamentoPaciente, repassesDoValor, repassesDe, fimDoMes, hojeISO } from './argos-recorrencia.js';

/** Como cada status do profissional aparece e o que ele significa. */
export const STATUS_PROF = {
    '??': { label: 'A preencher', cor: '#94a3b8', conta: false, presente: false,
            desc: 'Ainda não foi informado quem conduziu.' },
    ok:   { label: 'Presente',    cor: '#22c55e', conta: true,  presente: true,
            desc: 'Conduziu o atendimento.' },
    fj:   { label: 'Falta justificada', cor: '#f59e0b', conta: true, presente: false,
            desc: 'Faltou com justificativa.' },
    f:    { label: 'Falta',       cor: '#ef4444', conta: true,  presente: false,
            desc: 'Faltou sem justificativa.' },
    nc:   { label: 'Não houve',   cor: '#64748b', conta: false, presente: false,
            desc: 'Não houve atendimento neste horário.' }
};

export const ORDEM_STATUS_PROF = ['??', 'ok', 'fj', 'f', 'nc'];

/** Chave do horário: é por ela que a presença encontra a sessão. */
export const chaveSlot = (data, hora, dinamicaRef) =>
    `${data}|${hora}|${dinamicaRef || ''}`;

/** Profissionais responsáveis por uma dinâmica (sem repetir). */
export function responsaveisDe(d) {
    const ids = repassesDe(d).map(r => r.profissional_id).filter(Boolean);
    if (!ids.length && d.profissional_id) ids.push(d.profissional_id);
    return [...new Set(ids)];
}

/**
 * Valor de UMA sessão dentro do mês daquela dinâmica.
 * Por sessão é direto; fixo mensal e pacote são rateados pelas sessões
 * cobradas do mês, que é a única divisão honesta quando o acordo não é
 * por sessão.
 */
export function valorDaSessao(valorDoMes, sessoesCobradas) {
    return sessoesCobradas > 0 ? valorDoMes / sessoesCobradas : 0;
}

/**
 * Produção do mês, profissional por profissional.
 *
 * pacientes, dinamicas, sessoes, profissionais — as tabelas inteiras
 * presencas — linhas de argos_prof_frequencia (só as do mês bastam)
 * notaFator — Map(paciente_id → fator) de fatorNFDoMes: mês com nota fiscal
 *             repassa sobre o total menos os 10% da nota
 * cobrado   — Map(paciente_id → valor) de cobradoPorPaciente: cobrança
 *             ajustada/enviada no mês; o repasse acompanha esse valor
 *
 * Devolve { porProfissional, faturamento, totalRepasses, clinica, substituicoes }.
 */
export function producaoDoMes({ pacientes = [], dinamicas = [], sessoes = [],
    profissionais = [], presencas = [], mes, notaFator = null, cobrado = null } = {}) {
    const de = mes + '-01';
    const ate = fimDoMes(mes);
    const hoje = hojeISO();

    const conta = {};
    // aceita id solto: uma dinâmica pode citar profissional que saiu do cadastro
    const zero = id => (conta[id] = conta[id] || {
        profissional: profissionais.find(p => p.id === id) || { id, nome: '—' },
        fixo: 0, producao: 0, recebidoDeOutros: 0, cedidoAOutros: 0,
        slots: 0, contagens: { '??': 0, ok: 0, fj: 0, f: 0, nc: 0 },
        coberturas: [], cobertoPor: [], detalhePorPaciente: {}
    });
    profissionais.forEach(pr => zero(pr.id));
    // de quem veio cada real da produção — é o que permite reter o repasse de
    // um paciente específico sem recalcular o mês inteiro
    const somaPaciente = (id, pacienteId, valor) => {
        const d = conta[id].detalhePorPaciente;
        d[pacienteId] = (d[pacienteId] || 0) + valor;
    };
    const somaCobertura = (lista, chave, id, valor) => {
        let item = lista.find(x => x[chave] === id);
        if (!item) { item = { [chave]: id, sessoes: 0, valor: 0 }; lista.push(item); }
        item.sessoes++; item.valor += valor;
    };

    let faturamento = 0;
    const substituicoes = [];

    for (const p of pacientes) {
        const dinsP = dinamicas.filter(d => d.paciente_id === p.id);
        const sessP = sessoes.filter(s => s.paciente_id === p.id);
        const fech = fechamentoPaciente(p, dinsP, sessP, mes);
        // cobrança ajustada/enviada manda no que o mês vale — e o repasse
        // é proporcional a ela; a nota fiscal tira os 10% dela por cima
        const vCobrado = cobrado && cobrado.has(p.id) ? cobrado.get(p.id) : null;
        const fatorAjuste = vCobrado != null && fech.valor > 0 ? vCobrado / fech.valor : 1;
        faturamento += vCobrado != null ? vCobrado : fech.valor;
        const fator = (((notaFator && notaFator.get(p.id)) ?? 1)) * fatorAjuste;

        for (const pd of (fech.porDinamica || [])) {
            const repasses = (pd.repasses || []).map(r => ({ ...r, valor: r.valor * fator }));
            if (!repasses.length) continue;
            const d = dinsP.find(x => x.id === pd.dinamica_id);

            // sessões daquela dinâmica que entraram no valor do mês
            const doMes = fech.sessoes.filter(s => s.dinamica_ref === pd.dinamica_id
                && (s.status === 'ok' || s.status === 'fc' || (s.status === '??' && s.data >= hoje)));
            const redirecionadas = doMes.filter(s => s.repasse_profissional_id);

            if (!redirecionadas.length) {
                repasses.forEach(r => {
                    zero(r.profissional_id);
                    conta[r.profissional_id].producao += r.valor;
                    somaPaciente(r.profissional_id, p.id, r.valor);
                });
                continue;
            }

            // parte dos profissionais que sai de cada sessão redirecionada
            const somaProfs = repasses.reduce((s, r) => s + r.valor, 0);
            const porSessao = valorDaSessao(somaProfs, doMes.length);
            const desviado = porSessao * redirecionadas.length;
            const sobra = somaProfs - desviado;

            // o que sobra continua sendo dividido na proporção da dinâmica
            repasses.forEach(r => {
                const fatia = somaProfs > 0 ? r.valor / somaProfs : 0;
                zero(r.profissional_id);
                conta[r.profissional_id].producao += sobra * fatia;
                somaPaciente(r.profissional_id, p.id, sobra * fatia);
                conta[r.profissional_id].cedidoAOutros += desviado * fatia;
            });

            for (const s of redirecionadas) {
                const quem = s.repasse_profissional_id;
                zero(quem);
                conta[quem].producao += porSessao;
                somaPaciente(quem, p.id, porSessao);
                conta[quem].recebidoDeOutros += porSessao;
                const donos = repasses.map(r => r.profissional_id).filter(id => id !== quem);
                donos.forEach(dono => {
                    const fatia = somaProfs > 0
                        ? (repasses.find(r => r.profissional_id === dono).valor / somaProfs) : 0;
                    somaCobertura(conta[quem].coberturas, 'de', dono, porSessao * fatia);
                    zero(dono);
                    somaCobertura(conta[dono].cobertoPor, 'por', quem, porSessao * fatia);
                });
                substituicoes.push({
                    paciente_id: p.id, data: s.data, hora: s.hora,
                    dinamica_id: pd.dinamica_id, rotulo: d ? d.rotulo : '',
                    recebeu: quem, donos, valor: porSessao, motivo: s.repasse_motivo || ''
                });
            }
        }
    }

    // ---- assiduidade: slots previstos × o que foi marcado ----
    const marcadas = new Map();
    for (const f of presencas) {
        if (f.data < de || f.data > ate) continue;
        marcadas.set(`${f.profissional_id}|${chaveSlot(f.data, f.hora, f.dinamica_ref)}`, f);
    }
    const slotsVistos = new Set();
    for (const p of pacientes) {
        const dinsP = dinamicas.filter(d => d.paciente_id === p.id);
        const fech = fechamentoPaciente(p, dinsP, sessoes.filter(s => s.paciente_id === p.id), mes);
        for (const s of fech.sessoes) {
            const d = dinsP.find(x => x.id === s.dinamica_ref);
            const donos = d ? responsaveisDe(d) : (s.profissional_id ? [s.profissional_id] : []);
            for (const id of donos) {
                const chave = `${id}|${chaveSlot(s.data, s.hora, s.dinamica_ref)}`;
                if (slotsVistos.has(chave)) continue;   // grupo: um slot, vários pacientes
                slotsVistos.add(chave);
                zero(id);
                const marcada = marcadas.get(chave);
                const st = marcada ? marcada.status : '??';
                conta[id].slots++;
                conta[id].contagens[st] = (conta[id].contagens[st] || 0) + 1;
            }
        }
    }
    // presenças de quem entrou como substituto não têm slot previsto, mas contam
    for (const [chave, f] of marcadas) {
        if (slotsVistos.has(chave)) continue;
        zero(f.profissional_id);
        conta[f.profissional_id].slots++;
        conta[f.profissional_id].contagens[f.status] =
            (conta[f.profissional_id].contagens[f.status] || 0) + 1;
    }

    // ---- remuneração fixa ----
    for (const pr of profissionais) {
        const temFixo = pr.remuneracao_tipo === 'fixo' || pr.remuneracao_tipo === 'producao_fixo';
        conta[pr.id].fixo = temFixo ? (Number(pr.valor_fixo_mensal) || 0) : 0;
        if (pr.remuneracao_tipo === 'fixo') {
            // remuneração puramente fixa não recebe por produção
            conta[pr.id].producao = 0;
            conta[pr.id].recebidoDeOutros = 0;
            conta[pr.id].detalhePorPaciente = {};
        }
    }

    const porProfissional = Object.values(conta).map(c => {
        const marcados = c.slots - c.contagens['??'] - c.contagens.nc;
        return {
            ...c,
            total: c.fixo + c.producao,
            assiduidade: marcados > 0 ? c.contagens.ok / marcados : null,
            faltas: c.contagens.f + c.contagens.fj,
            aPreencher: c.contagens['??']
        };
    }).filter(c => c.total > 0 || c.slots > 0)
      .sort((a, b) => b.total - a.total);

    const totalRepasses = porProfissional.reduce((s, c) => s + c.total, 0);
    return { porProfissional, faturamento, totalRepasses,
        clinica: faturamento - totalRepasses, substituicoes };
}
