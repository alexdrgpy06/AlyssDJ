// Exportar la librería a otros programas (M3U8, CSV, Rekordbox XML). Lógica pura, sin Electron: la usan main.js y las pruebas.
'use strict';
const fs = require('fs');
const path = require('path');

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Una pista lista para escribir. `rec` es el registro de análisis o la fila de una playlist; `ana` el análisis (si lo hay).
// `resolvePath(id, rec, ana)` devuelve la ruta del audio en el disco o ''.
function normalize(rec, ana, resolvePath, genreOf) {
  const a = ana || {};
  const id = rec.videoId || rec.id || a.id || '';
  const mix = a.mix && typeof a.mix === 'object' ? a.mix : null;
  const file = (resolvePath && resolvePath(id, rec, a)) || '';
  return {
    id,
    title: rec.title || a.title || '',
    artist: rec.artist || a.artist || '',
    duration: num(rec.duration) || num(a.trackDuration) || num(a.duration),
    bpm: num(a.bpm),
    offset: num(a.offset),
    key: a.key || '',
    camelot: a.camelot || '',
    genre: ((genreOf && genreOf(id)) || []).join(', '),
    path: file && fs.existsSync(file) ? file : '',
    mix: mix ? { mixIn: mix.mixIn, introEnd: mix.introEnd, outroStart: mix.outroStart } : null,
  };
}

const playable = (entries) => entries.filter((e) => e.path);
const clean = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ');

function toM3u8(entries) {
  const ok = playable(entries);
  const lines = ['#EXTM3U'];
  for (const e of ok) {
    lines.push(`#EXTINF:${Math.round(e.duration) || -1},${clean(e.artist ? `${e.artist} - ${e.title}` : e.title)}`, e.path);
  }
  return { text: lines.join('\n') + '\n', written: ok.length, skipped: entries.length - ok.length };
}

const COLS = ['título', 'artista', 'duración', 'BPM', 'tonalidad', 'Camelot', 'género', 'ruta', 'id'];
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(entries) {
  const rows = [COLS, ...entries.map((e) => [e.title, e.artist, Math.round(e.duration) || '', e.bpm ? e.bpm.toFixed(2) : '', e.key, e.camelot, e.genre || '', e.path, e.id])];
  return { text: '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n', written: entries.length, skipped: 0 };
}

// Escapa texto para XML 1.0 y quita los caracteres de control que no se admiten.
function esc(s) {
  return String(s ?? '')
    .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// file://localhost/ruta con cada segmento codificado (también rutas de Windows: C:\a\b → /C:/a/b).
function fileUri(p) {
  const norm = String(p).replace(/\\/g, '/');
  const parts = norm.split('/').map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)));
  return 'file://localhost' + (norm.startsWith('/') ? '' : '/') + parts.join('/');
}

const MARKS = [['mixIn', 'Mezcla'], ['introEnd', 'Intro'], ['outroStart', 'Salida']];

function toRekordbox(entries, name = 'AlyssDJ') {
  const ok = playable(entries);
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<DJ_PLAYLISTS Version="1.0.0">', '  <PRODUCT Name="AlyssDJ" Version="1.0" Company="AlystechPY"/>', `  <COLLECTION Entries="${ok.length}">`];
  ok.forEach((e, i) => {
    out.push(`    <TRACK TrackID="${i + 1}" Name="${esc(e.title)}" Artist="${esc(e.artist)}" TotalTime="${Math.round(e.duration)}" AverageBpm="${e.bpm.toFixed(2)}" Tonality="${esc(e.camelot)}"${e.genre ? ` Genre="${esc(e.genre)}"` : ''} Location="${esc(fileUri(e.path))}">`);
    if (e.bpm > 0) out.push(`      <TEMPO Inizio="${e.offset.toFixed(3)}" Bpm="${e.bpm.toFixed(2)}" Metro="4/4" Battito="1"/>`);
    let n = 0;
    for (const [k, label] of MARKS) {
      const t = e.mix?.[k];
      if (Number.isFinite(t) && t >= 0) out.push(`      <POSITION_MARK Name="${label}" Type="0" Start="${t.toFixed(3)}" Num="${n++}"/>`);
    }
    out.push('    </TRACK>');
  });
  out.push('  </COLLECTION>', '  <PLAYLISTS>', '    <NODE Type="0" Name="ROOT" Count="1">', `      <NODE Name="${esc(name)}" Type="1" KeyType="0" Entries="${ok.length}">`);
  ok.forEach((_, i) => out.push(`        <TRACK Key="${i + 1}"/>`));
  out.push('      </NODE>', '    </NODE>', '  </PLAYLISTS>', '</DJ_PLAYLISTS>');
  return { text: out.join('\n') + '\n', written: ok.length, skipped: entries.length - ok.length };
}

const FORMATS = {
  m3u8: { ext: 'm3u8', make: toM3u8, label: 'M3U8' },
  csv: { ext: 'csv', make: toCsv, label: 'CSV' },
  rekordbox: { ext: 'xml', make: toRekordbox, label: 'Rekordbox XML' },
};

const safeName = (s) => String(s || 'AlyssDJ').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || 'AlyssDJ';

// Escribe a un temporal y renombra: nunca deja un archivo a medias.
function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* no existía */ }
    throw e;
  }
}

module.exports = { normalize, toM3u8, toCsv, toRekordbox, esc, fileUri, writeAtomic, safeName, FORMATS };
