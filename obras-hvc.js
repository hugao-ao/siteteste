// obras-hvc.js - Gerenciamento de Obras HVC (VERSÃO FINAL CORRIGIDA)

import { injectSidebar } from './sidebar.js';
import { supabase } from './supabase.js';

// Variáveis globais
let obraAtual = null;
let medicaoAtual = null;
let proximoNumeroObra = 1;
let propostasDisponiveis = [];
let propostasSelecionadas = new Set();

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const nivel = sessionStorage.getItem('nivel');
        const projeto = sessionStorage.getItem('projeto');
        
        if (!nivel || (nivel !== 'admin' && projeto !== 'Hvc')) {
            mostrarErro('Acesso negado. Esta página é restrita ao projeto HVC.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        await injectSidebar('main-content-obras-hvc');
        await inicializarPagina();
        setupEventListeners();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        mostrarErro('Erro ao inicializar a página. Recarregue e tente novamente.');
    }
});

// Configurar event listeners
function setupEventListeners() {
    try {
        const propostasFilter = document.getElementById('filtro-propostas');
        if (propostasFilter) {
            propostasFilter.addEventListener('input', filtrarPropostas);
        }

        const numeroObra = document.getElementById('numero-obra');
        const valorMedicao = document.getElementById('valor-medicao');
        const valorServico = document.getElementById('valor-servico');

        if (numeroObra) numeroObra.addEventListener('input', formatarNumeroObra);
        if (valorMedicao) valorMedicao.addEventListener('input', formatarValorMonetario);
        if (valorServico) valorServico.addEventListener('input', formatarValorMonetario);

        window.addEventListener('click', function(event) {
            const modais = ['modal-servicos', 'modal-medicoes', 'modal-servicos-medicao'];
            modais.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (event.target === modal) {
                    fecharModal(modalId);
                }
            });
        });

    } catch (error) {
        console.error('Erro ao configurar event listeners:', error);
    }
}

// Inicializar página
async function inicializarPagina() {
    try {
        await carregarPropostasAprovadas();
        await carregarObras();
        await definirProximoNumero();
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
        mostrarErro('Erro ao carregar alguns dados. Algumas funcionalidades podem estar limitadas.');
    }
}

// ===== FUNÇÕES DE FORMATAÇÃO =====

function formatarMoeda(valor) {
    try {
        if (!valor && valor !== 0) return 'R$ 0,00';
        
        const numero = typeof valor === 'string' ? parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) : parseFloat(valor);
        
        if (isNaN(numero)) return 'R$ 0,00';
        
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numero);
    } catch (error) {
        console.error('Erro ao formatar moeda:', error);
        return 'R$ 0,00';
    }
}

function formatarData(data) {
    try {
        if (!data) return 'N/A';
        
        const dataObj = new Date(data);
        if (isNaN(dataObj.getTime())) return 'Data inválida';
        
        return dataObj.toLocaleDateString('pt-BR');
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'N/A';
    }
}

function formatarStatus(status) {
    const statusMap = {
        'a_iniciar': 'A Iniciar',
        'em_andamento': 'Em Andamento',
        'concluido': 'Concluído',
        'pausado': 'Pausado'
    };
    return statusMap[status] || 'Indefinido';
}

function formatarStatusServico(servico) {
    if (servico.data_conclusao) return 'Concluído';
    if (servico.data_inicio) return 'Em Andamento';
    return 'Não Iniciado';
}

function formatarStatusMedicao(status) {
    const statusMap = {
        'vai_ser_enviada': 'Vai ser Enviada',
        'enviada': 'Enviada',
        'aprovada': 'Aprovada',
        'rejeitada': 'Rejeitada'
    };
    return statusMap[status] || 'Indefinido';
}

// ===== FUNÇÕES DE NOTIFICAÇÃO =====

function mostrarCarregamento(elemento, texto = 'Carregando...') {
    try {
        if (typeof elemento === 'string') {
            elemento = document.getElementById(elemento);
        }
        
        if (elemento) {
            elemento.innerHTML = `<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-spinner fa-spin"></i> ${texto}</div>`;
        }
    } catch (error) {
        console.error('Erro ao mostrar carregamento:', error);
    }
}

function mostrarSucesso(mensagem, duracao = 3000) {
    try {
        const div = document.createElement('div');
        div.className = 'notification success';
        div.innerHTML = `<i class="fas fa-check"></i> ${mensagem}`;
        
        document.body.appendChild(div);
        
        setTimeout(() => {
            if (div.parentNode) {
                div.parentNode.removeChild(div);
            }
        }, duracao);
    } catch (error) {
        console.error('Erro ao mostrar sucesso:', error);
    }
}

