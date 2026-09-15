/* ============================================================================
 * fluxo-otimizacao-motor.js — MOTOR do cenário otimizado (Fluxo de Caixa)
 * ----------------------------------------------------------------------------
 * O que é:
 *   Camada de dados e cálculo que funde o "cenário otimizado" aos itens do
 *   fluxo (archives_clients/ferramentas/fluxo.html). Expõe window.FOMotor, que
 *   a interface (fluxo-otimizacao-ui.js) usa para rascunhos, confirmação,
 *   economia por item, prévia no gráfico e réplica somente leitura da análise.
 *
 * Modelo (cada entrada de scenarioAdjustments):
 *   { itemIdx, itemId, enabled, strategy, startDate, gradType, pctPerMonth,
 *     nominalPerMonth, targetPct, anchorMonth, manualMonths, manualValues
 *     (legado, não lido nem apagado), draft, confirmadoEm }
 *   - itemId (= _linkId do item) é a identidade real; itemIdx é mantido
 *     sincronizado com a posição atual para os consumidores antigos
 *     (gerarMetas, aba Tabela e aba Faturas do acompanhamento).
 *   - enabled = CONFIRMADO. draft = rascunho (não afeta metas nem faturas).
 *
 * Como desligar:
 *   Remover as tags <script src="fluxo-otimizacao-motor.js"> (e a da UI) do
 *   fluxo.html devolve exatamente o comportamento anterior: este arquivo não
 *   altera o fluxo.html, só envolve funções globais já existentes, guardando
 *   a função anterior.
 *
 * Funções globais envolvidas ou substituídas (todas com guarda typeof):
 *   getAdjustedValue (substituída: passo por mês de calendário, por _linkId)
 *   recalcScenario   (substituída: remoção por rótulo + prévia dos rascunhos)
 *   toggleScenario   (substituída: definirCenarioVisivel)
 *   renderScenarioAdjustments (neutralizada: a tabela antiga saiu de cena)
 *   renderItemsTable, calcular, applyPayload, novaSimulacao, deleteItem,
 *   deleteSelectedItems, buildPayload (envolvidas: chamam a anterior)
 *   voltarParaLista (envolvida só para gravar um salvamento pendente)
 *   applyPayload/novaSimulacao também limpam o DOM do acompanhamento
 *   (#tracking-tabs, #tracking-content) quando a simulação não tem metas.
 *
 * Evento: document 'fo:mudou' com detail { motivo, linkId }, motivo em
 *   rascunho | confirmado | descartado | removido | cenario | calculado |
 *   carregado | tabela | simulacao
 * ========================================================================== */
