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
        clientsTableBody.innerHTML = '<tr><td colspan="7">Carregando clientes...</td></tr>';
        console.log("clientes.js: Construindo query Supabase...");
        let query = supabase.from('clientes').select('*, formularios_clientes(count)');

        // Lógica de filtro
        if (filterProject && isAdmin) {
            console.log(`clientes.js: Aplicando filtro de projeto (Admin): ${filterProject}`);
            query = query.eq('projeto', filterProject);
        } else if (!isAdmin) {
            if (!currentUserProjeto) {
                console.warn(`clientes.js: Usuário ${currentUserId} sem projeto, filtrando por assigned_to_user_id.`);
                query = query.eq('assigned_to_user_id', currentUserId);
            } else {
                console.log(`clientes.js: Aplicando filtro de projeto (Usuário): ${currentUserProjeto}`);
                query = query.eq('projeto', currentUserProjeto);
            }
        }

        query = query.order('created_at', { ascending: false });

        const { data: clients, error } = await query;

        if (error) {
            console.error("clientes.js: Erro ao buscar clientes (Supabase):", error);
            throw error;
        }

        console.log(`clientes.js: ${clients ? clients.length : 0} clientes encontrados.`);
        clientsTableBody.innerHTML = "";

        if (!clients || clients.length === 0) {
            clientsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        // Filtragem adicional no cliente para visibilidade
        const filteredClients = clients.filter(client => {
            if (isAdmin) return true; // Admin vê tudo do projeto filtrado
            
            // Usuário vê:
            // 1. Clientes atribuídos a ele
            // 2. Clientes com visibilidade 'TODOS' do mesmo projeto
            // 3. Clientes que ele mesmo criou (opcional, mas boa prática)
            
            const isAssigned = client.assigned_to_user_id === currentUserId;
            const isPublic = client.visibility === 'TODOS' && client.projeto === currentUserProjeto;
            const isCreator = client.criado_por_id === currentUserId;
            
            return isAssigned || isPublic || isCreator;
        });

        if (filteredClients.length === 0) {
             clientsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum cliente visível para você.</td></tr>';
             return;
        }

        // Renderizar Tabela
        for (const client of filteredClients) {
            // Buscar dados cadastrais (WhatsApp)
            let whatsapp = "";
            const { data: dadosCadastrais, error: dadosError } = await supabase
                .from('dados_cadastrais')
                .select('whatsapp')
                .eq('cliente_id', client.id)
                .single();
            
            if (!dadosError && dadosCadastrais) {
                whatsapp = dadosCadastrais.whatsapp || "";
            }

            const row = document.createElement("tr");
            row.dataset.clientId = client.id;
            row.dataset.originalNome = client.nome;
            row.dataset.originalWhatsapp = whatsapp;
            row.dataset.originalProjeto = client.projeto;
            row.dataset.originalVisibility = client.visibility || 'INDIVIDUAL';
            row.dataset.originalAssignedTo = client.assigned_to_user_id || '';
            row.dataset.originalLogin = client.login || '';
            row.dataset.originalSenha = client.senha || '';

            // Permissões de Edição da Linha
            // Admin pode editar tudo
            // Usuário pode editar se: criou o cliente OU (é visível para todos E é do projeto dele) OU (está atribuído a ele)
            const canEdit = isAdmin || 
                           client.criado_por_id === currentUserId || 
                           (client.visibility === 'TODOS' && client.projeto === currentUserProjeto) ||
                           client.assigned_to_user_id === currentUserId;

            // Coluna Status/Atribuição
            let statusHtml = '';
            if (client.visibility === 'TODOS') {
                statusHtml = `<span class="status-todos">Todos</span>`;
            } else {
                // Se for individual, mostra dropdown de atribuição se for admin ou criador
                // Se não, mostra apenas o nome de quem está atribuído ou "Individual"
                if (isAdmin) {
                     statusHtml = `
                        <select class="client-visibility" disabled>
                            <option value="INDIVIDUAL" selected>Individual</option>
                            <option value="TODOS">Todos</option>
                        </select>
                        <select class="client-assigned-to">
                            <option value="">-- Ninguém --</option>
                            ${allUsers.map(u => `<option value="${u.id}" ${client.assigned_to_user_id === u.id ? 'selected' : ''}>${u.usuario}</option>`).join('')}
                        </select>
                    `;
                } else {
                    const assignedUser = allUsers.find(u => u.id === client.assigned_to_user_id);
                    const assignedName = assignedUser ? assignedUser.usuario : "Ninguém";
                    statusHtml = `
                        <span class="status-individual">Individual</span>
                        <div style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">
                            ${assignedName}
                        </div>
                    `;
                }
            }

            // Coluna Login/Senha
            const loginHtml = `
                <div class="login-cell">
                    <input type="text" class="client-login" value="${sanitizeInput(client.login)}" placeholder="Login" ${!canEdit ? 'disabled' : ''}>
                    <input type="text" class="client-senha" value="${sanitizeInput(client.senha)}" placeholder="Senha" ${!canEdit ? 'disabled' : ''}>
                </div>
            `;

            row.innerHTML = `
                <td data-label="Nome">
                    <input type="text" class="client-name" value="${sanitizeInput(client.nome)}" ${!canEdit ? 'disabled' : ''}>
                </td>
                <td data-label="WhatsApp">
                    <div class="whatsapp-cell">
                        <i class="fa-brands fa-whatsapp phone-icon"></i>
                        <input type="text" class="client-whatsapp" value="${sanitizeInput(whatsapp)}" placeholder="+55..." ${!canEdit ? 'disabled' : ''}>
                    </div>
                </td>
                <td data-label="Projeto">
                    <select class="client-project" ${!canEdit ? 'disabled' : ''}>
                        <option value="Argos" ${client.projeto === "Argos" ? "selected" : ""}>Argos</option>
                        <option value="Hvc" ${client.projeto === "Hvc" ? "selected" : ""}>Hvc</option>
                        <option value="Planejamento" ${client.projeto === "Planejamento" ? "selected" : ""}>Planejamento</option>
                    </select>
                </td>
                <td data-label="Login / Senha">
                    ${loginHtml}
                </td>
                <td data-label="Status/Atribuição">
                    ${statusHtml}
                </td>
                <td data-label="Dashboard">
                    <button class="view-forms-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Ver Formulários">
                        <i class="fa-solid fa-file-lines"></i> ${client.formularios_clientes[0].count}
                    </button>
                </td>
                <td data-label="Ações">
                    <button class="view-details-btn" data-client-id="${client.id}" title="Ver Detalhes (Em breve)">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    ${canEdit ? `
                    <button class="delete-btn" data-client-id="${client.id}" title="Excluir Cliente">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>` : ''}
                </td>
            `;
            clientsTableBody.appendChild(row);
        }

    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClients:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center;">Erro ao carregar clientes: ${error.message}</td></tr>`;
    }
}

