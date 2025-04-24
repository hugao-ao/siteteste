import { supabase } from './supabase.js';

let currentUser = null;

async function loadUsers() {
  const sessionUser = sessionStorage.getItem("usuario");
  currentUser = sessionUser;

  const { data, error } = await supabase.from("credenciais").select("*");
  const tbody = document.querySelector("#userTable tbody");
  tbody.innerHTML = "";

  if (data && !error) {
    data.forEach(user => {
      const tr = document.createElement("tr");
      const blockDelete = user.usuario === currentUser;
      tr.innerHTML = `
        <td contenteditable="true" data-id="${user.id}" data-field="usuario">${user.usuario}</td>
        <td contenteditable="true" data-id="${user.id}" data-field="senha">••••••••</td>
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

async function saveUser(id) {
  const username = document.querySelector(`td[data-id='${id}'][data-field='usuario']`).innerText;
  const senha = document.querySelector(`td[data-id='${id}'][data-field='senha']`).innerText;

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
    loadUsers();
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

loadUsers();
