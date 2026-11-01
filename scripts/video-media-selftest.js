// Autoprueba: la ventana de video nunca muestra la página de YouTube Music de un deck vacío o sin video.
const fs = require('fs'); const path = require('path');
const { BrowserWindow } = require('electron');
module.exports = (win, decks) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c, w = win) => w.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960);
    await wait(2500);
    await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
    await js(`await window.ytdj.video.open({ show: 'split' }); return 1`);
    await wait(2500);
    const vw = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.getTitle().includes('Video'));
    const ph = (id) => js(`const p=document.getElementById('ph-${id}'); return { display: p.style.display, text: p.querySelector('span').textContent, w: p.style.width }`, vw);
    res.hasWin = !!vw;
    // 1) decks vacíos: pantalla «Sin pista» y la vista de YouTube Music oculta
    res.emptyA = await ph('A'); res.emptyB = await ph('B');
    res.emptyVisible = [decks.A.view.getVisible(), decks.B.view.getVisible()];
    // 2) deck local sin video: «Sin video»
    const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`);
    await js(`await __app.decks.A.load(${JSON.stringify(row)}); return 1`);
    await wait(1500);
    res.localNoVideo = await ph('A');
    res.localVisible = decks.A.view.getVisible();
    // 3) pista de streaming que aún no cargó: «Cargando…», sigue sin enseñar la página
    await js(`await __app.decks.B.load({ videoId: 'AAAAAAAAAAA', title: 'Falsa', artist: 'x', duration: 100 }); return 1`);
    await wait(800);
    res.streamLoading = await ph('B');
    res.streamVisible = decks.B.view.getVisible();
    fs.writeFileSync(path.join(out, 'video-media.json'), JSON.stringify(res));
    win.close();
  });
};
