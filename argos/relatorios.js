// relatorios.js — Relatório semanal e relatório geral da clínica
// ===============================================================
// Nada aqui é conta nova: fechamento, produção, em aberto, retenções e
// despesas vêm dos mesmos motores das outras páginas. Esta página só
// escolhe o período, junta e escreve — em documento A4 ou em texto.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    formataMoeda, formataBR, hojeISO, somarDias, fimDoMes, fechamentoPaciente, definirRepassePadrao,
    mesclarSessoes, aplicarFimDeProcesso, definirMesesCongelados, STATUS_SESSAO
} from './argos-recorrencia.js';
import { producaoDoMes, STATUS_PROF, ORDEM_STATUS_PROF } from './argos-producao.js';
import { mesBR, fatorNFDoMes } from './argos-cobranca.js';
import { cobradoPorPaciente, valorDoMes } from './argos-fechamento.js';
import { usarFechamento, abertoPorPaciente, retencoesSugeridas, mesAnterior, mesCurto, agruparPorPaciente } from './argos-repasses.js';
import { pacientesDoProfissional } from './argos-escopo.js';
import { pendenciasDeEvolucao, contarPendenciasEv, emAtendimento, TIPOS_PENDENCIA_EV } from './argos-evolucao-pendencias.js';
import { documento, secao, ficha, abrirDocumento } from './argos-relatorio.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true, escopo: { geral: true } };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], presencas = [], ajustes = [], envios = [];
let notas = [], notaPend = [], notasMes = [], alocacoes = [], despesas = [], retencoes = [], saldos = [];
let avaliacoes = [], comAnamnese = new Set(), grupos = [], grupoMembros = [], grupoProfs = [];
const el = id => document.getElementById(id);
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '—';
const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
const fechCache = new Map(), prodCache = new Map();
const R$ = v => formataMoeda(v || 0);
const pct = x => x == null ? '—' : Math.round(x * 100) + '%';

usarFechamento((p, dins, sess, mes) => ({ valor: cobradoDe(p, mes) }));
const baixasComoRecebido = () => ajustes.filter(a => Number(a.baixa_valor) > 0)
    .map(a => ({ vinculo_tipo: 'paciente', vinculo_id: a.paciente_id, mes_ref: a.mes, valor: Number(a.baixa_valor) }));

function fechDe(p, mes) {
    const k = p.id + '|' + mes;
    if (!fechCache.has(k)) fechCache.set(k, fechamentoPaciente(p, dinamicas.filter(d => d.paciente_id === p.id), sessoes.filter(s => s.paciente_id === p.id), mes));
    return fechCache.get(k);
}
function cobradoDe(p, mes) {
    const ajuste = ajustes.find(a => a.paciente_id === p.id && a.mes === mes) || null;
    return Number(valorDoMes({ fech: fechDe(p, mes), ajuste }).valor) || 0;
}
function producaoDe(mes) {
    if (!prodCache.has(mes)) prodCache.set(mes, producaoDoMes({
        pacientes, dinamicas, sessoes, profissionais, presencas, mes,
        notaFator: fatorNFDoMes({ pacientes, dinamicas, excecoes: notasMes, mes }),
        cobrado: cobradoPorPaciente(ajustes, mes)
    }));
    return prodCache.get(mes);
}
function despesasDoMes(mes) {
    const de = mes + '-01', ate = fimDoMes(mes), itens = [];
    for (const d of despesas) {
        if (d.sistema || d.ativo === false || !d.data_inicio) continue;
        const ini = d.data_inicio, fim = d.fim_data || null, v = Number(d.valor) || 0;
        if (d.recorrencia === 'unica') { if (ini >= de && ini <= ate) itens.push({ nome: d.nome, valor: v }); }
        else if (d.recorrencia === 'mensal') { if (ini <= ate && (!fim || fim >= de)) itens.push({ nome: d.nome, valor: v }); }
        else if (d.recorrencia === 'anual') { if (ini.slice(5, 7) === mes.slice(5, 7) && ini <= ate && (!fim || fim >= de)) itens.push({ nome: d.nome, valor: v }); }
        else if (d.recorrencia === 'semanal') {
            const dow = new Date(ini + 'T12:00').getDay(); let n = 0;
            for (let dt = new Date(de + 'T12:00'); ; dt.setDate(dt.getDate() + 1)) {
                const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                if (iso > ate) break;
                if (dt.getDay() === dow && iso >= ini && (!fim || iso <= fim)) n++;
            }
            if (n) itens.push({ nome: `${d.nome} (${n}×)`, valor: v * n });
        }
    }
    return itens.sort((a, b) => b.valor - a.valor);
}
function sessoesEntre(de, ate) {
    const c = aplicarFimDeProcesso(dinamicas, sessoes, pacientes);
    const dins = c.dinamicas.map(d => d.ativo === false ? { ...d, ativo: true } : d);
    return mesclarSessoes(dins, c.sessoes, de, ate);
}
function contagemSessoes(lista, hoje) {
    const c = { ok: 0, fc: 0, fj: 0, nc: 0, pend: 0, semValidar: 0, propostas: 0, total: lista.length };
    for (const s of lista) {
        if (s.status === '??') { if (s.data <= hoje) c.pend++; }
        else c[s.status]++;
        if (s.id && s.status !== '??' && !s.validado_em) c.semValidar++;
        if (s.status_proposto && !s.validado_em) c.propostas++;
    }
    c.contabilizadas = c.ok + c.fc;
    return c;
}
function emAbertoAte(mes) {
    const aberto = abertoPorPaciente({ pacientes, dinamicas, sessoes, alocacoes: alocacoes.concat(baixasComoRecebido()), ate: mes });
    const lista = [];
    for (const [pid, linhas] of aberto) {
        const abertas = linhas.filter(l => l.mes <= mes && l.aberto > 0.009);
        const saldo = abertas.reduce((s, l) => s + l.aberto, 0);
        if (saldo > 0.009) lista.push({ paciente_id: pid, nome: nomePac(pid), saldo, meses: abertas.map(l => l.mes) });
    }
    return { lista: lista.sort((a, b) => b.saldo - a.saldo), total: lista.reduce((s, x) => s + x.saldo, 0), aberto };
}
function saldoEm(data) {
    const ordem = saldos.filter(s => s.data <= data).sort((a, b) => b.data.localeCompare(a.data));
    return { atual: ordem[0] || null, anterior: ordem[1] || null };
}
function evolucoesPendentes(hoje) {
    const ativos = emAtendimento(pacientes, hoje);
    const dinsAtivas = dinamicas.filter(d => d.ativo !== false);
    const porPac = new Map();
    for (const pr of profissionais) {
        for (const id of pacientesDoProfissional(pr.id, { dinamicas: dinsAtivas, grupos: grupos.filter(g => g.ativo !== false), grupoMembros, grupoProfs })) {
            if (!porPac.has(id)) porPac.set(id, []); porPac.get(id).push(pr.id);
        }
    }
    return pendenciasDeEvolucao({ pacientes: ativos, avaliacoes, comAnamnese, hoje }).map(i => ({ ...i, profs: porPac.get(i.paciente.id) || [] }));
}

