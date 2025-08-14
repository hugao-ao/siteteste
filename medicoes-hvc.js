// Sistema de Medições HVC - Versão Final Corrigida
// Usando funções globais para evitar problemas de módulos

// Variáveis globais
let obraSelecionada = null;
let obras = [];
let medicoes = [];
let servicosObra = [];
let valorTotalCalculado = 0;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando aplicação de medições...');
    initializeApp();
});

function initializeApp() {
    console.log('Inicializando aplicação de medições...');
    
    // Verificar se o Supabase está disponível globalmente
    if (window.supabase) {
        console.log('Supabase conectado com sucesso!');
        
        // Carregar dados iniciais
        loadObras();
        loadMedicoes();
        
        // Configurar data atual
        const hoje = new Date().toISOString().split('T')[0];
        const dataInput = document.getElementById('data-medicao');
        if (dataInput) {
            dataInput.value = hoje;
        }
        
        console.log('Aplicação inicializada com sucesso!');
    } else {
        console.error('Erro: Supabase não disponível');
        showNotification('Erro de conexão com o banco de dados', 'error');
    }
}

// ========================================
// CARREGAMENTO DE DADOS
// ========================================

async function loadObras() {
    try {
        console.log('Carregando obras...');
        
        const { data, error } = await window.supabase
            .from('obras_hvc')
            .select(`
                *,
                clientes_hvc (nome)
            `)
            .eq('status', 'ativa')
            .order('nome');

        if (error) throw error;

        obras = data || [];
        console.log('Obras carregadas:', obras.length);
        
        populateObrasFilter();
        
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        showNotification('Erro ao carregar obras: ' + error.message, 'error');
    }
}

