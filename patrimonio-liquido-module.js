// =========================================
// PATRIMÔNIO LÍQUIDO - Módulo JavaScript v3
// Com classificação de risco, gráficos e distribuição ideal
// =========================================

import { supabase } from './supabase.js';

// Arrays para armazenar os patrimônios líquidos
let patrimoniosLiquidos = [];
let patrimonioLiquidoCounter = 0;
let tiposProdutos = [];
let instituicoes = [];

// Dados do teste de suitability
let respostasSuitability = {}; // { 'Nome da Pessoa': { A1: 3, A2: 4, ... } }

// Mapeamento de classificação de risco (10 níveis conforme documento)
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

// Alocação ideal por perfil de investidor (baseado no documento 7 Perfis)
const ALOCACAO_IDEAL_POR_PERFIL = {
  1: { // Ultra-Conservador
    nome: 'Ultra-Conservador',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 100,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_SEM_GARANTIA': 0,
      'RISCO_MEDIO_SEM_GARANTIA': 0,
      'RISCO_ALTO_PROTECAO_MRP': 0,
      'RISCO_ALTO_SEM_GARANTIA': 0,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 0,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 0,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 0
    }
  },
  2: { // Conservador
    nome: 'Conservador',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 50,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 40,
      'RISCO_BAIXO_GARANTIA_FGC': 10,
      'RISCO_BAIXO_SEM_GARANTIA': 0,
      'RISCO_MEDIO_SEM_GARANTIA': 0,
      'RISCO_ALTO_PROTECAO_MRP': 0,
      'RISCO_ALTO_SEM_GARANTIA': 0,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 0,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 0,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 0
    }
  },
  3: { // Conservador-Moderado
    nome: 'Conservador-Moderado',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 35,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 25,
      'RISCO_BAIXO_GARANTIA_FGC': 10,
      'RISCO_BAIXO_SEM_GARANTIA': 10,
      'RISCO_MEDIO_SEM_GARANTIA': 10,
      'RISCO_ALTO_PROTECAO_MRP': 10,
      'RISCO_ALTO_SEM_GARANTIA': 0,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 0,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 0,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 0
    }
  },
  4: { // Moderado
    nome: 'Moderado',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 15,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 15,
      'RISCO_BAIXO_GARANTIA_FGC': 10,
      'RISCO_BAIXO_SEM_GARANTIA': 15,
      'RISCO_MEDIO_SEM_GARANTIA': 15,
      'RISCO_ALTO_PROTECAO_MRP': 20,
      'RISCO_ALTO_SEM_GARANTIA': 10,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 0,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 0,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 0
    }
  },
  5: { // Moderado-Arrojado
    nome: 'Moderado-Arrojado',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 10,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 5,
      'RISCO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_SEM_GARANTIA': 10,
      'RISCO_MEDIO_SEM_GARANTIA': 15,
      'RISCO_ALTO_PROTECAO_MRP': 30,
      'RISCO_ALTO_SEM_GARANTIA': 20,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 10,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 0,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 0
    }
  },
  6: { // Arrojado
    nome: 'Arrojado',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 5,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_SEM_GARANTIA': 5,
      'RISCO_MEDIO_SEM_GARANTIA': 10,
      'RISCO_ALTO_PROTECAO_MRP': 35,
      'RISCO_ALTO_SEM_GARANTIA': 25,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 15,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 5,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 0
    }
  },
  7: { // Ultra-Arrojado
    nome: 'Ultra-Arrojado',
    alocacao: {
      'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA': 5,
      'RISCO_MUITO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_GARANTIA_FGC': 0,
      'RISCO_BAIXO_SEM_GARANTIA': 0,
      'RISCO_MEDIO_SEM_GARANTIA': 5,
      'RISCO_ALTO_PROTECAO_MRP': 25,
      'RISCO_ALTO_SEM_GARANTIA': 20,
      'RISCO_MUITO_ALTO_PROTECAO_MRP': 25,
      'RISCO_MUITO_ALTO_SEM_GARANTIA': 15,
      'RISCO_ABSOLUTO_SEM_GARANTIA': 5
    }
  }
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
// MODAIS DE GERENCIAMENTO
// =========================================

function abrirModalGerenciarProdutos() {
  const modal = criarModal('Gerenciar Tipos de Produtos', renderListaProdutos());
  document.body.appendChild(modal);
}

function abrirModalGerenciarInstituicoes() {
  const modal = criarModal('Gerenciar Instituições Financeiras', renderListaInstituicoes());
  document.body.appendChild(modal);
}

