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
    .replace(/\'/g, "&#x27;")
    .replace(/`/g, "&#x60;");
};

// --- Verificação de Acesso e Inicialização ---
async function initializeDashboard() {
    const loggedInUserId = sessionStorage.getItem("user_id");
    const loggedInUserNivel = sessionStorage.getItem("nivel");
    const loggedInUserProjeto = sessionStorage.getItem("projeto");
    isActuallyAdmin = loggedInUserNivel === 'admin';

    const urlParams = new URLSearchParams(window.location.search);
    const filterProjectFromUrl = urlParams.get('projeto');

    const viewingUserIdFromSession = sessionStorage.getItem("viewing_user_id");
    const viewingUsernameFromSession = sessionStorage.getItem("viewing_username");

    let effectiveUserId = loggedInUserId;
    let effectiveNivel = loggedInUserNivel;
    let effectiveProjeto = loggedInUserProjeto;
    let isAdminViewingAsUser = false;

    // *** Lógica de Contexto (mantida) ***
    if (isActuallyAdmin && filterProjectFromUrl) {
        console.log(`Admin acessando contexto do projeto: ${filterProjectFromUrl}`);
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
        console.log("Admin está visualizando como usuário.");
        isAdminViewingAsUser = true;
        isAdmin = false;
        effectiveUserId = viewingUserIdFromSession;
        effectiveNivel = 'usuario';
        currentUser = viewingUsernameFromSession;
        try {
            const { data: viewedUserData, error: viewedUserError } = await supabase
                .from('credenciais')
                .select('projeto')
                .eq('id', effectiveUserId)
                .single();
            if (viewedUserError) throw viewedUserError;
            effectiveProjeto = viewedUserData?.projeto;
        } catch (error) {
            console.error("Erro ao buscar projeto do usuário visualizado:", error);
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
        console.log("Carregando contexto normal.");
        if (!loggedInUserId || !loggedInUserNivel) {
            alert("Acesso não autorizado.");
            window.location.href = "index.html";
            return;
        }
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

    await loadAllUsers();

    // --- Listeners --- 
    if (clientsTableBody) {
        clientsTableBody.addEventListener("click", handleTableClick);
        clientsTableBody.addEventListener("input", markClientAsModified);
        clientsTableBody.addEventListener("change", markClientAsModified);
    }
    if (addClientForm) {
        addClientForm.addEventListener("submit", addClient);
    }
    if (saveAllClientsBtn) {
        saveAllClientsBtn.addEventListener('click', saveAllClientChanges);
        saveAllClientsBtn.disabled = true;
    }
    // Modal Listeners
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => formsModal.style.display = "none");
    }
    // Close modal if clicked outside content
    window.addEventListener('click', (event) => {
        if (event.target == formsModal) {
            formsModal.style.display = "none";
        }
    });
    // Listener para botões de exclusão dentro do modal (delegação)
    if (clientFormsList) {
        clientFormsList.addEventListener('click', handleDeleteFormClick);
    }

    loadClients(filterProjectFromUrl);
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
        console.error("Erro ao carregar lista de usuários:", error);
        allUsers = [];
    }
}

// --- Carregar Clientes --- 
async function loadClients(filterProject = null) {
    modifiedClientIds.clear();
    if (saveAllClientsBtn) saveAllClientsBtn.disabled = true;

    try {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
        let query = supabase.from('clientes').select('*, formularios_clientes(count)');

        // Lógica de filtro (mantida)
        if (filterProject && isAdmin) {
            query = query.eq('projeto', filterProject);
        } else if (!isAdmin) {
            if (!currentUserProjeto) {
                query = query.eq("assigned_to_user_id", currentUserId);
            } else {
                query = query.or(`assigned_to_user_id.eq.${currentUserId},and(visibility.eq.TODOS,projeto.eq.${currentUserProjeto})`);
            }
        } // else: Admin geral carrega todos

        const { data: clients, error } = await query.order('nome', { ascending: true });

        if (error) {
            // Tratamento de erro mantido
            console.error("Erro Supabase:", error);
            if (error.code === '42703') {
                if (error.message.includes('visibility')) throw new Error("Erro DB: Coluna 'visibility' não encontrada.");
                if (error.message.includes('assigned_to_user_id')) throw new Error("Erro DB: Coluna 'assigned_to_user_id' não encontrada.");
                if (error.message.includes('projeto')) throw new Error("Erro DB: Coluna 'projeto' não encontrada.");
            } else if (error.code === '42P01') {
                 if (error.message.includes('formularios_clientes')) throw new Error("Erro DB: Relação 'formularios_clientes' não encontrada/configurada.");
                 if (error.message.includes('clientes')) throw new Error("Erro DB: Tabela 'clientes' não encontrada.");
            }
            throw error;
        }
        
        if (clients.length === 0 && filterProject && isAdmin) {
             clientsTableBody.innerHTML = `<tr><td colspan="6">Nenhum cliente encontrado para o projeto ${sanitizeInput(filterProject)}.</td></tr>`;
             return;
        }

        renderClients(clients);

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Erro ao carregar: ${error.message}</td></tr>`;
    }
}

