// ========================================
// MÓDULO DE OBJETIVOS - VERSÃO 5.0
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

// CSS para estilizar dropdowns
const DROPDOWN_STYLE = `
  background: #0d3320 !important;
  color: #e8e8e8 !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 4px !important;
`;

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
  let valor = input.value.replace(/\D/g, '');
  valor = (parseInt(valor) / 100).toFixed(2);
  valor = valor.replace('.', ',');
  valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  input.value = 'R$ ' + valor;
  
  const valorNumerico = parseMoedaObj(input.value);
  
  // Validação para valor inicial - não pode exceder saldo disponível
  if (field === 'valor_inicial') {
    const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
    const valorAlocadoOutros = calcularValorInicialAlocadoExceto(objetivoId);
    const saldoDisponivel = Math.max(0, patrimonioObjetivos - valorAlocadoOutros);
    
    if (valorNumerico > saldoDisponivel) {
      input.value = formatarMoedaObj(saldoDisponivel).replace('R$', 'R$ ');
      input.style.borderColor = '#dc3545';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      updateObjetivoField(objetivoId, field, saldoDisponivel);
      return;
    }
  }
  
  updateObjetivoField(objetivoId, field, valorNumerico);
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
      if (p.finalidade === 'RESERVA_OBJETIVOS') {
        const valor = parseFloat(p.valor_atual) || 0;
        total += valor;
      }
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
  return objetivos
    .filter(o => o.tipo !== 'aposentadoria')
    .reduce((sum, o) => sum + (parseFloat(o.valor_inicial) || 0), 0);
}

function calcularValorInicialAlocadoExceto(objetivoId) {
  return objetivos
    .filter(o => o.tipo !== 'aposentadoria' && o.id !== objetivoId)
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
    prazo_idade: 65,
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
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria');
  const novaPrioridade = objetivosNormais.length + 1;
  objetivoCounter++;
  
  const novoObjetivo = {
    id: objetivoCounter,
    tipo: 'objetivo',
    descricao: '',
    importancia: '',
    responsaveis: [],
    prazo_meses: 60,
    valor_inicial: 0,
    valor_final: 0,
    meta_acumulo: 0,
    prioridade: novaPrioridade,
    // Novos campos
    acumulavel: false, // Se true, saldo bruto passa para o próximo
    vinculado_a: null, // ID do objetivo anterior (para sequência)
    perfil_atual: 'sem_conhecimento',
    perfil_consultoria: 'mod',
    aporte_mensal_personalizado: null // null = usar aporte automático
  };
  
  objetivos.push(novoObjetivo);
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
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  objetivosNormais.forEach((obj, index) => {
    obj.prioridade = index + 1;
  });
  
  renderObjetivos();
}

