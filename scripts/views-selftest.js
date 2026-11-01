// Autoprueba de las vistas de trabajo: selector, atajos, ondas en el deck, memoria entre sesiones y la fuente AutoMix.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.removeItem('alyssdj.view'); __app.setView('mix'); __app.setWaves('top'); return 1`);
    const probe = `const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), h: Math.round(b.height), b: Math.round(b.bottom) }; };
      return { layout: document.body.dataset.layout, view: document.body.dataset.view, waves: document.body.dataset.waves, compact: document.body.classList.contains('am-compact'),
        waveTop: r('.waves'), library: r('.library'), console: r('.console'), deckScroll: r('#deck-A .deck-scroll'),
        canvasIn: document.getElementById('scroll-A').parentElement.className, sw: document.documentElement.scrollWidth, w: innerWidth,
        stored: JSON.parse(localStorage.getItem('alyssdj.view') || 'null'), pressed: [...document.querySelectorAll('#view-switch button.on')].map((b) => b.dataset.view) }`;
    res.mix = await js(probe);
    // atajos Alt+2 / Alt+4 / Alt+1
    const key = (code) => js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit${code}', key: '${code}', altKey: true, bubbles: true })); await new Promise((r) => setTimeout(r, 400)); return 1`);
    await key(2); res.library = await js(probe);
    await key(4); res.waves = await js(probe);
    await key(1); res.back = await js(probe);
    // ondas en el deck (Mezcla y Librería); en Ondas siguen arriba
    await js(`__app.setWaves('deck'); return 1`); await wait(400); res.deckWaves = await js(probe);
    await key(4); await wait(300); res.wavesWithDeckOpt = await js(probe);
    await key(1); await wait(300);
    await js(`__app.setWaves('top'); return 1`); await wait(300); res.topAgain = await js(probe);
    // fuente AutoMix: pasa a Librería y al salir vuelve a la vista anterior
    await js(`__app.setView('mix'); document.querySelector('.sources [data-tab="automix"]').click(); return 1`); await wait(500);
    res.amIn = await js(probe);
    await js(`document.querySelector('.sources [data-tab="local"]').click(); return 1`); await wait(500);
    res.amOut = await js(probe);
    // si el usuario elige otra vista dentro de AutoMix, no se le quita al salir
    await js(`document.querySelector('.sources [data-tab="automix"]').click(); return 1`); await wait(300);
    await js(`__app.setView('waves'); return 1`); await wait(300);
    await js(`document.querySelector('.sources [data-tab="local"]').click(); return 1`); await wait(400);
    res.amChosen = await js(probe);
    // memoria entre sesiones
    await js(`__app.setView('library'); __app.setWaves('deck'); return 1`); await wait(300);
    res.saved = await js(`return JSON.parse(localStorage.getItem('alyssdj.view'))`);
    // compacto 1366x768: la vista Ondas y las ondas en el deck caben
    win.setContentSize(1366, 768); await wait(900);
    res.small = {};
    for (const v of ['mix', 'library', 'waves']) { await js(`__app.setView('${v}'); return 1`); await wait(500); res.small[v] = await js(probe); }
    fs.writeFileSync(path.join(out, 'views.json'), JSON.stringify(res));
    win.close();
  });
};
