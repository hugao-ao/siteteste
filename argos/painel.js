// painel.js — Meu painel (o profissional)
// ========================================
// A mesma conta da produção e do acerto, recortada para uma pessoa só:
// quanto o mês já rendeu, quanto ainda está agendado, a média por sessão,
// quantos atendimentos faltam para uma meta, quem está devendo (e vai
// gerar retenção), o que já está retido, e as evoluções por fazer.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import {
    formataMoeda, formataBR, hojeISO, fechamentoPaciente, definirRepassePadrao, repassesDe, fimDoMes
} from './argos-recorrencia.js';
import { producaoDoMes } from './argos-producao.js';
import { atendimentosDoProfissional } from './argos-validacao.js';
import { mesBR, fatorNFDoMes } from './argos-cobranca.js';
import { cobradoPorPaciente, valorDoMes } from './argos-fechamento.js';
import { usarFechamento, abertoPorPaciente, retencoesSugeridas, mesAnterior, mesCurto, agruparPorPaciente } from './argos-repasses.js';
import { pacientesDoProfissional } from './argos-escopo.js';
import { pendenciasDeEvolucao, contarPendenciasEv, emAtendimento, TIPOS_PENDENCIA_EV } from './argos-evolucao-pendencias.js';
import { retratoDaCobranca, divergenciaDaCobranca } from './argos-fechamento.js';
import { despesasDoMes, sessoesEntre, contagemSessoes, entradasSemAlocacao } from './argos-gestao.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true, escopo: { geral: true } };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [], ajustes = [], notasMes = [];
let alocacoes = [], retencoes = [], grupos = [], grupoMembros = [], grupoProfs = [];
let avaliacoes = [], comAnamnese = new Set();
let profId = null;
// só para a visão geral (escopo geral)
let gestao = null; // { envios, notaPend, movimentacoes, despesas, saldos, retencoesTodas, avaliacoesTodas, anamneseTodas, presencas }
const VISAO_GERAL = '__geral__';
const producaoCache = new Map();
const el = id => document.getElementById(id);
const nomePac = id => (pacientes.find(p => p.id === id) || {}).nome || '—';

usarFechamento((p, dins, sess, mes) => {
    const fech = fechamentoPaciente(p, dins, sess, mes);
    const ajuste = ajustes.find(a => a.paciente_id === p.id && a.mes === mes) || null;
    return { valor: valorDoMes({ fech, ajuste }).valor };
});
const baixasComoRecebido = () => ajustes.filter(a => Number(a.baixa_valor) > 0)
    .map(a => ({ vinculo_tipo: 'paciente', vinculo_id: a.paciente_id, mes_ref: a.mes, valor: Number(a.baixa_valor) }));

function producaoDe(mes) {
    if (!producaoCache.has(mes)) {
        producaoCache.set(mes, producaoDoMes({
            pacientes, dinamicas, sessoes, profissionais, presencas: gestao ? gestao.presencas : [], mes,
            notaFator: fatorNFDoMes({ pacientes, dinamicas, excecoes: notasMes, mes }),
            cobrado: cobradoPorPaciente(ajustes, mes)
        }));
    }
    return producaoCache.get(mes);
}
function atendimentosDe(mes, quem = profId) {
    return atendimentosDoProfissional({
        profissional_id: quem, mes, pacientes, dinamicas, sessoes, profissionais,
        notaFator: fatorNFDoMes({ pacientes, dinamicas, excecoes: notasMes, mes }),
        cobrado: cobradoPorPaciente(ajustes, mes)
    });
}

// ---------------------------------------------------------------- carga
async function carregarTudo() {
    const [rPac, rDin, rSes, rProf, rAj, rNM, rAloc, rGru, rMem, rGP] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        todas(() => sb.from('argos_dinamicas').select('*')),
        todas(() => sb.from('argos_sessoes').select('*')),
        sb.from('argos_profissionais').select('*').order('nome'),
        todas(() => sb.from('argos_cobranca_mes').select('*')),
        todas(() => sb.from('argos_nota_mes').select('*')),
        todas(() => sb.from('argos_mov_alocacoes').select('*')),
        sb.from('argos_grupos').select('*'),
        sb.from('argos_grupo_membros').select('*'),
        sb.from('argos_grupo_profissionais').select('*')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error;
    if (erro) { console.error(erro); toast('Erro ao carregar o painel.', true); return false; }
    pacientes = rPac.data || []; dinamicas = rDin.data || []; sessoes = rSes.data || [];
    profissionais = rProf.data || []; ajustes = rAj.data || []; notasMes = rNM.data || [];
    alocacoes = rAloc.data || []; grupos = rGru.data || []; grupoMembros = rMem.data || []; grupoProfs = rGP.data || [];
    definirRepassePadrao(profissionais);
    return true;
}

