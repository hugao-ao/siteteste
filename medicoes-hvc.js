// Gerenciamento completo de medições com obras, serviços e cálculos automáticos
// VERSÃO DEBUG - Com logs detalhados para identificar problemas

// Importar Supabase do arquivo existente
import { supabase as supabaseClient } from './supabase.js';

let medicoesManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, iniciando aplicação de medições...');
    initializeApp();
});

function initializeApp() {
    console.log('🔧 Inicializando aplicação de medições...');
    
    // Verificar se o Supabase está disponível
    if (supabaseClient) {
        console.log('✅ Supabase conectado com sucesso!');
        
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
        console.error('❌ Erro: Supabase não disponível');
        showNotification('Erro de conexão com o banco de dados', 'error');
    }
}

class MedicoesManager {
    constructor() {
        console.log('🏗️ Construindo MedicoesManager...');
        this.currentMedicaoId = null;
        this.obraSelecionada = null;
        this.obras = [];
        this.medicoes = [];
        this.servicosObra = [];
        this.valorTotalCalculado = 0;
        
        this.init();
    }

    async init() {
        console.log('🔄 Inicializando MedicoesManager...');
        
        try {
            await this.loadObras();
            await this.loadMedicoes();
            this.setupEventListeners();
            console.log('✅ MedicoesManager inicializado com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao inicializar MedicoesManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        console.log('🎯 Configurando event listeners...');
        
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
        
        console.log('✅ Event listeners configurados');
    }

    // ========================================
    // CARREGAMENTO DE DADOS - COM DEBUG
    // ========================================

    async loadObras() {
        try {
            console.log('📊 Carregando obras...');
            
            // Buscar obras com relacionamento correto via obras_propostas
            const { data: obras, error: obrasError } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    obras_propostas (
                        propostas_hvc (
                            clientes_hvc (
                                nome
                            )
                        )
                    )
                `)
                .eq('status', 'Andamento')
                .order('numero_obra');

            console.log('🔍 Consulta obras executada');
            console.log('📋 Dados brutos obras:', obras);
            console.log('❌ Erro obras:', obrasError);

            if (obrasError) {
                console.error('❌ Erro na consulta de obras:', obrasError);
                throw obrasError;
            }

            // Processar dados para formato esperado
            const obrasProcessadas = obras.map(obra => {
                console.log('🔄 Processando obra:', obra.id, obra.numero_obra);
                
                // Pegar o primeiro cliente da primeira proposta
                const primeiraPropostaNaObra = obra.obras_propostas?.[0];
                const cliente = primeiraPropostaNaObra?.propostas_hvc?.clientes_hvc;
                
                console.log('👤 Cliente encontrado para obra', obra.numero_obra, ':', cliente?.nome || 'NÃO ENCONTRADO');
                
                return {
                    ...obra,
                    clientes_hvc: cliente || { nome: 'Cliente não encontrado' }
                };
            });

            this.obras = obrasProcessadas;
            console.log('✅ Obras carregadas:', this.obras.length);
            console.log('📋 Lista de obras processadas:', this.obras);
            
            this.populateObrasFilter();
            
        } catch (error) {
            console.error('❌ Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    async loadMedicoes() {
        try {
            console.log('📊 Carregando medições...');
            
            // Buscar medições primeiro
            const { data: medicoes, error: medicoesError } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .order('created_at', { ascending: false });

            console.log('🔍 Consulta medições executada');
            console.log('📋 Dados brutos medições:', medicoes);
            console.log('❌ Erro medições:', medicoesError);

            if (medicoesError) {
                console.error('❌ Erro na consulta de medições:', medicoesError);
                throw medicoesError;
            }

            // Processar medições com obras e clientes
            const medicoesCompletas = [];
            for (const medicao of medicoes || []) {
                console.log('🔄 Processando medição:', medicao.id);
                
                // Buscar obra
                const { data: obra, error: obraError } = await supabaseClient
                    .from('obras_hvc')
                    .select('nome, cliente_id')
                    .eq('id', medicao.obra_id)
                    .single();

                if (obraError) {
                    console.warn('⚠️ Obra não encontrada para medição', medicao.id, ':', obraError);
                    medicoesCompletas.push({
                        ...medicao,
                        obras_hvc: { 
                            nome: 'Obra não encontrada',
                            clientes_hvc: { nome: 'Cliente não encontrado' }
                        }
                    });
                    continue;
                }

                console.log('🏗️ Obra encontrada para medição:', obra);

                // Buscar cliente da obra via obras_propostas
                const { data: obrasPropostas, error: opError } = await supabaseClient
                    .from('obras_propostas')
                    .select(`
                        propostas_hvc (
                            clientes_hvc (
                                nome
                            )
                        )
                    `)
                    .eq('obra_id', medicao.obra_id)
                    .limit(1);

                let nomeCliente = 'Cliente não encontrado';
                if (!opError && obrasPropostas && obrasPropostas.length > 0) {
                    const cliente = obrasPropostas[0]?.propostas_hvc?.clientes_hvc;
                    if (cliente) {
                        nomeCliente = cliente.nome;
                        console.log('👤 Cliente encontrado para medição:', nomeCliente);
                    }
                }

                medicoesCompletas.push({
                    ...medicao,
                    obras_hvc: {
                        ...obra,
                        clientes_hvc: { nome: nomeCliente }
                    }
                });
            }

            this.medicoes = medicoesCompletas;
            console.log('✅ Medições carregadas:', this.medicoes.length);
            console.log('📋 Lista de medições processadas:', this.medicoes);
            
            this.renderMedicoes();
            
        } catch (error) {
            console.error('❌ Erro ao carregar medições:', error);
            this.showNotification('Erro ao carregar medições: ' + error.message, 'error');
        }
    }

    async loadServicosObra(obraId) {
        try {
            console.log('🔧 Carregando serviços da obra:', obraId);
            
            // Buscar serviços da obra via servicos_andamento
            const { data: servicos, error: servicosError } = await supabaseClient
                .from('servicos_andamento')
                .select('*')
                .eq('obra_id', obraId);

            console.log('🔍 Consulta serviços executada para obra:', obraId);
            console.log('📋 Dados brutos serviços:', servicos);
            console.log('❌ Erro serviços:', servicosError);

            if (servicosError) {
                console.error('❌ Erro na consulta de serviços:', servicosError);
                throw servicosError;
            }

            console.log('✅ Serviços carregados:', servicos?.length || 0);
            
            // Armazenar serviços
            this.servicosObra = servicos || [];
            console.log('💾 Serviços armazenados em this.servicosObra:', this.servicosObra);
            
            return this.servicosObra;
            
        } catch (error) {
            console.error('❌ Erro ao carregar serviços da obra:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
            return [];
        }
    }

    // ========================================
    // SELEÇÃO DE OBRA - COM DEBUG
    // ========================================

    async selecionarObra(obraId) {
        try {
            console.log('🎯 Selecionando obra:', obraId);
            
            this.showLoading();
            
            // Encontrar obra selecionada
            const obra = this.obras.find(o => o.id === obraId);
            console.log('🏗️ Obra encontrada:', obra);
            
            if (!obra) {
                console.error('❌ Obra não encontrada na lista:', obraId);
                throw new Error('Obra não encontrada');
            }
            
            this.obraSelecionada = obra;
            console.log('💾 Obra selecionada armazenada:', this.obraSelecionada);
            
            // Atualizar interface
            document.getElementById('obra-selecionada-numero').textContent = obra.numero_obra;
            document.getElementById('obra-selecionada-cliente').textContent = obra.clientes_hvc?.nome || 'Cliente não encontrado';
            console.log('🖥️ Interface da obra atualizada');
            
            // Carregar serviços da obra
            console.log('🔄 Iniciando carregamento de serviços...');
            await this.loadServicosObra(obraId);
            
            console.log('🎨 Iniciando renderização de serviços...');
            await this.renderServicos();
            
            // Mostrar container de serviços
            const servicosContainer = document.getElementById('servicos-container');
            if (servicosContainer) {
                servicosContainer.style.display = 'block';
                console.log('👁️ Container de serviços mostrado');
            } else {
                console.error('❌ Container servicos-container não encontrado no DOM');
            }
            
            this.hideLoading();
            
            // Fechar modal de obras
            this.fecharModalObras();
            
            this.showNotification('Obra selecionada com sucesso!', 'success');
            console.log('✅ Obra selecionada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao selecionar obra:', error);
            this.showNotification('Erro ao selecionar obra: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    // ========================================
    // RENDERIZAÇÃO - COM DEBUG DETALHADO
    // ========================================

    async renderServicos() {
        console.log('🎨 Iniciando renderização de serviços...');
        
        const container = document.getElementById('servicos-list');
        console.log('📦 Container servicos-list encontrado:', !!container);
        
        if (!container) {
            console.error('❌ Container servicos-list não encontrado no DOM');
            return;
        }

        console.log('📊 Verificando this.servicosObra:', this.servicosObra);
        console.log('📊 Quantidade de serviços:', this.servicosObra?.length || 0);

        if (!this.servicosObra || this.servicosObra.length === 0) {
            console.log('⚠️ Nenhum serviço encontrado, mostrando mensagem vazia');
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #b0c4de;">
                    <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhum serviço disponível para medição
                    <br><small>DEBUG: servicosObra.length = ${this.servicosObra?.length || 0}</small>
                </div>
            `;
            return;
        }

        console.log('🔄 Gerando HTML para', this.servicosObra.length, 'serviços');
        
        const htmlServicos = this.servicosObra.map((servico, index) => {
            console.log(`🔧 Renderizando serviço ${index + 1}:`, servico);
            
            return `
                <div class="servico-item" style="border: 1px solid #333; margin: 10px 0; padding: 15px; border-radius: 8px; background: #1a1a2e;">
                    <div class="servico-header">
                        <div>
                            <div class="servico-nome" style="color: #fff; font-weight: bold;">
                                Serviço ID: ${servico.id || 'N/A'}
                            </div>
                            <div class="servico-codigo" style="color: #b0c4de;">
                                Status: ${servico.status || 'N/A'}
                            </div>
                            <div style="color: #888; font-size: 12px;">
                                Item Proposta: ${servico.item_proposta_id || 'N/A'}
                            </div>
                            <div style="color: #888; font-size: 12px;">
                                Obra ID: ${servico.obra_id || 'N/A'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="servico-actions" style="margin-top: 10px;">
                        <button class="btn-medicao" onclick="medicoesManager.adicionarMedicao('${servico.id}')" 
                                style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-plus"></i> Adicionar Medição
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        console.log('📝 HTML gerado:', htmlServicos.substring(0, 200) + '...');
        
        container.innerHTML = htmlServicos;
        console.log('✅ HTML inserido no container');
        
        // Verificar se o HTML foi realmente inserido
        setTimeout(() => {
            const verificacao = document.getElementById('servicos-list');
            console.log('🔍 Verificação pós-inserção - Container existe:', !!verificacao);
            console.log('🔍 Verificação pós-inserção - innerHTML length:', verificacao?.innerHTML?.length || 0);
            console.log('🔍 Verificação pós-inserção - Primeiro filho:', verificacao?.firstElementChild?.className || 'NENHUM');
        }, 100);
    }

    // ========================================
    // MODAIS E INTERFACE
    // ========================================

    abrirModalNovaMedicao() {
        console.log('📝 Abrindo modal de nova medição...');
        const modal = document.getElementById('modal-nova-medicao');
        if (modal) {
            modal.style.display = 'flex';
            console.log('✅ Modal nova medição aberto');
        } else {
            console.error('❌ Modal nova medição não encontrado');
        }
    }

    fecharModalMedicao() {
        console.log('❌ Fechando modal de medição...');
        const modal = document.getElementById('modal-nova-medicao');
        if (modal) {
            modal.style.display = 'none';
            console.log('✅ Modal medição fechado');
        }
    }

    abrirModalObras() {
        console.log('🏗️ Abrindo modal de obras...');
        const modal = document.getElementById('modal-obras');
        if (modal) {
            modal.style.display = 'flex';
            this.renderObrasModal();
            console.log('✅ Modal obras aberto');
        } else {
            console.error('❌ Modal obras não encontrado');
        }
    }

    fecharModalObras() {
        console.log('❌ Fechando modal de obras...');
        const modal = document.getElementById('modal-obras');
        if (modal) {
            modal.style.display = 'none';
            console.log('✅ Modal obras fechado');
        }
    }

    renderObrasModal() {
        console.log('🎨 Renderizando lista de obras no modal...');
        const container = document.getElementById('obras-list');
        if (!container) {
            console.error('❌ Container obras-list não encontrado');
            return;
        }

        console.log('📊 Obras disponíveis:', this.obras.length);

        if (this.obras.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #b0c4de;">
                    <i class="fas fa-building" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhuma obra ativa encontrada
                </div>
            `;
            return;
        }

        container.innerHTML = this.obras.map(obra => `
            <div class="obra-item" onclick="selecionarObra('${obra.id}')" style="cursor: pointer; padding: 15px; border: 1px solid #333; margin: 10px 0; border-radius: 8px; background: #1a1a2e;">
                <div class="obra-numero" style="color: #fff; font-weight: bold;">${obra.numero_obra}</div>
                <div class="obra-cliente" style="color: #b0c4de;">${obra.clientes_hvc?.nome || 'Cliente não encontrado'}</div>
                <div class="obra-status" style="color: #4CAF50; font-size: 12px;">${obra.status}</div>
            </div>
        `).join('');

        console.log('✅ Lista de obras renderizada');
    }

    // ========================================
    // UTILITÁRIOS
    // ========================================

    showLoading() {
        console.log('⏳ Mostrando loading...');
        // Implementar loading se necessário
    }

    hideLoading() {
        console.log('✅ Escondendo loading...');
        // Implementar loading se necessário
    }

    showNotification(message, type = 'info') {
        console.log(`📢 Notificação [${type}]:`, message);
        // Implementar notificações se necessário
    }

    populateObrasFilter() {
        console.log('🔧 Populando filtro de obras...');
        // Implementar se necessário
    }

    renderMedicoes() {
        console.log('🎨 Renderizando medições...');
        // Implementar se necessário
    }

    aplicarFiltros() {
        console.log('🔍 Aplicando filtros...');
        // Implementar se necessário
    }

    filtrarObras(termo) {
        console.log('🔍 Filtrando obras por:', termo);
        // Implementar se necessário
    }

    adicionarMedicao(servicoId) {
        console.log('➕ Adicionando medição para serviço:', servicoId);
        // Implementar se necessário
    }
}

// Expor para debug global
window.medicoesManagerDebug = medicoesManager;

