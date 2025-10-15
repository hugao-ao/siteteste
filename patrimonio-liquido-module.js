// =========================================
// PATRIMÔNIO LÍQUIDO - Módulo JavaScript v2
// Com classificação de risco e gráficos
// =========================================

import { supabase } from './supabase.js';

// Arrays para armazenar os patrimônios líquidos
let patrimoniosLiquidos = [];
let patrimonioLiquidoCounter = 0;
let tiposProdutos = [];
let instituicoes = [];

// Mapeamento de classificação de risco
const CLASSIFICACAO_RISCO = {
  'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': { label: 'Risco Muito Baixo (Garantia Soberana)', cor: '#006400', ordem: 1 },
  'RISCO_MUITO_BAIXO_GARANTIA_FGC': { label: 'Risco Muito Baixo (Garantia FGC)', cor: '#228B22', ordem: 2 },
  'RISCO_BAIXO_GARANTIA_FGC': { label: 'Risco Baixo (Garantia FGC)', cor: '#32CD32', ordem: 3 },
  'RISCO_BAIXO_SEM_GARANTIA': { label: 'Risco Baixo', cor: '#90EE90', ordem: 4 },
  'RISCO_MEDIO_SEM_GARANTIA': { label: 'Risco Médio', cor: '#FFD700', ordem: 5 },
  'RISCO_ALTO_PROTECAO_MRP': { label: 'Risco Alto (Proteção MRP)', cor: '#FFA500', ordem: 6 },
  'RISCO_ALTO_SEM_GARANTIA': { label: 'Risco Alto', cor: '#FF8C00', ordem: 7 },
  'RISCO_MUITO_ALTO_PROTECAO_MRP': { label: 'Risco Muito Alto (Proteção MRP)', cor: '#FF6347', ordem: 8 },
  'RISCO_MUITO_ALTO_SEM_GARANTIA': { label: 'Risco Muito Alto', cor: '#DC143C', ordem: 9 },
  'RISCO_ABSOLUTO_SEM_GARANTIA': { label: 'Risco Absoluto', cor: '#8B0000', ordem: 10 }
};

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

function aplicarMascaraMoeda(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '');
  
  // Se está vazio, não fazer nada
  if (valor === '') {
    return;
  }
  
  // Converter para número e formatar
  const numeroEmCentavos = parseInt(valor);
  const numeroEmReais = numeroEmCentavos / 100;
  
  input.value = formatarMoeda(numeroEmReais);
}

function limparCampoMoeda(event) {
  const input = event.target;
  if (input.value === 'R$ 0,00') {
    input.value = '';
  }
}

// =========================================
// FUNÇÕES DE SUPABASE
// =========================================

async function carregarTiposProdutos() {
  try {
    const { data, error } = await supabase
      .from('tipos_produtos_investimento')
      .select('*')
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });
    
    if (error) throw error;
    tiposProdutos = data || [];
  } catch (error) {
    console.error('Erro ao carregar tipos de produtos:', error);
    tiposProdutos = [];
  }
}