async function carregarGestao() {
    if (gestao) return;
    const [rEnv, rNP, rMov, rDesp, rSal, rRet, rAv, rAn, rPF] = await Promise.all([
        todas(() => sb.from('argos_cobranca_envios').select('paciente_id, mes')),
        sb.from('argos_nota_pendencias').select('id, status, mes'),
        todas(() => sb.from('argos_movimentacoes').select('id, tipo, valor, data, descricao')),
        sb.from('argos_despesas').select('*'),
        sb.from('argos_saldos_caixa').select('*'),
        sb.from('argos_repasse_retencoes').select('*'),
        todas(() => sb.from('argos_ev_avaliacoes').select('*')),
        todas(() => sb.from('argos_anamnese_respostas').select('paciente_id')),
        todas(() => sb.from('argos_prof_frequencia').select('*'))
    ]);
    gestao = {
        envios: rEnv.data || [], notaPend: rNP.data || [], movimentacoes: rMov.data || [], despesas: rDesp.data || [],
        saldos: rSal.data || [], retencoesTodas: rRet.data || [], avaliacoesTodas: rAv.data || [],
        anamneseTodas: new Set((rAn.data || []).map(r => r.paciente_id)), presencas: rPF.data || []
    };
    producaoCache.clear();
}

/** Pacientes em atendimento com um profissional qualquer. */
function pacientesAtivosDe(quem) {
    const hoje = hojeISO();
    const ids = pacientesDoProfissional(quem, { dinamicas: dinamicas.filter(d => d.ativo !== false), sessoes: [], grupos: grupos.filter(g => g.ativo !== false), grupoMembros, grupoProfs });
    return emAtendimento(pacientes.filter(p => ids.has(p.id)), hoje);
}

