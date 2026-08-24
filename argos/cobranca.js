// cobranca.js — Card "Cobrança e Notas" da área Argos
// ====================================================
// O mês do financeiro, em quatro abas sobre a mesma base:
//   • Fechamento — todo mundo do mês e o link do WhatsApp com a mensagem pronta;
//   • Notas fiscais — só quem recebe nota, com a descrição pronta e o número;
//   • Pendências de nota — o que mudou depois da nota emitida, até resolver;
//   • Em aberto — o acumulado de quem deve, mês a mês.
// O extrato do paciente é um detalhe de qualquer uma delas, não uma aba.

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { fechamentoPaciente, formataMoeda, formataBR, hojeISO, STATUS_SESSAO } from './argos-recorrencia.js';
import {
    SITUACAO_NOTA, situacaoNota, mensagemCobranca, linkWhatsApp, observacaoPadrao,
    saudacaoDe, frequenciaDoFechamento, diasCobrados, acordosDoFechamento, acordoTexto,
    notaEfetiva, retratoDaNota, compararRetrato, motivoDaDivergencia, contatosParaCobranca,
    detalhesDoMes, contarSessoes, mesBR
} from './argos-cobranca.js';
import { montarCobrancaUI, mesesEntre, dinamicasDoMes } from './argos-cobranca-ui.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let cobUI = null;

let pacientes = [], dinamicas = [], sessoes = [], profissionais = [];
let contatos = [], detalhes = [], excecoes = [], notas = [], pendencias = [], eventos = [];
let envios = [], acompanhamento = [], alocacoes = [], movimentacoes = [];
let config = { bancarios: [], servico: 'Psicomotricidade Relacional', recados: {} };

let mesAtual = hojeISO().slice(0, 7);
let abaAtual = 'fechamento';
let abertos = new Set();       // linhas de detalhe expandidas no fechamento
let fechCache = new Map();     // paciente_id -> fechamento do mês corrente

const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
const pctFmt = x => (Math.round(x * 100) / 100).toLocaleString('pt-BR');
const pacDe = id => pacientes.find(p => p.id === id) || { nome: '—' };
const dinsDe = id => dinamicas.filter(d => d.paciente_id === id);
const agora = () => new Date().toISOString();

// ===========================================================================
// CARGA
// ===========================================================================
async function carregarTudo() {
    const t = (tabela, ordem) => ordem
        ? sb.from(tabela).select('*').order(ordem)
        : sb.from(tabela).select('*');
    const r = await Promise.all([
        t('argos_pacientes', 'nome'), t('argos_dinamicas'), t('argos_sessoes'),
        t('argos_profissionais', 'nome'), t('argos_cobranca_contatos'),
        t('argos_paciente_financeiro'), t('argos_nota_mes'), t('argos_notas_fiscais'),
        t('argos_nota_pendencias'), t('argos_nota_pendencia_eventos'),
        t('argos_cobranca_envios'), t('argos_cobranca_acompanhamento'),
        t('argos_mov_alocacoes'), t('argos_movimentacoes'), t('argos_config')
    ]);
    const erro = r.find(x => x.error);
    if (erro) { console.error(erro.error); toast('Erro ao carregar os dados da cobrança.', true); return; }
    const d = r.map(x => x.data || []);
    [pacientes, dinamicas, sessoes, profissionais, contatos, detalhes, excecoes, notas,
     pendencias, eventos, envios, acompanhamento, alocacoes, movimentacoes] = d;
    lerConfig(d[14]);
    await render();
}

function lerConfig(linhas) {
    const achar = c => (linhas.find(l => l.chave === c) || {}).valor || {};
    const banco = achar('dados_bancarios');
    config.bancarios = Array.isArray(banco.linhas) ? banco.linhas : [];
    config.servico = achar('nota_padrao').servico || 'Psicomotricidade Relacional';
    config.recados = achar('recados_mes') || {};
}

async function gravarConfig(chave, valor) {
    const { error } = await sb.from('argos_config')
        .upsert({ chave, valor, atualizado_em: agora() }, { onConflict: 'chave' });
    if (error) { console.error(error); toast('Erro ao salvar a configuração.', true); return false; }
    return true;
}

// ===========================================================================
// O MÊS
// ===========================================================================

/** Fechamento de todos os pacientes no mês escolhido, calculado uma vez só. */
function calcularMes(mes) {
    fechCache = new Map();
    for (const p of pacientes) {
        fechCache.set(p.id, fechamentoPaciente(p, dinsDe(p.id),
            sessoes.filter(s => s.paciente_id === p.id), mes));
    }
}

const fechDe = id => fechCache.get(id) || { sessoes: [], contagens: { '??': 0, ok: 0, fj: 0, fc: 0, nc: 0 }, valor: 0, detalhes: [], porDinamica: [], pendencias: 0 };

/** Regime de nota do paciente naquele mês (exceção do mês > dinâmica). */
function regimeDe(pacienteId, mes) {
    const exc = excecoes.find(e => e.paciente_id === pacienteId && e.mes === mes);
    return notaEfetiva({ dinamicas: dinamicasDoMes(dinsDe(pacienteId), mes), excecao: exc });
}

/** Retrato do mês como está agora — é contra isto que a nota emitida é conferida. */
function retratoAtual(paciente, mes) {
    return retratoDaNota({
        paciente, fech: fechDe(paciente.id), dinamicas: dinsDe(paciente.id),
        mes, servico: config.servico,
        excecao: excecoes.find(e => e.paciente_id === paciente.id && e.mes === mes)
    });
}

const notaDoMes = (pid, mes) => notas.find(n => n.paciente_id === pid && n.mes === mes && n.status === 'emitida') || null;
const envioDoMes = (pid, mes) => envios.filter(e => e.paciente_id === pid && e.mes === mes)
    .sort((a, b) => String(b.enviada_em).localeCompare(String(a.enviada_em)))[0] || null;

