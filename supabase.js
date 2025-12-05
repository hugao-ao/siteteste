// supabase.js - Configuração do Supabase (VERSÃO CORRIGIDA)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações do projeto Supabase
const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

// Criar cliente Supabase com configurações otimizadas
let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Configurações do Supabase não encontradas');
    }
    
    // Configurações otimizadas para o Supabase
    const options = {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        db: {
            schema: 'public'
        },
        global: {
            headers: {
                'X-Client-Info': 'supabase-js-web'
            }
        }
    };
    
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
    
    console.log('✅ Supabase inicializado com sucesso');
    
    // Teste de conectividade
    supabase.from('funcoes_hvc').select('count', { count: 'exact', head: true })
        .then(({ error }) => {
            if (error) {
                console.warn('⚠️ Aviso: Problema de conectividade com Supabase:', error.message);
            } else {
                console.log('✅ Conectividade com Supabase confirmada');
            }
        })
        .catch(err => {
            console.warn('⚠️ Teste de conectividade falhou:', err.message);
        });
    
} catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    
    // Criar um objeto mock para evitar erros
    supabase = {
        from: (table) => ({
            select: (columns) => {
                console.warn(`Mock: SELECT ${columns || '*'} FROM ${table}`);
                return Promise.resolve({ data: [], error: new Error('Supabase não inicializado') });
            },
            insert: (data) => {
                console.warn(`Mock: INSERT INTO ${table}`, data);
                return Promise.resolve({ data: null, error: new Error('Supabase não inicializado') });
            },
            update: (data) => {
                console.warn(`Mock: UPDATE ${table}`, data);
                return Promise.resolve({ data: null, error: new Error('Supabase não inicializado') });
            },
            delete: () => {
                console.warn(`Mock: DELETE FROM ${table}`);
                return Promise.resolve({ data: null, error: new Error('Supabase não inicializado') });
            },
            eq: function(column, value) { 
                console.warn(`Mock: WHERE ${column} = ${value}`);
                return this; 
            },
            order: function(column, options) { 
                console.warn(`Mock: ORDER BY ${column}`, options);
                return this; 
            },
            single: function() { 
                console.warn('Mock: SINGLE');
                return this; 
            },
            maybeSingle: function() { 
                console.warn('Mock: MAYBE SINGLE');
                return this; 
            },
            like: function(column, pattern) { 
                console.warn(`Mock: WHERE ${column} LIKE ${pattern}`);
                return this; 
            }
        }),
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            signIn: () => Promise.resolve({ data: null, error: new Error('Supabase não inicializado') }),
            signOut: () => Promise.resolve({ error: null })
        }
    };
}

// Função para verificar se o Supabase está funcionando
window.testSupabaseConnection = async function() {
    try {
        const { data, error } = await supabase.from('funcoes_hvc').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('❌ Erro na conexão:', error);
            return false;
        }
        console.log('✅ Conexão com Supabase OK');
        return true;
    } catch (err) {
        console.error('❌ Erro no teste:', err);
        return false;
    }
};

export { supabase };
export default supabase;

// Expor globalmente para compatibilidade
window.supabaseClient = supabase;
window.supabase = supabase;

// Log de inicialização
console.log('📦 Módulo Supabase carregado');
