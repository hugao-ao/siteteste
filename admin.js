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

// --- Elementos DOM --- 
// Sidebar
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const navPainelAdmin = document.getElementById("nav-painel-admin");
const navGerenciarUsuarios = document.getElementById("nav-gerenciar-usuarios");
// const navListarUsuarios = document.getElementById("nav-listar-usuarios"); // REMOVIDO
const navGerenciarClientes = document.getElementById("nav-gerenciar-clientes");
const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");
const sidebarMenuItems = document.querySelectorAll(".sidebar-menu li a, .sidebar-menu li button"); // Para gerenciar estado ativo

// Conteúdo Principal
const mainContent = document.getElementById("main-content");
const contentPainel = document.getElementById("content-painel");
const contentGerenciarUsuarios = document.getElementById("content-gerenciar-usuarios");
// const contentListarUsuarios = document.getElementById("content-listar-usuarios"); // REMOVIDO
const allContentSections = document.querySelectorAll(".content-section");

// Tabelas e Formulários (dentro das seções de conteúdo)
const manageTableBody = document.querySelector("#manage-users-table tbody");
// const listTableBody = document.querySelector("#list-users-table tbody"); // REMOVIDO
const createUserForm = document.getElementById("create-user-form");
const newUserInput = document.getElementById("new-user");
const newPassInput = document.getElementById("new-pass");
const newEmailInput = document.getElementById("new-email");
const newLevelSelect = document.getElementById("new-level");
const newProjectSelect = document.getElementById("new-project");

// REMOVIDO: Botões antigos
// const historyBackBtn = document.getElementById("history-back-btn"); 
// const btnLogout = document.getElementById("logout-btn");
// const tabBtnManage = document.getElementById("tab-btn-manage");
// const tabBtnList = document.getElementById("tab-btn-list");
// const tabContentManage = document.getElementById("tab-content-manage"); // Agora é contentGerenciarUsuarios
// const tabContentList = document.getElementById("tab-content-list"); // Agora é contentListarUsuarios
// const adminClientesBtn = document.getElementById("admin-clientes-btn"); // Agora é navGerenciarClientes

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

// --- Lógica da Sidebar e Navegação --- 

// Recolher/Expandir Sidebar
function toggleSidebar() {
    sidebar.classList.toggle("collapsed");
    // Salvar estado no localStorage (opcional)
    localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed"));
}

// Mostrar Seção de Conteúdo Específica
function showContentSection(sectionId) {
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
    sidebarMenuItems.forEach(item => {
        item.classList.remove("active");
        const targetSectionId = item.dataset.targetSection; // Adicionar data-target-section nos links do HTML
        if (targetSectionId === activeSectionId) {
            item.classList.add("active");
        }
    });
    // Caso especial para o link inicial do painel
    if (activeSectionId === 'content-painel' && navPainelAdmin) {
        navPainelAdmin.classList.add('active');
    }
}

// --- Carregar Usuários (MODIFICADO para filtrar por projeto) --- 
async function loadUsers(filterProject = null) { // Adiciona parâmetro opcional
  try {
    manageTableBody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    // listTableBody.innerHTML = "<tr><td colspan=\'5\'>Carregando...</td></tr>"; // REMOVIDO   
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
    // listTableBody.innerHTML = ""; // REMOVIDO
    
    if (users.length === 0 && filterProject) {
        manageTableBody.innerHTML = `<tr><td colspan='6'>Nenhum usuário encontrado para o projeto ${sanitizeInput(filterProject)}.</td></tr>`;
        listTableBody.innerHTML = `<tr><td colspan='5'>Nenhum usuário encontrado para o projeto ${sanitizeInput(filterProject)}.</td></tr>`;
        return; // Sai da função se não houver usuários para o projeto
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
            value="${sanitizeInput(user.senha)}" 
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

      // Linha para Tabela de Lista (REMOVIDA)
      /*
      const listTr = document.createElement("tr");
      listTr.dataset.userId = user.id;
      listTr.innerHTML = `
        <td>${sanitizeInput(user.usuario)}</td>
        <td>${sanitizeInput(user.email)}</td>
        <td>${sanitizeInput(user.nivel)}</td>
        <td>${sanitizeInput(user.projeto) || 'Nenhum'}</td>
        <td>
          <button 
            class="view-user-dashboard-btn" 
            data-id="${user.id}" 
            data-username="${sanitizeInput(user.usuario)}"
            data-projeto="${sanitizeInput(user.projeto) || ''}" 
          >Ver Dashboard</button>
        </td>
      `;
      listTableBody.appendChild(listTr);
      */
    });

  } catch (error) { // <<< CORRIGIDO
    console.error("Erro ao carregar usuários:", error);
    manageTableBody.innerHTML = `<tr><td colspan='6' style='color: red;'>${error.message}</td></tr>`;
    // listTableBody.innerHTML = `<tr><td colspan='5' style='color: red;'>${error.message}</td></tr>`; // REMOVIDO
  }
}

