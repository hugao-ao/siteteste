// propostas-hvc.js - Versão LIMPA SEM MULTIPLICAÇÕES
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

            if (error) throw error;

            this.clientes = data || [];
            this.populateClienteSelect();
            console.log('Clientes carregados:', this.clientes.length);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    }

    populateClienteSelect() {
        const clienteSelect = document.getElementById('cliente-id');
        if (!clienteSelect) return;

        clienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
        
        this.clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.nome;
            clienteSelect.appendChild(option);
        });
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

            if (error) throw error;

            this.servicos = data || [];
            console.log('Serviços carregados:', this.servicos.length);
            
            // Log dos serviços para debug
            this.servicos.forEach(servico => {
                console.log(`Serviço: ${servico.codigo} - ${servico.descricao}`);
            });
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
        }
    }

    // === PROPOSTAS ===
    showFormProposta(proposta = null) {
        console.log('Mostrando formulário de proposta...');
        
        const proposalsList = document.querySelector('.proposals-list');
        const proposalForm = document.querySelector('.proposal-form');
        
        if (proposalsList) proposalsList.style.display = 'none';
        if (proposalForm) proposalForm.style.display = 'block';
        
        if (proposta) {
            this.populateForm(proposta);
        } else {
            this.clearForm();
        }
    }

    hideFormProposta() {
        console.log('Ocultando formulário de proposta...');
        
        const proposalsList = document.querySelector('.proposals-list');
        const proposalForm = document.querySelector('.proposal-form');
        
        if (proposalsList) proposalsList.style.display = 'block';
        if (proposalForm) proposalForm.style.display = 'none';
        
        this.clearForm();
    }

    populateForm(proposta) {
        console.log('Preenchendo formulário com proposta:', proposta);
        
        this.currentPropostaId = proposta.id;
        
        // Preencher campos do formulário
        const numeroInput = document.getElementById('numero-proposta');
        const clienteSelect = document.getElementById('cliente-id');
        const statusSelect = document.getElementById('status');
        const observacoesTextarea = document.getElementById('observacoes');
        const prazoInput = document.getElementById('prazo-execucao');
        const tipoPrazoSelect = document.getElementById('tipo-prazo');
        const formaPagamentoInput = document.getElementById('forma-pagamento');
        
        if (numeroInput) numeroInput.value = proposta.numero_proposta || '';
        if (clienteSelect) clienteSelect.value = proposta.cliente_id || '';
        if (statusSelect) statusSelect.value = proposta.status || 'Pendente';
        if (observacoesTextarea) observacoesTextarea.value = proposta.observacoes || '';
        if (prazoInput) prazoInput.value = proposta.prazo_execucao || '';
        if (tipoPrazoSelect) tipoPrazoSelect.value = proposta.tipo_prazo || 'dias corridos';
        if (formaPagamentoInput) formaPagamentoInput.value = proposta.forma_pagamento || '';
        
        // Carregar serviços da proposta
        this.loadServicosProposta(proposta.id);
    }

    clearForm() {
        console.log('Limpando formulário...');
        
        this.currentPropostaId = null;
        this.servicosAdicionados = [];
        
        // Limpar campos
        const form = document.getElementById('proposta-form');
        if (form) form.reset();
        
        // Limpar lista de serviços
        this.renderServicos();
        this.updateTotal();
        
        // Gerar novo número de proposta
        this.generateNumeroPropostaSuggestion();
    }

    async generateNumeroPropostaSuggestion() {
        try {
            const currentYear = new Date().getFullYear();
            
            // Buscar último número do ano atual
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select('numero_proposta')
                .like('numero_proposta', `%/${currentYear}`)
                .order('numero_proposta', { ascending: false })
                .limit(1);

            if (error) throw error;

            let nextNumber = 1;
            if (data && data.length > 0) {
                const lastNumber = data[0].numero_proposta.split('/')[0];
                nextNumber = parseInt(lastNumber) + 1;
            }

            const suggestion = `${nextNumber.toString().padStart(4, '0')}/${currentYear}`;
            
            const numeroInput = document.getElementById('numero-proposta');
            if (numeroInput) {
                numeroInput.value = suggestion;
            }
        } catch (error) {
            console.error('Erro ao gerar sugestão de número:', error);
        }
    }

    async loadServicosProposta(propostaId) {
        try {
            console.log('Carregando serviços da proposta:', propostaId);
            
            const { data, error } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (codigo, descricao, unidade)
                `)
                .eq('proposta_id', propostaId);

            if (error) throw error;

            this.servicosAdicionados = data || [];
            this.renderServicos();
            this.updateTotal();
            
            console.log('Serviços da proposta carregados:', this.servicosAdicionados.length);
        } catch (error) {
            console.error('Erro ao carregar serviços da proposta:', error);
        }
    }

    // === SELEÇÃO MÚLTIPLA DE SERVIÇOS ===
    addServicoToProposta() {
        console.log('🎯 Abrindo modal de SELEÇÃO MÚLTIPLA de serviços');
        this.showModalSelecaoMultipla();
    }

    showModalSelecaoMultipla() {
        console.log('📋 Criando modal de seleção múltipla...');
        
        // Remover modal existente se houver
        const existingModal = document.getElementById('modal-selecao-multipla');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Criar modal
        const modal = document.createElement('div');
        modal.id = 'modal-selecao-multipla';
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        // Filtrar serviços que ainda não foram adicionados
        const servicosDisponiveis = this.servicos.filter(servico => 
            !this.servicosAdicionados.some(item => item.servico_id === servico.id)
        );
        
        console.log(`📊 Serviços disponíveis: ${servicosDisponiveis.length} de ${this.servicos.length}`);
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Adicionar Serviços à Proposta</h3>
                    <span class="close" id="close-modal-selecao">&times;</span>
                </div>
                
                <div class="modal-body">
                    <!-- Controles de busca e seleção -->
                    <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6;">
                                    <i class="fas fa-search"></i> Buscar Serviços
                                </label>
                                <input type="text" 
                                       id="busca-servicos" 
                                       placeholder="Código ou descrição..." 
                                       class="form-input"
                                       style="width: 100%;">
                            </div>
                            <div style="display: flex; gap: 0.5rem; align-items: end;">
                                <button type="button" id="btn-selecionar-todos" class="btn-secondary">
                                    <i class="fas fa-check-double"></i> Todos
                                </button>
                                <button type="button" id="btn-limpar-selecao" class="btn-secondary">
                                    <i class="fas fa-times"></i> Limpar
                                </button>
                            </div>
                        </div>
                        
                        <div style="text-align: center; color: #add8e6;">
                            <span id="contador-selecionados">0 serviços selecionados</span>
                        </div>
                    </div>
                    
                    <!-- Lista de serviços -->
                    <div id="lista-servicos-selecao" style="max-height: 400px; overflow-y: auto;">
                        ${servicosDisponiveis.length === 0 ? 
                            '<p style="text-align: center; color: #888; padding: 2rem;">Todos os serviços já foram adicionados à proposta.</p>' :
                            servicosDisponiveis.map(servico => `
                                <div class="servico-item" data-servico-id="${servico.id}" style="
                                    display: flex; 
                                    align-items: center; 
                                    padding: 0.75rem; 
                                    margin-bottom: 0.5rem; 
                                    background: rgba(255,255,255,0.05); 
                                    border-radius: 6px; 
                                    border: 1px solid rgba(173, 216, 230, 0.2);
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <input type="checkbox" 
                                           class="servico-checkbox" 
                                           value="${servico.id}" 
                                           style="margin-right: 0.75rem; transform: scale(1.2);">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: #add8e6; margin-bottom: 0.25rem;">
                                            ${servico.codigo} - ${servico.descricao}
                                        </div>
                                        <div style="font-size: 0.9em; color: #888;">
                                            Unidade: ${servico.unidade || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" id="btn-cancelar-selecao" class="btn-secondary">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="button" id="btn-adicionar-selecionados" class="btn-primary" ${servicosDisponiveis.length === 0 ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i> Adicionar Selecionados
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners do modal
        this.setupModalSelecaoEventListeners();
    }

    setupModalSelecaoEventListeners() {
        console.log('🔧 Configurando event listeners do modal de seleção...');
        
        // Fechar modal
        const closeBtn = document.getElementById('close-modal-selecao');
        const cancelBtn = document.getElementById('btn-cancelar-selecao');
        const modal = document.getElementById('modal-selecao-multipla');
        
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideModalSelecaoMultipla());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModalSelecaoMultipla());
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'modal-selecao-multipla') this.hideModalSelecaoMultipla();
            });
        }
        
        // Busca de serviços
        const buscaInput = document.getElementById('busca-servicos');
        if (buscaInput) {
            buscaInput.addEventListener('input', () => this.filtrarServicosModal());
        }
        
        // Botões de seleção
        const btnTodos = document.getElementById('btn-selecionar-todos');
        const btnLimpar = document.getElementById('btn-limpar-selecao');
        
        if (btnTodos) btnTodos.addEventListener('click', () => this.selecionarTodosServicos());
        if (btnLimpar) btnLimpar.addEventListener('click', () => this.limparSelecaoServicos());
        
        // Checkboxes
        const checkboxes = document.querySelectorAll('.servico-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.atualizarContadorSelecao());
        });
        
        // Clique no item (toggle checkbox)
        const items = document.querySelectorAll('.servico-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('.servico-checkbox');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        this.atualizarContadorSelecao();
                    }
                }
            });
        });
        
        // Adicionar selecionados
        const btnAdicionar = document.getElementById('btn-adicionar-selecionados');
        if (btnAdicionar) {
            btnAdicionar.addEventListener('click', () => this.adicionarServicosSelecionados());
        }
        
        // Atualizar contador inicial
        this.atualizarContadorSelecao();
    }

    filtrarServicosModal() {
        const busca = document.getElementById('busca-servicos').value.toLowerCase();
        const items = document.querySelectorAll('.servico-item');
        
        items.forEach(item => {
            const texto = item.textContent.toLowerCase();
            item.style.display = texto.includes(busca) ? 'flex' : 'none';
        });
    }

    selecionarTodosServicos() {
        const checkboxes = document.querySelectorAll('.servico-checkbox');
        const visibleCheckboxes = Array.from(checkboxes).filter(cb => 
            cb.closest('.servico-item').style.display !== 'none'
        );
        
        visibleCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        
        this.atualizarContadorSelecao();
    }

    limparSelecaoServicos() {
        const checkboxes = document.querySelectorAll('.servico-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.atualizarContadorSelecao();
    }

    atualizarContadorSelecao() {
        const checkboxes = document.querySelectorAll('.servico-checkbox:checked');
        const contador = document.getElementById('contador-selecionados');
        const btnAdicionar = document.getElementById('btn-adicionar-selecionados');
        
        const quantidade = checkboxes.length;
        
        if (contador) {
            contador.textContent = `${quantidade} serviço${quantidade !== 1 ? 's' : ''} selecionado${quantidade !== 1 ? 's' : ''}`;
        }
        
        if (btnAdicionar) {
            btnAdicionar.disabled = quantidade === 0;
            btnAdicionar.innerHTML = quantidade === 0 ? 
                '<i class="fas fa-plus"></i> Adicionar Selecionados' :
                `<i class="fas fa-plus"></i> Adicionar ${quantidade} Serviço${quantidade !== 1 ? 's' : ''}`;
        }
    }

    async adicionarServicosSelecionados() {
        const checkboxes = document.querySelectorAll('.servico-checkbox:checked');
        const servicoIds = Array.from(checkboxes).map(cb => cb.value);
        
        console.log(`➕ Adicionando ${servicoIds.length} serviços selecionados...`);
        
        if (servicoIds.length === 0) {
            this.showNotification('Nenhum serviço selecionado!', 'warning');
            return;
        }
        
        // Adicionar cada serviço à lista
        servicoIds.forEach(servicoId => {
            const servico = this.servicos.find(s => s.id === servicoId);
            if (servico) {
                const novoItem = {
                    id: Date.now() + Math.random(), // ID temporário
                    servico_id: servico.id,
                    servicos_hvc: servico,
                    quantidade: 1,
                    preco_mao_obra: 0,
                    preco_material: 0,
                    preco_total: 0
                };
                
                this.servicosAdicionados.push(novoItem);
                console.log(`✅ Serviço adicionado: ${servico.codigo} - ${servico.descricao}`);
            }
        });
        
        // Atualizar interface
        this.renderServicos();
        this.updateTotal();
        this.hideModalSelecaoMultipla();
        
        this.showNotification(`${servicoIds.length} serviço${servicoIds.length !== 1 ? 's' : ''} adicionado${servicoIds.length !== 1 ? 's' : ''} com sucesso!`, 'success');
    }

    hideModalSelecaoMultipla() {
        const modal = document.getElementById('modal-selecao-multipla');
        if (modal) {
            modal.remove();
        }
    }

    renderServicos() {
        console.log('🔄 Renderizando lista de serviços...');
        
        const container = document.getElementById('servicos-list');
        if (!container) {
            console.error('Container servicos-list não encontrado');
            return;
        }

        if (this.servicosAdicionados.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Nenhum serviço adicionado ainda.</p>
                    <p>Clique em "Adicionar Serviço" para começar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.servicosAdicionados.map((item, index) => `
            <div class="servico-item" style="
                display: flex; 
                align-items: center; 
                gap: 1rem; 
                padding: 1rem; 
                margin-bottom: 1rem; 
                background: rgba(255,255,255,0.05); 
                border-radius: 8px; 
                border: 1px solid rgba(173, 216, 230, 0.2);
            ">
                <div style="flex: 1;">
                    <strong style="color: #add8e6;">${item.servicos_hvc.codigo}</strong><br>
                    <span style="color: #ccc;">${item.servicos_hvc.descricao}</span>
                </div>
                
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="min-width: 80px;">
                        <label style="display: block; font-size: 0.8em; color: #add8e6; margin-bottom: 0.25rem;">Qtd</label>
                        <input type="number" 
                               value="${item.quantidade}" 
                               min="0.01" 
                               step="0.01"
                               class="form-input" 
                               style="width: 80px; text-align: center;"
                               onchange="window.propostasManager.updateItemQuantidade(${index}, this.value)">
                    </div>
                    
                    <div style="min-width: 60px; text-align: center; color: #add8e6;">
                        <div style="font-size: 0.8em; margin-bottom: 0.25rem;">Unidade</div>
                        <div style="font-weight: 600;">${item.servicos_hvc.unidade || 'un'}</div>
                    </div>
                    
                    <div style="min-width: 100px;">
                        <label style="display: block; font-size: 0.8em; color: #add8e6; margin-bottom: 0.25rem;">Mão de Obra (R$)</label>
                        <input type="number" 
                               value="${item.preco_mao_obra}" 
                               min="0" 
                               step="0.01"
                               class="form-input" 
                               style="width: 100px;"
                               onchange="window.propostasManager.updateItemPrecoMaoObra(${index}, this.value)">
                    </div>
                    
                    <div style="min-width: 100px;">
                        <label style="display: block; font-size: 0.8em; color: #add8e6; margin-bottom: 0.25rem;">Material (R$)</label>
                        <input type="number" 
                               value="${item.preco_material}" 
                               min="0" 
                               step="0.01"
                               class="form-input" 
                               style="width: 100px;"
                               onchange="window.propostasManager.updateItemPrecoMaterial(${index}, this.value)">
                    </div>
                    
                    <div style="min-width: 120px; text-align: center;">
                        <div style="font-size: 0.8em; color: #add8e6; margin-bottom: 0.25rem;">Total (R$)</div>
                        <div style="font-weight: 600; color: #4CAF50; font-size: 1.1em;" id="total-item-${index}">
                            ${this.formatMoney(item.preco_total)}
                        </div>
                    </div>
                    
                    <button type="button" 
                            class="btn-danger" 
                            style="padding: 0.5rem; min-width: auto;"
                            onclick="window.propostasManager.removeServico(${index})"
                            title="Remover serviço">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        console.log(`✅ ${this.servicosAdicionados.length} serviços renderizados`);
    }

    updateItemQuantidade(index, quantidade) {
        console.log(`🔢 Atualizando quantidade do item ${index}: ${quantidade}`);
        
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].quantidade = parseFloat(quantidade) || 0;
            this.calculateItemTotal(index);
            this.updateTotal();
        }
    }

    updateItemPrecoMaoObra(index, preco) {
        console.log(`💰 Atualizando preço mão de obra do item ${index}: ${preco}`);
        
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].preco_mao_obra = parseFloat(preco) || 0;
            this.calculateItemTotal(index);
            this.updateTotal();
        }
    }

    updateItemPrecoMaterial(index, preco) {
        console.log(`🔧 Atualizando preço material do item ${index}: ${preco}`);
        
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].preco_material = parseFloat(preco) || 0;
            this.calculateItemTotal(index);
            this.updateTotal();
        }
    }

    calculateItemTotal(index) {
        console.log(`🧮 === CÁLCULO ITEM ${index} - ANTES ===`);
        
        const item = this.servicosAdicionados[index];
        if (!item) return;
        
        // Log dos valores antes da conversão
        console.log(`Quantidade (raw): "${item.quantidade}" ${typeof item.quantidade}`);
        console.log(`Mão de obra (raw): "${item.preco_mao_obra}" ${typeof item.preco_mao_obra}`);
        console.log(`Material (raw): "${item.preco_material}" ${typeof item.preco_material}`);
        
        // Converter para números
        const quantidade = parseFloat(item.quantidade) || 0;
        const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
        const precoMaterial = parseFloat(item.preco_material) || 0;
        
        // Log dos valores após conversão
        console.log(`Quantidade (convertida): ${quantidade} ${typeof quantidade}`);
        console.log(`Mão de obra (convertida): ${precoMaoObra} ${typeof precoMaoObra}`);
        console.log(`Material (convertida): ${precoMaterial} ${typeof precoMaterial}`);
        
        // Calcular total
        const soma = precoMaoObra + precoMaterial;
        const total = quantidade * soma;
        
        console.log(`Soma preços (MO + Material): ${soma} ${typeof soma}`);
        console.log(`Cálculo final: ${quantidade} × ${soma} = ${total} ${typeof total}`);
        
        // Atualizar item
        item.preco_total = total;
        
        // Atualizar display
        const totalElement = document.getElementById(`total-item-${index}`);
        if (totalElement) {
            totalElement.textContent = this.formatMoney(total);
        }
        
        console.log(`✅ === FIM CÁLCULO ITEM ${index} ===`);
    }

    removeServico(index) {
        console.log(`🗑️ Removendo serviço no índice ${index}`);
        
        if (index >= 0 && index < this.servicosAdicionados.length) {
            const servicoRemovido = this.servicosAdicionados[index];
            console.log(`Removendo: ${servicoRemovido.servicos_hvc.codigo} - ${servicoRemovido.servicos_hvc.descricao}`);
            
            this.servicosAdicionados.splice(index, 1);
            this.renderServicos();
            this.updateTotal();
            
            this.showNotification('Serviço removido com sucesso!', 'success');
        }
    }

    updateTotal() {
        console.log('\n🧮 === CÁLCULO DO TOTAL GERAL - INÍCIO ===');
        
        let total = 0;
        console.log(`Número de serviços adicionados: ${this.servicosAdicionados.length}`);
        
        this.servicosAdicionados.forEach((item, index) => {
            console.log(`\n📋 Item ${index}:`);
            console.log(`- Serviço: ${item.servicos_hvc.codigo} - ${item.servicos_hvc.descricao}`);
            console.log(`- Quantidade: ${item.quantidade} ${typeof item.quantidade}`);
            console.log(`- Mão de obra: ${item.preco_mao_obra} ${typeof item.preco_mao_obra}`);
            console.log(`- Material: ${item.preco_material} ${typeof item.preco_material}`);
            console.log(`- Total do item: ${item.preco_total} ${typeof item.preco_total}`);
            
            const itemTotal = parseFloat(item.preco_total) || 0;
            total += itemTotal;
            console.log(`- Total acumulado até agora: ${total}`);
        });
        
        console.log(`\n💰 Total calculado final: ${total} ${typeof total}`);
        
        // Atualizar display
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            const totalFormatado = this.formatMoney(total);
            console.log(`💸 Total formatado: ${totalFormatado}`);
            console.log(`📝 Texto inserido no elemento: ${totalFormatado}`);
            totalElement.textContent = totalFormatado;
        }
        
        console.log('✅ === FIM CÁLCULO DO TOTAL GERAL ===\n');
    }

    // === FUNÇÃO PARA OBTER TOTAL ATUAL (PARA SALVAMENTO) ===
    getCurrentTotal() {
        console.log('\n🔍 === getCurrentTotal() - INÍCIO ===');
        console.log('Recalculando total a partir dos serviços...');
        
        let total = 0;
        console.log(`Número de serviços: ${this.servicosAdicionados.length}`);
        
        this.servicosAdicionados.forEach((item, index) => {
            const quantidade = parseFloat(item.quantidade) || 0;
            const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
            const precoMaterial = parseFloat(item.preco_material) || 0;
            const itemTotal = quantidade * (precoMaoObra + precoMaterial);
            
            console.log(`Item ${index}: ${quantidade} × (${precoMaoObra} + ${precoMaterial}) = ${itemTotal}`);
            total += itemTotal;
        });
        
        console.log(`🎯 RESULTADO getCurrentTotal(): ${total} ${typeof total}`);
        console.log('✅ === FIM getCurrentTotal() ===\n');
        
        return total;
    }

    // === SALVAMENTO ===
    async handleSubmitProposta(e) {
        e.preventDefault();
        
        console.log('\n💾 === SALVAMENTO DA PROPOSTA - INÍCIO ===');
        
        try {
            // Validar formulário
            if (!this.validateForm()) {
                return;
            }
            
            // Obter dados do formulário
            const formData = new FormData(e.target);
            const totalCalculado = this.getCurrentTotal();
            
            console.log(`📊 Total calculado para salvamento: ${totalCalculado} ${typeof totalCalculado}`);
            
            // Preparar dados da proposta
            const propostaData = {
                numero_proposta: formData.get('numero_proposta'),
                cliente_id: formData.get('cliente_id'),
                status: formData.get('status') || 'Pendente',
                observacoes: formData.get('observacoes') || null,
                prazo_execucao: parseInt(formData.get('prazo_execucao')) || null,
                tipo_prazo: formData.get('tipo_prazo') || 'dias corridos',
                forma_pagamento: formData.get('forma_pagamento') || null,
                total_proposta: totalCalculado // VALOR EXATO CALCULADO
            };
            
            console.log('\n📋 DADOS COMPLETOS PARA SALVAR:');
            console.log('Objeto proposta:', JSON.stringify(propostaData, null, 2));
            console.log(`Campo total_proposta especificamente: ${propostaData.total_proposta} ${typeof propostaData.total_proposta}`);
            
            let proposta;
            
            if (this.currentPropostaId) {
                console.log(`\n🔄 ATUALIZANDO proposta existente ID: ${this.currentPropostaId}`);
                
                // 🔍 LOG ANTES DO ENVIO
                console.log('🚀 ENVIANDO PARA SUPABASE (UPDATE)...');
                console.log('Dados sendo enviados:', propostaData);
                
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .update({
                        numero_proposta: propostaData.numero_proposta,
                        cliente_id: propostaData.cliente_id,
                        status: propostaData.status,
                        observacoes: propostaData.observacoes,
                        prazo_execucao: propostaData.prazo_execucao,
                        tipo_prazo: propostaData.tipo_prazo,
                        forma_pagamento: propostaData.forma_pagamento,
                        total_proposta: propostaData.total_proposta // SUBSTITUIÇÃO DIRETA
                    })
                    .eq('id', this.currentPropostaId)
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
                
                console.log('✅ Proposta atualizada com sucesso:', proposta);
                console.log('🔍 VALOR RETORNADO DO BANCO:', proposta.total_proposta, typeof proposta.total_proposta);
                
                // 🚨 COMPARAÇÃO CRÍTICA
                console.log('\n🔍 === COMPARAÇÃO CRÍTICA ===');
                console.log('Valor ENVIADO:', propostaData.total_proposta);
                console.log('Valor RETORNADO:', proposta.total_proposta);
                console.log('Diferença:', proposta.total_proposta - propostaData.total_proposta);
                console.log('Valores são iguais?', proposta.total_proposta === propostaData.total_proposta);
                console.log('===============================\n');
                
            } else {
                console.log('\n➕ CRIANDO nova proposta...');
                
                // 🔍 LOG ANTES DO ENVIO
                console.log('🚀 ENVIANDO PARA SUPABASE (INSERT)...');
                console.log('Dados sendo enviados:', propostaData);
                
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert(propostaData)
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
                
                this.currentPropostaId = proposta.id;
                console.log('✅ Nova proposta criada com sucesso:', proposta);
                console.log('🔍 VALOR RETORNADO DO BANCO:', proposta.total_proposta, typeof proposta.total_proposta);
                
                // 🚨 COMPARAÇÃO CRÍTICA
                console.log('\n🔍 === COMPARAÇÃO CRÍTICA ===');
                console.log('Valor ENVIADO:', propostaData.total_proposta);
                console.log('Valor RETORNADO:', proposta.total_proposta);
                console.log('Diferença:', proposta.total_proposta - propostaData.total_proposta);
                console.log('Valores são iguais?', proposta.total_proposta === propostaData.total_proposta);
                console.log('===============================\n');
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
        try {
            console.log('\n📦 Salvando itens da proposta...');
            
            // Deletar itens existentes
            const { error: deleteError } = await supabaseClient
                .from('itens_proposta_hvc')
                .delete()
                .eq('proposta_id', propostaId);

            if (deleteError) throw deleteError;

            // Inserir novos itens
            if (this.servicosAdicionados.length > 0) {
                console.log('=== ITENS PARA SALVAR ===');
                
                const itens = this.servicosAdicionados.map((item, index) => {
                    const quantidade = parseFloat(item.quantidade) || 0;
                    const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
                    const precoMaterial = parseFloat(item.preco_material) || 0;
                    const precoTotal = quantidade * (precoMaoObra + precoMaterial);
                    
                    console.log(`Item ${index}: quantidade=${quantidade}, mao_obra=${precoMaoObra}, material=${precoMaterial}, total=${precoTotal}`);
                    
                    return {
                        proposta_id: propostaId,
                        servico_id: item.servico_id,
                        quantidade: quantidade,
                        preco_mao_obra: precoMaoObra,
                        preco_material: precoMaterial,
                        preco_total: precoTotal
                    };
                });
                
                console.log('Itens salvos com sucesso');
                
                const { error: insertError } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .insert(itens);

                if (insertError) throw insertError;
            }

            console.log('✅ Itens da proposta salvos com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar itens da proposta:', error);
            throw error;
        }
    }

    validateForm() {
        const numeroProposta = document.getElementById('numero-proposta').value;
        const clienteId = document.getElementById('cliente-id').value;
        
        if (!numeroProposta) {
            this.showNotification('Número da proposta é obrigatório!', 'error');
            return false;
        }
        
        if (!clienteId) {
            this.showNotification('Cliente é obrigatório!', 'error');
            return false;
        }
        
        if (this.servicosAdicionados.length === 0) {
            this.showNotification('Adicione pelo menos um serviço à proposta!', 'error');
            return false;
        }
        
        return true;
    }

    // === LISTA DE PROPOSTAS CORRIGIDA ===
    async loadPropostas() {
        try {
            console.log('\n🔄 === CARREGANDO PROPOSTAS ===');
            
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

            console.log('📊 Propostas carregadas do banco:', data?.length || 0);
            
            // Log detalhado dos valores para debug
            if (data && data.length > 0) {
                console.log('\n🔍 === VALORES DAS PROPOSTAS ===');
                data.forEach((proposta, index) => {
                    console.log(`Proposta ${index + 1}:`, {
                        numero: proposta.numero_proposta,
                        total_banco: proposta.total_proposta,
                        tipo_total: typeof proposta.total_proposta,
                        total_formatado: this.formatMoney(proposta.total_proposta)
                    });
                });
                console.log('=====================================\n');
            }

            this.propostas = data || []; // Armazenar para filtros
            this.renderPropostas(this.propostas);
            this.populateClienteFilter(); // Atualizar filtro de clientes
            console.log('Propostas carregadas:', this.propostas.length);
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
        }
    }

    renderPropostas(propostas) {
        const tbody = document.querySelector('#proposals-table tbody');
        if (!tbody) return;

        if (!propostas || propostas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma proposta encontrada
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = propostas.map(proposta => {
            const dataFormatada = new Date(proposta.created_at).toLocaleDateString('pt-BR');
            const clienteNome = proposta.clientes_hvc?.nome || 'Cliente não encontrado';
            
            // Determinar classe do status
            let statusClass = 'status-pendente';
            if (proposta.status === 'Aprovada') statusClass = 'status-aprovada';
            else if (proposta.status === 'Recusada') statusClass = 'status-recusada';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${clienteNome}</td>
                <td><strong>${this.formatMoney(proposta.total_proposta)}</strong></td>
                <td>${proposta.prazo_execucao || '-'} ${proposta.tipo_prazo || 'dias corridos'}</td>
                <td>${proposta.forma_pagamento || '-'}</td>
                <td><span class="status-badge ${statusClass}">${proposta.status}</span></td>
                <td>${proposta.observacoes ? (proposta.observacoes.length > 50 ? proposta.observacoes.substring(0, 50) + '...' : proposta.observacoes) : '-'}</td>
                <td>${dataFormatada}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="window.propostasManager.editProposta('${proposta.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="window.propostasManager.deleteProposta('${proposta.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            return row.outerHTML;
        }).join('');
    }

    async editProposta(propostaId) {
        try {
            console.log('Editando proposta:', propostaId);
            
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .eq('id', propostaId)
                .single();

            if (error) throw error;

            // Carregar proposta para edição (sem proteção)
            this.showFormProposta(data);
        } catch (error) {
            console.error('Erro ao carregar proposta para edição:', error);
            this.showNotification('Erro ao carregar proposta: ' + error.message, 'error');
        }
    }

    async deleteProposta(propostaId) {
        if (!confirm('Tem certeza que deseja excluir esta proposta?')) {
            return;
        }

        try {
            // Deletar itens da proposta primeiro
            await supabaseClient
                .from('itens_proposta_hvc')
                .delete()
                .eq('proposta_id', propostaId);

            // Deletar proposta
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
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        // Definir cor baseada no tipo
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remover após 5 segundos
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // === MODAIS DE CLIENTE E SERVIÇO ===
    showModalCliente() {
        const modal = document.getElementById('modal-cliente');
        if (modal) modal.style.display = 'flex';
    }

    hideModalCliente() {
        const modal = document.getElementById('modal-cliente');
        if (modal) modal.style.display = 'none';
        
        const form = document.getElementById('cliente-form');
        if (form) form.reset();
    }

    async handleSubmitCliente(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const clienteData = {
                nome: formData.get('nome'),
                email: formData.get('email'),
                telefone: formData.get('telefone'),
                endereco: formData.get('endereco')
            };

            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .insert(clienteData)
                .select()
                .single();

            if (error) throw error;

            await this.loadClientes();
            this.hideModalCliente();
            this.showNotification('Cliente cadastrado com sucesso!', 'success');
            
            // Selecionar o cliente recém-criado
            const clienteSelect = document.getElementById('cliente-id');
            if (clienteSelect) {
                clienteSelect.value = data.id;
            }
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            this.showNotification('Erro ao salvar cliente: ' + error.message, 'error');
        }
    }

    showModalServico() {
        const modal = document.getElementById('modal-servico');
        if (modal) modal.style.display = 'flex';
    }

    hideModalServico() {
        const modal = document.getElementById('modal-servico');
        if (modal) modal.style.display = 'none';
        
        const form = document.getElementById('servico-form');
        if (form) form.reset();
    }

    async handleSubmitServico(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const servicoData = {
                codigo: formData.get('codigo'),
                descricao: formData.get('descricao'),
                unidade: formData.get('unidade')
            };

            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .insert(servicoData)
                .select()
                .single();

            if (error) throw error;

            await this.loadServicos();
            this.hideModalServico();
            this.showNotification('Serviço cadastrado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar serviço:', error);
            this.showNotification('Erro ao salvar serviço: ' + error.message, 'error');
        }
    }
}

// Função global para teste
window.testPropostas = function() {
    console.log('=== TESTE DE PROPOSTAS ===');
    console.log('PropostasManager:', window.propostasManager);
    console.log('Supabase Client:', supabaseClient);
    console.log('Clientes carregados:', window.propostasManager?.clientes?.length || 0);
    console.log('Serviços carregados:', window.propostasManager?.servicos?.length || 0);
    console.log('Propostas carregadas:', window.propostasManager?.propostas?.length || 0);
    console.log('========================');
};

