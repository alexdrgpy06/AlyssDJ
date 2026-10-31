#!/usr/bin/env node
// Pruebas de "guardar en la librería local".  Uso: node scripts/test-save-library.js settings|download|register|e2e
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('../main/library-save');

const mode = process.argv[2];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-save-'));
const tests = {};

tests.settings = async () => {
  assert.strictEqual(L.defaultLibraryDir('/home/u/Música'), path.join('/home/u/Música', 'AlyssDJ', 'YouTube'));
  assert.deepStrictEqual(L.withLibraryDir(['/a'], '/lib'), ['/a', '/lib']);
  assert.deepStrictEqual(L.withLibraryDir(['/a', '/lib'], '/lib'), ['/a', '/lib'], 'no se duplica');
  assert.deepStrictEqual(L.withLibraryDir(undefined, '/lib'), ['/lib']);
  // REQ-5: con ambos interruptores apagados y sin pedirlo, no se guarda nada
  assert.strictEqual(L.wantsSave({ saveOnAnalyze: false }, {}), false);
  assert.strictEqual(L.wantsSave({ saveOnAnalyze: true }, {}), true);
  assert.strictEqual(L.wantsSave({ saveOnAnalyze: false }, { save: true }), true, 'la reproducción puede pedirlo expresamente');
  assert.strictEqual(L.wantsSave({ saveOnAnalyze: true }, { file: '/x.mp3' }), false, 'archivos locales no se descargan');
  // los ajustes por defecto existen en settings.js
  const src = fs.readFileSync(path.join(__dirname, '../main/settings.js'), 'utf8');
  for (const k of ['saveOnAnalyze: true', 'saveOnPlay: true', "libraryDir: ''"]) assert.ok(src.includes(k), `settings.js define ${k}`);
};

tests.download = async () => {
  const dir = tmp();
  const args = L.saveArgs(dir);
  assert.ok(args.includes('bestaudio/best') && args.includes('abr,asr'), 'mejor calidad');
  assert.ok(!args.includes('-x') && !args.includes('--audio-format'), 'sin conversión');
  assert.ok(args.includes('--embed-metadata'));
  assert.ok(args.some((a) => a.includes('[%(id)s]')), 'el id va en el nombre');
  assert.throws(() => L.safeId('a/b; rm'), /no válido/);
  assert.throws(() => L.findSaved(dir, '../x'), /no válido/);
  // findSaved ignora parciales y otros ids
  const id = 'TOueemiIVYU';
  fs.writeFileSync(path.join(dir, `X - Y [${id}].webm.part`), 'x');
  assert.strictEqual(L.findSaved(dir, id), null);
  fs.writeFileSync(path.join(dir, `X - Y [${id}].webm`), 'x');
  assert.strictEqual(L.findSaved(dir, id), path.join(dir, `X - Y [${id}].webm`));
  assert.strictEqual(L.findSaved(dir, 'otroIdXXXXX'), null);
  // REQ-6: limpieza de parciales tras un fallo, sin tocar lo ya guardado de otros ids
  fs.writeFileSync(path.join(dir, `A - B [zzzzzzzzzzz].m4a`), 'ok');
  fs.writeFileSync(path.join(dir, `A - B [zzzzzzzzzzz].f251.webm.part`), 'x');
  fs.writeFileSync(path.join(dir, `A - B [zzzzzzzzzzz].m4a.ytdl`), 'x');
  fs.mkdirSync(path.join(dir, '.thumbs'));
  fs.writeFileSync(path.join(dir, '.thumbs', 'zzzzzzzzzzz.jpg'), 'x');
  L.cleanPartials(dir, 'zzzzzzzzzzz');
  assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => n.includes('zzzzzzzzzzz')), ['A - B [zzzzzzzzzzz].m4a'], 'el audio completo se conserva, los parciales no');
  assert.ok(!fs.existsSync(path.join(dir, '.thumbs', 'zzzzzzzzzzz.jpg')));
  // Una carpeta imposible (como /proc) debe fallar al instante y sin colgar el proceso (antes entraba en bucle)
  for (const bad of ['/proc/alyss-sin-permiso/.thumbs', '/sys/alyss/x', '/proc']) {
    const t0 = Date.now();
    assert.throws(() => L.ensureWritableDir(bad), /escribir/);
    assert.ok(Date.now() - t0 < 500, `falla rápido: ${bad}`);
  }
  const okDir = path.join(dir, 'nueva', 'a', 'b');
  assert.strictEqual(L.ensureWritableDir(okDir), okDir);
  assert.ok(fs.existsSync(okDir));
  assert.match(L.friendlyError('OSError: [Errno 28] No space left on device'), /espacio en disco/);
  assert.match(L.friendlyError('PermissionError: [Errno 13] Permission denied'), /escribir/);
  assert.strictEqual(L.friendlyError('otro error'), null);
};

