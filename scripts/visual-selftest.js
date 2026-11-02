// Autoprueba del visualizador de Automix: lienzo, bucle (30 fps, se detiene fuera de la vista), botón, movimiento reducido, color y rendimiento.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const reload = async () => { const p = new Promise((r) => wc.once('did-finish-load', r)); wc.reloadIgnoringCache(); await p; await wait(2500); };
    const R = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); __app.setView('automix'); return 1`); await wait(900);
    const snap = `const v = __app.viz; const c = document.getElementById('imm-viz'); const b = document.getElementById('imm-viz-toggle'); const imm = document.getElementById('immersive').getBoundingClientRect(); const cb = c.getBoundingClientRect();
      return { frames: v.frames, raf: v.raf, hidden: c.hidden, vis: c.offsetParent !== null, cw: Math.round(cb.width), ch: Math.round(cb.height), iw: Math.round(imm.width), ih: Math.round(imm.height), pressed: b.getAttribute('aria-pressed'), cfg: __app.automix.cfg.visual, tf: document.querySelector('.imm-cover').style.transform, sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, hh: innerHeight, role: c.getAttribute('aria-hidden') }`;
    // en CI (macOS/Windows) la ventana puede contar como oculta o pedir menos movimiento: se fija el entorno para medir el bucle
    R.env = await js(`const e = { hidden: document.hidden, reduced: __app.viz.reducedMotion() }; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); __app.viz.forceReduced = false; __app.viz.refresh(); return e`); await wait(500);
    R.start = await js(snap);
    // ¿dispara requestAnimationFrame en este entorno? (ventanas sin foco u ocultas en CI no lo hacen)
    R.rafFires = await js(`let n = 0; const t = performance.now(); await new Promise((ok) => { const f = () => { n++; performance.now() - t > 600 ? ok() : requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(ok, 900); }); return n`);
    // 30 fps como máximo: cuadros en un segundo
    const f0 = (await js(snap)).frames; await wait(1000); const f1 = (await js(snap)).frames; R.fps = f1 - f0;
    // fuera de la vista Automix el bucle se detiene y no dibuja
    await js(`__app.setView('mix'); return 1`); await wait(300); const g0 = (await js(snap)); await wait(500); const g1 = await js(snap); R.stopped = { raf: g1.raf, drawn: g1.frames - g0.frames };
    await js(`__app.setView('automix'); return 1`); await wait(500); R.resumed = await js(snap);
    // ventana oculta: se detiene
    await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); __app.viz.refresh(); return 1`); await wait(200); const h0 = await js(snap); await wait(400); const h1 = await js(snap); R.docHidden = { raf: h1.raf, drawn: h1.frames - h0.frames };
    await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); __app.viz.refresh(); return 1`); await wait(300); R.docShown = await js(snap);
    // botón Visual: apaga, recuerda y enciende
    await js(`document.getElementById('imm-viz-toggle').click(); await new Promise((r) => setTimeout(r, 400)); return 1`); R.off = await js(snap); await wait(500); R.offLater = await js(snap);
    await reload(); await js(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); __app.viz.forceReduced = false; __app.setView('automix'); return 1`); await wait(800); R.offPersisted = await js(snap);
    await js(`document.getElementById('imm-viz-toggle').click(); await new Promise((r) => setTimeout(r, 400)); return 1`); R.on = await js(snap);
    // movimiento reducido: sin bucle; un cuadro estático y no más
    await js(`__app.viz.forceReduced = true; __app.viz.refresh(); return 1`); await wait(300); const r0 = await js(snap); await wait(600); const r1 = await js(snap); R.reduced = { raf: r1.raf, drawn: r1.frames - r0.frames, hasFrame: r0.frames > 0 };
    await js(`__app.viz.forceReduced = false; __app.viz.refresh(); return 1`); await wait(300);
    // dibujo con decks simulados: color por deck, latido de la portada y lienzo con contenido
    const fake = (arr) => `__app.viz.getDecks = () => ${JSON.stringify(arr)}; __app.viz.lvl = {}; __app.viz.stop(); __app.viz.drawFrame();`;
    const px = `const c = document.getElementById('imm-viz'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { n++; r += d[i]; g += d[i + 1]; b += d[i + 2]; } return { n, r: n ? r / n : 0, g: n ? g / n : 0, b: n ? b / n : 0, tf: document.querySelector('.imm-cover').style.transform }`;
    const base = { level: 0.9, gain: 1, bpm: 120, offset: 0, playing: true };
    await js(fake([{ id: 'A', ...base, pos: 4 }, { id: 'B', level: 0, gain: 0, bpm: 0, pos: 0, offset: 0, playing: false }])); R.onlyA = await js(px);
    await js(fake([{ id: 'A', level: 0, gain: 0, bpm: 0, pos: 0, offset: 0, playing: false }, { id: 'B', ...base, pos: 4 }])); R.onlyB = await js(px);
    await js(fake([{ id: 'A', ...base, pos: 4 }, { id: 'B', ...base, pos: 4 }])); R.both = await js(px);
    await js(fake([{ id: 'A', ...base, pos: 4 }])); R.beat = (await js(px)).tf; await js(fake([{ id: 'A', ...base, pos: 4.4 }])); R.offBeat = (await js(px)).tf;
    await js(fake([{ id: 'A', ...base, playing: false, pos: 4 }, { id: 'B', ...base, playing: false, pos: 4 }])); R.paused = await js(px);
    await js(fake([{ id: 'A', ...base, bpm: 0, pos: 4 }])); R.noBpm = await js(px);
    // rendimiento: 120 cuadros a 1600×960
    R.perf = await js(`const v = __app.viz; v.getDecks = () => [{ id: 'A', level: 0.8, gain: 0.6, bpm: 124, offset: 0, playing: true, pos: 0 }, { id: 'B', level: 0.8, gain: 0.4, bpm: 126, offset: 0, playing: true, pos: 0 }]; v.stop(); let t = 0; const t0 = performance.now(); for (let i = 0; i < 120; i++) { v.getDecks = () => [{ id: 'A', level: 0.8, gain: 0.6, bpm: 124, offset: 0, playing: true, pos: i / 30 }, { id: 'B', level: 0.8, gain: 0.4, bpm: 126, offset: 0, playing: true, pos: i / 30 }]; v.drawFrame(); } return { avg: (performance.now() - t0) / 120, w: document.getElementById('imm-viz').width, h: document.getElementById('imm-viz').height };`);
    await js(`__app.viz.getDecks = () => []; __app.viz.refresh(); return 1`);
    // 1366×768
    win.setContentSize(1366, 768); await wait(900); R.small = await js(snap);
    fs.writeFileSync(path.join(out, 'visual.json'), JSON.stringify(R));
    win.close();
  });
};
