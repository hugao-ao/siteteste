// modal-functions.js - Funções críticas para modais
// Este arquivo deve ser carregado ANTES do equipe-hvc.js

console.log('🔧 Carregando funções críticas dos modais...');

// Função para mostrar modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        console.log(`✅ Modal ${modalId} aberto`);
    } else {
        console.error(`❌ Modal ${modalId} não encontrado`);
    }
}

// Função para fechar modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        console.log(`✅ Modal ${modalId} fechado`);
    } else {
        console.error(`❌ Modal ${modalId} não encontrado`);
    }
}

// Funções específicas para cada modal - DISPONÍVEIS GLOBALMENTE
window.openFuncoesModal = function() {
    console.log('🎯 openFuncoesModal chamada');
    showModal('modal-funcoes');
};

window.closeFuncoesModal = function() {
    console.log('🎯 closeFuncoesModal chamada');
    hideModal('modal-funcoes');
};

window.closeEquipeModal = function() {
    console.log('🎯 closeEquipeModal chamada');
    hideModal('modal-equipe');
};

window.closeIntegranteModal = function() {
    console.log('🎯 closeIntegranteModal chamada');
    hideModal('modal-integrante');
};

window.openNovaFuncaoForm = function() {
    console.log('🎯 openNovaFuncaoForm chamada');
    showModal('modal-funcao');
    
    // Limpar formulário se existir
    const form = document.getElementById('form-funcao');
    if (form) {
        form.reset();
        console.log('📝 Formulário limpo');
    }
};

window.cancelNovaFuncao = function() {
    console.log('🎯 cancelNovaFuncao chamada');
    hideModal('modal-funcao');
};

// Função para abrir modal de integrante
window.openIntegranteModal = function() {
    console.log('🎯 openIntegranteModal chamada');
    showModal('modal-integrante');
    
    // Limpar formulário se existir
    const form = document.getElementById('form-integrante');
    if (form) {
        form.reset();
        console.log('📝 Formulário integrante limpo');
    }
};

// Função para abrir modal de equipe
window.openEquipeModal = function() {
    console.log('🎯 openEquipeModal chamada');
    showModal('modal-equipe');
    
    // Limpar formulário se existir
    const form = document.getElementById('form-equipe');
    if (form) {
        form.reset();
        console.log('📝 Formulário equipe limpo');
    }
};

// Função de teste para verificar se tudo está funcionando
window.testModalFunctions = function() {
    console.log('🧪 Testando funções dos modais...');
    console.log('✅ openFuncoesModal:', typeof window.openFuncoesModal);
    console.log('✅ closeFuncoesModal:', typeof window.closeFuncoesModal);
    console.log('✅ closeEquipeModal:', typeof window.closeEquipeModal);
    console.log('✅ closeIntegranteModal:', typeof window.closeIntegranteModal);
    console.log('✅ openNovaFuncaoForm:', typeof window.openNovaFuncaoForm);
    console.log('✅ cancelNovaFuncao:', typeof window.cancelNovaFuncao);
    console.log('🎉 Todas as funções estão disponíveis!');
};

// Auto-teste quando o arquivo carrega
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, testando funções...');
    window.testModalFunctions();
});

console.log('✅ Arquivo modal-functions.js carregado com sucesso!');

