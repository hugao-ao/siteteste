// supabase.js
// IMPORTANTE: Este arquivo gerencia a conexão com o Supabase.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// URL do seu projeto Supabase.
const supabaseUrl = "https://vbikskbfkhundhropykf.supabase.co";

// Chave anônima (Anon Key) do Supabase.
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

// Verificação para garantir que as variáveis foram preenchidas (embora agora estejam diretamente no código).
if (!supabaseUrl || !supabaseKey) {
  const errorMessage = "ERRO CRÍTICO: As credenciais do Supabase (URL e Chave Anônima) estão ausentes no arquivo 'supabase.js'.";
  console.error(errorMessage);
  alert(errorMessage);
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Log para confirmar a inicialização
console.log("supabase.js: Cliente Supabase inicializado com as credenciais fornecidas.");

