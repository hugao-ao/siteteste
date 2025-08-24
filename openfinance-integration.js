// openfinance-integration.js - VERSÃO COM MODAL FIXO E SCROLL

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
    
    // Inicializar modal com dimensões fixas
    initFixedModal();
    
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
    
    // Campo de filtro de bancos
    const bankFilter = document.getElementById('bankFilter');
    if (bankFilter) {
        bankFilter.addEventListener('input', filterBanks);
    }
}

// =================================================================
// MODAL COM DIMENSÕES FIXAS E SCROLL
// =================================================================
function initFixedModal() {
    // Aguardar o modal aparecer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const modal = document.getElementById('openfinance-modal');
                if (modal && modal.style.display !== 'none' && !modal.classList.contains('fixed-modal-initialized')) {
                    setupFixedModal();
                    addFixedModalStyles();
                }
            }
        });
    });
    
    const modal = document.getElementById('openfinance-modal');
    if (modal) {
        observer.observe(modal, { attributes: true });
    }
}

function setupFixedModal() {
    const modal = document.getElementById('openfinance-modal');
    if (!modal) return;

    // Aplicar estilos de modal fixo
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.width = '800px';
    modal.style.height = '600px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.overflow = 'hidden';
    modal.style.resize = 'none';
    
    // Marcar como inicializado
    modal.classList.add('fixed-modal-initialized');
}