// ================================================================ VISÃO GERAL
function renderGestao(mes) {
    const g = gestao, hoje = hojeISO();
    const mesAnt = mesAnterior(mes);
    const prod = producaoDe(mes);
    const ateHoje = fimDoMes(mes) > hoje ? hoje : fimDoMes(mes);

    // faturamento: projeção do mês (cobrado quando já enviado/editado) e a parte já feita
    let projecao = 0, realizado = 0;
    const cobradoDe = p => Number(valorDoMes({ fech: fechamentoPaciente(p, dinamicas.filter(d => d.paciente_id === p.id), sessoes.filter(s => s.paciente_id === p.id), mes), ajuste: ajustes.find(a => a.paciente_id === p.id && a.mes === mes) || null }).valor) || 0;
    const fechPorPac = new Map();
    for (const p of pacientes) {
        const f = fechamentoPaciente(p, dinamicas.filter(d => d.paciente_id === p.id), sessoes.filter(s => s.paciente_id === p.id), mes);
        fechPorPac.set(p.id, f);
        const v = Number(valorDoMes({ fech: f, ajuste: ajustes.find(a => a.paciente_id === p.id && a.mes === mes) || null }).valor) || 0;
        if (!v) continue;
        projecao += v;
        const feitas = f.sessoes.filter(s => (s.status === 'ok' || s.status === 'fc') && s.data <= hoje).length;
        const todasC = f.sessoes.filter(s => s.status === 'ok' || s.status === 'fc' || (s.status === '??' && s.data > hoje)).length;
        realizado += todasC ? v * feitas / todasC : v;
    }
    // mês anterior: cobrado, enviado, recebido, aberto
    const cobrAnt = pacientes.map(p => ({ p, v: Number(valorDoMes({ fech: fechamentoPaciente(p, dinamicas.filter(d => d.paciente_id === p.id), sessoes.filter(s => s.paciente_id === p.id), mesAnt), ajuste: ajustes.find(a => a.paciente_id === p.id && a.mes === mesAnt) || null }).valor) || 0 })).filter(x => x.v > 0);
    const enviadosAnt = new Set(g.envios.filter(e => e.mes === mesAnt).map(e => e.paciente_id));
    const aEnviar = cobrAnt.filter(x => !enviadosAnt.has(x.p.id));
    const totalCobrAnt = cobrAnt.reduce((s, x) => s + x.v, 0);
    const recebidoAnt = alocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.mes_ref === mesAnt).reduce((s, a) => s + (Number(a.valor) || 0), 0)
        + baixasComoRecebido().filter(b => b.mes_ref === mesAnt).reduce((s, b) => s + b.valor, 0);
    // em aberto até o mês anterior
    const aberto = abertoPorPaciente({ pacientes, dinamicas, sessoes, alocacoes: alocacoes.concat(baixasComoRecebido()), ate: mesAnt });
    const atrasos = [];
    for (const [pid, linhas] of aberto) {
        const ab = linhas.filter(l => l.aberto > 0.009);
        const saldo = ab.reduce((s, l) => s + l.aberto, 0);
        if (saldo > 0.009) atrasos.push({ pid, saldo, meses: ab.map(l => l.mes) });
    }
    atrasos.sort((a, b) => b.saldo - a.saldo);
    const totalAtraso = atrasos.reduce((s, x) => s + x.saldo, 0);
    // alterações após o envio (mês anterior e atual)
    let divergentes = 0;
    for (const m of [mesAnt, mes]) for (const a of ajustes) {
        if (a.mes !== m || !a.congelado_retrato) continue;
        const p = pacientes.find(x => x.id === a.paciente_id); if (!p) continue;
        const f = m === mes ? fechPorPac.get(p.id) : fechamentoPaciente(p, dinamicas.filter(d => d.paciente_id === p.id), sessoes.filter(s => s.paciente_id === p.id), m);
        if (divergenciaDaCobranca(a.congelado_retrato, retratoDaCobranca({ fech: f, valor: f.valor })).length) divergentes++;
    }
    // retenções
    const meses = new Set(); for (const linhas of aberto.values()) for (const l of linhas) if (l.aberto > 0.01) meses.add(l.mes);
    const producaoPorMes = {}; for (const m of meses) producaoPorMes[m] = producaoDe(m);
    const chave = r => `${r.profissional_id}|${r.paciente_id}|${r.mes_producao}`;
    const jaTem = new Set(g.retencoesTodas.map(chave));
    const retPrev = retencoesSugeridas({ producaoPorMes, aberto, pacientes, mes }).filter(r => !jaTem.has(chave(r)));
    const totalRetPrev = retPrev.reduce((s, r) => s + r.valor, 0);
    const retidas = g.retencoesTodas.filter(r => r.status === 'retido');
    const totalRetido = retidas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
    // sessões do mês
    const doMes = sessoesEntre({ dinamicas, sessoes, pacientes }, mes + '-01', fimDoMes(mes));
    const cs = contagemSessoes(doMes, hoje);
    // evoluções
    const ativos = emAtendimento(pacientes, hoje);
    const porPac = new Map();
    for (const pr of profissionais) for (const id of pacientesDoProfissional(pr.id, { dinamicas: dinamicas.filter(d => d.ativo !== false), grupos: grupos.filter(x => x.ativo !== false), grupoMembros, grupoProfs })) {
        if (!porPac.has(id)) porPac.set(id, []); porPac.get(id).push(pr.id);
    }
    const ev = pendenciasDeEvolucao({ pacientes: ativos, avaliacoes: g.avaliacoesTodas, comAnamnese: g.anamneseTodas, hoje }).map(i => ({ ...i, profs: porPac.get(i.paciente.id) || [] }));
    const notaAbertas = g.notaPend.filter(p => ['aberta', 'em_andamento'].includes(p.status)).length;
    const semAloc = entradasSemAlocacao(g.movimentacoes, alocacoes);
    const desp = despesasDoMes(g.despesas, mes);
    const totalDesp = desp.reduce((s, d) => s + d.valor, 0);
    const saldo = g.saldos.filter(s => s.data <= hoje).sort((a, b) => b.data.localeCompare(a.data))[0] || null;
    const saldoAnt = g.saldos.filter(s => saldo && s.data < saldo.data).sort((a, b) => b.data.localeCompare(a.data))[0] || null;
    // pacientes
    const comDinamica = new Set(dinamicas.filter(d => d.ativo !== false).map(d => d.paciente_id));
    const emAtend = ativos.filter(p => comDinamica.has(p.id) || porPac.has(p.id));
    const novos = pacientes.filter(p => String(p.created_at || '').slice(0, 7) === mes);
    const encerrados = pacientes.filter(p => p.processo_fim_tipo && String(p.processo_fim_data || '').slice(0, 7) === mes);
    const semDinamica = ativos.filter(p => !comDinamica.has(p.id) && !porPac.has(p.id));

    // ---- KPIs
    el('pg-kpis').innerHTML = `
      <div class="pn-kpi destaque"><div class="rot">Faturamento projetado de ${esc(mesBR(mes))}</div><div class="val">${formataMoeda(projecao)}</div>
        <div class="sub">≈ ${formataMoeda(realizado)} já realizado até hoje · ${cs.contabilizadas} sessões contabilizadas · ${cs.futuras} agendadas</div></div>
      <div class="pn-kpi"><div class="rot">Repasses projetados</div><div class="val">${formataMoeda(prod.totalRepasses)}</div>
        <div class="sub">retenções previstas − ${formataMoeda(totalRetPrev)} · fica para a clínica ${formataMoeda(projecao - prod.totalRepasses)}</div></div>
      <div class="pn-kpi"><div class="rot">Resultado previsto do mês</div><div class="val">${formataMoeda(projecao - prod.totalRepasses - totalDesp)}</div>
        <div class="sub">faturamento − repasses − despesas (${formataMoeda(totalDesp)})</div></div>
      <div class="pn-kpi ${aEnviar.length ? 'alerta' : ''}"><div class="rot">Cobranças de ${esc(mesBR(mesAnt))}</div><div class="val">${formataMoeda(totalCobrAnt)}</div>
        <div class="sub">${enviadosAnt.size} de ${cobrAnt.length} enviadas${aEnviar.length ? ` · <b>${aEnviar.length} a enviar</b>` : ''} · recebido ${formataMoeda(recebidoAnt)}</div></div>
      <div class="pn-kpi ${totalAtraso ? 'erro' : ''}"><div class="rot">Em aberto até ${esc(mesBR(mesAnt))}</div><div class="val">${formataMoeda(totalAtraso)}</div>
        <div class="sub">${atrasos.length} paciente(s) · retido dos profissionais ${formataMoeda(totalRetido)}</div></div>
      <div class="pn-kpi"><div class="rot">Caixa + reserva</div><div class="val">${saldo ? formataMoeda(Number(saldo.conta) + Number(saldo.reserva)) : '—'}</div>
        <div class="sub">${saldo ? `conta ${formataMoeda(saldo.conta)} · reserva ${formataMoeda(saldo.reserva)} · em ${formataBR(saldo.data)}` : 'informe em Relatórios'}</div></div>`;

    // ---- tabela por profissional
    const linhas = profissionais.map(pr => {
        const c = prod.porProfissional.find(x => x.profissional.id === pr.id);
        const at = atendimentosDe(mes, pr.id);
        const feitas = at.filter(l => l.contabiliza && l.data <= hoje);
        const real = feitas.reduce((s, l) => s + l.valor, 0);
        const minhas = doMes.filter(s => s.profissional_id === pr.id);
        const cm = contagemSessoes(minhas, hoje);
        const evP = ev.filter(i => i.profs.includes(pr.id)).length;
        const rp = retPrev.filter(r => r.profissional_id === pr.id).reduce((s, r) => s + r.valor, 0);
        const rt = retidas.filter(r => r.profissional_id === pr.id).reduce((s, r) => s + (Number(r.valor) || 0), 0);
        return { pr, total: c ? c.total : 0, fixo: c ? c.fixo : 0, real, feitas: feitas.length, futuras: cm.futuras, media: feitas.length ? real / feitas.length : 0,
            rp, rt, prop: cm.propostas, semVal: cm.semValidar, pend: cm.pend, evP, assid: c ? c.assiduidade : null, pacientes: pacientesAtivosDe(pr.id).length };
    }).filter(x => x.total || x.feitas || x.futuras || x.pacientes).sort((a, b) => b.total - a.total);
    const num = (v, cls = '') => `<td class="num ${v ? cls : ''}">${v || '—'}</td>`;
    el('pg-profs').innerHTML = `<thead><tr><th>Profissional</th><th class="num">Pacientes</th><th class="num">Projeção</th><th class="num">Realizado</th><th class="num">Sessões</th><th class="num">Agendadas</th><th class="num">Média/sessão</th>
        <th class="num">Retenção prev.</th><th class="num">Retido</th><th class="num">Propostas</th><th class="num">Sem validar</th><th class="num">?? vencidas</th><th class="num">Evoluções</th><th class="num">Assid.</th></tr></thead>
      <tbody>${linhas.map(x => `<tr>
        <td><a class="nome" href="painel.html?profissional=${x.pr.id}">${esc(x.pr.nome)}</a></td>
        <td class="num">${x.pacientes}</td><td class="num"><b>${formataMoeda(x.total)}</b></td><td class="num">${formataMoeda(x.real)}</td>
        <td class="num">${x.feitas}</td><td class="num">${x.futuras}</td><td class="num">${formataMoeda(x.media)}</td>
        <td class="num ${x.rp ? 'alerta' : ''}">${x.rp ? '− ' + formataMoeda(x.rp) : '—'}</td><td class="num">${x.rt ? formataMoeda(x.rt) : '—'}</td>
        ${num(x.prop, 'alerta')}${num(x.semVal, 'alerta')}${num(x.pend, 'erro')}${num(x.evP, 'alerta')}
        <td class="num">${x.assid == null ? '—' : Math.round(x.assid * 100) + '%'}</td></tr>`).join('')}
      <tr style="font-weight:700"><td>Total</td><td class="num">${emAtend.length}</td><td class="num">${formataMoeda(prod.totalRepasses)}</td><td class="num">${formataMoeda(linhas.reduce((s, x) => s + x.real, 0))}</td>
        <td class="num">${cs.contabilizadas}</td><td class="num">${cs.futuras}</td><td></td><td class="num">${formataMoeda(totalRetPrev)}</td><td class="num">${formataMoeda(totalRetido)}</td>
        <td class="num">${cs.propostas}</td><td class="num">${cs.semValidar}</td><td class="num">${cs.pend}</td><td class="num">${ev.length}</td><td></td></tr></tbody>`;

    // ---- filas
    const fila = (n, titulo, sub, href, nivel = 'alerta') => `<a class="pg-fila ${n ? nivel : 'zero'}" href="${href}" style="text-decoration:none;color:inherit">
        <span class="n">${typeof n === 'number' ? n : n}</span><span>${esc(titulo)}<small>${esc(sub)}</small></span><span>→</span></a>`;
    el('pg-filas').innerHTML = [
        fila(aEnviar.length, `Cobranças de ${mesBR(mesAnt)} a enviar`, aEnviar.length ? `${formataMoeda(aEnviar.reduce((s, x) => s + x.v, 0))} ainda sem mensagem` : 'todas enviadas', `cobranca.html`, 'erro'),
        fila(divergentes, 'Cobranças que mudaram depois do envio', 'aprovar ou recusar na aba Fechamento', 'cobranca.html'),
        fila(notaAbertas, 'Pendências de nota fiscal abertas', 'notas que não batem mais com o mês', 'cobranca.html'),
        fila(cs.pend, `Sessões vencidas sem preenchimento em ${mesBR(mes)}`, 'a recepção precisa marcar', 'pendencias.html', 'erro'),
        fila(cs.propostas, 'Propostas da recepção aguardando o profissional', 'aprovar na conferência de frequência', `frequencia.html?mes=${mes}`),
        fila(cs.semValidar, 'Sessões preenchidas sem validação do profissional', 'cobrar validação', `frequencia.html?mes=${mes}`),
        fila(ev.length, 'Evoluções pendentes', `${Object.entries(TIPOS_PENDENCIA_EV).map(([k, t]) => `${ev.filter(i => i.tipo === k).length} ${t.rotulo.toLowerCase()}`).filter(s => !s.startsWith('0 ')).join(' · ') || '—'}`, 'evolucoes.html'),
        fila(retPrev.length, 'Retenções a registrar no acerto', retPrev.length ? `${formataMoeda(totalRetPrev)} de repasse de quem não pagou` : 'nada a reter', 'producao.html#repasses'),
        fila(semAloc.lista.length, 'Entradas do extrato sem paciente', semAloc.lista.length ? `${formataMoeda(semAloc.total)} recebidos e ainda não ligados a ninguém` : 'extrato conciliado', 'planejamento.html')
    ].join('');

    // ---- atrasos
    el('pg-atraso-qtd').textContent = atrasos.length ? `${atrasos.length} · ${formataMoeda(totalAtraso)}` : '';
    el('pg-atrasos').innerHTML = atrasos.length ? atrasos.slice(0, 12).map(x => `
      <div class="pn-item"><span class="quem">${esc(nomePac(x.pid))}<small>${x.meses.map(mesCurto).join(', ')}</small></span><span class="num">${formataMoeda(x.saldo)}</span></div>`).join('')
      + (atrasos.length > 12 ? `<p class="dim">+${atrasos.length - 12} · <a href="cobranca.html">ver todos no Em aberto</a></p>` : '')
      : '<p class="pn-vazio">Ninguém em atraso. 🎉</p>';

    // ---- caixa
    const varTot = saldo && saldoAnt ? (Number(saldo.conta) + Number(saldo.reserva)) - (Number(saldoAnt.conta) + Number(saldoAnt.reserva)) : null;
    el('pg-caixa').innerHTML = `<div class="pg-linhas">
      <div>Em conta <b>${saldo ? formataMoeda(saldo.conta) : '—'}</b></div>
      <div>Em reserva <b>${saldo ? formataMoeda(saldo.reserva) : '—'}</b></div>
      ${varTot != null ? `<div>Variação desde ${formataBR(saldoAnt.data)} <b style="color:${varTot >= 0 ? 'var(--argos-success)' : 'var(--argos-danger)'}">${varTot >= 0 ? '+' : ''}${formataMoeda(varTot)}</b></div>` : ''}
      <div>A receber agora (${esc(mesBR(mesAnt))} + atrasados) <b>${formataMoeda(totalAtraso)}</b></div>
      <div>Repasses previstos − retenções <b>${formataMoeda(prod.totalRepasses - totalRetPrev)}</b></div>
      <div>Despesas de ${esc(mesBR(mes))} <b>${formataMoeda(totalDesp)}</b></div>
      ${desp.slice(0, 5).map(d => `<div class="dim" style="padding-left:12px">${esc(d.nome)} <b>${formataMoeda(d.valor)}</b></div>`).join('')}
    </div><p class="dica" style="margin-top:8px"><a href="relatorios.html">Relatórios e saldos →</a></p>`;

    // ---- pacientes
    el('pg-pacientes').innerHTML = `<div class="pg-linhas">
      <div>Em atendimento <b>${emAtend.length}</b></div>
      <div>Novos cadastros em ${esc(mesBR(mes))} <b>${novos.length}</b></div>
      <div>Processos encerrados em ${esc(mesBR(mes))} <b>${encerrados.length}</b></div>
      <div>Ativos sem dinâmica nem grupo <b class="${semDinamica.length ? 'alerta' : ''}">${semDinamica.length}</b></div>
      <div>Com mês vencido em aberto <b>${atrasos.length}</b></div>
    </div>${semDinamica.length ? `<p class="dica" style="margin-top:8px">${semDinamica.slice(0, 8).map(p => esc(p.nome)).join(' · ')}${semDinamica.length > 8 ? ' …' : ''}</p>` : ''}`;
}

