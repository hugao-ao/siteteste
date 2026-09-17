// ============================================================
// PERFIL FINANCEIRO — cálculo automático (Diagnóstico v2)
// ============================================================
// Script aditivo e clássico (sem type=module). Lê os dados dos módulos
// pelos getters em window, calcula o perfil financeiro (8 perfis), o
// código da matriz e mostra um card logo acima do seletor manual do
// objetivos-module. Nada aqui renomeia ou remove ids, nomes ou funções
// existentes — só acrescenta.
//
// Para testar no console:
//   PerfilFinanceiro.calcular(dados)      // dados = objeto da seção 5 do desenho
//   PerfilFinanceiro.coletarDados()       // monta esse objeto a partir da tela
//
// Regra de exibição: o card mostra SÓ o rótulo do perfil, justificativas
// curtas, faltantes, complementares, investidor e matriz. Subtipos,
// subjacente, alertas, alavancas e marcadores ficam apenas no JSON salvo
// (chave "analise" de perfil_financeiro).
//
// v3 (investimentos): classes de risco, liquidez e elegibilidade vêm de
// window.RiscosV3 (diagnostico/riscos-v3.js), com fallback seguro se ele
// não carregar. A reserva só conta itens elegíveis; o selo da reserva e o
// perfil de investidor por pessoa são calculados DEPOIS da matriz e da
// camada de dívida. Referência por CLASSE de risco, nunca por produto.
// ============================================================

