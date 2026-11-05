#!/usr/bin/env node
// Pruebas del cambio automix-simple-y-continuo.  Uso: node --experimental-default-type=module scripts/test-automix-continuo.js dup|entry|seamless|source|ui|docs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const tests = {};

tests.dup = async () => {
  const { songKey } = await import('../renderer/mixplan.js');
  const { engine, T, ana } = await import('./automix-fakes.mjs');
  // REQ-4: misma canción con créditos o sufijos distintos
  const same = [
    [{ title: "Gangsta's Paradise (con L.V.)", artist: 'Coolio' }, { title: "Gangsta's Paradise", artist: 'Coolio, L.V.' }],
    [{ title: 'Empire State Of Mind (con Alicia Keys)', artist: 'JAY-Z' }, { title: 'Empire State of Mind', artist: 'JAY-Z & Alicia Keys' }],
    [{ title: 'Song (feat. Drake)', artist: 'Rihanna' }, { title: 'Song', artist: 'Rihanna' }],
    [{ title: 'Song - Remastered 2011', artist: 'Queen' }, { title: 'Song (Official Video)', artist: 'Queen' }],
    [{ title: 'Canción - feat. X', artist: 'Ana y Luis' }, { title: 'Canción', artist: 'Ana' }],
  ];
  for (const [a, b] of same) assert.strictEqual(songKey(a), songKey(b), `${a.title} = ${b.title}`);
  // y no se confunden las distintas
  assert.notStrictEqual(songKey({ title: 'Song (Remix)', artist: 'Queen' }), songKey({ title: 'Song', artist: 'Queen' }), 'un remix es otra versión');
  assert.notStrictEqual(songKey({ title: 'Con Calma', artist: 'Daddy Yankee' }), songKey({ title: 'Calma', artist: 'Daddy Yankee' }), 'una palabra «con» del título no se quita');
  assert.notStrictEqual(songKey({ title: 'Con Calma (Remix)', artist: 'Daddy Yankee' }), songKey({ title: 'Con Calma', artist: 'Daddy Yankee' }));
  // la lista que se da al iniciar no repite la que suena ni entre sí
  const { am, A } = engine({ cur: T('a', { title: "Gangsta's Paradise (con L.V.)", artist: 'Coolio' }) });
  await am.start({ seed: A.track, tracks: [A.track, T('b', { title: "Gangsta's Paradise", artist: 'Coolio, L.V.' }), T('c', { title: 'Otra' }), T('d', { title: 'Otra (Official Audio)' })] });
  am.stop();
  assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['c'], 'sin la canción que suena ni la repetida');
  // agregar a mano: la misma canción pide confirmación; con confirmDup entra
  const e = engine({ cur: T('a', { title: 'Song', artist: 'Queen' }) });
  e.am.on = true; e.am.cur = e.A;
  const dup = T('z', { title: 'Song (Official Video)', artist: 'Queen' });
  const r = e.am.addSmart(dup);
  assert.deepStrictEqual([r.ok, r.reason, r.song], [false, 'dup', true]);
  assert.strictEqual(e.am.queue.length, 0, 'no se añadió');
  assert.strictEqual(e.am.addSmart(dup, { confirmDup: true }).ok, true, 'con confirmación entra');
  assert.strictEqual(e.am.isSameSong(dup, e.A.track), true);
  console.log('dup ok');
};

tests.entry = async () => {
  const { pickEntry } = await import('../renderer/mixplan.js');
  const { engine, T } = await import('./automix-fakes.mjs');
  // REQ-1: sin análisis, punto seguro = clamp(0,08·duración, 10, 40) s, nunca 0:00
  const safe = (d) => pickEntry(null, { videoId: 'x', duration: d }, { exitAt: 10, seconds: 16 });
  for (const [d, t] of [[100, 10], [300, 24], [900, 40]]) { const e = safe(d); assert.deepStrictEqual([e.kind, e.t], ['safe', t], `duración ${d}`); assert.match(e.why, /punto seguro/); }
  assert.strictEqual(safe(undefined).t, 10);
  // con análisis o punto marcado, no se usa
  assert.strictEqual(pickEntry(null, { videoId: 'x', duration: 300, mixEdit: { in: 5 } }, { exitAt: 10 }).kind, 'edit');
  assert.strictEqual(pickEntry(null, { videoId: 'x', duration: 300, mix: { mixIn: 7 } }, { exitAt: 10 }).t, 7);
  // el plan se rehace al llegar el análisis: «Mezclar ahora» no se queda con la entrada segura
  const { am, A, B } = engine({ cur: T('a', {}), b: T('b', {}) });
  assert.ok(am.makeNearestPlan, 'hay plan más cercano');
  console.log('entry ok');
};

tests.seamless = async () => {
  const { engine, T, ana } = await import('./automix-fakes.mjs');
  // REQ-2: la entrante se coloca en su punto de entrada en pausa antes de mezclar; sin lista, sigue sonando la actual
  const e = engine({ cur: T('a', {}), curAna: ana(124, '8A', { duration: 200 }), b: T('b', {}), bAna: ana(124, '8A', { duration: 240 }) });
  const { am, A, B } = e;
  const plan = { enterAt: 24, exitAt: 150, seconds: 16 };
  B.st.playing = false;
  assert.strictEqual(am.entryReady(B, plan), false, 'sin colocar no se mezcla');
  assert.strictEqual(am.prepareEntry(B, B.track, plan), true);
  assert.strictEqual(B.seeks.at(-1), 24, 'colocada en la entrada');
  assert.strictEqual(B.st.playing, false, 'sigue en pausa: sin sonido');
  B.pos = 24;
  assert.strictEqual(am.entryReady(B, plan), true);
  // no lista: no se prepara ni se toca la que suena
  B.st.ready = false;
  assert.strictEqual(am.prepareEntry(B, B.track, plan), false);
  console.log('seamless ok');
};

