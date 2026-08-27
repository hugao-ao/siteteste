// =============================================
// MÓDULO DE QUESTÕES PERTINENTES
// questoes-module.js
// =============================================

(function() {
  'use strict';

  // =============================================
  // DEFINIÇÃO DAS 36 PERGUNTAS (REDISTRIBUÍDAS)
  // Todas manuais, sem auto-detecção
  // =============================================
  const QUESTOES = [
    // SEÇÃO: PATRIMÔNIO FÍSICO (0 - perguntas movidas para Produtos & Proteção)

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

    // SEÇÃO: PRODUTOS & PROTEÇÃO (7 - inclui proteção de patrimônios)
    {
      id: 'q_patrimonio_1',
      secao: 'produtos-protecao',
      texto: 'Já tem proteção contra prejuízos de todos os patrimônios?'
    },
    {
      id: 'q_patrimonio_2',
      secao: 'produtos-protecao',
      texto: 'Melhor custo benefício da proteção dos patrimônios?'
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

    // SEÇÃO: FLUXO DE CAIXA (9) — inclui perguntas sobre renda
    {
      id: 'q_protecao_1',
      secao: 'fluxo-caixa',
      texto: '100% da renda é independente do trabalho?'
    },
    {
      id: 'q_protecao_2',
      secao: 'fluxo-caixa',
      texto: '80% ou mais da renda é estável?'
    },
    {
      id: 'q_protecao_3',
      secao: 'fluxo-caixa',
      texto: 'Consegue aumentar a renda no curto/médio prazo conforme a necessidade?'
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

    // SEÇÃO: OBJETIVOS (3)
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
      id: 'q_objetivos_5',
      secao: 'objetivos',
      texto: 'Conseguirá atingir os objetivos no prazo desejado?'
    }
  ];

  // =============================================
  // ESTADO DAS RESPOSTAS
  // =============================================
  let respostasQuestoes = {};

  // Toda pergunta nasce como N/A. Assim o diagnóstico já pode ser salvo desde
  // o primeiro momento com todas as questões respondidas de alguma maneira,
  // e nunca existe estado "pendente".
  const RESPOSTA_PADRAO = 'INAPLICÁVEL';

  function respostaDe(questaoId) {
    return respostasQuestoes[questaoId] || RESPOSTA_PADRAO;
  }

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
      const resposta = respostaDe(q.id);
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
      const resposta = respostaDe(q.id);

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
  // DADOS DO DIAGNÓSTICO USADOS COMO CONDIÇÃO
  // Só leitura. Nenhum cálculo entra no texto do plano — o plano declara
  // o que será entregue, nunca o resultado da análise.
  // =============================================
  function coletarDados() {
    const seguro = (fn, padrao) => {
      try { const v = fn(); return v == null ? padrao : v; } catch (e) { return padrao; }
    };

    const objetivosData = seguro(() => window.getObjetivosData && window.getObjetivosData(), null);
    const listaObjetivos = (objetivosData && objetivosData.objetivos) || [];
    const dividas = seguro(() => window.getDividasData && window.getDividasData(), []) || [];
    const protecao = seguro(() => window.getProdutosProtecaoData && window.getProdutosProtecaoData(), []) || [];
    const declaracoesIR = seguro(() => window.getDeclaracoesIRData && window.getDeclaracoesIRData(), []) || [];
    const investimentos = seguro(() => window.getPatrimoniosLiquidosData && window.getPatrimoniosLiquidosData(), []) || [];
    const contasRaw = seguro(() => window.getContasCartoesData && window.getContasCartoesData(), null);
    const contas = (contasRaw && contasRaw.contasCartoes) || [];

    // Patrimônio físico e dependentes não têm getter: vêm do próprio formulário
    const valoresPreenchidos = (containerId, sufixo) => {
      const cont = document.getElementById(containerId);
      if (!cont) return [];
      return Array.prototype.slice
        .call(cont.querySelectorAll('input[id$="' + sufixo + '"]'))
        .map(el => String(el.value || '').trim())
        .filter(Boolean);
    };

    const bens = valoresPreenchidos('content-patrimonio-fisico', '_tipo');
    const dependentes = valoresPreenchidos('content-dependentes', '_nome');

    const tipoProtecao = (padrao) => protecao.some(p =>
      padrao.test(String(p.tipo_produto || '') + ' ' + String(p.objeto || ''))
    );

    return {
      objetivos: listaObjetivos.filter(o => o.tipo !== 'aposentadoria' && o.tipo !== 'intangivel'),
      nomesObjetivos: listaObjetivos
        .filter(o => o.tipo !== 'aposentadoria' && o.descricao)
        .map(o => o.descricao),
      temAposentadoria: listaObjetivos.some(o => o.tipo === 'aposentadoria'),
      dividas: dividas,
      nomesCredores: dividas.map(d => d.credor || d.instituicao).filter(Boolean),
      investimentos: investimentos,
      bens: bens,
      dependentes: dependentes,
      declaracoesIR: declaracoesIR,
      contas: contas,
      temSeguroPatrimonial: tipoProtecao(/patrim|resid|autom|veic|imov|bike|bem/i),
      temSeguroVida: tipoProtecao(/vida|invalid|acident|trabalh/i),
      temPlanoSaude: tipoProtecao(/sa[úu]de|m[ée]dic|odont/i)
    };
  }

  function listar(nomes, limite) {
    const max = limite || 4;
    if (!nomes || !nomes.length) return '';
    if (nomes.length <= max) return nomes.join(', ');
    return nomes.slice(0, max).join(', ') + ' e mais ' + (nomes.length - max);
  }

  // =============================================
  // REGRAS DO PLANO
  // Cada item nasce de uma pergunta específica em NÃO (camada 1) e, quando
  // indicado, também depende de existir o dado correspondente (camada 2).
  // "fusoes" junta perguntas irmãs: se TODAS estiverem em NÃO, sai um item
  // único e abrangente no lugar dos itens individuais.
  // =============================================
  function definirRegras(d) {
    return [
      {
        secao: 'objetivos',
        titulo: 'Com relação aos principais objetivos:',
        fusoes: [],
        itens: [
          {
            id: 'q_objetivos_1',
            texto: d.nomesObjetivos.length
              ? 'Montar o plano de ação e as metas de cada objetivo: ' + listar(d.nomesObjetivos) + '.'
              : 'Montar o plano de ação e as metas de cada objetivo.'
          },
          {
            id: 'q_objetivos_2',
            texto: d.temAposentadoria
              ? 'Projetar o planejamento de aposentadoria.'
              : 'Incluir a aposentadoria entre os objetivos e projetar o planejamento.'
          },
          {
            id: 'q_objetivos_5',
            texto: 'Estudar a viabilidade dos objetivos e apresentar os ajustes de prazo, meta ou aporte.'
          }
        ]
      },
      {
        secao: 'fluxo-caixa',
        titulo: 'Com relação ao controle do orçamento:',
        fusoes: [
          {
            ids: ['q_fluxo_1', 'q_fluxo_2', 'q_fluxo_3'],
            texto: 'Implantar o ciclo de controle do orçamento: registro, conferência mensal e replanejamento anual.'
          },
          {
            ids: ['q_fluxo_4', 'q_fluxo_5'],
            texto: 'Projetar a poupança mensal e transformá-la em compromisso fixo do orçamento.'
          }
        ],
        itens: [
          { id: 'q_protecao_1', texto: 'Traçar o caminho para a renda independente do trabalho.' },
          { id: 'q_protecao_2', texto: 'Estudar formas de ampliar a parcela estável da renda.' },
          { id: 'q_protecao_3', texto: 'Mapear caminhos de aumento de renda no curto e médio prazo.' },
          { id: 'q_protecao_4', texto: 'Estudar a diversificação das fontes de renda.' },
          { id: 'q_fluxo_1', texto: 'Montar o planejamento anual antecipado dos gastos.' },
          { id: 'q_fluxo_2', texto: 'Implantar a rotina de conferência mensal do orçamento.' },
          { id: 'q_fluxo_3', texto: 'Entregar ferramenta e rotina de registro do fluxo de caixa.' },
          { id: 'q_fluxo_4', texto: 'Estabelecer a poupança mensal como compromisso fixo do orçamento.' },
          { id: 'q_fluxo_5', texto: 'Projetar o percentual mínimo de poupança e o caminho até ele.' }
        ]
      },
      {
        secao: 'contas-cartoes',
        titulo: 'Com relação a contas, cartão de crédito e milhas:',
        fusoes: [
          {
            ids: ['q_cartoes_2', 'q_cartoes_4'],
            texto: 'Estruturar o uso do cartão: migração de despesas e aproveitamento de bonificações.'
          }
        ],
        itens: [
          { id: 'q_cartoes_1', texto: 'Pesquisar e indicar o cartão mais aderente aos objetivos.' },
          { id: 'q_cartoes_2', texto: 'Avaliar quais despesas podem migrar para o cartão de crédito.' },
          {
            id: 'q_cartoes_3',
            texto: 'Estudar a concentração dos gastos no melhor cartão disponível.',
            dado: () => d.contas.length > 1
          },
          { id: 'q_cartoes_4', texto: 'Estruturar o uso de compras bonificadas e o aproveitamento de pontos.' },
          {
            id: 'q_cartoes_5',
            texto: 'Levantar e eliminar tarifas e anuidades desnecessárias.',
            dado: () => d.contas.length > 0
          }
        ]
      },
      {
        secao: 'ir',
        titulo: 'Com relação ao imposto de renda:',
        fusoes: [],
        itens: [
          { id: 'q_ir_1', texto: 'Estudar a forma mais vantajosa de receber a renda.' },
          {
            id: 'q_ir_2',
            texto: 'Comparar os modelos de declaração e indicar o mais adequado ao perfil.',
            dado: () => d.declaracoesIR.length > 0
          },
          { id: 'q_ir_3', texto: 'Analisar investimentos com efeito tributário e apresentar as opções cabíveis.' }
        ]
      },
      {
        secao: 'patrimonio-liquido',
        titulo: 'Com relação ao patrimônio líquido:',
        fusoes: [],
        itens: [
          { id: 'q_investimentos_1', texto: 'Projetar a reserva de longo prazo e as metas de rentabilidade que a sustentam.' },
          { id: 'q_investimentos_2', texto: 'Dimensionar a reserva de emergência e definir onde ela ficará alocada.' },
          {
            id: 'q_investimentos_3',
            texto: d.nomesObjetivos.length
              ? 'Vincular uma reserva a cada objetivo: ' + listar(d.nomesObjetivos) + '.'
              : 'Definir os objetivos antes de vincular reservas específicas a eles.'
          },
          {
            id: 'q_investimentos_4',
            texto: 'Reenquadrar a distribuição dos recursos ao perfil de investidor.',
            dado: () => d.investimentos.length > 0
          }
        ]
      },
      {
        secao: 'produtos-protecao',
        titulo: 'Com relação à proteção patrimonial, renda e saúde:',
        fusoes: [
          { ids: ['q_patrimonio_1', 'q_patrimonio_2'], texto: 'Estruturar e cotar a proteção do patrimônio.' },
          { ids: ['q_protecao_5', 'q_protecao_6'], texto: 'Estruturar e cotar a proteção da renda: vida e invalidez.' },
          { ids: ['q_protecao_7', 'q_protecao_8'], texto: 'Estruturar e cotar a proteção da saúde.' }
        ],
        itens: [
          {
            id: 'q_patrimonio_1',
            texto: d.bens.length
              ? 'Analisar e apresentar soluções de seguro para os bens do patrimônio: ' + listar(d.bens) + '.'
              : 'Analisar e apresentar soluções de seguro para os bens do patrimônio.',
            dado: () => d.bens.length > 0
          },
          {
            id: 'q_patrimonio_2',
            texto: 'Cotar e comparar as apólices patrimoniais existentes.',
            dado: () => d.temSeguroPatrimonial
          },
          { id: 'q_protecao_5', texto: 'Estruturar a proteção da renda: vida e invalidez.' },
          {
            id: 'q_protecao_6',
            texto: 'Revisar e cotar as apólices de vida e invalidez.',
            dado: () => d.temSeguroVida
          },
          {
            id: 'q_protecao_7',
            texto: d.dependentes.length
              ? 'Estudar e apresentar opções de plano de saúde para as pessoas do planejamento, incluindo ' + listar(d.dependentes) + '.'
              : 'Estudar e apresentar opções de plano de saúde para as pessoas do planejamento.'
          },
          {
            id: 'q_protecao_8',
            texto: 'Revisar e cotar o plano de saúde atual.',
            dado: () => d.temPlanoSaude
          },
          { id: 'q_protecao_9', texto: 'Avaliar proteção para os animais.' }
        ]
      },
      {
        secao: 'dividas',
        titulo: 'Com relação às dívidas:',
        fusoes: [],
        itens: [
          {
            id: 'q_dividas_1',
            texto: d.nomesCredores.length
              ? 'Apresentar estratégias de quitação ou renegociação: ' + listar(d.nomesCredores) + '.'
              : 'Apresentar estratégias de quitação ou renegociação.',
            dado: () => d.dividas.length > 0
          },
          {
            id: 'q_dividas_2',
            texto: 'Estudar portabilidade e o reenquadramento das parcelas ao orçamento.',
            dado: () => d.dividas.length > 0
          }
        ]
      },
      {
        secao: 'sucessao',
        titulo: 'Com relação ao planejamento sucessório:',
        fusoes: [],
        itens: [
          {
            id: 'q_sucessao_1',
            texto: d.dependentes.length
              ? 'Conduzir a definição da destinação do patrimônio, considerando ' + listar(d.dependentes) + '.'
              : 'Conduzir a definição da destinação do patrimônio.'
          },
          {
            id: 'q_sucessao_2',
            texto: 'Apresentar estratégias de blindagem patrimonial.',
            dado: () => d.bens.length > 0
          },
          { id: 'q_sucessao_3', texto: 'Apresentar estratégias de desoneração do inventário.' }
        ]
      }
    ];
  }

  // =============================================
  // GERAR CONTEÚDO DO PLANO FINANCEIRO
  // =============================================
  function gerarConteudoPlano() {
    const dados = coletarDados();
    const regras = definirRegras(dados);
    const ehNao = id => respostaDe(id) === 'NÃO';
    const topicos = [];

    // Ordem das seções é fixa: é a ordem de definirRegras.
    // Seção sem nenhum item sobrevivente simplesmente não aparece.
    regras.forEach(regra => {
      const itens = [];
      const consumidos = {};

      (regra.fusoes || []).forEach(fusao => {
        if (fusao.ids.every(ehNao)) {
          itens.push(fusao.texto);
          fusao.ids.forEach(id => { consumidos[id] = true; });
        }
      });

      (regra.itens || []).forEach(item => {
        if (consumidos[item.id]) return;
        if (!ehNao(item.id)) return;
        if (item.dado && !item.dado()) return;
        itens.push(item.texto);
      });

      if (itens.length > 0) {
        topicos.push({ titulo: regra.titulo, itens: itens });
      }
    });

    // Fechamento fixo: só faz sentido se houver ao menos uma frente
    if (topicos.length > 0) {
      topicos.push({
        titulo: 'Para fechar o plano:',
        itens: ['Consolidar as frentes acima em cronograma, com responsáveis e prazos.']
      });
    }

    return topicos;
  }

  // =============================================
  // RENDERIZAR TODAS AS SEÇÕES
  // =============================================
  function renderTodasQuestoes() {
    const secoes = ['patrimonio-liquido', 'dividas', 
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
        resposta: respostaDe(q.id)
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
