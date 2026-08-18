/**
 * hermo-guard.js — Proteção de acesso à área Hermogenes
 * ======================================================
 * DEVE ser o PRIMEIRO script no <head> de TODA página desta pasta.
 * Só permite acesso à sessão do login HermogenesObras (projeto Hermogenes).
 * Qualquer outra situação: redireciona para o login do site.
 *
 * Também é o dono do botão "Sair" (#btn-logout): script clássico, sem
 * dependência de CDN — o logout funciona mesmo se o esm.sh estiver fora.
 */
(function () {
    'use strict';

    var usuario = sessionStorage.getItem('usuario');
    var projeto = sessionStorage.getItem('projeto');

    var autorizado = (usuario === 'HermogenesObras' && projeto === 'Hermogenes');

    if (!autorizado) {
        document.documentElement.style.visibility = 'hidden';
        try {
            if (!usuario) {
                // Visitante sem sessão: guarda a URL para voltar aqui após o login
                localStorage.setItem('redirect_after_login', window.location.href);
            } else {
                // Usuário logado de OUTRO projeto: nunca armar redirect para cá
                // (evita loop de login no fluxo normal do site)
                localStorage.removeItem('redirect_after_login');
            }
        } catch (e) {}
        window.location.replace('../index.html');
        return;
    }

    // Logout padrão de todas as páginas da área
    document.addEventListener('DOMContentLoaded', function () {
        var b = document.getElementById('btn-logout');
        if (b) b.addEventListener('click', function () {
            ['usuario', 'nivel', 'projeto', 'user_id', 'id'].forEach(function (k) {
                sessionStorage.removeItem(k);
                localStorage.removeItem(k);
            });
            window.location.replace('../index.html');
        });
    });
})();