function criarModal(titulo, conteudo) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) fecharModal(overlay); };
  
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-cog"></i> ${titulo}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        ${conteudo}
      </div>
    </div>
  `;
  
  return overlay;
}

function fecharModal(modal) {
  modal.remove();
}

function renderListaProdutos() {
  const produtosPorCategoria = {};
  tiposProdutos.forEach(produto => {
    if (!produtosPorCategoria[produto.categoria]) {
      produtosPorCategoria[produto.categoria] = [];
    }
    produtosPorCategoria[produto.categoria].push(produto);
  });
  
  let html = '<div class="item-list">';
  
  Object.keys(produtosPorCategoria).sort().forEach(categoria => {
    html += `<h4 style="color: var(--accent-color); margin: 1rem 0 0.5rem 0;">${categoria}</h4>`;
    produtosPorCategoria[categoria].forEach(produto => {
      const riscoInfo = getRiscoInfo(produto.classificacao_risco);
      html += `
        <div class="item-card">
          <div class="item-info">
            <div class="item-nome">${produto.nome}</div>
            <div class="item-detalhes">
              <span class="badge-risco" style="background-color: ${riscoInfo.cor}; color: white; padding: 0.2rem 0.6rem; border-radius: 10px; font-size: 0.7rem;">
                ${riscoInfo.label}
              </span>
            </div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="editarProduto('${produto.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon delete" onclick="excluirProduto('${produto.id}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
  });
  
  html += '</div>';
  html += `
    <button class="btn-modal btn-modal-primary" onclick="abrirModalNovoProduto()">
      <i class="fas fa-plus"></i> Adicionar Novo Produto
    </button>
  `;
  
  return html;
}

