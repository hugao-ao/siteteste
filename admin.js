// admin.js
import { supabase } from "./supabase.js";

// Função para escapar caracteres especiais
const escapeHTML = (str) => {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Elementos DOM
const btnLogout = document.getElementById("logout-btn");
const tableBody = document.querySelector("#users-table tbody");
const btnCreate = document.getElementById("create-user-btn");

// Event Listeners
btnLogout.onclick = logout;
btnCreate.onclick = createUser;

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
if (checkAccess()) {
  loadUsers();
}

async function loadUsers() {
  tableBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
  const { data: users, error } = await supabase
    .from("credenciais")
    .select("id, usuario, senha, email, nivel");

  if (error) {
    alert("Erro ao carregar usuários: " + error.message);
    return;
  }

  tableBody.innerHTML = "";
  users.forEach((user) => {
    const tr = document.createElement("tr");

    // Usuário
    tr.innerHTML += `<td>${escapeHTML(user.usuario)}</td>`;

    // Senha
    tr.innerHTML += `
      <td>
        <input
          type="password"
          id="pass-${user.id}"
          value="${escapeHTML(user.senha)}"
        />
        <button
          type="button"
          class="toggle-password"
          data-id="${user.id}"
        >👁️</button>
      </td>`;

    // E-mail
    tr.innerHTML += `
      <td>
        <input
          type="email"
          id="email-${user.id}"
          value="${escapeHTML(user.email)}"
        />
      </td>`;

    // Nível
    tr.innerHTML += `
      <td>
        <select id="lvl-${user.id}">
          <option value="usuario" ${user.nivel === "usuario" ? "selected" : ""}>
            usuario
          </option>
          <option value="admin" ${user.nivel === "admin" ? "selected" : ""}>
            admin
          </option>
        </select>
      </td>`;

    // Ações
    let actions = `<button onclick="saveUser(${user.id})">Salvar</button>`;
    if (user.usuario !== sessionStorage.getItem("usuario")) {
      actions += ` <button onclick="deleteUser(${user.id})">Excluir</button>`;
    } else {
      actions += ` <span style="color:gray">[Admin]</span>`;
    }
    tr.innerHTML += `<td>${actions}</td>`;

    tableBody.appendChild(tr);
  });
}

// Toggle Password
document.body.addEventListener("click", (e) => {
  if (!e.target.matches(".toggle-password")) return;
  const id = e.target.dataset.id;
  const inp = document.getElementById(`pass-${id}`);
  inp.type = inp.type === "password" ? "text" : "password";
  e.target.textContent = inp.type === "password" ? "👁️" : "🙈";
});

// Funções CRUD
async function saveUser(id) {
  const senha = document.getElementById(`pass-${id}`).value;
  const email = document.getElementById(`email-${id}`).value;
  const nivel = document.getElementById(`lvl-${id}`).value;

  const { error } = await supabase
    .from("credenciais")
    .update({ senha, email, nivel })
    .eq("id", id);

  if (error) {
    alert("Erro ao salvar: " + error.message);
  } else {
    alert("Usuário atualizado!");
    loadUsers();
  }
}

async function deleteUser(id) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  const { error } = await supabase
    .from("credenciais")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Erro ao excluir: " + error.message);
  } else {
    alert("Usuário excluído!");
    loadUsers();
  }
}

async function createUser() {
  const usuario = document.getElementById("new-user").value.trim();
  const senha = document.getElementById("new-pass").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const nivel = document.getElementById("new-level").value;

  if (!usuario || !senha || !email) {
    alert("Preencha todos os campos.");
    return;
  }

  const { error } = await supabase
    .from("credenciais")
    .insert({ usuario, senha, email, nivel });

  if (error) {
    alert("Erro ao criar: " + error.message);
  } else {
    alert("Usuário criado!");
    document.getElementById("new-user").value = "";
    document.getElementById("new-pass").value = "";
    document.getElementById("new-email").value = "";
    loadUsers();
  }
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// Exportar para escopo global
window.saveUser = saveUser;
window.deleteUser = deleteUser;
window.createUser = createUser;
window.logout = logout;