// ---------------------------------------------------------------- tabelas do documento
const CSS_TAB = `<style>
.tab{width:100%;border-collapse:collapse;font-size:9.2pt;margin:6px 0 10px}
.tab th,.tab td{border-bottom:1px solid #ccc;padding:3px 5px;text-align:left;vertical-align:top}
.tab th{background:#f1f1f1;font-weight:700}.tab td.n,.tab th.n{text-align:right;white-space:nowrap}
.tab tr.tot td{font-weight:700;border-top:2px solid #999}
.kpis{display:flex;flex-wrap:wrap;gap:8px 18px;margin:4px 0 10px;font-size:9.6pt}.kpis b{font-size:11pt}
p.obs{font-size:9pt;color:#555;margin:2px 0 8px}
</style>`;
const tab = (cols, linhas, total = null) => `<table class="tab"><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead>
<tbody>${linhas.map(l => `<tr>${l.map((v, i) => `<td class="${cols[i].n ? 'n' : ''}">${v}</td>`).join('')}</tr>`).join('')}
${total ? `<tr class="tot">${total.map((v, i) => `<td class="${cols[i].n ? 'n' : ''}">${v}</td>`).join('')}</tr>` : ''}</tbody></table>`;
const kpis = itens => `<div class="kpis">${itens.map(([k, v]) => `<span>${esc(k)}: <b>${v}</b></span>`).join('')}</div>`;

