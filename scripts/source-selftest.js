// Autoprueba: etiqueta de origen del deck, selector de fuente y chip de la librería.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; return 1`);
    const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`);
    await js(`await __app.decks.A.load(${JSON.stringify(row)}); return 1`); await wait(1200);
    const probe = (d) => `const D=__app.decks.${d}; const b=[...D.el.root.querySelectorAll('.source button')]; return { state: D.el.state.textContent, source: D.source, origin: D.srcInfo && D.srcInfo.origin, na: b.map((x) => x.getAttribute('aria-disabled')), titles: b.map((x) => x.title) }`;
    res.local = await js(probe('A'));
    // stream sin copia: origen STREAM, selector no disponible con la razón
    await js(`await __app.decks.B.load({ videoId: 'AAAAAAAAAAA', title: 'Falsa', artist: 'x', duration: 100 }); return 1`); await wait(600);
    res.stream = await js(probe('B'));
    // setSource sin alternativa avisa y no cambia
    await js(`await __app.decks.B.setSource('local'); return 1`);
    res.afterSwitch = await js(`return __app.decks.B.source`);
    // chip en la librería (fuente Local)
    await js(`await __app.library.show('local'); return 1`); await wait(1500);
    res.chips = await js(`return [...document.querySelectorAll('#tracks .src-chip')].map((c) => c.textContent)`);
    // preferSaved se guarda y se lee
    res.pref = await js(`await window.ytdj.settings.set({ preferSaved: false }); const s = await window.ytdj.settings.get(); await window.ytdj.settings.set({ preferSaved: true }); return s.preferSaved`);
    fs.writeFileSync(path.join(out, 'source.json'), JSON.stringify(res));
    win.close();
  });
};
