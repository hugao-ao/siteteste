import { supabase } from './supabase.js';

async function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  const { data, error } = await supabase
    .from("credenciais")
    .select("*")
    .eq("usuario", user)
    .eq("senha", pass)
    .maybeSingle();

  if (data && !error) {
    if (data.nivel === "admin") {
      sessionStorage.setItem("usuario", data.usuario);
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
  } else {
    alert("Login ou senha incorretos.");
  }
}

function logout() {
  location.reload();
}

window.login = login;
window.logout = logout;
