// usuarios.js — Módulo "Usuários e Permissões" da área Argos
// Gestão de usuários, tipos de usuário e do catálogo de recursos
// (funcionalidades e elementos), com permissões por tipo e por usuário.

import { sb, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };

// ---------- Estado ----------
let tipos = [];
let usuarios = [];
let recursos = [];

let editandoUsuarioId = null;
let editandoTipoId = null;
let editandoRecursoId = null;

// Contexto do modal de permissões: { escopo: 'usuario'|'tipo', id, tipoIdDoUsuario }
let permCtx = null;

// ---------- Abas ----------
document.getElementById('abas').addEventListener('click', (e) => {
    const btn = e.target.closest('.aba');
    if (!btn) return;
    document.querySelectorAll('.aba').forEach(a => a.classList.toggle('ativa', a === btn));
    document.querySelectorAll('.argos-secao').forEach(s =>
        s.classList.toggle('ativa', s.id === 'secao-' + btn.dataset.aba));
});

// ---------- Carga inicial ----------
async function carregarTudo() {
    const [rTipos, rUsuarios, rRecursos] = await Promise.all([
        sb.from('argos_tipos_usuario').select('*').order('nome'),
        sb.from('argos_usuarios').select('*').order('created_at'),
        sb.from('argos_recursos').select('*').order('tipo').order('nome')
    ]);
    if (rTipos.error || rUsuarios.error || rRecursos.error) {
        console.error(rTipos.error || rUsuarios.error || rRecursos.error);
        toast('Erro ao carregar dados. Recarregue a página.', true);
        return;
    }
    tipos = rTipos.data || [];
    usuarios = rUsuarios.data || [];
    recursos = rRecursos.data || [];
    renderUsuarios();
    renderTipos();
    renderRecursos();
    preencherSelectTipos();
}

function nomeDoTipo(tipoId) {
    const t = tipos.find(t => t.id === tipoId);
    return t ? t.nome : '';
}

// ---------- Render: usuários ----------
function renderUsuarios() {
    const tb = document.getElementById('tbody-usuarios');
    const podeEditar = perm.pode('usuarios_editar');
    const podeExcluir = perm.pode('usuarios_excluir');
    const podePermissoes = perm.pode('permissoes_gerenciar');
    tb.innerHTML = usuarios.map(u => `
        <tr>
          <td>${esc(u.nome) || '<span class="dim">—</span>'}</td>
          <td><code>${esc(u.usuario)}</code></td>
          <td>${u.tipo_id ? esc(nomeDoTipo(u.tipo_id)) : '<span class="dim">Sem tipo</span>'}</td>
          <td>${u.ativo ? '<span class="badge verde">Ativo</span>' : '<span class="badge vermelho">Inativo</span>'}</td>
          <td class="acoes">
            ${podePermissoes ? `<button class="argos-btn small" data-acao="permissoes-usuario" data-id="${u.id}">🔑 Permissões</button>` : ''}
            ${podeEditar ? `<button class="argos-btn small" data-acao="editar-usuario" data-id="${u.id}">✏️ Editar</button>` : ''}
            ${podeExcluir ? `<button class="argos-btn small danger" data-acao="excluir-usuario" data-id="${u.id}">🗑️ Excluir</button>` : ''}
          </td>
        </tr>`).join('');
    document.getElementById('usuarios-vazio').style.display = usuarios.length ? 'none' : '';
}

