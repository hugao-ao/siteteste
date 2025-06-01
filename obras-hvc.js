// obras-hvc.js - Gerenciamento de Obras HVC (Versão Corrigida)
import { supabase } from './supabase.js';

// Variáveis globais
let obraAtual = null;
let servicoAtual = null;
let medicaoAtual = null;
let propostasAprovadas = [];
let propostasSelecionadas = [];

// Inicialização da página
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando página de Obras HVC...');
    inicializarPagina();
});

async function inicializarPagina() {
    try {
        await carregarPropostasAprovadas();
        await carregarObras();
        configurarEventos();
        configurarFiltroPropostas();
        configurarFormatacaoMoeda();
        console.log('Página inicializada com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
        alert('Erro ao carregar dados. Verifique o console.');
    }
}

function configurarEventos() {
    // Formulário de obra
    const form = document.getElementById('obra-form');
    if (form) {
        form.addEventListener('submit', salvarObra);
    }

    // Formatação do número da obra
    const numeroObra = document.getElementById('numero-obra');
    if (numeroObra) {
        numeroObra.addEventListener('input', formatarNumeroObra);
    }

    // Eventos dos modais
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };
}

function configurarFiltroPropostas() {
    const filtro = document.getElementById('propostas-filter');
    if (filtro) {
        filtro.addEventListener('input', filtrarPropostas);
    }
}

function configurarFormatacaoMoeda() {
    const camposMoeda = ['valor-medicao', 'retencao-adicao'];
    camposMoeda.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.addEventListener('input', function(e) {
                formatarMoeda(e.target);
            });
        }
    });
}

// Formatação de número da obra
function formatarNumeroObra(event) {
    let valor = event.target.value.replace(/\D/g, '');
    if (valor.length > 4) {
        const ano = new Date().getFullYear();
        const numero = valor.substring(0, 4);
        valor = `${numero.padStart(4, '0')}/${ano}`;
    }
    event.target.value = valor;
}

// Formatação de moeda
function formatarMoeda(input) {
    let valor = input.value.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2);
    valor = valor.replace('.', ',');
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    input.value = 'R$ ' + valor;
}

