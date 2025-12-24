// =========================================================================
// DASHBOARD HVC - ADMINISTRATIVO
// Versão: 2.1
// Data: 23/12/2024
// =========================================================================

// Importar supabaseClient do módulo supabase.js
import { supabase as supabaseClient } from './supabase.js';

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
            servicos: { column: 'valorTotalContratado', ascending: false },
            propostas: { column: 'valorTotal', ascending: false }
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
        
        // Mostrar conteudo e esconder loading
        const loading = document.getElementById('dashboard-loading');
        const content = document.getElementById('dashboard-content');
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
        
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
                analisePropostas,
                producoes
            ] = await Promise.all([
                this.carregarResumoObras(),
                this.carregarProdutividadeIntegrantes(),
                this.carregarProdutividadeEquipes(),
                this.carregarAnaliseServicos(),
                this.carregarAnalisePropostas(),
                this.carregarProducoes()
            ]);

            this.dataCache = {
                resumoObras,
                produtividadeIntegrantes,
                produtividadeEquipes,
                analiseServicos,
                analisePropostas,
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

        // Buscar equipes para ter o número
        const { data: equipes, error: errEq } = await supabaseClient
            .from('equipes_hvc')
            .select('id, numero');
        
        // Criar mapa de equipe ID -> número
        const equipeNumeroMap = {};
        (equipes || []).forEach(eq => {
            equipeNumeroMap[String(eq.id)] = eq.numero;
        });

        // Buscar relacionamentos equipe-integrante para saber quais equipes cada integrante participa
        const { data: relacoesEquipe, error: errRelEq } = await supabaseClient
            .from('equipe_integrantes')
            .select('equipe_id, integrante_id');
        
        // Criar mapa de integrante -> equipes
        const integranteEquipesMap = {};
        (relacoesEquipe || []).forEach(rel => {
            const intId = String(rel.integrante_id);
            if (!integranteEquipesMap[intId]) {
                integranteEquipesMap[intId] = new Set();
            }
            integranteEquipesMap[intId].add(String(rel.equipe_id));
        });
        
        // Criar mapa de equipe -> quantidade de integrantes
        const equipeMembrosMap = {};
        (relacoesEquipe || []).forEach(rel => {
            const eqId = String(rel.equipe_id);
            if (!equipeMembrosMap[eqId]) {
                equipeMembrosMap[eqId] = 0;
            }
            equipeMembrosMap[eqId]++;
        });
        
        console.log('Mapa de membros por equipe:', equipeMembrosMap);

        // Buscar TODAS as produções (individuais e de equipe) com filtro de data
        let queryProducoes = supabaseClient
            .from('producoes_diarias_hvc')
            .select('*');
        
        if (this.filtros.dataInicio) {
            queryProducoes = queryProducoes.gte('data_producao', this.filtros.dataInicio.toISOString().split('T')[0]);
        }
        if (this.filtros.dataFim) {
            queryProducoes = queryProducoes.lte('data_producao', this.filtros.dataFim.toISOString().split('T')[0]);
        }

        const { data: todasProducoes, error: errProd } = await queryProducoes;
        if (errProd) throw errProd;

        // Buscar itens de proposta para preços
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, servico_id, preco_mao_obra, preco_material, preco_total, quantidade');

        if (errItens) throw errItens;

        // Buscar serviços para nomes
        const { data: servicos, error: errServ } = await supabaseClient
            .from('servicos_hvc')
            .select('id, codigo, descricao, unidade');

        // Buscar obras para nomes
        const { data: obras, error: errObras } = await supabaseClient
            .from('obras_hvc')
            .select('id, numero_obra');

        // Criar mapa de obras
        const obrasMap = {};
        (obras || []).forEach(o => {
            obrasMap[o.id] = o.numero_obra;
        });

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

        // Separar produções individuais e de equipe
        const producoesIndividuais = (todasProducoes || []).filter(p => p.tipo_responsavel === 'integrante');
        const producoesEquipes = (todasProducoes || []).filter(p => p.tipo_responsavel === 'equipe');

        console.log('Produções individuais encontradas:', producoesIndividuais.length);
        console.log('Produções de equipes encontradas:', producoesEquipes.length);
        
        // Calcular produtividade por integrante
        const produtividadeMap = {};
        
        // Processar produções INDIVIDUAIS
        producoesIndividuais.forEach(prod => {
            const integranteId = String(prod.responsavel_id);
            if (!produtividadeMap[integranteId]) {
                produtividadeMap[integranteId] = {
                    producoesIndividuais: [],
                    producoesEmEquipe: [],
                    totalProducoesIndividuais: 0,
                    totalProducoesEmEquipe: 0,
                    totalQuantidadeIndividual: 0,
                    totalQuantidadeEmEquipe: 0,
                    totalValorIndividual: 0,
                    totalValorEmEquipe: 0,
                    obrasIndividuais: new Set(),
                    obrasEmEquipe: new Set(),
                    servicosIndividuais: {},
                    servicosEmEquipe: {}
                };
            }

            produtividadeMap[integranteId].totalProducoesIndividuais++;
            produtividadeMap[integranteId].obrasIndividuais.add(prod.obra_id);

            const producaoInfo = {
                id: prod.id,
                data: prod.data_producao,
                obraId: prod.obra_id,
                obraNumero: obrasMap[prod.obra_id] || 'N/A',
                servicos: []
            };

            // Processar quantidades_servicos
            if (prod.quantidades_servicos && typeof prod.quantidades_servicos === 'object') {
                Object.entries(prod.quantidades_servicos).forEach(([itemId, quantidade]) => {
                    const qtd = parseFloat(quantidade) || 0;
                    const precoUnitario = precoMap[itemId] || 0;
                    const servicoId = itemServicoMap[itemId];
                    const servico = servicoMap[servicoId] || {};
                    
                    produtividadeMap[integranteId].totalQuantidadeIndividual += qtd;
                    produtividadeMap[integranteId].totalValorIndividual += qtd * precoUnitario;
                    
                    producaoInfo.servicos.push({
                        codigo: servico.codigo || 'N/A',
                        descricao: servico.descricao || 'Serviço',
                        unidade: servico.unidade || 'UN',
                        quantidade: qtd,
                        valor: qtd * precoUnitario
                    });

                    // Acumular por serviço
                    if (servicoId) {
                        if (!produtividadeMap[integranteId].servicosIndividuais[servicoId]) {
                            produtividadeMap[integranteId].servicosIndividuais[servicoId] = {
                                codigo: servico.codigo || 'N/A',
                                descricao: servico.descricao || 'Serviço',
                                unidade: servico.unidade || 'UN',
                                quantidade: 0,
                                valor: 0
                            };
                        }
                        produtividadeMap[integranteId].servicosIndividuais[servicoId].quantidade += qtd;
                        produtividadeMap[integranteId].servicosIndividuais[servicoId].valor += qtd * precoUnitario;
                    }
                });
            }

            produtividadeMap[integranteId].producoesIndividuais.push(producaoInfo);
        });

        // Processar produções EM EQUIPE (atribuir a cada integrante da equipe, DIVIDINDO pelo número de membros)
        producoesEquipes.forEach(prod => {
            const equipeId = String(prod.responsavel_id);
            
            // Obter número de membros da equipe para divisão proporcional
            const numMembros = equipeMembrosMap[equipeId] || 1;
            
            // Encontrar todos os integrantes desta equipe
            (integrantes || []).forEach(int => {
                const intId = String(int.id);
                const equipesDoIntegrante = integranteEquipesMap[intId] || new Set();
                
                if (equipesDoIntegrante.has(equipeId)) {
                    // Este integrante faz parte desta equipe
                    if (!produtividadeMap[intId]) {
                        produtividadeMap[intId] = {
                            producoesIndividuais: [],
                            producoesEmEquipe: [],
                            totalProducoesIndividuais: 0,
                            totalProducoesEmEquipe: 0,
                            totalQuantidadeIndividual: 0,
                            totalQuantidadeEmEquipe: 0,
                            totalValorIndividual: 0,
                            totalValorEmEquipe: 0,
                            obrasIndividuais: new Set(),
                            obrasEmEquipe: new Set(),
                            servicosIndividuais: {},
                            servicosEmEquipe: {}
                        };
                    }

                    produtividadeMap[intId].totalProducoesEmEquipe++;
                    produtividadeMap[intId].obrasEmEquipe.add(prod.obra_id);

                    const producaoInfo = {
                        id: prod.id,
                        data: prod.data_producao,
                        obraId: prod.obra_id,
                        obraNumero: obrasMap[prod.obra_id] || 'N/A',
                        equipeId: equipeId,
                        equipeNumero: equipeNumeroMap[equipeId] || equipeId,
                        numMembrosEquipe: numMembros, // Guardar para referência
                        servicos: []
                    };

                    // Processar quantidades_servicos - DIVIDIR pelo número de membros
                    if (prod.quantidades_servicos && typeof prod.quantidades_servicos === 'object') {
                        Object.entries(prod.quantidades_servicos).forEach(([itemId, quantidade]) => {
                            const qtdTotal = parseFloat(quantidade) || 0;
                            const precoUnitario = precoMap[itemId] || 0;
                            const servicoId = itemServicoMap[itemId];
                            const servico = servicoMap[servicoId] || {};
                            
                            // DIVIDIR quantidade e valor pelo número de membros da equipe
                            const qtdProporcional = qtdTotal / numMembros;
                            const valorProporcional = (qtdTotal * precoUnitario) / numMembros;
                            
                            produtividadeMap[intId].totalQuantidadeEmEquipe += qtdProporcional;
                            produtividadeMap[intId].totalValorEmEquipe += valorProporcional;
                            
                            producaoInfo.servicos.push({
                                codigo: servico.codigo || 'N/A',
                                descricao: servico.descricao || 'Serviço',
                                unidade: servico.unidade || 'UN',
                                quantidade: qtdProporcional,
                                quantidadeTotal: qtdTotal, // Guardar total para referência
                                valor: valorProporcional,
                                valorTotal: qtdTotal * precoUnitario, // Guardar total para referência
                                numMembros: numMembros
                            });

                            // Acumular por serviço - também proporcional
                            if (servicoId) {
                                if (!produtividadeMap[intId].servicosEmEquipe[servicoId]) {
                                    produtividadeMap[intId].servicosEmEquipe[servicoId] = {
                                        codigo: servico.codigo || 'N/A',
                                        descricao: servico.descricao || 'Serviço',
                                        unidade: servico.unidade || 'UN',
                                        quantidade: 0,
                                        valor: 0,
                                        producoes: [] // Lista de produções para detalhamento
                                    };
                                }
                                produtividadeMap[intId].servicosEmEquipe[servicoId].quantidade += qtdProporcional;
                                produtividadeMap[intId].servicosEmEquipe[servicoId].valor += valorProporcional;
                                
                                // Guardar detalhes da produção para o modal de detalhes
                                produtividadeMap[intId].servicosEmEquipe[servicoId].producoes.push({
                                    producaoId: prod.id,
                                    data: prod.data_producao,
                                    obraId: prod.obra_id,
                                    obraNumero: obrasMap[prod.obra_id] || 'N/A',
                                    equipeId: equipeId,
                                    equipeNumero: equipeNumeroMap[equipeId] || equipeId,
                                    quantidade: qtdProporcional,
                                    quantidadeTotal: qtdTotal,
                                    valor: valorProporcional,
                                    valorTotal: qtdTotal * precoUnitario,
                                    numMembros: numMembros
                                });
                            }
                        });
                    }

                    produtividadeMap[intId].producoesEmEquipe.push(producaoInfo);
                }
            });
        });

        console.log('Mapa de produtividade:', Object.keys(produtividadeMap));
        
        // Montar resultado
        return (integrantes || []).map(int => {
            const intId = String(int.id);
            const dados = produtividadeMap[intId] || {
                producoesIndividuais: [],
                producoesEmEquipe: [],
                totalProducoesIndividuais: 0,
                totalProducoesEmEquipe: 0,
                totalQuantidadeIndividual: 0,
                totalQuantidadeEmEquipe: 0,
                totalValorIndividual: 0,
                totalValorEmEquipe: 0,
                obrasIndividuais: new Set(),
                obrasEmEquipe: new Set(),
                servicosIndividuais: {},
                servicosEmEquipe: {}
            };
            
            // Combinar obras individuais e em equipe (sem duplicatas)
            const todasObras = new Set([...dados.obrasIndividuais, ...dados.obrasEmEquipe]);
            
            return {
                id: int.id,
                nome: int.nome,
                cpf: int.cpf,
                ativo: int.ativo,
                totalProducoes: dados.totalProducoesIndividuais + dados.totalProducoesEmEquipe,
                totalProducoesIndividuais: dados.totalProducoesIndividuais,
                totalProducoesEmEquipe: dados.totalProducoesEmEquipe,
                totalQuantidade: dados.totalQuantidadeIndividual + dados.totalQuantidadeEmEquipe,
                totalQuantidadeIndividual: dados.totalQuantidadeIndividual,
                totalQuantidadeEmEquipe: dados.totalQuantidadeEmEquipe,
                totalValor: dados.totalValorIndividual + dados.totalValorEmEquipe,
                totalValorIndividual: dados.totalValorIndividual,
                totalValorEmEquipe: dados.totalValorEmEquipe,
                totalObras: todasObras.size,
                producoesIndividuais: dados.producoesIndividuais,
                producoesEmEquipe: dados.producoesEmEquipe,
                servicosIndividuais: dados.servicosIndividuais,
                servicosEmEquipe: dados.servicosEmEquipe
            };
        }).sort((a, b) => b.totalValor - a.totalValor);
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

        // Contar integrantes por equipe (converter IDs para string)
        const integrantesPorEquipe = {};
        (relacoes || []).forEach(rel => {
            const equipeId = String(rel.equipe_id);
            if (!integrantesPorEquipe[equipeId]) {
                integrantesPorEquipe[equipeId] = new Set();
            }
            integrantesPorEquipe[equipeId].add(rel.integrante_id);
        });

        // Buscar produções de equipes com filtro de data
        let query = supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .eq('tipo_responsavel', 'equipe');
        
        if (this.filtros.dataInicio) {
            query = query.gte('data_producao', this.filtros.dataInicio.toISOString().split('T')[0]);
        }
        if (this.filtros.dataFim) {
            query = query.lte('data_producao', this.filtros.dataFim.toISOString().split('T')[0]);
        }

        const { data: producoes, error: errProd } = await query;
        if (errProd) throw errProd;

        // Buscar itens de proposta para preços
        const { data: itensProposta, error: errItens } = await supabaseClient
            .from('itens_proposta_hvc')
            .select('id, servico_id, preco_total, quantidade, proposta_id');

        if (errItens) throw errItens;

        // Buscar serviços para nomes
        const { data: servicos, error: errServ } = await supabaseClient
            .from('servicos_hvc')
            .select('id, codigo, descricao, unidade');

        if (errServ) throw errServ;

        // Buscar obras para nomes
        const { data: obras, error: errObras } = await supabaseClient
            .from('obras_hvc')
            .select(`
                id, 
                numero_obra,
                obras_propostas (
                    propostas_hvc (
                        id,
                        clientes_hvc (nome)
                    )
                )
            `);

        // Criar mapa de obras com nome do cliente
        const obrasMap = {};
        (obras || []).forEach(o => {
            const proposta = o.obras_propostas?.[0]?.propostas_hvc;
            const clienteNome = proposta?.clientes_hvc?.nome || 'Cliente N/A';
            obrasMap[o.id] = {
                numero: o.numero_obra,
                cliente: clienteNome
            };
        });

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

        console.log('Produções de equipes encontradas:', producoes?.length || 0);
        
        // Calcular produtividade por equipe
        const produtividadeMap = {};
        (producoes || []).forEach(prod => {
            const equipeId = String(prod.responsavel_id);
            if (!produtividadeMap[equipeId]) {
                produtividadeMap[equipeId] = {
                    totalProducoes: 0,
                    totalQuantidade: 0,
                    totalValor: 0,
                    obras: new Set(),
                    servicosPorObra: {} // Serviços agrupados por obra para o modal
                };
            }

            produtividadeMap[equipeId].totalProducoes++;
            produtividadeMap[equipeId].obras.add(prod.obra_id);

            // Inicializar obra no mapa se não existir
            if (!produtividadeMap[equipeId].servicosPorObra[prod.obra_id]) {
                const obraInfo = obrasMap[prod.obra_id] || { numero: 'N/A', cliente: 'N/A' };
                produtividadeMap[equipeId].servicosPorObra[prod.obra_id] = {
                    obraNumero: obraInfo.numero,
                    obraCliente: obraInfo.cliente,
                    servicos: {}
                };
            }

            // Processar quantidades_servicos (é um OBJETO)
            if (prod.quantidades_servicos && typeof prod.quantidades_servicos === 'object') {
                Object.entries(prod.quantidades_servicos).forEach(([itemId, quantidade]) => {
                    const qtd = parseFloat(quantidade) || 0;
                    const precoUnitario = precoMap[itemId] || 0;
                    const servicoId = itemServicoMap[itemId];
                    
                    produtividadeMap[equipeId].totalQuantidade += qtd;
                    produtividadeMap[equipeId].totalValor += qtd * precoUnitario;
                    
                    // Acumular por serviço dentro da obra
                    if (servicoId) {
                        const servicosObra = produtividadeMap[equipeId].servicosPorObra[prod.obra_id].servicos;
                        if (!servicosObra[servicoId]) {
                            const servico = servicoMap[servicoId] || {};
                            servicosObra[servicoId] = {
                                codigo: servico.codigo || 'N/A',
                                descricao: servico.descricao || 'Serviço não identificado',
                                unidade: servico.unidade || 'UN',
                                quantidade: 0,
                                valor: 0
                            };
                        }
                        servicosObra[servicoId].quantidade += qtd;
                        servicosObra[servicoId].valor += qtd * precoUnitario;
                    }
                });
            }
        });
        
        // Montar resultado
        return (equipes || []).map(eq => {
            const eqId = String(eq.id);
            return {
                id: eq.id,
                numero: eq.numero,
                ativa: eq.ativa,
                totalIntegrantes: integrantesPorEquipe[eqId]?.size || 0,
                totalProducoes: produtividadeMap[eqId]?.totalProducoes || 0,
                totalQuantidade: produtividadeMap[eqId]?.totalQuantidade || 0,
                totalValor: produtividadeMap[eqId]?.totalValor || 0,
                totalObras: produtividadeMap[eqId]?.obras?.size || 0,
                servicosPorObra: produtividadeMap[eqId]?.servicosPorObra || {}
            };
        }).sort((a, b) => b.totalValor - a.totalValor);
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

    async carregarAnalisePropostas() {
        // Buscar propostas com informações de cliente e itens
        const { data: propostas, error: errProp } = await supabaseClient
            .from('propostas_hvc')
            .select(`
                id,
                numero_proposta,
                total_proposta,
                status,
                created_at,
                clientes_hvc (id, nome),
                itens_proposta_hvc (id, quantidade, preco_total)
            `)
            .order('created_at', { ascending: false });

        if (errProp) throw errProp;

        // Buscar obras vinculadas às propostas
        const { data: obrasPropostas, error: errOP } = await supabaseClient
            .from('obras_propostas')
            .select('proposta_id, obra_id, obras_hvc (id, numero_obra, status)');

        // Criar mapa de proposta -> obra
        const propostaObraMap = {};
        (obrasPropostas || []).forEach(op => {
            if (!propostaObraMap[op.proposta_id]) {
                propostaObraMap[op.proposta_id] = [];
            }
            if (op.obras_hvc) {
                propostaObraMap[op.proposta_id].push(op.obras_hvc);
            }
        });

        // Processar propostas
        return (propostas || []).map(prop => {
            const obras = propostaObraMap[prop.id] || [];
            const temObra = obras.length > 0;
            const obraAtiva = obras.some(o => o.status === 'ANDAMENTO' || o.status === 'PLANEJAMENTO');
            const totalItens = (prop.itens_proposta_hvc || []).length;
            const valorTotal = parseFloat(prop.total_proposta) || 0;

            // Usar status real da proposta do banco de dados
            // Se tem obra ativa, adicionar indicação visual
            let statusProposta = prop.status || 'Pendente';
            if (temObra && obraAtiva) {
                statusProposta = 'Em Execução';
            }

            return {
                id: prop.id,
                numero: prop.numero_proposta,
                cliente: prop.clientes_hvc?.nome || 'Cliente N/A',
                clienteId: prop.clientes_hvc?.id,
                valorTotal,
                totalItens,
                status: statusProposta,
                temObra,
                obras: obras.map(o => o.numero_obra).join(', ') || '-',
                dataCriacao: prop.created_at
            };
        });
    }

    async carregarProducoes() {
        let query = supabaseClient
            .from('producoes_diarias_hvc')
            .select('*')
            .order('data_producao', { ascending: false });

        if (this.filtros.dataInicio) {
            query = query.gte('data_producao', this.filtros.dataInicio.toISOString().split('T')[0]);
        }
        if (this.filtros.dataFim) {
            query = query.lte('data_producao', this.filtros.dataFim.toISOString().split('T')[0]);
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
            case 'propostas':
                this.renderizarAnalisePropostas();
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
        this.renderizarAnalisePropostas();
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

    renderizarRankingObras() {
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

        const obrasExibir = obras.slice(0, 5);
        const sortIcon = (col) => config.column === col ? (config.ascending ? '↑' : '↓') : '';

        container.innerHTML = `
            <div class="section-header">
                <h3>🏆 Top 5 Obras por Valor</h3>
            </div>
            <div class="table-responsive">
                <table class="dashboard-table sortable">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('obras', 'numero')">OBRA ${sortIcon('numero')}</th>
                            <th>CLIENTE</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('obras', 'valor_contratado')">CONTRATADO ${sortIcon('valor_contratado')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('obras', 'valor_medido')">MEDIDO ${sortIcon('valor_medido')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('obras', 'valor_recebido')">RECEBIDO ${sortIcon('valor_recebido')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('obras', 'percentual_andamento')">ANDAMENTO ${sortIcon('percentual_andamento')}</th>
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
            <button class="btn-ver-todos" onclick="window.dashboardHVC.abrirModalVerTodos('obras')">
                📋 Ver Todos
            </button>
        `;
    }

    renderizarProdutividadeIntegrantes() {
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

        const integrantesExibir = integrantes.slice(0, 5);
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
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('integrantes', 'nome')">INTEGRANTE ${sortIcon('nome')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('integrantes', 'totalProducoes')">PRODUÇÕES ${sortIcon('totalProducoes')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('integrantes', 'totalObras')">OBRAS ${sortIcon('totalObras')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('integrantes', 'totalQuantidade')">QTD. TOTAL ${sortIcon('totalQuantidade')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('integrantes', 'totalValor')">VALOR PRODUZIDO ${sortIcon('totalValor')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${integrantesExibir.map((int, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td class="nome-clicavel" onclick="window.dashboardHVC.abrirModalDetalhesIntegrante('${int.id}')" style="cursor: pointer; color: #add8e6; text-decoration: underline;">${int.nome}</td>
                                <td>${int.totalProducoes}</td>
                                <td>${int.totalObras}</td>
                                <td>${int.totalQuantidade.toFixed(2)}</td>
                                <td class="${int.totalValor > 0 ? 'valor-positivo' : 'valor-zero'}">${this.formatarMoeda(int.totalValor)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="window.dashboardHVC.abrirModalVerTodos('integrantes')">
                📋 Ver Todos
            </button>
        `;
    }

    renderizarProdutividadeEquipes() {
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

        const equipesExibir = equipes.slice(0, 5);
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
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('equipes', 'numero')">EQUIPE ${sortIcon('numero')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('equipes', 'totalIntegrantes')">INTEGRANTES ${sortIcon('totalIntegrantes')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('equipes', 'totalProducoes')">PRODUÇÕES ${sortIcon('totalProducoes')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('equipes', 'totalObras')">OBRAS ${sortIcon('totalObras')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('equipes', 'totalValor')">VALOR PRODUZIDO ${sortIcon('totalValor')}</th>
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
                                <td class="${eq.totalValor > 0 ? 'valor-positivo' : 'valor-zero'}">${this.formatarMoeda(eq.totalValor)}</td>
                                <td>
                                    <button class="btn-detalhes" onclick="window.dashboardHVC.abrirModalDetalhesEquipe('${eq.id}')" title="Ver detalhes">
                                        📊
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="window.dashboardHVC.abrirModalVerTodos('equipes')">
                📋 Ver Todos
            </button>
        `;
    }

    abrirModalDetalhesEquipe(equipeId) {
        const equipe = this.dataCache.produtividadeEquipes.find(e => e.id === equipeId);
        if (!equipe) return;

        // Construir lista de serviços por obra
        const servicosPorObra = equipe.servicosPorObra || {};
        let servicosHtml = '';
        let totalGeral = 0;

        Object.entries(servicosPorObra).forEach(([obraId, obraData]) => {
            const servicos = Object.values(obraData.servicos || {});
            servicos.forEach(s => {
                totalGeral += s.valor;
                servicosHtml += `
                    <tr>
                        <td>${obraData.obraNumero}<br><small style="color: #888;">(${obraData.obraCliente})</small></td>
                        <td>${s.codigo}</td>
                        <td>${s.descricao}</td>
                        <td>${s.unidade}</td>
                        <td>${s.quantidade.toFixed(2)}</td>
                        <td class="valor-positivo">${this.formatarMoeda(s.valor)}</td>
                    </tr>
                `;
            });
        });

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
                    <button class="modal-close" onclick="window.dashboardHVC.fecharModal('modal-detalhes-equipe')">×</button>
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
                            <span class="summary-value">${this.formatarMoeda(totalGeral)}</span>
                        </div>
                    </div>
                    <h4>Serviços Produzidos por Obra</h4>
                    <div class="table-responsive">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>OBRA</th>
                                    <th>CÓDIGO</th>
                                    <th>SERVIÇO</th>
                                    <th>UNIDADE</th>
                                    <th>QUANTIDADE</th>
                                    <th>VALOR</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${servicosHtml || '<tr><td colspan="6" class="empty-message">Nenhum serviço produzido no período</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    // Função genérica para fechar modais
    fecharModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    fecharModalDetalhesEquipe() {
        this.fecharModal('modal-detalhes-equipe');
    }

    renderizarAnaliseServicos() {
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

        const servicosExibir = servicos.slice(0, 5);
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
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('servicos', 'codigo')">CÓDIGO ${sortIcon('codigo')}</th>
                            <th>SERVIÇO</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('servicos', 'totalPropostas')">PROPOSTAS ${sortIcon('totalPropostas')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('servicos', 'totalQuantidadeContratada')">QTD. CONTRATADA ${sortIcon('totalQuantidadeContratada')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('servicos', 'valorTotalContratado')">VALOR CONTRATADO ${sortIcon('valorTotalContratado')}</th>
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
            <button class="btn-ver-todos" onclick="window.dashboardHVC.abrirModalVerTodos('servicos')">
                📋 Ver Todos
            </button>
        `;
    }

    renderizarAnalisePropostas() {
        const container = document.getElementById('analise-propostas-container');
        if (!container) return;

        let propostas = [...(this.dataCache.analisePropostas || [])];
        
        // Ordenar por valor total (decrescente)
        const config = this.sortConfig.propostas || { column: 'valorTotal', ascending: false };
        propostas.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            if (typeof valorA === 'string') {
                return config.ascending ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
            }
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        const propostasExibir = propostas.slice(0, 5);
        const sortIcon = (col) => config.column === col ? (config.ascending ? '↑' : '↓') : '';

        // Função para cor do status
        const getStatusClass = (status) => {
            const statusLower = (status || '').toLowerCase();
            if (statusLower.includes('execução') || statusLower.includes('execucao')) return 'status-execucao';
            if (statusLower.includes('aprovad')) return 'status-aprovada';
            if (statusLower.includes('pendent')) return 'status-pendente';
            if (statusLower.includes('recusad') || statusLower.includes('cancelad')) return 'status-recusada';
            return '';
        };

        container.innerHTML = `
            <div class="section-header">
                <h3>📝 Análise de Propostas</h3>
            </div>
            <div class="table-responsive">
                <table class="dashboard-table sortable">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('propostas', 'numero')">PROPOSTA ${sortIcon('numero')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('propostas', 'cliente')">CLIENTE ${sortIcon('cliente')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('propostas', 'valorTotal')">VALOR ${sortIcon('valorTotal')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('propostas', 'totalItens')">ITENS ${sortIcon('totalItens')}</th>
                            <th class="sortable-header" onclick="window.dashboardHVC.ordenarDados('propostas', 'status')">STATUS ${sortIcon('status')}</th>
                            <th>OBRA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${propostasExibir.map((prop, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>${prop.numero || 'N/A'}</td>
                                <td>${prop.cliente}</td>
                                <td class="valor-positivo">${this.formatarMoeda(prop.valorTotal)}</td>
                                <td>${prop.totalItens}</td>
                                <td class="${getStatusClass(prop.status)}">${prop.status}</td>
                                <td>${prop.obras}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-ver-todos" onclick="window.dashboardHVC.abrirModalVerTodos('propostas')">
                📋 Ver Todos
            </button>
        `;
    }

    // =========================================================================
    // MODAIS VER TODOS
    // =========================================================================
    abrirModalVerTodos(tipo) {
        let modal = document.getElementById('modal-ver-todos');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-ver-todos';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        let titulo = '';
        let conteudo = '';

        switch (tipo) {
            case 'obras':
                titulo = '🏆 Todas as Obras';
                conteudo = this.gerarTabelaObrasCompleta();
                break;
            case 'integrantes':
                titulo = '👥 Todos os Integrantes';
                conteudo = this.gerarTabelaIntegrantesCompleta();
                break;
            case 'equipes':
                titulo = '👥 Todas as Equipes';
                conteudo = this.gerarTabelaEquipesCompleta();
                break;
            case 'servicos':
                titulo = '📋 Todos os Serviços';
                conteudo = this.gerarTabelaServicosCompleta();
                break;
            case 'propostas':
                titulo = '📝 Todas as Propostas';
                conteudo = this.gerarTabelaPropostasCompleta();
                break;
        }

        modal.innerHTML = `
            <div class="modal-content modal-xl">
                <div class="modal-header">
                    <h3>${titulo}</h3>
                    <button class="modal-close" onclick="window.dashboardHVC.fecharModal('modal-ver-todos')">×</button>
                </div>
                <div class="modal-body">
                    ${conteudo}
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    gerarTabelaObrasCompleta() {
        const obras = [...(this.dataCache.resumoObras || [])];
        const config = this.sortConfig.obras;
        obras.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        return `
            <div class="table-responsive">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>OBRA</th>
                            <th>CLIENTE</th>
                            <th>CONTRATADO</th>
                            <th>MEDIDO</th>
                            <th>RECEBIDO</th>
                            <th>ANDAMENTO</th>
                            <th>DESPESAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${obras.map((obra, idx) => `
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
        `;
    }

    gerarTabelaIntegrantesCompleta() {
        const integrantes = [...(this.dataCache.produtividadeIntegrantes || [])];
        const config = this.sortConfig.integrantes;
        integrantes.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        return `
            <div class="table-responsive">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>INTEGRANTE</th>
                            <th>PRODUÇÕES</th>
                            <th>OBRAS</th>
                            <th>QTD. TOTAL</th>
                            <th>VALOR PRODUZIDO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${integrantes.map((int, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td class="nome-clicavel" onclick="window.dashboardHVC.fecharModal('modal-ver-todos'); window.dashboardHVC.abrirModalDetalhesIntegrante('${int.id}');" style="cursor: pointer; color: #add8e6; text-decoration: underline;">${int.nome}</td>
                                <td>${int.totalProducoes}</td>
                                <td>${int.totalObras}</td>
                                <td>${int.totalQuantidade.toFixed(2)}</td>
                                <td class="${int.totalValor > 0 ? 'valor-positivo' : 'valor-zero'}">${this.formatarMoeda(int.totalValor)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    gerarTabelaEquipesCompleta() {
        const equipes = [...(this.dataCache.produtividadeEquipes || [])];
        const config = this.sortConfig.equipes;
        equipes.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        return `
            <div class="table-responsive">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>EQUIPE</th>
                            <th>INTEGRANTES</th>
                            <th>PRODUÇÕES</th>
                            <th>OBRAS</th>
                            <th>VALOR PRODUZIDO</th>
                            <th>DETALHES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${equipes.map((eq, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>Equipe ${eq.numero || 'N/A'}</td>
                                <td>${eq.totalIntegrantes}</td>
                                <td>${eq.totalProducoes}</td>
                                <td>${eq.totalObras}</td>
                                <td class="${eq.totalValor > 0 ? 'valor-positivo' : 'valor-zero'}">${this.formatarMoeda(eq.totalValor)}</td>
                                <td>
                                    <button class="btn-detalhes" onclick="window.dashboardHVC.fecharModal('modal-ver-todos'); window.dashboardHVC.abrirModalDetalhesEquipe('${eq.id}');" title="Ver detalhes">
                                        📊
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    gerarTabelaServicosCompleta() {
        const servicos = [...(this.dataCache.analiseServicos || [])];
        const config = this.sortConfig.servicos;
        servicos.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        return `
            <div class="table-responsive">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>CÓDIGO</th>
                            <th>SERVIÇO</th>
                            <th>PROPOSTAS</th>
                            <th>QTD. CONTRATADA</th>
                            <th>VALOR CONTRATADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${servicos.map((serv, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>${serv.codigo}</td>
                                <td>${serv.descricao}</td>
                                <td>${serv.totalPropostas}</td>
                                <td>${serv.totalQuantidadeContratada?.toFixed(2) || '0.00'} ${serv.unidade}</td>
                                <td class="valor-positivo">${this.formatarMoeda(serv.valorTotalContratado)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    gerarTabelaPropostasCompleta() {
        const propostas = [...(this.dataCache.analisePropostas || [])];
        const config = this.sortConfig.propostas || { column: 'valorTotal', ascending: false };
        propostas.sort((a, b) => {
            const valorA = a[config.column] || 0;
            const valorB = b[config.column] || 0;
            if (typeof valorA === 'string') {
                return config.ascending ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
            }
            return config.ascending ? valorA - valorB : valorB - valorA;
        });

        // Função para cor do status
        const getStatusClass = (status) => {
            const statusLower = (status || '').toLowerCase();
            if (statusLower.includes('execução') || statusLower.includes('execucao')) return 'status-execucao';
            if (statusLower.includes('aprovad')) return 'status-aprovada';
            if (statusLower.includes('pendent')) return 'status-pendente';
            if (statusLower.includes('recusad') || statusLower.includes('cancelad')) return 'status-recusada';
            return '';
        };

        return `
            <div class="table-responsive">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>PROPOSTA</th>
                            <th>CLIENTE</th>
                            <th>VALOR</th>
                            <th>ITENS</th>
                            <th>STATUS</th>
                            <th>OBRA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${propostas.map((prop, idx) => `
                            <tr>
                                <td class="pos-cell">${idx + 1}º</td>
                                <td>${prop.numero || 'N/A'}</td>
                                <td>${prop.cliente}</td>
                                <td class="valor-positivo">${this.formatarMoeda(prop.valorTotal)}</td>
                                <td>${prop.totalItens}</td>
                                <td class="${getStatusClass(prop.status)}">${prop.status}</td>
                                <td>${prop.obras}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // =========================================================================
    // MODAL DETALHES INTEGRANTE
    // =========================================================================
    abrirModalDetalhesIntegrante(integranteId) {
        const integrante = this.dataCache.produtividadeIntegrantes.find(i => i.id === integranteId);
        if (!integrante) return;

        // Salvar dados do integrante para uso no modal de detalhes do serviço
        this.integranteAtual = integrante;

        // Criar modal
        let modal = document.getElementById('modal-detalhes-integrante');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalhes-integrante';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        // Agrupar produções individuais por código de serviço
        const servicosIndividuais = integrante.servicosIndividuais || {};
        let servicosIndividuaisHtml = '';
        const servicosIndividuaisArray = Object.entries(servicosIndividuais).map(([servicoId, dados]) => ({
            servicoId,
            ...dados
        })).sort((a, b) => b.valor - a.valor);

        if (servicosIndividuaisArray.length > 0) {
            servicosIndividuaisArray.forEach(s => {
                servicosIndividuaisHtml += `
                    <tr>
                        <td>${s.codigo}</td>
                        <td>${s.descricao}</td>
                        <td class="clicavel" onclick="window.dashboardHVC.abrirModalDetalhesServicoIntegrante('${integranteId}', '${s.servicoId}', 'individual')" style="cursor: pointer; color: #add8e6; text-decoration: underline;">${s.quantidade.toFixed(2)} ${s.unidade}</td>
                        <td class="valor-positivo clicavel" onclick="window.dashboardHVC.abrirModalDetalhesServicoIntegrante('${integranteId}', '${s.servicoId}', 'individual')" style="cursor: pointer; text-decoration: underline;">${this.formatarMoeda(s.valor)}</td>
                    </tr>
                `;
            });
        }

        // Agrupar produções em equipe por código de serviço
        const servicosEmEquipe = integrante.servicosEmEquipe || {};
        let servicosEmEquipeHtml = '';
        const servicosEmEquipeArray = Object.entries(servicosEmEquipe).map(([servicoId, dados]) => ({
            servicoId,
            ...dados
        })).sort((a, b) => b.valor - a.valor);

        if (servicosEmEquipeArray.length > 0) {
            servicosEmEquipeArray.forEach(s => {
                servicosEmEquipeHtml += `
                    <tr>
                        <td>${s.codigo}</td>
                        <td>${s.descricao}</td>
                        <td class="clicavel" onclick="window.dashboardHVC.abrirModalDetalhesServicoIntegrante('${integranteId}', '${s.servicoId}', 'equipe')" style="cursor: pointer; color: #add8e6; text-decoration: underline;">${s.quantidade.toFixed(2)} ${s.unidade}</td>
                        <td class="valor-positivo clicavel" onclick="window.dashboardHVC.abrirModalDetalhesServicoIntegrante('${integranteId}', '${s.servicoId}', 'equipe')" style="cursor: pointer; text-decoration: underline;">${this.formatarMoeda(s.valor)}</td>
                    </tr>
                `;
            });
        }

        modal.innerHTML = `
            <div class="modal-content modal-xl">
                <div class="modal-header">
                    <h3>👤 Detalhes - ${integrante.nome}</h3>
                    <button class="modal-close" onclick="window.dashboardHVC.fecharModal('modal-detalhes-integrante')">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-summary">
                        <div class="summary-item">
                            <span class="summary-label">Produções Individuais:</span>
                            <span class="summary-value">${integrante.totalProducoesIndividuais || 0}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Produções em Equipe:</span>
                            <span class="summary-value">${integrante.totalProducoesEmEquipe || 0}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Obras:</span>
                            <span class="summary-value">${integrante.totalObras}</span>
                        </div>
                        <div class="summary-item highlight">
                            <span class="summary-label">Valor Individual:</span>
                            <span class="summary-value">${this.formatarMoeda(integrante.totalValorIndividual || 0)}</span>
                        </div>
                        <div class="summary-item highlight">
                            <span class="summary-label">Valor em Equipe:</span>
                            <span class="summary-value">${this.formatarMoeda(integrante.totalValorEmEquipe || 0)}</span>
                        </div>
                        <div class="summary-item highlight-total">
                            <span class="summary-label">VALOR TOTAL:</span>
                            <span class="summary-value">${this.formatarMoeda(integrante.totalValor)}</span>
                        </div>
                    </div>

                    <h4>👤 Produções Individuais (agrupado por serviço)</h4>
                    <p style="font-size: 0.8rem; color: #888; margin-bottom: 0.5rem;">Clique na quantidade ou valor para ver detalhes por obra</p>
                    <div class="table-responsive">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>CÓDIGO</th>
                                    <th>SERVIÇO</th>
                                    <th>QTD. TOTAL</th>
                                    <th>VALOR TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${servicosIndividuaisHtml || '<tr><td colspan="4" class="empty-message">Nenhuma produção individual no período</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <h4>👥 Produções em Equipe (agrupado por serviço)</h4>
                    <p style="font-size: 0.8rem; color: #888; margin-bottom: 0.5rem;">Clique na quantidade ou valor para ver detalhes por obra</p>
                    <div class="table-responsive">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>CÓDIGO</th>
                                    <th>SERVIÇO</th>
                                    <th>QTD. TOTAL</th>
                                    <th>VALOR TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${servicosEmEquipeHtml || '<tr><td colspan="4" class="empty-message">Nenhuma produção em equipe no período</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    // Modal de detalhes do serviço por obra (quando clica na quantidade/valor)
    abrirModalDetalhesServicoIntegrante(integranteId, servicoId, tipo) {
        const integrante = this.dataCache.produtividadeIntegrantes.find(i => i.id === integranteId);
        if (!integrante) return;

        // Obter informações do serviço
        const servicoInfo = tipo === 'individual' 
            ? integrante.servicosIndividuais[servicoId] 
            : integrante.servicosEmEquipe[servicoId];

        // Para produções em equipe, usar os dados já armazenados no serviço
        let producoesPorObra = {};
        
        if (tipo === 'equipe' && servicoInfo && servicoInfo.producoes) {
            // Usar os dados já calculados com valores proporcionais
            servicoInfo.producoes.forEach(p => {
                const obraKey = p.obraNumero;
                if (!producoesPorObra[obraKey]) {
                    producoesPorObra[obraKey] = {
                        obraNumero: p.obraNumero,
                        producoes: []
                    };
                }
                producoesPorObra[obraKey].producoes.push({
                    data: p.data,
                    equipeNumero: p.equipeNumero || null,
                    quantidade: p.quantidade, // Já é proporcional
                    unidade: servicoInfo.unidade,
                    valor: p.valor, // Já é proporcional
                    numMembros: p.numMembros
                });
            });
        } else {
            // Para produções individuais, buscar das produções
            const producoes = integrante.producoesIndividuais || [];
            producoes.forEach(prod => {
                prod.servicos.forEach(s => {
                    if (servicoInfo && s.codigo === servicoInfo.codigo) {
                        const obraKey = prod.obraNumero;
                        if (!producoesPorObra[obraKey]) {
                            producoesPorObra[obraKey] = {
                                obraNumero: prod.obraNumero,
                                producoes: []
                            };
                        }
                        producoesPorObra[obraKey].producoes.push({
                            data: prod.data,
                            equipeNumero: null,
                            quantidade: s.quantidade,
                            unidade: s.unidade,
                            valor: s.valor
                        });
                    }
                });
            });
        }

        // Criar modal
        let modal = document.getElementById('modal-detalhes-servico');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalhes-servico';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        // Gerar tabela de produções por obra
        let producoesHtml = '';
        Object.values(producoesPorObra).forEach(obra => {
            obra.producoes.forEach(p => {
                producoesHtml += `
                    <tr>
                        <td>${obra.obraNumero}</td>
                        ${tipo === 'equipe' ? `<td>Equipe ${p.equipeNumero || 'N/A'}</td>` : ''}
                        <td>${p.data}</td>
                        <td>${p.quantidade.toFixed(2)} ${p.unidade}</td>
                        <td class="valor-positivo">${this.formatarMoeda(p.valor)}</td>
                        ${tipo === 'equipe' ? `<td style="color: #888; font-size: 0.85em;">(÷${p.numMembros || 1} membros)</td>` : ''}
                    </tr>
                `;
            });
        });

        const tipoLabel = tipo === 'individual' ? 'Individual' : 'em Equipe';
        const colSpan = tipo === 'equipe' ? 6 : 4;

        modal.innerHTML = `
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>📋 Detalhes - ${servicoInfo?.codigo || 'Serviço'} (${tipoLabel})</h3>
                    <button class="modal-close" onclick="window.dashboardHVC.fecharModal('modal-detalhes-servico')">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-summary">
                        <div class="summary-item">
                            <span class="summary-label">Serviço:</span>
                            <span class="summary-value">${servicoInfo?.descricao || 'N/A'}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Integrante:</span>
                            <span class="summary-value">${integrante.nome}</span>
                        </div>
                        <div class="summary-item highlight">
                            <span class="summary-label">Qtd. Total:</span>
                            <span class="summary-value">${servicoInfo?.quantidade?.toFixed(2) || '0.00'} ${servicoInfo?.unidade || ''}</span>
                        </div>
                        <div class="summary-item highlight-total">
                            <span class="summary-label">Valor Total:</span>
                            <span class="summary-value">${this.formatarMoeda(servicoInfo?.valor || 0)}</span>
                        </div>
                    </div>

                    <h4>📅 Produções Diárias por Obra</h4>
                    ${tipo === 'equipe' ? '<p style="font-size: 0.8rem; color: #888; margin-bottom: 0.5rem;">Valores proporcionais (divididos pelo número de membros da equipe)</p>' : ''}
                    <div class="table-responsive">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>OBRA</th>
                                    ${tipo === 'equipe' ? '<th>EQUIPE</th>' : ''}
                                    <th>DATA</th>
                                    <th>QUANTIDADE</th>
                                    <th>VALOR</th>
                                    ${tipo === 'equipe' ? '<th>DIVISÃO</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${producoesHtml || `<tr><td colspan="${colSpan}" class="empty-message">Nenhuma produção encontrada</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
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

// Instância global (usando window para garantir escopo global em módulos)
let dashboardHVC = null;

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar um pouco para garantir que o supabase.js foi carregado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    dashboardHVC = new DashboardHVC();
    window.dashboardHVC = dashboardHVC; // Expor globalmente
    await dashboardHVC.init();
});

// Exportar para uso em outros módulos
export { DashboardHVC, dashboardHVC };
