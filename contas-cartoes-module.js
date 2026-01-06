// ========================================
// MÓDULO DE CONTAS & CARTÕES DE CRÉDITO
// ========================================

// Dados de contas e cartões
let contasCartoes = [];
let contaCartaoCounter = 0;

// Tipos de cartão (lista gerenciável)
let tiposCartao = [
  // Visa
  { id: 'visa_classic', nome: 'Visa Classic' },
  { id: 'visa_gold', nome: 'Visa Gold' },
  { id: 'visa_platinum', nome: 'Visa Platinum' },
  { id: 'visa_signature', nome: 'Visa Signature' },
  { id: 'visa_infinite', nome: 'Visa Infinite' },
  // Mastercard
  { id: 'mastercard_standard', nome: 'Mastercard Standard' },
  { id: 'mastercard_gold', nome: 'Mastercard Gold' },
  { id: 'mastercard_platinum', nome: 'Mastercard Platinum' },
  { id: 'mastercard_black', nome: 'Mastercard Black' },
  // Elo
  { id: 'elo_basico', nome: 'Elo Básico' },
  { id: 'elo_mais', nome: 'Elo Mais' },
  { id: 'elo_grafite', nome: 'Elo Grafite' },
  { id: 'elo_nanquim', nome: 'Elo Nanquim' },
  { id: 'elo_diners', nome: 'Elo Diners Club' },
  // American Express
  { id: 'amex_green', nome: 'Amex Green' },
  { id: 'amex_gold', nome: 'Amex Gold' },
  { id: 'amex_platinum', nome: 'Amex Platinum' },
  { id: 'amex_centurion', nome: 'Amex Centurion (Black)' },
  // Hipercard
  { id: 'hipercard_basico', nome: 'Hipercard Básico' },
  { id: 'hipercard_platinum', nome: 'Hipercard Platinum' },
  // Outros
  { id: 'diners_club', nome: 'Diners Club' },
  { id: 'outro', nome: 'Outro' }
];

// Inicialização do módulo
function initContasCartoesModule() {
  console.log('Módulo de Contas & Cartões carregado');
  
  // Expor funções globalmente
  window.addContaCartao = addContaCartao;
  window.deleteContaCartao = deleteContaCartao;
  window.updateContaCartaoField = updateContaCartaoField;
  window.getContasCartoesData = getContasCartoesData;
  window.setContasCartoesData = setContasCartoesData;
  window.renderContasCartoes = renderContasCartoes;
  window.formatarMoedaContaCartao = formatarMoedaContaCartao;
  window.limparCampoContaCartao = limparCampoContaCartao;
  window.addTipoCartao = addTipoCartao;
  window.removeTipoCartao = removeTipoCartao;
  window.getTiposCartao = getTiposCartao;
  window.setTiposCartao = setTiposCartao;
  window.abrirModalTiposCartao = abrirModalTiposCartao;
  window.fecharModalTiposCartao = fecharModalTiposCartao;
  
  // Renderizar a seção
  renderContasCartoes();
}

