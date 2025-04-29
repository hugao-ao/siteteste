import { supabase } from "./supabase.js";

const loginForm = document.getElementById("login-form");
const otpForm   = document.getElementById("otp-form");

let _currentUser, _currentEmail, _currentOTP;

// 1) Usuário submeteu usuário+senha
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const usuario = document.getElementById("usuario").value;
  const senha   = document.getElementById("senha").value;

  // Verifica credenciais no Supabase
  const { data, error } = await supabase
    .from("credenciais")
    .select("usuario, email")
    .eq("usuario", usuario)
    .eq("senha", senha)
    .single();

  if (error || !data) {
    return alert("Usuário ou senha incorretos.");
  }

  // guardo usuário e e-mail p/ etapa 2
  _currentUser  = data.usuario;
  _currentEmail = data.email;

  // Gero OTP aleatório de 6 dígitos
  _currentOTP = Math.floor(100000 + Math.random() * 900000).toString();

  // Envia email via EmailJS
  try {
    await emailjs.send(
      "service_lk94gdg",    // seu Service ID
      "template_5i54ywq",   // seu Template ID
      {
        to_email: _currentEmail,
        passcode: _currentOTP,
        time: new Date(Date.now() + 15*60000).toLocaleTimeString()
      }
    );
    // oculto login e mostro OTP
    loginForm.style.display = "none";
    otpForm.style.display   = "block";
  } catch (err) {
    console.error(err);
    alert("Erro ao enviar o e-mail. Tente novamente.");
  }
});

// 2) Usuário submeteu o OTP
otpForm.addEventListener("submit", e => {
  e.preventDefault();
  const otpInput = document.getElementById("otp").value;
  if (otpInput !== _currentOTP) {
    return alert("Código inválido.");
  }
  // 3) Se OK, redireciona p/ admin-dashboard
  window.location.href = "admin-dashboard.html";
});