// --- Adicionar Cliente --- 
async function addClient(event) {
    event.preventDefault();
    console.log("clientes.js: addClient() INICIADO.");

    const nome = newClientNameInput.value.trim();
    const whatsapp = newClientWhatsappInput.value.trim();
    const projeto = newClientProjectSelect.value;
    const visibility = newClientVisibilitySelect ? newClientVisibilitySelect.value : 'INDIVIDUAL';

    if (!nome || !whatsapp || !projeto) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    try {
        // 1. Inserir na tabela clientes
        const { data: clientData, error: clientError } = await supabase
            .from("clientes")
            .insert([{ 
                nome, 
                projeto, 
                criado_por_id: currentUserId,
                visibility: visibility,
                assigned_to_user_id: visibility === 'INDIVIDUAL' ? currentUserId : null // Se individual, atribui a quem criou
            }])
            .select()
            .single();

        if (clientError) throw clientError;

        const clientId = clientData.id;

        // 2. Inserir na tabela dados_cadastrais
        const { error: dadosError } = await supabase
            .from("dados_cadastrais")
            .insert([{ cliente_id: clientId, whatsapp }]);

        if (dadosError) {
            // Rollback (opcional, mas recomendado): excluir o cliente criado se falhar dados cadastrais
            console.error("clientes.js: Erro ao salvar WhatsApp, revertendo criação do cliente...");
            await supabase.from("clientes").delete().eq("id", clientId);
            throw dadosError;
        }

        // Limpar formulário e recarregar
        newClientNameInput.value = "";
        newClientWhatsappInput.value = "";
        // newClientProjectSelect.value = ""; // Mantém o projeto selecionado para facilitar
        alert("Cliente adicionado com sucesso!");
        loadClients(currentUserProjeto); // Recarrega com o filtro atual

    } catch (error) {
        console.error("clientes.js: Erro ao adicionar cliente:", error);
        alert("Erro ao adicionar cliente: " + error.message);
    }
}

