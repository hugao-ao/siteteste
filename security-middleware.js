// security-middleware.js - Middleware adicional de segurança
import { supabase } from './supabase.js';

/**
 * Cache de permissões para evitar consultas repetidas
 */
class PermissionCache {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
    }
    
    /**
     * Gera chave única para o cache
     */
    generateKey(diagnosticoId, userId) {
        return `${diagnosticoId}_${userId}`;
    }
    
    /**
     * Verifica se existe permissão no cache
     */
    get(diagnosticoId, userId) {
        const key = this.generateKey(diagnosticoId, userId);
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        // Verificar se não expirou
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.permission;
    }
    
    /**
     * Armazena permissão no cache
     */
    set(diagnosticoId, userId, permission) {
        const key = this.generateKey(diagnosticoId, userId);
        this.cache.set(key, {
            permission,
            timestamp: Date.now()
        });
    }
    
    /**
     * Limpa cache específico
     */
    clear(diagnosticoId, userId) {
        const key = this.generateKey(diagnosticoId, userId);
        this.cache.delete(key);
    }
    
    /**
     * Limpa todo o cache
     */
    clearAll() {
        this.cache.clear();
    }
}

// Instância global do cache
const permissionCache = new PermissionCache();

/**
 * Logger de segurança
 */
class SecurityLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100; // Manter apenas os últimos 100 logs
    }
    
    /**
     * Registra tentativa de acesso
     */
    logAccess(diagnosticoId, userId, nivel, hasAccess, reason) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            diagnosticoId,
            userId,
            nivel,
            hasAccess,
            reason,
            userAgent: navigator.userAgent,
            ip: 'client-side' // No client-side não temos acesso ao IP real
        };
        
        this.logs.push(logEntry);
        
        // Manter apenas os últimos logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Log no console para debug
        console.log(`[SECURITY] ${hasAccess ? 'ACESSO PERMITIDO' : 'ACESSO NEGADO'}:`, {
            diagnostico: diagnosticoId,
            usuario: userId,
            motivo: reason
        });
        
        // Enviar log crítico para o servidor (apenas acessos negados)
        if (!hasAccess) {
            this.sendSecurityAlert(logEntry);
        }
    }
    
    /**
     * Envia alerta de segurança para o servidor
     */
    async sendSecurityAlert(logEntry) {
        try {
            // Registrar tentativa de acesso negado no banco
            await supabase
                .from('security_logs')
                .insert({
                    diagnostico_id: logEntry.diagnosticoId,
                    user_id: logEntry.userId,
                    action: 'access_denied',
                    reason: logEntry.reason,
                    user_agent: logEntry.userAgent,
                    created_at: logEntry.timestamp
                });
        } catch (error) {
            console.warn('Erro ao registrar log de segurança:', error);
        }
    }
    
    /**
     * Retorna logs recentes
     */
    getRecentLogs(limit = 10) {
        return this.logs.slice(-limit);
    }
}

// Instância global do logger
const securityLogger = new SecurityLogger();

/**
 * Verificação de permissão com cache
 */
export async function verificarPermissaoComCache(diagnosticoId) {
    const userId = sessionStorage.getItem('user_id');
    const nivel = sessionStorage.getItem('nivel');
    
    if (!userId || !nivel) {
        securityLogger.logAccess(diagnosticoId, null, null, false, 'Usuário não autenticado');
        return { hasAccess: false, reason: 'Usuário não autenticado' };
    }
    
    // Verificar cache primeiro
    const cachedPermission = permissionCache.get(diagnosticoId, userId);
    if (cachedPermission !== null) {
        securityLogger.logAccess(diagnosticoId, userId, nivel, cachedPermission.hasAccess, `${cachedPermission.reason} (cache)`);
        return cachedPermission;
    }
    
    // Se não está no cache, fazer verificação completa
    try {
        const { data: diagnostico, error } = await supabase
            .from('diagnosticos_financeiros')
            .select(`
                id,
                cliente_id,
                created_by_id,
                clientes_hvc (
                    id,
                    nome,
                    assigned_to_user_id,
                    criado_por_id
                )
            `)
            .eq('id', diagnosticoId)
            .single();
        
        if (error || !diagnostico) {
            const result = { hasAccess: false, reason: 'Diagnóstico não encontrado' };
            securityLogger.logAccess(diagnosticoId, userId, nivel, false, result.reason);
            return result;
        }
        
        let result;
        
        // Verificar permissões
        if (nivel === 'admin') {
            result = { hasAccess: true, reason: 'Usuário é administrador' };
        } else if (diagnostico.created_by_id === userId) {
            result = { hasAccess: true, reason: 'Usuário criou o diagnóstico' };
        } else if (diagnostico.clientes_hvc?.assigned_to_user_id === userId) {
            result = { hasAccess: true, reason: 'Usuário está atribuído ao cliente' };
        } else if (diagnostico.clientes_hvc?.criado_por_id === userId) {
            result = { hasAccess: true, reason: 'Usuário criou o cliente' };
        } else if (!diagnostico.clientes_hvc?.assigned_to_user_id) {
            result = { hasAccess: true, reason: 'Cliente não está atribuído a usuário específico' };
        } else {
            result = { hasAccess: false, reason: 'Usuário não tem relação com este cliente' };
        }
        
        // Armazenar no cache
        permissionCache.set(diagnosticoId, userId, result);
        
        // Registrar log
        securityLogger.logAccess(diagnosticoId, userId, nivel, result.hasAccess, result.reason);
        
        return result;
        
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        const result = { hasAccess: false, reason: 'Erro interno do sistema' };
        securityLogger.logAccess(diagnosticoId, userId, nivel, false, result.reason);
        return result;
    }
}

