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

const electronRun = (selftest, name) => {
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-fx-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, selftest), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, name);
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};

tests.engine = async () => {
  const r = electronRun('fx-selftest.js', 'fx.json');
  assert.ok(!r.__err, r.__err);
  assert.deepStrictEqual(r.types, ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter']); assert.strictEqual(r.slots, 3);
  // REQ-1: transparente con ranuras apagadas o con wet 0, y sin efectos montados
  assert.ok(r.offDist < 1e-6, `apagadas: ${r.offDist}`); assert.ok(r.wet0Dist < 1e-3, `wet 0: ${r.wet0Dist}`);
  assert.deepStrictEqual(r.offMounted, [null, null, null]); assert.deepStrictEqual(r.wet0Mounted, [null, null, null], 'wet 0 no monta nada');
  // cada tipo altera la señal y es estable
  for (const t of ['echo', 'reverb', 'flanger', 'gate', 'phaser', 'crush', 'filter']) {
    const e = r.each[t];
    assert.ok(e.dist > 0.01, `${t} altera la señal (${e.dist})`); assert.ok(!e.nan, `${t} sin NaN`); assert.ok(e.peak < 4, `${t} sin desbordes (${e.peak})`); assert.strictEqual(e.mounted, t);
  }
  // serie y repetición
  assert.ok(r.orderDist > 0.005, `el orden importa (${r.orderDist})`); assert.ok(r.twoEchoDist > 0.005, 'el mismo tipo en dos ranuras suma'); assert.deepStrictEqual(r.twoMounted, ['echo', 'echo', null]);
  // REQ-2: P por tipo y BPM
  assert.ok(r.clickTail.large > r.clickTail.small * 2, `reverb: P = tamaño (${JSON.stringify(r.clickTail)})`);
  assert.ok(r.crushUniq.high < r.crushUniq.low / 4, `crush: P = bits (${JSON.stringify(r.crushUniq)})`);
  assert.ok(r.filterRms.closed < r.filterRms.dry * 0.5 && r.filterRms.open > r.filterRms.closed * 1.5, `filtro: P = corte (${JSON.stringify(r.filterRms)})`);
  assert.ok(r.gateQuiet > 1.5, `gate: el nivel pulsa con el ritmo (${r.gateQuiet})`);
  assert.ok(r.bpmDist > 0.01, 'el eco sigue el BPM'); assert.ok(r.gateBpmDist > 0.01, 'el gate sigue el BPM');
  // montaje bajo demanda y límites
  assert.deepStrictEqual(r.mount, [[null, null, null], ['echo', null, null], ['phaser', 'crush', null], [null, null, null]]);
  assert.deepStrictEqual(r.clamped, { type: 'phaser', on: true, wet: 1, p: 0 }, 'tipo inválido conserva el anterior; valores acotados'); assert.deepStrictEqual(r.after, ['phaser', null, null]);
  // REQ-4: resonancia
  assert.ok(r.res.diff > 0.005, 'la resonancia cambia el sonido'); assert.ok(!r.res.nan);
  assert.ok(r.res.lo1 < r.res.lo0 * 2.5, `ganancia limitada (${JSON.stringify(r.res)})`); assert.ok(r.res.hiPeak < 4, `pico del pasa-altos resonante (${r.res.hiPeak})`);
  assert.ok(r.res.neutralDist < 1e-3, `el centro del filtro es neutro con cualquier resonancia (${r.res.neutralDist})`);
  assert.ok(r.chainFxDist > 0.01, 'el mensaje mix con fx llega al motor');
  console.log('engine ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-fx.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