function removerFormatacaoMoeda(valor) {
    if (!valor) return 0;
    return parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function formatarMoedaExibicao(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Carregar propostas aprovadas
async function carregarPropostasAprovadas() {
    try {
        console.log('Carregando propostas aprovadas...');
        const { data, error } = await supabase
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc!inner(nome)
            `)
            .eq('status', 'aprovada');

        if (error) throw error;

        propostasAprovadas = data || [];
        console.log('Propostas carregadas:', propostasAprovadas.length);
        renderizarListaPropostas();
    } catch (error) {
        console.error('Erro ao carregar propostas:', error);
        propostasAprovadas = [];
    }
}

function renderizarListaPropostas() {
    const lista = document.getElementById('propostas-list');
    if (!lista) return;

    lista.innerHTML = '';

    propostasAprovadas.forEach(proposta => {
        const item = document.createElement('div');
        item.className = 'proposta-item';
        item.innerHTML = `
            <input type="checkbox" id="prop-${proposta.id}" value="${proposta.id}">
            <label for="prop-${proposta.id}">
                ${proposta.numero} - ${proposta.clientes_hvc.nome} - ${formatarMoedaExibicao(proposta.valor)}
            </label>
        `;

        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                propostasSelecionadas.push(proposta);
                item.classList.add('selected');
            } else {
                propostasSelecionadas = propostasSelecionadas.filter(p => p.id !== proposta.id);
                item.classList.remove('selected');
            }
            atualizarCamposObra();
        });

        lista.appendChild(item);
    });
}

function filtrarPropostas() {
    const filtro = document.getElementById('propostas-filter');
    const termo = filtro.value.toLowerCase();
    const itens = document.querySelectorAll('.proposta-item');

    itens.forEach(item => {
        const texto = item.textContent.toLowerCase();
        if (texto.includes(termo)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function atualizarCamposObra() {
    const clienteField = document.getElementById('cliente-obra');
    const valorField = document.getElementById('valor-total-obra');

    if (propostasSelecionadas.length === 0) {
        clienteField.value = '';
        valorField.value = '';
        return;
    }

    // Cliente (pegar do primeiro ou verificar se todos são do mesmo)
    const clientes = [...new Set(propostasSelecionadas.map(p => p.clientes_hvc.nome))];
    clienteField.value = clientes.length === 1 ? clientes[0] : 'Múltiplos clientes';

    // Valor total
    const valorTotal = propostasSelecionadas.reduce((sum, p) => sum + (p.valor || 0), 0);
    valorField.value = formatarMoedaExibicao(valorTotal);
}

// Salvar obra
async function salvarObra(event) {
    event.preventDefault();

    const numeroObra = document.getElementById('numero-obra').value.trim();
    const nomeObra = document.getElementById('nome-obra').value.trim();
    const observacoes = document.getElementById('observacoes-obra').value.trim();

    if (!numeroObra || !nomeObra) {
        alert('Por favor, preencha o número e nome da obra.');
        return;
    }

    if (propostasSelecionadas.length === 0) {
        alert('Por favor, selecione pelo menos uma proposta aprovada.');
        return;
    }

    try {
        // Verificar se o número da obra já existe
        const { data: obraExistente } = await supabase
            .from('obras_hvc')
            .select('id')
            .eq('numero', numeroObra)
            .single();

        if (obraExistente) {
            alert('Já existe uma obra com este número.');
            return;
        }

        // Calcular valor total
        const valorTotal = propostasSelecionadas.reduce((sum, p) => sum + (p.valor || 0), 0);

        // Inserir obra
        const { data: obra, error: obraError } = await supabase
            .from('obras_hvc')
            .insert({
                numero: numeroObra,
                nome: nomeObra,
                cliente: document.getElementById('cliente-obra').value,
                valor_total: valorTotal,
                observacoes: observacoes,
                status: 'a_iniciar'
            })
            .select()
            .single();

        if (obraError) throw obraError;

        // Associar propostas à obra
        const propostasObra = propostasSelecionadas.map(proposta => ({
            obra_id: obra.id,
            proposta_id: proposta.id
        }));

        const { error: propostasError } = await supabase
            .from('obras_propostas')
            .insert(propostasObra);

        if (propostasError) throw propostasError;

        alert('Obra salva com sucesso!');
        limparFormulario();
        await carregarObras();

    } catch (error) {
        console.error('Erro ao salvar obra:', error);
        alert('Erro ao salvar obra. Verifique o console.');
    }
}

function limparFormulario() {
    document.getElementById('obra-form').reset();
    propostasSelecionadas = [];
    
    // Desmarcar checkboxes
    const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.proposta-item').classList.remove('selected');
    });

    atualizarCamposObra();
}

// Carregar e exibir obras
async function carregarObras() {
    try {
        console.log('Carregando obras...');
        const { data, error } = await supabase
            .from('obras_hvc')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const obras = data || [];
        console.log('Obras carregadas:', obras.length);
        
        // Carregar dados adicionais para cada obra
        for (let obra of obras) {
            await calcularValoresObra(obra);
        }
        
        renderizarObras(obras);
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        renderizarObras([]);
    }
}

async function calcularValoresObra(obra) {
    try {
        // Carregar medições da obra
        const { data: medicoes } = await supabase
            .from('medicoes_hvc')
            .select('*')
            .eq('obra_id', obra.id);

        // Carregar recebimentos relacionados à obra
        const { data: recebimentos } = await supabase
            .from('fluxo_caixa_hvc')
            .select('*')
            .eq('tipo', 'recebimento')
            .eq('obra_id', obra.id);

        // Calcular valores
        const valorTotalMedido = (medicoes || []).reduce((sum, m) => sum + (m.valor || 0), 0);
        const medicoesPagas = (medicoes || []).filter(m => m.pago).reduce((sum, m) => sum + (m.valor || 0), 0);
        const recebimentosSemMedicao = (recebimentos || []).filter(r => !r.medicao_id).reduce((sum, r) => sum + (r.valor || 0), 0);
        
        obra.valor_total_medido = valorTotalMedido;
        obra.valor_total_recebido = medicoesPagas + recebimentosSemMedicao;
        obra.valor_medido_nao_recebido = valorTotalMedido - medicoesPagas;
        obra.valor_em_aberto = (obra.valor_total || 0) - obra.valor_total_recebido;

        // Atualizar status baseado nos serviços
        const { data: servicos } = await supabase
            .from('servicos_obra')
            .select('*')
            .eq('obra_id', obra.id);

        if (!servicos || servicos.length === 0) {
            obra.status = 'a_iniciar';
        } else {
            const todosConcluidos = servicos.every(s => s.concluido);
            if (todosConcluidos) {
                obra.status = obra.valor_em_aberto <= 0 ? 'concluida' : 'pagamento_pendente';
            } else {
                const algumIniciado = servicos.some(s => s.iniciado);
                obra.status = algumIniciado ? 'em_andamento' : 'a_iniciar';
            }
        }

    } catch (error) {
        console.error('Erro ao calcular valores da obra:', error);
        obra.valor_total_medido = 0;
        obra.valor_total_recebido = 0;
        obra.valor_medido_nao_recebido = 0;
        obra.valor_em_aberto = obra.valor_total || 0;
    }
}

function renderizarObras(obras) {
    const tbody = document.getElementById('obras-tbody');
    if (!tbody) return;

    if (obras.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="no-items">Nenhuma obra cadastrada</td></tr>';
        return;
    }

    tbody.innerHTML = obras.map(obra => `
        <tr>
            <td>${obra.numero}</td>
            <td>${obra.nome}</td>
            <td>${obra.cliente}</td>
            <td class="valor-cell">${formatarMoedaExibicao(obra.valor_total)}</td>
            <td class="valor-cell ${obra.valor_total_medido > 0 ? 'valor-positivo' : ''}">${formatarMoedaExibicao(obra.valor_total_medido)}</td>
            <td class="valor-cell ${obra.valor_total_recebido > 0 ? 'valor-positivo' : ''}">${formatarMoedaExibicao(obra.valor_total_recebido)}</td>
            <td class="valor-cell ${obra.valor_medido_nao_recebido > 0 ? 'valor-negativo' : 'valor-positivo'}">${formatarMoedaExibicao(obra.valor_medido_nao_recebido)}</td>
            <td class="valor-cell ${obra.valor_em_aberto > 0 ? 'valor-negativo' : 'valor-positivo'}">${formatarMoedaExibicao(obra.valor_em_aberto)}</td>
            <td><span class="status-badge status-${obra.status.replace('_', '-')}">${formatarStatus(obra.status)}</span></td>
            <td>
                <button class="btn btn-info btn-small" onclick="abrirModalServicos(${obra.id}, '${obra.numero}')">
                    <i class="fas fa-tools"></i> Ver
                </button>
            </td>
            <td>
                <button class="btn btn-primary btn-small" onclick="abrirModalMedicoes(${obra.id}, '${obra.numero}')">
                    <i class="fas fa-ruler"></i> Ver
                </button>
            </td>
            <td>
                <button class="btn btn-danger btn-small" onclick="excluirObra(${obra.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function formatarStatus(status) {
    const statusMap = {
        'a_iniciar': 'À Iniciar',
        'em_andamento': 'Em Andamento',
        'concluida': 'Concluída',
        'pagamento_pendente': 'Pag. Pendente'
    };
    return statusMap[status] || status;
}

// Funções dos modais
function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Modal de Serviços
async function abrirModalServicos(obraId, numeroObra) {
    obraAtual = obraId;
    document.getElementById('modal-servicos-obra').textContent = numeroObra;
    await carregarServicos();
    abrirModal('modal-servicos');
}

async function carregarServicos() {
    try {
        const { data, error } = await supabase
            .from('servicos_obra')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const servicos = data || [];
        renderizarServicos(servicos);
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        renderizarServicos([]);
    }
}

function renderizarServicos(servicos) {
    const lista = document.getElementById('servicos-list');
    if (!lista) return;

    if (servicos.length === 0) {
        lista.innerHTML = '<p class="no-items">Nenhum serviço adicionado</p>';
        return;
    }

    lista.innerHTML = servicos.map(servico => `
        <div class="servico-item">
            <div class="servico-info">
                <strong>${servico.descricao}</strong>
                <div>
                    ${servico.data_inicio ? `Iniciado em: ${new Date(servico.data_inicio).toLocaleDateString('pt-BR')}` : ''}
                    ${servico.data_conclusao ? `| Concluído em: ${new Date(servico.data_conclusao).toLocaleDateString('pt-BR')}` : ''}
                </div>
                <div>Status: <strong>${getStatusServico(servico)}</strong></div>
            </div>
            <div class="servico-actions">
                <button class="toggle-btn ${servico.iniciado ? 'active' : 'inactive'}" 
                        onclick="toggleIniciado(${servico.id}, ${servico.iniciado})">
                    ${servico.iniciado ? 'Iniciado' : 'Não Iniciado'}
                </button>
                <button class="toggle-btn ${servico.concluido ? 'active' : 'inactive'}" 
                        onclick="toggleConcluido(${servico.id}, ${servico.concluido})">
                    ${servico.concluido ? 'Concluído' : 'Não Concluído'}
                </button>
                <button class="btn btn-danger btn-small" onclick="excluirServico(${servico.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function getStatusServico(servico) {
    if (servico.concluido) return 'Concluído';
    if (servico.iniciado) return 'Iniciado';
    return 'À Iniciar';
}

async function adicionarServico() {
    const descricao = document.getElementById('novo-servico').value.trim();
    if (!descricao) {
        alert('Por favor, digite a descrição do serviço.');
        return;
    }

    try {
        const { error } = await supabase
            .from('servicos_obra')
            .insert({
                obra_id: obraAtual,
                descricao: descricao,
                iniciado: false,
                concluido: false
            });

        if (error) throw error;

        document.getElementById('novo-servico').value = '';
        await carregarServicos();
        await carregarObras(); // Atualizar status da obra
    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        alert('Erro ao adicionar serviço.');
    }
}

async function toggleIniciado(servicoId, estadoAtual) {
    const novoEstado = !estadoAtual;
    
    if (!novoEstado && !confirm('Tem certeza que deseja desmarcar como iniciado?')) {
        return;
    }

    try {
        const updateData = {
            iniciado: novoEstado,
            data_inicio: novoEstado ? new Date().toISOString() : null
        };

        const { error } = await supabase
            .from('servicos_obra')
            .update(updateData)
            .eq('id', servicoId);

        if (error) throw error;

        await carregarServicos();
        await carregarObras();
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        alert('Erro ao atualizar serviço.');
    }
}

async function toggleConcluido(servicoId, estadoAtual) {
    const novoEstado = !estadoAtual;
    
    if (!novoEstado && !confirm('Tem certeza que deseja desmarcar como concluído?')) {
        return;
    }

    try {
        const updateData = {
            concluido: novoEstado,
            data_conclusao: novoEstado ? new Date().toISOString() : null
        };

        const { error } = await supabase
            .from('servicos_obra')
            .update(updateData)
            .eq('id', servicoId);

        if (error) throw error;

        await carregarServicos();
        await carregarObras();
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        alert('Erro ao atualizar serviço.');
    }
}

async function excluirServico(servicoId) {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;

    try {
        const { error } = await supabase
            .from('servicos_obra')
            .delete()
            .eq('id', servicoId);

        if (error) throw error;

        await carregarServicos();
        await carregarObras();
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        alert('Erro ao excluir serviço.');
    }
}

// Modal de Medições
async function abrirModalMedicoes(obraId, numeroObra) {
    obraAtual = obraId;
    document.getElementById('modal-medicoes-obra').textContent = numeroObra;
    await carregarMedicoes();
    await carregarServicosParaMedicao();
    gerarProximoNumeroMedicao(numeroObra);
    abrirModal('modal-medicoes');
}

async function carregarMedicoes() {
    try {
        const { data, error } = await supabase
            .from('medicoes_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('numero', { ascending: true });

        if (error) throw error;

        const medicoes = data || [];
        renderizarMedicoes(medicoes);
    } catch (error) {
        console.error('Erro ao carregar medições:', error);
        renderizarMedicoes([]);
    }
}

function renderizarMedicoes(medicoes) {
    const lista = document.getElementById('medicoes-list');
    if (!lista) return;

    if (medicoes.length === 0) {
        lista.innerHTML = '<p class="no-items">Nenhuma medição adicionada</p>';
        return;
    }

    lista.innerHTML = medicoes.map(medicao => `
        <div class="medicao-item">
            <div class="medicao-info">
                <strong>${medicao.numero}</strong>
                <div>Data: ${new Date(medicao.data_medicao).toLocaleDateString('pt-BR')}</div>
                <div>Valor: ${formatarMoedaExibicao(medicao.valor)}</div>
                <div>Status: ${formatarStatusMedicao(medicao.status)}</div>
                <div>Retenção/Adição: ${formatarMoedaExibicao(medicao.retencao_adicao)}</div>
                <div>Pago: ${medicao.pago ? 'Sim' : 'Não'}</div>
            </div>
            <div class="medicao-actions">
                <button class="btn btn-info btn-small" onclick="editarMedicao(${medicao.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-secondary btn-small" onclick="abrirModalServicosMedicao(${medicao.id}, '${medicao.numero}')">
                    <i class="fas fa-list"></i> Serviços
                </button>
                <button class="btn btn-danger btn-small" onclick="excluirMedicao(${medicao.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function formatarStatusMedicao(status) {
    const statusMap = {
        'vai_ser_enviada': 'Vai ser enviada',
        'ja_foi_enviada': 'Já foi enviada',
        'ja_foi_recebida': 'Já foi recebida'
    };
    return statusMap[status] || status;
}

function gerarProximoNumeroMedicao(numeroObra) {
    // Buscar última medição para gerar próximo número
    supabase
        .from('medicoes_hvc')
        .select('numero')
        .eq('obra_id', obraAtual)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
            let proximoNumero = 1;
            if (data && data.length > 0) {
                const ultimoNumero = data[0].numero;
                const match = ultimoNumero.match(/^(\d+)\//);
                if (match) {
                    proximoNumero = parseInt(match[1]) + 1;
                }
            }
            
            const numeroFormatado = `${proximoNumero.toString().padStart(3, '0')}/${numeroObra}`;
            document.getElementById('numero-medicao').value = numeroFormatado;
        });
}

async function adicionarMedicao() {
    const numero = document.getElementById('numero-medicao').value.trim();
    const data = document.getElementById('data-medicao').value;
    const valor = removerFormatacaoMoeda(document.getElementById('valor-medicao').value);
    const status = document.getElementById('status-medicao').value;
    const retencaoAdicao = removerFormatacaoMoeda(document.getElementById('retencao-adicao').value);

    if (!numero || !data) {
        alert('Por favor, preencha o número e data da medição.');
        return;
    }

    try {
        if (medicaoAtual) {
            // Editando medição existente
            const { error } = await supabase
                .from('medicoes_hvc')
                .update({
                    data_medicao: data,
                    valor: valor,
                    status: status,
                    retencao_adicao: retencaoAdicao
                })
                .eq('id', medicaoAtual);

            if (error) throw error;
            medicaoAtual = null;
        } else {
            // Adicionando nova medição
            const { error } = await supabase
                .from('medicoes_hvc')
                .insert({
                    obra_id: obraAtual,
                    numero: numero,
                    data_medicao: data,
                    valor: valor,
                    status: status,
                    retencao_adicao: retencaoAdicao,
                    pago: false
                });

            if (error) throw error;
        }

        limparFormularioMedicao();
        await carregarMedicoes();
        await carregarObras();
    } catch (error) {
        console.error('Erro ao salvar medição:', error);
        alert('Erro ao salvar medição.');
    }
}

async function editarMedicao(medicaoId) {
    try {
        const { data, error } = await supabase
            .from('medicoes_hvc')
            .select('*')
            .eq('id', medicaoId)
            .single();

        if (error) throw error;

        medicaoAtual = medicaoId;
        document.getElementById('numero-medicao').value = data.numero;
        document.getElementById('data-medicao').value = data.data_medicao;
        document.getElementById('valor-medicao').value = formatarMoedaExibicao(data.valor);
        document.getElementById('status-medicao').value = data.status;
        document.getElementById('retencao-adicao').value = formatarMoedaExibicao(data.retencao_adicao);

        // Mudar texto do botão
        const botao = document.querySelector('#modal-medicoes .btn-success');
        if (botao) {
            botao.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
        }
    } catch (error) {
        console.error('Erro ao carregar medição:', error);
        alert('Erro ao carregar medição.');
    }
}

function limparFormularioMedicao() {
    medicaoAtual = null;
    document.getElementById('data-medicao').value = '';
    document.getElementById('valor-medicao').value = '';
    document.getElementById('status-medicao').value = 'vai_ser_enviada';
    document.getElementById('retencao-adicao').value = '';

    // Restaurar texto do botão
    const botao = document.querySelector('#modal-medicoes .btn-success');
    if (botao) {
        botao.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
    }

    // Gerar novo número
    const numeroObra = document.getElementById('modal-medicoes-obra').textContent;
    gerarProximoNumeroMedicao(numeroObra);
}

async function excluirMedicao(medicaoId) {
    if (!confirm('Tem certeza que deseja excluir esta medição?')) return;

    try {
        const { error } = await supabase
            .from('medicoes_hvc')
            .delete()
            .eq('id', medicaoId);

        if (error) throw error;

        await carregarMedicoes();
        await carregarObras();
    } catch (error) {
        console.error('Erro ao excluir medição:', error);
        alert('Erro ao excluir medição.');
    }
}

// Modal Serviços da Medição
async function abrirModalServicosMedicao(medicaoId, numeroMedicao) {
    medicaoAtual = medicaoId;
    document.getElementById('modal-servicos-medicao-numero').textContent = numeroMedicao;
    await carregarServicosMedicao();
    abrirModal('modal-servicos-medicao');
}

async function carregarServicosParaMedicao() {
    try {
        const { data, error } = await supabase
            .from('servicos_obra')
            .select('*')
            .eq('obra_id', obraAtual);

        if (error) throw error;

        const select = document.getElementById('servico-medicao');
        if (select) {
            select.innerHTML = '<option value="">Selecione um serviço</option>';
            (data || []).forEach(servico => {
                select.innerHTML += `<option value="${servico.id}">${servico.descricao}</option>`;
            });
        }
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

async function carregarServicosMedicao() {
    try {
        const { data, error } = await supabase
            .from('medicoes_servicos')
            .select(`
                *,
                servicos_obra(descricao)
            `)
            .eq('medicao_id', medicaoAtual);

        if (error) throw error;

        renderizarServicosMedicao(data || []);
    } catch (error) {
        console.error('Erro ao carregar serviços da medição:', error);
        renderizarServicosMedicao([]);
    }
}

function renderizarServicosMedicao(servicos) {
    const lista = document.getElementById('servicos-medicao-list');
    if (!lista) return;

    if (servicos.length === 0) {
        lista.innerHTML = '<p class="no-items">Nenhum serviço adicionado a esta medição</p>';
        return;
    }

    lista.innerHTML = servicos.map(item => `
        <div class="servico-item">
            <div class="servico-info">
                <strong>${item.servicos_obra.descricao}</strong>
                ${item.observacoes ? `<div>Obs: ${item.observacoes}</div>` : ''}
            </div>
            <div class="servico-actions">
                <button class="btn btn-danger btn-small" onclick="excluirServicoMedicao(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function adicionarServicoMedicao() {
    const servicoId = document.getElementById('servico-medicao').value;
    const observacoes = document.getElementById('observacoes-servico-medicao').value.trim();

    if (!servicoId) {
        alert('Por favor, selecione um serviço.');
        return;
    }

    try {
        const { error } = await supabase
            .from('medicoes_servicos')
            .insert({
                medicao_id: medicaoAtual,
                servico_id: servicoId,
                observacoes: observacoes
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

async function excluirServicoMedicao(itemId) {
    if (!confirm('Tem certeza que deseja remover este serviço da medição?')) return;

    try {
        const { error } = await supabase
            .from('medicoes_servicos')
            .delete()
            .eq('id', itemId);

        if (error) throw error;

        await carregarServicosMedicao();
    } catch (error) {
        console.error('Erro ao excluir serviço da medição:', error);
        alert('Erro ao excluir serviço da medição.');
    }
}

// Excluir obra
async function excluirObra(obraId) {
    if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) return;

    try {
        const { error } = await supabase
            .from('obras_hvc')
            .delete()
            .eq('id', obraId);

        if (error) throw error;

        await carregarObras();
        alert('Obra excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir obra:', error);
        alert('Erro ao excluir obra.');
    }
}

// Expor funções globalmente para uso nos event handlers HTML
window.abrirModalServicos = abrirModalServicos;
window.abrirModalMedicoes = abrirModalMedicoes;
window.abrirModalServicosMedicao = abrirModalServicosMedicao;
window.fecharModal = fecharModal;
window.adicionarServico = adicionarServico;
window.adicionarMedicao = adicionarMedicao;
window.adicionarServicoMedicao = adicionarServicoMedicao;
window.toggleIniciado = toggleIniciado;
window.toggleConcluido = toggleConcluido;
window.editarMedicao = editarMedicao;
window.excluirServico = excluirServico;
window.excluirMedicao = excluirMedicao;
window.excluirServicoMedicao = excluirServicoMedicao;
window.excluirObra = excluirObra;
window.limparFormulario = limparFormulario;

