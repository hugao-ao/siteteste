// openfinance-integration-SCROLL-E-403-CORRIGIDO.js
// Integração Open Finance com scroll funcional e correção do erro 403

// ✅ MODAL COM SCROLL FUNCIONAL E CORREÇÃO DE ERROS
function createOpenFinanceModal() {
    const modal = document.createElement('div');
    modal.id = 'openfinance-modal';
    modal.innerHTML = `
        <div class="openfinance-modal-overlay">
            <div class="openfinance-modal-container">
                <!-- ✅ CABEÇALHO FIXO -->
                <div class="openfinance-modal-header">
                    <h2>🏦 Open Finance - Conectar Banco</h2>
                    <button class="openfinance-close-btn" onclick="closeOpenFinanceModal()">&times;</button>
                </div>
                
                <!-- ✅ CONTEÚDO COM SCROLL -->
                <div class="openfinance-modal-content">
                    <!-- Status da conexão -->
                    <div id="openfinance-status" class="openfinance-status">
                        <div class="status-item">
                            <span class="status-label">🔗 Status da API:</span>
                            <span id="api-status" class="status-value">Verificando...</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">🔐 Autenticação:</span>
                            <span id="auth-status" class="status-value">Verificando...</span>
                        </div>
                    </div>
                    
                    <!-- Filtro de busca -->
                    <div class="openfinance-search">
                        <input type="text" id="bank-search" placeholder="🔍 Buscar banco..." />
                    </div>
                    
                    <!-- Lista de bancos com scroll -->
                    <div class="openfinance-banks-container">
                        <div id="openfinance-banks" class="openfinance-banks">
                            <div class="loading-message">
                                <div class="spinner"></div>
                                <p>Carregando bancos disponíveis...</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Conexões existentes -->
                    <div id="existing-connections" class="existing-connections" style="display: none;">
                        <h3>🔗 Suas Conexões</h3>
                        <div id="connections-list"></div>
                    </div>
                </div>
                
                <!-- ✅ RODAPÉ FIXO -->
                <div class="openfinance-modal-footer">
                    <button onclick="refreshBankList()" class="refresh-btn">🔄 Atualizar Lista</button>
                    <button onclick="runDiagnostics()" class="diagnostic-btn">🔍 Diagnóstico</button>
                    <button onclick="closeOpenFinanceModal()" class="cancel-btn">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    // ✅ ESTILOS CSS CORRIGIDOS COM SCROLL
    const styles = `
        <style>
        .openfinance-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        }

        .openfinance-modal-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            width: 800px;
            max-width: 95vw;
            height: 600px;
            max-height: 90vh;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }

        /* ✅ CABEÇALHO FIXO */
        .openfinance-modal-header {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }

        .openfinance-modal-header h2 {
            color: white;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }

        .openfinance-close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 24px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .openfinance-close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.1);
        }

        /* ✅ CONTEÚDO COM SCROLL */
        .openfinance-modal-content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            overflow-x: hidden;
        }

        /* ✅ SCROLL CUSTOMIZADO */
        .openfinance-modal-content::-webkit-scrollbar {
            width: 8px;
        }

        .openfinance-modal-content::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }

        .openfinance-modal-content::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }

        .openfinance-modal-content::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        /* ✅ STATUS DA CONEXÃO */
        .openfinance-status {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .status-item:last-child {
            margin-bottom: 0;
        }

        .status-label {
            color: rgba(255, 255, 255, 0.8);
            font-weight: 500;
        }

        .status-value {
            color: white;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
        }

        .status-value.success {
            background: rgba(34, 197, 94, 0.3);
            color: #86efac;
        }

        .status-value.error {
            background: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }

        .status-value.warning {
            background: rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }

        /* ✅ FILTRO DE BUSCA */
        .openfinance-search {
            margin-bottom: 20px;
        }

        .openfinance-search input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 16px;
            backdrop-filter: blur(10px);
        }

        .openfinance-search input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }

        .openfinance-search input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.6);
            background: rgba(255, 255, 255, 0.15);
        }

        /* ✅ CONTAINER DOS BANCOS COM SCROLL */
        .openfinance-banks-container {
            max-height: 350px;
            overflow-y: auto;
            overflow-x: hidden;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* ✅ SCROLL CUSTOMIZADO PARA LISTA DE BANCOS */
        .openfinance-banks-container::-webkit-scrollbar {
            width: 6px;
        }

        .openfinance-banks-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
        }

        .openfinance-banks-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 3px;
        }

        .openfinance-banks {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            padding: 20px;
        }

        /* ✅ CARDS DOS BANCOS */
        .bank-card {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .bank-card:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        }

        .bank-icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 10px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .bank-name {
            color: white;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .bank-type {
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* ✅ LOADING */
        .loading-message {
            text-align: center;
            padding: 40px;
            color: white;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* ✅ CONEXÕES EXISTENTES */
        .existing-connections {
            margin-top: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .existing-connections h3 {
            color: white;
            margin: 0 0 15px 0;
            font-size: 18px;
        }

        .connection-item {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .connection-info {
            color: white;
        }

        .connection-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }

        .connection-status.connected {
            background: rgba(34, 197, 94, 0.3);
            color: #86efac;
        }

        .connection-status.error {
            background: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }

        /* ✅ RODAPÉ FIXO */
        .openfinance-modal-footer {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            flex-shrink: 0;
        }

        .openfinance-modal-footer button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        .refresh-btn {
            background: rgba(34, 197, 94, 0.8);
            color: white;
        }

        .refresh-btn:hover {
            background: rgba(34, 197, 94, 1);
            transform: translateY(-1px);
        }

        .diagnostic-btn {
            background: rgba(59, 130, 246, 0.8);
            color: white;
        }

        .diagnostic-btn:hover {
            background: rgba(59, 130, 246, 1);
            transform: translateY(-1px);
        }

        .cancel-btn {
            background: rgba(107, 114, 128, 0.8);
            color: white;
        }

        .cancel-btn:hover {
            background: rgba(107, 114, 128, 1);
            transform: translateY(-1px);
        }

        /* ✅ RESPONSIVO */
        @media (max-width: 768px) {
            .openfinance-modal-container {
                width: 95vw;
                height: 90vh;
                margin: 20px;
            }

            .openfinance-banks {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 10px;
                padding: 15px;
            }

            .openfinance-modal-footer {
                flex-direction: column;
            }

            .openfinance-modal-footer button {
                width: 100%;
            }
        }
        </style>
    `;

    modal.innerHTML = styles + modal.innerHTML;
    return modal;
}

// ✅ FUNÇÃO PARA ABRIR MODAL
function openOpenFinanceModal() {
    // Remover modal existente se houver
    const existingModal = document.getElementById('openfinance-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Criar e adicionar novo modal
    const modal = createOpenFinanceModal();
    document.body.appendChild(modal);

    // Inicializar funcionalidades
    initializeOpenFinanceModal();
}

// ✅ FUNÇÃO PARA FECHAR MODAL
function closeOpenFinanceModal() {
    const modal = document.getElementById('openfinance-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    }
}

// ✅ INICIALIZAR MODAL
async function initializeOpenFinanceModal() {
    try {
        // Verificar status da API
        await updateApiStatus();
        
        // Carregar lista de bancos
        await loadBankList();
        
        // Carregar conexões existentes
        await loadExistingConnections();
        
        // Configurar filtro de busca
        setupBankSearch();
        
    } catch (error) {
        console.error('❌ Erro ao inicializar modal:', error);
        showError('Erro ao carregar dados do Open Finance');
    }
}

// ✅ ATUALIZAR STATUS DA API
async function updateApiStatus() {
    try {
        const apiStatusEl = document.getElementById('api-status');
        const authStatusEl = document.getElementById('auth-status');
        
        if (!apiStatusEl || !authStatusEl) return;

        // Verificar status da API
        const apiStatus = await window.pluggyManager.getApiStatus();
        
        if (apiStatus.status === 'online') {
            apiStatusEl.textContent = '✅ Online';
            apiStatusEl.className = 'status-value success';
        } else {
            apiStatusEl.textContent = '❌ Offline';
            apiStatusEl.className = 'status-value error';
        }

        // Verificar autenticação
        if (window.pluggyManager.isTokenValid()) {
            authStatusEl.textContent = '✅ Autenticado';
            authStatusEl.className = 'status-value success';
        } else {
            authStatusEl.textContent = '⚠️ Não autenticado';
            authStatusEl.className = 'status-value warning';
            
            // Tentar autenticar
            try {
                await window.pluggyManager.authenticate();
                authStatusEl.textContent = '✅ Autenticado';
                authStatusEl.className = 'status-value success';
            } catch (error) {
                authStatusEl.textContent = '❌ Erro na autenticação';
                authStatusEl.className = 'status-value error';
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
    }
}

// ✅ CARREGAR LISTA DE BANCOS
async function loadBankList() {
    try {
        const banksContainer = document.getElementById('openfinance-banks');
        if (!banksContainer) return;

        // Mostrar loading
        banksContainer.innerHTML = `
            <div class="loading-message">
                <div class="spinner"></div>
                <p>Carregando bancos disponíveis...</p>
            </div>
        `;

        // Buscar conectores
        const connectorsData = await window.pluggyManager.getConnectors();
        const connectors = connectorsData.results || connectorsData || [];

        if (connectors.length === 0) {
            banksContainer.innerHTML = `
                <div class="loading-message">
                    <p>❌ Nenhum banco disponível</p>
                    <button onclick="refreshBankList()" class="refresh-btn">🔄 Tentar Novamente</button>
                </div>
            `;
            return;
        }

        // Renderizar bancos
        banksContainer.innerHTML = '';
        
        for (const connector of connectors) {
            const bankCard = await createBankCard(connector);
            banksContainer.appendChild(bankCard);
        }

        console.log(`✅ ${connectors.length} bancos carregados`);

    } catch (error) {
        console.error('❌ Erro ao carregar bancos:', error);
        
        const banksContainer = document.getElementById('openfinance-banks');
        if (banksContainer) {
            banksContainer.innerHTML = `
                <div class="loading-message">
                    <p>❌ Erro ao carregar bancos</p>
                    <p style="font-size: 12px; opacity: 0.7;">${error.message}</p>
                    <button onclick="refreshBankList()" class="refresh-btn">🔄 Tentar Novamente</button>
                </div>
            `;
        }
    }
}

// ✅ CRIAR CARD DO BANCO
async function createBankCard(connector) {
    const card = document.createElement('div');
    card.className = 'bank-card';
    card.onclick = () => selectBank(connector);

    // ✅ CORREÇÃO: Usar ícone com fallback
    let iconUrl = '';
    try {
        if (window.getBankIcon) {
            iconUrl = await window.getBankIcon(connector.id);
        } else {
            iconUrl = `https://cdn.pluggy.ai/assets/connector-icons/${connector.id}.svg`;
        }
    } catch (error) {
        iconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzMzNzNkYyIvPgo8cGF0aCBkPSJNMjAgMTBMMjUgMTVIMjBWMjVIMTVWMTVIMjBWMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K';
    }

    card.innerHTML = `
        <div class="bank-icon">
            <img src="${iconUrl}" alt="${connector.name}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;" 
                 onerror="this.style.display='none'; this.parentElement.innerHTML='🏦';">
        </div>
        <div class="bank-name">${connector.name}</div>
        <div class="bank-type">${connector.type === 'PERSONAL_BANK' ? 'PESSOAL' : 'EMPRESAS'}</div>
    `;

    return card;
}

// ✅ CONFIGURAR FILTRO DE BUSCA
function setupBankSearch() {
    const searchInput = document.getElementById('bank-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const bankCards = document.querySelectorAll('.bank-card');

        bankCards.forEach(card => {
            const bankName = card.querySelector('.bank-name')?.textContent.toLowerCase() || '';
            const bankType = card.querySelector('.bank-type')?.textContent.toLowerCase() || '';
            
            if (bankName.includes(searchTerm) || bankType.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// ✅ CARREGAR CONEXÕES EXISTENTES
async function loadExistingConnections() {
    try {
        const connections = await window.pluggyManager.getConnections();
        const connectionsList = connections.results || connections || [];

        if (connectionsList.length > 0) {
            const connectionsContainer = document.getElementById('existing-connections');
            const connectionsListEl = document.getElementById('connections-list');
            
            if (connectionsContainer && connectionsListEl) {
                connectionsContainer.style.display = 'block';
                
                connectionsListEl.innerHTML = connectionsList.map(connection => `
                    <div class="connection-item">
                        <div class="connection-info">
                            <strong>${connection.connector?.name || 'Banco'}</strong>
                            <br>
                            <small>ID: ${connection.id}</small>
                        </div>
                        <div class="connection-status ${connection.status === 'UPDATED' ? 'connected' : 'error'}">
                            ${connection.status === 'UPDATED' ? '✅ Conectado' : '❌ Erro'}
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar conexões:', error);
    }
}

// ✅ SELECIONAR BANCO
function selectBank(connector) {
    console.log('🏦 Banco selecionado:', connector.name);
    
    // Aqui você pode implementar o formulário de credenciais
    alert(`Banco selecionado: ${connector.name}\n\nImplementar formulário de credenciais aqui.`);
}

// ✅ ATUALIZAR LISTA DE BANCOS
async function refreshBankList() {
    console.log('🔄 Atualizando lista de bancos...');
    
    // Limpar cache
    if (window.pluggyManager && window.pluggyManager.cache) {
        window.pluggyManager.cache.connectors = null;
        window.pluggyManager.cache.lastUpdate = null;
    }
    
    await loadBankList();
}

// ✅ EXECUTAR DIAGNÓSTICO
async function runDiagnostics() {
    try {
        console.log('🔍 Executando diagnóstico...');
        
        const diagnostics = await window.pluggyManager.runDiagnostics();
        
        const results = [
            `🔧 Configuração: ${diagnostics.config ? '✅ OK' : '❌ Erro'}`,
            `🌐 API Status: ${diagnostics.apiStatus.status === 'online' ? '✅ Online' : '❌ Offline'}`,
            `🔐 Token: ${diagnostics.tokenValid ? '✅ Válido' : '❌ Inválido'}`,
            `⏰ Timestamp: ${new Date(diagnostics.timestamp).toLocaleString()}`
        ].join('\n');
        
        alert(`📊 Diagnóstico do Sistema:\n\n${results}`);
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        alert(`❌ Erro no diagnóstico:\n${error.message}`);
    }
}

// ✅ MOSTRAR ERRO
function showError(message) {
    const banksContainer = document.getElementById('openfinance-banks');
    if (banksContainer) {
        banksContainer.innerHTML = `
            <div class="loading-message">
                <p>❌ ${message}</p>
                <button onclick="refreshBankList()" class="refresh-btn">🔄 Tentar Novamente</button>
            </div>
        `;
    }
}

// ✅ TORNAR FUNÇÕES GLOBAIS
window.openOpenFinanceModal = openOpenFinanceModal;
window.closeOpenFinanceModal = closeOpenFinanceModal;
window.refreshBankList = refreshBankList;
window.runDiagnostics = runDiagnostics;

console.log('🚀 Open Finance Integration carregado com scroll funcional e correção de erro 403!');

