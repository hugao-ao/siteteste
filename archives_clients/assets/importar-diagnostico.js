// ========================================
// IMPORTAR DIAGNÓSTICO - Script Compartilhado
// ========================================
// Este script é incluído em cada ferramenta do cliente e fornece
// a funcionalidade de importar dados do diagnóstico financeiro.
// Deve ser carregado APÓS o Supabase CDN.

(function() {
  'use strict';

  const SUPABASE_URL = 'https://vbikskbfkhundhropykf.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU';

  // Detecta o slug da ferramenta atual pela URL ou variável global
  function detectarFerramenta() {
    const path = window.location.pathname;
    const filename = path.split('/').pop().replace('.html', '');
    return filename;
  }

  // Obtém o cliente_id do sessionStorage
  function getClienteId() {
    return sessionStorage.getItem('cliente_id');
  }

  // Busca o diagnóstico do cliente no Supabase
  async function buscarDiagnostico() {
    const clienteId = getClienteId();
    if (!clienteId) {
      console.warn('[ImportarDiag] cliente_id não encontrado no sessionStorage');
      return null;
    }

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/diagnosticos_financeiros?cliente_id=eq.${clienteId}&order=updated_at.desc&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (!data || data.length === 0) {
        return null;
      }

      // Parsear campos que são salvos como JSON string no banco
      const diag = data[0];
      const camposJson = [
        'dividas', 'produtos_protecao', 'patrimonios_liquidos', 'patrimonios',
        'declaracoes_ir', 'dados_sucessao', 'contas_cartoes', 'objetivos',
        'fluxo_caixa', 'pessoas_renda', 'dependentes'
      ];
      camposJson.forEach(campo => {
        if (diag[campo] && typeof diag[campo] === 'string') {
          try {
            diag[campo] = JSON.parse(diag[campo]);
          } catch (e) {
            console.warn(`[ImportarDiag] Falha ao parsear campo ${campo}:`, e);
          }
        }
      });

      return diag;
    } catch (err) {
      console.error('[ImportarDiag] Erro ao buscar diagnóstico:', err);
      return null;
    }
  }

  // ========================================
  // MAPEADORES: Convertem dados do diagnóstico para o formato da ferramenta
  // ========================================

  const MAPEADORES = {
    // JUROS: Importa dívidas do diagnóstico
    juros: function(diag) {
      const dividas = diag.dividas || [];
      if (dividas.length === 0) return { items: [], mensagem: 'Nenhuma dívida encontrada no diagnóstico.' };

      const items = dividas.map(d => ({
        nome: d.motivo || d.credor || 'Dívida importada',
        valorContratado: d.valor_inicial || 0,
        parcela: d.valor_parcela || 0,
        totalParcelas: d.prazo || 0,
        parcelasPagas: d.parcelas_pagas || 0,
        saldoDevedor: d.saldo_devedor || 0,
        tipoAmort: d.tipo_amortizacao || 'price',
        reajusteAnual: d.reajuste_anual || 0,
        taxaFixa: d.taxa_juros || 0,
        taxaTipo: d.taxa_juros_tipo || 'anual'
      }));

      return { items, mensagem: `${items.length} dívida(s) encontrada(s) no diagnóstico.` };
    },

    // FLUXO: Importa receitas e despesas do diagnóstico
    fluxo: function(diag) {
      const anoVigente = new Date().getFullYear();
      const fluxoData = diag.fluxo_caixa || {};
      let receitas = fluxoData.receitas || [];
      let despesas = fluxoData.despesas || [];
      if (!Array.isArray(receitas)) receitas = Object.values(receitas);
      if (!Array.isArray(despesas)) despesas = Object.values(despesas);

      // Mapear und_recorrencia do diagnóstico para recTipo da ferramenta
      function mapRecTipo(und) {
        const map = { dia: 'dias', semana: 'semanas', mes: 'meses', ano: 'meses' };
        return map[und] || 'meses';
      }
      // Mapear qtd_recorrencia considerando que 'ano' no diagnóstico = 12 meses na ferramenta
      function mapRecQty(qtd, und) {
        if (und === 'ano') return 12; // anual = a cada 12 meses
        return qtd || 1;
      }
      // Determinar se é anual
      function isAnual(und) { return und === 'ano'; }

      // === RECEITAS (entradas) ===
      const itemsReceita = receitas.filter(r => !r.automatica).map(r => {
        const anual = isAnual(r.und_recorrencia);
        const dataInicio = anual ? `${anoVigente}-12-01` : `${anoVigente}-01-01`;
        return {
          nome: r.nome || 'Receita importada',
          valor: r.valor || 0,
          tipo: 'entrada',
          subtipo: '',
          categoria: '',
          alteravel: 'nao',
          disposto: 'nao',
          importancia: '5',
          conforto: '3',
          formaPagamento: '',
          usarComoComplemento: false,
          recTipo: mapRecTipo(r.und_recorrencia),
          recQty: mapRecQty(r.qtd_recorrencia, r.und_recorrencia),
          recInicio: dataInicio,
          recFimTipo: 'nunca',
          recFimQty: '',
          recFimData: '',
          titular: r.titular || ''
        };
      });

      // === DESPESAS (saídas - poupança) ===
      // Identificar aportes/investimentos como poupança
      const patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      const itemsPoupanca = [];
      const plArray = Array.isArray(patrimoniosLiquidos) ? patrimoniosLiquidos : Object.values(patrimoniosLiquidos);
      plArray.forEach(pl => {
        const aporteValor = parseFloat(pl.aporte_valor) || 0;
        const aporteFreq = pl.aporte_frequencia || 'NENHUM';
        if (aporteValor > 0 && aporteFreq !== 'NENHUM') {
          const anual = aporteFreq === 'ANUAL';
          const dataInicio = anual ? `${anoVigente}-12-20` : `${anoVigente}-01-20`;
          const nomeProd = pl.nome_produto_customizado || pl.tipo_produto_nome || 'Investimento';
          const inst = pl.instituicao_nome || '';
          itemsPoupanca.push({
            nome: `Aporte - ${nomeProd}${inst ? ' (' + inst + ')' : ''}`,
            valor: aporteValor,
            tipo: 'saida',
            subtipo: 'poupanca',
            categoria: '',
            alteravel: 'nao',
            disposto: 'nao',
            importancia: '5',
            conforto: '3',
            formaPagamento: '',
            usarComoComplemento: false,
            recTipo: anual ? 'meses' : 'meses',
            recQty: anual ? 12 : 1,
            recInicio: dataInicio,
            recFimTipo: 'nunca',
            recFimQty: '',
            recFimData: '',
            titular: ''
          });
        }
      });

      // === DESPESAS (saídas - despesas) ===
      const itemsDespesa = despesas.filter(d => !d.automatica).map(d => {
        const anual = isAnual(d.und_recorrencia);
        const dataInicio = anual ? `${anoVigente}-12-20` : `${anoVigente}-01-20`;
        return {
          nome: d.nome || 'Despesa importada',
          valor: d.valor || 0,
          tipo: 'saida',
          subtipo: 'despesa',
          categoria: 'sobrevivencia',
          alteravel: 'nao',
          disposto: 'nao',
          importancia: '5',
          conforto: '3',
          formaPagamento: d.forma_pagamento || '',
          usarComoComplemento: false,
          recTipo: mapRecTipo(d.und_recorrencia),
          recQty: mapRecQty(d.qtd_recorrencia, d.und_recorrencia),
          recInicio: dataInicio,
          recFimTipo: 'nunca',
          recFimQty: '',
          recFimData: '',
          titular: d.titular || ''
        };
      });

      // === CONTAS E CARTÕES ===
      let contasCartoes = diag.contas_cartoes || [];
      if (!Array.isArray(contasCartoes)) {
        if (contasCartoes.contasCartoes) contasCartoes = contasCartoes.contasCartoes;
        else contasCartoes = Object.values(contasCartoes);
      }
      const accountsImport = contasCartoes.map(cc => ({
        id: 'diag_' + (cc.id || Math.random().toString(36).slice(2,8)),
        nome: (cc.tipo === 'cartao' ? 'Cartão ' : 'Conta ') + (cc.instituicao || '#' + cc.id),
        tipo: cc.tipo || 'conta',
        fechamento: 10,
        vencimento: 20,
        bandeira: cc.tipo_cartao || ''
      }));

      // Mapear formaPagamento das despesas para o ID do account importado (diag_X)
      itemsDespesa.forEach(item => {
        if (item.formaPagamento) {
          const accMatch = accountsImport.find(a => a.id === 'diag_' + item.formaPagamento);
          if (accMatch) {
            item.formaPagamento = accMatch.id;
          } else {
            item.formaPagamento = ''; // conta não encontrada, limpar
          }
        }
      });

      const items = [...itemsReceita, ...itemsPoupanca, ...itemsDespesa];
      const totalReceitas = itemsReceita.length;
      const totalPoupancas = itemsPoupanca.length;
      const totalDespesas = itemsDespesa.length;
      const totalContas = accountsImport.length;

      return {
        items,
        accounts: accountsImport,
        mensagem: `${totalReceitas} receita(s), ${totalPoupancas} poupança(s), ${totalDespesas} despesa(s) e ${totalContas} conta(s)/cartão(ões) encontrado(s).`
      };
    },

    // PATRIMÔNIO: Importa patrimônios líquidos e físicos
    patrimonio: function(diag) {
      const patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      const patrimoniosFisicos = diag.patrimonios || [];

      if (patrimoniosLiquidos.length === 0 && patrimoniosFisicos.length === 0) {
        return { items: [], mensagem: 'Nenhum patrimônio encontrado no diagnóstico.' };
      }

      const itemsLiquidos = patrimoniosLiquidos.map(pl => ({
        nome: pl.tipo_produto_nome || pl.nome_produto_customizado || 'Investimento importado',
        tipo_ativo: 'INVESTIMENTO',
        instituicao_nome: pl.instituicao_nome || '',
        valor_atual: pl.valor_atual || 0,
        aporte_mensal: pl.aporte_frequencia === 'MENSAL' ? (pl.aporte_valor || 0) :
                       pl.aporte_frequencia === 'ANUAL' ? Math.round((pl.aporte_valor || 0) / 12) : 0,
        taxa_retorno_anual: pl.rentabilidade_esperada || 0,
        liquidez: 'medio',
        observacoes: `Classificação: ${pl.classificacao_risco || 'N/I'}. Taxa Admin: ${pl.taxa_administracao || 0}%`
      }));

      const itemsFisicos = patrimoniosFisicos.map(pf => ({
        nome: `${pf.tipo || 'Bem'} - ${pf.detalhes || ''}`.trim(),
        tipo_ativo: pf.tipo === 'Imóvel' ? 'IMOVEL' : pf.tipo === 'Veículo' ? 'VEICULO' : 'OUTRO',
        instituicao_nome: '',
        valor_atual: pf.valor || 0,
        aporte_mensal: 0,
        taxa_retorno_anual: 0,
        liquidez: 'baixo',
        observacoes: `Quitado: ${pf.quitado ? 'Sim' : 'Não'}. Seguro: ${pf.seguro ? 'Sim' : 'Não'}. Saldo devedor: R$ ${pf.saldo_devedor || 0}`
      }));

      const items = [...itemsLiquidos, ...itemsFisicos];
      return { items, mensagem: `${patrimoniosLiquidos.length} investimento(s) e ${patrimoniosFisicos.length} bem(ns) físico(s) encontrado(s).` };
    },

    // CARTÕES: Importa cartões do diagnóstico
    cartoes: function(diag) {
      const contasCartoes = diag.contas_cartoes || [];
      const cartoes = contasCartoes.filter(c => c.tipo === 'cartao');

      if (cartoes.length === 0) {
        return { items: [], mensagem: 'Nenhum cartão encontrado no diagnóstico.' };
      }

      const items = cartoes.map(c => ({
        name: `${c.instituicao || 'Cartão'} ${c.tipo_cartao || ''}`.trim(),
        anuidade_mensal: c.tarifa_anuidade ? Math.round(c.tarifa_anuidade / 12) : 0,
        bandeira: c.bandeira || '',
        pontos_por_dolar: c.pontos_por_dolar || 0,
        cashback: c.cashback || 0,
        beneficios: c.beneficios || ''
      }));

      return { items, mensagem: `${items.length} cartão(ões) encontrado(s) no diagnóstico.` };
    },

    // COMPARADOR: Importa produtos de proteção
    comparador: function(diag) {
      const produtos = diag.produtos_protecao || [];

      if (produtos.length === 0) {
        return { items: [], mensagem: 'Nenhum produto de proteção encontrado no diagnóstico.' };
      }

      const items = produtos.map(p => ({
        name: `${p.tipo_produto || 'Produto'} - ${p.seguradora || 'N/I'}`,
        price: p.custo || 0,
        periodicidade: p.periodicidade || 'anual',
        seguradora: p.seguradora || '',
        cobertura_morte: p.cobertura_morte || 0,
        cobertura_invalidez: p.cobertura_invalidez || 0,
        cobertura_dit: p.cobertura_dit || 0,
        cobertura_doencas_graves: p.cobertura_doencas_graves || 0,
        resgatavel: p.resgatavel || false,
        objeto: p.objeto || ''
      }));

      return { items, mensagem: `${items.length} produto(s) de proteção encontrado(s).` };
    },

    // ACÚMULO: Importa patrimônios líquidos com aportes (previdência e investimentos)
    acumulo: function(diag) {
      const patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      const comAporte = patrimoniosLiquidos.filter(pl => 
        pl.aporte_frequencia && pl.aporte_frequencia !== 'NENHUM'
      );

      if (comAporte.length === 0) {
        return { items: [], mensagem: 'Nenhum investimento com aporte encontrado no diagnóstico.' };
      }

      const items = comAporte.map(pl => {
        // Detectar se é PGBL, VGBL ou carteira
        const nomeProduto = (pl.tipo_produto_nome || '').toLowerCase();
        let tipo = 'carteira';
        if (nomeProduto.includes('pgbl')) tipo = 'pgbl';
        else if (nomeProduto.includes('vgbl')) tipo = 'vgbl';

        const aportesMensal = pl.aporte_frequencia === 'MENSAL' ? (pl.aporte_valor || 0) :
                              pl.aporte_frequencia === 'ANUAL' ? Math.round((pl.aporte_valor || 0) / 12) :
                              pl.aporte_frequencia === 'TRIMESTRAL' ? Math.round((pl.aporte_valor || 0) / 3) : 0;

        return {
          nome: pl.tipo_produto_nome || pl.nome_produto_customizado || 'Veículo importado',
          tipo: tipo,
          taxa_admin: pl.taxa_administracao || 0,
          taxa_performance: 0,
          taxa_saida: 0,
          come_cotas: tipo === 'carteira',
          tabela_ir: 'regressiva',
          taxa_retorno_anual: pl.rentabilidade_esperada || 0,
          aporte_mensal: aportesMensal,
          saldo_atual: pl.valor_atual || 0
        };
      });

      return { items, mensagem: `${items.length} veículo(s) de acumulação encontrado(s).` };
    },

    // IR: Importa declarações de IR
    ir: function(diag) {
      const declaracoes = diag.declaracoes_ir || [];
      const ativas = declaracoes.filter(d => d.tipo_declaracao && d.tipo_declaracao !== 'nao_declara');

      if (ativas.length === 0) {
        return { items: [], mensagem: 'Nenhuma declaração de IR ativa encontrada no diagnóstico.' };
      }

      const items = ativas.map(d => ({
        nome: d.pessoa_nome || 'Declarante',
        rendaBruta: d.renda_bruta_anual || 0,
        impostoRetido: d.total_recolhido_ir || 0,
        previdenciaOficial: d.contribuicao_previdencia_oficial || 0,
        dependentes: d.total_dependentes || 0,
        instrucao: d.gastos_instrucao || 0,
        medicas: d.gastos_medicos || 0,
        livroCaixa: d.livro_caixa || 0,
        pensao: d.pensao_alimenticia || 0,
        previdenciaPrivada: 0,
        outrasDeducoes: d.outras_deducoes || 0,
        tipo_declaracao: d.tipo_declaracao || 'completa'
      }));

      return { items, mensagem: `${items.length} declaração(ões) de IR encontrada(s).` };
    },

    // ORÁCULO: Importa objetivos + dados cruzados (patrimônio e fluxo)
    oraculo: function(diag) {
      const objetivosData = diag.objetivos || {};
      const objetivos = objetivosData.objetivos || [];
      const patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      const fluxoData = diag.fluxo_caixa || {};

      if (objetivos.length === 0) {
        return { items: [], mensagem: 'Nenhum objetivo encontrado no diagnóstico.' };
      }

      // Calcular aporte total disponível (soma dos aportes de todos os investimentos)
      const aporteTotal = patrimoniosLiquidos.reduce((sum, pl) => {
        if (!pl.aporte_frequencia || pl.aporte_frequencia === 'NENHUM') return sum;
        const mensal = pl.aporte_frequencia === 'MENSAL' ? (pl.aporte_valor || 0) :
                       pl.aporte_frequencia === 'ANUAL' ? Math.round((pl.aporte_valor || 0) / 12) :
                       pl.aporte_frequencia === 'TRIMESTRAL' ? Math.round((pl.aporte_valor || 0) / 3) : 0;
        return sum + mensal;
      }, 0);

      // Calcular saldo total investido
      const saldoTotal = patrimoniosLiquidos.reduce((sum, pl) => sum + (pl.valor_atual || 0), 0);

      // Calcular receita líquida mensal (receitas - despesas)
      const receitas = (fluxoData.receitas || []).reduce((sum, r) => sum + (r.valor || 0), 0);
      const despesas = (fluxoData.despesas || []).reduce((sum, d) => sum + (d.valor || 0), 0);
      const receitaLiquida = receitas - despesas;

      const items = objetivos.map(obj => {
        if (obj.tipo === 'aposentadoria') {
          return {
            tipo: 'aposentadoria',
            name: 'Aposentadoria',
            amount: obj.renda_anual ? obj.renda_anual * 12 * 25 : 0, // Regra dos 25x
            deadline: obj.prazo_idade ? (obj.prazo_idade - (diag.idade_atual || 30)) * 12 : 360,
            priority: 10,
            renda_desejada: obj.renda_anual ? Math.round(obj.renda_anual / 12) : 0
          };
        } else {
          return {
            tipo: 'objetivo',
            name: obj.descricao || 'Objetivo importado',
            amount: obj.valor_final || obj.meta_acumulo || 0,
            deadline: obj.prazo_meses || 60,
            priority: obj.prioridade || 5
          };
        }
      });

      return {
        items,
        dadosCruzados: {
          aporteTotal,
          saldoTotal,
          receitaLiquida
        },
        mensagem: `${items.length} objetivo(s) encontrado(s). Aporte mensal total: R$ ${aporteTotal.toLocaleString('pt-BR')}. Saldo investido: R$ ${saldoTotal.toLocaleString('pt-BR')}.`
      };
    },

    // SIMULADOR: Importa dados de patrimônios físicos e fluxo para cenários
    simulador: function(diag) {
      const patrimoniosFisicos = diag.patrimonios || [];
      const patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      const fluxoData = diag.fluxo_caixa || {};

      const bensFinanciaveis = patrimoniosFisicos.filter(pf => !pf.quitado && pf.saldo_devedor > 0);
      const receitas = (fluxoData.receitas || []).reduce((sum, r) => sum + (r.valor || 0), 0);
      const despesas = (fluxoData.despesas || []).reduce((sum, d) => sum + (d.valor || 0), 0);
      const capacidadePagamento = receitas - despesas;
      const saldoTotal = patrimoniosLiquidos.reduce((sum, pl) => sum + (pl.valor_atual || 0), 0);

      const items = bensFinanciaveis.map(pf => ({
        tipo: 'financiamento',
        nome: `${pf.tipo || 'Bem'} - ${pf.detalhes || ''}`.trim(),
        valorBem: pf.valor || 0,
        saldoDevedor: pf.saldo_devedor || 0,
        capacidadePagamento: capacidadePagamento
      }));

      return {
        items,
        dadosGerais: {
          capacidadePagamento,
          saldoTotal,
          receitas,
          despesas
        },
        mensagem: items.length > 0 
          ? `${items.length} financiamento(s) ativo(s) encontrado(s). Capacidade de pagamento: R$ ${capacidadePagamento.toLocaleString('pt-BR')}/mês.`
          : `Nenhum financiamento ativo. Capacidade de pagamento: R$ ${capacidadePagamento.toLocaleString('pt-BR')}/mês. Saldo investido: R$ ${saldoTotal.toLocaleString('pt-BR')}.`
      };
    },

    // ACOMPANHAMENTO: Importa dados pessoais e objetivos para reuniões
    acompanhamento: function(diag) {
      const objetivosData = diag.objetivos || {};
      const objetivos = objetivosData.objetivos || [];
      const patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      const dividas = diag.dividas || [];
      const items = [{
        nome_cliente: diag.nome || '',
        profissao: diag.profissao || '',
        estado_civil: diag.estado_civil || '',
        total_investido: patrimoniosLiquidos.reduce((sum, pl) => sum + (pl.valor_atual || 0), 0),
        total_dividas: dividas.reduce((sum, d) => sum + (d.saldo_devedor || 0), 0),
        total_objetivos: objetivos.length,
        objetivos_resumo: objetivos.map(o => o.descricao || o.tipo).join(', ')
      }];
      return {
        items,
        mensagem: `Dados do cliente carregados. ${objetivos.length} objetivo(s), ${patrimoniosLiquidos.length} investimento(s), ${dividas.length} dívida(s).`
      };
    },

    // DIREITOS: Importa produtos de proteção, investimentos, cartões e contas como produtos
    direitos: function(diag) {
      const items = [];

      // Produtos de proteção (seguros)
      let produtosProtecao = diag.produtos_protecao || [];
      if (!Array.isArray(produtosProtecao)) produtosProtecao = Object.values(produtosProtecao);
      produtosProtecao.forEach(p => {
        items.push({
          nome: `${p.tipo_produto || 'Seguro'} - ${p.seguradora || 'N/I'}`,
          tipo: p.tipo_produto || 'Seguro',
          instituicao: p.seguradora || '',
          custo_mensal: p.periodicidade === 'mensal' ? (p.custo || 0) : p.periodicidade === 'anual' ? Math.round((p.custo || 0) / 12) : (p.custo || 0),
          vigencia: p.vigencia || '',
          obs: `Objeto: ${p.objeto || 'N/I'}`,
          _fonte: 'protecao'
        });
      });

      // Patrimônios líquidos (investimentos, previdência)
      let patrimoniosLiquidos = diag.patrimonios_liquidos || [];
      if (!Array.isArray(patrimoniosLiquidos)) patrimoniosLiquidos = Object.values(patrimoniosLiquidos);
      patrimoniosLiquidos.forEach(pl => {
        items.push({
          nome: pl.nome_produto_customizado || pl.tipo_produto_nome || 'Investimento',
          tipo: pl.tipo_produto_nome || 'Investimento',
          instituicao: pl.instituicao_nome || '',
          custo_mensal: '',
          vigencia: '',
          obs: `Valor atual: R$ ${(pl.valor_atual || 0).toLocaleString('pt-BR')}. Classificação: ${pl.classificacao_risco || 'N/I'}`,
          _fonte: 'investimento'
        });
      });

      // Contas e cartões
      let contasCartoes = diag.contas_cartoes || [];
      if (!Array.isArray(contasCartoes)) contasCartoes = Object.values(contasCartoes);
      contasCartoes.forEach(c => {
        const nome = c.tipo === 'cartao' 
          ? `Cartão ${c.bandeira || ''} ${c.instituicao || ''}`.trim()
          : `Conta ${c.tipo_conta || ''} ${c.instituicao || ''}`.trim();
        items.push({
          nome: nome,
          tipo: c.tipo === 'cartao' ? 'Cartão de Crédito' : 'Conta Bancária',
          instituicao: c.instituicao || '',
          custo_mensal: c.tarifa_anuidade ? Math.round(c.tarifa_anuidade / 12) : (c.tarifa_mensal || 0),
          vigencia: '',
          obs: c.tipo === 'cartao' ? `Bandeira: ${c.bandeira || 'N/I'}. Pontos/dólar: ${c.pontos_por_dolar || 0}` : '',
          _fonte: c.tipo === 'cartao' ? 'cartao' : 'conta'
        });
      });

      if (items.length === 0) {
        return { items: [], mensagem: 'Nenhum produto encontrado no diagnóstico.' };
      }

      return { items, mensagem: `${items.length} produto(s) encontrado(s): ${produtosProtecao.length} seguro(s), ${patrimoniosLiquidos.length} investimento(s), ${contasCartoes.length} conta(s)/cartão(ões).` };
    }
  };

  // ========================================
  // UI: Modal de importação
  // ========================================

  function criarModalImportacao() {
    if (document.getElementById('modal-importar-diagnostico')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-importar-diagnostico';
    modal.innerHTML = `
      <style>
        #modal-importar-diagnostico {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          z-index: 99999;
          justify-content: center;
          align-items: center;
          padding: 1rem;
        }
        #modal-importar-diagnostico.ativo { display: flex; }
        .modal-importar-content {
          background: #1a1a2e;
          border: 2px solid #d4af37;
          border-radius: 12px;
          max-width: 700px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          padding: 2rem;
        }
        .modal-importar-content h3 {
          color: #d4af37;
          margin: 0 0 1rem 0;
          font-size: 1.3rem;
        }
        .modal-importar-content .msg-status {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .modal-importar-content .msg-sucesso {
          background: rgba(40, 167, 69, 0.15);
          border: 1px solid #28a745;
          color: #28a745;
        }
        .modal-importar-content .msg-vazio {
          background: rgba(255, 193, 7, 0.15);
          border: 1px solid #ffc107;
          color: #ffc107;
        }
        .modal-importar-content .msg-erro {
          background: rgba(220, 53, 69, 0.15);
          border: 1px solid #dc3545;
          color: #dc3545;
        }
        .modal-importar-content .item-preview {
          background: rgba(255,255,255,0.05);
          border: 1px solid #333;
          border-radius: 8px;
          padding: 0.8rem;
          margin-bottom: 0.5rem;
        }
        .modal-importar-content .item-preview h4 {
          color: #fff;
          margin: 0 0 0.3rem 0;
          font-size: 0.95rem;
        }
        .modal-importar-content .item-preview p {
          color: #aaa;
          margin: 0;
          font-size: 0.85rem;
        }
        .modal-importar-content .item-preview label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #ccc;
          cursor: pointer;
          margin-top: 0.4rem;
        }
        .modal-importar-content .item-preview input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .modal-importar-btns {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
          justify-content: flex-end;
        }
        .modal-importar-btns button {
          padding: 0.7rem 1.5rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
        }
        .btn-importar-confirmar {
          background: #d4af37;
          color: #1a1a2e;
        }
        .btn-importar-confirmar:hover { background: #e8c547; }
        .btn-importar-cancelar {
          background: #333;
          color: #ccc;
        }
        .btn-importar-cancelar:hover { background: #444; }
        .btn-importar-todos {
          background: #28a745;
          color: #fff;
          font-size: 0.85rem;
          padding: 0.4rem 0.8rem;
          margin-bottom: 0.5rem;
        }
      </style>
      <div class="modal-importar-content">
        <h3><i class="fas fa-file-import"></i> Importar do Diagnóstico Financeiro</h3>
        <div id="modal-importar-body">
          <p style="color: #ccc;">Carregando dados do diagnóstico...</p>
        </div>
        <div class="modal-importar-btns">
          <button class="btn-importar-cancelar" onclick="fecharModalImportacao()">Cancelar</button>
          <button class="btn-importar-confirmar" id="btn-confirmar-importacao" style="display:none;" onclick="confirmarImportacao()">
            <i class="fas fa-check"></i> Importar Selecionados
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Armazena os dados para importação
  let dadosParaImportar = null;
  let callbackImportacao = null;

  // Abre o modal e busca os dados
  async function abrirModalImportacao(callback) {
    criarModalImportacao();
    callbackImportacao = callback;
    
    const modal = document.getElementById('modal-importar-diagnostico');
    const body = document.getElementById('modal-importar-body');
    const btnConfirmar = document.getElementById('btn-confirmar-importacao');
    
    modal.classList.add('ativo');
    body.innerHTML = '<p style="color: #ccc; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Buscando dados do diagnóstico...</p>';
    btnConfirmar.style.display = 'none';

    const diag = await buscarDiagnostico();
    
    if (!diag) {
      body.innerHTML = `
        <div class="msg-status msg-erro">
          <i class="fas fa-times-circle"></i> Nenhum diagnóstico financeiro encontrado para este cliente.
          <br><small>O diagnóstico precisa ser preenchido primeiro.</small>
        </div>
      `;
      return;
    }

    const ferramenta = detectarFerramenta();
    const mapeador = MAPEADORES[ferramenta];
    
    if (!mapeador) {
      body.innerHTML = `
        <div class="msg-status msg-erro">
          <i class="fas fa-times-circle"></i> Importação não configurada para esta ferramenta (${ferramenta}).
        </div>
      `;
      return;
    }

    const resultado = mapeador(diag);
    dadosParaImportar = resultado;

    if (!resultado.items || resultado.items.length === 0) {
      body.innerHTML = `
        <div class="msg-status msg-vazio">
          <i class="fas fa-info-circle"></i> ${resultado.mensagem}
        </div>
      `;
      return;
    }

    // Renderizar preview dos itens com checkboxes
    let html = `
      <div class="msg-status msg-sucesso">
        <i class="fas fa-check-circle"></i> ${resultado.mensagem}
      </div>
      <p style="color: #ccc; font-size: 0.9rem; margin-bottom: 0.8rem;">Selecione os itens que deseja importar:</p>
      <button class="btn-importar-todos" onclick="selecionarTodosImportacao()">
        <i class="fas fa-check-double"></i> Selecionar Todos
      </button>
    `;

    resultado.items.forEach((item, idx) => {
      const nome = item.nome || item.name || item.tipo || `Item ${idx + 1}`;
      const detalhes = gerarDetalhesPreview(item, ferramenta);
      html += `
        <div class="item-preview">
          <label>
            <input type="checkbox" id="import-item-${idx}" value="${idx}">
            <div>
              <h4>${nome}</h4>
              <p>${detalhes}</p>
            </div>
          </label>
        </div>
      `;
    });

    if (resultado.dadosCruzados) {
      html += `
        <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(212,175,55,0.1); border-radius: 8px; border: 1px solid rgba(212,175,55,0.3);">
          <strong style="color: #d4af37; font-size: 0.9rem;"><i class="fas fa-link"></i> Dados Cruzados Disponíveis:</strong>
          <p style="color: #ccc; font-size: 0.85rem; margin: 0.3rem 0 0 0;">
            ${resultado.dadosCruzados.aporteTotal !== undefined ? `Aporte total: R$ ${resultado.dadosCruzados.aporteTotal.toLocaleString('pt-BR')}/mês | ` : ''}
            ${resultado.dadosCruzados.saldoTotal !== undefined ? `Saldo investido: R$ ${resultado.dadosCruzados.saldoTotal.toLocaleString('pt-BR')} | ` : ''}
            ${resultado.dadosCruzados.receitaLiquida !== undefined ? `Receita líquida: R$ ${resultado.dadosCruzados.receitaLiquida.toLocaleString('pt-BR')}/mês` : ''}
          </p>
        </div>
      `;
    }

    body.innerHTML = html;
    btnConfirmar.style.display = 'inline-flex';
  }

  function gerarDetalhesPreview(item, ferramenta) {
    switch (ferramenta) {
      case 'juros':
        return `Saldo: R$ ${(item.saldoDevedor || 0).toLocaleString('pt-BR')} | Parcela: R$ ${(item.parcela || 0).toLocaleString('pt-BR')} | Taxa: ${item.taxaFixa || 0}% ${item.taxaTipo || 'a.a.'}`;
      case 'fluxo':
        var tipoLabel = item.tipo === 'entrada' ? '📈 Receita' : (item.subtipo === 'poupanca' ? '💰 Poupança' : '📉 Despesa');
        return `${tipoLabel} | R$ ${(item.valor || 0).toLocaleString('pt-BR')} | ${item.recTipo || ''} | ${item.categoria || item.subtipo || ''}`;
      case 'patrimonio':
        return `${item.tipo_ativo} | R$ ${(item.valor_atual || 0).toLocaleString('pt-BR')} | Aporte: R$ ${(item.aporte_mensal || 0).toLocaleString('pt-BR')}/mês`;
      case 'cartoes':
        return `Anuidade: R$ ${((item.anuidade_mensal || 0) * 12).toLocaleString('pt-BR')}/ano | Pontos: ${item.pontos_por_dolar || 0}/dólar`;
      case 'comparador':
        return `${item.seguradora || 'N/I'} | Prêmio: R$ ${(item.price || 0).toLocaleString('pt-BR')} | Morte: R$ ${(item.cobertura_morte || 0).toLocaleString('pt-BR')}`;
      case 'acumulo':
        return `${item.tipo.toUpperCase()} | Saldo: R$ ${(item.saldo_atual || 0).toLocaleString('pt-BR')} | Aporte: R$ ${(item.aporte_mensal || 0).toLocaleString('pt-BR')}/mês | Taxa Admin: ${item.taxa_admin || 0}%`;
      case 'ir':
        return `Renda Bruta: R$ ${(item.rendaBruta || 0).toLocaleString('pt-BR')} | IR Retido: R$ ${(item.impostoRetido || 0).toLocaleString('pt-BR')} | ${item.tipo_declaracao || ''}`;
      case 'oraculo':
        return `${item.tipo === 'aposentadoria' ? '🏖️ Aposentadoria' : '🎯 Objetivo'} | Meta: R$ ${(item.amount || 0).toLocaleString('pt-BR')} | Prazo: ${Math.round((item.deadline || 0) / 12)} anos`;
      case 'simulador':
        return `${item.tipo} | Valor: R$ ${(item.valorBem || 0).toLocaleString('pt-BR')} | Saldo Devedor: R$ ${(item.saldoDevedor || 0).toLocaleString('pt-BR')}`;
      case 'acompanhamento':
        return `Investido: R$ ${(item.total_investido || 0).toLocaleString('pt-BR')} | Dívidas: R$ ${(item.total_dividas || 0).toLocaleString('pt-BR')} | ${item.total_objetivos} objetivo(s)`;
      case 'direitos':
        return `${item.tipo || 'Produto'} | ${item.instituicao || 'N/I'} | Custo: ${item.custo_mensal ? 'R$ ' + item.custo_mensal + '/mês' : 'N/I'}`;
      default:
        return JSON.stringify(item).substring(0, 100);
    }
  }

  function confirmarImportacao() {
    if (!dadosParaImportar || !callbackImportacao) return;

    // Coletar itens selecionados
    const selecionados = [];
    dadosParaImportar.items.forEach((item, idx) => {
      const checkbox = document.getElementById(`import-item-${idx}`);
      if (checkbox && checkbox.checked) {
        selecionados.push(item);
      }
    });

    if (selecionados.length === 0) {
      alert('Selecione pelo menos um item para importar.');
      return;
    }

    // Chamar o callback com os itens selecionados, dados cruzados e accounts
    callbackImportacao(selecionados, dadosParaImportar.dadosCruzados || null, dadosParaImportar.accounts || []);
    fecharModalImportacao();
  }

  function fecharModalImportacao() {
    const modal = document.getElementById('modal-importar-diagnostico');
    if (modal) modal.classList.remove('ativo');
    dadosParaImportar = null;
    callbackImportacao = null;
  }

  function selecionarTodosImportacao() {
    if (!dadosParaImportar) return;
    dadosParaImportar.items.forEach((_, idx) => {
      const checkbox = document.getElementById(`import-item-${idx}`);
      if (checkbox) checkbox.checked = true;
    });
  }

  // ========================================
  // BOTÃO DE IMPORTAÇÃO (inserido automaticamente na página)
  // ========================================

  function inserirBotaoImportacao() {
    // Só mostrar se há um cliente logado
    const clienteId = getClienteId();
    if (!clienteId) return;

    // Verificar se já existe
    if (document.getElementById('btn-importar-diagnostico')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-importar-diagnostico';
    btn.innerHTML = '<i class="fas fa-file-import"></i> Importar do Diagnóstico';
    btn.style.cssText = `
      position: fixed;
      bottom: 5rem;
      right: 1.5rem;
      padding: 0.8rem 1.2rem;
      background: linear-gradient(135deg, #d4af37, #b8960c);
      color: #1a1a2e;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
      transition: all 0.3s ease;
    `;
    btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = '0 6px 20px rgba(212, 175, 55, 0.6)'; };
    btn.onmouseout = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.4)'; };
    
    btn.onclick = function() {
      abrirModalImportacao(function(itensSelecionados, dadosCruzados, accounts) {
        // Disparar evento customizado para a ferramenta processar
        const evento = new CustomEvent('importarDiagnostico', {
          detail: { items: itensSelecionados, dadosCruzados: dadosCruzados, accounts: accounts || [] }
        });
        document.dispatchEvent(evento);
      });
    };

    document.body.appendChild(btn);
  }

  // ========================================
  // EXPOSIÇÃO GLOBAL
  // ========================================

  window.abrirModalImportacao = abrirModalImportacao;
  window.fecharModalImportacao = fecharModalImportacao;
  window.confirmarImportacao = confirmarImportacao;
  window.selecionarTodosImportacao = selecionarTodosImportacao;
  window.buscarDiagnostico = buscarDiagnostico;

  // Inserir botão quando a página carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(inserirBotaoImportacao, 1000));
  } else {
    setTimeout(inserirBotaoImportacao, 1000);
  }

})();
