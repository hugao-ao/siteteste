// Sistema de Gerenciamento de Propostas HVC - Versão Limpa

// Aguardar carregamento do Supabase
let supabaseClient = null;
let propostasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeApp, 1000);
});

function initializeApp() {
    // Verificar se o Supabase está disponível
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase;
        initializePropostasManager();
    } else {
        loadSupabaseFromCDN();
    }
}

function initializePropostasManager() {
    try {
        propostasManager = new PropostasManager();
        window.propostasManager = propostasManager;
        
        setTimeout(() => {
            if (!window.propostasManager) {
                window.propostasManager = propostasManager;
            }
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao inicializar PropostasManager:', error);
        setTimeout(() => {
            initializePropostasManager();
        }, 2000);
    }
}

function loadSupabaseFromCDN() {
    const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function() {
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            initializePropostasManager();
        }
    };
    script.onerror = function() {
        console.error('Erro ao carregar script do Supabase');
    };
    document.head.appendChild(script);
}

// Função para garantir formato numérico correto
function ensureNumericValue(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    
    if (typeof value === 'number' && !isNaN(value)) {
        return Math.round(value * 100) / 100;
    }
    
    let stringValue = String(value);
    stringValue = stringValue.replace(/[R$\s]/g, '');
    
    if (stringValue.includes('.') && stringValue.includes(',')) {
        stringValue = stringValue.replace(/\./g, '').replace(',', '.');
    } else if (stringValue.includes(',') && !stringValue.includes('.')) {
        stringValue = stringValue.replace(',', '.');
    }
    
    stringValue = stringValue.replace(/[^\d.]/g, '');
    const numericValue = parseFloat(stringValue);
    
    if (isNaN(numericValue)) {
        return 0;
    }
    
    return Math.round(numericValue * 100) / 100;
}

// Função de validação do tipo_prazo
function validateTipoPrazo(tipoPrazo) {
    const VALID_VALUES = ['corridos', 'uteis', 'cronograma'];
    
    if (!tipoPrazo || tipoPrazo === null || tipoPrazo === undefined || tipoPrazo === '') {
        return 'corridos';
    }
    
    let cleanValue = String(tipoPrazo).toLowerCase().trim();
    let finalValue;
    
    if (cleanValue === 'uteis' || cleanValue === 'úteis') {
        finalValue = 'uteis';
    } else if (cleanValue === 'cronograma' || 
               cleanValue === 'de acordo com cronograma da obra' ||
               cleanValue.includes('cronograma')) {
        finalValue = 'cronograma';
    } else if (cleanValue === 'corridos') {
        finalValue = 'corridos';
    } else {
        finalValue = 'corridos';
    }
    
    if (!VALID_VALUES.includes(finalValue)) {
        finalValue = 'corridos';
    }
    
    return finalValue;
}

// Obter tipo de prazo de forma segura
function getTipoPrazoSafe() {
    try {
        const element = document.getElementById('tipo-prazo');
        if (!element) {
            return 'corridos';
        }
        
        const rawValue = element.value;
        return validateTipoPrazo(rawValue);
    } catch (error) {
        return 'corridos';
    }
}

// Formatar tipo de prazo para exibição
function formatTipoPrazoDisplay(tipoPrazo, prazoExecucao) {
    const prazo = prazoExecucao || '';
    
    switch (tipoPrazo) {
        case 'corridos':
            return `${prazo} dias corridos`;
        case 'uteis':
            return `${prazo} dias úteis`;
        case 'cronograma':
            return 'De acordo com cronograma da obra';
        default:
            return `${prazo} dias corridos`;
    }
}

class PropostasManager {
    constructor() {
        this.currentPropostaId = null;
        this._servicosAdicionados = [];
        this._isEditMode = false;
        this.clientes = [];
        this.servicos = [];
        this.locais = [];
        this.propostas = [];
        
        this.init();
    }

    // Getter/Setter protegido para servicosAdicionados
    get servicosAdicionados() {
        return this._servicosAdicionados;
    }

    set servicosAdicionados(value) {
        if (this._isEditMode && Array.isArray(value) && value.length === 0 && this._servicosAdicionados.length > 0) {
            return; // Bloquear limpeza em modo edição
        }
        
        this._servicosAdicionados = Array.isArray(value) ? value : [];
    }

    clearServicosAdicionados() {
        this._isEditMode = false;
        this._servicosAdicionados = [];
    }

    addServicoToArray(servico) {
        this._servicosAdicionados.push(servico);
    }

    async init() {
        try {
            if (!supabaseClient) {
                this.showNotification('Erro: Conexão com banco de dados não disponível', 'error');
                return;
            }
            
            await this.loadClientes();
            await this.loadServicos();
            await this.loadLocais();
            await this.loadPropostas();
            this.setupEventListeners();
            this.setupMasks();
            this.addFilterControls();
            this.updateTableHeaders();
            
        } catch (error) {
            console.error('Erro ao inicializar PropostasManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    updateTableHeaders() {
        const tableHead = document.querySelector('#proposals-table thead tr');
        if (tableHead) {
            tableHead.innerHTML = `
                <th>Número</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Prazo</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
            `;
        }
    }

    addFilterControls() {
        const proposalsList = document.querySelector('.proposals-list');
        if (!proposalsList) return;

        const filterControls = document.createElement('div');
        filterControls.className = 'filter-controls';
        filterControls.style.cssText = `
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            border: 1px solid rgba(173, 216, 230, 0.2);
            flex-wrap: wrap;
        `;

        filterControls.innerHTML = `
            <div style="flex: 1; min-width: 200px;">
                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">
                    <i class="fas fa-search"></i> Buscar
                </label>
                <input type="text" 
                       id="filtro-busca" 
                       placeholder="Número, cliente..." 
                       class="form-input"
                       style="width: 100%;"
                       onkeyup="window.propostasManager.filtrarPropostas()">
            </div>
            
            <div style="min-width: 150px;">
                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">
                    <i class="fas fa-filter"></i> Status
                </label>
                <select id="filtro-status" 
                        class="form-select"
                        style="width: 100%;"
                        onchange="window.propostasManager.filtrarPropostas()">
                    <option value="">Todos</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Aprovada">Aprovada</option>
                    <option value="Recusada">Recusada</option>
                </select>
            </div>
            
            <div style="min-width: 150px;">
                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">
                    <i class="fas fa-user"></i> Cliente
                </label>
                <select id="filtro-cliente" 
                        class="form-select"
                        style="width: 100%;"
                        onchange="window.propostasManager.filtrarPropostas()">
                    <option value="">Todos</option>
                </select>
            </div>
            
            <div style="min-width: 120px;">
                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">
                    <i class="fas fa-calendar"></i> Período
                </label>
                <select id="filtro-periodo" 
                        class="form-select"
                        style="width: 100%;"
                        onchange="window.propostasManager.filtrarPropostas()">
                    <option value="">Todos</option>
                    <option value="hoje">Hoje</option>
                    <option value="semana">Esta Semana</option>
                    <option value="mes">Este Mês</option>
                    <option value="trimestre">Últimos 3 Meses</option>
                </select>
            </div>
            
            <div style="display: flex; align-items: end;">
                <button type="button" 
                        class="btn-secondary" 
                        onclick="window.propostasManager.limparFiltros()"
                        style="height: fit-content;">
                    <i class="fas fa-times"></i>
                    Limpar
                </button>
            </div>
        `;

        const tableContainer = proposalsList.querySelector('.form-title').nextElementSibling;
        proposalsList.insertBefore(filterControls, tableContainer);
    }

    populateClienteFilter() {
        const filtroCliente = document.getElementById('filtro-cliente');
        if (!filtroCliente) return;

        filtroCliente.innerHTML = '<option value="">Todos</option>';

        const clientesUnicos = [...new Set(this.propostas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        clientesUnicos.sort().forEach(nomeCliente => {
            const option = document.createElement('option');
            option.value = nomeCliente;
            option.textContent = nomeCliente;
            filtroCliente.appendChild(option);
        });
    }

    filtrarPropostas() {
        const busca = document.getElementById('filtro-busca')?.value.toLowerCase() || '';
        const status = document.getElementById('filtro-status')?.value || '';
        const cliente = document.getElementById('filtro-cliente')?.value || '';
        const periodo = document.getElementById('filtro-periodo')?.value || '';

        let propostasFiltradas = this.propostas.filter(proposta => {
            if (busca) {
                const textoBusca = `${proposta.numero_proposta} ${proposta.clientes_hvc?.nome || ''}`.toLowerCase();
                if (!textoBusca.includes(busca)) return false;
            }

            if (status && proposta.status !== status) return false;
            if (cliente && proposta.clientes_hvc?.nome !== cliente) return false;

            if (periodo) {
                const dataProposta = new Date(proposta.created_at);
                const hoje = new Date();
                
                switch (periodo) {
                    case 'hoje':
                        if (dataProposta.toDateString() !== hoje.toDateString()) return false;
                        break;
                    case 'semana':
                        const inicioSemana = new Date(hoje);
                        inicioSemana.setDate(hoje.getDate() - 7);
                        if (dataProposta < inicioSemana) return false;
                        break;
                    case 'mes':
                        const inicioMes = new Date(hoje);
                        inicioMes.setDate(hoje.getDate() - 30);
                        if (dataProposta < inicioMes) return false;
                        break;
                    case 'trimestre':
                        const inicioTrimestre = new Date(hoje);
                        inicioTrimestre.setDate(hoje.getDate() - 90);
                        if (dataProposta < inicioTrimestre) return false;
                        break;
                }
            }

            return true;
        });

        this.renderPropostas(propostasFiltradas);
    }

    limparFiltros() {
        document.getElementById('filtro-busca').value = '';
        document.getElementById('filtro-status').value = '';
        document.getElementById('filtro-cliente').value = '';
        document.getElementById('filtro-periodo').value = '';
        this.renderPropostas(this.propostas);
    }

    // === CLIENTES ===
    async loadClientes() {
        try {
            if (!supabaseClient) return;
            
            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .select('*')
                .order('nome');

            if (error) throw error;

            this.clientes = data || [];
            this.populateClienteSelect();
            
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            this.showNotification('Erro ao carregar clientes: ' + error.message, 'error');
        }
    }

    populateClienteSelect() {
        const select = document.getElementById('cliente-select');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um cliente...</option>';
        
        this.clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.nome;
            select.appendChild(option);
        });
    }

    showModalCliente() {
        const modal = document.getElementById('modal-cliente');
        if (modal) {
            modal.classList.add('show');
            const nomeInput = document.getElementById('cliente-nome');
            if (nomeInput) nomeInput.focus();
        }
    }

    hideModalCliente() {
        const modal = document.getElementById('modal-cliente');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('cliente-form');
            if (form) form.reset();
        }
    }

    async handleSubmitCliente(e) {
        e.preventDefault();
        
        try {
            const nome = document.getElementById('cliente-nome').value;
            const email = document.getElementById('cliente-email').value;
            const telefone = document.getElementById('cliente-telefone').value;
            const endereco = document.getElementById('cliente-endereco').value;
            
            if (!nome) {
                this.showNotification('Nome do cliente é obrigatório', 'error');
                return;
            }

            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .insert([{
                    nome: nome,
                    email: email,
                    telefone: telefone,
                    endereco: endereco
                }])
                .select()
                .single();

            if (error) throw error;

            this.hideModalCliente();
            await this.loadClientes();
            
            const clienteSelect = document.getElementById('cliente-select');
            if (clienteSelect) {
                clienteSelect.value = data.id;
            }
            
            this.showNotification('Cliente criado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            this.showNotification('Erro ao criar cliente: ' + error.message, 'error');
        }
    }

    // === LOCAIS ===
    async loadLocais() {
        try {
            if (!supabaseClient) return;
            
            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .select('*')
                .eq('ativo', true)
                .order('nome');

            if (error) throw error;

            this.locais = data || [];
            
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            this.showNotification('Erro ao carregar locais: ' + error.message, 'error');
        }
    }

    createLocalSelect(selectedLocalId = null) {
        const select = document.createElement('select');
        select.className = 'form-select local-select';
        select.style.width = '100%';
        
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Nenhum';
        select.appendChild(emptyOption);
        
        this.locais.forEach(local => {
            const option = document.createElement('option');
            option.value = local.id;
            option.textContent = local.nome;
            if (selectedLocalId && local.id === selectedLocalId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        return select;
    }

    showModalLocal() {
        const modal = document.getElementById('modal-local');
        if (modal) {
            modal.classList.add('show');
            const nomeInput = document.getElementById('local-nome');
            if (nomeInput) nomeInput.focus();
        }
    }

    hideModalLocal() {
        const modal = document.getElementById('modal-local');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('local-form');
            if (form) form.reset();
        }
    }

    async handleSubmitLocal(e) {
        e.preventDefault();
        
        try {
            const nome = document.getElementById('local-nome').value;
            const descricao = document.getElementById('local-descricao').value;
            
            if (!nome) {
                this.showNotification('Nome do local é obrigatório', 'error');
                return;
            }

            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .insert([{
                    nome: nome,
                    descricao: descricao,
                    ativo: true
                }])
                .select()
                .single();

            if (error) throw error;

            this.hideModalLocal();
            await this.loadLocais();
            this.forceUpdateServicesTable();
            
            this.showNotification('Local criado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao criar local:', error);
            this.showNotification('Erro ao criar local: ' + error.message, 'error');
        }
    }

    // === SERVIÇOS ===
    async loadServicos() {
        try {
            if (!supabaseClient) return;
            
            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .select('*')
                .order('codigo');

            if (error) throw error;

            this.servicos = data || [];
            
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }

    showModalServico() {
        const modal = document.getElementById('modal-servico');
        if (modal) {
            modal.classList.add('show');
            const codigoInput = document.getElementById('servico-codigo');
            if (codigoInput) codigoInput.focus();
        }
    }

    hideModalServico() {
        const modal = document.getElementById('modal-servico');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('servico-form');
            if (form) form.reset();
        }
    }

    async handleSubmitServico(e) {
        e.preventDefault();
        
        try {
            const codigo = document.getElementById('servico-codigo').value;
            const descricao = document.getElementById('servico-descricao').value;
            const detalhe = document.getElementById('servico-detalhe').value;
            const unidade = document.getElementById('servico-unidade').value;
            
            if (!codigo || !descricao || !unidade) {
                this.showNotification('Preencha todos os campos obrigatórios', 'error');
                return;
            }

            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .insert([{
                    codigo: codigo,
                    descricao: descricao,
                    detalhe: detalhe,
                    unidade: unidade
                }])
                .select()
                .single();

            if (error) throw error;

            this.hideModalServico();
            await this.loadServicos();
            this.showNotification('Serviço criado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao criar serviço:', error);
            this.showNotification('Erro ao criar serviço: ' + error.message, 'error');
        }
    }

    showModalSelecaoServicos() {
        const existingModal = document.querySelector('.modal-selection');
        if (existingModal) {
            existingModal.remove();
        }

        const servicosCheckboxes = this.servicos.map(servico => {
            return `
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid rgba(173, 216, 230, 0.1);">
                    <input type="checkbox" 
                           value="${servico.id}" 
                           id="servico-${servico.id}"
                           style="margin: 0;">
                    <label for="servico-${servico.id}" style="flex: 1; margin: 0; cursor: pointer;">
                        <strong>${servico.codigo}</strong> - ${servico.descricao}
                        <br><small style="color: #add8e6;">${servico.unidade}${servico.detalhe ? ' | ' + servico.detalhe : ''}</small>
                    </label>
                </div>
            `;
        }).join('');

        const modal = document.createElement('div');
        modal.className = 'modal modal-selection show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3 class="modal-title">Selecionar Serviços para a Proposta</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                    <div style="padding: 0 0 1rem 0;">
                        <input type="text" 
                               placeholder="Filtrar serviços..." 
                               class="form-input"
                               style="width: 100%; margin-bottom: 1rem;"
                               onkeyup="window.propostasManager.filtrarServicos(this.value)">
                        
                        <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
                            <button type="button" 
                                    class="btn-secondary" 
                                    onclick="window.propostasManager.selecionarTodosServicos()">
                                <i class="fas fa-check-double"></i>
                                Selecionar Todos
                            </button>
                            <button type="button" 
                                    class="btn-secondary" 
                                    onclick="window.propostasManager.limparSelecaoServicos()">
                                <i class="fas fa-times"></i>
                                Limpar
                            </button>
                        </div>
                        
                        <div id="contador-selecionados" style="color: #add8e6; font-weight: 600; margin-bottom: 1rem;">
                            0 serviços selecionados
                        </div>
                    </div>
                    
                    <div id="lista-servicos" style="flex: 1; overflow-y: auto; border: 1px solid rgba(173, 216, 230, 0.2); border-radius: 8px; padding: 1rem; background: rgba(0, 0, 0, 0.2);">
                        ${servicosCheckboxes}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="button" 
                            class="btn-info" 
                            onclick="window.propostasManager.showModalServicoFromSelection()" 
                            style="margin-right: 10px;">
                        <i class="fas fa-plus"></i>
                        Criar Novo Serviço
                    </button>
                    <button type="button" 
                            class="btn-success" 
                            onclick="window.propostasManager.addSelectedServicos()"
                            id="btn-adicionar-selecionados">
                        <i class="fas fa-plus-circle"></i>
                        Adicionar Selecionados
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            this.configurarEventosCheckboxes();
        }, 100);
    }

    configurarEventosCheckboxes() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.atualizarContadorSelecionados();
            });
        });
        this.atualizarContadorSelecionados();
    }

    atualizarContadorSelecionados() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]:checked');
        const contador = document.getElementById('contador-selecionados');
        const btnAdicionar = document.getElementById('btn-adicionar-selecionados');
        
        if (contador) {
            const quantidade = checkboxes.length;
            contador.textContent = `${quantidade} serviço${quantidade !== 1 ? 's' : ''} selecionado${quantidade !== 1 ? 's' : ''}`;
        }
        
        if (btnAdicionar) {
            btnAdicionar.disabled = checkboxes.length === 0;
            btnAdicionar.style.opacity = checkboxes.length === 0 ? '0.5' : '1';
        }
    }

    filtrarServicos(termo) {
        const servicosItems = document.querySelectorAll('#lista-servicos > div');
        const termoLower = termo.toLowerCase();
        
        servicosItems.forEach(item => {
            const texto = item.textContent.toLowerCase();
            if (texto.includes(termoLower)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    selecionarTodosServicos() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const item = checkbox.closest('div');
            if (item.style.display !== 'none' && !checkbox.disabled) {
                checkbox.checked = true;
            }
        });
        this.atualizarContadorSelecionados();
    }

    limparSelecaoServicos() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.disabled) {
                checkbox.checked = false;
            }
        });
        this.atualizarContadorSelecionados();
    }

    addSelectedServicos() {
        const checkboxesSelecionados = document.querySelectorAll('#lista-servicos input[type="checkbox"]:checked:not([disabled])');
        
        if (checkboxesSelecionados.length === 0) {
            this.showNotification('Selecione pelo menos um serviço', 'warning');
            return;
        }

        let servicosAdicionadosCount = 0;

        checkboxesSelecionados.forEach(checkbox => {
            const servicoId = checkbox.value;
            const servico = this.servicos.find(s => s.id === servicoId);
            
            if (!servico) return;

            this.addServicoToArray({
                servico_id: servicoId,
                servico: servico,
                quantidade: 1,
                preco_mao_obra: 0,
                preco_material: 0,
                preco_total: 0,
                local_id: null
            });

            servicosAdicionadosCount++;
        });

        this.forceUpdateServicesTable();
        
        const modal = document.querySelector('.modal-selection');
        if (modal) modal.remove();
        
        if (servicosAdicionadosCount > 0) {
            const mensagem = `${servicosAdicionadosCount} serviço${servicosAdicionadosCount > 1 ? 's' : ''} adicionado${servicosAdicionadosCount > 1 ? 's' : ''} à proposta!`;
            this.showNotification(mensagem, 'success');
        }
    }

    showModalServicoFromSelection() {
        const selectionModal = document.querySelector('.modal-selection');
        if (selectionModal) {
            selectionModal.remove();
        }
        
        this.showModalServico();
    }

    forceUpdateServicesTable() {
        const tbody = document.getElementById('services-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this._isEditMode && this.servicosAdicionados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ff6b6b;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        ⚠️ Erro: Dados dos serviços foram perdidos. Recarregue a página e tente novamente.
                    </td>
                </tr>
            `;
            return;
        }

        if (this.servicosAdicionados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhum serviço adicionado. Clique em "Adicionar Serviço" para começar.
                    </td>
                </tr>
            `;
            this.updateTotal();
            return;
        }

        this.servicosAdicionados.forEach((item, index) => {
            const row = document.createElement('tr');
            
            const localSelectContainer = document.createElement('td');
            const localSelect = this.createLocalSelect(item.local_id);
            localSelect.addEventListener('change', (e) => {
                this.updateServicoLocal(index, e.target.value);
            });
            localSelectContainer.appendChild(localSelect);
            
            const quantidade = parseFloat(item.quantidade) || 1;
            const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
            const precoMaterial = parseFloat(item.preco_material) || 0;
            const precoTotal = parseFloat(item.preco_total) || 0;
            
            row.innerHTML = `
                <td>
                    <strong>${item.servico.codigo}</strong><br>
                    <small>${item.servico.descricao}</small>
                </td>
                <td></td>
                <td>
                    <input type="number" 
                           value="${quantidade}" 
                           min="0.01" 
                           step="0.01"
                           onchange="window.propostasManager.updateServicoQuantidade(${index}, this.value)"
                           style="width: 80px;">
                </td>
                <td>${item.servico.unidade}</td>
                <td>
                    <input type="number" 
                           value="${precoMaoObra}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateServicoPrecoMaoObra(${index}, this.value)"
                           style="width: 100px;">
                </td>
                <td>
                    <input type="number" 
                           value="${precoMaterial}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateServicoPrecoMaterial(${index}, this.value)"
                           style="width: 100px;">
                </td>
                <td><strong>${this.formatMoney(precoTotal)}</strong></td>
                <td>
                    <button class="btn-danger" onclick="window.propostasManager.removeServico(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            row.children[1].replaceWith(localSelectContainer);
            tbody.appendChild(row);
        });

        this.updateTotal();
    }

    updateServicesTable() {
        this.forceUpdateServicesTable();
    }

    updateServicoLocal(index, localId) {
        const item = this.servicosAdicionados[index];
        if (item) {
            item.local_id = localId || null;
        }
    }

    updateServicoQuantidade(index, quantidade) {
        const item = this.servicosAdicionados[index];
        if (item) {
            item.quantidade = ensureNumericValue(quantidade);
            item.preco_total = ensureNumericValue(item.quantidade * (item.preco_mao_obra + item.preco_material));
            this.forceUpdateServicesTable();
        }
    }

    updateServicoPrecoMaoObra(index, preco) {
        const item = this.servicosAdicionados[index];
        if (item) {
            item.preco_mao_obra = ensureNumericValue(preco);
            item.preco_total = ensureNumericValue(item.quantidade * (item.preco_mao_obra + item.preco_material));
            this.forceUpdateServicesTable();
        }
    }

    updateServicoPrecoMaterial(index, preco) {
        const item = this.servicosAdicionados[index];
        if (item) {
            item.preco_material = ensureNumericValue(preco);
            item.preco_total = ensureNumericValue(item.quantidade * (item.preco_mao_obra + item.preco_material));
            this.forceUpdateServicesTable();
        }
    }

    removeServico(index) {
        this.servicosAdicionados.splice(index, 1);
        this.forceUpdateServicesTable();
    }

    updateTotal() {
        const total = this.servicosAdicionados.reduce((sum, item) => {
            return sum + ensureNumericValue(item.preco_total);
        }, 0);

        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            totalElement.textContent = this.formatMoney(total);
        }
    }

    // === FORMULÁRIO ===
    showFormProposta() {
        const form = document.getElementById('form-proposta');
        const list = document.getElementById('proposals-list');
        
        if (form && list) {
            form.classList.remove('hidden');
            list.style.display = 'none';
            
            if (!this._isEditMode) {
                this.clearForm();
            }
            
            const titleElement = document.getElementById('form-title-text');
            if (titleElement) {
                titleElement.textContent = this._isEditMode ? 'Editar Proposta' : 'Nova Proposta';
            }
        }
    }

    hideFormProposta() {
        const form = document.getElementById('form-proposta');
        const list = document.getElementById('proposals-list');
        
        if (form && list) {
            form.classList.add('hidden');
            list.style.display = 'block';
            this.clearForm();
        }
    }

    clearForm() {
        const form = document.getElementById('proposta-form');
        if (form) {
            form.reset();
        }
        
        this.clearServicosAdicionados();
        this.forceUpdateServicesTable();
        this.currentPropostaId = null;
    }

    async saveProposta() {
        try {
            if (!this.validateForm()) return;

            const numeroProposta = document.getElementById('numero-proposta').value;
            const clienteId = document.getElementById('cliente-select').value;
            const status = document.getElementById('status-select').value;
            const prazoExecucao = parseInt(document.getElementById('prazo-execucao').value);
            const tipoPrazo = getTipoPrazoSafe();
            const formaPagamento = document.getElementById('forma-pagamento').value;
            const observacoes = document.getElementById('observacoes').value;

            const totalProposta = this.servicosAdicionados.reduce((sum, item) => {
                return sum + ensureNumericValue(item.preco_total);
            }, 0);

            const propostaData = {
                numero_proposta: numeroProposta,
                cliente_id: clienteId,
                status: status,
                prazo_execucao: prazoExecucao,
                tipo_prazo: tipoPrazo,
                forma_pagamento: formaPagamento,
                observacoes: observacoes,
                total_proposta: ensureNumericValue(totalProposta)
            };

            let proposta;
            
            if (this.currentPropostaId) {
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .update(propostaData)
                    .eq('id', this.currentPropostaId)
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
                
            } else {
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert([propostaData])
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
            }

            await this.saveItensProposta(proposta.id);
            this.hideFormProposta();
            await this.loadPropostas();
            
            this.showNotification('Proposta salva com sucesso!', 'success');

        } catch (error) {
            console.error('Erro no salvamento:', error);
            this.showNotification('Erro ao salvar proposta: ' + error.message, 'error');
        }
    }

    async saveItensProposta(propostaId) {
        await supabaseClient
            .from('itens_proposta_hvc')
            .delete()
            .eq('proposta_id', propostaId);

        const itens = this.servicosAdicionados.map((item) => {
            const quantidade = ensureNumericValue(item.quantidade);
            const precoMaoObra = ensureNumericValue(item.preco_mao_obra);
            const precoMaterial = ensureNumericValue(item.preco_material);
            const precoTotal = ensureNumericValue(quantidade * (precoMaoObra + precoMaterial));
            
            return {
                proposta_id: propostaId,
                servico_id: item.servico_id,
                quantidade: quantidade,
                preco_mao_obra: precoMaoObra,
                preco_material: precoMaterial,
                preco_total: precoTotal,
                local_id: item.local_id || null
            };
        });

        if (itens.length > 0) {
            const { error } = await supabaseClient
                .from('itens_proposta_hvc')
                .insert(itens);

            if (error) throw error;
        }
    }

    validateForm() {
        const numeroProposta = document.getElementById('numero-proposta').value;
        const clienteId = document.getElementById('cliente-select').value;
        
        if (!numeroProposta || !numeroProposta.match(/^\d{4}\/\d{4}$/)) {
            this.showNotification('Número da proposta deve estar no formato XXXX/YYYY', 'error');
            return false;
        }

        if (!clienteId) {
            this.showNotification('Selecione um cliente', 'error');
            return false;
        }

        if (this.servicosAdicionados.length === 0) {
            this.showNotification('Adicione pelo menos um serviço', 'error');
            return false;
        }

        for (let item of this.servicosAdicionados) {
            if (item.quantidade <= 0) {
                this.showNotification('Todos os serviços devem ter quantidade maior que zero', 'error');
                return false;
            }
            if (item.preco_mao_obra <= 0 && item.preco_material <= 0) {
                this.showNotification('Todos os serviços devem ter pelo menos um preço (mão de obra ou material)', 'error');
                return false;
            }
        }

        return true;
    }

    // === LISTA DE PROPOSTAS ===
    async loadPropostas() {
        try {
            if (!supabaseClient) return;
            
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.propostas = data || [];
            this.renderPropostas(this.propostas);
            this.populateClienteFilter();
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    renderPropostas(propostas) {
        const tbody = document.getElementById('proposals-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (propostas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-file-contract" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma proposta encontrada. Clique em "Nova Proposta" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        propostas.forEach(proposta => {
            const row = document.createElement('tr');
            
            let prazoTexto = '-';
            if (proposta.prazo_execucao) {
                prazoTexto = formatTipoPrazoDisplay(proposta.tipo_prazo, proposta.prazo_execucao);
            }

            const editButtonOnclick = `onclick="window.propostasManager.editProposta('${proposta.id}')"`;
            
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td><strong>${this.formatMoney(proposta.total_proposta || 0)}</strong></td>
                <td>${prazoTexto}</td>
                <td>${proposta.forma_pagamento || '-'}</td>
                <td><span class="status-badge status-${proposta.status.toLowerCase()}">${proposta.status}</span></td>
                <td>${new Date(proposta.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions-cell">
                    <button class="btn-secondary" ${editButtonOnclick} title="Editar proposta">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="window.propostasManager.deleteProposta('${proposta.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async editProposta(propostaId) {
        try {
            this._isEditMode = true;
            
            const { data: proposta, error: propostaError } = await supabaseClient
                .from('propostas_hvc')
                .select('*')
                .eq('id', propostaId)
                .single();

            if (propostaError) throw propostaError;

            const { data: itens, error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (*)
                `)
                .eq('proposta_id', propostaId);

            if (itensError) throw itensError;

            this.currentPropostaId = propostaId;
            this._servicosAdicionados = [];
            
            if (itens && Array.isArray(itens) && itens.length > 0) {
                itens.forEach((item) => {
                    if (item.servicos_hvc) {
                        const servicoProcessado = {
                            servico_id: item.servico_id,
                            servico: item.servicos_hvc,
                            quantidade: parseFloat(item.quantidade) || 0,
                            preco_mao_obra: parseFloat(item.preco_mao_obra) || 0,
                            preco_material: parseFloat(item.preco_material) || 0,
                            preco_total: parseFloat(item.preco_total) || 0,
                            local_id: item.local_id || null
                        };
                        
                        this._servicosAdicionados.push(servicoProcessado);
                    }
                });
            }

            document.getElementById('numero-proposta').value = proposta.numero_proposta || '';
            document.getElementById('cliente-select').value = proposta.cliente_id || '';
            document.getElementById('status-select').value = proposta.status || 'Pendente';
            document.getElementById('prazo-execucao').value = proposta.prazo_execucao || '';
            document.getElementById('tipo-prazo').value = proposta.tipo_prazo || 'corridos';
            document.getElementById('forma-pagamento').value = proposta.forma_pagamento || '';
            document.getElementById('observacoes').value = proposta.observacoes || '';

            this.showFormProposta();

            this.forceUpdateServicesTable();
            
            setTimeout(() => {
                this.forceUpdateServicesTable();
                
                setTimeout(() => {
                    this.forceUpdateServicesTable();
                    
                    setTimeout(() => {
                        const tbody = document.getElementById('services-tbody');
                        const rows = tbody ? tbody.querySelectorAll('tr') : [];
                        
                        if (this._servicosAdicionados.length > 0 && (rows.length === 0 || (rows.length === 1 && rows[0].textContent.includes('Nenhum serviço')))) {
                            this.forceUpdateServicesTable();
                        }
                    }, 500);
                }, 500);
            }, 100);

            this.showNotification('Proposta carregada para edição!', 'success');

        } catch (error) {
            console.error('Erro ao carregar proposta:', error);
            this._isEditMode = false;
            this.showNotification('Erro ao carregar proposta: ' + error.message, 'error');
        }
    }

    async deleteProposta(propostaId) {
        if (!confirm('Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await supabaseClient
                .from('itens_proposta_hvc')
                .delete()
                .eq('proposta_id', propostaId);

            const { error } = await supabaseClient
                .from('propostas_hvc')
                .delete()
                .eq('id', propostaId);

            if (error) throw error;

            await this.loadPropostas();
            this.showNotification('Proposta excluída com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao excluir proposta:', error);
            this.showNotification('Erro ao excluir proposta: ' + error.message, 'error');
        }
    }

    // === EVENT LISTENERS ===
    setupEventListeners() {
        try {
            const btnNovaProposta = document.getElementById('btn-nova-proposta');
            if (btnNovaProposta) {
                btnNovaProposta.addEventListener('click', () => this.showFormProposta());
            }

            const btnCancelar = document.getElementById('btn-cancelar');
            if (btnCancelar) {
                btnCancelar.addEventListener('click', () => this.hideFormProposta());
            }

            const propostaForm = document.getElementById('proposta-form');
            if (propostaForm) {
                propostaForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveProposta();
                });
            }

            const btnAddServico = document.getElementById('btn-add-servico');
            if (btnAddServico) {
                btnAddServico.addEventListener('click', () => this.showModalSelecaoServicos());
            }

            const btnAddCliente = document.getElementById('btn-add-cliente');
            if (btnAddCliente) {
                btnAddCliente.addEventListener('click', () => this.showModalCliente());
            }
            
            // Modais - Serviço
            const closeModalServico = document.getElementById('close-modal-servico');
            const cancelServico = document.getElementById('cancel-servico');
            const servicoForm = document.getElementById('servico-form');
            
            if (closeModalServico) {
                closeModalServico.addEventListener('click', () => this.hideModalServico());
            }
            if (cancelServico) {
                cancelServico.addEventListener('click', () => this.hideModalServico());
            }
            if (servicoForm) {
                servicoForm.addEventListener('submit', (e) => this.handleSubmitServico(e));
            }
            
            // Modais - Cliente
            const closeModalCliente = document.getElementById('close-modal-cliente');
            const cancelCliente = document.getElementById('cancel-cliente');
            const clienteForm = document.getElementById('cliente-form');
            
            if (closeModalCliente) {
                closeModalCliente.addEventListener('click', () => this.hideModalCliente());
            }
            if (cancelCliente) {
                cancelCliente.addEventListener('click', () => this.hideModalCliente());
            }
            if (clienteForm) {
                clienteForm.addEventListener('submit', (e) => this.handleSubmitCliente(e));
            }

            // Modais - Local
            const closeModalLocal = document.getElementById('close-modal-local');
            const cancelLocal = document.getElementById('cancel-local');
            const localForm = document.getElementById('local-form');
            
            if (closeModalLocal) {
                closeModalLocal.addEventListener('click', () => this.hideModalLocal());
            }
            if (cancelLocal) {
                cancelLocal.addEventListener('click', () => this.hideModalLocal());
            }
            if (localForm) {
                localForm.addEventListener('submit', (e) => this.handleSubmitLocal(e));
            }
            
            // Fechar modal clicando fora
            const modalServico = document.getElementById('modal-servico');
            const modalCliente = document.getElementById('modal-cliente');
            const modalLocal = document.getElementById('modal-local');
            
            if (modalServico) {
                modalServico.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-servico') this.hideModalServico();
                });
            }
            if (modalCliente) {
                modalCliente.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-cliente') this.hideModalCliente();
                });
            }
            if (modalLocal) {
                modalLocal.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-local') this.hideModalLocal();
                });
            }
            
        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    setupMasks() {
        const numeroInput = document.getElementById('numero-proposta');
        if (numeroInput) {
            numeroInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 4) {
                    value = value.substring(0, 4) + '/' + value.substring(4, 8);
                }
                e.target.value = value;
            });
        }
    }

    formatMoney(value) {
        const numericValue = parseFloat(value) || 0;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numericValue);
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                    max-width: 400px;
                }
                .notification-success { background: linear-gradient(135deg, #28a745, #20c997); }
                .notification-error { background: linear-gradient(135deg, #dc3545, #e74c3c); }
                .notification-warning { background: linear-gradient(135deg, #ffc107, #f39c12); }
                .notification-info { background: linear-gradient(135deg, #17a2b8, #3498db); }
                .notification-content { display: flex; align-items: center; gap: 10px; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}