async function carregarDoProfissional() {
    const meus = [...meusPacientesAtivos().map(p => p.id)];
    const [rRet, rAv, rAn] = await Promise.all([
        sb.from('argos_repasse_retencoes').select('*').eq('profissional_id', profId),
        meus.length ? sb.from('argos_ev_avaliacoes').select('*').in('paciente_id', meus) : { data: [] },
        meus.length ? sb.from('argos_anamnese_respostas').select('paciente_id').in('paciente_id', meus) : { data: [] }
    ]);
    retencoes = rRet.data || []; avaliacoes = rAv.data || [];
    comAnamnese = new Set((rAn.data || []).map(r => r.paciente_id));
}

/** Pacientes em atendimento com este profissional: dinâmica/grupo ativo dele. */
function meusPacientesAtivos() {
    const hoje = hojeISO();
    const dinsAtivas = dinamicas.filter(d => d.ativo !== false);
    const ids = pacientesDoProfissional(profId, { dinamicas: dinsAtivas, sessoes: [], grupos: grupos.filter(g => g.ativo !== false), grupoMembros, grupoProfs });
    return emAtendimento(pacientes.filter(p => ids.has(p.id)), hoje);
}

// ---------------------------------------------------------------- render
function render() {
    const mes = el('pn-mes').value || hojeISO().slice(0, 7);
    const hoje = hojeISO();
    const geral = profId === VISAO_GERAL;
    el('pn-gestao').style.display = geral ? '' : 'none';
    el('pn-individual').style.display = geral ? 'none' : '';
    if (geral) {
        el('pn-titulo').textContent = `🏥 Visão geral da clínica — ${mesBR(mes)}`;
        renderGestao(mes);
        perm.aplicarVisibilidade(document);
        el('pn-carregando').textContent = '';
        return;
    }
    const prof = profissionais.find(p => p.id === profId);
    el('pn-titulo').textContent = `📌 ${perm.escopo.geral ? 'Painel de ' + (prof ? prof.nome : '—') : 'Meu painel'} — ${mesBR(mes)}`;

    if (perm.pode('painel_financeiro')) renderFinanceiro(mes, hoje, prof);
    renderEvolucoes(hoje);
    renderFrequencia(mes, hoje);
    perm.aplicarVisibilidade(document);
    el('pn-carregando').textContent = '';
}

