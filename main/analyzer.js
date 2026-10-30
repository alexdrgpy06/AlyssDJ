// Cola de análisis: yt-dlp → ffmpeg → análisis en worker → cache/<id>.json.
// Una pista a la vez para no competir con la reproducción en vivo.
'use strict';
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const ytdlp = require('./ytdlp');

class Analyzer {
  constructor({ cacheDir, settings, session, emit, ffmpeg }) {
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
      return { ...a, audio: audio ? path.basename(audio) : null };
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
    const wantsAudio = opts.file ? false : (opts.keepAudio ?? this.settings.get().keepAudio);
    if (existing && !opts.force && (!wantsAudio || existing.audio)) {
      this.emit({ id, stage: 'done', analysis: existing });
      return;
    }
    if (this.running?.id === id || this.queue.some((j) => j.id === id)) return;
    this.queue.push({ id, opts: { ...opts, keepAudio: wantsAudio } });
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
    const cookieFile = path.join(this.cacheDir, '..', 'cookies.txt');
    let file = local ? opts.file : this.audioFile(id);
    if (!file) {
      const tool = await ytdlp.findYtdlp(s.ytdlpPath);
      if (!tool) throw new Error('yt-dlp no está instalado todavía. AlyssDJ lo descarga solo al abrirse; reintenta en unos segundos o usa Ajustes → Instalar herramientas.');
      if (s.cookieSource === 'app') await ytdlp.exportCookies(this.session, cookieFile);
      this.emit({ id, stage: 'download', progress: 0 });
      file = await ytdlp.download({
        bin: tool.bin,
        videoId: id,
        outDir: this.cacheDir,
        extraArgs: ytdlp.cookieArgs(s, cookieFile),
        onProgress: (p) => this.emit({ id, stage: 'download', progress: p }),
      });
    }
    fs.rmSync(cookieFile, { force: true });
    this.running.stage = 'analyze';
    this.emit({ id, stage: 'analyze' });
    const result = await new Promise((resolve, reject) => {
      const w = new Worker(path.join(__dirname, 'analysis-worker.js'), { workerData: { file, ffmpeg: this.ffmpeg() } });
      w.once('message', (m) => (m.ok ? resolve(m.result) : reject(new Error(m.error))));
      w.once('error', reject);
    });
    const prev = this.get(id);
    const record = {
      ...result,
      id,
      ...(opts.meta || {}),
      gridShift: prev?.gridShift || 0,
      format: path.extname(file).slice(1),
      local,
      analyzedAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.jsonPath(id), JSON.stringify(record));
    if (!local && !opts.keepAudio) fs.rmSync(file, { force: true });
    return this.get(id);
  }

  removeAudio(id) {
    const f = this.audioFile(id);
    if (f) fs.rmSync(f, { force: true });
  }
}

module.exports = { Analyzer };
