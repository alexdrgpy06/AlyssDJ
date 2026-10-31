// Descarga bajo demanda con yt-dlp. Nunca se llama sola: solo cuando el usuario pide "Analizar"
// (o activó "analizar al cargar en cue").
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tools = require('./tools');
const L = require('./library-save');
let managedDirs = [];
const setManagedDirs = (d) => (managedDirs = d);
const findYtdlp = (configured) => tools.findYtdlp(managedDirs, configured);

// yt-dlp va SIN sesión: las cookies de la cuenta son solo para el streaming de los decks.
// Con cookies, YouTube obliga a clientes web que hoy no entregan formatos de audio ("Requested format is not available").
// Solo si el usuario lo pide a mano (opción avanzada) se usan las de un navegador.
function cookieArgs(settings) {
  const src = settings?.cookieSource;
  return !src || src === 'none' || src === 'app' ? [] : ['--cookies-from-browser', src];
}

// yt-dlp necesita un runtime de JavaScript para algunos formatos: Node del sistema o, si no hay, Electron como Node.
function findNodeOnPath(env = process.env) {
  for (const dir of String(env.PATH || '').split(path.delimiter)) {
    const f = path.join(dir, process.platform === 'win32' ? 'node.exe' : 'node');
    try {
      fs.accessSync(f, fs.constants.X_OK);
      return f;
    } catch {}
  }
  return null;
}

function runtime(env = process.env) {
  const node = findNodeOnPath(env);
  if (node) return { args: ['--js-runtimes', `node:${node}`], env: {} };
  return { args: ['--js-runtimes', `node:${process.execPath}`], env: { ELECTRON_RUN_AS_NODE: '1' } };
}

const isFormatError = (msg) => /Requested format is not available/i.test(String(msg));
const FORMAT_ERROR = 'YouTube no entregó audio de esta pista sin sesión. Sigue sonando por streaming.';

// Ejecuta `run(formato)`; si YouTube dice "formato no disponible", un solo reintento con la selección más abierta.
async function withFormatRetry(run) {
  try {
    return await run('audio');
  } catch (e) {
    if (!isFormatError(e.message)) throw e;
    try {
      return await run('any');
    } catch (e2) {
      throw new Error(isFormatError(e2.message) ? FORMAT_ERROR : e2.message);
    }
  }
}

// Descarga el audio de un videoId. 141 = AAC 256k (solo Premium con cookies); si no, el mejor disponible.
function download({ bin, videoId, outDir, extraArgs, onProgress, format = 'audio' }) {
  return new Promise((resolve, reject) => {
    const args = [
      ...L.formatArgs(format),
      ...runtime().args,
      '--no-playlist', '--no-progress', '--newline', '--progress',
      '--progress-template', 'download:YTDJ %(progress._percent_str)s',
      '--print', 'after_move:YTDJFILE %(filepath)s',
      '-o', path.join(outDir, '%(id)s.%(ext)s'),
      ...extraArgs,
      `https://music.youtube.com/watch?v=${videoId}`,
    ];
    const p = spawn(bin, args, { env: { ...process.env, ...runtime().env } });
    let file = null;
    let err = '';
    const onLine = (line) => {
      const m = line.match(/YTDJ\s+([\d.]+)%/);
      if (m) onProgress?.(parseFloat(m[1]) / 100);
      const f = line.match(/^YTDJFILE (.+)$/);
      if (f) file = f[1].trim();
    };
    let buf = '';
    p.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(onLine);
    });
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      if (buf) onLine(buf);
      if (code === 0 && file) resolve(file);
      else reject(new Error(err.trim().split('\n').filter((l) => /ERROR|error/.test(l)).pop() || `yt-dlp salió con ${code}`));
    });
  });
}

// Descarga directo a la librería local: mejor audio disponible, original sin convertir, etiquetas incrustadas y
// carátula en .thumbs (el índice local la recoge). Si falla, no quedan parciales.
function downloadToLibrary({ bin, videoId, dir, extraArgs, onProgress, format = 'audio' }) {
  L.safeId(videoId);
  try {
    L.ensureWritableDir(path.join(dir, '.thumbs'));
  } catch (e) {
    return Promise.reject(new Error(L.friendlyError(`${e.code} ${e.message}`) || e.message));
  }
  return new Promise((resolve, reject) => {
    const args = [...L.saveArgs(dir, format), ...runtime().args, ...extraArgs, '--no-warnings', '--newline', '--progress', '--progress-template', 'download:YTDJ %(progress._percent_str)s', `https://music.youtube.com/watch?v=${videoId}`];
    const p = spawn(bin, args, { env: { ...process.env, ...runtime().env } });
    let err = '';
    let buf = '';
    const onLine = (line) => {
      const m = line.match(/YTDJ\s+([\d.]+)%/);
      if (m) onProgress?.(parseFloat(m[1]) / 100);
    };
    p.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(onLine);
    });
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      const file = L.findSaved(dir, videoId);
      if (file) return resolve({ file, thumb: L.findThumb(dir, videoId) });
      L.cleanPartials(dir, videoId);
      reject(new Error(L.friendlyError(err) || err.trim().split('\n').filter((l) => /ERROR/.test(l)).pop() || `yt-dlp salió con ${code}`));
    });
  });
}

module.exports = { findYtdlp, setManagedDirs, cookieArgs, runtime, isFormatError, withFormatRetry, FORMAT_ERROR, download, downloadToLibrary };
