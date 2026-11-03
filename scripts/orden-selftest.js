// Autoprueba del cambio interfaz-ordenada: menú «⋯» del deck, bancos plegables y desbordes a 1280×720.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT, music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const res = {};
    win.setContentSize(1280, 720); await wait(2500);
    await js(`__app.masterGain = 0; localStorage.clear(); __app.settings.autoAnalyzeLocal = false; __app.setView('mix'); return 1`);
    const vis = `const vis = (s, r = document) => { const e = r.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; };`;
    const deckProbe = (id) => `${vis} const r = document.getElementById('deck-${id}'); const m = r.querySelector('.deck-menu');
      return { more: vis('.deck-more', r), expanded: r.querySelector('.deck-more').getAttribute('aria-expanded'), menu: !m.hidden,
        src: vis('.seg.source', r), analyze: vis('.analyze', r), points: vis('.mix-points', r), ytm: vis('.view-ytm', r), attn: r.querySelector('.deck-more').classList.contains('attn'),
        focusIn: m.contains(document.activeElement) }`;
    // sin pista: el menú no se ofrece
    res.empty = await js(deckProbe('A'));
    // pista local sin análisis
    const row = await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, 'Neon Drive.mp3'))})).data`);
    await js(`await __app.decks.A.load(${JSON.stringify(row)}); return 1`); await wait(600);
    res.loaded = await js(deckProbe('A'));
    await js(`document.querySelector('#deck-A .deck-more').click(); return 1`); await wait(200);
    res.open = await js(deckProbe('A'));
    fs.writeFileSync(path.join(out, 'deck-menu.png'), (await win.webContents.capturePage()).toPNG());
    await js(`document.querySelector('#deck-A .deck-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1`); await wait(200);
    res.esc = await js(`${deckProbe('A').replace('return {', 'return { active: document.activeElement.className,')}`);
    // clic fuera cierra
    await js(`document.querySelector('#deck-A .deck-more').click(); return 1`); await wait(150);
    await js(`document.body.click(); return 1`); await wait(150);
    res.outside = await js(deckProbe('A'));
    // tras analizar, Analizar se oculta y aparecen los Puntos
    await js(`__app.decks.A.analyze(); return 1`);
    for (let i = 0; i < 90; i++) { await wait(500); if (await js(`return !!__app.decks.A.analysis`)) break; }
    await wait(500);
    await js(`document.querySelector('#deck-A .deck-more').click(); return 1`); await wait(200);
    res.analyzed = await js(deckProbe('A'));
    // bancos: por defecto LOOP abierto; pulsar la abierta la cierra; se recuerda por deck
    const bank = (id) => js(`const r = document.getElementById('deck-${id}'); return { open: [...r.querySelectorAll('.pane')].filter((p) => !p.hidden).map((p) => p.dataset.pane), on: [...r.querySelectorAll('.bank-tabs .on')].map((b) => b.dataset.b), stored: localStorage.getItem('alyssdj.deck.bank.${id}'), closed: r.querySelector('.deck').classList.contains('bank-closed') || r.querySelector('.bank-tabs') === null }`);
    res.bankInit = await bank('A');
    await js(`document.querySelector('#deck-A [data-b="jump"]').click(); return 1`); res.bankJump = await bank('A');
    await js(`document.querySelector('#deck-A [data-b="jump"]').click(); return 1`); res.bankClosed = await bank('A');
    await js(`document.querySelector('#deck-B [data-b="fx"]').click(); return 1`); res.bankB = await bank('B'); res.bankAstill = await bank('A');
    await js(`__app.decks.A.setBank(__app.decks.A.savedBank()); __app.decks.B.setBank(__app.decks.B.savedBank()); return 1`);
    res.bankRestored = { a: await bank('A'), b: await bank('B') };
    res.sw = await js(`return { sw: document.documentElement.scrollWidth, w: innerWidth, h: innerHeight, sh: document.documentElement.scrollHeight }`);
    // 1280×720 en cada vista: sin desplazamiento horizontal y la barra entera a la vista
    res.views = {};
    for (const v of ['mix', 'library', 'automix', 'waves']) {
      await js(`__app.setView('${v}'); return 1`); await wait(500);
      res.views[v] = await js(`const b = [...document.querySelectorAll('.topbar button, .topbar .session')].filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect());
        const kb = document.querySelector('#deck-A .deck-more'); return { sw: document.documentElement.scrollWidth, w: innerWidth, right: Math.round(Math.max(...b.map((r) => r.right))), left: Math.round(Math.min(...b.map((r) => r.left))), n: b.length, tab: kb.tabIndex, wrap: document.querySelector('.topbar').getBoundingClientRect().height };`);
      fs.writeFileSync(path.join(out, 'orden-' + v + '.png'), (await win.webContents.capturePage()).toPNG());
    }
    fs.writeFileSync(path.join(out, 'orden.json'), JSON.stringify(res));
    win.close();
  });
};
