// ═══════════════════════════════════════════════════════════════════════════
//  FERRAMENTAS LINKAGE ENGINE v4.0
//  Módulo compartilhado de associação/sincronização entre ferramentas:
//  - Direitos (produtos + direitos)
//  - Fluxo de Caixa (itens)
//  - Comparador de Produtos (produtos + parâmetros obj/subj)
//
//  Persistência: ferramentas_dados com ferramenta = 'linkage'
//  Estrutura: { links: [...], deletedBadges: [...] }
//
//  ESCRITA CRUZADA DIRETA: propagateChanges escreve diretamente no
//  localStorage e Supabase da outra ferramenta (não depende de handlers)
//
//  Uso: <script src="../assets/ferramentas-linkage.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  var LINKAGE_FERRAMENTA = 'linkage';
  var LINKAGE_LS_KEY = 'hv_linkage_local';
  var _linkSbClient = null;
  var _linkSaveTimer = null;

  // Chaves de localStorage das ferramentas
  var FLUXO_LS_KEY = 'fluxo_simulacoes_v2';
  var DIREITOS_LS_KEY = 'hv_direitos_local';
  var COMPARADOR_LS_KEY = 'hvsf_comparacoes';

  // Supabase config (mesma para todas as ferramentas)
  var _SB_URL = 'https://vbikskbfkhundhropykf.supabase.co';
  var _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU';

  // ═══════════════════════════════════════════════════════════════════════
  //  ESTADO
  // ═══════════════════════════════════════════════════════════════════════
  var state = {
    links: [],
    deletedBadges: []
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  SUPABASE CLIENT
  // ═══════════════════════════════════════════════════════════════════════
  function _initSb() {
    if (_linkSbClient) return _linkSbClient;
    if (global.mithraSupabaseClient) { _linkSbClient = global.mithraSupabaseClient; return _linkSbClient; }
    if (global.sb) { _linkSbClient = global.sb; return _linkSbClient; }
    if (global.supabase && global.supabase.createClient) {
      _linkSbClient = global.supabase.createClient(_SB_URL, _SB_KEY);
      return _linkSbClient;
    }
    return null;
  }

  function _getClienteId() {
    return sessionStorage.getItem('cliente_id') || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PERSISTÊNCIA DO LINKAGE
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
      } catch(e) { state.links = []; state.deletedBadges = []; }
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
  //  LEITURA/ESCRITA DIRETA NAS OUTRAS FERRAMENTAS
  // ═══════════════════════════════════════════════════════════════════════

  function _getFluxoLsKey() {
    var cid = _getClienteId();
    return cid ? FLUXO_LS_KEY + '_' + cid : FLUXO_LS_KEY;
  }
  function _getDireitosLsKey() {
    var cid = _getClienteId();
    return cid ? DIREITOS_LS_KEY + '_' + cid : DIREITOS_LS_KEY;
  }
  function _getComparadorLsKey() {
    var cid = _getClienteId();
    return cid ? COMPARADOR_LS_KEY + '_' + cid : COMPARADOR_LS_KEY;
  }

  function _readFluxoData() {
    try {
      var raw = localStorage.getItem(_getFluxoLsKey());
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function _writeFluxoData(simulacoes) {
    try { localStorage.setItem(_getFluxoLsKey(), JSON.stringify(simulacoes)); } catch(e) {}
    _writeFluxoToSupabase(simulacoes);
  }
  function _writeFluxoToSupabase(simulacoes) {
    var cid = _getClienteId();
    var sb = _initSb();
    if (!sb || !cid) return;
    sb.from('ferramentas_dados').upsert({
      cliente_id: cid, ferramenta: 'fluxo',
      dados: simulacoes, updated_at: new Date().toISOString()
    }, { onConflict: 'cliente_id,ferramenta' }).then(function(){}).catch(function(e) {
      console.warn('[Linkage] Erro ao salvar fluxo:', e);
    });
  }

  function _readDireitosData() {
    try {
      var raw = localStorage.getItem(_getDireitosLsKey());
      if (!raw) return { visoes: [] };
      var d = JSON.parse(raw);
      return d.visoes ? d : { visoes: [] };
    } catch(e) { return { visoes: [] }; }
  }
  function _writeDireitosData(data) {
    try { localStorage.setItem(_getDireitosLsKey(), JSON.stringify(data)); } catch(e) {}
    _writeDireitosToSupabase(data);
  }
  function _writeDireitosToSupabase(data) {
    var cid = _getClienteId();
    var sb = _initSb();
    if (!sb || !cid) return;
    sb.from('ferramentas_dados').upsert({
      cliente_id: cid, ferramenta: 'direitos',
      dados: data, updated_at: new Date().toISOString()
    }, { onConflict: 'cliente_id,ferramenta' }).then(function(){}).catch(function(e) {
      console.warn('[Linkage] Erro ao salvar direitos:', e);
    });
  }

  function _readComparadorData() {
    try {
      var raw = localStorage.getItem(_getComparadorLsKey());
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function _writeComparadorData(comparisons) {
    try { localStorage.setItem(_getComparadorLsKey(), JSON.stringify(comparisons)); } catch(e) {}
    _writeComparadorToSupabase(comparisons);
  }
  function _writeComparadorToSupabase(comparisons) {
    var cid = _getClienteId();
    var sb = _initSb();
    if (!sb || !cid) return;
    sb.from('ferramentas_dados').upsert({
      cliente_id: cid, ferramenta: 'comparador',
      dados: comparisons, updated_at: new Date().toISOString()
    }, { onConflict: 'cliente_id,ferramenta' }).then(function(){}).catch(function(e) {
      console.warn('[Linkage] Erro ao salvar comparador:', e);
    });
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

    // Ao criar link, aplicar nome/valor unificados nas ferramentas de destino
    if (link.fluxo_sim_id && link.fluxo_item_id) {
      _applyToFluxoItem(link);
    }
    if (link.comparador_comp_id && link.comparador_product_id) {
      _applyToComparadorProduct(link);
    }
    if (link.direitos_visao_id && link.direitos_produto_id) {
      _applyToDireitoProduto(link);
    }

    return link;
  }

  function updateLink(linkId, fields) {
    var link = state.links.find(function(l) { return l.id === linkId; });
    if (!link) return null;
    Object.keys(fields).forEach(function(k) { link[k] = fields[k]; });
    link.updated_at = new Date().toISOString();
    save();

    // Aplicar alterações diretamente nas ferramentas de destino
    if (link.fluxo_sim_id && link.fluxo_item_id) {
      _applyToFluxoItem(link);
    }
    if (link.direitos_visao_id && link.direitos_produto_id) {
      _applyToDireitoProduto(link);
    }
    if (link.comparador_comp_id && link.comparador_product_id) {
      _applyToComparadorProduct(link);
    }
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
  //  APLICAÇÃO DIRETA NAS FERRAMENTAS (escrita cruzada)
  // ═══════════════════════════════════════════════════════════════════════

  function _applyToFluxoItem(link) {
    if (!link.fluxo_sim_id || !link.fluxo_item_id) return;
    var simulacoes = _readFluxoData();
    var sim = simulacoes.find(function(s) { return s.id === link.fluxo_sim_id; });
    if (!sim || !sim.payload || !sim.payload.itens) return;
    var item = sim.payload.itens.find(function(it) { return it._linkId === link.fluxo_item_id; });
    if (!item) return;
    var changed = false;
    if (link.label && item.nome !== link.label) { item.nome = link.label; changed = true; }
    if (link.valor !== undefined && link.valor !== null && item.valor !== link.valor) { item.valor = link.valor; changed = true; }
    if (changed) _writeFluxoData(simulacoes);
  }

  function _applyToDireitoProduto(link) {
    if (!link.direitos_visao_id || !link.direitos_produto_id) return;
    var data = _readDireitosData();
    var visao = (data.visoes || []).find(function(v) { return v.id === link.direitos_visao_id; });
    if (!visao || !visao.produtos) return;
    var produto = visao.produtos.find(function(p) { return p.id === link.direitos_produto_id; });
    if (!produto) return;
    var changed = false;
    if (link.label && produto.nome !== link.label) { produto.nome = link.label; changed = true; }
    if (link.valor !== undefined && link.valor !== null) {
      var custoStr = typeof link.valor === 'number' ? link.valor.toLocaleString('pt-BR', {minimumFractionDigits:2}) : String(link.valor);
      if (produto.custo !== custoStr) { produto.custo = custoStr; changed = true; }
    }
    if (link.periodicidade && produto.periodicidade !== link.periodicidade) { produto.periodicidade = link.periodicidade; changed = true; }
    if (changed) _writeDireitosData(data);
  }

  function _applyToComparadorProduct(link) {
    if (!link.comparador_comp_id || !link.comparador_product_id) return;
    var comparisons = _readComparadorData();
    var comp = comparisons.find(function(c) { return c.id === link.comparador_comp_id; });
    if (!comp || !comp.products) return;
    var product = comp.products.find(function(p) { return p.id === link.comparador_product_id; });
    if (!product) return;
    var changed = false;
    if (link.label && product.name !== link.label) { product.name = link.label; changed = true; }
    if (link.valor !== undefined && link.valor !== null && product.price !== link.valor) { product.price = link.valor; changed = true; }
    // Atualizar parâmetros se houver direitos_params
    if (link.direitos_params && link.direitos_params.length > 0 && comp.objParams) {
      link.direitos_params.forEach(function(dp) {
        if (dp.valor) {
          var existing = comp.objParams.find(function(op) { return op.name === dp.nome; });
          if (existing) {
            // Atualizar valor no produto
            if (product.objValues && product.objValues[existing.id] !== dp.valor) {
              product.objValues[existing.id] = dp.valor;
              changed = true;
            }
          }
        }
      });
    }
    if (changed) _writeComparadorData(comparisons);
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
        if (!link.direitos_produto_id && !link.fluxo_sim_id && !link.comparador_comp_id) {
          removeLink(link.id);
        }
      }
    }
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
  //  PROPAGAÇÃO DE ALTERAÇÕES (ESCRITA CRUZADA DIRETA)
  // ═══════════════════════════════════════════════════════════════════════
  var _updateHandlers = {};

  function registerUpdateHandler(ferramenta, handler) {
    _updateHandlers[ferramenta] = handler;
  }

  function propagateChanges(linkId, originFerramenta, changes) {
    var link = state.links.find(function(l) { return l.id === linkId; });
    if (!link) return;

    // Atualizar o link com as novas informações
    Object.keys(changes).forEach(function(k) {
      link[k] = changes[k];
    });
    link.updated_at = new Date().toISOString();
    save();

    // ESCRITA CRUZADA DIRETA: atualizar os dados nas outras ferramentas
    if (originFerramenta !== 'fluxo' && link.fluxo_sim_id && link.fluxo_item_id) {
      _applyToFluxoItem(link);
    }
    if (originFerramenta !== 'direitos' && link.direitos_visao_id && link.direitos_produto_id) {
      _applyToDireitoProduto(link);
    }
    if (originFerramenta !== 'comparador' && link.comparador_comp_id && link.comparador_product_id) {
      _applyToComparadorProduct(link);
    }

    // Também notificar handlers em memória (caso a outra ferramenta esteja aberta na mesma página)
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
