#!/usr/bin/env node
// "Confirma que no eres un bot" de YouTube: mensaje claro y pausa de las descargas, sin insistir.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const y = require('../main/ytdlp');
  assert.ok(y.isBotError("ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser"));
  assert.ok(y.isBotError('Sign in to confirm you\'re not a bot'));
  assert.ok(!y.isBotError('Requested format is not available'));
  if (process.platform === 'win32') return console.log('bot-check: OK (sin stub en Windows)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-bot-'));
  const count = path.join(dir, 'calls');
  const stub = path.join(dir, 'yt-dlp');
  fs.writeFileSync(stub, `#!/bin/sh\necho x >> "${count}"\necho "ERROR: [youtube] abc: Sign in to confirm you’re not a bot" >&2\nexit 1\n`, { mode: 0o755 });
  const calls = () => (fs.existsSync(count) ? fs.readFileSync(count, 'utf8').trim().split('\n').length : 0);
  y.resetBot();
  // el primer rechazo da el mensaje claro (no el texto crudo) y activa la pausa
  await assert.rejects(y.download({ bin: stub, videoId: 'abc', outDir: dir, extraArgs: [] }), (e) => e.message === y.BOT_ERROR);
  assert.strictEqual(calls(), 1);
  assert.ok(y.botBlocked());
  // en pausa no se lanza yt-dlp: ni descargas de audio ni a la librería
  await assert.rejects(y.download({ bin: stub, videoId: 'abd', outDir: dir, extraArgs: [] }), (e) => e.message === y.BOT_ERROR);
  await assert.rejects(y.downloadToLibrary({ bin: stub, videoId: 'abf', dir, extraArgs: [] }), (e) => e.message === y.BOT_ERROR);
  assert.strictEqual(calls(), 1, 'no se insiste mientras dura la pausa');
  // pasada la pausa se vuelve a intentar
  assert.ok(!y.botBlocked(Date.now() + y.BOT_COOLDOWN_MS + 1));
  y.resetBot();
  await assert.rejects(y.download({ bin: stub, videoId: 'abg', outDir: dir, extraArgs: [] }));
  assert.strictEqual(calls(), 2);
  y.resetBot();
  console.log('bot-check: OK');
})().catch((e) => (console.error(e), process.exit(1)));
