// obras-hvc.js - Gerenciamento de Obras HVC (ATUALIZADO com valor de medição e cálculos)

import { injectSidebar } from './sidebar.js';

// Variáveis globais
let supabase;
let obraAtual = null;
let medicaoAtual = null;
let proximoNumeroObra = 1;

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    // Verifica autenticação
    const nivel = sessionStorage.getItem('nivel');
    const projeto = sessionStorage.getItem('projeto');
    
    if (!nivel || (nivel !== 'admin' && projeto !== 'Hvc')) {
        alert('Acesso negado. Esta página é restrita ao projeto HVC.');
        window.location.href = 'index.html';
        return;
    }

    // Injeta sidebar
    await injectSidebar('main-content');

    // Importa Supabase
    const supabaseModule = await import('./supabase.js');
    supabase = supabaseModule.default;

    // Inicializa a página
    await inicializarPagina();
    
    // Event listeners
    document.getElementById('obra-form').addEventListener('submit', salvarObra);
    document.getElementById('propostas-obra').addEventListener('change', atualizarClienteValor);
    document.getElementById('numero-obra').addEventListener('input', formatarNumeroObra);
    document.getElementById('valor-medicao').addEventListener('input', formatarValorMonetario);
    document.getElementById('retencao-adicao').addEventListener('input', formatarValorMonetario);
});

// Inicializar página
async function inicializarPagina() {
    try {
        await carregarPropostasAprovadas();
        await carregarObras();
        await definirProximoNumero();
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
        alert('Erro ao carregar dados da página.');
    }
}

