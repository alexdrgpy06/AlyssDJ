// Panel FX de un deck: tres ranuras (interruptor + tipo), cantidad y P de la ranura seleccionada y el pad XY.
import { FX_TYPES, SLOTS, USES_DIV } from './fxchain.js';
import { FxPresets } from './fxpresets.js';
import { makeXYPad } from './fxpad.js';

export const FX_LABEL = { echo: 'ECO', reverb: 'REVERB', flanger: 'FLANGER', gate: 'GATE', phaser: 'PHASER', crush: 'CRUSH', filter: 'FILTRO', tape: 'CINTA', reducer: 'REDUCER', stutter: 'STUTTER', brake: 'FRENAZO', transformer: 'TRANSF.', drive: 'DRIVE', pitch: 'PITCH' };
export const FX_GROUPS = [['Espacio', ['echo', 'tape', 'reverb']], ['Modulación', ['flanger', 'phaser', 'pitch']], ['Ritmo', ['gate', 'stutter', 'transformer']], ['Color', ['crush', 'reducer', 'drive', 'filter']], ['Freno', ['brake']]];
const P_HINT = { echo: 'división', reverb: 'tamaño', flanger: 'velocidad', gate: 'ritmo', phaser: 'velocidad', crush: 'bits', filter: 'corte', tape: 'realimentación', reducer: 'reducción', stutter: 'longitud del corte', brake: 'rapidez del freno', transformer: 'patrón', drive: 'saturación', pitch: 'semitonos (centro = 0)' };

