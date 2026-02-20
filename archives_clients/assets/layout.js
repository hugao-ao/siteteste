// MithraSF Client Portal - Shared Layout Logic

// Initialize Supabase (Global)
// Replace with your actual keys if needed for client-side logic
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
let supabaseClient; // Renamed to avoid conflict with global 'supabase' object from CDN

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase if library is loaded
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        try {
            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        } catch (e) {
            console.warn('Supabase initialization failed:', e);
        }
    }

    // 1. Inject Sidebar HTML if not present
    const sidebarContainer = document.getElementById('sidebar-container');
    
    // Determine base path for links (handle subdirectories)
    // If we are in a subdirectory (like /ferramentas/), we need to go up one level
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const isSubDir = pathSegments.includes('ferramentas') && pathSegments.length > 1 && !window.location.pathname.endsWith('ferramentas.html');
    const basePath = isSubDir ? '../' : '';

    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
            <div class="sidebar-header">
                <div class="logo-icon">M</div>
                <div class="logo-text">MithraSF</div>
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
        // Check if current path ends with the href (e.g. /index.html ends with index.html)
        if (currentPath.endsWith(href) && href !== '') {
            item.classList.add('active');
        } else if ((currentPath.endsWith('/') || currentPath.endsWith('/archives_clients/')) && href === 'index.html') {
             item.classList.add('active');
        }
    });

    // 3. Mobile Toggle Logic
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.querySelector('.sidebar'); // Select by class, not ID, as per CSS
    
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
                if (supabaseClient) {
                    // Clear Supabase session
                    const { error } = await supabaseClient.auth.signOut();
                    if (error) throw error;
                }
                
                // Redirect to login page
                window.location.href = basePath + 'login-cliente.html';
            } catch (error) {
                console.error('Error logging out:', error);
                alert('Erro ao sair. Tente novamente.');
            }
        });
    }

    // 5. Check Authentication (Simple Client-Side Check)
    if (supabaseClient) {
        checkAuth();
    }
});

async function checkAuth() {
    try {
        if (!supabaseClient) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            // Redirect to login if not authenticated
            // window.location.href = 'login-cliente.html'; 
            // Commented out for development testing
        }
    } catch (e) {
        console.log("Auth check skipped or failed", e);
    }
}
