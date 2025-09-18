// multi_account_manager.js - Gerenciador de Múltiplas Contas Google Calendar

// ===================================================================
// VARIÁVEIS GLOBAIS PARA MÚLTIPLAS CONTAS
// ===================================================================

// Array para armazenar todas as contas conectadas
window.connectedAccounts = [];

// Variável para controlar a conta atualmente sendo autenticada
let currentAuthAccount = null;

// ===================================================================
// FUNÇÕES DE GERENCIAMENTO DE CONTAS
// ===================================================================

/**
 * Adiciona uma nova conta à lista de contas conectadas
 */
function addAccount(accountInfo) {
    // Verificar se a conta já existe
    const existingAccount = window.connectedAccounts.find(acc => acc.email === accountInfo.email);
    
    if (existingAccount) {
        console.log('Conta já existe, atualizando informações:', accountInfo.email);
        Object.assign(existingAccount, accountInfo);
    } else {
        console.log('Adicionando nova conta:', accountInfo.email);
        window.connectedAccounts.push(accountInfo);
    }
    
    // Salvar no localStorage
    saveAccountsToStorage();
    
    // Atualizar interface
    renderAccountsList();
    updateSyncButtonState();
}

/**
 * Remove uma conta da lista de contas conectadas
 */
function removeAccount(email) {
    console.log('Removendo conta:', email);
    
    window.connectedAccounts = window.connectedAccounts.filter(acc => acc.email !== email);
    
    // Salvar no localStorage
    saveAccountsToStorage();
    
    // Atualizar interface
    renderAccountsList();
    updateSyncButtonState();
}

/**
 * Atualiza o status de uma conta
 */
function updateAccountStatus(email, status, lastSync = null) {
    const account = window.connectedAccounts.find(acc => acc.email === email);
    
    if (account) {
        account.status = status;
        if (lastSync) {
            account.lastSync = lastSync;
        }
        
        // Salvar no localStorage
        saveAccountsToStorage();
        
        // Atualizar interface
        renderAccountsList();
    }
}

/**
 * Salva as contas no localStorage
 */
function saveAccountsToStorage() {
    try {
        localStorage.setItem('hvc_connected_accounts', JSON.stringify(window.connectedAccounts));
        console.log('Contas salvas no localStorage:', window.connectedAccounts.length);
    } catch (error) {
        console.error('Erro ao salvar contas no localStorage:', error);
    }
}

/**
 * Carrega as contas do localStorage
 */
function loadAccountsFromStorage() {
    try {
        const stored = localStorage.getItem('hvc_connected_accounts');
        if (stored) {
            window.connectedAccounts = JSON.parse(stored);
            console.log('Contas carregadas do localStorage:', window.connectedAccounts.length);
        }
    } catch (error) {
        console.error('Erro ao carregar contas do localStorage:', error);
        window.connectedAccounts = [];
    }
}

/**
 * Gera um avatar colorido baseado no email
 */
function generateAvatar(email) {
    const colors = [
        '#4285f4', '#34a853', '#ea4335', '#fbbc04', '#9c27b0',
        '#ff9800', '#795548', '#607d8b', '#e91e63', '#009688'
    ];
    
    const initial = email.charAt(0).toUpperCase();
    const colorIndex = email.charCodeAt(0) % colors.length;
    
    return {
        initial: initial,
        backgroundColor: colors[colorIndex]
    };
}

/**
 * Renderiza a lista de contas conectadas
 */
function renderAccountsList() {
    const accountsList = document.getElementById('accountsList');
    
    if (!accountsList) {
        console.error('Elemento accountsList não encontrado');
        return;
    }
    
    if (window.connectedAccounts.length === 0) {
        accountsList.innerHTML = `
            <div class="no-accounts">
                <i class="fas fa-user-plus"></i>
                <p>Nenhuma conta conectada</p>
                <small>Clique em "Adicionar Nova Conta" para começar</small>
            </div>
        `;
        return;
    }
    
    const accountsHTML = window.connectedAccounts.map(account => {
        const avatar = generateAvatar(account.email);
        const statusClass = account.status || 'disconnected';
        const statusIcon = getStatusIcon(statusClass);
        const statusText = getStatusText(statusClass);
        
        return `
            <div class="account-item" data-email="${account.email}">
                <div class="account-info">
                    <div class="account-avatar" style="background-color: ${avatar.backgroundColor}">
                        ${avatar.initial}
                    </div>
                    <div class="account-details">
                        <div class="account-email">${account.email}</div>
                        <div class="account-status ${statusClass}">
                            <i class="${statusIcon}"></i>
                            <span>${statusText}</span>
                            ${account.lastSync ? `<small>(Última sync: ${formatLastSync(account.lastSync)})</small>` : ''}
                        </div>
                    </div>
                </div>
                <div class="account-controls">
                    ${getAccountButtons(account)}
                </div>
            </div>
        `;
    }).join('');
    
    accountsList.innerHTML = accountsHTML;
    
    // Adicionar event listeners para os botões
    addAccountButtonListeners();
}

