// hermo-anexos.js — Módulo COMPARTILHADO de anexos (fotos, PDFs, qualquer arquivo).
// Usado por Visitas, Propostas (com herança das visitas) e Diário de Obras
// (a obra herda os anexos das propostas associadas e das visitas delas).
import { sb, toast, esc } from './hermo-common.js';

const BUCKET = 'hermo-anexos';
const MAX_MB = 25;

export function urlAnexo(a) {
    return sb.storage.from(BUCKET).getPublicUrl(a.path).data.publicUrl;
}

function ehImagem(a) {
    return (a.mime || '').startsWith('image/');
}

function fmtTamanho(b) {
    if (!b) return '';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
}

/** Sobe um arquivo e grava o registro. ref = {tipo_ref, visita_id|proposta_id|diario_id}. */
export async function uploadAnexo(ref, file) {
    if (file.size > MAX_MB * 1024 * 1024) {
        toast(`Arquivo muito grande (máx. ${MAX_MB} MB).`, true);
        return null;
    }
    const limpo = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const refId = ref.visita_id || ref.proposta_id || ref.diario_id;
    const path = `${ref.tipo_ref}/${refId}/${Date.now()}_${limpo}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (up.error) { toast('Erro ao enviar arquivo: ' + up.error.message, true); return null; }
    const { data, error } = await sb.from('hermo_anexos').insert({
        ...ref,
        nome_arquivo: file.name,
        path,
        mime: file.type || null,
        tamanho: file.size
    }).select().single();
    if (error) {
        await sb.storage.from(BUCKET).remove([path]); // não deixa órfão no storage
        toast('Erro ao registrar anexo: ' + error.message, true);
        return null;
    }
    return data;
}

export async function excluirAnexo(a) {
    const { error } = await sb.from('hermo_anexos').delete().eq('id', a.id);
    if (error) { toast('Erro ao excluir anexo: ' + error.message, true); return false; }
    await sb.storage.from(BUCKET).remove([a.path]); // best-effort
    return true;
}

/** Busca anexos por referências (qualquer combinação de ids). */
export async function listarAnexos({ visitaIds = [], propostaIds = [], diarioIds = [] }) {
    const ors = [];
    if (visitaIds.length) ors.push(`visita_id.in.(${visitaIds.join(',')})`);
    if (propostaIds.length) ors.push(`proposta_id.in.(${propostaIds.join(',')})`);
    if (diarioIds.length) ors.push(`diario_id.in.(${diarioIds.join(',')})`);
    if (ors.length === 0) return [];
    const { data, error } = await sb.from('hermo_anexos')
        .select('*').or(ors.join(',')).order('created_at', { ascending: false });
    if (error) { toast('Erro ao carregar anexos: ' + error.message, true); return []; }
    return data || [];
}

/**
 * Renderiza uma galeria de anexos em `container`.
 * opts: { podeExcluir: bool, rotuloOrigem: (a) => string|null, aoExcluir: async(a) }
 */
export function renderGaleria(container, anexos, opts = {}) {
    if (!container) return;
    if (anexos.length === 0) {
        container.innerHTML = '<div style="font-size:.76rem;color:var(--hermo-text-dim)">Nenhum anexo.</div>';
        return;
    }
    container.innerHTML = anexos.map((a, i) => {
        const url = urlAnexo(a);
        const origem = opts.rotuloOrigem ? opts.rotuloOrigem(a) : null;
        const miniatura = ehImagem(a)
            ? `<img src="${url}" loading="lazy" alt="${esc(a.nome_arquivo)}"
                 style="width:100%;height:74px;object-fit:cover;border-radius:6px" />`
            : `<div style="height:74px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:var(--hermo-bg);border-radius:6px">${(a.mime || '').includes('pdf') ? '📄' : '📎'}</div>`;
        return `
        <div style="width:120px;background:var(--hermo-surface-2);border:1px solid var(--hermo-border);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px">
            <a href="${url}" target="_blank" rel="noopener" title="${esc(a.nome_arquivo)}">${miniatura}</a>
            <div style="font-size:.64rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a.nome_arquivo)}">${esc(a.nome_arquivo)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:.6rem;color:var(--hermo-text-dim)">${origem ? esc(origem) : fmtTamanho(a.tamanho)}</span>
                ${opts.podeExcluir && !origem
                    ? `<button data-anx-del="${i}" style="background:none;border:none;color:var(--hermo-danger);cursor:pointer;font-size:.8rem;padding:0">🗑</button>`
                    : ''}
            </div>
        </div>`;
    }).join('');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';
    if (opts.aoExcluir) {
        container.querySelectorAll('[data-anx-del]').forEach(b => b.addEventListener('click', async () => {
            const a = anexos[parseInt(b.dataset.anxDel)];
            if (!confirm(`Excluir o anexo "${a.nome_arquivo}"?`)) return;
            await opts.aoExcluir(a);
        }));
    }
}

/**
 * Liga um input de upload: cria <input type=file multiple> escondido acionado
 * pelo botão, sobe os arquivos e chama aoTerminar().
 */
export function ligarUpload(botao, getRef, aoTerminar) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    botao.addEventListener('click', () => {
        const ref = getRef();
        if (!ref) return;
        input.click();
    });
    input.addEventListener('change', async () => {
        const ref = getRef();
        if (!ref || input.files.length === 0) return;
        botao.disabled = true;
        let ok = 0;
        for (const f of input.files) {
            const r = await uploadAnexo(ref, f);
            if (r) ok++;
        }
        input.value = '';
        botao.disabled = false;
        if (ok > 0) toast(`${ok} anexo(s) enviado(s).`);
        if (aoTerminar) await aoTerminar();
    });
}
