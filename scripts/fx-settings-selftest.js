// Autoprueba de Ajustes → Efectos y filtros.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    const res = {};
    win.setContentSize(1600, 960); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); await __app.openSettings(); __app.setSettingsPane('fx'); return 1`); await wait(300);
    const state = `const s = await window.ytdj.settings.get(); const f = document.querySelector('#settings form'); const A = __app.decks.A, B = __app.decks.B;
      return { s: { fxHold: s.fxHold, fxRemember: s.fxRemember, filterRes: s.filterRes }, ctl: { fxHold: f.fxHold.checked, fxRemember: f.fxRemember.checked, filterRes: Number(f.filterRes.value) }, resA: A.mix.res, resB: B.mix.res, pane: [...document.querySelectorAll('#settings .set-pane')].filter((p) => !p.hidden).map((p) => p.dataset.pane), tab: document.getElementById('sn-fx')?.textContent }`;
    res.start = await js(state);
    const setv = (name, v) => js(`const el = document.querySelector('#settings form [name="${name}"]'); if (el.type === 'checkbox') el.checked = ${JSON.stringify(v)}; else el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 350)); return 1`);
    await setv('fxHold', false); res.hold = await js(state);
    await setv('fxRemember', false); res.remember = await js(state);
    // el valor por defecto de RES llega a los decks sin tocar; el que se movió se respeta
    await js(`__app.decks.B.resKnob.set(0.9); return 1`);
    await setv('filterRes', 0.3); res.res = await js(state);
    await js(`__app.decks.B.resKnob.el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await new Promise((r) => setTimeout(r, 60)); return 1`); res.dbl = await js(`return __app.decks.B.mix.res`);
    // buscador
    await js(`const i = document.getElementById('set-search'); i.value = 'instantáneos'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 150)); return 1`);
    res.search = await js(state); await js(`__app.clearSettingsSearch(); return 1`);
    // restablecer sección
    await js(`window.confirm = () => true; document.querySelector('#settings .set-pane[data-pane="fx"] [data-reset]').click(); await new Promise((r) => setTimeout(r, 500)); return 1`); res.reset = await js(state);
    fs.writeFileSync(path.join(out, 'fx-settings.json'), JSON.stringify(res));
    win.close();
  });
};
