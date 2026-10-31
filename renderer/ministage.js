// Vista AutoMix: una miniatura por deck con el video de la pista que de verdad suena, redimensionable.
import { LocalVideo } from './localvideo.js';

export const MIN_W = 160;
export const MAX_W = 560;
export const STORE = 'alyssdj.stage';
const FRAME_FRESH_MS = 1500;
const AIR_MIX = 0.15; // por encima de esto en ambos decks hay una mezcla en curso

export const clampWidth = (px) => Math.max(MIN_W, Math.min(MAX_W, Math.round(Number(px) || 320)));

// Qué enseña la miniatura de un deck. El video solo sale si corresponde a la pista cargada (videoKey === trackId).
export function pickMedia({ trackId, videoKey, videoSrc, source, frameUrl, frameAgeMs = Infinity }) {
  if (!trackId) return { kind: 'cover' };
  if (source === 'local') {
    return videoSrc && videoKey === trackId ? { kind: 'video', src: videoSrc } : { kind: 'cover', label: 'Solo audio' };
  }
  if (frameUrl && frameAgeMs < FRAME_FRESH_MS) return { kind: 'frame', src: frameUrl };
  return { kind: 'cover' };
}

// Qué decks están "al aire": el de más peso; ambos si hay mezcla en curso. weight = suena × volumen de canal.
export function airWeights(weights) {
  const max = Math.max(0, ...weights);
  if (max <= 0) return weights.map(() => false);
  if (weights.every((w) => w > AIR_MIX)) return weights.map(() => true);
  return weights.map((w) => w === max);
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class MiniStage {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('stage');
    this.on = false;
    this.active = false;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
    } catch {}
    this.width = clampWidth(saved.w || 320);
    this.on = saved.on === true;
    this.tiles = {};
    for (const id of ['A', 'B']) {
      const el = this.root.querySelector(`.tile[data-deck="${id}"]`);
      const q = (s) => el.querySelector(s);
      this.tiles[id] = {
        el, cover: q('.cover'), frame: q('.frame'), video: q('video'), title: q('.t-title'), artist: q('.t-artist'),
        time: q('.t-time'), bar: q('.t-bar i'), label: q('.t-label'), lv: new LocalVideo(q('video')), syncAt: -Infinity,
      };
      el.addEventListener('dblclick', () => app.openVideo(id));
    }
    this.applyWidth();
    this.bindResize();
  }

  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ on: this.on, w: this.width }));
    } catch {}
  }

  setOn(on) {
    this.on = !!on;
    this.save();
    this.app.syncStage();
  }

  setActive(active) {
    this.active = active;
    this.root.hidden = !active;
    if (!active) for (const t of Object.values(this.tiles)) t.lv.setSource(null);
  }

  setWidth(px) {
    this.width = clampWidth(px);
    this.applyWidth();
    this.save();
  }

  applyWidth() {
    this.root.style.setProperty('--stage-w', `${this.width}px`);
    const h = this.root.querySelector('.stage-grip');
    h?.setAttribute('aria-valuenow', String(this.width));
  }

  bindResize() {
    const grip = this.root.querySelector('.stage-grip');
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        grip.setPointerCapture(e.pointerId);
      } catch {}
      const x0 = e.clientX;
      const w0 = this.width;
      // Dos teselas: arrastrar 2 px mueve cada una 1 px.
      const move = (ev) => this.setWidth(w0 + (ev.clientX - x0) / 2);
      const up = () => (grip.removeEventListener('pointermove', move), grip.removeEventListener('pointerup', up));
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') this.setWidth(this.width - 20);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') this.setWidth(this.width + 20);
      else return;
      e.preventDefault();
    });
  }

  // Llamado en cada fotograma desde el bucle de la app.
  tick(now) {
    if (!this.active) return;
    const decks = [this.app.decks.A, this.app.decks.B];
    // El volumen general afecta a los dos por igual: no cuenta para saber cuál está al aire.
    const air = airWeights(decks.map((d) => (d.st.playing ? d.mix.fader * d.mix.fader * d.xf : 0)));
    decks.forEach((d, i) => this.paint(d, this.tiles[d.id], air[i], now));
  }

  paint(d, t, air, now) {
    const tr = d.track;
    const media = pickMedia({
      trackId: tr?.videoId, videoKey: d.videoKey, videoSrc: d.videoSrc, source: d.source,
      frameUrl: d.frameUrl, frameAgeMs: now - d.frameAt,
    });
    t.kind = media.kind;
    t.lv.setSource(media.kind === 'video' ? media.src : null);
    t.video.hidden = media.kind !== 'video';
    t.frame.hidden = media.kind !== 'frame';
    if (media.kind === 'frame' && t.frame.getAttribute('src') !== media.src) t.frame.src = media.src;
    if (media.kind !== 'frame' && t.frame.hasAttribute('src')) t.frame.removeAttribute('src');
    const cover = d.el.cover.getAttribute('src');
    if (cover && t.cover.getAttribute('src') !== cover) t.cover.src = cover;
    if (!cover) t.cover.removeAttribute('src');
    t.cover.hidden = media.kind !== 'cover';
    t.label.hidden = !media.label;
    if (media.label) t.label.textContent = media.label;
    if (media.kind === 'video' && now - t.syncAt >= 250) {
      t.syncAt = now;
      t.lv.apply({ t: d.pos(), playing: !!d.st.playing, rate: d.st.rate || 1, at: now }, now);
    }
    const dur = d.st.dur || tr?.duration || 0;
    const pos = d.pos();
    const set = (el, s) => el.textContent !== s && (el.textContent = s);
    set(t.title, tr ? tr.title || 'Cargando…' : 'Sin pista');
    set(t.artist, tr?.artist || '');
    set(t.time, dur ? `-${mmss(Math.max(0, dur - pos))}` : '');
    t.bar.style.width = dur ? `${Math.min(100, (pos / dur) * 100).toFixed(1)}%` : '0';
    t.el.classList.toggle('air', air);
    t.el.classList.toggle('wait', !air);
    t.el.classList.toggle('empty', !tr);
    t.el.dataset.kind = media.kind;
    t.el.dataset.track = tr?.videoId || '';
  }
}
