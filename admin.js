// admin.js
import { supabase } from "./supabase.js";

const tableBody = document.querySelector("#users-table tbody");
const btnLogout = document.getElementById("btn-logout");
const btnCreate = document.getElementById("btn-create");

btnLogout.onclick = logout;
btnCreate.onclick = createUser;

checkAdminAndLoad();

async function checkAdminAndLoad() {
  // Garante que só admin veja essa página
  const { data: session } = await supabase.auth.getSession();
  if (!session.session || session.session.user.role !== "admin") {
    // redireciona para login
    window.location.href = "index.html";
    return;
  }
  loadUsers();
}

async function loadUsers() {
  // limpa tabela
  tableBody.innerHTML = "";
  const { data: users, error } = await supabase
    .from("credenciais")
    .select("id, usuario, senha, email, nivel");
  if (error) return alert("Erro ao carregar usuários: " + error.message);

  users.forEach(user => {
    const tr = document.createElement("tr");

    // Usuário
    const tdUser = document.createElement("td");
    tdUser.textContent = user.usuario;
    tr.appendChild(tdUser);

    // Senha
    const tdPass = document.createElement("td");
    const inputPass = document.createElement("input");
    inputPass.type = "password";
    inputPass.value = user.senha;
    inputPass.id = `pass-${user.id}`;
    tdPass.appendChild(inputPass);
    tr.appendChild(tdPass);

    // E-mail
    const tdEmail = document.createElement("td");
    const inputEmail = document.createElement("input");
    inputEmail.type = "email";
    inputEmail.value = user.email;
    inputEmail.id = `email-${user.id}`;
    tdEmail.appendChild(inputEmail);
    tr.appendChild(tdEmail);

    // Nível
    const tdLevel = document.createElement("td");
    const select = document.createElement("select");
    select.id = `level-${user.id}`;
    ["usuario", "admin"].forEach(level => {
      const opt = document.createElement("option");
      opt.value = level;
      opt.textContent = level;
      if (user.nivel === level) opt.selected = true;
      select.appendChild(opt);
    });
    tdLevel.appendChild(select);
    tr.appendChild(tdLevel);

    // Ações
    const tdActions = document.createElement("td");
    // Salvar
    const btnSave = document.createElement("button");
    btnSave.textContent = "Salvar";
    btnSave.onclick = () => saveUser(user.id);
    tdActions.appendChild(btnSave);

    // Excluir (não aparece para o próprio admin)
    if (user.nivel !== "admin") {
      const btnDelete = document.createElement("button");
      btnDelete.textContent = "Excluir";
      btnDelete.onclick = () => deleteUser(user.id);
      tdActions.appendChild(btnDelete);
    } else {
      const span = document.createElement("span");
      span.textContent = "[Admin]";
      tdActions.appendChild(span);
    }

    tr.appendChild(tdActions);
    tableBody.appendChild(tr);
  });
}

async function saveUser(id) {
  const senha = document.getElementById(`pass-${id}`).value;
  const email = document.getElementById(`email-${id}`).value;
  const nivel = document.getElementById(`level-${id}`).value;

  const { error } = await supabase
    .from("credenciais")
    .update({ senha, email, nivel })
    .eq("id", id);

  if (error) return alert("Erro ao salvar: " + error.message);
  alert("Usuário atualizado!");
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
  const { error } = await supabase
    .from("credenciais")
    .delete()
    .eq("id", id);
  if (error) return alert("Erro ao excluir: " + error.message);
  alert("Usuário excluído!");
  loadUsers();
}

async function createUser() {
  const usuario = document.getElementById("new-username").value;
  const senha = document.getElementById("new-password").value;
  const email = document.getElementById("new-email").value;
  const nivel = document.getElementById("new-level").value;

  if (!usuario || !senha || !email) {
    return alert("Preencha todos os campos.");
  }

  const { error } = await supabase
    .from("credenciais")
    .insert({ usuario, senha, email, nivel });

  if (error) return alert("Erro ao criar: " + error.message);
  alert("Usuário criado!");
  // limpa formulário
  document.getElementById("new-username").value = "";
  document.getElementById("new-password").value = "";
  document.getElementById("new-email").value = "";
  loadUsers();
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}
