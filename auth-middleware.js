// auth-middleware.js - Sistema de Autenticação e Segurança
// Este arquivo contém funções para verificar autenticação e proteger páginas

/**
 * Verifica se o usuário está autenticado
 * @returns {boolean} true se autenticado, false caso contrário
 */
function verificarAutenticacao() {
    const usuario = sessionStorage.getItem('usuario');
    const nivel = sessionStorage.getItem('nivel');
    const userId = sessionStorage.getItem('user_id');
    
    if (!usuario || !nivel || !userId) {
        return false;
    }
    
    return true;
}

/**
 * Verifica se o usuário tem permissão para acessar um projeto específico
 * @param {string} projetoRequerido - Nome do projeto requerido
 * @returns {boolean} true se tem permissão, false caso contrário
 */
function verificarPermissaoProjeto(projetoRequerido) {
    const nivel = sessionStorage.getItem('nivel');
    const projeto = sessionStorage.getItem('projeto');
    
    // Admin tem acesso a tudo
    if (nivel === 'admin') {
        return true;
    }
    
    // Usuário deve ter o projeto específico
    if (nivel === 'usuario' && projeto === projetoRequerido) {
        return true;
    }
    
    return false;
}

/**
 * Verifica se o usuário tem acesso a um cliente específico
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<boolean>} true se tem acesso, false caso contrário
 */
async function verificarAcessoCliente(clienteId) {
    try {
        const userId = sessionStorage.getItem('user_id');
        const nivel = sessionStorage.getItem('nivel');
        
        if (!userId || !nivel) {
            return false;
        }
        
        // Admin tem acesso a todos os clientes
        if (nivel === 'admin') {
            return true;
        }
        
        // Importar supabase dinamicamente
        const { supabase } = await import('./supabase.js');
        
        // Verificar se o cliente pertence ao usuário
        const { data: cliente, error } = await supabase
            .from('clientes')
            .select('created_by_id, projeto')
            .eq('id', clienteId)
            .single();
        
        if (error || !cliente) {
            console.error('Erro ao verificar acesso ao cliente:', error);
            return false;
        }
        
        // Verificar se o usuário criou o cliente ou tem o mesmo projeto
        const projeto = sessionStorage.getItem('projeto');
        return cliente.created_by_id === userId || cliente.projeto === projeto;
        
    } catch (error) {
        console.error('Erro na verificação de acesso ao cliente:', error);
        return false;
    }
}

/**
 * Redireciona para login se não autenticado
 * @param {string} mensagem - Mensagem a ser exibida
 */
function redirecionarParaLogin(mensagem = 'Acesso negado. Faça login para continuar.') {
    alert(mensagem);
    window.location.href = 'index.html';
}

/**
 * Protege uma página inteira - deve ser chamada no início do carregamento
 * @param {string} projetoRequerido - Projeto necessário para acessar a página (opcional)
 */
function protegerPagina(projetoRequerido = null) {
    // Verificar autenticação básica
    if (!verificarAutenticacao()) {
        redirecionarParaLogin('Você precisa estar logado para acessar esta página.');
        return false;
    }
    
    // Verificar permissão de projeto se especificado
    if (projetoRequerido && !verificarPermissaoProjeto(projetoRequerido)) {
        redirecionarParaLogin(`Acesso negado. Esta página é restrita ao projeto ${projetoRequerido}.`);
        return false;
    }
    
    return true;
}

/**
 * Protege acesso a diagnóstico via link único
 * @param {string} linkUnico - Link único do diagnóstico
 * @returns {Promise<boolean>} true se pode acessar, false caso contrário
 */
async function protegerDiagnostico(linkUnico) {
    try {
        // Verificar autenticação básica
        if (!verificarAutenticacao()) {
            redirecionarParaLogin('Você precisa estar logado para acessar este diagnóstico.');
            return false;
        }
        
        // Importar supabase dinamicamente
        const { supabase } = await import('./supabase.js');
        
        // Buscar diagnóstico e cliente associado
        const { data: diagnostico, error } = await supabase
            .from('diagnosticos_financeiros')
            .select(`
                id,
                cliente_id,
                created_by_id,
                expires_at,
                clientes (
                    id,
                    projeto,
                    created_by_id
                )
            `)
            .eq('link_unico', linkUnico)
            .single();
        
        if (error || !diagnostico) {
            console.error('Diagnóstico não encontrado:', error);
            redirecionarParaLogin('Diagnóstico não encontrado ou link inválido.');
            return false;
        }
        
        // Verificar se o link expirou (se o campo exists_at existir)
        if (diagnostico.expires_at) {
            const agora = new Date();
            const expiracao = new Date(diagnostico.expires_at);
            
            if (agora > expiracao) {
                redirecionarParaLogin('Este link de diagnóstico expirou. Solicite um novo link.');
                return false;
            }
        }
        
        // Verificar se o usuário tem acesso ao cliente
        const temAcesso = await verificarAcessoCliente(diagnostico.cliente_id);
        
        if (!temAcesso) {
            redirecionarParaLogin('Você não tem permissão para acessar este diagnóstico.');
            return false;
        }
        
        // Registrar acesso para auditoria
        await registrarAcessoDiagnostico(diagnostico.id, linkUnico);
        
        return true;
        
    } catch (error) {
        console.error('Erro ao proteger diagnóstico:', error);
        redirecionarParaLogin('Erro ao verificar permissões. Tente novamente.');
        return false;
    }
}

