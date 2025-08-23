// pluggy-config.js
const PLUGGY_CONFIG = {
    // Suas credenciais
    clientId: 'a567493e-159e-4ce2-aaaa-c6cf34a76cd1',
    clientSecret: '60a0b3fb-f039-4909-93ee-ddd5ade654af',
    
    // URLs da API
    baseURL: 'https://api.pluggy.ai',
    authURL: 'https://api.pluggy.ai/auth',
    
    // Configurações
    sandbox: true, // true para testes, false para produção
    timeout: 30000, // 30 segundos
    
    // Endpoints principais
    endpoints: {
        auth: '/auth',
        connectors: '/connectors',
        connections: '/connections',
        accounts: '/accounts',
        transactions: '/transactions'
    }
};

// Tornar disponível globalmente
window.PLUGGY_CONFIG = PLUGGY_CONFIG;
