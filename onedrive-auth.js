/**
 * Módulo Centralizado de Autenticação OneDrive
 * Mantém a conexão persistente entre páginas usando localStorage
 * 
 * ========================================
 * VERSÃO FINAL - 15/12/2024 12:00
 * - Integrity REMOVIDO
 * - MSAL carrega sem erros
 * - Client Secret REMOVIDO (usa PKCE)
 * - Configurado para SPA (Single Page Application)
 * - offline_access scope adicionado
 * ========================================
 */

// Configurações do Microsoft OneDrive
const ONEDRIVE_CONFIG = {
    CLIENT_ID: '0d73f929-0839-4435-bb68-9a29a2143473',
    REDIRECT_URI: 'https://app.hvsaudefinanceira.com.br',
    AUTHORITY: 'https://login.microsoftonline.com/common',
    SCOPES: [
        'User.Read',
        'Files.Read',
        'Files.Read.All',
        'Files.ReadWrite',
        'Files.ReadWrite.All',
        'offline_access'
    ]
};

// Estado global
let msalInstance = null;
let isInitialized = false;

/**
 * Classe para gerenciar autenticação do OneDrive
 */
class OneDriveAuth {
    constructor() {
        this.connectedAccounts = [];
        this.currentAccount = null;
        this.loadFromStorage();
    }

    /**
     * Salva contas conectadas no localStorage
     */
    saveToStorage() {
        try {
            const data = {
                accounts: this.connectedAccounts,
                currentAccount: this.currentAccount,
                timestamp: Date.now()
            };
            localStorage.setItem('onedrive_accounts', JSON.stringify(data));
            console.log('✅ Contas OneDrive salvas:', this.connectedAccounts.length);
        } catch (error) {
            console.error('❌ Erro ao salvar contas OneDrive:', error);
        }
    }

    /**
     * Carrega contas conectadas do localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('onedrive_accounts');
            if (!stored) {
                console.log('ℹ️ Nenhuma conta OneDrive salva');
                return;
            }

            const data = JSON.parse(stored);
            
            // Verificar se não passou muito tempo (7 dias)
            const timeElapsed = Date.now() - data.timestamp;
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
            
            if (timeElapsed > maxAge) {
                console.log('⚠️ Dados OneDrive expirados, limpando...');
                this.clearStorage();
                return;
            }

            this.connectedAccounts = data.accounts || [];
            this.currentAccount = data.currentAccount || null;
            console.log('✅ Contas OneDrive carregadas:', this.connectedAccounts.length);
        } catch (error) {
            console.error('❌ Erro ao carregar contas OneDrive:', error);
            this.clearStorage();
        }
    }

    /**
     * Limpa dados do localStorage
     */
    clearStorage() {
        try {
            localStorage.removeItem('onedrive_accounts');
            this.connectedAccounts = [];
            this.currentAccount = null;
            console.log('✅ Storage OneDrive limpo');
        } catch (error) {
            console.error('❌ Erro ao limpar storage OneDrive:', error);
        }
    }

    /**
     * Adiciona uma nova conta conectada
     */
    async addAccount(account, accessToken) {
        try {
            const email = account.username;

            // Verificar se já existe
            const existingIndex = this.connectedAccounts.findIndex(acc => acc.email === email);
            
            const accountData = {
                email: email,
                name: account.name || email,
                accountId: account.homeAccountId,
                accessToken: accessToken,
                connectedAt: Date.now()
            };

            if (existingIndex >= 0) {
                // Atualizar conta existente
                this.connectedAccounts[existingIndex] = accountData;
                console.log('🔄 Conta OneDrive atualizada:', email);
            } else {
                // Adicionar nova conta
                this.connectedAccounts.push(accountData);
                console.log('➕ Nova conta OneDrive adicionada:', email);
            }

            // Definir como conta atual
            this.currentAccount = accountData;
            this.saveToStorage();
            return accountData;
        } catch (error) {
            console.error('❌ Erro ao adicionar conta OneDrive:', error);
            throw error;
        }
    }

