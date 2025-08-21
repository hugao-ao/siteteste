// ========================================
// SISTEMA DE EQUIPES HVC - VERSÃO OTIMIZADA
// ========================================

// Aguardar carregamento do Supabase
let supabaseClient = null;
let integrantesData = [];
let equipesData = [];
let funcoesData = [];
let integrantesSelecionados = new Set();

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando sistema de equipes HVC...');
    
    // Aguardar Supabase estar disponível
    await waitForSupabase();
    
    // Carregar dados iniciais
    await carregarDadosIniciais();
    
    // Configurar eventos
    configurarEventos();
    
    console.log('✅ Sistema de equipes HVC inicializado!');
});

// Aguardar Supabase estar disponível
async function waitForSupabase() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        if (window.supabase || window.supabaseClient) {
            supabaseClient = window.supabase || window.supabaseClient;
            console.log('✅ Supabase conectado!');
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    console.error('❌ Timeout aguardando Supabase');
    showNotification('Erro ao conectar com o banco de dados', 'error');
}

// ========================================
// CARREGAMENTO DE DADOS
// ========================================

async function carregarDadosIniciais() {
    try {
        showLoading('Carregando dados...');
        
        // Carregar em paralelo para melhor performance
        const [funcoes, integrantes, equipes] = await Promise.all([
            carregarFuncoes(),
            carregarIntegrantes(),
            carregarEquipes()
        ]);
        
        // Atualizar estatísticas
        atualizarEstatisticas();
        
        hideLoading();
        console.log('✅ Dados carregados com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados: ' + error.message, 'error');
        hideLoading();
    }
}

async function carregarFuncoes() {
    try {
        const { data, error } = await supabaseClient
            .from('funcoes_hvc')
            .select('*')
            .order('nome');
            
        if (error) throw error;
        
        funcoesData = data || [];
        atualizarSelectFuncoes();
        atualizarTabelaFuncoes();
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar funções:', error);
        throw error;
    }
}

async function carregarIntegrantes() {
    try {
        const { data, error } = await supabaseClient
            .from('integrantes_hvc')
            .select(`
                *,
                funcoes_hvc (
                    id,
                    nome
                )
            `)
            .order('nome');
            
        if (error) throw error;
        
        integrantesData = data || [];
        atualizarTabelaIntegrantes();
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar integrantes:', error);
        throw error;
    }
}

async function carregarEquipes() {
    try {
        const { data, error } = await supabaseClient
            .from('equipes_hvc')
            .select(`
                *,
                equipe_integrantes (
                    integrantes_hvc (
                        id,
                        nome,
                        funcoes_hvc (
                            nome
                        )
                    )
                )
            `)
            .order('numero');
            
        if (error) throw error;
        
        equipesData = data || [];
        atualizarTabelaEquipes();
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar equipes:', error);
        throw error;
    }
}

// ========================================
// ATUALIZAÇÃO DE INTERFACE
// ========================================

function atualizarEstatisticas() {
    document.getElementById('total-integrantes').textContent = integrantesData.length;
    document.getElementById('total-equipes').textContent = equipesData.length;
    document.getElementById('total-funcoes').textContent = funcoesData.length;
}

function atualizarSelectFuncoes() {
    const select = document.getElementById('funcao-integrante');
    if (!select) return;
    
    // Limpar opções existentes (exceto a primeira)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Adicionar funções
    funcoesData.forEach(funcao => {
        const option = document.createElement('option');
        option.value = funcao.id;
        option.textContent = funcao.nome;
        select.appendChild(option);
    });
}

