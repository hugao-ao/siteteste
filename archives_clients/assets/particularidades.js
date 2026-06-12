// particularidades.js - Módulo de Particularidades do Cliente (apenas para equipe/consultor)
// Carregado pelo layout.js quando isEquipeModoCliente === true

(function() {
  const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

  const clienteId = sessionStorage.getItem('cliente_id');
  if (!clienteId) return;

  // === STATE ===
  let particData = {
    datas_relevantes: [],   // [{ data, descricao, recorrente }]
    historia_vida: '',       // texto livre
    comunicacao: '',         // texto livre sobre como se comunicar
    interesses: []           // [{ palavra_chave, categoria, prioridade }]
  };

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

    // Insert before the last item (Ajuda)
    const helpItem = document.getElementById('nav-help');
    if (helpItem) {
      nav.insertBefore(btn, helpItem);
    } else {
      nav.appendChild(btn);
    }

    // Style
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
    loadData().then(() => {
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

    // Save button
    document.getElementById('partic-save-btn').addEventListener('click', saveData);

    // Inject styles
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
        max-width: 700px;
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
      .partic-header h2 {
        margin: 0;
        font-size: 1.2rem;
        color: #d4af37;
      }
      .partic-close {
        background: none;
        border: none;
        color: #ccc;
        font-size: 1.8rem;
        cursor: pointer;
        line-height: 1;
      }
      .partic-close:hover { color: #fff; }
      .partic-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        overflow-x: auto;
      }
      .partic-tab {
        flex: 1;
        padding: 0.7rem 0.5rem;
        background: none;
        border: none;
        color: #aaa;
        font-size: 0.8rem;
        cursor: pointer;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      .partic-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
      .partic-tab.active {
        color: #d4af37;
        border-bottom-color: #d4af37;
        background: rgba(212, 175, 55, 0.08);
      }
      .partic-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.2rem 1.5rem;
        color: #e0e0e0;
      }
      .partic-footer {
        padding: 0.8rem 1.5rem;
        border-top: 1px solid rgba(212, 175, 55, 0.2);
        text-align: right;
      }
      .partic-btn-save {
        background: #d4af37;
        color: #1a2a1a;
        border: none;
        padding: 0.6rem 1.5rem;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .partic-btn-save:hover { background: #e5c040; }
      .partic-body textarea {
        width: 100%;
        min-height: 150px;
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 8px;
        color: #e0e0e0;
        padding: 0.8rem;
        font-size: 0.9rem;
        resize: vertical;
      }
      .partic-body textarea:focus {
        outline: none;
        border-color: #d4af37;
      }
      .partic-body input[type="text"], .partic-body input[type="date"], .partic-body select {
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(212, 175, 55, 0.2);
        border-radius: 6px;
        color: #e0e0e0;
        padding: 0.5rem 0.7rem;
        font-size: 0.85rem;
      }
      .partic-body input:focus, .partic-body select:focus {
        outline: none;
        border-color: #d4af37;
      }
      .partic-item-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.7rem;
        background: rgba(0,0,0,0.2);
        border-radius: 6px;
        margin-bottom: 0.5rem;
        border: 1px solid rgba(255,255,255,0.05);
      }
      .partic-item-row .item-text {
        flex: 1;
        font-size: 0.85rem;
      }
      .partic-item-row .item-date {
        font-size: 0.75rem;
        color: #d4af37;
        white-space: nowrap;
      }
      .partic-item-row .item-badge {
        font-size: 0.7rem;
        background: rgba(212, 175, 55, 0.2);
        color: #d4af37;
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
      }
      .partic-item-row .btn-remove {
        background: none;
        border: none;
        color: #ff6b6b;
        cursor: pointer;
        font-size: 1rem;
        padding: 0 0.3rem;
      }
      .partic-item-row .btn-remove:hover { color: #ff3333; }
      .partic-add-row {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.8rem;
        flex-wrap: wrap;
      }
      .partic-add-row input, .partic-add-row select {
        flex: 1;
        min-width: 100px;
      }
      .partic-add-btn {
        background: rgba(212, 175, 55, 0.2);
        border: 1px solid rgba(212, 175, 55, 0.4);
        color: #d4af37;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        white-space: nowrap;
      }
      .partic-add-btn:hover { background: rgba(212, 175, 55, 0.35); }
      .partic-section-title {
        font-size: 0.8rem;
        color: #aaa;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
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

  // === TAB: DATAS RELEVANTES ===
  function renderDatas(body) {
    let html = '<p class="partic-section-title">Datas importantes para lembrar (aniversários, vencimentos, eventos...)</p>';
    
    particData.datas_relevantes.forEach((item, idx) => {
      const dataFmt = item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
      html += `
        <div class="partic-item-row">
          <span class="item-date">${dataFmt}</span>
          <span class="item-text">${item.descricao}</span>
          ${item.recorrente ? '<span class="item-badge">Anual</span>' : ''}
          <button class="btn-remove" onclick="window._particRemoveData(${idx})">✕</button>
        </div>
      `;
    });

    html += `
      <div class="partic-add-row">
        <input type="date" id="partic-new-data-date">
        <input type="text" id="partic-new-data-desc" placeholder="Descrição (ex: Aniversário)">
        <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.8rem;color:#aaa;white-space:nowrap;">
          <input type="checkbox" id="partic-new-data-recorrente"> Anual
        </label>
        <button class="partic-add-btn" onclick="window._particAddData()">+ Adicionar</button>
      </div>
    `;
    body.innerHTML = html;
  }

  window._particAddData = function() {
    const date = document.getElementById('partic-new-data-date').value;
    const desc = document.getElementById('partic-new-data-desc').value.trim();
    const recorrente = document.getElementById('partic-new-data-recorrente').checked;
    if (!date || !desc) { alert('Preencha a data e a descrição.'); return; }
    particData.datas_relevantes.push({ data: date, descricao: desc, recorrente });
    particData.datas_relevantes.sort((a, b) => a.data.localeCompare(b.data));
    renderActiveTab();
  };

  window._particRemoveData = function(idx) {
    particData.datas_relevantes.splice(idx, 1);
    renderActiveTab();
  };

  // === TAB: HISTÓRIA DE VIDA ===
  function renderHistoria(body) {
    body.innerHTML = `
      <p class="partic-section-title">Informações sobre a história de vida do cliente (contexto pessoal, familiar, profissional...)</p>
      <textarea id="partic-historia-text" placeholder="Ex: Casado, 2 filhos (8 e 12 anos). Trabalha como engenheiro na empresa X há 5 anos. Está planejando trocar de carro em 2027...">${particData.historia_vida || ''}</textarea>
    `;
    document.getElementById('partic-historia-text').addEventListener('input', (e) => {
      particData.historia_vida = e.target.value;
    });
  }

  // === TAB: COMUNICAÇÃO ===
  function renderComunicacao(body) {
    body.innerHTML = `
      <p class="partic-section-title">Como se comunicar com este cliente (tom, horários, preferências, cuidados...)</p>
      <textarea id="partic-comunicacao-text" placeholder="Ex: Prefere mensagens curtas e diretas. Não gosta de áudios longos. Melhor horário: manhã (8h-10h). Responde rápido pelo WhatsApp. Gosta de gráficos e números...">${particData.comunicacao || ''}</textarea>
    `;
    document.getElementById('partic-comunicacao-text').addEventListener('input', (e) => {
      particData.comunicacao = e.target.value;
    });
  }

  // === TAB: INTERESSES ===
  function renderInteresses(body) {
    let html = '<p class="partic-section-title">Interesses e hobbies do cliente (usados para curadoria de conteúdo)</p>';

    particData.interesses.forEach((item, idx) => {
      html += `
        <div class="partic-item-row">
          <span class="item-text"><strong>${item.palavra_chave}</strong></span>
          ${item.categoria ? `<span class="item-badge">${item.categoria}</span>` : ''}
          <span style="font-size:0.75rem;color:#aaa;">Prioridade: ${item.prioridade || 1}</span>
          <button class="btn-remove" onclick="window._particRemoveInteresse(${idx})">✕</button>
        </div>
      `;
    });

    html += `
      <div class="partic-add-row">
        <input type="text" id="partic-new-interesse-kw" placeholder="Palavra-chave (ex: Flamengo)">
        <input type="text" id="partic-new-interesse-cat" placeholder="Categoria (ex: Esporte)">
        <select id="partic-new-interesse-prio">
          <option value="1">Prioridade 1 (alta)</option>
          <option value="2">Prioridade 2</option>
          <option value="3">Prioridade 3 (baixa)</option>
        </select>
        <button class="partic-add-btn" onclick="window._particAddInteresse()">+ Adicionar</button>
      </div>
    `;
    body.innerHTML = html;
  }

  window._particAddInteresse = function() {
    const kw = document.getElementById('partic-new-interesse-kw').value.trim();
    const cat = document.getElementById('partic-new-interesse-cat').value.trim();
    const prio = parseInt(document.getElementById('partic-new-interesse-prio').value) || 1;
    if (!kw) { alert('Preencha a palavra-chave.'); return; }
    particData.interesses.push({ palavra_chave: kw, categoria: cat, prioridade: prio });
    renderActiveTab();
  };

  window._particRemoveInteresse = function(idx) {
    particData.interesses.splice(idx, 1);
    renderActiveTab();
  };

  // === SUPABASE LOAD/SAVE ===
  async function loadData() {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/ferramentas_dados?cliente_id=eq.${clienteId}&ferramenta_slug=eq.particularidades&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const rows = await resp.json();
      if (rows && rows.length > 0 && rows[0].dados) {
        const d = typeof rows[0].dados === 'string' ? JSON.parse(rows[0].dados) : rows[0].dados;
        particData.datas_relevantes = d.datas_relevantes || [];
        particData.historia_vida = d.historia_vida || '';
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
      // Check if record exists
      const checkResp = await fetch(`${SUPABASE_URL}/rest/v1/ferramentas_dados?cliente_id=eq.${clienteId}&ferramenta_slug=eq.particularidades&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const existing = await checkResp.json();

      const payload = {
        cliente_id: clienteId,
        ferramenta_slug: 'particularidades',
        dados: particData
      };

      let resp;
      if (existing && existing.length > 0) {
        // Update
        resp = await fetch(`${SUPABASE_URL}/rest/v1/ferramentas_dados?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ dados: particData })
        });
      } else {
        // Insert
        resp = await fetch(`${SUPABASE_URL}/rest/v1/ferramentas_dados`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
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
  // Wait for sidebar to be rendered
  const waitForSidebar = setInterval(() => {
    if (document.querySelector('.sidebar-nav')) {
      clearInterval(waitForSidebar);
      injectButton();
    }
  }, 200);

})();
