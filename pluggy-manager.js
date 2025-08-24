// pluggy-debug.js
// Versão com debug detalhado para identificar o problema

class PluggyManager {
    constructor(config) {
        this.config = config;
        this.accessToken = null;
        this.tokenExpiry = null;
        console.log('🔧 PluggyManager inicializado com config:', config);
    }

    async authenticate() {
        try {
            console.log('🔄 Iniciando autenticação...');
            console.log('📋 Client ID:', this.config.clientId);
            console.log('📋 Client Secret:', this.config.clientSecret ? '***OCULTO***' : 'NÃO DEFINIDO');
            console.log('📋 Base URL:', this.config.baseURL);
            
            const requestBody = {
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret
            };
            
            console.log('📤 Enviando requisição de autenticação...');
            console.log('📤 Body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(`${this.config.baseURL}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Resposta recebida:');
            console.log('📥 Status:', response.status);
            console.log('📥 Status Text:', response.statusText);
            console.log('📥 Headers:', Object.fromEntries(response.headers.entries()));

            const responseText = await response.text();
            console.log('📥 Response Text:', responseText);

            if (!response.ok) {
                console.error('❌ Resposta não OK:', response.status, responseText);
                throw new Error(`Erro de autenticação: ${response.status} - ${responseText}`);
            }

            let data;
            try {
                data = JSON.parse(responseText);
                console.log('📥 Response JSON:', JSON.stringify(data, null, 2));
            } catch (parseError) {
                console.error('❌ Erro ao fazer parse do JSON:', parseError);
                console.error('❌ Response text:', responseText);
                throw new Error('Resposta não é um JSON válido');
            }
            
            if (!data.accessToken) {
                console.error('❌ Token não encontrado na resposta:', data);
                throw new Error('Token de acesso não recebido');
            }

            this.accessToken = data.accessToken;
            this.tokenExpiry = Date.now() + (data.expiresIn * 1000);
            
            console.log('✅ Token recebido:', this.accessToken.substring(0, 20) + '...');
            console.log('✅ Expira em:', new Date(this.tokenExpiry));
            
            // Salvar no localStorage
            localStorage.setItem('pluggy_token', this.accessToken);
            localStorage.setItem('pluggy_token_expiry', this.tokenExpiry.toString());
            
            console.log('✅ Autenticado com sucesso!');
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    // Teste manual de conectividade
    async testConnectivity() {
        try {
            console.log('🧪 Testando conectividade básica...');
            
            const response = await fetch(this.config.baseURL, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('🧪 Teste de conectividade:');
            console.log('🧪 Status:', response.status);
            console.log('🧪 Headers:', Object.fromEntries(response.headers.entries()));
            
            const text = await response.text();
            console.log('🧪 Response:', text);
            
            return response.ok;
        } catch (error) {
            console.error('❌ Erro no teste de conectividade:', error);
            return false;
        }
    }

    // Teste das credenciais
    async testCredentials() {
        console.log('🧪 Testando credenciais...');
        console.log('🧪 Client ID válido?', !!this.config.clientId);
        console.log('🧪 Client Secret válido?', !!this.config.clientSecret);
        console.log('🧪 Base URL válida?', !!this.config.baseURL);
        
        if (!this.config.clientId || !this.config.clientSecret) {
            console.error('❌ Credenciais não configuradas!');
            return false;
        }
        
        return true;
    }

    // Verificar se o token ainda é válido
    isTokenValid() {
        const valid = this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
        console.log('🔍 Token válido?', valid);
        if (this.tokenExpiry) {
            console.log('🔍 Token expira em:', new Date(this.tokenExpiry));
        }
        return valid;
    }

    // Restaurar token do localStorage
    restoreToken() {
        console.log('🔄 Tentando restaurar token...');
        const token = localStorage.getItem('pluggy_token');
        const expiry = localStorage.getItem('pluggy_token_expiry');
        
        console.log('🔍 Token salvo?', !!token);
        console.log('🔍 Expiry salvo?', !!expiry);
        
        if (token && expiry && Date.now() < parseInt(expiry)) {
            this.accessToken = token;
            this.tokenExpiry = parseInt(expiry);
            console.log('✅ Token restaurado do localStorage');
            console.log('✅ Expira em:', new Date(this.tokenExpiry));
            return true;
        }
        
        // Limpar tokens expirados
        localStorage.removeItem('pluggy_token');
        localStorage.removeItem('pluggy_token_expiry');
        console.log('🗑️ Tokens expirados removidos');
        return false;
    }

    // Fazer requisição autenticada
    async makeAuthenticatedRequest(endpoint, options = {}) {
        console.log(`🔄 Fazendo requisição para: ${endpoint}`);
        
        // Verificar se precisa autenticar
        if (!this.isTokenValid()) {
            console.log('🔄 Token inválido, autenticando...');
            await this.authenticate();
        }

        const url = `${this.config.baseURL}${endpoint}`;
        const requestOptions = {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        };

        console.log(`📤 Requisição para: ${url}`);
        console.log(`📤 Headers:`, requestOptions.headers);
        
        const response = await fetch(url, requestOptions);
        
        console.log(`📥 Resposta de ${endpoint}:`);
        console.log(`📥 Status:`, response.status);
        console.log(`📥 Headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro na requisição ${endpoint}:`, response.status, errorText);
            
            // Se token expirou, tentar reautenticar
            if (response.status === 401) {
                console.log('🔄 Token expirado, reautenticando...');
                await this.authenticate();
                // Tentar novamente com novo token
                requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
                const retryResponse = await fetch(url, requestOptions);
                if (!retryResponse.ok) {
                    const retryError = await retryResponse.text();
                    console.error('❌ Erro após reautenticação:', retryResponse.status, retryError);
                    throw new Error(`Erro após reautenticação: ${retryResponse.status} - ${retryError}`);
                }
                const retryData = await retryResponse.json();
                console.log('✅ Sucesso após reautenticação:', retryData);
                return retryData;
            }
            
            throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Dados recebidos de ${endpoint}:`, data);
        return data;
    }

    // Conectores (Bancos)
    async getConnectors() {
        try {
            console.log('🔄 Buscando conectores...');
            const data = await this.makeAuthenticatedRequest('/connectors');
            const connectors = data.results || data;
            console.log(`✅ ${connectors.length} conectores encontrados`);
            return connectors;
        } catch (error) {
            console.error('❌ Erro ao buscar conectores:', error);
            throw error;
        }
    }

    // Utilitários
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }

    // Limpar dados salvos
    clearSavedData() {
        localStorage.removeItem('pluggy_token');
        localStorage.removeItem('pluggy_token_expiry');
        this.accessToken = null;
        this.tokenExpiry = null;
        console.log('🗑️ Dados salvos limpos');
    }

    // Diagnóstico completo
    async runDiagnostics() {
        console.log('🔍 === DIAGNÓSTICO COMPLETO ===');
        
        console.log('1. Testando credenciais...');
        const credentialsOk = await this.testCredentials();
        
        console.log('2. Testando conectividade...');
        const connectivityOk = await this.testConnectivity();
        
        console.log('3. Testando autenticação...');
        try {
            await this.authenticate();
            console.log('✅ Autenticação OK');
        } catch (error) {
            console.error('❌ Autenticação falhou:', error);
        }
        
        console.log('🔍 === FIM DO DIAGNÓSTICO ===');
        
        return {
            credentials: credentialsOk,
            connectivity: connectivityOk,
            authentication: !!this.accessToken
        };
    }
}

// Tornar disponível globalmente
window.PluggyManager = PluggyManager;

// Função de diagnóstico global
window.runPluggyDiagnostics = async function() {
    if (window.pluggyManager) {
        return await window.pluggyManager.runDiagnostics();
    } else {
        console.error('❌ PluggyManager não inicializado');
        return null;
    }
};

console.log('✅ PluggyManager Debug carregado!');

