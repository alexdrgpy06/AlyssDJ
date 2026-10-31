// Módulo de autoprueba de la vista de AutoMix (lo carga scripts/test-automix-view-e2e.js). Todo en silencio.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const music = process.env.YTDJ_DOCS_MUSIC;
  const lib = process.env.YTDJ_SAVE_LIB;
  const shots = process.env.YTDJ_AM_SHOTS;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const res = { errors: [] };
  wc.on('console-message', (e) => (e.level === 'error' || e.level >= 3) && res.errors.push(String(e.message).slice(0, 200)));
  const flush = (step) => { res.steps = res.steps || []; res.steps.push(`${new Date().toISOString().slice(11, 19)} ${step}`); fs.writeFileSync(path.join(out, 'automix-view.json'), JSON.stringify(res, null, 2)); };
  const YT = { videoId: 'TOueemiIVYU', title: 'Flickering Light Sound Effect', artist: 'Creative Commons Sounds', duration: 17, thumb: '' };

  wc.once('did-finish-load', async () => {
    try {
      await wait(2500);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
      await js(`await window.ytdj.settings.set({ cookieSource: 'none', saveOnAnalyze: true, saveOnPlay: true, libraryDir: ${JSON.stringify(lib)}, musicDirs: [] }); __app.settings = await window.ytdj.settings.get(); return 1`);
      const rows = [];
      for (const n of ['Neon Drive', 'Sunset Groove', 'Night Pulse', 'Deep Signal']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
      await js(`const am = __app.automix; am.setCfg({ len: 4, style: 'bass', endless: false, preferLocal: true, matchTempo: true }); await am.start({ tracks: ${JSON.stringify(rows)} }); __app.library.show('automix'); return 1`);
      await wait(5000);

      // REQ-1: la vista muestra lo que suena, lo que sigue y la cola
      res.view = await js(`return { visible: !document.getElementById('am-view').hidden, tableHidden: document.querySelector('.table-wrap').hidden, cur: document.getElementById('amv-cur').textContent, next: document.getElementById('amv-next').textContent, status: document.getElementById('amv-status').textContent, items: [...document.querySelectorAll('#amv-list li')].map((l) => l.querySelector('b').firstChild.textContent), badges: [...document.querySelectorAll('#amv-list .am-badge')].map((b) => b.textContent), head: document.querySelector('#amv-list li').classList.contains('head'), toggle: document.querySelector('#amv-toggle span').textContent }`);

      // REQ-2: editar la cola con los botones de la vista
      const order = () => js(`return [__app.automix.queue.map((t) => t.title), [...document.querySelectorAll('#amv-list li b')].map((b) => b.firstChild.textContent)]`);
      flush('vista');
      res.edit = { start: await order() };
      await js(`document.querySelector('#amv-list li[data-i="0"] [data-act="down"]').click(); await new Promise((r) => setTimeout(r, 300)); return 1`);
      res.edit.afterDown = await order();
      await js(`document.querySelector('#amv-list li[data-i="2"] [data-act="next"]').click(); await new Promise((r) => setTimeout(r, 300)); return 1`);
      res.edit.afterNext = await order();
      await js(`document.querySelector('#amv-list li[data-i="2"] [data-act="rm"]').click(); await new Promise((r) => setTimeout(r, 300)); return 1`);
      res.edit.afterRemove = await order();
      await js(`__app.automix.add(${JSON.stringify(rows[0])}); await new Promise((r) => setTimeout(r, 300)); return 1`);
      res.edit.afterAdd = await order();

      flush('cola-editada');
      // REQ-3 + REQ-4 + REQ-2: «Mezclar ahora», progreso y edición durante la transición
      await js(`window.__before = __app.automix.cur.id; document.getElementById('amv-mix').click(); return 1`);
      let mid = null;
      for (let i = 0; i < 40 && !mid; i++) {
        await wait(300);
        mid = await js(`const am = __app.automix; return am.trans ? { status: document.getElementById('amv-status').textContent, barVisible: !document.getElementById('amv-bar-wrap').hidden, from: am.trans.from.id, to: am.trans.to.id, len: am.trans.len } : null`);
      }
      res.mixNow = { mid };
      if (mid) {
        await js(`const am = __app.automix; am.move(Math.max(0, am.queue.length - 1), 0); am.add({ videoId: 'edit-during', title: 'Añadida durante la mezcla', artist: '', duration: 100, local: true }); am.remove(am.queue.length - 1); return 1`);
        for (let i = 0; i < 60; i++) {
          await wait(300);
          if (!(await js('return !!__app.automix.trans'))) break;
        }
      }
      await wait(800); // los estados de los decks llegan por eventos
      flush('mezcla-ahora');
      res.afterMix = await js(`const am = __app.automix; return { cur: am.cur.id, before: window.__before, curPlaying: am.cur.st.playing, otherPlaying: __app.other(am.cur).st.playing, queue: am.queue.map((t) => t.title), trans: !!am.trans }`);

      // REQ-5: una pista de YouTube pasa por descarga sin sesión → análisis → guardado → lista en modo local
      await js(`const am = __app.automix; am.cur.seek(2); am.add(${JSON.stringify(YT)}); return 1`);
      flush('youtube-preparando');
      const states = [];
      for (let i = 0; i < 150; i++) {
        await wait(1000);
        const s = await js(`const am = __app.automix; return { state: am.prepOf(am.queue.find((t) => t.videoId === ${JSON.stringify(YT.videoId)}) || { videoId: ${JSON.stringify(YT.videoId)} }).state, badge: [...document.querySelectorAll('#amv-list li')].map((l) => [l.querySelector('b').firstChild.textContent, l.querySelector('.am-badge').textContent]).find((x) => /Flickering/.test(x[0])) }`);
        if (!states.length || states[states.length - 1] !== s.state) states.push(s.state);
        if (s.state === 'ready' || s.state === 'error') {
          res.ytBadge = s.badge && s.badge[1];
          break;
        }
      }
      flush('youtube-listo');
      res.ytStates = states;
      if (shots) {
        fs.mkdirSync(shots, { recursive: true });
        const r = await js(`const b = document.querySelector('.library').getBoundingClientRect(); return { x: 0, y: Math.floor(b.y), width: innerWidth, height: Math.ceil(b.height) }`);
        fs.writeFileSync(path.join(shots, '27-automix-vista.png'), (await wc.capturePage(r)).toPNG());
      }
      // pasa a ser la siguiente → se precarga el archivo local (no el stream)
      await js(`const am = __app.automix; am.cur.seek(2); am.insertNext(am.queue.find((t) => t.videoId === ${JSON.stringify(YT.videoId)})); return 1`);
      let loaded = null;
      for (let i = 0; i < 30 && !loaded; i++) {
        await wait(500);
        loaded = await js(`const am = __app.automix; const d = __app.other(am.cur); return d.track && d.track.videoId === ${JSON.stringify(YT.videoId)} && d.st.ready ? { source: d.source, dur: Math.round(d.st.dur), bpm: d.analysis && d.analysis.bpm, saved: !!(d.analysis && d.analysis.saved), stateText: d.el.state.textContent } : null`);
      }
      res.ytPreload = loaded;

      flush('precarga');
      // atajo Mayús + → : mezcla ya hacia esa pista
      await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })); return 1`);
      for (let i = 0; i < 40; i++) {
        await wait(300);
        if (await js('return !!__app.automix.trans')) break;
      }
      for (let i = 0; i < 60; i++) {
        await wait(300);
        if (!(await js('return !!__app.automix.trans'))) break;
      }
      flush('atajo');
      res.shortcut = await js(`const am = __app.automix; return { cur: am.cur.track.videoId, source: am.cur.source, playing: am.cur.st.playing }`);
      await js('__app.automix.stop(); return 1');
    } catch (e) {
      res.error = e.stack.slice(0, 400);
    }
    fs.writeFileSync(path.join(out, 'automix-view.json'), JSON.stringify(res, null, 2));
    win.close();
  });
};