function atualizarTabelaIntegrantes() {
    const loading = document.getElementById('integrantes-loading');
    const empty = document.getElementById('integrantes-empty');
    const table = document.getElementById('integrantes-table');
    const tbody = document.getElementById('integrantes-tbody');
    
    loading.style.display = 'none';
    
    if (integrantesData.length === 0) {
        empty.style.display = 'block';
        table.style.display = 'none';
        return;
    }
    
    empty.style.display = 'none';
    table.style.display = 'table';
    
    tbody.innerHTML = '';
    
    integrantesData.forEach(integrante => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${integrante.nome}</td>
            <td>${integrante.funcoes_hvc?.nome || 'Não definida'}</td>
            <td>${integrante.whatsapp}</td>
            <td>${integrante.cpf}</td>
            <td>
                <button class="btn-secondary" onclick="editarIntegrante('${integrante.id}')" style="padding: 0.5rem; margin-right: 0.5rem;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-secondary" onclick="excluirIntegrante('${integrante.id}')" style="padding: 0.5rem; background: #dc3545; border-color: #dc3545;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function atualizarTabelaEquipes() {
    const loading = document.getElementById('equipes-loading');
    const empty = document.getElementById('equipes-empty');
    const table = document.getElementById('equipes-table');
    const tbody = document.getElementById('equipes-tbody');
    
    loading.style.display = 'none';
    
    if (equipesData.length === 0) {
        empty.style.display = 'block';
        table.style.display = 'none';
        return;
    }
    
    empty.style.display = 'none';
    table.style.display = 'table';
    
    tbody.innerHTML = '';
    
    equipesData.forEach(equipe => {
        const integrantes = equipe.equipe_integrantes || [];
        const integrantesNomes = integrantes.map(ei => ei.integrantes_hvc?.nome).filter(Boolean);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${equipe.numero}</td>
            <td>${integrantesNomes.length} integrante(s)</td>
            <td>
                <span style="color: ${equipe.status === 'ativa' ? '#28a745' : '#ffc107'};">
                    ${equipe.status || 'ativa'}
                </span>
            </td>
            <td>${new Date(equipe.created_at).toLocaleDateString('pt-BR')}</td>
            <td>
                <button class="btn-secondary" onclick="verEquipe('${equipe.id}')" style="padding: 0.5rem; margin-right: 0.5rem;">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-secondary" onclick="editarEquipe('${equipe.id}')" style="padding: 0.5rem; margin-right: 0.5rem;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-secondary" onclick="excluirEquipe('${equipe.id}')" style="padding: 0.5rem; background: #dc3545; border-color: #dc3545;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function atualizarTabelaFuncoes() {
    const loading = document.getElementById('funcoes-loading');
    const list = document.getElementById('funcoes-list');
    const tbody = document.getElementById('funcoes-tbody');
    
    loading.style.display = 'none';
    list.style.display = 'block';
    
    tbody.innerHTML = '';
    
    funcoesData.forEach(funcao => {
        // Contar integrantes desta função
        const integrantesCount = integrantesData.filter(i => i.funcao_id === funcao.id).length;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${funcao.nome}</td>
            <td>${integrantesCount}</td>
            <td>
                <button class="btn-secondary" onclick="excluirFuncao('${funcao.id}')" style="padding: 0.5rem; background: #dc3545; border-color: #dc3545;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ========================================
// MODAIS
// ========================================

function openNovaEquipeModal() {
    document.getElementById('modal-nova-equipe').style.display = 'block';
    carregarIntegrantesParaSelecao();
    limparFormularioEquipe();
}

function closeEquipeModal() {
    document.getElementById('modal-nova-equipe').style.display = 'none';
    integrantesSelecionados.clear();
    atualizarContadorSelecao();
}

function openIntegranteModal() {
    document.getElementById('modal-novo-integrante').style.display = 'block';
    limparFormularioIntegrante();
}

function closeIntegranteModal() {
    document.getElementById('modal-novo-integrante').style.display = 'none';
}

function openFuncoesModal() {
    document.getElementById('modal-funcoes').style.display = 'block';
    atualizarTabelaFuncoes();
}

function closeFuncoesModal() {
    document.getElementById('modal-funcoes').style.display = 'none';
    cancelNovaFuncao();
}

function openNovaFuncaoForm() {
    document.getElementById('nova-funcao-form').style.display = 'block';
    document.getElementById('nome-funcao').focus();
}

function cancelNovaFuncao() {
    document.getElementById('nova-funcao-form').style.display = 'none';
    document.getElementById('nome-funcao').value = '';
}

// ========================================
// SELEÇÃO DE INTEGRANTES
// ========================================

async function carregarIntegrantesParaSelecao() {
    const loading = document.getElementById('integrantes-loading-modal');
    const container = document.getElementById('integrantes-selection');
    
    loading.style.display = 'flex';
    container.style.display = 'none';
    
    try {
        // Garantir que temos os dados mais recentes
        await carregarIntegrantes();
        
        container.innerHTML = '';
        
        if (integrantesData.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: rgba(224, 224, 224, 0.6);">Nenhum integrante cadastrado</p>';
        } else {
            integrantesData.forEach(integrante => {
                const item = document.createElement('div');
                item.className = 'integrante-item';
                item.onclick = () => toggleIntegrante(integrante.id);
                
                item.innerHTML = `
                    <div class="integrante-checkbox" id="checkbox-${integrante.id}"></div>
                    <div class="integrante-info">
                        <div class="integrante-nome">${integrante.nome}</div>
                        <div class="integrante-funcao">${integrante.funcoes_hvc?.nome || 'Função não definida'}</div>
                        <div class="integrante-contato">${integrante.whatsapp}</div>
                    </div>
                `;
                
                container.appendChild(item);
            });
        }
        
        loading.style.display = 'none';
        container.style.display = 'block';
        atualizarContadorSelecao();
        
    } catch (error) {
        console.error('❌ Erro ao carregar integrantes para seleção:', error);
        showNotification('Erro ao carregar integrantes', 'error');
        loading.style.display = 'none';
    }
}

function toggleIntegrante(integranteId) {
    const checkbox = document.getElementById(`checkbox-${integranteId}`);
    const item = checkbox.parentElement;
    
    if (integrantesSelecionados.has(integranteId)) {
        integrantesSelecionados.delete(integranteId);
        checkbox.classList.remove('checked');
        item.classList.remove('selected');
    } else {
        integrantesSelecionados.add(integranteId);
        checkbox.classList.add('checked');
        item.classList.add('selected');
    }
    
    atualizarContadorSelecao();
}

function atualizarContadorSelecao() {
    const counter = document.getElementById('selection-counter');
    const count = integrantesSelecionados.size;
    counter.textContent = `${count} integrante${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
}

// ========================================
// SALVAMENTO
// ========================================

async function saveEquipe() {
    try {
        const numero = document.getElementById('equipe-numero').value.trim();
        const observacoes = document.getElementById('equipe-observacoes').value.trim();

        
        // Validações
        if (!numero) {
            showNotification('Número da equipe é obrigatório', 'warning');
            return;
        }
        
        if (integrantesSelecionados.size === 0) {
            showNotification('Selecione pelo menos um integrante', 'warning');
            return;
        }
        
        showLoading('Salvando equipe...');
        
        // Verificar se número já existe
        const { data: existingEquipe } = await supabaseClient
            .from('equipes_hvc')
            .select('id')
            .eq('numero', numero)
            .single();
            
        if (existingEquipe) {
            showNotification('Número de equipe já existe', 'warning');
            hideLoading();
            return;
        }
        
        // Salvar equipe
        const { data: novaEquipe, error: equipeError } = await supabaseClient
            .from('equipes_hvc')
            .insert({
                numero: numero,
                observacoes: observacoes || null,
                status: 'ativa'
            })
            .select()
            .single();
            
        if (equipeError) throw equipeError;
        
        // Salvar integrantes da equipe
        const integrantesEquipe = Array.from(integrantesSelecionados).map(integranteId => ({
            equipe_id: novaEquipe.id,
            integrante_id: integranteId
        }));
        
        const { error: integrantesError } = await supabaseClient
            .from('equipe_integrantes')
            .insert(integrantesEquipe);
            
        if (integrantesError) throw integrantesError;
        
        showNotification('Equipe criada com sucesso!', 'success');
        closeEquipeModal();
        await carregarEquipes();
        atualizarEstatisticas();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao salvar equipe:', error);
        showNotification('Erro ao salvar equipe: ' + error.message, 'error');
        hideLoading();
    }
}

async function saveIntegrante() {
    try {
        const nome = document.getElementById('integrante-nome').value.trim();
        const cpf = document.getElementById('integrante-cpf').value.trim();
        const whatsapp = document.getElementById('integrante-whatsapp').value.trim();
        const funcaoId = document.getElementById('integrante-funcao').value;
        const observacoes = document.getElementById('integrante-observacoes').value.trim();

        
        // Validações
        if (!nome || !cpf || !whatsapp || !funcaoId) {
            showNotification('Todos os campos obrigatórios devem ser preenchidos', 'warning');
            return;
        }
        
        showLoading('Salvando integrante...');
        
        // Verificar se CPF já existe
        const { data: existingIntegrante } = await supabaseClient
            .from('integrantes_hvc')
            .select('id')
            .eq('cpf', cpf)
            .single();
            
        if (existingIntegrante) {
            showNotification('CPF já cadastrado', 'warning');
            hideLoading();
            return;
        }
        
        // Salvar integrante
        const { error } = await supabaseClient
            .from('integrantes_hvc')
            .insert({
                nome: nome,
                cpf: cpf,
                whatsapp: whatsapp,
                funcao_id: funcaoId,
                observacoes: observacoes || null
            });
            
        if (error) throw error;
        
        showNotification('Integrante cadastrado com sucesso!', 'success');
        closeIntegranteModal();
        await carregarIntegrantes();
        atualizarEstatisticas();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao salvar integrante:', error);
        showNotification('Erro ao salvar integrante: ' + error.message, 'error');
        hideLoading();
    }
}

async function saveFuncao() {
    try {
        const nome = document.getElementById('nome-funcao').value.trim();
        
        if (!nome) {
            showNotification('Nome da função é obrigatório', 'warning');
            return;
        }
        
        showLoading('Salvando função...');
        
        // Verificar se função já existe
        const { data: existingFuncao } = await supabaseClient
            .from('funcoes_hvc')
            .select('id')
            .eq('nome', nome)
            .single();
            
        if (existingFuncao) {
            showNotification('Função já existe', 'warning');
            hideLoading();
            return;
        }
        
        // Salvar função
        const { error } = await supabaseClient
            .from('funcoes_hvc')
            .insert({
                nome: nome
            });
            
        if (error) throw error;
        
        showNotification('Função criada com sucesso!', 'success');
        cancelNovaFuncao();
        await carregarFuncoes();
        atualizarEstatisticas();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao salvar função:', error);
        showNotification('Erro ao salvar função: ' + error.message, 'error');
        hideLoading();
    }
}

// ========================================
// UTILITÁRIOS
// ========================================

function limparFormularioEquipe() {
    document.getElementById('numero-equipe').value = '';
    document.getElementById('observacoes-equipe').value = '';
    integrantesSelecionados.clear();
    atualizarContadorSelecao();
}

function limparFormularioIntegrante() {
    document.getElementById('nome-integrante').value = '';
    document.getElementById('cpf-integrante').value = '';
    document.getElementById('whatsapp-integrante').value = '';
    document.getElementById('funcao-integrante').value = '';
    document.getElementById('observacoes-integrante').value = '';
}

function configurarEventos() {
    // Formatação automática de CPF
    const cpfInput = document.getElementById('cpf-integrante');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
    }
    
    // Formatação automática de WhatsApp
    const whatsappInput = document.getElementById('whatsapp-integrante');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', function(e) {
            e.target.value = formatWhatsApp(e.target.value);
        });
    }
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

function formatCPF(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
}

function formatWhatsApp(value) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 13) {
        return '+' + numbers;
    }
    return '+' + numbers.substring(0, 13);
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES
// ========================================

function showNotification(message, type = 'info') {
    // Criar container se não existir
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <div style="
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem;
            margin-bottom: 0.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideIn 0.3s ease;
        ">
            <i class="${icons[type] || icons.info}"></i>
            <span style="flex-grow: 1;">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0;
                margin-left: 0.5rem;
            ">&times;</button>
        </div>
    `;
    
    container.appendChild(notification);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function showLoading(message = 'Carregando...') {
    // Implementar loading global se necessário
    console.log('🔄 ' + message);
}

function hideLoading() {
    // Implementar hide loading global se necessário
    console.log('✅ Loading finalizado');
}

// ========================================
// FUNÇÕES GLOBAIS (para onclick)
// ========================================

// Tornar funções disponíveis globalmente
window.openNovaEquipeModal = openNovaEquipeModal;
window.closeEquipeModal = closeEquipeModal;
window.openIntegranteModal = openIntegranteModal;
window.closeIntegranteModal = closeIntegranteModal;
window.openFuncoesModal = openFuncoesModal;
window.closeFuncoesModal = closeFuncoesModal;
window.openNovaFuncaoForm = openNovaFuncaoForm;
window.cancelNovaFuncao = cancelNovaFuncao;
window.saveEquipe = saveEquipe;
window.saveIntegrante = saveIntegrante;
window.saveFuncao = saveFuncao;
window.toggleIntegrante = toggleIntegrante;

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// ========================================
// FUNÇÕES DE FILTRO
// ========================================

function filtrarIntegrantes() {
    const filtroNome = document.getElementById('filtro-nome-integrante')?.value.toLowerCase() || '';
    const filtroCpf = document.getElementById('filtro-cpf-integrante')?.value.toLowerCase() || '';
    const filtroFuncao = document.getElementById('filtro-funcao-integrante')?.value || '';
    const filtroStatus = document.getElementById('filtro-status-integrante')?.value || '';
    
    const linhas = document.querySelectorAll('#tabela-integrantes tbody tr');
    
    linhas.forEach(linha => {
        // Pular linha de estado vazio
        if (linha.querySelector('.empty-state')) return;
        
        const nome = linha.cells[0]?.textContent.toLowerCase() || '';
        const cpf = linha.cells[1]?.textContent.toLowerCase() || '';
        const funcaoTexto = linha.cells[3]?.textContent.toLowerCase() || '';
        const statusTexto = linha.cells[4]?.textContent.toLowerCase() || '';
        
        // Encontrar integrante correspondente para verificar função
        const nomeCompleto = linha.cells[0]?.textContent.trim() || '';
        const integrante = integrantesData.find(i => i.nome === nomeCompleto);
        
        // Aplicar filtros
        const matchNome = !filtroNome || nome.includes(filtroNome);
        const matchCpf = !filtroCpf || cpf.includes(filtroCpf);
        const matchFuncao = !filtroFuncao || (integrante && integrante.funcao_id === filtroFuncao);
        const matchStatus = !filtroStatus || statusTexto.includes(filtroStatus);
        
        // Mostrar/ocultar linha
        linha.style.display = matchNome && matchCpf && matchFuncao && matchStatus ? '' : 'none';
    });
}

function filtrarEquipes() {
    const filtroNumero = document.getElementById('filtro-numero-equipe')?.value.toLowerCase() || '';
    const filtroStatus = document.getElementById('filtro-status-equipe')?.value || '';
    
    const linhas = document.querySelectorAll('#tabela-equipes tbody tr');
    
    linhas.forEach(linha => {
        // Pular linha de estado vazio
        if (linha.querySelector('.empty-state')) return;
        
        const numero = linha.cells[0]?.textContent.toLowerCase() || '';
        const statusTexto = linha.cells[2]?.textContent.toLowerCase() || '';
        
        // Aplicar filtros
        const matchNumero = !filtroNumero || numero.includes(filtroNumero);
        const matchStatus = !filtroStatus || statusTexto.includes(filtroStatus);
        
        // Mostrar/ocultar linha
        linha.style.display = matchNumero && matchStatus ? '' : 'none';
    });
}

// Tornar funções de filtro disponíveis globalmente
window.filtrarIntegrantes = filtrarIntegrantes;
window.filtrarEquipes = filtrarEquipes;



console.log('📦 Sistema de equipes HVC carregado!');

