// Gerenciamento completo de medições com obras, serviços e cálculos automáticos
// VERSÃO CORRIGIDA - IDs corretos e verificações de segurança

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
        
        // Expor funções globalmente para os onclick
        window.abrirModalNovaMedicao = () => medicoesManager.abrirModalNovaMedicao();
        window.fecharModalMedicao = () => medicoesManager.fecharModalMedicao();
        window.abrirModalObras = () => medicoesManager.abrirModalObras();
        window.fecharModalObras = () => medicoesManager.fecharModalObras();
        window.abrirModalValor = () => medicoesManager.abrirModalValor();
        window.fecharModalValor = () => medicoesManager.fecharModalValor();
        window.selecionarObra = (obraId) => medicoesManager.selecionarObra(obraId);
        window.salvarMedicao = (event) => medicoesManager.salvarMedicao(event);
        window.confirmarESalvarMedicao = () => medicoesManager.confirmarESalvarMedicao();
        window.editarMedicao = (medicaoId) => medicoesManager.editarMedicao(medicaoId);
        window.excluirMedicao = (medicaoId) => medicoesManager.excluirMedicao(medicaoId);
        window.limparFiltros = () => medicoesManager.limparFiltros();
        window.atualizarCalculos = () => medicoesManager.atualizarCalculos();
        
    } else {
        console.error('Erro: Supabase não disponível');
        showNotification('Erro de conexão com o banco de dados', 'error');
    }
}

class MedicoesManager {
    constructor() {
        console.log('Inicializando MedicoesManager...');
        this.obras = [];
        this.medicoes = [];
        this.servicosObra = [];
        this.obraSelecionada = null;
        this.valorTotalCalculado = 0;
        
        this.init();
    }

