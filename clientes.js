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

// --- Variáveis de Estado e Informações do Usuário ---
let currentUser = null;
let currentUserId = null;
let currentUserNivel = null;
let currentUserProjeto = null;
let isAdmin = false;
let allUsers = []; // << NOVO: Para armazenar lista de usuários para o select

// --- Funções de Utilidade ---
const sanitizeInput = (str) => {
  if (str === null || str === undefined) return ";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;")
    .replace(/`/g, "&#x60;");
};

// --- Verificação de Acesso e Inicialização ---
async function initializeDashboard() { // << MODIFICADO: Tornou-se async
    currentUser = sessionStorage.getItem("usuario");
    currentUserId = sessionStorage.getItem("user_id");
    currentUserNivel = sessionStorage.getItem("nivel");
    currentUserProjeto = sessionStorage.getItem("projeto");

    isAdmin = currentUserNivel === 'admin';

    if (!currentUser || !currentUserId || !currentUserNivel) {
        alert("Acesso não autorizado. Faça login novamente.");
        window.location.href = "index.html";
        return false;
    }

    // Configura botões de navegação e indicador admin
    if (isAdmin) {
        adminViewIndicator.style.display = "block";
        backBtn.onclick = () => { window.location.href = "admin-dashboard.html"; };
        await loadAllUsers(); // << NOVO: Carrega usuários para o admin
    } else if (currentUserProjeto === 'Planejamento') {
        backBtn.onclick = () => { window.location.href = "planejamento-dashboard.html"; };
    } else {
        alert("Acesso indevido a esta página.");
        window.location.href = "index.html";
        return false;
    }

    logoutBtn.onclick = logout;
    addClientForm.addEventListener("submit", addClient);
    clientsTableBody.addEventListener("click", handleTableClick);

    loadClients();
    return true;
}

// << NOVO: Função para carregar todos os usuários (para o select do admin) >>
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
        // Não crítico para a funcionalidade principal, mas informa o erro
        alert("Erro ao carregar a lista de usuários para atribuição: " + error.message);
        allUsers = []; // Garante que a lista esteja vazia em caso de erro
    }
}

// --- Carregar Clientes (Modificado para Visibilidade) ---
async function loadClients() {
    try {
        clientsTableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
        let query = supabase.from('clientes').select('*');

        // << MODIFICADO: Lógica de filtro para não-admin >>
        if (!isAdmin) {
            // Busca clientes atribuídos ao usuário OU com visibilidade TODOS
            query = query.or(`assigned_to_user_id.eq.${currentUserId},visibility.eq.TODOS`);
        }

        // Ordena por nome para consistência
        const { data: clients, error } = await query.order('nome', { ascending: true });

        if (error) {
            // Verifica erros comuns relacionados às novas colunas
            if (error.code === '42703') { // Coluna não existe
                if (error.message.includes('visibility')) {
                    throw new Error("Erro: A coluna 'visibility' não foi encontrada. Siga as instruções para atualizar a tabela 'clientes'.");
                } else if (error.message.includes('assigned_to_user_id')) {
                    throw new Error("Erro: A coluna 'assigned_to_user_id' não foi encontrada. Siga as instruções para atualizar a tabela 'clientes'.");
                }
            } else if (error.code === '42P01') { // Tabela não existe
                 throw new Error("Erro: A tabela 'clientes' não foi encontrada no banco de dados. Siga as instruções para criá-la.");
            }
            throw error; // Lança outros erros
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

        // << MODIFICADO: Lógica de permissão de edição/exclusão >>
        // Admin pode tudo. Usuário pode se criou OU se visibilidade for TODOS.
        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || client.visibility === 'TODOS';

        // << MODIFICADO: Lógica de exibição de Status/Atribuição >>
        let assignmentHtml = '';
        if (client.visibility === 'TODOS') {
            assignmentHtml = '<span class="status-todos">TODOS</span>';
        } else if (client.assigned_to_user_id) {
            // Tenta encontrar o nome do usuário atribuído (se a lista carregou)
            const assignedUser = allUsers.find(u => u.id === client.assigned_to_user_id);
            assignmentHtml = `<span class="status-individual">${assignedUser ? sanitizeInput(assignedUser.usuario) : 'Atribuído (ID: ...' + client.assigned_to_user_id.slice(-4) + ')'}</span>`;
        } else {
            assignmentHtml = '<span style="color:gray">Não atribuído</span>'; // Caso raro
        }

        // << MODIFICADO: Select de atribuição para Admin >>
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
            <td>
                <input type="text" id="name-${client.id}" value="${sanitizeInput(client.nome)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td>
                <input type="text" id="whatsapp-${client.id}" value="${sanitizeInput(client.whatsapp)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td>
                ${isAdmin ? adminAssignmentSelectHtml : assignmentHtml}
            </td>
            <td>
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
        // << MODIFICADO: Define visibilidade e atribuição padrão >>
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
    const clientId = target.dataset.id;

    if (!clientId) return;

    if (target.classList.contains('save-client-btn')) {
        saveClient(clientId);
    } else if (target.classList.contains('delete-client-btn')) {
        deleteClient(clientId);
    }
}

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

        // << MODIFICADO: Lógica de atualização de visibilidade/atribuição pelo Admin >>
        if (isAdmin && assignmentSelect) {
            const selectedValue = assignmentSelect.value;
            if (selectedValue === 'TODOS') {
                updateData.visibility = 'TODOS';
                updateData.assigned_to_user_id = null; // Remove atribuição específica
            } else if (selectedValue === 'ASSIGNED') {
                // Se selecionou "Atribuir a:", mas não um usuário, não faz nada na atribuição
                // Mantém o assigned_to_user_id atual ou null se não houver
                updateData.visibility = 'ASSIGNED'; 
            } else { // Selecionou um ID de usuário específico
                updateData.visibility = 'ASSIGNED';
                updateData.assigned_to_user_id = selectedValue; // Atribui ao usuário selecionado
            }
        }

        const { error } = await supabase
            .from('clientes')
            .update(updateData)
            .eq('id', clientId);

        if (error) throw error;

        alert("Cliente atualizado com sucesso!");
        // Recarrega a lista para refletir mudanças de atribuição/visibilidade
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

