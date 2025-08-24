// openfinance-integration.js - VERSÃO COM MODAL REDIMENSIONÁVEL

// Instância global do Pluggy Manager
let pluggyManager = null;
let selectedConnectorId = null;

// Variáveis globais para redimensionamento do modal
let isResizing = false;
let isDragging = false;
let currentResizer = null;
let startX, startY, startWidth, startHeight, startLeft, startTop;

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
    
    // Inicializar modal redimensionável
    initResizableModal();
    
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
// MODAL REDIMENSIONÁVEL
// =================================================================
function initResizableModal() {
    // Aguardar o modal aparecer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const modal = document.getElementById('openfinance-modal');
                if (modal && modal.style.display !== 'none' && !modal.querySelector('.resizer')) {
                    makeModalResizable();
                    addResizeStyles();
                }
            }
        });
    });
    
    const modal = document.getElementById('openfinance-modal');
    if (modal) {
        observer.observe(modal, { attributes: true });
    }
}

function makeModalResizable() {
    const modal = document.getElementById('openfinance-modal');
    if (!modal) return;

    // Adicionar handles de redimensionamento
    const resizers = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    
    resizers.forEach(direction => {
        const resizer = document.createElement('div');
        resizer.className = `resizer resizer-${direction}`;
        resizer.style.cssText = `
            position: absolute;
            background: transparent;
            z-index: 1000;
        `;
        
        // Posicionamento dos handles
        switch(direction) {
            case 'nw':
                resizer.style.cssText += 'top: -5px; left: -5px; width: 10px; height: 10px; cursor: nw-resize;';
                break;
            case 'ne':
                resizer.style.cssText += 'top: -5px; right: -5px; width: 10px; height: 10px; cursor: ne-resize;';
                break;
            case 'sw':
                resizer.style.cssText += 'bottom: -5px; left: -5px; width: 10px; height: 10px; cursor: sw-resize;';
                break;
            case 'se':
                resizer.style.cssText += 'bottom: -5px; right: -5px; width: 10px; height: 10px; cursor: se-resize;';
                break;
            case 'n':
                resizer.style.cssText += 'top: -5px; left: 10px; right: 10px; height: 10px; cursor: n-resize;';
                break;
            case 's':
                resizer.style.cssText += 'bottom: -5px; left: 10px; right: 10px; height: 10px; cursor: s-resize;';
                break;
            case 'e':
                resizer.style.cssText += 'right: -5px; top: 10px; bottom: 10px; width: 10px; cursor: e-resize;';
                break;
            case 'w':
                resizer.style.cssText += 'left: -5px; top: 10px; bottom: 10px; width: 10px; cursor: w-resize;';
                break;
        }
        
        modal.appendChild(resizer);
        
        // Event listeners para redimensionamento
        resizer.addEventListener('mousedown', initResize);
    });

    // Tornar o cabeçalho arrastável
    const header = modal.querySelector('h2');
    if (header) {
        header.style.cursor = 'move';
        header.addEventListener('mousedown', initDrag);
        header.addEventListener('dblclick', toggleMaximize);
    }

    // Aplicar estilos iniciais ao modal
    modal.style.position = 'fixed';
    modal.style.top = '5%';
    modal.style.left = '50%';
    modal.style.transform = 'translateX(-50%)';
    modal.style.width = '900px';
    modal.style.height = '700px';
    modal.style.minWidth = '500px';
    modal.style.minHeight = '400px';
    modal.style.maxWidth = '95vw';
    modal.style.maxHeight = '95vh';
    modal.style.resize = 'none';
    modal.style.overflow = 'hidden';
}

