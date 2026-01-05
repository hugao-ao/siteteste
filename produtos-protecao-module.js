// =========================================
// PRODUTOS DE PROTEÇÃO - Módulo JavaScript
// Com CRUD de itens e lista gerenciável de tipos
// =========================================

import { supabase } from './supabase.js';

// Arrays para armazenar os produtos de proteção
let produtosProtecao = [];
let produtoProtecaoCounter = 0;
let tiposProdutosProtecao = [];

// =========================================
// FUNÇÕES DE CARREGAMENTO DO SUPABASE
// =========================================

async function carregarTiposProdutosProtecao() {
  try {
    const { data, error } = await supabase
      .from('tipos_produtos_protecao')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });
    
    if (error) throw error;
    
    tiposProdutosProtecao = data || [];
    console.log('Tipos de produtos de proteção carregados:', tiposProdutosProtecao.length);
  } catch (error) {
    console.error('Erro ao carregar tipos de produtos de proteção:', error);
    // Fallback com tipos padrão
    tiposProdutosProtecao = [
      { id: '1', nome: 'Seguro Automóvel', categoria: 'Seguros' },
      { id: '2', nome: 'Seguro Imóvel', categoria: 'Seguros' },
      { id: '3', nome: 'Seguro de Vida', categoria: 'Seguros' },
      { id: '4', nome: 'Plano de Saúde', categoria: 'Saúde' },
      { id: '5', nome: 'Plano Odontológico', categoria: 'Saúde' },
      { id: '6', nome: 'Previdência Privada', categoria: 'Previdência' }
    ];
  }
}

// =========================================
// FUNÇÕES DE RENDERIZAÇÃO
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

// Função global para limpar campo de moeda
window.limparCampoMoedaProtecao = function(input) {
  if (input.value === 'R$ 0,00') {
    input.value = '';
  }
};

function parseMoeda(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  return desformatarMoeda(valor);
}

function renderProdutosProtecao() {
  const container = document.getElementById('produtos-protecao-container');
  if (!container) return;
  
  if (produtosProtecao.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 1rem;">Nenhum produto de proteção cadastrado. Clique em "Adicionar Produto" para começar.</p>';
    calcularTotalProtecao();
    return;
  }
  
  container.innerHTML = produtosProtecao.map((produto, index) => createProdutoProtecaoCard(produto, index)).join('');
  calcularTotalProtecao();
}

