// Função para injetar o HTML da Sidebar do Admin (MODIFICADA com destaque de projeto ativo e ícones apropriados)
function createAdminSidebarHTML(projectContext = null) {
    // Se houver contexto de projeto, aplica tema do projeto, senão usa theme-admin
    const themeClass = projectContext ? `theme-${projectContext.toLowerCase()}` : 'theme-admin';
    console.log(`Criando sidebar admin com tema/contexto: ${themeClass}`);

    // Define os links base dos projetos com ícones apropriados e destaque do projeto ativo
    const projectLinks = `
        <li ${projectContext === 'Argos' ? 'class="active-project"' : ''}><a href="admin-projeto-dashboard.html?projeto=Argos" id="nav-projeto-argos"><i class="fas fa-child"></i> <span>Projeto Argos</span></a></li>
        <li ${projectContext === 'Hvc' ? 'class="active-project"' : ''}><a href="dashboard-hvc.html" id="nav-projeto-hvc"><i class="fas fa-hard-hat"></i> <span>Projeto HVC</span></a></li>
        <li ${projectContext === 'Planejamento' ? 'class="active-project"' : ''}><a href="admin-projeto-dashboard.html?projeto=Planejamento" id="nav-projeto-planejamento"><i class="fas fa-calculator"></i> <span>Projeto Planejamento</span></a></li>
    `;

    // Define o rótulo de gerenciamento
    const managementLabel = projectContext ? `(${projectContext})` : '(Administrativo)';
    const userManagementLink = projectContext ? `admin-dashboard.html?projeto=${projectContext}#gerenciar-usuarios` : 'admin-dashboard.html#gerenciar-usuarios';

    // Links específicos por projeto (o que os usuários desse projeto veem)
    let projectSpecificLinks = '';
    
    if (projectContext === 'Hvc') {
        projectSpecificLinks = `
            <li class="sub-menu"><a href="dashboard-hvc.html" id="nav-dashboard-hvc"><i class="fas fa-chart-line"></i> <span>Dashboard HVC</span></a></li>
            <li class="sub-menu"><a href="clientes-hvc.html" id="nav-clientes-hvc"><i class="fas fa-users"></i> <span>Clientes HVC</span></a></li>
            <li class="sub-menu"><a href="servicos-hvc.html" id="nav-servicos-hvc"><i class="fas fa-tools"></i> <span>Serviços HVC</span></a></li>
            <li class="sub-menu"><a href="propostas-hvc.html" id="nav-propostas-hvc"><i class="fas fa-file-contract"></i> <span>Propostas HVC</span></a></li>
            <li class="sub-menu"><a href="obras-hvc.html" id="nav-obras-hvc"><i class="fas fa-building"></i> <span>Obras HVC</span></a></li>
            <li class="sub-menu"><a href="medicoes-hvc.html" id="nav-medicoes-hvc"><i class="fas fa-ruler-combined"></i> <span>Medições HVC</span></a></li>
            <li class="sub-menu"><a href="equipe-hvc.html" id="nav-equipe-hvc"><i class="fas fa-users-cog"></i> <span>Equipe HVC</span></a></li>
            <li class="sub-menu"><a href="fluxo-caixa-hvc.html" id="nav-fluxo-caixa-hvc"><i class="fas fa-money-bill-wave"></i> <span>Fluxo de Caixa HVC</span></a></li>
        `;
    } else if (projectContext === 'Argos') {
        projectSpecificLinks = `
            <li class="sub-menu"><a href="clientes-dashboard.html" id="nav-gerenciar-clientes-argos"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li class="sub-menu"><a href="mensagens-whats.html" id="nav-mensagens-whats-argos"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    } else if (projectContext === 'Planejamento') {
        projectSpecificLinks = `
            <li class="sub-menu"><a href="atualizacao-variaveis.html" id="nav-atualizacao-variaveis"><i class="fas fa-sliders-h"></i> <span>Atualização de Variáveis</span></a></li>
            <li class="sub-menu"><a href="clientes-dashboard.html" id="nav-gerenciar-clientes-planejamento"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li class="sub-menu"><a href="mensagens-whats.html" id="nav-mensagens-whats-planejamento"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    }

    // Links de gerenciamento - sempre mostra Gerenciar Usuários + funcionalidades específicas do projeto
    const managementLinks = `
        <hr class="sidebar-divider">
        <li class="sub-menu-header"><span>Gerenciamento ${managementLabel}</span></li>
        <li class="sub-menu"><a href="${userManagementLink}" id="nav-gerenciar-usuarios"><i class="fas fa-users-cog"></i> <span>Gerenciar Usuários</span></a></li>
        ${projectSpecificLinks}
    `;

    return `
    <nav id="sidebar" class="${themeClass}">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-tachometer-alt"></i> <span>Painel Admin Geral</span></a></li>
        <hr class="sidebar-divider">
        <li class="sub-menu-header"><span>Projetos</span></li>
        ${projectLinks}
        ${managementLinks}
        <hr class="sidebar-divider">
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// Função para criar o HTML da Sidebar do Usuário (MODIFICADA com ícones apropriados)
function createUserSidebarHTML(userProject) {
    // Determina a página inicial baseada no projeto
    const homePage = userProject === 'Planejamento' ? 'planejamento-dashboard.html' : 
                     userProject === 'Hvc' ? 'dashboard-hvc.html' : 'user-dashboard.html';
    // Define a classe de tema baseada no projeto (fallback para 'default' se não houver projeto)
    const themeClass = `theme-${userProject ? userProject.toLowerCase() : 'default'}`;

    // Links específicos por projeto
    let projectSpecificLinks = '';
    
    if (userProject === 'Hvc') {
        projectSpecificLinks = `
            <li><a href="dashboard-hvc.html" id="nav-dashboard-hvc"><i class="fas fa-chart-line"></i> <span>Dashboard HVC</span></a></li>
            <li><a href="clientes-hvc.html" id="nav-clientes-hvc"><i class="fas fa-users"></i> <span>Clientes HVC</span></a></li>
            <li><a href="propostas-hvc.html" id="nav-propostas-hvc"><i class="fas fa-file-contract"></i> <span>Propostas HVC</span></a></li>
            <li><a href="obras-hvc.html" id="nav-obras-hvc"><i class="fas fa-building"></i> <span>Obras HVC</span></a></li>
            <li><a href="medicoes-hvc.html" id="nav-medicoes-hvc"><i class="fas fa-ruler-combined"></i> <span>Medições HVC</span></a></li>
            <li><a href="equipe-hvc.html" id="nav-equipe-hvc"><i class="fas fa-users-cog"></i> <span>Equipe HVC</span></a></li>
            <li><a href="fluxo-caixa-hvc.html" id="nav-fluxo-caixa-hvc"><i class="fas fa-money-bill-wave"></i> <span>Fluxo de Caixa HVC</span></a></li>
        `;
    } else if (userProject === 'Argos') {
        projectSpecificLinks = `
            <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li><a href="mensagens-whats.html" id="nav-mensagens-whats-usuario"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    } else if (userProject === 'Planejamento') {
        projectSpecificLinks = `
            <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li><a href="mensagens-whats.html" id="nav-mensagens-whats-usuario"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    } else {
        // Projeto padrão ou desconhecido
        projectSpecificLinks = `
            <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li><a href="mensagens-whats.html" id="nav-mensagens-whats-usuario"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    }

    return `
    <nav id="sidebar" class="${themeClass}">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="${homePage}" id="nav-painel-inicial"><i class="fas fa-home"></i> <span>Painel Inicial</span></a></li>
        ${projectSpecificLinks}
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// Função para Criar Sidebar para Admin Visualizando como Usuário (MODIFICADA)
function createAdminViewingUserSidebarHTML(viewedUserProject) {
    // Define a classe de tema baseada no projeto do usuário visualizado
    const themeClass = `theme-${viewedUserProject ? viewedUserProject.toLowerCase() : 'default'}`;

    // Links específicos por projeto (igual ao que o usuário vê)
    let projectSpecificLinks = '';
    
    if (viewedUserProject === 'Hvc') {
        projectSpecificLinks = `
            <li><a href="dashboard-hvc.html" id="nav-dashboard-hvc"><i class="fas fa-chart-line"></i> <span>Dashboard HVC</span></a></li>
            <li><a href="clientes-hvc.html" id="nav-clientes-hvc"><i class="fas fa-users"></i> <span>Clientes HVC</span></a></li>
            <li><a href="propostas-hvc.html" id="nav-propostas-hvc"><i class="fas fa-file-contract"></i> <span>Propostas HVC</span></a></li>
            <li><a href="obras-hvc.html" id="nav-obras-hvc"><i class="fas fa-building"></i> <span>Obras HVC</span></a></li>
            <li><a href="medicoes-hvc.html" id="nav-medicoes-hvc"><i class="fas fa-ruler-combined"></i> <span>Medições HVC</span></a></li>
            <li><a href="equipe-hvc.html" id="nav-equipe-hvc"><i class="fas fa-users-cog"></i> <span>Equipe HVC</span></a></li>
            <li><a href="fluxo-caixa-hvc.html" id="nav-fluxo-caixa-hvc"><i class="fas fa-money-bill-wave"></i> <span>Fluxo de Caixa HVC</span></a></li>
        `;
    } else if (viewedUserProject === 'Argos') {
        projectSpecificLinks = `
            <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li><a href="mensagens-whats.html" id="nav-mensagens-whats"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    } else if (viewedUserProject === 'Planejamento') {
        projectSpecificLinks = `
            <li><a href="atualizacao-variaveis.html" id="nav-atualizacao-variaveis"><i class="fas fa-sliders-h"></i> <span>Atualização de Variáveis</span></a></li>
            <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
            <li><a href="mensagens-whats.html" id="nav-mensagens-whats"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
        `;
    } else {
        projectSpecificLinks = `
            <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        `;
    }

    return `
    <nav id="sidebar" class="${themeClass}">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-arrow-left"></i> <span>Painel Admin</span></a></li>
        ${projectSpecificLinks}
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
      </ul>
    </nav>
    `;
}

