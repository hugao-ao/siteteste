// argos-cobranca-ui.js — o financeiro do paciente, onde quer que ele apareça
// ==========================================================================
// Três coisas que precisam existir tanto no card do paciente quanto na página
// de Cobrança e Notas, e por isso moram aqui:
//
//   • contatos de cobrança — CRUD, no formato que o link do WhatsApp aceita;
//   • detalhes financeiros — anotações gerais ou válidas só em certos meses;
//   • extrato do paciente  — mês a mês: sessões, valor, nota, pagamento.
//
// Uso:
//   import { montarCobrancaUI } from './argos-cobranca-ui.js';
//   const cob = montarCobrancaUI(perm);
//   cob.abrirFinanceiro(paciente);
//   cob.abrirExtrato(paciente);

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import {
    fechamentoPaciente, formataMoeda, formataBR, hojeISO, STATUS_SESSAO, tipoSessaoLabel
} from './argos-recorrencia.js';
import { mesBR, normalizarFone, linkWhatsApp, detalhesDoMes, notaEfetiva,
         situacaoNota, contatosParaCobranca, retratoDaNota, compararRetrato,
         dinamicasDoMes } from './argos-cobranca.js';

export { dinamicasDoMes }; // a regra mudou de arquivo; quem importava daqui segue valendo
import { documento, secao, ficha, abrirDocumento } from './argos-relatorio.js';

const CSS = `
.cob-lista { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
.cob-item { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between;
  border: 1px solid var(--argos-border); border-radius: 10px; padding: 9px 12px;
  background: var(--argos-bg); }
.cob-item .txt { min-width: 0; }
.cob-item .txt b { display: block; font-size: .92rem; }
.cob-item .txt small { color: var(--argos-text-dim); font-size: .8rem; }
.cob-item .txt .obs { display: block; margin-top: 3px; font-size: .82rem; color: var(--argos-text-dim);
  white-space: pre-line; }
.cob-item .bts { display: flex; gap: 5px; flex-shrink: 0; }
.cob-item.principal { border-color: var(--argos-primary); }
.cob-vazio { color: var(--argos-text-dim); font-size: .86rem; padding: 8px 2px; }
.cob-form { border: 1px dashed var(--argos-border); border-radius: 10px; padding: 10px 12px;
  margin-top: 8px; background: var(--argos-surface-2); }
.cob-fone-preview { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .78rem;
  color: var(--argos-text-dim); }
.cob-fone-preview.ruim { color: var(--argos-danger); }
#tab-extrato { min-width: 780px; font-size: .84rem; }
#tab-extrato td, #tab-extrato th { white-space: nowrap; }
#tab-extrato td.num { text-align: right; }
#tab-extrato tr.sem-pag td { color: var(--argos-text-dim); }
#tab-extrato th.ord { cursor: pointer; user-select: none; white-space: nowrap; }
#tab-extrato th.ord:hover { color: var(--argos-primary); }
#tab-extrato th.ord.ativa { color: var(--argos-primary); }
#tab-extrato th.ord i { font-style: normal; font-size: .7rem; }
#tab-extrato td.acoes { width: 1%; }
#tab-extrato .linha-detalhe td { white-space: normal; }
.ext-sessoes { margin: 4px 0 0; padding-left: 18px; }
.ext-sessoes li { margin-bottom: 5px; }
.ext-marcas { display: block; margin-top: 2px; font-size: .78rem; color: var(--argos-text-dim); }
.ext-resumo { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; font-size: .84rem; }
.ext-resumo span { border: 1px solid var(--argos-border); border-radius: 99px; padding: 3px 11px;
  color: var(--argos-text-dim); }
.ext-resumo span b { color: var(--argos-text); }
.ext-resumo span.devendo { border-color: var(--argos-danger); color: var(--argos-danger); }
.ext-resumo span.quitado { border-color: var(--argos-success); color: var(--argos-success); }
`;

