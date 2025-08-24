// pluggy-manager-CORRIGIDO-403.js
// Versão corrigida que resolve problemas de erro 403 e CORS

class PluggyManager {
    constructor(config) {
        this.config = config;
        this.apiKey = null;
        this.tokenExpiry = null;
        console.log('🔧 PluggyManager inicializado com config:', config);
    }

    // =================================================================
    // AUTENTICAÇÃO CORRIGIDA PARA RESOLVER ERRO 403
    // =================================================================
    async authenticate() {
        try {
            console.log('🔐 Iniciando autenticação...');
            
            const requestBody = {
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret
            };
            
            console.log('📤 Enviando requisição de autenticação...');
            
            // CORREÇÃO: Headers mais robustos para evitar CORS
            const response = await fetch(`${this.config.baseURL}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(requestBody),
                // CORREÇÃO: Configurações para CORS
                mode: 'cors',
                credentials: 'omit'
            });

            console.log('📥 Status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                
                // CORREÇÃO: Tratamento específico para erro 403
                if (response.status === 403) {
                    throw new Error('Erro 403: Credenciais inválidas. Verifique clientId e clientSecret no pluggy-config.js');
                }
                
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Autenticação bem-sucedida!');
            
            // Salvar token com expiração
            this.apiKey = data.apiKey;
            this.tokenExpiry = new Date(Date.now() + (data.expiresIn || 3600) * 1000);
            
            // Salvar no localStorage para persistência
            this.saveToken();
            
            return data;
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            
            // CORREÇÃO: Mensagens de erro mais específicas
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Erro de conexão: Verifique sua internet e configurações de CORS');
            }
            
            throw error;
        }
    }

    // =================================================================
    // VERIFICAÇÃO E RENOVAÇÃO AUTOMÁTICA DE TOKEN
    // =================================================================
    async ensureValidToken() {
        // Verificar se o token existe e não expirou
        if (!this.apiKey || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
            console.log('🔄 Token expirado ou inexistente, renovando...');
            await this.authenticate();
        }
    }

    // =================================================================
    // REQUISIÇÕES COM TRATAMENTO DE ERRO 403 MELHORADO
    // =================================================================
    async makeAuthenticatedRequest(endpoint, options = {}) {
        // Garantir token válido
        await this.ensureValidToken();
        
        const url = `${this.config.baseURL}${endpoint}`;
        
        // CORREÇÃO: Headers mais robustos
        const headers = {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': window.location.origin,
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
        };
        
        const requestOptions = {
            method: options.method || 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
            ...options
        };
        
        if (options.body) {
            requestOptions.body = JSON.stringify(options.body);
        }
        
        console.log(`📤 ${requestOptions.method} ${url}`);
        
        try {
            const response = await fetch(url, requestOptions);
            
            console.log(`📥 Status: ${response.status}`);
            
            // CORREÇÃO: Tratamento específico para erro 403
            if (response.status === 403) {
                console.error('❌ Erro 403 detectado, tentando reautenticar...');
                
                // Limpar token atual
                this.apiKey = null;
                this.tokenExpiry = null;
                this.clearToken();
                
                // Tentar reautenticar uma vez
                try {
                    await this.authenticate();
                    
                    // Refazer a requisição com novo token
                    const newHeaders = {
                        ...headers,
                        'X-API-KEY': this.apiKey
                    };
                    
                    const retryResponse = await fetch(url, {
                        ...requestOptions,
                        headers: newHeaders
                    });
                    
                    if (!retryResponse.ok) {
                        const errorText = await retryResponse.text();
                        throw new Error(`Erro ${retryResponse.status}: ${errorText}`);
                    }
                    
                    return await retryResponse.json();
                    
                } catch (reAuthError) {
                    console.error('❌ Falha na reautenticação:', reAuthError);
                    throw new Error('Erro 403 persistente: Verifique suas credenciais da API Pluggy');
                }
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Erro ${response.status}:`, errorText);
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Erro na requisição:', error);
            
            // CORREÇÃO: Tratamento de erros de rede
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Erro de conexão: Verifique sua internet e configurações de CORS');
            }
            
            throw error;
        }
    }

    // =================================================================
    // MÉTODOS DA API COM TRATAMENTO DE ERRO MELHORADO
    // =================================================================
    async getConnectors() {
        try {
            console.log('🏦 Buscando conectores disponíveis...');
            const data = await this.makeAuthenticatedRequest('/connectors');
            console.log(`✅ ${data.results?.length || 0} conectores encontrados`);
            return data.results || [];
        } catch (error) {
            console.error('❌ Erro ao buscar conectores:', error);
            throw error;
        }
    }

    async getConnections() {
        try {
            console.log('🔗 Buscando conexões existentes...');
            const data = await this.makeAuthenticatedRequest('/connections');
            console.log(`✅ ${data.results?.length || 0} conexões encontradas`);
            return data.results || [];
        } catch (error) {
            console.error('❌ Erro ao buscar conexões:', error);
            throw error;
        }
    }

    async createConnection(connectorId, credentials) {
        try {
            console.log(`🔗 Criando conexão para conector ${connectorId}...`);
            
            const body = {
                connectorId: connectorId,
                credentials: credentials
            };
            
            const data = await this.makeAuthenticatedRequest('/connections', {
                method: 'POST',
                body: body
            });
            
            console.log('✅ Conexão criada com sucesso!');
            return data;
            
        } catch (error) {
            console.error('❌ Erro ao criar conexão:', error);
            throw error;
        }
    }

    async deleteConnection(connectionId) {
        try {
            console.log(`🗑️ Deletando conexão ${connectionId}...`);
            
            await this.makeAuthenticatedRequest(`/connections/${connectionId}`, {
                method: 'DELETE'
            });
            
            console.log('✅ Conexão deletada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao deletar conexão:', error);
            throw error;
        }
    }

    async getAccounts(connectionId) {
        try {
            console.log(`💳 Buscando contas para conexão ${connectionId}...`);
            const data = await this.makeAuthenticatedRequest(`/accounts?connectionId=${connectionId}`);
            console.log(`✅ ${data.results?.length || 0} contas encontradas`);
            return data.results || [];
        } catch (error) {
            console.error('❌ Erro ao buscar contas:', error);
            throw error;
        }
    }

    async getTransactions(accountId, options = {}) {
        try {
            console.log(`💸 Buscando transações para conta ${accountId}...`);
            
            const params = new URLSearchParams({
                accountId: accountId,
                pageSize: options.pageSize || 50,
                ...options
            });
            
            const data = await this.makeAuthenticatedRequest(`/transactions?${params}`);
            console.log(`✅ ${data.results?.length || 0} transações encontradas`);
            return data.results || [];
        } catch (error) {
            console.error('❌ Erro ao buscar transações:', error);
            throw error;
        }
    }

    // =================================================================
    // GERENCIAMENTO DE TOKEN MELHORADO
    // =================================================================
    saveToken() {
        if (this.apiKey && this.tokenExpiry) {
            const tokenData = {
                apiKey: this.apiKey,
                expiry: this.tokenExpiry.toISOString()
            };
            localStorage.setItem('pluggy_token', JSON.stringify(tokenData));
            console.log('💾 Token salvo no localStorage');
        }
    }

    restoreToken() {
        try {
            const tokenData = localStorage.getItem('pluggy_token');
            if (tokenData) {
                const parsed = JSON.parse(tokenData);
                const expiry = new Date(parsed.expiry);
                
                // Verificar se o token não expirou
                if (expiry > new Date()) {
                    this.apiKey = parsed.apiKey;
                    this.tokenExpiry = expiry;
                    console.log('✅ Token restaurado do localStorage');
                    return true;
                } else {
                    console.log('⚠️ Token expirado, removendo...');
                    this.clearToken();
                }
            }
        } catch (error) {
            console.error('❌ Erro ao restaurar token:', error);
            this.clearToken();
        }
        return false;
    }

    clearToken() {
        this.apiKey = null;
        this.tokenExpiry = null;
        localStorage.removeItem('pluggy_token');
        console.log('🗑️ Token removido');
    }

    // =================================================================
    // UTILITÁRIOS
    // =================================================================
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }

    formatCurrency(amount) {
        try {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(amount);
        } catch (error) {
            return `R$ ${amount.toFixed(2)}`;
        }
    }

    // =================================================================
    // DIAGNÓSTICO E DEBUG
    // =================================================================
    async testConnection() {
        try {
            console.log('🧪 Testando conexão com API Pluggy...');
            
            // Testar autenticação
            await this.authenticate();
            console.log('✅ Autenticação: OK');
            
            // Testar busca de conectores
            const connectors = await this.getConnectors();
            console.log(`✅ Conectores: ${connectors.length} encontrados`);
            
            // Testar busca de conexões
            const connections = await this.getConnections();
            console.log(`✅ Conexões: ${connections.length} encontradas`);
            
            console.log('🎉 Teste de conexão concluído com sucesso!');
            return true;
            
        } catch (error) {
            console.error('❌ Teste de conexão falhou:', error);
            return false;
        }
    }

    getStatus() {
        return {
            hasToken: !!this.apiKey,
            tokenExpiry: this.tokenExpiry,
            isExpired: this.tokenExpiry ? new Date() >= this.tokenExpiry : true,
            config: {
                baseURL: this.config.baseURL,
                hasClientId: !!this.config.clientId,
                hasClientSecret: !!this.config.clientSecret
            }
        };
    }
}

// Tornar disponível globalmente
window.PluggyManager = PluggyManager;