    async init() {
        try {
            await this.loadObras();
            await this.loadMedicoes();
            this.setupEventListeners();
            console.log('MedicoesManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar MedicoesManager:', error);
            this.showNotification('Erro ao inicializar aplicação: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        // Filtros
        const filtroObra = document.getElementById('filtro-obra');
        const filtroStatus = document.getElementById('filtro-status');
        const filtroData = document.getElementById('filtro-data');
        
        if (filtroObra) filtroObra.addEventListener('change', () => this.aplicarFiltros());
        if (filtroStatus) filtroStatus.addEventListener('change', () => this.aplicarFiltros());
        if (filtroData) filtroData.addEventListener('change', () => this.aplicarFiltros());
        
        // Busca de obras
        const searchObras = document.getElementById('search-obras');
        if (searchObras) {
            searchObras.addEventListener('input', (e) => this.filtrarObras(e.target.value));
        }
    }

    // ========================================
    // UTILITÁRIO PARA VERIFICAR ELEMENTOS
    // ========================================
    
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Elemento com ID '${id}' não encontrado`);
        }
        return element;
    }

    // ========================================
    // CARREGAMENTO DE DADOS - VERSÃO SIMPLIFICADA
    // ========================================

    async loadObras() {
        try {
            console.log('Carregando obras...');
            
            // Buscar obras simples primeiro
            const { data: obras, error: obrasError } = await supabaseClient
                .from('obras_hvc')
                .select('*')
                .eq('status', 'Andamento')
                .order('numero_obra');

            if (obrasError) throw obrasError;

            // Buscar clientes separadamente
            const { data: clientes, error: clientesError } = await supabaseClient
                .from('clientes_hvc')
                .select('*');

            if (clientesError) throw clientesError;

            // Combinar dados manualmente
            this.obras = (obras || []).map(obra => {
                const cliente = clientes.find(c => c.id === obra.cliente_id);
                return {
                    ...obra,
                    clientes_hvc: cliente || { nome: 'Cliente não encontrado' }
                };
            });

            console.log('Obras carregadas:', this.obras.length);
            
            this.populateObrasFilter();
            this.renderObrasModal();
            
        } catch (error) {
            console.error('Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    async loadMedicoes() {
        try {
            console.log('Carregando medições...');
            
            // Buscar medições simples primeiro
            const { data: medicoes, error: medicoesError } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .order('created_at', { ascending: false });

            if (medicoesError) throw medicoesError;

            // Buscar obras e clientes separadamente
            const { data: obras, error: obrasError } = await supabaseClient
                .from('obras_hvc')
                .select('*');

            if (obrasError) throw obrasError;

            const { data: clientes, error: clientesError } = await supabaseClient
                .from('clientes_hvc')
                .select('*');

            if (clientesError) throw clientesError;

            // Combinar dados manualmente
            this.medicoes = (medicoes || []).map(medicao => {
                const obra = obras.find(o => o.id === medicao.obra_id);
                const cliente = obra ? clientes.find(c => c.id === obra.cliente_id) : null;
                
                return {
                    ...medicao,
                    obras_hvc: {
                        ...obra,
                        clientes_hvc: cliente || { nome: 'Cliente não encontrado' }
                    }
                };
            });

            console.log('Medições carregadas:', this.medicoes.length);
            
            this.renderMedicoes();
            
        } catch (error) {
            console.error('Erro ao carregar medições:', error);
            this.showNotification('Erro ao carregar medições: ' + error.message, 'error');
        }
    }

    async loadServicosObra(obraId) {
        try {
            console.log('Carregando serviços da obra:', obraId);
            
            // Buscar propostas da obra via tabela obras_propostas
            const { data: obrasPropostas, error: opError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            if (opError) throw opError;

            if (!obrasPropostas || obrasPropostas.length === 0) {
                this.showNotification('Nenhuma proposta encontrada para esta obra', 'warning');
                return [];
            }

            // Buscar propostas separadamente
            const propostaIds = obrasPropostas.map(op => op.proposta_id);
            const { data: propostas, error: propError } = await supabaseClient
                .from('propostas_hvc')
                .select('*')
                .in('id', propostaIds)
                .in('status', ['Aprovada', 'contratada']);

            if (propError) throw propError;

            if (!propostas || propostas.length === 0) {
                this.showNotification('Nenhuma proposta aprovada encontrada para esta obra', 'warning');
                return [];
            }

            // Usar RPC para buscar serviços (mais confiável)
            const { data: servicos, error: servicosError } = await supabaseClient
                .rpc('buscar_servicos_disponiveis_medicao', { obra_id_param: obraId });

            if (servicosError) throw servicosError;

            console.log('Serviços carregados:', servicos?.length || 0);
            
            // DEBUG TEMPORÁRIO - INÍCIO
            console.log('🔍 DEBUG - Dados dos serviços retornados:');
            console.log('📊 Quantidade de serviços:', servicos?.length || 0);
            console.log('📋 Lista completa dos serviços:', servicos);
            if (servicos && servicos.length > 0) {
                servicos.forEach((servico, index) => {
                    console.log(`🔧 Serviço ${index + 1}:`, {
                        id: servico.servico_id,
                        codigo: servico.servico_codigo,
                        descricao: servico.servico_descricao,
                        unidade: servico.unidade,
                        quantidade_produzida: servico.quantidade_produzida,
                        quantidade_disponivel: servico.quantidade_disponivel,
                        valor_unitario: servico.valor_unitario_contratado
                    });
                });
            }
            // DEBUG TEMPORÁRIO - FIM
            
            return servicos || [];
            
        } catch (error) {
            console.error('Erro ao carregar serviços da obra:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
            return [];
        }
    }

    // ========================================
    // MODAIS - COM VERIFICAÇÕES DE SEGURANÇA
    // ========================================

    abrirModalNovaMedicao() {
        console.log('Abrindo modal de nova medição...');
        
        // Verificar e limpar formulário
        const dataMedicao = this.getElement('data-medicao');
        const observacoes = this.getElement('observacoes-medicao');
        
        if (dataMedicao) {
            dataMedicao.value = new Date().toISOString().split('T')[0];
        }
        
        if (observacoes) {
            observacoes.value = '';
        }
        
        // Resetar seleções
        this.obraSelecionada = null;
        this.servicosObra = [];
        this.valorTotalCalculado = 0;
        
        // Resetar interface
        const obraContainer = this.getElement('obra-selecionada-container');
        if (obraContainer) {
            obraContainer.innerHTML = `
                <button type="button" class="btn-secondary" onclick="abrirModalObras()">
                    <i class="fas fa-building"></i>
                    Selecionar Obra
                </button>
            `;
        }
        
        // Esconder container de serviços
        const servicosContainer = this.getElement('servicos-container');
        if (servicosContainer) {
            servicosContainer.style.display = 'none';
        }
        
        // Mostrar modal - USANDO ID CORRETO
        const modal = this.getElement('modal-medicao');
        if (modal) {
            modal.style.display = 'block';
            console.log('✅ Modal aberto com sucesso');
        } else {
            console.error('❌ Modal não encontrado - ID: modal-medicao');
        }
    }

    fecharModalMedicao() {
        const modal = this.getElement('modal-medicao');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    abrirModalObras() {
        this.renderObrasModal();
        const modal = this.getElement('modal-obras');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    fecharModalObras() {
        const modal = this.getElement('modal-obras');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    abrirModalValor() {
        // Calcular valor total
        this.calcularValorTotal();
        
        // Atualizar interface
        const valorCalculado = this.getElement('valor-calculado');
        const valorAjustado = this.getElement('valor-ajustado');
        const motivoAjuste = this.getElement('motivo-ajuste');
        
        if (valorCalculado) {
            valorCalculado.textContent = this.formatarMoeda(this.valorTotalCalculado);
        }
        
        if (valorAjustado) {
            valorAjustado.value = this.valorTotalCalculado.toFixed(2);
        }
        
        if (motivoAjuste) {
            motivoAjuste.value = '';
        }
        
        // Mostrar modal
        const modal = this.getElement('modal-confirmar-valor');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    fecharModalValor() {
        const modal = this.getElement('modal-confirmar-valor');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ========================================
    // SELEÇÃO DE OBRA
    // ========================================

    async selecionarObra(obraId) {
        try {
            console.log('Selecionando obra:', obraId);
            
            // Encontrar a obra
            const obra = this.obras.find(o => o.id === obraId);
            if (!obra) {
                this.showNotification('Obra não encontrada', 'error');
                return;
            }
            
            this.obraSelecionada = obra;
            
            // Atualizar interface
            const obraContainer = this.getElement('obra-selecionada-container');
            if (obraContainer) {
                obraContainer.innerHTML = `
                    <div class="obra-selecionada">
                        <div class="obra-info">
                            <div>
                                <div class="obra-nome">${obra.numero_obra}</div>
                                <div class="obra-cliente">${obra.clientes_hvc.nome}</div>
                            </div>
                            <button type="button" class="btn-secondary" onclick="abrirModalObras()">
                                <i class="fas fa-edit"></i>
                                Alterar
                            </button>
                        </div>
                    </div>
                `;
            }
            
            // Carregar serviços da obra
            this.showLoading();
            this.servicosObra = await this.loadServicosObra(obraId);
            
            // DEBUG TEMPORÁRIO - INÍCIO
            console.log('🎯 DEBUG - Verificando this.servicosObra após carregamento:');
            console.log('📦 this.servicosObra existe?', !!this.servicosObra);
            console.log('📊 Quantidade em this.servicosObra:', this.servicosObra?.length || 0);
            console.log('📋 Conteúdo de this.servicosObra:', this.servicosObra);
            // DEBUG TEMPORÁRIO - FIM
            
            this.hideLoading();
            
            // Renderizar serviços
            await this.renderServicos();
            
            // Mostrar container de serviços
            const servicosContainer = this.getElement('servicos-container');
            if (servicosContainer) {
                servicosContainer.style.display = 'block';
            }
            
            // Fechar modal de obras
            this.fecharModalObras();
            
            this.showNotification('Obra selecionada com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao selecionar obra:', error);
            this.showNotification('Erro ao selecionar obra: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    // ========================================
    // RENDERIZAÇÃO
    // ========================================

    renderMedicoes() {
        const tbody = this.getElement('medicoes-list');
        if (!tbody) return;

        if (this.medicoes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #b0c4de; padding: 2rem;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma medição cadastrada
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.medicoes.map(medicao => `
            <tr>
                <td><strong>${medicao.numero}</strong></td>
                <td>
                    <div>${medicao.obras_hvc.numero_obra}</div>
                    <small style="color: #b0c4de;">${medicao.obras_hvc.clientes_hvc.nome}</small>
                </td>
                <td>${this.formatarData(medicao.data_medicao)}</td>
                <td><strong>${this.formatarMoeda(medicao.valor_ajustado || medicao.valor_total)}</strong></td>
                <td>
                    <span class="badge badge-${this.getStatusColor(medicao.status)}">
                        ${this.getStatusText(medicao.status)}
                    </span>
                </td>
                <td>
                    <button class="btn-secondary" onclick="editarMedicao('${medicao.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="excluirMedicao('${medicao.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderObrasModal() {
        const container = this.getElement('obras-list');
        if (!container) return;

        if (this.obras.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #b0c4de;">
                    <i class="fas fa-building" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma obra ativa encontrada
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Nome da Obra</th>
                        <th>Cliente</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.obras.map(obra => `
                        <tr>
                            <td><strong>${obra.numero_obra}</strong></td>
                            <td>${obra.clientes_hvc.nome}</td>
                            <td>
                                <button class="btn-primary" onclick="selecionarObra('${obra.id}')">
                                    <i class="fas fa-check"></i>
                                    Selecionar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async renderServicos() {
        // DEBUG TEMPORÁRIO - INÍCIO
        console.log('🖼️ DEBUG - Iniciando renderização dos serviços:');
        console.log('📦 this.servicosObra existe?', !!this.servicosObra);
        console.log('📊 Quantidade para renderizar:', this.servicosObra?.length || 0);
        console.log('🎯 Elemento servicos-list encontrado?', !!this.getElement('servicos-list'));
        
        const servicosContainer = this.getElement('servicos-list');
        if (servicosContainer) {
            console.log('✅ Container de serviços encontrado');
            console.log('📍 Conteúdo atual do container:', servicosContainer.innerHTML);
        } else {
            console.log('❌ Container de serviços NÃO encontrado');
        }
        // DEBUG TEMPORÁRIO - FIM

        const container = this.getElement('servicos-list');
        if (!container) {
            console.log('❌ ERRO: Container servicos-list não encontrado no DOM');
            return;
        }

        if (!this.servicosObra || this.servicosObra.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #b0b4e0; padding: 2rem;">
                    <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhum serviço disponível para medição
                </div>
            `;
            return;
        }

        container.innerHTML = this.servicosObra.map(servico => `
            <div class="servico-item">
                <div class="servico-header">
                    <div>
                        <div class="servico-nome">${servico.servico_descricao}</div>
                        <div class="servico-codigo">Código: ${servico.servico_codigo}</div>
                    </div>
                </div>
                
                <div class="servico-valores">
                    <div class="valor-item valor-contratado">
                        <div class="valor-label">Valor Unitário</div>
                        <div class="valor-numero">${this.formatarMoeda(servico.valor_unitario_contratado || 0)}</div>
                    </div>
                    <div class="valor-item valor-produzido">
                        <div class="valor-label">Produzido</div>
                        <div class="valor-numero">${servico.quantidade_produzida || 0} ${servico.unidade || ''}</div>
                    </div>
                    <div class="valor-item valor-medido">
                        <div class="valor-label">Já Medido</div>
                        <div class="valor-numero">${servico.quantidade_ja_medida || 0} ${servico.unidade || ''}</div>
                    </div>
                    <div class="valor-item valor-disponivel">
                        <div class="valor-label">Disponível</div>
                        <div class="valor-numero">${servico.quantidade_disponivel || 0} ${servico.unidade || ''}</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Quantidade a Medir</label>
                    <input type="number" 
                           id="medicao-${servico.servico_id}"
                           class="input-medicao" 
                           min="0" 
                           max="${servico.quantidade_disponivel || 0}"
                           step="0.01"
                           placeholder="Digite a quantidade..."
                           onchange="atualizarCalculos()">
                </div>
            </div>
        `).join('');
        
        console.log('✅ Serviços renderizados com sucesso!');
    }

    // ========================================
    // CÁLCULOS
    // ========================================

    calcularValorTotal() {
        this.valorTotalCalculado = 0;
        
        this.servicosObra.forEach(servico => {
            const input = this.getElement(`medicao-${servico.servico_id}`);
            if (input && input.value) {
                const quantidade = parseFloat(input.value);
                if (quantidade > 0) {
                    this.valorTotalCalculado += quantidade * servico.valor_unitario_contratado;
                }
            }
        });
        
        return this.valorTotalCalculado;
    }

    atualizarCalculos() {
        this.calcularValorTotal();
        console.log('Valor total calculado:', this.valorTotalCalculado);
    }

    // ========================================
    // FILTROS
    // ========================================

    populateObrasFilter() {
        const select = this.getElement('filtro-obra');
        if (!select) return;
        
        select.innerHTML = '<option value="">Todas as obras</option>';
        this.obras.forEach(obra => {
            select.innerHTML += `<option value="${obra.id}">${obra.numero_obra}</option>`;
        });
    }

    aplicarFiltros() {
        console.log('Aplicando filtros...');
    }

    limparFiltros() {
        console.log('Limpando filtros...');
    }

    filtrarObras(termo) {
        const obrasFiltradas = this.obras.filter(obra => 
            obra.numero_obra.toLowerCase().includes(termo.toLowerCase()) ||
            obra.clientes_hvc.nome.toLowerCase().includes(termo.toLowerCase())
        );
        
        this.renderObrasModalFiltradas(obrasFiltradas);
    }

    renderObrasModalFiltradas(obras) {
        const container = this.getElement('obras-list');
        if (!container) return;

        if (obras.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #b0c4de;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma obra encontrada
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Nome da Obra</th>
                        <th>Cliente</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${obras.map(obra => `
                        <tr>
                            <td><strong>${obra.numero_obra}</strong></td>
                            <td>${obra.clientes_hvc.nome}</td>
                            <td>
                                <button class="btn-primary" onclick="selecionarObra('${obra.id}')">
                                    <i class="fas fa-check"></i>
                                    Selecionar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // ========================================
    // SALVAMENTO (SIMPLIFICADO)
    // ========================================

    async salvarMedicao(event) {
        event.preventDefault();
        console.log('Função salvar medição chamada - implementar conforme necessário');
        this.showNotification('Funcionalidade de salvamento em desenvolvimento', 'info');
    }

    async editarMedicao(medicaoId) {
        console.log('Função editar medição chamada - implementar conforme necessário');
        this.showNotification('Funcionalidade de edição em desenvolvimento', 'info');
    }

    async excluirMedicao(medicaoId) {
        console.log('Função excluir medição chamada - implementar conforme necessário');
        this.showNotification('Funcionalidade de exclusão em desenvolvimento', 'info');
    }

    // ========================================
    // UTILITÁRIOS
    // ========================================

    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    }

    formatarData(data) {
        return new Date(data).toLocaleDateString('pt-BR');
    }

    getStatusColor(status) {
        const cores = {
            'rascunho': 'warning',
            'aprovada': 'success',
            'paga': 'info'
        };
        return cores[status] || 'secondary';
    }

    getStatusText(status) {
        const textos = {
            'rascunho': 'Rascunho',
            'aprovada': 'Aprovada',
            'paga': 'Paga'
        };
        return textos[status] || status;
    }

    showLoading() {
        console.log('Loading...');
    }

    hideLoading() {
        console.log('Loading finished');
    }

    showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Adicionar ao DOM
        document.body.appendChild(notification);
        
        // Remover após 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

