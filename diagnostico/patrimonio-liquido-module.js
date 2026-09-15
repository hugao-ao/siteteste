// =========================================
// PATRIMÔNIO LÍQUIDO - Módulo JavaScript v3
// Com classificação de risco, gráficos e distribuição ideal
// =========================================

import { supabase } from './supabase.js';

// Arrays para armazenar os patrimônios líquidos
let patrimoniosLiquidos = [];
let patrimonioLiquidoCounter = 0;
let tiposProdutos = [];
let instituicoes = [];

// Dados do teste de suitability
let respostasSuitability = {}; // { 'Nome da Pessoa': { A1: 3, A2: 4, ... } }

// =========================================
// CLASSES DE RISCO (investimentos v3)
// A fonte única de classes, liquidez, matriz e regras é diagnostico/riscos-v3.js
// (window.RiscosV3). O objeto abaixo é só uma cópia de segurança mínima, usada
// se aquele arquivo não carregar — o módulo continua funcionando em vez de
// quebrar a tela. Não edite regras aqui: edite em riscos-v3.js.
// =========================================
const RISCOS_FALLBACK = (function () {
  const ORDEM = ['RISCO_SOBERANO', 'RISCO_MUITO_BAIXO', 'RISCO_BAIXO', 'RISCO_MEDIO_BAIXO', 'RISCO_MEDIO', 'RISCO_MEDIO_ALTO', 'RISCO_ALTO', 'RISCO_MUITO_ALTO', 'RISCO_MAXIMO'];
  const CLASSES = {
    RISCO_SOBERANO: { label: 'Risco Soberano', cor: '#0b6e3a' },
    RISCO_MUITO_BAIXO: { label: 'Risco Muito Baixo', cor: '#1f8f4a' },
    RISCO_BAIXO: { label: 'Risco Baixo', cor: '#4caf50' },
    RISCO_MEDIO_BAIXO: { label: 'Risco Médio-Baixo', cor: '#9ccc65' },
    RISCO_MEDIO: { label: 'Risco Médio', cor: '#ffd54f' },
    RISCO_MEDIO_ALTO: { label: 'Risco Médio-Alto', cor: '#ffa726' },
    RISCO_ALTO: { label: 'Risco Alto', cor: '#fb8c00' },
    RISCO_MUITO_ALTO: { label: 'Risco Muito Alto', cor: '#e53935' },
    RISCO_MAXIMO: { label: 'Risco Máximo', cor: '#8e0000' }
  };
  const LEGADO = {
    RISCO_MUITO_BAIXO_GARANTIA_SOBERANA: 'RISCO_SOBERANO',
    RISCO_MUITO_BAIXO_GARANTIA_FGC: 'RISCO_MUITO_BAIXO',
    RISCO_BAIXO_GARANTIA_FGC: 'RISCO_BAIXO',
    RISCO_MEDIO_SEM_GARANTIA: 'RISCO_MEDIO',
    RISCO_ALTO_SEM_GARANTIA: 'RISCO_ALTO',
    RISCO_MUITO_ALTO_SEM_GARANTIA: 'RISCO_MUITO_ALTO',
    RISCO_ABSOLUTO_SEM_GARANTIA: 'RISCO_MAXIMO',
    RISCO_BAIXO_SEM_GARANTIA: 'RISCO_MEDIO_BAIXO',
    RISCO_ALTO_PROTECAO_MRP: 'RISCO_ALTO',
    RISCO_MUITO_ALTO_PROTECAO_MRP: 'RISCO_MUITO_ALTO'
  };
  const PROJECAO_7 = {
    RISCO_SOBERANO: 'RISCO_MUITO_BAIXO',
    RISCO_MUITO_BAIXO: 'RISCO_BAIXO',
    RISCO_BAIXO: 'RISCO_BAIXO',
    RISCO_MEDIO_BAIXO: 'RISCO_MEDIO_BAIXO',
    RISCO_MEDIO: 'RISCO_MEDIO',
    RISCO_MEDIO_ALTO: 'RISCO_MEDIO_ALTO',
    RISCO_ALTO: 'RISCO_ALTO',
    RISCO_MUITO_ALTO: 'RISCO_MUITO_ALTO',
    RISCO_MAXIMO: 'RISCO_MUITO_ALTO'
  };
  const LIQUIDEZ = {
    D0: { label: 'Mesmo dia, valor cheio' },
    D1: { label: '1 dia útil' },
    D1_MERCADO: { label: '1 dia útil, a preço de mercado' },
    ATE_D30: { label: 'Até 30 dias' },
    SO_VENCIMENTO: { label: 'Só no vencimento' },
    ILIQUIDO: { label: 'Ilíquido' }
  };
  const LIQUIDEZ_ORDEM = ['D0', 'D1', 'D1_MERCADO', 'ATE_D30', 'SO_VENCIMENTO', 'ILIQUIDO'];
  const PERFIS = [
    { id: '1', nome: 'Ultra-Conservador' },
    { id: '2', nome: 'Conservador' },
    { id: '3', nome: 'Conservador-Moderado' },
    { id: '4', nome: 'Moderado' },
    { id: '5', nome: 'Moderado-Arrojado' },
    { id: '6', nome: 'Arrojado' },
    { id: '7', nome: 'Ultra-Arrojado' }
  ];
  // Referência de planejamento por CLASSE, nunca recomendação de ativo.
  const MATRIZ = {
    RISCO_SOBERANO: [80, 55, 40, 30, 25, 18, 15],
    RISCO_MUITO_BAIXO: [20, 30, 25, 15, 15, 10, 5],
    RISCO_BAIXO: [0, 15, 20, 20, 15, 7, 0],
    RISCO_MEDIO_BAIXO: [0, 0, 10, 15, 10, 8, 5],
    RISCO_MEDIO: [0, 0, 5, 10, 10, 10, 5],
    RISCO_MEDIO_ALTO: [0, 0, 0, 10, 15, 17, 15],
    RISCO_ALTO: [0, 0, 0, 0, 10, 20, 30],
    RISCO_MUITO_ALTO: [0, 0, 0, 0, 0, 10, 20],
    RISCO_MAXIMO: [0, 0, 0, 0, 0, 0, 5]
  };
  const ANDAR_SEGURANCA = ['RISCO_SOBERANO', 'RISCO_MUITO_BAIXO'];

  function ehChaveNova(valor) {
    return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(CLASSES, valor);
  }
  function normalizarRisco(valor) {
    if (valor === null || valor === undefined) return '';
    const k = String(valor).trim().toUpperCase();
    if (!k) return '';
    if (ehChaveNova(k)) return k;
    return Object.prototype.hasOwnProperty.call(LEGADO, k) ? LEGADO[k] : '';
  }
  function ordemRisco(valor) {
    const k = normalizarRisco(valor);
    return k ? ORDEM.indexOf(k) + 1 : 0;
  }
  function rotuloRisco(valor) {
    const k = normalizarRisco(valor);
    return k ? CLASSES[k].label : 'Sem classificação';
  }
  function corRisco(valor) {
    const k = normalizarRisco(valor);
    return k ? CLASSES[k].cor : '#999';
  }
  function rotuloLiquidez(valor) {
    return valor && Object.prototype.hasOwnProperty.call(LIQUIDEZ, valor) ? LIQUIDEZ[valor].label : '';
  }
  function projetarPara7(chaveNova) {
    const k = normalizarRisco(chaveNova);
    return k ? PROJECAO_7[k] : '';
  }
  function classeDoItem(item) {
    if (!item || typeof item !== 'object') return '';
    if (item.classe_risco_origem === 'item' && ehChaveNova(item.classe_risco)) return item.classe_risco;
    if ('classe_risco' in item) {
      if (ehChaveNova(item.classe_risco)) return item.classe_risco;
      if ((item.classe_risco === null || item.classe_risco === undefined || item.classe_risco === '') && item.revisao_item === true) return '';
    }
    return normalizarRisco(item.classificacao_risco);
  }
  function elegibilidadeReserva(item) {
    const classe = classeDoItem(item);
    const ordem = ordemRisco(classe);
    if (item && item.elegivel === false) return { elegivel: false, legado: false, motivo: 'produto fora da matriz (não elegível)' };
    if (ordem === 0) return { elegivel: true, legado: true, motivo: 'classe de risco não informada' };
    if (classe === 'RISCO_SOBERANO' || classe === 'RISCO_MUITO_BAIXO') return { elegivel: true, legado: false, motivo: '' };
    if (classe === 'RISCO_BAIXO') {
      const liq = item ? item.liquidez : '';
      if (!liq) return { elegivel: true, legado: true, motivo: 'liquidez não informada' };
      if (liq === 'D0' || liq === 'D1') return { elegivel: true, legado: false, motivo: '' };
      return { elegivel: false, legado: false, motivo: 'degrau Baixo sem liquidez diária (' + (rotuloLiquidez(liq) || liq) + ')' };
    }
    return { elegivel: false, legado: false, motivo: 'degrau acima de Baixo (' + rotuloRisco(classe) + ')' };
  }
  function alocacaoIdeal(perfilId) {
    const i = Number(perfilId) - 1;
    if (!(i >= 0 && i <= 6 && Math.floor(i) === i)) return null;
    const out = {};
    ORDEM.forEach(k => { out[k] = MATRIZ[k][i]; });
    return out;
  }
  function andarSeguranca(perfilId) {
    const a = alocacaoIdeal(perfilId);
    return a ? a.RISCO_SOBERANO + a.RISCO_MUITO_BAIXO : 0;
  }
  function nomePerfil(id) {
    const p = PERFIS.find(x => x.id === String(id));
    return p ? p.nome : '';
  }

  return {
    VERSAO: 'fallback',
    CLASSES, ORDEM, LIQUIDEZ, LIQUIDEZ_ORDEM, PERFIS, MATRIZ, ANDAR_SEGURANCA,
    normalizarRisco, ehChaveNova, ordemRisco, rotuloRisco, corRisco, rotuloLiquidez,
    projetarPara7, classeDoItem, elegibilidadeReserva, alocacaoIdeal, andarSeguranca, nomePerfil
  };
})();

let _riscosV3Ref = null;
let _riscosV3Mesclado = null;
let _avisouSemRiscosV3 = false;

// Devolve window.RiscosV3 (completado pela cópia de segurança em qualquer função
// que falte) ou, se ele não existir, a cópia de segurança.
function R() {
  const r = window.RiscosV3;
  if (!r || typeof r !== 'object') {
    if (!_avisouSemRiscosV3 && window.console && console.warn) {
      console.warn('[patrimonio-liquido] window.RiscosV3 não carregado; usando cópia de segurança das classes de risco.');
      _avisouSemRiscosV3 = true;
    }
    return RISCOS_FALLBACK;
  }
  if (r !== _riscosV3Ref) {
    _riscosV3Ref = r;
    _riscosV3Mesclado = Object.assign({}, RISCOS_FALLBACK, r);
  }
  return _riscosV3Mesclado;
}

// Mapeamento de classificação de risco — agora as 9 classes de RiscosV3
// (nome mantido; label/cor/ordem vêm de riscos-v3.js).
const CLASSIFICACAO_RISCO = (function () {
  const r = R();
  const out = {};
  (r.ORDEM || []).forEach((k, i) => {
    out[k] = { label: r.rotuloRisco(k), cor: r.corRisco(k), ordem: i + 1 };
  });
  return out;
})();

// Alocação ideal por perfil de investidor (7 perfis × 9 classes) — vem de
// RiscosV3.MATRIZ (nome e formato { 1..7: { nome, alocacao } } mantidos).
// Referência de planejamento por CLASSE, nunca recomendação de ativo.
const ALOCACAO_IDEAL_POR_PERFIL = (function () {
  const r = R();
  const out = {};
  for (let id = 1; id <= 7; id++) {
    const alocacao = {};
    (r.ORDEM || []).forEach(k => {
      const coluna = r.MATRIZ && r.MATRIZ[k];
      alocacao[k] = Array.isArray(coluna) ? (Number(coluna[id - 1]) || 0) : 0;
    });
    out[id] = { nome: r.nomePerfil(String(id)), alocacao };
  }
  return out;
})();

