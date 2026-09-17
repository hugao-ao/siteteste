// ========================================
// MÓDULO DE FLUXO DE CAIXA
// ========================================

import { supabase } from './supabase.js';

// Dados do fluxo de caixa
let receitas = [];
let despesas = [];
let receitaCounter = 0;
let despesaCounter = 0;
// fluxoFinalizado removido - análises sempre visíveis abaixo da edição

// Variáveis de gestão financeira (carregadas do Supabase)
let variaveisGestao = {
  despesas_fixas: 50,
  despesas_variaveis: 30,
  investimentos: 20
};

// Tipos de receita
const TIPOS_RECEITA = [
  { id: 'clt', nome: 'CLT' },
  { id: 'concurso', nome: 'Concurso Público' },
  { id: 'autonomo', nome: 'Autônomo' },
  { id: 'empresario', nome: 'Empresário/Pró-labore' },
  { id: 'aluguel', nome: 'Aluguel' },
  { id: 'dividendos', nome: 'Dividendos' },
  { id: 'aposentadoria', nome: 'Aposentadoria' },
  { id: 'pensao', nome: 'Pensão' },
  { id: 'freelancer', nome: 'Freelancer' },
  { id: 'comissao', nome: 'Comissão' },
  { id: 'bonus', nome: 'Bônus' },
  { id: 'outro', nome: 'Outro' }
];

// Tipos de despesa
const TIPOS_DESPESA = [
  { id: 'fixa', nome: 'Fixa' },
  { id: 'variavel', nome: 'Variável' }
];

// Unidades de recorrência
const UNIDADES_RECORRENCIA = [
  { id: 'dia', nome: 'Dia(s)' },
  { id: 'semana', nome: 'Semana(s)' },
  { id: 'mes', nome: 'Mês(es)' },
  { id: 'ano', nome: 'Ano(s)' }
];

// ========================================
// CLASSIFICAÇÃO DAS DESPESAS (Perfil Financeiro v2)
// Mesmo modelo do fluxo.html: valores gravados como STRING.
// A opção vazia ("Selecione...") é renderizada no template, não faz parte das listas.
// ========================================

// Importância: 1 = mais importante ... 7 = inaceitável
const NIVEIS_IMPORTANCIA = [
  { id: '1', nome: '★ Mais importante' },
  { id: '2', nome: 'Muito importante' },
  { id: '3', nome: 'Importante' },
  { id: '4', nome: 'Preferível ter' },
  { id: '5', nome: 'Indiferente' },
  { id: '6', nome: 'Preferível não ter' },
  { id: '7', nome: 'Inaceitável' }
];

// Nível de conforto: 1 = muito abaixo do básico ... 5 = muito acima do básico
const NIVEIS_CONFORTO = [
  { id: '1', nome: 'Muito abaixo do básico' },
  { id: '2', nome: 'Menos que básico' },
  { id: '3', nome: 'Apenas básico' },
  { id: '4', nome: 'Mais que básico' },
  { id: '5', nome: 'Muito acima do básico' }
];

// A despesa pode ser alterada?
const OPCOES_ALTERAVEL = [
  { id: 'sim', nome: 'Sim' },
  { id: 'nao', nome: 'Não' }
];

// Disposição do cliente em mexer na despesa (mesma chave `disposto` do fluxo.html)
const OPCOES_DISPOSTO = [
  { id: 'alteraria', nome: 'Alteraria' },
  { id: 'cancelaria', nome: 'Cancelaria' },
  { id: 'nao', nome: 'Não quer/pode mexer' }
];

// Exposto para reuso por outros scripts (motor do Perfil Financeiro, validador)
window.FLUXO_CLASSIFICACAO = { NIVEIS_IMPORTANCIA, NIVEIS_CONFORTO, OPCOES_ALTERAVEL, OPCOES_DISPOSTO };

// ========================================
// CARREGAR VARIÁVEIS DE GESTÃO FINANCEIRA
// ========================================

async function carregarVariaveisGestao() {
  try {
    const { data, error } = await supabase
      .from('variaveis_gestao_financeira')
      .select('*')
      .single();
    
    if (error) {
      console.log('Usando valores padrão para variáveis de gestão:', error.message);
      return;
    }
    
    if (data) {
      variaveisGestao = {
        despesas_fixas: parseFloat(data.despesas_fixas) || 50,
        despesas_variaveis: parseFloat(data.despesas_variaveis) || 30,
        investimentos: parseFloat(data.investimentos) || 20
      };
      console.log('Variáveis de gestão carregadas:', variaveisGestao);
    }
  } catch (error) {
    console.error('Erro ao carregar variáveis de gestão:', error);
  }
}

// Inicialização do módulo
async function initFluxoCaixaModule() {
  console.log('Módulo de Fluxo de Caixa carregado');
  
  // Carregar variáveis de gestão financeira
  await carregarVariaveisGestao();
  
  // Expor funções globalmente
  window.addReceita = addReceita;
  window.deleteReceita = deleteReceita;
  window.updateReceitaField = updateReceitaField;
  window.addDespesa = addDespesa;
  window.deleteDespesa = deleteDespesa;
  window.updateDespesaField = updateDespesaField;
  window.getFluxoCaixaData = getFluxoCaixaData;
  window.setFluxoCaixaData = setFluxoCaixaData;
  window.renderFluxoCaixa = renderFluxoCaixa;
  window.sincronizarDespesasAutomaticas = sincronizarDespesasAutomaticas;

  
  // Renderizar a seção
  setTimeout(() => {
    renderFluxoCaixa();
  }, 800);
}

