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

// --- Funções de Utilidade ---
const sanitizeInput = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;")
    .replace(/`/g, "&#x60;");
};

// --- Verificação de Acesso e Inicialização ---
function initializeDashboard() {
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
        backBtn.onclick = () => { window.location.href = "admin-dashboard.html"; }; // Admin volta para admin-dashboard
    } else if (currentUserProjeto === 'Planejamento') {
        backBtn.onclick = () => { window.location.href = "planejamento-dashboard.html"; }; // Planejamento volta para planejamento-dashboard
    } else {
        // Se não for admin nem do Planejamento, não deveria estar aqui
        alert("Acesso indevido a esta página.");
        window.location.href = "index.html";
        return false;
    }

    logoutBtn.onclick = logout;
    addClientForm.addEventListener("submit", addClient);
    clientsTableBody.addEventListener("click", handleTableClick); // Delegação de eventos para editar/excluir/status

    loadClients(); // Carrega os clientes ao inicializar
    return true;
}

// --- Carregar Clientes ---
async function loadClients() {
    try {
        clientsTableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
        let query = supabase.from('clientes').select('*');

        // Filtra por usuário se não for admin
        if (!isAdmin) {
            query = query.eq('criado_por_id', currentUserId);
        }

        const { data: clients, error } = await query.order('created_at', { ascending: false });

        if (error) {
            // Verifica erro específico de tabela inexistente
            if (error.code === '42P01') { 
                 throw new Error("Erro: A tabela 'clientes' não foi encontrada no banco de dados. Siga as instruções para criá-la.");
            } else {
                throw error;
            }
        }

        renderClients(clients);

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="4" style="color: red;">${error.message}</td></tr>`;
    }
}

// --- Renderizar Tabela de Clientes ---
function renderClients(clients) {
    clientsTableBody.innerHTML = ""; // Limpa a tabela

    if (!clients || clients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente encontrado.</td></tr>';
        return;
    }

    clients.forEach(client => {
        const tr = document.createElement("tr");
        tr.dataset.clientId = client.id;

        // Define se o usuário atual pode editar/excluir este cliente
        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || client.status === 'TODOS';

        // Formata o status
        let statusHtml = '';
        if (client.status === 'TODOS') {
            statusHtml = '<span class="status-todos">TODOS</span>';
        } else {
            statusHtml = '<span class="status-individual">Individual</span>';
        }

        tr.innerHTML = `
            <td>
                <input type="text" id="name-${client.id}" value="${sanitizeInput(client.nome)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td>
                <input type="text" id="whatsapp-${client.id}" value="${sanitizeInput(client.whatsapp)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td>
                ${isAdmin 
                    ? `<select id="status-${client.id}">
                         <option value="INDIVIDUAL" ${client.status !== 'TODOS' ? 'selected' : ''}>Individual</option>
                         <option value="TODOS" ${client.status === 'TODOS' ? 'selected' : ''}>TODOS</option>
                       </select>` 
                    : statusHtml
                }
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

// --- Adicionar Cliente ---
async function addClient(event) {
    event.preventDefault();
    const nome = newClientNameInput.value.trim();
    const whatsapp = newClientWhatsappInput.value.trim();

    if (!nome || !whatsapp) {
        alert("Preencha o nome e o WhatsApp do cliente.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('clientes')
            .insert({ 
                nome: nome, 
                whatsapp: whatsapp, 
                criado_por_id: currentUserId, // Associa ao usuário logado
                status: 'INDIVIDUAL' // Status padrão
            })
            .select();

        if (error) throw error;

        alert("Cliente adicionado com sucesso!");
        addClientForm.reset(); // Limpa o formulário
        loadClients(); // Recarrega a lista

    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        alert("Erro ao adicionar cliente: " + error.message);
    }
}

// --- Delegação de Eventos da Tabela ---
function handleTableClick(event) {
    const target = event.target;
    const clientId = target.dataset.id;

    if (!clientId) return; // Sai se não clicou em um botão com data-id

    if (target.classList.contains('save-client-btn')) {
        saveClient(clientId);
    } else if (target.classList.contains('delete-client-btn')) {
        deleteClient(clientId);
    }
}

// --- Salvar Alterações do Cliente ---
async function saveClient(clientId) {
    try {
        const nomeInput = document.getElementById(`name-${clientId}`);
        const whatsappInput = document.getElementById(`whatsapp-${clientId}`);
        const statusSelect = document.getElementById(`status-${clientId}`); // Só existe para admin

        const nome = nomeInput.value.trim();
        const whatsapp = whatsappInput.value.trim();
        
        if (!nome || !whatsapp) {
            alert("Nome e WhatsApp não podem ficar vazios.");
            return;
        }

        const updateData = { nome, whatsapp };

        // Apenas admin pode mudar o status
        if (isAdmin && statusSelect) {
            updateData.status = statusSelect.value;
        }

        const { error } = await supabase
            .from('clientes')
            .update(updateData)
            .eq('id', clientId);

        if (error) throw error;

        alert("Cliente atualizado com sucesso!");
        // Opcional: Mudar visualmente o status na linha se admin alterou
        if (isAdmin && statusSelect) {
            const statusCell = statusSelect.closest('td');
            if (updateData.status === 'TODOS') {
                statusCell.innerHTML = '<span class="status-todos">TODOS</span>';
            } else {
                 statusCell.innerHTML = '<span class="status-individual">Individual</span>';
            }
            // Recarregar pode ser necessário se a permissão de edição mudou para outros usuários
            // loadClients(); 
        }

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
        // Remove a linha da tabela
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

