// admin.js
import { supabase } from "./supabase.js";

const tbody = document.querySelector("#userTable tbody");

export async function loadUsers() {
  tbody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";
  const { data, error } = await supabase
    .from("credenciais")
    .select("id,usuario,senha,nivel,email");

  if (error) {
    return alert("Erro ao carregar usuários.");
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.usuario}</td>
      <td>
        <input type="password" id="pass-${row.id}" value="${row.senha}" readonly />
        <button onclick="toggleShow(${row.id})">👁️</button>
      </td>
      <td>
        <select id="lvl-${row.id}">
          <option ${row.nivel==="usuario"?"selected":""} value="usuario">usuario</option>
          <option ${row.nivel==="admin"  ?"selected":""} value="admin">admin</option>
        </select>
      </td>
      <td>
        <button onclick="saveUser(${row.id})">Salvar</button>
        ${row.usuario === sessionStorage.getItem("usuario")
          ? "[Admin]" 
          : `<button onclick="deleteUser(${row.id})">Excluir</button>`}
      </td>`;
    tbody.appendChild(tr);
  });
}

window.toggleShow = id => {
  const inp = document.getElementById(`pass-${id}`);
  inp.type = inp.type === "password" ? "text" : "password";
};

export async function saveUser(id) {
  const senha = document.getElementById(`pass-${id}`).value;
  const nivel = document.getElementById(`lvl-${id}`).value;
  const { error } = await supabase
    .from("credenciais")
    .update({ senha, nivel })
    .eq("id", id);
  if (error) return alert("Erro ao salvar.");
  alert("Dados atualizados.");
  loadUsers();
}

export async function deleteUser(id) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  const { error } = await supabase
    .from("credenciais")
    .delete()
    .eq("id", id);
  if (error) return alert("Erro ao excluir.");
  alert("Usuário excluído!");
  loadUsers();
}

export async function createUser() {
  const usuario = document.getElementById("newUser").value.trim();
  const senha   = document.getElementById("newPass").value.trim();
  const email   = document.getElementById("newEmail").value.trim();
  const nivel   = document.getElementById("newLevel").value;
  if (!usuario || !senha || !email) {
    return alert("Preencha todos os campos.");
  }

  const { error } = await supabase
    .from("credenciais")
    .insert([{ usuario, senha, email, nivel }]);
  if (error) return alert("Erro ao criar usuário.");
  alert("Usuário criado!");
  document.getElementById("newUser").value = "";
  document.getElementById("newPass").value = "";
  document.getElementById("newEmail").value = "";
  loadUsers();
}

export function logout() {
  sessionStorage.clear();
  window.location.href = "/";
}

// ao abrir a página carrega a lista
loadUsers();
