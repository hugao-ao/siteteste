// =========================================================================
// DASHBOARD HVC - ADMINISTRATIVO
// Versão: 2.0
// Data: 23/12/2024
// =========================================================================

class DashboardHVC {
    constructor() {
        this.charts = {};
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
        this.dataCache = {};
        this.filtros = {
            periodo: 'mes',
            dataInicio: null,
            dataFim: null,
            obraId: null
        };
        this.sortConfig = {
            integrantes: { column: 'totalValor', ascending: false },
            equipes: { column: 'totalValor', ascending: false },
            obras: { column: 'valor_contratado', ascending: false },
            servicos: { column: 'valorTotalContratado', ascending: false }
        };
    }

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================
    async init() {
        console.log('📊 Inicializando Dashboard HVC...');
        
        // Verificar se é admin
        const userLevel = sessionStorage.getItem('nivel');
        if (userLevel !== 'admin') {
            console.log('⚠️ Dashboard admin disponível apenas para administradores');
            return;
        }

        // Definir período padrão (mês atual)
        this.definirPeriodo('mes');

        // Configurar event listeners
        this.configurarEventListeners();

        // Carregar dados e renderizar
        await this.carregarDados();
        this.renderizarDashboard();
        
        // Remover loading
        const loading = document.getElementById('dashboard-loading');
        if (loading) loading.style.display = 'none';
        
        console.log('✅ Dashboard HVC inicializado');
    }

    // =========================================================================
    // CONFIGURAÇÃO DE PERÍODO
    // =========================================================================
    definirPeriodo(tipo, dataInicio = null, dataFim = null) {
        const hoje = new Date();
        hoje.setHours(23, 59, 59, 999);
        
        switch(tipo) {
            case 'dia':
                this.filtros.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
                this.filtros.dataFim = hoje;
                break;
            case 'semana':
                const diaSemana = hoje.getDay();
                const inicioSemana = new Date(hoje);
                inicioSemana.setDate(hoje.getDate() - diaSemana);
                inicioSemana.setHours(0, 0, 0, 0);
                this.filtros.dataInicio = inicioSemana;
                this.filtros.dataFim = hoje;
                break;
            case 'quinzena':
                const inicioQuinzena = new Date(hoje);
                inicioQuinzena.setDate(hoje.getDate() - 14);
                inicioQuinzena.setHours(0, 0, 0, 0);
                this.filtros.dataInicio = inicioQuinzena;
                this.filtros.dataFim = hoje;
                break;
            case 'mes':
                this.filtros.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
                this.filtros.dataFim = hoje;
                break;
            case 'trimestre':
                const inicioTrimestre = new Date(hoje);
                inicioTrimestre.setMonth(hoje.getMonth() - 2);
                inicioTrimestre.setDate(1);
                inicioTrimestre.setHours(0, 0, 0, 0);
                this.filtros.dataInicio = inicioTrimestre;
                this.filtros.dataFim = hoje;
                break;
            case 'quadrimestre':
                const inicioQuadrimestre = new Date(hoje);
                inicioQuadrimestre.setMonth(hoje.getMonth() - 3);
                inicioQuadrimestre.setDate(1);
                inicioQuadrimestre.setHours(0, 0, 0, 0);
                this.filtros.dataInicio = inicioQuadrimestre;
                this.filtros.dataFim = hoje;
                break;
            case 'semestre':
                const inicioSemestre = new Date(hoje);
                inicioSemestre.setMonth(hoje.getMonth() - 5);
                inicioSemestre.setDate(1);
                inicioSemestre.setHours(0, 0, 0, 0);
                this.filtros.dataInicio = inicioSemestre;
                this.filtros.dataFim = hoje;
                break;
            case 'ano':
                this.filtros.dataInicio = new Date(hoje.getFullYear(), 0, 1, 0, 0, 0);
                this.filtros.dataFim = hoje;
                break;
            case 'personalizado':
                if (dataInicio && dataFim) {
                    this.filtros.dataInicio = new Date(dataInicio);
                    this.filtros.dataInicio.setHours(0, 0, 0, 0);
                    this.filtros.dataFim = new Date(dataFim);
                    this.filtros.dataFim.setHours(23, 59, 59, 999);
                }
                break;
            case 'todos':
                this.filtros.dataInicio = null;
                this.filtros.dataFim = null;
                break;
        }
        
        this.filtros.periodo = tipo;
    }

