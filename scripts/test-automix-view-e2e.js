#!/usr/bin/env node
// Prueba de punta a punta de la vista de AutoMix (app real, en silencio; usa una pista pública de YouTube de 17 s).
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const demo = path.join(root, 'docs/demo-audio');
if (!fs.existsSync(path.join(demo, 'Neon Drive.mp3'))) spawnSync('node', [path.join(__dirname, 'make-demo-audio.js'), demo], { stdio: 'ignore' });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-am-'));
const r = spawnSync(path.join(root, 'node_modules/.bin/electron'), ['.'], {
  cwd: root, timeout: 480000, encoding: 'utf8',
  env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'automix-view-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: demo, YTDJ_SAVE_LIB: path.join(tmp, 'lib'), YTDJ_AM_SHOTS: process.env.YTDJ_AM_SHOTS || '' },
});
const file = path.join(tmp, 'automix-view.json');
assert.ok(fs.existsSync(file), `la app no produjo resultado\n${(r.stderr || '').slice(-400)}`);
const res = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.ok(!res.error, res.error);

// REQ-1
assert.ok(res.view.visible && res.view.tableHidden, 'la vista reemplaza a la tabla');
assert.strictEqual(res.view.toggle, 'Detener AutoMix');
assert.ok(res.view.cur && res.view.cur !== '—', 'muestra lo que suena');
assert.strictEqual(res.view.items.length, 3, `muestra la cola: ${JSON.stringify(res.view.items)}`);
assert.ok(res.view.head, 'la primera de la cola está marcada como siguiente');
assert.ok(res.view.badges.every((b) => /Archivo local/.test(b)), `estado por pista: ${res.view.badges}`);
assert.strictEqual(res.view.next, res.view.items[0]);
// REQ-2: los botones reordenan la cola y la lista visible coincide
const e = res.edit;
for (const k of ['start', 'afterDown', 'afterNext', 'afterRemove', 'afterAdd']) assert.deepStrictEqual(e[k][0], e[k][1], `${k}: la lista visible coincide con la cola`);
assert.deepStrictEqual(e.afterDown[0], [e.start[0][1], e.start[0][0], e.start[0][2]], 'bajar');
assert.strictEqual(e.afterNext[0][0], e.afterDown[0][2], 'a continuación');
assert.strictEqual(e.afterRemove[0].length, 2, 'quitar');
assert.strictEqual(e.afterAdd[0].length, 3, 'añadir');
// REQ-3 y REQ-4
assert.ok(res.mixNow.mid, 'Mezclar ahora inicia la transición');
assert.match(res.mixNow.mid.status, /Mezclando [AB] → [AB]/);
assert.ok(res.mixNow.mid.barVisible, 'muestra el progreso');
assert.ok(res.mixNow.mid.len <= 6, 'transición corta');
assert.notStrictEqual(res.afterMix.cur, res.afterMix.before, 'cambió el deck en juego');
assert.ok(res.afterMix.curPlaying && !res.afterMix.otherPlaying && !res.afterMix.trans, 'terminó con la nueva sonando y la anterior en pausa');
assert.ok(!res.afterMix.queue.includes('Añadida durante la mezcla'), 'la edición durante la mezcla se aplicó');
// REQ-5: la pista de YouTube se prepara y se carga en local
assert.strictEqual(res.ytStates[res.ytStates.length - 1], 'ready', `estados: ${res.ytStates}`);
assert.ok(res.ytStates.some((s) => ['queued', 'download', 'analyze'].includes(s)), 'pasó por el estado de preparación');
assert.match(res.ytBadge, /Lista/);
assert.ok(res.ytPreload, 'la pista preparada se precarga en el deck libre');
assert.strictEqual(res.ytPreload.source, 'local', 'en modo LOCAL, no stream');
assert.ok(res.ytPreload.saved && res.ytPreload.bpm > 0, 'con análisis y archivo guardado');
// atajo
assert.strictEqual(res.shortcut.cur, 'TOueemiIVYU', 'Mayús + → mezcló hacia la pista de YouTube');
assert.strictEqual(res.shortcut.source, 'local');
assert.ok(res.shortcut.playing);
assert.deepStrictEqual(res.errors, [], 'sin errores en la consola');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('automix-view e2e: OK', JSON.stringify({ ytStates: res.ytStates, mid: res.mixNow.mid.status }));
