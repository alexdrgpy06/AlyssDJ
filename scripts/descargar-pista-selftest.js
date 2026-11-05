// Autoprueba de deck-descargar-pista (la lanza scripts/test-descargar-pista.js): descargar, cargar pista, cabecera y rótulos.
// Escribe descargar-pista.json en YTDJ_SELFTEST_OUT. En silencio y en modo local (sin red).
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const music = process.env.YTDJ_DOCS_MUSIC;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const R = {};
  const done = () => fs.writeFileSync(path.join(out, 'descargar-pista.json'), JSON.stringify(R, null, 2));

  wc.once('did-finish-load', async () => {
    try {
      win.setContentSize(1280, 720);
      await wait(2000);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
      const files = ['Neon Drive', 'Sunset Groove'].map((n) => path.join(music, `${n}.mp3`));
      const rows = [];
      for (const f of files) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(f)})).data`));
      await js(`await window.ytdj.settings.set({ musicDirs: [${JSON.stringify(music)}], libraryDir: ${JSON.stringify(music)}, saveOnAnalyze: false, saveOnPlay: false, localMode: true }); return 1`);

      // ---- cabecera y botones con el deck vacío ----
      R.empty = await js(`
        const q = (s) => document.querySelector(s);
        const A = document.querySelector('.deck'); const sel = (s) => A.querySelector(s);
        const vis = (e) => !!e && e.checkVisibility();
        return { eject: !!sel('.deck-eject'), ejectDisabled: sel('.deck-eject').disabled, load: vis(sel('.deck-load')), help: sel('.deck-load-help').textContent, helpVis: vis(sel('.deck-load-help')),
          title: sel('.title').textContent, ctl: !!(await import('./controls.js')).controls.get('deckA.eject') };`);
      R.labelEmpty = await js(`const { startLabel } = await import('./automix-status.js'); return startLabel(__app.automix.snapshot(), [__app.decks.A, __app.decks.B]);`);

      // ---- cargar, cabecera con título largo, descargar ----
      await js(`const t = ${JSON.stringify(rows[0])}; t.title = 'Un título larguísimo que no cabe en la cabecera del deck y debe terminar con puntos suspensivos ' .repeat(2); await __app.decks.A.load(t); return 1`);
      await wait(1500);
      R.loaded = await js(`
        const A = document.querySelector('.deck'); const sel = (s) => A.querySelector(s);
        const head = sel('.deck-head'); const title = sel('.title'); const cs = getComputedStyle(title);
        const rd = sel('.readout').getBoundingClientRect(); const mt = sel('.meta').getBoundingClientRect();
        return { ejectDisabled: sel('.deck-eject').disabled, loadVis: sel('.deck-load').checkVisibility(), ellipsis: cs.textOverflow, nowrap: cs.whiteSpace, clipped: title.scrollWidth > title.clientWidth,
          noOverflow: head.scrollWidth <= head.clientWidth + 1, overlap: rd.left < mt.right - 1, label: (await import('./automix-status.js')).startLabel(__app.automix.snapshot(), [__app.decks.A, __app.decks.B]) };`);
      // estado previo para comprobar que se limpia
      await js(`const d = __app.decks.A; d.hotcues[0] = 12; d.syncLock = true; d.loop = { in: 1, out: 3 }; d.mix.low = -0.5; return 1`);
      R.unload = await js(`
        const d = __app.decks.A; const r = d.unload();
        return { r, track: d.track, dur: d.st.dur, playing: d.st.playing, hot: d.hotcues, loop: d.loop, sync: d.syncLock, wave: d.wave, analysis: d.analysis, again: d.unload() };`);
      await wait(500);
      Object.assign(R.unload, await js(`return { title: document.querySelector('.deck .title').textContent, ejectDisabled: document.querySelector('.deck .deck-eject').disabled }`));

      // ---- al aire: aviso, segunda pulsación en 3 s confirma ----
      R.live = await js(`
        const d = __app.decks.A; await d.load(${JSON.stringify(rows[0])}); __app.masterGain = 1; d.mix.fader = 1; d.xf = 1; d.st.playing = true;
        const toasts = []; const orig = __app.toast.bind(__app); __app.toast = (m, e) => { toasts.push(m); };
        const first = d.unload(); const kept = !!d.track;
        const second = d.unload(); __app.toast = orig; __app.masterGain = 0;
        return { first, kept, second, gone: !d.track, msg: toasts[0] || '' };`);
      R.liveSlow = await js(`
        const d = __app.decks.A; await d.load(${JSON.stringify(rows[0])}); __app.masterGain = 1; d.mix.fader = 1; d.xf = 1; d.st.playing = true;
        const f = d.unload(); d.unloadAsk = performance.now() - 3500; const s = d.unload(); __app.masterGain = 0; d.st.playing = false; return { f, s, kept: !!d.track };`);
      await js(`__app.decks.A.unload({ force: true }); return 1`);

      // ---- AutoMix la usa ----
      R.holds = await js(`
        const A = __app.decks.A, B = __app.decks.B, am = __app.automix; await A.load(${JSON.stringify(rows[0])}); await B.load(${JSON.stringify(rows[1])});
        const off = am.holds(A);
        am.on = true; am.cur = A; am.queue = [{ videoId: B.track.videoId, title: 'x' }];
        const cur = am.holds(A), head = am.holds(B);
        const toasts = []; const orig = __app.toast.bind(__app); __app.toast = (m) => toasts.push(m);
        const blocked = [A.unload(), B.unload()]; __app.toast = orig;
        am.queue = []; const free = am.holds(B);
        am.on = false; am.cur = null;
        return { off, cur, head, blocked, free, msg: toasts[0] || '', still: !!A.track && !!B.track, afterStop: A.unload({ force: true }) };`);

      // ---- rótulos y menú Radio al iniciar sin pista ----
      await js(`__app.decks.A.unload({ force: true }); __app.decks.B.unload({ force: true }); __app.setView('library'); __app.library.show('automix'); return 1`);
      await wait(800);
      R.labels = await js(`
        const q = (s) => document.querySelector(s);
        const lab0 = q('#amv-toggle span').textContent; const hint0 = q('#am-hint').textContent;
        q('#amv-toggle').click(); await new Promise((r) => setTimeout(r, 300));
        const menuOpen = !q('#amv-radio-menu').hidden; const started = __app.automix.on;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await __app.decks.A.load(${JSON.stringify(rows[0])}); await new Promise((r) => setTimeout(r, 600));
        const lab1 = q('#amv-toggle span').textContent;
        const { disabledReason } = await import('./automix-status.js');
        return { lab0, hint0, menuOpen, started, lab1, imm: q('#imm-toggle span').textContent, reasons: [disabledReason({ on: false }), disabledReason({ on: true, trans: {} }), disabledReason({ on: true, canSkip: false }), disabledReason({ on: true, canSkip: true })] };`);
    } catch (e) { R.error = String(e.stack || e).slice(0, 600); }
    done();
  });
};
