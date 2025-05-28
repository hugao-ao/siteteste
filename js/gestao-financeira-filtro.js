// gestao-financeira-filtro.js

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
  
  // Verificar se as formas de pagamento estão disponíveis no escopo atual
  if (typeof formasPagamento === 'undefined' || !Array.isArray(formasPagamento)) {
    console.warn('Formas de pagamento não disponíveis para filtragem');
    return;
  }
  
  // Filtrar as formas de pagamento com base na via selecionada
  const formasFiltradas = formasPagamento.filter(forma => {
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

// Função para inicializar a filtragem quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando filtragem de formas por via');
  
  // Adicionar event listener ao select de via
  const viaItemSelect = document.getElementById('via-item');
  if (viaItemSelect) {
    viaItemSelect.addEventListener('change', filtrarFormasPorVia);
    console.log('Event listener adicionado ao select de via');
  } else {
    console.error('Elemento via-item não encontrado');
  }
  
  // Modificar a função de carregamento de formas de pagamento
  // Aguardar até que a função original esteja disponível
  const checkForLoadFunction = setInterval(function() {
    if (typeof loadFormasPagamento === 'function') {
      clearInterval(checkForLoadFunction);
      
      // Armazenar a função original
      const originalLoadFormasPagamento = loadFormasPagamento;
      
      // Substituir pela nova função que chama a original e depois aplica o filtro
      window.loadFormasPagamento = async function() {
        // Chamar a função original para carregar todas as formas
        await originalLoadFormasPagamento.apply(this, arguments);
        
        // Aplicar o filtro com base na via atual
        setTimeout(filtrarFormasPorVia, 100); // Pequeno atraso para garantir que os dados estejam disponíveis
      };
      
      console.log('Função loadFormasPagamento modificada com sucesso');
    }
  }, 100);
});
