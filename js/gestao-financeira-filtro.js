// Função para filtrar formas de pagamento com base na via selecionada
function filtrarFormasPorVia() {
  // Obter os elementos do DOM
  const viaItemSelect = document.getElementById('via-item');
  const formaItemSelect = document.getElementById('forma-item');
  
  if (!viaItemSelect || !formaItemSelect) {
    console.error('Elementos de seleção não encontrados');
    return;
  }
  
  // Obter o valor selecionado na via
  const viaSelecionada = viaItemSelect.value;
  
  // Salvar a forma selecionada atual (se houver)
  const formaSelecionadaAtual = formaItemSelect.value;
  
  // Limpar todas as opções do select de forma, exceto a primeira (sem preenchimento)
  while (formaItemSelect.options.length > 1) {
    formaItemSelect.remove(1);
  }
  
  // Se não houver formas de pagamento carregadas, não há o que filtrar
  if (!window.formasPagamento || !Array.isArray(window.formasPagamento)) {
    console.warn('Formas de pagamento não disponíveis para filtragem');
    return;
  }
  
  // Filtrar as formas de pagamento com base na via selecionada
  const formasFiltradas = window.formasPagamento.filter(forma => {
    if (viaSelecionada === 'DEBITO') {
      return forma.tipo === 'CONTA';
    } else if (viaSelecionada === 'CREDITO') {
      return forma.tipo === 'CARTAO_CREDITO';
    } else {
      // Se a via for SEM_PREENCHIMENTO, mostrar todas as formas
      return true;
    }
  });
  
  // Adicionar as formas filtradas ao select
  formasFiltradas.forEach(forma => {
    const option = document.createElement('option');
    option.value = forma.id;
    
    // Formatar o texto da opção com base no tipo
    if (forma.tipo === 'CARTAO_CREDITO') {
      option.textContent = `${forma.nome} (Cartão - Venc: ${forma.data_vencimento || 'N/A'})`;
    } else {
      option.textContent = `${forma.nome} (Conta)`;
    }
    
    formaItemSelect.appendChild(option);
  });
  
  // Tentar restaurar a seleção anterior se ainda estiver disponível
  if (formaSelecionadaAtual !== 'SEM_PREENCHIMENTO') {
    const formaSelecionadaExiste = Array.from(formaItemSelect.options).some(opt => opt.value === formaSelecionadaAtual);
    if (formaSelecionadaExiste) {
      formaItemSelect.value = formaSelecionadaAtual;
    } else {
      // Se a forma anteriormente selecionada não estiver mais disponível, selecionar a primeira opção
      formaItemSelect.selectedIndex = 0;
    }
  }
}

// Função para modificar o carregamento de formas de pagamento
function modificarLoadFormasPagamento() {
  // Armazenar a função original
  const originalLoadFormasPagamento = window.loadFormasPagamento;
  
  // Substituir pela nova função que chama a original e depois aplica o filtro
  window.loadFormasPagamento = async function() {
    // Chamar a função original para carregar todas as formas
    await originalLoadFormasPagamento.apply(this, arguments);
    
    // Aplicar o filtro com base na via atual
    filtrarFormasPorVia();
  };
}

// Função para adicionar o event listener ao select de via
function adicionarEventListenerVia() {
  const viaItemSelect = document.getElementById('via-item');
  
  if (viaItemSelect) {
    viaItemSelect.addEventListener('change', filtrarFormasPorVia);
    console.log('Event listener adicionado ao select de via');
  } else {
    console.error('Elemento via-item não encontrado');
  }
}

// Função de inicialização
function inicializarFiltragem() {
  // Modificar a função de carregamento
  modificarLoadFormasPagamento();
  
  // Adicionar o event listener quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', adicionarEventListenerVia);
  } else {
    adicionarEventListenerVia();
  }
}

// Inicializar a filtragem
inicializarFiltragem();
