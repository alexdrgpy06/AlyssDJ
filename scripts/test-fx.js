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

tests.ui = async () => {
  const html = read('renderer/index.html'); const css = read('renderer/styles.css'); const deck = read('renderer/deck.js');
  assert.ok(/class="pane fxpane" data-pane="fx" hidden><\/div>/.test(html), 'el panel FX se monta desde fxpanel.js');
  assert.ok(/mountFxPanel/.test(deck) && /fxRamp/.test(deck) && /fxSet/.test(deck) && !/this\.fx\./.test(deck), 'deck usa la cadena');
  assert.ok(/\.xy-pad/.test(css) && /\.fx-slot/.test(css));
  const r = electronRun('fx-ui-selftest.js', 'fx-ui.json');
  assert.ok(!r.__err, JSON.stringify(r.__err));
  const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
  // REQ-1/3: tres ranuras; por defecto como hoy
  assert.deepStrictEqual(r.start.pads, ['ECO', 'REVERB', 'FILTRO']); assert.deepStrictEqual(r.start.pows, [false, false, false]); assert.deepStrictEqual(r.start.selSlot, [true, false, false]);
  assert.deepStrictEqual(r.start.slots[0], { type: 'echo', on: false, wet: 0.5, p: 0.5 });
  assert.ok(r.start.pane && r.start.pad && r.start.pad.w >= 56 && Math.abs(r.start.pad.w - r.start.pad.h) < 24, JSON.stringify(r.start.pad));
  assert.ok(r.start.sw <= r.start.w && r.start.sh <= r.start.ih + 1, 'sin desbordes'); assert.ok(r.start.lib.h >= 150, `la librería conserva su mínimo (${r.start.lib.h})`);
  assert.strictEqual(r.start.role, 'slider'); assert.ok(/Cantidad 50 %, P 50 %/.test(r.start.vt), r.start.vt); assert.ok(/Pad XY deck A/.test(r.start.padLabel));
  // interruptor, selección, tipo y deslizadores llegan al motor en el mensaje mix
  assert.strictEqual(r.pow.slots[0].on, true); assert.strictEqual(r.pow.last.fx[0].on, true); assert.strictEqual(r.pow.last.fx.length, 3);
  assert.strictEqual(r.pick.sel, 1); assert.strictEqual(r.pick.slots[1].type, 'phaser'); assert.strictEqual(r.pick.pads[1], 'PHASER'); assert.strictEqual(r.pick.last.fx[1].type, 'phaser');
  near(r.sliders.slots[1].wet, 0.33, 0.001, 'cantidad'); near(r.sliders.slots[1].p, 0.77, 0.001, 'P');
  // REQ-3: XY pad con modo mantener
  assert.strictEqual(r.padDown.slots[1].on, true, 'se enciende al pulsar'); near(r.padDown.slots[1].wet, 0.8, 0.02, 'X = cantidad'); near(r.padDown.slots[1].p, 0.25, 0.02, 'Y = P');
  near(r.padMove.slots[1].wet, 0.9, 0.02, 'sigue el puntero'); near(r.padMove.slots[1].p, 0.6, 0.02, 'sigue el puntero (Y)');
  assert.strictEqual(r.padUp.slots[1].on, false, 'se apaga al soltar'); near(r.padUp.slots[1].wet, 0.9, 0.02, 'conserva el valor');
  assert.strictEqual(r.padNoHold.slots[1].on, true, 'sin «mantener» se queda encendida');
  assert.strictEqual(r.padWasOn.slots[1].on, true, 'si ya estaba encendida, sigue encendida');
  near(r.kRight.slots[1].wet, 0.52, 0.005, '→ +0,02'); near(r.kUp.slots[1].p, 0.6, 0.005, 'Mayús+↑ +0,1'); near(r.kMix.slots[1].wet, 0.52 - 0.1 - 0.0, 0.03, 'teclado combinado');
  near(r.dbl.slots[1].wet, 0.5, 0.001, 'doble clic'); near(r.dbl.slots[1].p, 0.5, 0.001, 'doble clic');
  // REQ-4: RES en el mezclador
  assert.ok(r.res0.has); near(r.res0.mix, 0.07, 0.001, 'RES por defecto'); near(r.res1.mix, 0.5, 0.001, 'RES'); near(r.res1.sent, 0.5, 0.001, 'RES llega al motor'); near(r.res2, 0.07, 0.001, 'doble clic = valor por defecto');
  // REQ-5: MIDI y la interfaz para AutoMix
  assert.ok(r.midi.have.every(Boolean), JSON.stringify(r.midi.have)); assert.strictEqual(r.midi.learnAttr, 'deckA.fx1On');
  near(r.midi.s[0].wet, 0.31, 0.001, 'fx1Wet'); assert.strictEqual(r.midi.s[0].type, 'crush', 'fx.<tipo> apunta a la ranura 1'); assert.strictEqual(r.midi.s[0].on, true, 'fxOn alterna la ranura 1'); near(r.midi.s[2].p, 0.12, 0.001, 'fx3P'); assert.strictEqual(r.midi.s[1].on, true); near(r.midi.res, 0.4, 0.001, 'MIDI RES');
  assert.deepStrictEqual([r.api0.type, r.api0.on, r.api0.wet, r.api0.p], ['filter', true, 0.9, 0.2], 'fxSet'); assert.ok(r.api1.wet < 0.05, `fxRamp llega al destino (${r.api1.wet})`);
  assert.deepStrictEqual(r.stored.map((s) => s.type), ['gate', 'crush', 'filter']); assert.deepStrictEqual(r.reloaded.slice(0, 2), r.stored.slice(0, 2), 'se recuerda entre sesiones');
  assert.deepStrictEqual(r.noRemember[0], { type: 'echo', on: false, wet: 0.5, p: 0.5 }, 'sin «recordar», cadena por defecto'); assert.strictEqual(r.loadKeeps, true, 'cargar una pista conserva la cadena');
  assert.ok(r.small.sw <= r.small.w && r.small.sh <= r.small.ih + 1, `1366×768 sin desbordes (${r.small.sw}x${r.small.sh})`);
  console.log('ui ok');
};

