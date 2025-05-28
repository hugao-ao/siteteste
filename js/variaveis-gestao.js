// variaveis-gestao.js
import { supabase } from './supabase.js';
import { loadVariaveisGestaoFinanceira, saveVariaveisGestaoFinanceira } from './js/gestao-financeira.js';

document.addEventListener("DOMContentLoaded", async () => {
  // Verificar se é admin
  const userLevel = sessionStorage.getItem("nivel");
  if (userLevel !== 'admin') {
    alert("Acesso não autorizado.");
    window.location.href = "index.html";
    return;
  }
  
  // Aplicar tema do projeto Planejamento
  const mainContent = document.getElementById('main-content-variaveis-gestao');
  if (mainContent) {
    mainContent.classList.add('theme-planejamento');
    
    // Se a sidebar já foi injetada, tenta aplicar o tema nela também
    const sidebar = document.getElementById('sidebar');
    if(sidebar) {
      sidebar.classList.remove('theme-admin', 'theme-argos', 'theme-hvc', 'theme-planejamento', 'theme-default');
      sidebar.classList.add('theme-planejamento');
    }
  }
  
  // Elementos DOM
  const form = document.getElementById('variaveis-form');
  const despesasFixasInput = document.getElementById('despesas-fixas');
  const despesasVariaveisInput = document.getElementById('despesas-variaveis');
  const investimentosInput = document.getElementById('investimentos');
  const totalPercentual = document.getElementById('total-percentual');
  const totalWarning = document.getElementById('total-warning');
  const alertSuccess = document.getElementById('alert-success');
  const alertError = document.getElementById('alert-error');
  
  // Função para calcular e atualizar o total
  function updateTotal() {
    const despesasFixas = parseFloat(despesasFixasInput.value) || 0;
    const despesasVariaveis = parseFloat(despesasVariaveisInput.value) || 0;
    const investimentos = parseFloat(investimentosInput.value) || 0;
    
    const total = despesasFixas + despesasVariaveis + investimentos;
    totalPercentual.textContent = total.toFixed(2) + '%';
    
    if (Math.abs(total - 100) > 0.01) {
      totalWarning.style.display = 'block';
    } else {
      totalWarning.style.display = 'none';
    }
  }
  
  // Adicionar event listeners para atualizar o total quando os valores mudarem
  despesasFixasInput.addEventListener('input', updateTotal);
  despesasVariaveisInput.addEventListener('input', updateTotal);
  investimentosInput.addEventListener('input', updateTotal);
  
  // Carregar variáveis existentes
  async function loadVariaveis() {
    try {
      const variaveis = await loadVariaveisGestaoFinanceira();
      
      if (Object.keys(variaveis).length > 0) {
        despesasFixasInput.value = variaveis['DESPESAS_FIXAS'] || 0;
        despesasVariaveisInput.value = variaveis['DESPESAS_VARIAVEIS'] || 0;
        investimentosInput.value = variaveis['INVESTIMENTOS'] || 0;
        
        updateTotal();
      }
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
      showAlert('error');
    }
  }
  
  // Salvar variáveis
  async function saveVariaveis(event) {
    event.preventDefault();
    
    const despesasFixas = parseFloat(despesasFixasInput.value);
    const despesasVariaveis = parseFloat(despesasVariaveisInput.value);
    const investimentos = parseFloat(investimentosInput.value);
    
    const total = despesasFixas + despesasVariaveis + investimentos;
    if (Math.abs(total - 100) > 0.01) {
      alert('O total deve ser igual a 100%');
      return;
    }
    
    try {
      await saveVariaveisGestaoFinanceira(despesasFixas, despesasVariaveis, investimentos);
      showAlert('success');
    } catch (error) {
      console.error('Erro ao salvar variáveis:', error);
      showAlert('error');
    }
  }
  
  // Mostrar alerta
  function showAlert(type) {
    if (type === 'success') {
      alertSuccess.style.display = 'block';
      setTimeout(() => {
        alertSuccess.style.display = 'none';
      }, 3000);
    } else {
      alertError.style.display = 'block';
      setTimeout(() => {
        alertError.style.display = 'none';
      }, 3000);
    }
  }
  
  // Carregar variáveis existentes
  await loadVariaveis();
  
  // Adicionar event listener para o formulário
  form.addEventListener('submit', saveVariaveis);
});
