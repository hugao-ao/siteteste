// ========================================
// MÓDULO DE DÍVIDAS
// ========================================

// Dados de dívidas
let dividas = [];
let dividaCounter = 0;

// Inicialização do módulo
function initDividasModule() {
  console.log('Módulo de Dívidas carregado');
  
  // Expor funções globalmente
  window.addDivida = addDivida;
  window.deleteDivida = deleteDivida;
  window.updateDividaField = updateDividaField;
  window.getDividasData = getDividasData;
  window.setDividasData = setDividasData;
  window.formatarMoedaDivida = formatarMoedaDivida;
  window.limparCampoDivida = limparCampoDivida;
  window.renderDividas = renderDividas;
  window.updateDividaTotal = updateDividaTotal;
  
  // Renderizar a seção de dívidas
  renderDividas();
}

// Função para formatar moeda
function formatarMoedaDivida(valor) {
  if (!valor && valor !== 0) return '';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para limpar campo de moeda quando está zerado
function limparCampoDivida(input) {
  if (input.value === 'R$ 0,00' || input.value === '0,00') {
    input.value = '';
  }
}

// Função para parsear valor monetário
function parseMoedaDivida(valor) {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

// Função para atualizar campo de moeda com máscara
function updateDividaMoedaField(id, field, valor) {
  const divida = dividas.find(d => d.id === id);
  if (divida) {
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    divida[field] = parseFloat(valorNumerico) || 0;
    
    const input = document.getElementById(`divida_${id}_${field}`);
    if (input) {
      input.value = `R$ ${formatarMoedaDivida(valorNumerico)}`;
    }
  }
  updateDividaTotal();
  if (window.atualizarSecaoSucessao) window.atualizarSecaoSucessao();
}

// Função para atualizar campo de dívida
function updateDividaField(id, field, valor) {
  const divida = dividas.find(d => d.id === id);
  if (!divida) return;
  
  const camposMonetarios = ['valor_inicial', 'valor_parcela', 'saldo_devedor'];
  
  if (camposMonetarios.includes(field)) {
    updateDividaMoedaField(id, field, valor);
  } else if (field === 'prazo' || field === 'parcelas_pagas') {
    divida[field] = parseInt(valor) || 0;
  } else if (field === 'inventariavel' || field === 'planejada') {
    divida[field] = valor === true || valor === 'true' || valor === 'sim';
    if (window.atualizarSecaoSucessao) window.atualizarSecaoSucessao();
  } else if (field === 'responsaveis') {
    const select = document.getElementById(`divida_${id}_responsaveis`);
    if (select) {
      divida.responsaveis = Array.from(select.selectedOptions).map(opt => opt.value);
    }
    if (window.atualizarSecaoSucessao) window.atualizarSecaoSucessao();
  } else {
    divida[field] = valor;
  }
  
  updateDividaTotal();
}

// Função para adicionar nova dívida
function addDivida() {
  const id = ++dividaCounter;
  
  const novaDivida = {
    id: id,
    valor_inicial: 0,
    prazo: 0,
    valor_parcela: 0,
    parcelas_pagas: 0,
    saldo_devedor: 0,
    motivo: '',
    credor: '',
    planejada: false,
    responsaveis: [],
    inventariavel: true
  };
  
  dividas.push(novaDivida);
  renderDividas();
  updateDividaTotal();
}

// Função para excluir dívida
function deleteDivida(id) {
  if (!confirm('Tem certeza que deseja excluir esta dívida?')) return;
  
  dividas = dividas.filter(d => d.id !== id);
  renderDividas();
  updateDividaTotal();
  if (window.atualizarSecaoSucessao) window.atualizarSecaoSucessao();
}

// Função para obter pessoas disponíveis
function getPessoasParaDividas() {
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
        
        // Cônjuge da pessoa com renda
        if ((pessoa.estado_civil === 'Casado(a)' || pessoa.estado_civil === 'União Estável') && pessoa.conjuge_nome) {
          pessoas.push({ id: `pessoa_${index}_conjuge`, nome: pessoa.conjuge_nome, tipo: `Cônjuge de ${pessoa.nome.split(' ')[0]}` });
        }
      }
    });
  }
  
  return pessoas;
}

