// obras-hvc.js - VERSÃO FINAL (Serviços e Medições Corrigidos)

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
            const modais = ['modal-servicos', 'modal-medicoes'];
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

// FUNÇÃO CORRIGIDA: formatarStatusMedicao
function formatarStatusMedicao(status) {
    const statusMap = {
        'vai_ser_enviada': 'Vai ser Enviada',
        'enviada': 'Enviada',
        'recebida': 'Recebida'  // Corrigido de 'aprovada'
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

// ===== FUNÇÕES DE PROPOSTAS (Já corrigidas) =====

async function carregarPropostasAprovadas() {
    try {
        console.log('🔄 Iniciando carregamento de propostas...');
        
        const container = document.getElementById('propostas-list');
        if (container) {
            mostrarCarregamento(container, 'Carregando propostas...');
        }

        // ESTRATÉGIA 1: Tentar consulta completa com relacionamento
        let propostas = await tentarCarregarPropostasComRelacionamento();
        
        // ESTRATÉGIA 2: Se falhou, tentar sem relacionamento
        if (!propostas || propostas.length === 0) {
            console.log('⚠️ Tentando carregar propostas sem relacionamento...');
            propostas = await tentarCarregarPropostasSemRelacionamento();
        }
        
        // ESTRATÉGIA 3: Se ainda falhou, tentar consulta básica
        if (!propostas || propostas.length === 0) {
            console.log('⚠️ Tentando consulta básica de propostas...');
            propostas = await tentarCarregarPropostasBasico();
        }

        // Processar resultado final
        if (!propostas || propostas.length === 0) {
            console.log('❌ Nenhuma proposta encontrada');
            propostasDisponiveis = [];
            mostrarMensagemSemPropostas();
        } else {
            console.log(`✅ ${propostas.length} propostas carregadas com sucesso`);
            propostasDisponiveis = propostas;
            renderizarPropostas(propostasDisponiveis);
        }

    } catch (error) {
        console.error('❌ Erro geral ao carregar propostas:', error);
        propostasDisponiveis = [];
        mostrarMensagemErroPropostas('Erro inesperado ao carregar propostas. Verifique sua conexão.');
    }
}

// Estratégia 1: Com relacionamento
async function tentarCarregarPropostasComRelacionamento() {
    try {
        const { data, error } = await supabase
            .from('propostas_hvc')
            .select(`
                id,
                numero_proposta,
                valor,
                cliente_id,
                clientes_hvc (
                    id,
                    nome
                )
            `)
            .eq('status', 'Aprovada');

        if (error) {
            console.warn('Erro na consulta com relacionamento:', error);
            return null;
        }

        return data || [];
    } catch (error) {
        console.warn('Exceção na consulta com relacionamento:', error);
        return null;
    }
}

// Estratégia 2: Sem relacionamento
async function tentarCarregarPropostasSemRelacionamento() {
    try {
        const { data: propostas, error } = await supabase
            .from('propostas_hvc')
            .select('id, numero_proposta, valor, cliente_id, status')
            .eq('status', 'Aprovada');

        if (error) {
            console.warn('Erro na consulta sem relacionamento:', error);
            return null;
        }

        if (!propostas || propostas.length === 0) {
            return [];
        }

        // Buscar nomes dos clientes separadamente
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
                    console.warn(`Erro ao buscar cliente ${proposta.cliente_id}:`, clienteError);
                    proposta.clientes_hvc = { nome: 'Cliente não encontrado' };
                }
            } else {
                proposta.clientes_hvc = { nome: 'Sem cliente' };
            }
        }

        return propostas;
    } catch (error) {
        console.warn('Exceção na consulta sem relacionamento:', error);
        return null;
    }
}

// Estratégia 3: Consulta básica
async function tentarCarregarPropostasBasico() {
    try {
        const { data, error } = await supabase
            .from('propostas_hvc')
            .select('*')
            .eq('status', 'Aprovada');

        if (error) {
            console.warn('Erro na consulta básica:', error);
            return null;
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Adicionar dados padrão para clientes
        data.forEach(proposta => {
            if (!proposta.clientes_hvc) {
                proposta.clientes_hvc = { nome: 'Cliente não especificado' };
            }
        });

        return data;
    } catch (error) {
        console.warn('Exceção na consulta básica:', error);
        return null;
    }
}

function mostrarMensagemSemPropostas() {
    try {
        const container = document.getElementById('propostas-list');
        if (container) {
            container.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #666; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin: 10px 0;">
                    <i class="fas fa-file-contract" style="font-size: 2rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <h4 style="margin: 0 0 10px 0; color: #888;">Nenhuma proposta aprovada encontrada</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Para criar obras, você precisa ter propostas com status "Aprovada".<br>
                        Verifique a seção de propostas e aprove algumas antes de continuar.
                    </p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao mostrar mensagem sem propostas:', error);
    }
}

function mostrarMensagemErroPropostas(mensagem) {
    try {
        const container = document.getElementById('propostas-list');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); border-radius: 8px; margin: 10px 0; border: 1px solid rgba(255, 107, 107, 0.3);">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                    ${mensagem}
                    <br><small style="margin-top: 10px; display: block;">Tente recarregar a página ou verifique as permissões do banco de dados.</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao mostrar mensagem de erro:', error);
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
            mostrarMensagemSemPropostas();
            return;
        }

        propostas.forEach(proposta => {
            try {
                if (proposta && proposta.id) {
                    const clienteNome = proposta.clientes_hvc?.nome || proposta.cliente_nome || 'Cliente não especificado';
                    const numeroProposta = proposta.numero_proposta || `Proposta ${proposta.id}`;
                    const valor = proposta.valor || 0;

                    const div = document.createElement('div');
                    div.className = 'proposta-item';
                    
                    const estaSelecionada = propostasSelecionadas.has(proposta.id);
                    
                    // CORREÇÃO CRÍTICA: Usar proposta.id diretamente (string UUID)
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
                    div.dataset.propostaId = proposta.id; // ADICIONAR ID COMO DATA ATTRIBUTE
                    container.appendChild(div);
                }
            } catch (propostaError) {
                console.warn('Erro ao renderizar proposta:', propostaError, proposta);
            }
        });

        atualizarCamposSelecao();

    } catch (error) {
        console.error('Erro ao renderizar propostas:', error);
        mostrarMensagemErroPropostas('Erro ao exibir propostas.');
    }
}