function createProdutoProtecaoCard(produto, index) {
  const produtoId = `produto_protecao_${index}`;
  const tipoDisplay = produto.tipo_produto || `Produto ${index + 1}`;
  const custoFormatado = produto.custo ? formatarMoeda(produto.custo) : '';
  const periodicidade = produto.periodicidade || 'mensal';
  
  // Agrupar tipos por categoria
  const tiposPorCategoria = {};
  tiposProdutosProtecao.forEach(tipo => {
    const cat = tipo.categoria || 'Outros';
    if (!tiposPorCategoria[cat]) {
      tiposPorCategoria[cat] = [];
    }
    tiposPorCategoria[cat].push(tipo);
  });
  
  return `
    <div class="produto-protecao-card" data-index="${index}" style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem; position: relative;">
      <div class="produto-protecao-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
        <h4 class="produto-protecao-title" style="color: var(--accent-color); font-size: 1.1rem; font-weight: 600; margin: 0;">
          <i class="fas fa-shield-alt"></i> ${tipoDisplay}
          ${custoFormatado ? `<span style="background: var(--success-color); color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600; margin-left: 0.5rem;">${custoFormatado}/${periodicidade === 'anual' ? 'ano' : 'mês'}</span>` : ''}
        </h4>
        <div class="produto-protecao-actions" style="display: flex; gap: 0.5rem;">
          <button type="button" onclick="deleteProdutoProtecao(${index})" class="delete-btn" title="Excluir" style="background: none; border: none; color: var(--text-light); cursor: pointer; padding: 0.3rem; border-radius: 4px; transition: all 0.3s ease; font-size: 0.9rem;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="form-group">
          <label for="${produtoId}_tipo" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-tag"></i> Tipo de Produto *
            <button type="button" onclick="abrirModalGerenciarTiposProtecao()" class="btn-gerenciar" style="background: none; border: 1px solid var(--border-color); color: var(--text-gold); padding: 0.2rem 0.5rem; border-radius: 5px; font-size: 0.7rem; cursor: pointer; margin-left: 0.5rem;">
              <i class="fas fa-cog"></i> Gerenciar
            </button>
          </label>
          <select id="${produtoId}_tipo" 
                  onchange="updateProdutoProtecaoField(${index}, 'tipo_produto', this.value)"
                  style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem; cursor: pointer;">
            <option value="">Selecione...</option>
            ${Object.keys(tiposPorCategoria).map(categoria => `
              <optgroup label="${categoria}">
                ${tiposPorCategoria[categoria].map(tipo => `
                  <option value="${tipo.nome}" ${produto.tipo_produto === tipo.nome ? 'selected' : ''}>${tipo.nome}</option>
                `).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="${produtoId}_objeto" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-file-alt"></i> Objeto do Produto
          </label>
          <input type="text" 
                 id="${produtoId}_objeto" 
                 list="${produtoId}_objeto_list"
                 value="${produto.objeto || ''}"
                 onchange="updateProdutoProtecaoField(${index}, 'objeto', this.value)"
                 onfocus="atualizarListaObjetosProtecao(${index})"
                 placeholder="Selecione ou digite..."
                 style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem;">
          <datalist id="${produtoId}_objeto_list">
            <!-- Opções serão preenchidas dinamicamente -->
          </datalist>
        </div>
        
        <div class="form-group">
          <label for="${produtoId}_custo" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-dollar-sign"></i> Custo *
          </label>
          <input type="text" 
                 id="${produtoId}_custo" 
                 value="${produto.custo ? formatarMoeda(produto.custo) : ''}"
                 oninput="updateProdutoProtecaoCusto(${index})"
                 onfocus="limparCampoMoedaProtecao(this)"
                 placeholder="R$ 0,00"
                 style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem;">
        </div>
        
        <div class="form-group">
          <label for="${produtoId}_periodicidade" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-calendar-alt"></i> Periodicidade
          </label>
          <select id="${produtoId}_periodicidade" 
                  onchange="updateProdutoProtecaoField(${index}, 'periodicidade', this.value)"
                  style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem; cursor: pointer;">
            <option value="mensal" ${produto.periodicidade === 'mensal' ? 'selected' : ''}>Mensal</option>
            <option value="anual" ${produto.periodicidade === 'anual' ? 'selected' : ''}>Anual</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="${produtoId}_vencimento" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-clock"></i> Validade/Vencimento
          </label>
          <input type="date" 
                 id="${produtoId}_vencimento" 
                 value="${produto.vencimento || ''}"
                 onchange="updateProdutoProtecaoField(${index}, 'vencimento', this.value)"
                 style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem;">
        </div>
        
        <div class="form-group">
          <label for="${produtoId}_seguradora" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-building"></i> Seguradora/Operadora
          </label>
          <input type="text" 
                 id="${produtoId}_seguradora" 
                 value="${produto.seguradora || ''}"
                 onchange="updateProdutoProtecaoField(${index}, 'seguradora', this.value)"
                 placeholder="Ex: Porto Seguro, Bradesco..."
                 style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem;">
        </div>
        
        <div class="form-group">
          <label for="${produtoId}_cotou_analisou" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
            <i class="fas fa-search-dollar"></i> Cotou e analisou antes?
          </label>
          <select id="${produtoId}_cotou_analisou" 
                  onchange="updateProdutoProtecaoField(${index}, 'cotou_analisou', this.value === 'true')"
                  style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem; cursor: pointer;">
            <option value="false" ${!produto.cotou_analisou ? 'selected' : ''}>Não</option>
            <option value="true" ${produto.cotou_analisou ? 'selected' : ''}>Sim</option>
          </select>
        </div>
      </div>
      
      <div class="form-group full-width" style="margin-top: 1rem;">
        <label for="${produtoId}_observacoes" style="display: block; margin-bottom: 0.3rem; color: var(--text-gold); font-weight: 600; font-size: 0.9rem;">
          <i class="fas fa-sticky-note"></i> Observações
        </label>
        <textarea id="${produtoId}_observacoes" 
                  onchange="updateProdutoProtecaoField(${index}, 'observacoes', this.value)"
                  rows="2"
                  placeholder="Observações adicionais sobre o produto..."
                  style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem; resize: vertical;">${produto.observacoes || ''}</textarea>
      </div>
      
      ${produto.origem_patrimonio ? `
        <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 5px; font-size: 0.8rem; color: var(--text-gold);">
          <i class="fas fa-link"></i> Vinculado ao patrimônio: ${produto.origem_patrimonio}
        </div>
      ` : ''}
    </div>
  `;
}

function calcularTotalProtecao() {
  let totalMensal = 0;
  let totalAnual = 0;
  
  produtosProtecao.forEach(produto => {
    const custo = parseFloat(produto.custo) || 0;
    if (produto.periodicidade === 'anual') {
      totalAnual += custo;
      totalMensal += custo / 12;
    } else {
      totalMensal += custo;
      totalAnual += custo * 12;
    }
  });
  
  const totalEl = document.getElementById('produtos-protecao-total');
  if (totalEl) {
    totalEl.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-light);">Mensal: ${formatarMoeda(totalMensal)}</div>
      <div style="font-size: 1rem; color: var(--accent-color); font-weight: bold;">Anual: ${formatarMoeda(totalAnual)}</div>
    `;
  }
}

