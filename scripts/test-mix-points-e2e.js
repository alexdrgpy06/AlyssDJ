#!/usr/bin/env node
// Prueba de punta a punta de los puntos de mezcla: app real, en silencio, con pistas sintéticas de estructura conocida.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { track, writeWav } = require('./structure-synth');

const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-mixpts-'));
// A (124 BPM) suena; B (126) es compatible; C (150) es un salto brusco.
const T = { A: track({ bpm: 124, offset: 0.3 }), B: track({ bpm: 126, offset: 0.2 }), C: track({ bpm: 150, offset: 0.25 }) };
const files = Object.entries(T).map(([k, t]) => {
  const f = path.join(tmp, `Pista ${k} - ${t.bpm}.wav`);
  writeWav(f, t.samples);
  return f;
});
const r = spawnSync(path.join(root, 'node_modules/.bin/electron'), ['.'], {
  cwd: root, timeout: 300000, encoding: 'utf8',
  env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'mix-points-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_MIX_FILES: JSON.stringify(files), YTDJ_MIX_SHOTS: process.env.YTDJ_MIX_SHOTS || '' },
});
const file = path.join(tmp, 'mix-points.json');
assert.ok(fs.existsSync(file), `la app no produjo resultado\n${(r.stderr || '').slice(-400)}`);
const res = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.ok(!res.error, `${res.error}\npasos: ${res.steps}`);

// REQ-1 y REQ-8: estructura en el análisis y datos visibles
assert.ok(res.analysisA && res.analysisA.version === 2, `análisis con estructura: ${JSON.stringify(res.analysisA)}`);
assert.ok(Math.abs(res.analysisA.outroStart - T.A.outroStart) < 0.2, `outro de A detectado: ${res.analysisA.outroStart} vs ${T.A.outroStart}`);
assert.ok(res.view.points && res.view.order, 'interruptores activados por defecto');
assert.ok(res.view.items.every((i) => i.bpm && i.bpm !== '—' && i.key), `BPM y tonalidad por pista: ${JSON.stringify(res.view.items)}`);
assert.match(res.view.curSub, /mezcla en .*\(outro/, `punto de mezcla planeado visible: ${res.view.curSub}`);
// REQ-4: la compatible (B, 126) va antes que el salto brusco (C, 150), aunque estaba detrás
assert.deepStrictEqual(res.order.titles.map((t) => t.match(/Pista (\w)/)[1]), ['B', 'C'], `ordenada por compatibilidad: ${res.order.titles}`);
assert.deepStrictEqual(res.order.jump, [false, true], 'marca el salto brusco');
assert.ok(Math.abs(res.order.gap[0]) > 0.5 && Math.abs(res.order.gap[0]) < 3, `Δ de BPM de B ≈ −1,6 % (hay que frenarla): ${res.order.gap}`);
assert.ok(res.order.gap[0] < 0, 'B es más rápida: la entrante se frena');
assert.ok(res.order.bpm[1] > 145 && res.order.bpm[1] < 155, `C se detecta a ~150 BPM, no a 100: ${res.order.bpm}`);
// REQ-2 y REQ-3: mezcla en el punto de salida (el outro), muy antes del final; en compases enteros
const m1 = res.mix1;
assert.ok(m1, 'hubo una primera transición');
assert.ok(Math.abs(m1.curPos - T.A.outroStart) < 2.5, `empezó en el outro (${T.A.outroStart.toFixed(1)} s), no en ${m1.curPos.toFixed(1)} s`);
assert.ok(m1.curDur - m1.curPos > 15, `y no al final: quedaban ${(m1.curDur - m1.curPos).toFixed(1)} s`);
assert.strictEqual(m1.kind, 'outro');
const beats = m1.len / (60 / 124);
assert.ok(Math.abs(beats - Math.round(beats)) < 0.01 && Math.round(beats) % 4 === 0, `compases enteros: ${beats}`);
assert.ok(m1.toPos > 0 && m1.toPos < 5, `la siguiente entra en su punto de entrada: ${m1.toPos}`);
// REQ-6: tempo igualado dentro de ±8 % y luego vuelve poco a poco
assert.strictEqual(m1.tempo, true);
assert.ok(Math.abs(m1.toRate - 1) <= 0.0801, `ajuste ≤ 8 %: ${m1.toRate}`);
assert.ok(Math.abs(m1.toRate - 124 / 126) < 0.01, `iguala 126 → 124: ${m1.toRate}`);
assert.ok(res.mix1End, 'la transición terminó');
assert.ok(res.glide.r1 > res.glide.r0 && res.glide.r1 < 1.0001, `el tempo vuelve gradualmente: ${JSON.stringify(res.glide)}`);
assert.ok(Math.abs(res.glide.r1 - res.glide.r0) < 0.02, 'sin salto brusco');
// REQ-5: salto de BPM → filtro, sin forzar tempo, mezcla más larga y aviso
const m2 = res.mix2;
assert.ok(m2, 'hubo una segunda transición');
assert.strictEqual(m2.style, 'filter');
assert.strictEqual(m2.tempo, false);
assert.ok(Math.abs(m2.toRate - 1) < 0.001, `no se forzó el tempo: ${m2.toRate}`);
assert.ok(m2.len > 12, `más larga que la normal: ${m2.len}`);
assert.ok(m2.warnings.some((w) => /salto de BPM/.test(w)), m2.warnings.join());
assert.deepStrictEqual(res.errors, [], 'sin errores en la consola');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('mix-points e2e: OK', JSON.stringify({ outro: +T.A.outroStart.toFixed(1), salioEn: +m1.curPos.toFixed(1), duracion: +m1.curDur.toFixed(1), len: +m1.len.toFixed(1) }));
