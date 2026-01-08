// ========================================
// MÓDULO DE OBJETIVOS - VERSÃO 4.0
// ========================================

import { supabase } from './supabase.js';

// Dados dos objetivos
let objetivos = [];
let objetivoCounter = 0;
let analiseVisivel = false;

// Variáveis de mercado (carregadas do Supabase)
let variaveisMercado = {
  selic: 14.75,
  cdi_120_meses: 142.59,
  ipca: 5.44,
  ipca_120_meses: 70.88,
  cdi: 14.65,
  cdi_aa_medio_10_anos: 9.2666,
  ipca_aa_medio_10_anos: 5.504,
  rent_anual_aposentadoria: 6.0,
  rent_mensal_aposentadoria: 0.4868,
  // Rentabilidades atuais dos 9 perfis
  rent_sem_conhecimento: 0,
  rent_iniciante: 0,
  rent_ultra_cons: 0,
  rent_cons: 0,
  rent_cons_mod: 0,
  rent_mod: 0,
  rent_mod_arro: 0,
  rent_arro: 0,
  rent_ultra_arro: 0,
  // Rentabilidades 10 anos dos 9 perfis
  rent_sem_conhecimento_10_anos: 0,
  rent_iniciante_10_anos: 0,
  rent_ultra_cons_10_anos: 0,
  rent_cons_10_anos: 0,
  rent_cons_mod_10_anos: 0,
  rent_mod_10_anos: 0,
  rent_mod_arro_10_anos: 0,
  rent_arro_10_anos: 0,
  rent_ultra_arro_10_anos: 0,
  // Multiplicadores
  mult_sem_conhecimento: 80,
  mult_iniciante: 95,
  mult_ultra_cons: 100,
  mult_cons: 103,
  mult_cons_mod: 106,
  mult_mod: 110,
  mult_mod_arro: 115,
  mult_arro: 120,
  mult_ultra_arro: 130,
  ultima_atualizacao: null
};

// Perfis de rentabilidade disponíveis
const PERFIS_RENTABILIDADE = [
  { id: 'sem_conhecimento', nome: 'Sem Conhecimento', percentCDI: 80 },
  { id: 'iniciante', nome: 'Iniciante', percentCDI: 95 },
  { id: 'ultra_cons', nome: 'Ultra-Conservador', percentCDI: 100 },
  { id: 'cons', nome: 'Conservador', percentCDI: 103 },
  { id: 'cons_mod', nome: 'Conservador-Moderado', percentCDI: 106 },
  { id: 'mod', nome: 'Moderado', percentCDI: 110 },
  { id: 'mod_arro', nome: 'Moderado-Arrojado', percentCDI: 115 },
  { id: 'arro', nome: 'Arrojado', percentCDI: 120 },
  { id: 'ultra_arro', nome: 'Ultra-Arrojado', percentCDI: 130 }
];

// ========================================
// CARREGAMENTO DE VARIÁVEIS DE MERCADO
// ========================================

async function carregarVariaveisMercado() {
  try {
    const { data, error } = await supabase
      .from('variaveis_mercado')
      .select('*')
      .order('data_ultima_atualizacao', { ascending: false })
      .limit(1)
      .single();
    
    if (data && !error) {
      const cdi = parseFloat(data.cdi) || 14.65;
      const cdi10 = parseFloat(data.cdi_aa_medio_10_anos) || 9.2666;
      
      // Multiplicadores (carregados ou padrão)
      const multSemConhecimento = parseFloat(data.mult_sem_conhecimento) || 80;
      const multIniciante = parseFloat(data.mult_iniciante) || 95;
      const multUltraCons = parseFloat(data.mult_ultra_cons) || 100;
      const multCons = parseFloat(data.mult_cons) || 103;
      const multConsMod = parseFloat(data.mult_cons_mod) || 106;
      const multMod = parseFloat(data.mult_mod) || 110;
      const multModArro = parseFloat(data.mult_mod_arro) || 115;
      const multArro = parseFloat(data.mult_arro) || 120;
      const multUltraArro = parseFloat(data.mult_ultra_arro) || 130;
      
      variaveisMercado = {
        selic: parseFloat(data.selic) || 14.75,
        cdi_120_meses: parseFloat(data.cdi_120_meses) || 142.59,
        ipca: parseFloat(data.ipca) || 5.44,
        ipca_120_meses: parseFloat(data.ipca_120_meses) || 70.88,
        cdi: cdi,
        cdi_aa_medio_10_anos: cdi10,
        ipca_aa_medio_10_anos: parseFloat(data.ipca_aa_medio_10_anos) || 5.504,
        rent_anual_aposentadoria: parseFloat(data.rent_anual_aposentadoria) || 6.0,
        rent_mensal_aposentadoria: parseFloat(data.rent_mensal_aposentadoria) || 0.4868,
        // Rentabilidades atuais
        rent_sem_conhecimento: parseFloat(data.rent_sem_conhecimento) || cdi * (multSemConhecimento / 100),
        rent_iniciante: parseFloat(data.rent_iniciante) || cdi * (multIniciante / 100),
        rent_ultra_cons: parseFloat(data.rent_ultra_cons) || cdi * (multUltraCons / 100),
        rent_cons: parseFloat(data.rent_cons) || cdi * (multCons / 100),
        rent_cons_mod: parseFloat(data.rent_cons_mod) || cdi * (multConsMod / 100),
        rent_mod: parseFloat(data.rent_mod) || cdi * (multMod / 100),
        rent_mod_arro: parseFloat(data.rent_mod_arro) || cdi * (multModArro / 100),
        rent_arro: parseFloat(data.rent_arro) || cdi * (multArro / 100),
        rent_ultra_arro: parseFloat(data.rent_ultra_arro) || cdi * (multUltraArro / 100),
        // Rentabilidades 10 anos
        rent_sem_conhecimento_10_anos: parseFloat(data.rent_sem_conhecimento_10_anos) || cdi10 * (multSemConhecimento / 100),
        rent_iniciante_10_anos: parseFloat(data.rent_iniciante_10_anos) || cdi10 * (multIniciante / 100),
        rent_ultra_cons_10_anos: parseFloat(data.rent_ultra_cons_10_anos) || cdi10 * (multUltraCons / 100),
        rent_cons_10_anos: parseFloat(data.rent_cons_10_anos) || cdi10 * (multCons / 100),
        rent_cons_mod_10_anos: parseFloat(data.rent_cons_mod_10_anos) || cdi10 * (multConsMod / 100),
        rent_mod_10_anos: parseFloat(data.rent_mod_10_anos) || cdi10 * (multMod / 100),
        rent_mod_arro_10_anos: parseFloat(data.rent_mod_arro_10_anos) || cdi10 * (multModArro / 100),
        rent_arro_10_anos: parseFloat(data.rent_arro_10_anos) || cdi10 * (multArro / 100),
        rent_ultra_arro_10_anos: parseFloat(data.rent_ultra_arro_10_anos) || cdi10 * (multUltraArro / 100),
        // Multiplicadores
        mult_sem_conhecimento: multSemConhecimento,
        mult_iniciante: multIniciante,
        mult_ultra_cons: multUltraCons,
        mult_cons: multCons,
        mult_cons_mod: multConsMod,
        mult_mod: multMod,
        mult_mod_arro: multModArro,
        mult_arro: multArro,
        mult_ultra_arro: multUltraArro,
        ultima_atualizacao: data.data_ultima_atualizacao || data.created_at
      };
    }
  } catch (error) {
    console.error('Erro ao carregar variáveis de mercado:', error);
  }
}

// ========================================
// INICIALIZAÇÃO DO MÓDULO
// ========================================

