// dashboard-hvc.js - Dashboard Analítico HVC
import { supabase } from "./supabase.js";

// Elementos DOM
const addTarefaForm = document.getElementById("add-tarefa-form");
const tarefaTituloInput = document.getElementById("tarefa-titulo");
const tarefaPrioridadeSelect = document.getElementById("tarefa-prioridade");
const tarefaVencimentoInput = document.getElementById("tarefa-vencimento");
const tarefaObraSelect = document.getElementById("tarefa-obra");
const tarefaPropostaSelect = document.getElementById("tarefa-proposta");
const tarefaDescricaoTextarea = document.getElementById("tarefa-descricao");

// Filtros
const filtroStatusSelect = document.getElementById("filtro-status");
const filtroPrioridadeSelect = document.getElementById("filtro-prioridade");

// Listas
const tarefasList = document.getElementById("tarefas-list");
const insightsList = document.getElementById("insights-list");

// Variáveis globais
let dashboardData = {
    propostas: [],
    obras: [],
    servicos: [],
    medicoes: [],
    fluxoCaixa: [],
    tarefas: []
};

let currentUserId = null;

// Verificação de acesso
async function checkAccess() {
    const userLevel = sessionStorage.getItem("nivel");
    const userProject = sessionStorage.getItem("projeto");
    const userId = sessionStorage.getItem("userId");
    
    if (userLevel !== 'admin' && userProject !== 'Hvc') {
        alert("Acesso não autorizado. Esta funcionalidade é exclusiva do projeto HVC.");
        window.location.href = "index.html";
        return false;
    }
    
    currentUserId = userId;
    return true;
}

// Alternar tabs
window.switchTab = (tabName) => {
    // Remover active de todos os botões e conteúdos
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Ativar tab selecionada
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Carregar dados específicos da tab
    if (tabName === 'insights') {
        generateInsights();
    } else if (tabName === 'tarefas') {
        loadTarefasData();
    }
};

