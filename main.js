// main.js
import { supabase } from "./supabase.js";


// Configurações do EmailJS
const EMAILJS_SERVICE_ID  = "service_lk94gdg";
const EMAILJS_TEMPLATE_ID = "template_5i54ywq";
const EMAILJS_PUBLIC_KEY  = "MfDhG_3505PQGJTfi";

// Inicializa EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

// Variáveis de controle
let usuarioAtual = "";
let codigoGerado = "";

// Referências aos elementos do DOM
const loginForm = document.getElementById("login-form");
const usuarioInput = document.getElementById("usuario");
const senhaInput = document.getElementById("senha");

const otpForm = document.getElementById("otp-form");
const otpInput = document.getElementById("otp");

// PASSO 1: Autenticação usuário+senha e envio do OTP
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const usuario = usuarioInput.value.trim();
  const senha    = senhaInput.value;

  // Buscando credenciais no Supabase
  const { data, error } = await supabase
    .from("credenciais")
    .select("senha, email")
    .eq("usuario", usuario)
    .single();

  if (error || !data || data.senha !== senha) {
    alert("Login ou senha incorretos.");
    return;
  }

  usuarioAtual = usuario;
  // Gera OTP de 6 dígitos
  codigoGerado = Math.floor(100000 + Math.random() * 900000).toString();
  // Expira em 15 minutos
  const expira = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString();

  // Envia OTP por email (campo no template: {{to_email}})
  emailjs
    .send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: data.email,      // variável do template
        passcode: codigoGerado,
        time: expira,
      }
    )
    .then(() => {
      loginForm.style.display = "none";
      otpForm.style.display   = "block";
    })
    .catch(() => {
      alert("Erro ao enviar o e-mail. Tente novamente.");
    });
});

// PASSO 2: Validação do OTP
otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tokenDigitado = otpInput.value.trim();

  if (tokenDigitado !== codigoGerado) {
    alert("Código inválido.");
    return;
  }

  // Busca nível de acesso
  const { data, error } = await supabase
    .from("credenciais")
    .select("nivel")
    .eq("usuario", usuarioAtual)
    .single();

  if (error || !data) {
    alert("Não foi possível determinar o nível de acesso.");
    return;
  }

// ─────────── GRAVAÇÃO NO SESSIONSTORAGE ───────────
// 1) Armazena no sessionStorage para o checkAccess() funcionar
sessionStorage.setItem("usuario", usuarioAtual);
sessionStorage.setItem("nivel", data.nivel);
// ───────────────────────────────────────────────────

  // Redireciona conforme nível
  if (data.nivel === "admin") {
    window.location.href = "admin-dashboard.html";
  } else {
    window.location.href = "user-dashboard.html";
  }
});
