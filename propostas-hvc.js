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
    
    // CORREÇÃO CRÍTICA: Tratar vírgula como separador decimal APENAS se não houver ponto
    if (stringValue.includes(',') && !stringValue.includes('.')) {
        // Caso: "1234,56" -> "1234.56"
        stringValue = stringValue.replace(',', '.');
        console.log('💰 CÁLCULO-FINAL-FIX - Vírgula convertida para ponto:', stringValue);
    } else if (stringValue.includes(',') && stringValue.includes('.')) {
        // Caso: "1.234,56" -> "1234.56" (formato brasileiro)
        const parts = stringValue.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            // A vírgula é o separador decimal
            stringValue = stringValue.replace(/\./g, '').replace(',', '.');
            console.log('💰 CÁLCULO-FINAL-FIX - Formato brasileiro convertido:', stringValue);
        } else {
            // A vírgula é separador de milhares, remover
            stringValue = stringValue.replace(/,/g, '');
            console.log('💰 CÁLCULO-FINAL-FIX - Vírgulas de milhares removidas:', stringValue);
        }
    }
    
    // Converter para número
    const numericValue = parseFloat(stringValue);
    console.log('💰 CÁLCULO-FINAL-FIX - Valor numérico final:', numericValue);
    
    if (isNaN(numericValue)) {
        console.log('💰 CÁLCULO-FINAL-FIX - Conversão falhou, retornando 0');
        return 0;
    }
    
    // Arredondar para 2 casas decimais
    const roundedValue = Math.round(numericValue * 100) / 100;
    console.log('💰 CÁLCULO-FINAL-FIX - Valor final arredondado:', roundedValue);
    return roundedValue;
}

// 🎯 FUNÇÃO CORRIGIDA: Formatação de prazo para exibição
function formatTipoPrazoDisplay(tipoPrazo, prazoExecucao) {
    if (!prazoExecucao || !tipoPrazo) return '-';
    
    const prazoNum = parseInt(prazoExecucao);
    if (isNaN(prazoNum)) return '-';
    
    switch (tipoPrazo) {
        case 'corridos':
            return `${prazoNum} dia${prazoNum !== 1 ? 's' : ''} corrido${prazoNum !== 1 ? 's' : ''}`;
        case 'uteis':
            return `${prazoNum} dia${prazoNum !== 1 ? 's' : ''} útei${prazoNum !== 1 ? 's' : 's'}`;
        case 'cronograma':
            return 'Conforme cronograma da obra';
        default:
            return `${prazoNum} dia${prazoNum !== 1 ? 's' : ''}`;
    }
}

// 🎯 FUNÇÃO CORRIGIDA: Validação de tipo de prazo
function validateTipoPrazo(tipoPrazo) {
    const validTypes = ['corridos', 'uteis', 'cronograma'];
    return validTypes.includes(tipoPrazo) ? tipoPrazo : 'corridos';
}

// Classe principal do gerenciador de propostas
class PropostasManager {
    constructor() {
        this.propostas = [];
        this.clientes = [];
        this.servicos = [];
        this.servicosAdicionados = [];
        this.editingPropostaId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadClientes();
        this.loadServicos();
        this.loadPropostas();
    }

