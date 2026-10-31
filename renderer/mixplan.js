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

// Coste de pasar de `a` a `b` dentro de una cadena: la puntuación de la transición más una penalización cuadrática
// para que el BPM cambie poco a poco (dos saltos del 4% mejor que uno del 8%). Sin análisis de alguna de las dos: 0.
const SMOOTH = 200;
export function edgeCost(a, b) {
  if (!a?.bpm || !b?.bpm) return 0;
  const g = bpmGap(a.bpm, b.bpm);
  return scoreTransition(a, b) + (g ? SMOOTH * g.gap * g.gap : 0);
}

// Ordena la cola como una cadena que parte de `cur` y minimiza el coste total de las transiciones. `pinned` (lo que el
// usuario colocó a mano) es ancla: no se mueve y la cadena se ordena alrededor. Las pistas sin análisis (`analysisOf` sin BPM)
// quedan al final de los huecos libres, en su orden. Exacto hasta 8 pistas libres; más allá, voraz + mejora local con
// presupuesto de tiempo. No muta la entrada. Devuelve { queue, cost, scores (coste de llegar a cada pista), moved }.
export function orderChain({ cur, queue, analysisOf, pinned = new Set(), budgetMs = 120 }) {
  const n = queue.length;
  const ana = queue.map((t) => analysisOf(t) || null);
  const hasA = (i) => !!ana[i]?.bpm;
  const slots = []; // posiciones no fijadas
  for (let i = 0; i < n; i++) if (!pinned.has(queue[i].videoId)) slots.push(i);
  const ready = slots.filter((i) => hasA(i)); // índices originales de pistas libres con análisis
  const rest = slots.filter((i) => !hasA(i));
  const base = queue.map((_, i) => i); // base[pos] = índice original que ocupa pos
  const R = ready.length;
  const C = Array.from({ length: n }, () => new Float64Array(n));
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) C[a][b] = a === b ? 0 : edgeCost(ana[a], ana[b]);
  const C0 = new Float64Array(n);
  for (let b = 0; b < n; b++) C0[b] = cur?.bpm ? edgeCost(cur, ana[b]) : 0;
  const total = (seq) => {
    let c = seq.length ? C0[seq[0]] : 0;
    for (let k = 1; k < seq.length; k++) c += C[seq[k - 1]][seq[k]];
    return c;
  };
  const place = (order) => {
    // order: índices originales (libres con análisis) en el orden que ocuparán los primeros R huecos libres
    const seq = base.slice();
    slots.forEach((pos, k) => (seq[pos] = k < R ? order[k] : rest[k - R]));
    return seq;
  };
  const t0 = performance.now();
  let best = ready.slice();
  let bestSeq = place(best);
  let bestCost = total(bestSeq);
  if (R >= 2) {
    if (R <= 8) {
      // exacto: todas las permutaciones con poda por coste parcial
      const used = new Array(R).fill(false);
      const cur_ = [];
      const dfs = (k) => {
        if (k === R) {
          const c = total(place(cur_));
          if (c < bestCost - 1e-9) ((bestCost = c), (best = cur_.slice()));
          return;
        }
        for (let j = 0; j < R; j++) {
          if (used[j]) continue;
          used[j] = true;
          cur_.push(ready[j]);
          // poda: el coste de lo ya colocado (hasta el primer ancla) no puede superar el mejor
          if (partial(cur_) < bestCost) dfs(k + 1);
          cur_.pop();
          used[j] = false;
        }
      };
      const partial = (ord) => {
        const seq = place(ord.concat(ready.filter((x) => !ord.includes(x))));
        const lim = slots[ord.length - 1];
        let c = C0[seq[0]];
        for (let p = 1; p <= lim; p++) c += C[seq[p - 1]][seq[p]];
        return c;
      };
      dfs(0);
    } else {
      // voraz: en cada hueco, la pista con menor coste desde la anterior
      const left = new Set(ready);
      const ord = [];
      let prev = -1;
      for (let k = 0; k < R; k++) {
        let pick = -1;
        let pc = Infinity;
        for (const j of left) {
          const c = prev < 0 ? C0[j] : C[prev][j];
          if (c < pc) ((pc = c), (pick = j));
        }
        ord.push(pick);
        left.delete(pick);
        prev = pick;
      }
      best = ord;
      bestCost = total(place(best));
      // mejora local: intercambios e inserciones mientras mejore y haya tiempo
      let improved = true;
      while (improved && performance.now() - t0 < budgetMs) {
        improved = false;
        for (let i = 0; i < R && performance.now() - t0 < budgetMs; i++) {
          for (let j = i + 1; j < R; j++) {
            const sw = best.slice();
            [sw[i], sw[j]] = [sw[j], sw[i]];
            let c = total(place(sw));
            if (c < bestCost - 1e-9) ((best = sw), (bestCost = c), (improved = true));
            const ins = best.slice();
            ins.splice(j, 0, ins.splice(i, 1)[0]);
            c = total(place(ins));
            if (c < bestCost - 1e-9) ((best = ins), (bestCost = c), (improved = true));
          }
        }
      }
    }
    bestSeq = place(best);
  }
  const out = bestSeq.map((i) => queue[i]);
  const scores = {};
  bestSeq.forEach((i, k) => {
    scores[queue[i].videoId] = Math.round((k === 0 ? C0[i] : C[bestSeq[k - 1]][i]) * 100) / 100;
  });
  return { queue: out, cost: Math.round(bestCost * 100) / 100, scores, moved: out.some((t, k) => t.videoId !== queue[k].videoId) };
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
  const enterAt = Math.max(0, next?.mixEdit?.in ?? next?.mix?.mixIn ?? next?.offset ?? 0);

  const endPlan = () => {
    const sec = Math.min(seconds, Math.max(2, dur - pos - 1));
    return { exitAt: Math.max(pos, dur - sec - 1.2), enterAt, beats: Math.round(sec / beat), seconds: sec, style, tempo, warnings, kind: 'final' };
  };
  // Con puntos de salida editados se usan solo esos, en el orden de preferencia del usuario (la primera que aún esté por delante).
  const edited = cur.mixEdit?.outs?.length ? cur.mixEdit.outs.map((o) => ({ t: o.t, kind: 'edit' })) : null;
  const cands = edited || cur.mix?.mixOut;
  if ((!optimal && !edited) || !cands?.length || !cur.bpm) return endPlan();
  for (const c of cands) {
    if (c.t < pos - 0.25) continue; // esa salida ya pasó
    const avail = dur - c.t;
    const beats = Math.min(wantBeats, Math.floor(avail / beat / 4) * 4);
    if (beats < MIN_BEATS) continue;
    return { exitAt: c.t, enterAt, beats, seconds: beats * beat, style, tempo, warnings, kind: c.kind };
  }
  return endPlan();
}
