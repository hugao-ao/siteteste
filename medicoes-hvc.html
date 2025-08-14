// Sistema de Medições HVC - Novo com Cálculos Automáticos

// Usar Supabase global (carregado pelo supabase.js)
let supabaseClient = null;

let medicoesManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando aplicação de medições...');
    initializeApp();
});

function initializeApp() {
    console.log('Inicializando aplicação de medições...');
    
    // Verificar se o Supabase está disponível globalmente
    if (window.supabase) {
        supabaseClient = window.supabase;
        console.log('Supabase conectado com sucesso!');
        
        // Inicializar o gerenciador de medições
        medicoesManager = new MedicoesManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.medicoesManager = medicoesManager;
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
        this.servicosCalculados = [];
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
        
        // Botão Nova Medição
        const btnNovaMedicao = document.getElementById('btn-nova-medicao');
        if (btnNovaMedicao) {
            btnNovaMedicao.addEventListener('click', () => this.showModalMedicao());
        }

        // Botão Selecionar Obra
        const btnSelecionarObra = document.getElementById('btn-selecionar-obra');
        if (btnSelecionarObra) {
            btnSelecionarObra.addEventListener('click', () => this.showModalObras());
        }

        // Formulário de Medição
        const formMedicao = document.getElementById('form-medicao');
        if (formMedicao) {
            formMedicao.addEventListener('submit', (e) => this.handleSubmitMedicao(e));
        }

        // Modais - Fechar
        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Botões de cancelar
        const btnCancelarMedicao = document.getElementById('btn-cancelar-medicao');
        if (btnCancelarMedicao) {
            btnCancelarMedicao.addEventListener('click', () => this.hideModalMedicao());
        }

        const btnCancelarValor = document.getElementById('btn-cancelar-valor');
        if (btnCancelarValor) {
            btnCancelarValor.addEventListener('click', () => this.hideModalValor());
        }

        // Botão Confirmar Valor
        const btnConfirmarValor = document.getElementById('btn-confirmar-valor');
        if (btnConfirmarValor) {
            btnConfirmarValor.addEventListener('click', () => this.confirmarESalvarMedicao());
        }

        // Filtros
        const filtroObra = document.getElementById('filtro-obra');
        const filtroStatus = document.getElementById('filtro-status');
        const filtroData = document.getElementById('filtro-data');
        
        if (filtroObra) filtroObra.addEventListener('change', () => this.aplicarFiltros());
        if (filtroStatus) filtroStatus.addEventListener('change', () => this.aplicarFiltros());
        if (filtroData) filtroData.addEventListener('change', () => this.aplicarFiltros());

        // Limpar filtros
        const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
        if (btnLimparFiltros) {
            btnLimparFiltros.addEventListener('click', () => this.limparFiltros());
        }

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
            
            const { data, error } = await supabaseClient
                .from('obras_hvc')
                .select(`
                    *,
                    clientes_hvc (nome)
                `)
                .eq('status', 'ativa')
                .order('nome');

            if (error) throw error;

            this.obras = data || [];
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
            
            const { data, error } = await supabaseClient
                .from('medicoes_hvc')
                .select(`
                    *,
                    obras_hvc (nome, clientes_hvc (nome))
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.medicoes = data || [];
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
            
            // Buscar serviços da proposta contratada
            const { data: propostas, error: propError } = await supabaseClient
                .from('propostas_hvc')
                .select(`
                    id,
                    propostas_servicos_hvc (
                        servico_id,
                        quantidade,
                        valor_unitario,
                        valor_total,
                        servicos_hvc (codigo, nome, unidade)
                    )
                `)
                .eq('obra_id', obraId)
                .eq('status', 'contratada')
                .single();

            if (propError) throw propError;

            if (!propostas || !propostas.propostas_servicos_hvc) {
                this.showNotification('Nenhuma proposta contratada encontrada para esta obra', 'warning');
                return [];
            }

            this.servicosObra = propostas.propostas_servicos_hvc.map(item => ({
                servico_id: item.servico_id,
                codigo: item.servicos_hvc.codigo,
                nome: item.servicos_hvc.nome,
                unidade: item.servicos_hvc.unidade,
                quantidade_contratada: item.quantidade,
                valor_unitario_contratado: item.valor_unitario,
                valor_total_contratado: item.valor_total
            }));

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

                if (prodError) throw prodError;

                let totalProduzido = 0;
                producoes.forEach(producao => {
                    const quantidades = producao.quantidades_servicos || {};
                    if (quantidades[servico.servico_id]) {
                        totalProduzido += parseFloat(quantidades[servico.servico_id]);
                    }
                });

                // 2. TOTAL JÁ MEDIDO - das medições anteriores
                const { data: medicoes, error: medError } = await supabaseClient
                    .from('medicoes_servicos')
                    .select(`
                        quantidade_medida,
                        medicoes_hvc!inner (obra_id)
                    `)
                    .eq('servico_id', servico.servico_id)
                    .eq('medicoes_hvc.obra_id', obraId);

                if (medError) throw medError;

                let totalMedido = 0;
                medicoes.forEach(medicao => {
                    totalMedido += parseFloat(medicao.quantidade_medida);
                });

                // 3. CALCULAR DISPONÍVEL PARA MEDIÇÃO
                const disponivelParaMedicao = Math.min(
                    servico.quantidade_contratada,
                    totalProduzido
                ) - totalMedido;

                // Adicionar dados calculados ao serviço
                servico.quantidade_produzida = totalProduzido;
                servico.quantidade_medida = totalMedido;
                servico.quantidade_disponivel = Math.max(0, disponivelParaMedicao);
                
                // Calcular valores
                servico.valor_produzido = totalProduzido * servico.valor_unitario_contratado;
                servico.valor_medido = totalMedido * servico.valor_unitario_contratado;
                servico.valor_disponivel = servico.quantidade_disponivel * servico.valor_unitario_contratado;
            }

            console.log('Cálculos concluídos para', this.servicosObra.length, 'serviços');
            
        } catch (error) {
            console.error('Erro ao calcular quantidades:', error);
            this.showNotification('Erro ao calcular quantidades: ' + error.message, 'error');
        }
    }

    // ========================================
    // INTERFACE - MODAIS
    // ========================================

    showModalMedicao() {
        // Limpar dados anteriores
        this.obraSelecionada = null;
        this.servicosObra = [];
        this.servicosCalculados = [];
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
            <button type="button" class="btn-secondary" id="btn-selecionar-obra">
                <i class="fas fa-building"></i>
                Selecionar Obra
            </button>
        `;
        
        // Reconfigurar event listener
        const btnSelecionarObra = document.getElementById('btn-selecionar-obra');
        if (btnSelecionarObra) {
            btnSelecionarObra.addEventListener('click', () => this.showModalObras());
        }
        
        // Esconder container de serviços
        document.getElementById('servicos-container').style.display = 'none';
        
        // Mostrar modal
        document.getElementById('modal-medicao').style.display = 'block';
    }

    hideModalMedicao() {
        document.getElementById('modal-medicao').style.display = 'none';
    }

    showModalObras() {
        this.renderObrasModal();
        document.getElementById('modal-obras').style.display = 'block';
    }

    hideModalObras() {
        document.getElementById('modal-obras').style.display = 'none';
    }

    showModalValor() {
        // Calcular valor total
        this.calcularValorTotal();
        
        // Preencher modal
        document.getElementById('valor-calculado').textContent = this.formatarMoeda(this.valorTotalCalculado);
        document.getElementById('valor-ajustado').value = this.valorTotalCalculado.toFixed(2);
        document.getElementById('motivo-ajuste').value = '';
        
        // Mostrar modal
        document.getElementById('modal-confirmar-valor').style.display = 'block';
    }

    hideModalValor() {
        document.getElementById('modal-confirmar-valor').style.display = 'none';
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
                    <div>${medicao.obras_hvc.nome}</div>
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
                    <button class="btn-secondary" onclick="medicoesManager.editarMedicao('${medicao.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="medicoesManager.excluirMedicao('${medicao.id}')" title="Excluir">
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
                            <td><strong>${obra.nome}</strong></td>
                            <td>${obra.clientes_hvc.nome}</td>
                            <td>
                                <button class="btn-primary" onclick="medicoesManager.selecionarObra('${obra.id}')">
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
                            ${servico.quantidade_contratada.toFixed(2)} ${servico.unidade}  

                            <small>${this.formatarMoeda(servico.valor_total_contratado)}</small>
                        </div>
                    </div>
                    
                    <div class="valor-item valor-produzido">
                        <div class="valor-label">Total Produzido</div>
                        <div class="valor-numero">
                            ${servico.quantidade_produzida.toFixed(2)} ${servico.unidade}  

                            <small>${this.formatarMoeda(servico.valor_produzido)}</small>
                        </div>
                    </div>
                    
                    <div class="valor-item valor-medido">
                        <div class="valor-label">Total Medido</div>
                        <div class="valor-numero">
                            ${servico.quantidade_medida.toFixed(2)} ${servico.unidade}  

                            <small>${this.formatarMoeda(servico.valor_medido)}</small>
                        </div>
                    </div>
                    
                    <div class="valor-item valor-disponivel">
                        <div class="valor-label">Disponível para Medição</div>
                        <div class="valor-numero">
                            ${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}  

                            <small>${this.formatarMoeda(servico.valor_disponivel)}</small>
                        </div>
                    </div>
                </div>
                
                ${servico.quantidade_disponivel > 0 ? `
                    <div style="margin-top: 1rem;">
                        <label>Quantidade a Medir:</label>
                        <input 
                            type="number" 
                            class="input-medicao" 
                            id="medicao-${servico.servico_id}"
                            max="${servico.quantidade_disponivel}" 
                            min="0" 
                            step="0.01"
                            placeholder="0.00"
                            onchange="medicoesManager.atualizarQuantidadeMedicao('${servico.servico_id}', this.value)"
                        >
                    </div>
                ` : `
                    <div style="margin-top: 1rem; text-align: center; color: #ff9800; font-weight: 600;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Nenhuma quantidade disponível para medição
                    </div>
                `}
            </div>
        `).join('');
    }

    populateObrasFilter() {
        const select = document.getElementById('filtro-obra');
        if (!select) return;

        select.innerHTML = '<option value="">Todas as obras</option>' +
            this.obras.map(obra => `
                <option value="${obra.id}">${obra.nome} - ${obra.clientes_hvc.nome}</option>
            `).join('');
    }

    // ========================================
    // AÇÕES
    // ========================================

    async selecionarObra(obraId) {
        try {
            this.showLoading('Carregando serviços da obra...');
            
            const obra = this.obras.find(o => o.id === obraId);
            if (!obra) {
                this.showNotification('Obra não encontrada', 'error');
                return;
            }

            this.obraSelecionada = obra;
            
            // Carregar serviços da obra
            await this.loadServicosObra(obraId);
            
            // Atualizar interface
            const obraContainer = document.getElementById('obra-selecionada-container');
            obraContainer.innerHTML = `
                <div class="obra-selecionada">
                    <div class="obra-info">
                        <div>
                            <div class="obra-nome">${obra.nome}</div>
                            <div class="obra-cliente">${obra.clientes_hvc.nome}</div>
                        </div>
                        <button type="button" class="btn-secondary" onclick="medicoesManager.showModalObras()">
                            <i class="fas fa-edit"></i>
                            Alterar
                        </button>
                    </div>
                </div>
            `;
            
            // Mostrar serviços
            await this.renderServicos();
            document.getElementById('servicos-container').style.display = 'block';
            
            this.hideModalObras();
            this.hideLoading();
            
        } catch (error) {
            console.error('Erro ao selecionar obra:', error);
            this.showNotification('Erro ao carregar dados da obra: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    atualizarQuantidadeMedicao(servicoId, quantidade) {
        const servico = this.servicosObra.find(s => s.servico_id === servicoId);
        if (!servico) return;

        const qtd = parseFloat(quantidade) || 0;
        
        // Validar quantidade
        if (qtd > servico.quantidade_disponivel) {
            this.showNotification(`Quantidade não pode ser maior que ${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}`, 'warning');
            document.getElementById(`medicao-${servicoId}`).value = servico.quantidade_disponivel.toFixed(2);
            return;
        }

        // Atualizar quantidade no serviço
        servico.quantidade_a_medir = qtd;
        servico.valor_a_medir = qtd * servico.valor_unitario_contratado;
        
        console.log(`Serviço ${servicoId}: ${qtd} ${servico.unidade} = ${this.formatarMoeda(servico.valor_a_medir)}`);
    }

    calcularValorTotal() {
        this.valorTotalCalculado = 0;
        this.servicosCalculados = [];

        this.servicosObra.forEach(servico => {
            if (servico.quantidade_a_medir && servico.quantidade_a_medir > 0) {
                this.servicosCalculados.push({
                    servico_id: servico.servico_id,
                    quantidade_medida: servico.quantidade_a_medir,
                    valor_unitario: servico.valor_unitario_contratado,
                    valor_total: servico.valor_a_medir
                });
                
                this.valorTotalCalculado += servico.valor_a_medir;
            }
        });

        console.log('Valor total calculado:', this.formatarMoeda(this.valorTotalCalculado));
        console.log('Serviços para medição:', this.servicosCalculados);
    }

    async handleSubmitMedicao(e) {
        e.preventDefault();
        
        try {
            // Validações
            if (!this.obraSelecionada) {
                this.showNotification('Selecione uma obra', 'warning');
                return;
            }

            const dataMedicao = document.getElementById('data-medicao').value;
            if (!dataMedicao) {
                this.showNotification('Informe a data da medição', 'warning');
                return;
            }

            // Verificar se há serviços para medir
            this.calcularValorTotal();
            
            if (this.servicosCalculados.length === 0) {
                this.showNotification('Informe pelo menos um serviço para medição', 'warning');
                return;
            }

            // Mostrar modal de confirmação de valor
            this.showModalValor();
            
        } catch (error) {
            console.error('Erro ao processar medição:', error);
            this.showNotification('Erro ao processar medição: ' + error.message, 'error');
        }
    }

    async confirmarESalvarMedicao() {
        try {
            this.showLoading('Salvando medição...');

            // Obter dados do modal de valor
            const valorAjustado = parseFloat(document.getElementById('valor-ajustado').value) || this.valorTotalCalculado;
            const motivoAjuste = document.getElementById('motivo-ajuste').value.trim();
            const observacoes = document.getElementById('observacoes-medicao').value.trim();
            const dataMedicao = document.getElementById('data-medicao').value;

            // Gerar número da medição
            const numeroMedicao = await this.gerarNumeroMedicao();

            // Salvar medição principal
            const { data: medicao, error: medicaoError } = await supabaseClient
                .from('medicoes_hvc')
                .insert({
                    numero: numeroMedicao,
                    obra_id: this.obraSelecionada.id,
                    data_medicao: dataMedicao,
                    valor_total: this.valorTotalCalculado,
                    valor_ajustado: valorAjustado,
                    observacoes: observacoes + (motivoAjuste ? `\n\nMotivo do ajuste: ${motivoAjuste}` : ''),
                    status: 'rascunho'
                })
                .select()
                .single();

            if (medicaoError) throw medicaoError;

            // Salvar serviços da medição
            const servicosParaSalvar = this.servicosCalculados.map(servico => ({
                medicao_id: medicao.id,
                servico_id: servico.servico_id,
                quantidade_medida: servico.quantidade_medida,
                valor_unitario: servico.valor_unitario,
                valor_total: servico.valor_total
            }));

            const { error: servicosError } = await supabaseClient
                .from('medicoes_servicos')
                .insert(servicosParaSalvar);

            if (servicosError) throw servicosError;

            this.showNotification('Medição salva com sucesso!', 'success');
            
            // Recarregar dados e fechar modais
            await this.loadMedicoes();
            this.hideModalValor();
            this.hideModalMedicao();
            this.hideLoading();

        } catch (error) {
            console.error('Erro ao salvar medição:', error);
            this.showNotification('Erro ao salvar medição: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    async gerarNumeroMedicao() {
        try {
            const { data, error } = await supabaseClient
                .rpc('generate_medicao_numero');

            if (error) throw error;
            
            return data || 'MED-001';
            
        } catch (error) {
            console.error('Erro ao gerar número:', error);
            // Fallback: gerar número baseado na quantidade atual
            const proximoNumero = this.medicoes.length + 1;
            return `MED-${proximoNumero.toString().padStart(3, '0')}`;
        }
    }

    // ========================================
    // FILTROS E BUSCA
    // ========================================

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
        const obrasFiltradas = this.obras.filter(obra => 
            obra.nome.toLowerCase().includes(termo.toLowerCase()) ||
            obra.clientes_hvc.nome.toLowerCase().includes(termo.toLowerCase())
        );
        
        // Re-renderizar lista filtrada
        // Implementar se necessário
    }

    // ========================================
    // AÇÕES DE MEDIÇÃO
    // ========================================

    async editarMedicao(medicaoId) {
        this.showNotification('Funcionalidade de edição em desenvolvimento', 'info');
    }

    async excluirMedicao(medicaoId) {
        if (!confirm('Tem certeza que deseja excluir esta medição?')) {
            return;
        }

        try {
            this.showLoading('Excluindo medição...');

            const { error } = await supabaseClient
                .from('medicoes_hvc')
                .delete()
                .eq('id', medicaoId);

            if (error) throw error;

            this.showNotification('Medição excluída com sucesso!', 'success');
            await this.loadMedicoes();
            this.hideLoading();

        } catch (error) {
            console.error('Erro ao excluir medição:', error);
            this.showNotification('Erro ao excluir medição: ' + error.message, 'error');
            this.hideLoading();
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
        return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    getStatusColor(status) {
        const colors = {
            'rascunho': 'secondary',
            'aprovada': 'success',
            'paga': 'primary'
        };
        return colors[status] || 'secondary';
    }

    getStatusText(status) {
        const texts = {
            'rascunho': 'Rascunho',
            'aprovada': 'Aprovada',
            'paga': 'Paga'
        };
        return texts[status] || status;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }

    showLoading(message = 'Carregando...') {
        const loading = document.getElementById('loading');
        const loadingText = loading.querySelector('p');
        if (loadingText) loadingText.textContent = message;
        loading.style.display = 'block';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }
}

// Expor funções globalmente se necessário
window.showNotification = function(message, type) {
    if (medicoesManager) {
        medicoesManager.showNotification(message, type);
    }
};
