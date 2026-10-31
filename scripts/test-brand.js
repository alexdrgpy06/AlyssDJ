#!/usr/bin/env node
// Pruebas de la marca AlystechPY.  Uso: node scripts/test-brand.js files|e2e
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const mode = process.argv[2];
const tests = {};

tests.files = async () => {
  const pkg = JSON.parse(read('package.json'));
  // REQ-2: organización y autor, propagados al paquete y a los instaladores
  assert.strictEqual(pkg.author.name, 'Alejandro Ramírez');
  assert.match(pkg.description, /AlystechPY/);
  assert.strictEqual(pkg.build.appId, 'py.alystech.alyssdj');
  assert.match(pkg.build.copyright, /AlystechPY — Alejandro Ramírez/);
  assert.strictEqual(pkg.build.win.publisherName, 'AlystechPY');
  assert.strictEqual(pkg.build.linux.vendor, 'AlystechPY');
  assert.match(pkg.build.linux.maintainer, /Alejandro Ramírez/);
  assert.strictEqual(pkg.license, 'MIT');
  // REQ-3: licencia y documentación
  assert.match(read('LICENSE'), /Copyright \(c\) 2026 AlystechPY — Alejandro Ramírez/);
  assert.match(read('README.md'), /Un software de \*\*AlystechPY\*\*, por Alejandro Ramírez/);
  assert.match(read('README.md'), /MIT © 2026 \*\*AlystechPY\*\* — Alejandro Ramírez/);
  assert.match(read('docs/00-instalacion.md'), /AlystechPY, por Alejandro Ramírez/);
  assert.match(read('docs/README.md'), /AlystechPY, por Alejandro Ramírez/);
  // el commit y la licencia no dejan la autoría sin tilde en los textos de marca
  for (const f of ['LICENSE', 'README.md']) assert.ok(!/Alejandro Ramirez/.test(read(f)), `${f} con «Ramirez» sin tilde`);
  console.log('brand files: OK');
};

tests.e2e = async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-brand-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'brand-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'brand.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.BRAND_SHOT) fs.copyFileSync(path.join(tmp, 'about.png'), process.env.BRAND_SHOT);
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.ok(!r.__err, JSON.stringify(r));
  const pkg = JSON.parse(read('package.json'));
  // REQ-1: el diálogo muestra nombre, versión, autoría, licencia y repositorio
  assert.strictEqual(r.about.open, true);
  assert.match(r.about.text, /AlyssDJ/);
  assert.ok(r.about.text.includes(pkg.version), `versión ${pkg.version}`);
  assert.match(r.about.text, /Un software de AlystechPY/);
  assert.match(r.about.text, /por Alejandro Ramírez/);
  assert.match(r.about.text, /Licencia MIT/);
  assert.match(r.about.link, /github\.com\/alexdrgpy06\/AlyssDJ/);
  // REQ-4: marca discreta en la barra superior; en compacto no quita espacio
  assert.match(r.brand.normal, /AlystechPY/);
  assert.strictEqual(r.brand.normalVisible, true);
  assert.ok(r.about.img > 0, 'el icono del diálogo carga');
  assert.strictEqual(r.brand.compactVisible, false, 'oculta en el perfil compacto');
  assert.ok(r.brand.topbarOverflow === false, 'sin desbordar la barra superior');
  console.log('brand e2e: OK');
};

if (!tests[mode]) (console.error('uso: test-brand.js files|e2e'), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
