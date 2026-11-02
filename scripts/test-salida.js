#!/usr/bin/env node
// Pruebas del cambio automix-modo-salida.  Uso: node scripts/test-salida.js plan|queue|ui|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests.plan = async () => {
  const { planTransition, introOutroSeconds, EXIT_MODES } = await import('../renderer/mixplan.js');
  assert.deepStrictEqual(EXIT_MODES, ['optimal', 'intro-outro', 'outro-start', 'end']);
  // REQ-2: duración = el menor entre outro e intro; solo uno; ninguno; acotada; sin pasar del outro de la entrante
  assert.strictEqual(introOutroSeconds({ outroLen: 20, introLen: 12, fallback: 16 }), 12);
  assert.strictEqual(introOutroSeconds({ outroLen: 10, introLen: 30, fallback: 16 }), 10);
  assert.strictEqual(introOutroSeconds({ outroLen: 24, introLen: null, fallback: 16 }), 24, 'solo se conoce el outro');
  assert.strictEqual(introOutroSeconds({ outroLen: null, introLen: 18, fallback: 16 }), 18, 'solo se conoce el intro');
  assert.strictEqual(introOutroSeconds({ outroLen: null, introLen: 0, fallback: 16 }), 16, 'ninguno: la duración elegida');
  assert.strictEqual(introOutroSeconds({ outroLen: 2, introLen: 3, fallback: 16 }), 4, 'mínimo 4 s');
  assert.strictEqual(introOutroSeconds({ outroLen: 90, introLen: 80, fallback: 16 }), 48, 'máximo 48 s');
  assert.strictEqual(introOutroSeconds({ outroLen: 30, introLen: 30, fallback: 16, nextOutroGap: 14 }), 14, 'no pasa del outro de la entrante');

  // pista de 200 s a 120 BPM (beat 0,5 s): outro desde 160, roturas en 100 y 130
  const cur = { bpm: 120, offset: 0, duration: 200, camelot: '8A', mix: { outroStart: 160, introEnd: 16, mixIn: 0, mixOut: [{ t: 160, kind: 'outro', score: 1 }, { t: 130, kind: 'rotura', score: 0.6 }, { t: 100, kind: 'rotura', score: 0.6 }] } };
  const next = { bpm: 122, offset: 0, duration: 210, camelot: '8A', mix: { outroStart: 170, introEnd: 12, mixIn: 0 } };
  const P = (c, n, o) => planTransition(c, n, { len: 16, pos: 10, ...o });

  // REQ-1: cada modo
  const opt = P(cur, next, { exitMode: 'optimal' });
  assert.deepStrictEqual([opt.exitAt, opt.kind, opt.mode], [160, 'outro', 'optimal'], 'mejor punto = el mejor candidato del análisis');
  const end = P(cur, next, { exitMode: 'end' });
  assert.deepStrictEqual([end.kind, end.mode], ['final', 'end']);
  assert.ok(end.exitAt > 175, `sale casi al final: ${end.exitAt}`);
  const os = P(cur, next, { exitMode: 'outro-start' });
  assert.deepStrictEqual([os.exitAt, os.kind, os.mode], [160, 'outro', 'outro-start']);
  assert.ok(Math.abs(os.seconds - 16) <= 2, `la duración elegida: ${os.seconds}`);
  const io = P(cur, next, { exitMode: 'intro-outro' });
  assert.deepStrictEqual([io.exitAt, io.kind, io.mode], [160, 'outro', 'intro-outro']);
  assert.ok(Math.abs(io.seconds - 12) <= 2, `el menor entre outro (40) e intro (12): ${io.seconds}`);
  // la entrada con punto editado cuenta desde ahí
  const io2 = P(cur, { ...next, mixEdit: { in: 6 } }, { exitMode: 'intro-outro' });
  assert.ok(io2.seconds < io.seconds, 'con la entrada editada el intro restante es menor');
  // el outro de la saliente más corto que el intro
  const shortOutro = P({ ...cur, duration: 172, mix: { ...cur.mix, outroStart: 160, mixOut: [{ t: 160, kind: 'outro', score: 1 }] } }, { ...next, mix: { ...next.mix, introEnd: 40 } }, { exitMode: 'intro-outro' });
  assert.ok(shortOutro.seconds <= 12, `outro de 12 s manda: ${shortOutro.seconds}`);

  // sin outro marcado → final con aviso
  const noOutro = P({ ...cur, mix: { ...cur.mix, outroStart: undefined } }, next, { exitMode: 'outro-start' });
  assert.strictEqual(noOutro.kind, 'final'); assert.ok(noOutro.warnings.some((w) => /sin outro marcado/.test(w)), JSON.stringify(noOutro.warnings));
  const noMix = P({ bpm: 120, offset: 0, duration: 200 }, next, { exitMode: 'intro-outro' });
  assert.ok(noMix.kind === 'final' && noMix.warnings.some((w) => /sin outro marcado/.test(w)));
  // el outro ya pasó
  const passed = P(cur, next, { exitMode: 'outro-start', pos: 175 });
  assert.strictEqual(passed.kind, 'final'); assert.ok(passed.warnings.some((w) => /sin outro marcado/.test(w)));
  // los puntos editados mandan en cualquier modo
  const edited = { ...cur, mixEdit: { outs: [{ t: 120 }] } };
  for (const m of ['optimal', 'outro-start', 'intro-outro']) assert.deepStrictEqual([P(edited, next, { exitMode: m }).exitAt, P(edited, next, { exitMode: m }).kind], [120, 'edit'], m);
  assert.ok(Math.abs(P(edited, next, { exitMode: 'intro-outro' }).seconds - 16) <= 2, 'con puntos editados la duración sigue siendo la elegida');
  // ajuste heredado: optimal:false = final; sin nada = mejor punto
  assert.strictEqual(P(cur, next, { optimal: false }).mode, 'end');
  assert.strictEqual(P(cur, next, {}).mode, 'optimal');
  assert.strictEqual(P(cur, next, { exitMode: 'inventado', optimal: false }).mode, 'end');
  // salto de BPM: filtro y larga, también en intro-outro
  const jump = P(cur, { ...next, bpm: 150 }, { exitMode: 'intro-outro' });
  assert.strictEqual(jump.style, 'filter'); assert.ok(jump.warnings.some((w) => /salto de BPM/.test(w)));
  // sin BPM: fundido simple y al final
  assert.strictEqual(P({ duration: 200 }, next, { exitMode: 'outro-start' }).kind, 'final');
  console.log('plan: OK');
};

