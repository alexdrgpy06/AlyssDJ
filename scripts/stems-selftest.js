// Autoprueba de los stems en el deck: activa un FLAC de 8 canales con un tono distinto por stem y comprueba la matriz,
// mute/solo, la continuidad de la posición, el cambio de velocidad y la vuelta a la pista completa. Sin sonido (audio de la ventana silenciado).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.setAudioMuted(true);
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const R = {};
    try {
      await wait(2500);
      const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`);
      R.id = row.videoId;
      R.list = await js(`return await window.ytdj.stems.list()`);
      R.status = await js(`return await window.ytdj.stems.status()`);
      await js(`const d = __app.decks.A; await d.load(${JSON.stringify(row)}, { play: true }); return 1`); await wait(2000);
      const E = `const d = __app.decks.A; const e = d.local.engine;`;
      const snap = `${E} const m = e.media; return { pos: m.currentTime, paused: m.paused, rate: m.playbackRate, src: m.currentSrc.split('/').slice(-2).join('/'), stems: e.state().stems }`;
      // pico del medidor durante ~0,5 s (la señal de los tonos es estable)
      const lvl = `${E} let p = 0; for (let i = 0; i < 12; i++) { p = Math.max(p, e.state().level); await new Promise((r) => setTimeout(r, 45)); } return p`;
      R.full = await js(snap); R.fullLevel = await js(lvl);
      R.on = await js(`${E} const ok = await e.handle({ type: 'stems', op: 'on', url: '/stemfile/' + encodeURIComponent(${JSON.stringify(R.id)}) }); return ok`);
      await wait(500); R.onSnap = await js(snap); R.allLevel = await js(lvl);
      // solo de cada stem: el nivel crece con la amplitud del tono (0,05 / 0,1 / 0,2 / 0,4)
      R.solo = [];
      for (let i = 0; i < 4; i++) {
        await js(`${E} await e.handle({ type: 'stems', op: 'solo', i: ${i}, v: true }); return 1`); await wait(350);
        R.solo.push(await js(lvl));
        await js(`${E} await e.handle({ type: 'stems', op: 'solo', i: ${i}, v: false }); return 1`); await wait(150);
      }
      // varios solos se suman
      await js(`${E} await e.handle({ type: 'stems', op: 'solo', i: 2, v: true }); await e.handle({ type: 'stems', op: 'solo', i: 3, v: true }); return 1`); await wait(350); R.solo23 = await js(lvl);
      await js(`${E} await e.handle({ type: 'stems', op: 'solo', i: 2, v: false }); await e.handle({ type: 'stems', op: 'solo', i: 3, v: false }); return 1`); await wait(200);
      // mute de la voz: baja el nivel; mute de todos: silencio
      await js(`${E} await e.handle({ type: 'stems', op: 'mute', i: 3, v: true }); return 1`); await wait(350); R.muteVoice = await js(lvl);
      await js(`${E} for (let i = 0; i < 3; i++) await e.handle({ type: 'stems', op: 'mute', i, v: true }); return 1`); await wait(350); R.muteAll = await js(lvl); R.muteState = await js(snap);
      await js(`${E} for (let i = 0; i < 4; i++) await e.handle({ type: 'stems', op: 'mute', i, v: false }); return 1`); await wait(350); R.unmuted = await js(lvl);
      // el volumen por stem
      await js(`${E} await e.handle({ type: 'stems', op: 'gain', i: 3, v: 0.5 }); await e.handle({ type: 'stems', op: 'solo', i: 3, v: true }); return 1`); await wait(350); R.half = await js(lvl);
      await js(`${E} await e.handle({ type: 'stems', op: 'solo', i: 3, v: false }); await e.handle({ type: 'stems', op: 'gain', i: 3, v: 1 }); return 1`); await wait(150);
      // velocidad, búsqueda y pausa los hereda el elemento
      await js(`${E} await e.handle({ type: 'rate', rate: 1.05, keylock: true }); return 1`); await wait(300); R.rate = await js(`${snap.replace('return {', 'return { keylock: e.media.preservesPitch,')}`);
      await js(`${E} await e.handle({ type: 'rate', rate: 1, keylock: true }); await e.handle({ type: 'seek', t: 3 }); return 1`); await wait(300); R.seek = await js(snap);
      await js(`${E} await e.handle({ type: 'pause' }); return 1`); await wait(300); const p0 = (await js(snap)).pos; await wait(400); R.paused = { a: p0, b: (await js(snap)).pos, st: await js(snap) };
      await js(`${E} await e.handle({ type: 'play' }); return 1`); await wait(500); R.resumed = await js(snap);
      // plato con stems: sin buffer (respaldo suave), sin romper nada
      R.platter = await js(`${E} const prep = await d.transport({ type: 'scratch', op: 'prepare' }); const buf = await d.transport({ type: 'scratch', op: 'hold' }); await new Promise((r) => setTimeout(r, 300)); const held = e.state().held; await d.transport({ type: 'scratch', op: 'release' }); await new Promise((r) => setTimeout(r, 500)); return { prep, buf, held, playing: !e.media.paused, stems: e.state().stems.on }`);
      // volver a la pista completa: misma posición, sigue sonando, a la velocidad del deck
      const pre = await js(snap);
      R.off = await js(`${E} return await e.handle({ type: 'stems', op: 'off' })`); await wait(400); R.offSnap = await js(snap); R.offLevel = await js(lvl); R.pre = pre;
      // cargar otra pista con los stems activos los apaga
      await js(`${E} await e.handle({ type: 'stems', op: 'on', url: '/stemfile/' + encodeURIComponent(${JSON.stringify(R.id)}) }); return 1`); await wait(300);
      R.beforeLoad = await js(snap);
      await js(`const d = __app.decks.A; await d.load(${JSON.stringify(row)}, { play: true, force: true }); return 1`); await wait(1500); R.afterLoad = await js(snap);
      // activar con la acción ya aplicada (una sola acción): voz en mute desde el primer instante, aislar la batería, y volver
      await js(`${E} await e.handle({ type: 'seek', t: 5 }); return 1`); await wait(300); R.comboFull = await js(lvl);
      R.comboOn = await js(`${E} const t0 = performance.now(); const ok = await e.handle({ type: 'stems', op: 'on', url: '/stemfile/' + encodeURIComponent(${JSON.stringify(R.id)}), mute: [false, false, false, true], solo: [] }); return { ok, ms: performance.now() - t0, st: e.state().stems }`);
      await wait(400); R.comboMuted = await js(lvl); R.comboSnap = await js(snap);
      await js(`${E} await e.handle({ type: 'stems', op: 'off' }); return 1`); await wait(400); R.comboOffSnap = await js(snap); R.comboOffLevel = await js(lvl);
      R.comboSolo = await js(`${E} await e.handle({ type: 'stems', op: 'on', url: '/stemfile/' + encodeURIComponent(${JSON.stringify(R.id)}), mute: [], solo: [true, false, false, false] }); await new Promise((r) => setTimeout(r, 500)); return e.state().stems`);
      R.comboSoloLevel = await js(lvl);
      R.comboOffAgain = await js(`${E} await e.handle({ type: 'stems', op: 'off' }); await new Promise((r) => setTimeout(r, 400)); return { st: e.state().stems, paused: e.media.paused }`);
      R.toast = await js(`return [...document.querySelectorAll('.toast')].map((t) => t.textContent)`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'stems.json'), JSON.stringify(R));
    win.close();
  });
};
