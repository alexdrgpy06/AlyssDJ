// Autoprueba del buscador local y del modo local en la app real (1280×720, sin red: la búsqueda online se simula en la página).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT, music = process.env.YTDJ_DOCS_MUSIC;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const R = {};
    try {
      win.setContentSize(1280, 720); await wait(2500);
      await js(`__app.masterGain = 0; localStorage.clear(); __app.settings.autoAnalyzeLocal = false; return 1`);
      for (const f of ['Neon Drive.mp3', 'Night Pulse.mp3', 'Deep Signal.mp3']) await js(`await window.ytdj.local.register(${JSON.stringify(path.join(music, f))}); return 1`);
      await js(`__app.setView('library'); __app.library.show('search'); return 1`); await wait(400);
      const view = `const L = __app.library; const sc = document.getElementById('search-scope');
        return { scope: L.scope, eff: L.effectiveScope(), checked: [...sc.querySelectorAll('button')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.scope), disabled: [...sc.querySelectorAll('button')].filter((b) => b.getAttribute('aria-disabled') === 'true').map((b) => b.dataset.scope),
          ph: document.getElementById('search').placeholder, msg: document.getElementById('lib-msg').textContent, badge: !document.getElementById('local-badge').hidden,
          rows: [...document.querySelectorAll('#tracks tr[data-i]')].map((tr) => ({ id: tr.dataset.id, text: tr.textContent.replace(/\\s+/g, ' ').trim().slice(0, 90), tags: [...tr.querySelectorAll('.src-tag')].map((t) => t.textContent) })), ls: localStorage.getItem('alyssdj.search.scope') }`;
      const search = (q) => js(`const i = document.getElementById('search'); i.value = ${JSON.stringify(q)}; document.getElementById('search-form').requestSubmit(); await new Promise((r) => setTimeout(r, 900)); return 1`);
      R.initial = await js(view);
      // online simulado: caído, y con respuesta (una repetida y una nueva)
      await js(`window.__onlineCalls = 0; window.__origSearch = (q) => window.ytdj.lib.search(q); __app.library.onlineSearch = async () => { window.__onlineCalls++; return { ok: false, error: 'net::ERR_INTERNET_DISCONNECTED' }; }; return 1`);
      await search('neon'); R.allOffline = await js(view); R.allOfflineCalls = await js('return window.__onlineCalls');
      fs.writeFileSync(path.join(out, 'local-search.png'), (await win.webContents.capturePage()).toPNG());
      const first = R.allOffline.rows[0]?.id;
      await js(`__app.library.onlineSearch = async () => { window.__onlineCalls++; return { ok: true, data: [{ videoId: ${JSON.stringify(first)}, title: 'DUPLICADA', artist: 'X' }, { videoId: 'onlineXYZ1', title: 'Neon Online', artist: 'Nube' }] }; }; return 1`);
      await search('neon'); R.allMerged = await js(view);
      // Mi equipo: no toca la red y se recuerda
      const calls0 = await js('return window.__onlineCalls');
      await js(`document.querySelector('#search-scope [data-scope="local"]').click(); return 1`); await wait(900); R.local = await js(view); R.localCalls = (await js('return window.__onlineCalls')) - calls0;
      await search('zzzzqq'); R.none = await js(view);
      await search('Deep'); R.deep = await js(view);
      // sin conexión del sistema: lo online queda deshabilitado
      await js(`Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); window.dispatchEvent(new Event('offline')); document.querySelector('#search-scope [data-scope="online"]').click(); return 1`); await wait(300); await search('Deep'); R.offline = await js(view);
      await js(`delete navigator.onLine; window.dispatchEvent(new Event('online')); return 1`); await wait(300); R.back = await js(view);
      // modo local: marca, ámbito forzado y ni una llamada online
      await js(`document.querySelector('#search-scope [data-scope="all"]').click(); return 1`); await wait(300);
      const c1 = await js('return window.__onlineCalls');
      await js(`await window.ytdj.settings.set({ localMode: true }); return 1`); await wait(600);
      await search('night'); R.mode = await js(view); R.modeCalls = (await js('return window.__onlineCalls')) - c1;
      R.fetch = await js(`try { await fetch('https://example.com/'); return 'abierto'; } catch (e) { return 'bloqueado'; }`);
      R.lib = await js(`return { search: await window.__origSearch('x'), radio: await window.ytdj.lib.radio('abcdefghijk'), imp: await window.ytdj.lib.importPlaylists() }`);
      R.upd = await js(`return await window.ytdj.update.check()`);
      fs.writeFileSync(path.join(out, 'local-mode.png'), (await win.webContents.capturePage()).toPNG());
      await js(`await window.ytdj.settings.set({ localMode: false }); return 1`); await wait(600);
      R.after = await js(view);
      // filtros de BPM y tonalidad sobre pistas analizadas (analiza dos locales: tempos y tonos distintos)
      await js(`__app.library.setScope('local'); return 1`);
      const ana = await js(`const out = []; for (const f of ['Neon Drive.mp3', 'Night Pulse.mp3', 'Deep Signal.mp3']) { const row = (await window.ytdj.local.register(${JSON.stringify(music)} + '/' + f)).data; window.ytdj.analysis.request(row.videoId, { file: ${JSON.stringify(music)} + '/' + f }); out.push(row.videoId); } return out`);
      R.ids = ana;
      for (let i = 0; i < 400; i++) { const done = await js(`return (await window.ytdj.analysis.list()).filter((a) => a.bpm).length`); if (done >= 3) break; await wait(250); }
      await js(`await __app.library.refreshAnalyzed(); return 1`);
      R.analysis = await js(`return (await window.ytdj.analysis.list()).map((a) => ({ id: a.id, bpm: Math.round(a.bpm), key: a.camelot }))`);
      const fview = `const L = __app.library; return { rows: [...document.querySelectorAll('#tracks tr[data-i]')].map((tr) => tr.dataset.id), msg: document.getElementById('lib-msg').textContent, clearShown: !document.getElementById('f-clear').hidden, active: document.getElementById('lib-filters').classList.contains('active') }`;
      const setF = (bmin, bmax, key, compat) => js(`const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('f-bpm-min', ${JSON.stringify(bmin)}); set('f-bpm-max', ${JSON.stringify(bmax)}); const k = document.getElementById('f-key'); k.value = ${JSON.stringify(key)}; k.dispatchEvent(new Event('change', { bubbles: true })); const c = document.getElementById('f-compat'); c.checked = ${!!compat}; c.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 900)); return 1`);
      R.fAll = await js(fview); // sin texto y sin filtros: la pestaña de búsqueda enseña lo que había
      await search('a'); R.fText = await js(fview);
      const some = R.analysis.find((a) => a.bpm && a.key);
      await setF(String(some.bpm), String(some.bpm), '', false); R.fBpm = await js(fview);
      await setF('', '', some.key, false); R.fKey = await js(fview);
      await setF('1', '39', '', false); R.fNone = await js(fview);
      await setF('', '', '', false); R.fOff = await js(fview);
      await js(`document.getElementById('f-clear').click(); return 1`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'local.json'), JSON.stringify(R));
    win.close();
  });
};
