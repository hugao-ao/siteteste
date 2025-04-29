// main.js
import { supabase } from "./supabase.js";

// ——————
// CONFIGURAÇÕES EmailJS
const EMAILJS_SERVICE   = "service_lk94gdg";    // <=== seu Service ID
const EMAILJS_TEMPLATE  = "template_5i54ywq";   // <=== seu Template ID
const EMAILJS_PUBLICKEY = "MfDhG_3505PQGJTfi";  // <=== sua Public Key
// ——————

let _tempUser  = null;
let _tempPass  = null;
let _tempCode  = null;

export async function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  const { data, error } = await supabase
    .from("credenciais")
    .select("usuario,senha,email")
    .eq("usuario", user)
    .eq("senha", pass)
    .maybeSingle();

  if (error || !data) {
    return alert("Usuário ou senha incorretos.");
  }

  _tempUser = data.usuario;
  _tempPass = data.senha;
  _tempCode = String(Math.floor(100000 + Math.random() * 900000)); // gera 6 dígitos

  // envia OTP por EmailJS
  try {
    const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id:    EMAILJS_PUBLICKEY,
        template_params: {
          email:    data.email,
          passcode: _tempCode,
          time:     new Date(Date.now() + 15*60000).toLocaleTimeString()
        }
      })
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
  } catch (e) {
    console.error(e);
    return alert("Erro ao enviar o e-mail. Tente novamente.");
  }

  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "block";
}

export function verifyCode() {
  const code = document.getElementById("code").value.trim();
  if (code !== _tempCode) {
    return alert("Código incorreto. Tente novamente.");
  }
  finalizeLogin(_tempUser);
}

async function finalizeLogin(user) {
  const { data, error } = await supabase
    .from("credenciais")
    .select("nivel")
    .eq("usuario", user)
    .maybeSingle();

  if (error || !data) {
    alert("Erro ao recuperar nível de acesso.");
    return window.location.href = "/";
  }

  sessionStorage.setItem("usuario", user);
  sessionStorage.setItem("nivel", data.nivel);

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
    `;
  }
}

export function logout() {
  sessionStorage.clear();
  window.location.href = "/";
}

window.login      = login;
window.verifyCode = verifyCode;
window.logout     = logout;
