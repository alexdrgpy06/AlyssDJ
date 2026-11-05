// Desde dónde empezar AutoMix y qué pista del otro deck puede ser la siguiente. Funciones puras (sin DOM ni audio).
import { bpmGap, MAX_BPM_GAP } from './mixplan.js';
import { keysCompatible } from './camelot.js';

const sub = (t) => [t?.artist, t?.local ? 'archivo' : null].filter(Boolean).join(' · ');

// Orígenes de radio disponibles. decks: { A, B } (con `track` y `st.playing`); list: pistas de la lista abierta; «Buscar» siempre está.
export function radioOrigins({ decks = {}, list = [] } = {}) {
  const out = [];
  const seen = new Set();
  const add = (id, label, track) => {
    if (!track?.videoId) return;
    out.push({ id, label, sub: sub(track), title: track.title || '', track });
    seen.add(track.videoId);
  };
  const playing = [decks.A, decks.B].find((d) => d?.track && d.st?.playing);
  if (playing) add('playing', 'Lo que suena', playing.track);
  for (const id of ['A', 'B']) if (decks[id]?.track && !seen.has(decks[id].track.videoId)) add(`deck${id}`, `Deck ${id}`, decks[id].track);
  const first = (list || []).find((t) => t?.videoId && !t.playlist);
  if (first && !seen.has(first.videoId)) add('list', 'Lista abierta', first);
  out.push({ id: 'search', label: 'Buscar…', sub: 'Elige una pista en el buscador', title: '', track: null });
  return out;
}

// Pista del otro deck que puede ser la siguiente: otra distinta, analizada y sin salto brusco de tempo ni tonalidad en choque.
export function otherDeckHead(cur, other, ana) {
  const t = other?.track;
  if (!t?.videoId || !cur?.track || t.videoId === cur.track.videoId) return null;
  const a = ana?.get?.(t.videoId) || other.analysis;
  const c = ana?.get?.(cur.track.videoId) || cur.analysis;
  if (!a?.bpm || !c?.bpm) return null;
  const g = bpmGap(c.bpm, a.bpm);
  if (!g || g.gap > MAX_BPM_GAP) return null;
  if (a.camelot && c.camelot && !keysCompatible(c.camelot, a.camelot)) return null;
  return t;
}