function addResizeStyles() {
    if (document.getElementById('resize-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'resize-styles';
    style.textContent = `
        .resizer {
            position: absolute;
            z-index: 1000;
        }
        
        .resizer:hover {
            background: rgba(255, 255, 255, 0.3) !important;
        }
        
        #openfinance-modal {
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        #openfinance-modal h2 {
            user-select: none;
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin: 0;
        }
        
        #openfinance-modal .modal-content {
            height: calc(100% - 60px);
            overflow-y: auto;
            padding: 20px;
        }
        
        /* Melhorar scroll */
        #openfinance-modal .modal-content::-webkit-scrollbar {
            width: 8px;
        }
        
        #openfinance-modal .modal-content::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }
        
        #openfinance-modal .modal-content::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }
        
        #openfinance-modal .modal-content::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }
        
        /* Filtro de bancos */
        #bankFilter {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
        }
        
        #bankFilter::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        /* Grid de bancos com scroll */
        #banksList {
            max-height: 400px;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
            padding: 10px;
        }
        
        .bank-item {
            transition: all 0.3s ease;
        }
        
        .bank-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
}

// Iniciar redimensionamento
function initResize(e) {
    isResizing = true;
    currentResizer = e.target;
    startX = e.clientX;
    startY = e.clientY;
    
    const modal = document.getElementById('openfinance-modal');
    const rect = modal.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
}

// Executar redimensionamento
function doResize(e) {
    if (!isResizing) return;
    
    const modal = document.getElementById('openfinance-modal');
    const direction = currentResizer.className.split('-')[1];
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;
    
    // Calcular novas dimensões baseado na direção
    if (direction.includes('e')) {
        newWidth = startWidth + deltaX;
    }
    if (direction.includes('w')) {
        newWidth = startWidth - deltaX;
        newLeft = startLeft + deltaX;
    }
    if (direction.includes('s')) {
        newHeight = startHeight + deltaY;
    }
    if (direction.includes('n')) {
        newHeight = startHeight - deltaY;
        newTop = startTop + deltaY;
    }
    
    // Aplicar limites mínimos e máximos
    newWidth = Math.max(500, Math.min(window.innerWidth * 0.95, newWidth));
    newHeight = Math.max(400, Math.min(window.innerHeight * 0.95, newHeight));
    
    // Aplicar novas dimensões
    modal.style.width = newWidth + 'px';
    modal.style.height = newHeight + 'px';
    
    if (direction.includes('w') || direction.includes('n')) {
        modal.style.left = newLeft + 'px';
        modal.style.top = newTop + 'px';
        modal.style.transform = 'none';
    }
}

// Parar redimensionamento
function stopResize() {
    isResizing = false;
    currentResizer = null;
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
}

// Iniciar arrastar
function initDrag(e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    
    isDragging = true;
    const modal = document.getElementById('openfinance-modal');
    const rect = modal.getBoundingClientRect();
    
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
}

// Executar arrastar
function doDrag(e) {
    if (!isDragging) return;
    
    const modal = document.getElementById('openfinance-modal');
    const newLeft = e.clientX - startX;
    const newTop = e.clientY - startY;
    
    // Limitar dentro da viewport
    const maxLeft = window.innerWidth - modal.offsetWidth;
    const maxTop = window.innerHeight - modal.offsetHeight;
    
    modal.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + 'px';
    modal.style.top = Math.max(0, Math.min(maxTop, newTop)) + 'px';
    modal.style.transform = 'none';
}

// Parar arrastar
function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// Alternar maximizar/restaurar
function toggleMaximize() {
    const modal = document.getElementById('openfinance-modal');
    
    if (modal.dataset.maximized === 'true') {
        // Restaurar
        modal.style.width = modal.dataset.originalWidth || '900px';
        modal.style.height = modal.dataset.originalHeight || '700px';
        modal.style.left = modal.dataset.originalLeft || '50%';
        modal.style.top = modal.dataset.originalTop || '5%';
        modal.style.transform = modal.dataset.originalTransform || 'translateX(-50%)';
        modal.dataset.maximized = 'false';
    } else {
        // Maximizar
        modal.dataset.originalWidth = modal.style.width;
        modal.dataset.originalHeight = modal.style.height;
        modal.dataset.originalLeft = modal.style.left;
        modal.dataset.originalTop = modal.style.top;
        modal.dataset.originalTransform = modal.style.transform;
        
        modal.style.width = '95vw';
        modal.style.height = '95vh';
        modal.style.left = '2.5vw';
        modal.style.top = '2.5vh';
        modal.style.transform = 'none';
        modal.dataset.maximized = 'true';
    }
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
            item.style.display = 'block';
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
window.filterBanks = filterBanks;
window.makeModalResizable = makeModalResizable;
window.toggleMaximize = toggleMaximize;

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

console.log('✅ openfinance-integration.js com modal redimensionável carregado!');

