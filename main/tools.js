// Herramientas externas que AlyssDJ necesita: yt-dlp (se descarga solo, binario oficial) y ffmpeg.
// Lo usan tanto scripts/setup.js (npm install) como la app al arrancar, así que no depende de Electron.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const ASSET = { linux: 'yt-dlp_linux', darwin: 'yt-dlp_macos', win32: 'yt-dlp.exe' }[process.platform];
const URL_LATEST = ASSET && `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ASSET}`;
const BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const STALE_DAYS = 14;

const probe = (bin, args = ['--version']) =>
  new Promise((resolve) => execFile(bin, args, { timeout: 15000 }, (err, out) => resolve(err ? null : String(out).split('\n')[0].trim())));

function download(url, dest, onProgress, redirects = 6) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'AlyssDJ-setup' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (!redirects) return reject(new Error('demasiadas redirecciones'));
          return resolve(download(new URL(res.headers.location, url).href, dest, onProgress, redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
        }
        const total = Number(res.headers['content-length']) || 0;
        let got = 0;
        const out = fs.createWriteStream(dest);
        res.on('data', (c) => {
          got += c.length;
          if (total) onProgress?.(got / total);
        });
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve(dest)));
        out.on('error', reject);
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

// Busca yt-dlp en las carpetas dadas (la propia del proyecto/app primero) y luego en el sistema.
async function findYtdlp(dirs = [], configured = '') {
  const candidates = [
    configured,
    ...dirs.map((d) => path.join(d, BIN_NAME)),
    'yt-dlp',
    path.join(process.env.HOME || '', '.local/bin/yt-dlp'),
  ].filter(Boolean);
  for (const bin of candidates) {
    if (path.isAbsolute(bin) && !fs.existsSync(bin)) continue;
    const version = await probe(bin);
    if (version) return { bin, version };
  }
  return null;
}

// Descarga el binario oficial de yt-dlp a `dir` si no hay ninguno utilizable. Devuelve { bin, version, installed }.
async function ensureYtdlp({ dirs, configured = '', onProgress, log = () => {} }) {
  const found = await findYtdlp(dirs, configured);
  if (found) return { ...found, installed: false };
  if (!URL_LATEST) throw new Error(`Plataforma sin binario oficial de yt-dlp: ${process.platform}`);
  let lastErr;
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, BIN_NAME);
      log(`Descargando yt-dlp → ${target}`);
      await download(URL_LATEST, target + '.part', onProgress);
      fs.renameSync(target + '.part', target);
      fs.chmodSync(target, 0o755);
      const version = await probe(target);
      if (!version) throw new Error('El binario descargado no se pudo ejecutar');
      return { bin: target, version, installed: true };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No se pudo instalar yt-dlp');
}

// yt-dlp se rompe cuando YouTube cambia: si el binario es el nuestro y tiene más de STALE_DAYS, se actualiza solo.
async function maybeUpdate(bin, dirs) {
  if (!dirs.some((d) => bin === path.join(d, BIN_NAME))) return null;
  const ageDays = (Date.now() - fs.statSync(bin).mtimeMs) / 864e5;
  if (ageDays < STALE_DAYS) return null;
  await new Promise((r) => execFile(bin, ['-U'], { timeout: 120000 }, () => r()));
  const now = new Date();
  fs.utimesSync(bin, now, now);
  return probe(bin);
}

// ffmpeg: el del sistema, el configurado o el que trae el paquete opcional ffmpeg-static.
async function findFfmpeg(configured = '') {
  const candidates = [configured, 'ffmpeg'].filter(Boolean);
  try {
    const p = require('ffmpeg-static');
    if (p) candidates.push(p);
  } catch {}
  for (const bin of candidates) {
    const v = await probe(bin, ['-version']);
    if (v) return { bin, version: v };
  }
  return null;
}

function installHint() {
  if (process.platform === 'linux') return 'Instálalo con tu gestor de paquetes (Arch/CachyOS: sudo pacman -S ffmpeg; Debian/Ubuntu: sudo apt install ffmpeg).';
  if (process.platform === 'darwin') return 'Instálalo con: brew install ffmpeg';
  return 'Instálalo con: winget install ffmpeg';
}

module.exports = { ensureYtdlp, findYtdlp, findFfmpeg, maybeUpdate, installHint, BIN_NAME };