function mostrarErro(mensagem, duracao = 5000) {
    try {
        const div = document.createElement('div');
        div.className = 'notification error';
        div.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${mensagem}`;
        
        document.body.appendChild(div);
        
        setTimeout(() => {
            if (div.parentNode) {
                div.parentNode.removeChild(div);
            }
        }, duracao);
    } catch (error) {
        console.error('Erro ao mostrar erro:', error);
    }
}

function mostrarAviso(mensagem, duracao = 4000) {
    try {
        const div = document.createElement('div');
        div.className = 'notification warning';
        div.innerHTML = `<i class="fas fa-exclamation"></i> ${mensagem}`;
        
        document.body.appendChild(div);
        
        setTimeout(() => {
            if (div.parentNode) {
                div.parentNode.removeChild(div);
            }
        }, duracao);
    } catch (error) {
        console.error('Erro ao mostrar aviso:', error);
    }
}

// ===== FUNÇÕES DE PROPOSTAS =====

async function carregarPropostasAprovadas() {
    try {
        console.log('Iniciando carregamento de propostas...');
        
        let propostas = null;
        let error = null;
        
        try {
            const result = await supabase
                .from('propostas_hvc')
                .select(`
                    id,
                    numero_proposta,
                    valor,
                    clientes_hvc (nome)
                `)
                .eq('status', 'Aprovada');
            
            propostas = result.data;
            error = result.error;
        } catch (relacionamentoError) {
            console.warn('Erro na consulta com relacionamento:', relacionamentoError);
            
            try {
                const result = await supabase
                    .from('propostas_hvc')
                    .select('id, numero_proposta, valor, cliente_id')
                    .eq('status', 'Aprovada');
                
                propostas = result.data;
                error = result.error;
                
                if (propostas && propostas.length > 0) {
                    for (let proposta of propostas) {
                        if (proposta.cliente_id) {
                            try {
                                const { data: cliente } = await supabase
                                    .from('clientes_hvc')
                                    .select('nome')
                                    .eq('id', proposta.cliente_id)
                                    .single();
                                
                                proposta.clientes_hvc = cliente ? { nome: cliente.nome } : { nome: 'Cliente não encontrado' };
                            } catch (clienteError) {
                                console.warn('Erro ao buscar cliente:', clienteError);
                                proposta.clientes_hvc = { nome: 'Cliente não encontrado' };
                            }
                        } else {
                            proposta.clientes_hvc = { nome: 'Sem cliente' };
                        }
                    }
                }
            } catch (semRelacionamentoError) {
                console.warn('Erro na consulta sem relacionamento:', semRelacionamentoError);
                
                try {
                    const result = await supabase
                        .from('propostas_hvc')
                        .select('*')
                        .eq('status', 'Aprovada');
                    
                    propostas = result.data;
                    error = result.error;
                    
                    if (propostas && propostas.length > 0) {
                        propostas.forEach(proposta => {
                            if (!proposta.clientes_hvc) {
                                proposta.clientes_hvc = { nome: 'Cliente não especificado' };
                            }
                        });
                    }
                } catch (basicError) {
                    console.error('Erro na consulta básica:', basicError);
                    error = basicError;
                    propostas = [];
                }
            }
        }

        if (error) {
            console.error('Erro final ao carregar propostas:', error);
            propostasDisponiveis = [];
            mostrarMensagemErro('Erro ao carregar propostas. Verifique a configuração do banco de dados.');
            return;
        }

        console.log('Propostas carregadas:', propostas);
        propostasDisponiveis = propostas || [];
        renderizarPropostas(propostasDisponiveis);

    } catch (error) {
        console.error('Erro geral ao carregar propostas:', error);
        propostasDisponiveis = [];
        mostrarMensagemErro('Erro ao carregar propostas aprovadas. Tente recarregar a página.');
    }
}

function mostrarMensagemErro(mensagem) {
    try {
        const container = document.getElementById('propostas-list');
        if (container) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); border-radius: 8px; margin: 10px 0;">${mensagem}</div>`;
        }
    } catch (error) {
        console.error('Erro ao mostrar mensagem:', error);
    }
}

function renderizarPropostas(propostas) {
    try {
        const container = document.getElementById('propostas-list');
        if (!container) {
            console.warn('Container propostas-list não encontrado');
            return;
        }

        container.innerHTML = '';

        if (!propostas || propostas.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Nenhuma proposta aprovada disponível</div>';
            return;
        }

        propostas.forEach(proposta => {
            try {
                if (proposta) {
                    const clienteNome = proposta.clientes_hvc?.nome || proposta.cliente_nome || 'Cliente não especificado';
                    const numeroProposta = proposta.numero_proposta || `Proposta ${proposta.id}`;
                    const valor = proposta.valor || 0;

                    const div = document.createElement('div');
                    div.className = 'proposta-item';
                    
                    const estaSelecionada = propostasSelecionadas.has(proposta.id);
                    
                   div.innerHTML = `
                        <input type="checkbox" id="prop-${proposta.id}" value="${proposta.id}" 
                       onchange="atualizarSelecaoPropostas()" ${estaSelecionada ? 'checked' : ''}>
                        <div class="proposta-info">
                            <div class="proposta-numero">${numeroProposta}</div>
                            <div>${clienteNome}</div>
                            <div class="proposta-valor">${formatarMoeda(valor)}</div>
                        </div>
                    `;
                    div.dataset.cliente = clienteNome;
                    div.dataset.valor = valor;
                    div.dataset.numero = numeroProposta;
                    container.appendChild(div);
                }
            } catch (propostaError) {
                console.warn('Erro ao renderizar proposta:', propostaError, proposta);
            }
        });

        atualizarCamposSelecao();

    } catch (error) {
        console.error('Erro ao renderizar propostas:', error);
        mostrarMensagemErro('Erro ao exibir propostas.');
    }
}

function filtrarPropostas() {
    try {
        const selecoesSalvas = new Set();
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
        checkboxes.forEach(cb => selecoesSalvas.add(parseInt(cb.value)));
        
        const filtro = document.getElementById('filtro-propostas')?.value?.toLowerCase() || '';
        
        if (!filtro) {
            renderizarPropostas(propostasDisponiveis);
        } else {
            const propostasFiltradas = propostasDisponiveis.filter(proposta => {
                const numero = (proposta.numero_proposta || '').toLowerCase();
                const cliente = (proposta.clientes_hvc?.nome || proposta.cliente_nome || '').toLowerCase();
                return numero.includes(filtro) || cliente.includes(filtro);
            });
            renderizarPropostas(propostasFiltradas);
        }
        
        setTimeout(() => {
            selecoesSalvas.forEach(id => {
                const checkbox = document.getElementById(`prop-${id}`);
                if (checkbox) {
                    checkbox.checked = true;
                    propostasSelecionadas.add(id);
                }
            });
            atualizarCamposSelecao();
        }, 50);
        
    } catch (error) {
        console.error('Erro ao filtrar propostas:', error);
    }
}

