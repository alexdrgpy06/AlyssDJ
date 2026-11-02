#!/usr/bin/env node
// Pruebas del cambio automix-fx-cues.  Uso: node scripts/test-fxcues.js cues|moves|plan|engine|ui|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

// pista de 120 BPM, frase de 16 beats = 8 s, rejilla desde 0,5 s
const ana = (phrases, extra = {}) => ({ bpm: 120, offset: 0.5, duration: phrases.length * 8 + 4, mix: { phraseBeats: 16, phrases }, ...extra });

tests.cues = async () => {
  const { fxCues, LEVELS } = await import('../renderer/fxcues.js');
  assert.deepStrictEqual(LEVELS, ['off', 'subtle', 'full']);
  // REQ-1: sin datos → vacío (AutoMix se comporta como siempre)
  assert.deepStrictEqual(fxCues(null), []); assert.deepStrictEqual(fxCues({}), []);
  assert.deepStrictEqual(fxCues({ bpm: 0, offset: 0, mix: { phrases: [10, 20, 30, 40, 50] } }), [], 'sin BPM');
  assert.deepStrictEqual(fxCues(ana([40, 50, 60])), [], 'menos de 4 frases');
  assert.deepStrictEqual(fxCues(ana([60, 60, 61, 60, 60, 59])), [], 'una pista plana no tiene cues');
  // caída: salto ≥ 30 % tras frases flojas
  const d = fxCues(ana([30, 30, 30, 80, 80, 80]));
  assert.deepStrictEqual(d.map((c) => [c.kind, c.t]), [['drop', 24.5]], 'caída en la frase 3 (t = 0,5 + 3·8)');
  assert.ok(d[0].strength > 0.5 && d[0].strength <= 1);
  // rotura: caída de energía que se queda baja
  const b = fxCues(ana([80, 80, 80, 30, 30, 80]));
  assert.deepStrictEqual(b.map((c) => c.kind), ['break', 'drop'], 'la rotura y luego la caída'); assert.strictEqual(b[0].t, 24.5); assert.strictEqual(b[1].t, 40.5);
  // un bajón de una sola frase que se recupera no es rotura
  assert.deepStrictEqual(fxCues(ana([80, 80, 80, 30, 80, 80])).map((c) => c.kind), ['drop'], 'solo la vuelta cuenta como caída');
  // la última frase no es rotura
  assert.deepStrictEqual(fxCues(ana([80, 80, 80, 80, 30])), []);
  // subida con caída: 4 frases creciendo y salto final
  const s = fxCues(ana([20, 30, 40, 50, 100, 100]));
  assert.deepStrictEqual(s.map((c) => c.kind), ['build', 'drop'], JSON.stringify(s));
  assert.strictEqual(s[0].t, 0.5); assert.strictEqual(s[0].end, 32.5, 'la subida termina donde empieza la caída'); assert.strictEqual(s[1].t, 32.5);
  // subida sin caída: crece pero sin salto
  const g = fxCues(ana([40, 44, 49, 55, 55, 55]));
  assert.deepStrictEqual(g.map((c) => c.kind), ['build']); assert.strictEqual(g[0].end, g[0].t + 4 * 8);
  // crecimiento insuficiente (< 25 %) no es subida
  assert.deepStrictEqual(fxCues(ana([50, 52, 54, 56, 56, 56])), []);
  // silencio: el suelo evita cues falsos entre frases casi mudas
  assert.deepStrictEqual(fxCues(ana([0, 2, 0, 3, 1, 0])), []);
  // ordenado, determinista y sin tocar la entrada
  const phrases = [30, 30, 30, 80, 80, 40, 40, 90, 95, 100, 40];
  const copy = phrases.slice(); const x = fxCues(ana(phrases)); const y = fxCues(ana(phrases));
  assert.deepStrictEqual(x, y); assert.deepStrictEqual(phrases, copy);
  assert.deepStrictEqual(x.map((c) => c.t), [...x.map((c) => c.t)].sort((p, q) => p - q), 'ordenado por tiempo');
  // la rejilla usa el BPM: a 60 BPM la frase dura 16 s
  assert.strictEqual(fxCues({ ...ana([30, 30, 30, 80, 80, 80]), bpm: 60 })[0].t, 48.5);
  console.log('cues ok');
};

