// main.js

// importe o cliente Supabase configurado em supabase.js
import { supabase } from "./supabase.js";

// IDs do EmailJS (preencha com os seus)
const EMAILJS_SERVICE_ID = "service_lk94gdg";
const EMAILJS_TEMPLATE_ID = "template_5i54ywq";
const EMAILJS_PUBLIC_KEY = "MfDhG_3505PQGJTfi";

// guardamos usuário e OTP temporariamente
let usuarioAtual = "";
let codigoGerado = "";

// referências aos formulários e campos
const loginForm = document.getElementById("login-form");
const usuarioInput = document.getElementById("usuario");
const senhaInput = document.getElementById("senha");

const otpForm = document.getElementById("otp-form");
const otpInput = document.getElementById("otp");

// STEP 1: submissão do login + senha
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const usuario = usuarioInput.value.trim();
  const senha = senhaInput.value;

  // busca credenciais no Supabase
  const { data, error } = await supabase
    .from("credenciais")
    .select("senha, email")
    .eq("usuario", usuario)
    .single();

  if (error || !data || data.senha !== senha) {
    alert("Login ou senha incorretos.");
    return;
  }

  // salva usuário para o próximo passo
  usuarioAtual = usuario;

  // gera um OTP numérico de 6 dígitos
  codigoGerado = Math.floor(100000 + Math.random() * 900000).toString();

  // calcula horário de expiração (15 minutos)
  const expira = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString();

  // envia o OTP por email usando EmailJS
  emailjs
    .send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        email: data.email,
        passcode: codigoGerado,
        time: expira,
      },
      EMAILJS_PUBLIC_KEY
    )
    .then(() => {
      // esconde o form de login e mostra o de OTP
      loginForm.style.display = "none";
      otpForm.style.display = "block";
    })
    .catch(() => {
      alert("Erro ao enviar o e-mail. Tente novamente.");
    });
});

// STEP 2: submissão do OTP
otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tokenDigitado = otpInput.value.trim();

  if (tokenDigitado !== codigoGerado) {
    alert("Código inválido.");
    return;
  }

  // OTP válido: buscamos o campo `nivel` do usuário
  const { data, error } = await supabase
    .from("credenciais")
    .select("nivel")
    .eq("usuario", usuarioAtual)
    .single();

  if (error || !data) {
    alert("Não foi possível determinar o nível de acesso.");
    return;
  }

  // redireciona conforme nível
  if (data.nivel === "admin") {
    window.location.href = "admin-dashboard.html";
  } else {
    window.location.href = "user-dashboard.html";
  }
});