function addFixedModalStyles() {
    if (document.getElementById('fixed-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'fixed-modal-styles';
    style.textContent = `
        /* Modal com dimensões fixas */
        #openfinance-modal {
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        
        #openfinance-modal h2 {
            user-select: none;
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin: 0;
            background: rgba(25, 25, 112, 0.3);
            border-radius: 13px 13px 0 0;
        }
        
        /* Área de conteúdo com scroll */
        #openfinance-modal .modal-content {
            height: calc(100% - 60px);
            overflow-y: auto;
            padding: 20px;
            background: linear-gradient(135deg, #000080, #800080);
        }
        
        /* Scroll customizado */
        #openfinance-modal .modal-content::-webkit-scrollbar {
            width: 12px;
        }
        
        #openfinance-modal .modal-content::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            margin: 5px;
        }
        
        #openfinance-modal .modal-content::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 6px;
            border: 2px solid transparent;
            background-clip: content-box;
        }
        
        #openfinance-modal .modal-content::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
            background-clip: content-box;
        }
        
        /* Filtro de bancos */
        #bankFilter {
            width: 100%;
            padding: 12px 15px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
            backdrop-filter: blur(10px);
        }
        
        #bankFilter::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        #bankFilter:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.5);
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
        }
        
        /* Grid de bancos com scroll interno */
        #banksList {
            max-height: 350px;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 15px;
            padding: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
        }
        
        /* Scroll do grid de bancos */
        #banksList::-webkit-scrollbar {
            width: 8px;
        }
        
        #banksList::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }
        
        #banksList::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }
        
        #banksList::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }
        
        /* Cards dos bancos */
        .bank-item {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            min-height: 120px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .bank-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            border-color: rgba(255, 255, 255, 0.4);
            background: rgba(255, 255, 255, 0.15);
        }
        
        .bank-item.selected {
            border-color: #4285f4;
            background: rgba(66, 133, 244, 0.2);
            box-shadow: 0 0 20px rgba(66, 133, 244, 0.3);
        }
        
        .bank-logo {
            width: 40px;
            height: 40px;
            margin: 0 auto 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
        }
        
        .bank-logo i {
            font-size: 20px;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .bank-name {
            font-size: 12px;
            font-weight: 500;
            color: white;
            margin-bottom: 5px;
            line-height: 1.2;
        }
        
        .bank-type {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* Seções do modal */
        .openfinance-section {
            margin-bottom: 25px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .openfinance-section h3 {
            margin: 0 0 15px 0;
            color: white;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Status indicators */
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 14px;
        }
        
        .status-connected {
            background: rgba(52, 168, 83, 0.2);
            border: 1px solid rgba(52, 168, 83, 0.4);
            color: #34a853;
        }
        
        .status-disconnected {
            background: rgba(234, 67, 53, 0.2);
            border: 1px solid rgba(234, 67, 53, 0.4);
            color: #ea4335;
        }
        
        /* Botões */
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #4285f4, #34a853);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .btn-danger {
            background: linear-gradient(135deg, #ea4335, #d33b2c);
            color: white;
        }
        
        .btn-danger:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(234, 67, 53, 0.3);
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }
        
        /* Spinner */
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid #ffffff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Responsivo */
        @media (max-width: 768px) {
            #openfinance-modal {
                width: 95vw !important;
                height: 90vh !important;
                margin: 0;
            }
            
            #banksList {
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 10px;
            }
            
            .bank-item {
                min-height: 100px;
                padding: 10px;
            }
        }
    `;
    document.head.appendChild(style);
}

// =================================================================
// FILTRO DE BANCOS
// =================================================================
function filterBanks() {
    const filter = document.getElementById('bankFilter');
    const banksList = document.getElementById('banksList');
    
    if (!filter || !banksList) return;
    
    const searchTerm = filter.value.toLowerCase();
    const bankItems = banksList.querySelectorAll('.bank-item');
    
    bankItems.forEach(item => {
        const bankName = item.querySelector('.bank-name').textContent.toLowerCase();
        if (bankName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
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
        
        // Adicionar campo de filtro se não existir
        let filterInput = document.getElementById('bankFilter');
        if (!filterInput) {
            filterInput = document.createElement('input');
            filterInput.id = 'bankFilter';
            filterInput.type = 'text';
            filterInput.placeholder = '🔍 Buscar banco...';
            filterInput.addEventListener('input', filterBanks);
            banksList.parentNode.insertBefore(filterInput, banksList);
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
                <div class="bank-type">${bank.type === 'BUSINESS_BANK' ? 'EMPRESAS' : 'PESSOAL'}</div>
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
            
            const isDebit = transaction.amount < 0;
            const amountClass = isDebit ? 'amount-debit' : 'amount-credit';
            const icon = isDebit ? 'fas fa-arrow-down' : 'fas fa-arrow-up';
            
            transactionDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0; color: white;">
                            <i class="${icon}" style="margin-right: 8px;"></i>
                            ${transaction.description}
                        </h4>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.8);">
                            ${pluggyManager.formatDate(transaction.date)}
                        </p>
                        <p style="margin: 5px 0; color: rgba(255,255,255,0.6);">
                            Categoria: ${transaction.category || 'Não categorizada'}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <div class="transaction-amount ${amountClass}">
                            ${pluggyManager.formatCurrency(transaction.amount)}
                        </div>
                        ${isDebit ? `
                            <button onclick="syncTransactionToCalendar('${transaction.id}', '${JSON.stringify(transaction).replace(/"/g, '&quot;')}')" 
                                    class="btn btn-sm btn-secondary" style="margin-top: 5px;">
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
        
        // Recarregar calendário se estiver visível
        if (typeof loadCalendar === 'function') {
            loadCalendar();
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
        await pluggyManager.deleteConnection(connectionId);
        showMessage('Banco desconectado com sucesso!', 'success');
        
        // Recarregar conexões
        await loadExistingConnections();
        
        // Esconder seções de contas e transações
        const accountsSection = document.getElementById('accountsSection');
        const transactionsSection = document.getElementById('transactionsSection');
        
        if (accountsSection) accountsSection.style.display = 'none';
        if (transactionsSection) transactionsSection.style.display = 'none';
        
    } catch (error) {
        console.error('❌ Erro ao desconectar banco:', error);
        showMessage('Erro ao desconectar banco', 'error');
    }
}

// =================================================================
// SISTEMA DE MENSAGENS
// =================================================================
function showMessage(message, type = 'info') {
    // Remover mensagem anterior se existir
    const existingMessage = document.querySelector('.openfinance-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Criar nova mensagem
    const messageDiv = document.createElement('div');
    messageDiv.className = `openfinance-message message-${type}`;
    
    const icon = type === 'success' ? 'fas fa-check-circle' : 
                 type === 'error' ? 'fas fa-exclamation-circle' : 
                 type === 'warning' ? 'fas fa-exclamation-triangle' : 
                 'fas fa-info-circle';
    
    messageDiv.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; margin-left: 10px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Adicionar estilos se não existirem
    if (!document.getElementById('message-styles')) {
        const style = document.createElement('style');
        style.id = 'message-styles';
        style.textContent = `
            .openfinance-message {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 10px;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease;
            }
            
            .message-success {
                background: linear-gradient(135deg, #34a853, #2d8f47);
                border: 1px solid rgba(52, 168, 83, 0.5);
            }
            
            .message-error {
                background: linear-gradient(135deg, #ea4335, #d33b2c);
                border: 1px solid rgba(234, 67, 53, 0.5);
            }
            
            .message-warning {
                background: linear-gradient(135deg, #fbbc04, #f9ab00);
                border: 1px solid rgba(251, 188, 4, 0.5);
                color: #333;
            }
            
            .message-info {
                background: linear-gradient(135deg, #4285f4, #3367d6);
                border: 1px solid rgba(66, 133, 244, 0.5);
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Adicionar ao DOM
    document.body.appendChild(messageDiv);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 5000);
}

// =================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// =================================================================
// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOpenFinance);
} else {
    initializeOpenFinance();
}

// Tornar funções disponíveis globalmente
window.initializeOpenFinance = initializeOpenFinance;
window.handleConnectPluggy = handleConnectPluggy;
window.filterBanks = filterBanks;
window.selectBank = selectBank;
window.cancelConnection = cancelConnection;
window.handleCredentialsSubmit = handleCredentialsSubmit;
window.loadAccountsForConnection = loadAccountsForConnection;
window.loadTransactionsForAccount = loadTransactionsForAccount;
window.syncTransactionToCalendar = syncTransactionToCalendar;
window.disconnectBank = disconnectBank;
window.showMessage = showMessage;

