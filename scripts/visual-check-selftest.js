// Autoprueba de la comprobación visual (la lanza scripts/visual-check.js): captura vistas fijas a 1280×720 con audio de demostración
// y las compara con docs/arquitectura/referencias dentro de Electron (nativeImage.toBitmap), sin dependencias nuevas.
// Todo con el volumen maestro en 0, sin reproducir, sin animaciones. Escribe visual-check.json y las capturas en YTDJ_SELFTEST_OUT.
'use strict';
const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

const CHANNEL = 8; // diferencia por canal (de 255) a partir de la cual un píxel cuenta como distinto
const LIMIT = 0.5; // % de píxeles distintos tolerado por captura

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const refs = process.env.YTDJ_VISUAL_REFS;
  const music = process.env.YTDJ_DOCS_MUSIC;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const result = { capturas: [], errores: [] };
  const done = () => fs.writeFileSync(path.join(out, 'visual-check.json'), JSON.stringify(result, null, 2));

  function compare(a, b) {
    const sa = a.getSize(), sb = b.getSize();
    if (sa.width !== sb.width || sa.height !== sb.height) return { pct: 100, motivo: `tamaño ${sa.width}×${sa.height} ≠ referencia ${sb.width}×${sb.height}` };
    const pa = a.toBitmap(), pb = b.toBitmap();
    let bad = 0;
    for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) > CHANNEL || Math.abs(pa[i + 1] - pb[i + 1]) > CHANNEL || Math.abs(pa[i + 2] - pb[i + 2]) > CHANNEL) bad++;
    return { pct: +((bad / (pa.length / 4)) * 100).toFixed(3) };
  }

  async function shot(name) {
    const img = await wc.capturePage();
    fs.writeFileSync(path.join(out, `${name}.png`), img.toPNG());
    const refFile = path.join(refs, `${name}.png`);
    const rec = { nombre: name };
    if (!fs.existsSync(refFile)) Object.assign(rec, { pct: null, motivo: 'sin referencia' });
    else Object.assign(rec, compare(img, nativeImage.createFromPath(refFile)));
    rec.ok = rec.pct !== null && rec.pct <= LIMIT;
    result.capturas.push(rec);
    console.log('[visual]', JSON.stringify(rec));
  }

  wc.once('did-finish-load', async () => {
    try {
      win.setContentSize(1280, 720);
      await wait(2000);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); __app.sampler.out.gain.value = 0;
        const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'; document.head.appendChild(s); return 1`);
      const files = ['Neon Drive', 'Sunset Groove', 'Night Pulse', 'Deep Signal'].map((n) => path.join(music, `${n}.mp3`));
      const rows = [];
      for (const f of files) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(f)})).data`));
      await js(`await window.ytdj.settings.set({ musicDirs: [${JSON.stringify(music)}], libraryDir: ${JSON.stringify(music)}, saveOnAnalyze: false, saveOnPlay: false }); for (const r of ${JSON.stringify(rows)}) window.ytdj.analysis.request(r.videoId, { meta: { title: r.title, artist: r.artist, thumb: r.thumb, trackDuration: r.duration }, file: r.path }); return 1`);
      await wait(12000);
      await js(`await __app.library.refreshAnalyzed(); __app.library.sort = { k: 'title', dir: 1 }; await __app.library.show('local'); return 1`);
      await js(`await __app.decks.A.load(${JSON.stringify(rows[0])}); await __app.decks.B.load(${JSON.stringify(rows[2])}); __app.decks.A.seek(40); __app.decks.B.seek(30); return 1`);
      await wait(1500);
      const view = async (v, extra = '') => { await js(`__app.setView('${v}'); __app.setWaves('top'); ${extra} return 1`); await wait(900); };
      await view('mix'); await shot('mezcla');
      await view('library'); await shot('libreria');
      await js(`__app.viz.getDecks = () => [{ id: 'A', level: 0.85, gain: 0.7, bpm: 124, offset: 0, playing: true, pos: 20.18 }, { id: 'B', level: 0.7, gain: 0.3, bpm: 126, offset: 0, playing: true, pos: 3.05 }]; return 1`);
      await view('automix', '__app.viz.stop(); __app.viz.drawFrame();'); await shot('automix');
      await view('waves'); await shot('ondas');
      await view('mix', `document.querySelector('#deck-A .deck-more').click();`); await shot('deck-menu');
      await js(`document.querySelector('#deck-A .deck-more').click(); document.getElementById('btn-settings').click(); return 1`);
      await wait(900);
      await js(`__app.setSettingsPane('general'); return 1`); await wait(300); await shot('ajustes');
    } catch (e) { result.errores.push(String(e.stack || e).slice(0, 400)); }
    done();
  });
};