// Carregar todos os dados do dashboard
async function loadDashboardData() {
    try {
        // Carregar propostas
        const { data: propostas, error: propostasError } = await supabase
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc (nome)
            `);
        
        if (propostasError) throw propostasError;
        dashboardData.propostas = propostas || [];

        // Carregar obras
        const { data: obras, error: obrasError } = await supabase
            .from('obras_hvc')
            .select(`
                *,
                clientes_hvc (nome),
                propostas_obra_hvc (
                    propostas_hvc (valor)
                )
            `);
        
        if (obrasError) throw obrasError;
        dashboardData.obras = obras || [];

        // Carregar serviços
        const { data: servicos, error: servicosError } = await supabase
            .from('servicos_obra_hvc')
            .select('*');
        
        if (servicosError) throw servicosError;
        dashboardData.servicos = servicos || [];

        // Carregar medições
        const { data: medicoes, error: medicoesError } = await supabase
            .from('medicoes_obra_hvc')
            .select('*');
        
        if (medicoesError) throw medicoesError;
        dashboardData.medicoes = medicoes || [];

        // Carregar fluxo de caixa
        const { data: fluxoCaixa, error: fluxoError } = await supabase
            .from('fluxo_caixa_hvc')
            .select('*');
        
        if (fluxoError) throw fluxoError;
        dashboardData.fluxoCaixa = fluxoCaixa || [];

        // Atualizar métricas
        updateMetrics();
        updateEvolutionMetrics();
        updateFinancialMetrics();
        
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        alert('Erro ao carregar dados do dashboard.');
    }
}

// Atualizar métricas principais
function updateMetrics() {
    const { propostas, obras, fluxoCaixa } = dashboardData;
    
    // Total de propostas
    document.getElementById('total-propostas').textContent = propostas.length;
    
    // Obras ativas (não concluídas)
    const obrasAtivas = obras.filter(obra => obra.status !== 'Concluída');
    document.getElementById('total-obras').textContent = obrasAtivas.length;
    
    // Valor total em obras
    const valorTotal = obras.reduce((sum, obra) => sum + parseFloat(obra.valor_total || 0), 0);
    document.getElementById('valor-total').textContent = valorTotal.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    // Saldo do fluxo de caixa
    const recebimentos = fluxoCaixa
        .filter(item => item.tipo_movimento === 'Recebimento')
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    const pagamentos = fluxoCaixa
        .filter(item => item.tipo_movimento === 'Pagamento')
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    const saldo = recebimentos - pagamentos;
    document.getElementById('saldo-fluxo').textContent = saldo.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    // Atualizar indicadores de mudança (simulado)
    updateChangeIndicators();
}

// Atualizar indicadores de mudança
function updateChangeIndicators() {
    const { propostas, obras } = dashboardData;
    
    // Propostas aprovadas vs total
    const propostasAprovadas = propostas.filter(p => p.status === 'Aprovada').length;
    const taxaAprovacao = propostas.length > 0 ? (propostasAprovadas / propostas.length * 100).toFixed(1) : 0;
    
    document.getElementById('propostas-change').innerHTML = `
        <span class="metric-positive">
            <i class="fas fa-arrow-up"></i> ${taxaAprovacao}% aprovadas
        </span>
    `;
    
    // Obras em andamento
    const obrasAndamento = obras.filter(o => o.status === 'Iniciado').length;
    document.getElementById('obras-change').innerHTML = `
        <span class="metric-neutral">
            <i class="fas fa-tools"></i> ${obrasAndamento} em andamento
        </span>
    `;
    
    // Valor médio por obra
    const valorMedio = obras.length > 0 ? 
        obras.reduce((sum, obra) => sum + parseFloat(obra.valor_total || 0), 0) / obras.length : 0;
    
    document.getElementById('valor-change').innerHTML = `
        <span class="metric-neutral">
            <i class="fas fa-calculator"></i> Média: ${valorMedio.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            })}
        </span>
    `;
    
    // Status do saldo
    const { fluxoCaixa } = dashboardData;
    const recebimentos = fluxoCaixa
        .filter(item => item.tipo_movimento === 'Recebimento')
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    const pagamentos = fluxoCaixa
        .filter(item => item.tipo_movimento === 'Pagamento')
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    const saldo = recebimentos - pagamentos;
    const saldoClass = saldo >= 0 ? 'metric-positive' : 'metric-negative';
    const saldoIcon = saldo >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    
    document.getElementById('saldo-change').innerHTML = `
        <span class="${saldoClass}">
            <i class="fas ${saldoIcon}"></i> ${saldo >= 0 ? 'Positivo' : 'Negativo'}
        </span>
    `;
}

// Atualizar métricas de evolução
function updateEvolutionMetrics() {
    const { propostas, obras, servicos, medicoes } = dashboardData;
    
    // Propostas aprovadas
    const propostasAprovadas = propostas.filter(p => p.status === 'Aprovada').length;
    document.getElementById('propostas-aprovadas').textContent = propostasAprovadas;
    
    // Obras concluídas
    const obrasConcluidas = obras.filter(o => o.status === 'Concluída').length;
    document.getElementById('obras-concluidas').textContent = obrasConcluidas;
    
    // Serviços em andamento
    const servicosAndamento = servicos.filter(s => s.iniciado && !s.concluido).length;
    document.getElementById('servicos-andamento').textContent = servicosAndamento;
    
    // Medições pendentes (não pagas)
    const medicoesPendentes = medicoes.filter(m => !m.pago).length;
    document.getElementById('medicoes-pendentes').textContent = medicoesPendentes;
}

// Atualizar métricas financeiras
function updateFinancialMetrics() {
    const { fluxoCaixa, obras, medicoes } = dashboardData;
    
    // Total de recebimentos
    const totalRecebimentos = fluxoCaixa
        .filter(item => item.tipo_movimento === 'Recebimento')
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    document.getElementById('total-recebimentos').textContent = totalRecebimentos.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    // Total de pagamentos
    const totalPagamentos = fluxoCaixa
        .filter(item => item.tipo_movimento === 'Pagamento')
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    document.getElementById('total-pagamentos').textContent = totalPagamentos.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    // Valor a receber (obras não concluídas + medições não pagas)
    const valorObrasAtivas = obras
        .filter(obra => obra.status !== 'Concluída')
        .reduce((sum, obra) => sum + parseFloat(obra.valor_total || 0), 0);
    
    const valorMedicoesPendentes = medicoes
        .filter(m => !m.pago)
        .reduce((sum, m) => sum + parseFloat(m.valor_medicao || 0), 0);
    
    const valorAReceber = valorObrasAtivas + valorMedicoesPendentes - totalRecebimentos;
    
    document.getElementById('valor-a-receber').textContent = Math.max(0, valorAReceber).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    // Margem de lucro
    const margemLucro = totalRecebimentos > 0 ? 
        ((totalRecebimentos - totalPagamentos) / totalRecebimentos * 100).toFixed(1) : 0;
    
    document.getElementById('margem-lucro').textContent = `${margemLucro}%`;
}

// Gerar insights
function generateInsights() {
    const { propostas, obras, servicos, medicoes, fluxoCaixa } = dashboardData;
    
    const insights = [];
    
    // Insight sobre propostas
    const taxaAprovacao = propostas.length > 0 ? 
        (propostas.filter(p => p.status === 'Aprovada').length / propostas.length * 100).toFixed(1) : 0;
    
    if (taxaAprovacao < 50) {
        insights.push({
            title: "Taxa de Aprovação Baixa",
            content: `Apenas ${taxaAprovacao}% das propostas foram aprovadas. Considere revisar a estratégia de precificação ou qualificação de leads.`,
            type: "warning"
        });
    } else if (taxaAprovacao > 80) {
        insights.push({
            title: "Excelente Taxa de Aprovação",
            content: `${taxaAprovacao}% das propostas foram aprovadas! Considere aumentar a capacidade de produção ou os preços.`,
            type: "success"
        });
    }
    
    // Insight sobre obras
    const obrasAtrasadas = obras.filter(obra => {
        const servicosObra = servicos.filter(s => s.obra_id === obra.id);
        const servicosIniciados = servicosObra.filter(s => s.iniciado);
        const servicosConcluidos = servicosObra.filter(s => s.concluido);
        
        return servicosIniciados.length > 0 && servicosConcluidos.length === 0 && 
               obra.created_at < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }).length;
    
    if (obrasAtrasadas > 0) {
        insights.push({
            title: "Obras com Possível Atraso",
            content: `${obrasAtrasadas} obra(s) foram iniciadas há mais de 30 dias sem conclusão. Verifique o andamento dos serviços.`,
            type: "warning"
        });
    }
    
    // Insight sobre fluxo de caixa
    const recebimentosUltimos30Dias = fluxoCaixa
        .filter(item => 
            item.tipo_movimento === 'Recebimento' && 
            new Date(item.data_movimento) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    const pagamentosUltimos30Dias = fluxoCaixa
        .filter(item => 
            item.tipo_movimento === 'Pagamento' && 
            new Date(item.data_movimento) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
        .reduce((sum, item) => sum + parseFloat(item.valor), 0);
    
    const saldoMensal = recebimentosUltimos30Dias - pagamentosUltimos30Dias;
    
    if (saldoMensal < 0) {
        insights.push({
            title: "Fluxo de Caixa Negativo",
            content: `O saldo dos últimos 30 dias foi negativo em ${Math.abs(saldoMensal).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            })}. Monitore os pagamentos e acelere os recebimentos.`,
            type: "danger"
        });
    }
    
    // Insight sobre medições
    const medicoesPendentes = medicoes.filter(m => !m.pago).length;
    if (medicoesPendentes > 5) {
        insights.push({
            title: "Muitas Medições Pendentes",
            content: `Existem ${medicoesPendentes} medições não pagas. Considere acelerar o processo de cobrança.`,
            type: "warning"
        });
    }
    
    // Insight sobre produtividade
    const servicosConcluidos = servicos.filter(s => s.concluido).length;
    const servicosTotal = servicos.length;
    const produtividade = servicosTotal > 0 ? (servicosConcluidos / servicosTotal * 100).toFixed(1) : 0;
    
    if (produtividade > 90) {
        insights.push({
            title: "Alta Produtividade",
            content: `${produtividade}% dos serviços foram concluídos. Excelente performance da equipe!`,
            type: "success"
        });
    } else if (produtividade < 60) {
        insights.push({
            title: "Produtividade Baixa",
            content: `Apenas ${produtividade}% dos serviços foram concluídos. Verifique possíveis gargalos na execução.`,
            type: "warning"
        });
    }
    
    // Renderizar insights
    renderInsights(insights);
}

// Renderizar insights
function renderInsights(insights) {
    if (insights.length === 0) {
        insightsList.innerHTML = `
            <div class="insight-card">
                <div class="insight-title">
                    <i class="fas fa-check-circle"></i> Tudo em Ordem
                </div>
                <div class="insight-content">
                    Não foram identificados pontos de atenção no momento. Continue monitorando os indicadores.
                </div>
            </div>
        `;
        return;
    }
    
    insightsList.innerHTML = insights.map(insight => {
        const iconMap = {
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            danger: 'fa-exclamation-circle'
        };
        
        const colorMap = {
            success: '#90EE90',
            warning: '#FFA500',
            danger: '#FFB6C1'
        };
        
        return `
            <div class="insight-card" style="border-left-color: ${colorMap[insight.type]};">
                <div class="insight-title">
                    <i class="fas ${iconMap[insight.type]}"></i> ${insight.title}
                </div>
                <div class="insight-content">
                    ${insight.content}
                </div>
            </div>
        `;
    }).join('');
}

// Carregar dados para tarefas
async function loadTarefasData() {
    try {
        // Carregar obras para o select
        const { data: obras, error: obrasError } = await supabase
            .from('obras_hvc')
            .select('id, numero_obra')
            .order('numero_obra');
        
        if (obrasError) throw obrasError;
        
        tarefaObraSelect.innerHTML = '<option value="">Obra Relacionada (opcional)</option>';
        (obras || []).forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = obra.numero_obra;
            tarefaObraSelect.appendChild(option);
        });
        
        // Carregar propostas para o select
        const { data: propostas, error: propostasError } = await supabase
            .from('propostas_hvc')
            .select('id, numero_proposta')
            .order('numero_proposta');
        
        if (propostasError) throw propostasError;
        
        tarefaPropostaSelect.innerHTML = '<option value="">Proposta Relacionada (opcional)</option>';
        (propostas || []).forEach(proposta => {
            const option = document.createElement('option');
            option.value = proposta.id;
            option.textContent = proposta.numero_proposta;
            tarefaPropostaSelect.appendChild(option);
        });
        
        // Carregar tarefas
        await loadTarefas();
        
    } catch (error) {
        console.error('Erro ao carregar dados para tarefas:', error);
    }
}

// Carregar tarefas
async function loadTarefas() {
    try {
        const { data, error } = await supabase
            .from('tarefas_dashboard_hvc')
            .select(`
                *,
                obras_hvc (numero_obra),
                propostas_hvc (numero_proposta)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        dashboardData.tarefas = data || [];
        renderTarefas();
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
    }
}