// --- Marcar Cliente como Modificado --- 
function markClientAsModified(event) {
    const target = event.target;
    // Verifica se é um campo editável
    if (!target.matches('.client-name, .client-whatsapp, .client-project, .client-visibility, .client-assigned-to, .client-login, .client-senha')) return;

    const row = target.closest('tr');
    const clientId = row.dataset.clientId;
    
    // Verificar se houve mudança real
    const currentNome = row.querySelector('.client-name').value;
    const currentWhatsapp = row.querySelector('.client-whatsapp').value;
    const currentProjeto = row.querySelector('.client-project').value;
    const currentLogin = row.querySelector('.client-login').value;
    const currentSenha = row.querySelector('.client-senha').value;
    
    // Campos opcionais (podem não existir dependendo da view)
    const visibilitySelect = row.querySelector('.client-visibility');
    const assignedToSelect = row.querySelector('.client-assigned-to');
    
    const currentVisibility = visibilitySelect ? visibilitySelect.value : (row.dataset.originalVisibility || 'INDIVIDUAL');
    const currentAssignedTo = assignedToSelect ? assignedToSelect.value : (row.dataset.originalAssignedTo || '');

    const originalNome = row.dataset.originalNome;
    const originalWhatsapp = row.dataset.originalWhatsapp;
    const originalProjeto = row.dataset.originalProjeto;
    const originalLogin = row.dataset.originalLogin;
    const originalSenha = row.dataset.originalSenha;
    const originalVisibility = row.dataset.originalVisibility;
    const originalAssignedTo = row.dataset.originalAssignedTo;

    const hasChanged = 
        currentNome !== originalNome ||
        currentWhatsapp !== originalWhatsapp ||
        currentProjeto !== originalProjeto ||
        currentLogin !== originalLogin ||
        currentSenha !== originalSenha ||
        currentVisibility !== originalVisibility ||
        currentAssignedTo !== originalAssignedTo;

    if (hasChanged) {
        row.classList.add('modified');
        modifiedClientIds.add(clientId);
    } else {
        row.classList.remove('modified');
        modifiedClientIds.delete(clientId);
    }

    if (saveAllClientsBtn) {
        saveAllClientsBtn.disabled = modifiedClientIds.size === 0;
    }
}

