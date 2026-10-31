// Música local: carpetas del disco y archivos sueltos. Índice persistente con título/artista/duración (vía ffmpeg).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const EXT = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.aiff', '.aif', '.wma', '.mp4', '.webm']);
const idFor = (p) => 'L' + crypto.createHash('sha1').update(p).digest('hex').slice(0, 15);

class LocalLibrary {
  constructor({ file, ffmpeg, emit, coversDir }) {
    this.coversDir = coversDir;
    if (coversDir) fs.mkdirSync(coversDir, { recursive: true });
    this.file = file;
    this.ffmpeg = ffmpeg; // () => ruta del binario
    this.emit = emit;
    this.index = new Map();
    this.queue = [];
    this.active = 0;
    try {
      for (const e of JSON.parse(fs.readFileSync(file, 'utf8'))) this.index.set(e.id, e);
    } catch {}
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(this.file, JSON.stringify([...this.index.values()]));
      } catch {}
    }, 500);
  }

  pathOf(id) {
    return this.index.get(id)?.path || null;
  }

  row(e) {
    return { videoId: e.id, local: true, path: e.path, title: e.title, artist: e.artist, album: e.album || '', duration: e.duration || 0, thumb: e.cover ? `/cover/${e.id}` : '' };
  }

  walk(dir, out, depth = 0) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) depth < 8 && this.walk(p, out, depth + 1);
      else if (EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
    }
  }

  // Añade/actualiza los archivos de las carpetas y lanza la lectura de etiquetas en segundo plano.
  scan(dirs) {
    const files = [];
    for (const d of dirs) this.walk(d, files);
    const seen = new Set();
    for (const p of files) {
      const id = idFor(p);
      seen.add(id);
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      const cur = this.index.get(id);
      if (cur && cur.mtime === st.mtimeMs && cur.probed) continue;
      const base = path.basename(p, path.extname(p));
      this.index.set(id, { id, path: p, title: base, artist: '', duration: 0, mtime: st.mtimeMs, probed: false, dir: path.dirname(p) });
      this.enqueue(id);
    }
    // Quita entradas de carpetas escaneadas cuyo archivo ya no existe.
    for (const [id, e] of this.index) {
      if (!seen.has(id) && dirs.some((d) => e.path.startsWith(d + path.sep)) && !fs.existsSync(e.path)) this.index.delete(id);
    }
    this.save();
    return files.length;
  }

  // Registra un archivo suelto (arrastrado a un deck) y espera a leer sus etiquetas para que el deck las muestre.
  async register(p) {
    const st = fs.statSync(p);
    if (!st.isFile() || !EXT.has(path.extname(p).toLowerCase())) throw new Error('Formato de audio no soportado');
    const id = idFor(p);
    let e = this.index.get(id);
    if (!e) {
      e = { id, path: p, title: path.basename(p, path.extname(p)), artist: '', duration: 0, mtime: st.mtimeMs, probed: false, dir: path.dirname(p), manual: true };
      this.index.set(id, e);
    }
    if (!e.probed) {
      try {
        Object.assign(e, await this.probe(p, id), { probed: true });
      } catch {
        e.probed = true;
      }
      this.save();
    }
    return this.row(e);
  }

  // Carátula externa (p. ej. la miniatura que bajó yt-dlp): se copia a la caché de carátulas y se borra el original.
  setCover(id, src) {
    const e = this.index.get(id);
    if (!e || !this.coversDir || !src || !fs.existsSync(src)) return false;
    fs.copyFileSync(src, path.join(this.coversDir, `${id}.jpg`));
    fs.rmSync(src, { force: true });
    e.cover = true;
    this.save();
    return true;
  }

  list(dirs) {
    return [...this.index.values()]
      .filter((e) => !dirs || dirs.some((d) => e.path.startsWith(d + path.sep)) || e.manual)
      .sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title, 'es', { sensitivity: 'base' }))
      .map((e) => this.row(e));
  }

  pending() {
    return this.queue.length + this.active;
  }

  enqueue(id) {
    this.queue.push(id);
    this.pump();
  }

  pump() {
    while (this.active < 4 && this.queue.length) {
      const id = this.queue.shift();
      const e = this.index.get(id);
      if (!e || e.probed) continue;
      this.active++;
      this.probe(e.path, e.id).then((meta) => {
        Object.assign(e, meta, { probed: true });
      }).catch(() => {
        e.probed = true;
      }).finally(() => {
        this.active--;
        if (!this.queue.length && !this.active) {
          this.save();
          this.emit({ done: true });
        }
        this.pump();
      });
    }
  }

  // ffmpeg -i imprime duración y etiquetas por stderr; así no hace falta ffprobe.
  probe(p, id) {
    return new Promise((resolve, reject) => {
      execFile(this.ffmpeg(), ['-hide_banner', '-i', p], { timeout: 20000 }, (_err, _out, stderr) => {
        const text = String(stderr || '');
        const dur = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!dur) return reject(new Error('sin duración'));
        const tag = (k) => (text.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, 'im')) || [])[1]?.trim() || '';
        const out = { duration: +dur[1] * 3600 + +dur[2] * 60 + parseFloat(dur[3]) };
        const title = tag('title');
        const artist = tag('artist') || tag('album_artist');
        if (title) out.title = title;
        out.artist = artist;
        out.album = tag('album');
        if (this.coversDir && /Stream #\d+:\d+[^\n]*Video:/.test(text)) {
          const img = path.join(this.coversDir, `${id}.jpg`);
          execFile(this.ffmpeg(), ['-v', 'error', '-y', '-i', p, '-an', '-frames:v', '1', '-vf', 'scale=360:-2', img], { timeout: 20000 }, (err) => {
            if (!err && fs.existsSync(img)) out.cover = true;
            resolve(out);
          });
        } else resolve(out);
      });
    });
  }
}

module.exports = { LocalLibrary, EXT };