function renderListaInstituicoes() {
  const instituicoesPorTipo = {};
  instituicoes.forEach(inst => {
    if (!instituicoesPorTipo[inst.tipo]) {
      instituicoesPorTipo[inst.tipo] = [];
    }
    instituicoesPorTipo[inst.tipo].push(inst);
  });
  
  let html = '<div class="item-list">';
  
  Object.keys(instituicoesPorTipo).sort().forEach(tipo => {
    html += `<h4 style="color: var(--accent-color); margin: 1rem 0 0.5rem 0;">${tipo}</h4>`;
    instituicoesPorTipo[tipo].forEach(inst => {
      html += `
        <div class="item-card">
          <div class="item-info">
            <div class="item-nome">${inst.nome}</div>
            <div class="item-detalhes">${inst.tipo}</div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="editarInstituicao('${inst.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon delete" onclick="excluirInstituicao('${inst.id}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
  });
  
  html += '</div>';
  html += `
    <button class="btn-modal btn-modal-primary" onclick="abrirModalNovaInstituicao()">
      <i class="fas fa-plus"></i> Adicionar Nova Instituição
    </button>
  `;
  
  return html;
}

function abrirModalNovoProduto() {
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome do Produto *</label>
      <input type="text" id="novo-produto-nome" class="form-control" placeholder="Ex: CDB Prefixado">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Categoria *</label>
      <select id="novo-produto-categoria" class="form-control">
        <option value="">Selecione...</option>
        <option value="Renda Fixa">Renda Fixa</option>
        <option value="Renda Variável">Renda Variável</option>
        <option value="Fundos">Fundos</option>
        <option value="Previdência">Previdência</option>
        <option value="Alternativos">Alternativos</option>
      </select>
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Classificação de Risco *</label>
      <select id="novo-produto-risco" class="form-control">
        <option value="">Selecione...</option>
        ${Object.keys(CLASSIFICACAO_RISCO).map(key => {
          const info = CLASSIFICACAO_RISCO[key];
          return `<option value="${key}">${info.label}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarNovoProduto()">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `;
  
  const modal = criarModal('Novo Produto de Investimento', conteudo);
  document.body.appendChild(modal);
}

function abrirModalNovaInstituicao() {
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome da Instituição *</label>
      <input type="text" id="nova-instituicao-nome" class="form-control" placeholder="Ex: Banco XYZ">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Tipo *</label>
      <select id="nova-instituicao-tipo" class="form-control">
        <option value="">Selecione...</option>
        <option value="Banco">Banco</option>
        <option value="Banco Digital">Banco Digital</option>
        <option value="Banco Cooperativo">Banco Cooperativo</option>
        <option value="Corretora">Corretora</option>
        <option value="Gestora">Gestora</option>
        <option value="Previdência">Previdência</option>
        <option value="Governo">Governo</option>
        <option value="Bolsa">Bolsa</option>
        <option value="Outro">Outro</option>
      </select>
    </div>
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarNovaInstituicao()">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `;
  
  const modal = criarModal('Nova Instituição Financeira', conteudo);
  document.body.appendChild(modal);
}

async function salvarNovoProduto() {
  const nome = document.getElementById('novo-produto-nome').value.trim();
  const categoria = document.getElementById('novo-produto-categoria').value;
  const risco = document.getElementById('novo-produto-risco').value;
  
  if (!nome || !categoria || !risco) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }
  
  const resultado = await adicionarTipoProduto(nome, categoria, risco);
  if (resultado) {
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarProdutos();
    renderPatrimoniosLiquidos();
  }
}

async function salvarNovaInstituicao() {
  const nome = document.getElementById('nova-instituicao-nome').value.trim();
  const tipo = document.getElementById('nova-instituicao-tipo').value;
  
  if (!nome || !tipo) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }
  
  const resultado = await adicionarInstituicao(nome, tipo);
  if (resultado) {
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarInstituicoes();
    renderPatrimoniosLiquidos();
  }
}

async function editarProduto(id) {
  const produto = tiposProdutos.find(p => p.id === id);
  if (!produto) return;
  
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome do Produto *</label>
      <input type="text" id="edit-produto-nome" class="form-control" value="${produto.nome}">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Categoria *</label>
      <select id="edit-produto-categoria" class="form-control">
        <option value="Renda Fixa" ${produto.categoria === 'Renda Fixa' ? 'selected' : ''}>Renda Fixa</option>
        <option value="Renda Variável" ${produto.categoria === 'Renda Variável' ? 'selected' : ''}>Renda Variável</option>
        <option value="Fundos" ${produto.categoria === 'Fundos' ? 'selected' : ''}>Fundos</option>
        <option value="Previdência" ${produto.categoria === 'Previdência' ? 'selected' : ''}>Previdência</option>
        <option value="Alternativos" ${produto.categoria === 'Alternativos' ? 'selected' : ''}>Alternativos</option>
      </select>
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Classificação de Risco *</label>
      <select id="edit-produto-risco" class="form-control">
        ${Object.keys(CLASSIFICACAO_RISCO).map(key => {
          const info = CLASSIFICACAO_RISCO[key];
          return `<option value="${key}" ${produto.classificacao_risco === key ? 'selected' : ''}>${info.label}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarEdicaoProduto('${id}')">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
  `;
  
  const modal = criarModal('Editar Produto', conteudo);
  document.body.appendChild(modal);
}

async function salvarEdicaoProduto(id) {
  const nome = document.getElementById('edit-produto-nome').value.trim();
  const categoria = document.getElementById('edit-produto-categoria').value;
  const risco = document.getElementById('edit-produto-risco').value;
  
  if (!nome || !categoria || !risco) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('tipos_produtos_investimento')
      .update({ nome, categoria, classificacao_risco: risco })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarTiposProdutos();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarProdutos();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    alert('Erro ao atualizar produto: ' + error.message);
  }
}

async function editarInstituicao(id) {
  const inst = instituicoes.find(i => i.id === id);
  if (!inst) return;
  
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome da Instituição *</label>
      <input type="text" id="edit-instituicao-nome" class="form-control" value="${inst.nome}">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Tipo *</label>
      <select id="edit-instituicao-tipo" class="form-control">
        <option value="Banco" ${inst.tipo === 'Banco' ? 'selected' : ''}>Banco</option>
        <option value="Banco Digital" ${inst.tipo === 'Banco Digital' ? 'selected' : ''}>Banco Digital</option>
        <option value="Banco Cooperativo" ${inst.tipo === 'Banco Cooperativo' ? 'selected' : ''}>Banco Cooperativo</option>
        <option value="Corretora" ${inst.tipo === 'Corretora' ? 'selected' : ''}>Corretora</option>
        <option value="Gestora" ${inst.tipo === 'Gestora' ? 'selected' : ''}>Gestora</option>
        <option value="Previdência" ${inst.tipo === 'Previdência' ? 'selected' : ''}>Previdência</option>
        <option value="Governo" ${inst.tipo === 'Governo' ? 'selected' : ''}>Governo</option>
        <option value="Bolsa" ${inst.tipo === 'Bolsa' ? 'selected' : ''}>Bolsa</option>
        <option value="Outro" ${inst.tipo === 'Outro' ? 'selected' : ''}>Outro</option>
      </select>
    </div>
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarEdicaoInstituicao('${id}')">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
  `;
  
  const modal = criarModal('Editar Instituição', conteudo);
  document.body.appendChild(modal);
}

async function salvarEdicaoInstituicao(id) {
  const nome = document.getElementById('edit-instituicao-nome').value.trim();
  const tipo = document.getElementById('edit-instituicao-tipo').value;
  
  if (!nome || !tipo) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('instituicoes_financeiras')
      .update({ nome, tipo })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarInstituicoes();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarInstituicoes();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao atualizar instituição:', error);
    alert('Erro ao atualizar instituição: ' + error.message);
  }
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  
  try {
    const { error } = await supabase
      .from('tipos_produtos_investimento')
      .update({ ativo: false })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarTiposProdutos();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarProdutos();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    alert('Erro ao excluir produto: ' + error.message);
  }
}

async function excluirInstituicao(id) {
  if (!confirm('Tem certeza que deseja excluir esta instituição?')) return;
  
  try {
    const { error } = await supabase
      .from('instituicoes_financeiras')
      .update({ ativo: false })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarInstituicoes();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarInstituicoes();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao excluir instituição:', error);
    alert('Erro ao excluir instituição: ' + error.message);
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
    nome_produto_customizado: '',
    classificacao_risco: '',
    instituicao: null,
    instituicao_nome: '',
    finalidade: 'SEM_FINALIDADE',
    aporte_valor: 0,
    aporte_frequencia: 'NENHUM',
    donos: [],
    inventariavel: true
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
  renderTesteSuitability();
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
  } else if (field === 'inventariavel') {
    patrimonioLiquido.inventariavel = value === true || value === 'true';
    // Atualizar seção de sucessão se existir
    if (window.atualizarSecaoSucessao) window.atualizarSecaoSucessao();
  } else {
    patrimonioLiquido[field] = value;
  }
  
  updatePatrimonioLiquidoTotal();
  renderGraficos();
  renderTesteSuitability();
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
  
  // Outras pessoas com renda - buscar do DOM
  const pessoasContainer = document.getElementById('pessoas-renda-container');
  if (pessoasContainer) {
    const inputsNomePessoas = pessoasContainer.querySelectorAll('input[id$="_nome"]');
    inputsNomePessoas.forEach((input, index) => {
      const nome = input.value?.trim();
      if (nome) {
        pessoas.push({ id: `pessoa_${index}`, nome: nome });
      }
    });
    
    // Cônjuges das outras pessoas
    const inputsConjugePessoas = pessoasContainer.querySelectorAll('input[id$="_conjuge_nome"]');
    inputsConjugePessoas.forEach((input, index) => {
      const nome = input.value?.trim();
      if (nome) {
        pessoas.push({ id: `pessoa_conjuge_${index}`, nome: nome });
      }
    });
  }
  
  // Dependentes - buscar do DOM
  const dependentesContainer = document.getElementById('dependentes-container');
  if (dependentesContainer) {
    const inputsNomeDependentes = dependentesContainer.querySelectorAll('input[id$="_nome"]');
    inputsNomeDependentes.forEach((input, index) => {
      const nome = input.value?.trim();
      if (nome) {
        pessoas.push({ id: `dependente_${index}`, nome: nome });
      }
    });
  }
  
  // Remover duplicatas baseado no nome
  const pessoasUnicas = [];
  const nomesVistos = new Set();
  
  pessoas.forEach(pessoa => {
    if (!nomesVistos.has(pessoa.nome)) {
      nomesVistos.add(pessoa.nome);
      pessoasUnicas.push(pessoa);
    }
  });
  
  return pessoasUnicas;
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
  if (!classificacao || !CLASSIFICACAO_RISCO[classificacao]) {
    return { label: 'Não classificado', cor: '#999', ordem: 99 };
  }
  return CLASSIFICACAO_RISCO[classificacao];
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
    <div class="patrimonio-liquido-card" data-patrimonio-liquido-id="${pl.id}" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid var(--border-color);">
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
            <button type="button" class="btn-gerenciar" onclick="abrirModalGerenciarProdutos()">
              <i class="fas fa-cog"></i> Gerenciar
            </button>
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
            <i class="fas fa-tag"></i> Nome do Produto (opcional)
          </label>
          <input 
            type="text" 
            placeholder="Ex: CDB XYZ 2025, Tesouro Selic 2027, etc."
            value="${pl.nome_produto_customizado || ''}"
            onchange="updatePatrimonioLiquidoField(${pl.id}, 'nome_produto_customizado', this.value)"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-building"></i> Instituição *
            <button type="button" class="btn-gerenciar" onclick="abrirModalGerenciarInstituicoes()">
              <i class="fas fa-cog"></i> Gerenciar
            </button>
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
        
        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" 
                 id="pl_${pl.id}_inventariavel" 
                 ${pl.inventariavel !== false ? 'checked' : ''}
                 onchange="updatePatrimonioLiquidoField(${pl.id}, 'inventariavel', this.checked)"
                 style="width: 18px; height: 18px; cursor: pointer;">
          <label for="pl_${pl.id}_inventariavel" style="cursor: pointer; margin: 0;">
            <i class="fas fa-gavel"></i> Inventariável
          </label>
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
// TESTE DE SUITABILITY
// =========================================

const QUESTOES_SUITABILITY = [
  // SEÇÃO A: HORIZONTE TEMPORAL
  {
    id: 'A1',
    secao: 'A',
    texto: 'Qual é a sua idade atual e em quanto tempo você pretende parar de trabalhar?',
    alternativas: [
      { valor: 1, texto: 'Faltam 10 anos ou menos' },
      { valor: 2, texto: 'Faltam entre 10 e 15 anos' },
      { valor: 3, texto: 'Faltam entre 15 e 20 anos' },
      { valor: 4, texto: 'Faltam entre 20 e 30 anos' },
      { valor: 5, texto: 'Faltam mais de 30 anos' }
    ]
  },
  {
    id: 'A2',
    secao: 'A',
    texto: 'Por quanto tempo você conseguiria deixar a maior parte do patrimônio aplicado?',
    alternativas: [
      { valor: 1, texto: 'Menos de 1 ano' },
      { valor: 2, texto: 'Entre 1 e 3 anos' },
      { valor: 3, texto: 'Entre 3 e 10 anos' },
      { valor: 4, texto: 'Entre 10 e 20 anos' },
      { valor: 5, texto: 'Mais de 20 anos' }
    ]
  },
  {
    id: 'A3',
    secao: 'A',
    texto: 'Quanto tempo teria para esperar recuperação em cenário ruim?',
    alternativas: [
      { valor: 1, texto: 'Nenhum - precisaria resgatar' },
      { valor: 2, texto: 'Até 2 anos' },
      { valor: 3, texto: 'Entre 2 e 5 anos' },
      { valor: 4, texto: 'Entre 5 e 10 anos' },
      { valor: 5, texto: 'Mais de 10 anos' }
    ]
  },
  
  // SEÇÃO B: TOLERÂNCIA AO RISCO
  {
    id: 'B1',
    secao: 'B',
    texto: 'Como reagiria se investimentos perdessem 20% em um mês?',
    alternativas: [
      { valor: 1, texto: 'Resgataria tudo imediatamente' },
      { valor: 2, texto: 'Consideraria resgatar parte' },
      { valor: 3, texto: 'Aguardaria a recuperação' },
      { valor: 4, texto: 'Ficaria tranquilo' },
      { valor: 5, texto: 'Compraria mais com desconto' }
    ]
  },
  {
    id: 'B2',
    secao: 'B',
    texto: 'Qual sua atitude em relação a risco e retorno?',
    alternativas: [
      { valor: 1, texto: 'Não aceito risco algum' },
      { valor: 2, texto: 'Aceito risco mínimo' },
      { valor: 3, texto: 'Aceito risco moderado' },
      { valor: 4, texto: 'Aceito risco alto' },
      { valor: 5, texto: 'Aceito risco muito alto' }
    ]
  },
  {
    id: 'B3',
    secao: 'B',
    texto: 'Qual perda temporária conseguiria suportar?',
    alternativas: [
      { valor: 1, texto: 'Nenhuma perda' },
      { valor: 2, texto: 'Até 5%' },
      { valor: 3, texto: 'Até 10%' },
      { valor: 4, texto: 'Até 20%' },
      { valor: 5, texto: 'Mais de 20%' }
    ]
  },
  
  // SEÇÃO C: CONHECIMENTO
  {
    id: 'C1',
    secao: 'C',
    texto: 'Qual seu nível de conhecimento sobre investimentos?',
    alternativas: [
      { valor: 1, texto: 'Nenhum' },
      { valor: 2, texto: 'Básico' },
      { valor: 3, texto: 'Intermediário' },
      { valor: 4, texto: 'Avançado' },
      { valor: 5, texto: 'Especialista' }
    ]
  },
  {
    id: 'C2',
    secao: 'C',
    texto: 'Há quanto tempo investe no mercado financeiro?',
    alternativas: [
      { valor: 1, texto: 'Nunca investi' },
      { valor: 2, texto: 'Menos de 2 anos' },
      { valor: 3, texto: 'Entre 2 e 5 anos' },
      { valor: 4, texto: 'Entre 5 e 10 anos' },
      { valor: 5, texto: 'Mais de 10 anos' }
    ]
  },
  {
    id: 'C3',
    secao: 'C',
    texto: 'Já investiu em renda variável?',
    alternativas: [
      { valor: 1, texto: 'Não, nunca' },
      { valor: 2, texto: 'Não, mas tenho interesse' },
      { valor: 3, texto: 'Sim, valores pequenos' },
      { valor: 4, texto: 'Sim, regularmente' },
      { valor: 5, texto: 'Sim, significativamente' }
    ]
  }
];

const PERFIS_INVESTIDOR = [
  { id: 1, nome: 'Ultra-Conservador', pfpMin: 0, pfpMax: 16.67, cor: '#006400' },
  { id: 2, nome: 'Conservador', pfpMin: 16.68, pfpMax: 33.33, cor: '#228B22' },
  { id: 3, nome: 'Conservador-Moderado', pfpMin: 33.34, pfpMax: 50.00, cor: '#90EE90' },
  { id: 4, nome: 'Moderado', pfpMin: 50.01, pfpMax: 66.67, cor: '#FFD700' },
  { id: 5, nome: 'Moderado-Arrojado', pfpMin: 66.68, pfpMax: 83.33, cor: '#FFA500' },
  { id: 6, nome: 'Arrojado', pfpMin: 83.34, pfpMax: 91.67, cor: '#FF6347' },
  { id: 7, nome: 'Ultra-Arrojado', pfpMin: 91.68, pfpMax: 100, cor: '#DC143C' }
];

function calcularPerfilInvestidor(respostas) {
  if (!respostas) return null;
  
  const questoesObrigatorias = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
  for (const q of questoesObrigatorias) {
    if (!respostas[q] || respostas[q] === 0) {
      return null;
    }
  }
  
  const PA = respostas.A1 + respostas.A2 + respostas.A3;
  const PB = respostas.B1 + respostas.B2 + respostas.B3;
  const PC = respostas.C1 + respostas.C2 + respostas.C3;
  
  const PAN = ((PA - 3) / 12) * 100;
  const PBN = ((PB - 3) / 12) * 100;
  const PCN = ((PC - 3) / 12) * 100;
  
  let PFP = (PAN * 0.25) + (PBN * 0.50) + (PCN * 0.25);
  
  // Garantir que PFP esteja entre 0 e 100
  PFP = Math.max(0, Math.min(100, PFP));
  
  // Encontrar o perfil correspondente
  let perfil = PERFIS_INVESTIDOR.find(p => PFP >= p.pfpMin && PFP <= p.pfpMax);
  
  // Se não encontrou (caso de borda), usar o primeiro ou último perfil
  if (!perfil) {
    if (PFP <= 0) {
      perfil = PERFIS_INVESTIDOR[0]; // Ultra-Conservador
    } else {
      perfil = PERFIS_INVESTIDOR[PERFIS_INVESTIDOR.length - 1]; // Ultra-Arrojado
    }
  }
  
  // Regras de precedência (override)
  if (PA <= 4 && perfil.id > 2) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 2); // Conservador
  }
  if (PB <= 4 && perfil.id > 1) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 1); // Ultra-Conservador
  }
  if (PC <= 4 && perfil.id > 3) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 3); // Conservador-Moderado
  }
  if (PA <= 5 && PC <= 5 && perfil.id > 2) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 2); // Conservador
  }
  
  return { perfil, PFP: PFP.toFixed(2), PA, PB, PC };
}

function obterPessoasComInvestimentos() {
  const pessoas = new Set();
  
  patrimoniosLiquidos.forEach(pl => {
    if (pl.donos && Array.isArray(pl.donos)) {
      pl.donos.forEach(dono => pessoas.add(dono));
    }
  });
  
  return Array.from(pessoas).sort();
}

function renderTesteSuitability() {
  const container = document.getElementById('teste-suitability-container');
  if (!container) return;
  
  const pessoas = obterPessoasComInvestimentos();
  
  if (pessoas.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 2rem;">Adicione investimentos com proprietários para preencher o teste de suitability.</p>';
    return;
  }
  
  // Inicializar respostas para novas pessoas
  pessoas.forEach(pessoa => {
    if (!respostasSuitability[pessoa]) {
      respostasSuitability[pessoa] = {};
    }
  });
  
  let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; background: var(--dark-bg); border: 2px solid var(--border-color);">';
  
  // Cabeçalho
  html += '<thead><tr style="background: var(--primary-color);">';
  html += '<th style="padding: 1rem; text-align: left; color: var(--accent-color); border: 1px solid var(--border-color); min-width: 350px; font-size: 0.9rem;">PERGUNTA</th>';
  pessoas.forEach(pessoa => {
    html += `<th style="padding: 1rem; text-align: center; color: var(--accent-color); border: 1px solid var(--border-color); min-width: 200px; font-size: 0.9rem;">${pessoa.toUpperCase()}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  // Questões
  QUESTOES_SUITABILITY.forEach(questao => {
    html += `<tr style="border-bottom: 1px solid var(--border-color);">`;
    html += `<td style="padding: 0.8rem; color: var(--text-light); border: 1px solid var(--border-color); font-size: 0.85rem;"><strong style="color: var(--accent-color);">${questao.id}:</strong> ${questao.texto}</td>`;
    
    pessoas.forEach(pessoa => {
      const valorSelecionado = respostasSuitability[pessoa]?.[questao.id] || 0;
      html += `<td style="padding: 0.5rem; border: 1px solid var(--border-color);">`;
      html += `<select onchange="updateRespostaSuitability('${pessoa}', '${questao.id}', this.value)" style="width: 100%; padding: 0.5rem; background: var(--surface-bg); color: var(--text-light); border: 1px solid var(--border-color); border-radius: 5px; font-size: 0.85rem; cursor: pointer;">`;
      html += `<option value="0" ${valorSelecionado == 0 ? 'selected' : ''}>Selecione...</option>`;
      questao.alternativas.forEach(alt => {
        html += `<option value="${alt.valor}" ${valorSelecionado == alt.valor ? 'selected' : ''}>${alt.valor} - ${alt.texto}</option>`;
      });
      html += `</select></td>`;
    });
    
    html += '</tr>';
  });
  
  // Linha vazia
  html += '<tr style="height: 15px; background: var(--surface-bg);"><td colspan="' + (pessoas.length + 1) + '"></td></tr>';
  
  // Linha de resultado
  html += '<tr style="background: var(--primary-color); font-weight: bold;">';
  html += '<td style="padding: 1.2rem; color: var(--accent-color); border: 1px solid var(--border-color); font-size: 1rem;"><i class="fas fa-trophy"></i> PERFIL IDEAL</td>';
  
  pessoas.forEach(pessoa => {
    const resultado = calcularPerfilInvestidor(respostasSuitability[pessoa]);
    if (resultado && resultado.perfil) {
      html += `<td style="padding: 1.2rem; text-align: center; border: 1px solid var(--border-color); background-color: ${resultado.perfil.cor}; color: white;">`;
      html += `<div style="font-size: 1rem; font-weight: bold; margin-bottom: 0.3rem;">${resultado.perfil.nome}</div>`;
      html += `<div style="font-size: 0.75rem; opacity: 0.9;">PFP: ${resultado.PFP}%</div>`;
      html += `</td>`;
    } else {
      html += `<td style="padding: 1.2rem; text-align: center; color: var(--text-light); border: 1px solid var(--border-color); font-style: italic; font-size: 0.85rem;">Preencha todas as questões</td>`;
    }
  });
  
  html += '</tr></tbody></table></div>';
  
  container.innerHTML = html;
}

function updateRespostaSuitability(pessoa, questaoId, valor) {
  if (!respostasSuitability[pessoa]) {
    respostasSuitability[pessoa] = {};
  }
  respostasSuitability[pessoa][questaoId] = parseInt(valor);
  renderTesteSuitability();
  renderGraficos(); // Atualizar gráficos quando o perfil mudar
}

function getRespostasSuitabilityData() {
  return respostasSuitability;
}

function setRespostasSuitabilityData(data) {
  if (data && typeof data === 'object') {
    respostasSuitability = data;
    renderTesteSuitability();
  }
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
    
    const chaveProprietarios = pl.donos && pl.donos.length > 0 
      ? pl.donos.sort().join(' + ') 
      : 'Sem proprietário';
    
    if (!gruposPorProprietarios[chaveProprietarios]) {
      gruposPorProprietarios[chaveProprietarios] = {};
    }
    
    const riscoInfo = getRiscoInfo(pl.classificacao_risco);
    if (!riscoInfo || !riscoInfo.label) return;
    
    const riscoLabel = riscoInfo.label;
    
    if (!gruposPorProprietarios[chaveProprietarios][riscoLabel]) {
      gruposPorProprietarios[chaveProprietarios][riscoLabel] = {
        valor: 0,
        cor: riscoInfo.cor,
        ordem: riscoInfo.ordem,
        classificacao: pl.classificacao_risco
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
    const canvasIdAtual = `grafico-atual-${index}`;
    const canvasIdIdeal = `grafico-ideal-${index}`;
    
    // Calcular total
    const total = Object.values(dados).reduce((sum, val) => sum + val.valor, 0);
    
    // Obter perfil do investidor (se houver apenas um proprietário)
    const proprietariosSplit = proprietarios.split(' + ');
    let perfilInvestidor = null;
    let alocacaoIdeal = null;
    
    if (proprietariosSplit.length === 1 && proprietariosSplit[0] !== 'Sem proprietário') {
      const resultado = calcularPerfilInvestidor(respostasSuitability[proprietariosSplit[0]]);
      if (resultado && resultado.perfil) {
        perfilInvestidor = resultado.perfil;
        alocacaoIdeal = ALOCACAO_IDEAL_POR_PERFIL[perfilInvestidor.id];
      }
    }
    
    return `
      <div style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h4 style="color: var(--accent-color); margin-bottom: 0.5rem; text-align: center;">
          <i class="fas fa-user-circle"></i> ${proprietarios}
        </h4>
        <p style="color: var(--accent-color); margin-bottom: 1rem; text-align: center; font-size: 1.2rem; font-weight: bold;">
          Total: ${formatarMoeda(total)}
        </p>
        
        <div style="display: grid; grid-template-columns: ${alocacaoIdeal ? '1fr 1fr' : '1fr'}; gap: 2rem;">
          <div>
            <h5 style="color: var(--text-light); text-align: center; margin-bottom: 1rem;">
              <i class="fas fa-chart-pie"></i> Distribuição Atual
            </h5>
            <canvas id="${canvasIdAtual}" style="max-height: 300px;"></canvas>
          </div>
          
          ${alocacaoIdeal ? `
          <div>
            <h5 style="color: var(--text-light); text-align: center; margin-bottom: 1rem;">
              <i class="fas fa-star"></i> Distribuição Ideal (${perfilInvestidor.nome})
            </h5>
            <canvas id="${canvasIdIdeal}" style="max-height: 300px;"></canvas>
          </div>
          ` : ''}
        </div>
        
        ${!alocacaoIdeal && proprietariosSplit.length === 1 && proprietariosSplit[0] !== 'Sem proprietário' ? `
        <p style="text-align: center; color: var(--text-light); opacity: 0.7; margin-top: 1rem; font-size: 0.85rem;">
          <i class="fas fa-info-circle"></i> Preencha o teste de suitability para ver a distribuição ideal recomendada.
        </p>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Criar gráficos com Chart.js
  Object.keys(gruposPorProprietarios).forEach((proprietarios, index) => {
    const dados = gruposPorProprietarios[proprietarios];
    const canvasIdAtual = `grafico-atual-${index}`;
    const canvasIdIdeal = `grafico-ideal-${index}`;
    const ctxAtual = document.getElementById(canvasIdAtual);
    
    if (!ctxAtual) return;
    
    // Ordenar por ordem de risco
    const dadosOrdenados = Object.entries(dados).sort((a, b) => a[1].ordem - b[1].ordem);
    
    // Gráfico de distribuição atual
    new Chart(ctxAtual, {
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
              color: '#FFFFFF',
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'rectRounded',
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                  return data.labels.map((label, i) => {
                    const value = data.datasets[0].data[i];
                    const percentage = ((value / total) * 100).toFixed(1);
                    return {
                      text: `${label}: ${formatarMoeda(value)} (${percentage}%)`,
                      fillStyle: data.datasets[0].backgroundColor[i],
                      strokeStyle: '#ffffff',
                      lineWidth: 1,
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#FFD700',
            bodyColor: '#ffffff',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
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
    
    // Gráfico de distribuição ideal (se houver perfil)
    const proprietariosSplit = proprietarios.split(' + ');
    if (proprietariosSplit.length === 1 && proprietariosSplit[0] !== 'Sem proprietário') {
      const resultado = calcularPerfilInvestidor(respostasSuitability[proprietariosSplit[0]]);
      if (resultado && resultado.perfil) {
        const alocacaoIdeal = ALOCACAO_IDEAL_POR_PERFIL[resultado.perfil.id];
        const ctxIdeal = document.getElementById(canvasIdIdeal);
        
        if (ctxIdeal && alocacaoIdeal) {
          // Filtrar apenas alocações > 0
          const alocacoesNaoZero = Object.entries(alocacaoIdeal.alocacao)
            .filter(([, percentual]) => percentual > 0)
            .map(([classificacao, percentual]) => {
              const riscoInfo = CLASSIFICACAO_RISCO[classificacao];
              return {
                label: riscoInfo.label,
                percentual: percentual,
                cor: riscoInfo.cor,
                ordem: riscoInfo.ordem
              };
            })
            .sort((a, b) => a.ordem - b.ordem);
          
          new Chart(ctxIdeal, {
            type: 'pie',
            data: {
              labels: alocacoesNaoZero.map(a => a.label),
              datasets: [{
                data: alocacoesNaoZero.map(a => a.percentual),
                backgroundColor: alocacoesNaoZero.map(a => a.cor),
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
                    color: '#FFFFFF',
                    font: {
                      size: 12,
                      weight: 'bold'
                    },
                    padding: 15,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    generateLabels: function(chart) {
                      const data = chart.data;
                      if (data.labels.length && data.datasets.length) {
                        return data.labels.map((label, i) => {
                          const value = data.datasets[0].data[i];
                          return {
                            text: `${label}: ${value}%`,
                            fillStyle: data.datasets[0].backgroundColor[i],
                            strokeStyle: '#ffffff',
                            lineWidth: 1,
                            hidden: false,
                            index: i
                          };
                        });
                      }
                      return [];
                    }
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  titleColor: '#FFD700',
                  bodyColor: '#ffffff',
                  titleFont: { size: 14, weight: 'bold' },
                  bodyFont: { size: 13 },
                  padding: 12,
                  cornerRadius: 8,
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.parsed}%`;
                    }
                  }
                }
              }
            }
          });
        }
      }
    }
  });
}

// =========================================
// ATUALIZAÇÃO AUTOMÁTICA DE DONOS
// =========================================

function atualizarListaDonos() {
  renderPatrimoniosLiquidos();
}

// Observar mudanças nos campos de nomes
function setupObservadoresDonos() {
  const camposParaObservar = [
    'nome_diagnostico',
    'conjuge_nome'
  ];
  
  camposParaObservar.forEach(campoId => {
    const campo = document.getElementById(campoId);
    if (campo) {
      campo.addEventListener('blur', atualizarListaDonos);
      campo.addEventListener('input', atualizarListaDonos);
    }
  });
  
  // Observar mudanças em outras pessoas com renda e dependentes
  // Usar MutationObserver para detectar quando novos campos são adicionados
  const observarContainer = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const observer = new MutationObserver(() => {
      atualizarListaDonos();
    });
    
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false
    });
    
    // Também observar inputs existentes
    const inputs = container.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
      if (input.id && input.id.includes('nome')) {
        input.addEventListener('input', atualizarListaDonos);
        input.addEventListener('blur', atualizarListaDonos);
      }
    });
  };
  
  // Observar containers de pessoas e dependentes
  observarContainer('pessoas-renda-container');
  observarContainer('dependentes-container');
  
  // Forçar atualização inicial
  setTimeout(() => atualizarListaDonos(), 500);
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
  renderTesteSuitability();
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
  renderTesteSuitability();
  setupObservadoresDonos();
  
  // Observar adição/remoção de pessoas e dependentes
  window.addEventListener('pessoasRendaUpdated', atualizarListaDonos);
  window.addEventListener('dependentesUpdated', atualizarListaDonos);
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
window.renderPatrimoniosLiquidos = renderPatrimoniosLiquidos;
window.renderGraficos = renderGraficos;
window.renderTesteSuitability = renderTesteSuitability;
window.updateRespostaSuitability = updateRespostaSuitability;
window.getRespostasSuitabilityData = getRespostasSuitabilityData;
window.setRespostasSuitabilityData = setRespostasSuitabilityData;
window.abrirModalGerenciarProdutos = abrirModalGerenciarProdutos;
window.abrirModalGerenciarInstituicoes = abrirModalGerenciarInstituicoes;
window.abrirModalNovoProduto = abrirModalNovoProduto;
window.abrirModalNovaInstituicao = abrirModalNovaInstituicao;
window.salvarNovoProduto = salvarNovoProduto;
window.salvarNovaInstituicao = salvarNovaInstituicao;
window.editarProduto = editarProduto;
window.excluirProduto = excluirProduto;
window.editarInstituicao = editarInstituicao;
window.excluirInstituicao = excluirInstituicao;
window.salvarEdicaoProduto = salvarEdicaoProduto;
window.salvarEdicaoInstituicao = salvarEdicaoInstituicao;
