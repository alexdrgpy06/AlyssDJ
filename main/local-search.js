'use strict';
// Búsqueda sobre todo lo que hay en el equipo: música local, análisis guardados, playlists importadas y géneros.
// Sin red y sin rutas: cada resultado se identifica por id. Los datos entran por `build(items)`; main los reúne.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const parseKey = (c) => {
  const m = /^(\d{1,2})([AB])$/.exec(c || '');
  return m ? { n: Number(m[1]), l: m[2] } : null;
};
// Misma regla que renderer/camelot.js (la prueba comprueba que no se separen).
function keysCompatible(a, b) {
  const x = parseKey(a);
  const y = parseKey(b);
  if (!x || !y) return false;
  if (x.n === y.n) return true;
  const d = Math.abs(x.n - y.n);
  return x.l === y.l && (d === 1 || d === 11);
}

const PUBLIC = ['videoId', 'title', 'artist', 'album', 'duration', 'thumb', 'local', 'bpm', 'camelot', 'genres', 'sources'];

class LocalSearch {
  constructor() {
    this.items = [];
    this.byId = new Map();
  }

  // items: [{ videoId, title, artist, album, duration, thumb, local, bpm, camelot, genres: [], source }]. Una misma videoId
  // de varias fuentes se fusiona: gana el dato presente y se acumulan las etiquetas de fuente.
  build(items) {
    const map = new Map();
    for (const it of items) {
      if (!it?.videoId) continue;
      const cur = map.get(it.videoId);
      if (!cur) {
        map.set(it.videoId, { ...it, genres: [...(it.genres || [])], sources: it.source ? [it.source] : [] });
        continue;
      }
      for (const k of ['title', 'artist', 'album', 'thumb', 'duration', 'bpm', 'camelot']) if (!cur[k] && it[k]) cur[k] = it[k];
      cur.local = cur.local || it.local;
      for (const g of it.genres || []) if (!cur.genres.includes(g)) cur.genres.push(g);
      if (it.source && !cur.sources.includes(it.source)) cur.sources.push(it.source);
    }
    this.items = [...map.values()].map((e) => ({ e, hay: norm(`${e.title} ${e.artist} ${e.album} ${e.genres.join(' ')}`), gset: new Set(e.genres.map(norm)) }));
    this.byId = new Map(this.items.map((x) => [x.e.videoId, x]));
    return this.items.length;
  }

  size() { return this.items.length; }

  pub(e) {
    const o = {};
    for (const k of PUBLIC) if (e[k] !== undefined && e[k] !== '') o[k] = e[k];
    return o;
  }

  // q: texto (vacío = todo con los filtros). filtros: bpm [min,max], key (exacta o compatible), genres (alguno), onlyLocal.
  search(q, { bpm, key, compatKey = false, genres, limit = 200 } = {}) {
    const t0 = process.hrtime.bigint();
    const words = norm(q).split(/\s+/).filter(Boolean);
    const gs = (genres || []).map(norm);
    const out = [];
    let total = 0;
    for (const x of this.items) {
      const e = x.e;
      if (words.length && !words.every((w) => x.hay.includes(w))) continue;
      if (bpm && (bpm[0] || bpm[1])) {
        if (!e.bpm) continue;
        if (bpm[0] && e.bpm < bpm[0]) continue;
        if (bpm[1] && e.bpm > bpm[1]) continue;
      }
      if (key && !(compatKey ? keysCompatible(e.camelot, key) : e.camelot === key)) continue;
      if (gs.length && !gs.some((g) => x.gset.has(g))) continue;
      total++;
      if (out.length < limit) out.push(e);
    }
    return { rows: out.map((e) => this.pub(e)), total, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  }

  // Pistas analizadas parecidas a `videoId` (BPM ±6 % también a mitad/doble y tonalidad compatible), de más a menos cercana.
  similar(videoId, limit = 10) {
    const s = this.byId.get(videoId)?.e;
    if (!s?.bpm || !s.camelot) return [];
    const cand = [];
    for (const { e } of this.items) {
      if (e.videoId === videoId || !e.bpm || !e.camelot || !keysCompatible(s.camelot, e.camelot)) continue;
      const d = Math.min(...[1, 0.5, 2].map((f) => Math.abs(s.bpm * f - e.bpm) / e.bpm));
      if (d > 0.06) continue;
      cand.push({ e, d: d + (e.camelot === s.camelot ? 0 : 0.01) });
    }
    return cand.sort((a, b) => a.d - b.d).slice(0, limit).map((c) => this.pub(c.e));
  }
}

module.exports = { LocalSearch, keysCompatible, norm };

// Reúne las cuatro fuentes en la lista plana que espera LocalSearch.build. Funciones puras: main aporta los datos.
//   localRows: filas de local-library; analyses: analyzer.list(); crates: playlists importadas; genreMap: { id: { genres: [] } }
function collect({ localRows = [], analyses = [], crates = [], genreMap = {} }) {
  const out = [];
  const gen = (id) => genreMap[id]?.genres || [];
  for (const r of localRows) out.push({ videoId: r.videoId, local: true, title: r.title, artist: r.artist, album: r.album, duration: r.duration, thumb: r.thumb, genres: gen(r.videoId), source: 'Mi equipo' });
  for (const a of analyses) {
    if (!a?.id) continue;
    out.push({
      videoId: a.id, local: !!a.local, title: a.title || '', artist: a.artist || '', duration: a.trackDuration || a.duration || 0,
      thumb: a.thumb || (a.local ? '' : `https://i.ytimg.com/vi/${a.id}/hqdefault.jpg`), bpm: a.bpm || undefined, camelot: a.camelot || undefined, genres: gen(a.id),
      source: a.saved ? 'Guardada' : 'Analizada',
    });
  }
  for (const c of crates) for (const t of c.tracks || []) out.push({ videoId: t.videoId, title: t.title, artist: t.artist, album: t.album, duration: t.duration, thumb: t.thumb, genres: gen(t.videoId), source: `Importada: ${c.title}` });
  return out;
}

module.exports.collect = collect;
