// clientes.js - Versão modificada com permissões para usuários
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const adminViewIndicator = document.getElementById("admin-view-indicator");
const addClientForm = document.getElementById("add-client-form");
const newClientNameInput = document.getElementById("new-client-name");
const newClientWhatsappInput = document.getElementById("new-client-whatsapp");
const newClientProjectSelect = document.getElementById("new-client-project");
const newClientVisibilitySelect = document.getElementById("new-client-visibility"); // Novo elemento para visibilidade
const clientsTableBody = document.querySelector("#clients-table tbody");
const saveAllClientsBtn = document.getElementById("save-all-clients-btn");
// Modal Elements
const formsModal = document.getElementById("forms-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalTitle = document.getElementById("modal-title");
const clientFormsList = document.getElementById("client-forms-list");
const noFormsMessage = document.getElementById("no-forms-message");

// --- Variáveis de Estado e Informações do Usuário ---
let currentUser = null;
let currentUserId = null;
let currentUserNivel = null;
let currentUserProjeto = null;
let isAdmin = false;
let isActuallyAdmin = false;
let allUsers = [];
const modifiedClientIds = new Set();

// --- Funções de Utilidade ---
const sanitizeInput = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;") // Corrigido
    .replace(/`/g, "&#x60;");
};

// --- Verificação de Acesso e Inicialização ---
async function initializeDashboard() {
    console.log("clientes.js: initializeDashboard() INICIADO via DOMContentLoaded.");

    const loggedInUserId = sessionStorage.getItem("user_id");
    const loggedInUserNivel = sessionStorage.getItem("nivel");
    const loggedInUserProjeto = sessionStorage.getItem("projeto");

    if (!loggedInUserId || !loggedInUserNivel) {
        console.error("clientes.js: Usuário não logado ou sem nível definido.");
        alert("Acesso não autorizado. Faça login novamente.");
        window.location.href = "index.html";
        return;
    }
    console.log(`clientes.js: Usuário logado ID: ${loggedInUserId}, Nível: ${loggedInUserNivel}`);

    isActuallyAdmin = loggedInUserNivel === 'admin';

    const urlParams = new URLSearchParams(window.location.search);
    const filterProjectFromUrl = urlParams.get('projeto');

    const viewingUserIdFromSession = sessionStorage.getItem("viewing_user_id");
    const viewingUsernameFromSession = sessionStorage.getItem("viewing_username");

    let effectiveUserId = loggedInUserId;
    let effectiveNivel = loggedInUserNivel;
    let effectiveProjeto = loggedInUserProjeto;
    let isAdminViewingAsUser = false;

    // *** Lógica de Contexto ***
    if (isActuallyAdmin && filterProjectFromUrl) {
        console.log(`clientes.js: Contexto = Admin acessando projeto: ${filterProjectFromUrl}`);
        isAdmin = true;
        currentUserId = loggedInUserId;
        currentUserNivel = 'admin';
        currentUserProjeto = filterProjectFromUrl;
        if (adminViewIndicator) adminViewIndicator.style.display = 'block';
        if (addClientForm) addClientForm.style.display = 'grid';
        const addClientTitle = addClientForm?.previousElementSibling;
        if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'block';
        if (newClientProjectSelect) {
            newClientProjectSelect.value = filterProjectFromUrl;
            newClientProjectSelect.disabled = true;
        }
        document.title = `Gerenciar Clientes - ${filterProjectFromUrl}`;
        const pageTitleElement = document.querySelector('h1');
        if(pageTitleElement) pageTitleElement.textContent = `Gerenciamento de Clientes (${filterProjectFromUrl})`;

    } else if (isActuallyAdmin && viewingUserIdFromSession && viewingUsernameFromSession) {
        console.log(`clientes.js: Contexto = Admin visualizando como usuário ID: ${viewingUserIdFromSession}`);
        isAdminViewingAsUser = true;
        isAdmin = false;
        effectiveUserId = viewingUserIdFromSession;
        effectiveNivel = 'usuario';
        currentUser = viewingUsernameFromSession;
        try {
            console.log(`clientes.js: Buscando projeto para usuário visualizado ID: ${effectiveUserId}`);
            const { data: viewedUserData, error: viewedUserError } = await supabase
                .from('credenciais')
                .select('projeto')
                .eq('id', effectiveUserId)
                .single();
            if (viewedUserError) throw viewedUserError;
            effectiveProjeto = viewedUserData?.projeto;
            console.log(`clientes.js: Projeto do usuário visualizado (${effectiveUserId}): ${effectiveProjeto}`);
        } catch (error) {
            console.error("clientes.js: Erro ao buscar projeto do usuário visualizado:", error);
            effectiveProjeto = null;
            alert("Erro ao carregar informações do usuário visualizado.");
        }
        currentUserId = effectiveUserId;
        currentUserNivel = effectiveNivel;
        currentUserProjeto = effectiveProjeto;
        if (adminViewIndicator) adminViewIndicator.style.display = 'none';
        if (addClientForm) addClientForm.style.display = 'none';
        const addClientTitle = addClientForm?.previousElementSibling;
        if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'none';

    } else {
        console.log("clientes.js: Contexto = Usuário normal ou Admin geral.");
        currentUser = sessionStorage.getItem("usuario");
        isAdmin = isActuallyAdmin;
        currentUserId = loggedInUserId;
        currentUserNivel = loggedInUserNivel;
        currentUserProjeto = loggedInUserProjeto;
        if (isAdmin) {
            if (adminViewIndicator) adminViewIndicator.style.display = 'block';
            if (addClientForm) addClientForm.style.display = 'grid';
            const addClientTitle = addClientForm?.previousElementSibling;
            if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'block';
            if (newClientProjectSelect) newClientProjectSelect.disabled = false;
        } else {
            if (adminViewIndicator) adminViewIndicator.style.display = 'none';
            // MODIFICADO: Mostrar formulário para usuários normais
            if (addClientForm) addClientForm.style.display = 'grid';
            const addClientTitle = addClientForm?.previousElementSibling;
            if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'block';
            // Configurar projeto para o projeto do usuário
            if (newClientProjectSelect && currentUserProjeto) {
                newClientProjectSelect.value = currentUserProjeto;
                newClientProjectSelect.disabled = true;
            }
        }
    }
    console.log(`clientes.js: Contexto final - isAdmin: ${isAdmin}, currentUserId: ${currentUserId}, currentUserProjeto: ${currentUserProjeto}`);

    console.log("clientes.js: Carregando todos os usuários...");
    await loadAllUsers();
    console.log(`clientes.js: ${allUsers.length} usuários carregados.`);

    // --- Listeners --- 
    if (clientsTableBody) {
        clientsTableBody.addEventListener("click", handleTableClick);
        clientsTableBody.addEventListener("input", markClientAsModified);
        clientsTableBody.addEventListener("change", markClientAsModified);
        console.log("clientes.js: Listeners da tabela adicionados.");
    } else {
        console.error("clientes.js: Erro crítico - clientsTableBody não encontrado para adicionar listeners.");
    }
    if (addClientForm) {
        addClientForm.addEventListener("submit", addClient);
        console.log("clientes.js: Listener do formulário de adicionar cliente adicionado.");
    }
    if (saveAllClientsBtn) {
        saveAllClientsBtn.addEventListener('click', saveAllClientChanges);
        saveAllClientsBtn.disabled = true;
        console.log("clientes.js: Listener do botão Salvar Tudo adicionado.");
    }
    // Modal Listeners
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => formsModal.style.display = "none");
        console.log("clientes.js: Listener do botão fechar modal adicionado.");
    }
    window.addEventListener('click', (event) => {
        if (event.target == formsModal) {
            formsModal.style.display = "none";
        }
    });
    if (clientFormsList) {
        clientFormsList.addEventListener('click', handleDeleteFormClick);
        console.log("clientes.js: Listener da lista de formulários no modal adicionado.");
    }

    // Carrega clientes
    console.log(`clientes.js: Chamando loadClients com filtro de projeto URL: ${filterProjectFromUrl || 'Nenhum'}`);
    loadClients(filterProjectFromUrl);
    console.log("clientes.js: initializeDashboard() CONCLUÍDO.");
}

// Função para carregar todos os usuários (mantida)
async function loadAllUsers() {
    try {
        const { data, error } = await supabase
            .from('credenciais')
            .select('id, usuario')
            .order('usuario', { ascending: true });
        if (error) throw error;
        allUsers = data;
    } catch (error) {
        console.error("clientes.js: Erro ao carregar lista de usuários:", error);
        allUsers = [];
    }
}

// --- Carregar Clientes --- 
async function loadClients(filterProject = null) {
    console.log("clientes.js: loadClients() INICIADO.");
    modifiedClientIds.clear();
    if (saveAllClientsBtn) saveAllClientsBtn.disabled = true;

    if (!clientsTableBody) {
        console.error("clientes.js: Erro crítico em loadClients - clientsTableBody não encontrado!");
        return;
    }

    try {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Carregando clientes...</td></tr>';
        console.log("clientes.js: Construindo query Supabase...");
        let query = supabase.from('clientes').select('*, formularios_clientes(count)');

        // Lógica de filtro
        if (filterProject && isAdmin) {
            console.log(`clientes.js: Aplicando filtro de projeto (Admin): ${filterProject}`);
            query = query.eq('projeto', filterProject);
        } else if (!isAdmin) {
            if (!currentUserProjeto) {
                console.warn(`clientes.js: Usuário ${currentUserId} sem projeto, filtrando por assigned_to_user_id.`);
                query = query.eq("assigned_to_user_id", currentUserId);
            } else {
                console.log(`clientes.js: Aplicando filtro para usuário ${currentUserId} no projeto ${currentUserProjeto} (assigned OR TODOS)`);
                query = query.or(`assigned_to_user_id.eq.${currentUserId},and(visibility.eq.TODOS,projeto.eq.${currentUserProjeto})`);
            }
        } else {
             console.log("clientes.js: Carregando todos os clientes (Admin geral).");
        }

        console.log("clientes.js: Executando query Supabase...");
        const { data: clients, error } = await query.order('nome', { ascending: true });

        if (error) {
            console.error("clientes.js: Erro na query Supabase:", error);
            // Tratamento de erro mantido
            if (error.code === '42703') {
                if (error.message.includes('visibility')) throw new Error("Erro DB: Coluna 'visibility' não encontrada.");
                if (error.message.includes('assigned_to_user_id')) throw new Error("Erro DB: Coluna 'assigned_to_user_id' não encontrada.");
                if (error.message.includes('projeto')) throw new Error("Erro DB: Coluna 'projeto' não encontrada.");
            } else if (error.code === '42P01') {
                 if (error.message.includes('formularios_clientes')) throw new Error("Erro DB: Relação 'formularios_clientes' não encontrada/configurada.");
                 if (error.message.includes('clientes')) throw new Error("Erro DB: Tabela 'clientes' não encontrada.");
            }
            throw error; // Re-throw para o catch externo
        }
        
        console.log(`clientes.js: Query Supabase concluída. ${clients ? clients.length : 0} clientes encontrados.`);

        if (clients && clients.length === 0) {
            if (filterProject && isAdmin) {
                clientsTableBody.innerHTML = `<tr><td colspan="6">Nenhum cliente encontrado para o projeto ${sanitizeInput(filterProject)}.</td></tr>`;
            } else {
                clientsTableBody.innerHTML = '<tr><td colspan="6">Nenhum cliente encontrado para este contexto.</td></tr>';
            }
            console.log("clientes.js: Nenhum cliente encontrado, renderização interrompida.");
            return; // Interrompe se não houver clientes
        }

        console.log("clientes.js: Chamando renderClients...");
        renderClients(clients);
        console.log("clientes.js: renderClients concluído.");

    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClients:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Erro ao carregar clientes: ${error.message}</td></tr>`;
    }
    console.log("clientes.js: loadClients() CONCLUÍDO.");
}

