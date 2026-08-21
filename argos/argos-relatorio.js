// argos-relatorio.js — documentos de impressão em formato de relatório
// =====================================================================
// Monta um HTML autônomo (aberto numa janela nova) com tipografia de
// documento: papel A4, texto corrido justificado, seções numeradas e
// tópicos em destaque no início do parágrafo. Nada da interface do
// sistema vai para o papel — o que se imprime é o relatório, não a tela.

const escapar = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Quebra o texto anotado pelo terapeuta em parágrafos.
 * Linha em branco separa parágrafos; quebra simples vira quebra de linha.
 */
export function paragrafos(texto) {
    return String(texto || '').replace(/\r/g, '').split(/\n{2,}/)
        .map(t => t.trim()).filter(Boolean)
        .map(t => t.split('\n').map(l => escapar(l.trim())).join('<br />'));
}

/**
 * Parágrafo de relato: tópico em destaque, pergunta opcional em itálico e
 * o texto do terapeuta na sequência, tudo corrido.
 * `marcaVazio` é o que aparece quando não há texto — passe '' para não
 * marcar nada (é o caso do roteiro em branco, que já tem as linhas).
 */
export function relato(topico, texto, pergunta, marcaVazio = '— sem registro.') {
    const ps = paragrafos(texto);
    const abre = [
        topico ? `<span class="topico">${escapar(topico)}.</span>` : '',
        pergunta ? `<span class="pergunta">${escapar(pergunta)}</span>` : ''
    ].filter(Boolean).join(' ');
    if (!ps.length) {
        if (!abre) return '';
        return `<p class="relato">${abre}${marcaVazio ? ` <span class="vazio">${escapar(marcaVazio)}</span>` : ''}</p>`;
    }
    return `<p class="relato">${abre ? abre + ' ' : ''}${ps[0]}</p>`
        + ps.slice(1).map(t => `<p class="relato seg">${t}</p>`).join('');
}

/** Seção numerada. Volta vazia se não houver conteúdo. */
export function secao(titulo, conteudo) {
    const c = (conteudo || '').trim();
    if (!c) return '';
    return `<section class="sec"><h2>${escapar(titulo)}</h2>${c}</section>`;
}

/** Quadro de identificação: pares [rótulo, valor]; ignora valores vazios. */
export function ficha(pares) {
    const itens = (pares || []).filter(p => p && String(p[1] == null ? '' : p[1]).trim());
    if (!itens.length) return '';
    return `<dl class="ficha">${itens.map(([k, v]) =>
        `<div><dt>${escapar(k)}</dt><dd>${escapar(v)}</dd></div>`).join('')}</dl>`;
}

/** Linhas pautadas para preenchimento à mão. */
export function pauta(n = 3) {
    return `<div class="pauta">${'<i></i>'.repeat(Math.max(1, n))}</div>`;
}