async function initObjetivosModule() {
  console.log('Módulo de Objetivos v4.0 carregado');
  
  // Carregar variáveis de mercado
  await carregarVariaveisMercado();
  
  // Injetar CSS para dropdowns
  injetarCSSDropdown();
  
  // Expor funções globalmente
  window.addObjetivo = addObjetivo;
  window.addObjetivoAposentadoria = addObjetivoAposentadoria;
  window.deleteObjetivo = deleteObjetivo;
  window.updateObjetivoField = updateObjetivoField;
  window.updateObjetivoPrioridade = updateObjetivoPrioridade;
  window.getObjetivosData = getObjetivosData;
  window.setObjetivosData = setObjetivosData;
  window.renderObjetivos = renderObjetivos;
  window.mostrarAnaliseObjetivos = mostrarAnaliseObjetivos;
  window.voltarEdicaoObjetivos = voltarEdicaoObjetivos;
  window.formatarInputMoedaObj = formatarInputMoedaObj;
  window.atualizarPatrimonioObjetivos = atualizarPatrimonioObjetivos;
  
  // Renderizar a seção
  setTimeout(() => {
    renderObjetivos();
  }, 1000);
}

// Injetar CSS para estilizar dropdowns com fundo verde escuro
function injetarCSSDropdown() {
  const style = document.createElement('style');
  style.textContent = `
    .perfil-selector {
      background-color: #0d3320 !important;
      color: #e8e8e8 !important;
    }
    .perfil-selector option {
      background-color: #0d3320 !important;
      color: #e8e8e8 !important;
      padding: 8px;
    }
    .perfil-selector optgroup {
      background-color: #0a2618 !important;
      color: #d4af37 !important;
      font-weight: bold;
    }
    .perfil-selector option:checked,
    .perfil-selector option:hover {
      background-color: #1a5c3a !important;
    }
  `;
  document.head.appendChild(style);
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function formatarMoedaObj(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return 'R$ 0,00';
  return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoedaObj(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  const limpo = valor.toString().replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

function formatarPercentual(valor) {
  if (!valor && valor !== 0) return '0,00%';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function formatarData(data) {
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR');
}

// Função para formatar input de moeda em tempo real
function formatarInputMoedaObj(input, objetivoId, campo) {
  let valor = input.value.replace(/\D/g, '');
  if (valor === '') valor = '0';
  valor = (parseInt(valor) / 100).toFixed(2);
  valor = valor.replace('.', ',');
  valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  input.value = 'R$ ' + valor;
  
  // Atualizar o objetivo
  let valorNumerico = parseMoedaObj(input.value);
  
  const objetivo = objetivos.find(o => o.id === objetivoId);
  if (objetivo) {
    // Validação para valor_inicial: não pode ser maior que saldo disponível
    if (campo === 'valor_inicial' && objetivo.tipo !== 'aposentadoria') {
      const saldoDisponivel = calcularSaldoDisponivelParaObjetivo(objetivoId);
      
      if (valorNumerico > saldoDisponivel) {
        valorNumerico = Math.max(0, saldoDisponivel);
        input.value = formatarMoedaObj(valorNumerico);
        input.style.borderColor = '#dc3545';
        setTimeout(() => {
          input.style.borderColor = 'var(--border-color)';
        }, 2000);
      }
    }
    
    objetivo[campo] = valorNumerico;
    atualizarPatrimonioObjetivos();
  }
}

// Função para atualizar displays de patrimônio em tempo real
function atualizarPatrimonioObjetivos() {
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = Math.max(0, patrimonioObjetivos - valorAlocado);
  
  // Atualizar displays
  const displayPatrimonio = document.getElementById('display-patrimonio-liquido');
  const displayAlocado = document.getElementById('display-valor-alocado');
  const displaySaldo = document.getElementById('display-saldo-disponivel');
  
  if (displayPatrimonio) displayPatrimonio.textContent = formatarMoedaObj(patrimonioObjetivos);
  if (displayAlocado) displayAlocado.textContent = formatarMoedaObj(valorAlocado);
  if (displaySaldo) {
    displaySaldo.textContent = formatarMoedaObj(saldoRestante);
    displaySaldo.style.color = saldoRestante >= 0 ? '#28a745' : '#dc3545';
  }
  
  // Atualizar disponível em cada objetivo
  document.querySelectorAll('.display-disponivel-objetivo').forEach(el => {
    el.textContent = `Disponível: ${formatarMoedaObj(saldoRestante)}`;
  });
  
  // Atualizar patrimônio destinado para aposentadoria por pessoa
  const pessoas = getPessoasDisponiveis();
  pessoas.forEach(pessoa => {
    const displayAposent = document.getElementById(`patrimonio-aposentadoria-${pessoa.id}`);
    if (displayAposent) {
      const patrimonioAposent = calcularPatrimonioPorPessoaEFinalidade(pessoa.id, 'APOSENTADORIA');
      displayAposent.textContent = formatarMoedaObj(patrimonioAposent);
    }
  });
  
  // Atualizar capital necessário das aposentadorias
  objetivos.filter(o => o.tipo === 'aposentadoria').forEach(obj => {
    const displayCapital = document.getElementById(`capital-necessario-${obj.id}`);
    if (displayCapital) {
      const rendaAnual = obj.renda_anual || 0;
      const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
      const capitalNecessario = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
      displayCapital.textContent = formatarMoedaObj(capitalNecessario);
    }
  });
}

// Obter lista de pessoas disponíveis (TODOS: cliente, cônjuges, pessoas com renda e dependentes)
function getPessoasDisponiveis() {
  const pessoas = [];
  
  // Cliente
  const nomeCliente = document.getElementById('nome_diagnostico')?.value || 'Cliente';
  const idadeCliente = parseInt(document.getElementById('idade')?.value) || 30;
  const dataNascCliente = document.getElementById('data_nascimento')?.value;
  pessoas.push({ 
    id: 'titular', 
    nome: nomeCliente, 
    tipo: 'Cliente', 
    idade: idadeCliente,
    dataNascimento: dataNascCliente
  });
  
  // Cônjuge do cliente
  const estadoCivil = document.getElementById('estado_civil')?.value;
  if (estadoCivil && ['casado', 'uniao_estavel'].includes(estadoCivil)) {
    const nomeConjuge = document.getElementById('conjuge_nome')?.value || 'Cônjuge';
    const dataNascConjuge = document.getElementById('conjuge_data_nascimento')?.value;
    const idadeConjuge = calcularIdade(dataNascConjuge);
    pessoas.push({ 
      id: 'conjuge', 
      nome: nomeConjuge, 
      tipo: 'Cônjuge do Cliente', 
      idade: idadeConjuge,
      dataNascimento: dataNascConjuge
    });
  }
  
  // Pessoas com renda
  const pessoasRenda = window.pessoasRenda || [];
  pessoasRenda.forEach((pessoa, index) => {
    const idadePessoa = calcularIdade(pessoa.data_nascimento);
    pessoas.push({ 
      id: `pessoa_${index}`, 
      nome: pessoa.nome || `Pessoa ${index + 1}`, 
      tipo: 'Pessoa com Renda',
      idade: idadePessoa,
      dataNascimento: pessoa.data_nascimento
    });
    
    // Cônjuge da pessoa com renda
    if (pessoa.estado_civil && ['casado', 'uniao_estavel'].includes(pessoa.estado_civil)) {
      const idadeConjugePessoa = calcularIdade(pessoa.conjuge_data_nascimento);
      pessoas.push({ 
        id: `pessoa_${index}_conjuge`, 
        nome: pessoa.conjuge_nome || `Cônjuge de ${pessoa.nome}`, 
        tipo: 'Cônjuge (Pessoa com Renda)',
        idade: idadeConjugePessoa,
        dataNascimento: pessoa.conjuge_data_nascimento
      });
    }
  });
  
  // Dependentes
  const dependentes = window.dependentes || [];
  dependentes.forEach((dep, index) => {
    const idadeDep = calcularIdade(dep.data_nascimento);
    pessoas.push({
      id: `dependente_${index}`,
      nome: dep.nome || `Dependente ${index + 1}`,
      tipo: 'Dependente',
      idade: idadeDep,
      dataNascimento: dep.data_nascimento
    });
  });
  
  return pessoas;
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return 30;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade || 30;
}

function getMesAniversario(dataNascimento) {
  if (!dataNascimento) return 0;
  const nascimento = new Date(dataNascimento);
  return nascimento.getMonth(); // 0-11
}

// ========================================
// CÁLCULOS DE PATRIMÔNIO
// ========================================

// Calcular patrimônio total para OBJETIVOS (apenas itens com finalidade RESERVA_OBJETIVOS)
function calcularPatrimonioParaObjetivos() {
  let total = 0;
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      if (p.finalidade === 'RESERVA_OBJETIVOS') {
        const valor = parseFloat(p.valor) || 0;
        total += valor;
      }
    });
  }
  
  return total;
}

// Calcular patrimônio por pessoa e finalidade
// Divide o valor igualmente entre os donos se houver múltiplos
function calcularPatrimonioPorPessoaEFinalidade(pessoaId, finalidade) {
  let total = 0;
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      if (p.finalidade === finalidade && p.donos && p.donos.length > 0) {
        if (p.donos.includes(pessoaId)) {
          const valor = parseFloat(p.valor) || 0;
          const qtdDonos = p.donos.length;
          total += valor / qtdDonos;
        }
      }
    });
  }
  
  return total;
}

