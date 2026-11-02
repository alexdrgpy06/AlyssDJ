// Autoprueba de la interfaz de efectos: panel de ranuras, XY pad, RES, MIDI, persistencia y la interfaz para AutoMix.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  const first = async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const reload = async () => { const p = new Promise((r) => wc.once('did-finish-load', r)); wc.reloadIgnoringCache(); await p; await wait(2500); await js('__app.masterGain = 0; return 1'); };
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); __app.setView('mix'); __app.setWaves('top'); window.__sent = []; for (const d of [__app.decks.A, __app.decks.B]) { const b = d.broadcast.bind(d); d.broadcast = (c) => { if (c.type === 'mix') window.__sent.push({ id: d.id, ...JSON.parse(JSON.stringify(c)) }); b(c); }; } __app.decks.A.setBank('fx'); return 1`); await wait(500);
    const probe = `const A = __app.decks.A; const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: b.x, y: b.y }; };
      const last = (window.__sent || []).filter((m) => m.id === 'A').pop();
      return { slots: A.fxc.snapshot(), sel: A.fxc.selected, mix: A.mix, last, pane: r('#deck-A .fxpane'), pad: r('#deck-A .xy-pad'), sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, lib: r('.library'),
        pads: [...document.querySelectorAll('#deck-A .fx-pick')].map((b) => b.textContent), pows: [...document.querySelectorAll('#deck-A .fx-pow')].map((b) => b.classList.contains('on')), knobs: document.querySelectorAll('#deck-A .channel .knob, #mixer-A .knob, .mixer .knob').length,
        role: document.querySelector('#deck-A .xy-pad')?.getAttribute('role'), vt: document.querySelector('#deck-A .xy-pad')?.getAttribute('aria-valuetext'), padLabel: document.querySelector('#deck-A .xy-pad')?.getAttribute('aria-label'), selSlot: [...document.querySelectorAll('#deck-A .fx-slot')].map((e) => e.classList.contains('sel')) }`;
    res.start = await js(probe);
    // interruptor de la ranura 1 y selección de la 2 con otro tipo
    await js(`document.querySelector('#deck-A .fx-slot[data-slot="0"] .fx-pow').click(); await new Promise((r) => setTimeout(r, 100)); return 1`); res.pow = await js(probe);
    await js(`document.querySelector('#deck-A .fx-slot[data-slot="1"] .fx-pick').click(); const s = document.querySelector('#deck-A .fx-type'); s.value = 'phaser'; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 100)); return 1`); res.pick = await js(probe);
    const wetEl = `const w = document.querySelector('#deck-A .fx-wet'); w.value = 0.33; w.dispatchEvent(new Event('input', { bubbles: true })); const p = document.querySelector('#deck-A .fx-p'); p.value = 0.77; p.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 100)); return 1`;
    await js(wetEl); res.sliders = await js(probe);
    // XY pad (modo mantener por defecto): se enciende al pulsar, sigue el puntero y se apaga al soltar
    const pe = (type, fx, fy) => js(`const el = document.querySelector('#deck-A .xy-pad'); const b = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('${type}', { bubbles: true, button: 0, pointerId: 7, clientX: b.left + b.width * ${fx}, clientY: b.top + b.height * (1 - ${fy}) })); await new Promise((r) => setTimeout(r, 60)); return 1`);
    await pe('pointerdown', 0.8, 0.25); res.padDown = await js(probe);
    await pe('pointermove', 0.9, 0.6); res.padMove = await js(probe);
    await pe('pointerup', 0.9, 0.6); res.padUp = await js(probe);
    // sin mantener: se queda encendida
    await js(`await window.ytdj.settings.set({ fxHold: false }); __app.settings = await window.ytdj.settings.get(); return 1`);
    await pe('pointerdown', 0.4, 0.4); await pe('pointerup', 0.4, 0.4); res.padNoHold = await js(probe);
    await js(`await window.ytdj.settings.set({ fxHold: true }); __app.settings = await window.ytdj.settings.get(); __app.decks.A.fxc.set(1, { on: true }); return 1`);
    await pe('pointerdown', 0.5, 0.5); await pe('pointerup', 0.5, 0.5); res.padWasOn = await js(probe);
    // teclado y doble clic
    const key = (k, shift) => js(`const el = document.querySelector('#deck-A .xy-pad'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', shiftKey: ${!!shift}, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 60)); return 1`);
    await js(`__app.decks.A.fxc.set(1, { wet: 0.5, p: 0.5, on: false }); return 1`);
    await key('ArrowRight'); res.kRight = await js(probe); await key('ArrowUp', true); res.kUp = await js(probe); await key('ArrowLeft', true); await key('ArrowDown'); res.kMix = await js(probe);
    await js(`__app.decks.A.fxc.set(1, { wet: 0.1, p: 0.9 }); document.querySelector('#deck-A .xy-pad').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await new Promise((r) => setTimeout(r, 60)); return 1`); res.dbl = await js(probe);
    // RES en el mezclador
    res.res0 = await js(`return { mix: __app.decks.A.mix.res, has: !!__app.decks.A.resKnob }`);
    await js(`__app.decks.A.resKnob.set(0.5); await new Promise((r) => setTimeout(r, 60)); return 1`); res.res1 = await js(`return { mix: __app.decks.A.mix.res, sent: window.__sent.filter((m) => m.id === 'A').pop().res }`);
    await js(`__app.decks.A.resKnob.el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await new Promise((r) => setTimeout(r, 60)); return 1`); res.res2 = await js(`return __app.decks.A.mix.res`);
    // MIDI: ids registrados y acciones
    res.midi = await js(`const c = window.__controls; const ids = ['deckA.fx1On','deckA.fx2On','deckA.fx3On','deckA.fx1Wet','deckA.fx2Wet','deckA.fx3Wet','deckA.fx1P','deckA.fx2P','deckA.fx3P','deckA.res','deckA.fxOn','deckA.fxWet','deckA.fx.echo','deckA.fx.crush','deckB.fx3P']; const have = ids.map((i) => !!c.get(i)); const A = __app.decks.A;
      A.fxc.set(0, { on: false, wet: 0.5, type: 'echo' }); c.get('deckA.fx1Wet').setNorm(0.31); c.get('deckA.fx3P').setNorm(0.12); c.get('deckA.fx2On').press(true); c.get('deckA.fx.crush').press(true); c.get('deckA.fxOn').press(true); c.get('deckA.res').setNorm(0.4);
      return { have, s: A.fxc.snapshot(), res: A.mix.res, learnAttr: document.querySelector('#deck-A .fx-slot[data-slot="0"] .fx-pow').dataset.ctl }`);
    // interfaz para AutoMix
    await js(`const A = __app.decks.A; A.fxSet(2, { type: 'filter', on: true, wet: 0.9, p: 0.2 }); A.fxSet(0, { on: false }); window.__r0 = A.fxc.snapshot()[2]; A.fxRamp(2, { wet: 0 }, 0.3); return 1`);
    res.api0 = await js(`return window.__r0`); await wait(600); res.api1 = await js(`return __app.decks.A.fxc.snapshot()[2]`);
    // persistencia entre sesiones
    await js(`const A = __app.decks.A; A.fxc.set(0, { type: 'gate', on: true, wet: 0.66, p: 0.1 }); A.fxc.set(1, { type: 'crush', on: false, wet: 0.2, p: 0.9 }); return 1`); await wait(700);
    res.stored = await js(`return JSON.parse(localStorage.getItem('alyssdj.fx.A'))`);
    await reload(); res.reloaded = await js(`return __app.decks.A.fxc.snapshot()`);
    await js(`await window.ytdj.settings.set({ fxRemember: false }); return 1`); await reload();
    res.noRemember = await js(`return __app.decks.A.fxc.snapshot()`);
    await js(`await window.ytdj.settings.set({ fxRemember: true }); return 1`);
    // cargar una pista no toca la cadena
    await js(`const A = __app.decks.A; A.fxc.set(0, { type: 'flanger', on: true }); const before = JSON.stringify(A.fxc.snapshot()); await A.load({ videoId: 'FXTEST1', title: 'Prueba', artist: 'x', duration: 100 }); window.__same = before === JSON.stringify(A.fxc.snapshot()); return 1`); res.loadKeeps = await js(`return window.__same`);
    // ventana pequeña: el panel no desborda
    await js(`__app.decks.A.setBank('fx'); return 1`); win.setContentSize(1366, 768); await wait(900); res.small = await js(probe);
    fs.writeFileSync(path.join(out, 'fx-ui.json'), JSON.stringify(res));
    win.close();
  };
  wc.once('did-finish-load', first);
};