// ---------------------------------------------------------------- relatório semanal
function dadosSemanal(de, ate, mes) {
    const hoje = hojeISO();
    const mesAnt = mesAnterior(mes);
    const saldo = saldoEm(ate);
    // recebimentos esperados
    const cobrancaAnt = pacientes.map(p => ({ p, valor: cobradoDe(p, mesAnt) })).filter(x => x.valor > 0);
    const recebidoAnt = alocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.mes_ref === mesAnt).reduce((s, a) => s + (Number(a.valor) || 0), 0)
        + baixasComoRecebido().filter(b => b.mes_ref === mesAnt).reduce((s, b) => s + b.valor, 0);
    const totalCobradoAnt = cobrancaAnt.reduce((s, x) => s + x.valor, 0);
    const ab = emAbertoAte(mesAnt);
    const abertoAnt = ab.lista.reduce((s, x) => s + (x.meses.includes(mesAnt) ? (ab.aberto.get(x.paciente_id).find(l => l.mes === mesAnt) || {}).aberto || 0 : 0), 0);
    const atrasadosAntes = ab.total - abertoAnt;
    const projecaoMes = pacientes.reduce((s, p) => s + cobradoDe(p, mes), 0);
    const enviadasAnt = new Set(envios.filter(e => e.mes === mesAnt).map(e => e.paciente_id)).size;
    // saídas
    const prod = producaoDe(mes);
    const desp = despesasDoMes(mes);
    const totalDesp = desp.reduce((s, d) => s + d.valor, 0);
    const meses = new Set(); for (const linhas of ab.aberto.values()) for (const l of linhas) if (l.aberto > 0.01 && l.mes <= mesAnt) meses.add(l.mes);
    const producaoPorMes = {}; for (const m of meses) producaoPorMes[m] = producaoDe(m);
    const chave = r => `${r.profissional_id}|${r.paciente_id}|${r.mes_producao}`;
    const jaTem = new Set(retencoes.map(chave));
    const retPrev = retencoesSugeridas({ producaoPorMes, aberto: ab.aberto, pacientes, mes }).filter(r => !jaTem.has(chave(r)));
    const totalRetPrev = retPrev.reduce((s, r) => s + r.valor, 0);
    const retidas = retencoes.filter(r => r.status === 'retido');
    // sessões
    const semana = contagemSessoes(sessoesEntre(de, ate > hoje ? hoje : ate), hoje);
    const mesC = contagemSessoes(sessoesEntre(mes + '-01', fimDoMes(mes) > hoje ? hoje : fimDoMes(mes)), hoje);
    // frequência dos profissionais no período
    const presPeriodo = presencas.filter(f => f.data >= de && f.data <= ate);
    const profFreq = profissionais.map(pr => {
        const minhas = presPeriodo.filter(f => f.profissional_id === pr.id);
        const c = { ok: 0, fj: 0, f: 0, nc: 0, '??': 0 }; minhas.forEach(f => { c[f.status] = (c[f.status] || 0) + 1; });
        const atendidas = sessoes.filter(s => s.profissional_id === pr.id && s.data >= de && s.data <= ate && (s.status === 'ok' || s.status === 'fc')).length;
        const marc = c.ok + c.fj + c.f;
        return { pr, c, atendidas, presenca: marc ? c.ok / marc : null, total: minhas.length };
    }).filter(x => x.total || x.atendidas);
    const ev = evolucoesPendentes(hoje);
    const notaAbertas = notaPend.filter(p => ['aberta', 'em_andamento'].includes(p.status)).length;
    return { hoje, de, ate, mes, mesAnt, saldo, cobrancaAnt, totalCobradoAnt, recebidoAnt, abertoAnt, atrasadosAntes, ab, projecaoMes, enviadasAnt,
        prod, desp, totalDesp, retPrev, totalRetPrev, retidas, semana, mesC, profFreq, ev, notaAbertas };
}

