// ========================================
// SISTEMA DE EQUIPES HVC - JAVASCRIPT SEM COLUNA STATUS
// ========================================
// Versão que funciona sem a coluna status nas tabelas

// ========================================
// IMPORTS
// ========================================
import { supabase } from './supabase.js';
import { injectSidebarWithAutoDetection } from './sidebar.js';

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
    
    // Validação dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
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
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Mostrar notificação
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remover após 3 segundos
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
        updateIntegrantesSelect();
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
                    integrante_id,
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
                .eq('id', currentEditingFuncao.id)
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

// Salvar integrante - SEM COLUNA STATUS
async function saveIntegranteToDB(integranteData) {
    try {
        if (currentEditingIntegrante) {
            // Editar integrante existente
            const { data, error } = await supabase
                .from('integrantes_hvc')
                .update(integranteData)
                .eq('id', currentEditingIntegrante.id)
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

// Salvar equipe - SEM COLUNA STATUS
async function saveEquipeToDB(equipeData, integrantesSelecionados) {
    try {
        let equipeId;
        
        if (currentEditingEquipe) {
            // Editar equipe existente
            const { data, error } = await supabase
                .from('equipes_hvc')
                .update(equipeData)
                .eq('id', currentEditingEquipe.id)
                .select();
            
            if (error) throw error;
            equipeId = currentEditingEquipe.id;
            
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
    currentEditingEquipe = equipeId ? equipesData.find(e => e.id === equipeId) : null;
    
    const modal = document.getElementById('modalEquipe');
    const title = document.getElementById('modalEquipeTitle');
    const form = document.getElementById('formEquipe');
    
    title.textContent = currentEditingEquipe ? 'Editar Equipe' : 'Nova Equipe';
    
    if (currentEditingEquipe) {
        document.getElementById('numeroEquipe').value = currentEditingEquipe.numero;
        document.getElementById('observacoesEquipe').value = currentEditingEquipe.observacoes || '';
        
        // Marcar integrantes da equipe
        const integrantesEquipe = currentEditingEquipe.equipes_integrantes?.map(ei => ei.integrante_id) || [];
        document.querySelectorAll('#integrantesSelect input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = integrantesEquipe.includes(parseInt(checkbox.value));
        });
    } else {
        form.reset();
        document.querySelectorAll('#integrantesSelect input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    updateSelectedCount();
    modal.classList.add('show');
}

function closeEquipeModal() {
    const modal = document.getElementById('modalEquipe');
    modal.classList.remove('show');
    currentEditingEquipe = null;
}

// Modal Integrante
function openIntegranteModal(integranteId = null) {
    currentEditingIntegrante = integranteId ? integrantesData.find(i => i.id === integranteId) : null;
    
    const modal = document.getElementById('modalIntegrante');
    const title = document.getElementById('modalIntegranteTitle');
    const form = document.getElementById('formIntegrante');
    
    title.textContent = currentEditingIntegrante ? 'Editar Integrante' : 'Novo Integrante';
    
    if (currentEditingIntegrante) {
        document.getElementById('nomeIntegrante').value = currentEditingIntegrante.nome;
        document.getElementById('cpfIntegrante').value = currentEditingIntegrante.cpf;
        document.getElementById('whatsappIntegrante').value = currentEditingIntegrante.whatsapp;
        document.getElementById('funcaoIntegrante').value = currentEditingIntegrante.funcao_id;
        document.getElementById('observacoesIntegrante').value = currentEditingIntegrante.observacoes || '';
    } else {
        form.reset();
    }
    
    modal.classList.add('show');
}

function closeIntegranteModal() {
    const modal = document.getElementById('modalIntegrante');
    modal.classList.remove('show');
    currentEditingIntegrante = null;
}

// Modal Funções - CORRIGIDO
function openFuncoesModal() {
    // Tentar primeiro com o ID do HTML atual
    let modal = document.getElementById('modal-funcoes');
    
    // Se não encontrar, tentar com o ID alternativo
    if (!modal) {
        modal = document.getElementById('modalFuncoes');
    }
    
    if (modal) {
        modal.classList.add('show');
        cancelNovaFuncao(); // Garantir que formulário está fechado
        console.log('Modal de funções aberto com sucesso');
    } else {
        console.error('Modal de funções não encontrado. IDs testados: modal-funcoes, modalFuncoes');
        showNotification('Erro: Modal de funções não encontrado', 'error');
    }
}

function closeFuncoesModal() {
    // Tentar primeiro com o ID do HTML atual
    let modal = document.getElementById('modal-funcoes');
    
    // Se não encontrar, tentar com o ID alternativo
    if (!modal) {
        modal = document.getElementById('modalFuncoes');
    }
    
    if (modal) {
        modal.classList.remove('show');
        cancelNovaFuncao();
        console.log('Modal de funções fechado com sucesso');
    }
}

// ========================================
// FUNÇÕES DE INTERFACE - FORMULÁRIOS
// ========================================

// Formulário de nova função
function openNovaFuncaoForm() {
    // Tentar primeiro com o ID do HTML atual
    let form = document.getElementById('nova-funcao-form');
    
    // Se não encontrar, tentar com o ID alternativo
    if (!form) {
        form = document.getElementById('novaFuncaoForm');
    }
    
    if (form) {
        form.style.display = 'block';
        
        // Tentar focar no campo nome
        let nomeField = document.getElementById('nome-funcao');
        if (!nomeField) {
            nomeField = document.getElementById('nomeFuncao');
        }
        
        if (nomeField) {
            nomeField.focus();
        }
    }
}

function cancelNovaFuncao() {
    // Tentar primeiro com o ID do HTML atual
    let form = document.getElementById('nova-funcao-form');
    
    // Se não encontrar, tentar com o ID alternativo
    if (!form) {
        form = document.getElementById('novaFuncaoForm');
    }
    
    if (form) {
        form.style.display = 'none';
        
        // Limpar campo nome
        let nomeField = document.getElementById('nome-funcao');
        if (!nomeField) {
            nomeField = document.getElementById('nomeFuncao');
        }
        
        if (nomeField) {
            nomeField.value = '';
        }
        
        currentEditingFuncao = null;
    }
}

// Atualizar contador de selecionados
function updateSelectedCount() {
    const selectedCheckboxes = document.querySelectorAll('#integrantesSelect input[type="checkbox"]:checked');
    const countElement = document.getElementById('selectedCount');
    
    if (countElement) {
        countElement.textContent = `${selectedCheckboxes.length} integrante${selectedCheckboxes.length !== 1 ? 's' : ''} selecionado${selectedCheckboxes.length !== 1 ? 's' : ''}`;
    }
}

// Salvar função
function saveFuncao(event) {
    event.preventDefault();
    
    // Tentar primeiro com o ID do HTML atual
    let nomeField = document.getElementById('nome-funcao');
    if (!nomeField) {
        nomeField = document.getElementById('nomeFuncao');
    }
    
    if (!nomeField) {
        showNotification('Campo nome da função não encontrado', 'error');
        return;
    }
    
    const nome = nomeField.value.trim();
    
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

// Salvar integrante - SEM COLUNA STATUS
function saveIntegrante(event) {
    event.preventDefault();
    
    const nome = document.getElementById('nomeIntegrante').value.trim();
    const cpf = document.getElementById('cpfIntegrante').value.trim();
    const whatsapp = document.getElementById('whatsappIntegrante').value.trim();
    const funcaoId = document.getElementById('funcaoIntegrante').value;
    const observacoes = document.getElementById('observacoesIntegrante').value.trim();
    
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
    
    // Dados do integrante SEM campo status
    const integranteData = {
        nome: nome,
        cpf: cpf,
        whatsapp: whatsapp,
        funcao_id: parseInt(funcaoId),
        observacoes: observacoes || null
        // Removido: status: 'ativo'
    };
    
    saveIntegranteToDB(integranteData).then(success => {
        if (success) {
            closeIntegranteModal();
        }
    });
}

// Salvar equipe - SEM COLUNA STATUS
function saveEquipe(event) {
    event.preventDefault();
    
    const numero = document.getElementById('numeroEquipe').value.trim();
    const observacoes = document.getElementById('observacoesEquipe').value.trim();
    
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
    const checkboxes = document.querySelectorAll('#integrantesSelect input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        integrantesSelecionados.push(parseInt(checkbox.value));
    });
    
    if (integrantesSelecionados.length === 0) {
        showNotification('Selecione pelo menos um integrante', 'error');
        return;
    }
    
    // Dados da equipe SEM campo status
    const equipeData = {
        numero: numero,
        observacoes: observacoes || null
        // Removido: status: 'ativa'
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
    const tbody = document.querySelector('#tabelaFuncoes tbody');
    
    if (!tbody) {
        console.error('Tabela de funções não encontrada');
        return;
    }
    
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

// Atualizar tabela de integrantes - SEM COLUNA STATUS
function updateIntegrantesTable() {
    const tbody = document.querySelector('#tabelaIntegrantes tbody');
    
    if (!tbody) {
        console.error('Tabela de integrantes não encontrada');
        return;
    }
    
    if (integrantesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
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
            <td class="actions-cell">
                <button class="btn-info" onclick="openIntegranteModal(${integrante.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-danger" onclick="confirmDeleteIntegrante(${integrante.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Atualizar tabela de equipes - SEM COLUNA STATUS
function updateEquipesTable() {
    const tbody = document.querySelector('#tabelaEquipes tbody');
    
    if (!tbody) {
        console.error('Tabela de equipes não encontrada');
        return;
    }
    
    if (equipesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
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
                <td>${equipe.observacoes || '-'}</td>
                <td class="actions-cell">
                    <button class="btn-info" onclick="openEquipeModal(${equipe.id})" title="Editar">
                        <i class="fas fa-edit"></i>
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
    const selects = document.querySelectorAll('#funcaoIntegrante, #filtroFuncaoIntegrante');
    
    selects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        const isFilter = select.id === 'filtroFuncaoIntegrante';
        
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

// Atualizar seleção de integrantes - SEM FILTRO POR STATUS
function updateIntegrantesSelect() {
    const container = document.getElementById('integrantesSelect');
    
    if (!container) {
        console.error('Container de seleção de integrantes não encontrado');
        return;
    }
    
    if (integrantesData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-plus"></i>
                <h3>Nenhum integrante disponível</h3>
                <p>Cadastre integrantes primeiro</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = integrantesData
        .map(integrante => `
            <div class="multi-select-item">
                <input type="checkbox" id="integrante-${integrante.id}" value="${integrante.id}" onchange="updateSelectedCount()">
                <label for="integrante-${integrante.id}">
                    ${integrante.nome} - ${integrante.funcoes_hvc?.nome || 'N/A'}
                </label>
            </div>
        `).join('');
}

// ========================================
// FUNÇÕES DE AÇÕES
// ========================================

// Editar função
function editFuncao(id) {
    const funcao = funcoesData.find(f => f.id === id);
    if (funcao) {
        currentEditingFuncao = funcao;
        
        // Tentar primeiro com o ID do HTML atual
        let nomeField = document.getElementById('nome-funcao');
        if (!nomeField) {
            nomeField = document.getElementById('nomeFuncao');
        }
        
        if (nomeField) {
            nomeField.value = funcao.nome;
        }
        
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

// ========================================
// FUNÇÕES DE FILTRO - SEM FILTRO POR STATUS
// ========================================

// Filtrar equipes - SEM FILTRO POR STATUS
function filtrarEquipes() {
    const filtroNumero = document.getElementById('filtroNumeroEquipe')?.value.toLowerCase() || '';
    
    const equipesFiltradas = equipesData.filter(equipe => {
        const matchNumero = !filtroNumero || equipe.numero.toLowerCase().includes(filtroNumero);
        return matchNumero;
    });
    
    // Atualizar tabela com dados filtrados
    const tbody = document.querySelector('#tabelaEquipes tbody');
    
    if (!tbody) return;
    
    if (equipesFiltradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
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
                <td>${equipe.observacoes || '-'}</td>
                <td class="actions-cell">
                    <button class="btn-info" onclick="openEquipeModal(${equipe.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="confirmDeleteEquipe(${equipe.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filtrar integrantes - SEM FILTRO POR STATUS
function filtrarIntegrantes() {
    const filtroNome = document.getElementById('filtroNomeIntegrante')?.value.toLowerCase() || '';
    const filtroFuncao = document.getElementById('filtroFuncaoIntegrante')?.value || '';
    
    const integrantesFiltrados = integrantesData.filter(integrante => {
        const matchNome = !filtroNome || integrante.nome.toLowerCase().includes(filtroNome);
        const matchFuncao = !filtroFuncao || integrante.funcao_id == filtroFuncao;
        return matchNome && matchFuncao;
    });
    
    // Atualizar tabela com dados filtrados
    const tbody = document.querySelector('#tabelaIntegrantes tbody');
    
    if (!tbody) return;
    
    if (integrantesFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
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
            <td class="actions-cell">
                <button class="btn-info" onclick="openIntegranteModal(${integrante.id})" title="Editar">
                    <i class="fas fa-edit"></i>
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
    const cpfField = document.getElementById('cpfIntegrante');
    if (cpfField) {
        cpfField.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
    }
    
    // Formatação WhatsApp
    const whatsappField = document.getElementById('whatsappIntegrante');
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
window.filtrarEquipes = filtrarEquipes;
window.filtrarIntegrantes = filtrarIntegrantes;
window.updateSelectedCount = updateSelectedCount;

// ========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ========================================

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeSystem);