// Escala de 7 da tela antiga (coluna classificacao_risco do catálogo e do item)
const ESCALA_ANTIGA_7 = [
  ['RISCO_MUITO_BAIXO', 'Risco Muito Baixo'],
  ['RISCO_BAIXO', 'Risco Baixo'],
  ['RISCO_MEDIO_BAIXO', 'Risco Médio-Baixo'],
  ['RISCO_MEDIO', 'Risco Médio'],
  ['RISCO_MEDIO_ALTO', 'Risco Médio-Alto'],
  ['RISCO_ALTO', 'Risco Alto'],
  ['RISCO_MUITO_ALTO', 'Risco Muito Alto']
];

// Estado da interface de "classe definida no item"
const blocosClasseAbertos = new Set();
const rascunhosClasse = {};

// Assinatura dos perfis vigentes usados no último render do comparativo
let assinaturaPerfisRender = null;

function esc(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function corTextoSobre(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const vr = parseInt(h.slice(0, 2), 16);
  const vg = parseInt(h.slice(2, 4), 16);
  const vb = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * vr + 0.587 * vg + 0.114 * vb) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}

function htmlSeloRisco(valor) {
  const r = R();
  const cor = r.corRisco(valor) || '#999';
  return `<span class="plv3-selo" style="background-color: ${esc(cor)}; color: ${corTextoSobre(cor)};">${esc(r.rotuloRisco(valor))}</span>`;
}

function recalcularMotor() {
  try {
    if (window.PerfilFinanceiro && typeof window.PerfilFinanceiro.recalcular === 'function') {
      window.PerfilFinanceiro.recalcular();
    }
  } catch (e) {
    if (window.console && console.error) console.error('[patrimonio-liquido] erro ao recalcular o perfil:', e);
  }
}

function garantirEstilosPlv3() {
  if (document.getElementById('plv3-estilos')) return;
  const style = document.createElement('style');
  style.id = 'plv3-estilos';
  style.textContent = `
    .plv3-selo { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 10px; font-size: 0.72rem; font-weight: 600; line-height: 1.3; }
    .plv3-marcador { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 8px; font-size: 0.68rem; border: 1px solid var(--border-color, #2e8b57); color: var(--text-light, #f0f8f0); margin-left: 0.3rem; line-height: 1.3; }
    .plv3-marcador-alerta { border-color: #e53935; color: #ffb3b0; }
    .plv3-liq { font-size: 0.72rem; opacity: 0.8; margin-left: 0.4rem; }
    .plv3-aviso { display: inline-block; font-size: 0.75rem; line-height: 1.35; padding: 0.25rem 0.5rem; border-radius: 6px; background: rgba(255, 215, 0, 0.12); color: var(--accent-color, #ffd700); border: 1px solid rgba(255, 215, 0, 0.35); }
    .plv3-aviso-erro { background: rgba(229, 57, 53, 0.12); color: #ffb3b0; border-color: rgba(229, 57, 53, 0.45); }
    .plv3-dica { display: block; font-size: 0.72rem; opacity: 0.75; margin-top: 0.3rem; }
    .plv3-check { display: flex; align-items: center; gap: 0.5rem; }
    .plv3-check input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
    .plv3-check label { margin: 0; cursor: pointer; }
    .plv3-classe-linha { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
    .plv3-origem { font-size: 0.75rem; opacity: 0.8; }
    .plv3-just { font-size: 0.75rem; opacity: 0.8; font-style: italic; flex-basis: 100%; overflow-wrap: anywhere; }
    .plv3-classe-bloco { margin-top: 0.6rem; padding: 0.75rem; border: 1px dashed var(--border-color, #2e8b57); border-radius: 8px; display: grid; gap: 0.5rem; }
    .plv3-classe-bloco[hidden] { display: none; }
    .plv3-classe-bloco select, .plv3-classe-bloco input { width: 100%; box-sizing: border-box; font-size: 16px; }
    .plv3-botoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .plv3-btn { min-height: 36px; padding: 0.35rem 0.8rem; border-radius: 6px; border: 1px solid var(--border-color, #2e8b57); background: transparent; color: var(--text-light, #f0f8f0); cursor: pointer; font-size: 0.8rem; }
    .plv3-btn-primario { background: var(--primary-color, #1a4d3a); color: var(--accent-color, #ffd700); }
    .plv3-reserva { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .plv3-tabela-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .plv3-tabela { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 520px; }
    .plv3-tabela th, .plv3-tabela td { padding: 0.5rem; border: 1px solid var(--border-color, #2e8b57); }
    .plv3-tabela th { background: rgba(212, 175, 55, 0.2); text-align: right; }
    .plv3-tabela th:first-child, .plv3-tabela td:first-child { text-align: left; }
    .plv3-num { text-align: right; white-space: nowrap; }
    .plv3-linha-andar td { background: rgba(255, 215, 0, 0.10); font-weight: 700; border-top: 2px solid var(--accent-color, #ffd700); }
    .plv3-linha-extra td { font-style: italic; opacity: 0.85; }
    .plv3-cor { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 0.5rem; vertical-align: middle; }
    .plv3-legenda { text-align: center; color: var(--text-light, #f0f8f0); margin: 0 0 0.75rem; font-size: 0.9rem; }
    .plv3-nota { text-align: center; font-size: 0.75rem; color: var(--text-light, #f0f8f0); opacity: 0.75; margin-top: 0.5rem; }
    .plv3-faixa { margin: 0.5rem 0 1rem; }
    /* style.css (raiz), em @media (max-width: 768px), transforma toda tabela em cartões
       (display:block e cabeçalho fora da tela). O comparativo precisa continuar tabela,
       com cabeçalho visível e rolagem horizontal dentro de .plv3-tabela-wrap. */
    @media (max-width: 768px) {
      .plv3-tabela { display: table; }
      .plv3-tabela thead { display: table-header-group; }
      .plv3-tabela tbody { display: table-row-group; }
      .plv3-tabela tr, .plv3-tabela thead tr { display: table-row; position: static; margin: 0; border: 0; border-radius: 0; background: none; }
      .plv3-tabela th, .plv3-tabela td { display: table-cell; position: static; }
      .plv3-tabela td:before { content: none; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// =========================================
// FUNÇÕES DE FORMATAÇÃO
// =========================================

function formatarMoeda(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  const numero = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.')) : valor;
  if (isNaN(numero)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero);
}

function desformatarMoeda(valorFormatado) {
  if (!valorFormatado) return 0;
  const valor = valorFormatado.toString()
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(valor) || 0;
}

function aplicarMascaraMoeda(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, '');
  
  // Se está vazio, não fazer nada
  if (valor === '') {
    return;
  }
  
  // Converter para número e formatar
  const numeroEmCentavos = parseInt(valor);
  const numeroEmReais = numeroEmCentavos / 100;
  
  input.value = formatarMoeda(numeroEmReais);
}

function limparCampoMoeda(event) {
  const input = event.target;
  if (input.value === 'R$ 0,00') {
    input.value = '';
  }
}

// =========================================
// MODAIS DE GERENCIAMENTO
// =========================================

function abrirModalGerenciarProdutos() {
  const modal = criarModal('Gerenciar Tipos de Produtos', renderListaProdutos());
  document.body.appendChild(modal);
}

function abrirModalGerenciarInstituicoes() {
  const modal = criarModal('Gerenciar Instituições Financeiras', renderListaInstituicoes());
  document.body.appendChild(modal);
}

function criarModal(titulo, conteudo) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) fecharModal(overlay); };
  
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-cog"></i> ${titulo}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        ${conteudo}
      </div>
    </div>
  `;
  
  return overlay;
}

function fecharModal(modal) {
  modal.remove();
}

function renderListaProdutos() {
  const produtosPorCategoria = {};
  tiposProdutos.forEach(produto => {
    if (!produtosPorCategoria[produto.categoria]) {
      produtosPorCategoria[produto.categoria] = [];
    }
    produtosPorCategoria[produto.categoria].push(produto);
  });
  
  garantirEstilosPlv3();
  const r = R();
  let html = '';
  if (!catalogoMigrado()) {
    html += `<div class="plv3-faixa"><span class="plv3-aviso">${esc(AVISO_CATALOGO_NAO_MIGRADO)}</span></div>`;
  }
  html += '<div class="item-list">';

  Object.keys(produtosPorCategoria).sort().forEach(categoria => {
    html += `<h4 style="color: var(--accent-color); margin: 1rem 0 0.5rem 0;">${esc(categoria)}</h4>`;
    produtosPorCategoria[categoria].forEach(produto => {
      const valorRisco = produto.classe_risco || produto.classificacao_risco;
      const liquidezTxt = r.rotuloLiquidez(produto.liquidez);
      html += `
        <div class="item-card">
          <div class="item-info">
            <div class="item-nome">${esc(produto.nome)}</div>
            <div class="item-detalhes">
              ${htmlSeloRisco(valorRisco)}
              ${liquidezTxt ? `<span class="plv3-liq">Liquidez: ${esc(liquidezTxt)}</span>` : ''}
              ${produto.elegivel === false ? '<span class="plv3-marcador plv3-marcador-alerta">fora da matriz</span>' : ''}
              ${produto.revisao_item === true ? '<span class="plv3-marcador">revisão por item</span>' : ''}
            </div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="editarProduto('${esc(produto.id)}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon delete" onclick="excluirProduto('${esc(produto.id)}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
  });
  
  html += '</div>';
  html += `
    <button class="btn-modal btn-modal-primary" onclick="abrirModalNovoProduto()">
      <i class="fas fa-plus"></i> Adicionar Novo Produto
    </button>
  `;
  
  return html;
}

function renderListaInstituicoes() {
  const instituicoesPorTipo = {};
  instituicoes.forEach(inst => {
    if (!instituicoesPorTipo[inst.tipo]) {
      instituicoesPorTipo[inst.tipo] = [];
    }
    instituicoesPorTipo[inst.tipo].push(inst);
  });
  
  let html = '<div class="item-list">';
  
  Object.keys(instituicoesPorTipo).sort().forEach(tipo => {
    html += `<h4 style="color: var(--accent-color); margin: 1rem 0 0.5rem 0;">${tipo}</h4>`;
    instituicoesPorTipo[tipo].forEach(inst => {
      html += `
        <div class="item-card">
          <div class="item-info">
            <div class="item-nome">${inst.nome}</div>
            <div class="item-detalhes">${inst.tipo}</div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="editarInstituicao('${inst.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon delete" onclick="excluirInstituicao('${inst.id}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
  });
  
  html += '</div>';
  html += `
    <button class="btn-modal btn-modal-primary" onclick="abrirModalNovaInstituicao()">
      <i class="fas fa-plus"></i> Adicionar Nova Instituição
    </button>
  `;
  
  return html;
}

function abrirModalNovoProduto() {
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome do Produto *</label>
      <input type="text" id="novo-produto-nome" class="form-control" placeholder="Ex: CDB Prefixado">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Categoria *</label>
      <select id="novo-produto-categoria" class="form-control">
        <option value="">Selecione...</option>
        <option value="Renda Fixa">Renda Fixa</option>
        <option value="Renda Variável">Renda Variável</option>
        <option value="Fundos">Fundos</option>
        <option value="Previdência">Previdência</option>
        <option value="Alternativos">Alternativos</option>
      </select>
    </div>
    ${htmlCamposRiscoProduto('novo', null)}
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarNovoProduto()">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `;
  
  const modal = criarModal('Novo Produto de Investimento', conteudo);
  document.body.appendChild(modal);
}

function abrirModalNovaInstituicao() {
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome da Instituição *</label>
      <input type="text" id="nova-instituicao-nome" class="form-control" placeholder="Ex: Banco XYZ">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Tipo *</label>
      <select id="nova-instituicao-tipo" class="form-control">
        <option value="">Selecione...</option>
        <option value="Banco">Banco</option>
        <option value="Banco Digital">Banco Digital</option>
        <option value="Banco Cooperativo">Banco Cooperativo</option>
        <option value="Corretora">Corretora</option>
        <option value="Gestora">Gestora</option>
        <option value="Previdência">Previdência</option>
        <option value="Governo">Governo</option>
        <option value="Bolsa">Bolsa</option>
        <option value="Outro">Outro</option>
      </select>
    </div>
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarNovaInstituicao()">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `;
  
  const modal = criarModal('Nova Instituição Financeira', conteudo);
  document.body.appendChild(modal);
}

async function salvarNovoProduto() {
  const nome = document.getElementById('novo-produto-nome').value.trim();
  const categoria = document.getElementById('novo-produto-categoria').value;

  if (!nome || !categoria) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }

  const campos = lerCamposRiscoProduto('novo');
  if (campos.erro) {
    alert(campos.erro);
    return;
  }

  const resultado = campos.extras
    ? await adicionarTipoProduto(nome, categoria, campos.classificacao_risco, campos.extras)
    : await adicionarTipoProduto(nome, categoria, campos.classificacao_risco);
  if (resultado) {
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarProdutos();
    renderPatrimoniosLiquidos();
  }
}

async function salvarNovaInstituicao() {
  const nome = document.getElementById('nova-instituicao-nome').value.trim();
  const tipo = document.getElementById('nova-instituicao-tipo').value;
  
  if (!nome || !tipo) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }
  
  const resultado = await adicionarInstituicao(nome, tipo);
  if (resultado) {
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarInstituicoes();
    renderPatrimoniosLiquidos();
  }
}

