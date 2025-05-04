// admin.js
import { supabase } from "./supabase.js";

// ─── Proteção de UI: se não for admin, substitui todo o body ───
if (sessionStorage.getItem("nivel") !== "admin") {
  document.body.innerHTML = `
   <main style="padding:2rem; text-align:center;">
     <h1 style="color:#c62828;">Acesso negado</h1>
     <p>Esta área é restrita ao administrador.</p>
   </main>`;
 throw new Error("Acesso não autorizado");
}
// ──────────────────────────────────────────────────────────────

// Função de escape para prevenir XSS e erros de sintaxe
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

// --- Elementos DOM (Definidos dentro de initializeAdminPageLogic) ---
let sidebar, sidebarToggle, navPainelAdmin, navGerenciarUsuarios, navGerenciarClientes, sidebarLogoutBtn, sidebarMenuItems;
let mainContent, contentPainel, contentGerenciarUsuarios, allContentSections;
let manageTableBody, createUserForm, newUserInput, newPassInput, newEmailInput, newLevelSelect, newProjectSelect;
let saveAllUsersBtn; // Novo botão para salvar tudo

// --- Estado para Rastrear Alterações ---
const modifiedUserIds = new Set(); // Conjunto para guardar IDs de usuários modificados

// Validação de acesso (mantida)
function checkAccess() {
  const user = sessionStorage.getItem("usuario");
  const nivel = sessionStorage.getItem("nivel");
  if (!user || nivel !== "admin") {
    alert("Acesso não autorizado. Faça login como admin.");
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// --- Lógica da Sidebar e Navegação (Funções auxiliares - mantidas) --- 
function toggleSidebar() {
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed");
    if (mainContent) {
         mainContent.classList.toggle("sidebar-collapsed");
    }
    localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed"));
}

function showContentSection(sectionId) {
    if (!allContentSections) return;
    allContentSections.forEach(section => section.classList.remove("active"));
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.classList.add("active");
    }
    updateMenuActiveState(sectionId);
}

function updateMenuActiveState(activeSectionId) {
    if (!sidebarMenuItems) return;
    sidebarMenuItems.forEach(item => {
        item.classList.remove("active");
        const targetHref = item.getAttribute("href");
        if (targetHref && targetHref.includes("#")) {
            const targetSectionIdFromHash = "content-" + targetHref.split("#")[1];
            if (targetSectionIdFromHash === activeSectionId) {
                item.classList.add("active");
            }
        } else if (item.id === "nav-painel-admin" && activeSectionId === 'content-painel') {
            item.classList.add('active');
        }
    });
}

// --- Carregar Usuários (MODIFICADO para salvar em lote) --- 
async function loadUsers(filterProject = null) {
  if (!manageTableBody) return;
  modifiedUserIds.clear(); // Limpa modificações ao recarregar
  if (saveAllUsersBtn) saveAllUsersBtn.disabled = true; // Desabilita botão salvar ao recarregar

  try {
    manageTableBody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    let query = supabase
      .from("credenciais")
      .select("id, usuario, senha, email, nivel, projeto");

    if (filterProject) {
        console.log(`Filtrando usuários pelo projeto: ${filterProject}`);
        query = query.eq('projeto', filterProject);
    }

    const { data: users, error } = await query.order('usuario', { ascending: true }); // Ordena para consistência

    if (error) {
        if (error.code === '42703' && error.message.includes('projeto')) {
            throw new Error("Erro ao carregar usuários: A coluna 'projeto' não existe na tabela 'credenciais'. Por favor, adicione a coluna no Supabase.");
        } else {
            throw error;
        }
    }

    manageTableBody.innerHTML = "";
    
    if (users.length === 0) {
        const message = filterProject 
            ? `Nenhum usuário encontrado para o projeto ${sanitizeInput(filterProject)}.`
            : "Nenhum usuário cadastrado.";
        manageTableBody.innerHTML = `<tr><td colspan='6'>${message}</td></tr>`;
        return;
    }
    
    users.forEach(user => {
      const manageTr = document.createElement("tr");
      manageTr.dataset.userId = user.id;
      // Guarda valores originais para comparação (opcional, mas útil)
      manageTr.dataset.originalEmail = user.email || '';
      manageTr.dataset.originalNivel = user.nivel || 'usuario';
      manageTr.dataset.originalProjeto = user.projeto || '';

      manageTr.innerHTML = `
        <td>${sanitizeInput(user.usuario)}</td>
        <td>
          <input 
            type="password" 
            class="user-input" 
            data-field="senha" 
            id="pass-${user.id}" 
            value="********" 
            data-real-pass="${sanitizeInput(user.senha)}" 
          />
          <button 
            class="toggle-password" 
            data-id="${user.id}"
          >👁️</button>
        </td>
        <td>
          <input 
            type="email" 
            class="user-input" 
            data-field="email" 
            id="email-${user.id}" 
            value="${sanitizeInput(user.email)}"
          />
        </td>
        <td>
          <select class="user-input" data-field="nivel" id="lvl-${user.id}">
            <option value="usuario" ${user.nivel === "usuario" ? "selected" : ""}>usuario</option>
            <option value="admin" ${user.nivel === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>
          <select class="user-input" data-field="projeto" id="proj-${user.id}">
            <option value="" ${!user.projeto ? "selected" : ""}>Nenhum</option>
            <option value="Hvc" ${user.projeto === "Hvc" ? "selected" : ""}>Hvc</option>
            <option value="Argos" ${user.projeto === "Argos" ? "selected" : ""}>Argos</option>
            <option value="Planejamento" ${user.projeto === "Planejamento" ? "selected" : ""}>Planejamento</option>
          </select>
        </td>
        <td>
          ${user.usuario !== sessionStorage.getItem("usuario") 
            ? `<button class="delete-btn" data-id="${user.id}">Excluir</button>` 
            : '<span style="color:gray">[Admin]</span>'}
        </td>
      `;
      manageTableBody.appendChild(manageTr);
    });

  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    manageTableBody.innerHTML = `<tr><td colspan='6' style='color: red;'>${error.message}</td></tr>`;
  }
}

// --- Nova Função para Salvar Todas as Alterações --- 
async function saveAllUserChanges() {
    if (modifiedUserIds.size === 0) {
        alert("Nenhuma alteração detectada para salvar.");
        return;
    }

    if (!confirm(`Salvar alterações para ${modifiedUserIds.size} usuário(s)?`)) {
        return;
    }

    saveAllUsersBtn.disabled = true;
    saveAllUsersBtn.textContent = 'Salvando...';

    const updates = [];
    for (const id of modifiedUserIds) {
        const row = manageTableBody.querySelector(`tr[data-user-id="${id}"]`);
        if (!row) continue;

        const senhaInput = document.getElementById(`pass-${id}`);
        const senha = senhaInput.type === 'text' ? senhaInput.value : null; // Pega a senha só se estiver visível
        const email = document.getElementById(`email-${id}`).value;
        const nivel = document.getElementById(`lvl-${id}`).value;
        const projeto = document.getElementById(`proj-${id}`).value;

        if (!email) {
            alert(`Erro: O campo E-mail não pode estar vazio para o usuário na linha com ID ${id}.`);
            saveAllUsersBtn.disabled = false;
            saveAllUsersBtn.textContent = 'Salvar Todas as Alterações';
            return; // Interrompe o salvamento
        }

        const updateData = { id, email, nivel, projeto: projeto || null };
        if (senha && senha !== '********') {
            updateData.senha = senha;
        }
        updates.push(updateData);
    }

    console.log("Enviando atualizações:", updates);

    try {
        // Supabase upsert pode ser usado para batch update/insert
        // Se a senha não for incluída, ela não será alterada.
        const { data, error } = await supabase.from('credenciais').upsert(updates, {
            onConflict: 'id' // Especifica a coluna de conflito para fazer update em vez de insert
        });

        if (error) throw error;

        alert(`Alterações salvas com sucesso para ${updates.length} usuário(s)!`);
        modifiedUserIds.clear(); // Limpa o set de modificados
        // Reseta campos de senha e botões toggle após salvar
        updates.forEach(update => {
            const senhaInput = document.getElementById(`pass-${update.id}`);
            if (senhaInput) {
                senhaInput.type = 'password';
                senhaInput.value = '********';
                // Atualiza o data-real-pass se a senha foi alterada
                if (update.senha) {
                    senhaInput.dataset.realPass = update.senha;
                }
                const toggleBtn = document.querySelector(`.toggle-password[data-id="${update.id}"]`);
                if (toggleBtn) toggleBtn.textContent = "👁️";
            }
            // Remove a marcação visual de modificado (se houver)
            const row = manageTableBody.querySelector(`tr[data-user-id="${update.id}"]`);
            if(row) row.classList.remove('modified');
        });

    } catch (error) {
        console.error("Erro ao salvar alterações em lote:", error);
        alert("Erro ao salvar alterações: " + error.message);
    } finally {
        saveAllUsersBtn.disabled = true; // Desabilita novamente após salvar (até nova modificação)
        saveAllUsersBtn.textContent = 'Salvar Todas as Alterações';
    }
}

// --- Função para Marcar Linha como Modificada --- 
function markUserAsModified(event) {
    const target = event.target;
    const row = target.closest('tr');
    if (row && row.dataset.userId) {
        const userId = row.dataset.userId;
        // Poderia adicionar uma verificação se o valor realmente mudou
        modifiedUserIds.add(userId);
        row.classList.add('modified'); // Adiciona classe visual (opcional)
        if (saveAllUsersBtn) saveAllUsersBtn.disabled = false; // Habilita o botão de salvar
        console.log("Usuários modificados:", modifiedUserIds);
    }
}

// --- Operações CRUD (deleteUser e createUser mantidas, saveUser removida) ---
// async function saveUser(id) { ... } // REMOVIDA

async function deleteUser(id) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  
  try {
    const { error } = await supabase
      .from("credenciais")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário excluído com sucesso!");
    const manageRowToRemove = manageTableBody.querySelector(`tr[data-user-id="${id}"]`);
    if (manageRowToRemove) manageRowToRemove.remove();
    modifiedUserIds.delete(id); // Remove do set de modificados se estava lá
    if (modifiedUserIds.size === 0 && saveAllUsersBtn) {
        saveAllUsersBtn.disabled = true; // Desabilita se não houver mais modificações
    }
    
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    alert("Erro ao excluir: " + error.message);
  }
}