// Calcular patrimônio para aposentadoria de uma pessoa específica
function calcularPatrimonioAposentadoriaPorPessoa(pessoaId) {
  return calcularPatrimonioPorPessoaEFinalidade(pessoaId, 'APOSENTADORIA');
}

// Calcular valor inicial já alocado em objetivos (exceto aposentadoria)
function calcularValorInicialAlocado(excluirId = null) {
  return objetivos
    .filter(obj => obj.id !== excluirId && obj.tipo !== 'aposentadoria')
    .reduce((total, obj) => total + (parseFloat(obj.valor_inicial) || 0), 0);
}

// Calcular saldo disponível para um objetivo específico
function calcularSaldoDisponivelParaObjetivo(objetivoId) {
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const valorAlocadoOutros = calcularValorInicialAlocado(objetivoId);
  return Math.max(0, patrimonioObjetivos - valorAlocadoOutros);
}

// ========================================
// CÁLCULOS DE APORTES DO FLUXO DE CAIXA
// ========================================

// Obter aportes mensais e anuais de uma pessoa do fluxo de caixa
function getAportesPessoa(pessoaId) {
  let aporteMensal = 0;
  let aporteAnual = 0;
  
  if (window.getFluxoCaixaData) {
    const fluxoData = window.getFluxoCaixaData();
    const receitas = fluxoData.receitas || [];
    
    // Filtrar receitas que são aportes/investimentos da pessoa
    receitas.forEach(r => {
      const titularReceita = r.titular || 'titular';
      if (titularReceita === pessoaId || (pessoaId === 'titular' && titularReceita === 'titular')) {
        // Verificar se é um aporte (categoria de investimento ou similar)
        const categoria = (r.categoria || '').toLowerCase();
        if (categoria.includes('aporte') || categoria.includes('investimento') || categoria.includes('poupança')) {
          const valor = parseFloat(r.valor) || 0;
          if (r.und_recorrencia === 'ano') {
            aporteAnual += valor;
          } else if (r.und_recorrencia === 'mes') {
            aporteMensal += valor;
          }
        }
      }
    });
  }
  
  return { mensal: aporteMensal, anual: aporteAnual };
}

// Obter aportes totais de múltiplas pessoas (responsáveis por um objetivo)
function getAportesResponsaveis(responsaveis) {
  let aporteMensal = 0;
  let aporteAnual = 0;
  
  (responsaveis || []).forEach(pessoaId => {
    const aportes = getAportesPessoa(pessoaId);
    aporteMensal += aportes.mensal;
    aporteAnual += aportes.anual;
  });
  
  return { mensal: aporteMensal, anual: aporteAnual };
}

// Calcular renda anual de uma pessoa
function calcularRendaAnualPessoa(pessoaId) {
  let rendaAnual = 0;
  
  if (window.getFluxoCaixaData) {
    const fluxoData = window.getFluxoCaixaData();
    const receitas = fluxoData.receitas || [];
    receitas.forEach(r => {
      const titularReceita = r.titular || 'titular';
      if (titularReceita === pessoaId || (pessoaId === 'titular' && titularReceita === 'titular')) {
        const valor = parseFloat(r.valor) || 0;
        if (r.und_recorrencia === 'ano') {
          rendaAnual += valor;
        } else if (r.und_recorrencia === 'mes') {
          rendaAnual += valor * 12;
        }
      }
    });
  }
  
  return rendaAnual;
}


// ========================================
// FUNÇÕES DE RENTABILIDADE
// ========================================

// Gerar opções de perfil de rentabilidade (atuais e 10 anos)
function gerarOpcoesPerfilRentabilidade() {
  let options = '<optgroup label="Rentabilidades Atuais" style="background-color: #0a2618; color: #d4af37;">';
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = variaveisMercado[`rent_${perfil.id}`] || (variaveisMercado.cdi * mult / 100);
    options += `<option value="${perfil.id}" style="background-color: #0d3320; color: #e8e8e8;">${perfil.nome} (${mult}% CDI = ${formatarPercentual(rent)})</option>`;
  });
  
  options += '</optgroup><optgroup label="Rentabilidades Médias 10 Anos" style="background-color: #0a2618; color: #d4af37;">';
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = variaveisMercado[`rent_${perfil.id}_10_anos`] || (variaveisMercado.cdi_aa_medio_10_anos * mult / 100);
    options += `<option value="${perfil.id}_10_anos" style="background-color: #0d3320; color: #e8e8e8;">${perfil.nome} 10a (${mult}% CDI = ${formatarPercentual(rent)})</option>`;
  });
  
  options += '</optgroup>';
  return options;
}

// Obter rentabilidade de um perfil
function getRentabilidadePerfil(perfilId) {
  if (!perfilId) return variaveisMercado.cdi || 14.65;
  
  const is10Anos = perfilId.endsWith('_10_anos');
  const perfilBase = is10Anos ? perfilId.replace('_10_anos', '') : perfilId;
  
  const chave = is10Anos ? `rent_${perfilBase}_10_anos` : `rent_${perfilBase}`;
  
  if (variaveisMercado[chave] && variaveisMercado[chave] > 0) {
    return variaveisMercado[chave];
  }
  
  const cdiBase = is10Anos ? variaveisMercado.cdi_aa_medio_10_anos : variaveisMercado.cdi;
  const mult = variaveisMercado[`mult_${perfilBase}`] || 100;
  return cdiBase * (mult / 100);
}

// ========================================
// CRUD DE OBJETIVOS
// ========================================

function addObjetivo() {
  const id = ++objetivoCounter;
  const proximaPrioridade = objetivos.filter(o => o.tipo !== 'aposentadoria').length + 1;
  
  objetivos.push({
    id: id,
    tipo: 'objetivo',
    descricao: '',
    importancia: '',
    responsaveis: ['titular'],
    prazo_tipo: 'anos',
    prazo_valor: 5,
    prazo_pessoa: 'titular',
    valor_inicial: 0,
    valor_final: 0,
    meta_acumulo: 0,
    prioridade: proximaPrioridade,
    perfil_atual: 'sem_conhecimento',
    perfil_consultoria: 'mod'
  });
  
  renderObjetivos();
}

