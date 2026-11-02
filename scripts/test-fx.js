#!/usr/bin/env node
// Pruebas del cambio fx-cadena.  Uso: node scripts/test-fx.js model|engine|ui|settings|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests.model = async () => {
  const { FxChain, FX_TYPES, SLOTS, defaultChain, clampSlot } = await import('../renderer/fxchain.js');
  assert.deepStrictEqual(FX_TYPES, ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter']);
  assert.strictEqual(SLOTS, 3);
  // REQ-1: por defecto, ranura 1 = eco apagado 0,5 (como hoy)
  const d = defaultChain();
  assert.deepStrictEqual(d[0], { type: 'echo', on: false, wet: 0.5, p: 0.5 });
  assert.strictEqual(d.length, 3); assert.ok(d.every((s) => !s.on));
  // límites y valores inválidos
  assert.deepStrictEqual(clampSlot({ type: 'nope', on: 'si', wet: 4, p: -2 }, 1), { type: 'reverb', on: false, wet: 1, p: 0 });
  assert.deepStrictEqual(clampSlot({ type: 'crush', on: true, wet: 'x', p: null }, 0), { type: 'crush', on: true, wet: 0.5, p: 0.5 });
  const c = new FxChain(null);
  assert.deepStrictEqual(c.snapshot(), d);
  const seen = [];
  c.onChange = (i, s) => seen.push([i, s.type, s.on]);
  c.set(1, { type: 'phaser', on: true, wet: 0.8 });
  assert.deepStrictEqual(c.slots[1], { type: 'phaser', on: true, wet: 0.8, p: 0.5 });
  assert.deepStrictEqual(seen, [[1, 'phaser', true]], 'avisa al cambiar');
  c.set(0, { wet: 9 }); assert.strictEqual(c.slots[0].wet, 1);
  assert.strictEqual(c.set(7, { on: true }), null); assert.strictEqual(c.select(5), 0); assert.strictEqual(c.select(2), 2);
  // el mismo tipo en varias ranuras
  c.set(0, { type: 'filter' }); c.set(2, { type: 'filter' }); assert.deepStrictEqual([c.slots[0].type, c.slots[2].type], ['filter', 'filter']);
  // persistencia (también con datos dañados)
  const back = FxChain.fromJSON(JSON.stringify(c));
  assert.deepStrictEqual(back.snapshot(), c.snapshot());
  assert.deepStrictEqual(FxChain.fromJSON('{no json').snapshot(), d); assert.deepStrictEqual(FxChain.fromJSON('"x"').snapshot(), d);
  // REQ-5: rampas con reloj inyectado
  let t = 0; const q = [];
  const opts = { now: () => t, schedule: (fn) => q.push(fn) };
  const r = new FxChain(null); r.set(0, { wet: 0, p: 1, on: true });
  r.ramp(0, { wet: 1 }, 2, opts);
  assert.strictEqual(r.slots[0].wet, 0, 'empieza donde estaba');
  t = 1000; q.shift()(); assert.ok(Math.abs(r.slots[0].wet - 0.5) < 1e-9, `mitad: ${r.slots[0].wet}`); assert.strictEqual(r.slots[0].p, 1, 'p no se toca');
  t = 5000; q.shift()(); assert.strictEqual(r.slots[0].wet, 1); assert.strictEqual(q.length, 0, 'termina y no agenda más'); assert.strictEqual(r.ramps[0], null);
  // una rampa nueva o un cambio manual cancelan la anterior
  t = 0; r.set(0, { wet: 0 }); r.ramp(0, { wet: 1 }, 4, opts); const stale = q.shift(); r.set(0, { wet: 0.2 }); t = 2000; stale(); assert.strictEqual(r.slots[0].wet, 0.2, 'cambio manual cancela');
  r.ramp(0, { p: 0 }, 1, opts); r.ramp(0, { p: 1 }, 1, opts); const first = q.shift(); const second = q.shift(); const before = r.slots[0].p; t = 99999; first(); assert.strictEqual(r.slots[0].p, before, 'la rampa cancelada no mueve nada'); second(); assert.strictEqual(r.slots[0].p, 1, 'la última rampa manda');
  // duración 0 = al instante; fuera de rango se acota; sin nada que mover no hace nada
  r.ramp(1, { wet: 7 }, 0, opts); assert.strictEqual(r.slots[1].wet, 1); assert.strictEqual(r.ramp(1, {}, 3, opts), null);
  console.log('model ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-fx.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
