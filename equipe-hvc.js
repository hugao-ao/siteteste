// SISTEMA DE EQUIPES HVC - JAVASCRIPT CORRIGIDO
// ========================================
// Sistema completo para gerenciamento de equipes, integrantes e funções
// Compatível com a estrutura ES6 modules do projeto HVC

// ========================================
// IMPORTS
// ========================================
import { supabase } from './supabase.js';

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
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
    
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
    // Remove notificação existente
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Mostrar notificação
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remover notificação após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// FUNÇÕES DE BANCO DE DADOS
// ========================================

// Carregar funções
async function loadFuncoes() {
    try {
        console.log('Carregando funções...');
        const { data, error } = await supabase
            .from('funcoes_hvc')
            .select('*')
            .order('nome');
        
        if (error) {
            console.error('Erro ao carregar funções:', error);
            throw error;
        }
        
        funcoesData = data || [];
        console.log('Funções carregadas:', funcoesData.length);
        updateFuncoesTable();
        updateFuncaoSelects();
        return funcoesData;
    } catch (error) {
        console.error('Erro ao carregar funções:', error);
        showNotification('Erro ao carregar funções', 'error');
        return [];
    }
}

// Carregar integrantes
async function loadIntegrantes() {
    try {
        console.log('Carregando integrantes...');
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
        
        if (error) {
            console.error('Erro ao carregar integrantes:', error);
            throw error;
        }
        
        integrantesData = data || [];
        console.log('Integrantes carregados:', integrantesData.length);
        updateIntegrantesTable();
        return integrantesData;
    } catch (error) {
        console.error('Erro ao carregar integrantes:', error);
        showNotification('Erro ao carregar integrantes', 'error');
        return [];
    }
}

// Carregar equipes
async function loadEquipes() {
    try {
        console.log('Carregando equipes...');
        const { data, error } = await supabase
            .from('equipes_hvc')
            .select(`
                *,
                equipes_integrantes (
                    integrantes_hvc (
                        id,
                        nome
                    )
                )
            `)
            .order('numero');
        
        if (error) {
            console.error('Erro ao carregar equipes:', error);
            throw error;
        }
        
        equipesData = data || [];
        console.log('Equipes carregadas:', equipesData.length);
        updateEquipesTable();
        return equipesData;
    } catch (error) {
        console.error('Erro ao carregar equipes:', error);
        showNotification('Erro ao carregar equipes', 'error');
        return [];
    }
}

// Salvar função
async function saveFuncaoToDB(funcaoData) {
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
        
        await loadFuncoes();
        return true;
    } catch (error) {
        console.error('Erro ao salvar função:', error);
        showNotification('Erro ao salvar função: ' + error.message, 'error');
        return false;
    }
}

// Salvar integrante
async function saveIntegranteToDB(integranteData) {
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
        
        await loadIntegrantes();
        return true;
    } catch (error) {
        console.error('Erro ao salvar integrante:', error);
        if (error.code === '23505') {
            showNotification('CPF já cadastrado no sistema', 'error');
        } else {
            showNotification('Erro ao salvar integrante: ' + error.message, 'error');
        }
        return false;
    }
}

// Salvar equipe
async function saveEquipeToDB(equipeData, integrantesSelecionados) {
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
            
            // Remover integrantes existentes
            await supabase
                .from('equipes_integrantes')
                .delete()
                .eq('equipe_id', equipeId);
        } else {
            // Criar nova equipe
            const { data, error } = await supabase
                .from('equipes_hvc')
                .insert([equipeData])
                .select();
            
            if (error) throw error;
            equipeId = data[0].id;
        }
        
        // Adicionar integrantes selecionados
        if (integrantesSelecionados.length > 0) {
            const integrantesEquipe = integrantesSelecionados.map(integranteId => ({
                equipe_id: equipeId,
                integrante_id: integranteId
            }));
            
            const { error: integrantesError } = await supabase
                .from('equipes_integrantes')
                .insert(integrantesEquipe);
            
            if (integrantesError) throw integrantesError;
        }
        
        showNotification(currentEditingEquipe ? 'Equipe atualizada com sucesso!' : 'Equipe criada com sucesso!');
        await loadEquipes();
        return true;
    } catch (error) {
        console.error('Erro ao salvar equipe:', error);
        if (error.code === '23505') {
            showNotification('Número da equipe já existe', 'error');
        } else {
            showNotification('Erro ao salvar equipe: ' + error.message, 'error');
        }
        return false;
    }
}

