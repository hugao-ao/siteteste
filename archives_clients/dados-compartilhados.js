/**
 * dados-compartilhados.js
 * Módulo de sincronização de dados entre ferramentas HV Saúde Financeira.
 * 
 * Uso: incluir <script src="../assets/dados-compartilhados.js"></script> em cada ferramenta.
 * 
 * API:
 *   DadosCompartilhados.init(ferramentaAtual)  — inicializa para a ferramenta corrente
 *   DadosCompartilhados.get(conceito)           — retorna valor local do conceito
 *   DadosCompartilhados.set(conceito, valor)    — atualiza valor e pergunta se quer propagar
 *   DadosCompartilhados.pull(conceito)          — abre modal para puxar valor de outra ferramenta
 *   DadosCompartilhados.attachInput(inputEl, conceito) — vincula um input a um conceito compartilhado
 */
;(function() {
  'use strict';

  /* ============================================================
     1. MAPA DE CONCEITOS COMPARTILHADOS
     Cada conceito mapeia para: { label, ferramentas: { slug: { dataPath, inputId } } }
     - dataPath: caminho no JSON salvo no Supabase (dados.xxx.yyy)
     - inputId: ID do elemento HTML na ferramenta (para preencher)
     ============================================================ */
  var CONCEITOS = {
    inflacao: {
      label: 'Inflação (% a.a.)',
      tipo: 'percentual',
      ferramentas: {
        acumulo:   { dataPath: 'reajusteGlobal', inputId: 'reajuste-global', isSimList: true },
        simulador: { dataPath: 'params.inflacao', inputId: 'p_inflacao', isSimList: true },
        oraculo:   { dataPath: 'params.inflationRate', inputId: 'inflationRateAnnual', isSimList: true }
      }
    },
    taxa_juros: {
      label: 'Taxa de Juros / Rentabilidade (% a.a.)',
      tipo: 'percentual',
      ferramentas: {
        simulador: { dataPath: 'params.juros', inputId: 'p_juros', isSimList: true },
        oraculo:   { dataPath: 'params.interestRate', inputId: 'interestRateAnnual', isSimList: true }
      }
    },
    patrimonio_liquido: {
      label: 'Patrimônio Líquido (R$)',
      tipo: 'moeda',
      ferramentas: {
        simulador:       { dataPath: 'params.saldo', inputId: 'p_saldo', isSimList: true },
        oraculo:         { dataPath: 'params.currentWealth', inputId: 'currentWealth', isSimList: true },
        acompanhamento:  { dataPath: 'reunioes[-1].patrimonio', inputId: 'rn_patrimonio', isReuniao: true }
      }
    },
    aporte_mensal: {
      label: 'Aporte / Poupança Mensal (R$)',
      tipo: 'moeda',
      ferramentas: {
        oraculo:         { dataPath: 'params.monthlyContribution', inputId: 'monthlyContribution', isSimList: true },
        acompanhamento:  { dataPath: 'reunioes[-1].investimentos', inputId: 'rn_investimentos', isReuniao: true }
      }
    },
    renda_mensal: {
      label: 'Renda Mensal (R$)',
      tipo: 'moeda',
      ferramentas: {
        ir:              { dataPath: 'rendaMensal', inputId: 'renda-mensal', isSimList: true },
        acompanhamento:  { dataPath: 'reunioes[-1].renda', inputId: 'rn_renda', isReuniao: true }
      }
    },
    despesas_mensais: {
      label: 'Despesas Mensais (R$)',
      tipo: 'moeda',
      ferramentas: {
        acompanhamento:  { dataPath: 'reunioes[-1].despesas', inputId: 'rn_despesas', isReuniao: true }
      }
    },
    dividas_total: {
      label: 'Dívidas Totais (R$)',
      tipo: 'moeda',
      ferramentas: {
        acompanhamento:  { dataPath: 'reunioes[-1].dividas', inputId: 'rn_dividas', isReuniao: true }
      }
    },
    ir_aliquota: {
      label: 'IR sobre Rendimentos (%)',
      tipo: 'percentual',
      ferramentas: {
        simulador: { dataPath: 'params.ir', inputId: 'p_ir', isSimList: true },
        oraculo:   { dataPath: 'params.taxRate', inputId: 'taxRate', isSimList: true }
      }
    },
    data_inicio: {
      label: 'Data de Início',
      tipo: 'data',
      ferramentas: {
        simulador: { dataPath: 'params.dataInicio', inputId: 'p_data_inicio', isSimList: true },
        oraculo:   { dataPath: 'params.startDate', inputId: 'startDate', isSimList: true }
      }
    },
    valor_bem: {
      label: 'Valor do Bem (R$)',
      tipo: 'moeda',
      ferramentas: {
        simulador: { dataPath: 'params.bemValor', inputId: 'p_bem_valor', isSimList: true }
      }
    }
  };

  /* ============================================================
     2. ESTADO INTERNO
     ============================================================ */
  var _ferramentaAtual = null;
  var _clienteId = null;
  var _sbClient = null;
  var _cache = {}; // { ferramenta: dados }
  var _modalEl = null;
  var _initialized = false;

  /* ============================================================
     3. UTILIDADES
     ============================================================ */
  function _getClienteId() {
    return sessionStorage.getItem('cliente_id') || null;
  }

  function _getSbClient() {
    if (window.supabase && window._supabaseUrl && window._supabaseKey) {
      return window.supabase.createClient(window._supabaseUrl, window._supabaseKey);
    }
    // Try to find existing client
    if (window.sb) return window.sb;
    if (window._dirSbClient) return window._dirSbClient;
    return null;
  }

  function _resolveDataPath(dados, path) {
    if (!dados || !path) return undefined;
    var parts = path.split('.');
    var current = dados;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      // Handle [-1] for last element of array
      var arrMatch = p.match(/^(.+)\[(-?\d+)\]$/);
      if (arrMatch) {
        current = current[arrMatch[1]];
        if (!Array.isArray(current) || current.length === 0) return undefined;
        var idx = parseInt(arrMatch[2]);
        if (idx < 0) idx = current.length + idx;
        current = current[idx];
      } else {
        if (current === null || current === undefined) return undefined;
        current = current[p];
      }
      if (current === undefined) return undefined;
    }
    return current;
  }

  function _fmtValor(valor, tipo) {
    if (valor === undefined || valor === null || valor === '') return 'N/A';
    if (tipo === 'moeda') {
      var n = typeof valor === 'string' ? parseFloat(valor.replace(/\./g,'').replace(',','.')) : valor;
      if (isNaN(n)) return valor;
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (tipo === 'percentual') return valor + '%';
    return String(valor);
  }

  var FERRAMENTA_NOMES = {
    fluxo: 'Fluxo de Caixa',
    direitos: 'Produtos e Direitos',
    comparador: 'Comparador de Produto',
    cartoes: 'Comparador de Cartões',
    patrimonio: 'Patrimônio do Cliente',
    ir: 'Imposto de Renda',
    acumulo: 'Simulador de Acúmulo',
    simulador: 'Simulador Imobiliário',
    oraculo: 'Oráculo',
    acompanhamento: 'Acompanhamento'
  };

  /* ============================================================
     4. CARREGAR DADOS DE OUTRAS FERRAMENTAS
     ============================================================ */
  async function _loadFerramentaData(ferramenta) {
    if (_cache[ferramenta]) return _cache[ferramenta];
    var clienteId = _getClienteId();
    var sb = _getSbClient();
    if (!sb || !clienteId) return null;
    try {
      var result = await sb.from('ferramentas_dados').select('dados').eq('cliente_id', clienteId).eq('ferramenta', ferramenta).maybeSingle();
      if (result.data && result.data.dados) {
        _cache[ferramenta] = result.data.dados;
        return result.data.dados;
      }
    } catch(e) { console.warn('DadosCompartilhados: erro ao carregar ' + ferramenta, e); }
    return null;
  }

  async function _getValorFromFerramenta(conceito, ferramenta) {
    var config = CONCEITOS[conceito];
    if (!config || !config.ferramentas[ferramenta]) return undefined;
    var fConfig = config.ferramentas[ferramenta];
    var dados = await _loadFerramentaData(ferramenta);
    if (!dados) return undefined;

    // For tools with simulation lists (simulacoes array), get from the active/last simulation
    if (fConfig.isSimList) {
      if (Array.isArray(dados.simulacoes) && dados.simulacoes.length > 0) {
        // Try to get from the last simulation
        var sim = dados.simulacoes[dados.simulacoes.length - 1];
        var val = _resolveDataPath(sim, fConfig.dataPath);
        if (val !== undefined) return { valor: val, fonte: sim.nome || 'Simulação ' + dados.simulacoes.length };
        // If not found in sim, try root level (some tools store params at root)
      }
      // Try root level
      var val2 = _resolveDataPath(dados, fConfig.dataPath);
      if (val2 !== undefined) return { valor: val2, fonte: 'Dados gerais' };
    }

    if (fConfig.isReuniao) {
      if (Array.isArray(dados.reunioes) && dados.reunioes.length > 0) {
        var reuniao = dados.reunioes[0]; // sorted desc, first is most recent
        var val3 = _resolveDataPath(reuniao, fConfig.dataPath.split('[-1].')[1]);
        if (val3 !== undefined) return { valor: val3, fonte: 'Reunião ' + (reuniao.data || '') };
      }
    }

    // Direct path
    var val4 = _resolveDataPath(dados, fConfig.dataPath);
    if (val4 !== undefined) return { valor: val4, fonte: 'Dados gerais' };

    return undefined;
  }

  /* ============================================================
     5. SALVAR VALOR EM OUTRAS FERRAMENTAS
     ============================================================ */
  async function _setValorInFerramenta(conceito, ferramenta, novoValor) {
    var config = CONCEITOS[conceito];
    if (!config || !config.ferramentas[ferramenta]) return false;
    var fConfig = config.ferramentas[ferramenta];
    var clienteId = _getClienteId();
    var sb = _getSbClient();
    if (!sb || !clienteId) return false;

    try {
      var result = await sb.from('ferramentas_dados').select('dados').eq('cliente_id', clienteId).eq('ferramenta', ferramenta).maybeSingle();
      if (!result.data || !result.data.dados) return false;
      var dados = result.data.dados;

      // For sim-list tools, update ALL simulations
      if (fConfig.isSimList && Array.isArray(dados.simulacoes)) {
        dados.simulacoes.forEach(function(sim) {
          _setNestedValue(sim, fConfig.dataPath, novoValor);
        });
      } else if (fConfig.isReuniao) {
        // Don't auto-update reunioes - they are historical records
        return false;
      } else {
        _setNestedValue(dados, fConfig.dataPath, novoValor);
      }

      // Save back
      await sb.from('ferramentas_dados').upsert({
        cliente_id: clienteId,
        ferramenta: ferramenta,
        dados: dados,
        updated_at: new Date().toISOString()
      }, { onConflict: 'cliente_id,ferramenta' });

      // Invalidate cache
      delete _cache[ferramenta];
      return true;
    } catch(e) {
      console.warn('DadosCompartilhados: erro ao salvar em ' + ferramenta, e);
      return false;
    }
  }

  function _setNestedValue(obj, path, value) {
    var parts = path.split('.');
    var current = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  /* ============================================================
     6. MODAL UI
     ============================================================ */
  function _createModal() {
    if (_modalEl) return;
    var overlay = document.createElement('div');
    overlay.id = 'dc-modal-overlay';
    overlay.innerHTML = '<div id="dc-modal-box"><div id="dc-modal-header"></div><div id="dc-modal-body"></div><div id="dc-modal-footer"></div></div>';
    document.body.appendChild(overlay);
    _modalEl = overlay;

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _closeModal();
    });

    // Inject CSS
    var style = document.createElement('style');
    style.textContent = '\
#dc-modal-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; justify-content:center; align-items:center; }\
#dc-modal-overlay.dc-open { display:flex; }\
#dc-modal-box { background:#1a1a2e; border:2px solid #d4af37; border-radius:12px; max-width:560px; width:90%; max-height:80vh; overflow-y:auto; padding:0; }\
#dc-modal-header { padding:16px 20px; border-bottom:1px solid rgba(212,175,55,0.3); }\
#dc-modal-header h3 { margin:0; color:#d4af37; font-size:16px; }\
#dc-modal-header p { margin:4px 0 0; color:#999; font-size:12px; }\
#dc-modal-body { padding:16px 20px; }\
#dc-modal-footer { padding:12px 20px; border-top:1px solid rgba(212,175,55,0.3); display:flex; gap:8px; justify-content:flex-end; }\
.dc-option { background:#0f3460; border:1px solid rgba(212,175,55,0.3); border-radius:8px; padding:12px; margin-bottom:8px; cursor:pointer; transition:all 0.2s; }\
.dc-option:hover { border-color:#d4af37; background:#16213e; }\
.dc-option.dc-selected { border-color:#d4af37; background:rgba(212,175,55,0.15); }\
.dc-option-header { display:flex; justify-content:space-between; align-items:center; }\
.dc-option-tool { color:#d4af37; font-weight:600; font-size:13px; }\
.dc-option-source { color:#888; font-size:11px; }\
.dc-option-value { color:#4ECDC4; font-size:15px; font-weight:700; margin-top:4px; }\
.dc-btn { padding:8px 16px; border-radius:6px; border:none; cursor:pointer; font-size:13px; font-weight:600; }\
.dc-btn-primary { background:#d4af37; color:#1a1a2e; }\
.dc-btn-primary:hover { background:#e5c349; }\
.dc-btn-secondary { background:transparent; color:#999; border:1px solid #555; }\
.dc-btn-secondary:hover { color:#fff; border-color:#999; }\
.dc-btn-primary:disabled { opacity:0.5; cursor:not-allowed; }\
.dc-check-list { list-style:none; padding:0; margin:8px 0; }\
.dc-check-list li { padding:6px 0; display:flex; align-items:center; gap:8px; color:#ccc; font-size:13px; }\
.dc-check-list input[type=checkbox] { accent-color:#d4af37; width:16px; height:16px; }\
.dc-info { color:#888; font-size:12px; font-style:italic; padding:8px 0; }\
.dc-sync-icon { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.4); cursor:pointer; font-size:11px; color:#d4af37; margin-left:6px; vertical-align:middle; transition:all 0.2s; position:relative; }\
.dc-sync-icon:hover { background:rgba(212,175,55,0.3); }\
.dc-sync-icon[title]:hover::after { content:attr(title); position:absolute; bottom:110%; left:50%; transform:translateX(-50%); background:#1a1a2e; border:1px solid #d4af37; color:#d4af37; padding:4px 8px; border-radius:4px; font-size:10px; white-space:nowrap; z-index:100000; }\
.dc-result-ok { color:#4ECDC4; font-size:12px; }\
.dc-result-err { color:#FF6B6B; font-size:12px; }\
';
    document.head.appendChild(style);
  }

  function _openModal() {
    _createModal();
    _modalEl.classList.add('dc-open');
  }

  function _closeModal() {
    if (_modalEl) _modalEl.classList.remove('dc-open');
  }

  function _setModalContent(headerHtml, bodyHtml, footerHtml) {
    _createModal();
    document.getElementById('dc-modal-header').innerHTML = headerHtml;
    document.getElementById('dc-modal-body').innerHTML = bodyHtml;
    document.getElementById('dc-modal-footer').innerHTML = footerHtml;
  }

  /* ============================================================
     7. PULL — Puxar valor de outra ferramenta
     ============================================================ */
  async function pull(conceito) {
    var config = CONCEITOS[conceito];
    if (!config) { console.warn('DadosCompartilhados: conceito desconhecido: ' + conceito); return; }

    _setModalContent(
      '<h3>Puxar: ' + config.label + '</h3><p>Buscando valores em outras ferramentas...</p>',
      '<div class="dc-info">Carregando...</div>',
      '<button class="dc-btn dc-btn-secondary" onclick="DadosCompartilhados._closeModal()">Cancelar</button>'
    );
    _openModal();

    // Load values from all other ferramentas that have this concept
    var options = [];
    var ferramentas = Object.keys(config.ferramentas);
    for (var i = 0; i < ferramentas.length; i++) {
      var f = ferramentas[i];
      if (f === _ferramentaAtual) continue;
      var resultado = await _getValorFromFerramenta(conceito, f);
      if (resultado && resultado.valor !== undefined && resultado.valor !== '' && resultado.valor !== null) {
        options.push({ ferramenta: f, valor: resultado.valor, fonte: resultado.fonte });
      }
    }

    if (options.length === 0) {
      document.getElementById('dc-modal-body').innerHTML = '<div class="dc-info">Nenhuma outra ferramenta possui esse dado preenchido para este cliente.</div>';
      return;
    }

    var bodyHtml = '<p style="color:#ccc;font-size:13px;margin:0 0 12px;">Selecione de onde deseja puxar o valor:</p>';
    options.forEach(function(opt, idx) {
      bodyHtml += '<div class="dc-option" data-idx="' + idx + '" onclick="DadosCompartilhados._selectPullOption(' + idx + ')">';
      bodyHtml += '<div class="dc-option-header"><span class="dc-option-tool">' + (FERRAMENTA_NOMES[opt.ferramenta] || opt.ferramenta) + '</span>';
      bodyHtml += '<span class="dc-option-source">' + opt.fonte + '</span></div>';
      bodyHtml += '<div class="dc-option-value">' + _fmtValor(opt.valor, config.tipo) + '</div>';
      bodyHtml += '</div>';
    });

    var footerHtml = '<button class="dc-btn dc-btn-secondary" onclick="DadosCompartilhados._closeModal()">Cancelar</button>';
    footerHtml += '<button class="dc-btn dc-btn-primary" id="dc-pull-confirm" disabled onclick="DadosCompartilhados._confirmPull()">Usar este valor</button>';

    _setModalContent(
      '<h3>Puxar: ' + config.label + '</h3><p>Valores encontrados em outras ferramentas</p>',
      bodyHtml, footerHtml
    );

    // Store state for confirm
    window._dcPullState = { conceito: conceito, options: options, selectedIdx: -1 };
  }

  function _selectPullOption(idx) {
    document.querySelectorAll('#dc-modal-body .dc-option').forEach(function(el, i) {
      el.classList.toggle('dc-selected', i === idx);
    });
    window._dcPullState.selectedIdx = idx;
    document.getElementById('dc-pull-confirm').disabled = false;
  }

  function _confirmPull() {
    var state = window._dcPullState;
    if (!state || state.selectedIdx < 0) return;
    var opt = state.options[state.selectedIdx];
    var config = CONCEITOS[state.conceito];
    var localConfig = config.ferramentas[_ferramentaAtual];

    if (localConfig && localConfig.inputId) {
      var input = document.getElementById(localConfig.inputId);
      if (input) {
        input.value = opt.valor;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    _closeModal();
  }

  /* ============================================================
     8. PROPAGATE — Propagar alteração para outras ferramentas
     ============================================================ */
  async function propagate(conceito, novoValor) {
    var config = CONCEITOS[conceito];
    if (!config) return;

    var outrasFerramentas = Object.keys(config.ferramentas).filter(function(f) {
      return f !== _ferramentaAtual && !config.ferramentas[f].isReuniao;
    });

    if (outrasFerramentas.length === 0) return;

    var bodyHtml = '<p style="color:#ccc;font-size:13px;margin:0 0 8px;">Novo valor: <strong style="color:#4ECDC4;">' + _fmtValor(novoValor, config.tipo) + '</strong></p>';
    bodyHtml += '<p style="color:#ccc;font-size:13px;margin:0 0 12px;">Deseja atualizar esse valor nas outras ferramentas também?</p>';
    bodyHtml += '<ul class="dc-check-list">';
    outrasFerramentas.forEach(function(f, idx) {
      bodyHtml += '<li><input type="checkbox" id="dc-prop-' + idx + '" checked data-ferramenta="' + f + '"> ' + (FERRAMENTA_NOMES[f] || f) + ' <span style="color:#666;font-size:11px;">(todas as simulações)</span></li>';
    });
    bodyHtml += '</ul>';

    var footerHtml = '<button class="dc-btn dc-btn-secondary" onclick="DadosCompartilhados._closeModal()">Não propagar</button>';
    footerHtml += '<button class="dc-btn dc-btn-primary" onclick="DadosCompartilhados._confirmPropagate()">Atualizar selecionadas</button>';

    _setModalContent(
      '<h3>Propagar: ' + config.label + '</h3><p>Alterar em outras ferramentas?</p>',
      bodyHtml, footerHtml
    );
    _openModal();

    window._dcPropState = { conceito: conceito, valor: novoValor, ferramentas: outrasFerramentas };
  }

  async function _confirmPropagate() {
    var state = window._dcPropState;
    if (!state) return;

    var checkboxes = document.querySelectorAll('#dc-modal-body input[type=checkbox]');
    var selecionadas = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) selecionadas.push(cb.getAttribute('data-ferramenta'));
    });

    if (selecionadas.length === 0) { _closeModal(); return; }

    document.getElementById('dc-modal-body').innerHTML = '<div class="dc-info">Atualizando...</div>';
    document.getElementById('dc-modal-footer').innerHTML = '';

    var resultados = [];
    for (var i = 0; i < selecionadas.length; i++) {
      var f = selecionadas[i];
      var ok = await _setValorInFerramenta(state.conceito, f, state.valor);
      resultados.push({ ferramenta: f, ok: ok });
    }

    var bodyHtml = '<p style="color:#ccc;font-size:13px;margin:0 0 8px;">Resultado:</p>';
    resultados.forEach(function(r) {
      var icon = r.ok ? '<span class="dc-result-ok">OK</span>' : '<span class="dc-result-err">Erro</span>';
      bodyHtml += '<p style="color:#ccc;font-size:13px;margin:2px 0;">' + icon + ' ' + (FERRAMENTA_NOMES[r.ferramenta] || r.ferramenta) + '</p>';
    });

    _setModalContent(
      '<h3>Propagação concluída</h3>',
      bodyHtml,
      '<button class="dc-btn dc-btn-primary" onclick="DadosCompartilhados._closeModal()">Fechar</button>'
    );
  }

  /* ============================================================
     9. ATTACH INPUT — Adiciona ícone de sync ao lado de um input
     ============================================================ */
  function attachInput(inputEl, conceito) {
    if (!inputEl || !CONCEITOS[conceito]) return;
    var config = CONCEITOS[conceito];

    // Check if this concept exists in at least one OTHER tool
    var outrasFerramentas = Object.keys(config.ferramentas).filter(function(f) { return f !== _ferramentaAtual; });
    if (outrasFerramentas.length === 0) return;

    // Create sync icon
    var icon = document.createElement('span');
    icon.className = 'dc-sync-icon';
    icon.innerHTML = '&#x21C4;'; // ⇄ arrows
    icon.title = 'Sincronizar: ' + config.label;
    icon.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      _showSyncMenu(conceito, inputEl, icon);
    });

    // Insert after input
    if (inputEl.parentNode) {
      inputEl.parentNode.insertBefore(icon, inputEl.nextSibling);
    }

    // Listen for changes to offer propagation
    var _debounceTimer = null;
    inputEl.addEventListener('change', function() {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function() {
        var val = inputEl.value;
        if (val && val !== '' && outrasFerramentas.length > 0) {
          // Show subtle notification
          icon.style.background = 'rgba(78,205,196,0.3)';
          icon.style.borderColor = '#4ECDC4';
          icon.setAttribute('data-changed', 'true');
          icon.setAttribute('data-newval', val);
          setTimeout(function() {
            icon.style.background = '';
            icon.style.borderColor = '';
          }, 3000);
        }
      }, 500);
    });
  }

  function _showSyncMenu(conceito, inputEl, iconEl) {
    var config = CONCEITOS[conceito];
    var hasChanged = iconEl.getAttribute('data-changed') === 'true';
    var newVal = iconEl.getAttribute('data-newval');

    var bodyHtml = '';
    bodyHtml += '<div class="dc-option" onclick="DadosCompartilhados.pull(\'' + conceito + '\')"><div class="dc-option-header"><span class="dc-option-tool">Puxar de outra ferramenta</span></div><div style="color:#999;font-size:12px;margin-top:4px;">Buscar o valor deste campo em outra ferramenta e usar aqui</div></div>';

    var outrasFerramentas = Object.keys(config.ferramentas).filter(function(f) { return f !== _ferramentaAtual && !config.ferramentas[f].isReuniao; });
    if (outrasFerramentas.length > 0) {
      bodyHtml += '<div class="dc-option" onclick="DadosCompartilhados.propagate(\'' + conceito + '\', document.getElementById(\'' + config.ferramentas[_ferramentaAtual].inputId + '\').value)"><div class="dc-option-header"><span class="dc-option-tool">Propagar para outras ferramentas</span></div><div style="color:#999;font-size:12px;margin-top:4px;">Enviar o valor atual deste campo para as outras ferramentas</div></div>';
    }

    _setModalContent(
      '<h3>' + config.label + '</h3><p>O que deseja fazer?</p>',
      bodyHtml,
      '<button class="dc-btn dc-btn-secondary" onclick="DadosCompartilhados._closeModal()">Cancelar</button>'
    );
    _openModal();
  }

  /* ============================================================
     10. INIT
     ============================================================ */
  function init(ferramentaAtual) {
    _ferramentaAtual = ferramentaAtual;
    _clienteId = _getClienteId();
    _initialized = true;

    // Auto-attach to known inputs for this tool
    var config;
    for (var conceito in CONCEITOS) {
      config = CONCEITOS[conceito];
      if (config.ferramentas[ferramentaAtual]) {
        var inputId = config.ferramentas[ferramentaAtual].inputId;
        if (inputId) {
          var el = document.getElementById(inputId);
          if (el) attachInput(el, conceito);
        }
      }
    }
  }

  /* ============================================================
     11. PUBLIC API
     ============================================================ */
  window.DadosCompartilhados = {
    init: init,
    pull: pull,
    propagate: propagate,
    attachInput: attachInput,
    CONCEITOS: CONCEITOS,
    _closeModal: _closeModal,
    _selectPullOption: _selectPullOption,
    _confirmPull: _confirmPull,
    _confirmPropagate: _confirmPropagate
  };

})();