const HTML = `
<div class="argos-modal-fundo" id="modal-cob-financeiro">
  <div class="argos-modal grande">
    <div class="argos-modal-topo">
      <h2 id="cob-fin-titulo">Financeiro do paciente</h2>
      <button class="argos-modal-x" data-fechar>×</button>
    </div>
    <div class="argos-abas" id="cob-fin-abas">
      <button type="button" class="aba ativa" data-cob-aba="contatos">📱 Contatos de cobrança</button>
      <button type="button" class="aba" data-cob-aba="detalhes">📝 Detalhes financeiros</button>
    </div>

    <div class="argos-form" data-cob-painel="contatos">
      <p class="dica">Quem recebe o fechamento pelo WhatsApp. Pode ser mais de um, e não precisa ser
        o responsável financeiro. O <b>principal</b> é o que já vem escolhido na hora de enviar.</p>
      <div class="cob-lista" id="cob-contatos"></div>
      <button class="argos-btn small" id="btn-cob-contato-novo"
        data-argos-recurso="cobranca_contatos_gerenciar">+ Novo contato</button>
      <div class="cob-form" id="cob-contato-form" style="display:none">
        <div class="form-grade">
          <label>Nome<input type="text" id="cob-c-nome" placeholder="Como você chama a pessoa" /></label>
          <label>WhatsApp<input type="tel" id="cob-c-fone" placeholder="(84) 99999-0000" /></label>
          <label>Papel<input type="text" id="cob-c-papel" placeholder="Ex.: mãe, pai, avó, financeiro" /></label>
        </div>
        <label class="linha-check"><input type="checkbox" id="cob-c-principal" /> É o contato principal</label>
        <label>Observação<textarea id="cob-c-obs" rows="2" placeholder="Ex.: só responde à noite"></textarea></label>
        <p class="dica cob-fone-preview" id="cob-c-preview"></p>
        <div class="argos-modal-acoes" style="justify-content:flex-start">
          <button class="argos-btn primary small" id="btn-cob-contato-salvar">Salvar contato</button>
          <button class="argos-btn ghost small" id="btn-cob-contato-cancelar">Cancelar</button>
        </div>
      </div>
    </div>

    <div class="argos-form" data-cob-painel="detalhes" style="display:none">
      <p class="dica">O que não dá para lembrar de cabeça: irmãos cobrados juntos, um acerto diferente
        num mês, quem paga o quê. A anotação <b>geral</b> vale sempre; a de <b>período</b> aparece só
        nos meses que você marcar.</p>
      <div class="cob-lista" id="cob-detalhes"></div>
      <button class="argos-btn small" id="btn-cob-detalhe-novo"
        data-argos-recurso="paciente_financeiro_detalhes">+ Nova anotação</button>
      <div class="cob-form" id="cob-detalhe-form" style="display:none">
        <label>Anotação<textarea id="cob-d-texto" rows="3"></textarea></label>
        <div class="form-grade">
          <label>Vale para
            <select id="cob-d-escopo">
              <option value="geral">Sempre (geral)</option>
              <option value="periodo">Só de um mês a outro</option>
            </select>
          </label>
          <label id="cob-d-rot-de" style="display:none">Do mês<input type="month" id="cob-d-de" /></label>
          <label id="cob-d-rot-ate" style="display:none">Até o mês (em branco = em diante)
            <input type="month" id="cob-d-ate" /></label>
        </div>
        <div class="argos-modal-acoes" style="justify-content:flex-start">
          <button class="argos-btn primary small" id="btn-cob-detalhe-salvar">Salvar anotação</button>
          <button class="argos-btn ghost small" id="btn-cob-detalhe-cancelar">Cancelar</button>
        </div>
      </div>
    </div>

    <div class="argos-modal-acoes">
      <button class="argos-btn ghost" data-fechar>Fechar</button>
    </div>
  </div>
</div>

<div class="argos-modal-fundo" id="modal-cob-extrato">
  <div class="argos-modal grande" style="max-width:980px">
    <div class="argos-modal-topo">
      <h2 id="cob-ext-titulo">Extrato financeiro</h2>
      <button class="argos-modal-x" data-fechar>×</button>
    </div>
    <div class="ext-resumo" id="cob-ext-resumo"></div>
    <div class="argos-tabela-wrap">
      <table class="argos-tabela" id="tab-extrato"></table>
    </div>
    <p class="dica">O <b>valor do mês</b> é o fechamento vivo: muda se a frequência mudar. O
      <b>pagamento</b> é o que foi lançado nas movimentações e associado àquele mês de produção —
      um pagamento feito em maio pode estar associado a abril.</p>
    <div class="argos-modal-acoes">
      <button class="argos-btn ghost" id="btn-cob-ext-imprimir">🖨️ Relatório do paciente</button>
      <button class="argos-btn ghost" data-fechar>Fechar</button>
    </div>
  </div>
</div>
`;

/** Injeta os modais e devolve as funções para abri-los. */
export function montarCobrancaUI(perm) {
    if (!document.getElementById('cob-css')) {
        const st = document.createElement('style');
        st.id = 'cob-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    if (!document.getElementById('modal-cob-financeiro')) {
        const div = document.createElement('div');
        div.innerHTML = HTML;
        while (div.firstElementChild) document.body.appendChild(div.firstElementChild);
        ligarEventos();
    }
    permAtual = perm || { pode: () => true, aplicarVisibilidade: () => {}, master: true };
    permAtual.aplicarVisibilidade(document.getElementById('modal-cob-financeiro'));
    return { abrirFinanceiro, abrirExtrato, recarregar: carregarFinanceiro };
}

let permAtual = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacAtual = null;
let contatos = [], detalhes = [];
let editandoContato = null, editandoDetalhe = null;
let aoMudar = null;   // avisa a página que os contatos/detalhes mudaram

const podeContatos = () => permAtual.pode('cobranca_contatos_gerenciar');
const podeDetalhes = () => permAtual.pode('paciente_financeiro_detalhes');

// ---------------------------------------------------------------------------
// Contatos e detalhes
// ---------------------------------------------------------------------------

export async function abrirFinanceiro(paciente, opcoes = {}) {
    pacAtual = paciente;
    aoMudar = opcoes.aoMudar || null;
    document.getElementById('cob-fin-titulo').textContent = `Financeiro — ${paciente.nome}`;
    trocarAba(opcoes.aba || 'contatos');
    esconderFormularios();
    abrirModal('modal-cob-financeiro');
    await carregarFinanceiro(paciente.id);
}

async function carregarFinanceiro(pacienteId) {
    const id = pacienteId || (pacAtual && pacAtual.id);
    if (!id) return;
    const [rc, rd] = await Promise.all([
        sb.from('argos_cobranca_contatos').select('*').eq('paciente_id', id).order('created_at'),
        sb.from('argos_paciente_financeiro').select('*').eq('paciente_id', id).order('created_at')
    ]);
    if (rc.error || rd.error) { console.error(rc.error || rd.error); toast('Erro ao carregar o financeiro do paciente.', true); return; }
    contatos = rc.data || [];
    detalhes = rd.data || [];
    renderContatos();
    renderDetalhes();
    if (aoMudar) aoMudar({ contatos, detalhes });
}