// Função para injetar o CSS da Sidebar (MODIFICADA para incluir estilo do projeto ativo)
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

    // Adiciona CSS personalizado para destacar projeto ativo
    const customCSS = document.createElement('style');
    customCSS.textContent = `
        .sidebar-menu li.active-project {
            background: rgba(255, 255, 255, 0.1);
            border-left: 4px solid #00ffff;
            margin: 2px 0;
        }
        
        .sidebar-menu li.active-project a {
            color: #00ffff !important;
            font-weight: bold;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        }
        
        .sidebar-menu li.active-project a i {
            color: #00ffff !important;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        }
    `;
    document.head.appendChild(customCSS);
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
}

// Função para injetar e inicializar a Sidebar (MODIFICADA para detectar projeto ativo automaticamente)
async function injectSidebar(mainContentElementId, forceProject = null) { // Tornou-se async e aceita projeto forçado
    const loggedInUserLevel = sessionStorage.getItem("nivel");
    const loggedInUserProject = sessionStorage.getItem("projeto");
    const viewingUserId = sessionStorage.getItem("viewing_user_id");

    // *** DETECTAR PROJETO ATIVO: forçado, da URL ou da página atual ***
    let projectFromUrl = forceProject; // Usar projeto forçado se fornecido
    
    if (!projectFromUrl) {
        const urlParams = new URLSearchParams(window.location.search);
        projectFromUrl = urlParams.get('projeto');
    }
    
    // Se não há projeto na URL, detectar pela página atual
    if (!projectFromUrl) {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage.includes('hvc') || currentPage === 'dashboard-hvc.html') {
            projectFromUrl = 'Hvc';
        } else if (currentPage.includes('argos')) {
            projectFromUrl = 'Argos';
        } else if (currentPage.includes('planejamento')) {
            projectFromUrl = 'Planejamento';
        } else if (currentPage === 'clientes-dashboard.html' || currentPage === 'cliente-detalhes.html') {
            // Para páginas genéricas, assumir Planejamento como padrão se não especificado
            projectFromUrl = 'Planejamento';
        }
    }

    if (!loggedInUserLevel) return; // Sai se não houver nível definido (não logado)

    const mainContentElement = document.getElementById(mainContentElementId);
    if (!mainContentElement) {
        console.error(`Elemento com ID '${mainContentElementId}' não encontrado`);
        return;
    }

    // Injeta CSS da sidebar
    injectSidebarCSS();

    let sidebarHTML = '';

    // Determina qual sidebar mostrar
    if (loggedInUserLevel === "admin") {
        if (viewingUserId) {
            // Admin visualizando como usuário
            const viewedUserProject = sessionStorage.getItem("viewed_user_project");
            sidebarHTML = createAdminViewingUserSidebarHTML(viewedUserProject);
        } else {
            // Admin normal - usa projeto detectado ou projeto do admin
            const contextProject = projectFromUrl || loggedInUserProject;
            sidebarHTML = createAdminSidebarHTML(contextProject);
        }
    } else {
        // Usuário normal
        sidebarHTML = createUserSidebarHTML(loggedInUserProject);
    }

    // Injeta o HTML da sidebar
    const sidebarContainer = document.createElement('div');
    sidebarContainer.innerHTML = sidebarHTML;
    const sidebarElement = sidebarContainer.firstElementChild;

    // Insere a sidebar no DOM
    document.body.insertBefore(sidebarElement, document.body.firstChild);

    // Inicializa a lógica da sidebar
    initializeSidebar(sidebarElement, mainContentElement);

    console.log(`Sidebar injetada com sucesso para ${loggedInUserLevel} no projeto ${projectFromUrl || loggedInUserProject}`);
}