    /**
     * Remove uma conta conectada
     */
    removeAccount(email) {
        const index = this.connectedAccounts.findIndex(acc => acc.email === email);
        if (index >= 0) {
            this.connectedAccounts.splice(index, 1);
            
            // Se era a conta atual, limpar
            if (this.currentAccount && this.currentAccount.email === email) {
                this.currentAccount = this.connectedAccounts[0] || null;
            }
            
            this.saveToStorage();
            console.log('➖ Conta OneDrive removida:', email);
            return true;
        }
        return false;
    }

    /**
     * Obtém todas as contas conectadas
     */
    getAccounts() {
        return this.connectedAccounts;
    }

    /**
     * Obtém a conta atual
     */
    getCurrentAccount() {
        return this.currentAccount;
    }

    /**
     * Define a conta atual
     */
    setCurrentAccount(email) {
        const account = this.connectedAccounts.find(acc => acc.email === email);
        if (account) {
            this.currentAccount = account;
            this.saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * Obtém uma conta específica por email
     */
    getAccount(email) {
        return this.connectedAccounts.find(acc => acc.email === email);
    }

    /**
     * Verifica se há contas conectadas
     */
    isConnected() {
        return this.connectedAccounts.length > 0;
    }

    /**
     * Desconecta todas as contas
     */
    async disconnectAll() {
        // Remover contas do MSAL
        if (msalInstance) {
            const accounts = msalInstance.getAllAccounts();
            for (const account of accounts) {
                try {
                    await msalInstance.logout({ account });
                } catch (error) {
                    console.warn('⚠️ Erro ao fazer logout:', error);
                }
            }
        }

        this.clearStorage();
        console.log('✅ Todas as contas OneDrive desconectadas');
    }

    /**
     * Obtém access token válido
     */
    async getAccessToken() {
        if (!this.currentAccount) {
            throw new Error('Nenhuma conta OneDrive conectada');
        }

        try {
            // Tentar obter token silenciosamente
            const account = msalInstance.getAllAccounts().find(
                acc => acc.username === this.currentAccount.email
            );

            if (!account) {
                throw new Error('Conta não encontrada no MSAL');
            }

            const response = await msalInstance.acquireTokenSilent({
                scopes: ONEDRIVE_CONFIG.SCOPES,
                account: account
            });

            // Atualizar token armazenado
            this.currentAccount.accessToken = response.accessToken;
            this.saveToStorage();

            return response.accessToken;
        } catch (error) {
            console.error('❌ Erro ao obter token:', error);
            
            // Se falhar, solicitar novo login
            if (error.name === 'InteractionRequiredAuthError') {
                throw new Error('É necessário fazer login novamente');
            }
            
            throw error;
        }
    }
}

// Instância global
const oneDriveAuth = new OneDriveAuth();

/**
 * Inicializa o cliente MSAL (Microsoft Authentication Library)
 */
async function initializeMSAL() {
    try {
        if (isInitialized) {
            console.log('✅ MSAL já inicializado');
            return;
        }

        console.log('🔄 Inicializando MSAL...');

        // Verificar se a biblioteca MSAL está carregada
        if (typeof msal === 'undefined') {
            throw new Error('Biblioteca MSAL não carregada');
        }

        // Configuração do MSAL
        const msalConfig = {
            auth: {
                clientId: ONEDRIVE_CONFIG.CLIENT_ID,
                authority: ONEDRIVE_CONFIG.AUTHORITY,
                redirectUri: ONEDRIVE_CONFIG.REDIRECT_URI,
            },
            cache: {
                cacheLocation: 'localStorage',
                storeAuthStateInCookie: false,
            }
        };

        // Criar instância do MSAL
        msalInstance = new msal.PublicClientApplication(msalConfig);
        
        // Inicializar
        await msalInstance.initialize();

        // Verificar se há redirect após login
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
            console.log('✅ Login via redirect bem-sucedido');
            await handleLoginSuccess(response);
        }

        isInitialized = true;
        
        // Exportar msalInstance globalmente
        window.msalInstance = msalInstance;
        
        console.log('✅ MSAL inicializado com sucesso!');
        
        // Restaurar contas
        oneDriveAuth.loadFromStorage();
    } catch (error) {
        console.error('❌ Erro ao inicializar MSAL:', error);
        throw error;
    }
}

/**
 * Processa sucesso do login
 */
async function handleLoginSuccess(response) {
    try {
        const account = response.account;
        const accessToken = response.accessToken;

        // Adicionar conta
        const accountData = await oneDriveAuth.addAccount(account, accessToken);
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('oneDriveAccountConnected', {
            detail: { account: accountData }
        }));
        
        console.log('✅ Conta OneDrive conectada:', accountData.email);
        
        return accountData;
    } catch (error) {
        console.error('❌ Erro ao processar login:', error);
        throw error;
    }
}