// ===========================================================================
// PENDÊNCIAS — nascem sozinhas, saem só quando o financeiro resolve
// ===========================================================================
async function sincronizarPendencias(mes) {
    const novas = [];
    const jaAberta = (pid, motivo) => pendencias.some(p =>
        p.paciente_id === pid && p.mes === mes && p.motivo === motivo
        && (p.status === 'aberta' || p.status === 'em_andamento'));

    for (const p of pacientes) {
        const fech = fechDe(p.id);
        const temMovimento = fech.sessoes.length > 0 || fech.valor > 0;
        const regime = regimeDe(p.id, mes);

        // 1. paciente com produção e sem dados de nota — o caso de quem entrou
        //    direto pela frequência, sem ficha financeira
        if (temMovimento && regime.valor === 'indefinido') {
            const motivo = 'Paciente com produção no mês e sem os dados de nota definidos.';
            if (!jaAberta(p.id, motivo)) {
                novas.push({ paciente_id: p.id, mes, origem: 'indefinido', motivo, status: 'aberta',
                    depois: { valor: fech.valor, sessoes: contarSessoes(frequenciaDoFechamento(fech)) } });
            }
        }

        // 2. nota já emitida que não bate mais com o fechamento de agora
        const nota = notaDoMes(p.id, mes);
        if (!nota) continue;
        const atual = retratoAtual(p, mes);
        const mudou = compararRetrato({
            valor: Number(nota.valor), sessoes: nota.sessoes, dias: nota.dias || [],
            descricao: nota.descricao, nota_tipo: nota.nota_tipo
        }, atual);
        if (!mudou.length) continue;
        const motivo = motivoDaDivergencia(mudou);
        if (jaAberta(p.id, motivo)) continue;
        novas.push({ paciente_id: p.id, mes, nota_id: nota.id, origem: 'divergencia', motivo, status: 'aberta',
            antes: Object.fromEntries(mudou.map(m => [m.campo, m.antes])),
            depois: Object.fromEntries(mudou.map(m => [m.campo, m.depois])) });
    }

    if (!novas.length) return 0;
    const { data, error } = await sb.from('argos_nota_pendencias').insert(novas).select();
    if (error) { console.error(error); return 0; }
    const criadas = data || [];
    pendencias = pendencias.concat(criadas);
    if (criadas.length) {
        const ev = criadas.map(p => ({ pendencia_id: p.id, status: 'aberta',
            texto: 'Pendência aberta pelo sistema: ' + p.motivo, quem: 'sistema' }));
        const { data: evs } = await sb.from('argos_nota_pendencia_eventos').insert(ev).select();
        eventos = eventos.concat(evs || []);
    }
    return criadas.length;
}

// ===========================================================================
// RENDER
// ===========================================================================
async function render() {
    mesAtual = document.getElementById('mes-ref').value || mesAtual;
    calcularMes(mesAtual);
    const criadas = await sincronizarPendencias(mesAtual);
    if (criadas) toast(`⚠️ ${criadas} pendência(s) de nota abertas neste mês.`, true);
    renderFechamento();
    renderNotas();
    renderPendencias();
    renderAberto();
}

// ---------------------------------------------------------------- fechamento
function renderFechamento() {
    const busca = (document.getElementById('busca-fech').value || '').toLowerCase();
    const soMovimento = document.getElementById('so-movimento').checked;
    const esconderEnviadas = document.getElementById('esconder-enviadas').checked;

    const todos = pacientes.map(p => ({ p, f: fechDe(p.id) }));
    const linhas = [];
    const total = { ok: 0, fj: 0, fc: 0, nc: 0, pd: 0, valor: 0, pendencias: 0 };
    let enviadas = 0;

    for (const { p, f } of todos) {
        const temMovimento = f.sessoes.length > 0 || f.valor > 0;
        if (soMovimento && !temMovimento) continue;
        if (busca && !(p.nome || '').toLowerCase().includes(busca)) continue;
        const envio = envioDoMes(p.id, mesAtual);
        if (envio) enviadas++;
        if (esconderEnviadas && envio) continue;
        total.ok += f.contagens.ok; total.fj += f.contagens.fj; total.fc += f.contagens.fc;
        total.nc += f.contagens.nc; total.pd += f.contagens['??'];
        total.valor += f.valor; total.pendencias += f.pendencias;
        linhas.push({ p, f, envio });
    }

    document.getElementById('tbody-fechamento').innerHTML = linhas.map(({ p, f, envio }) => {
        const contatosP = contatosParaCobranca(p, contatos.filter(c => c.paciente_id === p.id));
        const anota = detalhesDoMes(detalhes.filter(d => d.paciente_id === p.id), mesAtual);
        return `
      <tr class="${p.cadastro_removido ? 'linha-removido' : ''} ${envio ? 'enviada' : ''}">
        <td class="livre">${esc(p.nome)}
          ${p.processo_fim_tipo ? `<span class="badge vermelho">${esc(p.processo_fim_tipo)}${p.processo_fim_data ? ' em ' + formataBR(p.processo_fim_data) : ''}</span>` : ''}
          ${f.pendencias ? `<span class="badge vermelho" title="Sessões vencidas sem preenchimento">${f.pendencias} sem frequência</span>` : ''}
          ${anota.length ? `<span class="sub" title="Detalhes financeiros">📝 ${esc(anota.map(a => a.texto).join(' · '))}</span>` : ''}
        </td>
        <td class="num">${f.contagens.ok}</td><td class="num">${f.contagens.fj}</td>
        <td class="num">${f.contagens.fc}</td><td class="num">${f.contagens.nc}</td>
        <td class="num">${f.contagens['??']}</td>
        <td class="num"><b>${formataMoeda(f.valor)}</b></td>
        <td>${contatosP.length
            ? `<button class="argos-btn small ${envio ? '' : 'primary'}" data-msg="${p.id}"
                 data-argos-recurso="cobranca_enviar">${envio ? '✅ Cobrança enviada' : '📲 Enviar mensagem'}</button>
               ${envio ? `<span class="sub">${esc(envio.contato_nome || '')} · ${formataBR(String(envio.enviada_em).slice(0, 10))}</span>` : ''}`
            : '<span class="sub" style="color:var(--argos-danger)">sem contato de cobrança</span>'}</td>
        <td class="acoes">
          <button class="argos-btn small" data-detalhe="${p.id}"
            title="Frequência e lançamentos do mês">${abertos.has(p.id) ? '▲' : '▼'}</button>
          <button class="argos-btn small" data-extrato="${p.id}"
            title="Extrato financeiro do paciente" data-argos-recurso="paciente_extrato">📊</button>
          <button class="argos-btn small" data-financeiro="${p.id}"
            title="Contatos de cobrança e detalhes financeiros">📱</button>
        </td>
      </tr>
      ${abertos.has(p.id) ? linhaDetalhe(p, f) : ''}`;
    }).join('');

    document.getElementById('fechamento-vazio').style.display = linhas.length ? 'none' : '';
    document.getElementById('t-ok').textContent = total.ok;
    document.getElementById('t-fj').textContent = total.fj;
    document.getElementById('t-fc').textContent = total.fc;
    document.getElementById('t-nc').textContent = total.nc;
    document.getElementById('t-pd').textContent = total.pd;
    document.getElementById('t-valor').innerHTML = `<b>${formataMoeda(total.valor)}</b>`;

    const semContato = linhas.filter(l => !contatosParaCobranca(l.p,
        contatos.filter(c => c.paciente_id === l.p.id)).length).length;
    document.getElementById('resumo-fech').innerHTML = `
      <span>Pacientes <b>${linhas.length}</b></span>
      <span>Faturamento do mês <b>${formataMoeda(total.valor)}</b></span>
      <span class="${enviadas ? 'ok' : ''}">Cobranças enviadas <b>${enviadas}</b></span>
      ${semContato ? `<span class="erro">Sem contato de cobrança <b>${semContato}</b></span>` : ''}
      ${total.pendencias ? `<span class="alerta">Sessões sem frequência <b>${total.pendencias}</b></span>` : ''}`;

    const aviso = document.getElementById('aviso-pendencias');
    if (total.pendencias) {
        aviso.style.display = '';
        aviso.textContent = `⚠️ ${total.pendencias} sessão(ões) vencida(s) sem preenchimento neste mês — `
            + 'elas contam como presentes na mensagem do fechamento, mas ainda não entram no valor. '
            + 'Preencha na Agenda para o valor fechar.';
    } else aviso.style.display = 'none';

    renderRepasses(todos);
}

