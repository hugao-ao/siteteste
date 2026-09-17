/**
 * diagnostico/suitability-v3.js — Teste de Perfil de Investidor (formato novo, investimentos v3)
 *
 * Script clássico (IIFE), carregado ANTES de perfil-financeiro.js.
 * Desenho: seção 5 do DESIGN-investimentos-v3.
 *
 * - Guarda as respostas na coluna própria `suitability_v3` (formato 5.1). NUNCA lê nem grava
 *   as respostas do teste antigo (`respostas_suitability`), exceto para mostrar o aviso de que existem.
 * - Pessoas: titular (#nome_diagnostico) + donos dos investimentos, titular primeiro, sem repetição.
 * - Blocos A (objetivos) e C (conhecimento) por pessoa; bloco B (situação financeira) do domicílio.
 * - B4 (capacidade) e a memória de cálculo são só leitura: vêm do motor (PerfilFinanceiro).
 * - O gabarito do C6 fica só no código (o motor usa); não aparece na tela.
 *
 * API:
 *   window.SUITABILITY_V3_ATIVO = true
 *   window.getSuitabilityV3Data()     → cópia profunda do estado
 *   window.setSuitabilityV3Data(obj)  → aceita objeto, string JSON ou null; normaliza e re-renderiza
 *   window.SuitabilityV3 = { QUESTOES, GABARITO_C6, render, pessoas }
 */
