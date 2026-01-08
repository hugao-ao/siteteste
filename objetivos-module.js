// ========================================
// MÓDULO DE OBJETIVOS - VERSÃO 3.0
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
  console.log('Módulo de Objetivos v3.0 carregado');
  
  // Carregar variáveis de mercado
  await carregarVariaveisMercado();
  
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

// Função para formatar input de moeda em tempo real
function formatarInputMoedaObj(input, objetivoId, campo) {
  // Salvar posição do cursor
  const cursorPos = input.selectionStart;
  const valorAnterior = input.value;
  
  let valor = input.value.replace(/\D/g, '');
  if (valor === '') valor = '0';
  valor = (parseInt(valor) / 100).toFixed(2);
  valor = valor.replace('.', ',');
  valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  input.value = 'R$ ' + valor;
  
  // Atualizar o objetivo
  const valorNumerico = parseMoedaObj(input.value);
  
  // Atualizar objetivo sem re-renderizar
  const objetivo = objetivos.find(o => o.id === objetivoId);
  if (objetivo) {
    objetivo[campo] = valorNumerico;
    
    // Atualizar displays de patrimônio em tempo real
    atualizarPatrimonioObjetivos();
  }
}

// Função para atualizar displays de patrimônio em tempo real
function atualizarPatrimonioObjetivos() {
  const patrimonio = calcularPatrimonioLiquido();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = patrimonio.excetoAposentadoria - valorAlocado;
  
  // Atualizar displays
  const displayPatrimonio = document.getElementById('display-patrimonio-liquido');
  const displayAlocado = document.getElementById('display-valor-alocado');
  const displaySaldo = document.getElementById('display-saldo-disponivel');
  
  if (displayPatrimonio) displayPatrimonio.textContent = formatarMoedaObj(patrimonio.excetoAposentadoria);
  if (displayAlocado) displayAlocado.textContent = formatarMoedaObj(valorAlocado);
  if (displaySaldo) {
    displaySaldo.textContent = formatarMoedaObj(saldoRestante);
    displaySaldo.style.color = saldoRestante >= 0 ? '#28a745' : '#dc3545';
  }
  
  // Atualizar disponível em cada objetivo
  document.querySelectorAll('.display-disponivel-objetivo').forEach(el => {
    el.textContent = `Disponível: ${formatarMoedaObj(Math.max(0, saldoRestante))}`;
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

// Calcular patrimônio líquido (exceto aposentadoria)
function calcularPatrimonioLiquido() {
  let patrimonioTotal = 0;
  let patrimonioAposentadoria = 0;
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      const valor = parseFloat(p.valor) || 0;
      patrimonioTotal += valor;
      
      if (p.finalidade === 'aposentadoria' || p.finalidade === 'Aposentadoria') {
        patrimonioAposentadoria += valor;
      }
    });
  }
  
  return {
    total: patrimonioTotal,
    aposentadoria: patrimonioAposentadoria,
    excetoAposentadoria: patrimonioTotal - patrimonioAposentadoria
  };
}

// Calcular patrimônio destinado para aposentadoria por pessoa
function calcularPatrimonioAposentadoriaPorPessoa(pessoaId) {
  let patrimonioAposentadoria = 0;
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      if ((p.finalidade === 'aposentadoria' || p.finalidade === 'Aposentadoria') && 
          p.donos && p.donos.includes(pessoaId)) {
        const valor = parseFloat(p.valor) || 0;
        const qtdDonos = p.donos.length || 1;
        patrimonioAposentadoria += valor / qtdDonos;
      }
    });
  }
  
  return patrimonioAposentadoria;
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

// Calcular saldo disponível para objetivos
function calcularSaldoParaObjetivos() {
  const patrimonio = calcularPatrimonioLiquido();
  return patrimonio.excetoAposentadoria;
}

// Calcular valor inicial já alocado
function calcularValorInicialAlocado(excluirId = null) {
  return objetivos
    .filter(obj => obj.id !== excluirId && obj.tipo !== 'aposentadoria')
    .reduce((total, obj) => total + (parseFloat(obj.valor_inicial) || 0), 0);
}