function addObjetivoAposentadoria() {
  const id = ++objetivoCounter;
  const pessoas = getPessoasDisponiveis();
  
  const pessoasComAposentadoria = objetivos
    .filter(o => o.tipo === 'aposentadoria')
    .map(o => o.prazo_pessoa || o.responsaveis[0]);
  
  const pessoaSemAposentadoria = pessoas.find(p => !pessoasComAposentadoria.includes(p.id));
  
  if (!pessoaSemAposentadoria) {
    alert('Todos os integrantes já possuem meta de aposentadoria.');
    return;
  }
  
  const rendaAnualInicial = calcularRendaAnualPessoa(pessoaSemAposentadoria.id);
  
  objetivos.push({
    id: id,
    tipo: 'aposentadoria',
    descricao: `Aposentadoria de ${pessoaSemAposentadoria.nome}`,
    importancia: 'Garantir independência financeira na aposentadoria',
    responsaveis: [pessoaSemAposentadoria.id],
    prazo_tipo: 'idade',
    prazo_valor: 65,
    prazo_pessoa: pessoaSemAposentadoria.id,
    valor_inicial: 0,
    valor_final: 0,
    meta_acumulo: 0,
    prioridade: 0,
    renda_anual: rendaAnualInicial,
    perfil_atual: 'sem_conhecimento',
    perfil_consultoria: 'mod'
  });
  
  renderObjetivos();
}

function deleteObjetivo(id) {
  const objetivo = objetivos.find(o => o.id === id);
  
  if (objetivo && objetivo.tipo === 'aposentadoria') {
    const totalAposentadorias = objetivos.filter(o => o.tipo === 'aposentadoria').length;
    if (totalAposentadorias <= 1) {
      alert('É necessário manter pelo menos uma meta de aposentadoria.');
      return;
    }
  }
  
  objetivos = objetivos.filter(o => o.id !== id);
  
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria');
  objetivosNormais.sort((a, b) => a.prioridade - b.prioridade);
  objetivosNormais.forEach((obj, index) => {
    obj.prioridade = index + 1;
  });
  
  renderObjetivos();
}

function updateObjetivoField(id, field, value) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo) return;
  
  if (field === 'valor_inicial' || field === 'valor_final' || field === 'meta_acumulo' || field === 'renda_anual') {
    objetivo[field] = typeof value === 'number' ? value : parseMoedaObj(value);
  } else if (field === 'prazo_valor') {
    objetivo[field] = parseInt(value) || 0;
  } else if (field === 'responsaveis') {
    objetivo[field] = Array.isArray(value) ? value : [value];
  } else {
    objetivo[field] = value;
  }
  
  if (objetivo.tipo === 'aposentadoria' && field === 'prazo_pessoa') {
    const pessoas = getPessoasDisponiveis();
    const pessoa = pessoas.find(p => p.id === value);
    if (pessoa) {
      objetivo.descricao = `Aposentadoria de ${pessoa.nome}`;
      objetivo.responsaveis = [value];
      objetivo.renda_anual = calcularRendaAnualPessoa(value);
      renderObjetivos();
    }
  }
  
  if (['valor_inicial', 'valor_final', 'meta_acumulo', 'renda_anual'].includes(field)) {
    atualizarPatrimonioObjetivos();
  }
}

function updateObjetivoPrioridade(id, novaPrioridade) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo || objetivo.tipo === 'aposentadoria') return;
  
  const prioridadeAtual = objetivo.prioridade;
  novaPrioridade = parseInt(novaPrioridade);
  
  if (prioridadeAtual === novaPrioridade) return;
  
  objetivos.forEach(obj => {
    if (obj.id === id || obj.tipo === 'aposentadoria') return;
    
    if (novaPrioridade < prioridadeAtual) {
      if (obj.prioridade >= novaPrioridade && obj.prioridade < prioridadeAtual) {
        obj.prioridade++;
      }
    } else {
      if (obj.prioridade > prioridadeAtual && obj.prioridade <= novaPrioridade) {
        obj.prioridade--;
      }
    }
  });
  
  objetivo.prioridade = novaPrioridade;
  renderObjetivos();
}


// ========================================
// RENDERIZAÇÃO PRINCIPAL
// ========================================

