// Cues musicales de una pista (subida, caída, rotura) derivados de la energía por frase del análisis, y los
// «movimientos» de efectos que AutoMix hace sobre ellos. Funciones puras (sin DOM ni audio) salvo `FxMoves`, que mueve
// la cadena de efectos de los decks que le pasan.
export const LEVELS = ['off', 'subtle', 'full'];
const JUMP = 0.3; // cambio relativo de energía entre frases que cuenta como caída o rotura (la caída además debe destacar en su tramo)
const BUILD_GROWTH = 1.25; // una subida crece al menos un 25 % de principio a fin
const MIN_BUILD = 3; // frases mínimas de una subida
const ABS = 12; // y el cambio debe ser de al menos 12 puntos de la escala 0–100: ni un susurro es una caída
const FLOOR = 10; // energía mínima del denominador (0–100): evita que el silencio dispare cues

const round3 = (v) => Math.round(v * 1000) / 1000;
const rel = (a, b) => (a - b) / Math.max(b, FLOOR);

// ana: { bpm, offset, mix: { phrases: [0–100 por frase], phraseBeats } } → [{ t, kind, strength, end? }] ordenado por t.
export function fxCues(ana) {
  const m = ana?.mix;
  const E = m?.phrases;
  if (!ana?.bpm || !(ana.bpm > 0) || !Array.isArray(E) || E.length < 4) return [];
  const beats = m.phraseBeats || 16;
  const phraseSec = (beats * 60) / ana.bpm;
  const off = ana.offset || 0;
  const tAt = (k) => round3(off + k * phraseSec);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const cues = [];
  // rotura: la energía cae ≥ 30 % y se queda baja al menos una frase más (la última frase no cuenta)
  for (let k = 1; k + 1 < E.length; k++) {
    const down = rel(E[k - 1], E[k]);
    if (down >= JUMP && E[k - 1] - E[k] >= ABS && E[k + 1] < 0.85 * E[k - 1]) cues.push({ t: tAt(k), kind: 'break', strength: round3(clamp01(down)) });
  }
  // tramos de energía estrictamente creciente [a..b]: dentro de cada uno, la caída es el salto que destaca sobre los demás
  let a = 0;
  while (a < E.length - 1) {
    let b = a;
    while (b + 1 < E.length && E[b + 1] > E[b]) b++;
    if (b > a) {
      const steps = [];
      for (let k = a + 1; k <= b; k++) steps.push({ k, r: rel(E[k], E[k - 1]) });
      const top = steps.reduce((m, st) => (st.r > m.r ? st : m), steps[0]);
      const others = steps.filter((st) => st !== top);
      const avg = others.length ? others.reduce((x, st) => x + st.r, 0) / others.length : 0;
      const isDrop = top.r >= JUMP && E[top.k] - E[top.k - 1] >= ABS && (others.length === 0 || top.r >= 1.8 * avg);
      if (isDrop) cues.push({ t: tAt(top.k), kind: 'drop', strength: round3(clamp01(top.r)) });
      // la subida llega hasta la caída (si la hay) o hasta el final del tramo
      const last = isDrop ? top.k - 1 : b;
      if (last - a + 1 >= MIN_BUILD && E[last] >= BUILD_GROWTH * Math.max(E[a], FLOOR)) {
        cues.push({ t: tAt(a), kind: 'build', strength: round3(clamp01(E[last] / Math.max(E[a], FLOOR) - 1)), end: tAt(isDrop ? top.k : last + 1) });
      }
    }
    a = Math.max(b, a + 1);
  }
  const order = { build: 0, drop: 1, break: 2 };
  return cues.sort((x, y) => x.t - y.t || order[x.kind] - order[y.kind]);
}
