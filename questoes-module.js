// =============================================
// MÓDULO DE QUESTÕES PERTINENTES
// questoes-module.js
// =============================================

(function() {
  'use strict';

  // =============================================
  // DEFINIÇÃO DAS 38 PERGUNTAS (REDISTRIBUÍDAS)
  // Todas manuais, sem auto-detecção
  // =============================================
  const QUESTOES = [
    // SEÇÃO: PATRIMÔNIO FÍSICO (2)
    {
      id: 'q_patrimonio_1',
      secao: 'patrimonio-fisico',
      texto: 'Já tem proteção contra prejuízos de todos os patrimônios?'
    },
    {
      id: 'q_patrimonio_2',
      secao: 'patrimonio-fisico',
      texto: 'Melhor custo benefício da proteção dos patrimônios?'
    },

    // SEÇÃO: PATRIMÔNIO LÍQUIDO / INVESTIMENTOS (4)
    {
      id: 'q_investimentos_1',
      secao: 'patrimonio-liquido',
      texto: 'Possui reserva de longo prazo adequada?'
    },
    {
      id: 'q_investimentos_2',
      secao: 'patrimonio-liquido',
      texto: 'Possui reserva de emergência adequada?'
    },
    {
      id: 'q_investimentos_3',
      secao: 'patrimonio-liquido',
      texto: 'Possui reservas específicas para cada objetivo?'
    },
    {
      id: 'q_investimentos_4',
      secao: 'patrimonio-liquido',
      texto: 'A distribuição dos recursos está adequada ao perfil de investidor?'
    },

    // SEÇÃO: DÍVIDAS (2)
    {
      id: 'q_dividas_1',
      secao: 'dividas',
      texto: 'É livre de dívidas?'
    },
    {
      id: 'q_dividas_2',
      secao: 'dividas',
      texto: 'Sensação que as parcelas estão adequadas (não atrapalham) o fluxo de caixa?'
    },

    // SEÇÃO: SUCESSÃO (3)
    {
      id: 'q_sucessao_1',
      secao: 'sucessao',
      texto: 'Definiu como será a distribuição do patrimônio para os (futuros) herdeiros?'
    },
    {
      id: 'q_sucessao_2',
      secao: 'sucessao',
      texto: 'Patrimônio está blindado de forma a garantir exatamente a sucessão desejada?'
    },
    {
      id: 'q_sucessao_3',
      secao: 'sucessao',
      texto: 'Tem estratégia em andamento para desonerar os Herdeiros?'
    },

    // SEÇÃO: PRODUTOS & PROTEÇÃO (7)
    {
      id: 'q_protecao_1',
      secao: 'produtos-protecao',
      texto: '100% da renda é independente do trabalho?'
    },
    {
      id: 'q_protecao_3',
      secao: 'produtos-protecao',
      texto: 'Consegue aumentar a renda no curto/médio prazo conforme a necessidade?'
    },
    {
      id: 'q_protecao_5',
      secao: 'produtos-protecao',
      texto: 'Possui garantia da força de trabalho?'
    },
    {
      id: 'q_protecao_6',
      secao: 'produtos-protecao',
      texto: 'Melhor custo benefício da garantia do trabalho?'
    },
    {
      id: 'q_protecao_7',
      secao: 'produtos-protecao',
      texto: 'Proteção adequada para saúde das PESSOAS?'
    },
    {
      id: 'q_protecao_8',
      secao: 'produtos-protecao',
      texto: 'Melhor custo benefício da proteção saúde?'
    },
    {
      id: 'q_protecao_9',
      secao: 'produtos-protecao',
      texto: 'Proteção adequada para saúde dos PETs?'
    },

    // SEÇÃO: IMPOSTO DE RENDA (3)
    {
      id: 'q_ir_1',
      secao: 'ir',
      texto: 'Recebe os recursos da forma mais vantajosa possível?'
    },
    {
      id: 'q_ir_2',
      secao: 'ir',
      texto: 'Faz declaração da forma mais adequada para o perfil?'
    },
    {
      id: 'q_ir_3',
      secao: 'ir',
      texto: 'Investe visando reduzir o pagamento ou aumentar a restituição?'
    },

    // SEÇÃO: CONTAS & CARTÕES (5)
    {
      id: 'q_cartoes_1',
      secao: 'contas-cartoes',
      texto: 'Possui o cartão mais adequado aos objetivos?'
    },
    {
      id: 'q_cartoes_2',
      secao: 'contas-cartoes',
      texto: 'Paga tudo que consegue no cartão de crédito?'
    },
    {
      id: 'q_cartoes_3',
      secao: 'contas-cartoes',
      texto: 'Concentra os gastos em apenas um cartão de crédito?'
    },
    {
      id: 'q_cartoes_4',
      secao: 'contas-cartoes',
      texto: 'Faz uso estratégico de compras bonificadas?'
    },
    {
      id: 'q_cartoes_5',
      secao: 'contas-cartoes',
      texto: 'É livre de taxas de conta / anuidades de cartão / outras desnecessárias?'
    },

    // SEÇÃO: FLUXO DE CAIXA (7) — inclui perguntas sobre renda que antes estavam em Proteção
    {
      id: 'q_protecao_2',
      secao: 'fluxo-caixa',
      texto: '80% ou mais da renda é estável?'
    },
    {
      id: 'q_protecao_4',
      secao: 'fluxo-caixa',
      texto: 'Há mais de uma fonte de renda?'
    },
    {
      id: 'q_fluxo_1',
      secao: 'fluxo-caixa',
      texto: 'Planeja os gastos anuais antecipadamente?'
    },
    {
      id: 'q_fluxo_2',
      secao: 'fluxo-caixa',
      texto: 'Confere o desempenho do fluxo todo mês?'
    },
    {
      id: 'q_fluxo_3',
      secao: 'fluxo-caixa',
      texto: 'Acompanha o fluxo diariamente/semanalmente?'
    },
    {
      id: 'q_fluxo_4',
      secao: 'fluxo-caixa',
      texto: 'Poupa todo mês?'
    },
    {
      id: 'q_fluxo_5',
      secao: 'fluxo-caixa',
      texto: 'Poupa o mínimo Ideal?'
    },

    // SEÇÃO: OBJETIVOS (5)
    {
      id: 'q_objetivos_1',
      secao: 'objetivos',
      texto: 'Possui Plano de ação e metas bem definidos para cada objetivo?'
    },
    {
      id: 'q_objetivos_2',
      secao: 'objetivos',
      texto: 'Já tinha definido as metas de acúmulo para a aposentadoria?'
    },
    {
      id: 'q_objetivos_3',
      secao: 'objetivos',
      texto: 'Já fez estudo para saber se com a estratégia atual conseguirá atingir os objetivos no prazo desejado?'
    },
    {
      id: 'q_objetivos_4',
      secao: 'objetivos',
      texto: 'Poupa o suficiente para realizar cada objetivo no prazo desejado?'
    },
    {
      id: 'q_objetivos_5',
      secao: 'objetivos',
      texto: 'Conseguirá atingir os objetivos no prazo desejado?'
    }
  ];

  // =============================================
  // ESTADO DAS RESPOSTAS
  // =============================================
  let respostasQuestoes = {};

  // =============================================
  // RENDERIZAÇÃO DAS PERGUNTAS POR SEÇÃO (COMPACTA)
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

    questoesDaSecao.forEach(q => {
      const resposta = respostasQuestoes[q.id] || '';
      html += `<div class="questao-item" data-id="${q.id}">
        <span class="questao-texto">${q.texto}</span>
        <div class="questao-botoes">
          <button type="button" class="btn-questao btn-sim ${resposta === 'SIM' ? 'ativo' : ''}" 
            onclick="window.responderQuestao('${q.id}', 'SIM')">SIM</button>
          <button type="button" class="btn-questao btn-nao ${resposta === 'NÃO' ? 'ativo' : ''}" 
            onclick="window.responderQuestao('${q.id}', 'NÃO')">NÃO</button>
          <button type="button" class="btn-questao btn-inaplicavel ${resposta === 'INAPLICÁVEL' ? 'ativo' : ''}" 
            onclick="window.responderQuestao('${q.id}', 'INAPLICÁVEL')">N/A</button>
        </div>
      </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // =============================================
  // RESPONDER QUESTÃO
  // =============================================
  window.responderQuestao = function(questaoId, resposta) {
    // Toggle: se clicar na mesma resposta, desmarca
    if (respostasQuestoes[questaoId] === resposta) {
      delete respostasQuestoes[questaoId];
    } else {
      respostasQuestoes[questaoId] = resposta;
    }
    
    // Re-renderizar a seção da questão
    const questao = QUESTOES.find(q => q.id === questaoId);
    if (questao) {
      renderQuestoesPorSecao(questao.secao);
    }
    
    // Atualizar gabarito
    renderGabaritoFinal();
  };

  // =============================================
  // GABARITO FINAL - Renderizado no painel existente
  // (abaixo do botão salvar, junto com o validador)
  // =============================================
  function renderGabaritoFinal() {
    // Procura ou cria o container do gabarito no painel existente
    let gabaritoContainer = document.getElementById('gabarito-questoes-container');
    
    if (!gabaritoContainer) {
      // Criar o container e inserir após o painel-info-faltantes ou após o save-btn
      gabaritoContainer = document.createElement('div');
      gabaritoContainer.id = 'gabarito-questoes-container';
      gabaritoContainer.style.cssText = `
        margin: 2rem auto;
        max-width: 900px;
        padding: 1.5rem;
        background: var(--dark-bg, #1a1a2e);
        border: 2px solid var(--accent-color, #2e7d32);
        border-radius: 12px;
      `;
      
      const painelFaltantes = document.getElementById('painel-info-faltantes');
      if (painelFaltantes) {
        painelFaltantes.parentNode.insertBefore(gabaritoContainer, painelFaltantes.nextSibling);
      } else {
        const mainContent = document.getElementById('main-content') || document.querySelector('.main-content') || document.body;
        mainContent.appendChild(gabaritoContainer);
      }
    }

    let totalSim = 0;
    let totalNao = 0;
    let totalInaplicavel = 0;
    let totalPerguntas = QUESTOES.length;

    const secoes = {
      'patrimonio-fisico': { nome: 'Patrimônio Físico', questoes: [] },
      'patrimonio-liquido': { nome: 'Investimentos', questoes: [] },
      'dividas': { nome: 'Dívidas', questoes: [] },
      'sucessao': { nome: 'Sucessão', questoes: [] },
      'produtos-protecao': { nome: 'Proteção / Saúde / Renda', questoes: [] },
      'ir': { nome: 'Impostos', questoes: [] },
      'contas-cartoes': { nome: 'Cartões de Crédito', questoes: [] },
      'fluxo-caixa': { nome: 'Fluxo de Caixa', questoes: [] },
      'objetivos': { nome: 'Objetivos', questoes: [] }
    };

    QUESTOES.forEach(q => {
      const resposta = respostasQuestoes[q.id] || '';

      if (resposta === 'SIM') totalSim++;
      else if (resposta === 'NÃO') totalNao++;
      else if (resposta === 'INAPLICÁVEL') totalInaplicavel++;

      if (secoes[q.secao]) {
        secoes[q.secao].questoes.push({
          texto: q.texto,
          resposta: resposta
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

    // HEADER
    html += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; cursor: pointer;" onclick="window.toggleGabaritoQuestoes()">
      <h3 style="color: var(--accent-color, #2e7d32); margin: 0;">
        <i class="fas fa-chart-pie"></i> Análise das Questões Pertinentes
      </h3>
      <span style="color: var(--text-light, #ccc); font-size: 0.9rem;">
        ${totalRespondidas}/${totalPerguntas} respondidas
        <i class="fas fa-chevron-down" id="gabarito-questoes-chevron"></i>
      </span>
    </div>`;

    html += `<div id="gabarito-questoes-body">`;

    // RESUMO STATS
    html += `<div class="gabarito-resumo">
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

    // TEXTO DO RESUMO
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
          <thead><tr><th>Pergunta</th><th>Resposta</th></tr></thead>
          <tbody>`;

      secao.questoes.forEach(q => {
        const classeResposta = q.resposta === 'SIM' ? 'resp-sim' : 
                               q.resposta === 'NÃO' ? 'resp-nao' : 
                               q.resposta === 'INAPLICÁVEL' ? 'resp-na' : 'resp-pendente';
        html += `<tr>
          <td>${q.texto}</td>
          <td class="${classeResposta}">${q.resposta || '—'}</td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
    });

    html += '</div>';
    html += '</div>'; // fecha gabarito-questoes-body

    gabaritoContainer.innerHTML = html;
  }

  // Toggle expandir/retrair gabarito
  window.toggleGabaritoQuestoes = function() {
    const body = document.getElementById('gabarito-questoes-body');
    const chevron = document.getElementById('gabarito-questoes-chevron');
    if (body) {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      if (chevron) {
        chevron.className = isHidden ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      }
    }
  };

  // =============================================
  // GERAR CONTEÚDO DO PLANO FINANCEIRO
  // =============================================
  function gerarConteudoPlano() {
    const topicos = [];

    // Verificar NÃOs por seção
    const naosPorSecao = {};
    QUESTOES.forEach(q => {
      const resposta = respostasQuestoes[q.id] || '';
      if (resposta === 'NÃO') {
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
    const secoes = ['patrimonio-fisico', 'patrimonio-liquido', 'dividas', 
                    'sucessao', 'produtos-protecao', 'ir', 
                    'contas-cartoes', 'fluxo-caixa', 'objetivos'];
    secoes.forEach(secao => renderQuestoesPorSecao(secao));
    renderGabaritoFinal();
  }

  // =============================================
  // GET / SET DATA (para salvar/carregar)
  // =============================================
  window.getQuestoesData = function() {
    const resultado = {};
    QUESTOES.forEach(q => {
      resultado[q.id] = {
        texto: q.texto,
        secao: q.secao,
        resposta: respostasQuestoes[q.id] || ''
      };
    });
    return resultado;
  };

  window.setQuestoesData = function(data) {
    if (!data) return;
    respostasQuestoes = {};
    Object.keys(data).forEach(id => {
      if (data[id].resposta) {
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
      setTimeout(renderTodasQuestoes, 1500);
    });
  } else {
    setTimeout(renderTodasQuestoes, 1500);
  }

})();