function renderObjetivos() {
  const container = document.getElementById('objetivos-container');
  if (!container) return;
  
  if (analiseVisivel) {
    renderAnaliseObjetivos(container);
    return;
  }
  
  const pessoas = getPessoasDisponiveis();
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = Math.max(0, patrimonioObjetivos - valorAlocado);
  
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  
  if (objetivosAposentadoria.length === 0) {
    addObjetivoAposentadoria();
    return;
  }
  
  // Calcular patrimônio de aposentadoria por pessoa
  const patrimonioAposentadoriaPorPessoa = {};
  pessoas.forEach(p => {
    patrimonioAposentadoriaPorPessoa[p.id] = calcularPatrimonioAposentadoriaPorPessoa(p.id);
  });
  
  container.innerHTML = `
    <!-- Variáveis de Mercado -->
    <div style="background: var(--dark-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
      <h4 style="color: var(--accent-color); margin: 0 0 0.8rem 0; font-size: 0.9rem;">
        <i class="fas fa-chart-line"></i> Variáveis de Mercado
        ${variaveisMercado.ultima_atualizacao ? `<span style="font-size: 0.7rem; opacity: 0.7; margin-left: 0.5rem;">Atualizado: ${formatarData(variaveisMercado.ultima_atualizacao)}</span>` : ''}
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.8rem;">
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">SELIC</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.selic)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">CDI</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarPercentual(variaveisMercado.cdi)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(220, 53, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">IPCA</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #dc3545;">${formatarPercentual(variaveisMercado.ipca)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(23, 162, 184, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Rent. Anual Aposent.</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #17a2b8;">${formatarPercentual(variaveisMercado.rent_anual_aposentadoria)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(255, 193, 7, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Rent. Mensal Aposent.</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #ffc107;">${formatarPercentual(variaveisMercado.rent_mensal_aposentadoria)}</div>
        </div>
      </div>
    </div>
    
    <!-- Patrimônio Líquido -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
      <div style="text-align: center; padding: 1rem; background: var(--dark-bg); border: 2px solid var(--accent-color); border-radius: 8px;">
        <div style="font-size: 0.75rem; color: var(--text-light);">Patrimônio Líquido (exceto Aposentadoria)</div>
        <div id="display-patrimonio-liquido" style="font-size: 1.3rem; font-weight: 700; color: var(--accent-color);">${formatarMoedaObj(patrimonioObjetivos)}</div>
      </div>
      <div style="text-align: center; padding: 1rem; background: var(--dark-bg); border: 2px solid #ffc107; border-radius: 8px;">
        <div style="font-size: 0.75rem; color: var(--text-light);">Já Alocado em Objetivos</div>
        <div id="display-valor-alocado" style="font-size: 1.3rem; font-weight: 700; color: #ffc107;">${formatarMoedaObj(valorAlocado)}</div>
      </div>
      <div style="text-align: center; padding: 1rem; background: var(--dark-bg); border: 2px solid #28a745; border-radius: 8px;">
        <div style="font-size: 0.75rem; color: var(--text-light);">Saldo Disponível</div>
        <div id="display-saldo-disponivel" style="font-size: 1.3rem; font-weight: 700; color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaObj(saldoRestante)}</div>
      </div>
    </div>
    
    <!-- Patrimônio Destinado para Aposentadoria -->
    <div style="background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
      <h4 style="color: #28a745; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
        <i class="fas fa-piggy-bank"></i> Patrimônio Destinado para Aposentadoria
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
        ${pessoas.map(p => `
          <div style="text-align: center; padding: 0.8rem 1.2rem; background: rgba(40, 167, 69, 0.1); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--text-light);">${p.nome}</div>
            <div id="patrimonio-aposentadoria-${p.id}" style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(patrimonioAposentadoriaPorPessoa[p.id] || 0)}</div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Metas de Aposentadoria -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h4 style="color: #28a745; margin: 0;">
        <i class="fas fa-umbrella-beach"></i> Metas de Aposentadoria
      </h4>
      <button onclick="addObjetivoAposentadoria()" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">
        + Adicionar Aposentadoria
      </button>
    </div>
    ${objetivosAposentadoria.map(obj => renderCardAposentadoria(obj, pessoas)).join('')}
    
    <!-- Outros Objetivos -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 2rem 0 1rem 0;">
      <h4 style="color: var(--accent-color); margin: 0;">
        <i class="fas fa-bullseye"></i> Outros Objetivos
      </h4>
      <button onclick="addObjetivo()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">
        + Adicionar Objetivo
      </button>
    </div>
    ${objetivosNormais.length === 0 ? `
      <div style="text-align: center; padding: 2rem; background: var(--dark-bg); border: 1px dashed var(--border-color); border-radius: 8px; opacity: 0.7;">
        <p style="margin: 0;">Nenhum objetivo cadastrado. Clique em "+ Adicionar Objetivo" para começar.</p>
      </div>
    ` : objetivosNormais.map(obj => renderCardObjetivo(obj, pessoas, saldoRestante)).join('')}
    
    <!-- Botão Analisar -->
    <div style="text-align: center; margin-top: 2rem;">
      <button onclick="mostrarAnaliseObjetivos()" style="background: linear-gradient(135deg, var(--accent-color), #b8962e); color: var(--dark-bg); border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        <i class="fas fa-chart-bar"></i> Analisar Objetivos
      </button>
    </div>
  `;
  
  atualizarPatrimonioObjetivos();
}

function renderCardAposentadoria(obj, pessoas) {
  const pessoaSelecionada = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoaSelecionada.idade;
  const idadeAposentadoria = obj.prazo_valor || 65;
  const anosRestantes = Math.max(0, idadeAposentadoria - idadeAtual);
  const mesesRestantes = anosRestantes * 12;
  
  const rendaAnual = obj.renda_anual || 0;
  const rentAnualAposent = variaveisMercado.rent_anual_aposentadoria || 6.0;
  const capitalNecessario = rentAnualAposent > 0 ? rendaAnual / (rentAnualAposent / 100) : 0;
  const patrimonioAtual = calcularPatrimonioAposentadoriaPorPessoa(obj.prazo_pessoa);
  
  return `
    <div style="margin-bottom: 1rem; padding: 1.2rem; background: var(--dark-bg); border: 2px solid #28a745; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h5 style="color: #28a745; margin: 0;">
          <i class="fas fa-user"></i> ${pessoaSelecionada.nome}
        </h5>
        <button onclick="deleteObjetivo(${obj.id})" style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <!-- Linha 1: Pessoa, Idade Aposentadoria, Renda Anual -->
      <div style="display: grid; grid-template-columns: 1fr 150px 200px; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.75rem; color: #28a745; display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-user-check"></i> De quem é a aposentadoria? *
          </label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value)"
                  style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
            ${pessoas.map(p => `
              <option value="${p.id}" ${obj.prazo_pessoa === p.id ? 'selected' : ''}>${p.nome} (${p.tipo})</option>
            `).join('')}
          </select>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: #28a745; display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-calendar-alt"></i> Aposentar aos
          </label>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="number" value="${idadeAposentadoria}" min="30" max="100"
                   onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value)"
                   style="width: 70px; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
            <span style="color: var(--text-light);">anos</span>
          </div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: #28a745; display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-money-bill-wave"></i> Renda Anual Desejada
          </label>
          <input type="text" value="${formatarMoedaObj(rendaAnual)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'renda_anual')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
      </div>
      
      <!-- Linha 2: Resumo -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
        <div style="text-align: center;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Idade Atual</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #17a2b8;">${idadeAtual} anos</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Tempo Restante</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #ffc107;">${anosRestantes} anos</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Patrimônio Atual</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(patrimonioAtual)}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Capital Necessário</div>
          <div id="capital-necessario-${obj.id}" style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(capitalNecessario)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderCardObjetivo(obj, pessoas, saldoDisponivel) {
  const totalObjetivos = objetivos.filter(o => o.tipo !== 'aposentadoria').length;
  
  let prazoMeses = 0;
  if (obj.prazo_tipo === 'anos') {
    prazoMeses = (obj.prazo_valor || 0) * 12;
  } else {
    const pessoaRef = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
    const idadeAtual = pessoaRef.idade;
    const anosRestantes = Math.max(0, (obj.prazo_valor || 0) - idadeAtual);
    prazoMeses = anosRestantes * 12;
  }
  
  return `
    <div style="margin-bottom: 1rem; padding: 1rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px;">
      <!-- Header com prioridade -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <select onchange="updateObjetivoPrioridade(${obj.id}, this.value)" 
                  style="padding: 0.3rem; background: var(--accent-color); color: var(--dark-bg); border: none; border-radius: 4px; font-weight: 600;">
            ${Array.from({length: totalObjetivos}, (_, i) => i + 1).map(n => `
              <option value="${n}" ${obj.prioridade === n ? 'selected' : ''}>${n}º</option>
            `).join('')}
          </select>
          <span style="color: var(--accent-color); font-weight: 600;">Prioridade</span>
        </div>
        <button onclick="deleteObjetivo(${obj.id})" style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <!-- Linha 1: Descrição, Importância, Responsáveis, Prazo -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 200px 200px; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-flag"></i> Qual é o objetivo? *
          </label>
          <input type="text" value="${obj.descricao || ''}" placeholder="Ex: Comprar uma casa"
                 onchange="updateObjetivoField(${obj.id}, 'descricao', this.value)"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-heart"></i> Por que é importante?
          </label>
          <textarea onchange="updateObjetivoField(${obj.id}, 'importancia', this.value)"
                    placeholder="Descreva a importância..."
                    style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); resize: vertical; min-height: 38px;">${obj.importancia || ''}</textarea>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-users"></i> De quem é? *
          </label>
          <select multiple onchange="updateObjetivoField(${obj.id}, 'responsaveis', Array.from(this.selectedOptions).map(o => o.value))"
                  style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); min-height: 60px;">
            ${pessoas.map(p => `
              <option value="${p.id}" ${(obj.responsaveis || []).includes(p.id) ? 'selected' : ''}>${p.nome} (${p.tipo})</option>
            `).join('')}
          </select>
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.7; margin-top: 0.2rem;">Segure Ctrl/Cmd para múltiplos</div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-calendar-alt"></i> Prazo
          </label>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <select onchange="updateObjetivoField(${obj.id}, 'prazo_tipo', this.value); renderObjetivos();"
                    style="padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
              <option value="anos" ${obj.prazo_tipo === 'anos' ? 'selected' : ''}>Daqui a X anos</option>
              <option value="idade" ${obj.prazo_tipo === 'idade' ? 'selected' : ''}>Até X idade</option>
            </select>
            <input type="number" value="${obj.prazo_valor || 5}" min="1" max="100"
                   onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value); renderObjetivos();"
                   style="width: 60px; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
          </div>
          <div style="font-size: 0.7rem; color: var(--accent-color); margin-top: 0.3rem;">${prazoMeses} meses restantes</div>
        </div>
      </div>
      
      <!-- Linha 2: Valores -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-wallet"></i> Valor Inicial
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_inicial || 0)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_inicial')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
          <div class="display-disponivel-objetivo" style="font-size: 0.7rem; color: #28a745; margin-top: 0.3rem;">Disponível: ${formatarMoedaObj(saldoDisponivel)}</div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-bullseye"></i> Valor Final do Objetivo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_final || 0)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_final')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-chart-line"></i> Meta de Acúmulo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.meta_acumulo || 0)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'meta_acumulo')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
      </div>
    </div>
  `;
}


