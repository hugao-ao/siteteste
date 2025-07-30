// supabase-test.js - Arquivo para testar conectividade com Supabase
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função para testar conectividade
window.testSupabaseConnection = async function() {
    console.log('🧪 Testando conectividade com Supabase...');
    
    try {
        // Teste 1: Verificar se consegue conectar
        console.log('📡 Teste 1: Conectividade básica...');
        const { data: healthCheck, error: healthError } = await supabase
            .from('funcoes_hvc')
            .select('count', { count: 'exact', head: true });
            
        if (healthError) {
            console.error('❌ Erro de conectividade:', healthError);
            return false;
        }
        
        console.log('✅ Conectividade OK');
        
        // Teste 2: Listar todas as funções
        console.log('📋 Teste 2: Carregando funções...');
        const { data: funcoes, error: funcoesError } = await supabase
            .from('funcoes_hvc')
            .select('*')
            .order('nome', { ascending: true });
            
        if (funcoesError) {
            console.error('❌ Erro ao carregar funções:', funcoesError);
            return false;
        }
        
        console.log('✅ Funções carregadas:', funcoes);
        console.log(`📊 Total de funções: ${funcoes?.length || 0}`);
        
        // Teste 3: Verificar estrutura da tabela
        if (funcoes && funcoes.length > 0) {
            console.log('🔍 Estrutura da primeira função:', Object.keys(funcoes[0]));
        }
        
        return true;
        
    } catch (error) {
        console.error('💥 Erro geral:', error);
        return false;
    }
};

// Função melhorada para carregar funções
window.carregarFuncoesSupabase = async function() {
    console.log('🔄 Carregando funções do Supabase...');
    
    try {
        const { data, error } = await supabase
            .from('funcoes_hvc')
            .select('*')
            .order('nome', { ascending: true });
            
        if (error) {
            console.error('❌ Erro ao carregar funções:', error);
            throw error;
        }
        
        console.log('✅ Funções carregadas com sucesso:', data);
        return data || [];
        
    } catch (error) {
        console.error('💥 Erro ao carregar funções:', error);
        return [];
    }
};

// Função para inserir função de teste
window.inserirFuncaoTeste = async function() {
    console.log('➕ Inserindo função de teste...');
    
    try {
        const { data, error } = await supabase
            .from('funcoes_hvc')
            .insert([
                { nome: 'Pedreiro' },
                { nome: 'Eletricista' },
                { nome: 'Encanador' }
            ])
            .select();
            
        if (error) {
            console.error('❌ Erro ao inserir:', error);
            throw error;
        }
        
        console.log('✅ Funções de teste inseridas:', data);
        return data;
        
    } catch (error) {
        console.error('💥 Erro ao inserir funções de teste:', error);
        return null;
    }
};

console.log('🔧 Arquivo supabase-test.js carregado. Use testSupabaseConnection() para testar.');

