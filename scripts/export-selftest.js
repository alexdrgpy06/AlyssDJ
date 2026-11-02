// Autoprueba de «Exportar»: botón y menú en la Librería, teclado, los tres formatos con la ruta fijada por YTDJ_EXPORT_FILE y los avisos.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const R = {};
    win.setContentSize(1400, 900); await wait(2500);
    const target = process.env.YTDJ_EXPORT_FILE;
    const snap = `const b = document.getElementById('btn-export'); const m = document.getElementById('export-menu'); return { btn: !b.hidden, expanded: b.getAttribute('aria-expanded'), menu: !m.hidden, focus: document.activeElement && (document.activeElement.dataset.fmt || document.activeElement.id), items: [...m.querySelectorAll('[role=menuitem]')].length, msg: document.getElementById('lib-msg').textContent, tab: __app.library.tab }`;
    try {
      await js(`__app.library.show('search'); return 1`); await wait(300); R.search = await js(snap);
      await js(`await __app.library.refreshAnalyzed?.(); __app.library.show('analyzed'); return 1`); await wait(900); R.analyzed = await js(snap);
      // menú: abrir, teclado, Escape devuelve el foco
      await js(`document.getElementById('btn-export').click(); return 1`); await wait(100); R.open = await js(snap);
      await js(`document.getElementById('export-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); return 1`); await wait(50); R.down = await js(snap);
      await js(`document.getElementById('export-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1`); await wait(50); R.esc = await js(snap);
      // clic fuera cierra
      await js(`document.getElementById('btn-export').click(); document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return 1`); await wait(50); R.outside = await js(snap);
      // los tres formatos
      R.files = {};
      for (const fmt of ['m3u8', 'csv', 'rekordbox']) {
        try { fs.unlinkSync(target); } catch { /* aún no existe */ }
        await js(`document.getElementById('btn-export').click(); document.querySelector('[data-fmt="${fmt}"]').click(); return 1`); await wait(900);
        R.files[fmt] = { text: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null, snap: await js(snap), tmp: fs.existsSync(target + '.tmp') };
      }
      // fallo de escritura: ruta en una carpeta que no existe
      process.env.YTDJ_EXPORT_FILE = path.join(out, 'no', 'existe', 'x.csv');
      await js(`document.getElementById('btn-export').click(); document.querySelector('[data-fmt="csv"]').click(); return 1`); await wait(900); R.fail = await js(snap);
      process.env.YTDJ_EXPORT_FILE = target;
      // playlist importada
      await js(`__app.library.show('imported'); return 1`); await wait(500); R.imported = await js(snap);
      R.openErr = await js(`await __app.library.openPlaylist({ title: 'Mi lista', browseId: 'PL1', crate: true }); return 1`); await wait(600); R.crate = await js(snap);
      try { fs.unlinkSync(target); } catch { /* sin archivo */ }
      await js(`document.getElementById('btn-export').click(); document.querySelector('[data-fmt="csv"]').click(); return 1`); await wait(900);
      R.crateCsv = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null; R.crateMsg = (await js(snap)).msg;
      await js(`__app.library.show('search'); return 1`); await wait(300); R.after = await js(snap);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'export.json'), JSON.stringify(R));
    win.close();
  });
};