tests.settings = async () => {
  const sd = require('../main/settings.js').defaults();
  assert.strictEqual(sd.fxHold, true); assert.strictEqual(sd.fxRemember, true); assert.strictEqual(sd.filterRes, 0.07);
  const html = read('renderer/index.html');
  for (const n of ['fxHold', 'fxRemember', 'filterRes']) assert.ok(new RegExp(`name="${n}"`).test(html), n);
  assert.ok(/data-pane="fx"/.test(html) && />Efectos y filtros</.test(html));
  const r = electronRun('fx-settings-selftest.js', 'fx-settings.json');
  assert.ok(!r.__err, JSON.stringify(r.__err));
  assert.strictEqual(r.start.tab, 'Efectos y filtros'); assert.deepStrictEqual(r.start.pane, ['fx']);
  assert.deepStrictEqual(r.start.s, { fxHold: true, fxRemember: true, filterRes: 0.07 }); assert.deepStrictEqual(r.start.ctl, { fxHold: true, fxRemember: true, filterRes: 0.07 });
  assert.strictEqual(r.hold.s.fxHold, false, 'se guarda al cambiar'); assert.strictEqual(r.remember.s.fxRemember, false);
  assert.strictEqual(r.res.s.filterRes, 0.3); assert.strictEqual(r.res.resA, 0.3, 'el deck sin tocar toma el nuevo valor'); assert.strictEqual(r.res.resB, 0.9, 'el RES movido se respeta'); assert.strictEqual(r.dbl, 0.3, 'doble clic = nuevo valor por defecto');
  assert.deepStrictEqual(r.search.pane, ['fx'], 'el buscador encuentra la opción');
  assert.deepStrictEqual(r.reset.s, { fxHold: true, fxRemember: true, filterRes: 0.07 }, 'restablecer sección'); assert.deepStrictEqual(r.reset.ctl, { fxHold: true, fxRemember: true, filterRes: 0.07 }); assert.strictEqual(r.reset.resA, 0.07);
  console.log('settings ok');
};

tests.docs = async () => {
  const d2 = read('docs/02-decks-y-mezclador.md'); const d6 = read('docs/06-sampler-grabacion-midi.md'); const rd = read('README.md'); const cmp = read('docs/COMPARATIVA.md');
  for (const k of ['cadena de tres efectos', 'pad XY', 'Mantener', 'Phaser', 'Crush', 'Filtro', 'RES', 'MIDI learn', 'img/08-fx.png']) assert.ok(d2.includes(k), `02: ${k}`);
  assert.ok(!/\*\*FX\*\* enciende o apaga/.test(d2), 'sin la descripción antigua');
  assert.ok(d6.includes('Efectos y filtros') && d6.includes('img/45-ajustes-efectos.png') && d6.includes('Siete secciones'));
  assert.ok(/cadena de tres efectos/.test(rd) && /phaser/i.test(cmp) && !/🆕 4 \(eco/.test(cmp));
  for (const f of ['08-fx.png', '45-ajustes-efectos.png']) assert.ok(fs.existsSync(path.join(root, 'docs/img', f)), f);
  const ci = read('.github/workflows/ci.yml');
  assert.ok(/for m in model docs; do node scripts\/test-fx\.js/.test(ci), 'CI rápida: model y docs');
  assert.ok((ci.match(/for m in engine ui settings; do/g) || []).length === 2, 'CI con ventana: engine, ui y settings (Linux y resto)');
  console.log('docs ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-fx.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
