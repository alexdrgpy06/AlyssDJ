// Cadena de efectos de un deck: tres ranuras en serie. Modelo puro (sin DOM ni audio): el deck lo envía entero en cada
// mensaje `mix` y el motor (shared/fx.js) lo aplica.
export const FX_TYPES = ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter'];
export const SLOTS = 3;
export const STORE = 'alyssdj.fx.';

const DEFAULT_TYPES = ['echo', 'reverb', 'filter'];
const clamp01 = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(0, Math.min(1, +v)) : d);

export const defaultSlot = (i = 0) => ({ type: DEFAULT_TYPES[i] || 'echo', on: false, wet: 0.5, p: 0.5 });
export const defaultChain = () => Array.from({ length: SLOTS }, (_, i) => defaultSlot(i));

// Devuelve una ranura válida; lo que falte o esté fuera de rango toma su valor por defecto.
export function clampSlot(slot, i = 0) {
  const d = defaultSlot(i);
  const s = slot && typeof slot === 'object' ? slot : {};
  return { type: FX_TYPES.includes(s.type) ? s.type : d.type, on: s.on === true, wet: clamp01(s.wet, d.wet), p: clamp01(s.p, d.p) };
}

export class FxChain {
  constructor(saved, { onChange } = {}) {
    const list = Array.isArray(saved) ? saved : [];
    this.slots = Array.from({ length: SLOTS }, (_, i) => clampSlot(list[i], i));
    this.selected = 0;
    this.onChange = onChange || (() => {});
    this.ramps = new Array(SLOTS).fill(null);
  }

  select(i) {
    if (i >= 0 && i < SLOTS) this.selected = i;
    return this.selected;
  }

  // Cambia una ranura; cancela su rampa si el cambio toca los mismos parámetros que ella mueve.
  set(i, patch = {}, { fromRamp = false } = {}) {
    if (!(i >= 0 && i < SLOTS)) return null;
    const cur = this.slots[i];
    const next = clampSlot({ ...cur, ...patch }, i);
    if (!fromRamp && this.ramps[i] && ('wet' in patch || 'p' in patch)) this.cancel(i);
    this.slots[i] = next;
    this.onChange(i, next);
    return next;
  }

  cancel(i) {
    const r = this.ramps[i];
    if (r) r.stop?.();
    this.ramps[i] = null;
  }

  // Rampa lineal de wet y/o p durante `seconds`. `now()` da el reloj en ms y `schedule(fn)` agenda el siguiente paso
  // (por defecto, performance.now y requestAnimationFrame): así se prueba sin tiempo real.
  ramp(i, target = {}, seconds = 0, { now = () => performance.now(), schedule = (fn) => requestAnimationFrame(fn) } = {}) {
    if (!(i >= 0 && i < SLOTS)) return null;
    this.cancel(i);
    const keys = ['wet', 'p'].filter((k) => target[k] != null && Number.isFinite(+target[k]));
    if (!keys.length) return null;
    if (!(seconds > 0)) return this.set(i, Object.fromEntries(keys.map((k) => [k, target[k]])));
    const from = Object.fromEntries(keys.map((k) => [k, this.slots[i][k]]));
    const to = Object.fromEntries(keys.map((k) => [k, clamp01(target[k], this.slots[i][k])]));
    const t0 = now();
    const ramp = { stopped: false, stop() { this.stopped = true; } };
    this.ramps[i] = ramp;
    const step = () => {
      if (ramp.stopped) return;
      const k = Math.min(1, (now() - t0) / (seconds * 1000));
      this.set(i, Object.fromEntries(keys.map((key) => [key, from[key] + (to[key] - from[key]) * k])), { fromRamp: true });
      if (k >= 1) this.ramps[i] = null;
      else schedule(step);
    };
    step();
    return ramp;
  }

  // Lo que viaja en el mensaje `mix`.
  snapshot() {
    return this.slots.map((s) => ({ ...s }));
  }

  toJSON() {
    return this.snapshot();
  }

  static fromJSON(text, opts) {
    let saved = [];
    try {
      saved = JSON.parse(text);
    } catch {}
    return new FxChain(saved, opts);
  }
}
