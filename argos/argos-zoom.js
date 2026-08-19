// argos-zoom.js — Zoom de pinça ilimitado nas páginas da área Argos
// ===================================================================
// Divisão de responsabilidades:
//   • APROXIMAR (>1x): zoom nativo do navegador (funciona bem em qualquer
//     celular; o viewport meta libera até 10x).
//   • AFASTAR (<1x): os navegadores travam o zoom out nativo quando o
//     conteúdo cabe na tela; este módulo assume o gesto de fechar a pinça
//     e encolhe a página via CSS até 2%, de forma PROPORCIONAL — a largura
//     de diagramação fica congelada no tamanho normal, então a página vira
//     uma miniatura fiel, sem re-diagramar.
// A rolagem com um dedo continua sendo a nativa o tempo todo.
//
// Recurso registrado no catálogo como "zoom_pinca" (liberado por padrão);
// pode ser bloqueado por tipo ou por usuário na tela de permissões.

import { carregarPermissoes } from './argos-permissoes.js';

const ZOOM_MIN = 0.02; // piso da miniatura (2% do tamanho normal)

function ativarZoomPinca() {
    let z = 1;            // escala da miniatura (sempre <= 1)
    let larguraBase = null;
    let alturaBase = null;
    let pinca = null;     // gesto custom (afastar) em andamento
    let decidir = null;   // gesto ainda sem direção definida (em tamanho normal)

    const distancia = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    // Redução "fotográfica": transform:scale não recalcula layout nem fontes,
    // então a página encolhe inteira, proporcional, em qualquer navegador
    // (a propriedade CSS zoom re-diagramava e o iOS re-inflava os textos).
    function aplicarZoom() {
        const b = document.body;
        if (z >= 0.999) {
            z = 1;
            b.style.transform = '';
            b.style.transformOrigin = '';
            b.style.height = '';
            alturaBase = null;
            return;
        }
        if (larguraBase == null) larguraBase = document.documentElement.clientWidth;
        if (alturaBase == null) alturaBase = b.scrollHeight;
        b.style.transformOrigin = '0 0';
        // centraliza a miniatura na horizontal
        b.style.transform = 'translateX(' + (larguraBase * (1 - z) / 2) + 'px) scale(' + z + ')';
        // encurta a área de rolagem junto com a miniatura
        b.style.height = Math.max(1, Math.round(alturaBase * z)) + 'px';
    }

    function iniciarCustom(a, b) {
        const mx = (a.clientX + b.clientX) / 2;
        const my = (a.clientY + b.clientY) / 2;
        pinca = {
            d0: distancia(a, b) || 1,
            z0: z,
            // ponto do conteúdo sob o meio dos dedos (para manter ancorado)
            cx: (window.scrollX + mx) / z,
            cy: (window.scrollY + my) / z
        };
    }

    window.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 2) return;
        // com zoom nativo ativo (>1x), o navegador cuida de tudo
        if (window.visualViewport && window.visualViewport.scale > 1.01) return;
        const [a, b] = e.touches;
        if (z < 0.999) {
            // já em miniatura: todo gesto de pinça é nosso
            e.preventDefault();
            iniciarCustom(a, b);
        } else {
            // tamanho normal: espera o 1º movimento para saber a direção
            decidir = { d0: distancia(a, b) || 1 };
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 2) return;
        const [a, b] = e.touches;
        if (decidir) {
            const d = distancia(a, b);
            if (d > decidir.d0 * 1.005) { decidir = null; return; } // abrindo: zoom-in nativo
            if (d < decidir.d0 * 0.995) {                            // fechando: afastar custom
                decidir = null;
                e.preventDefault();
                iniciarCustom(a, b);
            } else {
                return; // ainda ambíguo
            }
        }
        if (!pinca) return;
        e.preventDefault();
        const mx = (a.clientX + b.clientX) / 2;
        const my = (a.clientY + b.clientY) / 2;
        z = Math.min(1, Math.max(ZOOM_MIN, pinca.z0 * (distancia(a, b) / pinca.d0)));
        aplicarZoom();
        // mantém o ponto pinçado sob os dedos
        window.scrollTo(pinca.cx * z - mx, pinca.cy * z - my);
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) { pinca = null; decidir = null; }
    });
    window.addEventListener('touchcancel', () => { pinca = null; decidir = null; });

    // iOS: mata o pinch nativo remanescente só enquanto o gesto/miniatura
    // for nosso (o zoom-in nativo continua livre)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
        window.addEventListener(ev, (e) => {
            if (pinca || z < 0.999) e.preventDefault();
        }));
}

(async function init() {
    try {
        const perm = await carregarPermissoes();
        if (!perm.pode('zoom_pinca')) return;
    } catch (e) {
        // sem conexão não dá para checar permissão; segue ativo (recurso padrão liberado)
    }
    ativarZoomPinca();
})();
