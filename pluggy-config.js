// pluggy-config-CORRIGIDO.js
// Configuração corrigida para resolver problemas de API

const PLUGGY_CONFIG = {
    // CORREÇÃO: Credenciais atualizadas (substitua pelas suas credenciais válidas)
    clientId: 'seu-client-id-aqui',
    clientSecret: 'seu-client-secret-aqui',
    
    // CORREÇÃO: URLs da API corrigidas
    baseURL: 'https://api.pluggy.ai',
    authURL: 'https://api.pluggy.ai/auth',
    
    // CORREÇÃO: Configurações para resolver CORS
    timeout: 30000, // 30 segundos
    sandbox: true, // true para testes, false para produção
    
    // Endpoints principais
    endpoints: {
        auth: '/auth',
        connectors: '/connectors',
        connections: '/connections',
        accounts: '/accounts',
        transactions: '/transactions'
    }
};

// CORREÇÃO: Validação de configuração
function validatePluggyConfig() {
    const errors = [];
    
    if (!PLUGGY_CONFIG.clientId || PLUGGY_CONFIG.clientId === 'seu-client-id-aqui') {
        errors.push('❌ clientId não configurado');
    }
    
    if (!PLUGGY_CONFIG.clientSecret || PLUGGY_CONFIG.clientSecret === 'seu-client-secret-aqui') {
        errors.push('❌ clientSecret não configurado');
    }
    
    if (!PLUGGY_CONFIG.baseURL) {
        errors.push('❌ baseURL não configurado');
    }
    
    if (errors.length > 0) {
        console.error('🚨 ERROS DE CONFIGURAÇÃO PLUGGY:');
        errors.forEach(error => console.error(error));
        console.error('');
        console.error('📋 COMO CORRIGIR:');
        console.error('1. Acesse https://dashboard.pluggy.ai/');
        console.error('2. Faça login na sua conta');
        console.error('3. Vá em "API Keys" ou "Configurações"');
        console.error('4. Copie seu Client ID e Client Secret');
        console.error('5. Substitua os valores em pluggy-config.js');
        console.error('');
        return false;
    }
    
    console.log('✅ Configuração Pluggy válida');
    return true;
}

// Validar configuração ao carregar
validatePluggyConfig();

// Tornar disponível globalmente
window.PLUGGY_CONFIG = PLUGGY_CONFIG;
window.validatePluggyConfig = validatePluggyConfig;

