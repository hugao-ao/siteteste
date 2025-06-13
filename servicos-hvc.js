// propostas-hvc.js - Versão Corrigida
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
            console.log('PropostasManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar PropostasManager:', error);
        }
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
                    console.log('Botão Adicionar Serviço clicado - abrindo modal de SELEÇÃO');
                    this.addServicoToProposta(); // Abrir modal de seleção primeiro
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
        this.servicosAdicionados = [];
        this.updateServicesTable();
        this.updateTotal();
    }

    populateForm(proposta) {
        const numeroInput = document.getElementById('numero-proposta');
        const clienteSelect = document.getElementById('cliente-select');
        const statusSelect = document.getElementById('status-select');
        const prazoInput = document.getElementById('prazo-execucao');
        const tipoPrazoSelect = document.getElementById('tipo-prazo');
        const formaPagamentoInput = document.getElementById('forma-pagamento');
        const observacoesTextarea = document.getElementById('observacoes');
        
        if (numeroInput) numeroInput.value = proposta.numero_proposta;
        if (clienteSelect) clienteSelect.value = proposta.cliente_id;
        if (statusSelect) statusSelect.value = proposta.status;
        if (prazoInput) prazoInput.value = proposta.prazo_execucao || '';
        if (tipoPrazoSelect) tipoPrazoSelect.value = proposta.tipo_prazo || 'corridos';
        if (formaPagamentoInput) formaPagamentoInput.value = proposta.forma_pagamento || '';
        if (observacoesTextarea) observacoesTextarea.value = proposta.observacoes || '';
        
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

    showServicoSelectionModal() {
        console.log('Mostrando modal de seleção de serviços...');
        console.log('Serviços disponíveis:', this.servicos.length);
        console.log('Lista de serviços:', this.servicos);
        
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
        
        // Criar opções dos serviços com verificação de dados
        let servicosOptions = '<option value="">Selecione um serviço...</option>';
        
        this.servicos.forEach(servico => {
            if (servico && servico.id && servico.codigo && servico.descricao) {
                servicosOptions += `<option value="${servico.id}">${servico.codigo} - ${servico.descricao}</option>`;
            } else {
                console.warn('Serviço com dados incompletos:', servico);
            }
        });
        
        console.log('HTML das opções gerado:', servicosOptions);
        
        // Criar modal dinâmico para seleção de serviço
        const modal = document.createElement('div');
        modal.className = 'modal modal-selection show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">Selecionar Serviços</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label">Serviços Disponíveis</label>
                    <div style="max-height: 300px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 10px;">
                        ${this.createServicesCheckboxList()}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                        Cancelar
                    </button>
                    <button type="button" class="btn-info" onclick="window.propostasManager.showModalServicoFromSelection()" style="margin-right: 10px;">
                        <i class="fas fa-plus"></i>
                        Criar Novo Serviço
                    </button>
                    <button type="button" class="btn-success" onclick="window.propostasManager.addSelectedServicos()">
                        <i class="fas fa-check"></i>
                        Adicionar Selecionados
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        console.log('Modal de seleção criado e adicionado ao DOM');
        
        // Verificar se o select foi criado corretamente
        setTimeout(() => {
            const selectElement = document.getElementById('servico-selection');
            if (selectElement) {
                console.log('Select criado com', selectElement.options.length, 'opções');
                console.log('Opções do select:', Array.from(selectElement.options).map(opt => opt.text));
            } else {
                console.error('Select não foi criado corretamente');
            }
        }, 100);
    }

    addSelectedServico() {
        console.log('Função addSelectedServico chamada');
        
        const servicoSelect = document.getElementById('servico-selection');
        if (!servicoSelect) {
            console.error('Select de serviço não encontrado');
            return;
        }
        
        const servicoId = servicoSelect.value;
        console.log('Serviço selecionado ID:', servicoId);
        
        if (!servicoId) {
            this.showNotification('Selecione um serviço', 'warning');
            return;
        }

        const servico = this.servicos.find(s => s.id === servicoId);
        if (!servico) {
            console.error('Serviço não encontrado:', servicoId);
            return;
        }

        // Verificar se já foi adicionado
        if (this.servicosAdicionados.find(s => s.servico_id === servicoId)) {
            this.showNotification('Serviço já foi adicionado!', 'warning');
            return;
        }

        this.servicosAdicionados.push({
            servico_id: servicoId,
            servico: servico,
            quantidade: 1,
            preco_mao_obra: 0,
            preco_material: 0,
            preco_total: 0,
            modo_preco: 'separado' // 'separado' ou 'total'
        });

        console.log('Serviço adicionado:', servico.codigo);
        this.updateServicesTable();
        
        const modal = document.querySelector('.modal-selection');
        if (modal) modal.remove();
        
        this.showNotification('Serviço adicionado à proposta!', 'success');
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

    createServicesCheckboxList() {
        let checkboxList = '';
        
        this.servicos.forEach(servico => {
            if (servico && servico.id && servico.codigo && servico.descricao) {
                // Verificar se já foi adicionado
                const jaAdicionado = this.servicosAdicionados.find(s => s.servico_id === servico.id);
                const disabled = jaAdicionado ? 'disabled' : '';
                const checked = jaAdicionado ? 'checked' : '';
                
                checkboxList += `
                    <div style="display: flex; align-items: center; padding: 8px; margin: 5px 0; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        <input type="checkbox" 
                               id="servico-${servico.id}" 
                               value="${servico.id}" 
                               ${checked} 
                               ${disabled}
                               style="margin-right: 10px;">
                        <label for="servico-${servico.id}" style="flex: 1; cursor: pointer;">
                            <strong>${servico.codigo}</strong> - ${servico.descricao}
                            ${servico.unidade ? `<small style="color: #add8e6;"> (${servico.unidade})</small>` : ''}
                            ${jaAdicionado ? '<small style="color: #ffc107;"> - Já adicionado</small>' : ''}
                        </label>
                    </div>
                `;
            }
        });
        
        if (checkboxList === '') {
            checkboxList = '<p style="text-align: center; color: #888;">Nenhum serviço disponível</p>';
        }
        
        return checkboxList;
    }

    addSelectedServicos() {
        console.log('Adicionando serviços selecionados...');
        
        const checkboxes = document.querySelectorAll('.modal-selection input[type="checkbox"]:checked:not(:disabled)');
        let servicosAdicionadosCount = 0;
        
        checkboxes.forEach(checkbox => {
            const servicoId = checkbox.value;
            const servico = this.servicos.find(s => s.id === servicoId);
            
            if (servico && !this.servicosAdicionados.find(s => s.servico_id === servicoId)) {
                this.servicosAdicionados.push({
                    servico_id: servicoId,
                    servico: servico,
                    quantidade: 1,
                    preco_mao_obra: 0,
                    preco_material: 0,
                    preco_total: 0,
                    modo_preco: 'separado' // 'separado' ou 'total'
                });
                servicosAdicionadosCount++;
            }
        });
        
        if (servicosAdicionadosCount > 0) {
            this.updateServicesTable();
            this.showNotification(`${servicosAdicionadosCount} serviço(s) adicionado(s) à proposta!`, 'success');
        } else {
            this.showNotification('Nenhum serviço foi selecionado', 'warning');
        }
        
        // Fechar modal
        const modal = document.querySelector('.modal-selection');
        if (modal) modal.remove();
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
            return;
        }

        this.servicosAdicionados.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Determinar campos de preço baseado no modo
            let camposPreco = '';
            if (item.modo_preco === 'total') {
                camposPreco = `
                    <td style="background: rgba(255,255,255,0.05);">-</td>
                    <td style="background: rgba(255,255,255,0.05);">-</td>
                    <td>
                        <input type="number" 
                               value="${item.preco_total}" 
                               min="0" 
                               step="0.01"
                               onchange="window.propostasManager.updateItemPrecoTotal(${index}, this.value)"
                               style="width: 100px;"
                               placeholder="Valor total">
                    </td>
                `;
            } else {
                camposPreco = `
                    <td>
                        <input type="number" 
                               value="${item.preco_mao_obra}" 
                               min="0" 
                               step="0.01"
                               onchange="window.propostasManager.updateItemPrecoMaoObra(${index}, this.value)"
                               style="width: 100px;"
                               placeholder="Mão de obra">
                    </td>
                    <td>
                        <input type="number" 
                               value="${item.preco_material}" 
                               min="0" 
                               step="0.01"
                               onchange="window.propostasManager.updateItemPrecoMaterial(${index}, this.value)"
                               style="width: 100px;"
                               placeholder="Material">
                    </td>
                    <td>
                        <strong>R$ ${(item.preco_mao_obra + item.preco_material).toFixed(2)}</strong>
                    </td>
                `;
            }
            
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
                    <button class="btn-toggle-price" 
                            onclick="window.propostasManager.toggleModoPreco(${index})"
                            title="Alternar modo de preço">
                        <i class="fas fa-${item.modo_preco === 'total' ? 'calculator' : 'plus'}"></i>
                        ${item.modo_preco === 'total' ? 'Total' : 'M+M'}
                    </button>
                </td>
                ${camposPreco}
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

    toggleModoPreco(index) {
        const item = this.servicosAdicionados[index];
        
        if (item.modo_preco === 'separado') {
            // Mudando para modo total: somar mão de obra + material
            item.preco_total = item.preco_mao_obra + item.preco_material;
            item.modo_preco = 'total';
        } else {
            // Mudando para modo separado: dividir total igualmente ou zerar
            const metadeTotal = item.preco_total / 2;
            item.preco_mao_obra = metadeTotal;
            item.preco_material = metadeTotal;
            item.modo_preco = 'separado';
        }
        
        this.updateServicesTable();
    }

    updateItemPrecoTotal(index, valor) {
        const item = this.servicosAdicionados[index];
        item.preco_total = parseFloat(valor) || 0;
        this.updateTotal();
    }

    updateItemQuantidade(index, valor) {
        const item = this.servicosAdicionados[index];
        item.quantidade = parseFloat(valor) || 0;
        this.updateTotal();
    }

    updateItemPrecoMaoObra(index, valor) {
        const item = this.servicosAdicionados[index];
        item.preco_mao_obra = parseFloat(valor) || 0;
        if (item.modo_preco === 'separado') {
            item.preco_total = item.preco_mao_obra + item.preco_material;
        }
        this.updateTotal();
    }

    updateItemPrecoMaterial(index, valor) {
        const item = this.servicosAdicionados[index];
        item.preco_material = parseFloat(valor) || 0;
        if (item.modo_preco === 'separado') {
            item.preco_total = item.preco_mao_obra + item.preco_material;
        }
        this.updateTotal();
    }

    removeServico(index) {
        this.servicosAdicionados.splice(index, 1);
        this.updateServicesTable();
    }

    calculateTotalProposta() {
        return this.servicosAdicionados.reduce((sum, item) => {
            const itemTotal = item.modo_preco === 'total' ? 
                item.preco_total : 
                (item.preco_mao_obra + item.preco_material);
            return sum + (item.quantidade * itemTotal);
        }, 0);
    }

    updateTotal() {
        const total = this.calculateTotalProposta();
        
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            totalElement.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }
    }

    // === PROPOSTAS ===
    showFormProposta(proposta = null) {
        console.log('Mostrando formulário de proposta...');
        
        this.currentPropostaId = proposta?.id || null;
        
        // Mostrar formulário e esconder lista
        const formSection = document.getElementById('form-section');
        const listSection = document.getElementById('list-section');
        
        if (formSection) formSection.style.display = 'block';
        if (listSection) listSection.style.display = 'none';
        
        // Limpar formulário
        this.clearForm();
        
        // Se é edição, popular formulário
        if (proposta) {
            this.populateForm(proposta);
        } else {
            // Gerar número da proposta automaticamente
            this.generatePropostaNumber();
        }
    }

    updateItemPrecoMaoObra(index, preco) {
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].preco_mao_obra = parseFloat(preco) || 0;
            this.calculateItemTotal(index);
        }
    }

    updateItemPrecoMaterial(index, preco) {
        if (this.servicosAdicionados[index]) {
            this.servicosAdicionados[index].preco_material = parseFloat(preco) || 0;
            this.calculateItemTotal(index);
        }
    }

    calculateItemTotal(index) {
        const item = this.servicosAdicionados[index];
        if (item) {
            item.preco_total = item.quantidade * (item.preco_mao_obra + item.preco_material);
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
        const total = this.servicosAdicionados.reduce((sum, item) => sum + item.preco_total, 0);
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            totalElement.textContent = this.formatMoney(total);
        }
    }

    async handleSubmitProposta(e) {
        e.preventDefault();

        if (!this.validateForm()) return;

        const propostaData = {
            numero_proposta: document.getElementById('numero-proposta').value,
            cliente_id: document.getElementById('cliente-select').value,
            status: document.getElementById('status-select').value,
            prazo_execucao: parseInt(document.getElementById('prazo-execucao').value),
            tipo_prazo: document.getElementById('tipo-prazo').value,
            forma_pagamento: document.getElementById('forma-pagamento').value,
            observacoes: document.getElementById('observacoes').value,
            total_proposta: this.calculateTotalProposta()
        };

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

            this.hideFormProposta();
            this.loadPropostas();
            this.showNotification('Proposta salva com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            this.showNotification('Erro ao salvar proposta: ' + error.message, 'error');
        }
    }

    async saveItensProposta(propostaId) {
        // Remover itens existentes
        await supabaseClient
            .from('itens_proposta_hvc')
            .delete()
            .eq('proposta_id', propostaId);

        // Inserir novos itens
        const itens = this.servicosAdicionados.map(item => ({
            proposta_id: propostaId,
            servico_id: item.servico_id,
            quantidade: item.quantidade,
            preco_mao_obra: item.preco_mao_obra || 0,
            preco_material: item.preco_material || 0,
            preco_total: item.modo_preco === 'total' ? 
                item.preco_total : 
                (item.preco_mao_obra + item.preco_material)
        }));

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
        const prazoExecucao = document.getElementById('prazo-execucao').value;
        const formaPagamento = document.getElementById('forma-pagamento').value;
        
        if (!numeroProposta || !numeroProposta.match(/^\d{4}\/\d{4}$/)) {
            this.showNotification('Número da proposta deve estar no formato XXXX/YYYY', 'error');
            return false;
        }

        if (!clienteId) {
            this.showNotification('Selecione um cliente', 'error');
            return false;
        }

        if (!prazoExecucao || prazoExecucao <= 0) {
            this.showNotification('Informe o prazo de execução', 'error');
            return false;
        }

        if (!formaPagamento || formaPagamento.trim() === '') {
            this.showNotification('Informe a forma de pagamento', 'error');
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

    // === LISTA DE PROPOSTAS ===
    async loadPropostas() {
        try {
            console.log('Carregando propostas...');
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.allPropostas = data || []; // Armazenar todas as propostas
            this.populateClienteFilter(); // Popular filtro de clientes
            this.applyFilters(); // Aplicar filtros (inicialmente mostra todas)
            console.log('Propostas carregadas:', data?.length || 0);
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    populateClienteFilter() {
        const filterCliente = document.getElementById('filter-cliente');
        if (!filterCliente) return;

        // Obter clientes únicos das propostas
        const clientesUnicos = [...new Set(this.allPropostas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        
        // Limpar opções existentes (exceto "Todos os clientes")
        filterCliente.innerHTML = '<option value="">Todos os clientes</option>';
        
        // Adicionar opções de clientes
        clientesUnicos.forEach(nomeCliente => {
            const option = document.createElement('option');
            option.value = nomeCliente;
            option.textContent = nomeCliente;
            filterCliente.appendChild(option);
        });
    }

    applyFilters() {
        const filterStatus = document.getElementById('filter-status')?.value || '';
        const filterCliente = document.getElementById('filter-cliente')?.value || '';
        const filterNumero = document.getElementById('filter-numero')?.value || '';
        const filterDataInicio = document.getElementById('filter-data-inicio')?.value || '';
        const filterDataFim = document.getElementById('filter-data-fim')?.value || '';

        let propostasFiltradas = [...this.allPropostas];

        // Filtrar por status
        if (filterStatus) {
            propostasFiltradas = propostasFiltradas.filter(p => p.status === filterStatus);
        }

        // Filtrar por cliente
        if (filterCliente) {
            propostasFiltradas = propostasFiltradas.filter(p => p.clientes_hvc?.nome === filterCliente);
        }

        // Filtrar por número
        if (filterNumero) {
            propostasFiltradas = propostasFiltradas.filter(p => 
                p.numero_proposta?.toLowerCase().includes(filterNumero.toLowerCase())
            );
        }

        // Filtrar por data início
        if (filterDataInicio) {
            propostasFiltradas = propostasFiltradas.filter(p => 
                new Date(p.created_at) >= new Date(filterDataInicio)
            );
        }

        // Filtrar por data fim
        if (filterDataFim) {
            const dataFim = new Date(filterDataFim);
            dataFim.setHours(23, 59, 59, 999); // Incluir todo o dia
            propostasFiltradas = propostasFiltradas.filter(p => 
                new Date(p.created_at) <= dataFim
            );
        }

        this.renderPropostas(propostasFiltradas);
        
        // Mostrar contador de resultados
        const totalFiltradas = propostasFiltradas.length;
        const totalGeral = this.allPropostas.length;
        console.log(`Mostrando ${totalFiltradas} de ${totalGeral} propostas`);
    }

    clearFilters() {
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-cliente').value = '';
        document.getElementById('filter-numero').value = '';
        document.getElementById('filter-data-inicio').value = '';
        document.getElementById('filter-data-fim').value = '';
        
        this.applyFilters(); // Reaplica filtros (mostra todas)
        this.showNotification('Filtros limpos', 'success');
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
            const prazoTexto = proposta.prazo_execucao ? 
                `${proposta.prazo_execucao} ${proposta.tipo_prazo === 'uteis' ? 'dias úteis' : 'dias corridos'}` : 
                'Não informado';
            
            row.innerHTML = `
                <td>${proposta.numero_proposta}</td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td>R$ ${(proposta.total_proposta || 0).toFixed(2).replace('.', ',')}</td>
                <td>${prazoTexto}</td>
                <td>${proposta.forma_pagamento || 'Não informado'}</td>
                <td>
                    <span class="status-badge status-${proposta.status?.toLowerCase()}">
                        ${proposta.status}
                    </span>
                </td>
                <td>${new Date(proposta.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions">
                    <button class="btn-primary" 
                            onclick="window.propostasManager.editProposta('${proposta.id}')"
                            title="Editar proposta">
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

