#!/usr/bin/env node
// Prueba de punta a punta del inicio de sesión (arranca la app de verdad, con datos temporales y en silencio).
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-login-'));
const r = spawnSync(path.join(root, 'node_modules/.bin/electron'), ['.'], {
  cwd: root,
  timeout: 120000,
  encoding: 'utf8',
  env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'login-flow-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_LOGIN_SHOT: process.env.YTDJ_LOGIN_SHOT || '' },
});
const file = path.join(tmp, 'login-flow.json');
assert.ok(fs.existsSync(file), `la app no produjo resultado\n${r.stderr?.slice(-400)}`);
const res = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.ok(!res.error, res.error);

assert.strictEqual(res.dialog.open, true, 'REQ-1: el diálogo se abre');
assert.ok(res.dialog.hasImport && res.dialog.hasDirect, 'REQ-1: ofrece importar y login directo');
assert.ok(res.dialog.options.length >= 1, 'REQ-5: lista navegadores');
assert.strictEqual(res.errorPath.kind, 'err', `REQ-4: debe mostrar un error (${JSON.stringify(res.errorPath)})`);
assert.match(res.errorPath.text, /No se encontró el perfil de ese navegador/, 'REQ-4: mensaje comprensible con qué hacer');
assert.strictEqual(res.statusAfterError.loggedIn, false, 'REQ-4: un error no deja sesión a medias');
assert.strictEqual(res.import.count, 2, 'REQ-2/3: solo las 2 cookies de youtube/google');
assert.ok(res.cookiesInSession.youtube.includes('__Secure-3PAPISID'));
assert.ok(res.cookiesInSession.google.includes('SAPISID'));
assert.strictEqual(res.cookiesInSession.example, 0, 'REQ-3: se descarta lo que no es de youtube/google');
assert.strictEqual(res.statusAfterImport.loggedIn, true, 'REQ-7: el indicador refleja la cookie de sesión');
assert.ok([false, null].includes(res.verifyWithFakeCookies.loggedIn), 'REQ-7: con cookies falsas YouTube no confirma la sesión');
assert.strictEqual(res.statusAfterLogout.loggedIn, false);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('login-flow: OK', JSON.stringify({ errorPath: res.errorPath, verify: res.verifyWithFakeCookies }));