    configurarEventListeners() {
        // Seletor de período
        const selectPeriodo = document.getElementById('select-periodo');
        if (selectPeriodo) {
            selectPeriodo.addEventListener('change', async (e) => {
                const valor = e.target.value;
                
                if (valor === 'personalizado') {
                    // Mostrar seletor de datas
                    document.getElementById('periodo-personalizado').style.display = 'flex';
                } else {
                    document.getElementById('periodo-personalizado').style.display = 'none';
                    this.definirPeriodo(valor);
                    await this.carregarDados();
                    this.renderizarDashboard();
                }
            });
        }

        // Botão aplicar período personalizado
        const btnAplicarPeriodo = document.getElementById('btn-aplicar-periodo');
        if (btnAplicarPeriodo) {
            btnAplicarPeriodo.addEventListener('click', async () => {
                const dataInicio = document.getElementById('data-inicio').value;
                const dataFim = document.getElementById('data-fim').value;
                
                if (dataInicio && dataFim) {
                    this.definirPeriodo('personalizado', dataInicio, dataFim);
                    await this.carregarDados();
                    this.renderizarDashboard();
                }
            });
        }
    }

    // =========================================================================
    // CARREGAMENTO DE DADOS
    // =========================================================================
    async carregarDados() {
        try {
            const [
                resumoObras,
                produtividadeIntegrantes,
                produtividadeEquipes,
                analiseServicos,
                medicoes,
                producoes
            ] = await Promise.all([
                this.carregarResumoObras(),
                this.carregarProdutividadeIntegrantes(),
                this.carregarProdutividadeEquipes(),
                this.carregarAnaliseServicos(),
                this.carregarMedicoes(),
                this.carregarProducoes()
            ]);

            this.dataCache = {
                resumoObras,
                produtividadeIntegrantes,
                produtividadeEquipes,
                analiseServicos,
                medicoes,
                producoes,
                timestamp: Date.now()
            };

            return this.dataCache;
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            throw error;
        }
    }

