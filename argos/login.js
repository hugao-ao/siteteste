// login.js — Entrada da área Argos
// =================================
// Autentica os usuários de argos_usuarios (criados em Usuários e Permissões)
// e também o login mestre ArgosGestao, que continua funcionando pelo login
// do site. Não mexe em nada do restante do site: só grava na sessão as
// chaves que a área Argos lê (argos-guard.js e argos-permissoes.js).
//
// Um usuário comum NÃO recebe `nivel`, então o site principal continua a
// tratá-lo como deslogado — ele só existe dentro de /argos/.

import { sb } from './argos-common.js';

const form = document.getElementById('form-login');
const erro = document.getElementById('login-erro');
const botao = document.getElementById('login-entrar');

// já logado? vai direto
if (sessionStorage.getItem('usuario') === 'ArgosGestao'
    || (sessionStorage.getItem('usuario') && sessionStorage.getItem('argos_user_id'))) {
    seguir();
}

function seguir() {
    let destino = 'index.html';
    try {
        const pendente = localStorage.getItem('redirect_after_login');
        if (pendente && pendente.indexOf('/argos/') !== -1 && pendente.indexOf('login.html') === -1) destino = pendente;
        localStorage.removeItem('redirect_after_login');
    } catch (e) {}
    window.location.replace(destino);
}

function guardar(chaves) {
    Object.keys(chaves).forEach(k => {
        if (chaves[k] == null || chaves[k] === '') sessionStorage.removeItem(k);
        else sessionStorage.setItem(k, chaves[k]);
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    const usuario = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value;
    if (!usuario || !senha) { erro.textContent = 'Informe usuário e senha.'; return; }
    botao.disabled = true;
    try {
        // 1. usuário da área Argos
        const { data: u, error } = await sb.from('argos_usuarios')
            .select('id, usuario, nome, tipo_id, profissional_id, ativo, argos_tipos_usuario(nome)')
            .eq('usuario', usuario).eq('senha', senha).maybeSingle();
        if (error) throw error;
        if (u) {
            if (!u.ativo) { erro.textContent = 'Este usuário está inativo. Fale com o financeiro.'; return; }
            guardar({
                usuario: u.usuario,
                argos_user_id: u.id,
                argos_tipo_id: u.tipo_id,
                argos_tipo_nome: u.argos_tipos_usuario ? u.argos_tipos_usuario.nome : '',
                argos_prof_id: u.profissional_id,
                argos_nome: u.nome || u.usuario,
                nivel: null, projeto: null, user_id: null, id: null
            });
            sb.from('argos_usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', u.id).then(() => {});
            seguir();
            return;
        }
        // 2. login mestre (mesma credencial do login do site)
        if (usuario === 'ArgosGestao') {
            const { data: c } = await sb.from('credenciais').select('id, usuario, nivel, projeto')
                .eq('usuario', usuario).eq('senha', senha).maybeSingle();
            if (c) {
                guardar({ usuario: c.usuario, user_id: c.id, id: c.id, nivel: c.nivel, projeto: c.projeto || '',
                    argos_user_id: null, argos_tipo_id: null, argos_tipo_nome: null, argos_prof_id: null, argos_nome: null });
                seguir();
                return;
            }
        }
        erro.textContent = 'Usuário ou senha incorretos.';
    } catch (ex) {
        console.error(ex);
        erro.textContent = 'Não foi possível entrar agora. Tente de novo.';
    } finally {
        botao.disabled = false;
    }
});
