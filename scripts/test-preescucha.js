// Pruebas de la preescucha de la Librería.  Uso: node --experimental-default-type=module scripts/test-preescucha.js model|ui|docs
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const mode = process.argv[2] || 'model';
const tests = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeAudio() {
  const l = {};
  return { currentTime: 0, duration: 200, paused: true, volume: 1, src: '', addEventListener(t, f) { l[t] = f; }, removeAttribute() { this.src = ''; }, load() {}, async play() { this.paused = false; }, pause() { this.paused = true; }, fire(t) { l[t]?.(); } };
}

tests.model = async () => {
  const { startAt, preview } = await import('../renderer/preview.js');
  // REQ-2: punto de entrada si hay análisis (editado > mezcla > rejilla); si no, el 25 %
  assert.strictEqual(startAt({ mix: { mixIn: 12 }, duration: 200 }), 12);
  assert.strictEqual(startAt({ mixEdit: { in: 30 }, mix: { mixIn: 12 }, duration: 200 }), 30);
  assert.strictEqual(startAt({ offset: 0.4, duration: 200 }), 0.4);
  assert.strictEqual(startAt({ mix: { mixIn: 199 }, duration: 200 }), 50, 'una entrada fuera de la pista cae al 25 %');
  assert.strictEqual(startAt(null, 200), 50); assert.strictEqual(startAt(null, 0), 0);
  // REQ-1/3/5: una sola a la vez, alterna, y sin archivo no suena
  const local = (id) => ({ videoId: id, local: true, title: id, duration: 200 });
  const els = []; const mk = () => { const a = fakeAudio(); els.push(a); return a; };
  const ev = []; preview.on((e) => ev.push(e.type + ':' + e.id));
  preview.volume = 0;
  assert.strictEqual(await preview.toggle({ videoId: 'yt1', title: 'x' }, null, { mkAudio: mk }), false, 'solo streaming: no suena');
  assert.strictEqual(els.length, 0, 'ni se crea audio ni se descarga');
  assert.strictEqual(await preview.toggle(local('a'), { mix: { mixIn: 10 }, duration: 200 }, { mkAudio: mk }), true);
  assert.ok(els[0].src.includes('/localfile/a') && els[0].currentTime === 10 && !els[0].paused, 'empieza en su entrada');
  assert.strictEqual(await preview.toggle(local('b'), null, { mkAudio: mk }), true);
  assert.ok(els[0].paused && !els[1].paused && preview.state.id === 'b', 'la anterior se para');
  assert.strictEqual(els[1].currentTime, 50, 'sin análisis, al 25 %');
  // REQ-4: saltar
  preview.seek(0.5); assert.strictEqual(els[1].currentTime, 100);
  // REQ-3: al terminar se para
  els[1].fire('ended'); assert.strictEqual(preview.state, null); assert.ok(ev.includes('end:b'));
  // alternar en la misma pista la para
  await preview.toggle(local('c'), null, { mkAudio: mk }); assert.strictEqual(await preview.toggle(local('c'), null, { mkAudio: mk }), false); assert.strictEqual(preview.state, null);
  // REQ-6: sin auriculares, si suena un deck se para; con auriculares sigue
  let busy = false;
  await preview.toggle(local('d'), null, { mkAudio: mk, busy: () => busy });
  busy = true; await sleep(600);
  assert.strictEqual(preview.state, null, 'sin auriculares y con un deck sonando, se para'); assert.ok(ev.includes('blocked:d'));
  globalThis.YTDJChain = { findSinkId: async () => 'sink-1' };
  const withSink = fakeAudio(); let sink = null; withSink.setSinkId = async (x) => { sink = x; };
  await preview.toggle(local('e'), null, { mkAudio: () => withSink, cueLabel: 'Auriculares', busy: () => true }); await sleep(600);
  assert.strictEqual(sink, 'sink-1', 'sale por la salida de auriculares'); assert.strictEqual(preview.state?.id, 'e', 'con auriculares sigue sonando');
  preview.stop();
  console.log('preescucha model: OK');
};

async function run() {
  const { spawnSync } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const demo = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(demo, 'Neon Drive.mp3'))) spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), demo], { stdio: 'ignore' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-preescucha-')); const data = path.join(tmp, 'data'); fs.mkdirSync(data, { recursive: true });
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', 'preescucha-selftest.js'), YTDJ_USERDATA: data, YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: demo }, stdio: 'ignore' });
  const f = path.join(tmp, 'preescucha.json'); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err));
  return r;
}
tests.ui = async () => {
  const lib = read('renderer/library.js'); const css = read('renderer/styles.css');
  assert.ok(/data-act="prev"/.test(lib) && /pv-bar/.test(lib) && /\.pv-bar/.test(css) && /button\.pv/.test(css), 'botón y barra');
  const r = await run();
  // REQ-5: el de streaming está deshabilitado con ayuda; el local, no
  assert.ok(r.start.stream.disabled && /streaming/.test(r.start.stream.title), 'streaming deshabilitado con ayuda'); assert.ok(!r.start.local.disabled, 'local habilitado');
  // REQ-1/4: suena, no carga ningún deck, la fila lo marca y la barra avanza; el clic en la barra salta
  assert.ok(r.playing.on && r.playing.text === '■' && r.playing.bar && r.playing.state?.id, 'suena y la fila lo marca');
  assert.ok(!r.playing.decksLoaded, 'no carga ningún deck');
  assert.ok(r.playing.t > 0, 'avanza'); assert.ok(r.sought.t > r.playing.t + 5 || r.sought.t < r.playing.t - 5, `salta (${r.playing.t} → ${r.sought.t})`);
  // REQ-3: el segundo ▶ sobre la misma pista la para
  assert.ok(!r.stopped.on && r.stopped.text === '▶' && !r.stopped.bar && r.stopped.state === null, 'parar');
  console.log('preescucha ui: OK');
};
tests.docs = () => {
  const doc = read('docs/03-libreria-y-playlists.md') + read('README.md');
  assert.ok(/preescucha/i.test(doc) && /auriculares/i.test(read('docs/03-libreria-y-playlists.md')) && /25 %/.test(read('docs/03-libreria-y-playlists.md')), 'docs de la preescucha');
  console.log('preescucha docs: OK');
};
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
