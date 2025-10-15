// =========================================
// PATRIMÔNIO LÍQUIDO - Módulo JavaScript
// =========================================

// Array para armazenar os patrimônios líquidos
let patrimoniosLiquidos = [];
let patrimonioLiquidoCounter = 0;

// Listas de tipos de produtos e instituições
const tiposProdutosInvestimento = [
  { categoria: 'Renda Fixa', items: ['Poupança', 'CDB', 'RDB', 'LCI', 'LCA', 'LCD', 'LH', 'LC', 'LF', 'Tesouro Selic', 'Tesouro Prefixado', 'Tesouro IPCA+', 'Tesouro RendA+', 'Tesouro Educa+', 'Debêntures', 'CRI', 'CRA'] },
  { categoria: 'Renda Variável', items: ['Ações', 'FIIs', 'ETFs', 'BDRs', 'Opções', 'Futuros', 'Contratos a Termo'] },
  { categoria: 'Fundos', items: ['Fundo DI', 'Fundo Renda Fixa', 'Fundo Multimercado', 'Fundo de Ações', 'Fundo Cambial', 'Fundo de Crédito Privado', 'Fundo Imobiliário'] },
  { categoria: 'Previdência', items: ['PGBL', 'VGBL'] },
  { categoria: 'Alternativos', items: ['Private Equity', 'Venture Capital', 'Criptomoedas', 'Ouro', 'COE'] }
];

const instituicoesFinanceiras = [
  { tipo: 'Bancos', items: ['Banco do Brasil', 'Itaú Unibanco', 'Bradesco', 'Santander', 'Caixa Econômica Federal', 'Banco Inter', 'Nubank', 'C6 Bank', 'BTG Pactual', 'Safra', 'Sicredi', 'Sicoob', 'Banrisul', 'BRB'] },
  { tipo: 'Corretoras', items: ['XP Investimentos', 'Rico', 'Clear', 'Ágora Investimentos', 'Modal', 'Órama', 'Guide Investimentos', 'Genial Investimentos', 'Toro Investimentos', 'Avenue'] },
  { tipo: 'Gestoras', items: ['BlackRock', 'Vanguard', 'Verde Asset', 'Kapitalo', 'SPX Capital', 'Dynamo', 'JGP', 'Absolute'] },
  { tipo: 'Previdência', items: ['Brasilprev', 'Icatu Seguros', 'SulAmérica', 'Porto Seguro'] },
  { tipo: 'Outros', items: ['Tesouro Nacional', 'B3'] }
];

// =========================================
// FUNÇÕES DE FORMATAÇÃO
// =========================================

function formatarMoeda(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  const numero = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.')) : valor;
  if (isNaN(numero)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero);
}

function desformatarMoeda(valorFormatado) {
  if (!valorFormatado) return 0;
  const valor = valorFormatado.toString()
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(valor) || 0;
}

function aplicarMascaraMoeda(input) {
  let valor = input.value.replace(/\D/g, '');
  if (valor === '') {
    input.value = 'R$ 0,00';
    return;
  }
  valor = (parseInt(valor) / 100).toFixed(2);
  input.value = formatarMoeda(valor);
}

// =========================================
// FUNÇÕES DE GERENCIAMENTO
// =========================================

function addPatrimonioLiquido() {
  const id = ++patrimonioLiquidoCounter;
  
  const patrimonioLiquido = {
    id: id,
    valor_atual: 0,
    tipo_produto: '',
    instituicao: '',
    finalidade: 'SEM_FINALIDADE',
    aporte_valor: 0,
    aporte_frequencia: 'NENHUM',
    donos: []
  };
  
  patrimoniosLiquidos.push(patrimonioLiquido);
  renderPatrimoniosLiquidos();
}

