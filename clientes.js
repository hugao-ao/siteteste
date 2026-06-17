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

// --- Estado para Mensagens WhatsApp ---
let allClientes = [];
let clientesData = {}; // { clienteId: { fluxo, acompanhamento, trackingData, particularidades } }
let currentMsgClienteId = null;

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
                .maybeSingle();
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

    // Inicializar data de simulação
    const simDateInput = document.getElementById('sim-date');
    if (simDateInput) {
        simDateInput.value = new Date().toISOString().split('T')[0];
        updateSimInfo();
        simDateInput.addEventListener('change', () => {
            updateSimInfo();
            updateMsgBadges();
        });
    }

    // Listeners do modal de mensagem
    const closeMsgModalBtn = document.querySelector('.close-msg-modal');
    const msgCancelBtn = document.getElementById('msg-cancel-btn');
    const msgSaveBtn = document.getElementById('msg-save-btn');
    const generateBtn = document.getElementById('btn-generate-report');
    const mensagemModal = document.getElementById('mensagem-modal');

    if (closeMsgModalBtn) closeMsgModalBtn.addEventListener('click', () => { mensagemModal.style.display = 'none'; });
    if (msgCancelBtn) msgCancelBtn.addEventListener('click', () => { mensagemModal.style.display = 'none'; });
    if (msgSaveBtn) msgSaveBtn.addEventListener('click', saveMensagem);
    if (generateBtn) generateBtn.addEventListener('click', handleGenerateReport);
    window.addEventListener('click', (e) => { if (e.target === mensagemModal) mensagemModal.style.display = 'none'; });

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
        clientsTableBody.innerHTML = '<tr><td colspan="13">Carregando clientes...</td></tr>';
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
            clientsTableBody.innerHTML = '<tr><td colspan="13" style="text-align: center;">Nenhum cliente encontrado.</td></tr>';
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
             clientsTableBody.innerHTML = '<tr><td colspan="13" style="text-align: center;">Nenhum cliente visível para você.</td></tr>';
             return;
        }

        // Renderizar Tabela
        for (const client of filteredClients) {
            // Buscar dados cadastrais (WhatsApp)
            let whatsapp = "";
            const { data: dadosCadastrais, error: dadosError } = await supabase
                .from('dados_cadastrais')
                .select('whatsapp, nome_completo')
                .eq('cliente_id', client.id)
                .maybeSingle();
            
            if (!dadosError && dadosCadastrais) {
                whatsapp = dadosCadastrais.whatsapp || "";
            }
            // Guardar dados_cadastrais no objeto client para uso nas mensagens
            client._dadosCadastrais = dadosCadastrais || {};

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
                <td data-label="Últ. Reunião" class="ult-reuniao-cell">
                    <span class="dias-loading">...</span>
                </td>
                <td data-label="Pend. Consultor" class="pend-cell">
                    <span class="pend-loading">...</span>
                </td>
                <td data-label="Pend. Cliente" class="pend-cell">
                    <span class="pend-loading">...</span>
                </td>
                <td data-label="Patrimônio" class="fin-cell fin-patrimonio">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Dívidas" class="fin-cell fin-dividas">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Fluxo Mensal" class="fin-cell fin-fluxo">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Ações">
                    <button class="msg-action-btn edit-msg-btn" data-client-id="${client.id}" title="Editar/Gerar mensagem WhatsApp">
                      <i class="fas fa-comment-alt"></i>
                    </button>
                    <button class="msg-action-btn whats-btn" data-client-id="${client.id}" title="Enviar WhatsApp">
                      <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="msg-action-btn system-btn" data-client-id="${client.id}" title="Acessar sistema do cliente">
                      <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="view-details-btn" data-client-id="${client.id}" title="Ver Detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    ${canEdit ? `
                    <button class="delete-btn" data-client-id="${client.id}" title="Excluir Cliente">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>` : ''}
                </td>
            `;
            clientsTableBody.appendChild(row);
            // Fetch última reunião, pendentes e financeiros async
            fetchUltimaReuniao(client.id, row);
            fetchPendentes(client.id, row);
            fetchFinanceiros(client.id, row);
        }

        // Salvar referência dos clientes para mensagens WhatsApp
        allClientes = filteredClients;
        // Carregar dados para mensagens em background (mesma ordem do original)
        await loadMensagens();
        await loadSaudacoes();
        loadAllClientData();

    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClients:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="13" style="color: red; text-align: center;">Erro ao carregar clientes: ${error.message}</td></tr>`;
    }
}

// --- Buscar Última Reunião ---
async function fetchUltimaReuniao(clienteId, row) {
    const cell = row.querySelector('.ult-reuniao-cell');
    if (!cell) return;
    try {
        // 1. Tentar buscar da ferramenta acompanhamento (reuniões salvas)
        const { data: acompData, error: acompError } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clienteId)
            .eq('ferramenta', 'acompanhamento')
            .maybeSingle();

        if (!acompError && acompData && acompData.dados) {
            const dados = acompData.dados;
            // reunioes array sorted desc - first is most recent
            if (Array.isArray(dados.reunioes) && dados.reunioes.length > 0) {
                const ultimaData = dados.reunioes[0].data; // 'YYYY-MM-DD'
                if (ultimaData) {
                    const dias = calcDiasDesde(ultimaData);
                    cell.innerHTML = `<span class="dias-num">${dias}</span><span class="dias-label">dia${dias !== 1 ? 's' : ''}</span>`;
                    return;
                }
            }
        }

        // 2. Fallback: data de criação do diagnóstico financeiro
        const { data: diagData, error: diagError } = await supabase
            .from('diagnosticos_financeiros')
            .select('created_at')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!diagError && diagData && diagData.created_at) {
            const dias = calcDiasDesde(diagData.created_at.split('T')[0]);
            cell.innerHTML = `<span class="dias-num">${dias}</span><span class="dias-label">dia${dias !== 1 ? 's' : ''}</span>`;
            return;
        }

        // 3. Sem dados
        cell.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
    } catch (err) {
        console.warn('fetchUltimaReuniao error for client ' + clienteId, err);
        cell.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
    }
}

function calcDiasDesde(dateStr) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data = new Date(dateStr + 'T00:00:00');
    const diff = Math.floor((hoje - data) / 86400000);
    return Math.max(0, diff);
}

// --- Buscar Pendentes (Consultor e Cliente) ---
async function fetchPendentes(clienteId, row) {
    const cellConsultor = row.querySelectorAll('.pend-cell')[0];
    const cellCliente = row.querySelectorAll('.pend-cell')[1];
    if (!cellConsultor || !cellCliente) return;
    try {
        const { data: acompData, error: acompError } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clienteId)
            .eq('ferramenta', 'acompanhamento')
            .maybeSingle();

        if (!acompError && acompData && acompData.dados) {
            const dados = acompData.dados;
            const micros = Array.isArray(dados.microPassos) ? dados.microPassos : [];
            const macros = Array.isArray(dados.macroPassos) ? dados.macroPassos : [];

            // Pendentes Consultor: micro passos com responsavel_consultor=true e não concluídos
            const pendConsultor = micros.filter(m => m.responsavel_consultor && m.status !== 'concluido').length;
            // Pendentes Cliente: micro passos SEM responsavel_consultor e não concluídos + macros não concluídas
            const pendMicrosCliente = micros.filter(m => !m.responsavel_consultor && m.status !== 'concluido').length;
            const pendMacros = macros.filter(m => m.status !== 'concluido').length;
            const pendCliente = pendMicrosCliente + pendMacros;

            cellConsultor.innerHTML = `<span class="pend-num ${pendConsultor > 0 ? 'pend-active' : 'pend-zero'}">${pendConsultor}</span><span class="pend-label">micro${pendConsultor !== 1 ? 's' : ''}</span>`;
            cellCliente.innerHTML = `<span class="pend-num ${pendCliente > 0 ? 'pend-active' : 'pend-zero'}">${pendCliente}</span><span class="pend-label">item${pendCliente !== 1 ? 'ns' : ''}</span>`;
        } else {
            cellConsultor.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
            cellCliente.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
        }
    } catch (err) {
        console.warn('fetchPendentes error for client ' + clienteId, err);
        cellConsultor.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
        cellCliente.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
    }
}

// --- Buscar Dados Financeiros (Patrimônio, Dívidas, Fluxo Mensal) ---
async function fetchFinanceiros(clienteId, row) {
    const cellPatrimonio = row.querySelector('.fin-patrimonio');
    const cellDividas = row.querySelector('.fin-dividas');
    const cellFluxo = row.querySelector('.fin-fluxo');
    if (!cellPatrimonio || !cellDividas || !cellFluxo) return;
    const dash = '<span style="color:var(--theme-text-muted);">--</span>';
    try {
        // Buscar patrimônio
        const { data: patData } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clienteId)
            .eq('ferramenta', 'patrimonio')
            .maybeSingle();

        if (patData && patData.dados && patData.dados.datas && patData.dados.datas.length > 0) {
            const datas = patData.dados.datas;
            const refDate = datas.find(d => d.primary) || datas[datas.length - 1];
            const ativosLiq = (refDate.ativos_liquidos || []).reduce((s, a) => s + (a.valor || 0), 0);
            const ativosFis = (refDate.ativos_fisicos || []).reduce((s, a) => s + (a.valor || 0), 0);
            const ativosInt = (refDate.ativos_intangiveis || []).reduce((s, a) => s + (a.valor || 0), 0);
            const patrimonio = ativosLiq + ativosFis + ativosInt;
            const dividas = (refDate.dividas || []).reduce((s, d) => s + (d.saldo || 0), 0);

            cellPatrimonio.innerHTML = `<span class="fin-val fin-gold">${fmtBRL(patrimonio)}</span>`;
            cellDividas.innerHTML = dividas > 0
                ? `<span class="fin-val fin-red">${fmtBRL(dividas)}</span>`
                : `<span class="fin-val fin-green">R$ 0</span>`;
        } else {
            cellPatrimonio.innerHTML = dash;
            cellDividas.innerHTML = dash;
        }

        // Buscar fluxo (simulação primary → último mês com metas)
        const { data: fluxoData } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clienteId)
            .eq('ferramenta', 'fluxo')
            .maybeSingle();

        if (fluxoData && fluxoData.dados && Array.isArray(fluxoData.dados) && fluxoData.dados.length > 0) {
            const sims = fluxoData.dados;
            const primarySim = sims.find(s => s.primary) || sims[0];
            const tracking = primarySim.payload && primarySim.payload.trackingData;
            if (tracking && tracking.metas && Object.keys(tracking.metas).length > 0) {
                const monthKeys = Object.keys(tracking.metas).sort();
                // Pegar o mês mais recente
                const lastMonth = monthKeys[monthKeys.length - 1];
                const lancMes = (tracking.lancamentos || []).filter(l => l.data && l.data.substring(0, 7) === lastMonth);
                let renda = 0, despesas = 0, poupanca = 0;
                if (lancMes.length > 0) {
                    lancMes.forEach(l => {
                        if (l.tipo === 'entrada') renda += l.valor;
                        else if (l.tipo === 'poupanca') poupanca += l.valor;
                        else despesas += l.valor;
                    });
                } else {
                    const metaObj = tracking.metas[lastMonth];
                    renda = metaObj && metaObj.entradas ? metaObj.entradas : 0;
                    poupanca = metaObj && metaObj.poupanca ? metaObj.poupanca : 0;
                    const cats = metaObj && metaObj.categorias ? metaObj.categorias : metaObj;
                    if (cats) { Object.keys(cats).forEach(k => { if (k !== 'entradas' && k !== 'poupanca') despesas += cats[k] || 0; }); }
                }
                const sobra = renda - despesas - poupanca;
                cellFluxo.innerHTML = `<div class="fin-row">
                    <div class="fin-item"><span class="fin-val fin-green" style="font-size:0.78rem;">${fmtBRL(renda)}</span><span class="fin-label">Renda</span></div>
                    <div class="fin-item"><span class="fin-val fin-red" style="font-size:0.78rem;">${fmtBRL(despesas)}</span><span class="fin-label">Desp.</span></div>
                    <div class="fin-item"><span class="fin-val fin-blue" style="font-size:0.78rem;">${fmtBRL(poupanca)}</span><span class="fin-label">Poup.</span></div>
                    <div class="fin-item"><span class="fin-val ${sobra >= 0 ? 'fin-green' : 'fin-red'}" style="font-size:0.78rem;">${fmtBRL(sobra)}</span><span class="fin-label">Sobra</span></div>
                </div>`;
            } else {
                cellFluxo.innerHTML = dash;
            }
        } else {
            cellFluxo.innerHTML = dash;
        }
    } catch (err) {
        console.warn('fetchFinanceiros error for client ' + clienteId, err);
        cellPatrimonio.innerHTML = dash;
        cellDividas.innerHTML = dash;
        cellFluxo.innerHTML = dash;
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
                whatsapp,
                projeto, 
                criado_por_id: currentUserId,
                visibility: visibility,
                assigned_to_user_id: visibility === 'INDIVIDUAL' ? currentUserId : null // Se individual, atribui a quem criou
            }])
            .select()
            .maybeSingle();

        if (clientError) throw clientError;

        const clientId = clientData.id;

        // 2. Inserir na tabela dados_cadastrais
        // Gera um CPF placeholder único (campo obrigatório NOT NULL na tabela)
        const cpfPlaceholder = 'PEND-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
        const { error: dadosError } = await supabase
            .from("dados_cadastrais")
            .insert([{ cliente_id: clientId, whatsapp, cpf: cpfPlaceholder, nome_completo: nome }]);

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
            .maybeSingle();
            
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
            .maybeSingle();
            
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
        window.location.href = `cliente-detalhes.html?id=${clientId}`;
    } else if (btn.classList.contains('edit-msg-btn')) {
        handleEditMessage(clientId);
    } else if (btn.classList.contains('whats-btn')) {
        openWhatsApp(clientId);
    } else if (btn.classList.contains('system-btn')) {
        openClientSystem(clientId);
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

// ============================================================
// === MENSAGENS WHATSAPP - MIGRADO DE mensagens-whats.html ===
// ============================================================

const MSGS_SEMANA_LIVRE = [
  'Semana livre de compromissos financeiros! Boas férias pro bolso 😎🏖️',
  'Nada previsto essa semana! Aproveita pra respirar... o bolso agradece kkkk 💸',
  'Semana tranquila! Nem parece segunda-feira né? Aproveita! 😂🙏',
  'Zero compromissos financeiros essa semana! Pode até fingir que é milionário kkk 💰',
  'Semana livre! Se alguém cobrar alguma coisa, diz que tá de férias financeiras 😎',
  'Nenhuma movimentação prevista! Semana pra curtir sem pensar em boleto 🎉',
  'Boa semana! E a melhor notícia: nada pra pagar nem receber kkk... ou será que a melhor seria receber? 🤔',
  'Semana zen! Nenhum compromisso financeiro no radar. Namastê pro bolso 🧘‍♂️💵',
  'Essa semana tá mais vazia que geladeira no fim do mês... só que no bom sentido! 😂',
  'Nada previsto! Semana pra focar no que importa sem preocupação financeira 💪',
  'Semana livre de boletos! Isso sim é qualidade de vida kkk 🌟',
  'Nenhum evento financeiro essa semana! Pode relaxar... até segunda que vem 😅',
  'Tá tudo tranquilo essa semana! Aproveita esse respiro financeiro 🙌',
  'Semana sem movimentações! É tipo feriado pro planejamento financeiro 🌴',
  'Nada no radar essa semana! Bora aproveitar essa paz financeira ✌️',
  'Boa semana! E pode ficar tranquilo que essa semana o fluxo tá de boa 😎👍',
  'Semana sem compromissos! Até o Excel tá de folga kkkk 📊😴',
  'Nada pra essa semana! Bora aproveitar que semana que vem pode ser diferente kkk 😂',
  'Semana livre! Se precisar de mim, tô aqui... mas financeiramente tá tudo certo! 👊',
  'Zero eventos essa semana! Aproveita pra descansar a cabeça... e a carteira 😄💳'
];

// --- Sim Date helpers ---
function getSimDate() {
  const simDateInput = document.getElementById('sim-date');
  if (!simDateInput || !simDateInput.value) return null;
  return new Date(simDateInput.value + 'T00:00:00');
}

function updateSimInfo() {
  const simInfo = document.getElementById('sim-info');
  if (!simInfo) return;
  const d = getSimDate();
  if (!d) { simInfo.textContent = ''; return; }
  const dow = d.getDay();
  const dom = d.getDate();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let tags = [];
  if (dom === 1) tags.push('Início do Mês');
  if (dow === 1) tags.push('Início da Semana (Segunda)');
  if (dow === 5) tags.push('Final da Semana (Sexta)');
  if (dom === lastDay) tags.push('Final do Mês');
  if (tags.length === 0) tags.push('Dia comum');
  simInfo.innerHTML = `<strong>${d.toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</strong> — ${tags.join(' | ')}`;
}

// --- Load mensagens & saudações ---
async function loadMensagens() {
  try {
    if (allClientes.length === 0) return;
    const ids = allClientes.map(c => c.id);
    const { data, error } = await supabase
      .from('mensagens_clientes')
      .select('cliente_id, mensagem')
      .in('cliente_id', ids);
    if (error) throw error;
    if (data) {
      data.forEach(m => {
        const c = allClientes.find(cl => cl.id === m.cliente_id);
        if (c) c.mensagem = m.mensagem;
      });
    }
  } catch (e) { console.error('Erro mensagens:', e); }
}

async function loadSaudacoes() {
  try {
    if (allClientes.length === 0) return;
    const ids = allClientes.map(c => c.id);
    const { data, error } = await supabase
      .from('saudacoes_clientes')
      .select('cliente_id, saudacao')
      .in('cliente_id', ids);
    if (error) throw error;
    if (data) {
      data.forEach(s => {
        const c = allClientes.find(cl => cl.id === s.cliente_id);
        if (c) c._saudacao = s.saudacao;
      });
    }
  } catch (e) { console.warn('Tabela saudacoes_clientes não encontrada:', e.message); }
}

// --- Load all client data for report generation ---
async function loadAllClientData() {
  try {
    const ids = allClientes.map(c => c.id);
    if (ids.length === 0) return;
    const { data, error } = await supabase
      .from('ferramentas_dados')
      .select('cliente_id, ferramenta, dados')
      .in('cliente_id', ids)
      .in('ferramenta', ['fluxo', 'acompanhamento', 'fluxo_caixa_avancado', 'particularidades']);
    if (error) throw error;
    
    clientesData = {};
    if (data) {
      data.forEach(row => {
        if (!clientesData[row.cliente_id]) clientesData[row.cliente_id] = {};
        let d = row.dados;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch(e) { d = null; } }
        
        if (row.ferramenta === 'fluxo' || row.ferramenta === 'fluxo_caixa_avancado') {
          if (!clientesData[row.cliente_id].fluxo && d) {
            let simList = Array.isArray(d) ? d : (d.simulacoes || [d]);
            let primarySim = simList.find(s => s.primary) || simList[0];
            if (primarySim && primarySim.payload) {
              clientesData[row.cliente_id].fluxo = primarySim.payload;
              if (primarySim.payload.trackingData) {
                clientesData[row.cliente_id].trackingData = primarySim.payload.trackingData;
              }
            } else if (primarySim && primarySim.itens) {
              clientesData[row.cliente_id].fluxo = primarySim;
              if (primarySim.trackingData) {
                clientesData[row.cliente_id].trackingData = primarySim.trackingData;
              }
            }
          }
        } else if (row.ferramenta === 'particularidades') {
          clientesData[row.cliente_id].particularidades = d;
        } else {
          clientesData[row.cliente_id][row.ferramenta] = d;
        }
      });
    }
    updateMsgBadges();
  } catch(e) { console.error('Erro ao carregar dados para mensagens:', e); }
}

// --- Badge System ---
function updateMsgBadges() {
  const simDate = getSimDate();
  if (!simDate) return;
  document.querySelectorAll('.edit-msg-btn').forEach(btn => {
    const clienteId = btn.dataset.clientId;
    const hasMessage = clienteHasMensagem(clienteId, simDate);
    const existing = btn.querySelector('.badge');
    if (existing) existing.remove();
    if (hasMessage) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '!';
      btn.appendChild(badge);
    }
  });
}

function clienteHasMensagem(clienteId, simDate) {
  const data = clientesData[clienteId];
  if (!data) return false;
  const dow = simDate.getDay();
  const dom = simDate.getDate();
  const lastDay = new Date(simDate.getFullYear(), simDate.getMonth() + 1, 0).getDate();
  if (dom === 1 || dom === lastDay) return true;
  const { itens: fluxoItens, contas: fluxoContas } = getFluxoPayload(data);
  let hasFluxoEvents = false;
  if (fluxoItens.length > 0) {
    const events = getFluxoEventsForDate(fluxoItens, simDate, fluxoContas);
    if (events.length > 0) hasFluxoEvents = true;
  }
  let hasCronoEvents = false;
  if (data.acompanhamento) {
    const cronoEvents = getCronoEventsForDate(data.acompanhamento, simDate);
    if (cronoEvents.length > 0) hasCronoEvents = true;
  }
  let hasDatasRelevantes = false;
  if (data.particularidades && data.particularidades.datas_relevantes) {
    const datasRel = data.particularidades.datas_relevantes;
    for (const dr of datasRel) {
      if (isDataRelevantOnDate(dr, simDate)) { hasDatasRelevantes = true; break; }
    }
  }
  if (dow === 1) return true;
  if (dow === 5) {
    if (fluxoItens.length > 0) {
      const weekStart = new Date(simDate.getFullYear(), simDate.getMonth(), simDate.getDate() - 4);
      const weekEnd = new Date(simDate);
      const weekEvents = getAllFluxoEvents(fluxoItens, weekStart, weekEnd, fluxoContas);
      if (weekEvents.length > 0) return true;
    }
    if (data.acompanhamento) {
      const weekStart = new Date(simDate.getFullYear(), simDate.getMonth(), simDate.getDate() - 4);
      const weekEnd = new Date(simDate);
      const cronoWeek = getCronoForPeriod(data.acompanhamento, weekStart, weekEnd);
      if (cronoWeek.length > 0) return true;
    }
    if (hasDatasRelevantes) return true;
    return false;
  }
  return hasFluxoEvents || hasCronoEvents || hasDatasRelevantes;
}

// --- 3 Action Handlers ---
function handleEditMessage(clienteId) {
  currentMsgClienteId = clienteId;
  const cliente = allClientes.find(c => c.id === clienteId);
  if (!cliente) return;
  const nome = cliente._dadosCadastrais?.nome_completo || cliente.nome || 'Cliente';
  const modalNome = document.getElementById('msg-modal-cliente-nome');
  const saudacaoTexto = document.getElementById('saudacao-texto');
  const mensagemTexto = document.getElementById('mensagem-texto');
  const mensagemModal = document.getElementById('mensagem-modal');
  if (modalNome) modalNome.textContent = `Mensagem para: ${nome}`;
  const saudKey = 'hv_saudacao_' + clienteId;
  if (saudacaoTexto) saudacaoTexto.value = localStorage.getItem(saudKey) || cliente._saudacao || 'Aqui é o Hugo da HV Saúde Financeira!';
  const storageKey = 'hv_msg_' + clienteId;
  if (mensagemTexto) mensagemTexto.value = localStorage.getItem(storageKey) || cliente.mensagem || '';
  if (mensagemModal) mensagemModal.style.display = 'block';
}

function openWhatsApp(clienteId) {
  const cliente = allClientes.find(c => c.id === clienteId);
  if (!cliente) return;
  let whatsapp = cliente._dadosCadastrais?.whatsapp || cliente.whatsapp || '';
  if (!whatsapp) { alert('WhatsApp não cadastrado.'); return; }
  whatsapp = whatsapp.replace(/^\+/, '');
  const storageKey = 'hv_msg_' + clienteId;
  const mensagem = localStorage.getItem(storageKey) || cliente.mensagem || '';
  const url = `https://api.whatsapp.com/send?phone=${whatsapp}&text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
}

