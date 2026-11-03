#!/usr/bin/env node
// Pruebas del cambio efectos-ampliados.  Uso: node scripts/test-fx-ampliados.js model|presets|automix|docs   ·   xvfb-run -a node scripts/test-fx-ampliados.js engine|ui
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const modes = (process.argv[2] || 'model').split(',');
const tests = {};
const NEW = ['tape', 'reducer', 'stutter', 'brake', 'transformer', 'drive', 'pitch'];

function electronRun(selftest, name, timeout = 200000) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-fxa-'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, selftest), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp }, stdio: 'ignore' });
  const f = path.join(tmp, name);
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.ok(!r.__err, JSON.stringify(r.__err));
  r.__dir = tmp;
  return r;
}

tests.model = async () => {
  const { FxChain, FX_TYPES, USES_DIV, ROUTES, clampSlot, defaultChain } = await import('../renderer/fxchain.js');
  // REQ-1/2: los 14 tipos, los siete de siempre primero; división y ruta acotadas
  assert.deepStrictEqual(FX_TYPES.slice(7), NEW); assert.strictEqual(FX_TYPES.length, 14);
  assert.ok(USES_DIV.every((t) => FX_TYPES.includes(t)) && USES_DIV.includes('stutter') && USES_DIV.includes('tape'));
  assert.deepStrictEqual(ROUTES, ['deck', 'both']);
  assert.strictEqual(clampSlot({ d: 9 }).d, 4); assert.strictEqual(clampSlot({ d: -2 }).d, 0); assert.strictEqual(clampSlot({ d: 2.4 }).d, 2); assert.strictEqual(clampSlot({ d: null }).d, null); assert.strictEqual(clampSlot({ d: 'x' }).d, null); assert.strictEqual(clampSlot({}).d, null);
  assert.strictEqual(clampSlot({ route: 'both' }).route, 'both'); assert.strictEqual(clampSlot({ route: 'master' }).route, 'deck', 'ruta desconocida = solo este deck');
  assert.strictEqual(clampSlot({ type: 'brake' }).type, 'brake');
  // REQ-5: mover ranuras
  const c = new FxChain(null); const seen = [];
  c.set(0, { type: 'tape' }); c.set(1, { type: 'brake' }); c.set(2, { type: 'drive' }); c.onChange = (i) => seen.push(i);
  c.select(0);
  assert.strictEqual(c.move(0, 2), true); assert.deepStrictEqual(c.slots.map((s) => s.type), ['brake', 'drive', 'tape'], 'la 1 pasa al final'); assert.strictEqual(c.selected, 2, 'la selección acompaña a su ranura'); assert.deepStrictEqual(seen, [0, 1, 2]);
  assert.strictEqual(c.move(2, 0), true); assert.deepStrictEqual(c.slots.map((s) => s.type), ['tape', 'brake', 'drive']); assert.strictEqual(c.selected, 0);
  assert.strictEqual(c.move(1, 1), false); assert.strictEqual(c.move(0, 5), false); assert.strictEqual(c.move(-1, 1), false);
  c.select(1); c.move(0, 2); assert.strictEqual(c.selected, 0, 'mover otra ranura desplaza la selección'); // brake sube a la 0
  // la copia que viaja al motor lleva d y route
  assert.ok(c.snapshot().every((s) => 'd' in s && 'route' in s));
  assert.deepStrictEqual(defaultChain().map((s) => s.route), ['deck', 'deck', 'deck']);
  const back = FxChain.fromJSON(JSON.stringify(c)); assert.deepStrictEqual(back.snapshot(), c.snapshot(), 'persistencia con d y route');
  // una cadena guardada con el formato anterior (sin d ni route) se carga bien
  const old = FxChain.fromJSON(JSON.stringify([{ type: 'echo', on: true, wet: 0.3, p: 0.9 }])); assert.deepStrictEqual(old.slots[0], { type: 'echo', on: true, wet: 0.3, p: 0.9, d: null, route: 'deck' });
  console.log('fx model: OK');
};

