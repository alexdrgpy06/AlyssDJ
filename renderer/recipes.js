// Recetas de transición de AutoMix: cada estilo es una línea de tiempo de gestos sobre la rejilla de la pista que sale.
// Funciones puras (sin DOM ni audio): `chooseStyle` elige la receta según el análisis y `planRecipe` la convierte en gestos.
import { bpmGap, MAX_BPM_GAP } from './mixplan.js';
import { keysCompatible } from './camelot.js';
import { fxCues } from './fxcues.js';

export const STYLES = ['auto', 'bass', 'filter', 'crossfade', 'echo-cut', 'drop-cut'];
export const STYLE_LABEL = { bass: 'bass swap', filter: 'filtro', crossfade: 'fundido', 'echo-cut': 'eco y corte', 'drop-cut': 'corte en la caída' };
const LONG_BEATS = 32; // outro e intro de al menos 8 compases para un bass swap
const MODERATE_GAP = 0.03; // por encima de un 3 % de BPM, el filtro disimula mejor que el bass swap

const r3 = (v) => Math.round(v * 1000) / 1000;

// Energía (0–100) de la frase de `ana` que contiene t; null si no hay datos.
function energy(ana, t) {
  const E = ana?.mix?.phrases;
  if (!ana?.bpm || !Array.isArray(E) || !E.length) return null;
  const phrase = ((ana.mix.phraseBeats || 16) * 60) / ana.bpm;
  const k = Math.max(0, Math.min(E.length - 1, Math.floor((t - (ana.offset || 0)) / phrase)));
  return E[k];
}

// ¿La saliente tiene una rotura (o su energía cae) dentro de la mezcla y la entrante entra fuerte?
function dropEntry(cur, next, plan) {
  const end = plan.exitAt + plan.seconds;
  const hasBreak = fxCues(cur).some((c) => c.kind === 'break' && c.t >= plan.exitAt && c.t <= end);
  const E = next?.mix?.phrases;
  if (!hasBreak || !Array.isArray(E) || !E.length) return false;
  const e = energy(next, plan.enterAt ?? next.mix?.mixIn ?? next.offset ?? 0);
  return e != null && e >= 0.7 * Math.max(...E);
}

// → { style, why }. Con un estilo fijo se respeta; con 'auto' decide el análisis (BPM, tonalidad, estructura).
export function chooseStyle(cur, next, plan, cfgStyle = 'auto') {
  if (cfgStyle && cfgStyle !== 'auto' && STYLES.includes(cfgStyle)) return { style: cfgStyle, why: 'estilo elegido' };
  const gap = bpmGap(cur?.bpm, next?.bpm);
  if (!gap) return { style: 'crossfade', why: 'sin BPM en alguna de las dos' };
  if (gap.gap > MAX_BPM_GAP) return { style: 'echo-cut', why: `salto de BPM de ${Math.round(gap.gap * 100)} %` };
  const ck = cur.camelot, nk = next.camelot;
  if (ck && nk && ck !== nk && !keysCompatible(ck, nk)) return { style: 'echo-cut', why: `tonalidades en conflicto (${ck} → ${nk})` };
  if (dropEntry(cur, next, plan)) return { style: 'drop-cut', why: 'rotura de la saliente y la entrante entra fuerte' };
  if (gap.gap > MODERATE_GAP) return { style: 'filter', why: `BPM algo distinto (${Math.round(gap.gap * 100)} %)` };
  const beat = 60 / cur.bpm;
  const outroBeats = ((cur.duration || 0) - plan.exitAt) / beat;
  const introBeats = next.mix?.introEnd != null ? (next.mix.introEnd - (plan.enterAt ?? next.mix.mixIn ?? 0)) / beat : null;
  if (outroBeats >= LONG_BEATS && (introBeats == null || introBeats >= LONG_BEATS)) return { style: 'bass', why: 'BPM y tonalidad compatibles, outro e intro largos' };
  return { style: 'filter', why: 'outro o intro cortos' };
}

const g = (id, deck, param, from, to, at, end, curve = 'ease', extra = {}) => ({ id, deck, param, from, to, at, end, curve, ...extra });

