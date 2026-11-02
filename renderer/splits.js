// Divisores arrastrables entre ondas, decks y librería. Estado puro: la interfaz solo aplica los valores al <body>.
// Hay dos grados de libertad por vista: la altura de las ondas o la de la librería; manda el último que se movió.
export const STORE = 'alyssdj.splits';
export const SPLITVIEWS = ['mix', 'library'];
export const STEP = 8;
export const STEP_BIG = 32;
const MIN = { waves: 90, lib: 150 };
const MAX_FRAC = { waves: 0.45, lib: 0.55 };

// Recorta `px` a los límites de la zona para una ventana de `inner` px de alto.
export function clampSplit(which, px, inner) {
  const max = Math.max(MIN[which], Math.round(inner * MAX_FRAC[which]));
  return Math.max(MIN[which], Math.min(max, Math.round(px)));
}

const blank = () => ({ last: null, waves: null, lib: null });

export class SplitState {
  constructor(saved = {}) {
    this.views = {};
    for (const v of SPLITVIEWS) {
      const s = saved?.[v] || {};
      const num = (x) => (Number.isFinite(x) && x > 0 ? x : null);
      const e = { last: s.last === 'waves' || s.last === 'lib' ? s.last : null, waves: num(s.waves), lib: num(s.lib) };
      if (!e[e.last]) e.last = e.waves ? 'waves' : e.lib ? 'lib' : null;
      this.views[v] = e;
    }
  }

  get(view) {
    return { ...(this.views[view] || blank()) };
  }

  // Lo que se aplica: { which, px } de la zona que manda, o null si la vista usa su tamaño por defecto.
  active(view) {
    const e = this.views[view];
    return e && e.last && e[e.last] ? { which: e.last, px: e[e.last] } : null;
  }

  drag(view, which, px) {
    const e = this.views[view];
    if (!e || !(which in MIN) || !Number.isFinite(px)) return null;
    e[which] = Math.round(px);
    e.last = which;
    return this.active(view);
  }

  reset(view) {
    if (this.views[view]) this.views[view] = blank();
  }

  resetAll() {
    for (const v of SPLITVIEWS) this.views[v] = blank();
  }

  toJSON() {
    return this.views;
  }
}
