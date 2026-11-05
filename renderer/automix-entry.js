// Tarjeta «SIGUE»: punto de entrada elegido para la pista que sigue (tiempo, compás y motivo) sobre una tira con la energía por frase.
// Arrastrar la línea (o ← → con el foco) elige otro compás y lo guarda como entrada editada de esa pista; «Auto» vuelve al cálculo automático.
const $ = (s) => document.querySelector(s);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class EntryStrip {
  constructor() {
    this.box = $('#amv-entry');
    this.cv = $('#amv-entry-strip');
    this.e = null; // última entrada pintada
    this.drag = null; // { t } mientras se arrastra
    this.timer = null;
    this.cv.addEventListener('pointerdown', (e) => this.down(e));
    this.cv.addEventListener('pointermove', (e) => { if (this.drag) this.move(e); });
    this.cv.addEventListener('pointerup', (e) => this.up(e));
    this.cv.addEventListener('pointercancel', () => { this.drag = null; this.paint(); });
    this.cv.addEventListener('keydown', (e) => this.key(e));
    $('#amv-entry-auto').addEventListener('click', () => this.save(null));
  }

  // `e` es `state().entry` y `color` el del deck que entra.
  render(e, color) {
    this.e = e;
    this.color = color;
    this.box.hidden = !e;
    if (!e) return;
    $('#amv-entry-time').textContent = e.bar ? `${mmss(e.t)} · compás ${e.bar}` : mmss(e.t);
    $('#amv-entry-why').textContent = e.user ? 'marcada por ti' : e.why;
    $('#amv-entry-safe').hidden = e.kind !== 'safe';
    $('#amv-entry-auto').hidden = !e.user;
    this.cv.hidden = !e.strip;
    this.cv.setAttribute('aria-valuemin', '0');
    this.cv.setAttribute('aria-valuemax', String(Math.round(e.duration || 0)));
    this.cv.setAttribute('aria-valuenow', String(Math.round(e.t)));
    this.cv.setAttribute('aria-valuetext', `${mmss(e.t)}, compás ${e.bar || '?'}`);
    if (!this.drag) this.paint();
  }

  paint() {
    const e = this.e; if (!e?.strip) return;
    const cv = this.cv; const dpr = window.devicePixelRatio || 1;
    const w = Math.max(40, Math.round(cv.clientWidth || 240)); const h = 28;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const { phrases, phraseSec, offset } = e.strip; const dur = e.duration || phrases.length * phraseSec + offset;
    const px = (t) => (t / dur) * w;
    g.fillStyle = this.color || '#9aa3b2'; g.globalAlpha = 0.75;
    phrases.forEach((v, k) => { const x0 = px(offset + k * phraseSec); const bw = Math.max(1, px(phraseSec) - 1); const bh = Math.max(1, (v / 100) * (h - 4)); g.fillRect(x0, h - bh - 1, bw, bh); });
    g.globalAlpha = 1;
    const t = this.drag ? this.drag.t : e.t;
    g.fillStyle = '#fff'; g.fillRect(Math.round(px(t)) - 1, 0, 2, h);
    g.beginPath(); g.moveTo(px(t) - 4, 0); g.lineTo(px(t) + 4, 0); g.lineTo(px(t), 5); g.closePath(); g.fill();
  }

  // Compás más cercano a `t` (rejilla de la pista), dentro de la pista.
  snap(t) {
    const { beat } = this.e.strip; const off = this.e.strip.offset; const bar = 4 * beat;
    const k = Math.max(0, Math.round((t - off) / bar));
    return Math.min(Math.max(0, (this.e.duration || 0) - 8), Math.round((off + k * bar) * 1000) / 1000);
  }

  at(ev) { const r = this.cv.getBoundingClientRect(); return this.snap(((ev.clientX - r.left) / r.width) * (this.e.duration || 1)); }

  down(ev) {
    if (!this.e?.strip) return;
    try { this.cv.setPointerCapture?.(ev.pointerId); } catch { /* puntero sintético */ }
    this.cv.focus();
    this.drag = { t: this.at(ev) }; this.paint();
  }

  move(ev) { this.drag.t = this.at(ev); this.paint(); }

  up(ev) {
    if (!this.drag) return;
    const t = this.at(ev); this.drag = null;
    this.save(t);
  }

  key(ev) {
    if (!this.e?.strip || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    ev.preventDefault();
    const step = 4 * this.e.strip.beat * (ev.key === 'ArrowRight' ? 1 : -1);
    const t = this.snap(this.e.t + step);
    this.e = { ...this.e, t }; this.paint(); // se ve al instante; se guarda al dejar de pulsar
    clearTimeout(this.timer); this.timer = setTimeout(() => this.save(t), 350);
  }

  async save(t) {
    const e = this.e; if (!e?.id) return;
    const edit = t == null ? (e.outs?.length ? { in: null, outs: e.outs, free: e.free } : null) : { in: t, outs: e.outs || [], free: !!e.free };
    await window.ytdj.analysis.setMixEdit(e.id, edit);
  }
}
