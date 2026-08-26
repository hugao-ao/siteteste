/* =========================================================================
   diagnostico-planilha.js — Modelo E "Planilha"
   =========================================================================
   Só carrega quando o estilo E está ativo (diagnostico-estilos.js decide).

   O que faz: cada item de lista (dívida, patrimônio líquido, conta/cartão,
   declaração de IR) vira uma LINHA resumida, que se expande para edição.
   Assim uma lista de 10 dívidas é lida de uma vez, como numa planilha, em
   vez de 10 cartões de 29 campos empilhados.

   É aditivo: cria um <span> de resumo e alterna classes. Não move, renomeia
   nem remove nenhum campo — id, name e captação ficam intactos.
   ========================================================================= */

(function () {
  'use strict';

  var SELETOR_CARDS = [
    '.divida-card',
    '.patrimonio-liquido-card',
    '.conta-cartao-card',
    '.ir-card',
    '.produto-protecao-card',
    '.objetivo-card'
  ].join(',');

  /* rótulos que valem a pena mostrar na linha fechada, em ordem */
  var PRIORIDADE = [
    /institui|credor|banco|seguradora/i,
    /tipo|produto|descri|categoria/i,
    /saldo devedor|valor atual|valor total|capital|limite|valor/i,
    /parcela|pr[êe]mio|aporte|renda/i
  ];

  function texto(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  var VAZIOS = /^(|0|0,00|R\$ ?0,00|selecione\.*|selecione a .*|selecione o .*|nenhum[ao]?)$/i;

  function valorLegivel(campo) {
    if (!campo) return '';
    var tipo = (campo.type || '').toLowerCase();
    if (tipo === 'hidden' || tipo === 'checkbox' || tipo === 'radio') return '';
    if (campo.tagName === 'TEXTAREA') return '';

    if (campo.tagName === 'SELECT') {
      if (!campo.value) return '';
      var op = campo.options[campo.selectedIndex];
      var t = op ? texto(op) : '';
      return VAZIOS.test(t) ? '' : t;
    }

    var v = String(campo.value || '').trim();
    return VAZIOS.test(v) ? '' : v;
  }

  /* monta o resumo a partir dos próprios campos do card */
  function resumoDoCard(card) {
    var grupos = card.querySelectorAll('.form-group');
    var candidatos = [];

    Array.prototype.forEach.call(grupos, function (g) {
      var campo = g.querySelector('input, select, textarea');
      var valor = valorLegivel(campo);
      if (!valor) return;
      candidatos.push({ rotulo: texto(g.querySelector('label')), valor: valor });
    });

    var escolhidos = [];
    PRIORIDADE.forEach(function (padrao) {
      if (escolhidos.length >= 3) return;
      for (var i = 0; i < candidatos.length; i++) {
        var c = candidatos[i];
        if (escolhidos.indexOf(c) === -1 && padrao.test(c.rotulo)) {
          escolhidos.push(c);
          break;
        }
      }
    });

    // só completa com campos avulsos se algo relevante já apareceu,
    // e sem gastar espaço com respostas de sim/não
    if (escolhidos.length) {
      for (var j = 0; j < candidatos.length && escolhidos.length < 3; j++) {
        var cand = candidatos[j];
        if (escolhidos.indexOf(cand) !== -1) continue;
        if (/^(sim|n[ãa]o)$/i.test(cand.valor)) continue;
        escolhidos.push(cand);
      }
    }

    if (!escolhidos.length) return 'em branco — clique para preencher';

    // quem identifica a linha vem primeiro; valores em dinheiro depois
    var ehDinheiro = function (c) { return /R\$/.test(c.valor); };
    var identificam = escolhidos.filter(function (c) { return !ehDinheiro(c); });
    var valores = escolhidos.filter(ehDinheiro);

    return identificam.concat(valores).map(function (c) { return c.valor; }).join(' · ');
  }

  function atualizarResumo(card) {
    var alvo = card.querySelector('.pl-resumo');
    if (!alvo) return;
    var novo = resumoDoCard(card);
    if (alvo.textContent !== novo) alvo.textContent = novo;
  }

  function preparar(card) {
    if (card.classList.contains('pl-card')) return;
    card.classList.add('pl-card', 'pl-fechado');

    var cabecalho = card.firstElementChild;
    if (!cabecalho) return;
    cabecalho.classList.add('pl-cab');

    var resumo = document.createElement('span');
    resumo.className = 'pl-resumo';
    cabecalho.appendChild(resumo);

    var seta = document.createElement('span');
    seta.className = 'pl-seta';
    seta.setAttribute('aria-hidden', 'true');
    seta.textContent = '▾';
    cabecalho.appendChild(seta);

    cabecalho.addEventListener('click', function (ev) {
      // não sequestrar cliques nos controles do próprio cabeçalho
      if (ev.target.closest('button, a, input, select')) return;
      card.classList.toggle('pl-fechado');
    });

    atualizarResumo(card);
  }

  function varrer() {
    var cards = document.querySelectorAll(SELETOR_CARDS);
    Array.prototype.forEach.call(cards, preparar);
  }

  function limpar() {
    var cards = document.querySelectorAll('.pl-card');
    Array.prototype.forEach.call(cards, function (card) {
      card.classList.remove('pl-card', 'pl-fechado');
      var cab = card.querySelector('.pl-cab');
      if (cab) cab.classList.remove('pl-cab');
      var r = card.querySelector('.pl-resumo');
      if (r) r.remove();
      var s = card.querySelector('.pl-seta');
      if (s) s.remove();
    });
  }

  var observador = null;

  function ligar() {
    varrer();

    document.addEventListener('input', function (ev) {
      var card = ev.target.closest ? ev.target.closest('.pl-card') : null;
      if (card) atualizarResumo(card);
    }, true);

    document.addEventListener('change', function (ev) {
      var card = ev.target.closest ? ev.target.closest('.pl-card') : null;
      if (card) atualizarResumo(card);
    }, true);

    // os módulos criam cards depois; pegar os novos
    var raiz = document.getElementById('main-content') || document.body;
    observador = new MutationObserver(function () { varrer(); });
    observador.observe(raiz, { childList: true, subtree: true });
  }

  function desligar() {
    if (observador) { observador.disconnect(); observador = null; }
    limpar();
  }

  window.DiagnosticoPlanilha = { ligar: ligar, desligar: desligar, varrer: varrer };

  function iniciar() {
    var conteudo = document.getElementById('main-content');
    if (!conteudo) return;

    if (conteudo.style.display !== 'none') { ligar(); return; }

    var esperar = new MutationObserver(function () {
      if (conteudo.style.display !== 'none') {
        esperar.disconnect();
        ligar();
      }
    });
    esperar.observe(conteudo, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
