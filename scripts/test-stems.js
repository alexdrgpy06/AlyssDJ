// Pruebas de los stems manuales.  Uso: node --experimental-default-type=module scripts/test-stems.js model|store|ipc|engine|ui|docs|real
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const mode = process.argv[2] || 'model';
const tests = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// señal de prueba: dos tonos y ruido determinista, estéreo
function signal(n) {
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / 44100) + 0.2 * Math.sin((2 * Math.PI * 3300 * i) / 44100) + 0.05 * rnd();
    R[i] = 0.3 * Math.sin((2 * Math.PI * 330 * i) / 44100) + 0.1 * Math.sin((2 * Math.PI * 5000 * i) / 44100) + 0.05 * rnd();
  }
  return [L, R];
}
const snr = (a, b) => {
  let e = 0, p = 0;
  for (let i = 0; i < a.length; i++) { e += (a[i] - b[i]) ** 2; p += a[i] ** 2; }
  return 10 * Math.log10(p / (e || 1e-30));
};
// reúne los trozos y los reparte por stem y canal
async function runSeparate(D, mix, infer, extra = {}) {
  const chunks = [];
  const r = await D.separate(mix, { infer, onChunk: (c) => chunks.push(c), ...extra });
  const n = chunks.reduce((a, c) => a + c.length / 8, 0);
  const out = Array.from({ length: 8 }, () => new Float32Array(n));
  let o = 0;
  for (const c of chunks) { for (let i = 0; i < c.length / 8; i++) for (let k = 0; k < 8; k++) out[k][o + i] = c[i * 8 + k]; o += c.length / 8; }
  return { ok: r, out, n, chunks: chunks.length };
}

tests.model = async () => {
  const D = require('../shared/stems-dsp.js');
  const len = 600000; // tres ventanas con solape, la última desplazada
  assert.strictEqual(D.windowsFor(len), 3); assert.strictEqual(D.windowsFor(400000), 2); assert.strictEqual(D.windowsFor(1000), 1); assert.strictEqual(D.windowsFor(D.W), 1);
  const mix = signal(len);
  // STFT → iSTFT en la rama de frecuencia reconstruye la ventana (el modelo hace lo mismo con cada fuente)
  const idFreq = async ({ x }) => {
    const freq = new Float32Array(4 * 4 * D.FQ * D.T); freq.set(x, 0); // la batería recibe todo el espectro
    return { time: new Float32Array(4 * 2 * D.W), freq };
  };
  const a = await runSeparate(D, mix, idFreq);
  assert.ok(a.ok && a.n === len, `muestras ${a.n}`);
  // (en los ~2000 primeros y últimos muestras la STFT con reflejo no reconstruye exacto, igual que en Demucs)
  const inner = (v) => v.subarray(2048, len - 2048);
  assert.ok(snr(inner(mix[0]), inner(a.out[0])) > 45 && snr(inner(mix[1]), inner(a.out[1])) > 45, `STFT/iSTFT reconstruye (${snr(inner(mix[0]), inner(a.out[0])).toFixed(1)} dB)`);
  assert.ok(snr(mix[0], a.out[0]) > 25, 'y en conjunto con los bordes');
  assert.ok(a.out[2].every((v) => Math.abs(v) < 1e-6) && a.out[6].every((v) => Math.abs(v) < 1e-6), 'los demás stems quedan en silencio');
  assert.ok(a.chunks >= 3, `sale por trozos (${a.chunks})`);
  // rama temporal: cuatro stems de un cuarto suman la mezcla, y el orden de canales es batería, bajo, resto, voz
  const quarter = async ({ input }) => {
    const time = new Float32Array(4 * 2 * D.W);
    for (let s = 0; s < 4; s++) for (let c = 0; c < 2; c++) for (let i = 0; i < D.W; i++) time[(s * 2 + c) * D.W + i] = input[c * D.W + i] * (s === 3 ? 0.4 : 0.2);
    return { time, freq: new Float32Array(4 * 4 * D.FQ * D.T) };
  };
  const b = await runSeparate(D, mix, quarter);
  const sumL = new Float32Array(len); for (let s = 0; s < 4; s++) for (let i = 0; i < len; i++) sumL[i] += b.out[s * 2][i];
  assert.ok(snr(mix[0], sumL) > 60, `la suma de stems da la mezcla (${snr(mix[0], sumL).toFixed(1)} dB)`);
  assert.ok(Math.abs(b.out[6][1000] / mix[0][1000] - 0.4) < 1e-3, 'el cuarto stem es la voz (canales 6 y 7)');
  // pistas más cortas que una ventana y progreso/cancelación
  const short = await runSeparate(D, signal(5000), quarter); assert.strictEqual(short.n, 5000);
  const prog = []; await runSeparate(D, mix, quarter, { onProgress: (p) => prog.push(p.progress) });
  assert.ok(prog.length === 3 && prog.every((v, i) => i === 0 || v > prog[i - 1]) && prog[2] === 1, JSON.stringify(prog));
  let calls = 0; const stopped = await runSeparate(D, mix, quarter, { shouldStop: () => ++calls > 1 });
  assert.strictEqual(stopped.ok, false, 'cancelar entre ventanas');
  console.log('stems model: OK');
};