// ---------- Render: tipos ----------
function renderTipos() {
    const tb = document.getElementById('tbody-tipos');
    const podeGerenciar = perm.pode('tipos_gerenciar');
    const podePermissoes = perm.pode('permissoes_gerenciar');
    tb.innerHTML = tipos.map(t => {
        const qtd = usuarios.filter(u => u.tipo_id === t.id).length;
        return `
        <tr>
          <td>${esc(t.nome)}</td>
          <td class="quebra">${esc(t.descricao) || '<span class="dim">—</span>'}</td>
          <td>${qtd}</td>
          <td class="acoes">
            ${podePermissoes ? `<button class="argos-btn small" data-acao="permissoes-tipo" data-id="${t.id}">🔑 Permissões</button>` : ''}
            ${podeGerenciar ? `<button class="argos-btn small" data-acao="editar-tipo" data-id="${t.id}">✏️ Editar</button>` : ''}
            ${podeGerenciar ? `<button class="argos-btn small danger" data-acao="excluir-tipo" data-id="${t.id}">🗑️ Excluir</button>` : ''}
          </td>
        </tr>`;
    }).join('');
    document.getElementById('tipos-vazio').style.display = tipos.length ? 'none' : '';
}

// ---------- Render: recursos (catálogo) ----------
function renderRecursos() {
    const tb = document.getElementById('tbody-recursos');
    const podeGerenciar = perm.pode('recursos_gerenciar');
    tb.innerHTML = recursos.map(r => `
        <tr>
          <td>${esc(r.nome)}<div class="chave"><code>${esc(r.chave)}</code></div></td>
          <td>${r.tipo === 'elemento'
              ? '<span class="badge azul">Elemento</span>'
              : '<span class="badge roxo">Funcionalidade</span>'}</td>
          <td class="quebra">${esc(r.descricao) || '<span class="dim">—</span>'}</td>
          <td class="quebra">${esc(r.paginas) || '<span class="dim">—</span>'}</td>
          <td>${r.padrao ? '<span class="badge verde">Liberado</span>' : '<span class="badge vermelho">Bloqueado</span>'}</td>
          <td class="acoes">
            ${podeGerenciar ? `<button class="argos-btn small" data-acao="editar-recurso" data-id="${r.id}">✏️ Editar</button>` : ''}
            ${podeGerenciar ? `<button class="argos-btn small danger" data-acao="excluir-recurso" data-id="${r.id}">🗑️ Excluir</button>` : ''}
          </td>
        </tr>`).join('');
    document.getElementById('recursos-vazio').style.display = recursos.length ? 'none' : '';
}

function preencherSelectTipos() {
    const sel = document.getElementById('usu-tipo');
    const atual = sel.value;
    sel.innerHTML = '<option value="">— Sem tipo —</option>' +
        tipos.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
    sel.value = atual;
}

// ---------- Ações das tabelas (delegação) ----------
document.querySelector('main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const id = btn.dataset.id;
    const acao = btn.dataset.acao;
    if (acao === 'editar-usuario') abrirModalUsuario(id);
    if (acao === 'excluir-usuario') excluirUsuario(id);
    if (acao === 'permissoes-usuario') abrirPermissoes('usuario', id);
    if (acao === 'editar-tipo') abrirModalTipo(id);
    if (acao === 'excluir-tipo') excluirTipo(id);
    if (acao === 'permissoes-tipo') abrirPermissoes('tipo', id);
    if (acao === 'editar-recurso') abrirModalRecurso(id);
    if (acao === 'excluir-recurso') excluirRecurso(id);
});

// ============================================================
// USUÁRIOS
// ============================================================
document.getElementById('btn-novo-usuario').addEventListener('click', () => abrirModalUsuario(null));

function abrirModalUsuario(id) {
    editandoUsuarioId = id;
    const u = id ? usuarios.find(x => x.id === id) : null;
    document.getElementById('modal-usuario-titulo').textContent = u ? 'Editar usuário' : 'Novo usuário';
    document.getElementById('usu-nome').value = u ? (u.nome || '') : '';
    document.getElementById('usu-login').value = u ? u.usuario : '';
    document.getElementById('usu-senha').value = u ? u.senha : '';
    document.getElementById('usu-email').value = u ? (u.email || '') : '';
    preencherSelectTipos();
    document.getElementById('usu-tipo').value = u ? (u.tipo_id || '') : '';
    document.getElementById('usu-ativo').checked = u ? !!u.ativo : true;
    abrirModal('modal-usuario');
}

