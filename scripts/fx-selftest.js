// Autoprueba del motor de efectos y de la resonancia, con OfflineAudioContext dentro de la app (usa los mismos scripts).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,500)}}})()`, true);
    await wait(2500);
    await js(`__app.masterGain = 0; return 1`);
    const res = await js(`
      const SR = 44100, N = SR * 2;
      // señal de prueba determinista: seno 220 Hz + ruido (LCG) + un clic inicial
      const src = (ctx, kind = 'mix') => { const b = ctx.createBuffer(2, N, SR); let s = 12345; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < N; i++) { s = (s * 1664525 + 1013904223) >>> 0; const n = (s / 4294967296) * 2 - 1; d[i] = kind === 'click' ? (i === 0 ? 1 : 0) : 0.35 * Math.sin(2 * Math.PI * 220 * i / SR) + 0.25 * n; } } const n = ctx.createBufferSource(); n.buffer = b; return n; };
      const rms = (a, from = 0, to = a.length) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, to - from)); };
      const run = async (slots, { bpm = 120, kind = 'mix', after } = {}) => { const ctx = new OfflineAudioContext(2, N, SR); const fx = YTDJFx.create(ctx); const s = src(ctx, kind); s.connect(fx.input); fx.output.connect(ctx.destination); fx.set({ slots, bpm }); const mounted = fx.mounted(); s.start(); const buf = await ctx.startRendering(); return { d: buf.getChannelData(0), mounted, state: fx.get() }; };
      const dryRun = async (kind = 'mix') => { const ctx = new OfflineAudioContext(2, N, SR); const s = src(ctx, kind); s.connect(ctx.destination); s.start(); return (await ctx.startRendering()).getChannelData(0); };
      const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s / a.length); };
      const bad = (a) => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return true; return false; };
      const slot = (type, o = {}) => ({ type, on: true, wet: 1, p: 0.5, ...o });
      const off = (t) => ({ type: t, on: false, wet: 0.5, p: 0.5 });
      const R = {};
      const dry = await dryRun();
      R.types = YTDJFx.TYPES; R.slots = YTDJFx.SLOTS;
      // REQ-1: apagadas o con wet 0 el audio pasa igual
      const allOff = await run([off('echo'), off('reverb'), off('filter')]);
      R.offDist = dist(allOff.d, dry); R.offMounted = allOff.mounted;
      const wet0 = await run([slot('echo', { wet: 0 }), slot('flanger', { wet: 0 }), slot('crush', { wet: 0 })]);
      R.wet0Dist = dist(wet0.d, dry); R.wet0Mounted = wet0.mounted;
      // cada tipo altera la señal, sin NaN ni desbordes
      R.each = {};
      for (const t of YTDJFx.TYPES) { const o = await run([slot(t, t === 'crush' ? { p: 1 } : {}), off('reverb'), off('filter')]); let peak = 0; for (const v of o.d) peak = Math.max(peak, Math.abs(v)); R.each[t] = { dist: dist(o.d, dry), nan: bad(o.d), peak, mounted: o.mounted[0] }; }
      // serie: el orden importa; el mismo tipo en dos ranuras
      const fc = await run([slot('filter', { p: 0.2 }), slot('crush', { p: 0.9 }), off('filter')]);
      const cf = await run([slot('crush', { p: 0.9 }), slot('filter', { p: 0.2 }), off('filter')]);
      R.orderDist = dist(fc.d, cf.d);
      const one = await run([slot('echo'), off('reverb'), off('filter')]);
      const two = await run([slot('echo'), slot('echo'), off('filter')]);
      R.twoEchoDist = dist(one.d, two.d); R.twoMounted = two.mounted;
      // P por tipo
      const ver = async (t, p) => (await run([slot(t, { p }), off('reverb'), off('filter')])).d;
      const rv0 = await ver('reverb', 0), rv1 = await ver('reverb', 1);
      R.reverbTail = { small: rms(rv0, SR * 1.5, N), large: rms(rv1, SR * 1.5, N) };
      const clickLarge = (await run([slot('reverb', { p: 1 }), off('echo'), off('filter')], { kind: 'click' })).d;
      const clickSmall = (await run([slot('reverb', { p: 0 }), off('echo'), off('filter')], { kind: 'click' })).d;
      R.clickTail = { small: rms(clickSmall, SR * 1.5, N), large: rms(clickLarge, SR * 1.5, N) };
      const uniq = (a) => new Set(Array.from(a.slice(SR / 2, SR / 2 + 8000), (v) => Math.round(v * 1e5))).size;
      R.crushUniq = { low: uniq(await ver('crush', 0)), high: uniq(await ver('crush', 1)) };
      R.filterRms = { closed: rms(await ver('filter', 0), SR / 2), open: rms(await ver('filter', 1), SR / 2), dry: rms(dry, SR / 2) };
      const g = await ver('gate', 0.5); let mn = 1e9, mx = 0; for (let i = SR / 2; i + 441 < N; i += 441) { const w = rms(g, i, i + 441); mn = Math.min(mn, w); mx = Math.max(mx, w); } R.gateQuiet = mx / Math.max(mn, 1e-9); R.gateRms = rms(g, SR / 2);
      // sincronía con el BPM
      const e60 = (await run([slot('echo'), off('reverb'), off('filter')], { bpm: 60 })).d, e120 = (await run([slot('echo'), off('reverb'), off('filter')], { bpm: 120 })).d;
      R.bpmDist = dist(e60, e120);
      const g60 = (await run([slot('gate'), off('reverb'), off('filter')], { bpm: 60 })).d, g120 = (await run([slot('gate'), off('reverb'), off('filter')], { bpm: 120 })).d;
      R.gateBpmDist = dist(g60, g120);
      // montaje bajo demanda y cambio de tipo
      const ctx = new OfflineAudioContext(2, 4410, SR); const fx = YTDJFx.create(ctx);
      R.mount = [fx.mounted()];
      fx.set({ slots: [slot('echo'), off('reverb'), off('filter')] }); R.mount.push(fx.mounted());
      fx.set({ slots: [slot('phaser'), slot('crush'), off('filter')] }); R.mount.push(fx.mounted());
      fx.set({ slots: [off('phaser'), off('crush'), off('filter')] }); R.mount.push(fx.mounted());
      fx.set({ slots: [{ type: 'nope', on: true, wet: 9, p: -1 }, null, null] }); R.clamped = fx.get().slots[0]; R.after = fx.mounted();
      // REQ-4: resonancia del filtro de canal
      const chainRun = async (m) => { const ctx = new OfflineAudioContext(2, N, SR); const ch = YTDJChain.create(ctx); await new Promise((r) => setTimeout(r, 30)); const s = src(ctx); s.connect(ch.input); ch.setMix({ fader: 1, trim: 0, low: 0, mid: 0, high: 0, pfl: 0, ...m }); s.start(); return (await ctx.startRendering()).getChannelData(0); };
      const base = await chainRun({ filter: 0 }), lo0 = await chainRun({ filter: -0.5, res: 0 }), lo1 = await chainRun({ filter: -0.5, res: 1 }), loDef = await chainRun({ filter: -0.5 });
      R.res = { base: rms(base, SR / 2), lo0: rms(lo0, SR / 2), lo1: rms(lo1, SR / 2), loDef: rms(loDef, SR / 2), diff: dist(lo0, lo1), nan: bad(lo1) };
      const hi1 = await chainRun({ filter: 0.5, res: 1 }); let pk = 0; for (const v of hi1) pk = Math.max(pk, Math.abs(v)); R.res.hiPeak = pk;
      const neutral = await chainRun({ filter: 0, res: 1 }); R.res.neutralDist = dist(neutral, base);
      // la cadena de canal acepta el mensaje mix con fx
      const fxChain = await chainRun({ fx: [slot('crush', { p: 1 }), off('reverb'), off('filter')], bpm: 128 }); R.chainFxDist = dist(fxChain, base);
      return R;`);
    fs.writeFileSync(path.join(out, 'fx.json'), JSON.stringify(res));
    win.close();
  });
};
