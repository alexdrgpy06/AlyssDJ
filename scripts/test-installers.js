#!/usr/bin/env node
// Pruebas de los instaladores.  Uso: node scripts/test-installers.js config|workflow|packaged
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tests = {};

tests.config = async () => {
  const b = pkg.build;
  assert.ok(b, 'package.json tiene la configuración de electron-builder');
  assert.strictEqual(b.productName, 'AlyssDJ');
  // REQ-1: Windows NSIS x64; REQ-2: macOS dmg x64 + arm64
  assert.deepStrictEqual(b.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.deepStrictEqual(b.mac.target[0].arch.sort(), ['arm64', 'x64']);
  assert.strictEqual(b.mac.target[0].target, 'dmg');
  // el paquete lleva solo lo necesario y no el código de pruebas, docs ni binarios descargados
  for (const d of ['main/**', 'preload/**', 'renderer/**', 'shared/**']) assert.ok(b.files.includes(d), d);
  assert.ok(!b.files.some((x) => /bin|docs|scripts|\.specs/.test(x)));
  // icono grande (electron-builder genera .ico y .icns a partir de él)
  const png = fs.readFileSync(path.join(root, b.win.icon));
  assert.strictEqual(png.readUInt32BE(16), 1024, 'icono de 1024 px');
  assert.strictEqual(png.readUInt32BE(20), 1024);
  assert.ok(pkg.devDependencies['electron-builder']);
  // REQ-3: instalada, las herramientas van a la carpeta de datos del usuario (la de la app puede ser de solo lectura)
  const main = fs.readFileSync(path.join(root, 'main/main.js'), 'utf8');
  assert.match(main, /toolDirs = app\.isPackaged \? \[path\.join\(app\.getPath\('userData'\), 'bin'\)\]/);
  console.log('installers config: OK');
};

tests.workflow = async () => {
  const rel = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(rel, /tags:\s*\n\s*- 'v\*'/, 'REQ-1/2: se dispara con etiquetas v*');
  for (const k of ['windows-latest', 'macos-latest', 'electron-builder', '--publish never', 'gh release', 'contents: write', '.exe', '.dmg']) assert.ok(rel.includes(k), `release.yml sin ${k}`);
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.ok(/test-installers\.js packaged/.test(ci), 'REQ-4: el CI construye y arranca el paquete');
  console.log('installers workflow: OK');
};

// Construye sin publicar (--dir) para esta plataforma y arranca el paquete: debe bajarse yt-dlp y ffmpeg y analizar una pista.
tests.packaged = async () => {
  const music = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(music, 'Neon Drive.mp3'))) {
    const g = spawnSync(process.execPath, [path.join(root, 'scripts/make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
    assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), `no se pudo generar el audio de demostración: ${g.stderr}`);
  }
  const bin = path.join(root, 'node_modules/.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
  const target = { linux: '--linux', win32: '--win', darwin: '--mac' }[process.platform];
  const b = spawnSync(bin, ['--dir', target, '--publish', 'never'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', timeout: 900000, env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  assert.strictEqual(b.status, 0, `electron-builder falló:\n${(b.stdout + b.stderr).slice(-1500)}`);
  const exe = { linux: 'dist/linux-unpacked/alyssdj', win32: 'dist/win-unpacked/AlyssDJ.exe', darwin: ['dist/mac/AlyssDJ.app/Contents/MacOS/AlyssDJ', 'dist/mac-arm64/AlyssDJ.app/Contents/MacOS/AlyssDJ'] }[process.platform];
  const exePath = [].concat(exe).map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
  assert.ok(exePath, `no está el ejecutable empaquetado (${exe})`);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-packaged-'));
  // Entorno limpio: sin yt-dlp ni ffmpeg en el PATH ni en el HOME, para comprobar que la app se los baja sola.
  const home = path.join(out, 'home');
  fs.mkdirSync(path.join(out, 'emptybin'), { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  const clean = { PATH: process.platform === 'win32' ? `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}` : path.join(out, 'emptybin'), HOME: home, USERPROFILE: home };
  const env = { ...process.env, ...clean, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'packaged-selftest.js'), YTDJ_USERDATA: path.join(out, 'data'), YTDJ_DOCS_MUSIC: music, YTDJ_SELFTEST_OUT: out };
  const args = process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [];
  const r = spawnSync(exePath, args, { cwd: out, timeout: 400000, encoding: 'utf8', env });
  const f = path.join(out, 'packaged.json');
  assert.ok(fs.existsSync(f), `la app empaquetada no produjo resultado:\n${(r.stderr || '').slice(-600)}`);
  const res = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.strictEqual(res.packaged, true, 'corre empaquetada');
  assert.ok(res.tools?.ytdlp && res.tools?.ffmpeg, `REQ-3: se bajaron yt-dlp y ffmpeg a la carpeta de datos: ${JSON.stringify(res.tools)}`);
  assert.ok(String(res.tools.ytdlp.bin).startsWith(res.userData) && String(res.tools.ffmpeg.bin).startsWith(res.userData), 'en la carpeta de datos del usuario, no en la de la app');
  assert.ok(res.analysis?.bpm > 100 && res.analysis?.wave, `analiza con el hilo empaquetado: ${JSON.stringify(res.analysis)}`);
  assert.ok(res.ui?.decks);
  console.log('installers packaged: OK', JSON.stringify({ bpm: res.analysis.bpm, ytdlp: res.tools.ytdlp.version }));
};

if (!tests[process.argv[2]]) (console.error('uso: test-installers.js', Object.keys(tests).join('|')), process.exit(2));
tests[process.argv[2]]().catch((e) => (console.error(e), process.exit(1)));
