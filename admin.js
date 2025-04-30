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
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;")
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

// Abas
const tabBtnManage = document.getElementById("tab-btn-manage");
const tabBtnList = document.getElementById("tab-btn-list");
const tabContentManage = document.getElementById("tab-content-manage");
const tabContentList = document.getElementById("tab-content-list");

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
    // Limpa ambas as tabelas e mostra carregando
    manageTableBody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    listTableBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
    
    // Busca usuários incluindo o novo campo 'projeto'
    const { data: users, error } = await supabase
      .from("credenciais")
      .select("id, usuario, senha, email, nivel, projeto"); // Adicionado 'projeto'

    if (error) {
        // Verifica se o erro é coluna inexistente (para guiar o usuário)
        if (error.code === '42703' && error.message.includes('projeto')) {
            throw new Error("Erro ao carregar usuários: A coluna 'projeto' não existe na tabela 'credenciais'. Por favor, adicione a coluna no Supabase.");
        } else {
            throw error; // Lança outros erros
        }
    }

    // Limpa tabelas após sucesso da busca
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
          <select id="proj-${user.id}"> <!-- Select para Projeto -->
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
M          <span style="color:gray">[Admin]</span>`}
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
          <button class="view-user-dashboard-btn" data-id="${user.id}" data-username="${sanitizeInput(user.usuario)}">Ver Dashboard</button>
        </td>
      `;
      listTableBody.appendChild(listTr);
    });

  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    // Exibe o erro de forma mais clara na UI
    manageTableBody.innerHTML = `<tr><td colspan='6' style='color: red;'>${error.message}</td></tr>`;
    listTableBody.innerHTML = `<tr><td colspan='5' style='color: red;'>${error.message}</td></tr>`;
    // alert("Erro ao carregar usuários: " + error.message); // Evita alert bloqueante
  }
}

// --- Operações CRUD (Modificadas para incluir Projeto) ---
async function saveUser(id) {
  try {
    const senha = document.getElementById(`pass-${id}`).value;
    const email = document.getElementById(`email-${id}`).value;
    const nivel = document.getElementById(`lvl-${id}`).value;
    const projeto = document.getElementById(`proj-${id}`).value; // Pega valor do projeto

    if (!email) { // Senha pode ser vazia se não for alterada, mas email não
        alert("O campo E-mail não pode estar vazio.");
        return;
    }

    const updateData = { email, nivel, projeto };
    // Só atualiza a senha se o campo não estiver vazio (ou com placeholder)
    if (senha && senha !== '********') { // Ajuste conforme o placeholder se necessário
        updateData.senha = senha;
    }

    const { error } = await supabase
      .from("credenciais")
      .update(updateData) // Inclui 'projeto' no update
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário atualizado com sucesso!");
    // Atualiza a linha na tabela de lista também (opcional, mas bom para consistência)
    const listRow = listTableBody.querySelector(`tr[data-user-id="${id}"]`);
    if (listRow) {
        listRow.children[1].textContent = sanitizeInput(email);
        listRow.children[2].textContent = sanitizeInput(nivel);
        listRow.children[3].textContent = sanitizeInput(projeto) || 'Nenhum';
    }
    // loadUsers(); // Evita recarregar tudo
    
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
    // Remove a linha de ambas as tabelas
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
  event.preventDefault(); // Previne o envio padrão do formulário
  try {
    const usuario = newUserInput.value.trim();
    const senha = newPassInput.value.trim();
    const email = newEmailInput.value.trim();
    const nivel = newLevelSelect.value;
    const projeto = newProjectSelect.value; // Pega valor do projeto

    if (!usuario || !senha || !email) { // Projeto não é obrigatório inicialmente
      throw new Error("Preencha todos os campos obrigatórios: Usuário, Senha e E-mail.");
    }
    if (!projeto) {
        throw new Error("Selecione um Projeto para o novo usuário.");
    }

    const { data, error } = await supabase
      .from("credenciais")
      .insert({ usuario, senha, email, nivel, projeto }) // Inclui 'projeto' no insert
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
    createUserForm.reset(); // Limpa o formulário
    newProjectSelect.value = ""; // Garante que o placeholder volte
    loadUsers(); // Recarrega a lista
    
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    alert("Erro ao criar usuário: " + error.message);
  }
}

// --- Navegação para Dashboard do Usuário ---
function viewUserDashboard(userId, username) {
    // Armazena informações sobre quem está sendo visualizado
    // e quem está visualizando (o admin)
    sessionStorage.setItem('viewing_user_id', userId);
    sessionStorage.setItem('viewing_username', username);
    sessionStorage.setItem('admin_viewer_username', sessionStorage.getItem('usuario')); // Guarda o admin original
    
    // Redireciona para o dashboard do usuário
    window.location.href = `user-dashboard.html`; 
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// --- Event Listeners --- 

// Abas
tabBtnManage.addEventListener('click', () => switchTab('manage'));
tabBtnList.addEventListener('click', () => switchTab('list'));

// Delegação de eventos para Tabela de Gerenciamento
manageTableBody.addEventListener("click", e => {
   const target = e.target;
   const id = target.dataset.id;

   if (target.classList.contains("toggle-password")) {
     const input = document.getElementById(`pass-${id}`);
     if (input) {
        input.type = input.type === "password" ? "text" : "password";
        target.textContent = input.type === "password" ? "👁️" : "🙈";
     }
   } else if (target.classList.contains("save-btn")) {
     if (id) saveUser(id);
   } else if (target.classList.contains("delete-btn")) {
     if (id) deleteUser(id);
   }
 });

 // Delegação de eventos para Tabela de Lista (Ver Dashboard)
 listTableBody.addEventListener("click", e => {
    const target = e.target;
    if (target.classList.contains("view-user-dashboard-btn")) {
        const userId = target.dataset.id;
        const username = target.dataset.username;
        if (userId && username) {
            viewUserDashboard(userId, username);
        }
    }
 });

// Listener para o formulário Criar Usuário
createUserForm.addEventListener("submit", createUser);

// Listener para o botão Logout
btnLogout.addEventListener("click", logout);

// Inicialização
if (checkAccess()) {
  loadUsers();
  switchTab('manage'); // Inicia na aba de gerenciamento
}