tests.presets = async () => {
  const { FxPresets, FACTORY, MAX_USER } = await import('../renderer/fxpresets.js');
  const { FxChain } = await import('../renderer/fxchain.js');
  const mem = new Map(); const st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const p = new FxPresets(st);
  // REQ-3: de fábrica
  const names = p.list().map((x) => x.name);
  for (const n of ['Eco largo', 'Barrido de filtro', 'Roll de redoble']) assert.ok(names.includes(n), `fábrica: ${n}`);
  assert.ok(p.list().every((x) => x.factory), 'sin propios todos son de fábrica');
  // aplicar: cambia tipo y parámetros pero no enciende
  const c = new FxChain(null); const r = p.apply(c, 1, 'Roll de redoble');
  assert.deepStrictEqual([r.type, r.on, r.d], ['stutter', false, 3]); assert.strictEqual(p.apply(c, 1, 'no existe'), null);
  // guardar los propios y borrarlos
  c.set(0, { type: 'tape', wet: 0.7, p: 0.2, d: 1 });
  assert.deepStrictEqual(p.save('Mi cinta', c.slots[0]), { ok: true });
  const mine = p.list().find((x) => x.name === 'Mi cinta'); assert.ok(mine && !mine.factory && mine.type === 'tape' && mine.d === 1);
  assert.ok(new FxPresets(st).get('Mi cinta'), 'persiste entre sesiones');
  p.save('mi cinta', { ...c.slots[0], wet: 0.1 }); assert.strictEqual(p.user().length, 1, 'mismo nombre = sustituye'); assert.strictEqual(p.user()[0].wet, 0.1);
  assert.match(p.save('  ', c.slots[0]).error, /nombre/); assert.match(p.save('eco LARGO', c.slots[0]).error, /fábrica/);
  assert.strictEqual(p.remove('Eco largo'), false, 'los de fábrica no se borran'); assert.strictEqual(p.remove('mi cinta'), true); assert.strictEqual(p.remove('mi cinta'), false); assert.strictEqual(p.user().length, 0);
  for (let i = 0; i < MAX_USER; i++) assert.ok(p.save(`p${i}`, c.slots[0]).ok); assert.match(p.save('uno más', c.slots[0]).error, /borra alguno/);
  // datos dañados
  mem.set('alyssdj.fxpresets', '{no json'); assert.deepStrictEqual(p.user(), []); mem.set('alyssdj.fxpresets', JSON.stringify([{ name: 'x', type: 'nope', wet: 9 }, 5, null])); assert.deepStrictEqual(p.user().map((x) => [x.type, x.wet]), [['echo', 1]]);
  assert.ok(FACTORY.every((f) => f.name.length <= 24));
  console.log('fx presets: OK');
};

tests.engine = async () => {
  const r = electronRun('fx-ampliados-selftest.js', 'fx-ampliados.json');
  assert.deepStrictEqual(r.NEW, NEW);
  for (const t of NEW) {
    const e = r.each[t];
    assert.ok(e.dist > 0.01, `${t} altera la señal (${e.dist})`); assert.ok(!e.nan, `${t} sin NaN`); assert.strictEqual(e.mounted, t, `${t} se monta`);
    assert.ok(e.peak < 1.6, `REQ-6: ${t} sin clipping con wet 1 (pico ${e.peak}, seco ${r.dryPeak})`);
    assert.ok(r.cost[t] < 0.05, `REQ-8: ${t} cuesta ${(r.cost[t] * 100).toFixed(1)} % del tiempo real`);
    assert.ok(r['w0' + t].dist < 1e-3 && r['w0' + t].mounted === null, `REQ-8: ${t} con wet 0 es transparente y no monta nada: ${JSON.stringify(r['w0' + t])}`);
    assert.ok(r.stable[t], `REQ-6: ${t} estable con BPM 70/174 y P 0/1`);
  }
  assert.ok(r.offDist < 1e-6 && r.offMounted.every((m) => m === null), 'apagadas: transparentes y sin montar');
  // tono del pitch (senoide 220 Hz): ±12 = octava
  const { mid } = r.pitchSpec;
  assert.ok(mid.f220 > mid.f440 * 5 && mid.f220 > mid.f110 * 5, `pitch: el centro no cambia el tono (${JSON.stringify(mid)})`);
  // el desplazador por retardos modulados deja el tono a ±12 % de la octava (los empalmes entre voces mueven la fase): se comprueba el pico dominante
  const peakAt = (o) => o.top[0][0];
  assert.ok(peakAt(r.pitchTop.up) >= 390 && peakAt(r.pitchTop.up) <= 480, `pitch +12 sube casi una octava (pico ${peakAt(r.pitchTop.up)} Hz de 220)`);
  assert.ok(peakAt(r.pitchTop.down) >= 100 && peakAt(r.pitchTop.down) <= 125, `pitch −12 baja casi una octava (pico ${peakAt(r.pitchTop.down)} Hz de 220)`);
  assert.ok(r.reducer.uniq < r.reducer.uniqDry / 4, `reducer: P alto baja la resolución (${JSON.stringify(r.reducer)})`);
  assert.ok(r.transformer.quiet > 0.2, `transformer corta por pasos (${r.transformer.quiet})`);
  // REQ-2: la división de beat mueve la repetición (120 BPM: 1 = 0,5 s; ¼ = 0,125 s; ½ = 0,25 s)
  const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
  near(r.div.echo0.t, 0.5, 0.02, 'eco d=1 beat'); near(r.div.echo2.t, 0.125, 0.02, 'eco d=¼'); near(r.div.tape1.t, 0.25, 0.02, 'cinta d=½'); near(r.div.tape2.t, 0.125, 0.02, 'cinta d=¼');
  // REQ-6: cambiar de efecto no mete chasquidos (el salto máximo entre muestras sigue siendo de la senoide)
  for (const [k, v] of Object.entries(r.switch)) { assert.ok(!v.nan, `${k} sin NaN`); assert.ok(v.jump <= v.own * 1.25 + 0.02, `REQ-6: ${k} cambia sin salto (${v.jump}; el mayor de los dos efectos solos ${v.own}; seco ${r.dryJump})`); }
  assert.deepStrictEqual(r.dclamp, [4, 0, null], 'd acotada en el motor');
  console.log('fx engine: OK', JSON.stringify(Object.fromEntries(NEW.map((t) => [t, `${(r.cost[t] * 100).toFixed(1)} %`]))));
};