function renderContatos() {
    const alvo = document.getElementById('cob-contatos');
    const edit = podeContatos();
    if (!contatos.length) {
        const fallback = pacAtual && pacAtual.rf_whatsapp;
        alvo.innerHTML = `<div class="cob-vazio">Nenhum contato cadastrado.${fallback
            ? ` Enquanto não houver, a cobrança vai para o WhatsApp do responsável financeiro
                (${esc(pacAtual.rf_whatsapp)}).` : ' Sem WhatsApp do responsável financeiro, não dá para enviar a cobrança.'}</div>`;
        return;
    }
    alvo.innerHTML = contatos.map(c => {
        const fone = normalizarFone(c.telefone);
        return `
        <div class="cob-item ${c.principal ? 'principal' : ''} ${c.ativo === false ? 'dim' : ''}">
          <div class="txt">
            <b>${esc(c.nome)} ${c.principal ? '<span class="badge azul">principal</span>' : ''}
               ${c.ativo === false ? '<span class="badge vermelho">desligado</span>' : ''}</b>
            <small>${esc(c.telefone)}${c.papel ? ' · ' + esc(c.papel) : ''}
              ${fone ? `· link: +${esc(fone)}` : '· <span style="color:var(--argos-danger)">telefone inválido</span>'}</small>
            ${c.observacao ? `<span class="obs">${esc(c.observacao)}</span>` : ''}
          </div>
          ${edit ? `<div class="bts">
            <button class="argos-btn small" data-cob-c="editar" data-id="${c.id}">✏️</button>
            <button class="argos-btn small" data-cob-c="ativo" data-id="${c.id}">${c.ativo === false ? '↩️' : '🚫'}</button>
            <button class="argos-btn small danger" data-cob-c="excluir" data-id="${c.id}">🗑️</button>
          </div>` : ''}
        </div>`;
    }).join('');
}

function renderDetalhes() {
    const alvo = document.getElementById('cob-detalhes');
    const edit = podeDetalhes();
    if (!detalhes.length) {
        alvo.innerHTML = '<div class="cob-vazio">Nenhuma anotação financeira.</div>';
        return;
    }
    alvo.innerHTML = detalhes.map(d => `
      <div class="cob-item">
        <div class="txt">
          <b>${d.escopo === 'periodo'
              ? `<span class="badge azul">${esc(mesBR(d.mes_de))}${d.mes_ate ? ' a ' + esc(mesBR(d.mes_ate)) : ' em diante'}</span>`
              : '<span class="badge">geral</span>'}</b>
          <span class="obs">${esc(d.texto)}</span>
        </div>
        ${edit ? `<div class="bts">
          <button class="argos-btn small" data-cob-d="editar" data-id="${d.id}">✏️</button>
          <button class="argos-btn small danger" data-cob-d="excluir" data-id="${d.id}">🗑️</button>
        </div>` : ''}
      </div>`).join('');
}

function trocarAba(qual) {
    document.querySelectorAll('#cob-fin-abas .aba').forEach(b =>
        b.classList.toggle('ativa', b.dataset.cobAba === qual));
    document.querySelectorAll('[data-cob-painel]').forEach(p =>
        p.style.display = p.dataset.cobPainel === qual ? '' : 'none');
}

function esconderFormularios() {
    document.getElementById('cob-contato-form').style.display = 'none';
    document.getElementById('cob-detalhe-form').style.display = 'none';
    editandoContato = null;
    editandoDetalhe = null;
}

function abrirFormContato(c) {
    editandoContato = c || null;
    document.getElementById('cob-c-nome').value = c ? c.nome || '' : '';
    document.getElementById('cob-c-fone').value = c ? c.telefone || '' : '';
    document.getElementById('cob-c-papel').value = c ? c.papel || '' : '';
    document.getElementById('cob-c-obs').value = c ? c.observacao || '' : '';
    document.getElementById('cob-c-principal').checked = c ? !!c.principal : !contatos.length;
    document.getElementById('cob-contato-form').style.display = '';
    previewFone();
    document.getElementById('cob-c-nome').focus();
}

function previewFone() {
    const el = document.getElementById('cob-c-preview');
    const bruto = document.getElementById('cob-c-fone').value;
    const f = normalizarFone(bruto);
    if (!bruto.trim()) { el.textContent = ''; el.classList.remove('ruim'); return; }
    // 55 + DDD + 8 ou 9 dígitos = 12 ou 13; internacionais variam, então só avisa
    const curto = f.length < 12;
    el.classList.toggle('ruim', curto);
    el.textContent = curto
        ? `⚠️ ${f} — parece curto demais para o WhatsApp (falta o DDD?).`
        : `Link do WhatsApp: +${f}`;
}

function abrirFormDetalhe(d) {
    editandoDetalhe = d || null;
    document.getElementById('cob-d-texto').value = d ? d.texto || '' : '';
    document.getElementById('cob-d-escopo').value = d ? d.escopo || 'geral' : 'geral';
    document.getElementById('cob-d-de').value = d ? d.mes_de || '' : '';
    document.getElementById('cob-d-ate').value = d ? d.mes_ate || '' : '';
    escopoDetalhe();
    document.getElementById('cob-detalhe-form').style.display = '';
    document.getElementById('cob-d-texto').focus();
}

function escopoDetalhe() {
    const periodo = document.getElementById('cob-d-escopo').value === 'periodo';
    document.getElementById('cob-d-rot-de').style.display = periodo ? '' : 'none';
    document.getElementById('cob-d-rot-ate').style.display = periodo ? '' : 'none';
}