function docSemanal(d) {
    const s = d.saldo.atual, ant = d.saldo.anterior;
    const varConta = s && ant ? Number(s.conta) - Number(ant.conta) : null;
    const varRes = s && ant ? Number(s.reserva) - Number(ant.reserva) : null;
    const corpo = CSS_TAB
      + secao('Caixa e reserva', s
          ? kpis([['Em conta', R$(s.conta)], ['Em reserva', R$(s.reserva)], ['Total', R$(Number(s.conta) + Number(s.reserva))], ['Informado em', formataBR(s.data)]])
            + (ant ? `<p class="obs">Variação desde ${formataBR(ant.data)}: conta ${varConta >= 0 ? '+' : ''}${R$(varConta)} · reserva ${varRes >= 0 ? '+' : ''}${R$(varRes)}.${s.observacao ? ' ' + esc(s.observacao) : ''}</p>` : '')
          : '<p class="obs">Nenhum saldo informado até esta data.</p>')
      + secao('Expectativa de recebimentos',
          kpis([[`Cobrado em ${mesBR(d.mesAnt)}`, R$(d.totalCobradoAnt)], ['Já recebido desse mês', R$(d.recebidoAnt)], ['Ainda a receber desse mês', R$(d.abertoAnt)],
                ['Atrasados de meses anteriores', R$(d.atrasadosAntes)], ['Total esperado agora', R$(d.abertoAnt + d.atrasadosAntes)]])
          + `<p class="obs">Cobranças de ${mesBR(d.mesAnt)} enviadas a ${d.enviadasAnt} de ${d.cobrancaAnt.length} pacientes com valor. Projeção de ${mesBR(d.mes)} (a cobrar no início do mês seguinte): <b>${R$(d.projecaoMes)}</b>, com ${d.mesC.contabilizadas} sessões já contabilizadas até hoje.</p>`)
      + secao('Expectativa de saídas',
          kpis([[`Repasses de ${mesBR(d.mes)} (projeção)`, R$(d.prod.totalRepasses)], ['Retenções previstas', '− ' + R$(d.totalRetPrev)], [`Despesas de ${mesBR(d.mes)}`, R$(d.totalDesp)],
                ['Total previsto', R$(d.prod.totalRepasses - d.totalRetPrev + d.totalDesp)]])
          + tab([{ t: 'Profissional' }, { t: 'Produção', n: 1 }, { t: 'Fixo', n: 1 }, { t: 'Total', n: 1 }],
              d.prod.porProfissional.map(c => [esc(c.profissional.nome), R$(c.producao), R$(c.fixo), R$(c.total)]),
              ['Total', R$(d.prod.porProfissional.reduce((s, c) => s + c.producao, 0)), R$(d.prod.porProfissional.reduce((s, c) => s + c.fixo, 0)), R$(d.prod.totalRepasses)])
          + (d.desp.length ? tab([{ t: 'Despesa' }, { t: 'Valor', n: 1 }], d.desp.slice(0, 25).map(x => [esc(x.nome), R$(x.valor)]), ['Total', R$(d.totalDesp)]) : '')
          + (d.retidas.length ? `<p class="obs">Retido aguardando pagamento de pacientes: ${R$(d.retidas.reduce((s, r) => s + (Number(r.valor) || 0), 0))} em ${d.retidas.length} lançamento(s).</p>` : ''))
      + secao('Sessões e faltas',
          `<p class="obs">Semana de ${formataBR(d.de)} a ${formataBR(d.ate)}</p>` + kpis([['Contabilizadas', d.semana.contabilizadas], ['Presenças', d.semana.ok], ['Faltas contabilizadas', d.semana.fc], ['Faltas justificadas', d.semana.fj], ['Não houve', d.semana.nc], ['Sem preenchimento', d.semana.pend]])
          + `<p class="obs">${mesBR(d.mes)} até hoje</p>` + kpis([['Contabilizadas', d.mesC.contabilizadas], ['Presenças', d.mesC.ok], ['Faltas contabilizadas', d.mesC.fc], ['Faltas justificadas', d.mesC.fj], ['Não houve', d.mesC.nc], ['Sem preenchimento', d.mesC.pend], ['Sem validação do profissional', d.mesC.semValidar], ['Propostas da recepção aguardando', d.mesC.propostas]]))
      + secao('Frequência dos profissionais na semana',
          d.profFreq.length ? tab([{ t: 'Profissional' }, { t: 'Sessões atendidas', n: 1 }, { t: 'Presente', n: 1 }, { t: 'Falta just.', n: 1 }, { t: 'Falta', n: 1 }, { t: 'Não houve', n: 1 }, { t: 'A preencher', n: 1 }, { t: 'Presença', n: 1 }],
              d.profFreq.map(x => [esc(x.pr.nome), x.atendidas, x.c.ok, x.c.fj, x.c.f, x.c.nc, x.c['??'], pct(x.presenca)]))
            : '<p class="obs">Sem registro de presença dos profissionais no período.</p>')
      + secao('Pacientes em atraso',
          kpis([['Pacientes', d.ab.lista.length], ['Total em aberto', R$(d.ab.total)]])
          + tab([{ t: 'Paciente' }, { t: 'Meses em aberto' }, { t: 'Saldo', n: 1 }], d.ab.lista.slice(0, 60).map(x => [esc(x.nome), x.meses.map(mesCurto).join(', '), R$(x.saldo)]), ['Total', '', R$(d.ab.total)]))
      + secao('Pendências',
          kpis([['Evoluções pendentes', `${d.ev.length} em ${new Set(d.ev.map(i => i.paciente.id)).size} pacientes`], ['Pendências de nota abertas', d.notaAbertas],
                ['Retenções previstas no acerto', `${d.retPrev.length} (${R$(d.totalRetPrev)})`]])
          + tab([{ t: 'Tipo' }, { t: 'Quantidade', n: 1 }], Object.entries(TIPOS_PENDENCIA_EV).map(([k, t]) => [esc(t.rotulo), d.ev.filter(i => i.tipo === k).length])));
    return documento({ titulo: `Relatório semanal — ${formataBR(d.de)} a ${formataBR(d.ate)}`, quando: `Gerado em ${formataBR(d.hoje)}`,
        cabecalho: `<h1>Relatório semanal da clínica</h1>${ficha([['Período', `${formataBR(d.de)} a ${formataBR(d.ate)}`], ['Mês de referência', mesBR(d.mes)]])}`,
        corpo, imprimir: false });
}

