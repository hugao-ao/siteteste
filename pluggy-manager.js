// pluggy-manager-ERRO-403-CORRIGIDO.js
// PluggyManager corrigido para resolver problemas de erro 403 e autenticação

class PluggyManager {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.isAuthenticating = false;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 segundo
        
        // ✅ NOVO: Cache de dados para evitar requisições desnecessárias
        this.cache = {
            connectors: null,
            connections: null,
            lastUpdate: null
        };
        
        console.log('🚀 PluggyManager inicializado');
        this.loadStoredToken();
    }

    // ✅ MELHORADO: Carregar token armazenado com validação
    loadStoredToken() {
        try {
            const storedToken = localStorage.getItem('pluggy_access_token');
            const storedExpiry = localStorage.getItem('pluggy_token_expiry');
            
            if (storedToken && storedExpiry) {
                const expiryTime = new Date(storedExpiry);
                const now = new Date();
                
                // Verificar se o token ainda é válido (com margem de 5 minutos)
                if (expiryTime > new Date(now.getTime() + 5 * 60 * 1000)) {
                    this.accessToken = storedToken;
                    this.tokenExpiry = expiryTime;
                    console.log('✅ Token salvo carregado e válido');
                    return true;
                } else {
                    console.log('⚠️ Token salvo expirado, removendo...');
                    this.clearStoredToken();
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar token:', error);
            this.clearStoredToken();
        }
        return false;
    }

    // ✅ NOVO: Limpar token armazenado
    clearStoredToken() {
        localStorage.removeItem('pluggy_access_token');
        localStorage.removeItem('pluggy_token_expiry');
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // ✅ MELHORADO: Autenticação com retry e melhor tratamento de erro
    async authenticate(retryCount = 0) {
        if (this.isAuthenticating) {
            console.log('⏳ Autenticação já em andamento...');
            return this.waitForAuthentication();
        }

        this.isAuthenticating = true;

        try {
            console.log(`🔐 Iniciando autenticação (tentativa ${retryCount + 1}/${this.maxRetries})...`);
            
            // ✅ CORREÇÃO: Headers corretos para autenticação
            const authData = {
                clientId: PLUGGY_CONFIG.clientId,
                clientSecret: PLUGGY_CONFIG.clientSecret
            };

            const response = await fetch(`${PLUGGY_CONFIG.baseURL}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'HVC-FluxoCaixa/1.0'
                },
                body: JSON.stringify(authData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Erro ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    // Manter mensagem padrão se não conseguir parsear JSON
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            
            if (!data.accessToken) {
                throw new Error('Token de acesso não recebido na resposta');
            }

            // ✅ MELHORADO: Salvar token com tempo de expiração
            this.accessToken = data.accessToken;
            
            // Calcular tempo de expiração (padrão 1 hora se não especificado)
            const expiresIn = data.expiresIn || 3600; // segundos
            this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000));
            
            // Salvar no localStorage
            localStorage.setItem('pluggy_access_token', this.accessToken);
            localStorage.setItem('pluggy_token_expiry', this.tokenExpiry.toISOString());
            
            console.log('✅ Autenticação bem-sucedida!');
            console.log(`⏰ Token expira em: ${this.tokenExpiry.toLocaleString()}`);
            
            this.isAuthenticating = false;
            return this.accessToken;

        } catch (error) {
            console.error(`❌ Erro na autenticação (tentativa ${retryCount + 1}):`, error.message);
            
            this.isAuthenticating = false;
            
            // ✅ NOVO: Retry automático em caso de erro
            if (retryCount < this.maxRetries - 1) {
                console.log(`🔄 Tentando novamente em ${this.retryDelay}ms...`);
                await this.delay(this.retryDelay);
                return this.authenticate(retryCount + 1);
            }
            
            // Limpar token inválido
            this.clearStoredToken();
            throw new Error(`Falha na autenticação após ${this.maxRetries} tentativas: ${error.message}`);
        }
    }

    // ✅ NOVO: Aguardar autenticação em andamento
    async waitForAuthentication() {
        while (this.isAuthenticating) {
            await this.delay(100);
        }
        return this.accessToken;
    }

    // ✅ NOVO: Função de delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ✅ MELHORADO: Verificar se token é válido
    isTokenValid() {
        if (!this.accessToken || !this.tokenExpiry) {
            return false;
        }
        
        // Verificar se o token expira nos próximos 5 minutos
        const now = new Date();
        const expiryWithBuffer = new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000);
        
        return now < expiryWithBuffer;
    }

    // ✅ MELHORADO: Fazer requisição autenticada com retry
    async makeAuthenticatedRequest(endpoint, options = {}, retryCount = 0) {
        try {
            // Verificar se precisa autenticar
            if (!this.isTokenValid()) {
                console.log('🔄 Token inválido, reautenticando...');
                await this.authenticate();
            }

            const url = `${PLUGGY_CONFIG.baseURL}${endpoint}`;
            const requestOptions = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`,
                    'User-Agent': 'HVC-FluxoCaixa/1.0',
                    ...options.headers
                }
            };

            console.log(`📡 Fazendo requisição: ${options.method || 'GET'} ${url}`);
            
            const response = await fetch(url, requestOptions);

            // ✅ CORREÇÃO: Tratamento específico para erro 403
            if (response.status === 403) {
                console.warn('⚠️ Erro 403 detectado, token pode estar inválido');
                
                if (retryCount < this.maxRetries - 1) {
                    console.log('🔄 Limpando token e tentando reautenticar...');
                    this.clearStoredToken();
                    await this.authenticate();
                    return this.makeAuthenticatedRequest(endpoint, options, retryCount + 1);
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Erro ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                } catch (e) {
                    // Manter mensagem padrão
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log(`✅ Requisição bem-sucedida: ${endpoint}`);
            
            return data;

        } catch (error) {
            console.error(`❌ Erro na requisição ${endpoint}:`, error.message);
            
            // Retry para erros de rede
            if (retryCount < this.maxRetries - 1 && (error.name === 'TypeError' || error.message.includes('fetch'))) {
                console.log(`🔄 Tentando novamente em ${this.retryDelay}ms...`);
                await this.delay(this.retryDelay);
                return this.makeAuthenticatedRequest(endpoint, options, retryCount + 1);
            }
            
            throw error;
        }
    }

    // ✅ MELHORADO: Obter conectores com cache
    async getConnectors() {
        try {
            // Verificar cache (válido por 1 hora)
            if (this.cache.connectors && this.cache.lastUpdate) {
                const cacheAge = Date.now() - this.cache.lastUpdate;
                if (cacheAge < 60 * 60 * 1000) { // 1 hora
                    console.log('📋 Usando conectores do cache');
                    return this.cache.connectors;
                }
            }

            console.log('🔄 Buscando conectores da API...');
            const connectors = await this.makeAuthenticatedRequest('/connectors');
            
            // Atualizar cache
            this.cache.connectors = connectors;
            this.cache.lastUpdate = Date.now();
            
            console.log(`✅ ${connectors.results?.length || connectors.length || 0} conectores carregados`);
            return connectors;
            
        } catch (error) {
            console.error('❌ Erro ao carregar conectores:', error.message);
            
            // Retornar cache se disponível
            if (this.cache.connectors) {
                console.log('📋 Retornando conectores do cache devido ao erro');
                return this.cache.connectors;
            }
            
            throw error;
        }
    }

    // ✅ MELHORADO: Obter conexões
    async getConnections() {
        try {
            console.log('🔄 Buscando conexões...');
            const connections = await this.makeAuthenticatedRequest('/connections');
            
            console.log(`✅ ${connections.results?.length || connections.length || 0} conexões carregadas`);
            return connections;
            
        } catch (error) {
            console.error('❌ Erro ao carregar conexões:', error.message);
            throw error;
        }
    }

    // ✅ MELHORADO: Criar conexão
    async createConnection(connectorId, credentials) {
        try {
            console.log(`🔄 Criando conexão para conector ${connectorId}...`);
            
            const connectionData = {
                connectorId: connectorId,
                credentials: credentials
            };

            const connection = await this.makeAuthenticatedRequest('/connections', {
                method: 'POST',
                body: JSON.stringify(connectionData)
            });

            console.log('✅ Conexão criada com sucesso!');
            
            // Limpar cache de conexões
            this.cache.connections = null;
            
            return connection;
            
        } catch (error) {
            console.error('❌ Erro ao criar conexão:', error.message);
            throw error;
        }
    }

    // ✅ NOVO: Obter status da API
    async getApiStatus() {
        try {
            const response = await fetch(`${PLUGGY_CONFIG.baseURL}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            return {
                status: response.ok ? 'online' : 'offline',
                statusCode: response.status
            };
        } catch (error) {
            return {
                status: 'offline',
                error: error.message
            };
        }
    }

    // ✅ NOVO: Diagnóstico completo
    async runDiagnostics() {
        console.log('🔍 Executando diagnóstico do Pluggy...');
        
        const diagnostics = {
            config: validatePluggyConfig(),
            apiStatus: await this.getApiStatus(),
            tokenValid: this.isTokenValid(),
            timestamp: new Date().toISOString()
        };
        
        console.log('📊 Resultado do diagnóstico:', diagnostics);
        return diagnostics;
    }
}

// ✅ NOVO: Instância global
window.pluggyManager = new PluggyManager();

console.log('🚀 PluggyManager carregado e pronto para uso!');