async function loadMedicoes() {
    try {
        console.log('Carregando medições...');
        
        const { data, error } = await window.supabase
            .from('medicoes_hvc')
            .select(`
                *,
                obras_hvc (nome, clientes_hvc (nome))
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        medicoes = data || [];
        console.log('Medições carregadas:', medicoes.length);
        
        renderMedicoes();
        
    } catch (error) {
        console.error('Erro ao carregar medições:', error);
        showNotification('Erro ao carregar medições: ' + error.message, 'error');
    }
}

async function loadServicosObra(obraId) {
    try {
        console.log('Carregando serviços da obra:', obraId);
        
        // Buscar serviços da proposta contratada
        const { data: propostas, error: propError } = await window.supabase
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
            showNotification('Nenhuma proposta contratada encontrada para esta obra', 'warning');
            return [];
        }

        servicosObra = propostas.propostas_servicos_hvc.map(item => ({
            servico_id: item.servico_id,
            codigo: item.servicos_hvc.codigo,
            nome: item.servicos_hvc.nome,
            unidade: item.servicos_hvc.unidade,
            quantidade_contratada: item.quantidade,
            valor_unitario_contratado: item.valor_unitario,
            valor_total_contratado: item.valor_total
        }));

        console.log('Serviços da obra carregados:', servicosObra.length);
        
        // Calcular quantidades produzidas e medidas
        await calcularQuantidadesServicos(obraId);
        
        return servicosObra;
        
    } catch (error) {
        console.error('Erro ao carregar serviços da obra:', error);
        showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        return [];
    }
}

async function calcularQuantidadesServicos(obraId) {
    try {
        console.log('Calculando quantidades produzidas e medidas...');

        // Para cada serviço, calcular quantidades
        for (let servico of servicosObra) {
            // 1. TOTAL PRODUZIDO - das produções diárias
            const { data: producoes, error: prodError } = await window.supabase
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
            const { data: medicoes, error: medError } = await window.supabase
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

        console.log('Cálculos concluídos para', servicosObra.length, 'serviços');
        
    } catch (error) {
        console.error('Erro ao calcular quantidades:', error);
        showNotification('Erro ao calcular quantidades: ' + error.message, 'error');
    }
}

// ========================================
// FUNÇÕES DE MODAL
// ========================================

function abrirModalNovaMedicao() {
    console.log('Abrindo modal de nova medição...');
    
    // Limpar dados anteriores
    obraSelecionada = null;
    servicosObra = [];
    valorTotalCalculado = 0;
    
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

function fecharModalMedicao() {
    document.getElementById('modal-medicao').style.display = 'none';
}

function abrirModalObras() {
    renderObrasModal();
    document.getElementById('modal-obras').style.display = 'block';
}

function fecharModalObras() {
    document.getElementById('modal-obras').style.display = 'none';
}

function abrirModalValor() {
    // Calcular valor total
    calcularValorTotal();
    
    // Preencher modal
    document.getElementById('valor-calculado').textContent = formatarMoeda(valorTotalCalculado);
    document.getElementById('valor-ajustado').value = valorTotalCalculado.toFixed(2);
    document.getElementById('motivo-ajuste').value = '';
    
    // Mostrar modal
    document.getElementById('modal-confirmar-valor').style.display = 'block';
}

function fecharModalValor() {
    document.getElementById('modal-confirmar-valor').style.display = 'none';
}

// ========================================
// SELEÇÃO DE OBRA
// ========================================

async function selecionarObra(obraId) {
    try {
        console.log('Selecionando obra:', obraId);
        
        // Encontrar a obra
        const obra = obras.find(o => o.id === obraId);
        if (!obra) {
            showNotification('Obra não encontrada', 'error');
            return;
        }
        
        obraSelecionada = obra;
        
        // Atualizar interface
        const obraContainer = document.getElementById('obra-selecionada-container');
        obraContainer.innerHTML = `
            <div class="obra-selecionada">
                <div class="obra-info">
                    <div>
                        <div class="obra-nome">${obra.nome}</div>
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
        showLoading();
        await loadServicosObra(obraId);
        hideLoading();
        
        // Renderizar serviços
        await renderServicos();
        
        // Mostrar container de serviços
        document.getElementById('servicos-container').style.display = 'block';
        
        // Fechar modal de obras
        fecharModalObras();
        
        showNotification('Obra selecionada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao selecionar obra:', error);
        showNotification('Erro ao selecionar obra: ' + error.message, 'error');
        hideLoading();
    }
}

// ========================================
// RENDERIZAÇÃO
// ========================================

function renderMedicoes() {
    const tbody = document.getElementById('medicoes-list');
    if (!tbody) return;

    if (medicoes.length === 0) {
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

    tbody.innerHTML = medicoes.map(medicao => `
        <tr>
            <td><strong>${medicao.numero}</strong></td>
            <td>
                <div>${medicao.obras_hvc.nome}</div>
                <small style="color: #b0c4de;">${medicao.obras_hvc.clientes_hvc.nome}</small>
            </td>
            <td>${formatarData(medicao.data_medicao)}</td>
            <td><strong>${formatarMoeda(medicao.valor_ajustado || medicao.valor_total)}</strong></td>
            <td>
                <span class="badge badge-${getStatusColor(medicao.status)}">
                    ${getStatusText(medicao.status)}
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

function renderObrasModal() {
    const container = document.getElementById('obras-list');
    if (!container) return;

    if (obras.length === 0) {
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
                ${obras.map(obra => `
                    <tr>
                        <td><strong>${obra.nome}</strong></td>
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

async function renderServicos() {
    const container = document.getElementById('servicos-list');
    if (!container) return;

    if (servicosObra.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #b0c4de;">
                <i class="fas fa-tools" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                Nenhum serviço disponível para medição
            </div>
        `;
        return;
    }

    container.innerHTML = servicosObra.map(servico => `
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
                        <small>${formatarMoeda(servico.valor_total_contratado)}</small>
                    </div>
                </div>
                
                <div class="valor-item valor-produzido">
                    <div class="valor-label">Total Produzido</div>
                    <div class="valor-numero">
                        ${servico.quantidade_produzida.toFixed(2)} ${servico.unidade}<br>
                        <small>${formatarMoeda(servico.valor_produzido)}</small>
                    </div>
                </div>
                
                <div class="valor-item valor-medido">
                    <div class="valor-label">Total Medido</div>
                    <div class="valor-numero">
                        ${servico.quantidade_medida.toFixed(2)} ${servico.unidade}<br>
                        <small>${formatarMoeda(servico.valor_medido)}</small>
                    </div>
                </div>
                
                <div class="valor-item valor-disponivel">
                    <div class="valor-label">Disponível para Medição</div>
                    <div class="valor-numero">
                        ${servico.quantidade_disponivel.toFixed(2)} ${servico.unidade}<br>
                        <small>${formatarMoeda(servico.valor_disponivel)}</small>
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

function calcularValorTotal() {
    valorTotalCalculado = 0;
    
    servicosObra.forEach(servico => {
        const input = document.getElementById(`medicao-${servico.servico_id}`);
        if (input && input.value) {
            const quantidade = parseFloat(input.value);
            if (quantidade > 0) {
                valorTotalCalculado += quantidade * servico.valor_unitario_contratado;
            }
        }
    });
    
    return valorTotalCalculado;
}

function atualizarCalculos() {
    calcularValorTotal();
    console.log('Valor total calculado:', valorTotalCalculado);
}

// ========================================
// SALVAMENTO
// ========================================

async function salvarMedicao(event) {
    event.preventDefault();
    
    try {
        console.log('Salvando medição...');
        
        // Validações
        if (!obraSelecionada) {
            showNotification('Selecione uma obra', 'error');
            return;
        }
        
        const dataMedicao = document.getElementById('data-medicao').value;
        if (!dataMedicao) {
            showNotification('Informe a data da medição', 'error');
            return;
        }
        
        // Verificar se há pelo menos um serviço com quantidade
        const servicosComQuantidade = [];
        servicosObra.forEach(servico => {
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
            showNotification('Informe pelo menos uma quantidade para medir', 'error');
            return;
        }
        
        // Calcular valor total
        calcularValorTotal();
        
        // Abrir modal de confirmação de valor
        abrirModalValor();
        
    } catch (error) {
        console.error('Erro ao validar medição:', error);
        showNotification('Erro: ' + error.message, 'error');
    }
}

async function confirmarESalvarMedicao() {
    try {
        console.log('Confirmando e salvando medição...');
        showLoading();
        
        // Obter dados do formulário
        const dataMedicao = document.getElementById('data-medicao').value;
        const observacoes = document.getElementById('observacoes-medicao').value;
        const valorAjustado = parseFloat(document.getElementById('valor-ajustado').value);
        const motivoAjuste = document.getElementById('motivo-ajuste').value;
        
        // Gerar número da medição
        const numeroMedicao = await gerarNumeroMedicao();
        
        // Preparar serviços para salvamento
        const servicosParaSalvar = [];
        servicosObra.forEach(servico => {
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
        const { data: medicao, error: medicaoError } = await window.supabase
            .from('medicoes_hvc')
            .insert({
                numero: numeroMedicao,
                obra_id: obraSelecionada.id,
                data_medicao: dataMedicao,
                valor_total: valorTotalCalculado,
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
        
        const { error: servicosError } = await window.supabase
            .from('medicoes_servicos')
            .insert(servicosComMedicaoId);
            
        if (servicosError) throw servicosError;
        
        hideLoading();
        showNotification('Medição salva com sucesso!', 'success');
        
        // Fechar modais
        fecharModalValor();
        fecharModalMedicao();
        
        // Recarregar lista de medições
        await loadMedicoes();
        
    } catch (error) {
        console.error('Erro ao salvar medição:', error);
        hideLoading();
        showNotification('Erro ao salvar medição: ' + error.message, 'error');
    }
}

async function gerarNumeroMedicao() {
    try {
        // Buscar último número
        const { data, error } = await window.supabase
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

function populateObrasFilter() {
    const select = document.getElementById('filtro-obra');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todas as obras</option>';
    obras.forEach(obra => {
        select.innerHTML += `<option value="${obra.id}">${obra.nome}</option>`;
    });
}

function aplicarFiltros() {
    // Implementar filtros se necessário
    console.log('Aplicando filtros...');
}

function limparFiltros() {
    document.getElementById('filtro-obra').value = '';
    document.getElementById('filtro-status').value = '';
    document.getElementById('filtro-data').value = '';
    aplicarFiltros();
}

function filtrarObras(termo) {
    // Implementar busca de obras se necessário
    console.log('Filtrando obras por:', termo);
}

// ========================================
// AÇÕES DE MEDIÇÃO
// ========================================

function editarMedicao(medicaoId) {
    console.log('Editando medição:', medicaoId);
    showNotification('Funcionalidade em desenvolvimento', 'warning');
}

function excluirMedicao(medicaoId) {
    if (confirm('Tem certeza que deseja excluir esta medição?')) {
        console.log('Excluindo medição:', medicaoId);
        showNotification('Funcionalidade em desenvolvimento', 'warning');
    }
}

// ========================================
// UTILITÁRIOS
// ========================================

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarData(data) {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function getStatusColor(status) {
    switch (status) {
        case 'rascunho': return 'secondary';
        case 'aprovada': return 'primary';
        case 'paga': return 'success';
        default: return 'secondary';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'rascunho': return 'Rascunho';
        case 'aprovada': return 'Aprovada';
        case 'paga': return 'Paga';
        default: return 'Desconhecido';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'block';
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

