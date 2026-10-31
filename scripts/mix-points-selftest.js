// Módulo de autoprueba de los puntos de mezcla (lo carga scripts/test-mix-points-e2e.js). Todo en silencio.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const files = JSON.parse(process.env.YTDJ_MIX_FILES);
  const shots = process.env.YTDJ_MIX_SHOTS;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const res = { errors: [], steps: [] };
  wc.on('console-message', (e) => (e.level === 'error' || e.level >= 3) && res.errors.push(String(e.message).slice(0, 200)));
  const flush = (step) => { res.steps.push(`${new Date().toISOString().slice(11, 19)} ${step}`); fs.writeFileSync(path.join(out, 'mix-points.json'), JSON.stringify(res, null, 2)); };

  // Espera a que empiece una transición; devuelve lo medido en ese instante.
  const waitTransition = async (ms = 90000) => {
    for (let i = 0; i < ms / 250; i++) {
      await wait(250);
      const t = await js(`const am = __app.automix; if (!am.trans) return null; const t = am.trans; return { from: t.from.id, to: t.to.id, curPos: t.from.pos(), curDur: t.from.st.dur, toPos: t.to.pos(), len: t.len, style: t.style, tempo: t.tempo, warnings: t.warnings, kind: t.kind, toRate: t.to.rate(), toBpm: t.to.analysis && t.to.analysis.bpm, fromBpm: t.from.analysis && t.from.analysis.bpm, plan: am.plan }`);
      if (t) return t;
    }
    return null;
  };
  const waitEnd = async (ms = 90000) => {
    for (let i = 0; i < ms / 250; i++) {
      await wait(250);
      if (!(await js('return !!__app.automix.trans'))) return true;
    }
    return false;
  };

  wc.once('did-finish-load', async () => {
    try {
      await wait(2500);
      await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
      const rows = [];
      for (const f of files) rows.push((await js(`return (await window.ytdj.local.register(${JSON.stringify(f)})).data`)));
      const [A, B, C] = rows;
      // A suena; la cola trae primero la del salto brusco (C, 150 BPM) y después la compatible (B, 126 BPM)
      await js(`const am = __app.automix; am.setCfg({ len: 12, style: 'bass', endless: false, preferLocal: true, matchTempo: true, optimalPoints: true, smartOrder: true }); await am.start({ tracks: ${JSON.stringify([A, C, B])} }); __app.library.show('automix'); return 1`);
      flush('iniciado');
      // REQ-4 / REQ-8: se analizan por adelantado y la cola se reordena por compatibilidad de BPM
      let order = null;
      for (let i = 0; i < 40; i++) {
        await wait(500);
        order = await js(`const sn = __app.automix.snapshot(); return { titles: sn.queue.map((t) => t.title), bpm: sn.queue.map((t) => t.bpm), jump: sn.queue.map((t) => t.jump), gap: sn.queue.map((t) => t.gapPct), cur: sn.curInfo }`);
        if (order.bpm && order.bpm.every((b) => b) && order.cur && order.cur.bpm) break;
      }
      res.order = order;
      flush('ordenada');
      // REQ-1: la estructura llegó a los decks y a la vista
      res.view = await js(`return { items: [...document.querySelectorAll('#amv-list li')].map((l) => ({ t: l.querySelector('b').textContent, bpm: l.querySelector('.am-bpm, .bpm') && l.querySelector('.bpm').textContent, key: l.querySelector('.kchip') && l.querySelector('.kchip').textContent, gap: l.querySelector('.am-gap').textContent, jump: l.querySelector('.am-gap').classList.contains('jump') })), points: document.getElementById('amv-points').checked, order: document.getElementById('amv-order').checked, curSub: document.getElementById('amv-cur-sub').textContent }`);
      res.analysisA = await js(`const a = __app.decks.A.analysis || __app.decks.B.analysis; return a && a.mix ? { version: a.mix.version, outroStart: a.mix.outroStart, mixIn: a.mix.mixIn, outs: a.mix.mixOut.map((c) => c.kind) } : null`);

      // REQ-2: acerca la pista que suena a su punto de salida y comprueba que mezcla ahí, no al final
      const plan1 = await js('return __app.automix.snapshot().plan');
      res.plan1 = plan1;
      await js(`const am = __app.automix; am.cur.seek(am.plan.exitAt - 7); return 1`);
      res.mix1 = await waitTransition();
      flush('mezcla-1');
      if (shots) {
        fs.mkdirSync(shots, { recursive: true });
        const r = await js(`const b = document.querySelector('.library').getBoundingClientRect(); return { x: 0, y: Math.floor(b.y), width: innerWidth, height: Math.ceil(b.height) }`);
        fs.writeFileSync(path.join(shots, '28-automix-puntos.png'), (await wc.capturePage(r)).toPNG());
        fs.writeFileSync(path.join(shots, '29-automix-marcas.png'), (await wc.capturePage()).toPNG());
      }
      res.mix1End = await waitEnd();
      await wait(600);
      res.after1 = await js(`const am = __app.automix; return { cur: am.cur.id, title: am.cur.track.title, rate: am.cur.rate(), queue: am.queue.map((t) => t.title) }`);
      // REQ-6: el tempo natural vuelve poco a poco (no de golpe)
      const r0 = await js('return __app.automix.cur.rate()');
      await wait(5000);
      const r1 = await js('return __app.automix.cur.rate()');
      res.glide = { r0, r1 };
      flush('tempo-gradual');

      // REQ-5: salto brusco de BPM (C, 150) → filtro, sin forzar el tempo, mezcla larga y aviso
      await js(`const am = __app.automix; am.cur.seek(Math.max(0, am.plan.exitAt - 7)); return 1`);
      res.mix2 = await waitTransition();
      res.mix2End = await waitEnd();
      flush('mezcla-2');
      await js('__app.automix.stop(); return 1');
    } catch (e) {
      res.error = e.stack.slice(0, 400);
    }
    fs.writeFileSync(path.join(out, 'mix-points.json'), JSON.stringify(res, null, 2));
    win.close();
  });
};
