
// dashboard-hvc.js - Dashboard Administrativo HVC
// Versão: 1.0
// Data: 18/12/2024

class DashboardHVC {
    constructor() {
        this.charts = {};
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
        this.dataCache = {};
        this.filtros = {
            periodo: 'mensal',
            dataInicio: null,
            dataFim: null,
            obraId: null
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
        const hoje = new Date();
        this.filtros.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        this.filtros.dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

        // Carregar dados e renderizar
        await this.carregarDados();
        this.renderizarDashboard();
        
        console.log('✅ Dashboard HVC inicializado');
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
                numero,
                status,
                created_at,
                clientes_hvc (nome),
                propostas_hvc (valor_total),
                medicoes_hvc (id, valor_total, valor_recebido, valor_retencao, status)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async carregarProdutividadeIntegrantes() {
        // Buscar integrantes
        const { data: integrantes, error: errInt } = await supabaseClient
            .from('integrantes_hvc')
            .select('id, nome, cpf, ativo');
        
        if (errInt) throw errInt;

        // Buscar produções
        const { data: producoes, error: errProd } = await supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('tipo_responsavel', 'integrante');

        if (errProd) throw errProd;

        // Buscar itens de proposta para preços
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, preco_mao_obra, preco_material');

        if (errItens) throw errItens;

        // Criar mapa de preços
        const precoMap = {};
        (itensProposta || []).forEach(item => {
            precoMap[item.id] = (parseFloat(item.preco_mao_obra) || 0) + (parseFloat(item.preco_material) || 0);
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
                    obras: new Set()
                };
            }

            produtividadeMap[integranteId].totalProducoes++;
            produtividadeMap[integranteId].obras.add(prod.obra_id);

            // Processar quantidades_servicos
            if (prod.quantidades_servicos && Array.isArray(prod.quantidades_servicos)) {
                prod.quantidades_servicos.forEach(qs => {
                    const quantidade = parseFloat(qs.quantidade) || 0;
                    const precoUnitario = precoMap[qs.itemPropostaId] || 0;
                    produtividadeMap[integranteId].totalQuantidade += quantidade;
                    produtividadeMap[integranteId].totalValor += quantidade * precoUnitario;
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
            totalObras: produtividadeMap[int.id]?.obras?.size || 0
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

        if (errRel) throw errRel;

        // Contar integrantes por equipe
        const integrantesPorEquipe = {};
        (relacoes || []).forEach(rel => {
            integrantesPorEquipe[rel.equipe_id] = (integrantesPorEquipe[rel.equipe_id] || 0) + 1;
        });

        // Buscar produções de equipes
        const { data: producoes, error: errProd } = await supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('tipo_responsavel', 'equipe');

        if (errProd) throw errProd;

        // Buscar itens de proposta para preços
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, preco_mao_obra, preco_material');

        if (errItens) throw errItens;

        // Criar mapa de preços
        const precoMap = {};
        (itensProposta || []).forEach(item => {
            precoMap[item.id] = (parseFloat(item.preco_mao_obra) || 0) + (parseFloat(item.preco_material) || 0);
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
                    obras: new Set()
                };
            }

            produtividadeMap[equipeId].totalProducoes++;
            produtividadeMap[equipeId].obras.add(prod.obra_id);

            if (prod.quantidades_servicos && Array.isArray(prod.quantidades_servicos)) {
                prod.quantidades_servicos.forEach(qs => {
                    const quantidade = parseFloat(qs.quantidade) || 0;
                    const precoUnitario = precoMap[qs.itemPropostaId] || 0;
                    produtividadeMap[equipeId].totalQuantidade += quantidade;
                    produtividadeMap[equipeId].totalValor += quantidade * precoUnitario;
                });
            }
        });

        // Montar resultado
        return (equipes || []).map(eq => ({
            id: eq.id,
            numero: eq.numero,
            ativa: eq.ativa,
            totalIntegrantes: integrantesPorEquipe[eq.id] || 0,
            totalProducoes: produtividadeMap[eq.id]?.totalProducoes || 0,
            totalQuantidade: produtividadeMap[eq.id]?.totalQuantidade || 0,
            totalValor: produtividadeMap[eq.id]?.totalValor || 0,
            totalObras: produtividadeMap[eq.id]?.obras?.size || 0
        })).sort((a, b) => b.totalValor - a.totalValor);
    }

    async carregarAnaliseServicos() {
        // Buscar serviços
        const { data: servicos, error: errServ } = await supabaseClient
            .from('servicos_hvc')
            .select('id, codigo, descricao, unidade, ativo')
            .eq('ativo', true);

        if (errServ) throw errServ;

        // Buscar itens de proposta
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, servico_id, proposta_id, quantidade, preco_mao_obra, preco_material');

        if (errItens) throw errItens;

        // Buscar medições de serviços
        const { data: medicaoServicos, error: errMed } = await supabaseClient
            .from('medicao_servicos_hvc')
            .select('item_proposta_id, quantidade_medida, valor_total');

        if (errMed) throw errMed;

        // Criar mapas
        const servicoMap = {};
        (servicos || []).forEach(s => {
            servicoMap[s.id] = {
                ...s,
                totalPropostas: new Set(),
                totalQuantidadeContratada: 0,
                valorTotalContratado: 0,
                totalQuantidadeMedida: 0,
                valorTotalMedido: 0
            };
        });

        // Processar itens de proposta
        (itensProposta || []).forEach(item => {
            if (servicoMap[item.servico_id]) {
                servicoMap[item.servico_id].totalPropostas.add(item.proposta_id);
                const qtd = parseFloat(item.quantidade) || 0;
                const preco = (parseFloat(item.preco_mao_obra) || 0) + (parseFloat(item.preco_material) || 0);
                servicoMap[item.servico_id].totalQuantidadeContratada += qtd;
                servicoMap[item.servico_id].valorTotalContratado += qtd * preco;
            }
        });

        // Criar mapa de item_proposta para servico
        const itemToServico = {};
        (itensProposta || []).forEach(item => {
            itemToServico[item.id] = item.servico_id;
        });

        // Processar medições
        (medicaoServicos || []).forEach(ms => {
            const servicoId = itemToServico[ms.item_proposta_id];
            if (servicoId && servicoMap[servicoId]) {
                servicoMap[servicoId].totalQuantidadeMedida += parseFloat(ms.quantidade_medida) || 0;
                servicoMap[servicoId].valorTotalMedido += parseFloat(ms.valor_total) || 0;
            }
        });

        // Converter para array e ordenar
        return Object.values(servicoMap)
            .map(s => ({
                ...s,
                totalPropostas: s.totalPropostas.size
            }))
            .sort((a, b) => b.valorTotalContratado - a.valorTotalContratado);
    }

    async carregarMedicoes() {
        const { data, error } = await supabaseClient
            .from('medicoes_hvc')
            .select(`
                id,
                numero,
                obra_id,
                valor_total,
                valor_recebido,
                valor_retencao,
                status,
                created_at,
                obras_hvc (numero)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async carregarProducoes() {
        const { data, error } = await supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .order('data_producao', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    // =========================================================================
    // CÁLCULOS E MÉTRICAS
    // =========================================================================
    calcularKPIs() {
        const { resumoObras, medicoes, producoes } = this.dataCache;

        // Obras ativas
        const obrasAtivas = resumoObras.filter(o => o.status === 'Em Andamento').length;
        
        // Valor total contratado
        let valorContratado = 0;
        resumoObras.forEach(o => {
            if (o.propostas_hvc && o.propostas_hvc.length > 0) {
                valorContratado += parseFloat(o.propostas_hvc[0].valor_total) || 0;
            }
        });

        // Valor medido e recebido
        let valorMedido = 0;
        let valorRecebido = 0;
        let valorRetencao = 0;
        medicoes.forEach(m => {
            valorMedido += parseFloat(m.valor_total) || 0;
            valorRecebido += parseFloat(m.valor_recebido) || 0;
            valorRetencao += parseFloat(m.valor_retencao) || 0;
        });

        // Margem média (simplificada: recebido / medido)
        const margemMedia = valorMedido > 0 ? ((valorRecebido / valorMedido) * 100) : 0;

        // Total de produções no mês
        const producoesMes = producoes.filter(p => {
            const dataProd = new Date(p.data_producao);
            return dataProd >= this.filtros.dataInicio && dataProd <= this.filtros.dataFim;
        }).length;

        return {
            obrasAtivas,
            valorContratado,
            valorMedido,
            valorRecebido,
            valorRetencao,
            margemMedia,
            producoesMes,
            totalMedicoes: medicoes.length
        };
    }

    // =========================================================================
    // RENDERIZAÇÃO
    // =========================================================================
    renderizarDashboard() {
        const container = document.getElementById('dashboard-admin-container');
        if (!container) {
            console.log('Container dashboard-admin-container não encontrado');
            return;
        }
        
        // Remover loading
        const loading = document.getElementById('loading-dashboard');
        if (loading) loading.remove();
        
        console.log('Renderizando dashboard no container...');

        const kpis = this.calcularKPIs();

        container.innerHTML = `
            <div class="hvc-container">
                <h1 class="hvc-title">
                    <i class="fas fa-chart-line"></i> Dashboard Administrativo HVC
                </h1>

                <!-- Filtros -->
                <div class="dashboard-filtros">
                    <div class="filtro-grupo">
                        <label>Período:</label>
                        <select id="filtro-periodo" onchange="dashboardHVC.alterarPeriodo(this.value)">
                            <option value="mensal">Mês Atual</option>
                            <option value="trimestral">Trimestre</option>
                            <option value="anual">Ano</option>
                            <option value="todos">Todos</option>
                        </select>
                    </div>
                    <button class="btn-atualizar" onclick="dashboardHVC.atualizarDados()">
                        <i class="fas fa-sync-alt"></i> Atualizar
                    </button>
                </div>

                <!-- KPIs -->
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-icon"><i class="fas fa-building"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value">${kpis.obrasAtivas}</div>
                            <div class="kpi-label">Obras Ativas</div>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"><i class="fas fa-file-contract"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value">${this.formatarMoeda(kpis.valorContratado)}</div>
                            <div class="kpi-label">Valor Contratado</div>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value">${this.formatarMoeda(kpis.valorMedido)}</div>
                            <div class="kpi-label">Valor Medido</div>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"><i class="fas fa-hand-holding-usd"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value">${this.formatarMoeda(kpis.valorRecebido)}</div>
                            <div class="kpi-label">Valor Recebido</div>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"><i class="fas fa-lock"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value">${this.formatarMoeda(kpis.valorRetencao)}</div>
                            <div class="kpi-label">Retenção Total</div>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"><i class="fas fa-percentage"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value">${kpis.margemMedia.toFixed(1)}%</div>
                            <div class="kpi-label">Taxa Recebimento</div>
                        </div>
                    </div>
                </div>

                <!-- Seções de Análise -->
                <div class="dashboard-sections">
                    <!-- Ranking de Obras -->
                    <div class="dashboard-section">
                        <h2 class="section-title"><i class="fas fa-trophy"></i> Top 5 Obras por Valor</h2>
                        ${this.renderizarRankingObras()}
                    </div>

                    <!-- Produtividade de Integrantes -->
                    <div class="dashboard-section">
                        <h2 class="section-title"><i class="fas fa-users"></i> Produtividade - Integrantes</h2>
                        ${this.renderizarProdutividadeIntegrantes()}
                    </div>

                    <!-- Produtividade de Equipes -->
                    <div class="dashboard-section">
                        <h2 class="section-title"><i class="fas fa-user-friends"></i> Produtividade - Equipes</h2>
                        ${this.renderizarProdutividadeEquipes()}
                    </div>

                    <!-- Análise de Serviços -->
                    <div class="dashboard-section">
                        <h2 class="section-title"><i class="fas fa-tools"></i> Serviços Mais Contratados</h2>
                        ${this.renderizarAnaliseServicos()}
                    </div>

                    <!-- Gráfico de Evolução -->
                    <div class="dashboard-section chart-section">
                        <h2 class="section-title"><i class="fas fa-chart-bar"></i> Evolução Mensal</h2>
                        <div class="chart-container">
                            <canvas id="chart-evolucao"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Renderizar gráficos
        this.renderizarGraficos();
    }

    renderizarRankingObras() {
        const { resumoObras } = this.dataCache;
        
        // Ordenar por valor contratado
        const obrasOrdenadas = resumoObras
            .map(o => ({
                numero: o.numero,
                cliente: o.clientes_hvc?.nome || 'N/A',
                valorContratado: o.propostas_hvc?.[0]?.valor_total || 0,
                valorMedido: (o.medicoes_hvc || []).reduce((sum, m) => sum + (parseFloat(m.valor_total) || 0), 0),
                valorRecebido: (o.medicoes_hvc || []).reduce((sum, m) => sum + (parseFloat(m.valor_recebido) || 0), 0),
                status: o.status
            }))
            .sort((a, b) => b.valorContratado - a.valorContratado)
            .slice(0, 5);

        if (obrasOrdenadas.length === 0) {
            return '<p class="no-data">Nenhuma obra encontrada</p>';
        }

        return `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Obra</th>
                        <th>Cliente</th>
                        <th>Contratado</th>
                        <th>Medido</th>
                        <th>Recebido</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${obrasOrdenadas.map((o, i) => `
                        <tr>
                            <td class="rank-num">${i + 1}º</td>
                            <td>${o.numero}</td>
                            <td>${o.cliente}</td>
                            <td class="valor">${this.formatarMoeda(o.valorContratado)}</td>
                            <td class="valor">${this.formatarMoeda(o.valorMedido)}</td>
                            <td class="valor positivo">${this.formatarMoeda(o.valorRecebido)}</td>
                            <td><span class="status-badge ${o.status?.toLowerCase().replace(/\s/g, '-')}">${o.status || 'N/A'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderizarProdutividadeIntegrantes() {
        const { produtividadeIntegrantes } = this.dataCache;
        
        const top5 = produtividadeIntegrantes.slice(0, 5);

        if (top5.length === 0) {
            return '<p class="no-data">Nenhum integrante com produção registrada</p>';
        }

        return `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Integrante</th>
                        <th>Produções</th>
                        <th>Obras</th>
                        <th>Qtd. Total</th>
                        <th>Valor Produzido</th>
                    </tr>
                </thead>
                <tbody>
                    ${top5.map((int, i) => `
                        <tr>
                            <td class="rank-num">${i + 1}º</td>
                            <td>${int.nome}</td>
                            <td>${int.totalProducoes}</td>
                            <td>${int.totalObras}</td>
                            <td>${int.totalQuantidade.toFixed(2)}</td>
                            <td class="valor positivo">${this.formatarMoeda(int.totalValor)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <button class="btn-ver-todos" onclick="dashboardHVC.mostrarTodosIntegrantes()">
                <i class="fas fa-list"></i> Ver Todos
            </button>
        `;
    }

    renderizarProdutividadeEquipes() {
        const { produtividadeEquipes } = this.dataCache;
        
        const equipesComProducao = produtividadeEquipes.filter(e => e.totalProducoes > 0);

        if (equipesComProducao.length === 0) {
            return '<p class="no-data">Nenhuma equipe com produção registrada</p>';
        }

        return `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Equipe</th>
                        <th>Integrantes</th>
                        <th>Produções</th>
                        <th>Obras</th>
                        <th>Qtd. Total</th>
                        <th>Valor Produzido</th>
                    </tr>
                </thead>
                <tbody>
                    ${equipesComProducao.slice(0, 5).map((eq, i) => `
                        <tr>
                            <td class="rank-num">${i + 1}º</td>
                            <td>Equipe ${eq.numero}</td>
                            <td>${eq.totalIntegrantes}</td>
                            <td>${eq.totalProducoes}</td>
                            <td>${eq.totalObras}</td>
                            <td>${eq.totalQuantidade.toFixed(2)}</td>
                            <td class="valor positivo">${this.formatarMoeda(eq.totalValor)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderizarAnaliseServicos() {
        const { analiseServicos } = this.dataCache;
        
        const top5 = analiseServicos.slice(0, 5);

        if (top5.length === 0) {
            return '<p class="no-data">Nenhum serviço encontrado</p>';
        }

        return `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Propostas</th>
                        <th>Qtd. Contratada</th>
                        <th>Valor Contratado</th>
                        <th>Valor Medido</th>
                    </tr>
                </thead>
                <tbody>
                    ${top5.map((s, i) => `
                        <tr>
                            <td class="rank-num">${i + 1}º</td>
                            <td>${s.codigo}</td>
                            <td class="descricao-truncada" title="${s.descricao}">${s.descricao.substring(0, 30)}${s.descricao.length > 30 ? '...' : ''}</td>
                            <td>${s.totalPropostas}</td>
                            <td>${s.totalQuantidadeContratada.toFixed(2)} ${s.unidade}</td>
                            <td class="valor">${this.formatarMoeda(s.valorTotalContratado)}</td>
                            <td class="valor positivo">${this.formatarMoeda(s.valorTotalMedido)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <button class="btn-ver-todos" onclick="dashboardHVC.mostrarTodosServicos()">
                <i class="fas fa-list"></i> Ver Todos
            </button>
        `;
    }

    renderizarGraficos() {
        // Gráfico de evolução mensal
        const ctx = document.getElementById('chart-evolucao');
        if (!ctx) return;

        const { medicoes } = this.dataCache;

        // Agrupar medições por mês
        const medicoesporMes = {};
        medicoes.forEach(m => {
            const data = new Date(m.created_at);
            const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
            if (!medicoesporMes[mesAno]) {
                medicoesporMes[mesAno] = { medido: 0, recebido: 0 };
            }
            medicoesporMes[mesAno].medido += parseFloat(m.valor_total) || 0;
            medicoesporMes[mesAno].recebido += parseFloat(m.valor_recebido) || 0;
        });

        // Ordenar por data
        const meses = Object.keys(medicoesporMes).sort((a, b) => {
            const [mesA, anoA] = a.split('/').map(Number);
            const [mesB, anoB] = b.split('/').map(Number);
            return (anoA * 12 + mesA) - (anoB * 12 + mesB);
        }).slice(-6); // Últimos 6 meses

        const dadosMedido = meses.map(m => medicoesporMes[m].medido);
        const dadosRecebido = meses.map(m => medicoesporMes[m].recebido);

        // Destruir gráfico anterior se existir
        if (this.charts.evolucao) {
            this.charts.evolucao.destroy();
        }

        this.charts.evolucao = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Valor Medido',
                        data: dadosMedido,
                        backgroundColor: 'rgba(173, 216, 230, 0.7)',
                        borderColor: '#add8e6',
                        borderWidth: 1
                    },
                    {
                        label: 'Valor Recebido',
                        data: dadosRecebido,
                        backgroundColor: 'rgba(32, 201, 151, 0.7)',
                        borderColor: '#20c997',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e6e6fa'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#c0c0c0' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        ticks: { 
                            color: '#c0c0c0',
                            callback: (value) => this.formatarMoedaCurta(value)
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    // =========================================================================
    // MODAIS
    // =========================================================================
    mostrarTodosIntegrantes() {
        const { produtividadeIntegrantes } = this.dataCache;
        
        const modalHtml = `
            <div class="modal-overlay" onclick="dashboardHVC.fecharModal()">
                <div class="modal-content modal-large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="fas fa-users"></i> Produtividade - Todos os Integrantes</h2>
                        <button class="modal-close" onclick="dashboardHVC.fecharModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>Pos</th>
                                    <th>Integrante</th>
                                    <th>Status</th>
                                    <th>Produções</th>
                                    <th>Obras</th>
                                    <th>Qtd. Total</th>
                                    <th>Valor Produzido</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${produtividadeIntegrantes.map((int, i) => `
                                    <tr class="${!int.ativo ? 'inativo' : ''}">
                                        <td class="rank-num">${i + 1}º</td>
                                        <td>${int.nome}</td>
                                        <td><span class="status-badge ${int.ativo ? 'ativo' : 'inativo'}">${int.ativo ? 'Ativo' : 'Inativo'}</span></td>
                                        <td>${int.totalProducoes}</td>
                                        <td>${int.totalObras}</td>
                                        <td>${int.totalQuantidade.toFixed(2)}</td>
                                        <td class="valor positivo">${this.formatarMoeda(int.totalValor)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    mostrarTodosServicos() {
        const { analiseServicos } = this.dataCache;
        
        const modalHtml = `
            <div class="modal-overlay" onclick="dashboardHVC.fecharModal()">
                <div class="modal-content modal-large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="fas fa-tools"></i> Análise de Serviços - Completa</h2>
                        <button class="modal-close" onclick="dashboardHVC.fecharModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>Pos</th>
                                    <th>Código</th>
                                    <th>Descrição</th>
                                    <th>Unidade</th>
                                    <th>Propostas</th>
                                    <th>Qtd. Contratada</th>
                                    <th>Valor Contratado</th>
                                    <th>Qtd. Medida</th>
                                    <th>Valor Medido</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${analiseServicos.map((s, i) => `
                                    <tr>
                                        <td class="rank-num">${i + 1}º</td>
                                        <td>${s.codigo}</td>
                                        <td title="${s.descricao}">${s.descricao}</td>
                                        <td>${s.unidade}</td>
                                        <td>${s.totalPropostas}</td>
                                        <td>${s.totalQuantidadeContratada.toFixed(2)}</td>
                                        <td class="valor">${this.formatarMoeda(s.valorTotalContratado)}</td>
                                        <td>${s.totalQuantidadeMedida.toFixed(2)}</td>
                                        <td class="valor positivo">${this.formatarMoeda(s.valorTotalMedido)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    fecharModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    }

    // =========================================================================
    // AÇÕES
    // =========================================================================
    async atualizarDados() {
        const btn = document.querySelector('.btn-atualizar');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
            btn.disabled = true;
        }

        try {
            await this.carregarDados();
            this.renderizarDashboard();
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            alert('Erro ao atualizar dados. Tente novamente.');
        } finally {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
                btn.disabled = false;
            }
        }
    }

    alterarPeriodo(periodo) {
        const hoje = new Date();
        
        switch (periodo) {
            case 'mensal':
                this.filtros.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                this.filtros.dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                break;
            case 'trimestral':
                const trimestre = Math.floor(hoje.getMonth() / 3);
                this.filtros.dataInicio = new Date(hoje.getFullYear(), trimestre * 3, 1);
                this.filtros.dataFim = new Date(hoje.getFullYear(), (trimestre + 1) * 3, 0);
                break;
            case 'anual':
                this.filtros.dataInicio = new Date(hoje.getFullYear(), 0, 1);
                this.filtros.dataFim = new Date(hoje.getFullYear(), 11, 31);
                break;
            case 'todos':
                this.filtros.dataInicio = new Date(2020, 0, 1);
                this.filtros.dataFim = hoje;
                break;
        }

        this.filtros.periodo = periodo;
        this.atualizarDados();
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

    formatarMoedaCurta(valor) {
        if (valor >= 1000000) {
            return 'R$ ' + (valor / 1000000).toFixed(1) + 'M';
        } else if (valor >= 1000) {
            return 'R$ ' + (valor / 1000).toFixed(0) + 'K';
        }
        return 'R$ ' + valor.toFixed(0);
    }
}

// Instância global
let dashboardHVC;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar carregamento do Supabase
    setTimeout(() => {
        dashboardHVC = new DashboardHVC();
        dashboardHVC.init();
        window.dashboardHVC = dashboardHVC;
    }, 1000);
});
