// Autoprueba de Ajustes: secciones, búsqueda, guardado al cambiar y restablecer.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1366, 768); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); return 1`);
    const state = `const vis = (s) => [...document.querySelectorAll(s)].filter((e) => !e.hidden && e.offsetParent !== null);
      return { open: document.getElementById('settings').open, tabs: [...document.querySelectorAll('#settings .set-nav button[data-pane]')].map((b) => b.dataset.pane + (b.classList.contains('on') ? '*' : '') + (b.classList.contains('dim') ? '~' : '')),
        panes: vis('#settings .set-pane').map((p) => p.dataset.pane), shown: vis('#settings .set-pane > :not(h3)').map((e) => e.textContent.trim().slice(0, 40)),
        empty: !document.getElementById('set-empty').hidden, q: document.getElementById('set-search').value, sw: document.getElementById('settings').scrollWidth, cw: document.getElementById('settings').clientWidth, h: Math.round(document.querySelector('#settings .settings').getBoundingClientRect().height), ih: innerHeight }`;
    const type = (q) => js(`const i = document.getElementById('set-search'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 150)); return 1`);
    await js(`await __app.openSettings(); return 1`); await wait(400);
    res.first = await js(state);
    // buscar por etiqueta, por ayuda, sin tildes y sin resultados
    await type('pitch'); res.pitch = await js(state);
    await type('curva crossfader'); res.curve = await js(state);
    await type('ACTUALIZACION'); res.upd = await js(state);
    await type('copia guardada'); res.help = await js(state);
    await type('zzzxxy'); res.none = await js(state);
    await js(`document.getElementById('set-clear').click(); await new Promise((r) => setTimeout(r, 150)); return 1`); res.cleared = await js(state);
    // Esc con texto limpia la búsqueda sin cerrar el diálogo
    await type('audio');
    await js(`document.getElementById('set-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 150)); return 1`); res.esc = await js(state);
    // cambiar de sección y reabrir: recuerda la última usada
    await js(`__app.setSettingsPane('audio'); document.getElementById('settings').close(); await __app.openSettings(); return 1`); await wait(300);
    res.remember = await js(state);
    // flechas entre secciones
    await js(`const b = document.querySelector('#sn-audio'); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 150)); return 1`); res.arrow = await js(state);
    // las flechas dentro del buscador no cambian de sección
    await js(`const i = document.getElementById('set-search'); i.focus(); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 150)); return 1`); res.arrowSearch = await js(state);
    res.ext = res.ext || {};
    try { Object.assign(res, JSON.parse(fs.readFileSync(path.join(out, 'ajustes-extra.json'), 'utf8'))); } catch {}
    fs.writeFileSync(path.join(out, 'ajustes.json'), JSON.stringify(res));
    win.close();
  });
};
