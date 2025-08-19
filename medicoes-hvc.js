// Gerenciamento completo de medições com obras, serviços e cálculos automáticos
// VERSÃO FINAL - Com salvamento e valor total em tempo real

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
    // CARREGAMENTO DE DADOS
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
            console.log('🚀 Buscando serviços da produção diária da obra:', obraId);
            
            // 1. Buscar produções diárias para encontrar TODOS os serviços com produção
            const { data: producoes, error: prodError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('quantidades_servicos')
                .eq('obra_id', obraId);

            if (prodError) {
                console.error('Erro ao buscar produções:', prodError);
                return [];
            }

            if (!producoes || producoes.length === 0) {
                this.showNotification('Nenhuma produção encontrada para esta obra', 'warning');
                return [];
            }

            // 2. Extrair TODOS os IDs de serviços que têm produção
            const servicosComProducao = new Set();
            const quantidadesPorServico = {};

            producoes.forEach(producao => {
                const quantidades = producao.quantidades_servicos || {};
                Object.keys(quantidades).forEach(servicoId => {
                    servicosComProducao.add(servicoId);
                    if (!quantidadesPorServico[servicoId]) {
                        quantidadesPorServico[servicoId] = 0;
                    }
                    quantidadesPorServico[servicoId] += parseFloat(quantidades[servicoId] || 0);
                });
            });

            if (servicosComProducao.size === 0) {
                this.showNotification('Nenhum serviço com produção encontrado', 'warning');
                return [];
            }

            // 3. Buscar dados dos serviços
            const servicoIds = Array.from(servicosComProducao);
            const { data: servicos, error: servicosError } = await supabaseClient
                .from('servicos_hvc')
                .select('*')
                .in('id', servicoIds);

            if (servicosError) throw servicosError;

            // 4. Buscar valores das propostas
            const { data: obrasPropostas, error: opError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            let itensPropostas = [];
            if (!opError && obrasPropostas && obrasPropostas.length > 0) {
                const propostaIds = obrasPropostas.map(op => op.proposta_id);
                
                const { data: propostas, error: propError } = await supabaseClient
                    .from('propostas_hvc')
                    .select('*')
                    .in('id', propostaIds)
                    .in('status', ['Aprovada', 'contratada']);

                if (!propError && propostas && propostas.length > 0) {
                    const propostasAprovadas = propostas.map(p => p.id);
                    const { data: itens, error: itensError } = await supabaseClient
                        .from('itens_proposta_hvc')
                        .select('*')
                        .in('proposta_id', propostasAprovadas)
                        .in('servico_id', servicoIds);

                    if (!itensError) {
                        itensPropostas = itens || [];
                    }
                }
            }

            // 5. Buscar medições anteriores
            const { data: medicoesAnteriores, error: medError } = await supabaseClient
                .from('medicoes_hvc')
                .select('id')
                .eq('obra_id', obraId);

            let servicosMedidos = [];
            if (!medError && medicoesAnteriores && medicoesAnteriores.length > 0) {
                const medicaoIds = medicoesAnteriores.map(m => m.id);
                const { data: servMedidos, error: servMedError } = await supabaseClient
                    .from('medicoes_servicos')
                    .select('*')
                    .in('medicao_id', medicaoIds)
                    .in('servico_id', servicoIds);

                if (!servMedError) {
                    servicosMedidos = servMedidos || [];
                }
            }

            // 6. Combinar TODOS os dados
            const servicosCompletos = servicos.map(servico => {
                // Buscar valores da proposta
                const itemProposta = itensPropostas.find(ip => ip.servico_id === servico.id);
                
                let valorUnitario = 0;
                let quantidadeContratada = 0;
                let totalContratado = 0;

                if (itemProposta) {
                    const precoMaoObra = parseFloat(itemProposta.preco_mao_obra || 0);
                    const precoMaterial = parseFloat(itemProposta.preco_material || 0);
                    valorUnitario = precoMaoObra + precoMaterial;
                    quantidadeContratada = parseFloat(itemProposta.quantidade || 0);
                    totalContratado = quantidadeContratada * valorUnitario;
                }

                // Quantidade produzida
                const quantidadeProduzida = quantidadesPorServico[servico.id] || 0;

                // Calcular quantidade já medida
                let quantidadeJaMedida = 0;
                servicosMedidos.forEach(sm => {
                    if (sm.servico_id === servico.id) {
                        quantidadeJaMedida += parseFloat(sm.quantidade_medida || 0);
                    }
                });

                // Calcular quantidade disponível
                const quantidadeDisponivel = Math.max(0, quantidadeProduzida - quantidadeJaMedida);

                return {
                    servico_id: servico.id,
                    servico_codigo: servico.codigo,
                    servico_descricao: servico.descricao,
                    unidade: servico.unidade,
                    valor_unitario_contratado: valorUnitario,
                    quantidade_contratada: quantidadeContratada,
                    total_contratado: totalContratado,
                    quantidade_produzida: quantidadeProduzida,
                    quantidade_ja_medida: quantidadeJaMedida,
                    quantidade_disponivel: quantidadeDisponivel
                };
            });

            console.log('🎉 Serviços processados:', servicosCompletos.length);
            return servicosCompletos || [];
            
        } catch (error) {
            console.error('Erro ao carregar serviços da obra:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
            return [];
        }
    }

    // ========================================
    // MODAIS
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
        
        // Resetar valor total
        this.atualizarExibicaoValorTotal();
        
        // Mostrar modal
        const modal = this.getElement('modal-medicao');
        if (modal) {
            modal.style.display = 'block';
            console.log('✅ Modal aberto com sucesso');
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
        const container = this.getElement('servicos-list');
        if (!container) return;

        if (!this.servicosObra || this.servicosObra.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #b0b4e0; padding: 2rem;">
                    <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhum serviço encontrado para esta obra
                </div>
            `;
            return;
        }

        // Adicionar área do valor total antes da tabela
        const valorTotalHtml = `
            <div id="valor-total-container" style="background: rgba(173, 216, 230, 0.1); padding: 1rem; margin-bottom: 1rem; border-radius: 8px; text-align: center;">
                <div style="color: #add8e6; font-size: 1.2rem; font-weight: 600;">
                    Valor Total da Medição: <span id="valor-total-display" style="color: #ffd700;">${this.formatarMoeda(0)}</span>
                </div>
            </div>
        `;

        // Renderizar tabela de serviços
        container.innerHTML = valorTotalHtml + `
            <table class="table" style="width: 100%; margin-top: 1rem;">
                <thead>
                    <tr style="background: rgba(173, 216, 230, 0.1);">
                        <th style="padding: 1rem; text-align: left; color: #add8e6; font-weight: 600;">Código</th>
                        <th style="padding: 1rem; text-align: center; color: #add8e6; font-weight: 600;">Total Contratado</th>
                        <th style="padding: 1rem; text-align: center; color: #add8e6; font-weight: 600;">Total Produzido</th>
                        <th style="padding: 1rem; text-align: center; color: #add8e6; font-weight: 600;">Total Medido</th>
                        <th style="padding: 1rem; text-align: center; color: #add8e6; font-weight: 600;">Quantidade a Medir</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.servicosObra.map(servico => {
                        const disponivel = servico.quantidade_disponivel > 0;
                        const temProposta = servico.valor_unitario_contratado > 0;
                        
                        return `
                        <tr style="border-bottom: 1px solid rgba(173, 216, 230, 0.2);">
                            <td style="padding: 1rem;">
                                <div style="color: #add8e6; font-weight: 600; margin-bottom: 0.25rem;">
                                    ${servico.servico_codigo}
                                </div>
                                <div style="color: #b0c4de; font-size: 0.9rem;">
                                    ${servico.servico_descricao}
                                </div>
                                <div style="color: #87ceeb; font-size: 0.8rem; margin-top: 0.25rem;">
                                    ${temProposta ? 
                                        `Valor unitário: ${this.formatarMoeda(servico.valor_unitario_contratado)}` : 
                                        '⚠️ Sem valor na proposta'
                                    }
                                </div>
                            </td>
                            <td style="padding: 1rem; text-align: center;">
                                ${temProposta ? `
                                <div style="color: #add8e6; font-weight: 600;">
                                    ${servico.quantidade_contratada || 0} ${servico.unidade || ''}
                                </div>
                                <div style="color: #87ceeb; font-size: 0.8rem;">
                                    ${this.formatarMoeda(servico.total_contratado || 0)}
                                </div>
                                ` : `
                                <div style="color: #ff6b6b; font-size: 0.8rem;">
                                    Não contratado
                                </div>
                                `}
                            </td>
                            <td style="padding: 1rem; text-align: center;">
                                <div style="color: #ffd700; font-weight: 600;">
                                    ${servico.quantidade_produzida || 0} ${servico.unidade || ''}
                                </div>
                            </td>
                            <td style="padding: 1rem; text-align: center;">
                                <div style="color: #90ee90; font-weight: 600;">
                                    ${servico.quantidade_ja_medida || 0} ${servico.unidade || ''}
                                </div>
                            </td>
                            <td style="padding: 1rem; text-align: center;">
                                ${disponivel ? `
                                <input type="number" 
                                       id="medicao-${servico.servico_id}"
                                       data-valor-unitario="${servico.valor_unitario_contratado}"
                                       style="width: 120px; padding: 0.5rem; border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: #add8e6; text-align: center;"
                                       min="0" 
                                       max="${servico.quantidade_disponivel || 0}"
                                       step="0.01"
                                       placeholder="0.00"
                                       oninput="atualizarCalculos()">
                                <div style="color: #87ceeb; font-size: 0.8rem; margin-top: 0.25rem;">
                                    Disponível: ${servico.quantidade_disponivel || 0} ${servico.unidade || ''}
                                </div>
                                ` : `
                                <div style="color: #ff6b6b; font-weight: 600;">
                                    Não disponível
                                </div>
                                <div style="color: #87ceeb; font-size: 0.8rem; margin-top: 0.25rem;">
                                    Disponível: ${servico.quantidade_disponivel || 0} ${servico.unidade || ''}
                                </div>
                                `}
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
        
        // Atualizar valor total inicial
        this.atualizarExibicaoValorTotal();
        
        console.log('✅ Todos os serviços renderizados com sucesso!');
    }

    // ========================================
    // CÁLCULOS E VALOR TOTAL EM TEMPO REAL
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
        this.atualizarExibicaoValorTotal();
        console.log('Valor total calculado:', this.valorTotalCalculado);
    }

    atualizarExibicaoValorTotal() {
        const display = this.getElement('valor-total-display');
        if (display) {
            display.textContent = this.formatarMoeda(this.valorTotalCalculado);
            
            // Animação de destaque quando valor muda
            display.style.transform = 'scale(1.1)';
            display.style.transition = 'transform 0.2s ease';
            setTimeout(() => {
                display.style.transform = 'scale(1)';
            }, 200);
        }
    }

    // ========================================
    // SALVAMENTO DA MEDIÇÃO - IMPLEMENTAÇÃO COMPLETA
    // ========================================

    async salvarMedicao(event) {
        event.preventDefault();
        
        try {
            console.log('💾 Iniciando salvamento da medição...');
            
            // Validações
            if (!this.obraSelecionada) {
                this.showNotification('Selecione uma obra antes de salvar', 'error');
                return;
            }

            const dataMedicao = this.getElement('data-medicao');
            if (!dataMedicao || !dataMedicao.value) {
                this.showNotification('Informe a data da medição', 'error');
                return;
            }

            // Coletar serviços com quantidades
            const servicosParaMedir = [];
            let temServicos = false;

            this.servicosObra.forEach(servico => {
                const input = this.getElement(`medicao-${servico.servico_id}`);
                if (input && input.value) {
                    const quantidade = parseFloat(input.value);
                    if (quantidade > 0) {
                        servicosParaMedir.push({
                            servico_id: servico.servico_id,
                            quantidade_medida: quantidade,
                            valor_unitario: servico.valor_unitario_contratado,
                            valor_total: quantidade * servico.valor_unitario_contratado
                        });
                        temServicos = true;
                    }
                }
            });

            if (!temServicos) {
                this.showNotification('Informe pelo menos uma quantidade para medir', 'error');
                return;
            }

            // Calcular valor total
            this.calcularValorTotal();

            // Gerar número da medição
            const numeroMedicao = await this.gerarNumeroMedicao();

            // Preparar dados da medição
            const observacoes = this.getElement('observacoes-medicao');
            const dadosMedicao = {
                numero: numeroMedicao,
                obra_id: this.obraSelecionada.id,
                data_medicao: dataMedicao.value,
                valor_total: this.valorTotalCalculado,
                valor_ajustado: this.valorTotalCalculado,
                observacoes: observacoes ? observacoes.value : '',
                status: 'rascunho',
                created_at: new Date().toISOString()
            };

            console.log('📋 Dados da medição:', dadosMedicao);
            console.log('📋 Serviços para medir:', servicosParaMedir);

            this.showLoading();

            // 1. Salvar medição principal
            const { data: medicaoSalva, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .insert([dadosMedicao])
                .select()
                .single();

            if (medicaoError) throw medicaoError;

            console.log('✅ Medição salva:', medicaoSalva);

            // 2. Salvar serviços da medição
            const servicosComMedicaoId = servicosParaMedir.map(servico => ({
                ...servico,
                medicao_id: medicaoSalva.id
            }));

            const { error: servicosError } = await supabaseClient
                .from('medicoes_servicos')
                .insert(servicosComMedicaoId);

            if (servicosError) throw servicosError;

            console.log('✅ Serviços da medição salvos');

            this.hideLoading();

            // Sucesso!
            this.showNotification(`Medição ${numeroMedicao} salva com sucesso!`, 'success');
            
            // Recarregar medições
            await this.loadMedicoes();
            
            // Fechar modal
            this.fecharModalMedicao();

        } catch (error) {
            console.error('❌ Erro ao salvar medição:', error);
            this.hideLoading();
            this.showNotification('Erro ao salvar medição: ' + error.message, 'error');
        }
    }

    async gerarNumeroMedicao() {
        try {
            // Buscar última medição para gerar número sequencial
            const { data: ultimaMedicao, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('numero')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            let proximoNumero = 1;
            if (ultimaMedicao && ultimaMedicao.length > 0) {
                const ultimoNumero = ultimaMedicao[0].numero;
                // Extrair número da string (ex: "MED-001" -> 1)
                const match = ultimoNumero.match(/(\d+)$/);
                if (match) {
                    proximoNumero = parseInt(match[1]) + 1;
                }
            }

            // Formatar número com zeros à esquerda
            return `MED-${proximoNumero.toString().padStart(3, '0')}`;

        } catch (error) {
            console.error('Erro ao gerar número da medição:', error);
            // Fallback: usar timestamp
            return `MED-${Date.now()}`;
        }
    }

    async confirmarESalvarMedicao() {
        // Esta função pode ser usada para confirmar valores antes de salvar
        this.fecharModalValor();
        // Aqui poderia implementar lógica adicional de confirmação
        console.log('Medição confirmada e pronta para salvar');
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
    // EDIÇÃO E EXCLUSÃO (PLACEHOLDER)
    // ========================================

    async editarMedicao(medicaoId) {
        console.log('Função editar medição chamada - implementar conforme necessário');
        this.showNotification('Funcionalidade de edição em desenvolvimento', 'info');
    }

    async excluirMedicao(medicaoId) {
        if (confirm('Tem certeza que deseja excluir esta medição?')) {
            try {
                // Excluir serviços da medição primeiro
                const { error: servicosError } = await supabaseClient
                    .from('medicoes_servicos')
                    .delete()
                    .eq('medicao_id', medicaoId);

                if (servicosError) throw servicosError;

                // Excluir medição
                const { error: medicaoError } = await supabaseClient
                    .from('medicoes_hvc')
                    .delete()
                    .eq('id', medicaoId);

                if (medicaoError) throw medicaoError;

                this.showNotification('Medição excluída com sucesso!', 'success');
                await this.loadMedicoes();

            } catch (error) {
                console.error('Erro ao excluir medição:', error);
                this.showNotification('Erro ao excluir medição: ' + error.message, 'error');
            }
        }
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

