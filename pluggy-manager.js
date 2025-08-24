// pluggy-manager-corrigido.js
// Versão corrigida que usa "apiKey" em vez de "accessToken"

class PluggyManager {
    constructor(config) {
        this.config = config;
        this.apiKey = null;
        this.tokenExpiry = null;
        console.log('🔧 PluggyManager inicializado com config:', config);
    }

    async authenticate() {
        try {
            console.log('🔄 Iniciando autenticação...');
            
            const requestBody = {
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret
            };
            
            console.log('📤 Enviando requisição de autenticação...');
            
            const response = await fetch(`${this.config.baseURL}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro de autenticação:', response.status, errorText);
                throw new Error(`Erro de autenticação: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('📥 Response completa:', data);
            
            // CORREÇÃO: Usar "apiKey" em vez de "accessToken"
            if (!data.apiKey) {
                console.error('❌ apiKey não encontrado na resposta:', data);
                throw new Error('API Key não recebido');
            }

            this.apiKey = data.apiKey;
            // Definir expiração para 1 hora se não especificado
            this.tokenExpiry = Date.now() + (60 * 60 * 1000);
            
            console.log('✅ API Key recebido:', this.apiKey.substring(0, 20) + '...');
            
            // Salvar no localStorage
            localStorage.setItem('pluggy_api_key', this.apiKey);
            localStorage.setItem('pluggy_token_expiry', this.tokenExpiry.toString());
            
            console.log('✅ Autenticado com sucesso!');
            return this.apiKey;
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            throw error;
        }
    }

    // Verificar se o token ainda é válido
    isTokenValid() {
        const valid = this.apiKey && this.tokenExpiry && Date.now() < this.tokenExpiry;
        console.log('🔍 API Key válido?', valid);
        return valid;
    }

    // Restaurar token do localStorage
    restoreToken() {
        console.log('🔄 Tentando restaurar API Key...');
        const apiKey = localStorage.getItem('pluggy_api_key');
        const expiry = localStorage.getItem('pluggy_token_expiry');
        
        if (apiKey && expiry && Date.now() < parseInt(expiry)) {
            this.apiKey = apiKey;
            this.tokenExpiry = parseInt(expiry);
            console.log('✅ API Key restaurado do localStorage');
            return true;
        }
        
        // Limpar tokens expirados
        localStorage.removeItem('pluggy_api_key');
        localStorage.removeItem('pluggy_token_expiry');
        console.log('🗑️ API Key expirado removido');
        return false;
    }

    // Fazer requisição autenticada
    async makeAuthenticatedRequest(endpoint, options = {}) {
        console.log(`🔄 Fazendo requisição para: ${endpoint}`);
        
        // Verificar se precisa autenticar
        if (!this.isTokenValid()) {
            console.log('🔄 API Key inválido, autenticando...');
            await this.authenticate();
        }

        const url = `${this.config.baseURL}${endpoint}`;
        const requestOptions = {
            headers: {
                'X-API-KEY': this.apiKey, // CORREÇÃO: Usar X-API-KEY em vez de Authorization
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
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro na requisição ${endpoint}:`, response.status, errorText);
            
            // Se API Key expirou, tentar reautenticar
            if (response.status === 401 || response.status === 403) {
                console.log('🔄 API Key expirado, reautenticando...');
                await this.authenticate();
                // Tentar novamente com novo API Key
                requestOptions.headers['X-API-KEY'] = this.apiKey;
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

    // Criar conexão com banco
    async createConnection(connectorId, credentials) {
        try {
            console.log('🔄 Criando conexão...', { connectorId, credentials });
            
            const requestBody = {
                connectorId: connectorId,
                credentials: credentials
            };
            
            const data = await this.makeAuthenticatedRequest('/connections', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
            
            console.log('✅ Conexão criada:', data);
            return data;
        } catch (error) {
            console.error('❌ Erro ao criar conexão:', error);
            throw error;
        }
    }

    // Listar conexões
    async getConnections() {
        try {
            console.log('🔄 Buscando conexões...');
            const data = await this.makeAuthenticatedRequest('/connections');
            const connections = data.results || data;
            console.log(`✅ ${connections.length} conexões encontradas`);
            return connections;
        } catch (error) {
            console.error('❌ Erro ao buscar conexões:', error);
            throw error;
        }
    }

    // Buscar contas de uma conexão
    async getAccounts(connectionId) {
        try {
            console.log('🔄 Buscando contas...', connectionId);
            const data = await this.makeAuthenticatedRequest(`/accounts?connectionId=${connectionId}`);
            const accounts = data.results || data;
            console.log(`✅ ${accounts.length} contas encontradas`);
            return accounts;
        } catch (error) {
            console.error('❌ Erro ao buscar contas:', error);
            throw error;
        }
    }

    // Buscar transações de uma conta
    async getTransactions(accountId, from = null, to = null) {
        try {
            console.log('🔄 Buscando transações...', accountId);
            
            let endpoint = `/transactions?accountId=${accountId}`;
            if (from) endpoint += `&from=${from}`;
            if (to) endpoint += `&to=${to}`;
            
            const data = await this.makeAuthenticatedRequest(endpoint);
            const transactions = data.results || data;
            console.log(`✅ ${transactions.length} transações encontradas`);
            return transactions;
        } catch (error) {
            console.error('❌ Erro ao buscar transações:', error);
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
        localStorage.removeItem('pluggy_api_key');
        localStorage.removeItem('pluggy_token_expiry');
        this.apiKey = null;
        this.tokenExpiry = null;
        console.log('🗑️ Dados salvos limpos');
    }

    // Diagnóstico completo
    async runDiagnostics() {
        console.log('🔍 === DIAGNÓSTICO COMPLETO ===');
        
        try {
            console.log('1. Testando autenticação...');
            await this.authenticate();
            console.log('✅ Autenticação OK');
            
            console.log('2. Testando conectores...');
            const connectors = await this.getConnectors();
            console.log(`✅ ${connectors.length} conectores encontrados`);
            
            console.log('3. Testando conexões...');
            const connections = await this.getConnections();
            console.log(`✅ ${connections.length} conexões encontradas`);
            
            console.log('🔍 === DIAGNÓSTICO CONCLUÍDO COM SUCESSO ===');
            
            return {
                authentication: true,
                connectors: connectors.length,
                connections: connections.length
            };
        } catch (error) {
            console.error('❌ Erro no diagnóstico:', error);
            return {
                authentication: false,
                error: error.message
            };
        }
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

console.log('✅ PluggyManager Corrigido carregado!');