function linhaDetalhe(p, f) {
    return `
    <tr class="linha-detalhe"><td colspan="9">
      <b>🗓️ Frequência do mês:</b>
      ${f.sessoes.length ? '<ul>' + [...f.sessoes].sort((a, b) => a.data.localeCompare(b.data)).map(s => {
          const st = STATUS_SESSAO[s.status] || {};
          return `<li>${formataBR(s.data)} às ${s.hora} — <span class="chip-status" style="--c:${st.cor}">${st.label}</span>${s.justificativa ? ` — 📝 ${esc(s.justificativa)}` : ''}</li>`;
      }).join('') + '</ul>' : '<span class="dim">Sem sessões no mês.</span>'}
      <b style="display:block;margin-top:8px">💰 Lançamentos:</b>
      ${f.detalhes.length ? '<ul>' + f.detalhes.map(d => `<li>${esc(d)}</li>`).join('') + '</ul>'
        : '<span class="dim">Sem lançamentos no mês.</span>'}
      ${(f.porDinamica || []).some(pd => (pd.repasses || []).length) ? `
      <b style="display:block;margin-top:8px">💼 Divisão com profissionais:</b>
      <ul>${(f.porDinamica || []).filter(pd => (pd.repasses || []).length).map(pd => {
          const soma = pd.repasses.reduce((s, r) => s + r.valor, 0);
          return `<li>Sobre ${formataMoeda(pd.valor)}: ${pd.repasses.map(r =>
              `${esc(nomeProf(r.profissional_id))} ${pctFmt(r.pct)}% = <b>${formataMoeda(r.valor)}</b>`).join(' · ')}
              · clínica: <b>${formataMoeda(pd.valor - soma)}</b></li>`;
      }).join('')}</ul>` : ''}
    </td></tr>`;
}

function renderRepasses(todos) {
    const producao = {};
    let faturamento = 0;
    for (const { f } of todos) {
        faturamento += f.valor;
        for (const pd of (f.porDinamica || [])) {
            for (const r of (pd.repasses || [])) {
                producao[r.profissional_id] = (producao[r.profissional_id] || 0) + r.valor;
            }
        }
    }
    let totalRepasses = 0;
    const linhas = profissionais.map(pr => {
        const temFixo = pr.remuneracao_tipo === 'fixo' || pr.remuneracao_tipo === 'producao_fixo';
        const fixo = temFixo ? (Number(pr.valor_fixo_mensal) || 0) : 0;
        const prod = pr.remuneracao_tipo === 'fixo' ? 0 : (producao[pr.id] || 0);
        const t = fixo + prod;
        if (!t) return '';
        totalRepasses += t;
        return `<tr><td>${esc(pr.nome)}</td><td>${fixo ? formataMoeda(fixo) : '—'}</td>
          <td>${prod ? formataMoeda(prod) : '—'}</td><td><b>${formataMoeda(t)}</b></td></tr>`;
    }).filter(Boolean).join('');
    document.getElementById('tbody-repasses').innerHTML = linhas
        || '<tr><td colspan="4" class="dim">Nenhum repasse configurado para este mês.</td></tr>';
    document.getElementById('r-total').innerHTML = `<b>${formataMoeda(totalRepasses)}</b>`;
    document.getElementById('r-clinica').innerHTML = `<b>${formataMoeda(faturamento - totalRepasses)}</b>`;
}

