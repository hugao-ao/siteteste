// obras-hvc.js - Versão REESCRITA com divisão por 100 nos valores
// Sistema de Gestão de Obras HVC

// Importar Supabase do arquivo existente
import { supabase as supabaseClient } from './supabase.js';

let obrasManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Verificar se o Supabase está disponível
    if (supabaseClient) {
        // Inicializar o gerenciador de obras
        obrasManager = new ObrasManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.obrasManager = obrasManager;
    } else {
        console.error('Erro: Supabase não disponível');
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
        
        this.init();
    }

    async init() {
        try {
            await this.loadPropostas();
            await this.loadObras();
            this.setupEventListeners();
            this.setupMasks();
            this.setupFilters();
        } catch (error) {
            console.error('Erro ao inicializar ObrasManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
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
        const filtroCliente = document.getElementById('filtro-cliente-obra');
        const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
        
        if (filtroBusca) {
            filtroBusca.addEventListener('keyup', () => this.filtrarObras());
        }
        if (filtroStatus) {
            filtroStatus.addEventListener('change', () => this.filtrarObras());
        }
        if (filtroCliente) {
            filtroCliente.addEventListener('change', () => this.filtrarObras());
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
            const { data, error } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .eq('status', 'Aprovada')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.propostas = data || [];
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }

    // === OBRAS ===
    showFormObra(obra = null) {
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
            this.updateResumoObra();
            
        } catch (error) {
            console.error('Erro ao carregar propostas da obra:', error);
        }
    }

    // === MODAL DE PROPOSTAS ===
    showModalPropostas() {
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
                       id="proposta-${proposta.id}" 
                       value="${proposta.id}" 
                       style="margin-right: 1rem; transform: scale(1.2);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #2a5298;">
                        ${proposta.numero_proposta} - ${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}
                    </div>
                    <div style="color: #666; font-size: 0.9rem;">
                        Total: ${this.formatMoney(proposta.total_proposta / 100)}
                    </div>
                </div>
            `;
            
            // Adicionar evento de mudança
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                this.atualizarContadorPropostas();
            });
            
            container.appendChild(item);
        });
        
        this.atualizarContadorPropostas();
    }

    atualizarContadorPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]:checked');
        const contador = document.getElementById('contador-propostas');
        const btnAdicionar = document.getElementById('btn-adicionar-propostas');
        
        if (contador) {
            const quantidade = checkboxes.length;
            contador.textContent = `${quantidade} proposta${quantidade !== 1 ? 's' : ''} selecionada${quantidade !== 1 ? 's' : ''}`;
        }
        
        if (btnAdicionar) {
            btnAdicionar.disabled = checkboxes.length === 0;
        }
    }

    filtrarPropostasModal(busca) {
        const items = document.querySelectorAll('.proposta-item');
        const termoBusca = busca.toLowerCase();
        
        items.forEach(item => {
            const texto = item.textContent.toLowerCase();
            if (texto.includes(termoBusca)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    selecionarTodasPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox.closest('.proposta-item').style.display !== 'none') {
                checkbox.checked = true;
            }
        });
        this.atualizarContadorPropostas();
    }

    limparSelecaoPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.atualizarContadorPropostas();
    }

    addSelectedPropostas() {
        const checkboxes = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            const propostaId = checkbox.value;
            const proposta = this.propostas.find(p => p.id == propostaId);
            
            if (proposta && !this.propostasSelecionadas.find(p => p.id == propostaId)) {
                this.propostasSelecionadas.push(proposta);
            }
        });

        this.updatePropostasTable();
        this.updateResumoObra();
        this.hideModalPropostas();
        
        this.showNotification(`${checkboxes.length} proposta(s) adicionada(s) à obra!`, 'success');
    }

    removePropostaObra(propostaId) {
        this.propostasSelecionadas = this.propostasSelecionadas.filter(p => p.id != propostaId);
        this.updatePropostasTable();
        this.updateResumoObra();
    }

    updatePropostasTable() {
        const container = document.getElementById('propostas-obra-container');
        if (!container) return;

        if (this.propostasSelecionadas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888; border: 2px dashed #ddd; border-radius: 8px;">
                    <i class="fas fa-plus-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>Nenhuma proposta adicionada à obra.</p>
                    <p style="font-size: 0.9rem;">Clique em "Adicionar Propostas" para começar.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 1rem 0; color: #2a5298;">
                    <i class="fas fa-file-contract"></i> Propostas da Obra
                </h4>
                <div style="display: grid; gap: 0.75rem;">
        `;

        this.propostasSelecionadas.forEach(proposta => {
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; 
                           background: white; padding: 1rem; border-radius: 6px; border: 1px solid #e1e5e9;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #2a5298; margin-bottom: 0.25rem;">
                            ${proposta.numero_proposta}
                        </div>
                        <div style="color: #666; font-size: 0.9rem;">
                            Cliente: ${proposta.clientes_hvc?.nome || 'N/A'} | 
                            Total: ${this.formatMoney(proposta.total_proposta / 100)}
                        </div>
                    </div>
                    <button type="button" 
                            onclick="window.obrasManager.removePropostaObra('${proposta.id}')"
                            style="background: #dc3545; color: white; border: none; padding: 0.5rem; 
                                   border-radius: 4px; cursor: pointer; margin-left: 1rem;"
                            title="Remover proposta">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    updateResumoObra() {
        // Calcular totais
        const totalPropostas = this.propostasSelecionadas.length;
        const clientesUnicos = [...new Set(this.propostasSelecionadas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        const totalClientes = clientesUnicos.length;
        const valorTotal = this.propostasSelecionadas.reduce((sum, p) => sum + (p.total_proposta / 100), 0);
        
        // Atualizar elementos
        const totalPropostasEl = document.getElementById('total-propostas');
        const totalClientesEl = document.getElementById('total-clientes');
        const valorTotalEl = document.getElementById('valor-total-obra');
        const progressoEl = document.getElementById('progresso-geral');
        
        if (totalPropostasEl) totalPropostasEl.textContent = totalPropostas;
        if (totalClientesEl) totalClientesEl.textContent = totalClientes;
        if (valorTotalEl) valorTotalEl.textContent = this.formatMoney(valorTotal);
        if (progressoEl) progressoEl.textContent = '0%'; // Será calculado baseado no andamento
    }

    // === MODAL DE ANDAMENTO ===
    showModalAndamento() {
        const modal = document.getElementById('modal-andamento');
        if (modal) {
            modal.classList.add('show');
            this.loadServicosAndamento();
        }
    }

    hideModalAndamento() {
        const modal = document.getElementById('modal-andamento');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async loadServicosAndamento() {
        // Implementar carregamento de serviços para andamento
        // Por enquanto, deixar vazio
        const container = document.getElementById('servicos-andamento-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Funcionalidade de andamento em desenvolvimento.
                </div>
            `;
        }
    }

    salvarAndamento() {
        this.showNotification('Andamento salvo com sucesso!', 'success');
        this.hideModalAndamento();
    }

    // === FILTROS ===
    filtrarObras() {
        const busca = document.getElementById('filtro-busca-obra')?.value.toLowerCase() || '';
        const status = document.getElementById('filtro-status-obra')?.value || '';
        const cliente = document.getElementById('filtro-cliente-obra')?.value || '';

        let obrasFiltradas = this.obras.filter(obra => {
            // Filtro de busca
            if (busca) {
                const textoBusca = `${obra.numero_obra}`.toLowerCase();
                if (!textoBusca.includes(busca)) return false;
            }

            // Filtro de status
            if (status && obra.status !== status) return false;

            // Filtro de cliente (implementar quando necessário)
            // if (cliente && ...) return false;

            return true;
        });

        this.renderObras(obrasFiltradas);
    }

    limparFiltros() {
        document.getElementById('filtro-busca-obra').value = '';
        document.getElementById('filtro-status-obra').value = '';
        document.getElementById('filtro-cliente-obra').value = '';
        this.renderObras(this.obras);
    }

    // === CRUD OBRAS ===
    async handleSubmitObra(e) {
        e.preventDefault();

        if (!this.validateFormObra()) return;

        const obraData = {
            numero_obra: document.getElementById('numero-obra').value,
            status: document.getElementById('status-obra').value,
            observacoes: document.getElementById('observacoes-obra').value || null,
        };

        try {
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
            }

            // Salvar propostas da obra
            await this.savePropostasObra(obra.id);

            this.showNotification('Obra salva com sucesso!', 'success');
            this.hideFormObra();
            await this.loadObras();

        } catch (error) {
            console.error('Erro ao salvar obra:', error);
            this.showNotification('Erro ao salvar obra: ' + error.message, 'error');
        }
    }

    async savePropostasObra(obraId) {
        try {
            // Deletar propostas existentes
            const { error: deleteError } = await supabaseClient
                .from('obras_propostas')
                .delete()
                .eq('obra_id', obraId);

            if (deleteError) throw deleteError;

            // Inserir novas propostas
            if (this.propostasSelecionadas.length > 0) {
                const propostasData = this.propostasSelecionadas.map(proposta => ({
                    obra_id: obraId,
                    proposta_id: proposta.id
                }));

                const { error } = await supabaseClient
                    .from('obras_propostas')
                    .insert(propostasData);

                if (error) throw error;
            }
        } catch (error) {
            console.error('Erro ao salvar propostas da obra:', error);
            throw error;
        }
    }

    validateFormObra() {
        const numeroObra = document.getElementById('numero-obra').value;
        
        if (!numeroObra || !numeroObra.match(/^\d{4}\/\d{4}$/)) {
            this.showNotification('Número da obra deve estar no formato XXXX/YYYY', 'error');
            return false;
        }

        if (this.propostasSelecionadas.length === 0) {
            this.showNotification('Adicione pelo menos uma proposta à obra', 'error');
            return false;
        }

        return true;
    }

    async loadObras() {
        try {
            const { data, error } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    obras_propostas (
                        propostas_hvc (
                            id,
                            numero_proposta,
                            total_proposta,
                            clientes_hvc (nome)
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.obras = data || [];
            this.renderObras(this.obras);
            
        } catch (error) {
            console.error('Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    renderObras(obras) {
        const tbody = document.querySelector('#obras-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (obras.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="7" style="text-align: center; padding: 2rem; color: #888;">
                    Nenhuma obra encontrada
                </td>
            `;
            tbody.appendChild(row);
            return;
        }

        obras.forEach(obra => {
            // Calcular clientes únicos
            const clientesUnicos = [...new Set(
                obra.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean) || []
            )];
            const clientesTexto = clientesUnicos.length > 0 ? clientesUnicos.join(', ') : '-';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${obra.numero_obra}</strong></td>
                <td>${clientesTexto}</td>
                <td>${obra.obras_propostas?.length || 0}</td>
                <td><strong>${this.formatMoney((obra.valor_total || 0) / 100)}</strong></td>
                <td>
                    <span class="status-badge status-${obra.status.toLowerCase()}">
                        ${obra.status}
                    </span>
                </td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${obra.progresso_geral || 0}%"></div>
                    </div>
                    <div class="progress-text">${obra.progresso_geral || 0}%</div>
                </td>
                <td>${new Date(obra.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions-cell">
                    <button class="btn-secondary" 
                            onclick="window.obrasManager.editObra('${obra.id}')"
                            title="Editar obra">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-info" 
                            onclick="window.obrasManager.gerenciarAndamento('${obra.id}')"
                            title="Gerenciar andamento">
                        <i class="fas fa-tasks"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async editObra(id) {
        try {
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
                .eq('id', id)
                .single();

            if (error) throw error;

            this.showFormObra(obra);

        } catch (error) {
            console.error('Erro ao carregar obra para edição:', error);
            this.showNotification('Erro ao carregar obra: ' + error.message, 'error');
        }
    }

    gerenciarAndamento(obraId) {
        this.currentObraId = obraId;
        this.showModalAndamento();
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
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

        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        document.body.appendChild(notification);

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
}

// Adicionar estilos CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .status-planejamento { background-color: #ffc107; color: #000; }
    .status-em.andamento { background-color: #17a2b8; color: #fff; }
    .status-pausada { background-color: #6c757d; color: #fff; }
    .status-concluída { background-color: #28a745; color: #fff; }

    .progress-bar {
        width: 100px;
        height: 20px;
        background-color: #e9ecef;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 0.25rem;
    }

    .progress-fill {
        height: 100%;
        background-color: #28a745;
        transition: width 0.3s ease;
    }

    .progress-text {
        font-size: 0.8rem;
        text-align: center;
        color: #666;
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

    .btn-info {
        background-color: #17a2b8;
        color: white;
    }

    .btn-info:hover {
        background-color: #138496;
    }
`;
document.head.appendChild(style);