// Renderizar tarefas
function renderTarefas() {
    const filtroStatus = filtroStatusSelect.value;
    const filtroPrioridade = filtroPrioridadeSelect.value;
    
    let tarefasFiltradas = dashboardData.tarefas;
    
    if (filtroStatus) {
        tarefasFiltradas = tarefasFiltradas.filter(t => t.status === filtroStatus);
    }
    
    if (filtroPrioridade) {
        tarefasFiltradas = tarefasFiltradas.filter(t => t.prioridade === filtroPrioridade);
    }
    
    if (tarefasFiltradas.length === 0) {
        tarefasList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhuma tarefa encontrada</p>';
        return;
    }
    
    tarefasList.innerHTML = tarefasFiltradas.map(tarefa => {
        const vencimentoFormatado = tarefa.data_vencimento ? 
            new Date(tarefa.data_vencimento).toLocaleDateString('pt-BR') : 'Sem prazo';
        
        const isVencida = tarefa.data_vencimento && 
            new Date(tarefa.data_vencimento) < new Date() && 
            tarefa.status !== 'Concluída';
        
        return `
            <div class="tarefa-item ${isVencida ? 'tarefa-vencida' : ''}">
                <div class="tarefa-header">
                    <div class="tarefa-title">${tarefa.titulo}</div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="hvc-btn" onclick="editTarefa('${tarefa.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="hvc-btn hvc-btn-danger" onclick="deleteTarefa('${tarefa.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                ${tarefa.descricao ? `<p style="color: #c0c0c0; margin-bottom: 0.5rem;">${tarefa.descricao}</p>` : ''}
                
                <div class="tarefa-meta">
                    <span class="priority-badge priority-${tarefa.prioridade.toLowerCase()}">${tarefa.prioridade}</span>
                    <span class="status-badge status-${tarefa.status.toLowerCase().replace(/\s+/g, '-')}">${tarefa.status}</span>
                    <small style="color: #c0c0c0;">
                        <i class="fas fa-calendar"></i> ${vencimentoFormatado}
                        ${isVencida ? '<span style="color: #FFB6C1; font-weight: bold;"> (VENCIDA)</span>' : ''}
                    </small>
                    ${tarefa.obras_hvc?.numero_obra ? `<small style="color: #c0c0c0;"><i class="fas fa-building"></i> ${tarefa.obras_hvc.numero_obra}</small>` : ''}
                    ${tarefa.propostas_hvc?.numero_proposta ? `<small style="color: #c0c0c0;"><i class="fas fa-file-contract"></i> ${tarefa.propostas_hvc.numero_proposta}</small>` : ''}
                </div>
                
                <div style="margin-top: 0.5rem;">
                    <select onchange="updateTarefaStatus('${tarefa.id}', this.value)" style="background: rgba(0,0,128,0.2); border: 1px solid rgba(255,255,255,0.3); color: #e0e0e0; padding: 0.3rem; border-radius: 4px;">
                        <option value="Pendente" ${tarefa.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Em Andamento" ${tarefa.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="Concluída" ${tarefa.status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
            </div>
        `;
    }).join('');
}

