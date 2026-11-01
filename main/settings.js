// Ajustes persistentes en userData/settings.json.
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  ytdlpPath: '',
  ffmpegPath: '',
  // yt-dlp va SIN sesión ('none'): las cookies de la cuenta son solo para el streaming de los decks.
  // Opción avanzada: 'firefox', 'chrome', 'chromium'… (solo para pistas que exijan sesión).
  cookieSource: 'none',
  // Conservar el audio tras analizar (habilita reproducir el deck en modo LOCAL).
  keepAudio: false,
  // Analizar automáticamente al cargar una pista en un deck que no está al aire. Apagado por defecto.
  autoAnalyzeCue: false,
  output: { mode: 'split', masterLabel: '', cueLabel: '' },
  crossfaderCurve: 'smooth',
  autoUpdate: true, // buscar versiones nuevas al arrancar y cada 6 h (solo app instalada)
  skipUpdate: '', // versión que el usuario eligió omitir
  layoutMode: 'auto', // auto | compact | normal | wide
  pitchRange: 8,
  musicDirs: [],
  autoAnalyzeLocal: true,
  recordSource: '',
  // Guardar en la librería local lo que se analiza o reproduce (el audio ya se descargó).
  saveOnAnalyze: true,
  saveOnPlay: true,
  // Las pistas de YouTube con copia guardada suenan desde el archivo (sin anuncios) en vez de por streaming.
  preferSaved: true,
  libraryDir: '', // vacío = Música/AlyssDJ/YouTube
};

let cache = null;
// YTDJ_SETTINGS_DIR permite usarlo fuera de Electron (pruebas).
const file = () => path.join(process.env.YTDJ_SETTINGS_DIR || require('electron').app.getPath('userData'), 'settings.json');

function get() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    cache = { ...DEFAULTS };
  }
  // El video se retiró: sus ajustes antiguos se ignoran (no se reescribe el archivo ni se tocan carpetas .video).
  for (const k of ['saveVideo', 'videoMaxHeight', 'videoPref']) delete cache[k];
  // Migración: antes yt-dlp recibía las cookies de la sesión de la app ('app'); ya no.
  if (cache.cookieSource === 'app') {
    cache.cookieSource = 'none';
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true });
      fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
    } catch {}
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
