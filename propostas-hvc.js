// propostas-hvc.js - Versão FINAL COM TOTAL DEFINITIVAMENTE CORRETO
// Gerenciamento de Propostas HVC

// Aguardar carregamento do Supabase
let supabaseClient = null;
let propostasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando aplicação...');
    // Aguardar um pouco para o Supabase carregar
    setTimeout(initializeApp, 1000);
});

function initializeApp() {
    console.log('Inicializando aplicação...');
    
    // Verificar se o Supabase está disponível
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase;
        console.log('Supabase conectado com sucesso!');
    } else {
        console.log('Supabase não encontrado, carregando via CDN...');
        loadSupabaseFromCDN();
        return;
    }
    
    // Inicializar o gerenciador de propostas
    propostasManager = new PropostasManager();
    
    // Expor globalmente para uso nos event handlers inline
    window.propostasManager = propostasManager;
}

function loadSupabaseFromCDN() {
    // Criar cliente Supabase diretamente
    const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";
    
    // Carregar Supabase via script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = function() {
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase carregado via CDN!');
            propostasManager = new PropostasManager();
            window.propostasManager = propostasManager;
        } else {
            console.error('Erro ao carregar Supabase via CDN');
        }
    };
    script.onerror = function() {
        console.error('Erro ao carregar script do Supabase');
    };
    document.head.appendChild(script);
}

class PropostasManager {
    constructor() {
        this.currentPropostaId = null;
        this.servicosAdicionados = [];
        this.clientes = [];
        this.servicos = [];
        this.propostas = []; // Armazenar propostas para filtros
        
        this.init();
    }

    async init() {
        console.log('Inicializando PropostasManager...');
        
        try {
            await this.loadClientes();
            await this.loadServicos();
            await this.loadPropostas();
            this.setupEventListeners();
            this.setupMasks();
            this.addFilterControls(); // Adicionar controles de filtro
            this.updateTableHeaders(); // Atualizar cabeçalhos da tabela
            console.log('PropostasManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar PropostasManager:', error);
        }
    }

