// Autoprueba (YTDJ_SELFTEST=1): todo con los canales en 0, no suena nada.
// Escribe capturas y un informe JSON en YTDJ_SELFTEST_OUT.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function selftest(win, decks) {
  const out = process.env.YTDJ_SELFTEST_OUT || process.cwd();
  const report = { steps: [], console: [] };
  const step = (name, data) => {
    report.steps.push({ name, ...data });
    console.log('[selftest]', name, JSON.stringify(data));
  };
  const wc = win.webContents;
  wc.on('console-message', (e) => report.console.push(`${e.level}: ${e.message}`));
  for (const [id, d] of Object.entries(decks)) {
    d.view.webContents.on('console-message', (e) => /ytdj|Uncaught|Error/.test(e.message) && report.console.push(`deck${id} ${e.level}: ${e.message}`));
  }
  const js = (code) => wc.executeJavaScript(code, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => fs.writeFileSync(path.join(out, name), (await wc.capturePage()).toPNG());

  wc.once('did-finish-load', async () => {
    try {
      await wait(1500);
      // Silencio total: ambos canales a 0.
      await js(`for (const d of Object.values(__app.decks)) d.setMix({ fader: 0 }); true`);
      step('ui', await js(`({ decks: Object.keys(__app.decks), controls: window.__controls.size })`));

      // 1) Pista local sintética ya analizada (si existe en la caché).
      const local = process.env.YTDJ_SELFTEST_LOCAL;
      if (local) {
        await js(`(async () => {
          const d = __app.decks.A;
          await d.load({ videoId: '${local}', title: 'Synth 124', artist: 'selftest', thumb: '', duration: 90 });
          await d.setSource('local');
          d.togglePlay();
        })()`);
        await wait(2500);
        step('local-play', await js(`(() => { const d = __app.decks.A; return { source: d.source, pos: +d.pos().toFixed(2), playing: d.st.playing, bpm: d.bpm(), key: d.analysis && d.analysis.camelot, beat: d.phase() != null }; })()`));
        await js(`__app.decks.A.loopBeats(4); true`);
        await wait(2600);
        step('local-loop', await js(`(() => { const d = __app.decks.A; return { loop: d.loop, pos: +d.pos().toFixed(2) }; })()`));
        await shot('selftest-local.png');
      }

      // 2) Búsqueda en YouTube Music (innertube, sin sesión).
      await wait(4000);
      const res = await js(`window.ytdj.lib.search('daft punk one more time')`);
      step('search', { ok: res.ok, error: res.error, n: res.data && res.data.length, first: res.data && res.data.slice(0, 3) });

      // 3) Stream: cargar el primer resultado en B (canal a 0) y comprobar que el motor se engancha al <video>.
      if (res.ok && res.data.length) {
        await js(`(async () => { const r = (await window.ytdj.lib.search('daft punk one more time')).data[0]; __app.library.render([r]); await __app.decks.B.load(r); __app.decks.B.togglePlay(); })()`);
        await wait(9000);
        step('stream-play', await js(`(() => { const d = __app.decks.B; return { st: { ...d.st, level: undefined }, title: d.track.title, wave: d.wave && d.wave.kind }; })()`));
        await js(`__app.decks.B.togglePlay(); true`);
        await wait(800);
        await shot('selftest-stream.png');
      }
    } catch (e) {
      step('error', { message: e.message });
    }
    fs.writeFileSync(path.join(out, 'selftest.json'), JSON.stringify(report, null, 2));
    win.close();
  });
};
