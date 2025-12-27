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
        this.nomeObraAtual = ''; // Nome da obra atual para edição
        
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
            this.initRelatorioEventListeners(); // ✅ Inicializar event listeners do relatório
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
            
            // Event listeners para PDF da Medição
            const btnGerarPdfMedicao = document.getElementById('btn-gerar-pdf-medicao');
            if (btnGerarPdfMedicao) {
                btnGerarPdfMedicao.addEventListener('click', () => this.showModalPdfMedicao());
            }
            
            // Modal de opções PDF
            const closeModalPdfMedicao = document.getElementById('close-modal-pdf-medicao');
            const cancelPdfMedicao = document.getElementById('cancel-pdf-medicao');
            const btnBaixarPdfMedicaoPC = document.getElementById('btn-baixar-pdf-medicao-pc');
            const btnSalvarPdfMedicaoOneDrive = document.getElementById('btn-salvar-pdf-medicao-onedrive');
            
            const btnVisualizarPdfMedicao = document.getElementById('btn-visualizar-pdf-medicao');
            
            if (closeModalPdfMedicao) closeModalPdfMedicao.addEventListener('click', () => this.hideModalPdfMedicao());
            if (cancelPdfMedicao) cancelPdfMedicao.addEventListener('click', () => this.hideModalPdfMedicao());
            if (btnBaixarPdfMedicaoPC) btnBaixarPdfMedicaoPC.addEventListener('click', () => this.gerarPdfMedicaoPC());
            if (btnSalvarPdfMedicaoOneDrive) btnSalvarPdfMedicaoOneDrive.addEventListener('click', () => this.showModalOneDriveMedicao());
            if (btnVisualizarPdfMedicao) btnVisualizarPdfMedicao.addEventListener('click', () => this.visualizarPdfMedicao());
            
            // Modal OneDrive para medição
            const closeOneDriveMedicao = document.getElementById('close-modal-onedrive-medicao');
            const cancelOneDriveMedicao = document.getElementById('cancel-onedrive-medicao');
            const confirmarOneDriveMedicao = document.getElementById('confirmar-onedrive-medicao');
            
            if (closeOneDriveMedicao) closeOneDriveMedicao.addEventListener('click', () => this.hideModalOneDriveMedicao());
            if (cancelOneDriveMedicao) cancelOneDriveMedicao.addEventListener('click', () => this.hideModalOneDriveMedicao());
            if (confirmarOneDriveMedicao) confirmarOneDriveMedicao.addEventListener('click', () => this.salvarPdfMedicaoOneDrive());
            
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
            // 1. Buscar propostas da obra
            const { data: obrasPropostas, error: obrasError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            if (obrasError) throw obrasError;
            if (!obrasPropostas || obrasPropostas.length === 0) return 0;

            // 2. Buscar itens das propostas (serviços contratados)
            const propostaIds = obrasPropostas.map(op => op.proposta_id);
            const { data: itens, error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .select('id, quantidade, preco_total')
                .in('proposta_id', propostaIds);

            if (itensError) throw itensError;
            if (!itens || itens.length === 0) return 0;

            // 3. Buscar produções diárias da obra
            const { data: producoes, error: producoesError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('quantidades_servicos')
                .eq('obra_id', obraId);

            if (producoesError) throw producoesError;

            // 4. Calcular valor produzido
            let valorTotalProduzido = 0;


            for (const item of itens) {
                // Calcular valor unitário: preco_total / quantidade
                const quantidade = parseFloat(item.quantidade) || 0;
                const precoTotal = parseFloat(item.preco_total) || 0;
                const valorUnitario = quantidade > 0 ? (precoTotal / quantidade) : 0;


                // Somar quantidades produzidas deste item
                let quantidadeProduzida = 0;
                producoes?.forEach(producao => {
                    const quantidades = producao.quantidades_servicos || {};
                    const qtd = parseFloat(quantidades[item.id]) || 0;

                    quantidadeProduzida += qtd;
                });


                // Calcular valor: quantidade_produzida × valor_unitário
                const valorItem = quantidadeProduzida * valorUnitario;
                

                
                valorTotalProduzido += valorItem;
            }


            return valorTotalProduzido;

        } catch (error) {

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

            // Somar todos os valores das medições
            const valorTotal = medicoes?.reduce((sum, medicao) => {
                const valor = medicao.valor_total || 0;
                return sum + valor;
            }, 0) || 0;

            return valorTotal;

        } catch (error) {

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
        this.nomeObraAtual = '';
        this.updatePropostasTable();
        this.updateResumoObra();
    }

    populateFormObra(obra) {
        const numeroInput = document.getElementById('numero-obra');
        const statusSelect = document.getElementById('status-obra');
        const observacoesTextarea = document.getElementById('observacoes-obra');
        const nomeObraSelect = document.getElementById('nome-obra-select');
        
        if (numeroInput) numeroInput.value = obra.numero_obra;
        if (statusSelect) statusSelect.value = obra.status;
        if (observacoesTextarea) observacoesTextarea.value = obra.observacoes || '';
        
        // Guardar nome_obra para selecionar após carregar propostas
        this.nomeObraAtual = obra.nome_obra || '';
        
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
                    ${proposta.nome_obra ? `<div style="color: #17a2b8; font-size: 0.85rem; font-style: italic;">(${proposta.nome_obra})</div>` : ''}
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
        
        // Atualizar select de Nome da Obra com base nas propostas selecionadas
        this.updateNomeObraSelect();

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

    // Atualizar select de Nome da Obra com base nas propostas selecionadas
    updateNomeObraSelect() {
        const select = document.getElementById('nome-obra-select');
        if (!select) return;
        
        // Limpar opções anteriores
        select.innerHTML = '';
        
        // Coletar nomes de obra das propostas selecionadas (sem duplicatas)
        const nomesObra = [...new Set(
            this.propostasSelecionadas
                .map(p => p.nome_obra)
                .filter(nome => nome && nome.trim() !== '')
        )];
        
        if (nomesObra.length === 0) {
            select.innerHTML = '<option value="">Selecione as propostas primeiro...</option>';
            return;
        }
        
        // Adicionar opção padrão
        select.innerHTML = '<option value="">Selecione o nome da obra...</option>';
        
        // Adicionar opções de nomes de obra
        nomesObra.forEach(nome => {
            const option = document.createElement('option');
            option.value = nome;
            option.textContent = nome;
            select.appendChild(option);
        });
        
        // Se houver nome_obra atual (edição), selecionar
        if (this.nomeObraAtual && nomesObra.includes(this.nomeObraAtual)) {
            select.value = this.nomeObraAtual;
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
        
        // ✅ NOVO: Carregar despesas da obra
        await this.carregarDespesasObraModal();
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
                        id,
                        proposta_id,
                        servico_id,
                        local_id,
                        quantidade,
                        preco_mao_obra,
                        preco_material,
                        preco_total,
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
            // Salvar em reais (não multiplicar por 100)
            const { error } = await supabaseClient
                .from('obras_hvc')
                .update({ valor_total: valorTotal })
                .eq('id', obraId);

            if (error) {

            }
        } catch (error) {

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
                    <td colspan="11" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-building" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma obra encontrada. Clique em "Nova Obra" para começar.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Buscar despesas do fluxo de caixa para todas as obras
        const despesasPorObra = await this.carregarDespesasObras();

        for (const obra of obras) {
            // Extrair clientes únicos
            const clientesUnicos = [...new Set(
                obra.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean) || []
            )];
            const clientesTexto = clientesUnicos.length > 0 ? clientesUnicos.join(', ') : '-';
            
            const percentualConclusao = obra.percentual_conclusao || 0;
            
            // Mostrar valor correto na lista (já está em reais)
            const valorObra = obra.valor_total || 0;
            
            // ✅ NOVO: Calcular PRODUZIDO, MEDIDO e RECEBIDO
            const valorProduzido = await this.calcularValorProduzido(obra.id);
            const valorMedido = await this.calcularValorMedido(obra.id);
            const valorRecebido = await this.calcularValorRecebido(obra.id);
            
            // ✅ NOVO: Buscar despesas e calcular resultado
            const numeroObraLimpo = (obra.numero_obra || '').split('/')[0].trim();
            const despesas = despesasPorObra[numeroObraLimpo] || 0;
            const resultado = valorRecebido - despesas;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${obra.numero_obra}</strong>
                    ${obra.nome_obra ? `<br><span style="font-size: 0.85em; color: #add8e6;">(${obra.nome_obra})</span>` : ''}
                </td>
                <td>${clientesTexto}</td>
                <td><strong>${this.formatMoney(valorObra)}</strong></td>
                <td><strong style="color: #add8e6;">${this.formatMoney(valorProduzido)}</strong></td>
                <td><strong style="color: #ffc107;">${this.formatMoney(valorMedido)}</strong></td>
                <td><strong style="color: #28a745;">${this.formatMoney(valorRecebido)}</strong></td>
                <td><strong style="color: #dc3545;">${this.formatMoney(despesas)}</strong></td>
                <td><strong style="color: ${resultado >= 0 ? '#17a2b8' : '#dc3545'};">${this.formatMoney(resultado)}</strong></td>
                <td class="percentual-cell">
                    <div class="percentual-container">
                        <div class="percentual-bar">
                            <div class="percentual-fill" style="width: ${percentualConclusao}%;"></div>
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
    
    // ✅ NOVO: Função para carregar despesas de todas as obras do fluxo de caixa
    async carregarDespesasObras() {
        try {
            const { data: despesasFluxo, error } = await supabaseClient
                .from('fluxo_caixa_hvc')
                .select('categoria, valor, status')
                .eq('tipo', 'pagamento');
            
            if (error) {
                console.error('⚠️ Erro ao buscar despesas:', error);
                return {};
            }
            
            // Criar mapa de despesas por número de obra (categoria)
            const despesasPorObra = {};
            (despesasFluxo || []).forEach(item => {
                if (item.categoria) {
                    // Extrair número da obra da categoria (pode ser "0001/2025" ou apenas "0001")
                    const categoriaLimpa = item.categoria.split('/')[0].trim();
                    if (!despesasPorObra[categoriaLimpa]) {
                        despesasPorObra[categoriaLimpa] = 0;
                    }
                    // Somar apenas despesas com status PG (pagas)
                    if (item.status === 'PG') {
                        despesasPorObra[categoriaLimpa] += parseFloat(item.valor) || 0;
                    }
                }
            });
            
            return despesasPorObra;
        } catch (error) {
            console.error('⚠️ Erro ao carregar despesas:', error);
            return {};
        }
    }
    
    // ✅ NOVO: Função para carregar despesas de uma obra específica no modal de andamento
    async carregarDespesasObraModal() {
        try {
            if (!this.obraAtual || !this.obraAtual.numero_obra) {
                console.warn('⚠️ Obra atual não definida');
                return;
            }
            
            const numeroObraLimpo = (this.obraAtual.numero_obra || '').split('/')[0].trim();
            
            // Buscar despesas do fluxo de caixa para esta obra
            const { data: despesas, error } = await supabaseClient
                .from('fluxo_caixa_hvc')
                .select('*')
                .eq('tipo', 'pagamento')
                .ilike('categoria', `${numeroObraLimpo}%`)
                .order('data_vencimento', { ascending: false });
            
            if (error) {
                console.error('⚠️ Erro ao buscar despesas da obra:', error);
                return;
            }
            
            // Separar despesas por status
            const despesasPagas = (despesas || []).filter(d => d.status === 'PG');
            const despesasPendentes = (despesas || []).filter(d => d.status !== 'PG');
            
            // Calcular totais
            let totalDespesasPagas = 0;
            let totalDespesasPendentes = 0;
            despesasPagas.forEach(d => totalDespesasPagas += parseFloat(d.valor) || 0);
            despesasPendentes.forEach(d => totalDespesasPendentes += parseFloat(d.valor) || 0);
            
            // Calcular valor recebido (já recebido de fato)
            const valorRecebido = await this.calcularValorRecebido(this.currentObraId);
            
            // Buscar medições para calcular retenções totais
            const { data: medicoes } = await supabaseClient
                .from('medicoes_hvc')
                .select('valor_total, valor_bruto, recebimentos')
                .eq('obra_id', this.currentObraId);
            
            // Calcular retenções totais (soma de todas retenções de todas medições)
            // Retenção = valor_total - soma dos recebimentos
            let retensoesTotais = 0;
            (medicoes || []).forEach(med => {
                const valorMedicao = parseFloat(med.valor_bruto) || parseFloat(med.valor_total) || 0;
                let totalRecebidoMedicao = 0;
                if (med.recebimentos && Array.isArray(med.recebimentos)) {
                    med.recebimentos.forEach(rec => {
                        totalRecebidoMedicao += parseFloat(rec.valor) || 0;
                    });
                }
                // Retenção desta medição = valor da medição - total recebido
                const retencaoMedicao = valorMedicao - totalRecebidoMedicao;
                if (retencaoMedicao > 0) {
                    retensoesTotais += retencaoMedicao;
                }
            });
            
            // Calcular valor total contratado
            const valorContratado = parseFloat(this.obraAtual.valor_total) || 0;
            
            // SITUAÇÃO ATUAL: RECEBIDO - DESPESAS PAGAS - RETENSÕES TOTAIS
            const resultadoAtual = valorRecebido - totalDespesasPagas - retensoesTotais;
            
            // PREVISÃO FUTURA: A RECEBER = TOTAL CONTRATADO - TOTAL JÁ RECEBIDO
            const valorAReceber = valorContratado - valorRecebido;
            // RESULTADO PREVISTO = A RECEBER - DESPESAS PENDENTES
            const resultadoPrevisto = valorAReceber - totalDespesasPendentes;
            
            // Cálculos consolidados
            const totalEntradas = valorRecebido + valorAReceber;
            const totalSaidas = totalDespesasPagas + totalDespesasPendentes + retensoesTotais;
            const balancoFinal = totalEntradas - totalSaidas;
            const margem = totalEntradas > 0 ? (balancoFinal / totalEntradas) * 100 : 0;
            
            // Atualizar SITUAÇÃO ATUAL
            this.atualizarElemento('valor-recebido-atual', this.formatMoney(valorRecebido));
            this.atualizarElemento('valor-despesas-pagas', this.formatMoney(totalDespesasPagas));
            this.atualizarElemento('valor-retensoes-totais', this.formatMoney(retensoesTotais));
            this.atualizarElementoComCor('valor-resultado-atual', this.formatMoney(resultadoAtual), resultadoAtual >= 0 ? '#17a2b8' : '#dc3545');
            
            // Atualizar PREVISÃO FUTURA
            this.atualizarElemento('valor-a-receber', this.formatMoney(valorAReceber));
            this.atualizarElemento('valor-despesas-pendentes', this.formatMoney(totalDespesasPendentes));
            this.atualizarElementoComCor('valor-resultado-previsto', this.formatMoney(resultadoPrevisto), resultadoPrevisto >= 0 ? '#9b59b6' : '#dc3545');
            
            // Atualizar RESUMO CONSOLIDADO
            this.atualizarElemento('valor-total-entradas', this.formatMoney(totalEntradas));
            this.atualizarElemento('valor-total-saidas', this.formatMoney(totalSaidas));
            this.atualizarElementoComCor('valor-balanco-final', this.formatMoney(balancoFinal), balancoFinal >= 0 ? '#28a745' : '#dc3545');
            this.atualizarElementoComCor('valor-margem', `${margem.toFixed(1)}%`, margem >= 0 ? '#28a745' : '#dc3545');
            
            // Atualizar labels de totais das listas
            this.atualizarElemento('total-despesas-pagas-label', this.formatMoney(totalDespesasPagas));
            this.atualizarElemento('total-despesas-pendentes-label', this.formatMoney(totalDespesasPendentes));
            
            // Renderizar lista de despesas PAGAS
            this.renderizarListaDespesas('lista-despesas-pagas', despesasPagas, '#dc3545', 'Nenhuma despesa paga encontrada.');
            
            // Renderizar lista de despesas PENDENTES
            this.renderizarListaDespesas('lista-despesas-pendentes', despesasPendentes, '#ffc107', 'Nenhuma despesa pendente encontrada.');
            
        } catch (error) {
            console.error('⚠️ Erro ao carregar despesas do modal:', error);
        }
    }
    
    // Função auxiliar para atualizar elemento
    atualizarElemento(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    }
    
    // Função auxiliar para atualizar elemento com cor
    atualizarElementoComCor(id, valor, cor) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = valor;
            el.style.color = cor;
        }
    }
    
    // Função auxiliar para renderizar lista de despesas
    renderizarListaDespesas(containerId, despesas, corHeader, mensagemVazia) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!despesas || despesas.length === 0) {
            container.innerHTML = `
                <div style="padding: 1rem; text-align: center; color: #888; font-size: 0.85rem;">
                    ${mensagemVazia}
                </div>
            `;
        } else {
            container.innerHTML = `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead style="background: rgba(0, 0, 0, 0.2); position: sticky; top: 0;">
                        <tr>
                            <th style="padding: 0.5rem; text-align: left; color: ${corHeader};">Nome</th>
                            <th style="padding: 0.5rem; text-align: left; color: ${corHeader};">Detalhe</th>
                            <th style="padding: 0.5rem; text-align: center; color: ${corHeader};">Data</th>
                            <th style="padding: 0.5rem; text-align: right; color: ${corHeader};">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${despesas.map(d => `
                            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                                <td style="padding: 0.5rem; color: #e0e0e0;">${d.nome || '-'}</td>
                                <td style="padding: 0.5rem; color: #a0a0a0;">${d.detalhe || '-'}</td>
                                <td style="padding: 0.5rem; text-align: center; color: #a0a0a0;">${d.data_vencimento ? new Date(d.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                                <td style="padding: 0.5rem; text-align: right; color: #dc3545; font-weight: bold;">${this.formatMoney(parseFloat(d.valor) || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
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
            nome_obra: document.getElementById('nome-obra-select').value || null,
            status: document.getElementById('status-obra').value,
            observacoes: document.getElementById('observacoes-obra').value || null,
            valor_total: valorTotalCorreto // Salvar em reais (preco_total já está em reais)
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
        const nomeObra = document.getElementById('nome-obra-select').value;
        
        if (!numeroObra || !numeroObra.match(/^\d{4}\/\d{4}$/)) {
            this.showNotification('Número da obra deve estar no formato XXXX/YYYY', 'error');
            return false;
        }

        if (this.propostasSelecionadas.length === 0) {
            this.showNotification('Adicione pelo menos uma proposta à obra', 'error');
            return false;
        }

        if (!nomeObra) {
            this.showNotification('Selecione o nome da obra', 'error');
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
            this.obraAtual = data; // Armazenar dados completos da obra para o relatório
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
            // ✅ Calcular status dinâmico baseado nos recebimentos
            const recebimentos = medicao.recebimentos || [];
            const totalRecebido = recebimentos.reduce((sum, rec) => sum + (rec.valor || 0), 0);
            const valorTotal = medicao.valor_bruto || medicao.valor_total || 0;
            
            let statusMedicao = 'PENDENTE';
            let statusColor = '#ffc107';
            
            if (totalRecebido === 0) {
                statusMedicao = 'PENDENTE';
                statusColor = '#ffc107';
            } else if (totalRecebido < valorTotal) {
                statusMedicao = 'RC c/ RET';
                statusColor = '#17a2b8';
            } else if (totalRecebido >= valorTotal) {
                statusMedicao = 'RECEBIDO';
                statusColor = '#28a745';
            }
            
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
                            ${statusMedicao}
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
                    <button class="btn btn-info" onclick="window.obrasManager.editarMedicao('${medicao.id}')" title="Editar medição" style="background: #17a2b8; border-color: #17a2b8;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-warning" onclick="window.obrasManager.abrirModalAnotacoesMedicao('${medicao.id}')" title="Anotações" style="background: #ffc107; border-color: #ffc107;">
                        <i class="fas fa-sticky-note"></i>
                    </button>
                    <button class="btn btn-danger" onclick="window.obrasManager.excluirMedicaoObra('${medicao.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
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
                        id,
                        proposta_id,
                        servico_id,
                        local_id,
                        quantidade,
                        preco_mao_obra,
                        preco_material,
                        preco_total,
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
                        data-chave="${chaveUnica}"
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
            const chaveUnica = botao.dataset.chave;
            const servico = this.servicosParaMedicao.find(s => s.chaveUnica === chaveUnica);
            
            if (!servico) {
                console.error('Serviço não encontrado para chave:', chaveUnica);
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
    if (input && slider && this.servicoAtualModal) {
        // Validar limite máximo
        let valor = parseFloat(input.value) || 0;
        const maximo = this.servicoAtualModal.quantidadeDisponivel;
        
        if (valor > maximo) {
            valor = maximo;
            input.value = maximo;
            this.showNotification(`Quantidade máxima disponível: ${maximo.toFixed(2)}`, 'warning');
        }
        if (valor < 0) {
            valor = 0;
            input.value = 0;
        }
        
        slider.value = valor;
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
        return;
    }
    
    let quantidade = parseFloat(input.value) || 0;
    const maximo = this.servicoAtualModal.quantidadeDisponivel;
    
    // Validação final: garantir que quantidade não exceda o máximo disponível
    if (quantidade > maximo) {
        quantidade = maximo;
        this.showNotification(`Quantidade ajustada para o máximo disponível: ${maximo.toFixed(2)}`, 'warning');
    }
    if (quantidade < 0) {
        quantidade = 0;
    }
    
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
            
            // Armazenar medição atual para uso no PDF
            this.medicaoAtual = medicao;
            
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
        
        // ✅ Calcular status dinâmico baseado nos recebimentos (igual à página de medições)
        const recebimentos = medicao.recebimentos || [];
        const totalRecebido = recebimentos.reduce((sum, rec) => sum + (rec.valor || 0), 0);
        const valorTotal = medicao.valor_bruto || medicao.valor_total || 0;
        const retencao = valorTotal - totalRecebido;
        
        let statusMedicao = 'PENDENTE';
        let statusColor = '#ffc107';
        
        if (totalRecebido === 0) {
            statusMedicao = 'PENDENTE';
            statusColor = '#ffc107';
        } else if (totalRecebido < valorTotal) {
            statusMedicao = 'RC c/ RET';
            statusColor = '#17a2b8';
        } else if (totalRecebido >= valorTotal) {
            statusMedicao = 'RECEBIDO';
            statusColor = '#28a745';
        }
        
        let html = `
                <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(173, 216, 230, 0.2);">
                    <div>
                        <h3 style="color: #add8e6; margin-bottom: 0.5rem;">${medicao.numero_medicao}</h3>
                        <span style="padding: 0.35rem 1rem; background: ${statusColor}; color: white; border-radius: 15px; font-size: 0.9rem; font-weight: 600;">
                            ${statusMedicao}
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
                <div style="background: rgba(173, 216, 230, 0.05); padding: 1rem; border-radius: 8px; border-left: 3px solid #add8e6; margin-bottom: 1.5rem;">
                    <h4 style="color: #add8e6; margin-bottom: 0.5rem;"><i class="fas fa-comment"></i> Observações</h4>
                    <p style="color: #c0c0c0; line-height: 1.6; margin: 0;">${medicao.observacoes}</p>
                </div>
            `;
        }
        
        // ✅ Adicionar histórico de recebimentos (igual à página de medições)
        if (recebimentos.length > 0) {
            html += `
                <div style="background: rgba(40, 167, 69, 0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h4 style="color: #28a745; margin-bottom: 1rem;"><i class="fas fa-money-bill-wave"></i> Histórico de Recebimentos</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid rgba(40, 167, 69, 0.2);">
                                <th style="padding: 0.75rem; text-align: left; color: #28a745; font-weight: 600;">#</th>
                                <th style="padding: 0.75rem; text-align: left; color: #28a745; font-weight: 600;">DATA</th>
                                <th style="padding: 0.75rem; text-align: right; color: #28a745; font-weight: 600;">VALOR</th>
                                <th style="padding: 0.75rem; text-align: left; color: #28a745; font-weight: 600;">EVENTO ID</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            recebimentos.forEach((rec, index) => {
                // Formatar data corretamente (evitar problema de fuso horário)
                let dataFormatada = 'Data não informada';
                if (rec.data) {
                    const dataStr = String(rec.data);
                    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const [ano, mes, dia] = dataStr.split('-');
                        dataFormatada = `${dia}/${mes}/${ano}`;
                    } else {
                        dataFormatada = new Date(rec.data).toLocaleDateString('pt-BR');
                    }
                }
                
                html += `
                    <tr style="border-bottom: 1px solid rgba(40, 167, 69, 0.1);">
                        <td style="padding: 0.75rem; color: #c0c0c0;">${index + 1}</td>
                        <td style="padding: 0.75rem; color: #c0c0c0;">${dataFormatada}</td>
                        <td style="padding: 0.75rem; text-align: right; color: #28a745; font-weight: 600;">${this.formatMoney(rec.valor)}</td>
                        <td style="padding: 0.75rem; color: #888; font-size: 0.85em;">${rec.evento_id || '-'}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // ✅ Adicionar rodapé com totais (igual à página de medições)
        html += `
            <div style="background: rgba(173, 216, 230, 0.05); padding: 1.5rem; border-radius: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
                <div>
                    <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Total Recebido</label>
                    <div style="color: #28a745; font-size: 1.3rem; font-weight: 700;">${this.formatMoney(totalRecebido)}</div>
                </div>
                <div>
                    <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Retenção</label>
                    <div style="color: #ffc107; font-size: 1.3rem; font-weight: 700;">${this.formatMoney(retencao)}</div>
                </div>
                <div>
                    <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Status</label>
                    <span style="padding: 0.5rem 1rem; background: ${statusColor}; color: white; border-radius: 15px; font-size: 1rem; font-weight: 600; display: inline-block;">
                        ${statusMedicao}
                    </span>
                </div>
            </div>
        `;
        
        html += `</div>`;
        
        container.innerHTML = html;
    }
    
    hideModalDetalhesMedicao() {
        const modal = document.getElementById('modal-detalhes-medicao');
        if (modal) modal.classList.remove('show');
    }
    
    // === FUNÇÕES DE MEDIÇÕES ===
    
    async excluirMedicaoObra(medicaoId) {
        if (!confirm('Tem certeza que deseja excluir esta medição?')) {
            return;
        }
        
        try {
            // 1. Excluir serviços da medição
            const { error: servicosError } = await supabaseClient
                .from('medicoes_servicos')
                .delete()
                .eq('medicao_id', medicaoId);
            
            if (servicosError) throw servicosError;
            
            // 2. Excluir medição
            const { error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .delete()
                .eq('id', medicaoId);
            
            if (medicaoError) throw medicaoError;
            
            this.showNotification('Medição excluída com sucesso!', 'success');
            
            // Recarregar lista de medições
            await this.loadMedicoesObra();
            
        } catch (error) {
            this.showNotification('Erro ao excluir medição: ' + error.message, 'error');
        }
    }
    
    async abrirModalAnotacoesMedicao(medicaoId) {
        try {
            // Buscar medição
            const { data: medicao, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .eq('id', medicaoId)
                .single();
            
            if (error) throw error;
            
            const modalHTML = `
                <div id="modal-anotacoes-medicao" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="background: linear-gradient(135deg, #000080, #191970); padding: 2rem; border-radius: 12px; width: 90%; max-width: 600px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); border: 1px solid rgba(173, 216, 230, 0.3);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid rgba(173, 216, 230, 0.3); padding-bottom: 1rem;">
                            <h3 style="color: #add8e6; margin: 0; font-size: 1.5rem;">
                                <i class="fas fa-sticky-note"></i> Anotações - Medição ${medicao.numero_medicao}
                            </h3>
                            <button onclick="window.obrasManager.fecharModalAnotacoesMedicao()" style="background: none; border: none; color: #ff6b6b; font-size: 1.5rem; cursor: pointer;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; color: #add8e6; margin-bottom: 0.5rem; font-weight: 600;">
                                Anotações:
                            </label>
                            <textarea 
                                id="textarea-anotacoes-medicao" 
                                style="width: 100%; min-height: 200px; padding: 1rem; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 8px; color: #e0e0e0; font-family: inherit; resize: vertical;"
                                placeholder="Digite suas anotações aqui..."
                            >${medicao.anotacoes || ''}</textarea>
                        </div>
                        
                        <div style="display: flex; gap: 1rem;">
                            <button 
                                onclick="window.obrasManager.fecharModalAnotacoesMedicao()" 
                                style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                Cancelar
                            </button>
                            <button 
                                onclick="window.obrasManager.salvarAnotacoesMedicao('${medicaoId}')" 
                                style="flex: 1; padding: 0.75rem; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
        } catch (error) {
            this.showNotification('Erro ao abrir anotações: ' + error.message, 'error');
        }
    }
    
    fecharModalAnotacoesMedicao() {
        const modal = document.getElementById('modal-anotacoes-medicao');
        if (modal) modal.remove();
    }
    
    async salvarAnotacoesMedicao(medicaoId) {
        try {
            const textarea = document.getElementById('textarea-anotacoes-medicao');
            const anotacoes = textarea.value;
            
            const { error } = await supabaseClient
                .from('medicoes_hvc')
                .update({ anotacoes: anotacoes })
                .eq('id', medicaoId);
            
            if (error) throw error;
            
            this.showNotification('Anotações salvas com sucesso!', 'success');
            this.fecharModalAnotacoesMedicao();
            
            // Recarregar lista de medições
            await this.loadMedicoesObra();
            
        } catch (error) {
            this.showNotification('Erro ao salvar anotações: ' + error.message, 'error');
        }
    }

    // ========== FUNÇÕES DE RELATÓRIO DA OBRA ==========
    
    initRelatorioEventListeners() {
        // Botão de relatório no modal de andamento
        const btnRelatorio = document.getElementById('btn-relatorio-obra');
        if (btnRelatorio) {
            btnRelatorio.addEventListener('click', () => this.showModalRelatorio());
        }
        
        // Modal de relatório
        const closeModalRelatorio = document.getElementById('close-modal-relatorio');
        const cancelRelatorio = document.getElementById('cancel-relatorio');
        const btnBaixarPC = document.getElementById('btn-baixar-relatorio-pc');
        const btnSalvarOneDrive = document.getElementById('btn-salvar-relatorio-onedrive');
        
        const btnVisualizarRelatorio = document.getElementById('btn-visualizar-relatorio');
        
        if (closeModalRelatorio) closeModalRelatorio.addEventListener('click', () => this.hideModalRelatorio());
        if (cancelRelatorio) cancelRelatorio.addEventListener('click', () => this.hideModalRelatorio());
        if (btnBaixarPC) btnBaixarPC.addEventListener('click', () => this.gerarRelatorioPC());
        if (btnSalvarOneDrive) btnSalvarOneDrive.addEventListener('click', () => this.showModalOneDriveRelatorio());
        if (btnVisualizarRelatorio) btnVisualizarRelatorio.addEventListener('click', () => this.visualizarRelatorio());
        
        // Modal OneDrive
        const closeOneDrive = document.getElementById('close-modal-onedrive-relatorio');
        const cancelOneDrive = document.getElementById('cancel-onedrive-relatorio');
        const confirmarOneDrive = document.getElementById('confirmar-onedrive-relatorio');
        
        if (closeOneDrive) closeOneDrive.addEventListener('click', () => this.hideModalOneDriveRelatorio());
        if (cancelOneDrive) cancelOneDrive.addEventListener('click', () => this.hideModalOneDriveRelatorio());
        if (confirmarOneDrive) confirmarOneDrive.addEventListener('click', () => this.salvarRelatorioOneDrive());
    }
    
    showModalRelatorio() {
        const modal = document.getElementById('modal-relatorio-obra');
        if (modal) modal.classList.add('show');
    }
    
    hideModalRelatorio() {
        const modal = document.getElementById('modal-relatorio-obra');
        if (modal) modal.classList.remove('show');
    }
    
    async visualizarRelatorio() {
        this.hideModalRelatorio();
        this.showNotification('Gerando visualização do relatório...', 'info');
        
        try {
            const obra = this.obraAtual;
            if (!obra) throw new Error('Obra não encontrada');
            
            // Buscar dados completos
            const valorProduzido = await this.calcularValorProduzido(obra.id);
            const valorMedido = await this.calcularValorMedido(obra.id);
            const valorRecebido = await this.calcularValorRecebido(obra.id);
            
            // Buscar produções diárias
            const { data: producoes } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', obra.id)
                .order('data_producao', { ascending: false })
                .limit(10);
            
            // Buscar medições
            const { data: medicoes } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .eq('obra_id', obra.id)
                .order('created_at', { ascending: false });
            
            // Usar serviços já carregados no modal de andamento
            const propostasIds = this.propostasSelecionadas.map(p => p.id);
            const servicosObra = this.servicosAndamento || [];
            
            // Buscar TODAS as produções para calcular quantidades produzidas por item
            const { data: todasProducoes } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', obra.id);
            
            // Buscar TODAS as medições com seus serviços para calcular quantidades medidas
            const { data: todasMedicoes } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    medicoes_servicos (*)
                `)
                .eq('obra_id', obra.id);
            
            // Calcular quantidades produzidas e medidas para cada serviço
            const quantidadesPorItem = {};
            
            // Somar produções por item
            (todasProducoes || []).forEach(producao => {
                const quantidades = producao.quantidades_servicos || {};
                Object.entries(quantidades).forEach(([itemId, qtd]) => {
                    if (!quantidadesPorItem[itemId]) {
                        quantidadesPorItem[itemId] = { produzida: 0, medida: 0 };
                    }
                    quantidadesPorItem[itemId].produzida += parseFloat(qtd) || 0;
                });
            });
            
            // Somar medições por item
            (todasMedicoes || []).forEach(medicao => {
                (medicao.medicoes_servicos || []).forEach(ms => {
                    const itemId = ms.item_proposta_id;
                    if (!quantidadesPorItem[itemId]) {
                        quantidadesPorItem[itemId] = { produzida: 0, medida: 0 };
                    }
                    quantidadesPorItem[itemId].medida += parseFloat(ms.quantidade_medida) || 0;
                });
            });
            
            // Armazenar para uso no HTML
            this.quantidadesPorItem = quantidadesPorItem;
            
            // Buscar andamentos existentes para esta obra
            const { data: andamentos } = await supabaseClient
                .from('servicos_andamento')
                .select('*')
                .eq('obra_id', obra.id);
            
            this.andamentosExistentes = andamentos || [];
            
            // Carregar equipes e integrantes se ainda não foram carregados
            if (!this.equipesIntegrantes || this.equipesIntegrantes.length === 0) {
                await this.loadEquipesIntegrantes();
            }
            
            // Buscar propostas com valor_total atualizado
            const { data: propostasAtualizadas } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .in('id', propostasIds);
            
            // Calcular valor_total de cada proposta a partir dos itens
            for (const proposta of (propostasAtualizadas || [])) {
                const { data: itens } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .select('preco_total')
                    .eq('proposta_id', proposta.id);
                
                proposta.valor_total_calculado = (itens || []).reduce((sum, item) => sum + (parseFloat(item.preco_total) || 0), 0);
            }
            
            // Buscar clientes das propostas
            const clientesUnicos = [...new Set((propostasAtualizadas || []).map(p => p.clientes_hvc?.nome).filter(Boolean))];
            
            // Gerar HTML do relatório
            const html = this.gerarHTMLRelatorio(obra, {
                valorProduzido,
                valorMedido,
                valorRecebido,
                producoes: producoes || [],
                medicoes: medicoes || [],
                clientes: clientesUnicos,
                propostas: propostasAtualizadas || [],
                servicos: servicosObra
            });
            
            // Abrir em nova janela para visualização
            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.close();
            
            this.showNotification('Relatório aberto para visualização!', 'success');
            
        } catch (error) {
            console.error('Erro ao visualizar relatório:', error);
            this.showNotification('Erro ao gerar visualização: ' + error.message, 'error');
        }
    }
    
    showModalOneDriveRelatorio() {
        this.hideModalRelatorio();
        
        // Definir nome do arquivo
        const obra = this.obraAtual;
        const nomeArquivo = obra ? `Relatorio_Obra_${obra.numero_obra.replace('/', '-')}` : 'Relatorio_Obra';
        const inputFilename = document.getElementById('relatorio-filename');
        if (inputFilename) inputFilename.value = nomeArquivo;
        
        // Carregar pastas do OneDrive
        this.loadOneDriveFoldersRelatorio();
        
        const modal = document.getElementById('modal-onedrive-relatorio');
        if (modal) modal.classList.add('show');
    }
    
    hideModalOneDriveRelatorio() {
        const modal = document.getElementById('modal-onedrive-relatorio');
        if (modal) modal.classList.remove('show');
    }
    
    async loadOneDriveFoldersRelatorio(folderId = null) {
        const container = document.getElementById('relatorio-onedrive-folders');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Carregando pastas...</div>';
        
        try {
            // Verificar se oneDriveAuth existe
            if (typeof window.oneDriveAuth === 'undefined') {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> Módulo OneDrive não carregado. Recarregue a página.</div>';
                return;
            }
            
            // Verificar se MSAL está inicializado
            if (typeof window.msalInstance === 'undefined' || !window.msalInstance) {
                console.log('⏳ MSAL não inicializado, aguardando...');
                
                // Aguardar até 10 segundos pela inicialização do MSAL
                const maxWait = 10000;
                const startTime = Date.now();
                
                while (!window.msalInstance && (Date.now() - startTime) < maxWait) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                if (!window.msalInstance) {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> OneDrive não inicializado. Acesse OneDrive Browser primeiro.</div>';
                    return;
                }
            }
            
            // Verificar se há conta conectada
            if (!window.oneDriveAuth.currentAccount) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> Conecte-se ao OneDrive na página OneDrive Browser.</div>';
                return;
            }
            
            // Obter token
            const accessToken = await window.oneDriveAuth.getAccessToken();
            
            // Buscar pastas
            const endpoint = folderId 
                ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$filter=folder ne null`
                : 'https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=folder ne null';
            
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (!response.ok) throw new Error('Erro ao buscar pastas');
            
            const data = await response.json();
            const folders = data.value || [];
            
            // Armazenar pasta atual
            this.currentOneDriveFolderRelatorio = folderId;
            
            // Atualizar exibição da pasta selecionada
            const pastaDisplay = document.getElementById('relatorio-pasta-selecionada');
            if (pastaDisplay) {
                pastaDisplay.textContent = folderId ? `Pasta selecionada` : '/ (Raiz)';
            }
            
            // Renderizar pastas
            let html = '';
            
            // Botão voltar
            if (folderId) {
                html += `
                    <div onclick="window.obrasManager.loadOneDriveFoldersRelatorio(null)" 
                         style="padding: 0.75rem; cursor: pointer; border-radius: 6px; margin-bottom: 0.5rem; background: rgba(173,216,230,0.1); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-arrow-left" style="color: #add8e6;"></i>
                        <span style="color: #add8e6;">Voltar para Raiz</span>
                    </div>
                `;
            }
            
            if (folders.length === 0) {
                html += '<div style="text-align: center; padding: 1rem; color: #888;">Nenhuma pasta encontrada</div>';
            } else {
                folders.forEach(folder => {
                    html += `
                        <div onclick="window.obrasManager.loadOneDriveFoldersRelatorio('${folder.id}')" 
                             style="padding: 0.75rem; cursor: pointer; border-radius: 6px; margin-bottom: 0.5rem; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;"
                             onmouseover="this.style.background='rgba(173,216,230,0.2)'"
                             onmouseout="this.style.background='rgba(0,0,0,0.2)'">
                            <i class="fas fa-folder" style="color: #ffc107;"></i>
                            <span style="color: #e0e0e0;">${folder.name}</span>
                        </div>
                    `;
                });
            }
            
            container.innerHTML = html;
            
        } catch (error) {
            container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> Erro: ${error.message}</div>`;
        }
    }
    
    async refreshOneDriveToken(refreshToken) {
        try {
            const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: '5ccf12a3-130c-4a1a-9a2c-8abc3282f5c3',
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                    scope: 'Files.ReadWrite.All offline_access'
                })
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            
            // Atualizar token no banco
            await supabaseClient
                .from('user_tokens')
                .update({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token || refreshToken,
                    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
                })
                .eq('provider', 'microsoft');
            
            return data.access_token;
        } catch (error) {
            return null;
        }
    }
    
    async gerarRelatorioPC() {
        this.hideModalRelatorio();
        this.showNotification('Gerando relatório...', 'info');
        
        try {
            const pdfBlob = await this.gerarRelatorioPDF();
            
            // Baixar arquivo
            const obra = this.obraAtual;
            const nomeArquivo = obra ? `Relatorio_Obra_${obra.numero_obra.replace('/', '-')}.pdf` : 'Relatorio_Obra.pdf';
            
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nomeArquivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Relatório baixado com sucesso!', 'success');
        } catch (error) {
            this.showNotification('Erro ao gerar relatório: ' + error.message, 'error');
        }
    }
    
    async salvarRelatorioOneDrive() {
        const inputFilename = document.getElementById('relatorio-filename');
        const filename = inputFilename?.value || 'Relatorio_Obra';
        
        try {
            // Verificar se oneDriveAuth existe
            if (typeof window.oneDriveAuth === 'undefined' || !window.oneDriveAuth.currentAccount) {
                throw new Error('OneDrive não conectado. Acesse OneDrive Browser primeiro.');
            }
            
            // Obter token via oneDriveAuth
            const accessToken = await window.oneDriveAuth.getAccessToken();
            const folderId = this.currentOneDriveFolderRelatorio;
            
            // Verificar se arquivo já existe
            const checkEndpoint = folderId
                ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${filename}.pdf`
                : `https://graph.microsoft.com/v1.0/me/drive/root:/${filename}.pdf`;
            
            const checkResponse = await fetch(checkEndpoint, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            // Se arquivo existe (status 200), perguntar ao usuário
            if (checkResponse.ok) {
                const existingFile = await checkResponse.json();
                const lastModified = existingFile.lastModifiedDateTime 
                    ? new Date(existingFile.lastModifiedDateTime).toLocaleString('pt-BR')
                    : 'data desconhecida';
                
                const confirmar = await this.confirmarSobrescrita(filename, lastModified);
                
                if (confirmar === 'cancelar') {
                    this.showNotification('Salvamento cancelado.', 'info');
                    return;
                } else if (confirmar === 'renomear') {
                    // Reabrir modal para renomear
                    this.showModalOneDriveRelatorio();
                    this.showNotification('Altere o nome do arquivo e tente novamente.', 'info');
                    return;
                }
                // Se confirmar === 'sobrescrever', continua o fluxo normal
            }
            
            this.hideModalOneDriveRelatorio();
            this.showNotification('Salvando no OneDrive...', 'info');
            
            const pdfBlob = await this.gerarRelatorioPDF();
            
            // Upload para OneDrive
            const endpoint = folderId
                ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${filename}.pdf:/content`
                : `https://graph.microsoft.com/v1.0/me/drive/root:/${filename}.pdf:/content`;
            
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/pdf'
                },
                body: pdfBlob
            });
            
            if (!response.ok) throw new Error('Erro ao salvar no OneDrive');
            
            this.showNotification('Relatório salvo no OneDrive com sucesso!', 'success');
        } catch (error) {
            this.showNotification('Erro ao salvar no OneDrive: ' + error.message, 'error');
        }
    }
    
    // Função para confirmar sobrescrita de arquivo
    confirmarSobrescrita(filename, lastModified) {
        return new Promise((resolve) => {
            // Criar modal de confirmação
            const modalHTML = `
                <div id="modal-confirmar-sobrescrita" class="modal-overlay show" style="z-index: 10000;">
                    <div class="modal-content" style="max-width: 450px;">
                        <div class="modal-header">
                            <h3 style="color: #ffc107;"><i class="fas fa-exclamation-triangle"></i> Arquivo Já Existe</h3>
                        </div>
                        <div class="modal-body" style="padding: 1.5rem;">
                            <p style="margin-bottom: 1rem;">O arquivo <strong>${filename}.pdf</strong> já existe nesta pasta.</p>
                            <p style="font-size: 0.9rem; color: #888;">\u00daltima modifica\u00e7\u00e3o: ${lastModified}</p>
                            <p style="margin-top: 1rem;">O que deseja fazer?</p>
                        </div>
                        <div class="modal-footer" style="display: flex; gap: 0.5rem; justify-content: flex-end; padding: 1rem;">
                            <button id="btn-cancelar-sobrescrita" class="btn btn-secondary" style="background: #6c757d;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                            <button id="btn-renomear-arquivo" class="btn btn-info" style="background: #17a2b8;">
                                <i class="fas fa-edit"></i> Renomear
                            </button>
                            <button id="btn-sobrescrever-arquivo" class="btn btn-warning" style="background: #ffc107; color: #000;">
                                <i class="fas fa-save"></i> Sobrescrever
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            const modal = document.getElementById('modal-confirmar-sobrescrita');
            const btnCancelar = document.getElementById('btn-cancelar-sobrescrita');
            const btnRenomear = document.getElementById('btn-renomear-arquivo');
            const btnSobrescrever = document.getElementById('btn-sobrescrever-arquivo');
            
            const fecharModal = (resultado) => {
                modal.remove();
                resolve(resultado);
            };
            
            btnCancelar.addEventListener('click', () => fecharModal('cancelar'));
            btnRenomear.addEventListener('click', () => fecharModal('renomear'));
            btnSobrescrever.addEventListener('click', () => fecharModal('sobrescrever'));
        });
    }
    
    async gerarRelatorioPDF() {
        const obra = this.obraAtual;
        if (!obra) throw new Error('Obra não encontrada');
        
        // Buscar dados completos
        const valorProduzido = await this.calcularValorProduzido(obra.id);
        const valorMedido = await this.calcularValorMedido(obra.id);
        const valorRecebido = await this.calcularValorRecebido(obra.id);
        
        // ✅ NOVO: Buscar despesas da obra
        const numeroObraLimpo = (obra.numero_obra || '').split('/')[0].trim();
        const { data: despesasObra } = await supabaseClient
            .from('fluxo_caixa_hvc')
            .select('*')
            .eq('tipo', 'pagamento')
            .ilike('categoria', `${numeroObraLimpo}%`)
            .order('data_vencimento', { ascending: false });
        
        // Separar despesas por status
        const despesasPagas = (despesasObra || []).filter(d => d.status === 'PG');
        const despesasPendentes = (despesasObra || []).filter(d => d.status !== 'PG');
        
        // Calcular totais
        let totalDespesasPagas = 0;
        let totalDespesasPendentes = 0;
        despesasPagas.forEach(d => totalDespesasPagas += parseFloat(d.valor) || 0);
        despesasPendentes.forEach(d => totalDespesasPendentes += parseFloat(d.valor) || 0);
        
        // Buscar medições para calcular retenções totais
        const { data: medicoesRetencao } = await supabaseClient
            .from('medicoes_hvc')
            .select('valor_total, valor_bruto, recebimentos')
            .eq('obra_id', obra.id);
        
        // Calcular retenções totais (soma de todas retenções de todas medições)
        // Retenção = valor_total - soma dos recebimentos
        let retensoesTotais = 0;
        (medicoesRetencao || []).forEach(med => {
            const valorMedicao = parseFloat(med.valor_bruto) || parseFloat(med.valor_total) || 0;
            let totalRecebidoMedicao = 0;
            if (med.recebimentos && Array.isArray(med.recebimentos)) {
                med.recebimentos.forEach(rec => {
                    totalRecebidoMedicao += parseFloat(rec.valor) || 0;
                });
            }
            // Retenção desta medição = valor da medição - total recebido
            const retencaoMedicao = valorMedicao - totalRecebidoMedicao;
            if (retencaoMedicao > 0) {
                retensoesTotais += retencaoMedicao;
            }
        });
        
        // Calcular valor total contratado
        const valorContratado = parseFloat(obra.valor_total) || 0;
        
        // PREVISÃO FUTURA: A RECEBER = TOTAL CONTRATADO - TOTAL JÁ RECEBIDO
        const valorAReceber = valorContratado - valorRecebido;
        
        // Resultados financeiros
        // SITUAÇÃO ATUAL: RECEBIDO - DESPESAS PAGAS - RETENSÕES TOTAIS
        const resultadoAtual = valorRecebido - totalDespesasPagas - retensoesTotais;
        // RESULTADO PREVISTO = A RECEBER - DESPESAS PENDENTES
        const resultadoPrevisto = valorAReceber - totalDespesasPendentes;
        const totalEntradas = valorRecebido + valorAReceber;
        const totalSaidas = totalDespesasPagas + totalDespesasPendentes + retensoesTotais;
        const balancoFinal = totalEntradas - totalSaidas;
        const margem = totalEntradas > 0 ? (balancoFinal / totalEntradas) * 100 : 0;
        
        // Para compatibilidade
        const resultadoFinanceiro = resultadoAtual;
        
        // Buscar produções diárias (query simples para evitar erro 400)
        const { data: producoes, error: producoesError } = await supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('obra_id', obra.id)
            .order('data_producao', { ascending: false })
            .limit(10);
        
        if (producoesError) {
            console.error('Erro ao buscar produções:', producoesError);
        }
        
        // Buscar medições
        const { data: medicoes } = await supabaseClient
            .from('medicoes_hvc')
            .select('*')
            .eq('obra_id', obra.id)
            .order('created_at', { ascending: false });
        
        // Usar serviços já carregados no modal de andamento (this.servicosAndamento tem todos os dados)
        const propostasIds = this.propostasSelecionadas.map(p => p.id);
        
        // Usar os serviços já carregados no modal de andamento ao invés de fazer nova query
        const servicosObra = this.servicosAndamento || [];
        
        // Buscar TODAS as produções para calcular quantidades produzidas por item
        const { data: todasProducoes } = await supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('obra_id', obra.id);
        
        // Buscar TODAS as medições com seus serviços para calcular quantidades medidas
        const { data: todasMedicoes } = await supabaseClient
            .from('medicoes_hvc')
            .select(`
                *,
                medicoes_servicos (*)
            `)
            .eq('obra_id', obra.id);
        
        // Calcular quantidades produzidas e medidas para cada serviço
        const quantidadesPorItem = {};
        
        // Somar produções por item
        (todasProducoes || []).forEach(producao => {
            const quantidades = producao.quantidades_servicos || {};
            Object.entries(quantidades).forEach(([itemId, qtd]) => {
                if (!quantidadesPorItem[itemId]) {
                    quantidadesPorItem[itemId] = { produzida: 0, medida: 0 };
                }
                quantidadesPorItem[itemId].produzida += parseFloat(qtd) || 0;
            });
        });
        
        // Somar medições por item
        (todasMedicoes || []).forEach(medicao => {
            (medicao.medicoes_servicos || []).forEach(ms => {
                const itemId = ms.item_proposta_id;
                if (!quantidadesPorItem[itemId]) {
                    quantidadesPorItem[itemId] = { produzida: 0, medida: 0 };
                }
                quantidadesPorItem[itemId].medida += parseFloat(ms.quantidade_medida) || 0;
            });
        });
        
        // Armazenar para uso no HTML
        this.quantidadesPorItem = quantidadesPorItem;
        
        // Buscar andamentos existentes para esta obra (para datas)
        const { data: andamentos } = await supabaseClient
            .from('servicos_andamento')
            .select('*')
            .eq('obra_id', obra.id);
        
        this.andamentosExistentes = andamentos || [];
        
        // Carregar equipes e integrantes se ainda não foram carregados
        if (!this.equipesIntegrantes || this.equipesIntegrantes.length === 0) {
            await this.loadEquipesIntegrantes();
        }
        
        // Buscar propostas com valor_total atualizado
        const { data: propostasAtualizadas } = await supabaseClient
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc (nome)
            `)
            .in('id', propostasIds);
        
        // Calcular valor_total de cada proposta a partir dos itens
        for (const proposta of (propostasAtualizadas || [])) {
            const { data: itens } = await supabaseClient
                .from('itens_proposta_hvc')
                .select('preco_total')
                .eq('proposta_id', proposta.id);
            
            proposta.valor_total_calculado = (itens || []).reduce((sum, item) => sum + (parseFloat(item.preco_total) || 0), 0);
        }
        
        // Buscar clientes das propostas
        const clientesUnicos = [...new Set((propostasAtualizadas || []).map(p => p.clientes_hvc?.nome).filter(Boolean))];
        
        // Gerar HTML do relatório
        const html = this.gerarHTMLRelatorio(obra, {
            valorProduzido,
            valorMedido,
            valorRecebido,
            valorAReceber,
            despesasPagas,
            despesasPendentes,
            totalDespesasPagas,
            totalDespesasPendentes,
            retensoesTotais,
            resultadoAtual,
            resultadoPrevisto,
            totalEntradas,
            totalSaidas,
            balancoFinal,
            margem,
            resultadoFinanceiro,
            producoes: producoes || [],
            medicoes: medicoes || [],
            clientes: clientesUnicos,
            propostas: propostasAtualizadas || [],
            servicos: servicosObra
        });
        
        // Gerar PDF usando html2pdf
        const element = document.createElement('div');
        element.innerHTML = html;
        element.style.width = '210mm';
        element.style.padding = '10mm';
        element.style.boxSizing = 'border-box';
        element.style.position = 'absolute';
        element.style.left = '0';
        element.style.top = '0';
        document.body.appendChild(element);
        
        const opt = {
            margin: 0,
            filename: 'relatorio.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                scrollX: 0,
                scrollY: 0,
                width: element.offsetWidth,
                height: element.offsetHeight
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        
        const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
        document.body.removeChild(element);
        
        return pdfBlob;
    }
    
    gerarHTMLRelatorio(obra, dados) {
        const dataAtual = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const percentual = obra.percentual_conclusao || 0;
        
        // Gerar HTML das produções diárias com serviços
        const producoesHTML = dados.producoes.length > 0 ? dados.producoes.map(p => {
            let dataFormatada = '-';
            // Usar data_producao ao invés de data
            const dataProducao = p.data_producao || p.data;
            if (dataProducao) {
                const [ano, mes, dia] = dataProducao.split('-');
                dataFormatada = `${dia}/${mes}/${ano}`;
            }
            
            // Serviços da produção - usar campo quantidades_servicos que armazena {item_id: quantidade}
            let servicosTexto = '-';
            const quantidadesObj = p.quantidades_servicos || {};
            const servicosExecutados = Object.entries(quantidadesObj)
                .filter(([itemId, quantidade]) => quantidade > 0)
                .map(([itemId, quantidade]) => {
                    // Buscar informações do item nos serviços da obra
                    const item = dados.servicos.find(s => s.id == itemId);
                    const servico = item?.servicos_hvc || {};
                    const local = item?.locais_hvc?.nome || '';
                    const codigo = servico.codigo || `ID:${itemId}`;
                    const unidade = servico.unidade || '';
                    const localTexto = local ? ` (${local})` : '';
                    return `${codigo}${localTexto}: ${quantidade}${unidade ? ' ' + unidade : ''}`;
                });
            
            if (servicosExecutados.length > 0) {
                servicosTexto = servicosExecutados.join(', ');
            }
            
            // Buscar nome da equipe/integrante
            let equipeTexto = '-';
            if (p.tipo_responsavel === 'equipe') {
                // Buscar equipe pelo ID
                const equipe = this.equipesIntegrantes?.find(e => e.tipo === 'equipe' && (e.id === p.responsavel_id || e.nome === String(p.responsavel_id).padStart(4, '0')));
                equipeTexto = equipe ? `Equipe ${equipe.nome}` : `Equipe ${p.responsavel_id || '-'}`;
            } else if (p.tipo_responsavel === 'integrante') {
                const integrante = this.equipesIntegrantes?.find(i => i.tipo === 'integrante' && i.id === p.responsavel_id);
                equipeTexto = integrante ? integrante.nome : '-';
            }
            
            return `
                <tr style="background: white;">
                    <td style="padding: 4px; border: 0.5px solid #ccc; vertical-align: top; font-size: 9px;">${dataFormatada}</td>
                    <td style="padding: 4px; border: 0.5px solid #ccc; vertical-align: top; font-size: 9px; word-wrap: break-word;">${equipeTexto}</td>
                    <td style="padding: 4px; border: 0.5px solid #ccc; vertical-align: top; font-size: 8px; word-wrap: break-word;">${servicosTexto}</td>
                    <td style="padding: 4px; border: 0.5px solid #ccc; vertical-align: top; font-size: 8px; word-wrap: break-word;">${p.observacoes || '-'}</td>
                </tr>
            `;
        }).join('') : '';
        
        // Gerar HTML da tabela de serviços
        const servicosHTML = dados.servicos.length > 0 ? dados.servicos.map(s => {
            const servico = s.servicos_hvc || {};
            const local = s.locais_hvc || {};
            const proposta = s.propostas_hvc || {};
            
            // Buscar andamento existente para este item (para datas)
            const andamento = this.andamentosExistentes?.find(a => a.item_proposta_id === s.id) || {};
            
            // Usar quantidades calculadas das produções e medições
            const qtdInfo = this.quantidadesPorItem?.[s.id] || { produzida: 0, medida: 0 };
            const qtdProduzida = qtdInfo.produzida;
            const qtdMedida = qtdInfo.medida;
            const qtdContratada = s.quantidade || 0;
            const percentualServico = qtdContratada > 0 ? Math.round((qtdProduzida / qtdContratada) * 100) : 0;
            
            let statusServico = 'PENDENTE';
            let statusColor = '#d4a017'; // amarelo escuro
            if (percentualServico === 0) {
                statusServico = 'PENDENTE';
                statusColor = '#d4a017';
            } else if (percentualServico < 100) {
                statusServico = `INICIADO (${percentualServico}%)`;
                statusColor = '#0d6efd';
            } else {
                statusServico = 'CONCLUÍDO';
                statusColor = '#198754';
            }
            
            // Formatar datas
            let dataInicio = '-';
            let dataFinal = '-';
            if (s.data_inicio) {
                const [ano, mes, dia] = s.data_inicio.split('-');
                dataInicio = `${dia}/${mes}/${ano}`;
            }
            if (s.data_final) {
                const [ano, mes, dia] = s.data_final.split('-');
                dataFinal = `${dia}/${mes}/${ano}`;
            }
            
            return `
                <tr style="background: white;">
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word;">${proposta.numero_proposta || '-'}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word;">
                        <strong>${servico.codigo || '-'}</strong><br>
                        <span style="font-size: 7px; color: #666;">${servico.descricao || ''}</span>
                    </td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word;">${local.nome || '-'}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; text-align: center; vertical-align: top; word-wrap: break-word;">${qtdMedida}/${qtdProduzida}/${qtdContratada} ${servico.unidade || ''}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; text-align: right; vertical-align: top;">${this.formatMoney(s.preco_total || 0)}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; text-align: center; font-size: 7px; color: ${statusColor}; font-weight: bold; vertical-align: top; word-wrap: break-word;">${statusServico}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; text-align: center; vertical-align: top;">${dataInicio}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 8px; text-align: center; vertical-align: top;">${dataFinal}</td>
                    <td style="padding: 3px; border: 0.5px solid #ccc; font-size: 7px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word;">${s.observacoes || '-'}</td>
                </tr>
            `;
        }).join('') : '';
        
        return `
            <div style="font-family: Arial, sans-serif; padding: 0; color: #333; width: 100%; background: white; box-sizing: border-box;">
                <!-- Cabeçalho Criativo com Dados da Obra -->
                <div style="background: linear-gradient(135deg, #000080 0%, #191970 100%); padding: 15px; margin-bottom: 15px; border-radius: 8px; color: white;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <h1 style="margin: 0; font-size: 18px; letter-spacing: 1px;">HVC IMPERMEABILIZAÇÕES LTDA.</h1>
                        <p style="margin: 3px 0; font-size: 9px; opacity: 0.8;">CNPJ: 22.335.667/0001-88 | Fone: (81) 3228-3025</p>
                    </div>
                    <div style="border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px; text-align: center;">
                        <p style="margin: 0; font-size: 11px; opacity: 0.9;">RELATÓRIO DE ANDAMENTO</p>
                        <h2 style="margin: 5px 0; font-size: 16px; font-weight: bold;">${obra.nome_obra || 'Obra ' + obra.numero_obra}</h2>
                        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 8px; font-size: 10px;">
                            <span style="background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 12px;">Nº ${obra.numero_obra}</span>
                            <span style="background: ${this.getStatusColor(obra.status)}; padding: 3px 10px; border-radius: 12px;">${obra.status}</span>
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 10px; opacity: 0.8;">Cliente: ${dados.clientes.join(', ') || 'Não informado'}</p>
                        <p style="margin: 3px 0 0 0; font-size: 9px; opacity: 0.7;">Gerado em: ${dataAtual}</p>
                    </div>
                </div>
                
                <!-- Linha de separação visual -->
                <div style="height: 3px; background: linear-gradient(90deg, #000080, #d4a017, #000080); margin-bottom: 15px; border-radius: 2px;"></div>
                

                
                <!-- Resumo Financeiro Completo -->
                <div style="margin-bottom: 15px;">
                    <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Resumo Financeiro</h3>
                    
                    <!-- Valores da Obra -->
                    <table style="width: 100%; border-collapse: collapse; background: white; margin-bottom: 10px;">
                        <tr style="background: #000080;">
                            <th colspan="2" style="padding: 6px; text-align: center; color: white; font-size: 10px;">VALORES DA OBRA</th>
                        </tr>
                        <tr style="background: #f9f9f9;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Valor Total Contratado</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; font-weight: bold; font-size: 10px;">${this.formatMoney(obra.valor_total || 0)}</td>
                        </tr>
                        <tr style="background: white;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Valor Produzido</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #17a2b8; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.valorProduzido)}</td>
                        </tr>
                        <tr style="background: #f9f9f9;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Valor Medido</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #d4a017; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.valorMedido)}</td>
                        </tr>
                    </table>
                    
                    <!-- Situação Atual (Realizado) -->
                    <table style="width: 100%; border-collapse: collapse; background: white; margin-bottom: 10px;">
                        <tr style="background: #28a745;">
                            <th colspan="2" style="padding: 6px; text-align: center; color: white; font-size: 10px;">SITUAÇÃO ATUAL (Realizado)</th>
                        </tr>
                        <tr style="background: #d4edda;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Valor Recebido</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #28a745; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.valorRecebido)}</td>
                        </tr>
                        <tr style="background: #f8d7da;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Despesas Pagas</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #dc3545; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.totalDespesasPagas || 0)}</td>
                        </tr>
                        <tr style="background: #f3e5f5;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Retenções Totais</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #9b59b6; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.retensoesTotais || 0)}</td>
                        </tr>
                        <tr style="background: ${dados.resultadoAtual >= 0 ? '#d4edda' : '#f8d7da'};">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px; font-weight: bold;">= RESULTADO ATUAL</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: ${dados.resultadoAtual >= 0 ? '#28a745' : '#dc3545'}; font-weight: bold; font-size: 11px;">${this.formatMoney(dados.resultadoAtual || 0)}</td>
                        </tr>
                    </table>
                    
                    <!-- Previsão Futura (Pendente) -->
                    <table style="width: 100%; border-collapse: collapse; background: white; margin-bottom: 10px;">
                        <tr style="background: #ffc107;">
                            <th colspan="2" style="padding: 6px; text-align: center; color: #333; font-size: 10px;">PREVISÃO FUTURA (Pendente)</th>
                        </tr>
                        <tr style="background: #fff3cd;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Valor a Receber</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #856404; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.valorAReceber || 0)}</td>
                        </tr>
                        <tr style="background: #ffe5b4;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Despesas Pendentes</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #e67e22; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.totalDespesasPendentes || 0)}</td>
                        </tr>
                        <tr style="background: ${dados.resultadoPrevisto >= 0 ? '#d4edda' : '#f8d7da'};">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px; font-weight: bold;">= RESULTADO PREVISTO</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: ${dados.resultadoPrevisto >= 0 ? '#9b59b6' : '#dc3545'}; font-weight: bold; font-size: 11px;">${this.formatMoney(dados.resultadoPrevisto || 0)}</td>
                        </tr>
                    </table>
                    
                    <!-- Resumo Consolidado -->
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <tr style="background: #000080;">
                            <th colspan="2" style="padding: 6px; text-align: center; color: white; font-size: 10px;">RESUMO CONSOLIDADO</th>
                        </tr>
                        <tr style="background: #e8f5e9;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Total de Entradas (Recebido + A Receber)</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #28a745; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.totalEntradas || 0)}</td>
                        </tr>
                        <tr style="background: #ffebee;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">Total de Saídas (Pagas + Pendentes + Retenções)</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: #dc3545; font-weight: bold; font-size: 10px;">${this.formatMoney(dados.totalSaidas || 0)}</td>
                        </tr>
                        <tr style="background: ${dados.balancoFinal >= 0 ? '#c8e6c9' : '#ffcdd2'};">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px; font-weight: bold;">= BALANÇO FINAL</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: ${dados.balancoFinal >= 0 ? '#28a745' : '#dc3545'}; font-weight: bold; font-size: 12px;">${this.formatMoney(dados.balancoFinal || 0)}</td>
                        </tr>
                        <tr style="background: #f5f5f5;">
                            <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px; font-weight: bold;">MARGEM</td>
                            <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; color: ${dados.margem >= 0 ? '#28a745' : '#dc3545'}; font-weight: bold; font-size: 11px;">${(dados.margem || 0).toFixed(1)}%</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Progresso -->
                <div style="margin-bottom: 15px;">
                    <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Progresso da Obra</h3>
                    <div style="background: #e8e8e8; border-radius: 8px; height: 20px; margin-top: 8px; overflow: hidden; border: 0.5px solid #ccc;">
                        <div style="background: linear-gradient(90deg, #000080, #191970); height: 100%; width: ${percentual}%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">
                            ${percentual > 10 ? percentual + '%' : ''}
                        </div>
                    </div>
                    <p style="text-align: center; margin-top: 5px; font-size: 12px; font-weight: bold; color: #000080;">${percentual}% Concluído</p>
                </div>
                
                <!-- Tabela de Serviços -->
                ${dados.servicos.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Andamento dos Serviços (${dados.servicos.length})</h3>
                        <p style="font-size: 10px; color: #666; margin: 5px 0;">Quantidade: Medida / Produzida / Contratada</p>
                        <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
                            <tr style="background: #000080;">
                                <th style="padding: 4px; text-align: left; color: white; font-size: 8px; width: 8%;">PROP.</th>
                                <th style="padding: 4px; text-align: left; color: white; font-size: 8px; width: 18%;">SERVIÇO</th>
                                <th style="padding: 4px; text-align: left; color: white; font-size: 8px; width: 10%;">LOCAL</th>
                                <th style="padding: 4px; text-align: center; color: white; font-size: 8px; width: 14%;">QUANTIDADE</th>
                                <th style="padding: 4px; text-align: right; color: white; font-size: 8px; width: 10%;">VALOR</th>
                                <th style="padding: 4px; text-align: center; color: white; font-size: 8px; width: 14%;">STATUS</th>
                                <th style="padding: 4px; text-align: center; color: white; font-size: 8px; width: 8%;">INÍCIO</th>
                                <th style="padding: 4px; text-align: center; color: white; font-size: 8px; width: 8%;">FINAL</th>
                                <th style="padding: 4px; text-align: left; color: white; font-size: 8px; width: 10%;">OBS</th>
                            </tr>
                            ${servicosHTML}
                        </table>
                    </div>
                ` : ''}

                
                <!-- Produções Diárias -->
                ${dados.producoes.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Produções Diárias (${dados.producoes.length})</h3>
                        <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
                            <tr style="background: #000080;">
                                <th style="padding: 4px; text-align: left; color: white; font-size: 9px; width: 12%;">DATA</th>
                                <th style="padding: 4px; text-align: left; color: white; font-size: 9px; width: 18%;">EQUIPE</th>
                                <th style="padding: 4px; text-align: left; color: white; font-size: 9px; width: 40%;">SERVIÇOS</th>
                                <th style="padding: 4px; text-align: left; color: white; font-size: 9px; width: 30%;">OBSERVAÇÕES</th>
                            </tr>
                            ${producoesHTML}
                        </table>
                    </div>
                ` : ''}
                
                <!-- Propostas Vinculadas -->
                <div style="margin-bottom: 15px; page-break-inside: avoid;">
                    <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Propostas Vinculadas (${dados.propostas.length})</h3>
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <tr style="background: #000080;">
                            <th style="padding: 5px; text-align: left; color: white; font-size: 10px;">NÚMERO</th>
                            <th style="padding: 5px; text-align: left; color: white; font-size: 10px;">CLIENTE</th>
                            <th style="padding: 5px; text-align: right; color: white; font-size: 10px;">VALOR</th>
                        </tr>
                        ${dados.propostas.map((p, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#f9f9f9' : 'white'};">
                                <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">${p.numero_proposta}</td>
                                <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">${p.clientes_hvc?.nome || '-'}</td>
                                <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; font-size: 10px;">${this.formatMoney(p.valor_total_calculado || p.valor_total || 0)}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                
                <!-- Medições -->
                ${dados.medicoes.length > 0 ? `
                    <div style="margin-bottom: 15px; page-break-inside: avoid;">
                        <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Medições (${dados.medicoes.length})</h3>
                        <table style="width: 100%; border-collapse: collapse; background: white;">
                            <tr style="background: #000080;">
                                <th style="padding: 5px; text-align: left; color: white; font-size: 10px;">NÚMERO</th>
                                <th style="padding: 5px; text-align: right; color: white; font-size: 10px;">VALOR</th>
                                <th style="padding: 5px; text-align: center; color: white; font-size: 10px;">STATUS</th>
                                <th style="padding: 5px; text-align: left; color: white; font-size: 10px;">RECEBIMENTOS</th>
                            </tr>
                            ${dados.medicoes.map((m, i) => {
                                const recebimentos = m.recebimentos || [];
                                const totalRecebido = recebimentos.reduce((sum, rec) => sum + (rec.valor || 0), 0);
                                const valorTotal = m.valor_bruto || m.valor_total || 0;
                                let status = 'PENDENTE';
                                let statusColor = '#ffc107';
                                if (totalRecebido === 0) {
                                    status = 'PENDENTE';
                                    statusColor = '#ffc107';
                                } else if (totalRecebido < valorTotal) {
                                    status = 'RC c/ RET';
                                    statusColor = '#17a2b8';
                                } else {
                                    status = 'RECEBIDO';
                                    statusColor = '#28a745';
                                }
                                
                                // Formatar recebimentos
                                let recebimentosHTML = '-';
                                if (recebimentos.length > 0) {
                                    recebimentosHTML = recebimentos.map(rec => {
                                        let dataFormatada = '-';
                                        if (rec.data) {
                                            const dataStr = String(rec.data);
                                            if (dataStr.match(/^\\d{4}-\\d{2}-\\d{2}$/)) {
                                                const [ano, mes, dia] = dataStr.split('-');
                                                dataFormatada = `${dia}/${mes}/${ano}`;
                                            } else {
                                                dataFormatada = dataStr;
                                            }
                                        }
                                        return `${this.formatMoney(rec.valor || 0)} (${dataFormatada})`;
                                    }).join('<br>');
                                }
                                
                                return `
                                    <tr style="background: ${i % 2 === 0 ? '#f9f9f9' : 'white'};">
                                        <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 10px;">${m.numero_medicao}</td>
                                        <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; font-size: 10px;">${this.formatMoney(m.valor_total || 0)}</td>
                                        <td style="padding: 5px; text-align: center; border: 0.5px solid #ccc;">
                                            <span style="background: ${statusColor}; color: white; padding: 2px 6px; border-radius: 8px; font-size: 9px;">${status}</span>
                                        </td>
                                        <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; vertical-align: top;">${recebimentosHTML}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </table>
                    </div>
                ` : ''}
                
                <!-- Despesas Pagas -->
                ${dados.despesasPagas && dados.despesasPagas.length > 0 ? `
                    <div style="margin-bottom: 15px; page-break-inside: avoid;">
                        <h3 style="color: #28a745; border-bottom: 1px solid #28a745; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Despesas Pagas (${dados.despesasPagas.length})</h3>
                        <table style="width: 100%; border-collapse: collapse; background: white;">
                            <tr style="background: #28a745;">
                                <th style="padding: 5px; text-align: left; color: white; font-size: 10px;">NOME</th>
                                <th style="padding: 5px; text-align: left; color: white; font-size: 10px;">DETALHE</th>
                                <th style="padding: 5px; text-align: center; color: white; font-size: 10px;">DATA</th>
                                <th style="padding: 5px; text-align: right; color: white; font-size: 10px;">VALOR</th>
                            </tr>
                            ${dados.despesasPagas.map((d, i) => {
                                let dataFormatada = '-';
                                if (d.data_vencimento) {
                                    const [ano, mes, dia] = d.data_vencimento.split('-');
                                    dataFormatada = `${dia}/${mes}/${ano}`;
                                }
                                return `
                                    <tr style="background: ${i % 2 === 0 ? '#f9f9f9' : 'white'};">
                                        <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px;">${d.nome || '-'}</td>
                                        <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 8px; color: #666;">${d.detalhe || '-'}</td>
                                        <td style="padding: 5px; text-align: center; border: 0.5px solid #ccc; font-size: 9px;">${dataFormatada}</td>
                                        <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; font-size: 9px; color: #dc3545; font-weight: bold;">${this.formatMoney(parseFloat(d.valor) || 0)}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background: #d4edda;">
                                <td colspan="3" style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; font-weight: bold; text-align: right;">TOTAL DESPESAS PAGAS:</td>
                                <td style="padding: 6px; text-align: right; border: 0.5px solid #ccc; font-size: 11px; color: #28a745; font-weight: bold;">${this.formatMoney(dados.totalDespesasPagas || 0)}</td>
                            </tr>
                        </table>
                    </div>
                ` : ''}
                
                <!-- Despesas Pendentes -->
                ${dados.despesasPendentes && dados.despesasPendentes.length > 0 ? `
                    <div style="margin-bottom: 15px; page-break-inside: avoid;">
                        <h3 style="color: #ffc107; border-bottom: 1px solid #ffc107; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Despesas Pendentes (${dados.despesasPendentes.length})</h3>
                        <table style="width: 100%; border-collapse: collapse; background: white;">
                            <tr style="background: #ffc107;">
                                <th style="padding: 5px; text-align: left; color: #333; font-size: 10px;">NOME</th>
                                <th style="padding: 5px; text-align: left; color: #333; font-size: 10px;">DETALHE</th>
                                <th style="padding: 5px; text-align: center; color: #333; font-size: 10px;">DATA VENC.</th>
                                <th style="padding: 5px; text-align: right; color: #333; font-size: 10px;">VALOR</th>
                            </tr>
                            ${dados.despesasPendentes.map((d, i) => {
                                let dataFormatada = '-';
                                if (d.data_vencimento) {
                                    const [ano, mes, dia] = d.data_vencimento.split('-');
                                    dataFormatada = `${dia}/${mes}/${ano}`;
                                }
                                return `
                                    <tr style="background: ${i % 2 === 0 ? '#fff3cd' : '#fffbe6'};">
                                        <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px;">${d.nome || '-'}</td>
                                        <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 8px; color: #666;">${d.detalhe || '-'}</td>
                                        <td style="padding: 5px; text-align: center; border: 0.5px solid #ccc; font-size: 9px;">${dataFormatada}</td>
                                        <td style="padding: 5px; text-align: right; border: 0.5px solid #ccc; font-size: 9px; color: #e67e22; font-weight: bold;">${this.formatMoney(parseFloat(d.valor) || 0)}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background: #fff3cd;">
                                <td colspan="3" style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; font-weight: bold; text-align: right;">TOTAL DESPESAS PENDENTES:</td>
                                <td style="padding: 6px; text-align: right; border: 0.5px solid #ccc; font-size: 11px; color: #e67e22; font-weight: bold;">${this.formatMoney(dados.totalDespesasPendentes || 0)}</td>
                            </tr>
                        </table>
                    </div>
                ` : ''}
                
                <!-- Observações -->
                ${obra.observacoes ? `
                    <div style="margin-bottom: 15px; page-break-inside: avoid;">
                        <h3 style="color: #000080; border-bottom: 1px solid #000080; padding-bottom: 3px; font-size: 12px; margin-bottom: 8px;">Observações</h3>
                        <p style="background: #fafafa; padding: 10px; border-radius: 6px; margin-top: 5px; line-height: 1.4; font-size: 10px; border: 0.5px solid #ddd;">${obra.observacoes}</p>
                    </div>
                ` : ''}
                
                <!-- Rodapé -->
                <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #000080; text-align: center; color: #666; font-size: 9px; background: white;">
                    <p style="margin: 2px 0;">Rua Profª Anunciada da Rocha Melo, 214 – Sl 104 – Madalena – CEP: 50710-390 – Recife/PE</p>
                    <p style="margin: 2px 0;">Fone: (81) 3228-3025 | E-mail: hvcimpermeabilizacoes@gmail.com</p>
                </div>
            </div>
        `;
    }
    
    getStatusColor(status) {
        const colors = {
            'Andamento': '#d4a017',
            'Em Andamento': '#17a2b8',
            'Concluída': '#28a745',
            'Pausada': '#6c757d',
            'Cancelada': '#dc3545'
        };
        return colors[status] || '#6c757d';
    }
    
    // ========== FUNÇÕES DE PDF DA MEDIÇÃO ==========
    
    showModalPdfMedicao() {
        const modal = document.getElementById('modal-pdf-medicao');
        if (modal) modal.classList.add('show');
    }
    
    hideModalPdfMedicao() {
        const modal = document.getElementById('modal-pdf-medicao');
        if (modal) modal.classList.remove('show');
    }
    
    async visualizarPdfMedicao() {
        // Fechar modal de opções
        this.hideModalPdfMedicao();
        
        try {
            const medicao = this.medicaoAtual;
            if (!medicao) throw new Error('Medição não encontrada');
            
            // Buscar dados completos da medição com serviços
            const { data: medicaoCompleta, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    medicoes_servicos (
                        *,
                        itens_proposta_hvc (
                            *,
                            servicos_hvc (*),
                            locais_hvc (*),
                            propostas_hvc (
                                numero_proposta,
                                clientes_hvc (nome)
                            )
                        )
                    )
                `)
                .eq('id', medicao.id)
                .single();
            
            if (medicaoError) throw medicaoError;
            
            // Buscar dados da obra
            const { data: obra } = await supabaseClient
                .from('obras_hvc')
                .select('*, obras_propostas (proposta_id)')
                .eq('id', medicaoCompleta.obra_id)
                .single();
            
            // Buscar cliente da obra
            let nomeCliente = 'Não informado';
            let clienteEndereco = '';
            let clienteCnpj = '';
            if (obra?.obras_propostas?.length > 0) {
                const { data: proposta } = await supabaseClient
                    .from('propostas_hvc')
                    .select('clientes_hvc (*)')
                    .eq('id', obra.obras_propostas[0].proposta_id)
                    .single();
                if (proposta?.clientes_hvc) {
                    nomeCliente = proposta.clientes_hvc.nome || 'Não informado';
                    clienteEndereco = proposta.clientes_hvc.endereco || '';
                    clienteCnpj = proposta.clientes_hvc.cnpj || proposta.clientes_hvc.cpf || '';
                }
            }
            
            // Buscar TODAS as medições anteriores desta obra
            const { data: todasMedicoes } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    id,
                    numero_medicao,
                    created_at,
                    medicoes_servicos (
                        item_proposta_id,
                        quantidade_medida,
                        valor_total
                    )
                `)
                .eq('obra_id', medicaoCompleta.obra_id)
                .lt('created_at', medicaoCompleta.created_at);
            
            // Calcular quantidades já medidas por item
            const jaMedidoPorItem = {};
            (todasMedicoes || []).forEach(med => {
                (med.medicoes_servicos || []).forEach(ms => {
                    if (!jaMedidoPorItem[ms.item_proposta_id]) {
                        jaMedidoPorItem[ms.item_proposta_id] = { quantidade: 0, valor: 0 };
                    }
                    jaMedidoPorItem[ms.item_proposta_id].quantidade += parseFloat(ms.quantidade_medida) || 0;
                    jaMedidoPorItem[ms.item_proposta_id].valor += parseFloat(ms.valor_total) || 0;
                });
            });
            
            // Buscar todos os itens contratados das propostas da obra
            const propostaIds = (obra?.obras_propostas || []).map(op => op.proposta_id);
            const { data: itensContratados } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (*),
                    locais_hvc (*),
                    propostas_hvc (numero_proposta)
                `)
                .in('proposta_id', propostaIds);
            
            // Buscar TODAS as produções diárias desta obra
            const { data: todasProducoes } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', medicaoCompleta.obra_id)
                .order('data_producao', { ascending: false });
            
            // Calcular quantidades produzidas por item_proposta_id
            const produzidoPorItem = {};
            (todasProducoes || []).forEach(prod => {
                const quantidades = prod.quantidades_servicos || {};
                Object.entries(quantidades).forEach(([itemId, quantidade]) => {
                    const qtd = parseFloat(quantidade) || 0;
                    if (qtd > 0) {
                        if (!produzidoPorItem[itemId]) {
                            produzidoPorItem[itemId] = { quantidade: 0, producoes: [] };
                        }
                        produzidoPorItem[itemId].quantidade += qtd;
                        produzidoPorItem[itemId].producoes.push({
                            data: prod.data_producao,
                            quantidade: qtd,
                            equipe: prod.responsavel_id || 'N/A',
                            observacoes: prod.observacoes
                        });
                    }
                });
            });
            
            // Buscar medições anteriores detalhadas
            const { data: medicoesAnterioresDetalhadas } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    id,
                    numero_medicao,
                    created_at,
                    valor_total,
                    medicoes_servicos (
                        quantidade_medida,
                        valor_total,
                        itens_proposta_hvc (
                            servicos_hvc (codigo),
                            locais_hvc (nome)
                        )
                    )
                `)
                .eq('obra_id', medicaoCompleta.obra_id)
                .lt('created_at', medicaoCompleta.created_at)
                .order('created_at', { ascending: true });
            
            // Gerar HTML do relatório
            const htmlContent = this.gerarHTMLMedicao(medicaoCompleta, obra, nomeCliente, clienteEndereco, clienteCnpj, jaMedidoPorItem, itensContratados, produzidoPorItem, medicoesAnterioresDetalhadas || []);
            
            // Abrir em nova janela para visualização
            const printWindow = window.open('', '_blank');
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            
        } catch (error) {
            console.error('Erro ao visualizar PDF:', error);
            alert('Erro ao gerar visualização do PDF. Tente novamente.');
        }
    }
    
    showModalOneDriveMedicao() {
        this.hideModalPdfMedicao();
        
        // Definir nome do arquivo
        const medicao = this.medicaoAtual;
        const nomeArquivo = medicao ? `Medicao_${medicao.numero_medicao.replace('/', '-')}` : 'Medicao';
        const inputFilename = document.getElementById('medicao-pdf-filename');
        if (inputFilename) inputFilename.value = nomeArquivo;
        
        // Carregar pastas do OneDrive
        this.loadOneDriveFoldersMedicao();
        
        const modal = document.getElementById('modal-onedrive-medicao');
        if (modal) modal.classList.add('show');
    }
    
    hideModalOneDriveMedicao() {
        const modal = document.getElementById('modal-onedrive-medicao');
        if (modal) modal.classList.remove('show');
    }
    
    async loadOneDriveFoldersMedicao(folderId = null) {
        const container = document.getElementById('medicao-onedrive-folders');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Carregando pastas...</div>';
        
        try {
            if (typeof window.oneDriveAuth === 'undefined' || !window.oneDriveAuth.currentAccount) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> Conecte-se ao OneDrive na página OneDrive Browser.</div>';
                return;
            }
            
            const accessToken = await window.oneDriveAuth.getAccessToken();
            
            const endpoint = folderId 
                ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$filter=folder ne null`
                : 'https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=folder ne null';
            
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            const data = await response.json();
            const folders = data.value || [];
            
            this.currentOneDriveFolderMedicao = folderId;
            
            const pastaDisplay = document.getElementById('medicao-pasta-selecionada');
            if (pastaDisplay) {
                pastaDisplay.textContent = folderId ? `Pasta selecionada` : '/ (Raiz)';
            }
            
            let html = '';
            
            if (folderId) {
                html += `
                    <div onclick="window.obrasManager.loadOneDriveFoldersMedicao(null)" 
                         style="padding: 0.75rem; cursor: pointer; border-radius: 6px; margin-bottom: 0.5rem; background: rgba(173,216,230,0.1); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-arrow-left" style="color: #add8e6;"></i>
                        <span style="color: #add8e6;">Voltar para Raiz</span>
                    </div>
                `;
            }
            
            if (folders.length === 0) {
                html += '<div style="text-align: center; padding: 1rem; color: #888;">Nenhuma pasta encontrada</div>';
            } else {
                folders.forEach(folder => {
                    html += `
                        <div onclick="window.obrasManager.loadOneDriveFoldersMedicao('${folder.id}')" 
                             style="padding: 0.75rem; cursor: pointer; border-radius: 6px; margin-bottom: 0.5rem; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;"
                             onmouseover="this.style.background='rgba(173,216,230,0.2)'"
                             onmouseout="this.style.background='rgba(0,0,0,0.2)'">
                            <i class="fas fa-folder" style="color: #ffc107;"></i>
                            <span style="color: #e0e0e0;">${folder.name}</span>
                        </div>
                    `;
                });
            }
            
            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> Erro: ${error.message}</div>`;
        }
    }
    
    async gerarPdfMedicaoPC() {
        this.hideModalPdfMedicao();
        this.showNotification('Gerando PDF...', 'info');
        
        try {
            const pdfBlob = await this.gerarPdfMedicao();
            
            const medicao = this.medicaoAtual;
            const filename = medicao ? `Medicao_${medicao.numero_medicao.replace('/', '-')}.pdf` : 'Medicao.pdf';
            
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('PDF gerado com sucesso!', 'success');
        } catch (error) {
            this.showNotification('Erro ao gerar PDF: ' + error.message, 'error');
        }
    }
    
    async salvarPdfMedicaoOneDrive() {
        const inputFilename = document.getElementById('medicao-pdf-filename');
        const filename = inputFilename?.value || 'Medicao';
        
        try {
            if (typeof window.oneDriveAuth === 'undefined' || !window.oneDriveAuth.currentAccount) {
                throw new Error('OneDrive não conectado. Acesse OneDrive Browser primeiro.');
            }
            
            const accessToken = await window.oneDriveAuth.getAccessToken();
            const folderId = this.currentOneDriveFolderMedicao;
            
            // Verificar se arquivo já existe
            const checkEndpoint = folderId
                ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${filename}.pdf`
                : `https://graph.microsoft.com/v1.0/me/drive/root:/${filename}.pdf`;
            
            const checkResponse = await fetch(checkEndpoint, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (checkResponse.ok) {
                const existingFile = await checkResponse.json();
                const lastModified = existingFile.lastModifiedDateTime 
                    ? new Date(existingFile.lastModifiedDateTime).toLocaleString('pt-BR')
                    : 'data desconhecida';
                
                const confirmar = await this.confirmarSobrescrita(filename, lastModified);
                
                if (confirmar === 'cancelar') {
                    this.showNotification('Salvamento cancelado.', 'info');
                    return;
                } else if (confirmar === 'renomear') {
                    this.showModalOneDriveMedicao();
                    this.showNotification('Altere o nome do arquivo e tente novamente.', 'info');
                    return;
                }
            }
            
            this.hideModalOneDriveMedicao();
            this.showNotification('Salvando no OneDrive...', 'info');
            
            const pdfBlob = await this.gerarPdfMedicao();
            
            const endpoint = folderId
                ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${filename}.pdf:/content`
                : `https://graph.microsoft.com/v1.0/me/drive/root:/${filename}.pdf:/content`;
            
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/pdf'
                },
                body: pdfBlob
            });
            
            if (!response.ok) throw new Error('Erro ao salvar no OneDrive');
            
            this.showNotification('PDF salvo no OneDrive com sucesso!', 'success');
        } catch (error) {
            this.showNotification('Erro ao salvar no OneDrive: ' + error.message, 'error');
        }
    }
    
    async gerarPdfMedicao() {
        const medicao = this.medicaoAtual;
        if (!medicao) throw new Error('Medição não encontrada');
        
        // Buscar dados completos da medição com serviços
        const { data: medicaoCompleta, error: medicaoError } = await supabaseClient
            .from('medicoes_hvc')
            .select(`
                *,
                medicoes_servicos (
                    *,
                    itens_proposta_hvc (
                        *,
                        servicos_hvc (*),
                        locais_hvc (*),
                        propostas_hvc (
                            numero_proposta,
                            clientes_hvc (nome)
                        )
                    )
                )
            `)
            .eq('id', medicao.id)
            .single();
        
        if (medicaoError) throw medicaoError;
        
        // Buscar dados da obra
        const { data: obra } = await supabaseClient
            .from('obras_hvc')
            .select('*, obras_propostas (proposta_id)')
            .eq('id', medicaoCompleta.obra_id)
            .single();
        
        // Buscar cliente da obra
        let nomeCliente = 'Não informado';
        let clienteEndereco = '';
        let clienteCnpj = '';
        if (obra?.obras_propostas?.length > 0) {
            const { data: proposta } = await supabaseClient
                .from('propostas_hvc')
                .select('clientes_hvc (*)')
                .eq('id', obra.obras_propostas[0].proposta_id)
                .single();
            if (proposta?.clientes_hvc) {
                nomeCliente = proposta.clientes_hvc.nome || 'Não informado';
                clienteEndereco = proposta.clientes_hvc.endereco || '';
                clienteCnpj = proposta.clientes_hvc.cnpj || proposta.clientes_hvc.cpf || '';
            }
        }
        
        // Buscar TODAS as medições anteriores desta obra para calcular o que já foi medido
        const { data: todasMedicoes } = await supabaseClient
            .from('medicoes_hvc')
            .select(`
                id,
                numero_medicao,
                created_at,
                medicoes_servicos (
                    item_proposta_id,
                    quantidade_medida,
                    valor_total
                )
            `)
            .eq('obra_id', medicaoCompleta.obra_id)
            .lt('created_at', medicaoCompleta.created_at); // Apenas medições anteriores
        
        // Calcular quantidades já medidas por item (medições anteriores)
        const jaMedidoPorItem = {};
        (todasMedicoes || []).forEach(med => {
            (med.medicoes_servicos || []).forEach(ms => {
                if (!jaMedidoPorItem[ms.item_proposta_id]) {
                    jaMedidoPorItem[ms.item_proposta_id] = { quantidade: 0, valor: 0 };
                }
                jaMedidoPorItem[ms.item_proposta_id].quantidade += parseFloat(ms.quantidade_medida) || 0;
                jaMedidoPorItem[ms.item_proposta_id].valor += parseFloat(ms.valor_total) || 0;
            });
        });
        
        // Buscar todos os itens contratados das propostas da obra
        const propostaIds = (obra?.obras_propostas || []).map(op => op.proposta_id);
        const { data: itensContratados } = await supabaseClient
            .from('itens_proposta_hvc')
            .select(`
                *,
                servicos_hvc (*),
                locais_hvc (*),
                propostas_hvc (numero_proposta)
            `)
            .in('proposta_id', propostaIds);
        
        // Buscar TODAS as produções diárias desta obra
        const { data: todasProducoes } = await supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('obra_id', medicaoCompleta.obra_id)
            .order('data_producao', { ascending: false });
        
        // Calcular quantidades produzidas por item_proposta_id
        // A estrutura é: quantidades_servicos = { item_proposta_id: quantidade }
        const produzidoPorItem = {};
        const producoesDetalhadas = []; // Para a seção de comprovação
        
        (todasProducoes || []).forEach(prod => {
            const quantidades = prod.quantidades_servicos || {};
            // Iterar sobre cada item_proposta_id nas quantidades
            Object.entries(quantidades).forEach(([itemId, quantidade]) => {
                const qtd = parseFloat(quantidade) || 0;
                if (qtd > 0) {
                    if (!produzidoPorItem[itemId]) {
                        produzidoPorItem[itemId] = { quantidade: 0, producoes: [] };
                    }
                    produzidoPorItem[itemId].quantidade += qtd;
                    produzidoPorItem[itemId].producoes.push({
                        data: prod.data_producao,
                        quantidade: qtd,
                        equipe: prod.responsavel_id || 'N/A',
                        observacoes: prod.observacoes
                    });
                }
            });
        });
        
        // Debug: mostrar produzidoPorItem
        console.log('produzidoPorItem:', JSON.stringify(produzidoPorItem, null, 2));
        console.log('itensContratados IDs:', (itensContratados || []).map(i => i.id));
        
        // Buscar medições anteriores com detalhes completos para exibir no PDF
        const { data: medicoesAnterioresDetalhadas } = await supabaseClient
            .from('medicoes_hvc')
            .select(`
                id,
                numero_medicao,
                created_at,
                valor_total,
                medicoes_servicos (
                    quantidade_medida,
                    valor_total,
                    itens_proposta_hvc (
                        servicos_hvc (codigo),
                        locais_hvc (nome)
                    )
                )
            `)
            .eq('obra_id', medicaoCompleta.obra_id)
            .lt('created_at', medicaoCompleta.created_at)
            .order('created_at', { ascending: true });
        
        // Gerar HTML do relatório
        const html = this.gerarHTMLMedicao(medicaoCompleta, obra, nomeCliente, clienteEndereco, clienteCnpj, jaMedidoPorItem, itensContratados, produzidoPorItem, medicoesAnterioresDetalhadas || []);
        
        // Gerar PDF usando html2pdf
        const element = document.createElement('div');
        element.innerHTML = html;
        
        element.style.position = 'absolute';
        element.style.left = '0';
        element.style.top = '0';
        element.style.width = '210mm';
        element.style.padding = '10mm';
        element.style.boxSizing = 'border-box';
        element.style.background = 'white';
        
        document.body.appendChild(element);
        
        const opt = {
            margin: 0,
            filename: `Medicao_${medicao.numero_medicao.replace('/', '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                width: element.scrollWidth,
                height: element.scrollHeight
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
        
        document.body.removeChild(element);
        
        return pdfBlob;
    }
    
    gerarHTMLMedicao(medicao, obra, nomeCliente, clienteEndereco, clienteCnpj, jaMedidoPorItem, itensContratados, produzidoPorItem = {}, medicoesAnteriores = []) {
        const dataAtual = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        const dataCriacao = new Date(medicao.created_at).toLocaleDateString('pt-BR');
        
        // Serviços desta medição
        const servicosMedicao = medicao.medicoes_servicos || [];
        
        // Criar mapa de serviços desta medição por item_proposta_id
        const estaMedicaoPorItem = {};
        servicosMedicao.forEach(s => {
            estaMedicaoPorItem[s.item_proposta_id] = {
                quantidade: parseFloat(s.quantidade_medida) || 0,
                valor: parseFloat(s.valor_total) || 0,
                preco_unitario: parseFloat(s.preco_unitario) || 0
            };
        });
        
        // Calcular totais gerais
        let totalContratado = 0;
        let totalProduzido = 0;
        let totalJaMedido = 0;
        let totalEstaMedicao = 0;
        let totalRestante = 0;
        
        // Coletar produções para seção de comprovação
        let producoesParaComprovacao = [];
        
        // Gerar HTML da tabela de serviços
        let servicosHTML = '';
        let itemIndex = 0;
        
        (itensContratados || []).forEach(item => {
            const servico = item.servicos_hvc || {};
            const local = item.locais_hvc || {};
            const proposta = item.propostas_hvc || {};
            
            const qtdContratada = parseFloat(item.quantidade) || 0;
            // preco_unitario não existe na tabela - calcular a partir de preco_mao_obra + preco_material
            const precoMaoObra = parseFloat(item.preco_mao_obra) || 0;
            const precoMaterial = parseFloat(item.preco_material) || 0;
            const precoUnit = precoMaoObra + precoMaterial;
            const valorContratado = parseFloat(item.preco_total) || (qtdContratada * precoUnit);
            
            // Converter para string pois as chaves do JSON são strings
            const itemIdStr = String(item.id);
            const produzido = produzidoPorItem[itemIdStr] || { quantidade: 0, producoes: [] };
            const valorProduzido = produzido.quantidade * precoUnit;
            
            // Debug
            console.log('Item ID:', itemIdStr, 'Produzido:', produzido.quantidade, 'PrecoUnit:', precoUnit, 'ValorProduzido:', valorProduzido);
            const jaMedido = jaMedidoPorItem[item.id] || { quantidade: 0, valor: 0 };
            const estaMedicao = estaMedicaoPorItem[item.id] || { quantidade: 0, valor: 0 };
            
            const qtdTotalMedida = jaMedido.quantidade + estaMedicao.quantidade;
            const qtdRestante = Math.max(0, qtdContratada - qtdTotalMedida);
            const valorRestante = qtdRestante * precoUnit;
            
            totalContratado += valorContratado;
            totalProduzido += valorProduzido;
            totalJaMedido += jaMedido.valor;
            totalEstaMedicao += estaMedicao.valor;
            totalRestante += valorRestante;
            
            // Coletar produções deste item para comprovação
            if (produzido.producoes.length > 0 && estaMedicao.quantidade > 0) {
                produzido.producoes.forEach(p => {
                    producoesParaComprovacao.push({
                        servico: servico.codigo,
                        local: local.nome,
                        ...p
                    });
                });
            }
            
            // Destacar se este item está sendo medido agora
            const destaque = estaMedicao.quantidade > 0;
            const bgColor = destaque ? '#fffde7' : (itemIndex % 2 === 0 ? '#f9f9f9' : 'white');
            
            // Verificar consistência: produzido vs medido
            const consistente = produzido.quantidade >= qtdTotalMedida;
            
            // Verificar condições para check verde
            const checkProduzido = produzido.quantidade >= qtdContratada;
            const checkJaMedido = (jaMedido.quantidade + estaMedicao.quantidade) >= qtdContratada;
            const checkRestante = qtdRestante <= 0;
            
            servicosHTML += `
                <tr style="background: ${bgColor};">
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; vertical-align: top; word-wrap: break-word;">
                        <strong>${servico.codigo || '-'}</strong><br>
                        <span style="font-size: 8px; color: #666; word-wrap: break-word; white-space: normal;">${servico.descricao || ''}</span>
                    </td>
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; vertical-align: top;">${local.nome || '-'}</td>
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; text-align: center; vertical-align: top;">
                        ${qtdContratada.toFixed(2)}<br>
                        <span style="font-size: 8px; color: #666;">${this.formatMoney(valorContratado)}</span>
                    </td>
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; text-align: center; vertical-align: top; color: ${consistente ? '#17a2b8' : '#dc3545'}; position: relative;">
                        ${checkProduzido ? '<span style="position: absolute; top: 2px; right: 3px; color: #28a745; font-size: 10px; font-weight: bold;">✓</span>' : ''}
                        ${produzido.quantidade.toFixed(2)}<br>
                        <span style="font-size: 8px;">${this.formatMoney(valorProduzido)}</span>
                    </td>
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; text-align: center; vertical-align: top; color: #6c757d; position: relative;">
                        ${checkJaMedido ? '<span style="position: absolute; top: 2px; right: 3px; color: #28a745; font-size: 10px; font-weight: bold;">✓</span>' : ''}
                        ${jaMedido.quantidade.toFixed(2)}<br>
                        <span style="font-size: 8px;">${this.formatMoney(jaMedido.valor)}</span>
                    </td>
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; text-align: center; vertical-align: top; ${destaque ? 'font-weight: bold; color: #000080;' : ''}">
                        ${estaMedicao.quantidade.toFixed(2)}<br>
                        <span style="font-size: 8px; ${destaque ? 'color: #28a745;' : ''}">${this.formatMoney(estaMedicao.valor)}</span>
                    </td>
                    <td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; text-align: center; vertical-align: top; color: ${qtdRestante > 0 ? '#b8860b' : '#28a745'}; position: relative;">
                        ${checkRestante ? '<span style="position: absolute; top: 2px; right: 3px; color: #28a745; font-size: 10px; font-weight: bold;">✓</span>' : ''}
                        ${qtdRestante.toFixed(2)}<br>
                        <span style="font-size: 8px;">${this.formatMoney(valorRestante)}</span>
                    </td>
                </tr>
            `;
            itemIndex++;
        });
        
        // Percentual de execução
        const percentualExecutado = totalContratado > 0 
            ? (((totalJaMedido + totalEstaMedicao) / totalContratado) * 100).toFixed(1) 
            : 0;
        
        const percentualProduzido = totalContratado > 0 
            ? ((totalProduzido / totalContratado) * 100).toFixed(1) 
            : 0;
        
        return `
            <div style="font-family: Arial, sans-serif; padding: 0; color: #333; width: 100%; background: white; box-sizing: border-box;">
                <!-- Cabeçalho -->
                <div style="background: linear-gradient(135deg, #000080 0%, #191970 100%); padding: 12px; margin-bottom: 10px; border-radius: 6px; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h1 style="margin: 0; font-size: 18px; letter-spacing: 1px;">HVC IMPERMEABILIZAÇÕES LTDA.</h1>
                            <p style="margin: 2px 0; font-size: 10px; opacity: 0.8;">CNPJ: 22.335.667/0001-88 | Fone: (81) 3228-3025</p>
                            <p style="margin: 2px 0; font-size: 10px; opacity: 0.8;">hvcimpermeabilizacoes@gmail.com</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 11px; opacity: 0.9;">MEDIÇÃO Nº</p>
                            <h2 style="margin: 0; font-size: 24px; font-weight: bold;">${medicao.numero_medicao}</h2>
                            <p style="margin: 2px 0; font-size: 10px; opacity: 0.7;">Data: ${dataCriacao}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Dados do Cliente e Obra -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; border-left: 3px solid #000080;">
                        <p style="margin: 0; font-size: 9px; color: #666; text-transform: uppercase;">Cliente</p>
                        <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #333;">${nomeCliente}</p>
                        ${clienteCnpj ? `<p style="margin: 0; font-size: 10px; color: #666;">CNPJ/CPF: ${clienteCnpj}</p>` : ''}
                        ${clienteEndereco ? `<p style="margin: 0; font-size: 10px; color: #666;">${clienteEndereco}</p>` : ''}
                    </div>
                    <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; border-left: 3px solid #d4a017;">
                        <p style="margin: 0; font-size: 9px; color: #666; text-transform: uppercase;">Obra</p>
                        <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #333;">${obra?.numero_obra || '-'}</p>
                        <p style="margin: 0; font-size: 10px; color: #666;">${obra?.nome_obra || ''}</p>
                    </div>
                </div>
                
                <!-- Linha decorativa -->
                <div style="height: 2px; background: linear-gradient(90deg, #000080, #d4a017, #000080); margin-bottom: 10px; border-radius: 1px;"></div>
                
                <!-- Tabela de Serviços Completa -->
                <div style="margin-bottom: 10px;">
                    <h3 style="color: #000080; font-size: 14px; margin: 0 0 5px 0;">Detalhamento dos Serviços</h3>
                    <p style="margin: 0 0 5px 0; font-size: 9px; color: #666;">Fluxo: Contratado → Produzido (execução em campo) → Medido (cobrança) → Restante</p>
                    <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
                        <tr style="background: #000080;">
                            <th style="padding: 6px; text-align: left; color: white; font-size: 9px; width: 18%;">SERVIÇO</th>
                            <th style="padding: 6px; text-align: left; color: white; font-size: 9px; width: 10%;">LOCAL</th>
                            <th style="padding: 6px; text-align: center; color: white; font-size: 9px; width: 13%;">CONTRATADO</th>
                            <th style="padding: 6px; text-align: center; color: white; font-size: 9px; width: 13%; background: #17a2b8;">PRODUZIDO</th>
                            <th style="padding: 6px; text-align: center; color: white; font-size: 9px; width: 13%;">JÁ MEDIDO</th>
                            <th style="padding: 6px; text-align: center; color: white; font-size: 9px; width: 15%; background: #28a745;">ESTA MEDIÇÃO</th>
                            <th style="padding: 6px; text-align: center; color: white; font-size: 9px; width: 13%; background: #b8860b;">RESTANTE</th>
                        </tr>
                        ${servicosHTML}
                        <tr style="background: #e8e8e8; font-weight: bold;">
                            <td colspan="2" style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; text-align: right;">TOTAIS:</td>
                            <td style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; text-align: center;">${this.formatMoney(totalContratado)}</td>
                            <td style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; color: #17a2b8;">${this.formatMoney(totalProduzido)}</td>
                            <td style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; color: #6c757d;">${this.formatMoney(totalJaMedido)}</td>
                            <td style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; color: #28a745; background: #e8f5e9;">${this.formatMoney(totalEstaMedicao)}</td>
                            <td style="padding: 6px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; color: #b8860b;">${this.formatMoney(totalRestante)}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Resumo e Valor a Pagar -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <!-- Progresso da Obra -->
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 6px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #000080;">Progresso do Contrato</h4>
                        <div style="background: #e0e0e0; border-radius: 10px; height: 22px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #28a745, #20c997); height: 100%; width: ${percentualExecutado}%; display: flex; align-items: center; justify-content: center;">
                                <span style="color: white; font-size: 10px; font-weight: bold;">${percentualExecutado}%</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 10px; color: #666;">
                            <span>Executado: ${this.formatMoney(totalJaMedido + totalEstaMedicao)}</span>
                            <span>Contrato: ${this.formatMoney(totalContratado)}</span>
                        </div>
                    </div>
                    
                    <!-- Valor a Pagar (destaque) -->
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); padding: 10px; border-radius: 6px; color: white; text-align: center;">
                        <p style="margin: 0; font-size: 11px; opacity: 0.9;">VALOR DESTA MEDIÇÃO</p>
                        <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">${this.formatMoney(totalEstaMedicao)}</p>
                        <p style="margin: 0; font-size: 10px; opacity: 0.8;">Saldo restante após esta medição: ${this.formatMoney(totalRestante)}</p>
                    </div>
                </div>
                
                <!-- Resumo Geral -->
                <div style="margin-bottom: 10px;">
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <tr style="background: #000080;">
                            <th colspan="5" style="padding: 8px; text-align: center; color: white; font-size: 12px;">RESUMO FINANCEIRO DO CONTRATO</th>
                        </tr>
                        <tr style="background: #f0f0f0;">
                            <td style="padding: 8px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; width: 20%;">
                                <span style="display: block; color: #666; font-size: 9px;">Valor Contratado</span>
                                <strong style="font-size: 12px;">${this.formatMoney(totalContratado)}</strong>
                            </td>
                            <td style="padding: 8px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; width: 20%; background: #e8f4fc;">
                                <span style="display: block; color: #17a2b8; font-size: 9px;">Total Produzido</span>
                                <strong style="font-size: 12px; color: #17a2b8;">${this.formatMoney(totalProduzido)}</strong>
                            </td>
                            <td style="padding: 8px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; width: 20%;">
                                <span style="display: block; color: #666; font-size: 9px;">Já Medido</span>
                                <strong style="font-size: 12px; color: #6c757d;">${this.formatMoney(totalJaMedido)}</strong>
                            </td>
                            <td style="padding: 8px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; width: 20%; background: #e8f5e9;">
                                <span style="display: block; color: #28a745; font-size: 9px;">Esta Medição</span>
                                <strong style="font-size: 12px; color: #28a745;">${this.formatMoney(totalEstaMedicao)}</strong>
                            </td>
                            <td style="padding: 8px; border: 0.5px solid #ccc; font-size: 10px; text-align: center; width: 20%; background: #fff8e1;">
                                <span style="display: block; color: #b8860b; font-size: 9px;">Saldo Restante</span>
                                <strong style="font-size: 12px; color: #b8860b;">${this.formatMoney(totalRestante)}</strong>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Comprovação de Execução -->
                ${producoesParaComprovacao.length > 0 ? `
                    <div style="margin-bottom: 10px;">
                        <h4 style="color: #17a2b8; font-size: 12px; margin: 0 0 5px 0;"><i>✓</i> Comprovação de Execução (Produções Registradas)</h4>
                        <p style="margin: 0 0 5px 0; font-size: 9px; color: #666;">Registro das produções diárias que comprovam a execução dos serviços medidos</p>
                        <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
                            <tr style="background: #17a2b8;">
                                <th style="padding: 6px; text-align: left; color: white; font-size: 9px; width: 15%;">DATA</th>
                                <th style="padding: 6px; text-align: left; color: white; font-size: 9px; width: 25%;">SERVIÇO</th>
                                <th style="padding: 6px; text-align: left; color: white; font-size: 9px; width: 20%;">LOCAL</th>
                                <th style="padding: 6px; text-align: center; color: white; font-size: 9px; width: 15%;">QUANTIDADE</th>
                                <th style="padding: 6px; text-align: left; color: white; font-size: 9px; width: 25%;">OBSERVAÇÕES</th>
                            </tr>
                            ${producoesParaComprovacao.slice(0, 10).map((p, idx) => {
                                let dataFormatada = '-';
                                if (p.data) {
                                    const dataStr = String(p.data);
                                    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                        const [ano, mes, dia] = dataStr.split('-');
                                        dataFormatada = dia + '/' + mes + '/' + ano;
                                    } else {
                                        dataFormatada = dataStr;
                                    }
                                }
                                const bgColor = idx % 2 === 0 ? '#e8f4fc' : 'white';
                                const obs = (p.observacoes || '').substring(0, 30) + ((p.observacoes || '').length > 30 ? '...' : '');
                                return '<tr style="background: ' + bgColor + ';">' +
                                    '<td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px;">' + dataFormatada + '</td>' +
                                    '<td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px;">' + (p.servico || '-') + '</td>' +
                                    '<td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px;">' + (p.local || '-') + '</td>' +
                                    '<td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; text-align: center;">' + (p.quantidade || 0).toFixed(2) + '</td>' +
                                    '<td style="padding: 5px; border: 0.5px solid #ccc; font-size: 9px; color: #666;">' + obs + '</td>' +
                                    '</tr>';
                            }).join('')}
                            ${producoesParaComprovacao.length > 10 ? '<tr style="background: #f0f0f0;"><td colspan="5" style="padding: 6px; border: 0.5px solid #ccc; font-size: 9px; text-align: center; color: #666;">... e mais ' + (producoesParaComprovacao.length - 10) + ' registros de produção</td></tr>' : ''}
                        </table>
                    </div>
                ` : ''}
                
                <!-- Medições Anteriores -->
                ${medicoesAnteriores.length > 0 ? `
                    <div style="margin-bottom: 10px;">
                        <h4 style="color: #6c757d; font-size: 12px; margin: 0 0 5px 0;"><i>⏳</i> Histórico de Medições Anteriores</h4>
                        <p style="margin: 0 0 5px 0; font-size: 9px; color: #666;">Medições já realizadas nesta obra</p>
                        ${medicoesAnteriores.map((med, medIdx) => {
                            let dataMedicao = '-';
                            if (med.created_at) {
                                const d = new Date(med.created_at);
                                dataMedicao = d.toLocaleDateString('pt-BR');
                            }
                            const servicosMed = med.medicoes_servicos || [];
                            const valorTotalMed = servicosMed.reduce((acc, s) => acc + (parseFloat(s.valor_total) || 0), 0);
                            const bgHeader = medIdx % 2 === 0 ? '#f8f9fa' : '#e9ecef';
                            
                            return '<div style="margin-bottom: 8px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">' +
                                '<div style="background: ' + bgHeader + '; padding: 8px; display: flex; justify-content: space-between; align-items: center;">' +
                                    '<div>' +
                                        '<strong style="font-size: 10px; color: #333;">Medição ' + (med.numero_medicao || '-') + '</strong>' +
                                        '<span style="font-size: 9px; color: #666; margin-left: 10px;">' + dataMedicao + '</span>' +
                                    '</div>' +
                                    '<strong style="font-size: 10px; color: #28a745;">' + this.formatMoney(valorTotalMed) + '</strong>' +
                                '</div>' +
                                '<table style="width: 100%; border-collapse: collapse; font-size: 8px;">' +
                                    '<tr style="background: #e0e0e0;">' +
                                        '<th style="padding: 4px; text-align: left; width: 25%;">CÓDIGO</th>' +
                                        '<th style="padding: 4px; text-align: left; width: 35%;">LOCAL</th>' +
                                        '<th style="padding: 4px; text-align: center; width: 20%;">QUANTIDADE</th>' +
                                        '<th style="padding: 4px; text-align: right; width: 20%;">VALOR</th>' +
                                    '</tr>' +
                                    servicosMed.map((s, sIdx) => {
                                        const codigo = s.itens_proposta_hvc?.servicos_hvc?.codigo || '-';
                                        const local = s.itens_proposta_hvc?.locais_hvc?.nome || '-';
                                        const bgRow = sIdx % 2 === 0 ? 'white' : '#f8f8f8';
                                        return '<tr style="background: ' + bgRow + ';">' +
                                            '<td style="padding: 4px; border-top: 0.5px solid #eee;">' + codigo + '</td>' +
                                            '<td style="padding: 4px; border-top: 0.5px solid #eee;">' + local + '</td>' +
                                            '<td style="padding: 4px; border-top: 0.5px solid #eee; text-align: center;">' + (parseFloat(s.quantidade_medida) || 0).toFixed(2) + '</td>' +
                                            '<td style="padding: 4px; border-top: 0.5px solid #eee; text-align: right;">' + this.formatMoney(parseFloat(s.valor_total) || 0) + '</td>' +
                                        '</tr>';
                                    }).join('') +
                                '</table>' +
                            '</div>';
                        }).join('')}
                    </div>
                ` : ''}
                
                <!-- Observações -->
                ${medicao.observacoes || medicao.anotacoes ? `
                    <div style="margin-bottom: 10px;">
                        <h4 style="color: #000080; font-size: 12px; margin: 0 0 5px 0;">Observações</h4>
                        <p style="background: #fafafa; padding: 8px; border-radius: 4px; line-height: 1.4; font-size: 10px; border: 0.5px solid #ddd; margin: 0;">${medicao.observacoes || medicao.anotacoes}</p>
                    </div>
                ` : ''}
                
                <!-- Rodapé -->
                <div style="margin-top: 15px; padding-top: 8px; border-top: 2px solid #000080; text-align: center;">
                    <p style="margin: 0; font-size: 9px; color: #666;">Rua Profª Anunciada da Rocha Melo, 214 – Sl 104 – Madalena – CEP: 50710-390 – Recife/PE</p>
                    <p style="margin: 2px 0 0 0; font-size: 9px; color: #666;">Fone: (81) 3228-3025 | E-mail: hvcimpermeabilizacoes@gmail.com</p>
                    <p style="margin: 5px 0 0 0; font-size: 8px; color: #999;">Documento gerado em ${dataAtual}</p>
                </div>
            </div>
        `;
    }
    
    // ========== EDIÇÃO DE MEDIÇÃO ==========
    
    async editarMedicao(medicaoId) {
        try {
            this.showNotification('Carregando dados da medição...', 'info');
            
            // Buscar dados completos da medição
            const { data: medicao, error } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    medicoes_servicos (
                        *,
                        itens_proposta_hvc (
                            *,
                            servicos_hvc (*),
                            locais_hvc (*)
                        )
                    )
                `)
                .eq('id', medicaoId)
                .single();
            
            if (error) throw error;
            
            this.medicaoEmEdicao = medicao;
            this.servicosMedicaoEdicao = [];
            
            // Converter serviços da medição para o formato de edição
            (medicao.medicoes_servicos || []).forEach(ms => {
                const item = ms.itens_proposta_hvc;
                if (item) {
                    const chaveUnica = `${item.servico_id}_${item.local_id}`;
                    this.servicosMedicaoEdicao.push({
                        id: ms.id,
                        chave_unica: chaveUnica,
                        item_proposta_id: ms.item_proposta_id,
                        servico_id: item.servico_id,
                        codigo_servico: item.servicos_hvc?.codigo || '-',
                        nome_servico: item.servicos_hvc?.descricao || '-',
                        local: item.locais_hvc?.nome || '-',
                        unidade: item.servicos_hvc?.unidade || 'un',
                        quantidade_medida: parseFloat(ms.quantidade_medida) || 0,
                        preco_unitario: (parseFloat(item.preco_mao_obra) || 0) + (parseFloat(item.preco_material) || 0),
                        valor_total: parseFloat(ms.valor_total) || 0
                    });
                }
            });
            
            // Carregar serviços disponíveis para adição (igual ao modal de criar)
            await this.loadServicosParaEdicaoMedicao(medicaoId);
            
            // Mostrar modal de edição
            this.showModalEditarMedicao(medicao);
            
        } catch (error) {
            this.showNotification('Erro ao carregar medição: ' + error.message, 'error');
        }
    }
    
    async loadServicosParaEdicaoMedicao(medicaoIdAtual) {
        try {
            if (!this.currentObraId) return;
            
            // 1. Buscar todos os itens das propostas da obra
            const servicosPromises = this.propostasSelecionadas.map(async (proposta) => {
                const { data, error } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .select(`
                        id,
                        proposta_id,
                        servico_id,
                        local_id,
                        quantidade,
                        preco_mao_obra,
                        preco_material,
                        preco_total,
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
            const { data: producoes } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', this.currentObraId);
            
            // 3. Buscar todas as medições EXCETO a atual (para calcular já medido)
            const { data: medicoes } = await supabaseClient
                .from('medicoes_hvc')
                .select(`id, medicoes_servicos (*)`)
                .eq('obra_id', this.currentObraId)
                .neq('id', medicaoIdAtual)
                .neq('status', 'cancelada');
            
            // 4. Agrupar serviços por código e local
            const servicosAgrupados = {};
            
            todosItens.forEach(item => {
                const codigo = item.servicos_hvc?.codigo || 'SEM-CODIGO';
                const localNome = item.locais_hvc?.nome || 'Sem local';
                const chaveUnica = `${item.servico_id}_${item.local_id}`;
                
                if (!servicosAgrupados[chaveUnica]) {
                    servicosAgrupados[chaveUnica] = {
                        chaveUnica,
                        servicoId: item.servico_id,
                        localId: item.local_id,
                        codigo,
                        nome: item.servicos_hvc?.descricao || 'Sem descrição',
                        local: localNome,
                        unidade: item.servicos_hvc?.unidade || 'un',
                        precoUnitario: (parseFloat(item.preco_mao_obra) || 0) + (parseFloat(item.preco_material) || 0),
                        quantidadeContratada: 0,
                        quantidadeProduzida: 0,
                        quantidadeJaMedida: 0,
                        itens: []
                    };
                }
                
                servicosAgrupados[chaveUnica].quantidadeContratada += parseFloat(item.quantidade) || 0;
                servicosAgrupados[chaveUnica].itens.push(item);
            });
            
            // 5. Calcular quantidades produzidas
            (producoes || []).forEach(prod => {
                const quantidades = prod.quantidades_servicos || {};
                Object.entries(quantidades).forEach(([itemId, qtd]) => {
                    const item = todosItens.find(i => i.id === itemId);
                    if (item) {
                        const chaveUnica = `${item.servico_id}_${item.local_id}`;
                        if (servicosAgrupados[chaveUnica]) {
                            servicosAgrupados[chaveUnica].quantidadeProduzida += parseFloat(qtd) || 0;
                        }
                    }
                });
            });
            
            // 6. Calcular quantidades já medidas (excluindo medição atual)
            (medicoes || []).forEach(med => {
                (med.medicoes_servicos || []).forEach(ms => {
                    const item = todosItens.find(i => i.id === ms.item_proposta_id);
                    if (item) {
                        const chaveUnica = `${item.servico_id}_${item.local_id}`;
                        if (servicosAgrupados[chaveUnica]) {
                            servicosAgrupados[chaveUnica].quantidadeJaMedida += parseFloat(ms.quantidade_medida) || 0;
                        }
                    }
                });
            });
            
            // 7. Calcular quantidade disponível
            this.servicosParaEdicao = Object.values(servicosAgrupados).map(s => ({
                ...s,
                quantidadeDisponivel: Math.max(0, s.quantidadeProduzida - s.quantidadeJaMedida)
            }));
            
        } catch (error) {
            console.error('Erro ao carregar serviços para edição:', error);
            this.servicosParaEdicao = [];
        }
    }
    
    showModalEditarMedicao(medicao) {
        // Remover modal existente se houver
        const existingModal = document.getElementById('modal-editar-medicao');
        if (existingModal) existingModal.remove();
        
        const modalHTML = `
            <div id="modal-editar-medicao" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; width: 100%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(173, 216, 230, 0.2);">
                    <div style="padding: 1.5rem; border-bottom: 2px solid rgba(173, 216, 230, 0.2); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="color: #add8e6; margin: 0;">
                            <i class="fas fa-edit"></i> Editar Medição ${medicao.numero_medicao}
                        </h3>
                        <button onclick="window.obrasManager.fecharModalEditarMedicao()" style="background: none; border: none; color: #ff6b6b; font-size: 1.5rem; cursor: pointer;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div style="padding: 1.5rem;">
                        <!-- Informações da Medição -->
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">Número da Medição</label>
                                <input type="text" id="edit-numero-medicao" value="${medicao.numero_medicao}" 
                                    style="width: 100%; padding: 0.75rem; background: rgba(173, 216, 230, 0.1); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; color: #add8e6;" readonly />
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">Data da Medição *</label>
                                <input type="date" id="edit-data-medicao" value="${medicao.created_at ? medicao.created_at.split('T')[0] : ''}" 
                                    style="width: 100%; padding: 0.75rem; background: rgba(173, 216, 230, 0.1); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; color: #add8e6;" />
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; color: #add8e6; font-weight: 600;">Previsão de Pagamento</label>
                                <input type="date" id="edit-previsao-pagamento" value="${medicao.previsao_pagamento || ''}" 
                                    style="width: 100%; padding: 0.75rem; background: rgba(173, 216, 230, 0.1); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; color: #add8e6;" />
                            </div>
                        </div>
                        
                        <!-- Serviços Disponíveis para Adicionar -->
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="color: #add8e6; margin: 0 0 0.5rem 0;"><i class="fas fa-plus-circle"></i> Selecionar Serviços para Medir</h4>
                            <p style="color: #888; font-size: 0.85rem; margin: 0 0 1rem 0;">* Clique em "Adicionar" para incluir um serviço na medição</p>
                            <div id="lista-servicos-disponiveis-edicao" style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; max-height: 250px; overflow-y: auto;">
                                ${this.renderServicosDisponiveisEdicao()}
                            </div>
                        </div>
                        
                        <!-- Serviços Já Adicionados na Medição -->
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="color: #20c997; margin: 0 0 1rem 0;"><i class="fas fa-check-circle"></i> Resumo dos Serviços Medidos</h4>
                            <div id="lista-servicos-edicao" style="background: rgba(32, 201, 151, 0.1); border-radius: 8px; padding: 1rem; max-height: 200px; overflow-y: auto;">
                                ${this.renderServicosEdicao()}
                            </div>
                        </div>
                        
                        <!-- Resumo -->
                        <div style="background: rgba(32, 201, 151, 0.15); padding: 1rem; border-radius: 8px; border-left: 4px solid #20c997; margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #c0c0c0;">Valor Total da Medição:</span>
                                <strong id="edit-valor-total-medicao" style="color: #20c997; font-size: 1.5rem;">${this.formatMoney(this.calcularTotalEdicao())}</strong>
                            </div>
                        </div>
                        
                        <!-- Botões -->
                        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                            <button onclick="window.obrasManager.fecharModalEditarMedicao()" 
                                style="padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.1); color: #c0c0c0; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                            <button onclick="window.obrasManager.salvarEdicaoMedicao()" 
                                style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                <i class="fas fa-save"></i> Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    renderServicosDisponiveisEdicao() {
        if (!this.servicosParaEdicao || this.servicosParaEdicao.length === 0) {
            return '<p style="color: #888; text-align: center;">Nenhum serviço disponível</p>';
        }
        
        return this.servicosParaEdicao.map(servico => {
            // Verificar se já está adicionado na medição
            const jaAdicionado = this.servicosMedicaoEdicao.some(s => s.chave_unica === servico.chaveUnica);
            const quantidadeNaMedicao = jaAdicionado ? 
                this.servicosMedicaoEdicao.find(s => s.chave_unica === servico.chaveUnica)?.quantidade_medida || 0 : 0;
            
            // Quantidade disponível = produzido - já medido (em outras medições) + quantidade desta medição
            const disponivelReal = servico.quantidadeDisponivel + quantidadeNaMedicao;
            
            return `
                <div style="background: ${jaAdicionado ? 'rgba(32, 201, 151, 0.15)' : 'rgba(173, 216, 230, 0.05)'}; padding: 0.75rem; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid ${jaAdicionado ? 'rgba(32, 201, 151, 0.3)' : 'rgba(173, 216, 230, 0.1)'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="color: #add8e6; font-weight: 600; font-size: 0.95rem;">
                                ${servico.codigo} - ${servico.nome}
                                <span style="color: #20c997; font-size: 0.85rem; margin-left: 0.5rem;">R$ ${servico.precoUnitario.toFixed(2)}/${servico.unidade}</span>
                            </div>
                            <div style="color: #888; font-size: 0.8rem;"><i class="fas fa-map-marker-alt"></i> ${servico.local}</div>
                            <div style="display: flex; gap: 1rem; margin-top: 0.25rem; font-size: 0.8rem;">
                                <span style="color: #888;"><i class="fas fa-file-contract"></i> Contratado: ${servico.quantidadeContratada.toFixed(2)} ${servico.unidade}</span>
                                <span style="color: #17a2b8;"><i class="fas fa-tools"></i> Produzido: ${servico.quantidadeProduzida.toFixed(2)} ${servico.unidade}</span>
                                <span style="color: #888;"><i class="fas fa-check"></i> Já Medido: ${servico.quantidadeJaMedida.toFixed(2)} ${servico.unidade}</span>
                                <span style="color: #ffc107;"><i class="fas fa-arrow-right"></i> Disponível: <strong>${disponivelReal.toFixed(2)} ${servico.unidade}</strong></span>
                            </div>
                        </div>
                        <div>
                            ${jaAdicionado ? 
                                `<span style="color: #20c997; font-size: 0.85rem;"><i class="fas fa-check-circle"></i> Adicionado (${quantidadeNaMedicao.toFixed(2)})</span>` :
                                (disponivelReal > 0 ? 
                                    `<button onclick="window.obrasManager.abrirModalQuantidadeEdicao('${servico.chaveUnica}')" 
                                        style="padding: 0.5rem 1rem; background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                        <i class="fas fa-plus"></i> Adicionar
                                    </button>` :
                                    `<span style="color: #888; font-size: 0.85rem;">Sem quantidade disponível</span>`
                                )
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    abrirModalQuantidadeEdicao(chaveUnica) {
        const servico = this.servicosParaEdicao.find(s => s.chaveUnica === chaveUnica);
        if (!servico) return;
        
        // Calcular quantidade disponível real
        const quantidadeNaMedicao = this.servicosMedicaoEdicao.find(s => s.chave_unica === chaveUnica)?.quantidade_medida || 0;
        const disponivelReal = servico.quantidadeDisponivel + quantidadeNaMedicao;
        
        this.servicoSelecionadoEdicao = { ...servico, disponivelReal };
        
        // Criar modal de quantidade
        const existingModal = document.getElementById('modal-quantidade-edicao');
        if (existingModal) existingModal.remove();
        
        const modalHTML = `
            <div id="modal-quantidade-edicao" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 400px; border: 1px solid rgba(173, 216, 230, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="color: #add8e6; margin: 0;"><i class="fas fa-edit"></i> Ajustar Quantidade</h4>
                        <button onclick="document.getElementById('modal-quantidade-edicao').remove()" style="background: none; border: none; color: #ff6b6b; font-size: 1.2rem; cursor: pointer;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <div style="color: #add8e6; font-weight: 600;">${servico.codigo} - ${servico.nome}</div>
                        <div style="color: #20c997; font-size: 0.9rem;">Preço: R$ ${servico.precoUnitario.toFixed(2)}/${servico.unidade}</div>
                        <div style="color: #ffc107; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> Disponível: ${disponivelReal.toFixed(2)} ${servico.unidade}</div>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; color: #888; margin-bottom: 0.5rem;"><i class="fas fa-keyboard"></i> Digite a quantidade:</label>
                        <input type="number" id="input-quantidade-edicao" step="0.01" min="0" max="${disponivelReal}" value="${disponivelReal}" 
                            style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; color: #add8e6; font-size: 1.1rem; text-align: center;"
                            oninput="window.obrasManager.atualizarPreviewQuantidadeEdicao()" />
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; color: #888; margin-bottom: 0.5rem;"><i class="fas fa-sliders-h"></i> Ou ajuste com o slider:</label>
                        <input type="range" id="slider-quantidade-edicao" min="0" max="${disponivelReal}" step="0.01" value="${disponivelReal}" 
                            style="width: 100%; cursor: pointer;"
                            oninput="document.getElementById('input-quantidade-edicao').value = this.value; window.obrasManager.atualizarPreviewQuantidadeEdicao();" />
                        <div style="display: flex; justify-content: space-between; color: #888; font-size: 0.8rem;">
                            <span>0</span>
                            <span>${disponivelReal.toFixed(2)} ${servico.unidade}</span>
                        </div>
                    </div>
                    
                    <div style="background: rgba(32, 201, 151, 0.15); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #888;">Quantidade a Medir:</span>
                            <span id="preview-quantidade-edicao" style="color: #20c997; font-weight: 600;">${disponivelReal.toFixed(2)} ${servico.unidade}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                            <span style="color: #888;">Valor Total:</span>
                            <span id="preview-valor-edicao" style="color: #20c997; font-weight: 600;">R$ ${(disponivelReal * servico.precoUnitario).toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem;">
                        <button onclick="document.getElementById('modal-quantidade-edicao').remove()" 
                            style="flex: 1; padding: 0.75rem; background: rgba(255,255,255,0.1); color: #c0c0c0; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button onclick="window.obrasManager.confirmarQuantidadeEdicao()" 
                            style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-check"></i> Confirmar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    atualizarPreviewQuantidadeEdicao() {
        const input = document.getElementById('input-quantidade-edicao');
        const slider = document.getElementById('slider-quantidade-edicao');
        const previewQtd = document.getElementById('preview-quantidade-edicao');
        const previewValor = document.getElementById('preview-valor-edicao');
        
        if (!input || !this.servicoSelecionadoEdicao) return;
        
        let quantidade = parseFloat(input.value) || 0;
        const max = this.servicoSelecionadoEdicao.disponivelReal;
        
        // Limitar ao máximo disponível
        if (quantidade > max) {
            quantidade = max;
            input.value = max;
        }
        if (quantidade < 0) {
            quantidade = 0;
            input.value = 0;
        }
        
        if (slider) slider.value = quantidade;
        
        const valor = quantidade * this.servicoSelecionadoEdicao.precoUnitario;
        
        if (previewQtd) previewQtd.textContent = `${quantidade.toFixed(2)} ${this.servicoSelecionadoEdicao.unidade}`;
        if (previewValor) previewValor.textContent = `R$ ${valor.toFixed(2)}`;
    }
    
    confirmarQuantidadeEdicao() {
        const input = document.getElementById('input-quantidade-edicao');
        if (!input || !this.servicoSelecionadoEdicao) return;
        
        let quantidade = parseFloat(input.value) || 0;
        const max = this.servicoSelecionadoEdicao.disponivelReal;
        
        // Validar limite
        if (quantidade > max) {
            quantidade = max;
            this.showNotification(`Quantidade ajustada para o máximo disponível: ${max.toFixed(2)}`, 'warning');
        }
        
        if (quantidade <= 0) {
            this.showNotification('Quantidade deve ser maior que zero', 'warning');
            return;
        }
        
        const servico = this.servicoSelecionadoEdicao;
        
        // Adicionar ou atualizar na lista de serviços da medição
        const existenteIndex = this.servicosMedicaoEdicao.findIndex(s => s.chave_unica === servico.chaveUnica);
        
        if (existenteIndex >= 0) {
            // Atualizar existente
            this.servicosMedicaoEdicao[existenteIndex].quantidade_medida = quantidade;
            this.servicosMedicaoEdicao[existenteIndex].valor_total = quantidade * servico.precoUnitario;
        } else {
            // Adicionar novo
            this.servicosMedicaoEdicao.push({
                chave_unica: servico.chaveUnica,
                item_proposta_id: servico.itens[0]?.id,
                servico_id: servico.servicoId,
                codigo_servico: servico.codigo,
                nome_servico: servico.nome,
                local: servico.local,
                unidade: servico.unidade,
                quantidade_medida: quantidade,
                preco_unitario: servico.precoUnitario,
                valor_total: quantidade * servico.precoUnitario
            });
        }
        
        // Fechar modal de quantidade
        const modal = document.getElementById('modal-quantidade-edicao');
        if (modal) modal.remove();
        
        // Atualizar listas
        this.atualizarListasEdicao();
        
        this.showNotification('Serviço adicionado/atualizado!', 'success');
    }
    
    atualizarListasEdicao() {
        // Atualizar lista de disponíveis
        const containerDisponiveis = document.getElementById('lista-servicos-disponiveis-edicao');
        if (containerDisponiveis) {
            containerDisponiveis.innerHTML = this.renderServicosDisponiveisEdicao();
        }
        
        // Atualizar lista de adicionados
        const containerAdicionados = document.getElementById('lista-servicos-edicao');
        if (containerAdicionados) {
            containerAdicionados.innerHTML = this.renderServicosEdicao();
        }
        
        // Atualizar total
        const totalElement = document.getElementById('edit-valor-total-medicao');
        if (totalElement) {
            totalElement.textContent = this.formatMoney(this.calcularTotalEdicao());
        }
    }
    
    renderServicosEdicao() {
        if (!this.servicosMedicaoEdicao || this.servicosMedicaoEdicao.length === 0) {
            return '<p style="color: #888; text-align: center;">Nenhum serviço adicionado ainda</p>';
        }
        
        return this.servicosMedicaoEdicao.map((servico, index) => `
            <div style="background: rgba(173, 216, 230, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="color: #add8e6; font-weight: 600;">${servico.codigo_servico} - ${servico.nome_servico}</div>
                    <div style="color: #888; font-size: 0.85rem;"><i class="fas fa-map-marker-alt"></i> ${servico.local}</div>
                    <div style="color: #20c997; font-size: 0.9rem; margin-top: 0.25rem;">
                        Preço: ${this.formatMoney(servico.preco_unitario)}/${servico.unidade}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div>
                        <label style="display: block; color: #888; font-size: 0.8rem; margin-bottom: 0.25rem;">Quantidade</label>
                        <input type="number" step="0.01" min="0" value="${servico.quantidade_medida}" 
                            onchange="window.obrasManager.atualizarQuantidadeEdicao(${index}, this.value)"
                            style="width: 100px; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 4px; color: #add8e6; text-align: center;" />
                    </div>
                    <div style="text-align: right; min-width: 120px;">
                        <div style="color: #888; font-size: 0.8rem;">Valor</div>
                        <div style="color: #20c997; font-weight: 600;" id="valor-servico-${index}">${this.formatMoney(servico.valor_total)}</div>
                    </div>
                    <button onclick="window.obrasManager.removerServicoEdicao(${index})" 
                        style="background: rgba(255, 107, 107, 0.2); border: none; color: #ff6b6b; padding: 0.5rem; border-radius: 4px; cursor: pointer;" title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    atualizarQuantidadeEdicao(index, valor) {
        const quantidade = parseFloat(valor) || 0;
        this.servicosMedicaoEdicao[index].quantidade_medida = quantidade;
        this.servicosMedicaoEdicao[index].valor_total = quantidade * this.servicosMedicaoEdicao[index].preco_unitario;
        
        // Atualizar valor do serviço na tela
        const valorElement = document.getElementById(`valor-servico-${index}`);
        if (valorElement) {
            valorElement.textContent = this.formatMoney(this.servicosMedicaoEdicao[index].valor_total);
        }
        
        // Atualizar total
        const totalElement = document.getElementById('edit-valor-total-medicao');
        if (totalElement) {
            totalElement.textContent = this.formatMoney(this.calcularTotalEdicao());
        }
    }
    
    removerServicoEdicao(index) {
        this.servicosMedicaoEdicao.splice(index, 1);
        
        // Atualizar todas as listas
        this.atualizarListasEdicao();
        
        this.showNotification('Serviço removido da medição', 'info');
    }
    
    calcularTotalEdicao() {
        return this.servicosMedicaoEdicao.reduce((sum, s) => sum + (s.valor_total || 0), 0);
    }
    
    fecharModalEditarMedicao() {
        const modal = document.getElementById('modal-editar-medicao');
        if (modal) modal.remove();
        this.medicaoEmEdicao = null;
        this.servicosMedicaoEdicao = [];
    }
    
    async salvarEdicaoMedicao() {
        if (!this.medicaoEmEdicao) {
            this.showNotification('Erro: medição não encontrada', 'error');
            return;
        }
        
        try {
            this.showNotification('Salvando alterações...', 'info');
            
            const previsaoPagamento = document.getElementById('edit-previsao-pagamento')?.value || null;
            const valorTotal = this.calcularTotalEdicao();
            
            // 1. Atualizar dados da medição
            const { error: updateError } = await supabaseClient
                .from('medicoes_hvc')
                .update({
                    previsao_pagamento: previsaoPagamento,
                    valor_total: valorTotal,
                    valor_bruto: valorTotal
                })
                .eq('id', this.medicaoEmEdicao.id);
            
            if (updateError) throw updateError;
            
            // 2. Deletar serviços antigos
            const { error: deleteError } = await supabaseClient
                .from('medicoes_servicos')
                .delete()
                .eq('medicao_id', this.medicaoEmEdicao.id);
            
            if (deleteError) throw deleteError;
            
            // 3. Inserir serviços atualizados
            if (this.servicosMedicaoEdicao.length > 0) {
                const servicosParaInserir = this.servicosMedicaoEdicao.map(s => ({
                    medicao_id: this.medicaoEmEdicao.id,
                    item_proposta_id: s.item_proposta_id,
                    quantidade_medida: s.quantidade_medida,
                    valor_total: s.valor_total
                }));
                
                const { error: insertError } = await supabaseClient
                    .from('medicoes_servicos')
                    .insert(servicosParaInserir);
                
                if (insertError) throw insertError;
            }
            
            this.showNotification('Medição atualizada com sucesso!', 'success');
            this.fecharModalEditarMedicao();
            
            // Recarregar medições
            await this.loadMedicoesObra(this.currentObraId);
            
        } catch (error) {
            this.showNotification('Erro ao salvar: ' + error.message, 'error');
        }
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
