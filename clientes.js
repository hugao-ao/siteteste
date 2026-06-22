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
// New Modals
const planoRefModal = document.getElementById("plano-ref-modal");
const mensalidadeModal = document.getElementById("mensalidade-modal");
const situacaoModal = document.getElementById("situacao-modal");
const leadModal = document.getElementById("lead-modal");

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

// --- Estado para Leads e Financeiro Comercial ---
let allLeads = [];
let allPlanoRefParcelas = {}; // { clienteId: [parcelas] }
let _financialSummary = { totalVendido: 0, totalRecebido: 0, totalPendente: 0, totalMensalidades: 0 };

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
        const diagModal = document.getElementById('diagnostico-modal');
        if (event.target == diagModal) {
            diagModal.style.display = "none";
        }
    });
    // Diagnostico modal close button
    const diagCloseBtn = document.getElementById('diag-modal-close-btn');
    if (diagCloseBtn) {
        diagCloseBtn.addEventListener('click', () => { document.getElementById('diagnostico-modal').style.display = 'none'; });
    }
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

    const msgWhatsBtn = document.getElementById('msg-whatsapp-btn');

    if (closeMsgModalBtn) closeMsgModalBtn.addEventListener('click', () => { mensagemModal.style.display = 'none'; });
    if (msgCancelBtn) msgCancelBtn.addEventListener('click', () => { mensagemModal.style.display = 'none'; });
    if (msgSaveBtn) msgSaveBtn.addEventListener('click', saveMensagem);
    if (generateBtn) generateBtn.addEventListener('click', handleGenerateReport);
    if (msgWhatsBtn) msgWhatsBtn.addEventListener('click', () => { if (currentMsgClienteId) openWhatsApp(currentMsgClienteId); });
    window.addEventListener('click', (e) => { if (e.target === mensagemModal) mensagemModal.style.display = 'none'; });

    // --- Listeners para novos modais ---
    // Plano Ref Modal
    const planoRefCloseBtn = document.getElementById('plano-ref-close-btn');
    if (planoRefCloseBtn) planoRefCloseBtn.addEventListener('click', () => { planoRefModal.style.display = 'none'; });
    // Mensalidade Modal
    const mensalidadeCloseBtn = document.getElementById('mensalidade-close-btn');
    if (mensalidadeCloseBtn) mensalidadeCloseBtn.addEventListener('click', () => { mensalidadeModal.style.display = 'none'; });
    // Situacao Modal
    const situacaoCloseBtn = document.getElementById('situacao-close-btn');
    if (situacaoCloseBtn) situacaoCloseBtn.addEventListener('click', () => { situacaoModal.style.display = 'none'; });
    // Lead Modal
    const leadCloseBtn = document.getElementById('lead-close-btn');
    if (leadCloseBtn) leadCloseBtn.addEventListener('click', () => { leadModal.style.display = 'none'; });
    const leadCancelBtn = document.getElementById('lead-cancel-btn');
    if (leadCancelBtn) leadCancelBtn.addEventListener('click', () => { leadModal.style.display = 'none'; });
    const leadSaveBtn = document.getElementById('lead-save-btn');
    if (leadSaveBtn) leadSaveBtn.addEventListener('click', saveLead);
    // Add Lead button
    const addLeadBtn = document.getElementById('add-lead-btn');
    if (addLeadBtn) addLeadBtn.addEventListener('click', openLeadModal);
    // Filter tipo
    const filterTipo = document.getElementById('filter-tipo');
    if (filterTipo) filterTipo.addEventListener('change', applyTipoFilter);
    // Close modals on backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === planoRefModal) planoRefModal.style.display = 'none';
        if (e.target === mensalidadeModal) mensalidadeModal.style.display = 'none';
        if (e.target === situacaoModal) situacaoModal.style.display = 'none';
        if (e.target === leadModal) leadModal.style.display = 'none';
    });

    // Carrega clientes
    console.log(`clientes.js: Chamando loadClients com filtro de projeto URL: ${filterProjectFromUrl || 'Nenhum'}`);
    loadClients(filterProjectFromUrl);
    // Refresh summary button
    const refreshSummaryBtn = document.getElementById('refresh-summary-btn');
    if (refreshSummaryBtn) {
        refreshSummaryBtn.addEventListener('click', async () => {
            refreshSummaryBtn.querySelector('i').classList.add('fa-spin');
            // Reset summary data
            _summaryData = { patrimonios: [], dividas: [], rendas: [], despesas: [], poupancas: [], saldos: [], pendConsultor: 0, pendCliente: 0 };
            _financialSummary = { totalVendido: 0, totalRecebido: 0, totalPendente: 0, totalMensalidades: 0 };
            _summaryPendingCount = 0;
            // Re-fetch all data for visible client rows
            const rows = clientsTableBody ? clientsTableBody.querySelectorAll('tr[data-client-id]') : [];
            for (const row of rows) {
                if (row.dataset.tipo === 'lead') continue;
                const cid = row.dataset.clientId;
                _summaryPendingCount += 2;
                fetchPendentes(cid, row);
                fetchFinanceiros(cid, row);
                const planoVal = parseFloat(row.dataset.planoRefValor || '0');
                const mensalVal = parseFloat(row.dataset.mensalidade || '0');
                fetchPlanoRefCell(cid, planoVal, mensalVal, row);
            }
            // Wait a bit then stop spinning
            setTimeout(() => { refreshSummaryBtn.querySelector('i').classList.remove('fa-spin'); }, 2000);
        });
    }

    // Pendencias cell click listener (delegated)
    if (clientsTableBody) {
        clientsTableBody.addEventListener('click', (e) => {
            const pendCell = e.target.closest('.pend-cell.clickable');
            if (pendCell) {
                const clientId = pendCell.dataset.clientId;
                const pendType = pendCell.dataset.pendType;
                const row = pendCell.closest('tr');
                const clientName = row ? (row.querySelector('.client-name')?.value || row.querySelector('td')?.textContent?.trim() || '') : '';
                openPendenciasModal(clientId, clientName, pendType);
                return;
            }

            // Patrimonio cell click
            const patCell = e.target.closest('.fin-patrimonio');
            if (patCell) {
                const clientId = patCell.dataset.clientId;
                const row = patCell.closest('tr');
                const clientName = row ? (row.querySelector('.client-name')?.value || row.querySelector('td')?.textContent?.trim() || '') : '';
                openPatrimonioModal(clientId, clientName);
                return;
            }

            // Dividas cell click
            const divCell = e.target.closest('.fin-dividas');
            if (divCell) {
                const clientId = divCell.dataset.clientId;
                const row = divCell.closest('tr');
                const clientName = row ? (row.querySelector('.client-name')?.value || row.querySelector('td')?.textContent?.trim() || '') : '';
                openDividasModal(clientId, clientName);
                return;
            }

            // Tipo cell click - open CPF/WhatsApp sync modal
            const tipoCell = e.target.closest('.tipo-cell');
            if (tipoCell) {
                const clientId = tipoCell.dataset.clientId;
                const row = tipoCell.closest('tr');
                const clientName = row ? (row.querySelector('.client-name')?.value || row.querySelector('td')?.textContent?.trim() || '') : '';
                openTipoSyncModal(clientId, clientName);
                return;
            }
        });
    }

    // Close new modals
    ['pendencias', 'objetivos', 'particularidades', 'patrimonio', 'dividas', 'tipo-sync'].forEach(name => {
        const modal = document.getElementById(name + '-modal');
        const closeBtn = document.getElementById(name + '-close-btn');
        if (modal && closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                // Clear iframe src when closing iframe modals
                if (name === 'patrimonio' || name === 'dividas') {
                    const iframe = document.getElementById(name + '-iframe');
                    if (iframe) iframe.src = '';
                }
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    if (name === 'patrimonio' || name === 'dividas') {
                        const iframe = document.getElementById(name + '-iframe');
                        if (iframe) iframe.src = '';
                    }
                }
            });
        }
    });

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
        clientsTableBody.innerHTML = '<tr><td colspan="17">Carregando clientes...</td></tr>';
        console.log("clientes.js: Construindo query Supabase...");
        let query = supabase.from('clientes').select('*, formularios_clientes(count), diagnosticos_financeiros(count), plano_ref_valor_total, mensalidade');

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
            clientsTableBody.innerHTML = '<tr><td colspan="17" style="text-align: center;">Nenhum cliente encontrado.</td></tr>';
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
             clientsTableBody.innerHTML = '<tr><td colspan="17" style="text-align: center;">Nenhum cliente visível para você.</td></tr>';
             return;
        }

        // Reset summary data
        _summaryData = { patrimonios: [], dividas: [], rendas: [], despesas: [], poupancas: [], saldos: [], pendConsultor: 0, pendCliente: 0 };
        _financialSummary = { totalVendido: 0, totalRecebido: 0, totalPendente: 0, totalMensalidades: 0 };
        _summaryPendingCount = 0;
        _summaryTotalClients = filteredClients.length;

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
            row.dataset.tipo = 'cliente';
            row.dataset.originalNome = client.nome;
            row.dataset.originalWhatsapp = whatsapp;
            row.dataset.originalProjeto = client.projeto;
            row.dataset.originalVisibility = client.visibility || 'INDIVIDUAL';
            row.dataset.originalAssignedTo = client.assigned_to_user_id || '';
            row.dataset.originalLogin = client.login || '';
            row.dataset.originalSenha = client.senha || '';
            row.dataset.originalSituacao = client.situacao || 'ATIVO';

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
                <td data-label="Tipo" class="tipo-cell" data-client-id="${client.id}" style="cursor:pointer;">
                    <span class="tipo-badge tipo-cliente">CLIENTE</span>
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
                <td data-label="Dashboard" style="white-space:nowrap;">
                    <button class="view-forms-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Ver Formulário" style="margin-right:4px;">
                        <i class="fa-solid fa-file-lines"></i> ${client.formularios_clientes[0].count}
                    </button>
                    <button class="view-diag-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Ver Diagnóstico">
                        <i class="fa-solid fa-stethoscope"></i>${client.diagnosticos_financeiros && client.diagnosticos_financeiros[0] && client.diagnosticos_financeiros[0].count > 0 ? ' ' + client.diagnosticos_financeiros[0].count : ''}
                    </button>
                </td>
                <td data-label="Plano Ref." class="plano-ref-cell" data-client-id="${client.id}">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Mensalidade" class="mensalidade-cell" data-client-id="${client.id}">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Últ. Reunião" class="ult-reuniao-cell">
                    <span class="dias-loading">...</span>
                </td>
                <td data-label="Pend. Consultor" class="pend-cell clickable" data-client-id="${client.id}" data-pend-type="consultor">
                    <span class="pend-loading">...</span>
                </td>
                <td data-label="Pend. Cliente" class="pend-cell clickable" data-client-id="${client.id}" data-pend-type="cliente">
                    <span class="pend-loading">...</span>
                </td>
                <td data-label="Patrimônio" class="fin-cell fin-patrimonio" data-client-id="${client.id}" style="cursor:pointer;">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Dívidas" class="fin-cell fin-dividas" data-client-id="${client.id}" style="cursor:pointer;">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Fluxo Mensal" class="fin-cell fin-fluxo">
                    <span class="fin-loading">...</span>
                </td>
                <td data-label="Situação" style="text-align:center;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
                        <select class="situacao-select ${client.situacao === 'EM_HIATO' ? 'sit-hiato' : client.situacao === 'PAROU' ? 'sit-parou' : 'sit-ativo'}" data-client-id="${client.id}" ${!canEdit ? 'disabled' : ''}>
                            <option value="ATIVO" ${(!client.situacao || client.situacao === 'ATIVO') ? 'selected' : ''}>Ativo</option>
                            <option value="EM_HIATO" ${client.situacao === 'EM_HIATO' ? 'selected' : ''}>Em Hiato</option>
                            <option value="PAROU" ${client.situacao === 'PAROU' ? 'selected' : ''}>Parou</option>
                        </select>
                        <button class="situacao-info-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Ver dados Cyclopay" style="background:none;border:none;cursor:pointer;color:var(--theme-text-muted);font-size:0.75rem;padding:2px;">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </td>
                <td data-label="Ações">
                    <button class="msg-action-btn edit-msg-btn" data-client-id="${client.id}" title="Editar/Gerar mensagem WhatsApp">
                      <i class="fas fa-comment-alt"></i>
                    </button>
                    <button class="msg-action-btn system-btn" data-client-id="${client.id}" title="Acessar sistema do cliente">
                      <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="obj-action-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Objetivos Financeiros">
                      <i class="fas fa-bullseye"></i>
                    </button>
                    <button class="partic-action-btn" data-client-id="${client.id}" data-client-name="${sanitizeInput(client.nome)}" title="Particularidades">
                      <i class="fas fa-fingerprint"></i>
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
            fetchPlanoRefCell(client.id, client.plano_ref_valor_total, client.mensalidade, row);
            _summaryPendingCount += 2; // 2 fetches contribute to summary (pendentes + financeiros)
        }

        // Salvar referência dos clientes para mensagens WhatsApp
        allClientes = filteredClients;
        
        // Verificar conflitos de CPF/WhatsApp em background
        checkDataConflicts(filteredClients);

        // Carregar leads e renderizá-los na tabela
        await loadAndRenderLeads(filterProject);
        
        // Carregar dados para mensagens em background (mesma ordem do original)
        await loadMensagens();
        await loadSaudacoes();
        loadAllClientData();

    } catch (error) {
        console.error("clientes.js: Erro GERAL em loadClients:", error);
        clientsTableBody.innerHTML = `<tr><td colspan="17" style="color: red; text-align: center;">Erro ao carregar clientes: ${error.message}</td></tr>`;
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
            cellCliente.innerHTML = `<span class="pend-num ${pendCliente > 0 ? 'pend-active' : 'pend-zero'}">${pendCliente}</span><span class="pend-label">${pendCliente !== 1 ? 'itens' : 'item'}</span>`;
            registerSummaryData('pendConsultor', pendConsultor);
            registerSummaryData('pendCliente', pendCliente);
        } else {
            cellConsultor.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
            cellCliente.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
        }
    } catch (err) {
        console.warn('fetchPendentes error for client ' + clienteId, err);
        cellConsultor.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
        cellCliente.innerHTML = '<span style="color:var(--theme-text-muted);">--</span>';
    }
    _summaryPendingCount--;
    if (_summaryPendingCount <= 0) renderDashboardSummary();
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
            registerSummaryData('patrimonio', patrimonio);
            registerSummaryData('divida', dividas);
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
                registerSummaryData('renda', renda);
                registerSummaryData('despesa', despesas);
                registerSummaryData('poupanca', poupanca);
                registerSummaryData('saldo', sobra);
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
    _summaryPendingCount--;
    if (_summaryPendingCount <= 0) renderDashboardSummary();
}

// --- Atualizar Painel de Resumo ---
let _summaryData = { patrimonios: [], dividas: [], rendas: [], despesas: [], poupancas: [], saldos: [], pendConsultor: 0, pendCliente: 0 };
let _summaryPendingCount = 0;
let _summaryTotalClients = 0;

function registerSummaryData(type, value) {
    if (type === 'patrimonio' && value > 0) _summaryData.patrimonios.push(value);
    else if (type === 'divida' && value > 0) _summaryData.dividas.push(value);
    else if (type === 'renda' && value > 0) _summaryData.rendas.push(value);
    else if (type === 'despesa' && value > 0) _summaryData.despesas.push(value);
    else if (type === 'poupanca' && value > 0) _summaryData.poupancas.push(value);
    else if (type === 'saldo') _summaryData.saldos.push(value);
    else if (type === 'pendConsultor') _summaryData.pendConsultor += value;
    else if (type === 'pendCliente') _summaryData.pendCliente += value;
}