// Função para formatar moeda
function formatarMoedaFluxo(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return 'R$ 0,00';
  return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Escapa aspas duplas para uso em atributos HTML (title="...")
function escAttrFluxo(valor) {
  return String(valor ?? '').replace(/"/g, '&quot;');
}

// Função para parsear valor monetário
function parseMoedaFluxo(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  const limpo = valor.toString().replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

// Função para obter pessoas disponíveis
function getPessoasParaFluxo() {
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

// Função para obter contas e cartões disponíveis
function getContasCartoesParaFluxo() {
  if (window.getContasCartoesData) {
    const data = window.getContasCartoesData();
    const items = data.contasCartoes || data || [];
    return items.map(item => ({
      id: item.id,
      nome: `${item.tipo === 'cartao' ? 'Cartão' : 'Conta'} ${item.instituicao || '#' + item.id}`,
      titular: item.titular,
      tipo: item.tipo
    }));
  }
  return [];
}

// Função para identificar o titular baseado no objeto do produto
function identificarTitularPorObjeto(objetoNome, pessoas) {
  if (!objetoNome) return ['titular'];
  
  // 1. Verificar se é um integrante direto (cliente, cônjuge, pessoa com renda)
  const pessoaEncontrada = pessoas.find(p => p.nome === objetoNome);
  if (pessoaEncontrada) {
    return [pessoaEncontrada.id];
  }
  
  // 2. Verificar se é um dependente - buscar de quem é o dependente
  if (window.dependentes && Array.isArray(window.dependentes)) {
    const dependente = window.dependentes.find(d => d.nome === objetoNome);
    if (dependente && dependente.responsavel) {
      return [dependente.responsavel];
    }
  }
  
  // Também verificar no DOM
  const dependentesContainer = document.getElementById('dependentes-container');
  if (dependentesContainer) {
    const dependentesCards = dependentesContainer.querySelectorAll('.dependente-card');
    for (const card of dependentesCards) {
      const nomeInput = card.querySelector('input[id$="_nome"]');
      const responsavelSelect = card.querySelector('select[id$="_responsavel"]');
      
      if (nomeInput && nomeInput.value === objetoNome && responsavelSelect && responsavelSelect.value) {
        return [responsavelSelect.value];
      }
    }
  }
  
  // 3. Verificar se é um patrimônio físico - buscar os proprietários
  if (window.patrimonios && Array.isArray(window.patrimonios)) {
    for (const patrimonio of window.patrimonios) {
      const patrimonioDesc = `${patrimonio.tipo || ''} - ${patrimonio.valor || ''} - ${patrimonio.detalhes || ''}`.trim();
      if (objetoNome.includes(patrimonio.tipo) || objetoNome.includes(patrimonio.detalhes) || objetoNome === patrimonioDesc) {
        const proprietarios = patrimonio.proprietarios || [];
        if (proprietarios.length > 0) {
          return proprietarios.map(propNome => {
            const pessoa = pessoas.find(p => p.nome === propNome);
            return pessoa ? pessoa.id : 'titular';
          });
        }
      }
    }
  }
  
  // 4. Verificar se é um patrimônio líquido - buscar os donos
  if (window.getPatrimoniosLiquidosData) {
    const patrimoniosLiquidos = window.getPatrimoniosLiquidosData() || [];
    for (const pl of patrimoniosLiquidos) {
      const plDesc = `${pl.valor || ''} - ${pl.tipo_produto || ''} - ${pl.instituicao || ''}`.trim();
      if (objetoNome.includes(pl.tipo_produto) || objetoNome.includes(pl.instituicao) || objetoNome === plDesc) {
        const donos = pl.donos || [];
        if (donos.length > 0) {
          return donos.map(donoNome => {
            const pessoa = pessoas.find(p => p.nome === donoNome);
            return pessoa ? pessoa.id : 'titular';
          });
        }
      }
    }
  }
  
  return ['titular'];
}

// ========================================
// RECEITAS
// ========================================

function addReceita() {
  const id = ++receitaCounter;
  
  const novaReceita = {
    id: id,
    nome: '',
    valor: 0,
    tipo: 'clt',
    qtd_recorrencia: 1,
    und_recorrencia: 'mes',
    titular: 'titular',
    automatica: false
  };
  
  receitas.push(novaReceita);
  renderFluxoCaixa();
}

function deleteReceita(id) {
  if (!confirm('Tem certeza que deseja excluir esta receita?')) return;
  
  receitas = receitas.filter(r => r.id !== id);
  renderFluxoCaixa();
}

function updateReceitaField(id, field, valor) {
  const receita = receitas.find(r => r.id === id);
  if (!receita) return;
  
  if (field === 'valor') {
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    receita[field] = parseFloat(valorNumerico) || 0;
    
    const input = document.getElementById(`receita_${id}_valor`);
    if (input) {
      input.value = formatarMoedaFluxo(valorNumerico);
    }
  } else if (field === 'qtd_recorrencia') {
    receita[field] = parseInt(valor) || 1;
  } else {
    receita[field] = valor;
  }
  renderAnalisesFluxo();
  // Atualizar análises de objetivos (dependem do fluxo de caixa)
  if (window.renderAnalisesObjetivosInline) window.renderAnalisesObjetivosInline();
}

// ========================================
// DESPESAS
// ========================================

function addDespesa() {
  const id = ++despesaCounter;
  
  const novaDespesa = {
    id: id,
    nome: '',
    valor: 0,
    tipo: 'fixa',
    qtd_recorrencia: 1,
    und_recorrencia: 'mes',
    forma_pagamento: '',
    titular: 'titular',
    categoria_comportamental: '',
    // v2 (Perfil Financeiro): classificação da despesa, valores STRING
    nivel_importancia: '',
    nivel_conforto: '',
    alteravel: '',
    disposto: '',
    automatica: false,
    origem: null
  };
  
  despesas.push(novaDespesa);
  renderFluxoCaixa();
}

function deleteDespesa(id) {
  if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
  
  despesas = despesas.filter(d => d.id !== id);
  renderFluxoCaixa();
}

function updateDespesaField(id, field, valor) {
  const despesa = despesas.find(d => d.id === id);
  if (!despesa) return;
  
  if (field === 'valor') {
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    despesa[field] = parseFloat(valorNumerico) || 0;
    
    const input = document.getElementById(`despesa_${id}_valor`);
    if (input) {
      input.value = formatarMoedaFluxo(valorNumerico);
    }
  } else if (field === 'qtd_recorrencia') {
    despesa[field] = parseInt(valor) || 1;
  } else if (field === 'forma_pagamento') {
    despesa[field] = valor;
    const contasCartoes = getContasCartoesParaFluxo();
    const contaCartao = contasCartoes.find(cc => cc.id == valor);
    if (contaCartao) {
      despesa.titular = contaCartao.titular;
    }
    renderFluxoCaixa();
    return; // renderFluxoCaixa já chama renderAnalisesFluxo
  } else {
    despesa[field] = valor;
  }
  renderAnalisesFluxo();
  // Atualizar análises de objetivos (dependem do fluxo de caixa)
  if (window.renderAnalisesObjetivosInline) window.renderAnalisesObjetivosInline();
}

// ========================================
// SINCRONIZAÇÃO AUTOMÁTICA DE DESPESAS
// ========================================

function sincronizarDespesasAutomaticas() {
  // Remover despesas automáticas antigas
  despesas = despesas.filter(d => !d.automatica);
  
  const pessoas = getPessoasParaFluxo();
  
  // 1. Produtos & Proteção
  if (window.getProdutosProtecaoData) {
    const produtos = window.getProdutosProtecaoData() || [];
    produtos.forEach(produto => {
      const custo = parseFloat(produto.custo) || 0;
      if (custo > 0) {
        const titulares = identificarTitularPorObjeto(produto.objeto, pessoas);
        const valorPorTitular = custo / titulares.length;
        
        const periodicidade = produto.periodicidade || 'anual';
        const qtdRecorrencia = 1;
        const undRecorrencia = periodicidade === 'mensal' ? 'mes' : 'ano';
        
        titulares.forEach(titularId => {
          const id = ++despesaCounter;
          
          despesas.push({
            id: id,
            nome: `${produto.tipo_produto || 'Produto'} - ${produto.seguradora || produto.objeto || 'Proteção'}`,
            valor: valorPorTitular,
            tipo: 'fixa',
            qtd_recorrencia: qtdRecorrencia,
            und_recorrencia: undRecorrencia,
            forma_pagamento: '',
            titular: titularId,
            automatica: true,
            origem: 'produto_protecao',
            origem_id: produto.id
          });
        });
      }
    });
  }
  
  // 2. Dívidas (parcelas mensais)
  if (window.getDividasData) {
    const dividas = window.getDividasData() || [];
    dividas.forEach(divida => {
      const valorParcela = parseFloat(divida.valor_parcela) || 0;
      const parcelasPagas = parseInt(divida.parcelas_pagas) || 0;
      const prazo = parseInt(divida.prazo) || 0;
      
      if (valorParcela > 0 && parcelasPagas < prazo) {
        const responsaveis = divida.responsaveis || [];
        const titulares = responsaveis.length > 0 ? responsaveis : ['titular'];
        const valorPorTitular = valorParcela / titulares.length;
        
        titulares.forEach(titularId => {
          const id = ++despesaCounter;
          
          despesas.push({
            id: id,
            nome: `Dívida: ${divida.motivo || 'Parcela'} - ${divida.credor || 'Credor'}`,
            valor: valorPorTitular,
            tipo: 'fixa',
            qtd_recorrencia: 1,
            und_recorrencia: 'mes',
            forma_pagamento: '',
            titular: titularId,
            automatica: true,
            origem: 'divida',
            origem_id: divida.id
          });
        });
      }
    });
  }
  
  // 3. Tarifas/Anuidades de Contas & Cartões (mensal)
  if (window.getContasCartoesData) {
    const data = window.getContasCartoesData();
    const items = data.contasCartoes || data || [];
    items.forEach(item => {
      const tarifa = parseFloat(item.tarifa_anuidade) || 0;
      if (tarifa > 0) {
        const id = ++despesaCounter;
        
        despesas.push({
          id: id,
          nome: `${item.tipo === 'cartao' ? 'Anuidade' : 'Tarifa'}: ${item.instituicao || 'Instituição'}`,
          valor: tarifa,
          tipo: 'fixa',
          qtd_recorrencia: 1,
          und_recorrencia: 'mes',
          forma_pagamento: item.id,
          titular: item.titular || 'titular',
          automatica: true,
          origem: 'conta_cartao',
          origem_id: item.id
        });
      }
    });
  }
  
  // 4. Imposto de Renda (resultado anual)
  // Remover receitas e despesas automáticas de IR antigas
  receitas = receitas.filter(r => r.origem !== 'ir_restituicao');
  despesas = despesas.filter(d => d.origem !== 'ir_pagamento');
  
  if (window.getDeclaracoesIRData) {
    const declaracoes = window.getDeclaracoesIRData() || [];
    declaracoes.forEach(declaracao => {
      const resultadoTipo = declaracao.resultado_tipo || '';
      const resultadoValor = parseFloat(declaracao.resultado_valor) || 0;
      
      // Mapear pessoa_key do IR para titular do fluxo de caixa
      // IR usa: 'cliente', 'conjuge_cliente', 'pessoa_0', 'conjuge_pessoa_0'
      // Fluxo usa: 'titular', 'conjuge', 'pessoa_0', 'pessoa_0_conjuge'
      let pessoaId = 'titular';
      const pessoaKey = declaracao.pessoa_key || '';
      if (pessoaKey === 'cliente') {
        pessoaId = 'titular';
      } else if (pessoaKey === 'conjuge_cliente') {
        pessoaId = 'conjuge';
      } else if (pessoaKey.startsWith('conjuge_pessoa_')) {
        // conjuge_pessoa_0 -> pessoa_0_conjuge
        const idx = pessoaKey.replace('conjuge_pessoa_', '');
        pessoaId = `pessoa_${idx}_conjuge`;
      } else if (pessoaKey.startsWith('pessoa_')) {
        pessoaId = pessoaKey;
      }
      
      if (resultadoValor > 0 && resultadoTipo) {
        if (resultadoTipo === 'restitui') {
          // Restituição = RECEITA anual
          const id = ++receitaCounter;
          receitas.push({
            id: id,
            nome: `Restituição IR - ${declaracao.pessoa_nome || 'Declarante'}`,
            valor: resultadoValor,
            tipo: 'restituicao',
            qtd_recorrencia: 1,
            und_recorrencia: 'ano',
            titular: pessoaId,
            automatica: true,
            origem: 'ir_restituicao',
            origem_id: pessoaKey
          });
        } else if (resultadoTipo === 'paga') {
          // Imposto a pagar = DESPESA FIXA anual
          const id = ++despesaCounter;
          despesas.push({
            id: id,
            nome: `Imposto de Renda - ${declaracao.pessoa_nome || 'Declarante'}`,
            valor: resultadoValor,
            tipo: 'fixa',
            qtd_recorrencia: 1,
            und_recorrencia: 'ano',
            forma_pagamento: '',
            titular: pessoaId,
            automatica: true,
            origem: 'ir_pagamento',
            origem_id: pessoaKey
          });
        }
      }
    });
  }
  
  renderFluxoCaixa();
}

// ========================================
// CÁLCULOS DO FLUXO DE CAIXA
// ========================================

/**
 * Calcula o valor MENSAL de um item
 * - Diário: valor × (30 / qtd_recorrencia)
 * - Semanal: valor × (4 / qtd_recorrencia)
 * - Mensal: valor / qtd_recorrencia
 * - Anual: NÃO ENTRA no cálculo mensal
 */
function calcularValorMensal(valor, qtdRecorrencia, undRecorrencia) {
  const v = parseFloat(valor) || 0;
  const qtd = parseInt(qtdRecorrencia) || 1;
  
  switch (undRecorrencia) {
    case 'dia':
      return v * (30 / qtd);
    case 'semana':
      return v * (4 / qtd);
    case 'mes':
      return v / qtd;
    case 'ano':
      return 0; // Anuais NÃO entram no mensal
    default:
      return v;
  }
}

/**
 * Calcula o valor ANUAL de um item
 * - Diário: valor × (365 / qtd_recorrencia)
 * - Semanal: valor × (52 / qtd_recorrencia)
 * - Mensal: valor × (12 / qtd_recorrencia)
 * - Anual: valor / qtd_recorrencia
 */
function calcularValorAnual(valor, qtdRecorrencia, undRecorrencia) {
  const v = parseFloat(valor) || 0;
  const qtd = parseInt(qtdRecorrencia) || 1;
  
  switch (undRecorrencia) {
    case 'dia':
      return v * (365 / qtd);
    case 'semana':
      return v * (52 / qtd);
    case 'mes':
      return v * (12 / qtd);
    case 'ano':
      return v / qtd;
    default:
      return v;
  }
}

/**
 * Calcula investimentos por pessoa baseado nos aportes do patrimônio líquido
 * Campos do patrimônio líquido: aporte_valor, aporte_frequencia (NENHUM, MENSAL, ANUAL), donos
 */
function calcularInvestimentosPorPessoa(pessoas) {
  const investimentos = {};
  
  // Inicializar
  pessoas.forEach(pessoa => {
    investimentos[pessoa.id] = { mes: 0, ano: 0 };
  });
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    
    patrimonios.forEach(pl => {
      const aporteValor = parseFloat(pl.aporte_valor) || 0;
      const aporteFrequencia = pl.aporte_frequencia || 'NENHUM';
      const donos = pl.donos || [];
      
      if (aporteValor > 0 && aporteFrequencia !== 'NENHUM' && donos.length > 0) {
        // Dividir igualmente entre os donos
        const aporteValorPorDono = aporteValor / donos.length;
        
        donos.forEach(donoNome => {
          // Encontrar o ID da pessoa pelo nome
          const pessoa = pessoas.find(p => p.nome === donoNome);
          if (pessoa && investimentos[pessoa.id]) {
            if (aporteFrequencia === 'MENSAL') {
              // Aporte mensal: entra no cálculo mensal
              investimentos[pessoa.id].mes += aporteValorPorDono;
              // Anual: aporte mensal × 12
              investimentos[pessoa.id].ano += aporteValorPorDono * 12;
            } else if (aporteFrequencia === 'ANUAL') {
              // Aporte anual: NÃO entra no cálculo mensal
              // Anual: apenas o aporte anual
              investimentos[pessoa.id].ano += aporteValorPorDono;
            }
          }
        });
      }
    });
  }
  
  // Adicionar restituições de IR como investimentos anuais
  if (window.getDeclaracoesIRData) {
    const declaracoes = window.getDeclaracoesIRData() || [];
    declaracoes.forEach(declaracao => {
      const resultadoTipo = declaracao.resultado_tipo || '';
      const resultadoValor = parseFloat(declaracao.resultado_valor) || 0;
      
      if (resultadoTipo === 'restitui' && resultadoValor > 0) {
        // Mapear pessoa_key para o ID usado no fluxo
        let titularId = 'titular';
        const pessoaKey = declaracao.pessoa_key || '';
        
        if (pessoaKey === 'cliente') {
          titularId = 'titular';
        } else if (pessoaKey === 'conjuge_cliente') {
          titularId = 'conjuge';
        } else if (pessoaKey.startsWith('conjuge_pessoa_')) {
          const idx = pessoaKey.replace('conjuge_pessoa_', '');
          titularId = `pessoa_${idx}_conjuge`;
        } else if (pessoaKey.startsWith('pessoa_')) {
          titularId = pessoaKey;
        }
        
        if (investimentos[titularId]) {
          // Restituição é anual, não entra no mensal
          investimentos[titularId].ano += resultadoValor;
        }
      }
    });
  }
  
  return investimentos;
}

function calcularFluxoPorPessoa() {
  const pessoas = getPessoasParaFluxo();
  const investimentosPorPessoa = calcularInvestimentosPorPessoa(pessoas);
  const resultado = {};
  
  // Inicializar resultado para cada pessoa
  pessoas.forEach(pessoa => {
    resultado[pessoa.id] = {
      nome: pessoa.nome,
      tipo: pessoa.tipo,
      receitas: { mes: 0, ano: 0 },
      despesas_fixas: { mes: 0, ano: 0 },
      despesas_variaveis: { mes: 0, ano: 0 },
      investimentos: investimentosPorPessoa[pessoa.id] || { mes: 0, ano: 0 },
      saldo: { mes: 0, ano: 0 }
    };
  });
  
  // Calcular receitas por pessoa
  receitas.forEach(receita => {
    const pessoaId = receita.titular;
    if (resultado[pessoaId]) {
      resultado[pessoaId].receitas.mes += calcularValorMensal(
        receita.valor, receita.qtd_recorrencia, receita.und_recorrencia
      );
      resultado[pessoaId].receitas.ano += calcularValorAnual(
        receita.valor, receita.qtd_recorrencia, receita.und_recorrencia
      );
    }
  });
  
  // Calcular despesas por pessoa
  despesas.forEach(despesa => {
    const pessoaId = despesa.titular || 'titular';
    const targetId = resultado[pessoaId] ? pessoaId : 'titular';
    if (resultado[targetId]) {
      const tipoDespesa = despesa.tipo === 'fixa' ? 'despesas_fixas' : 'despesas_variaveis';
      resultado[targetId][tipoDespesa].mes += calcularValorMensal(
        despesa.valor, despesa.qtd_recorrencia, despesa.und_recorrencia
      );
      resultado[targetId][tipoDespesa].ano += calcularValorAnual(
        despesa.valor, despesa.qtd_recorrencia, despesa.und_recorrencia
      );
    }
  });
  
  // Calcular saldo por pessoa
  Object.keys(resultado).forEach(pessoaId => {
    ['mes', 'ano'].forEach(periodo => {
      resultado[pessoaId].saldo[periodo] = 
        resultado[pessoaId].receitas[periodo] - 
        resultado[pessoaId].despesas_fixas[periodo] - 
        resultado[pessoaId].despesas_variaveis[periodo] - 
        resultado[pessoaId].investimentos[periodo];
    });
  });
  
  return resultado;
}

function calcularFluxoGeral() {
  const fluxoPorPessoa = calcularFluxoPorPessoa();
  
  const geral = {
    receitas: { mes: 0, ano: 0 },
    despesas_fixas: { mes: 0, ano: 0 },
    despesas_variaveis: { mes: 0, ano: 0 },
    investimentos: { mes: 0, ano: 0 },
    saldo: { mes: 0, ano: 0 }
  };
  
  Object.values(fluxoPorPessoa).forEach(pessoa => {
    ['mes', 'ano'].forEach(periodo => {
      geral.receitas[periodo] += pessoa.receitas[periodo];
      geral.despesas_fixas[periodo] += pessoa.despesas_fixas[periodo];
      geral.despesas_variaveis[periodo] += pessoa.despesas_variaveis[periodo];
      geral.investimentos[periodo] += pessoa.investimentos[periodo];
      geral.saldo[periodo] += pessoa.saldo[periodo];
    });
  });
  
  return geral;
}

/**
 * Calcula a distribuição atual e compara com a ideal
 */
function calcularDistribuicao(fluxoGeral) {
  const rendaTotal = fluxoGeral.receitas.ano;
  
  if (rendaTotal <= 0) {
    return null;
  }
  
  // Distribuição atual (saldo/sobra vai para despesas variáveis em valor absoluto)
  const despesasFixasAtual = fluxoGeral.despesas_fixas.ano;
  const despesasVariaveisAtual = fluxoGeral.despesas_variaveis.ano + Math.abs(fluxoGeral.saldo.ano);
  const investimentosAtual = fluxoGeral.investimentos.ano;
  
  // Percentuais atuais
  const percDespesasFixasAtual = (despesasFixasAtual / rendaTotal) * 100;
  const percDespesasVariaveisAtual = (despesasVariaveisAtual / rendaTotal) * 100;
  const percInvestimentosAtual = (investimentosAtual / rendaTotal) * 100;
  
  // Valores ideais baseados nas variáveis de gestão
  const despesasFixasIdeal = (rendaTotal * variaveisGestao.despesas_fixas) / 100;
  const despesasVariaveisIdeal = (rendaTotal * variaveisGestao.despesas_variaveis) / 100;
  const investimentosIdeal = (rendaTotal * variaveisGestao.investimentos) / 100;
  
  return {
    rendaTotal,
    atual: {
      despesas_fixas: { valor: despesasFixasAtual, percentual: percDespesasFixasAtual },
      despesas_variaveis: { valor: despesasVariaveisAtual, percentual: percDespesasVariaveisAtual },
      investimentos: { valor: investimentosAtual, percentual: percInvestimentosAtual }
    },
    ideal: {
      despesas_fixas: { valor: despesasFixasIdeal, percentual: variaveisGestao.despesas_fixas },
      despesas_variaveis: { valor: despesasVariaveisIdeal, percentual: variaveisGestao.despesas_variaveis },
      investimentos: { valor: investimentosIdeal, percentual: variaveisGestao.investimentos }
    },
    diferenca: {
      despesas_fixas: despesasFixasAtual - despesasFixasIdeal,
      despesas_variaveis: despesasVariaveisAtual - despesasVariaveisIdeal,
      investimentos: investimentosAtual - investimentosIdeal
    }
  };
}

// ========================================
// TABELA DE INVESTIMENTOS/APORTES
// ========================================

function renderTabelaInvestimentos(pessoas) {
  if (!window.getPatrimoniosLiquidosData) {
    return `
      <div class="fx-bloco">
        <h4 class="fx-h4 fx-h4--inv">
          <span><i class="fas fa-piggy-bank"></i> INVESTIMENTOS/APORTES</span>
        </h4>
        <p class="fx-vazio">
          <i class="fas fa-info-circle"></i> Módulo de patrimônio líquido não carregado.
        </p>
      </div>
    `;
  }
  
  const patrimonios = window.getPatrimoniosLiquidosData() || [];
  const investimentos = [];
  
  // Adicionar restituições de IR como "investimentos" (aportes anuais)
  if (window.getDeclaracoesIRData) {
    const declaracoes = window.getDeclaracoesIRData() || [];
    declaracoes.forEach(declaracao => {
      const resultadoTipo = declaracao.resultado_tipo || '';
      const resultadoValor = parseFloat(declaracao.resultado_valor) || 0;
      
      if (resultadoTipo === 'restitui' && resultadoValor > 0) {
        // Mapear pessoa_key para encontrar o nome
        let titularNome = declaracao.pessoa_nome || 'Declarante';
        let titularId = 'titular';
        const pessoaKey = declaracao.pessoa_key || '';
        
        if (pessoaKey === 'cliente') {
          titularId = 'titular';
        } else if (pessoaKey === 'conjuge_cliente') {
          titularId = 'conjuge';
        } else if (pessoaKey.startsWith('conjuge_pessoa_')) {
          const idx = pessoaKey.replace('conjuge_pessoa_', '');
          titularId = `pessoa_${idx}_conjuge`;
        } else if (pessoaKey.startsWith('pessoa_')) {
          titularId = pessoaKey;
        }
        
        const pessoa = pessoas.find(p => p.id === titularId);
        if (pessoa) {
          titularNome = pessoa.nome;
        }
        
        investimentos.push({
          nome: 'Restituição IR',
          instituicao: 'Receita Federal',
          valor: resultadoValor,
          frequencia: 'ANUAL',
          titular: titularNome,
          titularId: titularId,
          valorMensal: 0,
          valorAnual: resultadoValor,
          isRestituicaoIR: true
        });
      }
    });
  }
  
  patrimonios.forEach(pl => {
    const aporteValor = parseFloat(pl.aporte_valor) || 0;
    const aporteFrequencia = pl.aporte_frequencia || 'NENHUM';
    const donos = pl.donos || [];
    
    if (aporteValor > 0 && aporteFrequencia !== 'NENHUM' && donos.length > 0) {
      const aporteValorPorDono = aporteValor / donos.length;
      
      donos.forEach(donoNome => {
        const pessoa = pessoas.find(p => p.nome === donoNome);
        if (pessoa) {
          investimentos.push({
            nome: pl.nome_produto_customizado || pl.tipo_produto_nome || 'Investimento',
            instituicao: pl.instituicao_nome || '-',
            valor: aporteValorPorDono,
            frequencia: aporteFrequencia,
            titular: pessoa.nome,
            titularId: pessoa.id,
            valorMensal: aporteFrequencia === 'MENSAL' ? aporteValorPorDono : 0,
            valorAnual: aporteFrequencia === 'MENSAL' ? aporteValorPorDono * 12 : aporteValorPorDono
          });
        }
      });
    }
  });
  
  return `
    <div class="fx-bloco">
      <h4 class="fx-h4 fx-h4--inv">
        <span><i class="fas fa-piggy-bank"></i> INVESTIMENTOS/APORTES <span class="fx-h4-sub">(importados do Patrimônio Líquido)</span></span>
      </h4>

      <div class="fx-wrap">
        <table class="fx-table fx-table--ro fx-table--inv">
          <thead>
            <tr>
              <th>Investimento</th>
              <th>Instituição</th>
              <th class="r" style="width: 120px;">Aporte</th>
              <th class="c" style="width: 96px;">Frequência</th>
              <th style="width: 160px;">Titular</th>
              <th class="r" style="width: 120px;">Valor/Mês</th>
              <th class="r" style="width: 120px;">Valor/Ano</th>
            </tr>
          </thead>
          <tbody>
            ${investimentos.length === 0 ? `
              <tr>
                <td colspan="7" class="fx-vazio">
                  Nenhum aporte cadastrado no Patrimônio Líquido.
                </td>
              </tr>
            ` : investimentos.map(inv => `
              <tr>
                <td>${inv.nome}</td>
                <td>${inv.instituicao}</td>
                <td class="r">${formatarMoedaFluxo(inv.valor)}</td>
                <td class="c"><span class="fx-chip ${inv.frequencia === 'MENSAL' ? 'fx-chip--mensal' : 'fx-chip--anual'}">${inv.frequencia}</span></td>
                <td>${inv.titular}</td>
                <td class="r fx-azul">${formatarMoedaFluxo(inv.valorMensal)}</td>
                <td class="r fx-azul fx-b">${formatarMoedaFluxo(inv.valorAnual)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ========================================
// RENDERIZAÇÃO
// ========================================
function renderFluxoCaixa() {
  const container = document.getElementById('fluxo-caixa-container');
  if (!container) return;
  
  const pessoas = getPessoasParaFluxo();
  const contasCartoes = getContasCartoesParaFluxo();
  
  // Renderizar formulário de edição
  container.innerHTML = `
    <!-- Botão de Sincronização -->
    <div class="fx-sync">
      <button type="button" class="fx-btn fx-btn--info" onclick="sincronizarDespesasAutomaticas()">
        <i class="fas fa-sync"></i> Sincronizar Despesas Automáticas
      </button>
      <span class="fx-hint">Importa automaticamente despesas de Produtos &amp; Proteção, Dívidas e Tarifas de Contas/Cartões</span>
    </div>
    
    <!-- RECEITAS -->
    <div class="fx-bloco">
      <h4 class="fx-h4 fx-h4--rec">
        <span><i class="fas fa-arrow-up"></i> RECEITAS</span>
        <button type="button" class="fx-btn-sm fx-btn-sm--rec" onclick="addReceita()">
          <i class="fas fa-plus"></i> Adicionar Receita
        </button>
      </h4>

      <div class="fx-wrap">
        <table class="fx-table fx-table--rec">
          <thead>
            <tr>
              <th>Nome</th>
              <th style="width: 110px;">Valor</th>
              <th style="width: 124px;">Tipo</th>
              <th style="width: 124px;">Recorrência</th>
              <th style="width: 150px;">De quem é</th>
              <th class="c" style="width: 44px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${receitas.length === 0 ? `
              <tr>
                <td colspan="6" class="fx-vazio">
                  Nenhuma receita cadastrada. Clique em "Adicionar Receita" para começar.
                </td>
              </tr>
            ` : receitas.map(receita => `
              <tr${receita.automatica ? ' class="fx-auto"' : ''}>
                <td><input type="text" class="fx-in" value="${receita.nome || ''}" title="${escAttrFluxo(receita.nome)}"
                         onchange="updateReceitaField(${receita.id}, 'nome', this.value)"
                         placeholder="Nome da receita"
                         ${receita.automatica ? 'readonly' : ''}></td>
                <td><input type="text" class="fx-in" id="receita_${receita.id}_valor" value="${formatarMoedaFluxo(receita.valor)}"
                         oninput="updateReceitaField(${receita.id}, 'valor', this.value)"
                         ${receita.automatica ? 'readonly' : ''}></td>
                <td><select class="fx-sel" onchange="updateReceitaField(${receita.id}, 'tipo', this.value)"
                          ${receita.automatica ? 'disabled' : ''}>
                    ${TIPOS_RECEITA.map(tipo => `
                      <option value="${tipo.id}" ${receita.tipo === tipo.id ? 'selected' : ''}>${tipo.nome}</option>
                    `).join('')}
                  </select></td>
                <td><div class="fx-rec">
                    <input type="number" class="fx-in" value="${receita.qtd_recorrencia || 1}"
                           onchange="updateReceitaField(${receita.id}, 'qtd_recorrencia', this.value)"
                           min="1"
                           ${receita.automatica ? 'readonly' : ''}>
                    <select class="fx-sel" onchange="updateReceitaField(${receita.id}, 'und_recorrencia', this.value)"
                            ${receita.automatica ? 'disabled' : ''}>
                      ${UNIDADES_RECORRENCIA.map(und => `
                        <option value="${und.id}" ${receita.und_recorrencia === und.id ? 'selected' : ''}>${und.nome}</option>
                      `).join('')}
                    </select>
                  </div></td>
                <td><select class="fx-sel" onchange="updateReceitaField(${receita.id}, 'titular', this.value)"
                          ${receita.automatica ? 'disabled' : ''}>
                    ${pessoas.map(pessoa => `
                      <option value="${pessoa.id}" ${receita.titular === pessoa.id ? 'selected' : ''}>${pessoa.nome}</option>
                    `).join('')}
                  </select></td>
                <td class="c"><button type="button" class="fx-del" onclick="deleteReceita(${receita.id})"
                            title="${receita.automatica ? 'Item sincronizado automaticamente' : 'Excluir'}"><i class="fas fa-trash"></i></button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- DESPESAS -->
    <div class="fx-bloco">
      <h4 class="fx-h4 fx-h4--desp">
        <span><i class="fas fa-arrow-down"></i> DESPESAS</span>
        <button type="button" class="fx-btn-sm fx-btn-sm--desp" onclick="addDespesa()">
          <i class="fas fa-plus"></i> Adicionar Despesa
        </button>
      </h4>

      <div class="fx-wrap">
        <table class="fx-table fx-table--desp">
          <thead>
            <tr>
              <th>Nome</th>
              <th style="width: 90px;">Valor</th>
              <th style="width: 62px;">Tipo</th>
              <th style="width: 96px;" title="Recorrência">Recorrência</th>
              <th style="width: 100px;">Forma Pgto</th>
              <th style="width: 100px;">Categoria</th>
              <th style="width: 96px;" title="Importância">Importância</th>
              <th style="width: 96px;">Conforto</th>
              <th style="width: 78px;" title="Alterável?">Alterável?</th>
              <th style="width: 100px;">Disposição</th>
              <th style="width: 92px;">Dono</th>
              <th class="c" style="width: 40px;" title="Ações">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${despesas.length === 0 ? `
              <tr>
                <td colspan="12" class="fx-vazio">
                  Nenhuma despesa cadastrada. Clique em "Adicionar Despesa" ou "Sincronizar Despesas Automáticas".
                </td>
              </tr>
            ` : despesas.map(despesa => {
              const titularNome = pessoas.find(p => p.id === despesa.titular)?.nome || despesa.titular || '-';
              const off = despesa.automatica ? 'disabled' : '';

              return `
                <tr${despesa.automatica ? ' class="fx-auto"' : ''}>
                  <td><input type="text" class="fx-in" value="${despesa.nome || ''}" title="${escAttrFluxo(despesa.nome)}"
                           onchange="updateDespesaField(${despesa.id}, 'nome', this.value)"
                           placeholder="Nome da despesa"
                           ${despesa.automatica ? 'readonly' : ''}></td>
                  <td><input type="text" class="fx-in" id="despesa_${despesa.id}_valor" value="${formatarMoedaFluxo(despesa.valor)}"
                           oninput="updateDespesaField(${despesa.id}, 'valor', this.value)"
                           ${despesa.automatica ? 'readonly' : ''}></td>
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'tipo', this.value)" ${off}>
                      ${TIPOS_DESPESA.map(tipo => `
                        <option value="${tipo.id}" ${despesa.tipo === tipo.id ? 'selected' : ''}>${tipo.nome}</option>
                      `).join('')}
                    </select></td>
                  <td><div class="fx-rec">
                      <input type="number" class="fx-in" value="${despesa.qtd_recorrencia || 1}"
                             onchange="updateDespesaField(${despesa.id}, 'qtd_recorrencia', this.value)"
                             min="1"
                             ${despesa.automatica ? 'readonly' : ''}>
                      <select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'und_recorrencia', this.value)" ${off}>
                        ${UNIDADES_RECORRENCIA.map(und => `
                          <option value="${und.id}" ${despesa.und_recorrencia === und.id ? 'selected' : ''}>${und.nome}</option>
                        `).join('')}
                      </select>
                    </div></td>
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'forma_pagamento', this.value)">
                      <option value="">Selecione...</option>
                      ${contasCartoes.map(cc => `
                        <option value="${cc.id}" ${despesa.forma_pagamento == cc.id ? 'selected' : ''}>${cc.nome}</option>
                      `).join('')}
                    </select></td>
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'categoria_comportamental', this.value)" ${off}>
                      <option value="" ${!despesa.categoria_comportamental ? 'selected' : ''}>Selecione...</option>
                      <option value="sobrevivencia" ${despesa.categoria_comportamental === 'sobrevivencia' ? 'selected' : ''}>Sobrevivência</option>
                      <option value="necessidades" ${despesa.categoria_comportamental === 'necessidades' ? 'selected' : ''}>Necessidades</option>
                      <option value="aperfeicoamento" ${despesa.categoria_comportamental === 'aperfeicoamento' ? 'selected' : ''}>Aperfeiçoamento</option>
                      <option value="dividas" ${despesa.categoria_comportamental === 'dividas' ? 'selected' : ''}>Dívidas</option>
                      <option value="conforto" ${despesa.categoria_comportamental === 'conforto' ? 'selected' : ''}>Conforto/Supérfluo</option>
                    </select></td>
                  <!-- Classificação v2 (Perfil Financeiro): só despesas manuais; automáticas ficam desabilitadas -->
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'nivel_importancia', this.value)" ${off}>
                      <option value="" ${!despesa.nivel_importancia ? 'selected' : ''}>Selecione...</option>
                      ${NIVEIS_IMPORTANCIA.map(n => `
                        <option value="${n.id}" ${despesa.nivel_importancia === n.id ? 'selected' : ''}>${n.nome}</option>
                      `).join('')}
                    </select></td>
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'nivel_conforto', this.value)" ${off}>
                      <option value="" ${!despesa.nivel_conforto ? 'selected' : ''}>Selecione...</option>
                      ${NIVEIS_CONFORTO.map(n => `
                        <option value="${n.id}" ${despesa.nivel_conforto === n.id ? 'selected' : ''}>${n.nome}</option>
                      `).join('')}
                    </select></td>
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'alteravel', this.value)" ${off}>
                      <option value="" ${!despesa.alteravel ? 'selected' : ''}>Selecione...</option>
                      ${OPCOES_ALTERAVEL.map(o => `
                        <option value="${o.id}" ${despesa.alteravel === o.id ? 'selected' : ''}>${o.nome}</option>
                      `).join('')}
                    </select></td>
                  <td><select class="fx-sel" onchange="updateDespesaField(${despesa.id}, 'disposto', this.value)" ${off}>
                      <option value="" ${!despesa.disposto ? 'selected' : ''}>Selecione...</option>
                      ${OPCOES_DISPOSTO.map(o => `
                        <option value="${o.id}" ${despesa.disposto === o.id ? 'selected' : ''}>${o.nome}</option>
                      `).join('')}
                    </select></td>
                  <td class="fx-td-txt" title="${escAttrFluxo(titularNome)}">${titularNome}</td>
                  <td class="c"><button type="button" class="fx-del" onclick="deleteDespesa(${despesa.id})"
                              title="${despesa.automatica ? 'Item sincronizado: ' + despesa.origem : 'Excluir'}"><i class="fas fa-trash"></i></button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- INVESTIMENTOS/APORTES -->
    ${renderTabelaInvestimentos(pessoas)}
    
    <!-- ANÁLISES (sempre visíveis abaixo da edição) -->
    <div id="fluxo-analises-container"></div>
  `;
  
  // Renderizar análises abaixo da edição
  setTimeout(() => renderAnalisesFluxo(), 0);
}

function renderAnalisesFluxo() {
  const analisesContainer = document.getElementById('fluxo-analises-container');
  if (!analisesContainer) return;
  
  const fluxoPorPessoa = calcularFluxoPorPessoa();
  const fluxoGeral = calcularFluxoGeral();
  const distribuicao = calcularDistribuicao(fluxoGeral);
  const pessoas = getPessoasParaFluxo();
  
  // Função auxiliar para renderizar tabela de fluxo (apenas MÊS e ANO)
  function renderTabelaFluxo(dados, titulo, corTitulo) {
    return `
      <div class="fx-bloco fx-bloco--fluxo">
        ${titulo ? `<h5 class="fx-h5" style="color: ${corTitulo};">${titulo}</h5>` : ''}
        <div class="fx-wrap">
          <table class="fx-table fx-table--ro fx-table--fluxo">
            <thead>
              <tr>
                <th></th>
                <th class="r" style="width: 34%;">MÊS</th>
                <th class="r" style="width: 34%;">ANO</th>
              </tr>
            </thead>
            <tbody>
              <tr class="fx-l-ent">
                <td class="fx-b"><i class="fas fa-arrow-up"></i> Entradas</td>
                <td class="r">${formatarMoedaFluxo(dados.receitas.mes)}</td>
                <td class="r">${formatarMoedaFluxo(dados.receitas.ano)}</td>
              </tr>
              <tr class="fx-l-fix">
                <td class="fx-b"><i class="fas fa-arrow-down"></i> Despesas Fixas</td>
                <td class="r">${formatarMoedaFluxo(dados.despesas_fixas.mes)}</td>
                <td class="r">${formatarMoedaFluxo(dados.despesas_fixas.ano)}</td>
              </tr>
              <tr class="fx-l-var">
                <td class="fx-b"><i class="fas fa-random"></i> Despesas Variáveis</td>
                <td class="r">${formatarMoedaFluxo(dados.despesas_variaveis.mes)}</td>
                <td class="r">${formatarMoedaFluxo(dados.despesas_variaveis.ano)}</td>
              </tr>
              <tr class="fx-l-inv">
                <td class="fx-b"><i class="fas fa-piggy-bank"></i> Investimentos</td>
                <td class="r">${formatarMoedaFluxo(dados.investimentos.mes)}</td>
                <td class="r">${formatarMoedaFluxo(dados.investimentos.ano)}</td>
              </tr>
              <tr class="fx-l-saldo">
                <td class="fx-b"><i class="fas fa-wallet"></i> SALDO/SOBRA</td>
                <td class="r fx-b">${formatarMoedaFluxo(dados.saldo.mes)} <span class="fx-pct">(${dados.receitas.mes > 0 ? ((dados.saldo.mes / dados.receitas.mes) * 100).toFixed(1) : '0.0'}%)</span></td>
                <td class="r fx-b">${formatarMoedaFluxo(dados.saldo.ano)} <span class="fx-pct">(${dados.receitas.ano > 0 ? ((dados.saldo.ano / dados.receitas.ano) * 100).toFixed(1) : '0.0'}%)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  // Função para renderizar comparação de distribuição
  function renderComparacaoDistribuicao() {
    if (!distribuicao) {
      return `
        <div class="fx-box fx-box--info fx-box--vazio">
          <i class="fas fa-info-circle"></i> Não há receitas cadastradas para calcular a distribuição.
        </div>
      `;
    }
    
    const formatarDiferenca = (valor) => {
      const cor = valor > 0 ? '#dc3545' : valor < 0 ? '#28a745' : 'var(--text-light)';
      const sinal = valor > 0 ? '+' : '';
      return `<span style="color: ${cor}; font-weight: 600;">${sinal}${formatarMoedaFluxo(valor)}</span>`;
    };
    
    return `
      <div class="fx-box fx-box--info">
        <h4 class="fx-h4">
          <span><i class="fas fa-balance-scale"></i> COMPARAÇÃO COM DISTRIBUIÇÃO IDEAL</span>
        </h4>
        <p class="fx-meta">
          Baseado nas variáveis de gestão financeira: Despesas Fixas ${variaveisGestao.despesas_fixas}% · Despesas Variáveis ${variaveisGestao.despesas_variaveis}% · Investimentos ${variaveisGestao.investimentos}% &nbsp;|&nbsp; <strong>Renda Total Anual:</strong> ${formatarMoedaFluxo(distribuicao.rendaTotal)}
        </p>

        <div class="fx-wrap">
          <table class="fx-table fx-table--ro fx-table--comp">
            <thead>
              <tr>
                <th>Categoria</th>
                <th class="r">Ideal (Anual)</th>
                <th class="r">Atual (Anual)</th>
                <th class="r">Diferença</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="fx-b fx-c-fix"><i class="fas fa-arrow-down"></i> Despesas Fixas</td>
                <td class="r">${formatarMoedaFluxo(distribuicao.ideal.despesas_fixas.valor)} <span class="fx-pct">(${distribuicao.ideal.despesas_fixas.percentual.toFixed(1)}%)</span></td>
                <td class="r">${formatarMoedaFluxo(distribuicao.atual.despesas_fixas.valor)} <span class="fx-pct">(${distribuicao.atual.despesas_fixas.percentual.toFixed(1)}%)</span></td>
                <td class="r">${formatarDiferenca(distribuicao.diferenca.despesas_fixas)}</td>
              </tr>
              <tr>
                <td class="fx-b fx-c-var"><i class="fas fa-random"></i> Despesas Variáveis + Saldo</td>
                <td class="r">${formatarMoedaFluxo(distribuicao.ideal.despesas_variaveis.valor)} <span class="fx-pct">(${distribuicao.ideal.despesas_variaveis.percentual.toFixed(1)}%)</span></td>
                <td class="r">${formatarMoedaFluxo(distribuicao.atual.despesas_variaveis.valor)} <span class="fx-pct">(${distribuicao.atual.despesas_variaveis.percentual.toFixed(1)}%)</span></td>
                <td class="r">${formatarDiferenca(distribuicao.diferenca.despesas_variaveis)}</td>
              </tr>
              <tr>
                <td class="fx-b fx-c-inv"><i class="fas fa-piggy-bank"></i> Investimentos</td>
                <td class="r">${formatarMoedaFluxo(distribuicao.ideal.investimentos.valor)} <span class="fx-pct">(${distribuicao.ideal.investimentos.percentual.toFixed(1)}%)</span></td>
                <td class="r">${formatarMoedaFluxo(distribuicao.atual.investimentos.valor)} <span class="fx-pct">(${distribuicao.atual.investimentos.percentual.toFixed(1)}%)</span></td>
                <td class="r">${formatarDiferenca(distribuicao.diferenca.investimentos)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="fx-nota">
          <i class="fas fa-info-circle"></i> Valores negativos na diferença indicam que você está gastando/investindo menos que o ideal.
        </p>
      </div>
    `;
  }
  
  // Verificar se há pessoas com valores para decidir se mostra "Análise por Integrante"
  const pessoasComValores = Object.entries(fluxoPorPessoa).filter(([pessoaId, dados]) => {
    return dados.receitas.ano > 0 || dados.despesas_fixas.ano > 0 || 
           dados.despesas_variaveis.ano > 0 || dados.investimentos.ano > 0;
  });
  
  // Gerar HTML da análise por integrante (se 2+ pessoas)
  let htmlIntegrantes = '';
  if (pessoasComValores.length > 1) {
    const intItems = pessoasComValores.map(([pessoaId, dados]) => {
      const titulo = '<i class="fas fa-user"></i> ' + dados.nome + ' <span class="fx-h4-sub">(' + dados.tipo + ')</span>';
      return '<div class="fx-int-item">' + renderTabelaFluxo(dados, titulo, 'var(--text-light)') + '</div>';
    }).join('');

    htmlIntegrantes = `
    <div class="fx-box fx-box--int">
      <h4 class="fx-h4">
        <span><i class="fas fa-users"></i> ANÁLISE POR INTEGRANTE</span>
      </h4>
      <div class="fx-int-grid">${intItems}</div>
    </div>`;
  }

  // Renderizar análises
  analisesContainer.innerHTML = `
    <div class="fx-analises">

    <!-- RESULTADO PRINCIPAL (GERAL) -->
    <div class="fx-box fx-box--geral">
      <h4 class="fx-h4">
        <span><i class="fas fa-chart-pie"></i> ANÁLISE GERAL DO FLUXO DE CAIXA</span>
      </h4>
      ${renderTabelaFluxo(fluxoGeral, null, null)}
    </div>

    <!-- COMPARAÇÃO COM DISTRIBUIÇÃO IDEAL -->
    ${renderComparacaoDistribuicao()}

    <!-- RESULTADOS SECUNDÁRIOS (POR PESSOA) - só aparece com 2+ pessoas com valores -->
    ${htmlIntegrantes}

    </div>
  `;
}

// ========================================
// FUNÇÕES DE DADOS
// ========================================

function getFluxoCaixaData() {
  return {
    receitas: receitas,
    despesas: despesas,
    fluxoFinalizado: false
  };
}

function setFluxoCaixaData(data) {
  if (data) {
    // Carregar receitas manuais (filtrar automáticas para evitar duplicatas)
    if (Array.isArray(data.receitas)) {
      receitas = data.receitas.filter(r => !r.automatica);
      if (receitas.length > 0) {
        receitaCounter = Math.max(...receitas.map(r => r.id || 0));
      }
    }
    // Carregar despesas manuais (não automáticas)
    if (Array.isArray(data.despesas)) {
      // Filtrar apenas despesas manuais do banco
      const despesasManuais = data.despesas.filter(d => !d.automatica);
      // v2 (Perfil Financeiro): backfill '' nas despesas antigas — o spread preserva tudo que já existe
      despesas = despesasManuais.map(d => ({ nivel_importancia: '', nivel_conforto: '', alteravel: '', disposto: '', ...d }));
      if (despesas.length > 0) {
        despesaCounter = Math.max(...despesas.map(d => d.id || 0));
      }
    }
    // fluxoFinalizado removido - análises sempre visíveis
    
    // Sincronizar despesas automáticas após carregar dados
    // Aguardar um pouco para garantir que outros módulos estejam carregados
    setTimeout(() => {
      sincronizarDespesasAutomaticas();
      renderFluxoCaixa();
    }, 500);
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFluxoCaixaModule);
} else {
  initFluxoCaixaModule();
}

// Exportar funções
export {
  initFluxoCaixaModule,
  getFluxoCaixaData,
  setFluxoCaixaData,
  renderFluxoCaixa,
  sincronizarDespesasAutomaticas
};
