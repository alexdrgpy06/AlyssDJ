// Módulo de autoprueba de "guardar en la librería local" (lo carga scripts/test-save-library.js e2e).
// Descarga de verdad dos videos públicos de prueba de yt-dlp, sin cookies y en silencio.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const lib = process.env.YTDJ_SAVE_LIB;
  const shots = process.env.YTDJ_SAVE_SHOTS;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const res = { errors: [], steps: [] };
  const isErr = (e) => e.level === 'error' || e.level >= 3;
  wc.on('console-message', (e) => isErr(e) && res.errors.push(String(e.message).slice(0, 200)));
  const flush = (step) => { res.steps.push(`${new Date().toISOString().slice(11, 19)} ${step}`); fs.writeFileSync(path.join(out, 'save-library.json'), JSON.stringify(res, null, 2)); };
  const ZOO = 'jNQXAC9IVRw';
  const TEST = 'TOueemiIVYU';

  // Espera el evento "done" o "error" de un id.
  const waitFor = (id, ms = 150000) => js(`return await new Promise((resolve) => { const t = setTimeout(() => resolve({ stage: 'timeout' }), ${ms}); window.ytdj.analysis.onEvent((e) => { if (e.id === ${JSON.stringify(id)} && (e.stage === 'done' || e.stage === 'error')) { clearTimeout(t); resolve({ stage: e.stage, error: e.error, saved: e.analysis && e.analysis.saved, bpm: e.analysis && e.analysis.bpm }); } }); })`);
  const shot = async (name, sel, pad = 0) => {
    if (!shots) return;
    fs.mkdirSync(shots, { recursive: true });
    const r = await js(`const e=document.querySelector(${JSON.stringify(sel)}); const b=e.getBoundingClientRect(); return {x:Math.max(0,Math.floor(b.x-${pad})),y:Math.max(0,Math.floor(b.y-${pad})),width:Math.ceil(b.width+${pad * 2}),height:Math.ceil(b.height+${pad * 2})}`);
    fs.writeFileSync(path.join(shots, name), (await wc.capturePage(r)).toPNG());
  };

  wc.once('did-finish-load', async () => {
    try {
      await wait(2500);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
      await js(`await window.ytdj.settings.set({ cookieSource: 'none', saveOnAnalyze: true, saveOnPlay: true, libraryDir: ${JSON.stringify(lib)}, musicDirs: [] }); __app.settings = await window.ytdj.settings.get(); return 1`);
      flush('ajustes');
      res.musicDirs = (await js('return (await window.ytdj.settings.get()).musicDirs'));

      // REQ-1 + REQ-3: Analizar guarda el archivo y lo deja en la pestaña Local con etiquetas y carátula
      res.analyze = await (async () => {
        const p = waitFor(ZOO);
        await js(`window.ytdj.analysis.request(${JSON.stringify(ZOO)}, { meta: { title: 'Me at the zoo', artist: 'jawed', trackDuration: 19 } }); return 1`);
        return p;
      })();
      flush('analizar-hecho');
      res.files = fs.existsSync(lib) ? fs.readdirSync(lib).sort() : [];
      res.thumbsLeft = fs.existsSync(path.join(lib, '.thumbs')) ? fs.readdirSync(path.join(lib, '.thumbs')) : [];
      await js(`await __app.library.refreshAnalyzed(); await __app.library.show('local'); return 1`);
      await wait(3500);
      res.localRows = await js(`return __app.library.rows.map((r) => ({ title: r.title, artist: r.artist, thumb: r.thumb, duration: Math.round(r.duration), id: r.videoId }))`);
      const row = (res.localRows || []).find((r) => /zoo/i.test(r.title));
      res.localAnalysis = row ? await js(`return await window.ytdj.analysis.get(${JSON.stringify(row.id)})`).then((a) => a && { bpm: a.bpm, local: a.local, ytId: a.ytId }) : null;
      await shot('26-guardada-en-local.png', '.library');

      // REQ-4: cargar la pista de YouTube ya guardada reproduce el archivo (modo LOCAL), no el stream
      flush('local-listo');
      res.deckSaved = await js(`const d = __app.decks.A; await d.load({ videoId: ${JSON.stringify(ZOO)}, title: 'Me at the zoo', artist: 'jawed', thumb: '', duration: 19 }); await new Promise(r => setTimeout(r, 2500)); d.togglePlay(); await new Promise(r => setTimeout(r, 2000)); return { source: d.source, playing: d.st.playing, dur: Math.round(d.st.dur), state: d.el.state.textContent, localBtnEnabled: !d.el.srcBtns.find(b => b.dataset.src === 'local').disabled }`);

      // REQ-2: tras 30 s sonando por streaming se guarda en segundo plano
      res.play = await js(`
        const d = __app.decks.B;
        d.track = { videoId: ${JSON.stringify(TEST)}, title: 'youtube-dl test video', artist: '', thumb: '', duration: 10 };
        d.analysis = null; d.source = 'stream'; d.st = { ...d.st, playing: true, ad: false };
        d.saveRequested = false; d.streamPlayedMs = 0;
        d.tickSaveOnPlay(29000);
        const before = !!d.analyzing;
        window.__playDone = new Promise((resolve) => { const t = setTimeout(() => resolve({ stage: 'timeout' }), 150000); window.ytdj.analysis.onEvent((e) => { if (e.id === ${JSON.stringify(TEST)} && (e.stage === 'done' || e.stage === 'error')) { clearTimeout(t); resolve({ stage: e.stage, error: e.error, saved: !!(e.analysis && e.analysis.saved) }); } }); });
        d.tickSaveOnPlay(2000);
        return { requestedBefore30s: before, requestedAfter30s: !!d.analyzing };`);
      flush('guardado-por-reproduccion');
      res.playDone = await js('return await window.__playDone');
      res.files2 = fs.readdirSync(lib).filter((n) => !n.startsWith('.')).sort();

      // REQ-5: con "guardar lo que reproduzca" apagado no se pide nada
      flush('interruptor-apagado');
      res.playOff = await js(`__app.settings.saveOnPlay = false; const d = __app.decks.B; d.track = { videoId: 'zzzzzzzzzzz', title: 'x', artist: '', thumb: '', duration: 10 }; d.saveRequested = false; d.streamPlayedMs = 0; d.analyzing = null; d.tickSaveOnPlay(60000); const r = { requested: !!d.analyzing }; __app.settings.saveOnPlay = true; return r`);

      // REQ-6: carpeta no escribible → error comprensible y sin parciales; luego la cola sigue funcionando
      await shot('25-ajustes-guardar.png', 'body', 0).catch(() => {});
      await js(`await window.ytdj.settings.set({ libraryDir: '/proc/alyss-sin-permiso' }); return 1`);
      flush('carpeta-mala');
      res.badDir = await (async () => {
        const p = waitFor(ZOO, 60000);
        await js(`window.ytdj.analysis.request(${JSON.stringify(ZOO)}, { meta: { title: 'x' }, force: true, save: true }); return 1`);
        return p;
      })();
      await js(`await window.ytdj.settings.set({ libraryDir: ${JSON.stringify(lib)} }); return 1`);
      res.afterError = await (async () => {
        const p = waitFor(ZOO, 120000);
        await js(`window.ytdj.analysis.request(${JSON.stringify(ZOO)}, { meta: { title: 'x' }, force: true, save: true }); return 1`);
        return p;
      })();
      flush('cola-sigue');
      res.partials = fs.readdirSync(lib).filter((n) => n.endsWith('.part') || n.endsWith('.ytdl'));
    } catch (e) {
      res.error = e.stack.slice(0, 400);
    }
    fs.writeFileSync(path.join(out, 'save-library.json'), JSON.stringify(res, null, 2));
    win.close();
  });
};
