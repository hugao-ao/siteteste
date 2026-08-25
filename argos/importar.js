// importar.js — carga das planilhas da clínica para dentro do sistema
// ===================================================================
// A tela junta os cinco leitores (frequência, cadastro, notas, financeiro e
// de-para), mostra o que cada arquivo virou e só grava quando você confirma.
// A ordem da gravação importa: paciente antes de dinâmica, dinâmica antes de
// sessão, e assim por diante — quem depende entra depois.

import { sb, todas, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { detectar, TIPOS, ordenarParaCarga, faltando } from './argos-import-deteccao.js';
import { lerFrequencia, chaveNome, COBRA } from './argos-import-freq.js';
import { trechosPorPar, gruposDosHorarios, sessoesDoTrecho, resumo } from './argos-import-dinamicas.js';
import { lerEntradas, lerSaidas, lerDePara, lerDetalhesFinanceiros, blocosDeMeses } from './argos-import-financeiro.js';
import { lerNotas, regimeNoMes } from './argos-import-notas.js';
import { lerCadastro } from './argos-cadastro-import.js';
import { somarDias, hojeISO, paraData, fimDoMes } from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let arquivos = [];          // { nome, texto, tipo, mes, dados, conta }
let entendido = null;       // resultado consolidado, pronto para gravar
let abaAtiva = 'pacientes';

const ANO = 2026;
const el = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Leitura dos arquivos
// ---------------------------------------------------------------------------

/** UTF-8 primeiro; se vier com o caractere de substituição, é ANSI. */
async function lerTexto(file) {
    const buf = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buf);
    return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

async function receber(lista) {
    for (const file of lista) {
        if (!/\.(csv|tsv|txt)$/i.test(file.name)) continue;
        const texto = await lerTexto(file);
        const { tipo, mes, aba } = detectar(file.name, texto);
        arquivos = arquivos.filter(a => a.nome !== file.name);
        arquivos.push({ nome: file.name, texto, tipo, mes, aba });
    }
    arquivos = ordenarParaCarga(arquivos);
    interpretar();
    render();
}

/** Passa cada arquivo pelo leitor certo e junta tudo. */
function interpretar() {
    const porTipo = t => arquivos.filter(a => a.tipo === t);
    const porMes = {};
    for (const a of porTipo('frequencia')) {
        if (!a.mes) { a.conta = 'mês não identificado'; continue; }
        const { linhas, avisos } = lerFrequencia(a.texto, { ano: ANO, mes: a.mes });
        porMes[a.mes] = linhas;
        a.dados = linhas;
        a.avisos = avisos;
        a.conta = `${linhas.length} linhas · ${linhas.reduce((s, l) => s + l.sessoes.length, 0)} sessões`;
    }

    const geral = porTipo('geral')[0];
    const pacientes = geral ? pacientesDaGeral(geral.texto) : [];
    if (geral) geral.conta = `${pacientes.length} pacientes`;

    const cad = porTipo('cadastro')[0];
    const cadastro = cad ? lerCadastro(cad.texto) : { linhas: [], pacientes: [] };
    if (cad) cad.conta = `${cadastro.linhas.length} linhas de acordo`;

    const nt = porTipo('notas')[0];
    const notas = nt ? lerNotas(nt.texto) : { linhas: [] };
    if (nt) nt.conta = `${notas.linhas.length} pacientes`;

    const ent = porTipo('entradas')[0];
    const entradas = ent ? lerEntradas(ent.texto) : { linhas: [] };
    if (ent) ent.conta = `${entradas.linhas.length} lançamentos`;

    const sai = porTipo('saidas')[0];
    const saidas = sai ? lerSaidas(sai.texto) : { linhas: [] };
    if (sai) sai.conta = `${saidas.linhas.length} lançamentos`;

    const pp = porTipo('pagpacientes')[0];
    const depara = pp ? lerDePara(pp.texto) : { linhas: [] };
    if (pp) pp.conta = `${depara.linhas.length} pagadores`;

    const sr = porTipo('saidasref')[0];
    const deparaSaidas = sr ? lerDePara(sr.texto, { chaveCol: 1, valorCol: 2 }) : { linhas: [] };
    if (sr) sr.conta = `${deparaSaidas.linhas.length} despesas`;

    const df = porTipo('detfinanc')[0];
    const detalhes = df ? lerDetalhesFinanceiros(df.texto) : { linhas: [] };
    if (df) df.conta = `${detalhes.linhas.length} anotações`;

    porTipo('derivada').forEach(a => { a.conta = a.aba || 'resumo calculado'; });
    porTipo('desconhecido').forEach(a => { a.conta = 'não sei ler esta aba'; });

    const pares = Object.keys(porMes).length ? trechosPorPar(porMes, ANO) : [];
    const grupos = Object.keys(porMes).length ? gruposDosHorarios(porMes) : [];

    entendido = { porMes, pacientes, cadastro, notas, entradas, saidas,
        depara, deparaSaidas, detalhes, pares, grupos, resumo: resumo(pares, grupos) };
}

/** A aba GERAL é a fonte do cadastro: contatos, responsável e situação. */
function pacientesDaGeral(texto) {
    const { dividirTabela } = window.__argosDividir || {};
    const linhas = (dividirTabela || dividirLocal)(texto);
    if (!linhas.length) return [];
    const cab = linhas[0].map(c => String(c || '').trim());
    const idx = {};
    cab.forEach((c, i) => { if (c && idx[c] === undefined) idx[c] = i; });
    const colsSit = cab.map((c, i) => c === 'SITUAÇÃO' ? i : -1).filter(i => i >= 0);
    const VAZIO = new Set(['', '?????', '-', '—']);
    const lim = v => { const s = String(v || '').replace(/\s+/g, ' ').trim(); return VAZIO.has(s) ? '' : s; };
    const intacto = v => {
        const s = String(v || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
        return VAZIO.has(s) ? '' : s;
    };
    const mapa = new Map();
    for (let i = 1; i < linhas.length; i++) {
        const l = linhas[i];
        const bruto = String(l[idx.PACIENTE] || '').trim();
        if (!bruto || /\(ALUGUEL\)/i.test(bruto)) continue;
        const k = chaveNome(bruto);
        let p = mapa.get(k);
        if (!p) {
            p = { chave: k, nome: bruto.replace(/\([A-ZÇÃ]+\)/gi, ' ').replace(/\s+/g, ' ').trim(),
                cpf: '', email: '', rf: '', rf_cpf: '', rf_whatsapp: '', contato: '', situacoes: [] };
            mapa.set(k, p);
        }
        if (!p.rf_cpf) p.rf_cpf = lim(l[idx.CPF]);
        if (!p.rf) p.rf = lim(l[idx.RF]);
        if (!p.contato) p.contato = intacto(l[idx.CONTATO]);
        if (!p.rf_whatsapp) p.rf_whatsapp = lim(l[idx.WHATSAPP]);
        if (!p.cpf) p.cpf = lim(l[idx['CPF PAC']]);
        if (!p.email) p.email = lim(l[idx.EMAIL]);
        colsSit.forEach(i2 => { if (lim(l[i2])) p.situacoes.push(lim(l[i2])); });
    }
    return [...mapa.values()].map(p => ({
        ...p, ativo: !!p.situacoes.length && p.situacoes[p.situacoes.length - 1].toLowerCase() === 'ativo'
    })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// divisor local, igual ao do módulo de cadastro (evita import circular na página)
function dividirLocal(texto) {
    const t = String(texto || '').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const primeira = t.slice(0, t.indexOf('\n') === -1 ? t.length : t.indexOf('\n'));
    const sep = primeira.includes('\t') ? '\t' : ',';
    const linhas = [];
    let campo = '', linha = [], aspas = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (aspas) {
            if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
            else campo += c;
        } else if (c === '"') aspas = true;
        else if (c === sep) { linha.push(campo); campo = ''; }
        else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
        else campo += c;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(l => l.length > 1 || (l[0] || '').trim());
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------
function render() {
    el('imp-arquivos').innerHTML = arquivos.map(a => {
        const t = TIPOS[a.tipo] || TIPOS.desconhecido;
        const mes = a.tipo === 'frequencia' && a.mes
            ? ` <span class="badge azul">${['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][a.mes]}</span>` : '';
        return `<div class="imp-arq ${a.tipo}">
          <span class="ico">${t.icone}</span>
          <span class="tipo">${esc(t.rotulo)}${mes}</span>
          <span class="nome">${esc(a.nome)}</span>
          <span class="conta">${esc(a.conta || '')}</span>
        </div>`;
    }).join('');
    el('imp-drop').classList.toggle('carregado', arquivos.length > 0);

    const temAlgo = arquivos.some(a => !['derivada', 'desconhecido'].includes(a.tipo));
    el('imp-passo2').style.display = temAlgo ? '' : 'none';
    el('imp-passo3').style.display = temAlgo ? '' : 'none';
    if (!temAlgo) return;

    const r = entendido.resumo;
    el('imp-chips').innerHTML = [
        chip('Pacientes', entendido.pacientes.length),
        chip('Dinâmicas', r.dinamicas),
        chip('Mudanças de horário', r.continuacoes),
        chip('Grupos', r.grupos),
        chip('Sessões', r.sessoes),
        chip('Notas com número', entendido.notas.linhas.reduce((s, l) =>
            s + Object.values(l.meses).filter(m => m.numero).length, 0)),
        chip('Entradas', entendido.entradas.linhas.length),
        chip('Saídas', entendido.saidas.linhas.length)
    ].join('');

    const avisos = [...faltando(arquivos),
        ...arquivos.flatMap(a => (a.avisos || []).slice(0, 3))];
    el('imp-avisos').innerHTML = avisos.map(t => `<li>${esc(t)}</li>`).join('');

    const abas = [['pacientes', 'Pacientes'], ['dinamicas', 'Dinâmicas'], ['grupos', 'Grupos'],
        ['notas', 'Notas'], ['financeiro', 'Financeiro']];
    el('imp-abas').innerHTML = abas.map(([k, t]) =>
        `<button data-aba="${k}" class="${abaAtiva === k ? 'ativa' : ''}">${t}</button>`).join('');
    renderTabela();
    renderEtapas();
}

const chip = (rotulo, n) => `<span class="imp-chip ${n ? 'ok' : ''}">${rotulo} <b>${n}</b></span>`;

function renderTabela() {
    const tab = el('imp-tabela');
    const linha = (cels, th) => `<tr>${cels.map(c => `<${th ? 'th' : 'td'}>${c}</${th ? 'th' : 'td'}>`).join('')}</tr>`;
    if (abaAtiva === 'pacientes') {
        tab.innerHTML = linha(['Paciente', 'Responsável', 'WhatsApp', 'Situação'], true)
            + entendido.pacientes.slice(0, 200).map(p => linha([
                esc(p.nome), esc(p.rf || '—'), esc(p.rf_whatsapp || '—'),
                p.ativo ? '<span class="badge azul">ativo</span>' : '<span class="badge vermelho">inativo</span>'
            ])).join('');
    } else if (abaAtiva === 'dinamicas') {
        const l = entendido.pares.flatMap(p => p.trechos.map((t, i) => ({ p, t, i })));
        tab.innerHTML = linha(['Paciente', 'Profissional', 'Horário', 'De', 'Até', 'Sessões', ''], true)
            + l.slice(0, 250).map(({ p, t, i }) => linha([
                esc(p.paciente), esc(p.profissional),
                t.hora ? `${['Dom', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb'][t.dow]} ${t.hora}` : '<span class="dim">avulso</span>',
                t.de, t.ate, t.sessoes.length,
                i ? '<span class="badge azul">continuação</span>' : ''
            ])).join('');
    } else if (abaAtiva === 'grupos') {
        tab.innerHTML = linha(['Grupo', 'Pacientes', 'Maior turma', 'Profissionais', 'Meses'], true)
            + entendido.grupos.map(g => linha([
                `<b>${esc(g.nome)}</b>`, g.pacientes.length, g.maiorTurma,
                g.profissionais.length ? esc(g.profissionais.join(', ')) : '<span class="dim">só Patricia</span>',
                g.meses.length
            ])).join('');
    } else if (abaAtiva === 'notas') {
        const l = entendido.notas.linhas.flatMap(x => Object.entries(x.meses)
            .filter(([, m]) => m.numero || m.divergente)
            .map(([mes, m]) => ({ x, mes, m })));
        tab.innerHTML = linha(['Paciente', 'Mês', 'Regime', 'Nº da nota', 'Valor', 'Confere?'], true)
            + l.slice(0, 250).map(({ x, mes, m }) => linha([
                esc(x.paciente), mes, esc(m.regime || '—'), esc(m.numero || '—'),
                m.valor == null ? '—' : m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                m.divergente ? '<span class="badge vermelho">virou pendência</span>' : '<span class="badge azul">ok</span>'
            ])).join('');
    } else {
        const e = entendido.entradas.linhas.slice(0, 120);
        tab.innerHTML = linha(['Data', 'Valor', 'Pagador', 'Paciente', 'Mês de produção'], true)
            + e.map(x => linha([
                x.data, x.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                esc(x.pagador), esc(x.paciente),
                x.mes_ref || '<span class="dim">sem mês</span>'
            ])).join('');
    }
}

const ETAPAS = [
    { id: 'pacientes', rotulo: 'Pacientes', opt: 'opt-pacientes' },
    { id: 'contatos', rotulo: 'Contatos de cobrança', opt: 'opt-pacientes' },
    { id: 'detalhes', rotulo: 'Detalhes financeiros', opt: 'opt-pacientes' },
    { id: 'dinamicas', rotulo: 'Dinâmicas (com continuação)', opt: 'opt-dinamicas' },
    { id: 'grupos', rotulo: 'Grupos e membros', opt: 'opt-dinamicas' },
    { id: 'sessoes', rotulo: 'Sessões', opt: 'opt-dinamicas' },
    { id: 'notas', rotulo: 'Notas fiscais', opt: 'opt-notas' },
    { id: 'movimentacoes', rotulo: 'Entradas e saídas', opt: 'opt-financeiro' },
    { id: 'alocacoes', rotulo: 'Associação ao mês de produção', opt: 'opt-financeiro' },
    { id: 'depara', rotulo: 'De-para de pagadores e despesas', opt: 'opt-financeiro' }
];
let estado = {};

function renderEtapas() {
    el('imp-etapas').innerHTML = ETAPAS.map(e => {
        const s = estado[e.id] || {};
        const ico = s.erro ? '⛔' : s.pronta ? '✅' : s.fazendo ? '⏳' : '·';
        return `<div class="imp-etapa ${s.erro ? 'erro' : s.pronta ? 'pronta' : s.fazendo ? 'fazendo' : ''}">
          <span class="sit">${ico}</span>
          <span class="oque">${esc(e.rotulo)}</span>
          <span class="qtd">${s.erro ? esc(s.erro) : s.qtd != null ? s.qtd : ''}</span>
        </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
const drop = el('imp-drop');
drop.addEventListener('click', () => el('imp-arquivo').click());
el('imp-arquivo').addEventListener('change', e => receber(e.target.files));
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('sobre');
}));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('sobre');
}));
drop.addEventListener('drop', e => receber(e.dataTransfer.files));
el('btn-limpar').addEventListener('click', () => {
    arquivos = []; entendido = null; estado = {};
    el('imp-arquivo').value = '';
    render();
});
el('imp-abas').addEventListener('click', e => {
    const b = e.target.closest('[data-aba]');
    if (!b) return;
    abaAtiva = b.dataset.aba;
    render();
});
el('btn-importar').addEventListener('click', importar);

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------
const marcar = (id, campos) => {
    if (campos.fazendo) etapaAtual = id;
    if (campos.pronta && etapaAtual === id) etapaAtual = null;
    estado[id] = { ...(estado[id] || {}), ...campos };
    renderEtapas();
};

/**
 * Esvazia uma tabela apagando pelos ids que ela tem. É mais explícito que um
 * delete sem filtro e não depende de um truque de "id diferente de zero".
 */
async function esvaziar(tabela) {
    const { data, error } = await todas(() => sb.from(tabela).select('id'));
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const ids = (data || []).map(r => r.id);
    for (let i = 0; i < ids.length; i += 200) {
        const { error: e2 } = await sb.from(tabela).delete().in('id', ids.slice(i, i + 200));
        if (e2) throw new Error(`${tabela}: ${e2.message}`);
    }
    return ids.length;
}

/** Insere em blocos: uma requisição gigante estoura, mil pequenas demoram. */
async function inserir(tabela, linhas, tamanho = 400) {
    let n = 0;
    for (let i = 0; i < linhas.length; i += tamanho) {
        const { error } = await sb.from(tabela).insert(linhas.slice(i, i + tamanho));
        if (error) throw new Error(`${tabela}: ${error.message}`);
        n += Math.min(tamanho, linhas.length - i);
    }
    return n;
}

let etapaAtual = null;

async function importar() {
    if (!entendido) return;
    const quer = id => el(ETAPAS.find(e => e.id === id).opt).checked;
    el('btn-importar').disabled = true;
    estado = {};
    etapaAtual = null;
    try {
        const idPorChave = quer('pacientes')
            ? await gravarPacientes()
            : await mapaDePacientes();

        if (quer('contatos')) await gravarContatos(idPorChave);
        if (quer('detalhes')) await gravarDetalhes(idPorChave);
        let idDinamica = new Map();
        if (quer('dinamicas')) idDinamica = await gravarDinamicas(idPorChave);
        if (quer('grupos')) await gravarGrupos(idPorChave);
        if (quer('sessoes')) await gravarSessoes(idPorChave, idDinamica);
        if (quer('notas')) await gravarNotas(idPorChave);
        if (quer('movimentacoes')) await gravarFinanceiro(idPorChave);
        if (quer('depara')) await gravarDePara(idPorChave);
        toast('Importação concluída.');
        el('imp-progresso').textContent = 'Pronto — pode conferir nas páginas de Pacientes, Agenda e Cobrança.';
    } catch (e) {
        console.error(e);
        // sem isto a etapa em curso fica girando para sempre e esconde o erro
        if (etapaAtual) marcar(etapaAtual, { fazendo: false, erro: e.message });
        toast(`Parou: ${e.message}`, true);
        el('imp-progresso').textContent = `Parou em: ${e.message}`;
    } finally {
        el('btn-importar').disabled = false;
    }
}

async function mapaDePacientes() {
    const { data } = await todas(() => sb.from('argos_pacientes').select('id, nome'));
    const m = new Map();
    (data || []).forEach(p => m.set(chaveNome(p.nome), p.id));
    return m;
}

/**
 * Quem aparece na frequência mas não no cadastro. São gente de verdade, com
 * sessão marcada — normalmente entraram pela seção OUTROS da planilha, que a
 * secretária usa para lançar quem chegou antes de ter ficha. Criá-los com o
 * nome é melhor que descartar a sessão: eles entram como "indefinido" e a
 * página de Cobrança e Notas cobra os dados que faltam.
 */
function pacientesSoDaFrequencia() {
    const noCadastro = new Set(entendido.pacientes.map(p => p.chave));
    const mapa = new Map();
    for (const p of entendido.pares) {
        if (noCadastro.has(p.chave) || mapa.has(p.chave)) continue;
        mapa.set(p.chave, { chave: p.chave, nome: p.paciente, cpf: '', email: '',
            rf: '', rf_cpf: '', rf_whatsapp: '', contato: '', ativo: true, soFrequencia: true });
    }
    return [...mapa.values()];
}

// Data do corte de quem saiu: o dia seguinte ao último atendimento que a
// frequência registrou. Sem isso o paciente entra como inativo mas sem data,
// e aplicarFimDeProcesso corta só a partir de HOJE — a agenda segue
// projetando meses de sessões para quem parou de vir em fevereiro.
function fimDosInativos() {
    const fim = new Map();
    for (const par of (entendido.pares || [])) {
        let ultima = null, primeiroInicio = null;
        for (const t of par.trechos) {
            if (t.de && (!primeiroInicio || t.de < primeiroInicio)) primeiroInicio = t.de;
            for (const s of sessoesDoTrecho(t)) if (!ultima || s.data > ultima) ultima = s.data;
        }
        // quem tem histórico é cortado no dia seguinte ao último atendimento;
        // quem foi agendado e nunca veio é cortado no próprio início, para
        // não deixar um horário fantasma na agenda
        if (ultima) fim.set(par.chave, somarDias(ultima, 1));
        else if (primeiroInicio) fim.set(par.chave, primeiroInicio);
    }
    return fim;
}

async function gravarPacientes() {
    marcar('pacientes', { fazendo: true });
    const fimDePacienteInativo = fimDosInativos();
    const existentes = await mapaDePacientes();
    const extras = pacientesSoDaFrequencia();
    const todos = [...entendido.pacientes, ...extras];
    const novos = todos.filter(p => !existentes.has(p.chave));
    if (novos.length) {
        await inserir('argos_pacientes', novos.map(p => ({
            nome: p.nome, cpf: p.cpf || null, email: p.email || null,
            responsavel_financeiro: p.rf || null, rf_cpf: p.rf_cpf || null,
            rf_whatsapp: p.rf_whatsapp || null, contato: p.contato || null,
            ativo: p.ativo, processo_fim_tipo: p.ativo ? null : 'inativo',
            processo_fim_data: p.ativo ? null : (fimDePacienteInativo.get(p.chave) || null)
        })));
    }
    const mapa = await mapaDePacientes();
    marcar('pacientes', { fazendo: false, pronta: true,
        qtd: `${novos.length} novos${extras.length ? ` (${extras.length} vindos só da frequência)` : ''}`
            + ` · ${todos.length - novos.length} já existiam` });
    return mapa;
}

async function gravarContatos(idPorChave) {
    marcar('contatos', { fazendo: true });
    const linhas = entendido.pacientes
        .filter(p => p.rf_whatsapp && idPorChave.has(p.chave))
        .map(p => ({ paciente_id: idPorChave.get(p.chave), nome: p.rf || p.nome,
            telefone: p.rf_whatsapp, papel: 'Responsável financeiro', principal: true }));
    const ids = [...new Set(linhas.map(l => l.paciente_id))];
    for (let i = 0; i < ids.length; i += 200) {
        await sb.from('argos_cobranca_contatos').delete().in('paciente_id', ids.slice(i, i + 200));
    }
    const n = await inserir('argos_cobranca_contatos', linhas);
    marcar('contatos', { fazendo: false, pronta: true, qtd: n });
}

async function gravarDetalhes(idPorChave) {
    marcar('detalhes', { fazendo: true });
    const linhas = [];
    for (const d of entendido.detalhes.linhas) {
        const pid = idPorChave.get(d.chave);
        if (!pid) continue;
        if (d.escopo === 'geral') {
            linhas.push({ paciente_id: pid, texto: d.texto, escopo: 'geral' });
        } else {
            for (const b of blocosDeMeses(d.meses, ANO)) {
                linhas.push({ paciente_id: pid, texto: d.texto, escopo: 'periodo',
                    mes_de: b.mes_de, mes_ate: b.mes_ate });
            }
        }
    }
    const ids = [...new Set(linhas.map(l => l.paciente_id))];
    for (let i = 0; i < ids.length; i += 200) {
        await sb.from('argos_paciente_financeiro').delete().in('paciente_id', ids.slice(i, i + 200));
    }
    const n = await inserir('argos_paciente_financeiro', linhas);
    marcar('detalhes', { fazendo: false, pronta: true, qtd: n });
}

async function gravarDinamicas(idPorChave) {
    marcar('dinamicas', { fazendo: true });
    const { data: profs } = await sb.from('argos_profissionais').select('id, nome');
    const idProf = new Map((profs || []).map(p => [p.nome.toLowerCase(), p.id]));
    const notasPorChave = new Map(entendido.notas.linhas.map(l => [l.chave, l]));
    const acordoPorChave = mapaDeAcordos();

    const alvo = entendido.pares.map(p => idPorChave.get(p.chave)).filter(Boolean);
    for (let i = 0; i < alvo.length; i += 200) {
        await sb.from('argos_dinamicas').delete().in('paciente_id', alvo.slice(i, i + 200));
    }

    const idDinamica = new Map();
    const semPaciente = [];
    let n = 0;
    for (const p of entendido.pares) {
        const pid = idPorChave.get(p.chave);
        if (!pid) { semPaciente.push(p.paciente); continue; }
        let anterior = null;
        const fatias = fatiasDoPar(p, acordoPorChave);
        for (const f of fatias) {
            const mesInicial = f.meses[0];
            const acordo = f.acordo;
            const nota = notasPorChave.get(p.chave);
            const ultima = f === fatias[fatias.length - 1];
            const registro = {
                paciente_id: pid,
                rotulo: f.hora ? `${p.profissional} — ${['Dom', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb'][f.dow]} ${f.hora}` : `${p.profissional} — avulso`,
                recorrencia_tipo: f.hora ? 'recorrente' : 'avulsa',
                dias: f.hora ? [{ dow: f.dow, hora: f.hora }] : [],
                duracao_min: 60,
                data_inicio: f.de,
                fim_tipo: ultima ? 'indeterminado' : 'data',
                fim_data: ultima ? null : f.ate,
                // a clínica atende em grupo: o horário fixo que aparece no bloco
                // GRUPO da frequência é compartilhado por vários pacientes, e
                // marcá-lo como individual fazia a regra de conflito recusar
                // qualquer edição («já tem sessão INDIVIDUAL de fulano»)
                modalidade: (f.sessoes || []).some(x => x.bloco === 'grupo') ? 'grupo' : 'individual',
                acordo_tipo: acordo.tipo === 'fixo' ? 'fixo_mensal' : 'por_sessao',
                valor: acordo.valor ?? null,
                nota_tipo: nota ? regimeNoMes(nota, mesInicial) : 'indefinido',
                profissional_id: idProf.get(p.profissional.toLowerCase()) || null,
                repasses: idProf.get(p.profissional.toLowerCase())
                    ? [{ profissional_id: idProf.get(p.profissional.toLowerCase()), tipo: 'percentual', valor: null }]
                    : [],
                continuacao_de: anterior,
                ativo: true
            };
            const { data, error } = await sb.from('argos_dinamicas').insert(registro).select('id').single();
            if (error) throw new Error(`dinâmica de ${p.paciente}: ${error.message}`);
            anterior = data.id;
            idDinamica.set(chaveTrecho(p, f), data.id);
            n++;
            if (n % 25 === 0) marcar('dinamicas', { qtd: `${n}…` });
        }
    }
    marcar('dinamicas', { fazendo: false, pronta: true,
        qtd: semPaciente.length
            ? `${n} — ${semPaciente.length} sem cadastro: ${[...new Set(semPaciente)].slice(0, 4).join(', ')}`
            : n });
    return idDinamica;
}

const chaveTrecho = (p, t) => `${p.chave}|${p.profissional}|${t.de}`;

const primeiroDiaDoMes = m => `${ANO}-${String(m).padStart(2, '0')}-01`;
const ultimoDiaDoMes = m => fimDoMes(`${ANO}-${String(m).padStart(2, '0')}`);

/**
 * O acordo financeiro muda no meio do ano: a aba CADASTRO guarda um valor
 * POR MÊS. Um paciente que passou de R$ 150 para R$ 170 em março não é uma
 * dinâmica só — são duas, encadeadas, como já acontece quando o horário
 * muda. Sem isso o ano inteiro fica com o valor de janeiro e o fechamento
 * dos meses seguintes sai errado.
 *
 * Recebe o trecho (mesmo dia/hora) e devolve os pedaços em que o acordo se
 * manteve igual, cada um com o seu próprio período.
 */
function fatiasDoTrecho(t, acordos) {
    const meses = [...(t.meses || [])].sort((a, b) => a - b);
    const acordoDe = m => acordos[m] || acordos[meses[0]] || acordos[1] || {};
    if (!meses.length) return [{ ...t, meses: [], acordo: acordoDe(1) }];

    const mesmo = (a, b) => (a.tipo || '') === (b.tipo || '')
        && (a.valor ?? null) === (b.valor ?? null);
    const partes = [];
    for (const m of meses) {
        const ac = acordoDe(m);
        const ultima = partes[partes.length - 1];
        if (ultima && mesmo(ultima.acordo, ac)) { ultima.meses.push(m); continue; }
        partes.push({ dow: t.dow, hora: t.hora, sessoes: t.sessoes, meses: [m], acordo: ac });
    }
    return partes.map((f, i) => ({
        ...f, trecho: t,
        de: i === 0 ? t.de : primeiroDiaDoMes(f.meses[0]),
        ate: i === partes.length - 1 ? t.ate : ultimoDiaDoMes(f.meses[f.meses.length - 1])
    }));
}

/** Todas as fatias do paciente, na ordem, prontas para virar dinâmicas. */
function fatiasDoPar(p, acordoPorChave) {
    const acordos = acordoPorChave.get(`${p.chave}|${p.profissional}`) || {};
    return p.trechos.flatMap(t => fatiasDoTrecho(t, acordos));
}

/** Acordo mês a mês vindo da aba CADASTRO. */
function mapaDeAcordos() {
    const m = new Map();
    for (const l of entendido.cadastro.linhas || []) {
        const k = `${l.paciente_chave}|${l.profissional}`;
        const porMes = {};
        (l.acordos || []).forEach(b => {
            const de = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].indexOf(b.de) + 1;
            const ate = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].indexOf(b.ate) + 1;
            for (let x = de; x <= ate; x++) porMes[x] = { tipo: b.tipo, valor: b.valor };
        });
        m.set(k, porMes);
    }
    return m;
}

async function gravarGrupos(idPorChave) {
    marcar('grupos', { fazendo: true });
    const { data: profs } = await sb.from('argos_profissionais').select('id, nome');
    const idProf = new Map((profs || []).map(p => [p.nome.toLowerCase(), p.id]));
    await esvaziar('argos_grupos');
    let n = 0;
    for (const g of entendido.grupos) {
        const { data, error } = await sb.from('argos_grupos')
            .insert({ nome: g.nome, dow: g.dow, hora: g.hora, duracao_min: 60, ativo: true })
            .select('id').single();
        if (error) throw new Error(`grupo ${g.nome}: ${error.message}`);
        const membros = g.pacientes.map(c => idPorChave.get(c)).filter(Boolean)
            .map(pid => ({ grupo_id: data.id, paciente_id: pid }));
        if (membros.length) await inserir('argos_grupo_membros', membros);
        const gp = g.profissionais.map(nome => idProf.get(nome.toLowerCase())).filter(Boolean)
            .map(pid => ({ grupo_id: data.id, profissional_id: pid }));
        if (gp.length) await inserir('argos_grupo_profissionais', gp);
        n++;
    }
    marcar('grupos', { fazendo: false, pronta: true, qtd: n });
}

// Semanas em que o horário fixo existia mas a frequência não registrou nada:
// feriado, recesso, clínica fechada. Ficam como «não houve» — sem isso a
// agenda projeta a sessão, não acha registro e cobra o preenchimento de mil e
// tantas ocorrências que nunca aconteceram.
function semanasSemRegistro(trecho, registradas, coberto, aberto) {
    if (!trecho.hora || trecho.dow == null || !trecho.de) return [];
    // Até onde a planilha fala: dentro do período coberto pelas abas de
    // frequência, ausência de registro é ausência de atendimento; depois
    // dele é desconhecido, e desconhecido continua pendente.
    // O último trecho de cada paciente vira dinâmica sem data de fim — a
    // agenda projeta dali até hoje —, então ele vai até onde a planilha vai,
    // e não até o fim do seu próprio mês.
    const fim = aberto ? [coberto, hojeISO()] : [trecho.ate, coberto, hojeISO()];
    const limite = fim.filter(Boolean).sort()[0];
    const vazias = [];
    for (let iso = trecho.de, passos = 0; iso <= limite && passos < 400; iso = somarDias(iso, 1), passos++) {
        if (paraData(iso).getDay() !== Number(trecho.dow)) continue;
        if (!registradas.has(`${iso}|${trecho.hora}`)) vazias.push(iso);
    }
    return vazias;
}

async function gravarSessoes(idPorChave, idDinamica) {
    marcar('sessoes', { fazendo: true });
    const meses = Object.keys(entendido.porMes || {}).map(Number).filter(Boolean).sort((a, b) => a - b);
    const ultimoMesCoberto = meses.length
        ? fimDoMes(`${ANO}-${String(meses[meses.length - 1]).padStart(2, '0')}`) : null;
    // quem já saiu não tem horário aberto: o último trecho dele termina onde
    // termina, e não segue até o fim do que a planilha cobre
    const inativos = new Set((entendido.pacientes || [])
        .filter(x => !x.ativo).map(x => x.chave));
    const acordoPorChave = mapaDeAcordos();
    const linhas = [];
    for (const p of entendido.pares) {
        const pid = idPorChave.get(p.chave);
        if (!pid) continue;
        // as fatias são as mesmas de gravarDinamicas: cada sessão precisa cair
        // na dinâmica que valia no mês dela, senão vai para o acordo errado
        const fatias = fatiasDoPar(p, acordoPorChave);
        const ultima = inativos.has(p.chave) ? null : fatias[fatias.length - 1];
        for (const f of fatias) {
            const did = idDinamica.get(chaveTrecho(p, f)) || null;
            const registradas = new Set();
            for (const s of sessoesDoTrecho(f.trecho)) {
                if (s.data < f.de || s.data > f.ate) continue;
                registradas.add(`${s.data}|${s.hora}`);
                linhas.push({ paciente_id: pid, dinamica_id: did, dinamica_ref: did,
                    data: s.data, hora: s.hora, duracao_min: 60, status: s.status });
            }
            for (const vazio of semanasSemRegistro(f, registradas, ultimoMesCoberto, f === ultima)) {
                linhas.push({ paciente_id: pid, dinamica_id: did, dinamica_ref: did,
                    data: vazio, hora: f.hora, duracao_min: 60, status: 'nc',
                    justificativa: 'Sem registro na planilha de frequência' });
            }
        }
    }
    const ids = [...new Set(linhas.map(l => l.paciente_id))];
    for (let i = 0; i < ids.length; i += 200) {
        await sb.from('argos_sessoes').delete().in('paciente_id', ids.slice(i, i + 200));
    }
    const n = await inserir('argos_sessoes', linhas, 500);
    marcar('sessoes', { fazendo: false, pronta: true, qtd: n });
}

async function gravarNotas(idPorChave) {
    marcar('notas', { fazendo: true });
    // Um paciente pode ocupar duas linhas da planilha (dois horários na
    // semana), mas a clínica emite UMA nota por mês: o número se repete nas
    // duas linhas. Então as linhas do mesmo mês são somadas numa nota só —
    // é isso que a planilha quer dizer e é o que o banco aceita.
    const porNota = new Map();
    for (const l of entendido.notas.linhas) {
        const pid = idPorChave.get(l.chave);
        if (!pid) continue;
        for (const [mes, m] of Object.entries(l.meses)) {
            if (!m.numero) continue;
            const chave = `${pid}|${mes}`;
            const valor = m.valor_nota ?? m.valor;
            const nota = porNota.get(chave);
            if (!nota) {
                porNota.set(chave, { paciente_id: pid, mes: `${ANO}-${String(mes).padStart(2, '0')}`,
                    numero: m.numero, valor: valor ?? 0, sessoes: null,
                    dias: [...m.dias], descricao: m.descricao || null, nota_tipo: m.regime,
                    status: 'emitida' });
                continue;
            }
            nota.valor += valor || 0;
            for (const d of m.dias) if (!nota.dias.includes(d)) nota.dias.push(d);
            nota.dias.sort((a, b) => a - b);
            if (m.descricao && m.descricao !== nota.descricao) {
                nota.descricao = nota.descricao ? `${nota.descricao} ${m.descricao}` : m.descricao;
            }
            nota.nota_tipo = nota.nota_tipo || m.regime;
        }
    }
    const linhas = [...porNota.values()];
    const ids = [...new Set(linhas.map(l => l.paciente_id))];
    for (let i = 0; i < ids.length; i += 200) {
        await sb.from('argos_notas_fiscais').delete().in('paciente_id', ids.slice(i, i + 200));
    }
    const n = await inserir('argos_notas_fiscais', linhas);
    marcar('notas', { fazendo: false, pronta: true, qtd: n });
}

async function gravarFinanceiro(idPorChave) {
    marcar('movimentacoes', { fazendo: true });
    await esvaziar('argos_mov_alocacoes');
    await esvaziar('argos_movimentacoes');

    const entradas = entendido.entradas.linhas.map(l => ({
        data: l.data, descricao: l.pagador || 'Entrada', tipo: 'entrada', valor: l.valor,
        origem: 'planilha', observacoes: l.paciente || null
    }));
    const saidas = entendido.saidas.linhas.map(l => ({
        data: l.data, descricao: l.despesa || 'Saída', tipo: 'saida', valor: l.valor,
        origem: 'planilha', observacoes: l.categoria || null
    }));
    await inserir('argos_movimentacoes', [...entradas, ...saidas], 400);
    marcar('movimentacoes', { fazendo: false, pronta: true, qtd: entradas.length + saidas.length });

    marcar('alocacoes', { fazendo: true });
    // paginado: são milhares de linhas, e o PostgREST devolveria só as mil
    // primeiras — as alocações das demais sumiriam sem erro nenhum
    const { data: movs } = await todas(() => sb.from('argos_movimentacoes')
        .select('id, data, descricao, valor, tipo').eq('origem', 'planilha'));
    const porChave = new Map();
    (movs || []).forEach(m => porChave.set(`${m.tipo}|${m.data}|${m.descricao}|${m.valor}`, m.id));
    const alocacoes = [];
    for (const l of entendido.entradas.linhas) {
        if (!l.mes_ref) continue;
        const pid = idPorChave.get(l.chave);
        const mid = porChave.get(`entrada|${l.data}|${l.pagador || 'Entrada'}|${l.valor}`);
        if (!pid || !mid) continue;
        alocacoes.push({ movimentacao_id: mid, vinculo_tipo: 'paciente', vinculo_id: pid,
            mes_ref: l.mes_ref, valor: l.valor });
    }
    const n = await inserir('argos_mov_alocacoes', alocacoes, 400);
    marcar('alocacoes', { fazendo: false, pronta: true, qtd: n });
}

async function gravarDePara(idPorChave) {
    marcar('depara', { fazendo: true });
    await esvaziar('argos_mov_depara');
    const linhas = [];
    for (const d of entendido.depara.linhas) {
        const pid = idPorChave.get(chaveNome(d.para));
        if (!pid) continue;
        linhas.push({ chave: d.de, chave_norm: d.de.toUpperCase().trim(),
            vinculo_tipo: 'paciente', vinculo_id: pid });
    }
    const vistos = new Set();
    const unicas = linhas.filter(l => !vistos.has(l.chave_norm) && vistos.add(l.chave_norm));
    const n = await inserir('argos_mov_depara', unicas);
    marcar('depara', { fazendo: false, pronta: true, qtd: n });
}

// ---------------------------------------------------------------------------
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('cadastro_importar') && !perm.master) {
        document.querySelector('main').innerHTML =
            '<p class="dim" style="padding:30px">Sem permissão para importar planilhas.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    render();
})();