function renderDashboardSummary() {
    const fmt = (v) => v >= 1000 ? (v/1000).toFixed(1) + 'k' : v.toFixed(0);
    const fmtR = (v) => 'R$ ' + fmt(v);
    const avg = (arr) => arr.length > 0 ? arr.reduce((s,v) => s+v, 0) / arr.length : 0;
    const sum = (arr) => arr.reduce((s,v) => s+v, 0);

    const elPat = document.getElementById('sum-patrimonio');
    const elDiv = document.getElementById('sum-dividas');
    const elRen = document.getElementById('sum-renda');
    const elDes = document.getElementById('sum-despesas');
    const elPou = document.getElementById('sum-poupanca');
    const elSal = document.getElementById('sum-saldo');
    const elSit = document.getElementById('sum-situacao');
    const elPen = document.getElementById('sum-pendentes');

    if (elPat) elPat.textContent = _summaryData.patrimonios.length > 0 ? fmtR(sum(_summaryData.patrimonios)) : '--';
    if (elDiv) elDiv.textContent = _summaryData.dividas.length > 0 ? fmtR(sum(_summaryData.dividas)) : '--';
    if (elRen) elRen.textContent = _summaryData.rendas.length > 0 ? fmtR(avg(_summaryData.rendas)) : '--';
    if (elDes) elDes.textContent = _summaryData.despesas.length > 0 ? fmtR(avg(_summaryData.despesas)) : '--';
    if (elPou) elPou.textContent = _summaryData.poupancas.length > 0 ? fmtR(avg(_summaryData.poupancas)) : '--';
    if (elSal) elSal.textContent = _summaryData.saldos.length > 0 ? fmtR(avg(_summaryData.saldos)) : '--';

    // Contagem por situa\u00e7\u00e3o
    const rows = clientsTableBody ? clientsTableBody.querySelectorAll('tr[data-client-id]') : [];
    let ativos = 0, hiato = 0, parou = 0;
    rows.forEach(r => {
        const sel = r.querySelector('.situacao-select');
        if (sel) {
            if (sel.value === 'EM_HIATO') hiato++;
            else if (sel.value === 'PAROU') parou++;
            else ativos++;
        } else ativos++;
    });
    if (elSit) elSit.innerHTML = '<span style="color:#22c55e;">' + ativos + '</span> / <span style="color:#f59e0b;">' + hiato + '</span> / <span style="color:#ef4444;">' + parou + '</span>';
    if (elPen) elPen.innerHTML = '<span style="color:#f59e0b;">' + _summaryData.pendConsultor + '</span> / <span style="color:#60a5fa;">' + _summaryData.pendCliente + '</span>';

    // Contagem de badges (clientes com mensagem para enviar)
    const elBadges = document.getElementById('sum-badges');
    if (elBadges) {
        const badgeCount = clientsTableBody ? clientsTableBody.querySelectorAll('.edit-msg-btn .badge').length : 0;
        elBadges.innerHTML = badgeCount > 0 ? '<span style="color:#ef4444;">' + badgeCount + '</span>' : '0';
    }

    // --- Financial Summary (Plano Ref + Mensalidades) ---
    const elVendido = document.getElementById('sum-vendido');
    const elRecebido = document.getElementById('sum-recebido');
    const elPendenteRef = document.getElementById('sum-pendente-ref');
    const elMensalidades = document.getElementById('sum-mensalidades');
    if (elVendido) elVendido.textContent = _financialSummary.totalVendido > 0 ? fmtR(_financialSummary.totalVendido) : '--';
    if (elRecebido) elRecebido.textContent = _financialSummary.totalRecebido > 0 ? fmtR(_financialSummary.totalRecebido) : '--';
    if (elPendenteRef) {
        const pendente = _financialSummary.totalPendente;
        if (pendente > 0) {
            elPendenteRef.innerHTML = '<span class="sum-alert">' + fmtR(pendente) + '</span>';
        } else {
            elPendenteRef.textContent = '--';
        }
    }
    if (elMensalidades) elMensalidades.textContent = _financialSummary.totalMensalidades > 0 ? fmtR(_financialSummary.totalMensalidades) : '--';
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
    if (!target.matches('.client-name, .client-whatsapp, .client-project, .client-visibility, .client-assigned-to, .client-login, .client-senha, .situacao-select')) return;

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
    const situacaoSelect = row.querySelector('.situacao-select');
    
    const currentVisibility = visibilitySelect ? visibilitySelect.value : (row.dataset.originalVisibility || 'INDIVIDUAL');
    const currentAssignedTo = assignedToSelect ? assignedToSelect.value : (row.dataset.originalAssignedTo || '');
    const currentSituacao = situacaoSelect ? situacaoSelect.value : (row.dataset.originalSituacao || 'ATIVO');

    // Atualizar cor do select de situação
    if (situacaoSelect) {
        situacaoSelect.className = 'situacao-select ' + (currentSituacao === 'EM_HIATO' ? 'sit-hiato' : currentSituacao === 'PAROU' ? 'sit-parou' : 'sit-ativo');
    }

    const originalNome = row.dataset.originalNome;
    const originalWhatsapp = row.dataset.originalWhatsapp;
    const originalProjeto = row.dataset.originalProjeto;
    const originalLogin = row.dataset.originalLogin;
    const originalSenha = row.dataset.originalSenha;
    const originalVisibility = row.dataset.originalVisibility;
    const originalAssignedTo = row.dataset.originalAssignedTo;
    const originalSituacao = row.dataset.originalSituacao || 'ATIVO';

    const hasChanged = 
        currentNome !== originalNome ||
        currentWhatsapp !== originalWhatsapp ||
        currentProjeto !== originalProjeto ||
        currentLogin !== originalLogin ||
        currentSenha !== originalSenha ||
        currentVisibility !== originalVisibility ||
        currentAssignedTo !== originalAssignedTo ||
        currentSituacao !== originalSituacao;

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

        const situacaoSel = row.querySelector('.situacao-select');
        const situacao = situacaoSel ? situacaoSel.value : undefined;

        // Objeto de atualização para tabela clientes
        const clientUpdate = { id: clientId, nome, projeto, login, senha };
        if (visibility !== undefined) clientUpdate.visibility = visibility;
        if (assigned_to_user_id !== undefined) clientUpdate.assigned_to_user_id = assigned_to_user_id;
        if (situacao !== undefined) clientUpdate.situacao = situacao;
        
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

// --- Lógica do Modal de Formulários (Enhanced) --- 
let _formsModalClientId = null;

async function showClientFormsModal(clientId, clientName) {
    console.log(`clientes.js: showClientFormsModal() chamado para Cliente ID: ${clientId}, Nome: ${clientName}`);
    _formsModalClientId = clientId;
    if (!formsModal || !modalTitle) {
        console.error("clientes.js: Elementos do modal não encontrados!");
        return;
    }

    modalTitle.textContent = `Formulário de: ${sanitizeInput(clientName)}`;
    const body = document.getElementById('forms-modal-body');
    if (body) body.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    formsModal.style.display = "block";

    await loadClientFormEnhanced(clientId);
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function loadClientFormEnhanced(clientId) {
    const body = document.getElementById('forms-modal-body');
    if (!body) return;
    try {
        // Buscar formulário mais recente
        const { data: forms, error } = await supabase
            .from('formularios_clientes')
            .select('*')
            .eq('cliente_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        // Verificar se existe diagnóstico ativo
        let temDiagnosticoAtivo = false;
        try {
            const { data: diagData, error: diagErr } = await supabase
                .from('diagnosticos_financeiros')
                .select('id')
                .eq('cliente_id', clientId)
                .limit(1);
            if (!diagErr && diagData && diagData.length > 0) temDiagnosticoAtivo = true;
        } catch(e) {}

        let html = '';

        if (!forms || forms.length === 0) {
            // Sem formulário
            html = `
                <p>Este cliente ainda não possui um formulário.</p>
                <button class="generate-link-btn" id="dash-generate-form-btn" style="margin-top:0.8rem;padding:0.6rem 1.2rem;background:var(--theme-secondary);color:var(--theme-bg-dark);border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    <i class="fas fa-link"></i> Gerar Link de Formulário
                </button>
            `;
        } else {
            const latestForm = forms[0];
            const formDate = new Date(latestForm.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

            if (latestForm.status === 'preenchido' && latestForm.dados_formulario) {
                // Formulário preenchido - mostrar dados completos
                html = `
                    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:0.8rem;margin-bottom:1rem;">
                        <span style="color:#22c55e;font-weight:bold;"><i class="fas fa-check-circle"></i> Formulário Preenchido</span>
                        <span style="color:var(--theme-text-muted);font-size:0.85rem;margin-left:0.5rem;">${formDate}</span>
                    </div>
                `;
                // Renderizar dados completos do formulário
                html += renderFormDataComplete(latestForm.dados_formulario);

                // Botão excluir
                if (temDiagnosticoAtivo) {
                    html += `
                        <button disabled style="margin-top:0.8rem;padding:0.5rem 1rem;background:#555;color:#999;border:none;border-radius:6px;cursor:not-allowed;font-size:0.85rem;opacity:0.6;">
                            <i class="fas fa-trash"></i> Excluir Formulário e Gerar Novo
                        </button>
                        <p style="color:#f39c12;font-size:0.8rem;margin-top:0.4rem;"><i class="fas fa-exclamation-triangle"></i> Formulário protegido: existe um diagnóstico ativo. Exclua o diagnóstico primeiro.</p>
                    `;
                } else {
                    html += `
                        <button id="dash-delete-form-btn" data-form-id="${latestForm.id}" style="margin-top:0.8rem;padding:0.5rem 1rem;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                            <i class="fas fa-trash"></i> Excluir Formulário e Gerar Novo
                        </button>
                    `;
                }
            } else {
                // Formulário pendente (link gerado)
                const formLink = `${window.location.origin}/formulario-cliente.html?token=${latestForm.token_unico}`;
                html = `
                    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:0.8rem;margin-bottom:1rem;">
                        <span style="color:#f59e0b;font-weight:bold;"><i class="fas fa-clock"></i> Aguardando Preenchimento</span>
                        <span style="color:var(--theme-text-muted);font-size:0.85rem;margin-left:0.5rem;">Gerado em ${formDate}</span>
                    </div>
                    <p style="font-size:0.85rem;margin-bottom:0.5rem;">Compartilhe o link abaixo com o cliente:</p>
                    <div style="background:rgba(0,0,0,0.3);border:1px solid var(--theme-border-color);border-radius:6px;padding:0.6rem;word-break:break-all;font-size:0.82rem;display:flex;align-items:center;gap:0.5rem;">
                        <a href="${formLink}" target="_blank" style="color:var(--theme-secondary-lighter);flex:1;">${formLink}</a>
                        <button onclick="navigator.clipboard.writeText('${formLink}');this.innerHTML='<i class=\'fas fa-check\'></i>';setTimeout(()=>{this.innerHTML='<i class=\'fas fa-copy\'></i>'},2000)" style="background:none;border:1px solid var(--theme-border-color);color:var(--theme-text-muted);padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;" title="Copiar link"><i class="fas fa-copy"></i></button>
                    </div>
                `;
                // Botão excluir link
                if (temDiagnosticoAtivo) {
                    html += `
                        <button disabled style="margin-top:0.8rem;padding:0.5rem 1rem;background:#555;color:#999;border:none;border-radius:6px;cursor:not-allowed;font-size:0.85rem;opacity:0.6;">
                            <i class="fas fa-trash"></i> Excluir Link e Gerar Novo
                        </button>
                        <p style="color:#f39c12;font-size:0.8rem;margin-top:0.4rem;"><i class="fas fa-exclamation-triangle"></i> Formulário protegido: existe um diagnóstico ativo.</p>
                    `;
                } else {
                    html += `
                        <button id="dash-delete-form-btn" data-form-id="${latestForm.id}" style="margin-top:0.8rem;padding:0.5rem 1rem;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                            <i class="fas fa-trash"></i> Excluir Link e Gerar Novo
                        </button>
                    `;
                }
            }
        }

        body.innerHTML = html;

        // Event listeners
        const genBtn = document.getElementById('dash-generate-form-btn');
        if (genBtn) genBtn.addEventListener('click', () => dashGenerateForm(clientId));
        const delBtn = document.getElementById('dash-delete-form-btn');
        if (delBtn) delBtn.addEventListener('click', () => dashDeleteFormAndRegenerate(delBtn.dataset.formId, clientId));

    } catch (error) {
        console.error("clientes.js: Erro em loadClientFormEnhanced:", error);
        body.innerHTML = `<p style="color:red;">Erro ao carregar formulário: ${error.message}</p>`;
    }
}

// Renderizar dados completos do formulário (igual a cliente-detalhes.html)
function renderFormDataComplete(dados) {
    if (!dados) return '';
    const S = (v) => v ? sanitizeInput(String(v)) : '';
    const C = (v) => { if (v === null || v === undefined) return 'R$ 0,00'; const n = parseFloat(String(v).replace(/[^\d.,\-]/g, '').replace(',', '.')); return isNaN(n) ? 'R$ 0,00' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
    let h = '<div class="form-consolidado">';

    // Nome Completo
    const nomeCompleto = dados.nome_completo ? S(dados.nome_completo) : 'N/A';
    h += `<p><strong style="color: var(--theme-secondary-lighter);">Nome Completo:</strong> ${nomeCompleto}</p>`;

    // Única pessoa com renda
    const rendaUnicaText = dados.renda_unica === 'sim' ? 'Sim' : (dados.renda_unica === 'nao' ? 'Não' : (dados.unica_pessoa_renda ? 'Sim' : 'Não'));
    h += `<p><strong style="color: var(--theme-secondary-lighter);">Única pessoa com renda na casa?</strong> ${rendaUnicaText}</p>`;

    if ((dados.renda_unica === 'nao' || !dados.unica_pessoa_renda) && Array.isArray(dados.outras_pessoas) && dados.outras_pessoas.length > 0) {
        h += '<ul>';
        dados.outras_pessoas.forEach(p => {
            const nomePessoa = p.nome ? S(p.nome) : 'Nome não informado';
            const autText = p.autorizacao === 'sim' ? 'Sim' : (p.autorizacao === 'nao' ? 'Não' : (p.precisa_autorizacao ? 'Sim' : 'Não'));
            h += `<li>${nomePessoa} (Precisa de autorização: ${autText})</li>`;
        });
        h += '</ul>';
    }

    // Dependentes
    const temDependentesText = dados.tem_dependentes === 'sim' ? 'Sim' : (dados.tem_dependentes === 'nao' ? 'Não' : 'N/A');
    h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Tem dependentes?</strong> ${temDependentesText}</p>`;

    if ((dados.tem_dependentes === 'sim' || dados.tem_dependentes === true) && Array.isArray(dados.dependentes) && dados.dependentes.length > 0) {
        h += '<ul>';
        dados.dependentes.forEach(dep => {
            const nomeDep = dep.nome ? S(dep.nome) : 'Nome não informado';
            let idadeDep = dep.idade !== undefined && dep.idade !== null ? S(String(dep.idade)) : 'N/A';
            if (dep.data_nascimento && (idadeDep === 'N/A' || idadeDep === '')) {
                const nascDep = new Date(dep.data_nascimento + 'T00:00:00');
                const hojeDep = new Date();
                let calcIdade = hojeDep.getFullYear() - nascDep.getFullYear();
                const mDiff = hojeDep.getMonth() - nascDep.getMonth();
                if (mDiff < 0 || (mDiff === 0 && hojeDep.getDate() < nascDep.getDate())) calcIdade--;
                if (calcIdade >= 0) idadeDep = calcIdade + ' anos';
            }
            const relacaoDep = dep.relacao ? S(dep.relacao) : (dep.parentesco ? S(dep.parentesco) : 'N/A');
            h += `<li>${nomeDep} (Idade: ${idadeDep}, Relação: ${relacaoDep})</li>`;
        });
        h += '</ul>';
    }

    // Planos de Saúde
    if (dados.planos_saude && Object.keys(dados.planos_saude).length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações sobre Plano de Saúde:</strong></p><ul>`;
        Object.entries(dados.planos_saude).forEach(([nome, info]) => {
            let statusText = 'N/A';
            if (info.possui === 'sim') statusText = 'Sim';
            else if (info.possui === 'nao') statusText = 'Não';
            else if (info.possui === 'nao_sei') statusText = 'Não sei informar';
            h += `<li>${S(nome)}: ${statusText}</li>`;
        });
        h += '</ul>';
    } else if (dados.plano_saude) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações sobre Plano de Saúde:</strong></p><ul>`;
        if (Array.isArray(dados.plano_saude)) {
            dados.plano_saude.forEach(ps => { h += `<li>${S(ps.nome || ps.pessoa || 'N/A')}: ${S(ps.resposta || ps.valor || 'N/A')}</li>`; });
        } else if (typeof dados.plano_saude === 'object') {
            Object.entries(dados.plano_saude).forEach(([nome, val]) => { h += `<li>${S(nome)}: ${S(typeof val === 'object' ? val.resposta || JSON.stringify(val) : String(val))}</li>`; });
        }
        h += '</ul>';
    }

    // Seguros de Vida
    if (dados.seguros_vida && Object.keys(dados.seguros_vida).length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações sobre Seguro de Vida:</strong></p><ul>`;
        Object.entries(dados.seguros_vida).forEach(([nome, info]) => {
            let statusText = 'N/A';
            if (info.possui === 'sim') statusText = 'Sim';
            else if (info.possui === 'nao') statusText = 'Não';
            else if (info.possui === 'nao_sei') statusText = 'Não sei informar';
            h += `<li>${S(nome)}: ${statusText}</li>`;
        });
        h += '</ul>';
    } else if (dados.seguro_vida) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações sobre Seguro de Vida:</strong></p><ul>`;
        if (Array.isArray(dados.seguro_vida)) {
            dados.seguro_vida.forEach(sv => { h += `<li>${S(sv.nome || sv.pessoa || 'N/A')}: ${S(sv.resposta || sv.valor || 'N/A')}</li>`; });
        } else if (typeof dados.seguro_vida === 'object') {
            Object.entries(dados.seguro_vida).forEach(([nome, val]) => { h += `<li>${S(nome)}: ${S(typeof val === 'object' ? val.resposta || JSON.stringify(val) : String(val))}</li>`; });
        }
        h += '</ul>';
    }

    // Patrimônio Físico
    const possuiPatrimonioText = dados.tem_patrimonio === 'sim' ? 'Sim' : (dados.tem_patrimonio === 'nao' ? 'Não' : (dados.patrimonio_fisico ? 'Sim' : 'Não'));
    h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Possui Patrimônio Físico?</strong> ${possuiPatrimonioText}</p>`;

    const patrimoniosFisicos = dados.patrimonios || dados.patrimonios_fisicos;
    if ((dados.tem_patrimonio === 'sim' || dados.patrimonio_fisico) && Array.isArray(patrimoniosFisicos) && patrimoniosFisicos.length > 0) {
        h += '<ul>';
        patrimoniosFisicos.forEach(p => {
            const desc = p.qual ? S(p.qual) : (p.descricao ? S(p.descricao) : (p.tipo ? S(p.tipo) : 'Descrição não informada'));
            const valor = C(p.valor);
            const seguroText = p.seguro === 'sim' ? 'Sim' : (p.seguro === 'nao' ? 'Não' : 'N/A');
            const quitadoText = p.quitado === 'sim' ? 'Sim' : (p.quitado === 'nao' ? 'Não' : 'N/A');
            h += `<li>${desc} (Valor: ${valor}, Seguro: ${seguroText}, Quitado: ${quitadoText})</li>`;
        });
        h += '</ul>';
    }

    // Patrimônio Líquido
    const possuiPatLiqText = dados.tem_patrimonio_liquido === 'sim' ? 'Sim' : (dados.tem_patrimonio_liquido === 'nao' ? 'Não' : (dados.patrimonio_liquido ? 'Sim' : 'Não'));
    h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Possui Dinheiro Guardado ou Investido?</strong> ${possuiPatLiqText}</p>`;

    if ((dados.tem_patrimonio_liquido === 'sim' || dados.patrimonio_liquido) && Array.isArray(dados.patrimonios_liquidos) && dados.patrimonios_liquidos.length > 0) {
        h += '<ul>';
        dados.patrimonios_liquidos.forEach(p => {
            const onde = p.qual ? S(p.qual) : (p.descricao ? S(p.descricao) : (p.tipo ? S(p.tipo) : 'Local não informado'));
            const valor = C(p.valor);
            h += `<li>${onde} (Valor: ${valor})</li>`;
        });
        h += '</ul>';
    }

    // Dívidas
    const possuiDividasText = dados.tem_dividas === 'sim' ? 'Sim' : (dados.tem_dividas === 'nao' ? 'Não' : 'N/A');
    h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Possui Dívidas?</strong> ${possuiDividasText}</p>`;

    if (dados.tem_dividas === 'sim' && Array.isArray(dados.dividas) && dados.dividas.length > 0) {
        h += '<ul>';
        dados.dividas.forEach(d => {
            const credor = d.credor ? S(d.credor) : 'Credor não informado';
            const saldo = C(d.saldo);
            h += `<li>A quem deve: ${credor} (Saldo Devedor Atual: ${saldo})</li>`;
        });
        h += '</ul>';
    }

    // Imposto de Renda
    if (dados.impostos_renda && Object.keys(dados.impostos_renda).length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações sobre Imposto de Renda:</strong></p><ul>`;
        Object.entries(dados.impostos_renda).forEach(([nome, info]) => {
            let statusIRText = 'N/A';
            if (info.declara === 'sim') statusIRText = 'Sim';
            else if (info.declara === 'nao') statusIRText = 'Não';
            else if (info.declara === 'nao_sei') statusIRText = 'Não sei informar';
            let detalhes = `Declara: ${statusIRText}`;
            if (info.declara === 'sim') {
                const tipoIR = info.tipo_ir ? S(info.tipo_ir) : 'Tipo não informado';
                const resultadoIR = info.resultado_ir ? S(info.resultado_ir) : 'Resultado não informado';
                detalhes += ` | Tipo: ${tipoIR} | Resultado: ${resultadoIR}`;
            }
            h += `<li>${S(nome)}: ${detalhes}</li>`;
        });
        h += '</ul>';
    }

    // Entradas de Renda (orçamento)
    const rendas = dados.orcamento_renda || dados.entradas_renda;
    if (Array.isArray(rendas) && rendas.length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Entradas de Renda:</strong></p><ul>`;
        rendas.forEach(r => {
            h += `<li>${S(r.descricao || r.nome || 'N/A')}: ${C(r.valor)}</li>`;
        });
        h += '</ul>';
    }

    // Despesas Fixas
    const despFixas = dados.orcamento_despesas_fixas || dados.despesas_fixas;
    if (Array.isArray(despFixas) && despFixas.length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Despesas Fixas:</strong></p><ul>`;
        despFixas.forEach(d => {
            h += `<li>${S(d.descricao || d.nome || 'N/A')}: ${C(d.valor)}</li>`;
        });
        h += '</ul>';
    }

    // Despesas Variáveis
    const despVar = dados.orcamento_despesas_variaveis || dados.despesas_variaveis;
    if (Array.isArray(despVar) && despVar.length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Despesas Variáveis:</strong></p><ul>`;
        despVar.forEach(d => {
            h += `<li>${S(d.descricao || d.nome || 'N/A')}: ${C(d.valor)}</li>`;
        });
        h += '</ul>';
    }

    // Objetivos Financeiros
    const objetivos = dados.objetivos || dados.objetivos_financeiros;
    if (Array.isArray(objetivos) && objetivos.length > 0) {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Objetivos Financeiros:</strong></p><ul>`;
        objetivos.forEach(o => {
            const desc = S(o.descricao || o.nome || 'Descrição não informada');
            const valor = o.valor ? C(o.valor) : '';
            const prazo = o.prazo ? S(o.prazo) : 'Prazo não informado';
            h += `<li>${desc}${valor ? ' (Valor: ' + valor + ')' : ''} | Prazo: ${prazo}</li>`;
        });
        h += '</ul>';
    }

    // Informações Adicionais
    const infoAd = dados.info_adicionais || dados.informacoes_adicionais;
    if (typeof infoAd === 'string' && infoAd.trim() !== '') {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações Adicionais:</strong></p>`;
        h += `<p>${S(infoAd)}</p>`;
    } else {
        h += `<p style="margin-top:1rem;"><strong style="color: var(--theme-secondary-lighter);">Informações Adicionais:</strong></p>`;
        h += '<p>Nenhuma informação adicional fornecida.</p>';
    }

    h += '</div>';
    return h;
}

async function dashGenerateForm(clientId) {
    try {
        const token = generateUUID();
        const { data, error } = await supabase
            .from('formularios_clientes')
            .insert([{ cliente_id: clientId, token_unico: token, status: 'pendente', data_preenchimento: null, dados_formulario: null }])
            .select();
        if (error) throw error;
        await loadClientFormEnhanced(clientId);
        loadClients(currentUserProjeto);
    } catch (error) {
        alert('Erro ao gerar formulário: ' + error.message);
    }
}

async function dashDeleteFormAndRegenerate(formId, clientId) {
    if (!confirm('Tem certeza que deseja excluir este formulário? Um novo link será gerado automaticamente.')) return;
    try {
        const { error } = await supabase.from('formularios_clientes').delete().eq('id', formId);
        if (error) throw error;
        await dashGenerateForm(clientId);
    } catch (error) {
        alert('Erro ao excluir formulário: ' + error.message);
    }
}

// Legacy function kept for backward compatibility
async function loadClientForms(clientId) {
    await loadClientFormEnhanced(clientId);
}

// --- Lógica do Modal de Diagnóstico ---
async function showDiagnosticoModal(clientId, clientName) {
    const diagModal = document.getElementById('diagnostico-modal');
    const diagTitle = document.getElementById('diag-modal-title');
    const diagBody = document.getElementById('diagnostico-modal-body');
    if (!diagModal || !diagBody) return;

    diagTitle.textContent = `Diagn\u00f3stico de: ${sanitizeInput(clientName)}`;
    diagBody.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    diagModal.style.display = 'block';

    try {
        // Verificar se existe formul\u00e1rio preenchido
        const { data: formData, error: formErr } = await supabase
            .from('formularios_clientes')
            .select('id, status')
            .eq('cliente_id', clientId)
            .eq('status', 'preenchido')
            .limit(1);

        const temFormularioPreenchido = !formErr && formData && formData.length > 0;

        // Buscar diagn\u00f3stico existente
        const { data: diagData, error: diagErr } = await supabase
            .from('diagnosticos_financeiros')
            .select('*')
            .eq('cliente_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (diagErr) throw diagErr;

        let html = '';

        if (!diagData || diagData.length === 0) {
            // Sem diagn\u00f3stico
            html = `<p>Este cliente ainda n\u00e3o possui um diagn\u00f3stico financeiro.</p>`;
            if (!temFormularioPreenchido) {
                html += `
                    <button disabled style="margin-top:0.8rem;padding:0.6rem 1.2rem;background:#555;color:#999;border:none;border-radius:6px;cursor:not-allowed;font-size:0.9rem;opacity:0.6;">
                        <i class="fas fa-stethoscope"></i> Gerar Link de Diagn\u00f3stico
                    </button>
                    <p style="color:#f39c12;font-size:0.8rem;margin-top:0.4rem;"><i class="fas fa-exclamation-triangle"></i> N\u00e3o \u00e9 poss\u00edvel criar um diagn\u00f3stico sem que o cliente tenha preenchido o formul\u00e1rio primeiro.</p>
                `;
            } else {
                html += `
                    <button id="dash-generate-diag-btn" style="margin-top:0.8rem;padding:0.6rem 1.2rem;background:var(--theme-secondary);color:var(--theme-bg-dark);border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                        <i class="fas fa-stethoscope"></i> Gerar Link de Diagn\u00f3stico
                    </button>
                `;
            }
        } else {
            const diag = diagData[0];
            const diagLink = `${window.location.origin}/diagnostico-financeiro.html?token=${diag.link_unico}`;
            const diagDate = new Date(diag.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

            html = `
                <div style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:6px;padding:0.8rem;margin-bottom:1rem;">
                    <span style="color:#60a5fa;font-weight:bold;"><i class="fas fa-stethoscope"></i> Diagn\u00f3stico Ativo</span>
                    <span style="color:var(--theme-text-muted);font-size:0.85rem;margin-left:0.5rem;">Criado em ${diagDate}</span>
                </div>
                <p style="font-size:0.85rem;margin-bottom:0.5rem;">Link do diagn\u00f3stico:</p>
                <div style="background:rgba(0,0,0,0.3);border:1px solid var(--theme-border-color);border-radius:6px;padding:0.6rem;word-break:break-all;font-size:0.82rem;display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                    <a href="${diagLink}" target="_blank" style="color:var(--theme-secondary-lighter);flex:1;">${diagLink}</a>
                    <button onclick="navigator.clipboard.writeText('${diagLink}');this.innerHTML='<i class=\\'fas fa-check\\'></i>';setTimeout(()=>{this.innerHTML='<i class=\\'fas fa-copy\\'></i>'},2000)" style="background:none;border:1px solid var(--theme-border-color);color:var(--theme-text-muted);padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;" title="Copiar link"><i class="fas fa-copy"></i></button>
                </div>
            `;

            // Renderizar dados consolidados se existirem
            if (diag.dados_consolidados || diag.nome_diagnostico) {
                html += renderConsolidadoDiagnosticoDash(diag);
            }

            // Bot\u00e3o excluir
            html += `
                <button id="dash-delete-diag-btn" data-diag-id="${diag.id}" style="margin-top:1rem;padding:0.5rem 1rem;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                    <i class="fas fa-trash"></i> Excluir Diagn\u00f3stico
                </button>
            `;
        }

        diagBody.innerHTML = html;

        // Event listeners
        const genDiagBtn = document.getElementById('dash-generate-diag-btn');
        if (genDiagBtn) genDiagBtn.addEventListener('click', () => dashGenerateDiagnostico(clientId, clientName));
        const delDiagBtn = document.getElementById('dash-delete-diag-btn');
        if (delDiagBtn) delDiagBtn.addEventListener('click', () => dashDeleteDiagnostico(delDiagBtn.dataset.diagId, clientId, clientName));

    } catch (error) {
        console.error('Erro ao carregar diagn\u00f3stico:', error);
        diagBody.innerHTML = `<p style="color:red;">Erro ao carregar diagn\u00f3stico: ${error.message}</p>`;
    }
}

async function dashGenerateDiagnostico(clientId, clientName) {
    try {
        // Buscar formul\u00e1rio preenchido para obter outras_pessoas
        const { data: formData } = await supabase
            .from('formularios_clientes')
            .select('dados_formulario')
            .eq('cliente_id', clientId)
            .eq('status', 'preenchido')
            .order('created_at', { ascending: false })
            .limit(1);

        let outrasPersonasRenda = '';
        if (formData && formData[0]?.dados_formulario?.outras_pessoas) {
            outrasPersonasRenda = formData[0].dados_formulario.outras_pessoas.map(p => p.nome).join(', ');
        }

        // Buscar nome do cliente
        const { data: cliente } = await supabase
            .from('clientes')
            .select('nome')
            .eq('id', clientId)
            .single();

        const linkUnico = 'diag_' + Math.random().toString(36).substr(2, 16);

        const { error: createError } = await supabase
            .from('diagnosticos_financeiros')
            .insert({
                cliente_id: clientId,
                link_unico: linkUnico,
                nome_principal: cliente?.nome || clientName || '',
                nomes_outras_pessoas_renda: outrasPersonasRenda,
                created_by_id: sessionStorage.getItem('user_id')
            });

        if (createError) throw createError;
        await showDiagnosticoModal(clientId, clientName);
    } catch (error) {
        alert('Erro ao gerar diagn\u00f3stico: ' + error.message);
    }
}

async function dashDeleteDiagnostico(diagId, clientId, clientName) {
    if (!confirm('Tem certeza que deseja excluir este diagn\u00f3stico? Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return;
    try {
        const { error } = await supabase.from('diagnosticos_financeiros').delete().eq('id', diagId);
        if (error) throw error;
        await showDiagnosticoModal(clientId, clientName);
    } catch (error) {
        alert('Erro ao excluir diagn\u00f3stico: ' + error.message);
    }
}

function renderConsolidadoDiagnosticoDash(d) {
    const S = (v) => v ? sanitizeInput(String(v)) : '';
    const C = (v) => { if (v === null || v === undefined) return 'N/A'; const n = parseFloat(v); return isNaN(n) ? 'N/A' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
    const pct = (v) => { const n = parseFloat(v); return isNaN(n) ? '0,00%' : n.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%'; };
    const addObs = (campo) => { const val = d[campo]; if (val && val.trim()) return `<p class="obs-text">Obs: ${S(val)}</p>`; return ''; };

    const RISCO_LABELS = {'RISCO_MUITO_BAIXO_GARANTIA_SOBERANA':'Risco Muito Baixo (Garantia Soberana)','RISCO_MUITO_BAIXO_GARANTIA_FGC':'Risco Muito Baixo (Garantia FGC)','RISCO_BAIXO_GARANTIA_FGC':'Risco Baixo (Garantia FGC)','RISCO_MEDIO_SEM_GARANTIA':'Risco Médio','RISCO_ALTO_SEM_GARANTIA':'Risco Alto','RISCO_MUITO_ALTO_SEM_GARANTIA':'Risco Muito Alto','RISCO_ABSOLUTO_SEM_GARANTIA':'Risco Absoluto'};
    const PERFIS_FIN = {'dividas_impagaveis':'Dívidas Impagáveis','dividas_pagaveis':'Dívidas Pagáveis','zero_a_zero_obrigatorio':'Zero a Zero Obrigatório','zero_a_zero_opcional':'Zero a Zero Opcional','fluxo_positivo':'Fluxo Positivo','poupador':'Poupador','investidor_amador':'Investidor-Amador','investidor_planejador':'Investidor-Planejador','nivel_1':'HV Nível I','nivel_2':'HV Nível II'};
    const PERFIS_OBJ = {'sem_conhecimento':'Sem Conhecimento','iniciante':'Iniciante','ultra_cons':'Ultra-Conservador','cons':'Conservador','cons_mod':'Conservador-Moderado','mod':'Moderado','mod_arro':'Moderado-Arrojado','arro':'Arrojado','ultra_arro':'Ultra-Arrojado'};

    let h = '<div class="diag-consolidado">';

    // 1. DADOS PESSOAIS
    h += '<h3>Dados Pessoais</h3>';
    if (d.nome_diagnostico) h += `<p><strong>Nome:</strong> ${S(d.nome_diagnostico)}</p>`;
    if (d.cpf) h += `<p><strong>CPF:</strong> ${d.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>`;
    if (d.data_nascimento) {
        const dn = new Date(d.data_nascimento + 'T12:00:00');
        const idade = Math.floor((new Date() - dn) / (365.25*24*60*60*1000));
        h += `<p><strong>Data de Nascimento:</strong> ${dn.toLocaleDateString('pt-BR')} (${idade} anos)</p>`;
    }
    if (d.profissao) h += `<p><strong>Profissão:</strong> ${S(d.profissao)}</p>`;
    if (d.estado_civil) h += `<p><strong>Estado Civil:</strong> ${S(d.estado_civil)}</p>`;
    if (d.regime_bens) h += `<p><strong>Regime de Bens:</strong> ${S(d.regime_bens)}</p>`;
    if (d.telefone) h += `<p><strong>Telefone:</strong> ${S(d.telefone)}</p>`;
    if (d.email) h += `<p><strong>E-mail:</strong> ${S(d.email)}</p>`;
    if (d.conjuge_nome) {
        h += `<p style="margin-top:0.8rem;border-top:1px dotted var(--theme-border-color);padding-top:0.5rem"><strong>Cônjuge:</strong> ${S(d.conjuge_nome)}</p>`;
        if (d.conjuge_cpf) h += `<p><strong>CPF Cônjuge:</strong> ${d.conjuge_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>`;
        if (d.conjuge_profissao) h += `<p><strong>Profissão Cônjuge:</strong> ${S(d.conjuge_profissao)}</p>`;
    }
    h += addObs('obs_dados_pessoais');

    // 2. PESSOAS COM RENDA
    try {
        const pessoas = typeof d.pessoas_renda === 'string' ? JSON.parse(d.pessoas_renda) : d.pessoas_renda;
        if (pessoas && pessoas.length > 0) {
            h += '<h3>Pessoas com Renda</h3><ul>';
            pessoas.forEach(p => { h += `<li><strong>${S(p.nome||'N/A')}</strong> \u2014 Parentesco: ${S(p.parentesco||'N/A')}${p.idade ? ', Idade: '+p.idade : ''}</li>`; });
            h += '</ul>'; h += addObs('obs_pessoas_renda');
        }
    } catch(e) {}

    // 3. DEPENDENTES
    try {
        const deps = typeof d.dependentes === 'string' ? JSON.parse(d.dependentes) : d.dependentes;
        if (deps && deps.length > 0) {
            h += '<h3>Dependentes</h3><ul>';
            deps.forEach(dep => { h += `<li><strong>${S(dep.nome||'N/A')}</strong> \u2014 Relação: ${S(dep.relacao||dep.parentesco||'N/A')}${dep.idade ? ', Idade: '+dep.idade : ''}</li>`; });
            h += '</ul>'; h += addObs('obs_dependentes');
        }
    } catch(e) {}

    // 4. PATRIMÔNIO FÍSICO
    try {
        const pats = typeof d.patrimonios === 'string' ? JSON.parse(d.patrimonios) : d.patrimonios;
        if (pats && pats.length > 0) {
            h += '<h3>Patrimônio Físico</h3>';
            let totalPF = 0; h += '<ul>';
            pats.forEach(p => { const val = parseFloat(p.valor)||0; totalPF += val; h += `<li><strong>${S(p.tipo||p.descricao||'N/A')}</strong> | Valor: ${C(val)} | Invent.: ${p.inventariavel===false?'Não':'Sim'}</li>`; });
            h += '</ul>'; h += `<p><strong>Total:</strong> ${C(totalPF)}</p>`; h += addObs('obs_patrimonio_fisico');
        }
    } catch(e) {}

    // 5. PATRIMÔNIO LÍQUIDO
    try {
        const invs = typeof d.patrimonios_liquidos === 'string' ? JSON.parse(d.patrimonios_liquidos) : d.patrimonios_liquidos;
        if (invs && invs.length > 0) {
            h += '<h3>Patrimônio Líquido / Investimentos</h3>';
            let totalPL = 0; h += '<ul>';
            invs.forEach(inv => {
                const val = parseFloat(inv.valor_atual)||0; totalPL += val;
                const riscoLabel = RISCO_LABELS[inv.classificacao_risco]||inv.classificacao_risco||'';
                const nome = inv.nome_produto_customizado||inv.tipo_produto_nome||'N/A';
                h += `<li><strong>${S(nome)}</strong> (${S(inv.tipo_produto_nome||inv.tipo||'')}) | Valor: ${C(val)}${riscoLabel?' | Risco: '+S(riscoLabel):''}${inv.instituicao_nome?' | Inst.: '+S(inv.instituicao_nome):''}${inv.aporte_mensal?' | Aporte: '+C(inv.aporte_mensal)+' ('+S(inv.aporte_periodicidade||'MENSAL')+')':''}${inv.inventariavel===false?' | Invent.: Não':''}${inv.donos?' | Donos: '+S(inv.donos):''}</li>`;
            });
            h += '</ul>'; h += `<p><strong>Total:</strong> ${C(totalPL)}</p>`; h += addObs('obs_patrimonio_liquido');
        }
    } catch(e) {}

    // 6. SUITABILITY
    try {
        const suits = typeof d.suitability === 'string' ? JSON.parse(d.suitability) : d.suitability;
        if (suits && suits.length > 0) {
            const PERFIS_INV_CALC = [
                {id:0,nome:'Ultra-Conservador',pfpMin:0,pfpMax:10},
                {id:1,nome:'Conservador',pfpMin:10.01,pfpMax:25},
                {id:2,nome:'Conservador-Moderado',pfpMin:25.01,pfpMax:40},
                {id:3,nome:'Moderado',pfpMin:40.01,pfpMax:55},
                {id:4,nome:'Moderado-Arrojado',pfpMin:55.01,pfpMax:70},
                {id:5,nome:'Arrojado',pfpMin:70.01,pfpMax:85},
                {id:6,nome:'Ultra-Arrojado',pfpMin:85.01,pfpMax:100}
            ];
            const PERGUNTAS_SUIT = {
                A1:'Em quanto tempo pretende parar de trabalhar?',A2:'Por quanto tempo conseguiria deixar patrimônio aplicado?',A3:'Quanto tempo para esperar recuperação em cenário ruim?',
                B1:'Como reagiria se investimentos perdessem 20% em um mês?',B2:'Atitude em relação a risco e retorno?',B3:'Qual perda temporária conseguiria suportar?',
                C1:'Nível de conhecimento sobre investimentos?',C2:'Há quanto tempo investe no mercado financeiro?',C3:'Já investiu em renda variável?'
            };
            const RESPOSTAS_SUIT = {
                A1:{1:'Menos de 5 anos',2:'Entre 5 e 10 anos',3:'Entre 10 e 20 anos',4:'Entre 20 e 30 anos',5:'Mais de 30 anos'},
                A2:{1:'Menos de 1 ano',2:'Entre 1 e 3 anos',3:'Entre 3 e 5 anos',4:'Entre 5 e 10 anos',5:'Mais de 10 anos'},
                A3:{1:'Nenhum - precisaria resgatar',2:'Até 6 meses',3:'Até 1 ano',4:'Até 2 anos',5:'Mais de 2 anos'},
                B1:{1:'Resgataria tudo',2:'Resgataria parte',3:'Manteria e aguardaria',4:'Compraria mais um pouco',5:'Compraria muito mais'},
                B2:{1:'Não aceito risco',2:'Pouco risco, pouco retorno',3:'Risco moderado',4:'Aceito risco por retorno',5:'Máximo retorno possível'},
                B3:{1:'Nenhuma',2:'Até 5%',3:'Até 15%',4:'Até 30%',5:'Mais de 30%'},
                C1:{1:'Nenhum',2:'Básico',3:'Intermediário',4:'Avançado',5:'Especialista'},
                C2:{1:'Nunca investi',2:'Menos de 2 anos',3:'Entre 2 e 5 anos',4:'Entre 5 e 10 anos',5:'Mais de 10 anos'},
                C3:{1:'Não, nunca',2:'Sim, pouco',3:'Sim, moderadamente',4:'Sim, bastante',5:'Sim, maioria em RV'}
            };
            h += '<h3>Teste de Perfil de Investidor (Suitability)</h3>';
            suits.forEach(suit => {
                h += `<p style="margin-top:0.5rem"><strong>${S(suit.nome||'N/A')}:</strong></p><ul>`;
                const resps = suit.respostas || suit;
                ['A1','A2','A3','B1','B2','B3','C1','C2','C3'].forEach(key => {
                    if (resps[key] !== undefined) {
                        const respTexto = RESPOSTAS_SUIT[key] ? (RESPOSTAS_SUIT[key][resps[key]] || resps[key]) : resps[key];
                        h += `<li><strong>${key}:</strong> ${PERGUNTAS_SUIT[key]||key} \u2192 <em>${S(String(respTexto))}</em> (${resps[key]})</li>`;
                    }
                });
                const PA = (resps.A1||0)+(resps.A2||0)+(resps.A3||0);
                const PB = (resps.B1||0)+(resps.B2||0)+(resps.B3||0);
                const PC = (resps.C1||0)+(resps.C2||0)+(resps.C3||0);
                const PAN = ((PA-3)/12)*100;
                const PBN = ((PB-3)/12)*100;
                const PCN = ((PC-3)/12)*100;
                let PFP = Math.max(0, Math.min(100, (PAN*0.25)+(PBN*0.50)+(PCN*0.25)));
                let perfil = PERFIS_INV_CALC.find(p => PFP >= p.pfpMin && PFP <= p.pfpMax);
                if (!perfil) perfil = PFP <= 0 ? PERFIS_INV_CALC[0] : PERFIS_INV_CALC[6];
                if (PA <= 4 && perfil.id > 2) perfil = PERFIS_INV_CALC[1];
                if (PB <= 4 && perfil.id > 1) perfil = PERFIS_INV_CALC[0];
                if (PC <= 4 && perfil.id > 3) perfil = PERFIS_INV_CALC[2];
                if (PA <= 5 && PC <= 5 && perfil.id > 2) perfil = PERFIS_INV_CALC[1];
                h += `</ul><p><strong>PA:</strong> ${PA} | <strong>PB:</strong> ${PB} | <strong>PC:</strong> ${PC} | <strong>PFP:</strong> ${PFP.toFixed(2)} | <strong>Perfil:</strong> ${perfil.nome}</p>`;
            });
        }
    } catch(e) { console.error('Erro suitability consolidado:', e); }

    // 7. DÍVIDAS
    try {
        const divs = typeof d.dividas === 'string' ? JSON.parse(d.dividas) : d.dividas;
        if (divs && divs.length > 0) {
            h += '<h3>Dívidas</h3>';
            let totalSaldo = 0, totalParcela = 0; h += '<ul>';
            divs.forEach(div => {
                const saldo = parseFloat(div.saldo_devedor)||0;
                const parcela = parseFloat(div.valor_parcela)||0;
                totalSaldo += saldo; totalParcela += parcela;
                h += `<li><strong>${S(div.credor||div.motivo||'N/A')}</strong>`;
                if (div.motivo && div.credor) h += ` \u2014 Motivo: ${S(div.motivo)}`;
                h += ` | Valor Inicial: ${C(div.valor_inicial)} | Saldo Devedor: ${C(saldo)} | Parcela: ${C(parcela)} | Prazo: ${div.prazo||'N/A'} meses | Pagas: ${div.parcelas_pagas||0} | Taxa: ${pct(div.taxa_juros)} ${S(div.taxa_juros_tipo||'a.a.')}`;
                if (div.tipo_amortizacao) h += ` | Amortização: ${S(div.tipo_amortizacao)}`;
                if (div.reajuste_anual) h += ` | Reajuste: ${pct(div.reajuste_anual)} a.a.`;
                h += ` | Planejada: ${div.planejada?'Sim':'Não'} | Invent.: ${div.inventariavel===false?'Não':'Sim'}`;
                if (div.responsaveis && div.responsaveis.length > 0) h += ` | Responsáveis: ${div.responsaveis.map(r => S(r)).join(', ')}`;
                h += '</li>';
            });
            h += '</ul>';
            h += `<p><strong>Total Saldo Devedor:</strong> ${C(totalSaldo)} | <strong>Total Parcelas:</strong> ${C(totalParcela)}</p>`;
            h += addObs('obs_dividas');
        }
    } catch(e) {}

    // 8. SUCESSÃO
    try {
        const suc = typeof d.dados_sucessao === 'string' ? JSON.parse(d.dados_sucessao) : d.dados_sucessao;
        if (suc && Object.keys(suc).length > 0) {
            h += '<h3>Sucessão Patrimonial</h3>';
            h += `<p><strong>ITCMD:</strong> ${pct(suc.itcmd)} | <strong>Emolumentos:</strong> ${pct(suc.emolumentos)} | <strong>Honorários:</strong> ${pct(suc.honorarios)}</p>`;
            const totalPctSuc = (parseFloat(suc.itcmd)||0)+(parseFloat(suc.emolumentos)||0)+(parseFloat(suc.honorarios)||0);
            h += `<p><strong>Total Custos Sucessórios:</strong> ${pct(totalPctSuc)}</p>`;
            try {
                let totalPatrimonio = 0;
                const patsS = typeof d.patrimonios === 'string' ? JSON.parse(d.patrimonios) : d.patrimonios;
                const invsS = typeof d.patrimonios_liquidos === 'string' ? JSON.parse(d.patrimonios_liquidos) : d.patrimonios_liquidos;
                if (patsS) patsS.filter(p => p.inventariavel !== false).forEach(p => totalPatrimonio += parseFloat(p.valor)||0);
                if (invsS) invsS.filter(i => i.inventariavel !== false).forEach(i => totalPatrimonio += parseFloat(i.valor_atual)||0);
                if (totalPatrimonio > 0) {
                    const custoSucessao = totalPatrimonio * (totalPctSuc / 100);
                    h += `<p><strong>Patrimônio Inventariável:</strong> ${C(totalPatrimonio)} | <strong>Custo Estimado Sucessão:</strong> ${C(custoSucessao)}</p>`;
                }
            } catch(e2) {}
            h += addObs('obs_sucessao');
        }
    } catch(e) {}

    // 9. PRODUTOS & PROTEÇÃO
    try {
        const prods = typeof d.produtos_protecao === 'string' ? JSON.parse(d.produtos_protecao) : d.produtos_protecao;
        if (prods && prods.length > 0) {
            h += '<h3>Produtos &amp; Proteção</h3>';
            let totalCustoAnual = 0; h += '<ul>';
            prods.forEach(p => {
                const custo = parseFloat(p.custo)||0;
                let custoAnual = custo;
                if (p.periodicidade === 'mensal') custoAnual = custo * 12;
                else if (p.periodicidade === 'semestral') custoAnual = custo * 2;
                else if (p.periodicidade === 'trimestral') custoAnual = custo * 4;
                totalCustoAnual += custoAnual;
                h += `<li><strong>${S(p.tipo_produto||'N/A')}</strong>`;
                if (p.objeto) h += ` \u2014 Objeto: ${S(p.objeto)}`;
                h += ` | Custo: ${C(custo)} (${S(p.periodicidade||'anual')})`;
                if (p.seguradora) h += ` | Seguradora: ${S(p.seguradora)}`;
                h += ` | Cotou/Analisou: ${p.cotou_analisou?'Sim':'Não'}`;
                if (p.contratacoes && p.contratacoes.length > 0) {
                    h += '<ul>';
                    p.contratacoes.forEach(c => { h += `<li>${S(c.tipo||c.cobertura||'Contratação')}: ${C(c.valor||c.capital)} ${c.carencia?'| Carência: '+S(c.carencia):''}</li>`; });
                    h += '</ul>';
                }
                h += '</li>';
            });
            h += '</ul>';
            h += `<p><strong>Total Custo Anual Proteção:</strong> ${C(totalCustoAnual)}</p>`;
            h += addObs('obs_produtos_protecao');
        }
    } catch(e) {}

    // 10. IMPOSTO DE RENDA
    try {
        const irs = typeof d.declaracoes_ir === 'string' ? JSON.parse(d.declaracoes_ir) : d.declaracoes_ir;
        if (irs && irs.length > 0) {
            h += '<h3>Imposto de Renda</h3>';
            irs.forEach(ir => {
                h += `<p style="margin-top:0.5rem"><strong>${S(ir.pessoa_nome||'N/A')}</strong> (${S(ir.pessoa_tipo||'')})</p>`;
                h += `<p>Tipo Declaração: <strong>${S(ir.tipo_declaracao||'N/A')}</strong></p>`;
                if (ir.tipo_declaracao && ir.tipo_declaracao !== 'nao_declara') {
                    h += '<ul>';
                    h += `<li>Renda Bruta Anual: ${C(ir.renda_bruta_anual)}</li>`;
                    h += `<li>Total Recolhido IR: ${C(ir.total_recolhido_ir)}</li>`;
                    h += `<li>Contribuição Previdência Oficial: ${C(ir.contribuicao_previdencia_oficial)}</li>`;
                    h += `<li>Total Dependentes: ${ir.total_dependentes||0}</li>`;
                    h += `<li>Gastos Instrução: ${C(ir.gastos_instrucao)}</li>`;
                    h += `<li>Gastos Médicos: ${C(ir.gastos_medicos)}</li>`;
                    h += `<li>Livro Caixa: ${C(ir.livro_caixa)}</li>`;
                    h += `<li>Pensão Alimentícia: ${C(ir.pensao_alimenticia)}</li>`;
                    h += `<li>Contribuição Não Oficial: ${C(ir.contribuicao_nao_oficial)}</li>`;
                    h += `<li>Outras Deduções: ${C(ir.outras_deducoes)}</li>`;
                    if (ir.resultado_tipo) h += `<li>Resultado: ${S(ir.resultado_tipo)} \u2014 ${C(ir.resultado_valor)}</li>`;
                    h += '</ul>';
                }
            });
            h += addObs('obs_ir');
        }
    } catch(e) {}

    // 11. CONTAS & CARTÕES
    try {
        let contasData = typeof d.contas_cartoes === 'string' ? JSON.parse(d.contas_cartoes) : d.contas_cartoes;
        let contasList = [];
        if (Array.isArray(contasData)) { contasList = contasData; }
        else if (contasData && contasData.contasCartoes) { contasList = contasData.contasCartoes; }
        if (contasList.length > 0) {
            h += '<h3>Contas &amp; Cartões</h3><ul>';
            contasList.forEach(c => {
                const tipoLabel = c.tipo === 'cartao' ? 'Cartão' : 'Conta';
                h += `<li><strong>${tipoLabel}</strong>`;
                if (c.titular) h += ` \u2014 Titular: ${S(c.titular)}`;
                if (c.instituicao) h += ` | Instituição: ${S(c.instituicao)}`;
                if (c.tipo_cartao) h += ` | Tipo: ${S(c.tipo_cartao)}`;
                if (c.tarifa_anuidade) h += ` | Anuidade: ${C(c.tarifa_anuidade)}`;
                if (c.pontos_por_dolar) h += ` | Pts/Dólar: ${c.pontos_por_dolar}`;
                if (c.cashback) h += ` | Cashback: ${pct(c.cashback)}`;
                if (c.beneficios) h += ` | Benefícios: ${S(c.beneficios)}`;
                h += '</li>';
            });
            h += '</ul>';
            h += addObs('obs_contas_cartoes');
        }
    } catch(e) {}

    // 12. FLUXO DE CAIXA
    try {
        const fluxo = typeof d.fluxo_caixa === 'string' ? JSON.parse(d.fluxo_caixa) : d.fluxo_caixa;
        if (fluxo && (fluxo.receitas || fluxo.despesas)) {
            h += '<h3>Fluxo de Caixa</h3>';
            let totalReceitaMensal = 0, totalDespesaMensal = 0;
            if (fluxo.receitas && fluxo.receitas.length > 0) {
                h += '<p><strong>Receitas:</strong></p><ul>';
                fluxo.receitas.forEach(r => {
                    const val = parseFloat(r.valor)||0;
                    const qtdRec = parseInt(r.qtd_recorrencia)||1;
                    const undRec = r.und_recorrencia||'mes';
                    let valMensal = val;
                    if (undRec === 'ano') valMensal = val / 12;
                    else if (undRec === 'semana') valMensal = val * 4;
                    else if (undRec === 'dia') valMensal = val * 30;
                    if (qtdRec > 1) { if (undRec === 'mes') valMensal = val / qtdRec; else if (undRec === 'ano') valMensal = val / (qtdRec * 12); }
                    totalReceitaMensal += valMensal;
                    h += `<li><strong>${S(r.nome||r.descricao||'N/A')}</strong>: ${C(val)} (a cada ${qtdRec} ${undRec})`;
                    if (r.titular) h += ` | Titular: ${S(r.titular)}`;
                    if (r.tipo) h += ` | Tipo: ${S(r.tipo)}`;
                    if (r.origem) h += ` | Origem: ${S(r.origem)}`;
                    h += '</li>';
                });
                h += '</ul>';
            }
            if (fluxo.despesas && fluxo.despesas.length > 0) {
                h += '<p><strong>Despesas:</strong></p><ul>';
                fluxo.despesas.forEach(desp => {
                    const val = parseFloat(desp.valor)||0;
                    const qtdRec = parseInt(desp.qtd_recorrencia)||1;
                    const undRec = desp.und_recorrencia||'mes';
                    let valMensal = val;
                    if (undRec === 'ano') valMensal = val / 12;
                    else if (undRec === 'semana') valMensal = val * 4;
                    else if (undRec === 'dia') valMensal = val * 30;
                    if (qtdRec > 1) { if (undRec === 'mes') valMensal = val / qtdRec; else if (undRec === 'ano') valMensal = val / (qtdRec * 12); }
                    totalDespesaMensal += valMensal;
                    h += `<li><strong>${S(desp.nome||desp.descricao||'N/A')}</strong>: ${C(val)} (a cada ${qtdRec} ${undRec})`;
                    if (desp.titular) h += ` | Titular: ${S(desp.titular)}`;
                    if (desp.tipo) h += ` | Tipo: ${S(desp.tipo)}`;
                    if (desp.forma_pagamento) h += ` | Pagamento: ${S(desp.forma_pagamento)}`;
                    h += '</li>';
                });
                h += '</ul>';
            }
            const saldoMensal = totalReceitaMensal - totalDespesaMensal;
            h += `<p><strong>Receita Mensal Total:</strong> ${C(totalReceitaMensal)} | <strong>Despesa Mensal Total:</strong> ${C(totalDespesaMensal)} | <strong>Saldo Mensal:</strong> ${C(saldoMensal)}</p>`;
            h += `<p><strong>Receita Anual:</strong> ${C(totalReceitaMensal*12)} | <strong>Despesa Anual:</strong> ${C(totalDespesaMensal*12)} | <strong>Saldo Anual:</strong> ${C(saldoMensal*12)}</p>`;
            h += addObs('obs_fluxo_caixa');
        }
    } catch(e) {}

    // 13. OBJETIVOS FINANCEIROS
    try {
        const obj = typeof d.objetivos === 'string' ? JSON.parse(d.objetivos) : d.objetivos;
        if (obj) {
            if (obj.variaveisMercado) {
                const vm = obj.variaveisMercado;
                h += '<h3>Variáveis de Mercado</h3>';
                h += `<p><strong>Data Reunião:</strong> ${vm.data_reuniao||'N/A'} | <strong>Selic:</strong> ${pct(vm.selic)} | <strong>CDI:</strong> ${pct(vm.cdi)} | <strong>IPCA:</strong> ${pct(vm.ipca)} | <strong>Dólar:</strong> R$ ${parseFloat(vm.dolar||0).toFixed(2)}</p>`;
                h += `<p><strong>CDI 120m:</strong> ${pct(vm.cdi_120_meses)} | <strong>IPCA 120m:</strong> ${pct(vm.ipca_120_meses)} | <strong>CDI a.a. médio 10a:</strong> ${pct(vm.cdi_aa_medio_10_anos)} | <strong>IPCA a.a. médio 10a:</strong> ${pct(vm.ipca_aa_medio_10_anos)}</p>`;
                h += `<p><strong>Rent. Aposentadoria:</strong> ${pct(vm.rent_anual_aposentadoria)} a.a. / ${pct(vm.rent_mensal_aposentadoria)} a.m.</p>`;
            }
            if (obj.objetivos && obj.objetivos.length > 0) {
                h += '<h3>Objetivos Financeiros</h3><ul>';
                obj.objetivos.forEach((o, idx) => {
                    h += `<li><strong>#${idx+1} ${S(o.descricao||'N/A')}</strong> (${S(o.tipo||'objetivo')})`;
                    if (o.importancia) h += ` | Importância: ${S(o.importancia)}`;
                    if (o.responsaveis && o.responsaveis.length > 0) h += ` | Responsáveis: ${o.responsaveis.map(r => S(r)).join(', ')}`;
                    if (o.tipo === 'aposentadoria') {
                        if (o.prazo_idade) h += ` | Idade: ${o.prazo_idade} anos`;
                        if (o.renda_anual) h += ` | Renda Anual: ${C(o.renda_anual)}`;
                    } else {
                        if (o.prazo_meses) h += ` | Prazo: ${o.prazo_meses} meses`;
                        if (o.prazo_tipo === 'data' && o.prazo_data) h += ` | Data: ${S(o.prazo_data)}`;
                        if (o.valor_final) h += ` | Valor Final: ${C(o.valor_final)}`;
                        if (o.meta_acumulo) h += ` | Meta Acúmulo: ${C(o.meta_acumulo)}`;
                    }
                    if (o.valor_inicial) h += ` | Valor Inicial: ${C(o.valor_inicial)}`;
                    h += ` | Prioridade: ${o.prioridade||'N/A'}`;
                    const perfilAtual = PERFIS_OBJ[o.perfil_atual]||o.perfil_atual||'N/A';
                    const perfilConsult = PERFIS_OBJ[o.perfil_consultoria]||o.perfil_consultoria||'N/A';
                    h += ` | Perfil Atual: ${perfilAtual} | Perfil Consultoria: ${perfilConsult}`;
                    if (o.acumulavel) h += ' | Acumulável: Sim';
                    if (o.vinculado_a) h += ` | Vinculado a: #${o.vinculado_a}`;
                    h += '</li>';
                });
                h += '</ul>';
            }
            h += addObs('obs_objetivos');
            if (obj.perfilFinanceiro && obj.perfilFinanceiro.perfil_selecionado) {
                h += '<h3>Perfil Financeiro</h3>';
                const perfilNome = PERFIS_FIN[obj.perfilFinanceiro.perfil_selecionado]||obj.perfilFinanceiro.perfil_selecionado;
                h += `<p><strong>Perfil Selecionado:</strong> ${S(perfilNome)}</p>`;
                if (obj.perfilFinanceiro.observacoes) h += `<p class="obs-text">Obs: ${S(obj.perfilFinanceiro.observacoes)}</p>`;
            }
            h += addObs('obs_perfil_financeiro');
            if (obj.investimentoAssistencia) {
                const ia = obj.investimentoAssistencia;
                h += '<h3>Adesão</h3>';
                if (ia.proposta_final) h += `<p><strong>Proposta Final:</strong> ${ia.proposta_final === 'ordinaria' ? 'Ordinária' : 'Especial'}</p>`;
                if (ia.qtd_recomendacoes) h += `<p><strong>Qtd. Recomendações:</strong> ${ia.qtd_recomendacoes}</p>`;
                if (ia.plano_acompanhamento) h += `<p><strong>Plano de Acompanhamento:</strong> ${S(ia.plano_acompanhamento)}</p>`;
                if (ia.observacoes) h += `<p class="obs-text">Obs: ${S(ia.observacoes)}</p>`;
            }
            h += addObs('obs_adesao_plano');
        }
    } catch(e) { console.error('Erro objetivos consolidado:', e); }

    // 14. QUESTÕES PERTINENTES
    try {
        const q = typeof d.questoes_pertinentes === 'string' ? JSON.parse(d.questoes_pertinentes) : d.questoes_pertinentes;
        if (q && Object.keys(q).length > 0) {
            h += '<h3>Questões Pertinentes</h3>';
            let simCount = 0, naoCount = 0, naCount = 0, pendCount = 0;
            const secoes = {};
            Object.entries(q).forEach(([id, data]) => {
                const resp = (data.resposta||'').toUpperCase();
                if (resp === 'SIM') simCount++;
                else if (resp === 'NÃO' || resp === 'NAO') naoCount++;
                else if (resp === 'INAPLICÁVEL' || resp === 'INAPLICAVEL' || resp === 'N/A' || resp === 'NA') naCount++;
                else pendCount++;
                const secao = data.secao || 'outros';
                if (!secoes[secao]) secoes[secao] = [];
                secoes[secao].push({ id, texto: data.texto, resposta: resp });
            });
            const totalResp = simCount + naoCount;
            const pctAprov = totalResp > 0 ? Math.round((simCount / totalResp) * 100) : 0;
            h += `<p><strong>Resumo:</strong> ${simCount} SIM, ${naoCount} NÃO, ${naCount} N/A, ${pendCount} Pendentes | <strong>Aproveitamento:</strong> ${pctAprov}%</p>`;
            const SECAO_NOMES = {
                'patrimonio-liquido':'Patrimônio Líquido','dividas':'Dívidas','fluxo-caixa':'Fluxo de Caixa',
                'produtos-protecao':'Produtos & Proteção','ir':'Imposto de Renda','contas-cartoes':'Contas & Cartões',
                'objetivos':'Objetivos','dados-pessoais':'Dados Pessoais','sucessao':'Sucessão'
            };
            Object.entries(secoes).forEach(([secao, perguntas]) => {
                const nomeSecao = SECAO_NOMES[secao]||secao;
                h += `<p style="margin-top:0.4rem"><strong>${nomeSecao}:</strong></p><ul>`;
                perguntas.forEach(p => {
                    const r = p.resposta;
                    const isSim = r === 'SIM';
                    const isNao = r === 'NÃO' || r === 'NAO';
                    const isNA = r === 'INAPLICÁVEL' || r === 'INAPLICAVEL' || r === 'N/A' || r === 'NA';
                    const respLabel = isSim ? '\u2713 SIM' : isNao ? '\u2717 NÃO' : isNA ? '\u2014 N/A' : '\u23f3 Pendente';
                    const cor = isSim ? '#4CAF50' : isNao ? '#f44336' : isNA ? '#9E9E9E' : '#FF9800';
                    h += `<li>${S(p.texto)} \u2192 <strong style="color:${cor}">${respLabel}</strong></li>`;
                });
                h += '</ul>';
            });
        }
    } catch(e) {}

    h += '</div>';
    return h;
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
    } else if (btn.classList.contains('view-diag-btn')) {
        showDiagnosticoModal(clientId, clientName);
    } else if (btn.classList.contains('delete-btn')) {
        deleteClient(clientId);
    } else if (btn.classList.contains('view-details-btn')) {
        window.location.href = `cliente-detalhes.html?id=${clientId}`;
    } else if (btn.classList.contains('edit-msg-btn')) {
        handleEditMessage(clientId);
    } else if (btn.classList.contains('system-btn')) {
        openClientSystem(clientId);
    } else if (btn.classList.contains('plano-ref-btn')) {
        openPlanoRefModal(clientId, clientName);
    } else if (btn.classList.contains('mensalidade-btn')) {
        openMensalidadeModal(clientId, clientName);
    } else if (btn.classList.contains('obj-action-btn')) {
        openObjetivosModal(clientId, clientName);
    } else if (btn.classList.contains('partic-action-btn')) {
        openParticularidadesModal(clientId, clientName);
    } else if (btn.classList.contains('situacao-info-btn')) {
        openSituacaoModal(clientId, clientName);
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
  // Atualizar contagem de badges no painel de resumo
  const elBadges = document.getElementById('sum-badges');
  if (elBadges) {
    const badgeCount = document.querySelectorAll('.edit-msg-btn .badge').length;
    elBadges.innerHTML = badgeCount > 0 ? '<span style="color:#ef4444;">' + badgeCount + '</span>' : '0';
  }
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

// Converte string formatada "R$ 1.234,56" de volta para float 1234.56
function parseBRL(str) {
    if (!str) return 0;
    const raw = String(str).replace(/[^\d]/g, '');
    if (!raw) return 0;
    return parseInt(raw, 10) / 100;
}

// Aplica máscara de moeda BRL em tempo real a um input (type="text")
function addCurrencyMask(inputElement) {
    if (!inputElement) return;
    inputElement.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/[^\d]/g, '');
        if (rawValue) {
            const number = parseInt(rawValue, 10);
            if (!isNaN(number)) {
                e.target.value = (number / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        } else {
            e.target.value = '';
        }
    });
    inputElement.addEventListener('blur', (e) => {
        const rawValue = e.target.value.replace(/[^\d]/g, '');
        if (rawValue) {
            const number = parseInt(rawValue, 10);
            if (!isNaN(number)) {
                e.target.value = (number / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        } else {
            e.target.value = '';
        }
    });
    // Formata valor inicial se houver
    const initialRaw = inputElement.value.replace(/[^\d]/g, '');
    if (initialRaw) {
        const initialNumber = parseInt(initialRaw, 10);
        if (!isNaN(initialNumber)) {
            inputElement.value = (initialNumber / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    }
}


// ============================================================
// LEADS - Carregar e Renderizar
// ============================================================
async function loadAndRenderLeads(filterProject) {
    try {
        let query = supabase.from('leads').select('*');
        if (filterProject && isAdmin) {
            query = query.eq('projeto', filterProject);
        } else if (!isAdmin && currentUserProjeto) {
            query = query.eq('projeto', currentUserProjeto);
        }
        query = query.order('created_at', { ascending: false });
        const { data: leads, error } = await query;
        if (error) { console.warn('Erro ao carregar leads:', error); return; }
        allLeads = leads || [];
        
        // Renderizar leads na tabela
        for (const lead of allLeads) {
            if (lead.status === 'CONVERTIDO') continue; // Não mostrar leads já convertidos
            const row = document.createElement('tr');
            row.dataset.leadId = lead.id;
            row.dataset.tipo = 'lead';
            row.classList.add('lead-row');
            
            // Encontrar quem indicou
            let indicadoPor = '';
            if (lead.indicado_por_cliente_id) {
                const cliente = allClientes.find(c => c.id === lead.indicado_por_cliente_id);
                if (cliente) indicadoPor = cliente.nome;
            }
            
            const statusColors = { 'NOVO': '#60a5fa', 'EM_CONTATO': '#f59e0b', 'NEGOCIANDO': '#a78bfa', 'CONVERTIDO': '#22c55e', 'PERDIDO': '#ef4444' };
            const statusColor = statusColors[lead.status] || '#888';
            
            row.innerHTML = `
                <td data-label="Nome" style="position:sticky;left:0;z-index:2;background:var(--theme-bg-surface);">
                    <span style="font-weight:600;">${sanitizeInput(lead.nome)}</span>
                </td>
                <td data-label="Tipo">
                    <span class="tipo-badge tipo-lead">LEAD</span>
                    ${indicadoPor ? `<div class="lead-indicado" title="Indicado por: ${sanitizeInput(indicadoPor)}">via ${sanitizeInput(indicadoPor)}</div>` : ''}
                </td>
                <td data-label="WhatsApp">
                    <div class="whatsapp-cell">
                        ${lead.whatsapp ? `<button class="whatsapp-btn-lead" data-phone="${sanitizeInput(lead.whatsapp)}" title="Abrir conversa no WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>` : '<i class="fa-brands fa-whatsapp phone-icon"></i>'}
                        <span style="font-size:0.85rem;">${sanitizeInput(lead.whatsapp || '--')}</span>
                    </div>
                </td>
                <td data-label="Projeto"><span style="font-size:0.85rem;">${sanitizeInput(lead.projeto || '--')}</span></td>
                <td data-label="Login / Senha"><span style="color:var(--theme-text-muted);font-size:0.8rem;">--</span></td>
                <td data-label="Status/Atribuição">
                    <select class="lead-status-select" data-lead-id="${lead.id}" style="font-size:0.8rem;padding:0.3rem;border-radius:4px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:${statusColor};">
                        <option value="NOVO" ${lead.status === 'NOVO' ? 'selected' : ''}>Novo</option>
                        <option value="EM_CONTATO" ${lead.status === 'EM_CONTATO' ? 'selected' : ''}>Em Contato</option>
                        <option value="NEGOCIANDO" ${lead.status === 'NEGOCIANDO' ? 'selected' : ''}>Negociando</option>
                        <option value="CONVERTIDO" ${lead.status === 'CONVERTIDO' ? 'selected' : ''}>Convertido</option>
                        <option value="PERDIDO" ${lead.status === 'PERDIDO' ? 'selected' : ''}>Perdido</option>
                    </select>
                </td>
                <td data-label="Dashboard"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Plano Ref."><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Mensalidade"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Últ. Reunião"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Pend. Consultor"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Pend. Cliente"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Patrimônio"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Dívidas"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Fluxo Mensal"><span style="color:var(--theme-text-muted);">--</span></td>
                <td data-label="Situação"><span style="color:var(--theme-text-muted);font-size:0.8rem;">${lead.observacoes ? sanitizeInput(lead.observacoes.substring(0,30)) + '...' : '--'}</span></td>
                <td data-label="Ações">
                    <button class="msg-action-btn delete-lead-btn" data-lead-id="${lead.id}" title="Excluir Lead" style="color:#ef4444;">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>
            `;
            clientsTableBody.appendChild(row);
            
            // Lead status change listener
            const statusSelect = row.querySelector('.lead-status-select');
            if (statusSelect) {
                statusSelect.addEventListener('change', async (e) => {
                    const newStatus = e.target.value;
                    const leadId = e.target.dataset.leadId;
                    try {
                        await supabase.from('leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', leadId);
                        const colors = { 'NOVO': '#60a5fa', 'EM_CONTATO': '#f59e0b', 'NEGOCIANDO': '#a78bfa', 'CONVERTIDO': '#22c55e', 'PERDIDO': '#ef4444' };
                        e.target.style.color = colors[newStatus] || '#888';
                        if (newStatus === 'CONVERTIDO') {
                            alert('Lead marcado como Convertido! Crie um novo cliente para ele na seção de cadastro acima.');
                        }
                    } catch (err) {
                        console.error('Erro ao atualizar status do lead:', err);
                        alert('Erro ao atualizar status: ' + err.message);
                    }
                });
            }
            
            // Delete lead listener
            const deleteLeadBtn = row.querySelector('.delete-lead-btn');
            if (deleteLeadBtn) {
                deleteLeadBtn.addEventListener('click', async () => {
                    const leadId = deleteLeadBtn.dataset.leadId;
                    if (!confirm('Tem certeza que deseja excluir este lead?')) return;
                    try {
                        await supabase.from('leads').delete().eq('id', leadId);
                        row.remove();
                    } catch (err) {
                        alert('Erro ao excluir lead: ' + err.message);
                    }
                });
            }
            
            // WhatsApp button for lead
            const whatsBtn = row.querySelector('.whatsapp-btn-lead');
            if (whatsBtn) {
                whatsBtn.addEventListener('click', () => {
                    let phone = whatsBtn.dataset.phone.replace(/\D/g, '');
                    if (phone.length === 11 && !phone.startsWith('55')) phone = '55' + phone;
                    if (phone.length === 10 && !phone.startsWith('55')) phone = '55' + phone;
                    window.open('https://wa.me/' + phone, '_blank');
                });
            }
        }
    } catch (err) {
        console.warn('Erro geral ao carregar leads:', err);
    }
}

// ============================================================
// LEADS - Modal e CRUD (Multi-lead)
// ============================================================
let leadRowCounter = 0;

function addLeadRow() {
    const container = document.getElementById('leads-rows-container');
    if (!container) return;
    leadRowCounter++;
    const rowDiv = document.createElement('div');
    rowDiv.className = 'lead-row-item';
    rowDiv.dataset.rowId = leadRowCounter;
    rowDiv.innerHTML = `
        <input type="text" class="lead-row-nome" placeholder="Nome *">
        <input type="text" class="lead-row-whats" placeholder="(81) 9xxxx-xxxx">
        <input type="text" class="lead-row-obs" placeholder="Observação...">
        <button class="lead-remove-row" title="Remover linha"><i class="fas fa-times"></i></button>
    `;
    rowDiv.querySelector('.lead-remove-row').addEventListener('click', () => {
        rowDiv.remove();
        // Garantir pelo menos 1 linha
        const remaining = container.querySelectorAll('.lead-row-item');
        if (remaining.length === 0) addLeadRow();
    });
    container.appendChild(rowDiv);
    // Foco no campo nome da nova linha
    rowDiv.querySelector('.lead-row-nome').focus();
}

function openLeadModal() {
    if (!leadModal) return;
    // Preencher dropdown de "Indicado por" com clientes atuais
    const selectIndicado = document.getElementById('lead-indicado-por');
    if (selectIndicado) {
        selectIndicado.innerHTML = '<option value="">-- Nenhum (sem indicação) --</option>';
        allClientes.forEach(c => {
            selectIndicado.innerHTML += `<option value="${c.id}">${sanitizeInput(c.nome)}</option>`;
        });
    }
    // Limpar container de linhas e adicionar header + 1 linha inicial
    const container = document.getElementById('leads-rows-container');
    if (container) {
        container.innerHTML = `<div class="lead-rows-header"><span>Nome *</span><span>WhatsApp</span><span>Observação</span><span></span></div>`;
    }
    leadRowCounter = 0;
    addLeadRow();
    
    // Listener do botão "Adicionar mais uma linha"
    const addRowBtn = document.getElementById('lead-add-row-btn');
    if (addRowBtn) {
        // Remover listeners antigos clonando
        const newBtn = addRowBtn.cloneNode(true);
        addRowBtn.parentNode.replaceChild(newBtn, addRowBtn);
        newBtn.addEventListener('click', addLeadRow);
    }
    
    leadModal.style.display = 'flex';
}

async function saveLead() {
    const container = document.getElementById('leads-rows-container');
    if (!container) return;
    const indicadoPor = document.getElementById('lead-indicado-por')?.value || null;
    const rows = container.querySelectorAll('.lead-row-item');
    
    // Coletar dados de todas as linhas
    const leadsToInsert = [];
    let hasError = false;
    rows.forEach((row, idx) => {
        const nome = row.querySelector('.lead-row-nome')?.value.trim();
        const whats = row.querySelector('.lead-row-whats')?.value.trim();
        const obs = row.querySelector('.lead-row-obs')?.value.trim();
        if (!nome) {
            if (rows.length === 1 || whats || obs) {
                // Linha com dados parciais mas sem nome
                hasError = true;
            }
            return; // Pular linhas completamente vazias
        }
        leadsToInsert.push({
            nome,
            whatsapp: whats || null,
            observacoes: obs || null,
            indicado_por_cliente_id: indicadoPor || null,
            projeto: currentUserProjeto || 'Planejamento',
            criado_por_id: currentUserId,
            status: 'NOVO'
        });
    });
    
    if (hasError) { alert('Preencha o nome em todas as linhas que possuem dados.'); return; }
    if (leadsToInsert.length === 0) { alert('Adicione pelo menos um lead com nome.'); return; }
    
    try {
        const { error } = await supabase.from('leads').insert(leadsToInsert);
        if (error) throw error;
        const msg = leadsToInsert.length === 1 ? 'Lead adicionado com sucesso!' : `${leadsToInsert.length} leads adicionados com sucesso!`;
        alert(msg);
        leadModal.style.display = 'none';
        // Recarregar
        loadClients(currentUserProjeto);
    } catch (err) {
        alert('Erro ao salvar lead(s): ' + err.message);
    }
}

// ============================================================
// PLANO DE REFERÊNCIA - Célula e Modal
// ============================================================
async function fetchPlanoRefCell(clienteId, planoValorTotal, mensalidade, row) {
    const cellPlano = row.querySelector('.plano-ref-cell');
    const cellMensal = row.querySelector('.mensalidade-cell');
    
    if (cellPlano) {
        if (planoValorTotal && planoValorTotal > 0) {
            // Buscar parcelas
            try {
                const { data: parcelas, error } = await supabase
                    .from('plano_ref_parcelas')
                    .select('*')
                    .eq('cliente_id', clienteId)
                    .order('numero_parcela', { ascending: true });
                
                if (error) throw error;
                allPlanoRefParcelas[clienteId] = parcelas || [];
                
                const totalPago = (parcelas || []).filter(p => p.pago).reduce((s, p) => s + (p.valor || 0), 0);
                const totalPendente = planoValorTotal - totalPago;
                const hoje = new Date().toISOString().split('T')[0];
                const temVencida = (parcelas || []).some(p => !p.pago && p.data_vencimento < hoje);
                
                let statusClass = 'status-em-dia';
                let statusText = `${(parcelas||[]).filter(p=>p.pago).length}/${(parcelas||[]).length} pagas`;
                let cellClass = '';
                
                if (totalPendente <= 0) {
                    statusClass = 'status-quitado';
                    statusText = 'Quitado';
                } else if (temVencida) {
                    statusClass = 'status-vencido';
                    statusText = 'VENCIDO!';
                    cellClass = 'cell-vencido';
                } else if (totalPendente > 0) {
                    cellClass = 'cell-pendente';
                }
                
                cellPlano.className = 'plano-ref-cell ' + cellClass;
                cellPlano.innerHTML = `
                    <button class="plano-ref-btn" data-client-id="${clienteId}" data-client-name="${row.querySelector('.client-name')?.value || ''}" style="background:none;border:none;cursor:pointer;color:inherit;width:100%;">
                        <span class="plano-valor">${fmtBRL(planoValorTotal)}</span>
                        <span class="plano-status ${statusClass}">${statusText}</span>
                    </button>
                `;
                
                // Acumular para summary
                _financialSummary.totalVendido += planoValorTotal;
                _financialSummary.totalRecebido += totalPago;
                if (temVencida) _financialSummary.totalPendente += totalPendente;
            } catch (err) {
                cellPlano.innerHTML = `<button class="plano-ref-btn" data-client-id="${clienteId}" data-client-name="${row.querySelector('.client-name')?.value || ''}" style="background:none;border:none;cursor:pointer;color:var(--theme-text-muted);width:100%;"><span style="font-size:0.8rem;">Configurar</span></button>`;
            }
        } else {
            cellPlano.innerHTML = `<button class="plano-ref-btn" data-client-id="${clienteId}" data-client-name="${row.querySelector('.client-name')?.value || ''}" style="background:none;border:none;cursor:pointer;color:var(--theme-text-muted);width:100%;font-size:0.8rem;">--</button>`;
        }
    }
    
    if (cellMensal) {
        if (mensalidade && mensalidade > 0) {
            cellMensal.innerHTML = `<button class="mensalidade-btn" data-client-id="${clienteId}" data-client-name="${row.querySelector('.client-name')?.value || ''}" style="background:none;border:none;cursor:pointer;color:inherit;width:100%;font-weight:600;">${fmtBRL(mensalidade)}</button>`;
            _financialSummary.totalMensalidades += mensalidade;
        } else {
            cellMensal.className = 'mensalidade-cell mensal-zero';
            cellMensal.innerHTML = `<button class="mensalidade-btn" data-client-id="${clienteId}" data-client-name="${row.querySelector('.client-name')?.value || ''}" style="background:none;border:none;cursor:pointer;color:var(--theme-text-muted);width:100%;font-size:0.8rem;">--</button>`;
        }
    }
}

async function openPlanoRefModal(clienteId, clientName) {
    if (!planoRefModal) return;
    const title = document.getElementById('plano-ref-title');
    const body = document.getElementById('plano-ref-body');
    if (title) title.textContent = `Plano de Referência: ${clientName || ''}`;
    if (body) body.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    planoRefModal.style.display = 'flex';
    
    try {
        // Buscar dados do cliente
        const { data: clientData } = await supabase.from('clientes').select('plano_ref_valor_total, mensalidade').eq('id', clienteId).maybeSingle();
        const valorTotal = clientData?.plano_ref_valor_total || 0;
        
        // Buscar parcelas
        const { data: parcelas, error } = await supabase
            .from('plano_ref_parcelas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('numero_parcela', { ascending: true });
        if (error) throw error;
        
        const parcelasArr = parcelas || [];
        const totalPago = parcelasArr.filter(p => p.pago).reduce((s, p) => s + (p.valor || 0), 0);
        const totalPendente = valorTotal - totalPago;
        const hoje = new Date().toISOString().split('T')[0];
        
        let html = `
            <div class="plano-form-grid">
                <div>
                    <label>Valor Total do Plano</label>
                    <input type="text" id="plano-valor-total-input" value="${valorTotal > 0 ? fmtBRL(valorTotal) : ''}" placeholder="R$ 0,00">
                </div>
                <div>
                    <label>Nº de Parcelas para Gerar</label>
                    <div style="display:flex;gap:0.5rem;">
                        <input type="number" id="plano-num-parcelas" value="1" min="1" max="24" style="flex:1;">
                        <button id="plano-gerar-parcelas-btn" style="padding:0.4rem 0.8rem;border-radius:4px;border:1px solid rgba(218,165,32,0.4);background:rgba(218,165,32,0.1);color:var(--theme-secondary-lighter);cursor:pointer;font-size:0.8rem;white-space:nowrap;">Gerar</button>
                    </div>
                </div>
                <div>
                    <label>Data 1ª Parcela (para geração)</label>
                    <input type="date" id="plano-data-inicio" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div>
                    <label>Salvar Valor Total</label>
                    <button id="plano-salvar-valor-btn" style="width:100%;padding:0.5rem;border-radius:4px;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.1);color:#22c55e;cursor:pointer;font-weight:600;">Salvar</button>
                </div>
            </div>
        `;
        
        if (valorTotal > 0) {
            html += `
                <div class="plano-summary-box">
                    <div class="ps-item"><span class="ps-label">Total</span><span class="ps-value ps-gold">${fmtBRL(valorTotal)}</span></div>
                    <div class="ps-item"><span class="ps-label">Recebido</span><span class="ps-value ps-green">${fmtBRL(totalPago)}</span></div>
                    <div class="ps-item"><span class="ps-label">Pendente</span><span class="ps-value ${totalPendente > 0 ? 'ps-red' : 'ps-green'}">${fmtBRL(totalPendente)}</span></div>
                    <div class="ps-item"><span class="ps-label">Parcelas</span><span class="ps-value">${parcelasArr.filter(p=>p.pago).length}/${parcelasArr.length}</span></div>
                </div>
            `;
        }
        
        if (parcelasArr.length > 0) {
            html += `<table class="parcelas-table">
                <thead><tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Pago?</th><th>Data Pgto</th><th>Obs</th><th></th></tr></thead>
                <tbody>`;
            parcelasArr.forEach(p => {
                const vencida = !p.pago && p.data_vencimento < hoje;
                const rowClass = p.pago ? 'parcela-paga' : vencida ? 'parcela-vencida' : '';
                html += `<tr class="${rowClass}">
                    <td>${p.numero_parcela}</td>
                    <td><input type="text" class="parcela-valor" data-parcela-id="${p.id}" value="${p.valor > 0 ? fmtBRL(p.valor) : ''}" placeholder="R$ 0,00" style="width:100px;font-size:0.8rem;padding:0.2rem 0.3rem;border-radius:3px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);text-align:right;"></td>
                    <td><input type="date" class="parcela-vencimento" data-parcela-id="${p.id}" value="${p.data_vencimento || ''}" style="font-size:0.8rem;padding:0.2rem;border-radius:3px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);">${vencida ? ' <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>' : ''}</td>
                    <td><input type="checkbox" class="check-pago" data-parcela-id="${p.id}" ${p.pago ? 'checked' : ''}></td>
                    <td><input type="date" class="parcela-data-pgto" data-parcela-id="${p.id}" value="${p.data_pagamento || ''}" style="font-size:0.8rem;padding:0.2rem;border-radius:3px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);"></td>
                    <td><input type="text" class="parcela-obs" data-parcela-id="${p.id}" value="${sanitizeInput(p.observacao || '')}" placeholder="..." style="width:80px;font-size:0.78rem;padding:0.2rem;border-radius:3px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);"></td>
                    <td><button class="parcela-delete-btn" data-parcela-id="${p.id}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8rem;" title="Excluir parcela"><i class="fas fa-times"></i></button></td>
                </tr>`;
            });
            html += `</tbody></table>`;
        } else if (valorTotal > 0) {
            html += `<p style="color:var(--theme-text-muted);font-size:0.85rem;text-align:center;margin-top:1rem;">Nenhuma parcela cadastrada. Use o botão "Gerar" acima para criar parcelas.</p>`;
        }
        
        body.innerHTML = html;
        
        // Aplicar máscara de moeda ao campo de valor total
        addCurrencyMask(document.getElementById('plano-valor-total-input'));
        
        // Aplicar máscara de moeda a todos os campos de valor de parcela
        body.querySelectorAll('.parcela-valor').forEach(input => {
            addCurrencyMask(input);
        });
        
        // --- Event Listeners dentro do modal ---
        // Salvar valor total
        const salvarValorBtn = document.getElementById('plano-salvar-valor-btn');
        if (salvarValorBtn) {
            salvarValorBtn.addEventListener('click', async () => {
                const novoValor = parseBRL(document.getElementById('plano-valor-total-input')?.value);
                try {
                    await supabase.from('clientes').update({ plano_ref_valor_total: novoValor }).eq('id', clienteId);
                    alert('Valor total salvo!');
                    openPlanoRefModal(clienteId, clientName); // Refresh
                    // Atualizar célula
                    const row = clientsTableBody.querySelector(`tr[data-client-id="${clienteId}"]`);
                    if (row) fetchPlanoRefCell(clienteId, novoValor, clientData?.mensalidade, row);
                } catch (err) { alert('Erro: ' + err.message); }
            });
        }
        
        // Gerar parcelas
        const gerarBtn = document.getElementById('plano-gerar-parcelas-btn');
        if (gerarBtn) {
            gerarBtn.addEventListener('click', async () => {
                const numParcelas = parseInt(document.getElementById('plano-num-parcelas')?.value) || 1;
                const dataInicio = document.getElementById('plano-data-inicio')?.value;
                const valorTotalAtual = parseBRL(document.getElementById('plano-valor-total-input')?.value);
                if (!dataInicio) { alert('Informe a data da 1ª parcela.'); return; }
                if (valorTotalAtual <= 0) { alert('Informe o valor total do plano primeiro.'); return; }
                
                const valorParcela = Math.round((valorTotalAtual / numParcelas) * 100) / 100;
                const novasParcelas = [];
                const startDate = new Date(dataInicio + 'T12:00:00');
                const ultimaParcela = parcelasArr.length > 0 ? Math.max(...parcelasArr.map(p => p.numero_parcela)) : 0;
                
                for (let i = 0; i < numParcelas; i++) {
                    const dt = new Date(startDate);
                    dt.setMonth(dt.getMonth() + i);
                    novasParcelas.push({
                        cliente_id: clienteId,
                        numero_parcela: ultimaParcela + i + 1,
                        valor: valorParcela,
                        data_vencimento: dt.toISOString().split('T')[0],
                        pago: false
                    });
                }
                
                try {
                    const { error } = await supabase.from('plano_ref_parcelas').insert(novasParcelas);
                    if (error) throw error;
                    alert(`${numParcelas} parcela(s) gerada(s)!`);
                    openPlanoRefModal(clienteId, clientName); // Refresh
                } catch (err) { alert('Erro ao gerar parcelas: ' + err.message); }
            });
        }
        
        // Checkbox pago
        body.querySelectorAll('.check-pago').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                const parcelaId = e.target.dataset.parcelaId;
                const pago = e.target.checked;
                const dataPgto = pago ? new Date().toISOString().split('T')[0] : null;
                try {
                    await supabase.from('plano_ref_parcelas').update({ pago, data_pagamento: dataPgto }).eq('id', parcelaId);
                    // Atualizar input de data ao lado
                    const dateInput = body.querySelector(`.parcela-data-pgto[data-parcela-id="${parcelaId}"]`);
                    if (dateInput && pago) dateInput.value = dataPgto;
                    // Refresh modal after brief delay
                    setTimeout(() => openPlanoRefModal(clienteId, clientName), 300);
                } catch (err) { alert('Erro: ' + err.message); }
            });
        });
        
        // Valor da parcela change (com máscara de moeda)
        body.querySelectorAll('.parcela-valor').forEach(input => {
            input.addEventListener('change', async (e) => {
                const parcelaId = e.target.dataset.parcelaId;
                const novoValor = parseBRL(e.target.value);
                try {
                    await supabase.from('plano_ref_parcelas').update({ valor: novoValor }).eq('id', parcelaId);
                } catch (err) { console.warn('Erro ao salvar valor:', err); }
            });
        });
        
        // Data vencimento change
        body.querySelectorAll('.parcela-vencimento').forEach(input => {
            input.addEventListener('change', async (e) => {
                const parcelaId = e.target.dataset.parcelaId;
                const dataVenc = e.target.value || null;
                try {
                    await supabase.from('plano_ref_parcelas').update({ data_vencimento: dataVenc }).eq('id', parcelaId);
                } catch (err) { console.warn('Erro ao salvar vencimento:', err); }
            });
        });
        
        // Data pagamento change
        body.querySelectorAll('.parcela-data-pgto').forEach(input => {
            input.addEventListener('change', async (e) => {
                const parcelaId = e.target.dataset.parcelaId;
                const dataPgto = e.target.value || null;
                try {
                    await supabase.from('plano_ref_parcelas').update({ data_pagamento: dataPgto }).eq('id', parcelaId);
                } catch (err) { console.warn('Erro ao salvar data:', err); }
            });
        });
        
        // Observação change
        body.querySelectorAll('.parcela-obs').forEach(input => {
            input.addEventListener('change', async (e) => {
                const parcelaId = e.target.dataset.parcelaId;
                const obs = e.target.value || null;
                try {
                    await supabase.from('plano_ref_parcelas').update({ observacao: obs }).eq('id', parcelaId);
                } catch (err) { console.warn('Erro ao salvar obs:', err); }
            });
        });
        
        // Delete parcela
        body.querySelectorAll('.parcela-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const parcelaId = e.currentTarget.dataset.parcelaId;
                if (!confirm('Excluir esta parcela?')) return;
                try {
                    await supabase.from('plano_ref_parcelas').delete().eq('id', parcelaId);
                    openPlanoRefModal(clienteId, clientName); // Refresh
                } catch (err) { alert('Erro: ' + err.message); }
            });
        });
        
    } catch (err) {
        body.innerHTML = `<p style="color:#ef4444;">Erro ao carregar dados: ${err.message}</p>`;
    }
}

// ============================================================
// MENSALIDADE - Modal (com dados Cyclopay como referência)
// ============================================================
async function openMensalidadeModal(clienteId, clientName) {
    if (!mensalidadeModal) return;
    const title = document.getElementById('mensalidade-title');
    const body = document.getElementById('mensalidade-body');
    if (title) title.textContent = `Mensalidade — ${clientName || ''}`;
    if (body) body.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    mensalidadeModal.style.display = 'flex';
    
    try {
        // Buscar dados do sistema
        const { data: clientData } = await supabase.from('clientes').select('mensalidade, whatsapp, nome').eq('id', clienteId).maybeSingle();
        const mensalidade = clientData?.mensalidade || 0;

        // Buscar dados do Cyclopay para referência
        let cycloInfo = null;
        try {
            const CYCLOPAY_API_KEY = 'ak_aeb26f6be167cc077eb227c128262e731523d492';
            const cycloResp = await fetch('https://api.cyclopay.com/v1/customers?count=100', {
                method: 'GET',
                headers: { 'api_key': CYCLOPAY_API_KEY, 'Accept': 'application/json' }
            });
            if (cycloResp.ok) {
                const cycloData = await cycloResp.json();
                const cycloCustomers = cycloData.items || [];
                const dashWhatsClean = (clientData?.whatsapp || '').replace(/\D/g, '');
                const dashName = (clientName || '').toLowerCase().trim();

                // Match por WhatsApp
                let match = null;
                if (dashWhatsClean.length >= 8) {
                    match = cycloCustomers.find(cust => {
                        const custPhone = String(cust.mobile_number || cust.mobile_phone || cust.phone || '').replace(/\D/g, '');
                        if (custPhone.length < 8) return false;
                        return dashWhatsClean.slice(-9) === custPhone.slice(-9);
                    });
                }
                // Match por nome
                if (!match && dashName) {
                    match = cycloCustomers.find(cust => {
                        const custFull = ((cust.first_name || '') + ' ' + (cust.last_name || '')).toLowerCase().trim();
                        return custFull === dashName || (dashName.split(/\s+/).length >= 2 && (custFull.includes(dashName) || dashName.includes(custFull)));
                    });
                }

                if (match) {
                    // Buscar assinatura para obter valor
                    const subsResp = await fetch(`https://api.cyclopay.com/v1/subscriptions?count=100`, {
                        method: 'GET',
                        headers: { 'api_key': CYCLOPAY_API_KEY, 'Accept': 'application/json' }
                    });
                    let planName = '-';
                    let planValue = null;
                    if (subsResp.ok) {
                        const subsData = await subsResp.json();
                        const sub = (subsData.items || []).find(s => s.customer_id === match.customer_id);
                        if (sub) {
                            planName = (sub.plan && sub.plan.name) || sub.product_name || sub.plan_name || '-';
                            planValue = sub.amount || (sub.plan && sub.plan.amount) || null;
                        }
                    }
                    cycloInfo = {
                        nome: `${match.first_name} ${match.last_name || ''}`.trim(),
                        plano: planName,
                        valor: planValue,
                        ativo: match.active
                    };
                }
            }
        } catch (cycloErr) {
            console.warn('Cyclopay indisponível:', cycloErr.message);
        }

        // Montar HTML do modal
        let cycloHtml = '';
        if (cycloInfo) {
            const valorDisplay = cycloInfo.valor ? `R$ ${(cycloInfo.valor / 100).toFixed(2).replace('.', ',')}` : '--';
            cycloHtml = `
                <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:8px;padding:12px;margin-bottom:1rem;">
                    <div style="font-size:0.75rem;color:#d4af37;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Dados Cyclopay (Referência)</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;">
                        <div><span style="color:var(--theme-text-muted);">Plano:</span> <strong>${cycloInfo.plano}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Valor:</span> <strong>${valorDisplay}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Status:</span> <strong style="color:${cycloInfo.ativo ? '#22c55e' : '#ef4444'};">${cycloInfo.ativo ? 'Ativo' : 'Inativo'}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Nome:</span> ${cycloInfo.nome}</div>
                    </div>
                    ${cycloInfo.valor ? `<button id="mensalidade-usar-cyclo" style="margin-top:8px;background:rgba(212,175,55,0.15);border:1px solid #d4af37;color:#d4af37;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">Usar valor Cyclopay</button>` : ''}
                </div>
            `;
        } else {
            cycloHtml = `<div style="background:rgba(100,100,100,0.1);border:1px solid rgba(100,100,100,0.3);border-radius:8px;padding:10px;margin-bottom:1rem;font-size:0.8rem;color:var(--theme-text-muted);text-align:center;">Cliente não encontrado no Cyclopay</div>`;
        }

        body.innerHTML = `
            ${cycloHtml}
            <div style="margin-bottom:1rem;">
                <label style="font-size:0.85rem;color:var(--theme-text-muted);display:block;margin-bottom:0.5rem;">Valor Final da Mensalidade</label>
                <input type="text" id="mensalidade-valor-input" value="${mensalidade > 0 ? fmtBRL(mensalidade) : ''}" placeholder="R$ 0,00" style="width:100%;padding:0.6rem;border-radius:6px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);font-size:1.1rem;font-weight:600;">
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                <button id="mensalidade-cancel" class="msg-modal-btn msg-cancel-btn">Cancelar</button>
                <button id="mensalidade-salvar" class="msg-modal-btn msg-save-btn">Salvar</button>
            </div>
        `;
        
        // Aplicar máscara de moeda
        addCurrencyMask(document.getElementById('mensalidade-valor-input'));

        // Botão "Usar valor Cyclopay"
        const usarCycloBtn = document.getElementById('mensalidade-usar-cyclo');
        if (usarCycloBtn && cycloInfo?.valor) {
            usarCycloBtn.addEventListener('click', () => {
                const input = document.getElementById('mensalidade-valor-input');
                if (input) input.value = fmtBRL(cycloInfo.valor / 100);
            });
        }
        
        document.getElementById('mensalidade-cancel')?.addEventListener('click', () => { mensalidadeModal.style.display = 'none'; });
        document.getElementById('mensalidade-salvar')?.addEventListener('click', async () => {
            const novoValor = parseBRL(document.getElementById('mensalidade-valor-input')?.value);
            try {
                await supabase.from('clientes').update({ mensalidade: novoValor }).eq('id', clienteId);
                alert('Mensalidade salva!');
                mensalidadeModal.style.display = 'none';
                const row = clientsTableBody.querySelector(`tr[data-client-id="${clienteId}"]`);
                if (row) {
                    const cell = row.querySelector('.mensalidade-cell');
                    if (cell) {
                        if (novoValor > 0) {
                            cell.className = 'mensalidade-cell';
                            cell.innerHTML = `<button class="mensalidade-btn" data-client-id="${clienteId}" data-client-name="${clientName}" style="background:none;border:none;cursor:pointer;color:inherit;width:100%;font-weight:600;">${fmtBRL(novoValor)}</button>`;
                        } else {
                            cell.className = 'mensalidade-cell mensal-zero';
                            cell.innerHTML = `<button class="mensalidade-btn" data-client-id="${clienteId}" data-client-name="${clientName}" style="background:none;border:none;cursor:pointer;color:var(--theme-text-muted);width:100%;font-size:0.8rem;">--</button>`;
                        }
                    }
                }
            } catch (err) { alert('Erro: ' + err.message); }
        });
    } catch (err) {
        body.innerHTML = `<p style="color:#ef4444;">Erro: ${err.message}</p>`;
    }
}

// ============================================================
// SITUAÇÃO - Modal (com dados Cyclopay como referência)
// ============================================================
async function openSituacaoModal(clienteId, clientName) {
    if (!situacaoModal) return;
    const title = document.getElementById('situacao-title');
    const body = document.getElementById('situacao-body');
    if (title) title.textContent = `Situação — ${clientName || ''}`;
    if (body) body.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    situacaoModal.style.display = 'flex';
    
    try {
        // Buscar dados do sistema
        const { data: clientData } = await supabase.from('clientes').select('situacao, whatsapp, nome').eq('id', clienteId).maybeSingle();
        const situacaoAtual = clientData?.situacao || 'ATIVO';

        // Buscar dados do Cyclopay
        let cycloInfo = null;
        try {
            const CYCLOPAY_API_KEY = 'ak_aeb26f6be167cc077eb227c128262e731523d492';
            const cycloResp = await fetch('https://api.cyclopay.com/v1/customers?count=100', {
                method: 'GET',
                headers: { 'api_key': CYCLOPAY_API_KEY, 'Accept': 'application/json' }
            });
            if (cycloResp.ok) {
                const cycloData = await cycloResp.json();
                const cycloCustomers = cycloData.items || [];
                const dashWhatsClean = (clientData?.whatsapp || '').replace(/\D/g, '');
                const dashName = (clientName || '').toLowerCase().trim();

                let match = null;
                if (dashWhatsClean.length >= 8) {
                    match = cycloCustomers.find(cust => {
                        const custPhone = String(cust.mobile_number || cust.mobile_phone || cust.phone || '').replace(/\D/g, '');
                        if (custPhone.length < 8) return false;
                        return dashWhatsClean.slice(-9) === custPhone.slice(-9);
                    });
                }
                if (!match && dashName) {
                    match = cycloCustomers.find(cust => {
                        const custFull = ((cust.first_name || '') + ' ' + (cust.last_name || '')).toLowerCase().trim();
                        return custFull === dashName || (dashName.split(/\s+/).length >= 2 && (custFull.includes(dashName) || dashName.includes(custFull)));
                    });
                }

                if (match) {
                    // Buscar assinatura e transações
                    const [subsResp, transResp] = await Promise.all([
                        fetch('https://api.cyclopay.com/v1/subscriptions?count=100', { method: 'GET', headers: { 'api_key': CYCLOPAY_API_KEY, 'Accept': 'application/json' } }),
                        fetch('https://api.cyclopay.com/v1/transactions?orderDir=desc&count=20', { method: 'GET', headers: { 'api_key': CYCLOPAY_API_KEY, 'Accept': 'application/json' } })
                    ]);

                    let planName = '-', nextCharge = null, lastChargeDate = null, lastStatus = null;
                    if (subsResp.ok) {
                        const subsData = await subsResp.json();
                        const sub = (subsData.items || []).find(s => s.customer_id === match.customer_id);
                        if (sub) {
                            planName = (sub.plan && sub.plan.name) || sub.product_name || sub.plan_name || '-';
                            nextCharge = sub.next_charge;
                            lastChargeDate = sub.last_charge_date;
                        }
                    }
                    if (transResp.ok) {
                        const transData = await transResp.json();
                        const clientTrans = (transData.items || []).filter(t => t.customer && t.customer.customer_id === match.customer_id);
                        if (clientTrans.length > 0) {
                            lastStatus = clientTrans[0].transaction_status;
                            if (!lastChargeDate) lastChargeDate = clientTrans[0].create_date;
                        }
                    }

                    cycloInfo = {
                        nome: `${match.first_name} ${match.last_name || ''}`.trim(),
                        plano: planName,
                        ativo: match.active,
                        nextCharge: nextCharge,
                        lastChargeDate: lastChargeDate,
                        lastStatus: lastStatus
                    };
                }
            }
        } catch (cycloErr) {
            console.warn('Cyclopay indisponível:', cycloErr.message);
        }

        // Montar HTML
        let cycloHtml = '';
        if (cycloInfo) {
            const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '--';
            let statusLabel = '--';
            let statusColor = 'var(--theme-text-muted)';
            if (cycloInfo.lastStatus) {
                if (cycloInfo.lastStatus === 'paid' || cycloInfo.lastStatus === 'authorized') { statusLabel = 'Pago'; statusColor = '#22c55e'; }
                else if (cycloInfo.lastStatus === 'refused' || cycloInfo.lastStatus === 'failed') { statusLabel = 'Falhou'; statusColor = '#ef4444'; }
                else if (cycloInfo.lastStatus === 'pending' || cycloInfo.lastStatus === 'waiting_payment') { statusLabel = 'Pendente'; statusColor = '#f59e0b'; }
                else { statusLabel = cycloInfo.lastStatus; }
            }

            // Sugestão automática baseada nos dados
            let sugestao = 'ATIVO';
            let sugestaoMotivo = '';
            if (!cycloInfo.ativo) {
                sugestao = 'PAROU';
                sugestaoMotivo = 'Cliente inativo no Cyclopay';
            } else if (cycloInfo.lastStatus === 'refused' || cycloInfo.lastStatus === 'failed') {
                sugestao = 'EM_HIATO';
                sugestaoMotivo = 'Última cobrança falhou';
            }

            cycloHtml = `
                <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:8px;padding:12px;margin-bottom:1rem;">
                    <div style="font-size:0.75rem;color:#d4af37;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Dados Cyclopay (Referência)</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;">
                        <div><span style="color:var(--theme-text-muted);">Plano:</span> <strong>${cycloInfo.plano}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Status Cyclopay:</span> <strong style="color:${cycloInfo.ativo ? '#22c55e' : '#ef4444'};">${cycloInfo.ativo ? 'Ativo' : 'Inativo'}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Ult. Cobrança:</span> <strong>${fmtDate(cycloInfo.lastChargeDate)}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Status Cobrança:</span> <strong style="color:${statusColor};">${statusLabel}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Próx. Cobrança:</span> <strong>${fmtDate(cycloInfo.nextCharge)}</strong></div>
                        <div><span style="color:var(--theme-text-muted);">Nome:</span> ${cycloInfo.nome}</div>
                    </div>
                    ${sugestaoMotivo ? `<div style="margin-top:8px;padding:6px 10px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:4px;font-size:0.75rem;color:#f59e0b;"><strong>Sugestão:</strong> ${sugestaoMotivo} → <strong>${sugestao === 'PAROU' ? 'Parou' : 'Em Hiato'}</strong></div>` : ''}
                </div>
            `;
        } else {
            cycloHtml = `<div style="background:rgba(100,100,100,0.1);border:1px solid rgba(100,100,100,0.3);border-radius:8px;padding:10px;margin-bottom:1rem;font-size:0.8rem;color:var(--theme-text-muted);text-align:center;">Cliente não encontrado no Cyclopay</div>`;
        }

        body.innerHTML = `
            ${cycloHtml}
            <div style="margin-bottom:1rem;">
                <label style="font-size:0.85rem;color:var(--theme-text-muted);display:block;margin-bottom:0.5rem;">Situação Final</label>
                <select id="situacao-modal-select" style="width:100%;padding:0.6rem;border-radius:6px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);font-size:1rem;font-weight:600;">
                    <option value="ATIVO" ${situacaoAtual === 'ATIVO' ? 'selected' : ''}>Ativo</option>
                    <option value="EM_HIATO" ${situacaoAtual === 'EM_HIATO' ? 'selected' : ''}>Em Hiato</option>
                    <option value="PAROU" ${situacaoAtual === 'PAROU' ? 'selected' : ''}>Parou</option>
                </select>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                <button id="situacao-cancel" class="msg-modal-btn msg-cancel-btn">Cancelar</button>
                <button id="situacao-salvar" class="msg-modal-btn msg-save-btn">Salvar</button>
            </div>
        `;

        document.getElementById('situacao-cancel')?.addEventListener('click', () => { situacaoModal.style.display = 'none'; });
        document.getElementById('situacao-salvar')?.addEventListener('click', async () => {
            const novoValor = document.getElementById('situacao-modal-select')?.value || 'ATIVO';
            try {
                await supabase.from('clientes').update({ situacao: novoValor }).eq('id', clienteId);
                alert('Situação salva!');
                situacaoModal.style.display = 'none';
                // Atualizar select na tabela
                const row = clientsTableBody.querySelector(`tr[data-client-id="${clienteId}"]`);
                if (row) {
                    const sel = row.querySelector('.situacao-select');
                    if (sel) {
                        sel.value = novoValor;
                        sel.className = 'situacao-select ' + (novoValor === 'EM_HIATO' ? 'sit-hiato' : novoValor === 'PAROU' ? 'sit-parou' : 'sit-ativo');
                    }
                }
            } catch (err) { alert('Erro: ' + err.message); }
        });
    } catch (err) {
        body.innerHTML = `<p style="color:#ef4444;">Erro: ${err.message}</p>`;
    }
}

// ============================================================
// FILTRO TIPO (Lead/Cliente/Todos)
// ============================================================
function applyTipoFilter() {
    const filterValue = document.getElementById('filter-tipo')?.value || 'todos';
    const rows = clientsTableBody ? clientsTableBody.querySelectorAll('tr') : [];
    rows.forEach(row => {
        if (filterValue === 'todos') {
            row.classList.remove('tipo-hidden');
        } else if (filterValue === 'lead') {
            if (row.dataset.tipo === 'lead') row.classList.remove('tipo-hidden');
            else row.classList.add('tipo-hidden');
        } else if (filterValue === 'cliente') {
            if (row.dataset.tipo === 'lead') row.classList.add('tipo-hidden');
            else row.classList.remove('tipo-hidden');
        }
    });
}

// Inicializar
document.addEventListener("DOMContentLoaded", initializeDashboard);


// ============================================================
// PENDÊNCIAS MODAL (Consultor / Cliente) - REDESIGN 3 COLUNAS
// ============================================================
const PEND_OBJ_COLORS = ['#D4AF37','#10b981','#3b82f6','#a855f7','#ef4444','#fb923c','#14b8a6','#eab308','#22c55e','#60a5fa'];


async function openPendenciasModal(clientId, clientName, pendType) {
    const modal = document.getElementById('pendencias-modal');
    const wrapper = document.getElementById('pend-modal-wrapper');
    const title = document.getElementById('pendencias-modal-title');
    const body = document.getElementById('pendencias-modal-body');
    if (!modal || !wrapper) return;
    
    const typeLabel = pendType === 'consultor' ? 'Consultor' : 'Cliente';
    title.textContent = `Pendências ${typeLabel}: ${clientName}`;
    body.innerHTML = '<p style="color:var(--theme-text-muted);padding:2rem;text-align:center;">Carregando...</p>';
    modal.style.display = 'block';
    
    // Reset wrapper position
    wrapper.style.top = '5vh';
    wrapper.style.left = '5vw';
    wrapper.style.width = '90vw';
    wrapper.style.height = '85vh';
    
    // Init drag
    _initPendDrag(wrapper);
    // Init resize
    _initPendResize(wrapper);
    
    try {
        const { data, error } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clientId)
            .eq('ferramenta', 'acompanhamento')
            .maybeSingle();
        
        if (error || !data || !data.dados) {
            body.innerHTML = '<p class="pend-empty-col">Nenhum dado de acompanhamento encontrado.</p>';
            return;
        }
        
        const dados = data.dados;
        const micros = Array.isArray(dados.microPassos) ? dados.microPassos : [];
        const macros = Array.isArray(dados.macroPassos) ? dados.macroPassos : [];
        const objetivos = Array.isArray(dados.objetivos) ? dados.objetivos : [];
        
        // Filter by pendType
        let filteredMicros, filteredMacros;
        if (pendType === 'consultor') {
            filteredMicros = micros.filter(m => m.responsavel_consultor);
            filteredMacros = [];
        } else {
            filteredMicros = micros.filter(m => !m.responsavel_consultor);
            filteredMacros = [...macros];
        }
        
        // Assign colors to objectives
        const objColorMap = {};
        objetivos.forEach((obj, i) => {
            objColorMap[String(obj.id)] = PEND_OBJ_COLORS[i % PEND_OBJ_COLORS.length];
        });
        
        // Count micros per objective
        const objMicroCount = {};
        objetivos.forEach(obj => { objMicroCount[String(obj.id)] = 0; });
        filteredMicros.forEach(m => {
            const ids = m.objetivos_ids || (m.objetivo_id ? [m.objetivo_id] : []);
            ids.forEach(oid => {
                if (objMicroCount[String(oid)] !== undefined) objMicroCount[String(oid)]++;
            });
        });
        
        // Build HTML
        let html = '';
        
        // Filter bar
        html += `<div class="pend-filter-bar">
            <input type="text" id="pend-search-input" placeholder="🔍 Buscar por título ou detalhe...">
            <div class="pend-status-badges">
                <span class="pend-status-badge psb-todos active" data-status="todos">Todos</span>
                <span class="pend-status-badge psb-pendente" data-status="pendente">Pendente</span>
                <span class="pend-status-badge psb-em_andamento" data-status="em_andamento">Em Andamento</span>
                <span class="pend-status-badge psb-concluido" data-status="concluido">Concluído</span>
            </div>
        </div>`;
        
        // Content area with SVG + 3 columns
        html += `<div class="pend-content-area">
            <svg class="pend-svg-layer" id="pend-svg-lines"></svg>
            <div class="pend-three-col" id="pend-three-col">`;
        
        // LEFT COLUMN: Objectives
        html += `<div class="pend-col-left" id="pend-col-left">
            <div class="pend-col-title">Objetivos</div>`;
        if (objetivos.length === 0) {
            html += '<div class="pend-empty-col">Nenhum objetivo cadastrado</div>';
        } else {
            objetivos.forEach((obj, i) => {
                const color = objColorMap[String(obj.id)];
                const count = objMicroCount[String(obj.id)] || 0;
                html += `<div class="pend-obj-card" data-obj-id="${obj.id}" style="border-left-color:${color};" id="pend-obj-${obj.id}">
                    <div class="pend-obj-card-name">${sanitizeInput(obj.nome || 'Objetivo ' + (i+1))}</div>
                    <div class="pend-obj-card-count">${count} micro passo${count !== 1 ? 's' : ''}</div>
                </div>`;
            });
        }
        html += '</div>';
        
        // RESIZER between left and center
        html += '<div class="pend-col-resizer" id="pend-resizer-left"></div>';
        
        // CENTER COLUMN: Micro Passos
        html += `<div class="pend-col-center" id="pend-col-center">
            <div class="pend-col-title">Micro Passos</div>`;
        if (filteredMicros.length === 0) {
            html += '<div class="pend-empty-col">Nenhum micro passo pendente</div>';
        } else {
            filteredMicros.forEach((m, idx) => {
                const globalIdx = micros.indexOf(m);
                const statusLabel = (m.status || 'pendente').replace('_', ' ');
                const statusClass = 'st-' + (m.status || 'pendente');
                let prazoStr = '';
                if (m.prazo) prazoStr = new Date(m.prazo + 'T00:00:00').toLocaleDateString('pt-BR');
                
                // Objective IDs for this micro
                const objIds = m.objetivos_ids || (m.objetivo_id ? [m.objetivo_id] : []);
                const objIdsStr = objIds.map(String).join(',');
                
                // Color dots
                let dotsHtml = '';
                objIds.forEach(oid => {
                    const c = objColorMap[String(oid)];
                    if (c) dotsHtml += `<span class="pend-micro-card-obj-dot" style="background:${c};" title="${(objetivos.find(o=>String(o.id)===String(oid))||{}).nome||''}"></span>`;
                });
                
                html += `<div class="pend-micro-card" data-global-idx="${globalIdx}" data-status="${m.status||'pendente'}" data-obj-ids="${objIdsStr}" data-client-id="${clientId}" id="pend-micro-${globalIdx}">
                    <div class="pend-micro-card-title" data-global-idx="${globalIdx}" data-client-id="${clientId}">${sanitizeInput(m.desc || 'Sem título')}</div>
                    ${m.detalhamento ? `<div class="pend-micro-card-detail">${sanitizeInput(m.detalhamento.substring(0,80))}${m.detalhamento.length > 80 ? '...' : ''}</div>` : ''}
                    <div class="pend-micro-card-meta">
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                        ${prazoStr ? `<span class="pend-micro-card-prazo">📅 ${prazoStr}</span>` : ''}
                        <span class="pend-micro-card-obj-dots">${dotsHtml}</span>
                    </div>
                </div>`;
            });
        }
        html += '</div>';
        
        // RESIZER between center and right
        html += '<div class="pend-col-resizer" id="pend-resizer-right"></div>';
        
        // RIGHT COLUMN: Macro Strategies
        html += `<div class="pend-col-right" id="pend-col-right">
            <div class="pend-col-title">Estratégias Macro</div>`;
        if (filteredMacros.length === 0 && pendType === 'consultor') {
            html += '<div class="pend-empty-col">Macros não se aplicam ao consultor</div>';
        } else if (filteredMacros.length === 0) {
            html += '<div class="pend-empty-col">Nenhuma estratégia macro pendente</div>';
        } else {
            filteredMacros.forEach((macro, idx) => {
                const statusLabel = (macro.status || 'pendente').replace('_', ' ');
                const statusClass = 'st-' + (macro.status || 'pendente');
                // Find micros linked to this macro via macro.micro_ids
                const linkedMicroIds = Array.isArray(macro.micro_ids) ? macro.micro_ids.map(String) : [];
                const linkedMicros = micros.filter(m => linkedMicroIds.includes(String(m.id)));
                // Calculate progress from linked micros
                let macroProgress = 0;
                if (linkedMicros.length > 0) {
                    let done = 0;
                    linkedMicros.forEach(m => {
                        if (m.status === 'concluido') done++;
                        else if (m.status === 'em_andamento') done += 0.5;
                    });
                    macroProgress = Math.round((done / linkedMicros.length) * 100);
                }
                // Duration/Period label
                let periodoStr = '';
                if (macro.dur_qty && macro.dur_unit) {
                    const uLabel = {dias:'dias',dias_uteis:'dias úteis',semanas:'semanas',meses:'meses'};
                    periodoStr = 'Período: ' + macro.dur_qty + ' ' + (uLabel[macro.dur_unit] || macro.dur_unit);
                } else if (macro.periodo) {
                    periodoStr = 'Período: ' + sanitizeInput(macro.periodo);
                }
                // Resolve linked objective names
                let macroObjNames = '';
                if (Array.isArray(macro.objetivos_ids) && macro.objetivos_ids.length > 0) {
                    macroObjNames = macro.objetivos_ids.map(oid => {
                        const o = objetivos.find(ob => String(ob.id) === String(oid));
                        return o ? sanitizeInput(o.nome) : '';
                    }).filter(Boolean).join(', ');
                }
                html += `<div class="pend-macro-card" data-macro-idx="${idx}" data-status="${macro.status||'pendente'}" data-micro-ids="${linkedMicroIds.join(',')}" id="pend-macro-${idx}">
                    <div class="pend-macro-card-fase">${sanitizeInput(macro.fase || 'Fase ' + (idx+1))}</div>
                    <div class="pend-macro-card-desc">${sanitizeInput(macro.desc || '').replace(/\n/g,'<br>')}</div>
                    ${linkedMicros.length > 0 ? `<div class="pend-macro-progress-wrap"><div class="pend-macro-progress-info"><span>Progresso (micro passos)</span><span>${macroProgress}%</span></div><div class="pend-macro-progress-bar"><div class="pend-macro-progress-fill" style="width:${macroProgress}%;"></div></div></div>` : ''}
                    <div class="pend-macro-card-meta">
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                        ${periodoStr ? `<span class="pend-macro-periodo">${periodoStr}</span>` : ''}
                    </div>
                    ${macroObjNames ? `<div class="pend-macro-card-objs">Objetivo(s): ${macroObjNames}</div>` : ''}
                </div>`;
            });
        }
        html += '</div>';
        
        html += '</div></div>'; // close pend-three-col and pend-content-area
        
        body.innerHTML = html;
        
        // --- EVENT LISTENERS ---
        
        // Status badge filter
        const badges = body.querySelectorAll('.pend-status-badge');
        let activeStatus = 'todos';
        badges.forEach(badge => {
            badge.addEventListener('click', () => {
                badges.forEach(b => b.classList.remove('active'));
                badge.classList.add('active');
                activeStatus = badge.dataset.status;
                applyPendFilters();
            });
        });
        
        // Text search
        const searchInput = document.getElementById('pend-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => applyPendFilters());
        }
        
        // Objective card click → filter
        let activeObjId = null;
        const objCards = body.querySelectorAll('.pend-obj-card');
        objCards.forEach(card => {
            card.addEventListener('click', () => {
                const oid = card.dataset.objId;
                if (activeObjId === oid) {
                    // Deselect
                    activeObjId = null;
                    objCards.forEach(c => c.classList.remove('active'));
                } else {
                    activeObjId = oid;
                    objCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                }
                applyPendFilters();
            });
        });
        
        // Micro card title click → open update modal
        body.querySelectorAll('.pend-micro-card-title').forEach(titleEl => {
            titleEl.addEventListener('click', () => {
                const gIdx = parseInt(titleEl.dataset.globalIdx);
                const cId = titleEl.dataset.clientId;
                if (gIdx >= 0) openMicroUpdateDash(cId, gIdx);
            });
        });
        
        // Filter function
        function applyPendFilters() {
            const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
            const microCards = body.querySelectorAll('.pend-micro-card');
            const macroCards = body.querySelectorAll('.pend-macro-card');
            
            microCards.forEach(card => {
                let show = true;
                if (activeStatus !== 'todos' && card.dataset.status !== activeStatus) show = false;
                if (term && !card.textContent.toLowerCase().includes(term)) show = false;
                if (activeObjId) {
                    const cardObjIds = (card.dataset.objIds || '').split(',');
                    if (!cardObjIds.includes(activeObjId)) show = false;
                }
                card.classList.toggle('pend-card-hidden', !show);
            });
            
            macroCards.forEach(card => {
                let show = true;
                if (activeStatus !== 'todos' && card.dataset.status !== activeStatus) show = false;
                if (term && !card.textContent.toLowerCase().includes(term)) show = false;
                card.classList.toggle('pend-card-hidden', !show);
            });
            
            // Redraw SVG lines
            setTimeout(() => _drawPendConnectors(objetivos, objColorMap, filteredMicros, filteredMacros, micros), 50);
        }
        
        // Draw SVG connectors after render
        setTimeout(() => _drawPendConnectors(objetivos, objColorMap, filteredMicros, filteredMacros, micros), 150);
        
        // Redraw on scroll
        const colLeft = document.getElementById('pend-col-left');
        const colCenter = document.getElementById('pend-col-center');
        const colRight = document.getElementById('pend-col-right');
        const redrawFn = () => setTimeout(() => _drawPendConnectors(objetivos, objColorMap, filteredMicros, filteredMacros, micros), 30);
        if (colLeft) colLeft.addEventListener('scroll', redrawFn);
        if (colCenter) colCenter.addEventListener('scroll', redrawFn);
        if (colRight) colRight.addEventListener('scroll', redrawFn);
        
        // Init column resizers
        _initPendColResizers(redrawFn);
        
    } catch (err) {
        body.innerHTML = '<p style="color:#ef4444;padding:1rem;">Erro ao carregar: ' + err.message + '</p>';
    }
}

// --- SVG CONNECTOR LINES (Objectives ↔ Micros ↔ Macros) ---
const PEND_MACRO_COLORS = ['#D4AF37','#10b981','#3b82f6','#a855f7','#ef4444','#fb923c','#14b8a6','#eab308','#22c55e','#60a5fa'];

function _drawPendConnectors(objetivos, objColorMap, filteredMicros, filteredMacros, allMicros) {
    const svg = document.getElementById('pend-svg-lines');
    if (!svg) return;
    const contentArea = svg.parentElement;
    if (!contentArea) return;
    
    const rect = contentArea.getBoundingClientRect();
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
    svg.innerHTML = '';
    
    // LEFT SIDE: Objectives → Micros
    objetivos.forEach(obj => {
        const objEl = document.getElementById('pend-obj-' + obj.id);
        if (!objEl || objEl.classList.contains('pend-card-hidden')) return;
        
        const color = objColorMap[String(obj.id)] || '#888';
        
        filteredMicros.forEach(m => {
            const globalIdx = allMicros.indexOf(m);
            const microEl = document.getElementById('pend-micro-' + globalIdx);
            if (!microEl || microEl.classList.contains('pend-card-hidden')) return;
            
            const objIds = m.objetivos_ids || (m.objetivo_id ? [m.objetivo_id] : []);
            if (!objIds.map(String).includes(String(obj.id))) return;
            
            const objRect = objEl.getBoundingClientRect();
            const microRect = microEl.getBoundingClientRect();
            
            const x1 = objRect.right - rect.left;
            const y1 = objRect.top + objRect.height / 2 - rect.top;
            const x2 = microRect.left - rect.left;
            const y2 = microRect.top + microRect.height / 2 - rect.top;
            
            const midX = (x1 + x2) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.5');
            svg.appendChild(path);
        });
    });
    
    // RIGHT SIDE: Micros → Macros
    if (Array.isArray(filteredMacros)) {
        filteredMacros.forEach((macro, macroIdx) => {
            const macroEl = document.getElementById('pend-macro-' + macroIdx);
            if (!macroEl || macroEl.classList.contains('pend-card-hidden')) return;
            
            const macroColor = PEND_MACRO_COLORS[macroIdx % PEND_MACRO_COLORS.length];
            const linkedMicroIds = (macroEl.dataset.microIds || '').split(',').filter(Boolean);
            
            linkedMicroIds.forEach(mid => {
                // Find the micro element by its id in allMicros
                const mIdx = allMicros.findIndex(m => String(m.id) === String(mid));
                if (mIdx < 0) return;
                const microEl = document.getElementById('pend-micro-' + mIdx);
                if (!microEl || microEl.classList.contains('pend-card-hidden')) return;
                
                const microRect = microEl.getBoundingClientRect();
                const macroRect = macroEl.getBoundingClientRect();
                
                const x1 = microRect.right - rect.left;
                const y1 = microRect.top + microRect.height / 2 - rect.top;
                const x2 = macroRect.left - rect.left;
                const y2 = macroRect.top + macroRect.height / 2 - rect.top;
                
                const midX = (x1 + x2) / 2;
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
                path.setAttribute('stroke', macroColor);
                path.setAttribute('stroke-width', '1.5');
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.45');
                path.setAttribute('stroke-dasharray', '4 2');
                svg.appendChild(path);
            });
        });
    }
}

// --- COLUMN RESIZER FUNCTIONALITY ---
function _initPendColResizers(redrawFn) {
    const resizerLeft = document.getElementById('pend-resizer-left');
    const resizerRight = document.getElementById('pend-resizer-right');
    const colLeft = document.getElementById('pend-col-left');
    const colCenter = document.getElementById('pend-col-center');
    const colRight = document.getElementById('pend-col-right');
    const threeCol = document.getElementById('pend-three-col');
    if (!threeCol) return;
    
    function initResizer(resizer, leftCol, rightCol) {
        if (!resizer || !leftCol || !rightCol) return;
        let isResizing = false, startX, startLeftW, startRightW;
        
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            startLeftW = leftCol.offsetWidth;
            startRightW = rightCol.offsetWidth;
            resizer.classList.add('active');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            
            const onMove = (ev) => {
                if (!isResizing) return;
                const dx = ev.clientX - startX;
                const totalW = threeCol.offsetWidth;
                const newLeftW = Math.max(100, Math.min(totalW * 0.5, startLeftW + dx));
                const newRightW = Math.max(100, Math.min(totalW * 0.5, startRightW - dx));
                leftCol.style.flex = '0 0 ' + newLeftW + 'px';
                leftCol.style.maxWidth = newLeftW + 'px';
                rightCol.style.flex = '0 0 ' + newRightW + 'px';
                rightCol.style.maxWidth = newRightW + 'px';
                if (redrawFn) redrawFn();
            };
            
            const onUp = () => {
                isResizing = false;
                resizer.classList.remove('active');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
    
    initResizer(resizerLeft, colLeft, colCenter);
    initResizer(resizerRight, colCenter, colRight);
}

// --- DRAG FUNCTIONALITY ---
function _initPendDrag(wrapper) {
    const header = document.getElementById('pend-modal-header');
    if (!header || header._dragInit) return;
    header._dragInit = true;
    
    let isDragging = false, startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('modal-close')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = wrapper.offsetLeft;
        startTop = wrapper.offsetTop;
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.style.left = (startLeft + dx) + 'px';
        wrapper.style.top = (startTop + dy) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
        }
    });
}

// --- RESIZE FUNCTIONALITY ---
function _initPendResize(wrapper) {
    const handles = wrapper.querySelectorAll('.pend-resize-handle');
    if (!handles.length || wrapper._resizeInit) return;
    wrapper._resizeInit = true;
    
    handles.forEach(handle => {
        let isResizing = false, startX, startY, startW, startH, startL, startT;
        const dir = handle.dataset.dir;
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = wrapper.offsetWidth;
            startH = wrapper.offsetHeight;
            startL = wrapper.offsetLeft;
            startT = wrapper.offsetTop;
            document.body.style.userSelect = 'none';
            
            const onMove = (ev) => {
                if (!isResizing) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                
                if (dir === 'br') {
                    wrapper.style.width = Math.max(500, startW + dx) + 'px';
                    wrapper.style.height = Math.max(350, startH + dy) + 'px';
                } else if (dir === 'r') {
                    wrapper.style.width = Math.max(500, startW + dx) + 'px';
                } else if (dir === 'b') {
                    wrapper.style.height = Math.max(350, startH + dy) + 'px';
                } else if (dir === 'bl') {
                    const newW = Math.max(500, startW - dx);
                    wrapper.style.width = newW + 'px';
                    wrapper.style.left = (startL + (startW - newW)) + 'px';
                    wrapper.style.height = Math.max(350, startH + dy) + 'px';
                } else if (dir === 'tr') {
                    wrapper.style.width = Math.max(500, startW + dx) + 'px';
                    const newH = Math.max(350, startH - dy);
                    wrapper.style.height = newH + 'px';
                    wrapper.style.top = (startT + (startH - newH)) + 'px';
                }
            };
            
            const onUp = () => {
                isResizing = false;
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}


// --- Micro Update Modal (from dashboard) ---
function openMicroUpdateDash(clientId, microIndex) {
    // Create overlay if not exists
    let overlay = document.getElementById('dash-micro-update-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dash-micro-update-overlay';
        overlay.className = 'modal';
        overlay.innerHTML = `<div class="modal-content" style="max-width:450px;">
            <span class="modal-close" id="dash-mu-close">&times;</span>
            <h2>Atualização de Execução</h2>
            <div style="margin-bottom:0.75rem;">
                <label style="font-size:0.82rem;color:var(--theme-text-muted);display:block;margin-bottom:0.3rem;">Data da Atualização</label>
                <input type="date" id="dash-mu-data" style="width:100%;padding:0.5rem;border-radius:4px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);">
            </div>
            <div style="margin-bottom:0.75rem;">
                <label style="font-size:0.82rem;color:var(--theme-text-muted);display:block;margin-bottom:0.3rem;">Observação / Informação</label>
                <textarea id="dash-mu-texto" rows="3" style="width:100%;padding:0.5rem;border-radius:4px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);resize:vertical;" placeholder="Descreva o andamento, o que foi feito..."></textarea>
            </div>
            <div style="margin-bottom:1rem;">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.85rem;color:var(--theme-text-light);">
                    <input type="checkbox" id="dash-mu-concluir" style="width:16px;height:16px;accent-color:var(--theme-secondary);">
                    Marcar como concluído
                </label>
            </div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button class="msg-modal-btn msg-cancel-btn" id="dash-mu-cancel">Cancelar</button>
                <button class="msg-modal-btn msg-save-btn" id="dash-mu-save">Salvar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        document.getElementById('dash-mu-close').addEventListener('click', () => { overlay.style.display = 'none'; });
        document.getElementById('dash-mu-cancel').addEventListener('click', () => { overlay.style.display = 'none'; });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
    }
    
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dash-mu-data').value = hoje;
    document.getElementById('dash-mu-texto').value = '';
    document.getElementById('dash-mu-concluir').checked = false;
    
    document.getElementById('dash-mu-save').onclick = async () => {
        const data = document.getElementById('dash-mu-data').value;
        const texto = document.getElementById('dash-mu-texto').value.trim();
        const concluir = document.getElementById('dash-mu-concluir').checked;
        if (!texto && !concluir) { alert('Informe pelo menos uma observação ou marque como concluído.'); return; }
        
        try {
            const { data: acompData, error } = await supabase
                .from('ferramentas_dados')
                .select('dados')
                .eq('cliente_id', clientId)
                .eq('ferramenta', 'acompanhamento')
                .maybeSingle();
            
            if (error || !acompData) { alert('Erro ao carregar dados.'); return; }
            
            const dados = acompData.dados;
            const m = dados.microPassos[microIndex];
            if (!m) { alert('Micro passo não encontrado.'); return; }
            
            if (!Array.isArray(m.atualizacoes)) m.atualizacoes = [];
            if (texto) {
                m.atualizacoes.push({ data: data || hoje, texto: texto });
            }
            if (concluir) m.status = 'concluido';
            
            await supabase
                .from('ferramentas_dados')
                .update({ dados: dados })
                .eq('cliente_id', clientId)
                .eq('ferramenta', 'acompanhamento');
            
            overlay.style.display = 'none';
            alert('Atualização salva com sucesso!');
            
            // Refresh the pendencias modal if open
            const pendModal = document.getElementById('pendencias-modal');
            if (pendModal && pendModal.style.display === 'block') {
                const pendTitle = document.getElementById('pendencias-modal-title').textContent;
                const pendType = pendTitle.includes('Consultor') ? 'consultor' : 'cliente';
                const clientNameMatch = pendTitle.match(/:\s*(.+)$/);
                const cName = clientNameMatch ? clientNameMatch[1] : '';
                openPendenciasModal(clientId, cName, pendType);
            }
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        }
    };
    
    overlay.style.display = 'block';
}

// ============================================================
// OBJETIVOS MODAL
// ============================================================
async function openObjetivosModal(clientId, clientName) {
    const modal = document.getElementById('objetivos-modal');
    const title = document.getElementById('objetivos-modal-title');
    const body = document.getElementById('objetivos-modal-body');
    if (!modal) return;
    
    title.textContent = `Objetivos: ${clientName}`;
    body.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    modal.style.display = 'block';
    
    try {
        const { data, error } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clientId)
            .eq('ferramenta', 'acompanhamento')
            .maybeSingle();
        
        if (error || !data || !data.dados) {
            body.innerHTML = '<p class="dash-modal-empty">Nenhum dado de acompanhamento encontrado.</p>';
            return;
        }
        
        const dados = data.dados;
        const objetivos = Array.isArray(dados.objetivos) ? dados.objetivos : [];
        
        if (objetivos.length === 0) {
            body.innerHTML = '<p class="dash-modal-empty">Nenhum objetivo cadastrado.</p>';
            return;
        }
        
        let html = '';
        objetivos.forEach((o, idx) => {
            const valor = parseFloat(o.valor) || 0;
            const atual = parseFloat(o.atual) || 0;
            const pct = valor > 0 ? Math.min(100, (atual / valor) * 100) : 0;
            
            html += `<div class="obj-card">
                <div class="obj-card-header">
                    <span class="obj-card-title">${sanitizeInput(o.nome || 'Objetivo ' + (idx+1))}</span>
                    <span class="obj-card-cat">${sanitizeInput(o.categoria || '')}</span>
                </div>
                <div class="obj-card-progress"><div class="obj-card-progress-bar" style="width:${pct.toFixed(1)}%"></div></div>
                <div class="obj-card-values">
                    <span>Atual: ${fmtBRL(atual)}</span>
                    <span>${pct.toFixed(0)}%</span>
                    <span>Meta: ${fmtBRL(valor)}</span>
                </div>
                ${o.obs ? `<p style="font-size:0.75rem;color:var(--theme-text-muted);margin-top:0.4rem;font-style:italic;">${sanitizeInput(o.obs)}</p>` : ''}
                <div style="margin-top:0.5rem;display:flex;gap:0.5rem;justify-content:flex-end;">
                    <button class="btn-update-micro dash-obj-update-btn" data-idx="${idx}" data-client-id="${clientId}">Atualizar Valor</button>
                </div>
            </div>`;
        });
        
        body.innerHTML = html;
        
        // Update buttons
        body.querySelectorAll('.dash-obj-update-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const cId = btn.dataset.clientId;
                openObjetivoUpdateDash(cId, idx, clientName);
            });
        });
        
    } catch (err) {
        body.innerHTML = '<p style="color:#ef4444;">Erro ao carregar: ' + err.message + '</p>';
    }
}

// --- Objetivo Update Modal (from dashboard) ---
function openObjetivoUpdateDash(clientId, objIndex, clientName) {
    let overlay = document.getElementById('dash-obj-update-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dash-obj-update-overlay';
        overlay.className = 'modal';
        overlay.innerHTML = `<div class="modal-content" style="max-width:450px;">
            <span class="modal-close" id="dash-ou-close">&times;</span>
            <h2>Atualizar Valor Acumulado</h2>
            <div style="margin-bottom:0.75rem;">
                <label style="font-size:0.82rem;color:var(--theme-text-muted);display:block;margin-bottom:0.3rem;">Data da Atualização</label>
                <input type="date" id="dash-ou-data" style="width:100%;padding:0.5rem;border-radius:4px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);">
            </div>
            <div style="margin-bottom:0.75rem;">
                <label style="font-size:0.82rem;color:var(--theme-text-muted);display:block;margin-bottom:0.3rem;">Novo Valor Acumulado</label>
                <input type="text" id="dash-ou-valor" style="width:100%;padding:0.5rem;border-radius:4px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);" placeholder="Ex: 55.000,00">
            </div>
            <div style="margin-bottom:1rem;">
                <label style="font-size:0.82rem;color:var(--theme-text-muted);display:block;margin-bottom:0.3rem;">Observação (opcional)</label>
                <textarea id="dash-ou-texto" rows="2" style="width:100%;padding:0.5rem;border-radius:4px;border:1px solid var(--theme-border-color);background:rgba(0,0,0,0.2);color:var(--theme-text-light);resize:vertical;" placeholder="Comentário sobre a atualização..."></textarea>
            </div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button class="msg-modal-btn msg-cancel-btn" id="dash-ou-cancel">Cancelar</button>
                <button class="msg-modal-btn msg-save-btn" id="dash-ou-save">Salvar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        document.getElementById('dash-ou-close').addEventListener('click', () => { overlay.style.display = 'none'; });
        document.getElementById('dash-ou-cancel').addEventListener('click', () => { overlay.style.display = 'none'; });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
    }
    
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dash-ou-data').value = hoje;
    document.getElementById('dash-ou-valor').value = '';
    document.getElementById('dash-ou-texto').value = '';
    
    // Apply currency mask
    const valorInput = document.getElementById('dash-ou-valor');
    valorInput.removeEventListener('input', _dashOuMask);
    valorInput.addEventListener('input', _dashOuMask);
    
    document.getElementById('dash-ou-save').onclick = async () => {
        const data = document.getElementById('dash-ou-data').value;
        const valorStr = document.getElementById('dash-ou-valor').value;
        const texto = document.getElementById('dash-ou-texto').value.trim();
        const valor = parseBRL(valorStr);
        if (!valor && valor !== 0) { alert('Informe o valor acumulado atualizado.'); return; }
        
        try {
            const { data: acompData, error } = await supabase
                .from('ferramentas_dados')
                .select('dados')
                .eq('cliente_id', clientId)
                .eq('ferramenta', 'acompanhamento')
                .maybeSingle();
            
            if (error || !acompData) { alert('Erro ao carregar dados.'); return; }
            
            const dados = acompData.dados;
            const o = dados.objetivos[objIndex];
            if (!o) { alert('Objetivo não encontrado.'); return; }
            
            if (!Array.isArray(o.atualizacoes_valor)) o.atualizacoes_valor = [];
            o.atualizacoes_valor.push({ data: data || hoje, valor: valor, texto: texto });
            o.atual = valor;
            
            await supabase
                .from('ferramentas_dados')
                .update({ dados: dados })
                .eq('cliente_id', clientId)
                .eq('ferramenta', 'acompanhamento');
            
            overlay.style.display = 'none';
            alert('Valor atualizado com sucesso!');
            openObjetivosModal(clientId, clientName);
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        }
    };
    
    overlay.style.display = 'block';
}

function _dashOuMask(e) {
    applyCurrencyMask(e.target);
}

// ============================================================
// PARTICULARIDADES MODAL
// ============================================================
async function openParticularidadesModal(clientId, clientName) {
    const modal = document.getElementById('particularidades-modal');
    const title = document.getElementById('particularidades-modal-title');
    const body = document.getElementById('particularidades-modal-body');
    if (!modal) return;
    
    title.textContent = `Particularidades: ${clientName}`;
    body.innerHTML = '<p style="color:var(--theme-text-muted);">Carregando...</p>';
    modal.style.display = 'block';
    
    try {
        const { data, error } = await supabase
            .from('ferramentas_dados')
            .select('dados')
            .eq('cliente_id', clientId)
            .eq('ferramenta', 'particularidades')
            .maybeSingle();
        
        if (error || !data || !data.dados) {
            body.innerHTML = '<p class="dash-modal-empty">Nenhuma particularidade registrada.</p>';
            return;
        }
        
        const pData = data.dados;
        const tabs = [
            { key: 'datas_relevantes', label: 'Datas Relevantes' },
            { key: 'historia_vida', label: 'História de Vida' },
            { key: 'cidades', label: 'Cidades' },
            { key: 'comunicacao', label: 'Comunicação' },
            { key: 'interesses', label: 'Interesses' }
        ];
        
        let html = '<div class="partic-tabs">';
        tabs.forEach((tab, i) => {
            const count = Array.isArray(pData[tab.key]) ? pData[tab.key].length : (pData[tab.key] ? 1 : 0);
            html += `<button class="partic-tab ${i === 0 ? 'active' : ''}" data-tab="${tab.key}">${tab.label} (${count})</button>`;
        });
        html += '</div><div class="partic-content" id="partic-content-area"></div>';
        body.innerHTML = html;
        
        // Tab click
        body.querySelectorAll('.partic-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                body.querySelectorAll('.partic-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderParticTab(pData, tab.dataset.tab);
            });
        });
        
        // Render first tab
        renderParticTab(pData, 'datas_relevantes');
        
    } catch (err) {
        body.innerHTML = '<p style="color:#ef4444;">Erro ao carregar: ' + err.message + '</p>';
    }
}

function renderParticTab(pData, tabKey) {
    const area = document.getElementById('partic-content-area');
    if (!area) return;
    
    const items = Array.isArray(pData[tabKey]) ? pData[tabKey] : [];
    
    if (items.length === 0) {
        area.innerHTML = '<p class="dash-modal-empty">Nenhum item nesta seção.</p>';
        return;
    }
    
    let html = '';
    
    if (tabKey === 'datas_relevantes') {
        html = '<table class="dash-list-table"><thead><tr><th>Descrição</th><th>Data</th><th>Recorrência</th></tr></thead><tbody>';
        items.forEach(item => {
            const dataStr = item.data ? new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR') : '--';
            html += `<tr><td>${sanitizeInput(item.descricao || '--')}</td><td>${dataStr}</td><td>${sanitizeInput(item.recorrencia || 'Nenhuma')}</td></tr>`;
        });
        html += '</tbody></table>';
    } else if (tabKey === 'historia_vida') {
        html = '<table class="dash-list-table"><thead><tr><th>Evento</th><th>Período</th></tr></thead><tbody>';
        items.forEach(item => {
            html += `<tr><td>${sanitizeInput(item.descricao || item.evento || '--')}</td><td>${sanitizeInput(item.periodo || item.ano || '--')}</td></tr>`;
        });
        html += '</tbody></table>';
    } else if (tabKey === 'cidades') {
        html = '<table class="dash-list-table"><thead><tr><th>Cidade</th><th>Contexto</th></tr></thead><tbody>';
        items.forEach(item => {
            html += `<tr><td>${sanitizeInput(item.nome || item.cidade || '--')}</td><td>${sanitizeInput(item.contexto || item.motivo || '--')}</td></tr>`;
        });
        html += '</tbody></table>';
    } else if (tabKey === 'comunicacao') {
        html = '<div style="padding:0.5rem;">';
        if (typeof pData.comunicacao === 'string') {
            html += `<p style="color:var(--theme-text-light);line-height:1.6;">${sanitizeInput(pData.comunicacao)}</p>`;
        } else if (Array.isArray(items)) {
            items.forEach(item => {
                html += `<p style="color:var(--theme-text-light);margin-bottom:0.5rem;">• ${sanitizeInput(typeof item === 'string' ? item : (item.descricao || item.nota || JSON.stringify(item)))}</p>`;
            });
        }
        html += '</div>';
    } else if (tabKey === 'interesses') {
        html = '<table class="dash-list-table"><thead><tr><th>Interesse</th><th>Categoria</th><th>Prioridade</th></tr></thead><tbody>';
        items.forEach(item => {
            const prioridade = item.prioridade || '--';
            html += `<tr><td>${sanitizeInput(item.nome || item.descricao || '--')}</td><td>${sanitizeInput(item.categoria || '--')}</td><td>${sanitizeInput(String(prioridade))}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    area.innerHTML = html;
}


// === PATRIMONIO MODAL (iframe window) ===
function openPatrimonioModal(clientId, clientName) {
    const modal = document.getElementById('patrimonio-modal');
    const wrapper = document.getElementById('pat-modal-wrapper');
    const iframe = document.getElementById('patrimonio-iframe');
    const title = document.getElementById('patrimonio-modal-title');
    if (!modal || !iframe) return;

    // Set the client in sessionStorage so the patrimonio page loads the right data
    sessionStorage.setItem('cliente_id', clientId);
    sessionStorage.setItem('equipe_modo_cliente', 'true');

    title.textContent = `Patrimônio — ${clientName || ''}`;
    iframe.src = 'archives_clients/ferramentas/patrimonio.html';
    modal.style.display = 'flex';

    // Initialize drag and resize if not already done
    if (!wrapper._patInitialized) {
        _initPatDrag(wrapper);
        _initPatResize(wrapper);
        wrapper._patInitialized = true;
    }
}

// --- DRAG for Patrimonio modal ---
function _initPatDrag(wrapper) {
    const header = document.getElementById('pat-modal-header');
    if (!header) return;
    let isDragging = false, startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.modal-close')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.style.left = (startLeft + dx) + 'px';
        wrapper.style.top = (startTop + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
        }
    });
}

// --- RESIZE for Patrimonio modal ---
function _initPatResize(wrapper) {
    const handles = wrapper.querySelectorAll('.pat-resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dir = handle.dataset.dir;
            const rect = wrapper.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = rect.width;
            const startH = rect.height;
            const startL = rect.left;
            const startT = rect.top;
            document.body.style.userSelect = 'none';

            // Add overlay to prevent iframe from capturing mouse events
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;cursor:' + getComputedStyle(handle).cursor;
            document.body.appendChild(overlay);

            const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                let newW = startW, newH = startH, newL = startL, newT = startT;

                if (dir.includes('r')) { newW = Math.max(400, startW + dx); }
                if (dir.includes('l')) { newW = Math.max(400, startW - dx); newL = startL + dx; }
                if (dir.includes('b')) { newH = Math.max(300, startH + dy); }
                if (dir.includes('t')) { newH = Math.max(300, startH - dy); newT = startT + dy; }

                wrapper.style.width = newW + 'px';
                wrapper.style.height = newH + 'px';
                wrapper.style.left = newL + 'px';
                wrapper.style.top = newT + 'px';
            };

            const onUp = () => {
                document.body.style.userSelect = '';
                overlay.remove();
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}


// === DIVIDAS MODAL (iframe window - juros.html) ===
function openDividasModal(clientId, clientName) {
    const modal = document.getElementById('dividas-modal');
    const wrapper = document.getElementById('div-modal-wrapper');
    const iframe = document.getElementById('dividas-iframe');
    const title = document.getElementById('dividas-modal-title');
    if (!modal || !iframe) return;

    // Set the client in sessionStorage so the juros page loads the right data
    sessionStorage.setItem('cliente_id', clientId);
    sessionStorage.setItem('equipe_modo_cliente', 'true');

    title.textContent = `Dívidas / Juros — ${clientName || ''}`;
    iframe.src = 'archives_clients/ferramentas/juros.html';
    modal.style.display = 'flex';

    // Initialize drag and resize if not already done
    if (!wrapper._divInitialized) {
        _initDivDrag(wrapper);
        _initDivResize(wrapper);
        wrapper._divInitialized = true;
    }
}

// --- DRAG for Dividas modal ---
function _initDivDrag(wrapper) {
    const header = document.getElementById('div-modal-header');
    if (!header) return;
    let isDragging = false, startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.modal-close')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.style.left = (startLeft + dx) + 'px';
        wrapper.style.top = (startTop + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
        }
    });
}

// --- RESIZE for Dividas modal ---
function _initDivResize(wrapper) {
    const handles = wrapper.querySelectorAll('.div-resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dir = handle.dataset.dir;
            const rect = wrapper.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = rect.width;
            const startH = rect.height;
            const startL = rect.left;
            const startT = rect.top;
            document.body.style.userSelect = 'none';

            // Add overlay to prevent iframe from capturing mouse events
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;cursor:' + getComputedStyle(handle).cursor;
            document.body.appendChild(overlay);

            const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                let newW = startW, newH = startH, newL = startL, newT = startT;

                if (dir.includes('r')) { newW = Math.max(400, startW + dx); }
                if (dir.includes('l')) { newW = Math.max(400, startW - dx); newL = startL + dx; }
                if (dir.includes('b')) { newH = Math.max(300, startH + dy); }
                if (dir.includes('t')) { newH = Math.max(300, startH - dy); newT = startT + dy; }

                wrapper.style.width = newW + 'px';
                wrapper.style.height = newH + 'px';
                wrapper.style.left = newL + 'px';
                wrapper.style.top = newT + 'px';
            };

            const onUp = () => {
                document.body.style.userSelect = '';
                overlay.remove();
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}


// === TIPO SYNC MODAL (CPF/WhatsApp from multiple sources) ===
async function openTipoSyncModal(clientId, clientName) {
    const modal = document.getElementById('tipo-sync-modal');
    const body = document.getElementById('tipo-sync-body');
    const title = document.getElementById('tipo-sync-title');
    if (!modal || !body) return;

    title.textContent = `Dados Cadastrais — ${clientName || ''}`;
    body.innerHTML = '<div class="tipo-sync-loading">Carregando dados de todas as fontes...</div>';
    modal.style.display = 'flex';

    try {
        // Fetch data from all 4 sources in parallel
        const [dadosCad, diagnostico, hvsfTasks, clienteRow] = await Promise.all([
            // 1. Dados Cadastrais
            supabase.from('dados_cadastrais').select('cpf, whatsapp').eq('cliente_id', clientId).maybeSingle(),
            // 2. Diagnóstico Financeiro
            supabase.from('diagnosticos_financeiros').select('cpf, telefone').eq('cliente_id', clientId).maybeSingle(),
            // 3. HVSF Tasks (Cyclopay import) - busca TODOS os status
            supabase.from('hvsf_tasks').select('tasks, client_name'),
            // 4. Clientes table (dashboard list)
            supabase.from('clientes').select('whatsapp').eq('id', clientId).maybeSingle()
        ]);

        // Process sources
        const sources = [];

        // Source 1: Dados Cadastrais
        const dc = dadosCad.data;
        sources.push({
            name: 'Dados Cadastrais',
            cpf: dc?.cpf || '',
            whatsapp: dc?.whatsapp || '',
            table: 'dados_cadastrais',
            field_cpf: 'cpf',
            field_whatsapp: 'whatsapp'
        });

        // Source 2: Diagnóstico
        const diag = diagnostico.data;
        sources.push({
            name: 'Diagnóstico Financeiro',
            cpf: diag?.cpf || '',
            whatsapp: diag?.telefone || '',
            table: 'diagnosticos_financeiros',
            field_cpf: 'cpf',
            field_whatsapp: 'telefone'
        });

        // Source 3: HVSF Tasks / Cyclopay
        // Estratégia de matching multi-critério para evitar falsos positivos:
        // 1. WhatsApp match (mais confiável — número é único por pessoa)
        // 2. CPF match (se dados_cadastrais tem CPF real)
        // 3. Nome exato
        // 4. Nome parcial (SOMENTE se o nome do dashboard tem 2+ palavras)
        let hvsfCpf = '';
        let hvsfWhatsapp = '';
        if (hvsfTasks.data && hvsfTasks.data.length > 0) {
            const searchName = (clientName || '').toLowerCase().trim();
            // Pega o WhatsApp do cliente no dashboard (já carregado na source 4)
            const clientWhatsapp = clienteRow.data?.whatsapp || '';
            const clientWhatsappClean = clientWhatsapp.replace(/\D/g, '');
            // Pega o CPF do dados_cadastrais (se não for PEND-)
            const clientCpf = (dc?.cpf || '').startsWith('PEND-') ? '' : (dc?.cpf || '').replace(/\D/g, '');

            let matchingTask = null;

            // Prioridade 1: Match por WhatsApp (últimos 8-9 dígitos)
            if (clientWhatsappClean.length >= 8) {
                matchingTask = hvsfTasks.data.find(t => {
                    if (!t.tasks?.client_data?.whatsapp) return false;
                    const taskPhone = String(t.tasks.client_data.whatsapp).replace(/\D/g, '');
                    if (taskPhone.length < 8) return false;
                    const minLen = Math.min(clientWhatsappClean.length, taskPhone.length, 9);
                    return clientWhatsappClean.slice(-minLen) === taskPhone.slice(-minLen);
                });
            }

            // Prioridade 2: Match por CPF (se não achou por WhatsApp)
            if (!matchingTask && clientCpf.length >= 11) {
                matchingTask = hvsfTasks.data.find(t => {
                    if (!t.tasks?.client_data?.cpf) return false;
                    const taskCpf = String(t.tasks.client_data.cpf).replace(/\D/g, '');
                    return taskCpf === clientCpf;
                });
            }

            // Prioridade 3: Match por nome exato
            if (!matchingTask) {
                matchingTask = hvsfTasks.data.find(t => {
                    const taskName = (t.client_name || '').toLowerCase().trim();
                    return taskName === searchName;
                });
            }

            // Prioridade 4: Match por nome parcial (SOMENTE se nome do dashboard tem 2+ palavras)
            if (!matchingTask && searchName.split(/\s+/).length >= 2) {
                matchingTask = hvsfTasks.data.find(t => {
                    const taskName = (t.client_name || '').toLowerCase().trim();
                    // Nome do dashboard contido no hvsf ou vice-versa
                    if (taskName.includes(searchName) || searchName.includes(taskName)) return true;
                    // Match por primeiro + último nome
                    const searchParts = searchName.split(/\s+/);
                    const taskParts = taskName.split(/\s+/);
                    if (searchParts.length >= 2 && taskParts.length >= 2) {
                        const searchFirst = searchParts[0];
                        const searchLast = searchParts[searchParts.length - 1];
                        if (taskName.includes(searchFirst) && taskName.includes(searchLast)) return true;
                    }
                    return false;
                });
            }

            if (matchingTask && matchingTask.tasks && matchingTask.tasks.client_data) {
                hvsfCpf = matchingTask.tasks.client_data.cpf || '';
                hvsfWhatsapp = matchingTask.tasks.client_data.whatsapp || '';
            }
        }
        sources.push({
            name: 'SITE HVSF (Cyclopay)',
            cpf: hvsfCpf,
            whatsapp: hvsfWhatsapp,
            table: 'hvsf_tasks',
            field_cpf: 'tasks.client_data.cpf',
            field_whatsapp: 'tasks.client_data.whatsapp'
        });

        // Source 4: Dashboard list (clientes table - only whatsapp)
        const cl = clienteRow.data;
        sources.push({
            name: 'Lista Dashboard (clientes)',
            cpf: '',
            whatsapp: cl?.whatsapp || '',
            table: 'clientes',
            field_cpf: null,
            field_whatsapp: 'whatsapp'
        });

        // Source 5: Cyclopay API (busca direta — match por WhatsApp ou nome)
        let cycloCpf = '';
        let cycloWhatsapp = '';
        try {
            const CYCLOPAY_API_KEY = 'ak_aeb26f6be167cc077eb227c128262e731523d492';
            const cycloResp = await fetch('https://api.cyclopay.com/v1/customers?count=100', {
                method: 'GET',
                headers: { 'api_key': CYCLOPAY_API_KEY, 'Accept': 'application/json' }
            });
            if (cycloResp.ok) {
                const cycloData = await cycloResp.json();
                const cycloCustomers = cycloData.items || [];
                const dashWhatsClean = (cl?.whatsapp || '').replace(/\D/g, '');
                const dashName = (clientName || '').toLowerCase().trim();

                // Prioridade 1: Match por WhatsApp (últimos 9 dígitos)
                let cycloMatch = null;
                if (dashWhatsClean.length >= 8) {
                    cycloMatch = cycloCustomers.find(cust => {
                        const custPhone = String(cust.mobile_number || cust.mobile_phone || cust.phone || '').replace(/\D/g, '');
                        if (custPhone.length < 8) return false;
                        const minLen = Math.min(dashWhatsClean.length, custPhone.length, 9);
                        return dashWhatsClean.slice(-minLen) === custPhone.slice(-minLen);
                    });
                }

                // Prioridade 2: Match por nome exato
                if (!cycloMatch && dashName) {
                    cycloMatch = cycloCustomers.find(cust => {
                        const custFull = ((cust.first_name || '') + ' ' + (cust.last_name || '')).toLowerCase().trim();
                        return custFull === dashName;
                    });
                }

                // Prioridade 3: Match por nome parcial (só se dashboard tem 2+ palavras)
                if (!cycloMatch && dashName && dashName.split(/\s+/).length >= 2) {
                    cycloMatch = cycloCustomers.find(cust => {
                        const custFull = ((cust.first_name || '') + ' ' + (cust.last_name || '')).toLowerCase().trim();
                        return custFull.includes(dashName) || dashName.includes(custFull);
                    });
                }

                if (cycloMatch) {
                    // Extrair CPF
                    if (cycloMatch.document) {
                        let rawDoc = '';
                        if (typeof cycloMatch.document === 'object') {
                            rawDoc = cycloMatch.document.number || cycloMatch.document.value || cycloMatch.document.cpf || cycloMatch.document.cnpj || '';
                        } else {
                            rawDoc = String(cycloMatch.document);
                        }
                        const cleanDoc = rawDoc.replace(/\D/g, '');
                        if (cleanDoc.length === 11) {
                            cycloCpf = cleanDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                        } else if (cleanDoc.length === 14) {
                            cycloCpf = cleanDoc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
                        } else if (cleanDoc) {
                            cycloCpf = rawDoc;
                        }
                    }
                    // Extrair WhatsApp
                    const custPhone = cycloMatch.mobile_number || cycloMatch.mobile_phone || cycloMatch.phone || '';
                    if (custPhone) cycloWhatsapp = custPhone;
                }
            }
        } catch (cycloErr) {
            console.warn('Cyclopay API não disponível para sync modal:', cycloErr.message);
        }
        if (cycloCpf || cycloWhatsapp) {
            sources.push({
                name: 'Cyclopay (API Direta)',
                cpf: cycloCpf,
                whatsapp: cycloWhatsapp,
                table: null,
                field_cpf: null,
                field_whatsapp: null
            });
        }

        // Build the modal content
        _renderTipoSyncContent(body, sources, clientId, clientName);

    } catch (err) {
        console.error('Erro ao carregar dados para sync:', err);
        body.innerHTML = `<div style="color:#ef4444;text-align:center;padding:2rem;">Erro ao carregar dados: ${err.message}</div>`;
    }
}

function _renderTipoSyncContent(body, sources, clientId, clientName) {
    // Collect unique CPFs and WhatsApps
    const cpfValues = [];
    const whatsappValues = [];

    sources.forEach((s, idx) => {
        if (s.cpf && s.cpf.trim() && !s.cpf.startsWith('PEND-')) {
            cpfValues.push({ value: s.cpf.trim(), source: s.name, sourceIdx: idx });
        }
        if (s.whatsapp && s.whatsapp.trim() && s.whatsapp !== '00000000000') {
            whatsappValues.push({ value: s.whatsapp.trim(), source: s.name, sourceIdx: idx });
        }
    });

    let html = '';

    // CPF Section
    html += `<div class="tipo-sync-section">
        <h3>CPF</h3>
        <table class="tipo-sync-table">
            <thead><tr><th></th><th>Valor</th><th>Fonte</th></tr></thead>
            <tbody>`;

    if (cpfValues.length === 0) {
        html += `<tr><td colspan="3" style="color:#666;font-style:italic;text-align:center;">Nenhum CPF registrado</td></tr>`;
    } else {
        cpfValues.forEach((item, i) => {
            html += `<tr>
                <td><input type="radio" name="sync-cpf" class="tipo-sync-radio" value="${_escHtml(item.value)}" data-source="${item.sourceIdx}"></td>
                <td><span class="tipo-sync-value">${_escHtml(item.value)}</span></td>
                <td><span class="tipo-sync-source">${_escHtml(item.source)}</span></td>
            </tr>`;
        });
    }
    html += `</tbody></table></div>`;

    // WhatsApp Section
    html += `<div class="tipo-sync-section">
        <h3>WhatsApp</h3>
        <table class="tipo-sync-table">
            <thead><tr><th></th><th>Valor</th><th>Fonte</th></tr></thead>
            <tbody>`;

    if (whatsappValues.length === 0) {
        html += `<tr><td colspan="3" style="color:#666;font-style:italic;text-align:center;">Nenhum WhatsApp registrado</td></tr>`;
    } else {
        whatsappValues.forEach((item, i) => {
            html += `<tr>
                <td><input type="radio" name="sync-whatsapp" class="tipo-sync-radio" value="${_escHtml(item.value)}" data-source="${item.sourceIdx}"></td>
                <td><span class="tipo-sync-value">${_escHtml(item.value)}</span></td>
                <td><span class="tipo-sync-source">${_escHtml(item.source)}</span></td>
            </tr>`;
        });
    }
    html += `</tbody></table></div>`;

    // Actions
    html += `<div class="tipo-sync-status" id="tipo-sync-status"></div>`;
    html += `<div class="tipo-sync-actions">
        <button class="tipo-sync-btn secondary" id="tipo-sync-close-secondary">Fechar</button>
        <button class="tipo-sync-btn primary" id="tipo-sync-apply-btn" data-client-id="${clientId}" data-client-name="${_escHtml(clientName)}">Sincronizar Selecionados</button>
    </div>`;

    body.innerHTML = html;

    // Add radio selection highlight
    body.querySelectorAll('.tipo-sync-radio').forEach(radio => {
        radio.addEventListener('change', () => {
            const table = radio.closest('table');
            table.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected-row'));
            radio.closest('tr').classList.add('selected-row');
        });
    });

    // Add apply button listener
    const applyBtn = document.getElementById('tipo-sync-apply-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const cId = applyBtn.dataset.clientId;
            const cName = applyBtn.dataset.clientName;
            _applyTipoSync(cId, cName);
        });
    }

    // Fix close button
    const closeSecBtn = document.getElementById('tipo-sync-close-secondary');
    if (closeSecBtn) {
        closeSecBtn.addEventListener('click', () => {
            document.getElementById('tipo-sync-modal').style.display = 'none';
        });
    }
}

async function _applyTipoSync(clientId, clientName) {
    const cpfRadio = document.querySelector('input[name="sync-cpf"]:checked');
    const whatsRadio = document.querySelector('input[name="sync-whatsapp"]:checked');
    const statusEl = document.getElementById('tipo-sync-status');

    if (!cpfRadio && !whatsRadio) {
        statusEl.className = 'tipo-sync-status error';
        statusEl.textContent = 'Selecione pelo menos um CPF ou WhatsApp para sincronizar.';
        return;
    }

    const selectedCpf = cpfRadio ? cpfRadio.value : null;
    const selectedWhatsapp = whatsRadio ? whatsRadio.value : null;

    const btn = document.getElementById('tipo-sync-apply-btn');
    btn.disabled = true;
    btn.textContent = 'Sincronizando...';
    statusEl.className = 'tipo-sync-status';
    statusEl.style.display = 'none';

    try {
        const updates = [];

        // 1. Update dados_cadastrais
        const updateDC = {};
        if (selectedCpf) updateDC.cpf = selectedCpf;
        if (selectedWhatsapp) updateDC.whatsapp = selectedWhatsapp;
        if (Object.keys(updateDC).length > 0) {
            updates.push(
                supabase.from('dados_cadastrais').update(updateDC).eq('cliente_id', clientId)
            );
        }

        // 2. Update diagnosticos_financeiros
        const updateDiag = {};
        if (selectedCpf) updateDiag.cpf = selectedCpf;
        if (selectedWhatsapp) updateDiag.telefone = selectedWhatsapp;
        if (Object.keys(updateDiag).length > 0) {
            updates.push(
                supabase.from('diagnosticos_financeiros').update(updateDiag).eq('cliente_id', clientId)
            );
        }

        // 3. Update clientes table (only whatsapp)
        if (selectedWhatsapp) {
            updates.push(
                supabase.from('clientes').update({ whatsapp: selectedWhatsapp }).eq('id', clientId)
            );
        }

        // Execute all updates
        const results = await Promise.all(updates);

        // Check for errors
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            console.warn('Alguns updates falharam:', errors.map(e => e.error.message));
            statusEl.className = 'tipo-sync-status error';
            statusEl.textContent = `Sincronização parcial: ${errors.length} erro(s). Verifique se os registros existem em todas as tabelas.`;
        } else {
            statusEl.className = 'tipo-sync-status success';
            let msg = 'Sincronização concluída com sucesso!';
            if (selectedCpf) msg += ` CPF: ${selectedCpf}`;
            if (selectedWhatsapp) msg += ` | WhatsApp: ${selectedWhatsapp}`;
            statusEl.textContent = msg;

            // Update the whatsapp input in the dashboard row if whatsapp was synced
            if (selectedWhatsapp) {
                const row = document.querySelector(`tr[data-client-id="${clientId}"]`);
                if (row) {
                    const whatsInput = row.querySelector('.client-whatsapp');
                    if (whatsInput) whatsInput.value = selectedWhatsapp;
                }
            }
        }
    } catch (err) {
        console.error('Erro na sincronização:', err);
        statusEl.className = 'tipo-sync-status error';
        statusEl.textContent = `Erro: ${err.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sincronizar Selecionados';
    }
}

function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============================================================
// CONFLICT BADGES: CPF e WhatsApp divergentes entre fontes
// ============================================================
async function checkDataConflicts(clients) {
    if (!clients || clients.length === 0) return;

    // Buscar dados_cadastrais e diagnosticos_financeiros de uma vez
    const clientIds = clients.map(c => c.id);
    const [dadosRes, diagRes] = await Promise.all([
        supabase.from('dados_cadastrais').select('cliente_id, cpf, whatsapp').in('cliente_id', clientIds),
        supabase.from('diagnosticos_financeiros').select('cliente_id, cpf, telefone').in('cliente_id', clientIds)
    ]);

    const dadosMap = {};
    (dadosRes.data || []).forEach(d => { dadosMap[d.cliente_id] = d; });
    const diagMap = {};
    (diagRes.data || []).forEach(d => { diagMap[d.cliente_id] = d; });

    // Para cada cliente, verificar conflitos
    for (const client of clients) {
        const row = document.querySelector(`tr[data-client-id="${client.id}"]`);
        if (!row) continue;

        const tipoCell = row.querySelector('.tipo-cell');
        if (!tipoCell) continue;

        const dados = dadosMap[client.id];
        const diag = diagMap[client.id];

        // Coletar CPFs (apenas números, ignorar PEND-)
        const cpfs = new Set();
        const addCpf = (val) => {
            if (!val || String(val).startsWith('PEND-')) return;
            const clean = String(val).replace(/\D/g, '');
            if (clean.length >= 11) cpfs.add(clean);
        };
        addCpf(dados?.cpf);
        addCpf(diag?.cpf);

        // Coletar WhatsApps (apenas números, últimos 9 dígitos para normalizar)
        const whatsapps = new Set();
        const addWhats = (val) => {
            if (!val) return;
            const clean = String(val).replace(/\D/g, '');
            if (clean.length >= 8) whatsapps.add(clean.slice(-9));
        };
        addWhats(dados?.whatsapp);
        addWhats(diag?.telefone);
        addWhats(client.whatsapp);

        // Verificar conflitos
        const hasCpfConflict = cpfs.size > 1;
        const hasWhatsConflict = whatsapps.size > 1;

        if (hasCpfConflict || hasWhatsConflict) {
            let badges = '';
            if (hasCpfConflict) {
                badges += '<span class="conflict-badge conflict-cpf" title="CPFs divergentes detectados entre fontes">CPF ⚠</span>';
            }
            if (hasWhatsConflict) {
                badges += '<span class="conflict-badge conflict-whats" title="WhatsApps divergentes detectados entre fontes">WHATS ⚠</span>';
            }
            // Inserir badges após o badge de tipo
            const existingBadge = tipoCell.querySelector('.tipo-badge');
            if (existingBadge) {
                existingBadge.insertAdjacentHTML('afterend', badges);
            } else {
                tipoCell.insertAdjacentHTML('beforeend', badges);
            }
        }
    }
}
