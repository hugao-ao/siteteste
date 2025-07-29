// ========================================
// SISTEMA DE EQUIPES HVC - JAVASCRIPT CORRIGIDO
// ========================================
// Sistema completo para gerenciamento de equipes, integrantes e funções
// Compatível com a estrutura ES6 modules do projeto HVC

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
// FUNÇÕES DE INICIALIZAÇÃO
// ========================================

// Inicializar sistema
async function initializeSystem() {
    console.log('Inicializando sistema de equipes...');
    
    try {
        // Verificar se Supabase está disponível
        if (!supabase) {
            throw new Error('Supabase não está disponível');
        }
        
        console.log('Supabase disponível:', !!supabase);
        
        // Injetar sidebar
        if (typeof injectSidebarWithAutoDetection === 'function') {
            injectSidebarWithAutoDetection();
            console.log('Sidebar injetada com sucesso');
        } else {
            console.warn('Função de sidebar não disponível');
        }
        
        // Carregar dados iniciais
        await Promise.all([
            loadFuncoes(),
            loadIntegrantes(),
            loadEquipes()
        ]);
        
        // Configurar event listeners
        setupEventListeners();
        
        console.log('Sistema de equipes inicializado com sucesso');
        showNotification('Sistema de equipes carregado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao inicializar sistema:', error);
        showNotification('Erro ao carregar sistema de equipes: ' + error.message, 'error');
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Formatação automática de campos
    const cpfInput = document.getElementById('cpfIntegrante');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
    }
    
    const whatsappInput = document.getElementById('whatsappIntegrante');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', function(e) {
            e.target.value = formatWhatsApp(e.target.value);
        });
    }
    
    // Fechar modais ao clicar fora
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            if (e.target.id === 'modalEquipe') closeEquipeModal();
            if (e.target.id === 'modalIntegrante') closeIntegranteModal();
            if (e.target.id === 'modalFuncoes') closeFuncoesModal();
        }
    });
}

// ========================================
// FUNÇÕES DE DADOS - FUNÇÕES
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
        
    } catch (error) {
        console.error('Erro ao carregar funções:', error);
        showNotification('Erro ao carregar funções: ' + error.message, 'error');
    }
}

// Salvar função
async function saveFuncao(event) {
    event.preventDefault();
    
    const nome = document.getElementById('nomeFuncao').value.trim();
    
    if (!nome) {
        showNotification('Nome da função é obrigatório', 'error');
        return;
    }
    
    try {
        // Verificar se função já existe
        const existingFuncao = funcoesData.find(f => 
            f.nome.toLowerCase() === nome.toLowerCase() && 
            (!currentEditingFuncao || f.id !== currentEditingFuncao.id)
        );
        
        if (existingFuncao) {
            showNotification('Já existe uma função com este nome', 'error');
            return;
        }
        
        let result;
        
        if (currentEditingFuncao) {
            // Atualizar função existente
            result = await supabase
                .from('funcoes_hvc')
                .update({ nome })
                .eq('id', currentEditingFuncao.id)
                .select();
        } else {
            // Criar nova função
            result = await supabase
                .from('funcoes_hvc')
                .insert([{ nome }])
                .select();
        }
        
        if (result.error) {
            throw result.error;
        }
        
        showNotification(
            currentEditingFuncao ? 'Função atualizada com sucesso!' : 'Função criada com sucesso!'
        );
        
        // Recarregar dados
        await loadFuncoes();
        
        // Limpar formulário
        cancelNovaFuncao();
        
    } catch (error) {
        console.error('Erro ao salvar função:', error);
        showNotification('Erro ao salvar função: ' + error.message, 'error');
    }
}

// Excluir função
async function deleteFuncao(id) {
    if (!confirm('Tem certeza que deseja excluir esta função?')) {
        return;
    }
    
    try {
        // Verificar se função está sendo usada
        const { data: integrantesUsandoFuncao } = await supabase
            .from('integrantes_hvc')
            .select('id')
            .eq('funcao_id', id);
        
        if (integrantesUsandoFuncao && integrantesUsandoFuncao.length > 0) {
            showNotification('Não é possível excluir função que está sendo usada por integrantes', 'error');
            return;
        }
        
        const { error } = await supabase
            .from('funcoes_hvc')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        showNotification('Função excluída com sucesso!');
        await loadFuncoes();
        
    } catch (error) {
        console.error('Erro ao excluir função:', error);
        showNotification('Erro ao excluir função: ' + error.message, 'error');
    }
}