document.getElementById('form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registro = {
        nome: document.getElementById('usu-nome').value.trim() || null,
        usuario: document.getElementById('usu-login').value.trim(),
        senha: document.getElementById('usu-senha').value,
        email: document.getElementById('usu-email').value.trim() || null,
        tipo_id: document.getElementById('usu-tipo').value || null,
        ativo: document.getElementById('usu-ativo').checked
    };
    if (!registro.usuario || !registro.senha) { toast('Login e senha são obrigatórios.', true); return; }

    const q = editandoUsuarioId
        ? sb.from('argos_usuarios').update(registro).eq('id', editandoUsuarioId)
        : sb.from('argos_usuarios').insert(registro);
    const { error } = await q;
    if (error) {
        console.error(error);
        toast(error.code === '23505' ? 'Já existe um usuário com esse login.' : 'Erro ao salvar usuário.', true);
        return;
    }
    fecharModal('modal-usuario');
    toast(editandoUsuarioId ? 'Usuário atualizado.' : 'Usuário criado.');
    await carregarTudo();
});

async function excluirUsuario(id) {
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    if (!confirm(`Excluir o usuário "${u.usuario}"?\nAs permissões individuais dele também serão removidas.`)) return;
    const { error } = await sb.from('argos_usuarios').delete().eq('id', id);
    if (error) { console.error(error); toast('Erro ao excluir usuário.', true); return; }
    toast('Usuário excluído.');
    await carregarTudo();
}

// ============================================================
// TIPOS DE USUÁRIO
// ============================================================
document.getElementById('btn-novo-tipo').addEventListener('click', () => abrirModalTipo(null));

function abrirModalTipo(id) {
    editandoTipoId = id;
    const t = id ? tipos.find(x => x.id === id) : null;
    document.getElementById('modal-tipo-titulo').textContent = t ? 'Editar tipo de usuário' : 'Novo tipo de usuário';
    document.getElementById('tipo-nome').value = t ? t.nome : '';
    document.getElementById('tipo-descricao').value = t ? (t.descricao || '') : '';
    abrirModal('modal-tipo');
}

document.getElementById('form-tipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registro = {
        nome: document.getElementById('tipo-nome').value.trim(),
        descricao: document.getElementById('tipo-descricao').value.trim() || null
    };
    if (!registro.nome) { toast('Informe o nome do tipo.', true); return; }
    const q = editandoTipoId
        ? sb.from('argos_tipos_usuario').update(registro).eq('id', editandoTipoId)
        : sb.from('argos_tipos_usuario').insert(registro);
    const { error } = await q;
    if (error) {
        console.error(error);
        toast(error.code === '23505' ? 'Já existe um tipo com esse nome.' : 'Erro ao salvar tipo.', true);
        return;
    }
    fecharModal('modal-tipo');
    toast(editandoTipoId ? 'Tipo atualizado.' : 'Tipo criado.');
    await carregarTudo();
});

async function excluirTipo(id) {
    const t = tipos.find(x => x.id === id);
    if (!t) return;
    const qtd = usuarios.filter(u => u.tipo_id === id).length;
    const aviso = qtd
        ? `\nAtenção: ${qtd} usuário(s) deste tipo ficarão "Sem tipo" (valem só as permissões individuais e o padrão de cada recurso).`
        : '';
    if (!confirm(`Excluir o tipo "${t.nome}"?\nAs permissões definidas para o tipo serão removidas.${aviso}`)) return;
    const { error } = await sb.from('argos_tipos_usuario').delete().eq('id', id);
    if (error) { console.error(error); toast('Erro ao excluir tipo.', true); return; }
    toast('Tipo excluído.');
    await carregarTudo();
}

// ============================================================
// RECURSOS (catálogo de funcionalidades e elementos)
// ============================================================
document.getElementById('btn-novo-recurso').addEventListener('click', () => abrirModalRecurso(null));

