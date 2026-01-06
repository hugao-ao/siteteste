// ========================================
// MÓDULO DE FLUXO DE CAIXA
// ========================================

import { supabase } from './supabase.js';

// Dados do fluxo de caixa
let receitas = [];
let despesas = [];
let receitaCounter = 0;
let despesaCounter = 0;
let fluxoFinalizado = false;

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
  window.finalizarFluxo = finalizarFluxo;
  window.voltarEdicaoFluxo = voltarEdicaoFluxo;
  
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
  const receita = receitas.find(r => r.id === id);
  if (receita && receita.automatica) {
    alert('Esta receita foi gerada automaticamente e não pode ser excluída.');
    return;
  }
  
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
    titular: '',
    automatica: false,
    origem: null
  };
  
  despesas.push(novaDespesa);
  renderFluxoCaixa();
}

function deleteDespesa(id) {
  const despesa = despesas.find(d => d.id === id);
  if (despesa && despesa.automatica) {
    alert('Esta despesa foi gerada automaticamente e não pode ser excluída. Para removê-la, exclua o item original na seção correspondente.');
    return;
  }
  
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
  } else {
    despesa[field] = valor;
  }
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
  // Remover receitas automáticas de IR antigas
  receitas = receitas.filter(r => r.origem !== 'ir_restituicao');
  
  if (window.getDeclaracoesIRData) {
    const declaracoes = window.getDeclaracoesIRData() || [];
    declaracoes.forEach(declaracao => {
      const resultadoTipo = declaracao.resultado_tipo || '';
      const resultadoValor = parseFloat(declaracao.resultado_valor) || 0;
      const pessoaId = declaracao.pessoa_id || 'titular';
      
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
            origem_id: declaracao.pessoa_id
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
            origem_id: declaracao.pessoa_id
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
    const pessoaId = despesa.titular;
    if (resultado[pessoaId]) {
      const tipoDespesa = despesa.tipo === 'fixa' ? 'despesas_fixas' : 'despesas_variaveis';
      resultado[pessoaId][tipoDespesa].mes += calcularValorMensal(
        despesa.valor, despesa.qtd_recorrencia, despesa.und_recorrencia
      );
      resultado[pessoaId][tipoDespesa].ano += calcularValorAnual(
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
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #007bff; margin: 0 0 1rem 0;">
          <i class="fas fa-piggy-bank"></i> INVESTIMENTOS/APORTES
        </h4>
        <p style="text-align: center; color: var(--text-light); opacity: 0.7;">
          <i class="fas fa-info-circle"></i> Módulo de patrimônio líquido não carregado.
        </p>
      </div>
    `;
  }
  
  const patrimonios = window.getPatrimoniosLiquidosData() || [];
  const investimentos = [];
  
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
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #007bff; margin: 0 0 1rem 0;">
        <i class="fas fa-piggy-bank"></i> INVESTIMENTOS/APORTES
        <span style="font-size: 0.8rem; font-weight: normal; opacity: 0.7;">(importados do Patrimônio Líquido)</span>
      </h4>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(0, 123, 255, 0.2);">
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Investimento</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Instituição</th>
              <th style="padding: 0.6rem; text-align: right; border: 1px solid var(--border-color);">Aporte</th>
              <th style="padding: 0.6rem; text-align: center; border: 1px solid var(--border-color);">Frequência</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Titular</th>
              <th style="padding: 0.6rem; text-align: right; border: 1px solid var(--border-color);">Valor/Mês</th>
              <th style="padding: 0.6rem; text-align: right; border: 1px solid var(--border-color);">Valor/Ano</th>
            </tr>
          </thead>
          <tbody>
            ${investimentos.length === 0 ? `
              <tr>
                <td colspan="7" style="padding: 1rem; text-align: center; color: var(--text-light); opacity: 0.7; border: 1px solid var(--border-color);">
                  Nenhum aporte cadastrado no Patrimônio Líquido.
                </td>
              </tr>
            ` : investimentos.map(inv => `
              <tr>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color);">${inv.nome}</td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color);">${inv.instituicao}</td>
                <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color);">${formatarMoedaFluxo(inv.valor)}</td>
                <td style="padding: 0.4rem; text-align: center; border: 1px solid var(--border-color);">
                  <span style="background: ${inv.frequencia === 'MENSAL' ? '#28a745' : '#ffc107'}; color: ${inv.frequencia === 'MENSAL' ? 'white' : '#333'}; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                    ${inv.frequencia}
                  </span>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color);">${inv.titular}</td>
                <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(inv.valorMensal)}</td>
                <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color); color: #007bff; font-weight: 600;">${formatarMoedaFluxo(inv.valorAnual)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ========================================
