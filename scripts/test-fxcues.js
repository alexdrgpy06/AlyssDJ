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

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-fxcues.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
