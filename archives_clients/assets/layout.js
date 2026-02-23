// HV Saude Financeira Client Portal - Shared Layout Logic
// Wrapped in an IIFE to prevent global scope pollution and conflicts
(function() {
    // Initialize Supabase (Global but scoped to this closure or window property if needed)
    const supabaseUrl = 'YOUR_SUPABASE_URL';
    const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
    let localSupabaseClient = null;

    // Safe initialization
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
            // Check if we already have a client to avoid re-creating
            if (!window.mithraSupabaseClient) {
                window.mithraSupabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
            }
            localSupabaseClient = window.mithraSupabaseClient;
        } catch (e) {
            console.warn('Supabase initialization failed:', e);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        // 1. Inject Sidebar HTML if not present
        const sidebarContainer = document.getElementById('sidebar-container');
        
        // Determine base path for links (handle subdirectories)
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        // Check if we are inside 'ferramentas' directory but NOT on the main 'ferramentas.html' page
        const isSubDir = pathSegments.includes('ferramentas') && !window.location.pathname.endsWith('ferramentas.html');
        const basePath = isSubDir ? '../' : '';

        if (sidebarContainer) {
            sidebarContainer.innerHTML = `
                <div class="sidebar-header">
                    <img src="${basePath}assets/logo.png" alt="HV Logo" class="logo-img">
                    <div class="logo-text">HV Saude Financeira</div>
                </div>
                <nav class="sidebar-nav">
                    <a href="${basePath}index.html" class="nav-item" id="nav-home">
                        <i>🏠</i> Início
                    </a>
                    <a href="${basePath}ferramentas.html" class="nav-item" id="nav-tools">
                        <i>🛠️</i> Ferramentas
                    </a>
                    <a href="${basePath}plano.html" class="nav-item" id="nav-plan">
                        <i>📄</i> Plano de Referência
                    </a>
                    <a href="${basePath}ajuda.html" class="nav-item" id="nav-help">
                        <i>❓</i> Preciso de Algo
                    </a>
                </nav>
                <div class="sidebar-footer">
                    <button id="logout-btn" class="logout-btn">
                        <i>🚪</i> Sair
                    </button>
                </div>
            `;
        }

        // 2. Highlight Active Menu Item
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            const href = item.getAttribute('href').replace('../', '');
            // Check if current path ends with the href
            if (currentPath.endsWith(href) && href !== '') {
                item.classList.add('active');
            } else if ((currentPath.endsWith('/') || currentPath.endsWith('/archives_clients/')) && href === 'index.html') {
                 item.classList.add('active');
            }
        });

        // 3. Mobile Toggle Logic
        const mobileToggle = document.getElementById('mobile-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }

        // 4. Logout Logic
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    if (localSupabaseClient) {
                        const { error } = await localSupabaseClient.auth.signOut();
                        if (error) throw error;
                    }
                    window.location.href = basePath + 'login-cliente.html';
                } catch (error) {
                    console.error('Error logging out:', error);
                    alert('Erro ao sair. Tente novamente.');
                }
            });
        }

        // 5. Check Authentication
        if (localSupabaseClient) {
            checkAuth(localSupabaseClient);
        }
    });

    async function checkAuth(client) {
        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) {
                // Redirect logic here if needed
            }
        } catch (e) {
            console.log("Auth check skipped or failed", e);
        }
    }
})();
