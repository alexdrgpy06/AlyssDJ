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

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-fxcues.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
