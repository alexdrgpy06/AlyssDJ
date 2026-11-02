// Pad XY: X = cantidad (izquierda → derecha), Y = parámetro P (abajo → arriba). Ratón/táctil y teclado.
export const PAD_STEP = 0.02;
export const PAD_STEP_BIG = 0.1;

export function makeXYPad(el, { label, onDown, onMove, onUp, get }) {
  el.classList.add('xy-pad');
  el.setAttribute('role', 'slider');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', label);
  el.innerHTML = '<i class="xy-dot"></i>';
  const pct = (v) => Math.round(v * 100);

  function show(x, y) {
    el.style.setProperty('--x', String(x));
    el.style.setProperty('--y', String(y));
    el.setAttribute('aria-valuenow', String(pct(x)));
    el.setAttribute('aria-valuetext', `Cantidad ${pct(x)} %, P ${pct(y)} %`);
  }
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const at = (e) => {
    const b = el.getBoundingClientRect();
    return [clamp((e.clientX - b.left) / b.width), clamp(1 - (e.clientY - b.top) / b.height)];
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || document.body.classList.contains('learning')) return;
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {} // puntero sintético (pruebas) o ya liberado
    el.classList.add('drag');
    el.focus({ preventScroll: true });
    onDown?.();
    const [x, y] = at(e);
    onMove(x, y);
    const move = (ev) => {
      const [mx, my] = at(ev);
      onMove(mx, my);
    };
    const up = () => {
      el.classList.remove('drag');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      onUp?.();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  el.addEventListener('dblclick', () => onMove(0.5, 0.5));
  el.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [x, y] = get();
    const s = e.shiftKey ? PAD_STEP_BIG : PAD_STEP;
    onMove(clamp(x + d[0] * s), clamp(y + d[1] * s));
  });

  show(...get());
  return { show };
}
