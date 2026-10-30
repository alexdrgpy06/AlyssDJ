// Sampler de 8 pads: sonidos sintetizados de fábrica (sin archivos) o tus propios audios. Sale por el dispositivo master.
import { register } from './controls.js';

const LS = 'alyssdj:sampler';
const NAMES = ['KICK', 'SNARE', 'CLAP', 'HAT', 'AIR HORN', 'SIREN', 'RISER', 'IMPACT'];
const KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];

// ---------- sonidos de fábrica ----------
function make(ctx, len, fn) {
  const n = Math.floor(ctx.sampleRate * len);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  fn(d, ctx.sampleRate, n);
  buf.getChannelData(1).set(d);
  return buf;
}
const noise = () => Math.random() * 2 - 1;

const FACTORY = [
  (ctx) => make(ctx, 0.5, (d, sr, n) => { // kick
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * (45 + 120 * Math.exp(-t * 28))) / sr;
      d[i] = Math.sin(ph) * Math.exp(-t * 7) * 0.95;
    }
  }),
  (ctx) => make(ctx, 0.32, (d, sr, n) => { // snare
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (noise() * Math.exp(-t * 16) * 0.7 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 28) * 0.5) * 0.9;
    }
  }),
  (ctx) => make(ctx, 0.4, (d, sr, n) => { // clap: ráfagas de ruido
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const burst = [0, 0.012, 0.024].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) * 90) : 0), 0);
      d[i] = noise() * (burst * 0.35 + Math.exp(-t * 14) * 0.45);
    }
  }),
  (ctx) => make(ctx, 0.14, (d, sr, n) => { // hat: ruido derivado (agudos)
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const x = noise();
      d[i] = (x - prev) * Math.exp(-(i / sr) * 38) * 0.55;
      prev = x;
    }
  }),
  (ctx) => make(ctx, 1.3, (d, sr, n) => { // bocina
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 6 * t);
      let v = 0;
      for (const f of [466, 587, 698]) v += ((((t * f * vib) % 1) * 2 - 1) * 0.5) + Math.sin(2 * Math.PI * f * vib * t) * 0.3;
      d[i] = v * 0.32 * Math.min(1, t * 80) * (t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.2) : 1);
    }
  }),
  (ctx) => make(ctx, 1.8, (d, sr, n) => { // sirena
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * (700 + 350 * Math.sin(2 * Math.PI * 1.4 * t))) / sr;
      d[i] = Math.sin(ph) * 0.5 * Math.min(1, t * 30) * Math.min(1, (1.8 - t) * 6);
    }
  }),
  (ctx) => make(ctx, 3, (d, sr, n) => { // riser: ruido con filtro que sube
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += (noise() - lp) * (0.01 + 0.9 * t * t);
      d[i] = lp * (0.15 + 0.85 * t) * 0.9 * (t > 0.97 ? (1 - t) / 0.03 : 1);
    }
  }),
  (ctx) => make(ctx, 1.8, (d, sr, n) => { // impacto
    let ph = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * (28 + 40 * Math.exp(-t * 3))) / sr;
      lp += (noise() - lp) * 0.08;
      d[i] = (Math.sin(ph) * Math.exp(-t * 2.2) * 0.9 + lp * Math.exp(-t * 6) * 0.9) * 0.9;
    }
  }),
];

export class Sampler {
  constructor(app) {
    this.app = app;
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(this.ctx.destination);
    this.buffers = FACTORY.map((f) => f(this.ctx));
    this.slots = NAMES.map((name) => ({ name, id: null }));
    try {
      const saved = JSON.parse(localStorage.getItem(LS) || '[]');
      saved.forEach((s, i) => s && this.slots[i] && Object.assign(this.slots[i], s));
    } catch {}
    this.pads = [];
    this.build();
    this.restore();
  }

  save() {
    try {
      localStorage.setItem(LS, JSON.stringify(this.slots));
    } catch {}
  }

  async restore() {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].id) await this.fetchInto(i, this.slots[i].id).catch(() => this.reset(i, false));
    }
  }

  async fetchInto(i, id) {
    const res = await fetch(`/localfile/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('archivo no disponible');
    this.buffers[i] = await this.ctx.decodeAudioData(await res.arrayBuffer());
    this.render();
  }

  reset(i, save = true) {
    this.slots[i] = { name: NAMES[i], id: null };
    this.buffers[i] = FACTORY[i](this.ctx);
    if (save) this.save();
    this.render();
  }

  async setRouting(r) {
    if (!this.ctx.setSinkId) return;
    try {
      await this.ctx.setSinkId(await window.YTDJChain.findSinkId(r.masterLabel));
    } catch {}
  }

  play(i) {
    if (this.ctx.state !== 'running') this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[i];
    src.connect(this.out);
    src.start();
    const pad = this.pads[i];
    pad?.classList.add('hit');
    setTimeout(() => pad?.classList.remove('hit'), 140);
  }

  async load(i) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const r = await window.ytdj.local.register(window.ytdj.local.pathFor(file));
      if (!r.ok) return this.app.toast(r.error, true);
      try {
        await this.fetchInto(i, r.data.videoId);
        this.slots[i] = { name: (r.data.title || file.name).slice(0, 14).toUpperCase(), id: r.data.videoId };
        this.save();
        this.render();
      } catch (e) {
        this.app.toast(`No se pudo cargar el audio: ${e.message}`, true);
      }
    };
    input.click();
  }

  build() {
    const grid = document.getElementById('sp-pads');
    grid.innerHTML = '';
    this.slots.forEach((_, i) => {
      const cell = document.createElement('div');
      cell.className = 'sp-cell';
      cell.innerHTML = `<button class="sp-pad" aria-label="Pad ${i + 1}"><b></b><small>${KEYS[i]}</small></button><button class="sp-load ghost sm" title="Cargar un archivo en este pad (clic derecho en el pad: restaurar)">Cargar…</button>`;
      const pad = cell.querySelector('.sp-pad');
      pad.addEventListener('pointerdown', (e) => e.button === 0 && !this.app.learning && this.play(i));
      pad.addEventListener('contextmenu', (e) => (e.preventDefault(), this.reset(i)));
      cell.querySelector('.sp-load').addEventListener('click', () => this.load(i));
      register(`sampler.pad${i + 1}`, { kind: 'button', press: (d) => d && this.play(i) }, pad);
      grid.append(cell);
      this.pads[i] = pad;
    });
    const vol = document.getElementById('sp-vol');
    vol.addEventListener('input', () => (this.out.gain.value = Number(vol.value)));
    register('sampler.volume', { kind: 'range', setNorm: (n) => ((vol.value = n), (this.out.gain.value = n)) }, vol);
    this.render();
  }

  render() {
    this.pads.forEach((p, i) => {
      p.firstElementChild.textContent = this.slots[i].name;
      p.classList.toggle('custom', !!this.slots[i].id);
    });
  }

  key(code) {
    const i = KEYS.indexOf(code);
    if (i < 0) return false;
    this.play(i);
    return true;
  }
}