// Filtrar tarefas
window.filterTarefas = () => {
    renderTarefas();
};

// Adicionar tarefa
addTarefaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const titulo = tarefaTituloInput.value.trim();
    const prioridade = tarefaPrioridadeSelect.value;
    const vencimento = tarefaVencimentoInput.value;
    const obraId = tarefaObraSelect.value;
    const propostaId = tarefaPropostaSelect.value;
    const descricao = tarefaDescricaoTextarea.value.trim();
    
    if (!titulo || !prioridade) {
        alert('Por favor, preencha o título e a prioridade.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('tarefas_dashboard_hvc')
            .insert([{
                titulo,
                prioridade,
                data_vencimento: vencimento || null,
                obra_id: obraId || null,
                proposta_id: propostaId || null,
                descricao: descricao || null,
                created_by: currentUserId
            }]);

        if (error) throw error;

        addTarefaForm.reset();
        await loadTarefas();
        
        alert('Tarefa adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar tarefa:', error);
        alert('Erro ao adicionar tarefa.');
    }
});

// Atualizar status da tarefa
window.updateTarefaStatus = async (tarefaId, novoStatus) => {
    try {
        const { error } = await supabase
            .from('tarefas_dashboard_hvc')
            .update({ status: novoStatus })
            .eq('id', tarefaId);

        if (error) throw error;

        // Atualizar localmente
        const tarefa = dashboardData.tarefas.find(t => t.id === tarefaId);
        if (tarefa) {
            tarefa.status = novoStatus;
        }
        
        renderTarefas();
    } catch (error) {
        console.error('Erro ao atualizar status da tarefa:', error);
        alert('Erro ao atualizar status da tarefa.');
    }
};

// Editar tarefa
window.editTarefa = async (tarefaId) => {
    const tarefa = dashboardData.tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;
    
    const novoTitulo = prompt('Título da tarefa:', tarefa.titulo);
    if (novoTitulo === null) return;
    
    const novaDescricao = prompt('Descrição da tarefa:', tarefa.descricao || '');
    if (novaDescricao === null) return;
    
    try {
        const { error } = await supabase
            .from('tarefas_dashboard_hvc')
            .update({ 
                titulo: novoTitulo.trim(),
                descricao: novaDescricao.trim() || null
            })
            .eq('id', tarefaId);

        if (error) throw error;

        await loadTarefas();
        alert('Tarefa atualizada com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error);
        alert('Erro ao atualizar tarefa.');
    }
};

// Excluir tarefa
window.deleteTarefa = async (tarefaId) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('tarefas_dashboard_hvc')
            .delete()
            .eq('id', tarefaId);

        if (error) throw error;

        await loadTarefas();
        alert('Tarefa excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir tarefa:', error);
        alert('Erro ao excluir tarefa.');
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAccess()) {
        await loadDashboardData();
        
        // Atualizar dados a cada 5 minutos
        setInterval(loadDashboardData, 5 * 60 * 1000);
    }
});

