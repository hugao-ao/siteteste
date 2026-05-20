/**
 * permissao-guard.js v2 — Bloqueio Real de Edição por Permissão
 * ==============================================================
 * ESTRATÉGIA: Intercepta o `window.supabase.createClient` para que qualquer
 * cliente Supabase criado pelas ferramentas retorne um Proxy que BLOQUEIA
 * operações de escrita (.upsert, .insert, .update, .delete) quando o modo
 * é "visualizacao" ou "edicao_temporaria" expirada.
 *
 * TAMBÉM intercepta localStorage.setItem para impedir persistência local.
 *
 * ESTE SCRIPT DEVE SER CARREGADO **ANTES** DO SUPABASE CDN.
 * Ordem correta no <head>:
 *   1. <script src="../assets/permissao-guard.js"></script>
 *   2. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/..."></script>
 *   3. <script src="../assets/layout.js" defer></script>
 *   ... demais scripts
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════
    var SUPABASE_URL = 'https://vbikskbfkhundhropykf.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU';

    // ═══════════════════════════════════════════════════════════════
    // DETECÇÃO DE CONTEXTO
    // ═══════════════════════════════════════════════════════════════
    var isEquipe = (sessionStorage.getItem('equipe_modo_cliente') === 'true');
    var clienteId = sessionStorage.getItem('cliente_id') || null;

    // Se é equipe acessando como cliente, NUNCA bloquear
    if (isEquipe) {
        console.log('[PermGuard] Equipe em modo cliente — sem bloqueio');
        window._PERMISSAO_MODO = 'livre';
        return;
    }

    // Se não tem cliente_id, não há o que verificar
    if (!clienteId) {
        console.log('[PermGuard] Sem cliente_id — sem bloqueio');
        window._PERMISSAO_MODO = 'livre';
        return;
    }

    // Detectar slug da ferramenta pelo nome do arquivo HTML
    var path = window.location.pathname;
    var slug = path.split('/').pop().replace('.html', '');
    if (!slug) {
        console.log('[PermGuard] Slug não detectado — sem bloqueio');
        window._PERMISSAO_MODO = 'livre';
        return;
    }

    // ═══════════════════════════════════════════════════════════════
    // ESTADO GLOBAL — começa como "pendente" até a consulta retornar
    // ═══════════════════════════════════════════════════════════════
    // 'pendente' = ainda verificando (bloqueia por precaução)
    // 'bloqueado' = modo visualização confirmado
    // 'livre' = edição permitida
    window._PERMISSAO_MODO = 'pendente';
    window._PERMISSAO_SLUG = slug;

    // Fila de operações que tentaram executar enquanto estava "pendente"
    var _filaPendente = [];

    // ═══════════════════════════════════════════════════════════════
    // UI: BANNER + MODAL DE BLOQUEIO
    // ═══════════════════════════════════════════════════════════════
    function injetarUI() {
        var style = document.createElement('style');
        style.textContent = [
            '.pg-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:999999;justify-content:center;align-items:center;backdrop-filter:blur(3px);}',
            '.pg-overlay.active{display:flex;}',
            '.pg-modal{background:#01221a;border:1px solid rgba(212,175,55,0.3);border-radius:16px;padding:2.5rem;max-width:450px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);}',
            '.pg-modal .pg-icon{font-size:3rem;margin-bottom:1rem;}',
            '.pg-modal h3{color:#d4af37;font-size:1.3rem;margin:0 0 1rem;font-weight:700;}',
            '.pg-modal p{color:rgba(255,255,255,0.8);font-size:0.95rem;line-height:1.6;margin:0 0 1.5rem;}',
            '.pg-modal .pg-btn{padding:0.7rem 1.5rem;background:#d4af37;color:#000;border:none;border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.3s;}',
            '.pg-modal .pg-btn:hover{background:#c5a028;}',
            '.pg-banner{position:fixed;top:0;left:0;width:100%;background:linear-gradient(90deg,#d4af37,#c5a028);color:#000;text-align:center;padding:0.5rem 1rem;font-size:0.85rem;font-weight:600;z-index:999998;box-shadow:0 2px 8px rgba(0,0,0,0.3);}',
            'body.pg-blocked{padding-top:36px !important;}'
        ].join('\n');
        document.head.appendChild(style);

        // Banner
        var banner = document.createElement('div');
        banner.className = 'pg-banner';
        banner.id = 'pg-banner';
        banner.textContent = '\uD83D\uDD12 Modo Visualiza\u00e7\u00e3o \u2014 Edi\u00e7\u00e3o desabilitada. Contate seu consultor para libera\u00e7\u00e3o.';
        banner.style.display = 'none';
        document.body.prepend(banner);

        // Overlay + Modal
        var overlay = document.createElement('div');
        overlay.className = 'pg-overlay';
        overlay.id = 'pg-overlay';
        overlay.innerHTML = '<div class="pg-modal">' +
            '<div class="pg-icon">\uD83D\uDD12</div>' +
            '<h3>Edi\u00e7\u00e3o n\u00e3o permitida</h3>' +
            '<p>Esta ferramenta est\u00e1 em modo de visualiza\u00e7\u00e3o. Voc\u00ea pode consultar os dados, mas n\u00e3o pode editar, adicionar ou excluir informa\u00e7\u00f5es.</p>' +
            '<p style="font-size:0.85rem;color:rgba(255,255,255,0.6);">Para solicitar libera\u00e7\u00e3o de edi\u00e7\u00e3o, entre em contato com seu consultor financeiro.</p>' +
            '<button class="pg-btn" id="pg-fechar-btn">Entendi</button>' +
            '</div>';
        document.body.appendChild(overlay);

        document.getElementById('pg-fechar-btn').addEventListener('click', function() {
            overlay.classList.remove('active');
        });
    }

    function ativarBloqueioVisual() {
        var banner = document.getElementById('pg-banner');
        if (banner) {
            banner.style.display = 'block';
            document.body.classList.add('pg-blocked');
        }
    }

    function mostrarModal() {
        var overlay = document.getElementById('pg-overlay');
        if (overlay) overlay.classList.add('active');
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERCEPTAÇÃO DO SUPABASE — PROXY NA CRIAÇÃO DO CLIENT
    // ═══════════════════════════════════════════════════════════════

    // Operações de escrita que devem ser bloqueadas
    var WRITE_OPS = ['upsert', 'insert', 'update', 'delete'];

    // Cria um "fake result" que simula sucesso sem fazer nada
    function fakeResult() {
        return Promise.resolve({ data: null, error: { message: 'Bloqueado: modo visualização', code: 'PERMISSION_DENIED' } });
    }

    // Cria um proxy para o query builder que intercepta operações de escrita
    function criarProxyQueryBuilder(original) {
        return new Proxy(original, {
            get: function(target, prop) {
                var val = target[prop];

                // Se é uma operação de escrita
                if (WRITE_OPS.indexOf(prop) !== -1) {
                    return function() {
                        if (window._PERMISSAO_MODO === 'bloqueado') {
                            console.warn('[PermGuard] BLOQUEADO: tentativa de ' + prop + ' em modo visualização');
                            mostrarModal();
                            // Retorna um objeto chainable que resolve em fake
                            return {
                                then: function(cb) { return fakeResult().then(cb); },
                                catch: function(cb) { return fakeResult().catch(cb); },
                                select: function() { return fakeResult(); },
                                eq: function() { return fakeResult(); },
                                single: function() { return fakeResult(); },
                                maybeSingle: function() { return fakeResult(); }
                            };
                        }
                        if (window._PERMISSAO_MODO === 'pendente') {
                            // Enquanto pendente, também bloqueia (fail-safe)
                            console.warn('[PermGuard] PENDENTE: bloqueando ' + prop + ' preventivamente');
                            return {
                                then: function(cb) { return fakeResult().then(cb); },
                                catch: function(cb) { return fakeResult().catch(cb); },
                                select: function() { return fakeResult(); },
                                eq: function() { return fakeResult(); },
                                single: function() { return fakeResult(); },
                                maybeSingle: function() { return fakeResult(); }
                            };
                        }
                        // Modo livre — executar normalmente
                        return val.apply(target, arguments);
                    };
                }

                // Para operações de leitura (select, eq, etc), retornar normalmente
                // mas se o resultado for um objeto com métodos encadeáveis, também proxy
                if (typeof val === 'function') {
                    return function() {
                        var result = val.apply(target, arguments);
                        // Se retorna um objeto (query builder chain), proxy ele também
                        if (result && typeof result === 'object' && result !== null) {
                            return criarProxyQueryBuilder(result);
                        }
                        return result;
                    };
                }

                return val;
            }
        });
    }

    // Proxy para o client Supabase que intercepta .from()
    function criarProxyClient(originalClient) {
        return new Proxy(originalClient, {
            get: function(target, prop) {
                if (prop === 'from') {
                    return function(tableName) {
                        var queryBuilder = target.from(tableName);
                        // Só interceptar se o modo NÃO é 'livre'
                        if (window._PERMISSAO_MODO === 'livre') {
                            return queryBuilder;
                        }
                        return criarProxyQueryBuilder(queryBuilder);
                    };
                }
                // auth, storage, etc — passar direto
                var val = target[prop];
                if (typeof val === 'function') {
                    return val.bind(target);
                }
                return val;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERCEPTAR window.supabase.createClient
    // ═══════════════════════════════════════════════════════════════

    // Guardar referência para o createClient original quando ele aparecer
    var _originalCreateClient = null;
    var _proxyInstalled = false;

    function instalarProxy() {
        if (_proxyInstalled) return;
        if (!window.supabase || !window.supabase.createClient) return;

        _originalCreateClient = window.supabase.createClient;

        window.supabase.createClient = function() {
            var client = _originalCreateClient.apply(this, arguments);
            // Se modo é livre, retornar client original
            if (window._PERMISSAO_MODO === 'livre') {
                return client;
            }
            return criarProxyClient(client);
        };

        _proxyInstalled = true;
        console.log('[PermGuard] Proxy instalado em supabase.createClient');
    }

    // Observer para detectar quando window.supabase aparece (carregado via CDN)
    // Usa polling porque o CDN pode carregar a qualquer momento
    var _pollCount = 0;
    var _pollInterval = setInterval(function() {
        _pollCount++;
        if (window.supabase && window.supabase.createClient) {
            instalarProxy();
            clearInterval(_pollInterval);
        }
        if (_pollCount > 200) { // 10 segundos max
            clearInterval(_pollInterval);
        }
    }, 50);

    // Também interceptar via defineProperty caso o supabase seja setado depois
    var _supabaseRef = window.supabase;
    try {
        Object.defineProperty(window, 'supabase', {
            get: function() { return _supabaseRef; },
            set: function(val) {
                _supabaseRef = val;
                if (val && val.createClient) {
                    // Instalar proxy imediatamente
                    setTimeout(function() { instalarProxy(); }, 0);
                }
            },
            configurable: true,
            enumerable: true
        });
    } catch(e) {
        // Se falhar (ex: já definido), o polling cuidará
        console.log('[PermGuard] defineProperty falhou, usando polling');
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERCEPTAR localStorage.setItem (backup de segurança)
    // ═══════════════════════════════════════════════════════════════
    var _originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        if (window._PERMISSAO_MODO === 'bloqueado') {
            // Bloquear salvamento local de dados de ferramentas
            // Permitir apenas chaves do sistema (auth, theme, etc)
            var sistemKeys = ['sb-', 'supabase', 'theme', 'sidebar', 'dark'];
            var isSistema = sistemKeys.some(function(sk) { return key.indexOf(sk) !== -1; });
            if (!isSistema) {
                console.warn('[PermGuard] localStorage.setItem BLOQUEADO para key:', key);
                return;
            }
        }
        return _originalSetItem(key, value);
    };

    // ═══════════════════════════════════════════════════════════════
    // CONSULTA DE PERMISSÃO NO SUPABASE (usando fetch direto)
    // ═══════════════════════════════════════════════════════════════
    // Usa fetch direto na REST API do Supabase para não depender do SDK
    // (que ainda pode não ter carregado neste ponto)

    function consultarPermissao() {
        var url = SUPABASE_URL + '/rest/v1/ferramentas_permissoes' +
            '?cliente_id=eq.' + encodeURIComponent(clienteId) +
            '&ferramenta=eq.' + encodeURIComponent(slug) +
            '&select=modo,data_expiracao';

        fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            }
        })
        .then(function(res) { return res.json(); })
        .then(function(rows) {
            if (!rows || rows.length === 0) {
                // Sem registro = acesso livre (comportamento padrão)
                window._PERMISSAO_MODO = 'livre';
                console.log('[PermGuard] Sem registro para "' + slug + '" — acesso livre');
                return;
            }

            var perm = rows[0];

            if (perm.modo === 'edicao_temporaria') {
                if (perm.data_expiracao) {
                    var exp = new Date(perm.data_expiracao);
                    var agora = new Date();
                    if (agora > exp) {
                        // Expirou — bloquear
                        window._PERMISSAO_MODO = 'bloqueado';
                        console.log('[PermGuard] Edição temporária EXPIRADA — bloqueando');
                        aplicarBloqueio();
                        return;
                    }
                }
                // Edição válida (com ou sem data)
                window._PERMISSAO_MODO = 'livre';
                console.log('[PermGuard] Edição temporária ATIVA — liberado');
                return;
            }

            if (perm.modo === 'visualizacao') {
                window._PERMISSAO_MODO = 'bloqueado';
                console.log('[PermGuard] Modo visualização — bloqueando');
                aplicarBloqueio();
                return;
            }

            // Qualquer outro valor = livre
            window._PERMISSAO_MODO = 'livre';
        })
        .catch(function(err) {
            // Em caso de erro de rede, liberar (fail-open)
            console.warn('[PermGuard] Erro na consulta — liberando por segurança:', err);
            window._PERMISSAO_MODO = 'livre';
        });
    }

    function aplicarBloqueio() {
        // Injetar UI quando DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                injetarUI();
                ativarBloqueioVisual();
                bloquearBotoesVisuais();
            });
        } else {
            injetarUI();
            ativarBloqueioVisual();
            bloquearBotoesVisuais();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BLOQUEIO VISUAL DE BOTÕES (camada extra de segurança)
    // ═══════════════════════════════════════════════════════════════
    function bloquearBotoesVisuais() {
        // Interceptar todos os botões que tenham texto indicando ação de escrita
        var textosEscrita = ['salvar', 'save', 'nova', 'novo', 'adicionar', 'add', 'excluir', 'delete', 'remover', 'criar'];

        function processarBotoes() {
            var botoes = document.querySelectorAll('button, .btn, [onclick]');
            botoes.forEach(function(btn) {
                if (btn.dataset.pgProcessado) return;

                var texto = (btn.textContent || '').toLowerCase().trim();
                var onclick = (btn.getAttribute('onclick') || '').toLowerCase();

                var isEscrita = textosEscrita.some(function(t) {
                    return texto.indexOf(t) !== -1 || onclick.indexOf(t) !== -1;
                });

                // Também pegar botões com classes específicas
                var classes = (btn.className || '').toLowerCase();
                if (classes.indexOf('btn-save') !== -1 || classes.indexOf('btn-danger') !== -1 ||
                    classes.indexOf('btn-primary') !== -1 && (texto.indexOf('+') !== -1 || isEscrita)) {
                    isEscrita = true;
                }

                // Botão global de salvar
                if (btn.id === 'btnSaveGlobal' || classes.indexOf('btn-save-global') !== -1) {
                    isEscrita = true;
                }

                if (isEscrita) {
                    btn.dataset.pgProcessado = 'true';
                    // Remover onclick inline
                    var originalOnclick = btn.getAttribute('onclick');
                    if (originalOnclick) {
                        btn.dataset.pgOriginalOnclick = originalOnclick;
                        btn.removeAttribute('onclick');
                    }
                    // Adicionar listener de bloqueio
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        mostrarModal();
                        return false;
                    }, true);
                    // Visual de desabilitado
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.title = 'Edição bloqueada — modo visualização';
                }
            });
        }

        // Processar botões existentes
        processarBotoes();

        // Observer para botões adicionados dinamicamente
        var observer = new MutationObserver(function() {
            processarBotoes();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Re-processar após um delay (para ferramentas que renderizam com delay)
        setTimeout(processarBotoes, 1000);
        setTimeout(processarBotoes, 3000);
        setTimeout(processarBotoes, 5000);
    }

    // ═══════════════════════════════════════════════════════════════
    // INICIAR CONSULTA IMEDIATAMENTE
    // ═══════════════════════════════════════════════════════════════
    consultarPermissao();

})();
