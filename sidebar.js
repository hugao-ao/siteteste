// sidebar.js
import { supabase } from "./supabase.js"; // Importa supabase

// Função para criar o HTML da Sidebar do Admin
function createAdminSidebarHTML() {
    // Adiciona classe de tema específica para admin (pode ser ajustada se necessário)
    return `
    <nav id="sidebar" class="theme-admin">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-tachometer-alt"></i> <span>Painel Admin</span></a></li>
        <li><a href="admin-dashboard.html#gerenciar-usuarios" id="nav-gerenciar-usuarios" data-target-section="content-gerenciar-usuarios"><i class="fas fa-users-cog"></i> <span>Gerenciar Usuários</span></a></li>
        <li><a href="admin-dashboard.html#listar-usuarios" id="nav-listar-usuarios" data-target-section="content-listar-usuarios"><i class="fas fa-users"></i> <span>Lista de Usuários</span></a></li>
        <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// Função para criar o HTML da Sidebar do Usuário
function createUserSidebarHTML(userProject) {
    // Determina a página inicial baseada no projeto
    const homePage = userProject === 'Planejamento' ? 'planejamento-dashboard.html' : 'user-dashboard.html';
    // Define a classe de tema baseada no projeto (fallback para 'default' se não houver projeto)
    const themeClass = `theme-${userProject ? userProject.toLowerCase() : 'default'}`;

    return `
    <nav id="sidebar" class="${themeClass}">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="${homePage}" id="nav-painel-inicial"><i class="fas fa-home"></i> <span>Painel Inicial</span></a></li>
        <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// *** NOVA FUNÇÃO: Criar Sidebar para Admin Visualizando como Usuário ***
function createAdminViewingUserSidebarHTML(viewedUserProject) {
    // Define a classe de tema baseada no projeto do usuário visualizado
    const themeClass = `theme-${viewedUserProject ? viewedUserProject.toLowerCase() : 'default'}`;

    return `
    <nav id="sidebar" class="${themeClass}">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-arrow-left"></i> <span>Painel Admin</span></a></li> <!-- Link para voltar ao painel admin -->
        <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li> <!-- Logout ainda desloga o admin -->
      </ul>
    </nav>
    `;
}

// Função para injetar o CSS da Sidebar
function injectSidebarCSS() {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'sidebar.css'; // Referencia o arquivo CSS externo
    document.head.appendChild(cssLink);

    // Adiciona também Font Awesome se não estiver presente
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        faLink.integrity = 'sha512-9usAa10IRO0HhonpyAIVpjrylPvoDwiPUiKdWk5t3PyolY1cOd4DSE0Ga+ri4AuTroPR5aQvXU9xC6qOPnzFeg==';
        faLink.crossOrigin = 'anonymous';
        faLink.referrerPolicy = 'no-referrer';
        document.head.appendChild(faLink);
    }
}