tests.ui = async () => {
  const r = electronRun('fx-ampliados-ui-selftest.js', 'fxa-ui.json');
  assert.strictEqual(r.options.n, 14, 'REQ-1: los 14 tipos en el selector'); assert.deepStrictEqual(r.options.groups, ['Espacio', 'Modulación', 'Ritmo', 'Color', 'Freno']);
  assert.strictEqual(r.type, 'stutter', 'se elige un tipo nuevo');
  assert.ok(!r.pop.hidden && r.pop.expanded === 'true', 'el botón ⋯ abre las opciones'); assert.ok(r.pop.divDisabled.every((x) => !x), 'REQ-2: stutter usa la división');
  assert.strictEqual(r.div.d, 2); assert.deepStrictEqual(r.div.on, ['¼'], 'REQ-2: división ¼ marcada');
  assert.ok(r.divFilter, 'REQ-2: el filtro no usa división y sus botones se deshabilitan');
  assert.deepStrictEqual([r.both.A.route, r.both.B.route, r.both.B.type, r.both.label], ['both', 'both', 'filter', true], `REQ-5: «ambos» copia la ranura al otro deck: ${JSON.stringify(r.both)}`);
  assert.strictEqual(r.follow, 'brake', 'REQ-5: el otro deck sigue los cambios');
  assert.deepStrictEqual(r.order.types.slice(0, 3), ['filter', 'tape', 'brake'].slice(0, 0).concat(r.order.types.slice(0, 3)), 'orden coherente'); assert.strictEqual(r.order.types[1], 'tape', 'REQ-5: la ranura se movió a la posición 2'); assert.strictEqual(r.order.selected, 1, 'la selección acompaña');
  assert.ok(/CINTA/.test(r.order.labels[1]), `REQ-5: la fila de ranuras muestra el orden: ${r.order.labels}`);
  assert.deepStrictEqual([r.preset.type, r.preset.d, r.preset.on], ['stutter', 3, false], 'REQ-3: aplicar un preset no enciende la ranura');
  assert.ok(r.saved.opts.includes('Mi roll') && r.saved.store.includes('Mi roll'), `REQ-3: guardar un preset propio: ${JSON.stringify(r.saved)}`); assert.match(r.dup, /fábrica/, 'no pisa uno de fábrica');
  assert.ok(!r.deleted.opts.includes('Mi roll') && r.deleted.store === 0, `REQ-3: borrar un preset propio: ${JSON.stringify(r.deleted)}`); assert.ok(r.closed, 'un clic fuera cierra las opciones');
  assert.ok(r.holdStart.on && r.holdStart.wet < 0.7, `REQ-4: al mantener, entra con rampa (wet ${r.holdStart.wet})`); assert.ok(Math.abs(r.holdOn.wet - 0.7) < 0.02 && r.holdOn.on, `REQ-4: llega a su cantidad (${r.holdOn.wet})`);
  assert.ok(r.holdFading.on && r.holdFading.wet < 0.7, `REQ-4: al soltar, sale con rampa (wet ${r.holdFading.wet})`); assert.ok(!r.holdOff.on && Math.abs(r.holdOff.wet - 0.7) < 0.01, `REQ-4: queda como estaba: ${JSON.stringify(r.holdOff)}`);
  assert.ok(r.alreadyOn.on && Math.abs(r.alreadyOn.wet - 0.4) < 0.01, 'si ya estaba encendida, la tecla no la toca'); assert.strictEqual(r.typing, false, 'escribiendo no dispara');
  console.log('fx ui: OK');
};