// --- Operações CRUD (mantidas) ---
async function saveUser(id) {
  try {
    const senhaInput = document.getElementById(`pass-${id}`);
    const senha = senhaInput.value;
    const email = document.getElementById(`email-${id}`).value;
    const nivel = document.getElementById(`lvl-${id}`).value;
    const projeto = document.getElementById(`proj-${id}`).value;

    if (!email) {
        alert("O campo E-mail não pode estar vazio.");
        return;
    }

    const updateData = { email, nivel, projeto: projeto || null };
    if (senha && senha !== '********') {
        updateData.senha = senha;
    }

    const { error } = await supabase
      .from("credenciais")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário atualizado com sucesso!");
    // Atualização da tabela de lista removida
    /*
    const listRow = listTableBody.querySelector(`tr[data-user-id="${id}"]`);
    if (listRow) {
        listRow.children[1].textContent = sanitizeInput(email);
        listRow.children[2].textContent = sanitizeInput(nivel);
        listRow.children[3].textContent = sanitizeInput(projeto) || 'Nenhum';
        const viewBtn = listRow.querySelector('.view-user-dashboard-btn');
        if (viewBtn) {
            viewBtn.dataset.projeto = sanitizeInput(projeto) || '';
        }
    }
    */
    if (senhaInput) senhaInput.value = '********'; 
    
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
    // Remoção da tabela de lista removida
    /*
    const listRowToRemove = listTableBody.querySelector(`tr[data-user-id="${id}"]`);
    if (listRowToRemove) listRowToRemove.remove();
    */
    
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
    loadUsers(); // Recarrega usuários para incluir o novo
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
    window.location.href = `clientes-dashboard.html`;
}

// --- Logout (mantido) ---
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// --- Event Listeners --- 

// Sidebar Toggle
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
}

// Sidebar Navigation
if (navPainelAdmin) {
    navPainelAdmin.dataset.targetSection = 'content-painel'; // Adiciona data attribute
    navPainelAdmin.addEventListener('click', (e) => {
        e.preventDefault(); // Previne recarregamento da página se for link real
        showContentSection('content-painel');
    });
}
if (navGerenciarUsuarios) {
    navGerenciarUsuarios.dataset.targetSection = 'content-gerenciar-usuarios'; // Adiciona data attribute
    navGerenciarUsuarios.addEventListener('click', (e) => {
        e.preventDefault();
        showContentSection('content-gerenciar-usuarios');
    });
}
// Listener para navListarUsuarios removido
if (navGerenciarClientes) {
    navGerenciarClientes.addEventListener('click', (e) => {
        e.preventDefault();
        viewClientesDashboard(); // Navega para a página de clientes
    });
}

if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', logout);
}

// REMOVIDO: Listeners antigos das abas e botões
// historyBackBtn.addEventListener('click', () => history.back()); 
// tabBtnManage.addEventListener('click', () => switchTab('manage'));
// tabBtnList.addEventListener('click', () => switchTab('list'));
// adminClientesBtn.addEventListener('click', viewClientesDashboard);
// btnLogout.addEventListener('click', logout);