// Deletar função
async function deleteFuncao(id) {
    try {
        const { error } = await supabase
            .from('funcoes_hvc')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification('Função excluída com sucesso!');
        await loadFuncoes();
        await loadIntegrantes(); // Recarregar para atualizar referências
    } catch (error) {
        console.error('Erro ao deletar função:', error);
        if (error.code === '23503') {
            showNotification('Não é possível excluir função que possui integrantes associados', 'error');
        } else {
            showNotification('Erro ao excluir função: ' + error.message, 'error');
        }
    }
}

// Deletar integrante
async function deleteIntegrante(id) {
    try {
        const { error } = await supabase
            .from('integrantes_hvc')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification('Integrante excluído com sucesso!');
        await loadIntegrantes();
        await loadEquipes(); // Recarregar para atualizar referências
    } catch (error) {
        console.error('Erro ao deletar integrante:', error);
        showNotification('Erro ao excluir integrante: ' + error.message, 'error');
    }
}

// Deletar equipe
async function deleteEquipe(id) {
    try {
        // Primeiro deletar relacionamentos
        await supabase
            .from('equipes_integrantes')
            .delete()
            .eq('equipe_id', id);
        
        // Depois deletar a equipe
        const { error } = await supabase
            .from('equipes_hvc')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification('Equipe excluída com sucesso!');
        await loadEquipes();
    } catch (error) {
        console.error('Erro ao deletar equipe:', error);
        showNotification('Erro ao excluir equipe: ' + error.message, 'error');
    }
}

// ========================================
// FUNÇÕES DE INTERFACE - MODAIS
// ========================================

// Modal Equipe
function openEquipeModal(equipeId = null) {
    currentEditingEquipe = equipeId;
    const modal = document.getElementById('modal-equipe');
    const title = document.getElementById('modal-equipe-title');
    
    if (equipeId) {
        title.textContent = 'Editar Equipe';
        const equipe = equipesData.find(e => e.id === equipeId);
        if (equipe) {
            document.getElementById('numero-equipe').value = equipe.numero;
            document.getElementById('observacoes-equipe').value = equipe.observacoes || '';
            
            // Marcar integrantes selecionados
            const integrantesSelecionados = equipe.equipes_integrantes?.map(ei => ei.integrantes_hvc.id) || [];
            updateIntegrantesSelect(integrantesSelecionados);
        }
    } else {
        title.textContent = 'Nova Equipe';
        document.getElementById('form-equipe').reset();
        updateIntegrantesSelect([]);
    }
    
    modal.classList.add('show');
}

function closeEquipeModal() {
    const modal = document.getElementById('modal-equipe');
    modal.classList.remove('show');
    currentEditingEquipe = null;
}

// Modal Integrante
function openIntegranteModal(integranteId = null) {
    currentEditingIntegrante = integranteId;
    const modal = document.getElementById('modal-integrante');
    const title = document.getElementById('modal-integrante-title');
    
    if (integranteId) {
        title.textContent = 'Editar Integrante';
        const integrante = integrantesData.find(i => i.id === integranteId);
        if (integrante) {
            document.getElementById('nome-integrante').value = integrante.nome;
            document.getElementById('cpf-integrante').value = integrante.cpf;
            document.getElementById('whatsapp-integrante').value = integrante.whatsapp;
            document.getElementById('funcao-integrante').value = integrante.funcao_id;
            document.getElementById('observacoes-integrante').value = integrante.observacoes || '';
        }
    } else {
        title.textContent = 'Novo Integrante';
        document.getElementById('form-integrante').reset();
    }
    
    modal.classList.add('show');
}

function closeIntegranteModal() {
    const modal = document.getElementById('modal-integrante');
    modal.classList.remove('show');
    currentEditingIntegrante = null;
}

// Modal Funções
function openFuncoesModal() {
    const modal = document.getElementById('modal-funcoes');
    if (modal) {
        modal.classList.add('show');
        cancelNovaFuncao(); // Garantir que formulário está fechado
    } else {
        console.error('Modal de funções não encontrado');
        showNotification('Erro: Modal de funções não encontrado', 'error');
    }
}

