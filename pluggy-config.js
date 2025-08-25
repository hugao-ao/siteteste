// Configuração do Pluggy para HVC
// Credenciais extraídas do dashboard oficial

const PLUGGY_CONFIG = {
    // Credenciais da aplicação HVC no Pluggy
    clientId: 'a567493e-159e-4ce2-aaaa-c6cf34a76cd1',
    
    // IMPORTANTE: O Client Secret não pode ser extraído automaticamente por segurança
    // Você precisa copiar manualmente do dashboard do Pluggy
    // Acesse: https://dashboard.pluggy.ai/applications
    // Clique no campo "Client Secret" e copie o valor real
    clientSecret: 'SEU_CLIENT_SECRET_AQUI', // SUBSTITUA pelo valor real do dashboard
    
    // URLs da API Pluggy
    baseUrl: 'https://api.pluggy.ai',
    
    // Configurações de requisição
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': '', // Será preenchido dinamicamente
    },
    
    // Configurações de timeout
    timeout: 30000, // 30 segundos
    
    // Configurações de retry
    maxRetries: 3,
    retryDelay: 1000, // 1 segundo
    
    // Configurações de debug
    debug: true,
    
    // Endpoints principais
    endpoints: {
        auth: '/auth',
        connections: '/connections',
        accounts: '/accounts',
        transactions: '/transactions',
        connectors: '/connectors'
    }
};

// Função para validar configuração
function validatePluggyConfig() {
    if (!PLUGGY_CONFIG.clientId) {
        throw new Error('Client ID não configurado');
    }
    
    if (!PLUGGY_CONFIG.clientSecret || PLUGGY_CONFIG.clientSecret === 'SEU_CLIENT_SECRET_AQUI') {
        throw new Error('Client Secret não configurado. Acesse https://dashboard.pluggy.ai/applications e copie o valor real.');
    }
    
    return true;
}

// Exportar configuração
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PLUGGY_CONFIG, validatePluggyConfig };
} else {
    window.PLUGGY_CONFIG = PLUGGY_CONFIG;
    window.validatePluggyConfig = validatePluggyConfig;
}