async function editarProduto(id) {
  const produto = tiposProdutos.find(p => String(p.id) === String(id));
  if (!produto) return;

  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();

  const CATEGORIAS = ['Renda Fixa', 'Renda Variável', 'Fundos', 'Previdência', 'Alternativos'];
  const categoriaAtual = String(produto.categoria || '');
  const categoriaConhecida = CATEGORIAS.indexOf(categoriaAtual) >= 0;

  const conteudo = `
    <div class="form-group">
      <label>Nome do Produto *</label>
      <input type="text" id="edit-produto-nome" class="form-control" value="${esc(produto.nome)}">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Categoria *</label>
      <select id="edit-produto-categoria" class="form-control">
        <option value="">Selecione...</option>
        ${categoriaAtual && !categoriaConhecida ? `<option value="${esc(categoriaAtual)}" selected>${esc(categoriaAtual)}</option>` : ''}
        ${CATEGORIAS.map(cat => `<option value="${cat}" ${categoriaAtual === cat ? 'selected' : ''}>${cat}</option>`).join('')}
      </select>
    </div>
    ${htmlCamposRiscoProduto('edit', produto)}
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarEdicaoProduto('${esc(id)}')">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
  `;
  
  const modal = criarModal('Editar Produto', conteudo);
  document.body.appendChild(modal);
}

async function salvarEdicaoProduto(id) {
  const nome = document.getElementById('edit-produto-nome').value.trim();
  const categoria = document.getElementById('edit-produto-categoria').value;

  if (!nome || !categoria) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }

  const campos = lerCamposRiscoProduto('edit');
  if (campos.erro) {
    alert(campos.erro);
    return;
  }

  // Sempre nome, categoria e a coluna antiga; as colunas novas SÓ com o
  // catálogo migrado (antes do SQL elas não existem e derrubariam o update).
  const payload = { nome, categoria, classificacao_risco: campos.classificacao_risco };
  if (campos.extras && catalogoMigrado()) {
    Object.assign(payload, normalizarExtrasProduto(campos.extras));
  }

  try {
    const { error } = await supabase
      .from('tipos_produtos_investimento')
      .update(payload)
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarTiposProdutos();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarProdutos();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    alert('Erro ao atualizar produto: ' + error.message);
  }
}

async function editarInstituicao(id) {
  const inst = instituicoes.find(i => i.id === id);
  if (!inst) return;
  
  // Fechar modal anterior
  document.querySelector('.modal-overlay')?.remove();
  
  const conteudo = `
    <div class="form-group">
      <label>Nome da Instituição *</label>
      <input type="text" id="edit-instituicao-nome" class="form-control" value="${inst.nome}">
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label>Tipo *</label>
      <select id="edit-instituicao-tipo" class="form-control">
        <option value="Banco" ${inst.tipo === 'Banco' ? 'selected' : ''}>Banco</option>
        <option value="Banco Digital" ${inst.tipo === 'Banco Digital' ? 'selected' : ''}>Banco Digital</option>
        <option value="Banco Cooperativo" ${inst.tipo === 'Banco Cooperativo' ? 'selected' : ''}>Banco Cooperativo</option>
        <option value="Corretora" ${inst.tipo === 'Corretora' ? 'selected' : ''}>Corretora</option>
        <option value="Gestora" ${inst.tipo === 'Gestora' ? 'selected' : ''}>Gestora</option>
        <option value="Previdência" ${inst.tipo === 'Previdência' ? 'selected' : ''}>Previdência</option>
        <option value="Governo" ${inst.tipo === 'Governo' ? 'selected' : ''}>Governo</option>
        <option value="Bolsa" ${inst.tipo === 'Bolsa' ? 'selected' : ''}>Bolsa</option>
        <option value="Outro" ${inst.tipo === 'Outro' ? 'selected' : ''}>Outro</option>
      </select>
    </div>
    <div class="modal-footer" style="margin-top: 1.5rem;">
      <button class="btn-modal btn-modal-secondary" onclick="this.closest('.modal-overlay').remove()">
        Cancelar
      </button>
      <button class="btn-modal btn-modal-primary" onclick="salvarEdicaoInstituicao('${id}')">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
  `;
  
  const modal = criarModal('Editar Instituição', conteudo);
  document.body.appendChild(modal);
}

async function salvarEdicaoInstituicao(id) {
  const nome = document.getElementById('edit-instituicao-nome').value.trim();
  const tipo = document.getElementById('edit-instituicao-tipo').value;
  
  if (!nome || !tipo) {
    alert('Preencha todos os campos obrigatórios!');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('instituicoes_financeiras')
      .update({ nome, tipo })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarInstituicoes();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarInstituicoes();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao atualizar instituição:', error);
    alert('Erro ao atualizar instituição: ' + error.message);
  }
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  
  try {
    const { error } = await supabase
      .from('tipos_produtos_investimento')
      .update({ ativo: false })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarTiposProdutos();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarProdutos();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    alert('Erro ao excluir produto: ' + error.message);
  }
}

async function excluirInstituicao(id) {
  if (!confirm('Tem certeza que deseja excluir esta instituição?')) return;
  
  try {
    const { error } = await supabase
      .from('instituicoes_financeiras')
      .update({ ativo: false })
      .eq('id', id);
    
    if (error) throw error;
    
    await carregarInstituicoes();
    document.querySelector('.modal-overlay')?.remove();
    abrirModalGerenciarInstituicoes();
    renderPatrimoniosLiquidos();
  } catch (error) {
    console.error('Erro ao excluir instituição:', error);
    alert('Erro ao excluir instituição: ' + error.message);
  }
}

// =========================================
// FUNÇÕES DE SUPABASE
// =========================================

// =========================================
// CATÁLOGO DE TIPOS DE PRODUTO (investimentos v3)
//
// A tela antiga (diagnostico-financeiro.html da RAIZ) ainda grava
// `classificacao_risco` na escala de 7 e não conhece as colunas novas. Por isso
// a coluna antiga é preservada e o formato novo lê `classe_risco` com fallback
// em `normalizarRisco(classificacao_risco)`.
//
// Colunas novas (depois do SQL diagnostico/sql/investimentos-v3.sql):
// classe_risco (9 chaves ou null) · liquidez · elegivel · revisao_item.
// Antes do SQL o catálogo não tem essas colunas: o modal não as envia e mostra
// um aviso; a classe do item sai de normalizarRisco(classificacao_risco).
//
// Notas de classificação (defaults do tipo; o consultor ajusta no item):
// - Fundo DI / Fundo Renda Fixa: só permanece no Baixo o fundo que entrega acima
//   do produto com FGC de liquidez equivalente; caso contrário, o consultor
//   rebaixa pelo item.
// - CRA / CRI / Debêntures: default do tipo; o rating do papel ajusta no item
//   (AAA/AA → Médio-Baixo; A → Médio; BBB → Médio-Alto).
// - COE: default Alto + revisão obrigatória por item (look-through: a embalagem
//   herda o risco do conteúdo; a 'proteção de capital' é promessa do emissor,
//   sem FGC, com prazo travado).
// =========================================

const AVISO_CATALOGO_NAO_MIGRADO = 'Classe de 9 degraus, liquidez e elegível ficam disponíveis depois de rodar o SQL investimentos-v3';

function catalogoMigrado() {
  return tiposProdutos.length > 0 && ('classe_risco' in tiposProdutos[0]);
}

function normalizarExtrasProduto(extras) {
  const r = R();
  const e = extras || {};
  const liquidez = e.liquidez && r.LIQUIDEZ && Object.prototype.hasOwnProperty.call(r.LIQUIDEZ, e.liquidez) ? e.liquidez : null;
  return {
    classe_risco: r.ehChaveNova(e.classe_risco) ? e.classe_risco : null,
    liquidez,
    elegivel: e.elegivel !== false,
    revisao_item: e.revisao_item === true
  };
}