function openClientSystem(clienteId) {
  const cliente = allClientes.find(c => c.id === clienteId);
  if (!cliente) return;
  const nome = cliente._dadosCadastrais?.nome_completo || cliente.nome || 'Cliente';
  sessionStorage.setItem('equipe_modo_cliente', 'true');
  sessionStorage.setItem('cliente_id', clienteId);
  sessionStorage.setItem('cliente_nome', nome);
  sessionStorage.setItem('cliente_id_retorno', clienteId);
  sessionStorage.setItem('retorno_url', 'clientes-dashboard.html');
  window.location.href = 'archives_clients/index.html';
}

// --- Generate Report Handler ---
async function handleGenerateReport() {
  if (!currentMsgClienteId) return;
  const generateBtn = document.getElementById('btn-generate-report');
  const mensagemTexto = document.getElementById('mensagem-texto');
  generateBtn.disabled = true;
  generateBtn.textContent = 'Gerando...';
  try {
    const report = await generateReport(currentMsgClienteId);
    if (report === null) {
      const simDate = getSimDate();
      const dow = simDate ? simDate.getDay() : -1;
      if (dow === 5) {
        alert('Não há nada para relatar nesta semana para este cliente.');
      } else {
        alert('Não há eventos para relatar nesta data para este cliente.');
      }
      mensagemTexto.value = '';
    } else {
      mensagemTexto.value = report;
    }
  } catch(e) {
    console.error(e);
    mensagemTexto.value = 'Erro ao gerar relatório: ' + e.message;
  }
  generateBtn.disabled = false;
  generateBtn.innerHTML = '<i class="fas fa-magic"></i> Gerar Relatório Automático';
}

