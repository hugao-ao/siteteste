// propostas-hvc.js - Versão Completa com Seleção Múltipla
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
        this.servicosAdicionados = [];
        this.updateServicesTable();
        this.updateTotal();
    }

    populateForm(proposta) {
        const numeroInput = document.getElementById('numero-proposta');
        const clienteSelect = document.getElementById('cliente-select');
        const statusSelect = document.getElementById('status-select');
        const observacoesTextarea = document.getElementById('observacoes');
        
        if (numeroInput) numeroInput.value = proposta.numero_proposta;
        if (clienteSelect) clienteSelect.value = proposta.cliente_id;
        if (statusSelect) statusSelect.value = proposta.status;
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

    // FUNÇÃO MODIFICADA PARA SELEÇÃO MÚLTIPLA
    showServicoSelectionModal() {
        console.log('Mostrando modal de seleção MÚLTIPLA de serviços...');
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
        
        // Criar lista de serviços com checkboxes
        let servicosCheckboxes = '';
        
        this.servicos.forEach(servico => {
            if (servico && servico.id && servico.codigo && servico.descricao) {
                // Verificar se já foi adicionado
                const jaAdicionado = this.servicosAdicionados.find(s => s.servico_id === servico.id);
                const disabled = jaAdicionado ? 'disabled' : '';
                const checkedClass = jaAdicionado ? 'servico-ja-adicionado' : '';
                
                servicosCheckboxes += `
                    <div class="servico-checkbox-item ${checkedClass}">
                        <label class="servico-checkbox-label">
                            <input type="checkbox" 
                                   value="${servico.id}" 
                                   class="servico-checkbox"
                                   ${disabled}>
                            <div class="servico-info">
                                <strong>${servico.codigo}</strong> - ${servico.descricao}
                                ${jaAdicionado ? '<span class="ja-adicionado-badge">Já adicionado</span>' : ''}
                            </div>
                        </label>
                    </div>
                `;
            } else {
                console.warn('Serviço com dados incompletos:', servico);
            }
        });
        
        console.log('HTML dos checkboxes gerado');
        
        // Criar modal dinâmico para seleção MÚLTIPLA de serviços
        const modal = document.createElement('div');
        modal.className = 'modal modal-selection show';
        modal.innerHTML = `
            <div class="modal-content modal-content-large">
                <div class="modal-header">
                    <h3 class="modal-title">Selecionar Serviços (Múltipla Seleção)</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="selecao-controles">
                        <button type="button" class="btn-info btn-small" onclick="window.propostasManager.selecionarTodosServicos()">
                            <i class="fas fa-check-double"></i> Selecionar Todos
                        </button>
                        <button type="button" class="btn-secondary btn-small" onclick="window.propostasManager.limparSelecaoServicos()">
                            <i class="fas fa-times"></i> Limpar Seleção
                        </button>
                        <span class="contador-selecionados">
                            <span id="contador-servicos">0</span> serviços selecionados
                        </span>
                    </div>
                    
                    <div class="servicos-lista">
                        ${servicosCheckboxes}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="button" class="btn-info" onclick="window.propostasManager.showModalServicoFromSelection()" style="margin-right: 10px;">
                        <i class="fas fa-plus"></i> Criar Novo Serviço
                    </button>
                    <button type="button" class="btn-success" onclick="window.propostasManager.addMultipleServicos()">
                        <i class="fas fa-plus-circle"></i> Adicionar Selecionados
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        console.log('Modal de seleção múltipla criado e adicionado ao DOM');
        
        // Configurar event listeners para os checkboxes
        setTimeout(() => {
            this.setupCheckboxListeners();
        }, 100);
    }

    // NOVAS FUNÇÕES PARA SELEÇÃO MÚLTIPLA
    
    // Função para configurar listeners dos checkboxes
    setupCheckboxListeners() {
        const checkboxes = document.querySelectorAll('.servico-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateContadorSelecionados();
            });
        });
        this.updateContadorSelecionados();
    }

    // Função para atualizar contador de selecionados
    updateContadorSelecionados() {
        const checkboxes = document.querySelectorAll('.servico-checkbox:checked');
        const contador = document.getElementById('contador-servicos');
        if (contador) {
            contador.textContent = checkboxes.length;
        }
    }

    // Função para selecionar todos os serviços
    selecionarTodosServicos() {
        const checkboxes = document.querySelectorAll('.servico-checkbox:not(:disabled)');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateContadorSelecionados();
    }

    // Função para limpar seleção
    limparSelecaoServicos() {
        const checkboxes = document.querySelectorAll('.servico-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateContadorSelecionados();
    }

    // NOVA FUNÇÃO PRINCIPAL - Adicionar múltiplos serviços
    addMultipleServicos() {
        console.log('Função addMultipleServicos chamada');
        
        const checkboxesSelecionados = document.querySelectorAll('.servico-checkbox:checked');
        
        if (checkboxesSelecionados.length === 0) {
            this.showNotification('Selecione pelo menos um serviço', 'warning');
            return;
        }

        let servicosAdicionados = 0;
        let servicosJaExistentes = 0;

        checkboxesSelecionados.forEach(checkbox => {
            const servicoId = checkbox.value;
            
            // Verificar se já foi adicionado
            if (this.servicosAdicionados.find(s => s.servico_id === servicoId)) {
                servicosJaExistentes++;
                return;
            }

            const servico = this.servicos.find(s => s.id === servicoId);
            if (!servico) {
                console.error('Serviço não encontrado:', servicoId);
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

            servicosAdicionados++;
            console.log('Serviço adicionado:', servico.codigo);
        });

        // Atualizar tabela
        this.updateServicesTable();
        
        // Fechar modal
        const modal = document.querySelector('.modal-selection');
        if (modal) modal.remove();
        
        // Mostrar notificação
        let mensagem = '';
        if (servicosAdicionados > 0) {
            mensagem = `${servicosAdicionados} serviço(s) adicionado(s) à proposta!`;
        }
        if (servicosJaExistentes > 0) {
            if (mensagem) mensagem += ` ${servicosJaExistentes} serviço(s) já estavam na proposta.`;
            else mensagem = `${servicosJaExistentes} serviço(s) já estavam na proposta.`;
        }
        
        if (servicosAdicionados > 0) {
            this.showNotification(mensagem, 'success');
        } else {
            this.showNotification(mensagem, 'warning');
        }
    }

    // FUNÇÃO MANTIDA PARA COMPATIBILIDADE (agora chama addMultipleServicos)
    addSelectedServico() {
        console.log('Função addSelectedServico chamada - redirecionando para addMultipleServicos');
        this.addMultipleServicos();
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
            this.servicosAdicionados[index].quantidade = parseFloat(quantidade) || 0;
            this.calculateItemTotal(index);
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
            observacoes: document.getElementById('observacoes').value,
            total_proposta: this.servicosAdicionados.reduce((sum, item) => sum + item.preco_total, 0)
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
            preco_mao_obra: item.preco_mao_obra,
            preco_material: item.preco_material,
            preco_total: item.preco_total
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

    // === LISTA DE PROPOSTAS ===
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

            this.renderPropostas(data || []);
            console.log('Propostas carregadas:', data?.length || 0);
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
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td><strong>${this.formatMoney(proposta.total_proposta)}</strong></td>
                <td>-</td>
                <td>-</td>
                <td>
                    <span class="status-badge status-${proposta.status.toLowerCase()}">
                        ${proposta.status}
                    </span>
                </td>
                <td>${new Date(proposta.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions-cell">
                    <button class="btn-secondary" 
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