function atualizarSelecaoPropostas() {
    try {
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
        
        const idsVisiveis = new Set();
        checkboxes.forEach(checkbox => {
            idsVisiveis.add(parseInt(checkbox.value));
        });
        
        const idsParaRemover = [];
        propostasSelecionadas.forEach(id => {
            if (!idsVisiveis.has(id)) {
                idsParaRemover.push(id);
            }
        });
        idsParaRemover.forEach(id => propostasSelecionadas.delete(id));
        
        checkboxes.forEach(checkbox => {
            const id = parseInt(checkbox.value);
            if (checkbox.checked) {
                propostasSelecionadas.add(id);
            } else {
                propostasSelecionadas.delete(id);
            }
        });

        atualizarCamposSelecao();

    } catch (error) {
        console.error('Erro ao atualizar seleção de propostas:', error);
    }
}

function atualizarCamposSelecao() {
    try {
        const clienteField = document.getElementById('cliente-obra');
        const valorTotalField = document.getElementById('valor-total');

        if (!clienteField || !valorTotalField) {
            console.warn('Campos cliente ou valor total não encontrados');
            return;
        }

        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            clienteField.value = '';
            valorTotalField.value = '';
            return;
        }

        const primeiraPropostaDiv = checkboxes[0].closest('.proposta-item');
        const cliente = primeiraPropostaDiv?.dataset?.cliente || '';
        clienteField.value = cliente;

        let valorTotal = 0;
        checkboxes.forEach(checkbox => {
            const propostaDiv = checkbox.closest('.proposta-item');
            const valor = parseFloat(propostaDiv?.dataset?.valor || 0);
            if (!isNaN(valor)) {
                valorTotal += valor;
            }
        });

        valorTotalField.value = formatarMoeda(valorTotal);

        document.querySelectorAll('.proposta-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox?.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar campos de seleção:', error);
    }
}

// ===== FUNÇÕES DE OBRAS =====

async function definirProximoNumero() {
    try {
        const anoAtual = new Date().getFullYear();
        
        const { data: obras, error } = await supabase
            .from('obras_hvc')
            .select('numero_obra')
            .like('numero_obra', `%/${anoAtual}`);

        if (error) {
            console.warn('Erro ao buscar obras para definir próximo número:', error);
            proximoNumeroObra = 1;
        } else {
            let maiorNumero = 0;
            if (obras && obras.length > 0) {
                obras.forEach(obra => {
                    if (obra && obra.numero_obra) {
                        const numero = parseInt(obra.numero_obra.split('/')[0]);
                        if (!isNaN(numero) && numero > maiorNumero) {
                            maiorNumero = numero;
                        }
                    }
                });
            }
            proximoNumeroObra = maiorNumero + 1;
        }

        const numeroFormatado = proximoNumeroObra.toString().padStart(4, '0') + '/' + anoAtual;
        
        const numeroField = document.getElementById('numero-obra');
        if (numeroField) {
            numeroField.value = numeroFormatado;
        }

    } catch (error) {
        console.error('Erro ao definir próximo número:', error);
        const anoAtual = new Date().getFullYear();
        const numeroField = document.getElementById('numero-obra');
        if (numeroField) {
            numeroField.value = `0001/${anoAtual}`;
        }
    }
}

function formatarNumeroObra(event) {
    try {
        if (!event || !event.target) return;
        
        let valor = event.target.value.replace(/\D/g, '');
        if (valor.length > 4) {
            valor = valor.substring(0, 4);
        }
        
        const anoAtual = new Date().getFullYear();
        if (valor) {
            valor = valor.padStart(4, '0') + '/' + anoAtual;
        }
        
        event.target.value = valor;
    } catch (error) {
        console.error('Erro ao formatar número da obra:', error);
    }
}

function formatarValorMonetario(event) {
    try {
        if (!event || !event.target) return;
        
        let valor = event.target.value.replace(/\D/g, '');
        
        if (!valor) {
            event.target.value = '';
            return;
        }
        
        const numeroValor = parseInt(valor);
        const valorFormatado = (numeroValor / 100).toFixed(2);
        const valorComVirgula = valorFormatado.replace('.', ',');
        const valorComPontos = valorComVirgula.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        event.target.value = 'R$ ' + valorComPontos;
    } catch (error) {
        console.error('Erro ao formatar valor monetário:', error);
    }
}

function converterValorMonetario(valorString) {
    try {
        if (!valorString || typeof valorString !== 'string') return 0;
        
        const valorLimpo = valorString.replace(/[R$\s.]/g, '').replace(',', '.');
        const numero = parseFloat(valorLimpo);
        
        return isNaN(numero) ? 0 : numero;
    } catch (error) {
        console.error('Erro ao converter valor monetário:', error);
        return 0;
    }
}

