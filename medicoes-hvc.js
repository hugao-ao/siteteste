// Gerenciamento completo de medições com obras, serviços e cálculos automáticos
// VERSÃO CORRIGIDA - Consultas SQL ajustadas para relacionamentos corretos

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
    // CARREGAMENTO DE DADOS
    // ========================================

    async loadObras() {
        try {
            console.log('Carregando obras...');
            
            // CONSULTA CORRIGIDA: Buscar obras com status 'Andamento' e seus clientes
            const { data: obras, error } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    clientes_hvc!inner (
                        id,
                        nome
                    )
                `)
                .eq('status', 'Andamento')
                .order('numero_obra');

            if (error) throw error;

            this.obras = obras || [];
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
            
            // CONSULTA CORRIGIDA: Buscar medições com obras e clientes
            const { data: medicoes, error } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    obras_hvc!inner (
                        id,
                        numero_obra,
                        clientes_hvc!inner (
                            id,
                            nome
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Processar dados para estrutura correta
            const medicoesCompletas = [];
            if (medicoes) {
                medicoes.forEach(medicao => {
                    // Verificar se a estrutura está correta
                    if (medicao.obras_hvc && medicao.obras_hvc.clientes_hvc) {
                        medicoesCompletas.push({
                            ...medicao,
                            obras_hvc: {
                                ...medicao.obras_hvc,
                                clientes_hvc: medicao.obras_hvc.clientes_hvc
                            }
                        });
                    }
                });
            }

            this.medicoes = medicoesCompletas;
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
                                    .select(`
                                        propostas_hvc (
                                            id,
                                            status
                                        )
                                    `)
                                    .eq('obra_id', obraId);
                        
                                if (opError) throw opError;
                        
                                if (!obrasPropostas || obrasPropostas.length === 0) {
                                    this.showNotification('Nenhuma proposta encontrada para esta obra', 'warning');
                                    return [];
                                }
                        
                                // Filtrar propostas contratadas/aprovadas
                                const propostasContratadas = obrasPropostas
                                    .map(op => op.propostas_hvc)
                                    .filter(prop => prop && (prop.status === 'Aprovada' || prop.status === 'contratada'));
                        
                                if (propostasContratadas.length === 0) {
                                    this.showNotification('Nenhuma proposta aprovada encontrada para esta obra', 'warning');
                                    return [];
                                }
                        
                                const propostaId = propostasContratadas[0].id;
                        
                                // Buscar serviços da proposta
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


    async calcularQuantidadesServicos(obraId) {
        try {
            console.log('Calculando quantidades produzidas e medidas...');

            // Para cada serviço, calcular quantidades
            for (let servico of this.servicosObra) {
                // 1. TOTAL PRODUZIDO - das produções diárias
                const { data: producoes, error: prodError } = await supabaseClient
                    .from('producoes_diarias_hvc')
                    .select('quantidades_servicos')
                    .eq('obra_id', obraId);

                if (prodError) {
                    console.warn('Erro ao buscar produções:', prodError);
                    servico.quantidade_produzida = 0;
                } else {
                    let totalProduzido = 0;
                    producoes.forEach(producao => {
                        const quantidades = producao.quantidades_servicos || {};
                        if (quantidades[servico.servico_id]) {
                            totalProduzido += parseFloat(quantidades[servico.servico_id]);
                        }
                    });
                    servico.quantidade_produzida = totalProduzido;
                }

                // 2. TOTAL JÁ MEDIDO - das medições anteriores
                // CONSULTA CORRIGIDA: Buscar medições da obra primeiro
                const { data: medicoesObra, error: medObrasError } = await supabaseClient
                    .from('medicoes_hvc')
                    .select('id')
                    .eq('obra_id', obraId);

                if (medObrasError) {
                    console.warn('Erro ao buscar medições da obra:', medObrasError);
                    servico.quantidade_ja_medida = 0;
                } else {
                    let totalMedido = 0;
                    
                    if (medicoesObra && medicoesObra.length > 0) {
                        const medicaoIds = medicoesObra.map(m => m.id);
                        
                        // Buscar serviços medidos
                        const { data: servicosMedidos, error: servMedError } = await supabaseClient
                            .from('medicoes_servicos')
                            .select('quantidade_medida')
                            .in('medicao_id', medicaoIds)
                            .eq('servico_id', servico.servico_id);
                        
                        if (!servMedError && servicosMedidos) {
                            totalMedido = servicosMedidos.reduce((sum, sm) => sum + parseFloat(sm.quantidade_medida || 0), 0);
                        }
                    }
                    
                    servico.quantidade_ja_medida = totalMedido;
                }

                // 3. CALCULAR DISPONÍVEL
                servico.quantidade_disponivel = Math.max(0, servico.quantidade_produzida - servico.quantidade_ja_medida);
                
                console.log(`Serviço ${servico.servico_codigo}:`, {
                    produzida: servico.quantidade_produzida,
                    medida: servico.quantidade_ja_medida,
                    disponivel: servico.quantidade_disponivel
                });
            }
            
        } catch (error) {
            console.error('Erro ao calcular quantidades:', error);
        }
    }

    // ========================================
    // MODAIS
    // ========================================

    abrirModalNovaMedicao() {
        console.log('Abrindo modal de nova medição...');
        
        // Limpar formulário
        document.getElementById('data-medicao').value = new Date().toISOString().split('T')[0];
        document.getElementById('observacoes-medicao').value = '';
        
        // Resetar seleções
        this.obraSelecionada = null;
        this.servicosObra = [];
        this.valorTotalCalculado = 0;
        
        // Resetar interface
        const obraContainer = document.getElementById('obra-selecionada-container');
        obraContainer.innerHTML = `
            <button type="button" class="btn-secondary" onclick="abrirModalObras()">
                <i class="fas fa-building"></i>
                Selecionar Obra
            </button>
        `;
        
        // Esconder container de serviços
        document.getElementById('servicos-container').style.display = 'none';
        
        // Mostrar modal
        document.getElementById('modal-nova-medicao').style.display = 'block';
    }

    fecharModalMedicao() {
        document.getElementById('modal-nova-medicao').style.display = 'none';
    }

    abrirModalObras() {
        this.renderObrasModal();
        document.getElementById('modal-obras').style.display = 'block';
    }

    fecharModalObras() {
        document.getElementById('modal-obras').style.display = 'none';
    }

    abrirModalValor() {
        // Calcular valor total
        this.calcularValorTotal();
        
        // Atualizar interface
        document.getElementById('valor-calculado').textContent = this.formatarMoeda(this.valorTotalCalculado);
        document.getElementById('valor-ajustado').value = this.valorTotalCalculado.toFixed(2);
        document.getElementById('motivo-ajuste').value = '';
        
        // Mostrar modal
        document.getElementById('modal-confirmar-valor').style.display = 'block';
    }

    fecharModalValor() {
        document.getElementById('modal-confirmar-valor').style.display = 'none';
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
            const obraContainer = document.getElementById('obra-selecionada-container');
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
            document.getElementById('servicos-container').style.display = 'block';
            
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
        const tbody = document.getElementById('medicoes-list');
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
        const container = document.getElementById('obras-list');
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
    console.log('🎯 Elemento servicos-list encontrado?', !!document.getElementById('servicos-list'));
    
    const servicosContainer = document.getElementById('servicos-list');
    if (servicosContainer) {
        console.log('✅ Container de serviços encontrado');
        console.log('📍 Conteúdo atual do container:', servicosContainer.innerHTML);
    } else {
        console.log('❌ Container de serviços NÃO encontrado');
    }
    // DEBUG TEMPORÁRIO - FIM

    const container = document.getElementById('servicos-list');
    if (!container) return;

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
}


    // ========================================
    // CÁLCULOS
    // ========================================

    calcularValorTotal() {
        this.valorTotalCalculado = 0;
        
        this.servicosObra.forEach(servico => {
            const input = document.getElementById(`medicao-${servico.servico_id}`);
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
    // SALVAMENTO
    // ========================================

    async salvarMedicao(event) {
        event.preventDefault();
        
        try {
            console.log('Salvando medição...');
            
            // Validações
            if (!this.obraSelecionada) {
                this.showNotification('Selecione uma obra', 'error');
                return;
            }
            
            const dataMedicao = document.getElementById('data-medicao').value;
            if (!dataMedicao) {
                this.showNotification('Informe a data da medição', 'error');
                return;
            }
            
            // Verificar se há pelo menos um serviço com quantidade
            const servicosComQuantidade = [];
            this.servicosObra.forEach(servico => {
                const input = document.getElementById(`medicao-${servico.servico_id}`);
                if (input && input.value) {
                    const quantidade = parseFloat(input.value);
                    if (quantidade > 0) {
                        servicosComQuantidade.push({
                            servico_id: servico.servico_id,
                            quantidade_medida: quantidade,
                            valor_unitario: servico.valor_unitario_contratado,
                            valor_total: quantidade * servico.valor_unitario_contratado
                        });
                    }
                }
            });
            
            if (servicosComQuantidade.length === 0) {
                this.showNotification('Informe pelo menos uma quantidade para medir', 'error');
                return;
            }
            
            // Calcular valor total
            this.calcularValorTotal();
            
            // Abrir modal de confirmação de valor
            this.abrirModalValor();
            
        } catch (error) {
            console.error('Erro ao preparar salvamento:', error);
            this.showNotification('Erro ao preparar medição: ' + error.message, 'error');
        }
    }

    async confirmarESalvarMedicao() {
        try {
            this.showLoading();
            
            const dataMedicao = document.getElementById('data-medicao').value;
            const observacoes = document.getElementById('observacoes-medicao').value;
            const valorAjustado = parseFloat(document.getElementById('valor-ajustado').value);
            const motivoAjuste = document.getElementById('motivo-ajuste').value;
            
            // Gerar número da medição
            const numeroMedicao = await this.gerarNumeroMedicao();
            
            // Preparar serviços para salvamento
            const servicosParaSalvar = [];
            this.servicosObra.forEach(servico => {
                const input = document.getElementById(`medicao-${servico.servico_id}`);
                if (input && input.value) {
                    const quantidade = parseFloat(input.value);
                    if (quantidade > 0) {
                        servicosParaSalvar.push({
                            servico_id: servico.servico_id,
                            quantidade_medida: quantidade,
                            valor_unitario: servico.valor_unitario_contratado,
                            valor_total: quantidade * servico.valor_unitario_contratado
                        });
                    }
                }
            });
            
            // Salvar medição principal
            const { data: medicao, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .insert({
                    numero: numeroMedicao,
                    obra_id: this.obraSelecionada.id,
                    data_medicao: dataMedicao,
                    valor_total: this.valorTotalCalculado,
                    valor_ajustado: valorAjustado,
                    motivo_ajuste: motivoAjuste || null,
                    observacoes: observacoes || null,
                    status: 'rascunho'
                })
                .select()
                .single();
                
            if (medicaoError) throw medicaoError;
            
            // Salvar serviços da medição
            const servicosComMedicaoId = servicosParaSalvar.map(servico => ({
                ...servico,
                medicao_id: medicao.id
            }));
            
            const { error: servicosError } = await supabaseClient
                .from('medicoes_servicos')
                .insert(servicosComMedicaoId);
                
            if (servicosError) throw servicosError;
            
            this.hideLoading();
            this.showNotification('Medição salva com sucesso!', 'success');
            
            // Fechar modais
            this.fecharModalValor();
            this.fecharModalMedicao();
            
            // Recarregar lista de medições
            await this.loadMedicoes();
            
        } catch (error) {
            console.error('Erro ao salvar medição:', error);
            this.hideLoading();
            this.showNotification('Erro ao salvar medição: ' + error.message, 'error');
        }
    }

    async gerarNumeroMedicao() {
        try {
            // Buscar último número
            const { data, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('numero')
                .order('created_at', { ascending: false })
                .limit(1);
                
            if (error) throw error;
            
            let proximoNumero = 1;
            if (data && data.length > 0) {
                const ultimoNumero = data[0].numero;
                const numeroAtual = parseInt(ultimoNumero.replace('MED-', ''));
                proximoNumero = numeroAtual + 1;
            }
            
            return `MED-${proximoNumero.toString().padStart(3, '0')}`;
            
        } catch (error) {
            console.error('Erro ao gerar número da medição:', error);
            return `MED-${Date.now()}`;
        }
    }

    // ========================================
    // FILTROS
    // ========================================

    populateObrasFilter() {
        const select = document.getElementById('filtro-obra');
        if (!select) return;
        
        select.innerHTML = '<option value="">Todas as obras</option>';
        this.obras.forEach(obra => {
            select.innerHTML += `<option value="${obra.id}">${obra.numero_obra}</option>`;
        });
    }

    aplicarFiltros() {
        const filtroObra = document.getElementById('filtro-obra')?.value;
        const filtroStatus = document.getElementById('filtro-status')?.value;
        const filtroData = document.getElementById('filtro-data')?.value;
        
        let medicoesFiltradas = [...this.medicoes];
        
        if (filtroObra) {
            medicoesFiltradas = medicoesFiltradas.filter(m => m.obra_id === filtroObra);
        }
        
        if (filtroStatus) {
            medicoesFiltradas = medicoesFiltradas.filter(m => m.status === filtroStatus);
        }
        
        if (filtroData) {
            medicoesFiltradas = medicoesFiltradas.filter(m => 
                m.data_medicao === filtroData
            );
        }
        
        this.renderMedicoesFiltradas(medicoesFiltradas);
    }

    renderMedicoesFiltradas(medicoes) {
        const tbody = document.getElementById('medicoes-list');
        if (!tbody) return;

        if (medicoes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #b0c4de; padding: 2rem;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma medição encontrada com os filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = medicoes.map(medicao => `
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

    limparFiltros() {
        document.getElementById('filtro-obra').value = '';
        document.getElementById('filtro-status').value = '';
        document.getElementById('filtro-data').value = '';
        this.renderMedicoes();
    }

    filtrarObras(termo) {
        const obrasFiltradas = this.obras.filter(obra => 
            obra.numero_obra.toLowerCase().includes(termo.toLowerCase()) ||
            obra.clientes_hvc.nome.toLowerCase().includes(termo.toLowerCase())
        );
        
        this.renderObrasModalFiltradas(obrasFiltradas);
    }

    renderObrasModalFiltradas(obras) {
        const container = document.getElementById('obras-list');
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
    // EDIÇÃO E EXCLUSÃO
    // ========================================

    async editarMedicao(medicaoId) {
        try {
            console.log('Editando medição:', medicaoId);
            // TODO: Implementar edição
            this.showNotification('Funcionalidade de edição em desenvolvimento', 'info');
        } catch (error) {
            console.error('Erro ao editar medição:', error);
            this.showNotification('Erro ao editar medição: ' + error.message, 'error');
        }
    }

    async excluirMedicao(medicaoId) {
        if (!confirm('Tem certeza que deseja excluir esta medição?')) {
            return;
        }
        
        try {
            console.log('Excluindo medição:', medicaoId);
            
            this.showLoading();
            
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
            
            this.hideLoading();
            this.showNotification('Medição excluída com sucesso!', 'success');
            
            // Recarregar lista
            await this.loadMedicoes();
            
        } catch (error) {
            console.error('Erro ao excluir medição:', error);
            this.hideLoading();
            this.showNotification('Erro ao excluir medição: ' + error.message, 'error');
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
        // Implementar loading spinner se necessário
        console.log('Loading...');
    }

    hideLoading() {
        // Esconder loading spinner se necessário
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

