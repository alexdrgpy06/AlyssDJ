// Autoprueba de la interfaz de efectos ampliados: tipos, división, ruta, orden, presets e Instant FX (teclado).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const R = {};
    try {
      win.setContentSize(1366, 768); await wait(2500);
      await js(`__app.masterGain = 0; localStorage.clear(); return 1`);
      const slots = (d) => `__app.decks.${d}.fxc.snapshot().map((s) => ({ type: s.type, on: s.on, wet: +s.wet.toFixed(2), p: s.p, d: s.d, route: s.route }))`;
      const pane = (d) => `document.querySelector('#deck-${d} .fxpane')`;
      R.options = await js(`const sel = ${pane('A')}.querySelector('.fx-type'); return { n: sel.options.length, groups: [...sel.querySelectorAll('optgroup')].map((g) => g.label) }`);
      // elegir un tipo nuevo en la ranura 1
      await js(`const sel = ${pane('A')}.querySelector('.fx-type'); sel.value = 'stutter'; sel.dispatchEvent(new Event('change', { bubbles: true })); return 1`);
      R.type = await js(`return ${slots('A')}[0].type`);
      // popover: división habilitada para stutter, no para filtro
      await js(`${pane('A')}.querySelector('.fx-more').click(); return 1`); await wait(150);
      const pop = `const p = [...document.querySelectorAll('.fx-pop')].find((x) => x.getAttribute('aria-label').endsWith('deck A'))`;
      R.pop = await js(`${pop}; return { hidden: p.hidden, divDisabled: [...p.querySelectorAll('.fx-div button')].map((b) => b.disabled), expanded: ${pane('A')}.querySelector('.fx-more').getAttribute('aria-expanded') }`);
      await js(`${pop}; p.querySelector('.fx-div [data-d="2"]').click(); return 1`); await wait(100);
      R.div = await js(`${pop}; return { d: ${slots('A')}[0].d, on: [...p.querySelectorAll('.fx-div button.on')].map((b) => b.textContent) }`);
      await js(`const sel = ${pane('A')}.querySelector('.fx-type'); sel.value = 'filter'; sel.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(100);
      R.divFilter = await js(`${pop}; return [...p.querySelectorAll('.fx-div button')].every((b) => b.disabled)`);
      // ruta «ambos»: la ranura se copia al otro deck y lo sigue
      await js(`${pop}; p.querySelector('.fx-route [data-r="both"]').click(); return 1`); await wait(150);
      R.both = { A: await js(`return ${slots('A')}[0]`), B: await js(`return ${slots('B')}[0]`), label: await js(`return ${pane('A')}.querySelector('.fx-slot').classList.contains('both')`) };
      await js(`const sel = ${pane('A')}.querySelector('.fx-type'); sel.value = 'brake'; sel.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(150);
      R.follow = await js(`return ${slots('B')}[0].type`);
      await js(`${pop}; p.querySelector('.fx-route [data-r="deck"]').click(); return 1`); await wait(100);
      // orden: la ranura 1 pasa a la 2
      await js(`const sel = ${pane('A')}.querySelector('.fx-type'); sel.value = 'tape'; sel.dispatchEvent(new Event('change', { bubbles: true })); ${pop}; p.querySelector('.fx-mv[data-mv="1"]').click(); return 1`); await wait(150);
      R.order = { types: (await js(`return ${slots('A')}`)).map((s) => s.type), selected: await js(`return __app.decks.A.fxc.selected`), labels: await js(`return [...${pane('A')}.querySelectorAll('.fx-pick')].map((b) => b.textContent)`) };
      // presets
      await js(`${pop}; const s = p.querySelector('.fx-preset'); s.value = 'Roll de redoble'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(100);
      R.preset = await js(`return ${slots('A')}[__app.decks.A.fxc.selected]`);
      await js(`${pop}; p.querySelector('.fx-pname').value = 'Mi roll'; p.querySelector('.fx-psave').click(); return 1`); await wait(100);
      R.saved = await js(`${pop}; return { opts: [...p.querySelectorAll('.fx-preset option')].map((o) => o.textContent), msg: p.querySelector('.fx-pmsg').textContent, store: JSON.parse(localStorage.getItem('alyssdj.fxpresets') || '[]').map((x) => x.name) }`);
      await js(`${pop}; p.querySelector('.fx-pname').value = 'Eco largo'; p.querySelector('.fx-psave').click(); return 1`); await wait(100);
      R.dup = await js(`${pop}; return p.querySelector('.fx-pmsg').textContent`);
      await js(`${pop}; const s = p.querySelector('.fx-preset'); s.value = 'Mi roll'; p.querySelector('.fx-pdel').click(); return 1`); await wait(100);
      R.deleted = await js(`${pop}; return { opts: [...p.querySelectorAll('.fx-preset option')].map((o) => o.textContent), store: JSON.parse(localStorage.getItem('alyssdj.fxpresets') || '[]').length }`);
      await js(`${pop}; document.dispatchEvent(new Event('pointerdown', { bubbles: true })); return 1`);
      await js(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return 1`); await wait(100);
      R.closed = await js(`${pop}; return p.hidden`);
      // Instant FX: mantener E aplica la ranura 1 del deck A con rampa; soltar la quita y deja la ranura como estaba
      await js(`const A = __app.decks.A; A.fxc.set(0, { type: 'echo', on: false, wet: 0.7 }); return 1`);
      const key = (type) => js(`window.dispatchEvent(new KeyboardEvent('${type}', { key: 'e', code: 'KeyE', bubbles: true })); return 1`);
      await key('keydown'); await wait(20);
      R.holdStart = await js(`return ${slots('A')}[0]`); await wait(150);
      R.holdOn = await js(`return ${slots('A')}[0]`);
      await key('keyup'); await wait(30); R.holdFading = await js(`return ${slots('A')}[0]`); await wait(250);
      R.holdOff = await js(`return ${slots('A')}[0]`);
      // si la ranura ya estaba encendida, la tecla no la toca
      await js(`__app.decks.A.fxc.set(0, { on: true, wet: 0.4 }); return 1`);
      await key('keydown'); await wait(100); await key('keyup'); await wait(250);
      R.alreadyOn = await js(`return ${slots('A')}[0]`);
      // en un campo de texto no dispara
      await js(`__app.decks.A.fxc.set(0, { on: false, wet: 0.7 }); return 1`);
      await js(`const i = document.getElementById('amv-search') || document.querySelector('input'); i.focus(); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true })); return 1`); await wait(150);
      R.typing = await js(`return ${slots('A')}[0].on`);
      fs.writeFileSync(path.join(out, 'fxa-ui.png'), (await win.webContents.capturePage()).toPNG());
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'fxa-ui.json'), JSON.stringify(R));
    win.close();
  });
};
