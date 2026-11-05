// Autoprueba de AutoMix con efectos: transición (eco de salida, reverb de rotura), movimientos sobre cues, prioridad del usuario y limpieza.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,600)}}})()`, true);
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); return 1`);
    const R = await js(`
      const A = __app.decks.A, B = __app.decks.B, am = __app.automix; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const brk = { bpm: 120, offset: 0.5, duration: 84, mix: { phraseBeats: 16, phrases: [80, 80, 80, 80, 80, 30, 30, 90, 90, 90] } };   // rotura 40,5 · caída 56,5
      const rise = { bpm: 120, offset: 0.5, duration: 84, mix: { phraseBeats: 16, phrases: [40, 50, 60, 70, 100, 100, 100, 100, 100, 100] } }; // subida 0,5 → 32,5
      let posA = 0; A.pos = () => posA; B.pos = () => 0;
      const reset = () => { for (const d of [A, B]) { for (let i = 0; i < 3; i++) d.fxc.set(i, { type: ['echo', 'reverb', 'filter'][i], on: false, wet: 0.5, p: 0.5 }); } am.fxm.releaseAll(); am.fxLive = null; am.fxWarn = ''; am.fxEnd = { id: null, pos: -Infinity }; am.trans = null; };
      const sl = (d) => d.fxc.slots.map((s) => ({ ...s })); const own = (d) => [...d.fxc.owners];
      A.source = 'local'; B.source = 'local';
      A.track = { videoId: 'FXA', title: 'A', artist: 'x' }; B.track = { videoId: 'FXB', title: 'B', artist: 'x' }; A.analysis = brk; B.analysis = rise; const realSt = A.st; Object.defineProperty(A, 'st', { configurable: true, get: () => ({ ...realSt, playing: true }), set() {} }); am.cur = A; am.on = true;
      const plan = { seconds: 16, style: 'bass', tempo: false, exitAt: 36, enterAt: null, kind: 'outro', warnings: [] };
      const R = {};
      // 1) transición en Sutil: eco de salida al 75 % y reverb de rotura (40,5) con la salida en 36
      reset(); am.setCfg({ fxLevel: 'subtle', style: 'bass' }); posA = 36; am.startTransition(A, B, plan);
      R.planned = am.trans.moves.map((m) => m.id);
      am.trans.t0 = performance.now() - 0.3 * 16000; posA = 38; am.stepTransition(); R.early = sl(A);
      am.trans.t0 = performance.now() - 0.8 * 16000; posA = 41; am.stepTransition(); await wait(500); am.stepTransition();
      R.mid = { A: sl(A), owners: own(A), note: am.snapshot().note, fx: am.snapshot().fx };
      posA = 49; am.trans.t0 = performance.now() - 17000; am.stepTransition(); await wait(900);
      R.afterFinish = { A: sl(A), trans: !!am.trans, active: am.snapshot().fx.active };
      await wait(4800); R.restored = { A: sl(A), owners: own(A), active: am.fxm.active() };
      // 2) el usuario toca la ranura del eco → AutoMix no la vuelve a mover ni la restaura
      reset(); posA = 36; am.startTransition(A, B, plan); am.trans.t0 = performance.now() - 0.8 * 16000; am.stepTransition(); await wait(200);
      A.fxc.set(0, { wet: 0.9 }); am.stepTransition(); posA = 40; am.trans.t0 = performance.now() - 20000; am.stepTransition(); await wait(4600);
      R.userTook = { A: sl(A), active: am.fxm.active() };
      // 3) sin ranura libre: se omite y se avisa; las ranuras del usuario quedan intactas
      reset(); for (let i = 0; i < 3; i++) A.fxc.set(i, { on: true, wet: 0.3 + i / 10 }); posA = 36; am.startTransition(A, B, plan); am.trans.t0 = performance.now() - 0.8 * 16000; am.stepTransition();
      R.noFree = { A: sl(A), note: am.snapshot().note }; am.stop();
      // 4) Apagado: nada
      reset(); am.setCfg({ fxLevel: 'off' }); posA = 36; am.on = true; am.startTransition(A, B, plan); R.offPlanned = am.trans.moves.length; am.trans.t0 = performance.now() - 0.9 * 16000; posA = 41; am.stepTransition();
      R.off = { A: sl(A), fx: am.snapshot().fx, note: am.snapshot().note }; reset();
      // 5) Marcado, sobre cues de la pista que suena: riser en la subida, corte en la caída
      A.analysis = rise; am.setCfg({ fxLevel: 'full' }); am.on = true; posA = 1; am.fxTrack(A); await wait(100);
      R.riserOn = { A: sl(A), note: am.snapshot().note, live: !!am.fxLive };
      for (let x = 2.5; x <= 16.5; x += 1.5) { posA = x; am.fxTrack(A); } R.riserMid = sl(A)[0].wet;
      for (let x = 18; x <= 33; x += 1.5) { posA = x; am.fxTrack(A); } R.riserCut = { A: sl(A), live: !!am.fxLive };
      // en Sutil no hay movimientos sobre cues
      reset(); am.setCfg({ fxLevel: 'subtle' }); posA = 1; am.fxTrack(A); R.subtleTrack = sl(A);
      // 6) un salto de la aguja suelta el riser
      reset(); am.setCfg({ fxLevel: 'full' }); posA = 1; am.fxTrack(A); await wait(50); posA = 25; am.fxTrack(A); R.jump = { A: sl(A), live: !!am.fxLive };
      // 7) reverb de rotura sobre la pista que suena y limpieza al detener AutoMix
      reset(); A.analysis = brk; posA = 41; am.fxTrack(A); await wait(500); am.fxTrack(A); R.breakOn = sl(A); posA = 49; am.fxTrack(A); await wait(900); R.breakOff = { A: sl(A), live: !!am.fxLive };
      reset(); A.analysis = rise; posA = 1; am.fxTrack(A); R.beforeStop = sl(A)[0].on; am.stop(); R.afterStop = { A: sl(A), active: am.fxm.active(), live: !!am.fxLive };
      // 8) al cambiar de pista (otro videoId) no se queda colgado
      reset(); am.on = true; am.setCfg({ fxLevel: 'full' }); A.analysis = rise; posA = 1; am.fxTrack(A); A.track = { videoId: 'OTHER', title: 'o' }; posA = 2; am.fxTrack(A); R.trackChange = { A: sl(A), live: !!am.fxLive };
      reset(); am.setCfg({ fxLevel: 'subtle' }); am.stop();
      return R;`);
    fs.writeFileSync(path.join(out, 'fxcues.json'), JSON.stringify(R));
    win.close();
  });
};
