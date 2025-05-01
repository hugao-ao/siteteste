// user.js
import { supabase } from "./supabase.js";

// Seleciona elementos
const btnLogout = document.getElementById("logout-btn");
const usernameDisplay = document.getElementById("username-display");
const backToAdminBtn = document.getElementById("back-to-admin-btn");
const adminViewIndicator = document.getElementById("admin-view-indicator");
const userProjectDisplay = document.getElementById("user-project-display");

// Verifica se um admin está visualizando este painel
const viewingUserId = sessionStorage.getItem("viewing_user_id");
const viewingUsername = sessionStorage.getItem("viewing_username");
const adminViewerUsername = sessionStorage.getItem("admin_viewer_username");

// --- Lógica de Acesso e Visualização ---
async function initializeDashboard() {
  let currentUser = null;
  let currentUserId = null;
  let isAdminViewing = false;

  if (adminViewerUsername && viewingUserId && viewingUsername) {
    // Admin está visualizando
    isAdminViewing = true;
    currentUser = viewingUsername;
    currentUserId = viewingUserId;
    usernameDisplay.textContent = currentUser;
    adminViewIndicator.style.display = "block";
    backToAdminBtn.style.display = "block";
    // O botão de logout ainda funciona, mas desloga o admin
    btnLogout.onclick = logoutAdmin;
    backToAdminBtn.onclick = goBackToAdmin;

  } else {
    // Usuário normal logado
    const user = sessionStorage.getItem("usuario");
    const nivel = sessionStorage.getItem("nivel");
    const userId = sessionStorage.getItem("user_id"); // Assumindo que o ID é salvo no login

    if (!user || !nivel) {
      alert("Acesso não autorizado. Faça login primeiro.");
      window.location.href = "index.html";
      return false;
    }
    currentUser = user;
    currentUserId = userId;
    usernameDisplay.textContent = currentUser;
    btnLogout.onclick = logoutUser;
  }

  // Carrega o projeto do usuário (seja o visualizado ou o logado)
  if (currentUserId) {
      await loadUserProject(currentUserId);
  } else if (!isAdminViewing) {
      // Se for usuário normal e não tivermos ID, tenta buscar pelo nome
      // (Isso requer que o ID seja salvo no login para ser robusto)
      console.warn("ID do usuário não encontrado no sessionStorage. Tentando buscar pelo nome...");
      await loadUserProjectByName(currentUser);
  }

  return true;
}

// --- Carregar Projeto do Usuário ---
async function loadUserProject(userId) {
    try {
        userProjectDisplay.textContent = "Carregando...";
        const { data, error } = await supabase
            .from("credenciais")
            .select("projeto")
            .eq("id", userId)
            .single(); // Espera apenas um resultado

        if (error) throw error;

        userProjectDisplay.textContent = data.projeto || "Nenhum";

    } catch (error) {
        console.error("Erro ao carregar projeto do usuário:", error);
        userProjectDisplay.textContent = "Erro ao carregar";
    }
}

// Função alternativa se o ID não estiver no sessionStorage (menos ideal)
async function loadUserProjectByName(username) {
     try {
        userProjectDisplay.textContent = "Carregando...";
        const { data, error } = await supabase
            .from("credenciais")
            .select("projeto")
            .eq("usuario", username)
            .single();

        if (error) throw error;

        userProjectDisplay.textContent = data.projeto || "Nenhum";

    } catch (error) {
        console.error("Erro ao carregar projeto do usuário pelo nome:", error);
        userProjectDisplay.textContent = "Erro ao carregar";
    }
}


// --- Funções de Navegação e Logout ---

// Logout normal do usuário
function logoutUser() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// Logout quando admin está visualizando (desloga o admin)
function logoutAdmin() {
  sessionStorage.clear(); // Limpa tudo, incluindo as chaves de visualização
  window.location.href = "index.html";
}

// Função para o admin voltar ao seu painel
function goBackToAdmin() {
  // Remove apenas as chaves de visualização
  sessionStorage.removeItem("viewing_user_id");
  sessionStorage.removeItem("viewing_username");
  sessionStorage.removeItem("admin_viewer_username");
  // Redireciona de volta para o painel admin
  window.location.href = "admin-dashboard.html";
}

// --- Inicialização ---
initializeDashboard();
