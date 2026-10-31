// Pruebas de los puntos de mezcla editables.  Uso: node --experimental-default-type=module scripts/test-mix-edit.js store|e2e
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = process.argv[2];
const tests = {};

tests.store = async () => {
  const M = require('../main/mixedit');
  const { planTransition } = await import('../renderer/mixplan.js');
  // REQ-2: sanea la edición: dentro de la pista, sin repetir, máximo 6 salidas, orden de preferencia conservado
  const c = M.sanitize({ in: 8.123456, outs: [{ t: 200 }, 100, { t: 100.01 }, { t: -3 }, { t: 9999 }, { t: 150 }, 'x', { t: 60 }, { t: 70 }, { t: 80 }, { t: 90 }, { t: 95 }], free: 1 }, 240);
  assert.strictEqual(c.in, 8.123);
  assert.deepStrictEqual(c.outs.map((o) => o.t), [200, 100, 150, 60, 70, 80], 'máx. 6, sin duplicados (100 y 100.01), fuera de rango descartadas, orden conservado');
  assert.strictEqual(c.free, true);
  assert.strictEqual(M.sanitize(null, 240), null);
  assert.strictEqual(M.sanitize({ in: 'x', outs: [] }, 240), null, 'vacía = sin edición');
  assert.strictEqual(M.sanitize({ in: 500, outs: [] }, 240), null, 'entrada fuera de la pista');
  // REQ-6 y REQ-5: persiste en un archivo aparte, sobrevive a reanalizar, y null restaura
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-mixedit-'));
  fs.writeFileSync(path.join(dir, 'abc.json'), JSON.stringify({ id: 'abc', bpm: 124, offset: 0.3, duration: 240, mix: { mixIn: 5, mixOut: [{ t: 100, score: 9 }] } }));
  const { Analyzer } = require('../main/analyzer');
  const events = [];
  const an = new Analyzer({ cacheDir: dir, settings: { get: () => ({}) }, session: null, emit: (e) => events.push(e), ffmpeg: () => 'ffmpeg', localLib: null, libraryDir: () => dir });
  assert.strictEqual(an.get('abc').mixEdit, undefined);
  an.setMixEdit('abc', { in: 12, outs: [{ t: 180 }, { t: 120 }] });
  assert.deepStrictEqual(an.get('abc').mixEdit.outs.map((o) => o.t), [180, 120]);
  assert.strictEqual(events.at(-1).stage, 'mixedit');
  assert.ok(fs.existsSync(path.join(dir, 'abc.mixedit.json')), 'archivo aparte');
  // reanalizar reescribe abc.json pero no la edición
  fs.writeFileSync(path.join(dir, 'abc.json'), JSON.stringify({ id: 'abc', bpm: 125, offset: 0.2, duration: 240, mix: { mixIn: 6, mixOut: [{ t: 110, score: 8 }] } }));
  assert.strictEqual(an.get('abc').mixEdit.in, 12, 'REQ-6: la edición sobrevive al reanálisis');
  assert.ok(!an.list().some((x) => String(x.id).includes('mixedit')), 'el archivo de edición no se lista como pista');
  an.setMixEdit('abc', null);
  assert.strictEqual(an.get('abc').mixEdit, undefined, 'REQ-5: restaurar');
  assert.ok(!fs.existsSync(path.join(dir, 'abc.mixedit.json')));
  // REQ-3: el plan usa solo las salidas editadas, en su orden de preferencia, y la entrada editada
  const base = { bpm: 124, offset: 0.3, duration: 240, mix: { mixIn: 5, mixOut: [{ t: 100, score: 9, kind: 'break' }] } };
  const nxt = { bpm: 124, offset: 0.2, mix: { mixIn: 5 } };
  const auto = planTransition(base, nxt, { len: 16, optimal: true, pos: 50 });
  assert.strictEqual(auto.exitAt, 100);
  const ed = planTransition({ ...base, mixEdit: { outs: [{ t: 180 }, { t: 120 }] } }, { ...nxt, mixEdit: { in: 33 } }, { len: 16, optimal: true, pos: 50 });
  assert.strictEqual(ed.exitAt, 180, 'primera preferida del usuario, no la automática');
  assert.strictEqual(ed.enterAt, 33, 'entrada editada');
  assert.strictEqual(ed.kind, 'edit');
  // si la preferida ya pasó, la siguiente editada; nunca vuelve a las automáticas
  const late = planTransition({ ...base, mixEdit: { outs: [{ t: 60 }, { t: 120 }] } }, nxt, { len: 16, optimal: true, pos: 90 });
  assert.strictEqual(late.exitAt, 120);
  const none = planTransition({ ...base, mixEdit: { outs: [{ t: 60 }] } }, nxt, { len: 16, optimal: true, pos: 90 });
  assert.strictEqual(none.kind, 'final', 'sin salida editada por delante: final de la pista');
  // sin ediciones: el cálculo automático de siempre
  assert.strictEqual(planTransition({ ...base, mixEdit: undefined }, nxt, { len: 16, optimal: true, pos: 50 }).exitAt, 100);
  console.log('mix-edit store: OK');
};

