// ========================================
// MÓDULO DE OBJETIVOS - VERSÃO 2.0
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
  // Rentabilidades dos 9 perfis (7 originais + 2 novos)
  rent_sem_conhecimento: 0, // 80% CDI
  rent_iniciante: 0, // 95% CDI
  rent_ultra_cons: 0, // 97% CDI
  rent_cons: 0, // 100% CDI
  rent_cons_mod: 0, // 103% CDI
  rent_mod: 0, // 108% CDI
  rent_mod_arro: 0, // 115% CDI
  rent_arro: 0, // 125% CDI
  rent_ultra_arro: 0, // 140% CDI
  ultima_atualizacao: null
};

// Perfis de rentabilidade disponíveis
const PERFIS_RENTABILIDADE = [
  { id: 'sem_conhecimento', nome: 'Sem Conhecimento', percentCDI: 80 },
  { id: 'iniciante', nome: 'Iniciante', percentCDI: 95 },
  { id: 'ultra_cons', nome: 'Ultra-Conservador', percentCDI: 97 },
  { id: 'cons', nome: 'Conservador', percentCDI: 100 },
  { id: 'cons_mod', nome: 'Conservador-Moderado', percentCDI: 103 },
  { id: 'mod', nome: 'Moderado', percentCDI: 108 },
  { id: 'mod_arro', nome: 'Moderado-Arrojado', percentCDI: 115 },
  { id: 'arro', nome: 'Arrojado', percentCDI: 125 },
  { id: 'ultra_arro', nome: 'Ultra-Arrojado', percentCDI: 140 }
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
      // Os valores já estão em percentual no banco (ex: 14.75 para 14,75%)
      variaveisMercado = {
        selic: parseFloat(data.selic) || 14.75,
        cdi_120_meses: parseFloat(data.cdi_120_meses) || 142.59,
        ipca: parseFloat(data.ipca) || 5.44,
        ipca_120_meses: parseFloat(data.ipca_120_meses) || 70.88,
        cdi: parseFloat(data.cdi) || 14.65,
        cdi_aa_medio_10_anos: parseFloat(data.cdi_aa_medio_10_anos) || 9.2666,
        ipca_aa_medio_10_anos: parseFloat(data.ipca_aa_medio_10_anos) || 5.504,
        rent_anual_aposentadoria: parseFloat(data.rent_anual_aposentadoria) || 6.0,
        rent_mensal_aposentadoria: parseFloat(data.rent_mensal_aposentadoria) || 0.4868,
        // Rentabilidades dos perfis (carregadas ou calculadas)
        rent_sem_conhecimento: parseFloat(data.rent_sem_conhecimento) || (parseFloat(data.cdi) || 14.65) * 0.80,
        rent_iniciante: parseFloat(data.rent_iniciante) || (parseFloat(data.cdi) || 14.65) * 0.95,
        rent_ultra_cons: parseFloat(data.rent_ultra_cons) || (parseFloat(data.cdi) || 14.65) * 0.97,
        rent_cons: parseFloat(data.rent_cons) || (parseFloat(data.cdi) || 14.65) * 1.00,
        rent_cons_mod: parseFloat(data.rent_cons_mod) || (parseFloat(data.cdi) || 14.65) * 1.03,
        rent_mod: parseFloat(data.rent_mod) || (parseFloat(data.cdi) || 14.65) * 1.08,
        rent_mod_arro: parseFloat(data.rent_mod_arro) || (parseFloat(data.cdi) || 14.65) * 1.15,
        rent_arro: parseFloat(data.rent_arro) || (parseFloat(data.cdi) || 14.65) * 1.25,
        rent_ultra_arro: parseFloat(data.rent_ultra_arro) || (parseFloat(data.cdi) || 14.65) * 1.40,
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
  console.log('Módulo de Objetivos carregado');
  
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
  window.formatarInputMoeda = formatarInputMoeda;
  
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
function formatarInputMoeda(input, objetivoId, campo) {
  let valor = input.value.replace(/\D/g, '');
  valor = (parseInt(valor) / 100).toFixed(2);
  valor = valor.replace('.', ',');
  valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  input.value = 'R$ ' + valor;
  
  // Atualizar o objetivo
  const valorNumerico = parseMoedaObj(input.value);
  updateObjetivoField(objetivoId, campo, valorNumerico);
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
      tipo: 'Cônjuge', 
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

// Obter rentabilidade de um perfil
function getRentabilidadePerfil(perfilId) {
  const cdi = variaveisMercado.cdi || 14.65;
  const perfil = PERFIS_RENTABILIDADE.find(p => p.id === perfilId);
  if (!perfil) return cdi;
  
  // Verificar se existe valor salvo no banco
  const chave = `rent_${perfilId}`;
  if (variaveisMercado[chave] && variaveisMercado[chave] > 0) {
    return variaveisMercado[chave];
  }
  
  // Calcular baseado no percentual do CDI
  return cdi * (perfil.percentCDI / 100);
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
    prazo_tipo: 'anos', // 'anos' ou 'idade'
    prazo_valor: 5,
    prazo_pessoa: 'titular', // pessoa de referência para idade
    valor_inicial: 0,
    valor_final: 0,
    meta_acumulo: 0,
    prioridade: proximaPrioridade,
    perfil_atual: 'sem_conhecimento', // Perfil do cliente atual
    perfil_consultoria: 'mod' // Perfil com consultoria
  });
  
  renderObjetivos();
}

function addObjetivoAposentadoria() {
  const id = ++objetivoCounter;
  const pessoas = getPessoasDisponiveis();
  
  // Verificar se já existe aposentadoria para cada pessoa
  const pessoasComAposentadoria = objetivos
    .filter(o => o.tipo === 'aposentadoria')
    .map(o => o.responsaveis[0]);
  
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
    renda_anual: rendaAnualInicial, // Renda anual editável
    perfil_atual: 'sem_conhecimento',
    perfil_consultoria: 'mod'
  });
  
  renderObjetivos();
}

