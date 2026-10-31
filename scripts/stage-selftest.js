// Autoprueba de la vista AutoMix con miniaturas: disposición, video correcto, tamaño, persistencia y doble clic.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { BrowserWindow } = require('electron');
module.exports = (win) => {
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
    // la primera pista tiene video guardado (generado con ffmpeg); la segunda no
    const YT = 'TESTVID0002';
    await js(`await window.ytdj.analysis.setMeta(${JSON.stringify(rows[0].videoId)}, { ytId: ${JSON.stringify(YT)} }); return 1`);
    const libDir = await js(`return await window.ytdj.settings.libraryDir()`);
    fs.mkdirSync(path.join(libDir, '.video'), { recursive: true });
    const ff = require(path.join(__dirname, '../main/tools'));
    const bin = (await ff.findFfmpeg('', [path.join(__dirname, '../bin')])).bin;
    execFileSync(bin, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15:duration=120', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '15', path.join(libDir, '.video', `${YT}.mp4`)]);

    const tile = (id) => `const t=document.querySelector('.tile[data-deck="${id}"]'); const v=t.querySelector('video'); const r=t.getBoundingClientRect(); const m=t.querySelector('.t-media').getBoundingClientRect(); return { kind:t.dataset.kind, track:t.dataset.track, cls:t.className, vhidden:v.hidden, vsrc:v.getAttribute('src'), vt:v.currentTime, vpaused:v.paused, label:t.querySelector('.t-label').hidden?'':t.querySelector('.t-label').textContent, title:t.querySelector('.t-title').textContent, w:r.width, mw:m.width, mh:m.height, op:getComputedStyle(t).opacity }`;
    // 1) activar la vista desde la pestaña AutoMix
    res.before = await js(`const r=(s)=>{const b=document.querySelector(s).getBoundingClientRect();return {h:b.height,t:b.top}}; return { console:r('.console'), library:r('.library') }`);
    await js(`__app.library.show('automix'); await new Promise(r=>setTimeout(r,400)); document.getElementById('amv-stage').click(); await new Promise(r=>setTimeout(r,600)); return 1`);
    res.layout = await js(`const cs=getComputedStyle(document.querySelector('.console')); const st=document.getElementById('stage'); const sr=st.getBoundingClientRect(); const lib=document.querySelector('.library').getBoundingClientRect(); return { bodyCls:document.body.className, consoleDisplay:cs.display, stageHidden:st.hidden, stageH:sr.height, stageB:sr.bottom, libH:lib.height, libT:lib.top, sh:document.documentElement.scrollHeight, h:innerHeight, sw:document.documentElement.scrollWidth, w:innerWidth, deckInDom:!!document.querySelector('#deck-A .deck'), pressed:document.getElementById('amv-stage').getAttribute('aria-pressed'), grip:document.querySelector('.stage-grip').getBoundingClientRect().width }`);
    // 2) deck A con video suena; B sin video
    await js(`const A=__app.decks.A; await A.load(${JSON.stringify(rows[0])}); A.seek(20); A.togglePlay(); return 1`);
    await js(`await __app.decks.B.load(${JSON.stringify(rows[1])}); return 1`);
    await wait(3500);
    res.live = { A: await js(tile('A')), B: await js(tile('B')), pos: await js(`return __app.decks.A.pos()`) };
    fs.writeFileSync(path.join(out, 'stage-live.png'), (await win.webContents.capturePage()).toPNG());
    // 3) cambiar la pista de A por la que no tiene video: nunca queda el video de la anterior
    await js(`const A=__app.decks.A; if (A.st.playing) A.togglePlay(); await A.load(${JSON.stringify(rows[1])}, { force: true }); return 1`);
    await wait(200);
    res.swapped = await js(tile('A'));
    await wait(1200);
    res.swapped2 = await js(tile('A'));
    // 4) tamaño: teclado en el asa, atajos [ ], límites y persistencia
    res.size = {};
    await js(`__app.stage.setWidth(320); return 1`);
    await js(`const g=document.querySelector('.stage-grip'); g.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); return 1`);
    res.size.key = (await js(tile('A'))).w;
    await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:']',bubbles:true})); return 1`);
    res.size.bracket = (await js(tile('A'))).w;
    await js(`__app.stage.setWidth(99999); return 1`);
    res.size.max = (await js(tile('A'))).w;
    await js(`__app.stage.setWidth(1); return 1`);
    res.size.min = (await js(tile('A'))).w;
    await js(`__app.stage.setWidth(400); return 1`);
    res.size.drag = await js(`const g=document.querySelector('.stage-grip'); const r=g.getBoundingClientRect(); const x=r.left+5, y=r.top+5; const ev=(t,cx)=>g.dispatchEvent(new PointerEvent(t,{clientX:cx,clientY:y,pointerId:1,bubbles:true})); try{g.setPointerCapture=()=>{};}catch{} ev('pointerdown',x); ev('pointermove',x+60); ev('pointerup',x+60); return __app.stage.width`);
    res.size.ratio = await js(tile('A'));
    res.stored = await js(`return localStorage.getItem('alyssdj.stage')`);
    // 5) doble clic abre la ventana de video de ese deck
    await js(`document.querySelector('.tile[data-deck="B"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); return 1`);
    await wait(2500);
    res.videoWin = BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.getTitle().includes('Video'));
    // 6) fuera de la pestaña AutoMix o apagada, la consola vuelve entera y los decks conservan su estado
    const posBefore = await js(`return __app.decks.B.pos()`);
    await js(`__app.library.show('search'); await new Promise(r=>setTimeout(r,500)); return 1`);
    res.otherTab = await js(`return { cls: document.body.className, display: getComputedStyle(document.querySelector('.console')).display, stageHidden: document.getElementById('stage').hidden, t: __app.decks.B.track?.videoId }`);
    await js(`__app.library.show('automix'); await new Promise(r=>setTimeout(r,500)); document.getElementById('amv-stage').click(); await new Promise(r=>setTimeout(r,500)); return 1`);
    res.off = await js(`return { cls: document.body.className, display: getComputedStyle(document.querySelector('.console')).display, pos: __app.decks.B.pos(), pressed: document.getElementById('amv-stage').getAttribute('aria-pressed') }`);
    res.posBefore = posBefore;
    fs.writeFileSync(path.join(out, 'stage.json'), JSON.stringify({ ...res, ids: [rows[0].videoId, rows[1].videoId] }));
    win.close();
  });
};
