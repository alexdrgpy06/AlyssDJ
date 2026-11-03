// Cadena de efectos de un deck: tres ranuras en serie. Modelo puro (sin DOM ni audio): el deck lo envía entero en cada
// mensaje `mix` y el motor (shared/fx.js) lo aplica.
export const FX_TYPES = ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter', 'tape', 'reducer', 'stutter', 'brake', 'transformer', 'drive', 'pitch'];
// Qué usa cada tipo: división de beat (`d`) y qué mueve P.
export const USES_DIV = ['echo', 'gate', 'tape', 'stutter', 'transformer'];
export const ROUTES = ['deck', 'both'];
export const SLOTS = 3;
export const STORE = 'alyssdj.fx.';

const DEFAULT_TYPES = ['echo', 'reverb', 'filter'];
const clamp01 = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(0, Math.min(1, +v)) : d);

export const defaultSlot = (i = 0) => ({ type: DEFAULT_TYPES[i] || 'echo', on: false, wet: 0.5, p: 0.5, d: null, route: 'deck' });
export const defaultChain = () => Array.from({ length: SLOTS }, (_, i) => defaultSlot(i));

// Devuelve una ranura válida; lo que falte o esté fuera de rango toma su valor por defecto.
export function clampSlot(slot, i = 0) {
  const d = defaultSlot(i);
  const s = slot && typeof slot === 'object' ? slot : {};
  const div = s.d == null || s.d === '' || !Number.isFinite(+s.d) ? null : Math.max(0, Math.min(4, Math.round(+s.d)));
  return { type: FX_TYPES.includes(s.type) ? s.type : d.type, on: s.on === true, wet: clamp01(s.wet, d.wet), p: clamp01(s.p, d.p), d: div, route: ROUTES.includes(s.route) ? s.route : 'deck' };
}

export class FxChain {
  constructor(saved, { onChange } = {}) {
    const list = Array.isArray(saved) ? saved : [];
    this.slots = Array.from({ length: SLOTS }, (_, i) => clampSlot(list[i], i));
    this.selected = 0;
    this.onChange = onChange || (() => {});
    this.ramps = new Array(SLOTS).fill(null);
    this.owners = new Array(SLOTS).fill('user'); // quién tocó la ranura por última vez: 'user' o 'auto' (AutoMix)
  }

  select(i) {
    if (i >= 0 && i < SLOTS) this.selected = i;
    return this.selected;
  }

  // Cambia una ranura; cancela su rampa si el cambio toca los mismos parámetros que ella mueve.
  set(i, patch = {}, { fromRamp = false, owner = 'user' } = {}) {
    if (!(i >= 0 && i < SLOTS)) return null;
    const cur = this.slots[i];
    const next = clampSlot({ ...cur, ...patch }, i);
    if (!fromRamp && this.ramps[i] && ('wet' in patch || 'p' in patch)) this.cancel(i);
    this.slots[i] = next;
    this.owners[i] = owner;
    this.onChange(i, next);
    return next;
  }

  // Mueve la ranura `from` a la posición `to` (el motor aplica `slots[i]` a su i-ésima etapa en serie, así que esto reordena la cadena).
  move(from, to) {
    if (!(from >= 0 && from < SLOTS && to >= 0 && to < SLOTS) || from === to) return false;
    for (let i = 0; i < SLOTS; i++) this.cancel(i);
    const [slot] = this.slots.splice(from, 1);
    const [owner] = this.owners.splice(from, 1);
    this.slots.splice(to, 0, slot);
    this.owners.splice(to, 0, owner);
    if (this.selected === from) this.selected = to;
    else if (from < this.selected && to >= this.selected) this.selected--;
    else if (from > this.selected && to <= this.selected) this.selected++;
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) this.onChange(i, this.slots[i]);
    return true;
  }

  cancel(i) {
    const r = this.ramps[i];
    if (r) r.stop?.();
    this.ramps[i] = null;
  }

  // Rampa lineal de wet y/o p durante `seconds`. `now()` da el reloj en ms y `schedule(fn)` agenda el siguiente paso
  // (por defecto, performance.now y requestAnimationFrame): así se prueba sin tiempo real.
  ramp(i, target = {}, seconds = 0, { now = () => performance.now(), schedule = (fn) => requestAnimationFrame(fn), owner = 'user' } = {}) {
    if (!(i >= 0 && i < SLOTS)) return null;
    this.cancel(i);
    const keys = ['wet', 'p'].filter((k) => target[k] != null && Number.isFinite(+target[k]));
    if (!keys.length) return null;
    if (!(seconds > 0)) return this.set(i, Object.fromEntries(keys.map((k) => [k, target[k]])), { owner });
    const from = Object.fromEntries(keys.map((k) => [k, this.slots[i][k]]));
    const to = Object.fromEntries(keys.map((k) => [k, clamp01(target[k], this.slots[i][k])]));
    const t0 = now();
    const ramp = { stopped: false, stop() { this.stopped = true; } };
    this.ramps[i] = ramp;
    const step = () => {
      if (ramp.stopped) return;
      const k = Math.min(1, (now() - t0) / (seconds * 1000));
      this.set(i, Object.fromEntries(keys.map((key) => [key, from[key] + (to[key] - from[key]) * k])), { fromRamp: true, owner });
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
