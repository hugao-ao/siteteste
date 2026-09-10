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
// ============================================================

(function () {
  'use strict';

  const VERSAO_REGRAS = '2.1.0';

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
    // Classificações de risco que caracterizam instrumento de GUARDA (poupança, CDB, Tesouro Selic...)
    riscos_guarda: ['RISCO_MUITO_BAIXO', 'RISCO_BAIXO'],
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
    const investidor = Object.assign({ ajustado: '', justificativa_consultor: '' }, d.investidor || {});
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
      // sem classificação -> tratar como guarda, não inventar investimento
      return !pl.classificacao_risco || CFG.riscos_guarda.indexOf(str(pl.classificacao_risco)) !== -1;
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
    const reserva_atual = liquidos.filter(ehReserva).reduce(function (s, pl) { return s + num(pl.valor_atual); }, 0);
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
        return { ativo: false, evidencias: ['não definido nesta versão'], faltantes: [], extras: {} };
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

    return {
      perfil_financeiro: {
        calculado: calculado,
        rotulo: rotulo,
        justificativa_auto: justificativa_auto,
        faltantes: faltantes,
        ajustado: ajustado,
        justificativa_consultor: str(ctx.override.observacoes),
        vigente: ajustado || calculado || null,
        dados_complementares: {
          custeio_moradia: str(ctx.complementares.custeio_moradia),
          decide_pelo_objetivo: str(ctx.complementares.decide_pelo_objetivo)
        },
        analise: {
          camada_divida: camada_divida,
          camada_fluxo: camada_fluxo,
          subjacente: subjacente,
          camada_investidor: { status: 'nao_definido_nesta_versao' }
        }
      },
      perfil_investidor: {
        calculado: null,
        ajustado: str(ctx.investidor.ajustado),
        justificativa_consultor: str(ctx.investidor.justificativa_consultor)
      },
      codigo_matriz: {
        codigo: matriz.codigo,
        por_posicao: matriz.por_posicao,
        faltantes: matriz.faltantes
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
        reserva_emergencia: typeof pl.reserva_emergencia === 'boolean' ? pl.reserva_emergencia : str(pl.finalidade) === 'RESERVA_EMERGENCIA'
      };
    });

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
      // chave extra (aditiva): ajuste manual do perfil de investidor, lido do card
      investidor: {
        ajustado: valorDom('pfa-investidor-select'),
        justificativa_consultor: valorDom('pfa-investidor-just')
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

  function opcoesHtml(lista, selecionado) {
    return lista.map(function (o) {
      return '<option value="' + escapar(o.id) + '"' + (str(selecionado) === str(o.id) ? ' selected' : '') + '>' + escapar(o.nome) + '</option>';
    }).join('');
  }

  function montarCard() {
    if (document.getElementById(ID_CARD)) return document.getElementById(ID_CARD);
    const container = document.getElementById('perfil-financeiro-container');
    if (!container || !container.parentNode) return null;

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
        '<div class="pfa-campo">' +
          '<label for="pfa-investidor-select">Ajuste do consultor (perfil de investidor)</label>' +
          '<select id="pfa-investidor-select" name="pfa-investidor-select">' +
            opcoesHtml([{ id: '', nome: '-- Selecione --' }].concat(PERFIS_INVESTIDOR), '') +
          '</select>' +
        '</div>' +
        '<div class="pfa-campo pfa-campo-largo">' +
          '<label for="pfa-investidor-just">Justificativa do consultor</label>' +
          '<textarea id="pfa-investidor-just" name="pfa-investidor-just" rows="2" placeholder="Por que este perfil de investidor?"></textarea>' +
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
    const pi = salvo.perfil_investidor || {};
    if (pi.ajustado !== undefined) setValor('pfa-investidor-select', pi.ajustado);
    if (pi.justificativa_consultor !== undefined) setValor('pfa-investidor-just', pi.justificativa_consultor);
    salvo = null; // aplicado uma vez; daqui em diante valem os inputs do card
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

    const elInv = document.getElementById('pfa-investidor-linha');
    if (elInv) {
      const pi = resultado.perfil_investidor || {};
      let nomeInv = null;
      for (let i = 0; i < PERFIS_INVESTIDOR.length; i++) {
        if (PERFIS_INVESTIDOR[i].id === str(pi.ajustado)) { nomeInv = PERFIS_INVESTIDOR[i].nome; break; }
      }
      elInv.textContent = nomeInv
        ? 'Perfil de investidor: ' + nomeInv + ' (ajustado pelo consultor)'
        : 'Perfil de investidor: a definir';
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
    } catch (e) {
      if (window.console && console.error) console.error('[PerfilFinanceiro] erro ao recalcular:', e);
    }
    return resultado;
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
          if (!dentroDoCard(mutacoes[i].target)) { agendarRecalculo(); return; }
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
    return lista;
  }

  function validarPerfilFinanceiroAntesDeSalvar() {
    const r = recalcular() || ultimoResultado;
    if (!r) return null;
    const pf = r.perfil_financeiro;
    const ajustado = str(pf.ajustado);
    if (!ajustado) return null;
    if (ajustado === pf.calculado) return null;
    if (str(pf.justificativa_consultor).trim()) return null;
    return 'Você ajustou o perfil financeiro para «' + rotuloPerfil(ajustado) + "». Justifique o ajuste em 'Observações - Perfil Financeiro' antes de salvar.";
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