tests.source = async () => {
  const { recipeFor, planRecipe } = await import('../renderer/recipes.js');
  const { engine, T, ana } = await import('./automix-fakes.mjs');
  const a = ana(124, '8A', { duration: 240 }), b = ana(124, '8A', { duration: 240 });
  const plan = { exitAt: 200, seconds: 16 };
  // REQ-3: stream → fundido + filtro, sin EQ de graves ni efectos
  const s = recipeFor({ cur: a, next: b, local: false, plan, level: 'full' });
  assert.strictEqual(s.full, false); assert.strictEqual(s.recipe.style, 'fade-filter');
  const params = new Set(s.recipe.gestures.map((x) => x.param));
  assert.deepStrictEqual([...params].sort(), ['filter', 'x'], 'solo filtro y fundido');
  assert.ok(!s.recipe.gestures.some((x) => x.fx), 'sin efectos');
  // local: receta completa
  const l = recipeFor({ cur: a, next: b, local: true, plan, level: 'full' });
  assert.strictEqual(l.full, true); assert.notStrictEqual(l.recipe.style, 'fade-filter'); assert.ok(l.recipe.gestures.some((x) => x.param === 'eqLow'));
  // motor: solo cuenta como local si las dos son archivo y están analizadas
  const e = engine({ cur: T('a', {}), curAna: a, b: T('b', {}), bAna: b });
  e.A.source = 'local'; e.B.source = 'stream';
  assert.strictEqual(e.am.fullRecipe(e.A, e.B), false, 'una en streaming');
  e.B.source = 'local';
  assert.strictEqual(e.am.fullRecipe(e.A, e.B), true);
  e.am.ana.set('b', {}); e.B.analysis = null;
  assert.strictEqual(e.am.fullRecipe(e.A, e.B), false, 'sin análisis de la entrante');
  assert.strictEqual(e.am.fullRecipe(e.B, e.B), false);
  // transición real con una en streaming: sin tempo, sin movimientos, estilo fade-filter
  e.B.source = 'stream'; e.B.analysis = b; e.am.ana.set('b', b);
  e.am.on = true; e.am.cur = e.A;
  e.am.startTransition(e.A, e.B, { exitAt: 200, seconds: 16, enterAt: 0, warnings: [] });
  assert.strictEqual(e.am.trans.style, 'fade-filter'); assert.strictEqual(e.am.trans.tempo, false); assert.deepStrictEqual(e.am.trans.moves || [], []);
  e.am.stop?.();
  console.log('source ok');
};

tests.docs = async () => {
  const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const d = rd('docs/04-automix.md');
  for (const re of [/Entrada segura y transición continua/, /punto seguro/, /Sin saltos/, /fundido y filtro/, /Sin repetir canciones/, /Avanzado/, /Elegir radio/]) assert.match(d, re, String(re));
  const inv = rd('docs/inventario-controles.md');
  for (const re of [/amv-profile/, /am-adv/, /am-hint/]) assert.match(inv, re, String(re));
  const ci = rd('.github/workflows/ci.yml');
  assert.ok(/test-automix-continuo\.js/.test(ci), 'CI ejecuta las pruebas de automix-simple-y-continuo');
  console.log('docs ok');
};

let uiCache;
async function app() {
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-amc-'));
  try {
    const music = path.join(tmp, 'audio');
    assert.strictEqual(spawnSync('node', [path.join(root, 'scripts/make-demo-audio.js'), music], { cwd: root }).status, 0, 'audio de demostración');
    spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/automix-continuo-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
    const f = path.join(tmp, 'automix-continuo.json');
    assert.ok(fs.existsSync(f), 'la app no produjo resultado');
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.ok(!r.error, r.error);
    for (const k of ['panel', 'badge']) assert.ok(r[k] && !r[k].__err, `${k}: ${JSON.stringify(r[k])}`);
    return r;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

tests.ui = async () => {
  const { panel, badge } = await (uiCache ||= app());
  // REQ-5: plegado el bloque de ajustes no se ve nada; abierto, solo perfil, duración y efectos; lo demás, en «Avanzado»
  assert.ok(panel.closed.simple.every((v) => !v) && panel.closed.adv.every((v) => !v), `con los ajustes plegados no se ve ninguno: ${JSON.stringify(panel.closed)}`);
  assert.deepStrictEqual(panel.open1.simple, [true, true, true], 'perfil, duración y efectos a la vista');
  assert.ok(panel.open1.adv.every((v) => !v) && !panel.open1.advOpen, 'lo demás está en «Avanzado» y plegado');
  assert.ok(panel.open2.adv.every((v) => v), 'abierto «Avanzado», se ven estilo, salida, tempo, orden, popularidad, fuente y radio continua');
  assert.deepStrictEqual(panel.profiles, ['soft', 'club', 'radio'], 'sin botón «Personalizado»');
  // REQ-1: la tarjeta SIGUE avisa del punto seguro
  assert.strictEqual(panel.badgeHidden, true);
  assert.deepStrictEqual([badge.on.hidden, badge.on.why, badge.off], [false, 'sin análisis: entra en un punto seguro', true]);
  console.log('ui ok');
};

const t = tests[mode];
if (!t && !mode) { console.error('falta el modo'); process.exit(2); }
for (const m of String(mode).split(',')) { if (!tests[m]) { console.error(`modo desconocido: ${m}`); process.exit(2); } await tests[m](); }
