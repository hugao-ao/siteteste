/* ============================================================
   fluxo-otimizacao-ui.js — Interface do cenário otimizado nos itens (dono U)
   Consome SOMENTE window.FOMotor (fluxo-otimizacao-motor.js) e o DOM da
   tabela de itens (renderItemRowHtml / td.td-otimizacao / .item-nome).
   Carregado depois de fluxo.html e do motor. Sem FOMotor, não faz nada.
   ============================================================ */
(function () {
  'use strict';

  var M = window.FOMotor;
  if (!M) {
    if (window.console) console.warn('[fluxo-otimizacao-ui] FOMotor ausente: interface de otimização não instalada.');
    return;
  }

  // ------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------
  var LS_MODO = 'fluxo_modo_otimizacao';
  var MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // Escapa texto vindo de dados antes de entrar em HTML
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fn(nome) { return typeof window[nome] === 'function' ? window[nome] : null; }

  function listaItens() { return (typeof items !== 'undefined' && items) ? items : []; }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // Moeda completa (usa fmtCurrency global quando existe)
  function moeda(n) {
    n = num(n);
    if (fn('fmtCurrency')) return fmtCurrency(n);
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Moeda compacta para células: sem centavos a partir de R$ 10
  function moedaCurta(n) {
    n = Math.abs(num(n));
    var casas = n >= 10 ? 0 : 2;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }

  // Valor para campo de moeda no formato da máscara (1.234,56)
  function moedaCampo(n) {
    return num(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function lerMoeda(s) {
    if (fn('parseCurrency')) return parseCurrency(s);
    var neg = String(s).indexOf('-') !== -1;
    var v = parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    return neg ? -v : v;
  }

  function pctTexto(p) {
    p = num(p);
    var r = Math.round(p * 100) / 100;
    return r.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  function lerPct(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return null;
    var v = parseFloat(s.replace(/\s|%/g, '').replace(',', '.'));
    return isFinite(v) ? v : null;
  }

  // 'YYYY-MM' → 'nov/26'
  function mesCurto(ym) {
    if (!ym || typeof ym !== 'string' || ym.length < 7) return '';
    var m = parseInt(ym.substring(5, 7), 10) - 1;
    return (MESES_CURTOS[m] || '?') + '/' + ym.substring(2, 4);
  }

  // 'YYYY-MM' → 'nov/2026'
  function mesLongo(ym) {
    if (!ym || typeof ym !== 'string' || ym.length < 7) return '';
    var m = parseInt(ym.substring(5, 7), 10) - 1;
    return (MESES_CURTOS[m] || '?') + '/' + ym.substring(0, 4);
  }

  function dataBR(iso) {
    if (!iso) return '';
    var d = new Date(iso.length <= 10 ? iso + 'T00:00' : iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
  }

  function debounce(f, ms) {
    var t = null;
    var d = function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { t = null; f.apply(self, args); }, ms);
    };
    d.cancelar = function () { clearTimeout(t); t = null; };
    return d;
  }

  function lsLer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsGravar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }

  function periodoValido() {
    try { return !!(fn('getPeriodDates') && getPeriodDates()); } catch (e) { return false; }
  }

  function bloqueado() {
    try { return !!M.bloqueado(); } catch (e) { return false; }
  }

  function cartaoDoItem(it) {
    if (!it || !it.formaPagamento || typeof accounts === 'undefined' || !accounts) return null;
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].id === it.formaPagamento && accounts[i].tipo === 'cartao') return accounts[i];
    }
    return null;
  }

  function ehDespesa(it) { return !!it && it.subtipo === 'despesa'; }
  function ehEntrada(it) { return !!it && it.tipo === 'entrada'; }

  // Texto da economia de um item: saídas com redução mostram "−", entradas com aumento "+"
  function textoEconomia(e, curto) {
    if (!e) return null;
    var media = num(e.mediaMensal);
    if (Math.abs(media) < 0.005 && Math.abs(num(e.periodo)) < 0.005) return null;
    var sinal;
    if (e.ehEntrada) sinal = media >= 0 ? '+' : '−';
    else sinal = media >= 0 ? '−' : '+';
    var classe = media > 0.004 ? 'fo-econ-pos' : (media < -0.004 ? 'fo-econ-neg' : 'fo-econ-zero');
    var valor = sinal + (curto ? moedaCurta(media) : moeda(Math.abs(media))) + '/mês';
    var desde = e.primeiroMes ? 'desde ' + mesCurto(e.primeiroMes) : '';
    // valor e desde separados: na célula, "desde …" pode descer de linha quando falta largura
    return { texto: valor + (desde ? ' ' + desde : ''), valor: valor, desde: desde, classe: classe };
  }

  // Rótulo curto do tipo/categoria (a mesa não tem cabeçalhos de grupo)
  function rotuloTipo(it) {
    if (ehEntrada(it)) return { curto: 'Entrada', completo: 'Entrada' };
    if (it && it.subtipo === 'poupanca') return { curto: 'Poupança', completo: 'Poupança' };
    if (ehDespesa(it)) {
      var cats = (typeof CATEGORIA_LABELS !== 'undefined' && CATEGORIA_LABELS) ? CATEGORIA_LABELS : {};
      var cat = cats[it.categoria] || (it.categoria ? it.categoria : 'Sem categoria');
      return { curto: cat, completo: 'Despesa — ' + cat };
    }
    return { curto: 'Saída', completo: 'Saída' };
  }

  function catHtml(it) {
    var r = rotuloTipo(it);
    return '<span class="fo-cat" title="' + esc(r.completo) + '">' + esc(r.curto) + '</span>';
  }

  function economiaSegura(linkId, usarRascunho) {
    try { return M.economiaDoItem(linkId, usarRascunho); } catch (e) { return null; }
  }

  function estadoSeguro(linkId) {
    try { return M.estadoDoItem(linkId) || 'nenhum'; } catch (e) { return 'nenhum'; }
  }

  // Percentual atual do item: rascunho, senão confirmado, senão 0
  function pctAtual(linkId) {
    var cfg = null;
    try { cfg = M.configEfetiva(linkId, true); } catch (e) { cfg = null; }
    return cfg ? num(cfg.targetPct) : 0;
  }

  // Troca o innerHTML só quando o conteúdo mudou (evita piscar e perder foco)
  function setHtml(el, html) {
    if (!el) return;
    if (el._foH !== html) { el.innerHTML = html; el._foH = html; }
  }

  // ------------------------------------------------------------
  // Estado da interface
  // ------------------------------------------------------------
  var ui = {
    modoOtimizacao: lsLer(LS_MODO) === '1',
    mostrarTodos: false,
    mesaInfo: { visiveis: 0, ocultos: 0 },
    painelLinkId: null
  };

  // ------------------------------------------------------------
  // 6.1 Modo otimização (mesa) e wrapper de renderItemsTable
  // ------------------------------------------------------------

  // Ordem da mesa: despesas alteráveis por pontuação (desc); depois as demais
  // despesas por pontuação e, ao fim, entradas, poupança e outros.
  function ordemMesa() {
    var lista = listaItens();
    var totais = null;
    try { totais = M.totaisDoPeriodo(); } catch (e) { totais = null; }
    var cache = {};
    function score(i) {
      if (cache[i] === undefined) {
        var a = null;
        try { a = M.analiseDoItem(i, totais); } catch (e) { a = null; }
        cache[i] = (a && a.aplicavel) ? num(a.score) : -1;
      }
      return cache[i];
    }
    var alteraveis = [], outrasDesp = [], resto = [];
    lista.forEach(function (it, i) {
      if (ehDespesa(it) && it.alteravel !== 'nao') alteraveis.push(i);
      else if (ehDespesa(it)) outrasDesp.push(i);
      else resto.push(i);
    });
    function porScore(a, b) { var d = score(b) - score(a); return d !== 0 ? d : a - b; }
    alteraveis.sort(porScore);
    outrasDesp.sort(porScore);
    function peso(i) {
      var it = lista[i];
      if (ehEntrada(it)) return 0;
      if (it && it.subtipo === 'poupanca') return 1;
      return 2;
    }
    resto.sort(function (a, b) { var d = peso(a) - peso(b); return d !== 0 ? d : a - b; });
    return { alteraveis: alteraveis, demais: outrasDesp.concat(resto) };
  }

  // Desenha a lista plana da mesa no #items-tbody. Devolve false se não conseguiu.
  function renderMesa() {
    var tbody = document.getElementById('items-tbody');
    var empty = document.getElementById('items-empty');
    var table = document.getElementById('items-table');
    if (!tbody || !empty || !table || !fn('renderItemRowHtml')) return false;
    try { M.ensureItemIds(); M.sincronizar(); } catch (e) { /* motor cuida dos próprios erros */ }
    var lista = listaItens();
    if (lista.length === 0) {
      empty.style.display = 'block';
      table.style.display = 'none';
      tbody.innerHTML = '';
      ui.mesaInfo = { visiveis: 0, ocultos: 0 };
    } else {
      empty.style.display = 'none';
      table.style.display = 'block';
      var o = ordemMesa();
      var indices = ui.mostrarTodos ? o.alteraveis.concat(o.demais) : o.alteraveis;
      var html = '';
      indices.forEach(function (i) { html += renderItemRowHtml(lista[i], i); });
      if (!indices.length) {
        var cols = (typeof ITENS_COLUNAS !== 'undefined' && ITENS_COLUNAS) ? ITENS_COLUNAS : 8;
        html = '<tr class="fo-mesa-vazia"><td colspan="' + cols + '">Nenhuma despesa alterável. Use "Mostrar todos" para ver os demais itens.</td></tr>';
      }
      tbody.innerHTML = html;
      ui.mesaInfo = { visiveis: o.alteraveis.length, ocultos: o.demais.length };
    }
    if (fn('updateBadgeButtonVisibility')) updateBadgeButtonVisibility();
    if (fn('initItemsColResize')) initItemsColResize();
    return true;
  }

  var renderAnterior = window.renderItemsTable;

  function renderItemsTableFO() {
    var feito = false;
    ui.mesaRenderizada = false;
    if (ui.modoOtimizacao) {
      try {
        feito = renderMesa();
        ui.mesaRenderizada = feito;
      } catch (e) {
        if (window.console) console.error('[fluxo-otimizacao-ui] falha ao desenhar o modo otimização', e);
        feito = false;
        ui.mesaRenderizada = false;
      }
    }
    if (!feito && typeof renderAnterior === 'function') renderAnterior.apply(this, arguments);
    decorarTabela();
    atualizarFaixa();
    // Simulação bloqueada: as linhas recém-desenhadas (🗑, checkboxes) nascem sem disabled
    if (bloqueado() && fn('applyClientLockMode')) applyClientLockMode(true);
    if (ui.painelLinkId) {
      if (!M.itemPorId(ui.painelLinkId)) fecharPainel(false);
      else atualizarPainel();
    }
  }

  // ------------------------------------------------------------
  // 6.2 Decoração das linhas
  // ------------------------------------------------------------
  function selosHtml(estado) {
    if (estado === 'rascunho') return '<span class="fo-selo fo-selo-rascunho" title="Alteração ainda não confirmada">Rascunho</span>';
    if (estado === 'otimizado') return '<span class="fo-selo fo-selo-ok" title="Ajuste confirmado no cenário otimizado">Otimizado</span>';
    if (estado === 'otimizado-com-rascunho') {
      return '<span class="fo-selo fo-selo-ok" title="Ajuste confirmado no cenário otimizado">Otimizado</span>' +
        '<span class="fo-selo fo-selo-rascunho" title="Há uma alteração nova ainda não confirmada">+ rascunho</span>';
    }
    return '';
  }

  function sinalTotal(e) {
    var p = num(e && e.periodo);
    if (e && e.ehEntrada) return (p >= 0 ? '+' : '−') + moeda(Math.abs(p));
    return (p >= 0 ? '−' : '+') + moeda(Math.abs(p));
  }

  // Economia exibida na célula. previaSempre = usa o rascunho quando houver (mesa).
  function econHtml(linkId, estado, previaSempre) {
    if (estado === 'nenhum') return '';
    var previa = estado === 'rascunho' || (previaSempre && estado === 'otimizado-com-rascunho');
    var e = economiaSegura(linkId, previa);
    var t = textoEconomia(e, true);
    if (!t) return '';
    var titulo = (previa ? 'Prevista com o rascunho — ' : 'Confirmada — ') + 'total no período: ' + sinalTotal(e);
    if (!previa && estado === 'otimizado-com-rascunho') {
      var e2 = economiaSegura(linkId, true);
      var t2 = textoEconomia(e2, false);
      titulo += ' · com o rascunho: ' + (t2 ? t2.texto : 'sem mudança');
    }
    return '<span class="fo-econ ' + t.classe + (previa ? ' fo-econ-previa' : '') + '" title="' + esc(titulo) + '">' +
      '<span class="fo-econ-val">' + esc(t.valor) + '</span>' +
      (t.desde ? ' <span class="fo-econ-desde">' + esc(t.desde) + '</span>' : '') + '</span>';
  }

  function decorarTabela() {
    var tbody = document.getElementById('items-tbody');
    if (!tbody) return;
    var cels = tbody.querySelectorAll('td.td-otimizacao');
    if (!cels.length) return;
    var mesa = !!(ui.modoOtimizacao && ui.mesaRenderizada);
    var bloq = bloqueado();
    var totais = null;
    if (mesa) { try { totais = M.totaisDoPeriodo(); } catch (e) { totais = null; } }
    for (var i = 0; i < cels.length; i++) {
      try { decorarCelula(cels[i], mesa, bloq, totais); } catch (e) {
        if (window.console) console.error('[fluxo-otimizacao-ui] falha ao decorar linha', e);
      }
    }
  }

  function decorarCelula(td, mesa, bloq, totais) {
    var linkId = td.getAttribute('data-link-id') || '';
    var ref = linkId ? M.itemPorId(linkId) : null;
    if (!ref) { setHtml(td, ''); return; }
    var estado = estadoSeguro(linkId);
    if (mesa && ehDespesa(ref.item)) { decorarMesa(td, linkId, ref, estado, bloq, totais); return; }
    var html = '<span class="fo-cel">';
    if (mesa) html += catHtml(ref.item);
    if (estado === 'nenhum') {
      html += '<button type="button" class="fo-btn-otimizar" data-fo-abrir="' + esc(linkId) + '" title="Abrir o painel de otimização do item">Otimizar</button>';
    } else {
      html += selosHtml(estado) + econHtml(linkId, estado, false);
    }
    html += '</span>';
    setHtml(td, html);
  }

  // Controles da mesa: pontuação, controle deslizante, %, sugestão, selo e economia.
  // A estrutura é criada uma vez; depois só os valores são atualizados (não interrompe o arrasto).
  function decorarMesa(td, linkId, ref, estado, bloq, totais) {
    var a = null;
    try { a = M.analiseDoItem(ref.index, totais); } catch (e) { a = null; }
    var pct = pctAtual(linkId);
    var raiz = td.querySelector('.fo-mesa');
    if (!raiz || raiz.getAttribute('data-link-id') !== linkId) {
      var nome = esc(ref.item.nome);
      var html = '<span class="fo-mesa" data-link-id="' + esc(linkId) + '">' +
        '<span class="fo-slot-cat"></span>' +
        '<span class="fo-mesa-ctl">' +
          '<span class="fo-score"></span>' +
          '<input type="range" class="fo-slider" min="0" max="100" step="5" aria-label="Percentual de redução de ' + nome + '">' +
          '<span class="fo-pct-wrap"><input type="text" inputmode="decimal" class="fo-pct-num" aria-label="Percentual de redução de ' + nome + '" title="Positivo reduz; negativo aumenta; 100 zera"><span>%</span></span>' +
        '</span>' +
        '<span class="fo-slot-sug"></span><span class="fo-slot-estado"></span><span class="fo-slot-econ"></span>' +
        '</span>';
      td.innerHTML = html;
      td._foH = null;
      raiz = td.querySelector('.fo-mesa');
    }
    var slider = raiz.querySelector('.fo-slider');
    var campo = raiz.querySelector('.fo-pct-num');
    var ativo = document.activeElement;
    var pendente = Object.prototype.hasOwnProperty.call(mesaPendente, linkId);
    slider.disabled = bloq;
    campo.disabled = bloq;
    if (ativo !== slider && ui.arrastando !== linkId && !pendente) slider.value = String(Math.max(0, Math.min(100, pct)));
    if (ativo !== campo && !pendente) campo.value = pctTexto(pct);

    var sc = raiz.querySelector('.fo-score');
    if (a && a.aplicavel) {
      var s = num(a.score);
      sc.textContent = s.toFixed(1);
      sc.style.color = fn('scoreColor') ? scoreColor(s) : 'var(--muted)';
      sc.title = 'Pontuação da análise: ' + s.toFixed(1) + ' (mesma regra da seção Candidatos a Redução)';
    } else {
      sc.textContent = '—';
      sc.style.color = 'var(--muted)';
      sc.title = 'Sem pontuação: é preciso ter entradas no período';
    }

    var sugHtml = '';
    var alvo = alvoSugestao(a);
    if (alvo !== null) {
      var rot = a.recomendacao === 'cancelar' ? 'sug. cancelar' : 'sug. ' + pctTexto(alvo) + '%';
      sugHtml = '<button type="button" class="fo-sugestao" data-fo-sug="' + alvo + '"' + (bloq ? ' disabled' : '') +
        ' title="Aplicar a sugestão da análise">' + rot + '</button>';
    }
    setHtml(raiz.querySelector('.fo-slot-cat'), catHtml(ref.item));
    setHtml(raiz.querySelector('.fo-slot-sug'), sugHtml);
    setHtml(raiz.querySelector('.fo-slot-estado'), selosHtml(estado));
    setHtml(raiz.querySelector('.fo-slot-econ'), econHtml(linkId, estado, true));
  }

  // % a aplicar pela sugestão da análise, ou null quando não há sugestão
  function alvoSugestao(a) {
    if (!a || !a.aplicavel || !a.candidato) return null;
    if (a.recomendacao === 'cancelar') return 100;
    if (a.recomendacao === 'reduzir' && num(a.pctSugerido) > 0) return num(a.pctSugerido);
    return null;
  }

  // Alterações da mesa pendentes (debounce por item)
  var mesaPendente = {};
  var mesaTimers = {};

  function agendarMesa(linkId, pct) {
    mesaPendente[linkId] = pct;
    clearTimeout(mesaTimers[linkId]);
    mesaTimers[linkId] = setTimeout(function () { aplicarMesa(linkId); }, 150);
  }

  function aplicarMesa(linkId) {
    clearTimeout(mesaTimers[linkId]);
    delete mesaTimers[linkId];
    if (!Object.prototype.hasOwnProperty.call(mesaPendente, linkId)) return;
    var v = mesaPendente[linkId];
    delete mesaPendente[linkId];
    if (bloqueado()) { agendarAtualizacao(); return; }
    try { M.definirRascunho(linkId, { targetPct: v }); } catch (e) {
      if (window.console) console.error('[fluxo-otimizacao-ui] definirRascunho falhou', e);
    }
  }

  function aplicarMesaTodas() {
    Object.keys(mesaPendente).forEach(aplicarMesa);
  }

  // Delegação de eventos da tabela (instalada uma vez no documento)
  function instalarEventosTabela() {
    document.addEventListener('click', function (ev) {
      var alvo = ev.target;
      if (!alvo || !alvo.closest) return;
      var nome = alvo.closest('#items-tbody .item-nome');
      if (nome) {
        var id = nome.getAttribute('data-link-id');
        if (id) { ev.preventDefault(); abrirPainel(id, nome); }
        return;
      }
      var abrir = alvo.closest('#items-tbody [data-fo-abrir]');
      if (abrir) {
        ev.preventDefault();
        abrirPainel(abrir.getAttribute('data-fo-abrir'), abrir);
        return;
      }
      var sug = alvo.closest('#items-tbody .fo-sugestao');
      if (sug && !sug.disabled) {
        var raiz = sug.closest('.fo-mesa');
        if (!raiz) return;
        var linkId = raiz.getAttribute('data-link-id');
        var p = num(sug.getAttribute('data-fo-sug'));
        var sl = raiz.querySelector('.fo-slider');
        var cp = raiz.querySelector('.fo-pct-num');
        if (sl) sl.value = String(Math.max(0, Math.min(100, p)));
        if (cp) cp.value = pctTexto(p);
        agendarMesa(linkId, p);
        aplicarMesa(linkId);
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      var alvo = ev.target;
      if (!alvo || !alvo.closest) return;
      var nome = alvo.closest('#items-tbody .item-nome');
      if (!nome) return;
      var id = nome.getAttribute('data-link-id');
      if (!id) return;
      ev.preventDefault();
      abrirPainel(id, nome);
    });

    document.addEventListener('input', function (ev) {
      var alvo = ev.target;
      if (!alvo || !alvo.classList) return;
      if (alvo.classList.contains('fo-slider') || alvo.classList.contains('fo-pct-num')) {
        var raiz = alvo.closest('.fo-mesa');
        if (!raiz) return;
        var linkId = raiz.getAttribute('data-link-id');
        if (alvo.classList.contains('fo-slider')) {
          var v = num(alvo.value);
          var cp = raiz.querySelector('.fo-pct-num');
          if (cp) cp.value = pctTexto(v);
          agendarMesa(linkId, v);
        } else {
          var p = lerPct(alvo.value);
          if (p === null) return; // campo vazio não altera nada
          p = Math.max(-1000, Math.min(100, p));
          var sl = raiz.querySelector('.fo-slider');
          if (sl) sl.value = String(Math.max(0, Math.min(100, p)));
          agendarMesa(linkId, p);
        }
      }
    });

    document.addEventListener('change', function (ev) {
      var alvo = ev.target;
      if (!alvo || !alvo.classList) return;
      if (alvo.classList.contains('fo-slider') || alvo.classList.contains('fo-pct-num')) {
        var raiz = alvo.closest('.fo-mesa');
        if (!raiz) return;
        var linkId = raiz.getAttribute('data-link-id');
        if (ui.arrastando === linkId) ui.arrastando = null;
        aplicarMesa(linkId);
        if (alvo.classList.contains('fo-pct-num')) {
          alvo.value = pctTexto(pctAtual(linkId));
        }
      }
    });

    // Marca o arrasto do controle deslizante para não sobrescrever o valor durante o gesto
    document.addEventListener('pointerdown', function (ev) {
      var alvo = ev.target;
      if (alvo && alvo.classList && alvo.classList.contains('fo-slider')) {
        var raiz = alvo.closest('.fo-mesa');
        if (raiz) ui.arrastando = raiz.getAttribute('data-link-id');
      }
    });
    document.addEventListener('pointerup', function () {
      if (ui.arrastando) { var id = ui.arrastando; ui.arrastando = null; aplicarMesa(id); }
    });
  }

  // ------------------------------------------------------------
  // 6.3 Faixa-resumo #fo-faixa
  // ------------------------------------------------------------
  function garantirFaixa() {
    var f = document.getElementById('fo-faixa');
    if (f) return f;
    var wrap = document.getElementById('items-table-wrap');
    var corpo = document.getElementById('section-body-items');
    if (!wrap || !corpo || !wrap.parentNode) return null;
    f = document.createElement('div');
    f.id = 'fo-faixa';
    f.setAttribute('role', 'region');
    f.setAttribute('aria-label', 'Resumo do cenário otimizado');
    wrap.parentNode.insertBefore(f, wrap);
    f.addEventListener('click', onFaixaClick);
    f.addEventListener('change', onFaixaChange);
    return f;
  }

  function atualizarFaixa() {
    var f = garantirFaixa();
    if (!f) return;
    var lista = listaItens();
    if (!lista.length) { f.hidden = true; setHtml(f, ''); return; }
    f.hidden = false;

    var c = { otimizados: 0, rascunhos: 0 };
    try { c = M.contagens() || c; } catch (e) { /* mantém zeros */ }
    var visivel = (typeof scenarioEnabled !== 'undefined') && !!scenarioEnabled;
    var bloq = bloqueado();

    var l1 = '<span class="fo-faixa-titulo">Cenário otimizado</span>' +
      '<label class="fo-interruptor" title="Mostrar as linhas do cenário otimizado no gráfico da projeção">' +
      '<input type="checkbox" data-fo-acao="visivel"' + (visivel ? ' checked' : '') + (bloq ? ' disabled' : '') + '> Mostrar no gráfico</label>';

    if (!periodoValido()) {
      l1 += '<span class="fo-aviso">Configure o período (seção 1) para ver o impacto</span>';
    } else {
      l1 += '<span class="fo-num">Otimizados <b>' + num(c.otimizados) + '</b></span><span class="fo-sep">·</span>' +
        '<span class="fo-num">Rascunhos <b>' + num(c.rascunhos) + '</b></span><span class="fo-sep">·</span>';
      var econ = 0;
      lista.forEach(function (it) {
        if (!it || !it._linkId) return;
        var est = estadoSeguro(it._linkId);
        if (est === 'otimizado' || est === 'otimizado-com-rascunho') {
          var e = economiaSegura(it._linkId, false);
          if (e) econ += num(e.mediaMensal);
        }
      });
      l1 += '<span class="fo-num" title="Soma das médias mensais dos ajustes confirmados">Economia <b>' +
        (econ < 0 ? '−' : '') + moeda(Math.abs(econ)) + '/mês</b></span>';
      var imp = null;
      try { imp = M.impacto({}); } catch (e) { imp = null; }
      if (imp && imp.atual && imp.atual.saldo != null) {
        var s = '<span class="fo-sep">·</span><span class="fo-num">Saldo final <b>' + moeda(imp.atual.saldo) + '</b>';
        if (num(c.otimizados) > 0 && imp.confirmado && imp.confirmado.saldo != null) {
          s += '<span class="fo-seta">→</span><b>' + moeda(imp.confirmado.saldo) + '</b>';
        }
        if (num(c.rascunhos) > 0 && imp.previa && imp.previa.saldo != null) {
          s += ' · prévia <span class="fo-previa" title="Com os rascunhos ainda não confirmados">' + moeda(imp.previa.saldo) + '</span>';
        }
        s += '</span>';
        l1 += s;
      }
    }

    var acoes = '<span class="fo-faixa-acoes">' +
      '<button type="button" class="fo-btn" data-fo-acao="modo" aria-pressed="' + (ui.modoOtimizacao ? 'true' : 'false') + '"' +
      ' title="Lista só as despesas alteráveis, pela pontuação da análise, com controle de %">🎚 Modo otimização</button>';
    if (num(c.rascunhos) > 0) {
      acoes += '<button type="button" class="fo-btn fo-btn-primario" data-fo-acao="confirmar-todos"' + (bloq ? ' disabled' : '') + '>Confirmar rascunhos (' + num(c.rascunhos) + ')</button>' +
        '<button type="button" class="fo-btn fo-btn-perigo" data-fo-acao="descartar-todos"' + (bloq ? ' disabled' : '') + '>Descartar rascunhos</button>';
    }
    acoes += '</span>';

    var html = '<div class="fo-faixa-linha">' + l1 + acoes + '</div>';
    if (ui.modoOtimizacao && ui.mesaRenderizada) {
      var info = ui.mesaInfo || { visiveis: 0, ocultos: 0 };
      var txt = ui.mostrarTodos
        ? 'Mostrando ' + info.visiveis + ' itens alteráveis, ordenados pela pontuação da análise, e depois os ' + info.ocultos + ' demais'
        : 'Mostrando ' + info.visiveis + ' itens alteráveis, ordenados pela pontuação da análise · ' + info.ocultos + ' ocultos';
      html += '<div class="fo-faixa-linha"><span class="fo-num">' + txt + '</span>' +
        '<button type="button" class="fo-btn" data-fo-acao="mostrar-todos">' + (ui.mostrarTodos ? 'Só alteráveis' : 'Mostrar todos') + '</button></div>';
    }

    // Preserva o foco do botão clicado ao redesenhar
    var ativo = document.activeElement;
    var acaoFoco = (ativo && f.contains(ativo)) ? ativo.getAttribute('data-fo-acao') : null;
    setHtml(f, html);
    if (acaoFoco) {
      var novo = f.querySelector('[data-fo-acao="' + acaoFoco + '"]');
      if (novo && novo !== document.activeElement) novo.focus();
    }
  }

  function onFaixaClick(ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('button[data-fo-acao]') : null;
    if (!b || b.disabled) return;
    var acao = b.getAttribute('data-fo-acao');
    if (acao === 'modo') {
      aplicarMesaTodas();
      ui.modoOtimizacao = !ui.modoOtimizacao;
      ui.mostrarTodos = false;
      lsGravar(LS_MODO, ui.modoOtimizacao ? '1' : '0');
      window.renderItemsTable();
    } else if (acao === 'mostrar-todos') {
      ui.mostrarTodos = !ui.mostrarTodos;
      window.renderItemsTable();
    } else if (acao === 'confirmar-todos') {
      if (bloqueado()) return;
      aplicarMesaTodas();
      aplicarPainelPendente();
      try { M.confirmarTodos(); } catch (e) { if (window.console) console.error(e); }
    } else if (acao === 'descartar-todos') {
      if (bloqueado()) return;
      if (!window.confirm('Descartar todos os rascunhos? Os ajustes já confirmados continuam.')) return;
      mesaPendente = {};
      descartarPainelPendente();
      try { M.descartarTodos(); } catch (e) { if (window.console) console.error(e); }
    }
  }

  function onFaixaChange(ev) {
    var el = ev.target;
    if (!el || el.getAttribute('data-fo-acao') !== 'visivel') return;
    try { M.definirCenarioVisivel(!!el.checked); } catch (e) { if (window.console) console.error(e); }
  }

  // ------------------------------------------------------------
  // 6.4 Painel do item (gaveta) #fo-painel
  // ------------------------------------------------------------
  var painel = {
    overlay: null,
    aside: null,
    grafico: null,
    pendente: {},      // edições ainda não enviadas ao motor (debounce 150 ms)
    local: {},         // escolhas visuais (estratégia, modo) quando o motor ainda não guarda nada
    timer: null,
    origemEl: null,
    scrollY: 0,
    gestoNoFundo: false,
    assinaturaForm: '',
    detalhesAberto: false
  };

  function seletorId(id) {
    return (window.CSS && CSS.escape) ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&');
  }

  function construirPainel() {
    if (painel.overlay && document.body.contains(painel.overlay)) return;
    var ov = document.createElement('div');
    ov.id = 'fo-painel-overlay';
    ov.hidden = true;
    ov.innerHTML =
      '<aside id="fo-painel" role="dialog" aria-modal="true" aria-labelledby="fo-painel-titulo">' +
        '<header class="fo-p-cabecalho">' +
          '<div class="fo-p-cab-info" id="fo-p-cab"></div>' +
          '<div class="fo-p-cab-acoes">' +
            '<button type="button" class="fo-btn" data-fo-p="editar" title="Abrir o cadastro do item">✏️ Editar item</button>' +
            '<button type="button" class="fo-p-fechar" data-fo-p="fechar" aria-label="Fechar painel" title="Fechar (Esc)">✕</button>' +
          '</div>' +
        '</header>' +
        '<div class="fo-p-corpo" id="fo-p-corpo">' +
          '<section class="fo-p-secao" id="fo-p-estado"></section>' +
          '<section class="fo-p-secao" id="fo-p-sugestao"></section>' +
          '<section class="fo-p-secao" id="fo-p-alteracao"></section>' +
          '<section class="fo-p-secao" id="fo-p-evolucao"></section>' +
          '<section class="fo-p-secao" id="fo-p-impacto"></section>' +
          '<section class="fo-p-secao" id="fo-p-outros"></section>' +
        '</div>' +
        '<footer class="fo-p-rodape" id="fo-p-rodape"></footer>' +
      '</aside>';
    document.body.appendChild(ov);
    painel.overlay = ov;
    painel.aside = ov.querySelector('#fo-painel');

    // Clique no fundo fecha, só se o gesto começou no fundo
    ov.addEventListener('mousedown', function (ev) { painel.gestoNoFundo = ev.target === ov; });
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) {
        if (painel.gestoNoFundo) fecharPainel();
        painel.gestoNoFundo = false;
        return;
      }
      painel.gestoNoFundo = false;
      onPainelClick(ev);
    });
    ov.addEventListener('input', onPainelInput);
    ov.addEventListener('change', onPainelChange);
  }

  function abrirPainel(linkId, origem) {
    if (!linkId) return;
    var ref = M.itemPorId(linkId);
    if (!ref) return;
    aplicarMesaTodas();
    if (ui.painelLinkId && ui.painelLinkId !== linkId) {
      aplicarPainelPendente();
    }
    destruirGrafico();
    construirPainel();
    if (ui.painelLinkId !== linkId) {
      painel.pendente = {};
      painel.local = {};
      painel.detalhesAberto = false;
      // o <details> do item anterior ainda está no DOM; sem limpar, renderEvolucao herdaria o "aberto"
      var evo = document.getElementById('fo-p-evolucao');
      if (evo) { evo.innerHTML = ''; evo._foH = null; }
      var corpo = document.getElementById('fo-p-corpo');
      if (corpo) corpo.scrollTop = 0;
    }
    ui.painelLinkId = linkId;
    painel.origemEl = origem || null;
    painel.assinaturaForm = '';

    // Trava a rolagem do fundo guardando a posição
    if (!document.body.classList.contains('fo-painel-aberto')) {
      painel.scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      document.body.style.top = (-painel.scrollY) + 'px';
      document.body.classList.add('fo-painel-aberto');
    }
    painel.overlay.hidden = false;
    // Força o reflow para a transição de entrada
    void painel.overlay.offsetWidth;
    painel.overlay.classList.add('fo-aberto');

    atualizarPainel();
    var fechar = painel.overlay.querySelector('[data-fo-p="fechar"]');
    if (fechar) fechar.focus();
  }

  function fecharPainel(restaurarFoco) {
    if (!ui.painelLinkId) return;
    aplicarPainelPendente();
    destruirGrafico();
    var id = ui.painelLinkId;
    ui.painelLinkId = null;
    painel.pendente = {};
    painel.local = {};
    painel.assinaturaForm = '';
    if (painel.overlay) {
      painel.overlay.classList.remove('fo-aberto');
      painel.overlay.hidden = true;
    }
    if (document.body.classList.contains('fo-painel-aberto')) {
      document.body.classList.remove('fo-painel-aberto');
      document.body.style.top = '';
      window.scrollTo(0, painel.scrollY || 0);
    }
    if (restaurarFoco !== false) {
      var alvo = document.querySelector('#items-tbody .item-nome[data-link-id="' + seletorId(id) + '"]');
      if (!alvo && painel.origemEl && document.body.contains(painel.origemEl)) alvo = painel.origemEl;
      if (alvo && alvo.focus) {
        try { alvo.focus({ preventScroll: true }); } catch (e) { alvo.focus(); }
      }
    }
    painel.origemEl = null;
  }

  function destruirGrafico() {
    if (painel.grafico) {
      try { painel.grafico.destroy(); } catch (e) { /* já destruído */ }
      painel.grafico = null;
    }
  }

  // Configuração exibida no painel: motor (rascunho > confirmado > padrão) + escolhas locais + pendências
  function cfgPainel(linkId) {
    var cfg = null;
    try { cfg = M.configEfetiva(linkId, true); } catch (e) { cfg = null; }
    var base;
    if (cfg) base = Object.assign({}, cfg);
    else {
      var padrao = null;
      try { padrao = M.rascunhoPadrao(linkId); } catch (e) { padrao = null; }
      base = Object.assign({ strategy: 'imediato', startDate: '', gradType: 'pct', pctPerMonth: 10, nominalPerMonth: 0, targetPct: 0, anchorMonth: '', manualMonths: {} }, padrao || {}, painel.local);
    }
    return Object.assign(base, painel.pendente);
  }

  function alterarRascunho(parcial, imediato) {
    if (!ui.painelLinkId || bloqueado()) return;
    Object.assign(painel.pendente, parcial);
    clearTimeout(painel.timer);
    if (imediato) aplicarPainelPendente();
    else painel.timer = setTimeout(aplicarPainelPendente, 150);
  }

  function aplicarPainelPendente() {
    clearTimeout(painel.timer);
    painel.timer = null;
    var id = ui.painelLinkId;
    var p = painel.pendente;
    painel.pendente = {};
    if (!id || !Object.keys(p).length || bloqueado()) return;
    var existente = null;
    try { existente = M.configEfetiva(id, true); } catch (e) { existente = null; }
    // Sem nada guardado no motor, leva junto a estratégia escolhida na tela
    if (!existente) p = Object.assign({}, painel.local, p);
    try { M.definirRascunho(id, p); } catch (e) {
      if (window.console) console.error('[fluxo-otimizacao-ui] definirRascunho falhou', e);
    }
    // O motor apaga rascunho sem efeito (ex.: 0% em imediato). Guarda a escolha na tela
    // para o painel não voltar ao % sugerido do rascunhoPadrao no próximo redesenho.
    var guardado = null;
    try { guardado = M.configEfetiva(id, true); } catch (e) { guardado = null; }
    // (leva junto o que o motor tinha antes de apagar: estratégia e data de um rascunho "A partir de uma data")
    if (!guardado) painel.local = Object.assign({}, painel.local, existente || {}, p);
  }

  function descartarPainelPendente() {
    clearTimeout(painel.timer);
    painel.timer = null;
    painel.pendente = {};
  }

  // Mantém o foco no controle equivalente depois de redesenhar um trecho
  function chaveFoco(el) {
    if (!el || !el.getAttribute) return null;
    var attrs = ['data-fo-p', 'data-fo-campo', 'data-fo-seg', 'data-fo-mes', 'data-fo-limpar-mes'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (v !== null) {
        var extra = el.getAttribute('data-fo-val');
        return '[' + attrs[i] + '="' + seletorId(v) + '"]' + (extra !== null ? '[data-fo-val="' + seletorId(extra) + '"]' : '');
      }
    }
    return null;
  }

  function comFocoPreservado(container, desenhar) {
    var ativo = document.activeElement;
    var chave = (container && ativo && container.contains(ativo)) ? chaveFoco(ativo) : null;
    desenhar();
    if (chave && !container.contains(document.activeElement)) {
      var novo = container.querySelector(chave);
      if (novo && !novo.disabled) novo.focus();
    }
  }

  function onPainelClick(ev) {
    var alvo = ev.target && ev.target.closest ? ev.target : null;
    if (!alvo) return;
    var id = ui.painelLinkId;
    if (!id) return;

    var seg = alvo.closest('[data-fo-seg]');
    if (seg && !seg.disabled) {
      var campo = seg.getAttribute('data-fo-seg');
      var valor = seg.getAttribute('data-fo-val');
      var parcial = {};
      parcial[campo] = valor;
      if (campo === 'strategy' && valor === 'data') {
        var atual = cfgPainel(id);
        if (!atual.startDate) {
          var hoje = new Date();
          var prox = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
          parcial.startDate = prox.getFullYear() + '-' + String(prox.getMonth() + 1).padStart(2, '0') + '-01';
        }
      }
      Object.assign(painel.local, parcial);
      alterarRascunho(parcial, true);
      atualizarPainel();
      return;
    }

    var limpar = alvo.closest('[data-fo-limpar-mes]');
    if (limpar && !limpar.disabled) {
      var mes = limpar.getAttribute('data-fo-limpar-mes');
      var mm = Object.assign({}, cfgPainel(id).manualMonths || {});
      delete mm[mes];
      alterarRascunho({ manualMonths: mm }, true);
      return;
    }

    var b = alvo.closest('[data-fo-p]');
    if (!b || b.disabled) return;
    var acao = b.getAttribute('data-fo-p');
    if (acao === 'fechar') {
      fecharPainel();
    } else if (acao === 'editar') {
      if (bloqueado()) return;
      var ref = M.itemPorId(id);
      if (!ref) return;
      fecharPainel(false);
      if (fn('openModal')) openModal(ref.index);
    } else if (acao === 'usar-sugestao') {
      var p = num(b.getAttribute('data-fo-sug'));
      alterarRascunho({ targetPct: p }, true);
    } else if (acao === 'descartar') {
      if (bloqueado()) return;
      descartarPainelPendente();
      painel.local = {};
      painel.assinaturaForm = '';
      try { M.descartarRascunho(id); } catch (e) { if (window.console) console.error(e); }
    } else if (acao === 'remover') {
      if (bloqueado()) return;
      if (!window.confirm('Remover o ajuste confirmado deste item do cenário otimizado? O valor do item não muda.')) return;
      descartarPainelPendente();
      painel.local = {};
      painel.assinaturaForm = '';
      try { M.removerAjuste(id); } catch (e) { if (window.console) console.error(e); }
    } else if (acao === 'confirmar') {
      if (bloqueado()) return;
      aplicarPainelPendente();
      var adj = null;
      try { adj = M.ajusteDe(id); } catch (e) { adj = null; }
      if (adj && adj.draft) {
        try { M.confirmarRascunho(id); } catch (e) { if (window.console) console.error(e); }
      }
    }
  }

  function onPainelInput(ev) {
    var el = ev.target;
    var id = ui.painelLinkId;
    if (!el || !id || !el.getAttribute) return;
    var ref = M.itemPorId(id);
    if (!ref) return;
    var orig = num(ref.item.valor);
    var campo = el.getAttribute('data-fo-campo');
    var mes = el.getAttribute('data-fo-mes');

    if (campo === 'valorFinal') {
      if (fn('formatCurrencyInput')) formatCurrencyInput(el);
      if (!String(el.value).trim()) return; // vazio não zera: mantém o anterior
      if (orig <= 0) return;
      var v = Math.abs(lerMoeda(el.value));
      var tp = Math.round(((orig - v) / orig) * 100 * 10000) / 10000;
      var campoPct = painel.overlay.querySelector('[data-fo-campo="targetPct"]');
      if (campoPct && campoPct !== document.activeElement) campoPct.value = pctTexto(tp);
      alterarRascunho({ targetPct: tp });
    } else if (campo === 'targetPct') {
      var p = lerPct(el.value);
      if (p === null) return;
      p = Math.min(100, p);
      var campoValor = painel.overlay.querySelector('[data-fo-campo="valorFinal"]');
      if (campoValor && campoValor !== document.activeElement) campoValor.value = moedaCampo(Math.max(0, orig * (1 - p / 100)));
      alterarRascunho({ targetPct: p });
    } else if (campo === 'pctPerMonth') {
      var ppm = lerPct(el.value);
      if (ppm === null) return;
      alterarRascunho({ pctPerMonth: Math.max(0, ppm) });
    } else if (campo === 'nominalPerMonth') {
      if (fn('formatCurrencyInput')) formatCurrencyInput(el);
      if (!String(el.value).trim()) return;
      alterarRascunho({ nominalPerMonth: Math.abs(lerMoeda(el.value)) });
    } else if (mes) {
      if (fn('formatCurrencyInput')) formatCurrencyInput(el);
      if (!String(el.value).trim()) return;
      var mm = Object.assign({}, cfgPainel(id).manualMonths || {});
      mm[mes] = Math.abs(lerMoeda(el.value));
      alterarRascunho({ manualMonths: mm });
    }
  }

  function onPainelChange(ev) {
    var el = ev.target;
    var id = ui.painelLinkId;
    if (!el || !id || !el.getAttribute) return;
    var campo = el.getAttribute('data-fo-campo');
    if (campo === 'startDate') {
      if (!el.value) return;
      painel.local.startDate = el.value;
      alterarRascunho({ startDate: el.value }, true);
    } else if (campo === 'anchorMonth') {
      if (!el.value) return;
      painel.local.anchorMonth = el.value;
      alterarRascunho({ anchorMonth: el.value }, true);
    } else if (campo === 'valorFinal' || campo === 'targetPct' || campo === 'pctPerMonth' || campo === 'nominalPerMonth' || el.getAttribute('data-fo-mes')) {
      // Ao sair do campo, envia já; o valor formatado volta no próximo fo:mudou
      aplicarPainelPendente();
    }
  }

  // Esc fecha; Tab fica preso dentro da gaveta
  function onDocKeydown(ev) {
    if (!ui.painelLinkId || !painel.aside) return;
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      ev.preventDefault();
      fecharPainel();
      return;
    }
    if (ev.key !== 'Tab') return;
    var focaveis = Array.prototype.filter.call(
      painel.aside.querySelectorAll('button, input, select, textarea, summary, a[href], [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
    if (!focaveis.length) return;
    var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    var ativo = document.activeElement;
    if (!painel.aside.contains(ativo)) { ev.preventDefault(); primeiro.focus(); return; }
    if (ev.shiftKey && ativo === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && ativo === ultimo) { ev.preventDefault(); primeiro.focus(); }
  }

  // ---------- Atualização do painel (todas as seções) ----------
  function atualizarPainel() {
    var id = ui.painelLinkId;
    if (!id || !painel.overlay) return;
    var ref = M.itemPorId(id);
    if (!ref) { fecharPainel(false); return; }
    var it = ref.item, idx = ref.index;
    var bloq = bloqueado();
    var adj = null;
    try { adj = M.ajusteDe(id); } catch (e) { adj = null; }
    var estado = estadoSeguro(id);
    var temRascunho = !!(adj && adj.draft);
    var temConfirmado = !!(adj && adj.enabled);

    var passos = [
      function () { renderCabecalho(it, bloq); },
      function () { renderEstado(estado, adj); },
      function () { renderSugestao(it, idx, bloq); },
      function () { renderAlteracao(it, id, bloq); },
      function () { renderEvolucao(it, id); },
      function () { renderImpacto(id); },
      function () { renderOutros(it, idx, estado); },
      function () { renderRodape(temRascunho, temConfirmado, bloq); }
    ];
    passos.forEach(function (p) {
      try { p(); } catch (e) { if (window.console) console.error('[fluxo-otimizacao-ui] falha ao desenhar o painel', e); }
    });
  }

  function secao(id) { return document.getElementById(id); }

  function resumoRecorrencia(it) {
    var ini = it.recInicio ? dataBR(it.recInicio) : '';
    if (it.recTipo === 'nao') return 'Único' + (ini ? ' em ' + ini : '');
    var rotulos = (typeof REC_LABELS !== 'undefined' && REC_LABELS) ? REC_LABELS : {};
    var s = 'A cada ' + (it.recQty || 1) + ' ' + (rotulos[it.recTipo] || it.recTipo || '');
    if (ini) s += ' · desde ' + ini;
    if (it.recFimTipo === 'ocorrencias') s += ' · ' + it.recFimQty + 'x';
    else if (it.recFimTipo === 'data' && it.recFimData) s += ' · até ' + dataBR(it.recFimData);
    else if (it.recFimTipo === 'nunca') s += ' · sem fim';
    return s;
  }

  function renderCabecalho(it, bloq) {
    var cab = secao('fo-p-cab');
    if (!cab) return;
    var tipo;
    if (ehEntrada(it)) tipo = '<span class="badge badge-green">Entrada</span>';
    else if (it.subtipo === 'poupanca') tipo = '<span class="badge badge-blue">Poupança</span>';
    else if (ehDespesa(it)) {
      var cats = (typeof CATEGORIA_LABELS !== 'undefined' && CATEGORIA_LABELS) ? CATEGORIA_LABELS : {};
      tipo = '<span class="badge badge-red">Despesa</span> <span class="badge badge-muted">' + esc(cats[it.categoria] || (it.categoria ? it.categoria : 'Sem categoria')) + '</span>';
    } else tipo = '<span class="badge badge-muted">Saída</span>';
    var html = '<h2 class="fo-p-titulo" id="fo-painel-titulo">' + esc(it.nome) + '</h2>' +
      '<div class="fo-p-meta">' + tipo +
      '<span><b style="color:var(--fg)">' + esc(moeda(it.valor)) + '</b> por ocorrência</span>' +
      '<span>' + esc(resumoRecorrencia(it)) + '</span></div>';
    setHtml(cab, html);
    var editar = painel.overlay.querySelector('[data-fo-p="editar"]');
    if (editar) editar.disabled = bloq;
  }

  function renderEstado(estado, adj) {
    var el = secao('fo-p-estado');
    if (!el) return;
    var html = '<h3 class="fo-p-sec-titulo">Estado</h3><div class="fo-p-estado">';
    if (estado === 'nenhum') {
      html += '<span class="fo-selo fo-selo-nenhum">Sem ajuste</span><span class="fo-p-nota">O valor do item continua sendo a realidade atual; o ajuste vale só para o cenário otimizado.</span>';
    } else {
      if (estado === 'otimizado' || estado === 'otimizado-com-rascunho') {
        var quando = adj && adj.confirmadoEm ? ' (confirmado em ' + esc(dataBR(adj.confirmadoEm)) + ')' : '';
        html += '<span class="fo-selo fo-selo-ok">Otimizado</span><span>' + quando + '</span>';
      }
      if (estado === 'rascunho' || estado === 'otimizado-com-rascunho') {
        html += '<span class="fo-selo fo-selo-rascunho">Rascunho</span><span class="fo-p-nota">não confirmado — aparece tracejado no gráfico da projeção</span>';
      }
    }
    html += '</div>';
    setHtml(el, html);
  }

  function renderSugestao(it, idx, bloq) {
    var el = secao('fo-p-sugestao');
    if (!el) return;
    if (!ehDespesa(it)) { el.hidden = true; setHtml(el, ''); return; }
    el.hidden = false;
    var html = '<h3 class="fo-p-sec-titulo">Sugestão da análise</h3>';
    if (!periodoValido()) {
      html += '<p class="fo-p-nota">Configure o período (seção 1) para ver a análise.</p>';
      setHtml(el, html);
      return;
    }
    var totais = null, a = null;
    try { totais = M.totaisDoPeriodo(); a = M.analiseDoItem(idx, totais); } catch (e) { a = null; }
    if (!a || !a.aplicavel) {
      html += '<p class="fo-p-nota">Sem análise: é preciso ter entradas no período.</p>';
      setHtml(el, html);
      return;
    }
    var s = num(a.score);
    var cor = fn('scoreColor') ? scoreColor(s) : 'var(--primary)';
    var rec;
    if (!a.candidato) rec = 'abaixo do limite de revisão';
    else if (a.recomendacao === 'reduzir') rec = 'reduzir ' + pctTexto(a.pctSugerido) + '%';
    else if (a.recomendacao === 'cancelar') rec = 'cancelar';
    else rec = 'manter';
    var totEnt = totais ? num(totais.totEnt) : 0;
    var totDesp = totais ? num(totais.totDesp) : 0;
    var totItem = num(a.totalPeriodo);
    var pE = totEnt > 0 ? totItem / totEnt * 100 : 0;
    var pD = totDesp > 0 ? totItem / totDesp * 100 : 0;
    html += '<div class="fo-p-score"><div class="fo-p-score-trilho"><div class="fo-p-score-barra" style="width:' + Math.max(0, Math.min(100, s * 10)).toFixed(1) + '%;background:' + cor + ';"></div></div>' +
      '<span class="fo-p-score-num" style="color:' + cor + ';">' + s.toFixed(1) + '</span></div>' +
      '<div class="fo-p-sug-linha"><span>Recomendação: <span class="fo-p-sug-rec">' + esc(rec) + '</span></span>' +
      '<span>' + pctTexto(pE) + '% das entradas</span><span>' + pctTexto(pD) + '% das despesas</span>';
    var alvo = alvoSugestao(a);
    if (alvo !== null) {
      html += '<button type="button" class="fo-btn" data-fo-p="usar-sugestao" data-fo-sug="' + alvo + '"' + (bloq ? ' disabled' : '') + '>Usar sugestão</button>';
    }
    html += '</div><div class="fo-p-nota" style="margin-top:.3rem;">mesma regra da seção Candidatos a Redução</div>';
    comFocoPreservado(el, function () { setHtml(el, html); });
  }

  function segBtn(campo, valor, rotulo, atual, bloq) {
    return '<button type="button" data-fo-seg="' + campo + '" data-fo-val="' + valor + '" aria-pressed="' + (atual === valor ? 'true' : 'false') + '"' +
      (bloq ? ' disabled' : '') + '>' + rotulo + '</button>';
  }

  function renderAlteracao(it, id, bloq) {
    var el = secao('fo-p-alteracao');
    if (!el) return;
    var cfg = cfgPainel(id);
    var estrategia = cfg.strategy || 'imediato';
    var modo = cfg.gradType || 'pct';
    var meses = [];
    try { meses = M.mesesDoPeriodo() || []; } catch (e) { meses = []; }
    var assinatura = [id, estrategia, estrategia === 'gradativo' ? modo : '', bloq ? 1 : 0, meses.join(','), cfg.anchorMonth || ''].join('|');

    if (assinatura !== painel.assinaturaForm || !el.firstChild) {
      var dis = bloq ? ' disabled' : '';
      var html = '<h3 class="fo-p-sec-titulo">Alteração</h3>' +
        '<div class="fo-seg" role="group" aria-label="Estratégia">' +
          segBtn('strategy', 'imediato', 'Imediato', estrategia, bloq) +
          segBtn('strategy', 'data', 'A partir de uma data', estrategia, bloq) +
          segBtn('strategy', 'gradativo', 'Gradativo', estrategia, bloq) +
        '</div>';

      if (estrategia === 'gradativo') {
        var opcoes = meses.slice();
        if (cfg.anchorMonth && opcoes.indexOf(cfg.anchorMonth) === -1) opcoes.unshift(cfg.anchorMonth);
        html += '<div class="fo-campos">' +
          '<div class="fo-campo"><label for="fo-c-anchor">Começa em</label><select id="fo-c-anchor" data-fo-campo="anchorMonth"' + dis + '>' +
            (opcoes.length ? '' : '<option value="">—</option>') +
            opcoes.map(function (m) { return '<option value="' + esc(m) + '">' + esc(mesLongo(m)) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="fo-campo"><label>Modo</label><div class="fo-seg" role="group" aria-label="Modo do gradativo">' +
            segBtn('gradType', 'pct', '% ao mês', modo, bloq) +
            segBtn('gradType', 'nominal', 'R$ ao mês', modo, bloq) +
            segBtn('gradType', 'manual', 'Manual por mês', modo, bloq) +
          '</div></div></div>';
      }

      if (!(estrategia === 'gradativo' && modo === 'manual')) {
        html += '<div class="fo-campos">' +
          '<div class="fo-campo fo-campo-moeda"><label for="fo-c-valor">Valor final (R$)</label>' +
            '<input id="fo-c-valor" type="text" inputmode="decimal" autocomplete="off" data-fo-campo="valorFinal"' + dis + '></div>' +
          '<div class="fo-campo fo-campo-pct"><label for="fo-c-pct" title="Positivo reduz; negativo aumenta; 100 zera">Redução (%)</label>' +
            '<input id="fo-c-pct" type="text" inputmode="decimal" autocomplete="off" data-fo-campo="targetPct"' + dis + '></div>' +
          '<div class="fo-campo-atual">Atual: ' + esc(moeda(it.valor)) + ' por ocorrência · acima do atual = aumento</div>' +
          '</div>';
      }

      if (estrategia === 'data') {
        html += '<div class="fo-campos"><div class="fo-campo"><label for="fo-c-data">A partir de</label>' +
          '<input id="fo-c-data" type="date" data-fo-campo="startDate"' + dis + '></div></div>';
      }

      if (estrategia === 'gradativo' && modo === 'pct') {
        html += '<div class="fo-campos"><div class="fo-campo fo-campo-pct"><label for="fo-c-ppm" title="Pontos percentuais do valor atual por mês de calendário">% ao mês</label>' +
          '<input id="fo-c-ppm" type="text" inputmode="decimal" autocomplete="off" data-fo-campo="pctPerMonth"' + dis + '></div></div>';
      }
      if (estrategia === 'gradativo' && modo === 'nominal') {
        html += '<div class="fo-campos"><div class="fo-campo fo-campo-moeda"><label for="fo-c-npm">R$ ao mês</label>' +
          '<input id="fo-c-npm" type="text" inputmode="decimal" autocomplete="off" data-fo-campo="nominalPerMonth"' + dis + '></div></div>';
      }
      if (estrategia === 'gradativo' && modo !== 'manual') {
        html += '<div class="fo-p-aviso" data-fo-aviso="alvo" hidden>Defina o valor final: sem ele o gradativo não altera nada.</div>';
      }
      if (estrategia === 'gradativo' && modo === 'manual') {
        if (!meses.length) {
          html += '<p class="fo-p-nota" style="margin-top:.4rem;">Configure o período (seção 1) para editar mês a mês.</p>';
        } else {
          html += '<div class="fo-grade-manual"><table><thead><tr><th>Mês</th><th>Valor por ocorrência</th><th></th></tr></thead><tbody>' +
            meses.map(function (m) {
              return '<tr data-fo-linha-mes="' + esc(m) + '"><td>' + esc(mesLongo(m)) + '</td>' +
                '<td><input type="text" inputmode="decimal" autocomplete="off" data-fo-mes="' + esc(m) + '" aria-label="Valor em ' + esc(mesLongo(m)) + '"' + dis + '></td>' +
                '<td><button type="button" class="fo-limpar-mes" data-fo-limpar-mes="' + esc(m) + '" title="Voltar a herdar o valor do mês anterior" aria-label="Limpar ' + esc(mesLongo(m)) + '"' + dis + '>↺</button></td></tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<p class="fo-p-nota" style="margin-top:.3rem;">Editar um mês vale para os seguintes até o próximo mês editado.</p>';
        }
      }
      if (bloq) html += '<div class="fo-p-bloqueio">Simulação bloqueada para edição</div>';

      comFocoPreservado(el, function () {
        el.innerHTML = html;
        el._foH = null;
        painel.assinaturaForm = assinatura;
        sincronizarAlteracao(el, cfg, it);
      });
    } else {
      sincronizarAlteracao(el, cfg, it);
    }
  }

  // Atualiza os valores dos campos sem recriar (pula o campo com foco)
  function sincronizarAlteracao(el, cfg, it) {
    var ativo = document.activeElement;
    var orig = num(it.valor);
    var tp = num(cfg.targetPct);
    function definir(sel, valor) {
      var c = el.querySelector(sel);
      if (c && c !== ativo && c.value !== valor) c.value = valor;
    }
    definir('[data-fo-campo="valorFinal"]', moedaCampo(Math.max(0, orig * (1 - tp / 100))));
    definir('[data-fo-campo="targetPct"]', pctTexto(tp));
    definir('[data-fo-campo="startDate"]', cfg.startDate || '');
    definir('[data-fo-campo="anchorMonth"]', cfg.anchorMonth || '');
    definir('[data-fo-campo="pctPerMonth"]', pctTexto(cfg.pctPerMonth));
    definir('[data-fo-campo="nominalPerMonth"]', moedaCampo(cfg.nominalPerMonth));

    var botoes = el.querySelectorAll('[data-fo-seg]');
    for (var i = 0; i < botoes.length; i++) {
      var campo = botoes[i].getAttribute('data-fo-seg');
      var ligado = String(cfg[campo] || (campo === 'strategy' ? 'imediato' : 'pct')) === botoes[i].getAttribute('data-fo-val');
      botoes[i].setAttribute('aria-pressed', ligado ? 'true' : 'false');
    }

    var aviso = el.querySelector('[data-fo-aviso="alvo"]');
    if (aviso) aviso.hidden = Math.abs(tp) > 0.0001;

    // Grade manual: valor efetivo = maior mês editado <= mês; senão o valor atual
    var linhas = el.querySelectorAll('tr[data-fo-linha-mes]');
    if (linhas.length) {
      var mm = cfg.manualMonths || {};
      var chaves = Object.keys(mm).sort();
      for (var j = 0; j < linhas.length; j++) {
        var mes = linhas[j].getAttribute('data-fo-linha-mes');
        var proprio = Object.prototype.hasOwnProperty.call(mm, mes);
        var efetivo = orig;
        for (var k = 0; k < chaves.length; k++) { if (chaves[k] <= mes) efetivo = num(mm[chaves[k]]); }
        linhas[j].classList.toggle('fo-editado', proprio);
        var inp = linhas[j].querySelector('input[data-fo-mes]');
        if (inp && inp !== ativo) inp.value = moedaCampo(efetivo);
        var lb = linhas[j].querySelector('[data-fo-limpar-mes]');
        if (lb) lb.style.visibility = proprio ? 'visible' : 'hidden';
      }
    }
  }

  function renderEvolucao(it, id) {
    var el = secao('fo-p-evolucao');
    if (!el) return;
    var detalhes = el.querySelector('details.fo-detalhes');
    if (detalhes) painel.detalhesAberto = detalhes.open;
    var corpo = document.getElementById('fo-p-corpo');
    var rolagem = corpo ? corpo.scrollTop : 0;
    destruirGrafico();
    el._foH = null;

    var html = '<h3 class="fo-p-sec-titulo">Evolução mês a mês</h3>';
    if (!periodoValido()) {
      el.innerHTML = html + '<p class="fo-p-nota">Configure o período (seção 1) para ver a evolução.</p>';
      return;
    }
    var serie = [];
    try { serie = M.serieMensalDoItem(id, true) || []; } catch (e) { serie = []; }
    if (!serie.length) {
      el.innerHTML = html + '<p class="fo-p-nota">Nenhuma ocorrência do item no período.</p>';
      return;
    }
    var entrada = ehEntrada(it);
    var temChart = typeof window.Chart === 'function';
    if (temChart) {
      html += '<div class="fo-grafico-box"><canvas id="fo-p-canvas" role="img" aria-label="Gráfico mês a mês: valor original e com ajuste, com a economia acumulada"></canvas></div>';
    } else {
      html += '<p class="fo-p-nota">Gráfico indisponível; veja a tabela abaixo.</p>';
    }
    if (cartaoDoItem(it)) html += '<p class="fo-p-nota" style="margin-top:.25rem;">Item no cartão: mês do vencimento da fatura.</p>';

    var acum = 0;
    var labels = [], orig = [], ajust = [], acumulada = [];
    var linhas = '';
    serie.forEach(function (s) {
      var o = num(s.original), a = num(s.ajustado);
      var dif = a - o;
      acum += entrada ? (a - o) : (o - a);
      labels.push(mesCurto(s.mes));
      orig.push(Math.round(o * 100) / 100);
      ajust.push(Math.round(a * 100) / 100);
      acumulada.push(Math.round(acum * 100) / 100);
      var bom = entrada ? dif > 0.004 : dif < -0.004;
      var ruim = entrada ? dif < -0.004 : dif > 0.004;
      var cor = bom ? 'var(--green)' : (ruim ? 'var(--red)' : 'var(--muted)');
      linhas += '<tr><td>' + esc(mesLongo(s.mes)) + '</td><td>' + esc(moeda(o)) + '</td><td>' + esc(moeda(a)) + '</td>' +
        '<td style="color:' + cor + ';">' + (Math.abs(dif) < 0.005 ? '—' : (dif > 0 ? '+' : '−') + esc(moeda(Math.abs(dif)))) + '</td></tr>';
    });
    html += '<details class="fo-detalhes"' + (painel.detalhesAberto ? ' open' : '') + '><summary>Valores mês a mês</summary>' +
      '<div class="fo-tab-wrap"><table class="fo-tab-mini"><thead><tr><th>Mês</th><th>Original</th><th>Com ajuste</th><th>Diferença</th></tr></thead><tbody>' +
      linhas + '</tbody></table></div></details>';
    el.innerHTML = html;
    if (corpo) corpo.scrollTop = rolagem;

    var det = el.querySelector('details.fo-detalhes');
    if (det) det.addEventListener('toggle', function () { painel.detalhesAberto = det.open; });

    if (!temChart) return;
    var canvas = el.querySelector('#fo-p-canvas');
    if (!canvas) return;
    try {
      painel.grafico = new window.Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { type: 'bar', label: 'Original', data: orig, backgroundColor: 'rgba(160,184,166,.45)', borderRadius: 3, yAxisID: 'y', order: 2 },
            { type: 'bar', label: 'Com ajuste', data: ajust, backgroundColor: '#D4AF37', borderRadius: 3, yAxisID: 'y', order: 2 },
            { type: 'line', label: entrada ? 'Ganho acumulado' : 'Economia acumulada', data: acumulada, borderColor: '#22c55e', backgroundColor: '#22c55e', borderWidth: 2, pointRadius: 2, tension: 0, fill: false, yAxisID: 'y2', order: 1 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#F2E8C9', boxWidth: 10, font: { size: 10 } } },
            tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + moeda(ctx.parsed.y); } } }
          },
          scales: {
            x: { ticks: { color: '#A0B8A6', font: { size: 10 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
            y: { position: 'left', beginAtZero: true, ticks: { color: '#A0B8A6', font: { size: 10 }, callback: function (v) { return moedaCurta(v); } }, grid: { color: 'rgba(212,175,55,.08)' } },
            y2: { position: 'right', ticks: { color: '#22c55e', font: { size: 10 }, callback: function (v) { return (v < 0 ? '−' : '') + moedaCurta(v); } }, grid: { drawOnChartArea: false } }
          }
        }
      });
    } catch (e) {
      painel.grafico = null;
      if (window.console) console.error('[fluxo-otimizacao-ui] falha no gráfico do painel', e);
    }
  }

  function moedaOuTraco(v) { return (v == null || !isFinite(Number(v))) ? '—' : esc(moeda(v)); }

  function renderImpacto(id) {
    var el = secao('fo-p-impacto');
    if (!el) return;
    var html = '<h3 class="fo-p-sec-titulo">Impacto no período</h3>';
    if (!periodoValido()) {
      setHtml(el, html + '<p class="fo-p-nota">Configure o período (seção 1) para ver o impacto.</p>');
      return;
    }
    var e = economiaSegura(id, true) || { periodo: 0, mediaMensal: 0, primeiroMes: null, ehEntrada: false };
    var imp = null;
    try { imp = M.impacto({ somenteRascunhoDe: id }); } catch (err) { imp = null; }
    function valorEco(v) {
      v = num(v);
      var cor = v > 0.004 ? 'var(--green)' : (v < -0.004 ? 'var(--red)' : 'var(--fg)');
      return '<span style="color:' + cor + ';">' + (v < -0.004 ? '−' : '') + esc(moeda(Math.abs(v))) + '</span>';
    }
    var rotulo = e.ehEntrada ? 'Receita a mais no período' : 'Economia no período';
    html += '<div class="fo-kpis">' +
      '<div class="fo-kpi"><div class="fo-kpi-rot">' + rotulo + '</div><div class="fo-kpi-val">' + valorEco(e.periodo) + '</div></div>' +
      '<div class="fo-kpi"><div class="fo-kpi-rot">Média mensal</div><div class="fo-kpi-val">' + valorEco(e.mediaMensal) + '</div></div>' +
      '<div class="fo-kpi"><div class="fo-kpi-rot">Primeiro mês com mudança</div><div class="fo-kpi-val">' + (e.primeiroMes ? esc(mesLongo(e.primeiroMes)) : '—') + '</div></div>' +
      '</div>';
    if (imp && imp.atual) {
      var pv = imp.previa;
      var tituloPrevia = pv ? '' : ' title="Sem rascunho neste item"';
      html += '<div class="fo-tab-wrap"><table class="fo-tab-mini fo-tab-impacto"><thead><tr><th></th><th>Sem ajustes</th><th>Confirmados</th><th class="fo-col-previa">Com este rascunho</th></tr></thead><tbody>' +
        '<tr><td>Saldo final</td><td>' + moedaOuTraco(imp.atual.saldo) + '</td><td>' + moedaOuTraco(imp.confirmado && imp.confirmado.saldo) + '</td><td class="fo-col-previa"' + tituloPrevia + '>' + (pv ? moedaOuTraco(pv.saldo) : '—') + '</td></tr>' +
        '<tr><td>Poupança final</td><td>' + moedaOuTraco(imp.atual.poup) + '</td><td>' + moedaOuTraco(imp.confirmado && imp.confirmado.poup) + '</td><td class="fo-col-previa"' + tituloPrevia + '>' + (pv ? moedaOuTraco(pv.poup) : '—') + '</td></tr>' +
        '</tbody></table></div>' +
        '<p class="fo-p-nota" style="margin-top:.3rem;">A economia não é igual à variação do saldo: déficits são cobertos pela poupança disponível.</p>';
    }
    setHtml(el, html);
  }

  function renderOutros(it, idx, estado) {
    var el = secao('fo-p-outros');
    if (!el) return;
    var blocos = [];
    function bloco(rotulo, itensLista, nota) {
      var h = '<div class="fo-outros-bloco"><div class="fo-outros-rot">' + rotulo + '</div>';
      if (itensLista.length) {
        h += '<ul class="fo-outros-lista">' + itensLista.map(function (p) {
          return '<li><span>' + p[0] + '</span><span>' + p[1] + '</span></li>';
        }).join('') + '</ul>';
      }
      if (nota) h += '<div class="fo-p-nota">' + nota + '</div>';
      return h + '</div>';
    }

    // Lançamentos reais do acompanhamento (vínculo por nome)
    try {
      var td = (typeof trackingData !== 'undefined') ? trackingData : null;
      if (td && Array.isArray(td.lancamentos)) {
        var lancs = td.lancamentos.filter(function (l) { return l && (l.subcategoria || l.descricao) === it.nome; });
        if (lancs.length) {
          var porMes = {};
          lancs.forEach(function (l) {
            var k = String(l.data || '').substring(0, 7);
            if (!k) return;
            if (!porMes[k]) porMes[k] = { total: 0, qtd: 0 };
            porMes[k].total += num(l.valor);
            porMes[k].qtd++;
          });
          var ks = Object.keys(porMes).sort().reverse().slice(0, 3);
          blocos.push(bloco('Lançamentos reais (acompanhamento) · ' + lancs.length + ' no total',
            ks.map(function (k) { return [esc(mesLongo(k)) + ' (' + porMes[k].qtd + ')', esc(moeda(porMes[k].total))]; }),
            'Ligados pelo nome do item.'));
        }
      }
    } catch (e) { /* bloco opcional */ }

    // Meta do item no mês do acompanhamento
    try {
      var tdm = (typeof trackingData !== 'undefined') ? trackingData : null;
      var mesAc = (typeof trackingMonth !== 'undefined') ? trackingMonth : null;
      if (tdm && tdm.metas && Object.keys(tdm.metas).length && mesAc && fn('getOccurrences')) {
        var ini = new Date(mesAc + '-01T00:00');
        if (!isNaN(ini.getTime())) {
          var fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
          var occs = getOccurrences(it, ini, fim);
          if (occs.length) {
            var otimizado = (typeof scenarioEnabled !== 'undefined' && scenarioEnabled) &&
              (estado === 'otimizado' || estado === 'otimizado-com-rascunho') && fn('getAdjustedValue');
            var total = 0;
            if (otimizado) occs.forEach(function (d) { total += num(getAdjustedValue(idx, d, 0)); });
            else total = occs.length * num(it.valor);
            var linhasMeta = [['Meta do item em ' + esc(mesLongo(mesAc)) + (otimizado ? ' (otimizada)' : ''), esc(moeda(total))]];
            var metaMes = tdm.metas[mesAc];
            if (ehDespesa(it) && metaMes && metaMes.categorias) {
              var metaCat = num(metaMes.categorias[it.categoria || 'sem_categoria']);
              if (metaCat > 0) linhasMeta.push(['Meta da categoria', esc(moeda(metaCat)) + ' · item ' + pctTexto(total / metaCat * 100) + '%']);
            }
            blocos.push(bloco('Metas do acompanhamento', linhasMeta));
          }
        }
      }
    } catch (e) { /* bloco opcional */ }

    // Participação na fatura do cartão
    try {
      var cartao = cartaoDoItem(it);
      var per = fn('getPeriodDates') ? getPeriodDates() : null;
      if (cartao && per && fn('getOccurrences') && fn('getFaturaKey')) {
        var porFat = {};
        getOccurrences(it, per.start, per.end).forEach(function (d) {
          var k = getFaturaKey(d, cartao).key;
          porFat[k] = (porFat[k] || 0) + num(it.valor);
        });
        var fks = Object.keys(porFat).sort();
        if (fks.length) {
          var calc = (typeof faturasCalculadas !== 'undefined' && faturasCalculadas) ? faturasCalculadas[cartao.id] : null;
          var linhasFat = fks.slice(0, 6).map(function (k) {
            var tot = calc && calc[k] ? num(calc[k].total) : 0;
            var txt = esc(moeda(porFat[k]));
            if (tot > 0) txt += ' de ' + esc(moeda(tot)) + ' (' + pctTexto(porFat[k] / tot * 100) + '%)';
            return ['Fatura ' + esc(mesCurto(k)), txt];
          });
          var notaFat = '';
          if (fks.length > 6) notaFat = 'Mais ' + (fks.length - 6) + ' faturas no período.';
          if (!calc) notaFat = (notaFat ? notaFat + ' ' : '') + 'Calcule a projeção para ver o total de cada fatura.';
          blocos.push(bloco('Fatura do cartão ' + esc(cartao.nome), linhasFat, notaFat));
        }
      }
    } catch (e) { /* bloco opcional */ }

    // Equivalente mensal e peso nas entradas mensais
    try {
      if (fn('calcMensalItem')) {
        var mensal = num(calcMensalItem(it));
        var entMensal = 0;
        listaItens().forEach(function (x) { if (ehEntrada(x)) entMensal += num(calcMensalItem(x)); });
        var linhasMensal = [['Equivalente mensal', esc(moeda(mensal))]];
        if (entMensal > 0 && !ehEntrada(it)) linhasMensal.push(['% das entradas mensais', pctTexto(mensal / entMensal * 100) + '%']);
        blocos.push(bloco('Orçamento mensal', linhasMensal));
      }
    } catch (e) { /* bloco opcional */ }

    // Vínculos com outras ferramentas
    try {
      var FL = window.FerramentasLinkage;
      var simId = (typeof editingSimId !== 'undefined') ? editingSimId : null;
      if (FL && typeof FL.getLinksForFluxoItem === 'function' && simId && it._linkId) {
        var links = FL.getLinksForFluxoItem(simId, it._linkId) || [];
        var linhasLink = [];
        links.forEach(function (l) {
          var alvos = [];
          if (l.comparador_comp_id) alvos.push('Comparador');
          if (l.direitos_produto_id) alvos.push('Direitos');
          if (l.cartoes_comp_id) alvos.push('Cartões');
          if (l.juros_sim_id) alvos.push('Dívidas' + (l.juros_divida_nome ? ' (' + l.juros_divida_nome + ')' : ''));
          if (alvos.length) linhasLink.push(['Associado a ' + esc(alvos.join(', ')), l.label ? esc(l.label) : '']);
        });
        if (linhasLink.length) {
          blocos.push(bloco('Vínculos', linhasLink, 'Mudar nome ou valor em "Editar item" propaga para as ferramentas associadas; ajustes do cenário não propagam.'));
        }
      }
    } catch (e) { /* bloco opcional */ }

    if (!blocos.length) { el.hidden = true; setHtml(el, ''); return; }
    el.hidden = false;
    setHtml(el, '<h3 class="fo-p-sec-titulo">De outras seções <span class="fo-p-nota" style="text-transform:none;letter-spacing:0;font-weight:400;">somente leitura</span></h3>' + blocos.join(''));
  }

  function renderRodape(temRascunho, temConfirmado, bloq) {
    var el = secao('fo-p-rodape');
    if (!el) return;
    var pendente = Object.keys(painel.pendente).length > 0;
    var html = '';
    if (bloq) html += '<span class="fo-p-rodape-info" style="color:var(--red);">Simulação bloqueada para edição</span>';
    else if (temRascunho || pendente) html += '<span class="fo-p-rodape-info">Rascunho não confirmado</span>';
    if (temRascunho) html += '<button type="button" class="fo-btn" data-fo-p="descartar"' + (bloq ? ' disabled' : '') + '>Descartar rascunho</button>';
    if (temConfirmado) html += '<button type="button" class="fo-btn fo-btn-perigo" data-fo-p="remover"' + (bloq ? ' disabled' : '') + '>Remover ajuste</button>';
    html += '<button type="button" class="fo-btn fo-btn-primario" data-fo-p="confirmar"' + ((bloq || !(temRascunho || pendente)) ? ' disabled' : '') + '>Confirmar ajuste</button>';
    comFocoPreservado(el, function () { setHtml(el, html); });
  }

  // ------------------------------------------------------------
  // 6.5 Nota e legenda da prévia na barra "Simular cenário otimizado"
  // ------------------------------------------------------------
  function garantirNotaCenario() {
    var nota = document.getElementById('fo-cenario-nota');
    if (nota) return nota;
    var barra = document.querySelector('#scenario-section .scenario-toggle-bar');
    if (!barra) return null;
    nota = document.createElement('div');
    nota.id = 'fo-cenario-nota';
    nota.innerHTML =
      '<span>Os ajustes agora ficam em 4. Itens do Fluxo — clique no nome do item.</span>' +
      '<a href="#section-body-items" class="fo-btn" role="button" data-fo-acao="ir-itens">Ir para os itens</a>' +
      '<span class="fo-legenda-previa" hidden>' +
        '<span><span class="fo-traco" style="color:#fb923c;"></span> Saldo (prévia)</span>' +
        '<span><span class="fo-traco" style="color:#f472b6;"></span> Poupança (prévia)</span>' +
      '</span>';
    barra.appendChild(nota);
    var ir = nota.querySelector('[data-fo-acao="ir-itens"]');
    if (ir) {
      ir.addEventListener('click', irParaItens);
      // role="button": a barra de espaço também ativa (âncoras só respondem ao Enter)
      ir.addEventListener('keydown', function (ev) { if (ev.key === ' ' || ev.key === 'Spacebar') irParaItens(ev); });
    }
    return nota;
  }

  function atualizarNotaCenario() {
    var nota = garantirNotaCenario();
    if (!nota) return;
    var c = { rascunhos: 0 };
    try { c = M.contagens() || c; } catch (e) { /* mantém zero */ }
    var leg = nota.querySelector('.fo-legenda-previa');
    if (leg) leg.hidden = !(num(c.rascunhos) > 0);
  }

  function irParaItens(ev) {
    if (ev) ev.preventDefault();
    var corpo = document.getElementById('section-body-items');
    if (!corpo) return;
    if (corpo.classList.contains('collapsed') && fn('toggleSection')) toggleSection('items');
    var alvo = corpo.closest('.card') || corpo;
    var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' }); } catch (e) { alvo.scrollIntoView(); }
  }

  // ------------------------------------------------------------
  // Reação às mudanças do motor (debounce 120 ms)
  // ------------------------------------------------------------
  var atualizarTudo = debounce(function () {
    decorarTabela();
    atualizarFaixa();
    atualizarNotaCenario();
    if (ui.painelLinkId) {
      if (!M.itemPorId(ui.painelLinkId)) fecharPainel(false);
      else atualizarPainel();
    }
  }, 120);

  function agendarAtualizacao() { atualizarTudo(); }

  function onMotorMudou(ev) {
    var d = (ev && ev.detail) || {};
    // 'tabela' vem de dentro do próprio renderItemsTable, que já decora ao fim
    if (d.motivo === 'tabela') return;
    if ((d.motivo === 'carregado' || d.motivo === 'simulacao') && ui.painelLinkId) {
      descartarPainelPendente();
      fecharPainel(false);
    }
    agendarAtualizacao();
  }

  // Período e saldos iniciais mudam o impacto sem passar pelo motor
  var CAMPOS_BASE = ['period-qty', 'period-unit', 'period-start', 'period-end', 'saldo-inicial', 'poupanca-inicial', 'poupanca-intocavel'];
  function onCampoBase(ev) {
    var el = ev.target;
    if (el && el.id && CAMPOS_BASE.indexOf(el.id) !== -1) agendarAtualizacao();
  }

  // ------------------------------------------------------------
  // Instalação
  // ------------------------------------------------------------
  window.renderItemsTable = renderItemsTableFO;
  instalarEventosTabela();
  document.addEventListener('fo:mudou', onMotorMudou);
  document.addEventListener('keydown', onDocKeydown);
  document.addEventListener('change', onCampoBase);

  // Pequena API para depuração e para o orquestrador
  window.FOUI = {
    abrirPainel: function (linkId) { abrirPainel(linkId, null); },
    fecharPainel: function () { fecharPainel(); },
    atualizar: function () { agendarAtualizacao(); }
  };

  function iniciar() {
    garantirFaixa();
    atualizarNotaCenario();
    if (ui.modoOtimizacao && listaItens().length) window.renderItemsTable();
    else { decorarTabela(); atualizarFaixa(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
