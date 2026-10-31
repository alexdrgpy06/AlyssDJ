// Lógica pura (sin Electron) de "guardar en la librería local": dónde se guarda, con qué argumentos de yt-dlp,
// cómo se encuentra lo ya guardado y cómo se limpian los parciales. La usan el analizador y las pruebas.
'use strict';
const fs = require('fs');
const path = require('path');

const AUDIO_EXT = new Set(['.m4a', '.opus', '.webm', '.mp3', '.ogg', '.aac', '.flac', '.mp4']);
const ID_RE = /^[\w-]{6,20}$/;

const defaultLibraryDir = (musicDir) => path.join(musicDir, 'AlyssDJ', 'YouTube');

// La carpeta de la librería de YouTube forma parte de las carpetas de música (sin duplicarse).
function withLibraryDir(musicDirs, libDir) {
  const dirs = Array.isArray(musicDirs) ? [...musicDirs] : [];
  if (libDir && !dirs.includes(libDir)) dirs.push(libDir);
  return dirs;
}

// ¿Hay que descargar para guardar? Sí si la opción está activa (o se pidió expresamente) y aún no está guardada.
function wantsSave(settings, opts = {}) {
  if (opts.file || opts.reuse) return false; // ya está en el disco: no se descarga
  if (opts.save != null) return !!opts.save;
  return settings.saveOnAnalyze !== false;
}

// Selección de formato: 'audio' = mejor audio por bitrate; 'any' = cualquier audio (aunque venga con video), para el reintento.
const formatArgs = (format = 'audio') => (format === 'any' ? ['-f', 'ba*/b'] : ['-f', 'bestaudio/best', '-S', 'abr,asr']);

// Argumentos de yt-dlp: mejor audio disponible, original sin convertir, etiquetas y carátula aparte.
function saveArgs(dir, format = 'audio') {
  return [
    ...formatArgs(format),
    '--no-playlist', '--no-overwrites', '--no-mtime',
    '--embed-metadata',
    '--write-thumbnail', '--convert-thumbnails', 'jpg',
    '-o', path.join(dir, '%(artist,creator,uploader)s - %(title).120B [%(id)s].%(ext)s'),
    '-o', `thumbnail:${path.join(dir, '.thumbs', '%(id)s.%(ext)s')}`,
  ];
}

function safeId(id) {
  if (!ID_RE.test(id)) throw new Error('Identificador de YouTube no válido');
  return id;
}

// Archivo de audio ya guardado para un id de YouTube (el id va entre corchetes en el nombre).
function findSaved(dir, id) {
  safeId(id);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const hit = names.find((n) => n.includes(`[${id}]`) && AUDIO_EXT.has(path.extname(n).toLowerCase()) && !n.endsWith('.part'));
  return hit ? path.join(dir, hit) : null;
}

function findThumb(dir, id) {
  const f = path.join(dir, '.thumbs', `${safeId(id)}.jpg`);
  return fs.existsSync(f) ? f : null;
}

// Tras un fallo no deben quedar parciales de ese id (ni .part, ni .ytdl, ni la miniatura suelta).
function cleanPartials(dir, id) {
  safeId(id);
  let n = 0;
  for (const d of [dir, path.join(dir, '.thumbs')]) {
    let names = [];
    try {
      names = fs.readdirSync(d);
    } catch {}
    for (const name of names) {
      const partial = name.endsWith('.part') || name.endsWith('.ytdl') || name.includes('.part-') || /\.f\d+\./.test(name);
      if ((name.includes(`[${id}]`) || name.startsWith(`${id}.`)) && (partial || d.endsWith('.thumbs'))) {
        fs.rmSync(path.join(d, name), { force: true });
        n++;
      }
    }
  }
  return n;
}

const FRIENDLY = [
  [/no space left|disk full|ENOSPC/i, 'No hay espacio en disco para guardar la pista. Libera espacio o cambia la carpeta de la librería en Ajustes.'],
  [/permission denied|EACCES|EROFS|read-only|ENOENT[^\n]*mkdir/i, 'No se puede escribir en la carpeta de la librería. Elige otra en Ajustes.'],
];
// Crea la carpeta solo si es realmente escribible. Comprueba antes el primer ancestro existente: un `mkdir -p`
// recursivo sobre rutas como /proc puede quedarse en bucle en el proceso principal y colgar toda la app.
function ensureWritableDir(dir) {
  const target = path.resolve(dir);
  if (/^\/(proc|sys|dev)(\/|$)/.test(target)) throw new Error(FRIENDLY[1][1]);
  let cur = target;
  while (!fs.existsSync(cur)) {
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  try {
    fs.accessSync(cur, fs.constants.W_OK);
  } catch {
    throw new Error(FRIENDLY[1][1]);
  }
  fs.mkdirSync(target, { recursive: true });
  return target;
}

const friendlyError = (text) => (FRIENDLY.find(([re]) => re.test(text)) || [])[1] || null;

module.exports = { ensureWritableDir, formatArgs, defaultLibraryDir, withLibraryDir, wantsSave, saveArgs, findSaved, findThumb, cleanPartials, friendlyError, safeId };