// --- Renderizar Tabela de Clientes --- 
function renderClients(clients) {
    clientsTableBody.innerHTML = "";

    if (!clients || clients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Nenhum cliente encontrado para este contexto.</td></tr>';
        return;
    }

    clients.forEach(client => {
        const tr = document.createElement("tr");
        tr.dataset.clientId = client.id;
        tr.dataset.originalNome = client.nome || '';
        tr.dataset.originalWhatsapp = client.whatsapp || '';
        tr.dataset.originalProjeto = client.projeto || '';
        tr.dataset.originalVisibility = client.visibility || 'INDIVIDUAL';
        tr.dataset.originalAssignedTo = client.assigned_to_user_id || '';

        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || (client.visibility === 'TODOS' && client.projeto === currentUserProjeto);
        const formCount = client.formularios_clientes[0]?.count || 0;

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
                    ? `<button class="view-forms-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}">${formCount} <i class="fa-solid fa-list-check"></i></button>` // Icone diferente
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
}

// --- Salvar Todas as Alterações de Clientes --- 
async function saveAllClientChanges() {
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
        if (!row) continue;

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

    console.log("Enviando atualizações de clientes:", updates);
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
        console.error("Erro ao salvar clientes em lote:", error);
        alert("Erro ao salvar alterações: " + error.message);
    } finally {
        saveAllClientsBtn.disabled = true;
        saveAllClientsBtn.textContent = 'Salvar Todas as Alterações';
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
        console.log("Clientes modificados:", modifiedClientIds);
    }
}

// --- Operações CRUD (addClient, deleteClient mantidas) ---
async function addClient(event) {
    event.preventDefault();
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
        loadClients(urlParams.get('projeto'));
    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        alert("Erro: " + error.message);
    }
}

async function deleteClient(id) {
    try {
        const { count, error: countError } = await supabase
            .from('formularios_clientes')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (countError) throw countError;

        let confirmMessage = "Excluir este cliente?";
        if (count > 0) confirmMessage += `\n\nATENÇÃO: ${count} formulário(s) associado(s) também serão excluídos!`;
        if (!confirm(confirmMessage)) return;

        const { error: deleteError } = await supabase.from("clientes").delete().eq("id", id);
        if (deleteError) throw deleteError;

        alert("Cliente e formulários associados excluídos!");
        const rowToRemove = clientsTableBody.querySelector(`tr[data-client-id="${id}"]`);
        if (rowToRemove) rowToRemove.remove();
        modifiedClientIds.delete(id);
        if (modifiedClientIds.size === 0 && saveAllClientsBtn) saveAllClientsBtn.disabled = true;
    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        alert("Erro: " + error.message);
    }
}

// --- Lógica do Modal de Formulários --- 
async function showClientFormsModal(clientId, clientName) {
    if (!formsModal || !modalTitle || !clientFormsList || !noFormsMessage) return;

    modalTitle.textContent = `Formulários de: ${clientName}`;
    clientFormsList.innerHTML = '<li>Carregando formulários...</li>'; // Limpa e mostra carregando
    noFormsMessage.style.display = 'none';
    formsModal.style.display = "block";

    await loadClientForms(clientId);
}

async function loadClientForms(clientId) {
    try {
        const { data: forms, error } = await supabase
            .from('formularios_clientes')
            .select('id, created_at, tipo_formulario') // Seleciona campos relevantes
            .eq('cliente_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        clientFormsList.innerHTML = ''; // Limpa a lista

        if (forms.length === 0) {
            noFormsMessage.style.display = 'block';
        } else {
            noFormsMessage.style.display = 'none';
            forms.forEach(form => {
                const li = document.createElement('li');
                const formDate = new Date(form.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                li.innerHTML = `
                    <span class="form-info">${sanitizeInput(form.tipo_formulario) || 'Formulário'} - ${formDate}</span>
                    <div class="form-actions">
                        <!-- <button class="view-form-btn" data-form-id="${form.id}"><i class="fa-solid fa-eye"></i> Ver</button> -->
                        <button class="delete-form-btn" data-form-id="${form.id}" data-client-id="${clientId}" title="Excluir Formulário"><i class="fa-solid fa-trash-can"></i> Excluir</button>
                    </div>
                `;
                clientFormsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Erro ao carregar formulários do cliente:", error);
        clientFormsList.innerHTML = '<li>Erro ao carregar formulários.</li>';
        noFormsMessage.style.display = 'none';
    }
}

async function deleteForm(formId, clientId) {
    if (!confirm("Tem certeza que deseja excluir este formulário permanentemente?")) return;

    try {
        const { error } = await supabase
            .from('formularios_clientes')
            .delete()
            .eq('id', formId);

        if (error) throw error;

        alert("Formulário excluído com sucesso!");
        // Recarrega a lista no modal
        await loadClientForms(clientId);
        // Atualiza a contagem na tabela principal (opcional, mas bom)
        const urlParams = new URLSearchParams(window.location.search);
        loadClients(urlParams.get('projeto')); // Recarrega a tabela de clientes

    } catch (error) {
        console.error("Erro ao excluir formulário:", error);
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

// --- Inicialização --- 
const loggedInUserNivelCheck = sessionStorage.getItem("nivel");
if (!loggedInUserNivelCheck) {
    alert("Acesso não autorizado.");
    window.location.href = "index.html";
} else {
    document.addEventListener('sidebarReady', initializeDashboard, { once: true });
}

