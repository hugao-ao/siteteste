// propostas-hvc.js - Versão REESCRITA com divisão por 100 e delete/insert
// Gerenciamento de Propostas HVC

// Aguardar carregamento do Supabase
let supabaseClient = null;
let propostasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco para o Supabase carregar
    setTimeout(initializeApp, 1000);
});

function initializeApp() {
    // Verificar se o Supabase está disponível
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase;
    } else {
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

// FUNÇÃO: Garantir formato numérico correto
function ensureNumericValue(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    
    // Converter para string primeiro
    let stringValue = String(value);
    
    // Remover caracteres não numéricos exceto ponto e vírgula
    stringValue = stringValue.replace(/[^\d.,-]/g, '');
    
    // Substituir vírgula por ponto (formato brasileiro para americano)
    stringValue = stringValue.replace(',', '.');
    
    // Converter para número
    const numericValue = parseFloat(stringValue);
    
    // Verificar se é um número válido
    if (isNaN(numericValue)) {
        return 0;
    }
    
    // Apenas arredondar para 2 casas decimais
    return Math.round(numericValue * 100) / 100;
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
            await this.loadClientes();
            await this.loadServicos();
            await this.loadPropostas();
            this.setupEventListeners();
            this.setupMasks();
            this.addFilterControls();
            this.updateTableHeaders();
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

    // === FILTROS ===
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
            this.showNotification('Serviço adicionado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao adicionar serviço:', error);
            this.showNotification('Erro ao adicionar serviço: ' + error.message, 'error');
        }
    }

    // === MODAL DE SERVIÇOS ===
    showModalSelecionarServicos() {
        const modal = document.getElementById('modal-selecionar-servicos');
        if (modal) {
            modal.classList.add('show');
            this.renderServicosDisponiveis();
        }
    }

    hideModalSelecionarServicos() {
        const modal = document.getElementById('modal-selecionar-servicos');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    renderServicosDisponiveis() {
        const container = document.getElementById('servicos-disponiveis');
        if (!container) return;

        container.innerHTML = '';

        this.servicos.forEach(servico => {
            const servicoDiv = document.createElement('div');
            servicoDiv.className = 'servico-item';
            servicoDiv.style.cssText = `
                display: flex;
                align-items: center;
                padding: 0.75rem;
                margin-bottom: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(173, 216, 230, 0.2);
            `;

            servicoDiv.innerHTML = `
                <input type="checkbox" 
                       id="servico-${servico.id}" 
                       value="${servico.id}"
                       style="margin-right: 0.75rem;">
                <label for="servico-${servico.id}" 
                       style="flex: 1; color: #add8e6; cursor: pointer;">
                    <strong>${servico.codigo}</strong> - ${servico.descricao}
                    <br><small style="color: #87ceeb;">Unidade: ${servico.unidade}</small>
                </label>
            `;

            container.appendChild(servicoDiv);
        });
    }

    filtrarServicos() {
        const busca = document.getElementById('busca-servicos').value.toLowerCase();
        const servicosItems = document.querySelectorAll('.servico-item');

        servicosItems.forEach(item => {
            const texto = item.textContent.toLowerCase();
            if (texto.includes(busca)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    selecionarTodosServicos() {
        const checkboxes = document.querySelectorAll('#servicos-disponiveis input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    limparSelecaoServicos() {
        const checkboxes = document.querySelectorAll('#servicos-disponiveis input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    adicionarServicosSelecionados() {
        const checkboxes = document.querySelectorAll('#servicos-disponiveis input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            const servicoId = checkbox.value;
            const servico = this.servicos.find(s => s.id == servicoId);
            
            if (servico && !this.servicosAdicionados.find(s => s.id == servicoId)) {
                this.servicosAdicionados.push({
                    id: servico.id,
                    codigo: servico.codigo,
                    descricao: servico.descricao,
                    unidade: servico.unidade,
                    quantidade: 1,
                    preco_mao_obra: 0,
                    preco_material: 0
                });
            }
        });

        this.renderServicosAdicionados();
        this.hideModalSelecionarServicos();
        this.updateTotal();
    }

    // === SERVIÇOS ADICIONADOS ===
    renderServicosAdicionados() {
        const container = document.getElementById('servicos-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.servicosAdicionados.length === 0) {
            container.innerHTML = '<p style="color: #87ceeb; text-align: center; padding: 2rem;">Nenhum serviço adicionado</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'services-table';
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        `;

        table.innerHTML = `
            <thead>
                <tr style="background: rgba(173, 216, 230, 0.1);">
                    <th style="padding: 0.75rem; text-align: left; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Serviço</th>
                    <th style="padding: 0.75rem; text-align: center; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Quantidade</th>
                    <th style="padding: 0.75rem; text-align: center; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Unidade</th>
                    <th style="padding: 0.75rem; text-align: center; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Mão de Obra (R$)</th>
                    <th style="padding: 0.75rem; text-align: center; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Material (R$)</th>
                    <th style="padding: 0.75rem; text-align: center; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Total (R$)</th>
                    <th style="padding: 0.75rem; text-align: center; color: #add8e6; border-bottom: 1px solid rgba(173, 216, 230, 0.2);">Ações</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');

        this.servicosAdicionados.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(173, 216, 230, 0.1)';

            const total = (item.quantidade * (item.preco_mao_obra + item.preco_material));

            row.innerHTML = `
                <td style="padding: 0.75rem;">
                    <strong style="color: #add8e6;">${item.codigo}</strong> - ${item.descricao}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                    <input type="number" 
                           value="${item.quantidade}" 
                           min="0.01" 
                           step="0.01"
                           style="width: 80px; text-align: center;"
                           class="form-input"
                           onchange="window.propostasManager.updateQuantidade(${index}, this.value)">
                </td>
                <td style="padding: 0.75rem; text-align: center; color: #87ceeb;">
                    ${item.unidade}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                    <input type="number" 
                           value="${item.preco_mao_obra}" 
                           min="0" 
                           step="0.01"
                           style="width: 100px; text-align: center;"
                           class="form-input"
                           onchange="window.propostasManager.updatePrecoMaoObra(${index}, this.value)">
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                    <input type="number" 
                           value="${item.preco_material}" 
                           min="0" 
                           step="0.01"
                           style="width: 100px; text-align: center;"
                           class="form-input"
                           onchange="window.propostasManager.updatePrecoMaterial(${index}, this.value)">
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                    <strong style="color: #90EE90;">${this.formatMoney(total)}</strong>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                    <button type="button" 
                            class="btn-danger" 
                            onclick="window.propostasManager.removeServico(${index})"
                            style="padding: 0.25rem 0.5rem; font-size: 0.8rem;"
                            title="Remover serviço">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        container.appendChild(table);
    }

    updateQuantidade(index, value) {
        this.servicosAdicionados[index].quantidade = parseFloat(value) || 0;
        this.renderServicosAdicionados();
        this.updateTotal();
    }

    updatePrecoMaoObra(index, value) {
        this.servicosAdicionados[index].preco_mao_obra = parseFloat(value) || 0;
        this.renderServicosAdicionados();
        this.updateTotal();
    }

    updatePrecoMaterial(index, value) {
        this.servicosAdicionados[index].preco_material = parseFloat(value) || 0;
        this.renderServicosAdicionados();
        this.updateTotal();
    }

    removeServico(index) {
        this.servicosAdicionados.splice(index, 1);
        this.renderServicosAdicionados();
        this.updateTotal();
    }

    updateTotal() {
        const total = this.getCurrentTotal();
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            totalElement.textContent = this.formatMoney(total);
        }
    }

    getCurrentTotal() {
        const total = this.servicosAdicionados.reduce((sum, item) => {
            return sum + (item.quantidade * (item.preco_mao_obra + item.preco_material));
        }, 0);
        
        return ensureNumericValue(total);
    }

    async handleSubmitProposta(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        const totalCalculado = this.getCurrentTotal();

        const propostaData = {
            numero_proposta: document.getElementById('numero-proposta').value,
            cliente_id: document.getElementById('cliente-select').value,
            status: document.getElementById('status-select').value,
            observacoes: document.getElementById('observacoes').value || null,
            prazo_execucao: parseInt(document.getElementById('prazo-execucao')?.value) || null,
            tipo_prazo: document.getElementById('tipo-prazo')?.value || 'corridos',
            forma_pagamento: document.getElementById('forma-pagamento')?.value || null,
            total_proposta: totalCalculado
        };

        try {
            let proposta;
            
            if (this.currentPropostaId) {
                // NOVO PROCESSO: DELETE/INSERT para propostas editadas
                
                // 1. Deletar valor anterior
                const { error: deleteError } = await supabaseClient
                    .from('propostas_hvc')
                    .update({ total_proposta: null })
                    .eq('id', this.currentPropostaId);

                if (deleteError) throw deleteError;
                
                // 2. Inserir valor atualizado
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .update(propostaData)
                    .eq('id', this.currentPropostaId)
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
                
            } else {
                // Criar nova proposta
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert([propostaData])
                    .select()
                    .single();

                if (error) throw error;
                proposta = data;
            }

            // Salvar itens da proposta
            await this.saveItensProposta(proposta.id);

            this.showNotification('Proposta salva com sucesso!', 'success');
            this.hideFormProposta();
            await this.loadPropostas();

        } catch (error) {
            console.error('Erro no salvamento:', error);
            this.showNotification('Erro ao salvar proposta: ' + error.message, 'error');
        }
    }

    async saveItensProposta(propostaId) {
        try {
            // Deletar itens existentes
            const { error: deleteError } = await supabaseClient
                .from('itens_proposta_hvc')
                .delete()
                .eq('proposta_id', propostaId);

            if (deleteError) throw deleteError;

            // Inserir novos itens
            if (this.servicosAdicionados.length > 0) {
                const itens = this.servicosAdicionados.map(item => ({
                    proposta_id: propostaId,
                    servico_id: item.id,
                    quantidade: ensureNumericValue(item.quantidade),
                    preco_mao_obra: ensureNumericValue(item.preco_mao_obra),
                    preco_material: ensureNumericValue(item.preco_material),
                    preco_total: ensureNumericValue(item.quantidade * (item.preco_mao_obra + item.preco_material))
                }));

                const { error } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .insert(itens);

                if (error) throw error;
            }
        } catch (error) {
            console.error('Erro ao salvar itens da proposta:', error);
            throw error;
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

        return true;
    }

    // === PROPOSTAS ===
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
                    clientes_hvc (
                        id,
                        nome,
                        email,
                        telefone
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro na query de propostas:', error);
                throw error;
            }

            this.propostas = data || [];
            this.renderPropostas(this.propostas);
            this.populateClienteFilter();
            
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    renderPropostas(propostas) {
        const tbody = document.querySelector('#proposals-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (propostas.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 2rem; color: #87ceeb;">
                    Nenhuma proposta encontrada
                </td>
            `;
            tbody.appendChild(row);
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
            
            // Botões de ação sempre habilitados
            const editButtonClass = 'btn-secondary';
            const editButtonStyle = '';
            const editButtonTitle = 'Editar proposta';
            const editButtonOnclick = `onclick="window.propostasManager.editProposta('${proposta.id}')"`;
            
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td><strong>${this.formatMoney((proposta.total_proposta || 0) / 100)}</strong></td>
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

    // === CRUD PROPOSTAS ===
    showFormProposta() {
        this.currentPropostaId = null;
        this.servicosAdicionados = [];
        
        const form = document.getElementById('proposal-form');
        if (form) form.reset();
        
        this.renderServicosAdicionados();
        this.updateTotal();
        
        const modal = document.getElementById('modal-proposta');
        if (modal) {
            modal.classList.add('show');
            const numeroInput = document.getElementById('numero-proposta');
            if (numeroInput) numeroInput.focus();
        }
    }

    hideFormProposta() {
        const modal = document.getElementById('modal-proposta');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async editProposta(id) {
        try {
            // Carregar dados da proposta
            const { data: proposta, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (
                        id,
                        nome
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            // Carregar itens da proposta
            const { data: itens, error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (
                        id,
                        codigo,
                        descricao,
                        unidade
                    )
                `)
                .eq('proposta_id', id);

            if (itensError) throw itensError;

            // Preencher formulário
            this.currentPropostaId = id;
            
            document.getElementById('numero-proposta').value = proposta.numero_proposta;
            document.getElementById('cliente-select').value = proposta.cliente_id;
            document.getElementById('status-select').value = proposta.status;
            document.getElementById('observacoes').value = proposta.observacoes || '';
            document.getElementById('prazo-execucao').value = proposta.prazo_execucao || '';
            document.getElementById('tipo-prazo').value = proposta.tipo_prazo || 'corridos';
            document.getElementById('forma-pagamento').value = proposta.forma_pagamento || '';

            // Preencher serviços
            this.servicosAdicionados = itens.map(item => ({
                id: item.servicos_hvc.id,
                codigo: item.servicos_hvc.codigo,
                descricao: item.servicos_hvc.descricao,
                unidade: item.servicos_hvc.unidade,
                quantidade: item.quantidade,
                preco_mao_obra: item.preco_mao_obra,
                preco_material: item.preco_material
            }));

            this.renderServicosAdicionados();
            this.updateTotal();

            // Mostrar modal
            const modal = document.getElementById('modal-proposta');
            if (modal) {
                modal.classList.add('show');
            }

        } catch (error) {
            console.error('Erro ao carregar proposta para edição:', error);
            this.showNotification('Erro ao carregar proposta: ' + error.message, 'error');
        }
    }

    async deleteProposta(id) {
        if (!confirm('Tem certeza que deseja excluir esta proposta?')) {
            return;
        }

        try {
            // Deletar itens primeiro
            const { error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .delete()
                .eq('proposta_id', id);

            if (itensError) throw itensError;

            // Deletar proposta
            const { error } = await supabaseClient
                .from('propostas_hvc')
                .delete()
                .eq('id', id);

            if (error) throw error;

            this.showNotification('Proposta excluída com sucesso!', 'success');
            await this.loadPropostas();

        } catch (error) {
            console.error('Erro ao excluir proposta:', error);
            this.showNotification('Erro ao excluir proposta: ' + error.message, 'error');
        }
    }

    formatMoney(value) {
        // Usar valor diretamente sem processamento adicional
        const numericValue = parseFloat(value) || 0;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numericValue);
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
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
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        `;

        // Definir cor baseada no tipo
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        // Adicionar ao DOM
        document.body.appendChild(notification);

        // Remover após 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    // === MÁSCARAS E EVENT LISTENERS ===
    setupMasks() {
        // Máscara para número da proposta
        const numeroInput = document.getElementById('numero-proposta');
        if (numeroInput) {
            numeroInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 4) {
                    value = value.substring(0, 4) + '/' + value.substring(4, 8);
                }
                e.target.value = value;
            });
        }

        // Máscara para telefone
        const telefoneInput = document.getElementById('cliente-telefone');
        if (telefoneInput) {
            telefoneInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length <= 11) {
                    value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                    if (value.length < 14) {
                        value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                    }
                }
                e.target.value = value;
            });
        }
    }

    setupEventListeners() {
        // Event listeners para formulários
        const clienteForm = document.getElementById('cliente-form');
        if (clienteForm) {
            clienteForm.addEventListener('submit', (e) => this.handleSubmitCliente(e));
        }

        const servicoForm = document.getElementById('servico-form');
        if (servicoForm) {
            servicoForm.addEventListener('submit', (e) => this.handleSubmitServico(e));
        }

        const proposalForm = document.getElementById('proposal-form');
        if (proposalForm) {
            proposalForm.addEventListener('submit', (e) => this.handleSubmitProposta(e));
        }

        // Event listeners para modais
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });

        // Event listeners para busca de serviços
        const buscaServicos = document.getElementById('busca-servicos');
        if (buscaServicos) {
            buscaServicos.addEventListener('input', () => this.filtrarServicos());
        }
    }
}

// Adicionar estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
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

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .status-pendente {
        background-color: #ffc107;
        color: #000;
    }

    .status-aprovada {
        background-color: #28a745;
        color: #fff;
    }

    .status-recusada {
        background-color: #dc3545;
        color: #fff;
    }

    .actions-cell {
        white-space: nowrap;
    }

    .actions-cell button {
        margin: 0 0.25rem;
        padding: 0.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .btn-secondary {
        background-color: #6c757d;
        color: white;
    }

    .btn-secondary:hover {
        background-color: #5a6268;
    }

    .btn-danger {
        background-color: #dc3545;
        color: white;
    }

    .btn-danger:hover {
        background-color: #c82333;
    }
`;
document.head.appendChild(style);

