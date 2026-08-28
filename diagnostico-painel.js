/* =========================================================================
   diagnostico-painel.js — Modelo B "Painel"
   =========================================================================
   Constrói o índice lateral a partir do DOM que já existe. É puramente
   aditivo: cria elementos novos, nunca lê, renomeia ou remove campos.
   Nenhum id, name ou função de captação é tocado.
   Para reverter: remover o <script> desta folha no HTML.
   ========================================================================= */

(function () {
  'use strict';

  var NAV_ID = 'painel-nav';

  /* rótulos longos demais para uma coluna de 236px */
  var ROTULOS_CURTOS = {
    'pessoas-renda': 'Pessoas com renda',
    'patrimonio-liquido': 'Patrimônio líquido',
    'contas-cartoes': 'Contas e cartões',
    'produtos-protecao': 'Produtos e proteção'
  };

  var nav = null;
  var itens = [];
  var barra = null;
  var pct = null;

  function texto(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  /* ---------- descoberta das seções a partir do markup existente ---------- */

  function mapearSecoes() {
    var secoes = [];

    var principal = document.getElementById('diagnostico-form');
    if (principal) {
      var alvoPrincipal = principal.closest('.form-container') || principal;
      secoes.push({ slug: null, rotulo: 'Dados pessoais', container: alvoPrincipal });
    }

    var cabecalhos = document.querySelectorAll('.section-header');
    Array.prototype.forEach.call(cabecalhos, function (cab) {
      var botao = cab.querySelector('[id^="toggle-"]');
      if (!botao) return;

      var slug = botao.id.replace(/^toggle-/, '');
      var container = cab.closest('.form-container') || cab.parentElement;
      var titulo = cab.querySelector('h3');
      var rotulo = ROTULOS_CURTOS[slug] || texto(titulo) || slug;

      secoes.push({ slug: slug, rotulo: rotulo, container: container });
    });

    return secoes;
  }

  /* ---------- recolher e expandir a barra ---------- */

  var CHAVE_RECOLHIDO = 'diagnostico_painel_recolhido';

  function estaRecolhido() {
    try { return localStorage.getItem(CHAVE_RECOLHIDO) === '1'; } catch (e) { return false; }
  }

  function aplicarRecolhido(recolhido, botao) {
    document.body.classList.toggle('painel-recolhido', recolhido);
    try { localStorage.setItem(CHAVE_RECOLHIDO, recolhido ? '1' : '0'); } catch (e) {}
    if (!botao) return;
    botao.textContent = recolhido ? '»' : '«';
    botao.title = recolhido ? 'Expandir a barra' : 'Recolher a barra';
    botao.setAttribute('aria-label', botao.title);
    botao.setAttribute('aria-expanded', recolhido ? 'false' : 'true');
  }

  function montarRecolher() {
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.id = 'painel-recolher';
    botao.addEventListener('click', function () {
      aplicarRecolhido(!document.body.classList.contains('painel-recolhido'), botao);
    });
    aplicarRecolhido(estaRecolhido(), botao);
    return botao;
  }

  /* ---------- construção do índice ---------- */

  function montarNav(secoes) {
    if (document.getElementById(NAV_ID)) return;

    nav = document.createElement('nav');
    nav.id = NAV_ID;
    nav.setAttribute('aria-label', 'Seções do diagnóstico');

    nav.appendChild(montarRecolher());

    var cabecalho = document.createElement('div');
    cabecalho.className = 'pn-head';

    var nomeCliente = document.createElement('p');
    nomeCliente.className = 'pn-cliente';
    var tituloPagina = document.getElementById('diagnostico-title');
    nomeCliente.textContent = texto(tituloPagina) || 'Diagnóstico financeiro';

    var status = document.createElement('p');
    status.className = 'pn-status';
    var badge = document.getElementById('status-badge');
    status.textContent = texto(badge) || 'Em andamento';

    var trilho = document.createElement('div');
    trilho.className = 'pn-track';
    barra = document.createElement('span');
    barra.className = 'pn-fill';
    trilho.appendChild(barra);

    pct = document.createElement('span');
    pct.className = 'pn-pct';
    pct.textContent = '0% preenchido';

    cabecalho.appendChild(nomeCliente);
    cabecalho.appendChild(status);
    cabecalho.appendChild(trilho);
    cabecalho.appendChild(pct);

    var rotuloLista = document.createElement('p');
    rotuloLista.className = 'pn-title';
    rotuloLista.textContent = 'Seções';

    var lista = document.createElement('ul');
    lista.className = 'pn-list';

    secoes.forEach(function (secao) {
      if (!secao.container) return;

      var li = document.createElement('li');
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'pn-item';

      var tick = document.createElement('span');
      tick.className = 'pn-tick';
      tick.setAttribute('aria-hidden', 'true');

      var rotulo = document.createElement('span');
      rotulo.className = 'pn-rotulo';
      rotulo.textContent = secao.rotulo;

      // com a barra recolhida, o rótulo some e o title vira a única pista
      botao.title = secao.rotulo;

      botao.appendChild(tick);
      botao.appendChild(rotulo);
      botao.addEventListener('click', function () {
        irPara(secao);
      });

      li.appendChild(botao);
      lista.appendChild(li);

      itens.push({ botao: botao, secao: secao });
    });

    nav.appendChild(cabecalho);
    nav.appendChild(rotuloLista);
    nav.appendChild(lista);
    document.body.insertBefore(nav, document.body.firstChild);
  }

  /* ---------- navegação ---------- */

  function irPara(secao) {
    if (secao.slug && typeof window.toggleSection === 'function') {
      var conteudo = document.getElementById('content-' + secao.slug);
      if (conteudo && conteudo.classList.contains('collapsed')) {
        window.toggleSection(secao.slug);
      }
    }
    if (secao.container && secao.container.scrollIntoView) {
      var suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      secao.container.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    }
  }

  /* ---------- progresso e estado de preenchimento ---------- */

  function camposDe(raiz) {
    if (!raiz) return [];
    return Array.prototype.filter.call(
      raiz.querySelectorAll('input, select, textarea'),
      function (campo) {
        var tipo = (campo.type || '').toLowerCase();
        return tipo !== 'button' && tipo !== 'submit' && tipo !== 'reset' && tipo !== 'hidden';
      }
    );
  }

  function preenchido(campo) {
    if (campo.type === 'checkbox' || campo.type === 'radio') return campo.checked;
    return String(campo.value || '').trim() !== '';
  }

  function atualizarEstado() {
    var total = 0;
    var cheios = 0;

    itens.forEach(function (item) {
      var campos = camposDe(item.secao.container);
      var cheiosSecao = campos.filter(preenchido).length;

      total += campos.length;
      cheios += cheiosSecao;

      item.botao.classList.toggle('preenchida', cheiosSecao > 0);
    });

    var porcentagem = total > 0 ? Math.round((cheios / total) * 100) : 0;
    if (barra) barra.style.width = porcentagem + '%';
    if (pct) pct.textContent = porcentagem + '% preenchido';
  }

  /* ---------- seção ativa conforme a rolagem ---------- */

  var agendado = false;

  function marcarAtiva() {
    agendado = false;
    var alvo = null;
    var referencia = window.innerHeight * 0.3;

    itens.forEach(function (item) {
      if (!item.secao.container) return;
      var topo = item.secao.container.getBoundingClientRect().top;
      if (topo <= referencia) alvo = item;
    });

    if (!alvo && itens.length) alvo = itens[0];

    itens.forEach(function (item) {
      item.botao.classList.toggle('ativo', item === alvo);
    });
  }

  function aoRolar() {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(marcarAtiva);
  }

  /* ---------- inicialização ---------- */

  function iniciar() {
    var conteudo = document.getElementById('main-content');
    if (!conteudo) return;

    var secoes = mapearSecoes();
    if (!secoes.length) return;

    montarNav(secoes);
    atualizarEstado();
    marcarAtiva();

    document.addEventListener('input', atualizarEstado, true);
    document.addEventListener('change', atualizarEstado, true);
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar, { passive: true });

    // os módulos inserem linhas depois; reavalia quando o formulário muda
    var observador = new MutationObserver(function () {
      atualizarEstado();
    });
    observador.observe(conteudo, { childList: true, subtree: true });
  }

  function esperarConteudo() {
    var conteudo = document.getElementById('main-content');
    if (!conteudo) return;

    if (conteudo.style.display !== 'none') {
      iniciar();
      return;
    }

    // #main-content só aparece depois que o diagnóstico carrega
    var observador = new MutationObserver(function () {
      if (conteudo.style.display !== 'none') {
        observador.disconnect();
        iniciar();
      }
    });
    observador.observe(conteudo, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', esperarConteudo);
  } else {
    esperarConteudo();
  }
})();