// Campos de risco do formulário de produto (prefixo 'novo' ou 'edit').
function htmlCamposRiscoProduto(prefixo, produto) {
  garantirEstilosPlv3();
  const r = R();
  const migrado = catalogoMigrado();
  const antigaAtual = produto ? String(produto.classificacao_risco || '') : '';
  const antigaConhecida = ESCALA_ANTIGA_7.some(par => par[0] === antigaAtual);
  const opcoesAntiga =
    `<option value="">${migrado ? '— Usar a projeção da classe nova —' : 'Selecione...'}</option>` +
    (antigaAtual && !antigaConhecida ? `<option value="${esc(antigaAtual)}" selected>${esc(antigaAtual)} (valor atual)</option>` : '') +
    ESCALA_ANTIGA_7.map(par => `<option value="${par[0]}" ${antigaAtual === par[0] ? 'selected' : ''}>${par[1]}</option>`).join('');

  if (!migrado) {
    return `
    <div class="form-group" style="margin-top: 1rem;">
      <label for="${prefixo}-produto-risco">Classificação de Risco *</label>
      <select id="${prefixo}-produto-risco" class="form-control">
        ${opcoesAntiga}
      </select>
    </div>
    <div style="margin-top: 0.75rem;"><span class="plv3-aviso">${esc(AVISO_CATALOGO_NAO_MIGRADO)}</span></div>
    `;
  }

  const classeAtual = produto && r.ehChaveNova(produto.classe_risco) ? produto.classe_risco : '';
  const liquidezAtual = produto && produto.liquidez ? String(produto.liquidez) : '';
  const elegivel = produto ? produto.elegivel !== false : true;
  const revisao = produto ? produto.revisao_item === true : false;

  return `
    <div class="form-group" style="margin-top: 1rem;">
      <label for="${prefixo}-produto-classe">Classe de risco (9 degraus)</label>
      <select id="${prefixo}-produto-classe" class="form-control" onchange="plv3PreencherEscalaAntiga('${prefixo}')">
        <option value="">— Sem classe (exige classe no item) —</option>
        ${(r.ORDEM || []).map(k => `<option value="${k}" ${classeAtual === k ? 'selected' : ''}>${esc(r.rotuloRisco(k))}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label for="${prefixo}-produto-liquidez">Liquidez</label>
      <select id="${prefixo}-produto-liquidez" class="form-control">
        <option value="">— Selecione —</option>
        ${(r.LIQUIDEZ_ORDEM || []).map(k => `<option value="${k}" ${liquidezAtual === k ? 'selected' : ''}>${esc(r.rotuloLiquidez(k))}</option>`).join('')}
      </select>
    </div>
    <div class="form-group plv3-check" style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem;">
      <input type="checkbox" id="${prefixo}-produto-elegivel" ${elegivel ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
      <label for="${prefixo}-produto-elegivel" style="margin: 0; cursor: pointer;">Elegível para a matriz</label>
    </div>
    <div class="form-group plv3-check" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
      <input type="checkbox" id="${prefixo}-produto-revisao" ${revisao ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
      <label for="${prefixo}-produto-revisao" style="margin: 0; cursor: pointer;">Revisão obrigatória por item</label>
    </div>
    <div class="form-group" style="margin-top: 1rem;">
      <label for="${prefixo}-produto-risco">Classe na escala antiga (tela anterior)</label>
      <select id="${prefixo}-produto-risco" class="form-control">
        ${opcoesAntiga}
      </select>
      <small class="plv3-dica">A tela anterior só conhece 7 classes. É preenchida pela projeção da classe nova e pode ser ajustada; obrigatória quando a classe nova fica vazia.</small>
    </div>
  `;
}

// Pré-preenche a classe na escala antiga com a projeção da classe nova.
function plv3PreencherEscalaAntiga(prefixo) {
  const selClasse = document.getElementById(`${prefixo}-produto-classe`);
  const selAntiga = document.getElementById(`${prefixo}-produto-risco`);
  if (!selClasse || !selAntiga) return;
  const projecao = R().projetarPara7(selClasse.value);
  if (projecao) selAntiga.value = projecao;
}

// Lê os campos de risco do formulário. Devolve { erro } ou
// { classificacao_risco, extras } (extras null quando o catálogo não está migrado).
function lerCamposRiscoProduto(prefixo) {
  const r = R();
  const selAntiga = document.getElementById(`${prefixo}-produto-risco`);
  const selClasse = document.getElementById(`${prefixo}-produto-classe`);
  const antiga = selAntiga ? selAntiga.value : '';
  const migrado = catalogoMigrado() && !!selClasse;

  if (!migrado) {
    if (!antiga) return { erro: 'Preencha todos os campos obrigatórios!' };
    return { classificacao_risco: antiga, extras: null };
  }

  const classe = selClasse.value || '';
  const selLiquidez = document.getElementById(`${prefixo}-produto-liquidez`);
  const chkElegivel = document.getElementById(`${prefixo}-produto-elegivel`);
  const chkRevisao = document.getElementById(`${prefixo}-produto-revisao`);

  // classificacao_risco é NOT NULL no banco: vazio usa a projeção; sem classe
  // nova, a classe antiga é obrigatória.
  const classificacao = antiga || (classe ? r.projetarPara7(classe) : '');
  if (!classificacao) {
    return { erro: 'Sem classe de 9 degraus, escolha a classe na escala antiga (tela anterior).' };
  }

  return {
    classificacao_risco: classificacao,
    extras: {
      classe_risco: classe || null,
      liquidez: selLiquidez && selLiquidez.value ? selLiquidez.value : null,
      elegivel: chkElegivel ? chkElegivel.checked : true,
      revisao_item: chkRevisao ? chkRevisao.checked : false
    }
  };
}

async function carregarTiposProdutos() {
  try {
    const { data, error } = await supabase
      .from('tipos_produtos_investimento')
      .select('*')
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });

    if (error) throw error;
    tiposProdutos = data || [];
  } catch (error) {
    console.error('Erro ao carregar tipos de produtos:', error);
    tiposProdutos = [];
  }

  // Itens já carregados passam a refletir o catálogo (se migrado)
  if (patrimoniosLiquidos.length > 0) {
    if (reaplicarCatalogoNosItens()) renderGraficos();
  }
}

// Para cada item com tipo_produto encontrado no catálogo migrado e classe que
// não foi definida no item: atualiza nome do tipo, classe_risco, liquidez,
// elegivel e revisao_item. NÃO toca classificacao_risco (escala de 7 da v1).
// Devolve true se algum item mudou.
function reaplicarCatalogoNosItens() {
  if (!catalogoMigrado() || patrimoniosLiquidos.length === 0) return false;
  let mudou = false;

  patrimoniosLiquidos.forEach(pl => {
    if (!pl || pl.tipo_produto === null || pl.tipo_produto === undefined || pl.tipo_produto === '') return;
    if (pl.classe_risco_origem === 'item') return;
    const produto = tiposProdutos.find(p => String(p.id) === String(pl.tipo_produto));
    if (!produto) return;

    const novo = {
      tipo_produto_nome: produto.nome,
      classe_risco: produto.classe_risco || null,
      liquidez: produto.liquidez || null,
      elegivel: produto.elegivel !== false,
      revisao_item: produto.revisao_item === true,
      classe_risco_origem: 'catalogo'
    };
    Object.keys(novo).forEach(k => {
      if (pl[k] !== novo[k]) {
        pl[k] = novo[k];
        mudou = true;
      }
    });
  });

  recalcularMotor();
  return mudou;
}

async function carregarInstituicoes() {
  try {
    const { data, error } = await supabase
      .from('instituicoes_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true });
    
    if (error) throw error;
    instituicoes = data || [];
  } catch (error) {
    console.error('Erro ao carregar instituições:', error);
    instituicoes = [];
  }
}

// extras (opcional): { classe_risco, liquidez, elegivel, revisao_item } —
// enviados SÓ se o catálogo estiver migrado.
async function adicionarTipoProduto(nome, categoria, classificacaoRisco, extras) {
  try {
    const linha = { nome, categoria, classificacao_risco: classificacaoRisco };
    if (extras && typeof extras === 'object' && catalogoMigrado()) {
      Object.assign(linha, normalizarExtrasProduto(extras));
    }
    const { data, error } = await supabase
      .from('tipos_produtos_investimento')
      .insert([linha])
      .select();
    
    if (error) throw error;
    await carregarTiposProdutos();
    return data[0];
  } catch (error) {
    console.error('Erro ao adicionar tipo de produto:', error);
    alert('Erro ao adicionar tipo de produto: ' + error.message);
    return null;
  }
}

async function adicionarInstituicao(nome, tipo) {
  try {
    const { data, error } = await supabase
      .from('instituicoes_financeiras')
      .insert([{ nome, tipo }])
      .select();
    
    if (error) throw error;
    await carregarInstituicoes();
    return data[0];
  } catch (error) {
    console.error('Erro ao adicionar instituição:', error);
    alert('Erro ao adicionar instituição: ' + error.message);
    return null;
  }
}

// =========================================
// FUNÇÕES DE GERENCIAMENTO
// =========================================

function addPatrimonioLiquido() {
  const id = ++patrimonioLiquidoCounter;
  
  const patrimonioLiquido = {
    id: id,
    valor_atual: 0,
    tipo_produto: null,
    tipo_produto_nome: '',
    nome_produto_customizado: '',
    classificacao_risco: '',
    instituicao: null,
    instituicao_nome: '',
    finalidade: 'SEM_FINALIDADE',
    aporte_valor: 0,
    aporte_frequencia: 'NENHUM',
    taxa_administracao: 0,
    rentabilidade_esperada: 0,
    donos: [],
    inventariavel: true,
    // v2 (Perfil Financeiro): faz parte da reserva de emergência?
    reserva_emergencia: false,
    // v3 (investimentos): classe de 9 degraus, liquidez e elegibilidade
    classe_risco: null,
    classe_risco_origem: '',
    classe_risco_justificativa: '',
    liquidez: null,
    elegivel: true,
    revisao_item: false
  };
  
  patrimoniosLiquidos.push(patrimonioLiquido);
  renderPatrimoniosLiquidos();
}

function deletePatrimonioLiquido(id) {
  if (!confirm('Tem certeza que deseja excluir este investimento?')) return;
  
  patrimoniosLiquidos = patrimoniosLiquidos.filter(p => p.id !== id);
  renderPatrimoniosLiquidos();
  updatePatrimonioLiquidoTotal();
  renderGraficos();
  renderTesteSuitability();
}

function updatePatrimonioLiquidoField(id, field, value) {
  const patrimonioLiquido = patrimoniosLiquidos.find(p => p.id === id);
  if (!patrimonioLiquido) return;
  
  if (field === 'valor_atual' || field === 'aporte_valor') {
    patrimonioLiquido[field] = desformatarMoeda(value);
  } else if (field === 'taxa_administracao' || field === 'rentabilidade_esperada') {
    patrimonioLiquido[field] = parseFloat(value) || 0;
  } else if (field === 'tipo_produto') {
    const produto = tiposProdutos.find(p => String(p.id) === String(value));
    if (produto) {
      patrimonioLiquido.tipo_produto = produto.id;
      patrimonioLiquido.tipo_produto_nome = produto.nome;
      patrimonioLiquido.classificacao_risco = produto.classificacao_risco;
      // Trocar o tipo apaga a classe definida no item (volta a herdar)
      patrimonioLiquido.classe_risco_justificativa = '';
      if (catalogoMigrado()) {
        patrimonioLiquido.classe_risco = produto.classe_risco || null;
        patrimonioLiquido.liquidez = produto.liquidez || null;
        patrimonioLiquido.elegivel = produto.elegivel !== false;
        patrimonioLiquido.revisao_item = produto.revisao_item === true;
        patrimonioLiquido.classe_risco_origem = 'catalogo';
      } else {
        patrimonioLiquido.classe_risco = null;
        patrimonioLiquido.classe_risco_origem = '';
      }
      blocosClasseAbertos.delete(String(id));
      delete rascunhosClasse[String(id)];
    }
    renderPatrimoniosLiquidos();
  } else if (field === 'instituicao') {
    const inst = instituicoes.find(i => i.id === value);
    if (inst) {
      patrimonioLiquido.instituicao = inst.id;
      patrimonioLiquido.instituicao_nome = inst.nome;
    }
  } else if (field === 'donos') {
    const select = document.querySelector(`[data-patrimonio-liquido-id="${id}"] select[name="donos"]`);
    patrimonioLiquido.donos = Array.from(select.selectedOptions).map(opt => opt.value);
  } else if (field === 'inventariavel') {
    patrimonioLiquido.inventariavel = value === true || value === 'true';
    // Atualizar seção de sucessão se existir
    if (window.atualizarSecaoSucessao) window.atualizarSecaoSucessao();
  } else if (field === 'reserva_emergencia') {
    // v2 (Perfil Financeiro): checkbox booleano (tolera 'true' em string)
    patrimonioLiquido.reserva_emergencia = value === true || value === 'true';
    atualizarAvisoReserva(id);
  } else {
    patrimonioLiquido[field] = value;
  }
  
  updatePatrimonioLiquidoTotal();
  renderGraficos();
  renderTesteSuitability();
}

function updatePatrimonioLiquidoTotal() {
  const total = patrimoniosLiquidos.reduce((sum, p) => sum + (parseFloat(p.valor_atual) || 0), 0);
  const totalElement = document.getElementById('patrimonio-liquido-total');
  if (totalElement) {
    totalElement.textContent = `Total: ${formatarMoeda(total)}`;
  }
}

function getPessoasCasa() {
  const pessoas = [];
  
  // Titular (nome aparado: é a mesma chave que o motor e o teste novo usam em por_pessoa)
  const nomeTitular = (document.getElementById('nome_diagnostico')?.value || '').trim();
  if (nomeTitular) {
    pessoas.push({ id: 'titular', nome: nomeTitular });
  }

  // Cônjuge
  const nomeConjuge = (document.getElementById('conjuge_nome')?.value || '').trim();
  if (nomeConjuge) {
    pessoas.push({ id: 'conjuge', nome: nomeConjuge });
  }
  
  // Outras pessoas com renda - buscar do DOM
  const pessoasContainer = document.getElementById('pessoas-renda-container');
  if (pessoasContainer) {
    const inputsNomePessoas = pessoasContainer.querySelectorAll('input[id$="_nome"]');
    inputsNomePessoas.forEach((input, index) => {
      const nome = input.value?.trim();
      if (nome) {
        pessoas.push({ id: `pessoa_${index}`, nome: nome });
      }
    });
    
    // Cônjuges das outras pessoas
    const inputsConjugePessoas = pessoasContainer.querySelectorAll('input[id$="_conjuge_nome"]');
    inputsConjugePessoas.forEach((input, index) => {
      const nome = input.value?.trim();
      if (nome) {
        pessoas.push({ id: `pessoa_conjuge_${index}`, nome: nome });
      }
    });
  }
  
  // Dependentes - buscar do DOM
  const dependentesContainer = document.getElementById('dependentes-container');
  if (dependentesContainer) {
    const inputsNomeDependentes = dependentesContainer.querySelectorAll('input[id$="_nome"]');
    inputsNomeDependentes.forEach((input, index) => {
      const nome = input.value?.trim();
      if (nome) {
        pessoas.push({ id: `dependente_${index}`, nome: nome });
      }
    });
  }
  
  // Remover duplicatas baseado no nome
  const pessoasUnicas = [];
  const nomesVistos = new Set();
  
  pessoas.forEach(pessoa => {
    if (!nomesVistos.has(pessoa.nome)) {
      nomesVistos.add(pessoa.nome);
      pessoasUnicas.push(pessoa);
    }
  });
  
  return pessoasUnicas;
}

function getFinalidadeLabel(finalidade) {
  const labels = {
    'SEM_FINALIDADE': 'Sem Finalidade Específica',
    'RESERVA_EMERGENCIA': 'Reserva de Emergência',
    'RESERVA_OBJETIVOS': 'Reserva para Objetivos',
    'APOSENTADORIA': 'Aposentadoria'
  };
  return labels[finalidade] || finalidade;
}

function getFinalidadeBadgeClass(finalidade) {
  const classes = {
    'SEM_FINALIDADE': 'badge-sem-finalidade',
    'RESERVA_EMERGENCIA': 'badge-reserva-emergencia',
    'RESERVA_OBJETIVOS': 'badge-reserva-objetivos',
    'APOSENTADORIA': 'badge-aposentadoria'
  };
  return classes[finalidade] || 'badge-sem-finalidade';
}

// Nome mantido; agora delega a RiscosV3 (lê qualquer vocabulário, só na leitura).
function getRiscoInfo(classificacao) {
  const r = R();
  const chave = r.normalizarRisco(classificacao);
  if (!chave) {
    return { label: 'Não classificado', cor: '#999', ordem: 99 };
  }
  return { label: r.rotuloRisco(chave), cor: r.corRisco(chave), ordem: r.ordemRisco(chave), chave };
}

// =========================================
// CLASSE DE RISCO NO ITEM (override do consultor)
// Look-through: a embalagem herda o risco do conteúdo. Produto genérico
// (revisao_item sem classe) exige classe no item; COE (revisao_item com classe)
// pede confirmação da classe do papel. Sempre com justificativa.
// =========================================

function acharItem(id) {
  return patrimoniosLiquidos.find(p => String(p.id) === String(id));
}

// Mesma regra de ehReserva do motor (perfil-financeiro.js): o boolean do checkbox
// vale quando existe; a finalidade só decide em item antigo sem o boolean.
function itemMarcadoComoReserva(pl) {
  if (!pl) return false;
  return typeof pl.reserva_emergencia === 'boolean'
    ? pl.reserva_emergencia
    : pl.finalidade === 'RESERVA_EMERGENCIA';
}

function htmlAvisoReserva(pl) {
  if (!itemMarcadoComoReserva(pl)) return '';
  let info = null;
  try { info = R().elegibilidadeReserva(pl); } catch (e) { info = null; }
  if (!info) return '';
  if (info.elegivel === false) {
    return `<span class="plv3-aviso plv3-aviso-erro">não conta como reserva: ${esc(info.motivo)}</span>`;
  }
  if (info.legado) {
    return '<span class="plv3-aviso">conta como reserva (confirme a liquidez/classe)</span>';
  }
  return '';
}

function atualizarAvisoReserva(id) {
  const alvo = document.getElementById(`plv3-reserva-aviso-${id}`);
  const pl = acharItem(id);
  if (alvo && pl) alvo.innerHTML = htmlAvisoReserva(pl);
}

function htmlClasseDoItem(pl) {
  const r = R();
  const idTxt = String(pl.id);
  const classe = r.classeDoItem(pl);
  const definidaNoItem = pl.classe_risco_origem === 'item' && r.ehChaveNova(pl.classe_risco);
  const liquidezTxt = r.rotuloLiquidez(pl.liquidez);
  const aberto = blocosClasseAbertos.has(idTxt);
  const rascunho = rascunhosClasse[idTxt] || null;
  const classeSelecionada = rascunho ? rascunho.classe : classe;
  const justificativa = rascunho ? rascunho.just : (definidaNoItem ? (pl.classe_risco_justificativa || '') : '');

  let avisoRevisao = '';
  if (pl.revisao_item === true && !definidaNoItem) {
    avisoRevisao = classe ? 'COE: confirme a classe deste papel' : 'Classifique o risco deste item';
  }

  return `
        <div class="form-group full-width">
          <div class="plv3-classe-linha">
            <span><i class="fas fa-shield-alt"></i> Classe de risco:</span>
            ${htmlSeloRisco(classe)}
            ${classe ? `<span class="plv3-origem">(${definidaNoItem ? 'definida no item' : 'do catálogo'})</span>` : ''}
            ${liquidezTxt ? `<span class="plv3-liq">Liquidez: ${esc(liquidezTxt)}</span>` : ''}
            ${pl.elegivel === false ? '<span class="plv3-marcador plv3-marcador-alerta">Fora da matriz</span>' : ''}
            ${avisoRevisao ? `<span class="plv3-aviso">${esc(avisoRevisao)}</span>` : ''}
            <button type="button" class="plv3-btn" onclick="plv3AlternarClasseItem('${esc(idTxt)}')">
              ${avisoRevisao && classe ? 'Confirmar classe neste item' : 'Definir classe neste item'}
            </button>
            ${definidaNoItem ? `<button type="button" class="plv3-btn" onclick="plv3VoltarClasseCatalogo('${esc(idTxt)}')">Voltar à classe do catálogo</button>` : ''}
            ${definidaNoItem && pl.classe_risco_justificativa ? `<span class="plv3-just">Justificativa: ${esc(pl.classe_risco_justificativa)}</span>` : ''}
          </div>
          <div class="plv3-classe-bloco" id="plv3-classe-bloco-${esc(idTxt)}" ${aberto ? '' : 'hidden'}>
            <label for="plv3-classe-sel-${esc(idTxt)}">Classe de risco deste item</label>
            <select id="plv3-classe-sel-${esc(idTxt)}" onchange="plv3RascunhoClasse('${esc(idTxt)}')">
              <option value="">— Selecione a classe —</option>
              ${(r.ORDEM || []).map(k => `<option value="${k}" ${classeSelecionada === k ? 'selected' : ''}>${esc(r.rotuloRisco(k))}</option>`).join('')}
            </select>
            <label for="plv3-classe-just-${esc(idTxt)}">Justificativa (obrigatória)</label>
            <input type="text" id="plv3-classe-just-${esc(idTxt)}" maxlength="240"
              value="${esc(justificativa)}"
              placeholder="Ex.: rating do emissor, conteúdo do papel, prazo travado"
              oninput="plv3RascunhoClasse('${esc(idTxt)}')">
            <div class="plv3-botoes">
              <button type="button" class="plv3-btn plv3-btn-primario" onclick="plv3AplicarClasseItem('${esc(idTxt)}')">Aplicar</button>
              <button type="button" class="plv3-btn" onclick="plv3AlternarClasseItem('${esc(idTxt)}')">Cancelar</button>
            </div>
          </div>
        </div>
  `;
}

function plv3AlternarClasseItem(id) {
  const idTxt = String(id);
  const bloco = document.getElementById(`plv3-classe-bloco-${idTxt}`);
  if (blocosClasseAbertos.has(idTxt)) {
    blocosClasseAbertos.delete(idTxt);
    delete rascunhosClasse[idTxt];
    if (bloco) bloco.hidden = true;
  } else {
    blocosClasseAbertos.add(idTxt);
    if (bloco) {
      bloco.hidden = false;
      const sel = document.getElementById(`plv3-classe-sel-${idTxt}`);
      if (sel) sel.focus();
    }
  }
}

function plv3RascunhoClasse(id) {
  const idTxt = String(id);
  const sel = document.getElementById(`plv3-classe-sel-${idTxt}`);
  const just = document.getElementById(`plv3-classe-just-${idTxt}`);
  rascunhosClasse[idTxt] = { classe: sel ? sel.value : '', just: just ? just.value : '' };
}

function plv3AplicarClasseItem(id) {
  const pl = acharItem(id);
  if (!pl) return;
  const r = R();
  const idTxt = String(id);
  const sel = document.getElementById(`plv3-classe-sel-${idTxt}`);
  const just = document.getElementById(`plv3-classe-just-${idTxt}`);
  const classe = sel ? sel.value : '';
  const texto = just ? just.value.trim() : '';

  if (!r.ehChaveNova(classe)) {
    alert('Escolha a classe de risco deste item.');
    return;
  }
  if (!texto) {
    alert('Escreva a justificativa da classe definida neste item.');
    return;
  }

  pl.classe_risco = classe;
  pl.classe_risco_origem = 'item';
  pl.classe_risco_justificativa = texto;
  // a tela antiga passa a ver a projeção na escala de 7
  pl.classificacao_risco = r.projetarPara7(classe);

  blocosClasseAbertos.delete(idTxt);
  delete rascunhosClasse[idTxt];
  renderPatrimoniosLiquidos();
  renderGraficos();
  recalcularMotor();
}

function plv3VoltarClasseCatalogo(id) {
  const pl = acharItem(id);
  if (!pl) return;
  const idTxt = String(id);
  const produto = tiposProdutos.find(p => String(p.id) === String(pl.tipo_produto));

  pl.classe_risco_justificativa = '';
  if (produto) {
    pl.classe_risco_origem = 'catalogo';
    pl.tipo_produto_nome = produto.nome;
    pl.classificacao_risco = produto.classificacao_risco;
    if (catalogoMigrado()) {
      pl.classe_risco = produto.classe_risco || null;
      pl.liquidez = produto.liquidez || null;
      pl.elegivel = produto.elegivel !== false;
      pl.revisao_item = produto.revisao_item === true;
    } else {
      pl.classe_risco = null;
    }
  } else {
    // item sem tipo no catálogo (ex.: importado): volta a ler a coluna antiga
    pl.classe_risco = null;
    pl.classe_risco_origem = '';
  }

  blocosClasseAbertos.delete(idTxt);
  delete rascunhosClasse[idTxt];
  renderPatrimoniosLiquidos();
  renderGraficos();
  recalcularMotor();
}

// =========================================
// RENDERIZAÇÃO
// =========================================

function renderPatrimoniosLiquidos() {
  const container = document.getElementById('patrimonios-liquidos-container');
  if (!container) return;
  
  if (patrimoniosLiquidos.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-light); opacity: 0.7;">
        <i class="fas fa-wallet" style="font-size: 3rem; color: var(--secondary-color); opacity: 0.5; margin-bottom: 1rem;"></i>
        <p>Nenhum investimento cadastrado ainda.</p>
        <p style="font-size: 0.9rem;">Clique em "Adicionar Investimento" para começar.</p>
      </div>
    `;
    return;
  }
  
  const pessoasCasa = getPessoasCasa();
  
  // Agrupar tipos de produtos por categoria
  const produtosPorCategoria = {};
  tiposProdutos.forEach(produto => {
    if (!produtosPorCategoria[produto.categoria]) {
      produtosPorCategoria[produto.categoria] = [];
    }
    produtosPorCategoria[produto.categoria].push(produto);
  });
  
  // Agrupar instituições por tipo
  const instituicoesPorTipo = {};
  instituicoes.forEach(inst => {
    if (!instituicoesPorTipo[inst.tipo]) {
      instituicoesPorTipo[inst.tipo] = [];
    }
    instituicoesPorTipo[inst.tipo].push(inst);
  });
  
  garantirEstilosPlv3();
  const riscos = R();

  container.innerHTML = patrimoniosLiquidos.map(pl => {
    const classeItem = riscos.classeDoItem(pl);
    const corClasse = riscos.corRisco(classeItem);

    return `
    <div class="patrimonio-liquido-card" data-patrimonio-liquido-id="${pl.id}" style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid var(--border-color);">
      <div class="patrimonio-liquido-header">
        <h4 class="patrimonio-liquido-title">
          <i class="fas fa-chart-line"></i> Investimento #${pl.id}
          <span class="badge-finalidade ${getFinalidadeBadgeClass(pl.finalidade)}">
            ${getFinalidadeLabel(pl.finalidade)}
          </span>
          ${(classeItem || pl.tipo_produto || pl.classificacao_risco) ? `
            <span class="badge-risco" style="background-color: ${esc(corClasse)}; color: ${corTextoSobre(corClasse)}; padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.75rem; margin-left: 0.5rem;">
              ${esc(riscos.rotuloRisco(classeItem))}
            </span>
          ` : ''}
        </h4>
        <div class="patrimonio-liquido-actions">
          <button type="button" class="delete-btn" onclick="deletePatrimonioLiquido(${pl.id})" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      <div class="form-grid">
        <div class="form-group">
          <label>
            <i class="fas fa-dollar-sign"></i> Valor Atual *
          </label>
          <input 
            type="text" 
            class="input-moeda" 
            value="${formatarMoeda(pl.valor_atual)}"
            data-pl-id="${pl.id}"
            data-field="valor_atual"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-chart-pie"></i> Tipo de Produto *
            <button type="button" class="btn-gerenciar" onclick="abrirModalGerenciarProdutos()">
              <i class="fas fa-cog"></i> Gerenciar
            </button>
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'tipo_produto', this.value)">
            <option value="">Selecione o tipo</option>
            ${Object.keys(produtosPorCategoria).map(categoria => `
              <optgroup label="${esc(categoria)}">
                ${produtosPorCategoria[categoria].map(produto => `
                  <option value="${esc(produto.id)}" ${String(pl.tipo_produto) === String(produto.id) ? 'selected' : ''}>
                    ${esc(produto.nome)}
                  </option>
                `).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>

        ${htmlClasseDoItem(pl)}
        
        <div class="form-group">
          <label>
            <i class="fas fa-tag"></i> Nome do Produto (opcional)
          </label>
          <input 
            type="text" 
            placeholder="Ex: CDB XYZ 2025, Tesouro Selic 2027, etc."
            value="${esc(pl.nome_produto_customizado || '')}"
            onchange="updatePatrimonioLiquidoField(${pl.id}, 'nome_produto_customizado', this.value)"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-building"></i> Instituição *
            <button type="button" class="btn-gerenciar" onclick="abrirModalGerenciarInstituicoes()">
              <i class="fas fa-cog"></i> Gerenciar
            </button>
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'instituicao', this.value)">
            <option value="">Selecione a instituição</option>
            ${Object.keys(instituicoesPorTipo).map(tipo => `
              <optgroup label="${esc(tipo)}">
                ${instituicoesPorTipo[tipo].map(inst => `
                  <option value="${esc(inst.id)}" ${pl.instituicao === inst.id ? 'selected' : ''}>
                    ${esc(inst.nome)}
                  </option>
                `).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-bullseye"></i> Finalidade
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'finalidade', this.value); renderPatrimoniosLiquidos();">
            <option value="SEM_FINALIDADE" ${pl.finalidade === 'SEM_FINALIDADE' ? 'selected' : ''}>Sem Finalidade Específica</option>
            <option value="RESERVA_EMERGENCIA" ${pl.finalidade === 'RESERVA_EMERGENCIA' ? 'selected' : ''}>Reserva de Emergência</option>
            <option value="RESERVA_OBJETIVOS" ${pl.finalidade === 'RESERVA_OBJETIVOS' ? 'selected' : ''}>Reserva para Objetivos</option>
            <option value="APOSENTADORIA" ${pl.finalidade === 'APOSENTADORIA' ? 'selected' : ''}>Aposentadoria</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-arrow-up"></i> Valor do Aporte
          </label>
          <input 
            type="text" 
            class="input-moeda" 
            value="${formatarMoeda(pl.aporte_valor)}"
            data-pl-id="${pl.id}"
            data-field="aporte_valor"
          />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-calendar"></i> Frequência do Aporte
          </label>
          <select onchange="updatePatrimonioLiquidoField(${pl.id}, 'aporte_frequencia', this.value)">
            <option value="NENHUM" ${pl.aporte_frequencia === 'NENHUM' ? 'selected' : ''}>Nenhum</option>
            <option value="MENSAL" ${pl.aporte_frequencia === 'MENSAL' ? 'selected' : ''}>Mensal</option>
            <option value="ANUAL" ${pl.aporte_frequencia === 'ANUAL' ? 'selected' : ''}>Anual</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-percentage"></i> Taxa de Administração (% a.a.)
          </label>
          <input type="number" step="0.01" min="0" max="10"
            value="${pl.taxa_administracao || 0}"
            onchange="updatePatrimonioLiquidoField(${pl.id}, 'taxa_administracao', this.value)"
            placeholder="0.00">
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-chart-line"></i> Rentabilidade Esperada (% a.a.)
          </label>
          <input type="number" step="0.01" min="-50" max="100"
            value="${pl.rentabilidade_esperada || 0}"
            onchange="updatePatrimonioLiquidoField(${pl.id}, 'rentabilidade_esperada', this.value)"
            placeholder="0.00">
        </div>
        
        <div class="form-group full-width">
          <label>
            <i class="fas fa-users"></i> Dono(s) 
            <span style="font-size: 0.75rem; font-weight: normal; opacity: 0.8;">(Segure Ctrl/Cmd para selecionar múltiplos)</span>
          </label>
          <select 
            name="donos"
            multiple 
            style="min-height: 80px;"
            onchange="updatePatrimonioLiquidoField(${pl.id}, 'donos', this.value)"
          >
            ${pessoasCasa.map(pessoa => `
              <option value="${esc(pessoa.nome)}" ${(Array.isArray(pl.donos) ? pl.donos : []).some(d => String(d).trim() === pessoa.nome) ? 'selected' : ''}>
                ${esc(pessoa.nome)}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" 
                 id="pl_${pl.id}_inventariavel" 
                 ${pl.inventariavel !== false ? 'checked' : ''}
                 onchange="updatePatrimonioLiquidoField(${pl.id}, 'inventariavel', this.checked)"
                 style="width: 18px; height: 18px; cursor: pointer;">
          <label for="pl_${pl.id}_inventariavel" style="cursor: pointer; margin: 0;">
            <i class="fas fa-gavel"></i> Inventariável
          </label>
        </div>

        <!-- Reserva de emergência (Perfil Financeiro v2) -->
        <div class="form-group plv3-reserva" style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;">
          <input type="checkbox"
                 id="pl_${pl.id}_reserva_emergencia"
                 ${pl.reserva_emergencia ? 'checked' : ''}
                 onchange="updatePatrimonioLiquidoField(${pl.id}, 'reserva_emergencia', this.checked)"
                 style="width: 18px; height: 18px; cursor: pointer;">
          <label for="pl_${pl.id}_reserva_emergencia" style="cursor: pointer; margin: 0;">
            <i class="fas fa-life-ring"></i> Faz parte da reserva de emergência
          </label>
          <span id="plv3-reserva-aviso-${pl.id}">${htmlAvisoReserva(pl)}</span>
        </div>
      </div>
    </div>
  `;
  }).join('');
  
  // Aplicar event listeners para máscaras de moeda
  container.querySelectorAll('.input-moeda').forEach(input => {
    input.addEventListener('input', aplicarMascaraMoeda);
    input.addEventListener('focus', limparCampoMoeda);
    input.addEventListener('blur', function() {
      const plId = parseInt(this.dataset.plId);
      const field = this.dataset.field;
      updatePatrimonioLiquidoField(plId, field, this.value);
    });
  });
  
  updatePatrimonioLiquidoTotal();
}

// =========================================
// TESTE DE SUITABILITY
// =========================================

const QUESTOES_SUITABILITY = [
  // SEÇÃO A: HORIZONTE TEMPORAL
  {
    id: 'A1',
    secao: 'A',
    texto: 'Em quanto tempo você pretende parar de trabalhar?',
    alternativas: [
      { valor: 1, texto: 'Faltam 10 anos ou menos' },
      { valor: 2, texto: 'Faltam entre 10 e 15 anos' },
      { valor: 3, texto: 'Faltam entre 15 e 20 anos' },
      { valor: 4, texto: 'Faltam entre 20 e 30 anos' },
      { valor: 5, texto: 'Faltam mais de 30 anos' }
    ]
  },
  {
    id: 'A2',
    secao: 'A',
    texto: 'Por quanto tempo você conseguiria deixar a maior parte do patrimônio aplicado?',
    alternativas: [
      { valor: 1, texto: 'Menos de 1 ano' },
      { valor: 2, texto: 'Entre 1 e 3 anos' },
      { valor: 3, texto: 'Entre 3 e 10 anos' },
      { valor: 4, texto: 'Entre 10 e 20 anos' },
      { valor: 5, texto: 'Mais de 20 anos' }
    ]
  },
  {
    id: 'A3',
    secao: 'A',
    texto: 'Quanto tempo teria para esperar recuperação em cenário ruim?',
    alternativas: [
      { valor: 1, texto: 'Nenhum - precisaria resgatar' },
      { valor: 2, texto: 'Até 2 anos' },
      { valor: 3, texto: 'Entre 2 e 5 anos' },
      { valor: 4, texto: 'Entre 5 e 10 anos' },
      { valor: 5, texto: 'Mais de 10 anos' }
    ]
  },
  
  // SEÇÃO B: TOLERÂNCIA AO RISCO
  {
    id: 'B1',
    secao: 'B',
    texto: 'Como reagiria se investimentos perdessem 20% em um mês?',
    alternativas: [
      { valor: 1, texto: 'Resgataria tudo imediatamente' },
      { valor: 2, texto: 'Consideraria resgatar parte' },
      { valor: 3, texto: 'Aguardaria a recuperação' },
      { valor: 4, texto: 'Ficaria tranquilo' },
      { valor: 5, texto: 'Compraria mais com desconto' }
    ]
  },
  {
    id: 'B2',
    secao: 'B',
    texto: 'Qual sua atitude em relação a risco e retorno?',
    alternativas: [
      { valor: 1, texto: 'Não aceito risco algum' },
      { valor: 2, texto: 'Aceito risco mínimo' },
      { valor: 3, texto: 'Aceito risco moderado' },
      { valor: 4, texto: 'Aceito risco alto' },
      { valor: 5, texto: 'Aceito risco muito alto' }
    ]
  },
  {
    id: 'B3',
    secao: 'B',
    texto: 'Qual perda temporária conseguiria suportar?',
    alternativas: [
      { valor: 1, texto: 'Nenhuma perda' },
      { valor: 2, texto: 'Até 5%' },
      { valor: 3, texto: 'Até 10%' },
      { valor: 4, texto: 'Até 20%' },
      { valor: 5, texto: 'Mais de 20%' }
    ]
  },
  
  // SEÇÃO C: CONHECIMENTO
  {
    id: 'C1',
    secao: 'C',
    texto: 'Qual seu nível de conhecimento sobre investimentos?',
    alternativas: [
      { valor: 1, texto: 'Nenhum' },
      { valor: 2, texto: 'Básico' },
      { valor: 3, texto: 'Intermediário' },
      { valor: 4, texto: 'Avançado' },
      { valor: 5, texto: 'Especialista' }
    ]
  },
  {
    id: 'C2',
    secao: 'C',
    texto: 'Há quanto tempo investe no mercado financeiro?',
    alternativas: [
      { valor: 1, texto: 'Nunca investi' },
      { valor: 2, texto: 'Menos de 2 anos' },
      { valor: 3, texto: 'Entre 2 e 5 anos' },
      { valor: 4, texto: 'Entre 5 e 10 anos' },
      { valor: 5, texto: 'Mais de 10 anos' }
    ]
  },
  {
    id: 'C3',
    secao: 'C',
    texto: 'Já investiu em renda variável?',
    alternativas: [
      { valor: 1, texto: 'Não, nunca' },
      { valor: 2, texto: 'Não, mas tenho interesse' },
      { valor: 3, texto: 'Sim, valores pequenos' },
      { valor: 4, texto: 'Sim, regularmente' },
      { valor: 5, texto: 'Sim, significativamente' }
    ]
  }
];

const PERFIS_INVESTIDOR = [
  { id: 1, nome: 'Ultra-Conservador', pfpMin: 0, pfpMax: 16.67, cor: '#006400' },
  { id: 2, nome: 'Conservador', pfpMin: 16.68, pfpMax: 33.33, cor: '#228B22' },
  { id: 3, nome: 'Conservador-Moderado', pfpMin: 33.34, pfpMax: 50.00, cor: '#90EE90' },
  { id: 4, nome: 'Moderado', pfpMin: 50.01, pfpMax: 66.67, cor: '#FFD700' },
  { id: 5, nome: 'Moderado-Arrojado', pfpMin: 66.68, pfpMax: 83.33, cor: '#FFA500' },
  { id: 6, nome: 'Arrojado', pfpMin: 83.34, pfpMax: 91.67, cor: '#FF6347' },
  { id: 7, nome: 'Ultra-Arrojado', pfpMin: 91.68, pfpMax: 100, cor: '#DC143C' }
];

function calcularPerfilInvestidor(respostas) {
  if (!respostas) return null;
  
  const questoesObrigatorias = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
  for (const q of questoesObrigatorias) {
    if (!respostas[q] || respostas[q] === 0) {
      return null;
    }
  }
  
  const PA = respostas.A1 + respostas.A2 + respostas.A3;
  const PB = respostas.B1 + respostas.B2 + respostas.B3;
  const PC = respostas.C1 + respostas.C2 + respostas.C3;
  
  const PAN = ((PA - 3) / 12) * 100;
  const PBN = ((PB - 3) / 12) * 100;
  const PCN = ((PC - 3) / 12) * 100;
  
  let PFP = (PAN * 0.25) + (PBN * 0.50) + (PCN * 0.25);
  
  // Garantir que PFP esteja entre 0 e 100
  PFP = Math.max(0, Math.min(100, PFP));
  
  // Encontrar o perfil correspondente.
  //
  // As faixas terminam em 16,67 e a seguinte começa em 16,68, então sobravam
  // buracos entre elas. Somas iguais em A, B e C caem exatamente nesses
  // buracos: PA=PB=PC=7 dá PFP 33,3333, que não casava com nenhuma faixa.
  // O fallback então escolhia o ÚLTIMO perfil — Ultra-Arrojado. Um investidor
  // de respostas medianas era classificado como o mais agressivo da escala,
  // e a alocação ideal saía junto.
  //
  // Comparar só com o teto elimina os buracos e preserva os mesmos cortes.
  let perfil = PERFIS_INVESTIDOR.find(p => PFP <= p.pfpMax);

  if (!perfil) {
    perfil = PERFIS_INVESTIDOR[PERFIS_INVESTIDOR.length - 1];
  }
  
  // Regras de precedência (override)
  if (PA <= 4 && perfil.id > 2) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 2); // Conservador
  }
  if (PB <= 4 && perfil.id > 1) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 1); // Ultra-Conservador
  }
  if (PC <= 4 && perfil.id > 3) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 3); // Conservador-Moderado
  }
  if (PA <= 5 && PC <= 5 && perfil.id > 2) {
    perfil = PERFIS_INVESTIDOR.find(p => p.id === 2); // Conservador
  }
  
  return { perfil, PFP: PFP.toFixed(2), PA, PB, PC };
}

function obterPessoasComInvestimentos() {
  const pessoas = new Set();
  
  patrimoniosLiquidos.forEach(pl => {
    if (pl.donos && Array.isArray(pl.donos)) {
      pl.donos.forEach(dono => pessoas.add(dono));
    }
  });
  
  return Array.from(pessoas).sort();
}

function renderTesteSuitability() {
  // v3: o teste novo (suitability-v3.js) substitui este. O antigo não desenha
  // nem cria {} para pessoas novas; respostasSuitability segue intacto.
  if (window.SUITABILITY_V3_ATIVO === true) return;

  const container = document.getElementById('teste-suitability-container');
  if (!container) return;
  
  const pessoas = obterPessoasComInvestimentos();
  
  if (pessoas.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 2rem;">Adicione investimentos com proprietários para preencher o teste de suitability.</p>';
    return;
  }
  
  // Inicializar respostas para novas pessoas
  pessoas.forEach(pessoa => {
    if (!respostasSuitability[pessoa]) {
      respostasSuitability[pessoa] = {};
    }
  });
  
  let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; background: var(--dark-bg); border: 2px solid var(--border-color);">';
  
  // Cabeçalho
  html += '<thead><tr style="background: var(--primary-color);">';
  html += '<th style="padding: 1rem; text-align: left; color: var(--accent-color); border: 1px solid var(--border-color); min-width: 350px; font-size: 0.9rem;">PERGUNTA</th>';
  pessoas.forEach(pessoa => {
    html += `<th style="padding: 1rem; text-align: center; color: var(--accent-color); border: 1px solid var(--border-color); min-width: 200px; font-size: 0.9rem;">${pessoa.toUpperCase()}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  // Questões
  QUESTOES_SUITABILITY.forEach(questao => {
    html += `<tr style="border-bottom: 1px solid var(--border-color);">`;
    html += `<td style="padding: 0.8rem; color: var(--text-light); border: 1px solid var(--border-color); font-size: 0.85rem;"><strong style="color: var(--accent-color);">${questao.id}:</strong> ${questao.texto}</td>`;
    
    pessoas.forEach(pessoa => {
      const valorSelecionado = respostasSuitability[pessoa]?.[questao.id] || 0;
      html += `<td style="padding: 0.5rem; border: 1px solid var(--border-color);">`;
      html += `<select onchange="updateRespostaSuitability('${pessoa}', '${questao.id}', this.value)" style="width: 100%; padding: 0.5rem; background: var(--surface-bg); color: var(--text-light); border: 1px solid var(--border-color); border-radius: 5px; font-size: 0.85rem; cursor: pointer;">`;
      html += `<option value="0" ${valorSelecionado == 0 ? 'selected' : ''}>Selecione...</option>`;
      questao.alternativas.forEach(alt => {
        html += `<option value="${alt.valor}" ${valorSelecionado == alt.valor ? 'selected' : ''}>${alt.valor} - ${alt.texto}</option>`;
      });
      html += `</select></td>`;
    });
    
    html += '</tr>';
  });
  
  // Linha vazia
  html += '<tr style="height: 15px; background: var(--surface-bg);"><td colspan="' + (pessoas.length + 1) + '"></td></tr>';
  
  // Linha de resultado
  html += '<tr style="background: var(--primary-color); font-weight: bold;">';
  html += '<td style="padding: 1.2rem; color: var(--accent-color); border: 1px solid var(--border-color); font-size: 1rem;"><i class="fas fa-trophy"></i> PERFIL IDEAL</td>';
  
  pessoas.forEach(pessoa => {
    const resultado = calcularPerfilInvestidor(respostasSuitability[pessoa]);
    if (resultado && resultado.perfil) {
      html += `<td style="padding: 1.2rem; text-align: center; border: 1px solid var(--border-color); background-color: ${resultado.perfil.cor}; color: white;">`;
      html += `<div style="font-size: 1rem; font-weight: bold; margin-bottom: 0.3rem;">${resultado.perfil.nome}</div>`;
      html += `<div style="font-size: 0.75rem; opacity: 0.9;">PFP: ${resultado.PFP}%</div>`;
      html += `</td>`;
    } else {
      html += `<td style="padding: 1.2rem; text-align: center; color: var(--text-light); border: 1px solid var(--border-color); font-style: italic; font-size: 0.85rem;">Preencha todas as questões</td>`;
    }
  });
  
  html += '</tr></tbody></table></div>';
  
  container.innerHTML = html;
}

function updateRespostaSuitability(pessoa, questaoId, valor) {
  if (!respostasSuitability[pessoa]) {
    respostasSuitability[pessoa] = {};
  }
  respostasSuitability[pessoa][questaoId] = parseInt(valor);
  renderTesteSuitability();
  renderGraficos(); // Atualizar gráficos quando o perfil mudar
}

function getRespostasSuitabilityData() {
  return respostasSuitability;
}

function setRespostasSuitabilityData(data) {
  if (data && typeof data === 'object') {
    respostasSuitability = data;
    renderTesteSuitability();
  }
}

// =========================================
// GRÁFICOS
// =========================================

// Perfil vigente (ajustado || calculado) por pessoa, publicado pelo motor.
function lerVigentesPorPessoa() {
  const pf = window.PerfilFinanceiro;
  if (!pf || typeof pf.getResultado !== 'function') return {};
  let resultado = null;
  try {
    resultado = pf.getResultado();
  } catch (e) {
    return {};
  }
  const porPessoa = resultado && resultado.perfil_investidor && resultado.perfil_investidor.por_pessoa;
  if (!porPessoa || typeof porPessoa !== 'object') return {};
  const out = {};
  Object.keys(porPessoa).forEach(nome => {
    const p = porPessoa[nome] || {};
    const vigente = p.vigente || p.ajustado || p.calculado || null;
    out[String(nome).trim()] = vigente ? String(vigente) : null;
  });
  return out;
}

function assinaturaDosVigentes(vigentes) {
  try {
    return JSON.stringify(vigentes || {});
  } catch (e) {
    return '';
  }
}

function listarNomes(nomes) {
  if (nomes.length <= 1) return nomes.join('');
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function fmtPct(n) {
  return (Number(n) || 0).toFixed(1).replace('.', ',') + '%';
}

function fmtPp(n) {
  const v = Number(n) || 0;
  return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' p.p.';
}

const COR_FORA_MATRIZ = '#607d8b';
const COR_SEM_CLASSE = '#999999';

function htmlGrupoComparativo(chave, g, vigentes) {
  const r = R();
  const ordem = r.ORDEM || [];
  const andarChaves = Array.isArray(r.ANDAR_SEGURANCA) ? r.ANDAR_SEGURANCA : ['RISCO_SOBERANO', 'RISCO_MUITO_BAIXO'];
  const universo = ordem.reduce((s, k) => s + (g.porClasse[k] || 0), 0);
  const pctUniverso = v => (universo > 0 ? (v / universo) * 100 : 0);
  const pctTotal = v => (g.total > 0 ? (v / g.total) * 100 : 0);
  const valorAndar = andarChaves.reduce((s, k) => s + (g.porClasse[k] || 0), 0);
  const temExtras = g.fora > 0 || g.semClasse > 0;

  // Perfil para a alocação ideal: vigente de cada dono; vários donos → o menor
  const semDono = g.donos.length === 0;
  let perfilId = null;
  let perfilDono = '';
  const faltamPerfil = [];
  if (!semDono) {
    g.donos.forEach(nome => {
      const v = vigentes[String(nome).trim()];
      const n = Number(v);
      if (!v || !(n >= 1 && n <= 7)) {
        if (faltamPerfil.indexOf(nome) < 0) faltamPerfil.push(nome);
        return;
      }
      if (perfilId === null || n < Number(perfilId)) {
        perfilId = String(n);
        perfilDono = nome;
      }
    });
    if (faltamPerfil.length > 0) perfilId = null;
  }
  const donosDistintos = g.donos.filter((nome, i) => g.donos.indexOf(nome) === i);

  const htmlCor = cor => `<span class="plv3-cor" style="background: ${esc(cor)};"></span>`;

  let corpo = '';
  if (perfilId) {
    const nomePerfil = r.nomePerfil(perfilId) || ('Perfil ' + perfilId);
    const ideal = r.alocacaoIdeal(perfilId) || {};
    const legenda = donosDistintos.length > 1
      ? `Alocação ideal pelo perfil de ${esc(perfilDono)}, o mais restritivo dos donos (${esc(nomePerfil)})`
      : `Alocação ideal pelo perfil ${esc(nomePerfil)} de ${esc(perfilDono)}`;

    const linhaComparativa = (rotulo, cor, pIdeal, vAtual, classeTr) => {
      const pAtual = pctUniverso(vAtual);
      const vIdeal = (universo * pIdeal) / 100;
      const diferenca = pAtual - pIdeal; // percentuais não arredondados
      const corDiferenca = diferenca < 0 ? '#dc3545' : diferenca > 0 ? '#28a745' : 'inherit';
      return `
              <tr${classeTr ? ` class="${classeTr}"` : ''}>
                <td>${htmlCor(cor)}${esc(rotulo)}</td>
                <td class="plv3-num">${fmtPct(pIdeal)}</td>
                <td class="plv3-num">${fmtPct(pAtual)}</td>
                <td class="plv3-num">${formatarMoeda(vIdeal)}</td>
                <td class="plv3-num">${formatarMoeda(vAtual)}</td>
                <td class="plv3-num" style="color: ${corDiferenca}; font-weight: 600;">${fmtPp(diferenca)}</td>
              </tr>`;
    };
    const linhaExtraComparativa = (rotulo, cor, valor) => `
              <tr class="plv3-linha-extra">
                <td>${htmlCor(cor)}${esc(rotulo)}</td>
                <td class="plv3-num">—</td>
                <td class="plv3-num">${fmtPct(pctTotal(valor))} do total</td>
                <td class="plv3-num">—</td>
                <td class="plv3-num">${formatarMoeda(valor)}</td>
                <td class="plv3-num">—</td>
              </tr>`;

    let linhas = ordem.map(k => {
      const pIdeal = Number(ideal[k]) || 0;
      const vAtual = g.porClasse[k] || 0;
      if (pIdeal === 0 && vAtual === 0) return '';
      return linhaComparativa(r.rotuloRisco(k), r.corRisco(k), pIdeal, vAtual, '');
    }).join('');
    linhas += linhaComparativa('Andar de segurança (Soberano + Muito Baixo)', r.corRisco('RISCO_SOBERANO'), Number(r.andarSeguranca(perfilId)) || 0, valorAndar, 'plv3-linha-andar');
    if (g.fora > 0) linhas += linhaExtraComparativa('Fora da matriz (não elegível)', COR_FORA_MATRIZ, g.fora);
    if (g.semClasse > 0) linhas += linhaExtraComparativa('Sem classificação (fora do comparativo)', COR_SEM_CLASSE, g.semClasse);

    corpo = `
        <h5 style="color: var(--text-light); text-align: center; margin-bottom: 0.5rem;">
          <i class="fas fa-balance-scale"></i> Comparação por classe de risco: ideal × atual
        </h5>
        <p class="plv3-legenda">${legenda}</p>
        <div class="plv3-tabela-wrap">
          <table class="plv3-tabela">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Ideal (%)</th>
                <th>Atual (%)</th>
                <th>Valor ideal</th>
                <th>Valor atual</th>
                <th>Diferença (p.p.)</th>
              </tr>
            </thead>
            <tbody>${linhas}
            </tbody>
          </table>
        </div>
        <p class="plv3-nota">
          <i class="fas fa-info-circle"></i> Diferença positiva = acima do ideal | Diferença negativa = abaixo do ideal. Referência de planejamento por classe de risco, não recomendação de ativo.
        </p>
    `;
  } else {
    const linhaDistribuicao = (rotulo, cor, valor, pct, classeTr) => `
              <tr${classeTr ? ` class="${classeTr}"` : ''}>
                <td>${htmlCor(cor)}${esc(rotulo)}</td>
                <td class="plv3-num">${formatarMoeda(valor)}</td>
                <td class="plv3-num">${pct}</td>
              </tr>`;

    let linhas = ordem.map(k => {
      const v = g.porClasse[k] || 0;
      if (v === 0) return '';
      return linhaDistribuicao(r.rotuloRisco(k), r.corRisco(k), v, fmtPct(pctUniverso(v)), '');
    }).join('');
    linhas += linhaDistribuicao('Andar de segurança (Soberano + Muito Baixo)', r.corRisco('RISCO_SOBERANO'), valorAndar, fmtPct(pctUniverso(valorAndar)), 'plv3-linha-andar');
    if (g.fora > 0) linhas += linhaDistribuicao('Fora da matriz (não elegível)', COR_FORA_MATRIZ, g.fora, fmtPct(pctTotal(g.fora)) + ' do total', 'plv3-linha-extra');
    if (g.semClasse > 0) linhas += linhaDistribuicao('Sem classificação (fora do comparativo)', COR_SEM_CLASSE, g.semClasse, fmtPct(pctTotal(g.semClasse)) + ' do total', 'plv3-linha-extra');

    const motivo = semDono
      ? 'Informe o(s) dono(s) destes investimentos para comparar com a alocação ideal.'
      : `Responda o teste de perfil de ${esc(listarNomes(faltamPerfil))} para comparar`;

    corpo = `
        <h5 style="color: var(--text-light); text-align: center; margin-bottom: 1rem;">
          <i class="fas fa-table"></i> Distribuição atual por classe de risco
        </h5>
        <div class="plv3-tabela-wrap">
          <table class="plv3-tabela">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Valor</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>${linhas}
            </tbody>
          </table>
        </div>
        <p class="plv3-nota" style="font-size: 0.85rem;">
          <i class="fas fa-info-circle"></i> ${motivo}
        </p>
    `;
  }

  return `
      <div style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h4 style="color: var(--accent-color); margin-bottom: 0.5rem; text-align: center; overflow-wrap: anywhere;">
          <i class="fas fa-user-circle"></i> ${esc(chave)}
        </h4>
        <p style="color: var(--accent-color); margin-bottom: ${temExtras ? '0.25rem' : '1rem'}; text-align: center; font-size: 1.2rem; font-weight: bold;">
          Total: ${formatarMoeda(g.total)}
        </p>
        ${temExtras ? `
        <p style="color: var(--text-light); margin-bottom: 1rem; text-align: center; font-size: 0.85rem; opacity: 0.85;">
          Base da matriz (itens classificados e elegíveis): ${formatarMoeda(universo)}
        </p>
        ` : ''}
        ${corpo}
        ${temExtras ? `
        <p class="plv3-nota">
          Os percentuais das classes e do andar de segurança são sobre a base da matriz. «Fora da matriz» e «Sem classificação» não entram no comparativo; o percentual dessas linhas é sobre o total geral do grupo.
        </p>
        ` : ''}
      </div>
  `;
}

function renderGraficos() {
  const vigentes = lerVigentesPorPessoa();
  assinaturaPerfisRender = assinaturaDosVigentes(vigentes);

  const container = document.getElementById('graficos-patrimonio-liquido');
  if (!container) return;
  garantirEstilosPlv3();

  const r = R();
  const grupos = {};
  const ordemGrupos = [];

  // Agrupar investimentos (valor > 0) pelo conjunto de donos
  patrimoniosLiquidos.forEach(pl => {
    const valor = parseFloat(pl.valor_atual) || 0;
    if (valor <= 0) return;

    // cópia antes de ordenar: não reordena o array salvo do item.
    // Nomes aparados e sem repetição: mesma chave de por_pessoa do motor.
    const donosOrdenados = Array.isArray(pl.donos)
      ? [...new Set(pl.donos.map(d => String(d).trim()).filter(Boolean))].sort()
      : [];
    const chave = donosOrdenados.length > 0 ? donosOrdenados.join(' + ') : 'Sem proprietário';

    if (!grupos[chave]) {
      grupos[chave] = { donos: donosOrdenados, porClasse: {}, fora: 0, semClasse: 0, total: 0 };
      ordemGrupos.push(chave);
    }
    const g = grupos[chave];
    g.total += valor;

    if (pl.elegivel === false) {
      g.fora += valor;
      return;
    }
    const classe = r.classeDoItem(pl);
    if (!classe || !r.ehChaveNova(classe)) {
      g.semClasse += valor;
      return;
    }
    g.porClasse[classe] = (g.porClasse[classe] || 0) + valor;
  });

  if (ordemGrupos.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); opacity: 0.7;">Adicione investimentos com valor e dono(s) para ver a distribuição por classe de risco.</p>';
    return;
  }

  container.innerHTML = ordemGrupos.map(chave => htmlGrupoComparativo(chave, grupos[chave], vigentes)).join('');
}

// =========================================
// ATUALIZAÇÃO AUTOMÁTICA DE DONOS
// =========================================

function atualizarListaDonos() {
  renderPatrimoniosLiquidos();
}

// Observar mudanças nos campos de nomes
function setupObservadoresDonos() {
  const camposParaObservar = [
    'nome_diagnostico',
    'conjuge_nome'
  ];
  
  camposParaObservar.forEach(campoId => {
    const campo = document.getElementById(campoId);
    if (campo) {
      campo.addEventListener('blur', atualizarListaDonos);
      campo.addEventListener('input', atualizarListaDonos);
    }
  });
  
  // Observar mudanças em outras pessoas com renda e dependentes
  // Usar MutationObserver para detectar quando novos campos são adicionados
  const observarContainer = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const observer = new MutationObserver(() => {
      atualizarListaDonos();
    });
    
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false
    });
    
    // Também observar inputs existentes
    const inputs = container.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
      if (input.id && input.id.includes('nome')) {
        input.addEventListener('input', atualizarListaDonos);
        input.addEventListener('blur', atualizarListaDonos);
      }
    });
  };
  
  // Observar containers de pessoas e dependentes
  observarContainer('pessoas-renda-container');
  observarContainer('dependentes-container');
  
  // Forçar atualização inicial
  setTimeout(() => atualizarListaDonos(), 500);
}

