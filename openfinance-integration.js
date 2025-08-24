// openfinance-melhorado.js
// Versão com scroll, filtro de bancos e menos logs

// Inicialização do Open Finance
async function initializeOpenFinance() {
    try {
        console.log('🔄 Inicializando Open Finance...');
        
        // Verificar se já existe uma instância
        if (window.pluggyManager) {
            console.log('✅ PluggyManager já inicializado');
            return;
        }
        
        // Verificar se PLUGGY_CONFIG existe
        if (!window.PLUGGY_CONFIG) {
            console.error('❌ PLUGGY_CONFIG não encontrado');
            return;
        }
        
        // Criar instância do PluggyManager
        window.pluggyManager = new PluggyManager(window.PLUGGY_CONFIG);
        
        // Tentar restaurar token salvo
        window.pluggyManager.restoreToken();
        
        console.log('✅ Open Finance inicializado!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar Open Finance:', error);
    }
}

// Função principal para conectar com Pluggy
async function handleConnectPluggy() {
    try {
        console.log('🔄 Iniciando conexão com Pluggy...');
        
        // Verificar se está inicializado
        if (!window.pluggyManager) {
            await initializeOpenFinance();
        }
        
        // Autenticar
        console.log('🔄 Autenticando com Pluggy API...');
        await window.pluggyManager.authenticate();
        
        // Buscar conectores (bancos)
        console.log('🔄 Carregando bancos...');
        const connectors = await window.pluggyManager.getConnectors();
        
        // Atualizar interface
        updateOpenFinanceUI(connectors);
        
        console.log('✅ Open Finance conectado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao conectar:', error);
        showOpenFinanceError('Erro ao conectar com Open Finance: ' + error.message);
    }
}

// Atualizar interface do Open Finance
function updateOpenFinanceUI(connectors) {
    const statusElement = document.getElementById('openfinance-status');
    const connectButton = document.getElementById('connect-openfinance-btn');
    const banksContainer = document.getElementById('banks-container');
    const banksSection = document.getElementById('banks-section');
    
    if (statusElement) {
        statusElement.innerHTML = '<span style="color: #4CAF50;">✅ Conectado ao Open Finance</span>';
        statusElement.className = 'alert alert-success';
    }
    
    if (connectButton) {
        connectButton.style.display = 'none';
    }
    
    if (banksSection) {
        banksSection.style.display = 'block';
    }
    
    if (banksContainer && connectors) {
        displayBanks(connectors);
    }
}

// Exibir bancos com filtro
function displayBanks(connectors) {
    const banksContainer = document.getElementById('banks-container');
    if (!banksContainer) return;
    
    // Limpar container
    banksContainer.innerHTML = '';
    
    // Criar filtro de busca
    const filterContainer = document.createElement('div');
    filterContainer.className = 'mb-3';
    filterContainer.innerHTML = `
        <div class="input-group">
            <span class="input-group-text">🔍</span>
            <input type="text" id="bank-filter" class="form-control" placeholder="Buscar banco..." onkeyup="filterBanks()">
        </div>
    `;
    banksContainer.appendChild(filterContainer);
    
    // Container dos bancos com scroll
    const banksGrid = document.createElement('div');
    banksGrid.id = 'banks-grid';
    banksGrid.className = 'banks-grid';
    banksGrid.style.cssText = `
        max-height: 400px;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 15px;
        padding: 10px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        background: rgba(255,255,255,0.05);
    `;
    
    // Adicionar bancos
    connectors.forEach(connector => {
        const bankCard = document.createElement('div');
        bankCard.className = 'bank-card';
        bankCard.setAttribute('data-bank-name', connector.name.toLowerCase());
        bankCard.style.cssText = `
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        `;
        
        bankCard.innerHTML = `
            <div style="width: 50px; height: 50px; margin: 0 auto 10px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <img src="${connector.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='}" 
                     alt="${connector.name}" 
                     style="max-width: 40px; max-height: 40px; object-fit: contain;"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            </div>
            <div style="color: white; font-size: 12px; font-weight: 500;">${connector.name}</div>
        `;
        
        // Hover effects
        bankCard.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255,255,255,0.2)';
            this.style.borderColor = '#4CAF50';
            this.style.transform = 'translateY(-2px)';
        });
        
        bankCard.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.borderColor = 'transparent';
            this.style.transform = 'translateY(0)';
        });
        
        // Click handler
        bankCard.addEventListener('click', () => {
            connectToBank(connector);
        });
        
        banksGrid.appendChild(bankCard);
    });
    
    banksContainer.appendChild(banksGrid);
}

