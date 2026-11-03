// Pruebas del cambio automix-claro (UI y documentación; las puras están en test-automix-claro.mjs).
//   node scripts/test-automix-claro.js ui|robust|docs
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const modes = (process.argv[2] || 'ui').split(',');
const tests = {};

function runApp(selftest, outFile) {
  const music = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(music, 'Neon Drive.mp3'))) spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), music], { stdio: 'ignore' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-claro-'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 280000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', selftest), YTDJ_USERDATA: path.join(dir, 'data'), YTDJ_SELFTEST_OUT: dir, YTDJ_DOCS_MUSIC: music }, stdio: 'ignore' });
  const f = path.join(dir, outFile); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err)); r.__dir = dir; return r;
}

tests.ui = () => {
  const r = runApp('automix-claro-selftest.js', 'claro.json');
  assert.deepStrictEqual(r.stopped, { text: 'Detenido', phase: 'stopped' }, 'REQ-1: detenido');
  assert.ok(['playing', 'preparing', 'waiting'].includes(r.on.phase) && r.on.status.length > 8, `REQ-1: fase y texto: ${JSON.stringify(r.on)}`);
  assert.ok(!r.on.tlHidden && r.on.tl.hasStrips && r.on.tl.gestures > 0, `REQ-2: línea de tiempo con las dos pistas y gestos: ${JSON.stringify(r.on)}`);
  assert.match(r.on.info, /^Sale \d+:\d\d · entra \d+:\d\d · \d+ s$/, 'REQ-2: info legible');
  assert.ok(r.on.tl.canPreview && !r.on.preview.disabled, `REQ-4: se puede escuchar: ${JSON.stringify(r.on.preview)}`);
  assert.ok(r.on.btn.phase === r.on.phase && r.on.btn.title.includes(r.on.status.slice(0, 8)) && /^\d+:\d\d$/.test(r.on.btn.count), `REQ-7: el botón de la barra lleva la fase y la cuenta atrás: ${JSON.stringify(r.on.btn)}`);
  assert.strictEqual(r.queue.length, 2, 'dos en la cola'); assert.match(r.queue[0].cls, /good|ok|poor/, 'REQ-5: nivel en la analizada');
  assert.match(r.queue[0].title, /BPM|tonalidad|energía/, 'REQ-5: motivo en palabras');
  assert.ok(/unknown/.test(r.queue[1].cls) && r.queue[1].marks.includes('sin análisis'), `REQ-5: sin análisis marcada: ${JSON.stringify(r.queue[1])}`);
  assert.deepStrictEqual(r.club.cfg, { len: 12, style: 'auto', smartOrder: true, fxLevel: 'subtle' }, 'REQ-6: Club'); assert.deepStrictEqual(r.club.on, ['club']); assert.strictEqual(r.club.saved, 'club');
  assert.deepStrictEqual(r.soft.cfg, { len: 24, style: 'crossfade', smartOrder: true, fxLevel: 'off' }, 'REQ-6: Suave'); assert.deepStrictEqual(r.soft.on, ['soft']);
  assert.deepStrictEqual(r.custom, ['custom'], 'REQ-6: tocar un ajuste pasa a Personalizado');
  assert.match(r.lenDrag, /· 1[1-3] s$/, `REQ-3: la duración se ve mientras se arrastra: ${r.lenDrag}`);
  assert.ok(r.len.len >= 11 && r.len.len <= 13, `REQ-3: duración aplicada: ${r.len.len}`);
  assert.ok(r.exit.saved?.outs?.length === 1 && Math.abs(r.exit.saved.outs[0].t - (r.exit.before + 2 * r.exit.bar)) < 0.05 + r.exit.bar, `REQ-3: salida guardada: ${JSON.stringify(r.exit)}`);
  assert.ok(r.exit.view.tl.exitAt > r.exit.before, 'REQ-3: el plan usa la salida movida');
  assert.strictEqual(r.key.len, r.len.len + 1, 'REQ-3: Mayús + → suma un segundo');
  console.log('claro ui: OK');
};

tests.robust = () => {
  const r = runApp('automix-claro-robust-selftest.js', 'robust.json');
  assert.strictEqual(r.before.n, 2, `la cola empieza con dos: ${JSON.stringify(r.before)}`);
  assert.notStrictEqual(r.loadFail.head, r.before.head, `REQ-8: la que no abrió se descarta: ${JSON.stringify(r.loadFail)}`);
  assert.match(r.loadFail.note, /Falló “.+” \(archivo dañado\): sigo con la siguiente/, 'REQ-8: motivo explicado en el estado');
  assert.ok(r.loadFail.notes.includes('sigo con la siguiente'), 'REQ-8: la nota se ve en la vista');
  assert.strictEqual(r.loadFail.n, 1, 'queda la última');
  assert.match(r.last.note, /no hay otra pista en la cola/, `REQ-8: la última no se descarta: ${JSON.stringify(r.last)}`);
  assert.strictEqual(r.last.n, 1); assert.strictEqual(r.stillOn, true, 'AutoMix sigue encendido');
  console.log('claro robust: OK');
};

tests.docs = () => {
  const d = read('docs/04-automix.md');
  for (const re of [/Línea de estado/, /Preparando la siguiente/, /Esperando el punto de salida/, /Línea de tiempo de la mezcla/, /Escuchar/, /Suave/, /Club/, /Radio/, /Personalizado/, /sin análisis/, /sin archivo/, /sigue con la siguiente/]) assert.match(d, re, `la guía menciona ${re}`);
  const html = read('renderer/index.html');
  for (const id of ['amtl', 'amtl-cv', 'amtl-info', 'amtl-preview', 'amv-profile', 'amv-status']) assert.ok(html.includes(`id="${id}"`), `control ${id}`);
  const inv = read('docs/inventario-controles.md'); for (const id of ['#amtl', '#amtl-cv', '#amtl-preview', '#amv-profile']) assert.ok(inv.includes(id), `inventario: ${id}`);
  for (const f of ['automix-status', 'automix-compat', 'automix-profiles', 'automix-timeline']) assert.ok(fs.existsSync(path.join(root, `renderer/${f}.js`)), f);
  console.log('claro docs: OK');
};

for (const m of modes) { if (!tests[m]) { console.error(`uso: test-automix-claro.js ${Object.keys(tests).join('|')}`); process.exit(2); } tests[m](); }
