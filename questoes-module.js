// =============================================
// MÓDULO DE QUESTÕES PERTINENTES
// questoes-module.js
// =============================================

(function() {
  'use strict';

  // =============================================
  // DEFINIÇÃO DAS 38 PERGUNTAS
  // =============================================
  const QUESTOES = [
    // SEÇÃO: PATRIMÔNIO FÍSICO (2)
    {
      id: 'q_patrimonio_1',
      secao: 'patrimonio-fisico',
      texto: 'Já tem proteção contra prejuízos de todos os patrimônios?',
      tipo: 'auto',
      autoDetect: function() {
        const patrimonios = window.getPatrimoniosFisicos ? window.getPatrimoniosFisicos() : [];
        if (patrimonios.length === 0) return null; // sem dados
        const todosComSeguro = patrimonios.every(p => p.possui_seguro === 'sim');
        return todosComSeguro ? 'SIM' : null;
      }
    },
    {
      id: 'q_patrimonio_2',
      secao: 'patrimonio-fisico',
      texto: 'Melhor custo benefício da proteção dos patrimônios?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },

    // SEÇÃO: PROTEÇÃO / SAÚDE / RENDA (9)
    {
      id: 'q_protecao_1',
      secao: 'produtos-protecao',
      texto: '100% da renda é independente do trabalho?',
      tipo: 'auto',
      autoDetect: function() {
        const fluxo = window.getFluxoCaixaData ? window.getFluxoCaixaData() : {};
        const receitas = fluxo.receitas || [];
        if (receitas.length === 0) return null;
        const totalReceitas = receitas.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        const receitasPassivas = receitas.filter(r => 
          r.origem === 'aluguel' || r.origem === 'dividendos' || r.origem === 'rendimentos'
        ).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        if (totalReceitas > 0 && receitasPassivas >= totalReceitas) return 'SIM';
        return null;
      }
    },
    {
      id: 'q_protecao_2',
      secao: 'produtos-protecao',
      texto: '80% ou mais da renda é estável?',
      tipo: 'auto',
      autoDetect: function() {
        const fluxo = window.getFluxoCaixaData ? window.getFluxoCaixaData() : {};
        const receitas = fluxo.receitas || [];
        if (receitas.length === 0) return null;
        const totalReceitas = receitas.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        const receitasFixas = receitas.filter(r => r.tipo === 'fixo' || r.tipo === 'mensal')
          .reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
        if (totalReceitas > 0 && receitasFixas >= totalReceitas * 0.8) return 'SIM';
        return null;
      }
    },
    {
      id: 'q_protecao_3',
      secao: 'produtos-protecao',
      texto: 'Consegue aumentar a renda no curto/médio prazo conforme a necessidade?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_protecao_4',
      secao: 'produtos-protecao',
      texto: 'Há mais de uma fonte de renda?',
      tipo: 'auto',
      autoDetect: function() {
        const fluxo = window.getFluxoCaixaData ? window.getFluxoCaixaData() : {};
        const receitas = fluxo.receitas || [];
        if (receitas.length === 0) return null;
        const origensUnicas = new Set(receitas.map(r => r.origem || r.descricao));
        if (origensUnicas.size >= 2) return 'SIM';
        return null;
      }
    },
    {
      id: 'q_protecao_5',
      secao: 'produtos-protecao',
      texto: 'Possui garantia da força de trabalho?',
      tipo: 'auto',
      autoDetect: function() {
        const produtos = window.getProdutosProtecaoData ? window.getProdutosProtecaoData() : [];
        if (produtos.length === 0) return null;
        const temSeguroVida = produtos.some(p => 
          (p.tipo || '').toLowerCase().includes('vida') || 
          (p.tipo || '').toLowerCase().includes('invalidez') ||
          (p.tipo || '').toLowerCase().includes('trabalho')
        );
        return temSeguroVida ? 'SIM' : null;
      }
    },
    {
      id: 'q_protecao_6',
      secao: 'produtos-protecao',
      texto: 'Melhor custo benefício da garantia do trabalho?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_protecao_7',
      secao: 'produtos-protecao',
      texto: 'Proteção adequada para saúde das PESSOAS?',
      tipo: 'auto',
      autoDetect: function() {
        const produtos = window.getProdutosProtecaoData ? window.getProdutosProtecaoData() : [];
        if (produtos.length === 0) return null;
        const temPlanoSaude = produtos.some(p => 
          (p.tipo || '').toLowerCase().includes('saúde') || 
          (p.tipo || '').toLowerCase().includes('saude') ||
          (p.tipo || '').toLowerCase().includes('plano')
        );
        return temPlanoSaude ? 'SIM' : null;
      }
    },
    {
      id: 'q_protecao_8',
      secao: 'produtos-protecao',
      texto: 'Melhor custo benefício da proteção saúde?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_protecao_9',
      secao: 'produtos-protecao',
      texto: 'Proteção adequada para saúde dos PETs?',
      tipo: 'auto',
      autoDetect: function() {
        // Verifica se tem pet cadastrado nos dependentes
        const dependentes = window.dependentes || [];
        const temPet = dependentes.some(d => 
          (d.tipo || '').toLowerCase().includes('pet') || 
          (d.parentesco || '').toLowerCase().includes('pet')
        );
        if (!temPet) return 'INAPLICÁVEL'; // Não tem pet = inaplicável
        
        const produtos = window.getProdutosProtecaoData ? window.getProdutosProtecaoData() : [];
        const temPlanoPet = produtos.some(p => 
          (p.tipo || '').toLowerCase().includes('pet') ||
          (p.descricao || '').toLowerCase().includes('pet')
        );
        return temPlanoPet ? 'SIM' : null;
      }
    },

    // SEÇÃO: INVESTIMENTOS / PATRIMÔNIO LÍQUIDO (4)
    {
      id: 'q_investimentos_1',
      secao: 'patrimonio-liquido',
      texto: 'Possui reserva de longo prazo adequada?',
      tipo: 'auto',
      autoDetect: function() {
        const patrimonios = window.getPatrimoniosLiquidosData ? window.getPatrimoniosLiquidosData() : [];
        if (patrimonios.length === 0) return null;
        const temLP = patrimonios.some(p => 
          (p.finalidade || '').toLowerCase().includes('longo') ||
          (p.finalidade || '').toLowerCase().includes('aposentadoria') ||
          (p.prazo || '').toLowerCase().includes('longo')
        );
        return temLP ? 'SIM' : null;
      }
    },
    {
      id: 'q_investimentos_2',
      secao: 'patrimonio-liquido',
      texto: 'Possui reserva de emergência adequada?',
      tipo: 'auto',
      autoDetect: function() {
        const patrimonios = window.getPatrimoniosLiquidosData ? window.getPatrimoniosLiquidosData() : [];
        const fluxo = window.getFluxoCaixaData ? window.getFluxoCaixaData() : {};
        
        if (patrimonios.length === 0) return null;
        
        const reservaEmergencia = patrimonios
          .filter(p => (p.finalidade || '').toLowerCase().includes('emergência') || 
                       (p.finalidade || '').toLowerCase().includes('emergencia') ||
                       (p.finalidade || '').toLowerCase().includes('reserva'))
          .reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
        
        const custosFixos = (fluxo.custos_fixos || [])
          .reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
        
        if (custosFixos > 0 && reservaEmergencia >= custosFixos * 6) return 'SIM';
        return null;
      }
    },
    {
      id: 'q_investimentos_3',
      secao: 'patrimonio-liquido',
      texto: 'Possui reservas específicas para cada objetivo?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_investimentos_4',
      secao: 'patrimonio-liquido',
      texto: 'A distribuição dos recursos está adequada ao perfil de investidor?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },

    // SEÇÃO: DÍVIDAS (2)
    {
      id: 'q_dividas_1',
      secao: 'dividas',
      texto: 'É livre de dívidas?',
      tipo: 'auto',
      autoDetect: function() {
        const dividas = window.getDividasData ? window.getDividasData() : [];
        if (dividas.length === 0) return 'SIM';
        const temDividaReal = dividas.some(d => parseFloat(d.valor || d.saldo_devedor || 0) > 0);
        return temDividaReal ? null : 'SIM';
      }
    },
    {
      id: 'q_dividas_2',
      secao: 'dividas',
      texto: 'Sensação que as parcelas estão adequadas (não atrapalham) o fluxo de caixa?',
      tipo: 'manual',
      autoDetect: function() {
        // Só aparece se tem dívida
        const dividas = window.getDividasData ? window.getDividasData() : [];
        const temDivida = dividas.some(d => parseFloat(d.valor || d.saldo_devedor || 0) > 0);
        if (!temDivida) return 'INAPLICÁVEL';
        return null;
      }
    },

    // SEÇÃO: SUCESSÃO (3)
    {
      id: 'q_sucessao_1',
      secao: 'sucessao',
      texto: 'Definiu como será a distribuição do patrimônio para os (futuros) herdeiros?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_sucessao_2',
      secao: 'sucessao',
      texto: 'Patrimônio está blindado de forma a garantir exatamente a sucessão desejada?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_sucessao_3',
      secao: 'sucessao',
      texto: 'Tem estratégia em andamento para desonerar os Herdeiros?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },

    // SEÇÃO: IMPOSTOS / IR (3)
    {
      id: 'q_ir_1',
      secao: 'ir',
      texto: 'Recebe os recursos da forma mais vantajosa possível?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_ir_2',
      secao: 'ir',
      texto: 'Faz declaração da forma mais adequada para o perfil?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_ir_3',
      secao: 'ir',
      texto: 'Investe visando reduzir o pagamento ou aumentar a restituição?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },

    // SEÇÃO: CARTÕES DE CRÉDITO (5)
    {
      id: 'q_cartoes_1',
      secao: 'contas-cartoes',
      texto: 'Possui o cartão mais adequado aos objetivos?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_cartoes_2',
      secao: 'contas-cartoes',
      texto: 'Paga tudo que consegue no cartão de crédito?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_cartoes_3',
      secao: 'contas-cartoes',
      texto: 'Concentra os gastos em apenas um cartão de crédito?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_cartoes_4',
      secao: 'contas-cartoes',
      texto: 'Faz uso estratégico de compras bonificadas?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_cartoes_5',
      secao: 'contas-cartoes',
      texto: 'É livre de taxas de conta / anuidades de cartão / outras desnecessárias?',
      tipo: 'auto',
      autoDetect: function() {
        const contas = window.getContasCartoesData ? window.getContasCartoesData() : [];
        if (contas.length === 0) return null;
        const todasSemAnuidade = contas.every(c => 
          !c.anuidade || parseFloat(c.anuidade) === 0
        );
        return todasSemAnuidade ? 'SIM' : null;
      }
    },

    // SEÇÃO: FLUXO DE CAIXA / ORÇAMENTO (5)
    {
      id: 'q_fluxo_1',
      secao: 'fluxo-caixa',
      texto: 'Planeja os gastos anuais antecipadamente?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_fluxo_2',
      secao: 'fluxo-caixa',
      texto: 'Confere o desempenho do fluxo todo mês?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_fluxo_3',
      secao: 'fluxo-caixa',
      texto: 'Acompanha o fluxo diariamente/semanalmente?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_fluxo_4',
      secao: 'fluxo-caixa',
      texto: 'Poupa todo mês?',
      tipo: 'auto',
      autoDetect: function() {
        const fluxo = window.getFluxoCaixaData ? window.getFluxoCaixaData() : {};
        const investimentos = fluxo.investimentos || [];
        if (investimentos.length === 0) return null;
        const totalInvestMensal = investimentos
          .filter(i => (i.tipo || '').toLowerCase() === 'mensal')
          .reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
        return totalInvestMensal > 0 ? 'SIM' : null;
      }
    },
    {
      id: 'q_fluxo_5',
      secao: 'fluxo-caixa',
      texto: 'Poupa o mínimo Ideal?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },

    // SEÇÃO: OBJETIVOS (5)
    {
      id: 'q_objetivos_1',
      secao: 'objetivos',
      texto: 'Possui Plano de ação e metas bem definidos para cada objetivo?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_objetivos_2',
      secao: 'objetivos',
      texto: 'Já tinha definido as metas de acúmulo para a aposentadoria?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_objetivos_3',
      secao: 'objetivos',
      texto: 'Já fez estudo para saber se com a estratégia atual conseguirá atingir os objetivos no prazo desejado?',
      tipo: 'manual',
      autoDetect: function() { return null; }
    },
    {
      id: 'q_objetivos_4',
      secao: 'objetivos',
      texto: 'Poupa o suficiente para realizar cada objetivo no prazo desejado?',
      tipo: 'auto',
      autoDetect: function() {
        const objetivos = window.getObjetivosData ? window.getObjetivosData() : {};
        const lista = objetivos.objetivos || [];
        if (lista.length === 0) return null;
        const todosSuficientes = lista.every(o => {
          const poupaMensal = parseFloat(o.valor_poupar_mensal) || 0;
          const precisaPoupar = parseFloat(o.quanto_precisa_poupar) || 0;
          return precisaPoupar <= 0 || poupaMensal >= precisaPoupar;
        });
        return todosSuficientes ? 'SIM' : null;
      }
    },
    {
      id: 'q_objetivos_5',
      secao: 'objetivos',
      texto: 'Conseguirá atingir os objetivos no prazo desejado?',
      tipo: 'auto',
      autoDetect: function() {
        const objetivos = window.getObjetivosData ? window.getObjetivosData() : {};
        const lista = objetivos.objetivos || [];
        if (lista.length === 0) return null;
        const todosViáveis = lista.every(o => {
          const acumulado = parseFloat(o.valor_acumulado) || 0;
          const necessario = parseFloat(o.quanto_seria) || 0;
          return necessario <= 0 || acumulado >= necessario;
        });
        return todosViáveis ? 'SIM' : null;
      }
    }
  ];

  // =============================================
  // ESTADO DAS RESPOSTAS
  // =============================================
  let respostasQuestoes = {};

  // =============================================
  // RENDERIZAÇÃO DAS PERGUNTAS POR SEÇÃO
  // =============================================
  function renderQuestoesPorSecao(secaoId) {
    const container = document.getElementById(`questoes-${secaoId}`);
    if (!container) return;

    const questoesDaSecao = QUESTOES.filter(q => q.secao === secaoId);
    if (questoesDaSecao.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '<div class="questoes-pertinentes-box">';
    html += '<h4 class="questoes-titulo"><i class="fas fa-clipboard-check"></i> Questões Pertinentes</h4>';

    let temPerguntaVisivel = false;

    questoesDaSecao.forEach(q => {
      const autoResposta = q.autoDetect();
      const respostaManual = respostasQuestoes[q.id];
      const respostaFinal = respostaManual || autoResposta;

      // Se é automática e já tem resposta detectada, mostra como resolvida
      if (q.tipo === 'auto' && autoResposta && !respostaManual) {
        html += `<div class="questao-item questao-auto" data-id="${q.id}">
          <span class="questao-texto">${q.texto}</span>
          <span class="questao-resposta-auto ${autoResposta === 'SIM' ? 'resposta-sim' : autoResposta === 'INAPLICÁVEL' ? 'resposta-inaplicavel' : 'resposta-nao'}">
            ${autoResposta} <i class="fas fa-robot" title="Detectado automaticamente"></i>
          </span>
        </div>`;
      } else if (autoResposta === 'INAPLICÁVEL' && !respostaManual) {
        // Inaplicável automático - mostra mas não editável
        html += `<div class="questao-item questao-auto" data-id="${q.id}">
          <span class="questao-texto">${q.texto}</span>
          <span class="questao-resposta-auto resposta-inaplicavel">
            INAPLICÁVEL <i class="fas fa-robot" title="Detectado automaticamente"></i>
          </span>
        </div>`;
      } else {
        // Pergunta manual ou auto sem dados - mostra botões
        temPerguntaVisivel = true;
        html += `<div class="questao-item questao-manual" data-id="${q.id}">
          <span class="questao-texto">${q.texto}</span>
          <div class="questao-botoes">
            <button type="button" class="btn-questao btn-sim ${respostaFinal === 'SIM' ? 'ativo' : ''}" 
              onclick="window.responderQuestao('${q.id}', 'SIM')">SIM</button>
            <button type="button" class="btn-questao btn-nao ${respostaFinal === 'NÃO' ? 'ativo' : ''}" 
              onclick="window.responderQuestao('${q.id}', 'NÃO')">NÃO</button>
            <button type="button" class="btn-questao btn-inaplicavel ${respostaFinal === 'INAPLICÁVEL' ? 'ativo' : ''}" 
              onclick="window.responderQuestao('${q.id}', 'INAPLICÁVEL')">N/A</button>
          </div>
        </div>`;
      }
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // =============================================
  // RESPONDER QUESTÃO
  // =============================================
  window.responderQuestao = function(questaoId, resposta) {
    respostasQuestoes[questaoId] = resposta;
    
    // Re-renderizar a seção da questão
    const questao = QUESTOES.find(q => q.id === questaoId);
    if (questao) {
      renderQuestoesPorSecao(questao.secao);
    }
    
    // Atualizar gabarito se a seção estiver visível
    renderGabaritoFinal();
  };

  // =============================================
  // GABARITO FINAL - SEÇÃO INFORMAÇÕES FALTANTES
  // =============================================
  function renderGabaritoFinal() {
    const container = document.getElementById('gabarito-final-container');
    if (!container) return;

    let totalSim = 0;
    let totalNao = 0;
    let totalInaplicavel = 0;
    let totalPerguntas = QUESTOES.length;

    const secoes = {
      'patrimonio-fisico': { nome: 'Patrimônio Físico', questoes: [] },
      'produtos-protecao': { nome: 'Proteção / Saúde / Renda', questoes: [] },
      'patrimonio-liquido': { nome: 'Investimentos', questoes: [] },
      'dividas': { nome: 'Dívidas', questoes: [] },
      'sucessao': { nome: 'Sucessão', questoes: [] },
      'ir': { nome: 'Impostos', questoes: [] },
      'contas-cartoes': { nome: 'Cartões de Crédito', questoes: [] },
      'fluxo-caixa': { nome: 'Fluxo de Caixa', questoes: [] },
      'objetivos': { nome: 'Objetivos', questoes: [] }
    };

    QUESTOES.forEach(q => {
      const autoResposta = q.autoDetect();
      const respostaManual = respostasQuestoes[q.id];
      const respostaFinal = respostaManual || autoResposta || '';
      const origem = respostaManual ? 'Manual' : (autoResposta ? 'Automático' : 'Pendente');

      if (respostaFinal === 'SIM') totalSim++;
      else if (respostaFinal === 'NÃO') totalNao++;
      else if (respostaFinal === 'INAPLICÁVEL') totalInaplicavel++;

      if (secoes[q.secao]) {
        secoes[q.secao].questoes.push({
          texto: q.texto,
          resposta: respostaFinal,
          origem: origem
        });
      }
    });

    const totalRespondidas = totalSim + totalNao + totalInaplicavel;
    const totalContavel = totalSim + totalNao; // Inaplicável não conta
    const percentAproveitamento = totalContavel > 0 ? ((totalSim / totalContavel) * 100).toFixed(1) : '0.0';
    const percentMelhorias = totalContavel > 0 ? ((totalNao / totalContavel) * 100).toFixed(1) : '0.0';

    // Obter nome do cliente
    const nomeCliente = document.getElementById('nome_diagnostico')?.value || 'o(a) cliente';

    let html = '';

    // RESUMO
    html += `<div class="gabarito-resumo">
      <h4><i class="fas fa-chart-pie"></i> Resumo da Análise</h4>
      <div class="resumo-stats">
        <div class="stat-box stat-total">
          <span class="stat-numero">${totalPerguntas}</span>
          <span class="stat-label">Pontos de Análise</span>
        </div>
        <div class="stat-box stat-sim">
          <span class="stat-numero">${totalSim}</span>
          <span class="stat-label">Adequados (SIM)</span>
        </div>
        <div class="stat-box stat-nao">
          <span class="stat-numero">${totalNao}</span>
          <span class="stat-label">Inadequados (NÃO)</span>
        </div>
        <div class="stat-box stat-pendente">
          <span class="stat-numero">${totalPerguntas - totalRespondidas}</span>
          <span class="stat-label">Pendentes</span>
        </div>
      </div>
      <div class="resumo-barras">
        <div class="barra-container">
          <span class="barra-label">Aproveitamento:</span>
          <div class="barra-fundo">
            <div class="barra-preenchida barra-sim" style="width: ${percentAproveitamento}%"></div>
          </div>
          <span class="barra-valor">${percentAproveitamento}%</span>
        </div>
        <div class="barra-container">
          <span class="barra-label">Melhorias:</span>
          <div class="barra-fundo">
            <div class="barra-preenchida barra-nao" style="width: ${percentMelhorias}%"></div>
          </div>
          <span class="barra-valor">${percentMelhorias}%</span>
        </div>
      </div>
    </div>`;

    // TEXTO DO RESUMO (como na planilha)
    if (totalContavel > 0) {
      html += `<div class="gabarito-texto-resumo">
        <p>Após a coleta de todos os dados pessoais, financeiros e dos objetivos, foram <strong>${totalPerguntas} pontos de análise</strong>. 
        Dentre estes pontos analisados, há <strong>${totalSim}</strong> que estão adequados para a LIBERDADE FINANCEIRA no momento atual 
        e <strong>${totalNao}</strong> que estão inadequados.</p>
        <p>Isto significa que, financeiramente falando, há cerca de <strong>${percentAproveitamento}% de aproveitamento financeiro</strong> 
        contra <strong>${percentMelhorias}% de potenciais de melhorias</strong>.</p>
        <p>Este potencial financeiro será explorado à medida que TODOS itens marcados como NÃO forem sendo convertidos para SIM. 
        O processo de mudança descrito acima permitirá e proporcionará a <strong>${nomeCliente}</strong> alcançar a liberdade financeira.</p>
      </div>`;
    }

    // O QUE O PLANO PRECISA CONTER
    const planoConteudo = gerarConteudoPlano();
    if (planoConteudo.length > 0) {
      html += `<div class="gabarito-plano">
        <h4><i class="fas fa-file-alt"></i> O que o PLANO FINANCEIRO precisa conter:</h4>
        <div class="plano-topicos">`;
      
      planoConteudo.forEach(topico => {
        html += `<div class="plano-topico">
          <h5>${topico.titulo}</h5>
          <ul>${topico.itens.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>`;
      });
      
      html += `</div></div>`;
    }

    // GABARITO DETALHADO POR SEÇÃO
    html += `<div class="gabarito-detalhado">
      <h4><i class="fas fa-list-check"></i> Gabarito Detalhado</h4>`;

    Object.keys(secoes).forEach(secaoId => {
      const secao = secoes[secaoId];
      if (secao.questoes.length === 0) return;

      html += `<div class="gabarito-secao">
        <h5>${secao.nome}</h5>
        <table class="gabarito-tabela">
          <thead><tr><th>Pergunta</th><th>Resposta</th><th>Origem</th></tr></thead>
          <tbody>`;

      secao.questoes.forEach(q => {
        const classeResposta = q.resposta === 'SIM' ? 'resp-sim' : 
                               q.resposta === 'NÃO' ? 'resp-nao' : 
                               q.resposta === 'INAPLICÁVEL' ? 'resp-na' : 'resp-pendente';
        const classeOrigem = q.origem === 'Automático' ? 'origem-automatico' : 
                             q.origem === 'Pendente' ? 'origem-pendente' : 'origem-manual';
        html += `<tr>
          <td>${q.texto}</td>
          <td class="${classeResposta}">${q.resposta || '—'}</td>
          <td class="${classeOrigem}">${q.origem}</td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // =============================================
  // GERAR CONTEÚDO DO PLANO FINANCEIRO
  // =============================================
  function gerarConteudoPlano() {
    const topicos = [];

    // Verificar NÃOs por seção
    const naosPorSecao = {};
    QUESTOES.forEach(q => {
      const autoResposta = q.autoDetect();
      const respostaManual = respostasQuestoes[q.id];
      const respostaFinal = respostaManual || autoResposta || '';
      if (respostaFinal === 'NÃO') {
        if (!naosPorSecao[q.secao]) naosPorSecao[q.secao] = [];
        naosPorSecao[q.secao].push(q.texto);
      }
    });

    if (naosPorSecao['objetivos']) {
      topicos.push({
        titulo: 'Com relação aos principais objetivos:',
        itens: [
          'Montar o Plano de Ação para cada objetivo, com metas bem definidas e alcançáveis.',
          'Estudar e apresentar planejamento de aposentadoria (reserva de longo prazo) adequada ao poder de poupança.',
          'Montar estudo que permita que os objetivos sejam realizados de forma saudável, baseado nos parâmetros mercadológicos vigentes e condições financeiras atuais.'
        ]
      });
    }

    if (naosPorSecao['fluxo-caixa']) {
      topicos.push({
        titulo: 'Com relação ao controle do orçamento:',
        itens: [
          'Apresentar fundamentos, ferramentas e sugestões para que permitam:',
          'Acompanhar os gastos anuais antecipadamente;',
          'Conferir o desempenho do orçamento mensal estabelecido e reestruturar o planejamento anual;',
          'Registrar e controlar o fluxo de caixa para que os dados possam ser analisados e o orçamento do mês e ano possam ser recalculados.'
        ]
      });
    }

    if (naosPorSecao['contas-cartoes']) {
      topicos.push({
        titulo: 'Com relação a cartão de crédito e milhas:',
        itens: [
          'Pesquisar, estudar e apresentar opções de:',
          'Cartão de crédito mais adequado às necessidades e objetivos;',
          'Viabilidade de maximizar as despesas que podem ser inseridas no cartão de crédito;',
          'Adaptação para concentração de gastos no melhor cartão de crédito disponível;',
          'Gastos inteligentes com compras que maximizarão o poder de pontuação ou cashback do cartão de crédito.'
        ]
      });
    }

    if (naosPorSecao['ir']) {
      topicos.push({
        titulo: 'Com relação ao imposto de renda:',
        itens: [
          'Analisar e apresentar:',
          'Viabilidade de investir visando a redução do imposto pago ou aumento na restituição.'
        ]
      });
    }

    if (naosPorSecao['patrimonio-liquido']) {
      topicos.push({
        titulo: 'Com relação ao patrimônio líquido:',
        itens: [
          'Estudar e apresentar soluções, metas de rentabilidade e de valores para reservas de:',
          'Longo Prazo;',
          'Objetivos.',
          'Estudar e apresentar soluções para ajustar a distribuição dos recursos e adequá-los ao perfil de investidor.'
        ]
      });
    }

    if (naosPorSecao['produtos-protecao']) {
      topicos.push({
        titulo: 'Com relação ao risco de perder a capacidade de gerar renda e saúde:',
        itens: [
          'Analisar e apresentar soluções de proteção da renda (seguros de vida/invalidez);',
          'Pesquisar e apresentar opções de planos de saúde adequados ao perfil e necessidades.'
        ]
      });
    }

    if (naosPorSecao['patrimonio-fisico']) {
      topicos.push({
        titulo: 'Com relação à proteção do patrimônio:',
        itens: [
          'Analisar e apresentar soluções de seguros para proteção dos bens patrimoniais.'
        ]
      });
    }

    if (naosPorSecao['dividas']) {
      topicos.push({
        titulo: 'Com relação às dívidas:',
        itens: [
          'Analisar e apresentar estratégias para quitação ou renegociação das dívidas;',
          'Estudar viabilidade de portabilidade para taxas menores.'
        ]
      });
    }

    if (naosPorSecao['sucessao']) {
      topicos.push({
        titulo: 'Com relação ao planejamento sucessório:',
        itens: [
          'Estudar e apresentar estratégias de blindagem patrimonial e planejamento sucessório;',
          'Analisar viabilidade de estratégias para desoneração dos herdeiros.'
        ]
      });
    }

    return topicos;
  }

  // =============================================
  // RENDERIZAR TODAS AS SEÇÕES
  // =============================================
  function renderTodasQuestoes() {
    const secoes = ['patrimonio-fisico', 'produtos-protecao', 'patrimonio-liquido', 
                    'dividas', 'sucessao', 'ir', 'contas-cartoes', 'fluxo-caixa', 'objetivos'];
    secoes.forEach(secao => renderQuestoesPorSecao(secao));
    renderGabaritoFinal();
  }

  // =============================================
  // GET / SET DATA (para salvar/carregar)
  // =============================================
  window.getQuestoesData = function() {
    const resultado = {};
    QUESTOES.forEach(q => {
      const autoResposta = q.autoDetect();
      const respostaManual = respostasQuestoes[q.id];
      resultado[q.id] = {
        texto: q.texto,
        secao: q.secao,
        resposta: respostaManual || autoResposta || '',
        origem: respostaManual ? 'manual' : (autoResposta ? 'auto' : 'pendente')
      };
    });
    return resultado;
  };

  window.setQuestoesData = function(data) {
    if (!data) return;
    respostasQuestoes = {};
    Object.keys(data).forEach(id => {
      if (data[id].origem === 'manual' && data[id].resposta) {
        respostasQuestoes[id] = data[id].resposta;
      }
    });
    renderTodasQuestoes();
  };

  // =============================================
  // INICIALIZAÇÃO
  // =============================================
  window.renderQuestoes = renderTodasQuestoes;
  window.renderGabaritoFinal = renderGabaritoFinal;

  // Renderizar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(renderTodasQuestoes, 1500); // Aguardar outros módulos carregarem
    });
  } else {
    setTimeout(renderTodasQuestoes, 1500);
  }

})();
