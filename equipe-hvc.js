// ========================================
// SISTEMA DE EQUIPES HVC - JAVASCRIPT
// ========================================
// Sistema completo para gerenciamento de equipes, integrantes e funções
// Inclui CRUD completo, validações e filtros

// Usa o supabase.js já existente no projeto
// Certifique-se de que o arquivo supabase.js está carregado antes deste arquivo

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
let currentEditingIntegrante = null;
let currentEditingEquipe = null;
let currentEditingFuncao = null;
let integrantesData = [];
let equipesData = [];
let funcoesData = [];

// ========================================
// UTILITÁRIOS
// ========================================

// Função para formatar CPF
function formatCPF(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
}

// Função para formatar WhatsApp
function formatWhatsApp(value) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 13) {
        return '+' + numbers;
    }
    return '+' + numbers.substring(0, 13);
}

// Função para validar CPF
function isValidCPF(cpf) {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
    
    return true;
}

// Função para validar WhatsApp
function isValidWhatsApp(whatsapp) {
    const cleanWhatsApp = whatsapp.replace(/\D/g, '');
    return cleanWhatsApp.length >= 12 && cleanWhatsApp.length <= 13;
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
    // Remove notificação existente se houver
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    // Adiciona estilos inline
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// FUNÇÕES DE DADOS - FUNÇÕES
// ========================================

async function carregarFuncoes() {
    try {
        const { data, error } = await supabase
            .from('funcoes_hvc')
            .select('*')
            .order('nome');

        if (error) throw error;

        funcoesData = data || [];
        atualizarSelectsFuncoes();
        renderizarFuncoes();
        return funcoesData;
    } catch (error) {
        console.error('Erro ao carregar funções:', error);
        showNotification('Erro ao carregar funções', 'error');
        return [];
    }
}

async function salvarFuncao(funcaoData) {
    try {
        if (currentEditingFuncao) {
            // Editar função existente
            const { data, error } = await supabase
                .from('funcoes_hvc')
                .update(funcaoData)
                .eq('id', currentEditingFuncao)
                .select();

            if (error) throw error;
            showNotification('Função atualizada com sucesso!');
        } else {
            // Criar nova função
            const { data, error } = await supabase
                .from('funcoes_hvc')
                .insert([funcaoData])
                .select();

            if (error) throw error;
            showNotification('Função criada com sucesso!');
        }

        await carregarFuncoes();
        fecharModalFuncao();
    } catch (error) {
        console.error('Erro ao salvar função:', error);
        showNotification('Erro ao salvar função', 'error');
    }
}

async function excluirFuncao(id) {
    if (!confirm('Tem certeza que deseja excluir esta função?')) return;

    try {
        const { error } = await supabase
            .from('funcoes_hvc')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Função excluída com sucesso!');
        await carregarFuncoes();
    } catch (error) {
        console.error('Erro ao excluir função:', error);
        showNotification('Erro ao excluir função', 'error');
    }
}

// ========================================
// FUNÇÕES DE DADOS - INTEGRANTES
// ========================================

async function carregarIntegrantes() {
    try {
        const { data, error } = await supabase
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
        renderizarIntegrantes();
        return integrantesData;
    } catch (error) {
        console.error('Erro ao carregar integrantes:', error);
        showNotification('Erro ao carregar integrantes', 'error');
        return [];
    }
}

async function salvarIntegrante(integranteData) {
    try {
        if (currentEditingIntegrante) {
            // Editar integrante existente
            const { data, error } = await supabase
                .from('integrantes_hvc')
                .update(integranteData)
                .eq('id', currentEditingIntegrante)
                .select();

            if (error) throw error;
            showNotification('Integrante atualizado com sucesso!');
        } else {
            // Criar novo integrante
            const { data, error } = await supabase
                .from('integrantes_hvc')
                .insert([integranteData])
                .select();

            if (error) throw error;
            showNotification('Integrante criado com sucesso!');
        }

        await carregarIntegrantes();
        fecharModalIntegrante();
    } catch (error) {
        console.error('Erro ao salvar integrante:', error);
        if (error.code === '23505') {
            showNotification('CPF já cadastrado para outro integrante', 'error');
        } else {
            showNotification('Erro ao salvar integrante', 'error');
        }
    }
}

async function excluirIntegrante(id) {
    if (!confirm('Tem certeza que deseja excluir este integrante?')) return;

    try {
        const { error } = await supabase
            .from('integrantes_hvc')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Integrante excluído com sucesso!');
        await carregarIntegrantes();
    } catch (error) {
        console.error('Erro ao excluir integrante:', error);
        showNotification('Erro ao excluir integrante', 'error');
    }
}

// ========================================
// FUNÇÕES DE DADOS - EQUIPES
// ========================================

async function carregarEquipes() {
    try {
        const { data, error } = await supabase
            .from('equipes_hvc')
            .select(`
                *,
                equipes_integrantes (
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
        renderizarEquipes();
        return equipesData;
    } catch (error) {
        console.error('Erro ao carregar equipes:', error);
        showNotification('Erro ao carregar equipes', 'error');
        return [];
    }
}

async function salvarEquipe(equipeData, integrantesSelecionados) {
    try {
        let equipeId;

        if (currentEditingEquipe) {
            // Editar equipe existente
            const { data, error } = await supabase
                .from('equipes_hvc')
                .update(equipeData)
                .eq('id', currentEditingEquipe)
                .select();

            if (error) throw error;
            equipeId = currentEditingEquipe;

            // Remove integrantes existentes
            await supabase
                .from('equipes_integrantes')
                .delete()
                .eq('equipe_id', equipeId);

            showNotification('Equipe atualizada com sucesso!');
        } else {
            // Criar nova equipe
            const { data, error } = await supabase
                .from('equipes_hvc')
                .insert([equipeData])
                .select();

            if (error) throw error;
            equipeId = data[0].id;
            showNotification('Equipe criada com sucesso!');
        }

        // Adiciona integrantes selecionados
        if (integrantesSelecionados.length > 0) {
            const integrantesData = integrantesSelecionados.map(integranteId => ({
                equipe_id: equipeId,
                integrante_id: integranteId
            }));

            const { error: integrantesError } = await supabase
                .from('equipes_integrantes')
                .insert(integrantesData);

            if (integrantesError) throw integrantesError;
        }

        await carregarEquipes();
        fecharModalEquipe();
    } catch (error) {
        console.error('Erro ao salvar equipe:', error);
        if (error.code === '23505') {
            showNotification('Número da equipe já existe', 'error');
        } else {
            showNotification('Erro ao salvar equipe', 'error');
        }
    }
}

async function excluirEquipe(id) {
    if (!confirm('Tem certeza que deseja excluir esta equipe?')) return;

    try {
        const { error } = await supabase
            .from('equipes_hvc')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Equipe excluída com sucesso!');
        await carregarEquipes();
    } catch (error) {
        console.error('Erro ao excluir equipe:', error);
        showNotification('Erro ao excluir equipe', 'error');
    }
}

// ========================================
// FUNÇÕES DE RENDERIZAÇÃO
// ========================================

function renderizarEquipes() {
    const tbody = document.getElementById('tabelaEquipes');
    if (!tbody) return;

    if (equipesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Nenhuma equipe encontrada</h3>
                    <p>Clique em "Nova Equipe" para começar</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = equipesData.map(equipe => {
        const integrantes = equipe.equipes_integrantes || [];
        const integrantesCount = integrantes.length;
        const statusBadge = equipe.ativa 
            ? '<span class="badge badge-success">Ativa</span>'
            : '<span class="badge badge-danger">Inativa</span>';

        return `
            <tr>
                <td><strong>${equipe.numero}</strong></td>
                <td>${equipe.nome || '-'}</td>
                <td>
                    <span class="badge badge-secondary">${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</span>
                </td>
                <td>${statusBadge}</td>
                <td>${new Date(equipe.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="editarEquipe('${equipe.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirEquipe('${equipe.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarIntegrantes() {
    const tbody = document.getElementById('tabelaIntegrantes');
    if (!tbody) return;

    if (integrantesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <h3>Nenhum integrante encontrado</h3>
                    <p>Clique em "Novo Integrante" para começar</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = integrantesData.map(integrante => {
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
        const statusBadge = integrante.ativo 
            ? '<span class="badge badge-success">Ativo</span>'
            : '<span class="badge badge-danger">Inativo</span>';

        return `
            <tr>
                <td><strong>${integrante.nome}</strong></td>
                <td>${integrante.cpf}</td>
                <td>${integrante.whatsapp}</td>
                <td>${funcaoNome}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="editarIntegrante('${integrante.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirIntegrante('${integrante.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarFuncoes() {
    const tbody = document.getElementById('tabelaFuncoes');
    if (!tbody) return;

    if (funcoesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-cogs"></i>
                    <h3>Nenhuma função encontrada</h3>
                    <p>Clique em "Nova Função" para começar</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = funcoesData.map(funcao => {
        const integrantesCount = integrantesData.filter(i => i.funcao_id === funcao.id).length;

        return `
            <tr>
                <td><strong>${funcao.nome}</strong></td>
                <td>${funcao.descricao || '-'}</td>
                <td>
                    <span class="badge badge-secondary">${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="editarFuncao('${funcao.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirFuncao('${funcao.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarSelectsFuncoes() {
    const selects = [
        document.getElementById('funcao-integrante'),
        document.getElementById('filtro-funcao-integrantes')
    ];

    selects.forEach(select => {
        if (!select) return;

        const currentValue = select.value;
        const isFilter = select.id.includes('filtro');

        select.innerHTML = isFilter 
            ? '<option value="">Todas as Funções</option>'
            : '<option value="">Selecione uma função...</option>';

        funcoesData.forEach(funcao => {
            const option = document.createElement('option');
            option.value = funcao.id;
            option.textContent = funcao.nome;
            select.appendChild(option);
        });

        select.value = currentValue;
    });
}

function renderizarSelecaoIntegrantes() {
    const container = document.getElementById('integrantes-selection');
    if (!container) return;

    if (integrantesData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <h3>Nenhum integrante disponível</h3>
                <p>Cadastre integrantes primeiro</p>
            </div>
        `;
        return;
    }

    container.innerHTML = integrantesData.map(integrante => {
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
        
        return `
            <div class="integrante-item">
                <input type="checkbox" 
                       id="integrante-${integrante.id}" 
                       value="${integrante.id}"
                       onchange="atualizarContadorIntegrantes()">
                <div class="integrante-info">
                    <div class="integrante-nome">${integrante.nome}</div>
                    <div class="integrante-detalhes">${funcaoNome} • ${integrante.whatsapp}</div>
                </div>
            </div>
        `;
    }).join('');
}

function atualizarContadorIntegrantes() {
    const checkboxes = document.querySelectorAll('#integrantes-selection input[type="checkbox"]:checked');
    const contador = document.getElementById('contador-integrantes');
    
    if (contador) {
        const count = checkboxes.length;
        contador.textContent = `${count} integrante${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
    }
}

// ========================================
// FUNÇÕES DE MODAL
// ========================================

function abrirModalEquipe() {
    currentEditingEquipe = null;
    document.getElementById('modal-equipe-title').innerHTML = '<i class="fas fa-users-cog"></i> Nova Equipe';
    document.getElementById('form-equipe').reset();
    renderizarSelecaoIntegrantes();
    atualizarContadorIntegrantes();
    document.getElementById('modal-equipe').classList.add('show');
}

function editarEquipe(id) {
    const equipe = equipesData.find(e => e.id === id);
    if (!equipe) return;

    currentEditingEquipe = id;
    document.getElementById('modal-equipe-title').innerHTML = '<i class="fas fa-edit"></i> Editar Equipe';
    
    document.getElementById('numero-equipe').value = equipe.numero;
    document.getElementById('nome-equipe').value = equipe.nome || '';
    document.getElementById('observacoes-equipe').value = equipe.observacoes || '';

    renderizarSelecaoIntegrantes();

    // Marcar integrantes já selecionados
    const integrantesSelecionados = equipe.equipes_integrantes?.map(ei => ei.integrantes_hvc.id) || [];
    integrantesSelecionados.forEach(integranteId => {
        const checkbox = document.getElementById(`integrante-${integranteId}`);
        if (checkbox) checkbox.checked = true;
    });

    atualizarContadorIntegrantes();
    document.getElementById('modal-equipe').classList.add('show');
}

function fecharModalEquipe() {
    document.getElementById('modal-equipe').classList.remove('show');
    currentEditingEquipe = null;
}

function abrirModalIntegrante() {
    currentEditingIntegrante = null;
    document.getElementById('modal-integrante-title').innerHTML = '<i class="fas fa-user-plus"></i> Novo Integrante';
    document.getElementById('form-integrante').reset();
    document.getElementById('modal-integrante').classList.add('show');
}

function editarIntegrante(id) {
    const integrante = integrantesData.find(i => i.id === id);
    if (!integrante) return;

    currentEditingIntegrante = id;
    document.getElementById('modal-integrante-title').innerHTML = '<i class="fas fa-edit"></i> Editar Integrante';
    
    document.getElementById('nome-integrante').value = integrante.nome;
    document.getElementById('cpf-integrante').value = integrante.cpf;
    document.getElementById('whatsapp-integrante').value = integrante.whatsapp;
    document.getElementById('funcao-integrante').value = integrante.funcao_id || '';
    document.getElementById('observacoes-integrante').value = integrante.observacoes || '';

    document.getElementById('modal-integrante').classList.add('show');
}

function fecharModalIntegrante() {
    document.getElementById('modal-integrante').classList.remove('show');
    currentEditingIntegrante = null;
}

function abrirModalFuncoes() {
    document.getElementById('modal-funcoes').classList.add('show');
}

function fecharModalFuncoes() {
    document.getElementById('modal-funcoes').classList.remove('show');
}

function abrirModalFuncao() {
    currentEditingFuncao = null;
    document.getElementById('modal-funcao-title').innerHTML = '<i class="fas fa-plus"></i> Nova Função';
    document.getElementById('form-funcao').reset();
    document.getElementById('modal-funcao').classList.add('show');
}

function editarFuncao(id) {
    const funcao = funcoesData.find(f => f.id === id);
    if (!funcao) return;

    currentEditingFuncao = id;
    document.getElementById('modal-funcao-title').innerHTML = '<i class="fas fa-edit"></i> Editar Função';
    
    document.getElementById('nome-funcao').value = funcao.nome;
    document.getElementById('descricao-funcao').value = funcao.descricao || '';

    document.getElementById('modal-funcao').classList.add('show');
}

function fecharModalFuncao() {
    document.getElementById('modal-funcao').classList.remove('show');
    currentEditingFuncao = null;
}

// ========================================
// FUNÇÕES DE FILTRO
// ========================================

function filtrarEquipes() {
    const filtroTexto = document.getElementById('filtro-equipes').value.toLowerCase();
    const filtroStatus = document.getElementById('filtro-status-equipes').value;

    let equipesFiltered = equipesData;

    if (filtroTexto) {
        equipesFiltered = equipesFiltered.filter(equipe => 
            equipe.numero.toLowerCase().includes(filtroTexto) ||
            (equipe.nome && equipe.nome.toLowerCase().includes(filtroTexto))
        );
    }

    if (filtroStatus) {
        const isAtiva = filtroStatus === 'true';
        equipesFiltered = equipesFiltered.filter(equipe => equipe.ativa === isAtiva);
    }

    // Renderizar apenas as equipes filtradas
    const tbody = document.getElementById('tabelaEquipes');
    if (!tbody) return;

    if (equipesFiltered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhuma equipe encontrada</h3>
                    <p>Tente ajustar os filtros</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = equipesFiltered.map(equipe => {
        const integrantes = equipe.equipes_integrantes || [];
        const integrantesCount = integrantes.length;
        const statusBadge = equipe.ativa 
            ? '<span class="badge badge-success">Ativa</span>'
            : '<span class="badge badge-danger">Inativa</span>';

        return `
            <tr>
                <td><strong>${equipe.numero}</strong></td>
                <td>${equipe.nome || '-'}</td>
                <td>
                    <span class="badge badge-secondary">${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</span>
                </td>
                <td>${statusBadge}</td>
                <td>${new Date(equipe.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="editarEquipe('${equipe.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirEquipe('${equipe.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarIntegrantes() {
    const filtroTexto = document.getElementById('filtro-integrantes').value.toLowerCase();
    const filtroFuncao = document.getElementById('filtro-funcao-integrantes').value;
    const filtroStatus = document.getElementById('filtro-status-integrantes').value;

    let integrantesFiltered = integrantesData;

    if (filtroTexto) {
        integrantesFiltered = integrantesFiltered.filter(integrante => 
            integrante.nome.toLowerCase().includes(filtroTexto) ||
            integrante.cpf.includes(filtroTexto) ||
            integrante.whatsapp.includes(filtroTexto)
        );
    }

    if (filtroFuncao) {
        integrantesFiltered = integrantesFiltered.filter(integrante => 
            integrante.funcao_id === filtroFuncao
        );
    }

    if (filtroStatus) {
        const isAtivo = filtroStatus === 'true';
        integrantesFiltered = integrantesFiltered.filter(integrante => integrante.ativo === isAtivo);
    }

    // Renderizar apenas os integrantes filtrados
    const tbody = document.getElementById('tabelaIntegrantes');
    if (!tbody) return;

    if (integrantesFiltered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhum integrante encontrado</h3>
                    <p>Tente ajustar os filtros</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = integrantesFiltered.map(integrante => {
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
        const statusBadge = integrante.ativo 
            ? '<span class="badge badge-success">Ativo</span>'
            : '<span class="badge badge-danger">Inativo</span>';

        return `
            <tr>
                <td><strong>${integrante.nome}</strong></td>
                <td>${integrante.cpf}</td>
                <td>${integrante.whatsapp}</td>
                <td>${funcaoNome}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="editarIntegrante('${integrante.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirIntegrante('${integrante.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarFuncoes() {
    const filtroTexto = document.getElementById('filtro-funcoes').value.toLowerCase();

    let funcoesFiltered = funcoesData;

    if (filtroTexto) {
        funcoesFiltered = funcoesFiltered.filter(funcao => 
            funcao.nome.toLowerCase().includes(filtroTexto) ||
            (funcao.descricao && funcao.descricao.toLowerCase().includes(filtroTexto))
        );
    }

    // Renderizar apenas as funções filtradas
    const tbody = document.getElementById('tabelaFuncoes');
    if (!tbody) return;

    if (funcoesFiltered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhuma função encontrada</h3>
                    <p>Tente ajustar os filtros</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = funcoesFiltered.map(funcao => {
        const integrantesCount = integrantesData.filter(i => i.funcao_id === funcao.id).length;

        return `
            <tr>
                <td><strong>${funcao.nome}</strong></td>
                <td>${funcao.descricao || '-'}</td>
                <td>
                    <span class="badge badge-secondary">${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-warning btn-sm" onclick="editarFuncao('${funcao.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirFuncao('${funcao.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function limparFiltrosEquipes() {
    document.getElementById('filtro-equipes').value = '';
    document.getElementById('filtro-status-equipes').value = '';
    renderizarEquipes();
}

function limparFiltrosIntegrantes() {
    document.getElementById('filtro-integrantes').value = '';
    document.getElementById('filtro-funcao-integrantes').value = '';
    document.getElementById('filtro-status-integrantes').value = '';
    renderizarIntegrantes();
}

function limparFiltroFuncoes() {
    document.getElementById('filtro-funcoes').value = '';
    renderizarFuncoes();
}

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando sistema de equipes...');

    // Verificar se o supabase está disponível
    if (typeof supabase === 'undefined') {
        console.error('Supabase não está disponível. Certifique-se de que o arquivo supabase.js está carregado.');
        showNotification('Erro: Conexão com banco de dados não disponível', 'error');
        return;
    }

    // Carregar dados iniciais
    await carregarFuncoes();
    await carregarIntegrantes();
    await carregarEquipes();

    // Event listeners para botões principais
    document.getElementById('btn-nova-equipe')?.addEventListener('click', abrirModalEquipe);
    document.getElementById('btn-novo-integrante')?.addEventListener('click', abrirModalIntegrante);
    document.getElementById('btn-gerenciar-funcoes')?.addEventListener('click', abrirModalFuncoes);
    document.getElementById('btn-nova-funcao')?.addEventListener('click', abrirModalFuncao);

    // Event listeners para fechar modais
    document.getElementById('close-modal-equipe')?.addEventListener('click', fecharModalEquipe);
    document.getElementById('cancel-equipe')?.addEventListener('click', fecharModalEquipe);
    document.getElementById('close-modal-integrante')?.addEventListener('click', fecharModalIntegrante);
    document.getElementById('cancel-integrante')?.addEventListener('click', fecharModalIntegrante);
    document.getElementById('close-modal-funcoes')?.addEventListener('click', fecharModalFuncoes);
    document.getElementById('close-funcoes')?.addEventListener('click', fecharModalFuncoes);
    document.getElementById('close-modal-funcao')?.addEventListener('click', fecharModalFuncao);
    document.getElementById('cancel-funcao')?.addEventListener('click', fecharModalFuncao);

    // Event listeners para filtros
    document.getElementById('filtro-equipes')?.addEventListener('input', filtrarEquipes);
    document.getElementById('filtro-status-equipes')?.addEventListener('change', filtrarEquipes);
    document.getElementById('btn-limpar-filtros-equipes')?.addEventListener('click', limparFiltrosEquipes);

    document.getElementById('filtro-integrantes')?.addEventListener('input', filtrarIntegrantes);
    document.getElementById('filtro-funcao-integrantes')?.addEventListener('change', filtrarIntegrantes);
    document.getElementById('filtro-status-integrantes')?.addEventListener('change', filtrarIntegrantes);
    document.getElementById('btn-limpar-filtros-integrantes')?.addEventListener('click', limparFiltrosIntegrantes);

    document.getElementById('filtro-funcoes')?.addEventListener('input', filtrarFuncoes);
    document.getElementById('btn-limpar-filtro-funcoes')?.addEventListener('click', limparFiltroFuncoes);

    // Event listeners para formulários
    document.getElementById('form-equipe')?.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const numero = document.getElementById('numero-equipe').value.trim();
        const nome = document.getElementById('nome-equipe').value.trim();
        const observacoes = document.getElementById('observacoes-equipe').value.trim();

        if (!numero) {
            showNotification('Número da equipe é obrigatório', 'error');
            return;
        }

        const integrantesSelecionados = Array.from(
            document.querySelectorAll('#integrantes-selection input[type="checkbox"]:checked')
        ).map(checkbox => checkbox.value);

        const equipeData = {
            numero,
            nome: nome || null,
            observacoes: observacoes || null,
            ativa: true
        };

        salvarEquipe(equipeData, integrantesSelecionados);
    });

    document.getElementById('form-integrante')?.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nome = document.getElementById('nome-integrante').value.trim();
        const cpf = document.getElementById('cpf-integrante').value.trim();
        const whatsapp = document.getElementById('whatsapp-integrante').value.trim();
        const funcaoId = document.getElementById('funcao-integrante').value;
        const observacoes = document.getElementById('observacoes-integrante').value.trim();

        if (!nome || !cpf || !whatsapp || !funcaoId) {
            showNotification('Todos os campos obrigatórios devem ser preenchidos', 'error');
            return;
        }

        if (!isValidCPF(cpf)) {
            showNotification('CPF inválido', 'error');
            return;
        }

        if (!isValidWhatsApp(whatsapp)) {
            showNotification('WhatsApp inválido', 'error');
            return;
        }

        const integranteData = {
            nome,
            cpf,
            whatsapp,
            funcao_id: funcaoId,
            observacoes: observacoes || null,
            ativo: true
        };

        salvarIntegrante(integranteData);
    });

    document.getElementById('form-funcao')?.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nome = document.getElementById('nome-funcao').value.trim();
        const descricao = document.getElementById('descricao-funcao').value.trim();

        if (!nome) {
            showNotification('Nome da função é obrigatório', 'error');
            return;
        }

        const funcaoData = {
            nome,
            descricao: descricao || null
        };

        salvarFuncao(funcaoData);
    });

    // Formatação automática de campos
    document.getElementById('cpf-integrante')?.addEventListener('input', function(e) {
        e.target.value = formatCPF(e.target.value);
    });

    document.getElementById('whatsapp-integrante')?.addEventListener('input', function(e) {
        e.target.value = formatWhatsApp(e.target.value);
    });

    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    console.log('Sistema de equipes inicializado com sucesso!');
});

