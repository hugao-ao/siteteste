// hermo-common.js — Utilidades compartilhadas da área Hermogenes
// Cliente Supabase próprio (não depende dos scripts do restante do site)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://vbikskbfkhundhropykf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWtza2Jma2h1bmRocm9weWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTk5NjEsImV4cCI6MjA2MTA5NTk2MX0.-n-Tj_5JnF1NL2ZImWlMeTcobWDl_VD6Vqp0lxRQFFU";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Status de visita ----------
export const STATUS_VISITA = {
    concluida:            { label: 'Concluída',                cor: '#22c55e' },
    concluida_pendencias: { label: 'Concluída c/ pendências',  cor: '#a855f7' },
    marcada:              { label: 'Marcada',                  cor: '#3b82f6' },
    pendente_marcacao:    { label: 'Pendente de marcação',     cor: '#eab308' },
    desistiu:             { label: 'Desistiu',                 cor: '#ef4444' }
};

// ---------- Toast ----------
export function toast(msg, erro = false) {
    let el = document.getElementById('hermo-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'hermo-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('erro', erro);
    el.classList.add('mostrar');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('mostrar'), 3200);
}

// ---------- Máscaras CPF / CNPJ ----------
export function mascaraCPF(valor) {
    const d = (valor || '').replace(/\D/g, '').slice(0, 11);
    return d
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

export function mascaraCNPJ(valor) {
    const d = (valor || '').replace(/\D/g, '').slice(0, 14);
    return d
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
        .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/** Aplica máscara viva num input conforme tipo PF/PJ */
export function ligarMascaraDocumento(input, getTipo) {
    input.addEventListener('input', () => {
        const tipo = getTipo();
        input.value = tipo === 'PJ' ? mascaraCNPJ(input.value) : mascaraCPF(input.value);
    });
}

// ---------- Datas ----------
export function fmtDataHora(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** valor de <input type=datetime-local> -> ISO (ou null) */
export function inputParaISO(v) {
    return v ? new Date(v).toISOString() : null;
}

/** ISO -> valor de <input type=datetime-local> */
export function isoParaInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- Fechar modal pelo backdrop ----------
/**
 * Fecha o modal só quando mousedown E click acontecem no próprio overlay —
 * evita descartar o formulário ao arrastar uma seleção de texto para fora.
 */
export function ligarFecharPorBackdrop(overlayEl, fechar) {
    let comecouNoOverlay = false;
    overlayEl.addEventListener('mousedown', e => {
        comecouNoOverlay = (e.target === overlayEl);
    });
    overlayEl.addEventListener('click', e => {
        if (e.target === overlayEl && comecouNoOverlay) fechar();
        comecouNoOverlay = false;
    });
}

// ---------- Moeda ----------
export function fmtMoeda(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Prazos ----------
/** Soma um prazo a uma data ISO (o dia inicial conta como dia 1).
 *  'uteis' = segunda a sexta (feriados não descontados); começando em fim de
 *  semana, a contagem parte da segunda. Espelho de hermo_somar_prazo no banco. */
export function somarPrazo(iso, n, tipo) {
    if (!iso) return iso;
    n = Math.min(parseInt(n) || 0, 3650);
    if (n < 1) return iso;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const fmt = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    if (tipo === 'uteis') {
        const util = t => t.getDay() >= 1 && t.getDay() <= 5;
        while (!util(dt)) dt.setDate(dt.getDate() + 1);
        let cont = 1;
        while (cont < n) {
            dt.setDate(dt.getDate() + 1);
            if (util(dt)) cont++;
        }
        return fmt(dt);
    }
    dt.setDate(dt.getDate() + (n - 1));
    return fmt(dt);
}
