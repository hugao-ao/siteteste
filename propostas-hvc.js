// propostas-hvc.js - Versão CORRIGIDA - Inicialização do PropostasManager
// Importar Supabase
import { supabase } from './supabase.js';

// Aguardar carregamento do Supabase
let supabaseClient = supabase;
let propostasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando PropostasManager...');
    initializeApp();
});

async function initializeApp() {
    try {
        // Aguardar um pouco para garantir que todos os scripts carregaram
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Inicializar o gerenciador de propostas
        propostasManager = new PropostasManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.propostasManager = propostasManager;
        
        console.log('PropostasManager inicializado com sucesso!');
    } catch (error) {
        console.error('Erro ao inicializar PropostasManager:', error);
    }
}

// NOVA FUNÇÃO: Garantir formato numérico correto
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
    
    // CORREÇÃO: Remover multiplicação por 100 que estava causando o problema
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
            // Aguardar o Supabase estar disponível
            await this.waitForSupabase();
            
            await this.loadClientes();
            await this.loadServicos();
            await this.loadPropostas();
            this.setupEventListeners();
            this.setupMasks();
            this.addFilterControls(); // Adicionar controles de filtro
            this.updateTableHeaders(); // Atualizar cabeçalhos da tabela
        } catch (error) {
            console.error('Erro ao inicializar PropostasManager:', error);
        }
    }

    async waitForSupabase() {
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
            // Verificar múltiplas formas de acesso ao Supabase
            if (window.supabaseClient || window.supabase || supabaseClient || (typeof supabase !== 'undefined')) {
                console.log('Supabase encontrado para PropostasManager!');
                
                // Definir referência global
                if (!window.supabaseClient) {
                    window.supabaseClient = window.supabase || supabaseClient || supabase;
                }
                
                // Atualizar referência local
                supabaseClient = window.supabaseClient;
                
                return;
            }
            
            attempts++;
            console.log(`Tentativa ${attempts}: Aguardando Supabase para PropostasManager...`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        throw new Error('Supabase não encontrado após múltiplas tentativas');
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

    // === CONTROLES DE FILTRO ===
    addFilterControls() {
        // Verificar se já existem controles de filtro
        if (document.getElementById('filter-controls')) return;

        const listSection = document.getElementById('list-section');
        if (!listSection) return;

        const filterControls = document.createElement('div');
        filterControls.id = 'filter-controls';
        filterControls.className = 'filter-controls';
        filterControls.innerHTML = `
            <div class="filter-row">
                <div class="filter-group">
                    <label for="filter-status">Status:</label>
                    <select id="filter-status" onchange="window.propostasManager.applyFilters()">
                        <option value="">Todos os status</option>
                        <option value="Rascunho">Rascunho</option>
                        <option value="Enviada">Enviada</option>
                        <option value="Aprovada">Aprovada</option>
                        <option value="Rejeitada">Rejeitada</option>
                        <option value="Em Execução">Em Execução</option>
                        <option value="Concluída">Concluída</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="filter-cliente">Cliente:</label>
                    <select id="filter-cliente" onchange="window.propostasManager.applyFilters()">
                        <option value="">Todos os clientes</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="filter-numero">Número:</label>
                    <input type="text" id="filter-numero" placeholder="Buscar por número..." 
                           onkeyup="window.propostasManager.applyFilters()">
                </div>
            </div>
            
            <div class="filter-row">
                <div class="filter-group">
                    <label for="filter-data-inicio">Data início:</label>
                    <input type="date" id="filter-data-inicio" onchange="window.propostasManager.applyFilters()">
                </div>
                
                <div class="filter-group">
                    <label for="filter-data-fim">Data fim:</label>
                    <input type="date" id="filter-data-fim" onchange="window.propostasManager.applyFilters()">
                </div>
                
                <div class="filter-group">
                    <button type="button" class="btn-secondary" onclick="window.propostasManager.clearFilters()">
                        <i class="fas fa-times"></i> Limpar Filtros
                    </button>
                </div>
            </div>
        `;

        // Inserir antes da tabela
        const tableContainer = listSection.querySelector('.table-container') || 
                              listSection.querySelector('table')?.parentElement;
        if (tableContainer) {
            listSection.insertBefore(filterControls, tableContainer);
        }
    }

    setupMasks() {
        // Implementar máscaras se necessário
        console.log('Máscaras configuradas');
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        try {
            // Botão Nova Proposta
            const btnNovaProposta = document.getElementById('btn-nova-proposta');
            if (btnNovaProposta) {
                btnNovaProposta.addEventListener('click', () => this.showFormProposta());
            }

            // Botão Voltar
            const btnVoltar = document.getElementById('btn-voltar');
            if (btnVoltar) {
                btnVoltar.addEventListener('click', () => this.hideFormProposta());
            }

            // Formulário de proposta
            const formProposta = document.getElementById('form-proposta');
            if (formProposta) {
                formProposta.addEventListener('submit', (e) => this.handleSubmitProposta(e));
            }

            // Botões de adicionar
            const btnAddServico = document.getElementById('btn-add-servico');
            if (btnAddServico) {
                btnAddServico.addEventListener('click', () => this.showServicoSelectionModal());
            }

            const btnAddCliente = document.getElementById('btn-add-cliente');
            if (btnAddCliente) {
                btnAddCliente.addEventListener('click', () => this.showModalCliente());
            }

            console.log('Event listeners configurados!');
        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    // === CLIENTES ===
    async loadClientes() {
        try {
            console.log('Carregando clientes...');
            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .select('*')
                .order('nome');

            if (error) throw error;

            this.clientes = data || [];
            this.populateClienteSelect();
            console.log('Clientes carregados:', data?.length || 0);
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
        console.log('Abrindo modal de cliente...');
        
        // Criar modal dinamicamente
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modal-cliente-temp';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Adicionar Novo Cliente</h3>
                    <button type="button" class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <form id="form-cliente-temp">
                    <div class="form-group">
                        <label for="cliente-nome">Nome *</label>
                        <input type="text" id="cliente-nome" required>
                    </div>
                    <div class="form-group">
                        <label for="cliente-documento">Documento *</label>
                        <input type="text" id="cliente-documento" required>
                    </div>
                    <div class="form-group">
                        <label for="cliente-tipo">Tipo de Documento *</label>
                        <select id="cliente-tipo" required>
                            <option value="">Selecione...</option>
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary">Salvar Cliente</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        // Event listener para o formulário
        const form = document.getElementById('form-cliente-temp');
        form.addEventListener('submit', (e) => this.handleSubmitCliente(e));
    }

    async handleSubmitCliente(e) {
        e.preventDefault();
        
        const clienteData = {
            nome: document.getElementById('cliente-nome').value,
            documento: document.getElementById('cliente-documento').value,
            tipo_documento: document.getElementById('cliente-tipo').value
        };

        try {
            const { data, error } = await supabaseClient
                .from('clientes_hvc')
                .insert([clienteData])
                .select();

            if (error) throw error;

            // Fechar modal
            document.getElementById('modal-cliente-temp').remove();
            
            // Recarregar clientes
            await this.loadClientes();
            
            // Selecionar o cliente recém-criado
            if (data && data[0]) {
                document.getElementById('cliente-select').value = data[0].id;
            }
            
            this.showNotification('Cliente adicionado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            this.showNotification('Erro ao salvar cliente: ' + error.message, 'error');
        }
    }

    // === SERVIÇOS ===
    async loadServicos() {
        try {
            console.log('Carregando serviços...');
            const { data, error } = await supabaseClient
                .from('servicos_hvc')
                .select('*')
                .order('codigo');

            if (error) throw error;

            this.servicos = data || [];
            console.log('Serviços carregados:', data?.length || 0);
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }

    showServicoSelectionModal() {
        console.log('Abrindo modal de seleção de serviços...');
        console.log('Serviços disponíveis:', this.servicos.length);
        
        if (this.servicos.length === 0) {
            this.showNotification('Nenhum serviço encontrado. Crie um serviço primeiro.', 'warning');
            return;
        }
        
        // Criar modal dinamicamente
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modal-servico-selection';
        
        // Criar lista de serviços com checkboxes
        let servicosHtml = '';
        this.servicos.forEach(servico => {
            const jaAdicionado = this.servicosAdicionados.find(s => s.servico_id === servico.id);
            const disabled = jaAdicionado ? 'disabled' : '';
            const checkedText = jaAdicionado ? '(já adicionado)' : '';
            
            servicosHtml += `
                <div class="servico-option">
                    <label>
                        <input type="checkbox" value="${servico.id}" ${disabled}>
                        <strong>${servico.codigo}</strong> - ${servico.descricao} ${checkedText}
                        <br><small>Unidade: ${servico.unidade || 'Não informada'}</small>
                    </label>
                </div>
            `;
        });
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Selecionar Serviços</h3>
                    <button type="button" class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="servicos-list">
                        ${servicosHtml}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button type="button" class="btn-primary" onclick="window.propostasManager.addSelectedServicos()">
                        <i class="fas fa-plus"></i>
                        Adicionar Selecionados
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        console.log('Modal de seleção criado e adicionado ao DOM');
    }

    addSelectedServicos() {
        const checkboxes = document.querySelectorAll('#modal-servico-selection input[type="checkbox"]:checked');
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
            this.showNotification('Nenhum serviço foi selecionado.', 'warning');
        }
        
        // Fechar modal
        document.getElementById('modal-servico-selection').remove();
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

    hideFormProposta() {
        const formSection = document.getElementById('form-section');
        const listSection = document.getElementById('list-section');
        
        if (formSection) formSection.style.display = 'none';
        if (listSection) listSection.style.display = 'block';
        
        this.clearForm();
    }

    clearForm() {
        // Limpar campos do formulário
        const form = document.getElementById('form-proposta');
        if (form) {
            form.reset();
        }
        
        // Limpar serviços adicionados
        this.servicosAdicionados = [];
        this.updateServicesTable();
        
        // Resetar ID atual
        this.currentPropostaId = null;
        
        // Atualizar título
        const titleElement = document.getElementById('form-title-text');
        if (titleElement) {
            titleElement.textContent = 'Nova Proposta';
        }
    }

    generatePropostaNumber() {
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 9999) + 1;
        const numeroFormatado = randomNum.toString().padStart(4, '0');
        
        const numeroElement = document.getElementById('numero-proposta');
        if (numeroElement) {
            numeroElement.value = `${numeroFormatado}/${year}`;
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
                    .select();
                
                if (error) throw error;
                proposta = data[0];
            } else {
                // Criar nova proposta
                const { data, error } = await supabaseClient
                    .from('propostas_hvc')
                    .insert([propostaData])
                    .select();
                
                if (error) throw error;
                proposta = data[0];
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
        const status = document.getElementById('status-select').value;
        const prazoExecucao = document.getElementById('prazo-execucao').value;
        const formaPagamento = document.getElementById('forma-pagamento').value;

        if (!numeroProposta) {
            this.showNotification('Número da proposta é obrigatório', 'error');
            return false;
        }

        if (!clienteId) {
            this.showNotification('Cliente é obrigatório', 'error');
            return false;
        }

        if (!status) {
            this.showNotification('Status é obrigatório', 'error');
            return false;
        }

        if (!prazoExecucao || prazoExecucao <= 0) {
            this.showNotification('Prazo de execução é obrigatório e deve ser maior que zero', 'error');
            return false;
        }

        if (!formaPagamento) {
            this.showNotification('Forma de pagamento é obrigatória', 'error');
            return false;
        }

        if (this.servicosAdicionados.length === 0) {
            this.showNotification('Adicione pelo menos um serviço à proposta', 'error');
            return false;
        }

        // Validar se todos os serviços têm preços
        for (let item of this.servicosAdicionados) {
            if (item.quantidade <= 0) {
                this.showNotification('Todos os serviços devem ter quantidade maior que zero', 'error');
                return false;
            }
            if (item.modo_preco === 'total' && item.preco_total <= 0) {
                this.showNotification('Todos os serviços devem ter preço total maior que zero', 'error');
                return false;
            }
            if (item.modo_preco === 'separado' && item.preco_mao_obra <= 0 && item.preco_material <= 0) {
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

            this.propostas = data || []; // Armazenar todas as propostas
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
        const clientesUnicos = [...new Set(this.propostas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        
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

        let propostasFiltradas = [...this.propostas];

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
        const totalGeral = this.propostas.length;
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
                <td>${proposta.observacoes || '-'}</td>
                <td>${new Date(proposta.created_at).toLocaleDateString('pt-BR')}</td>
                <td>
                    <button class="btn-primary btn-sm" 
                            onclick="window.propostasManager.editProposta('${proposta.id}')"
                            title="Editar proposta">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" 
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
                .select(`
                    *,
                    itens_proposta_hvc (
                        *,
                        servicos_hvc (*)
                    )
                `)
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
        if (!confirm('Tem certeza que deseja excluir esta proposta?')) return;

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

    populateForm(proposta) {
        // Popular campos básicos
        document.getElementById('numero-proposta').value = proposta.numero_proposta || '';
        document.getElementById('cliente-select').value = proposta.cliente_id || '';
        document.getElementById('status-select').value = proposta.status || '';
        document.getElementById('prazo-execucao').value = proposta.prazo_execucao || '';
        document.getElementById('tipo-prazo').value = proposta.tipo_prazo || 'corridos';
        document.getElementById('forma-pagamento').value = proposta.forma_pagamento || '';
        document.getElementById('observacoes').value = proposta.observacoes || '';

        // Atualizar título
        const titleElement = document.getElementById('form-title-text');
        if (titleElement) {
            titleElement.textContent = 'Editar Proposta';
        }

        // Carregar itens da proposta
        if (proposta.itens_proposta_hvc) {
            this.servicosAdicionados = proposta.itens_proposta_hvc.map(item => ({
                servico_id: item.servico_id,
                servico: item.servicos_hvc,
                quantidade: item.quantidade,
                preco_mao_obra: item.preco_mao_obra,
                preco_material: item.preco_material,
                preco_total: item.preco_total,
                modo_preco: (item.preco_mao_obra > 0 || item.preco_material > 0) ? 'separado' : 'total'
            }));

            this.updateServicesTable();
        }
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
        // Remover notificações existentes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Criar nova notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Adicionar estilos inline
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 300px;
            max-width: 500px;
            animation: slideIn 0.3s ease-out;
        `;

        // Adicionar ao body
        document.body.appendChild(notification);

        // Remover automaticamente após 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
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