async function adicionarObra() {
    try {
        const numeroObra = document.getElementById('numero-obra')?.value?.trim();
        const nomeObra = document.getElementById('nome-obra')?.value?.trim();
        const observacoes = document.getElementById('observacoes-obra')?.value?.trim();

        if (!numeroObra) {
            mostrarErro('Preencha o número da obra.');
            document.getElementById('numero-obra')?.focus();
            return;
        }

        if (!nomeObra) {
            mostrarErro('Preencha o nome da obra.');
            document.getElementById('nome-obra')?.focus();
            return;
        }

        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            mostrarErro('Selecione pelo menos uma proposta aprovada.');
            return;
        }

        const formatoNumero = /^\d{4}\/\d{4}$/;
        if (!formatoNumero.test(numeroObra)) {
            mostrarErro('Formato do número da obra deve ser: 0000/0000');
            document.getElementById('numero-obra')?.focus();
            return;
        }

        const { data: obraExistente, error: verificacaoError } = await supabase
            .from('obras_hvc')
            .select('id')
            .eq('numero_obra', numeroObra)
            .maybeSingle();

        if (verificacaoError) {
            console.warn('Erro na verificação:', verificacaoError);
        }

        if (obraExistente) {
            mostrarErro('Número de obra já existe. Escolha outro número.');
            document.getElementById('numero-obra')?.focus();
            return;
        }

        const idsPropostas = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        const { data: propostaData, error: propostaError } = await supabase
            .from('propostas_hvc')
            .select('cliente_id, valor')
            .eq('id', idsPropostas[0])
            .single();
            
        if (propostaError || !propostaData) {
            throw new Error('Não foi possível obter dados da proposta selecionada');
        }

        let valorTotal = 0;
        for (const id of idsPropostas) {
            const { data: proposta } = await supabase
                .from('propostas_hvc')
                .select('valor')
                .eq('id', id)
                .single();
            
            if (proposta && proposta.valor) {
                valorTotal += parseFloat(proposta.valor);
            }
        }

        const { data: obra, error: obraError } = await supabase
            .from('obras_hvc')
            .insert({
                numero_obra: numeroObra,
                nome_obra: nomeObra,
                cliente_id: propostaData.cliente_id,
                valor_total: valorTotal,
                observacoes: observacoes || null,
                status: 'a_iniciar'
            })
            .select()
            .single();

        if (obraError) {
            console.error('Erro ao inserir obra:', obraError);
            throw new Error('Erro ao salvar obra: ' + obraError.message);
        }

        const propostasObra = idsPropostas.map(propostaId => ({
            obra_id: obra.id,
            proposta_id: propostaId
        }));

        const { error: propostasError } = await supabase
            .from('propostas_obra_hvc')
            .insert(propostasObra);

        if (propostasError) {
            console.warn('Erro ao associar propostas:', propostasError);
        }

        mostrarSucesso('Obra adicionada com sucesso!');
        limparFormulario();
        await carregarObras();
        await definirProximoNumero();

    } catch (error) {
        console.error('Erro ao adicionar obra:', error);
        mostrarErro('Erro ao adicionar obra: ' + (error.message || 'Erro desconhecido. Verifique os dados e tente novamente.'));
    }
}

function limparFormulario() {
    try {
        const campos = ['numero-obra', 'nome-obra', 'cliente-obra', 'valor-total', 'observacoes-obra', 'filtro-propostas'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) {
                campo.value = '';
            }
        });

        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        propostasSelecionadas.clear();
        renderizarPropostas(propostasDisponiveis);

    } catch (error) {
        console.error('Erro ao limpar formulário:', error);
    }
}

async function carregarObras() {
    try {
        console.log('Carregando obras...');
        
        let obras = null;
        let error = null;
        
        try {
            const result = await supabase
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
            
            obras = result.data;
            error = result.error;
        } catch (relacionamentoError) {
            console.warn('Erro na consulta com relacionamentos:', relacionamentoError);
            
            try {
                const result = await supabase
                    .from('obras_hvc')
                    .select('*')
                    .order('numero_obra', { ascending: false });
                
                obras = result.data;
                error = result.error;
                
                if (obras && obras.length > 0) {
                    for (let obra of obras) {
                        obra.propostas_obra_hvc = [];
                        try {
                            const { data: propostas } = await supabase
                                .from('propostas_obra_hvc')
                                .select('propostas_hvc(*)')
                                .eq('obra_id', obra.id);
                            
                            if (propostas) {
                                obra.propostas_obra_hvc = propostas;
                            }
                        } catch (propostasError) {
                            console.warn('Erro ao buscar propostas da obra:', propostasError);
                        }
                    }
                }
            } catch (basicError) {
                console.error('Erro na consulta básica de obras:', basicError);
                error = basicError;
                obras = [];
            }
        }

        const tbody = document.getElementById('obras-list');
        if (!tbody) {
            console.warn('Elemento obras-list não encontrado');
            return;
        }

        tbody.innerHTML = '';

        if (error) {
            console.error('Erro ao carregar obras:', error);
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #ff4444;">Erro ao carregar obras</td></tr>';
            return;
        }

        if (!obras || obras.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #999;">Nenhuma obra cadastrada</td></tr>';
            return;
        }

        for (const obra of obras) {
            try {
                const valores = await calcularValoresObra(obra.id);
                
                const cliente = obra.propostas_obra_hvc?.[0]?.propostas_hvc?.clientes_hvc?.nome || 
                               obra.propostas_obra_hvc?.[0]?.propostas_hvc?.cliente_nome || 'N/A';
                
                const valorTotal = obra.propostas_obra_hvc?.reduce((total, po) => 
                    total + (po.propostas_hvc?.valor || 0), 0) || 0;

               const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${obra.numero_obra || 'N/A'}</td>
                            <td>${obra.nome_obra || 'N/A'}</td>
                            <td>${cliente}</td>
                            <td class="valor-positivo">${formatarMoeda(valorTotal)}</td>
                            <td class="valor-positivo">${formatarMoeda(valores.valorTotalMedido)}</td>
                            <td class="valor-positivo">${formatarMoeda(valores.valorTotalRecebido)}</td>
                            <td class="${valores.valorMedidoNaoRecebido > 0 ? 'valor-negativo' : 'valor-neutro'}">${formatarMoeda(valores.valorMedidoNaoRecebido)}</td>
                            <td class="${valores.valorEmAberto > 0 ? 'valor-negativo' : 'valor-positivo'}">${formatarMoeda(valores.valorEmAberto)}</td>
                            <td><span class="status-badge status-${obra.status?.replace('_', '-') || 'indefinido'}">${formatarStatus(obra.status)}</span></td>
                            <td>
                                <button class="btn btn-primary btn-small" data-action="servicos" data-obra-id="${obra.id}" data-numero="${obra.numero_obra || ''}">
                                    <i class="fas fa-tools"></i> Gerenciar
                                </button>
                            </td>
                            <td>
                                <button class="btn btn-warning btn-small" data-action="medicoes" data-obra-id="${obra.id}" data-numero="${obra.numero_obra || ''}">
                                    <i class="fas fa-ruler"></i> Gerenciar
                                </button>
                            </td>
                            <td>
                                <button class="btn btn-danger btn-small" data-action="excluir" data-obra-id="${obra.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        
                        tbody.appendChild(row);
                        
                        const servicosBtn = row.querySelector('[data-action="servicos"]');
                        const medicoesBtn = row.querySelector('[data-action="medicoes"]');
                        const excluirBtn = row.querySelector('[data-action="excluir"]');
                        
                        if (servicosBtn) {
                            servicosBtn.addEventListener('click', function() {
                                const obraId = this.getAttribute('data-obra-id');
                                const numeroObra = this.getAttribute('data-numero');
                                abrirModalServicos(obraId, numeroObra);
                            });
                        }
                        
                        if (medicoesBtn) {
                            medicoesBtn.addEventListener('click', function() {
                                const obraId = this.getAttribute('data-obra-id');
                                const numeroObra = this.getAttribute('data-numero');
                                abrirModalMedicoes(obraId, numeroObra);
                            });
                        }
                        
                        if (excluirBtn) {
                            excluirBtn.addEventListener('click', function() {
                                const obraId = this.getAttribute('data-obra-id');
                                excluirObra(obraId);
                            });
                        }
            } 
            
            catch (obraError) {
                console.error(`Erro ao processar obra ${obra.id}:`, obraError);
            }
        }

    } catch (error) {
        console.error('Erro geral ao carregar obras:', error);
        const tbody = document.getElementById('obras-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #ff4444;">Erro ao carregar obras</td></tr>';
        }
    }
}

