// Autoprueba: abre el editor con una pista local analizada y la edita como un usuario.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const music = process.env.YTDJ_DOCS_MUSIC;
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = {};
    win.setContentSize(1600, 960);
    await wait(2500);
    await js(`__app.masterGain = 0; __app.eachDeck((d) => d.pushMix()); return 1`);
    const rows = [];
    for (const n of ['Neon Drive', 'Sunset Groove']) rows.push(await js(`return (await window.ytdj.local.register(${JSON.stringify(path.join(music, n + '.mp3'))})).data`));
    await js(`for (const r of ${JSON.stringify(rows)}) window.ytdj.analysis.request(r.videoId, { meta: { title: r.title, artist: r.artist, thumb: r.thumb, trackDuration: r.duration }, file: r.path }); return 1`);
    for (let i = 0; i < 60; i++) { await wait(500); if (await js(`return !!(await window.ytdj.analysis.get(${JSON.stringify(rows[0].videoId)})) && !!(await window.ytdj.analysis.get(${JSON.stringify(rows[1].videoId)}))`)) break; }
    res.rows = rows.map((r) => r.videoId);
    // cola de AutoMix con las dos pistas y análisis cargados
    await js(`const am = __app.automix; am.cfg.preferLocal = false; am.queue = ${JSON.stringify(rows)}; for (const r of ${JSON.stringify(rows)}) am.ana.set(r.videoId, await window.ytdj.analysis.get(r.videoId)); document.querySelector('.tabs [data-tab="automix"]').click(); am.emit(); return 1`);
    await wait(500);
    // abrir desde la fila de la cola
    res.opened = await js(`document.querySelector('#amv-list [data-act="edit"]').click(); await new Promise(r=>setTimeout(r,500)); const d=document.getElementById('mixedit'); return { open: d.open, auto: document.getElementById('me-hint').textContent, items: document.querySelectorAll('#me-list li').length, previewDisabled: document.getElementById('me-preview').disabled }`);
    fs.writeFileSync(path.join(out, 'mixedit-auto.png'), (await win.webContents.capturePage()).toPNG());
    // REQ-2: añadir dos salidas (doble clic), arrastrar una, mover prioridad y borrar
    res.edit = await js(`
      const c = document.getElementById('me-wave'); const r = c.getBoundingClientRect();
      const ev = (type, x, o={}) => c.dispatchEvent(new MouseEvent(type, { bubbles:true, clientX: r.left + x, clientY: r.top + 40, button: 0, ...o }));
      const before = document.querySelectorAll('#me-list li').length;
      ev('dblclick', r.width*0.30); await new Promise(r=>setTimeout(r,300));
      ev('dblclick', r.width*0.55); await new Promise(r=>setTimeout(r,300));
      const m = window.__app.mixEditor; const outs1 = m.edit.outs.map(o=>o.t);
      // arrastrar la última salida hacia 70 %
      const last = m.edit.outs.length - 1;
      const x0 = (m.edit.outs[last].t / m.dur) * r.width;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, clientX: r.left + x0, clientY: r.top+40, button:0, pointerId:1 }));
      c.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, clientX: r.left + r.width*0.70, clientY: r.top+40, pointerId:1 }));
      c.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, clientX: r.left + r.width*0.70, clientY: r.top+40, pointerId:1 }));
      await new Promise(r=>setTimeout(r,500));
      const saved = await window.ytdj.analysis.setMixEdit; 
      const stored = (await window.ytdj.analysis.get(${JSON.stringify(rows[0].videoId)})).mixEdit;
      return { before, outs1, after: m.edit.outs.map(o=>o.t), stored: stored && stored.outs.map(o=>o.t), snapped: m.edit.outs.every(o => { const beat = 60/m.ana.bpm; const k=(o.t-(m.ana.offset||0))/beat; return Math.abs(k-Math.round(k)) < 0.02; }), dur: m.dur };`);
    fs.writeFileSync(path.join(out, 'mixedit-edited.png'), (await win.webContents.capturePage()).toPNG());
    // prioridad: subir la 2.ª; borrar la 1.ª
    res.order = await js(`const m=window.__app.mixEditor; const first=m.edit.outs.map(o=>o.t); document.querySelector('#me-list [data-a="up"][data-i="1"]').click(); await new Promise(r=>setTimeout(r,500)); const swapped=m.edit.outs.map(o=>o.t); document.querySelector('#me-list [data-a="rm"][data-i="0"]').click(); await new Promise(r=>setTimeout(r,500)); return { first, swapped, afterRm: m.edit.outs.map(o=>o.t), stored: (await window.ytdj.analysis.get(${JSON.stringify(rows[0].videoId)})).mixEdit.outs.map(o=>o.t) }`);
    // máximo 6 puntos
    res.max = await js(`const m=window.__app.mixEditor; for (let i=0;i<9;i++) m.addOut(20+i*13); await new Promise(r=>setTimeout(r,500)); return { n: m.edit.outs.length, addDisabled: document.getElementById('me-add').disabled }`);
    // REQ-4: probar la mezcla (en silencio): A suena, y B entra al llegar a la salida
    res.preview = await js(`
      const m = window.__app.mixEditor; m.silentPreview = true;
      // la cola tiene el siguiente analizado; las pistas locales tienen archivo
      m.sel = 0; const v = m.view(); const exit = v.outs[0].t;
      document.getElementById('me-preview').disabled = false;
      const can = m.canPreview();
      if (!can.ok) return { can };
      await m.startPreview();
      const p = m.preview; const t0 = p.A.currentTime; await new Promise(r=>setTimeout(r,1500)); const t1 = p.A.currentTime;
      const info = { can, advanced: t1 - t0, plan: p.plan, exit, startedAt: t0 };
      m.stopPreview();
      return info;`);
    // REQ-5: restaurar
    res.reset = await js(`document.getElementById('me-reset').click(); await new Promise(r=>setTimeout(r,600)); return { stored: (await window.ytdj.analysis.get(${JSON.stringify(rows[0].videoId)})).mixEdit ?? null, hint: document.getElementById('me-hint').textContent }`);
    // REQ-3 en el deck: la edición viaja con el análisis
    fs.writeFileSync(path.join(out, 'mixedit.json'), JSON.stringify(res));
    win.close();
  });
};
