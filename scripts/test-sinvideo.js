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

tests.source = async () => {
  const { resolveSource } = await import('../renderer/source.js');
  const yt = { videoId: 'abc' };
  // REQ-2: archivo local → siempre archivo, sin alternativa
  assert.deepStrictEqual(resolveSource({ track: { local: true } }), { source: 'file', origin: 'LOCAL', canSwitch: false, why: null, missing: false });
  // copia guardada: se usa sola con preferSaved; sin él, streaming; siempre conmutable
  const saved = { saved: { path: '/x', localId: 'L1' } };
  assert.strictEqual(resolveSource({ track: yt, analysis: saved }).source, 'file');
  assert.strictEqual(resolveSource({ track: yt, analysis: saved }).origin, 'GUARDADA');
  assert.strictEqual(resolveSource({ track: yt, analysis: saved, preferSaved: false }).source, 'stream');
  assert.ok(resolveSource({ track: yt, analysis: saved, preferSaved: false }).canSwitch);
  assert.strictEqual(resolveSource({ track: yt, analysis: saved, forced: 'stream' }).source, 'stream');
  assert.strictEqual(resolveSource({ track: yt, analysis: saved, preferSaved: false, forced: 'file' }).source, 'file');
  // audio de la caché: conmutable pero no se usa solo
  const cached = { audio: 'abc.m4a' };
  assert.strictEqual(resolveSource({ track: yt, analysis: cached }).source, 'stream');
  assert.ok(resolveSource({ track: yt, analysis: cached }).canSwitch);
  assert.strictEqual(resolveSource({ track: yt, analysis: cached, forced: 'file' }).source, 'file');
  // sin copia: streaming, no conmutable, con razón
  const none = resolveSource({ track: yt, analysis: { bpm: 120 } });
  assert.deepStrictEqual([none.source, none.origin, none.canSwitch, none.missing], ['stream', 'STREAM', false, false]);
  assert.ok(/Analiza la pista/.test(none.why));
  // la copia desapareció
  const gone = resolveSource({ track: yt, analysis: { savedMissing: true } });
  assert.deepStrictEqual([gone.source, gone.canSwitch, gone.missing], ['stream', false, true]);
  // el analizador marca savedMissing
  const { Analyzer } = require('../main/analyzer');
  const os = require('os'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-an-'));
  const an = new Analyzer({ cacheDir: dir, settings: { get: () => ({}) }, emit() {} });
  fs.writeFileSync(an.jsonPath('GONE0000001'), JSON.stringify({ id: 'GONE0000001', bpm: 120, saved: { path: path.join(dir, 'no-existe.m4a'), localId: 'L' } }));
  assert.strictEqual(an.get('GONE0000001').savedMissing, true);
  assert.strictEqual(an.get('GONE0000001').saved, undefined);
  fs.writeFileSync(an.jsonPath('HERE0000001'), JSON.stringify({ id: 'HERE0000001', bpm: 120, saved: { path: __filename, localId: 'L' } }));
  assert.strictEqual(an.get('HERE0000001').savedMissing, undefined);
  // ajuste y piezas de interfaz
  assert.strictEqual(require('../main/settings').get().preferSaved, true, 'preferSaved por defecto');
  assert.ok(/name="preferSaved"/.test(read('renderer/index.html')) && /resolveSource/.test(read('renderer/deck.js')) && /src-chip/.test(read('renderer/library.js')));
  // e2e en Electron
  const { spawnSync } = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-source-'));
  const music = path.join(tmp, 'music');
  const gen = spawnSync(process.execPath, [path.join(__dirname, 'make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), `sin audio de demostración: ${gen.stderr || gen.stdout}`);
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 150000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'source-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
  const f = path.join(tmp, 'source.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(r)) assert.ok(!(v && v.__err), `${k}: ${JSON.stringify(v)}`);
  assert.strictEqual(r.local.state, 'ARCHIVO LOCAL'); assert.strictEqual(r.local.source, 'local'); assert.deepStrictEqual(r.local.na, ['true', 'true']);
  assert.ok(['STREAM', 'cargando…'].includes(r.stream.state), `estado: ${r.stream.state}`); assert.strictEqual(r.stream.origin, 'STREAM'); assert.strictEqual(r.stream.source, 'stream'); assert.ok(/Analiza la pista/.test(r.stream.titles[1]), `razón visible: ${r.stream.titles}`);
  assert.strictEqual(r.afterSwitch, 'stream', 'sin alternativa no cambia');
  assert.ok(r.chips.length >= 1 && r.chips.every((c) => c === 'ARCHIVO'), `chips: ${r.chips}`);
  assert.strictEqual(r.pref, false);
  console.log('source: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
