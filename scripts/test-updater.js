#!/usr/bin/env node
// Pruebas de las actualizaciones.  Uso: node scripts/test-updater.js unit|ui
'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createUpdater } = require('../main/updater');
const mode = process.argv[2];
const tests = {};

function setup({ platform = 'linux', packaged = true, playing = false, cfg = {} } = {}) {
  const au = Object.assign(new EventEmitter(), { calls: [], async checkForUpdates() { this.calls.push('check'); }, async downloadUpdate() { this.calls.push('download'); }, quitAndInstall(...a) { this.calls.push(['install', ...a]); } });
  const store = { autoUpdate: true, skipUpdate: '', ...cfg };
  const states = [];
  const u = createUpdater({ autoUpdater: au, settings: { get: () => store, set: (p) => Object.assign(store, p) }, send: (_c, st) => states.push(st), isPlaying: () => playing, platform, isPackaged: packaged, setTimer: () => ({ unref() {} }), clearTimer() {} });
  return { au, u, store, states };
}
const info = (v = '9.9.9') => ({ version: v, releaseNotes: '<p>Mejoras</p>' });

tests.unit = async () => {
  // REQ-4: no en desarrollo
  { const { au, u } = setup({ packaged: false }); await u.check(); assert.deepStrictEqual(au.calls, [], 'sin comprobar si no está empaquetada'); }
  // REQ-4/7: automático respeta el ajuste; manual siempre comprueba
  { const { au, u } = setup({ cfg: { autoUpdate: false } }); await u.check(); assert.deepStrictEqual(au.calls, []); await u.check({ manual: true }); assert.deepStrictEqual(au.calls, ['check']); }
  // REQ-5: aviso con versión y notas; nada se descarga sin permiso
  { const { au, u } = setup(); await u.check(); au.emit('update-available', info());
    assert.strictEqual(u.state().stage, 'available'); assert.strictEqual(u.state().version, '9.9.9'); assert.strictEqual(u.state().notes, 'Mejoras');
    assert.ok(!au.calls.includes('download'), 'no descarga sola');
    assert.strictEqual(au.autoDownload, false);
    assert.strictEqual((await u.download()).ok, true); assert.ok(au.calls.includes('download'));
    au.emit('download-progress', { percent: 42.4 }); assert.strictEqual(u.state().progress, 42);
    au.emit('update-downloaded', {}); assert.strictEqual(u.state().stage, 'downloaded'); }
  // REQ-6: con un deck sonando no se reinicia; parado, sí
  { const p = setup({ playing: true }); await p.u.check(); p.au.emit('update-available', info()); await p.u.download(); p.au.emit('update-downloaded', {});
    assert.deepStrictEqual(p.u.install(), { ok: false, reason: 'playing' }); assert.ok(!p.au.calls.some((c) => c[0] === 'install'));
    const q = setup({ playing: false }); await q.u.check(); q.au.emit('update-available', info()); await q.u.download(); q.au.emit('update-downloaded', {});
    assert.deepStrictEqual(q.u.install(), { ok: true }); assert.ok(q.au.calls.some((c) => c[0] === 'install')); assert.strictEqual(q.au.autoInstallOnAppQuit, true); }
  // «Omitir esta versión»: no vuelve a avisar de esa versión, sí de una posterior; una comprobación manual sí la muestra
  { const { au, u, store } = setup(); await u.check(); au.emit('update-available', info('2.0.0')); u.skip(); assert.strictEqual(store.skipUpdate, '2.0.0');
    await u.check(); au.emit('update-available', info('2.0.0')); assert.strictEqual(u.state().stage, 'idle', 'omitida: sin aviso');
    await u.check(); au.emit('update-available', info('2.0.1')); assert.strictEqual(u.state().stage, 'available', 'versión posterior');
    await u.check({ manual: true }); au.emit('update-available', info('2.0.0')); assert.strictEqual(u.state().stage, 'available', 'manual la muestra'); }
  // «Más tarde»
  { const { au, u } = setup(); await u.check(); au.emit('update-available', info()); u.later(); assert.strictEqual(u.state().stage, 'idle'); }
  // REQ-8: macOS sin firma solo avisa con enlace al release; no descarga ni instala
  { const { au, u } = setup({ platform: 'darwin' }); await u.check(); au.emit('update-available', info('3.1.0'));
    assert.strictEqual(u.state().mode, 'notify'); assert.strictEqual(u.state().url, 'https://github.com/alexdrgpy06/AlyssDJ/releases/tag/v3.1.0');
    assert.strictEqual((await u.download()).ok, false); assert.ok(!au.calls.includes('download')); assert.strictEqual(au.autoInstallOnAppQuit, false); }
  // errores: en silencio si fue automático, visibles si lo pidió el usuario
  { const { au, u } = setup(); await u.check(); au.emit('error', new Error('sin red')); assert.strictEqual(u.state().stage, 'idle');
    await u.check({ manual: true }); au.emit('error', new Error('sin red')); assert.strictEqual(u.state().stage, 'error'); assert.match(u.state().error, /sin red/); }
  { const { au, u } = setup(); au.checkForUpdates = async () => { throw new Error('boom'); }; await u.check({ manual: true }); assert.strictEqual(u.state().stage, 'error'); }
  // REQ-7: solo se consulta el repositorio público, sin datos personales (el proveedor es GitHub y no se envía nada propio)
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.deepStrictEqual({ p: pkg.build.publish.provider, o: pkg.build.publish.owner, r: pkg.build.publish.repo }, { p: 'github', o: 'alexdrgpy06', r: 'AlyssDJ' });
  assert.ok(pkg.dependencies['electron-updater'], 'electron-updater como dependencia de producción');
  assert.ok(!/token|Authorization/i.test(fs.readFileSync(path.join(__dirname, '../main/updater.js'), 'utf8')), 'sin credenciales');
  console.log('updater unit: OK');
};

tests.ui = async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-upd-'));
  spawnSync(require('electron'), ['.'], { cwd: path.join(__dirname, '..'), timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'updater-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'updater.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.UPDATER_SHOT) fs.copyFileSync(path.join(tmp, 'updater.png'), process.env.UPDATER_SHOT);
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.ok(!r.__err, JSON.stringify(r));
  assert.strictEqual(r.available.hidden, false); assert.match(r.available.text, /versión nueva.*9\.9\.9/); assert.strictEqual(r.available.go, 'Descargar e instalar'); assert.ok(r.available.skipVisible);
  assert.strictEqual(r.downloading.bar, true); assert.strictEqual(r.downloading.fill, '37%');
  assert.strictEqual(r.downloaded.go, 'Reiniciar e instalar');
  assert.strictEqual(r.notify.go, 'Ver descarga');
  assert.strictEqual(r.idle.hidden, true);
  assert.strictEqual(r.setting.checked, true); assert.strictEqual(r.setting.btn, true);
  console.log('updater ui: OK');
};

if (!tests[mode]) (console.error('uso: test-updater.js unit|ui'), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
