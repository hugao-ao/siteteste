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
    .replace(/\'/g, "&#x27;") // Corrigido para escapar aspas simples corretamente
    .replace(/`/g, "&#x60;");
};

// --- Verificação de Acesso e Inicialização (Exportada) ---
export async function initializeDashboard() {
    console.log("clientes.js: initializeDashboard() INICIADO.");
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
        // console.log(`clientes.js: Renderizando cliente ${index + 1}: ID ${client.id}, Nome: ${client.nome}`); // Log muito verboso, comentado
        const tr = document.createElement("tr");
        tr.dataset.clientId = client.id;
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
                <select class="client-input assignment-visibility" data-field="visibility" id="visibility-${client.id}" data-client-id="${client.id}">
                    <option value="TODOS" ${client.visibility === 'TODOS' ? 'selected' : ''}>TODOS (Projeto)</option>
                    <option value="INDIVIDUAL" ${client.visibility !== 'TODOS' ? 'selected' : ''}>Individual</option>
                </select>
            `;
            const userSelect = `
                <select class="client-input assignment-user" data-field="assigned_to_user_id" id="assignment-${client.id}" ${client.visibility === 'TODOS' ? 'style="display:none;"' : ''}>
                    <option value="">Ninguém</option>
                    ${allUsers.map(user =>
                        `<option value="${user.id}" ${client.assigned_to_user_id === user.id ? 'selected' : ''}>${sanitizeInput(user.usuario)}</option>`
                    ).join('')}
                </select>
            `;
            assignmentHtml = `${visibilitySelect}<br>${userSelect}`;
        } else {
            if (client.visibility === 'TODOS') {
                assignmentHtml = '<span class="status-todos">TODOS</span>';
            } else if (client.assigned_to_user_id) {
                const assignedUser = allUsers.find(u => u.id === client.assigned_to_user_id);
                assignmentHtml = `<span class="status-individual">${assignedUser ? sanitizeInput(assignedUser.usuario) : 'Atribuído'}</span>`;
            } else {
                assignmentHtml = '<span style="color:gray">Não atribuído</span>';
            }
        }

        tr.innerHTML = `
            <td data-label="Nome">${nomeHtml}</td>
            <td data-label="WhatsApp">${whatsappHtml}</td>
            <td data-label="Projeto">${projectHtml}</td>
            <td data-label="Status/Atribuição">${assignmentHtml}</td>
            <td data-label="Formulários" style="text-align: center;">
                ${formCount > 0
                    ? `<button class="view-forms-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}">${formCount} <i class="fa-solid fa-list-check"></i></button>`
                    : '0'
                }
            </td>
            <td data-label="Ações" style="text-align: center;">
                <button class="view-details-btn" data-client-id="${client.id}" title="Ver Detalhes do Cliente"><i class="fa-solid fa-address-card"></i></button>
                ${canEditDelete ? `<button class="delete-btn" data-id="${client.id}" title="Excluir Cliente"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });
    console.log("clientes.js: renderClients() CONCLUÍDO.");
}

// --- Salvar Todas as Alterações de Clientes --- 
async function saveAllClientChanges() {
    console.log("clientes.js: saveAllClientChanges() chamado.");
    if (modifiedClientIds.size === 0) {
        alert("Nenhuma alteração detectada para salvar.");
        return;
    }
    if (!confirm(`Salvar alterações para ${modifiedClientIds.size} cliente(s)?`)) return;

    saveAllClientsBtn.disabled = true;
    saveAllClientsBtn.textContent = 'Salvando...';
    let hasError = false;
    const updates = [];

    for (const id of modifiedClientIds) {
        const row = clientsTableBody.querySelector(`tr[data-client-id="${id}"]`);
        if (!row) {
            console.warn(`clientes.js: Linha não encontrada para cliente modificado ID: ${id}`);
            continue;
        }

        const nomeInput = document.getElementById(`nome-${id}`);
        const whatsappInput = document.getElementById(`whatsapp-${id}`);
        const projectSelect = document.getElementById(`project-${id}`);
        const visibilitySelect = document.getElementById(`visibility-${id}`);
        const assignmentSelect = document.getElementById(`assignment-${id}`);

        const nome = nomeInput ? nomeInput.value.trim() : row.dataset.originalNome;
        const whatsapp = whatsappInput ? whatsappInput.value.trim() : row.dataset.originalWhatsapp;
        const projeto = projectSelect ? projectSelect.value : row.dataset.originalProjeto;
        const visibility = visibilitySelect ? visibilitySelect.value : row.dataset.originalVisibility;
        const assigned_to_user_id = (visibility === 'INDIVIDUAL' && assignmentSelect) ? (assignmentSelect.value || null) : null;

        if (!nome) {
            alert(`Erro: Nome não pode estar vazio (ID: ${id}).`);
            hasError = true; break;
        }
        updates.push({ id, nome, whatsapp, projeto: projeto || null, visibility, assigned_to_user_id });
    }

    if (hasError) {
        saveAllClientsBtn.disabled = false;
        saveAllClientsBtn.textContent = 'Salvar Todas as Alterações';
        return;
    }

    console.log("clientes.js: Enviando atualizações de clientes:", updates);
    try {
        const { error } = await supabase.from('clientes').upsert(updates, { onConflict: 'id' });
        if (error) throw error;
        alert(`Alterações salvas com sucesso para ${updates.length} cliente(s)!`);
        modifiedClientIds.clear();
        updates.forEach(update => {
            const row = clientsTableBody.querySelector(`tr[data-client-id="${update.id}"]`);
            if(row) {
                row.classList.remove('modified');
                row.dataset.originalNome = update.nome;
                row.dataset.originalWhatsapp = update.whatsapp;
                row.dataset.originalProjeto = update.projeto || '';
                row.dataset.originalVisibility = update.visibility;
                row.dataset.originalAssignedTo = update.assigned_to_user_id || '';
            }
        });
    } catch (error) {
        console.error("clientes.js: Erro ao salvar clientes em lote:", error);
        alert("Erro ao salvar alterações: " + error.message);
    } finally {
        saveAllClientsBtn.disabled = true;
        saveAllClientsBtn.textContent = 'Salvar Todas as Alterações';
        console.log("clientes.js: saveAllClientChanges() concluído.");
    }
}

