// Autoprueba: la vista de AutoMix muestra el estado de análisis, la calidad y los botones Reorganizar/Deshacer.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack}}})()`, true);
    win.setContentSize(1600, 960);
    await new Promise((r) => setTimeout(r, 2500));
    const res = await js(`
      const am = __app.automix;
      const mk = (id, bpm, key) => ({ videoId: id, title: 'Pista ' + id, artist: 'Demo', duration: 200, local: false });
      const bp = { a: 150, b: 126, c: 140, d: 122, e: 132 };
      am.cfg.preferLocal = false; // sin descargas reales
      am.queue = Object.keys(bp).map((id) => mk(id));
      for (const id of Object.keys(bp)) am.ana.set(id, { id, bpm: bp[id], camelot: '8A', duration: 200, offset: 0, mix: { mixIn: 8, mixOut: [{ t: 180, score: 1 }], phrases: new Array(12).fill(60), phraseBeats: 16 } });
      document.querySelector('.sources [data-tab="automix"]').click();
      am.emit();
      await new Promise(r => setTimeout(r, 400));
      const before = [...document.querySelectorAll('#amv-list .am-item b')].map(b => b.firstChild.textContent);
      const cur0 = { bpm: 124, camelot: '8A', duration: 200, offset: 0 };
      am.cur = { id: 'A', track: { videoId: 'CUR' }, analysis: cur0, remaining: () => 100, st: { playing: true } };
      __app.other = (d) => __app.decks.B;
      document.getElementById('amv-reorder').click();
      await new Promise(r => setTimeout(r, 400));
      const after = [...document.querySelectorAll('#amv-list .am-item b')].map(b => b.firstChild.textContent);
      const q = [...document.querySelectorAll('#amv-list .am-q')].map(e => e.className);
      const quality = document.getElementById('amv-quality').textContent;
      const undoOn = !document.getElementById('amv-undo').disabled;
      document.getElementById('amv-undo').click();
      await new Promise(r => setTimeout(r, 400));
      const undone = [...document.querySelectorAll('#amv-list .am-item b')].map(b => b.firstChild.textContent);
      return { before, after, q, quality, undoOn, undone, order: document.getElementById('amv-order').checked, label: document.querySelector('label:has(#amv-order)').textContent.trim() };`);
    fs.writeFileSync(path.join(process.env.YTDJ_SELFTEST_OUT, 'queue.png'), (await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(process.env.YTDJ_SELFTEST_OUT, 'queue.json'), JSON.stringify(res));
    win.close();
  });
};
