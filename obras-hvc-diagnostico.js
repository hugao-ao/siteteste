// obras-hvc-diagnostico.js - Versão com diagnóstico completo

import { injectSidebar } from './sidebar.js';
import { supabase } from './supabase.js';

// Variáveis globais
let obraAtual = null;
let medicaoAtual = null;
let proximoNumeroObra = 1;
let propostasDisponiveis = [];

// Função de diagnóstico
function log(mensagem, dados = null) {
    console.log(`[DIAGNÓSTICO] ${mensagem}`, dados || '');
}

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    try {
        log('Iniciando aplicação...');
        
        // Verifica autenticação
        const nivel = sessionStorage.getItem('nivel');
        const projeto = sessionStorage.getItem('projeto');
        
        log('Verificando autenticação', { nivel, projeto });
        
        if (!nivel || (nivel !== 'admin' && projeto !== 'Hvc')) {
            alert('Acesso negado. Esta página é restrita ao projeto HVC.');
            window.location.href = 'index.html';
            return;
        }

        // Injeta sidebar
        log('Injetando sidebar...');
        await injectSidebar('main-content-obras-hvc');

        // Testa conexão com Supabase
        log('Testando conexão com Supabase...');
        await testarConexaoSupabase();

        // Inicializa a página
        log('Inicializando página...');
        await inicializarPagina();
        
        // Event listeners
        log('Configurando event listeners...');
        setupEventListeners();
        
        log('Aplicação inicializada com sucesso!');
    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao inicializar a página. Recarregue e tente novamente.');
    }
});

// Testar conexão com Supabase
async function testarConexaoSupabase() {
    try {
        log('Testando consulta básica no Supabase...');
        
        // Testa consulta simples
        const { data, error } = await supabase
            .from('propostas_hvc')
            .select('count')
            .limit(1);
        
        if (error) {
            log('Erro na consulta de teste:', error);
            throw error;
        }
        
        log('Conexão com Supabase OK');
        return true;
    } catch (error) {
        log('Falha na conexão com Supabase:', error);
        throw error;
    }
}

// Configurar event listeners
function setupEventListeners() {
    try {
        log('Configurando event listeners...');
        
        // Event listener para filtro de propostas
        const propostasFilter = document.getElementById('propostas-filter');
        if (propostasFilter) {
            propostasFilter.addEventListener('input', filtrarPropostas);
            log('Event listener do filtro configurado');
        } else {
            log('AVISO: Campo propostas-filter não encontrado');
        }

        // Event listeners para formatação
        const numeroObra = document.getElementById('numero-obra');
        const valorMedicao = document.getElementById('valor-medicao');
        const retencaoAdicao = document.getElementById('retencao-adicao');

        if (numeroObra) {
            numeroObra.addEventListener('input', formatarNumeroObra);
            log('Event listener do número da obra configurado');
        } else {
            log('AVISO: Campo numero-obra não encontrado');
        }
        
        if (valorMedicao) {
            valorMedicao.addEventListener('input', formatarValorMonetario);
            log('Event listener do valor da medição configurado');
        }
        
        if (retencaoAdicao) {
            retencaoAdicao.addEventListener('input', formatarValorMonetario);
            log('Event listener da retenção/adição configurado');
        }
        
        log('Event listeners configurados com sucesso');
    } catch (error) {
        console.error('Erro ao configurar event listeners:', error);
    }
}

// Inicializar página
async function inicializarPagina() {
    try {
        log('Iniciando carregamento de dados...');
        
        await carregarPropostasAprovadas();
        await carregarObras();
        await definirProximoNumero();
        
        log('Dados carregados com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
        mostrarMensagemErro('Erro ao carregar alguns dados. Algumas funcionalidades podem estar limitadas.');
    }
}

// Mostrar mensagem de erro na interface
function mostrarMensagemErro(mensagem) {
    try {
        log('Mostrando mensagem de erro:', mensagem);
        const container = document.getElementById('propostas-list');
        if (container) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); border-radius: 8px; margin: 10px 0;">${mensagem}</div>`;
        }
    } catch (error) {
        console.error('Erro ao mostrar mensagem:', error);
    }
}

