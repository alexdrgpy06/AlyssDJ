// Panel FX de un deck: tres ranuras (interruptor + tipo), cantidad y P de la ranura seleccionada y el pad XY.
import { FX_TYPES, SLOTS } from './fxchain.js';
import { makeXYPad } from './fxpad.js';

export const FX_LABEL = { echo: 'ECO', reverb: 'REVERB', flanger: 'FLANGER', gate: 'GATE', phaser: 'PHASER', crush: 'CRUSH', filter: 'FILTRO' };
const P_HINT = { echo: 'división', reverb: 'tamaño', flanger: 'velocidad', gate: 'ritmo', phaser: 'velocidad', crush: 'bits', filter: 'corte' };

export function mountFxPanel({ pane, chain, id, register, learning, holdMode }) {
  const P = `deck${id}`;
  pane.innerHTML = `
    <div class="fx-slots" role="group" aria-label="Ranuras de efectos">
      ${Array.from({ length: SLOTS }, (_, i) => `<div class="fx-slot" data-slot="${i}"><button type="button" class="fx-pow" aria-label="Efecto ${i + 1}: activar" title="Activar el efecto ${i + 1}">${i + 1}</button><button type="button" class="fx-pick" aria-label="Elegir ranura ${i + 1}"></button></div>`).join('')}
    </div>
    <div class="fx-ctl">
      <select class="fx-type" aria-label="Tipo de efecto">${FX_TYPES.map((t) => `<option value="${t}">${FX_LABEL[t]}</option>`).join('')}</select>
      <input type="range" class="fx-wet" min="0" max="1" step="0.01" aria-label="Cantidad" />
      <input type="range" class="fx-p" min="0" max="1" step="0.01" aria-label="Parámetro P" />
    </div>
    <div class="fx-xy"></div>`;
  const q = (s) => pane.querySelector(s);
  const slots = [...pane.querySelectorAll('.fx-slot')];
  const typeSel = q('.fx-type');
  const wet = q('.fx-wet');
  const p = q('.fx-p');
  let held = null; // { i, was } mientras se mantiene el pad

  const sel = () => chain.selected;
  const cur = () => chain.slots[sel()];

  const pad = makeXYPad(q('.fx-xy'), {
    label: `Pad XY deck ${id}: cantidad y parámetro de la ranura seleccionada`,
    get: () => [cur().wet, cur().p],
    onDown: () => {
      const i = sel();
      held = { i, was: chain.slots[i].on };
      chain.set(i, { on: true });
    },
    onMove: (x, y) => chain.set(sel(), { wet: x, p: y }),
    onUp: () => {
      if (held && holdMode()) chain.set(held.i, { on: held.was });
      held = null;
    },
  });

  function sync() {
    slots.forEach((el, i) => {
      const s = chain.slots[i];
      el.classList.toggle('sel', i === sel());
      el.querySelector('.fx-pow').classList.toggle('on', s.on);
      el.querySelector('.fx-pow').setAttribute('aria-pressed', String(s.on));
      el.querySelector('.fx-pick').textContent = FX_LABEL[s.type];
      el.querySelector('.fx-pick').setAttribute('aria-pressed', String(i === sel()));
    });
    const s = cur();
    if (typeSel.value !== s.type) typeSel.value = s.type;
    if (Number(wet.value) !== s.wet) wet.value = s.wet;
    if (Number(p.value) !== s.p) p.value = s.p;
    p.title = `Parámetro P: ${P_HINT[s.type]}`;
    wet.setAttribute('aria-label', `Cantidad ranura ${sel() + 1}`);
    p.setAttribute('aria-label', `P ranura ${sel() + 1} (${P_HINT[s.type]})`);
    pad.show(s.wet, s.p);
  }

  slots.forEach((el, i) => {
    const pow = el.querySelector('.fx-pow');
    pow.addEventListener('click', () => !learning() && chain.set(i, { on: !chain.slots[i].on }));
    el.querySelector('.fx-pick').addEventListener('click', () => {
      if (learning()) return;
      chain.select(i);
      sync();
    });
    // MIDI learn: interruptor, cantidad y P de cada ranura
    register(`${P}.fx${i + 1}On`, { kind: 'button', press: (d) => d && chain.set(i, { on: !chain.slots[i].on }) }, pow);
    register(`${P}.fx${i + 1}Wet`, { kind: 'range', setNorm: (n) => chain.set(i, { wet: n }) });
    register(`${P}.fx${i + 1}P`, { kind: 'range', setNorm: (n) => chain.set(i, { p: n }) });
  });
  typeSel.addEventListener('change', () => chain.set(sel(), { type: typeSel.value }));
  wet.addEventListener('input', () => chain.set(sel(), { wet: Number(wet.value) }));
  p.addEventListener('input', () => chain.set(sel(), { p: Number(p.value) }));
  register(`${P}.fxWet`, { kind: 'range', setNorm: (n) => chain.set(0, { wet: n }) }, wet);
  register(`${P}.fxOn`, { kind: 'button', press: (d) => d && chain.set(0, { on: !chain.slots[0].on }) });
  for (const t of FX_TYPES) register(`${P}.fx.${t}`, { kind: 'button', press: (d) => d && chain.set(0, { type: t }) });
  sync();
  return { sync };
}
