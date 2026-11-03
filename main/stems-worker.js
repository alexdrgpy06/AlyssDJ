'use strict';
// Proceso hijo de la separación de stems: decodifica la pista, ejecuta HTDemucs (ONNX) por ventanas y escribe un FLAC de
// 8 canales (batería, bajo, resto, voz; L y R de cada uno) por trozos. Se lanza con `child_process.fork` y habla por IPC.
//   padre → hijo:  { type: 'start', file, out, ffmpeg, model, maxSeconds }  |  { type: 'cancel' }
//   hijo → padre:  { type: 'progress', progress, etaS, rssMB } | { type: 'done', bytes } | { type: 'error', code, error }
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
async function makeInfer(model) {
  if (process.env.YTDJ_STEMS_FAKE === '1') {
    const slow = Number(process.env.YTDJ_STEMS_SLOW_MS) || 0; // las pruebas de interfaz necesitan ver el trabajo en curso
    return async ({ input }) => {
      await new Promise((r) => setTimeout(r, slow)); // como ORT, cede el turno al bucle de eventos (así llegan 'cancel' y el IPC)
      const time = new Float32Array(4 * 2 * D.W);
      for (let s = 0; s < 4; s++) for (let c = 0; c < 2; c++) for (let i = 0; i < D.W; i++) time[(s * 2 + c) * D.W + i] = input[c * D.W + i] * 0.25;
      return { time, freq: new Float32Array(4 * 4 * D.FQ * D.T) };
    };
  }
  let ort;
  try { ort = require('onnxruntime-node'); } catch (e) { throw new Fail('runtime', 'Falta el motor de stems (onnxruntime-node) en este equipo'); }
  let session;
  try {
    session = await ort.InferenceSession.create(model, { executionProviders: ['cpu'], graphOptimizationLevel: 'all', enableCpuMemArena: false, enableMemPattern: false, executionMode: 'sequential' });
  } catch (e) { throw new Fail('modelo', `No se pudo cargar el modelo: ${e.message}`); }
  return async ({ input, x }) => {
    const r = await session.run({ input: new ort.Tensor('float32', input, [1, 2, D.W]), x: new ort.Tensor('float32', x, [1, 4, D.FQ, D.T]) });
    return { time: r.add_67.data, freq: r.output.data };
  };
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

async function run({ file, out, ffmpeg, model, maxSeconds }) {
  const mix = await decode(file, ffmpeg, maxSeconds);
  if (cancelled) return;
  const infer = await makeInfer(model);
  const enc = openEncoder(ffmpeg, out);
  let finished = false;
  try {
    let wrote = Promise.resolve();
    const ok = await D.separate(mix, {
      infer,
      onChunk: (c) => { wrote = wrote.then(() => enc.write(c)); },
      onProgress: (p) => send({ type: 'progress', progress: p.progress, etaS: p.etaS, rssMB: Math.round(process.memoryUsage().rss / 1048576) }),
      shouldStop: () => cancelled,
    });
    await wrote;
    if (!ok) return;
    enc.end();
    await enc.done;
    finished = true;
    send({ type: 'done', bytes: fs.statSync(out).size });
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
  if (m.type === 'start') {
    run(m).then(() => process.exit(0), (e) => {
      send({ type: 'error', code: e.code || 'desconocido', error: e.message });
      setTimeout(() => process.exit(1), 50);
    });
  }
});
