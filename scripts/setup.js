#!/usr/bin/env node
// Instala lo que AlyssDJ necesita y no trae npm: yt-dlp (binario oficial → ./bin) y comprueba ffmpeg.
// Se ejecuta solo en `npm install` (postinstall) y antes de `npm start`; con --soft nunca hace fallar la instalación.
'use strict';
const path = require('path');
const tools = require('../main/tools');

const soft = process.argv.includes('--soft');
const binDir = path.join(__dirname, '..', 'bin');
let lastPct = -1;

(async () => {
  let ok = true;
  try {
    const r = await tools.ensureYtdlp({
      dirs: [binDir],
      log: (m) => console.log(`[AlyssDJ] ${m}`),
      onProgress: (p) => {
        const pct = Math.floor(p * 10) * 10;
        if (pct !== lastPct) (lastPct = pct), process.stdout.write(`\r[AlyssDJ] yt-dlp ${pct}%   `);
      },
    });
    if (lastPct >= 0) process.stdout.write('\n');
    if (r.installed) console.log(`[AlyssDJ] yt-dlp ${r.version} instalado en ${r.bin}`);
  } catch (e) {
    ok = false;
    console.warn(`\n[AlyssDJ] No se pudo instalar yt-dlp (${e.message}). La app lo reintentará al abrirse; "Analizar" lo necesita.`);
  }

  try {
    const r = await tools.ensureFfmpeg({ dirs: [binDir], log: (m) => console.log(`[AlyssDJ] ${m}`) });
    if (r.installed) console.log(`[AlyssDJ] ffmpeg instalado en ${r.bin}`);
  } catch (e) {
    ok = false;
    console.warn(`[AlyssDJ] Falta ffmpeg (necesario para analizar y reproducir audio local). ${e.message}`);
  }
  process.exit(soft || ok ? 0 : 1);
})();
