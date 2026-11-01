// Autoprueba de la vista Automix inmersiva: muestra la pista que suena, la siguiente y los controles de AutoMix.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT, music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.removeItem('alyssdj.view'); __app.setView('mix'); return 1`);
    const rows = [];
    for (const n of ['Neon Drive', 'Night Pulse']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
    await js(`await __app.decks.A.load(${JSON.stringify(rows[0])}); await __app.decks.B.load(${JSON.stringify(rows[1])}); return 1`); await wait(800);
    const probe = `const vis = (s) => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; };
      return { view: document.body.dataset.view, imm: vis('#immersive'), console: vis('.console'), library: vis('.library'), waves: vis('.waves'),
        title: document.getElementById('imm-title').textContent, artist: document.getElementById('imm-artist').textContent, bpm: document.getElementById('imm-bpm').textContent,
        origin: document.getElementById('imm-origin').textContent, cover: !!document.getElementById('imm-cover').getAttribute('src'),
        toggle: document.querySelector('#imm-toggle span').textContent, status: document.getElementById('imm-status').textContent, sw: document.documentElement.scrollWidth, w: innerWidth, h: innerHeight,
        controls: (() => { const b = document.querySelector('.imm-controls').getBoundingClientRect(); return { b: Math.round(b.bottom) }; })() }`;
    // Alt+3
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3', key: '3', altKey: true, bubbles: true })); return 1`); await wait(700);
    res.on = await js(probe);
    // estilo y duración conectados a AutoMix
    await js(`document.querySelector('#imm-style [data-v="filter"]').click(); const l = document.getElementById('imm-len'); l.value = 24; l.dispatchEvent(new Event('input', { bubbles: true })); return 1`); await wait(700);
    res.cfg = await js(`const c = __app.automix.snapshot().cfg; return { style: c.style, len: c.len, styleUi: document.querySelector('#imm-style .on').dataset.v, lenOut: document.getElementById('imm-len-out').textContent }`);
    // iniciar AutoMix con las pistas cargadas: el botón cambia
    await js(`document.getElementById('imm-toggle').click(); return 1`); await wait(900);
    res.started = await js(`return { on: __app.automix.on, label: document.querySelector('#imm-toggle span').textContent }`);
    await js(`document.getElementById('imm-toggle').click(); return 1`); await wait(600);
    res.stopped = await js(`return { on: __app.automix.on, label: document.querySelector('#imm-toggle span').textContent }`);
    fs.writeFileSync(path.join(out, 'immersive.png'), (await win.webContents.capturePage()).toPNG());
    // «Ver cola» abre la vista Librería con la fuente AutoMix
    await js(`document.getElementById('imm-queue').click(); return 1`); await wait(800);
    res.queue = await js(`return { view: document.body.dataset.view, tab: __app.library.tab, amView: !document.getElementById('am-view').hidden }`);
    // 1366x768: cabe
    win.setContentSize(1366, 768); await wait(500);
    await js(`__app.setView('automix'); return 1`); await wait(700);
    res.small = await js(probe);
    fs.writeFileSync(path.join(out, 'immersive.json'), JSON.stringify(res));
    win.close();
  });
};
