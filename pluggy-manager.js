// pluggy-manager-simplificado.js
// Versão baseada na demo oficial do Pluggy

class PluggyManager {
    constructor(config) {
        this.config = config;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // =================================================================
    // AUTENTICAÇÃO
    // =================================================================
    async authenticate() {
        try {
            console.log('🔄 Autenticando com Pluggy...');
            
            const response = await fetch(`${this.config.baseURL}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    clientId: this.config.clientId,
                    clientSecret: this.config.clientSecret
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na autenticação:', response.status, errorText);
                throw new Error(`Erro de autenticação: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (!data.accessToken) {
                throw new Error('Token de acesso não recebido');
            }

            this.accessToken = data.accessToken;
            this.tokenExpiry = Date.now() + (data.expiresIn * 1000);
            
            // Salvar no localStorage
            localStorage.setItem('pluggy_token', this.accessToken);
            localStorage.setItem('pluggy_token_expiry', this.tokenExpiry.toString());
            
            console.log('✅ Autenticado com sucesso!');
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            throw error;
        }
    }

    // Verificar se o token ainda é válido
    isTokenValid() {
        return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }

    // Restaurar token do localStorage
    restoreToken() {
        const token = localStorage.getItem('pluggy_token');
        const expiry = localStorage.getItem('pluggy_token_expiry');
        
        if (token && expiry && Date.now() < parseInt(expiry)) {
            this.accessToken = token;
            this.tokenExpiry = parseInt(expiry);
            console.log('✅ Token restaurado do localStorage');
            return true;
        }
        
        // Limpar tokens expirados
        localStorage.removeItem('pluggy_token');
        localStorage.removeItem('pluggy_token_expiry');
        return false;
    }

    // Fazer requisição autenticada
    async makeAuthenticatedRequest(endpoint, options = {}) {
        // Verificar se precisa autenticar
        if (!this.isTokenValid()) {
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

        console.log(`🔄 Fazendo requisição para: ${url}`);
        
        const response = await fetch(url, requestOptions);
        
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
                    throw new Error(`Erro após reautenticação: ${retryResponse.status}`);
                }
                return await retryResponse.json();
            }
            
            throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        return await response.json();
    }

    // =================================================================
    // CONECTORES (BANCOS)
    // =================================================================
    async getConnectors() {
        try {
            console.log('🔄 Buscando conectores...');
            const data = await this.makeAuthenticatedRequest('/connectors');
            console.log(`✅ ${data.results?.length || data.length || 0} conectores encontrados`);
            return data.results || data;
        } catch (error) {
            console.error('❌ Erro ao buscar conectores:', error);
            throw error;
        }
    }

    // =================================================================
    // CONEXÕES
    // =================================================================
    async getConnections() {
        try {
            console.log('🔄 Buscando conexões...');
            const data = await this.makeAuthenticatedRequest('/connections');
            console.log(`✅ ${data.results?.length || data.length || 0} conexões encontradas`);
            return data.results || data;
        } catch (error) {
            console.error('❌ Erro ao buscar conexões:', error);
            throw error;
        }
    }

    async createConnection(connectorId, credentials) {
        try {
            console.log(`🔄 Criando conexão para conector ${connectorId}...`);
            
            const data = await this.makeAuthenticatedRequest('/connections', {
                method: 'POST',
                body: JSON.stringify({
                    connectorId: connectorId,
                    credentials: credentials
                })
            });
            
            console.log('✅ Conexão criada com sucesso!');
            return data;
        } catch (error) {
            console.error('❌ Erro ao criar conexão:', error);
            throw error;
        }
    }

    async disconnect(connectionId) {
        try {
            console.log(`🔄 Desconectando ${connectionId}...`);
            
            await this.makeAuthenticatedRequest(`/connections/${connectionId}`, {
                method: 'DELETE'
            });
            
            console.log('✅ Desconectado com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao desconectar:', error);
            throw error;
        }
    }

    // =================================================================
    // CONTAS
    // =================================================================
    async getAccounts(connectionId) {
        try {
            console.log(`🔄 Buscando contas para conexão ${connectionId}...`);
            const data = await this.makeAuthenticatedRequest(`/accounts?connectionId=${connectionId}`);
            console.log(`✅ ${data.results?.length || data.length || 0} contas encontradas`);
            return data.results || data;
        } catch (error) {
            console.error('❌ Erro ao buscar contas:', error);
            throw error;
        }
    }

    // =================================================================
    // TRANSAÇÕES
    // =================================================================
    async getTransactions(accountId, options = {}) {
        try {
            console.log(`🔄 Buscando transações para conta ${accountId}...`);
            
            const params = new URLSearchParams({
                accountId: accountId,
                ...options
            });
            
            const data = await this.makeAuthenticatedRequest(`/transactions?${params}`);
            console.log(`✅ ${data.results?.length || data.length || 0} transações encontradas`);
            return data.results || data;
        } catch (error) {
            console.error('❌ Erro ao buscar transações:', error);
            throw error;
        }
    }

    // =================================================================
    // UTILITÁRIOS
    // =================================================================
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
    }
}

// Tornar disponível globalmente
window.PluggyManager = PluggyManager;
console.log('✅ PluggyManager Simplificado carregado!');

