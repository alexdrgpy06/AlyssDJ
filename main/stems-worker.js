'use strict';
// Proceso hijo de la separación de stems: decodifica la pista, ejecuta HTDemucs (ONNX) por ventanas y escribe un FLAC de
// 8 canales (batería, bajo, resto, voz; L y R de cada uno) por trozos. Se lanza con `child_process.fork` y habla por IPC.
//   padre → hijo:  { type: 'start', file, out, ffmpeg, model, maxSeconds, provider, variant }  |  { type: 'cancel' }
//                  { type: 'probe', model, provider }  (sondeo: una ventana sintética en `provider` y en CPU)
//   hijo → padre:  { type: 'progress', progress, etaS, rssMB } | { type: 'done', bytes, rt } | { type: 'error', code, error }
//                  { type: 'probe', ok, rt, cpuRt, snr, error? }
//   variant 'cpu': htdemucs.ort con la STFT fuera (entradas input + x); 'gpu': ONNX con la STFT dentro (mix → stems).
const { spawn } = require('child_process');
const fs = require('fs');
const D = require('../shared/stems-dsp.js');

let cancelled = false;
const send = (m) => process.send && process.send(m);
class Fail extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

function decode(file, ffmpeg, maxSeconds) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(D.SR), '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const bufs = [];
    let bytes = 0;
    let err = '';
    const limit = maxSeconds * D.SR * 8;
    p.stdout.on('data', (b) => {
      bytes += b.length;
      if (bytes > limit) { p.kill(); return reject(new Fail('larga', `La pista dura más de ${Math.round(maxSeconds / 60)} min`)); }
      bufs.push(b);
    });
    p.stderr.on('data', (b) => (err += b));
    p.on('error', (e) => reject(new Fail('archivo', `No se pudo ejecutar ffmpeg: ${e.message}`)));
    p.on('close', (code) => {
      if (bytes > limit) return;
      if (code !== 0 || bytes < 8) return reject(new Fail('archivo', `No se pudo leer el archivo de audio${err ? `: ${err.trim().slice(0, 120)}` : ''}`));
      const all = Buffer.concat(bufs, bytes);
      const f = new Float32Array(all.buffer.slice(all.byteOffset, all.byteOffset + bytes));
      const n = f.length / 2;
      const L = new Float32Array(n);
      const R = new Float32Array(n);
      for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
      resolve([L, R]);
    });
  });
}

// Inferencia: el modelo real con onnxruntime-node (sin arena de memoria: ~1 GB en vez de ~5 GB) o, solo en pruebas
// (YTDJ_STEMS_FAKE=1), un reparto en cuatro partes iguales que no necesita el modelo.
async function makeInfer(model, provider = 'cpu', variant = 'cpu') {
  if (process.env.YTDJ_STEMS_FAKE === '1') {
    const slow = Number(process.env.YTDJ_STEMS_SLOW_MS) || 0; // las pruebas de interfaz necesitan ver el trabajo en curso
    return async ({ input }) => {
      await new Promise((r) => setTimeout(r, slow)); // como ORT, cede el turno al bucle de eventos (así llegan 'cancel' y el IPC)
      if (provider !== 'cpu' && process.env.YTDJ_STEMS_FAIL_PROVIDER === provider) process.exit(139); // simula el cuelgue del controlador
      const time = new Float32Array(4 * 2 * D.W);
      for (let s = 0; s < 4; s++) for (let c = 0; c < 2; c++) for (let i = 0; i < D.W; i++) time[(s * 2 + c) * D.W + i] = input[c * D.W + i] * 0.25;
      return variant === 'gpu' ? { time } : { time, freq: new Float32Array(4 * 4 * D.FQ * D.T) };
    };
  }
  let ort;
  try { ort = require('onnxruntime-node'); } catch (e) { throw new Fail('runtime', 'Falta el motor de stems (onnxruntime-node) en este equipo'); }
  let session;
  const opts = provider === 'cpu'
    ? { executionProviders: ['cpu'], graphOptimizationLevel: 'all', enableCpuMemArena: false, enableMemPattern: false, executionMode: 'sequential' }
    : { executionProviders: [provider], logSeverityLevel: 3 };
  try {
    session = await ort.InferenceSession.create(model, opts);
  } catch (e) { throw new Fail(provider === 'cpu' ? 'modelo' : 'dispositivo', `No se pudo cargar el modelo${provider === 'cpu' ? '' : ` en ${provider}`}: ${e.message}`); }
  if (variant === 'gpu') {
    return async ({ input }) => {
      const r = await session.run({ mix: new ort.Tensor('float32', input, [1, 2, D.W]) });
      return { time: r.stems.data };
    };
  }
  return async ({ input, x }) => {
    const r = await session.run({ input: new ort.Tensor('float32', input, [1, 2, D.W]), x: new ort.Tensor('float32', x, [1, 4, D.FQ, D.T]) });
    return { time: r.add_67.data, freq: r.output.data };
  };
}

