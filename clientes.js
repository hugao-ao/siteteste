// clientes.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const adminViewIndicator = document.getElementById("admin-view-indicator");
const addClientForm = document.getElementById("add-client-form");
const newClientNameInput = document.getElementById("new-client-name");
const newClientWhatsappInput = document.getElementById("new-client-whatsapp");
const newClientProjectSelect = document.getElementById("new-client-project");
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
            if (addClientForm) addClientForm.style.display = 'none';
            const addClientTitle = addClientForm?.previousElementSibling;
            if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'none';
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

        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || (client.visibility === 'TODOS' && client.projeto === currentUserProjeto);
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
        } else {
            const visibilityText = client.visibility === 'TODOS' ? '<span class="status-todos">TODOS</span>' : '<span class="status-individual">Individual</span>';
            const assignedUserName = allUsers.find(u => u.id === client.assigned_to_user_id)?.usuario || 'Nenhum';
            assignmentHtml = `${visibilityText} / ${sanitizeInput(assignedUserName)}`;
        }

        const formButtonHtml = `
            <button class="view-forms-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Ver Formulários">
                <i class="fa-solid fa-file-lines"></i> ${formCount}
            </button>
        `;

        const actionsHtml = `
            <button class="view-details-btn" data-client-id="${client.id}" title="Ver Detalhes">
                <i class="fa-solid fa-eye"></i>
            </button>
            ${canEditDelete ? `<button class="delete-btn" data-id="${client.id}" title="Excluir Cliente"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        `;

        tr.innerHTML = `
            <td data-label="Nome">${nomeHtml}</td>
            <td data-label="WhatsApp">${whatsappHtml}</td>
            <td data-label="Projeto">${projectHtml}</td>
            <td data-label="Status/Atribuição">${assignmentHtml}</td>
            <td data-label="Formulários">${formButtonHtml}</td>
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
                visibility: "INDIVIDUAL",
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
        if (!filterProject) newClientProjectSelect.value = "";

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
        // Verificar se há formulários associados
        let count = 0;
        const { data: countData, error: countError } = await supabase
            .from('formularios_clientes')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (countError) {
            console.error("clientes.js: Erro ao contar formulários para exclusão:", countError);
            // Não lança erro aqui, permite excluir cliente mesmo se contagem falhar
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

// --- Lógica do Modal de Formulários (CORRIGIDO) --- 
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
        // <<< CORREÇÃO: Removido 'tipo_formulario' do select >>>
        const { data: forms, error } = await supabase
            .from('formularios_clientes')
            .select('id, created_at') // Seleciona apenas id e created_at
            .eq('cliente_id', clientId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("clientes.js: Erro ao carregar formulários (Supabase):", error);
            // <<< CORREÇÃO: Verifica se o erro é sobre a coluna inexistente >>>
            if (error.code === '42703' && error.message.includes('tipo_formulario')) {
                 throw new Error("Erro DB: A coluna 'tipo_formulario' não existe na tabela 'formularios_clientes'. Remova-a da consulta ou adicione-a no Supabase.");
            }
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
                // <<< CORREÇÃO: Usa texto genérico já que tipo_formulario não existe >>>
                li.innerHTML = `
                    <span class="form-info">Formulário - ${formDate}</span>
                    <div class="form-actions">
                        <button class="delete-form-btn" data-form-id="${form.id}" data-client-id="${clientId}" title="Excluir Formulário"><i class="fa-solid fa-trash-can"></i> Excluir</button>
                    </div>
                `;
                clientFormsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClientForms:", error);
        clientFormsList.innerHTML = `<li>Erro ao carregar formulários: ${error.message}</li>`;
        noFormsMessage.style.display = 'none';
    }
}

async function deleteForm(formId, clientId) {
    console.log(`clientes.js: deleteForm() chamado para Formulário ID: ${formId}, Cliente ID: ${clientId}`);
    if (!confirm("Tem certeza que deseja excluir este formulário permanentemente?")) {
        console.log("clientes.js: Exclusão de formulário cancelada.");
        return;
    }

    try {
        const { error } = await supabase
            .from('formularios_clientes')
            .delete()
            .eq('id', formId);

        if (error) {
            console.error("clientes.js: Erro ao excluir formulário (Supabase):", error);
            throw error;
        }

        alert("Formulário excluído com sucesso!");
        await loadClientForms(clientId); // Recarrega modal
        const urlParams = new URLSearchParams(window.location.search);
        loadClients(urlParams.get('projeto')); // Recarrega tabela principal
        console.log(`clientes.js: Formulário ID ${formId} excluído.`);
    } catch (error) {
        console.error("clientes.js: Erro GERAL em deleteForm:", error);
        alert("Erro ao excluir formulário: " + error.message);
    }
}

// --- Manipuladores de Eventos --- 
function handleTableClick(event) {
    const targetButton = event.target.closest('button');
    if (!targetButton) return;

    const row = targetButton.closest('tr'); // Get the table row
    const clientId = targetButton.dataset.clientId || row?.dataset.clientId;
    const id = targetButton.dataset.id; // Para delete-btn de cliente

    if (targetButton.classList.contains("view-details-btn")) {
        // CORREÇÃO: Redireciona para cliente-detalhes.html com o parâmetro id na URL
        if (clientId) {
            console.log(`clientes.js: Redirecionando para detalhes do cliente ID: ${clientId}`);
            window.location.href = `cliente-detalhes.html?id=${clientId}`;
        } else {
            console.error("clientes.js: Client ID not found for view-details-btn.");
            alert("Erro: ID do cliente não encontrado para ver os detalhes.");
        }
    } else if (targetButton.classList.contains("delete-btn")) {
        if (id) deleteClient(id);
    } else if (targetButton.classList.contains("view-forms-btn")) {
        // <<< CORREÇÃO: Usa nome do dataset do botão, que foi adicionado em renderClients >>>
        const clientNameFromButton = targetButton.dataset.clientName;
        if (clientId && clientNameFromButton) {
            showClientFormsModal(clientId, clientNameFromButton);
        } else {
             console.error(`clientes.js: Client ID (${clientId}) or Name (${clientNameFromButton}) not found for view-forms-btn.`);
             alert("Erro: Não foi possível obter informações do cliente para mostrar formulários.");
        }
    }
}

function handleDeleteFormClick(event) {
    const targetButton = event.target.closest('.delete-form-btn');
    if (targetButton) {
        const formId = targetButton.dataset.formId;
        const clientId = targetButton.dataset.clientId;
        if (formId && clientId) {
            deleteForm(formId, clientId);
        }
    }
}

// --- Inicialização chamada pelo HTML via DOMContentLoaded --- 
console.log("clientes.js: Script carregado.");
document.addEventListener("DOMContentLoaded", initializeDashboard);