async function createUser(event) {
  event.preventDefault();
  try {
    const usuario = newUserInput.value.trim();
    const senha = newPassInput.value.trim();
    const email = newEmailInput.value.trim();
    const nivel = newLevelSelect.value;
    const projeto = newProjectSelect.value;

    if (!usuario || !senha || !email) {
      throw new Error("Preencha todos os campos obrigatórios: Usuário, Senha e E-mail.");
    }

    const { data, error } = await supabase
      .from("credenciais")
      .insert({ usuario, senha, email, nivel, projeto: projeto || null })
      .select();

    if (error) {
        if (error.code === '23505') { 
            throw new Error(`Erro: O nome de usuário "${usuario}" já existe.`);
        } else if (error.code === '42703' && error.message.includes('projeto')) {
             throw new Error("Erro ao criar usuário: A coluna 'projeto' não existe na tabela 'credenciais'. Por favor, adicione a coluna no Supabase.");
        } else {
            throw error;
        }
    }
    
    alert("Usuário criado com sucesso!");
    createUserForm.reset();
    newProjectSelect.value = "";
    const urlParams = new URLSearchParams(window.location.search);
    const currentFilter = urlParams.get('projeto');
    loadUsers(currentFilter); // Recarrega a lista
    showContentSection('content-gerenciar-usuarios');
    
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    alert("Erro ao criar usuário: " + error.message);
  }
}

