// obras-hvc.js - Sistema de Gestão de Obras HVC (DUAS COLUNAS DE DATAS)
// Gerenciamento completo de obras com INÍCIO e FINAL no lugar de PREVISÃO
// 🎯 VERSÃO ATUALIZADA: Duas colunas de datas (data_inicio e data_final)

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
        
        try {
            await this.loadPropostas();
            await this.loadObras();
            await this.loadLocais(); // ✅ ADICIONADO: Carregar locais
            this.setupEventListeners();
            this.setupMasks();
            this.setupFilters();
        } catch (error) {
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    // ✅ ADICIONADO: Função para carregar locais
    async loadLocais() {
        try {
            
            const { data, error } = await supabaseClient
                .from('locais_hvc')
                .select('*')
                .eq('ativo', true)
                .order('nome');

            if (error) throw error;

            this.locais = data || [];
        } catch (error) {
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
            
            // Event listeners para Medições
            const btnGerarMedicao = document.getElementById('btn-gerar-medicao');
            const closeModalGerarMedicao = document.getElementById('close-modal-gerar-medicao');
            const cancelGerarMedicao = document.getElementById('cancel-gerar-medicao');
            const formGerarMedicao = document.getElementById('form-gerar-medicao');
            
            if (btnGerarMedicao) {
                btnGerarMedicao.addEventListener('click', () => this.showModalGerarMedicao());
            }
            if (closeModalGerarMedicao) {
                closeModalGerarMedicao.addEventListener('click', () => this.hideModalGerarMedicao());
            }
            if (cancelGerarMedicao) {
                cancelGerarMedicao.addEventListener('click', () => this.hideModalGerarMedicao());
            }
            if (formGerarMedicao) {
                formGerarMedicao.addEventListener('submit', (e) => this.handleSubmitGerarMedicao(e));
            }
            
            // Fechar modal de gerar medição clicando fora
            const modalGerarMedicao = document.getElementById('modal-gerar-medicao');
            if (modalGerarMedicao) {
                modalGerarMedicao.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-gerar-medicao') this.hideModalGerarMedicao();
                });
            }
            
            // Event listeners para Modal de Detalhes da Medição
            const closeModalDetalhesMedicao = document.getElementById('close-modal-detalhes-medicao');
            const fecharDetalhesMedicao = document.getElementById('fechar-detalhes-medicao');
            
            if (closeModalDetalhesMedicao) {
                closeModalDetalhesMedicao.addEventListener('click', () => this.hideModalDetalhesMedicao());
            }
            if (fecharDetalhesMedicao) {
                fecharDetalhesMedicao.addEventListener('click', () => this.hideModalDetalhesMedicao());
            }
            
            // Fechar modal de detalhes clicando fora
            const modalDetalhesMedicao = document.getElementById('modal-detalhes-medicao');
            if (modalDetalhesMedicao) {
                modalDetalhesMedicao.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-detalhes-medicao') this.hideModalDetalhesMedicao();
                });
            }
            
        } catch (error) {
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
        } catch (error) {
            this.showNotification('Erro ao carregar propostas: ' + error.message, 'error');
        }
    }


    // ========================================
    // ✅ NOVO: CÁLCULOS PARA COLUNAS PRODUZIDO, MEDIDO E RECEBIDO
    // ========================================
    
    /**
     * Calcula o valor total produzido da obra
     * Soma: (quantidade produzida × valor unitário) de cada serviço
     */
    async calcularValorProduzido(obraId) {
        try {
            // 1. Buscar todos os serviços da obra
            const { data: servicos, error: servicosError } = await supabaseClient
                .from('servicos_andamento_hvc')
                .select('id, valor_unitario')
                .eq('obra_id', obraId);

            if (servicosError) throw servicosError;
            if (!servicos || servicos.length === 0) return 0;

            let valorTotalProduzido = 0;

            // 2. Para cada serviço, buscar produções diárias e somar quantidades
            for (const servico of servicos) {
                const { data: producoes, error: producoesError } = await supabaseClient
                    .from('producoes_diarias_hvc')
                    .select('quantidade')
                    .eq('servico_id', servico.id);

                if (producoesError) throw producoesError;

                // Somar todas as quantidades produzidas deste serviço
                const quantidadeTotal = producoes?.reduce((sum, prod) => sum + (prod.quantidade || 0), 0) || 0;

                // Calcular valor: quantidade × valor unitário
                const valorUnitario = servico.valor_unitario ? (servico.valor_unitario / 100) : 0;
                valorTotalProduzido += quantidadeTotal * valorUnitario;
            }

            return valorTotalProduzido;

        } catch (error) {
            console.error('Erro ao calcular valor produzido:', error);
            return 0;
        }
    }

    /**
     * Calcula o valor total medido da obra
     * Soma de todas as medições da obra
     */
    async calcularValorMedido(obraId) {
        try {
            const { data: medicoes, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('valor_total')
                .eq('obra_id', obraId);

            if (error) throw error;

            // Somar todos os valores das medições (converter de centavos)
            const valorTotal = medicoes?.reduce((sum, medicao) => {
                const valor = medicao.valor_total ? (medicao.valor_total / 100) : 0;
                return sum + valor;
            }, 0) || 0;

            return valorTotal;

        } catch (error) {
            console.error('Erro ao calcular valor medido:', error);
            return 0;
        }
    }

    /**
     * Calcula o valor total recebido da obra
     * Soma dos recebimentos com status "RC" de todas as medições
     */
    async calcularValorRecebido(obraId) {
        try {
            const { data: medicoes, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('recebimentos')
                .eq('obra_id', obraId);

            if (error) throw error;

            let valorTotalRecebido = 0;

            // Para cada medição, somar recebimentos com status RC
            medicoes?.forEach(medicao => {
                const recebimentos = medicao.recebimentos || [];
                
                // Filtrar apenas recebimentos com status RC
                const recebimentosRC = recebimentos.filter(rec => rec.status === 'RC');
                
                // Somar valores
                const valorMedicao = recebimentosRC.reduce((sum, rec) => sum + (rec.valor || 0), 0);
                valorTotalRecebido += valorMedicao;
            });

            return valorTotalRecebido;

        } catch (error) {
            console.error('Erro ao calcular valor recebido:', error);
            return 0;
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
            await this.updateResumoObra();
            
        } catch (error) {
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
                        Total: ${this.formatMoney(proposta.total_proposta)}
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
        
        const checkboxesSelecionados = document.querySelectorAll('#lista-propostas-modal input[type="checkbox"]:checked');
        
        if (checkboxesSelecionados.length === 0) {
            this.showNotification('Selecione pelo menos uma proposta', 'warning');
            return;
        }

        let propostasAdicionadas = 0;

        checkboxesSelecionados.forEach(checkbox => {
            const propostaId = checkbox.value;
            const proposta = this.propostas.find(p => p.id === propostaId);
            
            if (!proposta) {
                return;
            }

            // Verificar se já foi adicionada
            if (this.propostasSelecionadas.find(p => p.id === propostaId)) {
                return;
            }

            // Adicionar proposta à lista
            this.propostasSelecionadas.push(proposta);
            propostasAdicionadas++;
        });

        // Atualizar tabela e resumo
        this.updatePropostasTable();
        this.updateResumoObra();
        
        // Fechar modal
        this.hideModalPropostas();
        
        // Mostrar notificação
        this.showNotification(
            `${propostasAdicionadas} proposta${propostasAdicionadas > 1 ? 's' : ''} adicionada${propostasAdicionadas > 1 ? 's' : ''} à obra!`, 
            'success'
        );
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
                <td>
                    <span class="status-badge status-${proposta.status.toLowerCase()}">
                        ${proposta.status}
                    </span>
                </td>
                <td>
                    <button type="button" 
                            class="btn btn-danger" 
                            onclick="window.obrasManager.removeProposta(${index})"
                            title="Remover proposta">
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
        }
    }

    async updateResumoObra() {
        
        // Calcular totais
        const totalPropostas = this.propostasSelecionadas.length;
        const clientesUnicos = [...new Set(this.propostasSelecionadas.map(p => p.clientes_hvc?.nome).filter(Boolean))];
        const totalClientes = clientesUnicos.length;
        
        // Calcular valor total baseado na coluna preco_total
        let valorTotal = 0;
        if (this.propostasSelecionadas.length > 0) {
            valorTotal = await this.calcularValorTotalCorreto();
        }
        
        // Calcular percentual usando valores corretos
        let percentualConclusao = 0;
        if (this.currentObraId) {
            percentualConclusao = await this.calcularPercentualCorrigido(this.currentObraId);
        }
        
        // Atualizar elementos
        const totalPropostasEl = document.getElementById('total-propostas');
        const totalClientesEl = document.getElementById('total-clientes');
        const valorTotalEl = document.getElementById('valor-total-obra');
        const progressoEl = document.getElementById('progresso-geral');
        
        if (totalPropostasEl) totalPropostasEl.textContent = totalPropostas;
        if (totalClientesEl) totalClientesEl.textContent = totalClientes;
        if (valorTotalEl) valorTotalEl.textContent = this.formatMoney(valorTotal);
        if (progressoEl) {
            progressoEl.textContent = `${percentualConclusao}%`;
        }
    }

    // Calcular valor total usando coluna preco_total
    async calcularValorTotalCorreto() {
        
        try {
            let valorTotalObra = 0;
            
            for (const proposta of this.propostasSelecionadas) {
                // Buscar preco_total da tabela itens_proposta_hvc
                const { data: itens, error } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .select('preco_total')
                    .eq('proposta_id', proposta.id);

                if (error) {
                    continue;
                }

                if (itens && itens.length > 0) {
                    for (const item of itens) {
                        const precoTotal = parseFloat(item.preco_total) || 0;
                        valorTotalObra += precoTotal;
                    }
                }
            }
            return valorTotalObra;
            
        } catch (error) {
            return 0;
        }
    }

    // Calcular percentual baseado em quantidades produzidas
    async calcularPercentualCorrigido(obraId) {
        
        try {
            // PASSO 1: Buscar propostas da obra
            const { data: obrasPropostas, error: errorObrasPropostas } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            if (errorObrasPropostas || !obrasPropostas || obrasPropostas.length === 0) {
                return 0;
            }

            const propostaIds = obrasPropostas.map(op => op.proposta_id);

            // PASSO 2: Buscar todos os itens das propostas com quantidade e servico_id
            const { data: itensPropostas, error: errorItens } = await supabaseClient
                .from('itens_proposta_hvc')
                .select('id, quantidade, servico_id')
                .in('proposta_id', propostaIds);

            if (errorItens || !itensPropostas || itensPropostas.length === 0) {
                return 0;
            }

            // PASSO 3: Buscar produções diárias da obra
            const { data: producoes, error: prodError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('quantidades_servicos')
                .eq('obra_id', obraId);

            if (prodError) {
                return 0;
            }

            // PASSO 4: Calcular totais de contratado e produzido
            let totalContratado = 0;
            let totalProduzido = 0;

            itensPropostas.forEach(item => {
                const quantidadeContratada = parseFloat(item.quantidade) || 0;
                totalContratado += quantidadeContratada;

                // Calcular quanto foi produzido deste ITEM específico
                let quantidadeProduzida = 0;
                if (producoes && producoes.length > 0) {
                    producoes.forEach(producao => {
                        const quantidades = producao.quantidades_servicos || {};
                        // ✅ Usar item.id (item_proposta_id) ao invés de servico_id
                        if (quantidades[item.id]) {
                            quantidadeProduzida += parseFloat(quantidades[item.id]) || 0;
                        }
                    });
                }

                totalProduzido += quantidadeProduzida;
            });

            // PASSO 5: Calcular percentual
            let percentualFinal = 0;
            if (totalContratado > 0) {
                percentualFinal = Math.round((totalProduzido / totalContratado) * 100);
            }
            
            // Atualizar percentual na tabela obras_hvc
            await this.atualizarPercentualNoBanco(obraId, percentualFinal);
            
            return percentualFinal;
            
        } catch (error) {
            console.error('Erro ao calcular percentual:', error);
            return 0;
        }
    }

    async atualizarPercentualNoBanco(obraId, percentual) {
        
        try {
            const { error } = await supabaseClient
                .from('obras_hvc')
                .update({ percentual_conclusao: percentual })
                .eq('id', obraId);

            if (error) {
            } else {
            }
        } catch (error) {
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
        await this.loadMedicoesObra();
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
            // Carregar todos os serviços das propostas selecionadas
            const servicosPromises = this.propostasSelecionadas.map(async (proposta) => {
                // Buscar preco_total junto com outros dados
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
            
            // 🎯 TABELA COM DUAS COLUNAS DE DATAS: INÍCIO E FINAL
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
                
                // Calcular quantidades executadas nas produções diárias para este ITEM específico
                let quantidadeExecutada = 0;
                if (this.producoesDiarias && this.producoesDiarias.length > 0) {
                    this.producoesDiarias.forEach(producao => {
                        const quantidades = producao.quantidades_servicos || {};
                        // ✅ Usar item.id (item_proposta_id) ao invés de servico_id
                        if (quantidades[item.id]) {
                            quantidadeExecutada += parseFloat(quantidades[item.id]) || 0;
                        }
                    });
                }
                
                // Calcular quantidades já medidas para este item de proposta
                let quantidadeMedida = 0;
                if (this.medicoesObra && this.medicoesObra.length > 0) {
                    this.medicoesObra.forEach(medicao => {
                        if (medicao.medicoes_servicos && medicao.medicoes_servicos.length > 0) {
                            medicao.medicoes_servicos.forEach(ms => {
                                if (ms.item_proposta_id === item.id) {
                                    quantidadeMedida += parseFloat(ms.quantidade_medida) || 0;
                                }
                            });
                        }
                    });
                }
                
                // Formatar quantidade: "medido / executado / total unidade"
                const unidade = item.servicos_hvc?.unidade || '';
                const quantidadeTexto = quantidadeExecutada > 0 
                    ? `${quantidadeMedida} / ${quantidadeExecutada} / ${quantidade} ${unidade}`.trim()
                    : `${quantidade} ${unidade}`.trim();
                
                // Calcular status automático baseado em produção
                let statusTexto = '';
                let statusCor = '';
                let percentualServico = 0;
                
                if (quantidadeExecutada === 0) {
                    statusTexto = 'PENDENTE (0,0%)';
                    statusCor = '#6c757d';
                    percentualServico = 0;
                } else {
                    percentualServico = (quantidadeExecutada / quantidade) * 100;
                    
                    if (percentualServico >= 100) {
                        statusTexto = `CONCLUÍDO (${percentualServico.toFixed(1)}%)`;
                        statusCor = '#28a745';
                    } else {
                        statusTexto = `INICIADO (${percentualServico.toFixed(1)}%)`;
                        statusCor = '#ffc107';
                    }
                }
                
                // ✅ ADICIONADO: Obter nome do local
                const localNome = this.getLocalNome(item.local_id);
                
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
                        <span class="status-badge" data-index="${index}" data-percentual="${percentualServico.toFixed(1)}" style="display: inline-block; padding: 6px 12px; border-radius: 4px; background-color: ${statusCor}; color: white; font-weight: 600; font-size: 0.85rem;">
                            ${statusTexto}
                        </span>
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
            
            // Carregar TODOS os itens da obra (incluindo serviços repetidos em locais diferentes)
            this.servicosObra = todosServicos
                .filter(item => item.servicos_hvc) // Apenas itens com serviço válido
                .map(item => ({
                    id: item.id, // ✅ ID do item (único)
                    servico_id: item.servicos_hvc.id,
                    codigo: item.servicos_hvc.codigo,
                    descricao: item.servicos_hvc.descricao,
                    local: item.locais_hvc?.nome || '-', // ✅ Local do item
                    unidade: item.servicos_hvc.unidade,
                    preco_unitario: item.preco_unitario || 0,
                    quantidade: item.quantidade || 0
                }));
            
            // Carregar equipes e integrantes para os filtros
            if (this.equipesIntegrantes.length === 0) {
                await this.loadEquipesIntegrantes();
            }
            
            // Popular filtro de equipes/integrantes
            await this.populateFiltroEquipeProducao();
            
            // Carregar produções diárias
            await this.loadProducoesDiarias();
            
        } catch (error) {
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
        
        if (!this.currentObraId) {
            this.showNotification('Salve a obra primeiro antes de gerenciar o andamento', 'warning');
            return;
        }
        
        const statusBadges = document.querySelectorAll('.status-badge');
        const dataInicioInputs = document.querySelectorAll('.data-inicio-servico');
        const dataFinalInputs = document.querySelectorAll('.data-final-servico');
        const observacoesTextareas = document.querySelectorAll('.observacoes-servico');
        
        const andamentos = [];
        
        statusBadges.forEach((badge, index) => {
            const dataInicioInput = dataInicioInputs[index];
            const dataFinalInput = dataFinalInputs[index];
            const observacoesTextarea = observacoesTextareas[index];
            const servico = this.servicosAndamento[index];
            const percentual = parseFloat(badge.dataset.percentual) || 0;
            
            // Determinar status baseado no percentual
            let status = 'PENDENTE';
            if (percentual >= 100) {
                status = 'CONCLUIDO';
            } else if (percentual > 0) {
                status = 'INICIADO';
            }
            
            if (servico) {
                andamentos.push({
                    obra_id: this.currentObraId,
                    item_proposta_id: servico.id,
                    status: status,
                    // percentual_real: percentual, // Será adicionado após criar coluna no banco
                    data_inicio: dataInicioInput.value || null,
                    data_final: dataFinalInput.value || null,
                    observacoes: observacoesTextarea.value || null
                });
            }
        });
        
        try {
            // Remover andamentos existentes
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
            
            // Recalcular percentual usando função corrigida
            const novoPercentual = await this.calcularPercentualCorrigido(this.currentObraId);
            
            // Atualizar interface imediatamente
            const progressoEl = document.getElementById('progresso-geral');
            if (progressoEl) {
                progressoEl.textContent = `${novoPercentual}%`;
            }
            
            // Atualizar valor total da obra no banco
            const valorTotalCorreto = await this.calcularValorTotalCorreto();
            await this.atualizarValorTotalNoBanco(this.currentObraId, valorTotalCorreto);
            
            // Recarregar lista de obras para mostrar valores atualizados
            await this.loadObras();
            
            this.hideModalAndamento();
            this.showNotification(`Andamento salvo! Percentual: ${novoPercentual}% | Valor: ${this.formatMoney(valorTotalCorreto)}`, 'success');
            
        } catch (error) {
            this.showNotification('Erro ao salvar andamento: ' + error.message, 'error');
        }
    }

    // Atualizar valor total da obra no banco
    async atualizarValorTotalNoBanco(obraId, valorTotal) {
        
        try {
            const valorEmCentavos = Math.round(valorTotal * 100);
            
            const { error } = await supabaseClient
                .from('obras_hvc')
                .update({ valor_total: valorEmCentavos })
                .eq('id', obraId);

            if (error) {
                console.error('Erro ao atualizar valor total:', error);
            }
        } catch (error) {
            console.error('Erro ao atualizar valor total:', error);
        }
    }

    // === OBRAS ===
    async loadObras() {
        try {
            
            const { data, error } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    obras_propostas (
                        propostas_hvc (
                            clientes_hvc (nome)
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.obras = data || [];
            this.renderObras(this.obras);
            
        } catch (error) {
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    async renderObras(obras) {
        const tbody = document.getElementById('obras-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (obras.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-building" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma obra encontrada. Clique em "Nova Obra" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        for (const obra of obras) {
            // Extrair clientes únicos
            const clientesUnicos = [...new Set(
                obra.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean) || []
            )];
            const clientesTexto = clientesUnicos.length > 0 ? clientesUnicos.join(', ') : '-';
            
            const percentualConclusao = obra.percentual_conclusao || 0;
            
            // Mostrar valor correto na lista (dividir por 100 pois está em centavos)
            const valorObra = obra.valor_total ? (obra.valor_total / 100) : 0;
            
            // ✅ NOVO: Calcular PRODUZIDO, MEDIDO e RECEBIDO
            const valorProduzido = await this.calcularValorProduzido(obra.id);
            const valorMedido = await this.calcularValorMedido(obra.id);
            const valorRecebido = await this.calcularValorRecebido(obra.id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${obra.numero_obra}</strong></td>
                <td>${clientesTexto}</td>
                <td><strong>${this.formatMoney(valorObra)}</strong></td>
                <td><strong style="color: #add8e6;">${this.formatMoney(valorProduzido)}</strong></td>
                <td><strong style="color: #ffc107;">${this.formatMoney(valorMedido)}</strong></td>
                <td><strong style="color: #28a745;">${this.formatMoney(valorRecebido)}</strong></td>
                <td class="percentual-cell">
                    <div class="percentual-container">
                        <div class="percentual-bar">
                            <div class="percentual-fill" style="width: ${percentualConclusao}%;">
                                ${percentualConclusao > 15 ? percentualConclusao + '%' : ''}
                            </div>
                        </div>
                        <span class="percentual-text">${percentualConclusao}%</span>
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${obra.status.toLowerCase()}">
                        ${obra.status}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-secondary" 
                            onclick="window.obrasManager.editObra('${obra.id}')"
                            title="Editar obra">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-warning" 
                            onclick="window.obrasManager.gerenciarAndamento('${obra.id}')"
                            title="Gerenciar andamento">
                        <i class="fas fa-tasks"></i>
                    </button>
                    <button class="btn btn-danger" 
                            onclick="window.obrasManager.deleteObra('${obra.id}')"
                            title="Excluir obra">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        }
    }

    // === FILTROS ===
    filtrarObras() {
        const termoBusca = document.getElementById('filtro-busca-obra')?.value.toLowerCase() || '';
        const statusFiltro = document.getElementById('filtro-status-obra')?.value || '';
        
        const obrasFiltradas = this.obras.filter(obra => {
            // Filtro de busca
            const textoObra = `${obra.numero_obra} ${obra.observacoes || ''}`.toLowerCase();
            const clientesObra = obra.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).join(' ').toLowerCase() || '';
            const passaBusca = !termoBusca || textoObra.includes(termoBusca) || clientesObra.includes(termoBusca);
            
            // Filtro de status
            const passaStatus = !statusFiltro || obra.status === statusFiltro;
            
            return passaBusca && passaStatus;
        });

        this.renderObras(obrasFiltradas);
    }

    limparFiltros() {
        document.getElementById('filtro-busca-obra').value = '';
        document.getElementById('filtro-status-obra').value = '';
        this.renderObras(this.obras);
    }

    // === CRUD OBRAS ===
    async handleSubmitObra(e) {
        e.preventDefault();

        if (!this.validateFormObra()) return;

        // Calcular valor total correto antes de salvar
        const valorTotalCorreto = await this.calcularValorTotalCorreto();

        const obraData = {
            numero_obra: document.getElementById('numero-obra').value,
            status: document.getElementById('status-obra').value,
            observacoes: document.getElementById('observacoes-obra').value || null,
            valor_total: Math.round(valorTotalCorreto * 100) // Salvar em centavos
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
                this.currentObraId = obra.id;
            }

            // Salvar propostas da obra
            await this.savePropostasObra(obra.id);
            
            this.hideFormObra();
            this.loadObras();
            this.showNotification('Obra salva com sucesso!', 'success');

        } catch (error) {
            this.showNotification('Erro ao salvar obra: ' + error.message, 'error');
        }
    }

    async savePropostasObra(obraId) {
        try {
            // Remover propostas existentes
            await supabaseClient
                .from('obras_propostas')
                .delete()
                .eq('obra_id', obraId);

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

    async editObra(obraId) {
        try {
            
            const { data, error } = await supabaseClient
                .from('obras_hvc')
                .select('*')
                .eq('id', obraId)
                .single();

            if (error) throw error;

            this.showFormObra(data);
        } catch (error) {
            this.showNotification('Erro ao carregar obra: ' + error.message, 'error');
        }
    }

    async deleteObra(obraId) {
        if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            
            const { error } = await supabaseClient
                .from('obras_hvc')
                .delete()
                .eq('id', obraId);

            if (error) throw error;

            this.loadObras();
            this.showNotification('Obra excluída com sucesso!', 'success');
            
        } catch (error) {
            this.showNotification('Erro ao excluir obra: ' + error.message, 'error');
        }
    }

    async gerenciarAndamento(obraId) {
        try {
            
            // Carregar obra e suas propostas
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
                .eq('id', obraId)
                .single();

            if (error) throw error;

            // Definir obra atual e propostas
            this.currentObraId = obraId;
            this.propostasSelecionadas = data.obras_propostas?.map(op => op.propostas_hvc) || [];
            
            // Mostrar modal de andamento
            this.showModalAndamento();
            
        } catch (error) {
            this.showNotification('Erro ao carregar dados da obra: ' + error.message, 'error');
        }
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

    // === FUNÇÕES PARA PRODUÇÕES DIÁRIAS ===
    
    async showModalProducao(producaoId = null) {
        
        this.currentProducaoId = producaoId;
        
        // Carregar equipes e integrantes se ainda não carregou
        if (this.equipesIntegrantes.length === 0) {
            await this.loadEquipesIntegrantes();
        }
        
        // Limpar e popular formulário
        this.clearFormProducao();
        await this.populateFormProducao();
        
        if (producaoId) {
            await this.loadProducaoData(producaoId);
            document.getElementById('titulo-modal-producao').textContent = 'Editar Produção Diária';
        } else {
            document.getElementById('titulo-modal-producao').textContent = 'Nova Produção Diária';
            // Definir data padrão como hoje
            document.getElementById('data-producao').value = new Date().toISOString().split('T')[0];
        }
        
        const modal = document.getElementById('modal-producao');
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    hideModalProducao() {
        const modal = document.getElementById('modal-producao');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentProducaoId = null;
        this.clearFormProducao();
    }
    
    clearFormProducao() {
        document.getElementById('data-producao').value = '';
        document.getElementById('equipe-producao').value = '';
        document.getElementById('observacao-producao').value = '';
        
        // Limpar quantidades dos serviços
        const servicosContainer = document.getElementById('servicos-producao');
        if (servicosContainer) {
            const inputs = servicosContainer.querySelectorAll('input[type="number"]');
            inputs.forEach(input => input.value = '');
        }
    }
    
                async populateFormProducao() {
                
                // Popular select de equipes/integrantes
                const selectEquipe = document.getElementById('equipe-producao');
                
                if (selectEquipe) {
                    selectEquipe.innerHTML = '<option value="">Selecione...</option>';
                    
                    
                    this.equipesIntegrantes.forEach((item, index) => {
                        const option = document.createElement('option');
                        option.value = `${item.tipo}:${item.id}`;
                        option.textContent = `${item.tipo === 'equipe' ? 'Equipe' : 'Integrante'}: ${item.nome}`;
                        selectEquipe.appendChild(option);
                    });
                    
                } else {
                }
                
                // Popular serviços da obra
                await this.populateServicosProducao();
                
            }

    
    async populateServicosProducao() {
        const container = document.getElementById('servicos-producao');
        if (!container || this.servicosObra.length === 0) return;
        
        container.innerHTML = '';
        
        this.servicosObra.forEach(servico => {
            const servicoDiv = document.createElement('div');
            servicoDiv.style.cssText = 'display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid rgba(173, 216, 230, 0.1); border-radius: 4px; background: rgba(255, 255, 255, 0.02);';
            
            servicoDiv.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <strong style="color: #add8e6;">${servico.codigo || 'N/A'}</strong>
                    ${servico.local && servico.local !== '-' ? `<span style="color: #90ee90; margin-left: 0.5rem; font-size: 0.85em;">(${servico.local})</span>` : ''}
                    <div style="font-size: 0.9em; color: #c0c0c0; margin-top: 0.2rem;">
                        ${servico.descricao || 'Sem descrição'}
                    </div>
                    <div style="font-size: 0.8em; color: #a0a0a0;">
                        Unidade: ${servico.unidade || 'N/A'}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label style="color: #e0e0e0; font-size: 0.9em;">Qtd:</label>
                    <input 
                        type="number" 
                        id="servico-${servico.id}" 
                        min="0" 
                        step="0.01" 
                        placeholder="0.00"
                        style="width: 100px; padding: 0.3rem; border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 4px; background: rgba(0, 0, 128, 0.2); color: #e0e0e0;"
                    />
                </div>
            `;
            
            container.appendChild(servicoDiv);
        });
    }
    
   async loadEquipesIntegrantes() {
    try {
        
        // Carregar equipes ativas (usando NUMERO em vez de NOME)
        const { data: equipes, error: errorEquipes } = await supabaseClient
            .from('equipes_hvc')
            .select('id, numero, ativa')
            .eq('ativa', true)
            .order('numero');
        
        if (errorEquipes) throw errorEquipes;
        
        // Carregar integrantes ativos
        const { data: integrantes, error: errorIntegrantes } = await supabaseClient
            .from('integrantes_hvc')
            .select('id, nome, ativo')
            .eq('ativo', true)
            .order('nome');
        
        if (errorIntegrantes) throw errorIntegrantes;
        
        // Carregar relacionamentos equipe-integrante
        const { data: relacionamentos, error: errorRelacionamentos } = await supabaseClient
            .from('equipe_integrantes')
            .select('equipe_id, integrante_id');
        
        if (errorRelacionamentos) throw errorRelacionamentos;
        
        // Adicionar informação de equipe aos integrantes
        const integrantesComEquipe = (integrantes || []).map(integrante => {
            const relacionamento = relacionamentos?.find(r => r.integrante_id === integrante.id);
            return {
                ...integrante,
                equipe_id: relacionamento?.equipe_id || null,
                tipo: 'integrante'
            };
        });
        
        // Combinar em uma lista (usando numero para equipes e nome para integrantes)
        this.equipesIntegrantes = [
            ...(equipes || []).map(e => ({ 
                ...e, 
                tipo: 'equipe',
                nome: e.numero // Usar numero como nome para exibição
            })),
            ...integrantesComEquipe
        ];
        
        
    } catch (error) {
        this.showNotification('Erro ao carregar equipes e integrantes: ' + error.message, 'error');
    }
}

    
    async handleSubmitProducao(e) {
        e.preventDefault();
        
        try {
            // Validar formulário
            const data = document.getElementById('data-producao').value;
            const equipe = document.getElementById('equipe-producao').value;
            const observacao = document.getElementById('observacao-producao').value;
            
            if (!data || !equipe) {
                this.showNotification('Preencha todos os campos obrigatórios', 'warning');
                return;
            }
            
            // Coletar quantidades dos serviços
            const quantidades = {};
            
            this.servicosObra.forEach(servico => {
                const input = document.getElementById(`servico-${servico.id}`);
                if (input && input.value && parseFloat(input.value) > 0) {
                    quantidades[servico.id] = parseFloat(input.value);
                }
            });
            
            // Separar tipo e ID da equipe/integrante
            const [tipo, id] = equipe.split(':');
            
            // Preparar dados para salvar
            const producaoData = {
                obra_id: this.currentObraId,
                data_producao: data,
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
            this.showNotification('Erro ao excluir produção: ' + error.message, 'error');
        }
    }
    
    async loadProducoesDiarias() {
        if (!this.currentObraId) return;
        
        try {
            
            const { data, error } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', this.currentObraId)
                .order('data_producao', { ascending: false });
            
            if (error) throw error;
            
            this.producoesDiarias = data || [];
            this.renderProducoesDiarias();
            
        } catch (error) {
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
                        .map(([itemId, quantidade]) => {
                            // Buscar informações do item
                            const item = this.servicosObra.find(s => s.id == itemId);
                            const codigo = item ? item.codigo : `ID:${itemId}`;
                            const local = item && item.local && item.local !== '-' ? ` (${item.local})` : '';
                            const unidade = item ? item.unidade : '';
                            return `${codigo}${local}: ${quantidade}${unidade ? ' ' + unidade : ''}`;
                        });
                    
                    const servicosTexto = servicosExecutados.length > 0 
                        ? servicosExecutados.join(' • ') 
                        : 'Nenhum serviço executado';
                    
                    // Calcular valor total da produção
                    let valorTotalProducao = 0;
                    Object.entries(quantidadesObj).forEach(([servicoId, quantidade]) => {
                        if (quantidade > 0) {
                            const servico = this.servicosObra.find(s => s.id == servicoId);
                            if (servico && servico.preco_unitario) {
                                valorTotalProducao += quantidade * parseFloat(servico.preco_unitario);
                            }
                        }
                    });
                    
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
                                
                                ${valorTotalProducao > 0 ? `
                                    <div style="color: #20c997; font-size: 0.95em; font-weight: 600; margin: 0.5rem 0;">
                                        <i class="fas fa-dollar-sign"></i>
                                        <strong>Valor Total Produzido:</strong> ${this.formatMoney(valorTotalProducao)}
                                    </div>
                                ` : ''}
                                
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
                                        const integrante = this.equipesIntegrantes.find(i => i.id == id && i.tipo === 'integrante');
                                        
                                        producoesFiltradas = producoesFiltradas.filter(p => {
                                            // Caso 1: Integrante é responsável direto
                                            if (p.tipo_responsavel === 'integrante' && p.responsavel_id == id) {
                                                return true;
                                            }
                                            
                                            // Caso 2: Integrante faz parte da equipe responsável
                                            if (p.tipo_responsavel === 'equipe' && integrante && integrante.equipe_id === p.responsavel_id) {
                                                return true;
                                            }
                                            
                                            return false;
                                        });
                                    }
                                }
                                
                                // Temporariamente substituir para renderizar filtrado
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
    
    async populateFiltroEquipeProducao() {
        const select = document.getElementById('filtro-equipe-producao');
        if (!select) return;
        
        select.innerHTML = '<option value="">Todos</option>';
        
        this.equipesIntegrantes.forEach(item => {
            const option = document.createElement('option');
            option.value = `${item.tipo}:${item.id}`;
            option.textContent = `${item.tipo === 'equipe' ? 'Equipe' : 'Integrante'}: ${item.nome}`;
            select.appendChild(option);
        });
    }
    
    // === FUNÇÕES PARA MEDIÇÕES ===
    
    async loadMedicoesObra() {
        try {
            if (!this.currentObraId) return;
            
            const { data: medicoes, error } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    medicoes_servicos (*)
                `)
                .eq('obra_id', this.currentObraId)
                .neq('status', 'cancelada')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            this.medicoesObra = medicoes || [];
            this.renderMedicoesObra(medicoes || []);
            
        } catch (error) {
            this.showNotification('Erro ao carregar medições: ' + error.message, 'error');
        }
    }
    
    renderMedicoesObra(medicoes) {
        const container = document.getElementById('lista-medicoes-obra');
        if (!container) return;
        
        if (medicoes.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #888;">
                    <i class="fas fa-file-invoice-dollar" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma medição gerada para esta obra.
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        medicoes.forEach(medicao => {
            const statusColors = {
                'pendente': '#ffc107',
                'aprovada': '#28a745',
                'paga': '#20c997',
                'cancelada': '#dc3545'
            };
            
            const statusColor = statusColors[medicao.status] || '#6c757d';
            
            const card = document.createElement('div');
            card.style.cssText = `
                padding: 1rem;
                border-bottom: 1px solid rgba(173, 216, 230, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: background 0.2s;
            `;
            card.onmouseenter = () => card.style.background = 'rgba(173, 216, 230, 0.05)';
            card.onmouseleave = () => card.style.background = 'transparent';
            
            card.innerHTML = `
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                        <strong style="color: #add8e6; font-size: 1.1rem;">${medicao.numero_medicao}</strong>
                        <span style="padding: 0.25rem 0.75rem; background: ${statusColor}; color: white; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                            ${medicao.status.toUpperCase()}
                        </span>
                    </div>
                    <div style="color: #c0c0c0; font-size: 0.9rem;">
                        <i class="fas fa-dollar-sign"></i> Valor: <strong style="color: #20c997;">${this.formatMoney(medicao.valor_total || 0)}</strong>
                        ${medicao.previsao_pagamento ? `<span style="margin-left: 1rem;"><i class="fas fa-calendar"></i> Previsão: ${new Date(medicao.previsao_pagamento).toLocaleDateString('pt-BR')}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="window.obrasManager.verDetalhesMedicao('${medicao.id}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
    }
    
    async showModalGerarMedicao() {
        if (!this.currentObraId) {
            this.showNotification('Selecione uma obra primeiro', 'warning');
            return;
        }
        
        const modal = document.getElementById('modal-gerar-medicao');
        if (!modal) return;
        
        // Inicializar array de serviços para medição
        this.servicosMedicao = [];
        
        // Gerar número da medição
        await this.gerarNumeroMedicao();
        
        // Definir data de hoje
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('data-medicao').value = hoje;
        
        // Carregar serviços contratados com informações completas
        await this.loadServicosParaMedicao();
        
        modal.classList.add('show');
    }
    
    hideModalGerarMedicao() {
        const modal = document.getElementById('modal-gerar-medicao');
        if (modal) {
            modal.classList.remove('show');
            // Limpar array de serviços ao fechar
            this.servicosMedicao = [];
        }
    }
    
    async gerarNumeroMedicao() {
        try {
            const { data: ultimaMedicao, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('numero_medicao')
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) throw error;
            
            let proximoNumero = 1;
            const anoAtual = new Date().getFullYear();
            
            if (ultimaMedicao && ultimaMedicao.length > 0) {
                const ultimoNumero = ultimaMedicao[0].numero_medicao;
                const match = ultimoNumero.match(/(\d+)\/(\d+)/);
                
                if (match) {
                    const [, num, ano] = match;
                    if (parseInt(ano) === anoAtual) {
                        proximoNumero = parseInt(num) + 1;
                    }
                }
            }
            
            const numeroMedicao = `${String(proximoNumero).padStart(3, '0')}/${anoAtual}`;
            document.getElementById('numero-medicao-gerada').value = numeroMedicao;
            
        } catch (error) {
            this.showNotification('Erro ao gerar número da medição: ' + error.message, 'error');
        }
    }
    
    async loadServicosParaMedicao() {
        try {
            if (!this.currentObraId) return;
            
            // 1. Buscar todos os itens das propostas da obra
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
            const todosItens = servicosArrays.flat();
            
            // 2. Buscar todas as produções diárias da obra
            const { data: producoes, error: prodError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', this.currentObraId);
            
            if (prodError) throw prodError;
            
            // 3. Buscar todas as medições anteriores
            const { data: medicoes, error: medError } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    id,
                    medicoes_servicos (*)
                `)
                .eq('obra_id', this.currentObraId)
                .neq('status', 'cancelada');
            
            if (medError) throw medError;
            
            // 4. Agrupar serviços por código e preço
            const servicosAgrupados = {};
            
            todosItens.forEach(item => {
                const servicoId = item.servicos_hvc?.id;
                const servicoCodigo = item.servicos_hvc?.codigo;
                const servicoNome = item.servicos_hvc?.descricao;
                const unidade = item.servicos_hvc?.unidade || 'un';
                const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
                const precoMaterial = parseFloat(item.preco_material) || 0;
                const precoUnitario = precoMaoObra + precoMaterial;
                const quantidade = parseFloat(item.quantidade) || 0;
                const precoTotal = parseFloat(item.preco_total) || 0;
                
                if (!servicoId || !servicoCodigo) return;
                
                // Chave única: servicoId + precoUnitario
                const chave = `${servicoId}_${precoUnitario}`;
                
                if (!servicosAgrupados[chave]) {
                    servicosAgrupados[chave] = {
                        chaveUnica: chave, // ✅ Adicionar chave única
                        servicoId,
                        codigo: servicoCodigo,
                        nome: servicoNome,
                        unidade,
                        precoUnitario,
                        local: item.locais_hvc?.nome || '', // ✅ Adicionar local
                        quantidadeContratada: 0,
                        valorTotalContratado: 0,
                        quantidadeProduzida: 0,
                        quantidadeMedida: 0,
                        itens: []
                    };
                }
                
                servicosAgrupados[chave].quantidadeContratada += quantidade;
                servicosAgrupados[chave].valorTotalContratado += precoTotal;
                servicosAgrupados[chave].itens.push(item);
            });
            
            // 5. Calcular quantidades produzidas (somando TODOS os itens do serviço agrupado)
            Object.values(servicosAgrupados).forEach(servico => {
                let totalProduzido = 0;
                
                (producoes || []).forEach(producao => {
                    const quantidades = producao.quantidades_servicos || {};
                    // ✅ Somar produções de TODOS os itens deste serviço (incluindo diferentes locais)
                    servico.itens.forEach(item => {
                        if (quantidades[item.id]) {
                            totalProduzido += parseFloat(quantidades[item.id]) || 0;
                        }
                    });
                });
                
                servico.quantidadeProduzida = totalProduzido;
            });
            
            // 6. Calcular quantidades já medidas
            Object.values(servicosAgrupados).forEach(servico => {
                let totalMedido = 0;
                
                (medicoes || []).forEach(medicao => {
                    const servicosMedicao = medicao.medicoes_servicos || [];
                    servicosMedicao.forEach(sm => {
                        // Verificar se o item_proposta_id está na lista de itens deste serviço agrupado
                        const itemPertenceAoServico = servico.itens.some(item => item.id === sm.item_proposta_id);
                        
                        if (itemPertenceAoServico) {
                            totalMedido += parseFloat(sm.quantidade_medida) || 0;
                        }
                    });
                });
                
                servico.quantidadeMedida = totalMedido;
            });
            
            // 7. Calcular quantidade disponível para medição
            Object.values(servicosAgrupados).forEach(servico => {
                servico.quantidadeDisponivel = Math.max(0, 
                    servico.quantidadeProduzida - servico.quantidadeMedida
                );
            });
            
            // 8. Guardar e renderizar serviços
            this.servicosParaMedicao = Object.values(servicosAgrupados);
            this.renderServicosParaMedicao(this.servicosParaMedicao);
            
        } catch (error) {
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }
    
    renderServicosParaMedicao(servicos) {
    const container = document.getElementById('producoes-para-medicao');
    if (!container) return;
    
    if (servicos.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #888;">
                Nenhum serviço disponível para medição.
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    // NÃO reinicializar servicosMedicao aqui - ele é gerenciado por confirmarQuantidade()
    
    // Filtrar serviços disponíveis
    const servicosDisponiveis = servicos.filter(s => s.quantidadeDisponivel > 0);
    
    // Renderizar lista de serviços (SEM sliders, apenas resumo)
    servicosDisponiveis.forEach((servico, index) => {
        const chaveUnica = servico.chaveUnica; // ✅ Usar chave única
        const card = document.createElement('div');
        card.style.cssText = `
            padding: 1rem;
            border: 1px solid rgba(173, 216, 230, 0.2);
            border-radius: 8px;
            margin-bottom: 1rem;
            background: rgba(173, 216, 230, 0.05);
            cursor: pointer;
            transition: all 0.3s;
        `;
        
        card.onmouseenter = () => card.style.background = 'rgba(173, 216, 230, 0.1)';
        card.onmouseleave = () => card.style.background = 'rgba(173, 216, 230, 0.05)';
        
        const valorUnitario = this.formatMoney(servico.precoUnitario);
        const quantidadeSelecionada = this.servicosMedicao.find(s => s.chave_unica === chaveUnica)?.quantidade_medida || 0;
        const valorSelecionado = quantidadeSelecionada * servico.precoUnitario;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="margin-bottom: 0.5rem;">
                        <strong style="color: #add8e6; font-size: 1.1em;">
                            ${servico.codigo} - ${servico.nome}
                        </strong>
                        <span style="color: #20c997; font-weight: 600; margin-left: 1rem;">${valorUnitario}/${servico.unidade}</span>
                        ${servico.local ? `<br><small style="color: #888; font-size: 0.85em; margin-top: 0.25rem; display: inline-block;"><i class="fas fa-map-marker-alt" style="font-size: 0.8em;"></i> ${servico.local}</small>` : ''}
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.9em; color: #c0c0c0;">
                        <div>
                            <i class="fas fa-file-contract"></i>
                            <strong>Contratado:</strong> ${servico.quantidadeContratada.toFixed(2)} ${servico.unidade}
                        </div>
                        <div>
                            <i class="fas fa-tools"></i>
                            <strong>Produzido:</strong> <span style="color: #90EE90;">${servico.quantidadeProduzida.toFixed(2)} ${servico.unidade}</span>
                        </div>
                        <div>
                            <i class="fas fa-check-circle"></i>
                            <strong>Já Medido:</strong> ${servico.quantidadeMedida.toFixed(2)} ${servico.unidade}
                        </div>
                        <div>
                            <i class="fas fa-arrow-right"></i>
                            <strong>Disponível:</strong> <span style="color: #ffc107; font-weight: 600;">${servico.quantidadeDisponivel.toFixed(2)} ${servico.unidade}</span>
                        </div>
                    </div>
                    
                    ${quantidadeSelecionada > 0 ? `
                        <div style="margin-top: 0.75rem; padding: 0.5rem; background: rgba(32, 201, 151, 0.15); border-radius: 4px; border-left: 3px solid #20c997;">
                            <strong style="color: #20c997;">✓ Quantidade a Medir:</strong>
                            <span style="color: #20c997; font-weight: 600; margin-left: 0.5rem;">${quantidadeSelecionada.toFixed(2)} ${servico.unidade}</span>
                            <strong style="color: #20c997; margin-left: 1rem;">Valor:</strong>
                            <span style="color: #20c997; font-weight: 600; margin-left: 0.5rem;">${this.formatMoney(valorSelecionado)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div style="margin-left: 1rem;">
                    <button 
                        type="button"
                        class="btn-ajustar-medicao"
                        data-index="${index}"
                        style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #000080 0%, #191970 100%); color: #add8e6; border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s;"
                        onmouseover="this.style.background='linear-gradient(135deg, #191970 0%, #000080 100%)'"
                        onmouseout="this.style.background='linear-gradient(135deg, #000080 0%, #191970 100%)'"
                    >
                        <i class="fas fa-edit"></i> ${quantidadeSelecionada > 0 ? 'Ajustar' : 'Adicionar'}
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Adicionar event listeners aos botões
    const botoes = container.querySelectorAll('.btn-ajustar-medicao');
    
    botoes.forEach(botao => {
        botao.addEventListener('click', () => {
            const index = parseInt(botao.dataset.index);
            const servico = this.servicosParaMedicao[index];
            
            if (!servico) {
                console.error('Serviço não encontrado!');
                return;
            }
            
            const quantidadeAtual = this.servicosMedicao.find(s => s.chave_unica === servico.chaveUnica)?.quantidade_medida || 0;
            
            this.abrirModalAjustarQuantidade(
                servico.chaveUnica,
                servico.codigo,
                servico.nome,
                servico.unidade,
                servico.precoUnitario,
                servico.quantidadeDisponivel,
                quantidadeAtual
            );
        });
    });
}

abrirModalAjustarQuantidade(chaveUnica, codigo, nome, unidade, precoUnitario, quantidadeDisponivel, quantidadeAtual) {
    // Encontrar o serviço completo
    const servico = this.servicosParaMedicao.find(s => s.chaveUnica === chaveUnica);
    if (!servico) return;
    
    // Criar modal
    const modalHTML = `
        <div id="modal-ajustar-quantidade" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(173, 216, 230, 0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(173, 216, 230, 0.2);">
                    <h3 style="color: #add8e6; margin: 0;">
                        <i class="fas fa-ruler"></i> Ajustar Quantidade
                    </h3>
                    <button onclick="obrasManager.fecharModalAjustarQuantidade()" style="background: none; border: none; color: #ff6b6b; font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <div style="color: #add8e6; font-size: 1.1em; font-weight: 600; margin-bottom: 0.5rem;">
                        ${codigo} - ${nome}
                    </div>
                    <div style="color: #20c997; font-weight: 600;">
                        Preço: ${this.formatMoney(precoUnitario)}/${unidade}
                    </div>
                    <div style="color: #ffc107; font-size: 0.9em; margin-top: 0.5rem;">
                        <i class="fas fa-info-circle"></i> Disponível: ${quantidadeDisponivel.toFixed(2)} ${unidade}
                    </div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.75rem; color: #add8e6; font-weight: 600;">
                        <i class="fas fa-keyboard"></i> Digite a quantidade:
                    </label>
                    <input 
                        type="number" 
                        id="input-quantidade-manual" 
                        min="0" 
                        max="${quantidadeDisponivel}" 
                        step="0.01" 
                        value="${quantidadeAtual}"
                        style="width: 100%; padding: 0.75rem; background: rgba(173, 216, 230, 0.1); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; color: #add8e6; font-size: 1.1em; font-weight: 600;"
                        oninput="obrasManager.atualizarSliderDeInput()"
                    />
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.75rem; color: #add8e6; font-weight: 600;">
                        <i class="fas fa-sliders-h"></i> Ou ajuste com o slider:
                    </label>
                    <input 
                        type="range" 
                        id="slider-quantidade-modal" 
                        min="0" 
                        max="${quantidadeDisponivel}" 
                        step="0.01" 
                        value="${quantidadeAtual}"
                        style="width: 100%; height: 10px; border-radius: 5px; background: linear-gradient(to right, #000080 0%, #add8e6 100%); outline: none; -webkit-appearance: none; cursor: pointer;"
                        oninput="obrasManager.atualizarInputDeSlider()"
                    />
                    <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #888; margin-top: 0.5rem;">
                        <span>0</span>
                        <span>${quantidadeDisponivel.toFixed(2)} ${unidade}</span>
                    </div>
                </div>
                
                <div style="padding: 1rem; background: rgba(32, 201, 151, 0.15); border-radius: 8px; border-left: 4px solid #20c997; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="color: #c0c0c0; font-size: 0.9em; margin-bottom: 0.25rem;">Quantidade a Medir:</div>
                            <div style="color: #20c997; font-size: 1.3em; font-weight: 700;">
                                <span id="quantidade-display-modal">0</span> ${unidade}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: #c0c0c0; font-size: 0.9em; margin-bottom: 0.25rem;">Valor Total:</div>
                            <div style="color: #20c997; font-size: 1.5em; font-weight: 700;">
                                <span id="valor-display-modal">R$ 0,00</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button 
                        type="button"
                        id="btn-cancelar-modal-quantidade"
                        style="flex: 1; padding: 0.75rem; background: rgba(255, 255, 255, 0.1); color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; cursor: pointer; font-weight: 600;"
                    >
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button 
                        type="button"
                        id="btn-confirmar-modal-quantidade"
                        style="flex: 2; padding: 0.75rem; background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 1.05em;"
                    >
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar modal ao body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Guardar dados do serviço atual
    this.servicoAtualModal = {
        chaveUnica,
        codigo,
        nome,
        unidade,
        precoUnitario,
        quantidadeDisponivel,
        servico
    };
    
    // Adicionar event listeners aos botões
    const btnCancelar = document.getElementById('btn-cancelar-modal-quantidade');
    const btnConfirmar = document.getElementById('btn-confirmar-modal-quantidade');
    
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => this.fecharModalAjustarQuantidade());
    }
    
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', () => this.confirmarQuantidade(chaveUnica));
    }
    
    // Atualizar displays iniciais
    this.atualizarDisplaysModal();
}

atualizarSliderDeInput() {
    const input = document.getElementById('input-quantidade-manual');
    const slider = document.getElementById('slider-quantidade-modal');
    if (input && slider) {
        slider.value = input.value;
        this.atualizarDisplaysModal();
    }
}

atualizarInputDeSlider() {
    const input = document.getElementById('input-quantidade-manual');
    const slider = document.getElementById('slider-quantidade-modal');
    if (input && slider) {
        input.value = slider.value;
        this.atualizarDisplaysModal();
    }
}

atualizarDisplaysModal() {
    const input = document.getElementById('input-quantidade-manual');
    const quantidadeDisplay = document.getElementById('quantidade-display-modal');
    const valorDisplay = document.getElementById('valor-display-modal');
    
    if (!input || !quantidadeDisplay || !valorDisplay || !this.servicoAtualModal) return;
    
    const quantidade = parseFloat(input.value) || 0;
    const valor = quantidade * this.servicoAtualModal.precoUnitario;
    
    quantidadeDisplay.textContent = quantidade.toFixed(2);
    valorDisplay.textContent = this.formatMoney(valor);
}

confirmarQuantidade(chaveUnica) {
    const input = document.getElementById('input-quantidade-manual');
    
    if (!input || !this.servicoAtualModal) {
        console.error('Input ou servicoAtualModal não encontrado!');
        return;
    }
    
    const quantidade = parseFloat(input.value) || 0;
    
    // Atualizar serviço no array usando chaveUnica
    const index = this.servicosMedicao.findIndex(s => s.chave_unica === chaveUnica);
    
    if (quantidade > 0) {
        const itemPropostaId = this.servicoAtualModal.servico.itens && this.servicoAtualModal.servico.itens.length > 0 
            ? this.servicoAtualModal.servico.itens[0].id 
            : null;
        
        const servicoData = {
            chave_unica: chaveUnica, // ✅ Usar chave única
            servico_id: this.servicoAtualModal.servico.servicoId,
            item_proposta_id: itemPropostaId,
            codigo_servico: this.servicoAtualModal.codigo,
            nome_servico: this.servicoAtualModal.nome,
            unidade: this.servicoAtualModal.unidade,
            quantidade_medida: quantidade,
            preco_unitario: this.servicoAtualModal.precoUnitario,
            valor_total: quantidade * this.servicoAtualModal.precoUnitario,
            local: this.servicoAtualModal.servico.local || ''
        };
        
        if (index >= 0) {
            this.servicosMedicao[index] = servicoData;
        } else {
            this.servicosMedicao.push(servicoData);
        }
    } else {
        // Remover se quantidade = 0
        if (index >= 0) {
            this.servicosMedicao.splice(index, 1);
        }
    }
    
    // Fechar modal
    this.fecharModalAjustarQuantidade();
    
    // Atualizar interface
    this.renderServicosParaMedicao(this.servicosParaMedicao);
    this.atualizarResumoMedicao();
}

fecharModalAjustarQuantidade() {
    const modal = document.getElementById('modal-ajustar-quantidade');
    if (modal && modal.parentElement) {
        modal.parentElement.remove();
    }
    this.servicoAtualModal = null;
}

    
    async atualizarResumoMedicao() {
        const tbody = document.getElementById('tbody-resumo-servicos');
        const valorTotalEl = document.getElementById('valor-total-medicao');
        
        if (!tbody || !valorTotalEl) {
            console.error('Elementos de resumo não encontrados');
            return;
        }
        
        if (!this.servicosMedicao || this.servicosMedicao.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 2rem; text-align: center; color: #888;">
                        Ajuste os sliders para selecionar quantidades a medir
                    </td>
                </tr>
            `;
            valorTotalEl.textContent = 'R$ 0,00';
            return;
        }
        
        tbody.innerHTML = '';
        let valorTotal = 0;
        
        this.servicosMedicao.forEach((servico, index) => {
            valorTotal += servico.valor_total;
            
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(173, 216, 230, 0.1)';
            row.innerHTML = `
                <td style="padding: 0.75rem;">
                    <strong style="color: #add8e6;">${servico.codigo_servico}</strong>
                    <span style="color: #20c997; font-size: 0.85em; margin-left: 0.5rem;">(${this.formatMoney(servico.preco_unitario)}/${servico.unidade})</span><br>
                    <small style="color: #c0c0c0;">${servico.nome_servico}</small>
                    ${servico.local ? `<br><small style="color: #888; font-size: 0.8em;"><i class="fas fa-map-marker-alt" style="font-size: 0.75em;"></i> ${servico.local}</small>` : ''}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                    ${servico.quantidade_medida.toFixed(2)} ${servico.unidade}
                </td>
                <td style="padding: 0.75rem; text-align: right;">
                    ${this.formatMoney(servico.preco_unitario)}
                </td>
                <td style="padding: 0.75rem; text-align: right; font-weight: 600; color: #20c997;">
                    ${this.formatMoney(servico.valor_total)}
                </td>
            `;
            tbody.appendChild(row);
        });
        
        valorTotalEl.textContent = this.formatMoney(valorTotal);
    }
    
    
    async handleSubmitGerarMedicao(e) {
        e.preventDefault();
        
        if (!this.servicosMedicao || this.servicosMedicao.length === 0) {
            this.showNotification('Selecione pelo menos um serviço para medir', 'warning');
            return;
        }
        
        try {
            const numeroMedicao = document.getElementById('numero-medicao-gerada').value;
            const dataMedicao = document.getElementById('data-medicao').value;
            const previsaoPagamento = document.getElementById('previsao-pagamento-medicao').value;
            const observacoes = document.getElementById('observacoes-medicao').value;
            
            // Calcular valor total
            let valorTotal = 0;
            this.servicosMedicao.forEach(servico => {
                valorTotal += servico.valor_total;
            });
            
            // Criar medição
            const { data: medicao, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .insert([{
                    numero_medicao: numeroMedicao,
                    obra_id: this.currentObraId,
                    valor_total: valorTotal,
                    valor_bruto: valorTotal,
                    status: 'pendente',
                    previsao_pagamento: previsaoPagamento || null,
                    observacoes: observacoes
                }])
                .select()
                .single();
            
            if (medicaoError) throw medicaoError;
            
            // Inserir serviços da medição
            for (const servico of this.servicosMedicao) {
                if (!servico.item_proposta_id) {
                    console.warn('Serviço sem item_proposta_id:', servico);
                    continue;
                }
                
                const { error: servicoError } = await supabaseClient
                    .from('medicoes_servicos')
                    .insert([{
                        medicao_id: medicao.id,
                        item_proposta_id: servico.item_proposta_id,
                        quantidade_medida: servico.quantidade_medida,
                        preco_unitario: servico.preco_unitario,
                        valor_total: servico.valor_total
                    }])
                
                if (servicoError) throw servicoError;
            }
            
            // Inserir previsão de pagamento se houver
            if (previsaoPagamento) {
                const { error: previsaoError } = await supabaseClient
                    .from('medicoes_previsoes_pagamento')
                    .insert([{
                        medicao_id: medicao.id,
                        data_previsao: previsaoPagamento,
                        ativa: true
                    }]);
                
                if (previsaoError) throw previsaoError;
            }
            
            this.showNotification('Medição gerada com sucesso!', 'success');
            this.hideModalGerarMedicao();
            await this.loadMedicoesObra();
            
        } catch (error) {
            this.showNotification('Erro ao gerar medição: ' + error.message, 'error');
        }
    }
    
    
    async verDetalhesMedicao(medicaoId) {
        try {
            // Buscar dados da medição
            const { data: medicao, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .eq('id', medicaoId)
                .single();
            
            if (medicaoError) throw medicaoError;
            
            // Buscar obra e clientes
            let numeroObra = 'N/A';
            let clientes = [];
            
            if (medicao.obra_id) {
                const { data: obra, error: obraError } = await supabaseClient
                    .from('obras_hvc')
                    .select('numero_obra')
                    .eq('id', medicao.obra_id)
                    .single();
                
                if (!obraError && obra) {
                    numeroObra = obra.numero_obra || 'N/A';
                }
                
                // Buscar propostas da obra
                const { data: obrasPropostas, error: opError } = await supabaseClient
                    .from('obras_propostas')
                    .select('proposta_id')
                    .eq('obra_id', medicao.obra_id);
                
                if (!opError && obrasPropostas && obrasPropostas.length > 0) {
                    const propostaIds = obrasPropostas.map(op => op.proposta_id);
                    
                    // Buscar propostas com clientes
                    const { data: propostas, error: propError } = await supabaseClient
                        .from('propostas_hvc')
                        .select('cliente_id, clientes_hvc(nome)')
                        .in('id', propostaIds);
                    
                    if (!propError && propostas) {
                        // Extrair nomes de clientes únicos
                        const clientesUnicos = new Set();
                        propostas.forEach(prop => {
                            if (prop.clientes_hvc?.nome) {
                                clientesUnicos.add(prop.clientes_hvc.nome);
                            }
                        });
                        clientes = Array.from(clientesUnicos);
                    }
                }
            }
            
            // Formatar exibição de clientes
            let nomeCliente = clientes.length > 0 ? clientes.join(', ') : 'Cliente não definido';
            
            // Buscar serviços da medição com dados do item da proposta e serviço
            const { data: servicos, error: servicosError } = await supabaseClient
                .from('medicoes_servicos')
                .select(`
                    *,
                    itens_proposta_hvc (
                        local_id,
                        locais_hvc (
                            nome
                        ),
                        servicos_hvc (
                            codigo,
                            descricao,
                            unidade
                        )
                    )
                `)
                .eq('medicao_id', medicaoId);
            
            if (servicosError) throw servicosError;
            
            // Renderizar detalhes
            this.renderDetalhesMedicao(medicao, servicos || [], numeroObra, nomeCliente);
            
            // Mostrar modal
            const modal = document.getElementById('modal-detalhes-medicao');
            if (modal) modal.classList.add('show');
            
        } catch (error) {
            this.showNotification('Erro ao carregar detalhes da medição: ' + error.message, 'error');
        }
    }
    
    renderDetalhesMedicao(medicao, servicos, numeroObra, nomeCliente) {
        const container = document.getElementById('conteudo-detalhes-medicao');
        if (!container) return;
        
        const statusColors = {
            'pendente': '#ffc107',
            'aprovada': '#28a745',
            'paga': '#20c997',
            'cancelada': '#dc3545'
        };
        
        const statusColor = statusColors[medicao.status] || '#6c757d';
        
        let html = `
                <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(173, 216, 230, 0.2);">
                    <div>
                        <h3 style="color: #add8e6; margin-bottom: 0.5rem;">${medicao.numero_medicao}</h3>
                        <span style="padding: 0.35rem 1rem; background: ${statusColor}; color: white; border-radius: 15px; font-size: 0.9rem; font-weight: 600;">
                            ${medicao.status.toUpperCase()}
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: #c0c0c0; margin-bottom: 0.25rem;">
                            <i class="fas fa-calendar"></i> Criada em: ${new Date(medicao.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        ${medicao.previsao_pagamento ? `
                            <div style="font-size: 0.9rem; color: #c0c0c0;">
                                <i class="fas fa-calendar-check"></i> Previsão: ${new Date(medicao.previsao_pagamento).toLocaleDateString('pt-BR')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="background: rgba(173, 216, 230, 0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div>
                            <label style="color: #888; font-size: 0.85em;">Obra</label>
                            <div style="color: #e0e0e0;">${numeroObra}</div>
                        </div>
                        <div>
                            <label style="color: #888; font-size: 0.85em;">Cliente</label>
                            <div style="color: #e0e0e0;">${nomeCliente}</div>
                        </div>
                        <div>
                            <label style="color: #888; font-size: 0.85em;">Data de Criação</label>
                            <div style="color: #e0e0e0;">${new Date(medicao.created_at).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <div>
                            <label style="color: #888; font-size: 0.85em;">Previsão de Pagamento</label>
                            <div style="color: #e0e0e0;">${medicao.previsao_pagamento ? new Date(medicao.previsao_pagamento).toLocaleDateString('pt-BR') : 'N/A'}</div>
                        </div>
                    </div>
                </div>
                
                <div style="background: rgba(173, 216, 230, 0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                    <h4 style="color: #add8e6; margin-bottom: 1rem;"><i class="fas fa-list"></i> Serviços Medidos</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid rgba(173, 216, 230, 0.2);">
                                <th style="padding: 0.75rem; text-align: left; color: #add8e6; font-weight: 600;">CÓDIGO</th>
                                <th style="padding: 0.75rem; text-align: left; color: #add8e6; font-weight: 600;">SERVIÇO</th>
                                <th style="padding: 0.75rem; text-align: center; color: #add8e6; font-weight: 600;">QUANTIDADE</th>
                                <th style="padding: 0.75rem; text-align: right; color: #add8e6; font-weight: 600;">PREÇO UNIT.</th>
                                <th style="padding: 0.75rem; text-align: right; color: #add8e6; font-weight: 600;">VALOR TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        servicos.forEach(servico => {
            const servicoData = servico.itens_proposta_hvc?.servicos_hvc;
            const nomeServico = servicoData?.descricao || 'Serviço';
            const codigoServico = servicoData?.codigo || '-';
            const unidade = servicoData?.unidade || 'un';
            const local = servico.itens_proposta_hvc?.locais_hvc?.nome || '';
            
            html += `
                <tr style="border-bottom: 1px solid rgba(173, 216, 230, 0.1);">
                    <td style="padding: 0.75rem; color: #c0c0c0;">${codigoServico}</td>
                    <td style="padding: 0.75rem; color: #ffffff;">
                        ${nomeServico}
                        ${local ? `<br><small style="color: #888; font-size: 0.85em;"><i class="fas fa-map-marker-alt" style="font-size: 0.8em;"></i> ${local}</small>` : ''}
                    </td>
                    <td style="padding: 0.75rem; text-align: center; color: #c0c0c0;">${servico.quantidade_medida} ${unidade}</td>
                    <td style="padding: 0.75rem; text-align: right; color: #c0c0c0;">${this.formatMoney(servico.preco_unitario)}</td>
                    <td style="padding: 0.75rem; text-align: right; color: #20c997; font-weight: 600;">${this.formatMoney(servico.valor_total)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                
                <div style="background: linear-gradient(135deg, #000080 0%, #191970 100%); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #add8e6; font-size: 1.1rem; font-weight: 600;">
                            <i class="fas fa-dollar-sign"></i> Valor Total da Medição:
                        </span>
                        <span style="color: #20c997; font-size: 1.5rem; font-weight: 700;">
                            ${this.formatMoney(medicao.valor_total || 0)}
                        </span>
                    </div>
                </div>
        `;
        
        if (medicao.observacoes) {
            html += `
                <div style="background: rgba(173, 216, 230, 0.05); padding: 1rem; border-radius: 8px; border-left: 3px solid #add8e6;">
                    <h4 style="color: #add8e6; margin-bottom: 0.5rem;"><i class="fas fa-comment"></i> Observações</h4>
                    <p style="color: #c0c0c0; line-height: 1.6; margin: 0;">${medicao.observacoes}</p>
                </div>
            `;
        }
        
        html += `</div>`;
        
        container.innerHTML = html;
    }
    
    hideModalDetalhesMedicao() {
        const modal = document.getElementById('modal-detalhes-medicao');
        if (modal) modal.classList.remove('show');
    }
}


                            // DEBUG PARA PRODUÇÕES DIÁRIAS
                            async function debugProducoesDiarias() {
                                
                                // 1. Verificar se obrasManager existe
                                
                                if (!window.obrasManager) {
                                    return;
                                }
                                
                                // 2. Verificar obra atual
                                
                                // 3. Verificar container
                                const container = document.getElementById('lista-producoes-diarias');
                                
                                // 4. Verificar produções carregadas
                                
                                // 5. Testar consulta direta
                                try {
                                    const { data, error } = await supabaseClient
                                        .from('producoes_diarias_hvc')
                                        .select('*')
                                        .eq('obra_id', window.obrasManager.currentObraId);
                                    
                                    
                                } catch (err) {
                                }
                                
                                // 6. Forçar renderização
                                if (window.obrasManager.renderProducoesDiarias) {
                                    await window.obrasManager.renderProducoesDiarias();
                                }
                                
                            }
                            
                            // Executar
                            debugProducoesDiarias();



// Expor globalmente para uso nos event handlers inline
window.obrasManager = null;