// --- Save Message ---
async function saveMensagem() {
  if (!currentMsgClienteId) return;
  const mensagemTexto = document.getElementById('mensagem-texto');
  const saudacaoTexto = document.getElementById('saudacao-texto');
  const mensagemModal = document.getElementById('mensagem-modal');
  const mensagem = mensagemTexto.value.trim();
  const saudacao = saudacaoTexto.value.trim();
  const storageKey = 'hv_msg_' + currentMsgClienteId;
  const saudKey = 'hv_saudacao_' + currentMsgClienteId;
  localStorage.setItem(storageKey, mensagem);
  localStorage.setItem(saudKey, saudacao);
  const cliente = allClientes.find(c => c.id === currentMsgClienteId);
  if (cliente) {
    cliente.mensagem = mensagem;
    cliente._saudacao = saudacao;
  }
  try {
    await supabase
      .from('saudacoes_clientes')
      .upsert({ cliente_id: currentMsgClienteId, saudacao, updated_at: new Date().toISOString() }, { onConflict: 'cliente_id' });
  } catch (e) { console.warn('Saudação não salvou no Supabase:', e.message); }
  try {
    await supabase
      .from('mensagens_clientes')
      .upsert({ cliente_id: currentMsgClienteId, mensagem, updated_at: new Date().toISOString() }, { onConflict: 'cliente_id' });
  } catch (e) { console.warn('Mensagem não salvou no Supabase:', e.message); }
  alert('Mensagem salva!');
  mensagemModal.style.display = 'none';
}