// ---------- almacén y proceso hijo (sin el modelo: reparto en cuatro partes iguales) ----------
function demoTrack() {
  const demo = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(demo, 'Neon Drive.mp3'))) require('node:child_process').spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), demo], { stdio: 'ignore' });
  return path.join(demo, 'Neon Drive.mp3');
}
const FF = (() => { const b = path.join(root, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'); return fs.existsSync(b) ? b : 'ffmpeg'; })();
// Duración, canales y códec con ffmpeg (en CI solo está el que baja la app, sin ffprobe).
const probe = (f) => {
  const t = require('node:child_process').spawnSync(FF, ['-hide_banner', '-i', f]).stderr.toString();
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(t); const a = /Audio: (\w+)[^,]*, (\d+) Hz, ([^,]+)/.exec(t);
  const lay = { mono: 1, stereo: 2, '5.1': 6, '7.1': 8 }; const m = /^(\d+) channels/.exec(a[3]);
  return { streams: [{ codec_name: a[1], sample_rate: a[2], channels: m ? +m[1] : lay[a[3].trim().split('(')[0]] || a[3] }], format: { duration: String(+d[1] * 3600 + +d[2] * 60 + +d[3]) } };
};
function makeStore(extra = {}) {
  const { StemStore } = require('../main/stems.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-stems-'));
  const events = [];
  const store = new StemStore({ dir, ffmpeg: () => FF, modelPath: () => path.join(dir, 'nope.ort'), onEvent: (e) => events.push(e), workerEnv: { YTDJ_STEMS_FAKE: '1' }, ...extra });
  const until = async (fn, ms = 60000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('tiempo agotado: ' + JSON.stringify(events.slice(-4))); await sleep(50); } };
  return { store, events, dir, until };
}
tests.store = async () => {
  const track = demoTrack();
  {
    // REQ-1/3: separa en segundo plano, guarda un FLAC de 8 canales de la misma duración y de a una
    const { store, events, dir, until } = makeStore();
    assert.ok(store.request('A1', track)); assert.ok(store.request('B2', track));
    assert.strictEqual(store.request('A1', track), false, 'ya en la cola');
    assert.deepStrictEqual(events.filter((e) => e.stage === 'queued').map((e) => e.id), ['A1', 'B2']);
    await until(() => store.has('A1'));
    assert.ok(!store.has('B2') || events.findIndex((e) => e.id === 'B2' && e.stage === 'progress') > events.findIndex((e) => e.id === 'A1' && e.stage === 'done'), 'una pista a la vez');
    await until(() => store.has('B2'));
    const pr = probe(store.fileOf('A1')); const src = probe(track);
    assert.strictEqual(pr.streams[0].channels, 8); assert.strictEqual(pr.streams[0].codec_name, 'flac'); assert.strictEqual(pr.streams[0].sample_rate, '44100');
    assert.ok(Math.abs(+pr.format.duration - +src.format.duration) < 0.15, `misma duración (${pr.format.duration} vs ${src.format.duration})`);
    const prog = events.filter((e) => e.id === 'A1' && e.stage === 'progress'); assert.ok(prog.length >= 3 && prog.at(-1).progress === 1 && prog.every((e) => e.etaS != null), 'progreso con tiempo restante');
    assert.ok(store.usage() > 100000 && store.list().A1.bytes === fs.statSync(store.fileOf('A1')).size, 'tamaño');
    // persiste: otro almacén sobre la misma carpeta los ve
    const { StemStore } = require('../main/stems.js'); assert.ok(new StemStore({ dir, ffmpeg: () => FF, modelPath: () => '' }).has('A1'));
    // REQ-7: borrar libera
    assert.ok(store.remove('A1') && !store.has('A1') && !fs.existsSync(store.fileOf('A1'))); store.removeAll(); assert.strictEqual(store.usage(), 0);
  }
  {
    // REQ-2: cancelar detiene el trabajo y borra lo parcial; la siguiente de la cola sigue
    const { store, events, dir, until } = makeStore();
    store.request('C1', track); store.request('D1', track);
    await until(() => events.some((e) => e.id === 'C1' && e.stage === 'progress'));
    assert.ok(store.cancel('C1'));
    await until(() => events.some((e) => e.id === 'C1' && e.stage === 'cancelled'));
    assert.ok(!store.has('C1') && !fs.readdirSync(dir).some((f) => f.includes('C1')), 'sin restos: ' + fs.readdirSync(dir));
    await until(() => store.has('D1')); assert.ok(store.cancel('nada') === false);
    // cancelar una que aún espera en la cola
    store.request('E1', track); store.request('F1', track); assert.ok(store.cancel('F1')); await until(() => store.has('E1'));
    assert.ok(!store.has('F1') && events.some((e) => e.id === 'F1' && e.stage === 'cancelled'));
  }
  {
    // REQ-8: errores con causa y código; la app sigue (no hay excepción) y no quedan restos
    const a = makeStore(); a.store.request('X1', path.join(a.dir, 'no-existe.mp3'));
    await a.until(() => a.events.some((e) => e.stage === 'error'));
    const e1 = a.events.find((e) => e.stage === 'error'); assert.strictEqual(e1.code, 'archivo'); assert.match(e1.error, /archivo/i);
    const b = makeStore({ maxSeconds: 5 }); b.store.request('Y1', track);
    await b.until(() => b.events.some((e) => e.stage === 'error')); assert.strictEqual(b.events.find((e) => e.stage === 'error').code, 'larga');
    const c = makeStore({ maxRssMB: 1 }); c.store.request('Z1', track);
    await c.until(() => c.events.some((e) => e.stage === 'error')); assert.strictEqual(c.events.find((e) => e.stage === 'error').code, 'memoria');
    assert.ok(!fs.readdirSync(c.dir).some((f) => f.endsWith('.part')) && !c.store.has('Z1'));
    // sin modelo y sin modo de prueba: error claro de modelo
    const d = makeStore({ workerEnv: {} }); d.store.request('M1', track);
    await d.until(() => d.events.some((e) => e.stage === 'error')); assert.strictEqual(d.events.find((e) => e.stage === 'error').code, 'modelo');
  }
  console.log('stems store: OK');
};

// ---------- modelo bajo demanda, disponibilidad, IPC y empaquetado ----------
tests.ipc = async () => {
  const http = require('node:http'); const crypto = require('node:crypto');
  const { ModelManager, available, StemStore, MODEL } = require('../main/stems.js');
  const body = crypto.randomBytes(3 * 1024 * 1024 + 123);
  const good = { name: 'Prueba', url: '', bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex'), license: 'MIT' };
  let hits = 0;
  const srv = http.createServer((q, r) => {
    hits++;
    if (q.url === '/redir') { r.writeHead(302, { location: '/m.ort' }); return r.end(); }
    if (q.url === '/404') { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-length': body.length }); r.end(q.url === '/bad' ? Buffer.concat([body.subarray(0, body.length - 1), Buffer.from([body.at(-1) ^ 1])]) : body);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  const mk = (path_, confirm, ev = []) => ({ mm: new ModelManager({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-model-')), confirm, onEvent: (e) => ev.push(e), spec: { ...good, url: base + path_ } }), ev });
  const asked = [];
  // REQ-4: sin permiso no se descarga nada
  { const { mm } = mk('/m.ort', async (i) => (asked.push(i), false)); hits = 0;
    await assert.rejects(mm.ensure(), (e) => e.code === 'modelo' && /no autorizada/.test(e.message)); assert.strictEqual(hits, 0, 'ni una petición sin permiso');
    assert.ok(asked[0].url && asked[0].bytes === good.bytes && asked[0].name && asked[0].license, 'el permiso muestra origen, tamaño y licencia'); assert.ok(!mm.present()); }
  // con permiso: sigue redirecciones, informa progreso, verifica y renombra; una sola descarga aunque se pida dos veces
  { let n = 0; const { mm, ev } = mk('/redir', async () => (n++, true)); hits = 0;
    const [a, b] = await Promise.all([mm.ensure(), mm.ensure()]); assert.strictEqual(a, b); assert.strictEqual(n, 1, 'un solo permiso'); assert.strictEqual(hits, 2, 'redirección + descarga');
    assert.ok(mm.present() && !fs.existsSync(`${a}.part`) && fs.statSync(a).size === good.bytes);
    const pr = ev.filter((e) => e.stage === 'model').map((e) => e.progress); assert.ok(pr[0] === 0 && pr.at(-1) === 1 && pr.length >= 3 && pr.every((v, i) => !i || v >= pr[i - 1]), `progreso ${pr}`);
    n = 0; await mm.ensure(); assert.strictEqual(n, 0, 'ya presente: no vuelve a preguntar'); assert.deepStrictEqual(mm.status(), { present: true, bytes: good.bytes }); }
  // modelo corrupto o error HTTP: se descarta, sin restos, con código 'modelo'
  { const { mm } = mk('/bad', async () => true); await assert.rejects(mm.ensure(), (e) => e.code === 'modelo' && /SHA-256/.test(e.message));
    assert.ok(!mm.present() && !fs.readdirSync(path.dirname(mm.path())).length, 'sin restos'); }
  { const { mm } = mk('/404', async () => true); await assert.rejects(mm.ensure(), (e) => e.code === 'modelo' && /404/.test(e.message)); }
  { const { mm } = mk('/m.ort', async () => true); mm.o.fetch = async () => { throw new Error('sin red'); }; await assert.rejects(mm.ensure(), (e) => e.code === 'modelo' && /sin red/.test(e.message)); }
  srv.close();
  // el almacén convierte un modelo no autorizado en un error claro y sigue vivo
  { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-stems-')); const events = []; const mm = new ModelManager({ dir: path.join(dir, 'm'), confirm: async () => false, spec: good });
    const st = new StemStore({ dir, ffmpeg: () => FF, modelPath: () => mm.path(), ensureModel: () => mm.ensure(), onEvent: (e) => events.push(e) }); st.request('Q1', demoTrack());
    const t = Date.now(); while (!events.some((e) => e.stage === 'error') && Date.now() - t < 20000) await sleep(50);
    const er = events.find((e) => e.stage === 'error'); assert.ok(er && er.code === 'modelo' && /no autorizada/.test(er.error), JSON.stringify(events)); assert.ok(!st.has('Q1')); }
  // el modelo real declarado
  assert.ok(/^https:\/\/huggingface\.co\/gridshiftstudio\/htdemucs-ort\//.test(MODEL.url) && MODEL.bytes === 209884896 && /^[0-9a-f]{64}$/.test(MODEL.sha256) && MODEL.license === 'Apache-2.0');
  // REQ-8: disponibilidad por plataforma
  const fake = (bins) => { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-ort-')); fs.mkdirSync(path.join(r, 'node_modules/onnxruntime-node'), { recursive: true }); fs.writeFileSync(path.join(r, 'node_modules/onnxruntime-node/package.json'), '{}'); for (const b of bins) fs.mkdirSync(path.join(r, 'node_modules/onnxruntime-node/bin/napi-v6', b), { recursive: true }); return r; };
  assert.deepStrictEqual(available(fake(['linux/x64']), 'linux', 'x64'), { available: true });
  const intel = available(fake(['darwin/arm64', 'linux/x64']), 'darwin', 'x64'); assert.ok(!intel.available && /no está disponible en este equipo/.test(intel.why), intel.why);
  assert.ok(!available(fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-ort-')), 'linux', 'x64').available);
  assert.strictEqual(available().available, true, 'esta instalación trae onnxruntime-node');
  // IPC, preload y empaquetado
  const main = fs.readFileSync(path.join(root, 'main/main.js'), 'utf8'); const pre = fs.readFileSync(path.join(root, 'preload/app.js'), 'utf8'); const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const c of ['status', 'list', 'request', 'cancel', 'remove', 'remove-all']) { assert.ok(main.includes(`'stems:${c}'`) && pre.includes(`'stems:${c}'`), `canal stems:${c}`); }
  assert.ok(pre.includes("on('stems:event')") && /stemfile\//.test(main) && /showMessageBox/.test(main), 'evento, ruta del archivo y diálogo de permiso');
  assert.ok(pkg.dependencies['onnxruntime-node'], 'onnxruntime-node en dependencies');
  const filt = (k) => (pkg.build[k].files || []).join(' ');
  assert.ok(/linux/.test(filt('win')) && /darwin/.test(filt('win')) && !/win32/.test(filt('win')), 'win conserva solo win32');
  assert.ok(/linux/.test(filt('mac')) && /win32/.test(filt('mac')) && !/darwin/.test(filt('mac')), 'mac conserva solo darwin');
  assert.ok(/darwin/.test(filt('linux')) && /win32/.test(filt('linux')) && !/linux/.test(filt('linux')), 'linux conserva solo linux');
  assert.strictEqual(pkg.build.asar, false);
  console.log('stems ipc: OK');
};

// ---------- motor del deck (app real, sin sonido) ----------
const tones = [{ f: 220, a: 0.05 }, { f: 330, a: 0.1 }, { f: 440, a: 0.2 }, { f: 660, a: 0.4 }]; // batería, bajo, resto, voz
let lastData = '';
async function runApp(selftest, outFile, setup, extraEnv = {}) {
  const { spawnSync } = require('node:child_process'); const music = path.join(root, 'docs/demo-audio'); demoTrack();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-stems-app-')); const data = path.join(tmp, 'data'); fs.mkdirSync(path.join(data, 'stems'), { recursive: true });
  setup?.(data, path.join(music, 'Neon Drive.mp3'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', selftest), YTDJ_USERDATA: data, YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music, ...extraEnv }, stdio: 'ignore' });
  const f = path.join(tmp, outFile); lastData = data; assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err)); return r;
}
// FLAC de 8 canales con un tono distinto (y amplitud distinta) por stem, para reconocer la matriz por el nivel.
function toneStems(data, track) {
  const id = 'L' + require('node:crypto').createHash('sha1').update(track).digest('hex').slice(0, 15);
  const dur = +probe(track).format.duration; const file = path.join(data, 'stems', `${id}.flac`);
  const ins = tones.flatMap((t) => [0, 1].map(() => ['-f', 'lavfi', '-t', String(dur), '-i', `sine=f=${t.f}:sample_rate=44100,volume=${t.a}`])).flat();
  const r = require('node:child_process').spawnSync(FF, ['-y', '-loglevel', 'error', ...ins, '-filter_complex', '[0][1][2][3][4][5][6][7]amerge=inputs=8', '-c:a', 'flac', '-sample_fmt', 's16', file]);
  assert.strictEqual(r.status, 0, String(r.stderr)); fs.writeFileSync(path.join(data, 'stems', 'index.json'), JSON.stringify({ [id]: { bytes: fs.statSync(file).size, at: Date.now() } }));
}
tests.engine = async () => {
  const r = await runApp('stems-selftest.js', 'stems.json', toneStems);
  assert.ok(r.list[r.id]?.bytes > 1000, `el almacén de la app ve los stems (${JSON.stringify(r.list)} ${r.id})`); assert.strictEqual(r.status.available, true);
  assert.ok(r.full.stems.on === false && !r.full.paused && r.fullLevel > 0.1, 'suena la pista completa antes');
  // REQ-5: la pista pasa a los stems sin cortar: mismo punto, sigue sonando, el archivo es el FLAC
  assert.strictEqual(r.on, true); assert.ok(/stemfile/.test(r.onSnap.src) && r.onSnap.stems.on && !r.onSnap.paused, `activa (${JSON.stringify(r.onSnap)})`);
  assert.ok(r.onSnap.pos > r.full.pos && r.onSnap.pos - r.full.pos < 3, `continuidad ${r.full.pos.toFixed(2)} → ${r.onSnap.pos.toFixed(2)}`);
  // los cuatro tonos suman ≈ 0,75; cada solo deja solo su amplitud (0,05 / 0,1 / 0,2 / 0,4) → cada stem va a su propia ganancia
  const near = (v, want, tol = 0.35) => Math.abs(v - want) <= want * tol + 0.01;
  const k = r.allLevel / 0.75; assert.ok(r.allLevel > 0.02, `todos suman ${r.allLevel.toFixed(3)}`); // el medidor va después del fader: se compara en proporción
  for (const key of ['solo23', 'muteVoice', 'muteAll', 'unmuted', 'half']) r[key] /= k; r.solo = r.solo.map((v) => v / k);
  r.solo.forEach((v, i) => assert.ok(near(v, tones[i].a), `solo ${i}: ${v.toFixed(3)} ≠ ${tones[i].a}`));
  assert.ok(near(r.solo23, 0.6, 0.2), `varios solos se suman (${r.solo23.toFixed(3)})`);
  assert.ok(near(r.muteVoice, 0.35, 0.25), `mute de la voz (${r.muteVoice.toFixed(3)})`); assert.ok(r.muteAll < 0.03, `todos en mute: silencio (${r.muteAll})`);
  assert.ok(r.muteState.stems.mute.every(Boolean), 'el estado refleja los mute'); assert.ok(near(r.unmuted, 0.75, 0.2), `sin mute vuelve (${r.unmuted.toFixed(3)})`);
  assert.ok(near(r.half, 0.2), `volumen del stem a 0,5 (${r.half.toFixed(3)})`);
  // el elemento hereda velocidad (con keylock), búsqueda y pausa
  assert.ok(Math.abs(r.rate.rate - 1.05) < 0.01 && r.rate.keylock === true, 'velocidad y keylock'); assert.ok(Math.abs(r.seek.pos - 3.3) < 1, `seek (${r.seek.pos})`);
  assert.ok(r.paused.st.paused && Math.abs(r.paused.b - r.paused.a) < 0.05, 'pausa'); assert.ok(!r.resumed.paused && r.resumed.pos > r.paused.b, 'reanuda');
  // el plato usa el respaldo sin buffer mientras hay stems
  assert.strictEqual(r.platter.prep, false); assert.strictEqual(r.platter.buf, false); assert.ok(r.platter.held && r.platter.playing && r.platter.stems, `plato (${JSON.stringify(r.platter)})`);
  // volver a la pista completa
  assert.strictEqual(r.off, true); assert.ok(!/stemfile/.test(r.offSnap.src) && !r.offSnap.stems.on && !r.offSnap.paused, `vuelve (${JSON.stringify(r.offSnap)})`);
  assert.ok(Math.abs(r.offSnap.pos - r.pre.pos) < 2.5 && r.offSnap.pos > r.pre.pos - 0.2, `misma posición (${r.pre.pos.toFixed(2)} → ${r.offSnap.pos.toFixed(2)})`); assert.ok(r.offLevel > 0.1 && Math.abs(r.offSnap.rate - 1) < 0.01, 'suena la completa a velocidad 1');
  // cargar otra pista apaga los stems
  assert.ok(r.beforeLoad.stems.on && !r.afterLoad.stems.on && !/stemfile/.test(r.afterLoad.src) && !r.afterLoad.paused, `carga apaga stems (${JSON.stringify(r.afterLoad)})`);
  console.log('stems engine: OK');
};

tests.ui = async () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const html = read('renderer/index.html'); const css = read('renderer/styles.css');
  assert.ok(/class="stems"/.test(html) && (html.match(/class="stem"/g) || []).length === 4 && /id="stems-sum"/.test(html) && /\.stems-bar/.test(css) && /prefers-reduced-motion/.test(css), 'marcado y estilos');
  assert.ok(/aria-pressed/.test(html) && /aria-label="Cancelar la separación"/.test(html), 'accesibilidad de la tira');
  const S = await import('../renderer/stems.js');
  assert.strictEqual(S.jobText({ stage: 'progress', progress: 0.37, etaS: 80 }), 'Separando… 37 %, ≈ 1:20'); assert.match(S.jobText({ stage: 'model', progress: 0.5 }), /modelo.*50 %/); assert.strictEqual(S.fmtSize(310e6), '310 MB');
  assert.deepStrictEqual(S.STEM_UI.map((s) => s.ch), [3, 0, 1, 2]); assert.strictEqual(S.trackView({ available: false, why: 'x' }).mode, 'off'); assert.strictEqual(S.trackView({ hasFile: false }).mode, 'off');
  const r = await runApp('stems-ui-selftest.js', 'stems-ui.json', null, { YTDJ_STEMS_FAKE: '1', YTDJ_STEMS_SLOW_MS: '250' });
  // sin stems: ofrece separar; la pista solo de streaming no se puede (REQ-5, REQ-7)
  assert.strictEqual(r.status.available, true); assert.ok(r.s0.mode === 'none' && r.s0.go === 'Separar' && !r.s0.goOff, `inicio ${JSON.stringify(r.s0)}`);
  assert.ok(r.rowStream.disabled && /guarda|archivo/i.test(r.rowStream.title), `streaming sin archivo (${r.rowStream.title})`); assert.strictEqual(r.reqStream.ok, false); assert.match(r.reqStream.error, /archivo local/);
  assert.ok(!r.row0.chip && r.sum0.hidden, 'sin chip ni resumen al inicio');
  // REQ-2: progreso y tiempo restante en el deck y en la fila, con cancelar
  assert.ok(r.work && r.work.x && r.work.bar && /Separando… \d+ %/.test(r.work.msg), `trabajo en el deck (${JSON.stringify(r.work)})`); assert.ok(/^\d+ %$/.test(r.rowWork.text) && /cancelar/.test(r.rowWork.title), `trabajo en la fila (${JSON.stringify(r.rowWork)})`);
  // REQ-7: al terminar, chip con tamaño y resumen
  assert.ok(r.ready.mode === 'ready' && r.ready.go === 'Activar stems' && !r.ready.goOff, `listos (${JSON.stringify(r.ready)})`); assert.ok(r.rowReady.chip && /MB/.test(r.rowReady.chipTitle) && /Stems/.test(r.rowReady.text), 'chip y botón en la fila');
  assert.ok(!r.sumReady.hidden && /Stems: 1 pista, \d+ MB/.test(r.sumReady.text), `resumen (${r.sumReady.text})`); assert.ok(r.list[r.id].bytes > 1000);
  // REQ-5: activar, silenciar (aria-pressed y texto), aislar, volver
  assert.ok(r.active.mode === 'active' && r.active.group && r.active.off && !r.active.go, `activos (${JSON.stringify(r.active)})`); assert.deepStrictEqual(r.active.pressed, ['false', 'false', 'false', 'false']);
  assert.strictEqual(r.muted.pressed[0], 'true'); assert.match(r.muted.labels[0], /Voz \(silenciada\)/);
  assert.ok(r.soloed.solo[1] && /Batería \(aislada\)/.test(r.soloed.labels[1]), `solo (${JSON.stringify(r.soloed)})`);
  assert.ok(r.back.mode === 'ready' && !r.back.group, 'Completa vuelve a la pista completa');
  // borrar desde la Librería
  assert.ok(r.deleted.mode === 'none' && !r.rowDeleted.chip && r.sumDeleted.hidden, `borrado (${JSON.stringify(r.rowDeleted)})`);
  // cancelar: vuelve a ofrecer separar y no quedan restos
  assert.ok(r.beforeCancel.mode === 'work', 'trabajo en curso antes de cancelar'); assert.strictEqual(r.cancelled.mode, 'none'); assert.deepStrictEqual(r.listAfter, {});
  const left = fs.readdirSync(path.join(lastData, 'stems')).filter((f) => f.endsWith('.part') || f.endsWith('.flac')); assert.deepStrictEqual(left, [], `restos: ${left}`);
  console.log('stems ui: OK');
};

tests.docs = () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const doc = read('docs/05-stems.md'); const idx = read('docs/README.md'); const rd = read('README.md'); const ci = read('.github/workflows/ci.yml');
  assert.ok(/HTDemucs/.test(doc) && /210 MB/.test(doc) && /SHA-256/.test(doc) && /no lo incluye/.test(doc) && /Apache-2\.0/.test(doc), 'el modelo y el permiso');
  assert.ok(/1,7 veces/.test(doc) && /1,5 GB/.test(doc) && /15 minutos/.test(doc) && /Borrar stems/.test(doc) && /Mayús o Ctrl/.test(doc) && /macOS con Intel/.test(doc), 'coste, límites y plataformas');
  assert.ok(/05-stems\.md/.test(idx) && /05-stems\.md/.test(rd), 'enlazada desde el índice y el README');
  for (const m of ['model', 'store', 'ipc', 'docs']) assert.ok(new RegExp(`for m in [^;]*\\b${m}\\b[^;]*; do node --experimental-default-type=module scripts/test-stems.js`).test(ci), `CI ejecuta ${m}`);
  assert.ok(/test-stems\.js \$m/.test(ci) && /xvfb-run -a node --experimental-default-type=module scripts\/test-stems\.js \$m/.test(ci), 'CI ejecuta engine y ui con pantalla virtual');
  console.log('stems docs: OK');
};

// Prueba real (opcional): necesita el modelo. YTDJ_STEMS_MODEL=/ruta/htdemucs.ort node --experimental-default-type=module scripts/test-stems.js real
tests.real = async () => {
  const model = process.env.YTDJ_STEMS_MODEL;
  if (!model || !fs.existsSync(model)) return console.log('stems real: omitida (define YTDJ_STEMS_MODEL con el modelo)');
  const cp = require('node:child_process'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-stems-real-'));
  const clip = path.join(dir, 'clip.wav'); cp.spawnSync(FF, ['-y', '-loglevel', 'error', '-ss', '10', '-t', '20', '-i', demoTrack(), clip]);
  const { store, events, until } = makeStore({ workerEnv: {}, modelPath: () => model }); const t0 = Date.now();
  store.request('R1', clip); await until(() => store.has('R1') || events.some((e) => e.stage === 'error'), 300000);
  const err = events.find((e) => e.stage === 'error'); assert.ok(!err, JSON.stringify(err)); const secs = (Date.now() - t0) / 1000;
  const raw = (f, ch) => { const r = cp.spawnSync(FF, ['-v', 'error', '-i', f, '-f', 'f32le', '-ac', String(ch), '-ar', '44100', '-'], { maxBuffer: 1 << 30 }); return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length)); };
  const mix = raw(clip, 2); const st = raw(store.fileOf('R1'), 8); const n = Math.min(mix.length / 2, st.length / 8);
  let num = 0; let den = 0; for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { let sum = 0; for (let k = 0; k < 4; k++) sum += st[i * 8 + k * 2 + c]; const d = sum - mix[i * 2 + c]; num += d * d; den += mix[i * 2 + c] ** 2; }
  const snr = 10 * Math.log10(den / Math.max(num, 1e-12)); assert.ok(snr > 15, `la suma de los cuatro stems reconstruye la mezcla (SNR ${snr.toFixed(1)} dB)`);
  const energy = [0, 1, 2, 3].map((k) => { let e = 0; for (let i = 0; i < n; i++) e += st[i * 8 + k * 2] ** 2; return e; }); assert.ok(energy.every((e) => e > 0), 'los cuatro stems tienen señal');
  console.log(`stems real: OK (20 s en ${secs.toFixed(1)} s, SNR ${snr.toFixed(1)} dB)`);
};

tests[mode] = tests[mode] || (() => { console.error('modo no implementado todavía:', mode); process.exit(2); });
Promise.resolve().then(() => tests[mode]()).catch((e) => (console.error(e), process.exit(1)));
