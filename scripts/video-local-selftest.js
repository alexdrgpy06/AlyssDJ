// Autoprueba: una pista local con video guardado se ve en la miniatura y en la ventana de video, sincronizada.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
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
    const rows = [];
    for (const n of ['Neon Drive', 'Sunset Groove']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
    await js(`for (const r of ${JSON.stringify(rows)}) window.ytdj.analysis.request(r.videoId, { meta: { title: r.title, artist: r.artist, thumb: r.thumb, trackDuration: r.duration }, file: r.path }); return 1`);
    for (let i = 0; i < 60; i++) { await wait(500); if (await js(`return !!(await window.ytdj.analysis.get(${JSON.stringify(rows[0].videoId)})) && !!(await window.ytdj.analysis.get(${JSON.stringify(rows[1].videoId)}))`)) break; }
    // la primera pista "viene de YouTube" y tiene un video guardado (de prueba, generado con ffmpeg)
    const YT = 'TESTVID0001';
    await js(`await window.ytdj.analysis.setMeta(${JSON.stringify(rows[0].videoId)}, { ytId: ${JSON.stringify(YT)} }); return 1`);
    const libDir = await js(`return await window.ytdj.settings.libraryDir()`);
    fs.mkdirSync(path.join(libDir, '.video'), { recursive: true });
    const ff = require(path.join(__dirname, '../main/tools'));
    const bin = (await ff.findFfmpeg('', [path.join(__dirname, '../bin')])).bin;
    execFileSync(bin, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15:duration=120', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '15', path.join(libDir, '.video', `${YT}.mp4`)]);
    res.src = await js(`return await window.ytdj.video.localSrc(${JSON.stringify(rows[0].videoId)})`);
    res.srcNone = await js(`return await window.ytdj.video.localSrc(${JSON.stringify(rows[1].videoId)})`);
    // cargar y reproducir en el deck A
    await js(`const A=__app.decks.A; await A.load(${JSON.stringify(rows[0])}); A.seek(20); A.togglePlay(); return 1`);
    await wait(3000);
    const probe = `const A=__app.decks.A; return { src: A.videoSrc, key: A.videoKey, id: A.track?.videoId, platterVideo: !!A.el.vid.querySelector('video, .frame'), pos: A.pos(), rate: A.st.rate, playing: A.st.playing }`;
    res.mini = await js(probe);
    fs.writeFileSync(path.join(out, 'video-mini.png'), (await win.webContents.capturePage()).toPNG());
    // salto: el video sigue al deck
    await js(`__app.decks.A.seek(60); return 1`);
    await wait(2000);
    res.afterSeek = await js(probe);
    // pausa
    await js(`__app.decks.A.togglePlay(); return 1`);
    await wait(1200);
    res.paused = await js(probe);
    // velocidad (pitch +8 %)
    await js(`__app.decks.A.togglePlay(); __app.decks.A.setPitch(8); return 1`);
    await wait(2000);
    res.pitched = await js(probe);
    // ventana de video: el deck A suena desde archivo con video → la página lo muestra y la vista del stream se oculta
    await js(`await window.ytdj.video.open({ show: 'A' }); return 1`);
    await wait(3500);
    const vw = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.getTitle().includes('Video'));
    res.hasWin = !!vw;
    if (vw) {
      res.vwin = await js(`const el=document.getElementById('v-A'); const a=document.getElementById('v-B'); return { layouts: window.__layouts, bridge: typeof window.ytdjVideo, tiles: typeof window.__tiles, display: el.style.display, w: el.style.width, src: el.currentSrc, t: el.currentTime, paused: el.paused, bDisplay: a.style.display }`, vw);
      res.vwinPos = await js(`return __app.decks.A.pos()`);
      res.streamVisible = decks.A.view.getVisible ? decks.A.view.getVisible() : null;
      fs.writeFileSync(path.join(out, 'video-window.png'), (await vw.webContents.capturePage()).toPNG());
    }
    // una pista sin video: portada, y la ventana no muestra mosaico
    await js(`const A=__app.decks.A; A.togglePlay(); await A.load(${JSON.stringify(rows[1])}); return 1`);
    await wait(1500);
    res.noVideo = await js(probe);
    if (vw && !vw.isDestroyed()) res.vwinNone = await js(`return document.getElementById('v-A').style.display`, vw);
    fs.writeFileSync(path.join(out, 'video-local.json'), JSON.stringify(res));
    win.close();
  });
};
