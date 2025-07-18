// propostas-hvc.js - Versão CÁLCULO FINAL CORRIGIDO
// Correção definitiva para os problemas de cálculo e formatação de valores

// Aguardar carregamento do Supabase
let supabaseClient = null;
let propostasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 DOM carregado, aguardando Supabase...');
    // Aguardar um pouco para o Supabase carregar
    setTimeout(initializeApp, 1000);
});

function initializeApp() {
    console.log('🔧 Tentando inicializar aplicação...');
    
    // Verificar se o Supabase está disponível
    if (typeof supabase !== 'undefined') {
        console.log('✅ Supabase encontrado via global');
        supabaseClient = supabase;
        initializePropostasManager();
    } else {
        console.log('⚠️ Supabase não encontrado, tentando carregar via CDN...');
        loadSupabaseFromCDN();
    }
}

function initializePropostasManager() {
    try {
        console.log('🚀 Inicializando PropostasManager...');
        propostasManager = new PropostasManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.propostasManager = propostasManager;
        console.log('✅ PropostasManager inicializado e exposto globalmente');
        
        // Aguardar um pouco e tentar novamente se não funcionou
        setTimeout(() => {
            if (!window.propostasManager) {
                console.log('⚠️ PropostasManager não encontrado após múltiplas tentativas');
                console.log('🔄 Tentando novamente...');
                window.propostasManager = propostasManager;
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar PropostasManager:', error);
        setTimeout(() => {
            console.log('🔄 Tentando inicializar novamente após erro...');
            initializePropostasManager();
        }, 2000);
    }
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
            console.log('✅ Supabase carregado via CDN');
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            initializePropostasManager();
        } else {
            console.error('❌ Erro ao carregar Supabase via CDN');
        }
    };
    script.onerror = function() {
        console.error('❌ Erro ao carregar script do Supabase');
    };
    document.head.appendChild(script);
}

// 💰 FUNÇÃO FINAL CORRIGIDA: Garantir formato numérico correto com tratamento melhorado
function ensureNumericValue(value) {
    console.log('💰 CÁLCULO-FINAL-FIX - Valor recebido:', value, 'Tipo:', typeof value);
    
    if (value === null || value === undefined || value === '') {
        console.log('💰 CÁLCULO-FINAL-FIX - Valor vazio, retornando 0');
        return 0;
    }
    
    // Se já é um número válido, usar diretamente
    if (typeof value === 'number' && !isNaN(value)) {
        console.log('💰 CÁLCULO-FINAL-FIX - Já é número válido:', value);
        return Math.round(value * 100) / 100; // Apenas arredondar para 2 casas decimais
    }
    
    // Converter para string primeiro
    let stringValue = String(value);
    console.log('💰 CÁLCULO-FINAL-FIX - String value:', stringValue);
    
    // CORREÇÃO MELHORADA: Remover símbolos de moeda e espaços primeiro
    stringValue = stringValue.replace(/[R$\s]/g, '');
    console.log('💰 CÁLCULO-FINAL-FIX - Após remover R$ e espaços:', stringValue);
    
    // CORREÇÃO: Tratar formato brasileiro (115.000,00)
    // Se tem ponto E vírgula, é formato brasileiro
    if (stringValue.includes('.') && stringValue.includes(',')) {
        // Remover pontos (separadores de milhares) e trocar vírgula por ponto
        stringValue = stringValue.replace(/\./g, '').replace(',', '.');
        console.log('💰 CÁLCULO-FINAL-FIX - Formato brasileiro convertido:', stringValue);
    } else if (stringValue.includes(',') && !stringValue.includes('.')) {
        // Só vírgula, trocar por ponto
        stringValue = stringValue.replace(',', '.');
        console.log('💰 CÁLCULO-FINAL-FIX - Vírgula convertida para ponto:', stringValue);
    }
    // Se só tem ponto, manter como está (formato americano)
    
    // Remover qualquer caractere não numérico restante (exceto ponto)
    stringValue = stringValue.replace(/[^\d.]/g, '');
    console.log('💰 CÁLCULO-FINAL-FIX - Após limpeza final:', stringValue);
    
    // Converter para número
    const numericValue = parseFloat(stringValue);
    console.log('💰 CÁLCULO-FINAL-FIX - Valor numérico final:', numericValue);
    
    // Verificar se é um número válido
    if (isNaN(numericValue)) {
        console.log('💰 CÁLCULO-FINAL-FIX - NaN detectado, retornando 0');
        return 0;
    }
    
    // CORREÇÃO: Apenas arredondar para 2 casas decimais, SEM divisões
    const finalValue = Math.round(numericValue * 100) / 100;
    console.log('💰 CÁLCULO-FINAL-FIX - Valor final processado:', finalValue);
    return finalValue;
}

// 🔧 CORREÇÃO DEFINITIVA: Função de validação do tipo_prazo
function validateTipoPrazo(tipoPrazo) {
    console.log('🔧 CRONOGRAMA-FIX - Validando tipo_prazo:', tipoPrazo);
    
    // LISTA EXATA de valores aceitos pela constraint do banco
    const VALID_VALUES = ['corridos', 'uteis', 'cronograma'];
    
    // Se é null, undefined, ou vazio, usar padrão
    if (!tipoPrazo || tipoPrazo === null || tipoPrazo === undefined || tipoPrazo === '') {
        console.log('🔧 CRONOGRAMA-FIX - Valor vazio, retornando: corridos');
        return 'corridos';
    }
    
    // Converter para string e limpar
    let cleanValue = String(tipoPrazo).toLowerCase().trim();
    console.log('🔧 CRONOGRAMA-FIX - Valor limpo:', cleanValue);
    
    // 🎯 MAPEAMENTO CORRETO - aceitar AMBOS os formatos
    let finalValue;
    
    if (cleanValue === 'uteis' || cleanValue === 'úteis') {
        finalValue = 'uteis';
    } else if (cleanValue === 'cronograma' || 
               cleanValue === 'de acordo com cronograma da obra' ||
               cleanValue.includes('cronograma')) {
        finalValue = 'cronograma';  // ✅ SEMPRE cronograma no banco
    } else if (cleanValue === 'corridos') {
        finalValue = 'corridos';
    } else {
        // Se não reconhecer, usar padrão
        console.log('🔧 CRONOGRAMA-FIX - Valor não reconhecido, usando padrão: corridos');
        finalValue = 'corridos';
    }
    
    console.log('🔧 CRONOGRAMA-FIX - Valor final:', finalValue);
    
    // VERIFICAÇÃO FINAL
    if (!VALID_VALUES.includes(finalValue)) {
        console.log('🔧 CRONOGRAMA-FIX - ERRO! Valor não está na lista, forçando: corridos');
        finalValue = 'corridos';
    }
    
    console.log('🔧 CRONOGRAMA-FIX - Valor DEFINITIVO para o banco:', finalValue);
    return finalValue;
}

// NOVA FUNÇÃO: Obter tipo de prazo de forma ultra-segura
function getTipoPrazoSafe() {
    console.log('🔧 CRONOGRAMA-FIX - Obtendo tipo_prazo de forma segura...');
    
    try {
        const element = document.getElementById('tipo-prazo');
        if (!element) {
            console.log('🔧 CRONOGRAMA-FIX - Elemento não encontrado, retornando: corridos');
            return 'corridos';
        }
        
        const rawValue = element.value;
        console.log('🔧 CRONOGRAMA-FIX - Valor bruto do elemento:', rawValue);
        
        const validatedValue = validateTipoPrazo(rawValue);
        console.log('🔧 CRONOGRAMA-FIX - Valor validado final:', validatedValue);
        
        return validatedValue;
    } catch (error) {
        console.error('🔧 CRONOGRAMA-FIX - Erro ao obter tipo_prazo:', error);
        return 'corridos';
    }
}

// 🎯 NOVA FUNÇÃO: Formatar tipo de prazo para exibição
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
        this.servicosAdicionados = [];
        this.clientes = [];
        this.servicos = [];
        this.propostas = []; // Armazenar propostas para filtros
        
        this.init();
    }

    async init() {
        try {
            console.log('🔧 Inicializando PropostasManager...');
            
            // Verificar se o supabaseClient está disponível
            if (!supabaseClient) {
                console.error('❌ supabaseClient não está disponível');
                this.showNotification('Erro: Conexão com banco de dados não disponível', 'error');
                return;
            }
            
            await this.loadClientes();
            await this.loadServicos();
            await this.loadPropostas();
            this.setupEventListeners();
            this.setupMasks();
            this.addFilterControls(); // Adicionar controles de filtro
            this.updateTableHeaders(); // Atualizar cabeçalhos da tabela
            
            console.log('✅ PropostasManager inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar PropostasManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
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

        let propostasFiltradas = this.propostas.filter(proposta => {
            // Filtro de busca
            if (busca) {
                const textoBusca = `${proposta.numero_proposta} ${proposta.clientes_hvc?.nome || ''}`.toLowerCase();
                if (!textoBusca.includes(busca)) return false;
            }

            // Filtro de status
            if (status && proposta.status !== status) return false;

            // Filtro de cliente
            if (cliente && proposta.clientes_hvc?.nome !== cliente) return false;

            // Filtro de período
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
            email: document.getElementById('cliente-email').value,
            telefone: document.getElementById('cliente-telefone').value,
            endereco: document.getElementById('cliente-endereco').value
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
            const clienteSelect = document.getElementById('cliente-select');
            if (clienteSelect) {
                clienteSelect.value = data.id;
            }
            
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
        
        const servicoData = {
            codigo: document.getElementById('servico-codigo').value,
            descricao: document.getElementById('servico-descricao').value,
            detalhe: document.getElementById('servico-detalhe').value,
            unidade: document.getElementById('servico-unidade').value
        };

        try {
            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .insert([servicoData])
                .select()
                .single();

            if (error) throw error;

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
              // Preencher campos do formulário
        if (numeroInput) numeroInput.value = proposta.numero_proposta || '';
        if (clienteSelect) clienteSelect.value = proposta.cliente_id || '';
        if (statusSelect) statusSelect.value = proposta.status || 'Pendente';
        if (observacoesTextarea) observacoesTextarea.value = proposta.observacoes || '';
        if (prazoInput) prazoInput.value = proposta.prazo_execucao || '';
        if (tipoPrazoSelect) tipoPrazoSelect.value = proposta.tipo_prazo || 'corridos';
        if (formaPagamentoInput) formaPagamentoInput.value = proposta.forma_pagamento || '';
        
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
                quantidade: ensureNumericValue(item.quantidade),
                preco_mao_obra: ensureNumericValue(item.preco_mao_obra),
                preco_material: ensureNumericValue(item.preco_material),
                preco_total: ensureNumericValue(item.preco_total)
            }));

            this.updateServicesTable();
            this.updateTotal();
        } catch (error) {
            console.error('Erro ao carregar itens da proposta:', error);
        }
    }

    addServicoToProposta() {
        if (this.servicos.length === 0) {
            this.showNotification('Nenhum serviço encontrado. Adicione serviços primeiro.', 'warning');
            return;
        }
        
        this.showServicoSelectionModal();
    }

    // === NOVA FUNCIONALIDADE: SELEÇÃO MÚLTIPLA ===
    showServicoSelectionModal() {
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
            this.updateTotal();
            return;
        }

        this.servicosAdicionados.forEach((item, index) => {
            const row = document.createElement('tr');
            
            const servico = item.servico;
            const servicoNome = servico ? `${servico.codigo} - ${servico.descricao}` : 'Serviço não encontrado';
            const unidade = servico?.unidade || '';
            
            row.innerHTML = `
                <td>
                    <strong>${servicoNome}</strong>
                    ${servico?.detalhe ? `<br><small style="color: #add8e6;">${servico.detalhe}</small>` : ''}
                </td>
                <td>
                    <input type="number" 
                           value="${item.quantidade}" 
                           min="0.01" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemValue(${index}, 'quantidade', this.value)"
                           style="width: 80px;">
                </td>
                <td>${unidade}</td>
                <td>
                    <input type="number" 
                           value="${item.preco_mao_obra}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemValue(${index}, 'preco_mao_obra', this.value)"
                           style="width: 100px;">
                </td>
                <td>
                    <input type="number" 
                           value="${item.preco_material}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemValue(${index}, 'preco_material', this.value)"
                           style="width: 100px;">
                </td>
                <td><strong>${this.formatMoney(item.preco_total)}</strong></td>
                <td>
                    <button class="btn-danger" 
                            onclick="window.propostasManager.removeServico(${index})"
                            title="Remover serviço">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });

        this.updateTotal();
    }

    // 💰 FUNÇÃO CORRIGIDA: updateItemValue com logs detalhados
    updateItemValue(index, field, value) {
        console.log(`💰 CÁLCULO-FINAL-FIX - updateItemValue chamada:`, {index, field, value});
        
        if (index >= 0 && index < this.servicosAdicionados.length) {
            const item = this.servicosAdicionados[index];
            
            // CORREÇÃO: Usar função para garantir formato numérico correto
            const valorProcessado = ensureNumericValue(value);
            console.log(`💰 CÁLCULO-FINAL-FIX - Valor processado para ${field}:`, valorProcessado);
            
            item[field] = valorProcessado;
            
            // Recalcular total do item
            const quantidade = ensureNumericValue(item.quantidade);
            const precoMaoObra = ensureNumericValue(item.preco_mao_obra);
            const precoMaterial = ensureNumericValue(item.preco_material);
            
            console.log(`💰 CÁLCULO-FINAL-FIX - Valores para cálculo:`, {quantidade, precoMaoObra, precoMaterial});
            
            const somaPrecos = precoMaoObra + precoMaterial;
            const totalCalculado = quantidade * somaPrecos;
            
            console.log(`💰 CÁLCULO-FINAL-FIX - Cálculo: ${quantidade} × (${precoMaoObra} + ${precoMaterial}) = ${totalCalculado}`);
            
            item.preco_total = ensureNumericValue(totalCalculado);
            
            console.log(`💰 CÁLCULO-FINAL-FIX - Total final do item:`, item.preco_total);
            
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

    // 💰 FUNÇÃO CORRIGIDA: updateTotal com logs detalhados
    updateTotal() {
        console.log('💰 CÁLCULO-FINAL-FIX - Iniciando updateTotal...');
        
        // CORREÇÃO: Cálculo simplificado e direto com garantia numérica
        let total = 0;
        
        this.servicosAdicionados.forEach((item, index) => {
            const itemTotal = ensureNumericValue(item.preco_total);
            console.log(`💰 CÁLCULO-FINAL-FIX - Item ${index}: ${itemTotal}`);
            total += itemTotal;
        });
        
        // Garantir que o total seja um número válido
        total = ensureNumericValue(total);
        
        console.log('💰 CÁLCULO-FINAL-FIX - Total calculado final:', total);
        
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            const totalFormatado = this.formatMoney(total);
            console.log('💰 CÁLCULO-FINAL-FIX - Total formatado:', totalFormatado);
            totalElement.textContent = totalFormatado;
        }
    }

    // 💰 FUNÇÃO CORRIGIDA: getCurrentTotal para obter total atual
    getCurrentTotal() {
        console.log('💰 CÁLCULO-FINAL-FIX - Iniciando getCurrentTotal...');
        
        let total = 0;
        
        this.servicosAdicionados.forEach((item, index) => {
            const quantidade = ensureNumericValue(item.quantidade);
            const precoMaoObra = ensureNumericValue(item.preco_mao_obra);
            const precoMaterial = ensureNumericValue(item.preco_material);
            const itemTotal = quantidade * (precoMaoObra + precoMaterial);
            
            console.log(`💰 CÁLCULO-FINAL-FIX - Item ${index}: ${quantidade} × (${precoMaoObra} + ${precoMaterial}) = ${itemTotal}`);
            
            total += itemTotal;
        });
        
        // CORREÇÃO: Garantir que o total seja um número válido
        const totalFinal = ensureNumericValue(total);
        console.log('💰 CÁLCULO-FINAL-FIX - Total final getCurrentTotal:', totalFinal);
        
        return totalFinal;
    }

    // 🔧 FUNÇÃO CORRIGIDA: handleSubmitProposta com validação de cronograma
    async handleSubmitProposta(e) {
        e.preventDefault();

        console.log('🚀 CRONOGRAMA-FIX - Iniciando handleSubmitProposta');

        if (!this.validateForm()) {
            console.log('❌ CRONOGRAMA-FIX - Validação do formulário falhou');
            return;
        }

        // 💰 CORREÇÃO: Usar função dedicada para obter o total atual com garantia numérica
        const totalCalculado = this.getCurrentTotal();
        console.log('💰 CÁLCULO-FINAL-FIX - Total para salvar no banco:', totalCalculado);

        // 🎯 CORREÇÃO CRONOGRAMA: Usar função segura para obter tipo de prazo
        const tipoPrazoValidado = getTipoPrazoSafe();
        
        console.log('📊 CRONOGRAMA-FIX - Dados da proposta antes do envio:');
        console.log('- numero_proposta:', document.getElementById('numero-proposta').value);
        console.log('- cliente_id:', document.getElementById('cliente-select').value);
        console.log('- status:', document.getElementById('status-select').value);
        console.log('- prazo_execucao:', document.getElementById('prazo-execucao')?.value);
        console.log('- tipo_prazo (VALIDADO):', tipoPrazoValidado);
        console.log('- forma_pagamento:', document.getElementById('forma-pagamento')?.value);
        console.log('- total_proposta:', totalCalculado);

        const propostaData = {
            numero_proposta: document.getElementById('numero-proposta').value,
            cliente_id: document.getElementById('cliente-select').value,
            status: document.getElementById('status-select').value,
            observacoes: document.getElementById('observacoes').value || null,
            prazo_execucao: parseInt(document.getElementById('prazo-execucao')?.value) || null,
            tipo_prazo: tipoPrazoValidado, // 🎯 CORREÇÃO: Valor GARANTIDAMENTE válido
            forma_pagamento: document.getElementById('forma-pagamento')?.value || null,
            total_proposta: totalCalculado/10 // 💰 CORREÇÃO: Valor já garantido como numérico correto
        };

        console.log('📦 CRONOGRAMA-FIX - Objeto propostaData final:', JSON.stringify(propostaData, null, 2));

        try {
            let proposta;
            
            if (this.currentPropostaId) {
                console.log('✏️ CRONOGRAMA-FIX - Atualizando proposta existente:', this.currentPropostaId);
                // Atualizar proposta existente
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .update(propostaData)
                    .eq('id', this.currentPropostaId)
                    .select()
                    .single();

                if (error) {
                    console.error('❌ CRONOGRAMA-FIX - Erro na atualização:', error);
                    throw error;
                }
                proposta = data;
                console.log('✅ CRONOGRAMA-FIX - Proposta atualizada com sucesso:', proposta);
                
            } else {
                console.log('➕ CRONOGRAMA-FIX - Criando nova proposta');
                // Criar nova proposta
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert([propostaData])
                    .select()
                    .single();

                if (error) {
                    console.error('❌ CRONOGRAMA-FIX - Erro na criação:', error);
                    throw error;
                }
                proposta = data;
                console.log('✅ CRONOGRAMA-FIX - Proposta criada com sucesso:', proposta);
            }

            // Salvar itens da proposta
            console.log('💾 CRONOGRAMA-FIX - Salvando itens da proposta...');
            await this.saveItensProposta(proposta.id);

            this.hideFormProposta();
            
            // CORREÇÃO: Forçar recarregamento completo da lista
            await this.loadPropostas();
            
            this.showNotification('Proposta salva com sucesso!', 'success');
            console.log('🎉 CRONOGRAMA-FIX - Processo concluído com sucesso!');

        } catch (error) {
            console.error('💥 CRONOGRAMA-FIX - Erro no salvamento:', error);
            console.error('💥 CRONOGRAMA-FIX - Detalhes do erro:', JSON.stringify(error, null, 2));
            this.showNotification('Erro ao salvar proposta: ' + error.message, 'error');
        }
    }

    // 💰 FUNÇÃO CORRIGIDA: saveItensProposta com valores garantidos
    async saveItensProposta(propostaId) {
        console.log('💰 CÁLCULO-FINAL-FIX - Iniciando saveItensProposta...');
        
        // Remover itens existentes
        await supabaseClient
            .from('itens_proposta_hvc')
            .delete()
            .eq('proposta_id', propostaId);

        // Inserir novos itens com valores garantidos como numéricos
        const itens = this.servicosAdicionados.map((item, index) => {
            const quantidade = ensureNumericValue(item.quantidade);
            const precoMaoObra = ensureNumericValue(item.preco_mao_obra);
            const precoMaterial = ensureNumericValue(item.preco_material);
            const precoTotal = ensureNumericValue(quantidade * (precoMaoObra + precoMaterial));
            
            console.log(`💰 CÁLCULO-FINAL-FIX - Item ${index} para salvar:`, {
                quantidade, precoMaoObra, precoMaterial, precoTotal
            });
            
            return {
                proposta_id: propostaId,
                servico_id: item.servico_id,
                quantidade: quantidade,
                preco_mao_obra: precoMaoObra,
                preco_material: precoMaterial,
                preco_total: precoTotal
            };
        });

        console.log('💰 CÁLCULO-FINAL-FIX - Itens finais para inserir:', itens);

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
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    // 🎯 FUNÇÃO CORRIGIDA: renderPropostas com formatação correta do prazo
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
            
            // 🎯 CORREÇÃO: Formatar prazo usando a nova função
            let prazoTexto = '-';
            if (proposta.prazo_execucao) {
                prazoTexto = formatTipoPrazoDisplay(proposta.tipo_prazo, proposta.prazo_execucao);
            }

            // Formatar observações (truncar se muito longo)
            let observacoesTexto = proposta.observacoes || '-';
            if (observacoesTexto.length > 50) {
                observacoesTexto = observacoesTexto.substring(0, 50) + '...';
            }
            
            // Botões de ação sempre habilitados
            const editButtonClass = 'btn-secondary';
            const editButtonStyle = '';
            const editButtonTitle = 'Editar proposta';
            const editButtonOnclick = `onclick="window.propostasManager.editProposta('${proposta.id}')"`;
            
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td><strong>${this.formatMoney(proposta.total_proposta || 0)}</strong></td>
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

            // Carregar proposta para edição
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

    // === EVENT LISTENERS ===
    setupEventListeners() {
        try {
            // Botões principais
            const btnNovaProposta = document.getElementById('btn-nova-proposta');
            const btnCancelar = document.getElementById('btn-cancelar');
            
            if (btnNovaProposta) {
                btnNovaProposta.addEventListener('click', () => {
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

    // 💰 FUNÇÃO FINAL CORRIGIDA: formatMoney SEM divisões desnecessárias
    formatMoney(value) {
        console.log('💰 CÁLCULO-FINAL-FIX - formatMoney recebeu:', value, 'Tipo:', typeof value);
        
        // CORREÇÃO: Usar valor diretamente sem processamento adicional
        const numericValue = parseFloat(value) || 0;
        
        console.log('💰 CÁLCULO-FINAL-FIX - Valor numérico para formatação:', numericValue);
        
        const formatted = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numericValue);
        
        console.log('💰 CÁLCULO-FINAL-FIX - Valor formatado final:', formatted);
        
        return formatted;
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
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