// --- Salvar Todas as Alterações --- 
async function saveAllClientChanges() {
    console.log("clientes.js: saveAllClientChanges() INICIADO.");
    if (modifiedClientIds.size === 0) return;

    saveAllClientsBtn.disabled = true;
    saveAllClientsBtn.textContent = "Salvando...";

    const updates = [];
    const whatsappUpdates = [];

    modifiedClientIds.forEach(clientId => {
        const row = clientsTableBody.querySelector(`tr[data-client-id="${clientId}"]`);
        if (!row) return;

        const nome = row.querySelector('.client-name').value;
        const whatsapp = row.querySelector('.client-whatsapp').value;
        const projeto = row.querySelector('.client-project').value;
        const login = row.querySelector('.client-login').value;
        const senha = row.querySelector('.client-senha').value;
        
        const visibilitySelect = row.querySelector('.client-visibility');
        const assignedToSelect = row.querySelector('.client-assigned-to');
        
        const visibility = visibilitySelect ? visibilitySelect.value : undefined;
        const assigned_to_user_id = assignedToSelect ? (assignedToSelect.value || null) : undefined;

        // Objeto de atualização para tabela clientes
        const clientUpdate = { id: clientId, nome, projeto, login, senha };
        if (visibility !== undefined) clientUpdate.visibility = visibility;
        if (assigned_to_user_id !== undefined) clientUpdate.assigned_to_user_id = assigned_to_user_id;
        
        updates.push(clientUpdate);

        // Objeto de atualização para tabela dados_cadastrais (WhatsApp)
        // Nota: Supabase não tem update em lote nativo fácil para tabelas diferentes, faremos loop ou Promise.all
        whatsappUpdates.push({ cliente_id: clientId, whatsapp });
    });

    try {
        // 1. Atualizar Clientes (Promise.all para paralelismo)
        const clientPromises = updates.map(update => {
            const { id, ...data } = update;
            return supabase.from('clientes').update(data).eq('id', id);
        });

        // 2. Atualizar WhatsApp (Promise.all)
        // Primeiro precisamos saber se o registro existe em dados_cadastrais. 
        // Para simplificar, usamos upsert (insert on conflict update) se tivermos uma constraint unique em cliente_id
        // Como não temos certeza da constraint, faremos update. Se não atualizar (count=0), fazemos insert.
        // Melhor abordagem genérica: update.
        const whatsappPromises = whatsappUpdates.map(async (update) => {
             const { error } = await supabase
                .from('dados_cadastrais')
                .update({ whatsapp: update.whatsapp })
                .eq('cliente_id', update.cliente_id);
             
             if (error) throw error;
        });

        await Promise.all([...clientPromises, ...whatsappPromises]);

        alert("Todas as alterações foram salvas com sucesso!");
        saveAllClientsBtn.textContent = "Salvar Todas as Alterações";
        
        // Atualizar valores originais e limpar marcações
        updates.forEach(update => {
            const row = clientsTableBody.querySelector(`tr[data-client-id="${update.id}"]`);
            if (!row) return;
            
            if (update.nome !== undefined) row.dataset.originalNome = update.nome;
            if (update.projeto !== undefined) row.dataset.originalProjeto = update.projeto;
            if (update.login !== undefined) row.dataset.originalLogin = update.login;
            if (update.senha !== undefined) row.dataset.originalSenha = update.senha;
            if (update.visibility !== undefined) row.dataset.originalVisibility = update.visibility;
            if (update.assigned_to_user_id !== undefined) row.dataset.originalAssignedTo = update.assigned_to_user_id || '';
            
            row.classList.remove('modified');
        });
        
        // Atualizar originais de WhatsApp também
        whatsappUpdates.forEach(update => {
             const row = clientsTableBody.querySelector(`tr[data-client-id="${update.cliente_id}"]`);
             if (row) row.dataset.originalWhatsapp = update.whatsapp;
        });

        modifiedClientIds.clear();
        if (saveAllClientsBtn) saveAllClientsBtn.disabled = true;
        console.log("clientes.js: Alterações salvas com sucesso.");
    } catch (error) {
        console.error("clientes.js: Erro GERAL em saveAllClientChanges:", error);
        alert("Erro ao salvar alterações: " + error.message);
        saveAllClientsBtn.textContent = "Salvar Todas as Alterações";
        saveAllClientsBtn.disabled = false;
    }
}