tests.queue = async () => {
  const listeners = [];
  const toasts = [];
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async () => null, request() {} }, lib: { radio: async () => ({ ok: true, data: [] }), search: async () => ({ ok: true, data: [] }) } } };
  const { AutoMix } = await import('../renderer/automix.js');
  const mk = (cfg = {}) => {
    const A = { id: 'A', track: { videoId: 'CUR' }, st: { playing: true, dur: 200 }, pos: 10, remaining: () => 190, channelGain: () => 1, analysis: null };
    const B = { id: 'B', track: null, st: {} };
    const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast: (m) => toasts.push(m), xfader: { value: -1 }, applyXf() {} };
    const am = new AutoMix(app);
    Object.assign(am.cfg, { endless: false }, cfg);
    am.on = true; am.cur = A;
    am.queue = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ videoId: x.toUpperCase(), title: `Pista ${x}`, local: true }));
    return { am, A, B };
  };
  const ids = (am) => am.queue.map((t) => t.videoId).join('');

  // REQ-1: el modo se deriva del ajuste heredado y se puede elegir
  let { am } = mk();
  assert.strictEqual(am.exitMode(), 'optimal');
  ({ am } = mk({ optimalPoints: false })); assert.strictEqual(am.exitMode(), 'end', 'puntos óptimos apagado → final de la pista');
  ({ am } = mk({ optimalPoints: true })); assert.strictEqual(am.exitMode(), 'optimal');
  ({ am } = mk({ optimalPoints: false, exitMode: 'intro-outro' })); assert.strictEqual(am.exitMode(), 'intro-outro', 'lo elegido manda');
  ({ am } = mk({ exitMode: 'raro' })); assert.strictEqual(am.exitMode(), 'optimal');
  am.setCfg({ exitMode: 'outro-start' }); assert.strictEqual(am.snapshot().exitMode, 'outro-start');

  // REQ-3: saltar siguiente
  ({ am } = mk());
  assert.strictEqual(am.snapshot().canSkip, true);
  assert.strictEqual(am.skipNext(), true);
  assert.strictEqual(ids(am), 'BCDE'); assert.ok(/Saltada: Pista a/.test(am.note) && toasts.at(-1) === am.note);
  am.pinned.add('C'); am.queue = am.queue.slice(0, 2); am.pinned.add('B');
  assert.strictEqual(am.skipNext(), true); assert.ok(!am.pinned.has('B'), 'la saltada deja de estar fijada'); assert.strictEqual(ids(am), 'C');
  assert.strictEqual(am.skipNext(), false, 'con una sola pista no hay nada que saltar'); assert.strictEqual(am.snapshot().canSkip, false);
  ({ am } = mk()); am.trans = { from: am.cur, to: {}, t0: performance.now(), len: 10 };
  assert.strictEqual(am.skipNext(), false, 'en plena transición no salta'); assert.strictEqual(am.snapshot().canSkip, false);
  ({ am } = mk()); am.on = false; assert.strictEqual(am.skipNext(), false);
  // un «Mezclar ahora» pendiente pierde su plan (era de la pista saltada)
  ({ am } = mk()); am.pendingMix = { plan: { exitAt: 50 } }; am.skipNext(); assert.deepStrictEqual(am.pendingMix, { plan: null });

  // REQ-4: barajar
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  ({ am } = mk());
  assert.strictEqual(am.cfg.smartOrder, true);
  assert.strictEqual(am.shuffle(seq([0.1, 0.9, 0.3, 0.6])), true);
  assert.notStrictEqual(ids(am), 'ABCDE'); assert.deepStrictEqual([...ids(am)].sort().join(''), 'ABCDE', 'no pierde ni duplica pistas');
  assert.strictEqual(am.cfg.smartOrder, false, '«Orden automático» se apaga'); assert.ok(/Orden automático/.test(am.note));
  assert.strictEqual(am.undoReorder(), true); assert.strictEqual(ids(am), 'ABCDE', 'Deshacer devuelve el orden anterior');
  // fijadas y la cabeza en preparación no se mueven
  ({ am } = mk({ smartOrder: false })); am.pinned.add('C'); am.pinned.add('D');
  const keepHead = () => { const r = am.shuffle(seq([0.2, 0.7, 0.4])); return r; };
  am.loadingNext = true; // la cabeza (A) ya se está cargando
  keepHead();
  assert.strictEqual(am.queue[0].videoId, 'A'); assert.strictEqual(am.queue[2].videoId, 'C'); assert.strictEqual(am.queue[3].videoId, 'D');
  assert.strictEqual(am.queue[1].videoId === 'B' || am.queue[1].videoId === 'E', true);
  assert.strictEqual(am.cfg.smartOrder, false);
  // cabeza ya cargada en el deck libre
  ({ am } = mk({ smartOrder: false })); am.app.decks.B.track = { videoId: 'A' };
  for (let k = 0; k < 6; k++) { am.shuffle(seq([0.5, 0.1, 0.9, 0.3])); assert.strictEqual(am.queue[0].videoId, 'A', 'la cargada no se mueve'); }
  // sin pistas sueltas no hay nada que barajar
  ({ am } = mk({ smartOrder: false })); for (const x of 'ABCDE') am.pinned.add(x);
  assert.strictEqual(am.shuffle(), false); assert.ok(/No hay pistas sueltas/.test(am.note));
  ({ am } = mk()); am.queue = am.queue.slice(0, 1); assert.strictEqual(am.shuffle(), false); assert.strictEqual(am.snapshot().canShuffle, false);
  // el azar no deja la misma cola: siempre cambia el orden
  ({ am } = mk({ smartOrder: false })); assert.strictEqual(am.shuffle(() => 0.999), true); assert.notStrictEqual(ids(am), 'ABCDE');
  // con el azar real siempre sale una permutación válida
  for (let k = 0; k < 40; k++) { ({ am } = mk({ smartOrder: false })); am.shuffle(); assert.strictEqual([...ids(am)].sort().join(''), 'ABCDE'); }
  console.log('queue: OK');
};

