#!/usr/bin/env node
// Pruebas del cambio automix-visual.  Uso: node scripts/test-visual.js model|ui|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

tests.model = async () => {
  const { beatPhase, beatInBar, deckRings, vizScene, pulseOf } = await import('../renderer/viz.js');
  // fase y compás: 120 BPM → beat de 0,5 s; rejilla desde 0,25 s
  near(beatPhase(0.25, 120, 0.25), 0, 1e-9, 'en el beat'); near(beatPhase(0.5, 120, 0.25), 0.5, 1e-9, 'a mitad'); near(beatPhase(0.74, 120, 0.25), 0.98, 1e-9, 'casi el siguiente');
  assert.strictEqual(beatPhase(5, 0, 0), 0, 'sin BPM'); assert.strictEqual(beatPhase(NaN, 120, 0), 0);
  assert.deepStrictEqual([0, 0.5, 1, 1.5, 2, 2.5].map((t) => beatInBar(t, 120, 0)), [0, 1, 2, 3, 0, 1], 'compás de 4');
  assert.strictEqual(beatInBar(-0.25, 120, 0), 3, 'antes de la rejilla no da negativos');
  const on = { level: 0.8, gain: 1, bpm: 120, offset: 0, playing: true };
  // REQ-1: cuatro anillos que se expanden con la fase; el pulso es máximo en el beat
  const a = deckRings({ ...on, pos: 0.5 }); const b = deckRings({ ...on, pos: 0.75 });
  assert.strictEqual(a.rings.length, 4); assert.ok(a.rings.every((r) => r.r >= 0 && r.r <= 1 && r.a >= 0));
  assert.ok(b.rings[1].r > a.rings[1].r, 'los anillos se expanden con la fase'); assert.ok(a.pulse > b.pulse, 'el pulso cae tras el beat'); near(deckRings({ ...on, pos: 0.5 }).pulse, 0.8, 1e-9, 'pulso = nivel en el beat');
  // el primer tiempo del compás marca más (grosor y opacidad) que los demás, y decae con la fase
  const down = deckRings({ ...on, pos: 2 }); const off = deckRings({ ...on, pos: 2.5 }); const downLate = deckRings({ ...on, pos: 2.4 });
  assert.ok(down.rings[0].w > off.rings[0].w, 'primer tiempo con más grosor'); assert.ok(down.rings[1].a > off.rings[1].a * 1.1); assert.ok(down.rings[1].w > downLate.rings[1].w, 'el acento decae');
  assert.strictEqual(deckRings({ ...on, pos: 2.5 }).rings[0].w, 1, 'beats sin acento: grosor base');
  // intensidad con el nivel y la ganancia del canal
  assert.ok(deckRings({ ...on, level: 1, pos: 0.7 }).intensity > deckRings({ ...on, level: 0.1, pos: 0.7 }).intensity);
  assert.strictEqual(deckRings({ ...on, gain: 0, pos: 0.7 }).intensity, 0); near(deckRings({ ...on, gain: 0.5, level: 1, pos: 0.7 }).intensity, 0.5, 1e-9, 'ganancia'); assert.ok(deckRings({ ...on, gain: 9, level: 1, pos: 0.7 }).intensity <= 1, 'acotada');
  assert.ok(deckRings({ ...on, level: 5, pos: 0.7 }).rings.every((r) => r.a <= 1.4), 'sin desbordes con niveles absurdos');
  // REQ-2: sin BPM respira con el nivel, en pausa quieto y tenue
  const nb = deckRings({ level: 0.9, gain: 1, bpm: 0, pos: 3, playing: true }); const nb2 = deckRings({ level: 0.1, gain: 1, bpm: 0, pos: 3, playing: true });
  assert.strictEqual(nb.rings.length, 1); assert.ok(nb.rings[0].r > nb2.rings[0].r, 'respira con el nivel'); assert.strictEqual(nb.pulse, 0);
  const paused = deckRings({ ...on, playing: false, pos: 1 }); const paused2 = deckRings({ ...on, playing: false, pos: 1.3 });
  assert.deepStrictEqual(paused, paused2, 'en pausa no depende de la posición'); assert.strictEqual(paused.pulse, 0); assert.ok(paused.rings.every((r) => r.a === 0.12)); assert.strictEqual(paused.intensity, 0);
  // REQ-4: movimiento reducido → estático (mismo resultado en cualquier posición, sin pulso)
  const r1 = deckRings({ ...on, pos: 0.6, reduced: true }); const r2 = deckRings({ ...on, pos: 1.1, reduced: true });
  assert.deepStrictEqual(r1, r2, 'estático'); assert.strictEqual(r1.pulse, 0); assert.ok(r1.rings.every((r) => r.a > 0), 'se ve');
  // REQ-3: transición: los dos decks a la vez, cada uno con la intensidad de su canal
  const s = vizScene([{ id: 'A', level: 0.8, gain: 0.25, bpm: 120, pos: 10, offset: 0, playing: true }, { id: 'B', level: 0.8, gain: 0.75, bpm: 124, pos: 4, offset: 0, playing: true }]);
  assert.deepStrictEqual(s.map((x) => x.id), ['A', 'B']); assert.ok(s[1].intensity > s[0].intensity * 2, 'B más fuerte que A según su ganancia');
  const sx = vizScene([{ id: 'A', level: 0.8, gain: 1, bpm: 120, pos: 0.5, offset: 0, playing: true }, { id: 'B', level: 0, gain: 0, bpm: 0, pos: 0, playing: false }]);
  assert.strictEqual(pulseOf(sx), sx[0].pulse, 'el latido de la portada sigue al deck más fuerte'); assert.strictEqual(pulseOf([]), 0);
  // REQ-6: el latido de la portada nunca pasa de 1 (+1,5 % de escala = 0,015·pulso)
  assert.ok(pulseOf(vizScene([{ id: 'A', level: 9, gain: 9, bpm: 120, pos: 0, offset: 0, playing: true }])) <= 1);
  console.log('model ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-visual.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
