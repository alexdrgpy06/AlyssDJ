// Autoprueba de la vista: buscar desde AutoMix (YouTube Music real + librería), agregar con posición, sugeridas y popularidad.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const music = process.env.YTDJ_DOCS_MUSIC;
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = {};
    win.setContentSize(1600, 960);
    await wait(9000); // YouTube Music tarda en cargar
    await js(`__app.masterGain = 0; return 1`);
    // librería local de demostración, ya analizada
    const rows = [];
    for (const n of ['Neon Drive', 'Sunset Groove', 'Night Pulse', 'Deep Signal']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
    await js(`await window.ytdj.settings.set({ musicDirs: [${JSON.stringify(music)}] }); for (const r of ${JSON.stringify(rows)}) window.ytdj.analysis.request(r.videoId, { meta: { title: r.title, artist: r.artist, thumb: r.thumb, trackDuration: r.duration }, file: r.path }); return 1`);
    for (let i = 0; i < 80; i++) { await wait(500); if (await js(`let n=0; for (const r of ${JSON.stringify(rows)}) if (await window.ytdj.analysis.get(r.videoId)) n++; return n===4`)) break; }
    await js(`const am = __app.automix; am.cfg.preferLocal = false; am.cfg.endless = false; am.on = true;
      const A = __app.decks.A; A.track = ${JSON.stringify(rows[0])}; A.analysis = await window.ytdj.analysis.get(${JSON.stringify(rows[0].videoId)}); A.st = { playing: true, dur: 110, ready: true, videoId: A.track.videoId, pos: 20, rate: 1 }; am.cur = A; am.ana.set(A.track.videoId, A.analysis);
      am.queue = [${JSON.stringify(rows[1])}]; for (const r of [${JSON.stringify(rows[1])}]) am.ana.set(r.videoId, await window.ytdj.analysis.get(r.videoId));
      document.querySelector('.sources [data-tab="automix"]').click(); am.emit(); return 1`);
    await wait(800);
    // 1) buscar en la propia vista: resultados de YouTube Music (con reproducciones) y de la librería
    res.search = await js(`const i=document.getElementById('amv-search'); i.value='neon drive'; i.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,2500)); const rows=[...document.querySelectorAll('#amv-results .am-res')].map(li=>({title:li.querySelector('b').textContent, sub:li.querySelector('small').textContent, plays: li.querySelector('.am-plays')?.textContent||'', hint: li.querySelector('.am-hint').textContent})); return { hidden: document.getElementById('amv-results').hidden, rows }`);
    res.search2 = await js(`const i=document.getElementById('amv-search'); i.value='daft punk one more time'; i.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,4500)); const rows=[...document.querySelectorAll('#amv-results .am-res')].map(li=>({title:li.querySelector('b').textContent, plays: li.querySelector('.am-plays')?.textContent||'', src: li.querySelector('small').textContent})); return { rows }`);
    fs.writeFileSync(path.join(out, 'add-search.png'), (await win.webContents.capturePage()).toPNG());
    // 2) agregar una de la librería (analizada): va a su mejor lugar y dice cuál
    res.addLib = await js(`const i=document.getElementById('amv-search'); i.value='deep signal'; i.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,2500)); const li=[...document.querySelectorAll('#amv-results .am-res')].find(l=>l.querySelector('b').textContent==='Deep Signal'); const hint=li.querySelector('.am-hint').textContent; li.querySelector('[data-act="add"]').click(); await new Promise(r=>setTimeout(r,400)); return { hint, queue:[...document.querySelectorAll('#amv-list .am-item b')].map(b=>b.firstChild.textContent), note: document.getElementById('amv-note').textContent }`);
    // 3) duplicado: avisa y no repite
    res.dup = await js(`const am=__app.automix; const before=am.queue.length; const r=am.addSmart(${JSON.stringify(rows[1])}); return { reason: r.reason, same: am.queue.length===before }`);
    // 4) Enter agrega la primera
    res.enter = await js(`const i=document.getElementById('amv-search'); i.value='night pulse'; i.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,2500)); const before=__app.automix.queue.length; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await new Promise(r=>setTimeout(r,2500)); return { before, after: __app.automix.queue.length, has: __app.automix.queue.some(t=>t.title==='Night Pulse') }`);
    // 5) sugeridas: radio de YouTube Music (con popularidad) + analizadas de la librería
    await js(`const am=__app.automix; am.cur.track={...am.cur.track}; am.queue.length=Math.min(am.queue.length,2); am.poolAt=-Infinity; am.libPoolAt=-Infinity; return 1`);
    await js(`document.getElementById('amv-search').value=''; document.getElementById('amv-search').dispatchEvent(new Event('input')); return 1`);
    res.suggest = await js(`const am=__app.automix; am.radioPool=[]; await am.refreshPools(); await new Promise(r=>setTimeout(r,500)); am.emit(); await new Promise(r=>setTimeout(r,500)); return { n: document.querySelectorAll('#amv-sug-list .am-res').length, hidden: document.getElementById('amv-suggest').hidden, rows:[...document.querySelectorAll('#amv-sug-list .am-res')].map(li=>({ t: li.querySelector('b').textContent, plays: li.querySelector('.am-plays')?.textContent||'', wait: !!li.querySelector('.am-wait') })) }`);
    // la radio se consulta desde una pista local sin equivalente: sembrar con una de YouTube
    fs.writeFileSync(path.join(out, 'add-suggest.png'), (await win.webContents.capturePage()).toPNG());
    // 6) controles de popularidad
    res.pop = await js(`const c=document.getElementById('amv-pop'); const w=document.getElementById('amv-popw'); const a={checked:c.checked, val:w.value, disabled:w.disabled}; c.click(); await new Promise(r=>setTimeout(r,300)); return { before:a, after:{checked:c.checked, disabled:w.disabled, cfg:__app.automix.cfg.popularity} }`);
    fs.writeFileSync(path.join(out, 'add.json'), JSON.stringify(res));
    win.close();
  });
};
