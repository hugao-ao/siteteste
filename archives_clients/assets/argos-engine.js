// ═══════════════════════════════════════════════════════════════════════════
//  ARGOS ENGINE — Motor de Recomendações Automáticas
//  Arquivo: archives_clients/assets/argos-engine.js
//  Descrição: Lê os dados das ferramentas no Supabase e gera textos de
//             recomendação para cada subtópico do Protocolo Argos.
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://vbikskbfkhundhropykf.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU';

  // Cache dos dados carregados
  var _dadosCache = null;
  var _cacheClienteId = null;

  // ─── UTILITÁRIOS ───────────────────────────────────────────────────────────
  function fmtBRL(v) {
    if (v == null || isNaN(v)) return 'R$ 0,00';
    return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseBR(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
  }

  function pct(v) {
    if (!v) return '0%';
    return parseFloat(v).toFixed(1) + '%';
  }

  // ─── BUSCA DE DADOS ────────────────────────────────────────────────────────
  // Busca TODOS os dados de ferramentas do cliente de uma vez via REST API
  async function carregarDadosCliente(clienteId) {
    if (_cacheClienteId === clienteId && _dadosCache) return _dadosCache;

    var url = SUPABASE_URL + '/rest/v1/ferramentas_dados?cliente_id=eq.' + clienteId + '&select=ferramenta,dados';
    try {
      var resp = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }
      });
      if (!resp.ok) return null;
      var rows = await resp.json();
      var dados = {};
      rows.forEach(function(r) {
        var d = r.dados;
        // Acumulo salva como string JSON
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch(e) { d = null; } }
        dados[r.ferramenta] = d;
      });
      _dadosCache = dados;
      _cacheClienteId = clienteId;
      return dados;
    } catch(e) {
      console.warn('ArgosEngine: erro ao carregar dados', e);
      return null;
    }
  }

  // Limpa o cache (chamar ao trocar de cliente)
  function limparCache() {
    _dadosCache = null;
    _cacheClienteId = null;
  }

  // ─── REGRAS DE RECOMENDAÇÃO ────────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. GESTÃO FINANCEIRA
  // ═══════════════════════════════════════════════════════════════════════════

  // 1.1 Dívidas
  function recDividas(dados) {
    var textos = [];
    // Dados de Juros (Análise de Dívidas)
    var juros = dados.dividas;
    if (juros && juros.dividasAtuais && juros.dividasAtuais.length > 0) {
      var totalSaldo = 0;
      var totalParcela = 0;
      juros.dividasAtuais.forEach(function(d) {
        totalSaldo += (d.saldoDevedor || 0);
        totalParcela += (d.parcela || 0);
      });
      textos.push('O cliente possui ' + juros.dividasAtuais.length + ' dívida(s) ativa(s) com saldo devedor total de ' + fmtBRL(totalSaldo) + ' e comprometimento mensal de ' + fmtBRL(totalParcela) + ' em parcelas.');

      // Se há proposta de migração
      if (juros.dividasProposta && juros.dividasProposta.length > 0) {
        var totalPropostaParcela = 0;
        juros.dividasProposta.forEach(function(d) { totalPropostaParcela += (d.parcela || 0); });
        var economia = totalParcela - totalPropostaParcela;
        if (economia > 0) {
          textos.push('Existe uma proposta de migração que pode reduzir o comprometimento mensal em ' + fmtBRL(economia) + '. Recomenda-se avaliar a viabilidade da troca.');
        }
      }
    }

    // Dados de Patrimônio (dívidas registradas)
    var patri = dados.patrimonio;
    if (patri && patri.datas && patri.datas.length > 0) {
      var ultimaData = patri.datas[patri.datas.length - 1];
      if (ultimaData.dividas && ultimaData.dividas.length > 0) {
        var totalDivPatri = 0;
        ultimaData.dividas.forEach(function(d) { totalDivPatri += (d.saldo || 0); });
        if (!juros || !juros.dividasAtuais || juros.dividasAtuais.length === 0) {
          textos.push('O patrimônio registra ' + ultimaData.dividas.length + ' dívida(s) com saldo total de ' + fmtBRL(totalDivPatri) + '.');
        }
      }
    }

    // Dados de Acompanhamento (evolução)
    var acomp = dados.acompanhamento;
    if (acomp && acomp.reunioes && acomp.reunioes.length >= 2) {
      var sorted = acomp.reunioes.slice().sort(function(a,b) { return a.data.localeCompare(b.data); });
      var primeira = sorted[0];
      var ultima = sorted[sorted.length - 1];
      if (primeira.dividas > 0 && ultima.dividas > 0) {
        var variacao = ultima.dividas - primeira.dividas;
        if (variacao < 0) {
          textos.push('Evolução positiva: as dívidas reduziram ' + fmtBRL(Math.abs(variacao)) + ' desde o início do acompanhamento.');
        } else if (variacao > 0) {
          textos.push('Atenção: as dívidas aumentaram ' + fmtBRL(variacao) + ' desde o início do acompanhamento. Investigar causas.');
        }
      }
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 1.2 Cortes de Gastos
  function recCortesGastos(dados) {
    var fluxo = dados.fluxo;
    if (!fluxo || !fluxo.itens || fluxo.itens.length === 0) return null;

    var textos = [];
    var despesas = fluxo.itens.filter(function(i) { return i.subtipo === 'despesa'; });
    if (despesas.length === 0) return null;

    // Despesas de conforto/supérfluo alteráveis
    var superfluosAlteraveis = despesas.filter(function(i) {
      return i.categoria === 'conforto' && i.alteravel === 'sim';
    });
    if (superfluosAlteraveis.length > 0) {
      var totalSuperfluo = superfluosAlteraveis.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      var nomes = superfluosAlteraveis.slice(0, 5).map(function(i) { return i.nome; }).join(', ');
      textos.push('Identificadas ' + superfluosAlteraveis.length + ' despesa(s) classificada(s) como "Conforto/Supérfluo" e "Alteráveis", totalizando ' + fmtBRL(totalSuperfluo) + ' mensais. Exemplos: ' + nomes + '. Recomenda-se a revisão ou eliminação destas despesas como primeira ação de corte.');
    }

    // Despesas com importância baixa (5, 6, 7) e alteráveis
    var baixaImportancia = despesas.filter(function(i) {
      return parseInt(i.importancia) >= 5 && i.alteravel === 'sim';
    });
    if (baixaImportancia.length > 0) {
      var totalBaixa = baixaImportancia.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      textos.push('Existem ' + baixaImportancia.length + ' despesa(s) com importância "Indiferente" ou inferior que são alteráveis, somando ' + fmtBRL(totalBaixa) + '. Estas são candidatas prioritárias para eliminação.');
    }

    // Despesas de aperfeiçoamento com disposição a alterar
    var aperfDispostas = despesas.filter(function(i) {
      return i.categoria === 'aperfeicoamento' && i.disposto === 'sim';
    });
    if (aperfDispostas.length > 0) {
      var totalAperf = aperfDispostas.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      textos.push('O cliente está disposto a alterar ' + aperfDispostas.length + ' despesa(s) de "Aperfeiçoamento", totalizando ' + fmtBRL(totalAperf) + '. Avaliar redução parcial mantendo o benefício essencial.');
    }

    // Total de economia potencial
    var todosAlteraveis = despesas.filter(function(i) { return i.alteravel === 'sim' && i.disposto === 'sim'; });
    if (todosAlteraveis.length > 0) {
      var totalEconomia = todosAlteraveis.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      textos.push('Potencial máximo de economia mensal (considerando apenas itens alteráveis que o cliente está disposto a mudar): ' + fmtBRL(totalEconomia) + '.');
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 1.3 Aumento de Receita
  function recAumentoReceita(dados) {
    var textos = [];

    var fluxo = dados.fluxo;
    if (fluxo && fluxo.itens) {
      var receitas = fluxo.itens.filter(function(i) { return i.subtipo === 'receita' || i.tipo === 'receita'; });
      var despesas = fluxo.itens.filter(function(i) { return i.subtipo === 'despesa'; });
      var totalReceita = receitas.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      var totalDespesa = despesas.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      var deficit = totalDespesa - totalReceita;
      if (deficit > 0) {
        textos.push('O fluxo de caixa apresenta um déficit mensal de ' + fmtBRL(deficit) + '. Para equilibrar o orçamento sem cortes adicionais, seria necessário aumentar a receita em pelo menos este valor.');
      }
    }

    var acomp = dados.acompanhamento;
    if (acomp && acomp.reunioes && acomp.reunioes.length >= 2) {
      var sorted = acomp.reunioes.slice().sort(function(a,b) { return a.data.localeCompare(b.data); });
      var ultima = sorted[sorted.length - 1];
      var penultima = sorted[sorted.length - 2];
      if (ultima.renda && penultima.renda) {
        var varRenda = ultima.renda - penultima.renda;
        if (varRenda === 0) {
          textos.push('A renda do cliente permaneceu estagnada entre as duas últimas reuniões (' + fmtBRL(ultima.renda) + '). Avaliar possibilidades de aumento: promoção, freelance, renda extra, ou reajuste salarial.');
        } else if (varRenda > 0) {
          textos.push('A renda aumentou ' + fmtBRL(varRenda) + ' entre as duas últimas reuniões. Manter a estratégia atual e direcionar o excedente para os objetivos.');
        }
      }
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. GESTÃO DE RISCO
  // ═══════════════════════════════════════════════════════════════════════════

  // 2.1 Risco de Patrimônio
  function recRiscoPatrimonio(dados) {
    var textos = [];
    var patri = dados.patrimonio;
    if (patri && patri.datas && patri.datas.length > 0) {
      var ultimaData = patri.datas[patri.datas.length - 1];
      var fisicos = ultimaData.ativos_fisicos || [];
      if (fisicos.length > 0) {
        var totalFisico = fisicos.reduce(function(s, a) { return s + (a.valor || 0); }, 0);
        var nomes = fisicos.map(function(a) { return a.nome + ' (' + fmtBRL(a.valor) + ')'; }).join('; ');
        textos.push('O cliente possui ' + fisicos.length + ' ativo(s) físico(s) com valor total estimado de ' + fmtBRL(totalFisico) + ': ' + nomes + '.');
        textos.push('Recomenda-se verificar se todos os bens de alto valor possuem seguro adequado (residencial, auto, etc.) para proteção contra sinistros, roubos e danos.');
      } else {
        textos.push('Não há ativos físicos registrados na ferramenta de Patrimônio. Caso o cliente possua imóveis ou veículos, registrá-los para análise de risco.');
      }
    }
    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 2.2 Risco de Orçamento (Reserva de Emergência)
  function recRiscoOrcamento(dados) {
    var textos = [];

    // Oráculo define a reserva mínima
    var oraculo = dados.oraculo;
    var reservaMinima = 0;
    if (oraculo && oraculo.params) {
      reservaMinima = parseBR(oraculo.params.minReserve);
    }

    // Patrimônio mostra os ativos líquidos
    var patri = dados.patrimonio;
    var totalLiquido = 0;
    if (patri && patri.datas && patri.datas.length > 0) {
      var ultimaData = patri.datas[patri.datas.length - 1];
      var liquidos = ultimaData.ativos_liquidos || [];
      totalLiquido = liquidos.reduce(function(s, a) { return s + (a.valor || 0); }, 0);
    }

    // Fluxo mostra as despesas mensais
    var fluxo = dados.fluxo;
    var despesaMensal = 0;
    if (fluxo && fluxo.itens) {
      var despesas = fluxo.itens.filter(function(i) { return i.subtipo === 'despesa'; });
      despesaMensal = despesas.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
    }

    if (reservaMinima > 0) {
      textos.push('A reserva de segurança mínima definida no Oráculo é de ' + fmtBRL(reservaMinima) + '.');
      if (totalLiquido > 0) {
        if (totalLiquido >= reservaMinima) {
          textos.push('Os ativos líquidos atuais (' + fmtBRL(totalLiquido) + ') já cobrem a reserva mínima. Situação adequada.');
        } else {
          var falta = reservaMinima - totalLiquido;
          textos.push('Os ativos líquidos atuais (' + fmtBRL(totalLiquido) + ') estão ABAIXO da reserva mínima. Faltam ' + fmtBRL(falta) + ' para atingir o patamar de segurança. Priorizar a formação desta reserva antes de outros objetivos.');
        }
      }
    } else if (despesaMensal > 0) {
      var reservaIdeal = despesaMensal * 6;
      textos.push('Com base nas despesas mensais de ' + fmtBRL(despesaMensal) + ', a reserva de emergência ideal (6 meses) seria de ' + fmtBRL(reservaIdeal) + '.');
      if (totalLiquido > 0 && totalLiquido < reservaIdeal) {
        textos.push('Os ativos líquidos atuais (' + fmtBRL(totalLiquido) + ') cobrem apenas ' + Math.round(totalLiquido / despesaMensal) + ' mês(es) de despesas. Recomenda-se completar a reserva.');
      }
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 2.3 Risco de Saúde Básica
  function recRiscoSaudeBasica(dados) {
    var textos = [];
    var fluxo = dados.fluxo;
    if (fluxo && fluxo.itens) {
      var despSaude = fluxo.itens.filter(function(i) {
        return i.subtipo === 'despesa' && i.nome && i.nome.toLowerCase().match(/saude|saúde|plano|unimed|amil|hapvida|sulamerica|médic|medic|hospital|consulta/);
      });
      if (despSaude.length > 0) {
        var totalSaude = despSaude.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
        textos.push('O cliente possui despesas com saúde registradas no fluxo de caixa totalizando ' + fmtBRL(totalSaude) + ' mensais. Verificar se a cobertura é adequada para o perfil familiar.');
      } else {
        textos.push('Não foram identificadas despesas com plano de saúde no fluxo de caixa. Verificar se o cliente possui cobertura de saúde e se está adequada. Caso não possua, avaliar a contratação considerando o perfil de risco.');
      }
    }
    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 2.4 Risco de Doenças Graves e Acidentes
  function recRiscoDoencasGraves(dados) {
    var textos = [];
    var oraculo = dados.oraculo;
    if (oraculo && oraculo.params) {
      var aporteMensal = parseBR(oraculo.params.monthlyContribution);
      var patrimonio = parseBR(oraculo.params.currentWealth);
      if (aporteMensal > 0) {
        textos.push('O cliente depende de aportes mensais de ' + fmtBRL(aporteMensal) + ' para atingir seus objetivos de longo prazo. Caso fique incapacitado temporária ou permanentemente, esses aportes cessariam, comprometendo todo o planejamento.');
        textos.push('Recomenda-se avaliar a contratação de seguro com cobertura para Doenças Graves e DIT (Diária por Incapacidade Temporária) com capital segurado suficiente para manter os aportes por pelo menos 12-24 meses.');
      }
    }

    var acomp = dados.acompanhamento;
    if (acomp && acomp.reunioes && acomp.reunioes.length > 0) {
      var ultima = acomp.reunioes[0]; // já vem ordenado desc
      if (ultima.renda > 0) {
        textos.push('A renda mensal registrada é de ' + fmtBRL(ultima.renda) + '. Em caso de afastamento por doença grave, o impacto financeiro seria significativo. Avaliar seguro de vida com coberturas adicionais.');
      }
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 2.5 Risco da Profissão
  function recRiscoProfissao(dados) {
    var textos = [];
    textos.push('Avaliar o perfil profissional do cliente para identificar riscos específicos da atividade:');
    textos.push('- Profissionais liberais (médicos, advogados, engenheiros): considerar Seguro de Responsabilidade Civil Profissional (RC).');
    textos.push('- Empresários: considerar Seguro Empresarial e Key Man Insurance.');
    textos.push('- CLT: verificar se os benefícios do empregador (seguro de vida em grupo, plano de saúde) são suficientes.');
    textos.push('- Autônomos: maior vulnerabilidade a oscilações de renda — priorizar reserva de emergência robusta (9-12 meses).');

    var acomp = dados.acompanhamento;
    if (acomp && acomp.reunioes && acomp.reunioes.length > 0) {
      var ultima = acomp.reunioes[0];
      if (ultima.resumo) {
        textos.push('\nÚltima observação registrada na reunião: "' + ultima.resumo + '"');
      }
    }

    return textos.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. GESTÃO DE ATIVOS
  // ═══════════════════════════════════════════════════════════════════════════

  // 3.1 Distribuição de Ativos
  function recDistribuicaoAtivos(dados) {
    var textos = [];
    var patri = dados.patrimonio;
    if (patri && patri.datas && patri.datas.length > 0) {
      var ultimaData = patri.datas[patri.datas.length - 1];
      var liquidos = ultimaData.ativos_liquidos || [];
      var fisicos = ultimaData.ativos_fisicos || [];
      var intangiveis = ultimaData.ativos_intangiveis || [];

      var totalLiq = liquidos.reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      var totalFis = fisicos.reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      var totalInt = intangiveis.reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      var totalGeral = totalLiq + totalFis + totalInt;

      if (totalGeral > 0) {
        var pctLiq = ((totalLiq / totalGeral) * 100).toFixed(1);
        var pctFis = ((totalFis / totalGeral) * 100).toFixed(1);
        var pctInt = ((totalInt / totalGeral) * 100).toFixed(1);
        textos.push('Distribuição atual do patrimônio (' + fmtBRL(totalGeral) + ' total):');
        textos.push('• Ativos Líquidos: ' + fmtBRL(totalLiq) + ' (' + pctLiq + '%)');
        textos.push('• Ativos Físicos: ' + fmtBRL(totalFis) + ' (' + pctFis + '%)');
        textos.push('• Ativos Intangíveis: ' + fmtBRL(totalInt) + ' (' + pctInt + '%)');

        if (parseFloat(pctFis) > 70) {
          textos.push('\nAlerta: Alta concentração em ativos físicos (ilíquidos). Recomenda-se diversificar para ativos líquidos para maior flexibilidade e liquidez.');
        }
        if (parseFloat(pctLiq) > 90) {
          textos.push('\nO patrimônio está quase todo em ativos líquidos. Avaliar se há oportunidade de diversificação em imóveis ou outros ativos reais para proteção contra inflação.');
        }
      }

      // Concentração por instituição
      if (liquidos.length > 1) {
        var porInst = {};
        liquidos.forEach(function(a) {
          var inst = a.instituicao_nome || 'Sem instituição';
          porInst[inst] = (porInst[inst] || 0) + (a.valor || 0);
        });
        var instArr = Object.entries(porInst).sort(function(a, b) { return b[1] - a[1]; });
        if (instArr.length > 0 && totalLiq > 0) {
          var maiorInst = instArr[0];
          var pctMaior = ((maiorInst[1] / totalLiq) * 100).toFixed(1);
          if (parseFloat(pctMaior) > 60) {
            textos.push('\nConcentração: ' + pctMaior + '% dos ativos líquidos estão em "' + maiorInst[0] + '". Considerar diversificar entre instituições para reduzir risco de contraparte.');
          }
        }
      }
    }

    return textos.length > 0 ? textos.join('\n') : null;
  }

  // 3.2 Aportes Mensais
  function recAportesMensais(dados) {
    var textos = [];

    // Oráculo define o aporte planejado
    var oraculo = dados.oraculo;
    var aportePlanejado = 0;
    if (oraculo && oraculo.params) {
      aportePlanejado = parseBR(oraculo.params.monthlyContribution);
      if (aportePlanejado > 0) {
        textos.push('Aporte mensal planejado no Oráculo: ' + fmtBRL(aportePlanejado) + '.');
      }
    }

    // Fluxo mostra a capacidade real de poupança
    var fluxo = dados.fluxo;
    if (fluxo && fluxo.itens) {
      var receitas = fluxo.itens.filter(function(i) { return i.subtipo === 'receita' || i.tipo === 'receita'; });
      var despesas = fluxo.itens.filter(function(i) { return i.subtipo === 'despesa'; });
      var totalReceita = receitas.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      var totalDespesa = despesas.reduce(function(s, i) { return s + (i.valor || 0); }, 0);
      var sobra = totalReceita - totalDespesa;

      if (sobra > 0) {
        textos.push('Capacidade real de poupança (receitas - despesas no Fluxo de Caixa): ' + fmtBRL(sobra) + ' mensais.');
        if (aportePlanejado > 0 && sobra < aportePlanejado) {
          var gap = aportePlanejado - sobra;
          textos.push('ATENÇÃO: O aporte planejado (' + fmtBRL(aportePlanejado) + ') é MAIOR que a sobra real (' + fmtBRL(sobra) + '). Gap de ' + fmtBRL(gap) + '. Necessário cortar despesas ou aumentar receita para viabilizar o plano.');
        } else if (aportePlanejado > 0 && sobra >= aportePlanejado) {
          textos.push('A sobra mensal é suficiente para cobrir o aporte planejado. Manter a disciplina de investimento.');
        }
      } else if (sobra <= 0) {
        textos.push('O fluxo de caixa apresenta déficit de ' + fmtBRL(Math.abs(sobra)) + '. Não há capacidade de aporte no momento. Priorizar o equilíbrio orçamentário antes de investir.');
      }
    }

    // Acúmulo mostra os aportes configurados
    var acumulo = dados.acumulo;
    if (acumulo && Array.isArray(acumulo) && acumulo.length > 0) {
      var ultimaSim = acumulo[acumulo.length - 1];
      if (ultimaSim.aportes && ultimaSim.aportes.length > 0) {
        var totalAporteAcumulo = ultimaSim.aportes.reduce(function(s, a) { return s + (parseBR(a.valor) || 0); }, 0);
        textos.push('No Simulador de Acúmulo, os aportes configurados totalizam ' + fmtBRL(totalAporteAcumulo) + ' (considerando a última simulação salva).');
      }
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  4. LONGO PRAZO E PÓS APOSENTADORIA
  // ═══════════════════════════════════════════════════════════════════════════

  // 4.1 Acúmulo Mais Vantajoso
  function recAcumuloVantajoso(dados) {
    var textos = [];
    var acumulo = dados.acumulo;
    if (acumulo && Array.isArray(acumulo) && acumulo.length > 0) {
      var ultimaSim = acumulo[acumulo.length - 1];
      if (ultimaSim.veiculos && ultimaSim.veiculos.length > 0) {
        var tipos = ultimaSim.veiculos.map(function(v) { return v.tipo; });
        var temPGBL = tipos.indexOf('PGBL') >= 0;
        var temVGBL = tipos.indexOf('VGBL') >= 0;
        var temCarteira = tipos.indexOf('CARTEIRA') >= 0;

        textos.push('Na última simulação de acúmulo ("' + (ultimaSim.nome || 'Sem nome') + '"), foram comparados: ' + tipos.join(', ') + '.');
        textos.push('Prazo da simulação: ' + (ultimaSim.prazo || 120) + ' meses.');

        if (temPGBL && temCarteira) {
          textos.push('A comparação entre PGBL e Carteira Livre permite avaliar se o benefício fiscal do PGBL (dedução de até 12% da renda bruta no IR) compensa as taxas de carregamento e administração no longo prazo.');
        }
        if (temVGBL) {
          textos.push('O VGBL é indicado para quem faz declaração simplificada ou já atingiu o limite de 12% com PGBL. Avaliar se a tributação regressiva (10% após 10 anos) é mais vantajosa que a tributação de renda fixa na carteira livre (15-22,5%).');
        }

        textos.push('\nRecomendação: Executar o cálculo na ferramenta de Acúmulo e verificar qual veículo gera o maior montante líquido ao final do prazo. Inserir aqui o resultado exato após a simulação.');
      }
    } else {
      textos.push('Nenhuma simulação de acúmulo foi salva ainda. Recomenda-se criar uma simulação comparando PGBL, VGBL e Carteira Livre com os mesmos aportes para identificar o veículo mais vantajoso para o perfil tributário do cliente.');
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 4.2 Análise (Projeção de Patrimônio)
  function recAnalise(dados) {
    var textos = [];
    var oraculo = dados.oraculo;
    if (oraculo && oraculo.params) {
      var patrimonio = parseBR(oraculo.params.currentWealth);
      var aporte = parseBR(oraculo.params.monthlyContribution);
      var taxa = parseFloat(oraculo.params.interestRate) || 0;
      var inflacao = parseFloat(oraculo.params.inflationRate) || 0;
      var prazoVal = parseInt(oraculo.params.projectionValue) || 30;
      var prazoUnit = oraculo.params.projectionUnit || 'years';
      var prazoMeses = prazoUnit === 'years' ? prazoVal * 12 : prazoVal;
      var taxaIR = parseFloat(oraculo.params.taxRate) || 15;

      textos.push('Parâmetros do Oráculo Financeiro:');
      textos.push('• Patrimônio atual: ' + fmtBRL(patrimonio));
      textos.push('• Aporte mensal: ' + fmtBRL(aporte));
      textos.push('• Rentabilidade anual esperada: ' + pct(taxa));
      textos.push('• Inflação anual: ' + pct(inflacao));
      textos.push('• IR sobre rendimentos: ' + pct(taxaIR));
      textos.push('• Prazo de projeção: ' + prazoVal + (prazoUnit === 'years' ? ' anos' : ' meses'));

      // Cálculo simplificado de projeção
      var taxaMensalBruta = Math.pow(1 + taxa / 100, 1/12) - 1;
      var taxaMensalLiq = taxaMensalBruta * (1 - taxaIR / 100);
      var montante = patrimonio;
      for (var m = 0; m < prazoMeses; m++) {
        montante = montante * (1 + taxaMensalLiq) + aporte;
      }
      textos.push('\nProjeção simplificada do patrimônio ao final do prazo: ' + fmtBRL(montante) + ' (valor nominal, sem descontar inflação).');

      // Renda passiva estimada
      var rendaMensal = montante * taxaMensalLiq;
      textos.push('Renda mensal passiva estimada (sem consumir o principal): ' + fmtBRL(rendaMensal) + '.');

      // Objetivos
      if (oraculo.goals && oraculo.goals.length > 0) {
        textos.push('\nObjetivos de vida cadastrados: ' + oraculo.goals.length);
        oraculo.goals.forEach(function(g) {
          textos.push('• ' + (g.name || g.nome || 'Sem nome') + ': ' + fmtBRL(parseBR(g.value || g.valor)) + ' em ' + (g.time || g.prazo || '?') + ' ' + (g.timeUnit === 'months' ? 'meses' : 'anos'));
        });
      }
    } else {
      textos.push('Nenhuma simulação foi configurada no Oráculo Financeiro. Recomenda-se preencher os parâmetros de patrimônio atual, aporte mensal, rentabilidade e prazo para gerar a projeção de longo prazo.');
    }

    return textos.length > 0 ? textos.join('\n') : null;
  }

  // 4.3 Conclusão
  function recConclusao(dados) {
    var textos = [];
    var oraculo = dados.oraculo;
    if (oraculo && oraculo.params) {
      var patrimonio = parseBR(oraculo.params.currentWealth);
      var aporte = parseBR(oraculo.params.monthlyContribution);
      var taxa = parseFloat(oraculo.params.interestRate) || 0;

      if (aporte > 0 && taxa > 0) {
        textos.push('Com os parâmetros atuais do Oráculo, o plano de acumulação está em andamento.');

        // Verificar se os objetivos são viáveis
        if (oraculo.goals && oraculo.goals.length > 0) {
          var totalObjetivos = oraculo.goals.reduce(function(s, g) { return s + parseBR(g.value || g.valor); }, 0);
          textos.push('O valor total dos objetivos de vida é de ' + fmtBRL(totalObjetivos) + '.');
          textos.push('Recomenda-se executar a simulação completa no Oráculo para verificar se todos os objetivos são realizáveis dentro do prazo, ou se é necessário priorizar/adiar algum deles.');
        }
      }

      if (aporte === 0) {
        textos.push('ALERTA: Nenhum aporte mensal configurado. Sem aportes regulares, o patrimônio atual dependerá exclusivamente dos rendimentos para crescer, o que pode ser insuficiente para atingir os objetivos de longo prazo.');
      }
    }

    // Simulador financeiro
    var simulador = dados.simulador;
    if (simulador && simulador.simulacoes && simulador.simulacoes.length > 0) {
      textos.push('\nO Simulador Financeiro possui ' + simulador.simulacoes.length + ' simulação(ões) de cenários de aquisição. Verificar se os cenários simulados são compatíveis com a capacidade de poupança real.');
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  5. PLANEJAMENTO TRIBUTÁRIO
  // ═══════════════════════════════════════════════════════════════════════════

  // 5.1 Forma de Recebimento
  function recFormaRecebimento(dados) {
    var textos = [];
    var ir = dados.ir;
    if (ir && ir.simulacoes && ir.simulacoes.length > 0) {
      var ultimaSim = ir.simulacoes[ir.simulacoes.length - 1];
      var rendaMensal = ultimaSim.rendaMensal || 0;
      var rendaAnual = rendaMensal * 12 + (ultimaSim.decimoTerceiro || 0) + (ultimaSim.outrasRendas || 0);

      textos.push('Renda bruta anual estimada: ' + fmtBRL(rendaAnual) + ' (base: ' + fmtBRL(rendaMensal) + '/mês + 13º + outras rendas).');

      if (rendaMensal > 0) {
        // Faixa de IR
        if (rendaAnual > 600000) {
          textos.push('Com renda anual acima de R$ 600.000, avaliar se a constituição de Pessoa Jurídica (Lucro Presumido ou Simples Nacional) pode reduzir a carga tributária efetiva comparada à tributação como Pessoa Física (alíquota marginal de 27,5%).');
        } else if (rendaAnual > 120000) {
          textos.push('Renda na faixa de tributação elevada (27,5%). Avaliar estratégias de otimização: maximizar deduções legais, PGBL, e verificar se há possibilidade de receber parte como PJ.');
        }
      }
    } else {
      textos.push('Nenhuma simulação de IR foi salva. Recomenda-se preencher os dados do contribuinte na ferramenta de IR para análise da forma de recebimento mais eficiente.');
    }

    return textos.length > 0 ? textos.join('\n\n') : null;
  }

  // 5.2 Forma de Declaração
  function recFormaDeclaracao(dados) {
    var textos = [];
    var ir = dados.ir;
    if (ir && ir.simulacoes && ir.simulacoes.length > 0) {
      var ultimaSim = ir.simulacoes[ir.simulacoes.length - 1];
      var tipo = ultimaSim.tipoDecAtual || 'nenhuma';
      var rendaMensal = ultimaSim.rendaMensal || 0;
      var rendaAnual = rendaMensal * 12 + (ultimaSim.decimoTerceiro || 0) + (ultimaSim.outrasRendas || 0);

      // Cálculo simplificado: desconto simplificado = 20% da renda, limitado a R$ 16.754,34
      var descontoSimplificado = Math.min(rendaAnual * 0.20, 16754.34);

      // Total de deduções na completa
      var totalDeducoes = (ultimaSim.dedSaude || 0) + (ultimaSim.dedEducacao || 0) + (ultimaSim.dedPensao || 0) + (ultimaSim.dedINSSAnual || 0) + (ultimaSim.dedOutras || 0) + (ultimaSim.pgblAtual || 0) + (ultimaSim.nDep || 0) * 2275.08;

      textos.push('Análise Simplificada vs. Completa:');
      textos.push('• Desconto simplificado (20%, limitado): ' + fmtBRL(descontoSimplificado));
      textos.push('• Total de deduções na completa: ' + fmtBRL(totalDeducoes));

      if (totalDeducoes > descontoSimplificado) {
        var economia = totalDeducoes - descontoSimplificado;
        textos.push('\nA declaração COMPLETA é mais vantajosa. As deduções reais (' + fmtBRL(totalDeducoes) + ') superam o desconto simplificado em ' + fmtBRL(economia) + '.');
      } else {
        var econSimp = descontoSimplificado - totalDeducoes;
        textos.push('\nA declaração SIMPLIFICADA é mais vantajosa. O desconto de 20% supera as deduções reais em ' + fmtBRL(econSimp) + '.');
      }

      textos.push('\nRecomendação: Executar o cálculo completo na ferramenta de IR para obter os valores exatos de imposto a pagar/restituir em cada modalidade.');
    }

    return textos.length > 0 ? textos.join('\n') : null;
  }

  // 5.3 Sobre PGBL ou Não
  function recPGBL(dados) {
    var textos = [];
    var ir = dados.ir;
    if (ir && ir.simulacoes && ir.simulacoes.length > 0) {
      var ultimaSim = ir.simulacoes[ir.simulacoes.length - 1];
      var rendaMensal = ultimaSim.rendaMensal || 0;
      var rendaAnual = rendaMensal * 12 + (ultimaSim.decimoTerceiro || 0) + (ultimaSim.outrasRendas || 0);
      var maxPGBL = rendaAnual * 0.12;
      var pgblAtual = ultimaSim.pgblAtual || 0;
      var faltaPGBL = Math.max(0, maxPGBL - pgblAtual);

      textos.push('Limite de dedução PGBL (12% da renda bruta tributável anual):');
      textos.push('• Renda bruta anual: ' + fmtBRL(rendaAnual));
      textos.push('• Máximo dedutível em PGBL: ' + fmtBRL(maxPGBL) + ' (' + fmtBRL(maxPGBL / 12) + '/mês)');
      textos.push('• PGBL já aportado: ' + fmtBRL(pgblAtual));

      if (faltaPGBL > 0) {
        textos.push('\nAinda há espaço para aportar mais ' + fmtBRL(faltaPGBL) + ' em PGBL neste ano-base (' + fmtBRL(faltaPGBL / 12) + '/mês nos meses restantes).');
        // Economia estimada
        var economiaIR = faltaPGBL * 0.275; // alíquota marginal máxima
        textos.push('Economia potencial no IR (alíquota marginal 27,5%): até ' + fmtBRL(economiaIR) + ' de restituição adicional.');
      } else if (pgblAtual >= maxPGBL) {
        textos.push('\nO limite de PGBL já foi atingido. Aportes adicionais não terão benefício fiscal. Considerar VGBL para aportes excedentes (sem dedução, mas com tributação regressiva sobre o rendimento).');
      }

      // Verificar se faz sentido usar PGBL (precisa ser declaração completa)
      var totalDeducoes = (ultimaSim.dedSaude || 0) + (ultimaSim.dedEducacao || 0) + (ultimaSim.dedPensao || 0) + (ultimaSim.dedINSSAnual || 0) + (ultimaSim.dedOutras || 0) + maxPGBL + (ultimaSim.nDep || 0) * 2275.08;
      var descontoSimplificado = Math.min(rendaAnual * 0.20, 16754.34);

      if (totalDeducoes < descontoSimplificado) {
        textos.push('\nATENÇÃO: Mesmo com PGBL no limite máximo, a declaração simplificada pode ser mais vantajosa. Verificar na ferramenta de IR se o PGBL realmente compensa neste caso.');
      }
    } else {
      textos.push('Nenhuma simulação de IR foi salva. Para avaliar se o PGBL é vantajoso, é necessário preencher a renda bruta e deduções na ferramenta de IR.');
    }

    return textos.length > 0 ? textos.join('\n') : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  6. PLANEJAMENTO SUCESSÓRIO
  // ═══════════════════════════════════════════════════════════════════════════

  // 6.1 Patrimônio Estimado
  function recPatrimonioEstimado(dados) {
    var textos = [];

    // Patrimônio atual
    var patri = dados.patrimonio;
    var totalAtual = 0;
    if (patri && patri.datas && patri.datas.length > 0) {
      var ultimaData = patri.datas[patri.datas.length - 1];
      var liq = (ultimaData.ativos_liquidos || []).reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      var fis = (ultimaData.ativos_fisicos || []).reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      var intg = (ultimaData.ativos_intangiveis || []).reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      var div = (ultimaData.dividas || []).reduce(function(s, d) { return s + (d.saldo || 0); }, 0);
      totalAtual = liq + fis + intg - div;
      textos.push('Patrimônio líquido atual (Ferramenta Patrimônio): ' + fmtBRL(totalAtual));
      textos.push('• Ativos Líquidos: ' + fmtBRL(liq));
      textos.push('• Ativos Físicos: ' + fmtBRL(fis));
      textos.push('• Ativos Intangíveis: ' + fmtBRL(intg));
      textos.push('• Dívidas: -' + fmtBRL(div));
    }

    // Projeção futura via Oráculo
    var oraculo = dados.oraculo;
    if (oraculo && oraculo.params) {
      var patrimonio = parseBR(oraculo.params.currentWealth);
      var aporte = parseBR(oraculo.params.monthlyContribution);
      var taxa = parseFloat(oraculo.params.interestRate) || 0;
      var prazoVal = parseInt(oraculo.params.projectionValue) || 30;
      var prazoUnit = oraculo.params.projectionUnit || 'years';
      var prazoMeses = prazoUnit === 'years' ? prazoVal * 12 : prazoVal;
      var taxaIR = parseFloat(oraculo.params.taxRate) || 15;

      var taxaMensalLiq = (Math.pow(1 + taxa / 100, 1/12) - 1) * (1 - taxaIR / 100);
      var montante = patrimonio;
      for (var m = 0; m < prazoMeses; m++) { montante = montante * (1 + taxaMensalLiq) + aporte; }

      textos.push('\nPatrimônio projetado ao final do prazo (' + prazoVal + (prazoUnit === 'years' ? ' anos' : ' meses') + '): ' + fmtBRL(montante));

      // Custos estimados de inventário
      var itcmd = montante * 0.04; // 4% média ITCMD
      var honorarios = montante * 0.05; // 5% honorários advocatícios
      var custas = montante * 0.01; // 1% custas judiciais
      var totalCusto = itcmd + honorarios + custas;
      textos.push('\nCustos estimados de inventário judicial sobre o patrimônio projetado:');
      textos.push('• ITCMD (4%): ' + fmtBRL(itcmd));
      textos.push('• Honorários advocatícios (5%): ' + fmtBRL(honorarios));
      textos.push('• Custas judiciais (1%): ' + fmtBRL(custas));
      textos.push('• TOTAL estimado: ' + fmtBRL(totalCusto) + ' (' + ((totalCusto / montante) * 100).toFixed(1) + '% do patrimônio)');
    }

    return textos.length > 0 ? textos.join('\n') : null;
  }

  // 6.2 Soluções Possíveis
  function recSolucoesSucessorias(dados) {
    var textos = [];

    var patri = dados.patrimonio;
    var temImoveis = false;
    var totalFisico = 0;
    if (patri && patri.datas && patri.datas.length > 0) {
      var ultimaData = patri.datas[patri.datas.length - 1];
      var fisicos = ultimaData.ativos_fisicos || [];
      totalFisico = fisicos.reduce(function(s, a) { return s + (a.valor || 0); }, 0);
      temImoveis = fisicos.length > 0;
    }

    textos.push('Soluções de planejamento sucessório a considerar:');
    textos.push('');

    if (temImoveis) {
      textos.push('1. HOLDING FAMILIAR: Com ativos físicos de ' + fmtBRL(totalFisico) + ', avaliar a constituição de holding patrimonial para facilitar a transferência de cotas (evita inventário de imóveis).');
      textos.push('');
    }

    textos.push((temImoveis ? '2' : '1') + '. PREVIDÊNCIA PRIVADA (VGBL): Recursos em VGBL não entram em inventário e são liberados rapidamente aos beneficiários. Ideal para garantir liquidez imediata à família.');
    textos.push('');
    textos.push((temImoveis ? '3' : '2') + '. SEGURO DE VIDA: Capital segurado é pago diretamente aos beneficiários, sem inventário e sem ITCMD. Pode ser dimensionado para cobrir os custos de inventário dos demais bens.');
    textos.push('');
    textos.push((temImoveis ? '4' : '3') + '. DOAÇÃO EM VIDA COM RESERVA DE USUFRUTO: Transferir bens aos herdeiros em vida, mantendo o direito de uso. Reduz a base de cálculo do inventário futuro.');
    textos.push('');
    textos.push((temImoveis ? '5' : '4') + '. TESTAMENTO: Mesmo com planejamento, recomenda-se ter testamento para definir a distribuição dos bens disponíveis (50% do patrimônio) e evitar conflitos familiares.');

    return textos.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAPA DE SUBTÓPICOS → FUNÇÕES
  // ═══════════════════════════════════════════════════════════════════════════
  var MAPA_REGRAS = {
    'GESTÃO FINANCEIRA': {
      'Dívidas': recDividas,
      'Cortes de Gastos': recCortesGastos,
      'Aumento de Receita': recAumentoReceita
    },
    'GESTÃO DE RISCO': {
      'Risco de Patrimônio': recRiscoPatrimonio,
      'Risco de Orçamento': recRiscoOrcamento,
      'Risco de Saúde Básica': recRiscoSaudeBasica,
      'Risco de Doenças Graves e Acidentes': recRiscoDoencasGraves,
      'Risco da Profissão': recRiscoProfissao
    },
    'GESTÃO DE ATIVOS': {
      'Distribuição de Ativos': recDistribuicaoAtivos,
      'Aportes Mensais': recAportesMensais
    },
    'LONGO PRAZO E PÓS APOSENTADORIA': {
      'Acúmulo Mais Vantajoso': recAcumuloVantajoso,
      'Análise': recAnalise,
      'Conclusão': recConclusao
    },
    'PLANEJAMENTO TRIBUTÁRIO': {
      'Forma de Recebimento': recFormaRecebimento,
      'Forma de Declaração': recFormaDeclaracao,
      'Sobre PGBL ou Não': recPGBL
    },
    'PLANEJAMENTO SUCESSÓRIO': {
      'Patrimônio Estimado': recPatrimonioEstimado,
      'Soluções Possíveis': recSolucoesSucessorias
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  FUNÇÃO PRINCIPAL (exposta globalmente)
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Gera uma recomendação automática para o subtópico especificado.
   * @param {string} topico - Nome do tópico (ex: 'GESTÃO FINANCEIRA')
   * @param {string} subtopico - Nome do subtópico (ex: 'Dívidas')
   * @returns {Promise<string|null>} - Texto da recomendação ou null se não há dados
   */
  async function gerarRecomendacaoAutomatica(topico, subtopico) {
    var clienteId = sessionStorage.getItem('cliente_id');
    if (!clienteId) return 'Erro: cliente não identificado.';

    var dados = await carregarDadosCliente(clienteId);
    if (!dados) return 'Erro: não foi possível carregar os dados das ferramentas.';

    var topicoMap = MAPA_REGRAS[topico];
    if (!topicoMap) return 'Nenhuma regra configurada para o tópico "' + topico + '".';

    var funcao = topicoMap[subtopico];
    if (!funcao) return 'Nenhuma regra configurada para o subtópico "' + subtopico + '".';

    try {
      var resultado = funcao(dados);
      if (!resultado) return 'Não há dados suficientes nas ferramentas para gerar uma recomendação automática para "' + subtopico + '". Preencha as ferramentas relacionadas primeiro.';
      return resultado;
    } catch(e) {
      console.error('ArgosEngine: erro ao gerar recomendação', e);
      return 'Erro ao processar os dados: ' + e.message;
    }
  }

  // Expor globalmente
  window.ArgosEngine = {
    gerar: gerarRecomendacaoAutomatica,
    limparCache: limparCache,
    carregarDados: carregarDadosCliente
  };

})();