// --- Renderizar Tabela de Clientes --- 
function renderClients(clients) {
    console.log("clientes.js: renderClients() INICIADO.");
    if (!clientsTableBody) {
        console.error("clientes.js: Erro crítico em renderClients - clientsTableBody não encontrado!");
        return;
    }
    clientsTableBody.innerHTML = ""; // Limpa antes de renderizar

    if (!clients || clients.length === 0) {
        console.warn("clientes.js: renderClients chamado com lista vazia ou nula.");
        clientsTableBody.innerHTML = '<tr><td colspan="6">Nenhum cliente para exibir.</td></tr>';
        return;
    }

    console.log(`clientes.js: Renderizando ${clients.length} clientes...`);
    clients.forEach((client, index) => {
        const tr = document.createElement("tr");
        tr.dataset.clientId = client.id;
        // <<< CORREÇÃO: Armazena nome original no dataset da linha >>>
        tr.dataset.originalNome = client.nome || ''; 
        tr.dataset.originalWhatsapp = client.whatsapp || '';
        tr.dataset.originalProjeto = client.projeto || '';
        tr.dataset.originalVisibility = client.visibility || 'INDIVIDUAL';
        tr.dataset.originalAssignedTo = client.assigned_to_user_id || '';

        // MODIFICADO: Lógica de permissão para edição/exclusão
        // Usuários podem editar/excluir:
        // 1. Clientes que eles mesmos criaram (criado_por_id === currentUserId)
        // 2. Clientes marcados como TODOS no projeto do usuário (visibility === 'TODOS' && projeto === currentUserProjeto)
        const canEditDelete = isAdmin || 
                             client.criado_por_id === currentUserId || 
                             (client.visibility === 'TODOS' && client.projeto === currentUserProjeto);
                             
        const formCount = client.formularios_clientes && client.formularios_clientes.length > 0 ? client.formularios_clientes[0].count : 0;

        const nomeHtml = canEditDelete
            ? `<input type="text" class="client-input" data-field="nome" id="nome-${client.id}" value="${sanitizeInput(client.nome)}">`
            : sanitizeInput(client.nome);

        const whatsappHtml = canEditDelete
            ? `<div class="whatsapp-cell"><i class="fa-brands fa-whatsapp phone-icon"></i><input type="text" class="client-input" data-field="whatsapp" id="whatsapp-${client.id}" value="${sanitizeInput(client.whatsapp)}" placeholder="+55 DDD Numero"></div>`
            : `<div class="whatsapp-cell"><i class="fa-brands fa-whatsapp phone-icon"></i><span>${sanitizeInput(client.whatsapp)}</span></div>`;

        let projectHtml = '';
        if (isAdmin) {
            projectHtml = `
                <select class="client-input" data-field="projeto" id="project-${client.id}">
                    <option value="Argos" ${client.projeto === 'Argos' ? 'selected' : ''}>Argos</option>
                    <option value="Hvc" ${client.projeto === 'Hvc' ? 'selected' : ''}>Hvc</option>
                    <option value="Planejamento" ${client.projeto === 'Planejamento' ? 'selected' : ''}>Planejamento</option>
                    <option value="" ${!client.projeto ? 'selected' : ''}>Nenhum</option>
                </select>
            `;
        } else {
            projectHtml = sanitizeInput(client.projeto) || '<span style="color:gray">N/A</span>';
        }

        let assignmentHtml = '';
        if (isAdmin) {
            const visibilitySelect = `
                <select class="client-input" data-field="visibility" id="visibility-${client.id}">
                    <option value="INDIVIDUAL" ${client.visibility === 'INDIVIDUAL' ? 'selected' : ''}>Individual</option>
                    <option value="TODOS" ${client.visibility === 'TODOS' ? 'selected' : ''}>Todos</option>
                </select>
            `;

            const userOptions = allUsers.map(user => {
                return `<option value="${user.id}" ${client.assigned_to_user_id === user.id ? 'selected' : ''}>${sanitizeInput(user.usuario)}</option>`;
            }).join('');

            assignmentHtml = `
                <div>
                    ${visibilitySelect}
                    <select class="client-input" data-field="assigned_to_user_id" id="assigned-${client.id}">
                        <option value="">Nenhum</option>
                        ${userOptions}
                    </select>
                </div>
            `;
        } else if (canEditDelete && client.criado_por_id === currentUserId) {
            // MODIFICADO: Permitir que usuários alterem a visibilidade de seus próprios clientes
            const visibilitySelect = `
                <select class="client-input" data-field="visibility" id="visibility-${client.id}">
                    <option value="INDIVIDUAL" ${client.visibility === 'INDIVIDUAL' ? 'selected' : ''}>Individual</option>
                    <option value="TODOS" ${client.visibility === 'TODOS' ? 'selected' : ''}>Todos</option>
                </select>
            `;
            assignmentHtml = visibilitySelect;
        } else {
            const visibilityText = client.visibility === 'TODOS' ? '<span class="status-todos">TODOS</span>' : '<span class="status-individual">Individual</span>';
            const assignedUserName = allUsers.find(u => u.id === client.assigned_to_user_id)?.usuario || 'Nenhum';
            assignmentHtml = `${visibilityText} / ${sanitizeInput(assignedUserName)}`;
        }

        // Botão para coluna Dashboard (ícone de ver detalhes)
        const dashboardButtonHtml = `
            <button class="view-details-btn" data-client-id="${client.id}" title="Ver Detalhes">
                <i class="fa-solid fa-eye"></i>
            </button>
        `;

        // Botões para coluna Ações (formulários + diagnóstico + excluir)
        const actionsHtml = `
            <button class="view-forms-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Ver Formulários">
                <i class="fa-solid fa-file-lines"></i> ${formCount}
            </button>
            <button class="view-details-btn" onclick="abrirDiagnostico('${client.id}')" title="Diagnóstico Financeiro" style="color: #9b59b6;">
                <i class="fas fa-chart-line"></i>
            </button>
            ${canEditDelete ? `<button class="delete-btn" data-id="${client.id}" title="Excluir Cliente"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        `;


        tr.innerHTML = `
            <td data-label="Nome">${nomeHtml}</td>
            <td data-label="WhatsApp">${whatsappHtml}</td>
            <td data-label="Projeto">${projectHtml}</td>
            <td data-label="Status/Atribuição">${assignmentHtml}</td>
            <td data-label="Dashboard">${dashboardButtonHtml}</td>
            <td data-label="Ações">${actionsHtml}</td>
        `;

        clientsTableBody.appendChild(tr);
    });
    console.log("clientes.js: renderClients() CONCLUÍDO.");
}

// --- Marcar Cliente como Modificado --- 
function markClientAsModified(event) {
    const input = event.target;
    if (!input || !input.classList.contains('client-input')) return;

    const row = input.closest('tr');
    if (!row) return;

    const clientId = row.dataset.clientId;
    if (!clientId) return;

    const field = input.dataset.field;
    if (!field) return;

    let originalValue;
    switch (field) {
        case 'nome':
            originalValue = row.dataset.originalNome;
            break;
        case 'whatsapp':
            originalValue = row.dataset.originalWhatsapp;
            break;
        case 'projeto':
            originalValue = row.dataset.originalProjeto;
            break;
        case 'visibility':
            originalValue = row.dataset.originalVisibility;
            break;
        case 'assigned_to_user_id':
            originalValue = row.dataset.originalAssignedTo;
            break;
        default:
            originalValue = '';
    }

    const currentValue = input.value;
    if (currentValue !== originalValue) {
        row.classList.add('modified');
        modifiedClientIds.add(clientId);
        if (saveAllClientsBtn) saveAllClientsBtn.disabled = false;
    } else {
        // Verificar se outros campos na mesma linha ainda estão modificados
        const otherModifiedInputs = row.querySelectorAll('.client-input');
        let stillModified = false;
        otherModifiedInputs.forEach(otherInput => {
            if (otherInput !== input) {
                const otherField = otherInput.dataset.field;
                let otherOriginalValue;
                switch (otherField) {
                    case 'nome':
                        otherOriginalValue = row.dataset.originalNome;
                        break;
                    case 'whatsapp':
                        otherOriginalValue = row.dataset.originalWhatsapp;
                        break;
                    case 'projeto':
                        otherOriginalValue = row.dataset.originalProjeto;
                        break;
                    case 'visibility':
                        otherOriginalValue = row.dataset.originalVisibility;
                        break;
                    case 'assigned_to_user_id':
                        otherOriginalValue = row.dataset.originalAssignedTo;
                        break;
                    default:
                        otherOriginalValue = '';
                }
                if (otherInput.value !== otherOriginalValue) {
                    stillModified = true;
                }
            }
        });
        if (!stillModified) {
            row.classList.remove('modified');
            modifiedClientIds.delete(clientId);
            if (modifiedClientIds.size === 0 && saveAllClientsBtn) saveAllClientsBtn.disabled = true;
        }
    }
}

// --- Adicionar Cliente --- 
async function addClient(event) {
    event.preventDefault();
    console.log("clientes.js: addClient() chamado.");

    const name = newClientNameInput.value.trim();
    const whatsapp = newClientWhatsappInput.value.trim();
    const project = newClientProjectSelect.value;
    
    // MODIFICADO: Obter visibilidade do select (se existir) ou definir com base no contexto
    let visibility = "INDIVIDUAL"; // Valor padrão
    if (newClientVisibilitySelect && !isAdmin) {
        visibility = newClientVisibilitySelect.value;
    }

    if (!name || !whatsapp || !project) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        const { data, error } = await supabase.from("clientes").insert([
            {
                nome: name,
                whatsapp: whatsapp,
                projeto: project,
                criado_por_id: currentUserId,
                visibility: visibility,
                assigned_to_user_id: currentUserId
            }
        ]).select();

        if (error) {
            console.error("clientes.js: Erro ao adicionar cliente (Supabase):", error);
            throw error;
        }

        alert("Cliente adicionado com sucesso!");
        newClientNameInput.value = "";
        newClientWhatsappInput.value = "";
        if (newClientVisibilitySelect) newClientVisibilitySelect.value = "INDIVIDUAL";
        if (!isAdmin && newClientProjectSelect) newClientProjectSelect.value = currentUserProjeto;

        // Recarregar lista de clientes
        const urlParams = new URLSearchParams(window.location.search);
        loadClients(urlParams.get('projeto'));
        console.log("clientes.js: Cliente adicionado com sucesso.");
    } catch (error) {
        console.error("clientes.js: Erro GERAL em addClient:", error);
        alert("Erro ao adicionar cliente: " + error.message);
    }
}

// --- Salvar Alterações em Clientes --- 
async function saveAllClientChanges() {
    console.log("clientes.js: saveAllClientChanges() chamado.");
    if (modifiedClientIds.size === 0) {
        alert("Nenhuma alteração para salvar.");
        return;
    }

    try {
        const updates = [];
        modifiedClientIds.forEach(clientId => {
            const row = clientsTableBody.querySelector(`tr[data-client-id="${clientId}"]`);
            if (!row) return;

            const updateData = { id: clientId };
            
            const nomeInput = row.querySelector(`input[data-field="nome"]`);
            if (nomeInput) updateData.nome = nomeInput.value.trim();
            
            const whatsappInput = row.querySelector(`input[data-field="whatsapp"]`);
            if (whatsappInput) updateData.whatsapp = whatsappInput.value.trim();
            
            const projetoSelect = row.querySelector(`select[data-field="projeto"]`);
            if (projetoSelect) updateData.projeto = projetoSelect.value;
            
            const visibilitySelect = row.querySelector(`select[data-field="visibility"]`);
            if (visibilitySelect) updateData.visibility = visibilitySelect.value;
            
            const assignedSelect = row.querySelector(`select[data-field="assigned_to_user_id"]`);
            if (assignedSelect) updateData.assigned_to_user_id = assignedSelect.value || null;
            
            updates.push(updateData);
        });

        if (updates.length === 0) {
            alert("Nenhuma alteração válida para salvar.");
            return;
        }

        const { error } = await supabase.from("clientes").upsert(updates);
        if (error) {
            console.error("clientes.js: Erro ao salvar alterações (Supabase):", error);
            throw error;
        }

        alert("Alterações salvas com sucesso!");
        
        // Atualizar valores originais e limpar marcações
        updates.forEach(update => {
            const row = clientsTableBody.querySelector(`tr[data-client-id="${update.id}"]`);
            if (!row) return;
            
            if (update.nome !== undefined) row.dataset.originalNome = update.nome;
            if (update.whatsapp !== undefined) row.dataset.originalWhatsapp = update.whatsapp;
            if (update.projeto !== undefined) row.dataset.originalProjeto = update.projeto;
            if (update.visibility !== undefined) row.dataset.originalVisibility = update.visibility;
            if (update.assigned_to_user_id !== undefined) row.dataset.originalAssignedTo = update.assigned_to_user_id || '';
            
            row.classList.remove('modified');
        });
        
        modifiedClientIds.clear();
        if (saveAllClientsBtn) saveAllClientsBtn.disabled = true;
        console.log("clientes.js: Alterações salvas com sucesso.");
    } catch (error) {
        console.error("clientes.js: Erro GERAL em saveAllClientChanges:", error);
        alert("Erro ao salvar alterações: " + error.message);
    }
}

// --- Excluir Cliente --- 
async function deleteClient(id) {
    console.log(`clientes.js: deleteClient() chamado para Cliente ID: ${id}`);
    if (!id) {
        console.error("clientes.js: ID do cliente não fornecido para exclusão.");
        return;
    }

    try {
        // MODIFICADO: Verificar permissões antes de excluir
        const { data: clientData, error: clientError } = await supabase
            .from('clientes')
            .select('criado_por_id, visibility, projeto')
            .eq('id', id)
            .single();
            
        if (clientError) {
            console.error("clientes.js: Erro ao verificar cliente para exclusão:", clientError);
            throw new Error("Erro ao verificar permissões: " + clientError.message);
        }
        
        // Verificar permissões
        const canDelete = isAdmin || 
                         clientData.criado_por_id === currentUserId || 
                         (clientData.visibility === 'TODOS' && clientData.projeto === currentUserProjeto);
                         
        if (!canDelete) {
            throw new Error("Você não tem permissão para excluir este cliente.");
        }

        // Verificar se há formulários associados
        let count = 0;
        const { data: countData, error: countError } = await supabase
            .from('formularios_clientes')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (countError) {
            console.error("clientes.js: Erro ao contar formulários para exclusão:", countError);
            // Não lança erro aqui, permite excluir cliente mesmo se contagem falhar
        } else if (countData) {
            count = countData.count || 0;
        }

        let confirmMessage = "Excluir este cliente?";
        if (count > 0) confirmMessage += `\n\nATENÇÃO: ${count} formulário(s) associado(s) também serão excluídos!`;
        if (!confirm(confirmMessage)) {
            console.log("clientes.js: Exclusão cancelada pelo usuário.");
            return;
        }

        const { error: deleteError } = await supabase.from("clientes").delete().eq("id", id);
        if (deleteError) {
            console.error("clientes.js: Erro ao excluir cliente (Supabase):", deleteError);
            throw deleteError;
        }

        alert("Cliente e formulários associados excluídos!");
        const rowToRemove = clientsTableBody.querySelector(`tr[data-client-id="${id}"]`);
        if (rowToRemove) rowToRemove.remove();
        modifiedClientIds.delete(id);
        if (modifiedClientIds.size === 0 && saveAllClientsBtn) saveAllClientsBtn.disabled = true;
        console.log(`clientes.js: Cliente ID ${id} excluído com sucesso.`);
    } catch (error) {
        console.error("clientes.js: Erro GERAL em deleteClient:", error);
        alert("Erro ao excluir cliente: " + error.message);
    }
}

// --- Lógica do Modal de Formulários --- 
async function showClientFormsModal(clientId, clientName) {
    console.log(`clientes.js: showClientFormsModal() chamado para Cliente ID: ${clientId}, Nome: ${clientName}`);
    if (!formsModal || !modalTitle || !clientFormsList || !noFormsMessage) {
        console.error("clientes.js: Elementos do modal não encontrados!");
        return;
    }

    modalTitle.textContent = `Formulários de: ${sanitizeInput(clientName)}`;
    clientFormsList.innerHTML = '<li>Carregando formulários...</li>';
    noFormsMessage.style.display = 'none';
    formsModal.style.display = "block";

    await loadClientForms(clientId);
}

async function loadClientForms(clientId) {
    console.log(`clientes.js: loadClientForms() chamado para Cliente ID: ${clientId}`);
    try {
        const { data: forms, error } = await supabase
            .from('formularios_clientes')
            .select('id, created_at') // Seleciona apenas id e created_at
            .eq('cliente_id', clientId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("clientes.js: Erro ao carregar formulários (Supabase):", error);
            throw error;
        }

        console.log(`clientes.js: ${forms ? forms.length : 0} formulários encontrados para cliente ${clientId}.`);
        clientFormsList.innerHTML = '';

        if (!forms || forms.length === 0) {
            noFormsMessage.style.display = 'block';
        } else {
            noFormsMessage.style.display = 'none';
            forms.forEach(form => {
                const li = document.createElement('li');
                const formDate = new Date(form.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                li.innerHTML = `
                    <span class="form-info">Formulário - ${formDate}</span>
                    <div class="form-actions">
                        <button class="delete-form-btn" data-form-id="${form.id}" data-client-id="${clientId}" title="Excluir Formulário"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
                clientFormsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClientForms:", error);
        clientFormsList.innerHTML = `<li style="color: red;">Erro ao carregar formulários: ${error.message}</li>`;
    }
}

// --- Excluir Formulário --- 
async function deleteForm(formId, clientId) {
    console.log(`clientes.js: deleteForm() chamado para Formulário ID: ${formId}, Cliente ID: ${clientId}`);
    if (!formId || !clientId) {
        console.error("clientes.js: IDs não fornecidos para exclusão de formulário.");
        return;
    }

    try {
        // MODIFICADO: Verificar permissões antes de excluir formulário
        const { data: clientData, error: clientError } = await supabase
            .from('clientes')
            .select('criado_por_id, visibility, projeto')
            .eq('id', clientId)
            .single();
            
        if (clientError) {
            console.error("clientes.js: Erro ao verificar cliente para exclusão de formulário:", clientError);
            throw new Error("Erro ao verificar permissões: " + clientError.message);
        }
        
        // Verificar permissões
        const canDelete = isAdmin || 
                         clientData.criado_por_id === currentUserId || 
                         (clientData.visibility === 'TODOS' && clientData.projeto === currentUserProjeto);
                         
        if (!canDelete) {
            throw new Error("Você não tem permissão para excluir formulários deste cliente.");
        }

        if (!confirm("Tem certeza que deseja excluir este formulário?")) {
            console.log("clientes.js: Exclusão de formulário cancelada pelo usuário.");
            return;
        }

        const { error: deleteError } = await supabase.from("formularios_clientes").delete().eq("id", formId);
        if (deleteError) {
            console.error("clientes.js: Erro ao excluir formulário (Supabase):", deleteError);
            throw deleteError;
        }

        alert("Formulário excluído com sucesso!");
        // Atualizar contagem de formulários na tabela
        const formButton = clientsTableBody.querySelector(`button.view-forms-btn[data-client-id="${clientId}"]`);
        if (formButton) {
            const formCountText = formButton.textContent.trim();
            const formCount = parseInt(formCountText);
            if (!isNaN(formCount) && formCount > 0) {
                formButton.innerHTML = `<i class="fa-solid fa-file-lines"></i> ${formCount - 1}`;
            }
        }
        // Recarregar formulários no modal
        await loadClientForms(clientId);
        console.log(`clientes.js: Formulário ID ${formId} excluído com sucesso.`);
    } catch (error) {
        console.error("clientes.js: Erro GERAL em deleteForm:", error);
        alert("Erro ao excluir formulário: " + error.message);
    }
}

// --- Manipulador de Cliques na Tabela --- 
function handleTableClick(event) {
    const target = event.target;
    
    // Botão de exclusão de cliente
    if (target.classList.contains("delete-btn") || target.closest(".delete-btn")) {
        const deleteBtn = target.classList.contains("delete-btn") ? target : target.closest(".delete-btn");
        const id = deleteBtn.dataset.id;
        deleteClient(id);
        return;
    }
    
    // Botão de visualização de formulários
    if (target.classList.contains("view-forms-btn") || target.closest(".view-forms-btn")) {
        const formBtn = target.classList.contains("view-forms-btn") ? target : target.closest(".view-forms-btn");
        const clientId = formBtn.dataset.clientId;
        const clientName = formBtn.dataset.clientName;
        showClientFormsModal(clientId, clientName);
        return;
    }
    
    // Botão de visualização de detalhes
    if (target.classList.contains("view-details-btn") || target.closest(".view-details-btn")) {
        const detailsBtn = target.classList.contains("view-details-btn") ? target : target.closest(".view-details-btn");
        const clientId = detailsBtn.dataset.clientId;
        
        // Detectar projeto atual para manter contexto na página de detalhes
        const urlParams = new URLSearchParams(window.location.search);
        let currentProject = urlParams.get('projeto');
        
        // Se não há projeto na URL, detectar pela página atual
        if (!currentProject) {
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage.includes('planejamento') || currentPage === 'clientes-dashboard.html') {
                currentProject = 'Planejamento';
            } else if (currentPage.includes('hvc')) {
                currentProject = 'Hvc';
            } else if (currentPage.includes('argos')) {
                currentProject = 'Argos';
            }
        }
        
        // Incluir projeto na URL se detectado
        const projectParam = currentProject ? `&projeto=${currentProject}` : '';
        window.location.href = `cliente-detalhes.html?id=${clientId}${projectParam}`;
        return;
    }
}

