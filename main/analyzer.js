// Cola de análisis: yt-dlp → ffmpeg → análisis en worker → cache/<id>.json.
// Una pista a la vez para no competir con la reproducción en vivo.
'use strict';
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const ytdlp = require('./ytdlp');
const L = require('./library-save');

class Analyzer {
  constructor({ cacheDir, settings, session, emit, ffmpeg, localLib, libraryDir }) {
    this.localLib = localLib;
    this.libraryDir = libraryDir || (() => path.join(cacheDir, 'saved'));
    this.ffmpeg = ffmpeg || (() => 'ffmpeg');
    this.cacheDir = cacheDir;
    this.settings = settings;
    this.session = session;
    this.emit = emit;
    this.queue = [];
    this.running = null;
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  jsonPath(id) {
    return path.join(this.cacheDir, `${id}.json`);
  }

  audioFile(id) {
    const f = fs.readdirSync(this.cacheDir).find((n) => n.startsWith(id + '.') && !n.endsWith('.json') && !n.endsWith('.part'));
    return f ? path.join(this.cacheDir, f) : null;
  }

  get(id) {
    try {
      const a = JSON.parse(fs.readFileSync(this.jsonPath(id), 'utf8'));
      const audio = this.audioFile(id);
      const saved = a.saved && fs.existsSync(a.saved.path) ? a.saved : undefined; // si el usuario borró el archivo, deja de contar como guardada
      return { ...a, saved, audio: audio ? path.basename(audio) : null };
    } catch {
      return null;
    }
  }

  list() {
    return fs
      .readdirSync(this.cacheDir)
      .filter((n) => n.endsWith('.json'))
      .map((n) => {
        const a = this.get(n.slice(0, -5));
        if (!a) return null;
        const { waveform, ...rest } = a;
        return rest;
      })
      .filter(Boolean);
  }

  setMeta(id, patch) {
    const a = this.get(id);
    if (!a) return null;
    const { audio, ...rest } = a;
    fs.writeFileSync(this.jsonPath(id), JSON.stringify({ ...rest, ...patch }));
    return this.get(id);
  }

  status(id) {
    if (this.running?.id === id) return this.running.stage;
    return this.queue.some((j) => j.id === id) ? 'queued' : null;
  }

  // opts: { meta: {title, artist, thumb}, force, keepAudio }
  request(id, opts = {}) {
    const existing = this.get(id);
    const s = this.settings.get();
    const save = L.wantsSave(s, opts);
    const keep = opts.file ? false : (opts.keepAudio ?? s.keepAudio);
    const needsAudio = save || keep;
    const have = existing && !opts.force && (!needsAudio || existing.saved || (!save && existing.audio));
    if (have) {
      this.emit({ id, stage: 'done', analysis: existing });
      return;
    }
    if (this.running?.id === id || this.queue.some((j) => j.id === id)) return;
    this.queue.push({ id, opts: { ...opts, save, keepAudio: keep } });
    this.emit({ id, stage: 'queued' });
    this.pump();
  }

  cancel(id) {
    this.queue = this.queue.filter((j) => j.id !== id);
    this.emit({ id, stage: 'cancelled' });
  }

  async pump() {
    if (this.running || !this.queue.length) return;
    const job = this.queue.shift();
    this.running = { id: job.id, stage: 'download' };
    try {
      const analysis = await this.run(job);
      this.emit({ id: job.id, stage: 'done', analysis });
    } catch (e) {
      this.emit({ id: job.id, stage: 'error', error: e.message });
    } finally {
      this.running = null;
      this.pump();
    }
  }

  async run({ id, opts }) {
    const s = this.settings.get();
    const local = !!opts.file; // archivo del disco: se analiza donde está, sin bajar ni borrar nada
    const save = !!opts.save && !local;
    const libDir = this.libraryDir();
    let thumb = null;
    const reuse = opts.reuse || null; // recalcular el análisis de un archivo ya guardado, sin descargar
    let file = local ? opts.file : reuse ? reuse : save ? L.findSaved(libDir, id) : this.audioFile(id);
    if (!file) {
      const tool = await ytdlp.findYtdlp(s.ytdlpPath);
      if (!tool) throw new Error('yt-dlp no está instalado todavía. AlyssDJ lo descarga solo al abrirse; reintenta en unos segundos o usa Ajustes → Instalar herramientas.');
      this.emit({ id, stage: 'download', progress: 0 });
      const onProgress = (p) => this.emit({ id, stage: 'download', progress: p });
      const common = { bin: tool.bin, videoId: id, extraArgs: ytdlp.cookieArgs(s), onProgress };
      if (save) ({ file, thumb } = await ytdlp.withFormatRetry((format) => ytdlp.downloadToLibrary({ ...common, dir: libDir, format })));
      else file = await ytdlp.withFormatRetry((format) => ytdlp.download({ ...common, outDir: this.cacheDir, format }));
    }
    this.running.stage = 'analyze';
    this.emit({ id, stage: 'analyze' });
    const result = await new Promise((resolve, reject) => {
      const w = new Worker(path.join(__dirname, 'analysis-worker.js'), { workerData: { file, ffmpeg: this.ffmpeg() } });
      w.once('message', (m) => (m.ok ? resolve(m.result) : reject(new Error(m.error))));
      w.once('error', reject);
    });
    const prev = this.get(id);
    let record = {
      ...result,
      id,
      ...(opts.meta || {}),
      gridShift: prev?.gridShift || 0,
      format: path.extname(file).slice(1),
      local,
      analyzedAt: new Date().toISOString(),
    };
    if (save) {
      const row = await this.registerSaved({ id, file, thumb, record });
      record = { ...record, saved: { path: file, localId: row.videoId } };
    } else if (reuse && prev?.saved) {
      // Mismo archivo, análisis nuevo: se conserva el vínculo con la copia local y se actualiza también su registro.
      record = { ...record, saved: prev.saved };
      const lid = prev.saved.localId;
      const old = this.get(lid) || {};
      fs.writeFileSync(this.jsonPath(lid), JSON.stringify({ ...record, id: lid, local: true, ytId: id, title: old.title || record.title, artist: old.artist || record.artist, thumb: old.thumb || record.thumb, trackDuration: old.trackDuration, saved: undefined }));
    }
    fs.writeFileSync(this.jsonPath(id), JSON.stringify(record));
    if (!local && !save && !reuse && !opts.keepAudio) fs.rmSync(file, { force: true }); // nunca se borra un archivo guardado
    return this.get(id);
  }

  // El archivo guardado entra al índice local (con etiquetas y carátula) y recibe una copia del análisis,
  // así la pista local no se vuelve a analizar y no se duplica si ya estaba.
  async registerSaved({ id, file, thumb, record }) {
    if (!this.localLib) throw new Error('La librería local no está disponible');
    const row = await this.localLib.register(file);
    if (thumb) this.localLib.setCover(row.videoId, thumb);
    const lrow = this.localLib.row(this.localLib.index.get(row.videoId));
    fs.writeFileSync(
      this.jsonPath(row.videoId),
      JSON.stringify({ ...record, id: row.videoId, local: true, ytId: id, title: lrow.title || record.title, artist: lrow.artist || record.artist, thumb: lrow.thumb || record.thumb, trackDuration: lrow.duration, saved: undefined }),
    );
    return lrow;
  }

  removeAudio(id) {
    const f = this.audioFile(id);
    if (f) fs.rmSync(f, { force: true });
  }
}

module.exports = { Analyzer };