    // === ATUALIZAR CABEÇALHOS DA TABELA ===
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
                <th>Observações</th>
                <th>Data</th>
                <th>Ações</th>
            `;
        }
    }

    // === NOVA FUNCIONALIDADE: FILTROS ===
    addFilterControls() {
        const proposalsList = document.querySelector('.proposals-list');
        if (!proposalsList) return;

        // Criar controles de filtro
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

        // Inserir antes da tabela
        const tableContainer = proposalsList.querySelector('.form-title').nextElementSibling;
        proposalsList.insertBefore(filterControls, tableContainer);
    }

    populateClienteFilter() {
        const filtroCliente = document.getElementById('filtro-cliente');
        if (!filtroCliente) return;

        // Limpar opções existentes (exceto "Todos")
        filtroCliente.innerHTML = '<option value="">Todos</option>';

        // Adicionar clientes únicos das propostas
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

        let propostasFiltradas = [...this.propostas];

        // Filtro de busca (número ou cliente)
        if (busca) {
            propostasFiltradas = propostasFiltradas.filter(proposta => 
                proposta.numero_proposta.toLowerCase().includes(busca) ||
                (proposta.clientes_hvc?.nome || '').toLowerCase().includes(busca)
            );
        }

        // Filtro de status
        if (status) {
            propostasFiltradas = propostasFiltradas.filter(proposta => 
                proposta.status === status
            );
        }

        // Filtro de cliente
        if (cliente) {
            propostasFiltradas = propostasFiltradas.filter(proposta => 
                proposta.clientes_hvc?.nome === cliente
            );
        }

        // Filtro de período
        if (periodo) {
            const agora = new Date();
            const dataFiltro = new Date();

            switch (periodo) {
                case 'hoje':
                    dataFiltro.setHours(0, 0, 0, 0);
                    break;
                case 'semana':
                    dataFiltro.setDate(agora.getDate() - 7);
                    break;
                case 'mes':
                    dataFiltro.setMonth(agora.getMonth() - 1);
                    break;
                case 'trimestre':
                    dataFiltro.setMonth(agora.getMonth() - 3);
                    break;
            }

            propostasFiltradas = propostasFiltradas.filter(proposta => 
                new Date(proposta.created_at) >= dataFiltro
            );
        }

        this.renderPropostas(propostasFiltradas);
        this.updateFilterStats(propostasFiltradas.length, this.propostas.length);
    }

    updateFilterStats(filtradas, total) {
        // Atualizar título com estatísticas
        const formTitle = document.querySelector('.proposals-list .form-title');
        if (formTitle) {
            const statsText = filtradas === total ? 
                `Lista de Propostas (${total})` : 
                `Lista de Propostas (${filtradas} de ${total})`;
            formTitle.innerHTML = `<i class="fas fa-list"></i> ${statsText}`;
        }
    }

    limparFiltros() {
        document.getElementById('filtro-busca').value = '';
        document.getElementById('filtro-status').value = '';
        document.getElementById('filtro-cliente').value = '';
        document.getElementById('filtro-periodo').value = '';
        this.filtrarPropostas();
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        try {
            // Botões principais
            const btnNovaProposta = document.getElementById('btn-nova-proposta');
            const btnCancelar = document.getElementById('btn-cancelar');
            
            if (btnNovaProposta) {
                btnNovaProposta.addEventListener('click', () => {
                    console.log('Botão Nova Proposta clicado');
                    this.showFormProposta();
                });
            }
            if (btnCancelar) {
                btnCancelar.addEventListener('click', () => this.hideFormProposta());
            }
            
            // Formulário de proposta
            const propostaForm = document.getElementById('proposta-form');
            if (propostaForm) {
                propostaForm.addEventListener('submit', (e) => this.handleSubmitProposta(e));
            }
            
            // Botões de adicionar
            const btnAddCliente = document.getElementById('btn-add-cliente');
            const btnAddServico = document.getElementById('btn-add-servico');
            
            if (btnAddCliente) {
                btnAddCliente.addEventListener('click', () => this.showModalCliente());
            }
            if (btnAddServico) {
                btnAddServico.addEventListener('click', () => {
                    console.log('Botão Adicionar Serviço clicado - abrindo modal de SELEÇÃO MÚLTIPLA');
                    this.addServicoToProposta(); // Abrir modal de seleção múltipla
                });
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
            
            // Fechar modal clicando fora
            const modalServico = document.getElementById('modal-servico');
            const modalCliente = document.getElementById('modal-cliente');
            
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
            
            console.log('Event listeners configurados!');
        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    setupMasks() {
        // Máscara para número da proposta (XXXX/YYYY)
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
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    parseMoney(value) {
        return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }

    // === CLIENTES ===
    async loadClientes() {
        try {
            console.log('Carregando clientes...');
            
            if (!supabaseClient) {
                console.error('Supabase client não disponível');
                return;
            }
            
            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .select('*')
                .order('nome');

            if (error) {
                console.error('Erro na query de clientes:', error);
                throw error;
            }

            this.clientes = data || [];
            this.populateClienteSelect();
            console.log('Clientes carregados:', this.clientes.length);
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
        
        const clienteData = {
            nome: document.getElementById('cliente-nome').value,
            documento: document.getElementById('cliente-documento').value,
            tipo_documento: document.getElementById('cliente-tipo-documento').value
        };

        try {
            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .insert([clienteData])
                .select()
                .single();

            if (error) throw error;

            this.clientes.push(data);
            this.populateClienteSelect();
            
            // Selecionar o cliente recém-criado
            const select = document.getElementById('cliente-select');
            if (select) select.value = data.id;
            
            this.hideModalCliente();
            this.showNotification('Cliente adicionado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao adicionar cliente:', error);
            this.showNotification('Erro ao adicionar cliente: ' + error.message, 'error');
        }
    }

    // === SERVIÇOS ===
    async loadServicos() {
        try {
            console.log('Carregando serviços...');
            
            if (!supabaseClient) {
                console.error('Supabase client não disponível');
                return;
            }
            
            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .select('*')
                .order('codigo');

            if (error) {
                console.error('Erro na query de serviços:', error);
                throw error;
            }

            this.servicos = data || [];
            console.log('Serviços carregados:', this.servicos.length);
            
            // Log dos serviços para debug
            this.servicos.forEach(servico => {
                console.log('Serviço:', servico.codigo, '-', servico.descricao);
            });
            
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }

    showModalServico() {
        console.log('Abrindo modal para criar novo serviço...');
        const modal = document.getElementById('modal-servico');
        if (modal) {
            modal.classList.add('show');
            const codigoInput = document.getElementById('servico-codigo');
            if (codigoInput) codigoInput.focus();
            console.log('Modal de serviço aberto com sucesso');
        } else {
            console.error('Modal de serviço não encontrado no DOM');
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
        
        console.log('Salvando novo serviço...');
        
        const servicoData = {
            codigo: document.getElementById('servico-codigo').value,
            descricao: document.getElementById('servico-descricao').value,
            detalhe: document.getElementById('servico-detalhe').value,
            unidade: document.getElementById('servico-unidade').value
        };

        console.log('Dados do serviço:', servicoData);

        try {
            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .insert([servicoData])
                .select()
                .single();

            if (error) throw error;

            console.log('Serviço criado:', data);
            this.servicos.push(data);
            this.hideModalServico();
            this.showNotification('Serviço criado com sucesso! Agora você pode selecioná-lo.', 'success');
            
            // Reabrir modal de seleção após criar o serviço
            setTimeout(() => {
                this.addServicoToProposta();
            }, 1000);
        } catch (error) {
            console.error('Erro ao adicionar serviço:', error);
            this.showNotification('Erro ao adicionar serviço: ' + error.message, 'error');
        }
    }

    // === PROPOSTAS ===
    showFormProposta(proposta = null) {
        console.log('Mostrando formulário de proposta...');
        
        this.currentPropostaId = proposta?.id || null;
        
        const formSection = document.getElementById('form-proposta');
        const titleText = document.getElementById('form-title-text');
        
        if (formSection) {
            if (proposta) {
                if (titleText) titleText.textContent = 'Editar Proposta';
                this.populateForm(proposta);
            } else {
                if (titleText) titleText.textContent = 'Nova Proposta';
                this.clearForm();
            }
            
            formSection.classList.remove('hidden');
            formSection.scrollIntoView({ behavior: 'smooth' });
            console.log('Formulário exibido');
        } else {
            console.error('Elemento form-proposta não encontrado');
        }
    }

    hideFormProposta() {
        const formSection = document.getElementById('form-proposta');
        if (formSection) {
            formSection.classList.add('hidden');
        }
        this.clearForm();
        this.currentPropostaId = null;
    }

    clearForm() {
        const form = document.getElementById('proposta-form');
        if (form) form.reset();
        
        // Reabilitar todos os campos (caso tenham sido desabilitados)
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
            input.disabled = false;
            input.style.opacity = '';
            input.style.cursor = '';
            input.title = '';
        });
        
        // Restaurar texto do botão salvar
        const btnSalvar = document.querySelector('button[type="submit"]');
        if (btnSalvar) {
            btnSalvar.textContent = 'Salvar Proposta';
        }
        
        this.servicosAdicionados = [];
        this.updateServicesTable();
        this.updateTotal();
    }

    populateForm(proposta) {
        const numeroInput = document.getElementById('numero-proposta');
        const clienteSelect = document.getElementById('cliente-select');
        const statusSelect = document.getElementById('status-select');
        const observacoesTextarea = document.getElementById('observacoes');
        const prazoInput = document.getElementById('prazo-execucao');
        const tipoPrazoSelect = document.getElementById('tipo-prazo');
        const formaPagamentoInput = document.getElementById('forma-pagamento');
        
        if (numeroInput) numeroInput.value = proposta.numero_proposta;
        if (clienteSelect) clienteSelect.value = proposta.cliente_id;
        if (statusSelect) statusSelect.value = proposta.status;
        if (observacoesTextarea) observacoesTextarea.value = proposta.observacoes || '';
        if (prazoInput) prazoInput.value = proposta.prazo_execucao || '';
        if (tipoPrazoSelect) tipoPrazoSelect.value = proposta.tipo_prazo || 'corridos';
        if (formaPagamentoInput) formaPagamentoInput.value = proposta.forma_pagamento || '';
        
        // PROTEÇÃO: Desabilitar campos se proposta estiver aprovada
        const isAprovada = proposta.status === 'Aprovada';
        if (isAprovada) {
            // Desabilitar todos os campos do formulário
            if (numeroInput) numeroInput.disabled = true;
            if (clienteSelect) clienteSelect.disabled = true;
            if (statusSelect) statusSelect.disabled = true;
            if (observacoesTextarea) observacoesTextarea.disabled = true;
            if (prazoInput) prazoInput.disabled = true;
            if (tipoPrazoSelect) tipoPrazoSelect.disabled = true;
            if (formaPagamentoInput) formaPagamentoInput.disabled = true;
            
            // Desabilitar botões de adicionar serviços
            const btnAddServico = document.getElementById('btn-add-servico');
            if (btnAddServico) {
                btnAddServico.disabled = true;
                btnAddServico.style.opacity = '0.5';
                btnAddServico.style.cursor = 'not-allowed';
                btnAddServico.title = 'Proposta aprovada não pode ser editada';
            }
            
            // Desabilitar botão de salvar
            const btnSalvar = document.querySelector('button[type="submit"]');
            if (btnSalvar) {
                btnSalvar.disabled = true;
                btnSalvar.style.opacity = '0.5';
                btnSalvar.style.cursor = 'not-allowed';
                btnSalvar.textContent = 'Proposta Aprovada - Não Editável';
            }
            
            this.showNotification('Esta proposta está aprovada e não pode ser editada.', 'info');
        }
        
        // Carregar itens da proposta
        this.loadItensProposta(proposta.id);
    }

    async loadItensProposta(propostaId) {
        try {
            const { data, error } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (*)
                `)
                .eq('proposta_id', propostaId);

            if (error) throw error;

            this.servicosAdicionados = data.map(item => ({
                servico_id: item.servico_id,
                servico: item.servicos_hvc,
                quantidade: item.quantidade,
                preco_mao_obra: item.preco_mao_obra,
                preco_material: item.preco_material,
                preco_total: item.preco_total
            }));

            this.updateServicesTable();
            this.updateTotal();
        } catch (error) {
            console.error('Erro ao carregar itens da proposta:', error);
        }
    }

    addServicoToProposta() {
        console.log('Adicionando serviço à proposta...');
        console.log('Serviços disponíveis:', this.servicos.length);
        
        if (this.servicos.length === 0) {
            this.showNotification('Nenhum serviço encontrado. Adicione serviços primeiro.', 'warning');
            return;
        }
        
        this.showServicoSelectionModal();
    }

    // === NOVA FUNCIONALIDADE: SELEÇÃO MÚLTIPLA ===
    showServicoSelectionModal() {
        console.log('Mostrando modal de seleção MÚLTIPLA de serviços...');
        console.log('Serviços disponíveis:', this.servicos.length);
        
        // Remover modal existente se houver
        const existingModal = document.querySelector('.modal-selection');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Verificar se há serviços carregados
        if (!this.servicos || this.servicos.length === 0) {
            this.showNotification('Nenhum serviço encontrado. Verifique se há serviços cadastrados no banco de dados.', 'error');
            return;
        }
        
        // Filtrar serviços que já foram adicionados
        const servicosDisponiveis = this.servicos.filter(servico => 
            !this.servicosAdicionados.find(s => s.servico_id === servico.id)
        );
        
        if (servicosDisponiveis.length === 0) {
            this.showNotification('Todos os serviços disponíveis já foram adicionados à proposta.', 'info');
            return;
        }
        
        // Criar lista de serviços com checkboxes
        let servicosCheckboxes = '';
        servicosDisponiveis.forEach(servico => {
            if (servico && servico.id && servico.codigo && servico.descricao) {
                servicosCheckboxes += `
                    <div style="display: flex; align-items: center; padding: 8px; border: 1px solid rgba(173, 216, 230, 0.2); border-radius: 6px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.05);">
                        <input type="checkbox" 
                               id="servico-${servico.id}" 
                               value="${servico.id}" 
                               style="margin-right: 12px; transform: scale(1.2);">
                        <label for="servico-${servico.id}" style="flex: 1; cursor: pointer; color: #e0e0e0;">
                            <strong>${servico.codigo}</strong> - ${servico.descricao}
                            ${servico.unidade ? `<br><small style="color: #add8e6;">Unidade: ${servico.unidade}</small>` : ''}
                        </label>
                    </div>
                `;
            }
        });
        
        // Criar modal dinâmico para seleção múltipla
        const modal = document.createElement('div');
        modal.className = 'modal modal-selection show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-tasks"></i>
                        Selecionar Serviços (Múltipla Seleção)
                    </h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
                        <input type="text" 
                               id="filtro-servicos" 
                               placeholder="Buscar serviços..." 
                               class="form-input" 
                               style="flex: 1;"
                               onkeyup="window.propostasManager.filtrarServicos(this.value)">
                        <button type="button" 
                                class="btn-info" 
                                onclick="window.propostasManager.selecionarTodosServicos()">
                            <i class="fas fa-check-double"></i>
                            Todos
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
                
                <div id="lista-servicos" style="max-height: 300px; overflow-y: auto; border: 1px solid rgba(173, 216, 230, 0.2); border-radius: 8px; padding: 1rem; background: rgba(0, 0, 0, 0.2);">
                    ${servicosCheckboxes}
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
        
        // Configurar eventos para os checkboxes
        setTimeout(() => {
            this.configurarEventosCheckboxes();
        }, 100);
        
        console.log('Modal de seleção múltipla criado!');
    }

    // NOVA FUNÇÃO: Configurar eventos dos checkboxes
    configurarEventosCheckboxes() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.atualizarContadorSelecionados();
            });
        });
        this.atualizarContadorSelecionados();
    }

    // NOVA FUNÇÃO: Atualizar contador de selecionados
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

    // NOVA FUNÇÃO: Filtrar serviços
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

    // NOVA FUNÇÃO: Selecionar todos os serviços visíveis
    selecionarTodosServicos() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const item = checkbox.closest('div');
            if (item.style.display !== 'none') {
                checkbox.checked = true;
            }
        });
        this.atualizarContadorSelecionados();
    }

    // NOVA FUNÇÃO: Limpar seleção
    limparSelecaoServicos() {
        const checkboxes = document.querySelectorAll('#lista-servicos input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.atualizarContadorSelecionados();
    }

    // NOVA FUNÇÃO: Adicionar múltiplos serviços selecionados
    addSelectedServicos() {
        console.log('Adicionando múltiplos serviços selecionados...');
        
        const checkboxesSelecionados = document.querySelectorAll('#lista-servicos input[type="checkbox"]:checked');
        
        if (checkboxesSelecionados.length === 0) {
            this.showNotification('Selecione pelo menos um serviço', 'warning');
            return;
        }

        let servicosAdicionadosCount = 0;
        let servicosJaExistentes = 0;

        checkboxesSelecionados.forEach(checkbox => {
            const servicoId = checkbox.value;
            const servico = this.servicos.find(s => s.id === servicoId);
            
            if (!servico) {
                console.error('Serviço não encontrado:', servicoId);
                return;
            }

            // Verificar se já foi adicionado (dupla verificação)
            if (this.servicosAdicionados.find(s => s.servico_id === servicoId)) {
                servicosJaExistentes++;
                return;
            }

            // Adicionar serviço à lista
            this.servicosAdicionados.push({
                servico_id: servicoId,
                servico: servico,
                quantidade: 1,
                preco_mao_obra: 0,
                preco_material: 0,
                preco_total: 0
            });

            servicosAdicionadosCount++;
            console.log('Serviço adicionado:', servico.codigo);
        });

        // Atualizar tabela
        this.updateServicesTable();
        
        // Fechar modal
        const modal = document.querySelector('.modal-selection');
        if (modal) modal.remove();
        
        // Mostrar notificação de sucesso
        let mensagem = '';
        if (servicosAdicionadosCount > 0) {
            mensagem = `${servicosAdicionadosCount} serviço${servicosAdicionadosCount > 1 ? 's' : ''} adicionado${servicosAdicionadosCount > 1 ? 's' : ''} à proposta!`;
        }
        if (servicosJaExistentes > 0) {
            mensagem += ` ${servicosJaExistentes} serviço${servicosJaExistentes > 1 ? 's já estavam' : ' já estava'} na proposta.`;
        }
        
        this.showNotification(mensagem, 'success');
    }

    // FUNÇÃO MODIFICADA: Manter compatibilidade
    addSelectedServico() {
        // Esta função agora chama a nova função de múltiplos serviços
        this.addSelectedServicos();
    }

    showModalServicoFromSelection() {
        console.log('Abrindo modal de criação de serviço a partir da seleção...');
        
        // Fechar modal de seleção
        const selectionModal = document.querySelector('.modal-selection');
        if (selectionModal) {
            selectionModal.remove();
        }
        
        // Abrir modal de criação de serviço
        this.showModalServico();
    }

    updateServicesTable() {
        const tbody = document.getElementById('services-tbody');
        if (!tbody) {
            console.error('Tbody de serviços não encontrado');
            return;
        }
        
        tbody.innerHTML = '';

        if (this.servicosAdicionados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhum serviço adicionado. Clique em "Adicionar Serviço" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        this.servicosAdicionados.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${item.servico.codigo}</strong><br>
                    <small>${item.servico.descricao}</small>
                </td>
                <td>
                    <input type="number" 
                           value="${item.quantidade}" 
                           min="0" 
                           step="0.001"
                           onchange="window.propostasManager.updateItemQuantidade(${index}, this.value)"
                           style="width: 80px;">
                </td>
                <td>${item.servico.unidade || '-'}</td>
                <td>
                    <input type="number" 
                           value="${item.preco_mao_obra}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemPrecoMaoObra(${index}, this.value)"
                           style="width: 100px;">
                </td>
                <td>
                    <input type="number" 
                           value="${item.preco_material}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemPrecoMaterial(${index}, this.value)"
                           style="width: 100px;">
                </td>
                <td>
                    <strong>${this.formatMoney(item.preco_total)}</strong>
                </td>
                <td>
                    <button type="button" 
                            class="btn-danger" 
                            onclick="window.propostasManager.removeServico(${index})"
                            title="Remover serviço">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateItemQuantidade(index, quantidade) {
        if (this.servicosAdicionados[index]) {
            // CORREÇÃO: Garantir que seja um número válido
            this.servicosAdicionados[index].quantidade = parseFloat(quantidade) || 0;
            this.calculateItemTotal(index);
        }
    }

    updateItemPrecoMaoObra(index, preco) {
        if (this.servicosAdicionados[index]) {
            // CORREÇÃO: Garantir que seja um número válido
            this.servicosAdicionados[index].preco_mao_obra = parseFloat(preco) || 0;
            this.calculateItemTotal(index);
        }
    }

    updateItemPrecoMaterial(index, preco) {
        if (this.servicosAdicionados[index]) {
            // CORREÇÃO: Garantir que seja um número válido
            this.servicosAdicionados[index].preco_material = parseFloat(preco) || 0;
            this.calculateItemTotal(index);
        }
    }

    calculateItemTotal(index) {
        const item = this.servicosAdicionados[index];
        if (item) {
            // LOGS DETALHADOS - ANTES DO CÁLCULO
            console.log(`🔍 === CÁLCULO ITEM ${index} - ANTES ===`);
            console.log('Item original:', item);
            console.log('Quantidade (raw):', item.quantidade, typeof item.quantidade);
            console.log('Mão de obra (raw):', item.preco_mao_obra, typeof item.preco_mao_obra);
            console.log('Material (raw):', item.preco_material, typeof item.preco_material);
            
            // CORREÇÃO CRÍTICA: Garantir que todos os valores sejam números válidos
            const quantidade = parseFloat(item.quantidade) || 0;
            const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
            const precoMaterial = parseFloat(item.preco_material) || 0;
            
            // LOGS DETALHADOS - APÓS CONVERSÃO
            console.log('Quantidade (convertida):', quantidade, typeof quantidade);
            console.log('Mão de obra (convertida):', precoMaoObra, typeof precoMaoObra);
            console.log('Material (convertida):', precoMaterial, typeof precoMaterial);
            
            // Cálculo: Total = Quantidade × (Mão de Obra + Material)
            const somaPrecos = precoMaoObra + precoMaterial;
            const totalCalculado = quantidade * somaPrecos;
            
            console.log('Soma preços (MO + Material):', somaPrecos);
            console.log('Cálculo final:', `${quantidade} × ${somaPrecos} = ${totalCalculado}`);
            
            item.preco_total = totalCalculado;
            
            console.log('Total do item salvo:', item.preco_total, typeof item.preco_total);
            console.log(`✅ === FIM CÁLCULO ITEM ${index} ===\n`);
            
            this.updateServicesTable();
            this.updateTotal();
        }
    }

    removeServico(index) {
        if (confirm('Tem certeza que deseja remover este serviço?')) {
            this.servicosAdicionados.splice(index, 1);
            this.updateServicesTable();
            this.updateTotal();
        }
    }

    updateTotal() {
        console.log('\n🧮 === CÁLCULO DO TOTAL GERAL - INÍCIO ===');
        
        // CORREÇÃO CRÍTICA: Garantir que o total seja calculado corretamente
        let total = 0;
        
        console.log('Número de serviços adicionados:', this.servicosAdicionados.length);
        
        this.servicosAdicionados.forEach((item, index) => {
            console.log(`\n📋 Item ${index}:`);
            console.log('  - Objeto completo:', item);
            console.log('  - preco_total (raw):', item.preco_total, typeof item.preco_total);
            
            const itemTotal = parseFloat(item.preco_total) || 0;
            console.log('  - preco_total (convertido):', itemTotal, typeof itemTotal);
            
            total += itemTotal;
            console.log('  - Total acumulado até agora:', total);
        });
        
        console.log('\n💰 RESULTADO FINAL:');
        console.log('Total calculado (número):', total, typeof total);
        console.log('Total formatado:', this.formatMoney(total));
        
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            const textoFormatado = this.formatMoney(total);
            totalElement.textContent = textoFormatado;
            console.log('Texto inserido no elemento:', textoFormatado);
        } else {
            console.error('❌ Elemento total-proposta não encontrado!');
        }
        
        console.log('✅ === FIM CÁLCULO DO TOTAL GERAL ===\n');
    }

    // === FUNÇÃO PARA OBTER TOTAL ATUAL ===
    getCurrentTotal() {
        console.log('\n🔄 === getCurrentTotal() - INÍCIO ===');
        
        let total = 0;
        
        console.log('Recalculando total a partir dos serviços...');
        console.log('Número de serviços:', this.servicosAdicionados.length);
        
        this.servicosAdicionados.forEach((item, index) => {
            console.log(`\n🔢 Recálculo Item ${index}:`);
            console.log('  - Item completo:', item);
            
            const quantidade = parseFloat(item.quantidade) || 0;
            const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
            const precoMaterial = parseFloat(item.preco_material) || 0;
            
            console.log('  - Quantidade:', quantidade, typeof quantidade);
            console.log('  - Mão de obra:', precoMaoObra, typeof precoMaoObra);
            console.log('  - Material:', precoMaterial, typeof precoMaterial);
            
            const itemTotal = quantidade * (precoMaoObra + precoMaterial);
            console.log('  - Cálculo:', `${quantidade} × (${precoMaoObra} + ${precoMaterial}) = ${itemTotal}`);
            
            total += itemTotal;
            console.log('  - Total acumulado:', total);
        });
        
        console.log('\n🎯 RESULTADO getCurrentTotal():');
        console.log('Total final:', total, typeof total);
        console.log('✅ === FIM getCurrentTotal() ===\n');
        
        return total;
    }

    async handleSubmitProposta(e) {
        e.preventDefault();

        console.log('\n💾 === SALVAMENTO DA PROPOSTA - INÍCIO ===');

        if (!this.validateForm()) {
            console.log('❌ Validação falhou, cancelando salvamento');
            return;
        }

        // CORREÇÃO CRÍTICA: Usar função dedicada para obter o total atual
        const totalCalculado = this.getCurrentTotal();

        // Verificar o valor exibido na tela
        const totalElement = document.getElementById('total-proposta');
        const totalExibido = totalElement ? totalElement.textContent : 'N/A';
        
        console.log('\n📊 COMPARAÇÃO DE VALORES:');
        console.log('Total calculado (getCurrentTotal):', totalCalculado, typeof totalCalculado);
        console.log('Total exibido na tela (verde):', totalExibido);
        
        // Tentar extrair valor numérico do texto exibido
        let valorNumericoTela = 0;
        if (totalExibido && totalExibido !== 'N/A') {
            const numeroLimpo = totalExibido.replace(/[^\d,.-]/g, '').replace(',', '.');
            valorNumericoTela = parseFloat(numeroLimpo) || 0;
            console.log('Valor numérico extraído da tela:', valorNumericoTela, typeof valorNumericoTela);
        }

        // CORREÇÃO: Salvar valor normal (sem dividir por 100)
        const totalParaSalvar = totalCalculado;

        console.log('\n🎯 DECISÃO DE SALVAMENTO:');
        console.log('Total que será salvo no banco:', totalParaSalvar, typeof totalParaSalvar);
        console.log('Diferença entre calculado e tela:', Math.abs(totalCalculado - valorNumericoTela));

        const propostaData = {
            numero_proposta: document.getElementById('numero-proposta').value,
            cliente_id: document.getElementById('cliente-select').value,
            status: document.getElementById('status-select').value,
            observacoes: document.getElementById('observacoes').value || null,
            prazo_execucao: parseInt(document.getElementById('prazo-execucao')?.value) || null,
            tipo_prazo: document.getElementById('tipo-prazo')?.value || 'corridos',
            forma_pagamento: document.getElementById('forma-pagamento')?.value || null,
            total_proposta: totalParaSalvar // CORREÇÃO: Usar total verificado
        };

        console.log('\n📋 DADOS COMPLETOS PARA SALVAR:');
        console.log('Objeto proposta:', propostaData);
        console.log('Campo total_proposta especificamente:', propostaData.total_proposta, typeof propostaData.total_proposta);

        try {
            let proposta;
            
            if (this.currentPropostaId) {
                console.log('\n🔄 ATUALIZANDO proposta existente...');
                console.log('ID da proposta:', this.currentPropostaId);
                
                // Atualizar proposta existente
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .update(propostaData)
                    .eq('id', this.currentPropostaId)
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Erro ao atualizar proposta:', error);
                    throw error;
                }
                
                proposta = data;
                console.log('✅ Proposta atualizada com sucesso:', proposta);
                console.log('Total salvo no banco:', proposta.total_proposta, typeof proposta.total_proposta);
            } else {
                console.log('\n➕ CRIANDO nova proposta...');
                
                // Criar nova proposta
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert([propostaData])
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Erro ao criar proposta:', error);
                    throw error;
                }
                
                proposta = data;
                console.log('✅ Nova proposta criada com sucesso:', proposta);
                console.log('Total salvo no banco:', proposta.total_proposta, typeof proposta.total_proposta);
            }

            console.log('\n📦 Salvando itens da proposta...');
            // Salvar itens da proposta
            await this.saveItensProposta(proposta.id);

            console.log('\n🎉 SALVAMENTO CONCLUÍDO COM SUCESSO!');
            console.log('✅ === FIM SALVAMENTO DA PROPOSTA ===\n');

            this.hideFormProposta();
            this.loadPropostas();
            this.showNotification('Proposta salva com sucesso!', 'success');

        } catch (error) {
            console.error('\n❌ === ERRO NO SALVAMENTO ===');
            console.error('Erro completo:', error);
            console.error('Mensagem:', error.message);
            console.error('================================\n');
            this.showNotification('Erro ao salvar proposta: ' + error.message, 'error');
        }
    }

    async saveItensProposta(propostaId) {
        // Remover itens existentes
        await supabaseClient
            .from('itens_proposta_hvc')
            .delete()
            .eq('proposta_id', propostaId);

        // Inserir novos itens com valores normais (sem dividir por 100)
        const itens = this.servicosAdicionados.map(item => {
            const quantidade = parseFloat(item.quantidade) || 0;
            const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
            const precoMaterial = parseFloat(item.preco_material) || 0;
            const precoTotal = quantidade * (precoMaoObra + precoMaterial);
            
            return {
                proposta_id: propostaId,
                servico_id: item.servico_id,
                quantidade: quantidade,
                preco_mao_obra: precoMaoObra,
                preco_material: precoMaterial,
                preco_total: precoTotal
            };
        });

        console.log('=== ITENS PARA SALVAR ===');
        console.log('Itens:', itens);
        console.log('========================');

        if (itens.length > 0) {
            const { error } = await supabaseClient
                .from('itens_proposta_hvc')
                .insert(itens);

            if (error) throw error;
            console.log('Itens salvos com sucesso');
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

        // Validar se todos os serviços têm quantidade e preço
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

    // === LISTA DE PROPOSTAS CORRIGIDA ===
    async loadPropostas() {
        try {
            console.log('Carregando propostas...');
            
            if (!supabaseClient) {
                console.error('Supabase client não disponível');
                return;
            }
            
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.propostas = data || []; // Armazenar para filtros
            this.renderPropostas(this.propostas);
            this.populateClienteFilter(); // Atualizar filtro de clientes
            console.log('Propostas carregadas:', this.propostas.length);
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
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-file-contract" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma proposta encontrada. Clique em "Nova Proposta" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        propostas.forEach(proposta => {
            const row = document.createElement('tr');
            
            // Formatar prazo
            let prazoTexto = '-';
            if (proposta.prazo_execucao) {
                const tipoPrazo = proposta.tipo_prazo === 'uteis' ? 'úteis' : 'corridos';
                prazoTexto = `${proposta.prazo_execucao} dias ${tipoPrazo}`;
            }

            // Formatar observações (truncar se muito longo)
            let observacoesTexto = proposta.observacoes || '-';
            if (observacoesTexto.length > 50) {
                observacoesTexto = observacoesTexto.substring(0, 50) + '...';
            }
            
            // Verificar se proposta está aprovada para desabilitar edição
            const isAprovada = proposta.status === 'Aprovada';
            const editButtonClass = isAprovada ? 'btn-secondary disabled' : 'btn-secondary';
            const editButtonStyle = isAprovada ? 'opacity: 0.5; cursor: not-allowed;' : '';
            const editButtonTitle = isAprovada ? 'Proposta aprovada não pode ser editada' : 'Editar proposta';
            const editButtonOnclick = isAprovada ? '' : `onclick="window.propostasManager.editProposta('${proposta.id}')"`;
            
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td><strong>${this.formatMoney(proposta.total_proposta / 100)}</strong></td>
                <td>${prazoTexto}</td>
                <td>${proposta.forma_pagamento || '-'}</td>
                <td>
                    <span class="status-badge status-${proposta.status.toLowerCase()}">
                        ${proposta.status}
                    </span>
                </td>
                <td title="${proposta.observacoes || ''}">${observacoesTexto}</td>
                <td>${new Date(proposta.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions-cell">
                    <button class="${editButtonClass}" 
                            ${editButtonOnclick}
                            style="${editButtonStyle}"
                            title="${editButtonTitle}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" 
                            onclick="window.propostasManager.deleteProposta('${proposta.id}')"
                            title="Excluir proposta">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async editProposta(propostaId) {
        try {
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select('*')
                .eq('id', propostaId)
                .single();

            if (error) throw error;

            // PROTEÇÃO: Verificar se proposta está aprovada
            if (data.status === 'Aprovada') {
                this.showNotification('Propostas aprovadas não podem ser editadas!', 'warning');
                return;
            }

            this.showFormProposta(data);
        } catch (error) {
            console.error('Erro ao carregar proposta:', error);
            this.showNotification('Erro ao carregar proposta: ' + error.message, 'error');
        }
    }

    async deleteProposta(propostaId) {
        if (!confirm('Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('propostas_hvc')
                .delete()
                .eq('id', propostaId);

            if (error) throw error;

            this.loadPropostas();
            this.showNotification('Proposta excluída com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao excluir proposta:', error);
            this.showNotification('Erro ao excluir proposta: ' + error.message, 'error');
        }
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
        console.log(`Notificação [${type}]: ${message}`);
        
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Adicionar estilos se não existirem
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

        // Remover após 5 segundos
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

// Expor globalmente para uso nos event handlers inline
window.propostasManager = null;

