// clientes.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const backBtn = document.getElementById("back-btn");
const backToAdminBtn = document.getElementById("back-to-admin-btn"); // Novo botão
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
    const isAdminViewing = sessionStorage.getItem('is_admin_viewing') === 'true';

    if (isAdminViewing) {
        // Admin está visualizando o dashboard de outro usuário
        currentUser = sessionStorage.getItem("viewing_username");
        currentUserId = sessionStorage.getItem("viewing_user_id");
        currentUserNivel = 'usuario'; // Simula a visão do usuário
        currentUserProjeto = null; // Precisa buscar o projeto do usuário visualizado?
                                  // Por enquanto, vamos assumir que não é necessário para clientes,
                                  // mas pode ser necessário buscar se a lógica depender disso.
        isAdmin = false; // TRATA COMO NÃO ADMIN PARA RENDERIZAÇÃO

        // Configura botão de voltar para o painel admin
        if (backToAdminBtn) {
            backToAdminBtn.style.display = 'block';
            backToAdminBtn.onclick = () => {
                // Limpa flags de visualização antes de voltar
                sessionStorage.removeItem('is_admin_viewing');
                sessionStorage.removeItem('viewing_user_id');
                sessionStorage.removeItem('viewing_username');
                window.location.href = "admin-dashboard.html";
            };
        }
        if (backBtn) backBtn.style.display = 'none'; // Esconde botão de voltar normal
        if (adminViewIndicator) adminViewIndicator.style.display = 'none'; // Esconde indicador

        // Carrega todos os usuários APENAS se o admin REAL estiver logado (para referência futura, se necessário)
        // No entanto, como isAdmin está false para renderização, não será usado na tabela.
        if (sessionStorage.getItem('nivel') === 'admin') {
             await loadAllUsers();
        }

    } else {
        // Usuário normal (Planejamento) ou Admin acessando seu próprio gerenciador
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

        // Configura botão de voltar normal e indicador admin (se aplicável)
        if (backBtn) backBtn.style.display = 'block';
        if (backToAdminBtn) backToAdminBtn.style.display = 'none';

        if (isAdmin) {
            if (adminViewIndicator) adminViewIndicator.style.display = 'block';
            if (backBtn) backBtn.onclick = () => { window.location.href = "admin-dashboard.html"; };
            await loadAllUsers(); // Carrega usuários para o select do admin
        } else if (currentUserProjeto === 'Planejamento') {
            if (adminViewIndicator) adminViewIndicator.style.display = 'none';
            if (backBtn) backBtn.onclick = () => { window.location.href = "planejamento-dashboard.html"; };
        } else {
            alert("Acesso indevido a esta página.");
            window.location.href = "index.html";
            return false;
        }
    }

    // Event listeners comuns
    logoutBtn.onclick = logout;
    addClientForm.addEventListener("submit", addClient);
    clientsTableBody.addEventListener("click", handleTableClick);

    loadClients(); // Carrega clientes com base no contexto (admin vendo user, user normal, admin normal)
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
