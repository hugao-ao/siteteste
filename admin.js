import { supabase } from "./supabase.js";

// referenciar exatamente esses IDs:
const tableBody  = document.querySelector("#users-table tbody");
const btnLogout  = document.getElementById("btn-logout");
const btnCreate  = document.getElementById("btn-create");

// vincula funções aos botões
btnLogout.onclick = logout;
btnCreate.onclick = createUser;

// 1) valida sessão de admin (colocada em sessionStorage lá no login)
function checkAccess() {
  const user  = sessionStorage.getItem("usuario");
  const nivel = sessionStorage.getItem("nivel");
  if (!user || nivel !== "admin") {
    alert("Acesso não autorizado. Faça login como admin.");
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// só carrega se o checkAccess tiver passado
if (checkAccess()) {
  loadUsers();
}

async function loadUsers() {
  tableBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
  const { data: users, error } = await supabase
    .from("credenciais")
    .select("id, usuario, senha, email, nivel");

  if (error) {
    return alert("Erro ao carregar usuários: " + error.message);
  }

  tableBody.innerHTML = "";
  users.forEach(user => {
    const tr = document.createElement("tr");

    // Usuário
    tr.innerHTML += `<td>${user.usuario}</td>`;

    // Senha com campo editável + toggle
    tr.innerHTML += `
      <td>
        <input 
          type="password" 
          id="pass-${user.id}" 
          value="${user.senha.replace(/"/g,'&quot;')}" 
        />
        <button onclick="toggleShow(${user.id})">👁️</button>
      </td>`;

    // E-mail editável
    tr.innerHTML += `
      <td>
        <input 
          type="email" 
          id="email-${user.id}" 
          value="${user.email.replace(/"/g,'&quot;')}" 
        />
      </td>`;

    // Nível select
    tr.innerHTML += `
      <td>
        <select id="lvl-${user.id}">
          <option value="usuario" ${user.nivel==="usuario"?"selected":""}>usuario</option>
          <option value="admin"   ${user.nivel==="admin"  ?"selected":""}>admin</option>
        </select>
      </td>`;

    // Ações: Salvar sempre, Excluir só se não for o próprio admin
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

// toggle de visibilidade da senha
window.toggleShow = id => {
  const inp = document.getElementById(`pass-${id}`);
  inp.type = inp.type === "password" ? "text" : "password";
};

export async function saveUser(id) {
  const senha = document.getElementById(`pass-${id}`).value;
  const email = document.getElementById(`email-${id}`).value;
  const nivel = document.getElementById(`lvl-${id}`).value;

  const { error } = await supabase
    .from("credenciais")
    .update({ senha, email, nivel })
    .eq("id", id);

  if (error) return alert("Erro ao salvar: " + error.message);
  alert("Usuário atualizado!");
  loadUsers();
}

export async function deleteUser(id) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  const { error } = await supabase
    .from("credenciais")
    .delete()
    .eq("id", id);

  if (error) return alert("Erro ao excluir: " + error.message);
  alert("Usuário excluído!");
  loadUsers();
}

export async function createUser() {
  const usuario = document.getElementById("new-username").value.trim();
  const senha   = document.getElementById("new-password").value.trim();
  const email   = document.getElementById("new-email").value.trim();
  const nivel   = document.getElementById("new-level").value;

  if (!usuario || !senha || !email) {
    return alert("Preencha todos os campos.");
  }

  const { error } = await supabase
    .from("credenciais")
    .insert({ usuario, senha, email, nivel });

  if (error) return alert("Erro ao criar: " + error.message);
  alert("Usuário criado!");
  // limpa campos e recarrega
  document.getElementById("new-username").value = "";
  document.getElementById("new-password").value = "";
  document.getElementById("new-email").value    = "";
  loadUsers();
}

export function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}