// Delegação de Eventos para Tabelas (mantido e adaptado)
if (manageTableBody) {
    manageTableBody.addEventListener("click", e => {
       const target = e.target;
       const id = target.dataset.id;

       if (target.classList.contains("toggle-password")) {
         const input = document.getElementById(`pass-${id}`);
         if (input) {
            const originalValue = input.dataset.originalValue || input.value; // Guarda o valor original
            input.dataset.originalValue = originalValue; // Garante que está guardado

            if (input.type === "password") {
                input.type = "text";
                input.value = originalValue; // Mostra valor real
                target.textContent = "🙈";
                // Define um timeout para voltar a ser password após 3 segundos
                setTimeout(() => {
                    const currentInput = document.getElementById(`pass-${id}`);
                    if (currentInput && currentInput.type === "text") { // Verifica se ainda é texto
                       currentInput.type = "password";
                       // Não redefinir o valor aqui, deixa o original
                       target.textContent = "👁️";
                    }
                }, 3000);
            } else {
                input.type = "password";
                // Não precisa mudar o valor, o tipo password já mascara
                target.textContent = "👁️";
            }
         }
       } else if (target.classList.contains("save-btn")) {
         if (id) saveUser(id);
       } else if (target.classList.contains("delete-btn")) {
         if (id) deleteUser(id);
       }
     });
}

// Listener para listTableBody removido
/*
if (listTableBody) {
     listTableBody.addEventListener("click", e => {
        const target = e.target;
        if (target.classList.contains("view-user-dashboard-btn")) {
            const userId = target.dataset.id;
            const username = target.dataset.username;
            const userProject = target.dataset.projeto;
            if (userId && username) {
                viewUserDashboard(userId, username, userProject);
            }
        }
     });
}
*/
            if (userId && username !== undefined) {
                viewUserDashboard(userId, username, userProject);
            }
        }
     });
}

// Formulário Criar Usuário (mantido)
if (createUserForm) {
    createUserForm.addEventListener("submit", createUser);
}

// --- Inicialização (MODIFICADA para ler projeto da URL) --- 
if (checkAccess()) {
  // *** MODIFICAÇÃO: Ler parâmetro de projeto da URL ***
  const urlParams = new URLSearchParams(window.location.search);
  const filterProjectFromUrl = urlParams.get('projeto');
  const currentHash = window.location.hash.substring(1); // Remove o '#'

  // Carrega usuários, aplicando filtro se veio de um dashboard de projeto
  loadUsers(filterProjectFromUrl);

  // Verifica estado da sidebar no localStorage (opcional)
  const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (sidebarCollapsed && sidebar) {
      sidebar.classList.add("collapsed");
  }

  // *** MODIFICAÇÃO: Decide qual seção mostrar ***
  let initialSection = 'content-painel'; // Padrão é o painel admin
  if (filterProjectFromUrl) {
      // Se veio de um dashboard de projeto (admin-projeto-dashboard.html), mostra a lista de usuários por padrão
      // O link no dashboard do projeto já aponta para #listar-usuarios
      if (currentHash === 'listar-usuarios') {
          initialSection = 'content-listar-usuarios';
      } else if (currentHash === 'gerenciar-usuarios') {
          // Se o hash for gerenciar, ainda mostra a lista no contexto do projeto
          initialSection = 'content-listar-usuarios'; 
      } else {
          // Se não houver hash válido, mostra a lista por padrão no contexto do projeto
          initialSection = 'content-listar-usuarios';
      }
      console.log(`Carregando admin.js no contexto do projeto: ${filterProjectFromUrl}, seção: ${initialSection}`);
      // Poderíamos adicionar um título indicando o projeto aqui
      const sectionTitle = document.querySelector(`#${initialSection} h2`);
      if(sectionTitle) {
          sectionTitle.textContent += ` (${filterProjectFromUrl})`;
      }

  } else if (currentHash) {
      // Se não tem filtro de projeto, mas tem hash, mostra a seção correspondente
      if (currentHash === 'gerenciar-usuarios') {
          initialSection = 'content-gerenciar-usuarios';
      } else if (currentHash === 'listar-usuarios') {
          initialSection = 'content-listar-usuarios';
      }
      // Se for outro hash ou inválido, mantém 'content-painel'
  }

  // Mostra a seção inicial determinada
  showContentSection(initialSection); 
}
