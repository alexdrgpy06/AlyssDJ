#!/usr/bin/env node
// Pruebas de los perfiles de pantalla.  Uso: node scripts/test-layouts.js unit|e2e|setting
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const mode = process.argv[2];
const tests = {};

tests.unit = async () => {
  const L = await import('../renderer/layout.js');
  // REQ-1
  assert.strictEqual(L.profileFor(1366, 768), 'compact');
  assert.strictEqual(L.profileFor(1279, 1000), 'compact');
  assert.strictEqual(L.profileFor(1600, 779), 'compact');
  assert.strictEqual(L.profileFor(1600, 960), 'normal');
  assert.strictEqual(L.profileFor(1919, 1080), 'normal');
  assert.strictEqual(L.profileFor(1920, 1080), 'wide');
  assert.strictEqual(L.profileFor(3840, 2160), 'wide');
  // REQ-3: la escala crece con la pantalla y tiene tope
  assert.ok(L.scaleFor(1920, 1080) >= 1.15 && L.scaleFor(1920, 1080) < L.scaleFor(2560, 1440));
  assert.strictEqual(L.scaleFor(7680, 4320), 1.6);
  // REQ-4: el modo manual manda sobre la pantalla
  assert.strictEqual(L.resolve('compact', 2560, 1440).profile, 'compact');
  assert.strictEqual(L.resolve('normal', 1000, 600).profile, 'normal');
  assert.strictEqual(L.resolve('auto', 2560, 1440).profile, 'wide');
  assert.strictEqual(L.resolve('nada', 1600, 960).profile, 'normal');
  assert.strictEqual(L.resolve('normal', 2560, 1440).scale, 1);
};

function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-layout-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 150000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'layouts-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'layouts.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.LAYOUT_SHOTS) for (const n of fs.readdirSync(tmp).filter((x) => x.endsWith('.png'))) fs.copyFileSync(path.join(tmp, n), path.join(process.env.LAYOUT_SHOTS, n));
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

tests.e2e = async () => {
  const r = run();
  const want = { '1366x768': ['compact', 1], '1600x960': ['normal', 1], '2560x1440': ['wide', null] };
  for (const [size, [layout, scale]] of Object.entries(want)) {
    const m = r.sizes[size];
    assert.ok(!m.__err, JSON.stringify(m));
    assert.strictEqual(m.layout, layout, `${size}: perfil ${m.layout}`);
    if (scale) assert.strictEqual(Number(m.scale), scale);
    // REQ-2/3: nada se sale ni hace desplazar la página; decks, mezclador y librería están a la vista
    assert.ok(m.sw <= m.w + 1, `${size}: desplazamiento horizontal (${m.sw} > ${m.w})`);
    assert.ok(m.deckA.b <= m.h && m.mixer.b <= m.h && m.library.t < m.h - 80, `${size}: contenido fuera de la ventana ${JSON.stringify({ deck: m.deckA.b, mixer: m.mixer.b, lib: m.library.t, h: m.h })}`);
    assert.ok(m.library.h >= 120, `${size}: la librería es visible (${Math.round(m.library.h)} px)`);
  }
  assert.ok(Number(r.sizes['2560x1440'].scale) >= 1.15, 'REQ-3: amplio escala la interfaz');
  console.log('layouts e2e: OK', JSON.stringify(Object.fromEntries(Object.entries(r.sizes).map(([k, v]) => [k, [v.layout, v.scale, Math.round(v.library.h)]]))));
};

tests.setting = async () => {
  const r = run();
  assert.strictEqual(r.forced.layout, 'compact', 'REQ-4: forzado a compacto aunque la ventana sea normal');
  assert.strictEqual(r.saved, 'compact', 'REQ-4: se recuerda');
  console.log('layouts setting: OK');
};

if (!tests[mode]) (console.error('uso: test-layouts.js unit|e2e|setting'), process.exit(2));
tests[mode]().then(() => mode === 'unit' && console.log('layouts unit: OK'), (e) => (console.error(e), process.exit(1)));
