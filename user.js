// user.js
import { supabase } from "./supabase.js";

// Seleciona elementos
const btnLogout       = document.getElementById("logout-btn");
const usernameDisplay = document.getElementById("username-display");

// Lógica de acesso
function checkAccess() {
  const user  = sessionStorage.getItem("usuario");
  const nivel = sessionStorage.getItem("nivel");
  if (!user || !nivel) {
    alert("Acesso não autorizado. Faça login primeiro.");
    window.location.href = "index.html";
    return false;
  }
  // Exibe o nome no cabeçalho
  usernameDisplay.textContent = user;
  return true;
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// bind e execução
btnLogout.onclick = logout;
if (checkAccess()) {
  // aqui você pode chamar outras funções, se precisar carregar dados do usuário…
}
