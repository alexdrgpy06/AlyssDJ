// Autoprueba de la preescucha: fila local y fila de streaming, ▶, barra de progreso, salto y parada con la app real. En silencio.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const R = {};
    try {
      win.setContentSize(1400, 900); await wait(2500);
      await js(`__app.preview.volume = 0; return 1`);
      const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`);
      const stream = { videoId: 'streamstrm1', title: 'Solo streaming', artist: 'X', duration: 200 };
      await js(`__app.library.tab = 'analyzed'; __app.library.render([${JSON.stringify(row)}, ${JSON.stringify(stream)}]); return 1`); await wait(300);
      const btn = (id) => `const b = document.querySelector('#tracks tr[data-id="${id}"] .pv'); return { disabled: b.disabled, title: b.title }`;
      R.start = { local: await js(btn(row.videoId)), stream: await js(btn('streamstrm1')) };
      const snap = `const tr = document.querySelector('#tracks tr[data-id="${row.videoId}"]'); const b = tr.querySelector('.pv'); const bar = tr.querySelector('.pv-bar'); const p = __app.preview;
        return { on: b.classList.contains('on'), text: b.textContent, bar: !!bar, t: p.state ? p.state.t : null, dur: p.state ? p.state.dur : null, state: p.state, decksLoaded: !!(__app.decks.A.track || __app.decks.B.track) }`;
      await js(`document.querySelector('#tracks tr[data-id="${row.videoId}"] .pv').click(); return 1`); await wait(1800);
      R.playing = await js(snap);
      // clic en la barra, en su último cuarto
      await js(`const bar = document.querySelector('#tracks tr[data-id="${row.videoId}"] .pv-bar'); const r = bar.getBoundingClientRect(); bar.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * 0.8, clientY: r.top + 1 })); return 1`); await wait(400);
      R.sought = await js(snap);
      await js(`document.querySelector('#tracks tr[data-id="${row.videoId}"] .pv').click(); return 1`); await wait(400);
      R.stopped = await js(snap);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'preescucha.json'), JSON.stringify(R));
    win.close();
  });
};
