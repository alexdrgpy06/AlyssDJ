// Autoprueba del plato con scratch: decodifica una pista local, la sujeta, la arrastra hacia atrás y adelante, la suelta,
// y comprueba el respaldo sin buffer y el deck en pausa. En silencio (masterGain 0).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const R = {};
    try {
      await wait(2500);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
      const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`);
      await js(`const d = __app.decks.A; await d.load(${JSON.stringify(row)}, { play: true }); return 1`); await wait(2500);
      const snap = `const d = __app.decks.A; const m = d.local.engine.media; return { held: !!d.st.held, ready: !!d.st.scratchReady, pos: d.st.pos, paused: m.paused, rate: m.playbackRate, playing: d.st.playing, platter: d.el.platter.classList.contains('held') }`;
      R.loaded = await js(snap);
      // preparar: decodifica al pasar el ratón; se mide el tiempo
      R.prepare = await js(`const d = __app.decks.A; const t = performance.now(); const ok = await d.transport({ type: 'scratch', op: 'prepare' }); return { ok, ms: Math.round(performance.now() - t), src: d.local.engine.media.currentSrc, err: d.local.engine.scratchError?.() }`);
      for (let i = 0; i < 3 && !R.prepare.ok; i++) { await wait(500); R.prepare = await js(`const d = __app.decks.A; const t = performance.now(); const ok = await d.transport({ type: 'scratch', op: 'prepare' }); return { ok, ms: Math.round(performance.now() - t), err: d.local.engine.scratchError?.() }`); }
      R.ready = await js(snap);
      // sujetar sonando: se frena y la posición deja de avanzar
      await js(`await __app.decks.A.holdPlatter(); return 1`); await wait(350); R.held = await js(snap); await wait(400); R.held2 = await js(snap);
      // arrastrar hacia atrás: −90° en 0,1 s (−4,5×) durante 0,5 s
      const drag = (deg, ms) => js(`const d = __app.decks.A; const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { d.movePlatter(${deg}, 0.1); await new Promise((r) => setTimeout(r, 100)); } d.movePlatter(0, 0); return 1`);
      const p0 = R.held2.pos; await drag(-90, 500); await wait(120); R.back = await js(snap); R.backMoved = R.back.pos - p0;
      await drag(90, 500); await wait(120); R.fwd = await js(snap);
      // soltar sonando: sigue desde donde quedó y vuelve a la velocidad del deck
      await js(`await __app.decks.A.releasePlatter(); return 1`); await wait(150); R.rel150 = await js(snap); await wait(700); R.rel = await js(snap);
      // en pausa: scrub sin reanudar
      await js(`const d = __app.decks.A; d.transport({ type: 'pause' }); return 1`); await wait(250); R.paused0 = await js(snap);
      await js(`await __app.decks.A.holdPlatter(); return 1`); await wait(200); const q0 = (await js(snap)).pos;
      await drag(90, 400); await wait(120); R.scrub = await js(snap); R.scrubMoved = R.scrub.pos - q0;
      await js(`await __app.decks.A.releasePlatter(); return 1`); await wait(500); R.pausedAfter = await js(snap);
      // respaldo: sin buffer, sonando: freno suave del <audio> y arranque al soltar
      await js(`const d = __app.decks.A; d.local.engine.handle({ type: 'play' }); return 1`); await wait(400);
      await js(`const d = __app.decks.A; d.local.engine.media.dispatchEvent(new Event('x')); d.transport({ type: 'load', videoId: d.track.videoId, url: d.local.engine.media.currentSrc, startAt: 5, play: true }); return 1`); await wait(1500);
      R.fallbackReady = await js(snap);
      await js(`const d = __app.decks.A; window.__fbBuffered = await d.transport({ type: 'scratch', op: 'hold' }); return 1`); await wait(450); R.fbHeld = await js(snap); R.fbBuffered = await js('return window.__fbBuffered');
      await js(`await __app.decks.A.transport({ type: 'scratch', op: 'release' }); return 1`); await wait(900); R.fbRel = await js(snap);
      // plato con eventos de puntero reales: sujeta, arrastra en círculo hacia atrás y suelta (lo que hace el usuario con el ratón)
      await js(`const d = __app.decks.A; await d.load(d.track, { play: true, force: true }); return 1`); await wait(2500);
      await js(`const d = __app.decks.A; await d.transport({ type: 'scratch', op: 'prepare' }); return 1`);
      R.uiStart = await js(snap);
      R.ui = await js(`const d = __app.decks.A; const p = d.el.platter; const r = p.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 3;
        const ev = (type, deg) => new PointerEvent(type, { pointerId: 7, bubbles: true, clientX: cx + rad * Math.cos(deg * Math.PI / 180), clientY: cy + rad * Math.sin(deg * Math.PI / 180) });
        const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
        p.dispatchEvent(new PointerEvent('pointerenter', { pointerId: 7 })); p.dispatchEvent(ev('pointerdown', 0)); await sleep(350);
        const down = { held: !!d.st.held, cls: p.classList.contains('held'), pos: d.st.pos };
        for (let i = 1; i <= 9; i++) { p.dispatchEvent(ev('pointermove', -i * 10)); await sleep(50); }
        await sleep(200); const dragged = { pos: d.st.pos, held: !!d.st.held };
        p.dispatchEvent(ev('pointerup', -90)); await sleep(700);
        return { down, dragged, up: { held: !!d.st.held, cls: p.classList.contains('held'), playing: d.st.playing, paused: d.local.engine.media.paused } }`);
      R.toast = await js(`return [...document.querySelectorAll('.toast')].map((t) => t.textContent)`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'jog.json'), JSON.stringify(R));
    win.close();
  });
};