// =========================================
// FUNÇÕES CRUD
// =========================================

function addProdutoProtecao(dadosPrePreenchidos = null) {
  const novoProduto = {
    id: ++produtoProtecaoCounter,
    tipo_produto: dadosPrePreenchidos?.tipo_produto || '',
    objeto: dadosPrePreenchidos?.objeto || '',
    custo: dadosPrePreenchidos?.custo || 0,
    periodicidade: dadosPrePreenchidos?.periodicidade || 'anual',
    vencimento: dadosPrePreenchidos?.vencimento || '',
    seguradora: dadosPrePreenchidos?.seguradora || '',
    cotou_analisou: dadosPrePreenchidos?.cotou_analisou || false,
    observacoes: dadosPrePreenchidos?.observacoes || '',
    origem_patrimonio: dadosPrePreenchidos?.origem_patrimonio || null
  };
  
  produtosProtecao.push(novoProduto);
  renderProdutosProtecao();
  
  // Scroll para o novo produto
  setTimeout(() => {
    const container = document.getElementById('produtos-protecao-container');
    if (container) {
      const lastCard = container.lastElementChild;
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 100);
  
  return novoProduto;
}

function deleteProdutoProtecao(index) {
  if (confirm('Tem certeza que deseja excluir este produto de proteção?')) {
    produtosProtecao.splice(index, 1);
    renderProdutosProtecao();
  }
}

function updateProdutoProtecaoField(index, campo, valor) {
  if (produtosProtecao[index]) {
    produtosProtecao[index][campo] = valor;
    
    // Atualizar título do card se for o tipo
    if (campo === 'tipo_produto' || campo === 'custo' || campo === 'periodicidade') {
      const card = document.querySelector(`[data-index="${index}"].produto-protecao-card`);
      if (card) {
        const titleEl = card.querySelector('.produto-protecao-title');
        if (titleEl) {
          const produto = produtosProtecao[index];
          const custoFormatado = produto.custo ? formatarMoeda(produto.custo) : '';
          const periodicidade = produto.periodicidade || 'mensal';
          titleEl.innerHTML = `
            <i class="fas fa-shield-alt"></i> ${produto.tipo_produto || `Produto ${index + 1}`}
            ${custoFormatado ? `<span style="background: var(--success-color); color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600; margin-left: 0.5rem;">${custoFormatado}/${periodicidade === 'anual' ? 'ano' : 'mês'}</span>` : ''}
          `;
        }
      }
      calcularTotalProtecao();
    }
  }
}

function updateProdutoProtecaoCusto(index, event) {
  const produtoId = `produto_protecao_${index}`;
  const custoInput = document.getElementById(`${produtoId}_custo`);
  
  if (custoInput && produtosProtecao[index]) {
    // Aplicar máscara de moeda
    aplicarMascaraMoeda({ target: custoInput });
    
    // Salvar valor numérico
    produtosProtecao[index].custo = desformatarMoeda(custoInput.value);
    
    // Atualizar título e total
    updateProdutoProtecaoField(index, 'custo', produtosProtecao[index].custo);
  }
}

// =========================================
// INTEGRAÇÃO COM PATRIMÔNIO FÍSICO
// =========================================

function criarProdutoProtecaoDePatrimonio(patrimonio) {
  // Verificar se já existe um produto vinculado a este patrimônio
  const produtoExistente = produtosProtecao.find(p => 
    p.origem_patrimonio === `${patrimonio.tipo} - ${patrimonio.detalhes}`
  );
  
  if (produtoExistente) {
    // Atualizar o produto existente
    produtoExistente.vencimento = patrimonio.seguro_vencimento || '';
    renderProdutosProtecao();
    return produtoExistente;
  }
  
  // Criar novo produto
  const dadosPrePreenchidos = {
    tipo_produto: `Seguro ${patrimonio.tipo || 'Patrimônio'}`,
    objeto: patrimonio.detalhes || '',
    vencimento: patrimonio.seguro_vencimento || '',
    periodicidade: 'anual',
    origem_patrimonio: `${patrimonio.tipo} - ${patrimonio.detalhes}`
  };
  
  return addProdutoProtecao(dadosPrePreenchidos);
}

function removerProdutoProtecaoDePatrimonio(patrimonio) {
  const origemPatrimonio = `${patrimonio.tipo} - ${patrimonio.detalhes}`;
  const index = produtosProtecao.findIndex(p => p.origem_patrimonio === origemPatrimonio);
  
  if (index !== -1) {
    produtosProtecao.splice(index, 1);
    renderProdutosProtecao();
  }
}

// =========================================
// MODAIS DE GERENCIAMENTO DE TIPOS
// =========================================

function abrirModalGerenciarTiposProtecao() {
  // Remover modal existente se houver
  const modalExistente = document.getElementById('modal-gerenciar-tipos-protecao');
  if (modalExistente) {
    modalExistente.remove();
  }
  
  // Agrupar tipos por categoria
  const tiposPorCategoria = {};
  tiposProdutosProtecao.forEach(tipo => {
    const cat = tipo.categoria || 'Outros';
    if (!tiposPorCategoria[cat]) {
      tiposPorCategoria[cat] = [];
    }
    tiposPorCategoria[cat].push(tipo);
  });
  
  const modalHTML = `
    <div id="modal-gerenciar-tipos-protecao" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
      <div class="modal-content" style="background: var(--surface-bg); border: 2px solid var(--border-color); border-radius: 15px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
          <h3 style="color: var(--accent-color); font-size: 1.5rem; font-weight: 700; margin: 0;">
            <i class="fas fa-cog"></i> Gerenciar Tipos de Produtos
          </h3>
          <button type="button" onclick="fecharModalTiposProtecao()" style="background: none; border: none; color: var(--text-light); font-size: 1.5rem; cursor: pointer; padding: 0.5rem;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body" style="margin-bottom: 1.5rem;">
          <div class="item-list" style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
            ${Object.keys(tiposPorCategoria).map(categoria => `
              <div style="margin-bottom: 1rem;">
                <h4 style="color: var(--text-gold); font-size: 0.9rem; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--primary-color); border-radius: 5px;">${categoria}</h4>
                ${tiposPorCategoria[categoria].map(tipo => `
                  <div class="item-card" style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.8rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div class="item-info">
                      <span style="color: var(--accent-color); font-weight: 600;">${tipo.nome}</span>
                    </div>
                    <div class="item-actions" style="display: flex; gap: 0.5rem;">
                      <button type="button" onclick="editarTipoProtecao('${tipo.id}')" class="btn-icon" style="background: none; border: none; color: var(--text-light); cursor: pointer; padding: 0.5rem; border-radius: 5px;">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button type="button" onclick="excluirTipoProtecao('${tipo.id}')" class="btn-icon delete" style="background: none; border: none; color: var(--text-light); cursor: pointer; padding: 0.5rem; border-radius: 5px;">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          
          <button type="button" onclick="abrirModalNovoTipoProtecao()" class="add-btn" style="width: 100%; background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: var(--dark-bg); border: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer;">
            <i class="fas fa-plus"></i> Adicionar Novo Tipo
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalTiposProtecao() {
  const modal = document.getElementById('modal-gerenciar-tipos-protecao');
  if (modal) {
    modal.remove();
  }
}

function abrirModalNovoTipoProtecao() {
  const modalHTML = `
    <div id="modal-novo-tipo-protecao" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10001;">
      <div class="modal-content" style="background: var(--surface-bg); border: 2px solid var(--border-color); border-radius: 15px; padding: 2rem; max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
          <h3 style="color: var(--accent-color); font-size: 1.3rem; font-weight: 700; margin: 0;">
            <i class="fas fa-plus"></i> Novo Tipo de Produto
          </h3>
          <button type="button" onclick="fecharModalNovoTipoProtecao()" style="background: none; border: none; color: var(--text-light); font-size: 1.5rem; cursor: pointer; padding: 0.5rem;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; color: var(--accent-color); font-weight: 600; margin-bottom: 0.5rem;">Nome do Tipo *</label>
            <input type="text" id="novo-tipo-protecao-nome" placeholder="Ex: Seguro Pet" style="width: 100%; padding: 0.8rem; background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 8px; color: var(--text-light); font-size: 1rem;">
          </div>
          
          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; color: var(--accent-color); font-weight: 600; margin-bottom: 0.5rem;">Categoria *</label>
            <select id="novo-tipo-protecao-categoria" style="width: 100%; padding: 0.8rem; background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 8px; color: var(--text-light); font-size: 1rem; cursor: pointer;">
<option value="Seguros">Seguros</option>
                <option value="Saúde">Saúde</option>
                <option value="Outros">Outros</option>
            </select>
          </div>
        </div>
        
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <button type="button" onclick="fecharModalNovoTipoProtecao()" style="padding: 0.8rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; background: var(--border-color); color: var(--text-light);">
            Cancelar
          </button>
          <button type="button" onclick="salvarNovoTipoProtecao()" style="padding: 0.8rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, var(--secondary-color), var(--warning-color)); color: var(--dark-bg);">
            <i class="fas fa-save"></i> Salvar
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalNovoTipoProtecao() {
  const modal = document.getElementById('modal-novo-tipo-protecao');
  if (modal) {
    modal.remove();
  }
}

async function salvarNovoTipoProtecao() {
  const nome = document.getElementById('novo-tipo-protecao-nome').value.trim();
  const categoria = document.getElementById('novo-tipo-protecao-categoria').value;
  
  if (!nome) {
    alert('Por favor, informe o nome do tipo de produto.');
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('tipos_produtos_protecao')
      .insert([{ nome, categoria }])
      .select();
    
    if (error) throw error;
    
    // Atualizar lista local
    if (data && data[0]) {
      tiposProdutosProtecao.push(data[0]);
    }
    
    fecharModalNovoTipoProtecao();
    fecharModalTiposProtecao();
    abrirModalGerenciarTiposProtecao();
    renderProdutosProtecao();
    
    alert('Tipo de produto adicionado com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar tipo de produto:', error);
    alert('Erro ao salvar tipo de produto: ' + error.message);
  }
}

async function editarTipoProtecao(id) {
  const tipo = tiposProdutosProtecao.find(t => t.id === id);
  if (!tipo) return;
  
  const modalHTML = `
    <div id="modal-editar-tipo-protecao" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10001;">
      <div class="modal-content" style="background: var(--surface-bg); border: 2px solid var(--border-color); border-radius: 15px; padding: 2rem; max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
          <h3 style="color: var(--accent-color); font-size: 1.3rem; font-weight: 700; margin: 0;">
            <i class="fas fa-edit"></i> Editar Tipo de Produto
          </h3>
          <button type="button" onclick="fecharModalEditarTipoProtecao()" style="background: none; border: none; color: var(--text-light); font-size: 1.5rem; cursor: pointer; padding: 0.5rem;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <input type="hidden" id="editar-tipo-protecao-id" value="${id}">
          
          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; color: var(--accent-color); font-weight: 600; margin-bottom: 0.5rem;">Nome do Tipo *</label>
            <input type="text" id="editar-tipo-protecao-nome" value="${tipo.nome}" style="width: 100%; padding: 0.8rem; background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 8px; color: var(--text-light); font-size: 1rem;">
          </div>
          
          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; color: var(--accent-color); font-weight: 600; margin-bottom: 0.5rem;">Categoria *</label>
            <select id="editar-tipo-protecao-categoria" style="width: 100%; padding: 0.8rem; background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 8px; color: var(--text-light); font-size: 1rem; cursor: pointer;">
              <option value="Seguros" ${tipo.categoria === 'Seguros' ? 'selected' : ''}>Seguros</option>
              <option value="Saúde" ${tipo.categoria === 'Saúde' ? 'selected' : ''}>Saúde</option>
              <option value="Previdência" ${tipo.categoria === 'Previdência' ? 'selected' : ''}>Previdência</option>
              <option value="Outros" ${tipo.categoria === 'Outros' ? 'selected' : ''}>Outros</option>
            </select>
          </div>
        </div>
        
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <button type="button" onclick="fecharModalEditarTipoProtecao()" style="padding: 0.8rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; background: var(--border-color); color: var(--text-light);">
            Cancelar
          </button>
          <button type="button" onclick="salvarEdicaoTipoProtecao()" style="padding: 0.8rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, var(--secondary-color), var(--warning-color)); color: var(--dark-bg);">
            <i class="fas fa-save"></i> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalEditarTipoProtecao() {
  const modal = document.getElementById('modal-editar-tipo-protecao');
  if (modal) {
    modal.remove();
  }
}

async function salvarEdicaoTipoProtecao() {
  const id = document.getElementById('editar-tipo-protecao-id').value;
  const nome = document.getElementById('editar-tipo-protecao-nome').value.trim();
  const categoria = document.getElementById('editar-tipo-protecao-categoria').value;
  
  if (!nome) {
    alert('Por favor, informe o nome do tipo de produto.');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('tipos_produtos_protecao')
      .update({ nome, categoria })
      .eq('id', id);
    
    if (error) throw error;
    
    // Atualizar lista local
    const index = tiposProdutosProtecao.findIndex(t => t.id === id);
    if (index !== -1) {
      tiposProdutosProtecao[index].nome = nome;
      tiposProdutosProtecao[index].categoria = categoria;
    }
    
    fecharModalEditarTipoProtecao();
    fecharModalTiposProtecao();
    abrirModalGerenciarTiposProtecao();
    renderProdutosProtecao();
    
    alert('Tipo de produto atualizado com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar tipo de produto:', error);
    alert('Erro ao atualizar tipo de produto: ' + error.message);
  }
}

async function excluirTipoProtecao(id) {
  if (!confirm('Tem certeza que deseja excluir este tipo de produto?')) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('tipos_produtos_protecao')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Remover da lista local
    tiposProdutosProtecao = tiposProdutosProtecao.filter(t => t.id !== id);
    
    fecharModalTiposProtecao();
    abrirModalGerenciarTiposProtecao();
    renderProdutosProtecao();
    
    alert('Tipo de produto excluído com sucesso!');
  } catch (error) {
    console.error('Erro ao excluir tipo de produto:', error);
    alert('Erro ao excluir tipo de produto: ' + error.message);
  }
}

// =========================================
// INTEGRAÇÃO COM O FORMULÁRIO PRINCIPAL
// =========================================

function getProdutosProtecaoData() {
  return produtosProtecao;
}

function setProdutosProtecaoData(data) {
  if (!data || !Array.isArray(data)) return;
  
  produtosProtecao = data;
  produtoProtecaoCounter = Math.max(...produtosProtecao.map(p => p.id || 0), 0);
  renderProdutosProtecao();
}

// =========================================
// FUNÇÕES PARA LISTA DE OBJETOS DO DIAGNÓSTICO
// =========================================

function coletarObjetosDoDiagnostico() {
  const objetos = [];
  
  // 1. Cliente (nome do formulário principal)
  const clienteNome = document.getElementById('cliente_nome');
  if (clienteNome && clienteNome.value) {
    objetos.push({ tipo: 'Pessoa', valor: clienteNome.value, categoria: 'Cliente' });
  }
  
  // 2. Cônjuge
  const conjugeNome = document.getElementById('conjuge_nome');
  if (conjugeNome && conjugeNome.value) {
    objetos.push({ tipo: 'Pessoa', valor: conjugeNome.value, categoria: 'Cônjuge' });
  }
  
  // 3. Pessoas com Renda (acessar via variável global ou DOM)
  const pessoasRendaContainer = document.getElementById('pessoas-renda-container');
  if (pessoasRendaContainer) {
    const pessoasCards = pessoasRendaContainer.querySelectorAll('.pessoa-card');
    pessoasCards.forEach(card => {
      const nomeInput = card.querySelector('input[id$="_nome"]');
      if (nomeInput && nomeInput.value) {
        objetos.push({ tipo: 'Pessoa', valor: nomeInput.value, categoria: 'Pessoa com Renda' });
      }
      // Cônjuge da pessoa com renda
      const conjugeInput = card.querySelector('input[id$="_conjuge_nome"]');
      if (conjugeInput && conjugeInput.value) {
        objetos.push({ tipo: 'Pessoa', valor: conjugeInput.value, categoria: 'Cônjuge (Pessoa com Renda)' });
      }
    });
  }
  
  // 4. Dependentes - buscar pelos cards com classe dependente-card
  const dependentesContainer = document.getElementById('dependentes-container');
  if (dependentesContainer) {
    const dependentesCards = dependentesContainer.querySelectorAll('.dependente-card');
    dependentesCards.forEach(card => {
      const nomeInput = card.querySelector('input[id$="_nome"]');
      if (nomeInput && nomeInput.value) {
        objetos.push({ tipo: 'Pessoa', valor: nomeInput.value, categoria: 'Dependente' });
      }
    });
  }
  
  // 5. Patrimônios Físicos - formato: [tipo] - [valor] - [detalhe se tiver]
  const patrimoniosContainer = document.getElementById('patrimonios-container');
  if (patrimoniosContainer) {
    const patrimoniosCards = patrimoniosContainer.querySelectorAll('.patrimonio-card');
    patrimoniosCards.forEach(card => {
      // O tipo é um input de texto, não um select
      const tipoInput = card.querySelector('input[id$="_tipo"]');
      const valorInput = card.querySelector('input[id$="_valor"]');
      const detalhesInput = card.querySelector('input[id$="_detalhes"]');
      
      const tipoPatrimonio = tipoInput ? tipoInput.value : '';
      const valorPatrimonio = valorInput ? valorInput.value : '';
      const detalhesPatrimonio = detalhesInput ? detalhesInput.value : '';
      
      if (tipoPatrimonio || valorPatrimonio) {
        let descricao = tipoPatrimonio || 'Patrimônio';
        if (valorPatrimonio) {
          descricao += ` - ${valorPatrimonio}`;
        }
        if (detalhesPatrimonio) {
          descricao += ` - ${detalhesPatrimonio}`;
        }
        objetos.push({ tipo: 'Patrimônio Físico', valor: descricao, categoria: tipoPatrimonio || 'Patrimônio' });
      }
    });
  }
  
  // 6. Patrimônios Líquidos (Investimentos) - formato: [valor] - [tipo] - [instituição]
  if (window.getPatrimoniosLiquidosData) {
    const patrimoniosLiquidos = window.getPatrimoniosLiquidosData();
    patrimoniosLiquidos.forEach(pl => {
      // Formatar valor
      const valorFormatado = pl.valor_atual ? `R$ ${parseFloat(pl.valor_atual).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
      // Usar os campos _nome que contêm os nomes legíveis
      const tipoProduto = pl.tipo_produto_nome || '';
      const instituicao = pl.instituicao_nome || '';
      
      if (valorFormatado || tipoProduto) {
        let descricao = valorFormatado || '';
        if (tipoProduto) {
          descricao += descricao ? ` - ${tipoProduto}` : tipoProduto;
        }
        if (instituicao) {
          descricao += ` - ${instituicao}`;
        }
        objetos.push({ tipo: 'Patrimônio Líquido', valor: descricao, categoria: tipoProduto || 'Investimento' });
      }
    });
  }
  
  return objetos;
}

function atualizarListaObjetosProtecao(index) {
  const produtoId = `produto_protecao_${index}`;
  const datalist = document.getElementById(`${produtoId}_objeto_list`);
  
  if (!datalist) return;
  
  const objetos = coletarObjetosDoDiagnostico();
  
  // Agrupar por tipo
  const objetosPorTipo = {};
  objetos.forEach(obj => {
    if (!objetosPorTipo[obj.tipo]) {
      objetosPorTipo[obj.tipo] = [];
    }
    objetosPorTipo[obj.tipo].push(obj);
  });
  
  // Construir opções do datalist
  let html = '';
  
  // Ordem de exibição
  const ordemTipos = ['Pessoa', 'Patrimônio Físico', 'Patrimônio Líquido'];
  
  ordemTipos.forEach(tipo => {
    if (objetosPorTipo[tipo] && objetosPorTipo[tipo].length > 0) {
      objetosPorTipo[tipo].forEach(obj => {
        html += `<option value="${obj.valor}" label="${obj.categoria}">${obj.valor}</option>`;
      });
    }
  });
  
  datalist.innerHTML = html;
}

// =========================================
// INICIALIZAÇÃO
// =========================================

async function initProdutosProtecao() {
  // Carregar tipos do Supabase
  await carregarTiposProdutosProtecao();
  
  const addBtn = document.getElementById('add-produto-protecao-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => addProdutoProtecao());
  }
  
  renderProdutosProtecao();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProdutosProtecao);
} else {
  initProdutosProtecao();
}

// Expor funções globalmente
window.addProdutoProtecao = addProdutoProtecao;
window.deleteProdutoProtecao = deleteProdutoProtecao;
window.updateProdutoProtecaoField = updateProdutoProtecaoField;
window.updateProdutoProtecaoCusto = updateProdutoProtecaoCusto;
window.getProdutosProtecaoData = getProdutosProtecaoData;
window.setProdutosProtecaoData = setProdutosProtecaoData;
window.criarProdutoProtecaoDePatrimonio = criarProdutoProtecaoDePatrimonio;
window.removerProdutoProtecaoDePatrimonio = removerProdutoProtecaoDePatrimonio;
window.abrirModalGerenciarTiposProtecao = abrirModalGerenciarTiposProtecao;
window.fecharModalTiposProtecao = fecharModalTiposProtecao;
window.abrirModalNovoTipoProtecao = abrirModalNovoTipoProtecao;
window.fecharModalNovoTipoProtecao = fecharModalNovoTipoProtecao;
window.salvarNovoTipoProtecao = salvarNovoTipoProtecao;
window.editarTipoProtecao = editarTipoProtecao;
window.fecharModalEditarTipoProtecao = fecharModalEditarTipoProtecao;
window.salvarEdicaoTipoProtecao = salvarEdicaoTipoProtecao;
window.excluirTipoProtecao = excluirTipoProtecao;
window.atualizarListaObjetosProtecao = atualizarListaObjetosProtecao;