// === REPORT GENERATION (migrado integralmente) ===
async function generateReport(clienteId) {
  const simDate = getSimDate();
  if (!simDate) { alert('Defina uma data de simulação primeiro.'); return null; }
  const data = clientesData[clienteId];
  const cliente = allClientes.find(c => c.id === clienteId);
  const nome = cliente?._dadosCadastrais?.nome_completo || cliente?.nome || 'Cliente';
  const primeiroNome = nome.split(' ')[0];
  const dow = simDate.getDay();
  const dom = simDate.getDate();
  const lastDay = new Date(simDate.getFullYear(), simDate.getMonth() + 1, 0).getDate();
  let report = '';
  const { itens: fluxoItens, contas: fluxoContas } = getFluxoPayload(data);
  const cartoesMap = buildCartoesMap(fluxoContas);
  const isInicioMes = (dom === 1);
  const isFinalMes = (dom === lastDay);
  const isSegunda = (dow === 1);
  const isSexta = (dow === 5);

  // Saudação personalizada
  const saudKey = 'hv_saudacao_' + clienteId;
  const saudacao = localStorage.getItem(saudKey) || cliente?._saudacao || document.getElementById('saudacao-texto')?.value?.trim() || 'Aqui é o Hugo da HV Saúde Financeira!';
  report += `${saudacao}\n\n`;

  // Introdução
  report += `Nosso sistema gerou esse relatório pra gente manter tudo em dia. Se algo tiver diferente do esperado, me avisa!\n`;
  if (cliente?.login && cliente?.senha) {
    report += `Se puder, atualiza direto no sistema ou me manda um áudio aqui mesmo com o que mudou que eu ajusto pra você 🎤\n`;
    report += `Acesse: https://app.hvsaudefinanceira.com.br\n`;
    report += `Login: *${cliente.login}* | Senha: *${cliente.senha}*\n`;
  } else {
    report += `Se algo tiver diferente do planejado, me manda um áudio aqui mesmo com o que mudou que eu ajusto pra você 🎤\n`;
  }
  report += `\n`;
  let hasContent = false;

  // === INÍCIO DO MÊS ===
  if (isInicioMes) {
    hasContent = true;
    report += `*📆 RELATÓRIO MENSAL - ${simDate.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).toUpperCase()}*\n\n`;
    if (fluxoItens.length > 0) {
      const monthStart = new Date(simDate.getFullYear(), simDate.getMonth(), 1);
      const monthEnd = new Date(simDate.getFullYear(), simDate.getMonth() + 1, 0);
      const monthEvents = getAllFluxoEvents(fluxoItens, monthStart, monthEnd, fluxoContas);
      let totalReceitas = 0, totalDespesas = 0, totalInvest = 0;
      monthEvents.forEach(e => {
        if (e.item.tipo === 'entrada') totalReceitas += e.item.valor;
        else if (e.item.subtipo === 'investimento' || e.item.subtipo === 'poupanca') totalInvest += e.item.valor;
        else totalDespesas += e.item.valor;
      });
      report += `📊 *Previsão de Fluxo de Caixa do mês:*\n`;
      report += `• Receitas previstas: ${fmtBRL(totalReceitas)}\n`;
      report += `• Despesas previstas: ${fmtBRL(totalDespesas)}\n`;
      report += `• Investimentos/Poupança: ${fmtBRL(totalInvest)}\n`;
      report += `• Saldo previsto: ${fmtBRL(totalReceitas - totalDespesas - totalInvest)}\n\n`;
    }
    if (data?.acompanhamento) {
      const cronoMonth = getCronoForMonth(data.acompanhamento, simDate);
      if (cronoMonth.length > 0) {
        report += `📋 *Cronograma para este mês:*\n`;
        cronoMonth.forEach(e => report += `• ${e.desc}\n`);
        report += '\n';
      }
    }
  }

  // === FINAL DO MÊS ===
  if (isFinalMes) {
    hasContent = true;
    report += `*📈 COMPARATIVO MENSAL - ${simDate.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).toUpperCase()}*\n\n`;
    const monthStart = new Date(simDate.getFullYear(), simDate.getMonth(), 1);
    if (fluxoItens.length > 0) {
      const monthEvents = getAllFluxoEvents(fluxoItens, monthStart, simDate, fluxoContas);
      let totalRec = 0, totalDesp = 0, totalInv = 0;
      monthEvents.forEach(e => {
        if (e.item.tipo === 'entrada') totalRec += e.item.valor;
        else if (e.item.subtipo === 'investimento' || e.item.subtipo === 'poupanca') totalInv += e.item.valor;
        else totalDesp += e.item.valor;
      });
      report += `💰 *Planejado para o mês:*\n`;
      report += `• Receitas: ${fmtBRL(totalRec)}\n`;
      report += `• Despesas: ${fmtBRL(totalDesp)}\n`;
      report += `• Investimentos: ${fmtBRL(totalInv)}\n`;
      report += `• Saldo: ${fmtBRL(totalRec - totalDesp - totalInv)}\n\n`;
    }
    if (data?.acompanhamento) {
      const updates = getUpdatesInPeriod(data.acompanhamento, monthStart, simDate);
      if (updates.length > 0) {
        report += `✅ *Atualizações do cronograma neste mês:*\n`;
        updates.forEach(u => report += `• ${u}\n`);
        report += '\n';
      }
      const micros = data.acompanhamento.microPassos || [];
      const concluidos = micros.filter(m => m.status === 'concluido' || m.status === 'Concluído').length;
      report += `📊 *Progresso geral:* ${concluidos}/${micros.length} micro passos concluídos\n\n`;
    }
    // Consolidado real do mês
    const monthStartReal = new Date(simDate.getFullYear(), simDate.getMonth(), 1);
    const lancMonth = getLancamentosReais(data, monthStartReal, simDate, fluxoContas);
    if (lancMonth.length > 0) {
      let totalEntradas = 0, totalSaidas = 0;
      report += `📝 *O que realmente aconteceu no mês:*\n`;
      lancMonth.forEach(l => {
        if (l.tipo === 'entrada') {
          report += `🟢 ${l.descricao}: ${fmtBRL(l.valor)}\n`;
          totalEntradas += l.valor;
        } else {
          if (l._isFatura) {
            report += `💳 ${l.descricao}: ${fmtBRL(l.valor)}\n`;
            l._faturaItens.forEach(fi => report += `   • ${fi.descricao}: ${fmtBRL(fi.valor)}\n`);
          } else {
            report += `🔴 ${l.descricao}: ${fmtBRL(l.valor)}\n`;
          }
          totalSaidas += l.valor;
        }
      });
      report += `\n*Total entradas: ${fmtBRL(totalEntradas)} | Total saídas: ${fmtBRL(totalSaidas)} | Saldo real: ${fmtBRL(totalEntradas - totalSaidas)}*\n\n`;
    }
  }

  // === INÍCIO DA SEMANA (Segunda) ===
  if (isSegunda) {
    hasContent = true;
    const weekStart = new Date(simDate);
    const weekEnd = new Date(simDate);
    weekEnd.setDate(weekEnd.getDate() + 4);
    let hasWeeklyContent = false;
    let weekSection = '';
    if (fluxoItens.length > 0) {
      const weekEvents = getAllFluxoEvents(fluxoItens, weekStart, weekEnd, fluxoContas);
      if (weekEvents.length > 0) {
        hasWeeklyContent = true;
        let totalRec = 0, totalDesp = 0;
        weekSection += `💰 *Movimentações previstas na semana:*\n`;
        weekEvents.forEach(e => {
          const tipo = e.item.tipo === 'entrada' ? '🟢' : '🔴';
          let label = e.item.nome;
          if (e.item._isFatura) {
            label += ' 💳';
          } else if (e.item.formaPagamento && cartoesMap[e.item.formaPagamento]) {
            label += ` (via cartão ${cartoesMap[e.item.formaPagamento].nome})`;
          }
          weekSection += `${tipo} ${e.date.toLocaleDateString('pt-BR',{weekday:'short',day:'numeric'})} - ${label}: ${fmtBRL(e.item.valor)}\n`;
          if (e.item.tipo === 'entrada') totalRec += e.item.valor; else totalDesp += e.item.valor;
        });
        weekSection += `\n*Saldo semanal previsto: ${fmtBRL(totalRec - totalDesp)}*\n\n`;
      }
    }
    if (data?.acompanhamento) {
      const cronoWeek = getCronoForPeriod(data.acompanhamento, weekStart, weekEnd);
      if (cronoWeek.length > 0) {
        hasWeeklyContent = true;
        weekSection += `📋 *Cronograma da semana:*\n`;
        cronoWeek.forEach(e => weekSection += `• ${e.desc}\n`);
        weekSection += '\n';
      }
    }
    if (hasWeeklyContent) {
      report += `*💪 PREVISÃO DA SEMANA*\n\n`;
      report += weekSection;
    } else {
      const msgIdx = Math.floor(Math.random() * MSGS_SEMANA_LIVRE.length);
      report += MSGS_SEMANA_LIVRE[msgIdx] + '\n\n';
    }
  }

  // === FINAL DA SEMANA (Sexta) ===
  if (isSexta) {
    hasContent = true;
    report += `*📊 RESUMO SEMANAL*\n\n`;
    const weekStart = new Date(simDate);
    weekStart.setDate(weekStart.getDate() - 4);
    if (fluxoItens.length > 0) {
      const weekEvents = getAllFluxoEvents(fluxoItens, weekStart, simDate, fluxoContas);
      if (weekEvents.length > 0) {
        let totalRec = 0, totalDesp = 0;
        report += `💰 *O que era esperado esta semana:*\n`;
        weekEvents.forEach(e => {
          const tipo = e.item.tipo === 'entrada' ? '🟢 Receber' : '🔴 Pagar';
          let label = e.item.nome;
          if (e.item._isFatura) {
            label += ' 💳';
          } else if (e.item.formaPagamento && cartoesMap[e.item.formaPagamento]) {
            label += ` (via cartão ${cartoesMap[e.item.formaPagamento].nome})`;
          }
          report += `${tipo}: ${label} - ${fmtBRL(e.item.valor)}\n`;
          if (e.item.tipo === 'entrada') totalRec += e.item.valor; else totalDesp += e.item.valor;
        });
        report += `\n`;
      } else {
        report += `Nenhuma movimentação prevista para esta semana.\n\n`;
      }
    }
    if (data?.acompanhamento) {
      const cronoWeek = getCronoForPeriod(data.acompanhamento, weekStart, simDate);
      if (cronoWeek.length > 0) {
        report += `📋 *Andamento do cronograma:*\n`;
        cronoWeek.forEach(e => report += `• ${e.desc}\n`);
        report += '\n';
      }
      const updates = getUpdatesInPeriod(data.acompanhamento, weekStart, simDate);
      if (updates.length > 0) {
        report += `✅ *Atualizações registradas na semana:*\n`;
        updates.forEach(u => report += `• ${u}\n`);
        report += '\n';
      }
    }
    // Consolidado real da semana
    const lancWeek = getLancamentosReais(data, weekStart, simDate, fluxoContas);
    if (lancWeek.length > 0) {
      let totalEntradas = 0, totalSaidas = 0;
      report += `📝 *O que realmente aconteceu essa semana:*\n`;
      lancWeek.forEach(l => {
        if (l.tipo === 'entrada') {
          report += `🟢 ${l.descricao}: ${fmtBRL(l.valor)}\n`;
          totalEntradas += l.valor;
        } else {
          if (l._isFatura) {
            report += `💳 ${l.descricao}: ${fmtBRL(l.valor)}\n`;
            l._faturaItens.forEach(fi => report += `   • ${fi.descricao}: ${fmtBRL(fi.valor)}\n`);
          } else {
            report += `🔴 ${l.descricao}: ${fmtBRL(l.valor)}\n`;
          }
          totalSaidas += l.valor;
        }
      });
      report += `\n*Entradas: ${fmtBRL(totalEntradas)} | Saídas: ${fmtBRL(totalSaidas)} | Saldo: ${fmtBRL(totalEntradas - totalSaidas)}*\n\n`;
    }
  }

  // === DATAS RELEVANTES ===
  if (data?.particularidades?.datas_relevantes) {
    const datasRel = data.particularidades.datas_relevantes;
    const datasHoje = datasRel.filter(dr => isDataRelevantOnDate(dr, simDate));
    if (datasHoje.length > 0) {
      hasContent = true;
      report += `🎯 *Lembrete(s) especial(is) de hoje:*\n`;
      datasHoje.forEach(dr => { report += `• ${dr.descricao}\n`; });
      report += '\n';
    }
  }

  // === EVENTOS ESPECÍFICOS DO DIA ===
  {
    let daySection = '';
    if (fluxoItens.length > 0) {
      const dayEvents = getFluxoEventsForDate(fluxoItens, simDate, fluxoContas);
      if (dayEvents.length > 0) {
        hasContent = true;
        daySection += `💰 *Movimentações de hoje:*\n`;
        dayEvents.forEach(item => {
          const tipo = item.tipo === 'entrada' ? '🟢 Receber' : '🔴 Pagar';
          if (item._isFatura) {
            daySection += `${tipo}: 💳 ${item.nome} - *${fmtBRL(item.valor)}*\n`;
            if (item._faturaItens && item._faturaItens.length > 0) {
              daySection += `  _Composição:_\n`;
              item._faturaItens.forEach(fi => { daySection += `  • ${fi.nome}: ${fmtBRL(fi.valor)}\n`; });
            }
          } else {
            let label = item.nome;
            if (item.formaPagamento && cartoesMap[item.formaPagamento]) {
              label += ` (via cartão ${cartoesMap[item.formaPagamento].nome})`;
            }
            daySection += `${tipo}: ${label} - ${fmtBRL(item.valor)}\n`;
          }
        });
        daySection += '\n';
      }
    }
    if (data?.acompanhamento) {
      const cronoEvents = getCronoEventsForDate(data.acompanhamento, simDate);
      if (cronoEvents.length > 0) {
        hasContent = true;
        daySection += `📋 *Cronograma - eventos de hoje:*\n`;
        cronoEvents.forEach(e => {
          if (e.tipo === 'inicio_micro') daySection += `🟡 Início: ${e.nome}\n`;
          else if (e.tipo === 'conclusao_micro') daySection += `🏁 Prazo de conclusão: ${e.nome}\n`;
          else if (e.tipo === 'prazo_proximo_micro') daySection += `⚠️ ${e.dias} dia(s) para concluir: ${e.nome}\n`;
          else if (e.tipo === 'metade_micro') daySection += `📍 Metade do prazo: ${e.nome}\n`;
          else if (e.tipo === 'inicio_macro') daySection += `🟡 Início de fase: ${e.nome}\n`;
          else if (e.tipo === 'conclusao_macro') daySection += `🏁 Prazo de fase: ${e.nome}\n`;
          else if (e.tipo === 'prazo_proximo_macro') daySection += `⚠️ ${e.dias} dia(s) para fase: ${e.nome}\n`;
        });
        daySection += '\n';
      }
    }
    if (daySection) {
      if (isInicioMes || isFinalMes || isSegunda || isSexta) {
        report += `---\n\n`;
        report += `*📅 EVENTOS DE HOJE (${simDate.toLocaleDateString('pt-BR')}):*\n\n`;
      }
      report += daySection;
    }
  }

  // === FECHAMENTO ===
  if (!hasContent) return null;
  report += buildDespedida({ isFinalMes, isSexta, isSegunda, isInicioMes, data, fluxoItens, fluxoContas, cartoesMap, simDate });
  return report;
}

