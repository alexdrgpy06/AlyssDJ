#!/usr/bin/env node
// Pruebas del video local.  Uso: node scripts/test-video-local.js detect|e2e|live
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mode = process.argv[2];
const tests = {};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-video-'));

tests.detect = async () => {
  const L = require('../main/library-save');
  const Y = require('../main/ytdlp');
  const { musicVideoTypeOf } = require('../main/ytm-library');
  // REQ-1: video real o solo portada según el tipo de YouTube Music
  assert.ok(L.isRealVideo('MUSIC_VIDEO_TYPE_OMV'));
  assert.ok(L.isRealVideo('MUSIC_VIDEO_TYPE_UGC'));
  assert.ok(L.isRealVideo('MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'));
  assert.ok(!L.isRealVideo('MUSIC_VIDEO_TYPE_ATV'), 'ATV = audio con portada');
  assert.ok(!L.isRealVideo(null) && !L.isRealVideo(undefined) && !L.isRealVideo(''));
  const panel = (id, type) => ({ playlistPanelVideoRenderer: { videoId: id, navigationEndpoint: { watchEndpoint: { videoId: id, watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: type } } } } } });
  const json = { contents: { items: [panel('AAA11111111', 'MUSIC_VIDEO_TYPE_OMV'), panel('BBB22222222', 'MUSIC_VIDEO_TYPE_ATV')] } };
  assert.strictEqual(musicVideoTypeOf(json, 'AAA11111111'), 'MUSIC_VIDEO_TYPE_OMV');
  assert.strictEqual(musicVideoTypeOf(json, 'BBB22222222'), 'MUSIC_VIDEO_TYPE_ATV', 'busca el de la pista pedida');
  assert.strictEqual(musicVideoTypeOf({}, 'x'), null);
  // REQ-2/5: argumentos: sin audio, hasta la altura pedida, a .video/<id>.mp4 (oculto: el índice local no lo toma por música)
  const dir = tmp();
  const a = L.videoArgs(dir, 'AAA11111111', 720);
  assert.ok(a.join(' ').includes('height<=720'));
  assert.ok(L.videoArgs(dir, 'AAA11111111', 9999).join(' ').includes('height<=1080'), 'altura inválida → 1080');
  assert.ok(a.includes('-o') && a[a.indexOf('-o') + 1] === path.join(dir, '.video', 'AAA11111111.%(ext)s'));
  assert.ok(!a.some((x) => /^-x$|audio-format|bestaudio/.test(x)), 'no es una descarga de audio');
  assert.throws(() => L.videoArgs(dir, '../etc/passwd'), /Identificador/);
  assert.strictEqual(L.findVideo(dir, 'AAA11111111'), null);
  const src = fs.readFileSync(path.join(__dirname, '../main/local-library.js'), 'utf8');
  assert.ok(/startsWith\('\.'\)/.test(src), 'el índice local salta las carpetas ocultas (.video)');
  assert.ok(!a.join(' ').includes('--cookies'), 'sin cookies, como el audio');

  // flujo del analizador con un yt-dlp de mentira (solo Linux/macOS: Windows no lanza scripts como .exe)
  const { Analyzer } = require('../main/analyzer');
  const settings = (o = {}) => ({ get: () => ({ saveVideo: true, videoMaxHeight: 720, ...o }) });
  const mkAn = (lib, o) => {
    const events = [];
    const types = { OMV: 'MUSIC_VIDEO_TYPE_OMV', ATV: 'MUSIC_VIDEO_TYPE_ATV' };
    const an = new Analyzer({ cacheDir: path.join(lib, 'cache'), settings: settings(o.settings), session: null, emit: (e) => events.push(e), ffmpeg: () => 'ffmpeg', localLib: null, libraryDir: () => lib, videoType: async (id) => { if (o.fail) throw new Error('YouTube Music no responde'); return types[o.type] || null; } });
    return { an, events };
  };
  const seed = (an, id) => fs.writeFileSync(an.jsonPath(id), JSON.stringify({ id, bpm: 124, duration: 200, saved: { path: __filename, localId: 'L1' } }));
  if (process.platform !== 'win32') {
    const stub = path.join(tmp(), 'yt-dlp');
    fs.writeFileSync(stub, '#!/bin/sh\n[ "$1" = "--version" ] && { echo 0.0.0-test; exit 0; }\nout=""; prev=""; for a in "$@"; do [ "$prev" = "-o" ] && out="$a"; prev="$a"; done\necho "$@" > "$(dirname "$out")/args.txt"\nmkdir -p "$(dirname "$out")"; printf VIDEO > "$(echo "$out" | sed "s/%(ext)s/mp4/")"\nexit 0\n', { mode: 0o755 });
    const ytdlp = require('../main/ytdlp');
    ytdlp.setManagedDirs([path.dirname(stub)]);
    for (const o of [{ type: 'OMV', want: 'ready' }, { type: 'ATV', want: 'none' }, { type: 'OMV', fail: true, want: 'error' }, { type: 'OMV', settings: { saveVideo: false }, want: undefined }]) {
      const lib = tmp();
      const { an, events } = mkAn(lib, { ...o, settings: { ytdlpPath: stub, ...(o.settings || {}) } });
      seed(an, 'AAA11111111');
      await an.saveVideo('AAA11111111');
      const st = an.get('AAA11111111').videoState;
      assert.strictEqual(st, o.want, `${JSON.stringify(o)} → ${st}`);
      if (o.want === 'ready') {
        assert.ok(fs.existsSync(path.join(lib, '.video', 'AAA11111111.mp4')), 'video guardado');
        assert.ok(an.videoPath('AAA11111111'), 'videoPath lo encuentra');
        assert.ok(events.some((e) => e.stage === 'video' && e.videoState === 'downloading'));
        assert.ok(an.get('AAA11111111').saved, 'el audio guardado sigue intacto');
      } else assert.ok(!fs.existsSync(path.join(lib, '.video', 'AAA11111111.mp4')), 'no se descargó video');
      if (o.want === 'error') assert.ok(an.get('AAA11111111').saved && an.get('AAA11111111').videoError, 'REQ-2: el fallo deja el audio y lo marca');
      if (o.want === 'ready') assert.ok(fs.readFileSync(path.join(lib, '.video', 'args.txt'), 'utf8').includes('height<=720'), 'respeta la calidad de Ajustes');
    }
  }
  // lo ya guardado antes de existir el video se completa en segundo plano al pedir su análisis
  const src2 = fs.readFileSync(path.join(__dirname, '../main/analyzer.js'), 'utf8');
  assert.ok(/videoState === undefined\) this\.saveVideo/.test(src2));
  console.log('video-local detect: OK');
};