// Filtrar bancos
function filterBanks() {
    const filter = document.getElementById('bank-filter');
    const bankCards = document.querySelectorAll('.bank-card');
    
    if (!filter) return;
    
    const searchTerm = filter.value.toLowerCase();
    
    bankCards.forEach(card => {
        const bankName = card.getAttribute('data-bank-name');
        if (bankName.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Conectar com banco específico
async function connectToBank(connector) {
    try {
        console.log('🔄 Conectando com banco:', connector.name);
        
        // Mostrar formulário de credenciais
        showBankCredentialsForm(connector);
        
    } catch (error) {
        console.error('❌ Erro ao conectar com banco:', error);
        showOpenFinanceError('Erro ao conectar com ' + connector.name + ': ' + error.message);
    }
}

// Mostrar formulário de credenciais do banco
function showBankCredentialsForm(connector) {
    const modal = document.getElementById('openfinance-modal');
    if (!modal) return;
    
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div class="text-center mb-4">
            <h5 style="color: white;">Conectar com ${connector.name}</h5>
            <p style="color: #ccc; font-size: 14px;">Digite suas credenciais para conectar</p>
        </div>
        
        <form id="bank-credentials-form" onsubmit="submitBankCredentials(event, '${connector.id}')">
            <div class="mb-3">
                <label class="form-label" style="color: white;">Usuário/CPF:</label>
                <input type="text" class="form-control" id="bank-username" required 
                       placeholder="Digite seu usuário ou CPF" value="user-good">
            </div>
            
            <div class="mb-3">
                <label class="form-label" style="color: white;">Senha:</label>
                <input type="password" class="form-control" id="bank-password" required 
                       placeholder="Digite sua senha" value="pass_good">
            </div>
            
            <div class="alert alert-info" style="background: rgba(33, 150, 243, 0.1); border: 1px solid #2196F3; color: #2196F3;">
                <small>
                    <strong>Credenciais de teste:</strong><br>
                    Usuário: user-good<br>
                    Senha: pass_good
                </small>
            </div>
            
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary flex-fill" onclick="showBanksList()">
                    ← Voltar
                </button>
                <button type="submit" class="btn btn-success flex-fill">
                    Conectar
                </button>
            </div>
        </form>
    `;
}

// Submeter credenciais do banco
async function submitBankCredentials(event, connectorId) {
    event.preventDefault();
    
    const username = document.getElementById('bank-username').value;
    const password = document.getElementById('bank-password').value;
    
    if (!username || !password) {
        showOpenFinanceError('Por favor, preencha todos os campos');
        return;
    }
    
    try {
        console.log('🔄 Criando conexão com banco...');
        
        const credentials = {
            user: username,
            password: password
        };
        
        const connection = await window.pluggyManager.createConnection(connectorId, credentials);
        console.log('✅ Conexão criada:', connection);
        
        // Mostrar sucesso e carregar dados
        showConnectionSuccess(connection);
        
    } catch (error) {
        console.error('❌ Erro ao criar conexão:', error);
        showOpenFinanceError('Erro ao conectar: ' + error.message);
    }
}

// Mostrar sucesso da conexão
function showConnectionSuccess(connection) {
    const modal = document.getElementById('openfinance-modal');
    if (!modal) return;
    
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div class="text-center">
            <div style="font-size: 48px; color: #4CAF50; margin-bottom: 20px;">✅</div>
            <h5 style="color: white;">Conexão Realizada com Sucesso!</h5>
            <p style="color: #ccc;">Sua conta foi conectada ao Open Finance</p>
            
            <div class="alert alert-success" style="background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; color: #4CAF50;">
                <strong>Status:</strong> ${connection.status || 'Conectado'}<br>
                <strong>ID:</strong> ${connection.id}
            </div>
            
            <button class="btn btn-primary" onclick="loadAccountData('${connection.id}')">
                Ver Contas e Transações
            </button>
        </div>
    `;
}

// Voltar para lista de bancos
function showBanksList() {
    handleConnectPluggy();
}

// Carregar dados da conta
async function loadAccountData(connectionId) {
    try {
        console.log('🔄 Carregando dados da conta...');
        
        const accounts = await window.pluggyManager.getAccounts(connectionId);
        console.log('✅ Contas carregadas:', accounts);
        
        displayAccountData(accounts);
        
    } catch (error) {
        console.error('❌ Erro ao carregar contas:', error);
        showOpenFinanceError('Erro ao carregar dados: ' + error.message);
    }
}

// Exibir dados das contas
function displayAccountData(accounts) {
    const modal = document.getElementById('openfinance-modal');
    if (!modal) return;
    
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;
    
    let accountsHtml = `
        <div class="mb-3">
            <h5 style="color: white;">Suas Contas</h5>
            <p style="color: #ccc; font-size: 14px;">${accounts.length} conta(s) encontrada(s)</p>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto;">
    `;
    
    accounts.forEach(account => {
        accountsHtml += `
            <div class="card mb-3" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
                <div class="card-body">
                    <h6 style="color: white;">${account.name || 'Conta'}</h6>
                    <p style="color: #ccc; margin: 0;">
                        <strong>Tipo:</strong> ${account.type || 'N/A'}<br>
                        <strong>Saldo:</strong> ${window.pluggyManager ? window.pluggyManager.formatCurrency(account.balance || 0) : 'N/A'}
                    </p>
                    <button class="btn btn-sm btn-outline-light mt-2" onclick="loadTransactions('${account.id}')">
                        Ver Transações
                    </button>
                </div>
            </div>
        `;
    });
    
    accountsHtml += `
        </div>
        <button class="btn btn-secondary mt-3" onclick="showBanksList()">
            ← Voltar aos Bancos
        </button>
    `;
    
    modalBody.innerHTML = accountsHtml;
}

// Carregar transações
async function loadTransactions(accountId) {
    try {
        console.log('🔄 Carregando transações...');
        
        // Últimos 30 dias
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transactions = await window.pluggyManager.getTransactions(accountId, from, to);
        console.log('✅ Transações carregadas:', transactions);
        
        displayTransactions(transactions);
        
    } catch (error) {
        console.error('❌ Erro ao carregar transações:', error);
        showOpenFinanceError('Erro ao carregar transações: ' + error.message);
    }
}

// Exibir transações
function displayTransactions(transactions) {
    const modal = document.getElementById('openfinance-modal');
    if (!modal) return;
    
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;
    
    let transactionsHtml = `
        <div class="mb-3">
            <h5 style="color: white;">Transações</h5>
            <p style="color: #ccc; font-size: 14px;">${transactions.length} transação(ões) encontrada(s)</p>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto;">
    `;
    
    transactions.forEach(transaction => {
        const amount = transaction.amount || 0;
        const isPositive = amount > 0;
        const color = isPositive ? '#4CAF50' : '#f44336';
        
        transactionsHtml += `
            <div class="card mb-2" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div style="color: white; font-size: 14px;">${transaction.description || 'Transação'}</div>
                            <div style="color: #ccc; font-size: 12px;">${window.pluggyManager ? window.pluggyManager.formatDate(transaction.date) : transaction.date}</div>
                        </div>
                        <div style="color: ${color}; font-weight: bold;">
                            ${window.pluggyManager ? window.pluggyManager.formatCurrency(amount) : amount}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    transactionsHtml += `
        </div>
        <button class="btn btn-secondary mt-3" onclick="showBanksList()">
            ← Voltar aos Bancos
        </button>
    `;
    
    modalBody.innerHTML = transactionsHtml;
}

// Mostrar erro
function showOpenFinanceError(message) {
    const statusElement = document.getElementById('openfinance-status');
    if (statusElement) {
        statusElement.innerHTML = `<span style="color: #f44336;">❌ ${message}</span>`;
        statusElement.className = 'alert alert-danger';
    }
}

// Abrir modal do Open Finance
function openModal() {
    const modal = document.getElementById('openfinance-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Reset para estado inicial se não conectado
        if (!window.pluggyManager || !window.pluggyManager.isTokenValid()) {
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div id="openfinance-status" class="alert alert-warning">
                        <span style="color: #ff9800;">⚠️ Não conectado ao Open Finance</span>
                    </div>
                    
                    <div class="text-center">
                        <button id="connect-openfinance-btn" class="btn btn-success btn-lg" onclick="handleConnectPluggy()">
                            🏦 Conectar Open Finance
                        </button>
                    </div>
                    
                    <div id="banks-section" style="display: none;">
                        <h5 style="color: white; margin-top: 30px;">🏛️ Bancos Disponíveis</h5>
                        <div id="banks-container"></div>
                    </div>
                `;
            }
        }
    }
}

// Fechar modal
function closeModal() {
    const modal = document.getElementById('openfinance-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Tornar funções disponíveis globalmente
window.handleConnectPluggy = handleConnectPluggy;
window.openModal = openModal;
window.closeModal = closeModal;
window.filterBanks = filterBanks;
window.connectToBank = connectToBank;
window.submitBankCredentials = submitBankCredentials;
window.showBanksList = showBanksList;
window.loadAccountData = loadAccountData;
window.loadTransactions = loadTransactions;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    initializeOpenFinance();
});

console.log('✅ Open Finance Melhorado carregado!');