let sim = { fixo: 0, realizado: 0, media: 0, agendadas: 0, projecao: 0 };

function renderFinanceiro(mes, hoje, prof) {
    const prod = producaoDe(mes).porProfissional.find(c => c.profissional.id === profId)
        || { fixo: 0, producao: 0, total: 0, detalhePorPaciente: {} };
    const at = atendimentosDe(mes);
    const feitas = at.filter(l => l.contabiliza && l.data <= hoje);
    const realizado = feitas.reduce((s, l) => s + l.valor, 0);
    const projecao = prod.total;
    const restante = Math.max(0, projecao - prod.fixo - realizado);
    // sessões ainda por vir: projeção das dinâmicas em que ele recebe
    let agendadas = 0;
    for (const p of pacientes) {
        const dins = dinamicas.filter(d => d.paciente_id === p.id);
        if (!dins.some(d => repassesDe(d).some(r => r.profissional_id === profId) || d.profissional_id === profId)) continue;
        const f = fechamentoPaciente(p, dins, sessoes.filter(s => s.paciente_id === p.id), mes);
        agendadas += f.sessoes.filter(s => s.status === '??' && s.data > hoje
            && (s.profissional_id === profId || (dins.find(d => d.id === s.dinamica_ref) && repassesDe(dins.find(d => d.id === s.dinamica_ref)).some(r => r.profissional_id === profId)))).length;
    }
    // médias dos 3 meses anteriores
    const hist = [];
    let m = mesAnterior(mes);
    for (let i = 0; i < 3; i++) { hist.push(m); m = mesAnterior(m); }
    const histDados = hist.map(h => {
        const a = atendimentosDe(h).filter(l => l.contabiliza);
        const pr = producaoDe(h).porProfissional.find(c => c.profissional.id === profId);
        return { mes: h, sessoes: a.length, valor: pr ? pr.total : 0, producao: pr ? pr.producao : 0 };
    }).filter(h => h.sessoes || h.valor);
    const mediaSessoesMes = histDados.length ? histDados.reduce((s, h) => s + h.sessoes, 0) / histDados.length : 0;
    const mediaRepasseMes = histDados.length ? histDados.reduce((s, h) => s + h.valor, 0) / histDados.length : 0;
    const somaHistSess = histDados.reduce((s, h) => s + h.sessoes, 0);
    const mediaSessaoHist = somaHistSess ? histDados.reduce((s, h) => s + h.producao, 0) / somaHistSess : 0;
    const mediaSessao = feitas.length ? realizado / feitas.length : mediaSessaoHist;
    sim = { fixo: prod.fixo, realizado, media: mediaSessao, agendadas, projecao };

    el('pn-kpis').innerHTML = `
      <div class="pn-kpi destaque"><div class="rot">Repasse projetado de ${esc(mesBR(mes))}</div>
        <div class="val">${formataMoeda(projecao)}</div>
        <div class="sub">se tudo que está agendado acontecer${prod.fixo ? ` · inclui fixo de ${formataMoeda(prod.fixo)}` : ''}. Atualiza a cada frequência confirmada.</div></div>
      <div class="pn-kpi"><div class="rot">Já realizado até hoje</div>
        <div class="val">${formataMoeda(realizado + prod.fixo)}</div>
        <div class="sub">${feitas.length} sessão(ões) contabilizada(s)${prod.fixo ? ' + fixo' : ''}</div></div>
      <div class="pn-kpi"><div class="rot">Ainda agendado no mês</div>
        <div class="val">${agendadas}</div>
        <div class="sub">sessão(ões) até ${formataBR(fimDoMes(mes))} · ≈ ${formataMoeda(restante)}</div></div>
      <div class="pn-kpi"><div class="rot">Valor médio por sessão</div>
        <div class="val">${formataMoeda(mediaSessao)}</div>
        <div class="sub">${feitas.length ? 'neste mês' : 'pelos meses anteriores'}, já descontada a nota fiscal quando há</div></div>
      <div class="pn-kpi"><div class="rot">Média dos últimos ${histDados.length || 3} meses</div>
        <div class="val">${Math.round(mediaSessoesMes)} <small style="font-size:.9rem;font-weight:600">atend./mês</small></div>
        <div class="sub">${formataMoeda(mediaRepasseMes)} de repasse por mês${histDados.length ? ` (${histDados.map(h => mesCurto(h.mes)).join(', ')})` : ''}</div></div>`;
    renderSimulador();

    // pendências que vão gerar retenção no acerto do mês que vem
    const aberto = abertoPorPaciente({ pacientes, dinamicas, sessoes, alocacoes: alocacoes.concat(baixasComoRecebido()), ate: mes });
    const meses = new Set();
    for (const linhas of aberto.values()) for (const l of linhas) if (l.aberto > 0.01 && l.mes <= mes) meses.add(l.mes);
    const producaoPorMes = {};
    for (const mm of meses) producaoPorMes[mm] = producaoDe(mm);
    const chave = r => `${r.profissional_id}|${r.paciente_id}|${r.mes_producao}`;
    const jaTem = new Set(retencoes.map(chave));
    // o acerto deste mês (pago no mês que vem) retém os meses vencidos até o anterior
    const sug = retencoesSugeridas({ producaoPorMes, aberto, pacientes, mes })
        .filter(r => r.profissional_id === profId && !jaTem.has(chave(r)));
    const grupos = agruparPorPaciente(sug);
    el('pn-ret-prev-qtd').textContent = grupos.length ? `${grupos.length} paciente(s) · ${formataMoeda(sug.reduce((s, r) => s + r.valor, 0))}` : '';
    el('pn-ret-prev').innerHTML = grupos.length ? grupos.map(g => `
      <div class="pn-item"><span class="quem">${esc(nomePac(g.paciente_id))}<small>em aberto: ${g.meses.map(mesCurto).join(', ')}</small></span>
        <span class="num" style="color:var(--argos-warn)">− ${formataMoeda(g.valor)}</span></div>`).join('')
      : '<p class="pn-vazio">Nenhum paciente seu com mês vencido em aberto. 🎉</p>';

    const retidas = retencoes.filter(r => r.status === 'retido');
    const gruposRet = agruparPorPaciente(retidas);
    el('pn-ret-qtd').textContent = retidas.length ? formataMoeda(retidas.reduce((s, r) => s + (Number(r.valor) || 0), 0)) : '';
    el('pn-retidos').innerHTML = gruposRet.length ? gruposRet.map(g => `
      <div class="pn-item"><span class="quem">${esc(nomePac(g.paciente_id))}<small>retido: ${g.meses.map(mesCurto).join(', ')}</small></span>
        <span class="num">${formataMoeda(g.valor)}</span></div>`).join('')
      : '<p class="pn-vazio">Nada retido no momento.</p>';
}

