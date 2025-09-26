// 🎯 FUNÇÃO GLOBAL: Garantir que valores sejam numéricos
function ensureNumericValue(value) {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    
    if (typeof value === 'string') {
        // Remover formatação de moeda brasileira
        const cleanValue = value
            .replace(/[R$\s]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        
        const numericValue = parseFloat(cleanValue);
        return isNaN(numericValue) ? 0 : numericValue;
    }
    
    return 0;
}

// 🎯 FUNÇÃO GLOBAL: Validar tipo de prazo
function validateTipoPrazo(tipoPrazo) {
    const validTypes = ['corridos', 'uteis', 'cronograma'];
    if (validTypes.includes(tipoPrazo)) {
        return tipoPrazo;
    }
    
    // Se não for válido, tentar mapear valores antigos
    const mapping = {
        'dias corridos': 'corridos',
        'dias úteis': 'uteis',
        'dias uteis': 'uteis',
        'cronograma': 'cronograma',
        'cronograma da obra': 'cronograma'
    };
    
    const lowerTipo = tipoPrazo?.toLowerCase() || '';
    for (const [key, value] of Object.entries(mapping)) {
        if (lowerTipo.includes(key)) {
            return value;
        }
    }
    
    // Valor padrão
    return 'corridos';
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
        this.locais = []; // ✅ NOVO: Armazenar locais de aplicação
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
            await this.loadLocais(); // ✅ NOVO: Carregar locais
            await this.loadPropostas();
            this.setupEventListeners();
            this.setupMasks();
            this.addFilterControls(); // Adicionar controles de filtro
            this.updateTableHeaders(); // Atualizar cabeçalhos da tabela
            
            console.log('✅ PropostasManager inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.showNotification('Erro na inicialização: ' + error.message, 'error');
        }
    }

    // === FILTROS ===
    addFilterControls() {
        const container = document.querySelector('.proposals-container');
        if (!container) return;

        const existingFilters = document.getElementById('filter-controls');
        if (existingFilters) return; // Já existe

        const filterHTML = `
            <div id="filter-controls" class="filter-controls">
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="filter-search">🔍 Buscar:</label>
                        <input type="text" id="filter-search" placeholder="Número ou cliente...">
                    </div>
                    
                    <div class="filter-group">
                        <label for="filter-status">📊 Status:</label>
                        <select id="filter-status">
                            <option value="">Todos</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Aprovada">Aprovada</option>
                            <option value="Recusada">Recusada</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="filter-cliente">👤 Cliente:</label>
                        <select id="filter-cliente">
                            <option value="">Todos</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="filter-periodo">📅 Período:</label>
                        <select id="filter-periodo">
                            <option value="">Todos</option>
                            <option value="hoje">Hoje</option>
                            <option value="semana">Esta semana</option>
                            <option value="mes">Este mês</option>
                            <option value="trimestre">Este trimestre</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <button id="clear-filters" class="btn-secondary">🗑️ Limpar</button>
                    </div>
                </div>
            </div>
        `;

        const tableContainer = container.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.insertAdjacentHTML('beforebegin', filterHTML);
            this.setupFilterEvents();
        }
    }

    setupFilterEvents() {
        const searchInput = document.getElementById('filter-search');
        const statusSelect = document.getElementById('filter-status');
        const clienteSelect = document.getElementById('filter-cliente');
        const periodoSelect = document.getElementById('filter-periodo');
        const clearButton = document.getElementById('clear-filters');

        // Eventos de filtro
        [searchInput, statusSelect, clienteSelect, periodoSelect].forEach(element => {
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
                if (element.type === 'text') {
                    element.addEventListener('input', () => this.applyFilters());
                }
            }
        });

        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearFilters());
        }

        // Popular dropdown de clientes
        this.populateClienteFilter();
    }

    populateClienteFilter() {
        const clienteSelect = document.getElementById('filter-cliente');
        if (!clienteSelect) return;

        // Limpar opções existentes (exceto "Todos")
        clienteSelect.innerHTML = '<option value="">Todos</option>';

        // Adicionar clientes únicos das propostas
        const clientesUnicos = [...new Set(this.propostas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        clientesUnicos.sort().forEach(nomeCliente => {
            const option = document.createElement('option');
            option.value = nomeCliente;
            option.textContent = nomeCliente;
            clienteSelect.appendChild(option);
        });
    }

    applyFilters() {
        const searchTerm = document.getElementById('filter-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';
        const clienteFilter = document.getElementById('filter-cliente')?.value || '';
        const periodoFilter = document.getElementById('filter-periodo')?.value || '';

        const tbody = document.getElementById('proposals-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        let visibleCount = 0;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return; // Pular linhas de cabeçalho ou vazias

            const numero = cells[0]?.textContent.toLowerCase() || '';
            const cliente = cells[1]?.textContent.toLowerCase() || '';
            const status = cells[5]?.textContent || '';
            const dataText = cells[6]?.textContent || '';

            // Filtro de busca
            const matchSearch = !searchTerm || numero.includes(searchTerm) || cliente.includes(searchTerm);

            // Filtro de status
            const matchStatus = !statusFilter || status === statusFilter;

            // Filtro de cliente
            const matchCliente = !clienteFilter || cells[1]?.textContent === clienteFilter;

            // Filtro de período
            let matchPeriodo = true;
            if (periodoFilter && dataText) {
                const dataRow = new Date(dataText.split('/').reverse().join('-'));
                const hoje = new Date();
                
                switch (periodoFilter) {
                    case 'hoje':
                        matchPeriodo = dataRow.toDateString() === hoje.toDateString();
                        break;
                    case 'semana':
                        const inicioSemana = new Date(hoje);
                        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                        matchPeriodo = dataRow >= inicioSemana;
                        break;
                    case 'mes':
                        matchPeriodo = dataRow.getMonth() === hoje.getMonth() && dataRow.getFullYear() === hoje.getFullYear();
                        break;
                    case 'trimestre':
                        const trimestreAtual = Math.floor(hoje.getMonth() / 3);
                        const trimestreRow = Math.floor(dataRow.getMonth() / 3);
                        matchPeriodo = trimestreRow === trimestreAtual && dataRow.getFullYear() === hoje.getFullYear();
                        break;
                }
            }

            const shouldShow = matchSearch && matchStatus && matchCliente && matchPeriodo;
            row.style.display = shouldShow ? '' : 'none';
            
            if (shouldShow) visibleCount++;
        });

        // Mostrar contador de resultados
        this.updateFilterCounter(visibleCount);
    }

    updateFilterCounter(count) {
        let counter = document.getElementById('filter-counter');
        if (!counter) {
            counter = document.createElement('div');
            counter.id = 'filter-counter';
            counter.className = 'filter-counter';
            
            const filterControls = document.getElementById('filter-controls');
            if (filterControls) {
                filterControls.appendChild(counter);
            }
        }
        
        counter.textContent = `${count} proposta${count !== 1 ? 's' : ''} encontrada${count !== 1 ? 's' : ''}`;
    }

    clearFilters() {
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-cliente').value = '';
        document.getElementById('filter-periodo').value = '';
        this.applyFilters();
    }

    // === CABEÇALHOS DA TABELA ===
    updateTableHeaders() {
        const table = document.getElementById('proposals-table');
        if (!table) return;

        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
            if (header.textContent.trim() && !header.querySelector('.sort-icon')) {
                header.style.cursor = 'pointer';
                header.innerHTML += ' <span class="sort-icon">↕️</span>';
                header.addEventListener('click', () => this.sortTable(index));
            }
        });
    }

    sortTable(columnIndex) {
        const table = document.getElementById('proposals-table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');
        
        const isAscending = table.dataset.sortDirection !== 'asc';
        table.dataset.sortDirection = isAscending ? 'asc' : 'desc';

        rows.sort((a, b) => {
            const aText = a.cells[columnIndex]?.textContent.trim() || '';
            const bText = b.cells[columnIndex]?.textContent.trim() || '';
            
            // Tentar converter para número se possível
            const aNum = parseFloat(aText.replace(/[R$\s.,]/g, ''));
            const bNum = parseFloat(bText.replace(/[R$\s.,]/g, ''));
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return isAscending ? aNum - bNum : bNum - aNum;
            }
            
            return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });

        // Reordenar as linhas
        rows.forEach(row => tbody.appendChild(row));

        // Atualizar ícones de ordenação
        table.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '↕️');
        const currentHeader = table.querySelectorAll('th')[columnIndex];
        const currentIcon = currentHeader.querySelector('.sort-icon');
        if (currentIcon) {
            currentIcon.textContent = isAscending ? '↑' : '↓';
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

        select.innerHTML = '<option value="">Selecione um cliente</option>';
        
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
            this.hideModalCliente();
            this.showNotification('Cliente criado com sucesso! Agora você pode selecioná-lo.', 'success');
            
            // Selecionar automaticamente o cliente recém-criado
            const clienteSelect = document.getElementById('cliente-select');
            if (clienteSelect) {
                clienteSelect.value = data.id;
            }
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

    // === LOCAIS ===
    async loadLocais() {
        try {
            if (!supabaseClient) {
                console.error('Supabase client não disponível');
                return;
            }
            
            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .select('*')
                .eq('ativo', true)
                .order('nome');

            if (error) {
                console.error('Erro na query de locais:', error);
                throw error;
            }

            this.locais = data || [];
            console.log('✅ Locais carregados:', this.locais.length);
            
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            this.showNotification('Erro ao carregar locais: ' + error.message, 'error');
        }
    }

    async saveLocal(localData) {
        try {
            if (!supabaseClient) {
                throw new Error('Supabase client não disponível');
            }

            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .insert([localData])
                .select()
                .single();

            if (error) throw error;

            // Adicionar à lista local
            this.locais.push(data);
            this.locais.sort((a, b) => a.nome.localeCompare(b.nome));
            
            this.showNotification('Local adicionado com sucesso!', 'success');
            return data;
            
        } catch (error) {
            console.error('Erro ao salvar local:', error);
            this.showNotification('Erro ao salvar local: ' + error.message, 'error');
            throw error;
        }
    }

    async editLocal(localId, localData) {
        try {
            if (!supabaseClient) {
                throw new Error('Supabase client não disponível');
            }

            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .update(localData)
                .eq('id', localId)
                .select()
                .single();

            if (error) throw error;

            // Atualizar na lista local
            const index = this.locais.findIndex(l => l.id === localId);
            if (index !== -1) {
                this.locais[index] = data;
                this.locais.sort((a, b) => a.nome.localeCompare(b.nome));
            }
            
            this.showNotification('Local atualizado com sucesso!', 'success');
            return data;
            
        } catch (error) {
            console.error('Erro ao editar local:', error);
            this.showNotification('Erro ao editar local: ' + error.message, 'error');
            throw error;
        }
    }

    async deleteLocal(localId) {
        try {
            if (!supabaseClient) {
                throw new Error('Supabase client não disponível');
            }

            // Marcar como inativo ao invés de deletar
            const { error } = await supabaseClient
                .from('locais_hvc')
                .update({ ativo: false })
                .eq('id', localId);

            if (error) throw error;

            // Remover da lista local
            this.locais = this.locais.filter(l => l.id !== localId);
            
            this.showNotification('Local removido com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao deletar local:', error);
            this.showNotification('Erro ao deletar local: ' + error.message, 'error');
            throw error;
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
        const formSection = document.getElementById('form-proposta');
        if (formSection) {
            formSection.classList.remove('hidden');
        }

        if (proposta) {
            this.currentPropostaId = proposta.id;
            this.populateForm(proposta);
            this.loadItensProposta(proposta.id);
        } else {
            this.currentPropostaId = null;
            this.clearForm();
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
        if (tipoPrazoSelect) {
            const tipoPrazoValidado = validateTipoPrazo(proposta.tipo_prazo);
            tipoPrazoSelect.value = tipoPrazoValidado;
        }
        if (formaPagamentoInput) formaPagamentoInput.value = proposta.forma_pagamento || '';
        
        // Se a proposta estiver aprovada, desabilitar edição
        if (proposta.status === 'Aprovada') {
            this.disableFormForApproved();
        }
    }

    disableFormForApproved() {
        const form = document.getElementById('proposta-form');
        if (!form) return;
        
        // Desabilitar todos os campos exceto observações
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
            if (input.id !== 'observacoes' && input.type !== 'button') {
                input.disabled = true;
                input.style.opacity = '0.6';
                input.style.cursor = 'not-allowed';
                input.title = 'Proposta aprovada - edição bloqueada';
            }
        });
        
        // Desabilitar botões de ação na tabela de serviços
        const actionButtons = document.querySelectorAll('#services-tbody button');
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Proposta aprovada - edição bloqueada';
        });
        
        // Alterar texto do botão salvar
        const btnSalvar = document.querySelector('button[type="submit"]');
        if (btnSalvar) {
            btnSalvar.textContent = 'Proposta Aprovada (Somente Observações)';
        }
        
        this.showNotification('⚠️ Proposta aprovada: apenas observações podem ser editadas', 'warning');
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
                local_id: item.local_id, // ✅ NOVO: Carregar local_id
                quantidade: item.quantidade,
                preco_mao_obra: item.preco_mao_obra,
                preco_material: item.preco_material,
                preco_total: item.preco_total
            }));

            this.updateServicesTable();
            this.updateTotal();

        } catch (error) {
            console.error('Erro ao carregar itens da proposta:', error);
            this.showNotification('Erro ao carregar itens da proposta: ' + error.message, 'error');
        }
    }

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

            if (error) {
                console.error('Erro na query de propostas:', error);
                throw error;
            }

            this.propostas = data || [];
            this.renderPropostas();
            this.populateClienteFilter(); // Atualizar filtro de clientes
            
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    renderPropostas() {
        const tbody = document.getElementById('proposals-tbody');
        if (!tbody) {
            console.error('Tbody de propostas não encontrado');
            return;
        }
        
        tbody.innerHTML = '';

        if (this.propostas.length === 0) {
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

        this.propostas.forEach(proposta => {
            const row = document.createElement('tr');
            
            const clienteNome = proposta.clientes_hvc?.nome || 'Cliente não encontrado';
            const dataFormatada = proposta.created_at ? 
                new Date(proposta.created_at).toLocaleDateString('pt-BR') : '';
            
            // Formatar prazo de execução
            const prazoFormatado = formatTipoPrazoDisplay(proposta.tipo_prazo, proposta.prazo_execucao);
            
            // Definir classe CSS baseada no status
            let statusClass = '';
            switch (proposta.status) {
                case 'Aprovada':
                    statusClass = 'status-aprovada';
                    break;
                case 'Recusada':
                    statusClass = 'status-recusada';
                    break;
                default:
                    statusClass = 'status-pendente';
            }
            
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta || ''}</strong></td>
                <td>${clienteNome}</td>
                <td><strong>${this.formatMoney(proposta.valor_total || 0)}</strong></td>
                <td>${prazoFormatado}</td>
                <td>${proposta.forma_pagamento || ''}</td>
                <td><span class="status-badge ${statusClass}">${proposta.status || 'Pendente'}</span></td>
                <td>${dataFormatada}</td>
                <td>
                    <button class="btn-primary" 
                            onclick="window.propostasManager.editProposta(${proposta.id})"
                            title="Editar proposta">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" 
                            onclick="window.propostasManager.deleteProposta(${proposta.id})"
                            title="Excluir proposta">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    editProposta(id) {
        const proposta = this.propostas.find(p => p.id === id);
        if (proposta) {
            this.showFormProposta(proposta);
            
            // Scroll para o formulário
            const formSection = document.getElementById('form-proposta');
            if (formSection) {
                formSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    async deleteProposta(id) {
        const proposta = this.propostas.find(p => p.id === id);
        if (!proposta) return;

        if (confirm(`Tem certeza que deseja excluir a proposta ${proposta.numero_proposta}?`)) {
            try {
                // Primeiro, deletar os itens da proposta
                await supabaseClient
                    .from('itens_proposta_hvc')
                    .delete()
                    .eq('proposta_id', id);

                // Depois, deletar a proposta
                const { error } = await supabaseClient
                    .from('propostas_hvc')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                await this.loadPropostas();
                this.showNotification('Proposta excluída com sucesso!', 'success');

            } catch (error) {
                console.error('Erro ao excluir proposta:', error);
                this.showNotification('Erro ao excluir proposta: ' + error.message, 'error');
            }
        }
    }

    // 💰 FUNÇÃO CORRIGIDA: saveProposta com validação de tipo de prazo
    async saveProposta(e) {
        e.preventDefault();
        
        console.log('🎉 CRONOGRAMA-FIX - Iniciando salvamento da proposta...');
        
        const numeroInput = document.getElementById('numero-proposta');
        const clienteSelect = document.getElementById('cliente-select');
        const statusSelect = document.getElementById('status-select');
        const observacoesTextarea = document.getElementById('observacoes');
        const prazoInput = document.getElementById('prazo-execucao');
        const tipoPrazoSelect = document.getElementById('tipo-prazo');
        const formaPagamentoInput = document.getElementById('forma-pagamento');

        // Validações básicas
        if (!numeroInput?.value) {
            this.showNotification('Número da proposta é obrigatório', 'error');
            return;
        }

        if (!clienteSelect?.value) {
            this.showNotification('Cliente é obrigatório', 'error');
            return;
        }

        // 🎯 CORREÇÃO: Validar tipo de prazo
        const tipoPrazoValue = tipoPrazoSelect?.value;
        const tipoPrazoValidado = validateTipoPrazo(tipoPrazoValue);
        
        console.log('🎉 CRONOGRAMA-FIX - Tipo de prazo original:', tipoPrazoValue);
        console.log('🎉 CRONOGRAMA-FIX - Tipo de prazo validado:', tipoPrazoValidado);

        // Calcular total da proposta
        const valorTotal = this.servicosAdicionados.reduce((total, item) => {
            return total + ensureNumericValue(item.preco_total);
        }, 0);

        const propostaData = {
            numero_proposta: numeroInput.value,
            cliente_id: clienteSelect.value,
            status: statusSelect?.value || 'Pendente',
            observacoes: observacoesTextarea?.value || '',
            prazo_execucao: prazoInput?.value || '',
            tipo_prazo: tipoPrazoValidado, // 🎯 CORREÇÃO: Usar valor validado
            forma_pagamento: formaPagamentoInput?.value || '',
            valor_total: valorTotal
        };

        console.log('🎉 CRONOGRAMA-FIX - Dados da proposta para salvar:', propostaData);

        try {
            let proposta;
            
            if (this.currentPropostaId) {
                // Atualizar proposta existente
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .update(propostaData)
                    .eq('id', this.currentPropostaId)
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
                console.log('🎉 CRONOGRAMA-FIX - Proposta atualizada:', proposta);
            } else {
                // Criar nova proposta
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert([propostaData])
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
                console.log('🎉 CRONOGRAMA-FIX - Nova proposta criada:', proposta);
            }

            // Salvar itens da proposta
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
                quantidade, precoMaoObra, precoMaterial, precoTotal, local_id: item.local_id
            });
            
            return {
                proposta_id: propostaId,
                servico_id: item.servico_id,
                local_id: item.local_id || null, // ✅ NOVO: Incluir local_id
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

            if (error) {
                console.error('💥 CÁLCULO-FINAL-FIX - Erro ao inserir itens:', error);
                throw error;
            }
            
            console.log('✅ CÁLCULO-FINAL-FIX - Itens inseridos com sucesso!');
        }
    }

    // === SERVIÇOS DA PROPOSTA ===
    addServicoToProposta() {
        if (this.servicos.length === 0) {
            this.showNotification('Nenhum serviço disponível. Crie um serviço primeiro.', 'warning');
            return;
        }

        // Criar modal de seleção múltipla
        const modal = document.createElement('div');
        modal.className = 'modal modal-selection show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; width: 95%;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-tools"></i>
                        Selecionar Serviços para a Proposta
                    </h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="selection-controls">
                        <div class="search-group">
                            <input type="text" 
                                   id="search-servicos" 
                                   placeholder="🔍 Buscar serviços..." 
                                   onkeyup="window.propostasManager.filtrarServicos(this.value)">
                        </div>
                        
                        <div class="action-buttons">
                            <button type="button" class="btn-secondary" onclick="window.propostasManager.selecionarTodosServicos()">
                                ✅ Selecionar Todos
                            </button>
                            <button type="button" class="btn-secondary" onclick="window.propostasManager.limparSelecaoServicos()">
                                ❌ Limpar Seleção
                            </button>
                            <button type="button" class="btn-primary" onclick="window.propostasManager.showModalServicoFromSelection()">
                                ➕ Criar Novo Serviço
                            </button>
                        </div>
                    </div>
                    
                    <div class="services-list" id="lista-servicos">
                        ${this.servicos.map(servico => {
                            const jaAdicionado = this.servicosAdicionados.find(s => s.servico_id === servico.id);
                            return `
                                <div class="service-item ${jaAdicionado ? 'already-added' : ''}">
                                    <label class="service-checkbox">
                                        <input type="checkbox" 
                                               value="${servico.id}" 
                                               ${jaAdicionado ? 'disabled' : ''}>
                                        <div class="service-info">
                                            <div class="service-header">
                                                <strong>${servico.codigo} - ${servico.descricao}</strong>
                                                <span class="service-unit">${servico.unidade}</span>
                                            </div>
                                            ${servico.detalhe ? `<div class="service-detail">${servico.detalhe}</div>` : ''}
                                            ${jaAdicionado ? '<div class="already-added-label">✅ Já adicionado</div>' : ''}
                                        </div>
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="selection-summary">
                        <span id="contador-selecionados">0 serviços selecionados</span>
                    </div>
                    <div class="footer-buttons">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Cancelar
                        </button>
                        <button type="button" 
                                class="btn-success" 
                                id="btn-adicionar-selecionados"
                                onclick="window.propostasManager.addSelectedServicos()"
                                disabled>
                            <i class="fas fa-plus"></i>
                            Adicionar Selecionados
                        </button>
                    </div>
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

            // ✅ NOVO: Obter local_id selecionado
            const localSelect = document.getElementById('servico-local');
            const localId = localSelect ? localSelect.value : null;
            
            // Adicionar serviço à lista
            this.servicosAdicionados.push({
                servico_id: servicoId,
                servico: servico,
                local_id: localId || null, // ✅ NOVO: Incluir local_id
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
            
            const servico = item.servico;
            const servicoNome = servico ? `${servico.codigo} - ${servico.descricao}` : 'Serviço não encontrado';
            const unidade = servico?.unidade || '';
            
            // ✅ NOVO: Buscar nome do local
            const local = this.locais.find(l => l.id == item.local_id);
            const localNome = local ? local.nome : '-';
            
            row.innerHTML = `
                <td>
                    <strong>${servicoNome}</strong>
                    ${servico?.detalhe ? `<br><small style="color: #add8e6;">${servico.detalhe}</small>` : ''}
                </td>
                <td><span style="color: #add8e6;">${localNome}</span></td>
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
        console.log(`💰 CÁLCULO-FINAL-FIX - updateItemValue chamado:`, { index, field, value });
        
        if (index < 0 || index >= this.servicosAdicionados.length) {
            console.error('💥 CÁLCULO-FINAL-FIX - Índice inválido:', index);
            return;
        }

        const item = this.servicosAdicionados[index];
        const numericValue = ensureNumericValue(value);
        
        console.log(`💰 CÁLCULO-FINAL-FIX - Valor numérico convertido:`, numericValue);
        
        // Atualizar o campo
        item[field] = numericValue;
        
        // Recalcular total do item
        const quantidade = ensureNumericValue(item.quantidade);
        const precoMaoObra = ensureNumericValue(item.preco_mao_obra);
        const precoMaterial = ensureNumericValue(item.preco_material);
        const novoTotal = quantidade * (precoMaoObra + precoMaterial);
        
        item.preco_total = novoTotal;
        
        console.log(`💰 CÁLCULO-FINAL-FIX - Item ${index} atualizado:`, {
            quantidade, precoMaoObra, precoMaterial, novoTotal
        });
        
        // Atualizar exibição da tabela
        this.updateServicesTable();
    }

    removeServico(index) {
        if (index >= 0 && index < this.servicosAdicionados.length) {
            this.servicosAdicionados.splice(index, 1);
            this.updateServicesTable();
        }
    }

    // 💰 FUNÇÃO CORRIGIDA: updateTotal com logs detalhados
    updateTotal() {
        console.log('💰 CÁLCULO-FINAL-FIX - Iniciando updateTotal...');
        
        const total = this.servicosAdicionados.reduce((acc, item) => {
            const itemTotal = ensureNumericValue(item.preco_total);
            console.log(`💰 CÁLCULO-FINAL-FIX - Item total: ${itemTotal}`);
            return acc + itemTotal;
        }, 0);
        
        console.log('💰 CÁLCULO-FINAL-FIX - Total calculado:', total);
        
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            const totalFormatado = this.formatMoney(total);
            totalElement.textContent = totalFormatado;
            console.log('💰 CÁLCULO-FINAL-FIX - Total formatado exibido:', totalFormatado);
        }
    }

    // === EVENT LISTENERS ===
    setupEventListeners() {
        try {
            // Formulário principal
            const form = document.getElementById('proposta-form');
            if (form) {
                form.addEventListener('submit', (e) => this.saveProposta(e));
            }
            
            // Botões principais
            const btnNovaProposta = document.getElementById('btn-nova-proposta');
            const btnCancelar = document.getElementById('btn-cancelar');
            
            if (btnNovaProposta) {
                btnNovaProposta.addEventListener('click', () => this.showFormProposta());
            }
            if (btnCancelar) {
                btnCancelar.addEventListener('click', () => this.hideFormProposta());
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
            
            // ✅ NOVO: Event listeners para locais
            const btnGerenciarLocais = document.getElementById('btn-gerenciar-locais');
            const btnNovoLocal = document.getElementById('btn-novo-local');
            const btnCancelarLocal = document.getElementById('btn-cancelar-local');
            const closeModalLocais = document.getElementById('close-modal-locais');
            const localForm = document.getElementById('local-form');
            
            if (btnGerenciarLocais) {
                btnGerenciarLocais.addEventListener('click', () => this.showModalLocais());
            }
            if (btnNovoLocal) {
                btnNovoLocal.addEventListener('click', () => this.showLocalForm());
            }
            if (btnCancelarLocal) {
                btnCancelarLocal.addEventListener('click', () => this.hideLocalForm());
            }
            if (closeModalLocais) {
                closeModalLocais.addEventListener('click', () => this.hideModalLocais());
            }
            if (localForm) {
                localForm.addEventListener('submit', (e) => this.handleSubmitLocal(e));
            }
            
            // Fechar modal clicando fora
            const modalServico = document.getElementById('modal-servico');
            const modalCliente = document.getElementById('modal-cliente');
            const modalLocais = document.getElementById('modal-locais');
            
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
            if (modalLocais) {
                modalLocais.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-locais') this.hideModalLocais();
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
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        // Adicionar estilos se não existirem
        this.addNotificationStyles();

        // Adicionar ao DOM
        document.body.appendChild(notification);

        // Remover após 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    addNotificationStyles() {
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
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
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

    // === MÉTODOS DE GERENCIAMENTO DE LOCAIS ===
    
    showModalLocais() {
        const modal = document.getElementById('modal-locais');
        if (modal) {
            modal.classList.add('show');
            this.populateLocaisSelect(); // Atualizar dropdown
            this.renderLocaisTable(); // Atualizar tabela
            this.hideLocalForm(); // Esconder formulário
        }
    }

    hideModalLocais() {
        const modal = document.getElementById('modal-locais');
        if (modal) {
            modal.classList.remove('show');
            this.hideLocalForm();
        }
    }

    showLocalForm(local = null) {
        const formSection = document.getElementById('local-form-section');
        const formTitle = document.getElementById('local-form-title');
        const form = document.getElementById('local-form');
        
        if (formSection && formTitle && form) {
            formSection.classList.remove('hidden');
            
            if (local) {
                // Modo edição
                formTitle.textContent = 'Editar Local';
                document.getElementById('local-nome').value = local.nome || '';
                document.getElementById('local-descricao').value = local.descricao || '';
                form.dataset.editId = local.id;
            } else {
                // Modo criação
                formTitle.textContent = 'Novo Local';
                form.reset();
                delete form.dataset.editId;
            }
            
            // Focar no campo nome
            const nomeInput = document.getElementById('local-nome');
            if (nomeInput) nomeInput.focus();
        }
    }

    hideLocalForm() {
        const formSection = document.getElementById('local-form-section');
        const form = document.getElementById('local-form');
        
        if (formSection && form) {
            formSection.classList.add('hidden');
            form.reset();
            delete form.dataset.editId;
        }
    }

    async handleSubmitLocal(e) {
        e.preventDefault();
        
        const form = e.target;
        const editId = form.dataset.editId;
        
        const localData = {
            nome: document.getElementById('local-nome').value.trim(),
            descricao: document.getElementById('local-descricao').value.trim()
        };

        if (!localData.nome) {
            this.showNotification('Nome do local é obrigatório', 'error');
            return;
        }

        try {
            if (editId) {
                // Editar local existente
                await this.editLocal(parseInt(editId), localData);
            } else {
                // Criar novo local
                await this.saveLocal(localData);
            }
            
            this.hideLocalForm();
            this.renderLocaisTable();
            this.populateLocaisSelect();
            
        } catch (error) {
            console.error('Erro ao salvar local:', error);
        }
    }

    renderLocaisTable() {
        const tbody = document.getElementById('locais-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.locais.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; color: #999; padding: 2rem;">
                        <i class="fas fa-map-marker-alt" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhum local cadastrado
                    </td>
                </tr>
            `;
            return;
        }

        this.locais.forEach(local => {
            const row = document.createElement('tr');
            row.className = 'local-row-enter';
            
            row.innerHTML = `
                <td><strong>${local.nome}</strong></td>
                <td>${local.descricao || '-'}</td>
                <td>
                    <button class="btn-edit-local" onclick="window.propostasManager.editLocalForm(${local.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete-local" onclick="window.propostasManager.confirmDeleteLocal(${local.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    editLocalForm(localId) {
        const local = this.locais.find(l => l.id === localId);
        if (local) {
            this.showLocalForm(local);
        }
    }

    async confirmDeleteLocal(localId) {
        const local = this.locais.find(l => l.id === localId);
        if (!local) return;

        if (confirm(`Tem certeza que deseja excluir o local "${local.nome}"?`)) {
            try {
                await this.deleteLocal(localId);
                this.renderLocaisTable();
                this.populateLocaisSelect();
            } catch (error) {
                console.error('Erro ao excluir local:', error);
            }
        }
    }

    populateLocaisSelect() {
        const select = document.getElementById('servico-local');
        if (!select) return;

        // Salvar valor atual
        const currentValue = select.value;
        
        // Limpar opções
        select.innerHTML = '<option value="">Selecione um local (opcional)</option>';
        
        // Adicionar locais
        this.locais.forEach(local => {
            const option = document.createElement('option');
            option.value = local.id;
            option.textContent = local.nome;
            select.appendChild(option);
        });
        
        // Restaurar valor se ainda existir
        if (currentValue && this.locais.find(l => l.id == currentValue)) {
            select.value = currentValue;
        }
    }
}

// ✅ NOVO: Inicializar instância global para acesso aos métodos
window.propostasManager = new PropostasManager();
