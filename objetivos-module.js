// ========================================
// MÓDULO DE OBJETIVOS - VERSÃO 6.0
// ========================================

import { supabase } from './supabase.js';

// Dados dos objetivos
let objetivos = [];
let objetivoCounter = 0;
let perfilAnaliseSelecionado = 'mod'; // Perfil selecionado persistente
let perfisComparativos = []; // Array de IDs de perfis extras para comparação

// Dados do Perfil Financeiro e Investimento na Assistência
let perfilFinanceiroData = {
  perfil_selecionado: '',
  observacoes: ''
};

let investimentoAssistenciaData = {
  mostrar_especial: false,
  qtd_recomendacoes: 0,
  proposta_final: '', // 'ordinaria' ou 'especial'
  plano_acompanhamento: '',
  observacoes: ''
};

// Definições dos perfis financeiros
const PERFIS_FINANCEIROS = [
  {
    id: 'dividas_impagaveis',
    nome: 'DÍVIDAS IMPAGÁVEIS',
    emoji: '🚨',
    cor: '#dc3545',
    descricao: 'Este perfil se caracteriza por dívidas tão elevadas que tornam impossível ou praticamente impossível sua quitação no curto, médio e no longo prazo, exigindo medidas extremas para reorganização financeira.'
  },
  {
    id: 'dividas_pagaveis',
    nome: 'DÍVIDAS PAGÁVEIS',
    emoji: '⚠️',
    cor: '#fd7e14',
    descricao: 'Este perfil se caracteriza por dívidas que podem ser altas, médias ou baixas, mas há margem para negociação e pagamento dentro de um período razoável, com estratégias de pagamento adequadas, permitindo adequação ou readequação ao fluxo de caixa.'
  },
  {
    id: 'zero_a_zero_obrigatorio',
    nome: 'ZERO A ZERO OBRIGATÓRIO',
    emoji: '🔒',
    cor: '#6c757d',
    descricao: 'Este perfil se caracteriza por uma renda mensal totalmente comprometida com despesas fixas + variáveis básicas + lazer mínimo ou sem custo e não havendo sobra ou margem para imprevistos.'
  },
  {
    id: 'zero_a_zero_opcional',
    nome: 'ZERO A ZERO OPCIONAL',
    emoji: '🎭',
    cor: '#ffc107',
    descricao: 'Este perfil se caracteriza por uma renda mensal suficiente para cobrir todas as despesas mensais fixas + variáveis básicos. Porém o lazer vai variar de forma a consumir toda a diferença restante entre as entradas e saídas, sendo rara a sobra de qualquer valor significativo no mês para poupança ou investimento e, ainda que haja, esta micro reserva acumulada é rapidamente consumida com novos gastos de lazer ou imprevistos.'
  },
  {
    id: 'fluxo_positivo',
    nome: 'FLUXO POSITIVO',
    emoji: '💧',
    cor: '#17a2b8',
    descricao: 'Este perfil se caracteriza por uma renda mensal onde há uma sobra após o pagamento de todas as despesas fixas + despesas variáveis básicas + lazer, sendo essa sobra totalmente irregular e não planejada, mas ocorrendo em praticamente todos os meses do ano, o que permite indiretamente que alguma reserva seja acumulada.'
  },
  {
    id: 'poupador',
    nome: 'POUPADOR',
    emoji: '🐷',
    cor: '#28a745',
    descricao: 'Neste perfil, poupar um valor mínimo é uma das metas mensais, pois o objetivo é formar alguma reserva financeira para eventuais necessidades ou projetos futuros.'
  },
  {
    id: 'investidor_amador',
    nome: 'INVESTIDOR-AMADOR',
    emoji: '📈',
    cor: '#6f42c1',
    descricao: 'Este perfil vai além do Poupador, pois não apenas busca formar reserva, mas também procura investir onde acredita que haja maior retorno, de acordo com seu apetite ao risco. Investir costuma ser o principal foco e finalidade em si. Costuma priorizar nas escolhas que faz os ativos que acha que renderão mais.'
  },
  {
    id: 'investidor_planejador',
    nome: 'INVESTIDOR-PLANEJADOR',
    emoji: '🎯',
    cor: '#d4af37',
    descricao: 'Além de ser um Poupador, este perfil entende que a realização dos objetivos de forma saudável, estável e adequada é mais importante do que o ativo em que será feito o investimento. Busca fazer aportes de forma estratégica e consciente, alinhando seus investimentos com seus objetivos financeiros de curto, médio e longo prazo.'
  }
];

// Planos de acompanhamento
const PLANOS_ACOMPANHAMENTO = [
  {
    id: 'nivel_1',
    nome: 'HV Nível I',
    valor: 29.90,
    subtitulo: 'Autonomia com direção',
    cor: '#6c757d',
    destaque: false,
    itens: [
      'Planejamento e metas definidos',
      'WhatsApp Ilimitado (Dúvidas)',
      'Resolução de demandas em reunião',
      'Você executa, nós orientamos'
    ],
    reunioes: 'Ilimitadas (mediante agendamento)',
    prioridade: 'Baixa',
    sla_agenda: '6 meses',
    sla_whatsapp: '30 dias',
    nao_incluso: 'Cotações, pesquisas de mercado, contato com terceiros, execução operacional, relatórios fora de reunião'
  },
  {
    id: 'nivel_2',
    nome: 'HV Nível II',
    valor: 59.90,
    subtitulo: 'Agilidade + pesquisas',
    cor: '#17a2b8',
    destaque: false,
    itens: [
      'Tudo do Nível I',
      'Cotações de itens da reunião',
      'Prioridade maior na agenda',
      'Pesquisas de preços e opções'
    ],
    reunioes: 'Ilimitadas (mediante agendamento)',
    prioridade: 'Normal',
    sla_agenda: '4 meses',
    sla_whatsapp: '15 dias',
    nao_incluso: 'Contato com terceiros, intermediação, execução operacional, relatórios mensais'
  },
  {
    id: 'nivel_3',
    nome: 'HV Nível III',
    valor: 119.90,
    subtitulo: 'Acompanhamento próximo',
    cor: '#28a745',
    destaque: true,
    itens: [
      'Tudo do Nível II',
      'Supervisão Ativa de contratações',
      'Relatórios mensais de progresso',
      'Prioridade Alta na agenda'
    ],
    reunioes: 'Ilimitadas (mediante agendamento)',
    prioridade: 'Alta',
    sla_agenda: '2 meses',
    sla_whatsapp: '7 dias',
    nao_incluso: 'Execução operacional de tarefas em nome do cliente'
  },
  {
    id: 'nivel_4',
    nome: 'HV Nível IV',
    valor: 299.90,
    subtitulo: 'Nós resolvemos tudo',
    cor: '#d4af37',
    destaque: false,
    itens: [
      'Tudo do Nível III',
      'Resolução total (o que for possível)',
      'Relatórios semanais de evolução',
      'Prioridade MÁXIMA (horário fixo)',
      'Nós executamos por você'
    ],
    reunioes: 'Ilimitadas + Horário Fixo Mensal',
    prioridade: 'Máxima',
    sla_agenda: '1 mês',
    sla_whatsapp: '72 horas',
    nao_incluso: 'Atos que exijam presença física, assinatura biométrica ou senha pessoal intransferível'
  }
];

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
  dolar: 5.65,
  data_reuniao: new Date().toISOString().split('T')[0],
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

// Cores para perfis comparativos no gráfico
const CORES_PERFIS = [
  '#28a745', // verde (principal)
  '#ff6384', // rosa
  '#36a2eb', // azul
  '#ffce56', // amarelo
  '#9966ff', // roxo
  '#ff9f40', // laranja
  '#4bc0c0', // teal
  '#c9cbcf', // cinza
  '#e7e9ed'  // cinza claro
];

// Cores dinâmicas baseadas em performance relativa ao perfil principal
// Perfis com acumulo MAIOR que o principal: tons verdes/azuis
// Perfis com acumulo MENOR que o principal: tons avermelhados
const CORES_MELHOR = ['#17a2b8', '#20c997', '#36a2eb', '#6f42c1', '#4bc0c0']; // azul, teal, azul claro, roxo, ciano
const CORES_PIOR = ['#dc3545', '#e83e8c', '#fd7e14', '#c0392b', '#d63384']; // vermelho, rosa escuro, laranja avermelhado, vermelho escuro, magenta

function getCorPerfilComparativo(saldoFinalComparativo, saldoFinalPrincipal, indexComparativo) {
  if (saldoFinalComparativo >= saldoFinalPrincipal) {
    // Melhor ou igual ao principal -> tons verdes/azuis
    return CORES_MELHOR[indexComparativo % CORES_MELHOR.length];
  } else {
    // Pior que o principal -> tons avermelhados
    return CORES_PIOR[indexComparativo % CORES_PIOR.length];
  }
}

// CSS para estilizar dropdowns
const DROPDOWN_STYLE = `
  background: #0d3320 !important;
  color: #e8e8e8 !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 4px !important;
`;

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

// Formatar data curta (dd/mm/aaaa)
function formatarDataCurta(data) {
  if (!data) return '';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

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
        // Rentabilidades atuais calculadas
        rent_sem_conhecimento: cdi * multSemConhecimento / 100,
        rent_iniciante: cdi * multIniciante / 100,
        rent_ultra_cons: cdi * multUltraCons / 100,
        rent_cons: cdi * multCons / 100,
        rent_cons_mod: cdi * multConsMod / 100,
        rent_mod: cdi * multMod / 100,
        rent_mod_arro: cdi * multModArro / 100,
        rent_arro: cdi * multArro / 100,
        rent_ultra_arro: cdi * multUltraArro / 100,
        // Rentabilidades 10 anos calculadas
        rent_sem_conhecimento_10_anos: cdi10 * multSemConhecimento / 100,
        rent_iniciante_10_anos: cdi10 * multIniciante / 100,
        rent_ultra_cons_10_anos: cdi10 * multUltraCons / 100,
        rent_cons_10_anos: cdi10 * multCons / 100,
        rent_cons_mod_10_anos: cdi10 * multConsMod / 100,
        rent_mod_10_anos: cdi10 * multMod / 100,
        rent_mod_arro_10_anos: cdi10 * multModArro / 100,
        rent_arro_10_anos: cdi10 * multArro / 100,
        rent_ultra_arro_10_anos: cdi10 * multUltraArro / 100,
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
        ultima_atualizacao: data.data_ultima_atualizacao
      };
    }
  } catch (err) {
    console.log('Erro ao carregar variáveis de mercado:', err);
  }
}

// ========================================
// FUNÇÕES DE FORMATAÇÃO
// ========================================

function formatarMoedaObj(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

// Formatar moeda de forma compacta (para tabelas)
function formatarMoedaCompacta(valor) {
  const num = parseFloat(valor) || 0;
  if (num >= 1000000) {
    return `R$ ${(num / 1000000).toFixed(2).replace('.', ',')}M`;
  } else if (num >= 1000) {
    return `R$ ${(num / 1000).toFixed(1).replace('.', ',')}K`;
  } else {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
}

function formatarPercentual(valor) {
  return `${(valor || 0).toFixed(2)}%`;
}

function formatarData(data) {
  if (!data) return '';
  return new Date(data).toLocaleDateString('pt-BR');
}

function parseMoedaObj(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
}

function formatarInputMoedaObj(input, objetivoId, field) {
  // Remover tudo que não é dígito
  let valorStr = input.value.replace(/\D/g, '');
  
  // Se vazio, definir como 0
  if (!valorStr || valorStr === '') {
    valorStr = '0';
  }
  
  // Converter para número (centavos) e depois para reais
  let valorNumerico = parseInt(valorStr, 10) / 100;
  
  // Validação para valor inicial - não pode exceder saldo disponível
  if (field === 'valor_inicial') {
    const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
    const valorAlocadoOutros = calcularValorInicialAlocadoExceto(objetivoId);
    const saldoDisponivel = Math.max(0, patrimonioObjetivos - valorAlocadoOutros);
    
    if (valorNumerico > saldoDisponivel) {
      valorNumerico = saldoDisponivel;
      input.style.borderColor = '#dc3545';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
    }
  }
  
  // Formatar o valor para exibição
  input.value = formatarMoedaObj(valorNumerico).replace('R$', 'R$ ');
  
  // Atualizar o campo no objeto
  updateObjetivoField(objetivoId, field, valorNumerico);
  
  // Atualizar displays dinâmicos se for valor_inicial
  if (field === 'valor_inicial') {
    atualizarDisplaysPatrimonio();
  }
}

function atualizarDisplaysPatrimonio() {
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = Math.max(0, patrimonioObjetivos - valorAlocado);
  
  const displayPatrimonio = document.getElementById('patrimonio-objetivos-display');
  const displayAlocado = document.getElementById('valor-alocado-display');
  const displaySaldo = document.getElementById('saldo-disponivel-display');
  
  if (displayPatrimonio) displayPatrimonio.textContent = formatarMoedaObj(patrimonioObjetivos);
  if (displayAlocado) displayAlocado.textContent = formatarMoedaObj(valorAlocado);
  if (displaySaldo) {
    displaySaldo.textContent = formatarMoedaObj(saldoRestante);
    displaySaldo.style.color = saldoRestante >= 0 ? '#28a745' : '#dc3545';
    // parentElement é o span container com border
    const saldoContainer = displaySaldo.parentElement;
    if (saldoContainer) {
      saldoContainer.style.borderColor = saldoRestante >= 0 ? 'rgba(40, 167, 69, 0.3)' : 'rgba(220, 53, 69, 0.3)';
      saldoContainer.style.background = saldoRestante >= 0 ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)';
    }
  }
}

// ========================================
// FUNÇÕES DE PESSOAS
// ========================================

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
  if (estadoCivil && (estadoCivil === 'Casado(a)' || estadoCivil === 'União Estável')) {
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
    if (pessoa.estado_civil && (pessoa.estado_civil === 'Casado(a)' || pessoa.estado_civil === 'União Estável')) {
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

function getNomePessoaPorId(pessoaId) {
  const pessoas = getPessoasDisponiveis();
  const pessoa = pessoas.find(p => p.id === pessoaId);
  return pessoa ? pessoa.nome : pessoaId;
}

// ========================================
// CÁLCULOS DE PATRIMÔNIO
// ========================================

function calcularPatrimonioParaObjetivos() {
  let total = 0;
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      // Soma TODOS os itens do PL (incluindo aposentadoria) como pool disponível
      const valor = parseFloat(p.valor_atual) || 0;
      total += valor;
    });
  }
  
  return total;
}

function calcularPatrimonioPorPessoaEFinalidade(pessoaId, finalidade) {
  let total = 0;
  const nomePessoa = getNomePessoaPorId(pessoaId);
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      if (p.finalidade === finalidade && p.donos && p.donos.length > 0) {
        if (p.donos.includes(nomePessoa)) {
          const valor = parseFloat(p.valor_atual) || 0;
          const qtdDonos = p.donos.length;
          total += valor / qtdDonos;
        }
      }
    });
  }
  
  return total;
}

function calcularPatrimonioAposentadoriaPorPessoa(pessoaId) {
  return calcularPatrimonioPorPessoaEFinalidade(pessoaId, 'APOSENTADORIA');
}

function calcularValorInicialAlocado() {
  // Inclui TODOS os objetivos (aposentadoria + normais) na conta do saldo
  return objetivos
    .filter(o => o.tipo !== 'intangivel')
    .reduce((sum, o) => sum + (parseFloat(o.valor_inicial) || 0), 0);
}

function calcularValorInicialAlocadoExceto(objetivoId) {
  // Inclui TODOS os objetivos (aposentadoria + normais) exceto o atual
  return objetivos
    .filter(o => o.id !== objetivoId && o.tipo !== 'intangivel')
    .reduce((sum, o) => sum + (parseFloat(o.valor_inicial) || 0), 0);
}

// ========================================
// CÁLCULOS DE APORTES
// ========================================

function getAportesPessoa(pessoaId) {
  let aporteMensal = 0;
  let aporteAnual = 0;
  
  const nomePessoa = getNomePessoaPorId(pessoaId);
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    
    patrimonios.forEach(pl => {
      const aporteValor = parseFloat(pl.aporte_valor) || 0;
      const aporteFrequencia = pl.aporte_frequencia || 'NENHUM';
      const donos = pl.donos || [];
      
      if (aporteValor > 0 && aporteFrequencia !== 'NENHUM' && donos.length > 0) {
        if (donos.includes(nomePessoa)) {
          const aporteValorPorDono = aporteValor / donos.length;
          
          if (aporteFrequencia === 'MENSAL') {
            aporteMensal += aporteValorPorDono;
          } else if (aporteFrequencia === 'ANUAL') {
            aporteAnual += aporteValorPorDono;
          }
        }
      }
    });
  }
  
  // Adicionar restituições de IR como aportes anuais
  if (window.getDeclaracoesIRData) {
    const declaracoes = window.getDeclaracoesIRData() || [];
    declaracoes.forEach(declaracao => {
      const resultadoTipo = declaracao.resultado_tipo || '';
      const resultadoValor = parseFloat(declaracao.resultado_valor) || 0;
      
      if (resultadoTipo === 'restitui' && resultadoValor > 0) {
        // Mapear pessoa_key para o ID usado nos objetivos
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
        
        if (titularId === pessoaId) {
          aporteAnual += resultadoValor;
        }
      }
    });
  }
  
  return { mensal: aporteMensal, anual: aporteAnual };
}

