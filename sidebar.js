// sidebar.js

// Função para criar o HTML da Sidebar
function createAdminSidebarHTML() {
    return `
    <nav id="sidebar">
      <button id="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul class="sidebar-menu">
        <li><a href="admin-dashboard.html" id="nav-painel-admin"><i class="fas fa-tachometer-alt"></i> <span>Painel Admin</span></a></li>
        <li><a href="admin-dashboard.html#gerenciar-usuarios" id="nav-gerenciar-usuarios" data-target-section="content-gerenciar-usuarios"><i class="fas fa-users-cog"></i> <span>Gerenciar Usuários</span></a></li>
        <li><a href="admin-dashboard.html#listar-usuarios" id="nav-listar-usuarios" data-target-section="content-listar-usuarios"><i class="fas fa-users"></i> <span>Lista de Usuários</span></a></li>
        <li><a href="clientes-dashboard.html" id="nav-gerenciar-clientes"><i class="fas fa-briefcase"></i> <span>Gerenciar Clientes</span></a></li>
        <li><button id="sidebar-back-btn"><i class="fas fa-arrow-left"></i> <span>Voltar</span></button></li>
        <li><button id="sidebar-logout-btn"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></button></li>
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

    // Adiciona também Font Awesome se não estiver presente (opcional, mas bom para garantir ícones)
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


// Função para inicializar a lógica da Sidebar
function initializeSidebar(sidebarElement, mainContentElement) {
    const sidebarToggle = sidebarElement.querySelector("#sidebar-toggle");
    const sidebarBackBtn = sidebarElement.querySelector("#sidebar-back-btn");
    const sidebarLogoutBtn = sidebarElement.querySelector("#sidebar-logout-btn");

    // Função Toggle
    function toggleSidebar() {
        sidebarElement.classList.toggle("collapsed");
        mainContentElement.classList.toggle("sidebar-collapsed"); // Adiciona/remove classe no main content
        localStorage.setItem("sidebarCollapsed", sidebarElement.classList.contains("collapsed"));
    }

    // Função Logout
    function logout() {
        sessionStorage.clear();
        window.location.href = "index.html";
    }

    // Event Listeners
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (sidebarBackBtn) {
        sidebarBackBtn.addEventListener('click', () => history.back());
    }
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', logout);
    }

    // Aplica estado inicial baseado no localStorage
    const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    if (sidebarCollapsed) {
        sidebarElement.classList.add("collapsed");
        mainContentElement.classList.add("sidebar-collapsed");
    }

    // Adiciona lógica para destacar item ativo baseado na URL (simplificado)
    const currentPage = window.location.pathname.split('/').pop();
    const currentHash = window.location.hash;
    const menuItems = sidebarElement.querySelectorAll('.sidebar-menu a');

    menuItems.forEach(item => {
        const itemHref = item.getAttribute('href');
        const itemTargetSection = item.dataset.targetSection;
        let isActive = false;

        if (itemHref === currentPage) {
            // Verifica se a seção corresponde ao hash (para admin-dashboard)
            if (currentPage === 'admin-dashboard.html') {
                if ((!currentHash || currentHash === '#') && item.id === 'nav-painel-admin') {
                     // Link 'Painel Admin' sem hash ou com hash vazio
                     // Não faz nada aqui, pois o admin.js cuidará disso
                } else if (currentHash === '#gerenciar-usuarios' && item.id === 'nav-gerenciar-usuarios') {
                    isActive = true;
                } else if (currentHash === '#listar-usuarios' && item.id === 'nav-listar-usuarios') {
                    isActive = true;
                }
            } else {
                 isActive = true; // Para outras páginas como clientes-dashboard.html
            }
        } else if (currentPage === 'admin-dashboard.html' && itemHref.startsWith('admin-dashboard.html#')) {
             // Lógica específica para admin-dashboard com hash
             const hashTarget = itemHref.split('#')[1];
             if (currentHash === `#${hashTarget}`) {
                 isActive = true;
             }
        }


        if (isActive) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
     // Garante que o 'Painel Admin' esteja ativo se nenhuma outra seção estiver no admin-dashboard
    if (currentPage === 'admin-dashboard.html' && !sidebarElement.querySelector('.sidebar-menu a.active')) {
        const painelAdminLink = sidebarElement.querySelector('#nav-painel-admin');
        if(painelAdminLink) painelAdminLink.classList.add('active');
    }
}

// Função para injetar e inicializar a Sidebar
function injectSidebarIfAdmin(mainContentElementId) {
    if (sessionStorage.getItem("nivel") === "admin") {
        const mainContentElement = document.getElementById(mainContentElementId);
        if (!mainContentElement) {
            console.error(`Elemento com ID '${mainContentElementId}' não encontrado para injetar a sidebar.`);
            return;
        }

        // Injeta o CSS
        injectSidebarCSS();

        const sidebarHTML = createAdminSidebarHTML();
        // Insere a sidebar no início do body
        document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        const sidebarElement = document.getElementById('sidebar');

        if (sidebarElement) {
            initializeSidebar(sidebarElement, mainContentElement);
        } else {
             console.error("Sidebar element not found after injection.");
        }
    }
}

// Exporta a função principal a ser usada em outras páginas
export { injectSidebarIfAdmin };

