// Autoprueba de géneros: chips en la librería, filtro por género y editor de etiquetas con el almacén real.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => wc.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const R = {};
    win.setContentSize(1400, 900); await wait(2500);
    const snap = `const rows = [...document.querySelectorAll('#tracks tr[data-id]')]; return { ids: rows.map((r) => r.dataset.id), chips: Object.fromEntries(rows.map((r) => [r.dataset.id, [...r.querySelectorAll('.gchips .gchip:not(.more)')].map((c) => c.textContent)])), btn: !document.getElementById('btn-genres').hidden, label: document.getElementById('btn-genres-label').textContent, editor: !!document.querySelector('.gedit-row'), focus: document.activeElement && (document.activeElement.className || document.activeElement.id) }`;
    try {
      await js(`await __app.library.refreshAnalyzed?.(); __app.library.show('analyzed'); return 1`); await wait(1200);
      R.start = await js(snap);
      // filtro: Techno deja dos pistas; quitar el filtro las devuelve
      await js(`document.getElementById('btn-genres').click(); return 1`); await wait(150);
      R.menu = await js(`const m = document.getElementById('genre-menu'); return { open: !m.hidden, expanded: document.getElementById('btn-genres').getAttribute('aria-expanded'), items: [...m.querySelectorAll('label')].map((l) => l.textContent) }`);
      await js(`const c = document.querySelector('#genre-menu input[data-g="Techno"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(200);
      R.filtered = await js(snap);
      await js(`document.querySelector('#genre-menu .gclear').click(); return 1`); await wait(200);
      R.cleared = await js(snap);
      await js(`document.getElementById('genre-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1`); await wait(100);
      R.esc = await js(`return { open: !document.getElementById('genre-menu').hidden, focus: document.activeElement.id }`);
      // editor: añadir «Deep House» a la pista sin género, con Enter; Escape cierra y la fila muestra el chip
      await js(`document.querySelector('#tracks tr[data-id="ccccccccccc"] .gn').click(); return 1`); await wait(200);
      R.editorOpen = await js(`return { editor: !!document.querySelector('.gedit-row'), focus: document.activeElement.className }`);
      await js(`const i = document.querySelector('.gedit-in'); i.value = 'deep house'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return 1`); await wait(700);
      R.added = await js(`return { editor: !!document.querySelector('.gedit-row'), chips: [...document.querySelectorAll('.gedit-chips .gchip')].map((c) => c.firstChild.textContent) }`);
      await js(`document.querySelector('.gedit-in').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 1`); await wait(400);
      R.closed = await js(snap);
      R.vocab = await js(`return (await window.ytdj.genres.all()).vocabulary.map((v) => v.name + ':' + v.n)`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'generos.json'), JSON.stringify(R));
    win.close();
  });
};
