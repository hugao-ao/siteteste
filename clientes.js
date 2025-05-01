// clientes.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const backBtn = document.getElementById("back-btn");
const logoutBtn = document.getElementById("logout-btn");
const adminViewIndicator = document.getElementById("admin-view-indicator");
const addClientForm = document.getElementById("add-client-form");
const newClientNameInput = document.getElementById("new-client-name");
const newClientWhatsappInput = document.getElementById("new-client-whatsapp");
const clientsTableBody = document.querySelector("#clients-table tbody");
const backToAdminBtn = document.getElementById("back-to-admin-btn"); // Adiciona referência ao botão de voltar para admin

// --- Variáveis de Estado e Informações do Usuário ---
let currentUser = null;
let currentUserId = null;
let currentUserNivel = null;
let currentUserProjeto = null;
let isAdmin = false; // Flag para saber se o *contexto atual* é de admin
let isActuallyAdmin = false; // Flag para saber se o usuário *logado* é admin
let allUsers = []; // Para armazenar lista de usuários para o select

// --- Funções de Utilidade ---
const sanitizeInput = (str) => {
  // << CORREÇÃO DEFINITIVA APLICADA AQUI >>
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;") // Corrigido para escapar aspas simples corretamente
    .replace(/`/g, "&#x60;");
};

// --- Verificação de Acesso e Inicialização ---
async function initializeDashboard() {
    // Verifica se um admin está visualizando o painel de outro usuário
    const viewingUserIdFromSession = sessionStorage.getItem("viewing_user_id");
    const viewingUsernameFromSession = sessionStorage.getItem("viewing_username");
    const adminViewerUsername = sessionStorage.getItem("admin_viewer_username");

    // Verifica o nível REAL do usuário logado
    const loggedInUserNivel = sessionStorage.getItem("nivel");
    isActuallyAdmin = loggedInUserNivel === 'admin';

    let effectiveUserId = sessionStorage.getItem("user_id");
    let effectiveUsername = sessionStorage.getItem("usuario");
    let effectiveNivel = loggedInUserNivel;
    let effectiveProjeto = sessionStorage.getItem("projeto");

    let isAdminViewingAsUser = false;

    if (isActuallyAdmin && viewingUserIdFromSession && viewingUsernameFromSession) {
        // Admin está visualizando como usuário
        isAdminViewingAsUser = true;
        isAdmin = false; // <<< IMPORTANTE: Define o CONTEXTO como não-admin
        currentUser = viewingUsernameFromSession;
        currentUserId = viewingUserIdFromSession;
        currentUserNivel = 'usuario'; // Simula o nível do usuário visualizado
        // Poderíamos buscar o projeto do usuário visualizado se necessário, mas para clientes não parece ser
        currentUserProjeto = null; 

        // Configura botões para admin visualizando
        if (backToAdminBtn) {
            backToAdminBtn.style.display = 'block';
            backToAdminBtn.onclick = () => {
                sessionStorage.removeItem('viewing_user_id');
                sessionStorage.removeItem('viewing_username');
                sessionStorage.removeItem('admin_viewer_username');
                window.location.href = "admin-dashboard.html";
            };
        }
        if (backBtn) backBtn.style.display = 'none';
        if (adminViewIndicator) adminViewIndicator.style.display = 'none';

        // Carrega todos os usuários (para referência interna, se necessário no futuro)
        await loadAllUsers(); 

    } else {
        // Usuário normal (Planejamento) ou Admin acessando sua própria gestão
        isAdmin = isActuallyAdmin; // Contexto é o mesmo do usuário logado
        currentUser = effectiveUsername;
        currentUserId = effectiveUserId;
        currentUserNivel = effectiveNivel;
        currentUserProjeto = effectiveProjeto;

        if (!currentUser || !currentUserId || !currentUserNivel) {
            alert("Acesso não autorizado. Faça login novamente.");
            window.location.href = "index.html";
            return false;
        }

        // Configura botões normais
        if (backToAdminBtn) backToAdminBtn.style.display = 'none';
        if (backBtn) backBtn.style.display = 'block';

        if (isAdmin) {
            if (adminViewIndicator) adminViewIndicator.style.display = 'block';
            if (backBtn) backBtn.onclick = () => { window.location.href = "admin-dashboard.html"; };
            await loadAllUsers(); // Carrega usuários para o select do admin
        } else if (currentUserProjeto === 'Planejamento') {
            if (adminViewIndicator) adminViewIndicator.style.display = 'none';
            if (backBtn) backBtn.onclick = () => { window.location.href = "planejamento-dashboard.html"; };
        } else {
            // Se não for admin nem Planejamento, não deveria estar aqui
            alert("Acesso indevido a esta página.");
            window.location.href = "index.html"; // Ou user-dashboard.html
            return false;
        }
    }

    // Event listeners comuns
    logoutBtn.onclick = logout;
    // Só permite adicionar cliente se não for admin visualizando como user
    if (!isAdminViewingAsUser) {
        addClientForm.addEventListener("submit", addClient);
    } else {
        // Opcional: Desabilitar ou esconder o formulário de adicionar cliente
        addClientForm.style.display = 'none'; 
        const addClientTitle = addClientForm.previousElementSibling; // Pega o H2
        if (addClientTitle && addClientTitle.tagName === 'H2') {
            addClientTitle.style.display = 'none';
        }
    }
    clientsTableBody.addEventListener("click", handleTableClick);

    // Carrega clientes baseado no contexto (isAdmin e currentUserId corretos)
    loadClients(); 
    return true;
}

// Função para carregar todos os usuários (para o select do admin)
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
        alert("Erro ao carregar a lista de usuários para atribuição: " + error.message);
        allUsers = [];
    }
}

// --- Carregar Clientes (Modificado para Visibilidade) ---
async function loadClients() {
    try {
        clientsTableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
        let query = supabase.from('clientes').select('*');

        // Lógica de filtro para não-admin
        if (!isAdmin) {
            // Busca clientes atribuídos ao usuário OU com visibilidade TODOS
            query = query.or(`assigned_to_user_id.eq.${currentUserId},visibility.eq.TODOS`);
        }

        // Ordena por nome para consistência
        const { data: clients, error } = await query.order('nome', { ascending: true });

        if (error) {
            if (error.code === '42703') {
                if (error.message.includes('visibility')) {
                    throw new Error("Erro: A coluna 'visibility' não foi encontrada. Siga as instruções para atualizar a tabela 'clientes'.");
                } else if (error.message.includes('assigned_to_user_id')) {
                    throw new Error("Erro: A coluna 'assigned_to_user_id' não foi encontrada. Siga as instruções para atualizar a tabela 'clientes'.");
                }
            } else if (error.code === '42P01') {
                 throw new Error("Erro: A tabela 'clientes' não foi encontrada no banco de dados. Siga as instruções para criá-la.");
            }
            throw error;
        }

        renderClients(clients);

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="4" style="color: red;">${error.message}</td></tr>`;
    }
}

