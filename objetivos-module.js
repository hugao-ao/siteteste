// ========================================
// MÓDULO DE OBJETIVOS - VERSÃO 6.0
// ========================================

import { supabase } from './supabase.js';

// Dados dos objetivos
let objetivos = [];
let objetivoCounter = 0;
let perfilAnaliseSelecionado = 'mod'; // Perfil selecionado persistente
let perfisComparativos = []; // Array de IDs de perfis extras para comparação

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

function calcularRendaAnualPessoa(pessoaId) {
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

function gerarOpcoesPerfilRentabilidade(perfilSelecionado) {
  const cdi = variaveisMercado.cdi || 14.65;
  const cdi10 = variaveisMercado.cdi_aa_medio_10_anos || 9.2666;
  
  let html = `<optgroup label="Rentabilidades Atuais" style="background: #0d3320; color: #e8e8e8;">`;
  
  PERFIS_RENTABILIDADE.forEach(perfil => {
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
    const mult = variaveisMercado[`mult_${perfil.id}`] || perfil.percentCDI;
    const rent = cdi10 * mult / 100;
    const selected = perfilSelecionado === `${perfil.id}_10a` ? 'selected' : '';
    html += `<option value="${perfil.id}_10a" ${selected} style="background: #0d3320; color: #e8e8e8;">
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
      
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Idade:</span> <span style="color: #28a745; font-weight: 600;">${idadeAtual}</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Restam:</span> <span style="color: #28a745; font-weight: 600;">${anosRestantes} anos</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Patrim.:</span> <span style="color: #28a745; font-weight: 600;">${formatarMoedaObj(patrimonioAtual)}</span></span>
        <span style="padding: 0.15rem 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px; font-size: 0.7rem;"><span style="color: var(--text-light);">Capital Nec.:</span> <span id="capital-necessario-${obj.id}" style="color: #28a745; font-weight: 600;">${formatarMoedaObj(capitalNecessario)}</span></span>
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
  
  // Gerar HTML dos perfis comparativos
  let perfisComparativosHTML = '';
  perfisComparativos.forEach((perfilId, index) => {
    const todosIds = [];
    PERFIS_RENTABILIDADE.forEach(p => { todosIds.push(p.id); todosIds.push(p.id + '_10a'); });
    const jaUsados = [perfilAnaliseSelecionado, ...perfisComparativos.filter((_, i) => i !== index)];
    const disponiveis = todosIds.filter(id => !jaUsados.includes(id) || id === perfilId);
    
    perfisComparativosHTML += `
      <div style="display: flex; align-items: center; gap: 0.3rem; margin-top: 0.3rem;">
        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${CORES_PERFIS[(index + 1) % CORES_PERFIS.length]}; display: inline-block;"></span>
        <select onchange="window.editarPerfilComparativo(${index}, this.value)" style="padding: 0.2rem 0.4rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.7rem; flex: 1;">
          ${gerarOpcoesPerfilRentabilidade(perfilId)}
        </select>
        <button onclick="window.removerPerfilComparativo(${index})" style="background: transparent; border: 1px solid rgba(220,53,69,0.4); border-radius: 4px; color: #dc3545; cursor: pointer; padding: 0.15rem 0.3rem; font-size: 0.6rem;" title="Remover perfil">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  });
  
  container.innerHTML = `
    <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid rgba(212, 175, 55, 0.3);">
      <h3 style="color: var(--accent-color); margin: 0 0 1rem 0; font-size: 1rem;">
        <i class="fas fa-chart-area"></i> Análise de Evolução Patrimonial
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
      
      <!-- Resumo dos Objetivos -->
      <div style="background: var(--card-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem;">
        <h4 style="color: var(--accent-color); margin: 0 0 0.8rem 0; font-size: 0.9rem;">
          <i class="fas fa-clipboard-check"></i> Resultado da Análise
        </h4>
        ${renderResumoAnalise(simulacao, objetivosAposentadoria, objetivosNormais, simulacoesComparativas)}
        ${objetivosIntangiveis.length > 0 ? renderResumoIntangiveis(objetivosIntangiveis) : ''}
      </div>
    </div>
  `;
  
  // Renderizar gráfico após DOM estar pronto
  setTimeout(() => renderGraficoEvolucao(simulacao, objetivosNormais, objetivosAposentadoria, simulacoesComparativas), 50);
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
  
  // Preparar eventos de objetivos (saques e acúmulos)
  const eventosObjetivos = [];
  objetivosNormais.forEach(obj => {
    const mesesPrazo = calcularMesesRestantesObjNormal(obj);
    const valorSaque = obj.meta_acumulo || 0;
    const isAcumulo = obj.acumulavel;
    const recTipo = obj.recorrencia_tipo || 'nenhuma';
    const recValor = obj.recorrencia_valor || 0;
    
    if (valorSaque > 0 && mesesPrazo > 0) {
      // Primeiro evento (na data de realização)
      eventosObjetivos.push({
        mes: mesesPrazo,
        valor: valorSaque,
        descricao: obj.descricao || 'Objetivo',
        isAcumulo: isAcumulo,
        prioridade: obj.prioridade,
        objetivoId: obj.id,
        isRecorrente: false
      });
      
      // MELHORIA 2: Eventos recorrentes a partir da data de realização
      if (recTipo !== 'nenhuma' && recValor > 0) {
        const intervaloMeses = recTipo === 'anos' ? recValor * 12 : recValor;
        let proximoMes = mesesPrazo + intervaloMeses;
        while (proximoMes <= maxMeses) {
          eventosObjetivos.push({
            mes: proximoMes,
            valor: valorSaque,
            descricao: obj.descricao + ' (rec.)',
            isAcumulo: isAcumulo,
            prioridade: obj.prioridade,
            objetivoId: obj.id,
            isRecorrente: true
          });
          proximoMes += intervaloMeses;
        }
      }
    }
  });
  
  // Ordenar eventos por mês
  eventosObjetivos.sort((a, b) => a.mes - b.mes);
  
  // Simular mês a mês
  const pontos = [];
  const eventosMarcados = [];
  let saldo = patrimonioInicial;
  let somaAportes = 0;
  
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
    
    // Verificar eventos neste mês
    const eventosDoMes = eventosObjetivos.filter(e => e.mes === mes);
    eventosDoMes.forEach(evento => {
      if (!evento.isAcumulo) {
        // MELHORIA 2: Saque - verificar se há saldo suficiente
        const saldoAntes = saldo;
        const sucesso = saldo >= evento.valor;
        if (sucesso) {
          saldo -= evento.valor;
        }
        
        eventosMarcados.push({
          mes: mes,
          tipo: 'saque',
          valor: evento.valor,
          descricao: evento.descricao,
          saldoAntes: saldoAntes,
          saldoApos: saldo,
          sucesso: sucesso,
          isRecorrente: evento.isRecorrente,
          objetivoId: evento.objetivoId
        });
      } else {
        // Acúmulo - não saca, apenas marca que atingiu
        const atingido = saldo >= evento.valor;
        eventosMarcados.push({
          mes: mes,
          tipo: 'acumulo',
          valor: evento.valor,
          descricao: evento.descricao,
          saldoAntes: saldo,
          saldoApos: saldo,
          sucesso: atingido,
          isRecorrente: evento.isRecorrente,
          objetivoId: evento.objetivoId
        });
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
  if (prazoTipo === 'data' && obj.prazo_data) {
    const dataAlvo = new Date(obj.prazo_data);
    const hoje = new Date();
    return Math.max(0, Math.round((dataAlvo - hoje) / (1000 * 60 * 60 * 24 * 30.44)));
  } else if (prazoTipo === 'meses') {
    return obj.prazo_meses || 360;
  } else if (prazoTipo === 'anos') {
    return obj.prazo_meses || 360;
  } else {
    // idade
    const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa);
    const idadeAtual = pessoa ? pessoa.idade : 30;
    const idadeAposentadoria = obj.prazo_idade || 65;
    return Math.max(0, (idadeAposentadoria - idadeAtual) * 12);
  }
}

function calcularMesesRestantesObjNormal(obj) {
  const prazoTipo = obj.prazo_tipo || 'meses';
  if (prazoTipo === 'data' && obj.prazo_data) {
    const dataAlvo = new Date(obj.prazo_data);
    const hoje = new Date();
    return Math.max(0, Math.round((dataAlvo - hoje) / (1000 * 60 * 60 * 24 * 30.44)));
  } else if (prazoTipo === 'anos') {
    return obj.prazo_meses || 60;
  } else {
    return obj.prazo_meses || 60;
  }
}

// MELHORIA 5: Gráfico com múltiplos perfis
function renderGraficoEvolucao(simulacao, objetivosNormais, aposentadorias, simulacoesComparativas) {
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
  
  // Criar datasets de pontos de eventos (saques sucesso, saques falha, acúmulos)
  const eventosSaqueSucessoData = Array(labels.length).fill(null);
  const eventosSaqueFalhaData = Array(labels.length).fill(null);
  const eventosRecSucessoData = Array(labels.length).fill(null);
  const eventosRecFalhaData = Array(labels.length).fill(null);
  const eventosAcumuloData = Array(labels.length).fill(null);
  
  simulacao.eventos.forEach(evento => {
    const posicaoLabel = Math.min(evento.mes, labels.length - 1);
    if (evento.tipo === 'saque') {
      if (evento.isRecorrente) {
        if (evento.sucesso) {
          eventosRecSucessoData[posicaoLabel] = evento.saldoAntes;
        } else {
          eventosRecFalhaData[posicaoLabel] = evento.saldoAntes;
        }
      } else {
        if (evento.sucesso) {
          eventosSaqueSucessoData[posicaoLabel] = evento.saldoAntes;
        } else {
          eventosSaqueFalhaData[posicaoLabel] = evento.saldoAntes;
        }
      }
    } else {
      eventosAcumuloData[posicaoLabel] = evento.saldoAntes;
    }
  });
  
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
  
  // MELHORIA 5: Adicionar linhas dos perfis comparativos
  if (simulacoesComparativas && simulacoesComparativas.length > 0) {
    simulacoesComparativas.forEach((comp, index) => {
      const corIndex = (index + 1) % CORES_PERFIS.length;
      const dataComp = comp.simulacao.pontos.map(p => p.saldo);
      datasets.push({
        label: `Patrimônio (${getNomePerfilRentabilidade(comp.perfilId)})`,
        data: dataComp,
        borderColor: CORES_PERFIS[corIndex],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [4, 2]
      });
    });
  }
  
  // Saques iniciais com sucesso (triângulo vermelho apontando para baixo)
  if (eventosSaqueSucessoData.some(v => v !== null)) {
    datasets.push({
      label: 'Saque (Sucesso)',
      data: eventosSaqueSucessoData,
      borderColor: '#dc3545',
      backgroundColor: '#dc3545',
      pointRadius: 7,
      pointStyle: 'triangle',
      pointRotation: 180,
      showLine: false,
      borderWidth: 0
    });
  }
  
  // Saques iniciais com falha (X vermelho)
  if (eventosSaqueFalhaData.some(v => v !== null)) {
    datasets.push({
      label: 'Saque (Saldo Insuficiente)',
      data: eventosSaqueFalhaData,
      borderColor: '#dc3545',
      backgroundColor: 'rgba(220,53,69,0.3)',
      pointRadius: 7,
      pointStyle: 'crossRot',
      showLine: false,
      borderWidth: 2
    });
  }
  
  // Recorrências com sucesso (losango laranja)
  if (eventosRecSucessoData.some(v => v !== null)) {
    datasets.push({
      label: 'Recorrência (Sucesso)',
      data: eventosRecSucessoData,
      borderColor: '#ff8c00',
      backgroundColor: '#ff8c00',
      pointRadius: 6,
      pointStyle: 'rectRot',
      showLine: false,
      borderWidth: 0
    });
  }
  
  // Recorrências com falha (X laranja)
  if (eventosRecFalhaData.some(v => v !== null)) {
    datasets.push({
      label: 'Recorrência (Saldo Insuficiente)',
      data: eventosRecFalhaData,
      borderColor: '#ff8c00',
      backgroundColor: 'rgba(255,140,0,0.3)',
      pointRadius: 6,
      pointStyle: 'crossRot',
      showLine: false,
      borderWidth: 2
    });
  }
  
  // Pontos de acúmulos
  if (eventosAcumuloData.some(v => v !== null)) {
    datasets.push({
      label: 'Acúmulos',
      data: eventosAcumuloData,
      borderColor: '#17a2b8',
      backgroundColor: '#17a2b8',
      pointRadius: 6,
      pointStyle: 'circle',
      showLine: false,
      borderWidth: 0
    });
  }
  
  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          labels: { color: '#e8e8e8', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.parsed.y === null) return null;
              const label = context.dataset.label || '';
              const valor = formatarMoedaObj(context.parsed.y);
              // Para eventos de saque/recorrência, mostrar o valor do saque
              if (label.includes('Saque') || label.includes('Recorrência')) {
                const mesIndex = context.dataIndex;
                const evento = simulacao.eventos.find(e => e.mes === mesIndex);
                if (evento) {
                  return `${label}: ${formatarMoedaObj(evento.valor)} (Saldo: ${valor})`;
                }
              }
              return label + ': ' + valor;
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
      const recValor = obj.recorrencia_valor || 0;
      
      // Encontrar o mês em que o patrimônio acumulado atinge a meta (data provável)
      let mesRealizacao = -1; // -1 = nunca
      for (let i = 0; i < simulacao.pontos.length; i++) {
        if (simulacao.pontos[i].saldo >= valorMeta) {
          mesRealizacao = simulacao.pontos[i].mes;
          break;
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
        recTexto = ` <span style="font-size: 0.6rem; color: #17a2b8;"><i class="fas fa-redo"></i> a cada ${recValor} ${recTipo === 'anos' ? 'ano(s)' : 'meses'}</span>`;
        
        // Contar quantas vezes o objetivo recorrente foi executado com sucesso
        const eventosDoObj = simulacao.eventos.filter(e => e.objetivoId === obj.id);
        const eventosSucesso = eventosDoObj.filter(e => e.sucesso);
        const eventosFalha = eventosDoObj.filter(e => !e.sucesso);
        
        if (eventosDoObj.length > 0) {
          recDetalhe = `<div style="font-size: 0.65rem; color: #ff8c00; margin-top: 0.2rem; padding: 0.2rem 0.5rem; background: rgba(255,140,0,0.08); border-radius: 4px;">
            <i class="fas fa-redo"></i> <strong>Recorrência:</strong> ${eventosSucesso.length}x com sucesso de ${eventosDoObj.length} tentativas`;
          
          // Detalhar períodos de falha e recuperação
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
          
          periodos.forEach(p => {
            const dataRef = new Date();
            if (p.tipo === 'falha') {
              dataRef.setMonth(dataRef.getMonth() + p.inicio);
              const dataFim = new Date();
              dataFim.setMonth(dataFim.getMonth() + p.fim);
              recDetalhe += `<br>&nbsp;&nbsp;<span style="color: #dc3545;"><i class="fas fa-times-circle"></i> Falha de ${String(dataRef.getMonth()+1).padStart(2,'0')}/${dataRef.getFullYear()} a ${String(dataFim.getMonth()+1).padStart(2,'0')}/${dataFim.getFullYear()}</span>`;
            } else if (p.tipo === 'recupera') {
              dataRef.setMonth(dataRef.getMonth() + p.mes);
              recDetalhe += `<br>&nbsp;&nbsp;<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Recupera em ${String(dataRef.getMonth()+1).padStart(2,'0')}/${dataRef.getFullYear()}</span>`;
            } else if (p.tipo === 'falha_permanente') {
              dataRef.setMonth(dataRef.getMonth() + p.inicio);
              recDetalhe += `<br>&nbsp;&nbsp;<span style="color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Falha permanente a partir de ${String(dataRef.getMonth()+1).padStart(2,'0')}/${dataRef.getFullYear()}</span>`;
            }
          });
          
          recDetalhe += `</div>`;
        }
      }
      
      // Status e cor
      let statusTexto, statusCor;
      if (!atingido) {
        statusTexto = 'Nunca atingível';
        statusCor = '#dc3545';
      } else if (dentroDoPrazo) {
        statusTexto = 'No prazo';
        statusCor = '#28a745';
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
  
  // MELHORIA 5: Comparativo lado a lado dos perfis
  if (simulacoesComparativas && simulacoesComparativas.length > 0) {
    html += `<div style="margin-bottom: 1rem; padding: 0.5rem; background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.2); border-radius: 6px;">`;
    html += `<h5 style="color: var(--accent-color); margin: 0 0 0.5rem 0; font-size: 0.8rem;"><i class="fas fa-balance-scale"></i> Comparativo de Perfis</h5>`;
    html += `<div style="display: grid; grid-template-columns: repeat(${1 + simulacoesComparativas.length}, 1fr); gap: 0.5rem; font-size: 0.7rem;">`;
    
    // Cabeçalhos
    html += `<div style="font-weight: 600; color: ${CORES_PERFIS[0]}; text-align: center; padding: 0.2rem;">${getNomePerfilRentabilidade(perfilAnaliseSelecionado)}<br><span style="font-size: 0.6rem;">(${simulacao.rentAnual.toFixed(2)}% a.a.)</span></div>`;
    simulacoesComparativas.forEach((comp, idx) => {
      html += `<div style="font-weight: 600; color: ${CORES_PERFIS[(idx+1) % CORES_PERFIS.length]}; text-align: center; padding: 0.2rem;">${getNomePerfilRentabilidade(comp.perfilId)}<br><span style="font-size: 0.6rem;">(${comp.simulacao.rentAnual.toFixed(2)}% a.a.)</span></div>`;
    });
    
    // Patrimônio Final
    html += `<div style="text-align: center; padding: 0.2rem; border-top: 1px solid rgba(212,175,55,0.2);"><span style="color: var(--text-light);">PF:</span> <span style="color: ${CORES_PERFIS[0]}; font-weight: 600;">${formatarMoedaCompacta(simulacao.patrimonioFinal)}</span></div>`;
    simulacoesComparativas.forEach((comp, idx) => {
      html += `<div style="text-align: center; padding: 0.2rem; border-top: 1px solid rgba(212,175,55,0.2);"><span style="color: var(--text-light);">PF:</span> <span style="color: ${CORES_PERFIS[(idx+1) % CORES_PERFIS.length]}; font-weight: 600;">${formatarMoedaCompacta(comp.simulacao.patrimonioFinal)}</span></div>`;
    });
    
    // Atingimento aposentadoria
    if (simulacao.capitalNecessarioCorrigido > 0) {
      const pctPrincipal = (simulacao.patrimonioFinal / simulacao.capitalNecessarioCorrigido * 100).toFixed(1);
      html += `<div style="text-align: center; padding: 0.2rem;"><span style="color: var(--text-light);">Ating.:</span> <span style="color: ${parseFloat(pctPrincipal) >= 100 ? '#28a745' : '#dc3545'}; font-weight: 600;">${pctPrincipal}%</span></div>`;
      simulacoesComparativas.forEach((comp, idx) => {
        const pct = (comp.simulacao.patrimonioFinal / comp.simulacao.capitalNecessarioCorrigido * 100).toFixed(1);
        html += `<div style="text-align: center; padding: 0.2rem;"><span style="color: var(--text-light);">Ating.:</span> <span style="color: ${parseFloat(pct) >= 100 ? '#28a745' : '#dc3545'}; font-weight: 600;">${pct}%</span></div>`;
      });
    }
    
    html += `</div></div>`;
  }
  
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

function getObjetivosData() {
  // MELHORIA 1: Salvar perfil de rentabilidade e perfis comparativos junto com os dados
  return {
    objetivos: objetivos,
    variaveis_mercado: {
      ...variaveisMercado,
      perfil_analise: perfilAnaliseSelecionado,
      perfis_comparativos: perfisComparativos
    }
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
  perfilAnaliseSelecionado = valor;
  renderAnalisesObjetivosInline();
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  console.log('Módulo de Objetivos v6.0 carregado');
  carregarVariaveisMercado();
});