// Ventana sintética fija (tonos y ruido determinista), normalizada como una pista real.
function probeWindow() {
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const L = new Float32Array(D.W);
  const R = new Float32Array(D.W);
  for (let i = 0; i < D.W; i++) {
    L[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / D.SR) + 0.15 * Math.sin((2 * Math.PI * 3300 * i) / D.SR) + 0.1 * rnd();
    R[i] = 0.3 * Math.sin((2 * Math.PI * 330 * i) / D.SR) + 0.1 * Math.sin((2 * Math.PI * 5000 * i) / D.SR) + 0.1 * rnd();
  }
  const input = new Float32Array(2 * D.W);
  input.set(L, 0);
  input.set(R, D.W);
  return { input, x: D.spec([L, R]) };
}

async function timeInfer(infer, win) {
  await infer(win); // calentamiento (compilación de sombreadores)
  const t0 = Date.now();
  const r = await infer(win);
  return { out: r, s: (Date.now() - t0) / 1000 };
}

// Sondeo: la variante `gpu` en `provider` contra la misma en CPU. rt = segundos de audio / segundos de cálculo.
async function probe({ model, provider }) {
  const win = probeWindow();
  try {
    const dev = await timeInfer(await makeInfer(model, provider, 'gpu'), win);
    const cpu = await timeInfer(await makeInfer(model, 'cpu', 'gpu'), win);
    const n = 4 * 2 * D.W;
    let e = 0;
    let d = 0;
    for (let i = 0; i < n; i++) { const a = cpu.out.time[i]; const b = dev.out.time[i]; e += a * a; d += (a - b) * (a - b); }
    send({ type: 'probe', ok: true, rt: D.W / D.SR / dev.s, cpuRt: D.W / D.SR / cpu.s, snr: 10 * Math.log10((e || 1e-30) / (d || 1e-30)) });
  } catch (err) {
    send({ type: 'probe', ok: false, error: err.message });
  }
}

function openEncoder(ffmpeg, out) {
  const p = spawn(ffmpeg, ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(D.SR), '-ac', '8', '-i', '-', '-c:a', 'flac', '-sample_fmt', 's16', '-f', 'flac', out], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (b) => (err += b));
  const done = new Promise((resolve, reject) => {
    p.on('error', (e) => reject(new Fail('salida', `No se pudo ejecutar ffmpeg: ${e.message}`)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Fail('salida', `No se pudo escribir el archivo de stems${err ? `: ${err.trim().slice(0, 120)}` : ''}`))));
    p.stdin.on('error', () => {}); // el error real llega por 'close'
  });
  const write = (f32) => new Promise((resolve) => {
    const b = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
    if (p.stdin.write(b)) resolve(); else p.stdin.once('drain', resolve);
  });
  return { write, end: () => p.stdin.end(), done, kill: () => p.kill('SIGKILL') };
}

async function run({ file, out, ffmpeg, model, maxSeconds, provider = 'cpu', variant = 'cpu' }) {
  const mix = await decode(file, ffmpeg, maxSeconds);
  if (cancelled) return;
  const infer = await makeInfer(model, provider, variant);
  const enc = openEncoder(ffmpeg, out);
  let finished = false;
  try {
    let wrote = Promise.resolve();
    const t0 = Date.now();
    const ok = await D.separate(mix, {
      infer,
      onChunk: (c) => { wrote = wrote.then(() => enc.write(c)); },
      onProgress: (p) => send({ type: 'progress', progress: p.progress, etaS: p.etaS, rssMB: Math.round(process.memoryUsage().rss / 1048576) }),
      shouldStop: () => cancelled,
      direct: variant === 'gpu',
    });
    await wrote;
    if (!ok) return;
    enc.end();
    await enc.done;
    finished = true;
    send({ type: 'done', bytes: fs.statSync(out).size, rt: mix[0].length / D.SR / Math.max(0.001, (Date.now() - t0) / 1000) });
  } finally {
    // cancelado o con error: el codificador debe haber terminado (y borrado lo parcial) antes de salir, o crearía el archivo después
    if (!finished) {
      enc.kill();
      await enc.done.catch(() => {});
      fs.rmSync(out, { force: true });
    }
  }
}

process.on('message', (m) => {
  if (m.type === 'cancel') cancelled = true;
  if (m.type === 'probe') probe(m).then(() => process.exit(0));
  if (m.type === 'start') {
    run(m).then(() => process.exit(0), (e) => {
      send({ type: 'error', code: e.code || 'desconocido', error: e.message });
      setTimeout(() => process.exit(1), 50);
    });
  }
});
