// HV Saude Financeira Client Portal - Shared Layout Logic
// Wrapped in an IIFE to prevent global scope pollution and conflicts
(function() {
    // Initialize Supabase (Global but scoped to this closure or window property if needed)
    // NOTE: Replace these with your actual Supabase URL and Key when ready.
    // If invalid, the script will gracefully skip Supabase initialization to prevent errors.
    const supabaseUrl = 'YOUR_SUPABASE_URL';
    const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
    let localSupabaseClient = null;

    // Safe initialization
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
            // Only attempt to create client if URL is valid (not the placeholder)
            if (supabaseUrl !== 'YOUR_SUPABASE_URL' && supabaseUrl.startsWith('http')) {
                if (!window.mithraSupabaseClient) {
                    window.mithraSupabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
                }
                localSupabaseClient = window.mithraSupabaseClient;
            } else {
                console.warn('Supabase URL not configured. Auth features will be disabled.');
            }
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
            // Base64 Logo to prevent 404 errors - Optimized 128x128 PNG
            const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAADAFBMVEUAAAD///8CBAQDBgYFBwcHCAgICQkKCgoLCwsMDAwNDQ0ODg4PDw8QEBARERESEhITExMUFBQVFRUWFhYXFxcYGBgZGRkaGhobGxscHBwdHR0eHh4fHx8gICAhISEiIiIjIyMkJCQlJSUmJiYnJycoKCgpKSkqKiorKyssLCwtLS0uLi4vLy8wMDAxMTEyMjIzMzM0NDQ1NTU2NjY3Nzc4ODg5OTk6Ojo7Ozs8PDw9PT0+Pj4/Pz9AQEBBQUFCQkJDQ0NERERFRUVGRkZHR0dISEhJSUlKSkpLS0tMTExNTU1OTk5PT09QUFBRUVFSUlJTU1NUVFRVVVVWVlZXV1dYWFhZWVlaWlpbW1tcXFxdXV1eXl5fX19gYGBhYWFiYmJjY2NkZGRlZWVmZmZnZ2doaGhpaWlqampra2tsbGxtbW1ubm5vb29wcHBxcXFycnJzc3N0dHR1dXV2dnZ3d3d4eHh5eXl6enp7e3t8fHx9fX1+fn5/f3+AgICBgYGCgoKDg4OEhISFhYWGhoaHh4eIiIiJiYmKioqLi4uMjIyNjY2Ojo6Pj4+QkJCRkZGSkpKTk5OUlJSVlZWWlpaXl5eYmJiZmZmampqbm5ucnJydnZ2enp6fn5+goKChoaGioqKjo6OkpKSlpaWmpqanp6eoqKipqamqqqqrq6usrKytra2urq6vr6+wsLCxsbGysrKzs7O0tLS1tbW2tra3t7e4uLi5ubm6urq7u7u8vLy9vb2+vr6/v7/AwMDBwcHCwsLDw8PExMTFxcXGxsbHx8fIyMjJycnKysrLy8vMzMzNzc3Ozs7Pz8/Q0NDR0dHS0tLT09PU1NTV1dXW1tbX19fY2NjZ2dna2trb29vc3Nzd3d3e3t7f39/g4ODh4eHi4uLj4+Pk5OTl5eXm5ubn5+fo6Ojp6enq6urr6+vs7Ozt7e3u7u7v7+/w8PDx8fHy8vLz8/P09PT19fX29vb39/f4+Pj5+fn6+vr7+/v8/Pz9/f3+/v7///8u58/xAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF+WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4wLWMwMDAgNzkuZGE0YTdlZSwgMjAyMi8xMS8xNy0xNjoyMzo1NiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI0LjEgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjA4RkQzRDUwNzNCMTExRUU5QkQ1QjI2NEQ1N0YzRjVCIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjA4RkQzRDUxNzNCMTExRUU5QkQ1QjI2NEQ1N0YzRjVCIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MDhGRDNENDg3M0IxMTFFRTlCRDVCMjY0RDU3RjNGNUIiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MDhGRDNENDk3M0IxMTFFRTlCRDVCMjY0RDU3RjNGNUIiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6lXJix+OhckQOjJWrNoATcsCwKgUDSk4rwZ1/ewJ7h1MLd1wiFMMvIRLHJf/v6WV79eBzXX1wrqggY6oryf3x5Gy/t75ntB83zKsngHxmWJE9KrhQs/vLNUc60BiFvdm9bO4QkZqg8uj7J4xvSDGYjjJca/PZ0kffOFBmZaVBthpXazY7XBkIE412PDcT4zt4MQ2mDTy7X+KdjJU6FaaxW8vcW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";

            sidebarContainer.innerHTML = `
                <div class="sidebar-header">
                    <div class="logo-container">
                        <img src="${logoBase64}" alt="HV Logo" class="logo-img">
                    </div>
                    <div class="logo-text-container">
                        <span class="logo-title">HV</span>
                        <span class="logo-subtitle">Saúde Financeira</span>
                    </div>
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
                    // Fallback redirect even on error
                    window.location.href = basePath + 'login-cliente.html';
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