function getAportesResponsaveis(responsaveis) {
  let aporteMensal = 0;
  let aporteAnual = 0;
  
  if (!responsaveis || responsaveis.length === 0) return { mensal: 0, anual: 0 };
  
  responsaveis.forEach(pessoaId => {
    const aportes = getAportesPessoa(pessoaId);
    aporteMensal += aportes.mensal;
    aporteAnual += aportes.anual;
  });
  
  return { mensal: aporteMensal, anual: aporteAnual };
}

function calcularAportesTotaisDisponiveis() {
  let totalMensal = 0;
  let totalAnual = 0;
  
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    
    patrimonios.forEach(pl => {
      const aporteValor = parseFloat(pl.aporte_valor) || 0;
      const aporteFrequencia = pl.aporte_frequencia || 'NENHUM';
      
      if (aporteValor > 0 && aporteFrequencia !== 'NENHUM') {
        if (aporteFrequencia === 'MENSAL') {
          totalMensal += aporteValor;
        } else if (aporteFrequencia === 'ANUAL') {
          totalAnual += aporteValor;
        }
      }
    });
  }
  
  // Adicionar restituições de IR como aportes anuais
  if (window.getDeclaracoesIRData) {
    const declaracoes = window.getDeclaracoesIRData() || [];
    declaracoes.forEach(declaracao => {
      const resultadoTipo = declaracao.resultado_tipo || '';
      const resultadoValor = parseFloat(declaracao.resultado_valor) || 0;
      
      if (resultadoTipo === 'restitui' && resultadoValor > 0) {
        totalAnual += resultadoValor;
      }
    });
  }
  
  return { mensal: totalMensal, anual: totalAnual };
}

// Calcula o aporte mensal necessário (PMT) para atingir uma meta
function calcularAporteMensalNecessario(meta, valorInicial, meses, perfilId) {
  if (meses <= 0 || meta <= 0) return 0;
  const rentAnual = getRentabilidadePorPerfil(perfilId || getPerfilAnalise());
  const r = Math.pow(1 + rentAnual / 100, 1/12) - 1;
  const pv = valorInicial || 0;
  const fv = meta;
  if (r === 0) return Math.max(0, (fv - pv) / meses);
  const fatorAcumulacao = Math.pow(1 + r, meses);
  const aporte = (fv - pv * fatorAcumulacao) * r / (fatorAcumulacao - 1);
  return Math.max(0, aporte);
}

function calcularRendaAnualPessoa(pessoaId) {{
  let rendaAnual = 0;
  const nomePessoa = getNomePessoaPorId(pessoaId);
  
  // Buscar rendas do fluxo de caixa
  if (window.getFluxoCaixaData) {
    const fluxoData = window.getFluxoCaixaData();
    const receitas = fluxoData.receitas || [];
    
    receitas.forEach(r => {
      const titularReceita = r.titular || 'titular';
      const titularNome = getNomePessoaPorId(titularReceita);
      
      if (titularNome === nomePessoa || titularReceita === pessoaId) {
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
// CRUD DE OBJETIVOS
// ========================================

function addObjetivoAposentadoria() {
  const pessoas = getPessoasDisponiveis();
  if (pessoas.length === 0) return;
  
  const primeiraPessoa = pessoas[0];
  objetivoCounter++;
  
  const novoObjetivo = {
    id: objetivoCounter,
    tipo: 'aposentadoria',
    descricao: `Aposentadoria de ${primeiraPessoa.nome}`,
    prazo_pessoa: primeiraPessoa.id,
    prazo_tipo: 'idade', // 'idade', 'meses', 'anos', 'data'
    prazo_idade: 65,
    prazo_meses: 360,
    prazo_data: null,
    renda_anual: calcularRendaAnualPessoa(primeiraPessoa.id),
    responsaveis: [primeiraPessoa.id],
    valor_inicial: 0,
    // Campos de cenário
    perfil_atual: 'sem_conhecimento',
    perfil_consultoria: 'mod',
    aporte_mensal_personalizado: null // null = usar aporte automático
  };
  
  objetivos.push(novoObjetivo);
  renderObjetivos();
}

function addObjetivoNormal() {
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria' && o.tipo !== 'intangivel');
  const novaPrioridade = objetivosNormais.length + 1;
  objetivoCounter++;
  
  const novoObjetivo = {
    id: objetivoCounter,
    tipo: 'objetivo',
    descricao: '',
    importancia: '',
    responsaveis: [],
    prazo_meses: 60,
    prazo_tipo: 'meses', // 'meses', 'anos', 'data'
    prazo_data: null, // Data específica se prazo_tipo === 'data'
    valor_inicial: 0,
    valor_final: 0,
    meta_acumulo: 0,
    prioridade: novaPrioridade,
    // Novos campos
    acumulavel: false, // Se true, saldo bruto passa para o próximo
    vinculado_a: null, // ID do objetivo anterior (para sequência)
    recorrencia_tipo: 'nenhuma', // 'nenhuma', 'meses', 'anos'
    recorrencia_valor: 0, // A cada X meses ou anos
    perfil_atual: 'sem_conhecimento',
    perfil_consultoria: 'mod',
    aporte_mensal_personalizado: null // null = usar aporte automático
  };
  
  objetivos.push(novoObjetivo);
  renderObjetivos();
}

// MELHORIA 4: Adicionar objetivo intangível
function addObjetivoIntangivel() {
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria' && o.tipo !== 'intangivel');
  const novaPrioridade = objetivosNormais.length + 1;
  objetivoCounter++;
  
  const novoObjetivo = {
    id: objetivoCounter,
    tipo: 'intangivel',
    descricao: '',
    importancia: '',
    responsaveis: [],
    prazo_meses: 12,
    prazo_tipo: 'meses',
    prazo_data: null,
    prioridade: novaPrioridade,
    marcos: [] // Array de {id, texto, concluido}
  };
  
  objetivos.push(novoObjetivo);
  renderObjetivos();
}

function addMarcoIntangivel(objetivoId) {
  const objetivo = objetivos.find(o => o.id === objetivoId);
  if (!objetivo) return;
  if (!objetivo.marcos) objetivo.marcos = [];
  
  objetivo.marcos.push({
    id: Date.now(),
    texto: '',
    concluido: false
  });
  renderObjetivos();
}

function updateMarcoIntangivel(objetivoId, marcoId, field, value) {
  const objetivo = objetivos.find(o => o.id === objetivoId);
  if (!objetivo || !objetivo.marcos) return;
  const marco = objetivo.marcos.find(m => m.id === marcoId);
  if (marco) {
    marco[field] = value;
  }
}

function deleteMarcoIntangivel(objetivoId, marcoId) {
  const objetivo = objetivos.find(o => o.id === objetivoId);
  if (!objetivo || !objetivo.marcos) return;
  objetivo.marcos = objetivo.marcos.filter(m => m.id !== marcoId);
  renderObjetivos();
}

function deleteObjetivo(id) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo) return;
  
  if (objetivo.tipo === 'aposentadoria') {
    if (!confirm('Tem certeza que deseja excluir esta meta de aposentadoria?')) return;
  } else {
    if (!confirm('Tem certeza que deseja excluir este objetivo?')) return;
    
    // Remover vínculos de outros objetivos que apontam para este
    objetivos.forEach(o => {
      if (o.vinculado_a === id) {
        o.vinculado_a = null;
      }
    });
  }
  
  objetivos = objetivos.filter(o => o.id !== id);
  
  // Reordenar prioridades
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria' && o.tipo !== 'intangivel')
    .sort((a, b) => a.prioridade - b.prioridade);
  objetivosNormais.forEach((obj, index) => {
    obj.prioridade = index + 1;
  });
  
  renderObjetivos();
}

function updateObjetivoField(id, field, value) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo) return;
  
  // Garantir que campos numéricos sejam sempre números
  const camposNumericos = ['valor_inicial', 'valor_final', 'meta_acumulo', 'renda_anual', 'prazo_meses', 'prazo_idade', 'prioridade'];
  if (camposNumericos.includes(field)) {
    objetivo[field] = parseFloat(value) || 0;
  } else {
    objetivo[field] = value;
  }
  
  // Atualizar descrição e renda ao mudar pessoa da aposentadoria
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
  
  // NÃO recalcular meta de acúmulo automaticamente - usuário deve definir manualmente
  // A meta de acúmulo é independente do valor final
  
  if (['valor_inicial', 'valor_final', 'meta_acumulo', 'renda_anual'].includes(field)) {
    atualizarPatrimonioObjetivos();
    // MELHORIA 3: Atualizar análises automaticamente ao editar campos financeiros
    renderAnalisesObjetivosInline();
  }
  
  // Quando muda o tipo de recorrência, definir valor padrão automaticamente
  if (field === 'recorrencia_tipo') {
    if (value === 'anos' && (!objetivo.recorrencia_valor || objetivo.recorrencia_valor === 0)) {
      objetivo.recorrencia_valor = 1;
    } else if (value === 'meses' && (!objetivo.recorrencia_valor || objetivo.recorrencia_valor === 0)) {
      objetivo.recorrencia_valor = 12;
    } else if (value === 'nenhuma') {
      objetivo.recorrencia_valor = 0;
    }
  }
  
  // MELHORIA 3: Atualizar análises ao mudar campos de prazo ou recorrência
  if (['prazo_meses', 'prazo_idade', 'prazo_data', 'prazo_tipo', 'recorrencia_tipo', 'recorrencia_valor', 'acumulavel'].includes(field)) {
    renderAnalisesObjetivosInline();
  }
}

function updateObjetivoPrioridade(id, novaPrioridade) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo || objetivo.tipo === 'aposentadoria' || objetivo.tipo === 'intangivel') return;
  
  const prioridadeAtual = objetivo.prioridade;
  novaPrioridade = parseInt(novaPrioridade);
  
  if (prioridadeAtual === novaPrioridade) return;
  
  objetivos.forEach(obj => {
    if (obj.id === id || obj.tipo === 'aposentadoria' || obj.tipo === 'intangivel') return;
    
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

function atualizarPatrimonioObjetivos() {
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = Math.max(0, patrimonioObjetivos - valorAlocado);
  
  // Atualizar displays
  const displayPatrimonio = document.getElementById('patrimonio-objetivos-display');
  const displayAlocado = document.getElementById('valor-alocado-display');
  const displaySaldo = document.getElementById('saldo-disponivel-display');
  
  if (displayPatrimonio) displayPatrimonio.textContent = formatarMoedaObj(patrimonioObjetivos);
  if (displayAlocado) displayAlocado.textContent = formatarMoedaObj(valorAlocado);
  if (displaySaldo) {
    displaySaldo.textContent = formatarMoedaObj(saldoRestante);
    displaySaldo.style.color = saldoRestante >= 0 ? '#28a745' : '#dc3545';
  }
  
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

// ========================================
// GERAÇÃO DE OPÇÕES DE PERFIL
// ========================================

function gerarOpcoesPerfilRentabilidade(perfilSelecionado, idsDisponiveis) {
  const cdi = variaveisMercado.cdi || 14.65;
  const cdi10 = variaveisMercado.cdi_aa_medio_10_anos || 9.2666;
  
  let html = `<optgroup label="Rentabilidades Atuais" style="background: #0d3320; color: #e8e8e8;">`;
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
    // Se idsDisponiveis foi passado, só mostrar os disponíveis + o selecionado
    if (idsDisponiveis && !idsDisponiveis.includes(perfil.id) && perfilSelecionado !== perfil.id) return;
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = cdi * mult / 100;
    const selected = perfilSelecionado === perfil.id ? 'selected' : '';
    html += `<option value="${perfil.id}" ${selected} style="background: #0d3320; color: #e8e8e8;">
      ${perfil.nome} (${mult}% CDI = ${rent.toFixed(2)}%)
    </option>`;
  });
  
  html += `</optgroup>`;
  html += `<optgroup label="Rentabilidades Médias 10 Anos" style="background: #0d3320; color: #e8e8e8;">`;
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
    const id10a = `${perfil.id}_10a`;
    if (idsDisponiveis && !idsDisponiveis.includes(id10a) && perfilSelecionado !== id10a) return;
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = cdi10 * mult / 100;
    const selected = perfilSelecionado === id10a ? 'selected' : '';
    html += `<option value="${id10a}" ${selected} style="background: #0d3320; color: #e8e8e8;">
      ${perfil.nome} 10a (${mult}% CDI = ${rent.toFixed(2)}%)
    </option>`;
  });
  
  html += `</optgroup>`;
  
  return html;
}

function getRentabilidadePorPerfil(perfilId) {
  const cdi = variaveisMercado.cdi || 14.65;
  const cdi10 = variaveisMercado.cdi_aa_medio_10_anos || 9.2666;
  
  // Verificar se é perfil de 10 anos
  const is10Anos = perfilId.endsWith('_10a');
  const perfilBase = is10Anos ? perfilId.replace('_10a', '') : perfilId;
  
  const perfil = PERFIS_RENTABILIDADE.find(p => p.id === perfilBase);
  if (!perfil) return 10; // Valor padrão
  
  const mult = variaveisMercado[`mult_${perfilBase}`] || perfil.percentCDI;
  const cdiBase = is10Anos ? cdi10 : cdi;
  
  return cdiBase * mult / 100;
}

function getNomePerfilRentabilidade(perfilId) {
  const is10Anos = perfilId.endsWith('_10a');
  const perfilBase = is10Anos ? perfilId.replace('_10a', '') : perfilId;
  const perfil = PERFIS_RENTABILIDADE.find(p => p.id === perfilBase);
  if (!perfil) return perfilId;
  return is10Anos ? `${perfil.nome} 10a` : perfil.nome;
}


// ========================================
// FUNÇÕES DE VARIÁVEIS DE MERCADO
// ========================================

function updateVariavelMercado(campo, valor) {
  variaveisMercado[campo] = valor;
  // Recalcular rentabilidades se CDI mudou
  if (campo === 'cdi') {
    const cdi = valor;
    PERFIS_RENTABILIDADE.forEach(perfil => {
      const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
      variaveisMercado[`rent_${perfil.id}`] = cdi * mult / 100;
    });
  }
  // Atualizar análises sem re-renderizar todo o painel (evita perder foco dos inputs)
  renderAnalisesObjetivosInline();
}

async function atualizarDadosMercado() {
  try {
    const { data, error } = await supabase
      .from('variaveis_mercado')
      .select('*')
      .order('data_ultima_atualizacao', { ascending: false })
      .limit(1)
      .single();
    
    if (data && !error) {
      // Preservar data_reuniao e dolar (são específicos do diagnóstico)
      const dataReuniao = variaveisMercado.data_reuniao;
      const dolar = variaveisMercado.dolar;
      
      const cdi = parseFloat(data.cdi) || 14.65;
      const cdi10 = parseFloat(data.cdi_aa_medio_10_anos) || 9.2666;
      
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
        dolar: dolar,
        data_reuniao: dataReuniao,
        rent_sem_conhecimento: cdi * multSemConhecimento / 100,
        rent_iniciante: cdi * multIniciante / 100,
        rent_ultra_cons: cdi * multUltraCons / 100,
        rent_cons: cdi * multCons / 100,
        rent_cons_mod: cdi * multConsMod / 100,
        rent_mod: cdi * multMod / 100,
        rent_mod_arro: cdi * multModArro / 100,
        rent_arro: cdi * multArro / 100,
        rent_ultra_arro: cdi * multUltraArro / 100,
        rent_sem_conhecimento_10_anos: cdi10 * multSemConhecimento / 100,
        rent_iniciante_10_anos: cdi10 * multIniciante / 100,
        rent_ultra_cons_10_anos: cdi10 * multUltraCons / 100,
        rent_cons_10_anos: cdi10 * multCons / 100,
        rent_cons_mod_10_anos: cdi10 * multConsMod / 100,
        rent_mod_10_anos: cdi10 * multMod / 100,
        rent_mod_arro_10_anos: cdi10 * multModArro / 100,
        rent_arro_10_anos: cdi10 * multArro / 100,
        rent_ultra_arro_10_anos: cdi10 * multUltraArro / 100,
        mult_sem_conhecimento: multSemConhecimento,
        mult_iniciante: multIniciante,
        mult_ultra_cons: multUltraCons,
        mult_cons: multCons,
        mult_cons_mod: multConsMod,
        mult_mod: multMod,
        mult_mod_arro: multModArro,
        mult_arro: multArro,
        mult_ultra_arro: multUltraArro,
        ultima_atualizacao: data.data_ultima_atualizacao
      };
      
      renderObjetivos();
      alert('Dados de mercado atualizados com sucesso!');
    } else {
      alert('Não foi possível buscar dados atualizados.');
    }
  } catch (err) {
    console.error('Erro ao atualizar dados de mercado:', err);
    alert('Erro ao atualizar dados de mercado.');
  }
}

