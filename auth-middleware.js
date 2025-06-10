// auth-middleware.js - Sistema de Autenticação e Segurança (VERSÃO FINAL CORRIGIDA)
// Este arquivo contém funções para verificar autenticação e proteger páginas

/**
 * Verifica se o usuário está autenticado
 * @returns {boolean} true se autenticado, false caso contrário
 */
function verificarAutenticacao() {
    // Verificar tanto sessionStorage quanto localStorage para compatibilidade entre abas
    const usuario = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
    const nivel = sessionStorage.getItem('nivel') || localStorage.getItem('nivel');
    const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
    
    if (!usuario || !nivel || !userId) {
        return false;
    }
    
    // Se encontrou no localStorage mas não no sessionStorage, sincronizar
    if (!sessionStorage.getItem('usuario') && localStorage.getItem('usuario')) {
        sincronizarDadosLogin();
    }
    
    return true;
}

/**
 * Sincroniza dados de login entre localStorage e sessionStorage
 */
function sincronizarDadosLogin() {
    const dadosLogin = ['usuario', 'nivel', 'projeto', 'user_id', 'id'];
    
    dadosLogin.forEach(chave => {
        const valor = localStorage.getItem(chave);
        if (valor) {
            sessionStorage.setItem(chave, valor);
        }
    });
}

/**
 * Salva dados de login em ambos os storages
 * @param {Object} dados - Dados do usuário logado
 */
function salvarDadosLogin(dados) {
    const { usuario, nivel, projeto, user_id, id } = dados;
    
    // Salvar em sessionStorage (aba atual)
    sessionStorage.setItem('usuario', usuario);
    sessionStorage.setItem('nivel', nivel);
    sessionStorage.setItem('projeto', projeto || '');
    sessionStorage.setItem('user_id', user_id);
    sessionStorage.setItem('id', id || user_id);
    
    // Salvar em localStorage (compartilhado entre abas)
    localStorage.setItem('usuario', usuario);
    localStorage.setItem('nivel', nivel);
    localStorage.setItem('projeto', projeto || '');
    localStorage.setItem('user_id', user_id);
    localStorage.setItem('id', id || user_id);
}

/**
 * Limpa dados de login de ambos os storages
 */
function limparDadosLogin() {
    const dadosLogin = ['usuario', 'nivel', 'projeto', 'user_id', 'id'];
    
    dadosLogin.forEach(chave => {
        sessionStorage.removeItem(chave);
        localStorage.removeItem(chave);
    });
}

/**
 * Verifica se o usuário tem permissão para acessar um projeto específico
 * @param {string} projetoRequerido - Nome do projeto requerido
 * @returns {boolean} true se tem permissão, false caso contrário
 */
function verificarPermissaoProjeto(projetoRequerido) {
    const nivel = sessionStorage.getItem('nivel') || localStorage.getItem('nivel');
    const projeto = sessionStorage.getItem('projeto') || localStorage.getItem('projeto');
    
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
        const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
        const nivel = sessionStorage.getItem('nivel') || localStorage.getItem('nivel');
        
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
        const projeto = sessionStorage.getItem('projeto') || localStorage.getItem('projeto');
        return cliente.created_by_id === userId || cliente.projeto === projeto;
        
    } catch (error) {
        console.error('Erro na verificação de acesso ao cliente:', error);
        return false;
    }
}

/**
 * Redireciona para login com informações do link atual
 * @param {string} mensagem - Mensagem a ser exibida
 */
function redirecionarParaLogin(mensagem = 'Acesso negado. Faça login para continuar.') {
    // Salvar URL atual para redirecionamento após login
    const urlAtual = window.location.href;
    localStorage.setItem('redirect_after_login', urlAtual);
    
    alert(mensagem);
    window.location.href = 'index.html';
}

/**
 * Verifica se há redirecionamento pendente após login
 */
function verificarRedirecionamentoPendente() {
    const redirectUrl = localStorage.getItem('redirect_after_login');
    if (redirectUrl && verificarAutenticacao()) {
        localStorage.removeItem('redirect_after_login');
        window.location.href = redirectUrl;
        return true;
    }
    return false;
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
        
        // Registrar acesso para auditoria (se as tabelas existirem)
        try {
            await registrarAcessoDiagnostico(diagnostico.id, linkUnico);
        } catch (logError) {
            console.warn('Erro ao registrar log de acesso:', logError);
            // Não bloquear o acesso por erro de log
        }
        
        return true;
        
    } catch (error) {
        console.error('Erro ao proteger diagnóstico:', error);
        redirecionarParaLogin('Erro ao verificar permissões. Tente novamente.');
        return false;
    }
}

/**
 * Protege acesso a formulário via token único - VERSÃO FLEXÍVEL
 * @param {string} tokenUnico - Token único do formulário
 * @returns {Promise<boolean>} true se pode acessar, false caso contrário
 */
async function protegerFormulario(tokenUnico) {
    try {
        // MUDANÇA: Permitir acesso a formulários mesmo sem login
        // Formulários são preenchidos pelos clientes, não pelos usuários do sistema
        
        // Importar supabase dinamicamente
        const { supabase } = await import('./supabase.js');
        
        // Verificar se o token existe e é válido
        const { data: formulario, error } = await supabase
            .from('formularios_clientes')
            .select(`
                id,
                cliente_id,
                status,
                expires_at
            `)
            .eq('token_unico', tokenUnico)
            .single();
        
        if (error || !formulario) {
            console.error('Formulário não encontrado:', error);
            // Não redirecionar para login, apenas retornar false
            return false;
        }
        
        // Verificar se o token expirou (se o campo exists_at existir)
        if (formulario.expires_at) {
            const agora = new Date();
            const expiracao = new Date(formulario.expires_at);
            
            if (agora > expiracao) {
                console.error('Token de formulário expirado');
                return false;
            }
        }
        
        // Registrar acesso para auditoria (se as tabelas existirem e usuário estiver logado)
        try {
            const usuarioLogado = verificarAutenticacao();
            if (usuarioLogado) {
                await registrarAcessoFormulario(formulario.id, tokenUnico);
            }
        } catch (logError) {
            console.warn('Erro ao registrar log de acesso:', logError);
            // Não bloquear o acesso por erro de log
        }
        
        return true;
        
    } catch (error) {
        console.error('Erro ao proteger formulário:', error);
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
        const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
        const usuario = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
        
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
        const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
        const usuario = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
        
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
    calcularDataExpiracao,
    salvarDadosLogin,
    limparDadosLogin,
    sincronizarDadosLogin,
    verificarRedirecionamentoPendente
};

// Para compatibilidade com imports ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        verificarAutenticacao,
        verificarPermissaoProjeto,
        verificarAcessoCliente,
        redirecionarParaLogin,
        protegerPagina,
        protegerDiagnostico,
        protegerFormulario,
        gerarTokenSeguro,
        calcularDataExpiracao,
        salvarDadosLogin,
        limparDadosLogin,
        sincronizarDadosLogin,
        verificarRedirecionamentoPendente
    };
}

