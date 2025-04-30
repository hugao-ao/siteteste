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
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/`/g, "&#x60;");
};

// Elementos DOM
const btnLogout = document.getElementById("logout-btn");
const tableBody = document.querySelector("#users-table tbody");
const btnCreate = document.getElementById("create-user-btn");

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

// Carregar usuários
async function loadUsers() {
  try {
    tableBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
    
    const { data: users, error } = await supabase
      .from("credenciais")
      .select("id, usuario, senha, email, nivel");

    if (error) throw error;

    tableBody.innerHTML = "";
    
    users.forEach(user => {
      const tr = document.createElement("tr");
      tr.dataset.userId = user.id; // Adiciona ID ao TR para referência
      
      // Conteúdo das células
      tr.innerHTML = `
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
          <button class="save-btn" data-id="${user.id}">Salvar</button>
          ${user.usuario !== sessionStorage.getItem("usuario") 
            ? `<button class="delete-btn" data-id="${user.id}">Excluir</button>` 
            : '<span style="color:gray">[Admin]</span>'}
        </td>
      `;
      
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Erro ao carregar usuários:", error); // Log detalhado no console
    alert("Erro ao carregar usuários: " + error.message);
  }
}

// Operações CRUD
async function saveUser(id) {
  try {
    const senha = document.getElementById(`pass-${id}`).value;
    const email = document.getElementById(`email-${id}`).value;
    const nivel = document.getElementById(`lvl-${id}`).value;

    // Validação básica (pode ser expandida)
    if (!email || !senha) {
        alert("Email e Senha não podem estar vazios.");
        return;
    }

    const { error } = await supabase
      .from("credenciais")
      .update({ senha, email, nivel })
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário atualizado com sucesso!");
    // Não precisa recarregar tudo, pode atualizar a UI localmente se preferir
    // loadUsers(); 
    
  } catch (error) {
    console.error("Erro ao salvar usuário:", error); // Log detalhado
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
    // Remove a linha da tabela em vez de recarregar tudo
    const rowToRemove = tableBody.querySelector(`tr[data-user-id="${id}"]`);
    if (rowToRemove) {
        rowToRemove.remove();
    }
    // loadUsers(); // Evita recarregar a lista inteira
    
  } catch (error) {
    console.error("Erro ao excluir usuário:", error); // Log detalhado
    alert("Erro ao excluir: " + error.message);
  }
}

async function createUser() {
  try {
    const usuario = document.getElementById("new-user").value.trim();
    const senha = document.getElementById("new-pass").value.trim();
    const email = document.getElementById("new-email").value.trim();
    const nivel = document.getElementById("new-level").value;

    if (!usuario || !senha || !email) {
      throw new Error("Preencha todos os campos obrigatórios: Usuário, Senha e E-mail.");
    }

    const { data, error } = await supabase
      .from("credenciais")
      .insert({ usuario, senha, email, nivel })
      .select(); // Adicionado select() para obter o usuário criado, se necessário

    if (error) {
        // Verifica erro específico de violação de unicidade (usuário já existe)
        if (error.code === '23505') { 
            throw new Error(`Erro: O nome de usuário "${usuario}" já existe.`);
        } else {
            throw error; // Lança outros erros
        }
    }
    
    alert("Usuário criado com sucesso!");
    document.getElementById("new-user").value = "";
    document.getElementById("new-pass").value = "";
    document.getElementById("new-email").value = "";
    loadUsers(); // Recarrega a lista para incluir o novo usuário
    
  } catch (error) {
    console.error("Erro ao criar usuário:", error); // Log detalhado
    alert("Erro ao criar usuário: " + error.message);
  }
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// --- Event Listeners --- 

// Delegação de eventos para botões na tabela (Salvar, Excluir, Mostrar Senha)
 tableBody.addEventListener("click", e => {
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

// Listener para o botão Criar Usuário
if (btnCreate) {
    btnCreate.addEventListener("click", createUser);
}

// Listener para o botão Logout
if (btnLogout) {
    btnLogout.addEventListener("click", logout);
}

// Inicialização
if (checkAccess()) {
  loadUsers();
}

// Não é mais necessário expor funções globalmente
// window.saveUser = saveUser;
// window.deleteUser = deleteUser;
// window.createUser = createUser;
// window.logout = logout;
