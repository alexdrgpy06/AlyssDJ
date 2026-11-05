#!/usr/bin/env node
// Pruebas del cambio automix-inicio-y-controles.  Uso: node --experimental-default-type=module scripts/test-automix-inicio.js model|engine  (y panel|immersive|layout|docs, ver más abajo)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const tests = {};
const T = (id, o = {}) => ({ videoId: id, title: id, artist: 'x', ...o });
const deck = (id, track, playing = false) => ({ id, track, st: { playing } });
const gap = (bpm, camelot) => ({ bpm, camelot });

tests.model = async () => {
  const { radioOrigins, otherDeckHead } = await import('../renderer/automix-origin.js');
  // REQ-1: sin nada cargado solo se ofrece buscar
  assert.deepStrictEqual(radioOrigins({ decks: { A: deck('A', null), B: deck('B', null) }, list: [] }).map((o) => o.id), ['search']);
  // con A sonando y B cargado: lo que suena, el otro deck, la lista y buscar; sin repetir la misma pista
  const A = deck('A', T('a'), true), B = deck('B', T('b'));
  assert.deepStrictEqual(radioOrigins({ decks: { A, B }, list: [T('l1'), T('l2')] }).map((o) => o.id), ['playing', 'deckB', 'list', 'search']);
  assert.deepStrictEqual(radioOrigins({ decks: { A, B }, list: [T('a')] }).map((o) => o.id), ['playing', 'deckB', 'search'], 'la lista no repite la que ya suena');
  assert.deepStrictEqual(radioOrigins({ decks: { A: deck('A', T('a')), B: deck('B', T('b')) } }).map((o) => o.id), ['deckA', 'deckB', 'search'], 'nada suena: cada deck por su nombre');
  assert.ok(radioOrigins({ decks: { A, B } }).every((o) => o.id === 'search' || o.track?.videoId), 'todo origen con pista trae su pista');
  assert.deepStrictEqual(radioOrigins({ decks: { A }, list: [{ videoId: 'p', playlist: true }, T('l')] }).find((o) => o.id === 'list').track.videoId, 'l', 'salta las listas anidadas');
  // REQ-3: el otro deck solo si es distinto, analizado y compatible
  const ana = new Map([['a', gap(124, '8A')], ['b', gap(126, '9A')], ['c', gap(150, '8A')], ['d', gap(124, '3B')]]);
  const cur = deck('A', T('a'), true);
  assert.strictEqual(otherDeckHead(cur, deck('B', T('b')), ana)?.videoId, 'b', 'compatible');
  assert.strictEqual(otherDeckHead(cur, deck('B', T('c')), ana), null, 'salto de BPM');
  assert.strictEqual(otherDeckHead(cur, deck('B', T('d')), ana), null, 'tonalidad en choque');
  assert.strictEqual(otherDeckHead(cur, deck('B', T('a')), ana), null, 'la misma pista');
  assert.strictEqual(otherDeckHead(cur, deck('B', T('z')), ana), null, 'sin análisis');
  assert.strictEqual(otherDeckHead(cur, deck('B', null), ana), null, 'deck vacío');
  assert.strictEqual(otherDeckHead(cur, deck('B', T('z')), new Map([['a', gap(124, '8A')]])), null);
  assert.strictEqual(otherDeckHead(cur, { track: T('z'), analysis: gap(125, null) }, ana)?.videoId, 'z', 'toma el análisis del deck si no está en el mapa; sin tonalidad no choca');
  console.log('model ok');
};

