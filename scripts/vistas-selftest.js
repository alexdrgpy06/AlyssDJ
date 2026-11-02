// Autoprueba de los divisores de vistas: arrastre real, límites, doble clic, teclado, memoria por vista y ventana pequeña.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wc = win.webContents;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); __app.setView('mix'); __app.setWaves('top'); return 1`); await wait(400);
    const probe = `const h = (s) => { const e = document.querySelector(s); return e && e.offsetParent !== null ? Math.round(e.getBoundingClientRect().height) : null; };
      const sp = (w) => { const e = document.querySelector('.splitter[data-split="' + w + '"]'); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, role: e.getAttribute('role'), now: e.getAttribute('aria-valuenow'), min: e.getAttribute('aria-valuemin'), max: e.getAttribute('aria-valuemax') }; };
      return { view: document.body.dataset.view, split: document.body.dataset.split || null, waves: h('.waves'), lib: h('.library'), con: h('.console'), sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, wsp: sp('waves'), lsp: sp('lib'), stored: JSON.parse(localStorage.getItem('alyssdj.splits') || 'null') }`;
    const mouse = async (type, x, y, extra = {}) => { wc.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...extra }); await wait(60); };
    const drag = async (sp, dy) => { await mouse('mouseDown', sp.x, sp.y); for (let i = 1; i <= 6; i++) await mouse('mouseMove', sp.x, sp.y + (dy * i) / 6, { modifiers: ['leftButtonDown'] }); await mouse('mouseUp', sp.x, sp.y + dy); await wait(250); };

    res.def = await js(probe);
    await drag(res.def.wsp, 60); res.waves60 = await js(probe);
    await drag(res.waves60.wsp, 2000); res.wavesMax = await js(probe);
    await js(`document.querySelector('.splitter[data-split="waves"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1`); await wait(300);
    res.reset = await js(probe);
    // librería: arrastrar hacia arriba la hace más alta; manda el último divisor movido
    await drag(res.reset.lsp, -40); res.lib80 = await js(probe);
    await drag(res.lib80.lsp, -3000); res.libMax = await js(probe);
    // teclado
    await js(`document.querySelector('.splitter[data-split="lib"]').focus(); return 1`);
    const k = (key, shift) => js(`document.querySelector('.splitter[data-split="lib"]').dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', shiftKey: ${!!shift}, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 200)); return 1`);
    await js(`document.querySelector('.splitter[data-split="lib"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1`); await wait(300);
    res.kbBase = await js(probe);
    await k('ArrowUp'); res.kbUp = await js(probe);
    await k('ArrowUp', true); res.kbUpBig = await js(probe);
    await k('ArrowDown'); res.kbDown = await js(probe);
    // memoria por vista
    await js(`__app.setView('library'); return 1`); await wait(400); res.libViewDefault = await js(probe);
    await js(`__app.setView('mix'); return 1`); await wait(400); res.mixBack = await js(probe);
    // ondas en el deck: solo el divisor de la librería
    await js(`__app.setWaves('deck'); return 1`); await wait(400); res.deckWaves = await js(probe);
    await js(`__app.setWaves('top'); __app.setView('waves'); return 1`); await wait(400); res.wavesView = await js(probe);
    await js(`__app.setView('mix'); return 1`); await wait(300);
    // ventana pequeña: el valor guardado se recorta pero no se pierde
    await js(`__app.splits.drag('mix', 'waves', 430); __app.applySplits(); return 1`);
    win.setContentSize(1366, 768); await wait(900); res.small = await js(probe);
    res.stored = await js(`return __app.splits.get('mix')`);
    fs.writeFileSync(path.join(out, 'vistas.json'), JSON.stringify(res));
    win.close();
  });
};