// =========================================
// INTEGRAÇÃO COM O FORMULÁRIO PRINCIPAL
// =========================================

function getPatrimoniosLiquidosData() {
  return patrimoniosLiquidos;
}

function setPatrimoniosLiquidosData(data) {
  if (!data || !Array.isArray(data)) return;
  
  // Normalizar tipos de dados ao carregar
  patrimoniosLiquidos = data.map(pl => ({
    ...pl,
    valor_atual: parseFloat(pl.valor_atual) || 0,
    aporte_valor: parseFloat(pl.aporte_valor) || 0,
    taxa_administracao: parseFloat(pl.taxa_administracao) || 0,
    rentabilidade_esperada: parseFloat(pl.rentabilidade_esperada) || 0,
    donos: Array.isArray(pl.donos) ? pl.donos : (pl.donos ? [pl.donos] : []),
    inventariavel: pl.inventariavel !== false,
    // v2 (Perfil Financeiro): dados antigos sem a chave herdam da finalidade
    reserva_emergencia: typeof pl.reserva_emergencia === 'boolean' ? pl.reserva_emergencia : pl.finalidade === 'RESERVA_EMERGENCIA',
    // v3 (investimentos): normalização aditiva
    elegivel: pl.elegivel !== false,
    revisao_item: pl.revisao_item === true
  }));
  patrimonioLiquidoCounter = Math.max(...patrimoniosLiquidos.map(p => p.id), 0);
  blocosClasseAbertos.clear();
  Object.keys(rascunhosClasse).forEach(k => { delete rascunhosClasse[k]; });
  // Catálogo já carregado: itens refletem o catálogo (e o motor recalcula)
  if (tiposProdutos.length > 0) reaplicarCatalogoNosItens();
  renderPatrimoniosLiquidos();
  renderGraficos();
  renderTesteSuitability();
  
  // Re-renderizar após breve delay para garantir que o DOM está pronto
  setTimeout(() => {
    renderGraficos();
    renderTesteSuitability();
  }, 300);
}

