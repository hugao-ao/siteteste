// medicoes-hvc.js - Sistema de Gestão de Medições HVC
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
        this.currentMedicaoId = null;
        this.obraSelecionada = null;
        this.obras = [];
        this.medicoes = [];
        this.servicosObra = [];
        this.valorTotalCalculado = 0;
        
        this.init();
    }

    async init() {
        console.log('Inicializando MedicoesManager...');
        
        try {
            await this.loadObras();
            await this.loadMedicoes();
            this.setupEventListeners();
            console.log('MedicoesManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar MedicoesManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
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
    // CARREGAMENTO DE DADOS - CONSULTAS CORRIGIDAS
    // ========================================

    async loadObras() {
        try {
            console.log('Carregando obras...');
            
            // CONSULTA CORRIGIDA: Buscar obras primeiro
            const { data: obras, error: obrasError } = await supabaseClient
                .from('obras_hvc')
                .select('*')
                .eq('status', 'Andamento')
                .order('numero_obra');

            if (obrasError) throw obrasError;

            // Buscar clientes separadamente para cada obra
            const obrasComClientes = [];
            for (const obra of obras || []) {
                const { data: cliente, error: clienteError } = await supabaseClient
                    .from('clientes_hvc')
                    .select('nome')
                    .eq('id', obra.cliente_id)
                    .single();

                if (clienteError) {
                    console.warn(`Cliente não encontrado para obra ${obra.id}:`, clienteError);
                    obrasComClientes.push({
                        ...obra,
                        clientes_hvc: { nome: 'Cliente não encontrado' }
                    });
                } else {
                    obrasComClientes.push({
                        ...obra,
                        clientes_hvc: cliente
                    });
                }
            }

            this.obras = obrasComClientes;
            console.log('Obras carregadas:', this.obras.length);
            
            this.populateObrasFilter();
            
        } catch (error) {
            console.error('Erro ao carregar obras:', error);
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    async loadMedicoes() {
        try {
            console.log('Carregando medições...');
            
            // CONSULTA CORRIGIDA: Buscar medições primeiro
            const { data: medicoes, error: medicoesError } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .order('created_at', { ascending: false });

            if (medicoesError) throw medicoesError;

            // Buscar obras e clientes separadamente para cada medição
            const medicoesCompletas = [];
            for (const medicao of medicoes || []) {
                // Buscar obra
                const { data: obra, error: obraError } = await supabaseClient
                    .from('obras_hvc')
                    .select('nome, cliente_id')
                    .eq('id', medicao.obra_id)
                    .single();

                if (obraError) {
                    console.warn(`Obra não encontrada para medição ${medicao.id}:`, obraError);
                    medicoesCompletas.push({
                        ...medicao,
                        obras_hvc: { 
                            nome: 'Obra não encontrada',
                            clientes_hvc: { nome: 'Cliente não encontrado' }
                        }
                    });
                    continue;
                }

                // Buscar cliente da obra
                const { data: cliente, error: clienteError } = await supabaseClient
                    .from('clientes_hvc')
                    .select('nome')
                    .eq('id', obra.cliente_id)
                    .single();

                if (clienteError) {
                    console.warn(`Cliente não encontrado para obra ${obra.cliente_id}:`, clienteError);
                    medicoesCompletas.push({
                        ...medicao,
                        obras_hvc: {
                            ...obra,
                            clientes_hvc: { nome: 'Cliente não encontrado' }
                        }
                    });
                } else {
                    medicoesCompletas.push({
                        ...medicao,
                        obras_hvc: {
                            ...obra,
                            clientes_hvc: cliente
                        }
                    });
                }
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
            
            // CONSULTA CORRIGIDA: Buscar proposta contratada primeiro
            const { data: propostas, error: propError } = await supabaseClient
                .from('propostas_hvc')
                .select('id')
                .eq('obra_id', obraId)
                .eq('status', 'contratada');

            if (propError) throw propError;

            if (!propostas || propostas.length === 0) {
                this.showNotification('Nenhuma proposta contratada encontrada para esta obra', 'warning');
                return [];
            }

            const propostaId = propostas[0].id;

            // Buscar serviços da proposta
            const { data: servicosProposta, error: servicosError } = await supabaseClient
                .from('propostas_servicos_hvc')
                .select('*')
                .eq('proposta_id', propostaId);

            if (servicosError) throw servicosError;

            // Buscar detalhes dos serviços separadamente
            const servicosCompletos = [];
            for (const servicoProposta of servicosProposta || []) {
                const { data: servico, error: servicoError } = await supabaseClient
                    .from('servicos_hvc')
                    .select('codigo, nome, unidade')
                    .eq('id', servicoProposta.servico_id)
                    .single();

                if (servicoError) {
                    console.warn(`Serviço não encontrado ${servicoProposta.servico_id}:`, servicoError);
                    continue;
                }

                servicosCompletos.push({
                    servico_id: servicoProposta.servico_id,
                    codigo: servico.codigo,
                    nome: servico.nome,
                    unidade: servico.unidade,
                    quantidade_contratada: servicoProposta.quantidade,
                    valor_unitario_contratado: servicoProposta.valor_unitario,
                    valor_total_contratado: servicoProposta.valor_total
                });
            }

            this.servicosObra = servicosCompletos;
            console.log('Serviços da obra carregados:', this.servicosObra.length);
            
            // Calcular quantidades produzidas e medidas
            await this.calcularQuantidadesServicos(obraId);
            
            return this.servicosObra;
            
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
                    servico.quantidade_medida = 0;
                } else {
                    let totalMedido = 0;
                    
                    // Para cada medição da obra, buscar os serviços medidos
                    for (const medicaoObra of medicoesObra || []) {
                        const { data: servicosMedidos, error: servMedError } = await supabaseClient
                            .from('medicoes_servicos')
                            .select('quantidade_medida')
                            .eq('medicao_id', medicaoObra.id)
                            .eq('servico_id', servico.servico_id);

                        if (!servMedError && servicosMedidos) {
                            servicosMedidos.forEach(servicoMedido => {
                                totalMedido += parseFloat(servicoMedido.quantidade_medida);
                            });
                        }
                    }
                    
                    servico.quantidade_medida = totalMedido;
                }

                // 3. CALCULAR DISPONÍVEL PARA MEDIÇÃO
                const disponivelParaMedicao = Math.min(
                    servico.quantidade_contratada,
                    servico.quantidade_produzida
                ) - servico.quantidade_medida;

                servico.quantidade_disponivel = Math.max(0, disponivelParaMedicao);
                
                // Calcular valores
                servico.valor_produzido = servico.quantidade_produzida * servico.valor_unitario_contratado;
                servico.valor_medido = servico.quantidade_medida * servico.valor_unitario_contratado;
                servico.valor_disponivel = servico.quantidade_disponivel * servico.valor_unitario_contratado;
            }

            console.log('Cálculos concluídos para', this.servicosObra.length, 'serviços');
            
        } catch (error) {
            console.error('Erro ao calcular quantidades:', error);
            this.showNotification('Erro ao calcular quantidades: ' + error.message, 'error');
        }
    }

    // ========================================
    // FUNÇÕES DE MODAL
    // ========================================

    abrirModalNovaMedicao() {
        console.log('Abrindo modal de nova medição...');
        
        // Limpar dados anteriores
        this.obraSelecionada = null;
        this.servicosObra = [];
        this.valorTotalCalculado = 0;
        
        // Definir data atual
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('data-medicao').value = hoje;
        
        // Limpar formulário
        document.getElementById('form-medicao').reset();
        document.getElementById('data-medicao').value = hoje;
        
        // Resetar seleção de obra
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
        document.getElementById('modal-medicao').style.display = 'block';
    }

    fecharModalMedicao() {
        document.getElementById('modal-medicao').style.display = 'none';
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
        
        // Preencher modal
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
            await this.loadServicosObra(obraId);
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
        const container = document.getElementById('servicos-list');
        if (!container) return;

        if (this.servicosObra.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #b0c4de;">
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
                        <div class="servico-nome">${servico.nome}</div>
                        <div class="servico-codigo">${servico.codigo} - ${servico.unidade}</div>
                    </div>
                </div>
                
                <div class="servico-valores">
                    <div class="valor-item valor-contratado">
                        <div class="valor-label">Total Contratado</div>
                        <div class="valor-numero">
                            ${servico.quantidade_contratada.toFixed(2)} ${servico.unidade}<br>
                            <small>${this.formatarMoeda(servico.valor_total_contratado)}</small>
                        </div>
                    </div>
                    
                    <div class="valor-item valor-produzido">
                        <div class="valor-label">Total Produzido</div>
                        <div class="valor-numero">
                            ${servico.quantidade_produzida.toFixed(2)} ${servico.unidade}<br>
                            <small>${this.formatarMoeda(servico.valor_produzido)}</small>
                        </div>
                    </div>
                    
                    <div class="valor-item valor-medido">
                        <div class="valor-label">Total Medido</div>
                        <div class="valor-numero">
                            ${servico.quantidade_medida.toFixed(2)} ${servico.unidade}<br>
                            <small>${this.formatarMoeda(servico.valor_medido)}</small>
                        </div>
                    </div>
                    
                    <div class="valor-item valor-disponivel">
                        <div class="valor-label">Disponível para Medição</div>
                        <div class="valor-numero">
                            ${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}<br>
                            <small>${this.formatarMoeda(servico.valor_disponivel)}</small>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 1rem;">
                    <label class="valor-label">Quantidade a Medir:</label>
                    <input type="number" 
                           class="input-medicao" 
                           id="medicao-${servico.servico_id}"
                           step="0.01" 
                           min="0" 
                           max="${servico.quantidade_disponivel}"
                           placeholder="0.00"
                           onchange="atualizarCalculos()">
                    <small style="color: #b0c4de;">Máximo: ${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}</small>
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
                        if (quantidade > servico.quantidade_disponivel) {
                            throw new Error(`Quantidade para ${servico.nome} excede o disponível (${servico.quantidade_disponivel.toFixed(2)})`);
                        }
                        servicosComQuantidade.push({
                            servico_id: servico.servico_id,
                            quantidade: quantidade,
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
            console.error('Erro ao validar medição:', error);
            this.showNotification('Erro: ' + error.message, 'error');
        }
    }

    async confirmarESalvarMedicao() {
        try {
            console.log('Confirmando e salvando medição...');
            this.showLoading();
            
            // Obter dados do formulário
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
        // Implementar filtros se necessário
        console.log('Aplicando filtros...');
    }

    limparFiltros() {
        document.getElementById('filtro-obra').value = '';
        document.getElementById('filtro-status').value = '';
        document.getElementById('filtro-data').value = '';
        this.aplicarFiltros();
    }

    filtrarObras(termo) {
        // Implementar busca de obras se necessário
        console.log('Filtrando obras por:', termo);
    }

    // ========================================
    // AÇÕES DE MEDIÇÃO
    // ========================================

    editarMedicao(medicaoId) {
        console.log('Editando medição:', medicaoId);
        this.showNotification('Funcionalidade em desenvolvimento', 'warning');
    }

    excluirMedicao(medicaoId) {
        if (confirm('Tem certeza que deseja excluir esta medição?')) {
            console.log('Excluindo medição:', medicaoId);
            this.showNotification('Funcionalidade em desenvolvimento', 'warning');
        }
    }

    // ========================================
    // UTILITÁRIOS
    // ========================================

    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    formatarData(data) {
        return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    getStatusColor(status) {
        switch (status) {
            case 'rascunho': return 'secondary';
            case 'aprovada': return 'primary';
            case 'paga': return 'success';
            default: return 'secondary';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'rascunho': return 'Rascunho';
            case 'aprovada': return 'Aprovada';
            case 'paga': return 'Paga';
            default: return 'Desconhecido';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// Função global para mostrar notificações
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

