// main.js
import { supabase } from "./supabase.js";

// Configurações do EmailJS (Mantenha as suas)
const EMAILJS_SERVICE_ID  = "service_lk94gdg";
const EMAILJS_TEMPLATE_ID = "template_5i54ywq";
const EMAILJS_PUBLIC_KEY  = "MfDhG_3505PQGJTfi";

// Inicializa EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

// Variáveis de controle
let usuarioAtual = "";
let codigoGerado = "";
let emailUsuario = ""; // Guardar o email para o OTP

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

  try {
    // Buscando credenciais no Supabase
    const { data, error } = await supabase
      .from("credenciais")
      .select("id, senha, email, nivel, projeto") // Busca todos os campos necessários
      .eq("usuario", usuario)
      .single();

    if (error) {
        console.error("Erro ao buscar usuário:", error);
        // Verifica se o erro é por não encontrar o usuário
        if (error.code === 'PGRST116') {
             alert("Login ou senha incorretos.");
        } else {
             alert("Erro ao verificar credenciais. Tente novamente.");
        }
        return;
    }
    
    if (!data || data.senha !== senha) {
      alert("Login ou senha incorretos.");
      return;
    }

    // Guarda dados temporariamente
    usuarioAtual = usuario;
    emailUsuario = data.email; // Guarda o email para enviar OTP

    // Gera OTP de 6 dígitos
    codigoGerado = Math.floor(100000 + Math.random() * 900000).toString();
    // Expira em 15 minutos
    const expira = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString();

    // Envia OTP por email
    await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: emailUsuario,
          passcode: codigoGerado,
          time: expira,
        }
      );
      
    // Mostra formulário OTP
    loginForm.style.display = "none";
    otpForm.style.display   = "block";

  } catch (sendError) {
      console.error("Erro ao enviar e-mail OTP:", sendError);
      alert("Erro ao enviar o código de verificação por e-mail. Verifique o console ou tente novamente.");
  }
});

// PASSO 2: Validação do OTP e Redirecionamento
otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tokenDigitado = otpInput.value.trim();

  if (tokenDigitado !== codigoGerado) {
    alert("Código inválido.");
    return;
  }

  try {
    // Busca dados completos do usuário novamente para garantir consistência
    const { data: userData, error: userError } = await supabase
      .from("credenciais")
      .select("id, nivel, projeto") // Busca id, nivel e projeto
      .eq("usuario", usuarioAtual)
      .single();

    if (userError || !userData) {
      console.error("Erro ao buscar dados do usuário após OTP:", userError);
      alert("Erro ao obter informações do usuário. Tente fazer login novamente.");
      return;
    }

    // --- GRAVAÇÃO NO SESSIONSTORAGE ---
    sessionStorage.setItem("usuario", usuarioAtual);
    sessionStorage.setItem("user_id", userData.id); // Guarda o ID do usuário
    sessionStorage.setItem("id", userData.id); // CORREÇÃO: Adiciona o ID com a chave 'id' para compatibilidade
    sessionStorage.setItem("nivel", userData.nivel);
    sessionStorage.setItem("projeto", userData.projeto || ''); // Guarda o projeto (ou vazio)
    // ───────────────────────────────────

    // --- Redirecionamento com base no Nível e Projeto ---
    if (userData.nivel === "admin") {
      window.location.href = "admin-dashboard.html";
    } else if (userData.nivel === "usuario" && userData.projeto === "Planejamento") {
      // Redireciona usuários do projeto Planejamento para o novo dashboard
      window.location.href = "planejamento-dashboard.html"; // << NOVO DASHBOARD
    } else {
      // Outros usuários vão para o dashboard padrão
      window.location.href = "user-dashboard.html";
    }

  } catch (finalError) {
      console.error("Erro na etapa final do login:", finalError);
      alert("Ocorreu um erro inesperado durante o login. Tente novamente.");
  }
});
