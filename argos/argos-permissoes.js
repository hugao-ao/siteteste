// argos-permissoes.js — Motor de permissões da área Argos
// =========================================================
// TODA página nova da área Argos deve usar este módulo para decidir o que o
// usuário logado pode VER (elementos) e FAZER (funcionalidades).
//
// Regra de resolução, da mais específica para a mais geral:
//   1. Permissão individual do usuário (argos_permissoes_usuario)
//   2. Permissão do tipo do usuário   (argos_permissoes_tipo)
//   3. Padrão do recurso              (argos_recursos.padrao)
// O login mestre ArgosGestao sempre pode tudo.
//
// Uso:
//   import { carregarPermissoes } from './argos-permissoes.js';
//   const perm = await carregarPermissoes();
//   if (perm.pode('usuarios_criar')) { ... }
//   perm.aplicarVisibilidade();  // esconde [data-argos-recurso] não permitidos
//   if (!perm.exigirPagina('pacientes_ver', 'os pacientes')) return; // trava a página
//   perm.escopo → { userId, tipoId, tipoNome, nome, profissionalId, geral }
//
// Convenção: todo elemento visual controlável deve ter o atributo
// data-argos-recurso="chave_do_recurso" e estar cadastrado em argos_recursos.

import { sb } from './argos-common.js';

export async function carregarPermissoes() {
    const usuario = sessionStorage.getItem('usuario');
    const master = (usuario === 'ArgosGestao');

    const { data: recursos, error } = await sb
        .from('argos_recursos')
        .select('id, chave, padrao');
    if (error) console.error('Erro ao carregar recursos:', error);

    const porChave = {};
    (recursos || []).forEach(r => { porChave[r.chave] = r; });

    let regrasUsuario = {};
    let regrasTipo = {};

    // Usuários comuns da área Argos guardam seu id/tipo na sessão
    const argosUserId = sessionStorage.getItem('argos_user_id');
    const argosTipoId = sessionStorage.getItem('argos_tipo_id');

    if (!master && argosUserId) {
        const { data: pu } = await sb
            .from('argos_permissoes_usuario')
            .select('recurso_id, permitido')
            .eq('usuario_id', argosUserId);
        (pu || []).forEach(p => { regrasUsuario[p.recurso_id] = p.permitido; });
    }
    if (!master && argosTipoId) {
        const { data: pt } = await sb
            .from('argos_permissoes_tipo')
            .select('recurso_id, permitido')
            .eq('tipo_id', argosTipoId);
        (pt || []).forEach(p => { regrasTipo[p.recurso_id] = p.permitido; });
    }

    function pode(chave) {
        if (master) return true;
        const r = porChave[chave];
        if (!r) return false; // recurso não cadastrado: bloqueado por segurança
        if (r.id in regrasUsuario) return regrasUsuario[r.id];
        if (r.id in regrasTipo) return regrasTipo[r.id];
        return r.padrao;
    }

    // Escopo: um usuário ligado a um profissional (argos_usuarios.
    // profissional_id) e sem `escopo_geral` só vê o que é dele. As páginas
    // usam argos-escopo.js para filtrar; aqui fica só quem é o usuário.
    const profissionalId = master ? null : (sessionStorage.getItem('argos_prof_id') || null);
    const escopo = {
        userId: master ? null : argosUserId,
        tipoId: master ? null : argosTipoId,
        tipoNome: master ? 'Mestre' : (sessionStorage.getItem('argos_tipo_nome') || ''),
        nome: sessionStorage.getItem('argos_nome') || usuario,
        profissionalId,
        geral: master || !profissionalId || pode('escopo_geral')
    };

    // Trava de página: sem o recurso, a página inteira vira um aviso —
    // esconder o card da home não basta, a URL continua acessível.
    function exigirPagina(chave, oQue) {
        if (pode(chave)) return true;
        const main = document.querySelector('main') || document.body;
        main.innerHTML = `<p class="dim" style="padding:30px">Sem permissão para ver ${oQue || 'esta página'}.
            <a href="index.html">← Início</a></p>`;
        document.documentElement.style.visibility = '';
        return false;
    }

    function aplicarVisibilidade(root) {
        (root || document).querySelectorAll('[data-argos-recurso]').forEach(el => {
            if (!pode(el.getAttribute('data-argos-recurso'))) el.style.display = 'none';
        });
    }

    return { pode, aplicarVisibilidade, exigirPagina, master, escopo };
}