async function calcularValoresObra(obraId) {
    try {
        if (!obraId) {
            return { valorTotalMedido: 0, valorTotalRecebido: 0, valorMedidoNaoRecebido: 0, valorEmAberto: 0 };
        }

        let medicoes = [];
        try {
            const { data, error } = await supabase
                .from('medicoes_obra_hvc')
                .select('valor, pago')
                .eq('obra_id', obraId);
            
            if (!error && data) {
                medicoes = data;
            }
        } catch (medicoesError) {
            console.warn('Erro ao buscar medições:', medicoesError);
        }

        let propostas = [];
        try {
            const { data, error } = await supabase
                .from('propostas_obra_hvc')
                .select('propostas_hvc(valor)')
                .eq('obra_id', obraId);
            
            if (!error && data) {
                propostas = data;
            }
        } catch (propostasError) {
            console.warn('Erro ao buscar propostas:', propostasError);
        }

        let recebimentos = [];
        try {
            const { data, error } = await supabase
                .from('fluxo_caixa_hvc')
                .select('valor')
                .eq('obra_id', obraId)
                .eq('tipo', 'recebimento')
                .eq('pago_sem_medicao', true);
            
            if (!error && data) {
                recebimentos = data;
            }
        } catch (recebimentosError) {
            console.warn('Erro ao buscar recebimentos:', recebimentosError);
        }

        const valorTotalPropostas = propostas.reduce((total, p) => {
            const valor = p?.propostas_hvc?.valor || 0;
            return total + (isNaN(valor) ? 0 : parseFloat(valor));
        }, 0);

        const valorTotalMedido = medicoes.reduce((total, m) => {
            const valor = parseFloat(m?.valor || 0);
            return total + (isNaN(valor) ? 0 : valor);
        }, 0);

        const valorMedicoesPagas = medicoes.filter(m => m?.pago).reduce((total, m) => {
            const valor = parseFloat(m?.valor || 0);
            return total + (isNaN(valor) ? 0 : valor);
        }, 0);

        const valorRecebimentosSemMedicao = recebimentos.reduce((total, r) => {
            const valor = parseFloat(r?.valor || 0);
            return total + (isNaN(valor) ? 0 : valor);
        }, 0);
        
        const valorTotalRecebido = valorMedicoesPagas + valorRecebimentosSemMedicao;
        const valorMedidoNaoRecebido = valorTotalMedido - valorMedicoesPagas;
        const valorEmAberto = valorTotalPropostas - valorTotalRecebido;

        return {
            valorTotalMedido: isNaN(valorTotalMedido) ? 0 : valorTotalMedido,
            valorTotalRecebido: isNaN(valorTotalRecebido) ? 0 : valorTotalRecebido,
            valorMedidoNaoRecebido: isNaN(valorMedidoNaoRecebido) ? 0 : valorMedidoNaoRecebido,
            valorEmAberto: isNaN(valorEmAberto) ? 0 : valorEmAberto
        };

    } catch (error) {
        console.error('Erro ao calcular valores da obra:', error);
        return { valorTotalMedido: 0, valorTotalRecebido: 0, valorMedidoNaoRecebido: 0, valorEmAberto: 0 };
    }
}

async function excluirObra(obraId) {
    try {
        if (!obraId) {
            mostrarErro('ID da obra inválido.');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) {
            return;
        }

        const { error } = await supabase
            .from('obras_hvc')
            .delete()
            .eq('id', obraId);

        if (error) {
            console.error('Erro ao excluir obra:', error);
            throw new Error('Erro ao excluir obra: ' + error.message);
        }

        mostrarSucesso('Obra excluída com sucesso!');
        await carregarObras();

    } catch (error) {
        console.error('Erro ao excluir obra:', error);
        mostrarErro('Erro ao excluir obra: ' + (error.message || 'Erro desconhecido'));
    }
}

// ===== FUNÇÕES DE SERVIÇOS =====

async function abrirModalServicos(obraId, numeroObra) {
    try {
        if (!obraId || !numeroObra) {
            mostrarErro('Dados da obra inválidos.');
            return;
        }

        obraAtual = obraId;
        
        const modalElement = document.getElementById('modal-servicos-obra');
        const modal = document.getElementById('modal-servicos');
        
        if (!modalElement || !modal) {
            mostrarErro('Modal de serviços não encontrado.');
            return;
        }

        modalElement.textContent = numeroObra;
        modal.style.display = 'block';
        await carregarServicos();
    } catch (error) {
        console.error('Erro ao abrir modal de serviços:', error);
        mostrarErro('Erro ao abrir gerenciamento de serviços.');
    }
}

