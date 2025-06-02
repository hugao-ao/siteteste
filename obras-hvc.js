// obras-hvc.js - Gerenciamento de Obras HVC (VERSÃO COMPLETA E ROBUSTA)

import { injectSidebar } from './sidebar.js';
import { supabase } from './supabase.js';

// Variáveis globais
let obraAtual = null;
let medicaoAtual = null;
let proximoNumeroObra = 1;
let propostasDisponiveis = [];
let propostasSelecionadas = new Set(); // Para manter seleções persistentes

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verifica autenticação
        const nivel = sessionStorage.getItem('nivel');
        const projeto = sessionStorage.getItem('projeto');
        
        if (!nivel || (nivel !== 'admin' && projeto !== 'Hvc')) {
            alert('Acesso negado. Esta página é restrita ao projeto HVC.');
            window.location.href = 'index.html';
            return;
        }

        // Injeta sidebar
        await injectSidebar('main-content-obras-hvc');

        // Inicializa a página
        await inicializarPagina();
        
        // Event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao inicializar a página. Recarregue e tente novamente.');
    }
});

// Configurar event listeners
function setupEventListeners() {
    try {
        // Event listener para filtro de propostas
        const propostasFilter = document.getElementById('filtro-propostas');
        if (propostasFilter) {
            propostasFilter.addEventListener('input', filtrarPropostas);
        }

        // Event listeners para formatação
        const numeroObra = document.getElementById('numero-obra');
        const valorMedicao = document.getElementById('valor-medicao');
        const retencaoAdicao = document.getElementById('retencao-adicao');

        if (numeroObra) numeroObra.addEventListener('input', formatarNumeroObra);
        if (valorMedicao) valorMedicao.addEventListener('input', formatarValorMonetario);
        if (retencaoAdicao) retencaoAdicao.addEventListener('input', formatarValorMonetario);
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
        // Não lança erro para não quebrar a página
        mostrarMensagemErro('Erro ao carregar alguns dados. Algumas funcionalidades podem estar limitadas.');
    }
}

// Mostrar mensagem de erro na interface
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