function textoSemanal(d) {
    const s = d.saldo.atual;
    const t = [`*Relatório semanal — ${formataBR(d.de)} a ${formataBR(d.ate)}*`, `_Argos Gestão · ${formataBR(d.hoje)}_`, ''];
    t.push('*Caixa*'); t.push(s ? `Conta ${R$(s.conta)} · Reserva ${R$(s.reserva)} · Total ${R$(Number(s.conta) + Number(s.reserva))} (em ${formataBR(s.data)})` : 'Sem saldo informado.'); t.push('');
    t.push('*Recebimentos esperados*');
    t.push(`${mesBR(d.mesAnt)}: cobrado ${R$(d.totalCobradoAnt)}, recebido ${R$(d.recebidoAnt)}, falta ${R$(d.abertoAnt)}`);
    t.push(`Atrasados anteriores: ${R$(d.atrasadosAntes)} → total esperado ${R$(d.abertoAnt + d.atrasadosAntes)}`);
    t.push(`Projeção de ${mesBR(d.mes)}: ${R$(d.projecaoMes)}`); t.push('');
    t.push('*Saídas esperadas*');
    t.push(`Repasses ${R$(d.prod.totalRepasses)} − retenções ${R$(d.totalRetPrev)} + despesas ${R$(d.totalDesp)} = ${R$(d.prod.totalRepasses - d.totalRetPrev + d.totalDesp)}`); t.push('');
    t.push('*Sessões da semana*');
    t.push(`Contabilizadas ${d.semana.contabilizadas} · presenças ${d.semana.ok} · Fc ${d.semana.fc} · Fj ${d.semana.fj} · Nc ${d.semana.nc} · sem preenchimento ${d.semana.pend}`);
    t.push(`No mês: ${d.mesC.contabilizadas} contabilizadas, ${d.mesC.fj} justificadas, ${d.mesC.semValidar} sem validação`); t.push('');
    if (d.profFreq.length) { t.push('*Profissionais na semana*'); d.profFreq.forEach(x => t.push(`• ${x.pr.nome}: ${x.atendidas} atendidas · presença ${pct(x.presenca)}${x.c['??'] ? ` · ${x.c['??']} a preencher` : ''}`)); t.push(''); }
    t.push(`*Em atraso: ${d.ab.lista.length} pacientes · ${R$(d.ab.total)}*`);
    d.ab.lista.slice(0, 15).forEach(x => t.push(`• ${x.nome} — ${R$(x.saldo)} (${x.meses.map(mesCurto).join(', ')})`));
    if (d.ab.lista.length > 15) t.push(`_(+${d.ab.lista.length - 15})_`); t.push('');
    t.push(`*Pendências*: ${d.ev.length} evoluções · ${d.notaAbertas} de nota · ${d.mesC.propostas} propostas de frequência aguardando`);
    return t.join('\n');
}

