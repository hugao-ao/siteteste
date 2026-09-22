/**
 * argos-guard.js — Proteção de acesso à área Argos
 * =================================================
 * DEVE ser o PRIMEIRO script no <head> de TODA página desta pasta.
 * Deixa passar duas sessões:
 *   • o login mestre ArgosGestao (feito no login do site ou em login.html);
 *   • um usuário da tabela argos_usuarios, logado em login.html
 *     (a sessão carrega argos_user_id, argos_tipo_id, argos_prof_id…).
 * Qualquer outra situação: guarda a URL e manda para argos/login.html.
 *
 * Também é o dono do botão "Sair" (#btn-logout): script clássico, sem
 * dependência de CDN — o logout funciona mesmo se o esm.sh estiver fora.
 */
(function () {
    'use strict';

    var usuario = sessionStorage.getItem('usuario');
    var argosId = sessionStorage.getItem('argos_user_id');

    var autorizado = (usuario === 'ArgosGestao') || (!!usuario && !!argosId);

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
        window.location.replace('login.html');
        return;
    }

    var CHAVES = ['usuario', 'nivel', 'projeto', 'user_id', 'id',
        'argos_user_id', 'argos_tipo_id', 'argos_tipo_nome', 'argos_prof_id', 'argos_nome'];

    document.addEventListener('DOMContentLoaded', function () {
        // Logout padrão de todas as páginas da área
        var b = document.getElementById('btn-logout');
        if (b) b.addEventListener('click', function () {
            CHAVES.forEach(function (k) {
                sessionStorage.removeItem(k);
                localStorage.removeItem(k);
            });
            window.location.replace('login.html');
        });
        // Quem está logado (as páginas que quiserem mostrar têm #quem-logado)
        var q = document.getElementById('quem-logado');
        if (q) {
            var nome = sessionStorage.getItem('argos_nome') || usuario;
            var tipo = usuario === 'ArgosGestao' ? 'Mestre' : (sessionStorage.getItem('argos_tipo_nome') || '');
            q.textContent = nome + (tipo ? ' · ' + tipo : '');
        }
    });
})();