// === HELPER: Build contextual despedida ===
function buildDespedida({ isFinalMes, isSexta, isSegunda, isInicioMes, data, fluxoItens, fluxoContas, cartoesMap, simDate }) {
  const temLancReais = data?.trackingData?.lancamentos?.length > 0;
  const temCrono = !!data?.acompanhamento;
  const temDatasRel = data?.particularidades?.datas_relevantes?.length > 0;
  let lancReaisPeriodo = [];
  if (temLancReais) {
    if (isSexta) {
      const ws = new Date(simDate); ws.setDate(ws.getDate() - 4);
      lancReaisPeriodo = getLancamentosReais(data, ws, simDate, fluxoContas);
    } else if (isFinalMes) {
      const ms = new Date(simDate.getFullYear(), simDate.getMonth(), 1);
      lancReaisPeriodo = getLancamentosReais(data, ms, simDate, fluxoContas);
    }
  }
  const temReais = lancReaisPeriodo.length > 0;
  let temPlanejado = false;
  if (fluxoItens.length > 0) {
    if (isSegunda) {
      const ws = new Date(simDate); const we = new Date(simDate); we.setDate(we.getDate() + 4);
      temPlanejado = getAllFluxoEvents(fluxoItens, ws, we, fluxoContas).length > 0;
    } else if (isSexta) {
      const ws = new Date(simDate); ws.setDate(ws.getDate() - 4);
      temPlanejado = getAllFluxoEvents(fluxoItens, ws, simDate, fluxoContas).length > 0;
    } else if (isFinalMes || isInicioMes) {
      const ms = new Date(simDate.getFullYear(), simDate.getMonth(), 1);
      const me = new Date(simDate.getFullYear(), simDate.getMonth() + 1, 0);
      temPlanejado = getAllFluxoEvents(fluxoItens, ms, me, fluxoContas).length > 0;
    } else {
      temPlanejado = getFluxoEventsForDate(fluxoItens, simDate, fluxoContas).length > 0;
    }
  }
  let temCronoAtivo = false;
  if (temCrono) {
    const micros = data.acompanhamento.microPassos || [];
    temCronoAtivo = micros.some(m => m.status !== 'concluido' && m.status !== 'Concluído');
  }
  let datasHoje = [];
  if (temDatasRel) {
    datasHoje = data.particularidades.datas_relevantes.filter(dr => isDataRelevantOnDate(dr, simDate));
  }
  if (temReais) {
    let totalEnt = 0, totalSai = 0;
    lancReaisPeriodo.forEach(l => { if (l.tipo === 'entrada') totalEnt += l.valor; else totalSai += l.valor; });
    const saldo = totalEnt - totalSai;
    if (isFinalMes) {
      if (saldo > 0) return `Mês fechou no positivo! Bora manter esse ritmo. Qualquer coisa, me chama! 💪`;
      if (saldo < 0) return `Mês apertado, mas faz parte. Vamos ajustar pro próximo mês. Conta comigo! 🤝`;
      return `Mês encerrado! Vamos analisar juntos e planejar o próximo. Me chama se precisar! 📊`;
    }
    if (isSexta) {
      if (saldo > 0) return `Semana no positivo! Bom descanso e bom fim de semana! 😊`;
      if (saldo < 0) return `Semana com bastante saída, mas tá tudo dentro do controle. Bom fim de semana! 🙌`;
      return `Semana encerrada! Descansa e qualquer coisa me chama. Bom fim de semana! ✌️`;
    }
  }
  if (datasHoje.length > 0) {
    const desc = datasHoje[0].descricao || '';
    if (desc.toLowerCase().includes('aniversário') || desc.toLowerCase().includes('aniversario')) {
      return `Aproveita esse dia especial! E qualquer coisa, tô por aqui! 🎉`;
    }
    return `Dia importante hoje! Espero que corra tudo bem. Me chama se precisar! 🙏`;
  }
  if (temPlanejado) {
    if (isFinalMes) return `Mês encerrado! Vamos ver como foi e planejar o próximo juntos. Conta comigo! 📈`;
    if (isSexta) return `Semana com movimentações! Me conta se correu tudo certo. Bom fim de semana! 🙌`;
    if (isSegunda) return `Semana com coisas previstas! Bora organizar tudo direitinho. Boa semana! 💪`;
    if (isInicioMes) return `Mês novo com bastante coisa pela frente! Vamos juntos. Boa semana! 🚀`;
    return `Dia com movimentações! Qualquer dúvida, me chama! 👊`;
  }
  if (temCronoAtivo) {
    if (isSexta) return `Cronograma andando! Bom descanso e bom fim de semana! 📋✌️`;
    if (isSegunda || isInicioMes) return `Semana com tarefas no cronograma! Bora avançar. Boa semana! 📋💪`;
    return `Cronograma em andamento! Qualquer dúvida, me chama! 📋`;
  }
  if (isFinalMes) return `Mês encerrado! Qualquer coisa, me chama. Bora pro próximo! 🤝`;
  if (isSexta) return `Bom fim de semana! Qualquer coisa, tô por aqui! ✌️`;
  if (isSegunda || isInicioMes) return `Boa semana! Qualquer coisa, me chama! 👊`;
  return `Qualquer coisa, me chama! 👊`;
}