// --- Renderizar Tabela de Clientes (Modificado para Visibilidade/Atribuição) ---
function renderClients(clients) {
    clientsTableBody.innerHTML = "";

    if (!clients || clients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente encontrado.</td></tr>';
        return;
    }

    clients.forEach(client => {
        const tr = document.createElement("tr");
        tr.dataset.clientId = client.id;

        // Lógica de permissão de edição/exclusão
        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || client.visibility === 'TODOS';

        // Lógica de exibição de Status/Atribuição
        let assignmentHtml = '';
        if (client.visibility === 'TODOS') {
            assignmentHtml = '<span class="status-todos">TODOS</span>';
        } else if (client.assigned_to_user_id) {
            const assignedUser = allUsers.find(u => u.id === client.assigned_to_user_id);
            assignmentHtml = `<span class="status-individual">${assignedUser ? sanitizeInput(assignedUser.usuario) : 'Atribuído (ID: ...' + client.assigned_to_user_id.slice(-4) + ')'}</span>`;
        } else {
            assignmentHtml = '<span style="color:gray">Não atribuído</span>';
        }

        // Select de atribuição para Admin
        let adminAssignmentSelectHtml = '';
        if (isAdmin) {
            adminAssignmentSelectHtml = `
                <select id="assignment-${client.id}">
                    <option value="TODOS" ${client.visibility === 'TODOS' ? 'selected' : ''}>TODOS</option>
                    <option value="ASSIGNED" ${client.visibility !== 'TODOS' ? 'selected' : ''}>Atribuir a:</option>
                    ${allUsers.map(user => 
                        `<option value="${user.id}" ${client.visibility !== 'TODOS' && client.assigned_to_user_id === user.id ? 'selected' : ''}>
                            &nbsp;&nbsp;${sanitizeInput(user.usuario)}
                        </option>`
                    ).join('')}
                </select>
            `;
        }

        tr.innerHTML = `
            <td data-label="Nome">
                <input type="text" id="name-${client.id}" value="${sanitizeInput(client.nome)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td data-label="WhatsApp" class="whatsapp-cell">
                <span class="phone-icon" title="Funcionalidade futura">📞</span>
                <input type="text" id="whatsapp-${client.id}" value="${sanitizeInput(client.whatsapp)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td data-label="Status">
                ${isAdmin ? adminAssignmentSelectHtml : assignmentHtml}
            </td>
            <td data-label="Formulários">
                <button class="view-details-btn" data-id="${client.id}" data-name="${sanitizeInput(client.nome)}" title="Ver Detalhes">👁️</button>
            </td>
            <td data-label="Ações">
                ${canEditDelete 
                    ? `<button class="save-client-btn" data-id="${client.id}">Salvar</button>
                       <button class="delete-client-btn" data-id="${client.id}">Excluir</button>`
                    : '<span style="color: var(--text-muted); font-size: 0.9rem;">(Apenas leitura)</span>'
                }
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });
}

// --- Adicionar Cliente (Modificado para Status Padrão) ---
async function addClient(event) {
    event.preventDefault();
    const nome = newClientNameInput.value.trim();
    const whatsapp = newClientWhatsappInput.value.trim();

    if (!nome || !whatsapp) {
        alert("Preencha o nome e o WhatsApp do cliente.");
        return;
    }

    try {
        // Define visibilidade e atribuição padrão
        const insertData = {
            nome: nome,
            whatsapp: whatsapp,
            criado_por_id: currentUserId,
            visibility: 'ASSIGNED', // Visibilidade padrão é atribuído
            assigned_to_user_id: currentUserId // Atribuído ao criador por padrão
        };

        const { data, error } = await supabase
            .from('clientes')
            .insert(insertData)
            .select();

        if (error) throw error;

        alert("Cliente adicionado com sucesso!");
        addClientForm.reset();
        loadClients();

    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        alert("Erro ao adicionar cliente: " + error.message);
    }
}
// --- Delegação de Eventos da Tabela ---
function handleTableClick(event) {
    const target = event.target;
    // Usa .closest para pegar o ID do botão ou do ícone dentro do botão
    const saveButton = target.closest('.save-client-btn');
    const deleteButton = target.closest('.delete-client-btn');
    const viewDetailsButton = target.closest('.view-details-btn');

    if (saveButton) {
        const clientId = saveButton.dataset.id;
        if (clientId) saveClient(clientId);
    } else if (deleteButton) {
        const clientId = deleteButton.dataset.id;
        if (clientId) deleteClient(clientId);
    } else if (viewDetailsButton) {
        const clientId = viewDetailsButton.dataset.id;
        const clientName = viewDetailsButton.dataset.name;
        if (clientId && clientName) {
            // Armazena ID e nome para a página de detalhes
            sessionStorage.setItem("viewing_client_id", clientId);
            sessionStorage.setItem("viewing_client_name", clientName);
            // Navega para a página de detalhes
            window.location.href = "cliente-detalhes.html";
        }
    }
} // End of handleTableClick
// --- Salvar Alterações do Cliente (Modificado para Visibilidade/Atribuição) ---
async function saveClient(clientId) {
    try {
        const nomeInput = document.getElementById(`name-${clientId}`);
        const whatsappInput = document.getElementById(`whatsapp-${clientId}`);
        const assignmentSelect = document.getElementById(`assignment-${clientId}`); // Só existe para admin

        const nome = nomeInput.value.trim();
        const whatsapp = whatsappInput.value.trim();
        
        if (!nome || !whatsapp) {
            alert("Nome e WhatsApp não podem ficar vazios.");
            return;
        }

        const updateData = { nome, whatsapp };

        // Lógica de atualização de visibilidade/atribuição pelo Admin
        if (isAdmin && assignmentSelect) {
            const selectedValue = assignmentSelect.value;
            if (selectedValue === 'TODOS') {
                updateData.visibility = 'TODOS';
                updateData.assigned_to_user_id = null;
            } else if (selectedValue === 'ASSIGNED') {
                updateData.visibility = 'ASSIGNED'; 
            } else {
                updateData.visibility = 'ASSIGNED';
                updateData.assigned_to_user_id = selectedValue;
            }
        }

        const { error } = await supabase
            .from('clientes')
            .update(updateData)
            .eq('id', clientId);

        if (error) throw error;

        alert("Cliente atualizado com sucesso!");
        loadClients(); 

    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        alert("Erro ao salvar cliente: " + error.message);
    }
}

// --- Excluir Cliente ---
async function deleteClient(clientId) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', clientId);

        if (error) throw error;

        alert("Cliente excluído com sucesso!");
        const rowToRemove = clientsTableBody.querySelector(`tr[data-client-id="${clientId}"]`);
        if (rowToRemove) {
            rowToRemove.remove();
        }

    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        alert("Erro ao excluir cliente: " + error.message);
    }
}

// --- Logout ---
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// --- Inicialização ---
initializeDashboard();
