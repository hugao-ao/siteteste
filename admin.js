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

// --- Lógica da Sidebar e Navegação (Funções auxiliares) --- 

// Recolher/Expandir Sidebar
function toggleSidebar() {
    if (!sidebar) return; // Garante que sidebar existe
    sidebar.classList.toggle("collapsed");
    // Ajusta a classe no main content para margem (se existir)
    if (mainContent) {
         mainContent.classList.toggle("sidebar-collapsed");
    }
    localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed"));
}

// Mostrar Seção de Conteúdo Específica
function showContentSection(sectionId) {
    if (!allContentSections) return;
    // Esconde todas as seções
    allContentSections.forEach(section => section.classList.remove("active"));
    // Mostra a seção desejada
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.classList.add("active");
    }
    // Atualiza estado ativo no menu
    updateMenuActiveState(sectionId);
}

// Atualizar Estado Ativo no Menu da Sidebar
function updateMenuActiveState(activeSectionId) {
    if (!sidebarMenuItems) return;
    sidebarMenuItems.forEach(item => {
        item.classList.remove("active");
        // Usa o href para determinar o alvo da seção interna, se aplicável
        const targetHref = item.getAttribute("href");
        if (targetHref && targetHref.includes("#")) {
            const targetSectionIdFromHash = "content-" + targetHref.split("#")[1];
            if (targetSectionIdFromHash === activeSectionId) {
                item.classList.add("active");
            }
        } else if (item.id === "nav-painel-admin" && activeSectionId === 'content-painel') {
            // Caso especial para o link inicial do painel
            item.classList.add('active');
        }
    });
}

// --- Carregar Usuários (MODIFICADO para filtrar por projeto) --- 
async function loadUsers(filterProject = null) { // Adiciona parâmetro opcional
  if (!manageTableBody) return;
  try {
    manageTableBody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    let query = supabase
      .from("credenciais")
      .select("id, usuario, senha, email, nivel, projeto");

    // Aplica filtro de projeto se fornecido
    if (filterProject) {
        console.log(`Filtrando usuários pelo projeto: ${filterProject}`);
        query = query.eq('projeto', filterProject);
    }

    const { data: users, error } = await query;

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
        return; // Sai da função se não houver usuários
    }
    
    users.forEach(user => {
      // Linha para Tabela de Gerenciamento
      const manageTr = document.createElement("tr");
      manageTr.dataset.userId = user.id;
      manageTr.innerHTML = `
        <td>${sanitizeInput(user.usuario)}</td>
        <td>
          <input 
            type="password" 
            id="pass-${user.id}" 
            value="********" 
            data-real-pass="${sanitizeInput(user.senha)}" /* Guarda senha real aqui */
          />
          <button 
            class="toggle-password" 
            data-id="${user.id}"
          >👁️</button>
        </td>
        <td>
          <input 
            type="email" 
            id="email-${user.id}" 
            value="${sanitizeInput(user.email)}"
          />
        </td>
        <td>
          <select id="lvl-${user.id}">
            <option value="usuario" ${user.nivel === "usuario" ? "selected" : ""}>usuario</option>
            <option value="admin" ${user.nivel === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>
          <select id="proj-${user.id}">
            <option value="" ${!user.projeto ? "selected" : ""}>Nenhum</option>
            <option value="Hvc" ${user.projeto === "Hvc" ? "selected" : ""}>Hvc</option>
            <option value="Argos" ${user.projeto === "Argos" ? "selected" : ""}>Argos</option>
            <option value="Planejamento" ${user.projeto === "Planejamento" ? "selected" : ""}>Planejamento</option>
          </select>
        </td>
        <td>
          <button class="save-btn" data-id="${user.id}">Salvar</button>
          ${user.usuario !== sessionStorage.getItem("usuario") 
            ? `<button class="delete-btn" data-id="${user.id}">Excluir</button>` 
            : 
          '<span style="color:gray">[Admin]</span>'}
        </td>
      `;
      manageTableBody.appendChild(manageTr);
    });

  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    manageTableBody.innerHTML = `<tr><td colspan='6' style='color: red;'>${error.message}</td></tr>`;
  }
}

// --- Operações CRUD (mantidas e ajustadas) ---
async function saveUser(id) {
  try {
    const senhaInput = document.getElementById(`pass-${id}`);
    const senha = senhaInput.type === 'text' ? senhaInput.value : null; // Pega a senha só se estiver visível
    const email = document.getElementById(`email-${id}`).value;
    const nivel = document.getElementById(`lvl-${id}`).value;
    const projeto = document.getElementById(`proj-${id}`).value;

    if (!email) {
        alert("O campo E-mail não pode estar vazio.");
        return;
    }

    const updateData = { email, nivel, projeto: projeto || null };
    // Só atualiza a senha se ela foi revelada e modificada
    if (senha && senha !== '********') {
        updateData.senha = senha;
    }

    const { error } = await supabase
      .from("credenciais")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário atualizado com sucesso!");
    // Reseta o campo senha para '********'
    if (senhaInput) {
        senhaInput.type = 'password';
        senhaInput.value = '********';
        // Atualiza o data-real-pass se a senha foi alterada
        if (updateData.senha) {
             senhaInput.dataset.realPass = updateData.senha;
        }
        const toggleBtn = document.querySelector(`.toggle-password[data-id="${id}"]`);
        if (toggleBtn) toggleBtn.textContent = "👁️";
    }
    
  } catch (error) {
    console.error("Erro ao salvar usuário:", error);
    alert("Erro ao salvar: " + error.message);
  }
}

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
    // Recarrega usuários para incluir o novo, respeitando o filtro atual
    const urlParams = new URLSearchParams(window.location.search);
    const currentFilter = urlParams.get('projeto');
    loadUsers(currentFilter);
    showContentSection('content-gerenciar-usuarios'); // Volta para a seção de gerenciamento
    
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    alert("Erro ao criar usuário: " + error.message);
  }
}

