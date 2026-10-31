// Autoprueba de la app EMPAQUETADA: descarga sola yt-dlp y ffmpeg a la carpeta de datos y analiza una pista local
// (con el hilo de análisis incluido en el paquete). Todo en silencio.
const fs = require('fs'); const path = require('path');
const { app } = require('electron');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = { packaged: app.isPackaged, userData: app.getPath('userData') };
    await wait(2500);
    await js(`__app.masterGain = 0; return 1`);
    // las herramientas se bajan solas a la carpeta de datos del usuario
    for (let i = 0; i < 240; i++) {
      res.tools = await js(`return await window.ytdj.tools.check()`);
      if (res.tools?.ytdlp && res.tools?.ffmpeg) break;
      await wait(1000);
    }
    const f = path.join(process.env.YTDJ_DOCS_MUSIC, 'Neon Drive.mp3');
    const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(f)})).data`);
    await js(`window.ytdj.analysis.request(${JSON.stringify(row.videoId)}, { meta: { title: ${JSON.stringify(row.title)} }, file: ${JSON.stringify(row.path)} }); return 1`);
    for (let i = 0; i < 90; i++) {
      res.analysis = await js(`const a = await window.ytdj.analysis.get(${JSON.stringify(row.videoId)}); return a && { bpm: a.bpm, key: a.camelot, mix: !!a.mix, wave: !!a.waveform }`);
      if (res.analysis) break;
      await wait(1000);
    }
    res.ui = await js(`return { decks: !!__app.decks.A && !!__app.decks.B, title: document.title, scripts: [...document.scripts].length }`);
    fs.writeFileSync(path.join(out, 'packaged.json'), JSON.stringify(res));
    win.close();
  });
};
