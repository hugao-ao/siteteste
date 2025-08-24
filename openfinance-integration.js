// openfinance-integration.js

// Instância global do Pluggy Manager
let pluggyManager = null;
let selectedConnectorId = null;

// =================================================================
// INICIALIZAÇÃO
// =================================================================
function initializeOpenFinance() {
    console.log('🚀 Inicializando Open Finance...');
    
    // Verificar se PLUGGY_CONFIG está disponível
    if (typeof PLUGGY_CONFIG === 'undefined') {
        console.error('❌ PLUGGY_CONFIG não encontrado!');
        showMessage('Erro: Configuração do Pluggy não carregada', 'error');
        return;
    }
    
    // Verificar se PluggyManager está disponível
    if (typeof PluggyManager === 'undefined') {
        console.error('❌ PluggyManager não encontrado!');
        showMessage('Erro: PluggyManager não carregado', 'error');
        return;
    }
    
    // Criar instância do Pluggy Manager
    pluggyManager = new PluggyManager(PLUGGY_CONFIG);
    
    // Tentar restaurar token salvo
    if (pluggyManager.restoreToken()) {
        updatePluggyStatus(true);
        loadExistingConnections();
    }
    
    // Event listeners
    setupEventListeners();
    
    console.log('✅ Open Finance inicializado!');
}

function setupEventListeners() {
    // Botão conectar
    const connectBtn = document.getElementById('connectPluggyBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', handleConnectPluggy);
        console.log('✅ Event listener do botão conectar adicionado');
    } else {
        console.error('❌ Botão connectPluggyBtn não encontrado!');
    }
    
    // Botão atualizar
    const refreshBtn = document.getElementById('refreshConnectionsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadExistingConnections);
    }
    
    // Formulário de credenciais
    const credentialsForm = document.getElementById('credentialsForm');
    if (credentialsForm) {
        credentialsForm.addEventListener('submit', handleCredentialsSubmit);
    }
}

// =================================================================
// CONEXÃO INICIAL COM PLUGGY
// =================================================================
async function handleConnectPluggy() {
    console.log('🔄 Iniciando conexão com Pluggy...');
    
    const connectBtn = document.getElementById('connectPluggyBtn');
    if (!connectBtn) {
        console.error('❌ Botão não encontrado!');
        return;
    }
    
    const originalText = connectBtn.innerHTML;
    
    try {
        connectBtn.innerHTML = '<div class="spinner"></div> Conectando...';
        connectBtn.disabled = true;
        
        // Verificar se pluggyManager existe
        if (!pluggyManager) {
            console.error('❌ PluggyManager não inicializado!');
            showMessage('Erro: Sistema não inicializado corretamente', 'error');
            return;
        }
        
        // Autenticar com Pluggy
        console.log('🔄 Autenticando com Pluggy API...');
        await pluggyManager.authenticate();
        
        // Atualizar status
        updatePluggyStatus(true);
        
        // Carregar bancos disponíveis
        await loadAvailableBanks();
        
        // Carregar conexões existentes
        await loadExistingConnections();
        
        showMessage('Conectado ao Open Finance com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao conectar:', error);
        showMessage(`Erro ao conectar: ${error.message}`, 'error');
        updatePluggyStatus(false);
    } finally {
        connectBtn.innerHTML = originalText;
        connectBtn.disabled = false;
    }
}

