// Autoprueba: vista «Análisis», botón «Analizar lista», pausa/reanudación y contador.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; return 1`);
    const rows = [];
    for (const n of ['Neon Drive', 'Night Pulse']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
    res.rows = rows.length;
    // pausar, encolar desde el botón de la librería y ver el estado
    await js(`await window.ytdj.backlog.pause(); return 1`);
    await js(`const L = __app.library; L.tab = 'search'; L.listName = 'Demo'; L.render(${JSON.stringify(rows)}); return 1`);
    res.btnVisible = await js(`return !document.getElementById('btn-analyze-list').hidden`);
    await js(`document.getElementById('btn-analyze-list').click(); return 1`); await wait(700);
    res.counter = await js(`return document.getElementById('cnt-queue').textContent`);
    await js(`document.querySelector('.sources [data-tab="queue"]').click(); return 1`); await wait(500);
    res.paused = await js(`return { status: document.getElementById('qv-status').textContent, pauseBtn: document.getElementById('qv-pause').textContent, cards: document.querySelectorAll('.qv-card').length, items: document.querySelectorAll('.qv-items li').length, empty: document.getElementById('qv-empty').hidden, view: !document.getElementById('queue-view').hidden, table: document.querySelector('.table-wrap').hidden }`);
    // encolar otra vez lo mismo: no duplica
    res.again = await js(`return await window.ytdj.backlog.add({ name: 'Demo', tracks: ${JSON.stringify(rows.map((r) => ({ videoId: r.videoId, title: r.title, local: true, path: r.path })))} })`);
    // reanudar: se analizan de a una hasta terminar
    await js(`document.getElementById('qv-pause').click(); return 1`);
    for (let i = 0; i < 80; i++) { await wait(500); if (await js(`return (await window.ytdj.backlog.state()).pending === 0`)) break; }
    await wait(600);
    res.done = await js(`const s = await window.ytdj.backlog.state(); return { pending: s.pending, done: s.lists[0] && s.lists[0].done, total: s.lists[0] && s.lists[0].total, card: document.querySelector('.qv-count') && document.querySelector('.qv-count').textContent, counter: document.getElementById('cnt-queue').textContent }`);
    res.analyzed = await js(`return (await window.ytdj.analysis.list()).length`);
    fs.writeFileSync(path.join(out, 'queue.png'), (await win.webContents.capturePage()).toPNG());
    // quitar terminadas deja la vista vacía
    await js(`document.getElementById('qv-clear').click(); return 1`); await wait(500);
    res.cleared = await js(`return { cards: document.querySelectorAll('.qv-card').length, empty: !document.getElementById('qv-empty').hidden }`);
    fs.writeFileSync(path.join(out, 'queue-ui.json'), JSON.stringify(res));
    win.close();
  });
};
