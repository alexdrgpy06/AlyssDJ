// Autoprueba de la interfaz de «Efectos» de AutoMix: selector, memoria entre sesiones, estado en la transición y chip inmersivo.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const reload = async () => { const p = new Promise((r) => wc.once('did-finish-load', r)); wc.reloadIgnoringCache(); await p; await wait(2500); };
    const R = {};
    win.setContentSize(1366, 768); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); document.querySelector('.sources [data-tab="automix"]').click(); return 1`); await wait(600);
    R.opts = await js(`const s = document.getElementById('amv-fx'); return { n: s?.options.length, vals: [...s.options].map((o) => o.value), labels: [...s.options].map((o) => o.textContent), cur: s.value, label: s.closest('label').querySelector('.lbl').textContent.trim(), aria: s.getAttribute('aria-label'), sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }`);
    await js(`const s = document.getElementById('amv-fx'); s.value = 'full'; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 200)); return 1`);
    R.after = await js(`return { cfg: JSON.parse(localStorage.getItem('alyssdj:automix')).fxLevel, snap: __app.automix.snapshot().fx.level, sel: document.getElementById('amv-fx').value }`);
    await reload(); R.persisted = await js(`document.querySelector('.sources [data-tab="automix"]').click(); await new Promise((r) => setTimeout(r, 400)); return { cfg: __app.automix.fxLevel(), sel: document.getElementById('amv-fx').value }`);
    // estado en la transición (eco de salida) y chip de la vista inmersiva
    const sc = `const A = __app.decks.A, B = __app.decks.B, am = __app.automix; let posA = 36; A.pos = () => posA; B.pos = () => 0;
      A.track = { videoId: 'FXA', title: 'Uno', artist: 'x' }; B.track = { videoId: 'FXB', title: 'Dos', artist: 'x' };
      A.source = 'local'; B.source = 'local'; A.analysis = { bpm: 120, offset: 0.5, duration: 84, mix: { phraseBeats: 16, phrases: [80, 80, 80, 80, 80, 30, 30, 90, 90, 90] } }; B.analysis = A.analysis;
      const realSt = A.st; Object.defineProperty(A, 'st', { configurable: true, get: () => ({ ...realSt, playing: true }), set() {} }); am.cur = A; am.on = true;`;
    await js(`__app.setView('automix'); return 1`); await wait(500);
    await js(`${sc} am.setCfg({ fxLevel: 'subtle', style: 'bass' }); am.startTransition(A, B, { seconds: 16, style: 'bass', tempo: false, exitAt: 36, enterAt: null, kind: 'outro', warnings: [] }); am.trans.t0 = performance.now() - 0.8 * 16000; am.stepTransition(); await new Promise((r) => setTimeout(r, 400)); am.emit(); return 1`);
    R.trans = await js(`return { status: document.getElementById('amv-status').textContent, note: document.getElementById('amv-note').textContent, chipHidden: document.getElementById('imm-fx').hidden, chip: document.getElementById('imm-fx').textContent, immStatus: document.getElementById('imm-status').textContent }`);
    await js(`__app.automix.setCfg({ fxLevel: 'off' }); __app.automix.stop(); await new Promise((r) => setTimeout(r, 200)); return 1`);
    R.off = await js(`return { chipHidden: document.getElementById('imm-fx').hidden, note: document.getElementById('amv-note').textContent }`);
    // vista inmersiva a 1366×768: sin desbordes
    await js(`__app.setView('automix'); return 1`); await wait(600); R.imm = await js(`return { sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }`);
    fs.writeFileSync(path.join(out, 'fxcues-ui.json'), JSON.stringify(R));
    win.close();
  });
};
