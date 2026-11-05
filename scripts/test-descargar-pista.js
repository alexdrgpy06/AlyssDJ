#!/usr/bin/env node
// Pruebas del cambio deck-descargar-pista.  Uso: node scripts/test-descargar-pista.js logic|ui|header|labels|docs
// (logic, ui, header y labels abren la app: usar xvfb-run -a)
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const mode = process.argv[2];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function app() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-dp-'));
  try {
    const music = path.join(tmp, 'audio');
    assert.strictEqual(spawnSync('node', [path.join(root, 'scripts/make-demo-audio.js'), music], { cwd: root }).status, 0, 'audio de demostración');
    spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 150000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/descargar-pista-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
    const f = path.join(tmp, 'descargar-pista.json');
    assert.ok(fs.existsSync(f), 'la app no produjo resultado');
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.ok(!r.error, r.error);
    for (const k of Object.keys(r)) assert.ok(!r[k]?.__err, `${k}: ${JSON.stringify(r[k])}`);
    return r;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
let cache;
const ui = () => (cache ||= app());
const tests = {};

tests.logic = () => {
  const r = ui();
  // REQ-1: descargar deja el deck como recién abierto
  assert.deepStrictEqual([r.unload.r, r.unload.track, r.unload.dur, r.unload.playing], [true, null, 0, false]);
  assert.deepStrictEqual(r.unload.hot, [null, null, null, null]); assert.strictEqual(r.unload.loop, null); assert.strictEqual(r.unload.sync, false);
  assert.ok(!r.unload.wave && !r.unload.analysis, 'sin onda ni análisis'); assert.strictEqual(r.unload.title, 'Arrastra o carga una pista'); assert.strictEqual(r.unload.again, false, 'vacío: nada que descargar');
  // REQ-2: al aire → aviso; segunda pulsación en 3 s confirma; pasados 3 s vuelve a avisar
  assert.deepStrictEqual([r.live.first, r.live.kept, r.live.second, r.live.gone], [false, true, true, true]);
  assert.match(r.live.msg, /Deck A está al aire\. Páusalo o baja su canal para descargar la pista/);
  assert.deepStrictEqual([r.liveSlow.f, r.liveSlow.s, r.liveSlow.kept], [false, false, true], 'pasados 3 s no cuenta como confirmación');
  // REQ-3: AutoMix la usa (suena o es la siguiente preparada) → no se descarga
  assert.deepStrictEqual([r.holds.off, r.holds.cur, r.holds.head, r.holds.free], [false, true, true, false]);
  assert.deepStrictEqual(r.holds.blocked, [false, false]); assert.match(r.holds.msg, /AutoMix la está usando/); assert.ok(r.holds.still, 'siguen cargadas'); assert.strictEqual(r.holds.afterStop, true);
  console.log('logic ok');
};
tests.ui = () => {
  const r = ui();
  assert.ok(r.empty.eject && r.empty.ejectDisabled, 'botón de descargar, deshabilitado sin pista');
  assert.strictEqual(r.loaded.ejectDisabled, false, 'habilitado con pista'); assert.strictEqual(r.unload.ejectDisabled, true, 'de nuevo deshabilitado al descargar');
  assert.ok(r.empty.ctl, 'control deckA.eject registrado (atajo y MIDI)');
  console.log('ui ok');
};
tests.header = () => {
  const r = ui();
  assert.deepStrictEqual([r.empty.load, r.empty.helpVis, r.empty.help], [true, true, 'o arrastra una pista de la librería']);
  assert.strictEqual(r.loaded.loadVis, false, 'con pista no se ofrece cargar');
  assert.deepStrictEqual([r.loaded.ellipsis, r.loaded.nowrap, r.loaded.clipped], ['ellipsis', 'nowrap', true], 'título largo con elipsis');
  assert.ok(r.loaded.noOverflow && !r.loaded.overlap, `la cabecera no desborda ni se pisa: ${JSON.stringify(r.loaded)}`);
  console.log('header ok');
};
tests.labels = () => {
  const r = ui();
  assert.strictEqual(r.labelEmpty, 'Elegir radio…'); assert.strictEqual(r.loaded.label, 'Iniciar AutoMix');
  assert.deepStrictEqual([r.labels.lab0, r.labels.menuOpen, r.labels.started, r.labels.lab1, r.labels.imm], ['Elegir radio…', true, false, 'Iniciar AutoMix', 'Iniciar AutoMix'], 'sin pista abre el menú Radio y no inicia');
  assert.match(r.labels.hint0, /Mezclar ahora y Siguiente se activan/);
  assert.match(r.labels.reasons[0], /al iniciar/); assert.match(r.labels.reasons[1], /Mezclando/); assert.match(r.labels.reasons[2], /al menos dos pistas/); assert.strictEqual(r.labels.reasons[3], '');
  console.log('labels ok');
};
tests.docs = () => {
  const d = read('docs/04-automix.md') + read('docs/inventario-controles.md');
  for (const re of [/Descargar pista/, /deckA\.eject|deckX\.eject/, /Cargar pista/, /Elegir radio/, /al aire/]) assert.match(d, re, String(re));
  const ci = read('.github/workflows/ci.yml'); assert.ok(/test-descargar-pista\.js/.test(ci), 'CI lo ejecuta');
  console.log('docs ok');
};

for (const m of String(mode).split(',')) if (!tests[m]) { console.error(`modo desconocido: ${m}`); process.exit(2); }
for (const m of mode.split(',')) tests[m]();
