#!/usr/bin/env node
// Pruebas del rediseño de la interfaz.  Uso: node scripts/test-rediseno.js video-removed|video-media|tokens|shell|sources|automix|settings|e2e|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests['video-removed'] = async () => {
  // REQ-1: no queda nada de la vista de miniaturas
  for (const f of ['renderer/ministage.js', 'scripts/test-ministage.js', 'scripts/test-stage.js', 'scripts/stage-selftest.js']) assert.ok(!fs.existsSync(path.join(root, f)), `${f} debe borrarse`);
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const app = read('renderer/app.js');
  assert.ok(!/id="stage"|amv-stage|stage-grip|class="tile"/.test(html), 'HTML sin miniaturas');
  assert.ok(!/\.stage\b|\.tile\b|am-stage/.test(css), 'CSS sin miniaturas');
  assert.ok(!/MiniStage|ministage|syncStage|this\.stage|alyssdj\.stage/.test(app), 'app.js sin miniaturas');
  assert.ok(!/e\.key === '\['|e\.key === 'v'/.test(app), 'sin teclas V, [ y ]');
  assert.ok(!/setFrames|frameUrl|onFrame/.test(read('renderer/deck.js')), 'deck.js sin frames');
  assert.ok(!/grabFrame|deck:frame|setFrames/.test(read('preload/deck.js') + read('preload/app.js') + read('main/main.js')), 'sin IPC de frames');
  assert.ok(!/test-ministage/.test(read('.github/workflows/ci.yml')), 'CI sin la prueba borrada');
  // el menú de la ventana de video se conserva
  assert.ok(/id="video-panel"/.test(html) && /id="btn-video"/.test(html), 'el menú Video sigue');
  console.log('video-removed: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
