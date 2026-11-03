// Autoprueba de la tarjeta «SIGUE» (entrada elegida, tira y edición) en la app real, en silencio.
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
      const reg = async (f) => js(`const r = await window.ytdj.local.register(${JSON.stringify(path.join(music, f))}); return r.ok ? { videoId: r.data.videoId, title: r.data.title, artist: r.data.artist, duration: r.data.duration, local: true, path: ${JSON.stringify(path.join(music, f))} } : r`);
      const A = await reg('Neon Drive.mp3'); const B = await reg('Night Pulse.mp3'); const C = await reg('Deep Signal.mp3');
      // analiza A y B (C se queda sin analizar)
      for (const r of [A, B]) await js(`window.ytdj.analysis.request(${JSON.stringify(r.videoId)}, { meta: { title: ${JSON.stringify(r.title)}, artist: ${JSON.stringify(r.artist)}, trackDuration: ${r.duration || 0} }, file: ${JSON.stringify(r.path)} }); return 1`);
      for (let i = 0; i < 400; i++) { const n = await js(`return (await window.ytdj.analysis.list()).filter((a) => a.bpm && [${JSON.stringify(A.videoId)}, ${JSON.stringify(B.videoId)}].includes(a.id)).length`); if (n >= 2) break; await wait(250); }
      R.ids = { A: A.videoId, B: B.videoId, C: C.videoId };
      await js(`await __app.library.refreshAnalyzed(); return 1`);
      // AutoMix: suena A, sigue B
      await js(`const am = __app.automix; am.setCfg({ len: 8, style: 'crossfade', endless: false, preferLocal: true, matchTempo: true }); await am.start({ tracks: [${JSON.stringify(A)}, ${JSON.stringify(B)}] }); __app.library.show('automix'); return 1`);
      const view = `const e = document.getElementById('amv-entry'); const cv = document.getElementById('amv-entry-strip'); const st = __app.automix.snapshot(); return { hidden: e.hidden, time: document.getElementById('amv-entry-time').textContent, why: document.getElementById('amv-entry-why').textContent, auto: !document.getElementById('amv-entry-auto').hidden, strip: !cv.hidden && cv.clientWidth > 40, aria: cv.getAttribute('aria-valuetext'), head: st.queue[0]?.videoId, entry: st.entry ? { t: st.entry.t, kind: st.entry.kind, bar: st.entry.bar, user: st.entry.user, dur: st.entry.duration, beat: st.entry.strip?.beat, offset: st.entry.strip?.offset, id: st.entry.id } : null, next: document.getElementById('amv-next').textContent }`;
      for (let i = 0; i < 120; i++) { const v = await js(view); if (v.entry?.id === B.videoId && v.entry.beat) break; await wait(500); }
      R.auto = await js(view);
      fs.writeFileSync(path.join(out, 'entrada-auto.png'), (await win.webContents.capturePage()).toPNG());
      // arrastrar la línea a la mitad de la tira: se guarda la entrada, ajustada a un compás
      const ptr = (type, frac) => js(`const cv = document.getElementById('amv-entry-strip'); const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('${type}', { clientX: r.left + r.width * ${frac}, clientY: r.top + 10, pointerId: 7, bubbles: true })); return 1`);
      await ptr('pointerdown', 0.5); await ptr('pointermove', 0.5); R.dragging = await js(`return document.getElementById('amv-entry-time').textContent`); await ptr('pointerup', 0.5); await wait(900);
      R.moved = await js(view);
      R.saved = await js(`return (await window.ytdj.analysis.get(${JSON.stringify(B.videoId)})).mixEdit || null`);
      fs.writeFileSync(path.join(out, 'entrada-user.png'), (await win.webContents.capturePage()).toPNG());
      // con el teclado: un compás a la derecha
      await js(`document.getElementById('amv-entry-strip').focus(); document.getElementById('amv-entry-strip').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return 1`); await wait(1200);
      R.key = { view: await js(view), saved: await js(`return (await window.ytdj.analysis.get(${JSON.stringify(B.videoId)})).mixEdit || null`) };
      // «Auto» devuelve el cálculo automático
      await js(`document.getElementById('amv-entry-auto').click(); return 1`); await wait(900);
      R.reset = { view: await js(view), saved: await js(`return (await window.ytdj.analysis.get(${JSON.stringify(B.videoId)})).mixEdit || null`) };
      // la que sigue sin analizar: entra por el inicio y lo dice
      await js(`const am = __app.automix; am.queue.length = 0; am.queue.push(${JSON.stringify(C)}); am.emit(); return 1`); await wait(1200);
      R.unanalyzed = await js(view);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'entrada.json'), JSON.stringify(R));
    win.close();
  });
};