    setupEventListeners() {
        // Botão Nova Proposta
        const btnNovaProposta = document.getElementById('btn-nova-proposta');
        if (btnNovaProposta) {
            btnNovaProposta.addEventListener('click', () => this.showNovaPropostaForm());
        }

        // Botão Cancelar
        const btnCancelar = document.getElementById('btn-cancelar');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => this.hidePropostaForm());
        }

        // Form submit
        const propostaForm = document.getElementById('proposta-form');
        if (propostaForm) {
            propostaForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Botão Adicionar Serviço
        const btnAddServico = document.getElementById('btn-add-servico');
        if (btnAddServico) {
            btnAddServico.addEventListener('click', () => this.showModalServico());
        }

        // Botão Adicionar Cliente
        const btnAddCliente = document.getElementById('btn-add-cliente');
        if (btnAddCliente) {
            btnAddCliente.addEventListener('click', () => this.showModalCliente());
        }

        // Modal Serviço
        this.setupModalServico();
        
        // Modal Cliente
        this.setupModalCliente();

        // Formatação automática do número da proposta
        const numeroPropostaInput = document.getElementById('numero-proposta');
        if (numeroPropostaInput) {
            numeroPropostaInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ''); // Remove não-dígitos
                if (value.length > 4) {
                    value = value.substring(0, 4) + '/' + value.substring(4, 8);
                }
                e.target.value = value;
            });
        }
    }

    setupModalServico() {
        const modal = document.getElementById('modal-servico');
        const closeBtn = document.getElementById('close-modal-servico');
        const cancelBtn = document.getElementById('cancel-servico');
        const form = document.getElementById('servico-form');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hideModalServico());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModalServico());
        
        if (form) {
            form.addEventListener('submit', (e) => this.handleServicoSubmit(e));
        }

        // Fechar modal clicando fora
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModalServico();
            });
        }
    }

    setupModalCliente() {
        const modal = document.getElementById('modal-cliente');
        const closeBtn = document.getElementById('close-modal-cliente');
        const cancelBtn = document.getElementById('cancel-cliente');
        const form = document.getElementById('cliente-form');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hideModalCliente());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModalCliente());
        
        if (form) {
            form.addEventListener('submit', (e) => this.handleClienteSubmit(e));
        }

        // Fechar modal clicando fora
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModalCliente();
            });
        }
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

    async handleClienteSubmit(e) {
        e.preventDefault();
        
        const nome = document.getElementById('cliente-nome').value.trim();
        const email = document.getElementById('cliente-email').value.trim();
        const telefone = document.getElementById('cliente-telefone').value.trim();
        const endereco = document.getElementById('cliente-endereco').value.trim();

        if (!nome) {
            this.showNotification('Nome do cliente é obrigatório', 'error');
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .insert({
                    nome,
                    email: email || null,
                    telefone: telefone || null,
                    endereco: endereco || null
                })
                .select()
                .single();

            if (error) throw error;

            this.showNotification('Cliente adicionado com sucesso!', 'success');
            this.hideModalCliente();
            await this.loadClientes();
            
            // Selecionar o cliente recém-criado
            const clienteSelect = document.getElementById('cliente-select');
            if (clienteSelect) {
                clienteSelect.value = data.id;
            }

        } catch (error) {
            console.error('Erro ao adicionar cliente:', error);
            this.showNotification('Erro ao adicionar cliente: ' + error.message, 'error');
        }
    }

    showModalCliente() {
        const modal = document.getElementById('modal-cliente');
        if (modal) {
            // Limpar formulário
            document.getElementById('cliente-nome').value = '';
            document.getElementById('cliente-email').value = '';
            document.getElementById('cliente-telefone').value = '';
            document.getElementById('cliente-endereco').value = '';
            
            modal.classList.add('show');
        }
    }

    hideModalCliente() {
        const modal = document.getElementById('modal-cliente');
        if (modal) {
            modal.classList.remove('show');
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

            if (error) throw error;

            this.servicos = data || [];
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }

    async handleServicoSubmit(e) {
        e.preventDefault();
        
        const codigo = document.getElementById('servico-codigo').value.trim();
        const descricao = document.getElementById('servico-descricao').value.trim();
        const detalhe = document.getElementById('servico-detalhe').value.trim();
        const unidade = document.getElementById('servico-unidade').value;

        if (!codigo || !descricao || !unidade) {
            this.showNotification('Todos os campos obrigatórios devem ser preenchidos', 'error');
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .insert({
                    codigo,
                    descricao,
                    detalhe: detalhe || null,
                    unidade
                })
                .select()
                .single();

            if (error) throw error;

            this.showNotification('Serviço criado com sucesso!', 'success');
            this.hideModalServico();
            await this.loadServicos();
            
            // Adicionar o serviço à tabela
            this.addServicoToTable(data);

        } catch (error) {
            console.error('Erro ao criar serviço:', error);
            this.showNotification('Erro ao criar serviço: ' + error.message, 'error');
        }
    }

    addServicoToTable(servico) {
        this.servicosAdicionados.push({
            servico_id: servico.id,
            codigo: servico.codigo,
            descricao: servico.descricao,
            detalhe: servico.detalhe,
            unidade: servico.unidade,
            quantidade: 1,
            preco_mao_obra: 0,
            preco_material: 0,
            preco_total: 0
        });

        this.updateServicesTable();
    }

    showModalServico() {
        const modal = document.getElementById('modal-servico');
        if (modal) {
            // Limpar formulário
            document.getElementById('servico-codigo').value = '';
            document.getElementById('servico-descricao').value = '';
            document.getElementById('servico-detalhe').value = '';
            document.getElementById('servico-unidade').value = '';
            
            modal.classList.add('show');
        }
    }

    hideModalServico() {
        const modal = document.getElementById('modal-servico');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // === TABELA DE SERVIÇOS ===
    updateServicesTable() {
        const tbody = document.getElementById('services-tbody');
        if (!tbody) return;

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
            this.updateTotalDisplay();
            return;
        }

        this.servicosAdicionados.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // 💰 CORREÇÃO: Garantir que os valores sejam numéricos
            const quantidade = ensureNumericValue(item.quantidade);
            const precoMaoObra = ensureNumericValue(item.preco_mao_obra);
            const precoMaterial = ensureNumericValue(item.preco_material);
            const precoTotal = quantidade * (precoMaoObra + precoMaterial);
            
            // Atualizar o item com o total calculado
            this.servicosAdicionados[index].preco_total = precoTotal;
            
            row.innerHTML = `
                <td>
                    <strong>${item.codigo}</strong><br>
                    <small>${item.descricao}</small>
                    ${item.detalhe ? `<br><em style="color: #888;">${item.detalhe}</em>` : ''}
                </td>
                <td>
                    <input type="number" 
                           value="${quantidade}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemQuantidade(${index}, this.value)"
                           style="width: 80px;">
                </td>
                <td><strong>${item.unidade}</strong></td>
                <td>
                    <input type="number" 
                           value="${precoMaoObra}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemPrecoMaoObra(${index}, this.value)"
                           style="width: 100px;">
                </td>
                <td>
                    <input type="number" 
                           value="${precoMaterial}" 
                           min="0" 
                           step="0.01"
                           onchange="window.propostasManager.updateItemPrecoMaterial(${index}, this.value)"
                           style="width: 100px;">
                </td>
                <td><strong>${this.formatMoney(precoTotal)}</strong></td>
                <td>
                    <button class="btn-danger" onclick="window.propostasManager.removeServico(${index})" title="Remover serviço">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });

        this.updateTotalDisplay();
    }

    updateItemQuantidade(index, value) {
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].quantidade = ensureNumericValue(value);
            this.updateServicesTable();
        }
    }

    updateItemPrecoMaoObra(index, value) {
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].preco_mao_obra = ensureNumericValue(value);
            this.updateServicesTable();
        }
    }

    updateItemPrecoMaterial(index, value) {
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].preco_material = ensureNumericValue(value);
            this.updateServicesTable();
        }
    }

    removeServico(index) {
        if (confirm('Tem certeza que deseja remover este serviço?')) {
            this.servicosAdicionados.splice(index, 1);
            this.updateServicesTable();
        }
    }

    updateTotalDisplay() {
        const totalElement = document.getElementById('total-proposta');
        if (!totalElement) return;

        const total = this.servicosAdicionados.reduce((sum, item) => {
            return sum + ensureNumericValue(item.preco_total);
        }, 0);

        totalElement.textContent = this.formatMoney(total);
    }

    // === FORMULÁRIO DE PROPOSTA ===
    showNovaPropostaForm() {
        this.editingPropostaId = null;
        this.servicosAdicionados = [];
        
        // Limpar formulário
        document.getElementById('proposta-form').reset();
        document.getElementById('form-title-text').textContent = 'Nova Proposta';
        
        // Mostrar formulário
        document.getElementById('form-proposta').classList.remove('hidden');
        document.getElementById('proposals-list').style.display = 'none';
        
        this.updateServicesTable();
    }

    hidePropostaForm() {
        document.getElementById('form-proposta').classList.add('hidden');
        document.getElementById('proposals-list').style.display = 'block';
        this.editingPropostaId = null;
        this.servicosAdicionados = [];
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        try {
            const formData = this.getFormData();
            
            if (this.editingPropostaId) {
                await this.updateProposta(this.editingPropostaId, formData);
            } else {
                await this.createProposta(formData);
            }
            
            this.hidePropostaForm();
            await this.loadPropostas();
            
        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            this.showNotification('Erro ao salvar proposta: ' + error.message, 'error');
        }
    }

    validateForm() {
        const numeroPropostaInput = document.getElementById('numero-proposta');
        const clienteSelect = document.getElementById('cliente-select');
        const statusSelect = document.getElementById('status-select');
        const prazoExecucaoInput = document.getElementById('prazo-execucao');
        const tipoPrazoSelect = document.getElementById('tipo-prazo');
        const formaPagamentoInput = document.getElementById('forma-pagamento');

        // Validações básicas
        if (!numeroPropostaInput.value.trim()) {
            this.showNotification('Número da proposta é obrigatório', 'error');
            numeroPropostaInput.focus();
            return false;
        }

        if (!clienteSelect.value) {
            this.showNotification('Cliente é obrigatório', 'error');
            clienteSelect.focus();
            return false;
        }

        if (!statusSelect.value) {
            this.showNotification('Status é obrigatório', 'error');
            statusSelect.focus();
            return false;
        }

        if (!prazoExecucaoInput.value || prazoExecucaoInput.value <= 0) {
            this.showNotification('Prazo de execução deve ser maior que zero', 'error');
            prazoExecucaoInput.focus();
            return false;
        }

        if (!tipoPrazoSelect.value) {
            this.showNotification('Tipo de prazo é obrigatório', 'error');
            tipoPrazoSelect.focus();
            return false;
        }

        if (!formaPagamentoInput.value.trim()) {
            this.showNotification('Forma de pagamento é obrigatória', 'error');
            formaPagamentoInput.focus();
            return false;
        }

        if (this.servicosAdicionados.length === 0) {
            this.showNotification('Adicione pelo menos um serviço à proposta', 'error');
            return false;
        }

        return true;
    }

    getFormData() {
        // 💰 CORREÇÃO: Calcular total corretamente
        const totalCalculado = this.servicosAdicionados.reduce((sum, item) => {
            return sum + ensureNumericValue(item.preco_total);
        }, 0);

        // 🎯 CORREÇÃO: Validar tipo de prazo
        const tipoPrazoRaw = document.getElementById('tipo-prazo')?.value;
        const tipoPrazoValidado = validateTipoPrazo(tipoPrazoRaw);

        console.log('=== DADOS DO FORMULÁRIO ===');
        console.log('- numero_proposta:', document.getElementById('numero-proposta')?.value);
        console.log('- cliente_id:', document.getElementById('cliente-select')?.value);
        console.log('- status:', document.getElementById('status-select')?.value);
        console.log('- prazo_execucao:', document.getElementById('prazo-execucao')?.value);
        console.log('- tipo_prazo (VALIDADO):', tipoPrazoValidado);
        console.log('- forma_pagamento:', document.getElementById('forma-pagamento')?.value);
        console.log('- total_proposta:', totalCalculado);

        return {
            numero_proposta: document.getElementById('numero-proposta').value.trim(),
            cliente_id: document.getElementById('cliente-select').value,
            status: document.getElementById('status-select').value,
            prazo_execucao: parseInt(document.getElementById('prazo-execucao').value),
            tipo_prazo: tipoPrazoValidado, // 🎯 CORREÇÃO: Usar valor validado
            forma_pagamento: document.getElementById('forma-pagamento').value.trim(),
            observacoes: document.getElementById('observacoes').value.trim() || null,
            total_proposta: totalCalculado // 💰 CORREÇÃO: Valor já garantido como numérico correto
        };
    }

    async createProposta(formData) {
        console.log('💾 Criando proposta com dados:', formData);
        
        // Inserir proposta
        const { data: proposta, error: propostaError } = await supabaseClient
            .from('propostas_hvc')
            .insert(formData)
            .select()
            .single();

        if (propostaError) throw propostaError;

        console.log('✅ Proposta criada:', proposta);

        // Inserir itens da proposta
        if (this.servicosAdicionados.length > 0) {
            const itens = this.servicosAdicionados.map(item => ({
                proposta_id: proposta.id,
                servico_id: item.servico_id,
                quantidade: ensureNumericValue(item.quantidade),
                preco_mao_obra: ensureNumericValue(item.preco_mao_obra),
                preco_material: ensureNumericValue(item.preco_material),
                preco_total: ensureNumericValue(item.preco_total)
            }));

            console.log('💾 Inserindo itens:', itens);

            const { error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .insert(itens);

            if (itensError) throw itensError;

            console.log('✅ Itens inseridos com sucesso');
        }

        this.showNotification('Proposta criada com sucesso!', 'success');
    }

    async updateProposta(propostaId, formData) {
        console.log('💾 Atualizando proposta:', propostaId, 'com dados:', formData);
        
        // Atualizar proposta
        const { error: propostaError } = await supabaseClient
            .from('propostas_hvc')
            .update(formData)
            .eq('id', propostaId);

        if (propostaError) throw propostaError;

        // Remover itens antigos
        const { error: deleteError } = await supabaseClient
            .from('itens_proposta_hvc')
            .delete()
            .eq('proposta_id', propostaId);

        if (deleteError) throw deleteError;

        // Inserir novos itens
        if (this.servicosAdicionados.length > 0) {
            const itens = this.servicosAdicionados.map(item => ({
                proposta_id: propostaId,
                servico_id: item.servico_id,
                quantidade: ensureNumericValue(item.quantidade),
                preco_mao_obra: ensureNumericValue(item.preco_mao_obra),
                preco_material: ensureNumericValue(item.preco_material),
                preco_total: ensureNumericValue(item.preco_total)
            }));

            const { error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .insert(itens);

            if (itensError) throw itensError;
        }

        this.showNotification('Proposta atualizada com sucesso!', 'success');
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

    // 🎯 FUNÇÃO CORRIGIDA: renderPropostas com exibição correta do total_proposta
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

    // === EDIÇÃO E EXCLUSÃO ===
    async editProposta(propostaId) {
        try {
            // Carregar dados da proposta
            const { data: proposta, error: propostaError } = await supabaseClient
                .from('propostas_hvc')
                .select('*')
                .eq('id', propostaId)
                .single();

            if (propostaError) throw propostaError;

            // Carregar itens da proposta
            const { data: itens, error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (*)
                `)
                .eq('proposta_id', propostaId);

            if (itensError) throw itensError;

            // Preencher formulário
            this.editingPropostaId = propostaId;
            document.getElementById('form-title-text').textContent = 'Editar Proposta';
            
            document.getElementById('numero-proposta').value = proposta.numero_proposta;
            document.getElementById('cliente-select').value = proposta.cliente_id;
            document.getElementById('status-select').value = proposta.status;
            document.getElementById('prazo-execucao').value = proposta.prazo_execucao;
            document.getElementById('tipo-prazo').value = proposta.tipo_prazo;
            document.getElementById('forma-pagamento').value = proposta.forma_pagamento;
            document.getElementById('observacoes').value = proposta.observacoes || '';

            // Carregar serviços
            this.servicosAdicionados = itens.map(item => ({
                servico_id: item.servico_id,
                codigo: item.servicos_hvc.codigo,
                descricao: item.servicos_hvc.descricao,
                detalhe: item.servicos_hvc.detalhe,
                unidade: item.servicos_hvc.unidade,
                quantidade: ensureNumericValue(item.quantidade),
                preco_mao_obra: ensureNumericValue(item.preco_mao_obra),
                preco_material: ensureNumericValue(item.preco_material),
                preco_total: ensureNumericValue(item.preco_total)
            }));

            this.updateServicesTable();

            // Mostrar formulário
            document.getElementById('form-proposta').classList.remove('hidden');
            document.getElementById('proposals-list').style.display = 'none';

        } catch (error) {
            console.error('Erro ao carregar proposta para edição:', error);
            this.showNotification('Erro ao carregar proposta: ' + error.message, 'error');
        }
    }

    async deleteProposta(propostaId) {
        if (!confirm('Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            // Excluir itens primeiro (devido à foreign key)
            const { error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .delete()
                .eq('proposta_id', propostaId);

            if (itensError) throw itensError;

            // Excluir proposta
            const { error: propostaError } = await supabaseClient
                .from('propostas_hvc')
                .delete()
                .eq('id', propostaId);

            if (propostaError) throw propostaError;

            this.showNotification('Proposta excluída com sucesso!', 'success');
            await this.loadPropostas();

        } catch (error) {
            console.error('Erro ao excluir proposta:', error);
            this.showNotification('Erro ao excluir proposta: ' + error.message, 'error');
        }
    }

    // === UTILITÁRIOS ===
    formatMoney(value) {
        const numValue = ensureNumericValue(value);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numValue);
    }

    showNotification(message, type = 'success') {
        // Remover notificações existentes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        // Mostrar notificação
        setTimeout(() => notification.classList.add('show'), 100);

        // Remover após 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Método para popular filtro de clientes (se existir)
    populateClienteFilter() {
        const clienteFilter = document.getElementById('cliente-filter');
        if (!clienteFilter) return;

        const currentValue = clienteFilter.value;
        clienteFilter.innerHTML = '<option value="">Todos os clientes</option>';
        
        this.clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.nome;
            clienteFilter.appendChild(option);
        });

        clienteFilter.value = currentValue;
    }
}

// Estilos para notificações
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification.success {
        background: linear-gradient(135deg, #28a745, #20c997);
    }

    .notification.error {
        background: linear-gradient(135deg, #dc3545, #c82333);
    }

    .notification.warning {
        background: linear-gradient(135deg, #ffc107, #e0a800);
        color: #212529;
    }
`;

// Adicionar estilos se não existirem
if (!document.getElementById('notification-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'notification-styles';
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

console.log('✅ PropostasManager carregado e pronto para uso!');