async function carregarServicos() {
    try {
        if (!obraAtual) {
            console.warn('Nenhuma obra selecionada');
            return;
        }

        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('id');

        if (error) throw error;

        const container = document.getElementById('servicos-container');
        if (!container) {
            console.warn('Container de serviços não encontrado');
            return;
        }

        container.innerHTML = '';

        if (!servicos || servicos.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Nenhum serviço adicionado</div>';
            return;
        }

        servicos.forEach(servico => {
            if (!servico) return;

            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <strong>${servico.descricao || 'Sem descrição'}</strong><br>
                    <small>Status: ${formatarStatusServico(servico)}</small>
                    ${servico.valor ? `<br><small>Valor: ${formatarMoeda(servico.valor)}</small>` : ''}
                    ${servico.data_inicio ? `<br><small>Iniciado: ${formatarData(servico.data_inicio)}</small>` : ''}
                    ${servico.data_conclusao ? `<br><small>Concluído: ${formatarData(servico.data_conclusao)}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn ${servico.data_inicio ? 'btn-warning' : 'btn-success'} btn-small" 
                            onclick="toggleInicioServico(${servico.id}, ${!!servico.data_inicio})">
                        ${servico.data_inicio ? 'Desmarcar Início' : 'Iniciar'}
                    </button>
                    <button class="btn ${servico.data_conclusao ? 'btn-warning' : 'btn-success'} btn-small" 
                            onclick="toggleConclusaoServico(${servico.id}, ${!!servico.data_conclusao})">
                        ${servico.data_conclusao ? 'Desmarcar Conclusão' : 'Concluir'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="excluirServico(${servico.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        await atualizarStatusObra();

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        const container = document.getElementById('servicos-container');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar serviços</div>';
        }
    }
}

async function adicionarServico() {
    try {
        const descricaoField = document.getElementById('nome-servico');
        const valorField = document.getElementById('valor-servico');
        
        if (!descricaoField) {
            mostrarErro('Campo de descrição não encontrado.');
            return;
        }

        const descricao = descricaoField.value.trim();
        const valorTexto = valorField ? valorField.value.trim() : '';
        
        if (!descricao) {
            mostrarErro('Digite o nome do serviço.');
            descricaoField.focus();
            return;
        }

        if (!obraAtual) {
            mostrarErro('Nenhuma obra selecionada.');
            return;
        }

        const { data: servicoExistente } = await supabase
            .from('servicos_obra_hvc')
            .select('id')
            .eq('obra_id', obraAtual)
            .eq('descricao', descricao)
            .maybeSingle();

        if (servicoExistente) {
            mostrarErro('Já existe um serviço com esta descrição para esta obra.');
            descricaoField.focus();
            return;
        }

        let valorNumerico = null;
        if (valorTexto) {
            valorNumerico = converterValorMonetario(valorTexto);
            if (valorNumerico <= 0) {
                mostrarErro('Valor deve ser maior que zero.');
                valorField?.focus();
                return;
            }
        }

        const { error } = await supabase
            .from('servicos_obra_hvc')
            .insert({
                obra_id: obraAtual,
                descricao: descricao,
                valor: valorNumerico
            });

        if (error) {
            console.error('Erro ao inserir serviço:', error);
            throw new Error('Erro ao salvar serviço: ' + error.message);
        }

        descricaoField.value = '';
        if (valorField) valorField.value = '';

        await carregarServicos();

        mostrarSucesso('Serviço adicionado com sucesso!');

    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        mostrarErro('Erro ao adicionar serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

async function toggleInicioServico(servicoId, jaIniciado) {
    try {
        if (!servicoId) {
            mostrarErro('ID do serviço inválido.');
            return;
        }

        if (jaIniciado) {
            if (!confirm('Tem certeza que deseja desmarcar o início deste serviço?')) {
                return;
            }
        }

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
        mostrarErro('Erro ao atualizar serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

async function toggleConclusaoServico(servicoId, jaConcluido) {
    try {
        if (!servicoId) {
            mostrarErro('ID do serviço inválido.');
            return;
        }

        if (jaConcluido) {
            if (!confirm('Tem certeza que deseja desmarcar a conclusão deste serviço?')) {
                return;
            }
        }

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
        mostrarErro('Erro ao atualizar serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

async function excluirServico(servicoId) {
    try {
        if (!servicoId) {
            mostrarErro('ID do serviço inválido.');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir este serviço?')) {
            return;
        }

        const { error } = await supabase
            .from('servicos_obra_hvc')
            .delete()
            .eq('id', servicoId);

        if (error) throw error;

        await carregarServicos();
        mostrarSucesso('Serviço excluído com sucesso!');

    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        mostrarErro('Erro ao excluir serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

async function atualizarStatusObra() {
    try {
        if (!obraAtual) return;

        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('data_inicio, data_conclusao')
            .eq('obra_id', obraAtual);

        if (error || !servicos || servicos.length === 0) {
            return;
        }

        let novoStatus = 'a_iniciar';
        
        const algumIniciado = servicos.some(s => s.data_inicio);
        const todosConcluidos = servicos.length > 0 && servicos.every(s => s.data_conclusao);
        
        if (todosConcluidos) {
            novoStatus = 'concluido';
        } else if (algumIniciado) {
            novoStatus = 'em_andamento';
        }

        await supabase
            .from('obras_hvc')
            .update({ status: novoStatus })
            .eq('id', obraAtual);

        await carregarObras();

    } catch (error) {
        console.error('Erro ao atualizar status da obra:', error);
    }
}

// ===== FUNÇÕES DE MEDIÇÕES =====

async function abrirModalMedicoes(obraId, numeroObra) {
    try {
        if (!obraId || !numeroObra) {
            mostrarErro('Dados da obra inválidos.');
            return;
        }

        obraAtual = obraId;
        
        const modalElement = document.getElementById('modal-medicoes-obra');
        const modal = document.getElementById('modal-medicoes');
        
        if (!modalElement || !modal) {
            mostrarErro('Modal de medições não encontrado.');
            return;
        }

        modalElement.textContent = numeroObra;
        modal.style.display = 'block';
        await carregarMedicoes();
        await definirProximoNumeroMedicao(numeroObra);
    } catch (error) {
        console.error('Erro ao abrir modal de medições:', error);
        mostrarErro('Erro ao abrir gerenciamento de medições.');
    }
}

async function definirProximoNumeroMedicao(numeroObra) {
    try {
        if (!obraAtual || !numeroObra) {
            console.warn('Dados insuficientes para definir próximo número de medição');
            return;
        }

        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('numero_medicao')
            .eq('obra_id', obraAtual);

        if (error) throw error;

        let maiorNumero = 0;
        if (medicoes && medicoes.length > 0) {
            medicoes.forEach(medicao => {
                if (medicao && medicao.numero_medicao) {
                    const numero = parseInt(medicao.numero_medicao.split('/')[0]);
                    if (!isNaN(numero) && numero > maiorNumero) {
                        maiorNumero = numero;
                    }
                }
            });
        }

        const proximoNumero = (maiorNumero + 1).toString().padStart(3, '0');
        const numeroField = document.getElementById('numero-medicao');
        
        if (numeroField) {
            numeroField.value = `${proximoNumero}/${numeroObra}`;
        }

    } catch (error) {
        console.error('Erro ao definir próximo número de medição:', error);
    }
}

async function carregarMedicoes() {
    try {
        if (!obraAtual) {
            console.warn('Nenhuma obra selecionada');
            return;
        }

        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('numero_medicao');

        if (error) throw error;

        const container = document.getElementById('medicoes-container');
        if (!container) {
            console.warn('Container de medições não encontrado');
            return;
        }

        container.innerHTML = '';

        if (!medicoes || medicoes.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Nenhuma medição adicionada</div>';
            return;
        }

        medicoes.forEach(medicao => {
            if (!medicao) return;

            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <strong>Medição ${medicao.numero_medicao || 'N/A'}</strong><br>
                    <small>Data Início: ${formatarData(medicao.data_inicio)}</small><br>
                    ${medicao.data_fim ? `<small>Data Fim: ${formatarData(medicao.data_fim)}</small><br>` : ''}
                    <small>Valor: ${formatarMoeda(medicao.valor || 0)}</small><br>
                    <small>Status: ${formatarStatusMedicao(medicao.status)}</small><br>
                    <small>Pago: ${medicao.pago ? 'Sim' : 'Não'}</small>
                    ${medicao.observacoes ? `<br><small>Obs: ${medicao.observacoes}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-small" onclick="editarMedicao(${medicao.id})">
                        <i class="fas fa-edit"></i> Editar
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
        const container = document.getElementById('medicoes-container');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar medições</div>';
        }
    }
}

async function adicionarMedicao() {
    try {
        const numeroMedicao = document.getElementById('numero-medicao')?.value?.trim();
        const dataInicio = document.getElementById('data-inicio')?.value;
        const dataFim = document.getElementById('data-fim')?.value;
        const valorMedicao = document.getElementById('valor-medicao')?.value;
        const observacoes = document.getElementById('observacoes-medicao')?.value?.trim();

        if (!numeroMedicao) {
            mostrarErro('Preencha o número da medição.');
            document.getElementById('numero-medicao')?.focus();
            return;
        }

        if (!dataInicio) {
            mostrarErro('Preencha a data de início.');
            document.getElementById('data-inicio')?.focus();
            return;
        }

        if (!valorMedicao) {
            mostrarErro('Preencha o valor da medição.');
            document.getElementById('valor-medicao')?.focus();
            return;
        }

        if (!obraAtual) {
            mostrarErro('Nenhuma obra selecionada.');
            return;
        }

        if (dataFim && dataFim < dataInicio) {
            mostrarErro('Data de fim deve ser posterior à data de início.');
            document.getElementById('data-fim')?.focus();
            return;
        }

        const { data: medicaoExistente } = await supabase
            .from('medicoes_obra_hvc')
            .select('id')
            .eq('obra_id', obraAtual)
            .eq('numero_medicao', numeroMedicao)
            .maybeSingle();

        if (medicaoExistente) {
            mostrarErro('Já existe uma medição com este número para esta obra.');
            document.getElementById('numero-medicao')?.focus();
            return;
        }

        const valorNumerico = converterValorMonetario(valorMedicao);
        if (valorNumerico <= 0) {
            mostrarErro('Valor da medição deve ser maior que zero.');
            document.getElementById('valor-medicao')?.focus();
            return;
        }

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .insert({
                obra_id: obraAtual,
                numero_medicao: numeroMedicao,
                data_inicio: dataInicio,
                data_fim: dataFim || null,
                valor: valorNumerico,
                observacoes: observacoes || null,
                status: 'vai_ser_enviada',
                pago: false
            });

        if (error) {
            console.error('Erro ao inserir medição:', error);
            throw new Error('Erro ao salvar medição: ' + error.message);
        }

        limparFormularioMedicao();
        await carregarMedicoes();
        
        const numeroObraElement = document.getElementById('modal-medicoes-obra');
        if (numeroObraElement) {
            await definirProximoNumeroMedicao(numeroObraElement.textContent);
        }

        mostrarSucesso('Medição adicionada com sucesso!');

    } catch (error) {
        console.error('Erro ao adicionar medição:', error);
        mostrarErro('Erro ao adicionar medição: ' + (error.message || 'Erro desconhecido'));
    }
}

function limparFormularioMedicao() {
    try {
        const campos = ['data-inicio', 'data-fim', 'valor-medicao', 'observacoes-medicao'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) campo.value = '';
        });
    } catch (error) {
        console.error('Erro ao limpar formulário de medição:', error);
    }
}

