// MithraSF Client Portal - Shared Layout Logic

// Initialize Supabase (Global)
// Replace with your actual keys if needed for client-side logic
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
let supabase;

if (typeof supabase !== 'undefined') {
    // Check if supabase is already initialized or if the library is loaded
    if (window.supabase && window.supabase.createClient) {
         supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Sidebar HTML if not present
    const sidebarContainer = document.getElementById('sidebar-container');
    
    // Determine base path for links (handle subdirectories)
    const isSubDir = window.location.pathname.includes('/ferramentas/');
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
        // Simple check: if current path contains the href (ignoring ../)
        const href = item.getAttribute('href').replace('../', '');
        if (currentPath.includes(href) && href !== '') {
            item.classList.add('active');
        } else if (currentPath.endsWith('/') && href === 'index.html') {
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
                if (supabase) {
                    // Clear Supabase session
                    const { error } = await supabase.auth.signOut();
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
    // In a real app, you'd verify the token with the server.
    // Here we just check if the user is logged in via Supabase client.
    if (supabase) {
        checkAuth();
    }
});

async function checkAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            // Redirect to login if not authenticated
            // window.location.href = '/login-cliente.html'; 
            // Commented out for development testing, uncomment for production
        }
    } catch (e) {
        console.log("Auth check skipped or failed", e);
    }
}
