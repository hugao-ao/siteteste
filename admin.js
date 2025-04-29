import { supabase } from './supabase.js';

let currentUser = null;

async function checkAccess() {
  const sessionUser = sessionStorage.getItem("usuario");

  if (!sessionUser) {
    alert("Acesso não autorizado. Faça login primeiro.");
    window.location.href = "/";
    return;
  }

  const { data, error } = await supabase
    .from("credenciais")
    .select("usuario, nivel")
    .eq("usuario", sessionUser)
    .maybeSingle();

  if (!data || error || data.nivel !== "admin") {
    alert("Acesso restrito apenas para administradores.");
    window.location.href = "/";
    return;
  }

  currentUser = data.usuario;
  loadUsers();
}

async function loadUsers() {
  const { data, error } = await supabase.from("credenciais").select("*");
  const tbody = document.querySelector("#userTable tbody");
  tbody.innerHTML = "";

  if (data && !error) {
    data.forEach(user => {
      const tr = document.createElement("tr");
      const blockDelete = user.usuario === currentUser;
      tr.innerHTML = `
        <td contenteditable="true" data-id="${user.id}" data-field="usuario">${user.usuario}</td>
        <td data-id="${user.id}" data-field="senha" data-real="${user.senha}">•••••••• <button onclick="toggleSenha(this)">👁️</button></td>
        <td>${user.nivel}</td>
        <td>
          <button onclick="saveUser('${user.id}')">Salvar</button>
          ${blockDelete ? '<span style="color: gray">[Admin]</span>' : `<button onclick="deleteUser('${user.id}')">Excluir</button>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function toggleSenha(button) {
  const td = button.parentElement;
  const senha = td.getAttribute("data-real");
  if (td.innerText.includes("••••")) {
    td.innerHTML = `${senha} <button onclick="toggleSenha(this)">🙈</button>`;
  } else {
    td.innerHTML = `•••••••• <button onclick="toggleSenha(this)">👁️</button>`;
  }
  td.setAttribute("data-real", senha);
  td.setAttribute("contenteditable", "true");
  td.setAttribute("data-field", "senha");
}

async function saveUser(id) {
  const username = document.querySelector(`td[data-id='${id}'][data-field='usuario']`).innerText;
  const senhaField = document.querySelector(`td[data-id='${id}'][data-field='senha']`);
  const senha = senhaField.innerText.includes("•••")
    ? senhaField.getAttribute("data-real")
    : senhaField.innerText.replace("🙈", "").trim();

  const updates = {};
  if (username) updates.usuario = username;
  if (senha && senha !== "••••••••") updates.senha = senha;

  await supabase.from("credenciais").update(updates).eq("id", id);
  alert("Usuário atualizado!");
  loadUsers();
}

async function deleteUser(id) {
  const row = document.querySelector(`td[data-id='${id}']`);
  if (row && row.innerText === currentUser) {
    alert("Você não pode excluir a si mesmo.");
    return;
  }

  if (confirm("Tem certeza que deseja excluir este usuário?")) {
    await supabase.from("credenciais").delete().eq("id", id);
    alert("Usuário excluído!");

    // Recarrega imediatamente depois da exclusão
    requestAnimationFrame(() => loadUsers());
  }
}



async function createUser() {
  const user = document.getElementById("newUser").value;
  const pass = document.getElementById("newPass").value;
  if (user && pass) {
    await supabase.from("credenciais").insert([{ usuario: user, senha: pass, nivel: "usuario" }]);
    alert("Usuário criado!");
    loadUsers();
  } else {
    alert("Preencha todos os campos.");
  }
}

function logout() {
  sessionStorage.removeItem("usuario");
  window.location.href = "/";
}

window.logout = logout;
window.createUser = createUser;
window.deleteUser = deleteUser;
window.saveUser = saveUser;
window.toggleSenha = toggleSenha;

checkAccess();