// Carregar propostas aprovadas (VERSÃO ULTRA ROBUSTA)
async function carregarPropostasAprovadas() {
    try {
        console.log('Iniciando carregamento de propostas...');
        
        // Primeira tentativa: consulta com relacionamento
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
            
            // Segunda tentativa: consulta sem relacionamento
            try {
                const result = await supabase
                    .from('propostas_hvc')
                    .select('id, numero_proposta, valor, cliente_id')
                    .eq('status', 'Aprovada');
                
                propostas = result.data;
                error = result.error;
                
                // Se conseguiu carregar, tenta buscar nomes dos clientes separadamente
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
                
                // Terceira tentativa: consulta básica
                try {
                    const result = await supabase
                        .from('propostas_hvc')
                        .select('*')
                        .eq('status', 'Aprovada');
                    
                    propostas = result.data;
                    error = result.error;
                    
                    // Adiciona dados padrão para clientes
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

// Renderizar propostas na lista (MELHORADA)
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
                    
                    // Verifica se esta proposta estava selecionada
                    const estaSelecionada = propostasSelecionadas.has(proposta.id);
                    
                   div.innerHTML = `
                        <input type="checkbox" id="prop-${proposta.id}" value="${proposta.id}" 
                       onchange="atualizarSelecaoPropostasSeguro(this)" ${estaSelecionada ? 'checked' : ''}>
                        <div class="proposta-info">
                            <strong>${numeroProposta}</strong> - ${clienteNome}
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

        // Atualiza campos baseados nas seleções após renderizar
        atualizarCamposSelecao();

    } catch (error) {
        console.error('Erro ao renderizar propostas:', error);
        mostrarMensagemErro('Erro ao exibir propostas.');
    }
}

// Filtrar propostas
function filtrarPropostas() {
    try {
        // PRIMEIRO: Capturar seleções atuais
        capturarSelecoes();
        
        const filtro = document.getElementById('filtro-propostas')?.value?.toLowerCase() || '';
        
        if (!filtro) {
            renderizarPropostas(propostasDisponiveis);
            return;
        }

        const propostasFiltradas = propostasDisponiveis.filter(proposta => {
            const numero = (proposta.numero_proposta || '').toLowerCase();
            const cliente = (proposta.clientes_hvc?.nome || proposta.cliente_nome || '').toLowerCase();
            return numero.includes(filtro) || cliente.includes(filtro);
        });

        renderizarPropostas(propostasFiltradas);
    } catch (error) {
        console.error('Erro ao filtrar propostas:', error);
    }
}

// Atualizar seleção de propostas
function atualizarSelecaoPropostas() {
    try {
        // Atualiza o Set de seleções baseado nos checkboxes VISÍVEIS
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
        
        // Primeiro, remove da seleção as propostas que não estão mais visíveis
        const idsVisiveis = new Set();
        checkboxes.forEach(checkbox => {
            idsVisiveis.add(parseInt(checkbox.value));
        });
        
        // Remove do Set apenas as propostas que não estão mais visíveis
        const idsParaRemover = [];
        propostasSelecionadas.forEach(id => {
            if (!idsVisiveis.has(id)) {
                idsParaRemover.push(id);
            }
        });
        idsParaRemover.forEach(id => propostasSelecionadas.delete(id));
        
        // Atualiza o Set baseado nos checkboxes visíveis
        checkboxes.forEach(checkbox => {
            const id = parseInt(checkbox.value);
            if (checkbox.checked) {
                propostasSelecionadas.add(id);
            } else {
                propostasSelecionadas.delete(id);
            }
        });

        // Atualiza os campos visuais
        atualizarCamposSelecao();

    } catch (error) {
        console.error('Erro ao atualizar seleção de propostas:', error);
    }
}


            // Capturar seleções atuais antes de renderizar
            function capturarSelecoes() {
                try {
                    const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
                    propostasSelecionadas.clear();
                    
                    checkboxes.forEach(checkbox => {
                        const id = parseInt(checkbox.value);
                        if (!isNaN(id)) {
                            propostasSelecionadas.add(id);
                        }
                    });
                } catch (error) {
                    console.error('Erro ao capturar seleções:', error);
                }
            }
            
            // Versão segura que não limpa todas as seleções
            function atualizarSelecaoPropostasSeguro(checkbox) {
                try {
                    const id = parseInt(checkbox.value);
                    if (isNaN(id)) return;
                    
                    if (checkbox.checked) {
                        propostasSelecionadas.add(id);
                    } else {
                        propostasSelecionadas.delete(id);
                    }
                    
                    // Atualiza os campos visuais
                    atualizarCamposSelecao();
                } catch (error) {
                    console.error('Erro ao atualizar seleção segura:', error);
                }
            }


// Atualizar campos baseados nas seleções (NOVA FUNÇÃO)
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

        // Pega o cliente da primeira proposta
        const primeiraPropostaDiv = checkboxes[0].closest('.proposta-item');
        const cliente = primeiraPropostaDiv?.dataset?.cliente || '';
        clienteField.value = cliente;

        // Soma os valores das propostas selecionadas
        let valorTotal = 0;
        checkboxes.forEach(checkbox => {
            const propostaDiv = checkbox.closest('.proposta-item');
            const valor = parseFloat(propostaDiv?.dataset?.valor || 0);
            if (!isNaN(valor)) {
                valorTotal += valor;
            }
        });

        valorTotalField.value = formatarMoeda(valorTotal);

        // Atualiza classes visuais
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

// Definir próximo número de obra
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


// Formatação de número de obra
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

// Formatação de valores monetários
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

// Converter valor monetário para número
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

// Adicionar obra (ULTRA ROBUSTA)
async function adicionarObra() {
    try {
        const numeroObra = document.getElementById('numero-obra')?.value?.trim();
        const nomeObra = document.getElementById('nome-obra')?.value?.trim();
        const observacoes = document.getElementById('observacoes-obra')?.value?.trim();

        // Validações
        if (!numeroObra) {
            alert('Preencha o número da obra.');
            return;
        }

        if (!nomeObra) {
            alert('Preencha o nome da obra.');
            return;
        }

        // Pega propostas selecionadas
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            alert('Selecione pelo menos uma proposta.');
            return;
        }

        // Verifica se o número já existe
        try {
            const { data: obraExistente, error: verificacaoError } = await supabase
                .from('obras_hvc')
                .select('id')
                .eq('numero_obra', numeroObra)
                .maybeSingle();

            if (verificacaoError) {
                console.warn('Erro na verificação de obra existente:', verificacaoError);
            }

            if (obraExistente) {
                alert('Número de obra já existe. Escolha outro número.');
                return;
            }
        } catch (verificacaoError) {
            console.warn('Erro ao verificar obra existente:', verificacaoError);
        }

        // Salva a obra
        const { data: obra, error: obraError } = await supabase
            .from('obras_hvc')
            .insert({
                numero_obra: numeroObra,
                nome: nomeObra,
                observacoes: observacoes || null,
                status: 'a_iniciar'
            })
            .select()
            .single();

        if (obraError) throw obraError;

        // Associa as propostas à obra
        const propostasObra = Array.from(checkboxes).map(checkbox => ({
            obra_id: obra.id,
            proposta_id: parseInt(checkbox.value)
        })).filter(item => !isNaN(item.proposta_id));

        if (propostasObra.length > 0) {
            try {
                const { error: propostasError } = await supabase
                    .from('propostas_obra_hvc')
                    .insert(propostasObra);

                if (propostasError) {
                    console.warn('Erro ao associar propostas:', propostasError);
                }
            } catch (propostasError) {
                console.warn('Erro ao inserir propostas da obra:', propostasError);
            }
        }

        alert('Obra adicionada com sucesso!');
        limparFormulario();
        await carregarObras();
        await definirProximoNumero();

    } catch (error) {
        console.error('Erro ao adicionar obra:', error);
        alert('Erro ao adicionar obra: ' + (error.message || 'Erro desconhecido'));
    }
}

// Carregar obras (ULTRA ROBUSTA)
async function carregarObras() {
    try {
        console.log('Carregando obras...');
        
        // Primeira tentativa: consulta completa com relacionamentos
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
            
            // Segunda tentativa: consulta básica
            try {
                const result = await supabase
                    .from('obras_hvc')
                    .select('*')
                    .order('numero_obra', { ascending: false });
                
                obras = result.data;
                error = result.error;
                
                // Para cada obra, tenta buscar propostas separadamente
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
                // Calcular valores da obra
                const valores = await calcularValoresObra(obra.id);
                
                const cliente = obra.propostas_obra_hvc?.[0]?.propostas_hvc?.clientes_hvc?.nome || 
                               obra.propostas_obra_hvc?.[0]?.propostas_hvc?.cliente_nome || 'N/A';
                
                const valorTotal = obra.propostas_obra_hvc?.reduce((total, po) => 
                    total + (po.propostas_hvc?.valor || 0), 0) || 0;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${obra.numero_obra || 'N/A'}</td>
                    <td>${obra.nome || 'N/A'}</td>
                    <td>${cliente}</td>
                    <td class="valor-positivo">${formatarMoeda(valorTotal)}</td>
                    <td class="valor-positivo">${formatarMoeda(valores.valorTotalMedido)}</td>
                    <td class="valor-positivo">${formatarMoeda(valores.valorTotalRecebido)}</td>
                    <td class="${valores.valorMedidoNaoRecebido > 0 ? 'valor-negativo' : 'valor-neutro'}">${formatarMoeda(valores.valorMedidoNaoRecebido)}</td>
                    <td class="${valores.valorEmAberto > 0 ? 'valor-negativo' : 'valor-positivo'}">${formatarMoeda(valores.valorEmAberto)}</td>
                    <td><span class="status-badge status-${obra.status?.replace('_', '-') || 'indefinido'}">${formatarStatus(obra.status)}</span></td>
                    <td>
                        <button class="btn btn-primary btn-small" onclick="window.abrirModalServicos(${obra.id}, '${obra.numero_obra}')">
                            <i class="fas fa-tools"></i> Gerenciar
                        </button>
                    </td>
                    <td>
                        <button class="btn btn-warning btn-small" onclick="window.abrirModalMedicoes(${obra.id}, '${obra.numero_obra}')">
                            <i class="fas fa-ruler"></i> Gerenciar
                        </button>
                    </td>
                    <td>
                        <button class="btn btn-danger btn-small" onclick="window.excluirObra(${obra.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            } catch (obraError) {
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

// Calcular valores da obra (ULTRA ROBUSTA)
async function calcularValoresObra(obraId) {
    try {
        if (!obraId) {
            return { valorTotalMedido: 0, valorTotalRecebido: 0, valorMedidoNaoRecebido: 0, valorEmAberto: 0 };
        }

        // Buscar medições da obra
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

        // Buscar valor total das propostas
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

        // Buscar recebimentos do fluxo de caixa
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

        // Cálculos seguros
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

// Abrir modal de serviços
async function abrirModalServicos(obraId, numeroObra) {
    try {
        if (!obraId || !numeroObra) {
            alert('Dados da obra inválidos.');
            return;
        }

        obraAtual = obraId;
        
        const modalElement = document.getElementById('modal-servicos-obra');
        const modal = document.getElementById('modal-servicos');
        
        if (!modalElement || !modal) {
            alert('Modal de serviços não encontrado.');
            return;
        }

        modalElement.textContent = numeroObra;
        modal.style.display = 'block';
        await carregarServicos();
    } catch (error) {
        console.error('Erro ao abrir modal de serviços:', error);
        alert('Erro ao abrir gerenciamento de serviços.');
    }
}

// Carregar serviços
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

        const container = document.getElementById('servicos-list');
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
                    ${servico.data_inicio ? `<br><small>Iniciado: ${formatarData(servico.data_inicio)}</small>` : ''}
                    ${servico.data_conclusao ? `<br><small>Concluído: ${formatarData(servico.data_conclusao)}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn ${servico.data_inicio ? 'btn-warning' : 'btn-success'} btn-small" 
                            onclick="window.toggleInicioServico(${servico.id}, ${!!servico.data_inicio})">
                        ${servico.data_inicio ? 'Desmarcar Início' : 'Iniciar'}
                    </button>
                    <button class="btn ${servico.data_conclusao ? 'btn-warning' : 'btn-success'} btn-small" 
                            onclick="window.toggleConclusaoServico(${servico.id}, ${!!servico.data_conclusao})">
                        ${servico.data_conclusao ? 'Desmarcar Conclusão' : 'Concluir'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="window.excluirServico(${servico.id})">
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
        const container = document.getElementById('servicos-list');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar serviços</div>';
        }
    }
}


// Adicionar serviço
async function adicionarServico() {
    try {
        const descricaoField = document.getElementById('nome-servico');
        if (!descricaoField) {
            alert('Campo de descrição não encontrado.');
            return;
        }

        const descricao = descricaoField.value.trim();
        
        if (!descricao) {
            alert('Digite o nome do serviço.');
            descricaoField.focus();
            return;
        }

        if (!obraAtual) {
            alert('Nenhuma obra selecionada.');
            return;
        }

        const { error } = await supabase
            .from('servicos_obra_hvc')
            .insert({
                obra_id: obraAtual,
                descricao: descricao
            });

        if (error) throw error;

        descricaoField.value = '';
        await carregarServicos();

    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        alert('Erro ao adicionar serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

// Toggle início do serviço
async function toggleInicioServico(servicoId, jaIniciado) {
    try {
        if (!servicoId) {
            alert('ID do serviço inválido.');
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
        alert('Erro ao atualizar serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

// Toggle conclusão do serviço
async function toggleConclusaoServico(servicoId, jaConcluido) {
    try {
        if (!servicoId) {
            alert('ID do serviço inválido.');
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
        alert('Erro ao atualizar serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

// Excluir serviço
async function excluirServico(servicoId) {
    try {
        if (!servicoId) {
            alert('ID do serviço inválido.');
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

    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        alert('Erro ao excluir serviço: ' + (error.message || 'Erro desconhecido'));
    }
}

// Abrir modal de medições
async function abrirModalMedicoes(obraId, numeroObra) {
    try {
        if (!obraId || !numeroObra) {
            alert('Dados da obra inválidos.');
            return;
        }

        obraAtual = obraId;
        
        const modalElement = document.getElementById('modal-medicoes-obra');
        const modal = document.getElementById('modal-medicoes');
        
        if (!modalElement || !modal) {
            alert('Modal de medições não encontrado.');
            return;
        }

        modalElement.textContent = numeroObra;
        modal.style.display = 'block';
        await carregarMedicoes();
        await definirProximoNumeroMedicao(numeroObra);
    } catch (error) {
        console.error('Erro ao abrir modal de medições:', error);
        alert('Erro ao abrir gerenciamento de medições.');
    }
}

// Definir próximo número de medição
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

// Carregar medições
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

        const container = document.getElementById('medicoes-list');
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
                    <small>Data: ${formatarData(medicao.data_medicao)}</small><br>
                    <small>Valor: ${formatarMoeda(medicao.valor || 0)}</small><br>
                    <small>Status: ${formatarStatusMedicao(medicao.status)}</small><br>
                    ${medicao.retencao_adicao ? `<small>Ret./Ad.: ${formatarMoeda(medicao.retencao_adicao)}</small><br>` : ''}
                    <small>Pago: ${medicao.pago ? 'Sim' : 'Não'}</small>
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-small" onclick="window.editarMedicao(${medicao.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-warning btn-small" onclick="window.abrirModalServicosMedicao(${medicao.id}, '${medicao.numero_medicao}')">
                        <i class="fas fa-list"></i> Serviços
                    </button>
                    <button class="btn btn-danger btn-small" onclick="window.excluirMedicao(${medicao.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error('Erro ao carregar medições:', error);
        const container = document.getElementById('medicoes-list');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar medições</div>';
        }
    }
}

// Adicionar medição
async function adicionarMedicao() {
    try {
        const numeroMedicao = document.getElementById('numero-medicao')?.value?.trim();
        const dataMedicao = document.getElementById('data-medicao')?.value;
        const valorMedicao = document.getElementById('valor-medicao')?.value;
        const statusMedicao = document.getElementById('status-medicao')?.value;
        const retencaoAdicao = document.getElementById('retencao-adicao')?.value;

        // Validações
        if (!numeroMedicao || !dataMedicao) {
            alert('Preencha o número e a data da medição.');
            return;
        }

        if (!obraAtual) {
            alert('Nenhuma obra selecionada.');
            return;
        }

        // Converte valores monetários
        const valorNumerico = converterValorMonetario(valorMedicao);
        const retencaoNumerico = converterValorMonetario(retencaoAdicao);

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .insert({
                obra_id: obraAtual,
                numero_medicao: numeroMedicao,
                data_medicao: dataMedicao,
                valor: valorNumerico,
                status: statusMedicao || 'vai_ser_enviada',
                retencao_adicao: retencaoNumerico || null,
                pago: false
            });

        if (error) throw error;

        // Limpa formulário
        limparFormularioMedicao();
        await carregarMedicoes();
        
        const numeroObraElement = document.getElementById('modal-medicoes-obra');
        if (numeroObraElement) {
            await definirProximoNumeroMedicao(numeroObraElement.textContent);
        }

    } catch (error) {
        console.error('Erro ao adicionar medição:', error);
        alert('Erro ao adicionar medição: ' + (error.message || 'Erro desconhecido'));
    }
}

// Limpar formulário de medição
function limparFormularioMedicao() {
    try {
        const campos = ['data-medicao', 'valor-medicao', 'retencao-adicao'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) campo.value = '';
        });

        const statusField = document.getElementById('status-medicao');
        if (statusField) statusField.value = 'vai_ser_enviada';
    } catch (error) {
        console.error('Erro ao limpar formulário de medição:', error);
    }
}

// Editar medição
async function editarMedicao(medicaoId) {
    try {
        if (!medicaoId) {
            alert('ID da medição inválido.');
            return;
        }

        const { data: medicao, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('id', medicaoId)
            .single();

        if (error) throw error;

        if (!medicao) {
            alert('Medição não encontrada.');
            return;
        }

        // Preenche o formulário com os dados da medição
        const campos = {
            'numero-medicao': medicao.numero_medicao || '',
            'data-medicao': medicao.data_medicao || '',
            'valor-medicao': formatarMoeda(medicao.valor || 0),
            'status-medicao': medicao.status || 'vai_ser_enviada',
            'retencao-adicao': medicao.retencao_adicao ? formatarMoeda(medicao.retencao_adicao) : ''
        };

        Object.entries(campos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.value = valor;
        });

        // Muda o botão para modo edição
        const btnAdicionar = document.querySelector('#modal-medicoes .btn-success');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
            btnAdicionar.onclick = () => salvarEdicaoMedicao(medicaoId);
        }

    } catch (error) {
        console.error('Erro ao carregar medição para edição:', error);
        alert('Erro ao carregar medição: ' + (error.message || 'Erro desconhecido'));
    }
}

// Salvar edição da medição
async function salvarEdicaoMedicao(medicaoId) {
    try {
        if (!medicaoId) {
            alert('ID da medição inválido.');
            return;
        }

        const dataMedicao = document.getElementById('data-medicao')?.value;
        const valorMedicao = document.getElementById('valor-medicao')?.value;
        const statusMedicao = document.getElementById('status-medicao')?.value;
        const retencaoAdicao = document.getElementById('retencao-adicao')?.value;

        if (!dataMedicao) {
            alert('Preencha a data da medição.');
            return;
        }

        // Converte valores monetários
        const valorNumerico = converterValorMonetario(valorMedicao);
        const retencaoNumerico = converterValorMonetario(retencaoAdicao);

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .update({
                data_medicao: dataMedicao,
                valor: valorNumerico,
                status: statusMedicao || 'vai_ser_enviada',
                retencao_adicao: retencaoNumerico || null
            })
            .eq('id', medicaoId);

        if (error) throw error;

        // Restaura o botão para modo adicionar
        restaurarBotaoAdicionar();

        // Limpa formulário
        limparFormularioMedicao();
        await carregarMedicoes();
        
        const numeroObraElement = document.getElementById('modal-medicoes-obra');
        if (numeroObraElement) {
            await definirProximoNumeroMedicao(numeroObraElement.textContent);
        }

        alert('Medição atualizada com sucesso!');

    } catch (error) {
        console.error('Erro ao salvar edição da medição:', error);
        alert('Erro ao salvar alterações: ' + (error.message || 'Erro desconhecido'));
    }
}

// Restaurar botão para modo adicionar
function restaurarBotaoAdicionar() {
    try {
        const btnSalvar = document.querySelector('#modal-medicoes .btn-success');
        if (btnSalvar) {
            btnSalvar.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
            btnSalvar.onclick = adicionarMedicao;
        }
    } catch (error) {
        console.error('Erro ao restaurar botão:', error);
    }
}

// Excluir medição
async function excluirMedicao(medicaoId) {
    try {
        if (!medicaoId) {
            alert('ID da medição inválido.');
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

    } catch (error) {
        console.error('Erro ao excluir medição:', error);
        alert('Erro ao excluir medição: ' + (error.message || 'Erro desconhecido'));
    }
}


// Abrir modal de serviços da medição
async function abrirModalServicosMedicao(medicaoId, numeroMedicao) {
    try {
        if (!medicaoId || !numeroMedicao) {
            alert('Dados da medição inválidos.');
            return;
        }

        medicaoAtual = medicaoId;
        
        const modalElement = document.getElementById('modal-servicos-medicao-numero');
        const modal = document.getElementById('modal-servicos-medicao');
        
        if (!modalElement || !modal) {
            alert('Modal de serviços da medição não encontrado.');
            return;
        }

        modalElement.textContent = numeroMedicao;
        modal.style.display = 'block';
        await carregarServicosParaMedicao();
        await carregarServicosMedicao();
    } catch (error) {
        console.error('Erro ao abrir modal de serviços da medição:', error);
        alert('Erro ao abrir gerenciamento de serviços da medição.');
    }
}

// Carregar serviços disponíveis para a medição
async function carregarServicosParaMedicao() {
    try {
        if (!obraAtual) {
            console.warn('Nenhuma obra selecionada');
            return;
        }

        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual);

        if (error) throw error;

        const select = document.getElementById('servico-medicao');
        if (!select) {
            console.warn('Select de serviços não encontrado');
            return;
        }

        select.innerHTML = '<option value="">Selecione um serviço</option>';

        if (servicos && servicos.length > 0) {
            servicos.forEach(servico => {
                if (servico) {
                    const option = document.createElement('option');
                    option.value = servico.id;
                    option.textContent = servico.descricao || 'Sem descrição';
                    select.appendChild(option);
                }
            });
        }

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

// Carregar serviços da medição
async function carregarServicosMedicao() {
    try {
        if (!medicaoAtual) {
            console.warn('Nenhuma medição selecionada');
            return;
        }

        const { data: servicosMedicao, error } = await supabase
            .from('servicos_medicao_hvc')
            .select(`
                *,
                servicos_obra_hvc (descricao)
            `)
            .eq('medicao_id', medicaoAtual);

        if (error) throw error;

        const container = document.getElementById('servicos-medicao-list');
        if (!container) {
            console.warn('Container de serviços da medição não encontrado');
            return;
        }

        container.innerHTML = '';

        if (!servicosMedicao || servicosMedicao.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Nenhum serviço adicionado à medição</div>';
            return;
        }

        servicosMedicao.forEach(sm => {
            if (!sm || !sm.servicos_obra_hvc) return;

            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <strong>${sm.servicos_obra_hvc.descricao || 'Sem descrição'}</strong><br>
                    ${sm.observacoes ? `<small>Obs: ${sm.observacoes}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn btn-danger btn-small" onclick="window.excluirServicoMedicao(${sm.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error('Erro ao carregar serviços da medição:', error);
        const container = document.getElementById('servicos-medicao-list');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar serviços da medição</div>';
        }
    }
}

// Adicionar serviço à medição
async function adicionarServicoMedicao() {
    try {
        const servicoSelect = document.getElementById('servico-medicao');
        const observacoesField = document.getElementById('observacoes-servico-medicao');

        if (!servicoSelect || !observacoesField) {
            alert('Elementos do formulário não encontrados.');
            return;
        }

        const servicoId = servicoSelect.value;
        const observacoes = observacoesField.value.trim();

        if (!servicoId) {
            alert('Selecione um serviço.');
            servicoSelect.focus();
            return;
        }

        if (!medicaoAtual) {
            alert('Nenhuma medição selecionada.');
            return;
        }

        const { error } = await supabase
            .from('servicos_medicao_hvc')
            .insert({
                medicao_id: medicaoAtual,
                servico_id: parseInt(servicoId),
                observacoes: observacoes || null
            });

        if (error) throw error;

        servicoSelect.value = '';
        observacoesField.value = '';
        await carregarServicosMedicao();

    } catch (error) {
        console.error('Erro ao adicionar serviço à medição:', error);
        alert('Erro ao adicionar serviço à medição: ' + (error.message || 'Erro desconhecido'));
    }
}

// Excluir serviço da medição
async function excluirServicoMedicao(servicoMedicaoId) {
    try {
        if (!servicoMedicaoId) {
            alert('ID do serviço da medição inválido.');
            return;
        }

        if (!confirm('Tem certeza que deseja remover este serviço da medição?')) {
            return;
        }

        const { error } = await supabase
            .from('servicos_medicao_hvc')
            .delete()
            .eq('id', servicoMedicaoId);

        if (error) throw error;

        await carregarServicosMedicao();

    } catch (error) {
        console.error('Erro ao excluir serviço da medição:', error);
        alert('Erro ao excluir serviço da medição: ' + (error.message || 'Erro desconhecido'));
    }
}

// Atualizar status da obra
async function atualizarStatusObra() {
    try {
        if (!obraAtual) {
            console.warn('Nenhuma obra selecionada para atualizar status');
            return;
        }

        // Buscar todos os serviços da obra
        const { data: servicos, error: servicosError } = await supabase
            .from('servicos_obra_hvc')
            .select('data_inicio, data_conclusao')
            .eq('obra_id', obraAtual);

        if (servicosError) throw servicosError;

        let novoStatus = 'a_iniciar';

        if (servicos && servicos.length > 0) {
            const servicosIniciados = servicos.filter(s => s?.data_inicio);
            const servicosConcluidos = servicos.filter(s => s?.data_conclusao);

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
    try {
        if (!obraId) {
            alert('ID da obra inválido.');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.')) {
            return;
        }

        const { error } = await supabase
            .from('obras_hvc')
            .delete()
            .eq('id', obraId);

        if (error) throw error;

        alert('Obra excluída com sucesso!');
        await carregarObras();

    } catch (error) {
        console.error('Erro ao excluir obra:', error);
        alert('Erro ao excluir obra: ' + (error.message || 'Erro desconhecido'));
    }
}

// Fechar modal
function fecharModal(modalId) {
    try {
        if (!modalId) {
            console.warn('ID do modal não fornecido');
            return;
        }

        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal ${modalId} não encontrado`);
            return;
        }

        modal.style.display = 'none';
        
        // Se for o modal de medições, restaura o botão para modo adicionar
        if (modalId === 'modal-medicoes') {
            restaurarBotaoAdicionar();
            limparFormularioMedicao();
        }

        // Limpa variáveis globais se necessário
        if (modalId === 'modal-servicos-medicao') {
            medicaoAtual = null;
        }

    } catch (error) {
        console.error('Erro ao fechar modal:', error);
    }
}

// Limpar formulário principal
function limparFormulario() {
    try {
        // Limpa campos específicos
        const campos = ['numero-obra', 'nome-obra', 'cliente-obra', 'valor-total-obra', 'observacoes-obra'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) campo.value = '';
        });

        // Limpa filtro de propostas
        const filtro = document.getElementById('filtro-propostas');
        if (filtro) filtro.value = '';

        // Desmarca todas as propostas
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const item = checkbox.closest('.proposta-item');
            if (item) item.classList.remove('selected');
        });

        // Redefine próximo número
        definirProximoNumero().catch(error => {
            console.error('Erro ao redefinir próximo número:', error);
        });

    } catch (error) {
        console.error('Erro ao limpar formulário:', error);
    }
}

// Funções de formatação
function formatarMoeda(valor) {
    try {
        const numero = parseFloat(valor);
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
    try {
        const statusMap = {
            'a_iniciar': 'À Iniciar',
            'em_andamento': 'Em Andamento',
            'concluida': 'Concluída',
            'pagamento_pendente': 'Pagamento Pendente'
        };
        return statusMap[status] || (status || 'Indefinido');
    } catch (error) {
        console.error('Erro ao formatar status:', error);
        return 'Indefinido';
    }
}

function formatarStatusServico(servico) {
    try {
        if (!servico) return 'Indefinido';
        
        if (servico.data_conclusao) return 'Concluído';
        if (servico.data_inicio) return 'Iniciado';
        return 'À Iniciar';
    } catch (error) {
        console.error('Erro ao formatar status do serviço:', error);
        return 'Indefinido';
    }
}

function formatarStatusMedicao(status) {
    try {
        const statusMap = {
            'vai_ser_enviada': 'Vai ser enviada',
            'ja_foi_enviada': 'Já foi enviada',
            'ja_foi_recebida': 'Já foi recebida'
        };
        return statusMap[status] || (status || 'Indefinido');
    } catch (error) {
        console.error('Erro ao formatar status da medição:', error);
        return 'Indefinido';
    }
}

// Exportar funções globais
window.adicionarObra = adicionarObra;
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
window.atualizarSelecaoPropostas = atualizarSelecaoPropostas;

// Exportar funções utilitárias
window.formatarMoeda = formatarMoeda;
window.formatarData = formatarData;
window.converterValorMonetario = converterValorMonetario;

// Log de inicialização
console.log('obras-hvc.js carregado com sucesso - Versão Completa e Robusta');

// Fechar modais ao clicar fora
window.onclick = function(event) {
    try {
        const modals = ['modal-servicos', 'modal-medicoes', 'modal-servicos-medicao'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && event.target === modal) {
                fecharModal(modalId);
            }
        });
    } catch (error) {
        console.error('Erro no gerenciamento de clique fora do modal:', error);
    }
};

