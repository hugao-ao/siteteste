/* =========================================================================
   diagnostico-estilos.js — seletor de estilo do diagnóstico
   =========================================================================
   Carrega a variação visual escolhida por cima do painel (modelo B):

     B · Painel    → só diagnostico-painel.css
     D · Fichas    → painel + diagnostico-fichas.css
     E · Planilha  → painel + diagnostico-planilha.css

   Escolha, em ordem de precedência:
     1. ?estilo=b|d|e na URL
     2. o que ficou salvo no localStorage
     3. b

   Roda no <head>, antes da renderização, para não piscar.
   É puramente visual: não toca em id, name ou captação.
   ========================================================================= */

(function () {
  'use strict';

  var CHAVE = 'diagnostico_estilo';

  var ESTILOS = {
    b: { nome: 'B · Painel', css: null },
    d: { nome: 'D · Fichas', css: 'diagnostico-fichas.css' },
    e: { nome: 'E · Planilha', css: 'diagnostico-planilha.css', js: 'diagnostico-planilha.js' }
  };

  function lerEscolha() {
    try {
      var daUrl = new URLSearchParams(window.location.search).get('estilo');
      if (daUrl && ESTILOS[daUrl.toLowerCase()]) {
        var escolhido = daUrl.toLowerCase();
        localStorage.setItem(CHAVE, escolhido);
        return escolhido;
      }
      var salvo = localStorage.getItem(CHAVE);
      if (salvo && ESTILOS[salvo]) return salvo;
    } catch (e) {}
    return 'b';
  }

  var atual = lerEscolha();

  function aplicar(id) {
    var anterior = document.getElementById('estilo-variacao');
    if (anterior) anterior.remove();

    // comportamento extra do estilo anterior sai de cena
    if (window.DiagnosticoPlanilha && id !== 'e') {
      window.DiagnosticoPlanilha.desligar();
    }

    var def = ESTILOS[id] || {};

    if (def.css) {
      var link = document.createElement('link');
      link.id = 'estilo-variacao';
      link.rel = 'stylesheet';
      link.href = def.css;
      document.head.appendChild(link);
    }

    if (!def.js) return;

    // já carregado antes: só religa
    if (id === 'e' && window.DiagnosticoPlanilha) {
      window.DiagnosticoPlanilha.ligar();
      return;
    }

    if (document.querySelector('script[data-estilo-js="' + def.js + '"]')) return;

    var script = document.createElement('script');
    script.src = def.js;
    script.setAttribute('data-estilo-js', def.js);
    document.head.appendChild(script);
  }

  aplicar(atual);

  window.DiagnosticoEstilos = {
    atual: function () { return atual; },
    definir: function (id) {
      if (!ESTILOS[id]) return;
      atual = id;
      try { localStorage.setItem(CHAVE, id); } catch (e) {}
      aplicar(id);
      montarSeletor();
    }
  };

  /* ---------- seletor dentro da barra lateral ---------- */

  function montarSeletor() {
    var nav = document.getElementById('painel-nav');
    if (!nav) return;

    var antigo = document.getElementById('painel-estilos');
    if (antigo) antigo.remove();

    var caixa = document.createElement('div');
    caixa.id = 'painel-estilos';

    var titulo = document.createElement('p');
    titulo.className = 'pn-title';
    titulo.textContent = 'Estilo';
    caixa.appendChild(titulo);

    var linha = document.createElement('div');
    linha.className = 'pe-linha';

    Object.keys(ESTILOS).forEach(function (id) {
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'pe-btn' + (id === atual ? ' ativo' : '');
      botao.textContent = id.toUpperCase();
      botao.title = ESTILOS[id].nome;
      botao.setAttribute('aria-pressed', id === atual ? 'true' : 'false');
      botao.addEventListener('click', function () {
        window.DiagnosticoEstilos.definir(id);
      });
      linha.appendChild(botao);
    });

    caixa.appendChild(linha);

    var nota = document.createElement('p');
    nota.className = 'pe-nota';
    nota.textContent = ESTILOS[atual].nome;
    caixa.appendChild(nota);

    nav.appendChild(caixa);
  }

  // o índice é montado pelo painel depois que o diagnóstico carrega
  function esperarNav() {
    if (document.getElementById('painel-nav')) {
      montarSeletor();
      return;
    }
    var observador = new MutationObserver(function () {
      if (document.getElementById('painel-nav')) {
        observador.disconnect();
        montarSeletor();
      }
    });
    observador.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', esperarNav);
  } else {
    esperarNav();
  }
})();
