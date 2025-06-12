// supabase.js - Configuração do Supabase (VERSÃO ROBUSTA COM CORS FIX)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Configurações do projeto Supabase
const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

// Criar cliente Supabase com tratamento de erro
let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Configurações do Supabase não encontradas');
    }
    
    // Configurações adicionais para resolver problemas de CORS
    const options = {
        auth: {
            persistSession: true,
            autoRefreshToken: true
        },
        global: {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        }
    };
    
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
    
    console.log('Supabase inicializado com sucesso');
    
    // Adicionar interceptor para todas as requisições
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Adicionar cabeçalhos CORS para todas as requisições
        if (!options.headers) {
            options.headers = {};
        }
        
        options.headers['Access-Control-Allow-Origin'] = '*';
        options.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        options.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        
        return originalFetch(url, options);
    };
    
} catch (error) {
    console.error('Erro ao inicializar Supabase:', error);
    
    // Criar um objeto mock para evitar erros
    supabase = {
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
}

export { supabase };
export default supabase;