function ligarEventos() {
    document.getElementById('cob-fin-abas').addEventListener('click', e => {
        const b = e.target.closest('[data-cob-aba]');
        if (b) { trocarAba(b.dataset.cobAba); esconderFormularios(); }
    });

    // ---- contatos ----
    document.getElementById('btn-cob-contato-novo').addEventListener('click', () => abrirFormContato(null));
    document.getElementById('btn-cob-contato-cancelar').addEventListener('click', esconderFormularios);
    document.getElementById('cob-c-fone').addEventListener('input', previewFone);
    document.getElementById('cob-contatos').addEventListener('click', async e => {
        const b = e.target.closest('[data-cob-c]');
        if (!b || !podeContatos()) return;
        const c = contatos.find(x => x.id === b.dataset.id);
        if (!c) return;
        if (b.dataset.cobC === 'editar') return abrirFormContato(c);
        if (b.dataset.cobC === 'ativo') {
            const { error } = await sb.from('argos_cobranca_contatos')
                .update({ ativo: c.ativo === false }).eq('id', c.id);
            if (error) return toast('Erro ao mudar o contato.', true);
            toast(c.ativo === false ? 'Contato religado.' : 'Contato desligado.');
            return carregarFinanceiro();
        }
        if (b.dataset.cobC === 'excluir') {
            if (!confirm(`Excluir o contato ${c.nome}?`)) return;
            const { error } = await sb.from('argos_cobranca_contatos').delete().eq('id', c.id);
            if (error) return toast('Erro ao excluir o contato.', true);
            toast('Contato excluído.');
            return carregarFinanceiro();
        }
    });
    document.getElementById('btn-cob-contato-salvar').addEventListener('click', async () => {
        const nome = document.getElementById('cob-c-nome').value.trim();
        const telefone = document.getElementById('cob-c-fone').value.trim();
        if (!nome || !telefone) return toast('Nome e WhatsApp são obrigatórios.', true);
        if (!normalizarFone(telefone)) return toast('Esse telefone não tem dígito algum.', true);
        const dados = {
            paciente_id: pacAtual.id, nome, telefone,
            papel: document.getElementById('cob-c-papel').value.trim() || null,
            observacao: document.getElementById('cob-c-obs').value.trim() || null,
            principal: document.getElementById('cob-c-principal').checked
        };
        // só um principal por paciente
        if (dados.principal) {
            await sb.from('argos_cobranca_contatos').update({ principal: false })
                .eq('paciente_id', pacAtual.id);
        }
        const { error } = editandoContato
            ? await sb.from('argos_cobranca_contatos').update(dados).eq('id', editandoContato.id)
            : await sb.from('argos_cobranca_contatos').insert(dados);
        if (error) { console.error(error); return toast('Erro ao salvar o contato.', true); }
        toast('Contato salvo.');
        esconderFormularios();
        carregarFinanceiro();
    });

    // ---- detalhes ----
    document.getElementById('btn-cob-detalhe-novo').addEventListener('click', () => abrirFormDetalhe(null));
    document.getElementById('btn-cob-detalhe-cancelar').addEventListener('click', esconderFormularios);
    document.getElementById('cob-d-escopo').addEventListener('change', escopoDetalhe);
    document.getElementById('cob-detalhes').addEventListener('click', async e => {
        const b = e.target.closest('[data-cob-d]');
        if (!b || !podeDetalhes()) return;
        const d = detalhes.find(x => x.id === b.dataset.id);
        if (!d) return;
        if (b.dataset.cobD === 'editar') return abrirFormDetalhe(d);
        if (b.dataset.cobD === 'excluir') {
            if (!confirm('Excluir esta anotação?')) return;
            const { error } = await sb.from('argos_paciente_financeiro').delete().eq('id', d.id);
            if (error) return toast('Erro ao excluir a anotação.', true);
            toast('Anotação excluída.');
            return carregarFinanceiro();
        }
    });
    document.getElementById('btn-cob-detalhe-salvar').addEventListener('click', async () => {
        const texto = document.getElementById('cob-d-texto').value.trim();
        if (!texto) return toast('Escreva a anotação.', true);
        const escopo = document.getElementById('cob-d-escopo').value;
        const de = document.getElementById('cob-d-de').value || null;
        const ate = document.getElementById('cob-d-ate').value || null;
        if (escopo === 'periodo' && !de) return toast('Diga a partir de que mês a anotação vale.', true);
        if (escopo === 'periodo' && ate && ate < de) return toast('O mês final vem antes do inicial.', true);
        const dados = { paciente_id: pacAtual.id, texto, escopo,
            mes_de: escopo === 'periodo' ? de : null,
            mes_ate: escopo === 'periodo' ? ate : null,
            atualizado_em: new Date().toISOString() };
        const { error } = editandoDetalhe
            ? await sb.from('argos_paciente_financeiro').update(dados).eq('id', editandoDetalhe.id)
            : await sb.from('argos_paciente_financeiro').insert(dados);
        if (error) { console.error(error); return toast('Erro ao salvar a anotação.', true); }
        toast('Anotação salva.');
        esconderFormularios();
        carregarFinanceiro();
    });

    document.getElementById('btn-cob-ext-imprimir').addEventListener('click', imprimirExtrato);

    document.getElementById('tab-extrato').addEventListener('click', e => {
        if (!extratoAtual) return;
        const th = e.target.closest('[data-ord]');
        if (th) {
            const c = th.dataset.ord;
            // mesma coluna inverte; coluna nova começa crescente
            ordem = { coluna: c, desc: ordem.coluna === c ? !ordem.desc : false };
            return renderExtrato(extratoAtual);
        }
        const bt = e.target.closest('[data-mes-detalhe]');
        if (bt) {
            const m = bt.dataset.mesDetalhe;
            if (mesesAbertos.has(m)) mesesAbertos.delete(m); else mesesAbertos.add(m);
            renderExtrato(extratoAtual);
        }
    });
}

// ---------------------------------------------------------------------------
// Extrato do paciente
// ---------------------------------------------------------------------------

/** Todos os meses de 'de' até 'ate', inclusive. */
export function mesesEntre(de, ate) {
    if (!de || !ate || ate < de) return [];
    const saida = [];
    let [a, m] = de.split('-').map(Number);
    const [aF, mF] = ate.split('-').map(Number);
    while (a < aF || (a === aF && m <= mF)) {
        saida.push(`${a}-${String(m).padStart(2, '0')}`);
        m++; if (m > 12) { m = 1; a++; }
        if (saida.length > 240) break;      // trava contra data maluca no cadastro
    }
    return saida;
}

