// Função para injetar o HTML da Sidebar do Admin (MODIFICADA com Gerenciamento Sempre Visível)
function createAdminSidebarHTML(projectContext = null) {
    // Se houver contexto de projeto, aplica tema do projeto, senão usa theme-admin
    const themeClass = projectContext ? `theme-${projectContext.toLowerCase()}` : 'theme-admin';
    console.log(`Criando sidebar admin com tema/contexto: ${themeClass}`);

    // Define os links base dos projetos
    const projectLinks = `
        <li><a href="admin-projeto-dashboard.html?projeto=Argos" id="nav-projeto-argos"><i class="fas fa-shield-alt"></i> <span>Projeto Argos</span></a></li>
        <li><a href="admin-projeto-dashboard.html?projeto=Hvc" id="nav-projeto-hvc"><i class="fas fa-heartbeat"></i> <span>Projeto HVC</span></a></li>
        <li><a href="admin-projeto-dashboard.html?projeto=Planejamento" id="nav-projeto-planejamento"><i class="fas fa-clipboard-list"></i> <span>Projeto Planejamento</span></a></li>
    `;

    // Define o rótulo e os links de gerenciamento (SEMPRE VISÍVEIS)
    const managementLabel = projectContext ? `(${projectContext})` : '(Administrativo)'; // <<< RÓTULO AJUSTADO
    const userManagementLink = projectContext ? `admin-dashboard.html?projeto=${projectContext}#gerenciar-usuarios` : 'admin-dashboard.html#gerenciar-usuarios';
    const clientManagementLink = projectContext ? `clientes-dashboard.html?projeto=${projectContext}` : 'clientes-dashboard.html';

    const managementLinks = `
        <hr class="sidebar-divider">
        <li class="sub-menu-header"><span>Gerenciamento ${managementLabel}</span></li>
        <li class="sub-menu"><a href="${userManagementLink}" id="nav-gerenciar-usuarios"><i class="fas fa-users-cog"></i> <span>Gerenciar Usuários</span></a></li>
        <li class="sub-menu"><a href="${clientManagementLink}" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        <li class="sub-menu"><a href="mensagens-whats.html" id="nav-mensagens-whats-admin"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
    `;

    return `
    <nav id="sidebar" class="${themeClass}">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-tachometer-alt"></i> <span>Painel Admin Geral</span></a></li>
        <hr class="sidebar-divider">
        <li class="sub-menu-header"><span>Projetos</span></li>
        ${projectLinks}
        ${managementLinks} <!-- Links de gerenciamento sempre visíveis -->
        <hr class="sidebar-divider">
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// Função para criar o HTML da Sidebar do Usuário (mantida)
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
        <li><a href="mensagens-whats.html" id="nav-mensagens-whats-usuario"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// Função para Criar Sidebar para Admin Visualizando como Usuário (mantida)
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

// Função para injetar o CSS da Sidebar (mantida)
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

// Função para inicializar a lógica da Sidebar (mantida)
function initializeSidebar(sidebarElement, mainContentElement) {
    const sidebarToggle = sidebarElement.querySelector("#sidebar-toggle");
    const sidebarLogoutBtn = sidebarElement.querySelector("#sidebar-logout-btn");

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

    // Lógica específica para admin-dashboard (seções internas) - REMOVIDA pois não há mais seções internas via sidebar
    // if (currentPage === 'admin-dashboard.html') { ... }
}

// Função para injetar e inicializar a Sidebar (MODIFICADA para contexto de visualização E tema de projeto admin)
async function injectSidebar(mainContentElementId) { // Tornou-se async
    const loggedInUserLevel = sessionStorage.getItem("nivel");
    const loggedInUserProject = sessionStorage.getItem("projeto");
    const viewingUserId = sessionStorage.getItem("viewing_user_id");

    // *** NOVO: Ler projeto da URL para aplicar tema ao admin ***
    const urlParams = new URLSearchParams(window.location.search);
    const projectFromUrl = urlParams.get('projeto');

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
        // CASO 1: Admin está visualizando como usuário
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
        // CASO 2: Admin acessando suas próprias páginas
        // Verifica se está em um contexto de projeto pela URL
        if (projectFromUrl && ['Argos', 'Hvc', 'Planejamento'].includes(projectFromUrl)) {
            // Admin em contexto de projeto: usa tema do projeto
            sidebarHTML = createAdminSidebarHTML(projectFromUrl);
        } else {
            // Admin em contexto geral: usa tema admin padrão
            sidebarHTML = createAdminSidebarHTML(); // Sem argumento = theme-admin
        }
    } else if (loggedInUserLevel === "usuario") {
        // CASO 3: Usuário normal acessando suas páginas
        sidebarHTML = createUserSidebarHTML(loggedInUserProject);
    } else {
        return; // Não injeta para outros níveis
    }

    // Insere a sidebar no início do body
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    const sidebarElement = document.getElementById('sidebar');

    if (sidebarElement) {
        initializeSidebar(sidebarElement, mainContentElement);
        // *** MODIFICADO: Aplica classe de tema ao BODY e ao main content ***
        const themeClass = sidebarElement.className; // Pega a classe de tema da sidebar
        
        // Aplica ao Body
        document.body.classList.remove("theme-admin", "theme-argos", "theme-hvc", "theme-planejamento", "theme-default");
        if (themeClass.startsWith("theme-")) {
            document.body.classList.add(themeClass);
            console.log(`Aplicando tema ${themeClass} ao body.`);
        }

        // Aplica ao Main Content (se existir)
        if (mainContentElement && themeClass.startsWith("theme-")) {
            mainContentElement.classList.remove("theme-admin", "theme-argos", "theme-hvc", "theme-planejamento", "theme-default");
            mainContentElement.classList.add(themeClass);
            console.log(`Aplicando tema ${themeClass} ao main content.`);
        }
        // *** NOVO: Dispara evento para indicar que a sidebar está pronta ***
        console.log("Dispatching sidebarReady event");
        document.dispatchEvent(new CustomEvent('sidebarReady'));

    } else {
         console.error("Sidebar element not found after injection.");
    }
}

// Exporta a função principal a ser usada em outras páginas
export { injectSidebar };
