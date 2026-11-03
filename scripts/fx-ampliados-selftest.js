// Autoprueba de los efectos nuevos con OfflineAudioContext dentro de la app (mismos scripts que en uso): señal, estabilidad, parámetros y coste.
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
      const NEW = ['tape', 'reducer', 'stutter', 'brake', 'transformer', 'drive', 'pitch'];
      const src = (ctx, kind = 'mix') => { const b = ctx.createBuffer(2, N, SR); let s = 12345; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < N; i++) { s = (s * 1664525 + 1013904223) >>> 0; const n = (s / 4294967296) * 2 - 1; d[i] = kind === 'click' ? (i === 0 ? 1 : 0) : kind === 'sine' ? 0.35 * Math.sin(2 * Math.PI * 220 * i / SR) : 0.35 * Math.sin(2 * Math.PI * 220 * i / SR) + 0.25 * n; } } const n = ctx.createBufferSource(); n.buffer = b; return n; };
      const rms = (a, from = 0, to = a.length) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, to - from)); };
      const run = async (slots, { bpm = 120, kind = 'mix', switchTo } = {}) => { const ctx = new OfflineAudioContext(2, N, SR); const fx = YTDJFx.create(ctx); const s = src(ctx, kind); s.connect(fx.input); fx.output.connect(ctx.destination); fx.set({ slots, bpm }); const mounted = fx.mounted(); s.start(); if (switchTo) { ctx.suspend(1).then(() => { fx.set({ slots: switchTo, bpm }); ctx.resume(); }); } const t0 = performance.now(); const buf = await ctx.startRendering(); return { d: buf.getChannelData(0), mounted, ms: performance.now() - t0, state: fx.get() }; };
      const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s / a.length); };
      const bad = (a) => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return true; return false; };
      const peak = (a) => { let p = 0; for (const v of a) p = Math.max(p, Math.abs(v)); return p; };
      const slot = (type, o = {}) => ({ type, on: true, wet: 1, p: 0.5, ...o });
      const off = (t) => ({ type: t, on: false, wet: 0.5, p: 0.5 });
      const rest = [off('reverb'), off('filter')];
      const zcr = (a, from, to) => { let z = 0; for (let i = from + 1; i < to; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) z++; return z / ((to - from) / SR) / 2; };
      const at = (a, from, to) => { let m = 0, k = from; for (let i = from; i < to; i++) if (Math.abs(a[i]) > m) { m = Math.abs(a[i]); k = i; } return { t: k / SR, v: m }; };
      const R = { NEW };
      const dry = (await run([off('echo'), ...rest])).d;
      const dryPeak = peak(dry); R.dryPeak = dryPeak;
      R.each = {};
      for (const t of NEW) {
        const o = await run([slot(t), ...rest]);
        R.each[t] = { dist: dist(o.d, dry), nan: bad(o.d), peak: peak(o.d), mounted: o.mounted[0], ms: o.ms };
      }
      const base = (await run([off('echo'), ...rest])).ms; R.baseMs = base;
      // coste: el mínimo de tres renders de cada tipo, menos el de la señal sin efecto (2 s de audio)
      R.cost = {};
      for (const t of NEW) { let best = 1e9; for (let k = 0; k < 3; k++) best = Math.min(best, (await run([slot(t), ...rest])).ms); R.cost[t] = (best - base) / 2000; }
      // apagadas o con wet 0: transparentes y sin nada montado
      const offAll = await run(NEW.slice(0, 3).map(off)); R.offDist = dist(offAll.d, dry); R.offMounted = offAll.mounted;
      for (const t of NEW) { const w0 = await run([slot(t, { wet: 0 }), ...rest]); R['w0' + t] = { dist: dist(w0.d, dry), mounted: w0.mounted[0] }; }
      // pitch: +12 sube una octava, -12 baja una octava, el centro no cambia el tono
      const sine = async (o) => (await run([slot('pitch', o), ...rest], { kind: 'sine' })).d;
      const up = await sine({ p: 1 }), down = await sine({ p: 0 }), mid = await sine({ p: 0.5 });
      const gz = (a, f, from = 20000, to = 80000) => { const w = 2 * Math.PI * f / SR; let re = 0, im = 0; for (let i = from; i < to; i++) { re += a[i] * Math.cos(w * i); im -= a[i] * Math.sin(w * i); } return Math.hypot(re, im) / (to - from); };
      const spec = (a) => ({ f110: gz(a, 110), f220: gz(a, 220), f440: gz(a, 440) });
      const top = (a) => { const r = []; for (let f = 40; f <= 1000; f += 5) r.push([f, gz(a, f)]); r.sort((x, y) => y[1] - x[1]); return { rms: rms(a, 20000, 80000), top: r.slice(0, 5).map(([f, v]) => [f, +v.toFixed(4)]) }; };
      R.pitchTop = { up: top(up), down: top(down) };
      R.pitchSpec = { up: spec(up), down: spec(down), mid: spec(mid) };
      R.pitch = { dry: zcr((await run([off('echo'), ...rest], { kind: 'sine' })).d, 30000, 80000), up: zcr(up, 30000, 80000), down: zcr(down, 30000, 80000), mid: zcr(mid, 30000, 80000) };
      // reducer: P alto oscurece y reduce la resolución
      const rd = (await run([slot('reducer', { p: 1 }), ...rest])).d; R.reducer = { rmsDry: rms(dry), rms: rms(rd), uniq: new Set(Array.from(rd.slice(20000, 40000), (v) => Math.round(v * 1e4))).size, uniqDry: new Set(Array.from(dry.slice(20000, 40000), (v) => Math.round(v * 1e4))).size };
      // transformer: el nivel se corta por pasos
      const tf = (await run([slot('transformer', { p: 0 }), ...rest])).d; const wins = []; for (let i = 0; i + 2205 <= N; i += 2205) wins.push(rms(tf, i, i + 2205)); const mx = Math.max(...wins); R.transformer = { quiet: wins.filter((w) => w < mx * 0.6).length / wins.length };
      // división de beat: con un clic, la repetición cae en la división elegida (120 BPM: 1 = 0,5 s, ¼ = 0,125 s)
      const rep = async (type, d) => at((await run([slot(type, { wet: 1, d }), ...rest], { kind: 'click' })).d, 2000, SR);
      R.div = { echo0: await rep('echo', 0), echo2: await rep('echo', 2), tape1: await rep('tape', 1), tape2: await rep('tape', 2) };
      // brake y stutter: el audio se repite o se frena (ya medido por dist); estable con distintos P y BPM
      R.stable = {}; for (const t of NEW) { let ok = true; for (const bpm of [70, 174]) for (const p of [0, 1]) { const o = await run([slot(t, { p, d: 4 }), ...rest], { bpm }); ok = ok && !bad(o.d) && peak(o.d) < 1.6; } R.stable[t] = ok; }
      // cambio de efecto sin chasquidos: el mayor salto entre muestras alrededor del cambio (1 s) en una senoide
      const jump = (a) => { let m = 0; for (let i = 44100 - 800; i < 44100 + 2400; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; };
      R.switch = {}; for (const [a, b] of [['tape', 'stutter'], ['drive', 'pitch'], ['brake', 'transformer'], ['reducer', 'echo'], ['echo', 'drive']]) { const o = await run([slot(a), ...rest], { kind: 'sine', switchTo: [slot(b), ...rest] }); const ja = jump((await run([slot(a), ...rest], { kind: 'sine' })).d), jb = jump((await run([slot(b), ...rest], { kind: 'sine' })).d); R.switch[a + '>' + b] = { jump: jump(o.d), own: Math.max(ja, jb), nan: bad(o.d) }; }
      R.dryJump = jump((await run([off('echo'), ...rest], { kind: 'sine' })).d);
      // d y modelo en el motor
      const e = YTDJFx.create(new OfflineAudioContext(2, 128, SR)); e.set({ slots: [{ type: 'tape', on: true, wet: 1, p: 0.5, d: 9 }, { type: 'echo', on: true, wet: 1, p: 0.5, d: -3 }, { type: 'gate', on: true, wet: 1, p: 0.5 }] }); R.dclamp = e.get().slots.map((s) => s.d);
      return R;`);
    fs.writeFileSync(path.join(out, 'fx-ampliados.json'), JSON.stringify(res));
    win.close();
  });
};
