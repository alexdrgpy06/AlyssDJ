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
  // variantes de modelo (REQ-8): cada una con su archivo, tamaño y SHA-256; mismo permiso y verificación
  {
    const crypto = require('node:crypto'); const { ModelSet, MODELS } = require('../main/stems.js');
    assert.ok(MODELS.cpu.file === 'htdemucs.ort' && MODELS.gpu.file === 'htdemucs.onnx' && MODELS.gpu.license === 'MIT' && MODELS.gpu.bytes === 316446953);
    assert.ok(/^https:\/\/huggingface\.co\/StemSplitio\/htdemucs-onnx\//.test(MODELS.gpu.url) && /^[0-9a-f]{64}$/.test(MODELS.gpu.sha256) && MODELS.gpu.sha256 !== MODELS.cpu.sha256);
    const mkBody = (n) => crypto.randomBytes(n); const bodies = { cpu: mkBody(70000), gpu: mkBody(90000) };
    const specs = Object.fromEntries(Object.entries(bodies).map(([v, b]) => [v, { ...MODELS[v], url: `http://x/${v}`, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }]));
    const asked = []; const urls = []; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-set-'));
    const set = new ModelSet({ dir, specs, confirm: async (i) => (asked.push(i), true), fetch: async (u) => (urls.push(u), new Response(bodies[u.endsWith('gpu') ? 'gpu' : 'cpu'])) });
    assert.ok(!set.present('cpu') && !set.present('gpu')); assert.strictEqual(path.basename(set.path('gpu')), 'htdemucs.onnx'); assert.strictEqual(path.basename(set.path()), 'htdemucs.ort');
    await set.ensure('gpu'); assert.ok(set.present('gpu') && !set.present('cpu'), 'solo se baja la variante pedida'); assert.deepStrictEqual(urls, ['http://x/gpu']);
    assert.strictEqual(asked.length, 1); assert.strictEqual(asked[0].variant, 'gpu'); assert.strictEqual(asked[0].license, 'MIT');
    const st = set.status(); assert.ok(st.variants.gpu.present && !st.variants.cpu.present && st.present === false && st.variants.gpu.bytes === bodies.gpu.length);
    await set.ensure('gpu'); assert.strictEqual(urls.length, 1, 'ya presente: no vuelve a pedir ni a bajar');
    // una variante corrupta se descarta y no deja archivo
    const bad = new ModelSet({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-set-')), specs, confirm: async () => true, fetch: async () => new Response(Buffer.concat([bodies.gpu.subarray(0, 89999), Buffer.from([bodies.gpu.at(-1) ^ 1])])) });
    await assert.rejects(bad.ensure('gpu'), /SHA-256/); assert.ok(!bad.present('gpu'));
  }
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
  {
    // REQ-4: prioridades 0 = deck, 1 = siguiente de AutoMix, 2 = resto; las de menor número adelantan, a igual prioridad por llegada
    const { store, events, until } = makeStore({ workerEnv: { YTDJ_STEMS_FAKE: '1', YTDJ_STEMS_SLOW_MS: '60' } });
    store.request('Q-run', track, 2); await until(() => events.some((e) => e.id === 'Q-run' && e.stage === 'progress'));
    store.request('Q-b', track); store.request('Q-c', track, 2); store.request('Q-next', track, 1); store.request('Q-deck', track, 0); store.request('Q-d', track, 2);
    assert.deepStrictEqual(store.queue.map((q) => q.id), ['Q-deck', 'Q-next', 'Q-b', 'Q-c', 'Q-d'], 'cola ordenada por prioridad y llegada');
    assert.strictEqual(store.request('Q-c', track, 2), false, 'misma prioridad: sin cambios'); assert.strictEqual(store.request('Q-c', track, 3), false, 'prioridad inválida cuenta como 2');
    assert.strictEqual(store.request('Q-run', track, 0), false, 'la que ya se separa no se repite');
    assert.ok(store.request('Q-d', track, 1), 'subir de prioridad una que espera'); assert.deepStrictEqual(store.queue.map((q) => q.id), ['Q-deck', 'Q-next', 'Q-d', 'Q-b', 'Q-c']);
    assert.strictEqual(events.filter((e) => e.id === 'Q-d' && e.stage === 'queued').at(-1).priority, 1);
    await until(() => store.has('Q-c'), 120000);
    assert.deepStrictEqual(events.filter((e) => e.stage === 'done').map((e) => e.id), ['Q-run', 'Q-deck', 'Q-next', 'Q-d', 'Q-b', 'Q-c'], 'terminan en el orden de prioridad');
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
  for (const c of ['status', 'device', 'list', 'request', 'cancel', 'remove', 'remove-all']) { assert.ok(main.includes(`'stems:${c}'`) && pre.includes(`'stems:${c}'`), `canal stems:${c}`); }
  assert.ok(pre.includes("on('stems:event')") && /stemfile\//.test(main) && /showMessageBox/.test(main), 'evento, ruta del archivo y diálogo de permiso');
  // REQ-1/2: el evento done trae la velocidad medida (rt), el selector la recuerda y Ajustes la muestra
  {
    const dev = require('../main/stems-device.js'); const rts = [];
    const { store, events, until } = makeStore({ plan: () => ({ provider: 'webgpu', variant: 'gpu' }), onRt: (p, rt) => rts.push([p, rt]) });
    store.request('R9', demoTrack()); await until(() => store.has('R9') || events.some((e) => e.stage === 'error'));
    const dn = events.find((e) => e.stage === 'done'); assert.ok(dn && dn.rt > 0 && dn.device === 'webgpu', JSON.stringify(dn)); assert.deepStrictEqual(rts.map((r) => r[0]), ['webgpu']); assert.ok(rts[0][1] === dn.rt);
    const sel = new dev.DeviceSelector({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-rt-')), appVersion: '1', modelSha: 'a', candidates: ['webgpu'], probe: async () => ({ ok: true, rt: 14, cpuRt: 3, snr: 90 }) });
    await sel.select(); sel.noteRt('cpu', 99); assert.strictEqual(sel.info().rt, 14, 'otro dispositivo no la cambia'); sel.noteRt('webgpu', 12.5); assert.strictEqual(new dev.DeviceSelector(sel.o).info().rt, 12.5, 'se guarda en device.json');
    const { StemsStore } = await import('../renderer/stems.js'); const st = new StemsStore({ list: async () => ({}), status: async () => ({ available: true, usedBytes: 0, count: 0 }), device: async () => ({ device: 'webgpu', label: 'WebGPU', rt: 14.2, probe: 'ok' }), onEvent: () => {} });
    assert.strictEqual(st.deviceLine(), 'Dispositivo: CPU · se elige al separar la primera pista'); await st.init(); assert.strictEqual(st.deviceLine(), 'Dispositivo: WebGPU · 14× tiempo real');
    st.device = { device: 'cpu', label: 'CPU', rt: 3.14, probe: 'fallo' }; assert.strictEqual(st.deviceLine(), 'Dispositivo: CPU · 3.1× tiempo real · la GPU no funcionó y se usa la CPU');
    st.onEvent({ id: 'x', stage: 'fallback', error: 'El proceso de separación terminó (139)' }); assert.match(st.notice, /Se usó la CPU: .*139/);
    const html = fs.readFileSync(path.join(root, 'renderer/index.html'), 'utf8'); assert.ok(/<h4>Stems<\/h4>/.test(html) && /id="stems-device"/.test(html) && /id="stems-notice"/.test(html), 'sección Stems en Ajustes');
    assert.ok(/stems-device/.test(fs.readFileSync(path.join(root, 'renderer/library.js'), 'utf8')), 'se pinta desde el estado compartido');
  }
  // REQ-4: stemsAuto (auto | on | off), IPC con prioridad y petición automática al cargar en un deck y al fijar la siguiente
  {
    for (const c of ['settings', 'set']) assert.ok(main.includes(`'stems:${c}'`) && pre.includes(`'stems:${c}'`), `canal stems:${c}`);
    assert.ok(/stemsAuto: 'auto'/.test(read('main/settings.js')) && /stemsQuotaGB: 5/.test(read('main/settings.js')), 'valores por defecto');
    assert.ok(/name="stemsAuto"/.test(read('renderer/index.html')) && /<option value="auto">/.test(read('renderer/index.html')), 'control en Ajustes');
    assert.ok(/this\.stems\.auto\(d\?\.track\?\.videoId, 0,/.test(read('renderer/app.js')), 'al cargar en un deck: prioridad 0');
    assert.ok(/stems\?\.auto\(this\.queue\[0\]\.videoId, 1,/.test(read('renderer/automix.js')), 'la siguiente de AutoMix: prioridad 1');
    const { StemsStore } = await import('../renderer/stems.js'); const calls = [];
    const mkSt = (device, avail = true) => { const st = new StemsStore({ request: async (id, pr) => (calls.push([id, pr]), { ok: true }), list: async () => ({}), status: async () => ({}) }); st.status = { available: avail, usedBytes: 0, count: 0 }; st.device = device; return st; };
    const gpu = { device: 'webgpu', label: 'WebGPU', rt: 14, probe: 'ok' }; const cpu = { device: 'cpu', label: 'CPU', rt: null, probe: 'pendiente' };
    assert.ok(mkSt(gpu).autoOn('auto') && !mkSt(cpu).autoOn('auto') && !mkSt({ ...gpu, probe: 'fallo' }).autoOn('auto'), 'auto: solo con GPU comprobada');
    assert.ok(mkSt(cpu).autoOn('on') && !mkSt(gpu).autoOn('off') && !mkSt(gpu, false).autoOn('on'), 'on siempre (si hay motor), off nunca');
    const st = mkSt(gpu); assert.strictEqual(await st.auto('t1', 0, 'auto'), true); assert.strictEqual(await st.auto('t1', 0, 'auto'), false, 'no insiste a cada repintado'); assert.strictEqual(await st.auto('t2', 1, 'auto'), true);
    st.done.t3 = {}; assert.strictEqual(await st.auto('t3', 0, 'auto'), false, 'ya la tiene'); st.jobs.t4 = { stage: 'queued' }; assert.strictEqual(await st.auto('t4', 0, 'auto'), false, 'ya está en marcha');
    assert.strictEqual(await mkSt(gpu).auto('t5', 0, 'off'), false); assert.deepStrictEqual(calls, [['t1', 0], ['t2', 1]]);
    const failing = new StemsStore({ request: async () => { throw new Error('x'); }, list: async () => ({}), status: async () => ({}) }); failing.status = { available: true }; failing.device = gpu; assert.strictEqual(await failing.auto('z', 0, 'on'), false, 'un fallo no rompe ni se anota');
    assert.ok(!failing.errors.z, 'sin error visible en la fila');
  }
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
    // REQ-5/6: activar con la acción ya aplicada y fundido cruzado sin salto; «Completa» devuelve la pista entera
  assert.ok(r.comboOn.ok && r.comboOn.st.on && r.comboOn.st.mute[3] && !r.comboOn.st.mute[0], `activa con la voz en mute (${JSON.stringify(r.comboOn)})`);
  assert.ok(r.comboOn.ms < 4000, `una sola acción, sin esperas largas (${Math.round(r.comboOn.ms)} ms)`);
  assert.ok(near(r.comboMuted / k, 0.35, 0.25), `sin voz suena ≈ 0,35 de 0,75 (${(r.comboMuted / k).toFixed(3)})`);
  assert.ok(!r.comboSnap.paused && r.comboSnap.stems.on, 'sigue sonando tras el fundido');
  assert.ok(!r.comboOffSnap.stems.on && !r.comboOffSnap.paused && r.comboOffLevel > 0.02, `vuelta a la completa sin cortes (${r.comboOffLevel.toFixed(3)})`);
  assert.ok(r.comboSolo.on && r.comboSolo.solo[0] && !r.comboSolo.mute[0], 'activar con la batería aislada'); assert.ok(near(r.comboSoloLevel / k, tones[0].a, 0.35), `solo la batería: su amplitud (${(r.comboSoloLevel / k).toFixed(3)})`);
  assert.ok(!r.comboOffAgain.st.on && !r.comboOffAgain.paused, 'segunda vuelta limpia: sin restos del fundido');
  console.log('stems engine: OK');
};

tests.ui = async () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const html = read('renderer/index.html'); const css = read('renderer/styles.css');
  assert.ok(/class="stems"/.test(html) && (html.match(/class="stem"/g) || []).length === 4 && /id="stems-sum"/.test(html) && /\.stems-bar/.test(css) && /prefers-reduced-motion/.test(css), 'marcado y estilos');
  assert.ok(/aria-pressed/.test(html) && /aria-label="Cancelar la separación"/.test(html), 'accesibilidad de la tira');
  const S = await import('../renderer/stems.js');
  assert.strictEqual(S.jobText({ stage: 'progress', progress: 0.37, etaS: 80 }), 'Preparando · 37 % · 1:20'); assert.match(S.jobText({ stage: 'model', progress: 0.5 }), /modelo.*50 %/); assert.strictEqual(S.fmtSize(310e6), '310 MB');
  assert.deepStrictEqual(S.STEM_UI.map((s) => s.ch), [3, 0, 1, 2]); assert.strictEqual(S.trackView({ available: false, why: 'x' }).mode, 'off'); assert.strictEqual(S.trackView({ hasFile: false }).mode, 'off');
  const r = await runApp('stems-ui-selftest.js', 'stems-ui.json', null, { YTDJ_STEMS_FAKE: '1', YTDJ_STEMS_SLOW_MS: '120' });
  // sin stems: los cuatro botones en su sitio y nada de «Separar»/«Activar»; la pista solo de streaming no se puede (REQ-5, REQ-7)
  assert.strictEqual(r.status.available, true); assert.ok(r.s0.mode === 'none' && !r.s0.goBtn && r.s0.group && r.s0.disabled.every((d) => !d) && /Pulsa un stem/.test(r.s0.msg), `inicio ${JSON.stringify(r.s0)}`);
  assert.ok(r.s0.titles.every((t) => /separa la pista/.test(t)), 'la ayuda explica qué hace el clic'); assert.ok(!r.s0.off, 'sin «Completa» al inicio');
  assert.ok(r.rowStream.disabled && /guarda|archivo/i.test(r.rowStream.title), `streaming sin archivo (${r.rowStream.title})`); assert.strictEqual(r.reqStream.ok, false); assert.match(r.reqStream.error, /archivo local/);
  assert.ok(!r.row0.chip && r.sum0.hidden, 'sin chip ni resumen al inicio');
  // un clic en Voz queda pendiente (se ve pulsado) mientras se prepara
  assert.ok(r.pending.pressed[0] === 'true' && r.pending.mode !== 'off', `acción pendiente (${JSON.stringify(r.pending)})`);
  // REQ-2: progreso y tiempo restante en el deck y en la fila, con cancelar
  assert.ok(r.work && r.work.x && r.work.bar && /Preparando · \d+ %/.test(r.work.msg), `trabajo en el deck (${JSON.stringify(r.work)})`); assert.ok(/^\d+ %$/.test(r.rowWork.text) && /cancelar/.test(r.rowWork.title), `trabajo en la fila (${JSON.stringify(r.rowWork)})`);
  // REQ-6/7: al terminar se aplica solo, sin «Activar»: activos con la voz en mute, chip con tamaño y resumen
  assert.ok(r.active.mode === 'active' && r.active.group && !r.active.goBtn && r.active.pressed[0] === 'true' && /Voz \(silenciada\)/.test(r.active.labels[0]), `activos con la voz en mute (${JSON.stringify(r.active)})`);
  assert.ok(r.active.off, '«Completa» aparece con un stem silenciado'); assert.ok(r.rowReady.chip && /MB/.test(r.rowReady.chipTitle) && /Stems/.test(r.rowReady.text), 'chip y botón en la fila');
  assert.ok(!r.sumReady.hidden && /Stems: 1 pista, \d+ MB/.test(r.sumReady.text), `resumen (${r.sumReady.text})`); assert.ok(r.list[r.id].bytes > 1000);
  // REQ-5: aislar, «Completa» (los botones siguen en su sitio), reactivar con un clic y soltar el último mute vuelve solo a la completa
  assert.ok(r.soloed.solo[1] && /Batería \(aislada\)/.test(r.soloed.labels[1]), `solo (${JSON.stringify(r.soloed)})`);
  assert.ok(r.back.mode === 'ready' && r.back.group && !r.back.off && r.back.pressed.every((p) => p === 'false'), `Completa vuelve a la pista completa (${JSON.stringify(r.back)})`);
  assert.ok(r.again.mode === 'active' && r.again.pressed[2] === 'true', `un clic basta para activar (${JSON.stringify(r.again)})`);
  assert.ok(r.unmuted.mode === 'ready' && r.unmuted.pressed.every((p) => p === 'false') && !r.unmuted.off, `sin ningún mute, vuelve a la completa (${JSON.stringify(r.unmuted)})`);
  // borrar desde la Librería
  assert.ok(r.deleted.mode === 'none' && !r.rowDeleted.chip && r.sumDeleted.hidden, `borrado (${JSON.stringify(r.rowDeleted)})`);
  // cancelar: vuelve a ofrecer separar y no quedan restos
  assert.ok(r.beforeCancel.mode === 'work', 'trabajo en curso antes de cancelar'); assert.strictEqual(r.cancelled.mode, 'none'); assert.ok(r.cancelled.pressed.every((p) => p === 'false'), 'cancelar descarta la acción pendiente'); assert.deepStrictEqual(r.listAfter, {});
  const left = fs.readdirSync(path.join(lastData, 'stems')).filter((f) => f.endsWith('.part') || f.endsWith('.flac')); assert.deepStrictEqual(left, [], `restos: ${left}`);
  console.log('stems ui: OK');
};

tests.docs = () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const doc = read('docs/05-stems.md'); const idx = read('docs/README.md'); const rd = read('README.md'); const ci = read('.github/workflows/ci.yml');
  assert.ok(/HTDemucs/.test(doc) && /210 MB/.test(doc) && /SHA-256/.test(doc) && /no los incluye/.test(doc) && /Apache-2\.0/.test(doc), 'el modelo y el permiso');
  assert.ok(/1,7 veces/.test(doc) && /1,5 GB/.test(doc) && /15 minutos/.test(doc) && /Borrar stems/.test(doc) && /Mayús o Ctrl/.test(doc) && /macOS con Intel/.test(doc), 'coste, límites y plataformas');
  assert.ok(/316 MB/.test(doc) && /StemSplitio/.test(doc) && /MIT/.test(doc) && /DirectML/.test(doc) && /CoreML/.test(doc) && /WebGPU/.test(doc) && /device\.json/.test(doc) && /40 dB/.test(doc), 'GPU: modelo, proveedores y sondeo');
  assert.ok(/Preparar stems solos/.test(doc) && /siguiente de AutoMix/.test(doc) && /Espacio máximo/.test(doc) && /Completa/.test(doc) && /40 ms/.test(doc) && !/Activar stems/.test(doc), 'preparación automática, cuota y sin «Activar»');
  assert.ok(/05-stems\.md/.test(idx) && /05-stems\.md/.test(rd), 'enlazada desde el índice y el README');
  for (const m of ['model', 'store', 'ipc', 'device', 'quota', 'docs']) assert.ok(new RegExp(`for m in [^;]*\\b${m}\\b[^;]*; do node --experimental-default-type=module scripts/test-stems.js`).test(ci), `CI ejecuta ${m}`);
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

// ---------- cuota: borra los menos usados, nunca los cargados en decks ni la recién hecha ----------
tests.quota = async () => {
  const track = demoTrack();
  const { store, events, until } = makeStore();
  for (const id of ['Q1', 'Q2', 'Q3']) store.request(id, track);
  await until(() => store.has('Q1') && store.has('Q2') && store.has('Q3'));
  const size = store.index.Q1.bytes; assert.ok(size > 50000 && store.usage() >= 3 * size * 0.95, `tamaños (${size})`);
  // Q2 se usó hace poco, Q1 hace mucho, Q3 a medias
  store.index.Q1.used = 1000; store.index.Q3.used = 2000; store.index.Q2.used = Date.now(); store.save();
  assert.deepStrictEqual(store.trim(0), [], 'sin límite válido no borra'); assert.deepStrictEqual(store.trim(store.usage() + 1), [], 'dentro de la cuota no borra');
  // pasa de la cuota por una pista: cae la menos usada y deja de haber evento si no se borra nada
  const lim = store.usage() - 1; const ev0 = events.length;
  assert.deepStrictEqual(store.trim(lim), ['Q1'], 'cae la menos usada'); assert.ok(!store.has('Q1') && !fs.existsSync(store.fileOf('Q1')), 'y su archivo');
  const tr = events.slice(ev0).find((e) => e.stage === 'trimmed'); assert.ok(tr && tr.ids[0] === 'Q1' && tr.usedBytes === store.usage(), 'evento trimmed');
  assert.ok(JSON.parse(fs.readFileSync(store.indexFile(), 'utf8')).Q1 === undefined, 'el índice en disco también');
  // lo cargado en decks no se toca aunque sea lo menos usado; se borra lo siguiente
  store.setKeep(['Q3']); assert.deepStrictEqual(store.trim(store.usage() - 1), ['Q2'], 'Q3 protegida: cae Q2'); assert.ok(store.has('Q3'));
  // si no cabe ni así, se queda lo protegido y la `except`
  store.setKeep(['Q3']); assert.deepStrictEqual(store.trim(1, ['Q3']), [], 'nada más que borrar'); assert.ok(store.has('Q3'));
  // touch marca el uso (se llama al servir el archivo)
  const before = store.index.Q3.used; await sleep(5); store.touch('Q3'); assert.ok(store.index.Q3.used > before); store.touch('no-existe');
  // tras separar una pista nueva se aplica la cuota sobre las demás y la nueva sobrevive
  {
    const m = makeStore({ quotaBytes: () => 1 }); for (const id of ['N1', 'N2']) m.store.request(id, track);
    await m.until(() => m.store.has('N2') || m.events.some((e) => e.stage === 'error'));
    assert.ok(m.store.has('N2') && !m.store.has('N1'), `solo queda la última (${Object.keys(m.store.list())})`); assert.ok(m.events.some((e) => e.stage === 'trimmed' && e.ids.includes('N1')));
  }
  // al reiniciar conserva el orden de uso (campo `used` en index.json)
  const { StemStore } = require('../main/stems.js'); const again = new StemStore({ dir: store.dir, ffmpeg: () => FF, modelPath: () => '' }); assert.ok(again.has('Q3') && again.index.Q3.used === store.index.Q3.used);
  // wiring: IPC, valor por defecto, control y botón de Ajustes, protección de los decks y evento en el renderer
  const main = read('main/main.js'); const pre = read('preload/app.js');
  assert.ok(/stems:keep/.test(main) && /stems:keep/.test(pre) && /stems\.touch\(/.test(main) && /stems\?\.trim\(/.test(main) && /quotaBytes: \(\) => stemSettings\(\)\.quotaGB \* 1e9/.test(main), 'cuota cableada en main');
  assert.ok(/name="stemsQuotaGB"/.test(read('renderer/index.html')) && /id="stems-clear-all"/.test(read('renderer/index.html')) && /id="stems-space"/.test(read('renderer/index.html')), 'controles en Ajustes');
  assert.ok(/window\.ytdj\.stems\.keep\(/.test(read('renderer/app.js')), 'los decks se protegen');
  const { StemsStore } = await import('../renderer/stems.js'); const st = new StemsStore({ list: async () => ({}), status: async () => ({ available: true, usedBytes: 1.2e9, count: 2 }), onEvent: () => {} }); st.status = { available: true, usedBytes: 1.2e9 }; st.done = { a: {}, b: {} };
  assert.strictEqual(st.spaceLine(5), 'Espacio: 1.2 GB de 5 GB · al pasarte se borran los menos usados'); st.status.usedBytes = 40e6; assert.match(st.spaceLine(5), /^Espacio: 40 MB de 5 GB/);
  let changes = 0; st.onChange = () => changes++; st.onEvent({ stage: 'trimmed', ids: ['a'] }); assert.ok(!('a' in st.done) && 'b' in st.done && changes >= 1, 'trimmed quita la pista del estado');
  const { settingPatch } = await import('../renderer/settings-ui.js'); assert.deepStrictEqual(settingPatch('stemsQuotaGB', { stemsQuotaGB: { type: 'number', value: '8' } }), { stemsQuotaGB: 8 });
  console.log('stems quota: OK');
};

// ---------- dispositivo: selección por plataforma, sondeo con caché y caída a CPU ----------
tests.device = async () => {
  const dev = require('../main/stems-device.js');
  // proveedores por plataforma (REQ-1)
  assert.deepStrictEqual(dev.candidates('win32', 'x64'), ['dml']); assert.deepStrictEqual(dev.candidates('darwin', 'arm64'), ['coreml']); assert.deepStrictEqual(dev.candidates('darwin', 'x64'), []);
  assert.deepStrictEqual(dev.candidates('linux', 'x64', { cuda: true }), ['cuda', 'webgpu']); assert.deepStrictEqual(dev.candidates('linux', 'x64'), ['webgpu']);
  const mk = (probe, extra = {}) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-dev-')); const calls = []; const o = { dir, appVersion: '1', modelSha: 'aa', candidates: ['cuda', 'webgpu'], probe: async (p) => { calls.push(p); return probe(p); }, ...extra }; return { dir, calls, o, sel: new dev.DeviceSelector(o) }; };
  const good = { ok: true, rt: 14, cpuRt: 3, snr: 80 };
  { // el primero que pasa el sondeo gana; la caché evita repetirlo
    const t = mk((p) => (p === 'cuda' ? { ok: false, error: 'sin cuDNN' } : good));
    assert.strictEqual(t.sel.info().probe, 'pendiente'); assert.strictEqual(t.sel.provider(), 'cpu', 'sin sondeo, CPU');
    const r = await t.sel.select(); assert.deepStrictEqual(t.calls, ['cuda', 'webgpu']);
    assert.strictEqual(r.device, 'webgpu'); assert.strictEqual(r.probe, 'ok'); assert.strictEqual(r.rt, 14); assert.strictEqual(t.sel.provider(), 'webgpu');
    const saved = JSON.parse(fs.readFileSync(path.join(t.dir, 'device.json'), 'utf8')); assert.ok(saved.ok && saved.device === 'webgpu' && saved.bad.cuda === 'sin cuDNN' && saved.appVersion === '1' && saved.modelSha === 'aa');
    const t2 = new dev.DeviceSelector({ ...t.o, probe: async () => { throw new Error('no debe sondear'); } }); assert.strictEqual((await t2.select()).device, 'webgpu', 'la caché vale');
    const t3 = new dev.DeviceSelector({ ...t.o, appVersion: '2' }); assert.strictEqual(t3.info().probe, 'pendiente', 'otra versión de app: se vuelve a sondear'); await t3.select(); assert.strictEqual(t.calls.length, 4);
    const t4 = new dev.DeviceSelector({ ...t.o, modelSha: 'bb' }); assert.strictEqual(t4.fresh(), false, 'otro modelo: se vuelve a sondear');
  }
  { // salida distinta de CPU, más lento que CPU, o sondeo que lanza o muere: CPU y se recuerda por qué
    for (const [name, probe, why] of [['snr', () => ({ ok: true, rt: 14, cpuRt: 3, snr: 20 }), /distinta de CPU/], ['lento', () => ({ ok: true, rt: 2, cpuRt: 3, snr: 90 }), /más lento/], ['lanza', () => { throw new Error('core dump'); }, /core dump/], ['muere', () => ({ ok: false, error: 'el sondeo terminó (139)' }), /139/]]) {
      const t = mk(probe, { candidates: ['webgpu'] }); const r = await t.sel.select();
      assert.strictEqual(r.device, 'cpu', name); assert.strictEqual(r.probe, 'fallo', name);
      assert.match(JSON.parse(fs.readFileSync(path.join(t.dir, 'device.json'), 'utf8')).bad.webgpu, why, name);
    }
    const none = mk(() => good, { candidates: [] }); const r = await none.sel.select(); assert.ok(r.device === 'cpu' && r.probe === 'ok', 'sin candidatos la CPU es lo esperado, no un fallo');
  }
  { // una pista real que mata a la GPU la marca mala hasta que cambie la versión
    const t = mk(() => good); await t.sel.select(); t.sel.markBad('webgpu', 'El proceso de separación terminó (139)');
    assert.strictEqual(t.sel.provider(), 'cpu'); const again = new dev.DeviceSelector(t.o); assert.ok(again.fresh() && again.info().probe === 'fallo' && again.state.bad.webgpu);
    t.sel.markBad('cpu', 'x'); assert.strictEqual(t.sel.provider(), 'cpu', 'cpu no se marca');
  }
  // el almacén cae a CPU cuando el hijo de GPU muere (REQ-3) y avisa para marcar el dispositivo
  const track = demoTrack();
  {
    const fails = [];
    const { store, events, until } = makeStore({ plan: () => ({ provider: 'webgpu', variant: 'gpu' }), onDeviceFail: (p, e) => fails.push([p, e]), workerEnv: { YTDJ_STEMS_FAKE: '1', YTDJ_STEMS_FAIL_PROVIDER: 'webgpu' } });
    store.request('F1', track); await until(() => store.has('F1') || events.some((e) => e.stage === 'error'));
    assert.ok(store.has('F1'), JSON.stringify(events.slice(-3)));
    const fb = events.find((e) => e.stage === 'fallback'); assert.ok(fb && fb.from === 'webgpu' && fb.device === 'cpu', 'evento de caída a CPU');
    assert.strictEqual(fails.length, 1); assert.strictEqual(fails[0][0], 'webgpu'); assert.match(fails[0][1], /139/);
    assert.strictEqual(events.find((e) => e.stage === 'done').device, 'cpu'); assert.strictEqual(store.index.F1.device, 'cpu');
    const src = probe(track); const out = probe(store.fileOf('F1')); assert.strictEqual(out.streams[0].channels, 8); assert.ok(Math.abs(+out.format.duration - +src.format.duration) < 0.15, 'la pista sale completa tras el reintento');
  }
  {
    // variante gpu en un proveedor sano: la ventana va directa (sin STFT externa) y el resultado es el mismo FLAC de 8 canales
    const fails = [];
    const { store, events, until } = makeStore({ plan: () => ({ provider: 'webgpu', variant: 'gpu' }), onDeviceFail: (p) => fails.push(p) });
    store.request('G1', track); await until(() => store.has('G1') || events.some((e) => e.stage === 'error'));
    assert.ok(store.has('G1') && !fails.length && !events.some((e) => e.stage === 'fallback'), JSON.stringify(events.slice(-3)));
    assert.strictEqual(store.index.G1.device, 'webgpu'); assert.ok(events.filter((e) => e.stage === 'progress').every((e) => e.device === 'webgpu'), 'el progreso informa del dispositivo');
    assert.strictEqual(probe(store.fileOf('G1')).streams[0].channels, 8);
  }
  { // un fallo de CPU no se reintenta y sigue siendo error de la pista
    const { store, events, until } = makeStore({ workerEnv: { YTDJ_STEMS_FAKE: '1' } });
    store.request('Z1', path.join(os.tmpdir(), 'no-existe.mp3')); await until(() => events.some((e) => e.stage === 'error'));
    assert.ok(!events.some((e) => e.stage === 'fallback') && events.find((e) => e.stage === 'error').code === 'archivo');
  }
  // `direct` en el DSP: sin freq ni x, la suma de la rama temporal da la mezcla
  const D = require('../shared/stems-dsp.js'); const mix = signal(400000);
  const direct = await runSeparate(D, mix, async ({ input, x }) => { assert.strictEqual(x, null); const time = new Float32Array(4 * 2 * D.W); for (let s = 0; s < 4; s++) for (let c = 0; c < 2; c++) for (let i = 0; i < D.W; i++) time[(s * 2 + c) * D.W + i] = input[c * D.W + i] * 0.25; return { time }; }, { direct: true });
  const sum = new Float32Array(400000); for (let s = 0; s < 4; s++) for (let i = 0; i < 400000; i++) sum[i] += direct.out[s * 2][i]; assert.ok(snr(mix[0], sum) > 60, 'modo directo reconstruye la mezcla');
  console.log('stems device: OK');
};

tests[mode] = tests[mode] || (() => { console.error('modo no implementado todavía:', mode); process.exit(2); });
Promise.resolve().then(() => tests[mode]()).catch((e) => (console.error(e), process.exit(1)));