(function () {
  if (window.FOMotor) return; // já instalado

  // ---------------------------------------------------------------- utilidades
  var _avisados = {};
  function avisarAusente(nome) {
    if (_avisados[nome]) return;
    _avisados[nome] = true;
    try { console.warn('[FOMotor] função global ausente, ignorada: ' + nome); } catch (e) {}
  }
  function temFn(nome) {
    var ok = typeof window[nome] === 'function';
    if (!ok) avisarAusente(nome);
    return ok;
  }

  function listaItens() {
    return (typeof items !== 'undefined' && Array.isArray(items)) ? items : [];
  }
  function listaAjustes() {
    if (typeof scenarioAdjustments === 'undefined' || !Array.isArray(scenarioAdjustments)) {
      window.scenarioAdjustments = [];
    }
    return scenarioAdjustments;
  }
  function listaContas() {
    return (typeof accounts !== 'undefined' && Array.isArray(accounts)) ? accounts : [];
  }
  function simAtualId() {
    return (typeof editingSimId !== 'undefined') ? editingSimId : null;
  }
  function cenarioLigado() {
    return (typeof scenarioEnabled !== 'undefined') ? !!scenarioEnabled : false;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ym(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function parseYm(s) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return { y: parseInt(m[1], 10), m: parseInt(m[2], 10) - 1 };
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function isoDia(d) {
    if (typeof isoDate === 'function') return isoDate(d);
    return d.toISOString().split('T')[0];
  }
  function somaDias(d, n) {
    if (typeof addDays === 'function') return addDays(d, n);
    var x = new Date(d); x.setDate(x.getDate() + n); return x;
  }
  function novoId() {
    if (typeof generateId === 'function') return generateId();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function periodo() {
    if (!temFn('getPeriodDates')) return null;
    try { return getPeriodDates(); } catch (e) { return null; }
  }
  function ocorrencias(item, start, end) {
    if (!temFn('getOccurrences')) return [];
    try { return getOccurrences(item, start, end) || []; } catch (e) { return []; }
  }
  function lerMoeda(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    if (typeof parseCurrency === 'function') return parseCurrency(el.value);
    return num(String(el.value || '').replace(/\./g, '').replace(',', '.'));
  }
  function mapaCartoes() {
    var m = {};
    listaContas().forEach(function (acc) { if (acc && acc.tipo === 'cartao') m[acc.id] = acc; });
    return m;
  }

  var CAMPOS = ['strategy', 'startDate', 'gradType', 'pctPerMonth', 'nominalPerMonth', 'targetPct', 'anchorMonth', 'manualMonths'];

  function copiaMeses(mm) {
    var r = {};
    if (mm && typeof mm === 'object' && !Array.isArray(mm)) {
      Object.keys(mm).forEach(function (k) { if (parseYm(k)) r[k] = num(mm[k]); });
    }
    return r;
  }
  function copiaCfg(fonte) {
    var c = {};
    CAMPOS.forEach(function (k) { c[k] = fonte ? fonte[k] : undefined; });
    c.strategy = c.strategy || 'imediato';
    c.startDate = c.startDate || '';
    c.gradType = c.gradType || 'pct';
    c.pctPerMonth = num(c.pctPerMonth);
    c.nominalPerMonth = num(c.nominalPerMonth);
    c.targetPct = num(c.targetPct);
    c.anchorMonth = parseYm(c.anchorMonth) ? c.anchorMonth : '';
    c.manualMonths = copiaMeses(c.manualMonths);
    return c;
  }
  function mesesIguais(a, b) {
    var ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return false;
      if (Math.abs(num(a[ka[i]]) - num(b[kb[i]])) > 0.004) return false;
    }
    return true;
  }
  function cfgIguais(a, b) {
    var x = copiaCfg(a), y = copiaCfg(b);
    return x.strategy === y.strategy && x.startDate === y.startDate && x.gradType === y.gradType &&
      Math.abs(x.pctPerMonth - y.pctPerMonth) < 1e-9 &&
      Math.abs(x.nominalPerMonth - y.nominalPerMonth) < 0.004 &&
      Math.abs(x.targetPct - y.targetPct) < 1e-9 &&
      x.anchorMonth === y.anchorMonth &&
      mesesIguais(x.manualMonths, y.manualMonths);
  }

  // --------------------------------------------------------------- identidade
  function ensureItemIds() {
    listaItens().forEach(function (it) {
      if (it && typeof it === 'object' && !it._linkId) it._linkId = novoId();
    });
  }

  function itemPorId(linkId) {
    if (!linkId) return null;
    var arr = listaItens();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i]._linkId === linkId) return { item: arr[i], index: i };
    }
    return null;
  }

  function ajusteDe(linkId) {
    if (!linkId) return null;
    var arr = listaAjustes();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].itemId === linkId) return arr[i];
    }
    return null;
  }

  // Mês ('YYYY-MM') da 1ª ocorrência do item no período; sem ocorrência, o mês
  // inicial do período; sem período, null.
  function mesPrimeiraOcorrencia(item, p) {
    p = p || periodo();
    if (!p || !item) return null;
    var occs = ocorrencias(item, p.start, p.end);
    return occs.length ? ym(occs[0]) : ym(p.start);
  }

  function migrarAjustes() {
    var arr = listaAjustes();
    var its = listaItens();
    var p = periodo();
    arr.forEach(function (adj) {
      if (!adj || typeof adj !== 'object') return;
      // itemIdx -> itemId
      if (!adj.itemId) {
        var alvo = its[adj.itemIdx];
        if (alvo && alvo._linkId) adj.itemId = alvo._linkId;
      }
      if (adj.draft === undefined) adj.draft = null;
      if (!adj.strategy) adj.strategy = 'imediato';
      if (!adj.gradType) adj.gradType = 'pct';
      var ref = adj.itemId ? itemPorId(adj.itemId) : null;
      // manualValues (array por ocorrência) -> manualMonths (mapa por mês)
      var temMeses = adj.manualMonths && typeof adj.manualMonths === 'object' && !Array.isArray(adj.manualMonths);
      if (!temMeses) {
        if (Array.isArray(adj.manualValues) && adj.manualValues.length > 0) {
          if (ref && p) {
            var mm = {};
            var occs = ocorrencias(ref.item, p.start, p.end);
            occs.forEach(function (d, i) {
              var mv = adj.manualValues[i];
              if (i < adj.manualValues.length && mv && mv.valor !== undefined) {
                var k = ym(d);
                if (!Object.prototype.hasOwnProperty.call(mm, k)) mm[k] = num(mv.valor);
              }
            });
            // no formato antigo, ocorrência além do fim do array voltava ao valor original
            // (itens com várias ocorrências no mês: o 1º mês ainda sem chave recebe o original)
            if (occs.length > adj.manualValues.length) {
              for (var jx = adj.manualValues.length; jx < occs.length; jx++) {
                var kx = ym(occs[jx]);
                if (!Object.prototype.hasOwnProperty.call(mm, kx)) { mm[kx] = num(ref.item.valor); break; }
              }
            }
            adj.manualMonths = mm;
          }
          // sem período ou sem item: tenta de novo numa próxima chamada
        } else {
          adj.manualMonths = {};
        }
      }
      // anchorMonth padrão = mês da 1ª ocorrência do item no período
      if (!parseYm(adj.anchorMonth) && ref && p) adj.anchorMonth = mesPrimeiraOcorrencia(ref.item, p);
      if (adj.draft && typeof adj.draft === 'object') {
        if (!parseYm(adj.draft.anchorMonth) && ref && p) adj.draft.anchorMonth = mesPrimeiraOcorrencia(ref.item, p);
        if (!adj.draft.manualMonths || typeof adj.draft.manualMonths !== 'object' || Array.isArray(adj.draft.manualMonths)) {
          adj.draft.manualMonths = {};
        }
      } else if (adj.draft !== null) {
        adj.draft = null;
      }
      // Campo legado mantido: sem ele o código antigo (motor desligado) quebra em adj.manualValues[i]
      if (!Array.isArray(adj.manualValues)) adj.manualValues = [];
    });
  }

  // itemIdx = posição atual; remove órfãos e duplicados; poda enabled:false+draft:null.
  // Remoção por REATRIBUIÇÃO do array (nunca splice): o array antigo pode estar
  // referenciado pelo payload de uma simulação em memória.
  function sincronizar() {
    var arr = listaAjustes();
    var pos = Object.create(null);
    listaItens().forEach(function (it, i) {
      if (it && it._linkId && !(it._linkId in pos)) pos[it._linkId] = i;
    });
    var manter = [], visto = Object.create(null), removeu = false;
    arr.forEach(function (adj) {
      if (!adj || typeof adj !== 'object' || !adj.itemId || !(adj.itemId in pos)) { removeu = true; return; }
      if (adj.draft === undefined) adj.draft = null;
      if (!adj.enabled && !adj.draft) { removeu = true; return; }
      if (visto[adj.itemId]) { removeu = true; return; }
      visto[adj.itemId] = true;
      if (adj.itemIdx !== pos[adj.itemId]) adj.itemIdx = pos[adj.itemId];
      manter.push(adj);
    });
    if (removeu) window.scenarioAdjustments = manter;
  }

  function estadoDoItem(linkId) {
    var adj = ajusteDe(linkId);
    if (!adj) return 'nenhum';
    if (adj.enabled && adj.draft) return 'otimizado-com-rascunho';
    if (adj.enabled) return 'otimizado';
    if (adj.draft) return 'rascunho';
    return 'nenhum';
  }

  function contagens() {
    var r = { otimizados: 0, rascunhos: 0 };
    listaAjustes().forEach(function (adj) {
      if (!adj || !adj.itemId || !itemPorId(adj.itemId)) return;
      if (adj.enabled) r.otimizados++;
      if (adj.draft) r.rascunhos++;
    });
    return r;
  }

  function bloqueado() {
    var id = simAtualId();
    if (!id) return false;
    var sims = (typeof simulacoes !== 'undefined' && Array.isArray(simulacoes)) ? simulacoes : [];
    var sim = null;
    for (var i = 0; i < sims.length; i++) { if (sims[i] && sims[i].id === id) { sim = sims[i]; break; } }
    if (!sim || !sim.locked) return false;
    var equipe = (typeof isEquipeMode === 'function') ? !!isEquipeMode() : false;
    return !equipe;
  }

  // ------------------------------------------------- rascunho e confirmação
  function configEfetiva(linkId, usarRascunho) {
    var adj = ajusteDe(linkId);
    if (!adj) return null;
    var fonte = null;
    if (usarRascunho && adj.draft) fonte = adj.draft;
    else if (adj.enabled) fonte = adj;
    if (!fonte) return null;
    var c = copiaCfg(fonte);
    if (!c.anchorMonth) {
      var ref = itemPorId(linkId);
      var mes = ref ? mesPrimeiraOcorrencia(ref.item) : null;
      if (mes) c.anchorMonth = mes;
    }
    return c;
  }

  function rascunhoPadrao(linkId) {
    var ref = itemPorId(linkId);
    var tp = 0;
    if (ref) {
      var a = analiseDoItem(ref.index, totaisDoPeriodo());
      if (a && a.aplicavel && a.candidato && a.recomendacao !== 'nenhuma' && a.recomendacao !== 'abaixo_limiar') {
        tp = a.recomendacao === 'cancelar' ? 100 : num(a.pctSugerido);
      }
    }
    var p = periodo();
    var anc = ref ? mesPrimeiraOcorrencia(ref.item, p) : null;
    if (!anc) anc = ym(new Date());
    return {
      strategy: 'imediato', startDate: '', gradType: 'pct',
      pctPerMonth: 10, nominalPerMonth: 0, targetPct: tp,
      anchorMonth: anc, manualMonths: {}
    };
  }

  function draftSemEfeito(d) {
    var semMeses = !d.manualMonths || Object.keys(d.manualMonths).length === 0;
    return (d.strategy === 'imediato' || d.strategy === 'data') && num(d.targetPct) === 0 && semMeses;
  }

  function novaEntrada(ref) {
    // Campos confirmados neutros (enabled:false não é lido por ninguém).
    var adj = {
      itemIdx: ref.index, itemId: ref.item._linkId, enabled: false,
      strategy: 'imediato', startDate: '', gradType: 'pct',
      pctPerMonth: 10, nominalPerMonth: 0,
      targetPct: 0, anchorMonth: mesPrimeiraOcorrencia(ref.item) || '', manualMonths: {},
      manualValues: [],
      draft: null, confirmadoEm: null
    };
    listaAjustes().push(adj);
    return adj;
  }

  function removerEntrada(adj) {
    var arr = listaAjustes();
    window.scenarioAdjustments = arr.filter(function (a) { return a !== adj; });
  }

  function definirRascunho(linkId, parcial) {
    if (bloqueado()) return null;
    var ref = itemPorId(linkId);
    if (!ref) return null;
    var adj = ajusteDe(linkId);
    var criada = false;
    if (!adj) { adj = novaEntrada(ref); criada = true; }
    var base = adj.draft ? copiaCfg(adj.draft) : (adj.enabled ? configEfetiva(linkId, false) : rascunhoPadrao(linkId));
    var d = copiaCfg(base);
    if (parcial && typeof parcial === 'object') {
      CAMPOS.forEach(function (k) {
        if (!Object.prototype.hasOwnProperty.call(parcial, k) || parcial[k] === undefined) return;
        var v = parcial[k];
        if (k === 'manualMonths') d.manualMonths = copiaMeses(v);
        else if (k === 'pctPerMonth' || k === 'nominalPerMonth' || k === 'targetPct') d[k] = num(v);
        else if (k === 'anchorMonth') { if (parseYm(v)) d.anchorMonth = v; }
        else if (k === 'strategy') { if (v === 'imediato' || v === 'data' || v === 'gradativo') d.strategy = v; }
        else if (k === 'gradType') { if (v === 'pct' || v === 'nominal' || v === 'manual') d.gradType = v; }
        else if (k === 'startDate') d.startDate = v == null ? '' : String(v);
      });
    }
    if (!d.anchorMonth) d.anchorMonth = mesPrimeiraOcorrencia(ref.item) || ym(new Date());
    d.atualizadoEm = new Date().toISOString();
    adj.draft = d;
    if (adj.enabled && cfgIguais(d, configEfetiva(linkId, false))) adj.draft = null;
    else if (!adj.enabled && draftSemEfeito(d)) adj.draft = null;
    if (!adj.enabled && !adj.draft) removerEntrada(adj);
    else if (criada) adj.itemIdx = ref.index;
    emitir('rascunho', linkId);
    return adj.draft || null;
  }

  function descartarRascunho(linkId) {
    if (bloqueado()) return false;
    var adj = ajusteDe(linkId);
    if (!adj || !adj.draft) return false;
    adj.draft = null;
    if (!adj.enabled) removerEntrada(adj);
    emitir('descartado', linkId);
    return true;
  }

  function aplicarConfirmacao(adj) {
    var d = copiaCfg(adj.draft);
    CAMPOS.forEach(function (k) { adj[k] = d[k]; });
    if (!adj.anchorMonth) {
      var ref = itemPorId(adj.itemId);
      adj.anchorMonth = (ref && mesPrimeiraOcorrencia(ref.item)) || ym(new Date());
    }
    adj.enabled = true;
    adj.draft = null;
    adj.confirmadoEm = new Date().toISOString();
  }

  function confirmarRascunho(linkId) {
    if (bloqueado()) return false;
    var adj = ajusteDe(linkId);
    if (!adj || !adj.draft || !itemPorId(linkId)) return false;
    var eraPrimeiro = contagens().otimizados === 0;
    aplicarConfirmacao(adj);
    if (eraPrimeiro) aplicarCenarioVisivel(true);
    emitir('confirmado', linkId);
    return true;
  }

  function removerAjuste(linkId) {
    if (bloqueado()) return false;
    var adj = ajusteDe(linkId);
    if (!adj) return false;
    removerEntrada(adj);
    emitir('removido', linkId);
    return true;
  }

  function confirmarTodos() {
    if (bloqueado()) return 0;
    var eraPrimeiro = contagens().otimizados === 0;
    var n = 0;
    listaAjustes().forEach(function (adj) {
      if (adj && adj.draft && itemPorId(adj.itemId)) { aplicarConfirmacao(adj); n++; }
    });
    if (!n) return 0;
    if (eraPrimeiro) aplicarCenarioVisivel(true);
    emitir('confirmado', null);
    return n;
  }

  function descartarTodos() {
    if (bloqueado()) return 0;
    var n = 0;
    listaAjustes().forEach(function (adj) { if (adj && adj.draft) { adj.draft = null; n++; } });
    if (!n) return 0;
    sincronizar(); // poda as entradas que só tinham rascunho
    emitir('descartado', null);
    return n;
  }

  // Só estado + DOM (sem evento, sem salvar).
  function aplicarCenarioVisivel(v) {
    window.scenarioEnabled = !!v;
    var cb = document.getElementById('scenario-enabled');
    if (cb) cb.checked = !!v;
    var leg = document.getElementById('scenario-legend');
    if (leg) leg.style.display = v ? 'flex' : 'none';
    var bm = document.getElementById('btn-metas-otimizado');
    if (bm) bm.style.display = v ? 'inline-flex' : 'none';
  }

  function definirCenarioVisivel(v) {
    aplicarCenarioVisivel(v);
    emitir('cenario', null);
  }

  // ---------------------------------------------------------------- cálculo
  function mesesDoPeriodo() {
    var p = periodo();
    if (!p) return [];
    var r = [];
    var y = p.start.getFullYear(), m = p.start.getMonth();
    var yF = p.end.getFullYear(), mF = p.end.getMonth();
    while (y * 12 + m <= yF * 12 + mF) {
      r.push(y + '-' + pad2(m + 1));
      m++; if (m > 11) { m = 0; y++; }
    }
    return r;
  }

  // Função pura (5.2). occNumber não existe mais: o passo é por mês de calendário.
  function computeAdjustedValue(cfg, origVal, occDate) {
    var orig = num(origVal);
    var r = orig;
    if (cfg) {
      var tp = Number(cfg.targetPct) || 0;
      var alvo = orig * (1 - tp / 100);
      var d = occDate instanceof Date ? occDate : new Date(occDate);
      var estr = cfg.strategy || 'imediato';
      if (estr === 'imediato') {
        r = alvo;
      } else if (estr === 'data') {
        if (!cfg.startDate) r = orig;
        else {
          var sd = new Date(cfg.startDate + 'T00:00');
          if (isNaN(sd.getTime()) || isNaN(d.getTime())) r = orig;
          else r = d < sd ? orig : alvo;
        }
      } else if (estr === 'gradativo' && !isNaN(d.getTime())) {
        var gt = cfg.gradType || 'pct';
        if (gt === 'manual') {
          var mesOcc = ym(d), melhor = null;
          var mm = cfg.manualMonths;
          if (mm && typeof mm === 'object') {
            Object.keys(mm).forEach(function (k) {
              if (parseYm(k) && k <= mesOcc && (melhor === null || k > melhor)) melhor = k;
            });
          }
          if (melhor !== null) {
            var vm = Number(mm[melhor]);
            r = isFinite(vm) ? vm : orig;
          } else r = orig;
        } else {
          // Sem âncora na cfg: o chamador deveria ter resolvido; aqui vale o
          // próprio mês da ocorrência (passo 0).
          var anc = parseYm(cfg.anchorMonth) || { y: d.getFullYear(), m: d.getMonth() };
          var passos = (d.getFullYear() * 12 + d.getMonth()) - (anc.y * 12 + anc.m);
          if (passos < 0) r = orig;
          else if (gt === 'pct') {
            var ppm = Number(cfg.pctPerMonth) || 0;
            var red = tp >= 0 ? Math.min(tp, ppm * passos) : Math.max(tp, -ppm * passos);
            var res = orig * (1 - red / 100);
            r = tp >= 0 ? Math.max(res, alvo) : Math.min(res, alvo);
          } else if (gt === 'nominal') {
            var npm = Number(cfg.nominalPerMonth) || 0;
            r = tp >= 0 ? Math.max(orig - npm * passos, alvo) : Math.min(orig + npm * passos, alvo);
          } else r = orig;
        }
      }
    }
    if (!isFinite(r)) r = orig;
    return r < 0 ? 0 : r;
  }

  function mesDeImpacto(item, occDate, cartoes) {
    if (item && item.formaPagamento) {
      var cartao = (cartoes || mapaCartoes())[item.formaPagamento];
      if (cartao && typeof getFaturaKey === 'function') {
        try { return getFaturaKey(occDate, cartao).key; } catch (e) {}
      }
    }
    return ym(occDate);
  }

  // cfg com âncora resolvida para o item (não altera a entrada).
  function cfgComAncora(fonte, item, p) {
    var c = copiaCfg(fonte);
    if (!c.anchorMonth) c.anchorMonth = mesPrimeiraOcorrencia(item, p) || '';
    return c;
  }

  // Monta { linkId: cfg } para a simulação. modo: 'confirmado' | 'previa'.
  function mapaCfg(modo, somenteRascunhoDe, p) {
    var m = Object.create(null);
    listaAjustes().forEach(function (adj) {
      if (!adj || !adj.itemId) return;
      var ref = itemPorId(adj.itemId);
      if (!ref) return;
      var fonte = null;
      if (modo === 'previa' && adj.draft && (!somenteRascunhoDe || somenteRascunhoDe === adj.itemId)) fonte = adj.draft;
      else if (adj.enabled) fonte = adj;
      if (fonte) m[adj.itemId] = cfgComAncora(fonte, ref.item, p);
    });
    return m;
  }
  function valorFnDe(mapa) {
    return function (item, index, occDate) {
      var cfg = item && item._linkId ? mapa[item._linkId] : null;
      return cfg ? computeAdjustedValue(cfg, item.valor, occDate) : item.valor;
    };
  }

  function serieMensalDoItem(linkId, usarRascunho) {
    var ref = itemPorId(linkId);
    var p = periodo();
    if (!ref || !p) return [];
    var cfg = configEfetiva(linkId, !!usarRascunho);
    var porMes = {};
    mesesDoPeriodo().forEach(function (k) { porMes[k] = { mes: k, original: 0, ajustado: 0 }; });
    var cartoes = mapaCartoes();
    var cartao = ref.item.formaPagamento ? cartoes[ref.item.formaPagamento] : null;
    ocorrencias(ref.item, p.start, p.end).forEach(function (d) {
      var k = null;
      if (cartao && typeof getFaturaKey === 'function') {
        // Mesmo filtro de calcular (fluxo.html, faturas): fatura com vencimento
        // fora do período não passa pelo caixa do período e não entra na série.
        var fat = null;
        try { fat = getFaturaKey(d, cartao); } catch (e) { fat = null; }
        if (fat && fat.vencDate) {
          if (fat.vencDate < p.start || fat.vencDate > p.end) return;
          k = fat.key;
        }
      }
      if (!k) k = ym(d);
      if (!porMes[k]) porMes[k] = { mes: k, original: 0, ajustado: 0 };
      var orig = num(ref.item.valor);
      porMes[k].original += orig;
      porMes[k].ajustado += cfg ? computeAdjustedValue(cfg, orig, d) : orig;
    });
    return Object.keys(porMes).sort().map(function (k) {
      var e = porMes[k];
      return { mes: k, original: Math.round(e.original * 100) / 100, ajustado: Math.round(e.ajustado * 100) / 100 };
    });
  }

  // mediaMensal = economia do período ÷ nº de meses desde o primeiro mês com mudança
  // (até o último mês da série), para que "−R$ X/mês desde mmm/aa" seja fiel.
  function economiaDoItem(linkId, usarRascunho) {
    var ref = itemPorId(linkId);
    var ehEntrada = !!(ref && ref.item.tipo === 'entrada');
    var r = { periodo: 0, mediaMensal: 0, primeiroMes: null, ehEntrada: ehEntrada };
    if (!ref) return r;
    var serie = serieMensalDoItem(linkId, usarRascunho);
    var iPrim = -1, total = 0;
    serie.forEach(function (s, i) {
      var dif = ehEntrada ? (s.ajustado - s.original) : (s.original - s.ajustado);
      total += dif;
      if (iPrim < 0 && Math.abs(s.original - s.ajustado) > 0.004) iPrim = i;
    });
    r.periodo = Math.round(total * 100) / 100;
    if (iPrim >= 0) {
      r.primeiroMes = serie[iPrim].mes;
      var nMeses = serie.length - iPrim;
      r.mediaMensal = nMeses > 0 ? Math.round((total / nMeses) * 100) / 100 : 0;
    }
    return r;
  }

  // 5.4 — mesma montagem de eventos e mesmas regras dia a dia de calcular().
  function simularFluxo(valorFn) {
    var vazio = { saldoFinal: null, poupFinal: null, saldoPorDia: [], poupPorDia: [], eventosPorDia: {} };
    var p = periodo();
    var its = listaItens();
    if (!p || its.length === 0) return vazio;
    if (typeof getFaturaKey !== 'function') { avisarAusente('getFaturaKey'); return vazio; }
    var fn = typeof valorFn === 'function' ? valorFn : function (item) { return item.valor; };
    var start = p.start, end = p.end;

    var saldo = lerMoeda('saldo-inicial');
    var poupanca = lerMoeda('poupanca-inicial');
    var poupancaIntocavel = lerMoeda('poupanca-intocavel');
    if (poupancaIntocavel > poupanca) poupancaIntocavel = poupanca;

    var cartoesMap = mapaCartoes();
    var events = {};
    var faturas = {};

    its.forEach(function (item, index) {
      var occs = ocorrencias(item, start, end);
      var isCartao = item.formaPagamento && cartoesMap[item.formaPagamento];
      occs.forEach(function (d) {
        var v = fn(item, index, d);
        if (isCartao) {
          var cartao = cartoesMap[item.formaPagamento];
          var fat = getFaturaKey(d, cartao);
          if (!faturas[item.formaPagamento]) faturas[item.formaPagamento] = {};
          if (!faturas[item.formaPagamento][fat.key]) {
            faturas[item.formaPagamento][fat.key] = { vencDate: fat.vencDate, total: 0 };
          }
          faturas[item.formaPagamento][fat.key].total += v;
        } else {
          var key = isoDia(d);
          if (!events[key]) events[key] = [];
          events[key].push(Object.assign({}, item, { valor: v }));
        }
      });
    });

    // Faturas anexadas DEPOIS dos eventos diretos do dia (como calcular 1692-1710)
    Object.keys(faturas).forEach(function (cartaoId) {
      var cartao = cartoesMap[cartaoId];
      var fs = faturas[cartaoId];
      Object.keys(fs).forEach(function (fatKey) {
        var fat = fs[fatKey];
        if (fat.vencDate >= start && fat.vencDate <= end) {
          var key = isoDia(fat.vencDate);
          if (!events[key]) events[key] = [];
          events[key].push({
            tipo: 'saida', subtipo: 'despesa',
            nome: 'Fatura ' + cartao.nome + ' (' + fatKey + ')',
            valor: fat.total,
            categoria: 'dividas',
            _isFatura: true,
            _cartaoId: cartaoId
          });
        }
      });
    });

    var saldoPorDia = [], poupPorDia = [], eventosPorDia = {};
    var dayIndex = 0;
    var cur = new Date(start);
    while (cur <= end) {
      var dayItems = events[isoDia(cur)] || [];
      if (dayItems.length > 0) {
        eventosPorDia[dayIndex] = dayItems.map(function (it) {
          return { nome: it.nome || (it._isFatura ? 'Fatura Cartão' : 'Item'), valor: it.valor, tipo: it.tipo, subtipo: it.subtipo || '' };
        });
      }
      dayItems.forEach(function (it) {
        if (it.tipo === 'entrada') {
          saldo += it.valor;
        } else if (it.subtipo === 'poupanca') {
          if (saldo >= it.valor) {
            saldo -= it.valor;
            poupanca += it.valor;
          } else {
            poupanca += Math.max(0, saldo);
            saldo = Math.min(0, saldo - it.valor);
          }
          if (!it.usarComoComplemento) {
            poupancaIntocavel += it.valor;
            if (poupancaIntocavel > poupanca) poupancaIntocavel = poupanca;
          }
        } else {
          saldo -= it.valor;
          if (saldo < 0) {
            var poupDisponivel = Math.max(0, poupanca - poupancaIntocavel);
            var deficit = Math.abs(saldo);
            if (poupDisponivel >= deficit) {
              poupanca -= deficit;
              saldo = 0;
            } else if (poupDisponivel > 0) {
              saldo += poupDisponivel;
              poupanca -= poupDisponivel;
            }
          }
        }
      });
      saldoPorDia.push(parseFloat(saldo.toFixed(2)));
      poupPorDia.push(parseFloat(poupanca.toFixed(2)));
      dayIndex++;
      cur = somaDias(cur, 1);
    }
    return { saldoFinal: saldo, poupFinal: poupanca, saldoPorDia: saldoPorDia, poupPorDia: poupPorDia, eventosPorDia: eventosPorDia };
  }

  function impacto(opcoes) {
    opcoes = opcoes || {};
    var p = periodo();
    var atual = simularFluxo(function (item) { return item.valor; });
    var conf = simularFluxo(valorFnDe(mapaCfg('confirmado', null, p)));
    var previa = null;
    var alvo = opcoes.somenteRascunhoDe || null;
    var temRascunho = alvo ? !!(ajusteDe(alvo) && ajusteDe(alvo).draft) : contagens().rascunhos > 0;
    if (temRascunho) {
      var pv = simularFluxo(valorFnDe(mapaCfg('previa', alvo, p)));
      previa = { saldo: pv.saldoFinal, poup: pv.poupFinal };
    }
    return {
      atual: { saldo: atual.saldoFinal, poup: atual.poupFinal },
      confirmado: { saldo: conf.saldoFinal, poup: conf.poupFinal },
      previa: previa
    };
  }

  // 5.5 — mesma regra de calcular 1717-1722 / 1784-1790.
  function totaisDoPeriodo() {
    var r = { totEnt: 0, totDesp: 0, totalPorIndice: {} };
    var p = periodo();
    if (!p) return r;
    listaItens().forEach(function (it, idx) {
      var t = ocorrencias(it, p.start, p.end).length * it.valor;
      r.totalPorIndice[idx] = t;
      if (it.tipo === 'entrada') r.totEnt += t;
      else if (it.subtipo === 'poupanca') { /* poupança: fora dos dois totais */ }
      else r.totDesp += t;
    });
    return r;
  }

  // RÉPLICA SOMENTE LEITURA da regra de renderAnalise (fluxo.html): candidato
  // score >= 4.5 (Bloco 3) e recomendação na ordem exata do bloco
  // "Candidatos a Redução ou Revisão" (linhas ~2628-2646). Espelha aquela seção
  // e NÃO deve divergir dela; se a regra lá mudar, mude aqui também.
  // pctEntradas e pctDespesas vêm em pontos percentuais (0-100), como no Bloco 2.
  function analiseDoItem(index, totais) {
    var it = listaItens()[index];
    if (!it || it.subtipo !== 'despesa') return { aplicavel: false };
    var t = totais || totaisDoPeriodo();
    if (!t || !t.totEnt) return { aplicavel: false };
    if (typeof calcPotencialAjuste !== 'function' || typeof calcPercentualReducao !== 'function') {
      avisarAusente('calcPotencialAjuste/calcPercentualReducao');
      return { aplicavel: false };
    }
    var total = (t.totalPorIndice && t.totalPorIndice[index] !== undefined) ? t.totalPorIndice[index] : 0;
    var score = calcPotencialAjuste(it, total, t.totEnt, t.totDesp);
    var candidato = score >= 4.5;
    var pct = calcPercentualReducao(score);
    var rec;
    if (it.alteravel === 'nao' && it.disposto === 'nao') { rec = 'nenhuma'; pct = 0; }
    else if (it.disposto === 'nao' && it.alteravel === 'sim') { rec = 'nenhuma'; pct = 0; }
    else if (it.disposto === 'cancelaria' && it.importancia && parseInt(it.importancia) >= 5) { rec = 'cancelar'; pct = 100; }
    else if (it.disposto === 'cancelaria') { rec = 'cancelar'; pct = Math.max(50, pct); }
    else { rec = 'reduzir'; }
    return {
      aplicavel: true,
      score: score,
      candidato: candidato,
      recomendacao: candidato ? rec : 'abaixo_limiar',
      pctSugerido: candidato ? pct : 0,
      totalPeriodo: total,
      pctEntradas: t.totEnt > 0 ? (total / t.totEnt) * 100 : 0,
      pctDespesas: t.totDesp > 0 ? (total / t.totDesp) * 100 : 0
    };
  }

  // ------------------------------------------------ gráfico e persistência
  var ROTULOS_CENARIO = ['Saldo Otimizado', 'Poupança Otimizada', 'Saldo (prévia)', 'Poupança (prévia)'];

  function recalcGrafico() {
    if (typeof chartInstance === 'undefined' || !chartInstance || !chartInstance.data) return;
    var datasets = chartInstance.data.datasets;
    for (var i = datasets.length - 1; i >= 0; i--) {
      if (ROTULOS_CENARIO.indexOf(datasets[i].label) !== -1) datasets.splice(i, 1);
    }
    var vista = (typeof chartView !== 'undefined') ? chartView : 'both';
    var p = periodo();
    var cont = contagens();
    window._chartDailyEventsOpt = {};
    if (p && typeof getFaturaKey === 'function') {
      if (cenarioLigado() && cont.otimizados > 0) {
        var conf = simularFluxo(valorFnDe(mapaCfg('confirmado', null, p)));
        if (conf.saldoFinal !== null) {
          datasets.push({
            label: 'Saldo Otimizado', data: conf.saldoPorDia,
            borderColor: 'rgba(34,197,94,0.6)', backgroundColor: 'transparent',
            borderDash: [6, 3], fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 3,
            borderWidth: 2, hidden: vista === 'savings'
          });
          datasets.push({
            label: 'Poupança Otimizada', data: conf.poupPorDia,
            borderColor: 'rgba(96,165,250,0.6)', backgroundColor: 'transparent',
            borderDash: [6, 3], fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 3,
            borderWidth: 2, hidden: vista === 'balance'
          });
          window._chartDailyEventsOpt = conf.eventosPorDia;
        }
      }
      if (cont.rascunhos > 0) {
        var pv = simularFluxo(valorFnDe(mapaCfg('previa', null, p)));
        if (pv.saldoFinal !== null) {
          datasets.push({
            label: 'Saldo (prévia)', data: pv.saldoPorDia,
            borderColor: '#fb923c', backgroundColor: 'transparent',
            borderDash: [8, 4], fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 3,
            borderWidth: 2, hidden: vista === 'savings'
          });
          datasets.push({
            label: 'Poupança (prévia)', data: pv.poupPorDia,
            borderColor: '#f472b6', backgroundColor: 'transparent',
            borderDash: [8, 4], fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 3,
            borderWidth: 2, hidden: vista === 'balance'
          });
        }
      }
    }
    try { chartInstance.update(); } catch (e) {}
    if (typeof addRealEvolutionToChart === 'function') {
      try { addRealEvolutionToChart(); } catch (e) {}
    }
  }

  var _tGrafico = null;
  function agendarGrafico() {
    if (_tGrafico) clearTimeout(_tGrafico);
    _tGrafico = setTimeout(function () { _tGrafico = null; recalcGrafico(); }, 350);
  }

  var _tPersist = null, _simDoPersist = null;
  function executarPersistencia() {
    _tPersist = null;
    var alvo = _simDoPersist;
    _simDoPersist = null;
    var id = simAtualId();
    if (!id || id !== alvo) return; // trocou de simulação: não grava na errada
    if (bloqueado()) return;
    if (typeof saveToStorage !== 'function') { avisarAusente('saveToStorage'); return; }
    try { saveToStorage(); } catch (e) { try { console.warn('[FOMotor] falha ao salvar', e); } catch (e2) {} }
  }
  function persistir(ms) {
    var espera = (typeof ms === 'number' && ms >= 0) ? ms : 800;
    if (_tPersist) { clearTimeout(_tPersist); _tPersist = null; }
    _simDoPersist = simAtualId();
    if (!_simDoPersist) return;
    if (espera === 0) executarPersistencia();
    else _tPersist = setTimeout(executarPersistencia, espera);
  }
  function gravarPendente() {
    if (_tPersist) { clearTimeout(_tPersist); executarPersistencia(); }
  }

  // Redesenha o acompanhamento visível (metas/faturas usam o confirmado).
  function atualizarAcompanhamento() {
    try {
      var sec = document.getElementById('tracking-section');
      if (!sec || sec.style.display === 'none') return;
      if (typeof trackingData === 'undefined' || !trackingData || !trackingData.metas || !Object.keys(trackingData.metas).length) return;
      if (typeof trackingView !== 'undefined' && trackingView === 'faturas') {
        if (typeof renderTrackingFaturas === 'function') renderTrackingFaturas();
      } else if (typeof renderTracking === 'function') {
        renderTracking();
      }
    } catch (e) {}
  }

  // Limpa a interface do acompanhamento herdada da simulação anterior
  // (#tracking-tabs visível e #tracking-content com metas/lançamentos antigos).
  // Só deve ser chamada quando a simulação atual não tem metas.
  function limparAcompanhamentoDom() {
    try {
      var tt = document.getElementById('tracking-tabs');
      if (tt) tt.style.display = 'none';
      if (typeof trackingMonth !== 'undefined') window.trackingMonth = null;
      var tc = document.getElementById('tracking-content');
      if (!tc) return;
      var desenhou = false;
      if (typeof renderTracking === 'function') {
        // Com trackingMonth null, renderTracking desenha o aviso "Gerar Metas".
        try { renderTracking(); desenhou = true; } catch (e) { desenhou = false; }
      }
      if (!desenhou) tc.innerHTML = '';
    } catch (e) {}
  }
  function semMetas() {
    return typeof trackingData === 'undefined' || !trackingData || !trackingData.metas ||
      typeof trackingData.metas !== 'object' || !Object.keys(trackingData.metas).length;
  }

  var MOTIVOS_ESTADO = { rascunho: 800, cenario: 800, confirmado: 0, descartado: 0, removido: 0 };

  function emitir(motivo, linkId) {
    if (Object.prototype.hasOwnProperty.call(MOTIVOS_ESTADO, motivo)) {
      agendarGrafico();
      persistir(MOTIVOS_ESTADO[motivo]);
      if (motivo === 'confirmado' || motivo === 'removido' || motivo === 'cenario') atualizarAcompanhamento();
    }
    try {
      document.dispatchEvent(new CustomEvent('fo:mudou', { detail: { motivo: motivo, linkId: linkId || null } }));
    } catch (e) {}
  }

  // ------------------------------------------------------------- API global
  window.FOMotor = {
    ensureItemIds: ensureItemIds,
    migrarAjustes: migrarAjustes,
    sincronizar: sincronizar,
    itemPorId: itemPorId,
    ajusteDe: ajusteDe,
    estadoDoItem: estadoDoItem,
    contagens: contagens,
    bloqueado: bloqueado,
    configEfetiva: configEfetiva,
    rascunhoPadrao: rascunhoPadrao,
    definirRascunho: definirRascunho,
    descartarRascunho: descartarRascunho,
    confirmarRascunho: confirmarRascunho,
    removerAjuste: removerAjuste,
    confirmarTodos: confirmarTodos,
    descartarTodos: descartarTodos,
    definirCenarioVisivel: definirCenarioVisivel,
    mesesDoPeriodo: mesesDoPeriodo,
    computeAdjustedValue: computeAdjustedValue,
    mesDeImpacto: mesDeImpacto,
    serieMensalDoItem: serieMensalDoItem,
    economiaDoItem: economiaDoItem,
    simularFluxo: simularFluxo,
    impacto: impacto,
    totaisDoPeriodo: totaisDoPeriodo,
    analiseDoItem: analiseDoItem,
    recalcGrafico: recalcGrafico,
    persistir: persistir
  };

  // --------------------------------------------------- wrappers (5.3)
  var _carregando = false; // durante applyPayload: não migrar ajustes da simulação anterior contra itens novos
  var anteriores = {};

  // getAdjustedValue: confirmado por _linkId; occNumber ignorado.
  if (temFn('getAdjustedValue')) anteriores.getAdjustedValue = window.getAdjustedValue;
  window.getAdjustedValue = function (itemIdx, occDate, occNumber) {
    var item = listaItens()[itemIdx];
    if (!item) return 0;
    var adj = item._linkId ? ajusteDe(item._linkId) : null;
    if (!adj || !adj.enabled) return item.valor;
    var cfg = parseYm(adj.anchorMonth) ? adj : cfgComAncora(adj, item);
    return computeAdjustedValue(cfg, item.valor, occDate);
  };

  // recalcScenario: substituído (não chama o antigo).
  if (temFn('recalcScenario')) anteriores.recalcScenario = window.recalcScenario;
  // O override de calcular do fluxo.html já chama recalcScenario; durante o calcular a trava
  // evita simular o período duas vezes (o wrapper abaixo recalcula uma vez, no fim).
  var _emCalculo = false;
  window.recalcScenario = function () { if (!_emCalculo) recalcGrafico(); };

  if (temFn('toggleScenario')) anteriores.toggleScenario = window.toggleScenario;
  window.toggleScenario = function () {
    var cb = document.getElementById('scenario-enabled');
    definirCenarioVisivel(cb ? cb.checked : !cenarioLigado());
  };

  if (temFn('renderScenarioAdjustments')) anteriores.renderScenarioAdjustments = window.renderScenarioAdjustments;
  window.renderScenarioAdjustments = function () { /* neutralizada: criava entradas-lixo */ };

  if (temFn('renderItemsTable')) {
    anteriores.renderItemsTable = window.renderItemsTable;
    window.renderItemsTable = function () {
      ensureItemIds();
      if (!_carregando) { migrarAjustes(); sincronizar(); }
      var r = anteriores.renderItemsTable.apply(this, arguments);
      emitir('tabela', null);
      return r;
    };
  }

  if (temFn('calcular')) {
    anteriores.calcular = window.calcular;
    window.calcular = function () {
      var r;
      _emCalculo = true;
      try { r = anteriores.calcular.apply(this, arguments); }
      finally { _emCalculo = false; }
      sincronizar();
      if (_tGrafico) { clearTimeout(_tGrafico); _tGrafico = null; }
      recalcGrafico();
      emitir('calculado', null);
      return r;
    };
  }

  if (temFn('applyPayload')) {
    anteriores.applyPayload = window.applyPayload;
    window.applyPayload = function (data) {
      var r;
      _carregando = true;
      try { r = anteriores.applyPayload.apply(this, arguments); }
      finally { _carregando = false; }
      if (data && typeof data === 'object') {
        if (!data.scenarioAdjustments || !Array.isArray(scenarioAdjustments)) {
          window.scenarioAdjustments = [];
          window.scenarioEnabled = false;
        }
        if (!data.trackingData) {
          window.trackingData = { metas: {}, lancamentos: [], sheetsUrl: '' };
          if (typeof trackingMonth !== 'undefined') window.trackingMonth = null;
        }
        // Sem metas (sem trackingData ou com metas vazias): tira da tela o
        // acompanhamento da simulação anterior.
        if (semMetas()) limparAcompanhamentoDom();
        if (!data.lastCalcSummary) window.lastCalcSummary = null;
        ensureItemIds();
        migrarAjustes();
        sincronizar();
        aplicarCenarioVisivel(cenarioLigado());
        emitir('carregado', null);
      }
      return r;
    };
  }

  if (temFn('novaSimulacao')) {
    anteriores.novaSimulacao = window.novaSimulacao;
    window.novaSimulacao = function () {
      gravarPendente(); // ainda na simulação anterior: grava o que estava pendente
      var r = anteriores.novaSimulacao.apply(this, arguments);
      window.scenarioAdjustments = [];
      window.scenarioEnabled = false;
      window.trackingData = { metas: {}, lancamentos: [], sheetsUrl: '' };
      if (typeof trackingMonth !== 'undefined') window.trackingMonth = null;
      limparAcompanhamentoDom();
      window.lastCalcSummary = null;
      aplicarCenarioVisivel(false);
      if (_tGrafico) { clearTimeout(_tGrafico); _tGrafico = null; }
      recalcGrafico();
      emitir('simulacao', null);
      return r;
    };
  }

  function envolverExclusao(nome) {
    if (!temFn(nome)) return;
    anteriores[nome] = window[nome];
    window[nome] = function () {
      // simulação bloqueada para o cliente: nada é excluído (nem pelo teclado)
      if (bloqueado()) return;
      var antes = listaItens().length;
      var r = anteriores[nome].apply(this, arguments);
      sincronizar();
      if (listaItens().length !== antes) persistir(0);
      return r;
    };
  }
  envolverExclusao('deleteItem');
  envolverExclusao('deleteSelectedItems');

  if (temFn('buildPayload')) {
    anteriores.buildPayload = window.buildPayload;
    window.buildPayload = function () {
      if (!_carregando) sincronizar();
      return anteriores.buildPayload.apply(this, arguments);
    };
  }

  // Grava um salvamento pendente antes de sair do editor (evita perder o
  // último rascunho digitado nos 800 ms do debounce).
  if (typeof window.voltarParaLista === 'function') {
    anteriores.voltarParaLista = window.voltarParaLista;
    window.voltarParaLista = function () {
      gravarPendente();
      return anteriores.voltarParaLista.apply(this, arguments);
    };
  }
  try { window.addEventListener('pagehide', gravarPendente); } catch (e) {}

  window.FOMotor._anteriores = anteriores; // referência para depuração

  // --------------------------------------------------- simulação já aberta
  try {
    if (simAtualId() && listaItens().length) {
      ensureItemIds();
      migrarAjustes();
      sincronizar();
      aplicarCenarioVisivel(cenarioLigado());
      emitir('carregado', null);
    }
  } catch (e) {
    try { console.warn('[FOMotor] falha na inicialização', e); } catch (e2) {}
  }
})();
