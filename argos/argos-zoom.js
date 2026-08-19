// argos-zoom.js — Zoom de pinça ilimitado nas páginas da área Argos
// ===================================================================
// Os navegadores de celular travam o zoom out nativo quando o conteúdo já
// cabe na tela. Este módulo assume o gesto de pinça (dois dedos) e aplica
// o zoom via CSS na própria página, permitindo afastar até 2% e aproximar
// até 10x. O deslocamento com um dedo continua sendo a rolagem nativa.
//
// Recurso registrado no catálogo como "zoom_pinca" (liberado por padrão);
// pode ser bloqueado por tipo ou por usuário na tela de permissões.

import { carregarPermissoes } from './argos-permissoes.js';

const ZOOM_MIN = 0.02;
const ZOOM_MAX = 10;

function ativarZoomPinca() {
    let z = 1;
    let pinca = null; // estado do gesto em andamento

    const distancia = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    window.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        const [a, b] = e.touches;
        const mx = (a.clientX + b.clientX) / 2;
        const my = (a.clientY + b.clientY) / 2;
        pinca = {
            d0: distancia(a, b) || 1,
            z0: z,
            // ponto do conteúdo sob o meio dos dedos (para manter ancorado)
            cx: (window.scrollX + mx) / z,
            cy: (window.scrollY + my) / z
        };
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!pinca || e.touches.length !== 2) return;
        e.preventDefault();
        const [a, b] = e.touches;
        const mx = (a.clientX + b.clientX) / 2;
        const my = (a.clientY + b.clientY) / 2;
        z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinca.z0 * (distancia(a, b) / pinca.d0)));
        document.body.style.zoom = z;
        // mantém o ponto pinçado sob os dedos
        window.scrollTo(pinca.cx * z - mx, pinca.cy * z - my);
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) pinca = null;
    });
    window.addEventListener('touchcancel', () => { pinca = null; });

    // iOS: mata o pinch nativo remanescente (eventos proprietários de gesto)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
        window.addEventListener(ev, (e) => e.preventDefault()));
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