/**
 * Retorna o ícone apropriado para o status
 */
function getStatusIcon(status) {
    switch (status) {
        case 'connected': return 'fas fa-check-circle';
        case 'syncing': return 'fas fa-sync-alt fa-spin';
        case 'error': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-times-circle';
    }
}

/**
 * Retorna o texto apropriado para o status
 */
function getStatusText(status) {
    switch (status) {
        case 'connected': return 'Conectado';
        case 'syncing': return 'Sincronizando...';
        case 'error': return 'Erro na conexão';
        default: return 'Desconectado';
    }
}

/**
 * Retorna os botões apropriados para cada conta
 */
function getAccountButtons(account) {
    const status = account.status || 'disconnected';
    
    switch (status) {
        case 'connected':
            return `
                <button class="account-btn sync" onclick="syncAccount('${account.email}')">
                    <i class="fas fa-sync-alt"></i> Sincronizar
                </button>
                <button class="account-btn disconnect" onclick="disconnectAccount('${account.email}')">
                    <i class="fas fa-unlink"></i> Desconectar
                </button>
            `;
        
        case 'syncing':
            return `
                <button class="account-btn sync" disabled>
                    <i class="fas fa-sync-alt fa-spin"></i> Sincronizando...
                </button>
                <button class="account-btn disconnect" onclick="disconnectAccount('${account.email}')">
                    <i class="fas fa-unlink"></i> Desconectar
                </button>
            `;
        
        case 'error':
        case 'disconnected':
        default:
            return `
                <button class="account-btn reconnect" onclick="reconnectAccount('${account.email}')">
                    <i class="fas fa-link"></i> Reconectar
                </button>
                <button class="account-btn disconnect" onclick="removeAccountFromList('${account.email}')">
                    <i class="fas fa-trash"></i> Remover
                </button>
            `;
    }
}

/**
 * Formata a data da última sincronização
 */
function formatLastSync(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
}

/**
 * Adiciona event listeners para os botões das contas
 */
function addAccountButtonListeners() {
    // Os event listeners são adicionados via onclick nos botões
    // Esta função pode ser expandida se necessário
}

/**
 * Atualiza o estado do botão de sincronização geral
 */
function updateSyncButtonState() {
    const syncAllButton = document.getElementById('syncAllButton');
    
    if (!syncAllButton) return;
    
    const hasConnectedAccounts = window.connectedAccounts.some(acc => acc.status === 'connected');
    
    syncAllButton.disabled = !hasConnectedAccounts;
    
    if (hasConnectedAccounts) {
        syncAllButton.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Todas as Contas';
    } else {
        syncAllButton.innerHTML = '<i class="fas fa-sync-alt"></i> Nenhuma conta conectada';
    }
}

// ===================================================================
// FUNÇÕES DE AÇÃO (CHAMADAS PELOS BOTÕES)
// ===================================================================

/**
 * Inicia o processo de adição de uma nova conta
 */
window.addNewAccount = function() {
    console.log('Iniciando processo de adição de nova conta');
    
    // Marcar que estamos adicionando uma nova conta
    currentAuthAccount = null;
    
    // Iniciar processo de autenticação
    if (typeof handleAuthClick === 'function') {
        handleAuthClick();
    } else {
        console.error('Função handleAuthClick não encontrada');
        alert('Erro: Sistema de autenticação não carregado');
    }
};

/**
 * Sincroniza uma conta específica
 */
window.syncAccount = async function(email) {
    console.log('Sincronizando conta:', email);
    
    updateAccountStatus(email, 'syncing');
    
    try {
        // Aqui você implementaria a lógica de sincronização específica da conta
        // Por enquanto, simularemos uma sincronização
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay
        
        updateAccountStatus(email, 'connected', Date.now());
        
        console.log('Conta sincronizada com sucesso:', email);
        
        // Recarregar dados se necessário
        if (typeof loadCalendarData === 'function') {
            loadCalendarData();
        }
        
    } catch (error) {
        console.error('Erro ao sincronizar conta:', email, error);
        updateAccountStatus(email, 'error');
        alert('Erro ao sincronizar a conta. Tente novamente.');
    }
};

/**
 * Desconecta uma conta
 */
window.disconnectAccount = function(email) {
    console.log('Desconectando conta:', email);
    
    if (confirm(`Tem certeza que deseja desconectar a conta ${email}?`)) {
        updateAccountStatus(email, 'disconnected');
        
        // Aqui você implementaria a lógica de revogação de token se necessário
        
        console.log('Conta desconectada:', email);
    }
};

/**
 * Reconecta uma conta
 */
