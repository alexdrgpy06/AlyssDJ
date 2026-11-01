#!/usr/bin/env node
// Pruebas del cambio sin-video-fuentes-y-cola-analisis.  Uso: node scripts/test-sinvideo.js removed|source|backlog|queue-ui|views|immersive|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests.removed = async () => {
  // REQ-1: sin video en ningún punto
  for (const f of ['renderer/video.html', 'renderer/video.js', 'renderer/localvideo.js', 'preload/video-window.js', 'docs/05-video-y-segunda-pantalla.md', 'scripts/test-video-local.js', 'scripts/video-local-selftest.js']) assert.ok(!fs.existsSync(path.join(root, f)), `${f} debe borrarse`);
  const code = ['main/main.js', 'main/analyzer.js', 'main/ytdlp.js', 'main/library-save.js', 'main/ytm-library.js', 'preload/app.js', 'preload/deck.js', 'renderer/app.js', 'renderer/deck.js', 'renderer/index.html', 'renderer/styles.css'].map(read).join('\n');
  assert.ok(!/videoWin|layoutVideo|video:open|video:state|localvideo|downloadVideo|videoArgs|findVideo|saveVideo|videoMaxHeight|videoPref|VIDEO_CSS|setVideoView|preferVideo|video-panel|btn-video|vp-toggle|videoState/.test(code), 'quedan restos del video');
  assert.ok(!/class="pop"|i-popout|i-video/.test(read('renderer/index.html')), 'sin botón de video en el plato');
  // los ajustes antiguos se ignoran
  const fs2 = require('fs'); const os = require('os');
  const dir = fs2.mkdtempSync(path.join(os.tmpdir(), 'alyss-set-'));
  fs2.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ saveVideo: true, videoMaxHeight: 720, videoPref: true, keepAudio: true }));
  process.env.YTDJ_SETTINGS_DIR = dir;
  const S = require('../main/settings');
  const s = S.get();
  assert.ok(!('saveVideo' in s) && !('videoMaxHeight' in s) && !('videoPref' in s), 'ajustes de video ignorados');
  assert.strictEqual(s.keepAudio, true, 'el resto de ajustes se conserva');
  // el botón YTM de cada deck y el streaming se conservan
  assert.ok(/view-ytm/.test(read('renderer/index.html')) && /deck:show/.test(read('main/main.js')));
  // el analizador y yt-dlp siguen exportando lo de audio
  const L = require('../main/library-save'); const Y = require('../main/ytdlp');
  assert.ok(typeof L.findSaved === 'function' && typeof Y.downloadToLibrary === 'function' && typeof Y.download === 'function');
  console.log('removed: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