/**
 * Protege acesso a formulário via token único
 * @param {string} tokenUnico - Token único do formulário
 * @returns {Promise<boolean>} true se pode acessar, false caso contrário
 */
async function protegerFormulario(tokenUnico) {
    try {
        // Verificar autenticação básica
        if (!verificarAutenticacao()) {
            redirecionarParaLogin('Você precisa estar logado para acessar este formulário.');
            return false;
        }
        
        // Importar supabase dinamicamente
        const { supabase } = await import('./supabase.js');
        
        // Buscar formulário e cliente associado
        const { data: formulario, error } = await supabase
            .from('formularios_clientes')
            .select(`
                id,
                cliente_id,
                created_by_id,
                expires_at,
                clientes (
                    id,
                    projeto,
                    created_by_id
                )
            `)
            .eq('token_unico', tokenUnico)
            .single();
        
        if (error || !formulario) {
            console.error('Formulário não encontrado:', error);
            redirecionarParaLogin('Formulário não encontrado ou token inválido.');
            return false;
        }
        
        // Verificar se o token expirou (se o campo exists_at existir)
        if (formulario.expires_at) {
            const agora = new Date();
            const expiracao = new Date(formulario.expires_at);
            
            if (agora > expiracao) {
                redirecionarParaLogin('Este link de formulário expirou. Solicite um novo link.');
                return false;
            }
        }
        
        // Verificar se o usuário tem acesso ao cliente
        const temAcesso = await verificarAcessoCliente(formulario.cliente_id);
        
        if (!temAcesso) {
            redirecionarParaLogin('Você não tem permissão para acessar este formulário.');
            return false;
        }
        
        // Registrar acesso para auditoria
        await registrarAcessoFormulario(formulario.id, tokenUnico);
        
        return true;
        
    } catch (error) {
        console.error('Erro ao proteger formulário:', error);
        redirecionarParaLogin('Erro ao verificar permissões. Tente novamente.');
        return false;
    }
}

/**
 * Registra acesso a diagnóstico para auditoria
 * @param {string} diagnosticoId - ID do diagnóstico
 * @param {string} linkUnico - Link único usado
 */
async function registrarAcessoDiagnostico(diagnosticoId, linkUnico) {
    try {
        const { supabase } = await import('./supabase.js');
        const userId = sessionStorage.getItem('user_id');
        const usuario = sessionStorage.getItem('usuario');
        
        await supabase
            .from('logs_acesso_diagnostico')
            .insert({
                diagnostico_id: diagnosticoId,
                link_unico: linkUnico,
                user_id: userId,
                usuario: usuario,
                ip_address: await obterIP(),
                user_agent: navigator.userAgent,
                accessed_at: new Date().toISOString()
            });
            
    } catch (error) {
        console.error('Erro ao registrar acesso ao diagnóstico:', error);
        // Não bloquear o acesso por erro de log
    }
}

/**
 * Registra acesso a formulário para auditoria
 * @param {string} formularioId - ID do formulário
 * @param {string} tokenUnico - Token único usado
 */
async function registrarAcessoFormulario(formularioId, tokenUnico) {
    try {
        const { supabase } = await import('./supabase.js');
        const userId = sessionStorage.getItem('user_id');
        const usuario = sessionStorage.getItem('usuario');
        
        await supabase
            .from('logs_acesso_formulario')
            .insert({
                formulario_id: formularioId,
                token_unico: tokenUnico,
                user_id: userId,
                usuario: usuario,
                ip_address: await obterIP(),
                user_agent: navigator.userAgent,
                accessed_at: new Date().toISOString()
            });
            
    } catch (error) {
        console.error('Erro ao registrar acesso ao formulário:', error);
        // Não bloquear o acesso por erro de log
    }
}

/**
 * Obtém o IP do usuário (melhor esforço)
 * @returns {Promise<string>} IP do usuário ou 'unknown'
 */
async function obterIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        return 'unknown';
    }
}

/**
 * Gera token seguro para links
 * @returns {string} Token seguro
 */
function gerarTokenSeguro() {
    // Usar crypto.randomUUID se disponível, senão fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback mais seguro que Math.random()
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Último recurso - melhor que Math.random() mas não ideal
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula data de expiração para links
 * @param {number} diasValidade - Número de dias de validade (padrão: 30)
 * @returns {string} Data de expiração em formato ISO
 */
function calcularDataExpiracao(diasValidade = 30) {
    const agora = new Date();
    agora.setDate(agora.getDate() + diasValidade);
    return agora.toISOString();
}

// Exportar funções para uso em outros arquivos
window.AuthMiddleware = {
    verificarAutenticacao,
    verificarPermissaoProjeto,
    verificarAcessoCliente,
    redirecionarParaLogin,
    protegerPagina,
    protegerDiagnostico,
    protegerFormulario,
    gerarTokenSeguro,
    calcularDataExpiracao
};

// Para compatibilidade com imports ES6
export {
    verificarAutenticacao,
    verificarPermissaoProjeto,
    verificarAcessoCliente,
    redirecionarParaLogin,
    protegerPagina,
    protegerDiagnostico,
    protegerFormulario,
    gerarTokenSeguro,
    calcularDataExpiracao
};