// --- Manipulador de Cliques no Modal de Formulários --- 
function handleDeleteFormClick(event) {
    const target = event.target;
    
    // Botão de exclusão de formulário
    if (target.classList.contains("delete-form-btn") || target.closest(".delete-form-btn")) {
        const deleteBtn = target.classList.contains("delete-form-btn") ? target : target.closest(".delete-form-btn");
        const formId = deleteBtn.dataset.formId;
        const clientId = deleteBtn.dataset.clientId;
        deleteForm(formId, clientId);
    }
}

// Função para acessar diagnóstico do cliente
async function acessarDiagnostico(clienteId) {
    try {
        // Verificar se já existe diagnóstico para este cliente
        const { data: diagnosticoExistente, error: searchError } = await supabase
            .from('diagnosticos_financeiros')
            .select('link_unico')
            .eq('cliente_id', clienteId)
            .single();
        
        if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
        }
        
        let linkUnico;
        
        if (diagnosticoExistente) {
            // Usar diagnóstico existente
            linkUnico = diagnosticoExistente.link_unico;
        } else {
            // Criar novo diagnóstico
            const { data: cliente, error: clienteError } = await supabase
                .from('clientes')
                .select('nome, outras_pessoas_renda')
                .eq('id', clienteId)
                .single();
            
            if (clienteError) throw clienteError;
            
            // Gerar link único
            linkUnico = 'diag_' + Math.random().toString(36).substr(2, 16);
            
            // Criar diagnóstico
            const { error: createError } = await supabase
                .from('diagnosticos_financeiros')
                .insert({
                    cliente_id: clienteId,
                    link_unico: linkUnico,
                    nome_principal: cliente.nome || '',
                    nomes_outras_pessoas_renda: cliente.outras_pessoas_renda || '',
                    created_by_id: currentUserId
                });
            
            if (createError) throw createError;
        }
        
        // Abrir diagnóstico em nova aba
        const url = `diagnostico-financeiro.html?link=${linkUnico}`;
        window.open(url, '_blank');
        
    } catch (error) {
        console.error('Erro ao acessar diagnóstico:', error);
        alert('Erro ao acessar diagnóstico: ' + error.message);
    }
}