// Gerar opções de perfil de rentabilidade (atuais e 10 anos)
function gerarOpcoesPerfilRentabilidade() {
  let options = '<optgroup label="Rentabilidades Atuais">';
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = variaveisMercado[`rent_${perfil.id}`] || (variaveisMercado.cdi * mult / 100);
    options += `<option value="${perfil.id}">${perfil.nome} (${mult}% CDI = ${formatarPercentual(rent)})</option>`;
  });
  
  options += '</optgroup><optgroup label="Rentabilidades Médias 10 Anos">';
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = variaveisMercado[`rent_${perfil.id}_10_anos`] || (variaveisMercado.cdi_aa_medio_10_anos * mult / 100);
    options += `<option value="${perfil.id}_10_anos">${perfil.nome} 10a (${mult}% CDI = ${formatarPercentual(rent)})</option>`;
  });
  
  options += '</optgroup>';
  return options;
}

// Obter rentabilidade de um perfil
function getRentabilidadePerfil(perfilId) {
  if (!perfilId) return variaveisMercado.cdi || 14.65;
  
  // Verificar se é perfil de 10 anos
  const is10Anos = perfilId.endsWith('_10_anos');
  const perfilBase = is10Anos ? perfilId.replace('_10_anos', '') : perfilId;
  
  const chave = is10Anos ? `rent_${perfilBase}_10_anos` : `rent_${perfilBase}`;
  
  if (variaveisMercado[chave] && variaveisMercado[chave] > 0) {
    return variaveisMercado[chave];
  }
  
  // Calcular baseado no multiplicador
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
  
  // Verificar se já existe aposentadoria para cada pessoa
  const pessoasComAposentadoria = objetivos
    .filter(o => o.tipo === 'aposentadoria')
    .map(o => o.prazo_pessoa || o.responsaveis[0]);
  
  // Encontrar primeira pessoa sem aposentadoria
  const pessoaSemAposentadoria = pessoas.find(p => !pessoasComAposentadoria.includes(p.id));
  
  if (!pessoaSemAposentadoria) {
    alert('Todos os integrantes já possuem meta de aposentadoria.');
    return;
  }
  
  // Calcular renda anual inicial da pessoa
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
  
  // Reordenar prioridades
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
  
  // Se mudou a pessoa em aposentadoria, atualizar descrição e renda
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
  
  // Atualizar patrimônio em tempo real
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
  const patrimonio = calcularPatrimonioLiquido();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = patrimonio.excetoAposentadoria - valorAlocado;
  
  // Separar objetivos por tipo
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  
  // Garantir pelo menos uma aposentadoria
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
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; font-size: 0.95rem;">
        <i class="fas fa-chart-line"></i> Variáveis de Mercado
        ${variaveisMercado.ultima_atualizacao ? `<span style="font-size: 0.75rem; font-weight: normal; opacity: 0.7; margin-left: 1rem;">Última atualização: ${new Date(variaveisMercado.ultima_atualizacao).toLocaleString('pt-BR')}</span>` : ''}
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.6rem;">
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.8;">SELIC (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.selic)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.8;">CDI (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.cdi)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.8;">CDI Médio 10a (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.cdi_aa_medio_10_anos)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.8;">IPCA (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.ipca)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.8;">IPCA Médio 10a (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.ipca_aa_medio_10_anos)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(40, 167, 69, 0.2); border: 1px solid #28a745; border-radius: 6px;">
          <div style="font-size: 0.65rem; color: #28a745; opacity: 0.9;">Rent Anual Aposent. (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: #28a745;">${formatarPercentual(variaveisMercado.rent_anual_aposentadoria)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(40, 167, 69, 0.2); border: 1px solid #28a745; border-radius: 6px;">
          <div style="font-size: 0.65rem; color: #28a745; opacity: 0.9;">Rent Mensal Aposent. (%)</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: #28a745;">${formatarPercentual(variaveisMercado.rent_mensal_aposentadoria)}</div>
        </div>
      </div>
    </div>
    
    <!-- Saldo para Objetivos -->
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--dark-bg); border: 2px solid ${saldoRestante >= 0 ? '#28a745' : '#dc3545'}; border-radius: 8px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Patrimônio Líquido (exceto Aposentadoria)</div>
          <div id="display-patrimonio-liquido" style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(patrimonio.excetoAposentadoria)}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Já Alocado em Objetivos</div>
          <div id="display-valor-alocado" style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(valorAlocado)}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Saldo Disponível</div>
          <div id="display-saldo-disponivel" style="font-size: 1.1rem; font-weight: 600; color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaObj(saldoRestante)}</div>
        </div>
      </div>
    </div>
    
    <!-- Patrimônio Destinado para Aposentadoria -->
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px;">
      <h4 style="color: #28a745; margin: 0 0 1rem 0; font-size: 0.9rem;">
        <i class="fas fa-piggy-bank"></i> Patrimônio Destinado para Aposentadoria
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
        ${pessoas.map(p => {
          const patrimonioAposent = patrimonioAposentadoriaPorPessoa[p.id] || 0;
          return `
            <div style="text-align: center; padding: 0.5rem 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px; min-width: 120px;">
              <div style="font-size: 0.7rem; color: var(--text-light); opacity: 0.8;">${p.nome}</div>
              <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(patrimonioAposent)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    
    <!-- Metas de Aposentadoria -->
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="color: #28a745; margin: 0; font-size: 0.95rem;">
          <i class="fas fa-umbrella-beach"></i> Metas de Aposentadoria
        </h4>
        <button onclick="addObjetivoAposentadoria()" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          + Adicionar Aposentadoria
        </button>
      </div>
      ${objetivosAposentadoria.map(obj => renderCardAposentadoria(obj, pessoas, patrimonioAposentadoriaPorPessoa)).join('')}
    </div>
    
    <!-- Outros Objetivos -->
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="color: var(--accent-color); margin: 0; font-size: 0.95rem;">
          <i class="fas fa-bullseye"></i> Outros Objetivos
        </h4>
        <button onclick="addObjetivo()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          + Adicionar Objetivo
        </button>
      </div>
      ${objetivosNormais.length === 0 ? `
        <div style="text-align: center; padding: 2rem; background: var(--dark-bg); border-radius: 8px; opacity: 0.7;">
          <i class="fas fa-flag" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
          <p>Nenhum objetivo cadastrado. Clique em "Adicionar Objetivo" para começar.</p>
        </div>
      ` : objetivosNormais.map(obj => renderCardObjetivo(obj, pessoas, saldoRestante)).join('')}
    </div>
    
    <!-- Botão Analisar -->
    <div style="text-align: center; margin-top: 2rem;">
      <button onclick="mostrarAnaliseObjetivos()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        <i class="fas fa-chart-bar"></i> ANALISAR OBJETIVOS
      </button>
    </div>
  `;
}



// ========================================
// RENDERIZAÇÃO DE CARDS
// ========================================

function renderCardAposentadoria(obj, pessoas, patrimonioAposentadoriaPorPessoa) {
  const pessoaSelecionada = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoaSelecionada.idade;
  const idadeAposentadoria = obj.prazo_valor || 65;
  const anosRestantes = Math.max(0, idadeAposentadoria - idadeAtual);
  const mesesRestantes = anosRestantes * 12;
  
  const rendaAnual = obj.renda_anual || 0;
  const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
  const capitalNecessario = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
  const patrimonioAtual = patrimonioAposentadoriaPorPessoa[obj.prazo_pessoa] || 0;
  
  return `
    <div style="margin-bottom: 1rem; padding: 1rem; background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h5 style="color: #28a745; margin: 0; font-size: 0.9rem;">
          <i class="fas fa-umbrella-beach"></i> Meta de Aposentadoria
        </h5>
        ${objetivos.filter(o => o.tipo === 'aposentadoria').length > 1 ? `
          <button onclick="deleteObjetivo(${obj.id})" style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <!-- De quem é -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-user"></i> De quem é? *
          </label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value)" 
                  style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
            ${pessoas.map(p => `
              <option value="${p.id}" ${obj.prazo_pessoa === p.id ? 'selected' : ''}>${p.nome} (${p.tipo})</option>
            `).join('')}
          </select>
        </div>
        
        <!-- Aposentar com quantos anos -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-calendar"></i> Aposentar com quantos anos
          </label>
          <input type="number" value="${obj.prazo_valor}" min="40" max="100"
                 onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value); renderObjetivos();"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <!-- Renda Anual Atual -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-money-bill-wave"></i> Renda Anual Atual
          </label>
          <input type="text" value="${formatarMoedaObj(rendaAnual)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'renda_anual')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid #28a745; border-radius: 4px; color: #28a745;">
        </div>
        
        <!-- Capital Necessário -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-piggy-bank"></i> Capital Necessário
          </label>
          <div id="capital-necessario-${obj.id}" style="padding: 0.5rem; background: rgba(40, 167, 69, 0.2); border: 1px solid #28a745; border-radius: 4px; color: #28a745; font-weight: 600;">
            ${formatarMoedaObj(capitalNecessario)}
          </div>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
        <div style="font-size: 0.8rem; color: var(--text-light);">
          <i class="fas fa-clock"></i> Idade atual: <strong>${idadeAtual} anos</strong>
        </div>
        <div style="font-size: 0.8rem; color: var(--accent-color);">
          <i class="fas fa-hourglass-half"></i> Tempo restante: <strong>${anosRestantes} anos e ${mesesRestantes % 12} meses</strong>
        </div>
      </div>
    </div>
  `;
}

function renderCardObjetivo(obj, pessoas, saldoDisponivel) {
  const totalObjetivos = objetivos.filter(o => o.tipo !== 'aposentadoria').length;
  
  // Calcular prazo em meses
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
        <!-- Descrição -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-flag"></i> Qual é o objetivo? *
          </label>
          <input type="text" value="${obj.descricao || ''}" placeholder="Ex: Comprar uma casa"
                 onchange="updateObjetivoField(${obj.id}, 'descricao', this.value)"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <!-- Importância -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-heart"></i> Por que é importante?
          </label>
          <textarea onchange="updateObjetivoField(${obj.id}, 'importancia', this.value)"
                    placeholder="Descreva a importância..."
                    style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); resize: vertical; min-height: 38px;">${obj.importancia || ''}</textarea>
        </div>
        
        <!-- Responsáveis -->
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
        
        <!-- Prazo -->
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
        <!-- Valor Inicial -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-wallet"></i> Valor Inicial
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_inicial || 0)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_inicial')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
          <div class="display-disponivel-objetivo" style="font-size: 0.7rem; color: #28a745; margin-top: 0.3rem;">Disponível: ${formatarMoedaObj(Math.max(0, saldoDisponivel))}</div>
        </div>
        
        <!-- Valor Final -->
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-bullseye"></i> Valor Final do Objetivo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_final || 0)}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_final')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <!-- Meta de Acúmulo -->
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
  
  // Perfis selecionados
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  // Rentabilidades
  const rentAtual = getRentabilidadePerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePerfil(perfilConsultoria);
  const rentMensalAtual = Math.pow(1 + rentAtual / 100, 1/12) - 1;
  const rentMensalConsultoria = Math.pow(1 + rentConsultoria / 100, 1/12) - 1;
  
  // Calcular aportes necessários
  const metaFinal = capitalNecessario;
  const valorInicial = patrimonioAtual;
  
  const aporteAtual = calcularAporteMensal(valorInicial, metaFinal, mesesRestantes, rentMensalAtual);
  const aporteConsultoria = calcularAporteMensal(valorInicial, metaFinal, mesesRestantes, rentMensalConsultoria);
  
  // Gerar tabelas mensais
  const tabelaAtual = gerarTabelaMensal(valorInicial, aporteAtual, mesesRestantes, rentMensalAtual, metaFinal, idadeAtual);
  const tabelaConsultoria = gerarTabelaMensal(valorInicial, aporteConsultoria, mesesRestantes, rentMensalConsultoria, metaFinal, idadeAtual);
  
  return `
    <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px;">
      <h5 style="color: #28a745; margin: 0 0 1rem 0;">
        <i class="fas fa-user"></i> ${pessoaSelecionada.nome} - Aposentadoria aos ${idadeAposentadoria} anos
      </h5>
      
      <!-- Resumo -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.8rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Renda Anual Atual</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(rendaAnual)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(40, 167, 69, 0.2); border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Capital Necessário</div>
          <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(capitalNecessario)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(23, 162, 184, 0.2); border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Patrimônio Atual</div>
          <div style="font-size: 1rem; font-weight: 600; color: #17a2b8;">${formatarMoedaObj(patrimonioAtual)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(255, 193, 7, 0.2); border-radius: 6px;">
          <div style="font-size: 0.7rem; color: var(--text-light);">Tempo Restante</div>
          <div style="font-size: 1rem; font-weight: 600; color: #ffc107;">${anosRestantes} anos</div>
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
                    style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilAtual}"`, `value="${perfilAtual}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentAtual)} a.a.</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #dc3545;">Aporte: ${formatarMoedaObj(aporteAtual)}/mês</div>
          </div>
          ${renderTabelaMensal(tabelaAtual, '#dc3545')}
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <h6 style="color: #28a745; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Cenário Com Consultoria
          </h6>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select class="perfil-selector" data-obj-id="${obj.id}" data-tipo="consultoria"
                    style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilConsultoria}"`, `value="${perfilConsultoria}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentConsultoria)} a.a.</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #28a745;">Aporte: ${formatarMoedaObj(aporteConsultoria)}/mês</div>
          </div>
          ${renderTabelaMensal(tabelaConsultoria, '#28a745')}
        </div>
      </div>
      
      <!-- Economia -->
      ${aporteAtual > aporteConsultoria ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(40, 167, 69, 0.2); border: 2px solid #28a745; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.9rem; color: #28a745; font-weight: 600;">
            <i class="fas fa-piggy-bank"></i> Economia com Consultoria: 
            <strong>${formatarMoedaObj(aporteAtual - aporteConsultoria)}/mês</strong> | 
            <strong>${formatarMoedaObj((aporteAtual - aporteConsultoria) * 12)}/ano</strong>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAnaliseObjetivo(obj, pessoas, opcoesPerfilRent) {
  // Calcular prazo em meses
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
  
  // Perfis selecionados
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  // Rentabilidades
  const rentAtual = getRentabilidadePerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePerfil(perfilConsultoria);
  const rentMensalAtual = Math.pow(1 + rentAtual / 100, 1/12) - 1;
  const rentMensalConsultoria = Math.pow(1 + rentConsultoria / 100, 1/12) - 1;
  
  // IPCA para reajuste da meta
  const ipca = variaveisMercado.ipca || 5.0;
  const ipcaMensal = Math.pow(1 + ipca / 100, 1/12) - 1;
  const metaReajustada = metaAcumulo * Math.pow(1 + ipcaMensal, prazoMeses);
  
  // Calcular aportes necessários
  const aporteAtual = calcularAporteMensal(valorInicial, metaReajustada, prazoMeses, rentMensalAtual);
  const aporteConsultoria = calcularAporteMensal(valorInicial, metaReajustada, prazoMeses, rentMensalConsultoria);
  
  // Gerar tabelas mensais
  const tabelaAtual = gerarTabelaMensalObjetivo(valorInicial, aporteAtual, prazoMeses, rentMensalAtual, metaAcumulo, ipcaMensal);
  const tabelaConsultoria = gerarTabelaMensalObjetivo(valorInicial, aporteConsultoria, prazoMeses, rentMensalConsultoria, metaAcumulo, ipcaMensal);
  
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
        <div style="text-align: center; padding: 0.6rem; background: rgba(255, 193, 7, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Meta Reajustada (IPCA)</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #ffc107;">${formatarMoedaObj(metaReajustada)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Valor Inicial</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(valorInicial)}</div>
        </div>
        <div style="text-align: center; padding: 0.6rem; background: rgba(23, 162, 184, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Prazo</div>
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
                    style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilAtual}"`, `value="${perfilAtual}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentAtual)} a.a. | IR 15%</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #dc3545;">Aporte: ${formatarMoedaObj(aporteAtual)}/mês</div>
          </div>
          ${renderTabelaMensalObjetivo(tabelaAtual, '#dc3545')}
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <h6 style="color: #28a745; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Com Consultoria
          </h6>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select class="perfil-selector" data-obj-id="${obj.id}" data-tipo="consultoria"
                    style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); margin-top: 0.3rem;">
              ${opcoesPerfilRent.replace(`value="${perfilConsultoria}"`, `value="${perfilConsultoria}" selected`)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${formatarPercentual(rentConsultoria)} a.a. | IR 15%</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #28a745;">Aporte: ${formatarMoedaObj(aporteConsultoria)}/mês</div>
          </div>
          ${renderTabelaMensalObjetivo(tabelaConsultoria, '#28a745')}
        </div>
      </div>
      
      <!-- Economia -->
      ${aporteAtual > aporteConsultoria ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(40, 167, 69, 0.2); border: 2px solid #28a745; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.9rem; color: #28a745; font-weight: 600;">
            <i class="fas fa-piggy-bank"></i> Economia: 
            <strong>${formatarMoedaObj(aporteAtual - aporteConsultoria)}/mês</strong> | 
            <strong>${formatarMoedaObj((aporteAtual - aporteConsultoria) * 12)}/ano</strong>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}



// ========================================
// FUNÇÕES DE CÁLCULO E TABELAS
// ========================================

function calcularAporteMensal(valorInicial, metaFinal, meses, taxaMensal) {
  if (meses <= 0) return 0;
  if (taxaMensal <= 0) return (metaFinal - valorInicial) / meses;
  
  // PMT = (VF - VP * (1+i)^n) * i / ((1+i)^n - 1)
  const fator = Math.pow(1 + taxaMensal, meses);
  const valorFuturoInicial = valorInicial * fator;
  const diferenca = metaFinal - valorFuturoInicial;
  
  if (diferenca <= 0) return 0; // Já tem o suficiente
  
  const aporte = diferenca * taxaMensal / (fator - 1);
  return Math.max(0, aporte);
}

function gerarTabelaMensal(valorInicial, aporteMensal, totalMeses, taxaMensal, metaFinal, idadeInicial) {
  const linhas = [];
  let saldo = valorInicial;
  
  for (let mes = 0; mes <= totalMeses; mes++) {
    const idadeAtual = idadeInicial + Math.floor(mes / 12);
    const rendimento = mes > 0 ? saldo * taxaMensal : 0;
    const aporte = mes > 0 ? aporteMensal : 0;
    const ir = rendimento * 0.15;
    saldo = saldo + rendimento - ir + aporte;
    
    linhas.push({
      mes,
      idade: idadeAtual,
      saldoBruto: saldo + ir,
      aporte,
      ir,
      meta: metaFinal,
      saldoLiquido: saldo,
      percentMeta: metaFinal > 0 ? (saldo / metaFinal) * 100 : 0
    });
  }
  
  return linhas;
}

function gerarTabelaMensalObjetivo(valorInicial, aporteMensal, totalMeses, taxaMensal, metaBase, ipcaMensal) {
  const linhas = [];
  let saldo = valorInicial;
  
  for (let mes = 0; mes <= totalMeses; mes++) {
    const metaReajustada = metaBase * Math.pow(1 + ipcaMensal, mes);
    const rendimento = mes > 0 ? saldo * taxaMensal : 0;
    const aporte = mes > 0 ? aporteMensal : 0;
    const ir = rendimento * 0.15;
    saldo = saldo + rendimento - ir + aporte;
    
    linhas.push({
      mes,
      saldoBruto: saldo + ir,
      aporte,
      ir,
      metaReajustada,
      saldoLiquido: saldo,
      percentMeta: metaReajustada > 0 ? (saldo / metaReajustada) * 100 : 0
    });
  }
  
  return linhas;
}

function renderTabelaMensal(linhas, cor) {
  return `
    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
        <thead style="position: sticky; top: 0; background: var(--card-bg);">
          <tr>
            <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid var(--border-color);">MÊS</th>
            <th style="padding: 0.4rem; text-align: center; border-bottom: 1px solid var(--border-color);">IDADE</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">SALDO BRUTO</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">APORTE</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">IR (15%)</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">META</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">% META</th>
          </tr>
        </thead>
        <tbody>
          ${linhas.map((l, i) => `
            <tr style="background: ${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
              <td style="padding: 0.3rem 0.4rem;">Mês ${l.mes}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: center;">${l.idade} anos</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: ${cor};">${formatarMoedaObj(l.saldoBruto)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right;">${formatarMoedaObj(l.aporte)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: #dc3545;">${formatarMoedaObj(l.ir)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right;">${formatarMoedaObj(l.meta)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: ${l.percentMeta >= 100 ? '#28a745' : cor};">${l.percentMeta.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabelaMensalObjetivo(linhas, cor) {
  return `
    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
        <thead style="position: sticky; top: 0; background: var(--card-bg);">
          <tr>
            <th style="padding: 0.4rem; text-align: left; border-bottom: 1px solid var(--border-color);">MÊS</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">SALDO BRUTO</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">APORTE</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">IR (15%)</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">META AJUST.</th>
            <th style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color);">% META</th>
          </tr>
        </thead>
        <tbody>
          ${linhas.map((l, i) => `
            <tr style="background: ${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
              <td style="padding: 0.3rem 0.4rem;">Mês ${l.mes}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: ${cor};">${formatarMoedaObj(l.saldoBruto)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right;">${formatarMoedaObj(l.aporte)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: #dc3545;">${formatarMoedaObj(l.ir)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right;">${formatarMoedaObj(l.metaReajustada)}</td>
              <td style="padding: 0.3rem 0.4rem; text-align: right; color: ${l.percentMeta >= 100 ? '#28a745' : cor};">${l.percentMeta.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderResumoGeral(objetivosAposentadoria, objetivosNormais) {
  // Calcular totais para cenário atual
  let totalAporteAtualAposent = 0;
  let totalAporteConsultoriaAposent = 0;
  
  objetivosAposentadoria.forEach(obj => {
    const pessoaId = obj.prazo_pessoa || obj.responsaveis[0];
    const pessoas = getPessoasDisponiveis();
    const pessoa = pessoas.find(p => p.id === pessoaId);
    const idadeAtual = pessoa ? pessoa.idade : 30;
    const anosRestantes = Math.max(0, (obj.prazo_valor || 65) - idadeAtual);
    const mesesRestantes = anosRestantes * 12;
    
    const rendaAnual = obj.renda_anual || 0;
    const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
    const capitalNecessario = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
    const patrimonioAtual = calcularPatrimonioAposentadoriaPorPessoa(pessoaId);
    
    const rentAtual = getRentabilidadePerfil(obj.perfil_atual || 'sem_conhecimento');
    const rentConsultoria = getRentabilidadePerfil(obj.perfil_consultoria || 'mod');
    const rentMensalAtual = Math.pow(1 + rentAtual / 100, 1/12) - 1;
    const rentMensalConsultoria = Math.pow(1 + rentConsultoria / 100, 1/12) - 1;
    
    totalAporteAtualAposent += calcularAporteMensal(patrimonioAtual, capitalNecessario, mesesRestantes, rentMensalAtual);
    totalAporteConsultoriaAposent += calcularAporteMensal(patrimonioAtual, capitalNecessario, mesesRestantes, rentMensalConsultoria);
  });
  
  let totalAporteAtualObj = 0;
  let totalAporteConsultoriaObj = 0;
  
  objetivosNormais.forEach(obj => {
    const pessoas = getPessoasDisponiveis();
    let prazoMeses = 0;
    if (obj.prazo_tipo === 'anos') {
      prazoMeses = (obj.prazo_valor || 0) * 12;
    } else {
      const pessoaRef = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
      prazoMeses = Math.max(0, (obj.prazo_valor || 0) - pessoaRef.idade) * 12;
    }
    
    const metaAcumulo = obj.meta_acumulo || 0;
    const valorInicial = obj.valor_inicial || 0;
    const ipca = variaveisMercado.ipca || 5.0;
    const ipcaMensal = Math.pow(1 + ipca / 100, 1/12) - 1;
    const metaReajustada = metaAcumulo * Math.pow(1 + ipcaMensal, prazoMeses);
    
    const rentAtual = getRentabilidadePerfil(obj.perfil_atual || 'sem_conhecimento');
    const rentConsultoria = getRentabilidadePerfil(obj.perfil_consultoria || 'mod');
    const rentMensalAtual = Math.pow(1 + rentAtual / 100, 1/12) - 1;
    const rentMensalConsultoria = Math.pow(1 + rentConsultoria / 100, 1/12) - 1;
    
    totalAporteAtualObj += calcularAporteMensal(valorInicial, metaReajustada, prazoMeses, rentMensalAtual);
    totalAporteConsultoriaObj += calcularAporteMensal(valorInicial, metaReajustada, prazoMeses, rentMensalConsultoria);
  });
  
  const totalAtual = totalAporteAtualAposent + totalAporteAtualObj;
  const totalConsultoria = totalAporteConsultoriaAposent + totalAporteConsultoriaObj;
  const economia = totalAtual - totalConsultoria;
  
  return `
    <div style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(212, 175, 55, 0.2)); border: 2px solid var(--accent-color); border-radius: 12px;">
      <h4 style="color: var(--accent-color); margin: 0 0 1.5rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> RESUMO GERAL DOS OBJETIVOS
      </h4>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 1.5rem;">
        <!-- Cenário Atual -->
        <div style="padding: 1rem; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px;">
          <h5 style="color: #dc3545; margin: 0 0 1rem 0; text-align: center;">Cenário Atual</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: center;">
            <div>
              <div style="font-size: 0.7rem; color: var(--text-light);">Aportes Aposentadoria</div>
              <div style="font-size: 1rem; font-weight: 600; color: #dc3545;">${formatarMoedaObj(totalAporteAtualAposent)}/mês</div>
            </div>
            <div>
              <div style="font-size: 0.7rem; color: var(--text-light);">Aportes Objetivos</div>
              <div style="font-size: 1rem; font-weight: 600; color: #dc3545;">${formatarMoedaObj(totalAporteAtualObj)}/mês</div>
            </div>
          </div>
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #dc3545; text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light);">TOTAL DE APORTES</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #dc3545;">${formatarMoedaObj(totalAtual)}/mês</div>
          </div>
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <h5 style="color: #28a745; margin: 0 0 1rem 0; text-align: center;">Com Consultoria</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: center;">
            <div>
              <div style="font-size: 0.7rem; color: var(--text-light);">Aportes Aposentadoria</div>
              <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(totalAporteConsultoriaAposent)}/mês</div>
            </div>
            <div>
              <div style="font-size: 0.7rem; color: var(--text-light);">Aportes Objetivos</div>
              <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(totalAporteConsultoriaObj)}/mês</div>
            </div>
          </div>
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #28a745; text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light);">TOTAL DE APORTES</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(totalConsultoria)}/mês</div>
          </div>
        </div>
      </div>
      
      <!-- Economia Total -->
      ${economia > 0 ? `
        <div style="padding: 1.5rem; background: rgba(40, 167, 69, 0.3); border: 2px solid #28a745; border-radius: 8px; text-align: center;">
          <div style="font-size: 1rem; color: #28a745; margin-bottom: 0.5rem;">
            <i class="fas fa-piggy-bank"></i> ECONOMIA TOTAL COM CONSULTORIA
          </div>
          <div style="display: flex; justify-content: center; gap: 3rem;">
            <div>
              <div style="font-size: 0.8rem; color: var(--text-light);">Por Mês</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(economia)}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: var(--text-light);">Por Ano</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(economia * 12)}</div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ========================================
// FUNÇÕES DE DADOS
// ========================================

function getObjetivosData() {
  return {
    objetivos: objetivos,
    counter: objetivoCounter
  };
}

function setObjetivosData(data) {
  if (!data) return;
  
  if (data.objetivos && Array.isArray(data.objetivos)) {
    objetivos = data.objetivos;
  }
  if (data.counter) {
    objetivoCounter = data.counter;
  }
  
  // Garantir que o counter seja maior que o maior ID
  const maxId = objetivos.reduce((max, obj) => Math.max(max, obj.id || 0), 0);
  if (objetivoCounter < maxId) {
    objetivoCounter = maxId;
  }
  
  renderObjetivos();
}

// ========================================
// INICIALIZAÇÃO
// ========================================

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initObjetivosModule);
} else {
  initObjetivosModule();
}

export { getObjetivosData, setObjetivosData, renderObjetivos };
