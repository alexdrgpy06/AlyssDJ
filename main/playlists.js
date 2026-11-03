'use strict';
// Playlists locales: listas manuales y listas inteligentes guardadas en `userData`. Lógica pura, sin Electron: la usan main.js y las pruebas.
// No toca nunca archivos de música; las pistas se guardan sin rutas (la ruta se resuelve al abrir la lista).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SORT_KEYS = ['title', 'artist', 'bpm', 'key', 'genre', 'dur'];
const clean = (t) => ({
  videoId: String(t.videoId || t.id || ''),
  title: String(t.title || ''),
  artist: String(t.artist || ''),
  duration: Number(t.duration) || 0,
  thumb: String(t.thumb || ''),
  ...(t.local ? { local: true } : {}),
});
const camelotNum = (c) => { const m = /^(\d{1,2})([AB])$/.exec(c || ''); return m ? Number(m[1]) * 2 + (m[2] === 'B' ? 1 : 0) : 999; };
const txt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

class PlaylistStore {
  // opts: { meta(id) → { bpm, camelot, genres }, smart(filter) → pistas, now() }
  constructor(file, opts = {}) {
    this.file = file;
    this.o = opts;
    this.lists = [];
    this.load();
  }

  load() {
    let raw;
    try { raw = fs.readFileSync(this.file, 'utf8'); } catch { return; }
    try {
      const j = JSON.parse(raw);
      if (!Array.isArray(j.lists)) throw new Error('formato');
      this.lists = j.lists;
    } catch {
      // Archivo dañado: se conserva una copia y se arranca vacío.
      try { fs.renameSync(this.file, `${this.file}.bad-${Date.now()}`); } catch { /* ya no está */ }
      this.lists = [];
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, lists: this.lists }));
    fs.renameSync(tmp, this.file);
  }

  now() { return (this.o.now || Date.now)(); }

  find(id) {
    const l = this.lists.find((x) => x.id === id);
    if (!l) throw new Error('Esa playlist ya no existe');
    return l;
  }

  manual(id) {
    const l = this.find(id);
    if (l.kind === 'smart') throw new Error('Una lista inteligente se arma sola: cambia sus filtros');
    return l;
  }

  tracksOf(l) { return l.kind === 'smart' ? (this.o.smart ? this.o.smart(l.filter || {}) : []).map(clean) : l.tracks; }

  summary(l) {
    const tr = this.tracksOf(l);
    return { id: l.id, name: l.name, kind: l.kind, count: tr.length, duration: tr.reduce((n, t) => n + (t.duration || 0), 0), updatedAt: l.updatedAt };
  }

  list() { return this.lists.map((l) => this.summary(l)); }

  get(id) {
    const l = this.find(id);
    return { id: l.id, name: l.name, kind: l.kind, tracks: this.tracksOf(l), sort: l.sort || null, filter: l.filter || null };
  }

  uniqueName(base) {
    const names = new Set(this.lists.map((l) => txt(l.name)));
    let n = base; let i = 2;
    while (names.has(txt(n))) n = `${base} ${i++}`;
    return n;
  }

  create(name, { kind = 'manual', filter = null, tracks = [] } = {}) {
    const nm = String(name || '').trim().slice(0, 80);
    if (!nm) throw new Error('Ponle un nombre a la playlist');
    const l = { id: `pl_${crypto.randomBytes(6).toString('hex')}`, name: this.uniqueName(nm), kind: kind === 'smart' ? 'smart' : 'manual', tracks: [], sort: null, filter: kind === 'smart' ? filter || {} : null, createdAt: this.now(), updatedAt: this.now() };
    if (l.kind === 'manual') {
      const seen = new Set();
      for (const t of tracks.map(clean)) if (t.videoId && !seen.has(t.videoId)) { seen.add(t.videoId); l.tracks.push(t); }
    }
    this.lists.push(l);
    this.save();
    return this.get(l.id);
  }

  rename(id, name) {
    const nm = String(name || '').trim().slice(0, 80);
    if (!nm) throw new Error('Ponle un nombre a la playlist');
    const l = this.find(id);
    l.name = this.lists.some((x) => x.id !== id && txt(x.name) === txt(nm)) ? this.uniqueName(nm) : nm;
    l.updatedAt = this.now();
    this.save();
    return this.get(id);
  }

  duplicate(id) {
    const l = this.find(id);
    const c = this.create(`${l.name} (copia)`, { kind: l.kind, filter: l.kind === 'smart' ? { ...l.filter } : null, tracks: l.tracks });
    if (l.sort) { this.find(c.id).sort = { ...l.sort }; this.save(); }
    return this.get(c.id);
  }

  delete(id) {
    this.find(id);
    this.lists = this.lists.filter((l) => l.id !== id);
    this.save();
    return true;
  }

  // Añade al final sin repetir la pista en la misma lista, salvo `allowDup`.
  add(id, tracks, { allowDup = false } = {}) {
    const l = this.manual(id);
    const have = new Set(l.tracks.map((t) => t.videoId));
    let added = 0; let skipped = 0;
    for (const raw of tracks || []) {
      const t = clean(raw);
      if (!t.videoId) continue;
      if (!allowDup && have.has(t.videoId)) { skipped++; continue; }
      l.tracks.push(t); have.add(t.videoId); added++;
    }
    if (added) { l.updatedAt = this.now(); this.save(); }
    return { added, skipped };
  }

  remove(id, videoIds) {
    const l = this.manual(id);
    const del = new Set(videoIds || []);
    const removed = [];
    l.tracks = l.tracks.filter((t, index) => (del.has(t.videoId) ? (removed.push({ index, track: t }), false) : true));
    if (removed.length) { l.updatedAt = this.now(); this.save(); }
    return { removed };
  }

  // Deshace `remove`: cada pista vuelve a su posición original (de menor a mayor índice).
  restore(id, removed) {
    const l = this.manual(id);
    let n = 0;
    const have = new Set(l.tracks.map((t) => t.videoId));
    for (const { index, track } of [...(removed || [])].sort((a, b) => a.index - b.index)) {
      const t = clean(track);
      if (!t.videoId || have.has(t.videoId)) continue;
      l.tracks.splice(Math.min(Math.max(0, index | 0), l.tracks.length), 0, t); have.add(t.videoId); n++;
    }
    if (n) { l.updatedAt = this.now(); this.save(); }
    return n;
  }

  // Orden manual: `videoIds` es el nuevo orden; las pistas que falten se quedan al final.
  reorder(id, videoIds) {
    const l = this.manual(id);
    const pos = new Map((videoIds || []).map((v, i) => [v, i]));
    const rest = l.tracks.filter((t) => !pos.has(t.videoId));
    l.tracks = [...l.tracks.filter((t) => pos.has(t.videoId)).sort((a, b) => pos.get(a.videoId) - pos.get(b.videoId)), ...rest];
    l.sort = null;
    l.updatedAt = this.now();
    this.save();
    return this.get(id);
  }

  sortBy(id, key, dir = 1) {
    if (!SORT_KEYS.includes(key)) throw new Error('Orden no válido');
    const l = this.manual(id);
    const d = dir < 0 ? -1 : 1;
    const meta = (t) => (this.o.meta ? this.o.meta(t.videoId) : null) || {};
    const val = {
      title: (t) => txt(t.title), artist: (t) => txt(t.artist), dur: (t) => t.duration || 0,
      bpm: (t) => meta(t).bpm || 0, key: (t) => camelotNum(meta(t).camelot), genre: (t) => txt((meta(t).genres || [])[0] || ''),
    }[key];
    const empty = (t) => (key === 'bpm' ? !meta(t).bpm : key === 'key' ? !meta(t).camelot : key === 'genre' ? !(meta(t).genres || []).length : false);
    // las que no tienen el dato van siempre al final, sea cual sea el sentido
    l.tracks = l.tracks.map((t, i) => ({ t, i, e: empty(t), v: val(t) })).sort((a, b) => (a.e - b.e) || (a.e ? 0 : (a.v < b.v ? -d : a.v > b.v ? d : 0)) || a.i - b.i).map((x) => x.t);
    l.sort = { k: key, dir: d };
    l.updatedAt = this.now();
    this.save();
    return this.get(id);
  }

  setFilter(id, filter) {
    const l = this.find(id);
    if (l.kind !== 'smart') throw new Error('Solo las listas inteligentes tienen filtros');
    l.filter = filter || {};
    l.updatedAt = this.now();
    this.save();
    return this.get(id);
  }

  // Copia una playlist importada de YouTube Music (`{ id, title, tracks }`) como lista local editable.
  fromCrate(crate, name) {
    if (!crate || !Array.isArray(crate.tracks)) throw new Error('Esa playlist ya no está importada');
    return this.create(name || crate.title || 'Importada', { tracks: crate.tracks });
  }
}

module.exports = { PlaylistStore, SORT_KEYS };
