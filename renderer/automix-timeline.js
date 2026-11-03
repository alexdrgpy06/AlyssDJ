// Línea de tiempo de la próxima mezcla: la pista que sale (arriba) y la que entra (abajo) alineadas en el punto de mezcla,
// con el solape, los gestos de la receta y el cabezal. Se arrastra la salida, la entrada y el final del solape (duración).
import { startPreview } from './mixpreview.js';

const $ = (s) => document.querySelector(s);
const mmss = (t) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
export const PRE = 20; // s mostrados antes del punto de mezcla
export const POST = 12; // s mostrados después de que acabe el solape
const H = 76;
const GRAB = 9; // px de tolerancia para agarrar un asa

// Geometría pura: tiempo relativo al punto de mezcla (u) ↔ píxel.
export function geometry(len, width) {
  const span = PRE + len + POST;
  return { span, x: (u) => ((u + PRE) / span) * width, u: (px) => (px / width) * span - PRE, sec: span / width };
}

// Asa bajo el puntero: 'len' (final del solape), 'exit' (arriba) o 'in' (abajo); null si ninguna.
export function hit(len, width, px, py) {
  const g = geometry(len, width);
  if (Math.abs(px - g.x(len)) <= GRAB) return 'len';
  if (Math.abs(px - g.x(0)) <= GRAB) return py < H / 2 ? 'exit' : 'in';
  return null;
}

// Energía (0..100) de la pista `s` en el instante absoluto t, o null si queda fuera o no hay tira.
function energy(s, t) {
  if (!s) return null;
  const k = Math.floor((t - s.offset + 0.01) / s.phraseSec);
  return k < 0 || k >= s.phrases.length ? null : s.phrases[k];
}

export class Timeline {
  constructor(app) {
    this.app = app;
    this.box = $('#amtl');
    this.cv = $('#amtl-cv');
    this.t = null; // última línea de tiempo recibida
    this.drag = null; // { kind, x0, base, cur }
    this.preview = null;
    this.cv.addEventListener('pointerdown', (e) => this.down(e));
    this.cv.addEventListener('pointermove', (e) => (this.drag ? this.move(e) : this.hover(e)));
    this.cv.addEventListener('pointerup', (e) => this.up(e));
    this.cv.addEventListener('pointercancel', () => { this.drag = null; this.paint(); });
    this.cv.addEventListener('keydown', (e) => this.key(e));
    $('#amtl-preview').addEventListener('click', () => (this.preview ? this.stopPreview() : this.startPreview()));
  }

  render(t, colors) {
    this.t = t;
    this.colors = colors;
    this.box.hidden = !t;
    if (!t) return;
    const canPrev = !!(t.cur.url && t.next.url);
    $('#amtl-preview').disabled = !canPrev && !this.preview;
    $('#amtl-preview').title = canPrev ? 'Escucha esta transición por los auriculares antes de que ocurra' : 'Necesita las dos pistas guardadas como archivo local';
    $('#amtl-preview span').textContent = this.preview ? 'Detener' : 'Escuchar';
    if (!this.drag) this.paint();
  }

  // Valores efectivos (con el arrastre en curso aplicado).
  vals() {
    const t = this.t;
    const d = this.drag;
    return { exitAt: d?.kind === 'exit' ? d.cur : t.exitAt, enterAt: d?.kind === 'in' ? d.cur : t.enterAt, len: d?.kind === 'len' ? d.cur : t.len };
  }