(function () {
  'use strict';

  const VERSAO_REGRAS = '3.0.0';

  // ------------------------------------------------------------
  // PERFIL_CONFIG — parâmetros que o consultor pode ajustar
  // ------------------------------------------------------------
  const PERFIL_CONFIG = {
    // A renda precisa cobrir pelo menos 90% de (essencial + parcelas) para a dívida ser "pagável"
    piso_cobertura_essencial: 0.90,
    // Escala de importância: 1 = "★ Mais importante" ... 7 = "Inaceitável".
    // Despesa cortável = nível >= 5 (5 Indiferente, 6 Preferível não ter, 7 Inaceitável)
    importancia_cortavel_min: 5,
    // Prazo máximo (meses) para quitar as dívidas-problema só com a sobra mensal
    prazo_razoavel_meses: 60,
    // Mínimo existencial (R$ por mês) que precisa sobrar depois de pagar essencial + parcelas
    minimo_existencial: 600,
    // true = o mínimo existencial é multiplicado pelo número de pessoas do domicílio
    minimo_por_pessoa: true,
    // Dívida-problema só é relevante se o saldo for >= 10% da renda mensal...
    piso_relevancia_estoque: 0.10,
    // ...ou se as parcelas forem >= 5% da renda mensal
    piso_relevancia_parcela: 0.05,
    // Quanto dá para reduzir de uma despesa essencial pelo nível de conforto
    // (4 = mais que básico -> corta 25%; 5 = muito acima do básico -> corta 50%).
    // Derivado da proporção PESO_CONFORTO do fluxo.html (2 : 4); calibração final do consultor.
    reducao_por_nivel_conforto: { '4': 0.25, '5': 0.50 },
    // Reservado à entrega: nenhuma simulação de acordo hipotético roda no diagnóstico (usar_haircut false)
    haircut_padrao_acordo: { usar_haircut: false, padrao: 0.30, cartao: 0.60, cheque_especial: 0.50, emprestimo_pessoal: 0.30, financiamento: 0.10, fiscal: 0, pensao: 0, judicial: 0 },
    // Sobra mínima (fração da renda) para contar como sobra de verdade
    piso_sobra: 0.03,
    // Aportes mínimos (fração da renda) para caracterizar "compromisso de guardar"
    piso_compromisso: 0.05,
    // Reserva menor que meio mês de gastos é considerada "micro reserva"
    micro_reserva_meses: 0.5,
    // Janela (meses) considerada para "investe recorrentemente"
    recorrencia_investimento_meses: 12,
    // Classes de risco que caracterizam instrumento de GUARDA (poupança, CDB, Tesouro Selic...).
    // Documental: a regra usa RiscosV3.ehGuarda (ordem do degrau <= 3; sem classe = guarda).
    riscos_guarda: ['RISCO_SOBERANO', 'RISCO_MUITO_BAIXO', 'RISCO_BAIXO'],
    // Perfil de investidor (v3) e selo da reserva
    investidor: {
      // Régua nota (0-100) -> perfil: < limite devolve o id; >= 95 -> '7'
      regua: [[15, '1'], [30, '2'], [45, '3'], [60, '4'], [75, '5'], [95, '6']],
      // B4 · pontos de capacidade (0-4)
      b4_divida: { perfil_1: 0, '2C': 1, '2B': 2, '2A': 3, sem_dividas_relevantes: 4 },
      b4_reserva: { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 },
      b4_fonte: { F1: 4, F2: 3, F3: 2 },
      b4_poupanca: { P1: 4, P2: 3, P3: 2, P4: 0 },
      // Colchão patrimonial em rendas mensais: >= 60 -> 4 ... < 6 -> 0
      colchao_faixas: [[60, 4], [24, 3], [12, 2], [6, 1]],
      // A6: ordem mínima do degrau para contar como ativo que oscila
      a6_classe_min_oscilante: 6,
      // Selo: exposição a mercado (degrau >= 4) acima de 10% do alvo torna a reserva inadequada
      selo_relevancia_exposicao: 0.10
    },
    // Situações de dívida que saem do estoque de dívidas-problema
    situacoes_fora_do_estoque: ['prescrita'],
    // Parentesco de dependente que NÃO conta como pessoa do domicílio
    parentesco_nao_pessoa: /pet|animal|cachorro|gato|c[ãa]o\b|cadel/i,
    // Motivo de dívida que indica rolagem (dívida feita para pagar outra dívida)
    regex_rolagem: /rolagem|pagar (outra |a )?d[ií]vida|quitar (outra |a )?d[ií]vida|refinanc|cobrir (o )?cart[ãa]o|cobrir (o )?cheque/i,
    // Código da matriz (7 posições)
    matriz: {
      // Anos até a aposentadoria: T1 >= 30, T2 >= 20, T3 >= 10, T4 >= 5, T5 < 5
      tempo_faixas: [['T1', 30], ['T2', 20], ['T3', 10], ['T4', 5], ['T5', 0]],
      // Poder de poupança: P1 > 30%, P2 >= 20%, P3 >= 10%, P4 < 10%
      poupanca_faixas: [['P1', 0.30], ['P2', 0.20], ['P3', 0.10], ['P4', 0]],
      // Fonte da maior receita: F1 estável, F2 CLT, demais -> F3
      fonte_por_tipo_receita: { concurso: 'F1', aposentadoria: 'F1', pensao: 'F1', clt: 'F2' },
      // Meses de reserva por tipo de fonte
      reserva_base_meses: { F1: 4, F2: 6, F3: 12 },
      // Teto de meses de reserva
      reserva_teto_meses: 12,
      // Fração física do patrimônio: B0 = 0, B1 <= 25%, B2 <= 50%, B3 <= 75%, B4 > 75%
      patrimonio_faixas: [['B1', 0.25], ['B2', 0.50], ['B3', 0.75], ['B4', 1]],
      // Reserva atual / alvo: R0 = 0, R1 <= 25%, R2 <= 50%, R3 <= 75%, R4 > 75%
      reserva_faixas: [['R1', 0.25], ['R2', 0.50], ['R3', 0.75], ['R4', Infinity]]
    }
  };
  const CFG = PERFIL_CONFIG;

  // ------------------------------------------------------------
  // PERFIS — mesmos ids e cores do objetivos-module
  // ------------------------------------------------------------
  const PERFIS = [
    { id: 'dividas_impagaveis', rotulo: '1 - Dívidas Impagáveis', cor: '#dc3545' },
    { id: 'dividas_pagaveis', rotulo: '2 - Dívidas Pagáveis', cor: '#fd7e14' },
    { id: 'zero_a_zero_obrigatorio', rotulo: '3 - Zero a Zero Obrigatório', cor: '#6c757d' },
    { id: 'zero_a_zero_opcional', rotulo: '4 - Zero a Zero Opcional', cor: '#ffc107' },
    { id: 'fluxo_positivo', rotulo: '5 - Fluxo Positivo', cor: '#17a2b8' },
    { id: 'poupador', rotulo: '6 - Poupador', cor: '#28a745' },
    { id: 'investidor_amador', rotulo: '7 - Investidor-Amador', cor: '#6f42c1' },
    { id: 'investidor_planejador', rotulo: '8 - Investidor-Planejador', cor: '#d4af37' }
  ];

  const PERFIS_INVESTIDOR = [
    { id: '1', nome: 'Ultra-Conservador' },
    { id: '2', nome: 'Conservador' },
    { id: '3', nome: 'Conservador-Moderado' },
    { id: '4', nome: 'Moderado' },
    { id: '5', nome: 'Moderado-Arrojado' },
    { id: '6', nome: 'Arrojado' },
    { id: '7', nome: 'Ultra-Arrojado' }
  ];

  const ROTULO_INCALCULAVEL = 'Perfil incalculável';

  // ------------------------------------------------------------
  // v3 — tabelas do teste de perfil de investidor e do selo da reserva
  // (textos das alternativas iguais aos do teste; nunca citam produto)
  // ------------------------------------------------------------
  const TETO_A1 = { tudo_qualquer_momento: '2', grande_parte_2anos: '3', parte_2anos: '4', so_2a5anos: '6', sem_retirada_5anos: null };
  const TEXTO_A1 = {
    tudo_qualquer_momento: 'Posso precisar de tudo a qualquer momento',
    grande_parte_2anos: 'Grande parte em até 2 anos',
    parte_2anos: 'Uma parte em até 2 anos',
    so_2a5anos: 'Só entre 2 e 5 anos',
    sem_retirada_5anos: 'Sem retirada prevista em 5+ anos'
  };
  const TETO_A2 = { preservar: '2', renda_estavel: '4', acumular_longo_prazo: null, multiplicar: null };
  const TEXTO_A2 = {
    preservar: 'Preservar o que já tenho',
    renda_estavel: 'Gerar renda estável',
    acumular_longo_prazo: 'Acumular para objetivos de longo prazo',
    multiplicar: 'Multiplicar aceitando risco'
  };
  const TEXTO_B3 = { ate_2_anos: 'Sim, em até 2 anos', entre_2_e_5_anos: 'Sim, entre 2 e 5 anos', nao_prevista: 'Não prevista' };
  // Gabarito da bateria C6 (8 afirmações V/F) — não aparece na tela do cliente
  const GABARITO_C6 = [false, false, false, true, false, true, false, true];
  const CHAVES_A = ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
  const CHAVES_C = ['C1', 'C2', 'C3', 'C4', 'C5'];
  // Prioridade do limitante: trava T1 > T5 > T2 > teto B3 > teto A1 > teto A2 > nota C > nota B > nota A
  const PRIORIDADE_LIMITANTE = ['T1', 'T5', 'T2', 'B3', 'A1', 'A2', 'C', 'B', 'A'];
  const NOME_BLOCO_NOTA = { A: 'preferências de risco', B: 'capacidade', C: 'conhecimento' };
  const ROTULOS_SELO = { adequada: 'Adequada', em_formacao: 'Em formação', inadequada: 'Inadequada' };
  const SEPARADOR_MEMORIA = '──────────────────────────────';
  const FALTANTE_RISCOS_V3 = 'RiscosV3 não carregado';

  function nomePerfilInvestidor(id) {
    const s = str(id);
    for (let i = 0; i < PERFIS_INVESTIDOR.length; i++) {
      if (PERFIS_INVESTIDOR[i].id === s) return PERFIS_INVESTIDOR[i].nome;
    }
    return '';
  }

  function perfilPorId(id) {
    for (let i = 0; i < PERFIS.length; i++) {
      if (PERFIS[i].id === id) return PERFIS[i];
    }
    return null;
  }

  function rotuloPerfil(id) {
    const p = perfilPorId(id);
    return p ? p.rotulo : (id ? String(id) : ROTULO_INCALCULAVEL);
  }

  // ------------------------------------------------------------
  // 8.1 Utilitários
  // ------------------------------------------------------------
  function num(v) {
    if (typeof v === 'string') v = v.replace(',', '.');
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function str(v) {
    return v === undefined || v === null ? '' : String(v);
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function r2(v) {
    if (v === null || v === undefined || !isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  }

  function ehCasado(estadoCivil) {
    const ec = str(estadoCivil);
    return ec === 'Casado(a)' || ec === 'União Estável';
  }

  // Equivalência mensal uniforme (anuais entram como 1/12)
  function mensal(valor, qtd, und) {
    const v = num(valor);
    const q = parseInt(qtd, 10) || 1;
    switch (str(und)) {
      case 'dia': return v * 30 / q;
      case 'semana': return v * (52 / 12) / q;
      case 'mes': return v / q;
      case 'ano': return v / (12 * q);
      default: return v;
    }
  }

  function taxaMensal(d) {
    const taxa = num(d.taxa_juros);
    if (str(d.taxa_juros_tipo) === 'mensal') return taxa / 100;
    return Math.pow(1 + taxa / 100, 1 / 12) - 1;
  }

  // Interpreta 'YYYY-MM-DD' ou 'DD/MM/YYYY' na hora local; null se inválida
  function parseDataLocal(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return isNaN(valor) ? null : valor;
    const s = String(valor).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // Idade em anos completos na data de referência; null se vazia/inválida
  function idade(dataNasc, ref) {
    const nasc = parseDataLocal(dataNasc);
    if (!nasc) return null;
    const r = ref instanceof Date ? ref : (parseDataLocal(ref) || new Date());
    let anos = r.getFullYear() - nasc.getFullYear();
    const m = r.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && r.getDate() < nasc.getDate())) anos--;
    return anos >= 0 ? anos : null;
  }

  function mesesEntre(de, ate) {
    const meses = (ate.getFullYear() - de.getFullYear()) * 12 + (ate.getMonth() - de.getMonth());
    return meses > 0 ? meses : 0;
  }

  function hojeISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // "R$ 1.234,56" -> 1234.56
  function parseMoedaBR(texto) {
    const s = str(texto);
    if (!s) return 0;
    const limpo = s.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
  }

  // Moeda em frases: R$ 1.234 (sem centavos)
  function fmtMoeda(v) {
    const n = Math.round(num(v));
    const abs = Math.abs(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    return 'R$ ' + (n < 0 ? '-' : '') + abs;
  }

  // Percentual com 0 ou 1 casa (1 casa quando < 10%)
  function fmtPct(fracao, casas) {
    if (fracao === null || fracao === undefined || !isFinite(fracao)) return '—';
    const p = fracao * 100;
    const c = (casas === undefined) ? (Math.abs(p) < 10 ? 1 : 0) : casas;
    return p.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) + '%';
  }

  function fmtPctDe(valor, base) {
    return base > 0 ? fmtPct(valor / base) : '—';
  }

  function fmtMult(x) {
    if (!isFinite(x)) return '—';
    return x.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '×';
  }

  function fmtNum(x, casas) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    return x.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas === undefined ? 1 : casas });
  }

  function escapar(s) {
    return str(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function unicos(lista) {
    const vistos = {};
    const saida = [];
    lista.forEach(function (x) {
      if (!vistos[x]) { vistos[x] = true; saida.push(x); }
    });
    return saida;
  }

  function nomeDespesa(d) {
    return str(d.nome).trim() || ('Despesa #' + str(d.id));
  }

  function nomeDivida(d) {
    return str(d.motivo).trim() || str(d.credor).trim() || ('#' + str(d.id));
  }

  function faixaPorLimite(faixas, valor, primeiraEstrita) {
    // faixas em ordem decrescente de limite: devolve a primeira cujo limite o valor alcança
    for (let i = 0; i < faixas.length; i++) {
      const lim = faixas[i][1];
      if (i === 0 && primeiraEstrita) {
        if (valor > lim) return faixas[i][0];
      } else if (valor >= lim) {
        return faixas[i][0];
      }
    }
    return faixas[faixas.length - 1][0];
  }

  function faixaPorTeto(faixas, valor) {
    // faixas em ordem crescente de teto: devolve a primeira cujo teto o valor não ultrapassa
    for (let i = 0; i < faixas.length; i++) {
      if (valor <= faixas[i][1]) return faixas[i][0];
    }
    return faixas[faixas.length - 1][0];
  }

  function tem(obj, chave) {
    return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, chave);
  }

  // ------------------------------------------------------------
  // v3 — acesso seguro a window.RiscosV3 (classe, ordem, guarda, reserva).
  // Sem RiscosV3: classe vazia, guarda pela regra antiga, reserva conta
  // como hoje e o motor registra o faltante técnico "RiscosV3 não carregado".
  // ------------------------------------------------------------
  function riscosV3() {
    const R = typeof window !== 'undefined' ? window.RiscosV3 : null;
    if (R && typeof R.classeDoItem === 'function' && typeof R.ordemRisco === 'function' &&
        typeof R.ehGuarda === 'function' && typeof R.elegibilidadeReserva === 'function') {
      return R;
    }
    return null;
  }

  function classeItem(rv3, pl) {
    if (!rv3) return '';
    try { return str(rv3.classeDoItem(pl)); } catch (e) { return ''; }
  }

  function ordemClasse(rv3, classe) {
    if (!rv3 || !classe) return 0;
    try { return Number(rv3.ordemRisco(classe)) || 0; } catch (e) { return 0; }
  }

  function ordemItem(rv3, pl) {
    return ordemClasse(rv3, classeItem(rv3, pl));
  }

  function guardaLegado(pl) {
    // regra da v2: sem classificação -> guarda; senão pela lista
    return !pl.classificacao_risco || CFG.riscos_guarda.indexOf(str(pl.classificacao_risco)) !== -1;
  }

  function ehGuardaItem(rv3, pl) {
    if (!rv3) return guardaLegado(pl);
    try { return !!rv3.ehGuarda(pl); } catch (e) { return guardaLegado(pl); }
  }

  function elegibilidadeItem(rv3, pl) {
    const fora = { elegivel: false, legado: false, motivo: 'produto fora da matriz (não elegível)' };
    if (!rv3) return pl.elegivel === false ? fora : { elegivel: true, legado: false, motivo: '' };
    try {
      const e = rv3.elegibilidadeReserva(pl) || {};
      return { elegivel: e.elegivel !== false, legado: e.legado === true, motivo: str(e.motivo) };
    } catch (err) {
      return pl.elegivel === false ? fora : { elegivel: true, legado: false, motivo: '' };
    }
  }

  function nomeInvestimento(pl) {
    return str(pl.nome_produto_customizado).trim() || str(pl.tipo_produto_nome).trim() || ('Investimento #' + str(pl.id));
  }

  // Régua nota (0-100) -> '1'..'7' (RiscosV3.regua, com a régua do CONFIG como fallback)
  function reguaInvestidor(nota) {
    if (nota === null || nota === undefined || !isFinite(nota)) return null;
    const R = typeof window !== 'undefined' ? window.RiscosV3 : null;
    if (R && typeof R.regua === 'function') {
      try {
        const x = str(R.regua(nota));
        if (nomePerfilInvestidor(x)) return x;
      } catch (e) {
        // segue com a régua local
      }
    }
    const faixas = CFG.investidor.regua;
    for (let i = 0; i < faixas.length; i++) {
      if (nota < faixas[i][0]) return faixas[i][1];
    }
    return '7';
  }

  // Limite inferior da faixa da régua para o perfil id ('1' -> 0, '2' -> 15 ... '7' -> 95)
  function limiarFaixa(id) {
    const n = Number(id);
    const faixas = CFG.investidor.regua;
    if (!(n > 1)) return 0;
    const f = faixas[Math.min(n - 2, faixas.length - 1)];
    return f ? f[0] : 0;
  }

  function respostaNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  // ------------------------------------------------------------
  // Contexto: 8.2 pessoas/renda, 8.3 despesas, 8.4 dívidas, 8.7 números de fluxo
  // Montado UMA vez por cálculo e compartilhado por todos os detectores.
  // ------------------------------------------------------------
  function montarContexto(dados) {
    const d = dados || {};
    const titular = d.titular || {};
    const conjuge = (d.conjuge && str(d.conjuge.nome).trim()) ? d.conjuge : null;
    const pessoasRenda = arr(d.pessoas_renda);
    const dependentes = arr(d.dependentes);
    const fisicos = arr(d.patrimonios_fisicos);
    const liquidos = arr(d.patrimonios_liquidos);
    const dividasTodas = arr(d.dividas);
    const receitasTodas = arr(d.receitas);
    const despesasTodas = arr(d.despesas);
    const protecao = arr(d.produtos_protecao);
    const objetivos = arr(d.objetivos);
    const declaracoesIR = arr(d.declaracoes_ir);
    const complementares = Object.assign({ custeio_moradia: '', decide_pelo_objetivo: '' }, d.complementares || {});
    const override = Object.assign({ perfil_selecionado: '', observacoes: '' }, d.override || {});
    const investidor = Object.assign({ ajustado: '', justificativa_consultor: '', termo_colhido: false }, d.investidor || {});
    const investidor_ui = (d.investidor_ui && typeof d.investidor_ui === 'object') ? d.investidor_ui : {};
    const selo_ui = Object.assign({ ajustado: '', justificativa_consultor: '' }, d.selo_ui || {});
    let suitability_v3 = d.suitability_v3 === undefined ? null : d.suitability_v3;
    if (typeof suitability_v3 === 'string') {
      try { suitability_v3 = JSON.parse(suitability_v3); } catch (e) { suitability_v3 = null; }
    }
    if (!suitability_v3 || typeof suitability_v3 !== 'object') suitability_v3 = null;
    const rv3 = riscosV3();
    const referencia = parseDataLocal(d.referencia) || new Date();

    const faltantesBase = [];     // renda + classificação das despesas (bloqueiam as duas camadas)
    const faltantesDividas = [];  // só a camada de dívida

    // ---- 8.2 Pessoas e renda ----
    const earners = [{ id: 'titular', renda_mes_fraco: num(titular.renda_mes_fraco) }];
    if (conjuge) earners.push({ id: 'conjuge', renda_mes_fraco: num(conjuge.renda_mes_fraco) });
    let n_domicilio = 1 + (conjuge ? 1 : 0);
    pessoasRenda.forEach(function (p, i) {
      if (!str(p.nome).trim()) return;
      const id = str(p.id) || ('pessoa_' + i);
      earners.push({ id: id, renda_mes_fraco: num(p.renda_mes_fraco) });
      n_domicilio += 1;
      if (ehCasado(p.estado_civil) && str(p.conjuge_nome).trim()) {
        earners.push({ id: id + '_conjuge', renda_mes_fraco: 0 }); // cônjuge de pessoa não tem campo de mês fraco
        n_domicilio += 1;
      }
    });
    const dependentes_pessoa = dependentes.filter(function (dep) {
      return str(dep.nome).trim() !== '' && !CFG.parentesco_nao_pessoa.test(str(dep.parentesco));
    }).length;
    n_domicilio += dependentes_pessoa;

    const receitas = receitasTodas.filter(function (r) { return !r.automatica; });
    const renda_por_pessoa = {};
    let renda_media = 0;
    receitas.forEach(function (r) {
      const v = mensal(r.valor, r.qtd_recorrencia, r.und_recorrencia);
      const t = str(r.titular) || 'titular';
      renda_por_pessoa[t] = (renda_por_pessoa[t] || 0) + v;
      renda_media += v;
    });
    // renda_fraca: cada earner com mês fraco informado troca a renda média pela do mês fraco
    let renda_fraca = renda_media;
    let renda_variavel = false;
    earners.forEach(function (e) {
      if (e.renda_mes_fraco > 0) {
        renda_variavel = true;
        renda_fraca += e.renda_mes_fraco - (renda_por_pessoa[e.id] || 0);
      }
    });
    if (renda_fraca < 0) renda_fraca = 0;
    const renda_base = renda_variavel ? renda_fraca : renda_media;
    if (renda_media <= 0) faltantesBase.push('Receitas do fluxo de caixa (nenhuma receita informada)');

    // ---- 8.3 Despesas ----
    const manuais = despesasTodas.filter(function (x) { return !x.automatica && num(x.valor) > 0; });
    // automáticas de origem 'divida' são as parcelas (já vêm do módulo de dívidas) — não somar duas vezes
    const automaticas = despesasTodas.filter(function (x) { return x.automatica && str(x.origem) !== 'divida'; });
    manuais.forEach(function (x) {
      const nome = nomeDespesa(x);
      if (str(x.categoria_comportamental) === '') faltantesBase.push('Categoria de "' + nome + '"');
      if (str(x.nivel_importancia) === '') faltantesBase.push('Importância de "' + nome + '"');
      if (str(x.nivel_conforto) === '') faltantesBase.push('Nível de conforto de "' + nome + '"');
      if (str(x.alteravel) === '') faltantesBase.push('Alterável? de "' + nome + '"');
    });
    function m(x) { return mensal(x.valor, x.qtd_recorrencia, x.und_recorrencia); }
    function cat(x) { return str(x.categoria_comportamental); }
    function soma(lista, fn) {
      return lista.reduce(function (s, x) { return s + (fn ? fn(x) : m(x)); }, 0);
    }
    const sob = manuais.filter(function (x) { return cat(x) === 'sobrevivencia'; });
    const nec = manuais.filter(function (x) { return cat(x) === 'necessidades'; });
    const aperf = manuais.filter(function (x) { return cat(x) === 'aperfeicoamento'; });
    const conf = manuais.filter(function (x) { return cat(x) === 'conforto'; });
    const obrig_auto = soma(automaticas); // obrigações fixas: não cortáveis nem reduzíveis
    const essencial_atual = soma(sob) + soma(nec) + obrig_auto;

    function eliminavel(x) {
      if (str(x.alteravel) === 'nao') return false;
      return cat(x) === 'conforto' || (parseInt(x.nivel_importancia, 10) || 0) >= CFG.importancia_cortavel_min;
    }
    function fatorReducao(x) {
      if (str(x.alteravel) === 'nao') return 0;
      return CFG.reducao_por_nivel_conforto[str(x.nivel_conforto)] || 0;
    }
    let eliminacao = 0;
    let reducao = 0;
    let essencial_otimizado = obrig_auto;
    sob.concat(nec).forEach(function (x) {
      const v = m(x);
      if (eliminavel(x)) { eliminacao += v; return; }
      const r = v * fatorReducao(x);
      reducao += r;
      essencial_otimizado += v - r;
    });
    const despesas_totais = soma(manuais) + obrig_auto;

    // ---- 8.4 Dívidas ----
    const dividas = dividasTodas.filter(function (x) { return num(x.saldo_devedor) > 0 || num(x.valor_parcela) > 0; });
    dividas.forEach(function (x) {
      const nome = nomeDivida(x);
      if (str(x.situacao_divida) === '') faltantesDividas.push('Situação da dívida "' + nome + '"');
      if (str(x.proposta_em_vigor) === '') faltantesDividas.push('Proposta em mãos? da dívida "' + nome + '"');
      if (str(x.proposta_em_vigor) === 'sim' && num(x.parcela_proposta) <= 0) faltantesDividas.push('Parcela proposta da dívida "' + nome + '"');
    });
    function estruturadaEmDia(x) {
      return (x.divida_estruturada === true || x.divida_estruturada === 'true') && str(x.situacao_divida) === 'em_dia';
    }
    function ehProblema(x) {
      return !estruturadaEmDia(x) && CFG.situacoes_fora_do_estoque.indexOf(str(x.situacao_divida)) === -1;
    }
    function parcela(x, cenario) {
      const vp = num(x.valor_parcela);
      if (cenario === 'otimizado' && str(x.proposta_em_vigor) === 'sim' && num(x.parcela_proposta) > 0) {
        return Math.min(vp, num(x.parcela_proposta)); // uma proposta pior não é imposta ao cenário otimizado
      }
      return vp;
    }
    const problemas = dividas.filter(ehProblema);
    const estruturadas = dividas.filter(estruturadaEmDia);
    const saldo_problema = problemas.reduce(function (s, x) { return s + num(x.saldo_devedor); }, 0);
    function parcelas_problema(cen) {
      return problemas.reduce(function (s, x) { return s + parcela(x, cen); }, 0);
    }
    const parcelas_estruturadas = estruturadas.reduce(function (s, x) { return s + num(x.valor_parcela); }, 0);
    function parcelas_total(cen) { return parcelas_problema(cen) + parcelas_estruturadas; }
    const relevante = problemas.length > 0 && (
      saldo_problema >= CFG.piso_relevancia_estoque * renda_base ||
      parcelas_problema('atual') >= CFG.piso_relevancia_parcela * renda_base
    );
    const juros_mensais = problemas.reduce(function (s, x) { return s + num(x.saldo_devedor) * taxaMensal(x); }, 0);
    const taxa_media = saldo_problema > 0 ? juros_mensais / saldo_problema : 0;
    const patrimonio_vendavel = fisicos.reduce(function (s, p) {
      if (p.imovel_unico_moradia === true || p.imovel_unico_moradia === 'true') return s;
      if (p.gera_renda === true || p.gera_renda === 'true') return s;
      const quitado = !(p.quitado === false || p.quitado === 'false');
      const liquido = num(p.valor) - (quitado ? 0 : num(p.saldo_devedor));
      return s + Math.max(0, liquido);
    }, 0) + liquidos.reduce(function (s, pl) { return s + num(pl.valor_atual); }, 0);

    // ---- 8.7 Números da camada de fluxo ----
    const renda = renda_media;
    const parcelas_atual = parcelas_total('atual');
    const nec_reduzida = nec.reduce(function (s, x) { return s + m(x) * (1 - fatorReducao(x)); }, 0);
    const sobra_estrutural = renda - (soma(sob) + nec_reduzida + obrig_auto + parcelas_atual);
    const sobra_real = renda - (despesas_totais + parcelas_atual);
    const sobra_real_fraca = renda_fraca - (despesas_totais + parcelas_atual);
    const aportes_mensais = liquidos.reduce(function (s, pl) {
      const a = num(pl.aporte_valor);
      const f = str(pl.aporte_frequencia);
      if (f === 'MENSAL') return s + a;
      if (f === 'ANUAL') return s + a / 12;
      return s;
    }, 0);
    const compromisso_de_guardar = renda > 0 && aportes_mensais >= CFG.piso_compromisso * renda;
    function guarda(pl) {
      // v3: por ordem do degrau (RiscosV3.ehGuarda) — sem classe -> guarda, não inventar investimento
      return ehGuardaItem(rv3, pl);
    }
    function aporteRecorrente(pl) {
      return num(pl.aporte_valor) > 0 && (str(pl.aporte_frequencia) || 'NENHUM') !== 'NENHUM';
    }
    const investe_recorrente = liquidos.some(function (pl) { return aporteRecorrente(pl) && !guarda(pl); });
    const apenas_guarda = liquidos
      .filter(function (pl) { return num(pl.valor_atual) > 0 || num(pl.aporte_valor) > 0; })
      .every(guarda);
    const opcionalidade = manuais.some(function (x) {
      const c = cat(x);
      return c === 'conforto' || c === 'aperfeicoamento' ||
        (c === 'necessidades' && (str(x.nivel_conforto) === '4' || str(x.nivel_conforto) === '5'));
    });
    const FINALIDADES_VINCULADAS = ['RESERVA_OBJETIVOS', 'APOSENTADORIA', 'RESERVA_EMERGENCIA'];
    const objetivos_com_prazo_e_valor = objetivos.some(function (o) {
      const tipo = str(o.tipo);
      if (tipo === 'aposentadoria') return num(o.renda_anual) > 0;
      if (tipo === 'intangivel') return false;
      return (num(o.meta_acumulo) > 0 || num(o.valor_final) > 0) && (num(o.prazo_meses) > 0 || !!o.prazo_data);
    });
    const aportes_vinculados = liquidos.filter(aporteRecorrente).every(function (pl) {
      return FINALIDADES_VINCULADAS.indexOf(str(pl.finalidade)) !== -1;
    });
    const tudo_com_finalidade = liquidos
      .filter(function (pl) { return num(pl.valor_atual) > 0; })
      .every(function (pl) { return str(pl.finalidade) !== '' && str(pl.finalidade) !== 'SEM_FINALIDADE'; });
    const declaracao_coerente = str(complementares.decide_pelo_objetivo) === 'sim';
    function ehReserva(pl) {
      return typeof pl.reserva_emergencia === 'boolean' ? pl.reserva_emergencia : str(pl.finalidade) === 'RESERVA_EMERGENCIA';
    }
    // v3: só conta item marcado como reserva E elegível (RiscosV3.elegibilidadeReserva).
    // legado (classe/liquidez não informada) conta como hoje e gera pendência.
    const reserva_desconsiderada = [];
    const reserva_legado = [];
    const faltantesInvestimentos = [];
    if (!rv3) faltantesInvestimentos.push(FALTANTE_RISCOS_V3);
    let reserva_atual = 0;
    liquidos.forEach(function (pl) {
      if (!ehReserva(pl)) return;
      const v = num(pl.valor_atual);
      const eleg = elegibilidadeItem(rv3, pl);
      const nome = nomeInvestimento(pl);
      if (!eleg.elegivel) {
        if (v > 0) reserva_desconsiderada.push({ nome: nome, motivo: eleg.motivo, valor: r2(v) });
        return;
      }
      reserva_atual += v;
      if (eleg.legado && v > 0) {
        reserva_legado.push({ nome: nome, motivo: eleg.motivo });
        faltantesInvestimentos.push('Confirmar ' + eleg.motivo + ' de «' + nome + '» (conta como reserva até lá)');
      }
    });
    liquidos.forEach(function (pl) {
      if (!(pl.revisao_item === true && str(pl.classe_risco_origem) !== 'item')) return;
      const nome = nomeInvestimento(pl);
      if (!classeItem(rv3, pl)) {
        faltantesInvestimentos.push('Classificar o risco de «' + nome + '» (produto genérico)');
      } else {
        faltantesInvestimentos.push('Revisar a classe de risco de «' + nome + '» no item (o risco é do papel)');
      }
    });
    const protecao_mensal = protecao.reduce(function (s, p) {
      return s + (str(p.periodicidade) === 'anual' ? num(p.custo) / 12 : num(p.custo));
    }, 0);
    const aperf_mensal = soma(aperf);
    const idade_titular = idade(titular.data_nascimento, referencia);

    const ctx = {
      referencia: referencia,
      titular: titular,
      conjuge: conjuge,
      earners: earners,
      n_domicilio: n_domicilio,
      dependentes_pessoa: dependentes_pessoa,
      receitas: receitas,
      renda_por_pessoa: renda_por_pessoa,
      renda_media: renda_media,
      renda_fraca: renda_fraca,
      renda_variavel: renda_variavel,
      renda_base: renda_base,
      renda: renda,
      manuais: manuais,
      automaticas: automaticas,
      sob: sob, nec: nec, aperf: aperf, conf: conf,
      m: m,
      obrig_auto: obrig_auto,
      essencial_atual: essencial_atual,
      essencial_otimizado: essencial_otimizado,
      eliminacao: eliminacao,
      reducao: reducao,
      despesas_totais: despesas_totais,
      dividas: dividas,
      problemas: problemas,
      estruturadas: estruturadas,
      saldo_problema: saldo_problema,
      parcelas_problema: parcelas_problema,
      parcelas_estruturadas: parcelas_estruturadas,
      parcelas_total: parcelas_total,
      parcela: parcela,
      relevante: relevante,
      juros_mensais: juros_mensais,
      taxa_media: taxa_media,
      patrimonio_vendavel: patrimonio_vendavel,
      parcelas_atual: parcelas_atual,
      nec_reduzida: nec_reduzida,
      sobra_estrutural: sobra_estrutural,
      sobra_real: sobra_real,
      sobra_real_fraca: sobra_real_fraca,
      aportes_mensais: aportes_mensais,
      compromisso_de_guardar: compromisso_de_guardar,
      investe_recorrente: investe_recorrente,
      apenas_guarda: apenas_guarda,
      opcionalidade: opcionalidade,
      amarras_p8: {
        objetivos_com_prazo_e_valor: objetivos_com_prazo_e_valor,
        aportes_vinculados: aportes_vinculados,
        tudo_com_finalidade: tudo_com_finalidade,
        declaracao_coerente: declaracao_coerente
      },
      reserva_atual: reserva_atual,
      reserva_desconsiderada: reserva_desconsiderada,
      reserva_legado: reserva_legado,
      faltantes_investimentos: unicos(faltantesInvestimentos),
      rv3: rv3,
      investidor_ui: investidor_ui,
      selo_ui: selo_ui,
      suitability_v3: suitability_v3,
      protecao_mensal: protecao_mensal,
      aperf_mensal: aperf_mensal,
      idade_titular: idade_titular,
      fisicos: fisicos,
      liquidos: liquidos,
      objetivos: objetivos,
      declaracoes_ir: declaracoesIR,
      complementares: complementares,
      override: override,
      investidor: investidor,
      faltantes_fluxo: unicos(faltantesBase),
      faltantes_divida: unicos(faltantesBase.concat(faltantesDividas))
    };
    ctx.funil = function (cenario, ajustes) { return funil(ctx, cenario, ajustes); };
    ctx.funil_atual = funil(ctx, 'atual');
    ctx.funil_otimizado = funil(ctx, 'otimizado');
    return ctx;
  }

  // ------------------------------------------------------------
  // 8.5 Funil do Perfil 1
  // ajustes (opcional) permite trocar renda_base/essencial/parcelas/patrimonio_vendavel
  // para testar uma alavanca sozinha ou um alerta.
  // ------------------------------------------------------------
  function funil(ctx, cenario, ajustes) {
    ajustes = ajustes || {};
    const renda = ajustes.renda_base !== undefined ? ajustes.renda_base : ctx.renda_base;
    const essencial = ajustes.essencial !== undefined ? ajustes.essencial
      : (cenario === 'atual' ? ctx.essencial_atual : ctx.essencial_otimizado);
    const parcelas = ajustes.parcelas !== undefined ? ajustes.parcelas : ctx.parcelas_total(cenario);
    const patrimonio_vendavel = ajustes.patrimonio_vendavel !== undefined ? ajustes.patrimonio_vendavel : ctx.patrimonio_vendavel;
    const piso = CFG.piso_cobertura_essencial;
    const base = essencial + parcelas;

    const c1 = {
      renda: r2(renda),
      essencial: r2(essencial),
      parcelas: r2(parcelas),
      cobertura: base > 0 ? r2(renda / base) : null,
      passou: renda >= piso * base
    };
    const deficit_estrutural = renda < piso * essencial;
    const res = {
      cenario: cenario,
      passou: false,
      c1: c1,
      deficit_estrutural: deficit_estrutural,
      caminho_a: null,
      caminho_b: null
    };
    if (!c1.passou) return res;

    // Etapa 2 — Caminho A: vender patrimônio cobre o saldo
    const caminho_a = {
      patrimonio_vendavel: r2(patrimonio_vendavel),
      saldo_problema: r2(ctx.saldo_problema),
      passou: patrimonio_vendavel >= ctx.saldo_problema
    };

    // Caminho B: a sobra mensal paga a dívida em prazo razoável e ainda sobra o mínimo
    const sobra_para_divida = renda - essencial - ctx.parcelas_estruturadas;
    const c3 = sobra_para_divida > ctx.juros_mensais;
    let prazo_meses;
    if (ctx.taxa_media === 0) {
      prazo_meses = sobra_para_divida > 0 ? ctx.saldo_problema / sobra_para_divida : (ctx.saldo_problema > 0 ? Infinity : 0);
    } else if (sobra_para_divida <= ctx.juros_mensais) {
      prazo_meses = Infinity;
    } else {
      prazo_meses = -Math.log(1 - ctx.taxa_media * ctx.saldo_problema / sobra_para_divida) / Math.log(1 + ctx.taxa_media);
    }
    const c4 = prazo_meses <= CFG.prazo_razoavel_meses;
    const sobra_apos_minimo = renda - essencial - parcelas;
    const minimo_necessario = CFG.minimo_existencial * (CFG.minimo_por_pessoa ? ctx.n_domicilio : 1);
    const c5 = sobra_apos_minimo >= minimo_necessario;
    const caminho_b = {
      sobra_para_divida: r2(sobra_para_divida),
      juros_mensais: r2(ctx.juros_mensais),
      c3: c3,
      prazo_meses: isFinite(prazo_meses) ? r2(prazo_meses) : null,
      c4: c4,
      sobra_apos_minimo: r2(sobra_apos_minimo),
      minimo_necessario: r2(minimo_necessario),
      c5: c5,
      passou: c3 && c4 && c5
    };
    res.caminho_a = caminho_a;
    res.caminho_b = caminho_b;
    res.passou = caminho_a.passou || caminho_b.passou;
    return res;
  }

  // Frases curtas explicando por que um funil falhou (sem jargão)
  function motivosFalhaFunil(f, ctx) {
    const frases = [];
    const pessoasTxt = ctx.n_domicilio + (ctx.n_domicilio === 1 ? ' pessoa' : ' pessoas');
    if (!f.c1.passou) {
      frases.push('Renda cobre ' + fmtPct(f.c1.cobertura) + ' do essencial + parcelas (mínimo ' + fmtPct(CFG.piso_cobertura_essencial) + ')');
      if (f.deficit_estrutural) {
        frases.push('Mesmo sem as parcelas, a renda não cobre ' + fmtPct(CFG.piso_cobertura_essencial) + ' do essencial');
      }
      return frases;
    }
    const a = f.caminho_a;
    const b = f.caminho_b;
    frases.push('Patrimônio vendável ' + fmtMoeda(a.patrimonio_vendavel) + ' não cobre a dívida de ' + fmtMoeda(a.saldo_problema));
    if (!b.c3) {
      frases.push('Sobra para a dívida ' + fmtMoeda(b.sobra_para_divida) + '/mês não supera os juros de ' + fmtMoeda(b.juros_mensais) + '/mês');
    } else if (!b.c4) {
      frases.push('Quitaria em ' + (b.prazo_meses === null ? 'prazo indefinido' : Math.ceil(b.prazo_meses) + ' meses') + ' (limite ' + CFG.prazo_razoavel_meses + ')');
    } else if (!b.c5) {
      frases.push('Depois das parcelas sobra ' + fmtMoeda(b.sobra_apos_minimo) + ', abaixo do mínimo de ' + fmtMoeda(b.minimo_necessario) + ' para ' + pessoasTxt);
    }
    return frases;
  }

  function motivosPassouFunil(f) {
    const frases = [];
    frases.push('Renda cobre ' + fmtPct(f.c1.cobertura) + ' do essencial + parcelas (mínimo ' + fmtPct(CFG.piso_cobertura_essencial) + ')');
    if (f.caminho_a && f.caminho_a.passou) {
      frases.push('Patrimônio vendável ' + fmtMoeda(f.caminho_a.patrimonio_vendavel) + ' cobre a dívida de ' + fmtMoeda(f.caminho_a.saldo_problema));
    } else if (f.caminho_b && f.caminho_b.passou) {
      frases.push('Quitaria em ' + Math.ceil(f.caminho_b.prazo_meses) + ' meses com sobra de ' + fmtMoeda(f.caminho_b.sobra_para_divida) + '/mês (limite ' + CFG.prazo_razoavel_meses + ')');
    }
    return frases;
  }

  function linhaRenda(ctx) {
    return 'Renda mensal considerada: ' + fmtMoeda(ctx.renda_base) + (ctx.renda_variavel ? ' (mês fraco)' : '');
  }

  function linhaDividas(ctx) {
    const parc = ctx.parcelas_problema('atual');
    return 'Dívidas-problema: ' + fmtMoeda(ctx.saldo_problema) + ' de saldo (' +
      (ctx.renda_base > 0 ? fmtMult(ctx.saldo_problema / ctx.renda_base) : '—') + ' a renda) e ' +
      fmtMoeda(parc) + ' de parcelas (' + fmtPctDe(parc, ctx.renda_base) + ' da renda)';
  }

  function linhaSobraEstrutural(ctx) {
    return 'Sobra estrutural: ' + fmtMoeda(ctx.sobra_estrutural) + ' (' + fmtPctDe(ctx.sobra_estrutural, ctx.renda) + ' da renda)';
  }

  function linhaSobraReal(ctx) {
    return 'Sobra real: ' + fmtMoeda(ctx.sobra_real) + ' (' + fmtPctDe(ctx.sobra_real, ctx.renda) + ' da renda)';
  }

  function linhaAportes(ctx, sufixo) {
    return 'Aportes mensais: ' + fmtMoeda(ctx.aportes_mensais) + ' (' + fmtPctDe(ctx.aportes_mensais, ctx.renda) + ' da renda)' + (sufixo || '');
  }

  // Sufixo padrão da linha de aportes: diz se o compromisso de guardar (≥ piso da renda) foi confirmado
  function sufixoCompromisso(ctx) {
    return ctx.compromisso_de_guardar
      ? ' — compromisso de guardar confirmado'
      : ' — abaixo de ' + fmtPct(CFG.piso_compromisso, 0) + ' da renda (sem compromisso de guardar)';
  }

  // Camada de fluxo (8.7) divide tudo pela renda média; com renda variável mostra também o mês fraco
  function linhaRendaFluxo(ctx) {
    return 'Renda mensal considerada: ' + fmtMoeda(ctx.renda) +
      (ctx.renda_variavel ? ' (média; mês fraco ' + fmtMoeda(ctx.renda_fraca) + ')' : '');
  }

  function detectorVazio() {
    return { ativo: false, evidencias: [], faltantes: [], extras: {} };
  }

  // ------------------------------------------------------------
  // DETECTORES — um por perfil (+ investidor). Cada um só olha o ctx e
  // responde { ativo, evidencias, faltantes, extras }. A precedência entre
  // os ativos é política do orquestrador (calcular), não do detector.
  // Para acrescentar um perfil: push de um objeto novo neste array.
  // ------------------------------------------------------------
  const DETECTORES = [
    {
      id: 'dividas_impagaveis',
      nome: '1 - Dívidas Impagáveis',
      camada: 'divida',
      detectar: function (ctx) {
        const f = ctx.funil_otimizado;
        const ativo = ctx.relevante && !f.passou;
        const ev = [];
        if (ativo) {
          ev.push(linhaDividas(ctx));
          motivosFalhaFunil(f, ctx).forEach(function (x) { ev.push(x); });
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_divida, extras: { reclassificavel_apos_pesquisa: !f.passou && !f.deficit_estrutural } };
      }
    },
    {
      id: 'dividas_pagaveis',
      nome: '2 - Dívidas Pagáveis',
      camada: 'divida',
      detectar: function (ctx) {
        const f = ctx.funil_otimizado;
        const ativo = ctx.relevante && f.passou;
        const ev = [];
        if (ativo) {
          ev.push(linhaDividas(ctx));
          motivosPassouFunil(f).forEach(function (x) { ev.push(x); });
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_divida, extras: {} };
      }
    },
    {
      id: 'zero_a_zero_obrigatorio',
      nome: '3 - Zero a Zero Obrigatório',
      camada: 'fluxo',
      ordem: 1,
      detectar: function (ctx) {
        const semSobra = ctx.sobra_estrutural <= CFG.piso_sobra * ctx.renda;
        const ev = [linhaSobraEstrutural(ctx)];
        if (semSobra) {
          ev.push('Mesmo enxugando o essencial, não sobra mais que ' + fmtPct(CFG.piso_sobra) + ' da renda');
        } else {
          ev.push(linhaSobraReal(ctx));
          ev.push('Não há despesas opcionais (conforto/aperfeiçoamento) que expliquem a falta de sobra');
        }
        // fallback: vale só se nenhum outro perfil de fluxo se aplicar
        return { ativo: semSobra || !ctx.opcionalidade, evidencias: ev, faltantes: ctx.faltantes_fluxo, extras: { fallback: !semSobra } };
      }
    },
    {
      id: 'investidor_planejador',
      nome: '8 - Investidor-Planejador',
      camada: 'fluxo',
      ordem: 2,
      detectar: function (ctx) {
        const a = ctx.amarras_p8;
        const todas = a.objetivos_com_prazo_e_valor && a.aportes_vinculados && a.tudo_com_finalidade && a.declaracao_coerente;
        const ativo = ctx.investe_recorrente && todas;
        const ev = [];
        if (ativo) {
          ev.push('Investe recorrentemente em produtos de risco: sim');
          ev.push(linhaAportes(ctx, sufixoCompromisso(ctx)));
          ev.push('Objetivos com prazo e valor, aportes com finalidade definida e decisão pelo objetivo: sim');
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_fluxo, extras: {} };
      }
    },
    {
      id: 'investidor_amador',
      nome: '7 - Investidor-Amador',
      camada: 'fluxo',
      ordem: 3,
      detectar: function (ctx) {
        const a = ctx.amarras_p8;
        const todas = a.objetivos_com_prazo_e_valor && a.aportes_vinculados && a.tudo_com_finalidade && a.declaracao_coerente;
        const ativo = ctx.investe_recorrente && !todas;
        const ev = [];
        if (ativo) {
          ev.push('Investe recorrentemente em produtos de risco: sim');
          ev.push(linhaAportes(ctx, sufixoCompromisso(ctx)));
          const falta = [];
          if (!a.objetivos_com_prazo_e_valor) falta.push('objetivos com prazo e valor');
          if (!a.aportes_vinculados) falta.push('finalidade nos aportes recorrentes');
          if (!a.tudo_com_finalidade) falta.push('finalidade em todo o patrimônio líquido');
          if (!a.declaracao_coerente) falta.push('decidir onde investir pelo objetivo');
          ev.push('Falta para planejador: ' + falta.join(', '));
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_fluxo, extras: {} };
      }
    },
    {
      id: 'poupador',
      nome: '6 - Poupador',
      camada: 'fluxo',
      ordem: 4,
      detectar: function (ctx) {
        const ativo = ctx.compromisso_de_guardar && ctx.apenas_guarda;
        const ev = [];
        if (ativo) {
          ev.push(linhaAportes(ctx, sufixoCompromisso(ctx)));
          ev.push('Guarda só em produtos de baixo risco (sem investimento recorrente em risco)');
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_fluxo, extras: {} };
      }
    },
    {
      id: 'fluxo_positivo',
      nome: '5 - Fluxo Positivo',
      camada: 'fluxo',
      ordem: 5,
      detectar: function (ctx) {
        const piso = CFG.piso_sobra;
        let ativo = ctx.sobra_real >= piso * ctx.renda;
        if (ativo && ctx.renda_variavel) ativo = ctx.sobra_real_fraca >= piso * ctx.renda_fraca;
        const ev = [];
        if (ativo) {
          ev.push(linhaSobraReal(ctx));
          if (ctx.renda_variavel) {
            ev.push('Sobra real no mês fraco: ' + fmtMoeda(ctx.sobra_real_fraca) + ' (' + fmtPctDe(ctx.sobra_real_fraca, ctx.renda_fraca) + ' da renda fraca)');
          }
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_fluxo, extras: {} };
      }
    },
    {
      id: 'zero_a_zero_opcional',
      nome: '4 - Zero a Zero Opcional',
      camada: 'fluxo',
      ordem: 6,
      detectar: function (ctx) {
        const ativo = ctx.opcionalidade;
        const ev = [];
        if (ativo) {
          ev.push(linhaSobraReal(ctx));
          ev.push('Há gastos opcionais (conforto, aperfeiçoamento ou necessidades acima do básico) que consomem a sobra estrutural: sim');
        }
        return { ativo: ativo, evidencias: ev, faltantes: ctx.faltantes_fluxo, extras: {} };
      }
    },
    {
      id: 'investidor',
      nome: 'Perfil de investidor',
      camada: 'investidor',
      detectar: function () {
        // v3: o perfil de investidor depende da matriz e da camada de dívida; é calculado
        // depois delas em montarCamadaInvestidor e gravado de volta em resultados.investidor
        return { ativo: false, evidencias: ['calculado depois da matriz e da camada de dívida'], faltantes: [], extras: {} };
      }
    }
  ];

  // Política de escolha entre os detectores de fluxo ativos:
  // primeiro ativo na ordem (sem fallback); se nenhum, o fallback ativo.
  function escolherFluxo(resultados) {
    const fluxo = DETECTORES
      .filter(function (d) { return d.camada === 'fluxo'; })
      .sort(function (a, b) { return (a.ordem || 99) - (b.ordem || 99); });
    for (let i = 0; i < fluxo.length; i++) {
      const r = resultados[fluxo[i].id];
      if (r && r.ativo && !(r.extras && r.extras.fallback)) return fluxo[i].id;
    }
    for (let j = 0; j < fluxo.length; j++) {
      const r2x = resultados[fluxo[j].id];
      if (r2x && r2x.ativo) return fluxo[j].id;
    }
    return null;
  }

  // ------------------------------------------------------------
  // 8.6 Camada de dívida (decisão + alavancas + alertas + texto)
  // ------------------------------------------------------------
  function montarCamadaDivida(ctx, resultados) {
    const fa = ctx.funil_atual;
    const fo = ctx.funil_otimizado;
    const parcAtual = ctx.parcelas_total('atual');
    const parcOtim = ctx.parcelas_total('otimizado');

    let status;
    if (ctx.faltantes_divida.length) status = 'incalculavel';
    else if (!ctx.relevante) status = 'sem_dividas_relevantes';
    else if (!fo.passou) status = 'perfil_1';
    else status = 'perfil_2';

    let subtipo = null;
    let subtipo_latente = null;
    if (status === 'perfil_2') {
      subtipo_latente = fa.passou ? '2A' : '2B';
      const temIgnorada = ctx.problemas.some(function (x) { return str(x.situacao_divida) === 'em_atraso'; });
      subtipo = temIgnorada ? '2C' : subtipo_latente;
    }
    const detP1 = resultados.dividas_impagaveis || detectorVazio();
    const reclassificavel = status === 'perfil_1' && !!(detP1.extras && detP1.extras.reclassificavel_apos_pesquisa);

    // Alavancas (informativo): cada uma aplicada sozinha sobre o cenário atual — C1 passa?
    const alavancas = [
      { tipo: 'eliminacao', valor: r2(ctx.eliminacao),
        fecha_conta: funil(ctx, 'atual', { essencial: ctx.essencial_atual - ctx.eliminacao }).c1.passou },
      { tipo: 'reducao', valor: r2(ctx.reducao),
        fecha_conta: funil(ctx, 'atual', { essencial: ctx.essencial_atual - ctx.reducao }).c1.passou },
      { tipo: 'ofertas_em_maos', valor: r2(parcAtual - parcOtim),
        fecha_conta: funil(ctx, 'atual', { parcelas: parcOtim }).c1.passou },
      // venda de bem não altera C1 (só a Etapa 2); pela regra 8.6 o flag compara apenas C1
      // no cenário atual — se a venda cobre o saldo é o Caminho A do funil (caminho_a.passou)
      { tipo: 'venda_de_bem', valor: r2(ctx.patrimonio_vendavel),
        fecha_conta: fa.c1.passou }
    ];

    // Alertas (JSON)
    const alertas = [];
    if (ctx.dividas.some(function (x) { return CFG.regex_rolagem.test(str(x.motivo)); })) alertas.push('rolagem');
    const sobraParaDividaAtual = ctx.renda_base - ctx.essencial_atual - ctx.parcelas_estruturadas;
    const engordando = ctx.problemas.some(function (x) {
      if (str(x.situacao_divida) !== 'em_atraso') return false;
      const cresc = num(x.saldo_devedor) * (Math.pow(1 + taxaMensal(x), 12) - 1);
      return cresc > 12 * Math.max(0, sobraParaDividaAtual);
    });
    if (engordando) alertas.push('divida_ignorada_engordando');
    const acordoEmpobrece = ctx.dividas.some(function (x) {
      if (str(x.proposta_em_vigor) !== 'sim') return false;
      if (num(x.parcela_proposta) <= num(x.valor_parcela)) return false;
      const parcelas = parcAtual - num(x.valor_parcela) + num(x.parcela_proposta);
      return !funil(ctx, 'atual', { parcelas: parcelas }).c1.passou;
    });
    if (acordoEmpobrece) alertas.push('acordo_que_empobrece');
    if (ctx.renda_variavel) {
      const comMedia = funil(ctx, 'otimizado', { renda_base: ctx.renda_media });
      const comFraca = funil(ctx, 'otimizado', { renda_base: ctx.renda_fraca });
      if (comMedia.passou && !comFraca.passou) alertas.push('renda_variavel_falha_mes_fraco');
    }

    // Texto de análise (só JSON)
    const NOME_ALAVANCA = {
      eliminacao: 'eliminação de despesas cortáveis',
      reducao: 'redução do conforto no essencial',
      ofertas_em_maos: 'ofertas de renegociação em mãos',
      venda_de_bem: 'venda de bem'
    };
    let texto_analise = '';
    if (status === 'incalculavel') {
      texto_analise = 'Camada de dívida incalculável: faltam ' + ctx.faltantes_divida.length + ' informação(ões).';
    } else if (status === 'sem_dividas_relevantes') {
      texto_analise = ctx.problemas.length
        ? 'Sem dívidas relevantes: as pendências ficam abaixo dos pisos de relevância (' + fmtPct(CFG.piso_relevancia_estoque) + ' da renda em saldo ou ' + fmtPct(CFG.piso_relevancia_parcela) + ' em parcelas).'
        : 'Sem dívidas-problema.';
    } else if (status === 'perfil_1') {
      texto_analise = 'Dívidas impagáveis no cenário otimizado: ' + motivosFalhaFunil(fo, ctx).join('; ') + '.' +
        (reclassificavel ? ' Não há déficit estrutural: pode ser reclassificada após pesquisa de acordos/alienação.' : ' Há déficit estrutural: a renda não cobre o essencial mesmo sem parcelas.');
    } else if (subtipo === '2A') {
      texto_analise = 'A dívida já cabe no plano atual (renda cobre ' + fmtPct(fa.c1.cobertura) + ' do essencial + parcelas); otimizar o custo sem urgência.';
    } else if (subtipo === '2B') {
      const fecham = alavancas.filter(function (a) { return a.fecha_conta && a.valor > 0; });
      if (fecham.length) {
        texto_analise = 'A dívida só cabe no cenário otimizado; a alavanca que fecha a conta é ' +
          fecham.map(function (a) { return NOME_ALAVANCA[a.tipo] + ' (' + fmtMoeda(a.valor) + ')'; }).join(' ou ') + '.';
      } else {
        texto_analise = 'A dívida só cabe no cenário otimizado; nenhuma alavanca fecha sozinha — combinar eliminação (' + fmtMoeda(ctx.eliminacao) +
          '), redução (' + fmtMoeda(ctx.reducao) + ') e ofertas em mãos (' + fmtMoeda(parcAtual - parcOtim) + ').';
      }
    } else if (subtipo === '2C') {
      texto_analise = 'Risco: há dívida ignorada (em atraso) com juros correndo, protesto ou execução. Se tratada, seria ' + subtipo_latente +
        '; tratar = pagar, propor acordo ou declarar plano.';
    }

    return {
      status: status,
      subtipo: subtipo,
      subtipo_latente: subtipo_latente,
      reclassificavel_apos_pesquisa: reclassificavel,
      pendencias_menores: status === 'sem_dividas_relevantes'
        ? ctx.problemas.map(function (x) { return { nome: nomeDivida(x), saldo: r2(num(x.saldo_devedor)), parcela: r2(num(x.valor_parcela)) }; })
        : [],
      numeros: {
        renda_base: r2(ctx.renda_base),
        renda_media: r2(ctx.renda_media),
        renda_fraca: r2(ctx.renda_fraca),
        usou_mes_fraco: ctx.renda_variavel,
        saldo_problema: r2(ctx.saldo_problema),
        parcelas_problema: r2(ctx.parcelas_problema('atual')),
        parcelas_total: r2(parcAtual),
        essencial_atual: r2(ctx.essencial_atual),
        essencial_otimizado: r2(ctx.essencial_otimizado),
        eliminacao: r2(ctx.eliminacao),
        reducao: r2(ctx.reducao),
        patrimonio_vendavel: r2(ctx.patrimonio_vendavel),
        juros_mensais: r2(ctx.juros_mensais),
        n_domicilio: ctx.n_domicilio
      },
      funil_atual: limparFunil(fa),
      funil_otimizado: limparFunil(fo),
      alavancas: alavancas,
      alertas: alertas,
      texto_analise: texto_analise
    };
  }

  function limparFunil(f) {
    return {
      passou: f.passou,
      c1: f.c1,
      deficit_estrutural: f.deficit_estrutural,
      caminho_a: f.caminho_a,
      caminho_b: f.caminho_b
    };
  }

  // ------------------------------------------------------------
  // 8.9 Código da matriz (7 posições, sem override)
  // ------------------------------------------------------------
  function calcularMatriz(ctx) {
    const M = CFG.matriz;
    const faltantes = [];
    const pos = {};

    // 1. Dependência (A/B/C/D)
    const parceiro = ctx.conjuge !== null;
    let irConjuge = null;
    for (let i = 0; i < ctx.declaracoes_ir.length; i++) {
      if (str(ctx.declaracoes_ir[i].pessoa_key) === 'conjuge_cliente') { irConjuge = ctx.declaracoes_ir[i]; break; }
    }
    const parceiro_com_renda = parceiro && ((ctx.renda_por_pessoa['conjuge'] || 0) > 0 || (irConjuge !== null && num(irConjuge.renda_bruta_anual) > 0));
    const deps = ctx.dependentes_pessoa + (parceiro && !parceiro_com_renda ? 1 : 0);
    let dep;
    if (!parceiro_com_renda) dep = deps === 0 ? 'A' : 'B';
    else dep = deps === 0 ? 'C' : 'D';
    pos.dependencia = {
      valor: dep,
      justificativa: dep + ' — ' + (parceiro_com_renda ? 'parceiro com renda própria' : 'sem parceiro com renda própria') +
        '; ' + deps + (deps === 1 ? ' dependente' : ' dependentes') +
        (parceiro && !parceiro_com_renda ? ' (cônjuge sem renda conta como dependente)' : '')
    };

    // 2. Tempo (T1–T5): anos até a aposentadoria do titular
    const aposentadorias = ctx.objetivos.filter(function (o) { return str(o.tipo) === 'aposentadoria'; });
    let objApos = null;
    for (let k = 0; k < aposentadorias.length; k++) {
      if (str(aposentadorias[k].prazo_pessoa) === 'titular') { objApos = aposentadorias[k]; break; }
    }
    if (!objApos && aposentadorias.length) objApos = aposentadorias[0];
    let tempo = '?';
    let tempoJust = '';
    let meses = null;
    if (!objApos) {
      faltantes.push('Objetivo de aposentadoria (tempo até a aposentadoria)');
      tempoJust = '? — sem objetivo de aposentadoria';
    } else {
      const pt = str(objApos.prazo_tipo) || 'idade';
      if (pt === 'idade') {
        if (ctx.idade_titular === null) {
          faltantes.push('Data de nascimento do titular (tempo até a aposentadoria)');
          tempoJust = '? — sem data de nascimento do titular';
        } else {
          const idadeAlvo = num(objApos.prazo_idade) || 65;
          meses = (idadeAlvo - ctx.idade_titular) * 12;
          if (meses < 0) meses = 0;
          tempoJust = ' aos ' + idadeAlvo + ' anos (titular com ' + ctx.idade_titular + ')';
        }
      } else if (pt === 'data') {
        const dt = parseDataLocal(objApos.prazo_data);
        if (dt) {
          meses = mesesEntre(ctx.referencia, dt);
          tempoJust = ' até ' + dt.toLocaleDateString('pt-BR');
        } else {
          faltantes.push('Data da aposentadoria no objetivo (tempo até a aposentadoria)');
          tempoJust = '? — objetivo de aposentadoria sem data';
        }
      } else {
        meses = num(objApos.prazo_meses); // 'meses' e 'anos' já vêm em meses
        if (meses < 0) meses = 0;
        tempoJust = ' (prazo informado no objetivo)';
      }
    }
    if (meses !== null) {
      const anos = meses / 12;
      tempo = faixaPorLimite(M.tempo_faixas, anos, false);
      tempoJust = tempo + ' — ' + fmtNum(anos, 0) + ' anos até a aposentadoria' + tempoJust;
    }
    pos.tempo = { valor: tempo, justificativa: tempoJust };

    // 3. Moradia (M0/M1/M2)
    const custeio = str(ctx.complementares.custeio_moradia);
    const MAPA_MORADIA = { nao_contribui: ['M0', 'não contribui com o custeio da moradia'], parcial: ['M1', 'custeio parcial da moradia'], integral: ['M2', 'custeio integral da moradia'] };
    if (MAPA_MORADIA[custeio]) {
      pos.moradia = { valor: MAPA_MORADIA[custeio][0], justificativa: MAPA_MORADIA[custeio][0] + ' — ' + MAPA_MORADIA[custeio][1] };
    } else {
      faltantes.push('Custeio da moradia (card do perfil)');
      pos.moradia = { valor: '?', justificativa: '? — informe o custeio da moradia no card do perfil' };
    }

    // 4. Poupança (P1–P4): proteção + aperfeiçoamento + aportes, sobre a renda
    const rendaM = ctx.renda_media;
    if (rendaM <= 0) {
      faltantes.push('Receitas do fluxo de caixa (poder de poupança)');
      pos.poupanca = { valor: '?', justificativa: '? — sem renda para calcular o poder de poupança' };
    } else {
      const numerador = ctx.protecao_mensal + ctx.aperf_mensal + ctx.aportes_mensais;
      const poder = numerador / rendaM;
      const p = faixaPorLimite(M.poupanca_faixas, poder, true);
      pos.poupanca = {
        valor: p,
        justificativa: p + ' — poder de poupança = ' + fmtPct(poder) + ' da renda (proteção ' + fmtMoeda(ctx.protecao_mensal) +
          ' + aperfeiçoamento ' + fmtMoeda(ctx.aperf_mensal) + ' + aportes ' + fmtMoeda(ctx.aportes_mensais) + ')'
      };
    }

    // 5. Fonte (F1–F3): receita manual de maior valor mensal do domicílio
    const receitasOrdenadas = ctx.receitas.slice().map(function (r) {
      return { nome: str(r.nome).trim() || 'Receita', tipo: str(r.tipo), titular: str(r.titular) || 'titular', valor: mensal(r.valor, r.qtd_recorrencia, r.und_recorrencia) };
    }).sort(function (a, b) { return b.valor - a.valor; });
    function fonteDoTipo(tipo) { return M.fonte_por_tipo_receita[tipo] || 'F3'; }
    if (!receitasOrdenadas.length) {
      faltantes.push('Receitas do fluxo de caixa (fonte da renda)');
      pos.fonte = { valor: '?', justificativa: '? — nenhuma receita informada' };
    } else {
      const maior = receitasOrdenadas[0];
      const f = fonteDoTipo(maior.tipo);
      const demais = receitasOrdenadas.slice(1).map(function (r) { return r.nome + ' ' + fmtMoeda(r.valor); });
      pos.fonte = {
        valor: f,
        justificativa: f + ' — maior receita: ' + maior.nome + ' (' + (maior.tipo || 'tipo não informado') + ') ' + fmtMoeda(maior.valor) +
          (demais.length ? '; demais: ' + demais.join(', ') : '')
      };
    }

    // 6. Patrimônio (B0–B4): fração física
    const fisico = ctx.fisicos.reduce(function (s, p) { return s + num(p.valor); }, 0);
    const liquido = ctx.liquidos.reduce(function (s, pl) { return s + num(pl.valor_atual); }, 0);
    let bval;
    let fracao = 0;
    if (fisico + liquido <= 0 || fisico <= 0) {
      bval = 'B0';
    } else {
      fracao = fisico / (fisico + liquido);
      bval = faixaPorTeto(M.patrimonio_faixas, fracao);
    }
    pos.patrimonio = {
      valor: bval,
      justificativa: bval + ' — ' + fmtPct(fracao) + ' do patrimônio é físico (físico ' + fmtMoeda(fisico) + ' / líquido ' + fmtMoeda(liquido) + ')'
    };

    // 7. Reserva (R0–R4): alvo por earner com renda
    const notas = [];
    let ajusteTempo = 0;
    if (tempo === 'T4') ajusteTempo = 1;
    else if (tempo === 'T5') ajusteTempo = 2;
    else if (tempo === '?') notas.push('ajuste de tempo não aplicado (dado faltante)');
    let ajusteMoradia = 0;
    if (pos.moradia.valor === 'M2') ajusteMoradia = 1;
    else if (pos.moradia.valor === '?') notas.push('ajuste de moradia não aplicado (dado faltante)');
    let ajustePoupanca = 0;
    if (pos.poupanca.valor === 'P4') ajustePoupanca = 1;
    else if (pos.poupanca.valor === '?') notas.push('ajuste de poupança não aplicado (dado faltante)');
    const ajustePatrimonio = bval === 'B4' ? 1 : 0;
    const ajusteDeps = deps > 0 ? 1 : 0;
    let alvo = 0;
    let mesesTxt = [];
    ctx.earners.forEach(function (e) {
      const rendaE = ctx.renda_por_pessoa[e.id] || 0;
      if (rendaE <= 0) return;
      let maior = null;
      receitasOrdenadas.forEach(function (r) {
        if (r.titular === e.id && (maior === null || r.valor > maior.valor)) maior = r;
      });
      const fonteE = maior ? fonteDoTipo(maior.tipo) : 'F3';
      let mesesE = (M.reserva_base_meses[fonteE] || M.reserva_base_meses.F3) + ajusteDeps + ajusteTempo + ajusteMoradia + ajustePoupanca + ajustePatrimonio;
      mesesE = Math.min(mesesE, M.reserva_teto_meses);
      alvo += mesesE * rendaE;
      mesesTxt.push(mesesE + ' meses');
    });
    let rval;
    let reservaJust;
    if (alvo <= 0) {
      faltantes.push('Renda por pessoa (alvo da reserva de emergência)');
      rval = '?';
      reservaJust = '? — sem renda por pessoa para calcular o alvo da reserva';
    } else if (ctx.reserva_atual <= 0) {
      rval = 'R0';
      reservaJust = 'R0 — sem reserva de emergência (alvo ' + fmtMoeda(alvo) + ', ' + unicos(mesesTxt).join(' / ') + ')';
    } else {
      const razao = ctx.reserva_atual / alvo;
      rval = faixaPorTeto(M.reserva_faixas, razao);
      reservaJust = rval + ' — reserva ' + fmtMoeda(ctx.reserva_atual) + ' = ' + fmtPct(razao) + ' do alvo de ' + fmtMoeda(alvo) + ' (' + unicos(mesesTxt).join(' / ') + ')';
    }
    if (notas.length) reservaJust += '; ' + notas.join('; ');
    pos.reserva = { valor: rval, justificativa: reservaJust };

    const codigo = [pos.dependencia.valor, pos.tempo.valor, pos.moradia.valor, pos.poupanca.valor, pos.fonte.valor, pos.patrimonio.valor, pos.reserva.valor].join('-');
    return { codigo: codigo, por_posicao: pos, faltantes: unicos(faltantes), alvo_reserva: r2(alvo) };
  }

  // ------------------------------------------------------------
  // v3 — Selo de adequação da reserva (Parte 4). Só rótulo + override:
  // não realimenta a posição R nem as travas. Análise só no JSON.
  // ------------------------------------------------------------
  function montarSeloReserva(ctx, matriz) {
    const rv3 = ctx.rv3;
    const alvo = num(matriz.alvo_reserva);
    const R = matriz.por_posicao && matriz.por_posicao.reserva ? str(matriz.por_posicao.reserva.valor) : '?';
    const reserva = ctx.reserva_atual;
    let exposicao = 0;
    const expostos = [];
    ctx.liquidos.forEach(function (pl) {
      const v = num(pl.valor_atual);
      if (v <= 0) return;
      const classe = classeItem(rv3, pl);
      if (ordemClasse(rv3, classe) >= 4) {
        exposicao += v;
        expostos.push({ nome: nomeInvestimento(pl), classe: classe, valor: r2(v) });
      }
    });
    const limite = CFG.investidor.selo_relevancia_exposicao * alvo;
    const faltantes = [];
    let calculado = null;
    if (!rv3) {
      faltantes.push('Selo da reserva: ' + FALTANTE_RISCOS_V3);
    } else if (alvo <= 0 || R === '?') {
      faltantes.push('Selo da reserva: alvo da reserva incalculável');
    } else if (reserva >= alvo) {
      calculado = 'adequada';
    } else if (exposicao > limite) {
      calculado = 'inadequada';
    } else {
      calculado = 'em_formacao';
    }
    const ajustadoBruto = str(ctx.selo_ui.ajustado).trim();
    const ajustado = tem(ROTULOS_SELO, ajustadoBruto) ? ajustadoBruto : '';
    return {
      calculado: calculado,
      rotulo: calculado ? ROTULOS_SELO[calculado] : null,
      ajustado: ajustado,
      justificativa_consultor: str(ctx.selo_ui.justificativa_consultor),
      vigente: ajustado || calculado || null,
      analise: {
        alvo: r2(alvo),
        reserva_valida: r2(reserva),
        falta: r2(Math.max(0, alvo - reserva)),
        exposicao_acima_do_baixo: r2(exposicao),
        limite_relevancia: r2(limite),
        itens_desconsiderados: ctx.reserva_desconsiderada.slice(),
        itens_expostos: expostos
      },
      faltantes: faltantes
    };
  }

  // ------------------------------------------------------------
  // v3 — Perfil de investidor por pessoa (Partes 3 e 5)
  // Roda DEPOIS da matriz e da camada de dívida. Bloco B e travas são do
  // domicílio e leem o perfil financeiro VIGENTE. Dado ausente: nenhuma
  // trava daquele tipo + faltante (nunca inventar trava).
  // ------------------------------------------------------------
  const ROTULO_SUBTIPO_DIVIDA = { '2C': 'Perfil 2 não tratada', '2B': 'Perfil 2 readequação', '2A': 'Perfil 2 adequada' };

  function linhaMemoria(rotulo, valor) {
    let r = str(rotulo);
    while (r.length < 24) r += '.';
    return r + ' ' + valor;
  }

  function padDireita(s, n) {
    let x = str(s);
    while (x.length < n) x += ' ';
    return x;
  }

  function valorNotaMemoria(nota, fracao) {
    if (nota === null || nota === undefined) return '— (' + fracao + ')';
    return Math.round(nota) + '/100 → ' + padDireita(nomePerfilInvestidor(reguaInvestidor(nota)), 17) + ' (' + fracao + ')';
  }

  function nomeMaiusculo(id) {
    return nomePerfilInvestidor(id).toUpperCase();
  }

  function textoLimitante(x) {
    switch (x.tipo) {
      case 'T1': return 'trava T1 — sem reserva imediata';
      case 'T5': return 'trava T5 — ' + (x.variante === 'P2'
        ? 'dívidas pagáveis: formar a reserva imediata antes de acelerar a quitação'
        : 'dívidas impagáveis sem capacidade de poupar');
      case 'T2': return 'trava T2 — reserva de emergência incompleta';
      case 'B3': return 'teto B3 — necessidade prevista de recursos em até 2 anos';
      case 'A1': return 'teto A1 — ' + x.texto;
      case 'A2': return 'teto A2 — ' + x.texto;
      default: return 'nota ' + x.tipo + ' — ' + (NOME_BLOCO_NOTA[x.tipo] || '');
    }
  }

  function textoDestrava(x, nivel) {
    const alvo = nomePerfilInvestidor(nivel);
    switch (x.tipo) {
      case 'T1': return 'ao formar a reserva imediata (sair de R0), sobe para ' + alvo;
      case 'T2': return 'ao atingir R4, sobe para ' + alvo;
      case 'T5': return x.variante === 'P2'
        ? 'ao sair da camada de dívidas pagáveis, sobe para ' + alvo
        : 'ao conseguir poupar ao menos ' + fmtPct(CFG.piso_sobra, 0) + ' da renda, sobe para ' + alvo;
      case 'A1': return 'com horizonte de retirada mais longo (A1), sobe para ' + alvo;
      case 'A2': return 'se a finalidade do dinheiro mudar (A2), sobe para ' + alvo;
      case 'B3': return 'passada a necessidade prevista em até 2 anos (B3), sobe para ' + alvo;
      default: return 'com ' + (NOME_BLOCO_NOTA[x.tipo] || '') + ' ≥ ' + limiarFaixa(nivel) + ', sobe para ' + alvo;
    }
  }

  // C2: nível de conhecimento que o patrimônio atual comprova (0-4)
  function nivelComprovadoC2(rv3, itens) {
    let nivel = 0;
    itens.forEach(function (pl) {
      const n = str(pl.tipo_produto_nome);
      let nv;
      if (/a[çc][õo]es|fii|fundo imobili|etf|bdr/i.test(n)) nv = 4;
      else if (/fundo|pgbl|vgbl|previd|coe/i.test(n)) nv = 3;
      else if (/tesouro/i.test(n)) nv = 2;
      else if (/cdb|rdb|lc[ai]?\b|lci|lca|lh|lcd|poupan|conta/i.test(n)) nv = 1;
      else {
        const o = ordemItem(rv3, pl);
        nv = o >= 6 ? 4 : (o >= 4 ? 3 : (o >= 1 ? 1 : 0));
      }
      if (nv > nivel) nivel = nv;
    });
    return nivel;
  }

  function montarDomicilioInvestidor(ctx, camada_divida, camada_fluxo, matriz, perfilFinVigente, perfilFinCalculado) {
    const IC = CFG.investidor;
    const sv3 = ctx.suitability_v3 || {};
    const sv3dom = (sv3.domicilio && typeof sv3.domicilio === 'object') ? sv3.domicilio : {};
    const pos = matriz.por_posicao || {};
    const faltantes = [];   // tornam o perfil de investidor incalculável
    const pendencias = [];  // não bloqueiam
    const notas = [];       // notas de memória do domicílio
    if (!ctx.rv3) faltantes.push(FALTANTE_RISCOS_V3);

    // B4.1 reserva
    const R = pos.reserva ? str(pos.reserva.valor) : '?';
    const reserva = { posicao: R, pontos: tem(IC.b4_reserva, R) ? IC.b4_reserva[R] : null };
    reserva.rotulo = R + '=' + (reserva.pontos === null ? '—' : reserva.pontos);
    if (reserva.pontos === null) faltantes.push('Capacidade: posição R da reserva incalculável');

    // B4.2 dívida (pelo perfil financeiro VIGENTE)
    const divida = { perfil: perfilFinVigente || null, subtipo: camada_divida ? (camada_divida.subtipo || null) : null, pontos: null, rotulo: '' };
    if (perfilFinVigente === 'dividas_impagaveis') {
      divida.pontos = IC.b4_divida.perfil_1;
      divida.rotulo = 'Perfil 1';
    } else if (perfilFinVigente === 'dividas_pagaveis') {
      const sub = str(divida.subtipo);
      if (camada_divida && camada_divida.status === 'perfil_2' && tem(ROTULO_SUBTIPO_DIVIDA, sub)) {
        divida.pontos = IC.b4_divida[sub];
        divida.rotulo = ROTULO_SUBTIPO_DIVIDA[sub];
      } else {
        divida.pontos = IC.b4_divida['2C'];
        divida.rotulo = 'Perfil 2 não tratada';
        notas.push('subtipo não calculado; considerado não tratada');
      }
    } else if (perfilFinVigente && perfilPorId(perfilFinVigente)) {
      divida.pontos = IC.b4_divida.sem_dividas_relevantes;
      divida.rotulo = 'sem dívida';
    } else {
      faltantes.push('Capacidade: situação de dívida incalculável');
    }
    divida.rotulo_memoria = (divida.rotulo || 'dívida') + '=' + (divida.pontos === null ? '—' : divida.pontos);

    // B4.3 fonte
    const F = pos.fonte ? str(pos.fonte.valor) : '?';
    const fonte = { posicao: F, pontos: tem(IC.b4_fonte, F) ? IC.b4_fonte[F] : null };
    fonte.rotulo = F + '=' + (fonte.pontos === null ? '—' : fonte.pontos);
    if (fonte.pontos === null) faltantes.push('Capacidade: fonte da renda (F) incalculável');

    // B4.4 poupança
    const P = pos.poupanca ? str(pos.poupanca.valor) : '?';
    const poupanca = { posicao: P, pontos: tem(IC.b4_poupanca, P) ? IC.b4_poupanca[P] : null };
    poupanca.rotulo = P + '=' + (poupanca.pontos === null ? '—' : poupanca.pontos);
    if (poupanca.pontos === null) faltantes.push('Capacidade: poder de poupança (P) incalculável');

    // B4.5 colchão patrimonial (todos os investimentos ÷ renda mensal do domicílio)
    const totalLiquido = ctx.liquidos.reduce(function (s, pl) { return s + num(pl.valor_atual); }, 0);
    const colchao = { patrimonio_liquido: r2(totalLiquido), renda_mensal: r2(ctx.renda_media), rendas: null, pontos: null, rotulo: '' };
    if (ctx.renda_media > 0) {
      const rendas = totalLiquido / ctx.renda_media;
      colchao.rendas = r2(rendas);
      colchao.pontos = 0;
      const faixas = IC.colchao_faixas;
      for (let i = 0; i < faixas.length; i++) {
        if (rendas >= faixas[i][0]) { colchao.pontos = faixas[i][1]; break; }
      }
    } else {
      faltantes.push('Capacidade: renda mensal do domicílio não informada (colchão patrimonial)');
    }
    colchao.rotulo = 'colchão=' + (colchao.pontos === null ? '—' : colchao.pontos);

    const partes = [reserva, divida, fonte, poupanca, colchao];
    const completo = partes.every(function (p) { return p.pontos !== null; });
    const somaB = completo ? partes.reduce(function (s, p) { return s + p.pontos; }, 0) : null;
    const nota_B = completo ? somaB * 5 : null;

    // B3 necessidade futura
    const B3 = str(sv3dom.B3);
    let tetoB3 = null;
    if (B3 === 'ate_2_anos') {
      tetoB3 = { tipo: 'B3', nivel: '3', texto: 'necessidade prevista de recursos em até 2 anos' };
    } else if (B3 === 'entre_2_e_5_anos') {
      notas.push('necessidade entre 2 e 5 anos: vincular pote');
    } else if (B3 !== 'nao_prevista') {
      faltantes.push('Teste de perfil: responder B3 (necessidade futura de recursos)');
    }

    // B1/B2 confirmação (pendência, não bloqueia)
    const conf = (sv3dom.confirmacao_b1b2 && typeof sv3dom.confirmacao_b1b2 === 'object') ? sv3dom.confirmacao_b1b2 : {};
    if (conf.confirmado !== true) {
      pendencias.push('Teste de perfil: cliente ainda não confirmou receitas e patrimônio (B1/B2)');
    } else if (Math.abs(num(conf.renda_mensal) - ctx.renda_media) > 1 || Math.abs(num(conf.patrimonio_liquido) - totalLiquido) > 1) {
      const dt = parseDataLocal(conf.em);
      pendencias.push('dados de receitas/patrimônio mudaram desde a confirmação de ' + (dt ? dt.toLocaleDateString('pt-BR') : 'data não registrada'));
    }

    // Travas (domicílio)
    const travas = [];
    if (R === 'R0') {
      travas.push({ tipo: 'T1', nivel: '1', texto: 'sem reserva imediata', detalhe: 'reserva em R0' });
    } else if (R === 'R1' || R === 'R2' || R === 'R3') {
      travas.push({ tipo: 'T2', nivel: '3', texto: 'reserva de emergência incompleta (' + R + ')', detalhe: 'reserva em ' + R });
    }
    if (perfilFinVigente === 'dividas_pagaveis') {
      travas.push({ tipo: 'T5', variante: 'P2', nivel: '1', texto: 'dívidas pagáveis: formar a reserva imediata antes de acelerar a quitação', detalhe: 'dívidas pagáveis' });
    } else if (perfilFinVigente === 'dividas_impagaveis') {
      const sobra = (camada_fluxo && camada_fluxo.numeros) ? num(camada_fluxo.numeros.sobra_real) : ctx.sobra_real;
      if (sobra >= CFG.piso_sobra * ctx.renda) {
        notas.push('Perfil 1 com capacidade de poupar: perfil normal — o dinheiro acumulado é o pote do acordo (prazo curto e incerto); a trava de horizonte T4 mantém cada pote nos degraus baixos');
      } else {
        travas.push({ tipo: 'T5', variante: 'P1', nivel: '1', texto: 'dívidas impagáveis sem capacidade de poupar', detalhe: 'dívidas impagáveis sem capacidade de poupar' });
      }
    }

    const divergente = !!perfilFinVigente && perfilFinVigente !== perfilFinCalculado;
    if (divergente) {
      notas.push('trava aplicada a partir do perfil ajustado pelo consultor (calculado era ' +
        (perfilFinCalculado ? rotuloPerfil(perfilFinCalculado) : 'incalculável') + ')');
    }

    return {
      nota_B: nota_B,
      B4: { reserva: reserva, divida: divida, fonte: fonte, poupanca: poupanca, colchao: colchao, soma: somaB, max: 20 },
      B3: B3,
      teto_B3: tetoB3,
      confirmacao_b1b2: {
        confirmado: conf.confirmado === true,
        em: conf.em || null
      },
      travas: travas,
      perfil_financeiro_base: { vigente: perfilFinVigente || null, calculado: perfilFinCalculado || null, divergente: divergente },
      notas: notas,
      faltantes: unicos(faltantes),
      pendencias: unicos(pendencias)
    };
  }

  function montarPessoaInvestidor(nome, indice, ctx, dom, titularNome) {
    const rv3 = ctx.rv3;
    const sv3 = ctx.suitability_v3 || {};
    const sv3pessoas = (sv3.pessoas && typeof sv3.pessoas === 'object') ? sv3.pessoas : {};
    const r = (tem(sv3pessoas, nome) && sv3pessoas[nome] && typeof sv3pessoas[nome] === 'object') ? sv3pessoas[nome] : {};

    // ---- Respostas e faltantes ----
    const faltaCod = [];
    const A1 = str(r.A1);
    const A2 = str(r.A2);
    if (!tem(TETO_A1, A1)) faltaCod.push('A1');
    if (!tem(TETO_A2, A2)) faltaCod.push('A2');
    const A = {};
    CHAVES_A.forEach(function (k) {
      A[k] = respostaNum(r[k]);
      if (A[k] === null) faltaCod.push(k);
    });
    const C = {};
    CHAVES_C.forEach(function (k) {
      C[k] = respostaNum(r[k]);
      if (C[k] === null) faltaCod.push(k);
    });
    const c6 = arr(r.C6);
    const c6Resp = [];
    let c6Falta = 0;
    let acertos = 0;
    for (let i = 0; i < GABARITO_C6.length; i++) {
      const v = c6[i];
      if (v !== true && v !== false) {
        c6Falta++;
        c6Resp.push(null);
      } else {
        c6Resp.push(v);
        if (v === GABARITO_C6[i]) acertos++;
      }
    }
    if (c6Falta) faltaCod.push('C6 (' + c6Falta + (c6Falta === 1 ? ' afirmação' : ' afirmações') + ')');
    const faltantes = faltaCod.length ? ['responder ' + faltaCod.join(', ')] : [];

    // ---- Itens da pessoa (item sem donos conta para o titular) ----
    const ehTitular = !!titularNome && nome === titularNome;
    const itens = ctx.liquidos.filter(function (pl) {
      if (num(pl.valor_atual) <= 0) return false;
      const donos = arr(pl.donos).map(function (dn) { return str(dn).trim(); }).filter(Boolean);
      return donos.length ? donos.indexOf(nome) !== -1 : ehTitular;
    });

    // ---- Verificações cruzadas ----
    const verificacoes = [];
    let A6ef = A.A6;
    if (A.A6 !== null && A.A6 >= 3 && rv3) {
      const temOscilante = itens.some(function (pl) { return ordemItem(rv3, pl) >= CFG.investidor.a6_classe_min_oscilante; });
      if (!temOscilante) {
        A6ef = 2;
        verificacoes.push('A6 declarado ' + A.A6 + ', sem ativo oscilante no patrimônio de ' + nome + ': vale 2');
      }
    }
    const comprovado = nivelComprovadoC2(rv3, itens);
    let C2ef = C.C2;
    if (C.C2 !== null && rv3 && C.C2 > comprovado) {
      C2ef = comprovado;
      verificacoes.push('C2 declarado ' + C.C2 + ', patrimônio atual comprova ' + comprovado);
    }

    // ---- Notas ----
    const temA = CHAVES_A.every(function (k) { return A[k] !== null; });
    const somaA = temA ? (A.A3 + A.A4 + A.A5 + A6ef + A.A7 + A.A8 + A.A9 + A.A10) : null;
    const notaA = temA ? somaA * 100 / 32 : null;
    const notaC6 = acertos / 2;
    const temC = CHAVES_C.every(function (k) { return C[k] !== null; }) && c6Falta === 0;
    const somaC = temC ? (C.C1 + C2ef + C.C3 + C.C4 + C.C5 + notaC6) : null;
    const notaC = temC ? somaC * 100 / 24 : null;
    const notaB = dom.nota_B;

    // ---- Tetos (pessoa + B3 do domicílio) e travas (domicílio) ----
    const tetos = [];
    if (tem(TETO_A1, A1) && TETO_A1[A1]) tetos.push({ tipo: 'A1', nivel: TETO_A1[A1], texto: 'horizonte de retirada: ' + TEXTO_A1[A1] });
    if (tem(TETO_A2, A2) && TETO_A2[A2]) tetos.push({ tipo: 'A2', nivel: TETO_A2[A2], texto: 'finalidade: ' + TEXTO_A2[A2] });
    if (dom.teto_B3) tetos.push(Object.assign({}, dom.teto_B3));
    const travas = dom.travas.map(function (t) { return Object.assign({}, t); });

    const calculavel = !faltaCod.length && !dom.faltantes.length && notaA !== null && notaB !== null && notaC !== null;

    let bruto = null;
    let tetado = null;
    let final = null;
    let limitante = { tipos: [], texto: '' };
    let destrava = '';
    let destravaNivel = null;
    if (calculavel) {
      bruto = reguaInvestidor(Math.min(notaA, notaB, notaC));
      tetado = bruto;
      tetos.forEach(function (t) { if (Number(t.nivel) < Number(tetado)) tetado = t.nivel; });
      final = tetado;
      travas.forEach(function (t) { if (Number(t.nivel) < Number(final)) final = t.nivel; });

      const restricoes = [];
      travas.forEach(function (t) { restricoes.push({ tipo: t.tipo, nivel: t.nivel, variante: t.variante || '', texto: t.texto }); });
      tetos.forEach(function (t) { restricoes.push({ tipo: t.tipo, nivel: t.nivel, variante: '', texto: t.texto }); });
      restricoes.push({ tipo: 'C', nivel: reguaInvestidor(notaC), variante: '', texto: '' });
      restricoes.push({ tipo: 'B', nivel: reguaInvestidor(notaB), variante: '', texto: '' });
      restricoes.push({ tipo: 'A', nivel: reguaInvestidor(notaA), variante: '', texto: '' });

      const empatados = restricoes
        .filter(function (x) { return Number(x.nivel) === Number(final); })
        .sort(function (a, b) { return PRIORIDADE_LIMITANTE.indexOf(a.tipo) - PRIORIDADE_LIMITANTE.indexOf(b.tipo); });
      const restantes = restricoes.filter(function (x) { return Number(x.nivel) !== Number(final); });
      destravaNivel = '7';
      restantes.forEach(function (x) { if (Number(x.nivel) < Number(destravaNivel)) destravaNivel = x.nivel; });
      limitante = {
        tipos: empatados.map(function (x) { return x.tipo; }),
        texto: empatados.map(textoLimitante).join(' e ')
      };
      destrava = (Number(destravaNivel) === Number(final) || !empatados.length) ? '—' : textoDestrava(empatados[0], destravaNivel);
    }

    // ---- Memória de cálculo ----
    const linhas = [];
    const fracA = 'A3-A10: ' + (somaA === null ? 'faltam respostas' : fmtNum(somaA, 1) + '/32');
    const fracC = 'C1-C6: ' + (somaC === null ? 'faltam respostas' : fmtNum(somaC, 1) + '/24');
    const b4 = dom.B4;
    const fracB = [b4.reserva.rotulo, b4.divida.rotulo_memoria, b4.fonte.rotulo, b4.poupanca.rotulo, b4.colchao.rotulo].join(' · ');
    linhas.push(linhaMemoria('Preferências de risco', valorNotaMemoria(notaA, fracA)));
    linhas.push(linhaMemoria('Conhecimento', valorNotaMemoria(notaC, fracC)));
    linhas.push(linhaMemoria('Capacidade', valorNotaMemoria(notaB, fracB)));
    linhas.push(linhaMemoria('Teto de liquidez', !tem(TETO_A1, A1) ? '— (responder A1)'
      : (TETO_A1[A1] ? 'teto ' + nomePerfilInvestidor(TETO_A1[A1]) + ' (A1: ' + TEXTO_A1[A1] + ')' : 'sem teto')));
    linhas.push(linhaMemoria('Teto de finalidade', !tem(TETO_A2, A2) ? '— (responder A2)'
      : (TETO_A2[A2] ? 'teto ' + nomePerfilInvestidor(TETO_A2[A2]) + ' (A2: ' + TEXTO_A2[A2] + ')' : 'sem teto')));
    let necessidade;
    if (dom.B3 === 'ate_2_anos') necessidade = 'teto ' + nomePerfilInvestidor('3') + ' (B3: ' + TEXTO_B3.ate_2_anos + ')';
    else if (dom.B3 === 'entre_2_e_5_anos') necessidade = 'sem teto (B3: ' + TEXTO_B3.entre_2_e_5_anos + ' — vincular pote)';
    else if (dom.B3 === 'nao_prevista') necessidade = 'sem efeito';
    else necessidade = '— (responder B3)';
    linhas.push(linhaMemoria('Necessidade futura', necessidade));
    linhas.push(SEPARADOR_MEMORIA);
    linhas.push('Menor das notas → ' + (calculavel ? nomePerfilInvestidor(bruto) : '—'));
    if (calculavel) {
      tetos.forEach(function (t) {
        if (Number(t.nivel) < Number(bruto)) linhas.push('Teto ' + t.tipo + ' (' + t.texto + ') → teto ' + nomeMaiusculo(t.nivel));
      });
    }
    verificacoes.forEach(function (v) { linhas.push(v); });
    if (!c6Falta) linhas.push('C6: ' + acertos + '/8 acertos = ' + fmtNum(notaC6, 1));
    travas.forEach(function (t) {
      if (!calculavel || Number(t.nivel) <= Number(tetado)) {
        linhas.push('Trava ' + t.tipo + ' (' + t.detalhe + ') → teto ' + nomeMaiusculo(t.nivel));
      }
    });
    dom.notas.forEach(function (n) { linhas.push('Nota: ' + n); });
    if (calculavel) {
      linhas.push('PERFIL FINAL: ' + nomeMaiusculo(final));
      linhas.push('LIMITANTE: ' + limitante.texto);
      linhas.push('DESTRAVA: ' + destrava);
    } else {
      linhas.push('PERFIL FINAL: INCALCULÁVEL');
      linhas.push('FALTAM: ' + faltantes.concat(dom.faltantes).join('; '));
    }

    // ---- Ajuste do consultor (lido do card; 1ª pessoa aceita a chave antiga "investidor") ----
    let ui = tem(ctx.investidor_ui, nome) ? ctx.investidor_ui[nome] : null;
    if (!ui && indice === 0) ui = ctx.investidor;
    ui = ui || {};
    const ajustadoBruto = str(ui.ajustado).trim();
    const ajustado = nomePerfilInvestidor(ajustadoBruto) ? ajustadoBruto : '';
    const calculado = calculavel ? final : null;

    const respostas = { A1: A1, A2: A2 };
    CHAVES_A.forEach(function (k) { respostas[k] = A[k]; });
    CHAVES_C.forEach(function (k) { respostas[k] = C[k]; });
    respostas.C6 = c6Resp;
    respostas.A6_efetivo = A6ef;
    respostas.C2_efetivo = C2ef;
    respostas.C2_comprovado = comprovado;
    respostas.C6_acertos = c6Falta ? null : acertos;

    return {
      calculado: calculado,
      rotulo: calculado ? nomePerfilInvestidor(calculado) : 'Incalculável',
      notas: {
        A: { soma: somaA, max: 32, valor: r2(notaA) },
        B: { soma: dom.B4.soma, max: 20, valor: r2(notaB) },
        C: { soma: somaC, max: 24, valor: r2(notaC) }
      },
      respostas: respostas,
      tetos: tetos,
      travas: travas,
      verificacoes: verificacoes,
      perfil_bruto: bruto,
      perfil_tetado: tetado,
      limitante: limitante,
      destrava: destrava,
      destrava_nivel: calculavel && destrava !== '—' ? destravaNivel : null,
      memoria_calculo: { linhas: linhas },
      ajustado: ajustado,
      justificativa_consultor: str(ui.justificativa_consultor),
      desenquadramento: { termo_colhido: ui.termo_colhido === true },
      vigente: ajustado || calculado || null,
      faltantes: faltantes
    };
  }

  // Devolve no formato dos detectores: { ativo, evidencias, faltantes, extras: { perfil_investidor, status, resumo } }
  function montarCamadaInvestidor(ctx, camada_divida, camada_fluxo, matriz, perfilFinVigente, perfilFinCalculado) {
    // Pessoas: titular (se preenchido) + donos dos investimentos, sem repetição, titular primeiro e os demais em ordem alfabética
    const titularNome = str(ctx.titular && ctx.titular.nome).trim();
    const outros = [];
    ctx.liquidos.forEach(function (pl) {
      arr(pl.donos).forEach(function (dn) {
        const n = str(dn).trim();
        if (n && n !== titularNome && outros.indexOf(n) === -1) outros.push(n);
      });
    });
    outros.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    const pessoas = (titularNome ? [titularNome] : []).concat(outros);

    const dom = montarDomicilioInvestidor(ctx, camada_divida, camada_fluxo, matriz, perfilFinVigente, perfilFinCalculado);
    const por_pessoa = {};
    pessoas.forEach(function (nome, i) {
      por_pessoa[nome] = montarPessoaInvestidor(nome, i, ctx, dom, titularNome);
    });

    const primeira = pessoas.length ? por_pessoa[pessoas[0]] : null;
    const ajustadoLegado = str(ctx.investidor.ajustado).trim();
    const perfil_investidor = {
      versao: 3,
      pessoas_ordem: pessoas,
      domicilio: {
        nota_B: dom.nota_B,
        B4: dom.B4,
        B3: dom.B3,
        teto_B3: dom.teto_B3,
        confirmacao_b1b2: dom.confirmacao_b1b2,
        travas: dom.travas,
        perfil_financeiro_base: dom.perfil_financeiro_base,
        notas: dom.notas,
        faltantes: dom.faltantes,
        pendencias: dom.pendencias
      },
      por_pessoa: por_pessoa,
      // chaves de topo (compatibilidade) espelham a PRIMEIRA pessoa de pessoas_ordem
      calculado: primeira ? primeira.calculado : null,
      ajustado: primeira ? primeira.ajustado : ajustadoLegado,
      justificativa_consultor: primeira ? primeira.justificativa_consultor : str(ctx.investidor.justificativa_consultor),
      desenquadramento: primeira ? primeira.desenquadramento : { termo_colhido: ctx.investidor.termo_colhido === true },
      vigente: primeira ? primeira.vigente : (ajustadoLegado || null),
      notas: primeira ? primeira.notas : null,
      limitante: primeira ? primeira.limitante : { tipos: [], texto: '' },
      destrava: primeira ? primeira.destrava : '',
      memoria_calculo: primeira ? primeira.memoria_calculo : { linhas: [] }
    };

    let status;
    if (!pessoas.length) status = 'sem_pessoas';
    else if (pessoas.some(function (n) { return por_pessoa[n].calculado; })) status = 'calculado';
    else status = 'incalculavel';

    const evidencias = pessoas.map(function (n) {
      const p = por_pessoa[n];
      return n + ': ' + (p.calculado ? nomePerfilInvestidor(p.calculado) + ' — limitante: ' + p.limitante.texto : 'incalculável');
    });
    const resumo = pessoas.length
      ? evidencias.join(' · ')
      : 'Sem pessoas: informe o nome do titular ou os donos dos investimentos';

    const faltantes = [];
    pessoas.forEach(function (n) {
      por_pessoa[n].faltantes.forEach(function (f) { faltantes.push('Perfil de investidor — ' + n + ': ' + f); });
    });
    dom.faltantes.concat(dom.pendencias).forEach(function (f) { faltantes.push('Perfil de investidor — domicílio: ' + f); });

    return {
      ativo: status === 'calculado',
      evidencias: pessoas.length ? evidencias : [resumo],
      faltantes: faltantes,
      extras: { perfil_investidor: perfil_investidor, status: status, resumo: resumo }
    };
  }

  // Resultado mínimo quando o cálculo do investidor falha (não derruba o perfil financeiro)
  function investidorComErro(ctx, erro) {
    const msg = String(erro && erro.message ? erro.message : erro);
    const ajustadoLegado = str(ctx.investidor.ajustado).trim();
    const perfil_investidor = {
      versao: 3,
      pessoas_ordem: [],
      domicilio: null,
      por_pessoa: {},
      calculado: null,
      ajustado: ajustadoLegado,
      justificativa_consultor: str(ctx.investidor.justificativa_consultor),
      desenquadramento: { termo_colhido: ctx.investidor.termo_colhido === true },
      vigente: ajustadoLegado || null,
      notas: null,
      limitante: { tipos: [], texto: '' },
      destrava: '',
      memoria_calculo: { linhas: [] },
      erro: msg
    };
    return {
      ativo: false,
      evidencias: ['erro no cálculo do perfil de investidor'],
      faltantes: [],
      extras: { perfil_investidor: perfil_investidor, status: 'incalculavel', resumo: 'Erro no cálculo do perfil de investidor: ' + msg, erro: msg }
    };
  }

  // ------------------------------------------------------------
  // Orquestrador — PURO (sem DOM, sem getters)
  // ------------------------------------------------------------
  function calcular(dados) {
    const ctx = montarContexto(dados);

    const resultados = {};
    DETECTORES.forEach(function (det) {
      try {
        resultados[det.id] = det.detectar(ctx) || detectorVazio();
      } catch (e) {
        resultados[det.id] = { ativo: false, evidencias: [], faltantes: [], extras: { erro: String(e && e.message ? e.message : e) } };
      }
    });

    const camada_divida = montarCamadaDivida(ctx, resultados);
    const perfilFluxo = escolherFluxo(resultados);
    const matriz = calcularMatriz(ctx);

    const camada_fluxo = {
      perfil: perfilFluxo,
      numeros: {
        renda: r2(ctx.renda),
        sobra_estrutural: r2(ctx.sobra_estrutural),
        sobra_real: r2(ctx.sobra_real),
        sobra_real_fraca: r2(ctx.sobra_real_fraca),
        aportes_mensais: r2(ctx.aportes_mensais),
        compromisso_de_guardar: ctx.compromisso_de_guardar,
        investe_recorrente: ctx.investe_recorrente,
        apenas_guarda: ctx.apenas_guarda,
        opcionalidade: ctx.opcionalidade,
        reserva_atual: r2(ctx.reserva_atual)
      },
      // v3: itens marcados como reserva que não contam (inelegíveis) e os que contam com pendência (legado)
      reserva_desconsiderada: ctx.reserva_desconsiderada,
      reserva_legado: ctx.reserva_legado,
      amarras_p8: ctx.amarras_p8,
      marcadores: {
        micro_reserva: ctx.reserva_atual < CFG.micro_reserva_meses * (ctx.despesas_totais + ctx.parcelas_atual),
        investidor_sem_reserva_completa: perfilFluxo === 'investidor_amador' && matriz.alvo_reserva > 0 && ctx.reserva_atual < matriz.alvo_reserva
      }
    };

    // 8.8 Precedência e rótulo
    const faltantes = ctx.faltantes_divida.slice(); // já inclui os da camada de fluxo
    let calculado = null;
    let subjacente = null;
    let justificativa_auto = [];

    if (faltantes.length) {
      calculado = null;
      if (ctx.renda_media > 0) justificativa_auto.push(linhaRenda(ctx));
      // Números parciais que já dá para mostrar (8.8: nunca só o rótulo):
      // a linha das dívidas só quando as dívidas em si estão completas (faltantes restantes são do fluxo)
      const soFaltaFluxo = ctx.faltantes_divida.length === ctx.faltantes_fluxo.length;
      if (ctx.problemas.length && soFaltaFluxo && ctx.renda_base > 0) justificativa_auto.push(linhaDividas(ctx));
      if (ctx.renda_media > 0) justificativa_auto.push(linhaSobraReal(ctx));
      justificativa_auto.push('Cálculo pendente: ' + faltantes.length + (faltantes.length === 1 ? ' informação faltante' : ' informações faltantes'));
    } else if (camada_divida.status === 'perfil_1' || camada_divida.status === 'perfil_2') {
      calculado = camada_divida.status === 'perfil_1' ? 'dividas_impagaveis' : 'dividas_pagaveis';
      subjacente = perfilFluxo;
      justificativa_auto.push(linhaRenda(ctx));
      (resultados[calculado] || detectorVazio()).evidencias.forEach(function (x) { justificativa_auto.push(x); });
    } else {
      calculado = perfilFluxo;
      // Camada de fluxo decide pela renda média (8.7) — a linha de renda mostra esse número
      justificativa_auto.push(linhaRendaFluxo(ctx));
      if (camada_divida.status === 'sem_dividas_relevantes') justificativa_auto.push('Dívidas: nenhuma relevante');
      // Três números-base da camada de fluxo (spec): sempre exibidos, antes das evidências do perfil escolhido
      justificativa_auto.push(linhaSobraEstrutural(ctx));
      justificativa_auto.push(linhaSobraReal(ctx));
      justificativa_auto.push(linhaAportes(ctx, sufixoCompromisso(ctx)));
      if (calculado) {
        (resultados[calculado] || detectorVazio()).evidencias.forEach(function (x) { justificativa_auto.push(x); });
      }
      // os detectores repetem algumas linhas-base — fica a primeira ocorrência
      justificativa_auto = unicos(justificativa_auto);
    }

    const ajustado = str(ctx.override.perfil_selecionado);
    const rotulo = calculado ? rotuloPerfil(calculado) : ROTULO_INCALCULAVEL;
    const perfilFinVigente = ajustado || calculado || null;

    // v3: selo da reserva (só rótulo) e perfil de investidor — depois da matriz e da camada de dívida
    let reserva_selo;
    try {
      reserva_selo = montarSeloReserva(ctx, matriz);
    } catch (e) {
      reserva_selo = {
        calculado: null, rotulo: null, ajustado: '', justificativa_consultor: '', vigente: null, analise: null,
        faltantes: ['Selo da reserva: erro no cálculo (' + String(e && e.message ? e.message : e) + ')']
      };
    }
    let camadaInvestidor;
    try {
      camadaInvestidor = montarCamadaInvestidor(ctx, camada_divida, camada_fluxo, matriz, perfilFinVigente, calculado);
    } catch (e) {
      camadaInvestidor = investidorComErro(ctx, e);
    }
    resultados.investidor = camadaInvestidor;
    const perfil_investidor = camadaInvestidor.extras.perfil_investidor;

    return {
      perfil_financeiro: {
        calculado: calculado,
        rotulo: rotulo,
        justificativa_auto: justificativa_auto,
        faltantes: faltantes,
        ajustado: ajustado,
        justificativa_consultor: str(ctx.override.observacoes),
        vigente: perfilFinVigente,
        // v3: pendências de classe/liquidez/revisão dos investimentos (não tornam o perfil incalculável)
        faltantes_investimentos: ctx.faltantes_investimentos,
        reserva_selo: reserva_selo,
        dados_complementares: {
          custeio_moradia: str(ctx.complementares.custeio_moradia),
          decide_pelo_objetivo: str(ctx.complementares.decide_pelo_objetivo)
        },
        analise: {
          camada_divida: camada_divida,
          camada_fluxo: camada_fluxo,
          subjacente: subjacente,
          camada_investidor: { status: camadaInvestidor.extras.status, resumo: camadaInvestidor.extras.resumo }
        }
      },
      perfil_investidor: perfil_investidor,
      codigo_matriz: {
        codigo: matriz.codigo,
        por_posicao: matriz.por_posicao,
        faltantes: matriz.faltantes,
        alvo_reserva: matriz.alvo_reserva
      },
      versao_regras: VERSAO_REGRAS,
      calculado_em: new Date().toISOString()
    };
  }

  // ------------------------------------------------------------
  // coletarDados() — monta o objeto da seção 5 a partir da tela
  // ------------------------------------------------------------
  function valorDom(id) {
    const el = document.getElementById(id);
    return el ? str(el.value).trim() : '';
  }

  function chamar(nomeGetter, padrao) {
    try {
      if (typeof window[nomeGetter] === 'function') {
        const r = window[nomeGetter]();
        return (r === undefined || r === null) ? padrao : r;
      }
    } catch (e) {
      // getter indisponível ou com erro: segue com o padrão
    }
    return padrao;
  }

  function marcadoDom(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function copiaProfunda(obj) {
    if (obj === null || obj === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return null;
    }
  }

  // Blocos .pfa-inv-pessoa do card -> { nome: { ajustado, justificativa_consultor, termo_colhido } } (valores crus)
  function lerBlocosInvestidor() {
    const saida = {};
    const card = document.getElementById(ID_CARD);
    if (!card) return saida;
    const blocos = card.querySelectorAll('.pfa-inv-pessoa');
    for (let i = 0; i < blocos.length; i++) {
      const bloco = blocos[i];
      const nome = bloco.getAttribute('data-pessoa') || '';
      const sel = bloco.querySelector('.pfa-inv-select');
      const just = bloco.querySelector('.pfa-inv-just');
      const termo = bloco.querySelector('.pfa-inv-termo-check');
      saida[nome] = {
        ajustado: sel ? str(sel.value) : '',
        justificativa_consultor: just ? str(just.value) : '',
        termo_colhido: !!(termo && termo.checked)
      };
    }
    return saida;
  }

  // investidor_ui: ajustes por pessoa lidos do card; pessoas cujo bloco ainda não existe usam o salvo pendente
  function coletarInvestidorUi() {
    const blocos = lerBlocosInvestidor();
    const ui = {};
    Object.keys(blocos).forEach(function (nome) {
      if (!nome) return; // bloco genérico (sem pessoas): vale a chave "investidor"
      ui[nome] = {
        ajustado: str(blocos[nome].ajustado).trim(),
        justificativa_consultor: str(blocos[nome].justificativa_consultor).trim(),
        termo_colhido: blocos[nome].termo_colhido === true
      };
    });
    Object.keys(pendentesInvestidor).forEach(function (nome) {
      if (tem(ui, nome)) return;
      const p = pendentesInvestidor[nome] || {};
      ui[nome] = {
        ajustado: str(p.ajustado).trim(),
        justificativa_consultor: str(p.justificativa_consultor).trim(),
        termo_colhido: p.termo_colhido === true
      };
    });
    return ui;
  }

  function coletarDados() {
    const objetivosData = chamar('getObjetivosData', {}) || {};
    const variaveis = objetivosData.variaveis_mercado || {};
    const perfilManual = objetivosData.perfil_financeiro || {};
    const fluxo = chamar('getFluxoCaixaData', {}) || {};

    const estadoCivil = valorDom('estado_civil');
    const conjugeNome = valorDom('conjuge_nome');
    const conjuge = (ehCasado(estadoCivil) && conjugeNome) ? {
      nome: conjugeNome,
      data_nascimento: valorDom('conjuge_data_nascimento'),
      renda_mes_fraco: parseMoedaBR(valorDom('conjuge_renda_mes_fraco'))
    } : null;

    const pessoas_renda = arr(window.pessoasRenda).map(function (p, i) {
      const id = 'pessoa_' + i;
      const inputFraco = document.getElementById(id + '_renda_mes_fraco');
      return {
        id: id,
        nome: str(p.nome),
        data_nascimento: str(p.data_nascimento),
        estado_civil: str(p.estado_civil),
        conjuge_nome: str(p.conjuge_nome),
        renda_mes_fraco: inputFraco ? parseMoedaBR(inputFraco.value) : num(p.renda_mes_fraco)
      };
    });

    const dependentes = arr(window.dependentes).map(function (dep) {
      return { nome: str(dep.nome), data_nascimento: str(dep.data_nascimento), parentesco: str(dep.parentesco), responsavel: str(dep.responsavel) };
    });

    let fisicosBrutos = chamar('getPatrimoniosFisicos', null);
    if (!Array.isArray(fisicosBrutos)) fisicosBrutos = arr(window.patrimonios);
    const patrimonios_fisicos = fisicosBrutos.map(function (p) {
      return {
        tipo: str(p.tipo),
        detalhes: str(p.detalhes),
        valor: num(p.valor),
        quitado: !(p.quitado === false || p.quitado === 'false'),
        saldo_devedor: num(p.saldo_devedor),
        imovel_unico_moradia: p.imovel_unico_moradia === true || p.imovel_unico_moradia === 'true',
        gera_renda: p.gera_renda === true || p.gera_renda === 'true'
      };
    });

    const patrimonios_liquidos = arr(chamar('getPatrimoniosLiquidosData', [])).map(function (pl) {
      return {
        id: pl.id,
        valor_atual: num(pl.valor_atual),
        tipo_produto_nome: str(pl.tipo_produto_nome),
        classificacao_risco: str(pl.classificacao_risco),
        finalidade: str(pl.finalidade),
        aporte_valor: num(pl.aporte_valor),
        aporte_frequencia: str(pl.aporte_frequencia) || 'NENHUM',
        donos: arr(pl.donos).slice(),
        reserva_emergencia: typeof pl.reserva_emergencia === 'boolean' ? pl.reserva_emergencia : str(pl.finalidade) === 'RESERVA_EMERGENCIA',
        // v3: classe de 9 degraus, liquidez e elegibilidade (copiadas no item; ver RiscosV3.classeDoItem)
        tipo_produto: pl.tipo_produto === undefined || pl.tipo_produto === '' ? null : pl.tipo_produto,
        classe_risco: pl.classe_risco === undefined || pl.classe_risco === null || pl.classe_risco === '' ? null : str(pl.classe_risco),
        classe_risco_origem: str(pl.classe_risco_origem),
        classe_risco_justificativa: str(pl.classe_risco_justificativa),
        liquidez: pl.liquidez === undefined || pl.liquidez === null || pl.liquidez === '' ? null : str(pl.liquidez),
        elegivel: pl.elegivel !== false,
        revisao_item: pl.revisao_item === true,
        nome_produto_customizado: str(pl.nome_produto_customizado),
        instituicao_nome: str(pl.instituicao_nome)
      };
    });

    // v3: teste de perfil de investidor (cópia profunda — calcular continua puro)
    const suitability_v3 = copiaProfunda(chamar('getSuitabilityV3Data', null));

    const dividas = arr(chamar('getDividasData', [])).map(function (x) {
      return {
        id: x.id,
        motivo: str(x.motivo),
        credor: str(x.credor),
        saldo_devedor: num(x.saldo_devedor),
        valor_parcela: num(x.valor_parcela),
        prazo: parseInt(x.prazo, 10) || 0,
        parcelas_pagas: parseInt(x.parcelas_pagas, 10) || 0,
        taxa_juros: num(x.taxa_juros),
        taxa_juros_tipo: str(x.taxa_juros_tipo) || 'anual',
        situacao_divida: str(x.situacao_divida),
        divida_estruturada: x.divida_estruturada === true || x.divida_estruturada === 'true',
        proposta_em_vigor: x.proposta_em_vigor === undefined || x.proposta_em_vigor === null ? 'nao' : str(x.proposta_em_vigor),
        parcela_proposta: num(x.parcela_proposta),
        responsaveis: arr(x.responsaveis).slice()
      };
    });

    const receitas = arr(fluxo.receitas).map(function (r) {
      return {
        id: r.id, nome: str(r.nome), valor: num(r.valor), tipo: str(r.tipo),
        qtd_recorrencia: parseInt(r.qtd_recorrencia, 10) || 1, und_recorrencia: str(r.und_recorrencia) || 'mes',
        titular: str(r.titular) || 'titular', automatica: !!r.automatica
      };
    });

    const despesas = arr(fluxo.despesas).map(function (x) {
      return {
        id: x.id, nome: str(x.nome), valor: num(x.valor), tipo: str(x.tipo),
        qtd_recorrencia: parseInt(x.qtd_recorrencia, 10) || 1, und_recorrencia: str(x.und_recorrencia) || 'mes',
        titular: str(x.titular) || 'titular',
        categoria_comportamental: str(x.categoria_comportamental),
        nivel_importancia: str(x.nivel_importancia),
        nivel_conforto: str(x.nivel_conforto),
        alteravel: str(x.alteravel),
        disposto: str(x.disposto),
        automatica: !!x.automatica,
        origem: x.origem === undefined ? null : x.origem
      };
    });

    const produtos_protecao = arr(chamar('getProdutosProtecaoData', [])).map(function (p) {
      return { tipo_produto: str(p.tipo_produto), custo: num(p.custo), periodicidade: str(p.periodicidade) };
    });

    const objetivos = arr(objetivosData.objetivos).map(function (o) {
      return {
        id: o.id, tipo: str(o.tipo), descricao: str(o.descricao),
        prazo_tipo: str(o.prazo_tipo), prazo_idade: num(o.prazo_idade), prazo_meses: num(o.prazo_meses),
        prazo_data: o.prazo_data || null, prazo_pessoa: str(o.prazo_pessoa),
        renda_anual: num(o.renda_anual), meta_acumulo: num(o.meta_acumulo), valor_final: num(o.valor_final),
        responsaveis: arr(o.responsaveis).slice()
      };
    });

    const declaracoes_ir = arr(chamar('getDeclaracoesIRData', [])).map(function (dcl) {
      return {
        pessoa_key: str(dcl.pessoa_key), tipo_declaracao: str(dcl.tipo_declaracao),
        renda_bruta_anual: num(dcl.renda_bruta_anual), resultado_tipo: str(dcl.resultado_tipo), resultado_valor: num(dcl.resultado_valor)
      };
    });

    return {
      referencia: str(variaveis.data_reuniao) || hojeISO(),
      titular: {
        nome: valorDom('nome_diagnostico'),
        data_nascimento: valorDom('data_nascimento'),
        estado_civil: estadoCivil,
        renda_mes_fraco: parseMoedaBR(valorDom('renda_mes_fraco'))
      },
      conjuge: conjuge,
      pessoas_renda: pessoas_renda,
      dependentes: dependentes,
      patrimonios_fisicos: patrimonios_fisicos,
      patrimonios_liquidos: patrimonios_liquidos,
      dividas: dividas,
      receitas: receitas,
      despesas: despesas,
      produtos_protecao: produtos_protecao,
      objetivos: objetivos,
      declaracoes_ir: declaracoes_ir,
      complementares: {
        custeio_moradia: valorDom('pfa-custeio-moradia'),
        decide_pelo_objetivo: valorDom('pfa-decide-objetivo')
      },
      override: {
        perfil_selecionado: str(perfilManual.perfil_selecionado),
        observacoes: valorDom('obs_perfil_financeiro')
      },
      // chave extra (aditiva): ajuste manual do perfil de investidor, lido do card (primeira pessoa)
      investidor: {
        ajustado: valorDom('pfa-investidor-select'),
        justificativa_consultor: valorDom('pfa-investidor-just'),
        termo_colhido: marcadoDom('pfa-investidor-termo')
      },
      // v3: teste novo, ajustes por pessoa e ajuste do selo da reserva
      suitability_v3: suitability_v3,
      investidor_ui: coletarInvestidorUi(),
      selo_ui: {
        ajustado: valorDom('pfa-reserva-selo-select'),
        justificativa_consultor: valorDom('pfa-reserva-selo-just')
      }
    };
  }

  // ------------------------------------------------------------
  // Card (aditivo): irmão ANTES de #perfil-financeiro-container
  // ------------------------------------------------------------
  const ID_CARD = 'perfil-financeiro-auto';
  let salvo = null;            // resultado vindo do banco (setPerfilFinanceiroSalvo)
  let ultimoResultado = null;  // último resultado calculado nesta sessão
  let gatilhosLigados = false;
  let temporizador = null;
  let pendentesInvestidor = {};   // ajustes salvos por nome, aguardando o bloco da pessoa existir
  let pessoasRenderizadas = [];   // lista de pessoas dos blocos atuais ([] = bloco genérico)
  let assinaturaEvento = null;    // última assinatura publicada em 'perfil-financeiro:calculado'

  const ID_ESTILOS_V3 = 'pfa-v3-estilos';

  function injetarEstilosV3() {
    if (document.getElementById(ID_ESTILOS_V3)) return;
    const st = document.createElement('style');
    st.id = ID_ESTILOS_V3;
    st.textContent =
      '.pfa-reserva-selo{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.6rem .9rem;margin-top:.8rem;padding:.7rem .8rem;background:rgba(255,255,255,.03);border-radius:8px;}' +
      '.pfa-reserva-selo-rotulo{grid-column:1/-1;font-weight:600;color:var(--accent-color,#ffd700);}' +
      '.pfa-investidor-pessoas{grid-column:1/-1;display:flex;flex-direction:column;gap:.6rem;min-width:0;}' +
      '.pfa-inv-pessoa{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem .9rem;padding:.6rem .7rem;border:1px solid var(--border-color,#2e8b57);border-radius:8px;background:rgba(0,0,0,.15);min-width:0;}' +
      '.pfa-inv-calculado{grid-column:1/-1;font-weight:600;color:var(--text-light,#f0f8f0);overflow-wrap:anywhere;}' +
      '.pfa-inv-termo{grid-column:1/-1;display:flex;align-items:center;gap:.5rem;min-height:44px;cursor:pointer;font-size:.8rem;}' +
      '.pfa-inv-termo input{width:20px;height:20px;margin:0;padding:0;flex:0 0 auto;accent-color:var(--accent-color,#ffd700);}' +
      // Compacto (modal do hub): tipografia/espaçamento/grades a partir de 600px,
      // tamanho do checkbox e do termo só a partir de 900px. Tokens --cp-* de compacto.css.
      // Fica ANTES do @media (max-width:600px) para que, em 600px exatos, o telefone vença.
      '@media (min-width:600px){' +
        '.pfa-reserva-selo{grid-template-columns:minmax(220px,300px) minmax(0,1fr);gap:var(--cp-gap-y,6px) var(--cp-gap-x,8px);margin-top:var(--cp-gap-y,6px);padding:var(--cp-card-pad,8px 10px);}' +
        '.pfa-reserva-selo .pfa-campo-largo{grid-column:auto;}' +
        '.pfa-reserva-selo-rotulo{font-size:var(--cp-h4-fs,12.5px);}' +
        '.pfa-investidor-pessoas{gap:var(--cp-gap-y,6px);}' +
        '.pfa-inv-pessoa{grid-template-columns:minmax(220px,300px) minmax(0,1fr);gap:var(--cp-gap-y,6px) var(--cp-gap-x,8px);padding:6px 10px;}' +
        '.pfa-inv-pessoa .pfa-campo-largo{grid-column:auto;}' +
        '.pfa-inv-calculado{font-size:var(--cp-h4-fs,12.5px);}' +
        '.pfa-inv-termo{gap:var(--cp-gap-x,8px);font-size:12px;}' +
        // É um <label>: dentro do modal compacto.css (body.hub-ativo #hub-modal-corpo label, 1,1,2)
        // impõe 11.5px/600/margin-bottom 2px; o id aqui (1,2,2) faz os 12px valerem no card.
        'body.hub-ativo #hub-modal-corpo label.pfa-inv-termo{font-size:12px;font-weight:400;margin:0;}' +
      '}' +
      '@media (min-width:900px){' +
        '.pfa-inv-termo{min-height:28px;}' +
        '.pfa-inv-termo input{width:16px;height:16px;}' +
      '}' +
      '@media (max-width:600px){.pfa-reserva-selo,.pfa-inv-pessoa{grid-template-columns:1fr;}.pfa-reserva-selo select,.pfa-reserva-selo textarea,.pfa-inv-pessoa select,.pfa-inv-pessoa textarea{font-size:16px;}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function idsBlocoPessoa(k) {
    const suf = k === 0 ? '' : '-' + k;
    return {
      select: 'pfa-investidor-select' + suf,
      just: 'pfa-investidor-just' + suf,
      termo: 'pfa-investidor-termo' + suf
    };
  }

  // Um bloco por pessoa; a PRIMEIRA usa os ids existentes (#pfa-investidor-select/-just) e #pfa-investidor-termo
  function htmlBlocoPessoa(nome, k) {
    const ids = idsBlocoPessoa(k);
    return '<div class="pfa-inv-pessoa" data-pessoa="' + escapar(nome) + '">' +
        '<div class="pfa-inv-calculado">' +
          (nome ? escapar(nome) + ': calculando...' : 'Perfil de investidor: informe o titular ou os donos dos investimentos') +
        '</div>' +
        '<div class="pfa-campo">' +
          '<label for="' + ids.select + '">Ajuste do consultor' + (nome ? ' — ' + escapar(nome) : ' (perfil de investidor)') + '</label>' +
          '<select id="' + ids.select + '" name="' + ids.select + '" class="pfa-inv-select">' +
            opcoesHtml([{ id: '', nome: '-- Selecione --' }].concat(PERFIS_INVESTIDOR), '') +
          '</select>' +
        '</div>' +
        '<div class="pfa-campo pfa-campo-largo">' +
          '<label for="' + ids.just + '">Justificativa do consultor</label>' +
          '<textarea id="' + ids.just + '" name="' + ids.just + '" class="pfa-inv-just" rows="2" placeholder="Por que este perfil de investidor?"></textarea>' +
        '</div>' +
        '<label class="pfa-inv-termo pfa-oculto" for="' + ids.termo + '">' +
          '<input type="checkbox" id="' + ids.termo + '" name="' + ids.termo + '" class="pfa-inv-termo-check">' +
          '<span>Termo de desenquadramento colhido e arquivado</span>' +
        '</label>' +
      '</div>';
  }

  function blocoDaPessoa(nome) {
    const card = document.getElementById(ID_CARD);
    if (!card) return null;
    const blocos = card.querySelectorAll('.pfa-inv-pessoa');
    for (let i = 0; i < blocos.length; i++) {
      if ((blocos[i].getAttribute('data-pessoa') || '') === nome) return blocos[i];
    }
    return null;
  }

  function aplicarValoresBloco(bloco, v) {
    if (!bloco || !v) return;
    const sel = bloco.querySelector('.pfa-inv-select');
    const just = bloco.querySelector('.pfa-inv-just');
    const termo = bloco.querySelector('.pfa-inv-termo-check');
    if (sel && v.ajustado !== undefined) sel.value = str(v.ajustado);
    if (just && v.justificativa_consultor !== undefined) just.value = str(v.justificativa_consultor);
    if (termo && v.termo_colhido !== undefined) termo.checked = v.termo_colhido === true;
  }

  // Recria os blocos só quando a lista de pessoas muda, preservando valores por nome.
  // Devolve true se aplicou algum ajuste salvo pendente (o chamador agenda um recálculo).
  function sincronizarBlocosInvestidor(pessoas) {
    const cont = document.getElementById('pfa-investidor-pessoas');
    if (!cont) return false;
    const lista = arr(pessoas).map(function (n) { return str(n); });
    const temBloco = !!cont.querySelector('.pfa-inv-pessoa');
    if (temBloco && JSON.stringify(lista) === JSON.stringify(pessoasRenderizadas)) return false;

    const atuais = lerBlocosInvestidor();
    const primeiraAnterior = pessoasRenderizadas.length ? pessoasRenderizadas[0] : '';
    const nomesBlocos = lista.length ? lista : [''];
    // primeira pessoa renomeada (ou saída do bloco genérico): a nova primeira herda os valores da anterior
    const herdaPrimeira = !tem(atuais, nomesBlocos[0]) && tem(atuais, primeiraAnterior) &&
      nomesBlocos.indexOf(primeiraAnterior) === -1;
    // quem sai da lista (titular apagado, dono retirado dos investimentos) guarda o ajuste por nome
    // em pendentesInvestidor; o laço abaixo reaplica quando o nome voltar. A primeira anterior que
    // foi herdada pela nova primeira não é guardada (os valores seguiram com a renomeação).
    Object.keys(atuais).forEach(function (n) {
      if (!n || nomesBlocos.indexOf(n) !== -1) return;
      if (herdaPrimeira && n === primeiraAnterior) return;
      const a = atuais[n] || {};
      if (str(a.ajustado) || str(a.justificativa_consultor).trim() || a.termo_colhido === true) {
        pendentesInvestidor[n] = a;
      }
    });
    cont.innerHTML = nomesBlocos.map(function (nome, k) { return htmlBlocoPessoa(nome, k); }).join('');

    let aplicouPendente = false;
    nomesBlocos.forEach(function (nome, k) {
      const bloco = blocoDaPessoa(nome);
      let v = tem(atuais, nome) ? atuais[nome] : null;
      if (!v && k === 0 && herdaPrimeira) {
        v = atuais[primeiraAnterior];
      }
      if (v) aplicarValoresBloco(bloco, v);
      if (nome && tem(pendentesInvestidor, nome)) {
        aplicarValoresBloco(bloco, pendentesInvestidor[nome]);
        delete pendentesInvestidor[nome];
        aplicouPendente = true;
      }
    });
    pessoasRenderizadas = lista.slice();
    return aplicouPendente;
  }

  function opcoesHtml(lista, selecionado) {
    return lista.map(function (o) {
      return '<option value="' + escapar(o.id) + '"' + (str(selecionado) === str(o.id) ? ' selected' : '') + '>' + escapar(o.nome) + '</option>';
    }).join('');
  }

  function montarCard() {
    if (document.getElementById(ID_CARD)) return document.getElementById(ID_CARD);
    const container = document.getElementById('perfil-financeiro-container');
    if (!container || !container.parentNode) return null;

    injetarEstilosV3();
    pessoasRenderizadas = []; // card novo nasce com o bloco genérico
    const card = document.createElement('div');
    card.id = ID_CARD;
    card.className = 'pfa';
    card.innerHTML =
      '<div class="pfa-cabecalho" id="pfa-cabecalho">' +
        '<h4 class="pfa-titulo"><i class="fas fa-magic"></i> Perfil Financeiro — cálculo automático</h4>' +
        '<span class="pfa-versao" id="pfa-versao">regras v' + escapar(VERSAO_REGRAS) + '</span>' +
      '</div>' +
      '<div class="pfa-rotulo" id="pfa-rotulo">Calculando...</div>' +
      '<div class="pfa-vigente" id="pfa-vigente"></div>' +
      '<ul class="pfa-justificativas" id="pfa-justificativas"></ul>' +
      '<div class="pfa-faltantes pfa-oculto" id="pfa-faltantes">' +
        '<div class="pfa-faltantes-titulo" id="pfa-faltantes-titulo"></div>' +
        '<ul class="pfa-faltantes-lista" id="pfa-faltantes-lista"></ul>' +
      '</div>' +
      '<div class="pfa-complementares" id="pfa-complementares">' +
        '<div class="pfa-campo">' +
          '<label for="pfa-custeio-moradia">Custeio da moradia pelo cliente</label>' +
          '<select id="pfa-custeio-moradia" name="pfa-custeio-moradia">' +
            opcoesHtml([{ id: '', nome: 'Selecione...' }, { id: 'nao_contribui', nome: 'Não contribui' }, { id: 'parcial', nome: 'Parcial' }, { id: 'integral', nome: 'Integral' }], '') +
          '</select>' +
        '</div>' +
        '<div class="pfa-campo">' +
          '<label for="pfa-decide-objetivo">O cliente decide onde investir pelo objetivo?</label>' +
          '<select id="pfa-decide-objetivo" name="pfa-decide-objetivo">' +
            opcoesHtml([{ id: '', nome: 'Não informado' }, { id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }], '') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="pfa-investidor" id="pfa-investidor">' +
        '<div class="pfa-investidor-linha" id="pfa-investidor-linha">Perfil de investidor: a definir</div>' +
        '<div class="pfa-investidor-pessoas" id="pfa-investidor-pessoas">' +
          htmlBlocoPessoa('', 0) +
        '</div>' +
      '</div>' +
      '<div class="pfa-reserva-selo" id="pfa-reserva-selo">' +
        '<div class="pfa-reserva-selo-rotulo" id="pfa-reserva-selo-rotulo">Reserva de emergência: —</div>' +
        '<div class="pfa-campo">' +
          '<label for="pfa-reserva-selo-select">Ajuste do consultor (selo da reserva)</label>' +
          '<select id="pfa-reserva-selo-select" name="pfa-reserva-selo-select">' +
            opcoesHtml([
              { id: '', nome: '— manter o calculado —' },
              { id: 'adequada', nome: ROTULOS_SELO.adequada },
              { id: 'em_formacao', nome: ROTULOS_SELO.em_formacao },
              { id: 'inadequada', nome: ROTULOS_SELO.inadequada }
            ], '') +
          '</select>' +
        '</div>' +
        '<div class="pfa-campo pfa-campo-largo">' +
          '<label for="pfa-reserva-selo-just">Justificativa do ajuste</label>' +
          '<textarea id="pfa-reserva-selo-just" name="pfa-reserva-selo-just" rows="2" placeholder="Justificativa do ajuste"></textarea>' +
        '</div>' +
      '</div>' +
      '<div class="pfa-matriz" id="pfa-matriz">' +
        '<div class="pfa-matriz-titulo">Código da matriz</div>' +
        '<div class="pfa-matriz-codigo" id="pfa-matriz-codigo">—</div>' +
        '<ul class="pfa-matriz-lista" id="pfa-matriz-lista"></ul>' +
      '</div>' +
      '<div class="pfa-override-nota" id="pfa-override-nota">' +
        '<i class="fas fa-info-circle"></i> Ajuste do consultor: use o seletor abaixo. Se alterar o perfil calculado, justifique nas Observações.' +
      '</div>';

    container.parentNode.insertBefore(card, container);
    return card;
  }

  function setValor(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = str(valor);
  }

  function aplicarSalvo() {
    if (!salvo || !document.getElementById(ID_CARD)) return;
    const pf = salvo.perfil_financeiro || {};
    const dc = pf.dados_complementares || {};
    if (dc.custeio_moradia !== undefined) setValor('pfa-custeio-moradia', dc.custeio_moradia);
    if (dc.decide_pelo_objetivo !== undefined) setValor('pfa-decide-objetivo', dc.decide_pelo_objetivo);
    // v3: selo da reserva
    const rs = pf.reserva_selo && typeof pf.reserva_selo === 'object' ? pf.reserva_selo : null;
    if (rs) {
      if (rs.ajustado !== undefined) setValor('pfa-reserva-selo-select', rs.ajustado || '');
      if (rs.justificativa_consultor !== undefined) setValor('pfa-reserva-selo-just', rs.justificativa_consultor || '');
    }
    // v3: perfil de investidor por pessoa (por nome). Pessoas cujo bloco ainda não existe
    // ficam em pendentesInvestidor e são aplicadas quando o bloco for criado.
    const pi = salvo.perfil_investidor || {};
    pendentesInvestidor = {};
    // por_pessoa vazio (salvo sem pessoas ou com erro no cálculo) cai no formato antigo:
    // o ajuste do consultor está nas chaves de topo
    if (pi.por_pessoa && typeof pi.por_pessoa === 'object' && Object.keys(pi.por_pessoa).length) {
      Object.keys(pi.por_pessoa).forEach(function (nome) {
        const p = pi.por_pessoa[nome] || {};
        const v = {
          ajustado: str(p.ajustado),
          justificativa_consultor: str(p.justificativa_consultor),
          termo_colhido: !!(p.desenquadramento && p.desenquadramento.termo_colhido === true)
        };
        const bloco = blocoDaPessoa(nome);
        if (bloco && nome) aplicarValoresBloco(bloco, v);
        else if (nome) pendentesInvestidor[nome] = v;
      });
    } else {
      // formato antigo (sem por_pessoa): restaura na primeira pessoa (ids originais)
      if (pi.ajustado !== undefined) setValor('pfa-investidor-select', pi.ajustado);
      if (pi.justificativa_consultor !== undefined) setValor('pfa-investidor-just', pi.justificativa_consultor);
      const termo = document.getElementById('pfa-investidor-termo');
      if (termo && pi.desenquadramento && typeof pi.desenquadramento === 'object') {
        termo.checked = pi.desenquadramento.termo_colhido === true;
      }
    }
    salvo = null; // aplicado; daqui em diante valem os inputs do card (e os pendentes por nome)
  }

  function preencherLista(id, itens) {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = itens.map(function (t) { return '<li>' + escapar(t) + '</li>'; }).join('');
  }

  function atualizarCard(resultado) {
    const card = document.getElementById(ID_CARD);
    if (!card || !resultado) return;
    const pf = resultado.perfil_financeiro;
    const perfil = pf.calculado ? perfilPorId(pf.calculado) : null;

    const elRotulo = document.getElementById('pfa-rotulo');
    if (elRotulo) {
      elRotulo.textContent = pf.rotulo;
      elRotulo.style.color = perfil ? perfil.cor : '';
      elRotulo.style.borderColor = perfil ? perfil.cor : '';
      elRotulo.classList.toggle('pfa-incalculavel', !perfil);
    }

    const elVigente = document.getElementById('pfa-vigente');
    if (elVigente) {
      if (pf.ajustado) {
        elVigente.textContent = 'Perfil vigente: ' + rotuloPerfil(pf.ajustado) + ' (ajustado pelo consultor)';
      } else if (pf.calculado) {
        elVigente.textContent = 'Perfil vigente: ' + pf.rotulo + ' (calculado)';
      } else {
        elVigente.textContent = 'Perfil vigente: — (aguardando dados)';
      }
    }

    preencherLista('pfa-justificativas', pf.justificativa_auto || []);

    const elFalt = document.getElementById('pfa-faltantes');
    const elFaltTitulo = document.getElementById('pfa-faltantes-titulo');
    const faltantes = pf.faltantes || [];
    if (elFalt) {
      if (faltantes.length) {
        elFalt.classList.remove('pfa-oculto');
        if (elFaltTitulo) {
          elFaltTitulo.textContent = faltantes.length === 1
            ? 'Falta 1 informação para calcular:'
            : 'Faltam ' + faltantes.length + ' informações para calcular:';
        }
        preencherLista('pfa-faltantes-lista', faltantes);
      } else {
        elFalt.classList.add('pfa-oculto');
        preencherLista('pfa-faltantes-lista', []);
      }
    }

    // v3: perfil de investidor por pessoa
    const pi = resultado.perfil_investidor || {};
    const pessoasInv = arr(pi.pessoas_ordem);
    const porPessoa = (pi.por_pessoa && typeof pi.por_pessoa === 'object') ? pi.por_pessoa : {};
    const domInv = (pi.domicilio && typeof pi.domicilio === 'object') ? pi.domicilio : {};
    if (sincronizarBlocosInvestidor(pessoasInv)) agendarRecalculo();

    const elInv = document.getElementById('pfa-investidor-linha');
    if (elInv) {
      if (pessoasInv.length) {
        elInv.textContent = 'Perfil de investidor: ' + pessoasInv.map(function (nome) {
          const p = porPessoa[nome] || {};
          if (!p.vigente) return nome + ' — incalculável';
          return nome + ' — ' + nomePerfilInvestidor(p.vigente) + (p.ajustado ? ' (ajustado pelo consultor)' : '');
        }).join(' · ');
      } else {
        const nomeInv = nomePerfilInvestidor(pi.ajustado);
        elInv.textContent = nomeInv
          ? 'Perfil de investidor: ' + nomeInv + ' (ajustado pelo consultor)'
          : 'Perfil de investidor: a definir';
      }
    }
    const blocosInv = card.querySelectorAll('.pfa-inv-pessoa');
    for (let b = 0; b < blocosInv.length; b++) {
      const bloco = blocosInv[b];
      const nome = bloco.getAttribute('data-pessoa') || '';
      const p = nome && tem(porPessoa, nome) ? porPessoa[nome] : null;
      const elCalc = bloco.querySelector('.pfa-inv-calculado');
      if (elCalc) {
        if (!nome) {
          elCalc.textContent = 'Perfil de investidor: informe o titular ou os donos dos investimentos';
        } else if (!p) {
          elCalc.textContent = nome + ': calculando...';
        } else if (p.calculado) {
          elCalc.textContent = nome + ': ' + nomePerfilInvestidor(p.calculado) +
            ' — limitante: ' + ((p.limitante && p.limitante.texto) || '—');
        } else {
          const faltas = arr(p.faltantes).concat(arr(domInv.faltantes));
          elCalc.textContent = nome + ': incalculável' + (faltas.length ? ' — faltam ' + faltas.join('; ') : '');
        }
      }
      const elTermo = bloco.querySelector('.pfa-inv-termo');
      if (elTermo) {
        const acima = !!(p && p.calculado && p.ajustado && Number(p.ajustado) > Number(p.calculado));
        elTermo.classList.toggle('pfa-oculto', !acima);
      }
    }

    // v3: selo da reserva (só rótulo; análise fica no JSON)
    const elSelo = document.getElementById('pfa-reserva-selo-rotulo');
    if (elSelo) {
      const rs = pf.reserva_selo || {};
      if (rs.vigente && tem(ROTULOS_SELO, rs.vigente)) {
        elSelo.textContent = 'Reserva de emergência: ' + ROTULOS_SELO[rs.vigente] + (rs.ajustado ? ' (ajustado pelo consultor)' : '');
      } else {
        const motivoSelo = arr(rs.faltantes).length
          ? str(rs.faltantes[0]).replace(/^Selo da reserva:\s*/, '')
          : 'alvo da reserva incalculável';
        elSelo.textContent = 'Reserva de emergência: — (' + motivoSelo + ')';
      }
    }

    const cm = resultado.codigo_matriz || {};
    const elCod = document.getElementById('pfa-matriz-codigo');
    if (elCod) elCod.textContent = cm.codigo || '—';
    const pos = cm.por_posicao || {};
    const ordem = ['dependencia', 'tempo', 'moradia', 'poupanca', 'fonte', 'patrimonio', 'reserva'];
    preencherLista('pfa-matriz-lista', ordem.map(function (k) {
      return pos[k] ? pos[k].justificativa : k + ': —';
    }));
  }

  // ------------------------------------------------------------
  // Ciclo de vida
  // ------------------------------------------------------------
  function recalcular() {
    let resultado = null;
    try {
      resultado = calcular(coletarDados());
      ultimoResultado = resultado;
      atualizarCard(resultado);
      publicarCalculado(resultado);
    } catch (e) {
      if (window.console && console.error) console.error('[PerfilFinanceiro] erro ao recalcular:', e);
    }
    return resultado;
  }

  // Evento 'perfil-financeiro:calculado' só quando o resultado relevante muda
  // (perfil de investidor vigente/calculado por pessoa + selo + código da matriz).
  // Inclui também o que as telas de exibição desenham a partir do motor e que pode mudar
  // sem mudar o perfil final: memória de cálculo e faltantes por pessoa, B4/nota B,
  // faltantes e pendências do domicílio e a renda mensal do resumo B do teste novo.
  // Não cria laço: os ouvintes comparam a própria assinatura antes de redesenhar e
  // os containers deles são ignorados pelo MutationObserver.
  function assinaturaResultado(r) {
    const pi = (r && r.perfil_investidor) || {};
    const pp = {};
    const porPessoa = (pi.por_pessoa && typeof pi.por_pessoa === 'object') ? pi.por_pessoa : {};
    Object.keys(porPessoa).forEach(function (nome) {
      const p = porPessoa[nome] || {};
      pp[nome] = {
        v: p.vigente || null,
        c: p.calculado || null,
        m: arr(p.memoria_calculo && p.memoria_calculo.linhas),
        f: arr(p.faltantes)
      };
    });
    const dom = (pi.domicilio && typeof pi.domicilio === 'object') ? pi.domicilio : null;
    const pf = (r && r.perfil_financeiro) || {};
    const rs = pf.reserva_selo || {};
    const cdiv = (pf.analise && pf.analise.camada_divida) || {};
    return JSON.stringify({
      pessoas: arr(pi.pessoas_ordem),
      por_pessoa: pp,
      domicilio: dom ? {
        nota_B: dom.nota_B === undefined ? null : dom.nota_B,
        B4: dom.B4 === undefined ? null : dom.B4,
        faltantes: arr(dom.faltantes),
        pendencias: arr(dom.pendencias)
      } : null,
      renda: (cdiv.numeros && cdiv.numeros.renda_media !== undefined) ? cdiv.numeros.renda_media : null,
      selo: { c: rs.calculado || null, v: rs.vigente || null },
      codigo: (r && r.codigo_matriz && r.codigo_matriz.codigo) || null
    });
  }

  function publicarCalculado(r) {
    if (!r) return;
    const assinatura = assinaturaResultado(r);
    if (assinatura === assinaturaEvento) return;
    assinaturaEvento = assinatura;
    try {
      document.dispatchEvent(new CustomEvent('perfil-financeiro:calculado', { detail: { versao_regras: VERSAO_REGRAS } }));
    } catch (e) {
      if (window.console && console.warn) console.warn('[PerfilFinanceiro] evento perfil-financeiro:calculado não publicado:', e);
    }
  }

  function agendarRecalculo() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      temporizador = null;
      recalcular();
    }, 400);
  }

  function dentroDoCard(alvo) {
    const card = document.getElementById(ID_CARD);
    return !!(card && alvo && card.contains(alvo));
  }

  // Containers de exibição que re-renderizam no evento 'perfil-financeiro:calculado' (evita laço)
  const IDS_IGNORADOS_OBSERVADOR = ['graficos-patrimonio-liquido', 'teste-suitability-v3-container'];

  function mutacaoIgnorada(alvo) {
    if (!alvo) return true;
    if (dentroDoCard(alvo)) return true;
    for (let i = 0; i < IDS_IGNORADOS_OBSERVADOR.length; i++) {
      const el = document.getElementById(IDS_IGNORADOS_OBSERVADOR[i]);
      if (el && el.contains(alvo)) return true;
    }
    return false;
  }

  function ligarGatilhos() {
    if (gatilhosLigados) return;
    gatilhosLigados = true;

    document.addEventListener('input', agendarRecalculo, true);
    document.addEventListener('change', agendarRecalculo, true);
    document.addEventListener('diagnostico:salvo', agendarRecalculo);

    const conteudo = document.getElementById('main-content');
    if (conteudo && typeof MutationObserver !== 'undefined') {
      const observador = new MutationObserver(function (mutacoes) {
        for (let i = 0; i < mutacoes.length; i++) {
          if (!mutacaoIgnorada(mutacoes[i].target)) { agendarRecalculo(); return; }
        }
      });
      observador.observe(conteudo, { childList: true, subtree: true });
    }
  }

  function iniciar() {
    const card = montarCard();
    if (!card) return;
    aplicarSalvo();
    recalcular();
    ligarGatilhos();
  }

  function esperarConteudo() {
    const conteudo = document.getElementById('main-content');
    if (!conteudo) return;
    if (conteudo.style.display !== 'none') { iniciar(); return; }
    if (typeof MutationObserver === 'undefined') return;
    const observador = new MutationObserver(function () {
      if (conteudo.style.display !== 'none') {
        observador.disconnect();
        iniciar();
      }
    });
    observador.observe(conteudo, { attributes: true, attributeFilter: ['style'] });
  }

  document.addEventListener('diagnostico:carregado', function () {
    iniciar();
    // o objetivos-module pode ainda re-renderizar o container; recalcula depois
    agendarRecalculo();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', esperarConteudo);
  } else {
    esperarConteudo();
  }

  // ------------------------------------------------------------
  // API pública
  // ------------------------------------------------------------
  function getResultado() {
    return ultimoResultado || recalcular();
  }

  function getPerfilFinanceiroResultado() {
    const r = recalcular() || ultimoResultado;
    if (!r) return {};
    return {
      perfil_financeiro: r.perfil_financeiro,
      perfil_investidor: r.perfil_investidor,
      codigo_matriz: r.codigo_matriz,
      versao_regras: r.versao_regras,
      calculado_em: r.calculado_em
    };
  }

  function setPerfilFinanceiroSalvo(obj) {
    salvo = obj || null;
    if (salvo && document.getElementById(ID_CARD)) {
      aplicarSalvo();
      agendarRecalculo();
    }
  }

  // Formato do validador: [{ item, campo }]
  function getPerfilFinanceiroFaltantes() {
    const r = recalcular() || ultimoResultado;
    if (!r) return [];
    const lista = [];
    arr(r.perfil_financeiro.faltantes).forEach(function (f) {
      lista.push({ item: 'Perfil financeiro', campo: f });
    });
    arr(r.codigo_matriz.faltantes).forEach(function (f) {
      lista.push({ item: 'Código da matriz', campo: f });
    });
    // v3: pendências dos investimentos (classe/liquidez/revisão) — não bloqueiam o perfil financeiro
    const jaListados = {};
    arr(r.perfil_financeiro.faltantes_investimentos).forEach(function (f) {
      jaListados[f] = true;
      lista.push({ item: 'Investimentos', campo: f });
    });
    // v3: selo da reserva
    const rs = r.perfil_financeiro.reserva_selo || {};
    arr(rs.faltantes).forEach(function (f) {
      lista.push({ item: 'Perfil financeiro', campo: f });
    });
    // v3: perfil de investidor por pessoa e do domicílio
    const pi = r.perfil_investidor || {};
    const porPessoa = (pi.por_pessoa && typeof pi.por_pessoa === 'object') ? pi.por_pessoa : {};
    arr(pi.pessoas_ordem).forEach(function (nome) {
      const p = porPessoa[nome] || {};
      arr(p.faltantes).forEach(function (f) {
        lista.push({ item: 'Perfil de investidor — ' + nome, campo: f });
      });
    });
    const dom = (pi.domicilio && typeof pi.domicilio === 'object') ? pi.domicilio : {};
    arr(dom.faltantes).concat(arr(dom.pendencias)).forEach(function (f) {
      if (jaListados[f]) return; // ex.: "RiscosV3 não carregado" já listado em Investimentos
      lista.push({ item: 'Perfil de investidor — domicílio', campo: f });
    });
    return lista;
  }

  function validarPerfilFinanceiroAntesDeSalvar() {
    const r = recalcular() || ultimoResultado;
    if (!r) return null;
    const pf = r.perfil_financeiro;
    const ajustado = str(pf.ajustado);
    if (ajustado && ajustado !== pf.calculado && !str(pf.justificativa_consultor).trim()) {
      return 'Você ajustou o perfil financeiro para «' + rotuloPerfil(ajustado) + "». Justifique o ajuste em 'Observações - Perfil Financeiro' antes de salvar.";
    }

    // v3: perfil de investidor por pessoa (só quando há calculado)
    const pi = r.perfil_investidor || {};
    const porPessoa = (pi.por_pessoa && typeof pi.por_pessoa === 'object') ? pi.por_pessoa : {};
    const pessoas = arr(pi.pessoas_ordem);
    for (let i = 0; i < pessoas.length; i++) {
      const nome = pessoas[i];
      const p = porPessoa[nome] || {};
      const calc = str(p.calculado);
      const aj = str(p.ajustado);
      if (!calc || !aj) continue;
      if (Number(aj) > Number(calc) && !(p.desenquadramento && p.desenquadramento.termo_colhido === true)) {
        return 'Perfil de investidor de ' + nome + ': o ajuste para ' + nomePerfilInvestidor(aj) +
          ' é mais arrojado que o calculado (' + nomePerfilInvestidor(calc) +
          '). Marque «termo de desenquadramento colhido e arquivado» antes de salvar.';
      }
      if (aj !== calc && !str(p.justificativa_consultor).trim()) {
        return 'Perfil de investidor de ' + nome + ': justifique o ajuste para ' + nomePerfilInvestidor(aj) + ' antes de salvar.';
      }
    }

    // v3: selo da reserva (só quando há calculado)
    const rs = pf.reserva_selo || {};
    if (rs.calculado && rs.ajustado && rs.ajustado !== rs.calculado && !str(rs.justificativa_consultor).trim()) {
      return 'Selo da reserva de emergência: justifique o ajuste para ' + (ROTULOS_SELO[rs.ajustado] || rs.ajustado) + ' antes de salvar.';
    }
    return null;
  }

  window.PerfilFinanceiro = {
    VERSAO_REGRAS: VERSAO_REGRAS,
    CONFIG: PERFIL_CONFIG,
    DETECTORES: DETECTORES,
    PERFIS: PERFIS,
    coletarDados: coletarDados,
    calcular: calcular,
    recalcular: recalcular,
    getResultado: getResultado,
    getFaltantes: getPerfilFinanceiroFaltantes
  };
  window.getPerfilFinanceiroResultado = getPerfilFinanceiroResultado;
  window.setPerfilFinanceiroSalvo = setPerfilFinanceiroSalvo;
  window.getPerfilFinanceiroFaltantes = getPerfilFinanceiroFaltantes;
  window.validarPerfilFinanceiroAntesDeSalvar = validarPerfilFinanceiroAntesDeSalvar;
})();
