// Autoprueba de las playlists locales en la app real (1280×720, sin red). Cada tarea añade su bloque al resultado.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT, music = process.env.YTDJ_DOCS_MUSIC, data = process.env.YTDJ_USERDATA;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const R = {};
    try {
      win.setContentSize(1280, 720); await wait(2500);
      await js(`__app.masterGain = 0; localStorage.clear(); __app.settings.autoAnalyzeLocal = false; return 1`);
      const files = ['Neon Drive.mp3', 'Night Pulse.mp3', 'Deep Signal.mp3'];
      R.rows = [];
      for (const f of files) R.rows.push(await js(`const r = await window.ytdj.local.register(${JSON.stringify(path.join(music, f))}); return r.ok ? { videoId: r.data.videoId, title: r.data.title, artist: r.data.artist, duration: r.data.duration, local: true } : r`));
      // ---- ipc ----
      const pl = (c) => js(`const pl = window.ytdj.pl; ${c}`);
      R.ipc = {};
      const c1 = await pl(`return await pl.create('Prueba', { tracks: [${R.rows.slice(0, 2).map((r) => JSON.stringify(r)).join(',')}] })`);
      R.ipc.created = c1;
      R.ipc.list = await pl(`return await pl.list()`);
      const id = c1.data.id;
      R.ipc.get = await pl(`return await pl.get(${JSON.stringify(id)})`);
      R.ipc.dup = await pl(`return await pl.add(${JSON.stringify(id)}, [${JSON.stringify(R.rows[0])}, ${JSON.stringify(R.rows[2])}])`);
      R.ipc.events = await pl(`let n = 0; pl.onChange(() => n++); await pl.rename(${JSON.stringify(id)}, 'Prueba 2'); await new Promise((r) => setTimeout(r, 300)); return n`);
      R.ipc.bad = await pl(`return await pl.get('pl_noexiste')`);
      for (const fmt of ['m3u8', 'csv', 'rekordbox']) {
        try { fs.rmSync(process.env.YTDJ_EXPORT_FILE, { force: true }); } catch { /* nada */ }
        const r = await js(`return await window.ytdj.export.run(${JSON.stringify('pl:' + id)}, ${JSON.stringify(fmt)})`);
        R.ipc['export_' + fmt] = { r, text: fs.existsSync(process.env.YTDJ_EXPORT_FILE) ? fs.readFileSync(process.env.YTDJ_EXPORT_FILE, 'utf8').slice(0, 1500) : null };
      }
      // importada → local
      fs.writeFileSync(path.join(data, 'playlists.json'), JSON.stringify([{ id: 'PLX', title: 'Favoritas YT', thumb: '', tracks: [{ videoId: 'ytAAAAAAAAA', title: 'Una', artist: 'A' }, { videoId: 'ytBBBBBBBBB', title: 'Dos', artist: 'B' }] }]));
      R.ipc.crate = await pl(`return await pl.fromCrate('PLX')`);
      R.ipc.crateBad = await pl(`return await pl.fromCrate('NOPE')`);
      R.ipc.del = await pl(`return await pl.delete(${JSON.stringify(R.ipc.crate.data?.id)})`);
      R.ipc.file = fs.existsSync(path.join(data, 'playlists-local.json'));

      // ---- ui ----
      await js(`window.confirm = () => true; __app.setView('library'); await window.ytdj.settings.set({}); return 1`);
      for (const q of (await pl(`return (await pl.list()).data.map((l) => l.id)`))) await pl(`return await pl.delete(${JSON.stringify(q)})`);
      await wait(400);
      const rowsView = `return [...document.querySelectorAll('#tracks tr[data-i]')].map((tr) => ({ id: tr.dataset.id, sel: tr.classList.contains('sel'), text: tr.cells[1]?.textContent.trim() }))`;
      const srcView = `return [...document.querySelectorAll('#pl-sources button[data-pl]')].map((b) => ({ id: b.dataset.pl, text: b.textContent.replace(/\\s+/g, ' ').trim(), on: b.classList.contains('on'), smart: !!b.querySelector('use[href="#i-smart"]') }))`;
      R.ui = {};
      R.ui.filesBefore = fs.readdirSync(music).filter((f) => /\.mp3$/.test(f)).length;
      R.ui.empty = await js(`return document.getElementById('pl-sources').textContent.trim()`);
      await js(`document.getElementById('pl-new').click(); return 1`); await wait(700);
      R.ui.editing = await js(`const i = document.querySelector('#pl-sources .pl-input'); return { has: !!i, focused: document.activeElement === i, val: i?.value }`);
      await js(`const i = document.querySelector('#pl-sources .pl-input'); i.value = 'Mi set'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1`); await wait(700);
      R.ui.afterName = await js(srcView);
      R.ui.bar = await js(`return { toolbar: !document.getElementById('pl-toolbar').hidden, bar: !document.getElementById('pl-bar').hidden, name: document.getElementById('pl-name').textContent, empty: document.getElementById('lib-empty-text').textContent, tab: __app.library.tab }`);
      R.ui.setId = R.ui.afterName[0]?.id;
      await js(`__app.library.show('local'); return 1`); await wait(900);
      R.ui.local = await js(rowsView);
      await js(`document.querySelector('#tracks tr[data-i] button[data-act="addpl"]').click(); return 1`); await wait(300);
      R.ui.menu = await js(`const m = document.getElementById('pl-menu'); return { open: !m.hidden, items: [...m.querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()), focus: m.contains(document.activeElement) }`);
      await js(`document.querySelector('#pl-menu button[data-id]').click(); return 1`); await wait(700);
      R.ui.afterAdd = await js(srcView);
      // otra vez la misma pista: no se repite
      await js(`document.querySelector('#tracks tr[data-i] button[data-act="addpl"]').click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('#pl-menu button[data-id]').click(); return 1`); await wait(600);
      R.ui.dupToast = await js(`return document.getElementById('toast').textContent`);
      // soltar otra pista sobre la lista de las fuentes
      await js(`const dt = new DataTransfer(); const row = __app.library.rows[1]; dt.setData('application/x-ytdj-tracks', JSON.stringify([{ videoId: row.videoId, title: row.title, artist: row.artist, duration: row.duration, local: true }])); const b = document.querySelector('#pl-sources button[data-pl]'); b.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); b.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return 1`); await wait(700);
      R.ui.afterDrop = await js(srcView);
      // desde el menú, «Nueva playlist…» con la pista
      await js(`document.querySelectorAll('#tracks tr[data-i] button[data-act="addpl"]')[2].click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('#pl-menu button[data-new]').click(); return 1`); await wait(900);
      R.ui.fromMenu = await js(`return { src: [...document.querySelectorAll('#pl-sources button[data-pl], #pl-sources .pl-row')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()), editing: !!document.querySelector('#pl-sources .pl-input') }`);
      await js(`const i = document.querySelector('#pl-sources .pl-input'); if (i) i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1`); await wait(600);
      // abrir, renombrar, duplicar y borrar
      await js(`__app.library.show('pl:${R.ui.setId}'); return 1`); await wait(700);
      R.ui.open = await js(`return { rows: (function(){ ${rowsView.replace('return ', 'return ')} })(), msg: document.getElementById('lib-msg').textContent, exp: !document.getElementById('btn-export').hidden, on: [...document.querySelectorAll('#pl-sources button.on')].map((b) => b.dataset.pl) }`);
      fs.writeFileSync(path.join(out, 'playlists-open.png'), (await win.webContents.capturePage()).toPNG());
      await js(`document.getElementById('pl-rename').click(); return 1`); await wait(300);
      await js(`const i = document.querySelector('#pl-sources .pl-input'); i.value = 'Set de viernes'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1`); await wait(700);
      R.ui.renamed = await js(`return { src: ${'(function(){' + srcView + '})()'}, name: document.getElementById('pl-name').textContent }`);
      await js(`document.getElementById('pl-dup').click(); return 1`); await wait(900);
      R.ui.dup = await js(`return { src: (function(){ ${srcView} })(), name: document.getElementById('pl-name').textContent }`);
      await js(`document.getElementById('pl-del').click(); return 1`); await wait(900);
      R.ui.del = await js(`return { src: (function(){ ${srcView} })(), tab: __app.library.tab }`);
      R.ui.files = fs.readdirSync(music).filter((f) => /\.mp3$/.test(f)).length;

      // ---- select ----
      const setId = R.ui.setId;
      const lists0 = (await pl(`return (await pl.list()).data`));
      const emptyId = lists0.find((l) => l.id !== setId && l.kind === 'manual').id;
      R.sel = {};
      await js(`__app.library.show('local'); return 1`); await wait(900);
      const click = (i, mods = '') => js(`const tr = document.querySelectorAll('#tracks tr[data-i]')[${i}]; tr.cells[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ${mods} })); return 1`);
      const selView = `return { sel: [...document.querySelectorAll('#tracks tr.sel')].map((t) => t.dataset.id), bar: !document.getElementById('sel-bar').hidden, count: document.getElementById('sel-count').textContent, remove: !document.getElementById('sel-remove').hidden, tb: !document.getElementById('pl-toolbar').hidden }`;
      await click(0); R.sel.one = await js(selView);
      await click(2, 'ctrlKey: true'); R.sel.ctrl = await js(selView);
      await click(0); await click(2, 'shiftKey: true'); R.sel.range = await js(selView);
      await js(`const w = document.querySelector('.table-wrap'); w.focus(); w.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })); return 1`); R.sel.all = await js(selView);
      R.sel.total = await js(`return __app.library.rows.length`);
      await js(`document.getElementById('sel-clear').click(); return 1`); R.sel.cleared = await js(selView);
      // acciones en bloque: añadir a una lista
      await click(0); await click(1, 'ctrlKey: true');
      await js(`document.getElementById('sel-add').click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('#pl-menu button[data-id="${emptyId}"]').click(); return 1`); await wait(700);
      R.sel.added = (await pl(`return (await pl.get(${JSON.stringify(emptyId)})).data.tracks.map((t) => t.videoId)`));
      R.sel.expectAdded = await js(`return [...document.querySelectorAll('#tracks tr.sel')].map((t) => t.dataset.id)`);
      // a la cola de AutoMix y analizar (el análisis se simula: solo se comprueba qué pistas se envían)
      R.sel.q0 = await js(`return __app.automix.queue.length`);
      await js(`document.getElementById('sel-queue').click(); return 1`); await wait(400);
      R.sel.q1 = await js(`return __app.automix.queue.length`);
      await js(`window.__an = null; __app.library.analyzeRows = async (rows) => { window.__an = rows.map((r) => r.videoId); }; document.getElementById('sel-analyze').click(); return 1`); await wait(200);
      R.sel.an = await js(`return window.__an`);
      // quitar de una lista y deshacer (botón y Ctrl+Z)
      await js(`__app.library.show('pl:${emptyId}'); return 1`); await wait(800);
      const listIds = `return [...document.querySelectorAll('#tracks tr[data-i]')].map((t) => t.dataset.id)`;
      R.sel.before = await js(listIds);
      await click(0); await click(1, 'ctrlKey: true'); R.sel.inList = await js(selView);
      await js(`document.getElementById('sel-remove').click(); return 1`); await wait(800);
      R.sel.removed = { rows: await js(listIds), undo: await js(`return !document.getElementById('pl-undo').hidden`), toast: await js(`return document.getElementById('toast').textContent`), setCount: (await pl(`return (await pl.get(${JSON.stringify(setId)})).data.tracks.length`)) };
      await js(`document.getElementById('pl-undo').click(); return 1`); await wait(800);
      R.sel.restored = await js(listIds);
      await click(0); await js(`document.getElementById('sel-remove')`); await click(1, 'ctrlKey: true');
      await js(`document.getElementById('sel-remove').click(); return 1`); await wait(700);
      await js(`const w = document.querySelector('.table-wrap'); w.focus(); w.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); return 1`); await wait(800);
      R.sel.restoredKey = await js(listIds);
      R.sel.filesAfter = fs.readdirSync(music).filter((f) => /\.mp3$/.test(f)).length;

      // ---- order ----
      R.order = {};
      await pl(`return await pl.add(${JSON.stringify(emptyId)}, [${JSON.stringify(R.rows[0])}, ${JSON.stringify(R.rows[1])}, ${JSON.stringify(R.rows[2])}])`);
      await js(`__app.library.show('local'); return 1`); await wait(400);
      await js(`__app.library.show('pl:${emptyId}'); return 1`); await wait(800);
      const titles = `return [...document.querySelectorAll('#tracks tr[data-i]')].map((t) => t.cells[1].textContent.trim().toLowerCase())`;
      R.order.start = await js(titles);
      await js(`const o = document.getElementById('pl-order'); o.value = 'title'; o.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(800);
      R.order.asc = await js(titles);
      await js(`document.getElementById('pl-dir').click(); return 1`); await wait(800);
      R.order.desc = await js(titles);
      R.order.pressed = await js(`return document.getElementById('pl-dir').getAttribute('aria-pressed')`);
      await js(`__app.library.show('local'); return 1`); await wait(500);
      await js(`__app.library.show('pl:${emptyId}'); return 1`); await wait(800);
      R.order.saved = { rows: await js(titles), select: await js(`return document.getElementById('pl-order').value`) };
      await js(`const o = document.getElementById('pl-order'); o.value = 'dur'; o.dispatchEvent(new Event('change', { bubbles: true })); return 1`); await wait(700);
      R.order.dur = await js(`return (await window.ytdj.pl.get(${JSON.stringify(emptyId)})).data.tracks.map((t) => t.duration)`);
      // reordenar a mano arrastrando la última fila al principio
      const before = await js(listIds);
      await js(`const trs = [...document.querySelectorAll('#tracks tr[data-i]')]; const dt = new DataTransfer(); trs[2].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); const r = trs[0].getBoundingClientRect(); trs[0].dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true, clientY: r.top + 1 })); R.mark = trs[0].className; trs[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientY: r.top + 1 })); return 1`.replace('R.mark', 'window.__mark')); await wait(900);
      R.order.drag = { before, after: await js(listIds), mark: await js(`return window.__mark`), select: await js(`return document.getElementById('pl-order').value`), saved: (await pl(`return (await pl.get(${JSON.stringify(emptyId)})).data`)) };

      // ---- smart ----
      R.smart = {};
      const allLocal = await js(`return (await window.ytdj.local.list()).data.rows.map((r) => r.videoId)`);
      await js(`await window.ytdj.genres.set(${JSON.stringify(allLocal[0])}, ['House']); await window.ytdj.genres.set(${JSON.stringify(allLocal[1])}, ['House']); await window.ytdj.genres.set(${JSON.stringify(allLocal[2])}, ['Techno']); return 1`); await wait(500);
      await js(`document.getElementById('pl-new-smart').click(); return 1`); await wait(900);
      await js(`const i = document.querySelector('#pl-sources .pl-input'); if (i) i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1`); await wait(500);
      const smartView = `return { tab: __app.library.tab, rows: [...document.querySelectorAll('#tracks tr[data-i]')].map((t) => t.dataset.id), msg: document.getElementById('lib-msg').textContent, empty: document.getElementById('lib-empty').hidden ? '' : document.getElementById('lib-empty-text').textContent, panel: !document.getElementById('ps-bmin').closest('form').hidden, order: !document.getElementById('pl-order').hidden, filtersBtn: !document.getElementById('pl-filters').hidden, rm: !document.getElementById('sel-remove').hidden }`;
      R.smart.created = await js(smartView);
      R.smart.id = R.smart.created.tab.slice(3);
      const setFilter = (g, an, st) => js(`document.getElementById('ps-genres').value = ${JSON.stringify(g)}; document.getElementById('ps-an').checked = ${an}; document.getElementById('ps-st').checked = ${st}; document.getElementById('pl-smart').requestSubmit(); return 1`);
      await setFilter('House', false, false); await wait(900); R.smart.house = await js(smartView);
      await setFilter('House', true, false); await wait(900); R.smart.analyzed = await js(smartView);
      R.smart.anIds = await js(`return (await window.ytdj.analysis.list()).filter((a) => a.bpm).map((a) => a.id)`);
      await setFilter('House', false, true); await wait(900); R.smart.stems = await js(smartView);
      await setFilter('House', false, false); await wait(700);
      await js(`await window.ytdj.genres.set(${JSON.stringify(allLocal[2])}, ['House']); return 1`); await wait(600);
      await js(`__app.library.show('local'); return 1`); await wait(400);
      await js(`__app.library.show('pl:${R.smart.id}'); return 1`); await wait(900);
      R.smart.updated = await js(smartView);
      R.smart.add = await pl(`return await pl.add(${JSON.stringify(R.smart.id)}, [${JSON.stringify(R.rows[0])}])`);
      R.smart.menu = await js(`document.querySelector('#tracks tr[data-i] button[data-act="addpl"]').click(); await new Promise((r) => setTimeout(r, 200)); const t = [...document.querySelectorAll('#pl-menu button[data-id]')].map((b) => b.dataset.id); document.getElementById('pl-menu').hidden = true; return t`);
      R.smart.filter = (await pl(`return (await pl.get(${JSON.stringify(R.smart.id)})).data.filter`));
      fs.writeFileSync(path.join(out, 'playlists-smart.png'), (await win.webContents.capturePage()).toPNG());

      // ---- export ----
      R.exp = {};
      await js(`__app.library.show('imported'); return 1`); await wait(900);
      R.exp.imported = await js(`return [...document.querySelectorAll('#tracks tr.pl')].map((t) => ({ text: t.textContent.replace(/\\s+/g, ' ').trim(), btn: !!t.querySelector('[data-act="crate-pl"]') }))`);
      await js(`document.querySelector('#tracks tr.pl [data-act="crate-pl"]').click(); return 1`); await wait(900);
      R.exp.crate = (await pl(`return (await pl.list()).data.map((l) => ({ name: l.name, count: l.count }))`));
      await js(`document.querySelector('#tracks tr.pl').click(); return 1`); await wait(900);
      R.exp.crateBtn = await js(`return !document.getElementById('btn-crate-pl').hidden`);
      await js(`__app.library.show('pl:${setId}'); return 1`); await wait(800);
      R.exp.crateBtnList = await js(`return !document.getElementById('btn-crate-pl').hidden`);
      for (const fmt of ['m3u8', 'csv']) {
        try { fs.rmSync(process.env.YTDJ_EXPORT_FILE, { force: true }); } catch { /* nada */ }
        await js(`document.getElementById('btn-export').click(); await new Promise((r) => setTimeout(r, 150)); document.querySelector('#export-menu [data-fmt="${fmt}"]').click(); return 1`); await wait(900);
        R.exp['ui_' + fmt] = { text: fs.existsSync(process.env.YTDJ_EXPORT_FILE) ? fs.readFileSync(process.env.YTDJ_EXPORT_FILE, 'utf8').slice(0, 1500) : null, msg: await js(`return document.getElementById('lib-msg').textContent`) };
      }
      R.exp.setIds = await js(`return [...document.querySelectorAll('#tracks tr[data-i]')].map((t) => t.dataset.id)`);
      await js(`__app.automix.queue.length = 0; document.getElementById('btn-automix-list').click(); return 1`); await wait(900);
      R.exp.automix = await js(`return { tab: __app.library.tab, queue: __app.automix.queue.map((t) => t.videoId), cur: __app.automix.cur?.track?.videoId || null, decks: ['A', 'B'].map((d) => __app.decks[d].track?.videoId || null) }`);
    } catch (e) { R.__err = e.stack; }
    fs.writeFileSync(path.join(out, 'playlists.json'), JSON.stringify(R));
    win.close();
  });
};
