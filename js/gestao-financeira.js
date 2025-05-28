// gestao-financeira.js
import { supabase } from './supabase.js';

// Função para carregar dados do cliente
export async function loadClienteData(clienteId) {
  try {
    if (!clienteId) {
      console.error('ID do cliente não especificado');
      return null;
    }
    
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        *,
        dados_cadastrais(*)
      `)
      .eq('id', clienteId)
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Erro ao carregar dados do cliente:', error);
    return null;
  }
}

// Função para carregar variáveis de gestão financeira
export async function loadVariaveisGestaoFinanceira() {
  try {
    const { data, error } = await supabase
      .from('variaveis_gestao_financeira')
      .select('nome, valor_percentual');
    
    if (error) throw error;
    
    // Converter array para objeto para facilitar o acesso
    const variaveis = {};
    if (data && data.length > 0) {
      data.forEach(variavel => {
        variaveis[variavel.nome] = variavel.valor_percentual;
      });
    }
    
    return variaveis;
  } catch (error) {
    console.error('Erro ao carregar variáveis de gestão financeira:', error);
    return {};
  }
}

// Função para salvar variáveis de gestão financeira
export async function saveVariaveisGestaoFinanceira(despesasFixas, despesasVariaveis, investimentos) {
  try {
    // Validar se o total é 100%
    const total = despesasFixas + despesasVariaveis + investimentos;
    if (Math.abs(total - 100) > 0.01) {
      throw new Error('O total deve ser igual a 100%');
    }
    
    // Atualizar DESPESAS_FIXAS
    const { error: error1 } = await supabase
      .from('variaveis_gestao_financeira')
      .update({ valor_percentual: despesasFixas })
      .eq('nome', 'DESPESAS_FIXAS');
    
    if (error1) throw error1;
    
    // Atualizar DESPESAS_VARIAVEIS
    const { error: error2 } = await supabase
      .from('variaveis_gestao_financeira')
      .update({ valor_percentual: despesasVariaveis })
      .eq('nome', 'DESPESAS_VARIAVEIS');
    
    if (error2) throw error2;
    
    // Atualizar INVESTIMENTOS
    const { error: error3 } = await supabase
      .from('variaveis_gestao_financeira')
      .update({ valor_percentual: investimentos })
      .eq('nome', 'INVESTIMENTOS');
    
    if (error3) throw error3;
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar variáveis de gestão financeira:', error);
    throw error;
  }
}

// Função para carregar categorias financeiras
export async function loadCategoriasFinanceiras() {
  try {
    const { data, error } = await supabase
      .from('categorias_financeiras')
      .select('*');
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao carregar categorias financeiras:', error);
    return [];
  }
}

// Função para carregar subcategorias financeiras
export async function loadSubcategoriasFinanceiras(clienteId) {
  try {
    const { data, error } = await supabase
      .from('subcategorias_financeiras')
      .select('*')
      .or(`cliente_id.is.null,cliente_id.eq.${clienteId}`);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao carregar subcategorias financeiras:', error);
    return [];
  }
}

// Função para adicionar subcategoria
export async function addSubcategoria(categoriaId, nome, clienteId) {
  try {
    if (!nome || !categoriaId) {
      throw new Error('Nome e categoria são obrigatórios');
    }
    
    // Verificar se já existe uma subcategoria com o mesmo nome para esta categoria
    const { data: existingData, error: existingError } = await supabase
      .from('subcategorias_financeiras')
      .select('*')
      .eq('nome', nome)
      .eq('categoria_id', categoriaId)
      .or(`cliente_id.is.null,cliente_id.eq.${clienteId}`);
    
    if (existingError) throw existingError;
    
    if (existingData && existingData.length > 0) {
      throw new Error('Já existe uma subcategoria com este nome para esta categoria');
    }
    
    // Inserir nova subcategoria
    const { data, error } = await supabase
      .from('subcategorias_financeiras')
      .insert({
        categoria_id: categoriaId,
        nome: nome,
        cliente_id: clienteId
      });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Erro ao adicionar subcategoria:', error);
    throw error;
  }
}

// Função para remover subcategoria
export async function removeSubcategoria(subcategoriaId, clienteId) {
  try {
    if (!subcategoriaId) {
      throw new Error('ID da subcategoria é obrigatório');
    }
    
    // Remover subcategoria
    const { error } = await supabase
      .from('subcategorias_financeiras')
      .delete()
      .eq('id', subcategoriaId)
      .eq('cliente_id', clienteId);
    
    if (error) {
      // Se não conseguir remover (pode ser uma subcategoria global)
      throw new Error('Esta subcategoria não pode ser removida pois é uma subcategoria global ou está sendo usada por outros clientes');
    }
    
    // Atualizar itens que usavam esta subcategoria
    await supabase
      .from('itens_financeiros')
      .update({ subcategoria_id: null })
      .eq('subcategoria_id', subcategoriaId);
    
    return true;
  } catch (error) {
    console.error('Erro ao remover subcategoria:', error);
    throw error;
  }
}

// Função para carregar itens financeiros do cliente
export async function loadItensFinanceiros(clienteId) {
  try {
    if (!clienteId) {
      throw new Error('ID do cliente é obrigatório');
    }
    
    const { data, error } = await supabase
      .from('itens_financeiros')
      .select(`
        *,
        categorias_financeiras(*),
        subcategorias_financeiras(*)
      `)
      .eq('cliente_id', clienteId)
      .order('data_referencia', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao carregar itens financeiros:', error);
    return [];
  }
}

// Função para adicionar item financeiro
export async function addItemFinanceiro(clienteId, tipo, descricao, valor, dataReferencia, categoriaId, subcategoriaId, recorrente, frequencia) {
  try {
    if (!clienteId || !tipo || !descricao || !valor || !dataReferencia) {
      throw new Error('Campos obrigatórios não preenchidos');
    }
    
    const { data, error } = await supabase
      .from('itens_financeiros')
      .insert({
        cliente_id: clienteId,
        tipo: tipo,
        descricao: descricao,
        valor: valor,
        data_referencia: dataReferencia,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        recorrente: recorrente || false,
        frequencia: frequencia
      });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Erro ao adicionar item financeiro:', error);
    throw error;
  }
}

// Função para atualizar item financeiro
export async function updateItemFinanceiro(itemId, tipo, descricao, valor, dataReferencia, categoriaId, subcategoriaId, recorrente, frequencia) {
  try {
    if (!itemId) {
      throw new Error('ID do item é obrigatório');
    }
    
    const { data, error } = await supabase
      .from('itens_financeiros')
      .update({
        tipo: tipo,
        descricao: descricao,
        valor: valor,
        data_referencia: dataReferencia,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        recorrente: recorrente || false,
        frequencia: frequencia
      })
      .eq('id', itemId);
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Erro ao atualizar item financeiro:', error);
    throw error;
  }
}

// Função para remover item financeiro
export async function removeItemFinanceiro(itemId) {
  try {
    if (!itemId) {
      throw new Error('ID do item é obrigatório');
    }
    
    const { error } = await supabase
      .from('itens_financeiros')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Erro ao remover item financeiro:', error);
    throw error;
  }
}

// Função para formatar valor monetário
export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Função para formatar data
export function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}
