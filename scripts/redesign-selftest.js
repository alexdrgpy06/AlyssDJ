// Autoprueba del rediseño: tamaño de los controles, estado vacío y navegación de ajustes con teclado.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    // controles visibles más pequeños que el mínimo de su zona
    const small = (sel, min) => `return [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.offsetParent && !e.closest('[hidden]')).map((e) => { const b = e.getBoundingClientRect(); return { c: e.className || e.id || e.tagName, w: Math.round(b.width), h: Math.round(b.height) }; }).filter((x) => x.h < ${min} || x.w < ${min}).slice(0, 12)`;
    await wait(2500);
    await js(`__app.masterGain = 0; return 1`);
    for (const [w, h] of [[1366, 768], [1600, 960]]) {
      win.setContentSize(w, h);
      await wait(900);
      const k = `${w}x${h}`;
      res[k] = {
        console: await js(small('.console button, .console input[type=range]:not(.vfader)', 28)),
        topbar: await js(small('.topbar .btn, .topbar .icon-btn', 32).replace('b.width', 'b.height')),
        sources: await js(`return [...document.querySelectorAll('.src-list button')].map((b) => b.getBoundingClientRect().height).filter((h) => h < 26).length`),
      };
      // AutoMix compacto también cuenta (REQ-8 vale con los decks reducidos)
      await js(`document.querySelector('.sources [data-tab="automix"]').click(); return 1`);
      await wait(700);
      res[k].consoleAutomix = await js(small('.console button', 28));
      await js(`document.querySelector('.sources [data-tab="search"]').click(); return 1`);
      await wait(400);
    }
    // estado vacío de la librería
    res.empty = await js(`const e = document.getElementById('lib-empty'); return { hidden: e.hidden, text: document.getElementById('lib-empty-text').textContent }`);
    // ajustes: flechas cambian de sección y solo una está visible
    res.settings = await js(`
      document.getElementById('btn-settings').click(); await new Promise((r) => setTimeout(r, 400));
      const nav = document.querySelector('#settings .set-nav'); const first = nav.querySelector('button'); first.focus();
      const visible = () => [...document.querySelectorAll('#settings .set-pane')].filter((p) => !p.hidden).map((p) => p.dataset.pane);
      const a = visible();
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const b = visible();
      const sel = document.querySelector('#settings .set-nav button[aria-selected=true]').dataset.pane;
      document.querySelector('#settings').close();
      return { a, b, sel }`);
    // foco visible: los botones tienen anillo con :focus-visible (regla global)
    res.focusRule = await js(`return [...document.styleSheets].some((s) => [...s.cssRules].some((r) => r.selectorText === ':focus-visible' && /outline/.test(r.cssText)))`);
    fs.writeFileSync(path.join(out, 'redesign.json'), JSON.stringify(res));
    win.close();
  });
};
