import { supabase } from './supabase.js';

async function login() {
  const userInput = document.getElementById("username").value;
  const passInput = document.getElementById("password").value;

  const { data, error } = await supabase
  .from("credenciais")
  .select("*")
  .eq("usuario", userInput)
  .eq("senha", passInput)
  .maybeSingle();


  if (data && !error) {
    document.body.innerHTML = `
      <div class="app-container">
        <div class="sidebar">
          <button onclick="showConfig()">Configurações de login</button>
          <button onclick="logout()">Logout</button>
        </div>
        <div class="main">
          <h2>Você conseguiu fazer login!</h2>
        </div>
      </div>
      <div id="modal" class="modal hidden">
        <div class="modal-content">
          <h3>Alterar Login</h3>
          <input type="text" id="newUser" placeholder="Novo usuário">
          <input type="password" id="newPass" placeholder="Nova senha">
          <button onclick="updateCredentials()">Salvar</button>
          <button onclick="closeModal()">Cancelar</button>
        </div>
      </div>
    `;
  } else {
    alert("Login ou senha incorretos.");
  }
}

function logout() {
  location.reload();
}

function showConfig() {
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function updateCredentials() {
  const newUser = document.getElementById("newUser").value;
  const newPass = document.getElementById("newPass").value;

  if (newUser && newPass) {
    const { data, error } = await supabase
      .from("credenciais")
      .update({ usuario: newUser, senha: newPass })
      .select("*").order("created_at", { ascending: false }).limit(1);

    if (!error) {
      alert("Credenciais atualizadas com sucesso!");
      closeModal();
    } else {
      alert("Erro ao atualizar credenciais.");
    }
  } else {
    alert("Preencha todos os campos.");
  }
}

// Expõe login no escopo global
window.login = login;
window.logout = logout;
window.showConfig = showConfig;
window.closeModal = closeModal;
window.updateCredentials = updateCredentials;
