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

// admin.js
import { supabase } from "./supabase.js";

// Função de escape para prevenir XSS e erros de sintaxe
const sanitizeInput = (str) => {
  // << CORREÇÃO DEFINITIVA APLICADA AQUI (MAIS UMA VEZ) >>
  if (str === null || str === undefined) return ""; // Garante retorno de string vazia
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;") // Corrigido para escapar aspas simples corretamente
    .replace(/`/g, "&#x60;");
};

// Elementos DOM
const btnLogout = document.getElementById("logout-btn");
const manageTableBody = document.querySelector("#manage-users-table tbody");
const listTableBody = document.querySelector("#list-users-table tbody");
const createUserForm = document.getElementById("create-user-form");
const newUserInput = document.getElementById("new-user");
const newPassInput = document.getElementById("new-pass");
const newEmailInput = document.getElementById("new-email");
const newLevelSelect = document.getElementById("new-level");
const newProjectSelect = document.getElementById("new-project");

// Abas e Botão Clientes Admin
const tabBtnManage = document.getElementById("tab-btn-manage");
const tabBtnList = document.getElementById("tab-btn-list");
const tabContentManage = document.getElementById("tab-content-manage");
const tabContentList = document.getElementById("tab-content-list");
const adminClientesBtn = document.getElementById("admin-clientes-btn");

// Validação de acesso
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

// --- Lógica das Abas ---
function switchTab(activeTab) {
  if (activeTab === 'manage') {
    tabBtnManage.classList.add('active');
    tabBtnList.classList.remove('active');
    tabContentManage.classList.add('active');
    tabContentList.classList.remove('active');
  } else if (activeTab === 'list') {
    tabBtnManage.classList.remove('active');
    tabBtnList.classList.add('active');
    tabContentManage.classList.remove('active');
    tabContentList.classList.add('active');
  }
}

// --- Carregar Usuários --- 
async function loadUsers() {
  try {
    manageTableBody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    listTableBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
    
    const { data: users, error } = await supabase
      .from("credenciais")
      .select("id, usuario, senha, email, nivel, projeto");

    if (error) {
        if (error.code === '42703' && error.message.includes('projeto')) {
            throw new Error("Erro ao carregar usuários: A coluna 'projeto' não existe na tabela 'credenciais'. Por favor, adicione a coluna no Supabase.");
        } else {
            throw error;
        }
    }

    manageTableBody.innerHTML = "";
    listTableBody.innerHTML = "";
    
    users.forEach(user => {
      // --- Linha para Tabela de Gerenciamento ---
      const manageTr = document.createElement("tr");
      manageTr.dataset.userId = user.id;
      manageTr.innerHTML = `
        <td>${sanitizeInput(user.usuario)}</td>
        <td>
          <input 
            type="password" 
            id="pass-${user.id}" 
            value="********" // Sempre mostra máscara inicialmente
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

      // --- Linha para Tabela de Lista ---
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
    });

  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    manageTableBody.innerHTML = `<tr><td colspan='6' style='color: red;'>${error.message}</td></tr>`;
    listTableBody.innerHTML = `<tr><td colspan='5' style='color: red;'>${error.message}</td></tr>`;
  }
}

// --- Operações CRUD (Modificadas para incluir Projeto) ---
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

    const updateData = { email, nivel, projeto: projeto || null }; // Garante null se vazio
    // Só atualiza a senha se o campo não estiver com a máscara
    if (senha && senha !== '********') {
        updateData.senha = senha;
    }

    const { error } = await supabase
      .from("credenciais")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário atualizado com sucesso!");
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
    // Resetar campo senha para máscara após salvar
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
    const listRowToRemove = listTableBody.querySelector(`tr[data-user-id="${id}"]`);
    if (listRowToRemove) listRowToRemove.remove();
    
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
    loadUsers();
    
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    alert("Erro ao criar usuário: " + error.message);
  }
}

// --- Navegação para Dashboard do Usuário ---
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

// --- Navegação para Gerenciamento de Clientes (Admin) ---
function viewClientesDashboard() {
    sessionStorage.removeItem('viewing_user_id');
    sessionStorage.removeItem('viewing_username');
    window.location.href = `clientes-dashboard.html`;
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// --- Event Listeners --- 

tabBtnManage.addEventListener('click', () => switchTab('manage'));
tabBtnList.addEventListener('click', () => switchTab('list'));
adminClientesBtn.addEventListener('click', viewClientesDashboard);

manageTableBody.addEventListener("click", e => {
   const target = e.target;
   const id = target.dataset.id;

   if (target.classList.contains("toggle-password")) {
     const input = document.getElementById(`pass-${id}`);
     if (input) {
        input.type = input.type === "password" ? "text" : "password";
        target.textContent = input.type === "password" ? "👁️" : "🙈";
        // Define um timeout para voltar a ser password após 3 segundos
        if (input.type === "text") {
            setTimeout(() => {
                const currentInput = document.getElementById(`pass-${id}`);
                if (currentInput && currentInput.type === "text") { // Verifica se ainda é texto
                   currentInput.type = "password";
                   target.textContent = "👁️";
                }
            }, 3000);
        }
     }
   } else if (target.classList.contains("save-btn")) {
     if (id) saveUser(id);
   } else if (target.classList.contains("delete-btn")) {
     if (id) deleteUser(id);
   }
 });

 listTableBody.addEventListener("click", e => {
    const target = e.target;
    if (target.classList.contains("view-user-dashboard-btn")) {
        const userId = target.dataset.id;
        const username = target.dataset.username;
        const userProject = target.dataset.projeto;
        if (userId && username !== undefined) { // Verifica se username não é undefined
            viewUserDashboard(userId, username, userProject);
        }
    }
 });

createUserForm.addEventListener("submit", createUser);
btnLogout.addEventListener("click", logout);

// Inicialização
if (checkAccess()) {
  loadUsers();
  switchTab('manage'); // Inicia na aba de gerenciamento por padrão
}