// --- Excluir Cliente (COM CASCATA) --- 
async function deleteClient(id) {
    console.log(`clientes.js: deleteClient() chamado para Cliente ID: ${id}`);
    if (!id) {
        console.error("clientes.js: ID do cliente não fornecido para exclusão.");
        return;
    }

    try {
        // Verificar permissões antes de excluir
        const { data: clientData, error: clientError } = await supabase
            .from('clientes')
            .select('criado_por_id, visibility, projeto, nome')
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
        let formCount = 0;
        const { count: formsCount, error: countError } = await supabase
            .from('formularios_clientes')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (!countError && formsCount !== null) formCount = formsCount;

        // Verificar se há diagnóstico financeiro
        let hasDiagnostico = false;
        const { count: diagCount, error: diagCountError } = await supabase
            .from('diagnosticos_financeiros')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (!diagCountError && diagCount !== null && diagCount > 0) hasDiagnostico = true;

        // Verificar se há dados cadastrais
        let hasDadosCadastrais = false;
        const { count: dadosCount, error: dadosCountError } = await supabase
            .from('dados_cadastrais')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', id);
        if (!dadosCountError && dadosCount !== null && dadosCount > 0) hasDadosCadastrais = true;

        // Montar mensagem detalhada
        let confirmMessage = `Tem certeza que deseja excluir o cliente "${clientData.nome}"?\n\n`;
        confirmMessage += `⚠️ ESTA AÇÃO É IRREVERSÍVEL e apagará:\n`;
        
        if (formCount > 0) confirmMessage += `- ${formCount} Formulário(s) preenchido(s)\n`;
        if (hasDiagnostico) confirmMessage += `- Diagnóstico Financeiro completo\n`;
        if (hasDadosCadastrais) confirmMessage += `- Dados Cadastrais (CPF, Endereço, etc.)\n`;
        
        confirmMessage += `\nSe você confirmar, todos esses dados serão perdidos para sempre.`;
        
        if (!confirm(confirmMessage)) {
            console.log("clientes.js: Exclusão cancelada pelo usuário.");
            return;
        }

        // 1. Excluir Diagnósticos Financeiros
        const { error: diagError } = await supabase
            .from("diagnosticos_financeiros")
            .delete()
            .eq("cliente_id", id);
        if (diagError) console.warn("Aviso: Erro ao excluir diagnósticos (pode não existir):", diagError);

        // 2. Excluir Formulários
        const { error: formError } = await supabase
            .from("formularios_clientes")
            .delete()
            .eq("cliente_id", id);
        if (formError) console.warn("Aviso: Erro ao excluir formulários (pode não existir):", formError);

        // 3. Excluir Dados Cadastrais
        const { error: dadosError } = await supabase
            .from("dados_cadastrais")
            .delete()
            .eq("cliente_id", id);
        if (dadosError) console.warn("Aviso: Erro ao excluir dados cadastrais (pode não existir):", dadosError);

        // 4. Excluir Tarefas de Onboarding (hvsf_tasks) - Busca pelo NOME do cliente
        // NOTA: Como hvsf_tasks não tem client_id, usamos o nome. Isso é uma medida de limpeza.
        if (clientData.nome) {
            const { error: tasksError } = await supabase
                .from("hvsf_tasks")
                .delete()
                .eq("client_name", clientData.nome);
            if (tasksError) console.warn("Aviso: Erro ao excluir tarefas de onboarding (pode não existir):", tasksError);
            else console.log(`clientes.js: Tarefas de onboarding para "${clientData.nome}" excluídas.`);
        }

        // 5. Excluir Cliente
        // Adicionamos .select() para saber quantos registros foram realmente apagados
        const { data: deletedData, error: deleteError } = await supabase
            .from("clientes")
            .delete()
            .eq("id", id)
            .select();

        if (deleteError) {
            console.error("clientes.js: Erro ao excluir cliente (Supabase):", deleteError);
            // Se for erro de FK, avisa explicitamente
            if (deleteError.code === '23503') { // foreign_key_violation
                throw new Error(`Não foi possível excluir o cliente pois existem outros dados vinculados (Erro FK: ${deleteError.details}). Contate o suporte.`);
            }
            throw deleteError;
        }

        // Verificação de RLS (Row Level Security)
        if (!deletedData || deletedData.length === 0) {
            console.warn("clientes.js: Comando de exclusão executado, mas nenhum registro foi removido. Verifique as políticas RLS no Supabase.");
            alert("ERRO: O cliente não foi excluído do banco de dados. Isso geralmente acontece por falta de permissão (RLS Policy). Verifique se você está logado corretamente ou contate o administrador.");
            return; // Não remove da tela se não apagou do banco
        }

        alert("Cliente e todos os dados associados foram excluídos com sucesso!");
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
            throw new Error("Você não tem permissão para excluir este formulário.");
        }

        if (!confirm("Tem certeza que deseja excluir este formulário? Esta ação não pode ser desfeita.")) {
            return;
        }

        const { error } = await supabase
            .from('formularios_clientes')
            .delete()
            .eq('id', formId);

        if (error) {
            console.error("clientes.js: Erro ao excluir formulário (Supabase):", error);
            throw error;
        }

        console.log(`clientes.js: Formulário ID ${formId} excluído com sucesso.`);
        // Recarregar lista de formulários
        await loadClientForms(clientId);
        // Atualizar contagem na tabela principal
        loadClients(currentUserProjeto);

    } catch (error) {
        console.error("clientes.js: Erro GERAL em deleteForm:", error);
        alert("Erro ao excluir formulário: " + error.message);
    }
}

// --- Handlers de Eventos ---
function handleTableClick(event) {
    const target = event.target;
    const btn = target.closest('button');
    
    if (!btn) return;

    const clientId = btn.dataset.clientId;
    const clientName = btn.dataset.clientName;

    if (btn.classList.contains('view-forms-btn')) {
        showClientFormsModal(clientId, clientName);
    } else if (btn.classList.contains('delete-btn')) {
        deleteClient(clientId);
    } else if (btn.classList.contains('view-details-btn')) {
        alert("Funcionalidade de detalhes em desenvolvimento.");
    }
}

function handleDeleteFormClick(event) {
    const target = event.target;
    const btn = target.closest('.delete-form-btn');
    
    if (!btn) return;

    const formId = btn.dataset.formId;
    const clientId = btn.dataset.clientId;
    deleteForm(formId, clientId);
}

// Inicializar
document.addEventListener("DOMContentLoaded", initializeDashboard);
