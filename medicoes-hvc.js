// medicoes-hvc.js - Sistema de Gestão de Medições HVC
// Gerenciamento completo de medições com obras, serviços e cálculos automáticos

// Importar Supabase do arquivo existente
import { supabase as supabaseClient } from './supabase.js';

let medicoesManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando aplicação de medições...');
    initializeApp();
});

function initializeApp() {
    console.log('Inicializando aplicação de medições...');
    
    // Verificar se o Supabase está disponível
    if (supabaseClient) {
        console.log('Supabase conectado com sucesso!');
        
        // Inicializar o gerenciador de medições
        medicoesManager = new MedicoesManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.medicoesManager = medicoesManager;
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

class MedicoesManager {
    constructor() {
        this.currentMedicaoId = null;
        this.obraSelecionada = null;
        this.servicosSelecionados = [];
        this.obras = [];
        this.medicoes = [];
        this.servicosObra = [];
        this.previsoesPagamento = [];
        
        this.init();
    }

    async init() {
        console.log('Inicializando MedicoesManager...');
        
        try {
            await this.loadObras();
            await this.loadMedicoes();
            this.setupEventListeners();
            this.setupCalculos();
            this.setupFilters();
            console.log('MedicoesManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar MedicoesManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        try {
            // Botões principais
            const btnNovaMedicao = document.getElementById('btn-nova-medicao');
            const btnCancelar = document.getElementById('btn-cancelar');
            
            if (btnNovaMedicao) {
                btnNovaMedicao.addEventListener('click', () => this.showFormMedicao());
            }
            if (btnCancelar) {
                btnCancelar.addEventListener('click', () => this.hideFormMedicao());
            }
            
            // Formulário de medição
            const medicaoForm = document.getElementById('medicao-form');
            if (medicaoForm) {
                medicaoForm.addEventListener('submit', (e) => this.handleSubmitMedicao(e));
            }
            
            // Seleção de obra
            const btnSelecionarObra = document.getElementById('btn-selecionar-obra');
            if (btnSelecionarObra) {
                btnSelecionarObra.addEventListener('click', () => this.showModalObras());
            }
            
            // Seleção de serviços
            const btnSelecionarServicos = document.getElementById('btn-selecionar-servicos');
            if (btnSelecionarServicos) {
                btnSelecionarServicos.addEventListener('click', () => this.showModalServicos());
            }
            
            // Modais - Obras
            const closeModalObras = document.getElementById('close-modal-obras');
            const cancelObras = document.getElementById('cancel-obras');
            
            if (closeModalObras) {
                closeModalObras.addEventListener('click', () => this.hideModalObras());
            }
            if (cancelObras) {
                cancelObras.addEventListener('click', () => this.hideModalObras());
            }
            
            // Modais - Serviços
            const closeModalServicos = document.getElementById('close-modal-servicos');
            const cancelServicos = document.getElementById('cancel-servicos');
            const btnConfirmarServicos = document.getElementById('btn-confirmar-servicos');
            
            if (closeModalServicos) {
                closeModalServicos.addEventListener('click', () => this.hideModalServicos());
            }
            if (cancelServicos) {
                cancelServicos.addEventListener('click', () => this.hideModalServicos());
            }
            if (btnConfirmarServicos) {
                btnConfirmarServicos.addEventListener('click', () => this.confirmarSelecaoServicos());
            }
            
            // Modais - Previsões
            const closeModalPrevisoes = document.getElementById('close-modal-previsoes');
            const cancelPrevisoes = document.getElementById('cancel-previsoes');
            const btnAdicionarPrevisao = document.getElementById('btn-adicionar-previsao');
            
            if (closeModalPrevisoes) {
                closeModalPrevisoes.addEventListener('click', () => this.hideModalPrevisoes());
            }
            if (cancelPrevisoes) {
                cancelPrevisoes.addEventListener('click', () => this.hideModalPrevisoes());
            }
            if (btnAdicionarPrevisao) {
                btnAdicionarPrevisao.addEventListener('click', () => this.adicionarNovaPrevisao());
            }
            
            // Fechar modal clicando fora
            const modalObras = document.getElementById('modal-obras');
            const modalServicos = document.getElementById('modal-servicos');
            const modalPrevisoes = document.getElementById('modal-previsoes');
            
            if (modalObras) {
                modalObras.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-obras') this.hideModalObras();
                });
            }
            if (modalServicos) {
                modalServicos.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-servicos') this.hideModalServicos();
                });
            }
            if (modalPrevisoes) {
                modalPrevisoes.addEventListener('click', (e) => {
                    if (e.target.id === 'modal-previsoes') this.hideModalPrevisoes();
                });
            }
            
            // Filtro de obras no modal
            const filtroObrasModal = document.getElementById('filtro-obras-modal');
            if (filtroObrasModal) {
                filtroObrasModal.addEventListener('keyup', (e) => {
                    this.filtrarObrasModal(e.target.value);
                });
            }
            
            console.log('Event listeners configurados!');
        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    setupCalculos() {
        // Configurar eventos para recálculo automático
        const descontoInput = document.getElementById('desconto-valor');
        const tipoPrecoSelect = document.getElementById('tipo-preco');
        
        if (descontoInput) {
            descontoInput.addEventListener('input', () => this.calcularValores());
        }
        if (tipoPrecoSelect) {
            tipoPrecoSelect.addEventListener('change', () => this.calcularValores());
        }
    }

    setupFilters() {
        // Filtros da lista de medições
        const filtroBusca = document.getElementById('filtro-busca-medicao');
        const filtroStatus = document.getElementById('filtro-status-medicao');
        const filtroObra = document.getElementById('filtro-obra-medicao');
        const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
        
        if (filtroBusca) {
            filtroBusca.addEventListener('keyup', () => this.filtrarMedicoes());
        }
        if (filtroStatus) {
            filtroStatus.addEventListener('change', () => this.filtrarMedicoes());
        }
        if (filtroObra) {
            filtroObra.addEventListener('change', () => this.filtrarMedicoes());
        }
        if (btnLimparFiltros) {
            btnLimparFiltros.addEventListener('click', () => this.limparFiltros());
        }
    }

    formatMoney(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    showNotification(message, type = 'success') {
        // Remover notificação existente
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Criar nova notificação
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Mostrar notificação
        setTimeout(() => notification.classList.add('show'), 100);

        // Remover após 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // === FORMULÁRIO ===
    showFormMedicao() {
        this.resetForm();
        document.getElementById('form-medicao').classList.remove('hidden');
        document.getElementById('form-title-text').textContent = 'Nova Medição';
        this.currentMedicaoId = null;
    }

    hideFormMedicao() {
        document.getElementById('form-medicao').classList.add('hidden');
        this.resetForm();
    }

    resetForm() {
        document.getElementById('medicao-form').reset();
        this.obraSelecionada = null;
        this.servicosSelecionados = [];
        this.currentMedicaoId = null;
        
        // Limpar campos específicos
        document.getElementById('numero-medicao').value = '';
        document.getElementById('obra-selecionada').value = '';
        document.getElementById('btn-selecionar-servicos').disabled = true;
        
        // Ocultar seções
        document.getElementById('servicos-selecionados').style.display = 'none';
        document.getElementById('resumo-financeiro').style.display = 'none';
        
        this.calcularValores();
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
            this.populateObraFilter();
            
            console.log('Obras carregadas:', this.obras.length);
        } catch (error) {
            console.error('Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    populateObraFilter() {
        const filtroObra = document.getElementById('filtro-obra-medicao');
        if (!filtroObra) return;
        
        // Limpar e popular o select
        filtroObra.innerHTML = '<option value="">Todas</option>';
        this.obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = `${obra.numero_obra} - ${obra.status}`;
            filtroObra.appendChild(option);
        });
    }

    showModalObras() {
        this.renderObrasModal();
        document.getElementById('modal-obras').classList.add('show');
    }

    hideModalObras() {
        document.getElementById('modal-obras').classList.remove('show');
    }

    renderObrasModal() {
        const container = document.getElementById('lista-obras');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.obras.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-building" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma obra encontrada.
                </div>
            `;
            return;
        }
        
        this.obras.forEach(obra => {
            // Extrair clientes únicos
            const clientesUnicos = [...new Set(
                obra.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean) || []
            )];
            const clientesTexto = clientesUnicos.length > 0 ? clientesUnicos.join(', ') : 'Sem clientes';
            
            // Verificar se a obra tem propostas com serviços
            const temPropostas = obra.obras_propostas && obra.obras_propostas.length > 0;
            const statusPropostas = temPropostas ? 
                `✅ ${obra.obras_propostas.length} proposta(s)` : 
                '⚠️ Sem propostas';
            
            const obraItem = document.createElement('div');
            obraItem.className = 'obra-item';
            obraItem.style.cssText = `
                display: flex;
                align-items: center;
                padding: 1rem;
                border: 1px solid rgba(173, 216, 230, 0.2);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                cursor: pointer;
                transition: all 0.3s ease;
                ${!temPropostas ? 'border-left: 4px solid #ffc107;' : 'border-left: 4px solid #28a745;'}
            `;
            
            obraItem.innerHTML = `
                <div style="flex: 1;">
                    <strong style="color: #add8e6;">${obra.numero_obra}</strong><br>
                    <small style="color: #e0e0e0;">Clientes: ${clientesTexto}</small><br>
                    <small style="color: #20c997;">Status: ${obra.status}</small><br>
                    <small style="color: ${temPropostas ? '#28a745' : '#ffc107'};">${statusPropostas}</small>
                </div>
                <button class="btn ${temPropostas ? 'btn-success' : 'btn-warning'}" 
                        onclick="window.medicoesManager.selecionarObra('${obra.id}')"
                        ${!temPropostas ? 'title="Esta obra não possui propostas com serviços"' : ''}>
                    <i class="fas fa-${temPropostas ? 'check' : 'exclamation-triangle'}"></i>
                    ${temPropostas ? 'Selecionar' : 'Sem Serviços'}
                </button>
            `;
            
            obraItem.addEventListener('mouseenter', () => {
                obraItem.style.background = 'rgba(173, 216, 230, 0.1)';
            });
            
            obraItem.addEventListener('mouseleave', () => {
                obraItem.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            
            container.appendChild(obraItem);
        });
    }

    filtrarObrasModal(termo) {
        const obraItems = document.querySelectorAll('.obra-item');
        const termoLower = termo.toLowerCase();
        
        obraItems.forEach(item => {
            const texto = item.textContent.toLowerCase();
            if (texto.includes(termoLower)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async selecionarObra(obraId) {
        try {
            console.log('Selecionando obra com ID:', obraId);
            
            const obra = this.obras.find(o => o.id === obraId);
            if (!obra) {
                console.error('Obra não encontrada:', obraId);
                this.showNotification('Obra não encontrada', 'error');
                return;
            }
            
            console.log('Obra encontrada:', obra);
            
            // Verificar se a obra tem dados completos
            if (!obra.obras_propostas) {
                console.log('Obra sem propostas associadas, recarregando dados...');
                
                // Recarregar obra com dados completos
                const { data: obraCompleta, error } = await supabaseClient
                    .from('obras_hvc')
                    .select(`
                        *,
                        obras_propostas (
                            proposta_id,
                            propostas_hvc (
                                id,
                                numero_proposta,
                                clientes_hvc (nome)
                            )
                        )
                    `)
                    .eq('id', obraId)
                    .single();
                
                if (error) {
                    console.error('Erro ao recarregar obra:', error);
                    throw error;
                }
                
                this.obraSelecionada = obraCompleta;
                console.log('Obra recarregada com dados completos:', obraCompleta);
            } else {
                this.obraSelecionada = obra;
            }
            
            // Atualizar interface
            const clientesUnicos = [...new Set(
                this.obraSelecionada.obras_propostas?.map(op => op.propostas_hvc?.clientes_hvc?.nome).filter(Boolean) || []
            )];
            const clientesTexto = clientesUnicos.length > 0 ? clientesUnicos.join(', ') : 'Sem clientes';
            
            document.getElementById('obra-selecionada').value = `${this.obraSelecionada.numero_obra} - ${this.obraSelecionada.status} (${clientesTexto})`;
            document.getElementById('btn-selecionar-servicos').disabled = false;
            
            // Gerar número da medição
            await this.gerarNumeroMedicao();
            
            // Limpar serviços selecionados
            this.servicosSelecionados = [];
            document.getElementById('servicos-selecionados').style.display = 'none';
            document.getElementById('resumo-financeiro').style.display = 'none';
            
            this.hideModalObras();
            this.showNotification('Obra selecionada com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao selecionar obra:', error);
            this.showNotification('Erro ao selecionar obra: ' + error.message, 'error');
        }
    }

    async gerarNumeroMedicao() {
        if (!this.obraSelecionada) return;
        
        try {
            // Chamar função do banco para gerar número
            const { data, error } = await supabaseClient
                .rpc('gerar_numero_medicao', { 
                    obra_numero: this.obraSelecionada.numero_obra 
                });
            
            if (error) throw error;
            
            document.getElementById('numero-medicao').value = data;
            
        } catch (error) {
            console.error('Erro ao gerar número da medição:', error);
            // Fallback: gerar número localmente
            const proximoNumero = await this.gerarNumeroLocal();
            document.getElementById('numero-medicao').value = proximoNumero;
        }
    }

    async gerarNumeroLocal() {
        try {
            // Buscar medições existentes para esta obra
            const { data, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('numero_medicao')
                .eq('obra_id', this.obraSelecionada.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            let proximoNumero = 1;
            if (data && data.length > 0) {
                // Extrair o maior número
                const numeros = data.map(m => {
                    const partes = m.numero_medicao.split('.');
                    return parseInt(partes[0]) || 0;
                });
                proximoNumero = Math.max(...numeros) + 1;
            }
            
            return `${proximoNumero.toString().padStart(4, '0')}.${this.obraSelecionada.numero_obra}`;
            
        } catch (error) {
            console.error('Erro ao gerar número local:', error);
            return `0001.${this.obraSelecionada.numero_obra}`;
        }
    }

    // === SERVIÇOS ===
    async showModalServicos() {
        if (!this.obraSelecionada) {
            this.showNotification('Selecione uma obra primeiro', 'warning');
            return;
        }
        
        await this.loadServicosObra();
        this.renderServicosModal();
        document.getElementById('modal-servicos').classList.add('show');
    }

    hideModalServicos() {
        document.getElementById('modal-servicos').classList.remove('show');
    }

    async loadServicosObra() {
        try {
            console.log('Carregando serviços da obra:', this.obraSelecionada);
            
            if (!this.obraSelecionada || !this.obraSelecionada.id) {
                console.error('Obra selecionada inválida:', this.obraSelecionada);
                this.servicosObra = [];
                return;
            }
            
            // NOVA ABORDAGEM: Buscar diretamente pelos serviços da obra
            // Primeiro, buscar as propostas da obra
            const { data: obrasPropostas, error: errorObrasPropostas } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', this.obraSelecionada.id);
            
            if (errorObrasPropostas) {
                console.error('Erro ao buscar propostas da obra:', errorObrasPropostas);
                throw errorObrasPropostas;
            }
            
            console.log('Propostas da obra encontradas:', obrasPropostas);
            
            if (!obrasPropostas || obrasPropostas.length === 0) {
                console.log('Obra não possui propostas associadas');
                this.servicosObra = [];
                return;
            }
            
            // Extrair IDs das propostas
            const propostaIds = obrasPropostas.map(op => op.proposta_id).filter(id => id);
            console.log('IDs das propostas:', propostaIds);
            
            if (propostaIds.length === 0) {
                console.log('Nenhuma proposta válida encontrada');
                this.servicosObra = [];
                return;
            }
            
            // Buscar os itens das propostas (serviços)
            const { data: itensPropostas, error: errorItens } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (*),
                    propostas_hvc (
                        numero_proposta,
                        clientes_hvc (nome)
                    )
                `)
                .in('proposta_id', propostaIds);
            
            if (errorItens) {
                console.error('Erro ao buscar itens das propostas:', errorItens);
                throw errorItens;
            }
            
            console.log('Itens das propostas encontrados:', itensPropostas);
            
            this.servicosObra = itensPropostas || [];
            console.log('Serviços da obra carregados:', this.servicosObra.length);
            
        } catch (error) {
            console.error('Erro ao carregar serviços da obra:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
            this.servicosObra = [];
        }
    }

    renderServicosModal() {
        const container = document.getElementById('lista-servicos-obra');
        if (!container) return;
        
        console.log('Renderizando modal de serviços. Total de serviços:', this.servicosObra.length);
        
        if (this.servicosObra.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <h3>Nenhum serviço encontrado para esta obra</h3>
                    <p>Possíveis causas:</p>
                    <ul style="text-align: left; display: inline-block; margin-top: 1rem;">
                        <li>A obra não possui propostas associadas</li>
                        <li>As propostas não possuem serviços cadastrados</li>
                        <li>Erro na consulta ao banco de dados</li>
                    </ul>
                    <p style="margin-top: 1rem;">
                        <small>Verifique se a obra possui propostas com serviços cadastrados.</small>
                    </p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <table class="medicoes-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="width: 50px;">
                            <input type="checkbox" id="select-all-servicos" style="transform: scale(1.2);">
                        </th>
                        <th>Proposta</th>
                        <th>Serviço</th>
                        <th>Quantidade Disponível</th>
                        <th>Preço Unitário</th>
                    </tr>
                </thead>
                <tbody id="servicos-tbody">
                </tbody>
            </table>
        `;
        
        const tbody = document.getElementById('servicos-tbody');
        const selectAll = document.getElementById('select-all-servicos');
        
        // Configurar select all
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
        }
        
        this.servicosObra.forEach((item, index) => {
            const tipoPreco = document.getElementById('tipo-preco')?.value || 'total';
            let precoUnitario = 0;
            
            // Validar se o item tem dados completos
            if (!item.servicos_hvc) {
                console.warn('Serviço sem dados completos:', item);
                return;
            }
            
            switch (tipoPreco) {
                case 'mao_obra':
                    precoUnitario = item.preco_mao_obra || 0;
                    break;
                case 'material':
                    precoUnitario = item.preco_material || 0;
                    break;
                default:
                    precoUnitario = item.preco_total || 0;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" 
                           data-index="${index}" 
                           data-item-id="${item.id}"
                           style="transform: scale(1.2);">
                </td>
                <td><strong>${item.propostas_hvc?.numero_proposta || 'N/A'}</strong></td>
                <td>
                    <strong>${item.servicos_hvc?.codigo || 'N/A'}</strong><br>
                    <small>${item.servicos_hvc?.descricao || 'Sem descrição'}</small>
                </td>
                <td>${item.quantidade || 0} ${item.servicos_hvc?.unidade || ''}</td>
                <td><strong>${this.formatMoney((precoUnitario / 100) || 0)}</strong></td>
            `;
            tbody.appendChild(row);
        });
        
        console.log('Modal de serviços renderizado com', this.servicosObra.length, 'serviços');
    }

    confirmarSelecaoServicos() {
        const checkboxes = document.querySelectorAll('#servicos-tbody input[type="checkbox"]:checked');
        
        if (checkboxes.length === 0) {
            this.showNotification('Selecione pelo menos um serviço', 'warning');
            return;
        }
        
        this.servicosSelecionados = [];
        
        checkboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const item = this.servicosObra[index];
            if (item) {
                this.servicosSelecionados.push({
                    ...item,
                    quantidade_medida: 0 // Será definida pelo usuário
                });
            }
        });
        
        this.renderServicosSelecionados();
        this.hideModalServicos();
        this.showNotification(`${this.servicosSelecionados.length} serviço(s) selecionado(s)`, 'success');
    }

    renderServicosSelecionados() {
        const container = document.getElementById('servicos-selecionados');
        const lista = document.getElementById('lista-servicos-selecionados');
        
        if (this.servicosSelecionados.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        lista.innerHTML = '';
        
        this.servicosSelecionados.forEach((item, index) => {
            const servicoDiv = document.createElement('div');
            servicoDiv.className = 'servico-item';
            
            const tipoPreco = document.getElementById('tipo-preco')?.value || 'total';
            let precoUnitario = 0;
            
            switch (tipoPreco) {
                case 'mao_obra':
                    precoUnitario = item.preco_mao_obra || 0;
                    break;
                case 'material':
                    precoUnitario = item.preco_material || 0;
                    break;
                default:
                    precoUnitario = item.preco_total || 0;
            }
            
            servicoDiv.innerHTML = `
                <div class="servico-info">
                    <strong>${item.servicos_hvc?.codigo}</strong> - ${item.servicos_hvc?.descricao}<br>
                    <small>Proposta: ${item.propostas_hvc?.numero_proposta} | 
                           Disponível: ${item.quantidade} ${item.servicos_hvc?.unidade || ''}</small>
                    <div class="preco-info">
                        <span class="preco-unitario">Preço: ${this.formatMoney((precoUnitario / 100) || 0)}</span>
                        <span class="preco-tipo">(${tipoPreco === 'total' ? 'Total' : tipoPreco === 'mao_obra' ? 'Mão de Obra' : 'Material'})</span>
                    </div>
                </div>
                <div class="servico-quantidade">
                    <label>Quantidade Medida:</label>
                    <input type="number" 
                           class="quantidade-input" 
                           data-index="${index}"
                           data-servico-id="${item.id}"
                           value="${item.quantidade_medida || 0}"
                           min="0" 
                           max="${item.quantidade}"
                           step="0.01"
                           placeholder="0">
                    <span>${item.servicos_hvc?.unidade || ''}</span>
                    <button type="button" class="btn btn-danger" onclick="window.medicoesManager.removerServico(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            lista.appendChild(servicoDiv);
            
            // Configurar evento de mudança na quantidade
            const quantidadeInput = servicoDiv.querySelector('.quantidade-input');
            quantidadeInput.addEventListener('input', (e) => {
                this.servicosSelecionados[index].quantidade_medida = parseFloat(e.target.value) || 0;
                this.calcularValores();
            });
        });
        
        this.calcularValores();
    }

    removerServico(index) {
        this.servicosSelecionados.splice(index, 1);
        this.renderServicosSelecionados();
        this.calcularValores();
    }

    // === CÁLCULOS ===
    calcularValores() {
        const tipoPreco = document.getElementById('tipo-preco')?.value || 'total';
        const desconto = parseFloat(document.getElementById('desconto-valor')?.value) || 0;
        
        let valorBruto = 0;
        
        this.servicosSelecionados.forEach(item => {
            const quantidade = item.quantidade_medida || 0;
            let precoUnitario = 0;
            
            switch (tipoPreco) {
                case 'mao_obra':
                    precoUnitario = item.preco_mao_obra || 0;
                    break;
                case 'material':
                    precoUnitario = item.preco_material || 0;
                    break;
                default:
                    precoUnitario = item.preco_total || 0;
            }
            
            // Preço já está em centavos, então dividimos por 100 para converter para reais
            valorBruto += quantidade * (precoUnitario / 100);
            
            // Atualizar o preço exibido no item
            const servicoDiv = document.querySelector(`[data-servico-id="${item.id}"]`);
            if (servicoDiv) {
                const precoElement = servicoDiv.querySelector('.preco-unitario');
                if (precoElement) {
                    precoElement.textContent = `Preço: R$ ${(precoUnitario / 100).toFixed(2)}`;
                }
            }
        });
        
        const valorDesconto = desconto;
        const valorTotal = Math.max(0, valorBruto - valorDesconto);
        
        // Atualizar interface
        document.getElementById('valor-bruto').textContent = this.formatMoney(valorBruto);
        document.getElementById('valor-desconto').textContent = this.formatMoney(valorDesconto);
        document.getElementById('valor-total').textContent = this.formatMoney(valorTotal);
        
        // Mostrar resumo se houver serviços
        const resumo = document.getElementById('resumo-financeiro');
        if (this.servicosSelecionados.length > 0) {
            resumo.style.display = 'block';
        } else {
            resumo.style.display = 'none';
        }
    }

    // === MEDIÇÕES ===
    async loadMedicoes() {
        try {
            console.log('Carregando medições...');
            
            const { data, error } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    obras_hvc (numero_obra, status),
                    medicoes_previsoes_pagamento!inner (
                        data_previsao,
                        ativa
                    )
                `)
                .eq('medicoes_previsoes_pagamento.ativa', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.medicoes = data || [];
            this.renderMedicoes(this.medicoes);
            
            console.log('Medições carregadas:', this.medicoes.length);
        } catch (error) {
            console.error('Erro ao carregar medições:', error);
            this.showNotification('Erro ao carregar medições: ' + error.message, 'error');
        }
    }

    renderMedicoes(medicoes) {
        const tbody = document.getElementById('medicoes-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (medicoes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #888;">
                        <i class="fas fa-ruler-combined" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma medição encontrada. Clique em "Nova Medição" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        medicoes.forEach(medicao => {
            const previsaoPagamento = medicao.medicoes_previsoes_pagamento?.[0]?.data_previsao;
            const dataFormatada = previsaoPagamento ? 
                new Date(previsaoPagamento).toLocaleDateString('pt-BR') : '-';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${medicao.numero_medicao}</strong></td>
                <td>${medicao.obras_hvc?.numero_obra || '-'}</td>
                <td><strong>${this.formatMoney((medicao.valor_total / 100) || 0)}</strong></td>
                <td>
                    <span class="status-badge status-${medicao.status}">
                        ${medicao.status}
                    </span>
                </td>
                <td>${dataFormatada}</td>
                <td>
                    <span class="status-badge ${medicao.emitir_boleto ? 'status-aprovada' : 'status-pendente'}">
                        ${medicao.emitir_boleto ? 'Sim' : 'Não'}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-secondary" 
                            onclick="window.medicoesManager.editMedicao('${medicao.id}')"
                            title="Editar medição">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-warning" 
                            onclick="window.medicoesManager.gerenciarPrevisoes('${medicao.id}')"
                            title="Gerenciar previsões">
                        <i class="fas fa-calendar-alt"></i>
                    </button>
                    <button class="btn btn-danger" 
                            onclick="window.medicoesManager.deleteMedicao('${medicao.id}')"
                            title="Excluir medição">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // === FILTROS ===
    filtrarMedicoes() {
        const termoBusca = document.getElementById('filtro-busca-medicao')?.value.toLowerCase() || '';
        const statusFiltro = document.getElementById('filtro-status-medicao')?.value || '';
        const obraFiltro = document.getElementById('filtro-obra-medicao')?.value || '';
        
        const medicoesFiltradas = this.medicoes.filter(medicao => {
            // Filtro de busca
            const textoMedicao = `${medicao.numero_medicao} ${medicao.observacoes || ''}`.toLowerCase();
            const obraTexto = medicao.obras_hvc?.numero_obra?.toLowerCase() || '';
            const passaBusca = !termoBusca || textoMedicao.includes(termoBusca) || obraTexto.includes(termoBusca);
            
            // Filtro de status
            const passaStatus = !statusFiltro || medicao.status === statusFiltro;
            
            // Filtro de obra
            const passaObra = !obraFiltro || medicao.obra_id === obraFiltro;
            
            return passaBusca && passaStatus && passaObra;
        });

        this.renderMedicoes(medicoesFiltradas);
    }

    limparFiltros() {
        document.getElementById('filtro-busca-medicao').value = '';
        document.getElementById('filtro-status-medicao').value = '';
        document.getElementById('filtro-obra-medicao').value = '';
        this.renderMedicoes(this.medicoes);
    }

    // === CRUD MEDIÇÕES ===
    async handleSubmitMedicao(e) {
        e.preventDefault();

        if (!this.validateFormMedicao()) return;

        const medicaoData = {
            numero_medicao: document.getElementById('numero-medicao').value,
            obra_id: this.obraSelecionada.id,
            tipo_preco: document.getElementById('tipo-preco').value,
            desconto_valor: Math.round((parseFloat(document.getElementById('desconto-valor').value) || 0) * 100),
            previsao_pagamento: document.getElementById('previsao-pagamento').value || null,
            emitir_boleto: document.getElementById('emitir-boleto').value === 'true',
            observacoes: document.getElementById('observacoes-medicao').value || null,
        };

        // Calcular valores
        const tipoPreco = medicaoData.tipo_preco;
        let valorBruto = 0;
        
        this.servicosSelecionados.forEach(item => {
            const quantidade = item.quantidade_medida || 0;
            let precoUnitario = 0;
            
            switch (tipoPreco) {
                case 'mao_obra':
                    precoUnitario = item.preco_mao_obra || 0;
                    break;
                case 'material':
                    precoUnitario = item.preco_material || 0;
                    break;
                default:
                    precoUnitario = item.preco_total || 0;
            }
            
            valorBruto += quantidade * precoUnitario;
        });
        
        medicaoData.valor_bruto = Math.round(valorBruto);
        medicaoData.valor_total = Math.max(0, Math.round(valorBruto - medicaoData.desconto_valor));

        console.log('Dados da medição para salvar:', medicaoData);

        try {
            let medicao;
            
            if (this.currentMedicaoId) {
                // Atualizar medição existente
                const { data, error } = await supabaseClient
                    .from('medicoes_hvc')
                    .update(medicaoData)
                    .eq('id', this.currentMedicaoId)
                    .select()
                    .single();

                if (error) throw error;
                medicao = data;
                
                // Atualizar serviços
                await this.salvarServicosMedicao(medicao.id);
                
                this.showNotification('Medição atualizada com sucesso!', 'success');
            } else {
                // Criar nova medição
                const { data, error } = await supabaseClient
                    .from('medicoes_hvc')
                    .insert(medicaoData)
                    .select()
                    .single();

                if (error) throw error;
                medicao = data;
                
                // Salvar serviços
                await this.salvarServicosMedicao(medicao.id);
                
                // Criar previsão inicial se informada
                if (medicaoData.previsao_pagamento) {
                    await this.criarPrevisaoInicial(medicao.id, medicaoData.previsao_pagamento);
                }
                
                this.showNotification('Medição criada com sucesso!', 'success');
            }

            this.hideFormMedicao();
            this.loadMedicoes();
            
        } catch (error) {
            console.error('Erro ao salvar medição:', error);
            this.showNotification('Erro ao salvar medição: ' + error.message, 'error');
        }
    }

    async salvarServicosMedicao(medicaoId) {
        try {
            // Remover serviços existentes
            await supabaseClient
                .from('medicoes_servicos')
                .delete()
                .eq('medicao_id', medicaoId);
            
            // Inserir novos serviços
            const servicosData = this.servicosSelecionados.map(item => {
                const tipoPreco = document.getElementById('tipo-preco').value;
                let precoUnitario = 0;
                
                switch (tipoPreco) {
                    case 'mao_obra':
                        precoUnitario = item.preco_mao_obra || 0;
                        break;
                    case 'material':
                        precoUnitario = item.preco_material || 0;
                        break;
                    default:
                        precoUnitario = item.preco_total || 0;
                }
                
                return {
                    medicao_id: medicaoId,
                    item_proposta_id: item.id,
                    quantidade_medida: item.quantidade_medida || 0,
                    preco_unitario: precoUnitario,
                    valor_total: Math.round((item.quantidade_medida || 0) * precoUnitario)
                };
            });
            
            if (servicosData.length > 0) {
                const { error } = await supabaseClient
                    .from('medicoes_servicos')
                    .insert(servicosData);
                
                if (error) throw error;
            }
            
        } catch (error) {
            console.error('Erro ao salvar serviços da medição:', error);
            throw error;
        }
    }

    async criarPrevisaoInicial(medicaoId, dataPrevisao) {
        try {
            const { error } = await supabaseClient
                .from('medicoes_previsoes_pagamento')
                .insert({
                    medicao_id: medicaoId,
                    data_previsao: dataPrevisao,
                    motivo_alteracao: 'Previsão inicial',
                    ativa: true
                });
            
            if (error) throw error;
            
        } catch (error) {
            console.error('Erro ao criar previsão inicial:', error);
            throw error;
        }
    }

    validateFormMedicao() {
        if (!this.obraSelecionada) {
            this.showNotification('Selecione uma obra', 'warning');
            return false;
        }
        
        if (this.servicosSelecionados.length === 0) {
            this.showNotification('Selecione pelo menos um serviço', 'warning');
            return false;
        }
        
        // Validar quantidades
        const quantidadesValidas = this.servicosSelecionados.every(item => {
            return (item.quantidade_medida || 0) > 0;
        });
        
        if (!quantidadesValidas) {
            this.showNotification('Informe a quantidade medida para todos os serviços', 'warning');
            return false;
        }
        
        return true;
    }

    async editMedicao(medicaoId) {
        try {
            // Carregar dados da medição
            const { data: medicao, error } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    obras_hvc (*),
                    medicoes_servicos (
                        *,
                        itens_proposta_hvc (
                            *,
                            servicos_hvc (*),
                            propostas_hvc (numero_proposta)
                        )
                    )
                `)
                .eq('id', medicaoId)
                .single();
            
            if (error) throw error;
            
            // Preencher formulário
            this.currentMedicaoId = medicaoId;
            this.obraSelecionada = medicao.obras_hvc;
            
            document.getElementById('numero-medicao').value = medicao.numero_medicao;
            document.getElementById('obra-selecionada').value = `${medicao.obras_hvc.numero_obra} - ${medicao.obras_hvc.status}`;
            document.getElementById('tipo-preco').value = medicao.tipo_preco;
            document.getElementById('desconto-valor').value = (medicao.desconto_valor / 100) || 0;
            document.getElementById('previsao-pagamento').value = medicao.previsao_pagamento || '';
            document.getElementById('emitir-boleto').value = medicao.emitir_boleto.toString();
            document.getElementById('observacoes-medicao').value = medicao.observacoes || '';
            
            // Carregar serviços selecionados
            this.servicosSelecionados = medicao.medicoes_servicos.map(ms => ({
                ...ms.itens_proposta_hvc,
                quantidade_medida: ms.quantidade_medida
            }));
            
            document.getElementById('btn-selecionar-servicos').disabled = false;
            this.renderServicosSelecionados();
            
            // Mostrar formulário
            document.getElementById('form-medicao').classList.remove('hidden');
            document.getElementById('form-title-text').textContent = 'Editar Medição';
            
        } catch (error) {
            console.error('Erro ao carregar medição:', error);
            this.showNotification('Erro ao carregar medição: ' + error.message, 'error');
        }
    }

    async deleteMedicao(medicaoId) {
        if (!confirm('Tem certeza que deseja excluir esta medição? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            console.log('Excluindo medição:', medicaoId);
            
            const { error } = await supabaseClient
                .from('medicoes_hvc')
                .delete()
                .eq('id', medicaoId);

            if (error) throw error;

            this.loadMedicoes();
            this.showNotification('Medição excluída com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir medição:', error);
            this.showNotification('Erro ao excluir medição: ' + error.message, 'error');
        }
    }

    // === PREVISÕES DE PAGAMENTO ===
    async gerenciarPrevisoes(medicaoId) {
        this.currentMedicaoId = medicaoId;
        await this.loadPrevisoesPagamento(medicaoId);
        this.renderPrevisoes();
        document.getElementById('modal-previsoes').classList.add('show');
    }

    hideModalPrevisoes() {
        document.getElementById('modal-previsoes').classList.remove('show');
    }

    async loadPrevisoesPagamento(medicaoId) {
        try {
            const { data, error } = await supabaseClient
                .from('medicoes_previsoes_pagamento')
                .select('*')
                .eq('medicao_id', medicaoId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            this.previsoesPagamento = data || [];
            
        } catch (error) {
            console.error('Erro ao carregar previsões:', error);
            this.previsoesPagamento = [];
        }
    }

    renderPrevisoes() {
        const container = document.getElementById('lista-previsoes');
        if (!container) return;
        
        if (this.previsoesPagamento.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #888;">
                    <i class="fas fa-calendar-alt" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma previsão de pagamento encontrada.
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <table class="medicoes-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th>Data Previsão</th>
                        <th>Motivo</th>
                        <th>Status</th>
                        <th>Data Criação</th>
                    </tr>
                </thead>
                <tbody id="previsoes-tbody">
                </tbody>
            </table>
        `;
        
        const tbody = document.getElementById('previsoes-tbody');
        
        this.previsoesPagamento.forEach(previsao => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${new Date(previsao.data_previsao).toLocaleDateString('pt-BR')}</strong></td>
                <td>${previsao.motivo_alteracao || '-'}</td>
                <td>
                    <span class="status-badge ${previsao.ativa ? 'status-aprovada' : 'status-pendente'}">
                        ${previsao.ativa ? 'Ativa' : 'Histórico'}
                    </span>
                </td>
                <td>${new Date(previsao.created_at).toLocaleDateString('pt-BR')}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async adicionarNovaPrevisao() {
        const novaData = document.getElementById('nova-previsao-data').value;
        const motivo = document.getElementById('motivo-alteracao').value;
        
        if (!novaData) {
            this.showNotification('Informe a nova data de previsão', 'warning');
            return;
        }
        
        if (!motivo.trim()) {
            this.showNotification('Informe o motivo da alteração', 'warning');
            return;
        }
        
        try {
            // Desativar previsões anteriores
            await supabaseClient
                .from('medicoes_previsoes_pagamento')
                .update({ ativa: false })
                .eq('medicao_id', this.currentMedicaoId);
            
            // Criar nova previsão
            const { error } = await supabaseClient
                .from('medicoes_previsoes_pagamento')
                .insert({
                    medicao_id: this.currentMedicaoId,
                    data_previsao: novaData,
                    motivo_alteracao: motivo,
                    ativa: true
                });
            
            if (error) throw error;
            
            // Atualizar previsão na medição
            await supabaseClient
                .from('medicoes_hvc')
                .update({ previsao_pagamento: novaData })
                .eq('id', this.currentMedicaoId);
            
            // Limpar campos
            document.getElementById('nova-previsao-data').value = '';
            document.getElementById('motivo-alteracao').value = '';
            
            // Recarregar dados
            await this.loadPrevisoesPagamento(this.currentMedicaoId);
            this.renderPrevisoes();
            this.loadMedicoes();
            
            this.showNotification('Nova previsão adicionada com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao adicionar previsão:', error);
            this.showNotification('Erro ao adicionar previsão: ' + error.message, 'error');
        }
    }
}

// Expor classe globalmente para debug
window.MedicoesManager = MedicoesManager;

