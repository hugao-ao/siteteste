let credentials = { username: "admin", password: "admin123" };

function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if (user === credentials.username && pass === credentials.password) {
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
      <style>
        .app-container { display: flex; height: 100vh; }
        .sidebar { width: 200px; background: #222; color: white; padding: 20px; }
        .main { flex: 1; padding: 40px; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                 background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; }
        .modal-content { background: white; padding: 30px; border-radius: 10px; }
        .hidden { display: none; }
      </style>
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

function updateCredentials() {
  const newUser = document.getElementById("newUser").value;
  const newPass = document.getElementById("newPass").value;
  if (newUser && newPass) {
    credentials.username = newUser;
    credentials.password = newPass;
    alert("Credenciais atualizadas com sucesso!");
    closeModal();
  } else {
    alert("Preencha todos os campos.");
  }
}
