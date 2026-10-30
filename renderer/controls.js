// Registro de controles: la UI, el teclado y MIDI actúan sobre los mismos ids.
// kind: 'button' → press(down) · 'range' → setNorm(0..1) · 'relative' → nudge(delta)
export const controls = new Map();

export function register(id, def, el) {
  controls.set(id, { id, ...def });
  if (el) el.dataset.ctl = id;
}

export function press(id, down = true) {
  controls.get(id)?.press?.(down);
}