tests.moves = async () => {
  const { FxChain } = await import('../renderer/fxchain.js');
  const { FxMoves } = await import('../renderer/fxcues.js');
  // un deck de mentira con la misma interfaz que Deck (fxc, fxSet, fxRamp) y reloj inyectable para las rampas
  let t = 0; const q = [];
  const mk = (id) => { const d = { id, fxc: new FxChain(null), fxSet(s, p, o = 'user') { return this.fxc.set(s, p, { owner: o }); }, fxRamp(s, tg, sec, o = 'user') { return this.fxc.ramp(s, tg, sec, { owner: o, now: () => t, schedule: (fn) => q.push(fn) }); } }; return d; };
  const timers = []; const mv = () => new FxMoves({ timer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clear: () => {} });
  // owner: set de usuario vs de AutoMix
  const c = new FxChain(null); assert.deepStrictEqual(c.owners, ['user', 'user', 'user']);
  c.set(0, { on: true }, { owner: 'auto' }); assert.strictEqual(c.owners[0], 'auto'); c.set(0, { wet: 0.2 }); assert.strictEqual(c.owners[0], 'user', 'un cambio normal es del usuario');
  c.ramp(1, { wet: 1 }, 0, { owner: 'auto' }); assert.strictEqual(c.owners[1], 'auto');
  // reservar: primera ranura apagada; configura el efecto y guarda el estado previo
  let a = mk('A'); let m = mv();
  const s0 = m.claim(a, { name: 'eco de salida', type: 'echo', p: 0.5 });
  assert.strictEqual(s0, 0); assert.deepStrictEqual(a.fxc.slots[0], { type: 'echo', on: true, wet: 0, p: 0.5 }); assert.strictEqual(a.fxc.owners[0], 'auto');
  // REQ-5: nunca toca una ranura encendida por el usuario
  a = mk('A'); m = mv(); a.fxc.set(0, { type: 'flanger', on: true, wet: 0.7 }); a.fxc.set(1, { on: true });
  assert.strictEqual(m.claim(a, { name: 'x', type: 'reverb' }), 2, 'salta las encendidas'); assert.deepStrictEqual(a.fxc.slots[0], { type: 'flanger', on: true, wet: 0.7, p: 0.5 }, 'la del usuario intacta');
  assert.strictEqual(m.claim(a, { name: 'riser', type: 'phaser' }), null, 'sin ranura libre → null'); assert.deepStrictEqual(m.takeSkipped(), ['riser']); assert.deepStrictEqual(m.takeSkipped(), []);
  // dos reservas no comparten ranura
  a = mk('A'); m = mv(); assert.strictEqual(m.claim(a, { name: 'a', type: 'echo' }), 0); assert.strictEqual(m.claim(a, { name: 'b', type: 'reverb' }), 1); assert.deepStrictEqual(m.active(), ['a', 'b']);
  // mover y rampa solo mientras es suya
  assert.ok(m.set(a, 0, { wet: 0.4 })); assert.strictEqual(a.fxc.slots[0].wet, 0.4);
  t = 0; assert.ok(m.ramp(a, 1, { wet: 0.6 }, 2)); t = 2000; q.shift()(); assert.ok(Math.abs(a.fxc.slots[1].wet - 0.6) < 1e-9); assert.strictEqual(a.fxc.owners[1], 'auto', 'la rampa de AutoMix sigue siendo de AutoMix');
  // el usuario toca la ranura 0 → AutoMix la suelta y no la restaura ni la vuelve a mover
  a.fxc.set(0, { wet: 0.9 });
  assert.strictEqual(m.set(a, 0, { wet: 0.1 }), false); assert.strictEqual(a.fxc.slots[0].wet, 0.9, 'manda el usuario'); assert.deepStrictEqual(m.active(), ['b']);
  m.releaseAll(); assert.strictEqual(a.fxc.slots[0].wet, 0.9, 'lo del usuario no se restaura'); assert.strictEqual(a.fxc.slots[0].on, true);
  // restaurar: estado previo completo (tipo, cantidad, P, apagada)
  a = mk('B'); m = mv(); a.fxc.set(1, { type: 'crush', wet: 0.8, p: 0.1, on: false }); a.fxc.set(0, { on: true });
  const sl = m.claim(a, { name: 'riser', type: 'phaser', p: 0.7 }); assert.strictEqual(sl, 1); m.set(a, 1, { wet: 0.5 });
  m.release(a, 1); assert.deepStrictEqual(a.fxc.slots[1], { type: 'crush', on: false, wet: 0.8, p: 0.1 }); assert.strictEqual(a.fxc.owners[1], 'user'); assert.deepStrictEqual(m.active(), []);
  // cola del eco: se suelta tras el retardo, no antes
  a = mk('A'); m = mv(); timers.length = 0; m.claim(a, { name: 'eco de salida', type: 'echo' }); m.set(a, 0, { wet: 0.6 }); m.release(a, 0, 4000);
  assert.strictEqual(a.fxc.slots[0].on, true, 'sigue sonando la cola'); assert.strictEqual(timers[0].ms, 4000); timers[0].fn(); assert.strictEqual(a.fxc.slots[0].on, false); assert.deepStrictEqual(m.active(), []);
  // releaseAll limpia todo, incluso rampas en curso
  a = mk('A'); const b = mk('B'); m = mv(); m.claim(a, { name: '1', type: 'echo' }); m.claim(b, { name: '2', type: 'reverb' }); m.ramp(a, 0, { wet: 1 }, 5); t = 0;
  m.releaseAll(); assert.ok(!a.fxc.slots[0].on && !b.fxc.slots[0].on); assert.deepStrictEqual(m.active(), []); assert.strictEqual(a.fxc.ramps[0], null, 'la rampa se canceló');
  // varios decks y ranuras independientes
  a = mk('A'); const b2 = mk('B'); m = mv(); assert.strictEqual(m.claim(a, { name: 'x', type: 'echo' }), 0); assert.strictEqual(m.claim(b2, { name: 'y', type: 'echo' }), 0);
  console.log('moves ok');
};

