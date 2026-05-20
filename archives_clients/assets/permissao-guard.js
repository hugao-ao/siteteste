/**
 * permissao-guard.js v3 — Verificação de Permissão via Flag Global
 * =================================================================
 * Este script consulta a tabela `ferramentas_permissoes` via REST API
 * e define a variável global `window._PERM_BLOQUEADO = true/false`.
 *
 * Cada ferramenta verifica essa flag no início das funções de escrita.
 * Se bloqueado, mostra um modal e aborta a operação.
 *
 * VANTAGEM: Não depende de proxy, timing, ou interceptação.
 *           É um simples `if` no início de cada função.
 *
 * ORDEM NO <head>: ANTES de qualquer outro script.
 *   <script src="../assets/permissao-guard.js"></script>
 */

(function() {
    'use strict';

    var SUPABASE_URL = 'https://vbikskbfkhundhropykf.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU';

    // Defaults
    window._PERM_BLOQUEADO = false;
    window._PERM_PRONTO = false;

    // Detectar contexto
    var isEquipe = (sessionStorage.getItem('equipe_modo_cliente') === 'true');
    var clienteId = sessionStorage.getItem('cliente_id') || null;
    var slug = window.location.pathname.split('/').pop().replace('.html', '') || null;

    // Equipe nunca é bloqueada
    if (isEquipe) {
        window._PERM_PRONTO = true;
        return;
    }

    // Sem cliente ou slug = sem bloqueio
    if (!clienteId || !slug) {
        window._PERM_PRONTO = true;
        return;
    }

    // Consultar permissão via REST API (síncrono via XMLHttpRequest para garantir que está pronto antes dos scripts)
    try {
        var url = SUPABASE_URL + '/rest/v1/ferramentas_permissoes' +
            '?cliente_id=eq.' + encodeURIComponent(clienteId) +
            '&ferramenta=eq.' + encodeURIComponent(slug) +
            '&select=modo,data_expiracao';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false); // SÍNCRONO - bloqueia até resposta
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('Authorization', 'Bearer ' + SUPABASE_ANON_KEY);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(null);

        if (xhr.status === 200) {
            var rows = JSON.parse(xhr.responseText);
            if (rows && rows.length > 0) {
                var perm = rows[0];
                if (perm.modo === 'visualizacao') {
                    window._PERM_BLOQUEADO = true;
                } else if (perm.modo === 'edicao_temporaria' && perm.data_expiracao) {
                    var exp = new Date(perm.data_expiracao);
                    if (new Date() > exp) {
                        window._PERM_BLOQUEADO = true;
                    }
                }
            }
        }
    } catch(e) {
        // Erro de rede = não bloquear (fail-open)
        console.warn('[PermGuard] Erro na consulta:', e);
    }

    window._PERM_PRONTO = true;

    // ═══════════════════════════════════════════════════════════════
    // FUNÇÃO GLOBAL: verificar e mostrar modal
    // ═══════════════════════════════════════════════════════════════
    window._permGuardCheck = function() {
        if (!window._PERM_BLOQUEADO) return false; // OK, pode prosseguir
        // Mostrar modal
        _mostrarModalBloqueio();
        return true; // BLOQUEADO
    };

    // ═══════════════════════════════════════════════════════════════
    // UI: BANNER + MODAL
    // ═══════════════════════════════════════════════════════════════
    var _uiInjetada = false;

    function _injetarUI() {
        if (_uiInjetada) return;
        _uiInjetada = true;

        var style = document.createElement('style');
        style.textContent = 
            '.pg-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:999999;justify-content:center;align-items:center;backdrop-filter:blur(3px);}' +
            '.pg-overlay.active{display:flex;}' +
            '.pg-modal{background:#01221a;border:1px solid rgba(212,175,55,0.3);border-radius:16px;padding:2.5rem;max-width:450px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);}' +
            '.pg-modal .pg-icon{font-size:3rem;margin-bottom:1rem;}' +
            '.pg-modal h3{color:#d4af37;font-size:1.3rem;margin:0 0 1rem;font-weight:700;}' +
            '.pg-modal p{color:rgba(255,255,255,0.8);font-size:0.95rem;line-height:1.6;margin:0 0 1.5rem;}' +
            '.pg-modal .pg-btn{padding:0.7rem 1.5rem;background:#d4af37;color:#000;border:none;border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.3s;}' +
            '.pg-modal .pg-btn:hover{background:#c5a028;}' +
            '.pg-banner{position:fixed;top:0;left:0;width:100%;background:linear-gradient(90deg,#d4af37,#c5a028);color:#000;text-align:center;padding:0.5rem 1rem;font-size:0.85rem;font-weight:600;z-index:999998;box-shadow:0 2px 8px rgba(0,0,0,0.3);}' +
            'body.pg-blocked{padding-top:36px !important;}';
        document.head.appendChild(style);

        var banner = document.createElement('div');
        banner.className = 'pg-banner';
        banner.id = 'pg-banner';
        banner.textContent = '\uD83D\uDD12 Modo Visualiza\u00e7\u00e3o \u2014 Edi\u00e7\u00e3o desabilitada. Contate seu consultor para libera\u00e7\u00e3o.';
        document.body.prepend(banner);
        document.body.classList.add('pg-blocked');

        var overlay = document.createElement('div');
        overlay.className = 'pg-overlay';
        overlay.id = 'pg-overlay';
        overlay.innerHTML = '<div class="pg-modal">' +
            '<div class="pg-icon">\uD83D\uDD12</div>' +
            '<h3>Edi\u00e7\u00e3o n\u00e3o permitida</h3>' +
            '<p>Esta ferramenta est\u00e1 em modo de visualiza\u00e7\u00e3o. Voc\u00ea pode consultar os dados, mas n\u00e3o pode editar, adicionar ou excluir informa\u00e7\u00f5es.</p>' +
            '<p style="font-size:0.85rem;color:rgba(255,255,255,0.6);">Para solicitar libera\u00e7\u00e3o, entre em contato com seu consultor financeiro.</p>' +
            '<button class="pg-btn" onclick="document.getElementById(\'pg-overlay\').classList.remove(\'active\')">Entendi</button>' +
            '</div>';
        document.body.appendChild(overlay);
    }

    function _mostrarModalBloqueio() {
        _injetarUI();
        var overlay = document.getElementById('pg-overlay');
        if (overlay) overlay.classList.add('active');
    }

    // Se bloqueado, injetar banner quando DOM estiver pronto
    if (window._PERM_BLOQUEADO) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _injetarUI);
        } else {
            _injetarUI();
        }
    }

})();
