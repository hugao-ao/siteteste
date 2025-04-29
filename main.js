import { supabase } from './supabase.js';

// IDs do seu serviço e template no EmailJS
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'template_5i54ywq';

let _tempUser = null;
let _tempCode = null;

async function login() {
  // 1ª etapa: valida usuário+senha no Supabase
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  const { data, error } = await supabase
    .from("credenciais")
    .select("usuario, nivel, email")
    .eq("usuario", user)
    .eq("senha", pass)
    .maybeSingle();

  if (error || !data) {
    alert("Usuário ou senha incorretos.");
    return;
  }

  // guarda usuário e gera código aleatório
  _tempUser = data.usuario;
  _tempCode = Math.floor(100000 + Math.random()*900000).toString();

  // dispara envio por EmailJS
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: data.email,
    code: _tempCode
  }).then(() => {
    alert("Código enviado para " + data.email);
    document.getElementById("step1").style.display = "none";
    document.getElementById("step2").style.display = "block";
  }).catch(err => {
    console.error(err);
    alert("Erro ao enviar o e-mail. Tente novamente.");
  });
}

function verifyCode() {
  const code = document.getElementById("code").value.trim();
  if (code !== _tempCode) {
    alert("Código incorreto. Tente novamente.");
    return;
  }
  finalizeLogin(_tempUser);
}

function finalizeLogin(user) {
  // recupera nível e redireciona
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

// Expor funções ao escopo global
window.login = login;
window.verifyCode = verifyCode;
window.logout = logout;