// Função para inicializar a lógica da Sidebar (comum para admin e usuário)
function initializeSidebar(sidebarElement, mainContentElement) {
    const sidebarToggle = sidebarElement.querySelector("#sidebar-toggle");
    const sidebarLogoutBtn = sidebarElement.querySelector("#sidebar-logout-btn");
    // const sidebarBackBtn = sidebarElement.querySelector("#sidebar-back-btn"); // REMOVIDO

    // Função Toggle
    function toggleSidebar() {
        sidebarElement.classList.toggle("collapsed");
        // Ajusta a classe no main content para margem (se existir)
        if (mainContentElement) {
             mainContentElement.classList.toggle("sidebar-collapsed");
        }
        localStorage.setItem("sidebarCollapsed", sidebarElement.classList.contains("collapsed"));
    }

    // Função Logout
    function logout() {
        sessionStorage.clear();
        localStorage.removeItem("sidebarCollapsed"); // Limpa estado da sidebar no logout
        window.location.href = "index.html";
    }

    // Event Listeners
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    // if (sidebarBackBtn) { // REMOVIDO
    //     sidebarBackBtn.addEventListener('click', () => history.back());
    // }
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', logout);
    }

    // Aplica estado inicial baseado no localStorage
    const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    if (sidebarCollapsed) {
        sidebarElement.classList.add("collapsed");
        if (mainContentElement) {
            mainContentElement.classList.add("sidebar-collapsed");
        }
    }

    // Adiciona lógica para destacar item ativo baseado na URL
    const currentPage = window.location.pathname.split('/').pop();
    const menuItems = sidebarElement.querySelectorAll('.sidebar-menu a');

    menuItems.forEach(item => {
        const itemHref = item.getAttribute('href').split('#')[0]; // Ignora hash para comparação de página
        if (itemHref === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Lógica específica para admin-dashboard (seções internas)
    if (currentPage === 'admin-dashboard.html') {
        const currentHash = window.location.hash;
        const adminMenuItems = sidebarElement.querySelectorAll('.sidebar-menu a[data-target-section]');
        let sectionActive = false;
        adminMenuItems.forEach(item => {
            if (item.getAttribute('href').endsWith(currentHash)) {
                item.classList.add('active');
                // Remove active de outros links do admin
                sidebarElement.querySelector('#nav-painel-admin')?.classList.remove('active');
                sectionActive = true;
            } else {
                 item.classList.remove('active');
            }
        });
        // Se nenhuma seção estiver ativa (ou hash vazio), ativa o Painel Admin
        if (!sectionActive) {
             sidebarElement.querySelector('#nav-painel-admin')?.classList.add('active');
        }
    }
}

// Função para injetar e inicializar a Sidebar (MODIFICADA para contexto de visualização)
async function injectSidebar(mainContentElementId) { // Tornou-se async
    const loggedInUserLevel = sessionStorage.getItem("nivel");
    const loggedInUserProject = sessionStorage.getItem("projeto");
    const viewingUserId = sessionStorage.getItem("viewing_user_id");

    if (!loggedInUserLevel) return; // Sai se não houver nível definido (não logado)

    const mainContentElement = document.getElementById(mainContentElementId);
    if (!mainContentElement) {
        console.error(`Elemento com ID '${mainContentElementId}' não encontrado para injetar a sidebar.`);
        return;
    }

    // Injeta o CSS comum da Sidebar
    injectSidebarCSS();

    let sidebarHTML;
    let isViewingAsUser = loggedInUserLevel === "admin" && viewingUserId;

    if (isViewingAsUser) {
        // Admin está visualizando como usuário
        let viewedUserProject = null;
        try {
            // Busca o projeto do usuário que está sendo visualizado
            const { data: viewedUserData, error: viewedUserError } = await supabase
                .from('credenciais')
                .select('projeto')
                .eq('id', viewingUserId)
                .single();
            if (viewedUserError) throw viewedUserError;
            viewedUserProject = viewedUserData?.projeto;
        } catch (error) {
            console.error("Erro ao buscar projeto do usuário visualizado para a sidebar:", error);
            // Continua com projeto nulo/default em caso de erro
        }
        sidebarHTML = createAdminViewingUserSidebarHTML(viewedUserProject);

    } else if (loggedInUserLevel === "admin") {
        // Admin acessando suas próprias páginas
        sidebarHTML = createAdminSidebarHTML();
    } else if (loggedInUserLevel === "usuario") {
        // Usuário normal acessando suas páginas
        sidebarHTML = createUserSidebarHTML(loggedInUserProject);
    } else {
        return; // Não injeta para outros níveis
    }

    // Insere a sidebar no início do body
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    const sidebarElement = document.getElementById('sidebar');

    if (sidebarElement) {
        initializeSidebar(sidebarElement, mainContentElement);
    } else {
         console.error("Sidebar element not found after injection.");
    }
}

// Exporta a função principal a ser usada em outras páginas
export { injectSidebar };
