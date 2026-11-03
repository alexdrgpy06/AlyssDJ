// Autoprueba de la interfaz de stems: la tira del deck y los botones de la Librería con una separación real (reparto falso del hijo).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.setAudioMuted(true);
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT; const music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const R = {};
    try {
      win.setContentSize(1400, 900); await wait(2500);
      await js(`window.confirm = () => true; return 1`);
      const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`); const id = row.videoId; R.id = id;
      const stream = { videoId: 'streamstrm1', title: 'Solo streaming', artist: 'X', duration: 200 };
      await js(`__app.library.tab = 'analyzed'; __app.library.render([${JSON.stringify(row)}, ${JSON.stringify(stream)}]); return 1`); await wait(300);
      await js(`const d = __app.decks.A; await d.load(${JSON.stringify(row)}, { play: false }); return 1`); await wait(1500);
      const strip = `const s = document.querySelector('#deck-A .stems'); const g = (q) => s.querySelector(q);
        return { mode: s.dataset.mode, go: g('.stems-go').hidden ? null : g('.stems-go').textContent, goOff: g('.stems-go').disabled, goTitle: g('.stems-go').title, msg: g('.stems-msg').textContent, x: !g('.stems-x').hidden, bar: !g('.stems-bar').hidden, p: g('.stems-bar').style.getPropertyValue('--p'),
          group: !g('.stems-btns').hidden, off: !g('.stems-off').hidden, pressed: [...s.querySelectorAll('.stem')].map((b) => b.getAttribute('aria-pressed')), solo: [...s.querySelectorAll('.stem')].map((b) => b.classList.contains('solo')), labels: [...s.querySelectorAll('.stem')].map((b) => b.getAttribute('aria-label')) }`;
      const rowSnap = (rid) => `const tr = document.querySelector('#tracks tr[data-id="${rid}"]'); const b = tr.querySelector('.stm'); return { text: b.textContent.trim(), cls: b.className, disabled: b.disabled, title: b.title, chip: !!tr.querySelector('.stm-chip'), chipTitle: tr.querySelector('.stm-chip')?.title || '' }`;
      const sum = `const s = document.getElementById('stems-sum'); return { hidden: s.hidden, text: document.getElementById('stems-sum-txt').textContent }`;
      R.status = await js(`return await window.ytdj.stems.status()`);
      R.s0 = await js(strip); R.row0 = await js(rowSnap(id)); R.rowStream = await js(rowSnap('streamstrm1')); R.sum0 = await js(sum);
      R.reqStream = await js(`return await window.ytdj.stems.request('streamstrm1')`);
      // separar desde el deck: se ve el trabajo en curso en el deck y en la fila, y termina con los stems listos
      await js(`document.querySelector('#deck-A .stems-go').click(); return 1`);
      R.work = null; R.rowWork = null;
      for (let i = 0; i < 1500; i++) { const s = await js(strip); if (s.mode === 'work' && s.msg.includes('%') && !R.work) { R.work = s; R.rowWork = await js(rowSnap(id)); } if (s.mode === 'ready' || s.mode === 'error') break; await wait(50); }
      R.ready = await js(strip); R.rowReady = await js(rowSnap(id)); R.sumReady = await js(sum); R.list = await js(`return await window.ytdj.stems.list()`);
      // activar, silenciar, aislar, volver
      await js(`document.querySelector('#deck-A .stems-go').click(); return 1`); await wait(1000); R.active = await js(strip);
      fs.writeFileSync(path.join(out, 'stems-active.png'), (await wc.capturePage()).toPNG());
      await js(`document.querySelector('#deck-A .stem[data-s="3"]').click(); return 1`); await wait(300); R.muted = await js(strip);
      await js(`document.querySelector('#deck-A .stem[data-s="0"]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); return 1`); await wait(300); R.soloed = await js(strip);
      await js(`document.querySelector('#deck-A .stems-off').click(); return 1`); await wait(600); R.back = await js(strip);
      // borrar desde la Librería
      await js(`document.querySelector('#tracks tr[data-id="${id}"] .stm').click(); return 1`); await wait(600); R.deleted = await js(strip); R.rowDeleted = await js(rowSnap(id)); R.sumDeleted = await js(sum);
      // cancelar un trabajo en curso desde el deck
      await js(`document.querySelector('#deck-A .stems-go').click(); return 1`);
      for (let i = 0; i < 100; i++) { if ((await js(strip)).mode === 'work') break; await wait(30); }
      R.beforeCancel = await js(strip); fs.writeFileSync(path.join(out, 'stems-work.png'), (await wc.capturePage()).toPNG()); await js(`document.querySelector('#deck-A .stems-x').click(); return 1`); await wait(1200); R.cancelled = await js(strip);
      R.listAfter = await js(`return await window.ytdj.stems.list()`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'stems-ui.json'), JSON.stringify(R));
    win.close();
  });
};
