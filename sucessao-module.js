// ========================================
// MÓDULO DE SUCESSÃO PATRIMONIAL
// ========================================

// Dados de sucessão
let dadosSucessao = {
  itcmd: 4, // Percentual padrão
  emolumentos: 1, // Percentual padrão
  honorarios: 6 // Percentual padrão
};

// Inicialização do módulo
function initSucessaoModule() {
  console.log('Módulo de Sucessão Patrimonial carregado');
  
  // Expor funções globalmente
  window.atualizarSecaoSucessao = atualizarSecaoSucessao;
  window.updateSucessaoField = updateSucessaoField;
  window.getSucessaoData = getSucessaoData;
  window.setSucessaoData = setSucessaoData;
  
  // Renderizar a seção de sucessão
  setTimeout(() => {
    atualizarSecaoSucessao();
  }, 600);
}

// Função para formatar moeda
function formatarMoedaSucessao(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return 'R$ 0,00';
  return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para formatar percentual
function formatarPercentual(valor) {
  if (!valor && valor !== 0) return '0,00%';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return '0,00%';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

// Função para atualizar campo de sucessão
function updateSucessaoField(field, valor) {
  const numero = parseFloat(valor);
  if (!isNaN(numero) && numero >= 0) {
    dadosSucessao[field] = numero;
    atualizarSecaoSucessao();
  }
}

// Função para obter todas as pessoas para cálculo de sucessão
function getPessoasParaSucessao() {
  const pessoas = [];
  
  // Titular
  const nomeTitular = document.getElementById('nome_diagnostico')?.value;
  if (nomeTitular) {
    pessoas.push({ id: 'titular', nome: nomeTitular, tipo: 'Cliente' });
  }
  
  // Cônjuge do titular
  const estadoCivil = document.getElementById('estado_civil')?.value;
  const nomeConjuge = document.getElementById('conjuge_nome')?.value;
  if ((estadoCivil === 'Casado(a)' || estadoCivil === 'União Estável') && nomeConjuge) {
    pessoas.push({ id: 'conjuge', nome: nomeConjuge, tipo: 'Cônjuge' });
  }
  
  // Outras pessoas com renda
  if (window.pessoasRenda && Array.isArray(window.pessoasRenda)) {
    window.pessoasRenda.forEach((pessoa, index) => {
      if (pessoa.nome) {
        pessoas.push({ id: `pessoa_${index}`, nome: pessoa.nome, tipo: 'Pessoa c/ Renda' });
        
        if ((pessoa.estado_civil === 'Casado(a)' || pessoa.estado_civil === 'União Estável') && pessoa.conjuge_nome) {
          pessoas.push({ id: `pessoa_${index}_conjuge`, nome: pessoa.conjuge_nome, tipo: `Cônjuge` });
        }
      }
    });
  }
  
  return pessoas;
}

// Função para calcular patrimônios por proprietário
function calcularPatrimoniosPorProprietario() {
  const pessoas = getPessoasParaSucessao();
  const resultado = {};
  
  // Inicializar resultado para cada pessoa
  pessoas.forEach(pessoa => {
    resultado[pessoa.id] = {
      nome: pessoa.nome,
      tipo: pessoa.tipo,
      patrimonio_liquido_inv: 0,
      patrimonio_liquido_nao_inv: 0,
      patrimonio_fisico_inv: 0,
      patrimonio_fisico_nao_inv: 0,
      dividas_inv: 0,
      dividas_nao_inv: 0
    };
  });
  
  // Patrimônio Líquido
  if (window.getPatrimoniosLiquidosData) {
    const patrimoniosLiquidos = window.getPatrimoniosLiquidosData() || [];
    patrimoniosLiquidos.forEach(pl => {
      const valor = parseFloat(pl.valor_atual) || 0;
      const donos = pl.donos || [];
      const inventariavel = pl.inventariavel !== false;
      
      if (donos.length > 0) {
        const valorPorDono = valor / donos.length;
        donos.forEach(donoNome => {
          // Encontrar o ID da pessoa pelo nome
          const pessoa = pessoas.find(p => p.nome === donoNome);
          if (pessoa && resultado[pessoa.id]) {
            if (inventariavel) {
              resultado[pessoa.id].patrimonio_liquido_inv += valorPorDono;
            } else {
              resultado[pessoa.id].patrimonio_liquido_nao_inv += valorPorDono;
            }
          }
        });
      }
    });
  }
  
  // Patrimônio Físico
  if (window.patrimonios && Array.isArray(window.patrimonios)) {
    window.patrimonios.forEach(pf => {
      const valor = parseFloat(pf.valor) || 0;
      const proprietarios = pf.proprietarios || [];
      const inventariavel = pf.inventariavel !== false;
      
      if (proprietarios.length > 0) {
        const valorPorProprietario = valor / proprietarios.length;
        proprietarios.forEach(propId => {
          if (resultado[propId]) {
            if (inventariavel) {
              resultado[propId].patrimonio_fisico_inv += valorPorProprietario;
            } else {
              resultado[propId].patrimonio_fisico_nao_inv += valorPorProprietario;
            }
          }
        });
      }
    });
  }
  
  // Dívidas
  if (window.getDividasData) {
    const dividas = window.getDividasData() || [];
    dividas.forEach(divida => {
      const saldoDevedor = parseFloat(divida.saldo_devedor) || 0;
      const responsaveis = divida.responsaveis || [];
      const inventariavel = divida.inventariavel !== false;
      
      if (responsaveis.length > 0) {
        const valorPorResponsavel = saldoDevedor / responsaveis.length;
        responsaveis.forEach(respId => {
          if (resultado[respId]) {
            if (inventariavel) {
              resultado[respId].dividas_inv += valorPorResponsavel;
            } else {
              resultado[respId].dividas_nao_inv += valorPorResponsavel;
            }
          }
        });
      }
    });
  }
  
  return resultado;
}

// Função para calcular custo do inventário por pessoa
function calcularCustoInventario(dados) {
  const itcmd = dadosSucessao.itcmd / 100;
  const emolumentos = dadosSucessao.emolumentos / 100;
  const honorarios = dadosSucessao.honorarios / 100;
  
  // Patrimônio inventariável líquido (para ITCMD)
  const patrimonioInvLiquido = dados.patrimonio_liquido_inv + dados.patrimonio_fisico_inv - dados.dividas_inv;
  
  // Patrimônio total (para emolumentos e honorários)
  const patrimonioTotal = dados.patrimonio_liquido_inv + dados.patrimonio_liquido_nao_inv + 
                          dados.patrimonio_fisico_inv + dados.patrimonio_fisico_nao_inv;
  
  // Saldo do patrimônio (inventariável - dívidas inventariáveis)
  const saldoPatrimonio = dados.patrimonio_liquido_inv + dados.patrimonio_fisico_inv - dados.dividas_inv;
  
  // Cálculo do custo
  // [Patrimônio inventariável - dívidas inventariáveis] * ITCMD + 
  // [emolumentos] * [patrimônio total] + 
  // [honorários] * [patrimônio total]
  const custoITCMD = Math.max(0, patrimonioInvLiquido) * itcmd;
  const custoEmolumentos = patrimonioTotal * emolumentos;
  const custoHonorarios = patrimonioTotal * honorarios;
  
  const custoTotal = custoITCMD + custoEmolumentos + custoHonorarios;
  
  return {
    saldoPatrimonio: saldoPatrimonio,
    custoTotal: custoTotal,
    custoITCMD: custoITCMD,
    custoEmolumentos: custoEmolumentos,
    custoHonorarios: custoHonorarios,
    percentualCusto: saldoPatrimonio > 0 ? (custoTotal / saldoPatrimonio) * 100 : 0
  };
}

// Função para atualizar a seção de sucessão
function atualizarSecaoSucessao() {
  const container = document.getElementById('sucessao-container');
  if (!container) return;
  
  const patrimoniosPorProprietario = calcularPatrimoniosPorProprietario();
  const pessoas = Object.keys(patrimoniosPorProprietario);
  
  if (pessoas.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 1rem;">
        <i class="fas fa-info-circle"></i> Preencha os dados do cliente e patrimônios para visualizar a análise de sucessão.
      </p>
    `;
    return;
  }
  
  // Calcular totais gerais
  let totalPatrimonioLiquidoInv = 0;
  let totalPatrimonioLiquidoNaoInv = 0;
  let totalPatrimonioFisicoInv = 0;
  let totalPatrimonioFisicoNaoInv = 0;
  let totalDividasInv = 0;
  let totalDividasNaoInv = 0;
  let totalSaldoPatrimonio = 0;
  let totalCustoInventario = 0;
  
  const cardsHTML = pessoas.map(pessoaId => {
    const dados = patrimoniosPorProprietario[pessoaId];
    const custos = calcularCustoInventario(dados);
    
    // Acumular totais
    totalPatrimonioLiquidoInv += dados.patrimonio_liquido_inv;
    totalPatrimonioLiquidoNaoInv += dados.patrimonio_liquido_nao_inv;
    totalPatrimonioFisicoInv += dados.patrimonio_fisico_inv;
    totalPatrimonioFisicoNaoInv += dados.patrimonio_fisico_nao_inv;
    totalDividasInv += dados.dividas_inv;
    totalDividasNaoInv += dados.dividas_nao_inv;
    totalSaldoPatrimonio += custos.saldoPatrimonio;
    totalCustoInventario += custos.custoTotal;
    
    // Verificar se tem algum patrimônio
    const temPatrimonio = dados.patrimonio_liquido_inv > 0 || dados.patrimonio_liquido_nao_inv > 0 ||
                          dados.patrimonio_fisico_inv > 0 || dados.patrimonio_fisico_nao_inv > 0 ||
                          dados.dividas_inv > 0 || dados.dividas_nao_inv > 0;
    
    if (!temPatrimonio) return '';
    
    // Determinar se o custo é aplicável
    const custoAplicavel = custos.saldoPatrimonio > 0 && custos.custoTotal > 0;
    const custoDisplay = custoAplicavel 
      ? `${formatarMoedaSucessao(custos.custoTotal)} <span style="font-size: 0.85rem; opacity: 0.8;">(${formatarPercentual(custos.percentualCusto)})</span>`
      : '<span style="color: var(--warning-color);">INAPLICÁVEL NO MOMENTO</span>';
    
    return `
      <div class="sucessao-card" style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
        <div class="sucessao-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
          <h4 style="color: var(--accent-color); font-size: 1.1rem; font-weight: 600; margin: 0;">
            <i class="fas fa-user"></i> ${dados.nome}
            <span style="background: var(--success-color); color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">
              ${dados.tipo}
            </span>
          </h4>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <!-- Patrimônio Líquido -->
          <div style="background: rgba(40, 167, 69, 0.1); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 1rem;">
            <h5 style="color: #28a745; font-size: 0.9rem; margin: 0 0 0.5rem 0;">
              <i class="fas fa-chart-line"></i> Patrimônio Líquido
            </h5>
            <div style="font-size: 0.85rem; color: var(--text-light);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <span>Inventariável:</span>
                <span style="color: #28a745;">${formatarMoedaSucessao(dados.patrimonio_liquido_inv)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Não Inventariável:</span>
                <span style="color: var(--text-light);">${formatarMoedaSucessao(dados.patrimonio_liquido_nao_inv)}</span>
              </div>
            </div>
          </div>
          
          <!-- Patrimônio Físico -->
          <div style="background: rgba(0, 123, 255, 0.1); border: 1px solid rgba(0, 123, 255, 0.3); border-radius: 8px; padding: 1rem;">
            <h5 style="color: #007bff; font-size: 0.9rem; margin: 0 0 0.5rem 0;">
              <i class="fas fa-home"></i> Patrimônio Físico
            </h5>
            <div style="font-size: 0.85rem; color: var(--text-light);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <span>Inventariável:</span>
                <span style="color: #007bff;">${formatarMoedaSucessao(dados.patrimonio_fisico_inv)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Não Inventariável:</span>
                <span style="color: var(--text-light);">${formatarMoedaSucessao(dados.patrimonio_fisico_nao_inv)}</span>
              </div>
            </div>
          </div>
          
          <!-- Dívidas -->
          <div style="background: rgba(220, 53, 69, 0.1); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 1rem;">
            <h5 style="color: #dc3545; font-size: 0.9rem; margin: 0 0 0.5rem 0;">
              <i class="fas fa-file-invoice-dollar"></i> Dívidas
            </h5>
            <div style="font-size: 0.85rem; color: var(--text-light);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <span>Inventariável:</span>
                <span style="color: #dc3545;">${formatarMoedaSucessao(dados.dividas_inv)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Não Inventariável:</span>
                <span style="color: var(--text-light);">${formatarMoedaSucessao(dados.dividas_nao_inv)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Resumo -->
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div style="text-align: center;">
            <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Saldo do Patrimônio</div>
            <div style="font-size: 1.2rem; font-weight: 600; color: ${custos.saldoPatrimonio >= 0 ? '#28a745' : '#dc3545'};">
              ${formatarMoedaSucessao(custos.saldoPatrimonio)}
            </div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Custo Estimado do Inventário</div>
            <div style="font-size: 1.2rem; font-weight: 600; color: var(--warning-color);">
              ${custoDisplay}
            </div>
          </div>
        </div>
      </div>
    `;
  }).filter(html => html !== '').join('');
  
  // Calcular percentual total
  const percentualTotal = totalSaldoPatrimonio > 0 ? (totalCustoInventario / totalSaldoPatrimonio) * 100 : 0;
  const custoTotalAplicavel = totalSaldoPatrimonio > 0 && totalCustoInventario > 0;
  const custoTotalDisplay = custoTotalAplicavel
    ? `${formatarMoedaSucessao(totalCustoInventario)} <span style="font-size: 0.9rem; opacity: 0.8;">(${formatarPercentual(percentualTotal)})</span>`
    : '<span style="color: var(--warning-color);">INAPLICÁVEL NO MOMENTO</span>';
  
  container.innerHTML = `
    <!-- Campos de Percentuais -->
    <div style="background: var(--dark-bg); border: 2px solid var(--accent-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1.5rem;">
      <h4 style="color: var(--accent-color); font-size: 1rem; margin: 0 0 1rem 0;">
        <i class="fas fa-percentage"></i> Parâmetros de Cálculo
      </h4>
      <div class="form-grid-3">
        <div class="form-group">
          <label for="sucessao_itcmd">
            <i class="fas fa-landmark"></i> ITCMD (%)
          </label>
          <input type="number" 
                 id="sucessao_itcmd" 
                 value="${dadosSucessao.itcmd}"
                 onchange="updateSucessaoField('itcmd', this.value)"
                 step="0.01"
                 min="0"
                 max="100"
                 placeholder="4">
        </div>
        
        <div class="form-group">
          <label for="sucessao_emolumentos">
            <i class="fas fa-file-signature"></i> Emolumentos Cartorários (%)
          </label>
          <input type="number" 
                 id="sucessao_emolumentos" 
                 value="${dadosSucessao.emolumentos}"
                 onchange="updateSucessaoField('emolumentos', this.value)"
                 step="0.01"
                 min="0"
                 max="100"
                 placeholder="1">
        </div>
        
        <div class="form-group">
          <label for="sucessao_honorarios">
            <i class="fas fa-user-tie"></i> Honorários Profissionais (%)
          </label>
          <input type="number" 
                 id="sucessao_honorarios" 
                 value="${dadosSucessao.honorarios}"
                 onchange="updateSucessaoField('honorarios', this.value)"
                 step="0.01"
                 min="0"
                 max="100"
                 placeholder="6">
        </div>
      </div>
    </div>
    
    <!-- Cards por Pessoa -->
    ${cardsHTML || '<p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 1rem;"><i class="fas fa-info-circle"></i> Nenhum patrimônio ou dívida atribuído a proprietários.</p>'}
    
    <!-- Resumo Geral -->
    <div style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); border-radius: 10px; padding: 1.5rem; margin-top: 1.5rem;">
      <h4 style="color: white; font-size: 1.2rem; margin: 0 0 1rem 0; text-align: center;">
        <i class="fas fa-calculator"></i> RESUMO GERAL DA SUCESSÃO
      </h4>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.8rem; color: rgba(255,255,255,0.8); margin-bottom: 0.3rem;">Patrimônio Líquido Inv.</div>
          <div style="font-size: 1rem; font-weight: 600; color: white;">${formatarMoedaSucessao(totalPatrimonioLiquidoInv)}</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.8rem; color: rgba(255,255,255,0.8); margin-bottom: 0.3rem;">Patrimônio Físico Inv.</div>
          <div style="font-size: 1rem; font-weight: 600; color: white;">${formatarMoedaSucessao(totalPatrimonioFisicoInv)}</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.8rem; color: rgba(255,255,255,0.8); margin-bottom: 0.3rem;">Dívidas Inv.</div>
          <div style="font-size: 1rem; font-weight: 600; color: #ff6b6b;">${formatarMoedaSucessao(totalDividasInv)}</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2);">
        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.9rem; color: rgba(255,255,255,0.9); margin-bottom: 0.3rem;">
            <i class="fas fa-wallet"></i> SALDO TOTAL DO PATRIMÔNIO
          </div>
          <div style="font-size: 1.4rem; font-weight: 700; color: white;">
            ${formatarMoedaSucessao(totalSaldoPatrimonio)}
          </div>
        </div>
        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.9rem; color: rgba(255,255,255,0.9); margin-bottom: 0.3rem;">
            <i class="fas fa-receipt"></i> CUSTO TOTAL DO INVENTÁRIO
          </div>
          <div style="font-size: 1.4rem; font-weight: 700; color: #ffd93d;">
            ${custoTotalDisplay}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Funções para obter e definir dados
function getSucessaoData() {
  return dadosSucessao;
}

function setSucessaoData(data) {
  if (data && typeof data === 'object') {
    dadosSucessao = { ...dadosSucessao, ...data };
    atualizarSecaoSucessao();
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSucessaoModule);
} else {
  initSucessaoModule();
}

// Exportar funções
export {
  initSucessaoModule,
  atualizarSecaoSucessao,
  getSucessaoData,
  setSucessaoData
};
