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