// =========================================
// INICIALIZAÇÃO
// =========================================

async function initPatrimonioLiquido() {
  // Carregar dados do Supabase
  await carregarTiposProdutos();
  await carregarInstituicoes();
  
  const addBtn = document.getElementById('add-patrimonio-liquido-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addPatrimonioLiquido);
  }
  
  renderPatrimoniosLiquidos();
  renderGraficos();
  renderTesteSuitability();
  setupObservadoresDonos();
  
  // Observar adição/remoção de pessoas e dependentes
  window.addEventListener('pessoasRendaUpdated', atualizarListaDonos);
  window.addEventListener('dependentesUpdated', atualizarListaDonos);
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPatrimonioLiquido);
} else {
  initPatrimonioLiquido();
}

// Expor funções globalmente
window.addPatrimonioLiquido = addPatrimonioLiquido;
window.deletePatrimonioLiquido = deletePatrimonioLiquido;
window.updatePatrimonioLiquidoField = updatePatrimonioLiquidoField;
window.getPatrimoniosLiquidosData = getPatrimoniosLiquidosData;
window.setPatrimoniosLiquidosData = setPatrimoniosLiquidosData;
window.adicionarTipoProduto = adicionarTipoProduto;
window.adicionarInstituicao = adicionarInstituicao;
window.renderPatrimoniosLiquidos = renderPatrimoniosLiquidos;
window.renderGraficos = renderGraficos;
window.renderTesteSuitability = renderTesteSuitability;
window.updateRespostaSuitability = updateRespostaSuitability;
window.getRespostasSuitabilityData = getRespostasSuitabilityData;
window.setRespostasSuitabilityData = setRespostasSuitabilityData;
window.abrirModalGerenciarProdutos = abrirModalGerenciarProdutos;
window.abrirModalGerenciarInstituicoes = abrirModalGerenciarInstituicoes;
window.abrirModalNovoProduto = abrirModalNovoProduto;
window.abrirModalNovaInstituicao = abrirModalNovaInstituicao;
window.salvarNovoProduto = salvarNovoProduto;
window.salvarNovaInstituicao = salvarNovaInstituicao;
window.editarProduto = editarProduto;
window.excluirProduto = excluirProduto;
window.editarInstituicao = editarInstituicao;
window.excluirInstituicao = excluirInstituicao;
window.salvarEdicaoProduto = salvarEdicaoProduto;
window.salvarEdicaoInstituicao = salvarEdicaoInstituicao;

// v3 (investimentos)
window.recarregarTiposProdutos = async () => {
  await carregarTiposProdutos();
  reaplicarCatalogoNosItens();
  renderPatrimoniosLiquidos();
  renderGraficos();
};
window.plv3PreencherEscalaAntiga = plv3PreencherEscalaAntiga;
window.plv3AlternarClasseItem = plv3AlternarClasseItem;
window.plv3RascunhoClasse = plv3RascunhoClasse;
window.plv3AplicarClasseItem = plv3AplicarClasseItem;
window.plv3VoltarClasseCatalogo = plv3VoltarClasseCatalogo;

// Re-render do comparativo quando o motor publica resultado novo — só se os
// perfis vigentes por pessoa mudaram (evita laço com o MutationObserver).
document.addEventListener('perfil-financeiro:calculado', () => {
  const assinatura = assinaturaDosVigentes(lerVigentesPorPessoa());
  if (assinatura !== assinaturaPerfisRender) renderGraficos();
});