tests.engine = async () => {
  const listeners = [];
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const radio = [];
  globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async () => null, request() {}, list: async () => [] },
    lib: { radio: async () => ({ ok: true, data: radio }), search: async () => ({ ok: true, data: [] }), popularity: async () => ({ ok: true, data: {} }) } } };
  const { AutoMix } = await import('../renderer/automix.js');
  const ana = (bpm, camelot) => ({ bpm, camelot, offset: 0, duration: 240, mix: { mixIn: 8, mixOut: [{ t: 200, score: 1 }], phrases: new Array(20).fill(60), phraseBeats: 16 } });
  const fakeDeck = (id) => ({ id, source: 'local', fxc: { slots: [{ on: false }, { on: false }, { on: false }], owners: [], set() {}, ramp() {} }, fxSet() {}, fxRamp() {}, track: null, pos: 0, pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, st: { playing: false, dur: 240 },
    async load(t) { this.track = t; this.st = { playing: false, dur: 240, ready: true, videoId: t.videoId }; }, togglePlay() { this.st.playing = true; }, remaining() { return this.st.dur - this.pos; }, bpm() { return this.analysis?.bpm || null; },
    setLoop() {}, matchTempoSmart: () => true, alignPhase() {}, phaseDiff: () => null, setPitch() {}, analyze() {}, seek() {}, transport() {} });
  const mk = (bTrack, bAna) => {
    const A = fakeDeck('A'), B = fakeDeck('B');
    const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast() {}, xfader: { value: 0 }, applyXf() {}, localMode: false };
    const am = new AutoMix(app); am.cfg.endless = false;
    A.track = T('a'); A.analysis = ana(124, '8A'); A.st = { playing: true, dur: 240, ready: true, videoId: 'a' }; am.ana.set('a', A.analysis);
    if (bTrack) { B.track = bTrack; B.analysis = bAna; B.st = { playing: false, dur: 240, ready: true, videoId: bTrack.videoId }; if (bAna) am.ana.set(bTrack.videoId, bAna); }
    return { am, A, B };
  };
  // REQ-3: con la cola vacía, la pista compatible del otro deck es la siguiente
  let r = mk(T('b'), ana(126, '9A')); await r.am.start(); r.am.stop();
  assert.deepStrictEqual(r.am.queue.map((x) => x.videoId), ['b'], 'toma la del otro deck');
  assert.strictEqual(r.B.track.videoId, 'b', 'no se descarga del deck');
  // no compatible: no entra
  r = mk(T('c'), ana(150, '8A')); await r.am.start(); r.am.stop();
  assert.deepStrictEqual(r.am.queue.map((x) => x.videoId), [], 'salto de BPM: la cola sigue vacía (se rellenará con la radio)');
  // con lista propia no se toca la lista
  r = mk(T('b'), ana(126, '9A')); await r.am.start({ tracks: [T('a'), T('l1'), T('l2')] }); r.am.stop();
  assert.deepStrictEqual(r.am.queue.map((x) => x.videoId), ['l1', 'l2'], 'la lista del usuario manda');
  // REQ-1: empezar desde una pista (origen) la carga como primera y la deja sonando
  r = mk(null, null); await r.am.start({ seed: T('s') }); r.am.stop();
  assert.strictEqual(r.B.track?.videoId, 's', 'la pista origen se carga en el deck libre');
  assert.strictEqual(r.am.history.has('s'), true);
  console.log('engine ok');
};