async function carregarInstituicoes() {
  try {
    const { data, error } = await supabase
      .from('instituicoes_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true });
    
    if (error) throw error;
    instituicoes = data || [];
  } catch (error) {
    console.error('Erro ao carregar instituições:', error);
    instituicoes = [];
  }
}

async function adicionarTipoProduto(nome, categoria, classificacaoRisco) {
  try {
    const { data, error } = await supabase
      .from('tipos_produtos_investimento')
      .insert([{ nome, categoria, classificacao_risco: classificacaoRisco }])
      .select();
    
    if (error) throw error;
    await carregarTiposProdutos();
    return data[0];
  } catch (error) {
    console.error('Erro ao adicionar tipo de produto:', error);
    alert('Erro ao adicionar tipo de produto: ' + error.message);
    return null;
  }
}

async function adicionarInstituicao(nome, tipo) {
  try {
    const { data, error } = await supabase
      .from('instituicoes_financeiras')
      .insert([{ nome, tipo }])
      .select();
    
    if (error) throw error;
    await carregarInstituicoes();
    return data[0];
  } catch (error) {
    console.error('Erro ao adicionar instituição:', error);
    alert('Erro ao adicionar instituição: ' + error.message);
    return null;
  }
}

// =========================================
// FUNÇÕES DE GERENCIAMENTO
// =========================================

function addPatrimonioLiquido() {
  const id = ++patrimonioLiquidoCounter;
  
  const patrimonioLiquido = {
    id: id,
    valor_atual: 0,
    tipo_produto: null,
    tipo_produto_nome: '',
    classificacao_risco: '',
    instituicao: null,
    instituicao_nome: '',
    finalidade: 'SEM_FINALIDADE',
    aporte_valor: 0,
    aporte_frequencia: 'NENHUM',
    donos: []
  };
  
  patrimoniosLiquidos.push(patrimonioLiquido);
  renderPatrimoniosLiquidos();
}

function deletePatrimonioLiquido(id) {
  if (!confirm('Tem certeza que deseja excluir este investimento?')) return;
  
  patrimoniosLiquidos = patrimoniosLiquidos.filter(p => p.id !== id);
  renderPatrimoniosLiquidos();
  updatePatrimonioLiquidoTotal();
  renderGraficos();
}

function updatePatrimonioLiquidoField(id, field, value) {
  const patrimonioLiquido = patrimoniosLiquidos.find(p => p.id === id);
  if (!patrimonioLiquido) return;
  
  if (field === 'valor_atual' || field === 'aporte_valor') {
    patrimonioLiquido[field] = desformatarMoeda(value);
  } else if (field === 'tipo_produto') {
    const produto = tiposProdutos.find(p => p.id === value);
    if (produto) {
      patrimonioLiquido.tipo_produto = produto.id;
      patrimonioLiquido.tipo_produto_nome = produto.nome;
      patrimonioLiquido.classificacao_risco = produto.classificacao_risco;
    }
    renderPatrimoniosLiquidos();
  } else if (field === 'instituicao') {
    const inst = instituicoes.find(i => i.id === value);
    if (inst) {
      patrimonioLiquido.instituicao = inst.id;
      patrimonioLiquido.instituicao_nome = inst.nome;
    }
  } else if (field === 'donos') {
    const select = document.querySelector(`[data-patrimonio-liquido-id="${id}"] select[name="donos"]`);
    patrimonioLiquido.donos = Array.from(select.selectedOptions).map(opt => opt.value);
  } else {
    patrimonioLiquido[field] = value;
  }
  
  updatePatrimonioLiquidoTotal();
  renderGraficos();
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

function getRiscoInfo(classificacao) {
  return CLASSIFICACAO_RISCO[classificacao] || { label: 'Não classificado', cor: '#999', ordem: 99 };
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
  
  // Agrupar tipos de produtos por categoria
  const produtosPorCategoria = {};
  tiposProdutos.forEach(produto => {
    if (!produtosPorCategoria[produto.categoria]) {
      produtosPorCategoria[produto.categoria] = [];
    }
    produtosPorCategoria[produto.categoria].push(produto);
  });
  
  // Agrupar instituições por tipo
  const instituicoesPorTipo = {};
  instituicoes.forEach(inst => {
    if (!instituicoesPorTipo[inst.tipo]) {
      instituicoesPorTipo[inst.tipo] = [];
    }
    instituicoesPorTipo[inst.tipo].push(inst);
  });
  
  container.innerHTML = patrimoniosLiquidos.map(pl => {
    const riscoInfo = getRiscoInfo(pl.classificacao_risco);
    
    return `
    <div class="patrimonio-liquido-card" data-patrimonio-liquido-id="${pl.id}">
      <div class="patrimonio-liquido-header">
        <h4 class="patrimonio-liquido-title">
          <i class="fas fa-chart-line"></i> Investimento #${pl.id}
          <span class="badge-finalidade ${getFinalidadeBadgeClass(pl.finalidade)}">
            ${getFinalidadeLabel(pl.finalidade)}
          </span>
          ${pl.classificacao_risco ? `
            <span class="badge-risco" style="background-color: ${riscoInfo.cor}; color: white; padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.75rem; margin-left: 0.5rem;">
              ${riscoInfo.label}
            </span>
          ` : ''}
        </h4>
        <div class="patrimonio-liquido-actions">
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
            data-pl-id="${pl.id}"
            data-field="valor_atual"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-chart-pie"></i> Tipo de Produto *
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'tipo_produto', this.value)">
            <option value="">Selecione o tipo</option>
            ${Object.keys(produtosPorCategoria).map(categoria => `
              <optgroup label="${categoria}">
                ${produtosPorCategoria[categoria].map(produto => `
                  <option value="${produto.id}" ${pl.tipo_produto === produto.id ? 'selected' : ''}>
                    ${produto.nome}
                  </option>
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
            ${Object.keys(instituicoesPorTipo).map(tipo => `
              <optgroup label="${tipo}">
                ${instituicoesPorTipo[tipo].map(inst => `
                  <option value="${inst.id}" ${pl.instituicao === inst.id ? 'selected' : ''}>
                    ${inst.nome}
                  </option>
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
            data-pl-id="${pl.id}"
            data-field="aporte_valor"
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
    </div>
  `;
  }).join('');
  
  // Aplicar event listeners para máscaras de moeda
  container.querySelectorAll('.input-moeda').forEach(input => {
    input.addEventListener('input', aplicarMascaraMoeda);
    input.addEventListener('focus', limparCampoMoeda);
    input.addEventListener('blur', function() {
      const plId = parseInt(this.dataset.plId);
      const field = this.dataset.field;
      updatePatrimonioLiquidoField(plId, field, this.value);
    });
  });
  
  updatePatrimonioLiquidoTotal();
}

// =========================================
// GRÁFICOS
// =========================================

function renderGraficos() {
  const container = document.getElementById('graficos-patrimonio-liquido');
  if (!container) return;
  
  // Agrupar investimentos por proprietários
  const gruposPorProprietarios = {};
  
  patrimoniosLiquidos.forEach(pl => {
    if (!pl.classificacao_risco || pl.valor_atual <= 0) return;
    
    const chaveProprietarios = pl.donos.sort().join(' + ') || 'Sem proprietário';
    
    if (!gruposPorProprietarios[chaveProprietarios]) {
      gruposPorProprietarios[chaveProprietarios] = {};
    }
    
    const riscoInfo = getRiscoInfo(pl.classificacao_risco);
    const riscoLabel = riscoInfo.label;
    
    if (!gruposPorProprietarios[chaveProprietarios][riscoLabel]) {
      gruposPorProprietarios[chaveProprietarios][riscoLabel] = {
        valor: 0,
        cor: riscoInfo.cor,
        ordem: riscoInfo.ordem
      };
    }
    
    gruposPorProprietarios[chaveProprietarios][riscoLabel].valor += parseFloat(pl.valor_atual);
  });
  
  // Renderizar gráficos
  if (Object.keys(gruposPorProprietarios).length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); opacity: 0.7;">Adicione investimentos com proprietários e classificação de risco para ver os gráficos.</p>';
    return;
  }
  
  container.innerHTML = Object.keys(gruposPorProprietarios).map((proprietarios, index) => {
    const dados = gruposPorProprietarios[proprietarios];
    const canvasId = `grafico-${index}`;
    
    return `
      <div style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h4 style="color: var(--accent-color); margin-bottom: 1rem; text-align: center;">
          <i class="fas fa-user-circle"></i> ${proprietarios}
        </h4>
        <canvas id="${canvasId}" style="max-height: 300px;"></canvas>
      </div>
    `;
  }).join('');
  
  // Criar gráficos com Chart.js
  Object.keys(gruposPorProprietarios).forEach((proprietarios, index) => {
    const dados = gruposPorProprietarios[proprietarios];
    const canvasId = `grafico-${index}`;
    const ctx = document.getElementById(canvasId);
    
    if (!ctx) return;
    
    // Ordenar por ordem de risco
    const dadosOrdenados = Object.entries(dados).sort((a, b) => a[1].ordem - b[1].ordem);
    
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: dadosOrdenados.map(([label]) => label),
        datasets: [{
          data: dadosOrdenados.map(([, info]) => info.valor),
          backgroundColor: dadosOrdenados.map(([, info]) => info.cor),
          borderColor: 'var(--dark-bg)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--text-light)',
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = formatarMoeda(context.parsed);
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  });
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
  renderGraficos();
}

// =========================================
// INICIALIZAÇÃO
// =========================================

async function initPatrimonioLiquido() {
  // Carregar dados do Supabase
  await carregarTiposProdutos();
  await carregarInstituicoes();
  
  const addBtn = document.getElementById('add-patrimonio-liquido-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addPatrimonioLiquido);
  }
  
  renderPatrimoniosLiquidos();
  renderGraficos();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPatrimonioLiquido);
} else {
  initPatrimonioLiquido();
}

// Expor funções globalmente
window.addPatrimonioLiquido = addPatrimonioLiquido;
window.deletePatrimonioLiquido = deletePatrimonioLiquido;
window.updatePatrimonioLiquidoField = updatePatrimonioLiquidoField;
window.getPatrimoniosLiquidosData = getPatrimoniosLiquidosData;
window.setPatrimoniosLiquidosData = setPatrimoniosLiquidosData;
window.adicionarTipoProduto = adicionarTipoProduto;
window.adicionarInstituicao = adicionarInstituicao;