// ========================================
// MELHORIA 5: PERFIS COMPARATIVOS
// ========================================

function adicionarPerfilComparativo() {
  // Encontrar perfis que ainda não estão selecionados
  const todosIds = [];
  PERFIS_RENTABILIDADE.forEach(p => {
    todosIds.push(p.id);
    todosIds.push(p.id + '_10a');
  });
  
  const jaUsados = [perfilAnaliseSelecionado, ...perfisComparativos];
  const disponiveis = todosIds.filter(id => !jaUsados.includes(id));
  
  if (disponiveis.length === 0) {
    alert('Todos os perfis já estão sendo comparados.');
    return;
  }
  
  perfisComparativos.push(disponiveis[0]);
  renderAnalisesObjetivosInline();
}

function removerPerfilComparativo(index) {
  perfisComparativos.splice(index, 1);
  renderAnalisesObjetivosInline();
}

function editarPerfilComparativo(index, novoPerfilId) {
  // Impedir perfis duplicados
  const jaUsados = [perfilAnaliseSelecionado, ...perfisComparativos.filter((_, i) => i !== index)];
  if (jaUsados.includes(novoPerfilId)) {
    alert('Este perfil já está selecionado. Escolha um perfil diferente.');
    renderAnalisesObjetivosInline(); // Re-render para restaurar o select
    return;
  }
  perfisComparativos[index] = novoPerfilId;
  renderAnalisesObjetivosInline();
}

// ========================================
// RENDERIZAÇÃO PRINCIPAL
// ========================================