    async carregarResumoObras() {
        const { data, error } = await supabaseClient
            .from('obras_hvc')
            .select(`
                id,
                numero_obra,
                status,
                created_at,
                obras_propostas (
                    propostas_hvc (
                        total_proposta,
                        clientes_hvc (nome)
                    )
                ),
                medicoes_hvc (id, valor_total, recebimentos, status)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transformar dados
        return (data || []).map(obra => {
            const proposta = obra.obras_propostas?.[0]?.propostas_hvc;
            const cliente = proposta?.clientes_hvc?.nome || 'N/A';
            const valorContratado = parseFloat(proposta?.total_proposta) || 0;
            
            // Calcular valores de medições
            let valorMedido = 0;
            let valorRecebido = 0;
            
            (obra.medicoes_hvc || []).forEach(med => {
                valorMedido += parseFloat(med.valor_total) || 0;
                
                // Calcular valor recebido dos recebimentos
                if (med.recebimentos && Array.isArray(med.recebimentos)) {
                    med.recebimentos.forEach(rec => {
                        if (rec.status === 'RC' || rec.status === 'RC c/ RET') {
                            valorRecebido += parseFloat(rec.valor) || 0;
                        }
                    });
                }
            });

            // Calcular percentual de andamento
            const percentualAndamento = valorContratado > 0 ? (valorMedido / valorContratado) * 100 : 0;

            return {
                id: obra.id,
                numero: obra.numero_obra,
                cliente,
                status: obra.status,
                valor_contratado: valorContratado,
                valor_medido: valorMedido,
                valor_recebido: valorRecebido,
                percentual_andamento: percentualAndamento,
                despesas: 0, // Campo para futuro uso
                created_at: obra.created_at
            };
        });
    }

    async carregarProdutividadeIntegrantes() {
        // Buscar integrantes
        const { data: integrantes, error: errInt } = await supabaseClient
            .from('integrantes_hvc')
            .select('id, nome, cpf, ativo');
        
        if (errInt) throw errInt;

        // Buscar produções com filtro de data
        let query = supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('tipo_responsavel', 'integrante');
        
        if (this.filtros.dataInicio) {
            query = query.gte('data', this.filtros.dataInicio.toISOString().split('T')[0]);
        }
        if (this.filtros.dataFim) {
            query = query.lte('data', this.filtros.dataFim.toISOString().split('T')[0]);
        }

        const { data: producoes, error: errProd } = await query;
        if (errProd) throw errProd;

        // Buscar itens de proposta para preços
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, preco_mao_obra, preco_material, preco_total, quantidade');

        if (errItens) throw errItens;

        // Criar mapa de preços (valor unitário = preco_total / quantidade)
        const precoMap = {};
        (itensProposta || []).forEach(item => {
            const quantidade = parseFloat(item.quantidade) || 1;
            const precoTotal = parseFloat(item.preco_total) || 0;
            precoMap[item.id] = quantidade > 0 ? (precoTotal / quantidade) : 0;
        });

        // Calcular produtividade por integrante
        const produtividadeMap = {};
        (producoes || []).forEach(prod => {
            const integranteId = prod.responsavel_id;
            if (!produtividadeMap[integranteId]) {
                produtividadeMap[integranteId] = {
                    totalProducoes: 0,
                    totalQuantidade: 0,
                    totalValor: 0,
                    obras: new Set(),
                    servicos: {} // Para detalhamento
                };
            }

            produtividadeMap[integranteId].totalProducoes++;
            produtividadeMap[integranteId].obras.add(prod.obra_id);

            // Processar quantidades_servicos (é um OBJETO, não array)
            if (prod.quantidades_servicos && typeof prod.quantidades_servicos === 'object') {
                Object.entries(prod.quantidades_servicos).forEach(([itemId, quantidade]) => {
                    const qtd = parseFloat(quantidade) || 0;
                    const precoUnitario = precoMap[itemId] || 0;
                    
                    produtividadeMap[integranteId].totalQuantidade += qtd;
                    produtividadeMap[integranteId].totalValor += qtd * precoUnitario;
                    
                    // Acumular por serviço
                    if (!produtividadeMap[integranteId].servicos[itemId]) {
                        produtividadeMap[integranteId].servicos[itemId] = { quantidade: 0, valor: 0 };
                    }
                    produtividadeMap[integranteId].servicos[itemId].quantidade += qtd;
                    produtividadeMap[integranteId].servicos[itemId].valor += qtd * precoUnitario;
                });
            }
        });

        // Montar resultado
        return (integrantes || []).map(int => ({
            id: int.id,
            nome: int.nome,
            cpf: int.cpf,
            ativo: int.ativo,
            totalProducoes: produtividadeMap[int.id]?.totalProducoes || 0,
            totalQuantidade: produtividadeMap[int.id]?.totalQuantidade || 0,
            totalValor: produtividadeMap[int.id]?.totalValor || 0,
            totalObras: produtividadeMap[int.id]?.obras?.size || 0,
            servicos: produtividadeMap[int.id]?.servicos || {}
        })).sort((a, b) => b.totalValor - a.totalValor);
    }

    async carregarProdutividadeEquipes() {
        // Buscar equipes
        const { data: equipes, error: errEq } = await supabaseClient
            .from('equipes_hvc')
            .select('id, numero, ativa');
        
        if (errEq) throw errEq;

        // Buscar relacionamentos equipe-integrante
        const { data: relacoes, error: errRel } = await supabaseClient
            .from('equipe_integrantes')
            .select('equipe_id, integrante_id');

        if (errRel) {
            console.warn('Tabela equipe_integrantes não encontrada');
        }

        // Contar integrantes por equipe
        const integrantesPorEquipe = {};
        (relacoes || []).forEach(rel => {
            if (!integrantesPorEquipe[rel.equipe_id]) {
                integrantesPorEquipe[rel.equipe_id] = new Set();
            }
            integrantesPorEquipe[rel.equipe_id].add(rel.integrante_id);
        });

        // Buscar produções de equipes com filtro de data
        let query = supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('tipo_responsavel', 'equipe');
        
        if (this.filtros.dataInicio) {
            query = query.gte('data', this.filtros.dataInicio.toISOString().split('T')[0]);
        }
        if (this.filtros.dataFim) {
            query = query.lte('data', this.filtros.dataFim.toISOString().split('T')[0]);
        }

        const { data: producoes, error: errProd } = await query;
        if (errProd) throw errProd;

        // Buscar itens de proposta para preços
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, servico_id, preco_total, quantidade');

        if (errItens) throw errItens;

        // Buscar serviços para nomes
        const { data: servicos, error: errServ } = await supabaseClient
            .from('servicos_hvc')
            .select('id, codigo, descricao, unidade');

        if (errServ) throw errServ;

        // Criar mapa de serviços
        const servicoMap = {};
        (servicos || []).forEach(s => {
            servicoMap[s.id] = s;
        });

        // Criar mapa de preços e item->servico
        const precoMap = {};
        const itemServicoMap = {};
        (itensProposta || []).forEach(item => {
            const quantidade = parseFloat(item.quantidade) || 1;
            const precoTotal = parseFloat(item.preco_total) || 0;
            precoMap[item.id] = quantidade > 0 ? (precoTotal / quantidade) : 0;
            itemServicoMap[item.id] = item.servico_id;
        });

        // Calcular produtividade por equipe
        const produtividadeMap = {};
        (producoes || []).forEach(prod => {
            const equipeId = prod.responsavel_id;
            if (!produtividadeMap[equipeId]) {
                produtividadeMap[equipeId] = {
                    totalProducoes: 0,
                    totalQuantidade: 0,
                    totalValor: 0,
                    obras: new Set(),
                    servicosDetalhados: {} // Para o modal
                };
            }

            produtividadeMap[equipeId].totalProducoes++;
            produtividadeMap[equipeId].obras.add(prod.obra_id);

            // Processar quantidades_servicos (é um OBJETO)
            if (prod.quantidades_servicos && typeof prod.quantidades_servicos === 'object') {
                Object.entries(prod.quantidades_servicos).forEach(([itemId, quantidade]) => {
                    const qtd = parseFloat(quantidade) || 0;
                    const precoUnitario = precoMap[itemId] || 0;
                    const servicoId = itemServicoMap[itemId];
                    
                    produtividadeMap[equipeId].totalQuantidade += qtd;
                    produtividadeMap[equipeId].totalValor += qtd * precoUnitario;
                    
                    // Acumular por serviço para o modal
                    if (servicoId) {
                        if (!produtividadeMap[equipeId].servicosDetalhados[servicoId]) {
                            const servico = servicoMap[servicoId] || {};
                            produtividadeMap[equipeId].servicosDetalhados[servicoId] = {
                                codigo: servico.codigo || 'N/A',
                                descricao: servico.descricao || 'Serviço não identificado',
                                unidade: servico.unidade || 'UN',
                                quantidade: 0,
                                valor: 0
                            };
                        }
                        produtividadeMap[equipeId].servicosDetalhados[servicoId].quantidade += qtd;
                        produtividadeMap[equipeId].servicosDetalhados[servicoId].valor += qtd * precoUnitario;
                    }
                });
            }
        });

        // Montar resultado
        return (equipes || []).map(eq => ({
            id: eq.id,
            numero: eq.numero,
            ativa: eq.ativa,
            totalIntegrantes: integrantesPorEquipe[eq.id]?.size || 0,
            totalProducoes: produtividadeMap[eq.id]?.totalProducoes || 0,
            totalQuantidade: produtividadeMap[eq.id]?.totalQuantidade || 0,
            totalValor: produtividadeMap[eq.id]?.totalValor || 0,
            totalObras: produtividadeMap[eq.id]?.obras?.size || 0,
            servicosDetalhados: produtividadeMap[eq.id]?.servicosDetalhados || {}
        })).sort((a, b) => b.totalValor - a.totalValor);
    }

    async carregarAnaliseServicos() {
        // Buscar serviços
        const { data: servicos, error: errServ } = await supabaseClient
            .from('servicos_hvc')
            .select('id, codigo, descricao, unidade');

        if (errServ) throw errServ;

        // Buscar itens de proposta
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, servico_id, proposta_id, quantidade, preco_total');

        if (errItens) throw errItens;

        // Criar mapas
        const servicoMap = {};
        (servicos || []).forEach(s => {
            servicoMap[s.id] = {
                id: s.id,
                codigo: s.codigo,
                descricao: s.descricao,
                unidade: s.unidade,
                totalPropostas: new Set(),
                totalQuantidadeContratada: 0,
                valorTotalContratado: 0
            };
        });

        // Processar itens de proposta
        (itensProposta || []).forEach(item => {
            if (servicoMap[item.servico_id]) {
                servicoMap[item.servico_id].totalPropostas.add(item.proposta_id);
                const qtd = parseFloat(item.quantidade) || 0;
                const preco = parseFloat(item.preco_total) || 0;
                servicoMap[item.servico_id].totalQuantidadeContratada += qtd;
                servicoMap[item.servico_id].valorTotalContratado += preco;
            }
        });

        // Converter para array
        return Object.values(servicoMap).map(s => ({
            ...s,
            totalPropostas: s.totalPropostas.size
        })).sort((a, b) => b.valorTotalContratado - a.valorTotalContratado);
    }

    async carregarMedicoes() {
        let query = supabaseClient
            .from('medicoes_hvc')
            .select(`
                id,
                numero_medicao,
                valor_total,
                status,
                created_at,
                obras_hvc (id, numero_obra)
            `)
            .order('created_at', { ascending: false });

        if (this.filtros.dataInicio) {
            query = query.gte('created_at', this.filtros.dataInicio.toISOString());
        }
        if (this.filtros.dataFim) {
            query = query.lte('created_at', this.filtros.dataFim.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async carregarProducoes() {
        let query = supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .order('data', { ascending: false });

        if (this.filtros.dataInicio) {
            query = query.gte('data', this.filtros.dataInicio.toISOString().split('T')[0]);
        }
        if (this.filtros.dataFim) {
            query = query.lte('data', this.filtros.dataFim.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    // =========================================================================
    // ORDENAÇÃO
    // =========================================================================
    ordenarDados(tipo, coluna) {
        const config = this.sortConfig[tipo];
        if (config.column === coluna) {
            config.ascending = !config.ascending;
        } else {
            config.column = coluna;
            config.ascending = false;
        }
        
        // Re-renderizar a seção específica
        switch(tipo) {
            case 'integrantes':
                this.renderizarProdutividadeIntegrantes();
                break;
            case 'equipes':
                this.renderizarProdutividadeEquipes();
                break;
            case 'obras':
                this.renderizarRankingObras();
                break;
            case 'servicos':
                this.renderizarAnaliseServicos();
                break;
        }
    }

    // =========================================================================
    // RENDERIZAÇÃO
    // =========================================================================
    renderizarDashboard() {
        this.renderizarKPIs();
        this.renderizarRankingObras();
        this.renderizarProdutividadeIntegrantes();
        this.renderizarProdutividadeEquipes();
        this.renderizarAnaliseServicos();
        this.renderizarGraficoEvolucao();
    }

    renderizarKPIs() {
        const obras = this.dataCache.resumoObras || [];
        const obrasAtivas = obras.filter(o => o.status === 'ANDAMENTO' || o.status === 'PLANEJAMENTO');
        
        let totalContratado = 0;
        let totalMedido = 0;
        let totalRecebido = 0;

        obras.forEach(obra => {
            totalContratado += obra.valor_contratado;
            totalMedido += obra.valor_medido;
            totalRecebido += obra.valor_recebido;
        });

        const retencao = totalMedido - totalRecebido;
        const taxaRecebimento = totalMedido > 0 ? (totalRecebido / totalMedido) * 100 : 0;

        const container = document.getElementById('kpis-container');
        if (!container) return;

        container.innerHTML = `
            <div class="kpi-card">
                <div class="kpi-icon">🏗️</div>
                <div class="kpi-content">
                    <div class="kpi-value">${obrasAtivas.length}</div>
                    <div class="kpi-label">Obras Ativas</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">📝</div>
                <div class="kpi-content">
                    <div class="kpi-value">${this.formatarMoeda(totalContratado)}</div>
                    <div class="kpi-label">Total Contratado</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">📊</div>
                <div class="kpi-content">
                    <div class="kpi-value">${this.formatarMoeda(totalMedido)}</div>
                    <div class="kpi-label">Total Medido</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">💰</div>
                <div class="kpi-content">
                    <div class="kpi-value">${this.formatarMoeda(totalRecebido)}</div>
                    <div class="kpi-label">Total Recebido</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">🔒</div>
                <div class="kpi-content">
                    <div class="kpi-value">${this.formatarMoeda(retencao)}</div>
                    <div class="kpi-label">Retenção</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">📈</div>
                <div class="kpi-content">
                    <div class="kpi-value">${taxaRecebimento.toFixed(1)}%</div>
                    <div class="kpi-label">Taxa Recebimento</div>
                </div>
            </div>
        `;
    }

    renderizarRankingObras(mostrarTodos = false) {
        const container = document.getElementById('ranking-obras-container');
        if (!container) return;

        let obras = [...(this.dataCache.resumoObras || [])];
        
        // Ordenar
        const config = this.sortConfig.obras;
        obras.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        const obrasExibir = mostrarTodos ? obras : obras.slice(0, 5);
        const sortIcon = (col) => config.column === col ? (config.ascending ? '↑' : '↓') : '';

        container.innerHTML = `
            <div class="section-header">
                <h3>🏆 Top ${mostrarTodos ? 'Todas' : '5'} Obras por Valor</h3>
            </div>
            <div class="table-responsive">
                <table class="dashboard-table sortable">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('obras', 'numero')">OBRA ${sortIcon('numero')}</th>
                            <th>CLIENTE</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('obras', 'valor_contratado')">CONTRATADO ${sortIcon('valor_contratado')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('obras', 'valor_medido')">MEDIDO ${sortIcon('valor_medido')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('obras', 'valor_recebido')">RECEBIDO ${sortIcon('valor_recebido')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('obras', 'percentual_andamento')">ANDAMENTO ${sortIcon('percentual_andamento')}</th>
                            <th>DESPESAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${obrasExibir.map((obra, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>${obra.numero || 'N/A'}</td>
                                <td>${obra.cliente}</td>
                                <td>${this.formatarMoeda(obra.valor_contratado)}</td>
                                <td>${this.formatarMoeda(obra.valor_medido)}</td>
                                <td class="${obra.valor_recebido > 0 ? 'valor-positivo' : 'valor-zero'}">${this.formatarMoeda(obra.valor_recebido)}</td>
                                <td class="percentual-cell">${obra.percentual_andamento.toFixed(1)}%</td>
                                <td class="despesas-cell">-</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="dashboardHVC.renderizarRankingObras(${!mostrarTodos})">
                ${mostrarTodos ? '📋 Ver Menos' : '📋 Ver Todos'}
            </button>
        `;
    }

    renderizarProdutividadeIntegrantes(mostrarTodos = false) {
        const container = document.getElementById('produtividade-integrantes-container');
        if (!container) return;

        let integrantes = [...(this.dataCache.produtividadeIntegrantes || [])];
        
        // Ordenar
        const config = this.sortConfig.integrantes;
        integrantes.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        const integrantesExibir = mostrarTodos ? integrantes : integrantes.slice(0, 5);
        const sortIcon = (col) => config.column === col ? (config.ascending ? '↑' : '↓') : '';

        container.innerHTML = `
            <div class="section-header">
                <h3>👥 Produtividade - Integrantes</h3>
            </div>
            <div class="table-responsive">
                <table class="dashboard-table sortable">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('integrantes', 'nome')">INTEGRANTE ${sortIcon('nome')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('integrantes', 'totalProducoes')">PRODUÇÕES ${sortIcon('totalProducoes')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('integrantes', 'totalObras')">OBRAS ${sortIcon('totalObras')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('integrantes', 'totalQuantidade')">QTD. TOTAL ${sortIcon('totalQuantidade')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('integrantes', 'totalValor')">VALOR PRODUZIDO ${sortIcon('totalValor')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${integrantesExibir.map((int, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>${int.nome}</td>
                                <td>${int.totalProducoes}</td>
                                <td>${int.totalObras}</td>
                                <td>${int.totalQuantidade.toFixed(2)}</td>
                                <td class="${int.totalValor > 0 ? 'valor-positivo' : 'valor-zero'}">${this.formatarMoeda(int.totalValor)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="dashboardHVC.renderizarProdutividadeIntegrantes(${!mostrarTodos})">
                ${mostrarTodos ? '📋 Ver Menos' : '📋 Ver Todos'}
            </button>
        `;
    }

    renderizarProdutividadeEquipes(mostrarTodos = false) {
        const container = document.getElementById('produtividade-equipes-container');
        if (!container) return;

        let equipes = [...(this.dataCache.produtividadeEquipes || [])];
        
        // Ordenar
        const config = this.sortConfig.equipes;
        equipes.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        const equipesExibir = mostrarTodos ? equipes : equipes.slice(0, 5);
        const sortIcon = (col) => config.column === col ? (config.ascending ? '↑' : '↓') : '';

        container.innerHTML = `
            <div class="section-header">
                <h3>👥 Produtividade - Equipes</h3>
            </div>
            <div class="table-responsive">
                <table class="dashboard-table sortable">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('equipes', 'numero')">EQUIPE ${sortIcon('numero')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('equipes', 'totalIntegrantes')">INTEGRANTES ${sortIcon('totalIntegrantes')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('equipes', 'totalProducoes')">PRODUÇÕES ${sortIcon('totalProducoes')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('equipes', 'totalObras')">OBRAS ${sortIcon('totalObras')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('equipes', 'totalQuantidade')">QTD. TOTAL ${sortIcon('totalQuantidade')}</th>
                            <th>DETALHES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${equipesExibir.map((eq, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>Equipe ${eq.numero || 'N/A'}</td>
                                <td>${eq.totalIntegrantes}</td>
                                <td>${eq.totalProducoes}</td>
                                <td>${eq.totalObras}</td>
                                <td>${eq.totalQuantidade.toFixed(2)}</td>
                                <td>
                                    <button class="btn-detalhes" onclick="dashboardHVC.abrirModalDetalhesEquipe('${eq.id}')" title="Ver detalhes">
                                        📊
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="dashboardHVC.renderizarProdutividadeEquipes(${!mostrarTodos})">
                ${mostrarTodos ? '📋 Ver Menos' : '📋 Ver Todos'}
            </button>
        `;
    }

    abrirModalDetalhesEquipe(equipeId) {
        const equipe = this.dataCache.produtividadeEquipes.find(e => e.id === equipeId);
        if (!equipe) return;

        const servicos = Object.values(equipe.servicosDetalhados || {});
        const totalValor = servicos.reduce((sum, s) => sum + s.valor, 0);

        // Criar modal
        let modal = document.getElementById('modal-detalhes-equipe');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalhes-equipe';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>📊 Detalhes - Equipe ${equipe.numero}</h3>
                    <button class="modal-close" onclick="dashboardHVC.fecharModalDetalhesEquipe()">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-summary">
                        <div class="summary-item">
                            <span class="summary-label">Total Produções:</span>
                            <span class="summary-value">${equipe.totalProducoes}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Obras:</span>
                            <span class="summary-value">${equipe.totalObras}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Quantidade:</span>
                            <span class="summary-value">${equipe.totalQuantidade.toFixed(2)}</span>
                        </div>
                        <div class="summary-item highlight">
                            <span class="summary-label">Valor Total Produzido:</span>
                            <span class="summary-value">${this.formatarMoeda(totalValor)}</span>
                        </div>
                    </div>
                    <h4>Serviços Produzidos</h4>
                    <div class="table-responsive">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>CÓDIGO</th>
                                    <th>SERVIÇO</th>
                                    <th>UNIDADE</th>
                                    <th>QUANTIDADE</th>
                                    <th>VALOR</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${servicos.length > 0 ? servicos.map(s => `
                                    <tr>
                                        <td>${s.codigo}</td>
                                        <td>${s.descricao}</td>
                                        <td>${s.unidade}</td>
                                        <td>${s.quantidade.toFixed(2)}</td>
                                        <td class="valor-positivo">${this.formatarMoeda(s.valor)}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" class="empty-message">Nenhum serviço produzido no período</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    fecharModalDetalhesEquipe() {
        const modal = document.getElementById('modal-detalhes-equipe');
        if (modal) modal.style.display = 'none';
    }

    renderizarAnaliseServicos(mostrarTodos = false) {
        const container = document.getElementById('analise-servicos-container');
        if (!container) return;

        let servicos = [...(this.dataCache.analiseServicos || [])];
        
        // Ordenar
        const config = this.sortConfig.servicos;
        servicos.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        const servicosExibir = mostrarTodos ? servicos : servicos.slice(0, 5);
        const sortIcon = (col) => config.column === col ? (config.ascending ? '↑' : '↓') : '';

        container.innerHTML = `
            <div class="section-header">
                <h3>📋 Análise de Serviços</h3>
            </div>
            <div class="table-responsive">
                <table class="dashboard-table sortable">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('servicos', 'codigo')">CÓDIGO ${sortIcon('codigo')}</th>
                            <th>SERVIÇO</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('servicos', 'totalPropostas')">PROPOSTAS ${sortIcon('totalPropostas')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('servicos', 'totalQuantidadeContratada')">QTD. CONTRATADA ${sortIcon('totalQuantidadeContratada')}</th>
                            <th class="sortable-header" onclick="dashboardHVC.ordenarDados('servicos', 'valorTotalContratado')">VALOR CONTRATADO ${sortIcon('valorTotalContratado')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${servicosExibir.map((s, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>${s.codigo}</td>
                                <td class="descricao-cell">${s.descricao}</td>
                                <td>${s.totalPropostas}</td>
                                <td>${s.totalQuantidadeContratada.toFixed(2)} ${s.unidade}</td>
                                <td class="valor-positivo">${this.formatarMoeda(s.valorTotalContratado)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="dashboardHVC.renderizarAnaliseServicos(${!mostrarTodos})">
                ${mostrarTodos ? '📋 Ver Menos' : '📋 Ver Todos'}
            </button>
        `;
    }

    renderizarGraficoEvolucao() {
        const container = document.getElementById('grafico-evolucao-container');
        if (!container) return;

        // Agrupar medições por mês
        const medicoes = this.dataCache.medicoes || [];
        const medicoesporMes = {};

        medicoes.forEach(med => {
            const data = new Date(med.created_at);
            const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            if (!medicoesporMes[chave]) {
                medicoesporMes[chave] = { quantidade: 0, valor: 0 };
            }
            medicoesporMes[chave].quantidade++;
            medicoesporMes[chave].valor += parseFloat(med.valor_total) || 0;
        });

        const meses = Object.keys(medicoesporMes).sort();
        const valores = meses.map(m => medicoesporMes[m].valor);
        const quantidades = meses.map(m => medicoesporMes[m].quantidade);

        container.innerHTML = `
            <div class="section-header">
                <h3>📈 Evolução de Medições</h3>
            </div>
            <div class="chart-container">
                <canvas id="chart-evolucao"></canvas>
            </div>
        `;

        // Criar gráfico
        const ctx = document.getElementById('chart-evolucao');
        if (ctx && window.Chart) {
            if (this.charts.evolucao) {
                this.charts.evolucao.destroy();
            }

            this.charts.evolucao = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: meses.map(m => {
                        const [ano, mes] = m.split('-');
                        return `${mes}/${ano.slice(2)}`;
                    }),
                    datasets: [{
                        label: 'Valor Medido (R$)',
                        data: valores,
                        backgroundColor: 'rgba(0, 128, 255, 0.7)',
                        borderColor: 'rgba(0, 128, 255, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#add8e6' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { 
                                color: '#add8e6',
                                callback: (value) => 'R$ ' + value.toLocaleString('pt-BR')
                            },
                            grid: { color: 'rgba(173, 216, 230, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#add8e6' },
                            grid: { color: 'rgba(173, 216, 230, 0.1)' }
                        }
                    }
                }
            });
        }
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================
    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    }
}

// Instância global
let dashboardHVC;

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    dashboardHVC = new DashboardHVC();
    dashboardHVC.init();
});
