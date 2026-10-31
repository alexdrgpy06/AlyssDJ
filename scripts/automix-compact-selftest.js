// Módulo de autoprueba: mide los decks y la librería con y sin AutoMix.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack}}})()`, true);
    win.setContentSize(1600, 960);
    await new Promise((r) => setTimeout(r, 2500));
    const m = `const q=(s)=>document.querySelector(s).getBoundingClientRect().height; return { deck:q('#deck-A .deck'), console:q('.console'), library:q('.library'), win:innerHeight, cls:document.body.classList.contains('am-compact'), vis:{title:!!document.querySelector('#deck-A .title').offsetParent, bpm:!!document.querySelector('#deck-A .bpm').offsetParent, play:!!document.querySelector('#deck-A .play').offsetParent, sync:!!document.querySelector('#deck-A .sync').offsetParent, cue:!!document.querySelector('#deck-A .cue').offsetParent, wave:!!document.querySelector('#deck-A canvas.overview').offsetParent}, scroll: document.documentElement.scrollHeight>innerHeight }`;
    const out = {};
    out.before = await js(m);
    await js(`document.querySelector('.tabs [data-tab="automix"]').click(); await new Promise(r=>setTimeout(r,500)); return 1`);
    out.during = await js(m);
    fs.writeFileSync(path.join(process.env.YTDJ_SELFTEST_OUT, 'compact.png'), (await win.webContents.capturePage()).toPNG());
    await js(`document.querySelector('.tabs [data-tab="local"]').click(); await new Promise(r=>setTimeout(r,500)); return 1`);
    out.after = await js(m);
    fs.writeFileSync(path.join(process.env.YTDJ_SELFTEST_OUT, 'compact.json'), JSON.stringify(out));
    win.close();
  });
};
