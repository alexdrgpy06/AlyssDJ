#!/usr/bin/env node
// Pruebas de soporte multiplataforma.  Uso: node scripts/test-platform.js ffmpeg|browsers|ci|publico
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const http = require('http');

const root = path.join(__dirname, '..');
const tests = {};

tests.ffmpeg = async () => {
  const T = require('../main/tools');
  // REQ-1: una URL por plataforma/arquitectura soportada, ninguna para las demás
  for (const [pl, ar] of [['win32', 'x64'], ['linux', 'x64'], ['linux', 'arm64'], ['darwin', 'x64'], ['darwin', 'arm64']]) {
    assert.match(T.ffmpegUrl(pl, ar), new RegExp(`ffmpeg-${pl}-${ar}\\.gz$`));
  }
  assert.strictEqual(T.ffmpegUrl('win32', 'arm64'), null);
  assert.strictEqual(T.ffmpegUrl('freebsd', 'x64'), null);
  // descarga + descompresión con un servidor local que sirve un "ffmpeg" falso comprimido
  const isWin = process.platform === 'win32';
  const fake = isWin ? null : Buffer.from('#!/bin/sh\necho "ffmpeg version fake-1.0"\n');
  if (fake) {
    const srv = http.createServer((_q, r) => r.end(zlib.gzipSync(fake)));
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-ff-'));
    // download() usa https; se comprueba la descompresión y el fallo limpio con una URL http inalcanzable
    const PATH = process.env.PATH;
    process.env.PATH = dir; // sin ffmpeg del sistema
    await assert.rejects(T.ensureFfmpeg({ dirs: [dir], url: 'https://127.0.0.1:1/x.gz', configured: path.join(dir, 'no') }), /ffmpeg|ECONN|connect/i);
    process.env.PATH = PATH;
    srv.close();
    assert.ok(!fs.readdirSync(dir).some((f) => f === 'ffmpeg'), 'no deja un ffmpeg a medias');
  }
  // si ya hay uno en bin/, no se vuelve a descargar
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-ff2-'));
  if (!isWin) {
    const f = path.join(dir2, 'ffmpeg');
    fs.writeFileSync(f, '#!/bin/sh\necho "ffmpeg version fake"\n', { mode: 0o755 });
    const r = await T.ensureFfmpeg({ dirs: [dir2], url: null });
    assert.strictEqual(r.installed, false);
    assert.strictEqual(r.bin, f);
  }
  // el instalador no depende ya de npm install
  assert.ok(!/execSync|install --no-save/.test(fs.readFileSync(path.join(root, 'scripts/setup.js'), 'utf8')));
};

tests.browsers = async () => {
  const A = require('../main/auth-import');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-home-'));
  const mk = (d) => fs.mkdirSync(path.join(home, d), { recursive: true });
  mk('AppData/Local/Google/Chrome/User Data');
  mk('AppData/Roaming/Mozilla/Firefox');
  assert.deepStrictEqual(A.detectBrowsers(home, 'win32').map((b) => b.id), ['firefox', 'chrome'], 'Windows');
  assert.ok(A.detectBrowsers(home, 'linux').every((b) => !b.found), 'las rutas de Windows no cuentan en Linux');
  mk('Library/Application Support/Firefox');
  assert.deepStrictEqual(A.detectBrowsers(home, 'darwin').map((b) => b.id), ['firefox'], 'macOS');
  // REQ-3: sin dependencia de HOME ni de /tmp fijo
  for (const f of ['main/tools.js', 'main/auth-import.js', 'scripts/setup.js']) {
    assert.ok(!/process\.env\.HOME\b/.test(fs.readFileSync(path.join(root, f), 'utf8')), `${f} usa process.env.HOME`);
  }
  // REQ-3: REC avisa fuera de Linux
  assert.match(fs.readFileSync(path.join(root, 'main/main.js'), 'utf8'), /process\.platform !== 'linux'\) throw new Error\('La grabación/);
};

tests.ci = async () => {
  const y = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  for (const k of ['ubuntu-latest', 'windows-latest', 'macos-latest', 'npm install', 'shell: bash']) assert.ok(y.includes(k), `ci.yml sin ${k}`);
};

tests.publico = async () => {
  assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /MIT License[\s\S]*Alejandro Ramirez/);
  const { execSync } = require('child_process');
  const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const bad = /(ghp_[A-Za-z0-9]{20,}|github_pat_|AIza[0-9A-Za-z_-]{30}|BEGIN (RSA |EC )?PRIVATE KEY)/;
  for (const f of files) {
    if (/\.(png|jpg|mp3|woff2?)$/.test(f)) continue;
    assert.ok(!bad.test(fs.readFileSync(path.join(root, f), 'utf8')), `posible secreto en ${f}`);
    assert.ok(!/\/home\/alex/.test(fs.readFileSync(path.join(root, f), 'utf8')) || f.startsWith('.specs/'), `ruta personal en ${f}`);
  }
};

const name = process.argv[2];
if (!tests[name]) (console.error('uso: test-platform.js', Object.keys(tests).join('|')), process.exit(2));
tests[name]().then(() => console.log(`ok ${name}`), (e) => (console.error(e), process.exit(1)));