// --- Navegação para Dashboard do Usuário (mantida) ---
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

// --- Navegação para Gerenciamento de Clientes (Admin - Sidebar) ---
function viewClientesDashboard() {
    sessionStorage.removeItem('viewing_user_id');
    sessionStorage.removeItem('viewing_username');
    // Mantém o filtro de projeto se existir
    const urlParams = new URLSearchParams(window.location.search);
    const currentFilter = urlParams.get('projeto');
    window.location.href = `clientes-dashboard.html${currentFilter ? '?projeto=' + currentFilter : ''}`;
}

// --- Logout (mantido) ---
function logout() {
  sessionStorage.clear();
  localStorage.removeItem("sidebarCollapsed"); // Limpa estado da sidebar no logout
  window.location.href = "index.html";
}

// --- Função para Configurar Listeners (Chamada após sidebarReady) ---
function setupAdminListeners() {
    console.log("Setting up admin listeners...");
    // Encontra elementos DOM APÓS sidebar estar pronta
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

    // Configura Listeners da Sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (navPainelAdmin) {
        navPainelAdmin.addEventListener('click', (e) => {
            // Verifica se já está na admin-dashboard.html para evitar recarga
            if (window.location.pathname.endsWith('admin-dashboard.html') && !window.location.search.includes('projeto')) {
                e.preventDefault();
                showContentSection('content-painel');
            } // Senão, deixa o link navegar normalmente para limpar o contexto
        });
    }
    if (navGerenciarUsuarios) {
        navGerenciarUsuarios.addEventListener('click', (e) => {
            // Verifica se já está na admin-dashboard.html com o hash certo
            if (window.location.pathname.endsWith('admin-dashboard.html') && window.location.hash === '#gerenciar-usuarios') {
                e.preventDefault();
                showContentSection('content-gerenciar-usuarios');
                // Recarrega usuários caso o filtro tenha mudado (via URL)
                const urlParams = new URLSearchParams(window.location.search);
                const currentFilter = urlParams.get('projeto');
                loadUsers(currentFilter);
            } // Senão, deixa o link navegar normalmente
        });
    }
    if (navGerenciarClientes) {
        // Listener removido daqui, pois o link agora navega para outra página
        // A navegação é gerenciada diretamente pelo href no sidebar.js
    }
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', logout);
    }

    // Delegação de Eventos para Tabela de Gerenciamento
    if (manageTableBody) {
        manageTableBody.addEventListener("click", e => {
           const target = e.target;
           const id = target.dataset.id;

           if (target.classList.contains("toggle-password")) {
             const input = document.getElementById(`pass-${id}`);
             if (input) {
                if (input.type === "password") {
                    input.type = "text";
                    input.value = input.dataset.realPass || ''; // Mostra senha real
                    target.textContent = "🙈";
                    // Define um timeout para voltar a ser password após 3 segundos
                    setTimeout(() => {
                        const currentInput = document.getElementById(`pass-${id}`);
                        if (currentInput && currentInput.type === "text") { // Verifica se ainda está como texto
                            currentInput.type = "password";
                            currentInput.value = '********';
                            target.textContent = "👁️";
                        }
                    }, 3000);
                } else {
                    input.type = "password";
                    input.value = '********';
                    target.textContent = "👁️";
                }
             }
           } else if (target.classList.contains("save-btn")) {
             saveUser(id);
           } else if (target.classList.contains("delete-btn")) {
             deleteUser(id);
           }
        });
    }

    // Formulário Criar Usuário
    if (createUserForm) {
        createUserForm.addEventListener("submit", createUser);
    }

    // *** Lógica de Inicialização que depende da Sidebar ***
    // Verifica estado da sidebar no localStorage
    const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    if (sidebarCollapsed && sidebar) {
        sidebar.classList.add("collapsed");
        if (mainContent) {
            mainContent.classList.add("sidebar-collapsed");
        }
    }

    // *** Lógica de Inicialização da Seção e Carregamento de Dados ***
    const urlParams = new URLSearchParams(window.location.search);
    const filterProjectFromUrl = urlParams.get('projeto');
    const currentHash = window.location.hash.substring(1); // Remove o '#'

    // Carrega usuários, aplicando filtro se veio de um dashboard de projeto
    loadUsers(filterProjectFromUrl);

    // Decide qual seção mostrar baseado no HASH
    let initialSection = 'content-painel'; // Padrão é o painel admin
    if (currentHash === 'gerenciar-usuarios') {
        initialSection = 'content-gerenciar-usuarios';
        console.log(`Carregando seção: ${initialSection}`);
        // Adiciona título indicando o projeto, se houver filtro
        if (filterProjectFromUrl) {
            const sectionTitle = document.querySelector(`#${initialSection} h2`);
            if(sectionTitle) {
                // Evita adicionar o nome do projeto múltiplas vezes
                if (!sectionTitle.textContent.includes(`(${filterProjectFromUrl})`)) {
                   sectionTitle.textContent += ` (${filterProjectFromUrl})`;
                }
            }
        }
    }

    // Mostra a seção inicial determinada
    showContentSection(initialSection);

    console.log("Admin listeners and initial setup complete.");
}

// --- Inicialização Principal (Espera sidebarReady) --- 
if (checkAccess()) {
  console.log("Access checked. Waiting for sidebarReady event...");
  document.addEventListener('sidebarReady', setupAdminListeners, { once: true }); // Roda a configuração uma vez quando a sidebar estiver pronta
}