// Carregar propostas aprovadas (COM DIAGNÓSTICO)
async function carregarPropostasAprovadas() {
    try {
        log('Iniciando carregamento de propostas...');
        
        // Primeira tentativa: consulta básica para verificar se há propostas
        log('Verificando se há propostas na tabela...');
        const { data: todasPropostas, error: erroTodas } = await supabase
            .from('propostas_hvc')
            .select('id, status')
            .limit(10);
        
        if (erroTodas) {
            log('Erro ao verificar propostas:', erroTodas);
            throw erroTodas;
        }
        
        log('Propostas encontradas na tabela:', todasPropostas);
        
        if (!todasPropostas || todasPropostas.length === 0) {
            log('PROBLEMA: Nenhuma proposta encontrada na tabela propostas_hvc');
            mostrarMensagemErro('Nenhuma proposta encontrada na base de dados. Cadastre propostas primeiro.');
            return;
        }
        
        // Verificar quantas têm status 'Aprovada'
        const aprovadas = todasPropostas.filter(p => p.status === 'Aprovada');
        log('Propostas com status aprovada:', aprovadas);
        
        if (aprovadas.length === 0) {
            log('PROBLEMA: Nenhuma proposta com status "aprovada" encontrada');
            const statusEncontrados = [...new Set(todasPropostas.map(p => p.status))];
            log('Status encontrados:', statusEncontrados);
            mostrarMensagemErro(`Nenhuma proposta aprovada encontrada. Status disponíveis: ${statusEncontrados.join(', ')}`);
            return;
        }
        
        // Agora tenta carregar as propostas aprovadas com detalhes
        log('Carregando propostas aprovadas com detalhes...');
        
        let propostas = null;
        let error = null;
        
        try {
            log('Tentativa 1: Consulta com relacionamento...');
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
            log('Resultado da tentativa 1:', { propostas, error });
        } catch (relacionamentoError) {
            log('Erro na consulta com relacionamento:', relacionamentoError);
            
            // Segunda tentativa: consulta sem relacionamento
            try {
                log('Tentativa 2: Consulta sem relacionamento...');
                const result = await supabase
                    .from('propostas_hvc')
                    .select('id, numero_proposta, valor, cliente_id')
                    .eq('status', 'Aprovada');
                
                propostas = result.data;
                error = result.error;
                log('Resultado da tentativa 2:', { propostas, error });
                
                // Se conseguiu carregar, tenta buscar nomes dos clientes separadamente
                if (propostas && propostas.length > 0) {
                    log('Buscando nomes dos clientes separadamente...');
                    for (let proposta of propostas) {
                        if (proposta.cliente_id) {
                            try {
                                const { data: cliente } = await supabase
                                    .from('clientes_hvc')
                                    .select('nome')
                                    .eq('id', proposta.cliente_id)
                                    .single();
                                
                                proposta.clientes_hvc = cliente ? { nome: cliente.nome } : { nome: 'Cliente não encontrado' };
                                log(`Cliente para proposta ${proposta.id}:`, proposta.clientes_hvc);
                            } catch (clienteError) {
                                log('Erro ao buscar cliente:', clienteError);
                                proposta.clientes_hvc = { nome: 'Cliente não encontrado' };
                            }
                        } else {
                            proposta.clientes_hvc = { nome: 'Sem cliente' };
                        }
                    }
                }
            } catch (semRelacionamentoError) {
                log('Erro na consulta sem relacionamento:', semRelacionamentoError);
                
                // Terceira tentativa: consulta básica
                try {
                    log('Tentativa 3: Consulta básica...');
                    const result = await supabase
                        .from('propostas_hvc')
                        .select('*')
                        .eq('status', 'Aprovada');
                    
                    propostas = result.data;
                    error = result.error;
                    log('Resultado da tentativa 3:', { propostas, error });
                    
                    // Adiciona dados padrão para clientes
                    if (propostas && propostas.length > 0) {
                        propostas.forEach(proposta => {
                            if (!proposta.clientes_hvc) {
                                proposta.clientes_hvc = { nome: 'Cliente não especificado' };
                            }
                        });
                    }
                } catch (basicError) {
                    log('Erro na consulta básica:', basicError);
                    error = basicError;
                    propostas = [];
                }
            }
        }

        if (error) {
            log('Erro final ao carregar propostas:', error);
            propostasDisponiveis = [];
            mostrarMensagemErro('Erro ao carregar propostas. Verifique a configuração do banco de dados.');
            return;
        }

        log('Propostas carregadas com sucesso:', propostas);
        propostasDisponiveis = propostas || [];
        renderizarPropostas(propostasDisponiveis);

    } catch (error) {
        log('Erro geral ao carregar propostas:', error);
        propostasDisponiveis = [];
        mostrarMensagemErro('Erro ao carregar propostas aprovadas. Tente recarregar a página.');
    }
}