tests.plan = async () => {
  const { planTransitionMoves, planTrackMoves, fxCues } = await import('../renderer/fxcues.js');
  // pista: 120 BPM (frase 8 s), rotura en la frase 5 (t = 40,5) y caída en la 7 (t = 56,5)
  const cur = ana([80, 80, 80, 80, 80, 30, 30, 90, 90, 90], { duration: 84 });
  const cues = fxCues(cur); assert.deepStrictEqual(cues.map((c) => c.kind), ['break', 'drop']);
  // REQ-2/6: apagado = nada
  assert.deepStrictEqual(planTransitionMoves({ level: 'off', cur, plan: { exitAt: 30, seconds: 16 }, style: 'bass' }), []);
  assert.deepStrictEqual(planTransitionMoves({ level: 'raro', cur, plan: { exitAt: 30, seconds: 16 }, style: 'bass' }), []); assert.deepStrictEqual(planTransitionMoves({ level: 'subtle', cur, plan: null }), []);
  // REQ-3: eco de salida en el último cuarto, de 0 a 0,6, con cola de 4 s
  let mv = planTransitionMoves({ level: 'subtle', cur, plan: { exitAt: 20, seconds: 16 }, style: 'bass' });
  const eo = mv.find((m) => m.id === 'echo-out'); assert.ok(eo);
  assert.deepStrictEqual([eo.deck, eo.type, eo.startP, eo.targetWet, eo.tailMs], ['from', 'echo', 0.75, 0.6, 4000]); assert.strictEqual(eo.rampSeconds, 4, 'el 25 % de 16 s');
  assert.ok(!mv.some((m) => m.id === 'reverb-break'), 'la rotura (40,5) queda fuera de la ventana 20–36');
  // transición corta (< 4 s): sin eco de salida
  assert.ok(!planTransitionMoves({ level: 'subtle', cur, plan: { exitAt: 20, seconds: 3 }, style: 'bass' }).some((m) => m.id === 'echo-out'));
  // reverb de rotura: dentro de la ventana, en fundido y bass swap, no en «filtro»
  const win = { exitAt: 36, seconds: 16 };
  mv = planTransitionMoves({ level: 'subtle', cur, plan: win, style: 'crossfade' }); const rb = mv.find((m) => m.id === 'reverb-break');
  assert.ok(rb); assert.deepStrictEqual([rb.type, rb.atPos, rb.targetWet], ['reverb', 40.5, 0.5]); assert.strictEqual(rb.rampSeconds, 0.5, 'un beat'); assert.strictEqual(rb.endPos, 48.5, 'una frase de duración'); assert.strictEqual(planTransitionMoves({ level: 'subtle', cur, plan: { exitAt: 36, seconds: 8 }, style: 'bass' }).find((m) => m.id === 'reverb-break').endPos, 44, 'tope: fin de la transición (36 + 8)');
  assert.ok(planTransitionMoves({ level: 'subtle', cur, plan: win, style: 'bass' }).some((m) => m.id === 'reverb-break'));
  assert.ok(!planTransitionMoves({ level: 'subtle', cur, plan: win, style: 'filter' }).some((m) => m.id === 'reverb-break'), 'con el estilo filtro no hay reverb');
  assert.ok(planTransitionMoves({ level: 'full', cur, plan: win, style: 'bass' }).length >= 2, 'Marcado también hace los de transición');
  // REQ-4: solo en «Marcado» y fuera de transición
  const rise = ana([40, 50, 60, 70, 100, 100, 100, 100, 100, 100], { duration: 84 }); const rc = fxCues(rise); // build 0,5→32,5 · drop 32,5
  assert.deepStrictEqual(rc.map((c) => c.kind), ['build', 'drop']);
  assert.strictEqual(planTrackMoves({ level: 'subtle', cues: rc, pos: 1, bpm: 120 }), null); assert.strictEqual(planTrackMoves({ level: 'off', cues: rc, pos: 1, bpm: 120 }), null);
  const r = planTrackMoves({ level: 'full', cues: rc, pos: 1, bpm: 120 });
  assert.deepStrictEqual([r.id, r.type, r.p, r.maxWet, r.fromPos, r.toPos], ['riser', 'phaser', 0.7, 0.5, 0.5, 32.5]);
  assert.strictEqual(planTrackMoves({ level: 'full', cues: rc, pos: 33, bpm: 120 }), null, 'ya pasó la caída');
  assert.strictEqual(planTrackMoves({ level: 'full', cues: rc, pos: 20, bpm: 120 }), null, 'a mitad de la subida (tras buscar con la aguja) no se empieza');
  // la transición manda: 8 s antes de la salida no hay movimientos
  assert.strictEqual(planTrackMoves({ level: 'full', cues: rc, pos: 1, bpm: 120, exitAt: 8 }), null); assert.ok(planTrackMoves({ level: 'full', cues: rc, pos: 1, bpm: 120, exitAt: 60 }));
  // reverb de rotura sobre la pista que suena, con una frase de duración
  const bk = planTrackMoves({ level: 'full', cues, pos: 41, bpm: 120 });
  assert.deepStrictEqual([bk.id, bk.type, bk.fromPos, bk.toPos], ['reverb-break', 'reverb', 40.5, 48.5]);
  // una frase de separación entre movimientos
  assert.strictEqual(planTrackMoves({ level: 'full', cues, pos: 41, bpm: 120, lastEnd: 36 }), null, 'terminó hace menos de una frase (8 s)'); assert.ok(planTrackMoves({ level: 'full', cues, pos: 41, bpm: 120, lastEnd: 30 }));
  assert.strictEqual(planTrackMoves({ level: 'full', cues: [], pos: 5 }), null); assert.strictEqual(planTrackMoves({ level: 'full', cues, pos: NaN }), null);
  // la rotura dentro de una subida no lanza reverb
  const mix2 = [{ t: 10, kind: 'build', end: 40, strength: 1 }, { t: 40, kind: 'drop', strength: 1 }, { t: 20, kind: 'break', strength: 0.5 }].sort((x, y) => x.t - y.t);
  assert.strictEqual(planTrackMoves({ level: 'full', cues: mix2, pos: 21, bpm: 120 }), null);
  console.log('plan ok');
};