// Tornar a função global para ser acessível pelo onclick
window.acessarDiagnostico = acessarDiagnostico;

// ===== DIAGNÓSTICO FINANCEIRO INTEGRADO =====

// Variáveis globais para o diagnóstico
let currentClienteId = null;
let currentDiagnostico = null;
let pessoasRenda = [];
let dependentes = [];
let patrimonios = [];

// Função principal para abrir o modal do diagnóstico
async function abrirDiagnostico(clienteId, clienteNome) {
  console.log('Abrindo diagnóstico para cliente:', clienteId, clienteNome);
  
  currentClienteId = clienteId;
  
  // Elementos do modal
  const diagnosticoModal = document.getElementById('diagnostico-modal');
  const clienteNomeDiagnostico = document.getElementById('cliente-nome-diagnostico');
  const diagnosticoLoading = document.getElementById('diagnostico-loading');
  const diagnosticoForm = document.getElementById('diagnostico-form');
  const diagnosticoError = document.getElementById('diagnostico-error');
  
  // Verificar se elementos existem
  if (!diagnosticoModal) {
    alert('Modal do diagnóstico não encontrado. Verifique se o HTML foi adicionado corretamente.');
    return;
  }
  
  // Mostrar modal
  diagnosticoModal.style.display = 'block';
  if (clienteNomeDiagnostico) {
    clienteNomeDiagnostico.textContent = clienteNome;
  }
  
  // Mostrar loading
  if (diagnosticoLoading) diagnosticoLoading.style.display = 'block';
  if (diagnosticoForm) diagnosticoForm.style.display = 'none';
  if (diagnosticoError) diagnosticoError.style.display = 'none';
  
  try {
    // Carregar diagnóstico existente
    await carregarDiagnostico(clienteId);
    
    // Mostrar formulário
    if (diagnosticoLoading) diagnosticoLoading.style.display = 'none';
    if (diagnosticoForm) diagnosticoForm.style.display = 'block';
    
  } catch (error) {
    console.error('Erro ao carregar diagnóstico:', error);
    if (diagnosticoLoading) diagnosticoLoading.style.display = 'none';
    if (diagnosticoError) {
      diagnosticoError.style.display = 'block';
      const errorMessage = document.getElementById('diagnostico-error-message');
      if (errorMessage) {
        errorMessage.textContent = error.message;
      }
    }
  }
}

