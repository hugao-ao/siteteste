// obras-hvc.js - Sistema de Gestão de Obras HVC (DUAS COLUNAS DE DATAS)
// Gerenciamento completo de obras com INÍCIO e FINAL no lugar de PREVISÃO
// 🎯 VERSÃO ATUALIZADA: Duas colunas de datas (data_inicio e data_final)

// Importar Supabase do arquivo existente
import { supabase as supabaseClient } from './supabase.js';

let obrasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando aplicação de obras...');
    initializeApp();
});

function initializeApp() {
    console.log('Inicializando aplicação de obras...');
    
    // Verificar se o Supabase está disponível
    if (supabaseClient) {
        console.log('Supabase conectado com sucesso!');
        
        // Inicializar o gerenciador de obras
        obrasManager = new ObrasManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.obrasManager = obrasManager;
    } else {
        console.error('Erro: Supabase não disponível');
        // Mostrar mensagem de erro para o usuário
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f8f9fa;">
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc3545; margin-bottom: 1rem;"></i>
                    <h2 style="color: #dc3545; margin-bottom: 1rem;">Erro de Conexão</h2>
                    <p style="color: #666;">Não foi possível conectar ao banco de dados.</p>
                    <p style="color: #666;">Verifique a configuração do Supabase.</p>
                </div>
            </div>
        `;
    }
}

class ObrasManager {
    constructor() {
        this.currentObraId = null;
        this.propostasSelecionadas = [];
        this.propostas = [];
        this.obras = [];
        this.servicosAndamento = [];
        this.locais = []; // ✅ ADICIONADO: Array para armazenar os locais
        
        // Variáveis para Produções Diárias
        this.producoesDiarias = [];
        this.equipesIntegrantes = [];
        this.currentProducaoId = null;
        this.servicosObra = [];
        
        this.init();
    }

    async init() {
        console.log('Inicializando ObrasManager...');
        
        try {
            await this.loadPropostas();
            await this.loadObras();
            await this.loadLocais(); // ✅ ADICIONADO: Carregar locais
            this.setupEventListeners();
            this.setupMasks();
            this.setupFilters();
            console.log('ObrasManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar ObrasManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    // ✅ ADICIONADO: Função para carregar locais
    async loadLocais() {
        try {
            console.log('Carregando locais...');
            
            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .select('*')
                .eq('ativo', true)
                .order('nome');

            if (error) throw error;

            this.locais = data || [];
            console.log('Locais carregados:', this.locais.length);
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            this.showNotification('Erro ao carregar locais: ' + error.message, 'error');
        }
    }

    // ✅ ADICIONADO: Função para obter nome do local
    getLocalNome(localId) {
        if (!localId) return '-';
        const local = this.locais.find(l => l.id === localId);
        return local ? local.nome : '-';
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        try {
            // Botões principais
            const btnNovaObra = document.getElementById('btn-nova-obra');
            const btnCancelar = document.getElementById('btn-cancelar');
            const btnAndamento = document.getElementById('btn-andamento');
            
            if (btnNovaObra) {
                btnNovaObra.addEventListener('click', () => this.showFormObra());
            }
            if (btnCancelar) {
                btnCancelar.addEventListener('click', () => this.hideFormObra());
            }
            if (btnAndamento) {
                btnAndamento.addEventListener('click', () => this.showModalAndamento());
            }
            
            // Formulário de obra
            const obraForm = document.getElementById('obra-form');
            if (obraForm) {
                obraForm.addEventListener('submit', (e) => this.handleSubmitObra(e));
            }
            
            // Botão adicionar propostas
            const btnAddPropostas = document.getElementById('btn-add-propostas');
            if (btnAddPropostas) {
                btnAddPropostas.addEventListener('click', () => this.showModalPropostas());
            }
            
            // Modal de propostas
            const closeModalPropostas = document.getElementById('close-modal-propostas');
            const cancelPropostas = document.getElementById('cancel-propostas');
            const btnAdicionarPropostas = document.getElementById('btn-adicionar-propostas');
            const btnSelecionarTodas = document.getElementById('btn-selecionar-todas');
            const btnLimparSelecao = document.getElementById('btn-limpar-selecao');
            
            if (closeModalPropostas) {
                closeModalPropostas.addEventListener('click', () => this.hideModalPropostas());
            }
            if (cancelPropostas) {
                cancelPropostas.addEventListener('click', () => this.hideModalPropostas());
            }
            if (btnAdicionarPropostas) {
                btnAdicionarPropostas.addEventListener('click', () => this.addSelectedPropostas());
            }
            if (btnSelecionarTodas) {
                btnSelecionarTodas.addEventListener('click', () => this.selecionarTodasPropostas());
            }
            if (btnLimparSelecao) {
                btnLimparSelecao.addEventListener('click', () => this.limparSelecaoPropostas());
            }
            
            // Modal de andamento
            const closeModalAndamento = document.getElementById('close-modal-andamento');
            const cancelAndamento = document.getElementById('cancel-andamento');
            const btnSalvarAndamento = document.getElementById('btn-salvar-andamento');
            
            if (closeModalAndamento) {
                closeModalAndamento.addEventListener('click', () => this.hideModalAndamento());
            }
            if (cancelAndamento) {
                cancelAndamento.addEventListener('click', () => this.hideModalAndamento());
            }
            if (btnSalvarAndamento) {
                btnSalvarAndamento.addEventListener('click', () => this.salvarAndamento());
            }
            
            // Fechar modal clicando fora
            const modalPropostas = document.getElementById('modal-propostas');
            const modalAndamento = document.getElementById('modal-andamento');
            
            if (modalPropostas) {
                modalPropostas.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-propostas') this.hideModalPropostas();
                });
            }
            if (modalAndamento) {
                modalAndamento.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-andamento') this.hideModalAndamento();
                });
            }
            
            // Filtro de propostas no modal
            const filtroPropostasModal = document.getElementById('filtro-propostas-modal');
            if (filtroPropostasModal) {
                filtroPropostasModal.addEventListener('keyup', (e) => {
                    this.filtrarPropostasModal(e.target.value);
                });
            }
            
            // Event listeners para Produções Diárias
            const btnNovaProducao = document.getElementById('btn-nova-producao');
            const closeModalProducao = document.getElementById('close-modal-producao');
            const cancelProducao = document.getElementById('cancel-producao');
            const formProducao = document.getElementById('form-producao');
            const filtroDataProducao = document.getElementById('filtro-data-producao');
            const filtroEquipeProducao = document.getElementById('filtro-equipe-producao');
            const btnLimparFiltrosProducao = document.getElementById('btn-limpar-filtros-producao');
            
            if (btnNovaProducao) {
                btnNovaProducao.addEventListener('click', () => this.showModalProducao());
            }
            if (closeModalProducao) {
                closeModalProducao.addEventListener('click', () => this.hideModalProducao());
            }
            if (cancelProducao) {
                cancelProducao.addEventListener('click', () => this.hideModalProducao());
            }
            if (formProducao) {
                formProducao.addEventListener('submit', (e) => this.handleSubmitProducao(e));
            }
            if (filtroDataProducao) {
                filtroDataProducao.addEventListener('change', () => this.filtrarProducoes());
            }
            if (filtroEquipeProducao) {
                filtroEquipeProducao.addEventListener('change', () => this.filtrarProducoes());
            }
            if (btnLimparFiltrosProducao) {
                btnLimparFiltrosProducao.addEventListener('click', () => this.limparFiltrosProducao());
            }
            
            // Fechar modal de produção clicando fora
            const modalProducao = document.getElementById('modal-producao');
            if (modalProducao) {
                modalProducao.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-producao') this.hideModalProducao();
                });
            }
            
            console.log('Event listeners configurados!');
        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    setupMasks() {
        // Máscara para número da obra (XXXX/YYYY)
        const numeroInput = document.getElementById('numero-obra');
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

    setupFilters() {
        // Filtros da lista de obras
        const filtroBusca = document.getElementById('filtro-busca-obra');
        const filtroStatus = document.getElementById('filtro-status-obra');
        const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
        
        if (filtroBusca) {
            filtroBusca.addEventListener('keyup', () => this.filtrarObras());
        }
        if (filtroStatus) {
            filtroStatus.addEventListener('change', () => this.filtrarObras());
        }
        if (btnLimparFiltros) {
            btnLimparFiltros.addEventListener('click', () => this.limparFiltros());
        }
    }

    formatMoney(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    // === PROPOSTAS ===
    async loadPropostas() {
        try {
            console.log('Carregando propostas...');
            
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .eq('status', 'Aprovada') // Apenas propostas aprovadas podem virar obras
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.propostas = data || [];
            console.log('Propostas carregadas:', this.propostas.length);
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    // === OBRAS ===
    showFormObra(obra = null) {
        console.log('Mostrando formulário de obra...');
        
        this.currentObraId = obra?.id || null;
        
        const formSection = document.getElementById('form-obra');
        const titleText = document.getElementById('form-title-text');
        
        if (formSection) {
            if (obra) {
                if (titleText) titleText.textContent = 'Editar Obra';
                this.populateFormObra(obra);
            } else {
                if (titleText) titleText.textContent = 'Nova Obra';
                this.clearFormObra();
            }
            
            formSection.classList.remove('hidden');
            formSection.scrollIntoView({ behavior: 'smooth' });
            console.log('Formulário de obra exibido');
        }
    }

    hideFormObra() {
        const formSection = document.getElementById('form-obra');
        if (formSection) {
            formSection.classList.add('hidden');
        }
        this.clearFormObra();
        this.currentObraId = null;
    }

    clearFormObra() {
        const form = document.getElementById('obra-form');
        if (form) form.reset();
        
        this.propostasSelecionadas = [];
        this.updatePropostasTable();
        this.updateResumoObra();
    }

    populateFormObra(obra) {
        const numeroInput = document.getElementById('numero-obra');
        const statusSelect = document.getElementById('status-obra');
        const observacoesTextarea = document.getElementById('observacoes-obra');
        
        if (numeroInput) numeroInput.value = obra.numero_obra;
        if (statusSelect) statusSelect.value = obra.status;
        if (observacoesTextarea) observacoesTextarea.value = obra.observacoes || '';
        
        // Carregar propostas da obra
        this.loadPropostasObra(obra.id);
    }

    async loadPropostasObra(obraId) {
        try {
            console.log('Carregando propostas da obra:', obraId);
            
            const { data, error } = await supabaseClient
                .from('obras_propostas')
                .select(`
                    propostas_hvc (
                        *,
                        clientes_hvc (nome)
                    )
                `)
                .eq('obra_id', obraId);

            if (error) throw error;

            this.propostasSelecionadas = data?.map(item => item.propostas_hvc) || [];
            this.updatePropostasTable();
            await this.updateResumoObra();
            
        } catch (error) {
            console.error('Erro ao carregar propostas da obra:', error);
        }
    }

    // === MODAL DE PROPOSTAS ===
    showModalPropostas() {
        console.log('Mostrando modal de seleção de propostas...');
        
        const modal = document.getElementById('modal-propostas');
        if (modal) {
            modal.classList.add('show');
            this.renderPropostasModal();
        }
    }

    hideModalPropostas() {
        const modal = document.getElementById('modal-propostas');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    renderPropostasModal() {
        const container = document.getElementById('lista-propostas-modal');
        if (!container) return;
        
        container.innerHTML = '';

        if (this.propostas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-file-contract" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma proposta aprovada encontrada.
                </div>
            `;
            return;
        }

        // Filtrar propostas que já não estão na obra
        const propostasDisponiveis = this.propostas.filter(proposta => 
            !this.propostasSelecionadas.find(p => p.id === proposta.id)
        );

        if (propostasDisponiveis.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Todas as propostas disponíveis já foram adicionadas à obra.
                </div>
            `;
            return;
        }

        propostasDisponiveis.forEach(proposta => {
            const item = document.createElement('div');
            item.className = 'proposta-item';
            item.style.cssText = `
                display: flex;
                align-items: center;
                padding: 1rem;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                margin-bottom: 0.5rem;
                background: white;
                transition: all 0.3s ease;
            `;
            
            item.innerHTML = `
                <input type="checkbox" 
                       value="${proposta.id}" 
                       id="proposta-${proposta.id}"
                       style="margin-right: 1rem; transform: scale(1.2);">
                <label for="proposta-${proposta.id}" style="flex: 1; cursor: pointer; margin: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #2c3e50;">${proposta.numero_proposta}</strong>
                            <br>
                            <span style="color: #666;">${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</span>
                        </div>
                        <div style="text-align: right;">
                            <strong style="color: #28a745;">${this.formatMoney(proposta.total_proposta)}</strong>
                            <br>
                            <small style="color: #ffc107;">${proposta.status}</small>
                        </div>
                    </div>
                </label>
            `;
            
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f8f9fa';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'white';
            });
            
            container.appendChild(item);
        });

        this.updateContadorPropostas();
        this.configurarEventosCheckboxesPropostas();
    }

    configurarEventosCheckboxesPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateContadorPropostas();
            });
        });
    }

    updateContadorPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]:checked');
        const contador = document.getElementById('contador-propostas');
        const btnAdicionar = document.getElementById('btn-adicionar-propostas');
        
        if (contador) {
            const quantidade = checkboxes.length;
            contador.textContent = `${quantidade} proposta${quantidade !== 1 ? 's' : ''} selecionada${quantidade !== 1 ? 's' : ''}`;
        }
        
        if (btnAdicionar) {
            btnAdicionar.disabled = checkboxes.length === 0;
            btnAdicionar.style.opacity = checkboxes.length === 0 ? '0.5' : '1';
        }
    }

    filtrarPropostasModal(termo) {
        const items = document.querySelectorAll('.proposta-item');
        const termoLower = termo.toLowerCase();
        
        items.forEach(item => {
            const texto = item.textContent.toLowerCase();
            if (texto.includes(termoLower)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    selecionarTodasPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const item = checkbox.closest('.proposta-item');
            if (item.style.display !== 'none') {
                checkbox.checked = true;
            }
        });
        this.updateContadorPropostas();
    }

    limparSelecaoPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateContadorPropostas();
    }

    addSelectedPropostas() {
        const checkboxesSelecionados = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]:checked');
        
        if (checkboxesSelecionados.length === 0) {
            this.showNotification('Selecione pelo menos uma proposta', 'warning');
            return;
        }

        checkboxesSelecionados.forEach(checkbox => {
            const propostaId = checkbox.value;
            const proposta = this.propostas.find(p => p.id === propostaId);
            
            if (proposta && !this.propostasSelecionadas.find(p => p.id === propostaId)) {
                this.propostasSelecionadas.push(proposta);
            }
        });

        this.updatePropostasTable();
        this.updateResumoObra();
        this.hideModalPropostas();
        
        this.showNotification(`${checkboxesSelecionados.length} proposta(s) adicionada(s) à obra!`, 'success');
    }

    updatePropostasTable() {
        const tbody = document.getElementById('propostas-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this.propostasSelecionadas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-file-contract" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma proposta adicionada. Clique em "Adicionar Propostas" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        this.propostasSelecionadas.forEach((proposta, index) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${proposta.numero_proposta}</strong></td>
                <td>${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td><strong>${this.formatMoney(proposta.total_proposta)}</strong></td>
                <td><span class="status-badge status-${proposta.status.toLowerCase()}">${proposta.status}</span></td>
                <td class="actions-cell">
                    <button class="btn-danger" onclick="window.obrasManager.removeProposta(${index})" title="Remover proposta">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    removeProposta(index) {
        if (confirm('Tem certeza que deseja remover esta proposta da obra?')) {
            this.propostasSelecionadas.splice(index, 1);
            this.updatePropostasTable();
            this.updateResumoObra();
            this.showNotification('Proposta removida da obra!', 'success');
        }
    }

    async updateResumoObra() {
        const totalPropostas = this.propostasSelecionadas.length;
        const clientesUnicos = [...new Set(this.propostasSelecionadas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        const valorTotal = this.propostasSelecionadas.reduce((sum, p) => sum + (parseFloat(p.total_proposta) || 0), 0);
        
        // Calcular progresso baseado no andamento dos serviços
        let progressoGeral = 0;
        if (this.currentObraId && this.servicosAndamento.length > 0) {
            try {
                const { data: andamentos, error } = await supabaseClient
                    .from('servicos_andamento')
                    .select('status')
                    .eq('obra_id', this.currentObraId);
                
                if (!error && andamentos && andamentos.length > 0) {
                    const totalServicos = andamentos.length;
                    const servicosConcluidos = andamentos.filter(a => a.status === 'CONCLUIDO').length;
                    const servicosIniciados = andamentos.filter(a => a.status === 'INICIADO').length;
                    
                    // Concluídos = 100%, Iniciados = 50%, Pendentes = 0%
                    const pontuacaoTotal = (servicosConcluidos * 100) + (servicosIniciados * 50);
                    progressoGeral = Math.round(pontuacaoTotal / (totalServicos * 100) * 100);
                }
            } catch (error) {
                console.error('Erro ao calcular progresso:', error);
            }
        }
        
        // Atualizar elementos do resumo
        const totalPropostasEl = document.getElementById('total-propostas');
        const totalClientesEl = document.getElementById('total-clientes');
        const valorTotalEl = document.getElementById('valor-total-obra');
        const progressoEl = document.getElementById('progresso-geral');
        
        if (totalPropostasEl) totalPropostasEl.textContent = totalPropostas;
        if (totalClientesEl) totalClientesEl.textContent = clientesUnicos.length;
        if (valorTotalEl) valorTotalEl.textContent = this.formatMoney(valorTotal);
        if (progressoEl) progressoEl.textContent = `${progressoGeral}%`;
    }

    // === FORMULÁRIO DE OBRA ===
    async handleSubmitObra(e) {
        e.preventDefault();
        
        try {
            const numeroObra = document.getElementById('numero-obra').value;
            const statusObra = document.getElementById('status-obra').value;
            const observacoes = document.getElementById('observacoes-obra').value;
            
            if (!numeroObra || !numeroObra.match(/^\d{4}\/\d{4}$/)) {
                this.showNotification('Número da obra deve estar no formato XXXX/YYYY', 'error');
                return;
            }
            
            if (this.propostasSelecionadas.length === 0) {
                this.showNotification('Adicione pelo menos uma proposta à obra', 'error');
                return;
            }
            
            const obraData = {
                numero_obra: numeroObra,
                status: statusObra,
                observacoes: observacoes
            };
            
            let obra;
            
            if (this.currentObraId) {
                // Atualizar obra existente
                const { data, error } = await supabaseClient
                    .from('obras_hvc')
                    .update(obraData)
                    .eq('id', this.currentObraId)
                    .select()
                    .single();
                
                if (error) throw error;
                obra = data;
                
            } else {
                // Criar nova obra
                const { data, error } = await supabaseClient
                    .from('obras_hvc')
                    .insert([obraData])
                    .select()
                    .single();
                
                if (error) throw error;
                obra = data;
                this.currentObraId = obra.id;
            }
            
            // Salvar relação obras_propostas
            await this.saveObrasPropostas(obra.id);
            
            this.hideFormObra();
            await this.loadObras();
            
            this.showNotification('Obra salva com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao salvar obra:', error);
            this.showNotification('Erro ao salvar obra: ' + error.message, 'error');
        }
    }

    async saveObrasPropostas(obraId) {
        // Remover relações existentes
        await supabaseClient
            .from('obras_propostas')
            .delete()
            .eq('obra_id', obraId);
        
        // Inserir novas relações
        const relacoes = this.propostasSelecionadas.map(proposta => ({
            obra_id: obraId,
            proposta_id: proposta.id
        }));
        
        if (relacoes.length > 0) {
            const { error } = await supabaseClient
                .from('obras_propostas')
                .insert(relacoes);
            
            if (error) throw error;
        }
    }

    // === LISTA DE OBRAS ===
    async loadObras() {
        try {
            console.log('Carregando obras...');
            
            const { data, error } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    obras_propostas (
                        propostas_hvc (
                            *,
                            clientes_hvc (nome)
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.obras = data || [];
            this.renderObras(this.obras);
            console.log('Obras carregadas:', this.obras.length);
            
        } catch (error) {
            console.error('Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    renderObras(obras) {
        const tbody = document.getElementById('obras-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (obras.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-building" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma obra encontrada. Clique em "Nova Obra" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        obras.forEach(obra => {
            const propostas = obra.obras_propostas || [];
            const clientesUnicos = [...new Set(propostas.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean))];
            const valorTotal = propostas.reduce((sum, op) => sum + (parseFloat(op.propostas_hvc?.total_proposta) || 0), 0);
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${obra.numero_obra}</strong></td>
                <td>${clientesUnicos.join(', ') || 'Nenhum cliente'}</td>
                <td><strong>${this.formatMoney(valorTotal)}</strong></td>
                <td class="percentual-cell">
                    <div class="percentual-container">
                        <div class="percentual-bar">
                            <div class="percentual-fill" style="width: 50%;">50%</div>
                        </div>
                        <span class="percentual-text">50%</span>
                    </div>
                </td>
                <td><span class="status-badge status-${obra.status.toLowerCase()}">${obra.status}</span></td>
                <td class="actions-cell">
                    <button class="btn-secondary" onclick="window.obrasManager.editObra('${obra.id}')" title="Editar obra">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-info" onclick="window.obrasManager.gerenciarAndamentoObra('${obra.id}')" title="Gerenciar andamento">
                        <i class="fas fa-tasks"></i>
                    </button>
                    <button class="btn-danger" onclick="window.obrasManager.deleteObra('${obra.id}')" title="Excluir obra">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async editObra(obraId) {
        try {
            const { data: obra, error } = await supabaseClient
                .from('obras_hvc')
                .select('*')
                .eq('id', obraId)
                .single();

            if (error) throw error;

            this.showFormObra(obra);
            
        } catch (error) {
            console.error('Erro ao carregar obra:', error);
            this.showNotification('Erro ao carregar obra: ' + error.message, 'error');
        }
    }

    async gerenciarAndamentoObra(obraId) {
        try {
            // Carregar obra e suas propostas
            const { data: obra, error } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    obras_propostas (
                        propostas_hvc (
                            *,
                            clientes_hvc (nome)
                        )
                    )
                `)
                .eq('id', obraId)
                .single();

            if (error) throw error;

            this.currentObraId = obraId;
            this.propostasSelecionadas = obra.obras_propostas?.map(op => op.propostas_hvc) || [];
            
            this.showModalAndamento();
            
        } catch (error) {
            console.error('Erro ao carregar obra para andamento:', error);
            this.showNotification('Erro ao carregar obra: ' + error.message, 'error');
        }
    }

    async deleteObra(obraId) {
        if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            // Remover relações obras_propostas
            await supabaseClient
                .from('obras_propostas')
                .delete()
                .eq('obra_id', obraId);

            // Remover andamentos de serviços
            await supabaseClient
                .from('servicos_andamento')
                .delete()
                .eq('obra_id', obraId);

            // Remover produções diárias
            await supabaseClient
                .from('producoes_diarias')
                .delete()
                .eq('obra_id', obraId);

            // Remover obra
            const { error } = await supabaseClient
                .from('obras_hvc')
                .delete()
                .eq('id', obraId);

            if (error) throw error;

            await this.loadObras();
            this.showNotification('Obra excluída com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao excluir obra:', error);
            this.showNotification('Erro ao excluir obra: ' + error.message, 'error');
        }
    }

    // === FILTROS ===
    filtrarObras() {
        const busca = document.getElementById('filtro-busca-obra')?.value.toLowerCase() || '';
        const status = document.getElementById('filtro-status-obra')?.value || '';

        let obrasFiltradas = this.obras.filter(obra => {
            if (busca) {
                const propostas = obra.obras_propostas || [];
                const clientes = propostas.map(op => op.propostas_hvc?.clientes_hvc?.nome || '').join(' ').toLowerCase();
                const textoBusca = `${obra.numero_obra} ${clientes}`.toLowerCase();
                if (!textoBusca.includes(busca)) return false;
            }

            if (status && obra.status !== status) return false;

            return true;
        });

        this.renderObras(obrasFiltradas);
    }

    limparFiltros() {
        document.getElementById('filtro-busca-obra').value = '';
        document.getElementById('filtro-status-obra').value = '';
        this.renderObras(this.obras);
    }

    // 🎯 DUAS DATAS - Atualizar percentual no banco
    async atualizarPercentualObra(obraId, percentual) {
        try {
            console.log(`🎯 DUAS DATAS - Atualizando percentual da obra ${obraId} para ${percentual}%`);
            
            const { error } = await supabaseClient
                .from('obras_hvc')
                .update({ percentual_conclusao: percentual })
                .eq('id', obraId);
            
            if (error) throw error;
            
            console.log(`🎯 DUAS DATAS - Percentual atualizado com sucesso: ${percentual}%`);
        } catch (error) {
            console.error('🎯 DUAS DATAS - Erro na atualização do banco:', error);
        }
    }

    // === MODAL DE ANDAMENTO ===
    async showModalAndamento() {
        if (!this.currentObraId) {
            this.showNotification('Selecione uma obra primeiro', 'warning');
            return;
        }
        
        const modal = document.getElementById('modal-andamento');
        if (modal) {
            modal.classList.add('show');
            
            // 🎯 CORREÇÃO: Carregar produções diárias ANTES de renderizar serviços
            await this.loadEquipesIntegrantes();
            await this.loadProducoesDiarias();
            await this.renderServicosAndamento();
            
            // Popular filtro de equipes/integrantes
            await this.populateFiltroEquipeProducao();
        }
    }

    hideModalAndamento() {
        const modal = document.getElementById('modal-andamento');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async renderServicosAndamento() {
        const container = document.getElementById('servicos-andamento');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">Carregando serviços...</div>';
        
        try {
            // ✅ MODIFICADO: Carregar todos os serviços das propostas selecionadas COM LOCAL
            const servicosPromises = this.propostasSelecionadas.map(async (proposta) => {
                const { data, error } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .select(`
                        *,
                        servicos_hvc (*),
                        propostas_hvc (numero_proposta),
                        locais_hvc (nome)
                    `)
                    .eq('proposta_id', proposta.id);
                
                if (error) throw error;
                return data || [];
            });
            
            const servicosArrays = await Promise.all(servicosPromises);
            const todosServicos = servicosArrays.flat();
            
            // Carregar andamentos existentes para esta obra
            let andamentosExistentes = [];
            if (this.currentObraId) {
                const { data: andamentos, error: errorAndamentos } = await supabaseClient
                    .from('servicos_andamento')
                    .select('*')
                    .eq('obra_id', this.currentObraId);
                
                if (!errorAndamentos) {
                    andamentosExistentes = andamentos || [];
                }
            }
            
            if (todosServicos.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhum serviço encontrado nas propostas selecionadas.
                    </div>
                `;
                return;
            }
            
            // ✅ MODIFICADO: TABELA COM COLUNA LOCAL ADICIONADA
            container.innerHTML = `
                <table class="propostas-table" style="width: 100%; font-size: 0.9rem;">
                    <thead>
                        <tr>
                            <th style="min-width: 100px;">Proposta</th>
                            <th style="min-width: 150px;">Serviço</th>
                            <th style="min-width: 120px;">Local</th>
                            <th style="min-width: 80px;">Quantidade</th>
                            <th style="min-width: 120px;">Valor Total</th>
                            <th style="min-width: 160px;">Status</th>
                            <th style="min-width: 120px;">Início</th>
                            <th style="min-width: 120px;">Final</th>
                            <th style="min-width: 220px;">Observações</th>
                        </tr>
                    </thead>
                    <tbody id="servicos-andamento-tbody">
                    </tbody>
                </table>
            `;
            
            const tbody = document.getElementById('servicos-andamento-tbody');
            
            todosServicos.forEach((item, index) => {
                // Buscar andamento existente para este item
                const andamentoExistente = andamentosExistentes.find(a => a.item_proposta_id === item.id);
                
                // Usar preco_total diretamente
                const precoTotal = parseFloat(item.preco_total) || 0;
                const quantidade = parseFloat(item.quantidade) || 1;
                
                // Calcular quantidades executadas nas produções diárias para este serviço
                let quantidadeExecutada = 0;
                if (this.producoesDiarias && this.producoesDiarias.length > 0) {
                    this.producoesDiarias.forEach(producao => {
                        const quantidades = producao.quantidades_servicos || {};
                        const servicoId = item.servicos_hvc?.id;
                        if (servicoId && quantidades[servicoId]) {
                            quantidadeExecutada += parseFloat(quantidades[servicoId]) || 0;
                        }
                    });
                }
                
                // Formatar quantidade: "executado / total unidade"
                const unidade = item.servicos_hvc?.unidade || '';
                const quantidadeTexto = quantidadeExecutada > 0 
                    ? `${quantidadeExecutada} / ${quantidade} ${unidade}`.trim()
                    : `${quantidade} ${unidade}`.trim();
                
                // ✅ ADICIONADO: Obter nome do local
                const localNome = this.getLocalNome(item.local_id);
                
                console.log(`🎯 DUAS DATAS MODAL - Item ${item.id}:`, {
                    precoTotal,
                    quantidade,
                    quantidadeExecutada
                });
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${item.propostas_hvc?.numero_proposta}</strong></td>
                    <td>
                        <strong>${item.servicos_hvc?.codigo}</strong><br>
                        <small style="color: #add8e6;">${item.servicos_hvc?.descricao}</small>
                    </td>
                    <td>
                        <span style="color: #20c997; font-weight: 600;">${localNome}</span>
                    </td>
                    <td>
                        <strong style="color: ${quantidadeExecutada > 0 ? '#90EE90' : '#e0e0e0'};">
                            ${quantidadeTexto}
                        </strong>
                    </td>
                    <td><strong style="color: #20c997;">${this.formatMoney(precoTotal)}</strong></td>
                    <td>
                        <select class="form-select status-servico" data-index="${index}" style="width: 160px; padding: 8px; font-size: 0.85rem;">
                            <option value="PENDENTE" ${andamentoExistente?.status === 'PENDENTE' ? 'selected' : ''}>Pendente (0%)</option>
                            <option value="INICIADO" ${andamentoExistente?.status === 'INICIADO' ? 'selected' : ''}>Iniciado (50%)</option>
                            <option value="CONCLUIDO" ${andamentoExistente?.status === 'CONCLUIDO' ? 'selected' : ''}>Concluído (100%)</option>
                        </select>
                    </td>
                    <td>
                        <input type="date" 
                               class="form-input data-inicio-servico" 
                               data-index="${index}"
                               value="${andamentoExistente?.data_inicio || ''}"
                               style="width: 120px; padding: 8px; font-size: 0.85rem;">
                    </td>
                    <td>
                        <input type="date" 
                               class="form-input data-final-servico" 
                               data-index="${index}"
                               value="${andamentoExistente?.data_final || ''}"
                               style="width: 120px; padding: 8px; font-size: 0.85rem;">
                    </td>
                    <td>
                        <textarea class="form-textarea observacoes-servico" 
                                  data-index="${index}"
                                  placeholder="Digite suas observações..."
                                  rows="2"
                                  style="width: 220px; min-height: 60px; padding: 8px; font-size: 0.85rem; resize: vertical;">${andamentoExistente?.observacoes || ''}</textarea>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            this.servicosAndamento = todosServicos;
            
            // Carregar serviços únicos da obra para as produções diárias
            this.servicosObra = todosServicos.reduce((unique, item) => {
                const servicoExistente = unique.find(s => s.id === item.servicos_hvc?.id);
                if (!servicoExistente && item.servicos_hvc) {
                    unique.push({
                        id: item.servicos_hvc.id,
                        codigo: item.servicos_hvc.codigo,
                        descricao: item.servicos_hvc.descricao,
                        unidade: item.servicos_hvc.unidade
                    });
                }
                return unique;
            }, []);
            
            // Carregar equipes e integrantes para os filtros
            if (this.equipesIntegrantes.length === 0) {
                await this.loadEquipesIntegrantes();
            }
            
            // Popular filtro de equipes/integrantes
            await this.populateFiltroEquipeProducao();
            
            // Carregar produções diárias
            await this.loadProducoesDiarias();
            
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #dc3545;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Erro ao carregar serviços: ${error.message}
                </div>
            `;
        }
    }

    // 🎯 FUNÇÃO ATUALIZADA: salvarAndamento com duas datas
    async salvarAndamento() {
        console.log('🎯 DUAS DATAS - Salvando andamento dos serviços...');
        
        if (!this.currentObraId) {
            this.showNotification('Salve a obra primeiro antes de gerenciar o andamento', 'warning');
            return;
        }
        
        const statusSelects = document.querySelectorAll('.status-servico');
        const dataInicioInputs = document.querySelectorAll('.data-inicio-servico');
        const dataFinalInputs = document.querySelectorAll('.data-final-servico');
        const observacoesTextareas = document.querySelectorAll('.observacoes-servico');
        
        const andamentos = [];
        
        statusSelects.forEach((select, index) => {
            const dataInicioInput = dataInicioInputs[index];
            const dataFinalInput = dataFinalInputs[index];
            const observacoesTextarea = observacoesTextareas[index];
            const servico = this.servicosAndamento[index];
            
            if (servico) {
                andamentos.push({
                    obra_id: this.currentObraId,
                    item_proposta_id: servico.id,
                    status: select.value,
                    data_inicio: dataInicioInput.value || null,
                    data_final: dataFinalInput.value || null,
                    observacoes: observacoesTextarea.value || null
                });
            }
        });
        
        try {
            // Remover andamentos existentes desta obra
            await supabaseClient
                .from('servicos_andamento')
                .delete()
                .eq('obra_id', this.currentObraId);
            
            // Inserir novos andamentos
            if (andamentos.length > 0) {
                const { error } = await supabaseClient
                    .from('servicos_andamento')
                    .insert(andamentos);
                
                if (error) throw error;
            }
            
            // 🎯 DUAS DATAS - Calcular e atualizar percentual da obra
            const totalServicos = andamentos.length;
            const servicosConcluidos = andamentos.filter(a => a.status === 'CONCLUIDO').length;
            const servicosIniciados = andamentos.filter(a => a.status === 'INICIADO').length;
            
            // Concluídos = 100%, Iniciados = 50%, Pendentes = 0%
            const pontuacaoTotal = (servicosConcluidos * 100) + (servicosIniciados * 50);
            const percentualFinal = totalServicos > 0 ? Math.round(pontuacaoTotal / (totalServicos * 100) * 100) : 0;
            
            console.log(`🎯 DUAS DATAS - Percentual calculado: ${percentualFinal}% (${servicosConcluidos} concluídos, ${servicosIniciados} iniciados de ${totalServicos} total)`);
            
            // Atualizar percentual no banco
            await this.atualizarPercentualObra(this.currentObraId, percentualFinal);
            
            this.showNotification('Andamento dos serviços salvo com sucesso!', 'success');
            await this.updateResumoObra(); // Atualizar progresso geral
            await this.loadObras(); // Recarregar lista de obras para mostrar percentual atualizado
            
        } catch (error) {
            console.error('Erro ao salvar andamento:', error);
            this.showNotification('Erro ao salvar andamento: ' + error.message, 'error');
        }
    }

    // === FUNÇÕES PARA PRODUÇÕES DIÁRIAS ===
    
    async showModalProducao(producaoId = null) {
        console.log('Mostrando modal de produção...', producaoId);
        
        this.currentProducaoId = producaoId;
        
        const modal = document.getElementById('modal-producao');
        const titulo = document.getElementById('titulo-modal-producao');
        
        if (modal) {
            modal.classList.add('show');
            
            if (producaoId) {
                if (titulo) titulo.textContent = 'Editar Produção Diária';
                await this.loadProducaoData(producaoId);
            } else {
                if (titulo) titulo.textContent = 'Nova Produção Diária';
                this.clearFormProducao();
            }
            
            // Carregar equipes/integrantes se ainda não carregou
            if (this.equipesIntegrantes.length === 0) {
                await this.loadEquipesIntegrantes();
            }
            
            this.populateEquipeProducaoSelect();
            this.renderServicosProducao();
        }
    }
    
    hideModalProducao() {
        const modal = document.getElementById('modal-producao');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentProducaoId = null;
    }
    
    clearFormProducao() {
        const form = document.getElementById('form-producao');
        if (form) form.reset();
        
        // Definir data atual como padrão
        const dataInput = document.getElementById('data-producao');
        if (dataInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataInput.value = hoje;
        }
    }
    
    async loadEquipesIntegrantes() {
        try {
            console.log('Carregando equipes e integrantes...');
            
            const { data, error } = await supabaseClient
                .from('equipes_integrantes')
                .select('*')
                .eq('ativo', true)
                .order('tipo, nome');

            if (error) throw error;

            this.equipesIntegrantes = data || [];
            console.log('Equipes/Integrantes carregados:', this.equipesIntegrantes.length);
            
        } catch (error) {
            console.error('Erro ao carregar equipes/integrantes:', error);
            this.showNotification('Erro ao carregar equipes/integrantes: ' + error.message, 'error');
        }
    }
    
    populateEquipeProducaoSelect() {
        const select = document.getElementById('equipe-producao');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione...</option>';
        
        // Agrupar por tipo
        const equipes = this.equipesIntegrantes.filter(item => item.tipo === 'equipe');
        const integrantes = this.equipesIntegrantes.filter(item => item.tipo === 'integrante');
        
        if (equipes.length > 0) {
            const optgroupEquipes = document.createElement('optgroup');
            optgroupEquipes.label = 'Equipes';
            
            equipes.forEach(equipe => {
                const option = document.createElement('option');
                option.value = `equipe:${equipe.id}`;
                option.textContent = `Equipe ${equipe.nome}`;
                optgroupEquipes.appendChild(option);
            });
            
            select.appendChild(optgroupEquipes);
        }
        
        if (integrantes.length > 0) {
            const optgroupIntegrantes = document.createElement('optgroup');
            optgroupIntegrantes.label = 'Integrantes Individuais';
            
            integrantes.forEach(integrante => {
                const option = document.createElement('option');
                option.value = `integrante:${integrante.id}`;
                option.textContent = integrante.nome;
                optgroupIntegrantes.appendChild(option);
            });
            
            select.appendChild(optgroupIntegrantes);
        }
    }
    
    async populateFiltroEquipeProducao() {
        const select = document.getElementById('filtro-equipe-producao');
        if (!select) return;

        select.innerHTML = '<option value="">Todos</option>';
        
        // Agrupar por tipo
        const equipes = this.equipesIntegrantes.filter(item => item.tipo === 'equipe');
        const integrantes = this.equipesIntegrantes.filter(item => item.tipo === 'integrante');
        
        if (equipes.length > 0) {
            const optgroupEquipes = document.createElement('optgroup');
            optgroupEquipes.label = 'Equipes';
            
            equipes.forEach(equipe => {
                const option = document.createElement('option');
                option.value = `equipe:${equipe.id}`;
                option.textContent = `Equipe ${equipe.nome}`;
                optgroupEquipes.appendChild(option);
            });
            
            select.appendChild(optgroupEquipes);
        }
        
        if (integrantes.length > 0) {
            const optgroupIntegrantes = document.createElement('optgroup');
            optgroupIntegrantes.label = 'Integrantes';
            
            integrantes.forEach(integrante => {
                const option = document.createElement('option');
                option.value = `integrante:${integrante.id}`;
                option.textContent = integrante.nome;
                optgroupIntegrantes.appendChild(option);
            });
            
            select.appendChild(optgroupIntegrantes);
        }
    }
    
    renderServicosProducao() {
        const container = document.getElementById('servicos-producao');
        if (!container) return;
        
        container.innerHTML = '';

        if (this.servicosObra.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #c0c0c0;">
                    <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>Nenhum serviço disponível na obra</p>
                </div>
            `;
            return;
        }

        this.servicosObra.forEach(servico => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem;
                border: 1px solid rgba(173, 216, 230, 0.3);
                border-radius: 6px;
                margin-bottom: 0.5rem;
                background: rgba(173, 216, 230, 0.05);
                transition: background-color 0.3s ease;
            `;
            
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'rgba(173, 216, 230, 0.1)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'rgba(173, 216, 230, 0.05)';
            });
            
            item.innerHTML = `
                <div style="flex: 1;">
                    <strong style="color: #add8e6;">${servico.codigo}</strong>
                    <br>
                    <small style="color: #c0c0c0;">${servico.descricao}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="number" 
                           id="servico-${servico.id}"
                           min="0" 
                           step="0.01"
                           placeholder="0"
                           style="width: 80px; padding: 0.5rem; border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 4px; background: rgba(255,255,255,0.1); color: #add8e6;">
                    <span style="color: #c0c0c0; font-size: 0.9rem;">${servico.unidade}</span>
                </div>
            `;
            
            container.appendChild(item);
        });
    }
    
    async handleSubmitProducao(e) {
        e.preventDefault();
        
        try {
            const dataProducao = document.getElementById('data-producao').value;
            const equipeProducao = document.getElementById('equipe-producao').value;
            const observacao = document.getElementById('observacao-producao').value;
            
            if (!dataProducao || !equipeProducao) {
                this.showNotification('Preencha todos os campos obrigatórios', 'error');
                return;
            }
            
            // Extrair tipo e ID da seleção
            const [tipo, id] = equipeProducao.split(':');
            
            // Coletar quantidades dos serviços
            const quantidades = {};
            let temQuantidade = false;
            
            this.servicosObra.forEach(servico => {
                const input = document.getElementById(`servico-${servico.id}`);
                if (input && input.value && parseFloat(input.value) > 0) {
                    quantidades[servico.id] = parseFloat(input.value);
                    temQuantidade = true;
                }
            });
            
            if (!temQuantidade) {
                this.showNotification('Preencha pelo menos um serviço com quantidade maior que zero', 'error');
                return;
            }
            
            const producaoData = {
                obra_id: this.currentObraId,
                data_producao: dataProducao,
                tipo_responsavel: tipo,
                responsavel_id: id, // Manter como string (UUID ou ID numérico)
                observacoes: observacao || null,
                quantidades_servicos: quantidades
            };
            
            if (this.currentProducaoId) {
                // Atualizar produção existente
                await this.updateProducao(this.currentProducaoId, producaoData);
            } else {
                // Criar nova produção
                await this.createProducao(producaoData);
            }
            
            this.hideModalProducao();
            await this.loadProducoesDiarias();
            
        } catch (error) {
            console.error('Erro ao salvar produção:', error);
            this.showNotification('Erro ao salvar produção: ' + error.message, 'error');
        }
    }
    
    async createProducao(producaoData) {
        const { data, error } = await supabaseClient
            .from('producoes_diarias_hvc')
            .insert([producaoData])
            .select();
        
        if (error) throw error;
        
        this.showNotification('Produção diária criada com sucesso!', 'success');
        return data[0];
    }
    
    async updateProducao(id, producaoData) {
        const { data, error } = await supabaseClient
            .from('producoes_diarias_hvc')
            .update(producaoData)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        this.showNotification('Produção diária atualizada com sucesso!', 'success');
        return data[0];
    }
    
    async deleteProducao(id) {
        if (!confirm('Tem certeza que deseja excluir esta produção diária?')) {
            return;
        }
        
        try {
            const { error } = await supabaseClient
                .from('producoes_diarias_hvc')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            this.showNotification('Produção diária excluída com sucesso!', 'success');
            await this.loadProducoesDiarias();
            
        } catch (error) {
            console.error('Erro ao excluir produção:', error);
            this.showNotification('Erro ao excluir produção: ' + error.message, 'error');
        }
    }
    
    async loadProducoesDiarias() {
        if (!this.currentObraId) return;
        
        try {
            console.log('Carregando produções diárias...');
            
            const { data, error } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', this.currentObraId)
                .order('data_producao', { ascending: false });
            
            if (error) throw error;
            
            this.producoesDiarias = data || [];
            this.renderProducoesDiarias();
            
        } catch (error) {
            console.error('Erro ao carregar produções diárias:', error);
            this.showNotification('Erro ao carregar produções diárias: ' + error.message, 'error');
        }
    }
    
              async renderProducoesDiarias() {
                const container = document.getElementById('lista-producoes-diarias');
                if (!container) return;
                
                if (!this.producoesDiarias || this.producoesDiarias.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 2rem; color: #c0c0c0;">
                            <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>Nenhuma produção diária cadastrada</p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = '';
                
                this.producoesDiarias.forEach(producao => {
                    const producaoDiv = document.createElement('div');
                    producaoDiv.style.cssText = 'border-bottom: 1px solid rgba(173, 216, 230, 0.1); padding: 1rem; transition: background-color 0.3s ease;';
                    producaoDiv.addEventListener('mouseenter', () => {
                        producaoDiv.style.backgroundColor = 'rgba(173, 216, 230, 0.1)';
                    });
                    producaoDiv.addEventListener('mouseleave', () => {
                        producaoDiv.style.backgroundColor = 'transparent';
                    });
                    
                    // Debug: mostrar dados disponíveis
                    console.log('=== DEBUG PRODUÇÃO ===');
                    console.log('Produção ID:', producao.id);
                    console.log('Tipo responsável:', producao.tipo_responsavel);
                    console.log('Responsável ID:', producao.responsavel_id);
                    console.log('Equipes disponíveis:', this.equipesIntegrantes.filter(i => i.tipo === 'equipe'));
                    console.log('Integrantes disponíveis:', this.equipesIntegrantes.filter(i => i.tipo === 'integrante'));
                    
                    // Criar texto no formato: "Equipes: [números] ::: Integrantes: [todos]"
                    let equipesTexto = '';
                    let integrantesTexto = '';
                    let todosIntegrantes = [];
                    
                    if (producao.tipo_responsavel === 'equipe') {
                        // Buscar equipe por diferentes critérios
                        let equipe = null;
                        
                        // Tentar buscar por UUID
                        equipe = this.equipesIntegrantes.find(item => 
                            item.tipo === 'equipe' && item.id === producao.responsavel_id
                        );
                        
                        // Se não encontrar, tentar buscar por número
                        if (!equipe) {
                            equipe = this.equipesIntegrantes.find(item => 
                                item.tipo === 'equipe' && item.nome === String(producao.responsavel_id).padStart(4, '0')
                            );
                        }
                        
                        // Se ainda não encontrar, tentar buscar por número sem zeros
                        if (!equipe) {
                            equipe = this.equipesIntegrantes.find(item => 
                                item.tipo === 'equipe' && parseInt(item.nome) === producao.responsavel_id
                            );
                        }
                        
                        console.log('Equipe encontrada:', equipe);
                        
                        if (equipe) {
                            equipesTexto = `Equipes: ${equipe.nome}`;
                            
                            // Buscar integrantes desta equipe
                            const integrantesEquipe = this.equipesIntegrantes.filter(item => 
                                item.tipo === 'integrante' && item.equipe_id === equipe.id
                            );
                            
                            todosIntegrantes = integrantesEquipe;
                        } else {
                            equipesTexto = `Equipes: N/A (ID: ${producao.responsavel_id})`;
                        }
                        
                    } else if (producao.tipo_responsavel === 'integrante') {
                        // Buscar integrante individual
                        let integrante = null;
                        
                        // Tentar buscar por UUID
                        integrante = this.equipesIntegrantes.find(item => 
                            item.tipo === 'integrante' && item.id === producao.responsavel_id
                        );
                        
                        // Se não encontrar, tentar buscar por ID numérico
                        if (!integrante) {
                            integrante = this.equipesIntegrantes.find(item => 
                                item.tipo === 'integrante' && item.id == producao.responsavel_id
                            );
                        }
                        
                        console.log('Integrante encontrado:', integrante);
                        
                        if (integrante) {
                            equipesTexto = `Integrante Individual`;
                            todosIntegrantes = [integrante];
                        } else {
                            equipesTexto = `Integrante: N/A (ID: ${producao.responsavel_id})`;
                        }
                    }
                    
                    // Criar texto dos integrantes
                    if (todosIntegrantes.length > 0) {
                        const nomesIntegrantes = todosIntegrantes.map(i => i.nome).join(', ');
                        integrantesTexto = `Integrantes: ${nomesIntegrantes}`;
                    } else {
                        integrantesTexto = `Integrantes: N/A`;
                    }
                    
                    // Formato final: "Equipes: [números] ::: Integrantes: [todos]"
                    const equipesIntegrantesTexto = `
                        <span style="color: #e0e0e0;">
                            <i class="fas fa-users"></i> ${equipesTexto} ::: ${integrantesTexto}
                        </span>
                    `;
                    
                    // Formatar data
                    const dataFormatada = new Date(producao.data_producao + 'T00:00:00').toLocaleDateString('pt-BR');
                    
                    // Processar serviços executados
                    const quantidadesObj = producao.quantidades_servicos || {};
                    const servicosExecutados = Object.entries(quantidadesObj)
                        .filter(([servicoId, quantidade]) => quantidade > 0)
                        .map(([servicoId, quantidade]) => {
                            // Buscar informações do serviço
                            const servico = this.servicosObra.find(s => s.id == servicoId);
                            const codigo = servico ? servico.codigo : `ID:${servicoId}`;
                            const unidade = servico ? servico.unidade : '';
                            return `${codigo}: ${quantidade}${unidade ? ' ' + unidade : ''}`;
                        });
                    
                    const servicosTexto = servicosExecutados.length > 0 
                        ? servicosExecutados.join(' • ') 
                        : 'Nenhum serviço executado';
                    
                    producaoDiv.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                                    <strong style="color: #add8e6; font-size: 1.1em;">
                                        <i class="fas fa-calendar-day"></i>
                                        ${dataFormatada}
                                    </strong>
                                    ${equipesIntegrantesTexto}
                                </div>
                                
                                <div style="color: #c0c0c0; font-size: 0.9em; margin: 0.5rem 0;">
                                    <i class="fas fa-tools"></i>
                                    <strong>Serviços:</strong> ${servicosTexto}
                                </div>
                                
                                ${producao.observacoes ? `
                                    <div style="color: #a0a0a0; font-size: 0.9em; font-style: italic; margin-top: 0.5rem;">
                                        <i class="fas fa-comment"></i>
                                        ${producao.observacoes}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div style="display: flex; gap: 0.5rem;">
                                <button 
                                    onclick="window.obrasManager.showModalProducao('${producao.id}')"
                                    class="btn-secondary" 
                                    style="padding: 0.3rem 0.6rem; font-size: 0.8em;"
                                    title="Editar produção"
                                >
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button 
                                    onclick="window.obrasManager.deleteProducao('${producao.id}')"
                                    class="btn-danger" 
                                    style="padding: 0.3rem 0.6rem; font-size: 0.8em;"
                                    title="Excluir produção"
                                >
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    
                    container.appendChild(producaoDiv);
                });
            }
    
    async loadProducaoData(producaoId) {
        try {
            const { data, error } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('id', producaoId)
                .single();
            
            if (error) throw error;
            
            // Preencher formulário
            document.getElementById('data-producao').value = data.data_producao;
            document.getElementById('equipe-producao').value = `${data.tipo_responsavel}:${data.responsavel_id}`;
            document.getElementById('observacao-producao').value = data.observacoes || '';
            
            // Preencher quantidades dos serviços
            const quantidades = data.quantidades_servicos || {};
            Object.keys(quantidades).forEach(servicoId => {
                const input = document.getElementById(`servico-${servicoId}`);
                if (input) {
                    input.value = quantidades[servicoId];
                }
            });
            
        } catch (error) {
            console.error('Erro ao carregar dados da produção:', error);
            this.showNotification('Erro ao carregar dados da produção: ' + error.message, 'error');
        }
    }
    
                           filtrarProducoes() {
                                const filtroData = document.getElementById('filtro-data-producao').value;
                                const filtroEquipe = document.getElementById('filtro-equipe-producao').value;
                                
                                let producoesFiltradas = [...this.producoesDiarias];
                                
                                if (filtroData) {
                                    producoesFiltradas = producoesFiltradas.filter(p => p.data_producao === filtroData);
                                }
                                
                                if (filtroEquipe && filtroEquipe !== '') {
                                    const [tipo, id] = filtroEquipe.split(':');
                                    
                                    if (tipo === 'equipe') {
                                        // Se filtrar por equipe, mostrar todas as produções dessa equipe
                                        producoesFiltradas = producoesFiltradas.filter(p => 
                                            p.tipo_responsavel === 'equipe' && p.responsavel_id == id
                                        );
                                    } else if (tipo === 'integrante') {
                                        // Se filtrar por integrante, mostrar:
                                        // 1. Produções onde ele é responsável individual
                                        // 2. Produções de equipes onde ele participa
                                        const integrante = this.equipesIntegrantes.find(i => i.id === id);
                                        
                                        producoesFiltradas = producoesFiltradas.filter(p => {
                                            // Caso 1: Integrante individual
                                            if (p.tipo_responsavel === 'integrante' && p.responsavel_id == id) {
                                                return true;
                                            }
                                            
                                            // Caso 2: Integrante faz parte de uma equipe
                                            if (p.tipo_responsavel === 'equipe' && integrante && integrante.equipe_id) {
                                                return p.responsavel_id == integrante.equipe_id;
                                            }
                                            
                                            return false;
                                        });
                                    }
                                }
                                
                                // Renderizar apenas as produções filtradas
                                const originalProducoes = this.producoesDiarias;
                                this.producoesDiarias = producoesFiltradas;
                                this.renderProducoesDiarias();
                                this.producoesDiarias = originalProducoes;
                            }
                            
                            limparFiltrosProducao() {
                                document.getElementById('filtro-data-producao').value = '';
                                document.getElementById('filtro-equipe-producao').value = '';
                                this.renderProducoesDiarias();
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


                            // DEBUG PARA PRODUÇÕES DIÁRIAS
                            async function debugProducoesDiarias() {
                                console.log('=== DEBUG PRODUÇÕES DIÁRIAS ===');
                                
                                // 1. Verificar se obrasManager existe
                                console.log('1. ObrasManager:', window.obrasManager);
                                
                                if (!window.obrasManager) {
                                    console.log('❌ ObrasManager não encontrado');
                                    return;
                                }
                                
                                // 2. Verificar obra atual
                                console.log('2. Obra atual ID:', window.obrasManager.currentObraId);
                                
                                if (!window.obrasManager.currentObraId) {
                                    console.log('❌ Nenhuma obra selecionada');
                                    return;
                                }
                                
                                // 3. Verificar equipes/integrantes carregados
                                console.log('3. Equipes/Integrantes:', window.obrasManager.equipesIntegrantes);
                                
                                // 4. Verificar produções carregadas
                                console.log('4. Produções diárias:', window.obrasManager.producoesDiarias);
                                
                                // 5. Testar consulta direta
                                try {
                                    console.log('5. Testando consulta direta...');
                                    const { data, error } = await supabaseClient
                                        .from('producoes_diarias_hvc')
                                        .select('*')
                                        .eq('obra_id', window.obrasManager.currentObraId);
                                    
                                    console.log('5.1. Dados:', data);
                                    console.log('5.2. Erro:', error);
                                } catch (err) {
                                    console.log('5.3. Erro na consulta:', err);
                                }
                                
                                // 6. Verificar tabela de equipes/integrantes
                                try {
                                    console.log('6. Testando consulta equipes/integrantes...');
                                    const { data, error } = await supabaseClient
                                        .from('equipes_integrantes')
                                        .select('*')
                                        .eq('ativo', true);
                                    
                                    console.log('6.1. Dados:', data);
                                    console.log('6.2. Erro:', error);
                                } catch (err) {
                                    console.log('6.3. Erro na consulta:', err);
                                }
                            }
                            
                            // Expor função de debug globalmente
                            window.debugProducoesDiarias = debugProducoesDiarias;

// Expor ObrasManager globalmente
window.ObrasManager = ObrasManager;
