// Estado de AutoMix en una frase: fase, cuenta atrás y motivo. Función pura sobre `AutoMix.snapshot()`.
import { STYLE_LABEL } from './recipes.js';

export const PHASES = { stopped: 'Detenido', playing: 'Sonando', preparing: 'Preparando la siguiente', waiting: 'Esperando el punto de salida', mixing: 'Mezclando' };
const EXIT_KIND = { phrase: 'frase', bar: 'compás', edit: 'tu punto', now: 'este instante', outro: 'el final', break: 'una rotura', auto: 'un punto de la pista' };
const FX = { subtle: 'sutiles', full: 'marcados' };
const WAIT_NEAR = 30; // s: por debajo de esto ya se está esperando la salida

const mmss = (s) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');

export function describe(st) {
  if (!st?.on) return { phase: 'stopped', text: PHASES.stopped, countdown: null, reason: st?.note || '' };
  const note = st.note || '';
  const t = st.trans;
  if (t) {
    const bits = [`Mezclando ${t.from} → ${t.to} · ${STYLE_LABEL[t.style] || t.style}${t.why ? ` (${t.why})` : ''}`];
    if (t.tempo) bits.push('tempo igualado');
    if (st.fx?.level && st.fx.level !== 'off') bits.push(`efectos ${FX[st.fx.level] || st.fx.level}`);
    if (t.warnings?.length) bits.push(t.warnings.join(', '));
    return { phase: 'mixing', text: bits.join(' · '), countdown: Math.max(0, t.len * (1 - (t.progress || 0))), reason: note };
  }
  const pm = st.pendingMix;
  if (pm) {
    if (!pm.ready) return { phase: 'preparing', text: 'Mezclará en cuanto la siguiente esté lista', countdown: null, reason: note };
    const dur = Number.isFinite(pm.seconds) ? ` · dura ${Math.round(pm.seconds)} s` : '';
    return { phase: 'waiting', text: `Mezclando en ${pm.waitS.toFixed(1)} s · salida en ${EXIT_KIND[pm.kind] || EXIT_KIND.auto}${dur}`, countdown: pm.waitS, reason: note };
  }
  const wait = st.plan && Number.isFinite(st.pos) ? Math.max(0, st.plan.exitAt - st.pos) : null;
  const next = st.next?.title;
  if (!st.next) return { phase: 'playing', text: `${PHASES.playing} · buscando la siguiente`, countdown: null, reason: note || 'La cola está vacía' };
  if (!st.nextReady) return { phase: 'preparing', text: `${PHASES.preparing}${next ? `: ${next}` : ''}`, countdown: wait, reason: note || (st.queue?.[0]?.prep?.error ? `Falló: ${st.queue[0].prep.error}` : '') };
  if (wait != null && wait <= WAIT_NEAR) return { phase: 'waiting', text: `${PHASES.waiting} · mezcla en ${mmss(wait)}`, countdown: wait, reason: note };
  return { phase: 'playing', text: wait != null ? `${PHASES.playing} · mezcla en ${mmss(wait)}` : PHASES.playing, countdown: wait, reason: note };
}

// Rótulos compartidos por la barra de AutoMix y la vista inmersiva.
export const LABELS = { start: 'Iniciar AutoMix', stop: 'Detener AutoMix', pick: 'Elegir radio…', mix: 'Mezclar ahora', cancelMix: 'Cancelar mezcla' };

// Rótulo del botón principal según lo que hará: detener, iniciar con la pista cargada o elegir una radio si no hay ninguna.
export function startLabel(st, decks) {
  if (st?.on) return LABELS.stop;
  return (decks || []).some((d) => d?.track) ? LABELS.start : LABELS.pick;
}

// Motivo por el que un botón de la barra está deshabilitado (una línea; '' si ninguno lo está).
export function disabledReason(st) {
  if (!st?.on) return 'Mezclar ahora y Siguiente se activan al iniciar AutoMix.';
  if (st.trans) return 'Mezclando: Mezclar ahora y Siguiente vuelven al terminar la transición.';
  if (!st.canSkip) return 'Siguiente necesita al menos dos pistas en la cola.';
  return '';
}
