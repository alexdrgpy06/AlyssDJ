#!/usr/bin/env node
// Pruebas de "yt-dlp sin sesión".  Uso: node scripts/test-ytdlp-sin-sesion.js settings|args|real
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const mode = process.argv[2];
const tests = {};

tests.settings = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-set-'));
  process.env.YTDJ_SETTINGS_DIR = dir;
  const settings = require('../main/settings');
  // REQ-1: por defecto, sin cookies
  assert.strictEqual(settings.get().cookieSource, 'none');
  // REQ-2: una configuración antigua con la sesión de la app se migra y se persiste
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ cookieSource: 'app', saveOnPlay: false }));
  delete require.cache[require.resolve('../main/settings')];
  const s2 = require('../main/settings');
  assert.strictEqual(s2.get().cookieSource, 'none', 'app → none');
  assert.strictEqual(s2.get().saveOnPlay, false, 'el resto se conserva');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).cookieSource, 'none', 'se persiste');
  // una elección explícita de navegador se respeta (opción avanzada)
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ cookieSource: 'firefox' }));
  delete require.cache[require.resolve('../main/settings')];
  assert.strictEqual(require('../main/settings').get().cookieSource, 'firefox');
};

tests.args = async () => {
  const Y = require('../main/ytdlp');
  const L = require('../main/library-save');
  // REQ-1 / REQ-3: nunca cookies de la sesión; solo un navegador elegido a mano
  assert.deepStrictEqual(Y.cookieArgs({ cookieSource: 'none' }), []);
  assert.deepStrictEqual(Y.cookieArgs({ cookieSource: 'app' }), [], 'la sesión de la app ya no se usa');
  assert.deepStrictEqual(Y.cookieArgs({}), []);
  assert.deepStrictEqual(Y.cookieArgs({ cookieSource: 'firefox' }), ['--cookies-from-browser', 'firefox']);
  assert.strictEqual(typeof Y.exportCookies, 'undefined', 'ya no se exportan cookies a yt-dlp');
  for (const f of ['analyzer.js', 'ytdlp.js']) {
    const src = fs.readFileSync(path.join(__dirname, '../main', f), 'utf8');
    assert.ok(!/exportCookies|cookies\.txt|--cookies['"]/.test(src), `${f} no usa cookies de la app`);
  }
  // REQ-4: runtime de JavaScript
  const rt = Y.runtime({ PATH: path.dirname(process.execPath) });
  assert.strictEqual(rt.args[0], '--js-runtimes');
  assert.ok(rt.args[1].startsWith('node:'));
  const noNode = Y.runtime({ PATH: '/nada' });
  assert.deepStrictEqual(noNode.env, { ELECTRON_RUN_AS_NODE: '1' }, 'sin node en el PATH, Electron hace de Node');
  // REQ-5: formatos y reintento
  assert.ok(L.formatArgs('audio').includes('bestaudio/best'));
  assert.deepStrictEqual(L.formatArgs('any'), ['-f', 'ba*/b']);
  assert.ok(Y.isFormatError('ERROR: [youtube] X: Requested format is not available. Use --list-formats'));
  assert.ok(!Y.isFormatError('ERROR: Video unavailable'));
  const calls = [];
  const ok = await Y.withFormatRetry(async (fmt) => {
    calls.push(fmt);
    if (fmt === 'audio') throw new Error('Requested format is not available');
    return 'listo';
  });
  assert.strictEqual(ok, 'listo');
  assert.deepStrictEqual(calls, ['audio', 'any'], 'un solo reintento con la selección abierta');
  calls.length = 0;
  await assert.rejects(Y.withFormatRetry(async (fmt) => (calls.push(fmt), Promise.reject(new Error('Requested format is not available')))), (e) => e.message === Y.FORMAT_ERROR && /streaming/.test(e.message));
  assert.deepStrictEqual(calls, ['audio', 'any']);
  calls.length = 0;
  await assert.rejects(Y.withFormatRetry(async (fmt) => (calls.push(fmt), Promise.reject(new Error('ERROR: Video unavailable')))), /unavailable/);
  assert.deepStrictEqual(calls, ['audio'], 'otros errores no se reintentan');
  // los argumentos que se pasan de verdad a yt-dlp: stub que registra su línea de comandos
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-stub-'));
  const stub = path.join(dir, 'yt-dlp');
  fs.writeFileSync(stub, `#!/bin/sh\necho "$@" > ${dir}/args.txt\necho "ERROR: nada" >&2\nexit 1\n`, { mode: 0o755 });
  await assert.rejects(Y.downloadToLibrary({ bin: stub, videoId: 'TOueemiIVYU', dir: path.join(dir, 'lib'), extraArgs: Y.cookieArgs({ cookieSource: 'none' }) }));
  const line = fs.readFileSync(path.join(dir, 'args.txt'), 'utf8');
  assert.ok(line.includes('--js-runtimes') && line.includes('bestaudio/best'), line);
  assert.ok(!line.includes('--cookies'), 'sin cookies en la línea de comandos');
};

tests.real = async () => {
  // Con la pista que falló en la app (Y2NkuFIlLEo), sin sesión: el formato debe resolverse. Solo se simula (no se descarga).
  const { spawnSync } = require('child_process');
  const Y = require('../main/ytdlp');
  const L = require('../main/library-save');
  const bin = path.join(__dirname, '../bin/yt-dlp');
  assert.ok(fs.existsSync(bin), 'bin/yt-dlp existe (npm run setup)');
  const run = (id, format) => spawnSync(bin, [...L.formatArgs(format), ...Y.runtime().args, ...Y.cookieArgs({ cookieSource: 'none' }), '--no-warnings', '--simulate', '--no-playlist', `https://music.youtube.com/watch?v=${id}`], { encoding: 'utf8', timeout: 90000, env: { ...process.env, ...Y.runtime().env } });
  const r = run('Y2NkuFIlLEo', 'audio');
  assert.strictEqual(r.status, 0, `la pista que fallaba se resuelve sin sesión:\n${r.stderr}`);
  assert.match(r.stdout + r.stderr, /Downloading 1 format/);
  // y un id inexistente falla con un mensaje que no es de formato (no se reintenta)
  const bad = run('zzzzzzzzzzz', 'audio');
  assert.notStrictEqual(bad.status, 0);
  assert.ok(!Y.isFormatError(bad.stderr), bad.stderr);
};

(async () => {
  if (!tests[mode]) {
    console.error(`modo desconocido: ${mode}. Disponibles: ${Object.keys(tests).join(', ')}`);
    process.exit(2);
  }
  await tests[mode]();
  console.log(`ytdlp-sin-sesion ${mode}: OK`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
