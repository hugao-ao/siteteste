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

function updatePluggyStatus(connected) {
    const statusElement = document.getElementById('pluggyStatus');
    const connectBtn = document.getElementById('connectPluggyBtn');
    const refreshBtn = document.getElementById('refreshConnectionsBtn');
    
    if (!statusElement) {
        console.error('❌ Elemento pluggyStatus não encontrado!');
        return;
    }
    
    if (connected) {
        statusElement.className = 'status-indicator status-connected';
        statusElement.innerHTML = '<i class="fas fa-check-circle"></i><span>Conectado ao Open Finance</span>';
        
        if (connectBtn) connectBtn.style.display = 'none';
        if (refreshBtn) refreshBtn.style.display = 'block';
        
        // Mostrar seções
        const banksSection = document.getElementById('banksSection');
        const connectionsSection = document.getElementById('connectionsSection');
        if (banksSection) banksSection.style.display = 'block';
        if (connectionsSection) connectionsSection.style.display = 'block';
        
    } else {
        statusElement.className = 'status-indicator status-disconnected';
        statusElement.innerHTML = '<i class="fas fa-times-circle"></i><span>Não conectado ao Open Finance</span>';
        
        if (connectBtn) connectBtn.style.display = 'block';
        if (refreshBtn) refreshBtn.style.display = 'none';
        
        // Esconder seções
        const sections = ['banksSection', 'connectionsSection', 'accountsSection', 'transactionsSection'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.style.display = 'none';
        });
    }
}

// =================================================================
// BANCOS DISPONÍVEIS
// =================================================================
async function loadAvailableBanks() {
    try {
        console.log('🔄 Carregando bancos disponíveis...');
        
        const connectors = await pluggyManager.getConnectors();
        const banksList = document.getElementById('banksList');
        
        if (!banksList) {
            console.error('❌ Elemento banksList não encontrado!');
            return;
        }
        
        banksList.innerHTML = '';
        
        // Filtrar apenas bancos (não cartões de crédito, etc.)
        const banks = connectors.filter(connector => 
            connector.type === 'PERSONAL_BANK' || connector.type === 'BUSINESS_BANK'
        );
        
        banks.forEach(bank => {
            const bankDiv = document.createElement('div');
            bankDiv.className = 'bank-item';
            bankDiv.onclick = () => selectBank(bank);
            
            bankDiv.innerHTML = `
                <div class="bank-logo">
                    ${bank.imageUrl ? 
                        `<img src="${bank.imageUrl}" alt="${bank.name}" style="width: 100%; height: 100%; object-fit: contain;">` :
                        `<i class="fas fa-university"></i>`
                    }
                </div>
                <div class="bank-name">${bank.name}</div>
            `;
            
            banksList.appendChild(bankDiv);
        });
        
        console.log(`✅ ${banks.length} bancos carregados`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar bancos:', error);
        showMessage('Erro ao carregar bancos disponíveis', 'error');
    }
}

function selectBank(connector) {
    // Remover seleção anterior
    document.querySelectorAll('.bank-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Selecionar banco atual
    event.currentTarget.classList.add('selected');
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
                            Número: ${account.number || 'N/A'}
                        </p>
                        <div class="account-balance">
                            Saldo: ${pluggyManager.formatCurrency(account.balance)}
                        </div>
                    </div>
                    <div>
                        <button onclick="loadTransactionsForAccount('${account.id}')" class="btn btn-primary">
                            <i class="fas fa-exchange-alt"></i> Ver Transações
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
        
        // Buscar transações dos últimos 30 dias
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const transactions = await pluggyManager.getTransactions(accountId, {
            from: thirtyDaysAgo.toISOString().split('T')[0],
            to: new Date().toISOString().split('T')[0],
            pageSize: 50
        });
        
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
            
            const amountClass = transaction.amount >= 0 ? 'positive' : 'negative';
            const amountIcon = transaction.amount >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            
            transactionDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0; color: white;">${transaction.description}</h4>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.8);">
                            ${pluggyManager.formatDate(transaction.date)}
                        </p>
                        ${transaction.category ? 
                            `<p style="margin: 5px 0; color: rgba(255,255,255,0.6);">Categoria: ${transaction.category}</p>` : 
                            ''
                        }
                    </div>
                    <div style="text-align: right;">
                        <div class="transaction-amount ${amountClass}">
                            <i class="fas ${amountIcon}"></i>
                            ${pluggyManager.formatCurrency(Math.abs(transaction.amount))}
                        </div>
                        <button onclick="syncTransactionToCalendar('${transaction.id}', ${JSON.stringify(transaction).replace(/"/g, '&quot;')})" 
                                class="btn btn-secondary" style="margin-top: 5px; font-size: 12px;">
                            <i class="fas fa-calendar-plus"></i> Adicionar ao Calendário
                        </button>
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
// INTEGRAÇÃO COM GOOGLE CALENDAR
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