function updateObjetivoField(id, field, value) {
  const objetivo = objetivos.find(o => o.id === id);
  if (!objetivo) return;
  
  objetivo[field] = value;
  
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
  
  // Recalcular meta de acúmulo quando valor final muda
  if (field === 'valor_final') {
    objetivo.meta_acumulo = Math.max(0, (objetivo.valor_final || 0) - (objetivo.valor_inicial || 0));
    const metaInput = document.getElementById(`meta-acumulo-${id}`);
    if (metaInput) {
      metaInput.value = formatarMoedaObj(objetivo.meta_acumulo).replace('R$', 'R$ ');
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
  const aportesTotais = calcularAportesTotaisDisponiveis();
  
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
      </div>
    </div>
    
    <!-- Aportes Totais Disponíveis -->
    <div style="background: var(--dark-bg); border: 1px solid #17a2b8; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
      <h4 style="color: #17a2b8; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
        <i class="fas fa-piggy-bank"></i> Aportes Totais Disponíveis (do Patrimônio Líquido)
      </h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div style="text-align: center; padding: 0.8rem; background: rgba(23, 162, 184, 0.1); border-radius: 6px; border: 1px solid rgba(23, 162, 184, 0.3);">
          <div style="font-size: 0.75rem; color: var(--text-light);">Total Mensal</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #17a2b8;">${formatarMoedaObj(aportesTotais.mensal)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(23, 162, 184, 0.1); border-radius: 6px; border: 1px solid rgba(23, 162, 184, 0.3);">
          <div style="font-size: 0.75rem; color: var(--text-light);">Total Anual</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #17a2b8;">${formatarMoedaObj(aportesTotais.anual)}</div>
        </div>
      </div>
    </div>
    
    <!-- Patrimônio para Objetivos -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
      <div style="background: var(--dark-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem; text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-light);">Patrimônio Líquido (exceto Aposentadoria)</div>
        <div id="patrimonio-objetivos-display" style="font-size: 1.2rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(patrimonioObjetivos)}</div>
      </div>
      <div style="background: var(--dark-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem; text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-light);">Já Alocado em Objetivos</div>
        <div id="valor-alocado-display" style="font-size: 1.2rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(valorAlocado)}</div>
      </div>
      <div style="background: var(--dark-bg); border: 1px solid ${saldoRestante >= 0 ? '#28a745' : '#dc3545'}; border-radius: 8px; padding: 1rem; text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-light);">Saldo Disponível</div>
        <div id="saldo-disponivel-display" style="font-size: 1.2rem; font-weight: 600; color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaObj(saldoRestante)}</div>
      </div>
    </div>
    
    <!-- Patrimônio Destinado para Aposentadoria -->
    <div style="background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
      <h4 style="color: #28a745; margin: 0 0 0.8rem 0; font-size: 0.9rem;">
        <i class="fas fa-seedling"></i> Patrimônio Destinado para Aposentadoria
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
        ${pessoas.map(p => `
          <div style="text-align: center; padding: 0.5rem 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px; min-width: 120px;">
            <div style="font-size: 0.7rem; color: var(--text-light);">${p.nome}</div>
            <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(patrimonioAposentadoriaPorPessoa[p.id] || 0)}</div>
          </div>
        `).join('')}
      </div>
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
        <button onclick="addObjetivoNormal()" style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          + Adicionar Objetivo
        </button>
      </div>
      
      ${objetivosNormais.map(obj => renderCardObjetivo(obj, pessoas, objetivosNormais, saldoRestante)).join('')}
    </div>
    
    <!-- Botão Analisar -->
    <div style="text-align: center; margin-top: 2rem;">
      <button onclick="toggleAnalise()" style="background: linear-gradient(135deg, var(--accent-color), #b8860b); color: var(--dark-bg); border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        <i class="fas fa-chart-bar"></i> Analisar Objetivos e Aposentadorias
      </button>
    </div>
  `;
}

function renderCardAposentadoria(obj, pessoas, patrimonioAposentadoriaPorPessoa) {
  const pessoaSelecionada = pessoas.find(p => p.id === obj.prazo_pessoa);
  const idadeAtual = pessoaSelecionada ? pessoaSelecionada.idade : 30;
  const idadeAposentadoria = obj.prazo_idade || 65;
  const anosRestantes = Math.max(0, idadeAposentadoria - idadeAtual);
  const patrimonioAtual = patrimonioAposentadoriaPorPessoa[obj.prazo_pessoa] || 0;
  const rendaAnual = obj.renda_anual || 0;
  const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
  const capitalNecessario = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
  
  return `
    <div style="background: var(--card-bg); border: 1px solid #28a745; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="color: #28a745; margin: 0; font-size: 0.9rem;">
          <i class="fas fa-user"></i> ${obj.descricao}
        </h4>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.9rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 150px 200px; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.75rem; color: #28a745; display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-user-check"></i> De quem é a aposentadoria? *
          </label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value)"
                  style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8;">
            ${pessoas.map(p => `
              <option value="${p.id}" ${obj.prazo_pessoa === p.id ? 'selected' : ''} style="background: #0d3320; color: #e8e8e8;">${p.nome} (${p.tipo})</option>
            `).join('')}
          </select>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: #28a745; display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-calendar-alt"></i> Aposentar aos
          </label>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="number" value="${idadeAposentadoria}" min="30" max="100"
                   onchange="updateObjetivoField(${obj.id}, 'prazo_idade', parseInt(this.value))"
                   style="width: 80px; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
            <span style="color: var(--text-light);">anos</span>
          </div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: #28a745; display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-money-bill-wave"></i> Renda Anual Desejada
          </label>
          <input type="text" value="${formatarMoedaObj(rendaAnual).replace('R$', 'R$ ')}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'renda_anual')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Idade Atual</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${idadeAtual} anos</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Anos Restantes</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${anosRestantes} anos</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Patrimônio Atual</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(patrimonioAtual)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Capital Necessário</div>
          <div id="capital-necessario-${obj.id}" style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(capitalNecessario)}</div>
        </div>
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
    <div style="background: var(--card-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <select onchange="updateObjetivoPrioridade(${obj.id}, this.value)"
                  style="padding: 0.3rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--accent-color); font-weight: 600;">
            ${Array.from({length: totalPrioridades}, (_, i) => i + 1).map(p => `
              <option value="${p}" ${obj.prioridade === p ? 'selected' : ''}>${p}º</option>
            `).join('')}
          </select>
          <span style="color: var(--accent-color); font-weight: 600;">Prioridade</span>
        </div>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.9rem;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <!-- Linha 1: Descrição, Importância, Responsáveis, Prazo -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 200px 120px; gap: 1rem; margin-bottom: 1rem;">
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
                  style="width: 100%; padding: 0.3rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; min-height: 60px;">
            ${pessoas.map(p => `
              <option value="${p.id}" ${(obj.responsaveis || []).includes(p.id) ? 'selected' : ''} style="background: #0d3320; color: #e8e8e8;">${p.nome} (${p.tipo})</option>
            `).join('')}
          </select>
          <div style="font-size: 0.65rem; color: var(--text-light); opacity: 0.7; margin-top: 0.2rem;">Segure Ctrl/Cmd para múltiplos</div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-calendar"></i> Prazo (meses)
          </label>
          <input type="number" value="${obj.prazo_meses || 60}" min="1" max="600"
                 onchange="updateObjetivoField(${obj.id}, 'prazo_meses', parseInt(this.value))"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
      </div>
      
      <!-- Linha 2: Valores e Opções -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 200px; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-wallet"></i> Valor Inicial
          </label>
          <input type="text" id="valor-inicial-${obj.id}" value="${formatarMoedaObj(obj.valor_inicial || 0).replace('R$', 'R$ ')}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_inicial')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
          <div style="font-size: 0.65rem; color: #28a745; margin-top: 0.2rem;">Disponível: ${formatarMoedaObj(saldoDisponivelParaEste)}</div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-bullseye"></i> Valor Final do Objetivo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_final || 0).replace('R$', 'R$ ')}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'valor_final')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-chart-line"></i> Meta de Acúmulo
          </label>
          <input type="text" id="meta-acumulo-${obj.id}" value="${formatarMoedaObj(obj.meta_acumulo || 0).replace('R$', 'R$ ')}"
                 oninput="formatarInputMoedaObj(this, ${obj.id}, 'meta_acumulo')"
                 style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-light);">
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--accent-color); display: block; margin-bottom: 0.3rem;">
            <i class="fas fa-link"></i> Vincular após
          </label>
          <select onchange="updateObjetivoField(${obj.id}, 'vinculado_a', this.value ? parseInt(this.value) : null)"
                  style="width: 100%; padding: 0.5rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8;">
            <option value="" style="background: #0d3320; color: #e8e8e8;">Nenhum (independente)</option>
            ${objetivosParaVincular.map(o => `
              <option value="${o.id}" ${obj.vinculado_a === o.id ? 'selected' : ''} style="background: #0d3320; color: #e8e8e8;">
                ${o.prioridade}º - ${o.descricao || 'Sem descrição'}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <!-- Linha 3: Opção Acumulável -->
      <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--text-light);">
          <input type="checkbox" ${obj.acumulavel ? 'checked' : ''}
                 onchange="updateObjetivoField(${obj.id}, 'acumulavel', this.checked)"
                 style="width: 18px; height: 18px; cursor: pointer;">
          <span style="font-size: 0.85rem;">
            <i class="fas fa-layer-group"></i> Objetivo Acumulável
          </span>
        </label>
        <span style="font-size: 0.7rem; color: var(--text-light); opacity: 0.7;">
          (Se marcado, o saldo bruto final será transferido para o próximo objetivo vinculado)
        </span>
      </div>
    </div>
  `;
}

function toggleAnalise() {
  analiseVisivel = !analiseVisivel;
  renderObjetivos();
}


// ========================================
// ANÁLISE DE OBJETIVOS
// ========================================

function renderAnaliseObjetivos(container) {
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h3 style="color: var(--accent-color); margin: 0;">
        <i class="fas fa-chart-bar"></i> Análise de Objetivos e Aposentadorias
      </h3>
      <button onclick="toggleAnalise()" style="background: var(--card-bg); color: var(--accent-color); border: 1px solid var(--accent-color); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-arrow-left"></i> Voltar
      </button>
    </div>
    
    <!-- Análise das Aposentadorias -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #28a745; margin-bottom: 1rem;">
        <i class="fas fa-umbrella-beach"></i> Análise das Aposentadorias
      </h4>
      ${objetivosAposentadoria.map(obj => renderAnaliseAposentadoria(obj)).join('')}
    </div>
    
    <!-- Análise dos Objetivos -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: var(--accent-color); margin-bottom: 1rem;">
        <i class="fas fa-bullseye"></i> Análise dos Objetivos
      </h4>
      ${objetivosNormais.map(obj => renderAnaliseObjetivo(obj, objetivosNormais)).join('')}
    </div>
    
    <!-- Resumo Geral -->
    ${renderResumoGeral(objetivosAposentadoria, objetivosNormais)}
  `;
}

function renderAnaliseAposentadoria(obj) {
  const pessoas = getPessoasDisponiveis();
  const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa);
  const idadeAtual = pessoa ? pessoa.idade : 30;
  const idadeAposentadoria = obj.prazo_idade || 65;
  const mesesRestantes = Math.max(0, (idadeAposentadoria - idadeAtual) * 12);
  const dataNascimento = pessoa ? pessoa.dataNascimento : null;
  
  const patrimonioAtual = calcularPatrimonioAposentadoriaPorPessoa(obj.prazo_pessoa);
  const rendaAnual = obj.renda_anual || 0;
  const rentAnual = variaveisMercado.rent_anual_aposentadoria || 6.0;
  const capitalNecessario = rentAnual > 0 ? rendaAnual / (rentAnual / 100) : 0;
  
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  const rentAtual = getRentabilidadePorPerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePorPerfil(perfilConsultoria);
  
  // Calcular aportes da pessoa
  const aportes = getAportesPessoa(obj.prazo_pessoa);
  
  // Gerar tabelas
  const tabelaAtual = gerarTabelaMensal(patrimonioAtual, capitalNecessario, aportes.mensal, aportes.anual, rentAtual, mesesRestantes, dataNascimento, idadeAtual);
  const tabelaConsultoria = gerarTabelaMensal(patrimonioAtual, capitalNecessario, aportes.mensal, aportes.anual, rentConsultoria, mesesRestantes, dataNascimento, idadeAtual);
  
  return `
    <div style="background: var(--card-bg); border: 1px solid #28a745; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
      <h5 style="color: #28a745; margin: 0 0 1rem 0;">
        <i class="fas fa-user"></i> ${obj.descricao}
      </h5>
      
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; text-align: center;">
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Patrimônio Atual</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(patrimonioAtual)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Capital Necessário</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(capitalNecessario)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Aporte Mensal</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(aportes.mensal)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Aporte Anual</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${formatarMoedaObj(aportes.anual)}</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <!-- Cenário Atual -->
        <div style="background: var(--dark-bg); border: 1px solid #dc3545; border-radius: 8px; padding: 1rem;">
          <h6 style="color: #dc3545; margin: 0 0 0.8rem 0; text-align: center;">
            <i class="fas fa-user-times"></i> Cenário Atual (Sem Consultoria)
          </h6>
          <div style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.7rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select onchange="updateObjetivoField(${obj.id}, 'perfil_atual', this.value); renderObjetivos();"
                    style="width: 100%; padding: 0.4rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.8rem;">
              ${gerarOpcoesPerfilRentabilidade(perfilAtual)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${rentAtual.toFixed(2)}% a.a.</span>
          </div>
          ${renderTabelaHTML(tabelaAtual, '#dc3545')}
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px; padding: 1rem;">
          <h6 style="color: #28a745; margin: 0 0 0.8rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Cenário Com Consultoria
          </h6>
          <div style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.7rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select onchange="updateObjetivoField(${obj.id}, 'perfil_consultoria', this.value); renderObjetivos();"
                    style="width: 100%; padding: 0.4rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.8rem;">
              ${gerarOpcoesPerfilRentabilidade(perfilConsultoria)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${rentConsultoria.toFixed(2)}% a.a.</span>
          </div>
          ${renderTabelaHTML(tabelaConsultoria, '#28a745')}
        </div>
      </div>
      
      <!-- Comparação -->
      <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px; text-align: center;">
        <span style="color: #28a745; font-weight: 600;">
          <i class="fas fa-chart-line"></i> 
          ${compararCenarios(tabelaAtual, tabelaConsultoria)}
        </span>
      </div>
    </div>
  `;
}

function renderAnaliseObjetivo(obj, todosObjetivos) {
  const perfilAtual = obj.perfil_atual || 'sem_conhecimento';
  const perfilConsultoria = obj.perfil_consultoria || 'mod';
  
  const rentAtual = getRentabilidadePorPerfil(perfilAtual);
  const rentConsultoria = getRentabilidadePorPerfil(perfilConsultoria);
  
  // Calcular aportes dos responsáveis
  const aportes = getAportesResponsaveis(obj.responsaveis || []);
  
  // Verificar se está vinculado a outro objetivo
  let valorInicial = obj.valor_inicial || 0;
  let dataInicio = new Date();
  
  if (obj.vinculado_a) {
    const objetivoAnterior = todosObjetivos.find(o => o.id === obj.vinculado_a);
    if (objetivoAnterior) {
      // Calcular resultado do objetivo anterior
      const aportesAnterior = getAportesResponsaveis(objetivoAnterior.responsaveis || []);
      const rentAnterior = getRentabilidadePorPerfil(objetivoAnterior.perfil_consultoria || 'mod');
      const tabelaAnterior = gerarTabelaMensal(
        objetivoAnterior.valor_inicial || 0,
        objetivoAnterior.meta_acumulo || 0,
        aportesAnterior.mensal,
        aportesAnterior.anual,
        rentAnterior,
        600, // máximo de meses
        null,
        30
      );
      
      if (tabelaAnterior.linhas.length > 0) {
        const ultimaLinha = tabelaAnterior.linhas[tabelaAnterior.linhas.length - 1];
        if (objetivoAnterior.acumulavel) {
          valorInicial = ultimaLinha.saldoBruto;
        } else {
          valorInicial = Math.max(0, ultimaLinha.saldoLiquido - ultimaLinha.meta);
        }
        dataInicio = new Date(ultimaLinha.data);
        // Somar aportes do objetivo anterior
        aportes.mensal += aportesAnterior.mensal;
        aportes.anual += aportesAnterior.anual;
      }
    }
  }
  
  const metaAcumulo = obj.meta_acumulo || 0;
  
  // Gerar tabelas
  const tabelaAtual = gerarTabelaMensal(valorInicial, metaAcumulo, aportes.mensal, aportes.anual, rentAtual, 600, null, 30, dataInicio);
  const tabelaConsultoria = gerarTabelaMensal(valorInicial, metaAcumulo, aportes.mensal, aportes.anual, rentConsultoria, 600, null, 30, dataInicio);
  
  return `
    <div style="background: var(--card-bg); border: 1px solid var(--accent-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h5 style="color: var(--accent-color); margin: 0;">
          <span style="background: var(--accent-color); color: var(--dark-bg); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">
            ${obj.prioridade}º
          </span>
          ${obj.descricao || 'Objetivo sem descrição'}
          ${obj.acumulavel ? '<i class="fas fa-layer-group" title="Acumulável" style="margin-left: 0.5rem; color: #17a2b8;"></i>' : ''}
          ${obj.vinculado_a ? '<i class="fas fa-link" title="Vinculado" style="margin-left: 0.5rem; color: #ffc107;"></i>' : ''}
        </h5>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; text-align: center;">
        <div style="padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Valor Inicial</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(valorInicial)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Meta de Acúmulo</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(metaAcumulo)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Aporte Mensal</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(aportes.mensal)}</div>
        </div>
        <div style="padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.65rem; color: var(--text-light);">Prazo Desejado</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-color);">${obj.prazo_meses || 60} meses</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <!-- Cenário Atual -->
        <div style="background: var(--dark-bg); border: 1px solid #dc3545; border-radius: 8px; padding: 1rem;">
          <h6 style="color: #dc3545; margin: 0 0 0.8rem 0; text-align: center;">
            <i class="fas fa-user-times"></i> Cenário Atual
          </h6>
          <div style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.7rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select onchange="updateObjetivoField(${obj.id}, 'perfil_atual', this.value); renderObjetivos();"
                    style="width: 100%; padding: 0.4rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.8rem;">
              ${gerarOpcoesPerfilRentabilidade(perfilAtual)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${rentAtual.toFixed(2)}% a.a. | IR 15%</span>
          </div>
          ${renderTabelaHTML(tabelaAtual, '#dc3545')}
        </div>
        
        <!-- Cenário Com Consultoria -->
        <div style="background: var(--dark-bg); border: 1px solid #28a745; border-radius: 8px; padding: 1rem;">
          <h6 style="color: #28a745; margin: 0 0 0.8rem 0; text-align: center;">
            <i class="fas fa-user-check"></i> Com Consultoria
          </h6>
          <div style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.7rem; color: var(--text-light);">Perfil de Rentabilidade:</label>
            <select onchange="updateObjetivoField(${obj.id}, 'perfil_consultoria', this.value); renderObjetivos();"
                    style="width: 100%; padding: 0.4rem; background: #0d3320; border: 1px solid var(--border-color); border-radius: 4px; color: #e8e8e8; font-size: 0.8rem;">
              ${gerarOpcoesPerfilRentabilidade(perfilConsultoria)}
            </select>
          </div>
          <div style="text-align: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-light);">Rentabilidade: ${rentConsultoria.toFixed(2)}% a.a. | IR 15%</span>
          </div>
          ${renderTabelaHTML(tabelaConsultoria, '#28a745')}
        </div>
      </div>
      
      <!-- Comparação -->
      <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px; text-align: center;">
        <span style="color: #28a745; font-weight: 600;">
          <i class="fas fa-chart-line"></i> 
          ${compararCenarios(tabelaAtual, tabelaConsultoria, obj.prazo_meses)}
        </span>
      </div>
    </div>
  `;
}


// ========================================
// GERAÇÃO DE TABELAS MENSAIS
// ========================================

function gerarTabelaMensal(valorInicial, meta, aporteMensal, aporteAnual, rentabilidadeAnual, maxMeses, dataNascimento, idadeAtual, dataInicio = null) {
  const linhas = [];
  const ipca = variaveisMercado.ipca || 4.5;
  const rentMensal = Math.pow(1 + rentabilidadeAnual / 100, 1/12) - 1;
  const hoje = dataInicio || new Date();
  
  let saldoBruto = valorInicial;
  let somaAportes = 0;
  let metaAtual = meta;
  let mesAtual = 0;
  let idadeCorrente = idadeAtual;
  
  // Determinar mês do aniversário
  let mesAniversario = 1; // Janeiro por padrão
  if (dataNascimento) {
    const dataNasc = new Date(dataNascimento);
    mesAniversario = dataNasc.getMonth() + 1;
  }
  
  while (mesAtual < maxMeses) {
    mesAtual++;
    
    // Calcular data estimada
    const dataEstimada = new Date(hoje);
    dataEstimada.setMonth(dataEstimada.getMonth() + mesAtual);
    
    // Verificar se é mês de aniversário para atualizar idade
    if (dataEstimada.getMonth() + 1 === mesAniversario && mesAtual > 1) {
      idadeCorrente++;
    }
    
    // Calcular aporte do mês (mensal + anual a cada 12 meses)
    let aporteMes = aporteMensal;
    if (mesAtual % 12 === 0 && aporteAnual > 0) {
      aporteMes += aporteAnual;
    }
    
    somaAportes += aporteMes;
    
    // Calcular rentabilidade do mês
    const saldoAntesRent = saldoBruto + aporteMes;
    const rendimentoMes = saldoAntesRent * rentMensal;
    saldoBruto = saldoAntesRent + rendimentoMes;
    
    // Calcular IR (15% sobre o lucro)
    const lucro = Math.max(0, saldoBruto - valorInicial - somaAportes);
    const ir = lucro * 0.15;
    
    // Calcular saldo líquido
    const saldoLiquido = saldoBruto - ir;
    
    // Atualizar meta pelo IPCA a cada 12 meses
    if (mesAtual % 12 === 0) {
      metaAtual = metaAtual * (1 + ipca / 100);
    }
    
    // Calcular percentual da meta
    const percentualMeta = metaAtual > 0 ? (saldoLiquido / metaAtual) * 100 : 0;
    
    linhas.push({
      mes: mesAtual,
      data: dataEstimada,
      idade: idadeCorrente,
      aporte: aporteMes,
      saldoBruto: saldoBruto,
      ir: ir,
      saldoLiquido: saldoLiquido,
      meta: metaAtual,
      percentualMeta: percentualMeta
    });
    
    // Parar quando atingir 100% da meta
    if (percentualMeta >= 100) {
      break;
    }
  }
  
  return {
    linhas: linhas,
    valorInicial: valorInicial,
    metaOriginal: meta,
    rentabilidade: rentabilidadeAnual,
    aporteMensal: aporteMensal,
    aporteAnual: aporteAnual
  };
}

function renderTabelaHTML(tabela, corDestaque) {
  if (!tabela.linhas || tabela.linhas.length === 0) {
    return `<div style="text-align: center; color: var(--text-light); padding: 1rem;">Sem dados para exibir</div>`;
  }
  
  return `
    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
        <thead style="position: sticky; top: 0; background: var(--dark-bg);">
          <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 0.4rem; text-align: left; color: ${corDestaque};">Mês</th>
            <th style="padding: 0.4rem; text-align: center; color: ${corDestaque};">Idade</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corDestaque};">Aporte</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corDestaque};">Saldo Bruto</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corDestaque};">IR</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corDestaque};">Líquido</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corDestaque};">Meta</th>
            <th style="padding: 0.4rem; text-align: right; color: ${corDestaque};">%</th>
          </tr>
        </thead>
        <tbody>
          ${tabela.linhas.map((linha, index) => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${linha.percentualMeta >= 100 ? 'background: rgba(40, 167, 69, 0.2);' : ''}">
              <td style="padding: 0.3rem; color: var(--text-light);">
                Mês ${linha.mes}
                <div style="font-size: 0.6rem; opacity: 0.7;">(${formatarDataCurta(linha.data)})</div>
              </td>
              <td style="padding: 0.3rem; text-align: center; color: var(--text-light);">${linha.idade} anos</td>
              <td style="padding: 0.3rem; text-align: right; color: var(--text-light);">${formatarMoedaCompacta(linha.aporte)}</td>
              <td style="padding: 0.3rem; text-align: right; color: ${corDestaque};">${formatarMoedaCompacta(linha.saldoBruto)}</td>
              <td style="padding: 0.3rem; text-align: right; color: #dc3545;">${formatarMoedaCompacta(linha.ir)}</td>
              <td style="padding: 0.3rem; text-align: right; color: #28a745;">${formatarMoedaCompacta(linha.saldoLiquido)}</td>
              <td style="padding: 0.3rem; text-align: right; color: var(--text-light);">${formatarMoedaCompacta(linha.meta)}</td>
              <td style="padding: 0.3rem; text-align: right; color: ${linha.percentualMeta >= 100 ? '#28a745' : corDestaque}; font-weight: ${linha.percentualMeta >= 100 ? '600' : 'normal'};">
                ${linha.percentualMeta.toFixed(1)}%
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function compararCenarios(tabelaAtual, tabelaConsultoria, prazoDesejado = null) {
  const mesesAtual = tabelaAtual.linhas.length;
  const mesesConsultoria = tabelaConsultoria.linhas.length;
  
  const ultimaAtual = tabelaAtual.linhas[tabelaAtual.linhas.length - 1];
  const ultimaConsultoria = tabelaConsultoria.linhas[tabelaConsultoria.linhas.length - 1];
  
  const atingiuAtual = ultimaAtual && ultimaAtual.percentualMeta >= 100;
  const atingiuConsultoria = ultimaConsultoria && ultimaConsultoria.percentualMeta >= 100;
  
  let resultado = '';
  
  if (atingiuConsultoria && atingiuAtual) {
    const diferencaMeses = mesesAtual - mesesConsultoria;
    if (diferencaMeses > 0) {
      resultado = `Com consultoria: objetivo atingido ${diferencaMeses} meses antes!`;
    } else if (diferencaMeses < 0) {
      resultado = `Cenário atual mais rápido em ${Math.abs(diferencaMeses)} meses`;
    } else {
      resultado = `Ambos cenários atingem no mesmo prazo`;
    }
    
    // Adicionar comparação com prazo desejado
    if (prazoDesejado) {
      if (mesesConsultoria <= prazoDesejado) {
        resultado += ` | Dentro do prazo desejado (${prazoDesejado} meses)`;
      } else {
        resultado += ` | ${mesesConsultoria - prazoDesejado} meses além do prazo desejado`;
      }
    }
  } else if (atingiuConsultoria && !atingiuAtual) {
    resultado = `Com consultoria: objetivo atingido em ${mesesConsultoria} meses | Cenário atual: não atinge no período`;
  } else if (!atingiuConsultoria && atingiuAtual) {
    resultado = `Cenário atual atinge em ${mesesAtual} meses | Com consultoria: não atinge no período`;
  } else {
    resultado = `Nenhum cenário atinge a meta no período analisado`;
  }
  
  return resultado;
}

function renderResumoGeral(aposentadorias, objetivosNormais) {
  // Calcular totais
  let totalAporteAtual = 0;
  let totalAporteConsultoria = 0;
  
  aposentadorias.forEach(obj => {
    const aportes = getAportesPessoa(obj.prazo_pessoa);
    totalAporteAtual += aportes.mensal;
    totalAporteConsultoria += aportes.mensal;
  });
  
  objetivosNormais.forEach(obj => {
    const aportes = getAportesResponsaveis(obj.responsaveis || []);
    totalAporteAtual += aportes.mensal;
    totalAporteConsultoria += aportes.mensal;
  });
  
  return `
    <div style="background: var(--card-bg); border: 2px solid var(--accent-color); border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> Resumo Geral
      </h4>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center;">
        <div style="padding: 1rem; background: rgba(220, 53, 69, 0.1); border-radius: 8px; border: 1px solid #dc3545;">
          <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem;">Cenário Atual</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #dc3545;">
            ${formatarMoedaObj(totalAporteAtual)}/mês
          </div>
        </div>
        <div style="padding: 1rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px; border: 1px solid #28a745;">
          <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem;">Com Consultoria</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #28a745;">
            ${formatarMoedaObj(totalAporteConsultoria)}/mês
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 1rem; padding: 0.8rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
        <span style="color: var(--accent-color); font-size: 0.9rem;">
          <i class="fas fa-info-circle"></i> 
          Com a consultoria, você pode atingir seus objetivos mais rapidamente ou com menor esforço mensal.
        </span>
      </div>
    </div>
  `;
}


// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function formatarMoedaObj(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarMoedaCompacta(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0';
  if (valor >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(2)}M`;
  } else if (valor >= 1000) {
    return `R$ ${(valor / 1000).toFixed(1)}k`;
  }
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPercentual(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '0,00%';
  return `${valor.toFixed(2).replace('.', ',')}%`;
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const data = new Date(dataStr);
  return data.toLocaleDateString('pt-BR');
}

function formatarDataCurta(data) {
  if (!data) return '';
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}

function parseMoeda(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  return parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function formatarInputMoedaObj(input, id, field) {
  let valor = input.value.replace(/[^\d]/g, '');
  valor = (parseInt(valor) || 0) / 100;
  
  // Validar se é valor inicial e não excede o saldo disponível
  if (field === 'valor_inicial') {
    const objetivo = objetivos.find(o => o.id === id);
    if (objetivo && objetivo.tipo !== 'aposentadoria') {
      const valorAlocadoOutros = calcularValorInicialAlocadoExceto(id);
      const patrimonioObjetivos = calcularPatrimonioParaObjetivos();
      const saldoDisponivel = Math.max(0, patrimonioObjetivos - valorAlocadoOutros);
      
      if (valor > saldoDisponivel) {
        valor = saldoDisponivel;
        input.style.borderColor = '#dc3545';
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
      }
    }
  }
  
  input.value = formatarMoedaObj(valor).replace('R$', 'R$ ');
  updateObjetivoField(id, field, valor);
}

function calcularValorInicialAlocadoExceto(idExcluir) {
  return objetivos
    .filter(o => o.tipo !== 'aposentadoria' && o.id !== idExcluir)
    .reduce((sum, o) => sum + (o.valor_inicial || 0), 0);
}

function calcularValorInicialAlocado() {
  return objetivos
    .filter(o => o.tipo !== 'aposentadoria')
    .reduce((sum, o) => sum + (o.valor_inicial || 0), 0);
}

function calcularAportesTotaisDisponiveis() {
  const patrimonios = window.getPatrimoniosLiquidosData ? window.getPatrimoniosLiquidosData() : [];
  let totalMensal = 0;
  let totalAnual = 0;
  
  patrimonios.forEach(p => {
    const valor = parseFloat(p.aporte_valor) || 0;
    if (p.aporte_frequencia === 'MENSAL') {
      totalMensal += valor;
    } else if (p.aporte_frequencia === 'ANUAL') {
      totalAnual += valor;
    }
  });
  
  return { mensal: totalMensal, anual: totalAnual };
}

function getAportesResponsaveis(responsaveis) {
  let totalMensal = 0;
  let totalAnual = 0;
  
  responsaveis.forEach(pessoaId => {
    const aportes = getAportesPessoa(pessoaId);
    totalMensal += aportes.mensal;
    totalAnual += aportes.anual;
  });
  
  return { mensal: totalMensal, anual: totalAnual };
}

// ========================================
// FUNÇÕES DE DADOS (EXPORTADAS)
// ========================================

function getObjetivosData() {
  return objetivos;
}

function setObjetivosData(data) {
  if (Array.isArray(data)) {
    objetivos = data;
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
window.deleteObjetivo = deleteObjetivo;
window.updateObjetivoField = updateObjetivoField;
window.updateObjetivoPrioridade = updateObjetivoPrioridade;
window.toggleAnalise = toggleAnalise;
window.formatarInputMoedaObj = formatarInputMoedaObj;
window.getObjetivosData = getObjetivosData;
window.setObjetivosData = setObjetivosData;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  console.log('Módulo de Objetivos v5.0 carregado');
  carregarVariaveisMercado();
});
