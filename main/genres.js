// Géneros por pista: etiquetas de texto libre en userData/genres.json, aparte del análisis para que lo escrito a mano
// sobreviva a un reanálisis. Mapa id → { genres: string[], source: 'metadatos'|'archivo'|'manual' }. Lógica sin Electron.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const MAX = 5;
const SOURCES = ['metadatos', 'archivo', 'manual'];

// "house; deep HOUSE / tech-house" → ['House', 'Deep House', 'Tech-house']. Quita vacíos y repetidos y limita a 5.
function normalize(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').replace(/\bn\/a\b/gi, '').split(/[;/,|]+/);
  const out = [];
  for (const raw of list) {
    const t = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!t || /^(n\/a|na|none|unknown|desconocido)$/i.test(t)) continue;
    const g = t.toLowerCase().replace(/(^|[\s])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
    if (!out.some((x) => x.toLowerCase() === g.toLowerCase())) out.push(g);
    if (out.length >= MAX) break;
  }
  return out;
}

// Etiqueta «genre» del texto que imprime `ffmpeg -i` por stderr.
function tagFromFfmpeg(text) {
  const m = String(text || '').match(/^\s*genre\s*:\s*(.+)$/im);
  return m ? normalize(m[1].trim()) : [];
}

class GenreStore {
  constructor({ file, emit } = {}) {
    this.file = file;
    this.emit = emit || (() => {});
    this.map = new Map();
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const [id, v] of Object.entries(raw || {})) {
        const genres = normalize(v?.genres);
        if (genres.length) this.map.set(id, { genres, source: SOURCES.includes(v.source) ? v.source : 'manual' });
      }
    } catch {}
  }

  get(id) {
    return this.map.get(id) || null;
  }

  all() {
    const count = new Map();
    for (const v of this.map.values()) for (const g of v.genres) count.set(g, (count.get(g) || 0) + 1);
    const vocabulary = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([name, n]) => ({ name, n }));
    return { map: Object.fromEntries(this.map), vocabulary };
  }

  save() {
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map)));
    fs.renameSync(tmp, this.file);
  }

  // Lo escrito a mano manda. Lista vacía: quita lo manual y la pista vuelve a lo automático (si había).
  setManual(id, list) {
    const genres = normalize(list);
    if (!id) return null;
    if (genres.length) this.map.set(id, { genres, source: 'manual' });
    else this.map.delete(id);
    this.save();
    this.emit({ id, ...(this.map.get(id) || { genres: [], source: null }) });
    return this.get(id);
  }

  // Lectura automática: no pisa lo manual ni escribe si no hay nada.
  setAuto(id, list, source) {
    const genres = normalize(list);
    if (!id || !genres.length || this.map.get(id)?.source === 'manual') return false;
    const prev = this.map.get(id);
    if (prev && prev.source === source && prev.genres.join('|') === genres.join('|')) return false;
    this.map.set(id, { genres, source });
    this.save();
    this.emit({ id, genres, source });
    return true;
  }

  // Lee la etiqueta de un archivo con ffmpeg (sin ffprobe) y la guarda como automática.
  async autoFromFile(id, file, ffmpeg, source) {
    if (!id || !file) return false;
    const text = await new Promise((resolve) => execFile(ffmpeg || 'ffmpeg', ['-hide_banner', '-i', file], { timeout: 20000 }, (_e, _o, stderr) => resolve(String(stderr || ''))));
    return this.setAuto(id, tagFromFfmpeg(text), source);
  }
}

module.exports = { GenreStore, normalize, tagFromFfmpeg, MAX };