async function editarMedicao(medicaoId) {
    try {
        if (!medicaoId) {
            mostrarErro('ID da medição inválido.');
            return;
        }

        const { data: medicao, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('id', medicaoId)
            .single();

        if (error) {
            console.error('Erro ao buscar medição:', error);
            throw new Error('Erro ao carregar medição: ' + error.message);
        }

        if (!medicao) {
            mostrarErro('Medição não encontrada.');
            return;
        }

        const campos = {
            'numero-medicao': medicao.numero_medicao || '',
            'data-inicio': medicao.data_inicio || '',
            'data-fim': medicao.data_fim || '',
            'valor-medicao': medicao.valor ? formatarMoeda(medicao.valor) : '',
            'observacoes-medicao': medicao.observacoes || ''
        };

        Object.entries(campos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.value = valor;
            }
        });

        const btnAdicionar = document.querySelector('#form-medicao button[type="submit"]');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
            btnAdicionar.onclick = (e) => {
                e.preventDefault();
                salvarEdicaoMedicao(medicaoId);
            };
        }

        let btnCancelar = document.getElementById('btn-cancelar-edicao');
        if (!btnCancelar) {
            btnCancelar = document.createElement('button');
            btnCancelar.id = 'btn-cancelar-edicao';
            btnCancelar.type = 'button';
            btnCancelar.className = 'btn btn-warning';
            btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar';
            btnCancelar.onclick = cancelarEdicaoMedicao;
            btnAdicionar.parentNode.insertBefore(btnCancelar, btnAdicionar.nextSibling);
        }

    } catch (error) {
        console.error('Erro ao editar medição:', error);
        mostrarErro('Erro ao carregar medição para edição: ' + (error.message || 'Erro desconhecido'));
    }
}