// --- Navegação (mantidas) ---
function viewUserDashboard(userId, username, userProject) {
    sessionStorage.setItem('viewing_user_id', userId);
    sessionStorage.setItem('viewing_username', username);
    sessionStorage.setItem('admin_viewer_username', sessionStorage.getItem('usuario'));
    
    if (userProject === 'Planejamento') {
        window.location.href = `planejamento-dashboard.html`; 
    } else {
        window.location.href = `user-dashboard.html`; 
    }
}

function viewClientesDashboard() {
    sessionStorage.removeItem('viewing_user_id');
    sessionStorage.removeItem('viewing_username');
    const urlParams = new URLSearchParams(window.location.search);
    const currentFilter = urlParams.get('projeto');
    window.location.href = `clientes-dashboard.html${currentFilter ? '?projeto=' + currentFilter : ''}`;
}

function logout() {
  sessionStorage.clear();
  localStorage.removeItem("sidebarCollapsed");
  window.location.href = "index.html";
}

// --- Função para Configurar Listeners (MODIFICADA para salvar em lote) ---
function setupAdminListeners() {
    console.log("Setting up admin listeners...");
    // Encontra elementos DOM
    sidebar = document.getElementById("sidebar");
    sidebarToggle = document.getElementById("sidebar-toggle");
    navPainelAdmin = document.getElementById("nav-painel-admin");
    navGerenciarUsuarios = document.getElementById("nav-gerenciar-usuarios");
    navGerenciarClientes = document.getElementById("nav-gerenciar-clientes");
    sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
    sidebarMenuItems = sidebar ? sidebar.querySelectorAll(".sidebar-menu li a, .sidebar-menu li button") : [];

    mainContent = document.getElementById("main-content");
    contentPainel = document.getElementById("content-painel");
    contentGerenciarUsuarios = document.getElementById("content-gerenciar-usuarios");
    allContentSections = document.querySelectorAll(".content-section");

    manageTableBody = document.querySelector("#manage-users-table tbody");
    createUserForm = document.getElementById("create-user-form");
    newUserInput = document.getElementById("new-user");
    newPassInput = document.getElementById("new-pass");
    newEmailInput = document.getElementById("new-email");
    newLevelSelect = document.getElementById("new-level");
    newProjectSelect = document.getElementById("new-project");
    saveAllUsersBtn = document.getElementById("save-all-users-btn"); // Pega o novo botão

    // Configura Listeners da Sidebar (mantidos)
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (navPainelAdmin) {
        navPainelAdmin.addEventListener('click', (e) => {
            if (window.location.pathname.endsWith('admin-dashboard.html') && !window.location.search.includes('projeto')) {
                e.preventDefault();
                showContentSection('content-painel');
            }
        });
    }
    if (navGerenciarUsuarios) {
        navGerenciarUsuarios.addEventListener('click', (e) => {
            if (window.location.pathname.endsWith('admin-dashboard.html') && window.location.hash === '#gerenciar-usuarios') {
                e.preventDefault();
                showContentSection('content-gerenciar-usuarios');
                const urlParams = new URLSearchParams(window.location.search);
                const currentFilter = urlParams.get('projeto');
                loadUsers(currentFilter);
            }
        });
    }
    if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', logout);

    // --- Delegação de Eventos para Tabela de Gerenciamento (MODIFICADA) ---
    if (manageTableBody) {
        // Listener para detectar mudanças nos inputs/selects
        manageTableBody.addEventListener("input", markUserAsModified);
        manageTableBody.addEventListener("change", markUserAsModified); // Para selects

        // Listener para botões de ação (toggle e delete)
        manageTableBody.addEventListener("click", e => {
           const target = e.target;
           const id = target.dataset.id;

           if (target.classList.contains("toggle-password")) {
             const input = document.getElementById(`pass-${id}`);
             if (input) {
                if (input.type === "password") {
                    input.type = "text";
                    input.value = input.dataset.realPass || '';
                    target.textContent = "🙈";
                    // Marca como modificado se a senha for revelada
                    markUserAsModified({ target: input }); 
                    setTimeout(() => {
                        const currentInput = document.getElementById(`pass-${id}`);
                        if (currentInput && currentInput.type === "text") {
                            currentInput.type = "password";
                            currentInput.value = '********';
                            target.textContent = "👁️";
                        }
                    }, 5000); // Aumentado para 5s
                } else {
                    input.type = "password";
                    input.value = '********';
                    target.textContent = "👁️";
                }
             }
           } else if (target.classList.contains("delete-btn")) {
             deleteUser(id);
           }
           // REMOVIDO: else if (target.classList.contains("save-btn")) { saveUser(id); }
        });
    }

    // Listener para o botão Salvar Todas as Alterações
    if (saveAllUsersBtn) {
        saveAllUsersBtn.addEventListener('click', saveAllUserChanges);
        saveAllUsersBtn.disabled = true; // Começa desabilitado
    }

    // Formulário Criar Usuário (mantido)
    if (createUserForm) {
        createUserForm.addEventListener("submit", createUser);
    }

    // Lógica de Inicialização (mantida)
    const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    if (sidebarCollapsed && sidebar) {
        sidebar.classList.add("collapsed");
        if (mainContent) {
            mainContent.classList.add("sidebar-collapsed");
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const filterProjectFromUrl = urlParams.get('projeto');
    const currentHash = window.location.hash.substring(1);

    loadUsers(filterProjectFromUrl);

    let initialSection = 'content-painel';
    if (currentHash === 'gerenciar-usuarios') {
        initialSection = 'content-gerenciar-usuarios';
        if (filterProjectFromUrl) {
            const sectionTitle = document.querySelector(`#${initialSection} h2`);
            if(sectionTitle && !sectionTitle.textContent.includes(`(${filterProjectFromUrl})`)) {
               sectionTitle.textContent += ` (${filterProjectFromUrl})`;
            }
        }
    }
    showContentSection(initialSection);
    console.log("Admin listeners and initial setup complete.");
}

// --- Inicialização Principal (mantida) --- 
if (checkAccess()) {
  console.log("Access checked. Waiting for sidebarReady event...");
  document.addEventListener('sidebarReady', setupAdminListeners, { once: true });
}