// Função para carregar diagnóstico existente do banco
async function carregarDiagnostico(clienteId) {
  console.log('Carregando diagnóstico para cliente:', clienteId);
  
  try {
    const { data: diagnostico, error } = await supabase
      .from('diagnosticos_financeiros')
      .select('*')
      .eq('cliente_id', clienteId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    if (diagnostico) {
      // Diagnóstico existe, carregar dados
      console.log('Diagnóstico encontrado:', diagnostico);
      currentDiagnostico = diagnostico;
      preencherFormularioDiagnostico(diagnostico);
      atualizarStatusBadge(diagnostico.status || 'em_andamento');
    } else {
      // Diagnóstico não existe, criar novo
      console.log('Diagnóstico não encontrado, criando novo');
      currentDiagnostico = null;
      limparFormularioDiagnostico();
      atualizarStatusBadge('em_andamento');
    }
    
  } catch (error) {
    throw new Error('Erro ao carregar diagnóstico: ' + error.message);
  }
}

// Função para preencher formulário com dados existentes
function preencherFormularioDiagnostico(diagnostico) {
  console.log('Preenchendo formulário com dados:', diagnostico);
  
  // Dados pessoais
  const campos = [
    { id: 'diag_nome', valor: diagnostico.nome_diagnostico || '', formatacao: null },
    { id: 'diag_cpf', valor: diagnostico.cpf || '', formatacao: formatarCPF },
    { id: 'diag_data_nascimento', valor: diagnostico.data_nascimento || '', formatacao: null },
    { id: 'diag_profissao', valor: diagnostico.profissao || '', formatacao: null },
    { id: 'diag_estado_civil', valor: diagnostico.estado_civil || '', formatacao: null },
    { id: 'diag_telefone', valor: diagnostico.telefone || '', formatacao: formatarTelefone },
    { id: 'diag_email', valor: diagnostico.email || '', formatacao: null },
    
    // Dados do cônjuge
    { id: 'diag_conjuge_nome', valor: diagnostico.conjuge_nome || '', formatacao: null },
    { id: 'diag_conjuge_cpf', valor: diagnostico.conjuge_cpf || '', formatacao: formatarCPF },
    { id: 'diag_conjuge_data_nascimento', valor: diagnostico.conjuge_data_nascimento || '', formatacao: null },
    { id: 'diag_conjuge_profissao', valor: diagnostico.conjuge_profissao || '', formatacao: null },
    { id: 'diag_conjuge_telefone', valor: diagnostico.conjuge_telefone || '', formatacao: formatarTelefone },
    { id: 'diag_conjuge_email', valor: diagnostico.conjuge_email || '', formatacao: null },
    { id: 'diag_regime_bens', valor: diagnostico.regime_bens || '', formatacao: null }
  ];
  
  // Preencher cada campo
  campos.forEach(campo => {
    const elemento = document.getElementById(campo.id);
    if (elemento) {
      const valorFormatado = campo.formatacao ? campo.formatacao(campo.valor) : campo.valor;
      elemento.value = valorFormatado;
    }
  });
  
  // Mostrar/ocultar campos condicionais
  toggleConjugeFieldsDiagnostico();
  
  // Carregar arrays
  pessoasRenda = diagnostico.pessoas_renda || [];
  dependentes = diagnostico.dependentes || [];
  patrimonios = diagnostico.patrimonios || [];
  
  // Renderizar cards dinâmicos (placeholder - implementar depois)
  renderPessoasRendaDiagnostico();
  renderDependentesDiagnostico();
  renderPatrimoniosDiagnostico();
  calcularPatrimonioTotalDiagnostico();
}

// Função para limpar formulário
function limparFormularioDiagnostico() {
  console.log('Limpando formulário do diagnóstico');
  
  const form = document.getElementById('diagnostico-form');
  if (form) {
    form.reset();
  }
  
  pessoasRenda = [];
  dependentes = [];
  patrimonios = [];
  
  // Limpar containers dinâmicos
  const containers = ['pessoas-renda-container', 'dependentes-container', 'patrimonios-container'];
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  });
  
  calcularPatrimonioTotalDiagnostico();
}

