// clientes.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const historyBackBtn = document.getElementById("history-back-btn"); // Botão Voltar Universal
const logoutBtn = document.getElementById("logout-btn");
const adminViewIndicator = document.getElementById("admin-view-indicator");
const addClientForm = document.getElementById("add-client-form");
const newClientNameInput = document.getElementById("new-client-name");
const newClientWhatsappInput = document.getElementById("new-client-whatsapp");
const newClientProjectSelect = document.getElementById("new-client-project"); // Novo elemento
const clientsTableBody = document.querySelector("#clients-table tbody");
// const backBtn = document.getElementById("back-btn"); // Removido
// const backToAdminBtn = document.getElementById("back-to-admin-btn"); // Removido

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

// --- Verificação de Acesso e Inicialização (CORRIGIDA PARA FILTRO EM VIEW AS USER) ---
async function initializeDashboard() {
    // Verifica o nível REAL do usuário logado
    const loggedInUserId = sessionStorage.getItem("user_id");
    const loggedInUserNivel = sessionStorage.getItem("nivel");
    const loggedInUserProjeto = sessionStorage.getItem("projeto");
    isActuallyAdmin = loggedInUserNivel === 'admin';

    // Verifica se um admin está visualizando o painel de outro usuário
    const viewingUserIdFromSession = sessionStorage.getItem("viewing_user_id");
    const viewingUsernameFromSession = sessionStorage.getItem("viewing_username");

    // Variáveis para determinar o contexto efetivo da página
    let effectiveUserId = loggedInUserId;
    let effectiveNivel = loggedInUserNivel;
    let effectiveProjeto = loggedInUserProjeto;
    let loadAsAdminContext = isActuallyAdmin; // Por padrão, carrega como admin se logado como admin
    let isAdminViewingAsUser = false;

    // Detecta se admin está visualizando como usuário
    if (isActuallyAdmin && viewingUserIdFromSession && viewingUsernameFromSession) {
        console.log("Admin está visualizando como usuário.");
        isAdminViewingAsUser = true;
        loadAsAdminContext = false; // O contexto de carregamento NÃO é de admin
        effectiveUserId = viewingUserIdFromSession; // ID para filtro é o do usuário visualizado
        effectiveNivel = 'usuario'; // Nível para filtro é 'usuario'
        currentUser = viewingUsernameFromSession; // Nome de usuário para exibição (se necessário)

        // Busca o projeto do usuário que está sendo visualizado
        try {
            console.log(`Admin visualizando. Buscando projeto para usuário ID: ${effectiveUserId}`);
            const { data: viewedUserData, error: viewedUserError } = await supabase
                .from('credenciais')
                .select('projeto')
                .eq('id', effectiveUserId)
                .single();
            if (viewedUserError) throw viewedUserError;
            effectiveProjeto = viewedUserData?.projeto;
            console.log(`Projeto do usuário visualizado (${effectiveUserId}): ${effectiveProjeto}`);
        } catch (error) {
            console.error("Erro ao buscar projeto do usuário visualizado para filtro:", error);
            effectiveProjeto = null; // Define como null em caso de erro, filtro tratará isso
            alert("Erro ao carregar informações do usuário visualizado. A lista de clientes pode estar incorreta.");
        }
    } else {
        console.log("Carregando contexto normal (usuário logado ou admin em sua própria visão).");
        // Usuário normal ou Admin acessando sua própria gestão
        if (!loggedInUserId || !loggedInUserNivel) {
            alert("Acesso não autorizado. Faça login novamente.");
            window.location.href = "index.html";
            return; // Interrompe a execução
        }
        // Define o nome do usuário logado para exibição (se necessário)
        currentUser = sessionStorage.getItem("usuario");
    }

    // Atualiza variáveis globais DEPOIS de determinar o contexto efetivo
    isAdmin = loadAsAdminContext; // Define se o CONTEXTO de carregamento é admin
    currentUserId = effectiveUserId; // ID efetivo para filtros e ações
    currentUserNivel = effectiveNivel; // Nível efetivo
    currentUserProjeto = effectiveProjeto; // Projeto efetivo

    console.log(`Contexto final para loadClients: isAdmin=${isAdmin}, currentUserId=${currentUserId}, currentUserProjeto=${currentUserProjeto}`);

    // Configurações da UI baseadas no contexto
    if (isAdmin) {
        // Contexto de Admin: mostra form, carrega usuários para select
        console.log("Configurando UI para contexto Admin.");
        if (adminViewIndicator) adminViewIndicator.style.display = 'block';
        addClientForm.style.display = 'grid';
        const addClientTitle = addClientForm.previousElementSibling;
        if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'block';
        addClientForm.addEventListener("submit", addClient);
        await loadAllUsers(); // Admin precisa da lista para atribuição
    } else {
        // Contexto de Usuário (seja usuário logado ou admin visualizando)
        console.log("Configurando UI para contexto Usuário (ou Admin visualizando).");
        if (adminViewIndicator) adminViewIndicator.style.display = 'none';
        // Esconde form de adicionar cliente
        addClientForm.style.display = 'none';
        const addClientTitle = addClientForm.previousElementSibling;
        if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'none';
        // Precisa da lista de usuários para exibir nomes na coluna Status, mesmo no modo de visualização
        await loadAllUsers();
    }

    // Event listener da tabela (comum a ambos os contextos)
    clientsTableBody.addEventListener("click", handleTableClick);

    // Carrega clientes usando as variáveis de contexto globais atualizadas
    loadClients();
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

// --- Carregar Clientes (Modificado para Visibilidade e Indicador de Formulário) ---
async function loadClients() {
    try {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>'; // Colspan 6 agora
        // Modifica a query para incluir a contagem de formulários associados
        let query = supabase.from('clientes').select('*, formularios_clientes(count)');

        // Lógica de filtro para não-admin
        if (!isAdmin) {
            if (!currentUserProjeto) {
                // Se o usuário não tiver projeto, só pode ver os clientes atribuídos a ele
                console.warn("Usuário sem projeto definido, mostrando apenas clientes atribuídos diretamente.");
                query = query.eq("assigned_to_user_id", currentUserId);
            } else {
                // Busca clientes atribuídos ao usuário OU (com visibilidade TODOS E do mesmo projeto do usuário)
                query = query.or(`assigned_to_user_id.eq.${currentUserId},and(visibility.eq.TODOS,projeto.eq.${currentUserProjeto})`);
            }
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
                 if (error.message.includes('formularios_clientes')) {
                     throw new Error("Erro: A tabela 'formularios_clientes' não foi encontrada ou a relação não está configurada corretamente. Verifique o Supabase.");
                 } else {
                     throw new Error("Erro: A tabela 'clientes' não foi encontrada no banco de dados. Siga as instruções para criá-la.");
                 }
            }
            throw error;
        }

        // Passa os dados com a contagem de formulários para renderização
        renderClients(clients);

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">${error.message}</td></tr>`; // Colspan 6
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
        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || (client.visibility === 'TODOS' && client.projeto === currentUserProjeto); // Ajuste: TODOS só editável se for do mesmo projeto

        // Lógica de exibição de Projeto (com edição para admin)
        let projectHtml = '';
        if (isAdmin) {
            projectHtml = `
                <select id="project-${client.id}">
                    <option value="Argos" ${client.projeto === 'Argos' ? 'selected' : ''}>Argos</option>
                    <option value="Hvc" ${client.projeto === 'Hvc' ? 'selected' : ''}>Hvc</option>
                    <option value="Planejamento" ${client.projeto === 'Planejamento' ? 'selected' : ''}>Planejamento</option>
                </select>
            `;
        } else {
            projectHtml = sanitizeInput(client.projeto) || '<span style="color:gray">N/A</span>';
        }

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

        // Verifica se há formulários associados (a query agora retorna um array com um objeto de contagem)
        const hasForm = client.formularios_clientes && client.formularios_clientes.length > 0 && client.formularios_clientes[0].count > 0;

        tr.innerHTML = `
            <td data-label="Nome">
                <input type="text" id="name-${client.id}" value="${sanitizeInput(client.nome)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td data-label="WhatsApp" class="whatsapp-cell">
                <span class="phone-icon" title="Funcionalidade futura">📞</span>
                <input type="text" id="whatsapp-${client.id}" value="${sanitizeInput(client.whatsapp)}" ${!canEditDelete ? 'disabled' : ''} />
            </td>
            <td data-label="Projeto">
                ${projectHtml} <!-- Coluna do Projeto adicionada -->
            </td>
            <td data-label="Status">
                ${isAdmin ? adminAssignmentSelectHtml : assignmentHtml}
            </td>
            <td data-label="Formulários" style="text-align: center;"> <!-- Centraliza conteúdo -->
                ${hasForm ? '<span title="Formulário existente">📄</span> ' : ''} <!-- Indicador de formulário -->
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
    const projeto = newClientProjectSelect.value; // Pega o valor do projeto

    if (!nome || !whatsapp || !projeto) { // Verifica se o projeto foi selecionado
        alert("Preencha o nome, o WhatsApp e selecione o projeto do cliente.");
        return;
    }

    try {
        // Define visibilidade, atribuição padrão e PROJETO
        const insertData = {
            nome: nome,
            whatsapp: whatsapp,
            projeto: projeto, // Adiciona o projeto selecionado
            criado_por_id: currentUserId,
            visibility: 'ASSIGNED', // Visibilidade padrão é atribuído
            assigned_to_user_id: currentUserId // Atribuído ao criador por padrão
        };

        const { data, error } = await supabase
            .from('clientes')
            .insert(insertData)
            .select();

        if (error) {
             if (error.code === '42703' && error.message.includes('projeto')) {
                 throw new Error("Erro ao adicionar cliente: A coluna 'projeto' não foi encontrada na tabela 'clientes'. Verifique se a coluna foi criada corretamente no Supabase.");
             } else {
                 throw error;
             }
        }

        alert("Cliente adicionado com sucesso!");
        addClientForm.reset();
        newClientProjectSelect.value = ""; // Limpa o select do projeto
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
        const projectSelect = document.getElementById(`project-${clientId}`); // Novo: Select do projeto (só existe para admin)
        const assignmentSelect = document.getElementById(`assignment-${clientId}`); // Select de atribuição (só existe para admin)

        const nome = nomeInput.value.trim();
        const whatsapp = whatsappInput.value.trim();
        
        if (!nome || !whatsapp) {
            alert("Nome e WhatsApp não podem ficar vazios.");
            return;
        }

        const updateData = { nome, whatsapp };

        // Lógica de atualização de PROJETO pelo Admin
        if (isAdmin && projectSelect) {
            updateData.projeto = projectSelect.value; // Salva o projeto selecionado
        }

        // Lógica de atualização de visibilidade/atribuição pelo Admin
        if (isAdmin && assignmentSelect) {
            const selectedValue = assignmentSelect.value;
            if (selectedValue === 'TODOS') {
                updateData.visibility = 'TODOS';
                updateData.assigned_to_user_id = null;
            } else if (selectedValue === 'ASSIGNED') {
                // Se "Atribuir a:" for selecionado, não muda a atribuição atual, apenas garante visibility = ASSIGNED
                // A atribuição real acontece se um usuário específico for selecionado
                updateData.visibility = 'ASSIGNED'; 
            } else {
                // Um usuário específico foi selecionado
                updateData.visibility = 'ASSIGNED';
                updateData.assigned_to_user_id = selectedValue;
            }
        }

        const { error } = await supabase
            .from('clientes')
            .update(updateData)
            .eq('id', clientId);

        if (error) {
             if (error.code === '42703' && error.message.includes('projeto')) {
                 throw new Error("Erro ao salvar cliente: A coluna 'projeto' não foi encontrada na tabela 'clientes'. Verifique se a coluna foi criada corretamente no Supabase.");
             } else {
                 throw error;
             }
        }

        alert("Cliente atualizado com sucesso!");
        loadClients(); // Recarrega para mostrar mudanças

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