// =================================================================
// CARREGAR BANCOS DISPONÍVEIS
// =================================================================
async function loadAvailableBanks() {
    try {
        console.log('🔄 Carregando bancos disponíveis...');
        
        const connectors = await pluggyManager.getConnectors();
        const banksList = document.getElementById('banksList');
        const banksSection = document.getElementById('banksSection');
        
        if (!banksList || !banksSection) {
            console.error('❌ Elementos da seção de bancos não encontrados!');
            return;
        }
        
        banksSection.style.display = 'block';
        
        // ===== NOVA FUNCIONALIDADE: FILTRO DE BUSCA =====
        const filterContainer = document.createElement('div');
        filterContainer.className = 'mb-3';
        filterContainer.innerHTML = `
            <div class="input-group">
                <span class="input-group-text" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;">
                    🔍
                </span>
                <input type="text" id="bank-filter" class="form-control" 
                       placeholder="Buscar banco..." 
                       onkeyup="filterBanks()"
                       style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;">
            </div>
        `;
        
        // Limpar e adicionar filtro
        banksList.innerHTML = '';
        banksList.appendChild(filterContainer);
        
        // ===== NOVA FUNCIONALIDADE: CONTAINER COM SCROLL =====
        const banksContainer = document.createElement('div');
        banksContainer.id = 'banks-container';
        banksContainer.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 15px;
            background: rgba(255,255,255,0.05);
        `;
        
        // Grid de bancos
        const banksGrid = document.createElement('div');
        banksGrid.className = 'banks-grid';
        banksGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        `;
        
        connectors.forEach(connector => {
            const bankDiv = document.createElement('div');
            bankDiv.className = 'bank-item';
            bankDiv.setAttribute('data-bank-name', connector.name.toLowerCase());
            bankDiv.onclick = () => selectBank(connector);
            
            // Estilo melhorado com hover
            bankDiv.style.cssText = `
                background: rgba(255,255,255,0.1);
                border: 2px solid transparent;
                border-radius: 10px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            
            bankDiv.innerHTML = `
                <div style="width: 60px; height: 60px; margin: 0 auto 15px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <img src="${connector.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='}" 
                         alt="${connector.name}" 
                         style="max-width: 50px; max-height: 50px; object-fit: contain;"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
                </div>
                <h4 style="margin: 0; color: white; font-size: 14px; font-weight: 500;">${connector.name}</h4>
                <p style="margin: 5px 0 0; color: rgba(255,255,255,0.6); font-size: 12px;">${connector.type || 'Banco'}</p>
            `;
            
            // Hover effects
            bankDiv.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(255,255,255,0.2)';
                this.style.borderColor = '#4CAF50';
                this.style.transform = 'translateY(-2px)';
            });
            
            bankDiv.addEventListener('mouseleave', function() {
                if (!this.classList.contains('selected')) {
                    this.style.background = 'rgba(255,255,255,0.1)';
                    this.style.borderColor = 'transparent';
                    this.style.transform = 'translateY(0)';
                }
            });
            
            banksGrid.appendChild(bankDiv);
        });
        
        banksContainer.appendChild(banksGrid);
        banksList.appendChild(banksContainer);
        
        console.log(`✅ ${connectors.length} bancos carregados`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar bancos:', error);
        showMessage('Erro ao carregar bancos disponíveis', 'error');
    }
}

// ===== NOVA FUNCIONALIDADE: FILTRO DE BANCOS =====
function filterBanks() {
    const filter = document.getElementById('bank-filter');
    const bankItems = document.querySelectorAll('.bank-item');
    
    if (!filter) return;
    
    const searchTerm = filter.value.toLowerCase();
    
    bankItems.forEach(item => {
        const bankName = item.getAttribute('data-bank-name');
        if (bankName && bankName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// =================================================================
// SELEÇÃO DE BANCO
// =================================================================
function selectBank(connector) {
    // Remover seleção anterior
    document.querySelectorAll('.bank-item').forEach(item => {
        item.classList.remove('selected');
        item.style.background = 'rgba(255,255,255,0.1)';
        item.style.borderColor = 'transparent';
        item.style.transform = 'translateY(0)';
    });
    
    // Selecionar banco atual
    event.currentTarget.classList.add('selected');
    event.currentTarget.style.background = 'rgba(76, 175, 80, 0.2)';
    event.currentTarget.style.borderColor = '#4CAF50';
    
    selectedConnectorId = connector.id;
    
    // Mostrar formulário de credenciais
    const selectedBankName = document.getElementById('selectedBankName');
    const credentialsSection = document.getElementById('credentialsSection');
    
    if (selectedBankName) selectedBankName.textContent = connector.name;
    if (credentialsSection) credentialsSection.style.display = 'block';
    
    // Limpar formulário
    const bankUsername = document.getElementById('bankUsername');
    const bankPassword = document.getElementById('bankPassword');
    if (bankUsername) bankUsername.value = '';
    if (bankPassword) bankPassword.value = '';
}

function cancelConnection() {
    const credentialsSection = document.getElementById('credentialsSection');
    if (credentialsSection) credentialsSection.style.display = 'none';
    
    selectedConnectorId = null;
    
    // Remover seleções
    document.querySelectorAll('.bank-item').forEach(item => {
        item.classList.remove('selected');
        item.style.background = 'rgba(255,255,255,0.1)';
        item.style.borderColor = 'transparent';
        item.style.transform = 'translateY(0)';
    });
}

// =================================================================
// CONECTAR COM BANCO
// =================================================================
async function handleCredentialsSubmit(event) {
    event.preventDefault();
    
    if (!selectedConnectorId) {
        showMessage('Selecione um banco primeiro', 'error');
        return;
    }
    
    const username = document.getElementById('bankUsername').value;
    const password = document.getElementById('bankPassword').value;
    
    if (!username || !password) {
        showMessage('Preencha todos os campos', 'error');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<div class="spinner"></div> Conectando...';
        submitBtn.disabled = true;
        
        // Criar conexão
        const connection = await pluggyManager.createConnection(selectedConnectorId, {
            user: username,
            password: password
        });
        
        showMessage('Banco conectado com sucesso!', 'success');
        
        // Esconder formulário
        cancelConnection();
        
        // Recarregar conexões
        await loadExistingConnections();
        
    } catch (error) {
        console.error('❌ Erro ao conectar banco:', error);
        showMessage(`Erro ao conectar: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// =================================================================
// CONEXÕES EXISTENTES
// =================================================================
async function loadExistingConnections() {
    try {
        console.log('🔄 Carregando conexões existentes...');
        
        const connections = await pluggyManager.getConnections();
        const connectionsList = document.getElementById('connectionsList');
        
        if (!connectionsList) {
            console.error('❌ Elemento connectionsList não encontrado!');
            return;
        }
        
        connectionsList.innerHTML = '';
        
        if (connections.length === 0) {
            connectionsList.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Nenhuma conexão ativa</p>';
            return;
        }
        
        connections.forEach(connection => {
            const connectionDiv = document.createElement('div');
            connectionDiv.className = 'connection-item';
            
            const statusClass = getConnectionStatusClass(connection.status);
            
            connectionDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: white;">${connection.connector.name}</h4>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.8);">
                            Conectado em: ${pluggyManager.formatDate(connection.createdAt)}
                        </p>
                        <span class="connection-status ${statusClass}">
                            ${getConnectionStatusText(connection.status)}
                        </span>
                    </div>
                    <div>
                        <button onclick="loadAccountsForConnection('${connection.id}')" class="btn btn-primary" style="margin-right: 10px;">
                            <i class="fas fa-credit-card"></i> Ver Contas
                        </button>
                        <button onclick="disconnectBank('${connection.id}')" class="btn btn-danger">
                            <i class="fas fa-unlink"></i> Desconectar
                        </button>
                    </div>
                </div>
            `;
            
            connectionsList.appendChild(connectionDiv);
        });
        
        console.log(`✅ ${connections.length} conexões carregadas`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar conexões:', error);
        showMessage('Erro ao carregar conexões', 'error');
    }
}

function getConnectionStatusClass(status) {
    switch (status) {
        case 'UPDATED': return 'status-connected';
        case 'UPDATING': return 'status-updating';
        case 'LOGIN_ERROR': 
        case 'OUTDATED': return 'status-error';
        default: return 'status-updating';
    }
}

function getConnectionStatusText(status) {
    switch (status) {
        case 'UPDATED': return 'Atualizado';
        case 'UPDATING': return 'Atualizando...';
        case 'LOGIN_ERROR': return 'Erro de Login';
        case 'OUTDATED': return 'Desatualizado';
        default: return status;
    }
}

// =================================================================
// CONTAS BANCÁRIAS
// =================================================================
async function loadAccountsForConnection(connectionId) {
    try {
        console.log(`🔄 Carregando contas para conexão ${connectionId}...`);
        
        const accounts = await pluggyManager.getAccounts(connectionId);
        const accountsList = document.getElementById('accountsList');
        const accountsSection = document.getElementById('accountsSection');
        
        if (!accountsList || !accountsSection) return;
        
        accountsSection.style.display = 'block';
        accountsList.innerHTML = '';
        
        if (accounts.length === 0) {
            accountsList.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Nenhuma conta encontrada</p>';
            return;
        }
        
        accounts.forEach(account => {
            const accountDiv = document.createElement('div');
            accountDiv.className = 'account-item';
            
            accountDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: white;">${account.name}</h4>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.8);">
                            ${account.type} • ${account.subtype || 'Conta Corrente'}
                        </p>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.6);">
                            Saldo: ${pluggyManager.formatCurrency(account.balance)}
                        </p>
                    </div>
                    <div>
                        <button onclick="loadTransactionsForAccount('${account.id}')" class="btn btn-primary">
                            <i class="fas fa-list"></i> Ver Transações
                        </button>
                    </div>
                </div>
            `;
            
            accountsList.appendChild(accountDiv);
        });
        
        console.log(`✅ ${accounts.length} contas carregadas`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar contas:', error);
        showMessage('Erro ao carregar contas', 'error');
    }
}

// =================================================================
// TRANSAÇÕES
// =================================================================
async function loadTransactionsForAccount(accountId) {
    try {
        console.log(`🔄 Carregando transações para conta ${accountId}...`);
        
        // Últimos 30 dias
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transactions = await pluggyManager.getTransactions(accountId, from, to);
        const transactionsList = document.getElementById('transactionsList');
        const transactionsSection = document.getElementById('transactionsSection');
        
        if (!transactionsList || !transactionsSection) return;
        
        transactionsSection.style.display = 'block';
        transactionsList.innerHTML = '';
        
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Nenhuma transação encontrada nos últimos 30 dias</p>';
            return;
        }
        
        transactions.forEach(transaction => {
            const transactionDiv = document.createElement('div');
            transactionDiv.className = 'transaction-item';
            
            const isDebit = transaction.amount < 0;
            const amountClass = isDebit ? 'text-danger' : 'text-success';
            const amountIcon = isDebit ? '↓' : '↑';
            
            transactionDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h5 style="margin: 0; color: white;">${transaction.description}</h5>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.8);">
                            ${pluggyManager.formatDate(transaction.date)}
                        </p>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.6);">
                            ${transaction.category || 'Sem categoria'}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span class="${amountClass}" style="font-size: 18px; font-weight: bold;">
                            ${amountIcon} ${pluggyManager.formatCurrency(Math.abs(transaction.amount))}
                        </span>
                        ${isDebit ? `
                            <br>
                            <button onclick="syncTransactionToCalendar('${transaction.id}', '${JSON.stringify(transaction).replace(/"/g, '&quot;')}')" 
                                    class="btn btn-sm btn-outline-success mt-2">
                                <i class="fas fa-calendar-plus"></i> Adicionar ao Calendário
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            transactionsList.appendChild(transactionDiv);
        });
        
        console.log(`✅ ${transactions.length} transações carregadas`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar transações:', error);
        showMessage('Erro ao carregar transações', 'error');
    }
}

// =================================================================
// UTILITÁRIOS
// =================================================================
function updatePluggyStatus(connected) {
    const statusElement = document.getElementById('pluggyStatus');
    if (statusElement) {
        if (connected) {
            statusElement.innerHTML = '<span style="color: #4CAF50;">✅ Conectado ao Open Finance</span>';
            statusElement.className = 'alert alert-success';
        } else {
            statusElement.innerHTML = '<span style="color: #f44336;">❌ Não conectado ao Open Finance</span>';
            statusElement.className = 'alert alert-danger';
        }
    }
}

function showMessage(message, type = 'info') {
    // Implementar sistema de mensagens
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Criar toast ou alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    alertDiv.innerHTML = `
        <strong>${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</strong> ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove após 5 segundos
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 5000);
}

// =================================================================
// SINCRONIZAÇÃO COM GOOGLE CALENDAR
// =================================================================
async function syncTransactionToCalendar(transactionId, transactionData) {
    try {
        if (!isGoogleConnected) {
            showMessage('Conecte-se ao Google Calendar primeiro', 'error');
            return;
        }
        
        const transaction = JSON.parse(transactionData.replace(/&quot;/g, '"'));
        
        // Criar evento apenas para débitos (pagamentos)
        if (transaction.amount >= 0) {
            showMessage('Apenas débitos (pagamentos) são adicionados ao calendário', 'warning');
            return;
        }
        
        const event = {
            summary: `PAGAMENTO - ${transaction.description}`,
            description: `Valor: R$ ${Math.abs(transaction.amount).toFixed(2)}\nOrigem: Open Finance\nID: ${transaction.id}`,
            start: {
                date: transaction.date
            },
            end: {
                date: transaction.date
            },
            colorId: '11' // Vermelho para pagamentos
        };
        
        await gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });
        
        showMessage('Transação adicionada ao Google Calendar!', 'success');
        
        // Recarregar eventos do calendário
        if (typeof loadFilteredEvents === 'function') {
            await loadFilteredEvents();
        }
        
    } catch (error) {
        console.error('❌ Erro ao sincronizar com calendário:', error);
        showMessage('Erro ao adicionar ao calendário', 'error');
    }
}

// =================================================================
// DESCONECTAR BANCO
// =================================================================
async function disconnectBank(connectionId) {
    if (!confirm('Tem certeza que deseja desconectar este banco?')) {
        return;
    }
    
    try {
        await pluggyManager.disconnect(connectionId);
        showMessage('Banco desconectado com sucesso!', 'success');
        
        // Recarregar conexões
        await loadExistingConnections();
        
        // Esconder seções se não houver mais conexões
        const connections = await pluggyManager.getConnections();
        if (connections.length === 0) {
            const accountsSection = document.getElementById('accountsSection');
            const transactionsSection = document.getElementById('transactionsSection');
            if (accountsSection) accountsSection.style.display = 'none';
            if (transactionsSection) transactionsSection.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Erro ao desconectar:', error);
        showMessage('Erro ao desconectar banco', 'error');
    }
}

// =================================================================
// TORNAR FUNÇÕES GLOBAIS
// =================================================================
window.initializeOpenFinance = initializeOpenFinance;
window.handleConnectPluggy = handleConnectPluggy;
window.selectBank = selectBank;
window.cancelConnection = cancelConnection;
window.loadAccountsForConnection = loadAccountsForConnection;
window.loadTransactionsForAccount = loadTransactionsForAccount;
window.syncTransactionToCalendar = syncTransactionToCalendar;
window.disconnectBank = disconnectBank;
window.filterBanks = filterBanks; // NOVA FUNÇÃO

// =================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 DOM carregado, aguardando outros scripts...');
    // Aguardar um pouco para garantir que outros scripts carregaram
    setTimeout(() => {
        console.log('🚀 Inicializando Open Finance...');
        initializeOpenFinance();
    }, 2000);
});

// Também tentar inicializar quando a página carregar completamente
window.addEventListener('load', () => {
    console.log('🔄 Página carregada completamente');
    setTimeout(() => {
        if (!pluggyManager) {
            console.log('🚀 Tentando inicializar Open Finance novamente...');
            initializeOpenFinance();
        }
    }, 1000);
});

console.log('✅ openfinance-integration.js carregado!');

