/**
 * Módulo Centralizado de Autenticação Google Calendar
 * Mantém a conexão persistente entre páginas usando localStorage
 */

// Configurações do Google Calendar API
const GOOGLE_CONFIG = {
    CLIENT_ID: '314578730498-ghkttnk7g4729g206tk3gsac1qtghhme.apps.googleusercontent.com',
    DISCOVERY_DOCS: [
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
    SCOPES: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
};

// Estado global
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

/**
 * Classe para gerenciar autenticação do Google Calendar
 */
class GoogleCalendarAuth {
    constructor() {
        this.connectedAccounts = [];
        this.loadFromStorage();
    }

    /**
     * Salva contas conectadas no localStorage
     */
    saveToStorage() {
        try {
            const data = {
                accounts: this.connectedAccounts,
                timestamp: Date.now()
            };
            localStorage.setItem('google_calendar_accounts', JSON.stringify(data));
            console.log('✅ Contas salvas no localStorage:', this.connectedAccounts.length);
        } catch (error) {
            console.error('❌ Erro ao salvar contas:', error);
        }
    }

    /**
     * Carrega contas conectadas do localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('google_calendar_accounts');
            if (!stored) {
                console.log('ℹ️ Nenhuma conta salva encontrada');
                return;
            }

            const data = JSON.parse(stored);
            
            // Verificar se não passou muito tempo (7 dias)
            const timeElapsed = Date.now() - data.timestamp;
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
            
            if (timeElapsed > maxAge) {
                console.log('⚠️ Dados expirados, limpando...');
                this.clearStorage();
                return;
            }

            this.connectedAccounts = data.accounts || [];
            console.log('✅ Contas carregadas do localStorage:', this.connectedAccounts.length);
            
            // Restaurar tokens no GAPI se disponível
            if (typeof gapi !== 'undefined' && gapi.client && this.connectedAccounts.length > 0) {
                const firstAccount = this.connectedAccounts[0];
                if (firstAccount.accessToken) {
                    gapi.client.setToken({ access_token: firstAccount.accessToken });
                    console.log('✅ Token restaurado para:', firstAccount.email);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar contas:', error);
            this.clearStorage();
        }
    }

    /**
     * Limpa dados do localStorage
     */
    clearStorage() {
        try {
            localStorage.removeItem('google_calendar_accounts');
            this.connectedAccounts = [];
            console.log('✅ Storage limpo');
        } catch (error) {
            console.error('❌ Erro ao limpar storage:', error);
        }
    }

    /**
     * Adiciona uma nova conta conectada
     */
    async addAccount(accessToken) {
        try {
            // Configurar token temporário para obter informações do usuário
            gapi.client.setToken({ access_token: accessToken });

            // Buscar informações do usuário
            const userInfoResponse = await gapi.client.request({
                path: 'https://www.googleapis.com/oauth2/v2/userinfo',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const userInfo = userInfoResponse.result;
            const email = userInfo.email;

            // Verificar se já existe
            const existingIndex = this.connectedAccounts.findIndex(acc => acc.email === email);
            
            const accountData = {
                email: email,
                name: userInfo.name || email,
                picture: userInfo.picture || '',
                accessToken: accessToken,
                connectedAt: Date.now()
            };

            if (existingIndex >= 0) {
                // Atualizar conta existente
                this.connectedAccounts[existingIndex] = accountData;
                console.log('🔄 Conta atualizada:', email);
            } else {
                // Adicionar nova conta
                this.connectedAccounts.push(accountData);
                console.log('➕ Nova conta adicionada:', email);
            }

            this.saveToStorage();
            return accountData;
        } catch (error) {
            console.error('❌ Erro ao adicionar conta:', error);
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
            this.saveToStorage();
            console.log('➖ Conta removida:', email);
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
    disconnectAll() {
        // Revogar tokens se possível
        this.connectedAccounts.forEach(account => {
            try {
                if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                    google.accounts.oauth2.revoke(account.accessToken);
                }
            } catch (error) {
                console.warn('⚠️ Erro ao revogar token:', error);
            }
        });

        this.clearStorage();
        
        // Limpar token do GAPI
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken(null);
        }

        console.log('✅ Todas as contas desconectadas');
    }
}

// Instância global
const googleAuth = new GoogleCalendarAuth();

/**
 * Inicializa o cliente GAPI
 */
async function initializeGapiClient() {
    try {
        console.log('🔄 Inicializando GAPI Client...');
        
        await gapi.client.init({
            discoveryDocs: GOOGLE_CONFIG.DISCOVERY_DOCS,
        });

        // Verificar se as APIs foram carregadas
        if (gapi.client.calendar) {
            console.log('✅ Google Calendar API carregada');
        }
        if (gapi.client.drive) {
            console.log('✅ Google Drive API carregada');
        }

        gapiInited = true;
        
        // Restaurar contas após GAPI estar pronto
        googleAuth.loadFromStorage();
        
        console.log('✅ GAPI inicializado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar GAPI:', error);
    }
}

/**
 * Inicializa o cliente GIS (Google Identity Services)
 */
function initializeGisClient() {
    try {
        if (typeof google !== 'undefined' && google.accounts) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.CLIENT_ID,
                scope: GOOGLE_CONFIG.SCOPES,
                callback: async (response) => {
                    if (response.error !== undefined) {
                        console.error('❌ Erro na autenticação:', response);
                        throw response;
                    }

                    console.log('✅ Token recebido com sucesso');
                    
                    try {
                        // Adicionar conta
                        const account = await googleAuth.addAccount(response.access_token);
                        
                        // Disparar evento customizado
                        window.dispatchEvent(new CustomEvent('googleAccountConnected', {
                            detail: { account }
                        }));
                        
                        console.log('✅ Conta conectada:', account.email);
                    } catch (error) {
                        console.error('❌ Erro ao processar autenticação:', error);
                    }
                },
            });

            gisInited = true;
            console.log('✅ GIS inicializado com sucesso!');
        } else {
            console.error('❌ Google Identity Services não disponível');
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar GIS:', error);
    }
}

/**
 * Callbacks para carregar APIs
 */
window.gapiLoaded = function() {
    console.log('🔄 GAPI carregado');
    if (typeof gapi !== 'undefined') {
        gapi.load('client', initializeGapiClient);
    }
};

window.gisLoaded = function() {
    console.log('🔄 GIS carregado');
    initializeGisClient();
};

/**
 * Solicita autenticação de uma nova conta
 */
function connectGoogleAccount() {
    if (!gapiInited || !gisInited) {
        console.error('❌ APIs ainda não foram carregadas');
        alert('Aguarde o carregamento das APIs do Google...');
        return;
    }

    try {
        tokenClient.requestAccessToken({ 
            prompt: 'select_account',
            include_granted_scopes: true,
            enable_serial_consent: true
        });
    } catch (error) {
        console.error('❌ Erro ao solicitar autenticação:', error);
        alert('Erro ao conectar conta. Tente novamente.');
    }
}

/**
 * Desconecta uma conta específica
 */
function disconnectGoogleAccount(email) {
    const removed = googleAuth.removeAccount(email);
    if (removed) {
        window.dispatchEvent(new CustomEvent('googleAccountDisconnected', {
            detail: { email }
        }));
        console.log('✅ Conta desconectada:', email);
    }
}

/**
 * Desconecta todas as contas
 */
function disconnectAllGoogleAccounts() {
    googleAuth.disconnectAll();
    window.dispatchEvent(new CustomEvent('googleAccountsCleared'));
    console.log('✅ Todas as contas desconectadas');
}

/**
 * Carrega os scripts do Google
 */
async function loadGoogleScripts() {
    try {
        // Verificar se já estão carregados
        if (typeof gapi !== 'undefined' && typeof google !== 'undefined' && google.accounts) {
            console.log('✅ Scripts Google já carregados');
            return;
        }

        // Carregar GAPI
        if (typeof gapi === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = () => {
                    console.log('✅ GAPI script carregado');
                    if (typeof window.gapiLoaded === 'function') {
                        window.gapiLoaded();
                    }
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        // Carregar GIS
        if (typeof google === 'undefined' || !google.accounts) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.onload = () => {
                    console.log('✅ GIS script carregado');
                    if (typeof window.gisLoaded === 'function') {
                        window.gisLoaded();
                    }
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        console.log('✅ Todos os scripts Google carregados');
    } catch (error) {
        console.error('❌ Erro ao carregar scripts Google:', error);
    }
}

// Inicializar automaticamente ao carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGoogleScripts);
} else {
    loadGoogleScripts();
}

// Exportar para uso global
window.googleAuth = googleAuth;
window.connectGoogleAccount = connectGoogleAccount;
window.disconnectGoogleAccount = disconnectGoogleAccount;
window.disconnectAllGoogleAccounts = disconnectAllGoogleAccounts;
window.loadGoogleScripts = loadGoogleScripts;

// Exportar getters para variáveis de estado (somente leitura)
window.isGapiInited = () => gapiInited;
window.isGisInited = () => gisInited;
window.getTokenClient = () => tokenClient;