tests.ui = async () => {
  const html = read('renderer/index.html'); const app = read('renderer/app.js');
  assert.ok(/id="amv-exit"/.test(html) && !/id="amv-points"/.test(html), 'el selector sustituye al interruptor');
  for (const v of ['optimal', 'intro-outro', 'outro-start', 'end']) assert.ok(html.includes(`<option value="${v}"`), v);
  for (const id of ['amv-skip', 'amv-shuffle', 'imm-skip']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(/amv-exit/.test(app) && /skipNext/.test(app) && /shuffle\(\)/.test(app));
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-salida-')); const music = path.join(tmp, 'music');
  const gen = spawnSync(process.execPath, [path.join(__dirname, 'make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), `sin audio de demostración: ${gen.stderr || gen.stdout}`);
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 200000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'salida-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
  const f = path.join(tmp, 'salida.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.SALIDA_SHOTS) for (const n of ['automix-exit.png', 'automix-exit-lib.png']) fs.copyFileSync(path.join(tmp, n), path.join(process.env.SALIDA_SHOTS, n));
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, x] of Object.entries(r)) assert.ok(!(x && x.__err), `${k}: ${JSON.stringify(x)}`);
  if (process.env.DEBUG_SALIDA) console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.start.options, ['optimal', 'intro-outro', 'outro-start', 'end']);
  assert.strictEqual(r.start.exit, 'optimal'); assert.ok(r.start.queue.length >= 2, `cola: ${r.start.queue}`);
  // elegir modo cambia el plan y lo guarda
  for (const m of ['intro-outro', 'outro-start', 'end']) {
    assert.strictEqual(r['mode_' + m].exit, m, `selector en ${m}`); assert.strictEqual(r['mode_' + m].cfgExit, m);
    if (r['mode_' + m].plan) assert.strictEqual(r['mode_' + m].plan.mode, m, `el plan usa ${m}: ${JSON.stringify(r['mode_' + m].plan)}`);
  }
  assert.strictEqual(r.stored, 'end', `el modo se guarda: ${JSON.stringify(r.stored)}`);
  // saltar
  assert.strictEqual(r.skipped.queue.length, r.skippedBefore - 1, 'saltar quita una pista'); assert.ok(/Saltada|Cola barajada/.test(r.skipped.note), r.skipped.note);
  // barajar
  assert.strictEqual(r.shuffled.smart, false, 'barajar apaga «Orden automático»');
  assert.deepStrictEqual([...r.shuffled.queue].sort(), [...r.order0].sort(), 'misma cola, otro orden');
  assert.deepStrictEqual(r.undone, r.order0, 'Deshacer devuelve el orden');
  // vista Automix
  assert.strictEqual(r.imm.skip, true); assert.strictEqual(r.immAfter, r.order0.length - 2, 'saltar desde la vista Automix (ya se había saltado una)');
  console.log('ui: OK');
};

tests.docs = async () => {
  const d = read('docs/04-automix.md');
  assert.ok(/Elegir cuándo sale la pista que suena/.test(d) && /Outro y intro/.test(d) && /Inicio del outro/.test(d) && /Final de la pista/.test(d), 'modos de salida documentados');
  assert.ok(/Saltar siguiente/.test(d) && /Barajar/.test(d), 'saltar y barajar documentados');
  assert.ok(!/Mezclar en puntos óptimos\*\* \(activado/.test(d) && !/mezclar en puntos óptimos\./.test(d), 'sin el interruptor antiguo');
  assert.ok(/cuándo sale la pista que suena/.test(read('README.md')));
  const ci = read('.github/workflows/ci.yml');
  assert.ok(/for m in plan queue docs; do node scripts\/test-salida\.js/.test(ci) && /test-salida\.js ui/.test(ci), 'CI ejecuta test-salida');
  for (const m of d.matchAll(/\((?:docs\/)?(img\/[^)]+\.png)\)/g)) assert.ok(fs.existsSync(path.join(root, 'docs', m[1])), `falta ${m[1]}`);
  console.log('docs: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