function editPatrimonioLiquido(id) {
  const patrimonioLiquido = patrimoniosLiquidos.find(p => p.id === id);
  if (!patrimonioLiquido) return;
  
  // Scroll para o card
  const card = document.querySelector(`[data-patrimonio-liquido-id="${id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.border = '3px solid var(--accent-color)';
    setTimeout(() => {
      card.style.border = '2px solid var(--border-color)';
    }, 2000);
  }
}

function deletePatrimonioLiquido(id) {
  if (!confirm('Tem certeza que deseja excluir este investimento?')) return;
  
  patrimoniosLiquidos = patrimoniosLiquidos.filter(p => p.id !== id);
  renderPatrimoniosLiquidos();
  updatePatrimonioLiquidoTotal();
}

function updatePatrimonioLiquidoField(id, field, value) {
  const patrimonioLiquido = patrimoniosLiquidos.find(p => p.id === id);
  if (!patrimonioLiquido) return;
  
  if (field === 'valor_atual' || field === 'aporte_valor') {
    patrimonioLiquido[field] = desformatarMoeda(value);
  } else if (field === 'donos') {
    const select = document.querySelector(`[data-patrimonio-liquido-id="${id}"] select[name="donos"]`);
    patrimonioLiquido.donos = Array.from(select.selectedOptions).map(opt => opt.value);
  } else {
    patrimonioLiquido[field] = value;
  }
  
  updatePatrimonioLiquidoTotal();
}

function updatePatrimonioLiquidoTotal() {
  const total = patrimoniosLiquidos.reduce((sum, p) => sum + (parseFloat(p.valor_atual) || 0), 0);
  const totalElement = document.getElementById('patrimonio-liquido-total');
  if (totalElement) {
    totalElement.textContent = `Total: ${formatarMoeda(total)}`;
  }
}

function getPessoasCasa() {
  const pessoas = [];
  
  // Titular
  const nomeTitular = document.getElementById('nome_diagnostico')?.value;
  if (nomeTitular) {
    pessoas.push({ id: 'titular', nome: nomeTitular });
  }
  
  // Cônjuge
  const nomeConjuge = document.getElementById('conjuge_nome')?.value;
  if (nomeConjuge) {
    pessoas.push({ id: 'conjuge', nome: nomeConjuge });
  }
  
  // Outras pessoas com renda
  if (typeof pessoasRenda !== 'undefined' && Array.isArray(pessoasRenda)) {
    pessoasRenda.forEach((pessoa, index) => {
      if (pessoa.nome) {
        pessoas.push({ id: `pessoa_${index}`, nome: pessoa.nome });
      }
    });
  }
  
  // Dependentes
  if (typeof dependentes !== 'undefined' && Array.isArray(dependentes)) {
    dependentes.forEach((dep, index) => {
      if (dep.nome) {
        pessoas.push({ id: `dependente_${index}`, nome: dep.nome });
      }
    });
  }
  
  return pessoas;
}

function getFinalidadeLabel(finalidade) {
  const labels = {
    'SEM_FINALIDADE': 'Sem Finalidade Específica',
    'RESERVA_EMERGENCIA': 'Reserva de Emergência',
    'RESERVA_OBJETIVOS': 'Reserva para Objetivos',
    'APOSENTADORIA': 'Aposentadoria'
  };
  return labels[finalidade] || finalidade;
}

function getFinalidadeBadgeClass(finalidade) {
  const classes = {
    'SEM_FINALIDADE': 'badge-sem-finalidade',
    'RESERVA_EMERGENCIA': 'badge-reserva-emergencia',
    'RESERVA_OBJETIVOS': 'badge-reserva-objetivos',
    'APOSENTADORIA': 'badge-aposentadoria'
  };
  return classes[finalidade] || 'badge-sem-finalidade';
}

// =========================================
// RENDERIZAÇÃO
// =========================================

function renderPatrimoniosLiquidos() {
  const container = document.getElementById('patrimonios-liquidos-container');
  if (!container) return;
  
  if (patrimoniosLiquidos.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-light); opacity: 0.7;">
        <i class="fas fa-wallet" style="font-size: 3rem; color: var(--secondary-color); opacity: 0.5; margin-bottom: 1rem;"></i>
        <p>Nenhum investimento cadastrado ainda.</p>
        <p style="font-size: 0.9rem;">Clique em "Adicionar Investimento" para começar.</p>
      </div>
    `;
    return;
  }
  
  const pessoasCasa = getPessoasCasa();
  
  container.innerHTML = patrimoniosLiquidos.map(pl => `
    <div class="patrimonio-liquido-card" data-patrimonio-liquido-id="${pl.id}">
      <div class="patrimonio-liquido-header">
        <h4 class="patrimonio-liquido-title">
          <i class="fas fa-chart-line"></i> Investimento #${pl.id}
          <span class="badge-finalidade ${getFinalidadeBadgeClass(pl.finalidade)}">
            ${getFinalidadeLabel(pl.finalidade)}
          </span>
        </h4>
        <div class="patrimonio-liquido-actions">
          <button type="button" class="edit-btn" onclick="editPatrimonioLiquido(${pl.id})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" class="delete-btn" onclick="deletePatrimonioLiquido(${pl.id})" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      <div class="form-grid">
        <div class="form-group">
          <label>
            <i class="fas fa-dollar-sign"></i> Valor Atual *
          </label>
          <input 
            type="text" 
            class="input-moeda" 
            value="${formatarMoeda(pl.valor_atual)}"
            onblur="updatePatrimonioLiquidoField(${pl.id}, 'valor_atual', this.value)"
            onfocus="if(this.value === 'R$ 0,00') this.value = ''"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-chart-pie"></i> Tipo de Produto *
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'tipo_produto', this.value)">
            <option value="">Selecione o tipo</option>
            ${tiposProdutosInvestimento.map(cat => `
              <optgroup label="${cat.categoria}">
                ${cat.items.map(item => `
                  <option value="${item}" ${pl.tipo_produto === item ? 'selected' : ''}>${item}</option>
                `).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-building"></i> Instituição *
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'instituicao', this.value)">
            <option value="">Selecione a instituição</option>
            ${instituicoesFinanceiras.map(tipo => `
              <optgroup label="${tipo.tipo}">
                ${tipo.items.map(item => `
                  <option value="${item}" ${pl.instituicao === item ? 'selected' : ''}>${item}</option>
                `).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-bullseye"></i> Finalidade
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'finalidade', this.value); renderPatrimoniosLiquidos();">
            <option value="SEM_FINALIDADE" ${pl.finalidade === 'SEM_FINALIDADE' ? 'selected' : ''}>Sem Finalidade Específica</option>
            <option value="RESERVA_EMERGENCIA" ${pl.finalidade === 'RESERVA_EMERGENCIA' ? 'selected' : ''}>Reserva de Emergência</option>
            <option value="RESERVA_OBJETIVOS" ${pl.finalidade === 'RESERVA_OBJETIVOS' ? 'selected' : ''}>Reserva para Objetivos</option>
            <option value="APOSENTADORIA" ${pl.finalidade === 'APOSENTADORIA' ? 'selected' : ''}>Aposentadoria</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-arrow-up"></i> Valor do Aporte
          </label>
          <input 
            type="text" 
            class="input-moeda" 
            value="${formatarMoeda(pl.aporte_valor)}"
            onblur="updatePatrimonioLiquidoField(${pl.id}, 'aporte_valor', this.value)"
            onfocus="if(this.value === 'R$ 0,00') this.value = ''"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-calendar"></i> Frequência do Aporte
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'aporte_frequencia', this.value)">
            <option value="NENHUM" ${pl.aporte_frequencia === 'NENHUM' ? 'selected' : ''}>Nenhum</option>
            <option value="MENSAL" ${pl.aporte_frequencia === 'MENSAL' ? 'selected' : ''}>Mensal</option>
            <option value="ANUAL" ${pl.aporte_frequencia === 'ANUAL' ? 'selected' : ''}>Anual</option>
          </select>
        </div>
        
        <div class="form-group full-width">
          <label>
            <i class="fas fa-users"></i> Dono(s) 
            <span style="font-size: 0.75rem; font-weight: normal; opacity: 0.8;">(Segure Ctrl/Cmd para selecionar múltiplos)</span>
          </label>
          <select 
            name="donos"
            multiple 
            style="min-height: 80px;"
            onchange="updatePatrimonioLiquidoField(${pl.id}, 'donos', this.value)"
          >
            ${pessoasCasa.map(pessoa => `
              <option value="${pessoa.nome}" ${pl.donos.includes(pessoa.nome) ? 'selected' : ''}>
                ${pessoa.nome}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      ${pl.valor_atual > 0 || pl.tipo_produto || pl.instituicao ? `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <div class="info-row-pl">
            <span class="info-label-pl">Valor Atual:</span>
            <span class="info-value-pl" style="color: var(--accent-color); font-weight: 700; font-size: 1.1rem;">
              ${formatarMoeda(pl.valor_atual)}
            </span>
          </div>
          ${pl.tipo_produto ? `
            <div class="info-row-pl">
              <span class="info-label-pl">Produto:</span>
              <span class="info-value-pl">${pl.tipo_produto}</span>
            </div>
          ` : ''}
          ${pl.instituicao ? `
            <div class="info-row-pl">
              <span class="info-label-pl">Instituição:</span>
              <span class="info-value-pl">${pl.instituicao}</span>
            </div>
          ` : ''}
          ${pl.aporte_valor > 0 ? `
            <div class="info-row-pl">
              <span class="info-label-pl">Aporte ${pl.aporte_frequencia}:</span>
              <span class="info-value-pl">${formatarMoeda(pl.aporte_valor)}</span>
            </div>
          ` : ''}
          ${pl.donos.length > 0 ? `
            <div class="info-row-pl">
              <span class="info-label-pl">Proprietário(s):</span>
              <div class="donos-list">
                ${pl.donos.map(dono => `<span class="dono-tag">${dono}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `).join('');
  
  // Aplicar máscaras de moeda
  container.querySelectorAll('.input-moeda').forEach(input => {
    input.addEventListener('input', function() {
      aplicarMascaraMoeda(this);
    });
  });
  
  updatePatrimonioLiquidoTotal();
}

// =========================================
// INTEGRAÇÃO COM O FORMULÁRIO PRINCIPAL
// =========================================

function getPatrimoniosLiquidosData() {
  return patrimoniosLiquidos;
}

function setPatrimoniosLiquidosData(data) {
  if (!data || !Array.isArray(data)) return;
  
  patrimoniosLiquidos = data;
  patrimonioLiquidoCounter = Math.max(...patrimoniosLiquidos.map(p => p.id), 0);
  renderPatrimoniosLiquidos();
}

// =========================================
// INICIALIZAÇÃO
// =========================================

function initPatrimonioLiquido() {
  const addBtn = document.getElementById('add-patrimonio-liquido-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addPatrimonioLiquido);
  }
  
  renderPatrimoniosLiquidos();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPatrimonioLiquido);
} else {
  initPatrimonioLiquido();
}

// Expor funções globalmente para uso no HTML
window.addPatrimonioLiquido = addPatrimonioLiquido;
window.editPatrimonioLiquido = editPatrimonioLiquido;
window.deletePatrimonioLiquido = deletePatrimonioLiquido;
window.updatePatrimonioLiquidoField = updatePatrimonioLiquidoField;
window.getPatrimoniosLiquidosData = getPatrimoniosLiquidosData;
window.setPatrimoniosLiquidosData = setPatrimoniosLiquidosData;