// === HELPER FUNCTIONS (migradas integralmente) ===
function getFluxoPayload(data) {
  if (!data || !data.fluxo) return { itens: [], contas: [] };
  const fluxo = data.fluxo;
  let itens = [];
  let contas = [];
  if (fluxo.itens || fluxo.items) {
    itens = fluxo.itens || fluxo.items || [];
    contas = fluxo.contas || fluxo.accounts || [];
  } else if (Array.isArray(fluxo)) {
    const sim = fluxo.find(s => s.primary) || fluxo[0];
    if (sim && sim.payload) {
      itens = sim.payload.itens || sim.payload.items || [];
      contas = sim.payload.contas || sim.payload.accounts || [];
    }
  }
  return { itens, contas };
}

function buildCartoesMap(contas) {
  const map = {};
  if (!contas || !Array.isArray(contas)) return map;
  contas.forEach(acc => { if (acc.tipo === 'cartao') map[acc.id] = acc; });
  return map;
}

function getFluxoEventsForDate(itens, targetDate, contas) {
  const events = [];
  const target = new Date(targetDate);
  target.setHours(0,0,0,0);
  const cartoesMap = buildCartoesMap(contas);
  itens.forEach(item => {
    if (!item.recInicio) return;
    const isCartao = item.formaPagamento && cartoesMap[item.formaPagamento];
    if (isCartao) return;
    const occs = getOccurrences(item, target, target);
    if (occs.length > 0) events.push(item);
  });
  const faturas = getFaturasForDate(itens, contas, target);
  faturas.forEach(f => events.push(f));
  return events;
}