// ---------------------------------------------------------------- relatório geral
function docGeral(mes) {
    const hoje = hojeISO();
    const mesAnt = mesAnterior(mes);
    const ateMes = fimDoMes(mes) > hoje ? hoje : fimDoMes(mes);
    const d = dadosSemanal(mes + '-01', ateMes, mes);
    const prod = d.prod;
    // frequência por profissional no mês
    const doMes = sessoesEntre(mes + '-01', fimDoMes(mes));
    const porProf = profissionais.map(pr => {
        const minhas = doMes.filter(s => s.profissional_id === pr.id);
        const c = contagemSessoes(minhas, hoje);
        const a = prod.porProfissional.find(x => x.profissional.id === pr.id);
        return { pr, c, assid: a ? a.assiduidade : null, aPreencher: a ? a.aPreencher : 0 };
    }).filter(x => x.c.total);
    // fechamento parcial
    const fechLinhas = pacientes.map(p => ({ p, f: fechDe(p, mes), v: cobradoDe(p, mes) })).filter(x => x.f.sessoes.length || x.v > 0)
        .sort((a, b) => a.p.nome.localeCompare(b.p.nome));
    const totF = fechLinhas.reduce((t, x) => { ['ok', 'fj', 'fc', 'nc', '??'].forEach(k => t[k] += x.f.contagens[k] || 0); t.v += x.v; return t; }, { ok: 0, fj: 0, fc: 0, nc: 0, '??': 0, v: 0 });
    // cobranças e notas do mês anterior
    const notasAnt = notas.filter(n => n.mes === mesAnt && n.status === 'emitida');
    const evPorProf = new Map();
    d.ev.forEach(i => (i.profs.length ? i.profs : ['']).forEach(id => { if (!evPorProf.has(id)) evPorProf.set(id, []); evPorProf.get(id).push(i); }));
    const retPorProf = agrupar(d.retidas, r => r.profissional_id);
    const s = d.saldo.atual;

    const corpo = CSS_TAB
      + secao('Resumo do mês', kpis([['Faturamento projetado', R$(d.projecaoMes)], ['Repasses projetados', R$(prod.totalRepasses)], ['Despesas previstas', R$(d.totalDesp)],
            ['Resultado previsto', R$(d.projecaoMes - prod.totalRepasses - d.totalDesp)], ['Em aberto até ' + mesBR(mesAnt), R$(d.ab.total)],
            ['Caixa + reserva', s ? R$(Number(s.conta) + Number(s.reserva)) : '—']]))
      + secao('Frequência e validação por profissional',
          tab([{ t: 'Profissional' }, { t: 'Sessões', n: 1 }, { t: 'Ok', n: 1 }, { t: 'Fc', n: 1 }, { t: 'Fj', n: 1 }, { t: 'Nc', n: 1 }, { t: 'Sem preench.', n: 1 }, { t: 'Sem validação', n: 1 }, { t: 'Propostas', n: 1 }, { t: 'Assiduidade', n: 1 }],
              porProf.map(x => [esc(x.pr.nome), x.c.total, x.c.ok, x.c.fc, x.c.fj, x.c.nc, x.c.pend, x.c.semValidar, x.c.propostas, pct(x.assid)]),
              ['Total', d.mesC.total, d.mesC.ok, d.mesC.fc, d.mesC.fj, d.mesC.nc, d.mesC.pend, d.mesC.semValidar, d.mesC.propostas, ''])
          + '<p class="obs">Sessões até o fim do mês (as futuras entram como agendadas); "sem preenchimento" conta só as já vencidas. Assiduidade pela presença registrada dos profissionais.</p>')
      + secao('Evoluções pendentes',
          kpis([['Pendências', d.ev.length], ['Pacientes', new Set(d.ev.map(i => i.paciente.id)).size]])
          + tab([{ t: 'Profissional' }, ...Object.values(TIPOS_PENDENCIA_EV).map(t => ({ t: t.rotulo, n: 1 })), { t: 'Total', n: 1 }],
              [...evPorProf.entries()].sort((a, b) => b[1].length - a[1].length).map(([id, itens]) => [esc(id ? nomeProf(id) : 'Sem profissional ativo'), ...Object.keys(TIPOS_PENDENCIA_EV).map(k => itens.filter(i => i.tipo === k).length), itens.length]))
          + tab([{ t: 'Paciente' }, { t: 'Profissional' }, { t: 'Pendência' }, { t: 'Detalhe' }],
              d.ev.slice(0, 120).map(i => [esc(i.paciente.nome), esc(i.profs.map(nomeProf).join(', ')), esc(i.rotulo), esc(i.detalhe)])))
      + secao(`Fechamento parcial de ${mesBR(mes)}`,
          tab([{ t: 'Paciente' }, { t: 'Ok', n: 1 }, { t: 'Fj', n: 1 }, { t: 'Fc', n: 1 }, { t: 'Nc', n: 1 }, { t: '??', n: 1 }, { t: 'Valor', n: 1 }],
              fechLinhas.map(x => [esc(x.p.nome), x.f.contagens.ok, x.f.contagens.fj, x.f.contagens.fc, x.f.contagens.nc, x.f.contagens['??'], R$(x.v)]),
              ['Total', totF.ok, totF.fj, totF.fc, totF.nc, totF['??'], R$(totF.v)])
          + `<p class="obs">Valor = o cobrado quando a cobrança já foi enviada ou editada; senão, o calculado pela frequência, com as sessões futuras do mês projetadas.</p>`)
      + secao(`Produção e repasses de ${mesBR(mes)}`,
          tab([{ t: 'Profissional' }, { t: 'Produção', n: 1 }, { t: 'Fixo', n: 1 }, { t: 'Total', n: 1 }, { t: 'Retenção prevista', n: 1 }, { t: 'Retido aguardando', n: 1 }],
              prod.porProfissional.map(c => [esc(c.profissional.nome), R$(c.producao), R$(c.fixo), R$(c.total),
                  R$(d.retPrev.filter(r => r.profissional_id === c.profissional.id).reduce((s, r) => s + r.valor, 0)),
                  R$((retPorProf.get(c.profissional.id) || []).reduce((s, r) => s + (Number(r.valor) || 0), 0))]),
              ['Total', R$(prod.porProfissional.reduce((s, c) => s + c.producao, 0)), R$(prod.porProfissional.reduce((s, c) => s + c.fixo, 0)), R$(prod.totalRepasses), R$(d.totalRetPrev), R$(d.retidas.reduce((s, r) => s + (Number(r.valor) || 0), 0))]))
      + secao(`Cobranças e notas de ${mesBR(mesAnt)}`,
          kpis([['Pacientes com valor', d.cobrancaAnt.length], ['Cobranças enviadas', d.enviadasAnt], ['Cobrado', R$(d.totalCobradoAnt)], ['Recebido', R$(d.recebidoAnt)], ['Em aberto do mês', R$(d.abertoAnt)],
                ['Notas emitidas', `${notasAnt.length} (${R$(notasAnt.reduce((s, n) => s + (Number(n.valor) || 0), 0))})`], ['Pendências de nota abertas', d.notaAbertas]]))
      + secao('Pendências financeiras',
          tab([{ t: 'Paciente' }, { t: 'Meses em aberto' }, { t: 'Saldo', n: 1 }], d.ab.lista.map(x => [esc(x.nome), x.meses.map(mesCurto).join(', '), R$(x.saldo)]), ['Total', '', R$(d.ab.total)])
          + (d.retidas.length ? tab([{ t: 'Profissional' }, { t: 'Paciente' }, { t: 'Mês', n: 1 }, { t: 'Retido', n: 1 }],
              d.retidas.map(r => [esc(nomeProf(r.profissional_id)), esc(nomePac(r.paciente_id)), mesCurto(r.mes_producao), R$(r.valor)])) : '<p class="obs">Nada retido no momento.</p>'))
      + secao(`Saídas previstas de ${mesBR(mes)}`,
          kpis([['Repasses', R$(prod.totalRepasses)], ['Retenções previstas', '− ' + R$(d.totalRetPrev)], ['Despesas', R$(d.totalDesp)], ['Total', R$(prod.totalRepasses - d.totalRetPrev + d.totalDesp)]])
          + (d.desp.length ? tab([{ t: 'Despesa' }, { t: 'Valor', n: 1 }], d.desp.map(x => [esc(x.nome), R$(x.valor)]), ['Total', R$(d.totalDesp)]) : '<p class="obs">Nenhuma despesa cadastrada para o mês.</p>'))
      + secao('Caixa e reserva', s ? kpis([['Em conta', R$(s.conta)], ['Em reserva', R$(s.reserva)], ['Total', R$(Number(s.conta) + Number(s.reserva))], ['Informado em', formataBR(s.data)]])
          + (saldos.length > 1 ? tab([{ t: 'Data' }, { t: 'Conta', n: 1 }, { t: 'Reserva', n: 1 }, { t: 'Total', n: 1 }], saldos.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12).map(x => [formataBR(x.data), R$(x.conta), R$(x.reserva), R$(Number(x.conta) + Number(x.reserva))])) : '')
          : '<p class="obs">Nenhum saldo informado.</p>');
    return documento({ titulo: `Relatório geral — ${mesBR(mes)}`, quando: `Gerado em ${formataBR(hoje)}`,
        cabecalho: `<h1>Relatório geral da clínica</h1>${ficha([['Mês', mesBR(mes)], ['Situação em', formataBR(hoje)]])}`, corpo, imprimir: false });
}
const agrupar = (lista, fn) => { const m = new Map(); lista.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };

