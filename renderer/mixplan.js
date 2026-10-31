// Plan de mezcla (funciones puras): cuándo salir de la pista que suena, dónde entrar en la siguiente, cuánto dura
// la transición y qué pista conviene después. Los pesos están a la vista para ajustarlos escuchando.
import { keysCompatible } from './camelot.js';

export const MAX_BPM_GAP = 0.08; // por encima, el salto de tempo se considera brusco
export const PITCH_LIMIT = 0.08; // máximo ajuste de pitch al igualar tempos
export const HOME_MS = 14000; // el tempo natural vuelve poco a poco durante al menos 12 s
const MIN_BEATS = 8;
const W = { bpm: 3, keyOk: 2, keyBad: 6, keyUnknown: 3, bpmUnknown: 12, energy: 0.05, jump: 100 };

// Diferencia relativa de tempo necesaria para igualar `cand` a `cur`, mirando también doble y mitad.
export function bpmGap(curBpm, candBpm) {
  if (!curBpm || !candBpm) return null;
  let best = null;
  for (const f of [1, 2, 0.5]) {
    const r = (curBpm * f) / candBpm;
    if (best === null || Math.abs(r - 1) < Math.abs(best.ratio - 1)) best = { ratio: r, factor: f };
  }
  return { gap: Math.abs(best.ratio - 1), ratio: best.ratio, factor: best.factor };
}

const keyPenalty = (a, b) => (!a || !b ? W.keyUnknown : a === b || keysCompatible(a, b) ? (a === b ? 0 : W.keyOk) : W.keyBad);

// Energía (0..100) de la frase que contiene el instante t.
export function energyAt(ana, t) {
  const m = ana?.mix;
  if (!m?.phrases?.length || !ana.bpm) return null;
  const k = Math.floor((t - (ana.offset || 0)) / ((m.phraseBeats * 60) / ana.bpm));
  return m.phrases[Math.max(0, Math.min(m.phrases.length - 1, k))];
}

// Menor puntuación = mejor transición. `exitAt` es el instante de salida de `cur` (por defecto, su mejor candidato).
export function scoreTransition(cur, cand, exitAt) {
  const g = bpmGap(cur?.bpm, cand?.bpm);
  let score = g ? W.bpm * g.gap * 100 : W.bpmUnknown;
  if (g && g.gap > MAX_BPM_GAP) score += W.jump;
  score += keyPenalty(cur?.camelot, cand?.camelot);
  const eo = energyAt(cur, exitAt ?? cur?.mix?.mixOut?.[0]?.t ?? 0);
  const ei = energyAt(cand, cand?.mix?.mixIn ?? 0);
  if (eo != null && ei != null) score += W.energy * Math.abs(eo - ei);
  return Math.round(score * 100) / 100;
}

// Ordena la cola. Lo que el usuario colocó a mano (`pinned`) es un ancla: se queda en su posición. El resto se reparte
// por los huecos libres: primero las listas, de mejor a peor transición, y al final lo que aún no está listo, en su orden.
// No muta la entrada.
export function pickNext({ cur, queue, isReady, analysisOf, pinned = new Set() }) {
  const ready = [];
  const rest = [];
  queue.forEach((t, i) => {
    if (pinned.has(t.videoId)) return;
    if (isReady(t)) ready.push({ t, i, s: scoreTransition(cur, analysisOf(t) || {}) });
    else rest.push(t);
  });
  ready.sort((a, b) => a.s - b.s || a.i - b.i);
  const free = [...ready.map((r) => r.t), ...rest];
  let f = 0;
  const out = queue.map((t) => (pinned.has(t.videoId) ? t : free[f++]));
  return { queue: out, scores: Object.fromEntries(ready.map((r) => [r.t.videoId, r.s])) };
}

// Plan de la transición entre `cur` (suena, en `pos`) y `next`.
//   cur/next: análisis ({ bpm, offset, mix, duration }). cfg: { len (s), optimal, style }.
export function planTransition(cur, next, { len = 16, optimal = true, pos = 0 } = {}) {
  const dur = cur.duration || 0;
  const bpm = cur.bpm || 120;
  const beat = 60 / bpm;
  const warnings = [];
  const gap = bpmGap(cur.bpm, next?.bpm);
  let tempo = !!gap && gap.gap <= MAX_BPM_GAP;
  let style = null;
  let seconds = len;
  if (gap && gap.gap > MAX_BPM_GAP) {
    // Salto brusco: no se fuerza el tempo; transición larga con filtro para que no se note.
    warnings.push(`salto de BPM ${gap.ratio > 1 ? '−' : '+'}${Math.round(gap.gap * 100)} %`);
    style = 'filter';
    seconds = Math.min(len * 1.5, 48);
  } else if (!gap) warnings.push('sin BPM: fundido simple');
  const wantBeats = Math.max(MIN_BEATS, Math.round(seconds / beat / 4) * 4);
  const enterAt = Math.max(0, next?.mix?.mixIn ?? next?.offset ?? 0);

  const endPlan = () => {
    const sec = Math.min(seconds, Math.max(2, dur - pos - 1));
    return { exitAt: Math.max(pos, dur - sec - 1.2), enterAt, beats: Math.round(sec / beat), seconds: sec, style, tempo, warnings, kind: 'final' };
  };
  const cands = cur.mix?.mixOut;
  if (!optimal || !cands?.length || !cur.bpm) return endPlan();
  for (const c of cands) {
    if (c.t < pos - 0.25) continue; // esa salida ya pasó
    const avail = dur - c.t;
    const beats = Math.min(wantBeats, Math.floor(avail / beat / 4) * 4);
    if (beats < MIN_BEATS) continue;
    return { exitAt: c.t, enterAt, beats, seconds: beats * beat, style, tempo, warnings, kind: c.kind };
  }
  return endPlan();
}