// Função para atualizar badge de status
function atualizarStatusBadge(status) {
  const badge = document.getElementById('diagnostico-status-badge');
  if (badge) {
    badge.textContent = status === 'finalizado' ? 'Finalizado' : 'Em Andamento';
    badge.className = `status-badge ${status.replace('_', '-')}`;
  }
}

// Função para fechar modal
function fecharDiagnostico() {
  console.log('Fechando modal do diagnóstico');
  
  const modal = document.getElementById('diagnostico-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  currentClienteId = null;
  currentDiagnostico = null;
}

// Função para salvar diagnóstico
async function salvarDiagnostico() {
  console.log('Salvando diagnóstico...');
  
  try {
    // Coletar dados do formulário
    const dadosDiagnostico = coletarDadosDiagnostico();
    
    // Validar dados obrigatórios
    if (!validarDadosDiagnostico(dadosDiagnostico)) {
      return; // Validação já mostra erro
    }
    
    // Salvar no Supabase
    let resultado;
    if (currentDiagnostico) {
      // Atualizar existente
      console.log('Atualizando diagnóstico existente:', currentDiagnostico.id);
      resultado = await supabase
        .from('diagnosticos_financeiros')
        .update(dadosDiagnostico)
        .eq('id', currentDiagnostico.id);
    } else {
      // Criar novo
      console.log('Criando novo diagnóstico para cliente:', currentClienteId);
      dadosDiagnostico.cliente_id = currentClienteId;
      dadosDiagnostico.link_unico = generateUUID(); // Gerar UUID único
      resultado = await supabase
        .from('diagnosticos_financeiros')
        .insert([dadosDiagnostico]);
    }
    
    if (resultado.error) throw resultado.error;
    
    alert('Diagnóstico salvo com sucesso!');
    fecharDiagnostico();
    
  } catch (error) {
    console.error('Erro ao salvar diagnóstico:', error);
    alert('Erro ao salvar diagnóstico: ' + error.message);
  }
}

// Função para coletar dados do formulário
function coletarDadosDiagnostico() {
  const dados = {
    nome_diagnostico: obterValorCampo('diag_nome'),
    cpf: obterValorCampo('diag_cpf', true), // true = remover formatação
    data_nascimento: obterValorCampo('diag_data_nascimento'),
    profissao: obterValorCampo('diag_profissao'),
    estado_civil: obterValorCampo('diag_estado_civil'),
    telefone: obterValorCampo('diag_telefone', true), // true = remover formatação
    email: obterValorCampo('diag_email'),
    conjuge_nome: obterValorCampo('diag_conjuge_nome'),
    conjuge_cpf: obterValorCampo('diag_conjuge_cpf', true),
    conjuge_data_nascimento: obterValorCampo('diag_conjuge_data_nascimento'),
    conjuge_profissao: obterValorCampo('diag_conjuge_profissao'),
    conjuge_telefone: obterValorCampo('diag_conjuge_telefone', true),
    conjuge_email: obterValorCampo('diag_conjuge_email'),
    regime_bens: obterValorCampo('diag_regime_bens'),
    pessoas_renda: pessoasRenda,
    dependentes: dependentes,
    patrimonios: patrimonios,
    status: 'em_andamento',
    updated_at: new Date().toISOString()
  };
  
  console.log('Dados coletados:', dados);
  return dados;
}

// Função auxiliar para obter valor de campo
function obterValorCampo(id, removerFormatacao = false) {
  const elemento = document.getElementById(id);
  if (!elemento) return '';
  
  let valor = elemento.value.trim();
  
  if (removerFormatacao) {
    valor = valor.replace(/\D/g, ''); // Remove tudo que não é dígito
  }
  
  return valor;
}

// Função para validar dados obrigatórios
function validarDadosDiagnostico(dados) {
  if (!dados.nome_diagnostico) {
    alert('Nome é obrigatório.');
    const campo = document.getElementById('diag_nome');
    if (campo) campo.focus();
    return false;
  }
  
  if (!dados.cpf || dados.cpf.length !== 11) {
    alert('CPF é obrigatório e deve ter 11 dígitos.');
    const campo = document.getElementById('diag_cpf');
    if (campo) campo.focus();
    return false;
  }
  
  if (!dados.data_nascimento) {
    alert('Data de nascimento é obrigatória.');
    const campo = document.getElementById('diag_data_nascimento');
    if (campo) campo.focus();
    return false;
  }
  
  return true;
}

// Função para gerar UUID único
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Funções de formatação
function formatarCPF(cpf) {
  if (!cpf) return '';
  cpf = cpf.replace(/\D/g, '');
  cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
  cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
  cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return cpf;
}

function formatarTelefone(telefone) {
  if (!telefone) return '';
  telefone = telefone.replace(/\D/g, '');
  if (telefone.length === 11) {
    telefone = telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (telefone.length === 10) {
    telefone = telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return telefone;
}

// Função para mostrar/ocultar campos do cônjuge
function toggleConjugeFieldsDiagnostico() {
  const estadoCivil = document.getElementById('diag_estado_civil');
  if (!estadoCivil) return;
  
  const showConjuge = estadoCivil.value === 'Casado(a)' || estadoCivil.value === 'União Estável';
  
  const regimeBensGroup = document.getElementById('diag_regime_bens_group');
  const conjugeSection = document.getElementById('diag_conjuge_section');
  const conjugeNomeInput = document.getElementById('diag_conjuge_nome');
  
  if (showConjuge) {
    if (regimeBensGroup) regimeBensGroup.style.display = 'block';
    if (conjugeSection) conjugeSection.style.display = 'block';
    if (conjugeNomeInput) conjugeNomeInput.required = true;
  } else {
    if (regimeBensGroup) regimeBensGroup.style.display = 'none';
    if (conjugeSection) conjugeSection.style.display = 'none';
    if (conjugeNomeInput) conjugeNomeInput.required = false;
    
    // Limpar campos do cônjuge
    const camposConjuge = [
      'diag_conjuge_nome', 'diag_conjuge_cpf', 'diag_conjuge_data_nascimento',
      'diag_conjuge_profissao', 'diag_conjuge_telefone', 'diag_conjuge_email', 'diag_regime_bens'
    ];
    
    camposConjuge.forEach(campoId => {
      const campo = document.getElementById(campoId);
      if (campo) campo.value = '';
    });
  }
}

// Função para calcular total do patrimônio
function calcularPatrimonioTotalDiagnostico() {
  const total = patrimonios.reduce((sum, patrimonio) => {
    return sum + (patrimonio.valor || 0);
  }, 0);
  
  const totalElement = document.getElementById('patrimonio-total-valor');
  if (totalElement) {
    totalElement.textContent = total.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }
}

// Placeholder para funções de renderização (implementar depois se necessário)
function renderPessoasRendaDiagnostico() {
  console.log('Renderizando pessoas com renda:', pessoasRenda);
  // TODO: Implementar renderização das pessoas com renda
}

function renderDependentesDiagnostico() {
  console.log('Renderizando dependentes:', dependentes);
  // TODO: Implementar renderização dos dependentes
}

function renderPatrimoniosDiagnostico() {
  console.log('Renderizando patrimônios:', patrimonios);
  // TODO: Implementar renderização dos patrimônios
}

// Tornar funções globais para serem acessíveis
window.abrirDiagnostico = abrirDiagnostico;
window.fecharDiagnostico = fecharDiagnostico;
window.salvarDiagnostico = salvarDiagnostico;
window.toggleConjugeFieldsDiagnostico = toggleConjugeFieldsDiagnostico;

// ===== FIM DO DIAGNÓSTICO FINANCEIRO INTEGRADO =====

// --- Inicialização --- 
document.addEventListener("DOMContentLoaded", initializeDashboard);
