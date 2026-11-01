// Genera las capturas de la documentación (docs/img). Todo corre con el volumen maestro en 0: no suena nada.
//   node scripts/make-demo-audio.js docs/demo-audio
//   YTDJ_SELFTEST=1 YTDJ_SELFTEST_MODULE=$PWD/scripts/docs-screenshots.js YTDJ_USERDATA=/tmp/alyss-docs \
//   YTDJ_DOCS_MUSIC=$PWD/docs/demo-audio YTDJ_SELFTEST_OUT=$PWD/docs/img npx electron .
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win, decks) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const music = process.env.YTDJ_DOCS_MUSIC;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const L = (k, v) => (log.push([k, v]), console.log('[docs]', k, JSON.stringify(v)));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  fs.mkdirSync(out, { recursive: true });

  // Captura de toda la ventana o de un elemento (con margen).
  async function shot(name, selector, pad = 0) {
    let img;
    if (!selector) img = await wc.capturePage();
    else {
      const r = await js(`const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null; const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height}`);
      if (!r || r.__err) return L('shot-missing', selector);
      const W = await js('return innerWidth'), H = await js('return innerHeight');
      const x = Math.max(0, Math.floor(r.x - pad)), y = Math.max(0, Math.floor(r.y - pad));
      img = await wc.capturePage({ x, y, width: Math.min(W - x, Math.ceil(r.width + pad * 2)), height: Math.min(H - y, Math.ceil(r.height + pad * 2)) });
    }
    fs.writeFileSync(path.join(out, name), img.toPNG());
    L('shot', name);
  }
  const closePanels = () => js(`for (const id of ['sampler-panel']) document.getElementById(id).hidden = true; for (const d of document.querySelectorAll('dialog[open]')) d.close(); document.body.classList.remove('learning'); return 1`);

  wc.once('did-finish-load', async () => {
    try {
      win.setContentSize(1600, 960);
      await wait(2500);
      // Silencio total: volumen maestro 0 (la UI sigue mostrando los valores normales).
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); __app.sampler.out.gain.value = 0; return 1`);

      // ---- carga de pistas de demostración ----
      const files = ['Neon Drive', 'Sunset Groove', 'Night Pulse', 'Deep Signal'].map((n) => path.join(music, `${n}.mp3`));
      const rows = [];
      for (const f of files) rows.push((await js(`return (await window.ytdj.local.register(${JSON.stringify(f)})).data`)));
      await js(`await window.ytdj.settings.set({ musicDirs: [${JSON.stringify(music)}] }); for (const r of ${JSON.stringify(rows)}) window.ytdj.analysis.request(r.videoId, { meta: { title: r.title, artist: r.artist, thumb: r.thumb, trackDuration: r.duration }, file: r.path }); return 1`);
      await wait(12000);
      await js(`await __app.library.refreshAnalyzed(); return 1`);
      await js(`await __app.decks.A.load(${JSON.stringify(rows[0])}); await __app.decks.B.load(${JSON.stringify(rows[2])}); return 1`);
      await wait(1500);

      // ---- estado "en vivo": A y B sonando, hot cues, sync ----
      await js(`
        const A = __app.decks.A, B = __app.decks.B;
        A.seek(28.5); B.seek(45.2); A.togglePlay(); B.togglePlay();
        await new Promise(r => setTimeout(r, 800));
        A.hotcue(0); A.seek(60.0); A.hotcue(1); A.seek(88.0); A.hotcue(2); A.seek(31.0);
        B.hotcue(0);
        B.sync();
        const xf = document.getElementById('xfader'); xf.value = -0.25; xf.dispatchEvent(new Event('input'));
        // un poco de EQ para que los knobs no estén todos al centro
        const c = window.__controls;
        c.get('deckA.eqLow').setNorm(0.62); c.get('deckA.eqHigh').setNorm(0.45); c.get('deckA.filter').setNorm(0.5);
        c.get('deckB.eqMid').setNorm(0.35); c.get('deckB.eqLow').setNorm(0.3); c.get('deckB.filter').setNorm(0.56);
        __app.library.sort = { k: 'bpm', dir: 1 };
        await __app.library.show('local');
        return 1`);
      await wait(2500);
      await shot('01-vista-general.png');
      await shot('02-deck.png', '#deck-A .deck', 4);
      await shot('03-mixer.png', '.mixer', 4);
      await shot('04-ondas.png', '.waves');
      await js(`__app.decks.A.zoom = 2.6; __app.decks.B.zoom = 2.6; return 1`);
      await wait(400);
      await shot('05-ondas-zoom.png', '.waves');
      await js(`__app.decks.A.zoom = 1; __app.decks.B.zoom = 1; return 1`);

      // ---- bancos de funciones ----
      await js(`const A=__app.decks.A; A.setBank('loop'); A.loopBeats(4); return 1`);
      await wait(700);
      await shot('06-loops.png', '#deck-A .deck', 4);
      await js(`const A=__app.decks.A; A.setLoop(null); A.setBank('jump'); return 1`);
      await shot('07-jump-roll.png', '#deck-A .deck', 4);
      await js(`const A=__app.decks.A; A.setBank('fx'); document.querySelector('#deck-A .fx-on').click(); document.querySelector('#deck-A [data-fx="echo"]').click(); const w=document.querySelector('#deck-A .fx-wet'); w.value=0.55; w.dispatchEvent(new Event('input')); return 1`);
      await wait(400);
      await shot('08-fx.png', '#deck-A .deck', 4);
      await js(`const A=__app.decks.A; document.querySelector('#deck-A .fx-on').click(); A.setBank('grid'); return 1`);
      await shot('09-grid.png', '#deck-A .deck', 4);
      await js(`__app.decks.A.setBank('loop'); return 1`);
      await shot('10-deck-sync.png', '#deck-B .deck', 4);
      await shot('11-barra-superior.png', '.topbar');

      // ---- librería ----
      await shot('12-libreria-local.png', '.library');
      await js(`document.getElementById('only-compat').checked = true; document.getElementById('only-compat').dispatchEvent(new Event('change')); return 1`);
      await shot('13-libreria-compatibles.png', '.library');
      await js(`document.getElementById('only-compat').checked = false; document.getElementById('only-compat').dispatchEvent(new Event('change')); await __app.library.show('search', 'daft punk one more time'); return 1`);
      await wait(4500);
      await shot('14-libreria-busqueda.png', '.library');
      await js(`__app.library.sort = null; await __app.library.show('local'); return 1`);

      // ---- paneles ----
      await js(`document.getElementById('btn-sampler').click(); __app.sampler.play(0); return 1`);
      await wait(120);
      await shot('15-sampler.png', '#sampler-panel', 12);
      await closePanels();
      await js(`document.getElementById('btn-settings').click(); return 1`);
      await wait(900);
      await shot('17-ajustes-1.png', 'dialog[open]', 16);
      await js(`__app.setSettingsPane('library'); return 1`);
      await wait(300);
      await shot('17-ajustes-2.png', 'dialog[open]', 16);
      await closePanels();
      await js(`document.getElementById('btn-help').click(); return 1`);
      await wait(400);
      await shot('18-ayuda.png', 'dialog[open]', 16);
      await closePanels();
      await js(`document.getElementById('btn-midi-learn').click(); const el = document.querySelector('#deck-A .play'); el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true})); return 1`);
      await wait(300);
      await shot('19-midi-learn.png');
      await js(`document.getElementById('btn-midi-learn').click(); return 1`);
      await js(`const b=document.getElementById('btn-rec'); b.classList.add('recording'); b.querySelector('span').textContent='REC 0:42'; return 1`);
      await shot('20-grabando.png', '.topbar');
      await js(`const b=document.getElementById('btn-rec'); b.classList.remove('recording'); b.querySelector('span').textContent='REC'; return 1`);

      // ---- AutoMix (vista en la librería) ----
      await js(`
        const A=__app.decks.A, B=__app.decks.B;
        for (const d of [A,B]) { if (d.st.playing) d.togglePlay(); d.setLoop(null); d.syncLock=false; d.setPitch(0); }
        const xf=document.getElementById('xfader'); xf.value=-1; xf.dispatchEvent(new Event('input'));
        const am=__app.automix; am.setCfg({ len: 12, style: 'bass', matchTempo: true, endless: false, preferLocal: true });
        await am.start({ tracks: ${JSON.stringify([rows[1], rows[2], rows[3], rows[0]])} });
        __app.library.show('automix');
        return 1`);
      await wait(6000);
      await shot('21-automix.png', '.library');
      await js(`const cur = __app.automix.cur; cur.seek(cur.st.dur - 13.5); return 1`);
      await wait(7000);
      await shot('22-automix-mezclando.png');
      await shot('23-automix-vista-mezclando.png', '.library');
      await js(`__app.automix.stop(); return 1`);

      // ---- vistas de trabajo y cola de análisis ----
      await js(`__app.library.show('local'); __app.setView('mix'); __app.setWaves('top'); const A=__app.decks.A; A.seek(40); return 1`);
      await wait(800);
      await shot('37-vista-mezcla.png');
      await js(`__app.setView('library'); return 1`); await wait(700);
      await shot('38-vista-libreria.png');
      await js(`__app.setView('waves'); return 1`); await wait(700);
      await shot('39-vista-ondas.png');
      await js(`__app.setView('mix'); __app.setWaves('deck'); return 1`); await wait(700);
      await shot('40-ondas-en-el-deck.png');
      await js(`__app.setWaves('top'); __app.setView('automix'); return 1`); await wait(900);
      await shot('41-vista-automix.png');
      await js(`__app.setView('library'); await window.ytdj.backlog.pause(); await window.ytdj.backlog.add({ name: 'Playlist de ejemplo', tracks: ${JSON.stringify(rows.map((r) => ({ videoId: 'DEMO' + r.videoId.slice(0, 7), title: r.title + ' (ejemplo)', artist: r.artist, duration: r.duration })))} }); document.querySelector('.sources [data-tab="queue"]').click(); return 1`);
      await wait(900);
      await shot('42-cola-de-analisis.png', '.library');
      await js(`const st = await window.ytdj.backlog.state(); for (const l of st.lists) await window.ytdj.backlog.cancel(l.id); await window.ytdj.backlog.resume(); __app.setView('mix'); return 1`);
    } catch (e) {
      L('error', e.stack.slice(0, 500));
    }
    fs.writeFileSync(path.join(require('os').tmpdir(), 'alyssdj-screenshots-log.json'), JSON.stringify(log, null, 2));
    win.close();
  });
};