tests.e2e = async () => {
  const { spawnSync } = require('child_process');
  const root = path.join(__dirname, '..');
  const out = tmp();
  const music = path.join(root, 'docs/demo-audio');
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), 'falta el audio de demostración: node scripts/make-demo-audio.js docs/demo-audio');
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 180000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'video-local-selftest.js'), YTDJ_USERDATA: path.join(out, 'data'), YTDJ_DOCS_MUSIC: music, YTDJ_SELFTEST_OUT: out } });
  const f = path.join(out, 'video-local.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.VIDEO_SHOTS) for (const n of fs.readdirSync(out).filter((x) => x.endsWith('.png'))) fs.copyFileSync(path.join(out, n), path.join(process.env.VIDEO_SHOTS, n));
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of ['mini', 'afterSeek', 'paused', 'pitched', 'vwin', 'noVideo']) assert.ok(!r[k]?.__err, `${k}: ${JSON.stringify(r[k])}`);
  assert.match(r.src || '', /^app:\/\/ui\/localvideo\//, 'REQ-3: hay video guardado para la pista');
  assert.strictEqual(r.srcNone, null, 'REQ-4: sin video guardado, no hay fuente');
  // REQ-3: miniatura sincronizada (deriva ≤ 0,3 s, con margen por el intervalo de 250 ms), pausa y velocidad
  const near = (x, tol, msg) => assert.ok(Math.abs(x.t - x.pos) <= tol, `${msg}: video ${x.t.toFixed(2)} vs deck ${x.pos.toFixed(2)}`);
  assert.strictEqual(r.mini.hidden, false, 'se ve el video en la miniatura');
  assert.ok(r.mini.playing && !r.mini.paused, 'suena y el video también');
  near(r.mini, 0.35, 'reproduciendo');
  near(r.afterSeek, 0.6, 'tras saltar');
  assert.ok(r.paused.paused && !r.paused.playing, 'pausa: el video se detiene');
  near(r.paused, 0.2, 'en pausa');
  assert.ok(Math.abs(r.pitched.rate - 1.08) < 0.01, `velocidad ${r.pitched.rate}`);
  // ventana de video
  assert.ok(r.hasWin, 'se abrió la ventana de video');
  assert.strictEqual(r.vwin.display, 'block', 'la ventana muestra el video local del deck A');
  assert.match(r.vwin.src, /localvideo/);
  assert.strictEqual(r.vwin.bDisplay, 'none', 'el deck B no tiene video');
  assert.ok(Math.abs(r.vwin.t - r.vwinPos) <= 0.8, `ventana ${r.vwin.t.toFixed(2)} vs deck ${r.vwinPos.toFixed(2)}`);
  assert.ok(!r.vwin.paused);
  assert.strictEqual(r.streamVisible, false, 'la vista del stream de A queda oculta');
  // REQ-4: pista sin video: portada y mosaico fuera
  assert.strictEqual(r.noVideo.hidden, true);
  assert.strictEqual(r.noVideo.src, null);
  assert.strictEqual(r.vwinNone, 'none');
  console.log('video-local e2e: OK', JSON.stringify({ drift: [r.mini, r.afterSeek, r.paused].map((x) => Math.round((x.t - x.pos) * 100) / 100), rate: r.pitched.rate }));
};

