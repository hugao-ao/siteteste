// particularidades.js - Módulo de Particularidades do Cliente (apenas para equipe/consultor)
// Carregado pelo layout.js quando isEquipeModoCliente === true

(function() {
  const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

  const clienteId = sessionStorage.getItem('cliente_id');
  if (!clienteId) return;

  const isAdmin = sessionStorage.getItem('nivel') === 'admin';

  // === STATE ===
  let particData = {
    datas_relevantes: [],
    // [{data, descricao, recorrencia: {tipo:'nao_repete'|'repete', frequencia_qty, frequencia_unit, inicio, fim_tipo:'data'|'ocorrencias'|'nunca', fim_data, fim_ocorrencias}}]
    historia_vida: '',
    cidades: [],  // [{nome}]
    comunicacao: '',
    interesses: []
    // [{descricao, categoria_id, categoria_nome, subcategorias:[{id,nome,nivel}], prioridade, tipo_busca:'informacao'|'eventos'|'ambos'}]
  };

  let categoriasCache = []; // All categories from DB

  // === SUPABASE HELPERS ===
  async function sbFetch(path, options = {}) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    return resp;
  }

  async function loadCategorias() {
    try {
      const resp = await sbFetch('categorias_interesses?select=*&order=nome.asc');
      categoriasCache = await resp.json();
    } catch(e) {
      console.error('Erro ao carregar categorias:', e);
      categoriasCache = [];
    }
  }

  function getCategoriasByParent(parentId) {
    if (!parentId) return categoriasCache.filter(c => c.parent_id === null && c.nivel === 0);
    return categoriasCache.filter(c => c.parent_id === parentId);
  }

  async function createCategoria(nome, parentId, nivel) {
    // Check for homonyms (case-insensitive) at same parent
    const existing = categoriasCache.find(c => 
      c.nome.toLowerCase() === nome.toLowerCase() && 
      (c.parent_id === parentId || (!c.parent_id && !parentId))
    );
    if (existing) {
      alert('Já existe uma categoria com esse nome neste nível.');
      return null;
    }
    const body = { nome, parent_id: parentId || null, nivel: nivel || 0 };
    const resp = await sbFetch('categorias_interesses', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (resp.ok) {
      const created = await resp.json();
      const item = Array.isArray(created) ? created[0] : created;
      categoriasCache.push(item);
      return item;
    } else {
      const err = await resp.text();
      if (err.includes('idx_categorias_nome_unique')) {
        alert('Já existe uma categoria com esse nome neste nível.');
      } else {
        alert('Erro ao criar categoria: ' + err);
      }
      return null;
    }
  }

  async function updateCategoria(id, novoNome) {
    const resp = await sbFetch(`categorias_interesses?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ nome: novoNome })
    });
    if (resp.ok) {
      const updated = await resp.json();
      const item = Array.isArray(updated) ? updated[0] : updated;
      const idx = categoriasCache.findIndex(c => c.id === id);
      if (idx >= 0) categoriasCache[idx] = item;
      return item;
    } else {
      const err = await resp.text();
      if (err.includes('idx_categorias_nome_unique')) {
        alert('Já existe uma categoria com esse nome neste nível.');
      } else {
        alert('Erro ao editar: ' + err);
      }
      return null;
    }
  }

  async function deleteCategoria(id) {
    // Get all descendants for the warning
    const descendants = getDescendants(id);
    const total = descendants.length + 1;
    const msg = `ATENÇÃO: Ao excluir esta categoria, ${total > 1 ? total + ' itens serão removidos (incluindo subcategorias)' : 'este item será removido'}.\n\nIsso também removerá este interesse de TODOS os clientes que o utilizam.\n\nDeseja continuar?`;
    if (!confirm(msg)) return false;

    const resp = await sbFetch(`categorias_interesses?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
    if (resp.ok || resp.status === 204) {
      // Remove from cache (cascade handles DB, we remove from local cache)
      const idsToRemove = [id, ...descendants.map(d => d.id)];
      categoriasCache = categoriasCache.filter(c => !idsToRemove.includes(c.id));
      return true;
    }
    alert('Erro ao excluir.');
    return false;
  }

  function getDescendants(parentId) {
    const children = categoriasCache.filter(c => c.parent_id === parentId);
    let all = [...children];
    children.forEach(child => {
      all = all.concat(getDescendants(child.id));
    });
    return all;
  }

  // === INJECT BUTTON INTO SIDEBAR ===
  function injectButton() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    const btn = document.createElement('a');
    btn.href = '#';
    btn.className = 'nav-item nav-particularidades';
    btn.id = 'nav-particularidades';
    btn.innerHTML = '<i>📋</i> Particularidades';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    const helpItem = document.getElementById('nav-help');
    if (helpItem) {
      nav.insertBefore(btn, helpItem);
    } else {
      nav.appendChild(btn);
    }

    const style = document.createElement('style');
    style.textContent = `
      .nav-particularidades {
        border: 1px solid rgba(212, 175, 55, 0.3) !important;
        background: rgba(212, 175, 55, 0.08) !important;
        margin: 0.3rem 0.5rem !important;
        border-radius: 8px !important;
      }
      .nav-particularidades:hover {
        background: rgba(212, 175, 55, 0.2) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // === MODAL ===
  function openModal() {
    let modal = document.getElementById('particularidades-modal');
    if (!modal) {
      createModal();
      modal = document.getElementById('particularidades-modal');
    }
    Promise.all([loadData(), loadCategorias()]).then(() => {
      renderActiveTab();
      modal.style.display = 'flex';
    });
  }

  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'particularidades-modal';
    modal.innerHTML = `
      <div class="partic-overlay" onclick="document.getElementById('particularidades-modal').style.display='none'"></div>
      <div class="partic-container">
        <div class="partic-header">
          <h2>📋 Particularidades do Cliente</h2>
          <button class="partic-close" onclick="document.getElementById('particularidades-modal').style.display='none'">&times;</button>
        </div>
        <div class="partic-tabs">
          <button class="partic-tab active" data-tab="datas">📅 Datas Relevantes</button>
          <button class="partic-tab" data-tab="historia">📖 História de Vida</button>
          <button class="partic-tab" data-tab="comunicacao">💬 Comunicação</button>
          <button class="partic-tab" data-tab="interesses">⭐ Interesses</button>
        </div>
        <div class="partic-body" id="partic-body"></div>
        <div class="partic-footer">
          <button class="partic-btn-save" id="partic-save-btn">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Tab switching
    modal.querySelectorAll('.partic-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.partic-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderActiveTab();
      });
    });

    document.getElementById('partic-save-btn').addEventListener('click', saveData);
    injectStyles();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #particularidades-modal {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 10000;
        align-items: center;
        justify-content: center;
      }
      .partic-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7);
      }
      .partic-container {
        position: relative;
        background: #1a2a1a;
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 12px;
        width: 90%;
        max-width: 750px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .partic-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      }
      .partic-header h2 { margin: 0; font-size: 1.2rem; color: #d4af37; }
      .partic-close {
        background: none; border: none; color: #ccc;
        font-size: 1.8rem; cursor: pointer; line-height: 1;
      }
      .partic-close:hover { color: #fff; }
      .partic-tabs {
        display: flex; gap: 0;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        overflow-x: auto;
      }
      .partic-tab {
        flex: 1; padding: 0.7rem 0.5rem;
        background: none; border: none; color: #aaa;
        font-size: 0.8rem; cursor: pointer; white-space: nowrap;
        border-bottom: 2px solid transparent; transition: all 0.2s;
      }
      .partic-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
      .partic-tab.active { color: #d4af37; border-bottom-color: #d4af37; background: rgba(212, 175, 55, 0.08); }
      .partic-body {
        flex: 1; overflow-y: auto;
        padding: 1.2rem 1.5rem; color: #e0e0e0;
      }
      .partic-footer {
        padding: 0.8rem 1.5rem;
        border-top: 1px solid rgba(212, 175, 55, 0.2);
        text-align: right;
      }
      .partic-btn-save {
        background: #d4af37; color: #1a2a1a; border: none;
        padding: 0.6rem 1.5rem; border-radius: 6px;
        font-weight: bold; cursor: pointer; font-size: 0.9rem;
      }
      .partic-btn-save:hover { background: #e5c040; }
      .partic-body textarea {
        width: 100%; min-height: 120px;
        background: rgba(0,0,0,0.3); border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 8px; color: #e0e0e0; padding: 0.8rem;
        font-size: 0.9rem; resize: vertical;
      }
      .partic-body textarea:focus { outline: none; border-color: #d4af37; }
      .partic-body input[type="text"], .partic-body input[type="date"],
      .partic-body input[type="number"], .partic-body select {
        background: rgba(0,0,0,0.3); border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 6px; color: #e0e0e0; padding: 0.5rem 0.7rem; font-size: 0.85rem;
      }
      .partic-body input:focus, .partic-body select:focus { outline: none; border-color: #d4af37; }
      .partic-item-row {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.6rem 0.8rem; background: rgba(0,0,0,0.2);
        border-radius: 6px; margin-bottom: 0.5rem;
        border: 1px solid rgba(255,255,255,0.05);
        flex-wrap: wrap;
      }
      .partic-item-row .item-text { flex: 1; font-size: 0.85rem; min-width: 150px; }
      .partic-item-row .item-date { font-size: 0.75rem; color: #d4af37; white-space: nowrap; }
      .partic-item-row .item-badge {
        font-size: 0.7rem; background: rgba(212, 175, 55, 0.2);
        color: #d4af37; padding: 0.15rem 0.4rem; border-radius: 4px;
      }
      .partic-item-row .item-badge-blue {
        font-size: 0.7rem; background: rgba(100, 180, 255, 0.15);
        color: #7fc8f8; padding: 0.15rem 0.4rem; border-radius: 4px;
      }
      .partic-item-row .btn-remove {
        background: none; border: none; color: #ff6b6b;
        cursor: pointer; font-size: 1rem; padding: 0 0.3rem;
      }
      .partic-item-row .btn-remove:hover { color: #ff3333; }
      .partic-item-row .btn-edit {
        background: none; border: none; color: #d4af37;
        cursor: pointer; font-size: 0.85rem; padding: 0 0.3rem;
      }
      .partic-item-row .btn-edit:hover { color: #e5c040; }
      .partic-add-row {
        display: flex; gap: 0.5rem; margin-top: 0.8rem; flex-wrap: wrap;
      }
      .partic-add-row input, .partic-add-row select { flex: 1; min-width: 100px; }
      .partic-add-btn {
        background: rgba(212, 175, 55, 0.2); border: 1px solid rgba(212, 175, 55, 0.4);
        color: #d4af37; padding: 0.5rem 1rem; border-radius: 6px;
        cursor: pointer; font-size: 0.85rem; white-space: nowrap;
      }
      .partic-add-btn:hover { background: rgba(212, 175, 55, 0.35); }
      .partic-section-title {
        font-size: 0.8rem; color: #aaa; margin-bottom: 0.5rem;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .partic-recorrencia-row {
        display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;
        margin-top: 0.3rem; padding-left: 0.5rem;
        font-size: 0.75rem; color: #888;
      }
      .partic-recorrencia-row select, .partic-recorrencia-row input {
        font-size: 0.75rem !important; padding: 0.3rem 0.4rem !important;
      }
      /* Category Picker Modal */
      .cat-picker-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 10001;
        display: flex; align-items: center; justify-content: center;
      }
      .cat-picker-box {
        background: #1a2a1a; border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 10px; width: 90%; max-width: 400px;
        max-height: 70vh; display: flex; flex-direction: column;
        overflow: hidden;
      }
      .cat-picker-header {
        padding: 0.8rem 1rem; border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        display: flex; justify-content: space-between; align-items: center;
      }
      .cat-picker-header h3 { margin: 0; font-size: 1rem; color: #d4af37; }
      .cat-picker-search {
        padding: 0.5rem 1rem;
      }
      .cat-picker-search input {
        width: 100%; background: rgba(0,0,0,0.3);
        border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 6px;
        color: #e0e0e0; padding: 0.5rem 0.7rem; font-size: 0.85rem;
      }
      .cat-picker-search input:focus { outline: none; border-color: #d4af37; }
      .cat-picker-list {
        flex: 1; overflow-y: auto; padding: 0.5rem 1rem;
      }
      .cat-picker-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.5rem 0.6rem; border-radius: 6px; cursor: pointer;
        margin-bottom: 0.3rem; font-size: 0.85rem; color: #e0e0e0;
      }
      .cat-picker-item:hover { background: rgba(212, 175, 55, 0.1); }
      .cat-picker-item .cat-actions { display: flex; gap: 0.3rem; }
      .cat-picker-item .cat-actions button {
        background: none; border: none; cursor: pointer; font-size: 0.8rem; padding: 0.2rem;
      }
      .cat-picker-item .cat-actions .btn-cat-edit { color: #d4af37; }
      .cat-picker-item .cat-actions .btn-cat-del { color: #ff6b6b; }
      .cat-picker-footer {
        padding: 0.8rem 1rem; border-top: 1px solid rgba(212, 175, 55, 0.2);
        display: flex; gap: 0.5rem;
      }
      .cat-picker-footer input {
        flex: 1; background: rgba(0,0,0,0.3);
        border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 6px;
        color: #e0e0e0; padding: 0.5rem 0.7rem; font-size: 0.85rem;
      }
      .cat-picker-footer button {
        background: #d4af37; color: #1a2a1a; border: none;
        padding: 0.5rem 0.8rem; border-radius: 6px; font-weight: bold;
        cursor: pointer; font-size: 0.8rem; white-space: nowrap;
      }
      /* Interesse detail card */
      .interesse-card {
        background: rgba(0,0,0,0.25); border: 1px solid rgba(212, 175, 55, 0.15);
        border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem;
      }
      .interesse-card-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 0.4rem;
      }
      .interesse-card-header strong { color: #e0e0e0; font-size: 0.9rem; }
      .interesse-card-meta {
        display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;
      }
      .interesse-card-subs {
        font-size: 0.75rem; color: #aaa; margin-top: 0.3rem;
      }
      .interesse-card-subs span { margin-right: 0.3rem; }
    `;
    document.head.appendChild(style);
  }

  function renderActiveTab() {
    const modal = document.getElementById('particularidades-modal');
    const activeTab = modal.querySelector('.partic-tab.active').dataset.tab;
    const body = document.getElementById('partic-body');

    switch(activeTab) {
      case 'datas': renderDatas(body); break;
      case 'historia': renderHistoria(body); break;
      case 'comunicacao': renderComunicacao(body); break;
      case 'interesses': renderInteresses(body); break;
    }
  }

  // ============================================================
  // TAB: DATAS RELEVANTES (com recorrência flexível)
  // ============================================================
  function renderDatas(body) {
    let html = '<p class="partic-section-title">Datas importantes para lembrar (aniversários, vencimentos, eventos...)</p>';

    particData.datas_relevantes.forEach((item, idx) => {
      const dataFmt = item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
      const rec = item.recorrencia || {};
      let recLabel = 'Não se repete';
      if (rec.tipo === 'repete') {
        recLabel = `A cada ${rec.frequencia_qty || 1} ${rec.frequencia_unit || 'meses'}`;
        if (rec.fim_tipo === 'data' && rec.fim_data) recLabel += ` até ${new Date(rec.fim_data + 'T12:00:00').toLocaleDateString('pt-BR')}`;
        else if (rec.fim_tipo === 'ocorrencias') recLabel += ` (${rec.fim_ocorrencias}x)`;
        else if (rec.fim_tipo === 'nunca') recLabel += ' (sem fim)';
      }
      // Backward compat: old format had just "recorrente: true"
      if (!rec.tipo && item.recorrente) recLabel = 'Anual (sem fim)';

      html += `
        <div class="partic-item-row">
          <span class="item-date">${dataFmt}</span>
          <span class="item-text">${item.descricao || ''}</span>
          <span class="item-badge">${recLabel}</span>
          <button class="btn-edit" onclick="window._particEditData(${idx})" title="Editar">✎</button>
          <button class="btn-remove" onclick="window._particRemoveData(${idx})">✕</button>
        </div>
      `;
    });

    html += `
      <div style="margin-top:1rem; padding:0.8rem; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid rgba(212,175,55,0.15);">
        <p style="font-size:0.8rem; color:#d4af37; margin:0 0 0.5rem 0; font-weight:bold;">+ Nova Data Relevante</p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem;">
          <input type="date" id="partic-new-data-date" style="flex:1; min-width:130px;">
          <input type="text" id="partic-new-data-desc" placeholder="Descrição (ex: Aniversário)" style="flex:2; min-width:180px;">
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-bottom:0.5rem;">
          <label style="font-size:0.8rem; color:#aaa;">Recorrência:</label>
          <select id="partic-new-data-rec-tipo" onchange="window._particToggleRecFields()" style="min-width:120px;">
            <option value="nao_repete">Não se repete</option>
            <option value="repete">Repetir a cada...</option>
          </select>
        </div>
        <div id="partic-rec-fields" style="display:none; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-bottom:0.5rem;">
          <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
            <label style="font-size:0.75rem; color:#aaa;">A cada</label>
            <input type="number" id="partic-new-data-rec-qty" value="1" min="1" style="width:50px;">
            <select id="partic-new-data-rec-unit">
              <option value="dias">dias</option>
              <option value="dias_uteis">dias úteis</option>
              <option value="semanas">semanas</option>
              <option value="quinzenas">quinzenas</option>
              <option value="meses" selected>meses</option>
              <option value="anos">anos</option>
            </select>
          </div>
          <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap; margin-top:0.4rem;">
            <label style="font-size:0.75rem; color:#aaa;">Termina:</label>
            <select id="partic-new-data-rec-fim" onchange="window._particToggleFimFields()">
              <option value="nunca">Nunca</option>
              <option value="data">Em data específica</option>
              <option value="ocorrencias">Após X ocorrências</option>
            </select>
            <input type="date" id="partic-new-data-rec-fim-data" style="display:none; width:140px;">
            <input type="number" id="partic-new-data-rec-fim-occ" min="1" value="10" style="display:none; width:60px;">
          </div>
        </div>
        <button class="partic-add-btn" onclick="window._particAddData()">+ Adicionar Data</button>
      </div>
    `;
    body.innerHTML = html;
  }

  window._particToggleRecFields = function() {
    const tipo = document.getElementById('partic-new-data-rec-tipo').value;
    document.getElementById('partic-rec-fields').style.display = tipo === 'repete' ? 'block' : 'none';
  };

  window._particToggleFimFields = function() {
    const fim = document.getElementById('partic-new-data-rec-fim').value;
    document.getElementById('partic-new-data-rec-fim-data').style.display = fim === 'data' ? 'inline-block' : 'none';
    document.getElementById('partic-new-data-rec-fim-occ').style.display = fim === 'ocorrencias' ? 'inline-block' : 'none';
  };

  window._particAddData = function() {
    const date = document.getElementById('partic-new-data-date').value;
    const desc = document.getElementById('partic-new-data-desc').value.trim();
    if (!date || !desc) { alert('Preencha a data e a descrição.'); return; }

    const recTipo = document.getElementById('partic-new-data-rec-tipo').value;
    let recorrencia = { tipo: 'nao_repete' };
    if (recTipo === 'repete') {
      recorrencia = {
        tipo: 'repete',
        frequencia_qty: parseInt(document.getElementById('partic-new-data-rec-qty').value) || 1,
        frequencia_unit: document.getElementById('partic-new-data-rec-unit').value,
        inicio: date,
        fim_tipo: document.getElementById('partic-new-data-rec-fim').value,
        fim_data: document.getElementById('partic-new-data-rec-fim-data').value || null,
        fim_ocorrencias: parseInt(document.getElementById('partic-new-data-rec-fim-occ').value) || null
      };
    }

    particData.datas_relevantes.push({ data: date, descricao: desc, recorrencia });
    particData.datas_relevantes.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    renderActiveTab();
  };

  window._particEditData = function(idx) {
    const item = particData.datas_relevantes[idx];
    const novaDesc = prompt('Editar descrição:', item.descricao);
    if (novaDesc !== null) {
      item.descricao = novaDesc.trim() || item.descricao;
      renderActiveTab();
    }
  };

  window._particRemoveData = function(idx) {
    if (confirm('Remover esta data relevante?')) {
      particData.datas_relevantes.splice(idx, 1);
      renderActiveTab();
    }
  };

  // ============================================================
  // TAB: HISTÓRIA DE VIDA (com cidades)
  // ============================================================
  function renderHistoria(body) {
    const cidadesHtml = (particData.cidades || []).map((c, i) => 
      `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(212,175,55,0.15);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.8rem;color:#d4af37;margin:0.2rem;">
        ${c.nome} <button onclick="window._particRemoveCidade(${i})" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:0.9rem;padding:0;">✕</button>
      </span>`
    ).join('');

    body.innerHTML = `
      <p class="partic-section-title">Cidades que o cliente mora/frequenta (usadas para buscar eventos próximos)</p>
      <div style="margin-bottom:1rem;">
        <div style="margin-bottom:0.5rem;">${cidadesHtml || '<span style="font-size:0.8rem;color:#888;">Nenhuma cidade adicionada</span>'}</div>
        <div style="display:flex;gap:0.5rem;">
          <input type="text" id="partic-new-cidade" placeholder="Nome da cidade (ex: São Paulo)" style="flex:1;">
          <button class="partic-add-btn" onclick="window._particAddCidade()">+ Cidade</button>
        </div>
      </div>
      <p class="partic-section-title">Informações sobre a história de vida do cliente</p>
      <textarea id="partic-historia-text" placeholder="Ex: Casado, 2 filhos (8 e 12 anos). Trabalha como engenheiro na empresa X há 5 anos...">${particData.historia_vida || ''}</textarea>
    `;
    document.getElementById('partic-historia-text').addEventListener('input', (e) => {
      particData.historia_vida = e.target.value;
    });
  }

  window._particAddCidade = function() {
    const nome = document.getElementById('partic-new-cidade').value.trim();
    if (!nome) { alert('Digite o nome da cidade.'); return; }
    if (!particData.cidades) particData.cidades = [];
    particData.cidades.push({ nome });
    renderActiveTab();
  };

  window._particRemoveCidade = function(idx) {
    particData.cidades.splice(idx, 1);
    renderActiveTab();
  };

  // ============================================================
  // TAB: COMUNICAÇÃO
  // ============================================================
  function renderComunicacao(body) {
    body.innerHTML = `
      <p class="partic-section-title">Como se comunicar com este cliente (tom, horários, preferências, cuidados...)</p>
      <textarea id="partic-comunicacao-text" placeholder="Ex: Prefere mensagens curtas e diretas. Não gosta de áudios longos. Melhor horário: manhã (8h-10h)...">${particData.comunicacao || ''}</textarea>
    `;
    document.getElementById('partic-comunicacao-text').addEventListener('input', (e) => {
      particData.comunicacao = e.target.value;
    });
  }

  // ============================================================
  // TAB: INTERESSES (com sistema hierárquico de categorias)
  // ============================================================
  function renderInteresses(body) {
    let html = '<p class="partic-section-title">Interesses e hobbies do cliente (usados para curadoria de conteúdo)</p>';

    particData.interesses.forEach((item, idx) => {
      const subsText = (item.subcategorias || []).map(s => s.nome).join(' > ');
      const tipoBadge = item.tipo_busca === 'informacao' ? '📰 Info' : item.tipo_busca === 'eventos' ? '📍 Eventos' : '📰📍 Ambos';
      html += `
        <div class="interesse-card">
          <div class="interesse-card-header">
            <strong>${item.descricao || ''}</strong>
            <div>
              <button class="btn-edit" onclick="window._particEditInteresse(${idx})" title="Editar">✎</button>
              <button class="btn-remove" onclick="window._particRemoveInteresse(${idx})">✕</button>
            </div>
          </div>
          <div class="interesse-card-meta">
            ${item.categoria_nome ? `<span class="item-badge">${item.categoria_nome}</span>` : ''}
            ${subsText ? `<span class="item-badge-blue">${subsText}</span>` : ''}
            <span style="font-size:0.7rem;color:#aaa;">Prio: ${item.prioridade || 1}</span>
            <span style="font-size:0.7rem;color:#aaa;">${tipoBadge}</span>
          </div>
        </div>
      `;
    });

    html += `
      <div style="margin-top:1rem; padding:0.8rem; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid rgba(212,175,55,0.15);">
        <p style="font-size:0.8rem; color:#d4af37; margin:0 0 0.5rem 0; font-weight:bold;">+ Novo Interesse</p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem;">
          <input type="text" id="partic-new-int-desc" placeholder="Descrição breve (ex: Futebol - Flamengo)" style="flex:2; min-width:200px;">
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem; align-items:center;">
          <button class="partic-add-btn" onclick="window._particPickCategoria()" id="btn-pick-cat" style="flex:1; text-align:left;">
            📁 Selecionar Categoria...
          </button>
          <span id="partic-selected-cat-display" style="font-size:0.8rem; color:#d4af37;"></span>
        </div>
        <div id="partic-subcats-container"></div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem; align-items:center;">
          <div style="display:flex; flex-direction:column; gap:0.2rem;">
            <label style="font-size:0.7rem; color:#aaa;">Prioridade</label>
            <input type="number" id="partic-new-int-prio" value="1" min="1" style="width:60px;">
          </div>
          <div style="display:flex; flex-direction:column; gap:0.2rem;">
            <label style="font-size:0.7rem; color:#aaa;">Tipo de busca</label>
            <select id="partic-new-int-tipo">
              <option value="ambos">📰📍 Informação + Eventos</option>
              <option value="informacao">📰 Apenas Informação</option>
              <option value="eventos">📍 Apenas Eventos</option>
            </select>
          </div>
        </div>
        <button class="partic-add-btn" onclick="window._particAddInteresse()">+ Adicionar Interesse</button>
      </div>
    `;
    body.innerHTML = html;
  }

  // State for new interesse being built
  let newInteresseState = {
    categoria_id: null,
    categoria_nome: '',
    subcategorias: [] // [{id, nome, nivel}]
  };

  // === CATEGORY PICKER MODAL ===
  window._particPickCategoria = function() {
    newInteresseState = { categoria_id: null, categoria_nome: '', subcategorias: [] };
    document.getElementById('partic-selected-cat-display').textContent = '';
    document.getElementById('partic-subcats-container').innerHTML = '';
    openCatPicker(null, 0, (selected) => {
      newInteresseState.categoria_id = selected.id;
      newInteresseState.categoria_nome = selected.nome;
      document.getElementById('btn-pick-cat').innerHTML = `📁 ${selected.nome}`;
      document.getElementById('partic-selected-cat-display').textContent = '';
      // Now offer subcategory selection
      offerSubcategory(selected.id, 1);
    });
  };

  function offerSubcategory(parentId, nivel) {
    if (nivel > 5) return; // Max 5 subcategories
    const children = getCategoriasByParent(parentId);
    const container = document.getElementById('partic-subcats-container');
    
    const subDiv = document.createElement('div');
    subDiv.style.cssText = 'display:flex; gap:0.5rem; align-items:center; margin-bottom:0.4rem; flex-wrap:wrap;';
    subDiv.innerHTML = `
      <button class="partic-add-btn" style="flex:1; text-align:left; font-size:0.8rem;" id="btn-pick-sub-${nivel}">
        📂 Subcategoria ${String(nivel).padStart(2, '0')} (opcional)...
      </button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#ff6b6b;cursor:pointer;">✕</button>
    `;
    container.appendChild(subDiv);

    subDiv.querySelector(`#btn-pick-sub-${nivel}`).addEventListener('click', () => {
      openCatPicker(parentId, nivel, (selected) => {
        newInteresseState.subcategorias.push({ id: selected.id, nome: selected.nome, nivel });
        subDiv.querySelector(`#btn-pick-sub-${nivel}`).innerHTML = `📂 ${selected.nome}`;
        subDiv.querySelector(`#btn-pick-sub-${nivel}`).disabled = true;
        // Offer next level
        offerSubcategory(selected.id, nivel + 1);
      });
    });
  }

  function openCatPicker(parentId, nivel, onSelect) {
    // Remove existing picker if any
    const existing = document.querySelector('.cat-picker-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'cat-picker-overlay';

    const items = getCategoriasByParent(parentId);
    const title = nivel === 0 ? 'Selecionar Categoria' : `Selecionar Subcategoria ${String(nivel).padStart(2, '0')}`;

    overlay.innerHTML = `
      <div class="cat-picker-box">
        <div class="cat-picker-header">
          <h3>${title}</h3>
          <button onclick="this.closest('.cat-picker-overlay').remove()" style="background:none;border:none;color:#ccc;font-size:1.5rem;cursor:pointer;">&times;</button>
        </div>
        <div class="cat-picker-search">
          <input type="text" id="cat-picker-filter" placeholder="Filtrar..." oninput="window._particFilterCatList()">
        </div>
        <div class="cat-picker-list" id="cat-picker-list"></div>
        <div class="cat-picker-footer">
          <input type="text" id="cat-picker-new-name" placeholder="Criar nova...">
          <button onclick="window._particCreateCatFromPicker()">Criar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Store context for the picker
    window._catPickerContext = { parentId, nivel, onSelect };

    renderCatPickerList(items);
  }

  function renderCatPickerList(items) {
    const list = document.getElementById('cat-picker-list');
    if (!list) return;
    const filter = (document.getElementById('cat-picker-filter')?.value || '').toLowerCase();
    const filtered = items.filter(i => i.nome.toLowerCase().includes(filter));

    list.innerHTML = filtered.length === 0 
      ? '<p style="color:#888;font-size:0.85rem;text-align:center;padding:1rem;">Nenhuma encontrada. Crie uma nova abaixo.</p>'
      : filtered.map(item => `
        <div class="cat-picker-item" data-id="${item.id}">
          <span onclick="window._particSelectCat('${item.id}','${item.nome.replace(/'/g, "\\'")}')" style="flex:1;cursor:pointer;">${item.nome}</span>
          <div class="cat-actions">
            <button class="btn-cat-edit" onclick="window._particEditCat('${item.id}')" title="Editar nome">✎</button>
            ${isAdmin ? `<button class="btn-cat-del" onclick="window._particDeleteCat('${item.id}')" title="Excluir (admin)">✕</button>` : ''}
          </div>
        </div>
      `).join('');
  }

  window._particFilterCatList = function() {
    const ctx = window._catPickerContext;
    const items = getCategoriasByParent(ctx.parentId);
    renderCatPickerList(items);
  };

  window._particSelectCat = function(id, nome) {
    const ctx = window._catPickerContext;
    document.querySelector('.cat-picker-overlay')?.remove();
    ctx.onSelect({ id, nome });
  };

  window._particCreateCatFromPicker = function() {
    const ctx = window._catPickerContext;
    const nome = document.getElementById('cat-picker-new-name').value.trim();
    if (!nome) { alert('Digite um nome para a nova categoria.'); return; }
    createCategoria(nome, ctx.parentId, ctx.nivel).then(created => {
      if (created) {
        document.querySelector('.cat-picker-overlay')?.remove();
        ctx.onSelect({ id: created.id, nome: created.nome });
      }
    });
  };

  window._particEditCat = function(id) {
    const cat = categoriasCache.find(c => c.id === id);
    if (!cat) return;
    const aviso = 'ATENÇÃO: Alterar o nome desta categoria irá alterar automaticamente em TODOS os clientes que a utilizam.\n\nNovo nome:';
    const novoNome = prompt(aviso, cat.nome);
    if (novoNome === null || novoNome.trim() === '') return;
    updateCategoria(id, novoNome.trim()).then(updated => {
      if (updated) {
        // Update in particData interesses too
        particData.interesses.forEach(int => {
          if (int.categoria_id === id) int.categoria_nome = updated.nome;
          (int.subcategorias || []).forEach(sub => {
            if (sub.id === id) sub.nome = updated.nome;
          });
        });
        // Re-render picker list
        const ctx = window._catPickerContext;
        const items = getCategoriasByParent(ctx.parentId);
        renderCatPickerList(items);
      }
    });
  };

  window._particDeleteCat = function(id) {
    if (!isAdmin) { alert('Apenas administradores podem excluir categorias.'); return; }
    deleteCategoria(id).then(deleted => {
      if (deleted) {
        // Remove from particData interesses
        particData.interesses = particData.interesses.filter(int => {
          if (int.categoria_id === id) return false;
          int.subcategorias = (int.subcategorias || []).filter(s => s.id !== id);
          return true;
        });
        // Re-render picker list
        const ctx = window._catPickerContext;
        if (ctx) {
          const items = getCategoriasByParent(ctx.parentId);
          renderCatPickerList(items);
        }
        renderActiveTab();
      }
    });
  };

  window._particAddInteresse = function() {
    const desc = document.getElementById('partic-new-int-desc').value.trim();
    if (!desc) { alert('Preencha a descrição do interesse.'); return; }
    const prio = parseInt(document.getElementById('partic-new-int-prio').value) || 1;
    const tipoBusca = document.getElementById('partic-new-int-tipo').value;

    particData.interesses.push({
      descricao: desc,
      categoria_id: newInteresseState.categoria_id,
      categoria_nome: newInteresseState.categoria_nome,
      subcategorias: [...newInteresseState.subcategorias],
      prioridade: prio,
      tipo_busca: tipoBusca
    });

    // Reset state
    newInteresseState = { categoria_id: null, categoria_nome: '', subcategorias: [] };
    renderActiveTab();
  };

  window._particEditInteresse = function(idx) {
    const item = particData.interesses[idx];
    const novaDesc = prompt('Editar descrição:', item.descricao);
    if (novaDesc !== null && novaDesc.trim()) {
      item.descricao = novaDesc.trim();
      renderActiveTab();
    }
  };

  window._particRemoveInteresse = function(idx) {
    if (confirm('Remover este interesse?')) {
      particData.interesses.splice(idx, 1);
      renderActiveTab();
    }
  };

  // ============================================================
  // SUPABASE LOAD/SAVE
  // ============================================================
  async function loadData() {
    try {
      const resp = await sbFetch(`ferramentas_dados?cliente_id=eq.${clienteId}&ferramenta_slug=eq.particularidades&select=*`);
      const rows = await resp.json();
      if (rows && rows.length > 0 && rows[0].dados) {
        const d = typeof rows[0].dados === 'string' ? JSON.parse(rows[0].dados) : rows[0].dados;
        particData.datas_relevantes = d.datas_relevantes || [];
        particData.historia_vida = d.historia_vida || '';
        particData.cidades = d.cidades || [];
        particData.comunicacao = d.comunicacao || '';
        particData.interesses = d.interesses || [];
      }
    } catch (err) {
      console.error('Particularidades: erro ao carregar', err);
    }
  }

  async function saveData() {
    const saveBtn = document.getElementById('partic-save-btn');
    saveBtn.textContent = 'Salvando...';
    saveBtn.disabled = true;

    try {
      const checkResp = await sbFetch(`ferramentas_dados?cliente_id=eq.${clienteId}&ferramenta_slug=eq.particularidades&select=id`);
      const existing = await checkResp.json();

      const payload = {
        cliente_id: clienteId,
        ferramenta_slug: 'particularidades',
        dados: particData
      };

      let resp;
      if (existing && existing.length > 0) {
        resp = await sbFetch(`ferramentas_dados?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ dados: particData })
        });
      } else {
        resp = await sbFetch('ferramentas_dados', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(payload)
        });
      }

      if (resp.ok || resp.status === 201 || resp.status === 204) {
        saveBtn.textContent = '✓ Salvo!';
        setTimeout(() => { saveBtn.textContent = 'Salvar'; saveBtn.disabled = false; }, 2000);
      } else {
        const errText = await resp.text();
        console.error('Erro ao salvar particularidades:', errText);
        saveBtn.textContent = 'Erro!';
        setTimeout(() => { saveBtn.textContent = 'Salvar'; saveBtn.disabled = false; }, 2000);
      }
    } catch (err) {
      console.error('Particularidades: erro ao salvar', err);
      saveBtn.textContent = 'Erro!';
      setTimeout(() => { saveBtn.textContent = 'Salvar'; saveBtn.disabled = false; }, 2000);
    }
  }

  // === INIT ===
  const waitForSidebar = setInterval(() => {
    if (document.querySelector('.sidebar-nav')) {
      clearInterval(waitForSidebar);
      injectButton();
    }
  }, 200);

})();
