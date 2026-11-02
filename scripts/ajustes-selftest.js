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
    // ---- guardado al cambiar (sin cerrar el diálogo) ----
    await js(`__app.setSettingsPane('decks'); return 1`);
    const setv = (name, v) => js(`const el = document.querySelector('#settings form [name="${name}"]'); if (el.type === 'checkbox') el.checked = ${JSON.stringify(v)}; else el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 350)); return 1`);
    const cur = () => js(`const s = await window.ytdj.settings.get(); const f = document.querySelector('#settings form'); return { pitch: s.pitchRange, curve: s.crossfaderCurve, prefer: s.preferSaved, ctlPitch: f.pitchRange.value, ctlCurve: f.crossfaderCurve.value, ctlPrefer: f.preferSaved.checked, saved: document.getElementById('set-saved').textContent, err: [...document.querySelectorAll('#settings .set-err')].map((e) => e.textContent), open: document.getElementById('settings').open }`);
    await setv('pitchRange', '16'); res.s1 = await cur();
    await setv('preferSaved', false); res.s2 = await cur();
    await wait(1800); res.s3 = await cur();
    // fallo al guardar: el control vuelve a su valor y se explica (no aplica como administrador)
    const file = path.join(process.env.YTDJ_USERDATA, 'settings.json');
    res.canFail = !(process.getuid && process.getuid() === 0);
    if (res.canFail) { fs.chmodSync(file, 0o444); await setv('crossfaderCurve', 'sharp'); res.fail = await cur(); fs.chmodSync(file, 0o644); }
    // restablecer sección: pide confirmación; sólo toca esa sección
    await js(`window.confirm = () => false; return 1`);
    await js(`document.querySelector('#settings .set-pane[data-pane="decks"] [data-reset]').click(); await new Promise((r) => setTimeout(r, 300)); return 1`); res.resetNo = await cur();
    await js(`window.confirm = () => true; document.querySelector('#settings .set-pane[data-pane="decks"] [data-reset]').click(); await new Promise((r) => setTimeout(r, 500)); return 1`); res.resetYes = await cur();
    // restablecer vistas
    await js(`__app.splits.drag('mix', 'waves', 200); document.getElementById('btn-reset-views').click(); await new Promise((r) => setTimeout(r, 200)); return 1`);
    res.viewsReset = await js(`return { active: __app.splits.active('mix'), stored: JSON.parse(localStorage.getItem('alyssdj.splits')), saved: document.getElementById('set-saved').textContent }`);
    fs.writeFileSync(path.join(out, 'ajustes.json'), JSON.stringify(res));
    win.close();
  });
};