function renderSimulador() {
    const meta = Number(el('pn-meta').value) || 0;
    const r = el('pn-sim-res');
    if (!meta) { r.innerHTML = `<span class="dim">Digite um valor para ver quantos atendimentos faltam. Média por sessão: <b>${formataMoeda(sim.media)}</b>.</span>`; return; }
    const jaTem = sim.realizado + sim.fixo;
    if (meta <= jaTem) { r.innerHTML = `✅ Meta de <b>${formataMoeda(meta)}</b> já alcançada: o realizado até hoje é <b class="ok">${formataMoeda(jaTem)}</b>.`; return; }
    if (!sim.media) { r.innerHTML = 'Sem valor médio por sessão ainda (nenhuma sessão contabilizada) — não dá para simular.'; return; }
    const faltam = Math.ceil((meta - jaTem) / sim.media);
    const dif = faltam - sim.agendadas;
    r.innerHTML = `Para receber <b>${formataMoeda(meta)}</b> faltam <b class="${dif > 0 ? 'alerta' : 'ok'}">${faltam} atendimento(s)</b> contabilizados até o fim do mês
      (você tem <b>${sim.agendadas}</b> agendado(s)${dif > 0 ? `: precisa de mais <b class="alerta">${dif}</b> além da agenda` : ': a agenda de hoje já cobre'}).
      <span class="dim">Conta feita com a média de ${formataMoeda(sim.media)} por sessão; faltas contabilizadas também contam.</span>`;
}