function closeFuncoesModal() {
    const modal = document.getElementById('modal-funcoes');
    if (modal) {
        modal.classList.remove('show');
        cancelNovaFuncao();
    }
}

// ========================================
// FUNÇÕES DE INTERFACE - FORMULÁRIOS
// ========================================

// Formulário de nova função
function openNovaFuncaoForm() {
    const form = document.getElementById('nova-funcao-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('nome-funcao').focus();
    }
}

function cancelNovaFuncao() {
    const form = document.getElementById('nova-funcao-form');
    if (form) {
        form.style.display = 'none';
        form.querySelector('form').reset();
        currentEditingFuncao = null;
    }
}

// Salvar função
function saveFuncao(event) {
    event.preventDefault();
    
    const nome = document.getElementById('nome-funcao').value.trim();
    
    if (!nome) {
        showNotification('Nome da função é obrigatório', 'error');
        return;
    }
    
    const funcaoData = {
        nome: nome
    };
    
    saveFuncaoToDB(funcaoData).then(success => {
        if (success) {
            cancelNovaFuncao();
        }
    });
}

// Salvar integrante
function saveIntegrante(event) {
    event.preventDefault();
    
    const nome = document.getElementById('nome-integrante').value.trim();
    const cpf = document.getElementById('cpf-integrante').value.trim();
    const whatsapp = document.getElementById('whatsapp-integrante').value.trim();
    const funcaoId = document.getElementById('funcao-integrante').value;
    const observacoes = document.getElementById('observacoes-integrante').value.trim();
    
    // Validações
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
    
    // Verificar CPF duplicado (apenas para novos integrantes)
    if (!currentEditingIntegrante) {
        const cpfExists = integrantesData.some(i => i.cpf === cpf);
        if (cpfExists) {
            showNotification('CPF já cadastrado no sistema', 'error');
            return;
        }
    }
    
    const integranteData = {
        nome: nome,
        cpf: cpf,
        whatsapp: whatsapp,
        funcao_id: parseInt(funcaoId),
        observacoes: observacoes || null,
        status: 'ativo'
    };
    
    saveIntegranteToDB(integranteData).then(success => {
        if (success) {
            closeIntegranteModal();
        }
    });
}

// Salvar equipe
function saveEquipe(event) {
    event.preventDefault();
    
    const numero = document.getElementById('numero-equipe').value.trim();
    const observacoes = document.getElementById('observacoes-equipe').value.trim();
    
    // Validações
    if (!numero) {
        showNotification('Número da equipe é obrigatório', 'error');
        return;
    }
    
    // Verificar número duplicado (apenas para novas equipes)
    if (!currentEditingEquipe) {
        const numeroExists = equipesData.some(e => e.numero === numero);
        if (numeroExists) {
            showNotification('Número da equipe já existe', 'error');
            return;
        }
    }
    
    // Obter integrantes selecionados
    const integrantesSelecionados = [];
    const checkboxes = document.querySelectorAll('#integrantes-select input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        integrantesSelecionados.push(parseInt(checkbox.value));
    });
    
    if (integrantesSelecionados.length === 0) {
        showNotification('Selecione pelo menos um integrante', 'error');
        return;
    }
    
    const equipeData = {
        numero: numero,
        observacoes: observacoes || null,
        status: 'ativa'
    };
    
    saveEquipeToDB(equipeData, integrantesSelecionados).then(success => {
        if (success) {
            closeEquipeModal();
        }
    });
}

// ========================================
// FUNÇÕES DE INTERFACE - TABELAS
// ========================================

