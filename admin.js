// ——— Proteção extra: impede execução se não for admin ———
if (sessionStorage.getItem("nivel") !== "admin") {
  throw new Error("Acesso não autorizado: apenas administradores podem rodar este script.");
}
// ————————————————————————————————————————————————————————


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
          <button onclick="saveUser(${user.id})">Salvar</button>
          ${user.usuario !== sessionStorage.getItem("usuario") 
            ? `<button onclick="deleteUser(${user.id})">Excluir</button>` 
            : '<span style="color:gray">[Admin]</span>'}
        </td>
      `;
      
      tableBody.appendChild(tr);
    });

  } catch (error) {
    alert("Erro ao carregar usuários: " + error.message);
  }
}

// Event listeners
document.body.addEventListener("click", e => {
  if (e.target.classList.contains("toggle-password")) {
    const id = e.target.dataset.id;
    const input = document.getElementById(`pass-${id}`);
    input.type = input.type === "password" ? "text" : "password";
    e.target.textContent = input.type === "password" ? "👁️" : "🙈";
  }
});

// Operações CRUD
async function saveUser(id) {
  try {
    const senha = document.getElementById(`pass-${id}`).value;
    const email = document.getElementById(`email-${id}`).value;
    const nivel = document.getElementById(`lvl-${id}`).value;

    const { error } = await supabase
      .from("credenciais")
      .update({ senha, email, nivel })
      .eq("id", id);

    if (error) throw error;
    
    alert("Usuário atualizado com sucesso!");
    loadUsers();
    
  } catch (error) {
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
    loadUsers();
    
  } catch (error) {
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
      throw new Error("Preencha todos os campos obrigatórios");
    }

    const { error } = await supabase
      .from("credenciais")
      .insert({ usuario, senha, email, nivel });

    if (error) throw error;
    
    alert("Usuário criado com sucesso!");
    document.getElementById("new-user").value = "";
    document.getElementById("new-pass").value = "";
    document.getElementById("new-email").value = "";
    loadUsers();
    
  } catch (error) {
    alert("Erro ao criar usuário: " + error.message);
  }
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// Inicialização
if (checkAccess()) {
  loadUsers();
}

// Expor funções globais
window.saveUser = saveUser;
window.deleteUser = deleteUser;
window.createUser = createUser;
window.logout = logout;