// ---------------------------------------------------------------- saldos
function renderSaldos() {
    const lista = saldos.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    el('sd-lista').innerHTML = lista.map(s => `<tr><td>${formataBR(s.data)}</td><td class="num">${R$(s.conta)}</td><td class="num">${R$(s.reserva)}</td>
      <td class="num"><b>${R$(Number(s.conta) + Number(s.reserva))}</b></td><td class="dim">${esc(s.observacao || '')}</td>
      <td><button class="argos-btn small ghost" data-saldo-apagar="${s.id}" title="Apagar">✕</button></td></tr>`).join('')
      || '<tr><td colspan="6" class="dim">Nenhum saldo informado ainda.</td></tr>';
}
el('form-saldo').addEventListener('submit', async e => {
    e.preventDefault();
    if (!perm.pode('saldos_caixa_editar')) return toast('Sem permissão.', true);
    const registro = { data: el('sd-data').value, conta: Number(el('sd-conta').value) || 0, reserva: Number(el('sd-reserva').value) || 0,
        observacao: el('sd-obs').value.trim() || null, quem: sessionStorage.getItem('usuario') || null };
    const { data, error } = await sb.from('argos_saldos_caixa').upsert(registro, { onConflict: 'data' }).select('*').single();
    if (error) { console.error(error); return toast('Erro ao guardar o saldo.', true); }
    saldos = saldos.filter(s => s.data !== registro.data).concat(data || registro);
    renderSaldos(); toast('Saldo guardado.'); previa();
});
el('sd-lista').addEventListener('click', async e => {
    const b = e.target.closest('[data-saldo-apagar]'); if (!b) return;
    if (!confirm('Apagar este saldo?')) return;
    const { error } = await sb.from('argos_saldos_caixa').delete().eq('id', b.dataset.saldoApagar);
    if (error) return toast('Erro ao apagar.', true);
    saldos = saldos.filter(s => s.id !== b.dataset.saldoApagar); renderSaldos(); previa();
});