tests.register = async () => {
  const { execFileSync } = require('child_process');
  const { LocalLibrary } = require('../main/local-library');
  const { Analyzer } = require('../main/analyzer');
  const dir = tmp();
  const lib = path.join(dir, 'lib');
  fs.mkdirSync(path.join(lib, '.thumbs'), { recursive: true });
  const id = 'TOueemiIVYU';
  const mp3 = path.join(lib, `Artista Demo - Pista de prueba [${id}].mp3`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-metadata', 'title=Pista de prueba', '-metadata', 'artist=Artista Demo', mp3]);
  const thumb = path.join(lib, '.thumbs', `${id}.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', thumb]);

  const ll = new LocalLibrary({ file: path.join(dir, 'index.json'), ffmpeg: () => 'ffmpeg', emit() {}, coversDir: path.join(dir, 'covers') });
  const an = new Analyzer({ cacheDir: path.join(dir, 'cache'), settings: { get: () => ({}) }, session: null, emit() {}, ffmpeg: () => 'ffmpeg', localLib: ll, libraryDir: () => lib });
  const record = { id, bpm: 124, camelot: '8A', key: 'Am', duration: 2, offset: 0.3, waveform: { binsPerSec: 100, low: '', mid: '', high: '' }, title: 'Pista de prueba', artist: 'Artista Demo', thumb: 'https://i.ytimg.com/x.jpg', analyzedAt: 'hoy' };

  const row = await an.registerSaved({ id, file: mp3, thumb, record });
  // REQ-3: etiquetas, carátula y análisis ya calculado
  assert.strictEqual(row.title, 'Pista de prueba');
  assert.strictEqual(row.artist, 'Artista Demo');
  assert.ok(row.thumb.startsWith('/cover/'), 'tiene carátula');
  assert.ok(fs.existsSync(path.join(dir, 'covers', `${row.videoId}.jpg`)), 'la carátula está en la caché');
  assert.ok(!fs.existsSync(thumb), 'la miniatura suelta se retira');
  const localAnalysis = JSON.parse(fs.readFileSync(path.join(dir, 'cache', `${row.videoId}.json`), 'utf8'));
  assert.strictEqual(localAnalysis.bpm, 124);
  assert.strictEqual(localAnalysis.local, true);
  assert.strictEqual(localAnalysis.ytId, id);
  // sin duplicados: registrar otra vez el mismo archivo no crea otra entrada
  await an.registerSaved({ id, file: mp3, thumb: null, record });
  assert.strictEqual(ll.list().length, 1, 'una sola entrada');
  // el escaneo de la carpeta tampoco la duplica (y ignora .thumbs)
  ll.scan([lib]);
  await new Promise((r) => setTimeout(r, 1500));
  assert.strictEqual(ll.list([lib]).length, 1, 'el escaneo no duplica');
  // REQ-4: el JSON de la pista de YouTube recuerda dónde está guardada, y si se borra el archivo deja de contar
  fs.writeFileSync(an.jsonPath(id), JSON.stringify({ ...record, saved: { path: mp3, localId: row.videoId } }));
  assert.strictEqual(an.get(id).saved.localId, row.videoId);
  fs.rmSync(mp3);
  assert.strictEqual(an.get(id).saved, undefined, 'sin archivo ya no está guardada');
};

tests.e2e = async () => {
  const { spawnSync } = require('child_process');
  const root = path.join(__dirname, '..');
  const dir = tmp();
  const lib = path.join(dir, 'lib');
  const r = spawnSync(path.join(root, 'node_modules/.bin/electron'), ['.'], {
    cwd: root, timeout: 420000, encoding: 'utf8',
    env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'save-library-selftest.js'), YTDJ_USERDATA: path.join(dir, 'data'), YTDJ_SELFTEST_OUT: dir, YTDJ_SAVE_LIB: lib, YTDJ_SAVE_SHOTS: process.env.YTDJ_SAVE_SHOTS || '' },
  });
  const file = path.join(dir, 'save-library.json');
  assert.ok(fs.existsSync(file), `la app no produjo resultado\n${(r.stderr || '').slice(-500)}`);
  const res = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(!res.error, res.error);
  const ZOO = 'jNQXAC9IVRw';
  assert.ok(res.musicDirs.includes(lib), 'la carpeta de la librería entra en las carpetas de música');
  // REQ-1
  assert.strictEqual(res.analyze.stage, 'done', `Analizar debe terminar: ${JSON.stringify(res.analyze)}`);
  const saved = res.files.filter((n) => n.includes(`[${ZOO}]`) && !n.startsWith('.'));
  assert.strictEqual(saved.length, 1, `un archivo guardado: ${JSON.stringify(res.files)}`);
  assert.ok(['.webm', '.m4a', '.opus'].includes(path.extname(saved[0])), 'audio original sin convertir');
  assert.ok(fs.statSync(path.join(lib, saved[0])).size > 20000, 'archivo con contenido');
  assert.ok(res.analyze.saved && res.analyze.saved.localId, 'el análisis recuerda dónde está guardada');
  assert.ok(res.analyze.bpm > 0, 'se analizó');
  assert.deepStrictEqual(res.thumbsLeft, [], 'no queda la miniatura suelta');
  // REQ-3
  const row = res.localRows.find((x) => /zoo/i.test(x.title));
  assert.ok(row, `aparece en la pestaña Local: ${JSON.stringify(res.localRows)}`);
  assert.strictEqual(res.localRows.filter((x) => /zoo/i.test(x.title)).length, 1, 'sin duplicados');
  assert.ok(row.thumb.startsWith('/cover/'), 'con carátula');
  assert.ok(res.localAnalysis && res.localAnalysis.bpm > 0 && res.localAnalysis.local, 'con el análisis ya calculado');
  // REQ-4
  assert.strictEqual(res.deckSaved.source, 'local', 'la pista guardada se reproduce desde el archivo');
  assert.ok(res.deckSaved.playing && res.deckSaved.dur > 10, `sonando: ${JSON.stringify(res.deckSaved)}`);
  assert.match(res.deckSaved.state, /GUARDADA/);
  assert.ok(res.deckSaved.localBtnEnabled);
  // REQ-2
  assert.deepStrictEqual([res.play.requestedBefore30s, res.play.requestedAfter30s], [false, true], 'se pide al pasar de 30 s, no antes');
  assert.strictEqual(res.playDone.stage, 'done', JSON.stringify(res.playDone));
  assert.ok(res.playDone.saved);
  assert.ok(res.files2.some((n) => n.includes('[TOueemiIVYU]')), 'segunda pista guardada');
  // REQ-5
  assert.strictEqual(res.playOff.requested, false, 'con el interruptor apagado no se pide nada');
  // REQ-6
  assert.strictEqual(res.badDir.stage, 'error');
  assert.match(res.badDir.error, /escribir|carpeta/i, `error comprensible: ${res.badDir.error}`);
  assert.strictEqual(res.afterError.stage, 'done', 'la cola sigue funcionando tras el error');
  assert.deepStrictEqual(res.partials, [], 'sin archivos parciales');
};

(async () => {
  if (!tests[mode]) {
    console.error(`modo desconocido: ${mode}. Disponibles: ${Object.keys(tests).join(', ')}`);
    process.exit(2);
  }
  await tests[mode]();
  console.log(`save-library ${mode}: OK`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
