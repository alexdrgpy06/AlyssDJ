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
