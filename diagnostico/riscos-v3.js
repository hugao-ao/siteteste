/*
 * riscos-v3.js — Investimentos v3 (formato novo do diagnóstico)
 * ---------------------------------------------------------------------------
 * Fonte ÚNICA das classes de risco (9 degraus), da liquidez, dos 7 perfis de
 * investidor, da matriz de alocação por classe e das regras de degrau
 * (guarda, reserva de emergência, régua de notas).
 *
 * Expõe window.RiscosV3. Script clássico (IIFE), sem dependências.
 * Todas as funções são puras: não leem tela, não gravam nada e aceitam
 * null / undefined / números sem quebrar.
 *
 * IMPORTANTE: normalizarRisco() só traduz na LEITURA. Nenhum código deve
 * regravar em classificacao_risco o valor traduzido de um legado.
 */
(function () {
  'use strict';

  var VERSAO = '3.0.0';

  /* =========================================================================
   * CLASSES DE RISCO — 9 degraus (verde → vermelho)
   *
   * Princípios da classificação:
   * 1. O risco é visto do ponto de vista de quem PORTA o ativo. Tesouro Selic
   *    fica no degrau 1 (Soberano) porque não sofre marcação a mercado
   *    relevante; os demais títulos públicos (IPCA+, Prefixado, RendA+,
   *    Educa+) vão para o degrau 3 (Baixo), porque oscilam na venda antecipada.
   * 2. A embalagem herda o risco do conteúdo: ETF, fundo, previdência e COE
   *    ficam no degrau do que carregam por dentro, não num degrau próprio.
   * 3. Sem classificação de autoridade (rating, regulação, garantia) → vai
   *    para o degrau máximo.
   * 4. Liquidez é uma dimensão do risco, mas tem campo próprio (LIQUIDEZ);
   *    não se mistura com o degrau.
   * 5. Forex de varejo não é degrau: é inelegível (fica fora da matriz).
   * ========================================================================= */
  var CLASSES = {
    // Degrau 1 — só Tesouro Selic.
    RISCO_SOBERANO:    { label: 'Risco Soberano',    ordem: 1, cor: '#0b6e3a' },
    // Degrau 2 — garantia do FGC + liquidez diária, dentro do limite do FGC.
    RISCO_MUITO_BAIXO: { label: 'Risco Muito Baixo', ordem: 2, cor: '#1f8f4a' },
    // Degrau 3 — Tesouro não-Selic; FGC sem liquidez diária; renda fixa simples.
    RISCO_BAIXO:       { label: 'Risco Baixo',       ordem: 3, cor: '#4caf50' },
    // Degrau 4 — excedente do FGC em banco S1-S2; crédito AAA/AA.
    RISCO_MEDIO_BAIXO: { label: 'Risco Médio-Baixo', ordem: 4, cor: '#9ccc65' },
    // Degrau 5 — multimercado de baixa volatilidade; crédito A;
    //            previdência conservadora; excedente do FGC em banco S3.
    RISCO_MEDIO:       { label: 'Risco Médio',       ordem: 5, cor: '#ffd54f' },
    // Degrau 6 — FII diversificado; ETF de índice amplo; crédito BBB.
    RISCO_MEDIO_ALTO:  { label: 'Risco Médio-Alto',  ordem: 6, cor: '#ffa726' },
    // Degrau 7 — ações individuais; fundos de ações; small caps via veículo;
    //            cambial/ouro; excedente do FGC em banco S4-S5.
    RISCO_ALTO:        { label: 'Risco Alto',        ordem: 7, cor: '#fb8c00' },
    // Degrau 8 — small caps diretas; cripto via ETF; FIPs.
    RISCO_MUITO_ALTO:  { label: 'Risco Muito Alto',  ordem: 8, cor: '#e53935' },
    // Degrau 9 — cripto direta; opções especulativas; venda a descoberto;
    //            alavancagem; qualquer ativo sem classificação de autoridade.
    RISCO_MAXIMO:      { label: 'Risco Máximo',      ordem: 9, cor: '#8e0000' }
  };

  /*
   * Notas de classificação que acompanham o catálogo (mesmo texto do SQL):
   * - Fundo DI / Fundo Renda Fixa: só permanece no Baixo o fundo que entrega
   *   acima do produto com FGC de liquidez equivalente; caso contrário, o
   *   consultor rebaixa pelo item.
   * - CRA / CRI / Debêntures: default do tipo; o rating do papel ajusta no
   *   item (AAA/AA → Médio-Baixo; A → Médio; BBB → Médio-Alto).
   * - COE: default Alto + revisão obrigatória por item (look-through: a
   *   embalagem herda o risco do conteúdo; a "proteção de capital" é promessa
   *   do emissor, sem FGC, com prazo travado).
   */

  var ORDEM = [
    'RISCO_SOBERANO',
    'RISCO_MUITO_BAIXO',
    'RISCO_BAIXO',
    'RISCO_MEDIO_BAIXO',
    'RISCO_MEDIO',
    'RISCO_MEDIO_ALTO',
    'RISCO_ALTO',
    'RISCO_MUITO_ALTO',
    'RISCO_MAXIMO'
  ];

  /* =========================================================================
   * LIQUIDEZ — em quanto tempo e a que preço o dinheiro volta
   * ========================================================================= */
  var LIQUIDEZ = {
    D0:            { label: 'Mesmo dia, valor cheio' },
    D1:            { label: '1 dia útil' },
    D1_MERCADO:    { label: '1 dia útil, a preço de mercado' },
    ATE_D30:       { label: 'Até 30 dias' },
    SO_VENCIMENTO: { label: 'Só no vencimento' },
    ILIQUIDO:      { label: 'Ilíquido' }
  };

  var LIQUIDEZ_ORDEM = ['D0', 'D1', 'D1_MERCADO', 'ATE_D30', 'SO_VENCIMENTO', 'ILIQUIDO'];

  /* =========================================================================
   * PERFIS DE INVESTIDOR — escala de 7
   * ========================================================================= */
  var PERFIS = [
    { id: '1', nome: 'Ultra-Conservador' },
    { id: '2', nome: 'Conservador' },
    { id: '3', nome: 'Conservador-Moderado' },
    { id: '4', nome: 'Moderado' },
    { id: '5', nome: 'Moderado-Arrojado' },
    { id: '6', nome: 'Arrojado' },
    { id: '7', nome: 'Ultra-Arrojado' }
  ];

  /* =========================================================================
   * MATRIZ 7 perfis × 9 classes (percentual de cada classe por perfil)
   *
   * Posição no array = perfil: [perfil 1, perfil 2, ..., perfil 7].
   * Cada perfil (coluna) soma 100. Andar de segurança (Soberano + Muito Baixo)
   * = 100 / 85 / 65 / 45 / 40 / 28 / 20.
   *
   * ATENÇÃO: isto é uma REFERÊNCIA DE PLANEJAMENTO POR CLASSE de risco, nunca
   * recomendação de ativo. Recomendação individualizada de valores mobiliários
   * é atividade privativa de consultor autorizado; nenhum texto derivado desta
   * matriz pode citar produto específico — só a classe ("degrau Soberano").
   * ========================================================================= */
  var MATRIZ = {
    RISCO_SOBERANO:    [80, 55, 40, 30, 25, 18, 15],
    RISCO_MUITO_BAIXO: [20, 30, 25, 15, 15, 10,  5],
    RISCO_BAIXO:       [ 0, 15, 20, 20, 15,  7,  0],
    RISCO_MEDIO_BAIXO: [ 0,  0, 10, 15, 10,  8,  5],
    RISCO_MEDIO:       [ 0,  0,  5, 10, 10, 10,  5],
    RISCO_MEDIO_ALTO:  [ 0,  0,  0, 10, 15, 17, 15],
    RISCO_ALTO:        [ 0,  0,  0,  0, 10, 20, 30],
    RISCO_MUITO_ALTO:  [ 0,  0,  0,  0,  0, 10, 20],
    RISCO_MAXIMO:      [ 0,  0,  0,  0,  0,  0,  5]
  };

  // Degraus que formam o "andar de segurança".
  var ANDAR_SEGURANCA = ['RISCO_SOBERANO', 'RISCO_MUITO_BAIXO'];

  /* =========================================================================
   * VOCABULÁRIOS LEGADOS → chave nova (usado só na leitura)
   * ========================================================================= */
  var MAPA_LEGADO = {
    // Escala de 7 atual (1:1, decisão do dono). As chaves iguais às novas já
    // são reconhecidas antes do mapa; ficam aqui só para documentação.
    RISCO_MUITO_BAIXO: 'RISCO_MUITO_BAIXO',
    RISCO_BAIXO: 'RISCO_BAIXO',
    RISCO_MEDIO_BAIXO: 'RISCO_MEDIO_BAIXO',
    RISCO_MEDIO: 'RISCO_MEDIO',
    RISCO_MEDIO_ALTO: 'RISCO_MEDIO_ALTO',
    RISCO_ALTO: 'RISCO_ALTO',
    RISCO_MUITO_ALTO: 'RISCO_MUITO_ALTO',

    // Escala de 7 "com GARANTIA" (cliente-detalhes.html; gravada até 06/2026).
    RISCO_MUITO_BAIXO_GARANTIA_SOBERANA: 'RISCO_SOBERANO',
    RISCO_MUITO_BAIXO_GARANTIA_FGC: 'RISCO_MUITO_BAIXO',
    RISCO_BAIXO_GARANTIA_FGC: 'RISCO_BAIXO',
    RISCO_MEDIO_SEM_GARANTIA: 'RISCO_MEDIO',
    RISCO_ALTO_SEM_GARANTIA: 'RISCO_ALTO',
    RISCO_MUITO_ALTO_SEM_GARANTIA: 'RISCO_MUITO_ALTO',
    RISCO_ABSOLUTO_SEM_GARANTIA: 'RISCO_MAXIMO',

    // Escala de 10 (commit 7f8ab52, out/2025) — chaves extras.
    // Crédito privado sem garantia (existe em diagnóstico salvo).
    RISCO_BAIXO_SEM_GARANTIA: 'RISCO_MEDIO_BAIXO',
    // COE: a embalagem herda o risco do conteúdo.
    RISCO_ALTO_PROTECAO_MRP: 'RISCO_ALTO',
    RISCO_MUITO_ALTO_PROTECAO_MRP: 'RISCO_MUITO_ALTO'
  };

  /* Projeção 9 → 7: usada só quando o formato novo precisa escrever
   * classificacao_risco (escala da tela antiga) num item cuja classe veio do
   * ITEM ou de produto sem coluna antiga. */
  var PROJECAO_7 = {
    RISCO_SOBERANO: 'RISCO_MUITO_BAIXO',
    RISCO_MUITO_BAIXO: 'RISCO_BAIXO',
    RISCO_BAIXO: 'RISCO_BAIXO',
    RISCO_MEDIO_BAIXO: 'RISCO_MEDIO_BAIXO',
    RISCO_MEDIO: 'RISCO_MEDIO',
    RISCO_MEDIO_ALTO: 'RISCO_MEDIO_ALTO',
    RISCO_ALTO: 'RISCO_ALTO',
    RISCO_MUITO_ALTO: 'RISCO_MUITO_ALTO',
    RISCO_MAXIMO: 'RISCO_MUITO_ALTO'
  };

  // Faixas da régua de notas (limite superior exclusivo → perfil). ≥ 95 → '7'.
  var REGUA = [[15, '1'], [30, '2'], [45, '3'], [60, '4'], [75, '5'], [95, '6']];

  /* ------------------------------------------------------------------------- */
  /* Utilitários internos                                                      */
  /* ------------------------------------------------------------------------- */

  function temProp(obj, chave) {
    return Object.prototype.hasOwnProperty.call(obj, chave);
  }

  // Texto limpo em maiúsculas; qualquer coisa que não seja texto/número vira ''.
  function limpar(valor) {
    if (valor === null || valor === undefined) return '';
    if (typeof valor !== 'string' && typeof valor !== 'number') return '';
    return String(valor).trim().toUpperCase();
  }

  // Aceita '3', 3, ' 3 ' → '3'; qualquer outra coisa → ''.
  function idPerfil(id) {
    var t = limpar(id);
    if (!/^[1-7]$/.test(t)) return '';
    return t;
  }

  function congelar(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.keys(obj).forEach(function (k) { congelar(obj[k]); });
      Object.freeze(obj);
    }
    return obj;
  }

  /* ------------------------------------------------------------------------- */
  /* Classes                                                                   */
  /* ------------------------------------------------------------------------- */

  // true só para as 9 chaves novas (tolera espaços e caixa diferente).
  function ehChaveNova(valor) {
    var t = limpar(valor);
    return t !== '' && temProp(CLASSES, t);
  }

  // Chave nova equivalente, ou '' (vazio/desconhecido).
  // Ordem: já é chave nova → ela mesma; senão mapa legado; senão ''.
  function normalizarRisco(valor) {
    var t = limpar(valor);
    if (!t) return '';
    if (temProp(CLASSES, t)) return t;
    if (temProp(MAPA_LEGADO, t)) return MAPA_LEGADO[t];
    return '';
  }

  // 1..9 pela chave normalizada; 0 se vazio/desconhecido.
  function ordemRisco(valor) {
    var c = normalizarRisco(valor);
    return c ? CLASSES[c].ordem : 0;
  }

  function rotuloRisco(valor) {
    var c = normalizarRisco(valor);
    return c ? CLASSES[c].label : 'Sem classificação';
  }

  function corRisco(valor) {
    var c = normalizarRisco(valor);
    return c ? CLASSES[c].cor : '#999';
  }

  // Rótulo da liquidez; '' se vazio. Valor desconhecido volta como veio
  // (texto cru), para não esconder o que está gravado.
  function rotuloLiquidez(valor) {
    var t = limpar(valor);
    if (!t) return '';
    if (temProp(LIQUIDEZ, t)) return LIQUIDEZ[t].label;
    return String(valor).trim();
  }

  // Chave nova (9) → chave da escala de 7 da tela antiga; '' se não for chave nova.
  function projetarPara7(chaveNova) {
    var t = limpar(chaveNova);
    return temProp(PROJECAO_7, t) ? PROJECAO_7[t] : '';
  }

  /* ------------------------------------------------------------------------- */
  /* Regras por item de investimento                                           */
  /* ------------------------------------------------------------------------- */

  /* Classe nova efetiva do item (ou ''):
   * 1. classe definida no próprio item pelo consultor (origem 'item');
   * 2. campo classe_risco existe (catálogo migrado): usa se for chave nova;
   *    se vazio e o produto exige revisão por item → '' (produto genérico);
   * 3. senão, traduz a classe antiga (classificacao_risco). */
  function classeDoItem(item) {
    if (!item || typeof item !== 'object') return '';

    if (item.classe_risco_origem === 'item' && ehChaveNova(item.classe_risco)) {
      return limpar(item.classe_risco);
    }

    if ('classe_risco' in item) {
      if (ehChaveNova(item.classe_risco)) return limpar(item.classe_risco);
      var vazio = item.classe_risco === null || item.classe_risco === undefined ||
        (typeof item.classe_risco === 'string' && item.classe_risco.trim() === '');
      if (vazio && item.revisao_item === true) return '';
    }

    return normalizarRisco(item.classificacao_risco);
  }

  /* "Guarda" (usado pelo Perfil 6 Poupador): degraus 1 a 3, ou item sem
   * classe (legado, conta como hoje). Liquidez e elegível NÃO entram. */
  function ehGuarda(item) {
    var ordem = ordemRisco(classeDoItem(item));
    if (ordem === 0) return true;
    return ordem <= 3;
  }

  /* Pode contar como reserva de emergência?
   * Devolve { elegivel, legado, motivo }.
   * legado:true = conta como hoje, mas gera pendência para o consultor. */
  function elegibilidadeReserva(item) {
    var it = (item && typeof item === 'object') ? item : {};
    var classe = classeDoItem(it);
    var ordem = ordemRisco(classe);

    if (it.elegivel === false) {
      return { elegivel: false, legado: false, motivo: 'produto fora da matriz (não elegível)' };
    }
    if (ordem === 0) {
      return { elegivel: true, legado: true, motivo: 'classe de risco não informada' };
    }
    if (classe === 'RISCO_SOBERANO' || classe === 'RISCO_MUITO_BAIXO') {
      return { elegivel: true, legado: false, motivo: '' };
    }
    if (classe === 'RISCO_BAIXO') {
      var liq = limpar(it.liquidez);
      if (!liq) {
        return { elegivel: true, legado: true, motivo: 'liquidez não informada' };
      }
      if (liq === 'D0' || liq === 'D1') {
        return { elegivel: true, legado: false, motivo: '' };
      }
      return {
        elegivel: false,
        legado: false,
        motivo: 'degrau Baixo sem liquidez diária (' + rotuloLiquidez(it.liquidez) + ')'
      };
    }
    // ordem >= 4
    return {
      elegivel: false,
      legado: false,
      motivo: 'degrau acima de Baixo (' + rotuloRisco(classe) + ')'
    };
  }

  /* ------------------------------------------------------------------------- */
  /* Perfis e matriz                                                           */
  /* ------------------------------------------------------------------------- */

  // { RISCO_SOBERANO: 80, ... } do perfil '1'..'7' (aceita número); null se inválido.
  function alocacaoIdeal(perfilId) {
    var id = idPerfil(perfilId);
    if (!id) return null;
    var col = Number(id) - 1;
    var out = {};
    ORDEM.forEach(function (c) { out[c] = MATRIZ[c][col]; });
    return out;
  }

  // Soma dos degraus 1 e 2 do perfil (100/85/65/45/40/28/20); null se inválido.
  function andarSeguranca(perfilId) {
    var id = idPerfil(perfilId);
    if (!id) return null;
    var col = Number(id) - 1;
    return ANDAR_SEGURANCA.reduce(function (s, c) { return s + MATRIZ[c][col]; }, 0);
  }

  // 'Moderado' etc.; '' se inválido.
  function nomePerfil(id) {
    var t = idPerfil(id);
    if (!t) return '';
    return PERFIS[Number(t) - 1].nome;
  }

  /* Régua: nota 0..100 → perfil '1'..'7' (valor exato, sem arredondar antes).
   * <15 '1' · <30 '2' · <45 '3' · <60 '4' · <75 '5' · <95 '6' · ≥95 '7'.
   * null se não numérico. */
  function regua(nota0a100) {
    var n;
    if (typeof nota0a100 === 'number') {
      n = nota0a100;
    } else if (typeof nota0a100 === 'string' && nota0a100.trim() !== '') {
      n = Number(nota0a100.trim().replace(',', '.'));
    } else {
      return null;
    }
    if (!isFinite(n)) return null;
    for (var i = 0; i < REGUA.length; i++) {
      if (n < REGUA[i][0]) return REGUA[i][1];
    }
    return '7';
  }

  /* ------------------------------------------------------------------------- */
  /* Autoteste — confere a tabela e as regras; não depende de tela             */
  /* ------------------------------------------------------------------------- */

  function autoteste() {
    var res = [];
    function registrar(nome, ok, detalhe) {
      res.push({ nome: nome, ok: !!ok, detalhe: detalhe || '' });
    }

    // 1. Cada perfil da matriz soma 100.
    for (var p = 0; p < 7; p++) {
      var soma = 0;
      for (var i = 0; i < ORDEM.length; i++) soma += MATRIZ[ORDEM[i]][p];
      registrar('Matriz: perfil ' + (p + 1) + ' soma 100', soma === 100, 'soma = ' + soma);
    }

    // 2. Andar de segurança.
    var andarEsperado = [100, 85, 65, 45, 40, 28, 20];
    var andarObtido = [];
    for (var a = 1; a <= 7; a++) andarObtido.push(andarSeguranca(a));
    registrar(
      'Andar de segurança = 100/85/65/45/40/28/20',
      andarObtido.join(',') === andarEsperado.join(','),
      'obtido = ' + andarObtido.join('/')
    );

    // 3. Normalização dos vocabulários legados (e das chaves novas).
    var casosNorm = [];
    ORDEM.forEach(function (c) { casosNorm.push([c, c]); });
    Object.keys(MAPA_LEGADO).forEach(function (k) { casosNorm.push([k, MAPA_LEGADO[k]]); });
    casosNorm.push(['RISCO_MUITO_BAIXO_GARANTIA_SOBERANA', 'RISCO_SOBERANO']);
    casosNorm.push(['RISCO_MUITO_BAIXO_GARANTIA_FGC', 'RISCO_MUITO_BAIXO']);
    casosNorm.push(['RISCO_BAIXO_GARANTIA_FGC', 'RISCO_BAIXO']);
    casosNorm.push(['RISCO_MEDIO_SEM_GARANTIA', 'RISCO_MEDIO']);
    casosNorm.push(['RISCO_ALTO_SEM_GARANTIA', 'RISCO_ALTO']);
    casosNorm.push(['RISCO_MUITO_ALTO_SEM_GARANTIA', 'RISCO_MUITO_ALTO']);
    casosNorm.push(['RISCO_ABSOLUTO_SEM_GARANTIA', 'RISCO_MAXIMO']);
    casosNorm.push(['RISCO_BAIXO_SEM_GARANTIA', 'RISCO_MEDIO_BAIXO']);
    casosNorm.push(['RISCO_ALTO_PROTECAO_MRP', 'RISCO_ALTO']);
    casosNorm.push(['RISCO_MUITO_ALTO_PROTECAO_MRP', 'RISCO_MUITO_ALTO']);
    casosNorm.push(['  risco_alto_sem_garantia ', 'RISCO_ALTO']);
    casosNorm.push(['desconhecido', '']);
    casosNorm.push(['', '']);
    casosNorm.push([null, '']);
    casosNorm.push([undefined, '']);
    casosNorm.push([7, '']);
    var falhasNorm = [];
    casosNorm.forEach(function (cs) {
      var obtido = normalizarRisco(cs[0]);
      if (obtido !== cs[1]) {
        falhasNorm.push(String(cs[0]) + ' → ' + (obtido || "''") + ' (esperado ' + (cs[1] || "''") + ')');
      }
    });
    registrar(
      'normalizarRisco: 3 vocabulários legados',
      falhasNorm.length === 0,
      falhasNorm.length ? falhasNorm.join('; ') : casosNorm.length + ' casos conferidos'
    );

    // 4. Projeção 9 → 7.
    var casosProj = [
      ['RISCO_SOBERANO', 'RISCO_MUITO_BAIXO'],
      ['RISCO_MUITO_BAIXO', 'RISCO_BAIXO'],
      ['RISCO_BAIXO', 'RISCO_BAIXO'],
      ['RISCO_MEDIO_BAIXO', 'RISCO_MEDIO_BAIXO'],
      ['RISCO_MEDIO', 'RISCO_MEDIO'],
      ['RISCO_MEDIO_ALTO', 'RISCO_MEDIO_ALTO'],
      ['RISCO_ALTO', 'RISCO_ALTO'],
      ['RISCO_MUITO_ALTO', 'RISCO_MUITO_ALTO'],
      ['RISCO_MAXIMO', 'RISCO_MUITO_ALTO'],
      ['', ''],
      [null, '']
    ];
    var falhasProj = [];
    casosProj.forEach(function (cs) {
      var obtido = projetarPara7(cs[0]);
      if (obtido !== cs[1]) {
        falhasProj.push(String(cs[0]) + ' → ' + (obtido || "''") + ' (esperado ' + (cs[1] || "''") + ')');
      }
    });
    registrar(
      'projetarPara7: 9 → 7',
      falhasProj.length === 0,
      falhasProj.length ? falhasProj.join('; ') : casosProj.length + ' casos conferidos'
    );

    // 5. Régua nas fronteiras.
    var casosRegua = [
      [0, '1'], [14.99, '1'], [15, '2'], [29.99, '2'], [30, '3'],
      [44.99, '3'], [45, '4'], [59.99, '4'], [60, '5'], [74.99, '5'],
      [75, '6'], [94.99, '6'], [95, '7'], [100, '7'],
      [null, null], [undefined, null], ['', null], ['abc', null], [NaN, null]
    ];
    var falhasRegua = [];
    casosRegua.forEach(function (cs) {
      var obtido = regua(cs[0]);
      if (obtido !== cs[1]) {
        falhasRegua.push(String(cs[0]) + ' → ' + String(obtido) + ' (esperado ' + String(cs[1]) + ')');
      }
    });
    registrar(
      'regua: fronteiras das faixas',
      falhasRegua.length === 0,
      falhasRegua.length ? falhasRegua.join('; ') : casosRegua.length + ' casos conferidos'
    );

    // 6. Elegibilidade da reserva — casos-limite.
    var casosEleg = [
      ['Soberano sem liquidez → elegível',
        { classe_risco: 'RISCO_SOBERANO', liquidez: null, elegivel: true },
        { elegivel: true, legado: false }],
      ['Baixo D1 → elegível',
        { classe_risco: 'RISCO_BAIXO', liquidez: 'D1', elegivel: true },
        { elegivel: true, legado: false }],
      ['Baixo SO_VENCIMENTO → não elegível',
        { classe_risco: 'RISCO_BAIXO', liquidez: 'SO_VENCIMENTO', elegivel: true },
        { elegivel: false, legado: false }],
      ['Baixo sem liquidez → legado',
        { classificacao_risco: 'RISCO_BAIXO' },
        { elegivel: true, legado: true }],
      ['Médio-Baixo → não elegível',
        { classe_risco: 'RISCO_MEDIO_BAIXO', liquidez: 'D0', elegivel: true },
        { elegivel: false, legado: false }],
      ['elegivel=false → não elegível',
        { classe_risco: 'RISCO_SOBERANO', liquidez: 'D1', elegivel: false },
        { elegivel: false, legado: false }],
      ['sem classe → legado',
        { classificacao_risco: '' },
        { elegivel: true, legado: true }]
    ];
    casosEleg.forEach(function (cs) {
      var r = elegibilidadeReserva(cs[1]);
      var ok = r.elegivel === cs[2].elegivel && r.legado === cs[2].legado;
      registrar(
        'elegibilidadeReserva: ' + cs[0],
        ok,
        'elegivel=' + r.elegivel + ', legado=' + r.legado + (r.motivo ? ', motivo: ' + r.motivo : '')
      );
    });

    return res;
  }

  /* ------------------------------------------------------------------------- */
  /* Publicação                                                                */
  /* ------------------------------------------------------------------------- */

  congelar(CLASSES);
  congelar(ORDEM);
  congelar(LIQUIDEZ);
  congelar(LIQUIDEZ_ORDEM);
  congelar(PERFIS);
  congelar(MATRIZ);
  congelar(ANDAR_SEGURANCA);

  window.RiscosV3 = {
    VERSAO: VERSAO,
    CLASSES: CLASSES,
    ORDEM: ORDEM,
    LIQUIDEZ: LIQUIDEZ,
    LIQUIDEZ_ORDEM: LIQUIDEZ_ORDEM,
    PERFIS: PERFIS,
    MATRIZ: MATRIZ,
    ANDAR_SEGURANCA: ANDAR_SEGURANCA,
    normalizarRisco: normalizarRisco,
    ehChaveNova: ehChaveNova,
    ordemRisco: ordemRisco,
    rotuloRisco: rotuloRisco,
    corRisco: corRisco,
    rotuloLiquidez: rotuloLiquidez,
    projetarPara7: projetarPara7,
    classeDoItem: classeDoItem,
    ehGuarda: ehGuarda,
    elegibilidadeReserva: elegibilidadeReserva,
    alocacaoIdeal: alocacaoIdeal,
    andarSeguranca: andarSeguranca,
    nomePerfil: nomePerfil,
    regua: regua,
    autoteste: autoteste
  };
})();
