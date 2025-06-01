import { supabase } from './supabase.js';

// Variáveis globais
let obraAtual = null;
let medicaoAtual = null;
let modoEdicao = false;
let medicaoEdicaoId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarObras();
    carregarPropostasAprovadas();
    
    // Event listeners
    document.getElementById('propostas-filter').addEventListener('input', filtrarPropostas);
    document.getElementById('numero-obra').addEventListener('input', formatarNumeroObra);
    document.getElementById('valor-medicao').addEventListener('input', formatarValor);
    document.getElementById('retencao-adicao').addEventListener('input', formatarValor);
});

// Formatação de número da obra
function formatarNumeroObra() {
    const input = document.getElementById('numero-obra');
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length > 0) {
        const ano = new Date().getFullYear();
        const numero = valor.padStart(4, '0');
        input.value = `${numero}/${ano}`;
    }
}

// Formatação de valores monetários
function formatarValor(event) {
    const input = event.target;
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length > 0) {
        valor = (parseInt(valor) / 100).toFixed(2);
        valor = valor.replace('.', ',');
        valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        input.value = 'R$ ' + valor;
    } else {
        input.value = '';
    }
}

// Carregar propostas aprovadas
async function carregarPropostasAprovadas() {
    try {
        const { data: propostas, error } = await supabase
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc (nome)
            `)
            .eq('status', 'Aprovada');

        if (error) throw error;

        const container = document.getElementById('propostas-list');
        container.innerHTML = '';

        propostas.forEach(proposta => {
            const div = document.createElement('div');
            div.className = 'proposta-item';
            div.innerHTML = `
                <input type="checkbox" value="${proposta.id}" onchange="selecionarProposta(this)">
                <div class="proposta-info">
                    <strong>${proposta.numero}</strong> - ${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}
                </div>
                <div class="proposta-valor">R$ ${formatarMoeda(proposta.valor)}</div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar propostas:', error);
        alert('Erro ao carregar propostas aprovadas');
    }
}

// Filtrar propostas
function filtrarPropostas() {
    const filtro = document.getElementById('propostas-filter').value.toLowerCase();
    const propostas = document.querySelectorAll('.proposta-item');
    
    propostas.forEach(proposta => {
        const texto = proposta.textContent.toLowerCase();
        proposta.style.display = texto.includes(filtro) ? 'flex' : 'none';
    });
}

// Selecionar proposta
function selecionarProposta(checkbox) {
    const item = checkbox.closest('.proposta-item');
    
    if (checkbox.checked) {
        item.classList.add('selected');
    } else {
        item.classList.remove('selected');
    }
    
    atualizarClienteEValor();
}