// ========================================
// ANÁLISE DE OBJETIVOS
// ========================================

function mostrarAnaliseObjetivos() {
  analiseVisivel = true;
  renderObjetivos();
}

function voltarEdicaoObjetivos() {
  analiseVisivel = false;
  renderObjetivos();
}

function renderAnaliseObjetivos(container) {
  const pessoas = getPessoasDisponiveis();
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  
  const opcoesPerfilRent = gerarOpcoesPerfilRentabilidade();
  
  container.innerHTML = `
    <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
      <button onclick="voltarEdicaoObjetivos()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">
        <i class="fas fa-arrow-left"></i> Voltar para Edição
      </button>
    </div>
    
    <!-- Análise das Metas de Aposentadoria -->
    <h4 style="color: #28a745; margin-bottom: 1rem;">
      <i class="fas fa-umbrella-beach"></i> Análise das Metas de Aposentadoria
    </h4>
    ${objetivosAposentadoria.map(obj => renderAnaliseAposentadoria(obj, pessoas, opcoesPerfilRent)).join('')}
    
    <!-- Análise dos Objetivos -->
    <h4 style="color: var(--accent-color); margin: 2rem 0 1rem 0;">
      <i class="fas fa-bullseye"></i> Análise dos Objetivos
    </h4>
    ${objetivosNormais.length === 0 ? `
      <div style="text-align: center; padding: 2rem; background: var(--dark-bg); border-radius: 8px; opacity: 0.7;">
        <p>Nenhum objetivo cadastrado para análise.</p>
      </div>
    ` : objetivosNormais.map(obj => renderAnaliseObjetivo(obj, pessoas, opcoesPerfilRent)).join('')}
    
    <!-- Resumo Geral -->
    ${renderResumoGeral(objetivosAposentadoria, objetivosNormais)}
  `;
  
  // Adicionar event listeners para os seletores de perfil
  setTimeout(() => {
    document.querySelectorAll('.perfil-selector').forEach(select => {
      select.addEventListener('change', () => {
        const objId = parseInt(select.dataset.objId);
        const tipo = select.dataset.tipo;
        const obj = objetivos.find(o => o.id === objId);
        if (obj) {
          if (tipo === 'atual') {
            obj.perfil_atual = select.value;
          } else {
            obj.perfil_consultoria = select.value;
          }
          renderAnaliseObjetivos(container);
        }
      });
    });
  }, 100);
}

function renderAnaliseAposentadoria(obj, pessoas, opcoesPerfilRent) {
  const pessoaSelecionada = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoaSelecionada.idade;
  const idadeAposentadoria = obj.prazo_valor || 65;
  const anosRestantes = Math.max(0, idadeAposentadoria - idadeAtual);
  const mesesRestantes = anosRestantes * 12;
  
  const rendaAnual = obj.renda_anual || 0;
  const rentAnualAposent = variaveisMercado.rent_anual_aposentadoria || 6.0;
  const capitalNecessario = rentAnualAposent > 0 ? rendaAnual / (rentAnualAposent / 100) : 0;
  const patrimonioAtual = calcularPatrimonioAposentadoriaPorPessoa(obj.prazo_pessoa);
  
  // Aportes do fluxo de caixa
  const aportes = getAportesPessoa(obj.prazo_pessoa);
  const aporteMensalFluxo = aportes.mensal;
  const aporteAnualFluxo = aportes.anual;
  
  // Perfis selecionados
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  // Rentabilidades
  const rentAtual = getRentabilidadePerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePerfil(perfilConsultoria);
  
  // Gerar tabelas mensais até atingir 100% da meta
  const tabelaAtual = gerarTabelaMensalCompleta(patrimonioAtual, aporteMensalFluxo, aporteAnualFluxo, rentAtual, capitalNecessario, idadeAtual, pessoaSelecionada.dataNascimento);
  const tabelaConsultoria = gerarTabelaMensalCompleta(patrimonioAtual, aporteMensalFluxo, aporteAnualFluxo, rentConsultoria, capitalNecessario, idadeAtual, pessoaSelecionada.dataNascimento);
  
  // Calcular diferença de prazo
  const mesesAtual = tabelaAtual.length;
  const mesesConsultoria = tabelaConsultoria.length;
  const diferencaMeses = mesesAtual - mesesConsultoria;
  
  return `
    <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px;">
      <h5 style="color: #28a745; margin: 0 0 1rem 0;">
        <i class="fas fa-user"></i> ${pessoaSelecionada.nome} - Aposentadoria aos ${idadeAposentadoria} anos
      </h5>
      
      <!-- Resumo -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.8rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.6rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Renda Anual</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(rendaAnual)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(40, 167, 69, 0.2); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Capital Necessário</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(capitalNecessario)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(23, 162, 184, 0.2); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Patrimônio Atual</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #17a2b8;">${formatarMoedaObj(patrimonioAtual)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(255, 193, 7, 0.2); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Aporte Mensal</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #ffc107;">${formatarMoedaObj(aporteMensalFluxo)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(108, 117, 125, 0.2); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Prazo Desejado</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #6c757d;">${anosRestantes} anos</div>
        </div>
      </div>
      
      <!-- Comparação de Cenários -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <!-- Cenário Atual -->
        <div style="padding: 1rem; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px;">
          <h6 style="color: #dc3545; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-times"></i> Cenário Atual (Sem Consultoria)
          </h6>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select class="perfil-selector" data-obj-id="${obj.id}" data-tipo="atual"
                    style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilAtual}"`, `value="${perfilAtual}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentAtual)} a.a. | IR 15%</div>
            <div style="font-size: 1rem; font-weight: 700; color: #dc3545;">Meta atingida em: ${Math.ceil(mesesAtual / 12)} anos (${mesesAtual} meses)</div>
          </div>
          ${renderTabelaMensalHTML(tabelaAtual, '#dc3545')}
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <h6 style="color: #28a745; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Cenário Com Consultoria
          </h6>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select class="perfil-selector" data-obj-id="${obj.id}" data-tipo="consultoria"
                    style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilConsultoria}"`, `value="${perfilConsultoria}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentConsultoria)} a.a. | IR 15%</div>
            <div style="font-size: 1rem; font-weight: 700; color: #28a745;">Meta atingida em: ${Math.ceil(mesesConsultoria / 12)} anos (${mesesConsultoria} meses)</div>
          </div>
          ${renderTabelaMensalHTML(tabelaConsultoria, '#28a745')}
        </div>
      </div>
      
      <!-- Comparação de Prazo -->
      ${diferencaMeses > 0 ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(40, 167, 69, 0.2); border: 2px solid #28a745; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.9rem; color: #28a745; font-weight: 600;">
            <i class="fas fa-clock"></i> Com consultoria, a meta é atingida 
            <strong>${diferencaMeses} meses (${(diferencaMeses / 12).toFixed(1)} anos)</strong> mais cedo!
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAnaliseObjetivo(obj, pessoas, opcoesPerfilRent) {
  let prazoMeses = 0;
  if (obj.prazo_tipo === 'anos') {
    prazoMeses = (obj.prazo_valor || 0) * 12;
  } else {
    const pessoaRef = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
    const idadeAtual = pessoaRef.idade;
    prazoMeses = Math.max(0, (obj.prazo_valor || 0) - idadeAtual) * 12;
  }
  
  const metaAcumulo = obj.meta_acumulo || 0;
  const valorInicial = obj.valor_inicial || 0;
  const valorFinal = obj.valor_final || 0;
  
  // Aportes do fluxo de caixa dos responsáveis
  const aportes = getAportesResponsaveis(obj.responsaveis);
  const aporteMensalFluxo = aportes.mensal;
  const aporteAnualFluxo = aportes.anual;
  
  // Perfis selecionados
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  // Rentabilidades
  const rentAtual = getRentabilidadePerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePerfil(perfilConsultoria);
  
  // IPCA para reajuste da meta
  const ipca = variaveisMercado.ipca || 5.0;
  
  // Gerar tabelas mensais até atingir 100% da meta
  const tabelaAtual = gerarTabelaMensalObjetivoCompleta(valorInicial, aporteMensalFluxo, aporteAnualFluxo, rentAtual, metaAcumulo, ipca, prazoMeses);
  const tabelaConsultoria = gerarTabelaMensalObjetivoCompleta(valorInicial, aporteMensalFluxo, aporteAnualFluxo, rentConsultoria, metaAcumulo, ipca, prazoMeses);
  
  // Calcular diferença de prazo
  const mesesAtual = tabelaAtual.length;
  const mesesConsultoria = tabelaConsultoria.length;
  const diferencaMeses = mesesAtual - mesesConsultoria;
  
  return `
    <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
        <span style="background: var(--accent-color); color: var(--dark-bg); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${obj.prioridade}º Prioridade</span>
        <h5 style="color: var(--accent-color); margin: 0;">${obj.descricao || 'Objetivo sem nome'}</h5>
      </div>
      <p style="color: var(--text-light); opacity: 0.8; margin: 0 0 1rem 0; font-size: 0.85rem;">${obj.importancia || ''}</p>
      
      <!-- Resumo -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.8rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.6rem; background: rgba(220, 53, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Valor Final</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #dc3545;">${formatarMoedaObj(valorFinal)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Meta de Acúmulo</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(metaAcumulo)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Valor Inicial</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(valorInicial)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(255, 193, 7, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Aporte Mensal</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #ffc107;">${formatarMoedaObj(aporteMensalFluxo)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(23, 162, 184, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Prazo Desejado</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #17a2b8;">${(prazoMeses / 12).toFixed(1)} anos</div>
        </div>
      </div>
      
      <!-- Comparação de Cenários -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <!-- Cenário Atual -->
        <div style="padding: 1rem; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px;">
          <h6 style="color: #dc3545; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-times"></i> Cenário Atual
          </h6>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select class="perfil-selector" data-obj-id="${obj.id}" data-tipo="atual"
                    style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilAtual}"`, `value="${perfilAtual}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentAtual)} a.a. | IR 15%</div>
            <div style="font-size: 1rem; font-weight: 700; color: #dc3545;">Meta atingida em: ${Math.ceil(mesesAtual / 12)} anos (${mesesAtual} meses)</div>
          </div>
          ${renderTabelaMensalHTML(tabelaAtual, '#dc3545')}
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <h6 style="color: #28a745; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Com Consultoria
          </h6>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select class="perfil-selector" data-obj-id="${obj.id}" data-tipo="consultoria"
                    style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilConsultoria}"`, `value="${perfilConsultoria}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentConsultoria)} a.a. | IR 15%</div>
            <div style="font-size: 1rem; font-weight: 700; color: #28a745;">Meta atingida em: ${Math.ceil(mesesConsultoria / 12)} anos (${mesesConsultoria} meses)</div>
          </div>
          ${renderTabelaMensalHTML(tabelaConsultoria, '#28a745')}
        </div>
      </div>
      
      <!-- Comparação de Prazo -->
      ${diferencaMeses > 0 ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(40, 167, 69, 0.2); border: 2px solid #28a745; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.9rem; color: #28a745; font-weight: 600;">
            <i class="fas fa-clock"></i> Com consultoria, a meta é atingida 
            <strong>${diferencaMeses} meses (${(diferencaMeses / 12).toFixed(1)} anos)</strong> mais cedo!
          </div>
        </div>
      ` : ''}
    </div>
  `;
}


