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
let currentUser = null; // Nome do usuário no contexto atual (pode ser o visualizado)
let currentUserId = null; // ID do usuário no contexto atual (pode ser o visualizado)
let currentUserNivel = null; // Nível no contexto atual (pode ser 'usuario' se admin visualizando)
let currentUserProjeto = null; // Projeto no contexto atual (pode ser do usuário visualizado)
let isAdmin = false; // Flag para saber se o *contexto atual de carregamento* é de admin
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

// --- Verificação de Acesso e Inicialização (CORRIGIDA PARA FILTRO EM VIEW AS USER E FILTRO DE PROJETO ADMIN) ---
async function initializeDashboard() {
    // Verifica o nível REAL do usuário logado
    const loggedInUserId = sessionStorage.getItem("user_id");
    const loggedInUserNivel = sessionStorage.getItem("nivel");
    const loggedInUserProjeto = sessionStorage.getItem("projeto");
    isActuallyAdmin = loggedInUserNivel === 'admin';

    // *** NOVO: Verifica se a página foi carregada com filtro de projeto pela URL ***
    const urlParams = new URLSearchParams(window.location.search);
    const filterProjectFromUrl = urlParams.get('projeto');

    // Verifica se um admin está visualizando o painel de outro usuário
    const viewingUserIdFromSession = sessionStorage.getItem("viewing_user_id");
    const viewingUsernameFromSession = sessionStorage.getItem("viewing_username");

    // Variáveis para determinar o contexto efetivo da página
    let effectiveUserId = loggedInUserId;
    let effectiveNivel = loggedInUserNivel;
    let effectiveProjeto = loggedInUserProjeto;
    let loadAsAdminContext = isActuallyAdmin; // Por padrão, carrega como admin se logado como admin
    let isAdminViewingAsUser = false;

    // *** Lógica de Contexto ***
    if (isActuallyAdmin && filterProjectFromUrl) {
        // CASO 1: Admin acessando via dashboard de projeto específico
        console.log(`Admin acessando contexto do projeto: ${filterProjectFromUrl}`);
        isAdmin = true; // O contexto é de admin
        currentUserId = loggedInUserId; // ID é o do admin logado
        currentUserNivel = 'admin';
        currentUserProjeto = filterProjectFromUrl; // O PROJETO relevante é o da URL
        // Não estamos visualizando como outro usuário neste caso
        if (adminViewIndicator) adminViewIndicator.style.display = 'block'; // Mostra indicador admin
        addClientForm.style.display = 'grid'; // Mostra form de adicionar
        const addClientTitle = addClientForm.previousElementSibling;
        if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'block';
        // Ajusta o form para o projeto específico
        if (newClientProjectSelect) {
            newClientProjectSelect.value = filterProjectFromUrl;
            newClientProjectSelect.disabled = true; // Desabilita a seleção, já está definido
        }
        // Atualiza título da página
        document.title = `Gerenciar Clientes - ${filterProjectFromUrl}`;
        const pageTitleElement = document.querySelector('h1'); // Assume que o H1 principal é o título
        if(pageTitleElement) pageTitleElement.textContent = `Gerenciamento de Clientes (${filterProjectFromUrl})`;

    } else if (isActuallyAdmin && viewingUserIdFromSession && viewingUsernameFromSession) {
        // CASO 2: Admin visualizando como usuário (lógica anterior mantida e refinada)
        console.log("Admin está visualizando como usuário.");
        isAdminViewingAsUser = true;
        isAdmin = false; // O contexto de carregamento NÃO é de admin para filtros
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
        // Atualiza variáveis globais para o contexto de visualização
        currentUserId = effectiveUserId;
        currentUserNivel = effectiveNivel;
        currentUserProjeto = effectiveProjeto;
        // Configura UI para visualização
        if (adminViewIndicator) adminViewIndicator.style.display = 'none';
        addClientForm.style.display = 'none';
        const addClientTitle = addClientForm.previousElementSibling;
        if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'none';

    } else {
        // CASO 3: Usuário normal ou Admin acessando sua própria gestão geral (sem filtro de projeto URL)
        console.log("Carregando contexto normal (usuário logado ou admin em sua própria visão geral).");
        if (!loggedInUserId || !loggedInUserNivel) {
            alert("Acesso não autorizado. Faça login novamente.");
            window.location.href = "index.html";
            return; // Interrompe a execução
        }
        // Define o nome do usuário logado para exibição (se necessário)
        currentUser = sessionStorage.getItem("usuario");
        // Atualiza variáveis globais para o contexto normal
        isAdmin = isActuallyAdmin; // Contexto é admin se logado como admin
        currentUserId = loggedInUserId;
        currentUserNivel = loggedInUserNivel;
        currentUserProjeto = loggedInUserProjeto;
        // Configura UI
        if (isAdmin) {
            if (adminViewIndicator) adminViewIndicator.style.display = 'block';
            addClientForm.style.display = 'grid';
            const addClientTitle = addClientForm.previousElementSibling;
            if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'block';
            if (newClientProjectSelect) newClientProjectSelect.disabled = false; // Garante que está habilitado
        } else {
            if (adminViewIndicator) adminViewIndicator.style.display = 'none';
            addClientForm.style.display = 'none';
            const addClientTitle = addClientForm.previousElementSibling;
            if (addClientTitle && addClientTitle.tagName === 'H2') addClientTitle.style.display = 'none';
        }
    }

    // Carrega todos os usuários (necessário para selects de atribuição e nomes)
    await loadAllUsers();

    // Event listener da tabela (comum a todos os contextos)
    clientsTableBody.addEventListener("click", handleTableClick);
    // Event listener do form (só será acionado se o form estiver visível)
    addClientForm.addEventListener("submit", addClient);

    // Carrega clientes usando as variáveis de contexto globais atualizadas
    // Passa o filtro de projeto da URL explicitamente para loadClients, se existir
    console.log(`Chamando loadClients com filtro: ${filterProjectFromUrl || 'Nenhum'}`);
    loadClients(filterProjectFromUrl);
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

// --- Carregar Clientes (MODIFICADO para aceitar filtro de projeto admin) ---
async function loadClients(filterProject = null) { // Adiciona parâmetro opcional
    try {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>'; // Colspan 6 agora
        // Modifica a query para incluir a contagem de formulários associados
        let query = supabase.from('clientes').select('*, formularios_clientes(count)');

        // Lógica de filtro
        if (filterProject && isAdmin) {
            // CASO 1: Admin acessando via dashboard de projeto específico
            console.log(`Admin filtrando clientes pelo projeto: ${filterProject}`);
            query = query.eq('projeto', filterProject);
        } else if (!isAdmin) {
            // CASO 2: Usuário normal ou Admin visualizando como usuário
            if (!currentUserProjeto) {
                // Se o usuário (ou usuário visualizado) não tiver projeto, só pode ver os clientes atribuídos a ele
                console.warn("Usuário (ou visualizado) sem projeto definido, mostrando apenas clientes atribuídos diretamente.");
                query = query.eq("assigned_to_user_id", currentUserId);
            } else {
                // Busca clientes atribuídos ao usuário OU (com visibilidade TODOS E do mesmo projeto do usuário)
                console.log(`Filtrando clientes para usuário ${currentUserId} no projeto ${currentUserProjeto}`);
                query = query.or(`assigned_to_user_id.eq.${currentUserId},and(visibility.eq.TODOS,projeto.eq.${currentUserProjeto})`);
            }
        } else {
            // CASO 3: Admin acessando visão geral (sem filtro de projeto URL)
             console.log("Carregando todos os clientes (contexto Admin geral).");
             // Nenhuma filtragem adicional necessária aqui, busca todos
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
        
        // Mensagem se nenhum cliente for encontrado no filtro de projeto
        if (clients.length === 0 && filterProject && isAdmin) {
             clientsTableBody.innerHTML = `<tr><td colspan="6">Nenhum cliente encontrado para o projeto ${sanitizeInput(filterProject)}.</td></tr>`;
             return;
        }

        // Passa os dados com a contagem de formulários para renderização
        renderClients(clients);

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="6" style="color: red;">${error.message}</td></tr>`; // Colspan 6
    }
}

// --- Renderizar Tabela de Clientes (Modificado para Visibilidade/Atribuição e Indicador) ---
function renderClients(clients) {
    clientsTableBody.innerHTML = "";

    if (!clients || clients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Nenhum cliente encontrado para este contexto.</td></tr>'; // Colspan 6
        return;
    }

    clients.forEach(client => {
        const tr = document.createElement("tr");
        tr.dataset.clientId = client.id;

        // Lógica de permissão de edição/exclusão (Admin sempre pode, usuário só os seus ou TODOS do seu projeto)
        const canEditDelete = isAdmin || client.criado_por_id === currentUserId || (client.visibility === 'TODOS' && client.projeto === currentUserProjeto);

        // Lógica de exibição de Projeto (com edição para admin no contexto admin)
        let projectHtml = '';
        if (isAdmin) { // Só mostra select se o CONTEXTO for admin
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

        // Select de atribuição para Admin (só no contexto admin)
        let adminAssignmentSelectHtml = '';
        if (isAdmin) { // Só mostra select se o CONTEXTO for admin
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
                ${projectHtml} <!-- Coluna do Projeto -->
            </td>
            <td data-label="Status">
                ${isAdmin ? adminAssignmentSelectHtml : assignmentHtml} <!-- Mostra select ou texto -->
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

// --- Adicionar Cliente (Só é chamado se o form estiver visível - contexto admin) ---
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
            criado_por_id: currentUserId, // ID do admin que está criando
            visibility: 'ASSIGNED', // Visibilidade padrão é atribuído
            assigned_to_user_id: currentUserId // Atribuído ao criador (admin) por padrão
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
            // Mantém o viewing_user_id se admin estiver visualizando
            // Não precisa limpar aqui, a página de detalhes fará sua própria verificação
            window.location.href = "cliente-detalhes.html";
        }
    }
} // End of handleTableClick

// --- Salvar Alterações do Cliente (Só é chamado se botões estiverem visíveis) ---
async function saveClient(clientId) {
    // A lógica de permissão (canEditDelete) já preveniu que este botão aparecesse se não deveria
    try {
        const nomeInput = document.getElementById(`name-${clientId}`);
        const whatsappInput = document.getElementById(`whatsapp-${clientId}`);
        const projectSelect = document.getElementById(`project-${clientId}`); // Select do projeto (só existe no contexto admin)
        const assignmentSelect = document.getElementById(`assignment-${clientId}`); // Select de atribuição (só existe no contexto admin)

        const nome = nomeInput.value.trim();
        const whatsapp = whatsappInput.value.trim();

        if (!nome || !whatsapp) {
            alert("Nome e WhatsApp não podem ficar vazios.");
            return;
        }

        const updateData = { nome, whatsapp };

        // Lógica de atualização de PROJETO (só se select existir - contexto admin)
        if (isAdmin && projectSelect) {
            updateData.projeto = projectSelect.value; // Salva o projeto selecionado
        }

        // Lógica de atualização de visibilidade/atribuição (só se select existir - contexto admin)
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

// --- Excluir Cliente (Só é chamado se botões estiverem visíveis) ---
async function deleteClient(clientId) {
    // A lógica de permissão (canEditDelete) já preveniu que este botão aparecesse se não deveria
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
        // Não precisa recarregar a lista inteira, apenas remove a linha

    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        alert("Erro ao excluir cliente: " + error.message);
    }
}

// --- Logout (Removido daqui, pois está na sidebar) ---
// function logout() {
//   sessionStorage.clear();
//   window.location.href = "index.html";
// }

// --- Inicialização ---
initializeDashboard();

