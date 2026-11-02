// Visualizador de la vista Automix: anillos que laten con el beat. La parte pura (qué anillos y con qué intensidad) no
// toca el DOM; `Visualizer` los dibuja en un lienzo detrás de la portada.
const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));
const frac = (x) => x - Math.floor(x);

// Fase (0–1) dentro del beat y beat (0–3) dentro del compás de 4.
export function beatPhase(pos, bpm, offset = 0) {
  if (!(bpm > 0) || !Number.isFinite(pos)) return 0;
  return frac(((pos - (offset || 0)) * bpm) / 60);
}
export function beatInBar(pos, bpm, offset = 0) {
  if (!(bpm > 0) || !Number.isFinite(pos)) return 0;
  const n = Math.floor(((pos - (offset || 0)) * bpm) / 60);
  return ((n % 4) + 4) % 4;
}

const STILL = [0.25, 0.5, 0.75];

// r en 0–1 (0 = borde de la portada, 1 = radio máximo), a = opacidad, w = factor de grosor.
export function deckRings({ level = 0, gain = 1, bpm = 0, pos = 0, offset = 0, playing = false, reduced = false } = {}) {
  const lv = clamp01(level);
  const g = clamp01(gain);
  const intensity = playing ? (0.25 + 0.75 * lv) * g : 0;
  if (!playing) return { intensity: 0, pulse: 0, rings: STILL.map((r) => ({ r, a: 0.12, w: 1 })) };
  if (!(bpm > 0)) return { intensity, pulse: 0, rings: [{ r: 0.3 + 0.2 * lv, a: 0.5 * intensity, w: 1 }] };
  const phase = reduced ? 0 : beatPhase(pos, bpm, offset);
  const accent = reduced ? 0 : beatInBar(pos, bpm, offset) === 0 ? 1 - phase : 0;
  const rings = [];
  for (let k = 0; k < 4; k++) {
    const r = (k + phase) / 4;
    let a = intensity * Math.pow(1 - r, 1.5);
    if (k === 0) a *= Math.min(1, phase * 6 + (reduced ? 1 : 0));
    const hot = k < 2 ? accent : 0;
    rings.push({ r, a: a * (1 + 0.3 * hot), w: 1 + 0.8 * hot });
  }
  const pulse = reduced ? 0 : Math.exp(-5 * phase) * lv * g;
  return { intensity, pulse, rings };
}

// decks: [{ id, level, gain, bpm, pos, offset, playing }] → un resultado por deck, con su color.
export function vizScene(decks, { reduced = false } = {}) {
  return decks.map((d) => ({ id: d.id, ...deckRings({ ...d, reduced }) }));
}
export const pulseOf = (scene) => scene.reduce((m, s) => Math.max(m, s.pulse), 0);

// Dibuja los anillos en el lienzo detrás de la portada. Solo corre (a ≤ 30 fps) mientras la vista Automix, la ventana y el
// visualizador están activos; con movimiento reducido dibuja un cuadro estático cuando algo cambia.
export class Visualizer {
  constructor({ canvas, cover, getDecks, isOn }) {
    this.canvas = canvas;
    this.cover = cover;
    this.getDecks = getDecks;
    this.isOn = isOn;
    this.ctx = canvas.getContext('2d');
    this.raf = 0;
    this.last = 0;
    this.frames = 0;
    this.lvl = {};
    this.colors = {};
    this.sig = '';
    this.forceReduced = null; // las pruebas pueden forzarlo
    this.mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.mq?.addEventListener?.('change', () => this.refresh());
    document.addEventListener('visibilitychange', () => this.refresh());
    addEventListener('resize', () => this.refresh());
  }

  reducedMotion() {
    return this.forceReduced ?? !!this.mq?.matches;
  }

  shouldRun() {
    return !!this.isOn() && document.body.dataset.view === 'automix' && !document.hidden;
  }

  // Pone el bucle en el estado que toca: parado, un cuadro estático o animando.
  refresh() {
    const on = !!this.isOn();
    this.canvas.hidden = !on;
    if (!this.shouldRun()) {
      this.stop();
      if (!on) this.clear();
      return;
    }
    if (this.reducedMotion()) {
      this.stop();
      // un cuadro estático solo cuando cambia algo que se ve (tamaño, qué decks suenan, su ganancia), no en cada refresco
      const sig = `${this.canvas.clientWidth}x${this.canvas.clientHeight}|${this.getDecks().map((d) => `${d.id}${d.playing ? 1 : 0}${d.bpm > 0 ? 1 : 0}${Math.round((d.gain || 0) * 10)}`).join(',')}`;
      if (sig !== this.sig) {
        this.sig = sig;
        this.drawFrame();
      }
    } else if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  loop(t) {
    this.raf = 0;
    if (!this.shouldRun() || this.reducedMotion()) return;
    if (t - this.last >= 33) {
      this.last = t;
      this.drawFrame();
    }
    this.raf = requestAnimationFrame((n) => this.loop(n));
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  clear() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.cover.style.transform = '';
  }

  fit() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return dpr;
  }

  color(id) {
    if (!this.colors[id]) this.colors[id] = getComputedStyle(document.documentElement).getPropertyValue(id === 'A' ? '--a' : '--b').trim() || (id === 'A' ? '#22c7ff' : '#ff4f8b');
    return this.colors[id];
  }

  drawFrame() {
    const dpr = this.fit();
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const decks = this.getDecks().map((d) => {
      this.lvl[d.id] = Math.max(d.level || 0, (this.lvl[d.id] || 0) * 0.88); // el nivel sube al instante y cae suave
      return { ...d, level: this.lvl[d.id] };
    });
    const scene = vizScene(decks, { reduced: this.reducedMotion() });
    const cb = this.cover.getBoundingClientRect();
    const kb = canvas.getBoundingClientRect();
    const cx = (cb.left + cb.width / 2 - kb.left) * dpr;
    const cy = (cb.top + cb.height / 2 - kb.top) * dpr;
    const r0 = (cb.width / 2) * dpr;
    const rMax = Math.max(r0 + 20, 0.55 * Math.min(canvas.width, canvas.height));
    for (const s of scene) {
      const col = this.color(s.id);
      ctx.strokeStyle = col;
      if (s.intensity > 0) {
        const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r0 + (rMax - r0) * (0.6 + 0.1 * s.pulse));
        g.addColorStop(0, col);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.min(0.14, 0.1 * s.intensity);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r0 + (rMax - r0), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const ring of s.rings) {
        ctx.globalAlpha = Math.min(0.6, Math.max(0, ring.a));
        ctx.lineWidth = 1.5 * ring.w * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, r0 + ring.r * (rMax - r0), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const pulse = pulseOf(scene);
    this.cover.style.transform = pulse > 0.001 ? `scale(${(1 + 0.015 * pulse).toFixed(4)})` : '';
    this.frames++;
  }
}