function renderObjetivos() {
  const container = document.getElementById('objetivos-container');
  if (!container) return;
  
  // Análises são sempre renderizadas abaixo da edição
  
  const pessoas = getPessoasDisponiveis();
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = Math.max(0, patrimonioObjetivos - valorAlocado);
  const aportesTotais = calcularAportesTotaisDisponiveis();
  
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria' && o.tipo !== 'intangivel')
    .sort((a, b) => a.prioridade - b.prioridade);
  const objetivosIntangiveis = objetivos.filter(o => o.tipo === 'intangivel');
  
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
    <!-- Painel Compacto de Informações -->
    <div style="background: var(--dark-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 0.8rem; margin-bottom: 1.5rem;">
      <!-- Linha 1: Variáveis de Mercado (editáveis) -->
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; padding-bottom: 0.6rem; border-bottom: 1px solid rgba(212, 175, 55, 0.2); flex-wrap: wrap;">
        <span style="font-size: 0.75rem; color: var(--accent-color); font-weight: 600; white-space: nowrap;">
          <i class="fas fa-chart-line"></i> Mercado
        </span>
        <input type="date" value="${variaveisMercado.data_reuniao || new Date().toISOString().split('T')[0]}" onchange="updateVariavelMercado('data_reuniao', this.value)" style="padding: 0.15rem 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.65rem; width: 110px;" title="Data da reunião">
        <button onclick="atualizarDadosMercado()" title="Atualizar dados de mercado" style="background: none; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 4px; color: var(--accent-color); cursor: pointer; padding: 0.15rem 0.4rem; font-size: 0.6rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
          <i class="fas fa-sync-alt"></i>
        </button>
        <div style="display: flex; gap: 0.4rem; flex: 1; justify-content: flex-end; flex-wrap: wrap; align-items: center;">
          <span style="padding: 0.2rem 0.3rem; background: rgba(212, 175, 55, 0.1); border-radius: 4px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.2rem;">
            <span style="color: var(--text-light); font-size: 0.6rem;">SELIC</span>
            <input type="text" value="${variaveisMercado.selic}" onchange="updateVariavelMercado('selic', parseFloat(this.value)||0)" style="width: 42px; padding: 0.1rem 0.2rem; background: transparent; border: 1px solid rgba(212,175,55,0.3); border-radius: 3px; color: var(--accent-color); font-size: 0.7rem; font-weight: 600; text-align: center;">%
          </span>
          <span style="padding: 0.2rem 0.3rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.2rem;">
            <span style="color: var(--text-light); font-size: 0.6rem;">CDI</span>
            <input type="text" value="${variaveisMercado.cdi}" onchange="updateVariavelMercado('cdi', parseFloat(this.value)||0)" style="width: 42px; padding: 0.1rem 0.2rem; background: transparent; border: 1px solid rgba(40,167,69,0.3); border-radius: 3px; color: #28a745; font-size: 0.7rem; font-weight: 600; text-align: center;">%
          </span>
          <span style="padding: 0.2rem 0.3rem; background: rgba(220, 53, 69, 0.1); border-radius: 4px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.2rem;">
            <span style="color: var(--text-light); font-size: 0.6rem;">IPCA</span>
            <input type="text" value="${variaveisMercado.ipca}" onchange="updateVariavelMercado('ipca', parseFloat(this.value)||0)" style="width: 42px; padding: 0.1rem 0.2rem; background: transparent; border: 1px solid rgba(220,53,69,0.3); border-radius: 3px; color: #dc3545; font-size: 0.7rem; font-weight: 600; text-align: center;">%
          </span>
          <span style="padding: 0.2rem 0.3rem; background: rgba(23, 162, 184, 0.1); border-radius: 4px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.2rem;">
            <span style="color: var(--text-light); font-size: 0.6rem;">Rent.Apos.</span>
            <input type="text" value="${variaveisMercado.rent_anual_aposentadoria}" onchange="updateVariavelMercado('rent_anual_aposentadoria', parseFloat(this.value)||0)" style="width: 42px; padding: 0.1rem 0.2rem; background: transparent; border: 1px solid rgba(23,162,184,0.3); border-radius: 3px; color: #17a2b8; font-size: 0.7rem; font-weight: 600; text-align: center;">%
          </span>
          <span style="padding: 0.2rem 0.3rem; background: rgba(76, 175, 80, 0.1); border-radius: 4px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.2rem;">
            <span style="color: var(--text-light); font-size: 0.6rem;">Dólar</span>
            <input type="text" value="${variaveisMercado.dolar || ''}" onchange="updateVariavelMercado('dolar', parseFloat(this.value)||0)" style="width: 42px; padding: 0.1rem 0.2rem; background: transparent; border: 1px solid rgba(76,175,80,0.3); border-radius: 3px; color: #4CAF50; font-size: 0.7rem; font-weight: 600; text-align: center;">
          </span>
        </div>
      </div>
      
      <!-- Linha 2: Aportes + Patrimônio + Saldo -->
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;${objetivosAposentadoria.length > 0 ? ' margin-bottom: 0.6rem; padding-bottom: 0.6rem; border-bottom: 1px solid rgba(212, 175, 55, 0.2);' : ''}">
        <span style="padding: 0.2rem 0.5rem; background: rgba(23, 162, 184, 0.1); border: 1px solid rgba(23, 162, 184, 0.3); border-radius: 4px; font-size: 0.75rem;">
          <span style="color: var(--text-light); font-size: 0.6rem;">Aporte/Mês</span> <span style="color: #17a2b8; font-weight: 600;">${formatarMoedaObj(aportesTotais.mensal)}</span>
        </span>
        <span style="padding: 0.2rem 0.5rem; background: rgba(23, 162, 184, 0.1); border: 1px solid rgba(23, 162, 184, 0.3); border-radius: 4px; font-size: 0.75rem;">
          <span style="color: var(--text-light); font-size: 0.6rem;">Aporte/Ano</span> <span style="color: #17a2b8; font-weight: 600;">${formatarMoedaObj(aportesTotais.anual)}</span>
        </span>
        <span style="flex: 1;"></span>
        <span style="padding: 0.2rem 0.5rem; background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 4px; font-size: 0.75rem;">
          <span style="color: var(--text-light); font-size: 0.6rem;">PL Total</span> <span id="patrimonio-objetivos-display" style="color: var(--accent-color); font-weight: 600;">${formatarMoedaObj(patrimonioObjetivos)}</span>
        </span>
        <span style="padding: 0.2rem 0.5rem; background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 4px; font-size: 0.75rem;">
          <span style="color: var(--text-light); font-size: 0.6rem;">Alocado</span> <span id="valor-alocado-display" style="color: var(--accent-color); font-weight: 600;">${formatarMoedaObj(valorAlocado)}</span>
        </span>
        <span style="padding: 0.2rem 0.5rem; background: rgba(${saldoRestante >= 0 ? '40, 167, 69' : '220, 53, 69'}, 0.1); border: 1px solid ${saldoRestante >= 0 ? 'rgba(40, 167, 69, 0.3)' : 'rgba(220, 53, 69, 0.3)'}; border-radius: 4px; font-size: 0.75rem;">
          <span style="color: var(--text-light); font-size: 0.6rem;">Saldo</span> <span id="saldo-disponivel-display" style="color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'}; font-weight: 600;">${formatarMoedaObj(saldoRestante)}</span>
        </span>
      </div>
      
      <!-- Linha 3: Patrimônio Aposentadoria (só se houver metas) -->
      ${objetivosAposentadoria.length > 0 ? `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span style="font-size: 0.7rem; color: #28a745; font-weight: 600; white-space: nowrap;">
          <i class="fas fa-seedling"></i> Patrim. Aposent.
        </span>
        ${objetivosAposentadoria.map(obj => {
          const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa);
          const nomePessoa = pessoa ? pessoa.nome : 'N/A';
          const patrimonio = patrimonioAposentadoriaPorPessoa[obj.prazo_pessoa] || 0;
          return `
          <span style="padding: 0.2rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.75rem;">
            <span style="color: var(--text-light); font-size: 0.6rem;">${nomePessoa}</span> <span style="color: #28a745; font-weight: 600;">${formatarMoedaObj(patrimonio)}</span>
          </span>`;
        }).join('')}
      </div>
      ` : ''}
    </div>
    
    <!-- Metas de Aposentadoria -->
    <div style="margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="color: #28a745; margin: 0; font-size: 1rem;">
          <i class="fas fa-umbrella-beach"></i> Metas de Aposentadoria
        </h3>
        <button onclick="addObjetivoAposentadoria()" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          + Adicionar Aposentadoria
        </button>
      </div>
      
      ${objetivosAposentadoria.map(obj => renderCardAposentadoria(obj, pessoas, patrimonioAposentadoriaPorPessoa)).join('')}
    </div>
    
    <!-- Outros Objetivos -->
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="color: var(--accent-color); margin: 0; font-size: 1rem;">
          <i class="fas fa-bullseye"></i> Outros Objetivos
        </h3>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="addObjetivoNormal()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
            + Objetivo Financeiro
          </button>
          <button onclick="addObjetivoIntangivel()" style="background: #9966ff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
            + Objetivo Intangível
          </button>
        </div>
      </div>
      
      ${objetivosNormais.map(obj => renderCardObjetivo(obj, pessoas, objetivosNormais, saldoRestante)).join('')}
      
      ${objetivosIntangiveis.length > 0 ? `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(153, 102, 255, 0.4);">
          <h4 style="color: #9966ff; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
            <i class="fas fa-star"></i> Objetivos Intangíveis
          </h4>
          ${objetivosIntangiveis.map(obj => renderCardObjetivoIntangivel(obj)).join('')}
        </div>
      ` : ''}
    </div>
    
    <!-- Análises (sempre visíveis abaixo) -->
    <div id="analises-objetivos-container"></div>
  `;
  
  // Renderizar análises abaixo após o DOM estar pronto
  setTimeout(() => renderAnalisesObjetivosInline(), 0);
  
  // Renderizar seções separadas (Perfil Financeiro e Adesão) nos containers do HTML
  renderPerfilFinanceiroSection();
  renderAdesaoSection();
}

function renderCardAposentadoria(obj, pessoas, patrimonioAposentadoriaPorPessoa) {
  const pessoaSelecionada = pessoas.find(p => p.id === obj.prazo_pessoa);
  const idadeAtual = pessoaSelecionada ? pessoaSelecionada.idade : 30;
  
  // Calcular prazo baseado no prazo_tipo
  let anosRestantes;
  const prazoTipo = obj.prazo_tipo || 'idade';
  if (prazoTipo === 'data' && obj.prazo_data) {
    const dataAlvo = new Date(obj.prazo_data);
    const hoje = new Date();
    anosRestantes = Math.max(0, Math.round((dataAlvo - hoje) / (1000 * 60 * 60 * 24 * 365.25)));
  } else if (prazoTipo === 'meses') {
    anosRestantes = Math.max(0, Math.round((obj.prazo_meses || 360) / 12));
  } else if (prazoTipo === 'anos') {
    anosRestantes = Math.max(0, Math.round((obj.prazo_meses || 360) / 12));
  } else {
    const idadeAposentadoria = obj.prazo_idade || 65;
    anosRestantes = Math.max(0, idadeAposentadoria - idadeAtual);
  }
  const patrimonioAtual = patrimonioAposentadoriaPorPessoa[obj.prazo_pessoa] || 0;
  const rendaAnual = obj.renda_anual || 0;
  const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
  const capitalNecessario = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
  
  const valorInicialAlocadoOutros = calcularValorInicialAlocadoExceto(obj.id);
  const patrimonioTotal = calcularPatrimonioParaObjetivos();
  const saldoDisponivelParaEste = Math.max(0, patrimonioTotal - valorInicialAlocadoOutros);
  
  return `
    <div style="background: var(--card-bg); border: 1px solid #28a745; border-radius: 8px; padding: 0.5rem 0.8rem; margin-bottom: 0.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
        <h4 style="color: #28a745; margin: 0; font-size: 0.8rem;">
          <i class="fas fa-user"></i> ${obj.descricao}
        </h4>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.8rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 130px 150px 150px; gap: 0.5rem; margin-bottom: 0.4rem; align-items: end;">
        <div>
          <label style="font-size: 0.6rem; color: #28a745; display: block; margin-bottom: 0.1rem;"><i class="fas fa-user-check"></i> De quem?</label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value)"
                  style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.8rem;">
            ${pessoas.map(p => `<option value="${p.id}" ${obj.prazo_pessoa === p.id ? 'selected' : ''} style="background: #0d3320; color: #e8e8e8;">${p.nome} (${p.tipo})</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size: 0.6rem; color: #28a745; display: block; margin-bottom: 0.1rem;"><i class="fas fa-calendar-alt"></i> Prazo</label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_tipo', this.value); renderObjetivos();"
                  style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem;">
            <option value="idade" ${(obj.prazo_tipo || 'idade') === 'idade' ? 'selected' : ''}>Idade</option>
            <option value="meses" ${obj.prazo_tipo === 'meses' ? 'selected' : ''}>Meses</option>
            <option value="anos" ${obj.prazo_tipo === 'anos' ? 'selected' : ''}>Anos</option>
            <option value="data" ${obj.prazo_tipo === 'data' ? 'selected' : ''}>Data</option>
          </select>
          ${(obj.prazo_tipo || 'idade') === 'data' ? `
            <input type="date" value="${obj.prazo_data || ''}" onchange="updateObjetivoField(${obj.id}, 'prazo_data', this.value)" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem; margin-top: 0.2rem;">
          ` : (obj.prazo_tipo || 'idade') === 'idade' ? `
            <div style="display: flex; align-items: center; gap: 0.2rem; margin-top: 0.2rem;"><input type="number" value="${obj.prazo_idade || 65}" min="30" max="100" onchange="updateObjetivoField(${obj.id}, 'prazo_idade', parseInt(this.value))" style="width: 50px; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;"><span style="color: var(--text-light); font-size: 0.7rem;">anos</span></div>
          ` : `
            <input type="number" value="${obj.prazo_tipo === 'anos' ? Math.round((obj.prazo_meses || 360) / 12) : (obj.prazo_meses || 360)}" min="1" max="${obj.prazo_tipo === 'anos' ? 50 : 600}" onchange="updateObjetivoField(${obj.id}, 'prazo_meses', ${obj.prazo_tipo === 'anos' ? 'parseInt(this.value) * 12' : 'parseInt(this.value)'})" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem; margin-top: 0.2rem;">
          `}
        </div>
        <div>
          <label style="font-size: 0.6rem; color: #28a745; display: block; margin-bottom: 0.1rem;"><i class="fas fa-money-bill-wave"></i> Renda Anual</label>
          <input type="text" value="${formatarMoedaObj(rendaAnual).replace('R$', 'R$ ')}" oninput="formatarInputMoedaObj(this, ${obj.id}, 'renda_anual')" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: #28a745; display: block; margin-bottom: 0.1rem;"><i class="fas fa-wallet"></i> Valor Inicial</label>
          <input type="text" id="valor-inicial-${obj.id}" value="${formatarMoedaObj(obj.valor_inicial || 0).replace('R$', 'R$ ')}" oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_inicial')" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
          <div style="font-size: 0.55rem; color: #28a745; margin-top: 0.1rem;">Disponível: ${formatarMoedaObj(saldoDisponivelParaEste)}</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Idade:</span> <span style="color: #28a745; font-weight: 600;">${idadeAtual}</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Restam:</span> <span style="color: #28a745; font-weight: 600;">${anosRestantes} anos</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Patrim.:</span> <span style="color: #28a745; font-weight: 600;">${formatarMoedaObj(patrimonioAtual)}</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Capital Nec.:</span> <span id="capital-necessario-${obj.id}" style="color: #28a745; font-weight: 600;">${formatarMoedaObj(capitalNecessario)}</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.15); border: 1px solid #28a745; border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);"><i class="fas fa-coins"></i> Aporte Mensal Nec.:</span> <span id="aporte-mensal-${obj.id}" style="color: #28a745; font-weight: 600;">${formatarMoedaObj(calcularAporteMensalNecessario(capitalNecessario, obj.valor_inicial || 0, anosRestantes * 12, null))}</span></span>
      </div>
    </div>
  `;
}


function renderCardObjetivo(obj, pessoas, todosObjetivos, saldoDisponivel) {
  const totalPrioridades = todosObjetivos.length;
  const valorInicialAlocadoOutros = calcularValorInicialAlocadoExceto(obj.id);
  const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
  const saldoDisponivelParaEste = Math.max(0, patrimonioObjetivos - valorInicialAlocadoOutros);
  
  // Objetivos disponíveis para vincular (prioridade menor = executado antes)
  const objetivosParaVincular = todosObjetivos.filter(o => o.id !== obj.id && o.prioridade < obj.prioridade);
  
  return `
    <div style="background: var(--card-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 0.5rem 0.8rem; margin-bottom: 0.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <select onchange="updateObjetivoPrioridade(${obj.id}, this.value)" style="padding: 0.15rem 0.3rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--accent-color); font-weight: 600; font-size: 0.75rem;">
            ${Array.from({length: totalPrioridades}, (_, i) => i + 1).map(p => `<option value="${p}" ${obj.prioridade === p ? 'selected' : ''}>${p}º</option>`).join('')}
          </select>
          <span style="color: var(--accent-color); font-weight: 600; font-size: 0.8rem;">Prioridade</span>
        </div>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.8rem;"><i class="fas fa-trash"></i></button>
      </div>
      
      <!-- Linha 1: Descrição, Importância, Responsáveis, Prazo -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 130px 140px; gap: 0.5rem; margin-bottom: 0.3rem; align-items: end;">
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-flag"></i> Objetivo *</label>
          <input type="text" value="${obj.descricao || ''}" placeholder="Ex: Comprar uma casa" onchange="updateObjetivoField(${obj.id}, 'descricao', this.value)" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-heart"></i> Importância</label>
          <input type="text" value="${obj.importancia || ''}" placeholder="Por que é importante?" onchange="updateObjetivoField(${obj.id}, 'importancia', this.value)" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-users"></i> De quem? *</label>
          <select onchange="updateObjetivoField(${obj.id}, 'responsaveis', [this.value])" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem;">
            ${pessoas.map(p => `<option value="${p.id}" ${(obj.responsaveis || []).includes(p.id) ? 'selected' : ''} style="background: #0d3320; color: #e8e8e8;">${p.nome} (${p.tipo})</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-calendar"></i> Prazo</label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_tipo', this.value); renderObjetivos();" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem;">
            <option value="meses" ${(obj.prazo_tipo || 'meses') === 'meses' ? 'selected' : ''}>Meses</option>
            <option value="anos" ${obj.prazo_tipo === 'anos' ? 'selected' : ''}>Anos</option>
            <option value="data" ${obj.prazo_tipo === 'data' ? 'selected' : ''}>Data</option>
          </select>
          ${(obj.prazo_tipo || 'meses') === 'data' ? `
            <input type="date" value="${obj.prazo_data || ''}" onchange="updateObjetivoField(${obj.id}, 'prazo_data', this.value)" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem; margin-top: 0.2rem;">
          ` : `
            <input type="number" value="${obj.prazo_tipo === 'anos' ? Math.round((obj.prazo_meses || 60) / 12) : (obj.prazo_meses || 60)}" min="1" max="${obj.prazo_tipo === 'anos' ? 50 : 600}" onchange="updateObjetivoField(${obj.id}, 'prazo_meses', ${obj.prazo_tipo === 'anos' ? 'parseInt(this.value) * 12' : 'parseInt(this.value)'})" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem; margin-top: 0.2rem;">
          `}
        </div>
      </div>
      
      <!-- Linha 2: Valores e Opções -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 140px; gap: 0.5rem; margin-bottom: 0.3rem; align-items: end;">
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-wallet"></i> Valor Inicial</label>
          <input type="text" id="valor-inicial-${obj.id}" value="${formatarMoedaObj(obj.valor_inicial || 0).replace('R$', 'R$ ')}" oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_inicial')" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
          <div style="font-size: 0.55rem; color: #28a745; margin-top: 0.1rem;">Disponível: ${formatarMoedaObj(saldoDisponivelParaEste)}</div>
        </div>
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-bullseye"></i> Valor Final</label>
          <input type="text" value="${formatarMoedaObj(obj.valor_final || 0).replace('R$', 'R$ ')}" oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_final')" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-chart-line"></i> Meta Acúmulo</label>
          <input type="text" id="meta-acumulo-${obj.id}" value="${formatarMoedaObj(obj.meta_acumulo || 0).replace('R$', 'R$ ')}" oninput="formatarInputMoedaObj(this, ${obj.id}, 'meta_acumulo')" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: var(--accent-color); display: block; margin-bottom: 0.1rem;"><i class="fas fa-link"></i> Vincular</label>
          <select onchange="updateObjetivoField(${obj.id}, 'vinculado_a', this.value ? parseInt(this.value) : null)" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem;">
            <option value="">Nenhum</option>
            ${objetivosParaVincular.map(o => `<option value="${o.id}" ${obj.vinculado_a === o.id ? 'selected' : ''}>${o.prioridade}º - ${o.descricao || 'Sem descrição'}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <!-- Aporte Mensal Necessário -->
      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; margin-bottom: 0.3rem;">
        <span style="padding: 0.15rem 0.5rem; background: rgba(212, 175, 55, 0.15); border: 1px solid var(--accent-color); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);"><i class="fas fa-coins"></i> Aporte Mensal Nec.:</span> <span id="aporte-mensal-obj-${obj.id}" style="color: var(--accent-color); font-weight: 600;">${formatarMoedaObj(calcularAporteMensalNecessario(obj.meta_acumulo || 0, obj.valor_inicial || 0, calcularMesesRestantesObjNormal(obj), null))}</span></span>
      </div>
      
      <!-- Linha 3: Recorrência + Acumulável -->
      <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.25rem 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 4px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.3rem;">
          <span style="font-size: 0.65rem; color: var(--accent-color);"><i class="fas fa-redo"></i> Recorrência:</span>
          <select onchange="updateObjetivoField(${obj.id}, 'recorrencia_tipo', this.value); renderObjetivos();" style="padding: 0.15rem 0.3rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.7rem;">
            <option value="nenhuma" ${(obj.recorrencia_tipo || 'nenhuma') === 'nenhuma' ? 'selected' : ''}>Nenhuma</option>
            <option value="meses" ${obj.recorrencia_tipo === 'meses' ? 'selected' : ''}>A cada X meses</option>
            <option value="anos" ${obj.recorrencia_tipo === 'anos' ? 'selected' : ''}>A cada X anos</option>
          </select>
          ${obj.recorrencia_tipo && obj.recorrencia_tipo !== 'nenhuma' ? `
            <input type="number" value="${obj.recorrencia_valor || (obj.recorrencia_tipo === 'anos' ? 1 : 12)}" min="1" max="${obj.recorrencia_tipo === 'anos' ? 50 : 600}" onchange="updateObjetivoField(${obj.id}, 'recorrencia_valor', parseInt(this.value))" style="width: 45px; padding: 0.15rem 0.3rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.7rem;">
            <span style="font-size: 0.6rem; color: var(--text-light);">${obj.recorrencia_tipo === 'anos' ? 'anos' : 'meses'}</span>
          ` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.3rem;">
          <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; color: var(--text-light);">
            <input type="checkbox" ${obj.acumulavel ? 'checked' : ''} onchange="updateObjetivoField(${obj.id}, 'acumulavel', this.checked)" style="width: 14px; height: 14px; cursor: pointer;">
            <span style="font-size: 0.7rem;"><i class="fas fa-layer-group"></i> Acumulável</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

// MELHORIA 4: Card de objetivo intangível
function renderCardObjetivoIntangivel(obj) {
  const marcos = obj.marcos || [];
  const marcosConcluidos = marcos.filter(m => m.concluido).length;
  const totalMarcos = marcos.length;
  const progressoMarcos = totalMarcos > 0 ? Math.round((marcosConcluidos / totalMarcos) * 100) : 0;
  
  // Calcular status de prazo
  const mesesRestantes = calcularMesesRestantesObjNormal(obj);
  const prazoVencido = mesesRestantes <= 0;
  const prazoProximo = mesesRestantes > 0 && mesesRestantes <= 3;
  
  return `
    <div style="background: var(--card-bg); border: 1px solid #9966ff; border-radius: 8px; padding: 0.5rem 0.8rem; margin-bottom: 0.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="color: #9966ff; font-weight: 600; font-size: 0.8rem;"><i class="fas fa-star"></i> Intangível</span>
          ${prazoVencido ? '<span style="font-size: 0.6rem; color: #dc3545; background: rgba(220,53,69,0.1); padding: 0.1rem 0.3rem; border-radius: 3px;"><i class="fas fa-clock"></i> Prazo vencido</span>' : ''}
          ${prazoProximo ? '<span style="font-size: 0.6rem; color: #ffc107; background: rgba(255,193,7,0.1); padding: 0.1rem 0.3rem; border-radius: 3px;"><i class="fas fa-clock"></i> Prazo próximo</span>' : ''}
        </div>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.8rem;"><i class="fas fa-trash"></i></button>
      </div>
      
      <!-- Linha 1: Descrição, Importância, Prazo -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 140px; gap: 0.5rem; margin-bottom: 0.4rem; align-items: end;">
        <div>
          <label style="font-size: 0.6rem; color: #9966ff; display: block; margin-bottom: 0.1rem;"><i class="fas fa-flag"></i> Objetivo *</label>
          <input type="text" value="${obj.descricao || ''}" placeholder="Ex: Aprender inglês" onchange="updateObjetivoField(${obj.id}, 'descricao', this.value)" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: #9966ff; display: block; margin-bottom: 0.1rem;"><i class="fas fa-heart"></i> Importância</label>
          <input type="text" value="${obj.importancia || ''}" placeholder="Por que é importante?" onchange="updateObjetivoField(${obj.id}, 'importancia', this.value)" style="width: 100%; padding: 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light); font-size: 0.8rem;">
        </div>
        <div>
          <label style="font-size: 0.6rem; color: #9966ff; display: block; margin-bottom: 0.1rem;"><i class="fas fa-calendar"></i> Prazo</label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_tipo', this.value); renderObjetivos();" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem;">
            <option value="meses" ${(obj.prazo_tipo || 'meses') === 'meses' ? 'selected' : ''}>Meses</option>
            <option value="anos" ${obj.prazo_tipo === 'anos' ? 'selected' : ''}>Anos</option>
            <option value="data" ${obj.prazo_tipo === 'data' ? 'selected' : ''}>Data</option>
          </select>
          ${(obj.prazo_tipo || 'meses') === 'data' ? `
            <input type="date" value="${obj.prazo_data || ''}" onchange="updateObjetivoField(${obj.id}, 'prazo_data', this.value)" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem; margin-top: 0.2rem;">
          ` : `
            <input type="number" value="${obj.prazo_tipo === 'anos' ? Math.round((obj.prazo_meses || 12) / 12) : (obj.prazo_meses || 12)}" min="1" max="${obj.prazo_tipo === 'anos' ? 50 : 600}" onchange="updateObjetivoField(${obj.id}, 'prazo_meses', ${obj.prazo_tipo === 'anos' ? 'parseInt(this.value) * 12' : 'parseInt(this.value)'})" style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem; margin-top: 0.2rem;">
          `}
        </div>
      </div>
      
      <!-- Marcos de realização -->
      <div style="background: rgba(153, 102, 255, 0.05); border: 1px solid rgba(153, 102, 255, 0.2); border-radius: 6px; padding: 0.4rem 0.6rem; margin-top: 0.3rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
          <span style="font-size: 0.7rem; color: #9966ff; font-weight: 600;"><i class="fas fa-tasks"></i> Marcos (${marcosConcluidos}/${totalMarcos}) ${totalMarcos > 0 ? `- ${progressoMarcos}%` : ''}</span>
          <button onclick="addMarcoIntangivel(${obj.id})" style="background: #9966ff; color: white; border: none; padding: 0.15rem 0.4rem; border-radius: 3px; cursor: pointer; font-size: 0.6rem;">+ Marco</button>
        </div>
        ${totalMarcos > 0 ? `
          <div style="width: 100%; height: 4px; background: rgba(153,102,255,0.2); border-radius: 2px; margin-bottom: 0.3rem;">
            <div style="width: ${progressoMarcos}%; height: 100%; background: #9966ff; border-radius: 2px; transition: width 0.3s;"></div>
          </div>
        ` : ''}
        ${marcos.map(marco => `
          <div style="display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.2rem;">
            <input type="checkbox" ${marco.concluido ? 'checked' : ''} onchange="updateMarcoIntangivel(${obj.id}, ${marco.id}, 'concluido', this.checked)" style="width: 14px; height: 14px; cursor: pointer; accent-color: #9966ff;">
            <input type="text" value="${marco.texto || ''}" placeholder="Descreva o marco..." onchange="updateMarcoIntangivel(${obj.id}, ${marco.id}, 'texto', this.value)" style="flex: 1; padding: 0.2rem 0.3rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 3px; color: var(--text-light); font-size: 0.7rem; ${marco.concluido ? 'text-decoration: line-through; opacity: 0.7;' : ''}">
            <button onclick="deleteMarcoIntangivel(${obj.id}, ${marco.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.65rem; padding: 0.1rem;"><i class="fas fa-times"></i></button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ========================================
// ANÁLISE DE OBJETIVOS - GRÁFICO EVOLUÇÃO PATRIMONIAL
// ========================================

let chartInstance = null;

function renderAnalisesObjetivosInline() {
  const container = document.getElementById('analises-objetivos-container');
  if (!container) return;
  
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria' && o.tipo !== 'intangivel')
    .sort((a, b) => a.prioridade - b.prioridade);
  const objetivosIntangiveis = objetivos.filter(o => o.tipo === 'intangivel');
  
  // Só mostrar análises se houver pelo menos 1 objetivo com dados
  const temDados = objetivosAposentadoria.some(o => o.renda_anual > 0) || objetivosNormais.some(o => o.meta_acumulo > 0 || o.valor_final > 0);
  if (!temDados) {
    container.innerHTML = '';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }
  
  // Calcular simulação completa (perfil principal)
  const simulacao = simularEvolucaoPatrimonial(objetivosAposentadoria, objetivosNormais, perfilAnaliseSelecionado);
  
  // MELHORIA 5: Calcular simulações comparativas
  const simulacoesComparativas = perfisComparativos.map(perfilId => ({
    perfilId: perfilId,
    simulacao: simularEvolucaoPatrimonial(objetivosAposentadoria, objetivosNormais, perfilId)
  }));
  
  // Obter saldo final do perfil principal para comparação de cores
  const saldoFinalPrincipal = simulacao.pontos.length > 0 ? simulacao.pontos[simulacao.pontos.length - 1].saldo : 0;
  
  // Calcular cores dinâmicas para cada perfil comparativo
  const coresComparativas = simulacoesComparativas.map((comp, idx) => {
    const saldoFinalComp = comp.simulacao.pontos.length > 0 ? comp.simulacao.pontos[comp.simulacao.pontos.length - 1].saldo : 0;
    return getCorPerfilComparativo(saldoFinalComp, saldoFinalPrincipal, idx);
  });
  
  // Gerar HTML dos perfis comparativos
  let perfisComparativosHTML = '';
  perfisComparativos.forEach((perfilId, index) => {
    const todosIds = [];
    PERFIS_RENTABILIDADE.forEach(p => { todosIds.push(p.id); todosIds.push(p.id + '_10a'); });
    const jaUsados = [perfilAnaliseSelecionado, ...perfisComparativos.filter((_, i) => i !== index)];
    const disponiveis = todosIds.filter(id => !jaUsados.includes(id) || id === perfilId);
    const corPerfil = coresComparativas[index] || CORES_PERFIS[(index + 1) % CORES_PERFIS.length];
    
    perfisComparativosHTML += `
      <div style="display: flex; align-items: center; gap: 0.3rem; margin-top: 0.3rem;">
        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${corPerfil}; display: inline-block;"></span>
        <select onchange="window.editarPerfilComparativo(${index}, this.value)" style="padding: 0.2rem 0.4rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.7rem; flex: 1;">
          ${gerarOpcoesPerfilRentabilidade(perfilId, disponiveis)}
        </select>
        <button onclick="window.removerPerfilComparativo(${index})" style="background: transparent; border: 1px solid rgba(220,53,69,0.4); border-radius: 4px; color: #dc3545; cursor: pointer; padding: 0.15rem 0.3rem; font-size: 0.6rem;" title="Remover perfil">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  });
  
  container.innerHTML = `
    <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid rgba(212, 175, 55, 0.3);">
      <h3 style="color: var(--accent-color); margin: 0 0 1rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas fa-chart-area"></i> Análise de Evolução Patrimonial
        <button onclick="window.renderAnalisesObjetivosInline()" title="Atualizar análises" style="background: none; border: 1px solid var(--accent-color); color: var(--accent-color); border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; transition: all 0.2s;" onmouseover="this.style.background='var(--accent-color)';this.style.color='#0d3320'" onmouseout="this.style.background='none';this.style.color='var(--accent-color)'">
          <i class="fas fa-sync-alt"></i>
        </button>
      </h3>
      
      <!-- Seletor de perfil de rentabilidade + comparativos -->
      <div style="margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span style="font-size: 0.75rem; color: var(--text-light);"><i class="fas fa-percentage"></i> Perfil Principal:</span>
          <span style="width: 12px; height: 12px; border-radius: 50%; background: ${CORES_PERFIS[0]}; display: inline-block;"></span>
          <select id="perfil-rentabilidade-analise" onchange="window.setPerfilAnalise(this.value)" style="padding: 0.3rem 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.75rem;">
            ${gerarOpcoesPerfilRentabilidade(perfilAnaliseSelecionado)}
          </select>
          <button onclick="window.adicionarPerfilComparativo()" style="background: rgba(212,175,55,0.2); border: 1px solid var(--accent-color); border-radius: 4px; color: var(--accent-color); cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.7rem;" title="Adicionar perfil para comparação">
            <i class="fas fa-plus"></i> Comparar
          </button>
        </div>
        ${perfisComparativosHTML}
      </div>
      
      <!-- Gráfico -->
      <div style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <canvas id="grafico-evolucao-patrimonial" height="300"></canvas>
      </div>
      
      <!-- Resumo dos Objetivos - Layout lado a lado quando há perfis comparativos -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="background: var(--card-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem; flex: 1; min-width: 300px;">
          <h4 style="color: var(--accent-color); margin: 0 0 0.8rem 0; font-size: 0.85rem;">
            <i class="fas fa-clipboard-check"></i> Resultado da Análise - ${getNomePerfilRentabilidade(perfilAnaliseSelecionado)}
          </h4>
          ${renderResumoAnalise(simulacao, objetivosAposentadoria, objetivosNormais, null)}
          ${objetivosIntangiveis.length > 0 ? renderResumoIntangiveis(objetivosIntangiveis) : ''}
        </div>
        ${simulacoesComparativas.map((comp, idx) => `
        <div style="background: var(--card-bg); border: 1px solid ${coresComparativas[idx] || CORES_PERFIS[(idx+1) % CORES_PERFIS.length]}; border-radius: 8px; padding: 1rem; flex: 1; min-width: 300px;">
          <h4 style="color: ${coresComparativas[idx] || CORES_PERFIS[(idx+1) % CORES_PERFIS.length]}; margin: 0 0 0.8rem 0; font-size: 0.85rem;">
            <i class="fas fa-clipboard-check"></i> Resultado da Análise - ${getNomePerfilRentabilidade(comp.perfilId)}
          </h4>
          ${renderResumoAnalise(comp.simulacao, objetivosAposentadoria, objetivosNormais, null)}
        </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Renderizar gráfico após DOM estar pronto
  setTimeout(() => renderGraficoEvolucao(simulacao, objetivosNormais, objetivosAposentadoria, simulacoesComparativas, coresComparativas), 50);
}

function getPerfilAnalise() {
  return perfilAnaliseSelecionado || 'mod';
}

// MELHORIA 2: Simulação com recorrência correta
function simularEvolucaoPatrimonial(aposentadorias, objetivosNormais, perfilIdOverride) {
  const pessoas = getPessoasDisponiveis();
  const perfilId = perfilIdOverride || getPerfilAnalise();
  const rentAnual = getRentabilidadePorPerfil(perfilId);
  const rentMensal = Math.pow(1 + rentAnual / 100, 1/12) - 1;

  
  // Determinar horizonte total (até a maior aposentadoria)
  let maxMeses = 360; // 30 anos padrão
  aposentadorias.forEach(obj => {
    const meses = calcularMesesRestantesObj(obj, pessoas);
    if (meses > maxMeses) maxMeses = meses;
  });
  
  // Calcular capital necessário total para aposentadorias
  const rentAposent = variaveisMercado.rent_anual_aposentadoria || 6.0;
  let capitalNecessarioTotal = 0;
  aposentadorias.forEach(obj => {
    const rendaAnual = obj.renda_anual || 0;
    const capital = rentAposent > 0 ? rendaAnual / (rentAposent / 100) : 0;
    capitalNecessarioTotal += capital;
  });
  
  // Patrimonio inicial = soma de todos os valores iniciais
  let patrimonioInicial = calcularPatrimonioParaObjetivos();
  
  // Aportes totais
  const aportesTotais = calcularAportesTotaisDisponiveis();
  const aporteMensal = aportesTotais.mensal;
  const aporteAnual = aportesTotais.anual;
  
  // Preparar objetivos com seus dados de simulação
  const objSimData = objetivosNormais.map(obj => {
    const mesesPrazo = calcularMesesRestantesObjNormal(obj);
    const valorSaque = obj.meta_acumulo || 0;
    const isAcumulo = obj.acumulavel;
    const recTipo = obj.recorrencia_tipo || 'nenhuma';
    let recValor = obj.recorrencia_valor || 0;
    if (recTipo === 'anos' && recValor === 0) recValor = 1;
    if (recTipo === 'meses' && recValor === 0) recValor = 12;
    const intervaloMeses = (recTipo !== 'nenhuma' && recValor > 0) ? (recTipo === 'anos' ? recValor * 12 : recValor) : 0;
    
    return {
      id: obj.id,
      descricao: obj.descricao || 'Objetivo',
      valor: valorSaque,
      isAcumulo: isAcumulo,
      prioridade: obj.prioridade,
      vinculado_a: obj.vinculado_a || null,
      mesDesejado: mesesPrazo,
      intervaloMeses: intervaloMeses,
      recTipo: recTipo,
      realizadoPrimeiraVez: false,
      mesUltimaRealizacao: -1,
      proximoMesRecorrencia: -1
    };
  }).filter(o => o.valor > 0 && o.mesDesejado > 0);
  
  // Simular mês a mês
  const pontos = [];
  const eventosMarcados = [];
  let saldo = patrimonioInicial;
  let somaAportes = 0;
  
  // Fila de objetivos pendentes (não realizados no prazo)
  const pendentes = []; // { objData, isRecorrente }
  
  // Ponto 0
  pontos.push({ mes: 0, saldo: saldo, ano: new Date().getFullYear() });
  
  for (let mes = 1; mes <= maxMeses; mes++) {
    // Aporte mensal
    saldo += aporteMensal;
    somaAportes += aporteMensal;
    
    // Aporte anual (a cada 12 meses)
    if (mes % 12 === 0 && aporteAnual > 0) {
      saldo += aporteAnual;
      somaAportes += aporteAnual;
    }
    
    // Rentabilidade
    saldo = saldo * (1 + rentMensal);
    
    // Coletar eventos que devem ser tentados neste mês
    const tentativasDoMes = [];
    
    // 1. Verificar objetivos cujo prazo desejado é este mês (primeira vez)
    objSimData.forEach(o => {
      if (o.mesDesejado === mes && !o.realizadoPrimeiraVez) {
        tentativasDoMes.push({ objData: o, isRecorrente: false });
      }
    });
    
    // 2. Verificar recorrências agendadas para este mês
    objSimData.forEach(o => {
      if (o.realizadoPrimeiraVez && o.proximoMesRecorrencia === mes) {
        tentativasDoMes.push({ objData: o, isRecorrente: true });
      }
    });
    
    // 3. Adicionar pendentes (objetivos atrasados tentando realizar)
    const pendentesDoMes = [...pendentes];
    pendentes.length = 0; // Limpar - serão re-adicionados se falharem novamente
    pendentesDoMes.forEach(p => {
      tentativasDoMes.push(p);
    });
    
    // Ordenar tentativas: pais antes de filhos (vinculação), depois por prioridade
    tentativasDoMes.sort((a, b) => {
      // Se B está vinculado a A, A deve vir antes de B
      if (b.objData.vinculado_a === a.objData.id) return -1;
      if (a.objData.vinculado_a === b.objData.id) return 1;
      // Se ambos são filhos de pais diferentes, ou nenhum é vinculado, usar prioridade
      return a.objData.prioridade - b.objData.prioridade;
    });
    
    // Processar cada tentativa
    tentativasDoMes.forEach(tentativa => {
      const o = tentativa.objData;
      const isRecorrente = tentativa.isRecorrente;
      
      // Verificar vinculação: se vinculado a outro, o pai precisa ter sido realizado pelo menos 1 vez
      if (o.vinculado_a) {
        const pai = objSimData.find(x => x.id === o.vinculado_a);
        if (pai && !pai.realizadoPrimeiraVez) {
          // Pai ainda não foi realizado - manter pendente
          pendentes.push(tentativa);
          return;
        }
      }
      
      if (!o.isAcumulo) {
        // Saque - verificar se há saldo suficiente
        const saldoAntes = saldo;
        const sucesso = saldo >= o.valor;
        if (sucesso) {
          saldo -= o.valor;
          if (!o.realizadoPrimeiraVez) {
            o.realizadoPrimeiraVez = true;
          }
          o.mesUltimaRealizacao = mes;
          // Agendar próxima recorrência a partir do mês REAL de realização
          if (o.intervaloMeses > 0) {
            o.proximoMesRecorrencia = mes + o.intervaloMeses;
          }
          
          const comAtraso = tentativa.isPendente || false;
          const mesOriginal = tentativa.mesFalhaOriginal || mes;
          eventosMarcados.push({
            mes: mes,
            tipo: 'saque',
            valor: o.valor,
            descricao: isRecorrente ? o.descricao + ' (rec.)' : o.descricao,
            saldoAntes: saldoAntes,
            saldoApos: saldo,
            sucesso: true,
            isRecorrente: isRecorrente,
            objetivoId: o.id,
            comAtraso: comAtraso,
            mesOriginal: mesOriginal
          });
        } else {
          // Saldo insuficiente - marcar como pendente para tentar no próximo mês
          if (!tentativa.isPendente) {
            // Registrar evento de falha no mês original (quando deveria ter acontecido)
            tentativa.isPendente = true;
            tentativa.mesFalhaOriginal = mes;
          }
          pendentes.push(tentativa);
        }
      } else {
        // Acúmulo - não saca, apenas marca que atingiu
        const atingido = saldo >= o.valor;
        if (atingido) {
          if (!o.realizadoPrimeiraVez) {
            o.realizadoPrimeiraVez = true;
          }
          o.mesUltimaRealizacao = mes;
          if (o.intervaloMeses > 0) {
            o.proximoMesRecorrencia = mes + o.intervaloMeses;
          }
          const comAtraso = tentativa.isPendente || false;
          const mesOriginal = tentativa.mesFalhaOriginal || mes;
          eventosMarcados.push({
            mes: mes,
            tipo: 'acumulo',
            valor: o.valor,
            descricao: isRecorrente ? o.descricao + ' (rec.)' : o.descricao,
            saldoAntes: saldo,
            saldoApos: saldo,
            sucesso: true,
            isRecorrente: isRecorrente,
            objetivoId: o.id,
            comAtraso: comAtraso,
            mesOriginal: mesOriginal
          });
        } else {
          // Manter pendente para tentar no próximo mês
          if (!tentativa.isPendente) {
            tentativa.isPendente = true;
            tentativa.mesFalhaOriginal = mes;
          }
          pendentes.push(tentativa);
        }
      }
    });
    
    const dataEstimada = new Date();
    dataEstimada.setMonth(dataEstimada.getMonth() + mes);
    
    pontos.push({
      mes: mes,
      saldo: saldo,
      ano: dataEstimada.getFullYear()
    });
  }
  
  // Registrar eventos de falha para objetivos que nunca se concretizaram
  pendentes.forEach(tentativa => {
    const o = tentativa.objData;
    const isRecorrente = tentativa.isRecorrente;
    eventosMarcados.push({
      mes: tentativa.mesFalhaOriginal || o.mesDesejado,
      tipo: o.isAcumulo ? 'acumulo' : 'saque',
      valor: o.valor,
      descricao: isRecorrente ? o.descricao + ' (rec.)' : o.descricao,
      saldoAntes: saldo,
      saldoApos: saldo,
      sucesso: false,
      isRecorrente: isRecorrente,
      objetivoId: o.id,
      naoConcretizado: true
    });
  });
  
  // Registrar recorrências que deveriam ter acontecido mas não puderam
  // (porque o objetivo base ainda estava pendente no fim da simulação)
  objSimData.forEach(o => {
    if (o.intervaloMeses > 0 && o.realizadoPrimeiraVez) {
      // Verificar se há recorrências agendadas que não foram processadas
      // (o proximoMesRecorrencia ficou além do maxMeses - já estão fora do período, ok)
    }
  });
  
  // Ordenar eventos por mês para exibição correta
  eventosMarcados.sort((a, b) => a.mes - b.mes);
  
  // Capital necessário (sem correção por inflação)
  const capitalNecessarioCorrigido = capitalNecessarioTotal;
  
  return {
    pontos: pontos,
    eventos: eventosMarcados,
    capitalNecessarioTotal: capitalNecessarioTotal,
    capitalNecessarioCorrigido: capitalNecessarioCorrigido,
    patrimonioInicial: patrimonioInicial,
    patrimonioFinal: saldo,
    maxMeses: maxMeses,
    aporteMensal: aporteMensal,
    aporteAnual: aporteAnual,
    rentAnual: rentAnual,
    perfilId: perfilId
  };
}

function calcularMesesRestantesObj(obj, pessoas) {
  const prazoTipo = obj.prazo_tipo || 'idade';
  // Usar data de referência da reunião, não hoje
  const dataRef = variaveisMercado.data_reuniao ? new Date(variaveisMercado.data_reuniao + 'T00:00:00') : new Date();
  
  if (prazoTipo === 'data' && obj.prazo_data) {
    const dataAlvo = new Date(obj.prazo_data);
    return Math.max(0, Math.round((dataAlvo - dataRef) / (1000 * 60 * 60 * 24 * 30.44)));
  } else if (prazoTipo === 'meses') {
    return obj.prazo_meses || 360;
  } else if (prazoTipo === 'anos') {
    return obj.prazo_meses || 360;
  } else {
    // idade — calcular idade na data de referência
    const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa);
    const dataNasc = pessoa?.dataNascimento;
    let idadeNaRef = 30;
    if (dataNasc) {
      const nasc = new Date(dataNasc);
      idadeNaRef = dataRef.getFullYear() - nasc.getFullYear();
      const m = dataRef.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && dataRef.getDate() < nasc.getDate())) idadeNaRef--;
    } else if (pessoa) {
      idadeNaRef = pessoa.idade;
    }
    const idadeAposentadoria = obj.prazo_idade || 65;
    return Math.max(0, (idadeAposentadoria - idadeNaRef) * 12);
  }
}