/**
 * A que mês um registro do histórico pertence. Um evento sobre uma sessão de
 * junho vale para junho mesmo que tenha sido anotado em julho, então a data
 * de dentro do evento manda sobre a data em que ele foi gravado.
 */
export function mesDoEvento(ev) {
    const d = ev && ev.dados ? (ev.dados.data || (ev.dados.de && ev.dados.de.data)) : null;
    return String(d || ev.created_at || '').slice(0, 7);
}

let extratoAtual = null;   // guardado para o relatório impresso

/**
 * Monta o extrato mês a mês. `cache` evita recarregar o que a página já tem:
 * { dinamicas, sessoes, notas, alocacoes, movimentacoes }.
 */
export async function calcularExtrato(paciente, cache = {}) {
    const pid = paciente.id;
    const busca = async (tabela, campo, ordem) => {
        const q = sb.from(tabela).select('*').eq(campo, pid);
        const { data, error } = ordem ? await q.order(ordem) : await q;
        if (error) { console.error(error); return []; }
        return data || [];
    };
    const dinamicas = cache.dinamicas || await busca('argos_dinamicas', 'paciente_id');
    const sessoes = cache.sessoes || await busca('argos_sessoes', 'paciente_id');
    const notas = cache.notas || await busca('argos_notas_fiscais', 'paciente_id');
    const excecoes = cache.excecoes || await busca('argos_nota_mes', 'paciente_id');
    const eventos = cache.eventos || await busca('argos_paciente_eventos', 'paciente_id');
    let profissionais = cache.profissionais;
    if (!profissionais) {
        const { data } = await sb.from('argos_profissionais').select('id, nome');
        profissionais = data || [];
    }
    const nomeProf = id => (profissionais.find(x => x.id === id) || {}).nome || '—';
    let grupos = cache.grupos;
    if (!grupos) {
        const { data } = await sb.from('argos_grupos').select('id, nome');
        grupos = data || [];
    }
    const nomeGrupo = id => (grupos.find(x => x.id === id) || {}).nome || '';
    const rotuloDin = id => {
        const d = dinamicas.find(x => x.id === id);
        return d ? (d.rotulo || 'Dinâmica') : '';
    };

    let alocacoes = cache.alocacoes;
    let movimentacoes = cache.movimentacoes;
    if (!alocacoes) {
        const { data } = await todas(() => sb.from('argos_mov_alocacoes').select('*')
            .eq('vinculo_tipo', 'paciente').eq('vinculo_id', pid));
        alocacoes = data || [];
    }
    if (!movimentacoes) {
        const ids = [...new Set(alocacoes.map(a => a.movimentacao_id))];
        if (ids.length) {
            const { data } = await todas(() => sb.from('argos_movimentacoes').select('*').in('id', ids));
            movimentacoes = data || [];
        } else movimentacoes = [];
    }
    const movPorId = new Map(movimentacoes.map(m => [m.id, m]));

    // janela: do primeiro sinal de vida até o mês corrente (ou o último sinal)
    const candidatosIni = [
        ...sessoes.map(s => s.data), ...dinamicas.map(d => d.data_inicio),
        ...alocacoes.map(a => a.mes_ref + '-01'), ...notas.map(n => n.mes + '-01')
    ].filter(Boolean).sort();
    if (!candidatosIni.length) { extratoAtual = { paciente, linhas: [], total: {} }; return extratoAtual; }
    const candidatosFim = [
        ...sessoes.map(s => s.data), ...alocacoes.map(a => a.mes_ref + '-01'),
        ...notas.map(n => n.mes + '-01'), hojeISO()
    ].filter(Boolean).sort();
    const meses = mesesEntre(candidatosIni[0].slice(0, 7), candidatosFim[candidatosFim.length - 1].slice(0, 7));

    const linhas = [];
    const total = { valor: 0, pago: 0, sessoes: 0 };
    const hoje = hojeISO();
    for (const mes of meses) {
        const fech = fechamentoPaciente(paciente, dinamicas, sessoes, mes);
        const pagos = alocacoes.filter(a => a.mes_ref === mes)
            .map(a => ({ valor: Number(a.valor) || 0, mov: movPorId.get(a.movimentacao_id) || {} }));
        const pago = pagos.reduce((s, p) => s + p.valor, 0);
        const nota = notas.find(n => n.mes === mes && n.status === 'emitida')
            || notas.filter(n => n.mes === mes).sort((a, b) =>
                String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
        const dinsMes = dinamicasDoMes(dinamicas, mes);
        const regime = notaEfetiva({ dinamicas: dinsMes, excecao: excecoes.find(e => e.mes === mes) });
        if (!fech.sessoes.length && !fech.valor && !pago && !nota) continue;

        // detalhe de cada sessão: data, hora, situação e tudo que ficou
        // registrado nela (remarcação, justificativa, observação, pagamento
        // redirecionado). É o que o mês esconde atrás do número de sessões.
        const detalheSessoes = [...fech.sessoes]
            .sort((a, b) => String(a.data).localeCompare(String(b.data))
                || String(a.hora || '').localeCompare(String(b.hora || '')))
            .map(x => ({
                data: x.data, hora: x.hora || '', status: x.status,
                dinamica: rotuloDin(x.dinamica_ref),
                avulsa: !x.dinamica_ref,
                // o tipo da sessão, quando marcado (online, familiar, grupo tal…)
                tipo: x.modalidade
                    ? tipoSessaoLabel(x.modalidade, nomeGrupo(x.grupo_id)) : '',
                valor: x.valor == null ? null : Number(x.valor),
                remarcada_de_data: x.remarcada_de_data || null,
                remarcada_de_hora: x.remarcada_de_hora || null,
                justificativa: x.justificativa || '',
                obs: x.obs || '',
                pagaA: x.repasse_profissional_id ? nomeProf(x.repasse_profissional_id) : '',
                pagaMotivo: x.repasse_motivo || '',
                projetada: x.status === '??' && x.data >= hoje
            }));

        // registros do histórico do paciente que caem naquele mês
        const registros = eventos.filter(ev => mesDoEvento(ev) === mes)
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

        linhas.push({ mes, fech, pago, pagos, nota, regime,
            sessoes: detalheSessoes, registros,
            sessoesCobradas: fech.contagens.ok + fech.contagens.fc });
        total.valor += fech.valor;
        total.pago += pago;
        total.sessoes += fech.contagens.ok + fech.contagens.fc;
    }
    extratoAtual = { paciente, linhas, total, dinamicas };
    return extratoAtual;
}


export async function abrirExtrato(paciente, cache = {}) {
    ordem = { coluna: 'mes', desc: false };
    mesesAbertos = new Set();
    document.getElementById('cob-ext-titulo').textContent = `Extrato financeiro — ${paciente.nome}`;
    document.getElementById('tab-extrato').innerHTML =
        '<tbody><tr><td class="dim">Calculando…</td></tr></tbody>';
    document.getElementById('cob-ext-resumo').innerHTML = '';
    abrirModal('modal-cob-extrato');
    const ext = await calcularExtrato(paciente, cache);
    renderExtrato(ext);
}

// ---------------------------------------------------------------------------
// A tabela do extrato: ordenável e com o detalhe de cada mês
// ---------------------------------------------------------------------------

/** Como cada coluna é comparada. Sem entrada aqui, a coluna não ordena. */
const ORDENA = {
    mes:      l => l.mes,
    sessoes:  l => l.sessoesCobradas,
    valor:    l => l.fech.valor,
    nota:     l => (l.nota && l.nota.numero) || '',
    pago:     l => l.pago,
    pagador:  l => (l.pagos[0] && l.pagos[0].mov.descricao) || '',
    quando:   l => (l.pagos[0] && l.pagos[0].mov.data) || '',
    saldo:    l => l.fech.valor - l.pago
};

const COLUNAS = [
    { chave: 'mes',     rotulo: 'Mês' },
    { chave: 'sessoes', rotulo: 'Sessões', num: true },
    { chave: 'valor',   rotulo: 'Valor do mês', num: true },
    { chave: 'nota',    rotulo: 'Nota fiscal' },
    { chave: 'pago',    rotulo: 'Pagamento', num: true },
    { chave: 'pagador', rotulo: 'Pagador' },
    { chave: 'quando',  rotulo: 'Pago em', dica: 'Quando o dinheiro entrou. A linha já diz a que mês de produção ele foi associado.' },
    { chave: 'saldo',   rotulo: 'Saldo', num: true }
];

let ordem = { coluna: 'mes', desc: false };
let mesesAbertos = new Set();

function ordenar(linhas) {
    const pega = ORDENA[ordem.coluna] || ORDENA.mes;
    const sinal = ordem.desc ? -1 : 1;
    return [...linhas].sort((a, b) => {
        const x = pega(a), y = pega(b);
        const cmp = typeof x === 'number' && typeof y === 'number'
            ? x - y : String(x).localeCompare(String(y), 'pt-BR');
        // empate volta à ordem do tempo, que é a leitura natural do extrato
        return cmp !== 0 ? cmp * sinal : a.mes.localeCompare(b.mes);
    });
}

function renderExtrato(ext) {
    const { linhas, total } = ext;
    const saldo = total.valor - total.pago;
    document.getElementById('cob-ext-resumo').innerHTML = linhas.length ? `
      <span>Meses com movimento <b>${linhas.length}</b></span>
      <span>Sessões cobradas <b>${total.sessoes}</b></span>
      <span>Produção <b>${formataMoeda(total.valor)}</b></span>
      <span>Recebido <b>${formataMoeda(total.pago)}</b></span>
      <span class="${saldo > 0.009 ? 'devendo' : 'quitado'}">
        ${saldo > 0.009 ? 'Em aberto' : 'Saldo'} <b>${formataMoeda(saldo)}</b></span>` : '';

    const tab = document.getElementById('tab-extrato');
    if (!linhas.length) {
        tab.innerHTML = '<tbody><tr><td class="dim">Nenhum movimento financeiro para este paciente.</td></tr></tbody>';
        return;
    }
    const seta = c => ordem.coluna === c ? (ordem.desc ? ' ▼' : ' ▲') : '';
    tab.innerHTML = `
      <thead><tr>
        <th class="acoes"></th>
        ${COLUNAS.map(c => `<th class="ord ${ordem.coluna === c.chave ? 'ativa' : ''} ${c.num ? 'num' : ''}"
            data-ord="${c.chave}" title="${esc(c.dica || 'Clique para ordenar por ' + c.rotulo.toLowerCase())}"
          >${esc(c.rotulo)}<i>${seta(c.chave)}</i></th>`).join('')}
      </tr></thead>
      <tbody>${ordenar(linhas).map(l => linhaMes(l) + (mesesAbertos.has(l.mes) ? detalheMes(l) : '')).join('')}</tbody>
      <tfoot><tr class="linha-total">
        <td></td><td><b>TOTAL</b></td><td class="num">${total.sessoes}</td>
        <td class="num"><b>${formataMoeda(total.valor)}</b></td><td></td>
        <td class="num"><b>${formataMoeda(total.pago)}</b></td><td></td><td></td>
        <td class="num"><b>${formataMoeda(saldo)}</b></td>
      </tr></tfoot>`;
}

function linhaMes(l) {
    const s = l.fech.valor - l.pago;
    const sit = situacaoNota(l.regime.valor);
    const aberto = mesesAbertos.has(l.mes);
    const marcas = l.sessoes.filter(x => x.remarcada_de_data || x.justificativa || x.obs || x.pagaA).length;
    return `
    <tr class="${l.pago ? '' : 'sem-pag'}">
      <td class="acoes"><button class="argos-btn small" data-mes-detalhe="${l.mes}"
        title="Datas das sessões e registros do mês">${aberto ? '▲' : '▼'}</button></td>
      <td><b>${esc(mesBR(l.mes))}</b>${l.registros.length
          ? ` <span class="badge" title="${l.registros.length} registro(s) no histórico">🗂️ ${l.registros.length}</span>` : ''}</td>
      <td class="num">${l.sessoesCobradas}${l.fech.contagens['??']
          ? ` <span class="badge vermelho" title="sessões ainda sem frequência">+${l.fech.contagens['??']}?</span>` : ''}
        ${marcas ? ` <span class="badge azul" title="${marcas} sessão(ões) com registro">📝</span>` : ''}</td>
      <td class="num">${formataMoeda(l.fech.valor)}</td>
      <td>${l.nota
            ? `${l.nota.numero ? esc(l.nota.numero) : '<span class="dim">sem número</span>'}
               ${l.nota.status !== 'emitida' ? `<span class="badge vermelho">${esc(l.nota.status)}</span>` : ''}
               ${l.nota.emitida_em ? `<br><small class="dim">${formataBR(l.nota.emitida_em)}</small>` : ''}`
            : `<span class="dim">${esc(sit.rotulo === 'Normal' ? 'não emitida' : sit.rotulo.toLowerCase())}</span>`}</td>
      <td class="num">${l.pagos.length
            ? l.pagos.map(p => formataMoeda(p.valor)).join('<br>')
            : '<span class="dim">—</span>'}</td>
      <td>${l.pagos.length
            ? [...new Set(l.pagos.map(p => p.mov.descricao || '—'))].map(esc).join('<br>')
            : '<span class="dim">—</span>'}</td>
      <td>${l.pagos.length
            ? l.pagos.map(p => {
                const quando = p.mov.data ? formataBR(p.mov.data) : '—';
                const outro = p.mov.data && p.mov.data.slice(0, 7) !== l.mes;
                return `${quando}${outro ? `<br><span class="badge azul"
                    title="O dinheiro entrou em outro mês e foi associado a ${esc(mesBR(l.mes))}">outro mês</span>` : ''}`;
              }).join('<br>')
            : '<span class="dim">—</span>'}</td>
      <td class="num">${s > 0.009
            ? `<b style="color:var(--argos-danger)">${formataMoeda(s)}</b>`
            : `<span class="dim">${formataMoeda(s)}</span>`}</td>
    </tr>`;
}

/** Um item da lista de sessões do mês, com tudo que ficou registrado nele. */
function itemSessao(x) {
    const st = STATUS_SESSAO[x.status] || {};
    const marcas = [
        x.remarcada_de_data ? `↪️ remarcada de ${formataBR(x.remarcada_de_data)} às ${esc(x.remarcada_de_hora || '')}` : '',
        x.justificativa ? `📝 ${esc(x.justificativa)}` : '',
        x.obs ? `🗒️ ${esc(x.obs)}` : '',
        x.pagaA ? `💸 paga a ${esc(x.pagaA)}${x.pagaMotivo ? ` — ${esc(x.pagaMotivo)}` : ''}` : '',
        x.projetada ? '🔮 ainda não aconteceu: entra como presença projetada' : ''
    ].filter(Boolean);
    return `
    <li>
      <b>${formataBR(x.data)}</b>${x.hora ? ` às ${esc(x.hora)}` : ''}
      — <span class="chip-status" style="--c:${st.cor}">${esc(st.desc || st.label || x.status)}</span>
      ${x.avulsa ? '<span class="badge azul">avulsa</span>' : (x.dinamica ? `<span class="dim">${esc(x.dinamica)}</span>` : '')}
      ${x.tipo ? `<span class="dim">${esc(x.tipo)}</span>` : ''}
      ${x.avulsa && x.valor != null ? `<span class="dim">${formataMoeda(x.valor)}</span>` : ''}
      ${marcas.length ? `<span class="ext-marcas">${marcas.join('<br>')}</span>` : ''}
    </li>`;
}

function detalheMes(l) {
    return `
    <tr class="linha-detalhe"><td colspan="9">
      <b>🗓️ Sessões de ${esc(mesBR(l.mes))}:</b>
      ${l.sessoes.length
        ? `<ul class="ext-sessoes">${l.sessoes.map(itemSessao).join('')}</ul>`
        : '<span class="dim">Sem sessões neste mês.</span>'}
      ${l.fech.detalhes.length ? `<b style="display:block;margin-top:8px">💰 Como o valor foi formado:</b>
        <ul>${l.fech.detalhes.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${l.pagos.length ? `<b style="display:block;margin-top:8px">💵 Pagamentos associados a este mês:</b>
        <ul>${l.pagos.map(p => `<li>${p.mov.data ? formataBR(p.mov.data) : 'sem data'} —
          ${esc(p.mov.descricao || 'sem descrição')}: <b>${formataMoeda(p.valor)}</b>
          ${p.mov.observacoes ? `<br><span class="dim">🗒️ ${esc(p.mov.observacoes)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${l.registros.length ? `<b style="display:block;margin-top:8px">🗂️ Registros do histórico:</b>
        <ul>${l.registros.map(ev => `<li>${formataBR(String(ev.created_at).slice(0, 10))} —
          ${esc(ev.descricao || ev.tipo)}
          ${ev.justificativa ? `<br><span class="dim">📝 ${esc(ev.justificativa)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    </td></tr>`;
}

function imprimirExtrato() {
    if (!extratoAtual || !extratoAtual.linhas.length) return toast('Nada para imprimir.', true);
    const { paciente, linhas, total } = extratoAtual;
    const saldo = total.valor - total.pago;
    const corpo = secao('Movimento mês a mês', `
      <table style="width:100%;border-collapse:collapse;font:9.5pt/1.4 'Helvetica Neue',Arial,sans-serif">
        <thead><tr>
          ${['Mês', 'Sessões', 'Valor do mês', 'Nota', 'Pagamento', 'Pagador', 'Saldo'].map(h =>
            `<th style="text-align:left;border-bottom:1px solid #ccd4dd;padding:4px 6px">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${linhas.map(l => {
            const s = l.fech.valor - l.pago;
            const td = (t, dir) => `<td style="padding:4px 6px;border-bottom:1px solid #eef1f5;text-align:${dir || 'left'}">${t}</td>`;
            return `<tr>
              ${td(esc(mesBR(l.mes)))}${td(l.sessoesCobradas, 'right')}
              ${td(formataMoeda(l.fech.valor), 'right')}
              ${td(l.nota && l.nota.numero ? esc(l.nota.numero) : '—')}
              ${td(l.pagos.map(p => `${p.mov.data ? formataBR(p.mov.data) : '—'}: ${formataMoeda(p.valor)}`).join('<br>') || '—')}
              ${td([...new Set(l.pagos.map(p => esc(p.mov.descricao || '')))].filter(Boolean).join('<br>') || '—')}
              ${td(formataMoeda(s), 'right')}
            </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td style="padding:5px 6px;border-top:2px solid #14181d"><b>TOTAL</b></td>
          <td style="padding:5px 6px;border-top:2px solid #14181d;text-align:right"><b>${total.sessoes}</b></td>
          <td style="padding:5px 6px;border-top:2px solid #14181d;text-align:right"><b>${formataMoeda(total.valor)}</b></td>
          <td colspan="2" style="padding:5px 6px;border-top:2px solid #14181d;text-align:right"><b>${formataMoeda(total.pago)}</b> recebido</td>
          <td style="padding:5px 6px;border-top:2px solid #14181d"></td>
          <td style="padding:5px 6px;border-top:2px solid #14181d;text-align:right"><b>${formataMoeda(saldo)}</b></td>
        </tr></tfoot>
      </table>`);
    const detalhe = secao('Sessões e registros, mês a mês', linhas.map(l => `
      <h3 class="subsec">${esc(mesBR(l.mes))}</h3>
      ${l.sessoes.length ? `<ul style="margin:0 0 6px;padding-left:18px;font:9.5pt/1.5 'Helvetica Neue',Arial,sans-serif">
        ${l.sessoes.map(x => {
            const st = STATUS_SESSAO[x.status] || {};
            const marcas = [
                x.remarcada_de_data ? `remarcada de ${formataBR(x.remarcada_de_data)} às ${esc(x.remarcada_de_hora || '')}` : '',
                x.justificativa ? `justificativa: ${esc(x.justificativa)}` : '',
                x.obs ? `observação: ${esc(x.obs)}` : '',
                x.pagaA ? `paga a ${esc(x.pagaA)}${x.pagaMotivo ? ` (${esc(x.pagaMotivo)})` : ''}` : ''
            ].filter(Boolean);
            return `<li><b>${formataBR(x.data)}</b>${x.hora ? ` às ${esc(x.hora)}` : ''} — ${esc(st.desc || st.label || x.status)}`
                + `${x.avulsa ? ` (sessão avulsa${x.tipo ? `, ${esc(x.tipo)}` : ''})`
                    : `${x.dinamica ? ` — ${esc(x.dinamica)}` : ''}${x.tipo ? ` (${esc(x.tipo)})` : ''}`}`
                + `${marcas.length ? `<br><span style="color:#5a6672">${marcas.join('; ')}</span>` : ''}</li>`;
        }).join('')}</ul>` : '<p class="relato"><span class="vazio">Sem sessões neste mês.</span></p>'}
      ${l.registros.length ? `<ul style="margin:0 0 6px;padding-left:18px;font:9.5pt/1.5 'Helvetica Neue',Arial,sans-serif;color:#5a6672">
        ${l.registros.map(ev => `<li>${formataBR(String(ev.created_at).slice(0, 10))} — ${esc(ev.descricao || ev.tipo)}`
            + `${ev.justificativa ? ` (${esc(ev.justificativa)})` : ''}</li>`).join('')}</ul>` : ''}
    `).join(''));

    const html = documento({
        titulo: `Extrato financeiro — ${paciente.nome}`,
        quando: `Emitido em ${formataBR(hojeISO())}`,
        cabecalho: `<h1>Extrato financeiro</h1><p class="sub">${esc(paciente.nome)}</p>`
            + `<p class="linhafina">Produção de cada mês conforme a dinâmica financeira, notas emitidas e pagamentos associados.</p>`
            + ficha([
                ['Paciente', paciente.nome],
                ['Responsável financeiro', paciente.responsavel_financeiro],
                ['CPF do responsável', paciente.rf_cpf],
                ['Meses com movimento', linhas.length],
                ['Produção total', formataMoeda(total.valor)],
                ['Recebido', formataMoeda(total.pago)],
                [saldo > 0.009 ? 'Em aberto' : 'Saldo', formataMoeda(saldo)]
            ]),
        corpo: corpo + detalhe,
        rodape: '<div class="rodape">O valor de cada mês é o fechamento vivo: muda se a frequência do mês for corrigida.</div>'
    });
    if (!abrirDocumento(html)) toast('O navegador bloqueou a janela do relatório.', true);
}
