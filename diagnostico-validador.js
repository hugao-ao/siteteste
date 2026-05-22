// ========================================
// DIAGNÓSTICO VALIDADOR - Informações Faltantes para Ferramentas
// ========================================
// Este script analisa os dados preenchidos no diagnóstico e mostra
// uma lista organizada de informações faltantes para cada ferramenta.
// Deve ser incluído no diagnostico-financeiro.html

(function() {
  'use strict';

  // Mapeamento: quais campos cada ferramenta precisa de cada seção
  const REQUISITOS = {
    juros: {
      nome: 'Juros & Dívidas',
      icone: 'fa-percentage',
      cor: '#dc3545',
      secao: 'dividas',
      campos: [
        { campo: 'taxa_juros', label: 'Taxa de Juros (CET)', obrigatorio: true },
        { campo: 'taxa_juros_tipo', label: 'Tipo da Taxa (mensal/anual)', obrigatorio: true },
        { campo: 'tipo_amortizacao', label: 'Tipo de Amortização', obrigatorio: true },
        { campo: 'reajuste_anual', label: 'Reajuste Anual (%)', obrigatorio: false },
        { campo: 'saldo_devedor', label: 'Saldo Devedor Atualizado', obrigatorio: true },
        { campo: 'valor_parcela', label: 'Valor da Parcela', obrigatorio: true },
        { campo: 'prazo', label: 'Prazo (meses)', obrigatorio: true },
        { campo: 'parcelas_pagas', label: 'Parcelas Pagas', obrigatorio: true }
      ]
    },
    fluxo: {
      nome: 'Fluxo de Caixa',
      icone: 'fa-exchange-alt',
      cor: '#28a745',
      secao: 'fluxo_caixa',
      campos_despesa: [
        { campo: 'categoria_comportamental', label: 'Categoria Comportamental', obrigatorio: true },
        { campo: 'nivel_importancia', label: 'Nível de Importância (1-7)', obrigatorio: true }
      ],
      campos_receita: [
        { campo: 'nome', label: 'Nome da Receita', obrigatorio: true },
        { campo: 'valor', label: 'Valor', obrigatorio: true }
      ]
    },
    patrimonio: {
      nome: 'Patrimônio',
      icone: 'fa-landmark',
      cor: '#6f42c1',
      secao: 'patrimonios_liquidos',
      campos: [
        { campo: 'valor_atual', label: 'Valor Atual', obrigatorio: true },
        { campo: 'tipo_produto', label: 'Tipo de Produto', obrigatorio: true },
        { campo: 'instituicao', label: 'Instituição', obrigatorio: false },
        { campo: 'aporte_valor', label: 'Valor do Aporte', obrigatorio: false },
        { campo: 'aporte_frequencia', label: 'Frequência do Aporte', obrigatorio: false },
        { campo: 'taxa_administracao', label: 'Taxa de Administração (%)', obrigatorio: false },
        { campo: 'rentabilidade_esperada', label: 'Rentabilidade Esperada (% a.a.)', obrigatorio: false }
      ]
    },
    comparador: {
      nome: 'Comparador de Seguros',
      icone: 'fa-shield-alt',
      cor: '#17a2b8',
      secao: 'produtos_protecao',
      campos: [
        { campo: 'tipo_produto', label: 'Tipo de Produto', obrigatorio: true },
        { campo: 'seguradora', label: 'Seguradora', obrigatorio: true },
        { campo: 'custo', label: 'Custo/Prêmio', obrigatorio: true },
        { campo: 'cobertura_morte', label: 'Cobertura por Morte (R$)', obrigatorio: true },
        { campo: 'cobertura_invalidez', label: 'Cobertura por Invalidez (R$)', obrigatorio: true },
        { campo: 'cobertura_dit', label: 'Cobertura DIT (R$)', obrigatorio: false },
        { campo: 'resgatavel', label: 'É Resgatável?', obrigatorio: false }
      ]
    },
    acumulo: {
      nome: 'Acúmulo de Capital',
      icone: 'fa-chart-line',
      cor: '#fd7e14',
      secao: 'patrimonios_liquidos',
      campos: [
        { campo: 'valor_atual', label: 'Saldo Atual', obrigatorio: true },
        { campo: 'aporte_valor', label: 'Valor do Aporte', obrigatorio: true },
        { campo: 'aporte_frequencia', label: 'Frequência do Aporte', obrigatorio: true },
        { campo: 'taxa_administracao', label: 'Taxa de Administração (%)', obrigatorio: true },
        { campo: 'rentabilidade_esperada', label: 'Rentabilidade Esperada (% a.a.)', obrigatorio: true }
      ]
    },
    ir: {
      nome: 'Imposto de Renda',
      icone: 'fa-file-invoice',
      cor: '#20c997',
      secao: 'declaracoes_ir',
      campos: [
        { campo: 'tipo_declaracao', label: 'Tipo de Declaração', obrigatorio: true, ignorar_valor: 'nao_declara' },
        { campo: 'renda_bruta_anual', label: 'Renda Bruta Anual', obrigatorio: true },
        { campo: 'total_recolhido_ir', label: 'Total Recolhido de IR', obrigatorio: true },
        { campo: 'contribuicao_previdencia_oficial', label: 'Contribuição Previdência Oficial', obrigatorio: false },
        { campo: 'gastos_medicos', label: 'Gastos Médicos', obrigatorio: false }
      ]
    },
    oraculo: {
      nome: 'Oráculo (Objetivos)',
      icone: 'fa-crystal-ball',
      cor: '#e83e8c',
      secao: 'objetivos',
      campos_normal: [
        { campo: 'nome', label: 'Nome do Objetivo', obrigatorio: true },
        { campo: 'valor', label: 'Valor do Objetivo', obrigatorio: true },
        { campo: 'prazo', label: 'Prazo (meses)', obrigatorio: true }
      ],
      campos_aposentadoria: [
        { campo: 'idade_aposentadoria', label: 'Idade de Aposentadoria', obrigatorio: true },
        { campo: 'renda_desejada', label: 'Renda Mensal Desejada', obrigatorio: true }
      ],
      secoes_cruzadas: ['patrimonios_liquidos', 'fluxo_caixa']
    },
    cartoes: {
      nome: 'Cartões',
      icone: 'fa-credit-card',
      cor: '#6610f2',
      secao: 'contas_cartoes',
      campos: [
        { campo: 'instituicao', label: 'Instituição/Banco', obrigatorio: true },
        { campo: 'bandeira', label: 'Bandeira', obrigatorio: true },
        { campo: 'limite', label: 'Limite', obrigatorio: true },
        { campo: 'tarifa_anuidade', label: 'Anuidade/Tarifa', obrigatorio: false }
      ]
    }
  };

  // Categorias comportamentais para o fluxo
  const CATEGORIAS_COMPORTAMENTAIS = [
    { id: 'sobrevivencia', nome: 'Sobrevivência' },
    { id: 'necessidades', nome: 'Necessidades/Prioridades' },
    { id: 'aperfeicoamento', nome: 'Aperfeiçoamento' },
    { id: 'dividas', nome: 'Dívidas' },
    { id: 'conforto', nome: 'Conforto/Supérfluo' }
  ];

  // Função principal de validação
  function validarDiagnostico() {
    const faltantes = [];

    // 1. Validar Dívidas → Ferramenta Juros
    const dividas = window.getDividasData ? window.getDividasData() : [];
    if (dividas.length > 0) {
      const faltasDividas = [];
      dividas.forEach((divida, idx) => {
        const nomeDivida = divida.motivo || divida.credor || `Dívida #${idx + 1}`;
        REQUISITOS.juros.campos.forEach(req => {
          if (req.obrigatorio && !temValor(divida[req.campo])) {
            faltasDividas.push({ item: nomeDivida, campo: req.label });
          }
        });
      });
      if (faltasDividas.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.juros,
          itens: faltasDividas
        });
      }
    }

    // 2. Validar Fluxo de Caixa → Ferramenta Fluxo
    const fluxoData = window.getFluxoCaixaData ? window.getFluxoCaixaData() : {};
    const despesas = fluxoData.despesas || [];
    const despesasManuais = despesas.filter(d => !d.automatica);
    if (despesasManuais.length > 0) {
      const faltasFluxo = [];
      despesasManuais.forEach((despesa, idx) => {
        const nomeDespesa = despesa.nome || `Despesa #${idx + 1}`;
        REQUISITOS.fluxo.campos_despesa.forEach(req => {
          if (req.obrigatorio && !temValor(despesa[req.campo])) {
            faltasFluxo.push({ item: nomeDespesa, campo: req.label });
          }
        });
      });
      if (faltasFluxo.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.fluxo,
          itens: faltasFluxo
        });
      }
    }

    // 3. Validar Patrimônios Líquidos → Ferramentas Patrimônio e Acúmulo
    const patrimoniosLiquidos = window.getPatrimoniosLiquidosData ? window.getPatrimoniosLiquidosData() : [];
    if (patrimoniosLiquidos.length > 0) {
      // Para Patrimônio
      const faltasPatrimonio = [];
      patrimoniosLiquidos.forEach((pl, idx) => {
        const nomePL = pl.tipo_produto_nome || pl.nome_produto_customizado || `Investimento #${idx + 1}`;
        REQUISITOS.patrimonio.campos.forEach(req => {
          if (req.obrigatorio && !temValor(pl[req.campo])) {
            faltasPatrimonio.push({ item: nomePL, campo: req.label });
          }
        });
      });
      if (faltasPatrimonio.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.patrimonio,
          itens: faltasPatrimonio
        });
      }

      // Para Acúmulo (apenas os que têm aporte)
      const comAporte = patrimoniosLiquidos.filter(pl => pl.aporte_frequencia && pl.aporte_frequencia !== 'NENHUM');
      if (comAporte.length > 0) {
        const faltasAcumulo = [];
        comAporte.forEach((pl, idx) => {
          const nomePL = pl.tipo_produto_nome || pl.nome_produto_customizado || `Investimento #${idx + 1}`;
          REQUISITOS.acumulo.campos.forEach(req => {
            if (req.obrigatorio && !temValor(pl[req.campo])) {
              faltasAcumulo.push({ item: nomePL, campo: req.label });
            }
          });
        });
        if (faltasAcumulo.length > 0) {
          faltantes.push({
            ferramenta: REQUISITOS.acumulo,
            itens: faltasAcumulo
          });
        }
      }
    }

    // 4. Validar Produtos de Proteção → Ferramenta Comparador
    const produtosProtecao = window.getProdutosProtecaoData ? window.getProdutosProtecaoData() : [];
    if (produtosProtecao.length > 0) {
      const faltasComparador = [];
      produtosProtecao.forEach((produto, idx) => {
        const nomeProduto = produto.tipo_produto || produto.seguradora || `Produto #${idx + 1}`;
        REQUISITOS.comparador.campos.forEach(req => {
          if (req.obrigatorio && !temValor(produto[req.campo])) {
            faltasComparador.push({ item: nomeProduto, campo: req.label });
          }
        });
      });
      if (faltasComparador.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.comparador,
          itens: faltasComparador
        });
      }
    }

    // 5. Validar Declarações de IR → Ferramenta IR
    const declaracoesIR = window.getDeclaracoesIRData ? window.getDeclaracoesIRData() : [];
    const declaracoesAtivas = declaracoesIR.filter(d => d.tipo_declaracao && d.tipo_declaracao !== 'nao_declara');
    if (declaracoesAtivas.length > 0) {
      const faltasIR = [];
      declaracoesAtivas.forEach((decl, idx) => {
        const nomeDecl = decl.pessoa_nome || `Declarante #${idx + 1}`;
        REQUISITOS.ir.campos.forEach(req => {
          if (req.obrigatorio && !temValor(decl[req.campo])) {
            if (req.ignorar_valor && decl[req.campo] === req.ignorar_valor) return;
            faltasIR.push({ item: nomeDecl, campo: req.label });
          }
        });
      });
      if (faltasIR.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.ir,
          itens: faltasIR
        });
      }
    }

    // 6. Validar Objetivos → Ferramenta Oráculo
    const objetivosData = window.getObjetivosData ? window.getObjetivosData() : {};
    const objetivosNormais = objetivosData.normais || [];
    const aposentadoria = objetivosData.aposentadoria || {};
    if (objetivosNormais.length > 0 || aposentadoria.idade_aposentadoria) {
      const faltasOraculo = [];
      
      objetivosNormais.forEach((obj, idx) => {
        const nomeObj = obj.nome || `Objetivo #${idx + 1}`;
        REQUISITOS.oraculo.campos_normal.forEach(req => {
          if (req.obrigatorio && !temValor(obj[req.campo])) {
            faltasOraculo.push({ item: nomeObj, campo: req.label });
          }
        });
      });

      if (aposentadoria.idade_aposentadoria || aposentadoria.renda_desejada) {
        REQUISITOS.oraculo.campos_aposentadoria.forEach(req => {
          if (req.obrigatorio && !temValor(aposentadoria[req.campo])) {
            faltasOraculo.push({ item: 'Aposentadoria', campo: req.label });
          }
        });
      }

      // Cruzamento: Oráculo precisa de dados de investimentos (aporte mensal)
      if (patrimoniosLiquidos.length === 0) {
        faltasOraculo.push({ item: 'Dados Cruzados', campo: 'Patrimônios Líquidos (para calcular aporte disponível)' });
      }
      const fluxoReceitas = fluxoData.receitas || [];
      if (fluxoReceitas.length === 0) {
        faltasOraculo.push({ item: 'Dados Cruzados', campo: 'Receitas no Fluxo de Caixa (para calcular capacidade de aporte)' });
      }

      if (faltasOraculo.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.oraculo,
          itens: faltasOraculo
        });
      }
    }

    // 7. Validar Contas/Cartões → Ferramenta Cartões
    const contasCartoes = window.getContasCartoesData ? window.getContasCartoesData() : [];
    const cartoes = (Array.isArray(contasCartoes) ? contasCartoes : contasCartoes.contasCartoes || []).filter(c => c.tipo === 'cartao');
    if (cartoes.length > 0) {
      const faltasCartoes = [];
      cartoes.forEach((cartao, idx) => {
        const nomeCartao = cartao.instituicao || `Cartão #${idx + 1}`;
        REQUISITOS.cartoes.campos.forEach(req => {
          if (req.obrigatorio && !temValor(cartao[req.campo])) {
            faltasCartoes.push({ item: nomeCartao, campo: req.label });
          }
        });
      });
      if (faltasCartoes.length > 0) {
        faltantes.push({
          ferramenta: REQUISITOS.cartoes,
          itens: faltasCartoes
        });
      }
    }

    return faltantes;
  }

  // Verifica se um valor é considerado "preenchido"
  function temValor(valor) {
    if (valor === null || valor === undefined) return false;
    if (valor === '') return false;
    if (valor === 0) return false;
    if (valor === 'NENHUM') return false;
    if (Array.isArray(valor) && valor.length === 0) return false;
    return true;
  }

  // Renderiza o painel de informações faltantes
  function renderPainelFaltantes() {
    const faltantes = validarDiagnostico();
    
    // Remover painel anterior se existir
    const painelExistente = document.getElementById('painel-info-faltantes');
    if (painelExistente) painelExistente.remove();

    // Criar container do painel
    const painel = document.createElement('div');
    painel.id = 'painel-info-faltantes';
    painel.style.cssText = `
      margin: 2rem auto;
      max-width: 900px;
      padding: 1.5rem;
      background: var(--dark-bg, #1a1a2e);
      border: 2px solid var(--border-color, #333);
      border-radius: 12px;
    `;

    if (faltantes.length === 0) {
      painel.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <i class="fas fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
          <h3 style="color: #28a745; margin: 0;">Diagnóstico Completo!</h3>
          <p style="color: var(--text-light, #ccc); margin-top: 0.5rem;">
            Todas as informações necessárias para as ferramentas estão preenchidas.
          </p>
        </div>
      `;
    } else {
      const totalFaltas = faltantes.reduce((sum, f) => sum + f.itens.length, 0);
      
      painel.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; cursor: pointer;" onclick="togglePainelFaltantes()">
          <h3 style="color: var(--accent-color, #d4af37); margin: 0;">
            <i class="fas fa-exclamation-triangle"></i> Informações Faltantes para Ferramentas
          </h3>
          <span style="color: var(--text-light, #ccc); font-size: 0.9rem;">
            ${totalFaltas} campo(s) em ${faltantes.length} ferramenta(s)
            <i class="fas fa-chevron-down" id="painel-faltantes-chevron"></i>
          </span>
        </div>
        <div id="painel-faltantes-body">
          <p style="color: var(--text-light, #ccc); margin-bottom: 1.5rem; font-size: 0.9rem;">
            Os campos abaixo são necessários para que as ferramentas do cliente funcionem corretamente ao importar dados do diagnóstico.
          </p>
          ${faltantes.map(grupo => `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 4px solid ${grupo.ferramenta.cor};">
              <h4 style="color: ${grupo.ferramenta.cor}; margin: 0 0 0.8rem 0; font-size: 1rem;">
                <i class="fas ${grupo.ferramenta.icone}"></i> ${grupo.ferramenta.nome}
                <span style="font-size: 0.8rem; opacity: 0.7; font-weight: normal;">(${grupo.itens.length} campo${grupo.itens.length > 1 ? 's' : ''})</span>
              </h4>
              <div style="display: grid; gap: 0.4rem;">
                ${agruparPorItem(grupo.itens).map(itemGrupo => `
                  <div style="padding: 0.5rem 0.8rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <strong style="color: var(--text-light, #ccc); font-size: 0.85rem;">${itemGrupo.item}:</strong>
                    <span style="color: var(--text-light, #aaa); font-size: 0.85rem;">
                      ${itemGrupo.campos.join(', ')}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Inserir antes do botão de salvar ou no final da página
    const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.body;
    const saveBtn = document.querySelector('[onclick*="saveDiagnostico"]');
    if (saveBtn && saveBtn.parentElement) {
      saveBtn.parentElement.parentElement.insertBefore(painel, saveBtn.parentElement);
    } else {
      mainContent.appendChild(painel);
    }
  }

  // Agrupa faltas por item para exibição mais limpa
  function agruparPorItem(itens) {
    const grupos = {};
    itens.forEach(item => {
      if (!grupos[item.item]) {
        grupos[item.item] = [];
      }
      grupos[item.item].push(item.campo);
    });
    return Object.entries(grupos).map(([item, campos]) => ({ item, campos }));
  }

  // Toggle expandir/retrair
  window.togglePainelFaltantes = function() {
    const body = document.getElementById('painel-faltantes-body');
    const chevron = document.getElementById('painel-faltantes-chevron');
    if (body) {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      if (chevron) {
        chevron.className = isHidden ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      }
    }
  };

  // Expor função globalmente para ser chamada após salvar
  window.renderPainelFaltantes = renderPainelFaltantes;
  window.validarDiagnostico = validarDiagnostico;

  // Renderizar automaticamente quando a página carregar completamente
  // (aguardar todos os módulos carregarem seus dados)
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(renderPainelFaltantes, 2000);
  });

})();
