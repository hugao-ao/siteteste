// auth-security.js - Sistema de Controle de Acesso para Diagnósticos
import { supabase } from './supabase.js';

/**
 * Verifica se o usuário atual tem permissão para acessar um diagnóstico específico
 * @param {string} diagnosticoId - ID do diagnóstico a ser verificado
 * @returns {Promise<{hasAccess: boolean, reason: string}>}
 */
export async function verificarPermissaoDiagnostico(diagnosticoId) {
    try {
        // 1. Verificar se o usuário está logado
        const userId = sessionStorage.getItem('user_id');
        const nivel = sessionStorage.getItem('nivel');
        const usuario = sessionStorage.getItem('usuario');
        
        if (!userId || !nivel || !usuario) {
            return {
                hasAccess: false,
                reason: 'Usuário não está logado'
            };
        }
        
        // 2. Se é administrador, tem acesso total
        if (nivel === 'admin') {
            return {
                hasAccess: true,
                reason: 'Usuário é administrador'
            };
        }
        
        // 3. Buscar o diagnóstico e o cliente relacionado
        const { data: diagnostico, error: diagnosticoError } = await supabase
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
        
        if (diagnosticoError || !diagnostico) {
            return {
                hasAccess: false,
                reason: 'Diagnóstico não encontrado'
            };
        }
        
        // 4. Verificar se o usuário tem relação com o cliente
        const cliente = diagnostico.clientes_hvc;
        
        if (!cliente) {
            return {
                hasAccess: false,
                reason: 'Cliente não encontrado'
            };
        }
        
        // 5. Verificar permissões:
        // - Se o usuário criou o diagnóstico
        if (diagnostico.created_by_id === userId) {
            return {
                hasAccess: true,
                reason: 'Usuário criou o diagnóstico'
            };
        }
        
        // - Se o usuário está atribuído ao cliente
        if (cliente.assigned_to_user_id === userId) {
            return {
                hasAccess: true,
                reason: 'Usuário está atribuído ao cliente'
            };
        }
        
        // - Se o usuário criou o cliente
        if (cliente.criado_por_id === userId) {
            return {
                hasAccess: true,
                reason: 'Usuário criou o cliente'
            };
        }
        
        // - Se o cliente não está atribuído a nenhum usuário específico
        if (!cliente.assigned_to_user_id) {
            return {
                hasAccess: true,
                reason: 'Cliente não está atribuído a usuário específico'
            };
        }
        
        // 6. Se chegou até aqui, não tem permissão
        return {
            hasAccess: false,
            reason: 'Usuário não tem relação com este cliente'
        };
        
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        return {
            hasAccess: false,
            reason: 'Erro interno do sistema'
        };
    }
}

/**
 * Verifica se o usuário está autenticado
 * @returns {boolean}
 */
export function verificarAutenticacao() {
    const userId = sessionStorage.getItem('user_id');
    const nivel = sessionStorage.getItem('nivel');
    const usuario = sessionStorage.getItem('usuario');
    
    return !!(userId && nivel && usuario);
}

/**
 * Redireciona para página de login se não estiver autenticado
 */
export function redirecionarSeNaoAutenticado() {
    if (!verificarAutenticacao()) {
        alert('Acesso não autorizado. Faça login primeiro.');
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

/**
 * Mostra página de acesso negado
 * @param {string} motivo - Motivo do acesso negado
 */
export function mostrarAcessoNegado(motivo = 'Você não tem permissão para acessar este conteúdo') {
    document.body.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a4d3a 0%, #0f2e1f 100%);
            color: #f0f8f0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            text-align: center;
            padding: 2rem;
        ">
            <div style="
                background: #1a4d3a;
                padding: 3rem;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                border: 2px solid #2e8b57;
                max-width: 500px;
                width: 100%;
            ">
                <i class="fas fa-lock" style="
                    font-size: 4rem;
                    color: #d4af37;
                    margin-bottom: 1.5rem;
                "></i>
                <h1 style="
                    color: #d4af37;
                    margin-bottom: 1rem;
                    font-size: 2rem;
                ">Acesso Negado</h1>
                <p style="
                    margin-bottom: 2rem;
                    font-size: 1.1rem;
                    line-height: 1.6;
                ">${motivo}</p>
                <button onclick="window.location.href='index.html'" style="
                    background: linear-gradient(135deg, #d4af37, #daa520);
                    color: #1a4d3a;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-right: 1rem;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(212, 175, 55, 0.4)'"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    <i class="fas fa-home"></i> Voltar ao Login
                </button>
                <button onclick="history.back()" style="
                    background: transparent;
                    color: #d4af37;
                    border: 2px solid #d4af37;
                    padding: 1rem 2rem;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#d4af37'; this.style.color='#1a4d3a'"
                   onmouseout="this.style.background='transparent'; this.style.color='#d4af37'">
                    <i class="fas fa-arrow-left"></i> Voltar
                </button>
            </div>
        </div>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    `;
}

/**
 * Extrai o ID do diagnóstico da URL
 * @returns {string|null}
 */
export function extrairIdDiagnosticoDaUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

/**
 * Função principal para proteger página de diagnóstico
 * Deve ser chamada no início do carregamento da página
 */
export async function protegerPaginaDiagnostico() {
    try {
        // 1. Verificar autenticação básica
        if (!redirecionarSeNaoAutenticado()) {
            return false;
        }
        
        // 2. Extrair ID do diagnóstico da URL
        const diagnosticoId = extrairIdDiagnosticoDaUrl();
        
        if (!diagnosticoId) {
            mostrarAcessoNegado('ID do diagnóstico não fornecido na URL');
            return false;
        }
        
        // 3. Verificar permissão específica
        const { hasAccess, reason } = await verificarPermissaoDiagnostico(diagnosticoId);
        
        if (!hasAccess) {
            console.log('Acesso negado:', reason);
            mostrarAcessoNegado('Você não tem permissão para acessar este diagnóstico financeiro');
            return false;
        }
        
        console.log('Acesso autorizado:', reason);
        return true;
        
    } catch (error) {
        console.error('Erro ao proteger página:', error);
        mostrarAcessoNegado('Erro interno do sistema');
        return false;
    }
}

