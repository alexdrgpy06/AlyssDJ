// Autoprueba de «AutoMix claro» en la app real, en silencio: estado, línea de tiempo, perfiles y cola con compatibilidad.
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
      for (const r of [A, B]) await js(`window.ytdj.analysis.request(${JSON.stringify(r.videoId)}, { meta: { title: ${JSON.stringify(r.title)}, artist: ${JSON.stringify(r.artist)}, trackDuration: ${r.duration || 0} }, file: ${JSON.stringify(path.join(music, r === A ? 'Neon Drive.mp3' : 'Night Pulse.mp3'))} }); return 1`);
      for (let i = 0; i < 400; i++) { const n = await js(`return (await window.ytdj.analysis.list()).filter((a) => a.bpm && [${JSON.stringify(A.videoId)}, ${JSON.stringify(B.videoId)}].includes(a.id)).length`); if (n >= 2) break; await wait(500); }
      R.ids = { A: A.videoId, B: B.videoId, C: C.videoId };
      await js(`await __app.library.refreshAnalyzed(); return 1`);
      R.stopped = await js(`const e = document.getElementById('amv-status'); return { text: e.textContent, phase: e.dataset.phase }`);
      await js(`const am = __app.automix; am.setCfg({ len: 8, style: 'crossfade', endless: false, preferLocal: true, matchTempo: true }); await am.start({ tracks: [${JSON.stringify(A)}, ${JSON.stringify(B)}, ${JSON.stringify(C)}] }); __app.library.show('automix'); return 1`);
      const view = `const st = __app.automix.snapshot(); const e = document.getElementById('amv-status'); const tl = document.getElementById('amtl'); return { status: e.textContent, phase: e.dataset.phase, tlHidden: tl.hidden, info: document.getElementById('amtl-info').textContent, len: st.cfg.len, plan: st.plan && { exitAt: st.plan.exitAt, seconds: st.plan.seconds }, tl: st.timeline && { exitAt: st.timeline.exitAt, enterAt: st.timeline.enterAt, len: st.timeline.len, gestures: st.timeline.gestures.length, hasStrips: !!st.timeline.cur.strip && !!st.timeline.next.strip, canPreview: !!st.timeline.cur.url && !!st.timeline.next.url }, btn: { phase: document.getElementById('btn-automix').dataset.phase, count: document.getElementById('btn-automix-count').textContent, title: document.getElementById('btn-automix').title }, preview: { disabled: document.getElementById('amtl-preview').disabled, title: document.getElementById('amtl-preview').title } }`;
      for (let i = 0; i < 120; i++) { const v = await js(view); if (!v.tlHidden && v.tl?.hasStrips) break; await wait(500); }
      R.on = await js(view);
      fs.writeFileSync(path.join(out, 'claro-linea.png'), (await win.webContents.capturePage()).toPNG());
      // cola: B analizada, C sin analizar
      R.queue = await js(`return [...document.querySelectorAll('#amv-list .am-item')].map((li) => ({ cls: li.querySelector('.am-q').className, title: li.querySelector('.am-q').title, marks: [...li.querySelectorAll('.am-mark')].map((m) => m.textContent) }))`);
      // perfiles
      const prof = (v) => js(`document.querySelector('#amv-profile button[data-v="${v}"]').click(); await new Promise((r) => setTimeout(r, 300)); const st = __app.automix.snapshot(); return { cfg: { len: st.cfg.len, style: st.cfg.style, smartOrder: st.cfg.smartOrder, fxLevel: st.cfg.fxLevel }, on: [...document.querySelectorAll('#amv-profile button.on')].map((b) => b.dataset.v), saved: localStorage.getItem('automix-profile') }`);
      R.club = await prof('club'); R.soft = await prof('soft');
      await js(`__app.automix.setCfg({ len: 17 }); return 1`); await wait(300);
      R.custom = await js(`return [...document.querySelectorAll('#amv-profile button.on')].map((b) => b.dataset.v)`);
      await js(`__app.automix.setCfg({ len: 8, style: 'crossfade', fxLevel: 'off' }); return 1`); await wait(600);
      // línea de tiempo: arrastrar el final del solape (duración)
      const ptr = (type, x, y) => js(`const cv = document.getElementById('amtl-cv'); const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('${type}', { clientX: r.left + ${x}, clientY: r.top + ${y}, pointerId: 1, bubbles: true })); return 1`);
      const geo = (len) => js(`const cv = document.getElementById('amtl-cv'); const w = cv.getBoundingClientRect().width; const span = 20 + ${len} + 12; return { w, x0: 20 / span * w, x1: (20 + ${len}) / span * w, perSec: w / span }`);
      R.len0 = await js(`return __app.automix.snapshot().timeline.len`);
      const g0 = await geo(R.len0);
      await ptr('pointerdown', g0.x1, 40); await ptr('pointermove', g0.x1 + 4 * g0.perSec, 40);
      R.lenDrag = await js(`return document.getElementById('amtl-info').textContent`);
      await ptr('pointerup', g0.x1 + 4 * g0.perSec, 40); await wait(600);
      R.len = await js(view);
      // arrastrar la salida (arriba) 2 compases a la derecha: se guarda como punto de salida de la pista que suena
      const before = R.len.tl.exitAt; const bar = await js(`const a = __app.automix.snapshot().timeline.cur; return 4 * a.beat`);
      const g1 = await geo(R.len.len);
      await ptr('pointerdown', g1.x0, 10); await ptr('pointermove', g1.x0 + 2 * bar * g1.perSec, 10); await ptr('pointerup', g1.x0 + 2 * bar * g1.perSec, 10); await wait(1500);
      R.exit = { bar, before, view: await js(view), saved: await js(`return (await window.ytdj.analysis.get(${JSON.stringify(A.videoId)})).mixEdit || null`) };
      // con el teclado: Mayús + → un segundo más
      await js(`document.getElementById('amtl-cv').focus(); document.getElementById('amtl-cv').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })); return 1`); await wait(600);
      R.key = await js(view);
      fs.writeFileSync(path.join(out, 'claro-editada.png'), (await win.webContents.capturePage()).toPNG());
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'claro.json'), JSON.stringify(R));
    win.close();
  });
};
