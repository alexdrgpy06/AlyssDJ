// Ventana de video: muestra el video guardado de los decks locales. Los decks de stream se muestran con su propia vista.
import { LocalVideo } from './localvideo.js';

const tiles = {};
for (const id of ['A', 'B']) tiles[id] = new LocalVideo(document.getElementById(`v-${id}`));

// layout: { A: {x,y,width,height}|null, B: ... } en píxeles de la ventana; src por deck.
window.__layouts = [];
window.ytdjVideo.onLayout((layout) => {
  window.__layouts.push(JSON.stringify(layout));
  for (const id of ['A', 'B']) {
    const l = layout[id];
    const el = tiles[id].el;
    const ph = document.getElementById(`ph-${id}`);
    ph.style.display = 'none';
    if (l && !l.src && l.label) {
      // sin pista o sin video: pantalla negra con la portada atenuada y la leyenda, nunca la página de YouTube Music
      el.style.display = 'none';
      tiles[id].setSource(null);
      Object.assign(ph.style, { display: 'grid', left: `${l.x}px`, top: `${l.y}px`, width: `${l.width}px`, height: `${l.height}px` });
      const img = ph.querySelector('img');
      if (l.cover) img.src = l.cover; else img.removeAttribute('src');
      ph.querySelector('span').textContent = l.label;
      continue;
    }
    if (!l || !l.src) {
      el.style.display = 'none';
      tiles[id].setSource(null);
      continue;
    }
    Object.assign(el.style, { display: 'block', left: `${l.x}px`, top: `${l.y}px`, width: `${l.width}px`, height: `${l.height}px` });
    tiles[id].setSource(l.src);
  }
});
window.ytdjVideo.onSync((id, s) => tiles[id]?.apply({ ...s, at: performance.now() - (s.age || 0) }));
addEventListener('error', (e) => window.ytdjVideo.log?.(String(e.message)));
window.__tiles = tiles;
