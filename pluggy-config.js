// pluggy-config-CREDENCIAIS-CORRETAS.js
// Configuração corrigida com credenciais válidas e tratamento de erros

const PLUGGY_CONFIG = {
    // ✅ CREDENCIAIS CORRETAS (extraídas do dashboard)
    clientId: 'a567493e-159e-4ce2-aaaa-c6cf34a76cd1',
    clientSecret: '60a0b3fb-f039-4909-93ee-ddd5ade654af',
    
    // ✅ URLs da API corrigidas
    baseURL: 'https://api.pluggy.ai',
    authURL: 'https://api.pluggy.ai/auth',
    
    // ✅ Configurações otimizadas
    timeout: 30000,
    sandbox: false, // MUDANÇA: false para produção
    
    // ✅ Headers corrigidos para resolver CORS
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': 'a567493e-159e-4ce2-aaaa-c6cf34a76cd1'
    },
    
    // Endpoints principais
    endpoints: {
        auth: '/auth',
        connectors: '/connectors',
        connections: '/connections',
        accounts: '/accounts',
        transactions: '/transactions'
    },
    
    // ✅ NOVO: Configuração para ícones dos bancos
    iconConfig: {
        baseURL: 'https://cdn.pluggy.ai/assets/connector-icons/',
        fallbackIcon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzMzNzNkYyIvPgo8cGF0aCBkPSJNMjAgMTBMMjUgMTVIMjBWMjVIMTVWMTVIMjBWMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K'
    }
};

// ✅ NOVO: Função para obter ícone do banco com fallback
function getBankIcon(connectorId) {
    const iconUrl = `${PLUGGY_CONFIG.iconConfig.baseURL}${connectorId}.svg`;
    
    // Verificar se o ícone existe
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(iconUrl);
        img.onerror = () => resolve(PLUGGY_CONFIG.iconConfig.fallbackIcon);
        img.src = iconUrl;
    });
}

// ✅ MELHORADO: Validação de configuração com mais detalhes
function validatePluggyConfig() {
    const errors = [];
    const warnings = [];
    
    // Validações obrigatórias
    if (!PLUGGY_CONFIG.clientId || PLUGGY_CONFIG.clientId === 'seu-client-id-aqui') {
        errors.push('❌ clientId não configurado');
    } else if (PLUGGY_CONFIG.clientId.length < 30) {
        warnings.push('⚠️ clientId parece muito curto');
    }
    
    if (!PLUGGY_CONFIG.clientSecret || PLUGGY_CONFIG.clientSecret === 'seu-client-secret-aqui') {
        errors.push('❌ clientSecret não configurado');
    } else if (PLUGGY_CONFIG.clientSecret.length < 30) {
        warnings.push('⚠️ clientSecret parece muito curto');
    }
    
    if (!PLUGGY_CONFIG.baseURL) {
        errors.push('❌ baseURL não configurado');
    }
    
    // Mostrar resultados
    if (errors.length > 0) {
        console.error('🚨 ERROS CRÍTICOS DE CONFIGURAÇÃO PLUGGY:');
        errors.forEach(error => console.error(error));
        console.error('');
        console.error('📋 COMO CORRIGIR:');
        console.error('1. Acesse https://dashboard.pluggy.ai/');
        console.error('2. Faça login na sua conta');
        console.error('3. Vá em "Applications" ou "API Keys"');
        console.error('4. Copie seu Client ID e Client Secret CORRETOS');
        console.error('5. Substitua os valores em pluggy-config.js');
        console.error('');
        return false;
    }
    
    if (warnings.length > 0) {
        console.warn('⚠️ AVISOS DE CONFIGURAÇÃO:');
        warnings.forEach(warning => console.warn(warning));
        console.warn('');
    }
    
    console.log('✅ Configuração Pluggy válida');
    console.log(`📊 Modo: ${PLUGGY_CONFIG.sandbox ? 'SANDBOX' : 'PRODUÇÃO'}`);
    console.log(`🔗 Base URL: ${PLUGGY_CONFIG.baseURL}`);
    
    return true;
}

// ✅ NOVO: Função para testar conectividade
async function testPluggyConnection() {
    try {
        console.log('🔄 Testando conectividade com API Pluggy...');
        
        const response = await fetch(`${PLUGGY_CONFIG.baseURL}/connectors`, {
            method: 'GET',
            headers: {
                ...PLUGGY_CONFIG.headers,
                'Authorization': `Bearer ${localStorage.getItem('pluggy_access_token') || 'test'}`
            }
        });
        
        if (response.ok) {
            console.log('✅ Conectividade OK');
            return true;
        } else {
            console.error(`❌ Erro de conectividade: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Erro de rede:', error.message);
        return false;
    }
}

// Validar configuração ao carregar
if (validatePluggyConfig()) {
    // Testar conectividade após 1 segundo
    setTimeout(testPluggyConnection, 1000);
}

// Tornar disponível globalmente
window.PLUGGY_CONFIG = PLUGGY_CONFIG;
window.validatePluggyConfig = validatePluggyConfig;
window.testPluggyConnection = testPluggyConnection;
window.getBankIcon = getBankIcon;

// ✅ NOVO: Log de inicialização
console.log('🚀 Pluggy Config carregado com sucesso!');
console.log('📋 Configurações disponíveis:', Object.keys(PLUGGY_CONFIG));

