// Descarga bajo demanda con yt-dlp. Nunca se llama sola: solo cuando el usuario pide "Analizar"
// (o activó "analizar al cargar en cue").
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tools = require('./tools');
let managedDirs = [];
const setManagedDirs = (d) => (managedDirs = d);
const findYtdlp = (configured) => tools.findYtdlp(managedDirs, configured);

// Exporta las cookies de la sesión de Electron (la del login de YT Music) a formato Netscape para yt-dlp.
async function exportCookies(session, file) {
  const all = [
    ...(await session.cookies.get({ domain: '.youtube.com' })),
    ...(await session.cookies.get({ domain: '.google.com' })),
  ];
  const lines = ['# Netscape HTTP Cookie File'];
  for (const c of all) {
    const bare = c.domain.replace(/^\./, '');
    const domain = c.hostOnly ? bare : '.' + bare;
    lines.push(
      [domain, domain.startsWith('.') ? 'TRUE' : 'FALSE', c.path || '/', c.secure ? 'TRUE' : 'FALSE',
        Math.round(c.expirationDate || 0), c.name, c.value].join('\t'),
    );
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', { mode: 0o600 });
  return all.length;
}

function cookieArgs(settings, cookieFile) {
  switch (settings.cookieSource) {
    case 'app':
      return ['--cookies', cookieFile];
    case 'none':
      return [];
    default:
      return ['--cookies-from-browser', settings.cookieSource];
  }
}

// Descarga el audio de un videoId. 141 = AAC 256k (solo Premium con cookies); si no, el mejor disponible.
function download({ bin, videoId, outDir, extraArgs, onProgress }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', '141/bestaudio[ext=m4a]/bestaudio',
      '--no-playlist', '--no-progress', '--newline', '--progress',
      '--progress-template', 'download:YTDJ %(progress._percent_str)s',
      '--print', 'after_move:YTDJFILE %(filepath)s',
      '-o', path.join(outDir, '%(id)s.%(ext)s'),
      ...extraArgs,
      `https://music.youtube.com/watch?v=${videoId}`,
    ];
    const p = spawn(bin, args);
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

module.exports = { findYtdlp, setManagedDirs, exportCookies, cookieArgs, download };