function calcularMesesRestantesObjNormal(obj) {
  const prazoTipo = obj.prazo_tipo || 'meses';
  if (prazoTipo === 'data' && obj.prazo_data) {
    let dataAlvo = new Date(obj.prazo_data);
    // Se a data é inválida, tentar parsear formato BR (DD/MM/YYYY)
    if (isNaN(dataAlvo)) {
      const partes = String(obj.prazo_data).split('/');
      if (partes.length === 3) {
        // DD/MM/YYYY -> YYYY-MM-DD
        dataAlvo = new Date(`${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`);
      }
    }
    if (isNaN(dataAlvo)) return 60; // Fallback se ainda inválido
    const hoje = new Date();
    const meses = Math.round((dataAlvo - hoje) / (1000 * 60 * 60 * 24 * 30.44));
    return Math.max(1, meses); // Mínimo 1 mês para garantir que eventos sejam criados
  } else if (prazoTipo === 'anos') {
    return obj.prazo_meses || 60;
  } else {
    return obj.prazo_meses || 60;
  }
}

// MELHORIA 5: Gráfico com múltiplos perfis
function renderGraficoEvolucao(simulacao, objetivosNormais, aposentadorias, simulacoesComparativas, coresComparativas) {
  const canvas = document.getElementById('grafico-evolucao-patrimonial');
  if (!canvas) return;
  
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  
  // Cada ponto = 1 mês (sem intervalo)
  const labels = [];
  const dataSaldo = [];
  const hoje = new Date();
  
  simulacao.pontos.forEach(ponto => {
    const dataRef = new Date(hoje);
    dataRef.setMonth(dataRef.getMonth() + ponto.mes);
    const mesStr = String(dataRef.getMonth() + 1).padStart(2, '0');
    const anoStr = String(dataRef.getFullYear()).slice(-2);
    labels.push(`${mesStr}/${anoStr}`);
    dataSaldo.push(ponto.saldo);
  });
  
  // Linha do capital necessário para aposentadoria
  const metaAposentadoria = Array(labels.length).fill(simulacao.capitalNecessarioCorrigido);
  

  
  const datasets = [
    {
      label: `Patrimônio (${getNomePerfilRentabilidade(perfilAnaliseSelecionado)})`,
      data: dataSaldo,
      borderColor: CORES_PERFIS[0],
      backgroundColor: 'rgba(40, 167, 69, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2
    },
    {
      label: 'Meta Aposentadoria',
      data: metaAposentadoria,
      borderColor: '#d4af37',
      borderDash: [8, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false
    }
  ];
  
  // MELHORIA 5: Adicionar linhas dos perfis comparativos com cores dinâmicas
  if (simulacoesComparativas && simulacoesComparativas.length > 0) {
    simulacoesComparativas.forEach((comp, index) => {
      const corDinamica = (coresComparativas && coresComparativas[index]) || CORES_PERFIS[(index + 1) % CORES_PERFIS.length];
      const dataComp = comp.simulacao.pontos.map(p => p.saldo);
      datasets.push({
        label: `Patrimônio (${getNomePerfilRentabilidade(comp.perfilId)})`,
        data: dataComp,
        borderColor: corDinamica,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [4, 2]
      });
    });
  }
  
  // Coletar índices de eventos para traços verticais (sem figuras geométricas)
  const linhasVerticaisSaque = []; // cor verde - saques no prazo
  const linhasVerticaisRecorrencia = []; // cor laranja - recorrências
  const linhasVerticaisAtraso = []; // cor amarela - realizados com atraso
  const linhasVerticaisFalha = []; // cor vermelha - não concretizados
  
  simulacao.eventos.forEach(evento => {
    const posicao = Math.min(evento.mes, labels.length - 1);
    if (evento.tipo === 'saque' || evento.tipo === 'acumulo') {
      if (!evento.sucesso && evento.naoConcretizado) {
        linhasVerticaisFalha.push({ pos: posicao });
      } else if (evento.sucesso && evento.comAtraso) {
        linhasVerticaisAtraso.push({ pos: posicao });
      } else if (evento.isRecorrente && evento.sucesso) {
        linhasVerticaisRecorrencia.push({ pos: posicao, sucesso: evento.sucesso });
      } else if (evento.sucesso) {
        linhasVerticaisSaque.push({ pos: posicao, sucesso: evento.sucesso });
      }
    }
  });
  
  // Datasets fictícios apenas para legenda
  if (linhasVerticaisSaque.length > 0) {
    datasets.push({
      label: 'Realização no Prazo',
      data: Array(labels.length).fill(null),
      borderColor: '#28a745',
      backgroundColor: '#28a745',
      pointRadius: 0,
      showLine: false,
      borderWidth: 2
    });
  }
  if (linhasVerticaisAtraso.length > 0) {
    datasets.push({
      label: 'Realização com Atraso',
      data: Array(labels.length).fill(null),
      borderColor: '#ffc107',
      backgroundColor: '#ffc107',
      pointRadius: 0,
      showLine: false,
      borderWidth: 2
    });
  }
  if (linhasVerticaisRecorrencia.length > 0) {
    datasets.push({
      label: 'Recorrência',
      data: Array(labels.length).fill(null),
      borderColor: '#ff8c00',
      backgroundColor: '#ff8c00',
      pointRadius: 0,
      showLine: false,
      borderWidth: 2
    });
  }
  if (linhasVerticaisFalha.length > 0) {
    datasets.push({
      label: 'Não Concretizado',
      data: Array(labels.length).fill(null),
      borderColor: '#dc3545',
      backgroundColor: '#dc3545',
      pointRadius: 0,
      showLine: false,
      borderWidth: 2
    });
  }
  
  // Plugin customizado para desenhar traços verticais discretos
  const verticalLinesPlugin = {
    id: 'verticalLines',
    afterDraw: function(chart) {
      const ctx = chart.ctx;
      const xAxis = chart.scales.x;
      const yAxis = chart.scales.y;
      const chartArea = chart.chartArea;
      
      // Desenhar traços verticais para saques no prazo (verde)
      linhasVerticaisSaque.forEach(linha => {
        const x = xAxis.getPixelForValue(linha.pos);
        if (x >= chartArea.left && x <= chartArea.right) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(40, 167, 69, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        }
      });
      
      // Desenhar traços verticais para realizações com atraso (amarelo)
      linhasVerticaisAtraso.forEach(linha => {
        const x = xAxis.getPixelForValue(linha.pos);
        if (x >= chartArea.left && x <= chartArea.right) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 2]);
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        }
      });
      
      // Desenhar traços verticais para recorrências (laranja)
      linhasVerticaisRecorrencia.forEach(linha => {
        const x = xAxis.getPixelForValue(linha.pos);
        if (x >= chartArea.left && x <= chartArea.right) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
          ctx.lineWidth = 1;
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        }
      });
      
      // Desenhar traços verticais para não concretizados (vermelho tracejado)
      linhasVerticaisFalha.forEach(linha => {
        const x = xAxis.getPixelForValue(linha.pos);
        if (x >= chartArea.left && x <= chartArea.right) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(220, 53, 69, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        }
      });
    }
  };
  
  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    plugins: [verticalLinesPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          labels: {
            color: '#e8e8e8',
            font: { size: 11 },
            usePointStyle: true,
            generateLabels: function(chart) {
              const defaultLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              return defaultLabels.map(label => {
                if (label.text === 'Realização de Objetivo') {
                  label.pointStyle = 'line';
                  label.strokeStyle = '#dc3545';
                  label.fillStyle = '#dc3545';
                  label.lineWidth = 2;
                } else if (label.text === 'Recorrência') {
                  label.pointStyle = 'line';
                  label.strokeStyle = '#ff8c00';
                  label.fillStyle = '#ff8c00';
                  label.lineWidth = 2;
                }
                return label;
              });
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.parsed.y === null) return null;
              const label = context.dataset.label || '';
              const valor = formatarMoedaObj(context.parsed.y);
              // Para tooltip no mês de um evento, mostrar info do evento
              const mesIndex = context.dataIndex;
              const eventoNoMes = simulacao.eventos.find(e => e.mes === mesIndex);
              if (eventoNoMes && (label.includes('Patrimônio') || label.includes('Meta'))) {
                // Já será mostrado pelo dataset principal
              }
              if (label === 'Realização de Objetivo' || label === 'Recorrência') return null;
              return label + ': ' + valor;
            },
            afterBody: function(tooltipItems) {
              if (!tooltipItems.length) return '';
              const mesIndex = tooltipItems[0].dataIndex;
              const eventosNoMes = simulacao.eventos.filter(e => e.mes === mesIndex);
              if (eventosNoMes.length === 0) return '';
              return eventosNoMes.map(ev => {
                const tipo = ev.isRecorrente ? 'Recorr.' : 'Saque';
                const status = ev.sucesso ? '✔' : '✘';
                return `${status} ${tipo}: ${formatarMoedaObj(ev.valor)} - ${ev.descricao}`;
              });
            }
          },
          filter: function(tooltipItem) {
            return tooltipItem.parsed.y !== null;
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#aaa',
            font: { size: 8 },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 40
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: {
            color: '#aaa',
            font: { size: 10 },
            callback: function(value) {
              if (value >= 1000000) return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return 'R$ ' + (value / 1000).toFixed(0) + 'k';
              return 'R$ ' + value;
            }
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

// MELHORIA 2: Resumo com informação de recorrência
function renderResumoAnalise(simulacao, aposentadorias, objetivosNormais, simulacoesComparativas) {
  const pessoas = getPessoasDisponiveis();
  let html = '';
  
  // Resumo dos objetivos
  if (objetivosNormais.length > 0) {
    html += `<div style="margin-bottom: 1rem;">`;
    html += `<h5 style="color: var(--accent-color); margin: 0 0 0.5rem 0; font-size: 0.8rem;"><i class="fas fa-bullseye"></i> Objetivos</h5>`;
    html += `<div style="display: flex; flex-direction: column; gap: 0.3rem;">`;
    
    objetivosNormais.forEach(obj => {
      const mesesPrazo = calcularMesesRestantesObjNormal(obj);
      const valorMeta = obj.meta_acumulo || 0;
      const recTipo = obj.recorrencia_tipo || 'nenhuma';
      // Usar valor padrão se recorrencia_valor for 0 mas tipo está definido
      let recValor = obj.recorrencia_valor || 0;
      if (recTipo === 'anos' && recValor === 0) recValor = 1;
      if (recTipo === 'meses' && recValor === 0) recValor = 12;
      
      // Encontrar o evento de realização real deste objetivo na simulação
      const primeiroEventoObj = simulacao.eventos.find(e => e.objetivoId === obj.id && !e.isRecorrente && e.sucesso);
      const primeiroEventoFalha = simulacao.eventos.find(e => e.objetivoId === obj.id && !e.isRecorrente && !e.sucesso);
      let mesRealizacao = primeiroEventoObj ? primeiroEventoObj.mes : -1;
      const comAtraso = primeiroEventoObj ? (primeiroEventoObj.comAtraso || false) : false;
      const mesOriginalPrimeiro = primeiroEventoObj ? (primeiroEventoObj.mesOriginal || mesRealizacao) : mesesPrazo;
      
      // Se não há evento de sucesso, verificar se o saldo atinge a meta em algum ponto
      if (mesRealizacao === -1) {
        for (let i = 0; i < simulacao.pontos.length; i++) {
          if (simulacao.pontos[i].saldo >= valorMeta) {
            mesRealizacao = simulacao.pontos[i].mes;
            break;
          }
        }
      }
      
      const atingido = mesRealizacao >= 0;
      const dentroDoPrazo = atingido && mesRealizacao <= mesesPrazo;
      
      // Data provável de realização
      let dataProvavelTexto = '';
      if (atingido) {
        const dataProvavel = new Date();
        dataProvavel.setMonth(dataProvavel.getMonth() + mesRealizacao);
        const mesNome = String(dataProvavel.getMonth() + 1).padStart(2, '0');
        dataProvavelTexto = `${mesNome}/${dataProvavel.getFullYear()}`;
      }
      
      // Prazo desejado
      const prazoDesejado = new Date();
      prazoDesejado.setMonth(prazoDesejado.getMonth() + mesesPrazo);
      const prazoMesNome = String(prazoDesejado.getMonth() + 1).padStart(2, '0');
      const prazoDesejadoTexto = `${prazoMesNome}/${prazoDesejado.getFullYear()}`;
      
      // MELHORIA 2: Informação de recorrência
      let recTexto = '';
      let recDetalhe = '';
      if (recTipo !== 'nenhuma' && recValor > 0) {
        recTexto = ` <span style="font-size: 0.6rem; color: #ff8c00; font-weight: 600;"><i class="fas fa-redo"></i> a cada ${recValor} ${recTipo === 'anos' ? 'ano(s)' : 'meses'}</span>`;
        
        // Contar quantas vezes o objetivo recorrente foi executado com sucesso
        const eventosDoObj = simulacao.eventos.filter(e => e.objetivoId === obj.id);
        const eventosSucesso = eventosDoObj.filter(e => e.sucesso);
        const eventosFalha = eventosDoObj.filter(e => !e.sucesso);
        
        if (eventosDoObj.length > 0) {
          const eventosComAtraso = eventosDoObj.filter(e => e.sucesso && e.comAtraso);
          const eventosNaoConcretizados = eventosDoObj.filter(e => !e.sucesso && e.naoConcretizado);
          const eventosNoPrazo = eventosSucesso.filter(e => !e.comAtraso);
          
          recDetalhe = `<div style="font-size: 0.65rem; color: #ff8c00; margin-top: 0.3rem; padding: 0.4rem 0.5rem; background: rgba(255,140,0,0.08); border-radius: 4px; border: 1px solid rgba(255,140,0,0.2);">`;
          recDetalhe += `<div style="margin-bottom: 0.3rem;"><i class="fas fa-redo"></i> <strong>Recorrência (${recValor} ${recTipo === 'anos' ? 'ano(s)' : 'meses'}):</strong> ${eventosSucesso.length} realizada(s)`;
          if (eventosComAtraso.length > 0) recDetalhe += ` (${eventosComAtraso.length} com atraso)`;
          if (eventosNaoConcretizados.length > 0) recDetalhe += ` | <span style="color: #dc3545;">${eventosNaoConcretizados.length} não concretizada(s)</span>`;
          recDetalhe += `</div>`;
          
          // Listar TODAS as datas de execução com status
          recDetalhe += `<div style="display: flex; flex-wrap: wrap; gap: 0.2rem 0.5rem; margin-top: 0.2rem;">`;
          eventosDoObj.forEach(ev => {
            const dataEv = new Date();
            dataEv.setMonth(dataEv.getMonth() + ev.mes);
            const dataTexto = `${String(dataEv.getMonth()+1).padStart(2,'0')}/${dataEv.getFullYear()}`;
            let cor, icone, sufixo = '';
            if (ev.sucesso && ev.comAtraso) {
              cor = '#ffc107'; // amarelo para atraso
              icone = 'exclamation-circle';
              const dataOriginal = new Date();
              dataOriginal.setMonth(dataOriginal.getMonth() + ev.mesOriginal);
              sufixo = ` (prevista ${String(dataOriginal.getMonth()+1).padStart(2,'0')}/${dataOriginal.getFullYear()})`;
            } else if (ev.sucesso) {
              cor = '#28a745';
              icone = 'check-circle';
            } else if (ev.naoConcretizado) {
              cor = '#dc3545';
              icone = 'ban';
              sufixo = ' (não concretizada)';
            } else {
              cor = '#dc3545';
              icone = 'times-circle';
            }
            const tipoLabel = ev.isRecorrente ? '' : ' (1ª)';
            recDetalhe += `<span style="color: ${cor}; font-size: 0.6rem;"><i class="fas fa-${icone}"></i> ${dataTexto}${tipoLabel}${sufixo}</span>`;
          });
          recDetalhe += `</div>`;
          
          // Detalhar períodos de falha e recuperação (resumo)
          let emFalha = false;
          let inicioFalha = null;
          let periodos = [];
          eventosDoObj.forEach((ev, idx) => {
            if (!ev.sucesso && !emFalha) {
              emFalha = true;
              inicioFalha = ev.mes;
            } else if (ev.sucesso && emFalha) {
              emFalha = false;
              periodos.push({ tipo: 'falha', inicio: inicioFalha, fim: eventosDoObj[idx-1].mes });
              periodos.push({ tipo: 'recupera', mes: ev.mes });
            }
          });
          if (emFalha) {
            periodos.push({ tipo: 'falha_permanente', inicio: inicioFalha });
          }
          
          if (periodos.length > 0) {
            recDetalhe += `<div style="margin-top: 0.3rem; padding-top: 0.2rem; border-top: 1px solid rgba(255,140,0,0.2);">`;
            periodos.forEach(p => {
              const dataRef = new Date();
              if (p.tipo === 'falha') {
                dataRef.setMonth(dataRef.getMonth() + p.inicio);
                const dataFim = new Date();
                dataFim.setMonth(dataFim.getMonth() + p.fim);
                recDetalhe += `<div style="color: #dc3545; font-size: 0.6rem;"><i class="fas fa-exclamation-triangle"></i> Período de falha: ${String(dataRef.getMonth()+1).padStart(2,'0')}/${dataRef.getFullYear()} a ${String(dataFim.getMonth()+1).padStart(2,'0')}/${dataFim.getFullYear()}</div>`;
              } else if (p.tipo === 'recupera') {
                dataRef.setMonth(dataRef.getMonth() + p.mes);
                recDetalhe += `<div style="color: #28a745; font-size: 0.6rem;"><i class="fas fa-check-circle"></i> Recupera em: ${String(dataRef.getMonth()+1).padStart(2,'0')}/${dataRef.getFullYear()}</div>`;
              } else if (p.tipo === 'falha_permanente') {
                dataRef.setMonth(dataRef.getMonth() + p.inicio);
                recDetalhe += `<div style="color: #dc3545; font-size: 0.6rem;"><i class="fas fa-ban"></i> Falha permanente a partir de: ${String(dataRef.getMonth()+1).padStart(2,'0')}/${dataRef.getFullYear()}</div>`;
              }
            });
            recDetalhe += `</div>`;
          }
          
          recDetalhe += `</div>`;
        }
      }
      
      // Status e cor
      let statusTexto, statusCor;
      if (!atingido) {
        statusTexto = 'Nunca atingível';
        statusCor = '#dc3545';
      } else if (dentroDoPrazo && !comAtraso) {
        statusTexto = 'No prazo';
        statusCor = '#28a745';
      } else if (comAtraso) {
        statusTexto = 'Realizado com atraso';
        statusCor = '#ffc107';
      } else {
        statusTexto = 'Fora do prazo';
        statusCor = '#ffc107';
      }
      
      html += `
        <div style="padding: 0.3rem 0.5rem; background: rgba(${!atingido ? '220, 53, 69' : dentroDoPrazo ? '40, 167, 69' : '255, 193, 7'}, 0.1); border-radius: 4px; border-left: 3px solid ${statusCor};">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.7rem; color: var(--accent-color); font-weight: 600; min-width: 20px;">${obj.prioridade}º</span>
            <span style="font-size: 0.75rem; color: var(--text-light); flex: 1;">${obj.descricao || 'Sem descrição'}${recTexto}</span>
            <span style="font-size: 0.7rem; color: var(--text-light);">${formatarMoedaObj(valorMeta)}</span>
            <span style="font-size: 0.65rem; color: var(--text-light);">Prazo: ${prazoDesejadoTexto}</span>
            <span style="font-size: 0.65rem; color: ${statusCor};">${atingido ? `Realiz.: ${dataProvavelTexto}` : ''}</span>
            <span style="font-size: 0.7rem; font-weight: 600; color: ${statusCor};">
              <i class="fas fa-${!atingido ? 'times-circle' : dentroDoPrazo ? 'check-circle' : 'exclamation-circle'}"></i> ${statusTexto}
            </span>
          </div>
          ${recDetalhe}
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  // (Comparativo agora é feito via layout lado a lado no container pai)
  
  // Resumo das aposentadorias
  if (aposentadorias.length > 0) {
    const rentAposent = variaveisMercado.rent_anual_aposentadoria || 6.0;
    let capitalTotal = 0;
    let detalhesAposent = [];
    
    aposentadorias.forEach(obj => {
      const rendaAnual = obj.renda_anual || 0;
      const capital = rentAposent > 0 ? rendaAnual / (rentAposent / 100) : 0;
      capitalTotal += capital;
      const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa);
      detalhesAposent.push({
        nome: pessoa ? pessoa.nome : 'N/A',
        rendaAnual: rendaAnual,
        capitalNecessario: capital
      });
    });
    
    const patrimonioFinal = simulacao.patrimonioFinal;
    const capitalCorrigido = simulacao.capitalNecessarioCorrigido;
    const atingeAposentadoria = patrimonioFinal >= capitalCorrigido;
    const percentualAtingido = capitalCorrigido > 0 ? (patrimonioFinal / capitalCorrigido * 100) : 0;
    
    html += `<div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid rgba(40, 167, 69, 0.3);">`;
    html += `<h5 style="color: #28a745; margin: 0 0 0.5rem 0; font-size: 0.8rem;"><i class="fas fa-umbrella-beach"></i> Aposentadoria</h5>`;
    
    // Detalhes por pessoa
    detalhesAposent.forEach(d => {
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0.5rem; font-size: 0.7rem; color: var(--text-light);">
          <span><i class="fas fa-user"></i> ${d.nome}</span>
          <span>Renda: ${formatarMoedaObj(d.rendaAnual)}/ano</span>
          <span>Capital: ${formatarMoedaObj(d.capitalNecessario)}</span>
        </div>
      `;
    });
    
    // Resultado consolidado
    html += `
      <div style="margin-top: 0.5rem; padding: 0.6rem; background: rgba(${atingeAposentadoria ? '40, 167, 69' : '220, 53, 69'}, 0.15); border-radius: 6px; border: 1px solid ${atingeAposentadoria ? '#28a745' : '#dc3545'};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="font-size: 0.7rem; color: var(--text-light);">Capital Necessário Total:</div>
            <div style="font-size: 1rem; font-weight: 600; color: ${atingeAposentadoria ? '#28a745' : '#dc3545'};">${formatarMoedaObj(capitalCorrigido)}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--text-light);">Patrimônio Projetado Final:</div>
            <div style="font-size: 1rem; font-weight: 600; color: ${atingeAposentadoria ? '#28a745' : '#dc3545'};">${formatarMoedaObj(patrimonioFinal)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-light);">Atingimento:</div>
            <div style="font-size: 1.1rem; font-weight: 700; color: ${atingeAposentadoria ? '#28a745' : '#dc3545'};">
              ${percentualAtingido.toFixed(1)}%
              <i class="fas fa-${atingeAposentadoria ? 'check-circle' : 'exclamation-triangle'}"></i>
            </div>
          </div>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: ${atingeAposentadoria ? '#28a745' : '#dc3545'}; text-align: center; font-weight: 600;">
          ${atingeAposentadoria 
            ? '<i class="fas fa-party-horn"></i> Todas as aposentadorias desejadas serão atingidas com o plano atual!' 
            : `<i class="fas fa-exclamation-triangle"></i> Faltam ${formatarMoedaObj(capitalCorrigido - patrimonioFinal)} para atingir todas as aposentadorias. Considere aumentar aportes ou prazo.`
          }
        </div>
      </div>
    `;
    html += `</div>`;
  }
  
  // Somatório de aportes mensais necessários
  let totalAporteMensal = 0;
  aposentadorias.forEach(obj => {
    const rendaAnual = obj.renda_anual || 0;
    const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
    const capitalNec = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
    const meses = calcularMesesRestantesObj(obj, pessoas);
    totalAporteMensal += calcularAporteMensalNecessario(capitalNec, obj.valor_inicial || 0, meses, null);
  });
  objetivosNormais.forEach(obj => {
    const meta = obj.meta_acumulo || 0;
    const meses = calcularMesesRestantesObjNormal(obj);
    totalAporteMensal += calcularAporteMensalNecessario(meta, obj.valor_inicial || 0, meses, null);
  });
  
  if (totalAporteMensal > 0) {
    const aportesDisponiveis = calcularAportesTotaisDisponiveis();
    const aporteDisponivel = aportesDisponiveis.mensal + (aportesDisponiveis.anual / 12);
    const suficiente = aporteDisponivel >= totalAporteMensal;
    html += `
      <div style="margin-top: 0.8rem; padding: 0.6rem; background: rgba(${suficiente ? '40, 167, 69' : '220, 53, 69'}, 0.1); border-radius: 6px; border: 1px solid ${suficiente ? '#28a745' : '#dc3545'};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="font-size: 0.7rem; color: var(--text-light);"><i class="fas fa-coins"></i> Aporte Mensal Necessário Total:</div>
            <div style="font-size: 1rem; font-weight: 600; color: ${suficiente ? '#28a745' : '#dc3545'};">${formatarMoedaObj(totalAporteMensal)}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: var(--text-light);"><i class="fas fa-piggy-bank"></i> Aporte Disponível (mensal):</div>
            <div style="font-size: 1rem; font-weight: 600; color: ${suficiente ? '#28a745' : '#dc3545'};">${formatarMoedaObj(aporteDisponivel)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-light);">Status:</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: ${suficiente ? '#28a745' : '#dc3545'};">
              <i class="fas fa-${suficiente ? 'check-circle' : 'exclamation-triangle'}"></i> ${suficiente ? 'Suficiente' : 'Insuficiente'}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  return html;
}

// MELHORIA 4: Resumo dos objetivos intangíveis na análise
function renderResumoIntangiveis(objetivosIntangiveis) {
  let html = `<div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid rgba(153, 102, 255, 0.3);">`;
  html += `<h5 style="color: #9966ff; margin: 0 0 0.5rem 0; font-size: 0.8rem;"><i class="fas fa-star"></i> Objetivos Intangíveis</h5>`;
  html += `<div style="display: flex; flex-direction: column; gap: 0.3rem;">`;
  
  objetivosIntangiveis.forEach(obj => {
    const mesesRestantes = calcularMesesRestantesObjNormal(obj);
    const prazoVencido = mesesRestantes <= 0;
    const marcos = obj.marcos || [];
    const marcosConcluidos = marcos.filter(m => m.concluido).length;
    const totalMarcos = marcos.length;
    const progressoMarcos = totalMarcos > 0 ? Math.round((marcosConcluidos / totalMarcos) * 100) : 0;
    
    let statusCor = '#9966ff';
    let statusTexto = 'Em andamento';
    if (prazoVencido) { statusCor = '#dc3545'; statusTexto = 'Prazo vencido'; }
    else if (totalMarcos > 0 && marcosConcluidos === totalMarcos) { statusCor = '#28a745'; statusTexto = 'Concluído'; }
    
    // Prazo
    const prazoDesejado = new Date();
    prazoDesejado.setMonth(prazoDesejado.getMonth() + mesesRestantes);
    const prazoTexto = `${String(prazoDesejado.getMonth()+1).padStart(2,'0')}/${prazoDesejado.getFullYear()}`;
    
    html += `
      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; background: rgba(153, 102, 255, 0.1); border-radius: 4px; border-left: 3px solid ${statusCor};">
        <span style="font-size: 0.75rem; color: var(--text-light); flex: 1;">${obj.descricao || 'Sem descrição'}</span>
        ${totalMarcos > 0 ? `<span style="font-size: 0.65rem; color: #9966ff;">${marcosConcluidos}/${totalMarcos} marcos (${progressoMarcos}%)</span>` : ''}
        <span style="font-size: 0.65rem; color: var(--text-light);">Prazo: ${prazoTexto}</span>
        <span style="font-size: 0.7rem; font-weight: 600; color: ${statusCor};">
          <i class="fas fa-${prazoVencido ? 'times-circle' : (totalMarcos > 0 && marcosConcluidos === totalMarcos) ? 'check-circle' : 'hourglass-half'}"></i> ${statusTexto}
        </span>
      </div>
    `;
  });
  
  html += `</div></div>`;
  return html;
}


// ========================================
// FUNÇÕES DE DADOS (EXPORTADAS)
// ========================================

// ========================================
// SEÇÃO: PERFIL FINANCEIRO
// ========================================

function renderPerfilFinanceiro() {
  const perfilAtual = PERFIS_FINANCEIROS.find(p => p.id === perfilFinanceiroData.perfil_selecionado);
  
  return `
    <div style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.75rem; color: var(--text-light); display: block; margin-bottom: 0.3rem;">Selecione o perfil financeiro do cliente:</label>
        <select onchange="window.setPerfilFinanceiro(this.value)" style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.85rem;">
          <option value="">-- Selecione --</option>
          ${PERFIS_FINANCEIROS.map(p => `
            <option value="${p.id}" ${perfilFinanceiroData.perfil_selecionado === p.id ? 'selected' : ''}>${p.emoji} ${p.nome}</option>
          `).join('')}
        </select>
      </div>
      
      ${perfilAtual ? `
      <div style="background: rgba(${hexToRgb(perfilAtual.cor)}, 0.08); border: 1px solid ${perfilAtual.cor}; border-radius: 8px; padding: 1rem; animation: fadeIn 0.3s ease;">
        <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem;">
          <span style="font-size: 2.5rem;">${perfilAtual.emoji}</span>
          <div>
            <h4 style="color: ${perfilAtual.cor}; margin: 0; font-size: 1rem;">${perfilAtual.nome}</h4>
          </div>
        </div>
        <p style="color: var(--text-light); font-size: 0.8rem; line-height: 1.5; margin: 0; font-style: italic;">
          "${perfilAtual.descricao}"
        </p>
      </div>
      ` : `
      <div style="text-align: center; padding: 1.5rem; opacity: 0.5;">
        <i class="fas fa-user-circle" style="font-size: 2rem; color: var(--text-light);"></i>
        <p style="color: var(--text-light); font-size: 0.75rem; margin: 0.5rem 0 0 0;">Selecione um perfil acima para ver a descrição</p>
      </div>
      `}
    </div>
  `;
}

// Função wrapper que renderiza no container do HTML
function renderPerfilFinanceiroSection() {
  const container = document.getElementById('perfil-financeiro-container');
  if (!container) return;
  container.innerHTML = renderPerfilFinanceiro();
  
  // Restaurar observações no textarea do HTML
  const obsTextarea = document.getElementById('obs_perfil_financeiro');
  if (obsTextarea && perfilFinanceiroData.observacoes) {
    obsTextarea.value = perfilFinanceiroData.observacoes;
  }
}

// ========================================
// SEÇÃO: INVESTIMENTO NA ASSISTÊNCIA FINANCEIRA
// ========================================

// Coeficientes de parcelamento fornecidos
const COEFICIENTES_PARCELAMENTO = {
  2: 1.052601114,
  3: 1.070604399,
  4: 1.088705319,
  5: 1.107099145,
  6: 1.125597581,
  7: 1.144409846,
  8: 1.163312772,
  9: 1.182505117,
  10: 1.201788124,
  11: 1.221318707,
  12: 1.241086404
};

// Calcula renda total do fluxo de caixa (todas as pessoas)
function calcularRendaTotal() {
  let rendaMensal = 0;
  let rendaAnual = 0;
  let restituicoesIR = 0;
  if (window.getFluxoCaixaData) {
    const fluxoData = window.getFluxoCaixaData();
    const receitas = fluxoData.receitas || [];
    receitas.forEach(r => {
      const valor = parseFloat(r.valor) || 0;
      // Somar restituições de IR separadamente
      if (r.origem === 'ir_restituicao') {
        restituicoesIR += valor; // sempre anual
      } else if (r.und_recorrencia === 'ano') {
        rendaAnual += valor;
      } else if (r.und_recorrencia === 'mes') {
        rendaMensal += valor;
      }
    });
  }
  return { mensal: rendaMensal, anual: rendaMensal * 12 + rendaAnual + restituicoesIR, restituicoesIR: restituicoesIR };
}

// Calcula tabela de parcelamento com coeficientes corretos
// valorAvista = valor base (à vista pix e cartão)
// O desconto é: (valorAvista * coef12x) - soma das parcelas da opção
function calcularTabelaParcelamento(valorAvista) {
  if (!valorAvista || valorAvista <= 0) return [];
  
  const valorRef12x = valorAvista * COEFICIENTES_PARCELAMENTO[12]; // valor máximo (sem desconto)
  const parcelas = [];
  
  // À vista Pix (= valorAvista)
  parcelas.push({
    label: 'À Vista no Pix',
    n: 1,
    valor_parcela: valorAvista,
    total: valorAvista,
    desconto: valorRef12x - valorAvista
  });
  
  // À vista Cartão (= valorAvista, mesmo valor)
  parcelas.push({
    label: 'À Vista no Cartão',
    n: 1,
    valor_parcela: valorAvista,
    total: valorAvista,
    desconto: valorRef12x - valorAvista
  });
  
  // 2x a 12x
  for (let n = 2; n <= 12; n++) {
    const totalN = valorAvista * COEFICIENTES_PARCELAMENTO[n];
    const parcelaN = totalN / n;
    const descontoN = valorRef12x - totalN;
    parcelas.push({
      label: `${n}x`,
      n: n,
      valor_parcela: parcelaN,
      total: totalN,
      desconto: descontoN
    });
  }
  
  return parcelas;
}

function renderInvestimentoAssistencia() {
  const renda = calcularRendaTotal();
  const mostrarEspecial = investimentoAssistenciaData.mostrar_especial || false;
  const qtdRecs = investimentoAssistenciaData.qtd_recomendacoes || 0;
  const propostaFinal = investimentoAssistenciaData.proposta_final || '';
  const planoSelecionado = investimentoAssistenciaData.plano_acompanhamento || '';
  
  // Oferta Ordinária: 2,2% da (renda anual - restituições de IR)
  const baseOrdinaria = renda.anual - (renda.restituicoesIR || 0);
  const valorAvistaOrdinaria = baseOrdinaria * 0.022;
  const parcelasOrdinaria = calcularTabelaParcelamento(valorAvistaOrdinaria);
  
  // Oferta Especial: 23% da renda mensal, com desconto adicional = qtdRecs%
  const valorBaseEspecial = renda.mensal * 0.23;
  const valorAvistaEspecial = valorBaseEspecial * (1 - qtdRecs / 100);
  const parcelasEspecial = calcularTabelaParcelamento(valorAvistaEspecial);
  
  return `
    <div>
      <p style="color: var(--text-light); font-size: 0.7rem; margin: 0 0 1rem 0; font-style: italic; opacity: 0.8;">
        Adesão opcional a um planejamento financeiro inicial de referência para a vida financeira. Este plano pode ser ajustado conforme o tempo passa e as necessidades e condições se modificam.
      </p>
      
      <!-- PROPOSTAS -->
      <div style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-start;">
          
          <!-- PROPOSTA ORDINÁRIA -->
          <div style="flex: 1; min-width: 280px; border: 2px solid ${propostaFinal === 'ordinaria' ? '#28a745' : 'rgba(40, 167, 69, 0.3)'}; border-radius: 8px; padding: 0.8rem; position: relative;">
            ${propostaFinal === 'ordinaria' ? '<span style="position: absolute; top: -8px; right: 8px; background: #28a745; color: white; font-size: 0.55rem; padding: 0.1rem 0.4rem; border-radius: 3px;">SELECIONADA</span>' : ''}
            <h5 style="color: #28a745; margin: 0 0 0.3rem 0; font-size: 0.85rem; text-align: center;">
              <i class="fas fa-file-alt"></i> OFERTA ORDINÁRIA
            </h5>

            
            ${valorAvistaOrdinaria > 0 ? `
            <div style="text-align: center; margin-bottom: 0.5rem;">
              <span style="font-size: 0.65rem; color: var(--text-light);">Valor à vista:</span>
              <span style="color: #28a745; font-weight: 700; font-size: 1rem;"> ${formatarMoedaObj(valorAvistaOrdinaria)}</span>
            </div>
            <div style="max-height: 320px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 0.3rem; text-align: left; color: var(--text-light);">Forma</th>
                    <th style="padding: 0.3rem; text-align: right; color: var(--text-light);">Valor</th>
                    <th style="padding: 0.3rem; text-align: right; color: var(--text-light);">Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  ${parcelasOrdinaria.map((p, i) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${i <= 1 ? 'background: rgba(40,167,69,0.08);' : ''}">
                    <td style="padding: 0.25rem 0.3rem; color: #e8e8e8; font-size: 0.65rem;">${p.label}</td>
                    <td style="padding: 0.25rem 0.3rem; text-align: right; color: #28a745; font-weight: 600;">R$ ${p.valor_parcela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding: 0.25rem 0.3rem; text-align: right;">
                      ${p.desconto > 0.01 ? `<span style="background: rgba(255,193,7,0.15); color: #ffc107; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600;">-R$ ${p.desconto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>` : '<span style="color: var(--text-light); font-size: 0.6rem;">-</span>'}
                    </td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div style="text-align: center; margin-top: 0.6rem;">
              <button onclick="window.selecionarPropostaFinal('ordinaria')" style="padding: 0.3rem 1rem; background: ${propostaFinal === 'ordinaria' ? '#28a745' : 'transparent'}; border: 1px solid #28a745; border-radius: 4px; color: ${propostaFinal === 'ordinaria' ? 'white' : '#28a745'}; font-size: 0.7rem; cursor: pointer;">
                ${propostaFinal === 'ordinaria' ? '<i class="fas fa-check"></i> Selecionada' : 'Selecionar esta'}
              </button>
            </div>
            ` : `
            <div style="text-align: center; padding: 1rem; opacity: 0.5;">
              <p style="color: var(--text-light); font-size: 0.7rem;">Preencha as receitas no Fluxo de Caixa</p>
            </div>
            `}
          </div>
          
          <!-- PROPOSTA ESPECIAL (visível apenas se botão clicado) -->
          ${mostrarEspecial ? `
          <div style="flex: 1; min-width: 280px; border: 2px solid ${propostaFinal === 'especial' ? 'var(--accent-color)' : 'rgba(212, 175, 55, 0.3)'}; border-radius: 8px; padding: 0.8rem; position: relative;">
            ${propostaFinal === 'especial' ? '<span style="position: absolute; top: -8px; right: 8px; background: var(--accent-color); color: #1a1a2e; font-size: 0.55rem; padding: 0.1rem 0.4rem; border-radius: 3px; font-weight: 600;">SELECIONADA</span>' : ''}
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h5 style="color: var(--accent-color); margin: 0 0 0.3rem 0; font-size: 0.85rem;">
                <i class="fas fa-star"></i> OFERTA ESPECIAL
              </h5>
              <button onclick="window.toggleEspecial()" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 0.7rem;" title="Fechar proposta especial">
                <i class="fas fa-times"></i>
              </button>
            </div>

            
            <!-- Campo de recomendações -->
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; padding: 0.4rem; background: rgba(212,175,55,0.05); border-radius: 4px;">
              <label style="font-size: 0.65rem; color: var(--text-light); white-space: nowrap;">Qtd. Recomendações:</label>
              <input type="number" value="${qtdRecs}" min="0" max="100" step="1"
                onchange="window.updateInvestimentoField('qtd_recomendacoes', parseInt(this.value)||0)"
                style="width: 60px; padding: 0.25rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: var(--accent-color); font-size: 0.8rem; text-align: center; font-weight: 600;">
              <span style="font-size: 0.6rem; color: var(--accent-color); font-weight: 600;">= ${qtdRecs}% desc. adicional</span>
            </div>
            
            ${valorAvistaEspecial > 0 ? `
            <div style="text-align: center; margin-bottom: 0.5rem;">
              <span style="font-size: 0.65rem; color: var(--text-light);">Valor à vista:</span>
              <span style="color: var(--accent-color); font-weight: 700; font-size: 1rem;"> ${formatarMoedaObj(valorAvistaEspecial)}</span>
            </div>
            <div style="max-height: 320px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 0.3rem; text-align: left; color: var(--text-light);">Forma</th>
                    <th style="padding: 0.3rem; text-align: right; color: var(--text-light);">Valor</th>
                    <th style="padding: 0.3rem; text-align: right; color: var(--text-light);">Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  ${parcelasEspecial.map((p, i) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${i <= 1 ? 'background: rgba(212,175,55,0.08);' : ''}">
                    <td style="padding: 0.25rem 0.3rem; color: #e8e8e8; font-size: 0.65rem;">${p.label}</td>
                    <td style="padding: 0.25rem 0.3rem; text-align: right; color: var(--accent-color); font-weight: 600;">R$ ${p.valor_parcela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding: 0.25rem 0.3rem; text-align: right;">
                      ${p.desconto > 0.01 ? `<span style="background: rgba(255,193,7,0.15); color: #ffc107; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600;">-R$ ${p.desconto.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>` : '<span style="color: var(--text-light); font-size: 0.6rem;">-</span>'}
                    </td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div style="text-align: center; margin-top: 0.6rem;">
              <button onclick="window.selecionarPropostaFinal('especial')" style="padding: 0.3rem 1rem; background: ${propostaFinal === 'especial' ? 'var(--accent-color)' : 'transparent'}; border: 1px solid var(--accent-color); border-radius: 4px; color: ${propostaFinal === 'especial' ? '#1a1a2e' : 'var(--accent-color)'}; font-size: 0.7rem; cursor: pointer; font-weight: ${propostaFinal === 'especial' ? '600' : '400'};">
                ${propostaFinal === 'especial' ? '<i class="fas fa-check"></i> Selecionada' : 'Selecionar esta'}
              </button>
            </div>
            ` : `
            <div style="text-align: center; padding: 1rem; opacity: 0.5;">
              <p style="color: var(--text-light); font-size: 0.7rem;">Preencha as receitas no Fluxo de Caixa</p>
            </div>
            `}
          </div>
          ` : ''}
        </div>
        
        <!-- Botão discreto para abrir proposta especial -->
        ${!mostrarEspecial ? `
        <div style="text-align: right; margin-top: 0.6rem;">
          <button onclick="window.toggleEspecial()" style="background: none; border: 1px dashed rgba(212,175,55,0.4); border-radius: 4px; padding: 0.3rem 0.8rem; color: var(--accent-color); font-size: 0.65rem; cursor: pointer; opacity: 0.7;" title="Abrir proposta especial baseada em recomendações">
            <i class="fas fa-plus-circle"></i> Proposta Especial
          </button>
        </div>
        ` : ''}
      </div>
      
      <!-- ACOMPANHAMENTO: Planos lado a lado -->
      <div style="background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <h4 onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'flex' : 'none'; this.querySelector('.fa-chevron-down, .fa-chevron-up').classList.toggle('fa-chevron-down'); this.querySelector('.fa-chevron-down, .fa-chevron-up').classList.toggle('fa-chevron-up');" style="color: #17a2b8; margin: 0; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fas fa-hands-helping"></i> Planos de Acompanhamento Financeiro</span>
          <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i>
        </h4>
        <div style="display: none; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.8rem;">
          ${PLANOS_ACOMPANHAMENTO.map(plano => `
          <div onclick="window.selecionarPlanoAcompanhamento('${plano.id}')" 
               style="flex: 1; min-width: 180px; border: 2px solid ${planoSelecionado === plano.id ? plano.cor : 'var(--border-color)'}; border-radius: 8px; padding: 0.8rem; cursor: pointer; transition: all 0.2s; position: relative; ${plano.destaque ? 'box-shadow: 0 0 12px rgba(40,167,69,0.3);' : ''} ${planoSelecionado === plano.id ? 'background: rgba(' + hexToRgb(plano.cor) + ', 0.08);' : ''}">
            ${plano.destaque ? '<span style="position: absolute; top: -8px; right: 8px; background: #28a745; color: white; font-size: 0.55rem; padding: 0.1rem 0.4rem; border-radius: 3px;">POPULAR</span>' : ''}
            ${planoSelecionado === plano.id ? '<span style="position: absolute; top: 5px; right: 8px; color: ' + plano.cor + '; font-size: 0.8rem;"><i class="fas fa-check-circle"></i></span>' : ''}
            <div style="text-align: center; margin-bottom: 0.5rem;">
              <span style="font-size: 0.7rem; color: ${plano.cor}; font-weight: 600;">${plano.nome}</span>
              <div style="font-size: 1.1rem; color: #e8e8e8; font-weight: 700; margin: 0.2rem 0;">
                ${formatarMoedaObj(plano.valor)}<span style="font-size: 0.6rem; color: var(--text-light);">/mês</span>
              </div>
              <span style="font-size: 0.6rem; color: var(--text-light); font-style: italic;">${plano.subtitulo}</span>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0.5rem 0 0 0;">
              ${plano.itens.map(item => `
              <li style="font-size: 0.6rem; color: var(--text-light); padding: 0.15rem 0; display: flex; align-items: flex-start; gap: 0.3rem;">
                <i class="fas fa-check" style="color: ${plano.cor}; font-size: 0.5rem; margin-top: 0.15rem;"></i>
                <span>${item}</span>
              </li>
              `).join('')}
            </ul>
            <div style="margin-top: 0.5rem; padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.55rem; color: var(--text-light);">
              <div><b>Prioridade:</b> ${plano.prioridade}</div>
              <div><b>SLA Agenda:</b> ${plano.sla_agenda}</div>
              <div><b>SLA WhatsApp:</b> ${plano.sla_whatsapp}</div>
            </div>
          </div>
          `).join('')}
        </div>
        </div>
      </div>
      
    </div>
  `;
}

// Função wrapper que renderiza no container do HTML
function renderAdesaoSection() {
  const container = document.getElementById('adesao-plano-container');
  if (!container) return;
  container.innerHTML = renderInvestimentoAssistencia();
  
  // Restaurar observações no textarea do HTML
  const obsTextarea = document.getElementById('obs_adesao_plano');
  if (obsTextarea && investimentoAssistenciaData.observacoes) {
    obsTextarea.value = investimentoAssistenciaData.observacoes;
  }
}

// Helper: converter hex para rgb
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '128, 128, 128';
}

function getObjetivosData() {
  // Sincronizar observações dos textareas do HTML antes de salvar
  const obsPerfil = document.getElementById('obs_perfil_financeiro');
  if (obsPerfil) perfilFinanceiroData.observacoes = obsPerfil.value || '';
  const obsAdesao = document.getElementById('obs_adesao_plano');
  if (obsAdesao) investimentoAssistenciaData.observacoes = obsAdesao.value || '';
  
  // MELHORIA 1: Salvar perfil de rentabilidade e perfis comparativos junto com os dados
  return {
    objetivos: objetivos,
    variaveis_mercado: {
      ...variaveisMercado,
      perfil_analise: perfilAnaliseSelecionado,
      perfis_comparativos: perfisComparativos
    },
    perfil_financeiro: perfilFinanceiroData,
    investimento_assistencia: investimentoAssistenciaData
  };
}

function getObjetivosArray() {
  return objetivos;
}

function setObjetivosData(data) {
  console.log('setObjetivosData - dados recebidos:', JSON.stringify(data));
  // Suporte ao novo formato {objetivos, variaveis_mercado} e ao formato antigo (array)
  let objArray = data;
  if (data && !Array.isArray(data) && data.objetivos) {
    objArray = data.objetivos;
    if (data.variaveis_mercado) {
      // MELHORIA 1: Restaurar perfil de rentabilidade salvo
      if (data.variaveis_mercado.perfil_analise) {
        perfilAnaliseSelecionado = data.variaveis_mercado.perfil_analise;
      }
      if (data.variaveis_mercado.perfis_comparativos) {
        perfisComparativos = data.variaveis_mercado.perfis_comparativos;
      }
      // Restaurar variáveis de mercado salvas (dados fixos da reunião)
      const { perfil_analise, perfis_comparativos, ...restVars } = data.variaveis_mercado;
      variaveisMercado = { ...variaveisMercado, ...restVars };
    }
    // Restaurar perfil financeiro
    if (data.perfil_financeiro) {
      perfilFinanceiroData = { ...perfilFinanceiroData, ...data.perfil_financeiro };
    }
    // Restaurar investimento assistência
    if (data.investimento_assistencia) {
      investimentoAssistenciaData = { ...investimentoAssistenciaData, ...data.investimento_assistencia };
    }
  }
  if (Array.isArray(objArray)) {
    // Garantir que os valores numéricos sejam parseados corretamente
    objetivos = objArray.map(obj => {
      const parsed = {
        ...obj,
        valor_inicial: parseFloat(obj.valor_inicial) || 0,
        valor_final: parseFloat(obj.valor_final) || 0,
        meta_acumulo: parseFloat(obj.meta_acumulo) || 0,
        renda_anual: parseFloat(obj.renda_anual) || 0,
        prazo_meses: parseInt(obj.prazo_meses) || 60,
        prazo_idade: parseInt(obj.prazo_idade) || 65,
        prioridade: parseInt(obj.prioridade) || 1,
        id: parseInt(obj.id) || 0
      };
      // Garantir que marcos de intangíveis sejam preservados
      if (obj.tipo === 'intangivel' && obj.marcos) {
        parsed.marcos = obj.marcos;
      }
      console.log('Objetivo parseado:', obj.descricao, '- valor_inicial original:', obj.valor_inicial, '- parseado:', parsed.valor_inicial);
      return parsed;
    });
    if (objetivos.length > 0) {
      objetivoCounter = Math.max(...objetivos.map(o => o.id || 0));
    }
  }
  renderObjetivos();
}

// ========================================
// EXPOSIÇÃO GLOBAL
// ========================================

window.renderObjetivos = renderObjetivos;
window.addObjetivoAposentadoria = addObjetivoAposentadoria;
window.addObjetivoNormal = addObjetivoNormal;
window.addObjetivoIntangivel = addObjetivoIntangivel;
window.addMarcoIntangivel = addMarcoIntangivel;
window.updateMarcoIntangivel = updateMarcoIntangivel;
window.deleteMarcoIntangivel = deleteMarcoIntangivel;
window.deleteObjetivo = deleteObjetivo;
window.updateObjetivoField = updateObjetivoField;
window.updateObjetivoPrioridade = updateObjetivoPrioridade;
window.renderAnalisesObjetivosInline = renderAnalisesObjetivosInline;
window.formatarInputMoedaObj = formatarInputMoedaObj;
window.getObjetivosData = getObjetivosData;
window.getObjetivosArray = getObjetivosArray;
window.setObjetivosData = setObjetivosData;
window.updateVariavelMercado = updateVariavelMercado;
window.atualizarDadosMercado = atualizarDadosMercado;
window.adicionarPerfilComparativo = adicionarPerfilComparativo;
window.removerPerfilComparativo = removerPerfilComparativo;
window.editarPerfilComparativo = editarPerfilComparativo;
window.setPerfilAnalise = function(valor) {
  // Se o novo perfil principal já está nos comparativos, removê-lo de lá
  const idxDuplicado = perfisComparativos.indexOf(valor);
  if (idxDuplicado !== -1) {
    perfisComparativos.splice(idxDuplicado, 1);
  }
  perfilAnaliseSelecionado = valor;
  renderAnalisesObjetivosInline();
};

// Funções do Perfil Financeiro
window.setPerfilFinanceiro = function(valor) {
  perfilFinanceiroData.perfil_selecionado = valor;
  renderPerfilFinanceiroSection();
};
window.updatePerfilFinanceiroObs = function(valor) {
  perfilFinanceiroData.observacoes = valor;
};

// Funções do Investimento na Assistência / Adesão ao Plano
window.updateInvestimentoField = function(campo, valor) {
  investimentoAssistenciaData[campo] = valor;
  renderAdesaoSection();
};
window.updateInvestimentoObs = function(valor) {
  investimentoAssistenciaData.observacoes = valor;
};
window.selecionarPlanoAcompanhamento = function(planoId) {
  investimentoAssistenciaData.plano_acompanhamento = 
    investimentoAssistenciaData.plano_acompanhamento === planoId ? '' : planoId;
  renderAdesaoSection();
};
window.toggleEspecial = function() {
  investimentoAssistenciaData.mostrar_especial = !investimentoAssistenciaData.mostrar_especial;
  renderAdesaoSection();
};
window.selecionarPropostaFinal = function(tipo) {
  investimentoAssistenciaData.proposta_final = 
    investimentoAssistenciaData.proposta_final === tipo ? '' : tipo;
  renderAdesaoSection();
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  console.log('Módulo de Objetivos v7.0 carregado');
  carregarVariaveisMercado();
  // Garantir renderização inicial após tempo suficiente para loadDiagnostico
  setTimeout(() => {
    const container = document.getElementById('objetivos-container');
    if (container && (container.innerHTML.trim() === '' || container.innerHTML.includes('<!-- Objetivos'))) {
      renderObjetivos();
    }
  }, 3000);
});
