// Presets de ranura: de fábrica y propios (en localStorage). Un preset es { name, type, wet, p, d }; aplicarlo no enciende la ranura.
import { clampSlot } from './fxchain.js';

export const STORE = 'alyssdj.fxpresets';
export const MAX_USER = 40;
export const FACTORY = [
  { name: 'Eco largo', type: 'echo', wet: 0.55, p: 1, d: 0 },
  { name: 'Eco de cinta sucio', type: 'tape', wet: 0.6, p: 0.7, d: 1 },
  { name: 'Barrido de filtro', type: 'filter', wet: 1, p: 0.25, d: null },
  { name: 'Roll de redoble', type: 'stutter', wet: 0.9, p: 0.8, d: 3 },
  { name: 'Frenazo', type: 'brake', wet: 1, p: 0.3, d: null },
  { name: 'Reverb enorme', type: 'reverb', wet: 0.5, p: 1, d: null },
  { name: 'Octava abajo', type: 'pitch', wet: 1, p: 0, d: null },
];

const clean = (x) => {
  const s = clampSlot(x);
  return { name: String(x.name || '').trim().slice(0, 24), type: s.type, wet: s.wet, p: s.p, d: s.d };
};

export class FxPresets {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
  }

  user() {
    try {
      const v = JSON.parse(this.storage?.getItem(STORE) || '[]');
      return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && String(x.name || '').trim()).map(clean).slice(0, MAX_USER) : [];
    } catch {
      return [];
    }
  }

  list() {
    return [...FACTORY.map((p) => ({ ...clean(p), factory: true })), ...this.user().map((p) => ({ ...p, factory: false }))];
  }

  get(name) {
    return this.list().find((p) => p.name === name) || null;
  }

  // Guarda la ranura con ese nombre (si ya existe uno propio, lo sustituye). Devuelve { ok, error? }.
  save(name, slot) {
    const n = String(name || '').trim().slice(0, 24);
    if (!n) return { ok: false, error: 'Pon un nombre al preset.' };
    if (FACTORY.some((p) => p.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: 'Ese nombre es de un preset de fábrica.' };
    const list = this.user().filter((p) => p.name.toLowerCase() !== n.toLowerCase());
    if (list.length >= MAX_USER) return { ok: false, error: `Hay ${MAX_USER} presets propios: borra alguno.` };
    list.push(clean({ ...slot, name: n }));
    this.write(list);
    return { ok: true };
  }

  remove(name) {
    const list = this.user();
    const rest = list.filter((p) => p.name !== name);
    if (rest.length === list.length) return false;
    this.write(rest);
    return true;
  }

  write(list) {
    try { this.storage?.setItem(STORE, JSON.stringify(list)); } catch {}
  }

  // Aplica el preset a la ranura `i` de la cadena (sin encenderla).
  apply(chain, i, name) {
    const p = this.get(name);
    if (!p) return null;
    return chain.set(i, { type: p.type, wet: p.wet, p: p.p, d: p.d });
  }
}
