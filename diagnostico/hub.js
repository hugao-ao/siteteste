/*
 * hub.js — Hub do Diagnóstico Financeiro v2 (avatar + anel de cards + modais + relatório vivo)
 *
 * O QUE ESTE ARQUIVO FAZ
 * ----------------------
 * Depois que a página termina de carregar o diagnóstico (evento 'diagnostico:carregado'),
 * este script REORGANIZA a apresentação da página sem alterar nenhum campo de captação:
 *   - adiciona a classe `hub-ativo` ao <body> (o hub.css só age sob essa classe);
 *   - monta `#hub-root` no início de `#main-content` com uma barra superior (topbar),
 *     um palco central com o avatar do cliente, um anel de 15 cards (apresentação + 14 seções)
 *     e o botão dourado "Gerar Diagnóstico";
 *   - MOVE as 14 seções (`#secao-<slug>`) do formulário para um armazém oculto e as leva ao
 *     modal quando o card correspondente é clicado — os módulos continuam renderizando nos
 *     mesmos containers, porque localizam tudo por id;
 *   - move a apresentação do Canva (UMA vez, na inicialização) para um "teatro" (overlay),
 *     o botão de voltar, o badge de status e os botões flutuantes para a topbar, e as
 *     mensagens de erro/sucesso para toasts;
 *   - abre o relatório consolidado (window.RelatorioDiagnostico, dono H3) e adota dentro dele o
 *     painel "Informações faltantes" do validador (#painel-info-faltantes → #rel-faltantes-slot);
 *     o gabarito das questões (#gabarito-questoes-container) NÃO é mais adotado — fica onde o
 *     módulo o cria e o hub.css o esconde;
 *   - mantém progresso e estado dos cards atualizados (debounce + MutationObserver).
 *
 * REVERSÍVEL: remover este <script> (e o hub.css) do HTML devolve a página ao layout linear.
 * Nada no inline do HTML depende do hub. Nenhum id/name/função existente é renomeado ou removido.
 *
 * Vocabulário de DOM (ids/classes) combinado com o hub.css: ver DESIGN-hub-v2.md, seção 5.
 * API pública: window.Hub = { abrirSecao, fecharModal, abrirRelatorio, abrirTeatro, atualizarProgresso, SECOES }.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------
  // Catálogo das seções (ordem no anel, sentido horário a partir do topo)
  // Título/ícone das 13 seções com cabeçalho são lidos do próprio
  // `.section-header h3` em lerCatalogo(); os valores abaixo são só fallback.
  // ------------------------------------------------------------
  var CATALOGO = [
    { slug: 'apresentacao', titulo: 'Apresentação', icone: 'fa-play', especial: true },
    { slug: 'dados-pessoais', titulo: 'Dados pessoais', icone: 'fa-user', fixo: true },
    { slug: 'pessoas-renda', titulo: 'Pessoas com renda', icone: 'fa-users' },
    { slug: 'dependentes', titulo: 'Dependentes', icone: 'fa-child' },
    { slug: 'patrimonio-fisico', titulo: 'Patrimônio físico', icone: 'fa-home' },
    { slug: 'patrimonio-liquido', titulo: 'Patrimônio líquido', icone: 'fa-coins' },
    { slug: 'dividas', titulo: 'Dívidas', icone: 'fa-file-invoice-dollar' },
    { slug: 'sucessao', titulo: 'Sucessão', icone: 'fa-scroll' },
    { slug: 'produtos-protecao', titulo: 'Proteção', icone: 'fa-shield-alt' },
    { slug: 'ir', titulo: 'Imposto de Renda', icone: 'fa-file-invoice' },
    { slug: 'contas-cartoes', titulo: 'Contas e cartões', icone: 'fa-wallet' },
    { slug: 'fluxo-caixa', titulo: 'Fluxo de caixa', icone: 'fa-exchange-alt' },
    { slug: 'objetivos', titulo: 'Objetivos', icone: 'fa-bullseye' },
    { slug: 'perfil-financeiro', titulo: 'Perfil financeiro', icone: 'fa-user-circle' },
    { slug: 'adesao-plano', titulo: 'Adesão', icone: 'fa-handshake' }
  ];

  // As 14 seções com dados (sem a apresentação)
  var SECOES = CATALOGO.filter(function (s) { return !s.especial; });

  var PASSO_GRAUS = 360 / CATALOGO.length; // 15 itens → 24°
  var ANGULO_INICIAL = -90;                // apresentação no topo
  var QTD_PARTICULAS = 24;
  var QTD_ARCOS = SECOES.length;           // 14 arcos no anel do avatar

  // Emoji por perfil financeiro (mesmos ids do objetivos-module / perfil-financeiro.js)
  var EMOJIS_PERFIL = {
    dividas_impagaveis: '🚨',
    dividas_pagaveis: '⚠️',
    zero_a_zero_obrigatorio: '🔒',
    zero_a_zero_opcional: '🎭',
    fluxo_positivo: '💧',
    poupador: '🐷',
    investidor_amador: '📈',
    investidor_planejador: '🎯'
  };

  // Nomes dos planos de acompanhamento (fallback quando o objetivos-module não expõe a lista)
  var NOMES_PLANOS = {
    nivel_1: 'HV Nível I',
    nivel_2: 'HV Nível II',
    nivel_3: 'HV Nível III',
    nivel_4: 'HV Nível IV',
    nivel_5: 'HV Nível V'
  };

  // Getters de lista por seção (todos opcionais; contam itens em memória)
  var CONTADORES_LISTA = {
    'pessoas-renda': function () { return tamanho(window.pessoasRenda); },
    'dependentes': function () { return tamanho(window.dependentes); },
    'patrimonio-fisico': function () { return tamanho(window.patrimonios); },
    'patrimonio-liquido': function () { return tamanho(chamar('getPatrimoniosLiquidosData')); },
    'dividas': function () { return tamanho(chamar('getDividasData')); },
    'produtos-protecao': function () { return tamanho(chamar('getProdutosProtecaoData')); },
    'contas-cartoes': function () {
      var d = chamar('getContasCartoesData');
      if (Array.isArray(d)) return d.length;
      return d && d.contasCartoes ? tamanho(d.contasCartoes) : 0;
    },
    'fluxo-caixa': function () {
      var d = chamar('getFluxoCaixaData') || {};
      return tamanho(d.receitas) + tamanho(d.despesas);
    },
    'objetivos': function () {
      var d = chamar('getObjetivosData') || {};
      // O módulo cria uma aposentadoria automática quando a lista está vazia: ela só conta
      // como dado do cliente depois que recebe algum valor.
      return (Array.isArray(d.objetivos) ? d.objetivos : []).filter(function (o) {
        if (!o) return false;
        if (o.tipo !== 'aposentadoria') return true;
        return numeroDe(o.renda_anual) > 0 || numeroDe(o.valor_inicial) > 0 || numeroDe(o.aporte_mensal_personalizado) > 0;
      }).length;
    }
  };

  // Valores "de fábrica" que os módulos renderizam nos inputs e que NÃO são dados do cliente
  var SUCESSAO_PADRAO = { itcmd: 4, emolumentos: 1, honorarios: 6 };   // sucessao-module.js (dadosSucessao)
  var RE_VALOR_ZERO = /^(R\$\s*)?0+([.,]0+)?\s*%?$/;                    // "R$ 0,00", "0", "0,00", "0%"
  // Blocos que os módulos/inline escondem com estilo inline (cônjuge sem casamento, IR "não declara")
  var SELETOR_OCULTO_INLINE = '[style*="display: none"], [style*="display:none"]';

  // Erros que saveDiagnostico (inline do HTML) emite de forma síncrona antes de gravar; ele tenta
  // focar o campo, mas o campo está oculto no armazém quando a seção não é a aberta — o hub leva
  // o consultor até a seção certa. Ordem importa (cônjuge antes do titular).
  var ERROS_INLINE = [
    { re: /cpf do c[oô]njuge/i, slug: 'dados-pessoais', id: 'conjuge_cpf' },
    { re: /e-?mail do c[oô]njuge/i, slug: 'dados-pessoais', id: 'conjuge_email' },
    { re: /nome do c[oô]njuge/i, slug: 'dados-pessoais', id: 'conjuge_nome' },
    { re: /cpf/i, slug: 'dados-pessoais', id: 'cpf' },
    { re: /data de nascimento|18 anos/i, slug: 'dados-pessoais', id: 'data_nascimento' },
    { re: /e-?mail/i, slug: 'dados-pessoais', id: 'email' },
    { re: /pessoa \d+/i, slug: 'pessoas-renda', id: null },
    { re: /dependente \d+/i, slug: 'dependentes', id: null },
    { re: /patrim[oô]nio \d+/i, slug: 'patrimonio-fisico', id: null },
    { re: /perfil financeiro/i, slug: 'perfil-financeiro', id: 'obs_perfil_financeiro' }
  ];

  // ------------------------------------------------------------
  // Estado e referências
  // ------------------------------------------------------------
  var estado = {
    iniciado: false,
    anelAberto: false,
    slugAberto: null,        // seção no modal
    modalAberto: false,
    teatroAberto: false,
    teatroTravou: false,     // o teatro travou o fundo (só no celular/grade)
    relatorioAberto: false,
    vistoApresentacao: false,
    emGrade: false
  };

  var refs = {};      // elementos do hub
  var cards = {};     // slug → { el, sub, ponto, titulo }
  var arcos = {};     // slug → path do anel do avatar
  var temporizadores = {};

  // ------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------
  function $(id) { return document.getElementById(id); }

  function tamanho(x) { return Array.isArray(x) ? x.length : 0; }

  // Número a partir de um valor em memória (number) ou de um campo formatado em pt-BR
  // ("R$ 1.234,56") — mesma regra do parseMoeda do inline: fica só dígitos e vírgula.
  function numeroDe(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v === null || v === undefined ? '' : v).replace(/[^\d,]/g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function chamar(nomeGetter) {
    try {
      return typeof window[nomeGetter] === 'function' ? window[nomeGetter]() : null;
    } catch (e) {
      return null;
    }
  }

  // Cria elemento. attrs: { class, text, html, ...atributos }. filhos: array de nós/strings.
  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v; // só para svg/estrutura fixa
        else e.setAttribute(k, v);
      });
    }
    if (filhos) {
      filhos.forEach(function (f) {
        if (f === null || f === undefined) return;
        e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
      });
    }
    return e;
  }

  function icone(classe) {
    return el('i', { class: 'fas ' + classeIconeSegura(classe), 'aria-hidden': 'true' });
  }

  function classeIconeSegura(classe) {
    return /^fa-[a-z0-9-]+$/.test(String(classe || '')) ? classe : 'fa-circle';
  }

  // Escritas guardadas: só mexem no DOM quando algo muda (evita loops entre observadores)
  function setTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }
  function setClasse(elemento, classe, ligado) {
    if (!elemento) return;
    if (elemento.classList.contains(classe) !== !!ligado) elemento.classList.toggle(classe, !!ligado);
  }
  // Oculta com `hidden` E `style.display` (um `display:` do CSS venceria o atributo sozinho)
  function setOculto(elemento, oculto) {
    if (!elemento) return;
    oculto = !!oculto;
    if (elemento.hidden !== oculto) elemento.hidden = oculto;
    var alvo = oculto ? 'none' : '';
    if (elemento.style.display !== alvo) elemento.style.display = alvo;
  }
  function setAtributo(elemento, nome, valor) {
    if (elemento && elemento.getAttribute(nome) !== valor) elemento.setAttribute(nome, valor);
  }
  function setVar(elemento, nome, valor) {
    if (elemento && elemento.style.getPropertyValue(nome) !== valor) elemento.style.setProperty(nome, valor);
  }
  function setEstilo(elemento, prop, valor) {
    if (elemento && elemento.style[prop] !== valor) elemento.style[prop] = valor;
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn(); }, ms);
    };
  }

  function movimentoReduzido() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Trava do fundo enquanto um overlay está aberto. Abaixo de 900px o hub.css põe o body em
  // position:fixed (iOS): sem guardar/restaurar o scrollY a página pularia para o topo ao abrir
  // e ficaria lá ao fechar. No desktop o `top` inline é inócuo (o body não é fixed).
  var scrollGuardado = 0;
  function travarFundo() {
    if (document.body.classList.contains('hub-modal-aberto')) return; // já travado (troca de overlay)
    scrollGuardado = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    document.body.style.top = (-scrollGuardado) + 'px';
    document.body.classList.add('hub-modal-aberto');
  }
  function destravarFundo() {
    if (!document.body.classList.contains('hub-modal-aberto')) return;
    document.body.classList.remove('hub-modal-aberto');
    document.body.style.top = '';
    try { window.scrollTo(0, scrollGuardado); } catch (e) { /* sem rolagem */ }
  }

  // Overlays dos módulos (novo produto, tipos de proteção, contas, manutenção do plano…) são
  // filhos diretos do <body>, position:fixed e z-index ≥ 10000, por cima do modal do hub.
  function haOverlayDeModulo() {
    var filhos = document.body.children;
    for (var i = 0; i < filhos.length; i++) {
      var n = filhos[i];
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK') continue;
      if (refs.root && (n === refs.root || n.contains(refs.root))) continue; // o hub vive em .container
      var cs;
      try { cs = window.getComputedStyle(n); } catch (e) { continue; }
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      if ((parseInt(cs.zIndex, 10) || 0) >= 10000) return true;
    }
    return false;
  }

  // Fecha o overlay só quando o GESTO começou no fundo: um click nasce no ancestral comum de
  // mousedown/mouseup, então arrastar uma seleção de dentro da janela até o fundo geraria
  // um click no overlay e fecharia a seção no meio da edição.
  function fecharAoClicarNoFundo(overlay, fechar) {
    var inicio = null;
    overlay.addEventListener('pointerdown', function (e) { inicio = e.target; });
    overlay.addEventListener('click', function (e) {
      var comecouNoFundo = inicio === null || inicio === overlay; // sem pointerdown (teclado/emulação): vale o click
      inicio = null;
      if (e.target === overlay && comecouNoFundo) fechar();
    });
  }

  // Foco num campo depois que a seção entrou no modal (o hook de 50 ms de abrirSecao já passou)
  function focarDepois(campo) {
    if (!campo) return;
    setTimeout(function () {
      try { campo.focus({ preventScroll: true }); } catch (e) { try { campo.focus(); } catch (e2) { /* sem foco */ } }
      try { campo.scrollIntoView({ block: 'center', behavior: movimentoReduzido() ? 'auto' : 'smooth' }); } catch (e3) { /* sem rolagem */ }
    }, 80);
  }

  function textoSemIcone(h3) {
    if (!h3) return '';
    var clone = h3.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('i, svg'), function (i) { i.remove(); });
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function classeFaDe(iEl) {
    if (!iEl) return '';
    var classes = String(iEl.className || '').split(/\s+/);
    for (var k = 0; k < classes.length; k++) {
      if (/^fa-/.test(classes[k]) && !/^fa-(solid|regular|brands|fw|lg|xs|sm|\dx)$/.test(classes[k])) return classes[k];
    }
    return '';
  }

  function iniciaisDe(nome) {
    var partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  function plural(n, singular, pluralTxt) {
    return n + ' ' + (n === 1 ? singular : pluralTxt);
  }

  function itemCatalogo(slug) {
    for (var i = 0; i < CATALOGO.length; i++) if (CATALOGO[i].slug === slug) return CATALOGO[i];
    return null;
  }

  function indiceSecao(slug) {
    for (var i = 0; i < SECOES.length; i++) if (SECOES[i].slug === slug) return i;
    return -1;
  }

  // Localiza o bloco `#secao-<slug>`; para os três blocos sem id no markup original,
  // usa o botão `#toggle-<slug>` e registra o id (mesmo id que o dono H4 acrescenta).
  function secaoEl(slug) {
    var e = $('secao-' + slug);
    if (e) return e;
    var toggle = $('toggle-' + slug);
    if (toggle) {
      e = toggle.closest('.form-container');
      if (e && !e.id) e.id = 'secao-' + slug;
      return e || null;
    }
    return null;
  }

  // ------------------------------------------------------------
  // Boot: espera o diagnóstico carregar
  // ------------------------------------------------------------
  function boot() {
    var main = $('main-content');
    var form = $('diagnostico-form');
    if (!main || !form) return; // página v1 ou quebrada: não faz nada

    var feito = false;
    var observador = null;
    function ir() {
      if (feito) return;
      feito = true;
      if (observador) observador.disconnect();
      // deixa o inline terminar o que estiver fazendo no mesmo tick
      setTimeout(iniciar, 0);
    }

    document.addEventListener('diagnostico:carregado', ir);

    if (main.style.display !== 'none') {
      ir();
      return;
    }
    // Fallback: #main-content sai de display:none quando o diagnóstico carrega
    if (typeof MutationObserver !== 'undefined') {
      observador = new MutationObserver(function () {
        if (main.style.display !== 'none') ir();
      });
      observador.observe(main, { attributes: true, attributeFilter: ['style'] });
    }
  }

  // ------------------------------------------------------------
  // Inicialização (idempotente)
  // ------------------------------------------------------------
  function iniciar() {
    if (estado.iniciado || $('hub-root')) return;
    var main = $('main-content');
    var form = $('diagnostico-form');
    if (!main || !form) return;
    estado.iniciado = true;

    document.body.classList.add('hub-ativo');
    form.noValidate = true; // as seções saem do <form>; a validação real é feita em saveDiagnostico

    garantirSecaoDadosPessoais(form);
    lerCatalogo();

    montarRoot(main);
    montarTopbar();
    montarPalco();
    montarArmazem();
    montarModal();
    montarTeatro();
    montarRelatorio();
    montarToasts();

    moverSecoes();
    moverCanva();
    adotarPaineis();

    ligarEventos();
    ajustarResponsivo();
    atualizarIniciais();
    atualizarProgresso();
  }

  // Envolve o trecho de dados pessoais do titular em #secao-dados-pessoais quando o HTML
  // ainda não trouxe o wrapper (dono H4). Nada dentro muda.
  function garantirSecaoDadosPessoais(form) {
    if ($('secao-dados-pessoais')) return;
    var filhos = Array.prototype.slice.call(form.children);
    var corte = -1;
    for (var i = 0; i < filhos.length; i++) {
      if (filhos[i].classList && filhos[i].classList.contains('form-container')) { corte = i; break; }
    }
    if (corte === -1) corte = filhos.length;
    if (corte === 0) return; // nada antes do primeiro bloco aninhado
    var wrapper = el('div', { class: 'form-container hub-secao-raiz', id: 'secao-dados-pessoais' });
    form.insertBefore(wrapper, filhos[0]);
    for (var j = 0; j < corte; j++) wrapper.appendChild(filhos[j]);
  }

  // Título e ícone de cada seção vêm do próprio cabeçalho (.section-header h3)
  function lerCatalogo() {
    CATALOGO.forEach(function (item) {
      if (item.especial || item.fixo) return;
      var secao = secaoEl(item.slug);
      if (!secao) return;
      var h3 = secao.querySelector('.section-header h3');
      if (!h3) return;
      var titulo = textoSemIcone(h3);
      var ic = classeFaDe(h3.querySelector('i'));
      if (titulo) item.titulo = titulo;
      if (ic) item.icone = ic;
    });
  }

  // ------------------------------------------------------------
  // Montagem do DOM
  // ------------------------------------------------------------
  function montarRoot(main) {
    refs.root = el('div', { id: 'hub-root' });
    main.insertBefore(refs.root, main.firstChild);
  }

  function montarTopbar() {
    var esq = el('div', { id: 'hub-topbar-esq' });
    var centro = el('div', { id: 'hub-topbar-centro' });
    var dir = el('div', { id: 'hub-topbar-dir' });
    refs.topbar = el('div', { id: 'hub-topbar' }, [esq, centro, dir]);
    refs.root.appendChild(refs.topbar);

    // Esquerda: botão voltar (movido), nome do cliente, badge de status (movido)
    var btnVoltar = document.querySelector('.btn-voltar');
    if (btnVoltar) esq.appendChild(btnVoltar);

    var titulo = $('diagnostico-title');
    refs.cliente = el('span', { id: 'hub-cliente', text: titulo ? titulo.textContent.trim() : 'Diagnóstico Financeiro' });
    esq.appendChild(refs.cliente);

    var badge = $('status-badge');
    if (badge) esq.appendChild(badge);

    // Centro: progresso
    refs.progressoFill = el('div', { class: 'hub-progresso-fill' });
    refs.progresso = el('div', { id: 'hub-progresso', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(SECOES.length), 'aria-valuenow': '0' }, [
      el('div', { class: 'hub-progresso-track' }, [refs.progressoFill])
    ]);
    refs.progressoTxt = el('span', { id: 'hub-progresso-txt', text: '0 de ' + SECOES.length + ' seções com dados' });
    centro.appendChild(refs.progresso);
    centro.appendChild(refs.progressoTxt);

    // Direita: botões flutuantes (movidos) + relatório + salvar
    var btnPrefill = $('btn-prefill-cadastro');
    if (btnPrefill) dir.appendChild(btnPrefill);
    var btnPdf = $('btn-gerar-pdf');
    if (btnPdf) {
      dir.appendChild(btnPdf);
      btnPdf.style.display = 'none'; // fica oculto no hub (o inline pode tê-lo exibido antes)
    }

    refs.btnRelatorio = el('button', { type: 'button', id: 'hub-btn-relatorio', class: 'hub-btn', title: 'Abrir o relatório consolidado' }, [
      icone('fa-file-lines'), el('span', { text: 'Relatório' })
    ]);
    refs.btnSalvar = el('button', { type: 'button', id: 'hub-btn-salvar', class: 'hub-btn hub-btn-ouro', title: 'Salvar o diagnóstico (Ctrl+S)' }, [
      icone('fa-save'), el('span', { text: 'Salvar' })
    ]);
    dir.appendChild(refs.btnRelatorio);
    dir.appendChild(refs.btnSalvar);
  }

  function montarPalco() {
    refs.palco = el('div', { id: 'hub-palco' });
    refs.root.appendChild(refs.palco);

    // Partículas (H2 anima por --i)
    refs.particulas = el('div', { id: 'hub-particulas', 'aria-hidden': 'true' });
    for (var p = 0; p < QTD_PARTICULAS; p++) {
      var s = el('span', { class: 'hub-particula' });
      s.style.setProperty('--i', String(p));
      // posição/duração pseudoaleatórias, mas determinísticas (sem "pulo" ao reiniciar)
      s.style.setProperty('--x', String((p * 37 + 11) % 100));
      s.style.setProperty('--dur', String(18 + ((p * 7) % 13)) + 's');
      refs.particulas.appendChild(s);
    }
    refs.palco.appendChild(refs.particulas);

    // Anel de cards
    // role="group" (não "list"): os cards são <button>; um role="listitem" neles apagaria a semântica de botão
    refs.anel = el('div', { id: 'hub-anel', role: 'group', 'aria-label': 'Seções do diagnóstico' });
    CATALOGO.forEach(function (item, i) {
      var card = criarCard(item, i);
      refs.anel.appendChild(card.el);
      cards[item.slug] = card;
    });
    refs.palco.appendChild(refs.anel);

    // Avatar
    montarAvatar();
    refs.palco.appendChild(refs.avatar);

    // Gerar Diagnóstico (docado abaixo do avatar)
    refs.gerar = el('button', { type: 'button', id: 'hub-gerar', class: 'hub-card hub-card-ouro', title: 'Abrir o relatório consolidado do diagnóstico' }, [
      el('span', { class: 'hub-card-icone' }, [icone('fa-wand-magic-sparkles')]),
      el('span', { class: 'hub-card-titulo', text: 'Gerar Diagnóstico' }),
      el('span', { class: 'hub-card-sub', text: 'Relatório ao vivo' })
    ]);
    refs.palco.appendChild(refs.gerar);
  }

  function criarCard(item, i) {
    var ang = ANGULO_INICIAL + i * PASSO_GRAUS;
    var classes = 'hub-card' + (item.especial ? ' hub-card-apresentacao' : '');
    var sub = el('span', { class: 'hub-card-sub', text: item.especial ? 'Canva' : 'Sem dados' });
    var ponto = el('span', { class: 'hub-card-ponto vazio', 'aria-hidden': 'true' });
    var titulo = el('span', { class: 'hub-card-titulo', text: item.titulo });
    var cardEl = el('button', { type: 'button', class: classes, 'data-slug': item.slug, title: item.titulo, tabindex: '-1' }, [
      el('span', { class: 'hub-card-icone' }, [icone(item.icone)]),
      titulo,
      sub,
      ponto
    ]);
    cardEl.style.setProperty('--i', String(i));
    cardEl.style.setProperty('--ang', ang + 'deg');
    cardEl.style.setProperty('--raio', '300px');
    cardEl.addEventListener('click', function () { abrirSecao(item.slug); });
    return { el: cardEl, sub: sub, ponto: ponto, titulo: titulo, item: item };
  }

  function montarAvatar() {
    refs.avatar = el('button', { type: 'button', id: 'hub-avatar', 'aria-expanded': 'false', 'aria-label': 'Abrir o diagnóstico' });

    refs.avatarHalo = el('span', { id: 'hub-avatar-halo', 'aria-hidden': 'true' });
    refs.avatar.appendChild(refs.avatarHalo);

    // Anel de 14 arcos (um por seção) — svg de estrutura fixa
    var svgAnel = el('div', { html: montarSvgArcos() }).firstElementChild;
    refs.avatarAnel = svgAnel;
    Array.prototype.forEach.call(svgAnel.querySelectorAll('.hub-arco'), function (path) {
      arcos[path.getAttribute('data-slug')] = path;
    });
    refs.avatar.appendChild(svgAnel);

    // Silhueta neutra (cabeça + ombros)
    var silhueta = el('div', { html:
      '<svg id="hub-avatar-silhueta" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
        '<circle cx="50" cy="36" r="17" fill="#f0f8f0" fill-opacity="0.35"></circle>' +
        '<path d="M16 94 C16 66 84 66 84 94 Z" fill="#f0f8f0" fill-opacity="0.35"></path>' +
      '</svg>' }).firstElementChild;
    refs.avatarSilhueta = silhueta;
    refs.avatar.appendChild(silhueta);

    refs.avatarIniciais = el('span', { id: 'hub-avatar-iniciais', 'aria-hidden': 'true' });
    refs.avatar.appendChild(refs.avatarIniciais);

    refs.avatarBadge = el('span', { id: 'hub-avatar-badge' });
    setOculto(refs.avatarBadge, true); // aparece só quando há perfil calculado/vigente
    refs.avatar.appendChild(refs.avatarBadge);

    refs.avatarDica = el('span', { id: 'hub-avatar-dica', text: 'Clique para abrir o diagnóstico' });
    refs.avatar.appendChild(refs.avatarDica);

    refs.avatar.addEventListener('click', alternarAnel);
  }

  // 14 arcos iguais em volta do avatar, a partir do topo, sentido horário
  function montarSvgArcos() {
    var cx = 100, cy = 100, r = 92;
    var passo = 360 / QTD_ARCOS;
    var folga = 6; // graus de respiro entre arcos
    var partes = [];
    for (var k = 0; k < QTD_ARCOS; k++) {
      var a0 = -90 + k * passo + folga / 2;
      var a1 = a0 + passo - folga;
      var p0 = pontoArco(cx, cy, r, a0);
      var p1 = pontoArco(cx, cy, r, a1);
      partes.push(
        '<path class="hub-arco" data-slug="' + SECOES[k].slug + '" ' +
        'd="M ' + p0[0] + ' ' + p0[1] + ' A ' + r + ' ' + r + ' 0 0 1 ' + p1[0] + ' ' + p1[1] + '" ' +
        'fill="none" stroke="rgba(240,248,240,0.18)" stroke-width="6" stroke-linecap="round"></path>'
      );
    }
    return '<svg id="hub-avatar-anel" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' + partes.join('') + '</svg>';
  }

  function pontoArco(cx, cy, r, graus) {
    var rad = graus * Math.PI / 180;
    return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
  }

  function montarArmazem() {
    refs.armazem = el('div', { id: 'hub-armazem', hidden: '', 'aria-hidden': 'true' });
    refs.root.appendChild(refs.armazem);
  }

  function montarModal() {
    refs.modalIcone = el('span', { class: 'hub-modal-icone', 'aria-hidden': 'true' });
    refs.modalTitulo = el('h2', { class: 'hub-modal-titulo', id: 'hub-modal-titulo-txt' });
    refs.modalChip = el('span', { class: 'hub-modal-chip' });
    refs.modalFechar = el('button', { type: 'button', id: 'hub-modal-fechar', class: 'hub-fechar', 'aria-label': 'Fechar (Esc)', title: 'Fechar (Esc)' }, [icone('fa-times')]);
    var cabecalho = el('div', { id: 'hub-modal-cabecalho' }, [refs.modalIcone, refs.modalTitulo, refs.modalChip, refs.modalFechar]);

    refs.modalCorpo = el('div', { id: 'hub-modal-corpo' });

    refs.modalAnterior = el('button', { type: 'button', id: 'hub-modal-anterior', class: 'hub-btn' }, [icone('fa-chevron-left'), el('span', { text: 'Seção anterior' })]);
    refs.modalProximo = el('button', { type: 'button', id: 'hub-modal-proximo', class: 'hub-btn' }, [el('span', { text: 'Próxima seção' }), icone('fa-chevron-right')]);
    refs.modalSalvar = el('button', { type: 'button', id: 'hub-modal-salvar', class: 'hub-btn hub-btn-ouro', title: 'Salvar o diagnóstico (Ctrl+S)' }, [icone('fa-save'), el('span', { text: 'Salvar' })]);
    var rodape = el('div', { id: 'hub-modal-rodape' }, [refs.modalAnterior, refs.modalProximo, refs.modalSalvar]);

    refs.modalJanela = el('div', { class: 'hub-janela', role: 'document' }, [cabecalho, refs.modalCorpo, rodape]);
    refs.modal = el('div', { id: 'hub-modal', class: 'hub-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hub-modal-titulo-txt', 'aria-hidden': 'true' }, [refs.modalJanela]);
    refs.root.appendChild(refs.modal);

    refs.modalFechar.addEventListener('click', fecharModal);
    refs.modalAnterior.addEventListener('click', function () { navegarModal(-1); });
    refs.modalProximo.addEventListener('click', function () { navegarModal(1); });
    refs.modalSalvar.addEventListener('click', salvar);
    fecharAoClicarNoFundo(refs.modal, fecharModal);
  }

  function montarTeatro() {
    refs.teatroFechar = el('button', { type: 'button', id: 'hub-teatro-fechar', class: 'hub-fechar', 'aria-label': 'Fechar (Esc)', title: 'Fechar (Esc)' }, [icone('fa-times')]);
    var cabecalho = el('div', { id: 'hub-teatro-cabecalho' }, [
      el('h2', { id: 'hub-teatro-titulo', text: 'Apresentação' }),
      refs.teatroFechar
    ]);
    refs.teatroCorpo = el('div', { id: 'hub-teatro-corpo' });
    refs.teatroComecar = el('button', { type: 'button', id: 'hub-teatro-comecar', class: 'hub-btn hub-btn-ouro' }, [icone('fa-arrow-right'), el('span', { text: 'Começar o diagnóstico' })]);
    var rodape = el('div', { id: 'hub-teatro-rodape' }, [refs.teatroComecar]);

    refs.teatroJanela = el('div', { class: 'hub-janela-teatro', role: 'document' }, [cabecalho, refs.teatroCorpo, rodape]);
    refs.teatro = el('div', { id: 'hub-teatro', class: 'hub-overlay hub-teatro', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hub-teatro-titulo', 'aria-hidden': 'true' }, [refs.teatroJanela]);
    refs.root.appendChild(refs.teatro);

    refs.teatroFechar.addEventListener('click', fecharTeatro);
    refs.teatroComecar.addEventListener('click', comecarDiagnostico);
    fecharAoClicarNoFundo(refs.teatro, fecharTeatro);
  }

  function montarRelatorio() {
    refs.relatorioTitulo = el('h2', { id: 'hub-relatorio-titulo', class: 'hub-relatorio-titulo', text: 'Diagnóstico' });
    refs.relatorioChips = el('div', { id: 'hub-relatorio-chips', role: 'navigation', 'aria-label': 'Seções do relatório' });
    refs.relatorioImprimir = el('button', { type: 'button', id: 'hub-relatorio-imprimir', class: 'hub-btn', title: 'Imprimir ou salvar em PDF só o relatório' }, [icone('fa-print'), el('span', { text: 'PDF/Imprimir' })]);
    refs.relatorioFechar = el('button', { type: 'button', id: 'hub-relatorio-fechar', class: 'hub-fechar', 'aria-label': 'Fechar (Esc)', title: 'Fechar (Esc)' }, [icone('fa-times')]);
    refs.relatorioCabecalho = el('div', { id: 'hub-relatorio-cabecalho' }, [refs.relatorioTitulo, refs.relatorioChips, refs.relatorioImprimir, refs.relatorioFechar]);

    // O relatório (H3) renderiza em #hub-relatorio-corpo e cria lá o #rel-faltantes-slot
    // (dentro de #rel-secao-faltantes), onde o painel do validador é adotado.
    refs.relatorioCorpo = el('div', { id: 'hub-relatorio-corpo' });
    // Estoque OCULTO: guarda o #painel-info-faltantes enquanto o slot ainda não existe
    // (relatório nunca aberto, ou entre um render e outro). Nunca é exibido.
    refs.relatorioPaineis = el('div', { id: 'hub-relatorio-paineis', hidden: '', 'aria-hidden': 'true' });

    // A janela (.hub-janela-relatorio) é o elemento que ROLA — o corpo não tem rolagem própria.
    refs.relatorioJanela = el('div', { class: 'hub-janela-relatorio', role: 'document' }, [refs.relatorioCabecalho, refs.relatorioCorpo, refs.relatorioPaineis]);
    refs.relatorio = el('div', { id: 'hub-relatorio', class: 'hub-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hub-relatorio-titulo', 'aria-hidden': 'true' }, [refs.relatorioJanela]);
    refs.root.appendChild(refs.relatorio);

    refs.relatorioFechar.addEventListener('click', fecharRelatorio);
    refs.relatorioImprimir.addEventListener('click', imprimirRelatorio);
    fecharAoClicarNoFundo(refs.relatorio, fecharRelatorio);
  }

  function montarToasts() {
    refs.toasts = el('div', { id: 'hub-toasts', 'aria-live': 'polite' });
    refs.root.appendChild(refs.toasts);
    var erro = $('error-container');
    var sucesso = $('success-container');
    if (erro) refs.toasts.appendChild(erro);
    if (sucesso) refs.toasts.appendChild(sucesso);

    // Os toasts somem sozinhos depois de alguns segundos (ou ao clicar)
    refs.toasts.addEventListener('click', function (e) {
      var alvo = e.target.closest('#error-container, #success-container');
      if (alvo) alvo.innerHTML = '';
    });
    if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        [erro, sucesso].forEach(function (c) {
          if (!c) return;
          if (temporizadores[c.id]) { clearTimeout(temporizadores[c.id]); temporizadores[c.id] = null; }
          if (c.childNodes.length) {
            temporizadores[c.id] = setTimeout(function () {
              temporizadores[c.id] = null;
              c.innerHTML = '';
            }, c.id === 'error-container' ? 9000 : 5000);
          }
        });
      });
      obs.observe(refs.toasts, { childList: true, subtree: true });
    }
  }

  // ------------------------------------------------------------
  // Movimentação de seções / Canva / painéis
  // ------------------------------------------------------------
  function moverSecoes() {
    SECOES.forEach(function (item) {
      var secao = secaoEl(item.slug);
      if (!secao || secao.parentNode === refs.armazem) return;
      secao.parentNode.insertBefore(document.createComment(' hub: seção movida '), secao);
      refs.armazem.appendChild(secao);
    });
  }

  // Devolve a seção ao armazém mantendo a ordem do catálogo
  function devolverAoArmazem(secao, slug) {
    var idx = indiceSecao(slug);
    for (var j = idx + 1; j < SECOES.length; j++) {
      var proxima = $('secao-' + SECOES[j].slug);
      if (proxima && proxima.parentNode === refs.armazem) {
        refs.armazem.insertBefore(secao, proxima);
        return;
      }
    }
    refs.armazem.appendChild(secao);
  }

  // O .canva-container (com o iframe da apresentação) passa a morar em #hub-teatro-corpo desde a
  // inicialização — movido UMA única vez. Mover um iframe no DOM recarrega o conteúdo, então
  // abrirTeatro/fecharTeatro NÃO o movem mais: o overlay do teatro só é mostrado/escondido.
  function moverCanva() {
    refs.canva = document.querySelector('#main-content .canva-container') || document.querySelector('.canva-container');
    if (refs.canva && refs.teatroCorpo && refs.canva.parentNode !== refs.teatroCorpo) {
      if (refs.canva.parentNode) refs.canva.parentNode.insertBefore(document.createComment(' hub: apresentação movida '), refs.canva);
      refs.teatroCorpo.appendChild(refs.canva);
    }
  }

  // Slot que o relatório (H3) cria dentro de #rel-secao-faltantes para receber o painel do
  // validador. Só vale se estiver mesmo dentro do corpo do relatório.
  function slotFaltantes() {
    var slot = $('rel-faltantes-slot');
    return slot && refs.relatorioCorpo && refs.relatorioCorpo.contains(slot) ? slot : null;
  }

  // Painel "Informações faltantes" (validador) vive dentro do relatório: no #rel-faltantes-slot
  // quando o relatório já renderizou, senão no estoque oculto #hub-relatorio-paineis.
  // O gabarito das questões (#gabarito-questoes-container) NÃO é mais adotado.
  function adotarPaineis() {
    var painel = $('painel-info-faltantes');
    if (painel) {
      var destino = slotFaltantes() || refs.relatorioPaineis;
      if (destino && painel.parentNode !== destino) destino.appendChild(painel);
    }
    expulsarGabarito();
  }

  // O questoes-module cria o gabarito "logo após #painel-info-faltantes" quando este existe —
  // ou seja, ele pode nascer dentro do relatório/estoque. Como o gabarito não é mais mostrado,
  // devolve-o a #main-content (onde o módulo o criaria sem o painel; o hub.css o esconde lá).
  function expulsarGabarito() {
    var gabarito = $('gabarito-questoes-container');
    if (!gabarito || !refs.relatorio || !refs.relatorio.contains(gabarito)) return;
    var main = $('main-content');
    if (main) main.appendChild(gabarito);
  }

  // Antes de o relatório re-renderizar (innerHTML apaga o slot e tudo dentro dele), o painel do
  // validador é guardado no estoque para não ser destruído.
  function guardarPainelFaltantes() {
    var painel = $('painel-info-faltantes');
    if (painel && refs.relatorioCorpo && refs.relatorioCorpo.contains(painel)) {
      refs.relatorioPaineis.appendChild(painel);
    }
  }

  // Pede ao validador um painel novo (reflete o estado atual dos dados) e só então o adota.
  // renderPainelFaltantes() remove o painel antigo e anexa o novo a #main-content; o observador
  // de #main-content também o adotaria, mas aqui a adoção é imediata (síncrona).
  function atualizarPainelFaltantes() {
    if (typeof window.renderPainelFaltantes === 'function') {
      try {
        window.renderPainelFaltantes();
      } catch (e) {
        console.warn('Hub: renderPainelFaltantes falhou', e);
      }
    }
    adotarPaineis();
  }

  // ------------------------------------------------------------
  // Anel / avatar
  // ------------------------------------------------------------
  function alternarAnel() {
    abrirAnel(!estado.anelAberto);
  }

  function abrirAnel(aberto) {
    estado.anelAberto = !!aberto;
    setClasse(refs.anel, 'aberto', estado.anelAberto);
    setAtributo(refs.avatar, 'aria-expanded', estado.anelAberto ? 'true' : 'false');
    setAtributo(refs.avatar, 'aria-label', estado.anelAberto ? 'Recolher as seções' : 'Abrir o diagnóstico');
    setOculto(refs.avatarDica, true); // a dica some após o primeiro clique
    Object.keys(cards).forEach(function (slug) {
      cards[slug].el.tabIndex = estado.anelAberto || estado.emGrade ? 0 : -1;
    });
    if (estado.anelAberto) ajustarResponsivo();
  }

  function atualizarIniciais() {
    var nome = $('nome_diagnostico');
    var ini = iniciaisDe(nome ? nome.value : '');
    setTexto(refs.avatarIniciais, ini);
    setClasse(refs.avatar, 'com-iniciais', !!ini);
  }

  // ------------------------------------------------------------
  // Modal de seção
  // ------------------------------------------------------------
  function abrirSecao(slug) {
    if (slug === 'apresentacao') { abrirTeatro(); return; }
    var item = itemCatalogo(slug);
    var secao = secaoEl(slug);
    if (!item || !secao) return;

    if (estado.teatroAberto) fecharTeatro();
    if (estado.relatorioAberto) fecharRelatorio();
    if (estado.slugAberto && estado.slugAberto !== slug) devolverSecaoAberta();

    // Seção entra no modal e é expandida
    refs.modalCorpo.appendChild(secao);
    expandirSecao(slug);

    // Cabeçalho do modal
    refs.modalIcone.innerHTML = '';
    refs.modalIcone.appendChild(icone(item.icone));
    setTexto(refs.modalTitulo, item.titulo);

    Object.keys(cards).forEach(function (s) { setClasse(cards[s].el, 'ativo', s === slug); });

    estado.slugAberto = slug;
    estado.modalAberto = true;
    abrirOverlay(refs.modal);
    travarFundo();
    refs.modalCorpo.scrollTop = 0;
    atualizarNavegacaoModal();
    atualizarChipModal();

    // Hooks de re-render (gráficos precisam da seção visível) + foco
    setTimeout(function () {
      if (estado.slugAberto !== slug) return;
      try {
        if (slug === 'objetivos' && window.renderAnalisesObjetivosInline) window.renderAnalisesObjetivosInline();
        if (slug === 'patrimonio-liquido' && window.renderGraficos) window.renderGraficos();
      } catch (e) {
        console.warn('Hub: hook de re-render falhou', e);
      }
      focarPrimeiroCampo();
    }, 50);
  }

  function expandirSecao(slug) {
    var conteudo = $('content-' + slug);
    var toggle = $('toggle-' + slug);
    if (conteudo) {
      conteudo.classList.remove('collapsed');
      conteudo.classList.add('expanded');
    }
    if (toggle) toggle.classList.remove('collapsed');
  }

  function focarPrimeiroCampo() {
    if (estado.emGrade) return; // em telas pequenas, não puxa o teclado sozinho
    var campo = refs.modalCorpo.querySelector(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
    );
    if (campo && typeof campo.focus === 'function') {
      try { campo.focus({ preventScroll: true }); } catch (e) { campo.focus(); }
    }
  }

  function devolverSecaoAberta() {
    var slug = estado.slugAberto;
    if (!slug) return;
    var secao = secaoEl(slug);
    if (secao && secao.parentNode === refs.modalCorpo) devolverAoArmazem(secao, slug);
    setClasse(cards[slug] && cards[slug].el, 'ativo', false);
    estado.slugAberto = null;
  }

  function fecharModal() {
    if (!estado.modalAberto) return;
    var slugAnterior = estado.slugAberto;
    devolverSecaoAberta();
    estado.modalAberto = false;
    fecharOverlay(refs.modal);
    destravarFundo();
    atualizarProgresso();
    // devolve o foco ao card que estava aberto
    if (slugAnterior && cards[slugAnterior] && estado.anelAberto) {
      try { cards[slugAnterior].el.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
    }
  }

  function navegarModal(direcao) {
    var idx = indiceSecao(estado.slugAberto);
    if (idx === -1) return;
    var alvo = idx + direcao;
    if (alvo < 0 || alvo >= SECOES.length) return;
    abrirSecao(SECOES[alvo].slug);
  }

  function atualizarNavegacaoModal() {
    var idx = indiceSecao(estado.slugAberto);
    refs.modalAnterior.disabled = idx <= 0;
    refs.modalProximo.disabled = idx === -1 || idx >= SECOES.length - 1;
    var anterior = idx > 0 ? SECOES[idx - 1] : null;
    var proximo = idx !== -1 && idx < SECOES.length - 1 ? SECOES[idx + 1] : null;
    setAtributo(refs.modalAnterior, 'title', anterior ? anterior.titulo : 'Primeira seção');
    setAtributo(refs.modalProximo, 'title', proximo ? proximo.titulo : 'Última seção');
  }

  function atualizarChipModal() {
    if (!estado.modalAberto || !estado.slugAberto) return;
    var idx = indiceSecao(estado.slugAberto);
    var info = infoSecao(estado.slugAberto);
    setTexto(refs.modalChip, (idx + 1) + ' de ' + SECOES.length + ' · ' + info.sub);
  }

  // ------------------------------------------------------------
  // Overlays genéricos
  // ------------------------------------------------------------
  function abrirOverlay(overlay) {
    setClasse(overlay, 'aberto', true);
    setAtributo(overlay, 'aria-hidden', 'false');
  }

  function fecharOverlay(overlay) {
    setClasse(overlay, 'aberto', false);
    setAtributo(overlay, 'aria-hidden', 'true');
  }

  // ------------------------------------------------------------
  // Teatro (apresentação do Canva)
  // ------------------------------------------------------------
  // O .canva-container já mora em #hub-teatro-corpo (moverCanva, na inicialização): abrir e
  // fechar só mostram/escondem o overlay — mover o iframe recarregaria a apresentação.
  function abrirTeatro() {
    if (estado.modalAberto) fecharModal();
    if (estado.relatorioAberto) fecharRelatorio();
    estado.teatroAberto = true;
    setClasse(refs.anel, 'em-fundo', true);
    setClasse(cards.apresentacao && cards.apresentacao.el, 'ativo', true);
    abrirOverlay(refs.teatro);
    // No celular (grade) o fundo é travado como nos outros overlays (iOS não rola por baixo);
    // no desktop fica livre, para o anel continuar girando ao fundo da apresentação.
    estado.teatroTravou = false;
    if (estado.emGrade && !document.body.classList.contains('hub-modal-aberto')) {
      travarFundo();
      estado.teatroTravou = true;
    }
    try { refs.teatroComecar.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
  }

  function fecharTeatro() {
    if (!estado.teatroAberto) return;
    estado.teatroAberto = false;
    setClasse(refs.anel, 'em-fundo', false);
    setClasse(cards.apresentacao && cards.apresentacao.el, 'ativo', false);
    fecharOverlay(refs.teatro);
    if (estado.teatroTravou) {
      estado.teatroTravou = false;
      destravarFundo();
    }
  }

  function comecarDiagnostico() {
    fecharTeatro();
    estado.vistoApresentacao = true;
    setClasse(refs.avatar, 'visto-apresentacao', true);
    if (!estado.anelAberto) abrirAnel(true);
    atualizarProgresso();
    abrirSecao('dados-pessoais');
  }

  // ------------------------------------------------------------
  // Relatório vivo
  // ------------------------------------------------------------
  function nomeCliente() {
    var nome = $('nome_diagnostico');
    var v = nome ? String(nome.value || '').trim() : '';
    return v || (refs.cliente ? refs.cliente.textContent.trim() : '') || 'Cliente';
  }

  function abrirRelatorio() {
    if (estado.modalAberto) fecharModal();
    if (estado.teatroAberto) fecharTeatro();
    estado.relatorioAberto = true;
    setTexto(refs.relatorioTitulo, 'Diagnóstico — ' + nomeCliente());
    montarChips();
    renderizarRelatorio(); // já pede o painel de faltantes novo e o adota no slot
    abrirOverlay(refs.relatorio);
    travarFundo();
    // reabrir sempre volta ao topo — quem rola é a janela, não o corpo
    if (refs.relatorioJanela) refs.relatorioJanela.scrollTop = 0;
    refs.relatorioCorpo.scrollTop = 0;
    try { refs.relatorioFechar.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
  }

  function fecharRelatorio() {
    if (!estado.relatorioAberto) return;
    estado.relatorioAberto = false;
    document.body.classList.remove('hub-imprimindo');
    fecharOverlay(refs.relatorio);
    destravarFundo();
  }

  // Render (e re-render ao vivo) do relatório. O H3 injeta HTML + <canvas> do Chart.js em
  // #hub-relatorio-corpo — que fica dentro de #hub-root e NÃO é observado por nenhum
  // MutationObserver do hub (ver ligarEventos), então o Chart.js não realimenta o progresso.
  function renderizarRelatorio() {
    if (!estado.relatorioAberto) return;
    var corpo = refs.relatorioCorpo;
    var janela = refs.relatorioJanela; // o elemento que rola
    var rolagem = janela ? janela.scrollTop : 0;

    guardarPainelFaltantes(); // o innerHTML abaixo apagaria o painel que está no slot

    if (window.RelatorioDiagnostico && typeof window.RelatorioDiagnostico.render === 'function') {
      try {
        window.RelatorioDiagnostico.render(corpo);
      } catch (e) {
        console.warn('Hub: falha ao renderizar o relatório', e);
        corpo.innerHTML = '';
        corpo.appendChild(el('p', { class: 'hub-aviso', text: 'Não foi possível montar o relatório agora. Veja o console para detalhes.' }));
      }
    } else {
      corpo.innerHTML = '';
      corpo.appendChild(el('p', { class: 'hub-aviso', text: 'O relatório consolidado ainda não está disponível nesta página (relatorio-diagnostico.js não carregado).' }));
    }

    atualizarPainelFaltantes(); // painel novo do validador → #rel-faltantes-slot (ou estoque)
    sincronizarChips();
    if (janela) janela.scrollTop = rolagem;
  }

  // Chips do cabeçalho: um por seção do RELATÓRIO, na ordem que RelatorioDiagnostico.secoes()
  // devolve (coleta, gráficos, perfil, matriz, adesão, plano, faltantes…). O catálogo do anel
  // é só fallback quando o relatório não está carregado.
  function montarChips() {
    var lista = null;
    if (window.RelatorioDiagnostico && typeof window.RelatorioDiagnostico.secoes === 'function') {
      try { lista = window.RelatorioDiagnostico.secoes(); } catch (e) { lista = null; }
    }
    if (!Array.isArray(lista) || !lista.length) lista = SECOES;

    refs.relatorioChips.innerHTML = '';
    lista.forEach(function (s) {
      if (!s || !s.slug) return;
      var slug = String(s.slug);
      var titulo = String(s.titulo || slug);
      var chip = el('button', { type: 'button', class: 'hub-chip', 'data-slug': slug, title: titulo }, [
        icone(s.icone || 'fa-circle'),
        el('span', { text: titulo })
      ]);
      chip.addEventListener('click', function () {
        Array.prototype.forEach.call(refs.relatorioChips.children, function (c) { setClasse(c, 'ativo', c === chip); });
        rolarAteSecaoRelatorio(slug);
      });
      refs.relatorioChips.appendChild(chip);
    });
  }

  // Esconde os chips cujo bloco não existe no HTML atual (ex.: "Gráficos" omitido sem dados)
  function sincronizarChips() {
    if (!refs.relatorioChips) return;
    Array.prototype.forEach.call(refs.relatorioChips.children, function (chip) {
      var slug = chip.getAttribute('data-slug');
      setOculto(chip, !secaoRelatorio(slug));
    });
  }

  function secaoRelatorio(slug) {
    if (!slug) return null;
    var alvo = $('rel-secao-' + slug);
    return alvo && refs.relatorioCorpo.contains(alvo) ? alvo : null;
  }

  // Rola a JANELA do relatório até a seção, descontando o cabeçalho sticky (senão o título
  // ficaria escondido atrás dele).
  function rolarAteSecaoRelatorio(slug) {
    var alvo = secaoRelatorio(slug);
    if (!alvo) return;
    var janela = refs.relatorioJanela;
    var suave = movimentoReduzido() ? 'auto' : 'smooth';
    try {
      var cabecalhoAltura = refs.relatorioCabecalho ? refs.relatorioCabecalho.offsetHeight : 0;
      var topo = janela.scrollTop + (alvo.getBoundingClientRect().top - janela.getBoundingClientRect().top) - cabecalhoAltura - 8;
      if (topo < 0) topo = 0;
      if (typeof janela.scrollTo === 'function') janela.scrollTo({ top: topo, behavior: suave });
      else janela.scrollTop = topo;
    } catch (e) {
      try { alvo.scrollIntoView({ behavior: suave, block: 'start' }); } catch (e2) { alvo.scrollIntoView(); }
    }
  }

  function imprimirRelatorio() {
    if (!estado.relatorioAberto) return;
    function limpar() {
      document.body.classList.remove('hub-imprimindo');
      window.removeEventListener('afterprint', limpar);
      // devolve os gráficos ao tamanho da tela
      redimensionarGraficos();
    }
    window.addEventListener('afterprint', limpar);
    // a classe troca o relatório de overlay rolável para documento em fluxo:
    // os canvases mudam de largura e o Chart.js redesenha de forma assíncrona,
    // por isso a impressão espera dois quadros + um respiro antes de disparar
    document.body.classList.add('hub-imprimindo');
    redimensionarGraficos();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(function () {
          redimensionarGraficos();
          try {
            window.print();
          } catch (e) {
            limpar();
          }
        }, 250);
      });
    });
  }

  // Pede ao Chart.js para remedir os canvases do relatório (a troca de
  // layout da impressão muda a largura deles)
  function redimensionarGraficos() {
    if (!window.Chart) return;
    var instancias = window.Chart.instances || (window.Chart.registry && window.Chart.instances);
    try {
      if (instancias) {
        Object.keys(instancias).forEach(function (k) {
          var c = instancias[k];
          if (c && typeof c.resize === 'function') c.resize();
        });
      } else if (typeof window.Chart.getChart === 'function' && refs.relatorioCorpo) {
        Array.prototype.forEach.call(refs.relatorioCorpo.querySelectorAll('canvas'), function (cv) {
          var c = window.Chart.getChart(cv);
          if (c && typeof c.resize === 'function') c.resize();
        });
      }
    } catch (e) {
      /* gráfico sem instância ativa: nada a fazer */
    }
  }

  // ------------------------------------------------------------
  // Salvar e mensagens
  // ------------------------------------------------------------
  function mostrarErro(mensagem) {
    var c = $('error-container');
    var s = $('success-container');
    if (s) s.innerHTML = '';
    if (!c) return;
    c.innerHTML = '';
    c.appendChild(el('div', { class: 'error-message' }, [icone('fa-exclamation-triangle'), ' ' + mensagem]));
  }

  // Abre a seção (se ainda não é a aberta), mostra o erro e leva o foco ao campo
  function irParaErro(slug, campo, mensagem) {
    if (slug && estado.slugAberto !== slug) abrirSecao(slug);
    if (mensagem) mostrarErro(mensagem);
    focarDepois(campo);
  }

  function valorDe(id) {
    var c = $(id);
    return c ? String(c.value || '').trim() : '';
  }

  function rotuloCampo(campo) {
    var label = campo.id ? document.querySelector('label[for="' + campo.id + '"]') : null;
    var txt = label ? textoSemIcone(label).replace(/\*/g, '').trim() : '';
    return txt || campo.name || campo.id || 'campo';
  }

  // As seções saíram do <form> (vivem no armazém): os `required` do titular deixaram de ser
  // exigidos pelo navegador, e as checagens de lista de saveDiagnostico focam campos ocultos.
  // Refaz aqui as mesmas regras, devolvendo { slug, campo, msg } da primeira falha.
  function primeiraFalhaAoSalvar() {
    var secao = secaoEl('dados-pessoais');
    if (secao) {
      var faltando = Array.prototype.filter.call(secao.querySelectorAll('[required]'), function (c) {
        if (c.closest && c.closest(SELETOR_OCULTO_INLINE)) return false; // cônjuge oculto (solteiro)
        return !String(c.value || '').trim();
      });
      if (faltando.length) {
        return {
          slug: 'dados-pessoais',
          campo: faltando[0],
          msg: 'Preencha os campos obrigatórios de Dados pessoais: ' + faltando.map(rotuloCampo).join(', ') + '.'
        };
      }
    }

    var i, id;
    for (i = 0; i < tamanho(window.pessoasRenda); i++) {
      id = 'pessoa_' + i + '_nome';
      if (!valorDe(id)) return { slug: 'pessoas-renda', campo: $(id), msg: 'Nome é obrigatório para a Pessoa ' + (i + 1) + '.' };
    }
    for (i = 0; i < tamanho(window.dependentes); i++) {
      id = 'dependente_' + i + '_nome';
      if (!valorDe(id)) return { slug: 'dependentes', campo: $(id), msg: 'Nome é obrigatório para o Dependente ' + (i + 1) + '.' };
      id = 'dependente_' + i + '_data_nascimento';
      if (!valorDe(id)) return { slug: 'dependentes', campo: $(id), msg: 'Data de nascimento é obrigatória para o Dependente ' + (i + 1) + '.' };
    }
    for (i = 0; i < tamanho(window.patrimonios); i++) {
      id = 'patrimonio_' + i + '_tipo';
      if (!valorDe(id)) return { slug: 'patrimonio-fisico', campo: $(id), msg: 'Tipo de patrimônio é obrigatório para o Patrimônio ' + (i + 1) + '.' };
      id = 'patrimonio_' + i + '_valor';
      if (numeroDe(valorDe(id)) <= 0) return { slug: 'patrimonio-fisico', campo: $(id), msg: 'Valor é obrigatório e deve ser maior que zero para o Patrimônio ' + (i + 1) + '.' };
      var p = window.patrimonios[i] || {};
      if (!tamanho(p.proprietarios)) return { slug: 'patrimonio-fisico', campo: null, msg: 'Pelo menos um proprietário deve ser selecionado para o Patrimônio ' + (i + 1) + '.' };
    }
    return null;
  }

  // Seção/campo a que se refere um erro emitido pelo inline (ver ERROS_INLINE)
  function destinoDoErroInline(texto) {
    for (var i = 0; i < ERROS_INLINE.length; i++) {
      if (ERROS_INLINE[i].re.test(texto)) {
        return { slug: ERROS_INLINE[i].slug, campo: ERROS_INLINE[i].id ? $(ERROS_INLINE[i].id) : null };
      }
    }
    return null;
  }

  function salvar() {
    var nome = $('nome_diagnostico');
    if (!nome || !String(nome.value || '').trim()) {
      irParaErro('dados-pessoais', nome, 'Informe o nome completo do titular antes de salvar.');
      return;
    }
    var falha = primeiraFalhaAoSalvar();
    if (falha) {
      irParaErro(falha.slug, falha.campo, falha.msg);
      return;
    }
    var botao = $('save-btn');
    if (!botao) return;
    var erros = $('error-container');
    if (erros) erros.innerHTML = ''; // só o que saveDiagnostico escrever agora conta
    botao.click(); // o submit do formulário original continua sendo o caminho de salvamento

    // saveDiagnostico valida CPF/data/e-mail/cônjuge/perfil de forma síncrona (antes do primeiro
    // await) e tenta focar o campo — que está oculto quando a seção não é a aberta.
    setTimeout(function () {
      if (!erros || !erros.childNodes.length) return;
      var destino = destinoDoErroInline(erros.textContent || '');
      if (destino) irParaErro(destino.slug, destino.campo, null);
    }, 0);
  }

  // ------------------------------------------------------------
  // Progresso e estado dos cards
  // ------------------------------------------------------------
  function camposDe(secao) {
    var lista = [];
    var cardAuto = secao.querySelector('#perfil-financeiro-auto');
    Array.prototype.forEach.call(secao.querySelectorAll('input, select, textarea'), function (campo) {
      var tipo = (campo.type || '').toLowerCase();
      if (tipo === 'button' || tipo === 'submit' || tipo === 'reset' || tipo === 'hidden') return;
      if (cardAuto && cardAuto.contains(campo)) return;
      // dentro de bloco escondido por estilo inline (cônjuge de quem não é casado, campos de IR
      // de quem "não declara"): não é dado visível do cliente
      if (campo.closest && campo.closest(SELETOR_OCULTO_INLINE)) return;
      lista.push(campo);
    });
    return lista;
  }

  function preenchido(campo) {
    var tipo = (campo.type || '').toLowerCase();
    if (tipo === 'checkbox' || tipo === 'radio') return !!campo.checked;
    // select: a primeira opção é o "padrão" (Selecione…/Não/Quitado) — só conta a partir da segunda
    if (campo.tagName === 'SELECT') return campo.selectedIndex > 0 && String(campo.value || '').trim() !== '';
    var v = String(campo.value || '').trim();
    if (!v) return false;
    // "R$ 0,00" / "0": valor de fábrica dos módulos (IR, adesão…), não é dado do cliente
    if (RE_VALOR_ZERO.test(v)) return false;
    // percentuais da sucessão nascem com 4 / 1 / 6: só contam quando o consultor os alterou
    var m = /^sucessao_(itcmd|emolumentos|honorarios)$/.exec(campo.id || '');
    if (m && parseFloat(v.replace(',', '.')) === SUCESSAO_PADRAO[m[1]]) return false; // input number: decimal com ponto
    return true;
  }

  function contarCampos(slug) {
    var secao = secaoEl(slug);
    if (!secao) return 0;
    var n = 0;
    camposDe(secao).forEach(function (c) { if (preenchido(c)) n++; });
    return n;
  }

  function contarItens(slug) {
    var fn = CONTADORES_LISTA[slug];
    if (!fn) return 0;
    try { return Number(fn()) || 0; } catch (e) { return 0; }
  }

  function resultadoPerfil() {
    try {
      if (window.PerfilFinanceiro && typeof window.PerfilFinanceiro.getResultado === 'function') {
        return window.PerfilFinanceiro.getResultado() || null;
      }
    } catch (e) { /* motor indisponível */ }
    return null;
  }

  function perfilVigente() {
    var r = resultadoPerfil();
    var pf = r && r.perfil_financeiro ? r.perfil_financeiro : null;
    if (!pf) return null;
    var id = pf.vigente || pf.calculado || null;
    if (!id) return null;
    var lista = (window.PerfilFinanceiro && window.PerfilFinanceiro.PERFIS) || [];
    var def = null;
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) { def = lista[i]; break; }
    return { id: id, rotulo: def ? def.rotulo : (pf.rotulo || id), cor: def ? def.cor : '#ffd700' };
  }

  function nomePlanoEscolhido() {
    var d = chamar('getObjetivosData');
    var id = d && d.investimento_assistencia ? d.investimento_assistencia.plano_acompanhamento : '';
    if (!id) return '';
    var lista = Array.isArray(window.PLANOS_ACOMPANHAMENTO) ? window.PLANOS_ACOMPANHAMENTO : [];
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id && lista[i].nome) return String(lista[i].nome);
    return NOMES_PLANOS[id] || String(id);
  }

  // Resumo de uma seção: { campos, itens, tem, sub }
  // Seções de lista (com getter) decidem "tem dados" pelo getter: o DOM delas carrega inputs
  // com valores padrão (ex.: variáveis de mercado em objetivos) que não são dados do cliente.
  function infoSecao(slug) {
    var campos = contarCampos(slug);
    var itens = contarItens(slug);
    var ehLista = !!CONTADORES_LISTA[slug];
    var tem = ehLista ? itens > 0 : campos > 0;
    var sub;

    if (slug === 'perfil-financeiro') {
      var perfil = perfilVigente();
      if (perfil) { sub = perfil.rotulo; tem = true; }
      else sub = campos > 0 ? plural(campos, 'campo', 'campos') : 'A calcular';
    } else if (slug === 'adesao-plano') {
      var plano = nomePlanoEscolhido();
      if (plano) { sub = plano; tem = true; }
      else sub = campos > 0 ? plural(campos, 'campo', 'campos') : 'Sem plano';
    } else if (slug === 'sucessao') {
      // os percentuais nascem com valor de fábrica (preenchido() já os ignora); a seção tem
      // conteúdo quando o consultor os ajustou OU quando há patrimônio sobre o qual o custo
      // sucessório é calculado
      var haPatrimonio = (tamanho(window.patrimonios) + tamanho(chamar('getPatrimoniosLiquidosData'))) > 0;
      tem = campos > 0 || haPatrimonio;
      sub = campos > 0 ? plural(campos, 'campo', 'campos') : (haPatrimonio ? 'Calculada' : 'Sem dados');
    } else if (ehLista) {
      sub = itens > 0 ? plural(itens, 'item', 'itens') : 'Sem dados';
    } else if (campos > 0) {
      sub = plural(campos, 'campo', 'campos');
    } else {
      sub = 'Sem dados';
    }
    return { campos: campos, itens: itens, tem: tem, sub: sub };
  }

  function temDados(slug) {
    return infoSecao(slug).tem;
  }

  function atualizarProgresso() {
    if (!estado.iniciado) return;
    var comDados = 0;

    SECOES.forEach(function (item) {
      var info = infoSecao(item.slug);
      if (info.tem) comDados++;
      var card = cards[item.slug];
      if (card) {
        setTexto(card.sub, info.sub);
        setPonto(card.ponto, info.tem ? 'ok' : 'vazio');
      }
      var arco = arcos[item.slug];
      if (arco) {
        setClasse(arco, 'aceso', info.tem);
        setAtributo(arco, 'stroke', info.tem ? '#ffd700' : 'rgba(240,248,240,0.18)');
      }
    });

    // Card da apresentação
    var cardApres = cards.apresentacao;
    if (cardApres) {
      setTexto(cardApres.sub, estado.vistoApresentacao ? 'Assistida' : 'Canva');
      setPonto(cardApres.ponto, estado.vistoApresentacao ? 'ok' : 'vazio');
    }

    // Barra de progresso
    var pct = Math.round((comDados / SECOES.length) * 100);
    setEstilo(refs.progressoFill, 'width', pct + '%');
    setAtributo(refs.progresso, 'aria-valuenow', String(comDados));
    setTexto(refs.progressoTxt, comDados + ' de ' + SECOES.length + ' seções com dados');

    // Badge do perfil no avatar
    var perfil = perfilVigente();
    if (perfil && EMOJIS_PERFIL[perfil.id]) {
      setTexto(refs.avatarBadge, EMOJIS_PERFIL[perfil.id]);
      setEstilo(refs.avatarBadge, 'borderColor', perfil.cor);
      setAtributo(refs.avatarBadge, 'title', perfil.rotulo);
      setAtributo(refs.avatarBadge, 'aria-label', 'Perfil: ' + perfil.rotulo);
      setOculto(refs.avatarBadge, false);
    } else {
      setOculto(refs.avatarBadge, true);
    }

    atualizarChipModal();
  }

  function setPonto(ponto, valor) {
    ['vazio', 'parcial', 'ok'].forEach(function (c) { setClasse(ponto, c, c === valor); });
  }

  // ------------------------------------------------------------
  // Responsivo: raio do anel por largura do palco; grade abaixo de 900px
  // ------------------------------------------------------------
  function ajustarResponsivo() {
    if (!refs.palco) return;
    var largura = refs.palco.clientWidth || window.innerWidth || 0;
    estado.emGrade = largura < 900;
    setClasse(refs.anel, 'hub-grade', estado.emGrade);
    var raio = largura >= 1200 ? '300px' : '250px';
    Object.keys(cards).forEach(function (slug) {
      setVar(cards[slug].el, '--raio', raio);
      cards[slug].el.tabIndex = estado.anelAberto || estado.emGrade ? 0 : -1;
    });
  }

  // ------------------------------------------------------------
  // Eventos e observadores
  // ------------------------------------------------------------
  function ligarEventos() {
    // Ctrl+P / "imprimir" do navegador com o relatório aberto sai igual ao
    // botão: o mesmo layout de documento, sem o resto do hub
    window.addEventListener('beforeprint', function () {
      if (!estado.relatorioAberto) return;
      if (document.body.classList.contains('hub-imprimindo')) return;
      document.body.classList.add('hub-imprimindo');
      redimensionarGraficos();
    });
    window.addEventListener('afterprint', function () {
      if (!document.body.classList.contains('hub-imprimindo')) return;
      document.body.classList.remove('hub-imprimindo');
      redimensionarGraficos();
    });

    var progressoDebounced = debounce(atualizarProgresso, 300);
    var relatorioDebounced = debounce(renderizarRelatorio, 500);
    var responsivoDebounced = debounce(ajustarResponsivo, 150);

    function aoEditar(e) {
      progressoDebounced();
      if (estado.relatorioAberto) relatorioDebounced();
      if (e && e.target && e.target.id === 'nome_diagnostico') atualizarIniciais();
    }
    document.addEventListener('input', aoEditar, true);
    document.addEventListener('change', aoEditar, true);
    document.addEventListener('diagnostico:salvo', function () {
      progressoDebounced();
      if (estado.relatorioAberto) relatorioDebounced();
    });

    // Módulos re-renderizam dentro das seções (armazém e corpo do modal).
    // Só esses dois containers são observados: o relatório (#hub-relatorio-corpo), onde o H3
    // injeta HTML e os <canvas> do Chart.js a cada render, fica FORA deles — assim um render
    // do relatório não realimenta o progresso (nem o re-render do relatório, evitando loop).
    if (typeof MutationObserver !== 'undefined') {
      var obsSecoes = new MutationObserver(function () { progressoDebounced(); });
      obsSecoes.observe(refs.armazem, { childList: true, subtree: true });
      obsSecoes.observe(refs.modalCorpo, { childList: true, subtree: true });

      // O validador recria #painel-info-faltantes anexando-o a #main-content → adota.
      // childList SEM subtree: só filhos diretos de #main-content; tudo que acontece dentro de
      // #hub-root (relatório, modal, Chart.js) é ignorado — e, por garantia, qualquer nó que
      // esteja dentro de #hub-root é descartado explicitamente.
      var main = $('main-content');
      var obsMain = new MutationObserver(function (mutacoes) {
        var precisa = false;
        for (var i = 0; i < mutacoes.length && !precisa; i++) {
          var adicionados = mutacoes[i].addedNodes;
          for (var j = 0; j < adicionados.length; j++) {
            var n = adicionados[j];
            if (n.nodeType !== 1) continue;
            if (refs.root && (n === refs.root || refs.root.contains(n))) continue;
            if (n.id === 'painel-info-faltantes') { precisa = true; break; }
          }
        }
        if (precisa) adotarPaineis();
      });
      obsMain.observe(main, { childList: true });
    }

    // Topbar / palco
    refs.btnRelatorio.addEventListener('click', abrirRelatorio);
    refs.btnSalvar.addEventListener('click', salvar);
    refs.gerar.addEventListener('click', abrirRelatorio);

    // Teclado: Esc fecha o overlay aberto; Ctrl+S salva.
    // Fase de captura: roda ANTES dos listeners dos módulos (ex.: objetivos-module fecha seu
    // próprio modal no Esc e o remove do DOM) — assim ainda vemos o overlay do módulo aberto e
    // deixamos o Esc para ele, em vez de fechar a seção por baixo.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (haOverlayDeModulo()) return; // um modal de módulo está por cima: o Esc é dele
        if (estado.modalAberto) { e.preventDefault(); fecharModal(); }
        else if (estado.relatorioAberto) { e.preventDefault(); fecharRelatorio(); }
        else if (estado.teatroAberto) { e.preventDefault(); fecharTeatro(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        salvar();
      }
    }, true);

    window.addEventListener('resize', responsivoDebounced, { passive: true });
    window.addEventListener('orientationchange', responsivoDebounced, { passive: true });
  }

  // ------------------------------------------------------------
  // API pública
  // ------------------------------------------------------------
  window.Hub = {
    abrirSecao: abrirSecao,
    fecharModal: fecharModal,
    abrirRelatorio: abrirRelatorio,
    fecharRelatorio: fecharRelatorio,
    abrirTeatro: abrirTeatro,
    fecharTeatro: fecharTeatro,
    atualizarProgresso: atualizarProgresso,
    salvar: salvar,
    temDados: temDados,
    SECOES: CATALOGO,        // 15 itens (apresentação + 14 seções), na ordem do anel
    SECOES_DADOS: SECOES     // só as 14 seções com dados
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
