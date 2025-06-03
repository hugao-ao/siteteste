// obras-hvc.js - VERSÃO FINAL COMPLETA E CORRIGIDA
// - Baseado no código original de ~2400 linhas
// - Corrige uso de 'descricao' para 'nome_servico'
// - Adiciona campo 'observacao' para Serviços e Medições
// - Permite associar múltiplos Serviços a uma Medição
// - Tenta corrigir erro 'servicos_obra_hvc_2' (verificar Supabase se persistir)

import { injectSidebar } from './sidebar.js';
import { supabase } from './supabase.js';

// Variáveis globais
let obraAtual = null;
let medicaoAtual = null; // Guarda a medição sendo editada/criada
let servicoAtual = null; // Guarda o serviço sendo editado/criado
let proximoNumeroObra = 1;
let propostasDisponiveis = [];
let propostasSelecionadas = new Set();
let servicosDaObraParaMedicao = []; // Guarda os serviços da obra atual para seleção na medição

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
        const valorMedicao = document.getElementById('valor-medicao'); // No modal de medição
        const valorServico = document.getElementById('valor-servico'); // No modal de serviço

        if (numeroObra) numeroObra.addEventListener('input', formatarNumeroObra);
        if (valorMedicao) valorMedicao.addEventListener('input', formatarValorMonetario);
        if (valorServico) valorServico.addEventListener('input', formatarValorMonetario);

        // Fechar modais ao clicar fora
        window.addEventListener('click', function(event) {
            const modais = ['modal-servicos', 'modal-medicoes'];
            modais.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal && event.target === modal) {
                    fecharModal(modalId);
                }
            });
        });

        // Adiciona listeners aos botões principais (se existirem no HTML com os IDs corretos)
        const btnCriarObra = document.getElementById('btn-criar-obra');
        if (btnCriarObra) btnCriarObra.addEventListener('click', salvarObra);

        const btnSalvarServico = document.getElementById('btn-salvar-servico');
        if (btnSalvarServico) btnSalvarServico.addEventListener('click', salvarServico);

        const btnSalvarMedicao = document.getElementById('btn-salvar-medicao');
        if (btnSalvarMedicao) btnSalvarMedicao.addEventListener('click', salvarMedicao);

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

// ===== FUNÇÕES DE FORMATAÇÃO (Mantidas como no original) =====

function formatarMoeda(valor) {
    try {
        if (!valor && valor !== 0) return 'R$ 0,00';
        const numero = typeof valor === 'string' ? parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) : parseFloat(valor);
        if (isNaN(numero)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
    } catch (error) {
        console.error('Erro ao formatar moeda:', error); return 'R$ 0,00';
    }
}

function formatarData(data) {
    try {
        if (!data) return 'N/A';
        const dataObj = new Date(data);
        if (isNaN(dataObj.getTime())) return 'Data inválida';
        // Adiciona ajuste de fuso horário para evitar problemas de data
        const offset = dataObj.getTimezoneOffset();
        const adjustedDate = new Date(dataObj.getTime() + offset * 60 * 1000);
        return adjustedDate.toLocaleDateString('pt-BR');
    } catch (error) {
        console.error('Erro ao formatar data:', error); return 'N/A';
    }
}

function formatarStatus(status) {
    const statusMap = { 'a_iniciar': 'A Iniciar', 'em_andamento': 'Em Andamento', 'concluido': 'Concluído', 'pausado': 'Pausado' };
    return statusMap[status] || 'Indefinido';
}

function formatarStatusServico(servico) {
    // Esta função parece não ser usada ativamente após as modificações, mas mantida por segurança
    if (servico.data_conclusao) return 'Concluído';
    if (servico.data_inicio) return 'Em Andamento';
    return 'Não Iniciado';
}

// FUNÇÃO CORRIGIDA: formatarStatusMedicao
function formatarStatusMedicao(status) {
    const statusMap = { 'vai_ser_enviada': 'Vai ser Enviada', 'enviada': 'Enviada', 'recebida': 'Recebida' };
    return statusMap[status] || 'Indefinido';
}

// ===== FUNÇÕES DE NOTIFICAÇÃO (Mantidas como no original) =====

function mostrarCarregamento(elemento, texto = 'Carregando...') {
    try {
        let el = typeof elemento === 'string' ? document.getElementById(elemento) : elemento;
        if (el) el.innerHTML = `<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-spinner fa-spin"></i> ${texto}</div>`;
    } catch (error) { console.error('Erro ao mostrar carregamento:', error); }
}

function mostrarSucesso(mensagem, duracao = 3000) {
    try {
        const div = document.createElement('div');
        div.className = 'notification success show'; // Adiciona 'show'
        div.innerHTML = `<i class="fas fa-check"></i> ${mensagem}`;
        document.body.appendChild(div);
        setTimeout(() => { 
            div.classList.remove('show');
            setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 300); // Espera a transição
        }, duracao);
    } catch (error) { console.error('Erro ao mostrar sucesso:', error); }
}