tests.e2e = async () => {
  const { spawnSync } = require('node:child_process');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-mixedit-e2e-'));
  const music = path.join(root, 'docs/demo-audio');
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), 'falta el audio de demostración: node scripts/make-demo-audio.js docs/demo-audio');
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 180000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/mix-edit-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_DOCS_MUSIC: music, YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'mixedit.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.MIXEDIT_SHOTS) for (const n of ['mixedit-auto.png', 'mixedit-edited.png']) fs.copyFileSync(path.join(tmp, n), path.join(process.env.MIXEDIT_SHOTS, n));
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of ['opened', 'edit', 'order', 'max', 'preview', 'reset']) assert.ok(!r[k]?.__err, `${k}: ${JSON.stringify(r[k])}`);
  // REQ-1: el editor abre con candidatos automáticos
  assert.strictEqual(r.opened.open, true);
  assert.match(r.opened.auto, /Automático/);
  assert.ok(r.opened.items >= 2, 'entrada + salidas candidatas');
  // REQ-2: dos salidas añadidas, ajustadas a beats, guardadas y arrastrables
  assert.ok(r.edit.outs1.length >= r.opened.items - 1 + 2 - 0 || r.edit.outs1.length >= 2, JSON.stringify(r.edit));
  assert.ok(r.edit.snapped, 'ajustadas a la rejilla de beats');
  assert.deepStrictEqual(r.edit.stored, r.edit.after, 'lo editado queda guardado');
  assert.notDeepStrictEqual(r.edit.after, r.edit.outs1, 'se arrastró la última');
  assert.ok(r.edit.after.at(-1) > r.edit.outs1.at(-1), 'hacia la derecha');
  // prioridad y borrado
  assert.deepStrictEqual(r.order.swapped.slice(0, 2), [r.order.first[1], r.order.first[0]], 'subir la 2.ª');
  assert.strictEqual(r.order.afterRm.length, r.order.first.length - 1);
  assert.deepStrictEqual(r.order.stored, r.order.afterRm);
  // máximo 6
  assert.strictEqual(r.max.n, 6);
  assert.strictEqual(r.max.addDisabled, true);
  // REQ-4: la prueba de mezcla suena (en silencio) y avanza
  assert.ok(r.preview.can?.ok, JSON.stringify(r.preview));
  assert.ok(r.preview.advanced > 1, `A avanzó ${r.preview.advanced}`);
  assert.ok(Math.abs(r.preview.startedAt - (r.preview.exit - r.preview.plan.lead)) < 0.5, 'arranca lead segundos antes de la salida');
  // REQ-5: restaurar
  assert.strictEqual(r.reset.stored, null);
  assert.match(r.reset.hint, /Automático/);
  console.log('mix-edit e2e: OK', JSON.stringify({ outs: r.edit.after, advanced: Math.round(r.preview.advanced * 10) / 10 }));
};

if (!tests[mode]) (console.error('uso: test-mix-edit.js', Object.keys(tests).join('|')), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
