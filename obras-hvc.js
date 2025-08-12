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
            this.setupEventListeners();
            this.setupMasks();
            this.setupFilters();
            console.log('ObrasManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar ObrasManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
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
                       id="proposta-${proposta.id}" 
                       value="${proposta.id}" 
                       style="margin-right: 1rem; transform: scale(1.2);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #2a5298;">
                        ${proposta.numero_proposta} - ${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}
                    </div>
                    <div style="color: #666; font-size: 0.9rem;">
                        Total: ${this.formatMoney((proposta.total_proposta)/100)}
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
        console.log('Adicionando propostas selecionadas...');
        
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
                console.error('Proposta não encontrada:', propostaId);
                return;
            }

            // Verificar se já foi adicionada
            if (this.propostasSelecionadas.find(p => p.id === propostaId)) {
                return;
            }

            // Adicionar proposta à lista
            this.propostasSelecionadas.push(proposta);
            propostasAdicionadas++;
            console.log('Proposta adicionada:', proposta.numero_proposta);
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
                <td><strong>${this.formatMoney((proposta.total_proposta)/100)}</strong></td>
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
        console.log('🎯 DUAS DATAS - Atualizando resumo da obra...');
        
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
            console.log('🎯 DUAS DATAS - Percentual calculado:', percentualConclusao);
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
            console.log('🎯 DUAS DATAS - Elemento atualizado com:', `${percentualConclusao}%`);
        }
    }

    // Calcular valor total usando coluna preco_total
    async calcularValorTotalCorreto() {
        console.log('🎯 DUAS DATAS - Calculando valor total correto...');
        
        try {
            let valorTotalObra = 0;
            
            for (const proposta of this.propostasSelecionadas) {
                // Buscar preco_total da tabela itens_proposta_hvc
                const { data: itens, error } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .select('preco_total')
                    .eq('proposta_id', proposta.id);

                if (error) {
                    console.error('🎯 DUAS DATAS - Erro ao buscar itens:', error);
                    continue;
                }

                if (itens && itens.length > 0) {
                    for (const item of itens) {
                        const precoTotal = parseFloat(item.preco_total) || 0;
                        valorTotalObra += precoTotal;
                        
                        console.log(`🎯 DUAS DATAS - Item: R$ ${precoTotal.toFixed(2)}`);
                    }
                }
            }
            
            console.log('🎯 DUAS DATAS - Valor total da obra:', valorTotalObra);
            return valorTotalObra;
            
        } catch (error) {
            console.error('🎯 DUAS DATAS - Erro no cálculo do valor total:', error);
            return 0;
        }
    }

    // Calcular percentual usando preco_total
    async calcularPercentualCorrigido(obraId) {
        console.log('🎯 DUAS DATAS - Calculando percentual para obra:', obraId);
        
        try {
            // PASSO 1: Buscar propostas da obra
            const { data: obrasPropostas, error: errorObrasPropostas } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            if (errorObrasPropostas) {
                console.error('🎯 DUAS DATAS - Erro ao buscar propostas da obra:', errorObrasPropostas);
                return 0;
            }

            if (!obrasPropostas || obrasPropostas.length === 0) {
                console.log('🎯 DUAS DATAS - Nenhuma proposta encontrada para a obra');
                return 0;
            }

            const propostaIds = obrasPropostas.map(op => op.proposta_id);
            console.log('🎯 DUAS DATAS - Propostas da obra:', propostaIds);

            // PASSO 2: Buscar todos os itens das propostas com preco_total
            const { data: itensPropostas, error: errorItens } = await supabaseClient
                .from('itens_proposta_hvc')
                .select('id, preco_total')
                .in('proposta_id', propostaIds);

            if (errorItens) {
                console.error('🎯 DUAS DATAS - Erro ao buscar itens:', errorItens);
                return 0;
            }

            if (!itensPropostas || itensPropostas.length === 0) {
                console.log('🎯 DUAS DATAS - Nenhum item encontrado');
                return 0;
            }

            console.log('🎯 DUAS DATAS - Itens encontrados:', itensPropostas.length);

            // PASSO 3: Calcular valor total da obra e percentual de cada item
            let valorTotalObra = 0;
            const itensComValor = [];

            for (const item of itensPropostas) {
                const precoTotal = parseFloat(item.preco_total) || 0;
                valorTotalObra += precoTotal;
                
                itensComValor.push({
                    id: item.id,
                    valorTotal: precoTotal,
                    percentualObra: 0 // Será calculado depois
                });
            }

            console.log('🎯 DUAS DATAS - Valor total da obra:', valorTotalObra);

            if (valorTotalObra === 0) {
                console.log('🎯 DUAS DATAS - Valor total da obra é zero');
                return 0;
            }

            // PASSO 4: Calcular percentual de cada item em relação ao total da obra
            itensComValor.forEach(item => {
                item.percentualObra = (item.valorTotal / valorTotalObra) * 100;
                console.log(`🎯 DUAS DATAS - Item ${item.id}: R$ ${item.valorTotal.toFixed(2)} = ${item.percentualObra.toFixed(2)}% da obra`);
            });

            // PASSO 5: Buscar status dos itens
            const { data: andamentos, error: errorAndamentos } = await supabaseClient
                .from('servicos_andamento')
                .select('item_proposta_id, status')
                .eq('obra_id', obraId);

            if (errorAndamentos) {
                console.error('🎯 DUAS DATAS - Erro ao buscar andamentos:', errorAndamentos);
                return 0;
            }

            // PASSO 6: Aplicar fórmula matemática
            let somaPercentuais = 0;

            itensComValor.forEach(item => {
                const andamento = andamentos?.find(a => a.item_proposta_id === item.id);
                const status = andamento?.status || 'PENDENTE';
                
                // Aplicar multiplicadores conforme especificação
                let multiplicador = 0;
                switch (status) {
                    case 'PENDENTE':
                        multiplicador = 0;
                        break;
                    case 'INICIADO':
                        multiplicador = 0.5;
                        break;
                    case 'CONCLUIDO':
                        multiplicador = 1;
                        break;
                }

                const contribuicao = item.percentualObra * multiplicador;
                somaPercentuais += contribuicao;
                
                console.log(`🎯 DUAS DATAS - Item ${item.id}: ${item.percentualObra.toFixed(2)}% × ${multiplicador} = ${contribuicao.toFixed(2)}%`);
            });

            const percentualFinal = Math.round(somaPercentuais);
            console.log('🎯 DUAS DATAS - Percentual final calculado:', percentualFinal);
            
            // Atualizar percentual na tabela obras_hvc
            await this.atualizarPercentualNoBanco(obraId, percentualFinal);
            
            return percentualFinal;
            
        } catch (error) {
            console.error('🎯 DUAS DATAS - Erro no cálculo:', error);
            return 0;
        }
    }

    async atualizarPercentualNoBanco(obraId, percentual) {
        console.log('🎯 DUAS DATAS - Atualizando percentual no banco:', obraId, percentual);
        
        try {
            const { error } = await supabaseClient
                .from('obras_hvc')
                .update({ percentual_conclusao: percentual })
                .eq('id', obraId);

            if (error) {
                console.error('🎯 DUAS DATAS - Erro ao atualizar banco:', error);
            } else {
                console.log('🎯 DUAS DATAS - Percentual atualizado no banco com sucesso');
            }
        } catch (error) {
            console.error('🎯 DUAS DATAS - Erro na atualização do banco:', error);
        }
    }

    // === MODAL DE ANDAMENTO ===
    showModalAndamento() {
        console.log('Mostrando modal de andamento...');
        
        if (this.propostasSelecionadas.length === 0) {
            this.showNotification('Adicione propostas à obra primeiro', 'warning');
            return;
        }
        
        const modal = document.getElementById('modal-andamento');
        if (modal) {
            modal.classList.add('show');
            this.renderServicosAndamento();
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
                        propostas_hvc (numero_proposta)
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
                
                console.log(`🎯 DUAS DATAS MODAL - Item ${item.id}:`, {
                    precoTotal,
                    quantidade
                });
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${item.propostas_hvc?.numero_proposta}</strong></td>
                    <td>
                        <strong>${item.servicos_hvc?.codigo}</strong><br>
                        <small style="color: #add8e6;">${item.servicos_hvc?.descricao}</small>
                    </td>
                    <td>${quantidade} ${item.servicos_hvc?.unidade || ''}</td>
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
            console.log('🎯 DUAS DATAS - Recalculando percentual após salvar andamento...');
            const novoPercentual = await this.calcularPercentualCorrigido(this.currentObraId);
            
            // Atualizar interface imediatamente
            const progressoEl = document.getElementById('progresso-geral');
            if (progressoEl) {
                progressoEl.textContent = `${novoPercentual}%`;
                console.log('🎯 DUAS DATAS - Interface atualizada com novo percentual:', `${novoPercentual}%`);
            }
            
            // Atualizar valor total da obra no banco
            const valorTotalCorreto = await this.calcularValorTotalCorreto();
            await this.atualizarValorTotalNoBanco(this.currentObraId, valorTotalCorreto);
            
            // Recarregar lista de obras para mostrar valores atualizados
            await this.loadObras();
            
            this.hideModalAndamento();
            this.showNotification(`Andamento salvo! Percentual: ${novoPercentual}% | Valor: ${this.formatMoney(valorTotalCorreto)}`, 'success');
            
        } catch (error) {
            console.error('🎯 DUAS DATAS - Erro ao salvar andamento:', error);
            this.showNotification('Erro ao salvar andamento: ' + error.message, 'error');
        }
    }

    // Atualizar valor total da obra no banco
    async atualizarValorTotalNoBanco(obraId, valorTotal) {
        console.log('🎯 DUAS DATAS - Atualizando valor total no banco:', obraId, valorTotal);
        
        try {
            const { error } = await supabaseClient
                .from('obras_hvc')
                .update({ valor_total: Math.round(valorTotal * 100) }) // Salvar em centavos
                .eq('id', obraId);

            if (error) {
                console.error('🎯 DUAS DATAS - Erro ao atualizar valor total:', error);
            } else {
                console.log('🎯 DUAS DATAS - Valor total atualizado no banco com sucesso');
            }
        } catch (error) {
            console.error('🎯 DUAS DATAS - Erro na atualização do valor total:', error);
        }
    }

    // === OBRAS ===
    async loadObras() {
        try {
            console.log('Carregando obras...');
            
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
            // Extrair clientes únicos
            const clientesUnicos = [...new Set(
                obra.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean) || []
            )];
            const clientesTexto = clientesUnicos.length > 0 ? clientesUnicos.join(', ') : '-';
            
            const percentualConclusao = obra.percentual_conclusao || 0;
            
            // Mostrar valor correto na lista
            const valorObra = obra.valor_total ? (obra.valor_total) : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${obra.numero_obra}</strong></td>
                <td>${clientesTexto}</td>
                <td><strong>${this.formatMoney(valorObra)}</strong></td>
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
        });
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

        console.log('Dados da obra para salvar:', obraData);

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
                console.log('Obra atualizada:', obra);
            } else {
                // Criar nova obra
                const { data, error } = await supabaseClient
                    .from('obras_hvc')
                    .insert([obraData])
                    .select()
                    .single();

                if (error) throw error;
                obra = data;
                console.log('Nova obra criada:', obra);
                this.currentObraId = obra.id;
            }

            // Salvar propostas da obra
            await this.savePropostasObra(obra.id);
            
            this.hideFormObra();
            this.loadObras();
            this.showNotification('Obra salva com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao salvar obra:', error);
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
                console.log('Propostas da obra salvas com sucesso');
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

    async editObra(obraId) {
        try {
            console.log('Editando obra:', obraId);
            
            const { data, error } = await supabaseClient
                .from('obras_hvc')
                .select('*')
                .eq('id', obraId)
                .single();

            if (error) throw error;

            this.showFormObra(data);
        } catch (error) {
            console.error('Erro ao carregar obra:', error);
            this.showNotification('Erro ao carregar obra: ' + error.message, 'error');
        }
    }

    async deleteObra(obraId) {
        if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            console.log('Excluindo obra:', obraId);
            
            const { error } = await supabaseClient
                .from('obras_hvc')
                .delete()
                .eq('id', obraId);

            if (error) throw error;

            this.loadObras();
            this.showNotification('Obra excluída com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir obra:', error);
            this.showNotification('Erro ao excluir obra: ' + error.message, 'error');
        }
    }

    async gerenciarAndamento(obraId) {
        try {
            console.log('Gerenciando andamento da obra:', obraId);
            
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
            console.error('Erro ao carregar dados da obra:', error);
            this.showNotification('Erro ao carregar dados da obra: ' + error.message, 'error');
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

    // === FUNÇÕES PARA PRODUÇÕES DIÁRIAS ===
    
    async showModalProducao(producaoId = null) {
        console.log('Mostrando modal de produção...', producaoId);
        
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
            
            this.equipesIntegrantes.forEach(item => {
                const option = document.createElement('option');
                option.value = `${item.tipo}:${item.id}`;
                option.textContent = `${item.tipo === 'equipe' ? 'Equipe' : 'Integrante'}: ${item.nome}`;
                selectEquipe.appendChild(option);
            });
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
            console.log('Carregando equipes e integrantes...');
            
            // Carregar equipes ativas
            const { data: equipes, error: errorEquipes } = await supabaseClient
                .from('equipes_hvc')
                .select('id, nome')
                .eq('ativa', true)
                .order('nome');
            
            if (errorEquipes) throw errorEquipes;
            
            // Carregar integrantes ativos
            const { data: integrantes, error: errorIntegrantes } = await supabaseClient
                .from('integrantes_hvc')
                .select('id, nome')
                .eq('ativo', true)
                .order('nome');
            
            if (errorIntegrantes) throw errorIntegrantes;
            
            // Combinar em uma lista
            this.equipesIntegrantes = [
                ...(equipes || []).map(e => ({ ...e, tipo: 'equipe' })),
                ...(integrantes || []).map(i => ({ ...i, tipo: 'integrante' }))
            ];
            
            console.log('Equipes e integrantes carregados:', this.equipesIntegrantes.length);
            
        } catch (error) {
            console.error('Erro ao carregar equipes e integrantes:', error);
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
            let temQuantidade = false;
            
            this.servicosObra.forEach(servico => {
                const input = document.getElementById(`servico-${servico.id}`);
                if (input && input.value && parseFloat(input.value) > 0) {
                    quantidades[servico.id] = parseFloat(input.value);
                    temQuantidade = true;
                }
            });
            
            if (!temQuantidade) {
                this.showNotification('Preencha pelo menos um serviço com quantidade maior que zero', 'warning');
                return;
            }
            
            // Separar tipo e ID da equipe/integrante
            const [tipo, id] = equipe.split(':');
            
            // Preparar dados para salvar
            const producaoData = {
                obra_id: this.currentObraId,
                data_producao: data,
                tipo_responsavel: tipo,
                responsavel_id: parseInt(id),
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
    
    renderProducoesDiarias() {
        const container = document.getElementById('lista-producoes');
        if (!container) return;
        
        if (this.producoesDiarias.length === 0) {
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
            
            // Obter nome do responsável
            const responsavel = this.equipesIntegrantes.find(item => 
                item.id === producao.responsavel_id && item.tipo === producao.tipo_responsavel
            );
            const nomeResponsavel = responsavel ? responsavel.nome : 'N/A';
            
            // Formatar data
            const dataFormatada = new Date(producao.data_producao + 'T00:00:00').toLocaleDateString('pt-BR');
            
            // Contar serviços com quantidade
            const quantidadesObj = producao.quantidades_servicos || {};
            const totalServicos = Object.keys(quantidadesObj).length;
            
            producaoDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                            <strong style="color: #add8e6; font-size: 1.1em;">
                                <i class="fas fa-calendar-day"></i>
                                ${dataFormatada}
                            </strong>
                            <span style="color: #e0e0e0;">
                                <i class="fas fa-${producao.tipo_responsavel === 'equipe' ? 'users' : 'user'}"></i>
                                ${nomeResponsavel || 'N/A'}
                            </span>
                        </div>
                        
                        <div style="color: #c0c0c0; font-size: 0.9em; margin-bottom: 0.5rem;">
                            <i class="fas fa-tools"></i>
                            ${totalServicos} serviço(s) executado(s)
                        </div>
                        
                        ${producao.observacoes ? `
                            <div style="color: #a0a0a0; font-size: 0.9em; font-style: italic;">
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
        
        if (filtroEquipe) {
            const [tipo, id] = filtroEquipe.split(':');
            producoesFiltradas = producoesFiltradas.filter(p => 
                p.tipo_responsavel === tipo && p.responsavel_id.toString() === id
            );
        }
        
        // Temporariamente substituir a lista para renderização
        const producaoOriginal = this.producoesDiarias;
        this.producoesDiarias = producoesFiltradas;
        this.renderProducoesDiarias();
        this.producoesDiarias = producaoOriginal;
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
}

// Expor globalmente para uso nos event handlers inline
window.obrasManager = null;