// Função para formatar moeda
function formatarMoedaContaCartao(valor) {
  if (!valor && valor !== 0) return '';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para limpar campo de moeda quando está zerado
function limparCampoContaCartao(input) {
  if (input.value === 'R$ 0,00' || input.value === '0,00') {
    input.value = '';
  }
}

// Função para parsear valor monetário
function parseMoedaContaCartao(valor) {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

// Função para atualizar campo de moeda com máscara
function updateContaCartaoMoedaField(id, field, valor) {
  const item = contasCartoes.find(c => c.id === id);
  if (item) {
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    item[field] = parseFloat(valorNumerico) || 0;
    
    const input = document.getElementById(`cc_${id}_${field}`);
    if (input) {
      input.value = `R$ ${formatarMoedaContaCartao(valorNumerico)}`;
    }
  }
}

// Função para atualizar campo
function updateContaCartaoField(id, field, valor) {
  const item = contasCartoes.find(c => c.id === id);
  if (!item) return;
  
  const camposMonetarios = ['tarifa_anuidade'];
  const camposNumericos = ['pontos_por_dolar', 'cashback'];
  
  if (camposMonetarios.includes(field)) {
    updateContaCartaoMoedaField(id, field, valor);
  } else if (camposNumericos.includes(field)) {
    item[field] = parseFloat(valor) || 0;
  } else if (field === 'tipo') {
    item[field] = valor;
    renderContasCartoes(); // Re-renderizar para mostrar/ocultar campos específicos
  } else {
    item[field] = valor;
  }
}

// Função para obter pessoas disponíveis
function getPessoasParaContasCartoes() {
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

// Funções para gerenciar tipos de cartão
function addTipoCartao(nome) {
  if (!nome || nome.trim() === '') return false;
  
  const id = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  
  // Verificar se já existe
  if (tiposCartao.find(t => t.id === id || t.nome.toLowerCase() === nome.toLowerCase())) {
    alert('Este tipo de cartão já existe!');
    return false;
  }
  
  tiposCartao.push({ id, nome: nome.trim() });
  renderModalTiposCartao();
  renderContasCartoes();
  return true;
}

function removeTipoCartao(id) {
  // Verificar se está em uso
  const emUso = contasCartoes.some(c => c.tipo_cartao === id);
  if (emUso) {
    alert('Este tipo de cartão está em uso e não pode ser removido!');
    return false;
  }
  
  tiposCartao = tiposCartao.filter(t => t.id !== id);
  renderModalTiposCartao();
  return true;
}

function getTiposCartao() {
  return tiposCartao;
}

function setTiposCartao(tipos) {
  if (Array.isArray(tipos)) {
    tiposCartao = tipos;
  }
}

// Modal para gerenciar tipos de cartão
function abrirModalTiposCartao() {
  // Criar modal se não existir
  let modal = document.getElementById('modal-tipos-cartao');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-tipos-cartao';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div style="background: var(--card-bg, #1a2e1a); border: 2px solid var(--accent-color, #d4af37); border-radius: 12px; padding: 1.5rem; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color, #2d4a2d);">
        <h3 style="color: var(--accent-color, #d4af37); margin: 0;">
          <i class="fas fa-credit-card"></i> Gerenciar Tipos de Cartão
        </h3>
        <button onclick="fecharModalTiposCartao()" style="background: none; border: none; color: var(--text-light, #e8e8e8); font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      
      <!-- Adicionar novo tipo -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <input type="text" id="novo-tipo-cartao" placeholder="Nome do novo tipo de cartão" 
               style="flex: 1; padding: 0.6rem; border: 2px solid var(--border-color, #2d4a2d); border-radius: 6px; background: var(--dark-bg, #0d1f0d); color: var(--text-light, #e8e8e8);">
        <button onclick="const input = document.getElementById('novo-tipo-cartao'); if(addTipoCartao(input.value)) input.value = '';" 
                style="background: var(--success-color, #28a745); color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer;">
          <i class="fas fa-plus"></i> Adicionar
        </button>
      </div>
      
      <!-- Lista de tipos -->
      <div id="lista-tipos-cartao" style="max-height: 400px; overflow-y: auto;">
        ${renderListaTiposCartao()}
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
}

function fecharModalTiposCartao() {
  const modal = document.getElementById('modal-tipos-cartao');
  if (modal) {
    modal.style.display = 'none';
  }
}

function renderModalTiposCartao() {
  const lista = document.getElementById('lista-tipos-cartao');
  if (lista) {
    lista.innerHTML = renderListaTiposCartao();
  }
}

function renderListaTiposCartao() {
  return tiposCartao.map(tipo => {
    const emUso = contasCartoes.some(c => c.tipo_cartao === tipo.id);
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--border-color, #2d4a2d);">
        <span style="color: var(--text-light, #e8e8e8);">${tipo.nome}</span>
        <button onclick="removeTipoCartao('${tipo.id}')" 
                style="background: ${emUso ? '#6c757d' : '#dc3545'}; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: ${emUso ? 'not-allowed' : 'pointer'}; font-size: 0.8rem;"
                ${emUso ? 'disabled title="Em uso"' : ''}>
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }).join('');
}

// Função para adicionar nova conta/cartão
function addContaCartao() {
  const id = ++contaCartaoCounter;
  
  const novoItem = {
    id: id,
    tipo: 'cartao', // 'cartao' ou 'conta'
    titular: '',
    tipo_cartao: '',
    instituicao: '',
    tarifa_anuidade: 0,
    pontos_por_dolar: 0,
    cashback: 0,
    beneficios: ''
  };
  
  contasCartoes.push(novoItem);
  renderContasCartoes();
}

// Função para excluir conta/cartão
function deleteContaCartao(id) {
  if (!confirm('Tem certeza que deseja excluir este item?')) return;
  
  contasCartoes = contasCartoes.filter(c => c.id !== id);
  renderContasCartoes();
}

// Função para renderizar contas e cartões
function renderContasCartoes() {
  const container = document.getElementById('contas-cartoes-container');
  if (!container) return;
  
  const pessoasDisponiveis = getPessoasParaContasCartoes();
  
  if (contasCartoes.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 1rem;">
        <i class="fas fa-info-circle"></i> Nenhuma conta ou cartão cadastrado. Clique em "Adicionar Conta/Cartão" para começar.
      </p>
    `;
    return;
  }
  
  container.innerHTML = contasCartoes.map(item => {
    const isCartao = item.tipo === 'cartao';
    const titularNome = pessoasDisponiveis.find(p => p.id === item.titular)?.nome || item.titular || 'Não informado';
    const tipoCartaoNome = tiposCartao.find(t => t.id === item.tipo_cartao)?.nome || item.tipo_cartao || '';
    
    return `
      <div class="conta-cartao-card" data-cc-id="${item.id}" style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
        <div class="cc-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
          <h4 style="color: var(--accent-color); font-size: 1.1rem; font-weight: 600; margin: 0;">
            <i class="fas ${isCartao ? 'fa-credit-card' : 'fa-university'}"></i> 
            ${isCartao ? 'Cartão' : 'Conta'} ${item.instituicao || `#${item.id}`}
            ${tipoCartaoNome ? `<span style="font-size: 0.85rem; opacity: 0.8;"> - ${tipoCartaoNome}</span>` : ''}
          </h4>
          <button type="button" onclick="deleteContaCartao(${item.id})" 
                  style="background: #dc3545; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </div>
        
        <div class="form-grid-3">
          <!-- Tipo -->
          <div class="form-group">
            <label for="cc_${item.id}_tipo">
              <i class="fas fa-tag"></i> Tipo *
            </label>
            <select id="cc_${item.id}_tipo" 
                    onchange="updateContaCartaoField(${item.id}, 'tipo', this.value)">
              <option value="cartao" ${item.tipo === 'cartao' ? 'selected' : ''}>Cartão de Crédito</option>
              <option value="conta" ${item.tipo === 'conta' ? 'selected' : ''}>Conta Bancária</option>
            </select>
          </div>
          
          <!-- De quem é -->
          <div class="form-group">
            <label for="cc_${item.id}_titular">
              <i class="fas fa-user"></i> De quem é *
            </label>
            <select id="cc_${item.id}_titular" 
                    onchange="updateContaCartaoField(${item.id}, 'titular', this.value)">
              <option value="">Selecione...</option>
              ${pessoasDisponiveis.map(pessoa => `
                <option value="${pessoa.id}" ${item.titular === pessoa.id ? 'selected' : ''}>
                  ${pessoa.nome} (${pessoa.tipo})
                </option>
              `).join('')}
            </select>
          </div>
          
          <!-- Tipo de Cartão (só para cartão) -->
          ${isCartao ? `
            <div class="form-group">
              <label for="cc_${item.id}_tipo_cartao">
                <i class="fas fa-credit-card"></i> Tipo de Cartão
                <button type="button" onclick="abrirModalTiposCartao()" 
                        style="background: none; border: none; color: var(--accent-color); cursor: pointer; font-size: 0.8rem; margin-left: 0.3rem;" 
                        title="Gerenciar tipos de cartão">
                  <i class="fas fa-cog"></i>
                </button>
              </label>
              <select id="cc_${item.id}_tipo_cartao" 
                      onchange="updateContaCartaoField(${item.id}, 'tipo_cartao', this.value)">
                <option value="">Selecione...</option>
                ${tiposCartao.map(tipo => `
                  <option value="${tipo.id}" ${item.tipo_cartao === tipo.id ? 'selected' : ''}>
                    ${tipo.nome}
                  </option>
                `).join('')}
              </select>
            </div>
          ` : '<div></div>'}
          
          <!-- Instituição -->
          <div class="form-group">
            <label for="cc_${item.id}_instituicao">
              <i class="fas fa-building"></i> Instituição *
            </label>
            <input type="text" 
                   id="cc_${item.id}_instituicao" 
                   value="${item.instituicao || ''}"
                   onchange="updateContaCartaoField(${item.id}, 'instituicao', this.value); renderContasCartoes();"
                   placeholder="Ex: Nubank, Itaú, Bradesco...">
          </div>
          
          <!-- Tarifa/Anuidade -->
          <div class="form-group">
            <label for="cc_${item.id}_tarifa_anuidade">
              <i class="fas fa-dollar-sign"></i> ${isCartao ? 'Anuidade' : 'Tarifa Mensal'}
            </label>
            <input type="text" 
                   id="cc_${item.id}_tarifa_anuidade" 
                   value="R$ ${formatarMoedaContaCartao(item.tarifa_anuidade || 0)}"
                   oninput="updateContaCartaoField(${item.id}, 'tarifa_anuidade', this.value)"
                   onfocus="limparCampoContaCartao(this)"
                   placeholder="R$ 0,00">
          </div>
          
          ${isCartao ? `
            <!-- Pontos por Dólar -->
            <div class="form-group">
              <label for="cc_${item.id}_pontos_por_dolar">
                <i class="fas fa-star"></i> Pontos por Dólar
              </label>
              <input type="number" 
                     id="cc_${item.id}_pontos_por_dolar" 
                     value="${item.pontos_por_dolar || 0}"
                     onchange="updateContaCartaoField(${item.id}, 'pontos_por_dolar', this.value)"
                     step="0.1"
                     min="0"
                     placeholder="0">
            </div>
            
            <!-- Cashback -->
            <div class="form-group">
              <label for="cc_${item.id}_cashback">
                <i class="fas fa-percentage"></i> Cashback (%)
              </label>
              <input type="number" 
                     id="cc_${item.id}_cashback" 
                     value="${item.cashback || 0}"
                     onchange="updateContaCartaoField(${item.id}, 'cashback', this.value)"
                     step="0.01"
                     min="0"
                     max="100"
                     placeholder="0">
            </div>
            
            <!-- Benefícios -->
            <div class="form-group full-width">
              <label for="cc_${item.id}_beneficios">
                <i class="fas fa-gift"></i> Benefícios
              </label>
              <textarea id="cc_${item.id}_beneficios" 
                        rows="2"
                        onchange="updateContaCartaoField(${item.id}, 'beneficios', this.value)"
                        placeholder="Ex: Sala VIP, seguro viagem, acesso a lounges..."
                        style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem; resize: vertical;">${item.beneficios || ''}</textarea>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Funções para obter e definir dados
function getContasCartoesData() {
  return {
    contasCartoes: contasCartoes,
    tiposCartao: tiposCartao
  };
}

function setContasCartoesData(data) {
  if (data) {
    // Compatibilidade com formato antigo (array direto) e novo (objeto)
    if (Array.isArray(data)) {
      contasCartoes = data;
    } else {
      if (Array.isArray(data.contasCartoes)) {
        contasCartoes = data.contasCartoes;
      }
      if (Array.isArray(data.tiposCartao)) {
        tiposCartao = data.tiposCartao;
      }
    }
    
    // Atualizar contador
    if (contasCartoes.length > 0) {
      contaCartaoCounter = Math.max(...contasCartoes.map(c => c.id || 0));
    }
    renderContasCartoes();
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContasCartoesModule);
} else {
  initContasCartoesModule();
}

// Exportar funções
export {
  initContasCartoesModule,
  getContasCartoesData,
  setContasCartoesData,
  renderContasCartoes,
  getTiposCartao,
  setTiposCartao
};
