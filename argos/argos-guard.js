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
        'argos_user_id', 'argos_tipo_id', 'argos_tipo_nome', 'argos_prof_id', 'argos_nome',
        'argos_mestre_backup'];

    // Personificação: o acesso principal entrou "como" outro usuário/tipo
    // (usuarios.js guardou a sessão dele em argos_mestre_backup). Só quem
    // tem esse backup vê a barra — os outros perfis nunca a têm.
    var backup = null;
    try { backup = JSON.parse(sessionStorage.getItem('argos_mestre_backup') || 'null'); } catch (e) {}

    function voltarAoMestre() {
        var meu = backup || {};
        CHAVES.forEach(function (k) { sessionStorage.removeItem(k); });
        Object.keys(meu).forEach(function (k) { if (meu[k] != null && meu[k] !== '') sessionStorage.setItem(k, meu[k]); });
        window.location.replace('index.html');
    }

    function montarBarra() {
        if (!backup || document.getElementById('argos-personificando')) return;
        var nome = sessionStorage.getItem('argos_nome') || usuario;
        var tipo = sessionStorage.getItem('argos_tipo_nome') || '';
        var bar = document.createElement('div');
        bar.id = 'argos-personificando';
        bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;'
            + 'padding:8px 14px;background:#7c2d12;color:#fff;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 -4px 16px rgba(0,0,0,.35)');
        bar.innerHTML = '<span>👁️ Você está vendo o sistema como <b></b></span>'
            + '<button type="button" id="btn-voltar-mestre" style="background:#fff;color:#7c2d12;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">↩ Voltar ao meu painel</button>';
        bar.querySelector('b').textContent = nome + (tipo ? ' · ' + tipo : '');
        document.body.appendChild(bar);
        document.body.style.paddingBottom = '56px';
        document.getElementById('btn-voltar-mestre').addEventListener('click', voltarAoMestre);
    }

    // Janelas: os módulos abrem em pop-ups a partir da home. Cada página
    // ganha um botão 🔄 que a recarrega, e a home avisa por este canal para
    // TODAS as janelas abertas recarregarem de uma vez.
    var CANAL_JANELAS = 'argos-janelas';
    try {
        var canal = new BroadcastChannel(CANAL_JANELAS);
        canal.onmessage = function (e) {
            if (!e.data || e.data.tipo !== 'recarregar') return;
            if (e.data.origem && e.data.origem === window.name) return; // quem pediu não se recarrega
            window.location.reload();
        };
    } catch (e) {}
    window.argosRecarregarJanelas = function () {
        try { new BroadcastChannel(CANAL_JANELAS).postMessage({ tipo: 'recarregar', origem: window.name, quando: Date.now() }); } catch (e) {}
    };

    function montarBotaoRecarregar() {
        var acoes = document.querySelector('.argos-topbar .actions');
        if (!acoes || document.getElementById('btn-recarregar')) return;
        var b = document.createElement('button');
        b.id = 'btn-recarregar';
        b.className = 'argos-btn ghost';
        b.title = 'Recarregar esta janela com o que está no banco agora';
        b.textContent = '🔄';
        b.addEventListener('click', function () { window.location.reload(); });
        var sair = document.getElementById('btn-logout');
        acoes.insertBefore(b, sair || null);
    }

    document.addEventListener('DOMContentLoaded', function () {
        montarBotaoRecarregar();
        // Logout padrão de todas as páginas da área
        var b = document.getElementById('btn-logout');
        if (b) b.addEventListener('click', function () {
            CHAVES.forEach(function (k) {
                sessionStorage.removeItem(k);
                localStorage.removeItem(k);
            });
            window.location.replace('login.html');
        });
        montarBarra();
        // Quem está logado (as páginas que quiserem mostrar têm #quem-logado)
        var q = document.getElementById('quem-logado');
        if (q) {
            var nome = sessionStorage.getItem('argos_nome') || usuario;
            var tipo = usuario === 'ArgosGestao' ? 'Mestre' : (sessionStorage.getItem('argos_tipo_nome') || '');
            q.textContent = nome + (tipo ? ' · ' + tipo : '');
        }
    });
})();