  paint() {
    const t = this.t; if (!t) return;
    const cv = this.cv; const dpr = window.devicePixelRatio || 1;
    const w = Math.max(80, Math.round(cv.clientWidth || 360));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, H);
    const v = this.vals(); const geo = geometry(v.len, w);
    const rowH = H / 2 - 5;
    const row = (s, at, y0, color) => {
      g.fillStyle = color; g.globalAlpha = 0.8;
      for (let px = 0; px < w; px += 2) {
        const e = energy(s, at + geo.u(px + 1));
        if (e == null) continue;
        const bh = Math.max(1, (e / 100) * rowH);
        g.fillRect(px, y0 + rowH - bh, 1.5, bh);
      }
      g.globalAlpha = 1;
    };
    row(t.cur.strip, v.exitAt, 2, this.colors?.cur || '#6aa7ff');
    row(t.next.strip, v.enterAt, H / 2 + 3, this.colors?.next || '#ff9f43');
    // solape
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(geo.x(0), 0, geo.x(v.len) - geo.x(0), H);
    // gestos de la receta (escalados a la duración efectiva)
    const k = t.recipeLen ? v.len / t.recipeLen : 1;
    g.fillStyle = 'rgba(255,255,255,.55)';
    t.gestures.forEach((s, i) => { const a = geo.x(s.at * k); const b = Math.max(a + 2, geo.x(s.end * k)); g.fillRect(a, H / 2 - 2 + ((i % 3) - 1) * 3, b - a, 2); });
    // asas
    g.fillStyle = '#fff';
    g.fillRect(Math.round(geo.x(0)) - 1, 0, 2, H);
    g.fillRect(Math.round(geo.x(v.len)) - 1, 0, 2, H);
    g.beginPath(); g.moveTo(geo.x(0) - 5, 0); g.lineTo(geo.x(0) + 5, 0); g.lineTo(geo.x(0), 6); g.fill();
    g.beginPath(); g.moveTo(geo.x(0) - 5, H); g.lineTo(geo.x(0) + 5, H); g.lineTo(geo.x(0), H - 6); g.fill();
    // cabezal
    if (Number.isFinite(t.pos)) {
      const px = geo.x(t.pos - v.exitAt);
      if (px >= 0 && px <= w) { g.fillStyle = '#ff4d6d'; g.fillRect(Math.round(px) - 1, 0, 2, H); }
    }
    $('#amtl-info').textContent = `Sale ${mmss(v.exitAt)} · entra ${mmss(v.enterAt)} · ${Math.round(v.len)} s`;
    cv.setAttribute('aria-valuetext', $('#amtl-info').textContent);
  }

  local(ev) { const r = this.cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top, w: r.width || this.cv.clientWidth || 360 }; }

  hover(ev) {
    if (!this.t) return;
    const p = this.local(ev);
    this.cv.style.cursor = { len: 'ew-resize', exit: 'col-resize', in: 'col-resize' }[hit(this.t.len, p.w, p.x, p.y)] || 'default';
  }

  down(ev) {
    if (!this.t) return;
    const p = this.local(ev);
    const kind = hit(this.t.len, p.w, p.x, p.y);
    if (!kind) return;
    try { this.cv.setPointerCapture?.(ev.pointerId); } catch { /* puntero sintético */ }
    this.cv.focus();
    const base = { exit: this.t.exitAt, in: this.t.enterAt, len: this.t.len }[kind];
    this.drag = { kind, x0: p.x, w: p.w, base, cur: base, sec: geometry(this.t.len, p.w).sec };
    this.paint();
  }

  // Compás (de la pista que corresponda) más cercano a t, dentro de la pista.
  snap(kind, t) {
    const s = kind === 'exit' ? this.t.cur : this.t.next;
    const dur = kind === 'exit' ? this.t.cur.duration : this.t.next.duration;
    if (!s?.strip || !s.beat) return Math.max(0, Math.min(dur || t, t));
    const bar = 4 * s.beat; const k = Math.max(0, Math.round((t - s.offset) / bar));
    return Math.min(Math.max(0, dur - 4), Math.round((s.offset + k * bar) * 1000) / 1000);
  }

  value(kind, base, dx, sec) {
    if (kind === 'len') return Math.max(4, Math.min(48, Math.round(base + dx * sec)));
    return this.snap(kind, base + dx * sec);
  }

  move(ev) {
    const d = this.drag; const p = this.local(ev);
    d.cur = this.value(d.kind, d.base, p.x - d.x0, d.sec);
    this.paint();
  }

  up(ev) {
    const d = this.drag; if (!d) return;
    const p = this.local(ev);
    this.drag = null;
    this.commit(d.kind, this.value(d.kind, d.base, p.x - d.x0, d.sec));
  }

  key(ev) {
    if (!this.t || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    ev.preventDefault();
    const s = ev.key === 'ArrowRight' ? 1 : -1;
    if (ev.shiftKey) return this.commit('len', Math.max(4, Math.min(48, Math.round(this.t.len) + s)));
    const bar = 4 * (this.t.cur.beat || 0.5);
    this.commit('exit', this.snap('exit', this.t.exitAt + s * bar));
  }

  async commit(kind, value) {
    const t = this.t; if (!t) return;
    if (kind === 'len') return this.app.automix.setCfg({ len: value });
    if (kind === 'exit') return window.ytdj.analysis.setMixEdit(t.curId, { in: t.cur.edit?.in ?? null, outs: [{ t: value }], free: !!t.cur.edit?.free });
    return window.ytdj.analysis.setMixEdit(t.nextId, { in: value, outs: t.next.edit?.outs || [], free: !!t.next.edit?.free });
  }

  async startPreview() {
    const t = this.t; if (!t || !t.cur.url || !t.next.url) return;
    this.preview = await startPreview({
      aUrl: t.cur.url, bUrl: t.next.url, a: t.cur.ana, b: t.next.ana, exitAt: t.exitAt, len: t.len,
      cueLabel: this.app.settings?.output?.cueLabel || '',
      onEnd: () => { this.preview = null; this.render(this.t, this.colors); },
    });
    this.render(this.t, this.colors);
  }

  stopPreview() {
    this.preview?.stop?.();
    this.preview = null;
    this.render(this.t, this.colors);
  }
}