function renderEvolucoes(hoje) {
    if (!perm.pode('painel_evolucoes')) return;
    const meus = meusPacientesAtivos();
    const lista = pendenciasDeEvolucao({ pacientes: meus, avaliacoes, comAnamnese, hoje });
    const c = contarPendenciasEv(lista);
    el('pn-ev-qtd').textContent = c.total ? `${c.total} em ${c.pacientes} paciente(s)` : '';
    el('pn-evolucoes').innerHTML = lista.length ? lista.map(i => `
      <div class="pn-item"><span class="quem">${i.icone} ${esc(i.paciente.nome)}<small>${esc(i.rotulo)} — ${esc(i.detalhe)}</small></span>
        <a class="argos-btn small primary" href="${i.link}">Preencher →</a></div>`).join('')
      : `<p class="pn-vazio">${meus.length ? 'Todas as evoluções dos seus pacientes estão em dia. 🎉' : 'Nenhum paciente em atendimento com este profissional.'}</p>`;
}

function renderFrequencia(mes, hoje) {
    const minhas = sessoes.filter(s => s.data >= mes + '-01' && s.data <= hoje
        && (s.profissional_id === profId || s.repasse_profissional_id === profId) && !s.validado_em
        && (s.status_proposto || (s.status && s.status !== '??')));
    const prop = minhas.filter(s => s.status_proposto).length;
    el('pn-freq-qtd').textContent = minhas.length ? String(minhas.length) : '';
    el('pn-freq').innerHTML = minhas.length
        ? `<p>${minhas.length} sessão(ões) de ${esc(mesBR(mes))} aguardando a sua validação${prop ? ` (${prop} proposta(s) da recepção)` : ''}.
           <a class="argos-btn small primary" href="frequencia.html?mes=${mes}${perm.escopo.geral ? `&profissional=${profId}` : ''}">Conferir →</a></p>`
        : '<p class="pn-vazio">Frequência em dia. ✔</p>';
}