// Receta de `style` sobre la rejilla de la saliente. Devuelve { style, len, gestures }; `len` ≤ plan.seconds.
//   Gesto: { id, deck: 'from'|'to'|'x', param: 'eqLow'|'filter'|'x'|'fx', from, to, at, end, curve: 'lin'|'ease'|'step', fx? }
//   `at`/`end` en segundos de mezcla (0 = salida de la saliente), siempre múltiplos del pulso. x: 0 = deck saliente, 1 = entrante.
//   level: 'off' | 'subtle' | 'full' (REQ-7: 'off' quita los gestos de efecto).
export function planRecipe({ style, cur, plan, level = 'subtle' }) {
  const bpm = cur?.bpm > 0 ? cur.bpm : 120;
  const beat = 60 / bpm;
  const phraseBeats = cur?.mix?.phraseBeats || 16;
  const maxBeats = Math.max(4, Math.floor(plan.seconds / beat));
  const bars = (b) => Math.max(4, Math.floor(b / 4) * 4);
  const short = ['echo-cut', 'drop-cut'].includes(style);
  const nBeats = short ? Math.min(bars(maxBeats), 8) : bars(maxBeats);
  const len = nBeats * beat;
  const T = (b) => b * beat;
  // Swap: inicio de frase más cercano a la mitad (o compás si la mezcla es corta), con un compás limpio antes y después.
  const half = nBeats / 2;
  let swap = nBeats >= 2 * phraseBeats ? Math.round(half / phraseBeats) * phraseBeats : Math.round(half / 4) * 4;
  swap = Math.max(4, Math.min(swap, Math.max(4, nBeats - 6)));
  const out = [];
  const fx = level !== 'off';
  switch (style) {
    case 'bass':
      out.push(g('graves-entrante', 'to', 'eqLow', 0, -1, 0, 0, 'step'));
      out.push(g('fundido', 'x', 'x', 0, 1, 0, T(nBeats), 'ease'));
      out.push(g('swap-entra', 'to', 'eqLow', -1, 0, T(swap), T(swap + 2), 'ease'));
      out.push(g('swap-sale', 'from', 'eqLow', 0, -1, T(swap), T(swap + 2), 'ease'));
      break;
    case 'filter': {
      const sweep = nBeats >= 16 ? 16 : Math.max(4, nBeats >= 8 ? 8 : nBeats);
      out.push(g('graves-entrante', 'to', 'eqLow', 0, -1, 0, 0, 'step'));
      out.push(g('filtro-entra', 'to', 'filter', 0, 0.85, 0, 0, 'step'));
      out.push(g('abre-entrante', 'to', 'filter', 0.85, 0, 0, T(swap), 'ease'));
      out.push(g('swap-entra', 'to', 'eqLow', -1, 0, T(swap), T(swap + 2), 'ease'));
      out.push(g('swap-sale', 'from', 'eqLow', 0, -1, T(swap), T(swap + 2), 'ease'));
      out.push(g('barrido-saliente', 'from', 'filter', 0, -0.9, T(nBeats - sweep), T(nBeats), 'ease'));
      out.push(g('fundido', 'x', 'x', 0, 1, 0, T(nBeats), 'ease'));
      break;
    }
    case 'echo-cut':
      if (fx) out.push(g('eco-salida', 'from', 'fx', 0, 0.6, T(nBeats - 4), T(nBeats - 4) + beat, 'ease', { fx: 'echo', p: bpm >= 128 ? 0.3 : 0.6, delay: bpm >= 128 ? 0.5 : 0.75, tailMs: 4000 }));
      out.push(g('corte', 'x', 'x', 0, 1, T(nBeats), T(nBeats), 'step'));
      break;
    case 'drop-cut':
      out.push(g('graves-entrante', 'to', 'eqLow', 0, -1, 0, 0, 'step'));
      if (fx) out.push(g('cola-reverb', 'from', 'fx', 0, 0.5, T(nBeats - 4), T(nBeats - 3), 'ease', { fx: 'reverb', p: 0.8, tailMs: 4000 }));
      out.push(g('graves-entran', 'to', 'eqLow', -1, 0, T(nBeats), T(nBeats), 'step'));
      out.push(g('graves-salen', 'from', 'eqLow', 0, -1, T(nBeats), T(nBeats), 'step'));
      out.push(g('corte', 'x', 'x', 0, 1, T(nBeats), T(nBeats), 'step'));
      break;
    default: // crossfade
      out.push(g('fundido', 'x', 'x', 0, 1, 0, T(nBeats), 'ease'));
  }
  return { style, len, beat, swapBeat: swap, gestures: out.sort((a, b) => a.at - b.at || a.end - b.end) };
}

const ease = (t) => t * t * (3 - 2 * t);

// Valor de un gesto en el instante t de la mezcla: null antes de empezar; `to` al terminar. Sirve al motor y a las pruebas.
export function gestureValue(gs, t) {
  if (t < gs.at - 1e-6) return null;
  if (gs.curve === 'step' || gs.end <= gs.at || t >= gs.end) return gs.to;
  const p = (t - gs.at) / (gs.end - gs.at);
  return gs.from + (gs.to - gs.from) * (gs.curve === 'lin' ? p : ease(p));
}

// Etiqueta corta de un gesto para la vista.
export const GESTURE_LABEL = { 'graves-entrante': 'graves', 'swap-entra': 'graves', 'swap-sale': 'graves', 'graves-entran': 'graves', 'graves-salen': 'graves', 'filtro-entra': 'filtro', 'abre-entrante': 'filtro', 'barrido-saliente': 'filtro', fundido: 'fundido', 'eco-salida': 'eco', 'cola-reverb': 'reverb', corte: 'corte' };
