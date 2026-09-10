// auth-middleware.js - Sistema de Autenticação e Segurança (VERSÃO CORRIGIDA)
// CÓPIA v2 (pasta diagnostico/): idêntica à da raiz, exceto redirecionarParaLogin,
// que aponta para '../index.html' porque esta pasta fica um nível abaixo da tela
// de login. A versão da raiz NÃO deve ser alterada.

// Sistema de Autenticação e Middleware de Segurança
window.AuthMiddleware = {
    // Verificar se o usuário está autenticado
    verificarAutenticacao() {
        // Verificar APENAS sessionStorage - sem fallback para localStorage
        const usuario = sessionStorage.getItem('usuario');
        const nivel = sessionStorage.getItem('nivel');
        
        const logado = !!(usuario && nivel);
        
        console.log('🔍 Verificação de autenticação (APENAS sessionStorage):', {
            usuario: usuario,
            nivel: nivel,
            resultado: logado ? 'LOGADO' : 'NÃO LOGADO'
        });
        
        return logado;
    },

    // Salvar dados de login
    salvarDadosLogin(dados) {
        Object.keys(dados).forEach(key => {
            sessionStorage.setItem(key, dados[key]);
        });
        console.log('✅ Dados de login salvos no sessionStorage');
    },

    // Limpar dados de login
    limparDadosLogin() {
        ['usuario', 'nivel', 'projeto', 'user_id', 'id'].forEach(key => {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        });
        console.log('🗑️ Dados de login limpos');
    },

    // Verificar se há redirecionamento pendente após login
    verificarRedirecionamentoPendente() {
        const redirectUrl = localStorage.getItem('redirect_after_login');
        if (redirectUrl && this.verificarAutenticacao()) {
            localStorage.removeItem('redirect_after_login');
            window.location.href = redirectUrl;
            return true;
        }
        return false;
    },

    // Redirecionar para login com informações do link atual
    redirecionarParaLogin(mensagem = 'Acesso negado. Faça login para continuar.') {
        // Salvar URL atual para redirecionamento após login
        const urlAtual = window.location.href;
        localStorage.setItem('redirect_after_login', urlAtual);
        
        alert(mensagem);
        window.location.href = '../index.html';
    },

    // Verificar permissão de projeto
    verificarPermissaoProjeto(projetoRequerido) {
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
    },

    // Proteger página inteira
    protegerPagina(projetoRequerido = null) {
        // Verificar autenticação básica
        if (!this.verificarAutenticacao()) {
            this.redirecionarParaLogin('Você precisa estar logado para acessar esta página.');
            return false;
        }
        
        // Verificar permissão de projeto se especificado
        if (projetoRequerido && !this.verificarPermissaoProjeto(projetoRequerido)) {
            this.redirecionarParaLogin(`Acesso negado. Esta página é restrita ao projeto ${projetoRequerido}.`);
            return false;
        }
        
        return true;
    },

    // Proteger diagnóstico
    async protegerDiagnostico(linkUnico) {
        if (!this.verificarAutenticacao()) {
            this.redirecionarParaLogin('Você precisa estar logado para acessar este diagnóstico.');
            return false;
        }
        return true;
    }
};

console.log('🛡️ AuthMiddleware carregado com sucesso');