// ---------------------------------------------------------------- eventos
el('pn-mes').addEventListener('change', render);
el('pn-meta').addEventListener('input', renderSimulador);
el('pn-prof').addEventListener('change', async () => {
    profId = el('pn-prof').value; el('pn-carregando').textContent = 'Calculando…';
    if (profId === VISAO_GERAL) await carregarGestao(); else await carregarDoProfissional();
    render();
});

(async function init() {
    perm = await carregarPermissoes();
    if (!perm.exigirPagina('painel_pagina', 'o painel')) return;
    perm.aplicarVisibilidade();
    el('pn-mes').value = hojeISO().slice(0, 7);
    if (!(await carregarTudo())) return;
    const sel = el('pn-prof');
    if (perm.escopo.geral) {
        const temGeral = perm.pode('painel_gestao');
        sel.innerHTML = (temGeral ? `<option value="${VISAO_GERAL}">🏥 Visão geral da clínica</option>` : '')
            + profissionais.map(p => `<option value="${p.id}">🧑‍⚕️ ${esc(p.nome)}</option>`).join('');
        const pedido = new URLSearchParams(location.search).get('profissional');
        profId = (pedido && profissionais.some(p => p.id === pedido)) ? pedido
            : temGeral ? VISAO_GERAL : (perm.escopo.profissionalId || (profissionais[0] || {}).id);
        sel.value = profId;
    } else {
        profId = perm.escopo.profissionalId;
        sel.innerHTML = `<option value="${profId}">🧑‍⚕️ ${esc((profissionais.find(p => p.id === profId) || {}).nome || '')}</option>`;
        sel.disabled = true;
    }
    if (!profId) { el('pn-carregando').textContent = 'Nenhum profissional vinculado a este usuário.'; return; }
    el('pn-carregando').textContent = 'Calculando…';
    if (profId === VISAO_GERAL) await carregarGestao(); else await carregarDoProfissional();
    render();
})();
