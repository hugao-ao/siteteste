// argos-common.js — Utilidades compartilhadas da área Argos
// Cliente Supabase próprio (não depende dos scripts do restante do site)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Leitura completa de uma tabela ----------
// O PostgREST corta a resposta em 1000 linhas por padrão e NÃO avisa: a
// consulta volta "com sucesso", só que pela metade. Com as planilhas da
// clínica carregadas isso passou a morder de verdade — argos_sessoes tem
// milhares de linhas, e a agenda, vendo só as mil primeiras, dava todas as
// outras como frequência por preencher.
//
// Uso: `const { data, error } = await todas(() => sb.from('argos_sessoes').select('*'))`
// A consulta é montada de novo a cada página porque o range é aplicado
// sobre o builder, que não pode ser reaproveitado.
export const PAGINA = 1000;

export async function todas(montar, tamanho = PAGINA) {
    const linhas = [];
    for (let inicio = 0; ; inicio += tamanho) {
        const { data, error } = await montar().range(inicio, inicio + tamanho - 1);
        if (error) return { data: null, error };
        linhas.push(...(data || []));
        if (!data || data.length < tamanho) return { data: linhas, error: null };
    }
}

// ---------- Toast ----------
export function toast(msg, erro = false) {
    let el = document.getElementById('argos-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'argos-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('erro', erro);
    el.classList.add('mostrar');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('mostrar'), 3200);
}

// ---------- Escape de HTML ----------
export function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------- Modais genéricos ----------
export function abrirModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('aberto'); document.body.classList.add('modal-aberto'); }
}
export function fecharModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('aberto'); }
    if (!document.querySelector('.argos-modal-fundo.aberto')) {
        document.body.classList.remove('modal-aberto');
    }
}
// Fechar clicando no fundo ou no botão [data-fechar]
document.addEventListener('click', (e) => {
    const fundo = e.target.closest('.argos-modal-fundo');
    if (e.target.classList.contains('argos-modal-fundo')) {
        fecharModal(fundo.id);
    } else if (e.target.closest('[data-fechar]') && fundo) {
        fecharModal(fundo.id);
    }
});
