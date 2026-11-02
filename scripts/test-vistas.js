#!/usr/bin/env node
// Pruebas del cambio vistas-y-ajustes.  Uso: node scripts/test-vistas.js state|ui|search|save|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests.state = async () => {
  const { SplitState, clampSplit, SPLITVIEWS, STEP, STEP_BIG } = await import('../renderer/splits.js');
  assert.deepStrictEqual(SPLITVIEWS, ['mix', 'library']);
  assert.deepStrictEqual([STEP, STEP_BIG], [8, 32]);
  // REQ-1: límites por zona y ventana
  assert.strictEqual(clampSplit('waves', 10, 900), 90, 'mínimo de las ondas');
  assert.strictEqual(clampSplit('waves', 900, 900), 405, 'máximo = 45 %');
  assert.strictEqual(clampSplit('lib', 10, 900), 150);
  assert.strictEqual(clampSplit('lib', 900, 900), 495, 'máximo = 55 %');
  assert.strictEqual(clampSplit('lib', 900, 200), 150, 'en una ventana pequeña vale el mínimo');
  // arrastrar: manda el último
  const s = new SplitState();
  assert.strictEqual(s.active('mix'), null, 'sin tocar: tamaño por defecto');
  assert.deepStrictEqual(s.drag('mix', 'waves', 200.4), { which: 'waves', px: 200 });
  assert.deepStrictEqual(s.drag('mix', 'lib', 300), { which: 'lib', px: 300 });
  assert.deepStrictEqual(s.get('mix'), { last: 'lib', waves: 200, lib: 300 }, 'el otro valor se conserva');
  assert.strictEqual(s.drag('mix', 'bad', 5), null);
  assert.strictEqual(s.drag('nope', 'waves', 5), null);
  assert.strictEqual(s.drag('mix', 'waves', NaN), null);
  // cada vista es independiente
  assert.strictEqual(s.active('library'), null);
  s.drag('library', 'lib', 260);
  // REQ-1: restablecer una vista; REQ-2: todas
  s.reset('mix');
  assert.strictEqual(s.active('mix'), null);
  assert.deepStrictEqual(s.active('library'), { which: 'lib', px: 260 });
  // REQ-2: guardado y lectura (también datos dañados)
  const back = new SplitState(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(back.active('library'), { which: 'lib', px: 260 });
  const bad = new SplitState({ mix: { last: 'x', waves: -4, lib: 'a' }, library: { waves: 120 } });
  assert.strictEqual(bad.active('mix'), null);
  assert.deepStrictEqual(bad.active('library'), { which: 'waves', px: 120 }, 'sin last, usa el valor que exista');
  s.resetAll();
  assert.strictEqual(s.active('library'), null);
  console.log('state ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-vistas.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