function abrirModalRecurso(id) {
    editandoRecursoId = id;
    const r = id ? recursos.find(x => x.id === id) : null;
    document.getElementById('modal-recurso-titulo').textContent = r ? 'Editar registro do catálogo' : 'Novo registro no catálogo';
    document.getElementById('rec-nome').value = r ? r.nome : '';
    document.getElementById('rec-chave').value = r ? r.chave : '';
    document.getElementById('rec-tipo').value = r ? r.tipo : 'funcionalidade';
    document.getElementById('rec-descricao').value = r ? (r.descricao || '') : '';
    document.getElementById('rec-paginas').value = r ? (r.paginas || '') : '';
    document.getElementById('rec-padrao').checked = r ? !!r.padrao : false;
    abrirModal('modal-recurso');
}

document.getElementById('form-recurso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registro = {
        nome: document.getElementById('rec-nome').value.trim(),
        chave: document.getElementById('rec-chave').value.trim().toLowerCase(),
        tipo: document.getElementById('rec-tipo').value,
        descricao: document.getElementById('rec-descricao').value.trim() || null,
        paginas: document.getElementById('rec-paginas').value.trim() || null,
        padrao: document.getElementById('rec-padrao').checked
    };
    if (!registro.nome || !registro.chave) { toast('Nome e chave são obrigatórios.', true); return; }
    const q = editandoRecursoId
        ? sb.from('argos_recursos').update(registro).eq('id', editandoRecursoId)
        : sb.from('argos_recursos').insert(registro);
    const { error } = await q;
    if (error) {
        console.error(error);
        toast(error.code === '23505' ? 'Já existe um recurso com essa chave.' : 'Erro ao salvar recurso.', true);
        return;
    }
    fecharModal('modal-recurso');
    toast(editandoRecursoId ? 'Recurso atualizado.' : 'Recurso cadastrado.');
    await carregarTudo();
});

async function excluirRecurso(id) {
    const r = recursos.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`Excluir "${r.nome}" do catálogo?\nTodas as permissões (de tipos e de usuários) ligadas a ele serão removidas.`)) return;
    const { error } = await sb.from('argos_recursos').delete().eq('id', id);
    if (error) { console.error(error); toast('Erro ao excluir recurso.', true); return; }
    toast('Recurso excluído.');
    await carregarTudo();
}