window.reconnectAccount = function(email) {
    console.log('Reconectando conta:', email);
    
    // Marcar qual conta estamos reconectando
    currentAuthAccount = email;
    
    // Iniciar processo de autenticação
    if (typeof handleAuthClick === 'function') {
        handleAuthClick();
    } else {
        console.error('Função handleAuthClick não encontrada');
        alert('Erro: Sistema de autenticação não carregado');
    }
};

/**
 * Remove uma conta da lista
 */
window.removeAccountFromList = function(email) {
    console.log('Removendo conta da lista:', email);
    
    if (confirm(`Tem certeza que deseja remover a conta ${email} da lista?`)) {
        removeAccount(email);
        console.log('Conta removida da lista:', email);
    }
};

/**
 * Sincroniza todas as contas conectadas
 */
window.syncAllAccounts = async function() {
    console.log('Sincronizando todas as contas');
    
    const connectedAccounts = window.connectedAccounts.filter(acc => acc.status === 'connected');
    
    if (connectedAccounts.length === 0) {
        alert('Nenhuma conta conectada para sincronizar');
        return;
    }
    
    // Sincronizar todas as contas em paralelo
    const syncPromises = connectedAccounts.map(account => syncAccount(account.email));
    
    try {
        await Promise.all(syncPromises);
        console.log('Todas as contas sincronizadas com sucesso');
        
        // Mostrar mensagem de sucesso
        if (typeof showMessage === 'function') {
            showMessage('Todas as contas foram sincronizadas com sucesso!', 'success');
        }
        
    } catch (error) {
        console.error('Erro ao sincronizar algumas contas:', error);
        alert('Algumas contas não puderam ser sincronizadas. Verifique os logs para mais detalhes.');
    }
};

// ===================================================================
// INTEGRAÇÃO COM O SISTEMA EXISTENTE
// ===================================================================

/**
 * Função chamada quando uma autenticação é bem-sucedida
 * Deve ser chamada pelo sistema de autenticação existente
 */
window.onAuthSuccess = function(userInfo, accessToken) {
    console.log('Autenticação bem-sucedida para:', userInfo.email);
    
    const accountInfo = {
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        accessToken: accessToken,
        status: 'connected',
        lastSync: Date.now(),
        addedAt: Date.now()
    };
    
    // Se estamos reconectando uma conta específica, atualizar apenas ela
    if (currentAuthAccount && currentAuthAccount === userInfo.email) {
        console.log('Reconectando conta existente:', userInfo.email);
    } else {
        console.log('Adicionando nova conta:', userInfo.email);
    }
    
    addAccount(accountInfo);
    
    // Limpar variável de controle
    currentAuthAccount = null;
    
    // Mostrar mensagem de sucesso
    if (typeof showMessage === 'function') {
        showMessage(`Conta ${userInfo.email} conectada com sucesso!`, 'success');
    }
};

/**
 * Função para obter todas as contas conectadas
 */
window.getConnectedAccounts = function() {
    return window.connectedAccounts.filter(acc => acc.status === 'connected');
};

/**
 * Função para obter tokens de acesso de todas as contas conectadas
 */
window.getAllAccessTokens = function() {
    return window.connectedAccounts
        .filter(acc => acc.status === 'connected' && acc.accessToken)
        .map(acc => ({
            email: acc.email,
            accessToken: acc.accessToken
        }));
};

// ===================================================================
// INICIALIZAÇÃO
// ===================================================================

/**
 * Inicializa o gerenciador de múltiplas contas
 */
function initMultiAccountManager() {
    console.log('Inicializando gerenciador de múltiplas contas');
    
    // Carregar contas do localStorage
    loadAccountsFromStorage();
    
    // Renderizar lista inicial
    renderAccountsList();
    
    // Configurar event listeners
    const addAccountButton = document.getElementById('addAccountButton');
    if (addAccountButton) {
        addAccountButton.addEventListener('click', addNewAccount);
    }
    
    const syncAllButton = document.getElementById('syncAllButton');
    if (syncAllButton) {
        syncAllButton.addEventListener('click', syncAllAccounts);
    }
    
    // Atualizar estado dos botões
    updateSyncButtonState();
    
    console.log('Gerenciador de múltiplas contas inicializado');
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMultiAccountManager);
} else {
    initMultiAccountManager();
}

// Exportar funções principais para uso global
window.multiAccountManager = {
    addAccount,
    removeAccount,
    updateAccountStatus,
    getConnectedAccounts: () => window.connectedAccounts.filter(acc => acc.status === 'connected'),
    getAllAccessTokens: () => window.connectedAccounts
        .filter(acc => acc.status === 'connected' && acc.accessToken)
        .map(acc => ({ email: acc.email, accessToken: acc.accessToken }))
};

console.log('multi_account_manager.js carregado');
