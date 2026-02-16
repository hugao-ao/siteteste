/**
 * ========================================
 * SIDEBAR.JS - CENTRALIZADO E ROBUSTO
 * - Gerencia injeção de sidebar para Admin e Usuário
 * - Aplica temas automaticamente baseados no projeto
 * - Configura links de navegação dinamicamente
 * - Funciona globalmente (window.injectSidebar)
 * ========================================
 */

(function() {
    // ==========================================================================
    // CONFIGURAÇÕES E DADOS
    // ==========================================================================
    
    const PROJECT_THEMES = {
        'Hvc': 'theme-hvc',
        'Argos': 'theme-argos',
        'Planejamento': 'theme-planejamento',
        'Default': 'theme-default',
        'Admin': 'theme-admin'
    };

    const PROJECT_ICONS = {
        'Hvc': 'fas fa-hard-hat',
        'Argos': 'fas fa-child',
        'Planejamento': 'fas fa-calculator'
    };

    // ==========================================================================
    // FUNÇÕES AUXILIARES DE TEMA E ESTILO
    // ==========================================================================

    function injectSidebarCSS() {
        // CSS Principal
        if (!document.querySelector('link[href*="sidebar.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'sidebar.css';
            document.head.appendChild(cssLink);
        }

        // Font Awesome
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
            faLink.integrity = 'sha512-9usAa10IRO0HhonpyAIVpjrylPvoDwiPUiKdWk5t3PyolY1cOd4DSE0Ga+ri4AuTroPR5aQvXU9xC6qOPnzFeg==';
            faLink.crossOrigin = 'anonymous';
            faLink.referrerPolicy = 'no-referrer';
            document.head.appendChild(faLink);
        }

        // Script Google Calendar Modal (se necessário)
        if (!window.openGoogleCalendarModal && !document.querySelector('script[src="google-calendar-modal-opener.js"]')) {
            const modalScript = document.createElement('script');
            modalScript.src = 'google-calendar-modal-opener.js';
            modalScript.async = false;
            document.head.appendChild(modalScript);
        }

        // CSS Dinâmico para Projeto Ativo
        const customCSS = document.createElement('style');
        customCSS.textContent = `
            .sidebar-menu li.active-project {
                background: rgba(255, 255, 255, 0.1);
                border-left: 4px solid #00ffff;
                margin: 2px 0;
            }
            .sidebar-menu li.active-project a,
            .sidebar-menu li.active-project a i {
                color: #00ffff !important;
                font-weight: bold;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            }
        `;
        document.head.appendChild(customCSS);
    }

    function applyProjectTheme(project) {
        const body = document.body;
        // Remove temas antigos
        Object.values(PROJECT_THEMES).forEach(theme => body.classList.remove(theme));
        
        // Aplica novo tema
        const themeClass = PROJECT_THEMES[project] || PROJECT_THEMES['Default'];
        body.classList.add(themeClass);
        
        // Se houver sidebar já injetada, atualiza ela também
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            Object.values(PROJECT_THEMES).forEach(theme => sidebar.classList.remove(theme));
            sidebar.classList.add(themeClass);
        }

        console.log(`Tema aplicado: ${themeClass}`);
    }

    // ==========================================================================
    // GERADORES DE HTML DA SIDEBAR
    // ==========================================================================

    function getProjectSpecificLinks(project) {
        if (project === 'Hvc') {
            return `
                <li class="sub-menu"><a href="dashboard-hvc.html" id="nav-dashboard-hvc"><i class="fas fa-chart-line"></i> <span>Dashboard HVC</span></a></li>
                <li class="sub-menu"><a href="clientes-hvc.html" id="nav-clientes-hvc"><i class="fas fa-users"></i> <span>Clientes HVC</span></a></li>
                <li class="sub-menu"><a href="servicos-hvc.html" id="nav-servicos-hvc"><i class="fas fa-tools"></i> <span>Serviços HVC</span></a></li>
                <li class="sub-menu"><a href="equipe-hvc.html" id="nav-equipe-hvc"><i class="fas fa-users-cog"></i> <span>Equipe HVC</span></a></li>
                <li class="sub-menu"><a href="propostas-hvc.html" id="nav-propostas-hvc"><i class="fas fa-file-contract"></i> <span>Propostas HVC</span></a></li>
                <li class="sub-menu"><a href="obras-hvc.html" id="nav-obras-hvc"><i class="fas fa-building"></i> <span>Obras HVC</span></a></li>
                <li class="sub-menu"><a href="medicoes-hvc.html" id="nav-medicoes-hvc"><i class="fas fa-ruler-combined"></i> <span>Medições HVC</span></a></li>
                <li class="sub-menu"><a href="fluxo-caixa-hvc.html" id="nav-fluxo-caixa-hvc"><i class="fas fa-money-bill-wave"></i> <span>Fluxo de Caixa HVC</span></a></li>
                <li class="sub-menu"><a href="#" id="nav-google-agenda-hvc" onclick="if(typeof openGoogleCalendarModal === 'function') { openGoogleCalendarModal(); } else { console.error('openGoogleCalendarModal não está definida'); alert('Módulo do Google Calendar ainda não foi carregado. Recarregue a página.'); } return false;"><i class="fab fa-google"></i> <span>Google Agenda</span></a></li>
                <li class="sub-menu"><a href="onedrive-browser.html" id="nav-onedrive-hvc"><i class="fab fa-microsoft"></i> <span>OneDrive</span></a></li>
            `;
        } else if (project === 'Argos') {
            return `
                <li class="sub-menu"><a href="clientes-dashboard.html?projeto=Argos" id="nav-gerenciar-clientes-argos"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
                <li class="sub-menu"><a href="mensagens-whats.html?projeto=Argos" id="nav-mensagens-whats-argos"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
            `;
        } else if (project === 'Planejamento') {
            return `
                <li class="sub-menu"><a href="atualizacao-variaveis.html" id="nav-atualizacao-variaveis"><i class="fas fa-sliders-h"></i> <span>Atualização de Variáveis</span></a></li>
                <li class="sub-menu"><a href="clientes-dashboard.html?projeto=Planejamento" id="nav-gerenciar-clientes-planejamento"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
                <li class="sub-menu"><a href="mensagens-whats.html?projeto=Planejamento" id="nav-mensagens-whats-planejamento"><i class="fab fa-whatsapp"></i> <span>Mensagens Whats</span></a></li>
                <li class="sub-menu">
                    <a href="admin-notificacoes-hvsf.html" id="nav-notificacoes-hvsf" style="position: relative;">
                        <i class="fas fa-bell"></i> 
                        <span>SITE HVSF</span>
                        <span id="badge-notificacoes-hvsf" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background-color: #ff4444; color: white; border-radius: 50%; padding: 2px 6px; font-size: 10px; font-weight: bold;">0</span>
                    </a>
                </li>
            `;
        }
        // Padrão para projetos desconhecidos ou genéricos
        return `
            <li class="sub-menu"><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        `;
    }

    function createAdminSidebarHTML(activeProject) {
        const themeClass = activeProject ? PROJECT_THEMES[activeProject] : PROJECT_THEMES['Admin'];
        
        // Links de navegação entre projetos
        const projectLinks = `
            <li ${activeProject === 'Argos' ? 'class="active-project"' : ''}><a href="admin-projeto-dashboard.html?projeto=Argos" id="nav-projeto-argos"><i class="${PROJECT_ICONS['Argos']}"></i> <span>Projeto Argos</span></a></li>
            <li ${activeProject === 'Hvc' ? 'class="active-project"' : ''}><a href="dashboard-hvc.html" id="nav-projeto-hvc"><i class="${PROJECT_ICONS['Hvc']}"></i> <span>Projeto HVC</span></a></li>
            <li ${activeProject === 'Planejamento' ? 'class="active-project"' : ''}><a href="admin-projeto-dashboard.html?projeto=Planejamento" id="nav-projeto-planejamento"><i class="${PROJECT_ICONS['Planejamento']}"></i> <span>Projeto Planejamento</span></a></li>
        `;

        // Links específicos do projeto ativo
        const projectSpecificLinks = activeProject ? getProjectSpecificLinks(activeProject) : '';
        
        // Link de gerenciamento de usuários
        const userManagementLink = activeProject ? `admin-dashboard.html?projeto=${activeProject}#gerenciar-usuarios` : 'admin-dashboard.html#gerenciar-usuarios';
        const managementLabel = activeProject ? `(${activeProject})` : '(Geral)';

        return `
        <nav id="sidebar" class="${themeClass}">
          <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
          <ul class="sidebar-menu">
            <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-tachometer-alt"></i> <span>Painel Admin Geral</span></a></li>
            <hr class="sidebar-divider">
            <li class="sub-menu-header"><span>Projetos</span></li>
            ${projectLinks}
            
            <hr class="sidebar-divider">
            <li class="sub-menu-header"><span>Gerenciamento ${managementLabel}</span></li>
            <li class="sub-menu"><a href="${userManagementLink}" id="nav-gerenciar-usuarios"><i class="fas fa-users-cog"></i> <span>Gerenciar Usuários</span></a></li>
            ${projectSpecificLinks}
            
            <hr class="sidebar-divider">
            <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
          </ul>
        </nav>
        `;
    }

    function createUserSidebarHTML(userProject) {
        const themeClass = PROJECT_THEMES[userProject] || PROJECT_THEMES['Default'];
        
        // Página inicial baseada no projeto
        let homePage = 'user-dashboard.html';
        if (userProject === 'Planejamento') homePage = 'planejamento-dashboard.html';
        if (userProject === 'Hvc') homePage = 'dashboard-hvc.html';

        const projectSpecificLinks = getProjectSpecificLinks(userProject);

        return `
        <nav id="sidebar" class="${themeClass}">
          <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
          <ul class="sidebar-menu">
            <li><a href="${homePage}" id="nav-painel-inicial"><i class="fas fa-home"></i> <span>Painel Inicial</span></a></li>
            ${projectSpecificLinks}
            <hr class="sidebar-divider">
            <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
          </ul>
        </nav>
        `;
    }

    // ==========================================================================
    // LÓGICA DE INICIALIZAÇÃO E EVENTOS
    // ==========================================================================

    function initializeSidebarEvents(sidebarElement, mainContentElement) {
        const sidebarToggle = sidebarElement.querySelector("#sidebar-toggle");
        const sidebarLogoutBtn = sidebarElement.querySelector("#sidebar-logout-btn");

        // Toggle Sidebar
        function toggleSidebar() {
            sidebarElement.classList.toggle("collapsed");
            if (mainContentElement) {
                 mainContentElement.classList.toggle("sidebar-collapsed");
            }
            localStorage.setItem("sidebarCollapsed", sidebarElement.classList.contains("collapsed"));
        }

        // Logout
        function logout() {
            sessionStorage.clear();
            localStorage.removeItem("sidebarCollapsed");
            window.location.href = "index.html";
        }

        if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
        if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', logout);

        // Estado Inicial (Collapsed ou não)
        const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
        if (sidebarCollapsed) {
            sidebarElement.classList.add("collapsed");
            if (mainContentElement) {
                mainContentElement.classList.add("sidebar-collapsed");
            }
        }

        // Highlight Active Link
        const currentPage = window.location.pathname.split('/').pop();
        const menuItems = sidebarElement.querySelectorAll('.sidebar-menu a');
        menuItems.forEach(item => {
            const itemHref = item.getAttribute('href').split('#')[0].split('?')[0]; // Compara base path
            if (itemHref && currentPage.includes(itemHref)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // ==========================================================================
    // FUNÇÃO PRINCIPAL DE INJEÇÃO
    // ==========================================================================

    function injectSidebar(mainContentElementId, forceProject = null) {
        const loggedInUserLevel = sessionStorage.getItem("nivel");
        const loggedInUserProject = sessionStorage.getItem("projeto");
        const viewingUserId = sessionStorage.getItem("viewing_user_id"); // Admin vendo como user

        if (!loggedInUserLevel) {
            console.warn("Usuário não logado. Sidebar não injetada.");
            return;
        }

        // 1. Determinar Projeto Ativo (Contexto)
        let activeProject = forceProject;
        
        // Se não forçado, tenta pegar da URL
        if (!activeProject) {
            const urlParams = new URLSearchParams(window.location.search);
            activeProject = urlParams.get('projeto');
        }

        // Se não tiver na URL, tenta inferir pela página atual
        if (!activeProject) {
            const path = window.location.pathname;
            if (path.includes('hvc')) activeProject = 'Hvc';
            else if (path.includes('argos')) activeProject = 'Argos';
            else if (path.includes('planejamento')) activeProject = 'Planejamento';
            else if (path.includes('notificacoes')) activeProject = 'Planejamento'; // Específico HVSF
        }

        // Se ainda não tiver, usa o projeto do usuário logado (se não for admin geral navegando)
        if (!activeProject && loggedInUserLevel !== 'admin') {
            activeProject = loggedInUserProject;
        }

        console.log(`Sidebar Context -> Level: ${loggedInUserLevel}, Project: ${activeProject}`);

        // 2. Aplicar Tema ao Body
        if (activeProject) {
            applyProjectTheme(activeProject);
        } else if (loggedInUserLevel === 'admin') {
            applyProjectTheme('Admin');
        }

        // 3. Gerar HTML da Sidebar
        let sidebarHTML = '';
        
        if (loggedInUserLevel === 'admin') {
            if (viewingUserId) {
                // Admin visualizando como usuário específico
                const viewedUserProject = sessionStorage.getItem("viewed_user_project");
                sidebarHTML = createUserSidebarHTML(viewedUserProject); // Usa layout de usuário
            } else {
                // Admin normal
                sidebarHTML = createAdminSidebarHTML(activeProject);
            }
        } else {
            // Usuário comum
            sidebarHTML = createUserSidebarHTML(loggedInUserProject);
        }

        // 4. Injetar no DOM
        const mainContentElement = document.getElementById(mainContentElementId);
        if (!mainContentElement) {
            console.error(`Elemento principal '${mainContentElementId}' não encontrado.`);
            return;
        }

        injectSidebarCSS();

        const sidebarContainer = document.createElement('div');
        sidebarContainer.innerHTML = sidebarHTML;
        const sidebarElement = sidebarContainer.firstElementChild;

        // Remove sidebar antiga se existir (para evitar duplicatas em re-renderizações)
        const oldSidebar = document.getElementById('sidebar');
        if (oldSidebar) oldSidebar.remove();

        document.body.insertBefore(sidebarElement, document.body.firstChild);

        // 5. Inicializar Eventos
        initializeSidebarEvents(sidebarElement, mainContentElement);

        // 6. Lógica Extra para Páginas Específicas (Centralização de Scripts Dispersos)
        handlePageSpecificLogic(activeProject);
    }

    // ==========================================================================
    // LÓGICA ESPECÍFICA DE PÁGINAS (CENTRALIZADA)
    // ==========================================================================

    function handlePageSpecificLogic(project) {
        const path = window.location.pathname;

        // Lógica para admin-projeto-dashboard.html
        if (path.includes('admin-projeto-dashboard.html') && project) {
            // Atualiza título
            const projectTitleElement = document.getElementById('project-title');
            if (projectTitleElement) projectTitleElement.textContent = `Admin Dashboard - ${project}`;
            document.title = `Admin Dashboard - ${project}`;

            // Configura botões
            const btnGerenciar = document.getElementById("btn-gerenciar-usuarios");
            if (btnGerenciar) btnGerenciar.href = `admin-dashboard.html?projeto=${project}#gerenciar-usuarios`;

            const btnListar = document.getElementById("btn-listar-usuarios");
            if (btnListar) btnListar.href = `admin-dashboard.html?projeto=${project}#listar-usuarios`;

            const btnClientes = document.getElementById("btn-listar-clientes");
            if (btnClientes) btnClientes.href = `clientes-dashboard.html?projeto=${project}`;

            // Botões específicos do Planejamento
            if (project === 'Planejamento') {
                const btnWhats = document.getElementById("btn-mensagens-whats");
                if (btnWhats) {
                    btnWhats.style.display = 'inline-flex';
                    btnWhats.href = 'mensagens-whats.html';
                }
                const btnVariaveis = document.getElementById("btn-atualizacao-variaveis");
                if (btnVariaveis) {
                    btnVariaveis.style.display = 'inline-flex';
                    btnVariaveis.href = 'atualizacao-variaveis.html';
                }
            }
        }
    }

    // ==========================================================================
    // EXPORTAÇÃO GLOBAL
    // ==========================================================================

    window.injectSidebar = injectSidebar;
    window.applyProjectTheme = applyProjectTheme; // Ainda útil se chamado manualmente

})();