export function mountFxPanel({ pane, chain, id, register, learning, holdMode }) {
  const P = `deck${id}`;
  pane.innerHTML = `
    <div class="fx-slots" role="group" aria-label="Ranuras de efectos">
      ${Array.from({ length: SLOTS }, (_, i) => `<div class="fx-slot" data-slot="${i}"><button type="button" class="fx-pow" aria-label="Efecto ${i + 1}: activar" title="Activar el efecto ${i + 1}">${i + 1}</button><button type="button" class="fx-pick" aria-label="Elegir ranura ${i + 1}"></button></div>`).join('')}
    </div>
    <div class="fx-ctl">
      <select class="fx-type" aria-label="Tipo de efecto">${FX_GROUPS.map(([g, ts]) => `<optgroup label="${g}">${ts.filter((t) => FX_TYPES.includes(t)).map((t) => `<option value="${t}">${FX_LABEL[t]}</option>`).join('')}</optgroup>`).join('')}</select>
      <input type="range" class="fx-wet" min="0" max="1" step="0.01" aria-label="Cantidad" />
      <input type="range" class="fx-p" min="0" max="1" step="0.01" aria-label="Parámetro P" />
      <button type="button" class="fx-more" aria-label="Más opciones del efecto: división, ruta, orden y presets" aria-expanded="false" title="División, ruta, orden y presets">⋯</button>
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

  // ---------- más opciones: división, ruta, orden y presets ----------
  const presets = new FxPresets();
  const pop = document.createElement('div');
  pop.className = 'fx-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', `Opciones del efecto, deck ${id}`);
  pop.innerHTML = `
    <div class="fx-pop-row"><span class="lbl">División</span><div class="seg fx-div" role="group" aria-label="División de beat">${['Auto', '1', '½', '¼', '⅛', '⅓'].map((t, k) => `<button type="button" data-d="${k === 0 ? '' : k - 1}">${t}</button>`).join('')}</div></div>
    <div class="fx-pop-row"><span class="lbl">Ruta</span><div class="seg fx-route" role="group" aria-label="Ruta de la ranura"><button type="button" data-r="deck">Este deck</button><button type="button" data-r="both">Ambos decks</button></div></div>
    <div class="fx-pop-row"><span class="lbl">Orden</span><button type="button" class="fx-mv" data-mv="-1">◀ Antes</button><button type="button" class="fx-mv" data-mv="1">Después ▶</button></div>
    <div class="fx-pop-row"><span class="lbl">Preset</span><select class="fx-preset" aria-label="Preset de la ranura"></select><button type="button" class="fx-pdel">Borrar</button></div>
    <div class="fx-pop-row"><input class="fx-pname" maxlength="24" placeholder="Nombre del preset" aria-label="Nombre del preset" /><button type="button" class="fx-psave">Guardar</button></div>
    <p class="fx-pmsg" role="status"></p>`;
  document.body.append(pop);
  const pq = (x) => pop.querySelector(x);
  const more = q('.fx-more');
  const say = (t, bad) => { const m = pq('.fx-pmsg'); m.textContent = t || ''; m.classList.toggle('err', !!bad); };
  function fillPresets() {
    const all = presets.list();
    const opt = (x) => `<option value="${x.name.replace(/"/g, '&quot;')}">${x.name.replace(/[<&]/g, '')}</option>`;
    pq('.fx-preset').innerHTML = `<option value="">Elegir…</option><optgroup label="De fábrica">${all.filter((x) => x.factory).map(opt).join('')}</optgroup>${all.some((x) => !x.factory) ? `<optgroup label="Tus presets">${all.filter((x) => !x.factory).map(opt).join('')}</optgroup>` : ''}`;
  }
  function place() {
    const r = more.getBoundingClientRect();
    const h = pop.offsetHeight || 190;
    pop.style.left = `${Math.max(4, Math.min(innerWidth - 300, r.right - 296))}px`;
    pop.style.top = `${r.top - h - 6 > 4 ? r.top - h - 6 : Math.min(innerHeight - h - 4, r.bottom + 6)}px`;
  }
  const setOpen = (open) => {
    pop.hidden = !open;
    more.setAttribute('aria-expanded', String(open));
    if (open) { fillPresets(); say(''); sync(); place(); }
  };
  more.addEventListener('click', () => !learning() && setOpen(pop.hidden));
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== more) setOpen(false); });
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); more.focus(); } });
  pq('.fx-div').addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (b && !b.disabled) chain.set(sel(), { d: b.dataset.d === '' ? null : Number(b.dataset.d) }); });
  pq('.fx-route').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) chain.set(sel(), { route: b.dataset.r }); });
  pop.querySelectorAll('.fx-mv').forEach((b) => b.addEventListener('click', () => { const i = sel(); chain.move(i, i + Number(b.dataset.mv)); sync(); }));
  pq('.fx-preset').addEventListener('change', (e) => { if (e.target.value) { presets.apply(chain, sel(), e.target.value); say(`Aplicado «${e.target.value}» a la ranura ${sel() + 1}`); } });
  pq('.fx-psave').addEventListener('click', () => {
    const r = presets.save(pq('.fx-pname').value, cur());
    if (!r.ok) return say(r.error, true);
    say(`Guardado «${pq('.fx-pname').value.trim()}»`); pq('.fx-pname').value = ''; fillPresets();
  });
  pq('.fx-pdel').addEventListener('click', () => {
    const n = pq('.fx-preset').value;
    if (!n) return say('Elige un preset propio para borrarlo.', true);
    const ok = presets.remove(n);
    say(ok ? `Borrado «${n}»` : 'Los presets de fábrica no se borran.', !ok);
    fillPresets();
  });

  // ---------- Instant FX: mantener = aplicar con entrada y salida suaves; soltar = quitar ----------
  const instant = new Array(SLOTS).fill(null);
  function hold(i, down) {
    if (!(i >= 0 && i < SLOTS) || learning()) return;
    if (down) {
      if (instant[i] || chain.slots[i].on) return; // ya sonando: no se toca
      const wet = chain.slots[i].wet;
      instant[i] = { wet };
      chain.set(i, { on: true, wet: 0 });
      chain.ramp(i, { wet }, 0.03, { schedule: (fn) => setTimeout(fn, 6) });
    } else if (instant[i]) {
      const { wet } = instant[i];
      chain.ramp(i, { wet: 0 }, 0.06, { schedule: (fn) => setTimeout(fn, 6) });
      setTimeout(() => { chain.set(i, { on: false, wet }); instant[i] = null; }, 70);
    }
  }

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
    more.classList.toggle('on', !pop.hidden);
    const usesDiv = USES_DIV.includes(s.type);
    pop.querySelectorAll('.fx-div button').forEach((b) => { b.disabled = !usesDiv; b.classList.toggle('on', usesDiv && (b.dataset.d === '' ? s.d == null : Number(b.dataset.d) === s.d)); });
    pop.querySelectorAll('.fx-route button').forEach((b) => { b.classList.toggle('on', b.dataset.r === s.route); b.setAttribute('aria-pressed', String(b.dataset.r === s.route)); });
    pop.querySelectorAll('.fx-mv').forEach((b) => { b.disabled = sel() + Number(b.dataset.mv) < 0 || sel() + Number(b.dataset.mv) >= SLOTS; });
    slots.forEach((el, i) => el.classList.toggle('both', chain.slots[i].route === 'both'));
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
  return { sync, hold, setOpen, presets };
}
