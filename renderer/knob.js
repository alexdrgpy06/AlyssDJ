// Knob rotativo: arrastre vertical, rueda, doble clic = valor por defecto.
const START = -135;
const SWEEP = 270;

function polar(a, r) {
  const rad = ((a - 90) * Math.PI) / 180;
  return [20 + r * Math.cos(rad), 20 + r * Math.sin(rad)];
}

function arc(a0, a1, r) {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r} ${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
}

export function makeKnob(slot, { label, min = -1, max = 1, value = 0, def = value, onChange, format }) {
  const el = document.createElement('div');
  el.className = 'knob';
  el.innerHTML = `<svg viewBox="0 0 40 40"><circle class="k-bg" cx="20" cy="20" r="15"/><path class="k-arc"/><line class="k-ptr" x1="20" y1="20"/></svg><span class="k-lbl"></span>`;
  slot.replaceWith(el);
  const arcEl = el.querySelector('.k-arc');
  const ptr = el.querySelector('.k-ptr');
  const lbl = el.querySelector('.k-lbl');
  const center = min < 0 && max > 0 ? 0 : min;
  let v = value;

  function render() {
    const n = (v - min) / (max - min);
    const a = START + n * SWEEP;
    const ac = START + ((center - min) / (max - min)) * SWEEP;
    arcEl.setAttribute('d', Math.abs(a - ac) < 0.5 ? '' : arc(Math.min(a, ac), Math.max(a, ac), 17.5));
    const [x, y] = polar(a, 12);
    ptr.setAttribute('x2', x);
    ptr.setAttribute('y2', y);
    lbl.textContent = format ? format(v) : label;
    el.classList.toggle('killed', min === -1 && v <= -0.97);
  }

  function set(nv, emit = true) {
    v = Math.max(min, Math.min(max, nv));
    render();
    if (emit) onChange?.(v);
  }

  el.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('learning')) return;
    el.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const v0 = v;
    const move = (ev) => set(v0 + ((y0 - ev.clientY) / (ev.shiftKey ? 800 : 160)) * (max - min));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    set(v - Math.sign(e.deltaY) * (max - min) * 0.02);
  });
  el.addEventListener('dblclick', () => set(def));
  el.title = label;
  render();
  return {
    el,
    set,
    get: () => v,
    setNorm: (n) => set(min + n * (max - min)),
  };
}
