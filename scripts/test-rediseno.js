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

tests['video-media'] = async () => {
  const { spawnSync } = require('child_process');
  const os = require('os');
  // estático: el contrato existe de punta a punta y main ya no deja visible la vista de un deck sin medio
  const main = read('main/main.js');
  assert.ok(/video:deck-media/.test(main) && /video:deck-media/.test(read('preload/app.js')), 'canal video:deck-media');
  assert.ok(!/video:deck-source|setDeckSource/.test(main + read('preload/app.js') + read('renderer/deck.js')), 'sin el canal antiguo');
  assert.ok(/m\.kind === 'stream'/.test(main), 'la vista de streaming solo se muestra con medio stream');
  assert.ok(/id="ph-A"/.test(read('renderer/video.html')), 'la ventana tiene pantalla de «sin video»');
  // e2e en Electron
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-media-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 150000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'video-media-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: path.join(root, 'docs/demo-audio') } });
  const f = path.join(tmp, 'video-media.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); if (process.env.DEBUG_MEDIA) console.log(JSON.stringify(r));
  for (const [k, v] of Object.entries(r)) assert.ok(!(v && v.__err), `${k}: ${JSON.stringify(v)}`);
  assert.ok(r.hasWin, 'se abrió la ventana de video');
  assert.strictEqual(r.emptyA.display, 'grid'); assert.strictEqual(r.emptyA.text, 'Sin pista');
  assert.strictEqual(r.emptyB.text, 'Sin pista');
  assert.deepStrictEqual(r.emptyVisible, [false, false], 'decks vacíos: la página de YouTube Music no se ve');
  assert.strictEqual(r.localNoVideo.text, 'Sin video'); assert.strictEqual(r.localVisible, false);
  assert.strictEqual(r.streamLoading.text, 'Cargando…'); assert.strictEqual(r.streamVisible, false);
  console.log('video-media: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