/** Espaço de assinatura ao pé do documento. */
export function assinaturas(linhas) {
    if (!linhas || !linhas.length) return '';
    return `<div class="assinatura">${linhas.map(l =>
        `<div>${escapar(l)}</div>`).join('')}</div>`;
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#e9edf2;color:#14181d;font:11.5pt/1.6 Georgia,"Times New Roman",serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.barra{position:sticky;top:0;z-index:9;display:flex;gap:10px;justify-content:center;
  align-items:center;padding:10px;background:#14181d;
  font:600 10pt/1 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#cfd6de}
.barra button{font:inherit;cursor:pointer;border:1px solid #41505f;border-radius:8px;
  padding:8px 14px;background:#38bdf8;color:#04202e;border-color:transparent}
.barra button.ghost{background:transparent;color:#cfd6de;border-color:#41505f}
.folha{width:210mm;min-height:297mm;margin:18px auto 40px;padding:18mm 16mm 20mm;
  background:#fff;box-shadow:0 8px 30px rgba(10,20,30,.22)}
.timbre{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;
  border-bottom:2px solid #14181d;padding-bottom:6px;margin-bottom:16px}
.timbre .marca{font:700 11pt/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:.2em;
  text-transform:uppercase}
.timbre .marca em{font-style:normal;font-weight:400}
.timbre .quando{font:9pt/1.3 "Helvetica Neue",Arial,sans-serif;color:#5a6672;text-align:right}
h1{font-size:17pt;line-height:1.25;margin:0 0 2px}
.sub{margin:0;font-size:12.5pt}
.linhafina{margin:2px 0 16px;font:9.5pt/1.4 "Helvetica Neue",Arial,sans-serif;color:#5a6672}
dl.ficha{display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;margin:0 0 18px;
  padding:10px 13px;border:1px solid #ccd4dd;border-radius:4px;background:#f6f8fb}
dl.ficha div{display:flex;gap:6px;font:9.5pt/1.45 "Helvetica Neue",Arial,sans-serif}
dl.ficha dt{margin:0;font-weight:700;color:#46505c;white-space:nowrap}
dl.ficha dd{margin:0}
.corpo{counter-reset:sec}
.sec{margin:0 0 4px}
.sec h2{counter-increment:sec;margin:20px 0 7px;padding-bottom:3px;font-size:10.5pt;
  font-family:"Helvetica Neue",Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;
  border-bottom:1px solid #ccd4dd}
.sec h2::before{content:counter(sec) ". "}
h3.subsec{margin:14px 0 5px;font-size:10pt;font-family:"Helvetica Neue",Arial,sans-serif;
  color:#46505c;text-transform:uppercase;letter-spacing:.05em}
p.relato{margin:0 0 8px;text-align:justify;hyphens:auto}
p.relato.seg{text-indent:1.3em}
p.relato.intro{color:#4b5663;font-style:italic;margin-bottom:10px}
.topico{font-weight:700}
.pergunta{font-style:italic;color:#4b5663}
.vazio{color:#8b95a1;font-style:italic}
.pauta{margin:2px 0 14px}
.pauta i{display:block;border-bottom:1px solid #b7c1cc;height:9mm}
.assinatura{display:flex;gap:26px;margin-top:24px}
.assinatura div{flex:1;border-top:1px solid #14181d;padding-top:5px;text-align:center;
  font:9pt/1.3 "Helvetica Neue",Arial,sans-serif}
.rodape{margin-top:16px;padding-top:8px;border-top:1px dashed #ccd4dd;
  font:8.5pt/1.45 "Helvetica Neue",Arial,sans-serif;color:#5a6672}
@page{size:A4;margin:18mm 16mm 20mm}
@media print{
  body{background:#fff}
  .barra{display:none}
  .folha{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}
  .sec h2,h3.subsec{break-after:avoid;page-break-after:avoid}
  p.relato{orphans:3;widows:3}
  dl.ficha,.assinatura,.pauta{break-inside:avoid;page-break-inside:avoid}
}
`;

/**
 * Documento completo pronto para imprimir/salvar em PDF.
 * `imprimir` dispara a caixa de impressão assim que a janela carrega.
 */
export function documento({ titulo, marca = 'Argos <em>Gestão</em>', quando = '',
    cabecalho = '', corpo = '', rodape = '', imprimir = true }) {
    return `<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapar(titulo)}</title><style>${CSS}</style></head><body>
<div class="barra">
  <button type="button" onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
  <button type="button" class="ghost" onclick="window.close()">Fechar</button>
  <span>Esta barra não sai no papel.</span>
</div>
<div class="folha">
  <div class="timbre"><div class="marca">${marca}</div><div class="quando">${escapar(quando)}</div></div>
  ${cabecalho}
  <div class="corpo">${corpo}</div>
  ${rodape}
</div>
${imprimir ? '<scr' + `ipt>window.addEventListener('load', function(){ setTimeout(function(){ try { window.print(); } catch (e) {} }, 350); });</scr` + 'ipt>' : ''}
</body></html>`;
}

/** Abre o documento numa janela nova. Volta false se o navegador bloqueou. */
export function abrirDocumento(html) {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
}