// ---------------------------------------------------------------- eventos
function previa() {
    try {
        const d = dadosSemanal(el('rs-de').value, el('rs-ate').value, el('rs-mes').value);
        el('rs-previa').innerHTML = `Esperado receber agora <b>${R$(d.abertoAnt + d.atrasadosAntes)}</b> · saídas previstas <b>${R$(d.prod.totalRepasses - d.totalRetPrev + d.totalDesp)}</b> · caixa ${d.saldo.atual ? `<b>${R$(Number(d.saldo.atual.conta) + Number(d.saldo.atual.reserva))}</b>` : '<b>não informado</b>'} · ${d.semana.contabilizadas} sessões contabilizadas na semana · ${d.ab.lista.length} pacientes em atraso.`;
        el('rg-previa').innerHTML = `Mês ${esc(mesBR(el('rg-mes').value))}: faturamento projetado <b>${R$(pacientes.reduce((s, p) => s + cobradoDe(p, el('rg-mes').value), 0))}</b> · ${d.ev.length} evoluções pendentes · ${d.mesC.semValidar} sessões sem validação.`;
    } catch (e) { console.error(e); }
}
el('btn-semanal-doc').addEventListener('click', () => {
    const d = dadosSemanal(el('rs-de').value, el('rs-ate').value, el('rs-mes').value);
    if (!abrirDocumento(docSemanal(d))) toast('O navegador bloqueou a janela do documento.', true);
});
el('btn-semanal-txt').addEventListener('click', () => {
    const d = dadosSemanal(el('rs-de').value, el('rs-ate').value, el('rs-mes').value);
    el('rs-texto').value = textoSemanal(d); el('rs-texto').style.display = ''; el('btn-semanal-copiar').style.display = '';
});
el('btn-semanal-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(el('rs-texto').value); toast('Texto copiado.'); } catch (e) { el('rs-texto').select(); toast('Selecionei o texto: use Ctrl+C.'); }
});
el('btn-geral-doc').addEventListener('click', () => {
    if (!abrirDocumento(docGeral(el('rg-mes').value))) toast('O navegador bloqueou a janela do documento.', true);
});
['rs-de', 'rs-ate', 'rs-mes', 'rg-mes'].forEach(id => el(id).addEventListener('change', () => { fechCache.clear(); previa(); }));

(async function init() {
    perm = await carregarPermissoes();
    if (!perm.exigirPagina('relatorios_pagina', 'os relatórios')) return;
    perm.aplicarVisibilidade();
    const hoje = hojeISO();
    el('rs-de').value = somarDias(hoje, -6); el('rs-ate').value = hoje; el('rs-mes').value = hoje.slice(0, 7); el('rg-mes').value = hoje.slice(0, 7); el('sd-data').value = hoje;
    const [rPac, rDin, rSes, rProf, rPF, rAj, rEnv, rNot, rNP, rNM, rAloc, rDesp, rRet, rSal, rAv, rAn, rGru, rMem, rGP, rCong] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_prof_frequencia').select('*')),
        todas(() => sb.from('argos_cobranca_mes').select('*')),
        todas(() => sb.from('argos_cobranca_envios').select('paciente_id, mes')),
        todas(() => sb.from('argos_notas_fiscais').select('paciente_id, mes, valor, status')),
        sb.from('argos_nota_pendencias').select('id, status'),
        todas(() => sb.from('argos_nota_mes').select('*')),
        todas(() => sb.from('argos_mov_alocacoes').select('*')),
        sb.from('argos_despesas').select('*'),
        sb.from('argos_repasse_retencoes').select('*'),
        sb.from('argos_saldos_caixa').select('*'),
        todas(() => sb.from('argos_ev_avaliacoes').select('*')),
        todas(() => sb.from('argos_anamnese_respostas').select('paciente_id')),
        sb.from('argos_grupos').select('*'), sb.from('argos_grupo_membros').select('*'), sb.from('argos_grupo_profissionais').select('*'),
        todas(() => sb.from('argos_meses_congelados').select('*'))
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error;
    if (erro) { console.error(erro); toast('Erro ao carregar os dados.', true); return; }
    pacientes = rPac.data || []; dinamicas = rDin.data || []; sessoes = rSes.data || []; profissionais = rProf.data || [];
    presencas = rPF.data || []; ajustes = rAj.data || []; envios = rEnv.data || []; notas = rNot.data || []; notaPend = rNP.data || [];
    notasMes = rNM.data || []; alocacoes = rAloc.data || []; despesas = rDesp.data || []; retencoes = rRet.data || []; saldos = rSal.data || [];
    avaliacoes = rAv.data || []; comAnamnese = new Set((rAn.data || []).map(r => r.paciente_id));
    grupos = rGru.data || []; grupoMembros = rMem.data || []; grupoProfs = rGP.data || [];
    definirMesesCongelados((rCong && rCong.data) || []);
    definirRepassePadrao(profissionais);
    renderSaldos();
    el('rl-carregando').textContent = '';
    previa();
})();