tests.automix = async () => {
  const { planTransitionMoves, FxMoves } = await import('../renderer/fxcues.js');
  const cur = { bpm: 120, mix: { phrases: [10, 10, 10, 10], phraseBeats: 16 }, offset: 0, duration: 200 };
  const plan = { exitAt: 100, seconds: 16 };
  // REQ-7: el frenazo solo en «En la caída», con efectos marcados y una transición lo bastante larga
  const full = planTransitionMoves({ level: 'full', cur, plan, style: 'drop-cut' });
  assert.deepStrictEqual(full.map((m) => [m.id, m.type, m.deck]), [['brake-drop', 'brake', 'from']]);
  assert.ok(full[0].atPos > plan.exitAt && Math.abs(full[0].endPos - (plan.exitAt + plan.seconds)) < 1e-9 && Math.abs(full[0].atPos - (full[0].endPos - 2)) < 1e-9, `empieza 4 pulsos antes del final: ${JSON.stringify(full[0])}`);
  assert.deepStrictEqual(planTransitionMoves({ level: 'subtle', cur, plan, style: 'drop-cut' }), [], 'nivel sutil: sin frenazo');
  assert.deepStrictEqual(planTransitionMoves({ level: 'off', cur, plan, style: 'drop-cut' }), [], 'nivel apagado: nada');
  assert.deepStrictEqual(planTransitionMoves({ level: 'full', cur, plan: { exitAt: 100, seconds: 6 }, style: 'drop-cut' }), [], 'transición corta: sin frenazo');
  assert.ok(!planTransitionMoves({ level: 'full', cur, plan, style: 'bass' }).some((m) => m.type === 'brake'), 'otros estilos no frenan');
  // respeta las ranuras libres: con las tres en uso no se reserva y se anota
  const chain = { slots: [{ on: true }, { on: true }, { on: true }], owners: ['user', 'user', 'user'] };
  const fxm = new FxMoves(); const deck = { id: 'A', fxc: chain, fxSet() {} };
  assert.strictEqual(fxm.claim(deck, full[0]), null); assert.deepStrictEqual(fxm.takeSkipped(), ['frenazo en la caída']);
  chain.slots[1].on = false; const set = []; deck.fxSet = (i, patch) => set.push([i, patch.type]);
  assert.strictEqual(fxm.claim(deck, full[0]), 1); assert.deepStrictEqual(set, [[1, 'brake']], 'usa la ranura libre');
  console.log('fx automix: OK');
};

tests.docs = async () => {
  const d = read('docs/02-decks-y-mezclador.md');
  for (const re of [/\*\*Cinta\*\*/, /\*\*Reducer\*\*/, /\*\*Stutter\*\*/, /\*\*Frenazo\*\*/, /\*\*Transformer\*\*/, /\*\*Drive\*\*/, /\*\*Pitch\*\*/, /\*\*División\*\*/, /\*\*Presets\*\*/, /### Instant FX/, /Ambos decks/, /Antes/, /En la caída/, /ranura libre/]) assert.match(d, re, `la guía menciona ${re}`);
  const html = read('renderer/index.html'); assert.match(html, /Instant FX/, 'la ayuda («?») lo explica');
  const inv = read('docs/inventario-controles.md'); for (const id of ['.fx-more', '.fx-div', '.fx-route', '.fx-preset', '.fx-pname']) assert.ok(inv.includes(id), `inventario: ${id}`);
  for (const f of ['shared/fx.js', 'renderer/fxpresets.js']) assert.ok(fs.existsSync(path.join(root, f)), f);
  console.log('fx docs: OK');
};

const run = async () => { for (const m of modes) { if (!tests[m]) { console.error(`uso: test-fx-ampliados.js ${Object.keys(tests).join('|')}`); process.exit(2); } await tests[m](); } };
run().catch((e) => (console.error(e), process.exit(1)));