// Atualizar cliente e valor total baseado nas propostas selecionadas
async function atualizarClienteEValor() {
    const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
    const propostasIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (propostasIds.length === 0) {
        document.getElementById('cliente-obra').value = '';
        document.getElementById('valor-total-obra').value = '';
        return;
    }
    
    try {
        const { data: propostas, error } = await supabase
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc (nome)
            `)
            .in('id', propostasIds);

        if (error) throw error;

        // Verificar se todas as propostas são do mesmo cliente
        const clientes = [...new Set(propostas.map(p => p.clientes_hvc?.nome))];
        
        if (clientes.length > 1) {
            alert('Todas as propostas devem ser do mesmo cliente!');
            // Desmarcar a última selecionada
            checkboxes[checkboxes.length - 1].checked = false;
            checkboxes[checkboxes.length - 1].closest('.proposta-item').classList.remove('selected');
            return;
        }
        
        // Atualizar campos
        document.getElementById('cliente-obra').value = clientes[0] || '';
        
        const valorTotal = propostas.reduce((total, proposta) => total + (proposta.valor || 0), 0);
        document.getElementById('valor-total-obra').value = `R$ ${formatarMoeda(valorTotal)}`;
        
    } catch (error) {
        console.error('Erro ao atualizar cliente e valor:', error);
    }
}

// Adicionar nova obra
async function adicionarObra() {
    const numero = document.getElementById('numero-obra').value;
    const nome = document.getElementById('nome-obra').value;
    const observacoes = document.getElementById('observacoes-obra').value;
    const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
    const propostasIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (!numero || !nome || propostasIds.length === 0) {
        alert('Preencha todos os campos obrigatórios e selecione pelo menos uma proposta!');
        return;
    }
    
    try {
        // Verificar se o número já existe
        const { data: obraExistente } = await supabase
            .from('obras_hvc')
            .select('id')
            .eq('numero', numero)
            .single();
            
        if (obraExistente) {
            alert('Já existe uma obra com este número!');
            return;
        }
        
        // Inserir obra
        const { data: obra, error: obraError } = await supabase
            .from('obras_hvc')
            .insert({
                numero,
                nome,
                observacoes,
                status: 'A iniciar'
            })
            .select()
            .single();
            
        if (obraError) throw obraError;
        
        // Associar propostas à obra
        const associacoes = propostasIds.map(propostaId => ({
            obra_id: obra.id,
            proposta_id: propostaId
        }));
        
        const { error: associacaoError } = await supabase
            .from('obras_propostas')
            .insert(associacoes);
            
        if (associacaoError) throw associacaoError;
        
        alert('Obra adicionada com sucesso!');
        limparFormulario();
        carregarObras();
        
    } catch (error) {
        console.error('Erro ao adicionar obra:', error);
        alert('Erro ao adicionar obra: ' + error.message);
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('numero-obra').value = '';
    document.getElementById('nome-obra').value = '';
    document.getElementById('cliente-obra').value = '';
    document.getElementById('valor-total-obra').value = '';
    document.getElementById('observacoes-obra').value = '';
    
    // Desmarcar todas as propostas
    const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.proposta-item').classList.remove('selected');
    });
}

// Carregar obras
async function carregarObras() {
    try {
        const { data: obras, error } = await supabase
            .from('obras_hvc')
            .select(`
                *,
                obras_propostas (
                    propostas_hvc (
                        valor,
                        clientes_hvc (nome)
                    )
                )
            `)
            .order('numero');

        if (error) throw error;

        const tbody = document.getElementById('obras-list');
        tbody.innerHTML = '';

        for (const obra of obras) {
            // Calcular valores
            const valorTotal = obra.obras_propostas?.reduce((total, op) => 
                total + (op.propostas_hvc?.valor || 0), 0) || 0;
            
            const cliente = obra.obras_propostas?.[0]?.propostas_hvc?.clientes_hvc?.nome || 'N/A';
            
            // Buscar medições para cálculos
            const { data: medicoes } = await supabase
                .from('medicoes_obra_hvc')
                .select('valor, pago')
                .eq('obra_id', obra.id);
            
            const vtm = medicoes?.reduce((total, m) => total + (m.valor || 0), 0) || 0;
            const vtr = medicoes?.filter(m => m.pago).reduce((total, m) => total + (m.valor || 0), 0) || 0;
            const vmnr = vtm - vtr;
            const var_valor = valorTotal - vtr;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${obra.numero}</td>
                <td>${obra.nome}</td>
                <td>${cliente}</td>
                <td>R$ ${formatarMoeda(valorTotal)}</td>
                <td class="tooltip valor-${vtm > 0 ? 'positivo' : 'neutro'}" data-tooltip="Valor Total Medido">
                    R$ ${formatarMoeda(vtm)}
                </td>
                <td class="tooltip valor-${vtr > 0 ? 'positivo' : 'neutro'}" data-tooltip="Valor Total Recebido">
                    R$ ${formatarMoeda(vtr)}
                </td>
                <td class="tooltip valor-${vmnr > 0 ? 'negativo' : vmnr < 0 ? 'positivo' : 'neutro'}" data-tooltip="Valor Medido Não Recebido">
                    R$ ${formatarMoeda(vmnr)}
                </td>
                <td class="tooltip valor-${var_valor > 0 ? 'negativo' : var_valor < 0 ? 'positivo' : 'neutro'}" data-tooltip="Valor em Aberto a Receber">
                    R$ ${formatarMoeda(var_valor)}
                </td>
                <td><span class="status-badge status-${obra.status.toLowerCase().replace(' ', '-')}">${obra.status}</span></td>
                <td>
                    <button class="btn btn-primary btn-small" onclick="abrirModalServicos(${obra.id}, '${obra.numero}')">
                        <i class="fas fa-cogs"></i> Gerenciar
                    </button>
                </td>
                <td>
                    <button class="btn btn-warning btn-small" onclick="abrirModalMedicoes(${obra.id}, '${obra.numero}')">
                        <i class="fas fa-ruler"></i> Gerenciar
                    </button>
                </td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="excluirObra(${obra.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        alert('Erro ao carregar obras');
    }
}

// Abrir modal de serviços
async function abrirModalServicos(obraId, numeroObra) {
    obraAtual = obraId;
    document.getElementById('modal-servicos-obra').textContent = numeroObra;
    document.getElementById('modal-servicos').style.display = 'block';
    await carregarServicos();
}

// Carregar serviços
async function carregarServicos() {
    try {
        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('nome');

        if (error) throw error;

        const container = document.getElementById('servicos-list');
        container.innerHTML = '';

        servicos.forEach(servico => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <strong>${servico.nome}</strong>
                    <br>
                    <span class="status-badge status-${servico.status.toLowerCase().replace(' ', '-')}">${servico.status}</span>
                    ${servico.data_inicio ? `<br><small>Iniciado: ${formatarData(servico.data_inicio)}</small>` : ''}
                    ${servico.data_conclusao ? `<br><small>Concluído: ${formatarData(servico.data_conclusao)}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn btn-small ${servico.iniciado ? 'btn-warning' : 'btn-success'}" 
                            onclick="toggleIniciado(${servico.id}, ${servico.iniciado})">
                        <i class="fas fa-play"></i> ${servico.iniciado ? 'Desmarcar' : 'Iniciar'}
                    </button>
                    <button class="btn btn-small ${servico.concluido ? 'btn-warning' : 'btn-success'}" 
                            onclick="toggleConcluido(${servico.id}, ${servico.concluido})">
                        <i class="fas fa-check"></i> ${servico.concluido ? 'Desmarcar' : 'Concluir'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="excluirServico(${servico.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

// Adicionar serviço
async function adicionarServico() {
    const nome = document.getElementById('nome-servico').value;
    
    if (!nome) {
        alert('Digite o nome do serviço!');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .insert({
                obra_id: obraAtual,
                nome,
                status: 'À iniciar',
                iniciado: false,
                concluido: false
            });
            
        if (error) throw error;
        
        document.getElementById('nome-servico').value = '';
        await carregarServicos();
        await atualizarStatusObra();
        
    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        alert('Erro ao adicionar serviço');
    }
}

// Toggle iniciado
async function toggleIniciado(servicoId, iniciado) {
    if (iniciado && !confirm('Tem certeza que deseja desmarcar como iniciado?')) {
        return;
    }
    
    try {
        const novoStatus = !iniciado;
        const dataInicio = novoStatus ? new Date().toISOString() : null;
        
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .update({
                iniciado: novoStatus,
                data_inicio: dataInicio,
                status: novoStatus ? 'Iniciado' : 'À iniciar'
            })
            .eq('id', servicoId);
            
        if (error) throw error;
        
        await carregarServicos();
        await atualizarStatusObra();
        
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        alert('Erro ao atualizar serviço');
    }
}

// Toggle concluído
async function toggleConcluido(servicoId, concluido) {
    if (concluido && !confirm('Tem certeza que deseja desmarcar como concluído?')) {
        return;
    }
    
    try {
        const novoStatus = !concluido;
        const dataConclusao = novoStatus ? new Date().toISOString() : null;
        
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .update({
                concluido: novoStatus,
                data_conclusao: dataConclusao,
                status: novoStatus ? 'Concluído' : 'Iniciado'
            })
            .eq('id', servicoId);
            
        if (error) throw error;
        
        await carregarServicos();
        await atualizarStatusObra();
        
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        alert('Erro ao atualizar serviço');
    }
}

// Atualizar status da obra
async function atualizarStatusObra() {
    try {
        const { data: servicos } = await supabase
            .from('servicos_obra_hvc')
            .select('iniciado, concluido')
            .eq('obra_id', obraAtual);
            
        let status = 'À iniciar';
        
        if (servicos && servicos.length > 0) {
            const todosIniciados = servicos.every(s => s.iniciado);
            const todosConcluidos = servicos.every(s => s.concluido);
            
            if (todosConcluidos) {
                // Verificar valor em aberto
                const { data: obra } = await supabase
                    .from('obras_hvc')
                    .select(`
                        obras_propostas (
                            propostas_hvc (valor)
                        )
                    `)
                    .eq('id', obraAtual)
                    .single();
                    
                const valorTotal = obra?.obras_propostas?.reduce((total, op) => 
                    total + (op.propostas_hvc?.valor || 0), 0) || 0;
                
                const { data: medicoes } = await supabase
                    .from('medicoes_obra_hvc')
                    .select('valor, pago')
                    .eq('obra_id', obraAtual);
                
                const vtr = medicoes?.filter(m => m.pago).reduce((total, m) => total + (m.valor || 0), 0) || 0;
                const valorEmAberto = valorTotal - vtr;
                
                status = valorEmAberto <= 0 ? 'Concluída' : 'Pagamento Pendente';
            } else if (servicos.some(s => s.iniciado)) {
                status = 'Em andamento';
            }
        }
        
        await supabase
            .from('obras_hvc')
            .update({ status })
            .eq('id', obraAtual);
            
        await carregarObras();
        
    } catch (error) {
        console.error('Erro ao atualizar status da obra:', error);
    }
}

// Abrir modal de medições
async function abrirModalMedicoes(obraId, numeroObra) {
    obraAtual = obraId;
    medicaoAtual = null;
    modoEdicao = false;
    medicaoEdicaoId = null;
    
    document.getElementById('modal-medicoes-obra').textContent = numeroObra;
    document.getElementById('modal-medicoes').style.display = 'block';
    
    // Limpar formulário
    document.getElementById('numero-medicao').value = '';
    document.getElementById('data-medicao').value = '';
    document.getElementById('valor-medicao').value = '';
    document.getElementById('status-medicao').value = 'vai_ser_enviada';
    document.getElementById('retencao-adicao').value = '';
    
    // Atualizar botão
    const botao = document.querySelector('#modal-medicoes .btn-success');
    botao.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
    botao.onclick = adicionarMedicao;
    
    await carregarMedicoes();
    await gerarProximoNumeroMedicao();
}

// Gerar próximo número de medição
async function gerarProximoNumeroMedicao() {
    try {
        const { data: obra } = await supabase
            .from('obras_hvc')
            .select('numero')
            .eq('id', obraAtual)
            .single();
            
        const { data: medicoes } = await supabase
            .from('medicoes_obra_hvc')
            .select('numero')
            .eq('obra_id', obraAtual)
            .order('numero', { ascending: false })
            .limit(1);
            
        let proximoNumero = 1;
        if (medicoes && medicoes.length > 0) {
            const ultimoNumero = parseInt(medicoes[0].numero.split('/')[0]);
            proximoNumero = ultimoNumero + 1;
        }
        
        const numeroFormatado = proximoNumero.toString().padStart(3, '0');
        document.getElementById('numero-medicao').value = `${numeroFormatado}/${obra.numero}`;
        
    } catch (error) {
        console.error('Erro ao gerar número da medição:', error);
    }
}

// Carregar medições
async function carregarMedicoes() {
    try {
        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('numero');

        if (error) throw error;

        const container = document.getElementById('medicoes-list');
        container.innerHTML = '';

        medicoes.forEach(medicao => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <strong>Medição ${medicao.numero}</strong>
                    <br>
                    Data: ${formatarData(medicao.data_medicao)}
                    <br>
                    Valor: R$ ${formatarMoeda(medicao.valor || 0)}
                    <br>
                    Status: <span class="status-badge status-${medicao.status.replace('_', '-')}">${formatarStatusMedicao(medicao.status)}</span>
                    ${medicao.retencao_adicao ? `<br>Retenção/Adição: R$ ${formatarMoeda(medicao.retencao_adicao)}` : ''}
                    ${medicao.pago ? '<br><span class="status-badge status-concluido">PAGO</span>' : ''}
                </div>
                <div class="item-actions">
                    <button class="btn btn-warning btn-small" onclick="editarMedicao(${medicao.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-primary btn-small" onclick="abrirModalServicosMedicao('${medicao.numero}', ${medicao.id})">
                        <i class="fas fa-cogs"></i> Serviços
                    </button>
                    <button class="btn btn-danger btn-small" onclick="excluirMedicao(${medicao.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar medições:', error);
    }
}

// Editar medição
async function editarMedicao(medicaoId) {
    try {
        const { data: medicao, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('id', medicaoId)
            .single();
            
        if (error) throw error;
        
        // Preencher formulário
        document.getElementById('numero-medicao').value = medicao.numero;
        document.getElementById('data-medicao').value = medicao.data_medicao;
        document.getElementById('valor-medicao').value = medicao.valor ? `R$ ${formatarMoeda(medicao.valor)}` : '';
        document.getElementById('status-medicao').value = medicao.status;
        document.getElementById('retencao-adicao').value = medicao.retencao_adicao ? `R$ ${formatarMoeda(medicao.retencao_adicao)}` : '';
        
        // Configurar modo edição
        modoEdicao = true;
        medicaoEdicaoId = medicaoId;
        
        // Atualizar botão
        const botao = document.querySelector('#modal-medicoes .btn-success');
        botao.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
        botao.onclick = salvarEdicaoMedicao;
        
    } catch (error) {
        console.error('Erro ao carregar medição para edição:', error);
        alert('Erro ao carregar medição');
    }
}

// Salvar edição da medição
async function salvarEdicaoMedicao() {
    const data = document.getElementById('data-medicao').value;
    const valorTexto = document.getElementById('valor-medicao').value;
    const status = document.getElementById('status-medicao').value;
    const retencaoTexto = document.getElementById('retencao-adicao').value;
    
    if (!data) {
        alert('Preencha a data da medição!');
        return;
    }
    
    try {
        const valor = valorTexto ? parseFloat(valorTexto.replace(/[^\d,]/g, '').replace(',', '.')) : 0;
        const retencao = retencaoTexto ? parseFloat(retencaoTexto.replace(/[^\d,-]/g, '').replace(',', '.')) : 0;
        
        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .update({
                data_medicao: data,
                valor,
                status,
                retencao_adicao: retencao
            })
            .eq('id', medicaoEdicaoId);
            
        if (error) throw error;
        
        alert('Medição atualizada com sucesso!');
        
        // Resetar modo edição
        modoEdicao = false;
        medicaoEdicaoId = null;
        
        // Resetar botão
        const botao = document.querySelector('#modal-medicoes .btn-success');
        botao.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
        botao.onclick = adicionarMedicao;
        
        // Limpar formulário
        document.getElementById('data-medicao').value = '';
        document.getElementById('valor-medicao').value = '';
        document.getElementById('status-medicao').value = 'vai_ser_enviada';
        document.getElementById('retencao-adicao').value = '';
        
        await carregarMedicoes();
        await gerarProximoNumeroMedicao();
        await carregarObras();
        
    } catch (error) {
        console.error('Erro ao salvar medição:', error);
        alert('Erro ao salvar medição');
    }
}

// Adicionar medição
async function adicionarMedicao() {
    if (modoEdicao) {
        await salvarEdicaoMedicao();
        return;
    }
    
    const numero = document.getElementById('numero-medicao').value;
    const data = document.getElementById('data-medicao').value;
    const valorTexto = document.getElementById('valor-medicao').value;
    const status = document.getElementById('status-medicao').value;
    const retencaoTexto = document.getElementById('retencao-adicao').value;
    
    if (!data) {
        alert('Preencha a data da medição!');
        return;
    }
    
    try {
        const valor = valorTexto ? parseFloat(valorTexto.replace(/[^\d,]/g, '').replace(',', '.')) : 0;
        const retencao = retencaoTexto ? parseFloat(retencaoTexto.replace(/[^\d,-]/g, '').replace(',', '.')) : 0;
        
        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .insert({
                obra_id: obraAtual,
                numero,
                data_medicao: data,
                valor,
                status,
                retencao_adicao: retencao,
                pago: false
            });
            
        if (error) throw error;
        
        // Limpar formulário
        document.getElementById('data-medicao').value = '';
        document.getElementById('valor-medicao').value = '';
        document.getElementById('status-medicao').value = 'vai_ser_enviada';
        document.getElementById('retencao-adicao').value = '';
        
        await carregarMedicoes();
        await gerarProximoNumeroMedicao();
        await carregarObras();
        
    } catch (error) {
        console.error('Erro ao adicionar medição:', error);
        alert('Erro ao adicionar medição');
    }
}

// Funções auxiliares
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor || 0);
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR');
}

function formatarStatusMedicao(status) {
    const statusMap = {
        'vai_ser_enviada': 'Vai ser enviada',
        'ja_foi_enviada': 'Já foi enviada',
        'ja_foi_recebida': 'Já foi recebida'
    };
    return statusMap[status] || status;
}

// Fechar modal
function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Excluir obra
async function excluirObra(obraId) {
    if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('obras_hvc')
            .delete()
            .eq('id', obraId);
            
        if (error) throw error;
        
        alert('Obra excluída com sucesso!');
        await carregarObras();
        
    } catch (error) {
        console.error('Erro ao excluir obra:', error);
        alert('Erro ao excluir obra');
    }
}

// Excluir serviço
async function excluirServico(servicoId) {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .delete()
            .eq('id', servicoId);
            
        if (error) throw error;
        
        await carregarServicos();
        await atualizarStatusObra();
        
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        alert('Erro ao excluir serviço');
    }
}

// Excluir medição
async function excluirMedicao(medicaoId) {
    if (!confirm('Tem certeza que deseja excluir esta medição?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .delete()
            .eq('id', medicaoId);
            
        if (error) throw error;
        
        await carregarMedicoes();
        await carregarObras();
        
    } catch (error) {
        console.error('Erro ao excluir medição:', error);
        alert('Erro ao excluir medição');
    }
}

// Abrir modal de serviços da medição (funcionalidade básica)
function abrirModalServicosMedicao(numeroMedicao, medicaoId) {
    alert(`Funcionalidade de gerenciar serviços da medição ${numeroMedicao} será implementada em breve.`);
}

// Tornar funções globais
window.adicionarObra = adicionarObra;
window.abrirModalServicos = abrirModalServicos;
window.abrirModalMedicoes = abrirModalMedicoes;
window.adicionarServico = adicionarServico;
window.adicionarMedicao = adicionarMedicao;
window.toggleIniciado = toggleIniciado;
window.toggleConcluido = toggleConcluido;
window.editarMedicao = editarMedicao;
window.salvarEdicaoMedicao = salvarEdicaoMedicao;
window.abrirModalServicosMedicao = abrirModalServicosMedicao;
window.excluirObra = excluirObra;
window.excluirServico = excluirServico;
window.excluirMedicao = excluirMedicao;
window.fecharModal = fecharModal;
window.selecionarProposta = selecionarProposta;

