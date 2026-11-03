// Compatibilidad de un elemento de la cola con el anterior: tres niveles y el motivo en palabras.
import { bpmGap, MAX_BPM_GAP } from './mixplan.js';
import { keysCompatible } from './camelot.js';

export const LEVELS = { good: { icon: '✓', label: 'Muy buena' }, ok: { icon: '~', label: 'Aceptable' }, poor: { icon: '!', label: 'Difícil' }, unknown: { icon: '?', label: 'Sin datos' } };
const GOOD = 6;
const OK = 14;

// prev/item: análisis ({ bpm, camelot, mix: { energy } }); item.cost opcional (edgeCost ya calculado); marks: { analyzed, file }.
export function compat(prev, item, { cost = null, analyzed = true, file = true } = {}) {
  const marks = [];
  if (!file) marks.push('sin archivo');
  if (!analyzed) marks.push('sin análisis');
  if (!analyzed || cost == null) return { level: 'unknown', why: marks.includes('sin análisis') ? 'Sin analizar: no se puede comparar' : 'Sin pista anterior con la que comparar', marks };
  const why = [];
  const g = bpmGap(prev?.bpm, item?.bpm);
  if (g) why.push(g.gap > MAX_BPM_GAP ? `salto de BPM (${(g.gap * 100).toFixed(0)} %)` : g.gap < 0.02 ? 'mismo BPM' : `BPM ${(g.gap * 100).toFixed(1)} % distinto`);
  if (prev?.camelot && item?.camelot) why.push(prev.camelot === item.camelot ? 'misma tonalidad' : keysCompatible(prev.camelot, item.camelot) ? 'tonalidad compatible' : 'tonalidad distinta');
  const de = Math.abs((prev?.mix?.energy ?? NaN) - (item?.mix?.energy ?? NaN));
  if (Number.isFinite(de)) why.push(de < 12 ? 'energía parecida' : de < 25 ? 'energía algo distinta' : 'cambio fuerte de energía');
  return { level: cost < GOOD ? 'good' : cost < OK ? 'ok' : 'poor', why: why.join(' · ') || 'sin detalle', marks };
}
