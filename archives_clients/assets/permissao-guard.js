/**
 * permissao-guard.js — Verificação de Permissões de Ferramentas
 * ==============================================================
 * Este script deve ser incluído em CADA ferramenta individual do cliente.
 * Ele verifica na tabela `ferramentas_permissoes` se o cliente tem permissão
 * de edição ou apenas visualização para a ferramenta atual.
 *
 * COMO USAR:
 * 1. Adicione este script na ferramenta ANTES do script principal:
 *    <script src="../assets/permissao-guard.js"></script>
 *    (ou ajuste o caminho conforme necessário)
 *
 * 2. No script principal da ferramenta, defina a variável FERRAMENTA_SLUG:
 *    const FERRAMENTA_SLUG = 'juros'; // slug da ferramenta
 *
 * 3. Chame a função de verificação após o DOM carregar:
 *    await verificarPermissaoFerramenta(FERRAMENTA_SLUG);
 *
 * OU simplesmente inclua este script e ele detectará automaticamente
 * o slug da ferramenta pelo nome do arquivo HTML.
 *
 * COMPORTAMENTO:
 * - Se equipe está acessando como cliente (equipe_modo_cliente=true): 
 *   NÃO bloqueia nada (equipe sempre pode editar)
 * - Se cliente tem modo='edicao_temporaria' e data_expiracao não passou:
 *   NÃO bloqueia nada
 * - Se cliente tem modo='visualizacao' OU edição expirada OU sem registro:
 *   BLOQUEIA edição, mostra mensagem
 */