// Atualizar tabela de funções
function updateFuncoesTable() {
    const tbody = document.querySelector('#tabela-funcoes tbody');
    
    if (funcoesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">
                    <i class="fas fa-cog"></i>
                    <h3>Nenhuma função cadastrada</h3>
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
                <td>${funcao.nome}</td>
                <td>${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</td>
                <td class="actions-cell">
                    <button class="btn-warning" onclick="editFuncao(${funcao.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="confirmDeleteFuncao(${funcao.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Atualizar tabela de integrantes
function updateIntegrantesTable() {
    const tbody = document.querySelector('#tabela-integrantes tbody');
    
    if (integrantesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-user"></i>
                    <h3>Nenhum integrante cadastrado</h3>
                    <p>Clique em "Novo Integrante" para começar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = integrantesData.map(integrante => `
        <tr>
            <td>${integrante.nome}</td>
            <td>${integrante.cpf}</td>
            <td>${integrante.whatsapp}</td>
            <td>${integrante.funcoes_hvc?.nome || 'N/A'}</td>
            <td>
                <span class="status-badge status-${integrante.status}">
                    ${integrante.status}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn-info" onclick="openIntegranteModal(${integrante.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-warning" onclick="toggleIntegranteStatus(${integrante.id})" title="${integrante.status === 'ativo' ? 'Desativar' : 'Ativar'}">
                    <i class="fas fa-${integrante.status === 'ativo' ? 'pause' : 'play'}"></i>
                </button>
                <button class="btn-danger" onclick="confirmDeleteIntegrante(${integrante.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Atualizar tabela de equipes
function updateEquipesTable() {
    const tbody = document.querySelector('#tabela-equipes tbody');
    
    if (equipesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Nenhuma equipe cadastrada</h3>
                    <p>Clique em "Nova Equipe" para começar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = equipesData.map(equipe => {
        const integrantesCount = equipe.equipes_integrantes?.length || 0;
        const integrantesNomes = equipe.equipes_integrantes?.map(ei => ei.integrantes_hvc.nome).join(', ') || 'Nenhum';
        
        return `
            <tr>
                <td>${equipe.numero}</td>
                <td title="${integrantesNomes}">${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</td>
                <td>
                    <span class="status-badge status-${equipe.status}">
                        ${equipe.status}
                    </span>
                </td>
                <td>${equipe.observacoes || '-'}</td>
                <td class="actions-cell">
                    <button class="btn-info" onclick="openEquipeModal(${equipe.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-warning" onclick="toggleEquipeStatus(${equipe.id})" title="${equipe.status === 'ativa' ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${equipe.status === 'ativa' ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-danger" onclick="confirmDeleteEquipe(${equipe.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Atualizar selects de função
function updateFuncaoSelects() {
    const selects = document.querySelectorAll('#funcao-integrante, #filtro-funcao-integrante');
    
    selects.forEach(select => {
        const currentValue = select.value;
        const isFilter = select.id === 'filtro-funcao-integrante';
        
        select.innerHTML = isFilter ? '<option value="">Todas</option>' : '<option value="">Selecione uma função</option>';
        
        funcoesData.forEach(funcao => {
            const option = document.createElement('option');
            option.value = funcao.id;
            option.textContent = funcao.nome;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    });
}

// Atualizar seleção de integrantes
function updateIntegrantesSelect(integrantesSelecionados = []) {
    const container = document.getElementById('integrantes-select');
    const countElement = document.getElementById('selected-count');
    
    if (integrantesData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-plus"></i>
                <h3>Nenhum integrante disponível</h3>
                <p>Cadastre integrantes primeiro</p>
            </div>
        `;
        countElement.textContent = '0 integrantes selecionados';
        return;
    }
    
    container.innerHTML = integrantesData
        .filter(integrante => integrante.status === 'ativo')
        .map(integrante => {
            const isSelected = integrantesSelecionados.includes(integrante.id);
            return `
                <div class="multi-select-item">
                    <input type="checkbox" id="integrante-${integrante.id}" value="${integrante.id}" ${isSelected ? 'checked' : ''} onchange="updateSelectedCount()">
                    <label for="integrante-${integrante.id}">
                        ${integrante.nome} - ${integrante.funcoes_hvc?.nome || 'N/A'}
                    </label>
                </div>
            `;
        }).join('');
    
    updateSelectedCount();
}

// Atualizar contador de selecionados
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('#integrantes-select input[type="checkbox"]:checked');
    const count = checkboxes.length;
    const countElement = document.getElementById('selected-count');
    countElement.textContent = `${count} integrante${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
}

// ========================================
// FUNÇÕES DE AÇÕES
// ========================================

// Editar função
function editFuncao(id) {
    const funcao = funcoesData.find(f => f.id === id);
    if (funcao) {
        currentEditingFuncao = id;
        document.getElementById('nome-funcao').value = funcao.nome;
        openNovaFuncaoForm();
    }
}

// Confirmar exclusão de função
function confirmDeleteFuncao(id) {
    const funcao = funcoesData.find(f => f.id === id);
    if (funcao && confirm(`Tem certeza que deseja excluir a função "${funcao.nome}"?`)) {
        deleteFuncao(id);
    }
}

// Confirmar exclusão de integrante
function confirmDeleteIntegrante(id) {
    const integrante = integrantesData.find(i => i.id === id);
    if (integrante && confirm(`Tem certeza que deseja excluir o integrante "${integrante.nome}"?`)) {
        deleteIntegrante(id);
    }
}

// Confirmar exclusão de equipe
function confirmDeleteEquipe(id) {
    const equipe = equipesData.find(e => e.id === id);
    if (equipe && confirm(`Tem certeza que deseja excluir a equipe "${equipe.numero}"?`)) {
        deleteEquipe(id);
    }
}

// Toggle status integrante
async function toggleIntegranteStatus(id) {
    try {
        const integrante = integrantesData.find(i => i.id === id);
        const novoStatus = integrante.status === 'ativo' ? 'inativo' : 'ativo';
        
        const { error } = await supabase
            .from('integrantes_hvc')
            .update({ status: novoStatus })
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification(`Integrante ${novoStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
        await loadIntegrantes();
    } catch (error) {
        console.error('Erro ao alterar status do integrante:', error);
        showNotification('Erro ao alterar status do integrante', 'error');
    }
}

// Toggle status equipe
async function toggleEquipeStatus(id) {
    try {
        const equipe = equipesData.find(e => e.id === id);
        const novoStatus = equipe.status === 'ativa' ? 'inativa' : 'ativa';
        
        const { error } = await supabase
            .from('equipes_hvc')
            .update({ status: novoStatus })
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification(`Equipe ${novoStatus === 'ativa' ? 'ativada' : 'desativada'} com sucesso!`);
        await loadEquipes();
    } catch (error) {
        console.error('Erro ao alterar status da equipe:', error);
        showNotification('Erro ao alterar status da equipe', 'error');
    }
}

// ========================================
// FUNÇÕES DE FILTRO
// ========================================

// Filtrar equipes
function filtrarEquipes() {
    const filtroNumero = document.getElementById('filtro-numero-equipe').value.toLowerCase();
    const filtroStatus = document.getElementById('filtro-status-equipe').value;
    
    const equipesFiltradas = equipesData.filter(equipe => {
        const matchNumero = !filtroNumero || equipe.numero.toLowerCase().includes(filtroNumero);
        const matchStatus = !filtroStatus || equipe.status === filtroStatus;
        
        return matchNumero && matchStatus;
    });
    
    // Atualizar tabela com dados filtrados
    const tbody = document.querySelector('#tabela-equipes tbody');
    
    if (equipesFiltradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhuma equipe encontrada</h3>
                    <p>Ajuste os filtros ou cadastre novas equipes</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = equipesFiltradas.map(equipe => {
        const integrantesCount = equipe.equipes_integrantes?.length || 0;
        const integrantesNomes = equipe.equipes_integrantes?.map(ei => ei.integrantes_hvc.nome).join(', ') || 'Nenhum';
        
        return `
            <tr>
                <td>${equipe.numero}</td>
                <td title="${integrantesNomes}">${integrantesCount} integrante${integrantesCount !== 1 ? 's' : ''}</td>
                <td>
                    <span class="status-badge status-${equipe.status}">
                        ${equipe.status}
                    </span>
                </td>
                <td>${equipe.observacoes || '-'}</td>
                <td class="actions-cell">
                    <button class="btn-info" onclick="openEquipeModal(${equipe.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-warning" onclick="toggleEquipeStatus(${equipe.id})" title="${equipe.status === 'ativa' ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${equipe.status === 'ativa' ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-danger" onclick="confirmDeleteEquipe(${equipe.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filtrar integrantes
function filtrarIntegrantes() {
    const filtroNome = document.getElementById('filtro-nome-integrante').value.toLowerCase();
    const filtroFuncao = document.getElementById('filtro-funcao-integrante').value;
    const filtroStatus = document.getElementById('filtro-status-integrante').value;
    
    const integrantesFiltrados = integrantesData.filter(integrante => {
        const matchNome = !filtroNome || integrante.nome.toLowerCase().includes(filtroNome);
        const matchFuncao = !filtroFuncao || integrante.funcao_id == filtroFuncao;
        const matchStatus = !filtroStatus || integrante.status === filtroStatus;
        
        return matchNome && matchFuncao && matchStatus;
    });
    
    // Atualizar tabela com dados filtrados
    const tbody = document.querySelector('#tabela-integrantes tbody');
    
    if (integrantesFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhum integrante encontrado</h3>
                    <p>Ajuste os filtros ou cadastre novos integrantes</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = integrantesFiltrados.map(integrante => `
        <tr>
            <td>${integrante.nome}</td>
            <td>${integrante.cpf}</td>
            <td>${integrante.whatsapp}</td>
            <td>${integrante.funcoes_hvc?.nome || 'N/A'}</td>
            <td>
                <span class="status-badge status-${integrante.status}">
                    ${integrante.status}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn-info" onclick="openIntegranteModal(${integrante.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-warning" onclick="toggleIntegranteStatus(${integrante.id})" title="${integrante.status === 'ativo' ? 'Desativar' : 'Ativar'}">
                    <i class="fas fa-${integrante.status === 'ativo' ? 'pause' : 'play'}"></i>
                </button>
                <button class="btn-danger" onclick="confirmDeleteIntegrante(${integrante.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ========================================
// FORMATAÇÃO DE CAMPOS
// ========================================

// Aplicar formatação aos campos
function setupFieldFormatting() {
    // Formatação CPF
    const cpfField = document.getElementById('cpf-integrante');
    if (cpfField) {
        cpfField.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
    }
    
    // Formatação WhatsApp
    const whatsappField = document.getElementById('whatsapp-integrante');
    if (whatsappField) {
        whatsappField.addEventListener('input', function(e) {
            e.target.value = formatWhatsApp(e.target.value);
        });
    }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

// Inicializar sistema
async function initializeSystem() {
    try {
        console.log('Inicializando sistema de equipes...');
        
        // Verificar se Supabase está disponível
        if (!supabase) {
            throw new Error('Supabase não está disponível');
        }
        console.log('Supabase disponível:', !!supabase);
        
        // Carregar dados
        await Promise.all([
            loadFuncoes(),
            loadIntegrantes(),
            loadEquipes()
        ]);
        
        // Configurar formatação de campos
        setupFieldFormatting();
        
        console.log('Sistema de equipes inicializado com sucesso');
        console.log('Funções carregadas:', funcoesData.length);
        console.log('Integrantes carregados:', integrantesData.length);
        console.log('Equipes carregadas:', equipesData.length);
        
    } catch (error) {
        console.error('Erro ao inicializar sistema:', error);
        showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
    }
}

// ========================================
// EXPOSIÇÃO DE FUNÇÕES GLOBAIS
// ========================================

// Tornar funções disponíveis globalmente
window.openEquipeModal = openEquipeModal;
window.closeEquipeModal = closeEquipeModal;
window.openIntegranteModal = openIntegranteModal;
window.closeIntegranteModal = closeIntegranteModal;
window.openFuncoesModal = openFuncoesModal;
window.closeFuncoesModal = closeFuncoesModal;
window.openNovaFuncaoForm = openNovaFuncaoForm;
window.cancelNovaFuncao = cancelNovaFuncao;
window.saveFuncao = saveFuncao;
window.saveIntegrante = saveIntegrante;
window.saveEquipe = saveEquipe;
window.editFuncao = editFuncao;
window.confirmDeleteFuncao = confirmDeleteFuncao;
window.confirmDeleteIntegrante = confirmDeleteIntegrante;
window.confirmDeleteEquipe = confirmDeleteEquipe;
window.toggleIntegranteStatus = toggleIntegranteStatus;
window.toggleEquipeStatus = toggleEquipeStatus;
window.filtrarEquipes = filtrarEquipes;
window.filtrarIntegrantes = filtrarIntegrantes;
window.updateSelectedCount = updateSelectedCount;

// ========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ========================================

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeSystem);