(function () {
  'use strict';

  var ID_CONTAINER = 'teste-suitability-v3-container';
  var ID_ESTILOS = 'sv3-estilos';

  // ------------------------------------------------------------
  // Perguntas (texto literal do estudo — seção 5.4)
  // ------------------------------------------------------------
  function escala(textos) {
    return textos.map(function (t, i) { return { valor: i, texto: t }; });
  }

  var ESCALA_C1 = escala([
    'nenhum',
    'poupança/CDB',
    'Tesouro e a diferença Selic × IPCA+',
    'fundos e taxas',
    'ações/FIIs e formação de preço'
  ]);

  var QUESTOES = [
    // ---- Bloco A · Objetivos (Res. CVM 30, art. 2º, §1º) ----
    {
      id: 'A1', bloco: 'A', tipo: 'codigo', titulo: 'Período', nota: 'teto de liquidez; não pontua',
      texto: 'Você sabe se vai precisar retirar parte ou todo o dinheiro investido?',
      ajuda: 'O teto limita a pessoa; a trava de horizonte continua valendo pote a pote, por objetivo.',
      alternativas: [
        { valor: 'tudo_qualquer_momento', texto: 'Posso precisar de tudo a qualquer momento' },
        { valor: 'grande_parte_2anos', texto: 'Grande parte em até 2 anos' },
        { valor: 'parte_2anos', texto: 'Uma parte em até 2 anos' },
        { valor: 'so_2a5anos', texto: 'Só entre 2 e 5 anos' },
        { valor: 'sem_retirada_5anos', texto: 'Sem retirada prevista em 5+ anos' }
      ]
    },
    {
      id: 'A2', bloco: 'A', tipo: 'codigo', titulo: 'Finalidade', nota: 'teto; só limita, nunca eleva',
      texto: 'Para que serve, principalmente, este dinheiro?',
      ajuda: '',
      alternativas: [
        { valor: 'preservar', texto: 'Preservar o que já tenho' },
        { valor: 'renda_estavel', texto: 'Gerar renda estável' },
        { valor: 'acumular_longo_prazo', texto: 'Acumular para objetivos de longo prazo' },
        { valor: 'multiplicar', texto: 'Multiplicar aceitando risco' }
      ]
    },
    {
      id: 'A3', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Seus investimentos caem 20% em um mês. O que você faz?',
      alternativas: escala(['Vendo tudo', 'Vendo parte', 'Não mexo e espero', 'Não mexo e me incomoda pouco', 'Compro mais'])
    },
    {
      id: 'A4', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Qual sua prioridade?',
      alternativas: escala(['Não perder nunca', 'Ganhar um pouco mais com oscilação mínima', 'Equilíbrio', 'Crescer aceitando anos ruins', 'Máximo crescimento com oscilação forte'])
    },
    {
      id: 'A5', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Escolha uma aplicação para R$ 10 mil por 5 anos:',
      alternativas: escala(['Certeza de R$ 13 mil', 'Provável R$ 14 mil, piso R$ 12 mil', 'Provável R$ 16 mil, piso R$ 10 mil', 'Provável R$ 19 mil, piso R$ 8 mil', 'Chance de R$ 25 mil, piso R$ 6 mil'])
    },
    {
      id: 'A6', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Você já viveu uma queda forte com dinheiro seu aplicado?',
      alternativas: escala(['Nunca tive ativo que oscila', 'Vivi e vendi no prejuízo', 'Vivi e travei', 'Vivi e segurei', 'Vivi e comprei mais'])
    },
    {
      id: 'A7', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Quanto tempo aguenta ver uma posição no vermelho sem mexer?',
      alternativas: escala(['Nem um dia', 'Semanas', 'Meses', '1-2 anos', 'O necessário, com a tese de pé'])
    },
    {
      id: 'A8', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: '«Prefiro dormir tranquilo a ganhar mais»',
      alternativas: escala(['Concordo totalmente', 'Concordo', 'Neutro', 'Discordo', 'Discordo totalmente'])
    },
    {
      id: 'A9', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Que parcela do patrimônio você aceita ver oscilando forte?',
      alternativas: escala(['Nada', 'Até 10%', 'Até 25%', 'Até 50%', 'Acima de 50%'])
    },
    {
      id: 'A10', bloco: 'A', tipo: 'escala', titulo: '', nota: '', ajuda: '',
      texto: 'Manchete de crise global. Sua reação:',
      alternativas: escala(['Resgato antes que piore', 'Reduzo bastante', 'Espero orientação', 'Mantenho o plano', 'Vejo oportunidade'])
    },

    // ---- Bloco B · Situação financeira (art. 2º, §2º) — domicílio ----
    {
      id: 'B3', bloco: 'B', tipo: 'codigo', titulo: 'Necessidade futura de recursos', nota: 'teto', ajuda: '',
      texto: 'Além dos objetivos cadastrados, existe necessidade prevista de usar recursos relevantes (obra, tratamento, apoio a familiar)?',
      alternativas: [
        { valor: 'ate_2_anos', texto: 'Sim, em até 2 anos' },
        { valor: 'entre_2_e_5_anos', texto: 'Sim, entre 2 e 5 anos' },
        { valor: 'nao_prevista', texto: 'Não prevista' }
      ]
    },

    // ---- Bloco C · Conhecimento (art. 2º, §3º; nota C = soma × 100/24) ----
    {
      id: 'C1', bloco: 'C', tipo: 'escala', titulo: 'Familiaridade', nota: 'escala progressiva', ajuda: '',
      texto: 'Quais destes você sabe explicar para outra pessoa?',
      alternativas: ESCALA_C1
    },
    {
      id: 'C2', bloco: 'C', tipo: 'escala', titulo: 'Em quais já investiu', nota: 'mesma escala do C1 (verificação cruzada com o patrimônio)', ajuda: '',
      texto: '',
      alternativas: ESCALA_C1
    },
    {
      id: 'C3', bloco: 'C', tipo: 'escala', titulo: 'Frequência e tempo', nota: '', ajuda: '',
      texto: '',
      alternativas: escala(['nunca operou', 'opera há menos de 1 ano', 'poucas vezes ao ano há 1+ ano', 'mensalmente há 2+ anos', 'semanalmente há 3+ anos'])
    },
    {
      id: 'C4', bloco: 'C', tipo: 'escala', titulo: 'Volume relativo', nota: '', ajuda: '',
      texto: 'Volume das operações já realizadas frente ao patrimônio',
      alternativas: escala(['nunca', 'até 10%', 'até 25%', 'até 50%', 'acima de 50%'])
    },
    {
      id: 'C5', bloco: 'C', tipo: 'escala', titulo: 'Formação/experiência', nota: '', ajuda: '',
      texto: '',
      alternativas: [
        { valor: 0, texto: 'nenhuma' },
        { valor: 2, texto: 'estudo por conta própria' },
        { valor: 4, texto: 'formação formal ou atuação profissional em finanças' }
      ]
    },
    {
      id: 'C6', bloco: 'C', tipo: 'vf', titulo: 'Bateria objetiva', nota: '8 afirmações verdadeiro/falso; nota C6 = acertos ÷ 2', ajuda: '',
      texto: '',
      afirmacoes: [
        'Título do Tesouro nunca perde valor na venda antecipada',
        'O FGC paga no dia seguinte à quebra do banco',
        'O FGC cobre qualquer valor',
        'Diversificar reduz o risco de perda total',
        'Rendimento passado garante rendimento futuro',
        'Um fundo pode levar 30 dias ou mais para pagar o resgate',
        'Ação de empresa boa não cai',
        'Renda fixa pode perder da inflação'
      ]
    }
  ];

  // Gabarito do C6 (1..8). Só no código — NÃO exibir na tela do cliente.
  var GABARITO_C6 = [false, false, false, true, false, true, false, true];

  var IDS_ESCALA = ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'C1', 'C2', 'C3', 'C4'];
  var TOTAL_PERGUNTAS = 2 + IDS_ESCALA.length + 1 + 8; // A1, A2, escalas, C5, C6 ×8 = 23

  function questao(id) {
    for (var i = 0; i < QUESTOES.length; i++) {
      if (QUESTOES[i].id === id) return QUESTOES[i];
    }
    return null;
  }

  // ------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------
  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function str(v) {
    return v === undefined || v === null ? '' : String(v);
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function ehObjeto(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  // Mesmo parse numérico do motor (perfil-financeiro.js), para os valores baterem
  function num(v) {
    if (typeof v === 'string') v = v.replace(',', '.');
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function r2(n) {
    return Math.round(num(n) * 100) / 100;
  }

  function mensal(valor, qtd, und) {
    var v = num(valor);
    var q = parseInt(qtd, 10) || 1;
    switch (str(und)) {
      case 'dia': return v * 30 / q;
      case 'semana': return v * (52 / 12) / q;
      case 'mes': return v / q;
      case 'ano': return v / (12 * q);
      default: return v;
    }
  }

  function moeda(v) {
    if (v === null || v === undefined || v === '' || !isFinite(Number(v))) return '—';
    try {
      return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (e) {
      return 'R$ ' + Number(v).toFixed(2);
    }
  }

  function dataHora(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return d.toISOString();
    }
  }

  function copiaProfunda(v) {
    return JSON.parse(JSON.stringify(v));
  }

  // ------------------------------------------------------------
  // Normalização (formato 5.1)
  // ------------------------------------------------------------
  function inteiroValido(v, permitidos) {
    if (v === undefined || v === null || v === '' || typeof v === 'boolean') return null;
    var n = Number(v);
    if (!isFinite(n) || Math.floor(n) !== n) return null;
    return permitidos.indexOf(n) >= 0 ? n : null;
  }

  function codigoValido(id, v) {
    var q = questao(id);
    if (!q || v === undefined || v === null) return '';
    var s = String(v);
    for (var i = 0; i < q.alternativas.length; i++) {
      if (String(q.alternativas[i].valor) === s) return s;
    }
    return '';
  }

  function vfValido(v) {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return null;
  }

  function numOuNull(v) {
    if (v === undefined || v === null || v === '' || typeof v === 'boolean') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function normalizarPessoa(p) {
    p = ehObjeto(p) ? p : {};
    var out = {};
    out.A1 = codigoValido('A1', p.A1);
    out.A2 = codigoValido('A2', p.A2);
    IDS_ESCALA.forEach(function (id) {
      out[id] = inteiroValido(p[id], [0, 1, 2, 3, 4]);
    });
    out.C5 = inteiroValido(p.C5, [0, 2, 4]);
    var c6 = arr(p.C6);
    out.C6 = [];
    for (var i = 0; i < 8; i++) out.C6.push(vfValido(c6[i]));
    return out;
  }

  function normalizarEstado(obj) {
    var o = ehObjeto(obj) ? obj : {};
    var pessoas = {};
    if (ehObjeto(o.pessoas)) {
      Object.keys(o.pessoas).forEach(function (nome) {
        if (!String(nome).trim()) return;
        pessoas[nome] = normalizarPessoa(o.pessoas[nome]);
      });
    }
    var dom = ehObjeto(o.domicilio) ? o.domicilio : {};
    var conf = ehObjeto(dom.confirmacao_b1b2) ? dom.confirmacao_b1b2 : {};
    var confirmado = conf.confirmado === true;
    return {
      versao: 3,
      pessoas: pessoas,
      domicilio: {
        B3: codigoValido('B3', dom.B3),
        confirmacao_b1b2: {
          confirmado: confirmado,
          em: confirmado && typeof conf.em === 'string' && conf.em ? conf.em : null,
          renda_mensal: confirmado ? numOuNull(conf.renda_mensal) : null,
          patrimonio_liquido: confirmado ? numOuNull(conf.patrimonio_liquido) : null,
          patrimonio_fisico: confirmado ? numOuNull(conf.patrimonio_fisico) : null
        }
      },
      atualizado_em: typeof o.atualizado_em === 'string' ? o.atualizado_em : ''
    };
  }

  var estado = normalizarEstado(null);

  function marcarAtualizado() {
    estado.atualizado_em = new Date().toISOString();
  }

  function respostasDe(nome) {
    return Object.prototype.hasOwnProperty.call(estado.pessoas, nome) ? estado.pessoas[nome] : null;
  }

  function contarRespondidas(nome) {
    var p = respostasDe(nome);
    if (!p) return 0;
    var n = 0;
    if (p.A1) n++;
    if (p.A2) n++;
    IDS_ESCALA.forEach(function (id) { if (p[id] !== null && p[id] !== undefined) n++; });
    if (p.C5 !== null && p.C5 !== undefined) n++;
    arr(p.C6).forEach(function (v) { if (v === true || v === false) n++; });
    return n;
  }

  function textoContagem(nome) {
    return contarRespondidas(nome) + '/' + TOTAL_PERGUNTAS + ' respondidas';
  }

  // ------------------------------------------------------------
  // Leituras de outros módulos (sempre protegidas)
  // ------------------------------------------------------------
  function listarPessoas() {
    var el = document.getElementById('nome_diagnostico');
    var titular = el && typeof el.value === 'string' ? el.value.trim() : '';
    var itens = [];
    try {
      itens = typeof window.getPatrimoniosLiquidosData === 'function' ? window.getPatrimoniosLiquidosData() : [];
    } catch (e) {
      itens = [];
    }
    var vistos = {};
    var outros = [];
    arr(itens).forEach(function (pl) {
      if (!pl) return;
      arr(pl.donos).forEach(function (d) {
        var n = str(d).trim();
        if (!n || n === titular || vistos[n]) return;
        vistos[n] = true;
        outros.push(n);
      });
    });
    outros.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    return titular ? [titular].concat(outros) : outros;
  }

  var lendoMotor = false;
  // Só lê o motor depois que ele já calculou (evento ou recálculo pedido por aqui):
  // getResultado() sem resultado prévio dispararia um cálculo fora de hora durante a carga.
  var motorPublicou = false;
  function resultadoMotor() {
    var pf = window.PerfilFinanceiro;
    if (!motorPublicou || !pf || typeof pf.getResultado !== 'function' || lendoMotor) return null;
    lendoMotor = true;
    try {
      return pf.getResultado() || null;
    } catch (e) {
      return null;
    } finally {
      lendoMotor = false;
    }
  }

  function recalcularMotor() {
    try {
      if (window.PerfilFinanceiro && typeof window.PerfilFinanceiro.recalcular === 'function') {
        window.PerfilFinanceiro.recalcular();
        motorPublicou = true;
      }
    } catch (e) {
      if (window.console && console.error) console.error('[SuitabilityV3] erro ao pedir recálculo:', e);
    }
  }

  function temRespostasAntigas() {
    var d = null;
    try {
      d = typeof window.getRespostasSuitabilityData === 'function' ? window.getRespostasSuitabilityData() : null;
    } catch (e) {
      d = null;
    }
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e2) { d = null; }
    }
    if (!ehObjeto(d)) return false;
    return Object.keys(d).some(function (k) {
      var v = d[k];
      if (!ehObjeto(v)) return false;
      return Object.keys(v).some(function (q) {
        var n = parseInt(v[q], 10);
        return isFinite(n) && n > 0;
      });
    });
  }

  function rendaMensalTotal() {
    var r = resultadoMotor();
    var rm = r && r.perfil_financeiro && r.perfil_financeiro.analise &&
      r.perfil_financeiro.analise.camada_divida && r.perfil_financeiro.analise.camada_divida.numeros
      ? r.perfil_financeiro.analise.camada_divida.numeros.renda_media : null;
    if (typeof rm === 'number' && isFinite(rm) && rm > 0) return rm;
    var fluxo = {};
    try {
      fluxo = typeof window.getFluxoCaixaData === 'function' ? (window.getFluxoCaixaData() || {}) : {};
    } catch (e) {
      fluxo = {};
    }
    var soma = 0;
    arr(fluxo.receitas).forEach(function (rec) {
      if (!rec || rec.automatica) return;
      soma += mensal(rec.valor, rec.qtd_recorrencia, rec.und_recorrencia || 'mes');
    });
    return soma;
  }

  function patrimonioLiquidoTotal() {
    var itens = [];
    try {
      itens = typeof window.getPatrimoniosLiquidosData === 'function' ? window.getPatrimoniosLiquidosData() : [];
    } catch (e) {
      itens = [];
    }
    var soma = 0;
    arr(itens).forEach(function (pl) { if (pl) soma += num(pl.valor_atual); });
    return soma;
  }

  function patrimonioFisicoTotal() {
    var soma = 0;
    arr(window.patrimonios).forEach(function (p) { if (p) soma += num(p.valor); });
    return soma;
  }

  function valoresB() {
    return {
      renda_mensal: r2(rendaMensalTotal()),
      patrimonio_liquido: r2(patrimonioLiquidoTotal()),
      patrimonio_fisico: r2(patrimonioFisicoTotal())
    };
  }

  function linhasMemoria(porPessoa, nome) {
    if (!ehObjeto(porPessoa) || !Object.prototype.hasOwnProperty.call(porPessoa, nome)) return [];
    var p = porPessoa[nome];
    if (!p || !p.memoria_calculo || !Array.isArray(p.memoria_calculo.linhas)) return [];
    return p.memoria_calculo.linhas.map(str);
  }

  // ------------------------------------------------------------
  // CSS (injetado uma vez)
  // ------------------------------------------------------------
  function injetarEstilos() {
    if (document.getElementById(ID_ESTILOS)) return;
    var css = [
      '.sv3{color:var(--text-light,#f0f8f0);max-width:100%;min-width:0;box-sizing:border-box}',
      '.sv3 *{box-sizing:border-box}',
      '.sv3-titulo{color:var(--accent-color,#ffd700);font-weight:700;font-size:1.05rem;margin:0 0 1rem;text-align:center}',
      '.sv3-faixa{background:rgba(255,215,0,.08);border:1px solid var(--border-color,#2e8b57);border-left:4px solid var(--accent-color,#ffd700);border-radius:6px;padding:.75rem 1rem;margin:0 0 1rem;font-size:.9rem;line-height:1.4}',
      '.sv3-faixa-alerta{border-left-color:#e53935;background:rgba(229,57,53,.14)}',
      '.sv3-vazio,.sv3-pendente{opacity:.75;font-style:italic;font-size:.88rem;padding:.4rem 0}',
      '.sv3-abas{display:none;gap:.5rem;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 0 .5rem;margin:0 0 .5rem;max-width:100%}',
      '.sv3-aba{flex:0 0 auto;min-height:44px;padding:.5rem 1rem;border:1px solid var(--border-color,#2e8b57);border-radius:22px;background:var(--dark-bg,#0f2e1f);color:var(--text-light,#f0f8f0);font-size:.95rem;cursor:pointer;max-width:80vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sv3-aba.sv3-ativa{background:var(--primary-color,#1a4d3a);color:var(--accent-color,#ffd700);border-color:var(--accent-color,#ffd700);font-weight:700}',
      '.sv3-aba .sv3-contagem{display:inline;margin:0 0 0 .4rem}',
      '.sv3-rolagem{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}',
      '.sv3-tabela{width:100%;border-collapse:collapse;background:var(--dark-bg,#0f2e1f);border:2px solid var(--border-color,#2e8b57)}',
      '.sv3-tabela th,.sv3-tabela td{border:1px solid var(--border-color,#2e8b57);padding:.6rem;vertical-align:top;text-align:left}',
      '.sv3-tabela thead th{background:var(--primary-color,#1a4d3a);color:var(--accent-color,#ffd700);font-size:.9rem}',
      '.sv3-tabela thead th.sv3-p{text-align:center;min-width:200px}',
      '.sv3-tabela th.sv3-q{min-width:280px}',
      '.sv3-secao th{background:var(--primary-color,#1a4d3a);color:var(--accent-color,#ffd700);font-size:.92rem}',
      '.sv3-subsecao td{background:rgba(26,77,58,.45)}',
      '.sv3-id{display:block;color:var(--accent-color,#ffd700);font-weight:700;font-size:.85rem}',
      '.sv3-nota{font-weight:400;opacity:.7;font-size:.78rem;color:var(--text-light,#f0f8f0)}',
      '.sv3-texto{display:block;font-size:.88rem;margin-top:.2rem;line-height:1.35;font-weight:400;color:var(--text-light,#f0f8f0)}',
      '.sv3-ajuda{display:block;font-size:.76rem;opacity:.7;margin-top:.25rem;font-style:italic;font-weight:400}',
      '.sv3-contagem{display:block;font-weight:400;font-size:.75rem;color:var(--text-light,#f0f8f0);opacity:.8;margin-top:.2rem}',
      '.sv3-select{width:100%;max-width:100%;min-height:44px;padding:.45rem .5rem;background:var(--surface-bg,#1a4d3a);color:var(--text-light,#f0f8f0);border:1px solid var(--border-color,#2e8b57);border-radius:5px;font-size:.88rem;cursor:pointer}',
      '.sv3-bloco-b,.sv3-resultados{margin-top:1.5rem;padding:1rem;border:2px solid var(--border-color,#2e8b57);border-radius:8px;background:var(--dark-bg,#0f2e1f);min-width:0;max-width:100%}',
      '.sv3-bloco-titulo{color:var(--accent-color,#ffd700);font-weight:700;font-size:.98rem;margin:0 0 .75rem}',
      '.sv3-sub{color:var(--accent-color,#ffd700);font-weight:600;font-size:.88rem;margin:1rem 0 .5rem}',
      '.sv3-resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.5rem;margin:0 0 .5rem}',
      '.sv3-resumo div{background:rgba(26,77,58,.45);border:1px solid var(--border-color,#2e8b57);border-radius:6px;padding:.5rem .75rem;min-width:0}',
      '.sv3-resumo dt{font-size:.78rem;opacity:.8}',
      '.sv3-resumo dd{margin:.15rem 0 0;font-weight:700;font-size:1rem;overflow-wrap:anywhere}',
      '.sv3-confirmado{font-size:.82rem;opacity:.85}',
      '.sv3-alerta{font-size:.82rem;color:#ffd54f;margin-top:.25rem}',
      '.sv3-check{display:flex;align-items:center;gap:.6rem;min-height:44px;cursor:pointer;margin:.5rem 0;font-size:.92rem}',
      '.sv3-check input{width:22px;height:22px;flex:0 0 auto;accent-color:var(--accent-color,#ffd700);cursor:pointer}',
      '.sv3-campo{margin:.75rem 0}',
      '.sv3-rotulo{display:block;margin-bottom:.4rem}',
      '.sv3-b4-tabela{width:100%;border-collapse:collapse;font-size:.86rem}',
      '.sv3-b4-tabela th,.sv3-b4-tabela td{border-bottom:1px solid rgba(46,139,87,.5);padding:.45rem .4rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}',
      '.sv3-b4-tabela th{font-weight:600;color:var(--text-light,#f0f8f0)}',
      '.sv3-b4-tabela td.sv3-pontos{text-align:right;white-space:nowrap;color:var(--accent-color,#ffd700);font-weight:700}',
      '.sv3-nota-b{margin-top:.5rem;font-weight:700;color:var(--accent-color,#ffd700)}',
      '.sv3-faltantes{margin:.4rem 0 0 1.1rem;padding:0;font-size:.8rem;opacity:.85}',
      '.sv3-resultado{margin-top:.75rem;min-width:0;max-width:100%}',
      '.sv3-resultado-nome{font-weight:700;margin-bottom:.35rem;overflow-wrap:anywhere}',
      '.sv3-memoria{margin:0;max-width:100%;overflow-x:auto;white-space:pre;font-family:Consolas,"Courier New",monospace;font-size:.78rem;line-height:1.45;background:#0a2016;color:var(--text-light,#f0f8f0);border:1px solid var(--border-color,#2e8b57);border-radius:6px;padding:.75rem}',
      '/* style.css (raiz), em @media (max-width:768px), empilha TODA tabela (display:block), manda thead tr para top:-9999px e',
      '   escreve td:before. Sem as regras abaixo, entre 600 e 768 px os nomes das pessoas somem e os selects ficam empilhados sem dono.',
      '   Seletores com classe (0,1,x) vencem os de style.css (0,0,x): as tabelas do teste ficam como tabela em qualquer largura;',
      '   o modo empilhado com abas (uma pessoa por vez) vem SOMENTE do @media (max-width:599px) logo abaixo, que vem depois e vence. */',
      '.sv3-tabela,.sv3-b4-tabela{display:table}',
      '.sv3-tabela thead{display:table-header-group}',
      '.sv3-tabela tbody,.sv3-b4-tabela tbody{display:table-row-group}',
      '.sv3-tabela thead tr{position:static;top:auto;left:auto}',
      '.sv3-tabela tr,.sv3-b4-tabela tr{display:table-row;margin:0;border:0;border-radius:0;background:none}',
      '.sv3-tabela th,.sv3-tabela td,.sv3-b4-tabela th,.sv3-b4-tabela td{display:table-cell;position:static}',
      '.sv3-tabela td:before,.sv3-b4-tabela td:before{content:none}',
      '/* Compacto (contrato v2): tipografia/espaçamentos a partir de 600px; altura, padding e fonte dos controles',
      '   só a partir de 900px (abaixo o hub.css exige 16px nos campos e, abaixo de 600px, vale o toque de 44px). */',
      '@media (min-width:600px){',
      '.sv3-check{gap:var(--cp-gap-x,8px);margin:4px 0;font-size:var(--cp-fs,13px)}',
      '.sv3-memoria{font-size:12px;line-height:var(--cp-lh,1.35);padding:6px 10px}',
      '}',
      '@media (min-width:900px){',
      '.sv3-select{min-height:var(--cp-ctl-h,30px);padding:var(--cp-ctl-pad,4px 8px);font-size:var(--cp-ctl-fs,13px)}',
      '.sv3-check{min-height:28px}',
      '}',
      '/* .sv3-duas (htmlTabela, só com até 2 pessoas): bloco A e bloco C em duas tabelas, lado a lado a partir',
      '   de 1100px; se não couberem duas colunas de 520px, auto-fit empilha. As larguras mínimas das colunas',
      '   caem para 220 + 2×150 = 520px por tabela (sem rolagem em ~580px). O seletor repetido com',
      '   body.hub-ativo #hub-modal-corpo vence, dentro do modal, o compacto-modulos-v2.css (min-width 260 /',
      '   width 220 — em layout automático o width vira mínimo da coluna, daí width:auto). */',
      '@media (min-width:1100px){',
      '.sv3-duas{display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:0 10px;align-items:start}',
      '.sv3-duas .sv3-tabela{margin:0}',
      '.sv3-duas .sv3-tabela th.sv3-q,body.hub-ativo #hub-modal-corpo .sv3-duas .sv3-tabela th.sv3-q{min-width:220px}',
      '.sv3-duas .sv3-tabela thead th.sv3-p,body.hub-ativo #hub-modal-corpo .sv3-duas .sv3-tabela thead th.sv3-p{min-width:150px;width:auto}',
      '}',
      '@media (max-width:599px){',
      '.sv3-abas{display:flex}',
      '.sv3-tabela,.sv3-tabela tbody,.sv3-tabela tr{display:block;width:100%}',
      '.sv3-tabela thead{display:none}',
      '.sv3-tabela td,.sv3-tabela th{display:block;width:100%;border-width:0 0 1px 0}',
      '.sv3-tabela th.sv3-q{min-width:0}',
      '.sv3-tabela .sv3-p{display:none}',
      '.sv3-tabela .sv3-p.sv3-ativa{display:block}',
      '.sv3-select{font-size:16px;min-height:44px}',
      '.sv3-check{min-height:44px}',
      '.sv3-bloco-b,.sv3-resultados{padding:.75rem}',
      '}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = ID_ESTILOS;
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // ------------------------------------------------------------
  // HTML
  // ------------------------------------------------------------
  var ativa = ''; // pessoa visível nas abas (celular)
  var ultimaLista = [];
  var ultimaListaAssinatura = '';
  var assinaturaMotor = '';
  var ultimoResumoB = '';

  function clsAtiva(nome) {
    return nome === ativa ? ' sv3-ativa' : '';
  }

  function htmlEnunciado(q, rotuloId) {
    var s = '<span class="sv3-id">' + esc(rotuloId || q.id) + (q.titulo ? ' · ' + esc(q.titulo) : '') +
      (q.nota ? ' <span class="sv3-nota">(' + esc(q.nota) + ')</span>' : '') + '</span>';
    if (q.texto) s += '<span class="sv3-texto">' + esc(q.texto) + '</span>';
    if (q.ajuda) s += '<span class="sv3-ajuda">' + esc(q.ajuda) + '</span>';
    return s;
  }

  function htmlSelectResposta(q, nome, idx) {
    var p = respostasDe(nome);
    var ehVf = q.tipo === 'vf';
    var atual = p ? (ehVf ? p.C6[idx] : p[q.id]) : null;
    var rotulo = q.id + (ehVf ? '.' + (idx + 1) : '') + ' — ' + nome;
    var s = '<select class="sv3-select" data-sv3="resposta" data-q="' + esc(q.id) + '"' +
      (ehVf ? ' data-i="' + idx + '"' : '') +
      ' data-pessoa="' + esc(nome) + '" aria-label="' + esc(rotulo) + '">';
    s += '<option value="">— responder —</option>';
    if (ehVf) {
      s += '<option value="true"' + (atual === true ? ' selected' : '') + '>Verdadeiro</option>';
      s += '<option value="false"' + (atual === false ? ' selected' : '') + '>Falso</option>';
    } else {
      q.alternativas.forEach(function (alt) {
        var val = String(alt.valor);
        var sel = atual !== null && atual !== undefined && atual !== '' && String(atual) === val;
        s += '<option value="' + esc(val) + '"' + (sel ? ' selected' : '') + '>' + esc(alt.texto) + '</option>';
      });
    }
    s += '</select>';
    return s;
  }

  function htmlLinhaQuestao(q, pessoas) {
    var s = '<tr><th scope="row" class="sv3-q">' + htmlEnunciado(q) + '</th>';
    pessoas.forEach(function (nome) {
      s += '<td class="sv3-p' + clsAtiva(nome) + '" data-pessoa="' + esc(nome) + '">' + htmlSelectResposta(q, nome) + '</td>';
    });
    return s + '</tr>';
  }

  function htmlTabela(pessoas) {
    if (!pessoas.length) {
      return '<div class="sv3-vazio">Informe o nome do cliente ou adicione investimentos com proprietários para responder o teste.</div>';
    }
    var cols = pessoas.length + 1;
    var h = [];

    h.push('<div class="sv3-abas" role="tablist" aria-label="Pessoas do teste">');
    pessoas.forEach(function (nome) {
      var on = nome === ativa;
      h.push('<button type="button" class="sv3-aba' + (on ? ' sv3-ativa' : '') + '" role="tab" aria-selected="' + (on ? 'true' : 'false') +
        '" data-pessoa="' + esc(nome) + '">' + esc(nome) +
        '<span class="sv3-contagem" data-pessoa="' + esc(nome) + '">' + esc(textoContagem(nome)) + '</span></button>');
    });
    h.push('</div>');

    // Cabeçalho (Pergunta + uma coluna por pessoa). Com até 2 pessoas o teste sai em DUAS tabelas
    // (bloco A e bloco C), cada uma com o cabeçalho: a partir de 1100px o CSS injetado (.sv3-duas) põe
    // as duas lado a lado; abaixo disso empilham. Com 3+ pessoas as duas não caberiam lado a lado
    // (largura mínima das colunas), então fica UMA tabela, com o cabeçalho uma vez só, como antes.
    // atualizarContagem/aplicarAtiva e a delegação usam querySelectorAll por data-pessoa no container,
    // por isso funcionam com o cabeçalho duplicado.
    var duas = pessoas.length <= 2;
    function cabecalho() {
      var t = '<table class="sv3-tabela"><thead><tr><th scope="col" class="sv3-q">Pergunta</th>';
      pessoas.forEach(function (nome) {
        t += '<th scope="col" class="sv3-p' + clsAtiva(nome) + '" data-pessoa="' + esc(nome) + '">' + esc(nome) +
          '<span class="sv3-contagem" data-pessoa="' + esc(nome) + '">' + esc(textoContagem(nome)) + '</span></th>';
      });
      return t + '</tr></thead><tbody>';
    }

    h.push('<div class="sv3-rolagem' + (duas ? ' sv3-duas' : '') + '">');
    h.push(cabecalho());

    h.push('<tr class="sv3-secao"><th scope="colgroup" colspan="' + cols + '">A · Objetivos (Res. CVM 30, art. 2º, §1º)</th></tr>');
    QUESTOES.forEach(function (q) {
      if (q.bloco === 'A') h.push(htmlLinhaQuestao(q, pessoas));
    });
    if (duas) {
      h.push('</tbody></table>');
      h.push(cabecalho());
    }
    h.push('<tr class="sv3-secao"><th scope="colgroup" colspan="' + cols + '">C · Conhecimento (art. 2º, §3º)</th></tr>');
    QUESTOES.forEach(function (q) {
      if (q.bloco !== 'C') return;
      if (q.tipo !== 'vf') {
        h.push(htmlLinhaQuestao(q, pessoas));
        return;
      }
      h.push('<tr class="sv3-subsecao"><td colspan="' + cols + '">' + htmlEnunciado(q) + '</td></tr>');
      q.afirmacoes.forEach(function (texto, i) {
        var linha = '<tr><th scope="row" class="sv3-q"><span class="sv3-id">' + esc(q.id + '.' + (i + 1)) + '</span>' +
          '<span class="sv3-texto">' + esc(texto) + '</span></th>';
        pessoas.forEach(function (nome) {
          linha += '<td class="sv3-p' + clsAtiva(nome) + '" data-pessoa="' + esc(nome) + '">' + htmlSelectResposta(q, nome, i) + '</td>';
        });
        h.push(linha + '</tr>');
      });
    });

    h.push('</tbody></table></div>');
    return h.join('');
  }

  function htmlResumoB() {
    var v = valoresB();
    var conf = estado.domicilio.confirmacao_b1b2;
    var s = '<dl class="sv3-resumo">' +
      '<div><dt>Renda mensal total do domicílio</dt><dd>' + esc(moeda(v.renda_mensal)) + '</dd></div>' +
      '<div><dt>Patrimônio líquido total (investimentos)</dt><dd>' + esc(moeda(v.patrimonio_liquido)) + '</dd></div>' +
      '<div><dt>Patrimônio físico total (bens)</dt><dd>' + esc(moeda(v.patrimonio_fisico)) + '</dd></div>' +
      '</dl>';
    if (conf.confirmado) {
      s += '<div class="sv3-confirmado">Confirmado em ' + esc(dataHora(conf.em)) +
        ' (receitas ' + esc(moeda(conf.renda_mensal)) +
        ' · patrimônio líquido ' + esc(moeda(conf.patrimonio_liquido)) +
        ' · patrimônio físico ' + esc(moeda(conf.patrimonio_fisico)) + ').</div>';
      var mudou = Math.abs(v.renda_mensal - num(conf.renda_mensal)) > 1 ||
        Math.abs(v.patrimonio_liquido - num(conf.patrimonio_liquido)) > 1 ||
        Math.abs(v.patrimonio_fisico - num(conf.patrimonio_fisico)) > 1;
      if (mudou) {
        s += '<div class="sv3-alerta">Os dados mudaram desde a confirmação: peça ao cliente para confirmar de novo.</div>';
      }
    } else {
      s += '<div class="sv3-pendente">Ainda não confirmado pelo cliente.</div>';
    }
    return s;
  }

  var ITENS_B4 = [
    { rotulo: 'Estágio da reserva', chaves: ['reserva', 'B4_1', 'b4_reserva', 'estagio_reserva', '1'] },
    { rotulo: 'Situação de dívida', chaves: ['divida', 'B4_2', 'b4_divida', 'situacao_divida', '2'] },
    { rotulo: 'Estabilidade da renda', chaves: ['fonte', 'renda', 'B4_3', 'b4_fonte', 'estabilidade_renda', '3'] },
    { rotulo: 'Capacidade de poupança', chaves: ['poupanca', 'B4_4', 'b4_poupanca', 'capacidade_poupanca', '4'] },
    { rotulo: 'Colchão patrimonial', chaves: ['colchao', 'B4_5', 'b4_colchao', 'colchao_patrimonial', '5'] }
  ];

  // Leitura tolerante do item de B4 publicado pelo motor (número, texto ou objeto)
  function lerItemB4(b4, item, i) {
    var bruto;
    if (Array.isArray(b4)) {
      bruto = b4[i];
    } else if (ehObjeto(b4)) {
      for (var k = 0; k < item.chaves.length; k++) {
        if (Object.prototype.hasOwnProperty.call(b4, item.chaves[k])) {
          bruto = b4[item.chaves[k]];
          break;
        }
      }
    }
    if (bruto === undefined || bruto === null) return { pontos: null, descricao: 'não calculado' };
    if (typeof bruto === 'number') return { pontos: isFinite(bruto) ? bruto : null, descricao: '' };
    if (typeof bruto === 'string') return { pontos: null, descricao: bruto };
    if (!ehObjeto(bruto)) return { pontos: null, descricao: '' };
    var pontos = null;
    ['pontos', 'nota', 'score', 'valor'].some(function (c) {
      if (typeof bruto[c] === 'number' && isFinite(bruto[c])) { pontos = bruto[c]; return true; }
      return false;
    });
    var descricao = '';
    ['rotulo', 'texto', 'descricao', 'codigo', 'posicao', 'faixa', 'valor'].some(function (c) {
      if (typeof bruto[c] === 'string' && bruto[c].trim()) { descricao = bruto[c]; return true; }
      return false;
    });
    if (typeof bruto.rendas === 'number' && isFinite(bruto.rendas)) {
      var rendasTxt = (Math.round(bruto.rendas * 10) / 10).toLocaleString('pt-BR') + ' rendas mensais';
      descricao = descricao ? descricao + ' (' + rendasTxt + ')' : rendasTxt;
    }
    return { pontos: pontos, descricao: descricao };
  }

  function textoFaltante(f) {
    if (typeof f === 'string') return f;
    if (ehObjeto(f)) return str(f.campo || f.texto || f.item);
    return '';
  }

  function htmlB4() {
    var s = '<div class="sv3-sub">B4 · Capacidade <span class="sv3-nota">(automático; 5 itens de 0 a 4; nota B = soma × 5)</span></div>';
    var r = resultadoMotor();
    var dom = r && r.perfil_investidor ? r.perfil_investidor.domicilio : null;
    if (!ehObjeto(dom)) {
      return s + '<div class="sv3-pendente">A capacidade aparece aqui depois que o perfil for calculado.</div>';
    }
    var b4 = dom.B4;
    s += '<table class="sv3-b4-tabela"><tbody>';
    ITENS_B4.forEach(function (item, i) {
      var v = lerItemB4(b4, item, i);
      s += '<tr><th scope="row">' + (i + 1) + ' · ' + esc(item.rotulo) + '</th>' +
        '<td>' + esc(v.descricao || '—') + '</td>' +
        '<td class="sv3-pontos">' + (v.pontos === null ? '—' : esc(String(v.pontos)) + '/4') + '</td></tr>';
    });
    s += '</tbody></table>';
    var notaB = dom.nota_B;
    if (typeof notaB === 'number' && isFinite(notaB)) {
      s += '<div class="sv3-nota-b">Nota B: ' + esc(String(Math.round(notaB))) + '/100</div>';
    } else {
      s += '<div class="sv3-nota-b">Nota B: incalculável</div>';
    }
    var falt = arr(dom.faltantes).map(textoFaltante).filter(function (t) { return !!t; });
    if (falt.length) {
      s += '<ul class="sv3-faltantes">' + falt.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    }
    return s;
  }

  function htmlBlocoB() {
    var conf = estado.domicilio.confirmacao_b1b2;
    var qB3 = questao('B3');
    var atualB3 = estado.domicilio.B3;
    var s = '<div class="sv3-bloco-b">';
    s += '<div class="sv3-bloco-titulo">B · Situação financeira (domicílio) <span class="sv3-nota">(art. 2º, §2º)</span></div>';
    s += '<div class="sv3-sub">B1 · Receitas regulares e B2 · Patrimônio <span class="sv3-nota">(importados do diagnóstico; não pontuam)</span></div>';
    s += '<div class="sv3-b-resumo">' + htmlResumoB() + '</div>';
    s += '<label class="sv3-check"><input type="checkbox" data-sv3="confirmar-b1b2"' + (conf.confirmado ? ' checked' : '') + '>' +
      '<span>Confirmo que estes dados refletem minha situação</span></label>';
    s += '<div class="sv3-campo"><label class="sv3-rotulo" for="sv3-b3">' + htmlEnunciado(qB3) + '</label>';
    s += '<select id="sv3-b3" class="sv3-select" data-sv3="b3">';
    s += '<option value="">— responder —</option>';
    qB3.alternativas.forEach(function (alt) {
      s += '<option value="' + esc(alt.valor) + '"' + (atualB3 === alt.valor ? ' selected' : '') + '>' + esc(alt.texto) + '</option>';
    });
    s += '</select></div>';
    s += '<div class="sv3-b4">' + htmlB4() + '</div>';
    s += '</div>';
    return s;
  }

  function htmlResultados(pessoas) {
    if (!pessoas.length) return '';
    var r = resultadoMotor();
    var pp = r && r.perfil_investidor ? r.perfil_investidor.por_pessoa : null;
    var s = '<div class="sv3-bloco-titulo">Resultado por pessoa (memória de cálculo)</div>';
    pessoas.forEach(function (nome) {
      var linhas = linhasMemoria(pp, nome);
      s += '<div class="sv3-resultado" data-pessoa="' + esc(nome) + '"><div class="sv3-resultado-nome">' + esc(nome) + '</div>';
      if (linhas.length) {
        s += '<pre class="sv3-memoria">' + esc(linhas.join('\n')) + '</pre>';
      } else if (ehObjeto(pp)) {
        s += '<div class="sv3-pendente">Sem cálculo para esta pessoa ainda.</div>';
      } else {
        s += '<div class="sv3-pendente">A memória de cálculo aparece aqui depois que o perfil for calculado.</div>';
      }
      s += '</div>';
    });
    return s;
  }

  function assinaturaDoMotor(pessoas) {
    var r = resultadoMotor();
    var pi = r && r.perfil_investidor ? r.perfil_investidor : null;
    var pp = pi ? pi.por_pessoa : null;
    var dom = pi && ehObjeto(pi.domicilio) ? pi.domicilio : null;
    return JSON.stringify({
      memorias: pessoas.map(function (nome) { return linhasMemoria(pp, nome); }),
      temPorPessoa: ehObjeto(pp),
      b4: dom ? { B4: dom.B4 === undefined ? null : dom.B4, nota_B: dom.nota_B === undefined ? null : dom.nota_B, faltantes: arr(dom.faltantes) } : null
    });
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  function render() {
    var c = document.getElementById(ID_CONTAINER);
    if (!c) return; // tenta de novo em 'diagnostico:carregado'
    injetarEstilos();

    var pessoas = listarPessoas();
    ultimaLista = pessoas;
    ultimaListaAssinatura = JSON.stringify(pessoas);
    if (pessoas.indexOf(ativa) < 0) ativa = pessoas.length ? pessoas[0] : '';

    var h = [];
    h.push('<div class="sv3">');
    h.push('<div class="sv3-titulo">Teste de Perfil de Investidor (formato novo)</div>');
    if (window.SUITABILITY_V3_COLUNA_OK === false) {
      h.push('<div class="sv3-faixa sv3-faixa-alerta" role="alert">A coluna do teste novo ainda não foi criada no banco (SQL investimentos-v3). As respostas desta tela não serão salvas até lá.</div>');
    }
    if (temRespostasAntigas()) {
      h.push('<div class="sv3-faixa">Há respostas do teste antigo (formato anterior). Elas continuam guardadas, mas não valem para o perfil novo: responda o teste abaixo.</div>');
    }
    h.push(htmlTabela(pessoas));
    h.push(htmlBlocoB());
    h.push('<div class="sv3-resultados"' + (pessoas.length ? '' : ' hidden') + '>' + htmlResultados(pessoas) + '</div>');
    h.push('</div>');

    c.innerHTML = h.join('');
    ultimoResumoB = htmlResumoB();
    assinaturaMotor = assinaturaDoMotor(pessoas);
    ligarContainer(c);
  }

  function atualizarContagem(c, nome) {
    var els = c.querySelectorAll('.sv3-contagem');
    var txt = textoContagem(nome);
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-pessoa') === nome) els[i].textContent = txt;
    }
  }

  function atualizarResumoB(c) {
    var alvo = c.querySelector('.sv3-b-resumo');
    if (!alvo) return;
    var novo = htmlResumoB();
    if (novo === ultimoResumoB) return;
    ultimoResumoB = novo;
    alvo.innerHTML = novo;
  }

  function aplicarAtiva(c) {
    var els = c.querySelectorAll('.sv3-p, .sv3-aba');
    for (var i = 0; i < els.length; i++) {
      var on = els[i].getAttribute('data-pessoa') === ativa;
      if (on) els[i].classList.add('sv3-ativa');
      else els[i].classList.remove('sv3-ativa');
      if (els[i].classList.contains('sv3-aba')) els[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  // ------------------------------------------------------------
  // Eventos do container (delegação; nomes só em data-pessoa)
  // ------------------------------------------------------------
  function ligarContainer(c) {
    if (c._sv3Ligado) return;
    c._sv3Ligado = true;

    c.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || typeof t.getAttribute !== 'function') return;
      var tipo = t.getAttribute('data-sv3');

      if (tipo === 'resposta') {
        var nome = t.getAttribute('data-pessoa');
        var q = t.getAttribute('data-q');
        if (!nome || !q) return;
        if (!Object.prototype.hasOwnProperty.call(estado.pessoas, nome)) {
          estado.pessoas[nome] = normalizarPessoa(null);
        }
        var p = estado.pessoas[nome];
        var v = t.value;
        if (q === 'C6') {
          var idx = parseInt(t.getAttribute('data-i'), 10);
          if (!(idx >= 0 && idx < 8)) return;
          p.C6[idx] = vfValido(v);
        } else if (q === 'A1' || q === 'A2') {
          p[q] = codigoValido(q, v);
        } else if (q === 'C5') {
          p.C5 = inteiroValido(v, [0, 2, 4]);
        } else if (IDS_ESCALA.indexOf(q) >= 0) {
          p[q] = inteiroValido(v, [0, 1, 2, 3, 4]);
        } else {
          return;
        }
        marcarAtualizado();
        atualizarContagem(c, nome);
        // O 'change' nativo do select borbulha até o document: o motor agenda o recálculo.
        return;
      }

      if (tipo === 'b3') {
        estado.domicilio.B3 = codigoValido('B3', t.value);
        marcarAtualizado();
        return;
      }

      if (tipo === 'confirmar-b1b2') {
        var conf = estado.domicilio.confirmacao_b1b2;
        if (t.checked) {
          var vals = valoresB();
          conf.confirmado = true;
          conf.em = new Date().toISOString();
          conf.renda_mensal = vals.renda_mensal;
          conf.patrimonio_liquido = vals.patrimonio_liquido;
          conf.patrimonio_fisico = vals.patrimonio_fisico;
        } else {
          conf.confirmado = false;
          conf.em = null;
          conf.renda_mensal = null;
          conf.patrimonio_liquido = null;
          conf.patrimonio_fisico = null;
        }
        marcarAtualizado();
        atualizarResumoB(c);
        recalcularMotor();
      }
    });

    c.addEventListener('click', function (e) {
      var t = e.target;
      var aba = t && typeof t.closest === 'function' ? t.closest('.sv3-aba') : null;
      if (!aba || !c.contains(aba)) return;
      ativa = aba.getAttribute('data-pessoa') || '';
      aplicarAtiva(c);
    });
  }

  // ------------------------------------------------------------
  // Atualização da lista de pessoas (debounce 400 ms) e do resumo B
  // ------------------------------------------------------------
  var timerPessoas = null;

  function verificarPessoas() {
    timerPessoas = null;
    var c = document.getElementById(ID_CONTAINER);
    if (!c) return;
    var lista = listarPessoas();
    if (!c.querySelector('.sv3') || JSON.stringify(lista) !== ultimaListaAssinatura) {
      render();
      return;
    }
    atualizarResumoB(c);
  }

  function agendarPessoas(e) {
    var c = document.getElementById(ID_CONTAINER);
    var t = e ? e.target : null;
    if (c && t && t.nodeType === 1 && c.contains(t)) return; // mudanças do próprio teste não mexem na lista
    if (timerPessoas) clearTimeout(timerPessoas);
    timerPessoas = setTimeout(verificarPessoas, 400);
  }

  document.addEventListener('input', agendarPessoas, true);
  document.addEventListener('change', agendarPessoas, true);
  document.addEventListener('click', agendarPessoas, true);

  var diagnosticoCarregado = false;
  document.addEventListener('diagnostico:carregado', function () {
    diagnosticoCarregado = true;
    render();
  });

  // Resultado novo do motor: atualiza B4 e memórias só se mudaram
  document.addEventListener('perfil-financeiro:calculado', function () {
    motorPublicou = true;
    var c = document.getElementById(ID_CONTAINER);
    if (!c || !c.querySelector('.sv3')) return;
    var nova = assinaturaDoMotor(ultimaLista);
    if (nova !== assinaturaMotor) {
      assinaturaMotor = nova;
      var b4 = c.querySelector('.sv3-b4');
      if (b4) b4.innerHTML = htmlB4();
      var res = c.querySelector('.sv3-resultados');
      if (res) res.innerHTML = htmlResultados(ultimaLista);
    }
    atualizarResumoB(c);
  });

  // ------------------------------------------------------------
  // API pública
  // ------------------------------------------------------------
  function getSuitabilityV3Data() {
    return copiaProfunda(estado);
  }

  function setSuitabilityV3Data(obj) {
    var dado = obj;
    if (typeof dado === 'string') {
      try {
        dado = dado.trim() ? JSON.parse(dado) : null;
      } catch (e) {
        dado = null;
      }
    }
    estado = normalizarEstado(dado);
    render();
    if (diagnosticoCarregado) recalcularMotor();
  }

  window.SUITABILITY_V3_ATIVO = true;
  window.getSuitabilityV3Data = getSuitabilityV3Data;
  window.setSuitabilityV3Data = setSuitabilityV3Data;
  window.SuitabilityV3 = {
    QUESTOES: QUESTOES,
    GABARITO_C6: GABARITO_C6,
    render: render,
    pessoas: listarPessoas
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