// ========================================
// GERAÇÃO DE TABELAS MENSAIS
// ========================================

// Gerar tabela mensal completa para aposentadoria (continua até atingir 100%)
function gerarTabelaMensalCompleta(valorInicial, aporteMensal, aporteAnual, rentAnual, meta, idadeAtual, dataNascimento) {
  const tabela = [];
  const rentMensal = Math.pow(1 + rentAnual / 100, 1/12) - 1; // Converter anual para mensal
  const ipca = variaveisMercado.ipca || 5.0;
  const ipcaMensal = Math.pow(1 + ipca / 100, 1/12) - 1;
  
  let saldoBruto = valorInicial;
  let somaAportes = 0;
  let metaAtual = meta;
  let mes = 0;
  const dataInicial = new Date();
  const mesAniversario = getMesAniversario(dataNascimento);
  let idadeCorrente = idadeAtual;
  
  const maxMeses = 1200; // Limite de 100 anos
  
  while (mes < maxMeses) {
    mes++;
    
    // Calcular data estimada
    const dataEstimada = new Date(dataInicial);
    dataEstimada.setMonth(dataEstimada.getMonth() + mes);
    
    // Verificar se é mês de aniversário para atualizar idade
    if (dataEstimada.getMonth() === mesAniversario && mes > 1) {
      idadeCorrente++;
    }
    
    // Aporte do mês (mensal + anual a cada 12 meses)
    let aporteMes = aporteMensal;
    if (mes % 12 === 0) {
      aporteMes += aporteAnual;
    }
    somaAportes += aporteMes;
    
    // Saldo anterior + aporte
    const saldoComAporte = saldoBruto + aporteMes;
    
    // Rentabilidade do mês
    const rendimento = saldoComAporte * rentMensal;
    saldoBruto = saldoComAporte + rendimento;
    
    // IR = 15% sobre o lucro (saldo bruto - valor inicial - soma aportes)
    const lucro = Math.max(0, saldoBruto - valorInicial - somaAportes);
    const ir = lucro * 0.15;
    
    // Saldo líquido
    const saldoLiquido = saldoBruto - ir;
    
    // Atualizar meta pelo IPCA a cada 12 meses
    if (mes % 12 === 0) {
      metaAtual = metaAtual * (1 + ipca / 100);
    }
    
    // Percentual da meta
    const percentMeta = metaAtual > 0 ? (saldoLiquido / metaAtual) * 100 : 0;
    
    tabela.push({
      mes: mes,
      dataEstimada: dataEstimada,
      idade: idadeCorrente,
      aporte: aporteMes,
      saldoBruto: saldoBruto,
      ir: ir,
      saldoLiquido: saldoLiquido,
      meta: metaAtual,
      percentMeta: percentMeta
    });
    
    // Parar quando atingir 100% da meta
    if (percentMeta >= 100) {
      break;
    }
  }
  
  return tabela;
}