function filtrarPropostas() {
    try {
        // Salvar seleções atuais usando IDs string
        const selecoesSalvas = new Set();
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]:checked');
        checkboxes.forEach(cb => {
            if (cb.value && cb.value !== 'undefined' && cb.value !== 'null') {
                selecoesSalvas.add(cb.value); // Manter como string
            }
        });
        
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
        
        // Restaurar seleções
        setTimeout(() => {
            selecoesSalvas.forEach(id => {
                const checkbox = document.getElementById(`prop-${id}`);
                if (checkbox) {
                    checkbox.checked = true;
                    propostasSelecionadas.add(id); // Manter como string
                }
            });
            atualizarCamposSelecao();
        }, 50);
        
    } catch (error) {
        console.error('Erro ao filtrar propostas:', error);
    }
}

// FUNÇÃO CORRIGIDA: atualizarSelecaoPropostas
function atualizarSelecaoPropostas() {
    try {
        console.log('🔄 Atualizando seleção de propostas...');
        
        const checkboxes = document.querySelectorAll('#propostas-list input[type="checkbox"]');
        
        // Limpar seleções antigas de IDs que não estão mais visíveis
        const idsVisiveis = new Set();
        checkboxes.forEach(checkbox => {
            if (checkbox.value && checkbox.value !== 'undefined' && checkbox.value !== 'null') {
                idsVisiveis.add(checkbox.value);
            }
        });
        
        // Remover IDs que não estão mais visíveis
        const idsParaRemover = [];
        propostasSelecionadas.forEach(id => {
            if (!idsVisiveis.has(id)) {
                idsParaRemover.push(id);
            }
        });
        idsParaRemover.forEach(id => propostasSelecionadas.delete(id));
        
        // Atualizar seleções baseado nos checkboxes atuais
        checkboxes.forEach(checkbox => {
            const id = checkbox.value;
            
            // VALIDAÇÃO CRÍTICA: Verificar se o ID é válido
            if (!id || id === 'undefined' || id === 'null' || id === '') {
                console.warn('⚠️ Checkbox com valor inválido encontrado:', checkbox);
                return;
            }
            
            if (checkbox.checked) {
                propostasSelecionadas.add(id); // Manter como string UUID
                console.log('✅ Proposta selecionada:', id);
            } else {
                propostasSelecionadas.delete(id);
                console.log('❌ Proposta desmarcada:', id);
            }
        });

        console.log('📋 Propostas selecionadas finais:', Array.from(propostasSelecionadas));
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

// ===== FUNÇÕES DE OBRAS (Já corrigidas) =====

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

// FUNÇÃO ADICIONAR OBRA (Já corrigida)
async function adicionarObra() {
    try {
        console.log('🔄 Iniciando processo de adicionar obra...');

        // Validação inicial dos campos
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

        // Verificar se o número já existe
        console.log('🔍 Verificando se número da obra já existe...');
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

        // CORREÇÃO CRÍTICA: Obter IDs das propostas selecionadas como strings UUID
        const idsPropostas = [];
        checkboxes.forEach(checkbox => {
            const id = checkbox.value;
            if (id && id !== 'undefined' && id !== 'null' && id !== '') {
                idsPropostas.push(id); // Manter como string UUID
            }
        });

        console.log('📋 Propostas selecionadas (IDs válidos):', idsPropostas);
        
        if (idsPropostas.length === 0) {
            mostrarErro('Nenhuma proposta válida selecionada. Recarregue a página e tente novamente.');
            return;
        }
        
        // Buscar dados das propostas selecionadas (CORRIGIDA)
        console.log('🔍 Buscando dados das propostas...');
        const dadosPropostas = await buscarDadosPropostas(idsPropostas);
        
        if (!dadosPropostas || dadosPropostas.length === 0) {
            mostrarErro('Não foi possível obter dados das propostas selecionadas. Verifique se as propostas ainda existem.');
            return;
        }

        // Calcular valor total e obter cliente_id
        const valorTotal = dadosPropostas.reduce((total, proposta) => {
            const valor = parseFloat(proposta.valor || 0);
            return total + (isNaN(valor) ? 0 : valor);
        }, 0);

        const clienteId = dadosPropostas[0]?.cliente_id;
        if (!clienteId) {
            mostrarErro('Não foi possível identificar o cliente das propostas selecionadas.');
            return;
        }

        console.log(`💰 Valor total calculado: R$ ${valorTotal}`);
        console.log(`👤 Cliente ID: ${clienteId}`);

        // Inserir a obra
        console.log('💾 Inserindo obra no banco de dados...');
        const { data: obra, error: obraError } = await supabase
            .from('obras_hvc')
            .insert({
                numero_obra: numeroObra,
                nome_obra: nomeObra,
                cliente_id: clienteId,
                valor_total: valorTotal,
                observacoes: observacoes || null,
                status: 'a_iniciar'
            })
            .select()
            .single();

        if (obraError) {
            console.error('❌ Erro ao inserir obra:', obraError);
            throw new Error('Erro ao salvar obra: ' + obraError.message);
        }

        console.log('✅ Obra inserida com sucesso:', obra);

        // Associar propostas à obra na tabela de relacionamento
        console.log('🔗 Associando propostas à obra...');
        const propostasObra = idsPropostas.map(propostaId => ({
            obra_id: obra.id,
            proposta_id: propostaId // Usar ID como string UUID
        }));

        const { error: propostasError } = await supabase
            .from('propostas_obra_hvc')
            .insert(propostasObra);

        if (propostasError) {
            console.warn('⚠️ Erro ao associar propostas (não crítico):', propostasError);
            mostrarAviso('Obra criada, mas houve problema ao associar algumas propostas. Verifique os relacionamentos.');
        } else {
            console.log('✅ Propostas associadas com sucesso');
        }

        // Sucesso
        mostrarSucesso('Obra adicionada com sucesso!');
        limparFormulario();
        await carregarObras();
        await definirProximoNumero();

    } catch (error) {
        console.error('❌ Erro geral ao adicionar obra:', error);
        mostrarErro('Erro ao adicionar obra: ' + (error.message || 'Erro desconhecido. Verifique os dados e tente novamente.'));
    }
}

// Função auxiliar para buscar dados das propostas (Já corrigida)
async function buscarDadosPropostas(idsPropostas) {
    try {
        if (!idsPropostas || idsPropostas.length === 0) {
            console.log('❌ Nenhum ID de proposta fornecido');
            return [];
        }

        console.log('🔍 Buscando dados das propostas:', idsPropostas);

        // VALIDAÇÃO CRÍTICA: Filtrar IDs inválidos
        const idsValidos = idsPropostas.filter(id => {
            if (!id || id === 'undefined' || id === 'null' || id === '' || id === 'NaN') {
                console.warn('⚠️ ID inválido filtrado:', id);
                return false;
            }
            return true;
        });

        if (idsValidos.length === 0) {
            console.log('❌ Nenhum ID válido encontrado após filtração');
            return [];
        }

        console.log('✅ IDs válidos para busca:', idsValidos);

        // Estratégia 1: Buscar todas de uma vez
        try {
            const { data, error } = await supabase
                .from('propostas_hvc')
                .select('id, valor, cliente_id, numero_proposta')
                .in('id', idsValidos);

            if (!error && data && data.length > 0) {
                console.log('✅ Dados das propostas obtidos com sucesso (estratégia 1)');
                return data;
            } else {
                console.warn('⚠️ Estratégia 1 falhou:', error);
            }
        } catch (estrategia1Error) {
            console.warn('⚠️ Estratégia 1 falhou:', estrategia1Error);
        }

        // Estratégia 2: Buscar uma por uma
        console.log('🔄 Tentando estratégia 2: buscar propostas individualmente...');
        const propostas = [];
        
        for (const id of idsValidos) {
            try {
                const { data, error } = await supabase
                    .from('propostas_hvc')
                    .select('id, valor, cliente_id, numero_proposta')
                    .eq('id', id)
                    .single();

                if (!error && data) {
                    propostas.push(data);
                    console.log(`✅ Proposta ${id} encontrada`);
                } else {
                    console.warn(`⚠️ Proposta ${id} não encontrada:`, error);
                }
            } catch (propostaError) {
                console.warn(`⚠️ Erro ao buscar proposta ${id}:`, propostaError);
            }
        }

        if (propostas.length > 0) {
            console.log(`✅ ${propostas.length} propostas obtidas com sucesso (estratégia 2)`);
            return propostas;
        }

        console.log('❌ Nenhuma proposta encontrada');
        return [];

    } catch (error) {
        console.error('❌ Erro geral ao buscar dados das propostas:', error);
        return [];
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

// ===== FUNÇÕES DE SERVIÇOS (CORRIGIDAS COM EDIÇÃO) =====

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
        restaurarBotaoAdicionarServico(); // Garantir que o botão esteja no modo adicionar
        limparFormularioServico();
    } catch (error) {
        console.error('Erro ao abrir modal de serviços:', error);
        mostrarErro('Erro ao abrir gerenciamento de serviços.');
    }
}

// FUNÇÃO CARREGAR SERVIÇOS (CORRIGIDA: Sem valor, usando coluna \'nome_servico\')
async function carregarServicos() {
    try {
        if (!obraAtual) {
            console.warn(\'Nenhuma obra selecionada\');
            return;
        }

        // Selecionar serviço (usando coluna \'nome_servico\')
        const { data: servicos, error } = await supabase
            .from(\'servicos_obra_hvc\')
            .select(\'id, nome_servico, data_inicio, data_conclusao\') // <-- CORRIGIDO para nome_servico. Removido \'valor\'.
            .eq(\'obra_id\', obraAtual)
            .order(\'nome_servico\'); // Ordenar por nome_servico

        if (error) {
             // Verificar se o erro é sobre a coluna \'nome_servico\'
            if (error.message.includes(\'column "nome_servico" does not exist\')) {
                 mostrarErro(\'Erro: A coluna para carregar o nome do serviço não foi encontrada no banco de dados. Verifique se a coluna \'nome_servico\' existe na tabela \'servicos_obra_hvc\".\');
            } else {
                 throw error;
            }
            return; // Não continua se houve erro
        }

        const container = document.getElementById(\'servicos-container\');
        if (!container) {
            console.warn(\'Container de serviços não encontrado\');
            return;
        }

        container.innerHTML = \'\';

        if (!servicos || servicos.length === 0) {
            container.innerHTML = \'<div class="empty-state"><i class="fas fa-tools"></i><p>Nenhum serviço cadastrado</p></div>\';
            return;
        }

        servicos.forEach(servico => {
            if (!servico) return;

            const nomeServico = servico.nome_servico || \'Serviço sem nome\'; // <-- Usa a coluna \'nome_servico\'

            const div = document.createElement(\'div\');
            div.className = \'item\';
            div.innerHTML = `
                <div class="item-info">
                    <strong>${nomeServico}</strong><br>
                    <small>Status: ${formatarStatusServico(servico)}</small>
                    ${servico.data_inicio ? `<br><small>Iniciado: ${formatarData(servico.data_inicio)}</small>` : \'\'}
                    ${servico.data_conclusao ? `<br><small>Concluído: ${formatarData(servico.data_conclusao)}</small>` : \'\'}
                </div>
                <div class="item-actions">
                    <button class="btn ${servico.data_inicio ? \'btn-warning\' : \'btn-success\'} btn-small" 
                            onclick="toggleInicioServico(\'${servico.id}\', ${!!servico.data_inicio})">
                        <i class="fas ${servico.data_inicio ? \'fa-undo\' : \'fa-play\'}"></i> ${servico.data_inicio ? \'Desfazer Início\' : \'Iniciar\'}
                    </button>
                    <button class="btn ${servico.data_conclusao ? \'btn-warning\' : \'btn-success\'} btn-small" 
                            onclick="toggleConclusaoServico(\'${servico.id}\', ${!!servico.data_conclusao})">
                         <i class="fas ${servico.data_conclusao ? \'fa-undo\' : \'fa-check\'}"></i> ${servico.data_conclusao ? \'Desfazer Conclusão\' : \'Concluir\'}
                    </button>
                    <button class="btn btn-primary btn-small" onclick="abrirModalEditarServico(\'${servico.id}\')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-small" onclick="excluirServico(\'${servico.id}\')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        await atualizarStatusObra();

    } catch (error) {
        console.error(\'Erro ao carregar serviços:\', error);
        const container = document.getElementById(\'servicos-container\');
        if (container) {
            container.innerHTML = \'<div class="empty-state error-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar serviços</p></div>\';
        }
    }
}



// FUNÇÃO ADICIONAR SERVIÇO (CORRIGIDA: Sem valor, usando coluna 'nome_servico')
async function adicionarServico() {
    try {
        const nomeField = document.getElementById(\'nome-servico\');
        
        if (!nomeField) {
            mostrarErro(\'Campo de nome/descrição não encontrado.\');
            return;
        }

        const nomeServicoValor = nomeField.value.trim(); // Renomeado para clareza
        
        if (!nomeServicoValor) {
            mostrarErro(\'Digite o nome/descrição do serviço.\');
            nomeField.focus();
            return;
        }

        if (!obraAtual) {
            mostrarErro(\'Nenhuma obra selecionada.\');
            return;
        }

        // Verificar duplicidade (usando coluna \'nome_servico\')
        const { data: servicoExistente } = await supabase
            .from(\'servicos_obra_hvc\')
            .select(\'id\')
            .eq(\'obra_id\', obraAtual)
            .eq(\'nome_servico\', nomeServicoValor) // <-- CORRIGIDO para nome_servico
            .maybeSingle();

        if (servicoExistente) {
            mostrarErro(\'Já existe um serviço com este nome/descrição para esta obra.\');
            nomeField.focus();
            return;
        }

        // Inserir serviço (usando coluna \'nome_servico\')
        const { error } = await supabase
            .from(\'servicos_obra_hvc\')
            .insert({
                obra_id: obraAtual,
                nome_servico: nomeServicoValor // <-- CORRIGIDO para nome_servico
                // \'valor\' removido
            });

        if (error) {
            console.error(\'Erro ao inserir serviço:\', error);
            // Verificar se o erro é sobre a coluna \'nome_servico\'
            if (error.message.includes(\'column "nome_servico" does not exist\')) {
                 mostrarErro(\'Erro: A coluna para salvar o nome do serviço não foi encontrada no banco de dados. Verifique se a coluna \'nome_servico\' existe na tabela \'servicos_obra_hvc\".\');
            } else {
                 throw new Error(\'Erro ao salvar serviço: \' + error.message);
            }
            return; // Não continua se houve erro
        }

        limparFormularioServico();
        await carregarServicos();

        mostrarSucesso(\'Serviço adicionado com sucesso!\');

    } catch (error) {
        console.error(\'Erro ao adicionar serviço:\', error);
        mostrarErro(\'Erro ao adicionar serviço: \' + (error.message || \'Erro desconhecido\'));
    }
}



// NOVA FUNÇÃO: Editar Serviço
async function editarServico(servicoId) {
    try {
        if (!servicoId) {
            mostrarErro('ID do serviço inválido.');
            return;
        }

        // Buscar dados do serviço
        const { data: servico, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('id', servicoId)
            .single();

        if (error) {
            console.error('Erro ao buscar serviço:', error);
            throw new Error('Erro ao carregar serviço: ' + error.message);
        }

        if (!servico) {
            mostrarErro('Serviço não encontrado.');
            return;
        }

        // Preencher formulário com dados do serviço
        const descricaoField = document.getElementById('nome-servico');
        const valorField = document.getElementById('valor-servico');

        if (descricaoField) {
            descricaoField.value = servico.descricao || '';
        }

        if (valorField) {
            valorField.value = servico.valor ? formatarMoeda(servico.valor) : '';
        }

        // Modificar botão para modo edição
        const btnAdicionar = document.querySelector('#form-servico button[type="submit"]');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
            btnAdicionar.onclick = (e) => {
                e.preventDefault();
                salvarEdicaoServico(servicoId);
            };
        }

        // Adicionar botão cancelar se não existir
        let btnCancelar = document.getElementById('btn-cancelar-edicao-servico');
        if (!btnCancelar) {
            btnCancelar = document.createElement('button');
            btnCancelar.id = 'btn-cancelar-edicao-servico';
            btnCancelar.type = 'button';
            btnCancelar.className = 'btn btn-warning';
            btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar';
            btnCancelar.onclick = cancelarEdicaoServico;
            btnAdicionar.parentNode.insertBefore(btnCancelar, btnAdicionar.nextSibling);
        }

        // Focar no campo de descrição
        if (descricaoField) {
            descricaoField.focus();
        }

    } catch (error) {
        console.error('Erro ao editar serviço:', error);
        mostrarErro('Erro ao carregar serviço para edição: ' + (error.message || 'Erro desconhecido'));
    }
}

// FUNÇÃO SALVAR EDIÇÃO SERVIÇO (CORRIGIDA: Sem valor, usando coluna \'nome_servico\')
async function salvarEdicaoServico(servicoId) {
    try {
        if (!servicoId) {
            mostrarErro(\'ID do serviço inválido.\');
            return;
        }

        const nomeField = document.getElementById(\'edit-nome-servico\'); // Usa o campo do modal de edição
        
        if (!nomeField) {
            mostrarErro(\'Campo de nome/descrição não encontrado no modal de edição.\');
            return;
        }

        const nomeServicoValor = nomeField.value.trim(); // Renomeado para clareza
        
        if (!nomeServicoValor) {
            mostrarErro(\'Digite o nome/descrição do serviço.\');
            nomeField.focus();
            return;
        }

        // Verificar duplicidade (usando coluna \'nome_servico\')
        const { data: servicoExistente } = await supabase
            .from(\'servicos_obra_hvc\')
            .select(\'id\')
            .eq(\'obra_id\', obraAtual)
            .eq(\'nome_servico\', nomeServicoValor) // <-- CORRIGIDO para nome_servico
            .neq(\'id\', servicoId)
            .maybeSingle();

        if (servicoExistente) {
            mostrarErro(\'Já existe outro serviço com este nome/descrição para esta obra.\');
            nomeField.focus();
            return;
        }

        // Atualizar serviço (usando coluna \'nome_servico\')
        const { error } = await supabase
            .from(\'servicos_obra_hvc\')
            .update({
                nome_servico: nomeServicoValor // <-- CORRIGIDO para nome_servico
                // \'valor\' removido
            })
            .eq(\'id\', servicoId);

        if (error) {
            console.error(\'Erro ao atualizar serviço:\', error);
             // Verificar se o erro é sobre a coluna \'nome_servico\'
            if (error.message.includes(\'column "nome_servico" does not exist\')) {
                 mostrarErro(\'Erro: A coluna para salvar o nome do serviço não foi encontrada no banco de dados. Verifique se a coluna \'nome_servico\' existe na tabela \'servicos_obra_hvc\".\');
            } else {
                 throw new Error(\'Erro ao salvar alterações: \' + error.message);
            }
            return; // Não continua se houve erro
        }

        // Fechar modal de edição e restaurar formulário principal
        fecharModal(\'modal-editar-servico\'); // Adicionado para fechar o modal de edição
        restaurarBotaoAdicionarServico();
        limparFormularioServico();
        await carregarServicos();

        mostrarSucesso(\'Serviço atualizado com sucesso!\');

    } catch (error) {
        console.error(\'Erro ao salvar edição do serviço:\', error);
        mostrarErro(\'Erro ao salvar alterações: \' + (error.message || \'Erro desconhecido\'));
    }
}



// NOVA FUNÇÃO: Cancelar Edição do Serviço
function cancelarEdicaoServico() {
    try {
        limparFormularioServico();
        restaurarBotaoAdicionarServico();
        
        const btnCancelar = document.getElementById('btn-cancelar-edicao-servico');
        if (btnCancelar) {
            btnCancelar.remove();
        }
        
    } catch (error) {
        console.error('Erro ao cancelar edição:', error);
    }
}

// NOVA FUNÇÃO: Restaurar Botão Adicionar Serviço
function restaurarBotaoAdicionarServico() {
    try {
        const btnSalvar = document.querySelector('#form-servico button[type="submit"]');
        if (btnSalvar) {
            btnSalvar.innerHTML = '<i class="fas fa-plus"></i> Adicionar Serviço';
            btnSalvar.onclick = (e) => {
                e.preventDefault();
                adicionarServico();
            };
        }
    } catch (error) {
        console.error('Erro ao restaurar botão:', error);
    }
}

// NOVA FUNÇÃO: Limpar Formulário de Serviço
function limparFormularioServico() {
    try {
        const campos = ['nome-servico', 'valor-servico'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) campo.value = '';
        });
    } catch (error) {
        console.error('Erro ao limpar formulário de serviço:', error);
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

// ===== FUNÇÕES DE MEDIÇÕES (CORRIGIDAS E EXPANDIDAS) =====

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
        
        // Carregar dados necessários
        await Promise.all([
            carregarMedicoes(),
            carregarServicosParaMedicao(),
            definirProximoNumeroMedicao(numeroObra)
        ]);
        
        restaurarBotaoAdicionarMedicao(); // Garantir que o botão esteja no modo adicionar
        limparFormularioMedicao();

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

// NOVA FUNÇÃO: Carregar Serviços para Seleção na Medição
async function carregarServicosParaMedicao() {
    try {
        if (!obraAtual) {
            console.warn('Nenhuma obra selecionada');
            return;
        }

        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('obra_id', obraAtual)
            .order('descricao');

        if (error) throw error;

        const container = document.getElementById('servicos-medicao-container');
        if (!container) {
            console.warn('Container de serviços para medição não encontrado');
            return;
        }

        container.innerHTML = '';

        if (!servicos || servicos.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #999; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <i class="fas fa-tools" style="font-size: 1.5rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>Nenhum serviço cadastrado para esta obra.</p>
                    <small>Adicione serviços primeiro para poder incluí-los nas medições.</small>
                </div>
            `;
            return;
        }

        // Criar lista de serviços com checkboxes
        const servicosHtml = servicos.map(servico => `
            <div class="servico-medicao-item" data-servico-id="${servico.id}">
                <div class="servico-checkbox">
                    <input type="checkbox" id="servico-${servico.id}" value="${servico.id}" 
                           onchange="toggleServicoMedicao('${servico.id}')">
                    <label for="servico-${servico.id}">
                        <strong>${servico.descricao}</strong>
                        ${servico.valor ? `<br><small>Valor: ${formatarMoeda(servico.valor)}</small>` : ''}
                        <br><small>Status: ${formatarStatusServico(servico)}</small>
                    </label>
                </div>
                <div class="servico-observacoes" style="display: none;">
                    <label for="obs-servico-${servico.id}">Observações para este serviço:</label>
                    <textarea id="obs-servico-${servico.id}" rows="2" 
                              placeholder="Observações específicas deste serviço nesta medição..."></textarea>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="servicos-medicao-header">
                <h4><i class="fas fa-tools"></i> Serviços Incluídos nesta Medição</h4>
                <small>Selecione os serviços que fazem parte desta medição e adicione observações específicas se necessário.</small>
            </div>
            <div class="servicos-medicao-list">
                ${servicosHtml}
            </div>
        `;

    } catch (error) {
        console.error('Erro ao carregar serviços para medição:', error);
        const container = document.getElementById('servicos-medicao-container');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar serviços</div>';
        }
    }
}

// NOVA FUNÇÃO: Toggle Serviço na Medição
function toggleServicoMedicao(servicoId) {
    try {
        const checkbox = document.getElementById(`servico-${servicoId}`);
        const observacoesDiv = checkbox.closest('.servico-medicao-item').querySelector('.servico-observacoes');
        
        if (checkbox.checked) {
            observacoesDiv.style.display = 'block';
        } else {
            observacoesDiv.style.display = 'none';
            // Limpar observações quando desmarcar
            const textarea = document.getElementById(`obs-servico-${servicoId}`);
            if (textarea) textarea.value = '';
        }
    } catch (error) {
        console.error('Erro ao toggle serviço na medição:', error);
    }
}

async function carregarMedicoes() {
    try {
        if (!obraAtual) {
            console.warn('Nenhuma obra selecionada');
            return;
        }

        // Carregar medições com serviços relacionados
        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select(`
                *,
                medicoes_servicos_hvc (
                    observacoes,
                    servicos_obra_hvc (
                        id,
                        descricao,
                        valor
                    )
                )
            `)
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

            // Preparar lista de serviços relacionados
            const servicosRelacionados = medicao.medicoes_servicos_hvc || [];
            const servicosHtml = servicosRelacionados.length > 0 
                ? servicosRelacionados.map(ms => {
                    const servico = ms.servicos_obra_hvc;
                    return `
                        <div class="servico-relacionado">
                            <strong>${servico.descricao}</strong>
                            ${servico.valor ? ` - ${formatarMoeda(servico.valor)}` : ''}
                            ${ms.observacoes ? `<br><small><em>${ms.observacoes}</em></small>` : ''}
                        </div>
                    `;
                }).join('')
                : '<small style="color: #999;">Nenhum serviço específico selecionado</small>';

            const div = document.createElement('div');
            div.className = 'item medicao-item';
            div.innerHTML = `
                <div class="item-info">
                    <div class="medicao-header">
                        <strong>Medição ${medicao.numero_medicao || 'N/A'}</strong>
                        <span class="status-badge status-${medicao.status?.replace('_', '-') || 'indefinido'}">
                            ${formatarStatusMedicao(medicao.status)}
                        </span>
                    </div>
                    <div class="medicao-detalhes">
                        <small>Data: ${formatarData(medicao.data_medicao || medicao.data_inicio)}</small><br>
                        <small>Valor: ${formatarMoeda(medicao.valor || 0)}</small><br>
                        <small>Pago: ${medicao.pago ? 'Sim' : 'Não'}</small>
                        ${medicao.data_pagamento ? `<br><small>Data Pagamento: ${formatarData(medicao.data_pagamento)}</small>` : ''}
                        ${medicao.observacoes ? `<br><small>Obs: ${medicao.observacoes}</small>` : ''}
                    </div>
                    <div class="medicao-servicos">
                        <strong>Serviços incluídos:</strong>
                        ${servicosHtml}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-small" onclick="editarMedicao('${medicao.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn ${medicao.pago ? 'btn-warning' : 'btn-success'} btn-small" 
                            onclick="togglePagamentoMedicao('${medicao.id}', ${!!medicao.pago})">
                        ${medicao.pago ? 'Desmarcar Pago' : 'Marcar como Pago'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="excluirMedicao('${medicao.id}')">
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

// NOVA FUNÇÃO: Toggle Pagamento da Medição
async function togglePagamentoMedicao(medicaoId, jaPago) {
    try {
        if (!medicaoId) {
            mostrarErro('ID da medição inválido.');
            return;
        }

        if (jaPago) {
            if (!confirm('Tem certeza que deseja desmarcar o pagamento desta medição?')) {
                return;
            }
        }

        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .update({
                pago: !jaPago,
                data_pagamento: !jaPago ? new Date().toISOString() : null
            })
            .eq('id', medicaoId);

        if (error) throw error;

        await carregarMedicoes();
        mostrarSucesso(jaPago ? 'Pagamento desmarcado!' : 'Medição marcada como paga!');

    } catch (error) {
        console.error('Erro ao atualizar pagamento da medição:', error);
        mostrarErro('Erro ao atualizar pagamento: ' + (error.message || 'Erro desconhecido'));
    }
}

async function adicionarMedicao() {
    try {
        const numeroMedicao = document.getElementById('numero-medicao')?.value?.trim();
        const dataMedicao = document.getElementById('data-medicao')?.value;
        const valorMedicao = document.getElementById('valor-medicao')?.value;
        const statusMedicao = document.getElementById('status-medicao')?.value || 'vai_ser_enviada';
        const observacoes = document.getElementById('observacoes-medicao')?.value?.trim();

        // Validações básicas
        if (!numeroMedicao) {
            mostrarErro('Preencha o número da medição.');
            document.getElementById('numero-medicao')?.focus();
            return;
        }

        if (!dataMedicao) {
            mostrarErro('Preencha a data da medição.');
            document.getElementById('data-medicao')?.focus();
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

        // Verificar duplicata
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

        // Coletar serviços selecionados
        const servicosSelecionados = [];
        const checkboxes = document.querySelectorAll('#servicos-medicao-container input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            const servicoId = checkbox.value;
            const observacoesServico = document.getElementById(`obs-servico-${servicoId}`)?.value?.trim() || '';
            
            servicosSelecionados.push({
                servico_id: servicoId,
                observacoes: observacoesServico
            });
        });

        // Inserir medição
        const { data: medicao, error: medicaoError } = await supabase
            .from('medicoes_obra_hvc')
            .insert({
                obra_id: obraAtual,
                numero_medicao: numeroMedicao,
                data_medicao: dataMedicao,
                valor: valorNumerico,
                observacoes: observacoes || null,
                status: statusMedicao,
                pago: false
            })
            .select()
            .single();

        if (medicaoError) {
            console.error('Erro ao inserir medição:', medicaoError);
            throw new Error('Erro ao salvar medição: ' + medicaoError.message);
        }

        // Inserir relacionamentos com serviços
        if (servicosSelecionados.length > 0) {
            const relacionamentos = servicosSelecionados.map(s => ({
                medicao_id: medicao.id,
                servico_id: s.servico_id,
                observacoes: s.observacoes
            }));

            const { error: relacionamentosError } = await supabase
                .from('medicoes_servicos_hvc')
                .insert(relacionamentos);

            if (relacionamentosError) {
                console.warn('Erro ao salvar relacionamentos (não crítico):', relacionamentosError);
                mostrarAviso('Medição criada, mas houve problema ao associar alguns serviços.');
            }
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
        const campos = ['data-medicao', 'valor-medicao', 'observacoes-medicao'];
        campos.forEach(campoId => {
            const campo = document.getElementById(campoId);
            if (campo) campo.value = '';
        });

        // Resetar status para padrão
        const statusField = document.getElementById('status-medicao');
        if (statusField) statusField.value = 'vai_ser_enviada';

        // Desmarcar todos os serviços
        const checkboxes = document.querySelectorAll('#servicos-medicao-container input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            toggleServicoMedicao(checkbox.value);
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

        // Buscar dados da medição e serviços relacionados
        const { data: medicao, error } = await supabase
            .from('medicoes_obra_hvc')
            .select(`
                *,
                medicoes_servicos_hvc (
                    servico_id,
                    observacoes
                )
            `)
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

        // Preencher campos do formulário
        const campos = {
            'numero-medicao': medicao.numero_medicao || '',
            'data-medicao': medicao.data_medicao || '',
            'valor-medicao': medicao.valor ? formatarMoeda(medicao.valor) : '',
            'status-medicao': medicao.status || 'vai_ser_enviada',
            'observacoes-medicao': medicao.observacoes || ''
        };

        Object.entries(campos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.value = valor;
            }
        });

        // Marcar serviços relacionados e preencher observações
        const servicosRelacionados = medicao.medicoes_servicos_hvc || [];
        const checkboxes = document.querySelectorAll('#servicos-medicao-container input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            const servicoId = checkbox.value;
            const relacionamento = servicosRelacionados.find(s => s.servico_id === servicoId);
            
            if (relacionamento) {
                checkbox.checked = true;
                const textarea = document.getElementById(`obs-servico-${servicoId}`);
                if (textarea) textarea.value = relacionamento.observacoes || '';
            } else {
                checkbox.checked = false;
            }
            toggleServicoMedicao(servicoId);
        });

        // Modificar botão para modo edição
        const btnAdicionar = document.querySelector('#form-medicao button[type="submit"]');
        if (btnAdicionar) {
            btnAdicionar.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
            btnAdicionar.onclick = (e) => {
                e.preventDefault();
                salvarEdicaoMedicao(medicaoId);
            };
        }

        // Adicionar botão cancelar se não existir
        let btnCancelar = document.getElementById('btn-cancelar-edicao-medicao');
        if (!btnCancelar) {
            btnCancelar = document.createElement('button');
            btnCancelar.id = 'btn-cancelar-edicao-medicao';
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

        const dataMedicao = document.getElementById('data-medicao')?.value;
        const valorMedicao = document.getElementById('valor-medicao')?.value;
        const statusMedicao = document.getElementById('status-medicao')?.value || 'vai_ser_enviada';
        const observacoes = document.getElementById('observacoes-medicao')?.value?.trim();

        // Validações
        if (!dataMedicao) {
            mostrarErro('Preencha a data da medição.');
            return;
        }

        const valorNumerico = converterValorMonetario(valorMedicao);
        if (valorNumerico <= 0) {
            mostrarErro('Valor da medição deve ser maior que zero.');
            return;
        }

        // Coletar serviços selecionados
        const servicosSelecionados = [];
        const checkboxes = document.querySelectorAll('#servicos-medicao-container input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            const servicoId = checkbox.value;
            const observacoesServico = document.getElementById(`obs-servico-${servicoId}`)?.value?.trim() || '';
            
            servicosSelecionados.push({
                servico_id: servicoId,
                observacoes: observacoesServico
            });
        });

        // Atualizar medição
        const { error: updateError } = await supabase
            .from('medicoes_obra_hvc')
            .update({
                data_medicao: dataMedicao,
                valor: valorNumerico,
                observacoes: observacoes || null,
                status: statusMedicao
            })
            .eq('id', medicaoId);

        if (updateError) throw updateError;

        // Atualizar relacionamentos (excluir antigos e inserir novos)
        const { error: deleteError } = await supabase
            .from('medicoes_servicos_hvc')
            .delete()
            .eq('medicao_id', medicaoId);

        if (deleteError) {
            console.warn('Erro ao limpar relacionamentos antigos:', deleteError);
        }

        if (servicosSelecionados.length > 0) {
            const relacionamentos = servicosSelecionados.map(s => ({
                medicao_id: medicaoId,
                servico_id: s.servico_id,
                observacoes: s.observacoes
            }));

            const { error: insertError } = await supabase
                .from('medicoes_servicos_hvc')
                .insert(relacionamentos);

            if (insertError) {
                console.warn('Erro ao salvar novos relacionamentos:', insertError);
                mostrarAviso('Medição atualizada, mas houve problema ao associar serviços.');
            }
        }

        restaurarBotaoAdicionarMedicao();
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
        restaurarBotaoAdicionarMedicao();
        
        const btnCancelar = document.getElementById('btn-cancelar-edicao-medicao');
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

function restaurarBotaoAdicionarMedicao() {
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
window.editarServico = editarServico;
window.editarMedicao = editarMedicao;
window.excluirMedicao = excluirMedicao;
window.excluirObra = excluirObra;
window.atualizarSelecaoPropostas = atualizarSelecaoPropostas;
window.toggleServicoMedicao = toggleServicoMedicao;
window.togglePagamentoMedicao = togglePagamentoMedicao;