// Con YouTube Music de verdad (necesita internet): un video musical oficial y una pista de solo audio.
tests.live = async () => {
  const { spawnSync } = require('child_process');
  const out = tmp();
  spawnSync(require('electron'), ['.'], { cwd: path.join(__dirname, '..'), timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'video-live-selftest.js'), YTDJ_USERDATA: path.join(out, 'data'), YTDJ_SELFTEST_OUT: out } });
  const r = JSON.parse(fs.readFileSync(path.join(out, 'video-live.json'), 'utf8'));
  console.log(JSON.stringify({ atv: r.atv?.data, omv: r.omv?.data }));
  assert.strictEqual(r.omv?.data, 'MUSIC_VIDEO_TYPE_OMV', 'Never Gonna Give You Up es un video musical');
  assert.strictEqual(r.atv?.data, 'MUSIC_VIDEO_TYPE_ATV', 'la pista de búsqueda de canciones es audio con portada');
  console.log('video-local live: OK');
};

// Descarga real (internet + yt-dlp): un video de 17 s a 480p, sin audio, en .video/<id>.mp4.
tests.download = async () => {
  const Y = require('../main/ytdlp');
  const L = require('../main/library-save');
  const { spawnSync } = require('child_process');
  const tools = require('../main/tools');
  const found = await tools.findYtdlp([path.join(__dirname, '../bin')]);
  assert.ok(found, 'hace falta yt-dlp (npm run setup)');
  const dir = tmp();
  const file = await Y.downloadVideo({ bin: found.bin, videoId: 'TOueemiIVYU', dir, maxHeight: 480, onProgress() {} });
  assert.strictEqual(file, path.join(dir, '.video', 'TOueemiIVYU.mp4'));
  assert.ok(fs.statSync(file).size > 20000, 'archivo de video con contenido');
  const ff = (await tools.findFfmpeg('', [path.join(__dirname, '../bin')])).bin;
  const info = spawnSync(ff, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  assert.match(info, /Video: (h264|av1|vp9)/, 'es un video');
  assert.ok(!/Audio:/.test(info), 'sin audio (el audio ya está guardado aparte)');
  console.log(info.match(/Video: [^,]+/)[0]);
  console.log('video-local download: OK', fs.statSync(file).size, 'bytes');
};

if (!tests[mode]) (console.error('uso: test-video-local.js', Object.keys(tests).join('|')), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