// Gerar tabela mensal completa para objetivos (com prazo desejado como referência)
function gerarTabelaMensalObjetivoCompleta(valorInicial, aporteMensal, aporteAnual, rentAnual, meta, ipca, prazoDesejado) {
  const tabela = [];
  const rentMensal = Math.pow(1 + rentAnual / 100, 1/12) - 1;
  
  let saldoBruto = valorInicial;
  let somaAportes = 0;
  let metaAtual = meta;
  let mes = 0;
  const dataInicial = new Date();
  
  const maxMeses = 1200; // Limite de 100 anos
  
  while (mes < maxMeses) {
    mes++;
    
    // Calcular data estimada
    const dataEstimada = new Date(dataInicial);
    dataEstimada.setMonth(dataEstimada.getMonth() + mes);
    
    // Aporte do mês (mensal + anual a cada 12 meses)
    let aporteMes = aporteMensal;
    if (mes % 12 === 0) {
      aporteMes += aporteAnual;
    }
    somaAportes += aporteMes;
    
    // Saldo anterior + aporte
    const saldoComAporte = saldoBruto + aporteMes;
    
    // Rentabilidade do mês
    const rendimento = saldoComAporte * rentMensal;
    saldoBruto = saldoComAporte + rendimento;
    
    // IR = 15% sobre o lucro
    const lucro = Math.max(0, saldoBruto - valorInicial - somaAportes);
    const ir = lucro * 0.15;
    
    // Saldo líquido
    const saldoLiquido = saldoBruto - ir;
    
    // Atualizar meta pelo IPCA a cada 12 meses
    if (mes % 12 === 0) {
      metaAtual = metaAtual * (1 + ipca / 100);
    }
    
    // Percentual da meta
    const percentMeta = metaAtual > 0 ? (saldoLiquido / metaAtual) * 100 : 0;
    
    tabela.push({
      mes: mes,
      dataEstimada: dataEstimada,
      idade: null, // Não usado para objetivos normais
      aporte: aporteMes,
      saldoBruto: saldoBruto,
      ir: ir,
      saldoLiquido: saldoLiquido,
      meta: metaAtual,
      percentMeta: percentMeta
    });
    
    // Parar quando atingir 100% da meta
    if (percentMeta >= 100) {
      break;
    }
  }
  
  return tabela;
}

// Renderizar tabela mensal em HTML
function renderTabelaMensalHTML(tabela, corPrincipal) {
  if (tabela.length === 0) {
    return '<p style="text-align: center; color: var(--text-light);">Sem dados para exibir</p>';
  }
  
  // Mostrar últimas 10 linhas com scroll
  const linhasExibir = tabela.slice(-20);
  
  return `
    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
        <thead style="position: sticky; top: 0; background: var(--dark-bg);">
          <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 0.4rem; text-align: left; color: ${corPrincipal};">Mês</th>
            ${tabela[0].idade !== null ? '<th style="padding: 0.4rem; text-align: center; color: var(--text-light);">Idade</th>' : ''}
            <th style="padding: 0.4rem; text-align: right; color: var(--text-light);">Aporte</th>
            <th style="padding: 0.4rem; text-align: right; color: var(--text-light);">Saldo Bruto</th>
            <th style="padding: 0.4rem; text-align: right; color: #dc3545;">IR</th>
            <th style="padding: 0.4rem; text-align: right; color: #28a745;">Líquido</th>
            <th style="padding: 0.4rem; text-align: right; color: var(--accent-color);">Meta</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corPrincipal};">%</th>
          </tr>
        </thead>
        <tbody>
          ${linhasExibir.map(linha => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 0.3rem 0.4rem;">
                <div style="color: ${corPrincipal};">Mês ${linha.mes}</div>
                <div style="font-size: 0.6rem; color: var(--text-light); opacity: 0.7;">(${formatarData(linha.dataEstimada)})</div>
              </td>
              ${linha.idade !== null ? `<td style="padding: 0.3rem 0.4rem; text-align: center; color: var(--text-light);">${linha.idade} anos</td>` : ''}
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: #ffc107;">${formatarMoedaObj(linha.aporte)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: var(--text-light);">${formatarMoedaObj(linha.saldoBruto)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: #dc3545;">${formatarMoedaObj(linha.ir)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: #28a745;">${formatarMoedaObj(linha.saldoLiquido)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: var(--accent-color);">${formatarMoedaObj(linha.meta)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: ${linha.percentMeta >= 100 ? '#28a745' : corPrincipal}; font-weight: ${linha.percentMeta >= 100 ? '700' : '400'};">${linha.percentMeta.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="text-align: center; margin-top: 0.5rem; font-size: 0.7rem; color: var(--text-light); opacity: 0.7;">
      Mostrando últimas ${linhasExibir.length} de ${tabela.length} linhas. Role para ver mais.
    </div>
  `;
}

// ========================================
// RESUMO GERAL
// ========================================

function renderResumoGeral(objetivosAposentadoria, objetivosNormais) {
  // Calcular totais
  let totalMetaAposentadoria = 0;
  let totalPatrimonioAposentadoria = 0;
  
  objetivosAposentadoria.forEach(obj => {
    const rendaAnual = obj.renda_anual || 0;
    const rentAnualAposent = variaveisMercado.rent_anual_aposentadoria || 6.0;
    const capitalNecessario = rentAnualAposent > 0 ? rendaAnual / (rentAnualAposent / 100) : 0;
    totalMetaAposentadoria += capitalNecessario;
    totalPatrimonioAposentadoria += calcularPatrimonioAposentadoriaPorPessoa(obj.prazo_pessoa);
  });
  
  let totalMetaObjetivos = 0;
  let totalValorInicialObjetivos = 0;
  
  objetivosNormais.forEach(obj => {
    totalMetaObjetivos += obj.meta_acumulo || 0;
    totalValorInicialObjetivos += obj.valor_inicial || 0;
  });
  
  const percentAposentadoria = totalMetaAposentadoria > 0 ? (totalPatrimonioAposentadoria / totalMetaAposentadoria) * 100 : 0;
  const percentObjetivos = totalMetaObjetivos > 0 ? (totalValorInicialObjetivos / totalMetaObjetivos) * 100 : 0;
  
  return `
    <div style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(40, 167, 69, 0.1)); border: 2px solid var(--accent-color); border-radius: 12px;">
      <h4 style="color: var(--accent-color); margin: 0 0 1.5rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> Resumo Geral
      </h4>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <!-- Aposentadoria -->
        <div style="text-align: center;">
          <h5 style="color: #28a745; margin: 0 0 1rem 0;">Aposentadoria</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-light);">Meta Total</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(totalMetaAposentadoria)}</div>
            </div>
            <div style="padding: 1rem; background: rgba(23, 162, 184, 0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-light);">Patrimônio Atual</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: #17a2b8;">${formatarMoedaObj(totalPatrimonioAposentadoria)}</div>
            </div>
          </div>
          <div style="margin-top: 1rem; padding: 0.5rem; background: rgba(212, 175, 55, 0.2); border-radius: 6px;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Progresso: <strong style="color: var(--accent-color);">${percentAposentadoria.toFixed(1)}%</strong></div>
          </div>
        </div>
        
        <!-- Objetivos -->
        <div style="text-align: center;">
          <h5 style="color: var(--accent-color); margin: 0 0 1rem 0;">Outros Objetivos</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="padding: 1rem; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-light);">Meta Total</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-color);">${formatarMoedaObj(totalMetaObjetivos)}</div>
            </div>
            <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-light);">Valor Inicial Alocado</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(totalValorInicialObjetivos)}</div>
            </div>
          </div>
          <div style="margin-top: 1rem; padding: 0.5rem; background: rgba(212, 175, 55, 0.2); border-radius: 6px;">
            <div style="font-size: 0.8rem; color: var(--text-light);">Progresso: <strong style="color: var(--accent-color);">${percentObjetivos.toFixed(1)}%</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// FUNÇÕES DE DADOS (GET/SET)
// ========================================

function getObjetivosData() {
  return objetivos;
}

function setObjetivosData(data) {
  if (Array.isArray(data)) {
    objetivos = data;
    objetivoCounter = Math.max(0, ...objetivos.map(o => o.id || 0));
    renderObjetivos();
  }
}

// Inicializar módulo
document.addEventListener('DOMContentLoaded', initObjetivosModule);

export { getObjetivosData, setObjetivosData, renderObjetivos };