// Função para aplicar tema baseado no projeto (NOVA)
function applyProjectTheme(project) {
    const body = document.body;
    
    // Remove classes de tema existentes
    body.classList.remove('theme-hvc', 'theme-argos', 'theme-planejamento', 'theme-admin', 'theme-default');
    
    // Aplica novo tema
    if (project) {
        body.classList.add(`theme-${project.toLowerCase()}`);
    } else {
        body.classList.add('theme-default');
    }
    
    console.log(`Tema aplicado: theme-${project ? project.toLowerCase() : 'default'}`);
}

// Função de conveniência para páginas que precisam detectar projeto automaticamente (NOVA)
function injectSidebarWithAutoDetection(mainContentElementId) {
    // Detecta projeto da URL ou página atual
    const urlParams = new URLSearchParams(window.location.search);
    let project = urlParams.get('projeto');
    
    if (!project) {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage.includes('hvc') || currentPage === 'dashboard-hvc.html') {
            project = 'Hvc';
        } else if (currentPage.includes('argos')) {
            project = 'Argos';
        } else if (currentPage.includes('planejamento')) {
            project = 'Planejamento';
        }
    }
    
    // Aplica tema e injeta sidebar
    applyProjectTheme(project);
    injectSidebar(mainContentElementId, project);
}

// Exporta as funções principais para uso como módulo ES6
export { 
    injectSidebar, 
    injectSidebarWithAutoDetection, 
    applyProjectTheme,
    createAdminSidebarHTML,
    createUserSidebarHTML,
    createAdminViewingUserSidebarHTML,
    injectSidebarCSS,
    initializeSidebar
};