// --- Marcar Linha como Modificada --- 
function markClientAsModified(event) {
    const target = event.target;
    if (!target.matches('.client-input')) return;
    const row = target.closest('tr');
    if (row && row.dataset.clientId) {
        const clientId = row.dataset.clientId;
        if (target.classList.contains('assignment-visibility')) {
            const userSelect = row.querySelector('.assignment-user');
            if (userSelect) userSelect.style.display = target.value === 'TODOS' ? 'none' : 'block';
        }
        modifiedClientIds.add(clientId);
        row.classList.add('modified');
        if (saveAllClientsBtn) saveAllClientsBtn.disabled = false;
        // console.log("Clientes modificados:", modifiedClientIds); // Log muito verboso
    }
}

// --- Operações CRUD (addClient, deleteClient mantidas) ---
async function addClient(event) {
    event.preventDefault();
    console.log("clientes.js: addClient() chamado.");
    try {
        const nome = newClientNameInput.value.trim();
        const whatsapp = newClientWhatsappInput.value.trim();
        const projeto = newClientProjectSelect.value;
        if (!nome || !whatsapp || !projeto) throw new Error("Preencha Nome, WhatsApp e Projeto.");

        const { error } = await supabase
            .from("clientes")
            .insert({ nome, whatsapp, projeto, criado_por_id: currentUserId, visibility: 'INDIVIDUAL', assigned_to_user_id: currentUserId })
            .select();
        if (error) {
             console.error("clientes.js: Erro ao adicionar cliente (Supabase):", error);
             if (error.code === '42703') {
                 if (error.message.includes('projeto')) throw new Error("Erro DB: Coluna 'projeto' não existe.");
                 if (error.message.includes('criado_por_id')) throw new Error("Erro DB: Coluna 'criado_por_id' não existe.");
             }
            throw error;
        }
        alert("Cliente adicionado!");
        addClientForm.reset();
        if (newClientProjectSelect.disabled) newClientProjectSelect.value = currentUserProjeto;
        const urlParams = new URLSearchParams(window.location.search);
        loadClients(urlParams.get('projeto')); // Recarrega a lista
    } catch (error) {
        console.error("clientes.js: Erro GERAL em addClient:", error);
        alert("Erro ao adicionar cliente: " + error.message);
    }
}

async function deleteClient(id) {
    console.log(`clientes.js: deleteClient() chamado para ID: ${id}`);
    try {
        const { count, error: countError } = await supabase
            .from('formularios_clientes')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (countError) {
            console.error("clientes.js: Erro ao contar formulários para exclusão:", countError);
            throw countError;
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
            .select('id, created_at, tipo_formulario')
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
                    <span class="form-info">${sanitizeInput(form.tipo_formulario) || 'Formulário'} - ${formDate}</span>
                    <div class="form-actions">
                        <button class="delete-form-btn" data-form-id="${form.id}" data-client-id="${clientId}" title="Excluir Formulário"><i class="fa-solid fa-trash-can"></i> Excluir</button>
                    </div>
                `;
                clientFormsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClientForms:", error);
        clientFormsList.innerHTML = '<li>Erro ao carregar formulários. Verifique o console.</li>';
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

    const clientId = targetButton.dataset.clientId || targetButton.closest('tr')?.dataset.clientId;
    const id = targetButton.dataset.id; // Para delete-btn de cliente

    if (targetButton.classList.contains("view-details-btn")) {
        if (clientId) window.location.href = `cliente-detalhes.html?id=${clientId}`;
    } else if (targetButton.classList.contains("delete-btn")) {
        if (id) deleteClient(id);
    } else if (targetButton.classList.contains("view-forms-btn")) {
        const clientName = targetButton.dataset.clientName;
        if (clientId && clientName) {
            showClientFormsModal(clientId, clientName);
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

// --- Inicialização chamada pelo HTML --- 
console.log("clientes.js: Script carregado.");

