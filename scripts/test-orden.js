#!/usr/bin/env node
// Pruebas del cambio interfaz-ordenada.  Uso: node scripts/test-orden.js automix|topbar|deck|banks|layout|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

// Ejecuta otra prueba del repositorio como proceso (las pruebas de arranque de la app ya existen).
const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 280000, env: process.env });
  assert.strictEqual(r.status, 0, `${args.join(' ')}: ${(r.stdout + r.stderr).slice(-600)}`);
};

tests.automix = async () => {
  const html = read('renderer/index.html'); const app = read('renderer/app.js');
  for (const id of ['imm-toggle', 'imm-mix', 'imm-style', 'imm-len', 'imm-skip', 'imm-queue']) assert.ok(!html.includes(`id="${id}"`), `${id} debe retirarse`);
  assert.ok(html.includes('id="imm-open"') && /imm-open/.test(app), 'botón «Abrir panel de AutoMix»');
  for (const id of ['amv-toggle', 'amv-mix', 'amv-style', 'amv-len', 'amv-skip']) assert.ok(html.includes(`id="${id}"`), `${id} en el panel`);
  assert.ok(!/Saltar siguiente/.test(html), 'nombre unificado «Siguiente»');
  assert.ok(/AutoMix · activo/.test(app) && /AutoMix · mezclando/.test(app), 'el botón de la barra muestra el estado');
  run(['scripts/test-sinvideo.js', 'immersive']);
  run(['scripts/test-salida.js', 'ui']);
  console.log('orden automix: OK');
};

