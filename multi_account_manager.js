// ===================================================================
// SISTEMA SIMPLIFICADO DE MÚLTIPLAS CONTAS GOOGLE
// Versão com troca de contas em vez de múltiplas simultâneas
// ===================================================================

// ===================================================================
// VERIFICAÇÃO DE DEPENDÊNCIAS
// ===================================================================

// Verificar se todas as dependências estão carregadas
function checkDependencies() {
    const dependencies = [
        { name: 'gapi', obj: window.gapi },
        { name: 'google', obj: window.google }
    ];
    
    const missing = dependencies.filter(dep => typeof dep.obj === 'undefined');
    
    if (missing.length > 0) {
        console.warn('⚠️ Dependências não carregadas:', missing.map(d => d.name));
        return false;
    }
    
    return true;
}

// Aguardar dependências antes de definir onAuthSuccess
function waitForDependencies(callback, maxAttempts = 10) {
    let attempts = 0;
    
    const check = () => {
        attempts++;
        
        if (checkDependencies()) {
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(check, 500);
        } else {
            console.error('❌ Timeout aguardando dependências');
        }
    };
    
    check();
}

// ===================================================================
// SISTEMA DE PERFIS DE CONTAS
// ===================================================================

const AccountProfiles = {
    // Salvar dados de uma conta
    save: function(email, data) {
        try {
            const profiles = JSON.parse(localStorage.getItem('account_profiles') || '{}');
            profiles[email] = {
                email: email,
                name: data.name || email,
                picture: data.picture || '',
                events: data.events || [],
                calendars: data.calendars || [],
                lastSync: new Date().toISOString(),
                token: data.token || null,
                tokenExpiry: data.tokenExpiry || null
            };
            localStorage.setItem('account_profiles', JSON.stringify(profiles));
            console.log('✅ Perfil salvo para:', email);
            this.updateUI();
        } catch (error) {
            console.error('❌ Erro ao salvar perfil:', error);
        }
    },
    
    // Carregar dados de uma conta
    load: function(email) {
        try {
            const profiles = JSON.parse(localStorage.getItem('account_profiles') || '{}');
            return profiles[email] || null;
        } catch (error) {
            console.error('❌ Erro ao carregar perfil:', error);
            return null;
        }
    },
    
    // Listar todas as contas salvas
    list: function() {
        try {
            const profiles = JSON.parse(localStorage.getItem('account_profiles') || '{}');
            return Object.keys(profiles);
        } catch (error) {
            console.error('❌ Erro ao listar perfis:', error);
            return [];
        }
    },
    
    // Remover uma conta
    remove: function(email) {
        try {
            const profiles = JSON.parse(localStorage.getItem('account_profiles') || '{}');
            delete profiles[email];
            localStorage.setItem('account_profiles', JSON.stringify(profiles));
            console.log('✅ Perfil removido:', email);
            this.updateUI();
        } catch (error) {
            console.error('❌ Erro ao remover perfil:', error);
        }
    },
    
    // Obter conta atual
    getCurrent: function() {
        return localStorage.getItem('current_account') || null;
    },
    
    // Definir conta atual
    setCurrent: function(email) {
        localStorage.setItem('current_account', email);
        this.updateUI();
    },
    
    // Atualizar interface
    updateUI: function() {
        this.updateAccountsList();
        this.updateCurrentAccountDisplay();
    },
    
    // Atualizar lista de contas salvas
    updateAccountsList: function() {
        const container = document.getElementById('saved-accounts-list');
        if (!container) return;
        
        const accounts = this.list();
        const currentAccount = this.getCurrent();
        
        if (accounts.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">Nenhuma conta salva</p>';
            return;
        }
        
        container.innerHTML = accounts.map(email => {
            const profile = this.load(email);
            const isCurrent = email === currentAccount;
            
            return `
                <div class="saved-account-item ${isCurrent ? 'current' : ''}">
                    <div class="account-info">
                        ${profile.picture ? `<img src="${profile.picture}" alt="Avatar" class="account-avatar">` : ''}
                        <div class="account-details">
                            <div class="account-name">${profile.name}</div>
                            <div class="account-email">${email}</div>
                            <div class="account-last-sync">Última sync: ${new Date(profile.lastSync).toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="account-actions">
                        ${!isCurrent ? `<button onclick="AccountProfiles.switchTo('${email}')" class="btn-switch">Trocar</button>` : '<span class="current-label">Atual</span>'}
                        <button onclick="AccountProfiles.remove('${email}')" class="btn-remove" title="Remover conta">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Atualizar display da conta atual
    updateCurrentAccountDisplay: function() {
        const currentEmail = this.getCurrent();
        const display = document.getElementById('current-account-display');
        
        if (!display || !currentEmail) return;
        
        const profile = this.load(currentEmail);
        if (profile) {
            display.innerHTML = `
                <div class="current-account-info">
                    ${profile.picture ? `<img src="${profile.picture}" alt="Avatar" class="current-avatar">` : ''}
                    <div>
                        <div class="current-name">${profile.name}</div>
                        <div class="current-email">${currentEmail}</div>
                    </div>
                </div>
            `;
        }
    },
    
    // Trocar para uma conta específica
    switchTo: function(email) {
        console.log('🔄 Trocando para conta:', email);
        
        const profile = this.load(email);
        if (!profile) {
            alert('Perfil da conta não encontrado');
            return;
        }
        
        // Salvar dados da conta atual se conectada
        this.saveCurrentAccountData();
        
        // Definir nova conta atual
        this.setCurrent(email);
        
        // Carregar dados da conta
        this.loadAccountData(profile);
        
        // Tentar reconectar se token ainda válido
        if (profile.token && !this.isTokenExpired(profile.tokenExpiry)) {
            console.log('✅ Reconectando com token salvo...');
            gapi.client.setToken({ access_token: profile.token });
            
            // Verificar se token ainda funciona
            this.verifyToken().then(valid => {
                if (valid) {
                    console.log('✅ Token válido, conta reconectada');
                    if (typeof loadFilteredEvents === 'function') {
                        loadFilteredEvents();
                    }
                } else {
                    console.log('⚠️ Token inválido, nova autenticação necessária');
                    this.requestNewAuth(email);
                }
            });
        } else {
            console.log('⚠️ Token expirado, nova autenticação necessária');
            this.requestNewAuth(email);
        }
    },
    
    // Verificar se token está expirado
    isTokenExpired: function(expiry) {
        if (!expiry) return true;
        return new Date() >= new Date(expiry);
    },
    
    // Verificar se token ainda é válido
    verifyToken: async function() {
        try {
            await gapi.client.request({
                path: 'https://www.googleapis.com/oauth2/v2/userinfo'
            });
            return true;
        } catch (error) {
            return false;
        }
    },
    
    // Solicitar nova autenticação
    requestNewAuth: function(email) {
        if (typeof tokenClient !== 'undefined' && tokenClient) {
            tokenClient.requestAccessToken({ 
                prompt: 'select_account',
                login_hint: email
            });
        } else {
            alert('Sistema de autenticação não está pronto. Recarregue a página.');
        }
    },
    
    // Salvar dados da conta atual
    saveCurrentAccountData: function() {
        const currentEmail = this.getCurrent();
        if (!currentEmail) return;
        
        try {
            // Coletar dados atuais
            const events = JSON.parse(localStorage.getItem('google_calendar_events') || '[]');
            const token = gapi.client.getToken();
            
            const data = {
                events: events,
                token: token ? token.access_token : null,
                tokenExpiry: token ? token.expires_at : null
            };
            
            this.save(currentEmail, data);
        } catch (error) {
            console.error('❌ Erro ao salvar dados da conta atual:', error);
        }
    },
    
    // Carregar dados de uma conta
    loadAccountData: function(profile) {
        try {
            // Limpar dados atuais
            localStorage.removeItem('google_calendar_events');
            
            // Carregar dados da conta
            if (profile.events && profile.events.length > 0) {
                localStorage.setItem('google_calendar_events', JSON.stringify(profile.events));
            }
            
            // Atualizar interface se função existir
            if (typeof updateEventsDisplay === 'function') {
                updateEventsDisplay();
            }
            
            console.log('✅ Dados da conta carregados:', profile.email);
        } catch (error) {
            console.error('❌ Erro ao carregar dados da conta:', error);
        }
    }
};

// ===================================================================
// FUNÇÕES PRINCIPAIS
// ===================================================================

// Função chamada quando autenticação é bem-sucedida
window.onAuthSuccess = function(userInfo, accessToken) {
    console.log('✅ Autenticação bem-sucedida para:', userInfo.email);
    
    // Salvar dados da conta
    const accountData = {
        name: userInfo.name,
        picture: userInfo.picture,
        token: accessToken,
        tokenExpiry: new Date(Date.now() + 3600000).toISOString() // 1 hora
    };
    
    AccountProfiles.save(userInfo.email, accountData);
    AccountProfiles.setCurrent(userInfo.email);
    
    // Atualizar interface
    updateAccountsInterface();
    
    console.log('✅ Conta adicionada/atualizada:', userInfo.email);
};

// Adicionar nova conta (trocar de conta)
window.addNewAccount = function() {
    const currentAccount = AccountProfiles.getCurrent();
    
    let message = 'Para adicionar uma nova conta, você precisa trocar da conta atual.\n\n';
    if (currentAccount) {
        message += `Conta atual: ${currentAccount}\n`;
        message += 'Seus dados serão salvos automaticamente.\n\n';
    }
    message += 'Deseja continuar?';
    
    const confirmSwitch = confirm(message);
    if (!confirmSwitch) return;
    
    console.log('🔄 Iniciando troca de conta...');
    
    // Salvar dados da conta atual
    AccountProfiles.saveCurrentAccountData();
    
    // Desconectar conta atual
    if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
        gapi.client.setToken(null);
    }
    
    // Limpar dados temporários
    localStorage.removeItem('google_calendar_events');
    localStorage.removeItem('current_account');
    
    // Atualizar interface
    updateAccountsInterface();
    
    // Solicitar nova autenticação
    setTimeout(() => {
        if (typeof tokenClient !== 'undefined' && tokenClient) {
            tokenClient.requestAccessToken({ 
                prompt: 'select_account'
            });
        } else {
            alert('Sistema de autenticação não está pronto. Recarregue a página.');
        }
    }, 1000);
};

// Sincronizar conta específica
window.syncAccount = function(email) {
    console.log('🔄 Sincronizando conta:', email);
    
    const currentAccount = AccountProfiles.getCurrent();
    if (currentAccount === email) {
        // Conta atual, sincronizar normalmente
        if (typeof loadFilteredEvents === 'function') {
            loadFilteredEvents();
        }
    } else {
        // Trocar para a conta e sincronizar
        AccountProfiles.switchTo(email);
    }
};

// Obter contas conectadas (compatibilidade)
window.getConnectedAccounts = function() {
    return AccountProfiles.list().map(email => {
        const profile = AccountProfiles.load(email);
        return {
            email: email,
            name: profile.name,
            picture: profile.picture
        };
    });
};

// Atualizar interface de contas
function updateAccountsInterface() {
    AccountProfiles.updateUI();
    
    // Atualizar contador de contas
    const accounts = AccountProfiles.list();
    const counter = document.getElementById('accounts-counter');
    if (counter) {
        counter.textContent = accounts.length;
    }
}

// ===================================================================
// INICIALIZAÇÃO
// ===================================================================

// Aguardar dependências e inicializar
waitForDependencies(() => {
    console.log('✅ Sistema de múltiplas contas inicializado (modo simplificado)');
    
    // Definir onAuthSuccess globalmente
    if (typeof window.onAuthSuccess === 'undefined') {
        console.log('✅ onAuthSuccess definida com sucesso');
    }
    
    // Atualizar interface inicial
    setTimeout(() => {
        updateAccountsInterface();
    }, 1000);
});

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAccountsInterface);
} else {
    updateAccountsInterface();
}
