// ========================================
// MÓDULO DE OBJETIVOS
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
  cdi_medio_10_anos: 9.2666,
  ipca_medio_10_anos: 5.504,
  ultima_atualizacao: null
};

// ========================================
// CARREGAMENTO DE VARIÁVEIS DE MERCADO
// ========================================

async function carregarVariaveisMercado() {
  try {
    const { data, error } = await supabase
      .from('variaveis_mercado')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data && !error) {
      variaveisMercado = {
        selic: parseFloat(data.selic) || 14.75,
        cdi_120_meses: parseFloat(data.cdi_120_meses) || 142.59,
        ipca: parseFloat(data.ipca) || 5.44,
        ipca_120_meses: parseFloat(data.ipca_120_meses) || 70.88,
        cdi: parseFloat(data.cdi) || 14.65,
        cdi_medio_10_anos: parseFloat(data.cdi_medio_10_anos) || 9.2666,
        ipca_medio_10_anos: parseFloat(data.ipca_medio_10_anos) || 5.504,
        ultima_atualizacao: data.updated_at || data.created_at
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

// Obter lista de pessoas disponíveis
function getPessoasDisponiveis() {
  const pessoas = [];
  
  // Cliente
  const nomeCliente = document.getElementById('nome_diagnostico')?.value || 'Cliente';
  const idadeCliente = parseInt(document.getElementById('idade')?.value) || 30;
  pessoas.push({ id: 'titular', nome: nomeCliente, tipo: 'Cliente', idade: idadeCliente });
  
  // Cônjuge do cliente
  const estadoCivil = document.getElementById('estado_civil')?.value;
  if (estadoCivil && ['casado', 'uniao_estavel'].includes(estadoCivil)) {
    const nomeConjuge = document.getElementById('conjuge_nome')?.value || 'Cônjuge';
    const idadeConjuge = calcularIdade(document.getElementById('conjuge_data_nascimento')?.value);
    pessoas.push({ id: 'conjuge', nome: nomeConjuge, tipo: 'Cônjuge', idade: idadeConjuge });
  }
  
  // Pessoas com renda
  const pessoasRenda = window.pessoasRenda || [];
  pessoasRenda.forEach((pessoa, index) => {
    const idadePessoa = calcularIdade(pessoa.data_nascimento);
    pessoas.push({ 
      id: `pessoa_${index}`, 
      nome: pessoa.nome || `Pessoa ${index + 1}`, 
      tipo: 'Pessoa com Renda',
      idade: idadePessoa
    });
    
    // Cônjuge da pessoa com renda
    if (pessoa.estado_civil && ['casado', 'uniao_estavel'].includes(pessoa.estado_civil)) {
      const idadeConjugePessoa = calcularIdade(pessoa.conjuge_data_nascimento);
      pessoas.push({ 
        id: `pessoa_${index}_conjuge`, 
        nome: pessoa.conjuge_nome || `Cônjuge de ${pessoa.nome}`, 
        tipo: 'Cônjuge (Pessoa com Renda)',
        idade: idadeConjugePessoa
      });
    }
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

// Calcular saldo disponível para objetivos
function calcularSaldoParaObjetivos() {
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
  
  return patrimonioTotal - patrimonioAposentadoria;
}

// Calcular valor inicial já alocado
function calcularValorInicialAlocado(excluirId = null) {
  return objetivos
    .filter(obj => obj.id !== excluirId && obj.tipo !== 'aposentadoria')
    .reduce((total, obj) => total + (parseFloat(obj.valor_inicial) || 0), 0);
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
    prioridade: proximaPrioridade
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
    valor_final: 0, // Será calculado automaticamente
    meta_acumulo: 0, // Será calculado automaticamente
    prioridade: 0 // Aposentadoria não tem prioridade numérica
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
  
  if (field === 'valor_inicial' || field === 'valor_final' || field === 'meta_acumulo') {
    objetivo[field] = parseMoedaObj(value);
  } else if (field === 'prazo_valor') {
    objetivo[field] = parseInt(value) || 0;
  } else if (field === 'responsaveis') {
    objetivo[field] = Array.isArray(value) ? value : [value];
  } else {
    objetivo[field] = value;
  }
  
  // Se mudou o prazo_pessoa em aposentadoria, atualizar descrição
  if (objetivo.tipo === 'aposentadoria' && field === 'prazo_pessoa') {
    const pessoas = getPessoasDisponiveis();
    const pessoa = pessoas.find(p => p.id === value);
    if (pessoa) {
      objetivo.descricao = `Aposentadoria de ${pessoa.nome}`;
      objetivo.responsaveis = [value];
    }
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
// RENDERIZAÇÃO
// ========================================

function renderObjetivos() {
  const container = document.getElementById('objetivos-container');
  if (!container) return;
  
  if (analiseVisivel) {
    renderAnaliseObjetivos(container);
    return;
  }
  
  const pessoas = getPessoasDisponiveis();
  const saldoDisponivel = calcularSaldoParaObjetivos();
  const valorAlocado = calcularValorInicialAlocado();
  const saldoRestante = saldoDisponivel - valorAlocado;
  
  // Separar objetivos por tipo
  const objetivosAposentadoria = objetivos.filter(o => o.tipo === 'aposentadoria');
  const objetivosNormais = objetivos.filter(o => o.tipo !== 'aposentadoria')
    .sort((a, b) => a.prioridade - b.prioridade);
  
  // Garantir pelo menos uma aposentadoria
  if (objetivosAposentadoria.length === 0) {
    addObjetivoAposentadoria();
    return;
  }
  
  container.innerHTML = `
    <!-- Variáveis de Mercado -->
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 8px;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; font-size: 0.95rem;">
        <i class="fas fa-chart-line"></i> Variáveis de Mercado
        ${variaveisMercado.ultima_atualizacao ? `<span style="font-size: 0.75rem; font-weight: normal; opacity: 0.7; margin-left: 1rem;">Última atualização: ${new Date(variaveisMercado.ultima_atualizacao).toLocaleString('pt-BR')}</span>` : ''}
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">SELIC (%)</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.selic)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">CDI (%)</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.cdi)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">CDI Médio 10 anos (%)</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.cdi_medio_10_anos)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">IPCA (%)</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.ipca)}</div>
        </div>
        <div style="text-align: center; padding: 0.5rem; background: rgba(212, 175, 55, 0.1); border-radius: 6px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">IPCA Médio 10 anos (%)</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--accent-color);">${formatarPercentual(variaveisMercado.ipca_medio_10_anos)}</div>
        </div>
      </div>
    </div>
    
    <!-- Saldo para Objetivos -->
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--dark-bg); border: 2px solid ${saldoRestante >= 0 ? '#28a745' : '#dc3545'}; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Patrimônio Líquido (exceto Aposentadoria)</div>
          <div style="font-size: 1.3rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(saldoDisponivel)}</div>
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
      ${saldoRestante < 0 ? `<div style="margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;"><i class="fas fa-exclamation-triangle"></i> O valor alocado excede o saldo disponível!</div>` : ''}
    </div>
    
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

function renderCardAposentadoria(obj, pessoas) {
  const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoa?.idade || 30;
  
  // Calcular renda anual da pessoa
  let rendaAnual = 0;
  if (window.getFluxoCaixaData) {
    const fluxoData = window.getFluxoCaixaData();
    const receitas = fluxoData.receitas || [];
    receitas.forEach(r => {
      if (r.titular === obj.prazo_pessoa || (obj.prazo_pessoa === 'titular' && r.titular === 'titular')) {
        if (r.und_recorrencia === 'ano') {
          rendaAnual += parseFloat(r.valor) || 0;
        } else if (r.und_recorrencia === 'mes') {
          rendaAnual += (parseFloat(r.valor) || 0) * 12;
        }
      }
    });
  }
  
  // Capital necessário = Renda anual / 0,5%
  const capitalNecessario = rendaAnual / 0.005;
  
  // Calcular meses até a aposentadoria
  let mesesRestantes = 0;
  if (obj.prazo_tipo === 'idade') {
    const anosAteAposentadoria = obj.prazo_valor - idadeAtual;
    mesesRestantes = Math.max(0, anosAteAposentadoria * 12);
  } else {
    mesesRestantes = obj.prazo_valor * 12;
  }
  
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
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <!-- De quem é -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-user"></i> De quem é *
          </label>
          <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value)" 
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
                 onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value)"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
        </div>
        
        <!-- Renda Anual -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-money-bill-wave"></i> Renda Anual Atual
          </label>
          <div style="padding: 0.6rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 6px; color: #28a745; font-weight: 600;">
            ${formatarMoedaObj(rendaAnual)}
          </div>
        </div>
        
        <!-- Capital Necessário -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-piggy-bank"></i> Capital Necessário (Renda ÷ 0,5%)
          </label>
          <div style="padding: 0.6rem; background: rgba(212, 175, 55, 0.1); border: 1px solid var(--accent-color); border-radius: 6px; color: var(--accent-color); font-weight: 600;">
            ${formatarMoedaObj(capitalNecessario)}
          </div>
        </div>
      </div>
      
      <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(40, 167, 69, 0.1); border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <span style="color: var(--text-light); font-size: 0.85rem;">
            <i class="fas fa-clock"></i> Idade atual: <strong>${idadeAtual} anos</strong>
          </span>
          <span style="color: var(--text-light); font-size: 0.85rem;">
            <i class="fas fa-hourglass-half"></i> Tempo restante: <strong>${Math.floor(mesesRestantes / 12)} anos e ${mesesRestantes % 12} meses</strong>
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderCardObjetivo(obj, pessoas, totalObjetivos, saldoRestante) {
  const pessoaSelecionada = pessoas.find(p => obj.responsaveis.includes(p.id)) || pessoas[0];
  const idadeAtual = pessoaSelecionada?.idade || 30;
  
  // Calcular meses restantes
  let mesesRestantes = 0;
  if (obj.prazo_tipo === 'idade') {
    const anosAteObjetivo = obj.prazo_valor - idadeAtual;
    mesesRestantes = Math.max(0, anosAteObjetivo * 12);
  } else {
    mesesRestantes = obj.prazo_valor * 12;
  }
  
  // Opções de prioridade
  const prioridadeOptions = [];
  for (let i = 1; i <= totalObjetivos; i++) {
    prioridadeOptions.push(`<option value="${i}" ${obj.prioridade === i ? 'selected' : ''}>${i}º</option>`);
  }
  
  return `
    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <select onchange="updateObjetivoPrioridade(${obj.id}, this.value)" 
                  style="padding: 0.3rem 0.5rem; background: var(--accent-color); color: var(--dark-bg); border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
            ${prioridadeOptions.join('')}
          </select>
          <span style="font-weight: 600; color: var(--accent-color);">Prioridade</span>
        </div>
        <button onclick="deleteObjetivo(${obj.id})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 1rem;" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <!-- Qual é o objetivo -->
        <div style="grid-column: span 2;">
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-flag"></i> Qual é o objetivo? *
          </label>
          <input type="text" value="${obj.descricao || ''}" placeholder="Ex: Comprar um carro, fazer uma viagem..."
                 onchange="updateObjetivoField(${obj.id}, 'descricao', this.value)"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
        </div>
        
        <!-- Por que é importante -->
        <div style="grid-column: span 2;">
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-heart"></i> Por que é importante?
          </label>
          <textarea onchange="updateObjetivoField(${obj.id}, 'importancia', this.value)"
                    placeholder="Descreva a importância deste objetivo..."
                    style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light); min-height: 60px; resize: vertical;">${obj.importancia || ''}</textarea>
        </div>
        
        <!-- De quem é -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-users"></i> De quem é? *
          </label>
          <select multiple onchange="updateObjetivoField(${obj.id}, 'responsaveis', Array.from(this.selectedOptions).map(o => o.value))"
                  style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light); min-height: 80px;">
            ${pessoas.map(p => `<option value="${p.id}" ${obj.responsaveis.includes(p.id) ? 'selected' : ''}>${p.nome} (${p.tipo})</option>`).join('')}
          </select>
          <small style="color: var(--text-light); opacity: 0.7; font-size: 0.7rem;">Segure Ctrl/Cmd para múltiplos</small>
        </div>
        
        <!-- Prazo -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-calendar"></i> Prazo
          </label>
          <div style="display: flex; gap: 0.5rem;">
            <select onchange="updateObjetivoField(${obj.id}, 'prazo_tipo', this.value)"
                    style="flex: 1; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
              <option value="anos" ${obj.prazo_tipo === 'anos' ? 'selected' : ''}>Daqui a X anos</option>
              <option value="idade" ${obj.prazo_tipo === 'idade' ? 'selected' : ''}>Até X anos de idade</option>
            </select>
            <input type="number" value="${obj.prazo_valor}" min="1" max="100"
                   onchange="updateObjetivoField(${obj.id}, 'prazo_valor', this.value)"
                   style="width: 70px; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
          </div>
          ${obj.prazo_tipo === 'idade' ? `
            <select onchange="updateObjetivoField(${obj.id}, 'prazo_pessoa', this.value)"
                    style="width: 100%; margin-top: 0.5rem; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
              ${pessoas.map(p => `<option value="${p.id}" ${obj.prazo_pessoa === p.id ? 'selected' : ''}>${p.nome}</option>`).join('')}
            </select>
          ` : ''}
          <small style="color: var(--text-light); opacity: 0.7; font-size: 0.7rem;">${mesesRestantes} meses restantes</small>
        </div>
        
        <!-- Valor Inicial -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-wallet"></i> Valor Inicial
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_inicial)}"
                 onchange="updateObjetivoField(${obj.id}, 'valor_inicial', this.value)"
                 onblur="this.value = '${formatarMoedaObj(obj.valor_inicial)}'"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
          <small style="color: ${saldoRestante >= 0 ? '#28a745' : '#dc3545'}; font-size: 0.7rem;">Disponível: ${formatarMoedaObj(saldoRestante + (parseFloat(obj.valor_inicial) || 0))}</small>
        </div>
        
        <!-- Valor Final -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-tag"></i> Valor Final do Objetivo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.valor_final)}"
                 onchange="updateObjetivoField(${obj.id}, 'valor_final', this.value)"
                 style="width: 100%; padding: 0.6rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-light);">
        </div>
        
        <!-- Meta de Acúmulo -->
        <div>
          <label style="display: block; font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.3rem;">
            <i class="fas fa-bullseye"></i> Meta de Acúmulo
          </label>
          <input type="text" value="${formatarMoedaObj(obj.meta_acumulo)}"
                 onchange="updateObjetivoField(${obj.id}, 'meta_acumulo', this.value)"
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
    ${renderResumoGeralObjetivos(objetivosAposentadoria, objetivosNormais)}
  `;
}

function renderAnaliseAposentadoria(obj, pessoas) {
  const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
  const idadeAtual = pessoa?.idade || 30;
  
  // Calcular renda anual
  let rendaAnual = 0;
  if (window.getFluxoCaixaData) {
    const fluxoData = window.getFluxoCaixaData();
    const receitas = fluxoData.receitas || [];
    receitas.forEach(r => {
      if (r.titular === obj.prazo_pessoa) {
        if (r.und_recorrencia === 'ano') {
          rendaAnual += parseFloat(r.valor) || 0;
        } else if (r.und_recorrencia === 'mes') {
          rendaAnual += (parseFloat(r.valor) || 0) * 12;
        }
      }
    });
  }
  
  // Capital necessário
  const capitalNecessario = rendaAnual / 0.005;
  
  // Meses restantes
  const anosAteAposentadoria = obj.prazo_valor - idadeAtual;
  const mesesRestantes = Math.max(1, anosAteAposentadoria * 12);
  
  // Rendimento = 90% do CDI médio 10 anos (anual)
  const rendimentoAnual = (variaveisMercado.cdi_medio_10_anos / 100) * 0.9;
  const rendimentoMensal = Math.pow(1 + rendimentoAnual, 1/12) - 1;
  
  // Patrimônio atual para aposentadoria
  let patrimonioAposentadoria = 0;
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(p => {
      if ((p.finalidade === 'aposentadoria' || p.finalidade === 'Aposentadoria') && 
          p.donos && p.donos.includes(obj.prazo_pessoa)) {
        const valor = parseFloat(p.valor) || 0;
        const qtdDonos = p.donos.length || 1;
        patrimonioAposentadoria += valor / qtdDonos;
      }
    });
  }
  
  // Calcular aporte mensal necessário (PMT)
  // FV = PV * (1+r)^n + PMT * ((1+r)^n - 1) / r
  // PMT = (FV - PV * (1+r)^n) * r / ((1+r)^n - 1)
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
  
  // Gerar dados para gráfico de evolução
  const dadosEvolucao = [];
  let saldoAcumulado = pv;
  for (let mes = 0; mes <= mesesRestantes; mes += Math.max(1, Math.floor(mesesRestantes / 20))) {
    dadosEvolucao.push({
      mes: mes,
      ano: Math.floor(mes / 12),
      saldo: saldoAcumulado
    });
    // Simular próximos meses
    const mesesAteProximo = Math.min(Math.max(1, Math.floor(mesesRestantes / 20)), mesesRestantes - mes);
    for (let i = 0; i < mesesAteProximo; i++) {
      saldoAcumulado = saldoAcumulado * (1 + r) + aporteMensal;
    }
  }
  
  return `
    <div style="background: var(--card-bg); border: 2px solid #28a745; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
      <h5 style="color: #28a745; margin: 0 0 1rem 0;">
        <i class="fas fa-user"></i> ${pessoa?.nome || 'Pessoa'} - Aposentadoria aos ${obj.prazo_valor} anos
      </h5>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
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
            <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Rendimento considerado (90% CDI médio 10 anos)</div>
            <div style="font-size: 1rem; font-weight: 600; color: var(--text-light);">${formatarPercentual(rendimentoAnual * 100)} a.a.</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Aporte Mensal Necessário</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: ${aporteMensal > 0 ? '#dc3545' : '#28a745'};">${formatarMoedaObj(aporteMensal)}</div>
          </div>
        </div>
      </div>
      
      <!-- Tabela de Evolução -->
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="background: rgba(40, 167, 69, 0.2);">
              <th style="padding: 0.5rem; text-align: left; border: 1px solid var(--border-color);">Ano</th>
              <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">Idade</th>
              <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">Saldo Projetado</th>
              <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">% da Meta</th>
            </tr>
          </thead>
          <tbody>
            ${[0, Math.floor(anosAteAposentadoria * 0.25), Math.floor(anosAteAposentadoria * 0.5), Math.floor(anosAteAposentadoria * 0.75), anosAteAposentadoria].map(ano => {
              const meses = ano * 12;
              let saldo = pv;
              for (let m = 0; m < meses; m++) {
                saldo = saldo * (1 + r) + aporteMensal;
              }
              const percentualMeta = capitalNecessario > 0 ? (saldo / capitalNecessario) * 100 : 0;
              return `
                <tr>
                  <td style="padding: 0.5rem; border: 1px solid var(--border-color);">Ano ${ano}</td>
                  <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">${idadeAtual + ano} anos</td>
                  <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaObj(saldo)}</td>
                  <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: ${percentualMeta >= 100 ? '#28a745' : '#ffc107'};">${percentualMeta.toFixed(1)}%</td>
                </tr>
              `;
            }).join('')}
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
    const anosAteObjetivo = obj.prazo_valor - idadeAtual;
    mesesRestantes = Math.max(1, anosAteObjetivo * 12);
  } else {
    mesesRestantes = Math.max(1, obj.prazo_valor * 12);
  }
  
  const anosRestantes = mesesRestantes / 12;
  
  // Meta de acúmulo reajustada pelo IPCA
  const ipcaAnual = variaveisMercado.ipca / 100;
  const metaReajustada = obj.meta_acumulo * Math.pow(1 + ipcaAnual, anosRestantes);
  
  // Rendimento considerado (CDI - 15% IR sobre rendimento)
  const rendimentoBrutoAnual = variaveisMercado.cdi / 100;
  const rendimentoMensal = Math.pow(1 + rendimentoBrutoAnual, 1/12) - 1;
  
  // Valor inicial
  const valorInicial = parseFloat(obj.valor_inicial) || 0;
  
  // Calcular aporte mensal necessário considerando IR de 15% sobre rendimento
  // Meta líquida = Meta / (1 - 0.15 * (rendimento_total / valor_final))
  // Simplificando: precisamos acumular mais para compensar o IR
  
  // Primeiro, calcular sem IR
  const fv = metaReajustada;
  const pv = valorInicial;
  const r = rendimentoMensal;
  const n = mesesRestantes;
  
  let aporteMensalBruto = 0;
  if (r > 0 && n > 0) {
    const fator = Math.pow(1 + r, n);
    aporteMensalBruto = (fv - pv * fator) * r / (fator - 1);
    if (aporteMensalBruto < 0) aporteMensalBruto = 0;
  }
  
  // Ajustar para IR de 15% sobre rendimento
  // Rendimento total = FV - (PV + aportes totais)
  // IR = 15% * rendimento
  // Precisamos que FV - IR >= meta
  // Então FV_bruto = meta / 0.85 (aproximação)
  const fvBrutoNecessario = metaReajustada / 0.85;
  
  let aporteMensalAjustado = 0;
  if (r > 0 && n > 0) {
    const fator = Math.pow(1 + r, n);
    aporteMensalAjustado = (fvBrutoNecessario - pv * fator) * r / (fator - 1);
    if (aporteMensalAjustado < 0) aporteMensalAjustado = 0;
  }
  
  return `
    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <span style="background: var(--accent-color); color: var(--dark-bg); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${obj.prioridade}º Prioridade</span>
          <h5 style="color: var(--accent-color); margin: 0.5rem 0 0 0;">${obj.descricao || 'Objetivo sem nome'}</h5>
          ${obj.importancia ? `<p style="color: var(--text-light); opacity: 0.8; font-size: 0.85rem; margin: 0.3rem 0 0 0;">${obj.importancia}</p>` : ''}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.8rem; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Valor Final</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(obj.valor_final)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Meta de Acúmulo</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--accent-color);">${formatarMoedaObj(obj.meta_acumulo)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Meta Reajustada (IPCA)</div>
          <div style="font-size: 1rem; font-weight: 600; color: #ffc107;">${formatarMoedaObj(metaReajustada)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(0, 123, 255, 0.1); border-radius: 8px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Valor Inicial</div>
          <div style="font-size: 1rem; font-weight: 600; color: #007bff;">${formatarMoedaObj(valorInicial)}</div>
        </div>
        <div style="text-align: center; padding: 0.8rem; background: rgba(40, 167, 69, 0.1); border-radius: 8px;">
          <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.8;">Prazo</div>
          <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${anosRestantes.toFixed(1)} anos</div>
        </div>
      </div>
      
      <div style="padding: 1rem; background: var(--dark-bg); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-light); opacity: 0.8;">Rendimento CDI: ${formatarPercentual(variaveisMercado.cdi)} a.a. | IPCA: ${formatarPercentual(variaveisMercado.ipca)} a.a.</div>
            <div style="font-size: 0.75rem; color: var(--text-light); opacity: 0.6;">Considerando IR de 15% sobre rendimento</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.8rem; color: var(--text-light); opacity: 0.8;">Aporte Mensal Estimado</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: ${aporteMensalAjustado > 0 ? 'var(--accent-color)' : '#28a745'};">${formatarMoedaObj(aporteMensalAjustado)}</div>
          </div>
        </div>
      </div>
      
      <!-- Tabela de Evolução -->
      <div style="margin-top: 1rem; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="background: rgba(212, 175, 55, 0.2);">
              <th style="padding: 0.4rem; text-align: left; border: 1px solid var(--border-color);">Ano</th>
              <th style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color);">Saldo Bruto</th>
              <th style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color);">Meta Reajustada</th>
              <th style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color);">% da Meta</th>
            </tr>
          </thead>
          <tbody>
            ${[0, Math.ceil(anosRestantes * 0.25), Math.ceil(anosRestantes * 0.5), Math.ceil(anosRestantes * 0.75), Math.ceil(anosRestantes)].filter((v, i, a) => a.indexOf(v) === i).map(ano => {
              const meses = ano * 12;
              let saldo = valorInicial;
              for (let m = 0; m < meses; m++) {
                saldo = saldo * (1 + r) + aporteMensalAjustado;
              }
              const metaNoAno = obj.meta_acumulo * Math.pow(1 + ipcaAnual, ano);
              const percentualMeta = metaNoAno > 0 ? (saldo / metaNoAno) * 100 : 0;
              return `
                <tr>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color);">Ano ${ano}</td>
                  <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color); color: var(--accent-color);">${formatarMoedaObj(saldo)}</td>
                  <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaObj(metaNoAno)}</td>
                  <td style="padding: 0.4rem; text-align: right; border: 1px solid var(--border-color); color: ${percentualMeta >= 100 ? '#28a745' : '#ffc107'};">${percentualMeta.toFixed(1)}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderResumoGeralObjetivos(objetivosAposentadoria, objetivosNormais) {
  // Calcular total de aportes mensais necessários
  let totalAportesAposentadoria = 0;
  let totalAportesObjetivos = 0;
  
  const pessoas = getPessoasDisponiveis();
  
  // Aportes de aposentadoria
  objetivosAposentadoria.forEach(obj => {
    const pessoa = pessoas.find(p => p.id === obj.prazo_pessoa) || pessoas[0];
    const idadeAtual = pessoa?.idade || 30;
    const anosAteAposentadoria = obj.prazo_valor - idadeAtual;
    const mesesRestantes = Math.max(1, anosAteAposentadoria * 12);
    
    let rendaAnual = 0;
    if (window.getFluxoCaixaData) {
      const fluxoData = window.getFluxoCaixaData();
      const receitas = fluxoData.receitas || [];
      receitas.forEach(r => {
        if (r.titular === obj.prazo_pessoa) {
          if (r.und_recorrencia === 'ano') rendaAnual += parseFloat(r.valor) || 0;
          else if (r.und_recorrencia === 'mes') rendaAnual += (parseFloat(r.valor) || 0) * 12;
        }
      });
    }
    
    const capitalNecessario = rendaAnual / 0.005;
    const rendimentoAnual = (variaveisMercado.cdi_medio_10_anos / 100) * 0.9;
    const rendimentoMensal = Math.pow(1 + rendimentoAnual, 1/12) - 1;
    
    let patrimonioAposentadoria = 0;
    if (window.getPatrimoniosLiquidosData) {
      const patrimonios = window.getPatrimoniosLiquidosData() || [];
      patrimonios.forEach(p => {
        if ((p.finalidade === 'aposentadoria' || p.finalidade === 'Aposentadoria') && 
            p.donos && p.donos.includes(obj.prazo_pessoa)) {
          patrimonioAposentadoria += (parseFloat(p.valor) || 0) / (p.donos.length || 1);
        }
      });
    }
    
    if (rendimentoMensal > 0 && mesesRestantes > 0) {
      const fator = Math.pow(1 + rendimentoMensal, mesesRestantes);
      const aporte = (capitalNecessario - patrimonioAposentadoria * fator) * rendimentoMensal / (fator - 1);
      totalAportesAposentadoria += Math.max(0, aporte);
    }
  });
  
  // Aportes de objetivos normais
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
    
    const rendimentoMensal = Math.pow(1 + variaveisMercado.cdi / 100, 1/12) - 1;
    const valorInicial = parseFloat(obj.valor_inicial) || 0;
    
    if (rendimentoMensal > 0 && mesesRestantes > 0) {
      const fator = Math.pow(1 + rendimentoMensal, mesesRestantes);
      const aporte = (fvBrutoNecessario - valorInicial * fator) * rendimentoMensal / (fator - 1);
      totalAportesObjetivos += Math.max(0, aporte);
    }
  });
  
  const totalAportesMensal = totalAportesAposentadoria + totalAportesObjetivos;
  
  return `
    <div style="margin-top: 2rem; padding: 1.5rem; background: var(--dark-bg); border: 2px solid var(--accent-color); border-radius: 10px;">
      <h4 style="color: var(--accent-color); margin: 0 0 1.5rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> RESUMO GERAL DOS OBJETIVOS
      </h4>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px;">
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Aportes para Aposentadoria</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: #28a745;">${formatarMoedaObj(totalAportesAposentadoria)}/mês</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(212, 175, 55, 0.1); border: 1px solid var(--accent-color); border-radius: 8px;">
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">Aportes para Objetivos</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-color);">${formatarMoedaObj(totalAportesObjetivos)}/mês</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255, 255, 255, 0.1); border: 2px solid #ffffff; border-radius: 8px;">
          <div style="font-size: 0.85rem; color: var(--text-light); opacity: 0.8;">TOTAL DE APORTES</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #ffffff;">${formatarMoedaObj(totalAportesMensal)}/mês</div>
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