tests.topbar = async () => {
  const html = read('renderer/index.html'); const css = read('renderer/styles.css'); const app = read('renderer/app.js');
  const top = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>'));
  const at = (s) => { const i = top.indexOf(s); assert.ok(i >= 0, s); return i; };
  // izquierda: vistas · centro: herramientas de mezcla · derecha: sistema
  assert.ok(at('tb-id') < at('tb-views') && at('tb-views') < at('tb-mix') && at('tb-mix') < at('tb-sys'), 'orden de las zonas');
  const sys = top.slice(at('tb-sys'));
  for (const id of ['tools-status', 'id="session"', 'btn-midi-learn', 'btn-help', 'btn-settings']) assert.ok(sys.includes(id), `${id} en la zona de sistema`);
  const mix = top.slice(at('tb-mix'), at('tb-sys'));
  for (const id of ['btn-automix', 'btn-sampler', 'btn-rec']) assert.ok(mix.includes(id), `${id} en herramientas`);
  assert.ok(!top.slice(0, at('tb-views')).includes('session'), 'la sesión ya no está junto a la marca');
  assert.ok(/\.session\.quiet/.test(css) && /\.status:empty/.test(css), 'sesión reducida a punto y estado vacío oculto');
  assert.ok(/classList\.toggle\('quiet'/.test(app) && /setAttribute\('aria-label'/.test(app), 'sesión silenciosa accesible');
  run(['scripts/test-rediseno.js', 'e2e']);
  run(['scripts/test-login-flow.js']);
  console.log('orden topbar: OK');
};

// Arranca la app con la autoprueba de este cambio y devuelve su informe.
const runApp = () => {
  if (runApp.res) return runApp.res;
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-orden-')); const music = path.join(tmp, 'music');
  const gen = spawnSync(process.execPath, [path.join(__dirname, 'make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), `sin audio de demostración: ${gen.stderr || gen.stdout}`);
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'orden-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
  const f = path.join(tmp, 'orden.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, x] of Object.entries(r)) assert.ok(!(x && x.__err), `${k}: ${JSON.stringify(x)}`);
  r.tmp = tmp;
  return (runApp.res = r);
};

tests.deck = async () => {
  const html = read('renderer/index.html'); const css = read('renderer/styles.css');
  assert.ok(/class="icon-btn deck-more"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"/.test(html), 'botón ⋯ accesible');
  assert.ok(html.indexOf('deck-menu') < html.indexOf('class="btn sm analyze"') && html.indexOf('class="btn sm analyze"') < html.indexOf('class="readout"'), 'Analizar vive en el menú');
  assert.ok(/\.deck-menu\b/.test(css) && /\.deck-more\.attn/.test(css));
  const r = runApp();
  assert.strictEqual(r.empty.more, false, 'sin pista no hay menú');
  assert.deepStrictEqual([r.loaded.more, r.loaded.menu, r.loaded.attn], [true, false, true], 'con pista: botón visible, menú cerrado, aviso de «sin analizar»');
  assert.deepStrictEqual([r.open.menu, r.open.expanded, r.open.analyze, r.open.points, r.open.ytm], [true, 'true', true, false, false], `menú abierto: ${JSON.stringify(r.open)}`);
  assert.strictEqual(r.esc.menu, false, 'Esc cierra'); assert.ok(/deck-more/.test(r.esc.active), 'Esc devuelve el foco al botón');
  assert.strictEqual(r.outside.menu, false, 'clic fuera cierra');
  assert.deepStrictEqual([r.analyzed.analyze, r.analyzed.points, r.analyzed.attn], [false, true, false], `analizada: ${JSON.stringify(r.analyzed)}`);
  console.log('orden deck: OK');
};

tests.banks = async () => {
  const html = read('renderer/index.html'); const deck = read('renderer/deck.js');
  assert.ok(/role="tablist"/.test(html) && /alyssdj\.deck\.bank\./.test(deck));
  const r = runApp();
  assert.deepStrictEqual([r.bankInit.open, r.bankInit.on], [['loop'], ['loop']], 'primera vez: LOOP abierto');
  assert.deepStrictEqual(r.bankJump.open, ['jump'], 'otra pestaña cambia el banco');
  assert.deepStrictEqual([r.bankClosed.open, r.bankClosed.on, r.bankClosed.stored], [[], [], ''], 'pulsar la abierta la cierra y lo recuerda');
  assert.deepStrictEqual([r.bankB.open, r.bankB.stored], [['fx'], 'fx'], 'el deck B tiene su propio banco');
  assert.deepStrictEqual([r.bankAstill.open], [[]], 'el deck A no cambia');
  assert.deepStrictEqual([r.bankRestored.a.open, r.bankRestored.b.open], [[], ['fx']], 'se restauran al reabrir');
  console.log('orden banks: OK');
};

tests.docs = async () => {
  const html = read('renderer/index.html'); const inv = read('docs/inventario-controles.md');
  for (const k of ['Barra superior', 'Deck (A y B)', 'AutoMix', 'Nombres unificados']) assert.ok(inv.includes(k), `inventario: ${k}`);
  // cada id citado en el inventario como vivo existe en el HTML (los retirados no)
  for (const id of ['amv-toggle', 'amv-mix', 'amv-style', 'amv-len', 'amv-skip', 'imm-open', 'imm-viz-toggle', 'btn-automix', 'btn-sampler', 'btn-rec', 'btn-midi-learn', 'btn-help', 'btn-settings']) assert.ok(html.includes(`id="${id}"`), `${id} existe`);
  const help = html.slice(html.indexOf('<dialog id="help">'), html.indexOf('</dialog>', html.indexOf('<dialog id="help">')));
  for (const k of ['Alt + 1', 'Mayús + →', '⋯ del deck', 'Crossfader']) assert.ok(help.includes(k), `ayuda: ${k}`);
  for (const f of ['renderer/index.html', 'docs/04-automix.md', 'docs/02-decks-y-mezclador.md']) assert.ok(!/Saltar siguiente|Mezclar ya/.test(read(f)), `nombre unificado en ${f}`);
  console.log('orden docs: OK');
};

tests.layout = async () => {
  const r = runApp();
  for (const [v, x] of Object.entries(r.views)) {
    assert.ok(x.sw <= x.w + 1, `${v}: sin desplazamiento horizontal (${x.sw} > ${x.w})`);
    assert.ok(x.left >= 0 && x.right <= x.w, `${v}: barra dentro de la ventana (${x.left}–${x.right} de ${x.w})`);
    assert.ok(x.wrap <= 56, `${v}: la barra cabe en una línea (${x.wrap}px)`);
    assert.ok(x.tab >= 0, 'el botón ⋯ se alcanza con Tab');
  }
  // las vistas existentes siguen cabiendo
  run(['scripts/test-sinvideo.js', 'views']);
  run(['scripts/test-vistas.js', 'ui']);
  console.log('orden layout: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error(`uso: test-orden.js ${Object.keys(tests).join('|')}`); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
