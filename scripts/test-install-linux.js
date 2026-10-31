#!/usr/bin/env node
// Pruebas de la instalación en Linux y del AppImage.  Uso: node scripts/test-install-linux.js config|script|appimage
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const root = path.join(__dirname, '..');
const mode = process.argv[2];
const tests = {};
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

tests.config = async () => {
  // REQ-3: AppImage x64 en el build y en el release, con los archivos de actualización
  assert.deepStrictEqual(pkg.build.linux.target, [{ target: 'AppImage', arch: ['x64'] }]);
  assert.strictEqual(pkg.build.linux.artifactName, 'AlyssDJ-${version}.${ext}');
  assert.ok(pkg.scripts['dist:linux']);
  const rel = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  for (const k of ['ubuntu-latest', 'dist/*.AppImage', 'dist/latest*.yml']) assert.ok(rel.includes(k), `release.yml sin ${k}`);
  assert.strictEqual(pkg.build.publish.provider, 'github');
  console.log('install-linux config: OK');
};

const sh = (args, env, opts = {}) => spawnSync('bash', args, { encoding: 'utf8', env: { ...process.env, ...env }, cwd: root, timeout: 120000, ...opts });

tests.script = async () => {
  if (process.platform !== 'linux') return console.log('install-linux script: omitida (no es Linux)');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-home-'));
  const env = { HOME: home, XDG_DATA_HOME: '', XDG_CONFIG_HOME: '', ALYSSDJ_OPT: '', PATH: process.env.PATH };
  delete env.XDG_DATA_HOME; delete env.XDG_CONFIG_HOME; delete env.ALYSSDJ_OPT;
  const fake = path.join(home, 'AlyssDJ-9.9.9.AppImage');
  fs.writeFileSync(fake, '#!/bin/sh\necho "AlyssDJ de mentira $@"\n', { mode: 0o755 });
  const OPT = path.join(home, '.local/opt/AlyssDJ');
  // REQ-1: instala para el usuario, sin sudo
  let r = sh(['scripts/install-linux.sh', '--from-file', fake], env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const app = path.join(OPT, 'AlyssDJ.AppImage');
  assert.ok(fs.existsSync(app) && (fs.statSync(app).mode & 0o111), 'AppImage ejecutable en ~/.local/opt/AlyssDJ');
  const wrapper = path.join(home, '.local/bin/alyssdj');
  assert.ok(fs.statSync(wrapper).mode & 0o111, 'comando alyssdj');
  assert.match(fs.readFileSync(wrapper, 'utf8'), new RegExp(OPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/AlyssDJ.AppImage'));
  const desk = path.join(home, '.local/share/applications/alyssdj.desktop');
  const d = Object.fromEntries(fs.readFileSync(desk, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  assert.strictEqual(d.Name, 'AlyssDJ'); assert.strictEqual(d.Type, 'Application'); assert.strictEqual(d.Terminal, 'false');
  assert.strictEqual(d.Exec, `${wrapper} %U`); assert.strictEqual(d.Icon, 'alyssdj'); assert.match(d.Categories, /AudioVideo/);
  assert.match(d.Comment, /AlystechPY/);
  assert.ok(fs.existsSync(path.join(home, '.local/share/icons/hicolor/512x512/apps/alyssdj.png')), 'icono');
  // el comando funciona
  const run = spawnSync(wrapper, ['hola'], { encoding: 'utf8', env: { ...env, PATH: process.env.PATH } });
  assert.match(run.stdout, /de mentira hola/);
  // REQ-2: reinstalar reemplaza sin duplicar
  r = sh(['scripts/install-linux.sh', '--from-file', fake], env);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(fs.readdirSync(path.join(home, '.local/share/applications')).filter((n) => n.includes('alyssdj')).length, 1);
  assert.deepStrictEqual(fs.readdirSync(OPT), ['AlyssDJ.AppImage'], 'sin restos');
  // --from-dir elige el .AppImage más nuevo
  const dir = path.join(home, 'dl'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'old.AppImage'), '#!/bin/sh\necho viejo\n', { mode: 0o755 });
  fs.utimesSync(path.join(dir, 'old.AppImage'), new Date(2020, 1, 1), new Date(2020, 1, 1));
  fs.writeFileSync(path.join(dir, 'new.AppImage'), '#!/bin/sh\necho nuevo\n', { mode: 0o755 });
  assert.strictEqual(sh(['scripts/install-linux.sh', '--from-dir', dir], env).status, 0);
  assert.match(spawnSync(wrapper, [], { encoding: 'utf8', env }).stdout, /nuevo/);
  // descarga desde un «GitHub» de mentira
  const srv = http.createServer((q, s) => {
    if (q.url === '/repos/alexdrgpy06/AlyssDJ/releases/latest') return s.end(JSON.stringify({ tag_name: 'v9.9.9', assets: [{ name: 'AlyssDJ-9.9.9.AppImage', browser_download_url: `http://127.0.0.1:${srv.address().port}/dl/AlyssDJ-9.9.9.AppImage` }] }));
    if (q.url === '/dl/AlyssDJ-9.9.9.AppImage') return s.end('#!/bin/sh\necho "descargado $@"\n');
    s.statusCode = 404; s.end('no');
  });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const api = `http://127.0.0.1:${srv.address().port}`;
  // el script usa curl bloqueante: se ejecuta de forma asíncrona para no frenar al servidor
  const asyncSh = (args, e) => new Promise((res) => { const c = spawn('bash', args, { cwd: root, env: { ...process.env, ...e } }); let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ status: code, out })); });
  r = await asyncSh(['scripts/install-linux.sh'], { ...env, ALYSSDJ_API: api });
  assert.strictEqual(r.status, 0, r.out);
  assert.match(spawnSync(wrapper, ['x'], { encoding: 'utf8', env }).stdout, /descargado x/, 'instaló lo descargado del release');
  // sin release y sin conexión, fuera de un clon: mensaje claro y código ≠ 0 (se copia el script a una carpeta aislada)
  const alone = path.join(home, 'solo'); fs.mkdirSync(alone); fs.copyFileSync(path.join(root, 'scripts/install-linux.sh'), path.join(alone, 'install-linux.sh'));
  r = await asyncSh([path.join(alone, 'install-linux.sh')], { ...env, ALYSSDJ_API: 'http://127.0.0.1:1', HOME: path.join(home, 'otro') });
  assert.notStrictEqual(r.status, 0); assert.match(r.out, /--from-file/, 'explica qué falta');
  // desde un clon y sin release: construye (comando sustituido por uno de mentira que deja un AppImage en dist/)
  const clone = path.join(home, 'clon'); fs.mkdirSync(path.join(clone, 'scripts'), { recursive: true }); fs.mkdirSync(path.join(clone, 'build'));
  fs.writeFileSync(path.join(clone, 'package.json'), '{ "name": "alyssdj" }'); fs.copyFileSync(path.join(root, 'scripts/install-linux.sh'), path.join(clone, 'scripts/install-linux.sh')); fs.copyFileSync(path.join(root, 'build/icon.png'), path.join(clone, 'build/icon.png'));
  r = await asyncSh([path.join(clone, 'scripts/install-linux.sh')], { ...env, ALYSSDJ_API: 'http://127.0.0.1:1', ALYSSDJ_BUILD_CMD: 'mkdir -p dist && printf "#!/bin/sh\\necho construido\\n" > dist/AlyssDJ-0.0.1.AppImage' });
  assert.strictEqual(r.status, 0, r.out);
  assert.match(spawnSync(wrapper, [], { encoding: 'utf8', env }).stdout, /construido/, 'REQ-1: sin release, construye desde el clon');
  srv.close();
  // REQ-2: desinstalar conserva ajustes y librería; --purge borra los ajustes y, sin terminal, no toca la librería
  fs.mkdirSync(path.join(home, '.config/AlyssDJ'), { recursive: true }); fs.writeFileSync(path.join(home, '.config/AlyssDJ/settings.json'), '{}');
  fs.mkdirSync(path.join(home, 'Música/AlyssDJ'), { recursive: true }); fs.writeFileSync(path.join(home, 'Música/AlyssDJ/a.mp3'), 'x');
  r = sh(['scripts/uninstall-linux.sh'], env);
  assert.strictEqual(r.status, 0, r.stderr);
  for (const p of [OPT, wrapper, desk, path.join(home, '.local/share/icons/hicolor/512x512/apps/alyssdj.png')]) assert.ok(!fs.existsSync(p), `quedó ${p}`);
  assert.ok(fs.existsSync(path.join(home, '.config/AlyssDJ/settings.json')), 'conserva los ajustes');
  assert.ok(fs.existsSync(path.join(home, 'Música/AlyssDJ/a.mp3')), 'conserva la librería');
  r = sh(['scripts/uninstall-linux.sh', '--purge'], env, { input: '' });
  assert.ok(!fs.existsSync(path.join(home, '.config/AlyssDJ')), '--purge borra los ajustes');
  assert.ok(fs.existsSync(path.join(home, 'Música/AlyssDJ/a.mp3')), 'sin terminal no se borra la librería');
  // volver a instalar tras desinstalar funciona
  assert.strictEqual(sh(['scripts/install-linux.sh', '--from-file', fake], env).status, 0);
  console.log('install-linux script: OK');
};

if (!tests[mode]) (console.error('uso: test-install-linux.js', Object.keys(tests).join('|')), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
