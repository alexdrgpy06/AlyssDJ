// Autoprueba de robustez de AutoMix: una pista que falla al cargar se descarta y la mezcla sigue, explicándolo en el estado.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT, music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const R = {};
    try {
      win.setContentSize(1280, 720); await wait(2500);
      await js(`__app.masterGain = 0; localStorage.clear(); return 1`);
      const reg = async (f) => js(`const r = await window.ytdj.local.register(${JSON.stringify(path.join(music, f))}); return r.ok ? { videoId: r.data.videoId, title: r.data.title, artist: r.data.artist, duration: r.data.duration, local: true } : r`);
      const A = await reg('Neon Drive.mp3'); const B = await reg('Night Pulse.mp3'); const C = await reg('Deep Signal.mp3');
      await js(`const am = __app.automix; am.setCfg({ len: 8, style: 'crossfade', endless: false, preferLocal: true }); await am.start({ tracks: [${JSON.stringify(A)}, ${JSON.stringify(B)}, ${JSON.stringify(C)}] }); __app.library.show('automix'); return 1`);
      await wait(1500);
      const snap = `const st = __app.automix.snapshot(); return { head: st.queue[0]?.title, n: st.queue.length, note: st.note, status: document.getElementById('amv-status').textContent, notes: document.getElementById('amv-note').textContent }`;
      R.before = await js(snap);
      // 1. el deck libre no pudo abrir el archivo de la cabeza
      await js(`const am = __app.automix; const next = __app.other(am.cur); next.loadError = 'archivo dañado'; am.tick(); return 1`); await wait(300);
      R.loadFail = await js(snap);
      // 2. fallo explícito de la cabeza (p. ej. se cortó la conexión): sigue con la siguiente
      await js(`const am = __app.automix; am.failHead(am.queue[0], 'sin conexión'); return 1`); await wait(300);
      R.netFail = await js(snap);
      // 3. si ya no hay otra, no se vacía: se queda y lo dice
      await js(`const am = __app.automix; am.failHead(am.queue[0], 'sin conexión'); return 1`); await wait(300);
      R.last = await js(snap);
      R.stillOn = await js(`return __app.automix.on`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'robust.json'), JSON.stringify(R));
    win.close();
  });
};