// FINALIZAR FLUXO
// ========================================

function finalizarFluxo() {
  fluxoFinalizado = true;
  renderFluxoCaixa();
}

function voltarEdicaoFluxo() {
  fluxoFinalizado = false;
  renderFluxoCaixa();
}

// ========================================
// RENDERIZAÇÃO
// ========================================

function renderFluxoCaixa() {
  const container = document.getElementById('fluxo-caixa-container');
  if (!container) return;
  
  const pessoas = getPessoasParaFluxo();
  const contasCartoes = getContasCartoesParaFluxo();
  
  if (fluxoFinalizado) {
    renderResultadosFluxo(container);
    return;
  }
  
  // Renderizar formulário de edição
  container.innerHTML = `
    <!-- Botão de Sincronização -->
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <button type="button" onclick="sincronizarDespesasAutomaticas()" 
              style="background: var(--info-color, #17a2b8); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
        <i class="fas fa-sync"></i> Sincronizar Despesas Automáticas
      </button>
      <p style="font-size: 0.8rem; color: var(--text-light); opacity: 0.7; margin-top: 0.5rem;">
        Importa automaticamente despesas de Produtos & Proteção, Dívidas e Tarifas de Contas/Cartões
      </p>
    </div>
    
    <!-- RECEITAS -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #28a745; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fas fa-arrow-up"></i> RECEITAS</span>
        <button type="button" onclick="addReceita()" 
                style="background: #28a745; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          <i class="fas fa-plus"></i> Adicionar Receita
        </button>
      </h4>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(40, 167, 69, 0.2);">
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Nome</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Valor</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Tipo</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Recorrência</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">De quem é</th>
              <th style="padding: 0.6rem; text-align: center; border: 1px solid var(--border-color); width: 60px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${receitas.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 1rem; text-align: center; color: var(--text-light); opacity: 0.7; border: 1px solid var(--border-color);">
                  Nenhuma receita cadastrada. Clique em "Adicionar Receita" para começar.
                </td>
              </tr>
            ` : receitas.map(receita => `
              <tr style="background: ${receita.automatica ? 'rgba(40, 167, 69, 0.05)' : 'transparent'};">
                <td style="padding: 0.4rem; border: 1px solid var(--border-color);">
                  <input type="text" value="${receita.nome || ''}" 
                         onchange="updateReceitaField(${receita.id}, 'nome', this.value)"
                         placeholder="Nome da receita"
                         style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                         ${receita.automatica ? 'readonly' : ''}>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 120px;">
                  <input type="text" id="receita_${receita.id}_valor" value="${formatarMoedaFluxo(receita.valor)}" 
                         oninput="updateReceitaField(${receita.id}, 'valor', this.value)"
                         style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                         ${receita.automatica ? 'readonly' : ''}>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 130px;">
                  <select onchange="updateReceitaField(${receita.id}, 'tipo', this.value)"
                          style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                          ${receita.automatica ? 'disabled' : ''}>
                    ${TIPOS_RECEITA.map(tipo => `
                      <option value="${tipo.id}" ${receita.tipo === tipo.id ? 'selected' : ''}>${tipo.nome}</option>
                    `).join('')}
                  </select>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                  <div style="display: flex; gap: 0.3rem;">
                    <input type="number" value="${receita.qtd_recorrencia || 1}" 
                           onchange="updateReceitaField(${receita.id}, 'qtd_recorrencia', this.value)"
                           min="1" style="width: 50px; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                           ${receita.automatica ? 'readonly' : ''}>
                    <select onchange="updateReceitaField(${receita.id}, 'und_recorrencia', this.value)"
                            style="flex: 1; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                            ${receita.automatica ? 'disabled' : ''}>
                      ${UNIDADES_RECORRENCIA.map(und => `
                        <option value="${und.id}" ${receita.und_recorrencia === und.id ? 'selected' : ''}>${und.nome}</option>
                      `).join('')}
                    </select>
                  </div>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                  <select onchange="updateReceitaField(${receita.id}, 'titular', this.value)"
                          style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                          ${receita.automatica ? 'disabled' : ''}>
                    ${pessoas.map(pessoa => `
                      <option value="${pessoa.id}" ${receita.titular === pessoa.id ? 'selected' : ''}>${pessoa.nome}</option>
                    `).join('')}
                  </select>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); text-align: center;">
                  ${receita.automatica ? `
                    <span style="color: var(--text-light); opacity: 0.5;" title="Item automático"><i class="fas fa-lock"></i></span>
                  ` : `
                    <button type="button" onclick="deleteReceita(${receita.id})" 
                            style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.5rem; border-radius: 4px; cursor: pointer;">
                      <i class="fas fa-trash"></i>
                    </button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- DESPESAS -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #dc3545; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fas fa-arrow-down"></i> DESPESAS</span>
        <button type="button" onclick="addDespesa()" 
                style="background: #dc3545; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          <i class="fas fa-plus"></i> Adicionar Despesa
        </button>
      </h4>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(220, 53, 69, 0.2);">
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Nome</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Valor</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Tipo</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Recorrência</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Forma Pgto</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Dono</th>
              <th style="padding: 0.6rem; text-align: center; border: 1px solid var(--border-color); width: 60px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${despesas.length === 0 ? `
              <tr>
                <td colspan="7" style="padding: 1rem; text-align: center; color: var(--text-light); opacity: 0.7; border: 1px solid var(--border-color);">
                  Nenhuma despesa cadastrada. Clique em "Adicionar Despesa" ou "Sincronizar Despesas Automáticas".
                </td>
              </tr>
            ` : despesas.map(despesa => {
              const titularNome = pessoas.find(p => p.id === despesa.titular)?.nome || despesa.titular || '-';
              
              return `
                <tr style="background: ${despesa.automatica ? 'rgba(220, 53, 69, 0.05)' : 'transparent'};">
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color);">
                    <input type="text" value="${despesa.nome || ''}" 
                           onchange="updateDespesaField(${despesa.id}, 'nome', this.value)"
                           placeholder="Nome da despesa"
                           style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                           ${despesa.automatica ? 'readonly' : ''}>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 120px;">
                    <input type="text" id="despesa_${despesa.id}_valor" value="${formatarMoedaFluxo(despesa.valor)}" 
                           oninput="updateDespesaField(${despesa.id}, 'valor', this.value)"
                           style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                           ${despesa.automatica ? 'readonly' : ''}>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 100px;">
                    <select onchange="updateDespesaField(${despesa.id}, 'tipo', this.value)"
                            style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                            ${despesa.automatica ? 'disabled' : ''}>
                      ${TIPOS_DESPESA.map(tipo => `
                        <option value="${tipo.id}" ${despesa.tipo === tipo.id ? 'selected' : ''}>${tipo.nome}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                    <div style="display: flex; gap: 0.3rem;">
                      <input type="number" value="${despesa.qtd_recorrencia || 1}" 
                             onchange="updateDespesaField(${despesa.id}, 'qtd_recorrencia', this.value)"
                             min="1" style="width: 50px; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                             ${despesa.automatica ? 'readonly' : ''}>
                      <select onchange="updateDespesaField(${despesa.id}, 'und_recorrencia', this.value)"
                              style="flex: 1; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                              ${despesa.automatica ? 'disabled' : ''}>
                        ${UNIDADES_RECORRENCIA.map(und => `
                          <option value="${und.id}" ${despesa.und_recorrencia === und.id ? 'selected' : ''}>${und.nome}</option>
                        `).join('')}
                      </select>
                    </div>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                    <select onchange="updateDespesaField(${despesa.id}, 'forma_pagamento', this.value)"
                            style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);">
                      <option value="">Selecione...</option>
                      ${contasCartoes.map(cc => `
                        <option value="${cc.id}" ${despesa.forma_pagamento == cc.id ? 'selected' : ''}>${cc.nome}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 100px; font-size: 0.85rem;">
                    ${titularNome}
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); text-align: center;">
                    ${despesa.automatica ? `
                      <span style="color: var(--text-light); opacity: 0.5;" title="Item automático - ${despesa.origem}"><i class="fas fa-lock"></i></span>
                    ` : `
                      <button type="button" onclick="deleteDespesa(${despesa.id})" 
                              style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.5rem; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                      </button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- INVESTIMENTOS/APORTES -->
    ${renderTabelaInvestimentos(pessoas)}
    
    <!-- Botão Finalizar -->
    <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 2px solid var(--border-color);">
      <button type="button" onclick="finalizarFluxo()" 
              style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.8rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        <i class="fas fa-check-circle"></i> FINALIZAR FLUXO
      </button>
    </div>
  `;
}

function renderResultadosFluxo(container) {
  const fluxoPorPessoa = calcularFluxoPorPessoa();
  const fluxoGeral = calcularFluxoGeral();
  const distribuicao = calcularDistribuicao(fluxoGeral);
  
  // Função auxiliar para renderizar tabela de fluxo (apenas MÊS e ANO)
  function renderTabelaFluxo(dados, titulo, corTitulo) {
    return `
      <div style="margin-bottom: 1.5rem;">
        ${titulo ? `<h5 style="color: ${corTitulo}; margin: 0 0 0.5rem 0;">${titulo}</h5>` : ''}
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(212, 175, 55, 0.2);">
                <th style="padding: 0.5rem; text-align: left; border: 1px solid var(--border-color);"></th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">MÊS</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">ANO</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: rgba(40, 167, 69, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #28a745;">
                  <i class="fas fa-arrow-up"></i> Entradas
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaFluxo(dados.receitas.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaFluxo(dados.receitas.ano)}</td>
              </tr>
              <tr style="background: rgba(220, 53, 69, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #dc3545;">
                  <i class="fas fa-arrow-down"></i> Despesas Fixas
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaFluxo(dados.despesas_fixas.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaFluxo(dados.despesas_fixas.ano)}</td>
              </tr>
              <tr style="background: rgba(255, 193, 7, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #ffc107;">
                  <i class="fas fa-random"></i> Despesas Variáveis
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaFluxo(dados.despesas_variaveis.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaFluxo(dados.despesas_variaveis.ano)}</td>
              </tr>
              <tr style="background: rgba(0, 123, 255, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #007bff;">
                  <i class="fas fa-piggy-bank"></i> Investimentos
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(dados.investimentos.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(dados.investimentos.ano)}</td>
              </tr>
              <tr style="background: rgba(212, 175, 55, 0.2);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 700; color: #ffffff;">
                  <i class="fas fa-wallet"></i> SALDO/SOBRA
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); font-weight: 700; color: #ffffff;">
                  ${formatarMoedaFluxo(dados.saldo.mes)} 
                  <span style="font-size: 0.8rem; opacity: 0.8;">(${dados.receitas.mes > 0 ? ((dados.saldo.mes / dados.receitas.mes) * 100).toFixed(1) : '0.0'}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); font-weight: 700; color: #ffffff;">
                  ${formatarMoedaFluxo(dados.saldo.ano)} 
                  <span style="font-size: 0.8rem; opacity: 0.8;">(${dados.receitas.ano > 0 ? ((dados.saldo.ano / dados.receitas.ano) * 100).toFixed(1) : '0.0'}%)</span>
                </td>
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
        <div style="text-align: center; padding: 1rem; color: var(--text-light); opacity: 0.7;">
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
      <div style="margin-top: 2rem; padding: 1.2rem; background: var(--dark-bg); border: 2px solid var(--info-color, #17a2b8); border-radius: 10px;">
        <h4 style="color: var(--info-color, #17a2b8); margin: 0 0 1rem 0; text-align: center;">
          <i class="fas fa-balance-scale"></i> COMPARAÇÃO COM DISTRIBUIÇÃO IDEAL
        </h4>
        <p style="text-align: center; font-size: 0.85rem; color: var(--text-light); opacity: 0.8; margin-bottom: 1rem;">
          Baseado nas variáveis de gestão financeira: Despesas Fixas ${variaveisGestao.despesas_fixas}% | Despesas Variáveis ${variaveisGestao.despesas_variaveis}% | Investimentos ${variaveisGestao.investimentos}%
        </p>
        <p style="text-align: center; font-size: 0.9rem; margin-bottom: 1rem;">
          <strong>Renda Total Anual:</strong> ${formatarMoedaFluxo(distribuicao.rendaTotal)}
        </p>
        
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(23, 162, 184, 0.2);">
                <th style="padding: 0.5rem; text-align: left; border: 1px solid var(--border-color);">Categoria</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">Ideal (Anual)</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">Atual (Anual)</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">Diferença</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #dc3545;">
                  <i class="fas fa-arrow-down"></i> Despesas Fixas
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarMoedaFluxo(distribuicao.ideal.despesas_fixas.valor)}
                  <span style="font-size: 0.75rem; opacity: 0.7;"> (${distribuicao.ideal.despesas_fixas.percentual.toFixed(1)}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarMoedaFluxo(distribuicao.atual.despesas_fixas.valor)}
                  <span style="font-size: 0.75rem; opacity: 0.7;"> (${distribuicao.atual.despesas_fixas.percentual.toFixed(1)}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarDiferenca(distribuicao.diferenca.despesas_fixas)}
                </td>
              </tr>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #ffc107;">
                  <i class="fas fa-random"></i> Despesas Variáveis + Saldo
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarMoedaFluxo(distribuicao.ideal.despesas_variaveis.valor)}
                  <span style="font-size: 0.75rem; opacity: 0.7;"> (${distribuicao.ideal.despesas_variaveis.percentual.toFixed(1)}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarMoedaFluxo(distribuicao.atual.despesas_variaveis.valor)}
                  <span style="font-size: 0.75rem; opacity: 0.7;"> (${distribuicao.atual.despesas_variaveis.percentual.toFixed(1)}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarDiferenca(distribuicao.diferenca.despesas_variaveis)}
                </td>
              </tr>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #007bff;">
                  <i class="fas fa-piggy-bank"></i> Investimentos
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarMoedaFluxo(distribuicao.ideal.investimentos.valor)}
                  <span style="font-size: 0.75rem; opacity: 0.7;"> (${distribuicao.ideal.investimentos.percentual.toFixed(1)}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarMoedaFluxo(distribuicao.atual.investimentos.valor)}
                  <span style="font-size: 0.75rem; opacity: 0.7;"> (${distribuicao.atual.investimentos.percentual.toFixed(1)}%)</span>
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">
                  ${formatarDiferenca(distribuicao.diferenca.investimentos)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <p style="text-align: center; font-size: 0.8rem; color: var(--text-light); opacity: 0.7; margin-top: 1rem;">
          <i class="fas fa-info-circle"></i> Valores negativos na diferença indicam que você está gastando/investindo menos que o ideal.
        </p>
      </div>
    `;
  }
  
  // Renderizar resultados
  container.innerHTML = `
    <!-- Botão Voltar -->
    <div style="text-align: right; margin-bottom: 1rem;">
      <button type="button" onclick="voltarEdicaoFluxo()" 
              style="background: var(--border-color); color: var(--text-light); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
        <i class="fas fa-arrow-left"></i> Voltar para Edição
      </button>
    </div>
    
    <!-- RESULTADO PRINCIPAL (GERAL) -->
    <div style="background: var(--dark-bg); border: 2px solid var(--accent-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 2rem;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> ANÁLISE GERAL DO FLUXO DE CAIXA
      </h4>
      ${renderTabelaFluxo(fluxoGeral, null, null)}
    </div>
    
    <!-- COMPARAÇÃO COM DISTRIBUIÇÃO IDEAL -->
    ${renderComparacaoDistribuicao()}
    
    <!-- RESULTADOS SECUNDÁRIOS (POR PESSOA) -->
    <div style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-top: 2rem;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; text-align: center;">
        <i class="fas fa-users"></i> ANÁLISE POR INTEGRANTE
      </h4>
      
      ${Object.entries(fluxoPorPessoa).map(([pessoaId, dados]) => {
        // Verificar se a pessoa tem algum valor
        const temValores = dados.receitas.ano > 0 || dados.despesas_fixas.ano > 0 || 
                          dados.despesas_variaveis.ano > 0 || dados.investimentos.ano > 0;
        
        if (!temValores) return '';
        
        return `
          <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
            ${renderTabelaFluxo(dados, `<i class="fas fa-user"></i> ${dados.nome} <span style="font-size: 0.8rem; opacity: 0.7;">(${dados.tipo})</span>`, 'var(--text-light)')}
          </div>
        `;
      }).join('')}
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
    fluxoFinalizado: fluxoFinalizado
  };
}

function setFluxoCaixaData(data) {
  if (data) {
    // Carregar receitas manuais
    if (Array.isArray(data.receitas)) {
      receitas = data.receitas;
      if (receitas.length > 0) {
        receitaCounter = Math.max(...receitas.map(r => r.id || 0));
      }
    }
    // Carregar despesas manuais (não automáticas)
    if (Array.isArray(data.despesas)) {
      // Filtrar apenas despesas manuais do banco
      const despesasManuais = data.despesas.filter(d => !d.automatica);
      despesas = despesasManuais;
      if (despesas.length > 0) {
        despesaCounter = Math.max(...despesas.map(d => d.id || 0));
      }
    }
    if (typeof data.fluxoFinalizado === 'boolean') {
      fluxoFinalizado = data.fluxoFinalizado;
    }
    
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