function getAllFluxoEvents(itens, start, end, contas) {
  const events = [];
  const cartoesMap = buildCartoesMap(contas);
  itens.forEach(item => {
    if (!item.recInicio) return;
    const isCartao = item.formaPagamento && cartoesMap[item.formaPagamento];
    if (isCartao) return;
    const occs = getOccurrences(item, start, end);
    occs.forEach(d => events.push({ item, date: d }));
  });
  const faturasEvents = getAllFaturasInPeriod(itens, contas, start, end);
  faturasEvents.forEach(f => events.push(f));
  events.sort((a, b) => a.date - b.date);
  return events;
}

function getOccurrences(item, start, end) {
  const dates = [];
  if (!item.recInicio) return dates;
  const refDate = new Date(item.recInicio + 'T00:00');
  if (item.recTipo === 'nao' || !item.recTipo) {
    if (refDate >= start && refDate <= end) dates.push(refDate);
    return dates;
  }
  let count = 0;
  let maxOcc = Infinity;
  let endDate = new Date(end);
  if (item.recFimTipo === 'ocorrencias') maxOcc = item.recFimQty || Infinity;
  if (item.recFimTipo === 'data' && item.recFimData) {
    const fimD = new Date(item.recFimData + 'T00:00');
    if (fimD < endDate) endDate = fimD;
  }
  let cur = new Date(refDate);
  while (cur < start) {
    cur = nextOccurrence(cur, item);
    count++;
    if (count >= maxOcc) return dates;
  }
  while (cur <= endDate && count < maxOcc) {
    if (cur >= start) dates.push(new Date(cur));
    cur = nextOccurrence(cur, item);
    count++;
  }
  return dates;
}

function nextOccurrence(cur, item) {
  const next = new Date(cur);
  const qty = item.recQty || 1;
  if (item.recTipo === 'dias') next.setDate(next.getDate() + qty);
  else if (item.recTipo === 'uteis') {
    let added = 0;
    while (added < qty) { next.setDate(next.getDate() + 1); if (next.getDay() !== 0 && next.getDay() !== 6) added++; }
  }
  else if (item.recTipo === 'semanas') next.setDate(next.getDate() + qty * 7);
  else if (item.recTipo === 'quinzenas') next.setDate(next.getDate() + qty * 15);
  else if (item.recTipo === 'meses') next.setMonth(next.getMonth() + qty);
  else next.setDate(next.getDate() + 1);
  return next;
}

function getFaturaKey(purchaseDate, cartao) {
  const dia = purchaseDate.getDate();
  const mes = purchaseDate.getMonth();
  const ano = purchaseDate.getFullYear();
  let fatMes, fatAno;
  if (dia > cartao.fechamento) {
    fatMes = mes + 1; fatAno = ano;
    if (fatMes > 11) { fatMes = 0; fatAno++; }
  } else {
    fatMes = mes; fatAno = ano;
  }
  const maxDia = new Date(fatAno, fatMes + 1, 0).getDate();
  const vencDia = Math.min(cartao.vencimento, maxDia);
  const vencDate = new Date(fatAno, fatMes, vencDia);
  return { key: fatAno + '-' + String(fatMes + 1).padStart(2, '0'), vencDate };
}

function buildFaturasMap(itens, contas, start, end) {
  const cartoesMap = buildCartoesMap(contas);
  const faturasMap = {};
  const searchStart = new Date(start);
  searchStart.setDate(searchStart.getDate() - 60);
  const searchEnd = new Date(end);
  searchEnd.setDate(searchEnd.getDate() + 60);
  itens.forEach(item => {
    if (!item.recInicio) return;
    if (!item.formaPagamento || !cartoesMap[item.formaPagamento]) return;
    const cartao = cartoesMap[item.formaPagamento];
    const occs = getOccurrences(item, searchStart, searchEnd);
    occs.forEach(d => {
      const fat = getFaturaKey(d, cartao);
      if (fat.vencDate < start || fat.vencDate > end) return;
      if (!faturasMap[item.formaPagamento]) faturasMap[item.formaPagamento] = {};
      if (!faturasMap[item.formaPagamento][fat.key]) {
        faturasMap[item.formaPagamento][fat.key] = { vencDate: fat.vencDate, total: 0, itens: [] };
      }
      faturasMap[item.formaPagamento][fat.key].total += item.valor;
      faturasMap[item.formaPagamento][fat.key].itens.push({ nome: item.nome, valor: item.valor, data: new Date(d) });
    });
  });
  return faturasMap;
}

function getFaturasForDate(itens, contas, targetDate) {
  const target = new Date(targetDate);
  target.setHours(0,0,0,0);
  const targetISO = isoDate(target);
  const cartoesMap = buildCartoesMap(contas);
  const faturasMap = buildFaturasMap(itens, contas, target, target);
  const results = [];
  Object.keys(faturasMap).forEach(cartaoId => {
    const cartao = cartoesMap[cartaoId];
    const faturas = faturasMap[cartaoId];
    Object.keys(faturas).forEach(fatKey => {
      const fat = faturas[fatKey];
      if (isoDate(fat.vencDate) === targetISO) {
        results.push({
          tipo: 'saida', subtipo: 'fatura',
          nome: 'Fatura ' + cartao.nome + ' (' + fatKey + ')',
          valor: fat.total, _isFatura: true, _cartaoNome: cartao.nome, _faturaItens: fat.itens
        });
      }
    });
  });
  return results;
}

function getAllFaturasInPeriod(itens, contas, start, end) {
  const cartoesMap = buildCartoesMap(contas);
  const faturasMap = buildFaturasMap(itens, contas, start, end);
  const results = [];
  Object.keys(faturasMap).forEach(cartaoId => {
    const cartao = cartoesMap[cartaoId];
    const faturas = faturasMap[cartaoId];
    Object.keys(faturas).forEach(fatKey => {
      const fat = faturas[fatKey];
      const fatItem = {
        tipo: 'saida', subtipo: 'fatura',
        nome: 'Fatura ' + cartao.nome + ' (' + fatKey + ')',
        valor: fat.total, _isFatura: true, _cartaoNome: cartao.nome, _faturaItens: fat.itens
      };
      results.push({ item: fatItem, date: fat.vencDate });
    });
  });
  return results;
}

// --- Cronograma helpers ---
function getCronoEventsForDate(acomp, targetDate) {
  const events = [];
  const target = new Date(targetDate);
  target.setHours(0,0,0,0);
  const targetISO = isoDate(target);
  const micros = acomp.microPassos || [];
  micros.forEach(m => {
    if (m.status === 'concluido' || m.status === 'Concluído') return;
    const dates = getItemDates(m, acomp);
    if (!dates) return;
    const { start, end } = dates;
    const label = m.desc || m.nome || 'Micro passo';
    if (start && isoDate(start) === targetISO) events.push({ tipo: 'inicio_micro', nome: label });
    if (end && isoDate(end) === targetISO) events.push({ tipo: 'conclusao_micro', nome: label });
    if (end) {
      const diff = Math.round((end - target) / 86400000);
      if (diff > 0 && diff <= 3) events.push({ tipo: 'prazo_proximo_micro', nome: label, dias: diff });
    }
    if (start && end) {
      const total = Math.round((end - start) / 86400000);
      const elapsed = Math.round((target - start) / 86400000);
      if (total > 2 && elapsed === Math.floor(total / 2)) events.push({ tipo: 'metade_micro', nome: label });
    }
  });
  const macros = acomp.macroPassos || [];
  macros.forEach(m => {
    if (m.status === 'concluido' || m.status === 'Concluído') return;
    const dates = getItemDates(m, acomp);
    if (!dates) return;
    const { start, end } = dates;
    const label = m.nome || m.desc || 'Macro';
    if (start && isoDate(start) === targetISO) events.push({ tipo: 'inicio_macro', nome: label });
    if (end && isoDate(end) === targetISO) events.push({ tipo: 'conclusao_macro', nome: label });
    if (end) {
      const diff = Math.round((end - target) / 86400000);
      if (diff > 0 && diff <= 3) events.push({ tipo: 'prazo_proximo_macro', nome: label, dias: diff });
    }
  });
  return events;
}

