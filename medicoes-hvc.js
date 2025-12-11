// Gerenciamento completo de medições com obras, serviços e cálculos automáticos
// VERSÃO CORRIGIDA - Cliente via propostas e cabeçalho corrigido

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
    // BUSCA DE CLIENTE VIA PROPOSTAS
    // ========================================

    async buscarClienteViaPropostas(obraId) {
        try {
            console.log('🔍 Buscando cliente via propostas para obra:', obraId);
            
            // 1. Buscar propostas da obra
            const { data: obrasPropostas, error: opError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            if (opError || !obrasPropostas || obrasPropostas.length === 0) {
                console.log('❌ Nenhuma proposta encontrada para a obra');
                return null;
            }

            console.log('📋 Propostas encontradas:', obrasPropostas.length);

            // 2. Buscar dados das propostas
            const propostaIds = obrasPropostas.map(op => op.proposta_id);
            const { data: propostas, error: propError } = await supabaseClient
                .from('propostas_hvc')
                .select('*')
                .in('id', propostaIds);

            if (propError || !propostas || propostas.length === 0) {
                console.log('❌ Dados das propostas não encontrados');
                return null;
            }

            console.log('📋 Dados das propostas:', propostas.length);

            // 3. Buscar cliente da primeira proposta (assumindo que todas são do mesmo cliente)
            const primeiraProposta = propostas[0];
            console.log('👤 Cliente ID da proposta:', primeiraProposta.cliente_id);

            if (!primeiraProposta.cliente_id) {
                console.log('❌ Proposta não tem cliente_id definido');
                return null;
            }

            // 4. Buscar dados do cliente
            const { data: cliente, error: clienteError } = await supabaseClient
                .from('clientes_hvc')
                .select('*')
                .eq('id', primeiraProposta.cliente_id)
                .single();

            if (clienteError || !cliente) {
                console.log('❌ Cliente não encontrado na tabela clientes_hvc');
                return null;
            }

            console.log('✅ Cliente encontrado via propostas:', cliente.nome);
            return cliente;

        } catch (error) {
            console.error('❌ Erro ao buscar cliente via propostas:', error);
            return null;
        }
    }

    // ========================================
    // CARREGAMENTO DE DADOS
    // ========================================

    async loadObras() {
        try {
            console.log('🏗️ Carregando obras...');
            
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

            console.log('👥 Clientes encontrados:', clientes?.length || 0);
            console.log('🏗️ Obras encontradas:', obras?.length || 0);

            // Combinar dados manualmente com busca via propostas
            this.obras = [];
            
            for (const obra of obras || []) {
                console.log(`\n🔍 Processando obra ${obra.numero_obra} (ID: ${obra.id})`);
                console.log(`👤 Cliente ID direto da obra: ${obra.cliente_id || 'undefined'}`);
                
                let cliente = null;
                let nomeCliente = 'Cliente não encontrado';
                
                // Tentar buscar cliente direto da obra primeiro
                if (obra.cliente_id) {
                    cliente = clientes.find(c => c.id === obra.cliente_id);
                    if (cliente) {
                        nomeCliente = cliente.nome;
                        console.log(`✅ Cliente encontrado diretamente: ${cliente.nome}`);
                    } else {
                        console.log(`❌ Cliente com ID ${obra.cliente_id} não encontrado na tabela clientes_hvc`);
                    }
                }
                
                // Se não encontrou cliente direto, buscar via propostas
                if (!cliente) {
                    console.log('🔍 Tentando buscar cliente via propostas...');
                    cliente = await this.buscarClienteViaPropostas(obra.id);
                    
                    if (cliente) {
                        nomeCliente = cliente.nome;
                        console.log(`✅ Cliente encontrado via propostas: ${cliente.nome}`);
                    } else {
                        nomeCliente = 'Cliente não definido';
                        console.log(`⚠️ Obra ${obra.numero_obra} não tem cliente definido nem via obra nem via propostas`);
                    }
                }
                
                this.obras.push({
                    ...obra,
                    clientes_hvc: cliente || { 
                        nome: nomeCliente,
                        id: obra.cliente_id || null
                    }
                });
            }

            console.log('✅ Obras carregadas:', this.obras.length);
            
            this.populateObrasFilter();
            this.renderObrasModal();
            
        } catch (error) {
            console.error('❌ Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    async loadMedicoes() {
        try {
            console.log('📋 Carregando medições...');
            
            // Buscar medições da tabela medicoes_hvc
            const { data: medicoes, error: medicoesError } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .order('created_at', { ascending: false });

            if (medicoesError) {
                console.log('❌ Erro ao carregar medições:', medicoesError);
                this.medicoes = [];
            } else {
                console.log('📋 Medições encontradas:', medicoes?.length || 0);
                
                // Buscar obras e clientes separadamente
                const { data: obras, error: obrasError } = await supabaseClient
                    .from('obras_hvc')
                    .select('*');

                if (obrasError) throw obrasError;

                const { data: clientes, error: clientesError } = await supabaseClient
                    .from('clientes_hvc')
                    .select('*');

                if (clientesError) throw clientesError;

                console.log('🏗️ Obras para relacionamento:', obras?.length || 0);
                console.log('👥 Clientes para relacionamento:', clientes?.length || 0);

                // Combinar dados manualmente com busca via propostas
                this.medicoes = [];
                
                for (const medicao of medicoes || []) {
                    console.log(`\n📋 Processando medição ${medicao.numero_medicao}`);
                    console.log(`🏗️ Obra ID da medição: ${medicao.obra_id}`);
                    
                    const obra = obras.find(o => o.id === medicao.obra_id);
                    console.log(`🏗️ Obra encontrada:`, obra ? obra.numero_obra : 'NÃO ENCONTRADA');
                    
                    let cliente = null;
                    let nomeCliente = 'Cliente não encontrado';
                    
                    if (obra) {
                        console.log(`👤 Cliente ID direto da obra: ${obra.cliente_id || 'undefined'}`);
                        
                        // Tentar buscar cliente direto da obra primeiro
                        if (obra.cliente_id) {
                            cliente = clientes.find(c => c.id === obra.cliente_id);
                            if (cliente) {
                                nomeCliente = cliente.nome;
                                console.log(`✅ Cliente encontrado diretamente: ${cliente.nome}`);
                            } else {
                                console.log(`❌ Cliente com ID ${obra.cliente_id} não encontrado`);
                            }
                        }
                        
                        // Se não encontrou cliente direto, buscar via propostas
                        if (!cliente) {
                            console.log('🔍 Tentando buscar cliente via propostas...');
                            cliente = await this.buscarClienteViaPropostas(obra.id);
                            
                            if (cliente) {
                                nomeCliente = cliente.nome;
                                console.log(`✅ Cliente encontrado via propostas: ${cliente.nome}`);
                            } else {
                                nomeCliente = 'Cliente não definido';
                                console.log(`⚠️ Obra ${obra.numero_obra} não tem cliente definido`);
                            }
                        }
                    }
                    
                    this.medicoes.push({
                        ...medicao,
                        obras_hvc: {
                            ...obra,
                            clientes_hvc: cliente || { 
                                nome: nomeCliente,
                                id: obra?.cliente_id || null
                            }
                        }
                    });
                }
            }

            console.log('✅ Medições processadas:', this.medicoes.length);
            
            this.renderMedicoes();
            
        } catch (error) {
            console.error('❌ Erro ao carregar medições:', error);
            this.showNotification('Erro ao carregar medições: ' + error.message, 'error');
        }
    }

    async loadServicosObra(obraId) {
        try {
            console.log('🚀 ===== INICIANDO BUSCA DE SERVIÇOS =====');
            console.log('🏗️ Obra ID:', obraId);
            
            // 1. Buscar produções diárias para encontrar TODOS os serviços com produção
            console.log('📊 Passo 1: Buscando produções diárias...');
            const { data: producoes, error: prodError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('quantidades_servicos')
                .eq('obra_id', obraId);

            if (prodError) {
                console.error('❌ Erro ao buscar produções:', prodError);
                return [];
            }

            console.log('📊 Produções encontradas:', producoes?.length || 0);

            if (!producoes || producoes.length === 0) {
                this.showNotification('Nenhuma produção encontrada para esta obra', 'warning');
                return [];
            }

            // 2. Extrair TODOS os IDs de serviços que têm produção
            console.log('🔍 Passo 2: Extraindo serviços das produções...');
            const servicosComProducao = new Set();
            const quantidadesPorServico = {};

            producoes.forEach((producao, index) => {
                console.log(`📋 Produção ${index + 1}:`, producao.quantidades_servicos);
                const quantidades = producao.quantidades_servicos || {};
                Object.keys(quantidades).forEach(servicoId => {
                    servicosComProducao.add(servicoId);
                    if (!quantidadesPorServico[servicoId]) {
                        quantidadesPorServico[servicoId] = 0;
                    }
                    quantidadesPorServico[servicoId] += parseFloat(quantidades[servicoId] || 0);
                });
            });

            console.log('🎯 Serviços com produção:', Array.from(servicosComProducao));
            console.log('📊 Quantidades por serviço:', quantidadesPorServico);

            if (servicosComProducao.size === 0) {
                this.showNotification('Nenhum serviço com produção encontrado', 'warning');
                return [];
            }

            // 3. Buscar dados dos serviços
            console.log('🔍 Passo 3: Buscando dados dos serviços...');
            const servicoIds = Array.from(servicosComProducao);
            const { data: servicos, error: servicosError } = await supabaseClient
                .from('servicos_hvc')
                .select('*')
                .in('id', servicoIds);

            if (servicosError) throw servicosError;
            console.log('📋 Serviços encontrados:', servicos?.length || 0);

            // 4. Buscar valores das propostas
            console.log('🔍 Passo 4: Buscando valores das propostas...');
            const { data: obrasPropostas, error: opError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            console.log('📋 Obras-propostas encontradas:', obrasPropostas?.length || 0);

            let itensPropostas = [];
            if (!opError && obrasPropostas && obrasPropostas.length > 0) {
                const propostaIds = obrasPropostas.map(op => op.proposta_id);
                console.log('🎯 IDs das propostas:', propostaIds);
                
                const { data: propostas, error: propError } = await supabaseClient
                    .from('propostas_hvc')
                    .select('*')
                    .in('id', propostaIds)
                    .in('status', ['Aprovada', 'contratada']);

                console.log('📋 Propostas aprovadas:', propostas?.length || 0);

                if (!propError && propostas && propostas.length > 0) {
                    const propostasAprovadas = propostas.map(p => p.id);
                    const { data: itens, error: itensError } = await supabaseClient
                        .from('itens_proposta_hvc')
                        .select('*')
                        .in('proposta_id', propostasAprovadas)
                        .in('servico_id', servicoIds);

                    if (!itensError) {
                        itensPropostas = itens || [];
                        console.log('📋 Itens de proposta encontrados:', itensPropostas.length);
                    }
                }
            }

            // 5. BUSCAR MEDIÇÕES ANTERIORES
            console.log('🔍 ===== PASSO 5: BUSCANDO MEDIÇÕES ANTERIORES =====');
            let quantidadesMedidas = {};
            
            try {
                const { data: medicoesAnteriores, error: medError } = await supabaseClient
                    .from('medicoes_hvc')
                    .select('*')
                    .eq('obra_id', obraId);

                console.log('📊 Quantidade de medições encontradas:', medicoesAnteriores?.length || 0);
                
                if (medicoesAnteriores && medicoesAnteriores.length > 0) {
                    medicoesAnteriores.forEach((medicao, index) => {
                        try {
                            if (medicao.observacoes) {
                                const dadosMedicao = JSON.parse(medicao.observacoes);
                                
                                if (dadosMedicao.servicos && Array.isArray(dadosMedicao.servicos)) {
                                    dadosMedicao.servicos.forEach((servico) => {
                                        const servicoId = servico.servico_id;
                                        const quantidade = parseFloat(servico.quantidade_medida || 0);
                                        
                                        if (!quantidadesMedidas[servicoId]) {
                                            quantidadesMedidas[servicoId] = 0;
                                        }
                                        
                                        quantidadesMedidas[servicoId] += quantidade;
                                    });
                                }
                            }
                        } catch (parseError) {
                            console.log('❌ Erro ao fazer parse das observações:', parseError.message);
                        }
                    });
                }
                
            } catch (e) {
                console.error('❌ Erro geral ao buscar medições anteriores:', e);
            }

            // 6. Combinar TODOS os dados
            console.log('\n🔧 ===== PASSO 6: COMBINANDO DADOS =====');
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

                // Quantidade já medida
                const quantidadeJaMedida = quantidadesMedidas[servico.id] || 0;

                // Calcular quantidade disponível
                const quantidadeDisponivel = Math.max(0, quantidadeProduzida - quantidadeJaMedida);

                return {
                    servico_id: servico.id,
                    item_proposta_id: itemProposta?.id || null,
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

            console.log('🎉 ===== PROCESSAMENTO CONCLUÍDO =====');
            console.log('📊 Total de serviços processados:', servicosCompletos.length);
            return servicosCompletos || [];
            
        } catch (error) {
            console.error('❌ Erro geral ao carregar serviços da obra:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
            return [];
        }
    }

    // ========================================
    // MODAIS
    // ========================================

    abrirModalNovaMedicao() {
        console.log('Abrindo modal de nova medição...');
        
        // Resetar arrays
        this.servicosMedicao = [];
        this.servicosParaMedicao = [];
        this.obraSelecionada = null;
        this.servicosObra = [];
        this.valorTotalCalculado = 0;
        
        // Gerar número da medição
        this.gerarNumeroMedicao();
        
        // Definir data atual
        const dataMedicao = this.getElement('data-medicao');
        if (dataMedicao) {
            dataMedicao.value = new Date().toISOString().split('T')[0];
        }
        
        // Limpar previsão de pagamento
        const previsaoPagamento = this.getElement('previsao-pagamento-medicao');
        if (previsaoPagamento) {
            previsaoPagamento.value = '';
        }
        
        // Limpar observações
        const observacoes = this.getElement('observacoes-medicao');
        if (observacoes) {
            observacoes.value = '';
        }
        
        // Resetar interface de obra
        const obraContainer = this.getElement('obra-selecionada-container');
        if (obraContainer) {
            obraContainer.innerHTML = `
                <button type="button" class="btn-secondary" onclick="abrirModalObras()">
                    <i class="fas fa-building"></i>
                    Selecionar Obra
                </button>
            `;
        }
        
        // Esconder containers
        const servicosContainer = this.getElement('servicos-container');
        if (servicosContainer) servicosContainer.style.display = 'none';
        
        const resumoContainer = this.getElement('resumo-container');
        if (resumoContainer) resumoContainer.style.display = 'none';
        
        const valorTotalContainer = this.getElement('valor-total-container');
        if (valorTotalContainer) valorTotalContainer.style.display = 'none';
        
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
            
            // Carregar serviços para medição
            this.showLoading();
            await this.loadServicosParaMedicao();
            this.hideLoading();
            
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
                    <td colspan="7" style="text-align: center; color: #b0c4de; padding: 2rem;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma medição cadastrada
                    </td>
                </tr>
            `;
            return;
        }

        // Renderizar com tratamento melhorado do cliente
        tbody.innerHTML = this.medicoes.map(medicao => {
            const nomeCliente = medicao.obras_hvc?.clientes_hvc?.nome || 'Cliente não definido';
            const corCliente = nomeCliente.includes('não') ? '#ff6b6b' : '#b0c4de';
            
            return `
            <tr>
                <td><strong>${medicao.numero_medicao || 'N/A'}</strong></td>
                <td>
                    <div>${medicao.obras_hvc?.numero_obra || 'N/A'}</div>
                    <small style="color: ${corCliente};">${nomeCliente}</small>
                </td>
                <td>${this.formatarData(medicao.created_at)}</td>
                <td><strong>${this.formatarData(medicao.previsao_pagamento)}</strong></td>
                <td><strong>${this.formatarMoeda(medicao.valor_bruto || medicao.valor_total)}</strong></td>
                <td>
                    <span class="badge badge-${this.getStatusColor(medicao.status)}">
                        ${this.getStatusText(medicao.status)}
                    </span>
                </td>
                <td>
                    <button class="btn-danger" onclick="excluirMedicao('${medicao.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `}).join('');
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
                    ${this.obras.map(obra => {
                        const nomeCliente = obra.clientes_hvc.nome;
                        const corCliente = nomeCliente.includes('não') ? '#ff6b6b' : '#ffffff';
                        
                        return `
                        <tr>
                            <td><strong>${obra.numero_obra}</strong></td>
                            <td style="color: ${corCliente};">${nomeCliente}</td>
                            <td>
                                <button class="btn-primary" onclick="selecionarObra('${obra.id}')">
                                    <i class="fas fa-check"></i>
                                    Selecionar
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
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

        // Adicionar campos de data e valor total antes da tabela
        const cabecalhoHtml = `
            <div style="background: rgba(173, 216, 230, 0.1); padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label for="data-medicao" style="color: #add8e6; display: block; margin-bottom: 0.5rem;">Data da Medição:</label>
                        <input type="date" id="data-medicao" style="width: 100%; padding: 0.5rem; border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: #add8e6; border: 1px solid rgba(173, 216, 230, 0.3);">
                    </div>
                    <div>
                        <label for="data-recebimento" style="color: #add8e6; display: block; margin-bottom: 0.5rem;">Previsão de Recebimento:</label>
                        <input type="date" id="data-recebimento" style="width: 100%; padding: 0.5rem; border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: #add8e6; border: 1px solid rgba(173, 216, 230, 0.3);">
                    </div>
                    <div>
                        <label for="status-medicao" style="color: #add8e6; display: block; margin-bottom: 0.5rem;">Status:</label>
                        <select id="status-medicao" style="width: 100%; padding: 0.5rem; border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: #add8e6; border: 1px solid rgba(173, 216, 230, 0.3);">
                            <option value="pendente">Pendente</option>
                            <option value="aprovada">Aprovada</option>
                            <option value="paga">Paga</option>
                            <option value="rascunho">Rascunho</option>
                        </select>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: #add8e6; font-size: 1.2rem; font-weight: 600;">
                        Valor Total da Medição: <span id="valor-total-display" style="color: #ffd700;">${this.formatarMoeda(0)}</span>
                    </div>
                    <div>
                        <label for="observacoes-medicao" style="color: #add8e6; margin-right: 0.5rem;">Observações:</label>
                        <input type="text" id="observacoes-medicao" placeholder="Observações da medição..." style="padding: 0.5rem; border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: #add8e6; border: 1px solid rgba(173, 216, 230, 0.3); width: 300px;">
                    </div>
                </div>
            </div>
        `;

        // Renderizar tabela de serviços
        container.innerHTML = cabecalhoHtml + `
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
        
        // Definir valores padrão para os campos de data
        const dataMedicao = this.getElement('data-medicao');
        const dataRecebimento = this.getElement('data-recebimento');
        
        if (dataMedicao && !dataMedicao.value) {
            dataMedicao.value = new Date().toISOString().split('T')[0];
        }
        
        if (dataRecebimento && !dataRecebimento.value) {
            const dataFutura = new Date();
            dataFutura.setDate(dataFutura.getDate() + 30);
            dataRecebimento.value = dataFutura.toISOString().split('T')[0];
        }
        
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
    // SALVAMENTO DA MEDIÇÃO
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
            const numeroMedicaoInput = this.getElement('numero-medicao-gerada');
            const previsaoPagamento = this.getElement('previsao-pagamento-medicao');
            const observacoes = this.getElement('observacoes-medicao');
            
            if (!dataMedicao || !dataMedicao.value) {
                this.showNotification('Informe a data da medição', 'error');
                return;
            }

            if (!numeroMedicaoInput || !numeroMedicaoInput.value) {
                this.showNotification('Número da medição não foi gerado', 'error');
                return;
            }

            // Validar serviços selecionados
            if (this.servicosMedicao.length === 0) {
                this.showNotification('Selecione pelo menos um serviço para medir', 'error');
                return;
            }

            // Preparar dados dos serviços com informações completas
            const servicosComDetalhes = this.servicosMedicao.map(item => {
                const servico = this.servicosParaMedicao.find(s => s.servico_id === item.servico_id);
                return {
                    ...item,
                    servico_codigo: servico?.servico_codigo || '',
                    servico_descricao: servico?.servico_descricao || '',
                    unidade: servico?.unidade || ''
                };
            });

            // Preparar dados da medição
            const dadosMedicao = {
                numero_medicao: numeroMedicaoInput.value,
                obra_id: this.obraSelecionada.id,
                desconto_valor: 0,
                valor_total: this.valorTotalCalculado,
                valor_bruto: this.valorTotalCalculado,
                tipo_preco: 'total',
                previsao_pagamento: previsaoPagamento?.value || null,
                emitir_boleto: false,
                status: 'pendente',
                observacoes: observacoes?.value || ''
            };

            console.log('📋 Dados da medição:', dadosMedicao);

            this.showLoading();

            // Criar nova medição
            const { data: medicao, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .insert([dadosMedicao])
                .select()
                .single();

            if (medicaoError) throw medicaoError;
            
            // Inserir serviços na tabela medicoes_servicos
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
                        preco_unitario: servico.valor_unitario,
                        valor_total: servico.valor_total
                    }]);
                
                if (servicoError) {
                    console.error('Erro ao inserir serviço:', servicoError);
                    throw servicoError;
                }
            }

            this.hideLoading();

            // Sucesso!
            this.showNotification(`Medição ${dadosMedicao.numero_medicao} salva com sucesso!`, 'success');
            
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



    async confirmarESalvarMedicao() {
        // Esta função pode ser usada para confirmar valores antes de salvar
        this.fecharModalValor();
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
                    ${obras.map(obra => {
                        const nomeCliente = obra.clientes_hvc.nome;
                        const corCliente = nomeCliente.includes('não') ? '#ff6b6b' : '#ffffff';
                        
                        return `
                        <tr>
                            <td><strong>${obra.numero_obra}</strong></td>
                            <td style="color: ${corCliente};">${nomeCliente}</td>
                            <td>
                                <button class="btn-primary" onclick="selecionarObra('${obra.id}')">
                                    <i class="fas fa-check"></i>
                                    Selecionar
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    }

    // ========================================
    // EXCLUSÃO
    // ========================================

    async excluirMedicao(medicaoId) {
        if (confirm('Tem certeza que deseja excluir esta medição?')) {
            try {
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
        if (!data) return 'Data não informada';
        return new Date(data).toLocaleDateString('pt-BR');
    }

    getStatusColor(status) {
        const cores = {
            'pendente': 'warning',
            'aprovada': 'success',
            'paga': 'info',
            'rascunho': 'secondary'
        };
        return cores[status] || 'secondary';
    }

    getStatusText(status) {
        const textos = {
            'pendente': 'Pendente',
            'aprovada': 'Aprovada',
            'paga': 'Paga',
            'rascunho': 'Rascunho'
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

    // ========================================
    // NOVAS FUNÇÕES PARA FORMATO INTERATIVO
    // ========================================
    
    servicosMedicao = [];
    servicosParaMedicao = [];
    servicoAtualModal = null;
    
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
            const numeroInput = this.getElement('numero-medicao-gerada');
            if (numeroInput) {
                numeroInput.value = numeroMedicao;
            }
            
        } catch (error) {
            console.error('Erro ao gerar número da medição:', error);
            this.showNotification('Erro ao gerar número da medição: ' + error.message, 'error');
        }
    }
    
    async loadServicosParaMedicao() {
        try {
            if (!this.obraSelecionada) return;
            
            const obraId = this.obraSelecionada.id;
            
            console.log('🚀 Obra ID:', obraId);
            
            // 1. Buscar todos os itens das propostas da obra
            const { data: obrasPropostas, error: opError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);
            
            if (opError) throw opError;
            
            if (!obrasPropostas || obrasPropostas.length === 0) {
                this.showNotification('Nenhuma proposta vinculada a esta obra', 'warning');
                this.servicosParaMedicao = [];
                this.renderServicosParaMedicao([]);
                return;
            }
            
            const propostaIds = obrasPropostas.map(op => op.proposta_id);
            console.log('📋 IDs das propostas:', propostaIds);
            
            // Buscar itens de todas as propostas
            const { data: todosItens, error: itensError } = await supabaseClient
                .from('itens_proposta_hvc')
                .select(`
                    *,
                    servicos_hvc (*),
                    propostas_hvc (numero_proposta),
                    locais_hvc (nome)
                `)
                .in('proposta_id', propostaIds);
            
            if (itensError) throw itensError;
            
            console.log('📋 Itens encontrados:', todosItens?.length || 0);
            
            // 2. Buscar todas as produções diárias da obra
            const { data: producoes, error: prodError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('*')
                .eq('obra_id', obraId);
            
            if (prodError) throw prodError;
            
            console.log('📋 Produções encontradas:', producoes?.length || 0);
            
            // 3. Buscar todas as medições anteriores
            const { data: medicoes, error: medError } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    id,
                    medicoes_servicos (*)
                `)
                .eq('obra_id', obraId)
                .neq('status', 'cancelada');
            
            if (medError) throw medError;
            
            console.log('📋 Medições encontradas:', medicoes?.length || 0);
            
            // 4. Agrupar serviços por código e preço
            const servicosAgrupados = {};
            
            (todosItens || []).forEach(item => {
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
                        chaveUnica: chave,
                        servico_id: servicoId,
                        servico_codigo: servicoCodigo,
                        servico_descricao: servicoNome,
                        unidade,
                        valor_unitario_contratado: precoUnitario,
                        local: item.locais_hvc?.nome || '',
                        quantidade_contratada: 0,
                        valor_total_contratado: 0,
                        quantidade_produzida: 0,
                        quantidade_ja_medida: 0,
                        quantidade_disponivel: 0,
                        itens: []
                    };
                }
                
                servicosAgrupados[chave].quantidade_contratada += quantidade;
                servicosAgrupados[chave].valor_total_contratado += precoTotal;
                servicosAgrupados[chave].itens.push(item);
            });
            
            // 5. Calcular quantidades produzidas
            Object.values(servicosAgrupados).forEach(servico => {
                let totalProduzido = 0;
                
                (producoes || []).forEach(producao => {
                    const quantidades = producao.quantidades_servicos || {};
                    servico.itens.forEach(item => {
                        if (quantidades[item.id]) {
                            totalProduzido += parseFloat(quantidades[item.id]) || 0;
                        }
                    });
                });
                
                servico.quantidade_produzida = totalProduzido;
            });
            
            // 6. Calcular quantidades já medidas
            Object.values(servicosAgrupados).forEach(servico => {
                let totalMedido = 0;
                
                (medicoes || []).forEach(medicao => {
                    const servicosMedicao = medicao.medicoes_servicos || [];
                    servicosMedicao.forEach(sm => {
                        const itemPertenceAoServico = servico.itens.some(item => item.id === sm.item_proposta_id);
                        
                        if (itemPertenceAoServico) {
                            totalMedido += parseFloat(sm.quantidade_medida) || 0;
                        }
                    });
                });
                
                servico.quantidade_ja_medida = totalMedido;
            });
            
            // 7. Calcular quantidade disponível para medição
            Object.values(servicosAgrupados).forEach(servico => {
                servico.quantidade_disponivel = Math.max(0, 
                    servico.quantidade_produzida - servico.quantidade_ja_medida
                );
                // Guardar item_proposta_id do primeiro item para usar ao salvar
                servico.item_proposta_id = servico.itens[0]?.id || null;
            });
            
            // 8. Filtrar apenas serviços com quantidade disponível > 0
            this.servicosParaMedicao = Object.values(servicosAgrupados).filter(s => s.quantidade_disponivel > 0);
            
            console.log('🎉 Serviços disponíveis:', this.servicosParaMedicao.length);
            
            // 9. Renderizar cards de serviços
            this.renderServicosParaMedicao(this.servicosParaMedicao);
            
        } catch (error) {
            console.error('❌ Erro ao carregar serviços para medição:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }
    
    renderServicosParaMedicao(servicos) {
        const container = this.getElement('servicos-para-medicao');
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
        
        servicos.forEach((servico, index) => {
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
            
            const valorUnitario = this.formatarMoeda(servico.valor_unitario_contratado);
            const quantidadeSelecionada = this.servicosMedicao.find(s => s.servico_id === servico.servico_id)?.quantidade_medida || 0;
            const valorSelecionado = quantidadeSelecionada * servico.valor_unitario_contratado;
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong style="color: #add8e6; font-size: 1.1em;">
                                ${servico.servico_codigo} - ${servico.servico_descricao}
                            </strong>
                            <span style="color: #20c997; font-weight: 600; margin-left: 1rem;">${valorUnitario}/${servico.unidade}</span>
                            ${servico.local ? `<br><small style="color: #888; font-size: 0.85em; margin-top: 0.25rem; display: inline-block;"><i class="fas fa-map-marker-alt" style="font-size: 0.8em;"></i> ${servico.local}</small>` : ''}
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.9em; color: #c0c0c0;">
                            <div>
                                <i class="fas fa-file-contract"></i>
                                <strong>Contratado:</strong> ${servico.quantidade_contratada.toFixed(2)} ${servico.unidade}
                            </div>
                            <div>
                                <i class="fas fa-tools"></i>
                                <strong>Produzido:</strong> <span style="color: #90EE90;">${servico.quantidade_produzida.toFixed(2)} ${servico.unidade}</span>
                            </div>
                            <div>
                                <i class="fas fa-check-circle"></i>
                                <strong>Já Medido:</strong> ${servico.quantidade_ja_medida.toFixed(2)} ${servico.unidade}
                            </div>
                            <div>
                                <i class="fas fa-arrow-right"></i>
                                <strong>Disponível:</strong> <span style="color: #ffc107; font-weight: 600;">${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}</span>
                            </div>
                        </div>
                        
                        ${quantidadeSelecionada > 0 ? `
                            <div style="margin-top: 0.75rem; padding: 0.5rem; background: rgba(32, 201, 151, 0.15); border-radius: 4px; border-left: 3px solid #20c997;">
                                <strong style="color: #20c997;">✓ Quantidade a Medir:</strong>
                                <span style="color: #20c997; font-weight: 600; margin-left: 0.5rem;">${quantidadeSelecionada.toFixed(2)} ${servico.unidade}</span>
                                <strong style="color: #20c997; margin-left: 1rem;">Valor:</strong>
                                <span style="color: #20c997; font-weight: 600; margin-left: 0.5rem;">${this.formatarMoeda(valorSelecionado)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-left: 1rem;">
                        <button 
                            type="button"
                            class="btn-ajustar-medicao"
                            data-index="${index}"
                            style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #000080 0%, #191970 100%); color: #add8e6; border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s;"
                        >
                            <i class="fas fa-edit"></i> ${quantidadeSelecionada > 0 ? 'Ajustar' : 'Adicionar'}
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
            
            // Adicionar event listener ao botão
            const botao = card.querySelector('.btn-ajustar-medicao');
            botao.addEventListener('click', () => {
                this.abrirModalAjustarQuantidade(servico, quantidadeSelecionada);
            });
        });
    }
    
    abrirModalAjustarQuantidade(servico, quantidadeAtual) {
        const modalHTML = `
            <div id="modal-ajustar-quantidade" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(173, 216, 230, 0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(173, 216, 230, 0.2);">
                        <h3 style="color: #add8e6; margin: 0;">
                            <i class="fas fa-ruler"></i> Ajustar Quantidade
                        </h3>
                        <button onclick="medicoesManager.fecharModalAjustarQuantidade()" style="background: none; border: none; color: #ff6b6b; font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <div style="color: #add8e6; font-size: 1.1em; font-weight: 600; margin-bottom: 0.5rem;">
                            ${servico.servico_codigo} - ${servico.servico_descricao}
                        </div>
                        <div style="color: #20c997; font-weight: 600;">
                            Preço: ${this.formatarMoeda(servico.valor_unitario_contratado)}/${servico.unidade}
                        </div>
                        <div style="color: #ffc107; font-size: 0.9em; margin-top: 0.5rem;">
                            <i class="fas fa-info-circle"></i> Disponível: ${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}
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
                            max="${servico.quantidade_disponivel}" 
                            step="0.01" 
                            value="${quantidadeAtual}"
                            style="width: 100%; padding: 0.75rem; background: rgba(173, 216, 230, 0.1); border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; color: #add8e6; font-size: 1.1em; font-weight: 600;"
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
                            max="${servico.quantidade_disponivel}" 
                            step="0.01" 
                            value="${quantidadeAtual}"
                            style="width: 100%; height: 10px; border-radius: 5px; background: linear-gradient(to right, #000080 0%, #add8e6 100%); outline: none; cursor: pointer;"
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #888; margin-top: 0.5rem;">
                            <span>0</span>
                            <span>${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}</span>
                        </div>
                    </div>
                    
                    <div style="padding: 1rem; background: rgba(32, 201, 151, 0.15); border-radius: 8px; border-left: 4px solid #20c997; margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="color: #c0c0c0; font-size: 0.9em; margin-bottom: 0.25rem;">Quantidade a Medir:</div>
                                <div style="color: #20c997; font-size: 1.3em; font-weight: 700;">
                                    <span id="quantidade-display-modal">${quantidadeAtual.toFixed(2)}</span> ${servico.unidade}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #c0c0c0; font-size: 0.9em; margin-bottom: 0.25rem;">Valor Total:</div>
                                <div style="color: #20c997; font-size: 1.5em; font-weight: 700;">
                                    <span id="valor-display-modal">${this.formatarMoeda(quantidadeAtual * servico.valor_unitario_contratado)}</span>
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
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        this.servicoAtualModal = servico;
        
        // Event listeners
        const inputQuantidade = document.getElementById('input-quantidade-manual');
        const sliderQuantidade = document.getElementById('slider-quantidade-modal');
        const quantidadeDisplay = document.getElementById('quantidade-display-modal');
        const valorDisplay = document.getElementById('valor-display-modal');
        
        const atualizarDisplays = () => {
            const quantidade = parseFloat(inputQuantidade.value) || 0;
            const valor = quantidade * servico.valor_unitario_contratado;
            quantidadeDisplay.textContent = quantidade.toFixed(2);
            valorDisplay.textContent = this.formatarMoeda(valor);
        };
        
        inputQuantidade.addEventListener('input', () => {
            sliderQuantidade.value = inputQuantidade.value;
            atualizarDisplays();
        });
        
        sliderQuantidade.addEventListener('input', () => {
            inputQuantidade.value = sliderQuantidade.value;
            atualizarDisplays();
        });
        
        document.getElementById('btn-cancelar-modal-quantidade').addEventListener('click', () => {
            this.fecharModalAjustarQuantidade();
        });
        
        document.getElementById('btn-confirmar-modal-quantidade').addEventListener('click', () => {
            this.confirmarQuantidade(parseFloat(inputQuantidade.value) || 0);
        });
    }
    
    fecharModalAjustarQuantidade() {
        const modal = document.getElementById('modal-ajustar-quantidade');
        if (modal) {
            modal.remove();
        }
        this.servicoAtualModal = null;
    }
    
    confirmarQuantidade(quantidade) {
        if (!this.servicoAtualModal) return;
        
        const servico = this.servicoAtualModal;
        
        // Remover serviço se já existir
        this.servicosMedicao = this.servicosMedicao.filter(s => s.servico_id !== servico.servico_id);
        
        // Adicionar se quantidade > 0
        if (quantidade > 0) {
            this.servicosMedicao.push({
                servico_id: servico.servico_id,
                item_proposta_id: servico.item_proposta_id,
                quantidade_medida: quantidade,
                valor_unitario: servico.valor_unitario_contratado,
                valor_total: quantidade * servico.valor_unitario_contratado
            });
        }
        
        // Fechar modal
        this.fecharModalAjustarQuantidade();
        
        // Atualizar interface
        this.renderServicosParaMedicao(this.servicosParaMedicao);
        this.atualizarResumoMedicao();
    }
    
    atualizarResumoMedicao() {
        const tbody = this.getElement('tbody-resumo-servicos');
        const valorTotalSpan = this.getElement('valor-total-medicao');
        const resumoContainer = this.getElement('resumo-container');
        const valorTotalContainer = this.getElement('valor-total-container');
        
        if (!tbody) return;
        
        if (this.servicosMedicao.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 2rem; text-align: center; color: #888;">
                        Selecione serviços para ver o resumo
                    </td>
                </tr>
            `;
            if (resumoContainer) resumoContainer.style.display = 'none';
            if (valorTotalContainer) valorTotalContainer.style.display = 'none';
            return;
        }
        
        // Mostrar containers
        if (resumoContainer) resumoContainer.style.display = 'block';
        if (valorTotalContainer) valorTotalContainer.style.display = 'block';
        
        let valorTotal = 0;
        
        tbody.innerHTML = this.servicosMedicao.map(item => {
            const servico = this.servicosParaMedicao.find(s => s.servico_id === item.servico_id);
            if (!servico) return '';
            
            valorTotal += item.valor_total;
            
            return `
                <tr style="border-bottom: 1px solid rgba(173, 216, 230, 0.1);">
                    <td style="padding: 0.75rem;">
                        <strong style="color: #add8e6;">${servico.servico_codigo}</strong>
                        <span style="color: #20c997; font-size: 0.85em; margin-left: 0.5rem;">(${this.formatarMoeda(item.valor_unitario)}/${servico.unidade})</span><br>
                        <small style="color: #c0c0c0;">${servico.servico_descricao}</small>
                        ${servico.local ? `<br><small style="color: #888; font-size: 0.8em;"><i class="fas fa-map-marker-alt" style="font-size: 0.75em;"></i> ${servico.local}</small>` : ''}
                    </td>
                    <td style="padding: 0.75rem; text-align: center; color: #e0e0e0;">
                        ${item.quantidade_medida.toFixed(2)} ${servico.unidade}
                    </td>
                    <td style="padding: 0.75rem; text-align: right; color: #20c997;">
                        ${this.formatarMoeda(item.valor_unitario)}
                    </td>
                    <td style="padding: 0.75rem; text-align: right; color: #20c997; font-weight: 600;">
                        ${this.formatarMoeda(item.valor_total)}
                    </td>
                </tr>
            `;
        }).join('');
        
        if (valorTotalSpan) {
            valorTotalSpan.textContent = this.formatarMoeda(valorTotal);
        }
        
        this.valorTotalCalculado = valorTotal;
    }
}

// Finalizar tarefa
console.log('✅ Aplicação de medições carregada e pronta para uso!');
