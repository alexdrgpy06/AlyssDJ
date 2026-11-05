// Autoprueba de automix-simple-y-continuo (la lanza scripts/test-automix-continuo.js ui): panel simple y tarjeta SIGUE con «punto seguro».
// Escribe automix-continuo.json en YTDJ_SELFTEST_OUT. En silencio y en modo local (sin red).
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const R = {};
  const done = () => fs.writeFileSync(path.join(out, 'automix-continuo.json'), JSON.stringify(R, null, 2));

  wc.once('did-finish-load', async () => {
    try {
      win.setContentSize(1280, 720);
      await wait(2000);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
      await js(`__app.setView('library'); __app.library.show('automix'); return 1`); await wait(800);
      R.panel = await js(`
        const q = (s) => document.querySelector(s);
        const vis = (s) => { const e = q(s); return !!e && e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }); };
        const ids = ['#amv-profile', '#amv-len', '#amv-fx'];
        const adv = ['#amv-style', '#amv-exit', '#amv-tempo', '#amv-order', '#amv-pop', '#amv-local', '#amv-endless'];
        const closed = { simple: ids.map(vis), adv: adv.map(vis) };
        q('#am-more').open = true; await new Promise((r) => setTimeout(r, 200));
        const open1 = { simple: ids.map(vis), adv: adv.map(vis), advOpen: q('#am-adv').open };
        q('#am-adv').open = true; await new Promise((r) => setTimeout(r, 200));
        const open2 = { adv: adv.map(vis) };
        return { closed, open1, open2, profiles: [...document.querySelectorAll('#amv-profile button')].map((b) => b.dataset.v), badgeHidden: q('#amv-entry-safe').hidden };`);
      // la tarjeta SIGUE muestra «punto seguro» cuando la entrada es de ese tipo
      R.badge = await js(`
        const q = (s) => document.querySelector(s);
        const strip = (__app.automix.entryStrip) || null;
        const { EntryStrip } = await import('./automix-entry.js');
        const es = new EntryStrip();
        es.render({ t: 24, kind: 'safe', why: 'sin análisis: entra en un punto seguro', bar: null, user: false, duration: 300, strip: null }, '#fff');
        const on = { hidden: q('#amv-entry-safe').hidden, why: q('#amv-entry-why').textContent };
        es.render({ t: 24, kind: 'drop', why: 'entra en el primer drop', bar: 3, user: false, duration: 300, strip: null }, '#fff');
        return { on, off: q('#amv-entry-safe').hidden };`);
    } catch (e) { R.error = e.stack; }
    done();
  });
};
