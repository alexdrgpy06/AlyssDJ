#!/usr/bin/env node
// Guardias del deck de streaming (comprobación estática del preload, que solo corre dentro de la página de YT Music).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../preload/deck.js'), 'utf8');
// REQ-1: sin pista cargada (`expected` vacío) el video se pausa y se silencia antes de salir del tick
const tick = src.slice(src.indexOf('tick(eng) {'));
const idle = tick.indexOf('if (!expected) {');
assert.ok(idle > 0, 'falta la guardia sin pista');
const block = tick.slice(idle, tick.indexOf('return;', idle));
assert.ok(/v\.pause\(\)/.test(block) && /v\.muted = true/.test(block), 'pausa y silencia');
assert.ok(idle < tick.indexOf('settling'), 'va antes de cualquier otra lógica');
// REQ-2: si YT Music avanza solo a otra canción se vuelve a la pista del deck, sin excepción de «versión en video»
assert.ok(/d\.id !== expected\.videoId && !settling\)/.test(src) && !/isVideoSwitch|videoSwitchUntil|videoPref/.test(src));
console.log('stream-guard: OK');
