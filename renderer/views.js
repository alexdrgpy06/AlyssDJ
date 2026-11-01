// Vistas de trabajo (como los modos de Mixxx o de djay): mezcla, librería, automix (inmersiva) y ondas.
// Máquina de estados pura: la interfaz solo aplica `view` y `waves` al <body>.
export const VIEWS = ['mix', 'library', 'automix', 'waves'];
export const WAVES = ['top', 'deck'];
export const STORE = 'alyssdj.view';

export class ViewState {
  constructor(saved = {}) {
    this.view = VIEWS.includes(saved.view) ? saved.view : 'mix';
    this.waves = WAVES.includes(saved.waves) ? saved.waves : 'top';
    this.before = null; // vista que había al abrir la fuente AutoMix de la librería
    this.chosen = false; // el usuario eligió vista mientras estaba en esa fuente
  }

  // Elección del usuario (selector, atajo o ajuste).
  set(view) {
    if (!VIEWS.includes(view)) return this.view;
    this.view = view;
    if (this.before) this.chosen = true;
    return this.view;
  }

  setWaves(waves) {
    if (WAVES.includes(waves)) this.waves = waves;
    return this.waves;
  }

  // Abrir la fuente AutoMix de la librería pasa a la vista Librería; al salir vuelve a la anterior si nadie la cambió.
  enterAutomixTab() {
    if (this.before) return this.view;
    this.before = this.view;
    this.chosen = false;
    this.view = 'library';
    return this.view;
  }

  leaveAutomixTab() {
    if (!this.before) return this.view;
    if (!this.chosen && this.view === 'library') this.view = this.before;
    this.before = null;
    this.chosen = false;
    return this.view;
  }

  // Las ondas «en el deck» solo valen en Mezcla y Librería; Ondas y Automix usan su propia disposición.
  effectiveWaves() {
    return this.view === 'mix' || this.view === 'library' ? this.waves : 'top';
  }

  // Compacta los decks (plato pequeño, pads en una fila, mezclador reducido).
  compact() {
    return this.view === 'library';
  }

  toJSON() {
    // al guardar se persiste la vista que el usuario tenía, no la temporal de la fuente AutoMix
    return { view: this.before && !this.chosen ? this.before : this.view, waves: this.waves };
  }
}
