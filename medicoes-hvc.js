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
        
        // Verificar e limpar formulário
        const dataMedicao = this.getElement('data-medicao');
        const dataRecebimento = this.getElement('data-recebimento');
        const observacoes = this.getElement('observacoes-medicao');
        const statusMedicao = this.getElement('status-medicao');
        
        if (dataMedicao) {
            dataMedicao.value = new Date().toISOString().split('T')[0];
        }
        
        if (dataRecebimento) {
            // Data de recebimento padrão: 30 dias após a data da medição
            const dataFutura = new Date();
            dataFutura.setDate(dataFutura.getDate() + 30);
            dataRecebimento.value = dataFutura.toISOString().split('T')[0];
        }
        
        if (observacoes) {
            observacoes.value = '';
        }
        
        if (statusMedicao) {
            statusMedicao.value = 'pendente';
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
            const dataRecebimento = this.getElement('data-recebimento');
            
            if (!dataMedicao || !dataMedicao.value) {
                this.showNotification('Informe a data da medição', 'error');
                return;
            }

            if (!dataRecebimento || !dataRecebimento.value) {
                this.showNotification('Informe a previsão de recebimento', 'error');
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

            // Obter status e observações
            const statusMedicao = this.getElement('status-medicao');
            const observacoes = this.getElement('observacoes-medicao');
            const status = statusMedicao ? statusMedicao.value : 'pendente';

            // Gerar número da medição
            const numeroMedicao = await this.gerarNumeroMedicao();

            // Salvar dados dos serviços no campo observacoes como JSON
            const dadosServicos = {
                servicos: servicosParaMedir,
                observacoes_usuario: observacoes ? observacoes.value : ''
            };

            const dadosMedicao = {
                numero_medicao: numeroMedicao,
                obra_id: this.obraSelecionada.id,
                desconto_valor: 0,
                valor_total: this.valorTotalCalculado,
                valor_bruto: this.valorTotalCalculado,
                tipo_preco: 'total',
                previsao_pagamento: dataRecebimento.value,
                emitir_boleto: false,
                status: status,
                observacoes: JSON.stringify(dadosServicos)
            };

            console.log('📋 Dados da medição:', dadosMedicao);

            this.showLoading();

            // Criar nova medição
            const { data, error } = await supabaseClient
                .from('medicoes_hvc')
                .insert([dadosMedicao])
                .select()
                .single();

            if (error) throw error;

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
                .select('numero_medicao')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) {
                console.warn('Erro ao buscar última medição:', error);
            }

            let proximoNumero = 1;
            if (ultimaMedicao && ultimaMedicao.length > 0) {
                const ultimoNumero = ultimaMedicao[0].numero_medicao;
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
}

// Finalizar tarefa
console.log('✅ Aplicação de medições carregada e pronta para uso!');
