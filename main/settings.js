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
  layoutMode: 'auto', // auto | compact | normal | wide
  pitchRange: 8,
  musicDirs: [],
  autoAnalyzeLocal: true,
  miniVideo: true,
  videoPref: false,
  recordSource: '',
  // Guardar en la librería local lo que se analiza o reproduce (el audio ya se descargó).
  saveOnAnalyze: true,
  saveOnPlay: true,
  libraryDir: '', // vacío = Música/AlyssDJ/YouTube
  // Guardar también el video de las pistas que lo tengan de verdad (no las de solo portada).
  saveVideo: true,
  videoMaxHeight: 1080, // 480 | 720 | 1080
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