function deleteObjetivo(id) {
  const objetivo = objetivos.find(o => o.id === id);
  
  // Verificar se é o último objetivo de aposentadoria
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
  
  // Se mudou o prazo_pessoa em aposentadoria, atualizar descrição e renda
  if (objetivo.tipo === 'aposentadoria' && field === 'prazo_pessoa') {
    const pessoas = getPessoasDisponiveis();
    const pessoa = pessoas.find(p => p.id === value);
    if (pessoa) {
      objetivo.descricao = `Aposentadoria de ${pessoa.nome}`;
      objetivo.responsaveis = [value];
      // Atualizar renda anual com o valor da pessoa selecionada
      objetivo.renda_anual = calcularRendaAnualPessoa(value);
    }
  }
  
  // Não re-renderizar para campos de texto (evitar perder foco)
  if (!['descricao', 'importancia'].includes(field)) {
    // Apenas atualizar valores calculados sem re-renderizar completamente
  }
}

function updateObjetivoPrioridade(id, novaPrioridade) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo || objetivo.tipo === 'aposentadoria') return;
  
  const prioridadeAtual = objetivo.prioridade;
  novaPrioridade = parseInt(novaPrioridade);
  
  if (prioridadeAtual === novaPrioridade) return;
  
  // Reordenar outros objetivos
  objetivos.forEach(obj => {
    if (obj.id === id || obj.tipo === 'aposentadoria') return;
    
    if (novaPrioridade < prioridadeAtual) {
      // Movendo para cima
      if (obj.prioridade >= novaPrioridade && obj.prioridade < prioridadeAtual) {
        obj.prioridade++;
      }
    } else {
      // Movendo para baixo
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
  objetivosAposentadoria.forEach(obj => {
    const pessoaId = obj.prazo_pessoa || obj.responsaveis[0];
    patrimonioAposentadoriaPorPessoa[pessoaId] = calcularPatrimonioAposentadoriaPorPessoa(pessoaId);
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
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Patrimônio Líquido (exceto Aposentadoria)</div>
          <div style="font-size: 1.3rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(patrimonio.excetoAposentadoria)}</div>
        </div>
        <div>
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Já Alocado em Objetivos</div>
          <div style="font-size: 1.3rem; font-weight: 600; color: #ffc107;">${formatarMoedaObj(valorAlocado)}</div>
        </div>
        <div>
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Saldo Disponível</div>
          <div style="font-size: 1.3rem; font-weight: 600; color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaObj(saldoRestante)}</div>
        </div>
      </div>
      ${saldoRestante < 0 ? `<div style="margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem; text-align: center;"><i class="fas fa-exclamation-triangle"></i> O valor alocado excede o saldo disponível!</div>` : ''}
    </div>
    
    <!-- Patrimônio destinado para Aposentadoria por pessoa -->
    ${objetivosAposentadoria.length > 0 ? `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px;">
      <h5 style="color: #28a745; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
        <i class="fas fa-piggy-bank"></i> Patrimônio Destinado para Aposentadoria
      </h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.8rem;">
        ${objetivosAposentadoria.map(obj => {
          const pessoaId = obj.prazo_pessoa || obj.responsaveis[0];
          const pessoa = pessoas.find(p => p.id === pessoaId);
          const patrimonioAposent = patrimonioAposentadoriaPorPessoa[pessoaId] || 0;
          return `
            <div style="text-align: center; padding: 0.6rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
              <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">${pessoa?.nome || 'Pessoa'}</div>
              <div style="font-size: 1.1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(patrimonioAposent)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- Metas de Aposentadoria -->
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="color: #28a745; margin: 0;">
          <i class="fas fa-umbrella-beach"></i> Metas de Aposentadoria
        </h4>
        <button onclick="addObjetivoAposentadoria()" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          <i class="fas fa-plus"></i> Adicionar Aposentadoria
        </button>
      </div>
      ${objetivosAposentadoria.map(obj => renderCardAposentadoria(obj, pessoas)).join('')}
    </div>
    
    <!-- Outros Objetivos -->
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="color: var(--accent-color); margin: 0;">
          <i class="fas fa-bullseye"></i> Outros Objetivos
        </h4>
        <button onclick="addObjetivo()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          <i class="fas fa-plus"></i> Adicionar Objetivo
        </button>
      </div>
      ${objetivosNormais.length === 0 ? `
        <div style="text-align: center; padding: 2rem; color: var(--text-light); opacity: 0.7;">
          <i class="fas fa-flag" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
          <p>Nenhum objetivo cadastrado. Clique em "Adicionar Objetivo" para começar.</p>
        </div>
      ` : objetivosNormais.map(obj => renderCardObjetivo(obj, pessoas, objetivosNormais.length, saldoRestante)).join('')}
    </div>
    
    <!-- Botão de Análise -->
    <div style="text-align: center; margin-top: 2rem;">
      <button onclick="mostrarAnaliseObjetivos()" style="background: linear-gradient(135deg, var(--accent-color), #c9a227); color: var(--dark-bg); border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        <i class="fas fa-calculator"></i> ANALISAR OBJETIVOS
      </button>
    </div>
  `;
}


// ========================================
// RENDERIZAÇÃO DE CARDS
// ========================================

function renderCardAposentadoria(obj, pessoas) {
  const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoa?.idade || 30;
  
  // Usar renda anual editável ou calcular
  const rendaAnual = obj.renda_anual !== undefined ? obj.renda_anual : calcularRendaAnualPessoa(obj.prazo_pessoa);
  
  // Capital necessário = Renda anual / Rent Anual Aposentadoria (em decimal)
  const rentAnualDecimal = variaveisMercado.rent_anual_aposentadoria / 100;
  const capitalNecessario = rentAnualDecimal > 0 ? rendaAnual / rentAnualDecimal : 0;
  
  // Calcular meses até a aposentadoria
  let mesesRestantes = 0;
  if (obj.prazo_tipo === 'idade') {
    const anosAteAposentadoria = obj.prazo_valor - idadeAtual;
    mesesRestantes = Math.max(0, anosAteAposentadoria * 12);
  } else {
    mesesRestantes = obj.prazo_valor * 12;
  }
  
  const anosRestantes = Math.floor(mesesRestantes / 12);
  const mesesRestantesResto = mesesRestantes % 12;
  
  const totalAposentadorias = objetivos.filter(o => o.tipo === 'aposentadoria').length;
  
  return `
    <div style="background: var(--card-bg); border: 2px solid #28a745; border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-umbrella-beach" style="color: #28a745; font-size: 1.2rem;"></i>
          <span style="font-weight: 600; color: #28a745;">Meta de Aposentadoria</span>
        </div>
        ${totalAposentadorias > 1 ? `
          <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 1rem;" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
        <!-- De quem é -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-user"></i> De quem é *
          </label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value); renderObjetivos();" 
                  style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
            ${pessoas.map(p => `<option value="${p.id}" ${obj.prazo_pessoa === p.id ? 'selected' : ''}>${p.nome} (${p.tipo})</option>`).join('')}
          </select>
        </div>
        
        <!-- Prazo -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-calendar"></i> Aposentar com quantos anos
          </label>
          <input type="number" value="${obj.prazo_valor}" min="1" max="100"
                 onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value); renderObjetivos();"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
        </div>
        
        <!-- Renda Anual Atual (editável) -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-money-bill-wave"></i> Renda Anual Atual
          </label>
          <input type="text" value="${formatarMoedaObj(rendaAnual)}" 
                 id="renda_anual_${obj.id}"
                 oninput="formatarInputMoeda(this, ${obj.id}, 'renda_anual')"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid #28a745; border-radius: 6px; color: #28a745;">
        </div>
        
        <!-- Capital Necessário (calculado) -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-coins"></i> Capital Necessário
          </label>
          <input type="text" value="${formatarMoedaObj(capitalNecessario)}" disabled readonly
                 style="width: 100%; padding: 0.6rem; background: rgba(212, 175, 55, 0.2); border: 1px solid var(--accent-color); border-radius: 6px; color: var(--accent-color); font-weight: 600;">
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid var(--border-color);">
        <div style="font-size: 0.85rem; color: var(--text-light);">
          <i class="fas fa-clock"></i> Idade atual: <strong>${idadeAtual} anos</strong>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-light);">
          <i class="fas fa-hourglass-half"></i> Tempo restante: <strong>${anosRestantes} anos e ${mesesRestantesResto} meses</strong>
        </div>
      </div>
    </div>
  `;
}

function renderCardObjetivo(obj, pessoas, totalObjetivos, saldoRestante) {
  // Calcular meses restantes
  const pessoaSelecionada = pessoas.find(p => obj.responsaveis.includes(p.id)) || pessoas[0];
  const idadeAtual = pessoaSelecionada?.idade || 30;
  
  let mesesRestantes = 0;
  if (obj.prazo_tipo === 'idade') {
    mesesRestantes = Math.max(1, (obj.prazo_valor - idadeAtual) * 12);
  } else {
    mesesRestantes = Math.max(1, obj.prazo_valor * 12);
  }
  
  // Opções de prioridade
  const prioridadeOptions = Array.from({length: totalObjetivos}, (_, i) => i + 1)
    .map(p => `<option value="${p}" ${obj.prioridade === p ? 'selected' : ''}>${p}º</option>`)
    .join('');
  
  return `
    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <select onchange="updateObjetivoPrioridade(${obj.id}, this.value)"
                  style="padding: 0.3rem 0.5rem; background: var(--accent-color); color: var(--dark-bg); border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
            ${prioridadeOptions}
          </select>
          <span style="font-weight: 600; color: var(--accent-color);">Prioridade</span>
        </div>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 1rem;" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <div style="display: grid; grid-template-columns: 2fr 2fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <!-- Qual é o objetivo -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-flag"></i> Qual é o objetivo? *
          </label>
          <input type="text" value="${obj.descricao || ''}" placeholder="Ex: Comprar um carro..."
                 onchange="updateObjetivoField(${obj.id}, 'descricao', this.value)"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
        </div>
        
        <!-- Por que é importante -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-heart"></i> Por que é importante?
          </label>
          <textarea onchange="updateObjetivoField(${obj.id}, 'importancia', this.value)"
                    placeholder="Descreva a importância..."
                    style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light); min-height: 38px; resize: vertical;">${obj.importancia || ''}</textarea>
        </div>
        
        <!-- De quem é -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-users"></i> De quem é? *
          </label>
          <select multiple onchange="updateObjetivoField(${obj.id}, 'responsaveis', Array.from(this.selectedOptions).map(o => o.value))"
                  style="width: 100%; padding: 0.4rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light); min-height: 70px; font-size: 0.8rem;">
            ${pessoas.map(p => `<option value="${p.id}" ${obj.responsaveis.includes(p.id) ? 'selected' : ''}>${p.nome} (${p.tipo})</option>`).join('')}
          </select>
          <small style="color: var(--text-light); opacity: 0.7; font-size: 0.65rem;">Ctrl/Cmd para múltiplos</small>
        </div>
        
        <!-- Prazo -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-calendar"></i> Prazo
          </label>
          <div style="display: flex; gap: 0.3rem; margin-bottom: 0.3rem;">
            <select onchange="updateObjetivoField(${obj.id}, 'prazo_tipo', this.value); renderObjetivos();"
                    style="flex: 1; padding: 0.4rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light); font-size: 0.8rem;">
              <option value="anos" ${obj.prazo_tipo === 'anos' ? 'selected' : ''}>Daqui a X anos</option>
              <option value="idade" ${obj.prazo_tipo === 'idade' ? 'selected' : ''}>Até X idade</option>
            </select>
            <input type="number" value="${obj.prazo_valor}" min="1" max="100"
                   onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value); renderObjetivos();"
                   style="width: 50px; padding: 0.4rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light); font-size: 0.8rem;">
          </div>
          <small style="color: var(--text-light); opacity: 0.7; font-size: 0.7rem;">${mesesRestantes} meses restantes</small>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
        <!-- Valor Inicial -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-wallet"></i> Valor Inicial
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_inicial)}"
                 id="valor_inicial_${obj.id}"
                 oninput="formatarInputMoeda(this, ${obj.id}, 'valor_inicial')"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
          <small style="color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'}; font-size: 0.7rem;">Disponível: ${formatarMoedaObj(saldoRestante + (parseFloat(obj.valor_inicial) || 0))}</small>
        </div>
        
        <!-- Valor Final -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-tag"></i> Valor Final do Objetivo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_final)}"
                 id="valor_final_${obj.id}"
                 oninput="formatarInputMoeda(this, ${obj.id}, 'valor_final')"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
        </div>
        
        <!-- Meta de Acúmulo -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-bullseye"></i> Meta de Acúmulo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.meta_acumulo)}"
                 id="meta_acumulo_${obj.id}"
                 oninput="formatarInputMoeda(this, ${obj.id}, 'meta_acumulo')"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
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
  
  // Separar objetivos
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  
  container.innerHTML = `
    <div style="text-align: right; margin-bottom: 1rem;">
      <button onclick="voltarEdicaoObjetivos()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer;">
        <i class="fas fa-arrow-left"></i> Voltar para Edição
      </button>
    </div>
    
    <!-- Análise de Aposentadorias -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #28a745; margin: 0 0 1rem 0;">
        <i class="fas fa-umbrella-beach"></i> Análise das Metas de Aposentadoria
      </h4>
      ${objetivosAposentadoria.map(obj => renderAnaliseAposentadoria(obj, pessoas)).join('')}
    </div>
    
    <!-- Análise de Outros Objetivos -->
    ${objetivosNormais.length > 0 ? `
      <div style="margin-bottom: 2rem;">
        <h4 style="color: var(--accent-color); margin: 0 0 1rem 0;">
          <i class="fas fa-bullseye"></i> Análise dos Objetivos
        </h4>
        ${objetivosNormais.map(obj => renderAnaliseObjetivo(obj, pessoas)).join('')}
      </div>
    ` : ''}
    
    <!-- Resumo Geral -->
    ${renderResumoGeralObjetivos(objetivosAposentadoria, objetivosNormais, pessoas)}
  `;
}

function renderAnaliseAposentadoria(obj, pessoas) {
  const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoa?.idade || 30;
  
  // Usar renda anual editável
  const rendaAnual = obj.renda_anual !== undefined ? obj.renda_anual : calcularRendaAnualPessoa(obj.prazo_pessoa);
  
  // Capital necessário usando Rent Anual Aposentadoria
  const rentAnualDecimal = variaveisMercado.rent_anual_aposentadoria / 100;
  const capitalNecessario = rentAnualDecimal > 0 ? rendaAnual / rentAnualDecimal : 0;
  
  // Meses restantes
  const anosAteAposentadoria = obj.prazo_valor - idadeAtual;
  const mesesRestantes = Math.max(1, anosAteAposentadoria * 12);
  
  // Patrimônio atual para aposentadoria
  const patrimonioAposentadoria = calcularPatrimonioAposentadoriaPorPessoa(obj.prazo_pessoa);
  
  // Rendimento mensal para cálculo de aporte
  const rendimentoMensal = variaveisMercado.rent_mensal_aposentadoria / 100;
  
  // Calcular aporte mensal necessário (PMT)
  const fv = capitalNecessario;
  const pv = patrimonioAposentadoria;
  const r = rendimentoMensal;
  const n = mesesRestantes;
  
  let aporteMensal = 0;
  if (r > 0 && n > 0) {
    const fator = Math.pow(1 + r, n);
    aporteMensal = (fv - pv * fator) * r / (fator - 1);
    if (aporteMensal < 0) aporteMensal = 0;
  }
  
  // Gerar tabela mensal (primeiros 5 meses visíveis, resto com scroll)
  const tabelaMensal = gerarTabelaMensalAposentadoria(pv, aporteMensal, r, n, capitalNecessario, idadeAtual);
  
  return `
    <div style="background: var(--card-bg); border: 2px solid #28a745; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
      <h5 style="color: #28a745; margin: 0 0 1rem 0;">
        <i class="fas fa-user"></i> ${pessoa?.nome || 'Pessoa'} - Aposentadoria aos ${obj.prazo_valor} anos
      </h5>
      
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
          <div style="font-size: 0.8rem; color: var(--text-light); opacity: 0.8;">Renda Anual Atual</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(rendaAnual)}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
          <div style="font-size: 0.8rem; color: var(--text-light); opacity: 0.8;">Capital Necessário</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(capitalNecessario)}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
          <div style="font-size: 0.8rem; color: var(--text-light); opacity: 0.8;">Patrimônio Atual</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #007bff;">${formatarMoedaObj(patrimonioAposentadoria)}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
          <div style="font-size: 0.8rem; color: var(--text-light); opacity: 0.8;">Tempo Restante</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #ffc107;">${anosAteAposentadoria} anos</div>
        </div>
      </div>
      
      <div style="padding: 1rem; background: var(--dark-bg); border-radius: 8px; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Rendimento considerado (Rent Anual Aposentadoria)</div>
            <div style="font-size: 0.9rem; color: var(--text-light);">${formatarPercentual(variaveisMercado.rent_anual_aposentadoria)} a.a. (${formatarPercentual(variaveisMercado.rent_mensal_aposentadoria)} a.m.)</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Aporte Mensal Necessário</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: ${aporteMensal > 0 ? 'var(--accent-color)' : '#28a745'};">${formatarMoedaObj(aporteMensal)}</div>
          </div>
        </div>
      </div>
      
      <!-- Tabela Mensal com Scroll -->
      ${tabelaMensal}
    </div>
  `;
}

function gerarTabelaMensalAposentadoria(patrimonioInicial, aporteMensal, rendimentoMensal, totalMeses, meta, idadeInicial) {
  let saldo = patrimonioInicial;
  const linhas = [];
  
  for (let mes = 0; mes <= totalMeses; mes++) {
    if (mes > 0) {
      const rendimento = saldo * rendimentoMensal;
      const imposto = rendimento * 0.15; // IR 15%
      saldo = saldo + rendimento - imposto + aporteMensal;
    }
    
    const percentualMeta = meta > 0 ? (saldo / meta) * 100 : 0;
    const ano = Math.floor(mes / 12);
    const mesDoAno = mes % 12;
    const idade = idadeInicial + ano;
    
    linhas.push({
      mes,
      ano,
      mesDoAno,
      idade,
      saldoBruto: saldo,
      aporte: mes > 0 ? aporteMensal : 0,
      imposto: mes > 0 ? (saldo * rendimentoMensal * 0.15) : 0,
      meta,
      percentualMeta
    });
  }
  
  return `
    <div style="margin-top: 1rem;">
      <h6 style="color: var(--text-light); margin: 0 0 0.5rem 0; font-size: 0.85rem;">
        <i class="fas fa-table"></i> Evolução Mensal do Patrimônio
      </h6>
      <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
          <thead style="position: sticky; top: 0; background: rgba(212, 175, 55, 0.3);">
            <tr>
              <th style="padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">Mês</th>
              <th style="padding: 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">Idade</th>
              <th style="padding: 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">Saldo Bruto</th>
              <th style="padding: 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">Aporte</th>
              <th style="padding: 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">IR (15%)</th>
              <th style="padding: 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">Meta</th>
              <th style="padding: 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">% Meta</th>
            </tr>
          </thead>
          <tbody>
            ${linhas.map((l, idx) => `
              <tr style="background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)'};">
                <td style="padding: 0.4rem; border-bottom: 1px solid var(--border-color);">Mês ${l.mes}</td>
                <td style="padding: 0.4rem; text-align: center; border-bottom: 1px solid var(--border-color);">${l.idade} anos</td>
                <td style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--accent-color);">${formatarMoedaObj(l.saldoBruto)}</td>
                <td style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color); color: #28a745;">${formatarMoedaObj(l.aporte)}</td>
                <td style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaObj(l.imposto)}</td>
                <td style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaObj(l.meta)}</td>
                <td style="padding: 0.4rem; text-align: right; border-bottom: 1px solid var(--border-color); color: ${l.percentualMeta >= 100 ? '#28a745' : '#ffc107'};">${l.percentualMeta.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAnaliseObjetivo(obj, pessoas) {
  const pessoaSelecionada = pessoas.find(p => obj.responsaveis.includes(p.id)) || pessoas[0];
  const idadeAtual = pessoaSelecionada?.idade || 30;
  
  // Calcular meses restantes
  let mesesRestantes = 0;
  if (obj.prazo_tipo === 'idade') {
    mesesRestantes = Math.max(1, (obj.prazo_valor - idadeAtual) * 12);
  } else {
    mesesRestantes = Math.max(1, obj.prazo_valor * 12);
  }
  
  const anosRestantes = mesesRestantes / 12;
  
  // Meta reajustada pelo IPCA
  const ipcaAnual = variaveisMercado.ipca / 100;
  const metaReajustada = obj.meta_acumulo * Math.pow(1 + ipcaAnual, anosRestantes);
  
  const valorInicial = parseFloat(obj.valor_inicial) || 0;
  
  // Perfis de rentabilidade para comparação
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  const rentAtual = getRentabilidadePerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePerfil(perfilConsultoria);
  
  // Calcular aportes para ambos os cenários
  const calcularAporte = (rentAnual) => {
    const r = Math.pow(1 + rentAnual / 100, 1/12) - 1;
    const fvBruto = metaReajustada / 0.85; // Considerando IR 15%
    
    if (r > 0 && mesesRestantes > 0) {
      const fator = Math.pow(1 + r, mesesRestantes);
      const aporte = (fvBruto - valorInicial * fator) * r / (fator - 1);
      return Math.max(0, aporte);
    }
    return 0;
  };
  
  const aporteAtual = calcularAporte(rentAtual);
  const aporteConsultoria = calcularAporte(rentConsultoria);
  const economia = aporteAtual - aporteConsultoria;
  
  // Gerar tabelas mensais para ambos os cenários
  const tabelaAtual = gerarTabelaMensalObjetivo(valorInicial, aporteAtual, rentAtual, mesesRestantes, metaReajustada, obj.meta_acumulo, ipcaAnual);
  const tabelaConsultoria = gerarTabelaMensalObjetivo(valorInicial, aporteConsultoria, rentConsultoria, mesesRestantes, metaReajustada, obj.meta_acumulo, ipcaAnual);
  
  return `
    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <span style="background: var(--accent-color); color: var(--dark-bg); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${obj.prioridade}º Prioridade</span>
          <h5 style="color: var(--accent-color); margin: 0.5rem 0 0 0;">${obj.descricao || 'Objetivo sem nome'}</h5>
          ${obj.importancia ? `<p style="color: var(--text-light); opacity: 0.8; font-size: 0.85rem; margin: 0.3rem 0 0 0;">${obj.importancia}</p>` : ''}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.8rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.8rem; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
          <div style="font-size: 0.7rem; color: var(--text-light); opacity: 0.8;">Valor Final</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(obj.valor_final)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
          <div style="font-size: 0.7rem; color: var(--text-light); opacity: 0.8;">Meta de Acúmulo</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(obj.meta_acumulo)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
          <div style="font-size: 0.7rem; color: var(--text-light); opacity: 0.8;">Meta Reajustada (IPCA)</div>
          <div style="font-size: 1rem; font-weight: 600; color: #ffc107;">${formatarMoedaObj(metaReajustada)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
          <div style="font-size: 0.7rem; color: var(--text-light); opacity: 0.8;">Valor Inicial</div>
          <div style="font-size: 1rem; font-weight: 600; color: #007bff;">${formatarMoedaObj(valorInicial)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
          <div style="font-size: 0.7rem; color: var(--text-light); opacity: 0.8;">Prazo</div>
          <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${anosRestantes.toFixed(1)} anos</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(40, 167, 69, 0.2); border: 1px solid #28a745; border-radius: 8px;">
          <div style="font-size: 0.7rem; color: #28a745;">Economia Mensal</div>
          <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(economia)}</div>
        </div>
      </div>
      
      <!-- Comparação de Cenários -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <!-- Cenário Atual -->
        <div style="background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px; padding: 1rem;">
          <h6 style="color: #dc3545; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
            <i class="fas fa-user-times"></i> Cenário Atual (Sem Consultoria)
          </h6>
          <div style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select onchange="updateObjetivoField(${obj.id}, 'perfil_atual', this.value); renderObjetivos();"
                    style="width: 100%; padding: 0.4rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem; margin-top: 0.3rem;">
              ${PERFIS_RENTABILIDADE.map(p => `<option value="${p.id}" ${perfilAtual === p.id ? 'selected' : ''}>${p.nome} (${p.percentCDI}% CDI = ${formatarPercentual(getRentabilidadePerfil(p.id))})</option>`).join('')}
            </select>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--dark-bg); border-radius: 4px;">
            <span style="font-size: 0.8rem; color: var(--text-light);">Aporte Mensal:</span>
            <span style="font-size: 1.1rem; font-weight: 600; color: #dc3545;">${formatarMoedaObj(aporteAtual)}</span>
          </div>
          ${tabelaAtual}
        </div>
        
        <!-- Cenário com Consultoria -->
        <div style="background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px; padding: 1rem;">
          <h6 style="color: #28a745; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
            <i class="fas fa-user-check"></i> Cenário com Consultoria
          </h6>
          <div style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.75rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select onchange="updateObjetivoField(${obj.id}, 'perfil_consultoria', this.value); renderObjetivos();"
                    style="width: 100%; padding: 0.4rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem; margin-top: 0.3rem;">
              ${PERFIS_RENTABILIDADE.map(p => `<option value="${p.id}" ${perfilConsultoria === p.id ? 'selected' : ''}>${p.nome} (${p.percentCDI}% CDI = ${formatarPercentual(getRentabilidadePerfil(p.id))})</option>`).join('')}
            </select>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--dark-bg); border-radius: 4px;">
            <span style="font-size: 0.8rem; color: var(--text-light);">Aporte Mensal:</span>
            <span style="font-size: 1.1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(aporteConsultoria)}</span>
          </div>
          ${tabelaConsultoria}
        </div>
      </div>
    </div>
  `;
}

function gerarTabelaMensalObjetivo(valorInicial, aporteMensal, rentAnual, totalMeses, metaReajustada, metaOriginal, ipcaAnual) {
  const rendimentoMensal = Math.pow(1 + rentAnual / 100, 1/12) - 1;
  let saldoBruto = valorInicial;
  const linhas = [];
  
  for (let mes = 0; mes <= totalMeses; mes++) {
    if (mes > 0) {
      const rendimento = saldoBruto * rendimentoMensal;
      saldoBruto = saldoBruto + rendimento + aporteMensal;
    }
    
    const imposto = (saldoBruto - valorInicial - (aporteMensal * mes)) * 0.15;
    const saldoLiquido = saldoBruto - Math.max(0, imposto);
    const metaNoMes = metaOriginal * Math.pow(1 + ipcaAnual, mes / 12);
    const percentualMeta = metaNoMes > 0 ? (saldoLiquido / metaNoMes) * 100 : 0;
    
    linhas.push({
      mes,
      saldoBruto,
      aporte: mes > 0 ? aporteMensal : 0,
      imposto: Math.max(0, imposto),
      metaAjustada: metaNoMes,
      saldoLiquido,
      percentualMeta
    });
  }
  
  return `
    <div style="margin-top: 0.8rem; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
        <thead style="position: sticky; top: 0; background: rgba(212, 175, 55, 0.3);">
          <tr>
            <th style="padding: 0.4rem; text-align: left;">Mês</th>
            <th style="padding: 0.4rem; text-align: right;">Bruto</th>
            <th style="padding: 0.4rem; text-align: right;">Aporte</th>
            <th style="padding: 0.4rem; text-align: right;">IR</th>
            <th style="padding: 0.4rem; text-align: right;">Meta Aj.</th>
            <th style="padding: 0.4rem; text-align: right;">Líquido</th>
            <th style="padding: 0.4rem; text-align: right;">%</th>
          </tr>
        </thead>
        <tbody>
          ${linhas.map((l, idx) => `
            <tr style="background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)'};">
              <td style="padding: 0.3rem;">${l.mes}</td>
              <td style="padding: 0.3rem; text-align: right;">${formatarMoedaObj(l.saldoBruto)}</td>
              <td style="padding: 0.3rem; text-align: right; color: #28a745;">${formatarMoedaObj(l.aporte)}</td>
              <td style="padding: 0.3rem; text-align: right; color: #dc3545;">${formatarMoedaObj(l.imposto)}</td>
              <td style="padding: 0.3rem; text-align: right; color: #ffc107;">${formatarMoedaObj(l.metaAjustada)}</td>
              <td style="padding: 0.3rem; text-align: right; color: var(--accent-color);">${formatarMoedaObj(l.saldoLiquido)}</td>
              <td style="padding: 0.3rem; text-align: right; color: ${l.percentualMeta >= 100 ? '#28a745' : '#ffc107'};">${l.percentualMeta.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}


function renderResumoGeralObjetivos(objetivosAposentadoria, objetivosNormais, pessoas) {
  // Calcular total de aportes mensais necessários
  let totalAportesAposentadoria = 0;
  let totalAportesObjetivosAtual = 0;
  let totalAportesObjetivosConsultoria = 0;
  
  // Aportes de aposentadoria
  objetivosAposentadoria.forEach(obj => {
    const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
    const idadeAtual = pessoa?.idade || 30;
    const anosAteAposentadoria = obj.prazo_valor - idadeAtual;
    const mesesRestantes = Math.max(1, anosAteAposentadoria * 12);
    
    const rendaAnual = obj.renda_anual !== undefined ? obj.renda_anual : calcularRendaAnualPessoa(obj.prazo_pessoa);
    const rentAnualDecimal = variaveisMercado.rent_anual_aposentadoria / 100;
    const capitalNecessario = rentAnualDecimal > 0 ? rendaAnual / rentAnualDecimal : 0;
    const rendimentoMensal = variaveisMercado.rent_mensal_aposentadoria / 100;
    
    const patrimonioAposentadoria = calcularPatrimonioAposentadoriaPorPessoa(obj.prazo_pessoa);
    
    if (rendimentoMensal > 0 && mesesRestantes > 0) {
      const fator = Math.pow(1 + rendimentoMensal, mesesRestantes);
      const aporte = (capitalNecessario - patrimonioAposentadoria * fator) * rendimentoMensal / (fator - 1);
      totalAportesAposentadoria += Math.max(0, aporte);
    }
  });
  
  // Aportes de objetivos normais (cenário atual e consultoria)
  objetivosNormais.forEach(obj => {
    const pessoaSelecionada = pessoas.find(p => obj.responsaveis.includes(p.id)) || pessoas[0];
    const idadeAtual = pessoaSelecionada?.idade || 30;
    
    let mesesRestantes = 0;
    if (obj.prazo_tipo === 'idade') {
      mesesRestantes = Math.max(1, (obj.prazo_valor - idadeAtual) * 12);
    } else {
      mesesRestantes = Math.max(1, obj.prazo_valor * 12);
    }
    
    const anosRestantes = mesesRestantes / 12;
    const ipcaAnual = variaveisMercado.ipca / 100;
    const metaReajustada = obj.meta_acumulo * Math.pow(1 + ipcaAnual, anosRestantes);
    const fvBrutoNecessario = metaReajustada / 0.85;
    const valorInicial = parseFloat(obj.valor_inicial) || 0;
    
    const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
    const perfilConsultoria = obj.perfil_consultoria || 'mod';
    
    const rentAtual = getRentabilidadePerfil(perfilAtual);
    const rentConsultoria = getRentabilidadePerfil(perfilConsultoria);
    
    // Cenário atual
    const rAtual = Math.pow(1 + rentAtual / 100, 1/12) - 1;
    if (rAtual > 0 && mesesRestantes > 0) {
      const fator = Math.pow(1 + rAtual, mesesRestantes);
      const aporte = (fvBrutoNecessario - valorInicial * fator) * rAtual / (fator - 1);
      totalAportesObjetivosAtual += Math.max(0, aporte);
    }
    
    // Cenário consultoria
    const rConsultoria = Math.pow(1 + rentConsultoria / 100, 1/12) - 1;
    if (rConsultoria > 0 && mesesRestantes > 0) {
      const fator = Math.pow(1 + rConsultoria, mesesRestantes);
      const aporte = (fvBrutoNecessario - valorInicial * fator) * rConsultoria / (fator - 1);
      totalAportesObjetivosConsultoria += Math.max(0, aporte);
    }
  });
  
  const totalAtual = totalAportesAposentadoria + totalAportesObjetivosAtual;
  const totalConsultoria = totalAportesAposentadoria + totalAportesObjetivosConsultoria;
  const economiaTotal = totalAtual - totalConsultoria;
  
  return `
    <div style="margin-top: 2rem; padding: 1.5rem; background: var(--dark-bg); border: 2px solid var(--accent-color); border-radius: 10px;">
      <h4 style="color: var(--accent-color); margin: 0 0 1.5rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> RESUMO GERAL DOS OBJETIVOS
      </h4>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
        <!-- Cenário Atual -->
        <div style="padding: 1rem; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px;">
          <h5 style="color: #dc3545; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-times"></i> Cenário Atual
          </h5>
          <div style="display: grid; gap: 0.8rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--text-light);">Aportes Aposentadoria:</span>
              <span style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(totalAportesAposentadoria)}/mês</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--text-light);">Aportes Objetivos:</span>
              <span style="font-size: 1rem; font-weight: 600; color: #dc3545;">${formatarMoedaObj(totalAportesObjetivosAtual)}/mês</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
              <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-light);">TOTAL:</span>
              <span style="font-size: 1.2rem; font-weight: 700; color: #dc3545;">${formatarMoedaObj(totalAtual)}/mês</span>
            </div>
          </div>
        </div>
        
        <!-- Cenário com Consultoria -->
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <h5 style="color: #28a745; margin: 0 0 1rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Com Consultoria
          </h5>
          <div style="display: grid; gap: 0.8rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--text-light);">Aportes Aposentadoria:</span>
              <span style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(totalAportesAposentadoria)}/mês</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--text-light);">Aportes Objetivos:</span>
              <span style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(totalAportesObjetivosConsultoria)}/mês</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
              <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-light);">TOTAL:</span>
              <span style="font-size: 1.2rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(totalConsultoria)}/mês</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Economia -->
      <div style="text-align: center; padding: 1.5rem; background: rgba(40, 167, 69, 0.2); border: 2px solid #28a745; border-radius: 8px;">
        <div style="font-size: 1rem; color: var(--text-light); margin-bottom: 0.5rem;">
          <i class="fas fa-piggy-bank"></i> ECONOMIA MENSAL COM CONSULTORIA
        </div>
        <div style="font-size: 2rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(economiaTotal)}/mês</div>
        <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.5rem;">
          Economia anual: <strong style="color: #28a745;">${formatarMoedaObj(economiaTotal * 12)}</strong>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// FUNÇÕES DE DADOS
// ========================================

function getObjetivosData() {
  return {
    objetivos: objetivos,
    analiseVisivel: analiseVisivel
  };
}

function setObjetivosData(data) {
  if (data) {
    if (Array.isArray(data.objetivos)) {
      objetivos = data.objetivos;
      if (objetivos.length > 0) {
        objetivoCounter = Math.max(...objetivos.map(o => o.id || 0));
      }
    }
    if (typeof data.analiseVisivel === 'boolean') {
      analiseVisivel = data.analiseVisivel;
    }
    
    // Garantir pelo menos uma aposentadoria
    setTimeout(() => {
      renderObjetivos();
    }, 500);
  }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initObjetivosModule);
} else {
  initObjetivosModule();
}

export {
  initObjetivosModule,
  getObjetivosData,
  setObjetivosData,
  renderObjetivos
};
