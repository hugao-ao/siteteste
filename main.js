import { supabase } from './supabase.js';

let _tempUser = null;
let _tempPass = null;
let _tempCode = null;

async function login() {
  // 1ª etapa: usuário + senha
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  const { data, error } = await supabase
    .from("credenciais")
    .select("*")
    .eq("usuario", user)
    .eq("senha", pass)
    .maybeSingle();

  if (error || !data) {
    alert("Usuário ou senha incorretos.");
    return;
  }

  // Guarda temporariamente e gera o código 2FA
  _tempUser = data.usuario;
  _tempPass = pass;
  _tempCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Para teste, exibimos o código (substitua isso por envio real)
  alert("Seu código de confirmação é: " + _tempCode);

  // Passa para a 2ª etapa
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "block";
}

function verifyCode() {
  // 2ª etapa: valida o código digitado
  const code = document.getElementById("code").value.trim();
  if (code !== _tempCode) {
    alert("Código incorreto. Tente novamente.");
    return;
  }

  // Se o código estiver correto, finaliza o login
  finalizeLogin(_tempUser);
}

function finalizeLogin(user) {
  // Busca o nível do usuário
  supabase
    .from("credenciais")
    .select("nivel")
    .eq("usuario", user)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error || !data) {
        alert("Erro ao recuperar nível de acesso.");
        window.location.href = "/";
        return;
      }

      // Salva no sessionStorage e redireciona conforme o nível
      sessionStorage.setItem("usuario", user);
      if (data.nivel === "admin") {
        window.location.href = "/admin-dashboard.html";
      } else {
        document.body.innerHTML = `
          <div class="app-container">
            <div class="sidebar">
              <button onclick="logout()">Logout</button>
            </div>
            <div class="main">
              <h2>Você conseguiu fazer login!</h2>
            </div>
          </div>
          <style>
            .app-container { display: flex; height: 100vh; }
            .sidebar { width: 200px; background: #222; color: white; padding: 20px; }
            .main { flex: 1; padding: 40px; }
          </style>
        `;
      }
    });
}

function logout() {
  sessionStorage.clear();
  window.location.href = "/";
}

window.login = login;
window.verifyCode = verifyCode;
window.logout = logout;