function getCronoForMonth(acomp, simDate) {
  const monthStart = new Date(simDate.getFullYear(), simDate.getMonth(), 1);
  const monthEnd = new Date(simDate.getFullYear(), simDate.getMonth() + 1, 0);
  return getCronoForPeriod(acomp, monthStart, monthEnd);
}

function getCronoForPeriod(acomp, start, end) {
  const results = [];
  const micros = acomp.microPassos || [];
  const macros = acomp.macroPassos || [];
  micros.forEach(m => {
    if (m.status === 'concluido' || m.status === 'Concluído') return;
    const dates = getItemDates(m, acomp);
    if (!dates) return;
    const label = m.desc || m.nome || 'Micro passo';
    if (dates.start && dates.start >= start && dates.start <= end) {
      results.push({ desc: `Iniciar: "${label}" (${dates.start.toLocaleDateString('pt-BR')})` });
    }
    if (dates.end && dates.end >= start && dates.end <= end) {
      results.push({ desc: `Concluir: "${label}" (${dates.end.toLocaleDateString('pt-BR')})` });
    }
  });
  macros.forEach(m => {
    if (m.status === 'concluido' || m.status === 'Concluído') return;
    const dates = getItemDates(m, acomp);
    if (!dates) return;
    const label = m.nome || m.desc || 'Macro';
    if (dates.start && dates.start >= start && dates.start <= end) {
      results.push({ desc: `Fase inicia: "${label}" (${dates.start.toLocaleDateString('pt-BR')})` });
    }
    if (dates.end && dates.end >= start && dates.end <= end) {
      results.push({ desc: `Fase encerra: "${label}" (${dates.end.toLocaleDateString('pt-BR')})` });
    }
  });
  return results;
}

function getUpdatesInPeriod(acomp, start, end) {
  const results = [];
  const micros = acomp.microPassos || [];
  const objetivos = acomp.objetivos || [];
  micros.forEach(m => {
    if (!m.updates) return;
    const label = m.desc || m.nome || 'Micro passo';
    m.updates.forEach(u => {
      const d = new Date(u.data + 'T00:00:00');
      if (d >= start && d <= end) {
        results.push(`${label}: ${u.texto || (u.concluido ? 'Marcado como concluído' : 'Atualização registrada')}`);
      }
    });
  });
  objetivos.forEach(o => {
    if (!o.updates) return;
    o.updates.forEach(u => {
      const d = new Date(u.data + 'T00:00:00');
      if (d >= start && d <= end) {
        results.push(`Objetivo "${o.nome}": valor atualizado para ${fmtBRL(u.valor || 0)}`);
      }
    });
  });
  return results;
}

function getItemDates(item, acomp) {
  const tipo = item.prazo_tipo;
  if (tipo === 'duracao') {
    let startDate = item.prazo_inicio ? new Date(item.prazo_inicio + 'T00:00:00') : null;
    if (!startDate) return null;
    const endDate = calcEndDate(startDate, item.dur_qty || 0, item.dur_unit || 'dias');
    return { start: startDate, end: endDate };
  } else if (tipo === 'datas') {
    const s = item.prazo_inicio ? new Date(item.prazo_inicio + 'T00:00:00') : null;
    const e = item.prazo_fim ? new Date(item.prazo_fim + 'T00:00:00') : null;
    return { start: s, end: e };
  } else if (tipo === 'previsao') {
    const e = item.prazo_fim ? new Date(item.prazo_fim + 'T00:00:00') : null;
    return { start: null, end: e };
  }
  if (item.prazo) {
    const endDate = new Date(item.prazo + 'T00:00:00');
    let startDate = item.inicio ? new Date(item.inicio + 'T00:00:00') : null;
    return { start: startDate, end: endDate };
  }
  return null;
}

function calcEndDate(start, qty, unit) {
  if (!start || !qty) return null;
  const d = new Date(start);
  if (unit === 'dias') d.setDate(d.getDate() + qty);
  else if (unit === 'uteis') {
    let added = 0;
    while (added < qty) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  }
  else if (unit === 'semanas') d.setDate(d.getDate() + qty * 7);
  else if (unit === 'meses') d.setMonth(d.getMonth() + qty);
  return d;
}

// --- Datas Relevantes (recurrence model) ---
function isDataRelevantOnDate(dr, targetDate) {
  if (!dr.data) return false;
  const target = new Date(targetDate);
  target.setHours(0,0,0,0);
  const targetISO = isoDate(target);
  const drDate = new Date(dr.data + 'T00:00:00');
  const rec = dr.recorrencia || {};
  if (rec.tipo === 'repete') {
    const inicio = rec.inicio ? new Date(rec.inicio + 'T00:00:00') : drDate;
    if (target < inicio) return false;
    if (rec.fim_tipo === 'data' && rec.fim_data) {
      const fimD = new Date(rec.fim_data + 'T00:00:00');
      if (target > fimD) return false;
    }
    const qty = rec.frequencia_qty || 1;
    const unit = rec.frequencia_unit || 'meses';
    let cur = new Date(inicio);
    let count = 0;
    const maxOcc = (rec.fim_tipo === 'ocorrencias' && rec.fim_ocorrencias) ? rec.fim_ocorrencias : 10000;
    while (cur <= target && count < maxOcc) {
      if (isoDate(cur) === targetISO) return true;
      const next = new Date(cur);
      if (unit === 'dias') next.setDate(next.getDate() + qty);
      else if (unit === 'dias_uteis') {
        let added = 0;
        while (added < qty) { next.setDate(next.getDate() + 1); if (next.getDay() !== 0 && next.getDay() !== 6) added++; }
      }
      else if (unit === 'semanas') next.setDate(next.getDate() + qty * 7);
      else if (unit === 'quinzenas') next.setDate(next.getDate() + qty * 15);
      else if (unit === 'meses') next.setMonth(next.getMonth() + qty);
      else if (unit === 'anos') next.setFullYear(next.getFullYear() + qty);
      else next.setDate(next.getDate() + qty);
      cur = next;
      count++;
    }
    return false;
  }
  if (dr.recorrente) {
    return dr.data.slice(5) === targetISO.slice(5);
  }
  return dr.data === targetISO;
}

// --- Lançamentos Reais (trackingData) ---
function getLancamentosReais(data, start, end, contas) {
  if (!data || !data.trackingData || !data.trackingData.lancamentos) return [];
  const lancamentos = data.trackingData.lancamentos;
  const cartoesMap = buildCartoesMap(contas);
  const startISO = isoDate(start);
  const endISO = isoDate(end);
  const resultado = [];
  const faturas = {};
  lancamentos.forEach(l => {
    if (!l.data || !l.valor) return;
    const val = Math.abs(parseFloat(l.valor) || 0);
    if (!val) return;
    let cartao = null;
    if (l.pagamento) {
      Object.keys(cartoesMap).forEach(cid => {
        const c = cartoesMap[cid];
        if (c.nome === l.pagamento || c.id === l.pagamento) cartao = c;
      });
    }
    if (cartao && l.tipo !== 'entrada') {
      const purchaseDate = new Date(l.data + 'T00:00:00');
      const fat = getFaturaKey(purchaseDate, cartao);
      const fatVencISO = isoDate(fat.vencDate);
      if (fatVencISO >= startISO && fatVencISO <= endISO) {
        const key = cartao.id + '_' + fat.key;
        if (!faturas[key]) faturas[key] = { cartaoNome: cartao.nome, fatKey: fat.key, total: 0, itens: [] };
        faturas[key].total += val;
        faturas[key].itens.push({ descricao: l.descricao || 'Sem descrição', valor: val });
      }
    } else {
      if (l.data >= startISO && l.data <= endISO) {
        resultado.push({ tipo: l.tipo, descricao: l.descricao || 'Sem descrição', valor: val, data: l.data, pagamento: l.pagamento || '' });
      }
    }
  });
  Object.values(faturas).forEach(fat => {
    resultado.push({ tipo: 'despesa', descricao: `Fatura ${fat.cartaoNome} (${fat.fatKey})`, valor: fat.total, data: '', pagamento: 'cartão', _isFatura: true, _faturaItens: fat.itens });
  });
  return resultado;
}

// --- Utility ---
function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtBRL(v) {
  return 'R$ ' + (v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// Inicializar
document.addEventListener("DOMContentLoaded", initializeDashboard);