// Renderizar propostas na lista (COM DIAGNÓSTICO)
function renderizarPropostas(propostas) {
    try {
        log('Renderizando propostas:', propostas);
        
        const container = document.getElementById('propostas-list');
        if (!container) {
            log('ERRO: Container propostas-list não encontrado');
            return;
        }

        container.innerHTML = '';

        if (!propostas || propostas.length === 0) {
            log('Nenhuma proposta para renderizar');
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Nenhuma proposta aprovada disponível</div>';
            return;
        }

        log(`Renderizando ${propostas.length} propostas...`);
        
        propostas.forEach((proposta, index) => {
            try {
                if (proposta) {
                    const clienteNome = proposta.clientes_hvc?.nome || proposta.cliente_nome || 'Cliente não especificado';
                    const numeroProposta = proposta.numero_proposta || `Proposta ${proposta.id}`;
                    const valor = proposta.valor || 0;

                    log(`Renderizando proposta ${index + 1}:`, { id: proposta.id, numeroProposta, clienteNome, valor });

                    const div = document.createElement('div');
                    div.className = 'proposta-item';
                    div.innerHTML = `
                        <input type="checkbox" id="prop-${proposta.id}" value="${proposta.id}" onchange="atualizarSelecaoPropostas()">
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
                log('Erro ao renderizar proposta:', propostaError, proposta);
            }
        });

        log('Propostas renderizadas com sucesso');

    } catch (error) {
        log('Erro ao renderizar propostas:', error);
        mostrarMensagemErro('Erro ao exibir propostas.');
    }
}

// Carregar obras (COM DIAGNÓSTICO)
async function carregarObras() {
    try {
        log('Carregando obras...');
        
        // Primeira tentativa: consulta completa com relacionamentos
        let obras = null;
        let error = null;
        
        try {
            log('Tentativa 1: Consulta com relacionamentos...');
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
            log('Resultado da consulta com relacionamentos:', { obras, error });
        } catch (relacionamentoError) {
            log('Erro na consulta com relacionamentos:', relacionamentoError);
            
            // Segunda tentativa: consulta básica
            try {
                log('Tentativa 2: Consulta básica...');
                const result = await supabase
                    .from('obras_hvc')
                    .select('*')
                    .order('numero_obra', { ascending: false });
                
                obras = result.data;
                error = result.error;
                log('Resultado da consulta básica:', { obras, error });
                
                // Para cada obra, tenta buscar propostas separadamente
                if (obras && obras.length > 0) {
                    log('Buscando propostas para cada obra...');
                    for (let obra of obras) {
                        obra.propostas_obra_hvc = [];
                        try {
                            const { data: propostas } = await supabase
                                .from('propostas_obra_hvc')
                                .select('propostas_hvc(*)')
                                .eq('obra_id', obra.id);
                            
                            if (propostas) {
                                obra.propostas_obra_hvc = propostas;
                                log(`Propostas para obra ${obra.id}:`, propostas);
                            }
                        } catch (propostasError) {
                            log('Erro ao buscar propostas da obra:', propostasError);
                        }
                    }
                }
            } catch (basicError) {
                log('Erro na consulta básica de obras:', basicError);
                error = basicError;
                obras = [];
            }
        }

        const tbody = document.getElementById('obras-list');
        if (!tbody) {
            log('ERRO: Elemento obras-list não encontrado');
            return;
        }

        tbody.innerHTML = '';

        if (error) {
            log('Erro ao carregar obras:', error);
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #ff4444;">Erro ao carregar obras</td></tr>';
            return;
        }

        if (!obras || obras.length === 0) {
            log('Nenhuma obra encontrada');
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #999;">Nenhuma obra cadastrada</td></tr>';
            return;
        }

        log(`Processando ${obras.length} obras...`);

        for (const obra of obras) {
            try {
                log(`Processando obra ${obra.id}:`, obra);
                
                // Calcular valores da obra
                const valores = await calcularValoresObra(obra.id);
                log(`Valores calculados para obra ${obra.id}:`, valores);
                
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
                log(`Obra ${obra.id} adicionada à tabela`);
            } catch (obraError) {
                log(`Erro ao processar obra ${obra.id}:`, obraError);
            }
        }

        log('Obras carregadas com sucesso');

    } catch (error) {
        log('Erro geral ao carregar obras:', error);
        const tbody = document.getElementById('obras-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: #ff4444;">Erro ao carregar obras</td></tr>';
        }
    }
}

// Abrir modal de serviços (COM DIAGNÓSTICO)
async function abrirModalServicos(obraId, numeroObra) {
    try {
        log('Abrindo modal de serviços:', { obraId, numeroObra });
        
        if (!obraId || !numeroObra) {
            log('ERRO: Dados da obra inválidos');
            alert('Dados da obra inválidos.');
            return;
        }

        obraAtual = obraId;
        
        const modalElement = document.getElementById('modal-servicos-obra');
        const modal = document.getElementById('modal-servicos');
        
        if (!modalElement) {
            log('ERRO: Elemento modal-servicos-obra não encontrado');
            alert('Elemento modal-servicos-obra não encontrado.');
            return;
        }
        
        if (!modal) {
            log('ERRO: Modal modal-servicos não encontrado');
            alert('Modal de serviços não encontrado.');
            return;
        }

        modalElement.textContent = numeroObra;
        modal.style.display = 'block';
        log('Modal de serviços aberto');
        
        await carregarServicos();
    } catch (error) {
        log('Erro ao abrir modal de serviços:', error);
        alert('Erro ao abrir gerenciamento de serviços.');
    }
}

// Abrir modal de medições (COM DIAGNÓSTICO)
async function abrirModalMedicoes(obraId, numeroObra) {
    try {
        log('Abrindo modal de medições:', { obraId, numeroObra });
        
        if (!obraId || !numeroObra) {
            log('ERRO: Dados da obra inválidos');
            alert('Dados da obra inválidos.');
            return;
        }

        obraAtual = obraId;
        
        const modalElement = document.getElementById('modal-medicoes-obra');
        const modal = document.getElementById('modal-medicoes');
        
        if (!modalElement) {
            log('ERRO: Elemento modal-medicoes-obra não encontrado');
            alert('Elemento modal-medicoes-obra não encontrado.');
            return;
        }
        
        if (!modal) {
            log('ERRO: Modal modal-medicoes não encontrado');
            alert('Modal de medições não encontrado.');
            return;
        }

        modalElement.textContent = numeroObra;
        modal.style.display = 'block';
        log('Modal de medições aberto');
        
        await carregarMedicoes();
        await definirProximoNumeroMedicao(numeroObra);
    } catch (error) {
        log('Erro ao abrir modal de medições:', error);
        alert('Erro ao abrir gerenciamento de medições.');
    }
}

// Funções básicas necessárias (versões simplificadas para diagnóstico)
function filtrarPropostas() { log('Filtrar propostas chamado'); }
function formatarNumeroObra() { log('Formatar número obra chamado'); }
function formatarValorMonetario() { log('Formatar valor monetário chamado'); }
async function definirProximoNumero() { log('Definir próximo número chamado'); }
async function calcularValoresObra() { return { valorTotalMedido: 0, valorTotalRecebido: 0, valorMedidoNaoRecebido: 0, valorEmAberto: 0 }; }
async function carregarServicos() { log('Carregar serviços chamado'); }
async function carregarMedicoes() { log('Carregar medições chamado'); }
async function definirProximoNumeroMedicao() { log('Definir próximo número medição chamado'); }
function atualizarSelecaoPropostas() { log('Atualizar seleção propostas chamado'); }
function excluirObra() { log('Excluir obra chamado'); }

function formatarMoeda(valor) {
    try {
        const numero = parseFloat(valor);
        if (isNaN(numero)) return 'R$ 0,00';
        
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numero);
    } catch (error) {
        return 'R$ 0,00';
    }
}

function formatarStatus(status) {
    const statusMap = {
        'a_iniciar': 'À Iniciar',
        'em_andamento': 'Em Andamento',
        'concluida': 'Concluída',
        'pagamento_pendente': 'Pagamento Pendente'
    };
    return statusMap[status] || (status || 'Indefinido');
}

// Exportar funções globais
window.abrirModalServicos = abrirModalServicos;
window.abrirModalMedicoes = abrirModalMedicoes;
window.atualizarSelecaoPropostas = atualizarSelecaoPropostas;
window.excluirObra = excluirObra;

log('Arquivo de diagnóstico carregado');

