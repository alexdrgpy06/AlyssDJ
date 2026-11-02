// Autoprueba de la interfaz: selector «Salir», «Saltar siguiente», «Barajar» y el estado con la duración.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.removeItem('alyssdj:automix'); return 1`);
    const rows = [];
    for (const n of ['Neon Drive', 'Night Pulse', 'Sunset Groove', 'Deep Signal']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
    for (const r of rows) await js(`window.ytdj.analysis.request(${JSON.stringify(r.videoId)}, { meta: { title: ${JSON.stringify(r.title)}, artist: ${JSON.stringify(r.artist)}, thumb: ${JSON.stringify(r.thumb)}, trackDuration: ${r.duration} }, file: ${JSON.stringify(r.path)} }); return 1`);
    for (let i = 0; i < 120; i++) { await wait(500); if (await js(`const a = await Promise.all(${JSON.stringify(rows.map((r) => r.videoId))}.map((id) => window.ytdj.analysis.get(id))); return a.every(Boolean)`)) break; }
    await js(`const am = __app.automix; am.setCfg({ smartOrder: false, endless: false, exitMode: 'optimal' }); await am.start({ tracks: ${JSON.stringify(rows)} }); __app.library.show('automix'); return 1`); await wait(2500);
    const probe = `const am = __app.automix; const st = am.snapshot(); const q = (s) => document.querySelector(s);
      return { exit: q('#amv-exit').value, options: [...q('#amv-exit').options].map((o) => o.value), skipDis: q('#amv-skip').disabled, shuffleDis: q('#amv-shuffle').disabled, immSkipDis: q('#imm-skip').disabled,
        queue: st.queue.map((t) => t.videoId.slice(-4)), cfgExit: st.exitMode, status: q('#amv-status').textContent, smart: q('#amv-order').checked, note: q('#amv-note').textContent, plan: st.plan && { mode: st.plan.mode, seconds: st.plan.seconds, kind: st.plan.kind } }`;
    res.start = await js(probe);
    // elegir modo desde el selector
    for (const m of ['intro-outro', 'outro-start', 'end']) {
      await js(`const s = document.getElementById('amv-exit'); s.value = '${m}'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(500);
      res['mode_' + m] = await js(probe);
    }
    // persistencia: el modo elegido queda guardado
    res.stored = await js(`return JSON.parse(localStorage.getItem('alyssdj:automix') || localStorage.getItem('alyssdj.automix') || '{}').exitMode || Object.keys(localStorage).filter((k) => /automix/i.test(k)).map((k) => k + '=' + localStorage.getItem(k).slice(0, 200))`);
    // barajar: apaga «Orden automático» y deshacer devuelve el orden
    await js(`__app.automix.setCfg({ smartOrder: true }); return 1`); await wait(300);
    const order0 = await js(`return __app.automix.queue.map((t) => t.videoId.slice(-4))`);
    await js(`document.getElementById('amv-shuffle').click(); return 1`); await wait(500);
    res.shuffled = await js(probe); res.order0 = order0; res.pinned = await js(`return [...__app.automix.pinned]`); res.heads = await js(`const am = __app.automix; return { loading: am.loadingNext, prep: am.prepOf(am.queue[0]).state, other: __app.other(am.cur).track && __app.other(am.cur).track.videoId.slice(-4) }`);
    await js(`document.getElementById('amv-undo').click(); return 1`); await wait(400);
    res.undone = await js(`return __app.automix.queue.map((t) => t.videoId.slice(-4))`);
    // saltar siguiente
    const before = await js(`return __app.automix.queue.length`);
    await js(`document.getElementById('amv-skip').click(); return 1`); await wait(500);
    res.skipped = await js(probe); res.skippedBefore = before;
    // vista Automix: botón de saltar
    await js(`__app.setView('automix'); return 1`); await wait(700);
    res.imm = await js(`return { skip: !!document.getElementById('imm-skip').offsetParent, dis: document.getElementById('imm-skip').disabled, status: document.getElementById('imm-status').textContent }`);
    await js(`document.getElementById('imm-skip').click(); return 1`); await wait(400);
    res.immAfter = await js(`return __app.automix.queue.length`);
    fs.writeFileSync(path.join(out, 'automix-exit.png'), (await win.webContents.capturePage()).toPNG());
    await js(`__app.setView('library'); __app.library.show('automix'); return 1`); await wait(600);
    fs.writeFileSync(path.join(out, 'automix-exit-lib.png'), (await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(out, 'salida.json'), JSON.stringify(res));
    win.close();
  });
};
