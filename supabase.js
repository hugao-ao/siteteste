// supabase.js - Configuração do Supabase (VERSÃO SEM MÓDULOS ES6)

// Configurações do projeto Supabase
const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

// Função para inicializar Supabase
async function initializeSupabase() {
    try {
        // Carregar Supabase via CDN
        if (!window.supabase) {
            console.log('Carregando Supabase...');
            
            // Criar script para carregar Supabase
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@supabase/supabase-js@2';
            script.onload = function() {
                console.log('Supabase CDN carregado');
                createSupabaseClient();
            };
            script.onerror = function() {
                console.error('Erro ao carregar Supabase CDN');
                createMockSupabase();
            };
            document.head.appendChild(script);
        } else {
            createSupabaseClient();
        }
    } catch (error) {
        console.error('Erro ao inicializar Supabase:', error);
        createMockSupabase();
    }
}

// Função para criar cliente Supabase
function createSupabaseClient() {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Configurações do Supabase não encontradas');
        }
        
        // Configurações adicionais
        const options = {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        };
        
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        
        // Expor globalmente
        window.supabaseClient = supabaseClient;
        window.supabase = supabaseClient;
        
        console.log('Supabase inicializado com sucesso');
        
        // Disparar evento personalizado para notificar que Supabase está pronto
        window.dispatchEvent(new CustomEvent('supabaseReady'));
        
    } catch (error) {
        console.error('Erro ao criar cliente Supabase:', error);
        createMockSupabase();
    }
}

// Função para criar mock do Supabase em caso de erro
function createMockSupabase() {
    console.warn('Criando mock do Supabase devido a erro de inicialização');
    
    const mockSupabase = {
        from: () => ({
            select: () => Promise.resolve({ data: [], error: new Error('Supabase não inicializado') }),
            insert: () => Promise.resolve({ data: null, error: new Error('Supabase não inicializado') }),
            update: () => Promise.resolve({ data: null, error: new Error('Supabase não inicializado') }),
            delete: () => Promise.resolve({ data: null, error: new Error('Supabase não inicializado') }),
            eq: function() { return this; },
            order: function() { return this; },
            single: function() { return this; },
            maybeSingle: function() { return this; },
            like: function() { return this; }
        })
    };
    
    window.supabaseClient = mockSupabase;
    window.supabase = mockSupabase;
    
    // Disparar evento mesmo com mock
    window.dispatchEvent(new CustomEvent('supabaseReady'));
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabase);
} else {
    initializeSupabase();
}

