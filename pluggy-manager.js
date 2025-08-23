// pluggy-manager.js
class PluggyManager {
    constructor(config) {
        this.config = config;
        this.accessToken = null;
        this.connections = [];
        this.accounts = [];
        this.isAuthenticated = false;
    }

    // =================================================================
    // AUTENTICAÇÃO
    // =================================================================
    async authenticate() {
        try {
            console.log('🔄 Autenticando com Pluggy...');
            
            const response = await fetch(`${this.config.baseURL}${this.config.endpoints.auth}`, {
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
                throw new Error(`Erro de autenticação: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.accessToken;
            this.isAuthenticated = true;
            
            // Salvar token no localStorage
            localStorage.setItem('pluggy_access_token', this.accessToken);
            localStorage.setItem('pluggy_auth_time', Date.now().toString());
            
            console.log('✅ Autenticado com sucesso!');
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            throw error;
        }
    }

    // Verificar se token ainda é válido
    isTokenValid() {
        const token = localStorage.getItem('pluggy_access_token');
        const authTime = localStorage.getItem('pluggy_auth_time');
        
        if (!token || !authTime) return false;
        
        // Token válido por 1 hora
        const oneHour = 60 * 60 * 1000;
        return (Date.now() - parseInt(authTime)) < oneHour;
    }

    // Restaurar token salvo
    restoreToken() {
        if (this.isTokenValid()) {
            this.accessToken = localStorage.getItem('pluggy_access_token');
            this.isAuthenticated = true;
            return true;
        }
        return false;
    }

    // =================================================================
    // REQUISIÇÕES AUTENTICADAS
    // =================================================================
    async makeAuthenticatedRequest(endpoint, options = {}) {
        if (!this.isAuthenticated) {
            await this.authenticate();
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        const response = await fetch(`${this.config.baseURL}${endpoint}`, mergedOptions);
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expirado, tentar reautenticar
                await this.authenticate();
                return this.makeAuthenticatedRequest(endpoint, options);
            }
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    // =================================================================
    // CONECTORES (BANCOS DISPONÍVEIS)
    // =================================================================
    async getConnectors() {
        try {
            console.log('🔄 Buscando bancos disponíveis...');
            
            const data = await this.makeAuthenticatedRequest(this.config.endpoints.connectors);
            
            console.log(`✅ ${data.results.length} bancos encontrados`);
            return data.results;
            
        } catch (error) {
            console.error('❌ Erro ao buscar conectores:', error);
            throw error;
        }
    }

    // =================================================================
    // CONEXÕES (CONECTAR COM BANCO)
    // =================================================================
    async createConnection(connectorId, credentials) {
        try {
            console.log(`🔄 Conectando com banco ${connectorId}...`);
            
            const data = await this.makeAuthenticatedRequest(this.config.endpoints.connections, {
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

    // Listar conexões existentes
    async getConnections() {
        try {
            const data = await this.makeAuthenticatedRequest(this.config.endpoints.connections);
            this.connections = data.results;
            return this.connections;
        } catch (error) {
            console.error('❌ Erro ao buscar conexões:', error);
            throw error;
        }
    }

    // =================================================================
    // CONTAS BANCÁRIAS
    // =================================================================
    async getAccounts(connectionId = null) {
        try {
            let endpoint = this.config.endpoints.accounts;
            if (connectionId) {
                endpoint += `?connectionId=${connectionId}`;
            }
            
            const data = await this.makeAuthenticatedRequest(endpoint);
            this.accounts = data.results;
            return this.accounts;
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
            const params = new URLSearchParams();
            params.append('accountId', accountId);
            
            // Opções de filtro
            if (options.from) params.append('from', options.from);
            if (options.to) params.append('to', options.to);
            if (options.pageSize) params.append('pageSize', options.pageSize);
            if (options.page) params.append('page', options.page);
            
            const endpoint = `${this.config.endpoints.transactions}?${params.toString()}`;
            const data = await this.makeAuthenticatedRequest(endpoint);
            
            return data.results;
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

    // Desconectar
    async disconnect(connectionId) {
        try {
            await this.makeAuthenticatedRequest(`${this.config.endpoints.connections}/${connectionId}`, {
                method: 'DELETE'
            });
            
            // Remover da lista local
            this.connections = this.connections.filter(conn => conn.id !== connectionId);
            
            console.log('✅ Conexão removida com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao desconectar:', error);
            throw error;
        }
    }
}

// Tornar disponível globalmente
window.PluggyManager = PluggyManager;
