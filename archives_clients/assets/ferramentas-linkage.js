// ═══════════════════════════════════════════════════════════════════════════
//  FERRAMENTAS LINKAGE ENGINE v3.0
//  Módulo compartilhado de associação/sincronização entre ferramentas:
//  - Direitos (produtos + direitos)
//  - Fluxo de Caixa (itens)
//  - Comparador de Produtos (produtos + parâmetros obj/subj)
//
//  Persistência: ferramentas_dados com ferramenta = 'linkage'
//  Estrutura: { links: [...], deletedBadges: [...] }
//
//  Uso: <script src="../assets/ferramentas-linkage.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  var LINKAGE_FERRAMENTA = 'linkage';
  var LINKAGE_LS_KEY = 'hv_linkage_local';
  var _linkSbClient = null;
  var _linkSaveTimer = null;

  // ═══════════════════════════════════════════════════════════════════════
  //  ESTADO
  // ═══════════════════════════════════════════════════════════════════════
  // Link: {
  //   id, label, valor, periodicidade,
  //   direitos_visao_id, direitos_produto_id,
  //   fluxo_sim_id, fluxo_item_id, fluxo_item_nome,
  //   comparador_comp_id, comparador_product_id,
  //   direitos_params: [{ direito_id, nome, valor, categoria }],
  //   created_at, updated_at
  // }
  // DeletedBadge: {
  //   id, link_id, deleted_from, deleted_at, item_label, acknowledged: false
  // }
  var state = {
    links: [],
    deletedBadges: []
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  SUPABASE CLIENT
  // ═══════════════════════════════════════════════════════════════════════
  function _initSb() {
    if (_linkSbClient) return _linkSbClient;
    // Reuse existing supabase client from page
    if (global.mithraSupabaseClient) { _linkSbClient = global.mithraSupabaseClient; return _linkSbClient; }
    if (global.sb) { _linkSbClient = global.sb; return _linkSbClient; }
    if (global.supabase && global._supabaseUrl && global._supabaseKey) {
      _linkSbClient = global.supabase.createClient(global._supabaseUrl, global._supabaseKey);
      return _linkSbClient;
    }
    if (global.supabase && global.supabase.createClient) {
      // Fallback: use hardcoded URL/key from layout.js pattern
      try {
        var scripts = document.querySelectorAll('script[src*="layout.js"]');
        if (scripts.length > 0 && global.mithraSupabaseClient) {
          _linkSbClient = global.mithraSupabaseClient;
          return _linkSbClient;
        }
      } catch(e) {}
    }
    return null;
  }

  function _getClienteId() {
    return sessionStorage.getItem('cliente_id') || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PERSISTÊNCIA
  // ═══════════════════════════════════════════════════════════════════════
  function _getLsKey() {
    var cid = _getClienteId();
    return cid ? LINKAGE_LS_KEY + '_' + cid : LINKAGE_LS_KEY;
  }

  async function load() {
    _initSb();
    var cid = _getClienteId();

    if (_linkSbClient && cid) {
      try {
        var res = await _linkSbClient.from('ferramentas_dados')
          .select('dados')
          .eq('cliente_id', cid)
          .eq('ferramenta', LINKAGE_FERRAMENTA)
          .maybeSingle();
        if (res.data && res.data.dados) {
          state.links = res.data.dados.links || [];
          state.deletedBadges = res.data.dados.deletedBadges || [];
          try { localStorage.setItem(_getLsKey(), JSON.stringify(state)); } catch(e) {}
          return;
        }
      } catch(e) { console.warn('[Linkage] Erro Supabase load:', e); }
    }

    var local = localStorage.getItem(_getLsKey());
    if (local) {
      try {
        var d = JSON.parse(local);
        state.links = d.links || [];
        state.deletedBadges = d.deletedBadges || [];
      } catch(e) {
        state.links = [];
        state.deletedBadges = [];
      }
    }
  }

  function save() {
    try { localStorage.setItem(_getLsKey(), JSON.stringify(state)); } catch(e) {}
    if (_linkSaveTimer) clearTimeout(_linkSaveTimer);
    _linkSaveTimer = setTimeout(function() { _saveToSupabase(); }, 1200);
  }

  async function _saveToSupabase() {
    var cid = _getClienteId();
    var sb = _initSb();
    if (!sb || !cid) return;
    try {
      await sb.from('ferramentas_dados').upsert({
        cliente_id: cid,
        ferramenta: LINKAGE_FERRAMENTA,
        dados: { links: state.links, deletedBadges: state.deletedBadges },
        updated_at: new Date().toISOString()
      }, { onConflict: 'cliente_id,ferramenta' });
    } catch(e) { console.warn('[Linkage] Erro Supabase save:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CRUD DE LINKS
  // ═══════════════════════════════════════════════════════════════════════
  function genId() { return Date.now() + Math.floor(Math.random() * 10000); }

  function createLink(opts) {
    var link = {
      id: genId(),
      label: opts.label || '',
      valor: opts.valor || 0,
      periodicidade: opts.periodicidade || 'mensal',
      direitos_visao_id: opts.direitos_visao_id || null,
      direitos_produto_id: opts.direitos_produto_id || null,
      fluxo_sim_id: opts.fluxo_sim_id || null,
      fluxo_item_id: opts.fluxo_item_id || null,
      fluxo_item_nome: opts.fluxo_item_nome || null,
      comparador_comp_id: opts.comparador_comp_id || null,
      comparador_product_id: opts.comparador_product_id || null,
      direitos_params: opts.direitos_params || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    state.links.push(link);
    save();
    return link;
  }

  function updateLink(linkId, fields) {
    var link = state.links.find(function(l) { return l.id === linkId; });
    if (!link) return null;
    Object.keys(fields).forEach(function(k) { link[k] = fields[k]; });
    link.updated_at = new Date().toISOString();
    save();
    return link;
  }

  function removeLink(linkId) {
    state.links = state.links.filter(function(l) { return l.id !== linkId; });
    state.deletedBadges = state.deletedBadges.filter(function(b) { return b.link_id !== linkId; });
    save();
  }

  function findLinks(filter) {
    return state.links.filter(function(l) {
      if (filter.direitos_produto_id !== undefined && l.direitos_produto_id !== filter.direitos_produto_id) return false;
      if (filter.direitos_visao_id !== undefined && l.direitos_visao_id !== filter.direitos_visao_id) return false;
      if (filter.fluxo_sim_id !== undefined && l.fluxo_sim_id !== filter.fluxo_sim_id) return false;
      if (filter.fluxo_item_id !== undefined && l.fluxo_item_id !== filter.fluxo_item_id) return false;
      if (filter.comparador_comp_id !== undefined && l.comparador_comp_id !== filter.comparador_comp_id) return false;
      if (filter.comparador_product_id !== undefined && l.comparador_product_id !== filter.comparador_product_id) return false;
      return true;
    });
  }

  function getLinksForDireitoProduto(visaoId, produtoId) {
    return state.links.filter(function(l) {
      return l.direitos_visao_id === visaoId && l.direitos_produto_id === produtoId;
    });
  }

  function getLinksForFluxoItem(simId, itemId) {
    return state.links.filter(function(l) {
      return l.fluxo_sim_id === simId && l.fluxo_item_id === itemId;
    });
  }

  function getLinksForComparadorProduct(compId, productId) {
    return state.links.filter(function(l) {
      return l.comparador_comp_id === compId && l.comparador_product_id === productId;
    });
  }

  function getAllLinksForFluxo(simId) {
    return state.links.filter(function(l) { return l.fluxo_sim_id === simId; });
  }

  function getAllLinksForComparador(compId) {
    return state.links.filter(function(l) { return l.comparador_comp_id === compId; });
  }

  function getAllLinksForDireitos(visaoId) {
    if (visaoId !== undefined) {
      return state.links.filter(function(l) { return l.direitos_visao_id === visaoId; });
    }
    return state.links.filter(function(l) { return l.direitos_visao_id !== null; });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  BADGES DE EXCLUSÃO
  // ═══════════════════════════════════════════════════════════════════════
  function registerDeletion(linkId, deletedFrom) {
    var link = state.links.find(function(l) { return l.id === linkId; });
    if (!link) return null;

    var badge = {
      id: genId(),
      link_id: linkId,
      deleted_from: deletedFrom,
      deleted_at: new Date().toISOString(),
      item_label: link.label || 'Item sem nome',
      acknowledged: false
    };
    state.deletedBadges.push(badge);
    save();
    return badge;
  }

  function getPendingBadges(ferramenta) {
    return state.deletedBadges.filter(function(b) {
      if (b.acknowledged) return false;
      if (b.deleted_from === ferramenta) return false;
      var link = state.links.find(function(l) { return l.id === b.link_id; });
      if (!link) return false;
      if (ferramenta === 'direitos') return link.direitos_produto_id != null;
      if (ferramenta === 'fluxo') return link.fluxo_sim_id != null;
      if (ferramenta === 'comparador') return link.comparador_comp_id != null;
      return false;
    });
  }

  function getBadgesForItem(ferramenta, identifiers) {
    return state.deletedBadges.filter(function(b) {
      if (b.acknowledged) return false;
      if (b.deleted_from === ferramenta) return false;
      var link = state.links.find(function(l) { return l.id === b.link_id; });
      if (!link) return false;
      if (ferramenta === 'direitos') {
        return link.direitos_visao_id === identifiers.visaoId && link.direitos_produto_id === identifiers.produtoId;
      }
      if (ferramenta === 'fluxo') {
        return link.fluxo_sim_id === identifiers.simId && link.fluxo_item_id === identifiers.itemId;
      }
      if (ferramenta === 'comparador') {
        return link.comparador_comp_id === identifiers.compId && link.comparador_product_id === identifiers.productId;
      }
      return false;
    });
  }

  function acknowledgeBadge(badgeId, action) {
    var badge = state.deletedBadges.find(function(b) { return b.id === badgeId; });
    if (!badge) return null;
    badge.acknowledged = true;

    if (action === 'keep') {
      // Desassociar: limpar referência no link (não exclui o link inteiro)
      var link = state.links.find(function(l) { return l.id === badge.link_id; });
      if (link) {
        if (badge.deleted_from === 'direitos') {
          link.direitos_visao_id = null;
          link.direitos_produto_id = null;
        } else if (badge.deleted_from === 'fluxo') {
          link.fluxo_sim_id = null;
          link.fluxo_item_id = null;
          link.fluxo_item_nome = null;
        } else if (badge.deleted_from === 'comparador') {
          link.comparador_comp_id = null;
          link.comparador_product_id = null;
        }
        // Se o link ficou sem nenhuma referência, remove
        if (!link.direitos_produto_id && !link.fluxo_sim_id && !link.comparador_comp_id) {
          removeLink(link.id);
        }
      }
    }
    // Se action === 'delete', a ferramenta local deve tratar a exclusão do item
    save();
    return badge;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  NOTIFICAÇÃO DE IMPACTO (antes de alterações)
  // ═══════════════════════════════════════════════════════════════════════
  function getImpactMessage(linkId, originFerramenta, changes) {
    var link = state.links.find(function(l) { return l.id === linkId; });
    if (!link) return '';

    var targets = [];
    if (link.direitos_produto_id && originFerramenta !== 'direitos') targets.push('Produtos e Direitos');
    if (link.fluxo_sim_id && originFerramenta !== 'fluxo') targets.push('Fluxo de Caixa');
    if (link.comparador_comp_id && originFerramenta !== 'comparador') targets.push('Comparador de Produtos');

    if (targets.length === 0) return '';

    var changeDescs = [];
    if (changes && changes.label !== undefined) changeDescs.push('Nome: "' + link.label + '" → "' + changes.label + '"');
    if (changes && changes.valor !== undefined) changeDescs.push('Valor: R$ ' + formatCurrency(link.valor) + ' → R$ ' + formatCurrency(changes.valor));
    if (changes && changes.periodicidade !== undefined) changeDescs.push('Periodicidade: ' + link.periodicidade + ' → ' + changes.periodicidade);
    if (changes && changes.direitos_params !== undefined) changeDescs.push('Parâmetros/Direitos atualizados');

    var msg = 'Esta alteração irá impactar o item associado em:\n• ' + targets.join('\n• ');
    if (changeDescs.length > 0) {
      msg += '\n\nAlterações:\n• ' + changeDescs.join('\n• ');
    }
    msg += '\n\nDeseja continuar?';
    return msg;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PROPAGAÇÃO DE ALTERAÇÕES
  // ═══════════════════════════════════════════════════════════════════════
  var _updateHandlers = {};

  function registerUpdateHandler(ferramenta, handler) {
    _updateHandlers[ferramenta] = handler;
  }

  function propagateChanges(linkId, originFerramenta, changes) {
    var link = state.links.find(function(l) { return l.id === linkId; });
    if (!link) return;

    // Atualizar o link
    Object.keys(changes).forEach(function(k) {
      link[k] = changes[k];
    });
    link.updated_at = new Date().toISOString();
    save();

    // Notificar handlers (se estiverem na mesma página)
    Object.keys(_updateHandlers).forEach(function(ferramenta) {
      if (ferramenta !== originFerramenta) {
        try {
          _updateHandlers[ferramenta](linkId, link, changes);
        } catch(e) { console.warn('[Linkage] Handler error for', ferramenta, e); }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UTILITÁRIOS DE RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════
  function formatCurrency(val) {
    var n = parseFloat(val) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderBadgeHtml(badge) {
    var ferramentaLabel = badge.deleted_from === 'direitos' ? 'Produtos e Direitos' :
                         badge.deleted_from === 'fluxo' ? 'Fluxo de Caixa' :
                         badge.deleted_from === 'comparador' ? 'Comparador de Produtos' : badge.deleted_from;
    return '<span class="linkage-badge-deleted" data-badge-id="' + badge.id + '" ' +
           'title="Item excluído em: ' + ferramentaLabel + '" ' +
           'onclick="FerramentasLinkage.handleBadgeClick(' + badge.id + ')" ' +
           'style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;padding:2px 8px;border-radius:4px;font-size:0.7rem;cursor:pointer;margin-left:6px;">' +
           '⚠ Excluído em ' + ferramentaLabel +
           '</span>';
  }

  function renderLinkIndicatorHtml(link, currentFerramenta) {
    var targets = [];
    if (link.fluxo_sim_id && currentFerramenta !== 'fluxo') targets.push('Fluxo');
    if (link.comparador_comp_id && currentFerramenta !== 'comparador') targets.push('Comparador');
    if (link.direitos_produto_id && currentFerramenta !== 'direitos') targets.push('Direitos');
    if (targets.length === 0) return '';
    return '<span class="linkage-indicator" ' +
           'style="display:inline-flex;align-items:center;gap:3px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.3);color:#60a5fa;padding:2px 7px;border-radius:4px;font-size:0.68rem;margin-left:5px;" ' +
           'title="Associado a: ' + targets.join(', ') + '">' +
           '🔗 ' + targets.join(', ') +
           '</span>';
  }

  function handleBadgeClick(badgeId) {
    var badge = state.deletedBadges.find(function(b) { return b.id === badgeId; });
    if (!badge) return;

    var ferramentaLabel = badge.deleted_from === 'direitos' ? 'Produtos e Direitos' :
                         badge.deleted_from === 'fluxo' ? 'Fluxo de Caixa' :
                         badge.deleted_from === 'comparador' ? 'Comparador de Produtos' : badge.deleted_from;

    var msg = 'O item "' + badge.item_label + '" foi excluído na ferramenta "' + ferramentaLabel + '" em ' +
              new Date(badge.deleted_at).toLocaleDateString('pt-BR') + '.\n\n' +
              'O que deseja fazer?\n' +
              '• OK = Excluir este item também\n' +
              '• Cancelar = Manter sem associação';

    if (confirm(msg)) {
      acknowledgeBadge(badgeId, 'delete');
      document.dispatchEvent(new CustomEvent('linkage-delete-confirmed', { detail: { badge: badge } }));
    } else {
      acknowledgeBadge(badgeId, 'keep');
      document.dispatchEvent(new CustomEvent('linkage-keep-confirmed', { detail: { badge: badge } }));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════
  global.FerramentasLinkage = {
    load: load,
    save: save,
    state: state,
    createLink: createLink,
    updateLink: updateLink,
    removeLink: removeLink,
    findLinks: findLinks,
    getLinksForDireitoProduto: getLinksForDireitoProduto,
    getLinksForFluxoItem: getLinksForFluxoItem,
    getLinksForComparadorProduct: getLinksForComparadorProduct,
    getAllLinksForFluxo: getAllLinksForFluxo,
    getAllLinksForComparador: getAllLinksForComparador,
    getAllLinksForDireitos: getAllLinksForDireitos,
    registerDeletion: registerDeletion,
    getPendingBadges: getPendingBadges,
    getBadgesForItem: getBadgesForItem,
    acknowledgeBadge: acknowledgeBadge,
    getImpactMessage: getImpactMessage,
    registerUpdateHandler: registerUpdateHandler,
    propagateChanges: propagateChanges,
    renderBadgeHtml: renderBadgeHtml,
    renderLinkIndicatorHtml: renderLinkIndicatorHtml,
    handleBadgeClick: handleBadgeClick,
    formatCurrency: formatCurrency,
    genId: genId
  };

})(window);