const electronRun = (selftest, name) => {
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-fxcues-'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, selftest), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, name);
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};

tests.engine = async () => {
  const r = electronRun('fxcues-selftest.js', 'fxcues.json');
  assert.ok(!r.__err, JSON.stringify(r.__err));
  const def = (t) => ({ type: t, on: false, wet: 0.5, p: 0.5 }); const defs = [def('echo'), def('reverb'), def('filter')];
  // REQ-3: transición en Sutil
  assert.deepStrictEqual(r.planned, ['echo-out', 'reverb-break']);
  assert.deepStrictEqual(r.early, defs, 'al 30 % todavía no hay efectos');
  assert.deepStrictEqual([r.mid.A[0].type, r.mid.A[0].on], ['echo', true], 'eco de salida en la primera ranura libre'); assert.ok(r.mid.A[0].wet > 0 && r.mid.A[0].wet <= 0.6, `wet sube (${r.mid.A[0].wet})`);
  assert.deepStrictEqual([r.mid.A[1].type, r.mid.A[1].on], ['reverb', true], 'reverb de rotura en la segunda'); assert.deepStrictEqual(r.mid.owners.slice(0, 2), ['auto', 'auto']);
  assert.ok(/Efecto: eco de salida, reverb de rotura/.test(r.mid.note), r.mid.note); assert.strictEqual(r.mid.fx.level, 'subtle');
  assert.ok(r.afterFinish.A[0].on, 'la cola del eco sigue sonando al terminar'); assert.ok(!r.afterFinish.A[1].on, 'la reverb ya se apagó al acabar su frase'); assert.strictEqual(r.afterFinish.trans, false);
  assert.deepStrictEqual(r.restored.A, defs, 'todo vuelve a su estado anterior tras la cola'); assert.deepStrictEqual(r.restored.owners, ['user', 'user', 'user']); assert.deepStrictEqual(r.restored.active, []);
  // REQ-5: el usuario manda
  assert.strictEqual(r.userTook.A[0].wet, 0.9, 'lo que el usuario tocó no se restaura ni se mueve'); assert.strictEqual(r.userTook.A[0].on, true); assert.deepStrictEqual(r.userTook.active, []);
  // sin ranura libre: se omite, se avisa y no se toca nada
  assert.ok(r.noFree.A.every((s, i) => s.on && Math.abs(s.wet - (0.3 + i / 10)) < 1e-9), 'las ranuras del usuario intactas'); assert.ok(/sin ranura libre para eco de salida/.test(r.noFree.note), r.noFree.note);
  // REQ-2/6: Apagado
  assert.strictEqual(r.offPlanned, 0); assert.deepStrictEqual(r.off.A, defs); assert.deepStrictEqual(r.off.fx, { level: 'off', active: [] }); assert.strictEqual(r.off.note.includes('Efecto'), false);
  // REQ-4: Marcado sobre cues
  assert.deepStrictEqual([r.riserOn.A[0].type, r.riserOn.A[0].on], ['phaser', true]); assert.ok(r.riserOn.live); assert.ok(/Efecto: riser/.test(r.riserOn.note));
  assert.ok(Math.abs(r.riserMid - 0.5 * (16 - 0.5) / 32) < 0.02, `el wet sigue a la subida (${r.riserMid})`);
  assert.deepStrictEqual(r.riserCut.A, defs, 'se corta de golpe en la caída y se restaura'); assert.strictEqual(r.riserCut.live, false);
  assert.deepStrictEqual(r.subtleTrack, defs, 'en Sutil no hay movimientos sobre cues');
  assert.deepStrictEqual(r.jump.A, defs, 'un salto de la aguja suelta el riser'); assert.strictEqual(r.jump.live, false);
  assert.deepStrictEqual([r.breakOn[0].type, r.breakOn[0].on], ['reverb', true]); assert.ok(r.breakOn[0].wet > 0); assert.deepStrictEqual(r.breakOff.A, defs); assert.strictEqual(r.breakOff.live, false);
  // limpieza: detener AutoMix y cambiar de pista
  assert.strictEqual(r.beforeStop, true); assert.deepStrictEqual(r.afterStop.A, defs); assert.deepStrictEqual(r.afterStop.active, []); assert.strictEqual(r.afterStop.live, false);
  assert.deepStrictEqual(r.trackChange.A, defs); assert.strictEqual(r.trackChange.live, false);
  console.log('engine ok');
};