(function() {
    'use strict';

    // Configuração Supabase
    const SUPABASE_URL = 'https://vbikskbfkhundhropykf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU';

    // Detectar slug da ferramenta pelo nome do arquivo
    function detectarSlug() {
        const path = window.location.pathname;
        const filename = path.split('/').pop().replace('.html', '');
        return filename || null;
    }

    // Verificar se é equipe em modo cliente
    function isEquipeModoCliente() {
        return sessionStorage.getItem('equipe_modo_cliente') === 'true';
    }

    // Obter cliente_id
    function getClienteId() {
        return sessionStorage.getItem('cliente_id') || null;
    }

    // Obter ou criar instância Supabase
    function getSupabase() {
        if (window.mithraSupabaseClient) return window.mithraSupabaseClient;
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        return null;
    }

    // Criar e injetar o modal de bloqueio
    function injetarModalBloqueio() {
        // CSS do modal
        const style = document.createElement('style');
        style.textContent = `
            .permissao-bloqueio-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 99999;
                justify-content: center;
                align-items: center;
                backdrop-filter: blur(3px);
            }
            .permissao-bloqueio-overlay.active {
                display: flex;
            }
            .permissao-bloqueio-modal {
                background: #01221a;
                border: 1px solid rgba(212, 175, 55, 0.3);
                border-radius: 16px;
                padding: 2.5rem;
                max-width: 450px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }
            .permissao-bloqueio-modal .modal-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
            }
            .permissao-bloqueio-modal h3 {
                color: #d4af37;
                font-size: 1.3rem;
                margin: 0 0 1rem 0;
                font-weight: 700;
            }
            .permissao-bloqueio-modal p {
                color: rgba(255, 255, 255, 0.8);
                font-size: 0.95rem;
                line-height: 1.6;
                margin: 0 0 1.5rem 0;
            }
            .permissao-bloqueio-modal .modal-btn {
                padding: 0.7rem 1.5rem;
                background-color: #d4af37;
                color: #000;
                border: none;
                border-radius: 8px;
                font-weight: 700;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .permissao-bloqueio-modal .modal-btn:hover {
                background-color: #c5a028;
            }
            /* Banner fixo de modo visualização */
            .permissao-banner-visualizacao {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                background: linear-gradient(90deg, #d4af37, #c5a028);
                color: #000;
                text-align: center;
                padding: 0.5rem 1rem;
                font-size: 0.85rem;
                font-weight: 600;
                z-index: 99998;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            body.permissao-modo-visualizacao {
                padding-top: 36px !important;
            }
        `;
        document.head.appendChild(style);

        // Modal HTML
        const overlay = document.createElement('div');
        overlay.className = 'permissao-bloqueio-overlay';
        overlay.id = 'permissao-bloqueio-overlay';
        overlay.innerHTML = `
            <div class="permissao-bloqueio-modal">
                <div class="modal-icon">🔒</div>
                <h3>Edição não permitida</h3>
                <p>Esta ferramenta está em modo de visualização. Você pode consultar os dados e gerar PDFs, mas não pode editar, adicionar ou excluir informações.</p>
                <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">Para solicitar liberação de edição, entre em contato com seu consultor financeiro.</p>
                <button class="modal-btn" onclick="document.getElementById('permissao-bloqueio-overlay').classList.remove('active')">Entendi</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Banner fixo
        const banner = document.createElement('div');
        banner.className = 'permissao-banner-visualizacao';
        banner.id = 'permissao-banner-visualizacao';
        banner.textContent = '🔒 Modo Visualização — Edição desabilitada. Contate seu consultor para liberação.';
        banner.style.display = 'none';
        document.body.prepend(banner);
    }

    // Mostrar modal de bloqueio
    function mostrarModalBloqueio() {
        const overlay = document.getElementById('permissao-bloqueio-overlay');
        if (overlay) overlay.classList.add('active');
    }

    // Ativar modo visualização (desabilitar inputs/botões de edição)
    function ativarModoVisualizacao() {
        // Mostrar banner
        const banner = document.getElementById('permissao-banner-visualizacao');
        if (banner) {
            banner.style.display = 'block';
            document.body.classList.add('permissao-modo-visualizacao');
        }

        // Interceptar cliques em botões de ação (adicionar, excluir, salvar)
        // Não desabilitar inputs de cálculo, apenas botões de persistência
        const seletoresBloqueio = [
            'button[class*="save"]', 'button[class*="salvar"]',
            'button[class*="add"]', 'button[class*="adicionar"]',
            'button[class*="delete"]', 'button[class*="excluir"]', 'button[class*="remover"]',
            'button[id*="save"]', 'button[id*="salvar"]',
            'button[id*="add"]', 'button[id*="adicionar"]',
            'button[id*="delete"]', 'button[id*="excluir"]', 'button[id*="remover"]',
            '.btn-save', '.btn-add', '.btn-delete',
            '[data-action="save"]', '[data-action="add"]', '[data-action="delete"]'
        ];

        // Usar MutationObserver para capturar botões adicionados dinamicamente
        function bloquearBotoes() {
            const botoes = document.querySelectorAll(seletoresBloqueio.join(', '));
            botoes.forEach(btn => {
                if (btn.dataset.permissaoBloqueado) return;
                btn.dataset.permissaoBloqueado = 'true';
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    mostrarModalBloqueio();
                    return false;
                }, true); // useCapture = true para interceptar antes de outros handlers
            });
        }

        // Bloquear botões existentes
        bloquearBotoes();

        // Observer para botões futuros
        const observer = new MutationObserver(function() {
            bloquearBotoes();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Interceptar funções de persistência no Supabase
        // Sobrescrever upsert/insert/update/delete para mostrar modal
        window._permissaoModoVisualizacao = true;
    }

    // Função principal de verificação
    async function verificarPermissao(slug) {
        // Se é equipe acessando como cliente, não bloquear
        if (isEquipeModoCliente()) {
            console.log('[Permissão] Equipe em modo cliente - edição liberada');
            return;
        }

        const clienteId = getClienteId();
        if (!clienteId) {
            console.log('[Permissão] Sem cliente_id - sem verificação');
            return;
        }

        const ferramentaSlug = slug || detectarSlug();
        if (!ferramentaSlug) {
            console.log('[Permissão] Slug não detectado - sem verificação');
            return;
        }

        const sb = getSupabase();
        if (!sb) {
            console.warn('[Permissão] Supabase não disponível');
            return;
        }

        try {
            const { data, error } = await sb
                .from('ferramentas_permissoes')
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('ferramenta', ferramentaSlug)
                .maybeSingle();

            if (error) {
                console.error('[Permissão] Erro ao consultar:', error);
                return; // Em caso de erro, não bloquear (fail-open)
            }

            // Se não existe registro de permissão, não bloquear (comportamento padrão = livre)
            if (!data) {
                console.log('[Permissão] Sem registro - acesso livre');
                return;
            }

            // Verificar modo
            if (data.modo === 'edicao_temporaria') {
                // Verificar se a edição expirou
                if (data.data_expiracao) {
                    const expiracao = new Date(data.data_expiracao);
                    const agora = new Date();
                    if (agora > expiracao) {
                        // Edição expirou - bloquear
                        console.log('[Permissão] Edição temporária EXPIRADA - bloqueando');
                        injetarModalBloqueio();
                        ativarModoVisualizacao();
                        return;
                    }
                }
                // Edição válida
                console.log('[Permissão] Edição temporária ATIVA - liberado');
                return;
            }

            if (data.modo === 'visualizacao') {
                // Modo visualização - bloquear edição
                console.log('[Permissão] Modo visualização - bloqueando edição');
                injetarModalBloqueio();
                ativarModoVisualizacao();
                return;
            }

        } catch (err) {
            console.error('[Permissão] Erro inesperado:', err);
            // Fail-open: não bloquear em caso de erro
        }
    }

    // Expor função globalmente para uso manual
    window.verificarPermissaoFerramenta = verificarPermissao;

    // Auto-executar verificação quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Pequeno delay para garantir que o Supabase CDN já carregou
            setTimeout(function() { verificarPermissao(); }, 500);
        });
    } else {
        setTimeout(function() { verificarPermissao(); }, 500);
    }
})();