// ---- pruebas dentro de Electron: una sola ejecución para panel, immersive y layout ----
async function app() {
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-ami-'));
  try {
    const music = path.join(tmp, 'audio');
    assert.strictEqual(spawnSync('node', [path.join(root, 'scripts/make-demo-audio.js'), music], { cwd: root }).status, 0, 'audio de demostración');
    spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/automix-inicio-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
    const f = path.join(tmp, 'automix-inicio.json');
    assert.ok(fs.existsSync(f), 'la app no produjo resultado');
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.ok(!r.error, r.error);
    for (const k of ['panel', 'start', 'layout', 'immersive']) assert.ok(r[k] && !r[k].__err, `${k}: ${JSON.stringify(r[k])}`);
    return r;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
let cache;
const ui = async () => (cache ||= await app());

tests.panel = async () => {
  const { panel, start } = await ui();
  // REQ-1/4: barra fija con iniciar, mezclar ahora, siguiente y radio; los ajustes en un bloque plegado
  assert.strictEqual(panel.sticky, 'sticky'); assert.deepStrictEqual(panel.inBar, [true, true, true, true]);
  assert.ok(panel.moreExists && !panel.moreOpen, 'ajustes plegados por defecto'); assert.strictEqual(panel.groups, 4, 'Transición, Estilo y salida, Cola y Fuente');
  assert.strictEqual(panel.ghostInRow, 0, 'los botones de la fila no son fantasma');
  // menú Radio: orígenes con los decks cargados, se cierra con Esc
  assert.strictEqual(panel.before.menuHidden, true); assert.strictEqual(panel.expanded, 'true'); assert.deepStrictEqual(panel.ids, ['deckA', 'deckB', 'list', 'search']); assert.strictEqual(panel.closedByEsc, true);
  assert.ok(panel.radioBtn, 'cada resultado de búsqueda tiene «Radio»');
  // elegir el deck B inicia AutoMix con esa pista
  assert.strictEqual(start.on, true); assert.strictEqual(start.cur, 'Night Pulse'); assert.match(start.toggle, /Detener/);
  console.log('panel ok');
};
tests.immersive = async () => {
  const { immersive: i } = await ui();
  // REQ-2: controles en la vista inmersiva, con el mismo estado que el panel
  assert.deepStrictEqual(i.present, [true, true, true, true]); assert.deepStrictEqual(i.vis, [true, true, true, true], 'visibles sin desplazar');
  assert.match(i.label0, /Iniciar/); assert.ok(i.ids2.includes('deckB') && i.ids2.includes('search') && i.ids2.length >= 3, `orígenes: ${i.ids2}`);
  assert.strictEqual(i.on, true, 'el menú de la vista inicia AutoMix'); assert.match(i.label1, /Detener/); assert.strictEqual(i.stopped, true, 'el botón detiene'); assert.ok(i.openStill, 'sigue el acceso al panel');
  console.log('immersive ok');
};
tests.layout = async () => {
  const { layout: l } = await ui();
  // REQ-4: nada fuera de la ventana ni recortado; la cola y el buscador a la vista sin desplazar
  assert.deepStrictEqual(l.bad, [], `controles fuera de la ventana (W=${l.W}): ${JSON.stringify(l.badInfo)}`); assert.strictEqual(l.segClip, false, 'estilos recortados'); assert.strictEqual(l.viewScroll, false, 'desplazamiento horizontal');
  assert.ok(l.searchTop < l.H - 40, `buscador fuera de pantalla (${l.searchTop}/${l.H})`); assert.ok(l.listTop < l.H - 40, `cola fuera de pantalla (${l.listTop}/${l.H})`);
  assert.ok(l.automixBtnOne, 'AutoMix en una línea'); assert.ok(l.sessionOne, 'sesión en una línea');
  console.log('layout ok');
};

tests.docs = () => {
  const d = fs.readFileSync(path.join(root, 'docs/04-automix.md'), 'utf8');
  for (const w of ['Radio ▾', 'Deck A', 'lista abierta', 'Barra de reproducción', 'Ajustes de AutoMix', 'otro deck']) assert.ok(d.includes(w), `04-automix.md: ${w}`);
  const inv = fs.readFileSync(path.join(root, 'docs/inventario-controles.md'), 'utf8');
  for (const id of ['amv-radio', 'imm-radio', 'imm-toggle', 'imm-mix', 'imm-skip']) assert.ok(inv.includes(`\`${id}\``), `inventario: ${id}`);
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.ok(/for m in model engine docs; do .*test-automix-inicio\.js \$m/.test(ci) && /test-automix-inicio\.js panel,immersive,layout/.test(ci), 'CI ejecuta las pruebas');
  console.log('docs ok');
};

for (const m of String(mode).split(',')) { const t = tests[m]; if (!t) { console.error(`modo desconocido: ${m}`); process.exit(2); } await t(); }