/**
 * Solicita autenticação de uma nova conta (Popup)
 */
async function connectOneDriveAccount() {
    if (!isInitialized) {
        console.error('❌ MSAL ainda não foi inicializado');
        alert('Aguarde a inicialização do OneDrive...');
        return;
    }

    try {
        console.log('🔄 Iniciando login OneDrive...');

        const loginRequest = {
            scopes: ONEDRIVE_CONFIG.SCOPES,
            prompt: 'select_account'
        };

        // Usar popup para login
        const response = await msalInstance.loginPopup(loginRequest);
        
        // Processar sucesso
        await handleLoginSuccess(response);
        
        alert('✅ Conectado ao OneDrive com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao conectar OneDrive:', error);
        
        if (error.errorCode === 'popup_window_error') {
            alert('❌ Erro ao abrir popup. Verifique se popups estão bloqueados.');
        } else {
            alert('❌ Erro ao conectar ao OneDrive. Tente novamente.');
        }
    }
}

/**
 * Desconecta uma conta específica
 */
async function disconnectOneDriveAccount(email) {
    try {
        // Remover do MSAL (SEM redirecionar)
        if (msalInstance) {
            const account = msalInstance.getAllAccounts().find(acc => acc.username === email);
            if (account) {
                // Usar logoutRedirect com postLogoutRedirectUri para a mesma página
                await msalInstance.logoutRedirect({
                    account: account,
                    postLogoutRedirectUri: window.location.origin + '/onedrive-browser.html'
                });
                // NÃO continua após logoutRedirect (redireciona)
                return;
            }
        }

        // Remover da classe (apenas se não houver MSAL)
        const removed = oneDriveAuth.removeAccount(email);
        
        if (removed) {
            window.dispatchEvent(new CustomEvent('oneDriveAccountDisconnected', {
                detail: { email }
            }));
            console.log('✅ Conta OneDrive desconectada:', email);
            
            // Recarregar página para atualizar UI
            window.location.reload();
        }
    } catch (error) {
        console.error('❌ Erro ao desconectar conta OneDrive:', error);
        // Em caso de erro, apenas remover localmente
        oneDriveAuth.removeAccount(email);
        window.location.reload();
    }
}

/**
 * Desconecta todas as contas
 */
async function disconnectAllOneDriveAccounts() {
    await oneDriveAuth.disconnectAll();
    window.dispatchEvent(new CustomEvent('oneDriveAccountsCleared'));
    console.log('✅ Todas as contas OneDrive desconectadas');
}

/**
 * Carrega a biblioteca MSAL
 */
async function loadMSALScript() {
    try {
        // Verificar se já está carregado
        if (typeof msal !== 'undefined') {
            console.log('✅ MSAL já carregado');
            await initializeMSAL();
            return;
        }

        console.log('🔄 Carregando biblioteca MSAL...');

        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://alcdn.msauth.net/browser/2.38.1/js/msal-browser.min.js';
            script.crossOrigin = 'anonymous';
            script.onload = async () => {
                console.log('✅ MSAL script carregado');
                await initializeMSAL();
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        console.log('✅ MSAL carregado e inicializado');
    } catch (error) {
        console.error('❌ Erro ao carregar MSAL:', error);
    }
}

// Inicializar automaticamente ao carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMSALScript);
} else {
    loadMSALScript();
}

// Exportar para uso global
window.oneDriveAuth = oneDriveAuth;
window.connectOneDriveAccount = connectOneDriveAccount;
window.disconnectOneDriveAccount = disconnectOneDriveAccount;
window.disconnectAllOneDriveAccounts = disconnectAllOneDriveAccounts;
window.loadMSALScript = loadMSALScript;

// Exportar getters para variáveis de estado (somente leitura)
window.isMSALInitialized = () => isInitialized;
window.getMSALInstance = () => msalInstance;