// Atualizar tabela de funções
function updateFuncoesTable() {
    const tbody = document.querySelector('#tabelaFuncoes tbody');
    if (!tbody) return;
    
    if (funcoesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">
                    <i class="fas fa-cog"></i>
                    <div>Nenhuma função cadastrada</div>
                    <div>Clique em "Nova Função" para começar</div>
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
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editFuncao(${funcao.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteFuncao(${funcao.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Atualizar selects de função
function updateFuncaoSelects() {
    const selects = [
        document.getElementById('funcaoIntegrante'),
        document.getElementById('filtroFuncaoIntegrante')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        const isFilter = select.id.includes('filtro');
        
        select.innerHTML = isFilter ? '<option value="">Todas</option>' : '<option value="">Selecione uma função</option>';
        
        funcoesData.forEach(funcao => {
            const option = document.createElement('option');
            option.value = funcao.id;
            option.textContent = funcao.nome;
            select.appendChild(option);
        });
        
        // Restaurar valor selecionado
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// ========================================
// FUNÇÕES DE DADOS - INTEGRANTES
// ========================================

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
        
    } catch (error) {
        console.error('Erro ao carregar integrantes:', error);
        showNotification('Erro ao carregar integrantes: ' + error.message, 'error');
    }
}

// Salvar integrante
async function saveIntegrante(event) {
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
    
    try {
        // Verificar se CPF já existe
        const existingIntegrante = integrantesData.find(i => 
            i.cpf === cpf && 
            (!currentEditingIntegrante || i.id !== currentEditingIntegrante.id)
        );
        
        if (existingIntegrante) {
            showNotification('Já existe um integrante com este CPF', 'error');
            return;
        }
        
        const integranteData = {
            nome,
            cpf,
            whatsapp,
            funcao_id: parseInt(funcaoId),
            observacoes: observacoes || null,
            status: 'ativo'
        };
        
        let result;
        
        if (currentEditingIntegrante) {
            // Atualizar integrante existente
            result = await supabase
                .from('integrantes_hvc')
                .update(integranteData)
                .eq('id', currentEditingIntegrante.id)
                .select();
        } else {
            // Criar novo integrante
            result = await supabase
                .from('integrantes_hvc')
                .insert([integranteData])
                .select();
        }
        
        if (result.error) {
            throw result.error;
        }
        
        showNotification(
            currentEditingIntegrante ? 'Integrante atualizado com sucesso!' : 'Integrante criado com sucesso!'
        );
        
        // Recarregar dados
        await loadIntegrantes();
        
        // Fechar modal
        closeIntegranteModal();
        
    } catch (error) {
        console.error('Erro ao salvar integrante:', error);
        showNotification('Erro ao salvar integrante: ' + error.message, 'error');
    }
}

// Excluir integrante
async function deleteIntegrante(id) {
    if (!confirm('Tem certeza que deseja excluir este integrante?')) {
        return;
    }
    
    try {
        // Verificar se integrante está em alguma equipe
        const { data: equipesComIntegrante } = await supabase
            .from('equipes_integrantes')
            .select('equipe_id')
            .eq('integrante_id', id);
        
        if (equipesComIntegrante && equipesComIntegrante.length > 0) {
            showNotification('Não é possível excluir integrante que faz parte de equipes', 'error');
            return;
        }
        
        const { error } = await supabase
            .from('integrantes_hvc')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        showNotification('Integrante excluído com sucesso!');
        await loadIntegrantes();
        
    } catch (error) {
        console.error('Erro ao excluir integrante:', error);
        showNotification('Erro ao excluir integrante: ' + error.message, 'error');
    }
}

// Atualizar tabela de integrantes
function updateIntegrantesTable() {
    const tbody = document.querySelector('#tabelaIntegrantes tbody');
    if (!tbody) return;
    
    let filteredIntegrantes = [...integrantesData];
    
    // Aplicar filtros
    const filtroNome = document.getElementById('filtroNomeIntegrante')?.value.toLowerCase() || '';
    const filtroFuncao = document.getElementById('filtroFuncaoIntegrante')?.value || '';
    const filtroStatus = document.getElementById('filtroStatusIntegrante')?.value || '';
    
    if (filtroNome) {
        filteredIntegrantes = filteredIntegrantes.filter(i => 
            i.nome.toLowerCase().includes(filtroNome)
        );
    }
    
    if (filtroFuncao) {
        filteredIntegrantes = filteredIntegrantes.filter(i => 
            i.funcao_id === parseInt(filtroFuncao)
        );
    }
    
    if (filtroStatus) {
        filteredIntegrantes = filteredIntegrantes.filter(i => 
            i.status === filtroStatus
        );
    }
    
    if (filteredIntegrantes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-user"></i>
                    <div>Nenhum integrante encontrado</div>
                    <div>Ajuste os filtros ou cadastre novos integrantes</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredIntegrantes.map(integrante => {
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Função não encontrada';
        const statusClass = integrante.status === 'ativo' ? 'success' : 'secondary';
        
        return `
            <tr>
                <td>${integrante.nome}</td>
                <td>${integrante.cpf}</td>
                <td>${integrante.whatsapp}</td>
                <td>${funcaoNome}</td>
                <td>
                    <span class="btn btn-${statusClass} btn-sm" style="cursor: default;">
                        ${integrante.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editIntegrante(${integrante.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteIntegrante(${integrante.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-${integrante.status === 'ativo' ? 'secondary' : 'success'} btn-sm" 
                            onclick="toggleIntegranteStatus(${integrante.id})" 
                            title="${integrante.status === 'ativo' ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${integrante.status === 'ativo' ? 'pause' : 'play'}"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Atualizar select de integrantes
function updateIntegrantesSelect() {
    const container = document.getElementById('integrantesSelect');
    if (!container) return;
    
    const integrantesAtivos = integrantesData.filter(i => i.status === 'ativo');
    
    if (integrantesAtivos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-plus"></i>
                <div>Nenhum integrante ativo disponível</div>
                <div>Cadastre integrantes primeiro</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = integrantesAtivos.map(integrante => {
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
        
        return `
            <div class="multi-select-item">
                <input type="checkbox" id="integrante_${integrante.id}" value="${integrante.id}" onchange="updateSelectedCount()">
                <label for="integrante_${integrante.id}" style="margin: 0; cursor: pointer; flex: 1;">
                    <strong>${integrante.nome}</strong> - ${funcaoNome}
                </label>
            </div>
        `;
    }).join('');
}

// ========================================
// FUNÇÕES DE DADOS - EQUIPES
// ========================================

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
                        nome,
                        funcoes_hvc (
                            nome
                        )
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
        
    } catch (error) {
        console.error('Erro ao carregar equipes:', error);
        showNotification('Erro ao carregar equipes: ' + error.message, 'error');
    }
}

// Salvar equipe
async function saveEquipe(event) {
    event.preventDefault();
    
    const numero = document.getElementById('numeroEquipe').value.trim();
    const observacoes = document.getElementById('observacoesEquipe').value.trim();
    
    // Obter integrantes selecionados
    const integrantesSelecionados = Array.from(
        document.querySelectorAll('#integrantesSelect input[type="checkbox"]:checked')
    ).map(checkbox => parseInt(checkbox.value));
    
    // Validações
    if (!numero) {
        showNotification('Número da equipe é obrigatório', 'error');
        return;
    }
    
    if (integrantesSelecionados.length === 0) {
        showNotification('Selecione pelo menos um integrante', 'error');
        return;
    }
    
    try {
        // Verificar se número já existe
        const existingEquipe = equipesData.find(e => 
            e.numero === numero && 
            (!currentEditingEquipe || e.id !== currentEditingEquipe.id)
        );
        
        if (existingEquipe) {
            showNotification('Já existe uma equipe com este número', 'error');
            return;
        }
        
        const equipeData = {
            numero,
            observacoes: observacoes || null,
            status: 'ativa'
        };
        
        let equipeId;
        
        if (currentEditingEquipe) {
            // Atualizar equipe existente
            const { error: updateError } = await supabase
                .from('equipes_hvc')
                .update(equipeData)
                .eq('id', currentEditingEquipe.id);
            
            if (updateError) throw updateError;
            
            equipeId = currentEditingEquipe.id;
            
            // Remover integrantes existentes
            const { error: deleteError } = await supabase
                .from('equipes_integrantes')
                .delete()
                .eq('equipe_id', equipeId);
            
            if (deleteError) throw deleteError;
            
        } else {
            // Criar nova equipe
            const { data: newEquipe, error: insertError } = await supabase
                .from('equipes_hvc')
                .insert([equipeData])
                .select()
                .single();
            
            if (insertError) throw insertError;
            
            equipeId = newEquipe.id;
        }
        
        // Adicionar integrantes à equipe
        const integrantesData = integrantesSelecionados.map(integranteId => ({
            equipe_id: equipeId,
            integrante_id: integranteId
        }));
        
        const { error: integrantesError } = await supabase
            .from('equipes_integrantes')
            .insert(integrantesData);
        
        if (integrantesError) throw integrantesError;
        
        showNotification(
            currentEditingEquipe ? 'Equipe atualizada com sucesso!' : 'Equipe criada com sucesso!'
        );
        
        // Recarregar dados
        await loadEquipes();
        
        // Fechar modal
        closeEquipeModal();
        
    } catch (error) {
        console.error('Erro ao salvar equipe:', error);
        showNotification('Erro ao salvar equipe: ' + error.message, 'error');
    }
}

// Excluir equipe
async function deleteEquipe(id) {
    if (!confirm('Tem certeza que deseja excluir esta equipe?')) {
        return;
    }
    
    try {
        // Remover integrantes da equipe primeiro
        const { error: deleteIntegrantesError } = await supabase
            .from('equipes_integrantes')
            .delete()
            .eq('equipe_id', id);
        
        if (deleteIntegrantesError) throw deleteIntegrantesError;
        
        // Remover equipe
        const { error: deleteEquipeError } = await supabase
            .from('equipes_hvc')
            .delete()
            .eq('id', id);
        
        if (deleteEquipeError) throw deleteEquipeError;
        
        showNotification('Equipe excluída com sucesso!');
        await loadEquipes();
        
    } catch (error) {
        console.error('Erro ao excluir equipe:', error);
        showNotification('Erro ao excluir equipe: ' + error.message, 'error');
    }
}

// Atualizar tabela de equipes
function updateEquipesTable() {
    const tbody = document.querySelector('#tabelaEquipes tbody');
    if (!tbody) return;
    
    let filteredEquipes = [...equipesData];
    
    // Aplicar filtros
    const filtroNumero = document.getElementById('filtroNumeroEquipe')?.value.toLowerCase() || '';
    const filtroStatus = document.getElementById('filtroStatusEquipe')?.value || '';
    
    if (filtroNumero) {
        filteredEquipes = filteredEquipes.filter(e => 
            e.numero.toLowerCase().includes(filtroNumero)
        );
    }
    
    if (filtroStatus) {
        filteredEquipes = filteredEquipes.filter(e => 
            e.status === filtroStatus
        );
    }
    
    if (filteredEquipes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-users"></i>
                    <div>Nenhuma equipe encontrada</div>
                    <div>Ajuste os filtros ou cadastre novas equipes</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredEquipes.map(equipe => {
        const integrantes = equipe.equipes_integrantes || [];
        const integrantesNomes = integrantes
            .map(ei => ei.integrantes_hvc?.nome)
            .filter(nome => nome)
            .join(', ');
        
        const statusClass = equipe.status === 'ativa' ? 'success' : 'secondary';
        
        return `
            <tr>
                <td><strong>${equipe.numero}</strong></td>
                <td>
                    <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                        ${integrantesNomes || 'Nenhum integrante'}
                    </div>
                    <small style="color: var(--theme-text-muted);">
                        ${integrantes.length} integrante${integrantes.length !== 1 ? 's' : ''}
                    </small>
                </td>
                <td>
                    <span class="btn btn-${statusClass} btn-sm" style="cursor: default;">
                        ${equipe.status}
                    </span>
                </td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                        ${equipe.observacoes || '-'}
                    </div>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editEquipe(${equipe.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEquipe(${equipe.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-${equipe.status === 'ativa' ? 'secondary' : 'success'} btn-sm" 
                            onclick="toggleEquipeStatus(${equipe.id})" 
                            title="${equipe.status === 'ativa' ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${equipe.status === 'ativa' ? 'pause' : 'play'}"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
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

// Modal Funções
function openFuncoesModal() {
    const modal = document.getElementById('modalFuncoes');
    modal.classList.add('show');
    cancelNovaFuncao(); // Garantir que formulário está fechado
}

function closeFuncoesModal() {
    const modal = document.getElementById('modalFuncoes');
    modal.classList.remove('show');
    cancelNovaFuncao();
}

// ========================================
// FUNÇÕES DE INTERFACE - FORMULÁRIOS
// ========================================

// Formulário de nova função
function openNovaFuncaoForm() {
    const form = document.getElementById('novaFuncaoForm');
    form.style.display = 'block';
    document.getElementById('nomeFuncao').focus();
}

function cancelNovaFuncao() {
    const form = document.getElementById('novaFuncaoForm');
    form.style.display = 'none';
    document.getElementById('nomeFuncao').value = '';
    currentEditingFuncao = null;
}

// Atualizar contador de selecionados
function updateSelectedCount() {
    const selectedCheckboxes = document.querySelectorAll('#integrantesSelect input[type="checkbox"]:checked');
    const countElement = document.getElementById('selectedCount');
    
    if (countElement) {
        const count = selectedCheckboxes.length;
        countElement.textContent = `${count} integrante${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
    }
}

// ========================================
// FUNÇÕES DE INTERFACE - AÇÕES
// ========================================

// Editar função
function editFuncao(id) {
    const funcao = funcoesData.find(f => f.id === id);
    if (!funcao) return;
    
    currentEditingFuncao = funcao;
    document.getElementById('nomeFuncao').value = funcao.nome;
    openNovaFuncaoForm();
}

// Editar integrante
function editIntegrante(id) {
    openIntegranteModal(id);
}

// Editar equipe
function editEquipe(id) {
    openEquipeModal(id);
}

// Toggle status integrante
async function toggleIntegranteStatus(id) {
    const integrante = integrantesData.find(i => i.id === id);
    if (!integrante) return;
    
    const novoStatus = integrante.status === 'ativo' ? 'inativo' : 'ativo';
    
    try {
        const { error } = await supabase
            .from('integrantes_hvc')
            .update({ status: novoStatus })
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification(`Integrante ${novoStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
        await loadIntegrantes();
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showNotification('Erro ao alterar status: ' + error.message, 'error');
    }
}

// Toggle status equipe
async function toggleEquipeStatus(id) {
    const equipe = equipesData.find(e => e.id === id);
    if (!equipe) return;
    
    const novoStatus = equipe.status === 'ativa' ? 'inativa' : 'ativa';
    
    try {
        const { error } = await supabase
            .from('equipes_hvc')
            .update({ status: novoStatus })
            .eq('id', id);
        
        if (error) throw error;
        
        showNotification(`Equipe ${novoStatus === 'ativa' ? 'ativada' : 'desativada'} com sucesso!`);
        await loadEquipes();
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showNotification('Erro ao alterar status: ' + error.message, 'error');
    }
}

// ========================================
// FUNÇÕES DE FILTROS
// ========================================

// Filtrar integrantes
function filtrarIntegrantes() {
    updateIntegrantesTable();
}

// Filtrar equipes
function filtrarEquipes() {
    updateEquipesTable();
}

// ========================================
// EXPOSIÇÃO DE FUNÇÕES GLOBAIS
// ========================================

// Expor funções necessárias globalmente para uso nos event handlers HTML
window.openEquipeModal = openEquipeModal;
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
window.editEquipe = editEquipe;
window.editIntegrante = editIntegrante;
window.editFuncao = editFuncao;
window.deleteEquipe = deleteEquipe;
window.deleteIntegrante = deleteIntegrante;
window.deleteFuncao = deleteFuncao;
window.toggleEquipeStatus = toggleEquipeStatus;
window.toggleIntegranteStatus = toggleIntegranteStatus;
window.filtrarEquipes = filtrarEquipes;
window.filtrarIntegrantes = filtrarIntegrantes;
window.updateSelectedCount = updateSelectedCount;

// ========================================
// INICIALIZAÇÃO
// ========================================

// Inicializar quando DOM estiver carregado
document.addEventListener('DOMContentLoaded', initializeSystem);

// Fallback para inicialização imediata se DOM já estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}