function mostrarErro(mensagem, duracao = 5000) {
    try {
        const div = document.createElement('div');
        div.className = 'notification error show'; // Adiciona 'show'
        div.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${mensagem}`;
        document.body.appendChild(div);
        setTimeout(() => { 
            div.classList.remove('show');
            setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 300); // Espera a transição
        }, duracao);
    } catch (error) { console.error('Erro ao mostrar erro:', error); }
}

function mostrarAviso(mensagem, duracao = 4000) {
    try {
        const div = document.createElement('div');
        div.className = 'notification warning show'; // Adiciona 'show'
        div.innerHTML = `<i class="fas fa-exclamation"></i> ${mensagem}`;
        document.body.appendChild(div);
        setTimeout(() => { 
            div.classList.remove('show');
            setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 300); // Espera a transição
        }, duracao);
    } catch (error) { console.error('Erro ao mostrar aviso:', error); }
}

// ===== FUNÇÕES DE PROPOSTAS (Mantidas como no original, já pareciam corrigidas) =====

async function carregarPropostasAprovadas() {
    try {
        console.log('🔄 Iniciando carregamento de propostas...');
        const container = document.getElementById('propostas-list');
        if (container) mostrarCarregamento(container, 'Carregando propostas...');

        let propostas = await tentarCarregarPropostasComRelacionamento() ||
                        await tentarCarregarPropostasSemRelacionamento() ||
                        await tentarCarregarPropostasBasico();

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

async function tentarCarregarPropostasComRelacionamento() {
    try {
        const { data, error } = await supabase.from('propostas_hvc').select('id, numero_proposta, valor, cliente_id, clientes_hvc(id, nome)').eq('status', 'Aprovada');
        if (error) { console.warn('Erro na consulta com relacionamento:', error); return null; }
        return data || [];
    } catch (error) { console.warn('Exceção na consulta com relacionamento:', error); return null; }
}

async function tentarCarregarPropostasSemRelacionamento() {
    try {
        const { data: propostas, error } = await supabase.from('propostas_hvc').select('id, numero_proposta, valor, cliente_id, status').eq('status', 'Aprovada');
        if (error) { console.warn('Erro na consulta sem relacionamento:', error); return null; }
        if (!propostas || propostas.length === 0) return [];
        for (let proposta of propostas) {
            if (proposta.cliente_id) {
                try {
                    const { data: cliente } = await supabase.from('clientes_hvc').select('nome').eq('id', proposta.cliente_id).single();
                    proposta.clientes_hvc = cliente ? { nome: cliente.nome } : { nome: 'Cliente não encontrado' };
                } catch (clienteError) {
                    console.warn(`Erro ao buscar cliente ${proposta.cliente_id}:`, clienteError);
                    proposta.clientes_hvc = { nome: 'Cliente não encontrado' };
                }
            } else { proposta.clientes_hvc = { nome: 'Sem cliente' }; }
        }
        return propostas;
    } catch (error) { console.warn('Exceção na consulta sem relacionamento:', error); return null; }
}

async function tentarCarregarPropostasBasico() {
    try {
        const { data, error } = await supabase.from('propostas_hvc').select('*').eq('status', 'Aprovada');
        if (error) { console.warn('Erro na consulta básica:', error); return null; }
        if (!data || data.length === 0) return [];
        data.forEach(proposta => { if (!proposta.clientes_hvc) proposta.clientes_hvc = { nome: 'Cliente não especificado' }; });
        return data;
    } catch (error) { console.warn('Exceção na consulta básica:', error); return null; }
}

function mostrarMensagemSemPropostas() {
    const container = document.getElementById('propostas-list');
    if (container) container.innerHTML = `<div style="padding: 30px; text-align: center; color: #666; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin: 10px 0;"><i class="fas fa-file-contract" style="font-size: 2rem; margin-bottom: 15px; opacity: 0.5;"></i><h4 style="margin: 0 0 10px 0; color: #888;">Nenhuma proposta aprovada encontrada</h4><p style="margin: 0; font-size: 0.9rem;">Para criar obras, você precisa ter propostas com status "Aprovada".<br>Verifique a seção de propostas e aprove algumas antes de continuar.</p></div>`;
}

function mostrarMensagemErroPropostas(mensagem) {
    const container = document.getElementById('propostas-list');
    if (container) container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); border-radius: 8px; margin: 10px 0; border: 1px solid rgba(255, 107, 107, 0.3);"><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> ${mensagem}<br><small style="margin-top: 10px; display: block;">Tente recarregar a página ou verifique as permissões do banco de dados.</small></div>`;
}

function renderizarPropostas(propostas) {
    const container = document.getElementById('propostas-list');
    if (!container) return;
    container.innerHTML = '';
    if (!propostas || propostas.length === 0) {
        mostrarMensagemSemPropostas();
        return;
    }
    propostas.forEach(proposta => {
        try {
            if (proposta && proposta.id) {
                const clienteNome = proposta.clientes_hvc?.nome || 'Cliente não especificado';
                const numeroProposta = proposta.numero_proposta || `Proposta ${proposta.id}`;
                const valor = proposta.valor || 0;
                const div = document.createElement('div');
                div.className = 'proposta-item';
                const estaSelecionada = propostasSelecionadas.has(proposta.id);
                
                // CORREÇÃO CRÍTICA: Usar proposta.id diretamente (string UUID)
                div.innerHTML = `<input type="checkbox" id="prop-${proposta.id}" value="${proposta.id}" onchange="window.atualizarSelecaoPropostas(this)" ${estaSelecionada ? 'checked' : ''}><div class="proposta-info"><div class="proposta-numero">${numeroProposta}</div><div>${clienteNome}</div><div class="proposta-valor">${formatarMoeda(valor)}</div></div>`;
                div.dataset.cliente = clienteNome; div.dataset.valor = valor; div.dataset.numero = numeroProposta; 
                div.dataset.propostaId = proposta.id; // ADICIONAR ID COMO DATA ATTRIBUTE
                container.appendChild(div);
            }
        } catch (propostaError) { console.warn('Erro ao renderizar proposta:', propostaError, proposta); }
    });
    atualizarCamposSelecaoDisplay(); // Atualiza o display de contagem
}

function filtrarPropostas() {
    try {
        // Salvar seleções atuais usando IDs string
        const selecoesSalvas = new Set();
        document.querySelectorAll('#propostas-list input[type="checkbox"]:checked').forEach(cb => { 
            if (cb.value && cb.value !== 'undefined' && cb.value !== 'null') {
                selecoesSalvas.add(cb.value); // Manter como string
            }
        });
        
        const filtro = document.getElementById('filtro-propostas')?.value?.toLowerCase() || '';
        
        const propostasFiltradas = propostasDisponiveis.filter(p =>
            (p.numero_proposta?.toLowerCase().includes(filtro) || p.clientes_hvc?.nome?.toLowerCase().includes(filtro))
        );
        renderizarPropostas(propostasFiltradas);
        
        // Restaurar seleções após renderizar
        propostasFiltradas.forEach(p => { 
            if (selecoesSalvas.has(p.id)) { 
                const cb = document.getElementById(`prop-${p.id}`); 
                if (cb) cb.checked = true; 
            } 
        });
        // Atualizar o Set global e o display
        propostasSelecionadas = selecoesSalvas;
        atualizarCamposSelecaoDisplay();

    } catch (error) { console.error('Erro ao filtrar propostas:', error); }
}

// FUNÇÃO CORRIGIDA: atualizarSelecaoPropostas
function atualizarSelecaoPropostas(checkbox) {
    try {
        console.log('🔄 Atualizando seleção de propostas...');
        
        // VALIDAÇÃO CRÍTICA: Verificar se o ID é válido
        if (!checkbox.value || checkbox.value === 'undefined' || checkbox.value === 'null' || checkbox.value === '') {
            console.warn('⚠️ Checkbox com valor inválido encontrado:', checkbox);
            return;
        }
        
        if (checkbox.checked) {
            propostasSelecionadas.add(checkbox.value);
            console.log('✅ Proposta selecionada:', checkbox.value);
        } else {
            propostasSelecionadas.delete(checkbox.value);
            console.log('❌ Proposta desmarcada:', checkbox.value);
        }
        
        console.log('📋 Propostas selecionadas finais:', Array.from(propostasSelecionadas));
        atualizarCamposSelecaoDisplay();
        
    } catch (error) {
        console.error('Erro ao atualizar seleção de propostas:', error);
    }
}
window.atualizarSelecaoPropostas = atualizarSelecaoPropostas; // Expor globalmente para o onchange

// Atualiza apenas o display de contagem e o campo cliente (se houver)
function atualizarCamposSelecaoDisplay() {
    const count = propostasSelecionadas.size;
    const texto = count === 1 ? '1 proposta selecionada' : `${count} propostas selecionadas`;
    const display = document.getElementById('propostas-selecionadas-display');
    if (display) display.textContent = texto;

    // Atualiza campo cliente (pega do primeiro selecionado)
    const clienteInput = document.getElementById('cliente-obra');
    if (clienteInput) {
        if (propostasSelecionadas.size > 0) {
            const primeiroId = propostasSelecionadas.values().next().value;
            const proposta = propostasDisponiveis.find(p => p.id === primeiroId);
            clienteInput.value = proposta?.clientes_hvc?.nome || 'Cliente não encontrado';
        } else {
            clienteInput.value = '';
        }
    }
}

// ===== FUNÇÕES DE OBRAS =====

async function definirProximoNumero() {
    try {
        const { data, error, count } = await supabase
            .from('obras_hvc')
            .select('*', { count: 'exact', head: true }); // Apenas conta

        if (error) {
            console.error('Erro ao contar obras:', error);
            proximoNumeroObra = 1; // Fallback
        } else {
            proximoNumeroObra = (count || 0) + 1;
        }

        const numeroObraInput = document.getElementById('numero-obra');
        if (numeroObraInput && !numeroObraInput.value) { // Só preenche se estiver vazio
            numeroObraInput.value = `${String(proximoNumeroObra).padStart(3, '0')}/${new Date().getFullYear()}`;
        }
    } catch (error) {
        console.error('Erro ao definir próximo número da obra:', error);
        proximoNumeroObra = 1;
    }
}

function formatarNumeroObra() {
    const input = document.getElementById('numero-obra');
    if (input) {
        let value = input.value.replace(/[^0-9]/g, '');
        if (value.length > 3) value = value.substring(0, 3);
        if (value) {
            input.value = `${value.padStart(3, '0')}/${new Date().getFullYear()}`;
        } else {
            input.value = '';
        }
    }
}

async function salvarObra() {
    try {
        const numeroObra = document.getElementById('numero-obra').value;
        const nomeObra = document.getElementById('nome-obra').value;
        const dataInicio = document.getElementById('data-inicio-obra').value;
        const statusObra = document.getElementById('status-obra').value;

        if (!numeroObra || !nomeObra || propostasSelecionadas.size === 0) {
            mostrarErro('Preencha o número, nome da obra e selecione ao menos uma proposta.');
            return;
        }

        const propostasIds = Array.from(propostasSelecionadas);

        // Calcula valor total e pega cliente_id da primeira proposta
        let valorTotalObra = 0;
        let clienteId = null;
        propostasIds.forEach(id => {
            const proposta = propostasDisponiveis.find(p => p.id === id);
            if (proposta) {
                valorTotalObra += parseFloat(proposta.valor) || 0;
                if (!clienteId) clienteId = proposta.cliente_id; // Pega ID do cliente da primeira proposta
            }
        });

        const obraData = {
            numero_obra: numeroObra,
            nome_obra: nomeObra,
            data_inicio: dataInicio || null,
            status: statusObra,
            propostas_ids: propostasIds, // Array de IDs das propostas
            valor_total_propostas: valorTotalObra,
            cliente_id: clienteId // Adiciona cliente_id
        };

        mostrarCarregamento('obras-list', 'Salvando obra...');

        const { data, error } = await supabase
            .from('obras_hvc')
            .insert([obraData])
            .select(); // Retorna o dado inserido

        if (error) {
            console.error('Erro ao salvar obra:', error);
            mostrarErro(`Erro ao salvar obra: ${error.message}`);
            carregarObras(); // Recarrega para limpar o carregamento
            return;
        }

        if (data && data.length > 0) {
            mostrarSucesso('Obra criada com sucesso!');
            // Limpar campos e seleções
            document.getElementById('form-obra').reset(); // Reseta o formulário
            propostasSelecionadas.clear();
            renderizarPropostas(propostasDisponiveis); // Limpa checkboxes
            atualizarCamposSelecaoDisplay(); // Limpa display e cliente
            await definirProximoNumero(); // Define próximo número
            await carregarObras(); // Recarrega a lista de obras
        } else {
            mostrarErro('Obra não foi salva. Resposta inesperada do servidor.');
            carregarObras();
        }

    } catch (error) {
        console.error('Erro inesperado ao salvar obra:', error);
        mostrarErro('Erro inesperado ao salvar obra.');
        carregarObras();
    }
}

async function carregarObras() {
    try {
        mostrarCarregamento('obras-list', 'Carregando obras...');
        const { data: obras, error } = await supabase
            .from('obras_hvc')
            .select('*, medicoes_obra_hvc(count), clientes_hvc(nome)') // Adiciona contagem de medições e nome do cliente
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar obras:', error);
            mostrarErro(`Erro ao carregar obras: ${error.message}`);
            document.getElementById('obras-list').innerHTML = '<p style="color: red;">Erro ao carregar obras.</p>';
            return;
        }

        const container = document.getElementById('obras-list');
        container.innerHTML = ''; // Limpa antes de adicionar

        if (!obras || obras.length === 0) {
            container.innerHTML = '<p>Nenhuma obra encontrada.</p>';
            return;
        }

        obras.forEach(obra => {
            const div = document.createElement('div');
            div.className = 'obra-item'; // Usar a classe CSS definida no HTML
            const clienteNome = obra.clientes_hvc?.nome || 'Cliente não associado';
            div.innerHTML = `
                <div class="obra-header">
                    <h3>${obra.numero_obra} - ${obra.nome_obra}</h3>
                    <span class="obra-status status-${obra.status}">${formatarStatus(obra.status)}</span>
                </div>
                <div class="obra-details">
                    <p><strong>Cliente:</strong> ${clienteNome}</p>
                    <p><strong>Data Início:</strong> ${formatarData(obra.data_inicio)}</p>
                    <p><strong>Valor Propostas:</strong> ${formatarMoeda(obra.valor_total_propostas)}</p>
                    <p><strong>Medições:</strong> ${obra.medicoes_obra_hvc[0]?.count || 0}</p>
                </div>
                <div class="obra-actions">
                    <button class="btn btn-small btn-primary" onclick="window.abrirModalServicos('${obra.id}')"><i class="fas fa-tools"></i> Serviços</button>
                    <button class="btn btn-small btn-warning" onclick="window.abrirModalMedicoes('${obra.id}')"><i class="fas fa-ruler-combined"></i> Medições</button>
                    <button class="btn btn-small btn-danger" onclick="window.excluirObra('${obra.id}')"><i class="fas fa-trash"></i> Excluir</button>
                </div>
                <!-- Áreas para listas (opcional, podem ser preenchidas nos modais) -->
                <!-- <div id="servicos-list-${obra.id}" class="servicos-list"></div> -->
                <!-- <div id="medicoes-list-${obra.id}" class="medicoes-list"></div> -->
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error('Erro inesperado ao carregar obras:', error);
        mostrarErro('Erro inesperado ao carregar obras.');
        document.getElementById('obras-list').innerHTML = '<p style="color: red;">Erro inesperado ao carregar obras.</p>';
    }
}

async function excluirObra(obraId) {
    if (!confirm('Tem certeza que deseja excluir esta obra e todos os seus serviços e medições associados? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        mostrarCarregamento('obras-list', 'Excluindo obra...');

        // Excluir dependências (medições e serviços) - Assumindo que CASCADE está configurado no DB
        // Se não estiver, descomente as linhas abaixo (pode ser mais lento)
        // console.log('Excluindo associações medicoes_servicos_hvc...');
        // const { data: medicoesParaExcluir } = await supabase.from('medicoes_obra_hvc').select('id').eq('obra_id', obraId);
        // if (medicoesParaExcluir && medicoesParaExcluir.length > 0) {
        //     await supabase.from('medicoes_servicos_hvc').delete().in('medicao_id', medicoesParaExcluir.map(m => m.id));
        // }
        // console.log('Excluindo medicoes_obra_hvc...');
        // await supabase.from('medicoes_obra_hvc').delete().eq('obra_id', obraId);
        // console.log('Excluindo servicos_obra_hvc...');
        // await supabase.from('servicos_obra_hvc').delete().eq('obra_id', obraId);

        // Excluir a obra principal (CASCADE deve cuidar do resto se configurado)
        console.log('Excluindo obra principal...');
        const { error } = await supabase.from('obras_hvc').delete().eq('id', obraId);

        if (error) {
            console.error('Erro ao excluir obra:', error);
            mostrarErro(`Erro ao excluir obra: ${error.message}. Verifique se há dependências não resolvidas ou se o CASCADE está configurado corretamente nas chaves estrangeiras.`);
        } else {
            mostrarSucesso('Obra excluída com sucesso!');
        }
        await carregarObras(); // Recarrega a lista

    } catch (error) {
        console.error('Erro inesperado ao excluir obra:', error);
        mostrarErro('Erro inesperado ao excluir obra.');
        await carregarObras();
    }
}
window.excluirObra = excluirObra; // Expor globalmente

// ===== FUNÇÕES DE SERVIÇOS =====

// Abre o modal para adicionar/editar serviços de uma obra específica
async function abrirModalServicos(obraId, servicoParaEditar = null) {
    obraAtual = { id: obraId }; // Define a obra atual
    servicoAtual = servicoParaEditar ? JSON.parse(decodeURIComponent(servicoParaEditar)) : null; // Decodifica e parseia o JSON
    const modal = document.getElementById('modal-servicos');
    const titulo = document.getElementById('modal-servicos-titulo');
    const form = document.getElementById('form-servico');

    if (!modal || !titulo || !form) {
        mostrarErro('Erro ao carregar o modal de serviços. Verifique o HTML.');
        return;
    }

    form.reset(); // Limpa o formulário
    document.getElementById('servico-id').value = '';
    document.getElementById('nome-servico').value = '';
    document.getElementById('valor-servico').value = '';
    document.getElementById('observacao-servico').value = ''; // Limpa observação

    if (servicoAtual) {
        titulo.textContent = 'Editar Serviço';
        document.getElementById('servico-id').value = servicoAtual.id;
        document.getElementById('nome-servico').value = servicoAtual.nome_servico || ''; // CORRIGIDO: usa nome_servico
        document.getElementById('valor-servico').value = formatarMoeda(servicoAtual.valor || 0);
        document.getElementById('observacao-servico').value = servicoAtual.observacao || ''; // Preenche observação
    } else {
        titulo.textContent = 'Adicionar Novo Serviço';
    }

    await carregarServicosDaObra(obraId); // Carrega a lista de serviços existentes no modal
    modal.style.display = 'block';
}
window.abrirModalServicos = abrirModalServicos; // Expor globalmente

// Carrega e exibe a lista de serviços para a obra atual no modal
async function carregarServicosDaObra(obraId) {
    const container = document.getElementById('servicos-existentes-list');
    if (!container) return;

    try {
        mostrarCarregamento(container, 'Carregando serviços...');
        const { data: servicos, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*') // Seleciona todas as colunas, incluindo a nova 'observacao'
            .eq('obra_id', obraId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar serviços:', error);
            // CORRIGIDO: Verifica se o erro é sobre 'descricao'
            if (error.message.includes('descricao')) {
                 mostrarErro("Erro ao carregar serviços: O código foi ajustado para usar 'nome_servico' em vez de 'descricao'. Verifique se a coluna 'nome_servico' existe e se há RLS impedindo o acesso.");
            } else {
                 mostrarErro(`Erro ao carregar serviços: ${error.message}`);
            }
            container.innerHTML = '<p style="color: red;">Erro ao carregar serviços.</p>';
            return;
        }

        container.innerHTML = ''; // Limpa a lista
        if (!servicos || servicos.length === 0) {
            container.innerHTML = '<p class="empty-state"><i class="fas fa-tools"></i> Nenhum serviço cadastrado para esta obra.</p>';
            return;
        }

        servicos.forEach(servico => {
            const div = document.createElement('div');
            div.className = 'item'; // Usar classe genérica 'item' definida no CSS
            // CORRIGIDO: Exibe nome_servico e observacao
            // Passa o objeto serviço como JSON stringificado e URI-encoded para o onclick
            const servicoJsonEncoded = encodeURIComponent(JSON.stringify(servico)); 
            div.innerHTML = `
                <div class="item-header">
                    <div class="item-info">
                        <strong>${servico.nome_servico || 'Serviço sem nome'}</strong> (${formatarMoeda(servico.valor || 0)})
                        ${servico.observacao ? `<p style="font-size: 0.9em; color: #ccc; margin-top: 5px;">Obs: ${servico.observacao}</p>` : ''}
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-small btn-warning" onclick='window.abrirModalServicos("${obraId}", "${servicoJsonEncoded}")'><i class="fas fa-edit"></i></button>
                        <button class="btn btn-small btn-danger" onclick="window.excluirServico('${servico.id}', '${obraId}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error('Erro inesperado ao carregar serviços:', error);
        mostrarErro('Erro inesperado ao carregar serviços.');
        container.innerHTML = '<p style="color: red;">Erro inesperado.</p>';
    }
}

// Salva um serviço (novo ou editado)
async function salvarServico() {
    if (!obraAtual || !obraAtual.id) {
        mostrarErro('Obra não identificada. Feche e abra o modal novamente.');
        return;
    }

    const servicoId = document.getElementById('servico-id').value;
    const nomeServico = document.getElementById('nome-servico').value; // CORRIGIDO: nome_servico
    const valorServicoRaw = document.getElementById('valor-servico').value;
    const observacaoServico = document.getElementById('observacao-servico').value; // Pega observação

    if (!nomeServico) { // CORRIGIDO: nome_servico
        mostrarErro('O nome do serviço é obrigatório.');
        return;
    }

    const valorServico = parseFloat(valorServicoRaw.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

    const servicoData = {
        obra_id: obraAtual.id,
        nome_servico: nomeServico, // CORRIGIDO: nome_servico
        valor: valorServico,
        observacao: observacaoServico || null // Salva observação
    };

    try {
        let response;
        if (servicoId) { // Editando
            response = await supabase
                .from('servicos_obra_hvc')
                .update(servicoData)
                .eq('id', servicoId)
                .select();
        } else { // Criando
            response = await supabase
                .from('servicos_obra_hvc')
                .insert([servicoData])
                .select();
        }

        const { data, error } = response;

        if (error) {
            console.error('Erro ao salvar serviço:', error);
             // CORRIGIDO: Verifica erro específico de coluna
            if (error.message.includes('nome_servico')) {
                 mostrarErro("Erro ao salvar: Verifique se a coluna 'nome_servico' existe na tabela 'servicos_obra_hvc' e se há permissão para acessá-la.");
            } else if (error.message.includes('observacao')) {
                 mostrarErro("Erro ao salvar: Verifique se a coluna 'observacao' existe na tabela 'servicos_obra_hvc' e se há permissão para acessá-la (Execute o SQL fornecido).");
            } else {
                 mostrarErro(`Erro ao salvar serviço: ${error.message}`);
            }
            return;
        }

        if (data && data.length > 0) {
            mostrarSucesso(`Serviço ${servicoId ? 'atualizado' : 'adicionado'} com sucesso!`);
            document.getElementById('form-servico').reset(); // Limpa form
            document.getElementById('servico-id').value = '';
            servicoAtual = null; // Limpa serviço atual
            document.getElementById('modal-servicos-titulo').textContent = 'Adicionar Novo Serviço';
            await carregarServicosDaObra(obraAtual.id); // Recarrega a lista no modal
        } else {
            mostrarErro('Serviço não foi salvo. Resposta inesperada do servidor.');
        }

    } catch (error) {
        console.error('Erro inesperado ao salvar serviço:', error);
        mostrarErro('Erro inesperado ao salvar serviço.');
    }
}
// Não precisa expor globalmente se usar addEventListener pelo ID

// Exclui um serviço
async function excluirServico(servicoId, obraId) {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) {
        return;
    }
    try {
        // Verificar se o serviço está associado a alguma medição
        const { data: medicoesAssociadas, error: checkError } = await supabase
            .from('medicoes_servicos_hvc')
            .select('medicao_id', { count: 'exact', head: true }) // Apenas conta
            .eq('servico_id', servicoId);
            
        if (checkError) {
            console.error('Erro ao verificar medições associadas:', checkError);
            mostrarErro('Não foi possível verificar associações. Exclusão cancelada.');
            return;
        }

        if (medicoesAssociadas?.count > 0) {
            mostrarErro(`Este serviço está associado a ${medicoesAssociadas.count} medição(ões) e não pode ser excluído. Remova-o das medições primeiro.`);
            return;
        }

        // Se não houver associações, excluir o serviço
        const { error } = await supabase.from('servicos_obra_hvc').delete().eq('id', servicoId);
        if (error) {
            console.error('Erro ao excluir serviço:', error);
            mostrarErro(`Erro ao excluir serviço: ${error.message}`);
        } else {
            mostrarSucesso('Serviço excluído com sucesso!');
            await carregarServicosDaObra(obraId); // Recarrega a lista no modal
        }
    } catch (error) {
        console.error('Erro inesperado ao excluir serviço:', error);
        mostrarErro('Erro inesperado ao excluir serviço.');
    }
}
window.excluirServico = excluirServico; // Expor globalmente

// ===== FUNÇÕES DE MEDIÇÕES =====

// Abre o modal para adicionar/editar medições de uma obra específica
async function abrirModalMedicoes(obraId, medicaoParaEditar = null) {
    obraAtual = { id: obraId };
    medicaoAtual = medicaoParaEditar ? JSON.parse(decodeURIComponent(medicaoParaEditar)) : null; // Decodifica e parseia o JSON
    const modal = document.getElementById('modal-medicoes');
    const titulo = document.getElementById('modal-medicoes-titulo');
    const form = document.getElementById('form-medicao');

    if (!modal || !titulo || !form) {
        mostrarErro('Erro ao carregar o modal de medições. Verifique o HTML.');
        return;
    }

    form.reset();
    document.getElementById('medicao-id').value = '';
    document.getElementById('numero-medicao').value = '';
    document.getElementById('data-medicao').value = '';
    document.getElementById('status-medicao').value = 'vai_ser_enviada';
    document.getElementById('valor-medicao').value = '';
    document.getElementById('observacao-medicao').value = ''; // Limpa observação da medição
    document.getElementById('medicao-servicos-list').innerHTML = ''; // Limpa lista de serviços

    // Gerar próximo número da medição (ex: 001/2025)
    if (!medicaoAtual) { // Só gera número se for nova medição
        try {
            const { data: ultimaMedicao, error: numError } = await supabase
                .from('medicoes_obra_hvc')
                .select('numero_medicao')
                .eq('obra_id', obraId)
                .order('created_at', { ascending: false })
                .limit(1);

            let proximoNumero = 1;
            if (!numError && ultimaMedicao && ultimaMedicao.length > 0) {
                const numStr = ultimaMedicao[0].numero_medicao?.split('/')[0];
                if (numStr) {
                    proximoNumero = parseInt(numStr, 10) + 1;
                }
            }
            document.getElementById('numero-medicao').value = `${String(proximoNumero).padStart(3, '0')}/${new Date().getFullYear()}`;

        } catch (e) { console.error('Erro ao gerar num medicao:', e); }
    }

    // Carregar serviços da obra para seleção
    await carregarServicosParaMedicao(obraId);

    let servicosAssociadosIds = new Set();
    if (medicaoAtual) {
        titulo.textContent = 'Editar Medição';
        document.getElementById('medicao-id').value = medicaoAtual.id;
        document.getElementById('numero-medicao').value = medicaoAtual.numero_medicao || '';
        // Formata a data para o input type="date"
        document.getElementById('data-medicao').value = medicaoAtual.data_medicao ? new Date(medicaoAtual.data_medicao).toISOString().split('T')[0] : '';
        document.getElementById('status-medicao').value = medicaoAtual.status || 'vai_ser_enviada';
        document.getElementById('valor-medicao').value = formatarMoeda(medicaoAtual.valor_medicao || 0);
        document.getElementById('observacao-medicao').value = medicaoAtual.observacao || ''; // Preenche observação da medição

        // Marcar serviços já associados (obtidos da query em carregarMedicoesDaObra)
        if (medicaoAtual.medicoes_servicos_hvc && medicaoAtual.medicoes_servicos_hvc.length > 0) {
            medicaoAtual.medicoes_servicos_hvc.forEach(ms => servicosAssociadosIds.add(ms.servico_id));
        }
    } else {
        titulo.textContent = 'Adicionar Nova Medição';
    }

    // Renderizar lista de serviços com checkboxes marcados
    renderizarServicosParaSelecao(servicosAssociadosIds);

    await carregarMedicoesDaObra(obraId); // Carrega a lista de medições existentes no modal
    modal.style.display = 'block';
}
window.abrirModalMedicoes = abrirModalMedicoes; // Expor globalmente

// Carrega os serviços disponíveis para a obra atual
async function carregarServicosParaMedicao(obraId) {
    try {
        const { data, error } = await supabase
            .from('servicos_obra_hvc')
            .select('id, nome_servico, valor') // Seleciona apenas o necessário
            .eq('obra_id', obraId)
            .order('nome_servico', { ascending: true });

        if (error) {
            console.error('Erro ao carregar serviços para medição:', error);
            mostrarErro('Erro ao buscar serviços da obra.');
            servicosDaObraParaMedicao = [];
        } else {
            servicosDaObraParaMedicao = data || [];
        }
    } catch (error) {
        console.error('Erro inesperado ao carregar serviços para medição:', error);
        mostrarErro('Erro inesperado ao buscar serviços.');
        servicosDaObraParaMedicao = [];
    }
}

// Renderiza a lista de serviços com checkboxes no modal de medição
function renderizarServicosParaSelecao(servicosSelecionadosIds = new Set()) {
    const container = document.getElementById('medicao-servicos-list');
    if (!container) return;
    container.innerHTML = ''; // Limpa

    if (servicosDaObraParaMedicao.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding: 10px;"><i class="fas fa-tools"></i> Nenhum serviço cadastrado para esta obra. Adicione serviços antes de criar medições.</p>';
        return;
    }

    servicosDaObraParaMedicao.forEach(servico => {
        const div = document.createElement('div');
        div.className = 'servico-checkbox'; // Usar classe CSS definida
        const isChecked = servicosSelecionadosIds.has(servico.id);
        div.innerHTML = `
            <input type="checkbox" id="med-serv-${servico.id}" value="${servico.id}" ${isChecked ? 'checked' : ''}>
            <label for="med-serv-${servico.id}" class="servico-info">
                <span class="servico-nome">${servico.nome_servico || 'Serviço sem nome'}</span> (${formatarMoeda(servico.valor || 0)})
            </label>
        `;
        container.appendChild(div);
    });
}

// Carrega e exibe a lista de medições existentes para a obra atual no modal
async function carregarMedicoesDaObra(obraId) {
    const container = document.getElementById('medicoes-existentes-list');
    if (!container) return;

    try {
        mostrarCarregamento(container, 'Carregando medições...');

        // CORRIGIDO: Query para buscar medições e serviços associados
        const { data: medicoes, error } = await supabase
            .from('medicoes_obra_hvc')
            .select(`
                *,
                medicoes_servicos_hvc (
                    servico_id,
                    servicos_obra_hvc (
                        id,
                        nome_servico
                    )
                )
            `)
            .eq('obra_id', obraId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar medições:', error);
            // Tenta identificar o erro específico
            if (error.message.includes('servicos_obra_hvc_2')) {
                 mostrarErro('Erro ao carregar medições: Referência incorreta a `servicos_obra_hvc_2` detectada. Verifique RLS, Funções ou Triggers no Supabase que possam conter essa referência antiga.');
            } else if (error.message.includes('descricao')) {
                 mostrarErro("Erro ao carregar medições: Tentativa de acessar coluna 'descricao' que não existe. O código foi ajustado para 'nome_servico'. Verifique RLS ou Funções no Supabase.");
            } else {
                 mostrarErro(`Erro ao carregar medições: ${error.message}`);
            }
            container.innerHTML = '<p style="color: red;">Erro ao carregar medições.</p>';
            return;
        }

        container.innerHTML = ''; // Limpa a lista
        if (!medicoes || medicoes.length === 0) {
            container.innerHTML = '<p class="empty-state"><i class="fas fa-ruler-combined"></i> Nenhum medição cadastrada para esta obra.</p>';
            return;
        }

        medicoes.forEach(medicao => {
            const div = document.createElement('div');
            div.className = 'item'; // Usar classe genérica

            // Monta lista de serviços associados
            let servicosHtml = 'Nenhum serviço associado';
            if (medicao.medicoes_servicos_hvc && medicao.medicoes_servicos_hvc.length > 0) {
                servicosHtml = '<ul style="list-style: none; padding-left: 0; margin-top: 5px;">';
                medicao.medicoes_servicos_hvc.forEach(ms => {
                    const servico = ms.servicos_obra_hvc; // Dados do serviço aninhado
                    if (servico) {
                        servicosHtml += `<li style="font-size: 0.9em; color: #ddd;">- ${servico.nome_servico || 'Serviço Inválido'}</li>`;
                    } else {
                         servicosHtml += `<li style="font-size: 0.9em; color: #f88;">- Serviço ID ${ms.servico_id} não encontrado</li>`;
                    }
                });
                servicosHtml += '</ul>';
            }
            
            // Passa o objeto medicao como JSON stringificado e URI-encoded para o onclick
            const medicaoJsonEncoded = encodeURIComponent(JSON.stringify(medicao));
            div.innerHTML = `
                <div class="item-header">
                    <div class="item-info">
                        <strong>${medicao.numero_medicao}</strong> (${formatarData(medicao.data_medicao)}) - ${formatarMoeda(medicao.valor_medicao)}
                        <span class="status-badge" style="margin-left: 10px; background-color: ${getStatusColor(medicao.status)};">${formatarStatusMedicao(medicao.status)}</span>
                        ${medicao.observacao ? `<p style="font-size: 0.9em; color: #ccc; margin-top: 5px;">Obs: ${medicao.observacao}</p>` : ''}
                        <div class="medicao-servicos-associados" style="margin-top: 10px;">
                            <strong style="font-size: 0.9em; color: #aaa;">Serviços Associados:</strong>
                            ${servicosHtml}
                        </div>
                    </div>
                    <div class="item-actions">
                         <button class="btn btn-small btn-warning" onclick='window.abrirModalMedicoes("${obraId}", "${medicaoJsonEncoded}")'><i class="fas fa-edit"></i></button>
                         <button class="btn btn-small btn-danger" onclick="window.excluirMedicao('${medicao.id}', '${obraId}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error('Erro inesperado ao carregar medições:', error);
        mostrarErro('Erro inesperado ao carregar medições.');
        container.innerHTML = '<p style="color: red;">Erro inesperado.</p>';
    }
}

// Helper para cor do status da medição
function getStatusColor(status) {
    switch (status) {
        case 'vai_ser_enviada': return '#ffc107'; // Amarelo
        case 'enviada': return '#17a2b8'; // Azul info
        case 'recebida': return '#28a745'; // Verde sucesso
        default: return '#6c757d'; // Cinza
    }
}

// Salva uma medição (nova ou editada)
async function salvarMedicao() {
    if (!obraAtual || !obraAtual.id) {
        mostrarErro('Obra não identificada. Feche e abra o modal novamente.');
        return;
    }

    const medicaoId = document.getElementById('medicao-id').value;
    const numeroMedicao = document.getElementById('numero-medicao').value;
    const dataMedicao = document.getElementById('data-medicao').value;
    const statusMedicao = document.getElementById('status-medicao').value;
    const valorMedicaoRaw = document.getElementById('valor-medicao').value;
    const observacaoMedicao = document.getElementById('observacao-medicao').value; // Pega observação da medição

    // Pega os IDs dos serviços selecionados
    const servicosSelecionadosIds = [];
    document.querySelectorAll('#medicao-servicos-list input[type="checkbox"]:checked').forEach(cb => {
        servicosSelecionadosIds.push(cb.value);
    });

    if (!numeroMedicao || !dataMedicao) {
        mostrarErro('Número e Data da Medição são obrigatórios.');
        return;
    }

    const valorMedicao = parseFloat(valorMedicaoRaw.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

    const medicaoData = {
        obra_id: obraAtual.id,
        numero_medicao: numeroMedicao,
        data_medicao: dataMedicao,
        status: statusMedicao,
        valor_medicao: valorMedicao,
        observacao: observacaoMedicao || null // Salva observação da medição
    };

    try {
        let savedMedicaoId = medicaoId;
        let errorMedicao = null;

        // 1. Salvar/Atualizar dados principais da medição
        if (medicaoId) { // Editando
            const { error } = await supabase
                .from('medicoes_obra_hvc')
                .update(medicaoData)
                .eq('id', medicaoId);
            errorMedicao = error;
        } else { // Criando
            const { data, error } = await supabase
                .from('medicoes_obra_hvc')
                .insert([medicaoData])
                .select('id') // Pega o ID da medição criada
                .single(); // Espera um único resultado
            errorMedicao = error;
            if (data) savedMedicaoId = data.id;
        }

        if (errorMedicao) {
            console.error('Erro ao salvar dados da medição:', errorMedicao);
             if (errorMedicao.message.includes('observacao')) {
                 mostrarErro("Erro ao salvar medição: Verifique se a coluna 'observacao' existe na tabela 'medicoes_obra_hvc' (Execute o SQL fornecido).");
            } else {
                 mostrarErro(`Erro ao salvar medição: ${errorMedicao.message}`);
            }
            return;
        }

        if (!savedMedicaoId) {
             mostrarErro('Falha ao obter o ID da medição salva.');
             return;
        }

        // 2. Gerenciar associações na tabela medicoes_servicos_hvc
        // Primeiro, remove todas as associações existentes para esta medição
        const { error: deleteError } = await supabase
            .from('medicoes_servicos_hvc')
            .delete()
            .eq('medicao_id', savedMedicaoId);

        if (deleteError) {
            console.error('Erro ao limpar associações de serviços antigas:', deleteError);
            mostrarErro('Erro ao atualizar serviços associados (limpeza). A medição foi salva, mas os serviços podem estar incorretos.');
            // Continua para tentar inserir os novos
        }

        // Segundo, insere as novas associações selecionadas
        if (servicosSelecionadosIds.length > 0) {
            const associacoesParaInserir = servicosSelecionadosIds.map(servicoId => ({
                medicao_id: savedMedicaoId,
                servico_id: servicoId
                // Adicione observacao aqui se a tabela medicoes_servicos_hvc tiver essa coluna e você quiser usá-la
                // observacao: document.getElementById(`obs-serv-${servicoId}`)?.value || null
            }));

            const { error: insertError } = await supabase
                .from('medicoes_servicos_hvc')
                .insert(associacoesParaInserir);

            if (insertError) {
                console.error('Erro ao inserir novas associações de serviços:', insertError);
                mostrarErro('Erro ao salvar associação de serviços. A medição foi salva, mas os serviços podem não ter sido associados corretamente.');
                // Não retorna, pois a medição principal foi salva
            }
        }

        // Sucesso geral
        mostrarSucesso(`Medição ${medicaoId ? 'atualizada' : 'adicionada'} com sucesso!`);
        document.getElementById('form-medicao').reset();
        document.getElementById('medicao-id').value = '';
        medicaoAtual = null;
        document.getElementById('modal-medicoes-titulo').textContent = 'Adicionar Nova Medição';
        await carregarMedicoesDaObra(obraAtual.id); // Recarrega a lista no modal
        // Recarrega a lista principal de obras também para atualizar contagem
        await carregarObras(); 

    } catch (error) {
        console.error('Erro inesperado ao salvar medição:', error);
        mostrarErro('Erro inesperado ao salvar medição.');
    }
}
// Não precisa expor globalmente se usar addEventListener pelo ID

// Exclui uma medição
async function excluirMedicao(medicaoId, obraId) {
    if (!confirm('Tem certeza que deseja excluir esta medição e suas associações de serviços?')) {
        return;
    }
    try {
        // Excluir associações primeiro
        await supabase.from('medicoes_servicos_hvc').delete().eq('medicao_id', medicaoId);

        // Excluir a medição
        const { error } = await supabase.from('medicoes_obra_hvc').delete().eq('id', medicaoId);

        if (error) {
            console.error('Erro ao excluir medição:', error);
            mostrarErro(`Erro ao excluir medição: ${error.message}`);
        } else {
            mostrarSucesso('Medição excluída com sucesso!');
            await carregarMedicoesDaObra(obraId); // Recarrega a lista no modal
            // Recarrega a lista principal de obras também para atualizar contagem
            await carregarObras(); 
        }
    } catch (error) {
        console.error('Erro inesperado ao excluir medição:', error);
        mostrarErro('Erro inesperado ao excluir medição.');
    }
}
window.excluirMedicao = excluirMedicao; // Expor globalmente

// ===== FUNÇÕES DE UTILIDADE =====

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    obraAtual = null; // Limpa a obra/medição/serviço atual ao fechar qualquer modal
    medicaoAtual = null;
    servicoAtual = null;
    servicosDaObraParaMedicao = []; // Limpa cache de serviços
}
window.fecharModal = fecharModal; // Expor globalmente

function formatarValorMonetario(event) {
    let value = event.target.value.replace(/\D/g, '');
    value = (parseInt(value, 10) / 100).toFixed(2);
    if (isNaN(value) || value === 'NaN') value = '0.00';
    event.target.value = formatarMoeda(value);
}

// Adicione esta linha no final, se ainda não existir, para garantir que os botões funcionem
document.addEventListener('DOMContentLoaded', setupEventListeners);