// Função para renderizar dívidas
function renderDividas() {
  const container = document.getElementById('dividas-container');
  if (!container) return;
  
  const pessoasDisponiveis = getPessoasParaDividas();
  
  if (dividas.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 1rem;">
        <i class="fas fa-info-circle"></i> Nenhuma dívida cadastrada. Clique em "Adicionar Dívida" para começar.
      </p>
    `;
    return;
  }
  
  container.innerHTML = dividas.map(divida => {
    const responsaveisNomes = divida.responsaveis.map(id => {
      const pessoa = pessoasDisponiveis.find(p => p.id === id);
      return pessoa ? pessoa.nome : id;
    }).join(', ');
    
    return `
      <div class="divida-card" data-divida-id="${divida.id}" style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
        <div class="divida-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
          <h4 style="color: var(--accent-color); font-size: 1.1rem; font-weight: 600; margin: 0;">
            <i class="fas fa-file-invoice-dollar"></i> ${divida.motivo || `Dívida #${divida.id}`}
            ${divida.saldo_devedor > 0 ? `<span style="color: #dc3545; font-size: 0.9rem; margin-left: 0.5rem;">R$ ${formatarMoedaDivida(divida.saldo_devedor)}</span>` : ''}
          </h4>
          <button type="button" onclick="deleteDivida(${divida.id})" 
                  style="background: #dc3545; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </div>
        
        <div class="form-grid-3">
          <!-- Valor Inicial Contratado -->
          <div class="form-group">
            <label for="divida_${divida.id}_valor_inicial">
              <i class="fas fa-dollar-sign"></i> Valor Inicial Contratado
            </label>
            <input type="text" 
                   id="divida_${divida.id}_valor_inicial" 
                   value="R$ ${formatarMoedaDivida(divida.valor_inicial || 0)}"
                   oninput="updateDividaField(${divida.id}, 'valor_inicial', this.value)"
                   onfocus="limparCampoDivida(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Prazo (meses) -->
          <div class="form-group">
            <label for="divida_${divida.id}_prazo">
              <i class="fas fa-calendar-alt"></i> Prazo (meses)
            </label>
            <input type="number" 
                   id="divida_${divida.id}_prazo" 
                   value="${divida.prazo || 0}"
                   onchange="updateDividaField(${divida.id}, 'prazo', this.value)"
                   min="0"
                   placeholder="0">
          </div>
          
          <!-- Valor das Parcelas -->
          <div class="form-group">
            <label for="divida_${divida.id}_valor_parcela">
              <i class="fas fa-money-bill-wave"></i> Valor das Parcelas
            </label>
            <input type="text" 
                   id="divida_${divida.id}_valor_parcela" 
                   value="R$ ${formatarMoedaDivida(divida.valor_parcela || 0)}"
                   oninput="updateDividaField(${divida.id}, 'valor_parcela', this.value)"
                   onfocus="limparCampoDivida(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Total de Parcelas Pagas -->
          <div class="form-group">
            <label for="divida_${divida.id}_parcelas_pagas">
              <i class="fas fa-check-circle"></i> Parcelas Pagas
            </label>
            <input type="number" 
                   id="divida_${divida.id}_parcelas_pagas" 
                   value="${divida.parcelas_pagas || 0}"
                   onchange="updateDividaField(${divida.id}, 'parcelas_pagas', this.value)"
                   min="0"
                   placeholder="0">
          </div>
          
          <!-- Saldo Devedor Atualizado -->
          <div class="form-group">
            <label for="divida_${divida.id}_saldo_devedor">
              <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> Saldo Devedor Atualizado
            </label>
            <input type="text" 
                   id="divida_${divida.id}_saldo_devedor" 
                   value="R$ ${formatarMoedaDivida(divida.saldo_devedor || 0)}"
                   oninput="updateDividaField(${divida.id}, 'saldo_devedor', this.value)"
                   onfocus="limparCampoDivida(this)"
                   placeholder="R$ 0,00"
                   style="border-color: #dc3545;">
          </div>
          
          <!-- Motivo da Dívida -->
          <div class="form-group">
            <label for="divida_${divida.id}_motivo">
              <i class="fas fa-question-circle"></i> Motivo da Dívida
            </label>
            <input type="text" 
                   id="divida_${divida.id}_motivo" 
                   value="${divida.motivo || ''}"
                   onchange="updateDividaField(${divida.id}, 'motivo', this.value); renderDividas();"
                   placeholder="Ex: Financiamento, Empréstimo...">
          </div>
          
          <!-- A quem deve -->
          <div class="form-group">
            <label for="divida_${divida.id}_credor">
              <i class="fas fa-building"></i> A quem deve
            </label>
            <input type="text" 
                   id="divida_${divida.id}_credor" 
                   value="${divida.credor || ''}"
                   onchange="updateDividaField(${divida.id}, 'credor', this.value)"
                   placeholder="Ex: Banco, Financeira...">
          </div>
          
          <!-- Dívida Planejada -->
          <div class="form-group">
            <label for="divida_${divida.id}_planejada">
              <i class="fas fa-clipboard-check"></i> Dívida Planejada?
            </label>
            <select id="divida_${divida.id}_planejada" 
                    onchange="updateDividaField(${divida.id}, 'planejada', this.value)">
              <option value="false" ${!divida.planejada ? 'selected' : ''}>Não</option>
              <option value="true" ${divida.planejada ? 'selected' : ''}>Sim</option>
            </select>
          </div>
          
          <!-- Inventariável -->
          <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; padding-top: 1.5rem;">
            <input type="checkbox" 
                   id="divida_${divida.id}_inventariavel" 
                   ${divida.inventariavel !== false ? 'checked' : ''}
                   onchange="updateDividaField(${divida.id}, 'inventariavel', this.checked)"
                   style="width: 18px; height: 18px; cursor: pointer;">
            <label for="divida_${divida.id}_inventariavel" style="cursor: pointer; margin: 0;">
              <i class="fas fa-gavel"></i> Inventariável
            </label>
          </div>
          
          <!-- Quem fez a dívida -->
          <div class="form-group full-width">
            <label for="divida_${divida.id}_responsaveis">
              <i class="fas fa-users"></i> Quem fez a dívida
              <span style="font-size: 0.75rem; font-weight: normal; opacity: 0.8;">(Segure Ctrl/Cmd para selecionar múltiplos)</span>
            </label>
            <select id="divida_${divida.id}_responsaveis" 
                    multiple 
                    style="min-height: 80px;"
                    onchange="updateDividaField(${divida.id}, 'responsaveis', this.value)">
              ${pessoasDisponiveis.map(pessoa => `
                <option value="${pessoa.id}" ${divida.responsaveis.includes(pessoa.id) ? 'selected' : ''}>
                  ${pessoa.nome} (${pessoa.tipo})
                </option>
              `).join('')}
            </select>
            ${responsaveisNomes ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">Selecionados: ${responsaveisNomes}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Função para atualizar total de dívidas
function updateDividaTotal() {
  const total = dividas.reduce((sum, d) => sum + (parseFloat(d.saldo_devedor) || 0), 0);
  const totalElement = document.getElementById('dividas-total');
  if (totalElement) {
    totalElement.textContent = `Total: R$ ${formatarMoedaDivida(total)}`;
  }
}

// Funções para obter e definir dados
function getDividasData() {
  return dividas;
}

function setDividasData(data) {
  if (Array.isArray(data)) {
    dividas = data;
    // Atualizar contador
    if (dividas.length > 0) {
      dividaCounter = Math.max(...dividas.map(d => d.id || 0));
    }
    renderDividas();
    updateDividaTotal();
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDividasModule);
} else {
  initDividasModule();
}

// Exportar funções
export {
  initDividasModule,
  getDividasData,
  setDividasData,
  renderDividas
};
