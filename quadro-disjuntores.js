/* =========================================================================
   quadro-disjuntores.js
   =========================================================================
   Liga e desliga o caminho de contratação de cada plano.

   Disjuntor desligado: o botão de assinar some do site público e da tela de
   adesão do diagnóstico. O plano continua visível e o interessado cai no
   "falar para assinar". Ninguém contrata sozinho enquanto estiver desligado.

   O conteúdo comercial dos planos (nome, preço, escopo) NÃO mora aqui — vem
   do repositório do site público. Esta tabela guarda só o estado da chave.
   ========================================================================= */

import { supabase } from './supabase.js';

const TABELA = 'disjuntores_planos';

let disjuntores = [];

/* ---------- acesso aos dados ---------- */

async function carregar() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .order('plano_id', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function gravar(planoId, ativo) {
  const { error } = await supabase
    .from(TABELA)
    .update({
      contratacao_ativa: ativo,
      atualizado_em: new Date().toISOString(),
      atualizado_por: sessionStorage.getItem('usuario') || 'desconhecido'
    })
    .eq('plano_id', planoId);

  if (error) throw error;
}

/* ---------- avisos ---------- */

function avisar(texto, tipo) {
  const caixa = document.getElementById('aviso');
  if (!caixa) return;
  caixa.textContent = texto;
  caixa.className = 'aviso ' + (tipo || 'ok');
  caixa.style.display = 'block';
  clearTimeout(avisar._t);
  avisar._t = setTimeout(() => { caixa.style.display = 'none'; }, 4000);
}

/* ---------- render ---------- */

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function render() {
  const lista = document.getElementById('lista-disjuntores');
  if (!lista) return;

  const ligados = disjuntores.filter(d => d.contratacao_ativa).length;
  const total = disjuntores.length;

  const resumo = document.getElementById('resumo');
  if (resumo) {
    resumo.textContent = `${ligados} de ${total} ${ligados === 1 ? 'disjuntor ligado' : 'disjuntores ligados'}`;
  }

  lista.innerHTML = '';

  disjuntores.forEach(d => {
    const linha = document.createElement('div');
    linha.className = 'disjuntor' + (d.contratacao_ativa ? ' ligado' : '');

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `
      <span class="nome">${d.nome}</span>
      <span class="meta">${d.contratacao_ativa ? 'Contratação liberada' : 'Contratação cortada'} ·
        alterado em ${formatarData(d.atualizado_em)}${d.atualizado_por ? ' por ' + d.atualizado_por : ''}</span>
    `;

    const chave = document.createElement('button');
    chave.type = 'button';
    chave.className = 'chave';
    chave.setAttribute('role', 'switch');
    chave.setAttribute('aria-checked', d.contratacao_ativa ? 'true' : 'false');
    chave.setAttribute('aria-label', `Contratação de ${d.nome}`);
    chave.innerHTML = '<span class="haste"></span>';

    chave.addEventListener('click', async () => {
      const novo = !d.contratacao_ativa;
      chave.disabled = true;
      try {
        await gravar(d.plano_id, novo);
        d.contratacao_ativa = novo;
        render();
        avisar(`${d.nome}: contratação ${novo ? 'liberada' : 'cortada'}.`, novo ? 'ok' : 'corte');
      } catch (e) {
        avisar('Não deu para gravar: ' + (e.message || e), 'erro');
        chave.disabled = false;
      }
    });

    linha.appendChild(info);
    linha.appendChild(chave);
    lista.appendChild(linha);
  });
}

/* ---------- ações em lote ---------- */

async function todos(ativo) {
  const alvos = disjuntores.filter(d => d.contratacao_ativa !== ativo);
  if (!alvos.length) {
    avisar(ativo ? 'Todos já estão ligados.' : 'Todos já estão desligados.', 'ok');
    return;
  }

  const confirmacao = ativo
    ? `Liberar a contratação de ${alvos.length} ${alvos.length === 1 ? 'plano' : 'planos'}?`
    : `Cortar a contratação de ${alvos.length} ${alvos.length === 1 ? 'plano' : 'planos'}? Ninguém vai conseguir assinar sozinho até religar.`;

  if (!window.confirm(confirmacao)) return;

  try {
    for (const d of alvos) {
      await gravar(d.plano_id, ativo);
      d.contratacao_ativa = ativo;
    }
    render();
    avisar(`${alvos.length} ${alvos.length === 1 ? 'disjuntor alterado' : 'disjuntores alterados'}.`, ativo ? 'ok' : 'corte');
  } catch (e) {
    avisar('Não deu para gravar: ' + (e.message || e), 'erro');
    iniciar();
  }
}

/* ---------- inicialização ---------- */

async function iniciar() {
  const lista = document.getElementById('lista-disjuntores');
  try {
    disjuntores = await carregar();
    render();
  } catch (e) {
    if (lista) {
      lista.innerHTML = `<p class="erro-carga">Não deu para carregar o quadro: ${e.message || e}</p>`;
    }
  }
}

document.getElementById('btn-ligar-todos')?.addEventListener('click', () => todos(true));
document.getElementById('btn-desligar-todos')?.addEventListener('click', () => todos(false));

iniciar();
