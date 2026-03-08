/**
 * page-guard.js — Proteção de Acesso a Páginas Restritas
 * =========================================================
 * Este script DEVE ser carregado como o PRIMEIRO script de cada
 * página protegida, dentro do <head>, para bloquear o acesso
 * antes de qualquer conteúdo ser renderizado.
 *
 * Funcionamento:
 *  1. Verifica se há sessão válida no sessionStorage (usuario + nivel)
 *  2. Se não houver, oculta o body imediatamente e redireciona para index.html
 *  3. Salva a URL atual para redirecionamento automático após o login
 *
 * Para páginas exclusivas de admin, adicione o atributo:
 *   <script src="page-guard.js" data-nivel="admin"></script>
 *
 * Para páginas abertas a qualquer usuário autenticado, use sem atributo:
 *   <script src="page-guard.js"></script>
 */

(function () {
    'use strict';

    var usuario = sessionStorage.getItem('usuario');
    var nivel   = sessionStorage.getItem('nivel');

    // Determina o nível mínimo exigido pela página (via atributo data-nivel no script)
    var scripts = document.getElementsByTagName('script');
    var nivelRequerido = null;
    for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf('page-guard.js') !== -1) {
            nivelRequerido = scripts[i].getAttribute('data-nivel') || null;
            break;
        }
    }

    // Verifica autenticação básica
    var autenticado = !!(usuario && nivel);

    // Verifica nível se exigido
    var temPermissao = autenticado;
    if (autenticado && nivelRequerido) {
        temPermissao = (nivel === nivelRequerido);
    }

    if (!temPermissao) {
        // Oculta o body imediatamente para evitar flash de conteúdo
        document.documentElement.style.visibility = 'hidden';

        // Salva a URL atual para redirecionar após login
        try {
            localStorage.setItem('redirect_after_login', window.location.href);
        } catch (e) {}

        // Redireciona para a página de login
        window.location.replace('index.html');
    }
})();