tests.ui = async () => {
  const html = read('renderer/index.html'); const app = read('renderer/app.js'); const css = read('renderer/styles.css');
  assert.ok(html.includes('id="amv-fx"') && html.includes('id="imm-fx"') && /<option value="subtle"/.test(html), 'selector y chip');
  assert.ok(/fxLevel: e\.target\.value/.test(app) && /st\.fx\.level/.test(app) && /\.imm-chip/.test(css));
  const r = electronRun('fxcues-ui-selftest.js', 'fxcues-ui.json');
  assert.ok(!r.__err, JSON.stringify(r.__err));
  // REQ-2: tres niveles, «Sutil» por defecto, recordado entre sesiones
  assert.deepStrictEqual(r.opts.vals, ['off', 'subtle', 'full']); assert.deepStrictEqual(r.opts.labels, ['Apagado', 'Sutil', 'Marcado']); assert.strictEqual(r.opts.cur, 'subtle'); assert.strictEqual(r.opts.label, 'Efectos'); assert.ok(r.opts.aria);
  assert.deepStrictEqual(r.after, { cfg: 'full', snap: 'full', sel: 'full' }); assert.deepStrictEqual(r.persisted, { cfg: 'full', sel: 'full' }, 'recordado');
  // REQ-6: nota, estado y chip mientras hay un movimiento; nada con «Apagado»
  assert.ok(/Efecto: eco de salida/.test(r.trans.note), r.trans.note); assert.ok(/efectos sutiles/.test(r.trans.status) || /efectos marcados/.test(r.trans.status), r.trans.status);
  assert.strictEqual(r.trans.chipHidden, false); assert.ok(/Efecto: eco de salida/.test(r.trans.chip), r.trans.chip);
  assert.strictEqual(r.off.chipHidden, true); assert.strictEqual(r.off.note.includes('Efecto'), false);
  // 1366×768 sin desbordes
  assert.ok(r.opts.sw <= r.opts.w && r.imm.sw <= r.imm.w, 'sin desbordes horizontales'); assert.ok(r.imm.sh <= r.imm.ih + 1, 'la vista Automix cabe');
  console.log('ui ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-fxcues.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