async function salvarEdicaoMedicao(medicaoId) {
    try {
        if (!medicaoId) {
            mostrarErro('ID da medição inválido.');
            return;
        }

        const dataInicio = document.getElementById('data-inicio')?.value;
        const dataFim = document.getElementById('data-fim')?.value;
        const valorMedicao = document.getElementById('valor-medicao')?.value;
        const observacoes = document.getElementById('observacoes-medicao')?.value?.trim();

        if (!dataInicio) {
            mostrarErro('Preencha a data de início.');
            return;
        }

        if (dataFim && dataFim < dataInicio) {
            mostrarErro('Data de fim deve ser posterior à data de início.');
            return;
        }

        const valorNumerico = converterValorMonetario(valorMedicao);
        if (valorNumerico <= 0) {
            mostrarErro('Valor da medição deve ser maior que zero.');
            return;
        }

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .update({
                data_inicio: dataInicio,
                data_fim: dataFim || null,
                valor: valorNumerico,
                observacoes: observacoes || null
            })
            .eq('id', medicaoId);

        if (error) throw error;

        restaurarBotaoAdicionar();
        limparFormularioMedicao();
        await carregarMedicoes();
        
        const numeroObraElement = document.getElementById('modal-medicoes-obra');
        if (numeroObraElement) {
            await definirProximoNumeroMedicao(numeroObraElement.textContent);
        }

        mostrarSucesso('Medição atualizada com sucesso!');

    } catch (error) {
        console.error('Erro ao salvar edição da medição:', error);
        mostrarErro('Erro ao salvar alterações: ' + (error.message || 'Erro desconhecido'));
    }
}

function cancelarEdicaoMedicao() {
    try {
        limparFormularioMedicao();
        restaurarBotaoAdicionar();
        
        const btnCancelar = document.getElementById('btn-cancelar-edicao');
        if (btnCancelar) {
            btnCancelar.remove();
        }
        
        const numeroObraElement = document.getElementById('modal-medicoes-obra');
        if (numeroObraElement) {
            definirProximoNumeroMedicao(numeroObraElement.textContent);
        }
        
    } catch (error) {
        console.error('Erro ao cancelar edição:', error);
    }
}

function restaurarBotaoAdicionar() {
    try {
        const btnSalvar = document.querySelector('#form-medicao button[type="submit"]');
        if (btnSalvar) {
            btnSalvar.innerHTML = '<i class="fas fa-plus"></i> Adicionar Medição';
            btnSalvar.onclick = (e) => {
                e.preventDefault();
                adicionarMedicao();
            };
        }
    } catch (error) {
        console.error('Erro ao restaurar botão:', error);
    }
}

async function excluirMedicao(medicaoId) {
    try {
        if (!medicaoId) {
            mostrarErro('ID da medição inválido.');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir esta medição?')) {
            return;
        }

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .delete()
            .eq('id', medicaoId);

        if (error) throw error;

        await carregarMedicoes();
        mostrarSucesso('Medição excluída com sucesso!');

    } catch (error) {
        console.error('Erro ao excluir medição:', error);
        mostrarErro('Erro ao excluir medição: ' + (error.message || 'Erro desconhecido'));
    }
}

// ===== FUNÇÕES DE MODAL =====

function fecharModal(modalId) {
    try {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        
        if (modalId === 'modal-servicos' || modalId === 'modal-medicoes') {
            obraAtual = null;
        }
        
        if (modalId === 'modal-servicos-medicao') {
            medicaoAtual = null;
        }
    } catch (error) {
        console.error('Erro ao fechar modal:', error);
    }
}

// ===== FUNÇÕES GLOBAIS =====

window.adicionarObra = adicionarObra;
window.adicionarServico = adicionarServico;
window.adicionarMedicao = adicionarMedicao;
window.abrirModalServicos = abrirModalServicos;
window.abrirModalMedicoes = abrirModalMedicoes;
window.fecharModal = fecharModal;
window.toggleInicioServico = toggleInicioServico;
window.toggleConclusaoServico = toggleConclusaoServico;
window.excluirServico = excluirServico;
window.editarMedicao = editarMedicao;
window.excluirMedicao = excluirMedicao;
window.excluirObra = excluirObra;
window.atualizarSelecaoPropostas = atualizarSelecaoPropostas;

