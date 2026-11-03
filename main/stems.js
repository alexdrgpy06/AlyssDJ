'use strict';
// Almacén de stems: una pista a la vez, en un proceso hijo de baja prioridad, con cancelación y límites.
// Guarda `userData/stems/<id>.flac` (8 canales: batería, bajo, resto, voz) y un índice `index.json`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { fork } = require('child_process');

const MAX_SECONDS = 15 * 60; // más largo no se separa
const MAX_RSS_MB = 2048; // el hijo se mata si lo supera (el diseño apunta a ~1 GB)

const MODEL = {
  name: 'HTDemucs (ONNX)',
  url: 'https://huggingface.co/gridshiftstudio/htdemucs-ort/resolve/main/htdemucs.ort',
  bytes: 209884896,
  sha256: '09dc165512d8ef7480bcb2cacea9dda82d571f8dbf421d8c44a2ca5568bec729',
  license: 'Apache-2.0',
};

// ¿Puede esta instalación separar? Comprueba que onnxruntime-node trae el binario de esta plataforma (no hay para Mac Intel).
function available(root = path.join(__dirname, '..'), platform = process.platform, arch = process.arch) {
  const bin = path.join(root, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', platform, arch);
  if (fs.existsSync(bin)) return { available: true };
  const hasPkg = fs.existsSync(path.join(root, 'node_modules', 'onnxruntime-node', 'package.json'));
  return { available: false, why: hasPkg ? `Stems no está disponible en este equipo (${platform} ${arch})` : 'Stems no está disponible: falta el motor de separación' };
}

// Modelo bajo demanda: pide permiso, descarga a `.part`, verifica el SHA-256 y renombra. Una descarga a la vez.
class ModelManager {
  // opts: dir, confirm(info) → Promise<boolean>, onEvent(ev), spec (por defecto MODEL), fetch (para pruebas)
  constructor(opts) {
    this.o = opts;
    this.spec = opts.spec || MODEL;
    this.file = path.join(opts.dir, 'htdemucs.ort');
    this.pending = null;
  }

  path() { return this.file; }
  present() { try { return fs.statSync(this.file).size === this.spec.bytes; } catch { return false; } }
  status() { return { present: this.present(), bytes: this.spec.bytes }; }

  ensure() {
    if (this.present()) return Promise.resolve(this.file);
    if (!this.pending) this.pending = this.download().finally(() => { this.pending = null; });
    return this.pending;
  }

  async download() {
    const { spec } = this;
    const fail = (message) => Object.assign(new Error(message), { code: 'modelo' });
    const ok = await this.o.confirm({ name: spec.name, url: spec.url, bytes: spec.bytes, license: spec.license });
    if (!ok) throw fail('Descarga del modelo no autorizada');
    fs.mkdirSync(this.o.dir, { recursive: true });
    const part = `${this.file}.part`;
    const emit = (progress) => this.o.onEvent?.({ stage: 'model', progress });
    try {
      emit(0);
      const res = await (this.o.fetch || fetch)(spec.url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw fail(`No se pudo descargar el modelo (HTTP ${res.status})`);
      const hash = crypto.createHash('sha256');
      const out = fs.createWriteStream(part);
      let got = 0;
      let last = 0;
      for await (const chunk of res.body) {
        hash.update(chunk);
        got += chunk.length;
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
        if (got - last > 2 * 1024 * 1024) { last = got; emit(Math.min(0.99, got / spec.bytes)); }
      }
      await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
      if (got !== spec.bytes || hash.digest('hex') !== spec.sha256) throw fail('El modelo descargado no coincide con el esperado (SHA-256); se descartó');
      fs.renameSync(part, this.file);
      emit(1);
      return this.file;
    } catch (e) {
      fs.rmSync(part, { force: true });
      throw e.code ? e : fail(`No se pudo descargar el modelo: ${e.message}`);
    }
  }

  remove() { fs.rmSync(this.file, { force: true }); }
}

class StemStore {
  // opts: dir, ffmpeg() → ruta, modelPath() → ruta, ensureModel?() → Promise<ruta> (descarga con permiso), onEvent(ev),
  //       maxSeconds, maxRssMB, workerEnv (para pruebas)
  constructor(opts) {
    this.o = opts;
    this.dir = opts.dir;
    this.queue = [];
    this.cur = null; // { id, child, cancelled }
    this.index = {};
    fs.mkdirSync(this.dir, { recursive: true });
    try { this.index = JSON.parse(fs.readFileSync(this.indexFile(), 'utf8')); } catch { this.index = {}; }
    for (const id of Object.keys(this.index)) if (!fs.existsSync(this.fileOf(id))) delete this.index[id];
    for (const f of fs.readdirSync(this.dir)) if (f.endsWith('.part')) fs.rmSync(path.join(this.dir, f), { force: true }); // restos de un cierre brusco
  }

  indexFile() { return path.join(this.dir, 'index.json'); }
  safe(id) { return String(id).replace(/[^\w.-]/g, '_'); }
  fileOf(id) { return path.join(this.dir, `${this.safe(id)}.flac`); }
  has(id) { return !!this.index[id]; }
  emit(ev) { try { this.o.onEvent?.(ev); } catch { /* el renderer puede haberse cerrado */ } }
  save() {
    const tmp = `${this.indexFile()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.index));
    fs.renameSync(tmp, this.indexFile());
  }

  list() { return Object.fromEntries(Object.entries(this.index).map(([id, v]) => [id, { bytes: v.bytes, at: v.at }])); }
  usage() { return Object.values(this.index).reduce((a, v) => a + (v.bytes || 0), 0); }
  busy(id) { return this.cur?.id === id || this.queue.some((q) => q.id === id); }

  // Encola una pista. `file`: ruta del audio local. Devuelve false si ya la tiene o ya está en cola.
  request(id, file) {
    if (this.has(id) || this.busy(id)) return false;
    this.queue.push({ id, file });
    this.emit({ id, stage: 'queued' });
    this.pump();
    return true;
  }

  cancel(id) {
    const qi = this.queue.findIndex((q) => q.id === id);
    if (qi >= 0) {
      this.queue.splice(qi, 1);
      this.emit({ id, stage: 'cancelled' });
      return true;
    }
    if (this.cur?.id === id) {
      this.cur.cancelled = true;
      try { this.cur.child.send({ type: 'cancel' }); } catch { /* ya terminó */ }
      const c = this.cur.child;
      setTimeout(() => c.exitCode == null && c.kill(), 2500).unref?.();
      return true;
    }
    return false;
  }

  remove(id) {
    if (!this.index[id]) return false;
    fs.rmSync(this.fileOf(id), { force: true });
    delete this.index[id];
    this.save();
    return true;
  }

  removeAll() {
    for (const id of Object.keys(this.index)) this.remove(id);
    return true;
  }

  async pump() {
    if (this.cur || !this.queue.length) return;
    const job = this.queue.shift();
    const cur = (this.cur = { id: job.id, child: null, cancelled: false });
    const part = `${this.fileOf(job.id)}.part`;
    const fail = (code, error) => {
      fs.rmSync(part, { force: true });
      setTimeout(() => fs.rmSync(part, { force: true }), 1500).unref?.(); // por si un codificador huérfano lo recrea al arrancar
      this.emit({ id: job.id, stage: cur.cancelled ? 'cancelled' : 'error', ...(cur.cancelled ? {} : { code, error }) });
    };
    try {
      const fake = (this.o.workerEnv || {}).YTDJ_STEMS_FAKE === '1' || (!!process.env.YTDJ_SELFTEST && process.env.YTDJ_STEMS_FAKE === '1');
      const model = fake ? '' : await (this.o.ensureModel ? this.o.ensureModel(job.id) : this.o.modelPath());
      if (!fake && !fs.existsSync(model)) throw Object.assign(new Error('Falta el modelo de separación'), { code: 'modelo' });
      if (cur.cancelled) return fail();
      const child = fork(path.join(__dirname, 'stems-worker.js'), [], { execArgv: [], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...(this.o.workerEnv || {}) }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
      cur.child = child;
      try { os.setPriority(child.pid, 10); } catch { /* sin permiso: sigue con la prioridad normal */ }
      let stderr = '';
      child.stderr.on('data', (b) => (stderr += b));
      const result = await new Promise((resolve) => {
        let settled = false;
        const end = (r) => { if (!settled) { settled = true; resolve(r); } };
        child.on('message', (m) => {
          if (m.type === 'progress') {
            if (m.rssMB > (this.o.maxRssMB || MAX_RSS_MB)) {
              // parada ordenada: el hijo cierra su codificador y borra lo parcial antes de salir (un kill dejaría un ffmpeg huérfano)
              if (!cur.overMemory) {
                cur.overMemory = true;
                try { child.send({ type: 'cancel' }); } catch { /* ya terminó */ }
                setTimeout(() => child.exitCode == null && child.kill('SIGKILL'), 2500).unref?.();
              }
              return;
            }
            if (cur.overMemory) return;
            this.emit({ id: job.id, stage: 'progress', progress: m.progress, etaS: m.etaS });
          } else if (m.type === 'done') end({ ok: true, bytes: m.bytes });
          else if (m.type === 'error') end({ code: m.code, error: m.error });
        });
        child.on('exit', (code) => end(cur.overMemory ? { code: 'memoria', error: 'La separación necesitaba demasiada memoria y se detuvo' } : { code: cur.cancelled ? 'cancelado' : 'cerrado', error: `El proceso de separación terminó (${code})${stderr ? `: ${stderr.trim().slice(-120)}` : ''}` }));
        child.send({ type: 'start', file: job.file, out: part, ffmpeg: this.o.ffmpeg(), model, maxSeconds: this.o.maxSeconds || MAX_SECONDS });
      });
      if (cur.cancelled) return fail();
      if (!result.ok) return fail(result.code, result.error);
      fs.renameSync(part, this.fileOf(job.id));
      this.index[job.id] = { bytes: result.bytes, at: Date.now() };
      this.save();
      this.emit({ id: job.id, stage: 'done', bytes: result.bytes });
    } catch (e) {
      fail(e.code || 'desconocido', e.message);
    } finally {
      this.cur = null;
      this.pump();
    }
  }
}

module.exports = { StemStore, ModelManager, MODEL, available, MAX_SECONDS, MAX_RSS_MB };