/**
 * Middleware de timeout de sessão
 */
export class SessionManager {
    constructor() {
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutos
        this.warningTimeout = 25 * 60 * 1000; // 25 minutos (aviso 5 min antes)
        this.lastActivity = Date.now();
        this.timeoutId = null;
        this.warningId = null;
        
        this.setupActivityListeners();
        this.resetTimeout();
    }
    
    /**
     * Configura listeners para detectar atividade do usuário
     */
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateActivity();
            }, true);
        });
    }
    
    /**
     * Atualiza timestamp da última atividade
     */
    updateActivity() {
        this.lastActivity = Date.now();
        this.resetTimeout();
    }
    
    /**
     * Reseta os timeouts de sessão
     */
    resetTimeout() {
        // Limpar timeouts existentes
        if (this.timeoutId) clearTimeout(this.timeoutId);
        if (this.warningId) clearTimeout(this.warningId);
        
        // Configurar aviso de expiração
        this.warningId = setTimeout(() => {
            this.showSessionWarning();
        }, this.warningTimeout);
        
        // Configurar expiração da sessão
        this.timeoutId = setTimeout(() => {
            this.expireSession();
        }, this.sessionTimeout);
    }
    
    /**
     * Mostra aviso de expiração de sessão
     */
    showSessionWarning() {
        const continuar = confirm(
            'Sua sessão expirará em 5 minutos devido à inatividade.\n\n' +
            'Clique em "OK" para continuar ou "Cancelar" para fazer logout.'
        );
        
        if (continuar) {
            this.updateActivity(); // Renovar sessão
        } else {
            this.expireSession();
        }
    }
    
    /**
     * Expira a sessão e redireciona para login
     */
    expireSession() {
        alert('Sua sessão expirou devido à inatividade. Você será redirecionado para o login.');
        
        // Limpar dados da sessão
        sessionStorage.clear();
        
        // Limpar cache de permissões
        permissionCache.clearAll();
        
        // Redirecionar para login
        window.location.href = 'index.html';
    }
}

/**
 * Verificador de integridade da sessão
 */
export async function verificarIntegridadeSessao() {
    const userId = sessionStorage.getItem('user_id');
    const usuario = sessionStorage.getItem('usuario');
    const nivel = sessionStorage.getItem('nivel');
    
    if (!userId || !usuario || !nivel) {
        return false;
    }
    
    try {
        // Verificar se o usuário ainda existe e está ativo
        const { data: user, error } = await supabase
            .from('credenciais')
            .select('id, usuario, nivel, ativo')
            .eq('id', userId)
            .eq('usuario', usuario)
            .single();
        
        if (error || !user || !user.ativo) {
            // Usuário não existe ou foi desativado
            sessionStorage.clear();
            return false;
        }
        
        // Verificar se o nível de acesso mudou
        if (user.nivel !== nivel) {
            // Atualizar nível na sessão
            sessionStorage.setItem('nivel', user.nivel);
            
            // Limpar cache de permissões pois o nível mudou
            permissionCache.clearAll();
        }
        
        return true;
        
    } catch (error) {
        console.error('Erro ao verificar integridade da sessão:', error);
        return false;
    }
}

/**
 * Função para limpar cache quando necessário
 */
export function limparCachePermissoes() {
    permissionCache.clearAll();
    console.log('Cache de permissões limpo');
}

/**
 * Função para obter estatísticas de segurança
 */
export function obterEstatisticasSeguranca() {
    const logs = securityLogger.getRecentLogs(50);
    
    const stats = {
        totalAcessos: logs.length,
        acessosPermitidos: logs.filter(log => log.hasAccess).length,
        acessosNegados: logs.filter(log => !log.hasAccess).length,
        cacheSize: permissionCache.cache.size,
        ultimaAtividade: new Date(sessionManager.lastActivity).toLocaleString()
    };
    
    return stats;
}

// Inicializar gerenciador de sessão automaticamente
let sessionManager;
if (typeof window !== 'undefined') {
    sessionManager = new SessionManager();
}

// Exportar instâncias para uso externo
export { permissionCache, securityLogger, sessionManager };

