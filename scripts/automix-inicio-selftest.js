// Autoprueba de automix-inicio-y-controles (la lanza scripts/test-automix-inicio.js): panel, vista inmersiva y diseño a 1280×720.
// Escribe automix-inicio.json en YTDJ_SELFTEST_OUT. Todo en silencio, en modo local (sin red).
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const music = process.env.YTDJ_DOCS_MUSIC;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const R = {};
  const done = () => fs.writeFileSync(path.join(out, 'automix-inicio.json'), JSON.stringify(R, null, 2));

  wc.once('did-finish-load', async () => {
    try {
      win.setContentSize(1280, 720);
      await wait(2000);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); __app.sampler.out.gain.value = 0; return 1`);
      const files = ['Neon Drive', 'Sunset Groove', 'Night Pulse', 'Deep Signal'].map((n) => path.join(music, `${n}.mp3`));
      const rows = [];
      for (const f of files) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(f)})).data`));
      await js(`await window.ytdj.settings.set({ musicDirs: [${JSON.stringify(music)}], libraryDir: ${JSON.stringify(music)}, saveOnAnalyze: false, saveOnPlay: false, localMode: true }); for (const r of ${JSON.stringify(rows)}) window.ytdj.analysis.request(r.videoId, { meta: { title: r.title, artist: r.artist, thumb: r.thumb, trackDuration: r.duration }, file: r.path }); return 1`);
      await wait(12000);
      await js(`await __app.library.refreshAnalyzed(); await __app.library.show('local'); return 1`);
      await js(`await __app.decks.A.load(${JSON.stringify(rows[0])}); await __app.decks.B.load(${JSON.stringify(rows[2])}); return 1`);
      await wait(1500);

      // ---- panel ----
      await js(`__app.setView('library'); __app.library.show('automix'); return 1`); await wait(800);
      R.panel = await js(`
        const q = (s) => document.querySelector(s);
        const bar = q('#am-transport'); const cs = getComputedStyle(bar);
        const inBar = ['amv-toggle', 'amv-mix', 'amv-skip', 'amv-radio'].map((id) => bar.contains(q('#' + id)));
        const more = q('#am-more');
        const before = { menuHidden: q('#amv-radio-menu').hidden };
        q('#amv-radio').click();
        const ids = [...document.querySelectorAll('#amv-radio-menu button')].map((b) => b.dataset.id);
        const expanded = q('#amv-radio').getAttribute('aria-expanded');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const closedByEsc = q('#amv-radio-menu').hidden;
        __app.addPanel.results = [{ videoId: 'zzzzzzzzzzz', title: 'Resultado', artist: 'x', source: 'YouTube Music' }]; __app.addPanel.q = 'ab'; __app.addPanel.render();
        const radioBtn = !!q('#amv-results button[data-act="radio"]');
        __app.addPanel.results = []; __app.addPanel.q = ''; __app.addPanel.render();
        return { sticky: cs.position, inBar, moreExists: !!more, moreOpen: more?.open, ghostInRow: document.querySelectorAll('.am-row .btn.ghost').length, before, ids, expanded, closedByEsc, radioBtn, groups: document.querySelectorAll('.am-group').length };`);
      // empezar desde el deck B con el menú
      R.start = await js(`
        const q = (s) => document.querySelector(s);
        q('#amv-radio').click();
        q('#amv-radio-menu button[data-id="deckB"]').click();
        await new Promise((r) => setTimeout(r, 2500));
        const s = __app.automix.snapshot();
        return { on: s.on, cur: s.cur && s.cur.title, queue: s.queue.length, toggle: q('#amv-toggle').innerText.trim() };`);
      await js(`__app.automix.stop(); return 1`);

      // ---- diseño a 1280×720 ----
      R.layout = await js(`
        const q = (s) => document.querySelector(s);
        __app.setView('library'); __app.library.show('automix'); await new Promise((r) => setTimeout(r, 600));
        const W = innerWidth, H = innerHeight, view = q('#am-view');
        const bad = [...view.querySelectorAll('button, select, input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).map((e) => e.id || e.className);
        const seg = q('#amv-style'); const segClip = seg.scrollWidth > seg.clientWidth + 1;
        const list = q('#amv-list').getBoundingClientRect(); const search = q('#amv-search').getBoundingClientRect();
        const one = (e) => e.getClientRects().length <= 1 && e.getBoundingClientRect().height < 40;
        __app.automix.on = true; __app.renderAutoMix(); __app.automix.on = false;
        const btn = q('#btn-automix'); const sess = q('#session-label');
        const vs = { viewScroll: view.scrollWidth > view.clientWidth + 1 };
        return { W, H, bad, segClip, searchTop: Math.round(search.top), listTop: Math.round(list.top), automixBtnOne: one(q('#btn-automix span')) && btn.getBoundingClientRect().height < 40, sessionOne: one(sess) || getComputedStyle(sess).whiteSpace === 'nowrap', ...vs };`);

      // ---- inmersiva ----
      await js(`__app.setView('automix'); return 1`); await wait(800);
      R.immersive = await js(`
        const q = (s) => document.querySelector(s);
        const ids = ['imm-toggle', 'imm-mix', 'imm-skip', 'imm-radio'];
        const present = ids.map((id) => !!q('#' + id));
        const vis = ids.map((id) => { const e = q('#' + id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom <= innerHeight; });
        const label0 = q('#imm-toggle')?.innerText.trim();
        q('#imm-radio')?.click();
        const ids2 = [...document.querySelectorAll('#imm-radio-menu button')].map((b) => b.dataset.id);
        q('#imm-radio-menu button[data-id="deckB"]')?.click();
        await new Promise((r) => setTimeout(r, 2500));
        const on = __app.automix.on; const label1 = q('#imm-toggle')?.innerText.trim(); const mixEnabled = !q('#imm-mix')?.disabled;
        q('#imm-toggle')?.click(); await new Promise((r) => setTimeout(r, 400));
        return { present, vis, label0, ids2, on, label1, mixEnabled, stopped: !__app.automix.on, openStill: !!q('#imm-open') };`);
    } catch (e) { R.error = String(e.stack || e).slice(0, 500); }
    done();
  });
};