// ============================================================
// PERMISSÕES (de um usuário ou de um tipo)
// ============================================================
async function abrirPermissoes(escopo, id) {
    const alvo = escopo === 'usuario'
        ? usuarios.find(x => x.id === id)
        : tipos.find(x => x.id === id);
    if (!alvo) return;

    permCtx = { escopo, id, tipoIdDoUsuario: escopo === 'usuario' ? alvo.tipo_id : null };

    // Regras já salvas do alvo
    const tabela = escopo === 'usuario' ? 'argos_permissoes_usuario' : 'argos_permissoes_tipo';
    const coluna = escopo === 'usuario' ? 'usuario_id' : 'tipo_id';
    const { data: regras, error } = await sb.from(tabela).select('recurso_id, permitido').eq(coluna, id);
    if (error) { console.error(error); toast('Erro ao carregar permissões.', true); return; }
    const regraPorRecurso = {};
    (regras || []).forEach(p => { regraPorRecurso[p.recurso_id] = p.permitido; });

    // Para usuário: também as regras do tipo dele, para mostrar o que "Herdar" significa
    let regrasDoTipo = {};
    if (escopo === 'usuario' && alvo.tipo_id) {
        const { data: rt } = await sb.from('argos_permissoes_tipo')
            .select('recurso_id, permitido').eq('tipo_id', alvo.tipo_id);
        (rt || []).forEach(p => { regrasDoTipo[p.recurso_id] = p.permitido; });
    }

    document.getElementById('modal-permissoes-titulo').textContent = escopo === 'usuario'
        ? `Permissões do usuário: ${alvo.usuario}`
        : `Permissões do tipo: ${alvo.nome}`;
    document.getElementById('modal-permissoes-dica').textContent = escopo === 'usuario'
        ? 'A escolha individual sobrepõe a do tipo. "Herdar" usa a regra do tipo do usuário (ou o padrão do recurso, se o tipo não tiver regra).'
        : '"Herdar" usa o acesso padrão definido no catálogo para o recurso.';

    const grupos = [
        { tipo: 'funcionalidade', titulo: '⚙️ Funcionalidades (o que pode FAZER)' },
        { tipo: 'elemento', titulo: '👁️ Elementos (o que pode VER)' }
    ];

    document.getElementById('permissoes-lista').innerHTML = grupos.map(g => {
        const itens = recursos.filter(r => r.tipo === g.tipo);
        if (!itens.length) return '';
        return `
          <h3 class="perm-grupo">${g.titulo}</h3>
          ${itens.map(r => {
              const valor = (r.id in regraPorRecurso) ? String(regraPorRecurso[r.id]) : 'herdar';
              let herdado;
              if (escopo === 'usuario') {
                  herdado = (r.id in regrasDoTipo) ? regrasDoTipo[r.id] : r.padrao;
              } else {
                  herdado = r.padrao;
              }
              const herdadoTxt = herdado ? 'liberado' : 'bloqueado';
              return `
              <div class="perm-linha" data-recurso="${r.id}">
                <div class="perm-info">
                  <div class="perm-nome">${esc(r.nome)}</div>
                  <div class="perm-desc">${esc(r.descricao || '')}</div>
                  ${r.paginas ? `<div class="perm-paginas">📄 ${esc(r.paginas)}</div>` : ''}
                </div>
                <select class="perm-select" data-recurso-id="${r.id}">
                  <option value="herdar" ${valor === 'herdar' ? 'selected' : ''}>Herdar (${herdadoTxt})</option>
                  <option value="true" ${valor === 'true' ? 'selected' : ''}>✔ Permitir</option>
                  <option value="false" ${valor === 'false' ? 'selected' : ''}>✖ Bloquear</option>
                </select>
              </div>`;
          }).join('')}`;
    }).join('') || '<p class="dim">Nenhum recurso cadastrado no catálogo ainda.</p>';

    abrirModal('modal-permissoes');
}

document.getElementById('btn-salvar-permissoes').addEventListener('click', async () => {
    if (!permCtx) return;
    const tabela = permCtx.escopo === 'usuario' ? 'argos_permissoes_usuario' : 'argos_permissoes_tipo';
    const coluna = permCtx.escopo === 'usuario' ? 'usuario_id' : 'tipo_id';

    const selects = document.querySelectorAll('#permissoes-lista .perm-select');
    const upserts = [];
    const removerIds = [];
    selects.forEach(sel => {
        const recursoId = sel.dataset.recursoId;
        if (sel.value === 'herdar') {
            removerIds.push(recursoId);
        } else {
            upserts.push({ [coluna]: permCtx.id, recurso_id: recursoId, permitido: sel.value === 'true' });
        }
    });

    if (removerIds.length) {
        const { error } = await sb.from(tabela).delete().eq(coluna, permCtx.id).in('recurso_id', removerIds);
        if (error) { console.error(error); toast('Erro ao salvar permissões.', true); return; }
    }
    if (upserts.length) {
        const { error } = await sb.from(tabela).upsert(upserts, { onConflict: `${coluna},recurso_id` });
        if (error) { console.error(error); toast('Erro ao salvar permissões.', true); return; }
    }
    fecharModal('modal-permissoes');
    toast('Permissões salvas.');
});

// ---------- Início ----------
(async function init() {
    perm = await carregarPermissoes();
    perm.aplicarVisibilidade();
    await carregarTudo();
})();
