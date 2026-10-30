// Ajustes persistentes en userData/settings.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  ytdlpPath: '',
  ffmpegPath: '',
  // Fuente de cookies para yt-dlp: 'app' (sesión YT Music de esta app), 'firefox', 'chrome', 'chromium', 'none'.
  cookieSource: 'app',
  // Conservar el audio tras analizar (habilita reproducir el deck en modo LOCAL).
  keepAudio: false,
  // Analizar automáticamente al cargar una pista en un deck que no está al aire. Apagado por defecto.
  autoAnalyzeCue: false,
  output: { mode: 'split', masterLabel: '', cueLabel: '' },
  crossfaderCurve: 'smooth',
  pitchRange: 8,
  musicDirs: [],
  autoAnalyzeLocal: true,
  miniVideo: true,
  videoPref: false,
  recordSource: '',
};

let cache = null;
const file = () => path.join(app.getPath('userData'), 'settings.json');

function get() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function set(patch) {
  cache = { ...get(), ...patch };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  return cache;
}

module.exports = { get, set };