// -------------------------------------------------------------- notas fiscais
function renderNotas() {
    const busca = (document.getElementById('busca-notas').value || '').toLowerCase();
    const filtro = document.getElementById('filtro-nota').value;

    const linhas = [];
    const conta = { emite: 0, comNumero: 0, especial: 0, indefinido: 0, valor: 0 };
    for (const p of pacientes) {
        const f = fechDe(p.id);
        if (!f.sessoes.length && !f.valor) continue;
        const regime = regimeDe(p.id, mesAtual);
        const sit = situacaoNota(regime.valor);
        const nota = notaDoMes(p.id, mesAtual);
        if (sit.emite) conta.emite++;
        if (nota && nota.numero) conta.comNumero++;
        if (regime.valor === 'especial') conta.especial++;
        if (regime.valor === 'indefinido') conta.indefinido++;
        if (sit.emite) conta.valor += f.valor;

        if (busca && !(p.nome || '').toLowerCase().includes(busca)) continue;
        if (filtro === 'emite' && !sit.emite && regime.valor !== 'indefinido') continue;
        if (filtro === 'pendente' && (!sit.emite || (nota && nota.numero))) continue;
        if (filtro === 'especial' && regime.valor !== 'especial') continue;
        if (filtro === 'indefinido' && regime.valor !== 'indefinido') continue;
        linhas.push({ p, f, regime, sit, nota });
    }

    document.getElementById('resumo-notas').innerHTML = `
      <span>A faturar <b>${conta.emite}</b></span>
      <span class="${conta.comNumero === conta.emite && conta.emite ? 'ok' : ''}">Com número <b>${conta.comNumero}</b></span>
      <span>Valor a faturar <b>${formataMoeda(conta.valor)}</b></span>
      ${conta.especial ? `<span class="alerta">Especiais <b>${conta.especial}</b></span>` : ''}
      ${conta.indefinido ? `<span class="erro">Indefinidos <b>${conta.indefinido}</b></span>` : ''}`;

    document.getElementById('tbody-notas').innerHTML = linhas.map(({ p, f, regime, sit, nota }) => {
        const retrato = retratoAtual(p, mesAtual);
        const anota = detalhesDoMes(detalhes.filter(d => d.paciente_id === p.id), mesAtual);
        return `
      <tr>
        <td class="livre">${esc(p.nome)}
          ${anota.length ? `<span class="sub">📝 ${esc(anota.map(a => a.texto).join(' · '))}</span>` : ''}</td>
        <td class="livre">${esc(p.responsavel_financeiro || '—')}
          <span class="sub">${esc(p.rf_cpf || p.cpf || 'sem CPF')}</span></td>
        <td><span class="cb-badge-nota ${regime.valor}" data-regime="${p.id}"
              title="${esc(sit.desc)} — clique para mudar">${esc(sit.rotulo)}
              ${regime.origem === 'mes' ? '<span class="mes">(só este mês)</span>' : ''}</span>
          ${regime.observacao ? `<span class="sub">${esc(regime.observacao)}</span>` : ''}</td>
        <td class="num">${retrato.sessoes}<span class="sub">${retrato.dias.join(', ') || '—'}</span></td>
        <td class="num">${formataMoeda(f.valor)}</td>
        <td class="desc"><div class="cb-desc">${sit.emite ? esc(retrato.descricao)
            : regime.valor === 'indefinido'
              ? '<span style="color:var(--argos-danger)">Faltam os dados de nota — resolva antes de faturar.</span>'
              : '<span class="dim">Este paciente não recebe nota fiscal.</span>'}</div></td>
        <td>${sit.emite ? `<input type="text" class="argos-input n-nota" data-nota-num="${p.id}"
              value="${esc(nota ? nota.numero || '' : '')}" placeholder="nº" />
            ${nota && nota.emitida_em ? `<span class="sub">emitida em ${formataBR(nota.emitida_em)}</span>` : ''}`
            : '<span class="dim">—</span>'}</td>
        <td class="acoes">
          ${sit.emite ? `<button class="argos-btn small primary" data-nota-salvar="${p.id}"
              data-argos-recurso="notas_gerenciar">${nota ? '🔄 Atualizar' : '💾 Registrar'}</button>` : ''}
          ${sit.emite ? `<button class="argos-btn small" data-copiar="${p.id}" title="Copiar a descrição">📋</button>` : ''}
          <button class="argos-btn small" data-extrato="${p.id}" data-argos-recurso="paciente_extrato">📊</button>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('notas-vazio').style.display = linhas.length ? 'none' : '';
}

// ---------------------------------------------------------------- pendências
function renderPendencias() {
    const filtro = document.getElementById('filtro-pend').value;
    const todosMeses = document.getElementById('pend-todos-meses').checked;
    let lista = pendencias.filter(p => {
        if (!todosMeses && p.mes !== mesAtual) return false;
        if (filtro === 'abertas' && !['aberta', 'em_andamento'].includes(p.status)) return false;
        return true;
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const abertas = pendencias.filter(p => ['aberta', 'em_andamento'].includes(p.status));
    document.getElementById('resumo-pend').innerHTML = `
      <span class="${abertas.length ? 'erro' : 'ok'}">Abertas <b>${abertas.length}</b></span>
      <span>Deste mês <b>${abertas.filter(p => p.mes === mesAtual).length}</b></span>
      <span>Resolvidas <b>${pendencias.filter(p => p.status === 'resolvida').length}</b></span>`;

    const ROTULO = { aberta: 'Aberta', em_andamento: 'Em andamento', resolvida: 'Resolvida', ignorada: 'Ignorada' };
    document.getElementById('lista-pendencias').innerHTML = lista.map(p => {
        const pac = pacDe(p.paciente_id);
        const hist = eventos.filter(e => e.pendencia_id === p.id)
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        const campos = Object.keys(p.depois || {});
        const aberta = ['aberta', 'em_andamento'].includes(p.status);
        return `
      <div class="cb-pend ${p.status}">
        <h3>${esc(pac.nome)} — ${esc(mesBR(p.mes))}
          <span class="badge ${aberta ? 'vermelho' : 'azul'}">${ROTULO[p.status] || p.status}</span>
          ${p.origem === 'indefinido' ? '<span class="badge">dados de nota</span>' : '<span class="badge">nota emitida</span>'}
        </h3>
        <p class="motivo">${esc(p.motivo)}</p>
        ${campos.length && p.antes ? `<div class="diff">${campos.map(c => `
          <div><b>${esc(c)}</b><br>
            <span class="antes">${esc(mostrar(c, (p.antes || {})[c]))}</span> →
            <span class="depois">${esc(mostrar(c, (p.depois || {})[c]))}</span></div>`).join('')}</div>` : ''}
        ${hist.length ? `<ul class="hist">${hist.map(e =>
            `<li>${formataBR(String(e.created_at).slice(0, 10))} — ${esc(e.texto || '')}</li>`).join('')}</ul>` : ''}
        ${aberta ? `<div class="acoes" data-argos-recurso="nota_pendencias_resolver">
          <input type="text" class="argos-input" data-pend-txt="${p.id}" placeholder="O que foi feito…" />
          ${p.status === 'aberta' ? `<button class="argos-btn small" data-pend="em_andamento" data-id="${p.id}">▶️ Em andamento</button>` : ''}
          <button class="argos-btn small primary" data-pend="resolvida" data-id="${p.id}">✅ Resolvida</button>
          <button class="argos-btn small ghost" data-pend="ignorada" data-id="${p.id}">🙈 Ignorar</button>
          <button class="argos-btn small" data-pend="nota" data-id="${p.id}"
            data-argos-recurso="notas_gerenciar">🔄 Substituir a nota</button>
        </div>` : `<div class="acoes">
          <button class="argos-btn small" data-pend="reabrir" data-id="${p.id}">↩️ Reabrir</button>
          <button class="argos-btn small" data-extrato="${p.paciente_id}"
            data-argos-recurso="paciente_extrato">📊 Extrato</button>
        </div>`}
      </div>`;
    }).join('');
    document.getElementById('pend-vazio').style.display = lista.length ? 'none' : '';
}

function mostrar(campo, v) {
    if (v == null) return '—';
    if (Array.isArray(v)) return v.join(', ') || '—';
    if (campo === 'valor') return formataMoeda(v);
    if (campo === 'descricao') return String(v).slice(0, 90) + (String(v).length > 90 ? '…' : '');
    return String(v);
}

// ------------------------------------------------------------------ em aberto
/** Meses com produção não coberta por pagamento associado àquele mês. */
function abertoDoPaciente(p, ateMes) {
    const dins = dinsDe(p.id);
    const sess = sessoes.filter(s => s.paciente_id === p.id);
    const alocP = alocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.vinculo_id === p.id);
    const inicios = [...sess.map(s => s.data), ...dins.map(d => d.data_inicio),
        ...alocP.map(a => a.mes_ref + '-01')].filter(Boolean).sort();
    if (!inicios.length) return null;
    const fim = ateMes || hojeISO().slice(0, 7);
    const meses = mesesEntre(inicios[0].slice(0, 7), fim);
    const linhas = [];
    let producao = 0, pago = 0;
    for (const mes of meses) {
        const f = mes === mesAtual ? fechDe(p.id) : fechamentoPaciente(p, dins, sess, mes);
        const pagoMes = alocP.filter(a => a.mes_ref === mes).reduce((s, a) => s + (Number(a.valor) || 0), 0);
        if (!f.valor && !pagoMes) continue;
        producao += f.valor; pago += pagoMes;
        if (f.valor - pagoMes > 0.009) linhas.push({ mes, valor: f.valor, pago: pagoMes });
    }
    const saldo = producao - pago;
    if (saldo <= 0.009) return null;
    return { p, linhas, producao, pago, saldo };
}

function renderAberto() {
    const busca = (document.getElementById('busca-aberto').value || '').toLowerCase();
    const ate = document.getElementById('aberto-ate-mes').checked ? mesAtual : null;
    const lista = pacientes.map(p => abertoDoPaciente(p, ate)).filter(Boolean)
        .filter(x => !busca || (x.p.nome || '').toLowerCase().includes(busca))
        .sort((a, b) => b.saldo - a.saldo);

    const totalAberto = lista.reduce((s, x) => s + x.saldo, 0);
    document.getElementById('resumo-aberto').innerHTML = lista.length ? `
      <span class="erro">Pacientes devendo <b>${lista.length}</b></span>
      <span class="erro">Total em aberto <b>${formataMoeda(totalAberto)}</b></span>
      <span>Meses em aberto <b>${lista.reduce((s, x) => s + x.linhas.length, 0)}</b></span>`
      : '<span class="ok">Nada em aberto. 🎉</span>';

    document.getElementById('tbody-aberto').innerHTML = lista.map(({ p, linhas, producao, pago, saldo }) => {
        const notasP = acompanhamento.filter(a => a.paciente_id === p.id)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        const contatosP = contatosParaCobranca(p, contatos.filter(c => c.paciente_id === p.id));
        return `
      <tr>
        <td class="livre">${esc(p.nome)}
          <span class="sub">${esc(p.responsavel_financeiro || 'sem responsável financeiro')}</span></td>
        <td class="livre">${linhas.map(l =>
            `<span class="badge vermelho" title="produção ${formataMoeda(l.valor)}, recebido ${formataMoeda(l.pago)}">${esc(mesBR(l.mes))}: ${formataMoeda(l.valor - l.pago)}</span>`).join(' ')}</td>
        <td class="num">${formataMoeda(producao)}</td>
        <td class="num">${formataMoeda(pago)}</td>
        <td class="num"><b style="color:var(--argos-danger)">${formataMoeda(saldo)}</b></td>
        <td class="livre">
          <textarea class="argos-input cb-aberto-nota" data-acomp-txt="${p.id}"
            placeholder="Como está a conversa com o responsável…"></textarea>
          <button class="argos-btn small" data-acomp="${p.id}"
            data-argos-recurso="cobranca_acompanhamento">💾 Anotar</button>
          ${notasP.length ? `<span class="sub">${notasP.slice(0, 4).map(n =>
              `${formataBR(String(n.created_at).slice(0, 10))}: ${esc(n.texto)}`).join('<br>')}</span>` : ''}
        </td>
        <td class="acoes">
          ${contatosP.length ? `<button class="argos-btn small primary" data-msg="${p.id}"
              title="Mensagem de cobrança no WhatsApp"
              data-argos-recurso="cobranca_enviar">📲</button>` : '<span class="sub">sem contato</span>'}
          <button class="argos-btn small" data-extrato="${p.id}"
            title="Extrato financeiro do paciente" data-argos-recurso="paciente_extrato">📊</button>
          <button class="argos-btn small" data-financeiro="${p.id}"
            title="Contatos de cobrança e detalhes financeiros">📱</button>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('aberto-vazio').style.display = lista.length ? 'none' : '';
}

// ===========================================================================
// MENSAGEM DE COBRANÇA
// ===========================================================================
let msgPaciente = null;

function abrirMensagem(p) {
    msgPaciente = p;
    const lista = contatosParaCobranca(p, contatos.filter(c => c.paciente_id === p.id));
    if (!lista.length) return toast('Cadastre um contato de cobrança para este paciente.', true);
    if (!config.bancarios.length) toast('Sem dados bancários cadastrados — preencha no ⚙️.', true);
    document.getElementById('msg-titulo').textContent = `Cobrança de ${mesBR(mesAtual)} — ${p.nome}`;
    document.getElementById('msg-contato').innerHTML = lista.map((c, i) =>
        `<option value="${i}">${esc(c.nome)} — ${esc(c.telefone)}${c.papel ? ' (' + esc(c.papel) + ')' : ''}</option>`).join('');
    document.getElementById('msg-saudacao').value = saudacaoDe();
    document.getElementById('msg-observacao').value =
        config.recados[mesAtual] != null ? config.recados[mesAtual] : observacaoPadrao(mesAtual);
    const anota = detalhesDoMes(detalhes.filter(d => d.paciente_id === p.id), mesAtual);
    document.getElementById('msg-detalhes').innerHTML = anota.length
        ? `📝 <b>Detalhes financeiros:</b> ${esc(anota.map(a => a.texto).join(' · '))}`
        : '';
    montarMensagem();
    abrirModal('modal-msg');
}

function montarMensagem() {
    const p = msgPaciente;
    if (!p) return;
    const lista = contatosParaCobranca(p, contatos.filter(c => c.paciente_id === p.id));
    const c = lista[Number(document.getElementById('msg-contato').value) || 0] || lista[0];
    const f = fechDe(p.id);
    const frequencia = frequenciaDoFechamento(f);
    const texto = mensagemCobranca({
        saudacao: document.getElementById('msg-saudacao').value,
        contato: c.nome, mes: mesAtual, paciente: p.nome,
        observacao: document.getElementById('msg-observacao').value.trim(),
        frequencia, sessoes: contarSessoes(frequencia),
        acordo: acordosDoFechamento(f, dinsDe(p.id)),
        total: f.valor, bancarios: config.bancarios
    });
    document.getElementById('msg-texto').value = texto;
    atualizarLink();
}

function atualizarLink() {
    const p = msgPaciente;
    if (!p) return;
    const lista = contatosParaCobranca(p, contatos.filter(c => c.paciente_id === p.id));
    const c = lista[Number(document.getElementById('msg-contato').value) || 0] || lista[0];
    const a = document.getElementById('btn-msg-enviar');
    const link = linkWhatsApp(c.telefone, document.getElementById('msg-texto').value);
    if (link) { a.href = link; a.classList.remove('ghost'); }
    else { a.removeAttribute('href'); a.classList.add('ghost'); }
}

async function marcarEnviada() {
    const p = msgPaciente;
    if (!p) return;
    const lista = contatosParaCobranca(p, contatos.filter(c => c.paciente_id === p.id));
    const c = lista[Number(document.getElementById('msg-contato').value) || 0] || lista[0];
    const registro = {
        paciente_id: p.id, mes: mesAtual, contato_id: c.id || null, contato_nome: c.nome,
        telefone: c.telefone, mensagem: document.getElementById('msg-texto').value,
        enviada_em: agora()
    };
    const { data, error } = await sb.from('argos_cobranca_envios').insert(registro).select();
    if (error) { console.error(error); return toast('Cobrança aberta, mas não deu para registrar o envio.', true); }
    envios = envios.concat(data || [registro]);
    renderFechamento();
    toast('Cobrança marcada como enviada.');
}

// ===========================================================================
// REGIME DE NOTA (um mês, vários ou todos)
// ===========================================================================
let regimePaciente = null;

function abrirRegime(p) {
    regimePaciente = p;
    const atual = regimeDe(p.id, mesAtual);
    document.getElementById('regime-titulo').textContent = `Tipo de nota — ${p.nome}`;
    const sel = document.getElementById('regime-tipo');
    sel.innerHTML = SITUACAO_NOTA.map(o => `<option value="${o.valor}">${o.rotulo}</option>`).join('');
    sel.value = atual.valor;
    document.getElementById('regime-alcance').value = atual.origem === 'mes' ? 'mes' : 'tudo';
    document.getElementById('regime-de').value = mesAtual;
    document.getElementById('regime-ate').value = mesAtual;
    document.getElementById('regime-obs').value = atual.observacao || '';
    descRegime();
    alcanceRegime();
    abrirModal('modal-regime');
}

function descRegime() {
    document.getElementById('regime-desc').textContent =
        situacaoNota(document.getElementById('regime-tipo').value).desc;
}

function alcanceRegime() {
    const a = document.getElementById('regime-alcance').value;
    document.getElementById('regime-periodo').style.display = a === 'periodo' ? '' : 'none';
    document.getElementById('regime-aviso').textContent = a === 'tudo'
        ? 'Muda a dinâmica do paciente: vale para todo mês que não tiver exceção própria.'
        : 'Guarda uma exceção só nos meses escolhidos. A dinâmica fica como está.';
}

async function salvarRegime() {
    const p = regimePaciente;
    if (!p) return;
    const tipo = document.getElementById('regime-tipo').value;
    const obs = document.getElementById('regime-obs').value.trim() || null;
    const alcance = document.getElementById('regime-alcance').value;

    if (alcance === 'tudo') {
        const dins = dinsDe(p.id);
        if (!dins.length) return toast('Este paciente não tem dinâmica para guardar o tipo de nota.', true);
        const { error } = await sb.from('argos_dinamicas').update({ nota_tipo: tipo }).eq('paciente_id', p.id);
        if (error) { console.error(error); return toast('Erro ao salvar na dinâmica.', true); }
        dins.forEach(d => { d.nota_tipo = tipo; });
        toast('Tipo de nota salvo na dinâmica do paciente.');
    } else {
        const de = alcance === 'mes' ? mesAtual : document.getElementById('regime-de').value;
        const ate = alcance === 'mes' ? mesAtual : (document.getElementById('regime-ate').value || de);
        if (!de) return toast('Escolha o mês.', true);
        if (ate < de) return toast('O mês final vem antes do inicial.', true);
        const meses = mesesEntre(de, ate);
        const linhas = meses.map(mes => ({ paciente_id: p.id, mes, nota_tipo: tipo,
            observacao: obs, atualizado_em: agora() }));
        const { error } = await sb.from('argos_nota_mes')
            .upsert(linhas, { onConflict: 'paciente_id,mes' });
        if (error) { console.error(error); return toast('Erro ao salvar a exceção do mês.', true); }
        excecoes = excecoes.filter(e => !(e.paciente_id === p.id && meses.includes(e.mes))).concat(linhas);
        toast(`Tipo de nota aplicado a ${meses.length} mês(es).`);
    }
    fecharModal('modal-regime');
    await render();
}

async function limparRegime() {
    const p = regimePaciente;
    if (!p) return;
    const { error } = await sb.from('argos_nota_mes').delete()
        .eq('paciente_id', p.id).eq('mes', mesAtual);
    if (error) { console.error(error); return toast('Erro ao remover a exceção.', true); }
    excecoes = excecoes.filter(e => !(e.paciente_id === p.id && e.mes === mesAtual));
    toast('Exceção removida — vale de novo o que diz a dinâmica.');
    fecharModal('modal-regime');
    await render();
}

// ===========================================================================
// NOTA FISCAL: registrar e substituir
// ===========================================================================
async function salvarNota(p) {
    const campo = document.querySelector(`[data-nota-num="${p.id}"]`);
    const numero = campo ? campo.value.trim() : '';
    if (!numero) return toast('Escreva o número da nota.', true);
    const retrato = retratoAtual(p, mesAtual);
    const antiga = notaDoMes(p.id, mesAtual);

    const registro = {
        paciente_id: p.id, mes: mesAtual, numero, emitida_em: hojeISO(),
        valor: retrato.valor, sessoes: retrato.sessoes, dias: retrato.dias,
        descricao: retrato.descricao, nota_tipo: retrato.nota_tipo,
        status: 'emitida', substitui_id: antiga ? antiga.id : null,
        atualizado_em: agora()
    };
    // a antiga sai de cena antes, porque só pode haver uma nota vigente por mês
    if (antiga) {
        const { error } = await sb.from('argos_notas_fiscais')
            .update({ status: 'substituida', atualizado_em: agora() }).eq('id', antiga.id);
        if (error) { console.error(error); return toast('Erro ao substituir a nota anterior.', true); }
        antiga.status = 'substituida';
    }
    const { data, error } = await sb.from('argos_notas_fiscais').insert(registro).select();
    if (error) { console.error(error); return toast('Erro ao registrar a nota.', true); }
    notas = notas.concat(data || [registro]);

    // registrar a nota fecha as pendências de divergência daquele mês
    const alvo = pendencias.filter(x => x.paciente_id === p.id && x.mes === mesAtual
        && ['aberta', 'em_andamento'].includes(x.status));
    for (const pend of alvo) {
        await mudarPendencia(pend, 'resolvida', `Nota ${numero} registrada com o fechamento de agora.`, false);
    }
    toast(antiga ? `Nota substituída pela ${numero}.` : `Nota ${numero} registrada.`);
    await render();
}

// ===========================================================================
// FLUXO DA PENDÊNCIA
// ===========================================================================
async function mudarPendencia(pend, status, texto, redesenhar = true) {
    const dados = { status, atualizado_em: agora() };
    if (status === 'resolvida' || status === 'ignorada') {
        dados.resolvida_em = agora();
        dados.resolucao = texto || null;
    }
    if (status === 'aberta') { dados.resolvida_em = null; dados.resolucao = null; }
    const { error } = await sb.from('argos_nota_pendencias').update(dados).eq('id', pend.id);
    if (error) { console.error(error); toast('Erro ao mudar a pendência.', true); return; }
    Object.assign(pend, dados);
    const ev = { pendencia_id: pend.id, status,
        texto: texto || `Passou para "${status}".`, quem: sessionStorage.getItem('usuario') || null };
    const { data } = await sb.from('argos_nota_pendencia_eventos').insert(ev).select();
    eventos = eventos.concat(data || [ev]);
    if (redesenhar) renderPendencias();
}

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
function abrirConfig() {
    renderLinhasBanco(config.bancarios.slice());
    document.getElementById('cfg-servico').value = config.servico;
    document.getElementById('cfg-rot-recado').firstChild.textContent = `Recado de ${mesBR(mesAtual)}`;
    document.getElementById('cfg-recado').value =
        config.recados[mesAtual] != null ? config.recados[mesAtual] : '';
    document.getElementById('cfg-recado').placeholder = observacaoPadrao(mesAtual) || 'Sem recado neste mês';
    abrirModal('modal-config');
}

function renderLinhasBanco(linhas) {
    document.getElementById('cfg-banco').innerHTML = linhas.map((l, i) => `
      <div class="cb-linha-banco">
        <input type="text" class="argos-input" data-banco="${i}" value="${esc(l)}" />
        <button class="argos-btn small" data-banco-sobe="${i}" title="Subir">↑</button>
        <button class="argos-btn small" data-banco-desce="${i}" title="Descer">↓</button>
        <button class="argos-btn small danger" data-banco-rm="${i}" title="Excluir">🗑️</button>
      </div>`).join('');
    previaBanco();
}

const linhasBanco = () => Array.from(document.querySelectorAll('[data-banco]')).map(i => i.value);

function previaBanco() {
    document.getElementById('cfg-banco-previa').textContent =
        'Caso não haja, seguem os dados bancários para o acerto:\n' + linhasBanco().join('\n');
}

async function salvarConfig() {
    const linhas = linhasBanco().map(l => l.trim()).filter(Boolean);
    const servico = document.getElementById('cfg-servico').value.trim() || 'Psicomotricidade Relacional';
    const recado = document.getElementById('cfg-recado').value.trim();
    const recados = { ...config.recados };
    if (recado) recados[mesAtual] = recado; else delete recados[mesAtual];

    const ok1 = await gravarConfig('dados_bancarios', { linhas });
    const ok2 = await gravarConfig('nota_padrao', { servico });
    const ok3 = await gravarConfig('recados_mes', recados);
    if (!(ok1 && ok2 && ok3)) return;
    config = { bancarios: linhas, servico, recados };
    fecharModal('modal-config');
    toast('Padrões da cobrança salvos.');
    await render();
}

// ===========================================================================
// EVENTOS
// ===========================================================================
function trocarAba(qual) {
    abaAtual = qual;
    document.querySelectorAll('#cb-abas .aba').forEach(b =>
        b.classList.toggle('ativa', b.dataset.aba === qual));
    document.querySelectorAll('[data-painel]').forEach(s =>
        s.style.display = s.dataset.painel === qual ? '' : 'none');
}

document.getElementById('cb-abas').addEventListener('click', e => {
    const b = e.target.closest('[data-aba]');
    if (b) trocarAba(b.dataset.aba);
});

function mudarMes(delta) {
    const el = document.getElementById('mes-ref');
    let [a, m] = (el.value || mesAtual).split('-').map(Number);
    m += delta;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    el.value = `${a}-${String(m).padStart(2, '0')}`;
    abertos = new Set();
    render();
}
document.getElementById('btn-mes-ant').addEventListener('click', () => mudarMes(-1));
document.getElementById('btn-mes-prox').addEventListener('click', () => mudarMes(1));
document.getElementById('mes-ref').addEventListener('change', () => { abertos = new Set(); render(); });

['busca-fech', 'so-movimento', 'esconder-enviadas'].forEach(id =>
    document.getElementById(id).addEventListener('input', renderFechamento));
['busca-notas', 'filtro-nota'].forEach(id =>
    document.getElementById(id).addEventListener('input', renderNotas));
['filtro-pend', 'pend-todos-meses'].forEach(id =>
    document.getElementById(id).addEventListener('input', renderPendencias));
['busca-aberto', 'aberto-ate-mes'].forEach(id =>
    document.getElementById(id).addEventListener('input', renderAberto));
document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
document.getElementById('btn-config').addEventListener('click', abrirConfig);

// cliques das tabelas e listas
document.querySelector('main').addEventListener('click', async e => {
    const alvo = sel => e.target.closest(`[${sel}]`);

    const det = alvo('data-detalhe');
    if (det) {
        const id = det.dataset.detalhe;
        if (abertos.has(id)) abertos.delete(id); else abertos.add(id);
        return renderFechamento();
    }
    const ext = alvo('data-extrato');
    if (ext) return cobUI.abrirExtrato(pacDe(ext.dataset.extrato), {
        dinamicas: dinsDe(ext.dataset.extrato),
        sessoes: sessoes.filter(s => s.paciente_id === ext.dataset.extrato),
        notas: notas.filter(n => n.paciente_id === ext.dataset.extrato),
        excecoes: excecoes.filter(x => x.paciente_id === ext.dataset.extrato),
        alocacoes: alocacoes.filter(a => a.vinculo_tipo === 'paciente' && a.vinculo_id === ext.dataset.extrato),
        movimentacoes
    });
    const fin = alvo('data-financeiro');
    if (fin) return cobUI.abrirFinanceiro(pacDe(fin.dataset.financeiro), {
        aoMudar: ({ contatos: cs, detalhes: ds }) => {
            const pid = fin.dataset.financeiro;
            contatos = contatos.filter(c => c.paciente_id !== pid).concat(cs);
            detalhes = detalhes.filter(d => d.paciente_id !== pid).concat(ds);
            renderFechamento(); renderNotas(); renderAberto();
        }
    });
    const msg = alvo('data-msg');
    if (msg) return abrirMensagem(pacDe(msg.dataset.msg));
    const reg = alvo('data-regime');
    if (reg) {
        if (!perm.pode('nota_tipo_definir')) return toast('Sem permissão para mudar o tipo de nota.', true);
        return abrirRegime(pacDe(reg.dataset.regime));
    }
    const salvarN = alvo('data-nota-salvar');
    if (salvarN) return salvarNota(pacDe(salvarN.dataset.notaSalvar));
    const copiar = alvo('data-copiar');
    if (copiar) {
        const p = pacDe(copiar.dataset.copiar);
        await copiarTexto(retratoAtual(p, mesAtual).descricao, 'Descrição copiada.');
        return;
    }
    const acomp = alvo('data-acomp');
    if (acomp) {
        const pid = acomp.dataset.acomp;
        const campo = document.querySelector(`[data-acomp-txt="${pid}"]`);
        const texto = campo ? campo.value.trim() : '';
        if (!texto) return toast('Escreva a anotação.', true);
        const registro = { paciente_id: pid, mes: mesAtual, texto,
            quem: sessionStorage.getItem('usuario') || null };
        const { data, error } = await sb.from('argos_cobranca_acompanhamento').insert(registro).select();
        if (error) { console.error(error); return toast('Erro ao anotar.', true); }
        acompanhamento = acompanhamento.concat(data || [registro]);
        toast('Anotação registrada.');
        return renderAberto();
    }
    const pend = alvo('data-pend');
    if (pend) {
        const p = pendencias.find(x => x.id === pend.dataset.id);
        if (!p) return;
        const acao = pend.dataset.pend;
        if (acao === 'nota') { trocarAba('notas'); document.getElementById('busca-notas').value = pacDe(p.paciente_id).nome; return renderNotas(); }
        if (acao === 'reabrir') return mudarPendencia(p, 'aberta', 'Reaberta.');
        const campo = document.querySelector(`[data-pend-txt="${p.id}"]`);
        const texto = campo ? campo.value.trim() : '';
        if ((acao === 'resolvida' || acao === 'ignorada') && !texto) {
            return toast('Escreva o que foi feito antes de fechar a pendência.', true);
        }
        return mudarPendencia(p, acao, texto);
    }
});

// modal da mensagem
['msg-contato', 'msg-saudacao', 'msg-observacao'].forEach(id =>
    document.getElementById(id).addEventListener('input', montarMensagem));
document.getElementById('msg-texto').addEventListener('input', atualizarLink);
document.getElementById('btn-msg-enviar').addEventListener('click', marcarEnviada);
document.getElementById('btn-msg-copiar').addEventListener('click', () =>
    copiarTexto(document.getElementById('msg-texto').value, 'Mensagem copiada.'));

async function copiarTexto(texto, aviso) {
    try {
        await navigator.clipboard.writeText(texto);
        toast(aviso);
    } catch (e) {
        // sem permissão de área de transferência: o texto continua visível para copiar à mão
        toast('O navegador não deixou copiar — selecione o texto e copie.', true);
    }
}

// modal do regime
document.getElementById('regime-tipo').addEventListener('change', descRegime);
document.getElementById('regime-alcance').addEventListener('change', alcanceRegime);
document.getElementById('btn-regime-salvar').addEventListener('click', salvarRegime);
document.getElementById('btn-regime-limpar').addEventListener('click', limparRegime);

// modal de configuração
document.getElementById('btn-banco-add').addEventListener('click', () =>
    renderLinhasBanco([...linhasBanco(), '']));
document.getElementById('cfg-banco').addEventListener('input', previaBanco);
document.getElementById('cfg-banco').addEventListener('click', e => {
    const linhas = linhasBanco();
    const rm = e.target.closest('[data-banco-rm]');
    if (rm) { linhas.splice(Number(rm.dataset.bancoRm), 1); return renderLinhasBanco(linhas); }
    const sobe = e.target.closest('[data-banco-sobe]');
    if (sobe) {
        const i = Number(sobe.dataset.bancoSobe);
        if (i > 0) { [linhas[i - 1], linhas[i]] = [linhas[i], linhas[i - 1]]; renderLinhasBanco(linhas); }
        return;
    }
    const desce = e.target.closest('[data-banco-desce]');
    if (desce) {
        const i = Number(desce.dataset.bancoDesce);
        if (i < linhas.length - 1) { [linhas[i + 1], linhas[i]] = [linhas[i], linhas[i + 1]]; renderLinhasBanco(linhas); }
    }
});
document.getElementById('btn-config-salvar').addEventListener('click', salvarConfig);

// ===========================================================================
// INÍCIO
// ===========================================================================
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('cobranca_ver') && !perm.master) {
        document.querySelector('main').innerHTML =
            '<p class="dim" style="padding:30px">Sem permissão para ver a cobrança.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    cobUI = montarCobrancaUI(perm);
    document.getElementById('mes-ref').value = mesAtual;
    // a primeira aba visível é a que abre
    const primeira = Array.from(document.querySelectorAll('#cb-abas .aba'))
        .find(b => b.style.display !== 'none');
    if (primeira) trocarAba(primeira.dataset.aba);
    await carregarTudo();
})();