// Carregar propostas aprovadas
async function carregarPropostasAprovadas() {
    try {
        const { data: propostas, error } = await supabase
            .from('propostas_hvc')
            .select(`
                id,
                numero_proposta,
                valor,
                clientes_hvc (nome)
            `)
            .eq('status', 'aprovada');

        if (error) throw error;

        const select = document.getElementById('propostas-obra');
        select.innerHTML = '';

        propostas.forEach(proposta => {
            const option = document.createElement('option');
            option.value = proposta.id;
            option.textContent = `${proposta.numero_proposta} - ${proposta.clientes_hvc.nome} - ${formatarMoeda(proposta.valor)}`;
            option.dataset.cliente = proposta.clientes_hvc.nome;
            option.dataset.valor = proposta.valor;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Erro ao carregar propostas:', error);
        alert('Erro ao carregar propostas aprovadas.');
    }
}

// Atualizar cliente e valor total baseado nas propostas selecionadas
function atualizarClienteValor() {
    const select = document.getElementById('propostas-obra');
    const selectedOptions = Array.from(select.selectedOptions);
    
    if (selectedOptions.length === 0) {
        document.getElementById('cliente-obra').value = '';
        document.getElementById('valor-total-obra').value = '';
        return;
    }

    // Pega o cliente da primeira proposta (assumindo que todas são do mesmo cliente)
    const cliente = selectedOptions[0].dataset.cliente;
    document.getElementById('cliente-obra').value = cliente;

    // Soma os valores das propostas selecionadas
    const valorTotal = selectedOptions.reduce((total, option) => {
        return total + parseFloat(option.dataset.valor || 0);
    }, 0);

    document.getElementById('valor-total-obra').value = formatarMoeda(valorTotal);
}

// Definir próximo número de obra
async function definirProximoNumero() {
    try {
        const anoAtual = new Date().getFullYear();
        
        const { data: obras, error } = await supabase
            .from('obras_hvc')
            .select('numero_obra')
            .like('numero_obra', `%/${anoAtual}`);

        if (error) throw error;

        let maiorNumero = 0;
        obras.forEach(obra => {
            const numero = parseInt(obra.numero_obra.split('/')[0]);
            if (numero > maiorNumero) {
                maiorNumero = numero;
            }
        });

        proximoNumeroObra = maiorNumero + 1;
        const numeroFormatado = proximoNumeroObra.toString().padStart(4, '0') + '/' + anoAtual;
        document.getElementById('numero-obra').value = numeroFormatado;

    } catch (error) {
        console.error('Erro ao definir próximo número:', error);
    }
}

// Formatação de número de obra
function formatarNumeroObra(event) {
    let valor = event.target.value.replace(/\D/g, '');
    if (valor.length > 4) {
        valor = valor.substring(0, 4);
    }
    
    const anoAtual = new Date().getFullYear();
    if (valor) {
        valor = valor.padStart(4, '0') + '/' + anoAtual;
    }
    
    event.target.value = valor;
}

// Formatação de valores monetários
function formatarValorMonetario(event) {
    let valor = event.target.value.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2);
    valor = valor.replace('.', ',');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    event.target.value = 'R$ ' + valor;
}

// Salvar obra
async function salvarObra(event) {
    event.preventDefault();
    
    try {
        const numeroObra = document.getElementById('numero-obra').value;
        const propostasSelecionadas = Array.from(document.getElementById('propostas-obra').selectedOptions);
        const observacoes = document.getElementById('observacoes-obra').value;

        if (!numeroObra || propostasSelecionadas.length === 0) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        // Verifica se o número já existe
        const { data: obraExistente } = await supabase
            .from('obras_hvc')
            .select('id')
            .eq('numero_obra', numeroObra)
            .single();

        if (obraExistente) {
            alert('Número de obra já existe. Escolha outro número.');
            return;
        }

        // Salva a obra
        const { data: obra, error: obraError } = await supabase
            .from('obras_hvc')
            .insert({
                numero_obra: numeroObra,
                observacoes: observacoes || null,
                status: 'a_iniciar'
            })
            .select()
            .single();

        if (obraError) throw obraError;

        // Associa as propostas à obra
        const propostasObra = propostasSelecionadas.map(option => ({
            obra_id: obra.id,
            proposta_id: parseInt(option.value)
        }));

        const { error: propostasError } = await supabase
            .from('propostas_obra_hvc')
            .insert(propostasObra);

        if (propostasError) throw propostasError;

        alert('Obra salva com sucesso!');
        limparFormulario();
        await carregarObras();
        await definirProximoNumero();

    } catch (error) {
        console.error('Erro ao salvar obra:', error);
        alert('Erro ao salvar obra: ' + error.message);
    }
}

// Carregar obras
async function carregarObras() {
    try {
        const { data: obras, error } = await supabase
            .from('obras_hvc')
            .select(`
                *,
                propostas_obra_hvc (
                    propostas_hvc (
                        numero_proposta,
                        valor,
                        clientes_hvc (nome)
                    )
                )
            `)
            .order('numero_obra', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('obras-tbody');
        tbody.innerHTML = '';

        if (obras.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="no-items">Nenhuma obra cadastrada</td></tr>';
            return;
        }

        for (const obra of obras) {
            // Calcular valores da obra
            const valores = await calcularValoresObra(obra.id);
            
            const cliente = obra.propostas_obra_hvc[0]?.propostas_hvc?.clientes_hvc?.nome || 'N/A';
            const valorTotal = obra.propostas_obra_hvc.reduce((total, po) => 
                total + (po.propostas_hvc?.valor || 0), 0);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${obra.numero_obra}</td>
                <td>${cliente}</td>
                <td class="valor-cell">${formatarMoeda(valorTotal)}</td>
                <td class="valor-cell">${formatarMoeda(valores.valorTotalMedido)}</td>
                <td class="valor-cell">${formatarMoeda(valores.valorTotalRecebido)}</td>
                <td class="valor-cell ${valores.valorMedidoNaoRecebido > 0 ? 'valor-negativo' : ''}">${formatarMoeda(valores.valorMedidoNaoRecebido)}</td>
                <td class="valor-cell ${valores.valorEmAberto > 0 ? 'valor-negativo' : ''}">${formatarMoeda(valores.valorEmAberto)}</td>
                <td><span class="status-badge status-${obra.status.replace('_', '-')}">${formatarStatus(obra.status)}</span></td>
                <td>
                    <button class="btn btn-info btn-small" onclick="abrirModalServicos(${obra.id}, '${obra.numero_obra}')">
                        <i class="fas fa-tools"></i> Gerenciar
                    </button>
                </td>
                <td>
                    <button class="btn btn-primary btn-small" onclick="abrirModalMedicoes(${obra.id}, '${obra.numero_obra}')">
                        <i class="fas fa-ruler"></i> Gerenciar
                    </button>
                </td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="excluirObra(${obra.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        }

    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        alert('Erro ao carregar obras.');
    }
}

// Calcular valores da obra
async function calcularValoresObra(obraId) {
    try {
        // Buscar medições da obra
        const { data: medicoes, error: medicoesError } = await supabase
            .from('medicoes_obra_hvc')
            .select('valor, pago')
            .eq('obra_id', obraId);

        if (medicoesError) throw medicoesError;

        // Buscar valor total das propostas
        const { data: propostas, error: propostasError } = await supabase
            .from('propostas_obra_hvc')
            .select('propostas_hvc(valor)')
            .eq('obra_id', obraId);

        if (propostasError) throw propostasError;

        // Buscar recebimentos do fluxo de caixa relacionados à obra
        const { data: recebimentos, error: recebimentosError } = await supabase
            .from('fluxo_caixa_hvc')
            .select('valor')
            .eq('obra_id', obraId)
            .eq('tipo', 'recebimento')
            .eq('pago_sem_medicao', true);

        if (recebimentosError) throw recebimentosError;

        // Cálculos
        const valorTotalPropostas = propostas.reduce((total, p) => total + (p.propostas_hvc?.valor || 0), 0);
        const valorTotalMedido = medicoes.reduce((total, m) => total + (parseFloat(m.valor) || 0), 0);
        const valorMedicoesPagas = medicoes.filter(m => m.pago).reduce((total, m) => total + (parseFloat(m.valor) || 0), 0);
        const valorRecebimentosSemMedicao = recebimentos.reduce((total, r) => total + (parseFloat(r.valor) || 0), 0);
        
        const valorTotalRecebido = valorMedicoesPagas + valorRecebimentosSemMedicao;
        const valorMedidoNaoRecebido = valorTotalMedido - valorMedicoesPagas;
        const valorEmAberto = valorTotalPropostas - valorTotalRecebido;

        return {
            valorTotalMedido,
            valorTotalRecebido,
            valorMedidoNaoRecebido,
            valorEmAberto
        };

    } catch (error) {
        console.error('Erro ao calcular valores da obra:', error);
        return {
            valorTotalMedido: 0,
            valorTotalRecebido: 0,
            valorMedidoNaoRecebido: 0,
            valorEmAberto: 0
        };
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
            .order('id');

        if (error) throw error;

        const container = document.getElementById('servicos-list');
        container.innerHTML = '';

        if (servicos.length === 0) {
            container.innerHTML = '<div class="no-items">Nenhum serviço adicionado</div>';
            return;
        }

        servicos.forEach(servico => {
            const div = document.createElement('div');
            div.className = 'servico-item';
            div.innerHTML = `
                <div class="servico-info">
                    <strong>${servico.descricao}</strong><br>
                    <small>Status: ${formatarStatusServico(servico)}</small>
                    ${servico.data_inicio ? `<br><small>Iniciado: ${formatarData(servico.data_inicio)}</small>` : ''}
                    ${servico.data_conclusao ? `<br><small>Concluído: ${formatarData(servico.data_conclusao)}</small>` : ''}
                </div>
                <div class="servico-actions">
                    <button class="toggle-btn ${servico.data_inicio ? 'active' : 'inactive'}" 
                            onclick="toggleInicioServico(${servico.id}, ${!!servico.data_inicio})">
                        ${servico.data_inicio ? 'Iniciado' : 'Iniciar'}
                    </button>
                    <button class="toggle-btn ${servico.data_conclusao ? 'active' : 'inactive'}" 
                            onclick="toggleConclusaoServico(${servico.id}, ${!!servico.data_conclusao})">
                        ${servico.data_conclusao ? 'Concluído' : 'Concluir'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="excluirServico(${servico.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        // Atualiza status da obra
        await atualizarStatusObra();

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        alert('Erro ao carregar serviços.');
    }
}

// Adicionar serviço
async function adicionarServico() {
    const descricao = document.getElementById('novo-servico').value.trim();
    
    if (!descricao) {
        alert('Digite a descrição do serviço.');
        return;
    }

    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .insert({
                obra_id: obraAtual,
                descricao: descricao
            });

        if (error) throw error;

        document.getElementById('novo-servico').value = '';
        await carregarServicos();

    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        alert('Erro ao adicionar serviço.');
    }
}

// Toggle início do serviço
async function toggleInicioServico(servicoId, jaIniciado) {
    if (jaIniciado) {
        if (!confirm('Tem certeza que deseja desmarcar o início deste serviço?')) {
            return;
        }
    }

    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .update({
                data_inicio: jaIniciado ? null : new Date().toISOString()
            })
            .eq('id', servicoId);

        if (error) throw error;

        await carregarServicos();

    } catch (error) {
        console.error('Erro ao atualizar início do serviço:', error);
        alert('Erro ao atualizar serviço.');
    }
}

// Toggle conclusão do serviço
async function toggleConclusaoServico(servicoId, jaConcluido) {
    if (jaConcluido) {
        if (!confirm('Tem certeza que deseja desmarcar a conclusão deste serviço?')) {
            return;
        }
    }

    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .update({
                data_conclusao: jaConcluido ? null : new Date().toISOString()
            })
            .eq('id', servicoId);

        if (error) throw error;

        await carregarServicos();

    } catch (error) {
        console.error('Erro ao atualizar conclusão do serviço:', error);
        alert('Erro ao atualizar serviço.');
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

    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        alert('Erro ao excluir serviço.');
    }
}

// Abrir modal de medições
async function abrirModalMedicoes(obraId, numeroObra) {
    obraAtual = obraId;
    document.getElementById('modal-medicoes-obra').textContent = numeroObra;
    document.getElementById('modal-medicoes').style.display = 'block';
    await carregarMedicoes();
    await definirProximoNumeroMedicao(numeroObra);
}

// Definir próximo número de medição
async function definirProximoNumeroMedicao(numeroObra) {
    try {
        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('numero_medicao')
            .eq('obra_id', obraAtual);

        if (error) throw error;

        let maiorNumero = 0;
        medicoes.forEach(medicao => {
            const numero = parseInt(medicao.numero_medicao.split('/')[0]);
            if (numero > maiorNumero) {
                maiorNumero = numero;
            }
        });

        const proximoNumero = (maiorNumero + 1).toString().padStart(3, '0');
        document.getElementById('numero-medicao').value = `${proximoNumero}/${numeroObra}`;

    } catch (error) {
        console.error('Erro ao definir próximo número de medição:', error);
    }
}

// Carregar medições
async function carregarMedicoes() {
    try {
        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('numero_medicao');

        if (error) throw error;

        const container = document.getElementById('medicoes-list');
        container.innerHTML = '';

        if (medicoes.length === 0) {
            container.innerHTML = '<div class="no-items">Nenhuma medição adicionada</div>';
            return;
        }

        medicoes.forEach(medicao => {
            const div = document.createElement('div');
            div.className = 'medicao-item';
            div.innerHTML = `
                <div class="medicao-info">
                    <strong>Medição ${medicao.numero_medicao}</strong><br>
                    <small>Data: ${formatarData(medicao.data_medicao)}</small><br>
                    <small>Valor: ${formatarMoeda(medicao.valor || 0)}</small><br>
                    <small>Status: ${formatarStatusMedicao(medicao.status)}</small><br>
                    ${medicao.retencao_adicao ? `<small>Ret./Ad.: ${formatarMoeda(medicao.retencao_adicao)}</small><br>` : ''}
                    <small>Pago: ${medicao.pago ? 'Sim' : 'Não'}</small>
                </div>
                <div class="medicao-actions">
                    <button class="btn btn-info btn-small" onclick="editarMedicao(${medicao.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-primary btn-small" onclick="abrirModalServicosMedicao(${medicao.id}, '${medicao.numero_medicao}')">
                        <i class="fas fa-list"></i> Serviços
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
        alert('Erro ao carregar medições.');
    }
}

// Adicionar medição
async function adicionarMedicao() {
    const numeroMedicao = document.getElementById('numero-medicao').value;
    const dataMedicao = document.getElementById('data-medicao').value;
    const valorMedicao = document.getElementById('valor-medicao').value;
    const statusMedicao = document.getElementById('status-medicao').value;
    const retencaoAdicao = document.getElementById('retencao-adicao').value;

    if (!numeroMedicao || !dataMedicao) {
        alert('Preencha o número e a data da medição.');
        return;
    }

    try {
        // Converte valores monetários
        const valorNumerico = valorMedicao ? parseFloat(valorMedicao.replace(/[R$\s.]/g, '').replace(',', '.')) : 0;
        const retencaoNumerico = retencaoAdicao ? parseFloat(retencaoAdicao.replace(/[R$\s.]/g, '').replace(',', '.')) : 0;

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .insert({
                obra_id: obraAtual,
                numero_medicao: numeroMedicao,
                data_medicao: dataMedicao,
                valor: valorNumerico,
                status: statusMedicao,
                retencao_adicao: retencaoNumerico || null,
                pago: false
            });

        if (error) throw error;

        // Limpa formulário
        document.getElementById('data-medicao').value = '';
        document.getElementById('valor-medicao').value = '';
        document.getElementById('status-medicao').value = 'vai_ser_enviada';
        document.getElementById('retencao-adicao').value = '';

        await carregarMedicoes();
        await definirProximoNumeroMedicao(document.getElementById('modal-medicoes-obra').textContent);

    } catch (error) {
        console.error('Erro ao adicionar medição:', error);
        alert('Erro ao adicionar medição.');
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

        // Preenche o formulário com os dados da medição
        document.getElementById('numero-medicao').value = medicao.numero_medicao;
        document.getElementById('data-medicao').value = medicao.data_medicao;
        document.getElementById('valor-medicao').value = formatarMoeda(medicao.valor || 0);
        document.getElementById('status-medicao').value = medicao.status;
        document.getElementById('retencao-adicao').value = medicao.retencao_adicao ? formatarMoeda(medicao.retencao_adicao) : '';

        // Muda o botão para modo edição
        const btnAdicionar = document.querySelector('#modal-medicoes .btn-success');
        btnAdicionar.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
        btnAdicionar.onclick = () => salvarEdicaoMedicao(medicaoId);

    } catch (error) {
        console.error('Erro ao carregar medição para edição:', error);
        alert('Erro ao carregar medição.');
    }
}

// Salvar edição da medição
async function salvarEdicaoMedicao(medicaoId) {
    const dataMedicao = document.getElementById('data-medicao').value;
    const valorMedicao = document.getElementById('valor-medicao').value;
    const statusMedicao = document.getElementById('status-medicao').value;
    const retencaoAdicao = document.getElementById('retencao-adicao').value;

    if (!dataMedicao) {
        alert('Preencha a data da medição.');
        return;
    }

    try {
        // Converte valores monetários
        const valorNumerico = valorMedicao ? parseFloat(valorMedicao.replace(/[R$\s.]/g, '').replace(',', '.')) : 0;
        const retencaoNumerico = retencaoAdicao ? parseFloat(retencaoAdicao.replace(/[R$\s.]/g, '').replace(',', '.')) : 0;

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .update({
                data_medicao: dataMedicao,
                valor: valorNumerico,
                status: statusMedicao,
                retencao_adicao: retencaoNumerico || null
            })
            .eq('id', medicaoId);

        if (error) throw error;

        // Restaura o botão para modo adicionar
        const btnSalvar = document.querySelector('#modal-medicoes .btn-success');
        btnSalvar.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
        btnSalvar.onclick = adicionarMedicao;

        // Limpa formulário
        document.getElementById('data-medicao').value = '';
        document.getElementById('valor-medicao').value = '';
        document.getElementById('status-medicao').value = 'vai_ser_enviada';
        document.getElementById('retencao-adicao').value = '';

        await carregarMedicoes();
        await definirProximoNumeroMedicao(document.getElementById('modal-medicoes-obra').textContent);

        alert('Medição atualizada com sucesso!');

    } catch (error) {
        console.error('Erro ao salvar edição da medição:', error);
        alert('Erro ao salvar alterações.');
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

    } catch (error) {
        console.error('Erro ao excluir medição:', error);
        alert('Erro ao excluir medição.');
    }
}

// Abrir modal de serviços da medição
async function abrirModalServicosMedicao(medicaoId, numeroMedicao) {
    medicaoAtual = medicaoId;
    document.getElementById('modal-servicos-medicao-numero').textContent = numeroMedicao;
    document.getElementById('modal-servicos-medicao').style.display = 'block';
    await carregarServicosParaMedicao();
    await carregarServicosMedicao();
}

// Carregar serviços disponíveis para a medição
async function carregarServicosParaMedicao() {
    try {
        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual);

        if (error) throw error;

        const select = document.getElementById('servico-medicao');
        select.innerHTML = '<option value="">Selecione um serviço</option>';

        servicos.forEach(servico => {
            const option = document.createElement('option');
            option.value = servico.id;
            option.textContent = servico.descricao;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

// Carregar serviços da medição
async function carregarServicosMedicao() {
    try {
        const { data: servicosMedicao, error } = await supabase
            .from('servicos_medicao_hvc')
            .select(`
                *,
                servicos_obra_hvc (descricao)
            `)
            .eq('medicao_id', medicaoAtual);

        if (error) throw error;

        const container = document.getElementById('servicos-medicao-list');
        container.innerHTML = '';

        if (servicosMedicao.length === 0) {
            container.innerHTML = '<div class="no-items">Nenhum serviço adicionado à medição</div>';
            return;
        }

        servicosMedicao.forEach(sm => {
            const div = document.createElement('div');
            div.className = 'servico-item';
            div.innerHTML = `
                <div class="servico-info">
                    <strong>${sm.servicos_obra_hvc.descricao}</strong><br>
                    ${sm.observacoes ? `<small>Obs: ${sm.observacoes}</small>` : ''}
                </div>
                <div class="servico-actions">
                    <button class="btn btn-danger btn-small" onclick="excluirServicoMedicao(${sm.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error('Erro ao carregar serviços da medição:', error);
    }
}

// Adicionar serviço à medição
async function adicionarServicoMedicao() {
    const servicoId = document.getElementById('servico-medicao').value;
    const observacoes = document.getElementById('observacoes-servico-medicao').value;

    if (!servicoId) {
        alert('Selecione um serviço.');
        return;
    }

    try {
        const { error } = await supabase
            .from('servicos_medicao_hvc')
            .insert({
                medicao_id: medicaoAtual,
                servico_id: parseInt(servicoId),
                observacoes: observacoes || null
            });

        if (error) throw error;

        document.getElementById('servico-medicao').value = '';
        document.getElementById('observacoes-servico-medicao').value = '';
        await carregarServicosMedicao();

    } catch (error) {
        console.error('Erro ao adicionar serviço à medição:', error);
        alert('Erro ao adicionar serviço à medição.');
    }
}

// Excluir serviço da medição
async function excluirServicoMedicao(servicoMedicaoId) {
    if (!confirm('Tem certeza que deseja remover este serviço da medição?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('servicos_medicao_hvc')
            .delete()
            .eq('id', servicoMedicaoId);

        if (error) throw error;

        await carregarServicosMedicao();

    } catch (error) {
        console.error('Erro ao excluir serviço da medição:', error);
        alert('Erro ao excluir serviço da medição.');
    }
}

// Atualizar status da obra
async function atualizarStatusObra() {
    try {
        // Buscar todos os serviços da obra
        const { data: servicos, error: servicosError } = await supabase
            .from('servicos_obra_hvc')
            .select('data_inicio, data_conclusao')
            .eq('obra_id', obraAtual);

        if (servicosError) throw servicosError;

        let novoStatus = 'a_iniciar';

        if (servicos.length > 0) {
            const servicosIniciados = servicos.filter(s => s.data_inicio);
            const servicosConcluidos = servicos.filter(s => s.data_conclusao);

            if (servicosConcluidos.length === servicos.length) {
                // Todos os serviços concluídos - verificar pagamento
                const valores = await calcularValoresObra(obraAtual);
                novoStatus = valores.valorEmAberto <= 0 ? 'concluida' : 'pagamento_pendente';
            } else if (servicosIniciados.length > 0) {
                novoStatus = 'em_andamento';
            }
        }

        // Atualizar status no banco
        const { error: updateError } = await supabase
            .from('obras_hvc')
            .update({ status: novoStatus })
            .eq('id', obraAtual);

        if (updateError) throw updateError;

        // Recarregar lista de obras
        await carregarObras();

    } catch (error) {
        console.error('Erro ao atualizar status da obra:', error);
    }
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
        alert('Erro ao excluir obra.');
    }
}

// Fechar modal
function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    
    // Se for o modal de medições, restaura o botão para modo adicionar
    if (modalId === 'modal-medicoes') {
        const btnSalvar = document.querySelector('#modal-medicoes .btn-success');
        btnSalvar.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
        btnSalvar.onclick = adicionarMedicao;
        
        // Limpa formulário
        document.getElementById('data-medicao').value = '';
        document.getElementById('valor-medicao').value = '';
        document.getElementById('status-medicao').value = 'vai_ser_enviada';
        document.getElementById('retencao-adicao').value = '';
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('obra-form').reset();
    document.getElementById('cliente-obra').value = '';
    document.getElementById('valor-total-obra').value = '';
}

// Funções de formatação
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor || 0);
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR');
}

function formatarStatus(status) {
    const statusMap = {
        'a_iniciar': 'À Iniciar',
        'em_andamento': 'Em Andamento',
        'concluida': 'Concluída',
        'pagamento_pendente': 'Pagamento Pendente'
    };
    return statusMap[status] || status;
}

function formatarStatusServico(servico) {
    if (servico.data_conclusao) return 'Concluído';
    if (servico.data_inicio) return 'Iniciado';
    return 'À Iniciar';
}

function formatarStatusMedicao(status) {
    const statusMap = {
        'vai_ser_enviada': 'Vai ser enviada',
        'ja_foi_enviada': 'Já foi enviada',
        'ja_foi_recebida': 'Já foi recebida'
    };
    return statusMap[status] || status;
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    const modals = ['modal-servicos', 'modal-medicoes', 'modal-servicos-medicao'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            fecharModal(modalId);
        }
    });
}

// Exportar funções globais
window.abrirModalServicos = abrirModalServicos;
window.abrirModalMedicoes = abrirModalMedicoes;
window.abrirModalServicosMedicao = abrirModalServicosMedicao;
window.adicionarServico = adicionarServico;
window.adicionarMedicao = adicionarMedicao;
window.adicionarServicoMedicao = adicionarServicoMedicao;
window.editarMedicao = editarMedicao;
window.salvarEdicaoMedicao = salvarEdicaoMedicao;
window.toggleInicioServico = toggleInicioServico;
window.toggleConclusaoServico = toggleConclusaoServico;
window.excluirServico = excluirServico;
window.excluirMedicao = excluirMedicao;
window.excluirServicoMedicao = excluirServicoMedicao;
window.excluirObra = excluirObra;
window.fecharModal = fecharModal;
window.limparFormulario = limparFormulario;

