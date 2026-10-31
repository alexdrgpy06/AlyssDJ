#!/usr/bin/env node
// Prueba de los decks compactos con AutoMix (app real, en silencio).
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-compact-'));
spawnSync(require('electron'), ['.'], { cwd: root, timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'automix-compact-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
const f = path.join(tmp, 'compact.json');
assert.ok(fs.existsSync(f), 'la app no produjo resultado');
const r = JSON.parse(fs.readFileSync(f, 'utf8'));
for (const k of ['before', 'during', 'after']) assert.ok(!r[k].__err, JSON.stringify(r[k]));
assert.strictEqual(r.before.cls, false, 'sin AutoMix: decks normales');
if (process.env.COMPACT_SHOT) fs.copyFileSync(path.join(tmp, 'compact.png'), process.env.COMPACT_SHOT);
assert.strictEqual(r.during.cls, true, 'REQ-1/2: con la vista de AutoMix los decks se compactan solos');
assert.ok(r.during.deck < r.before.deck * 0.55, `REQ-1: deck ${Math.round(r.during.deck)} < 55% de ${Math.round(r.before.deck)}`);
assert.ok(r.during.library >= r.during.win * 0.4, `REQ-4: la vista ocupa ${Math.round(r.during.library)} de ${r.during.win}`);
assert.ok(Object.values(r.during.vis).every(Boolean), `REQ-3: ${JSON.stringify(r.during.vis)}`);
assert.strictEqual(r.during.scroll, false, 'sin desplazamiento de página');
assert.strictEqual(r.after.cls, false, 'REQ-2: al salir vuelven los decks completos');
assert.ok(Math.abs(r.after.deck - r.before.deck) < 2, 'misma altura que al inicio');
if (process.env.COMPACT_SHOT) fs.copyFileSync(path.join(tmp, 'compact.png'), process.env.COMPACT_SHOT);
console.log('automix-compact: OK', JSON.stringify({ deck: [r.before.deck, r.during.deck].map(Math.round), library: [r.before.library, r.during.library].map(Math.round) }));
