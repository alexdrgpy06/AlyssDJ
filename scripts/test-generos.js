// Pruebas de géneros por pista.  Uso: node --experimental-default-type=module scripts/test-generos.js model|ui|engine|docs
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = process.argv[2] || 'model';
const tests = {};
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

tests.model = async () => {
  const G = require('../main/genres');
  assert.deepStrictEqual(G.normalize('house; deep HOUSE / tech-house, house'), ['House', 'Deep House', 'Tech-house']);
  assert.deepStrictEqual(G.normalize(['a', 'b', 'c', 'd', 'e', 'f', 'g']).length, 5, 'máximo 5');
  assert.deepStrictEqual(G.normalize(' ; N/A ; unknown '), [], 'vacíos y desconocidos fuera');
  assert.deepStrictEqual(G.tagFromFfmpeg('  Metadata:\n    title           : X\n    genre           : Techno; Hard Techno\n'), ['Techno', 'Hard Techno']);
  assert.deepStrictEqual(G.tagFromFfmpeg('sin etiqueta'), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genres-'));
  const file = path.join(dir, 'genres.json'); const events = [];
  const s = new G.GenreStore({ file, emit: (e) => events.push(e) });
  assert.ok(s.setAuto('a', 'House', 'archivo')); assert.strictEqual(s.get('a').source, 'archivo');
  assert.strictEqual(s.setAuto('a', 'House', 'archivo'), false, 'sin cambios no se reescribe ni avisa');
  s.setManual('a', ['Techno', 'Acid']); assert.deepStrictEqual(s.get('a'), { genres: ['Techno', 'Acid'], source: 'manual' });
  assert.strictEqual(s.setAuto('a', 'Pop', 'metadatos'), false, 'lo manual no se pisa al reanalizar');
  s.setAuto('b', 'Techno', 'metadatos');
  const r = new G.GenreStore({ file }); // persiste
  assert.deepStrictEqual(r.get('a').genres, ['Techno', 'Acid']);
  assert.deepStrictEqual(r.all().vocabulary[0], { name: 'Techno', n: 2 });
  r.setManual('a', []); assert.strictEqual(r.get('a'), null, 'lista vacía quita lo manual');
  assert.ok(!fs.existsSync(file + '.tmp'), 'escritura atómica');
  assert.ok(events.length >= 3);
  // REQ-6: exportación con género (CSV y Rekordbox; M3U8 no cambia)
  const X = require('../main/export');
  const f = path.join(dir, 'a.m4a'); fs.writeFileSync(f, 'x');
  const e = X.normalize({ videoId: 'a', title: 'Uno', artist: 'Ñu', duration: 100 }, { bpm: 124, camelot: '8A' }, () => f, (id) => (id === 'a' ? ['House', 'Deep House'] : []));
  assert.strictEqual(e.genre, 'House, Deep House');
  const csv = X.toCsv([e]).text; assert.ok(csv.includes('género') && csv.includes('"House, Deep House"'), 'CSV con género');
  assert.ok(X.toRekordbox([e], 'L').text.includes('Genre="House, Deep House"'), 'Rekordbox con Genre');
  assert.ok(!X.toM3u8([e]).text.includes('House'), 'M3U8 sin cambios');
  assert.ok(!X.toRekordbox([{ ...e, genre: '' }], 'L').text.includes('Genre='), 'sin género no se escribe el atributo');
  console.log('generos model: OK');
};
tests.engine = async () => {
  const M = await import('../renderer/mixplan.js');
  const ana = (bpm) => ({ bpm, camelot: '8A', offset: 0, duration: 240, mix: { phrases: new Array(20).fill(60), phraseBeats: 16 } });
  const ref = ana(124); const refTrack = { videoId: 'R', title: 'R', artist: 'Z', genres: ['House', 'Techno'] };
  const T = (id, genres) => ({ track: { videoId: id, title: id, artist: 'x', ...(genres ? { genres } : {}) }, analysis: ana(124) });
  const r = M.rankCandidates({ ref, refTrack, cands: [T('otro', ['Pop']), T('sin'), T('comparte', ['Techno', 'Acid'])], popularity: false });
  assert.strictEqual(r[0].track.videoId, 'comparte', 'prefiere la que comparte género');
  const byId = Object.fromEntries(r.map((x) => [x.track.videoId, x]));
  assert.strictEqual(byId.comparte.style - byId.sin.style, M.GENRE_BONUS);
  assert.strictEqual(byId.otro.style, byId.sin.style, 'sin género compartido o sin género: ni premio ni castigo');
  assert.ok(r.every((x) => x.fits), 'el género no descarta candidatas');
  const none = M.rankCandidates({ ref, refTrack: { videoId: 'R', artist: 'Z' }, cands: [T('a', ['House'])], popularity: false });
  assert.strictEqual(none[0].style, 0, 'sin géneros en la referencia, resultado idéntico al de antes');
  console.log('generos engine: OK');
};
tests.docs = () => {
  const doc = read('docs/03-libreria-y-playlists.md') + read('README.md'); const lc = doc.toLowerCase();
  for (const w of ['géneros', 'etiquetas del archivo', 'filtro', 'automix']) assert.ok(lc.includes(w), `la documentación menciona «${w}»`);
  const ci = read('.github/workflows/ci.yml'); assert.ok(/test-generos\.js \$m/.test(ci), 'en la CI');
  console.log('generos docs: OK');
};
tests.ui = async () => {
  const html = read('renderer/index.html'); const lib = read('renderer/library.js'); const pre = read('preload/app.js');
  assert.ok(/id="btn-genres"[^>]*aria-haspopup/.test(html) && /id="genre-menu"/.test(html), 'botón y menú de géneros');
  assert.ok(/genres:set/.test(pre) && /openGenreEditor/.test(lib), 'IPC y editor');
  const { spawnSync } = await import('node:child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-generosui-')); const data = path.join(tmp, 'data'); const cache = path.join(data, 'cache'); fs.mkdirSync(cache, { recursive: true });
  for (const [id, bpm] of [['aaaaaaaaaaa', 124], ['bbbbbbbbbbb', 128], ['ccccccccccc', 100]]) fs.writeFileSync(path.join(cache, `${id}.json`), JSON.stringify({ id, title: `Pista ${id}`, artist: 'Ñu', duration: 180, trackDuration: 180, bpm, camelot: '8A', analyzedAt: new Date().toISOString() }));
  fs.writeFileSync(path.join(data, 'genres.json'), JSON.stringify({ aaaaaaaaaaa: { genres: ['House', 'Techno'], source: 'archivo' }, bbbbbbbbbbb: { genres: ['Techno'], source: 'metadatos' } }));
  const headless = require('./headless.js');
  spawnSync(...headless(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', 'generos-selftest.js'), YTDJ_USERDATA: data, YTDJ_SELFTEST_OUT: tmp }, stdio: 'ignore' });
  const f = path.join(tmp, 'generos.json'); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err));
  // REQ-4: chips en las filas y botón con el vocabulario (por frecuencia)
  assert.deepStrictEqual(r.start.chips.aaaaaaaaaaa, ['House', 'Techno']); assert.deepStrictEqual(r.start.chips.ccccccccccc, []); assert.strictEqual(r.start.btn, true);
  assert.deepStrictEqual([r.menu.open, r.menu.expanded], [true, 'true']); assert.deepStrictEqual(r.menu.items.map((t) => t.replace(/\d+$/, '')), ['Techno', 'House']);
  assert.deepStrictEqual(r.filtered.ids.sort(), ['aaaaaaaaaaa', 'bbbbbbbbbbb']); assert.strictEqual(r.filtered.label, 'Géneros (1)');
  assert.strictEqual(r.cleared.ids.length, 3, 'quitar el filtro devuelve todas'); assert.deepStrictEqual([r.esc.open, r.esc.focus], [false, 'btn-genres'], 'Escape cierra y devuelve el foco');
  // REQ-3: editor con el foco en el campo, Enter añade, se guarda como manual y la fila lo muestra al cerrar
  assert.ok(r.editorOpen.editor && /gedit-in/.test(r.editorOpen.focus)); assert.deepStrictEqual(r.added.chips, ['Deep House']); assert.ok(r.added.editor, 'sigue abierto tras añadir');
  assert.strictEqual(r.closed.editor, false); assert.deepStrictEqual(r.closed.chips.ccccccccccc, ['Deep House']); assert.ok(/gn/.test(r.closed.focus), 'el foco vuelve al botón de la fila');
  const saved = JSON.parse(fs.readFileSync(path.join(data, 'genres.json'), 'utf8')); assert.deepStrictEqual(saved.ccccccccccc, { genres: ['Deep House'], source: 'manual' });
  assert.ok(r.vocab.includes('Techno:2') && r.vocab.includes('Deep House:1'));
  console.log('generos ui: OK');
};
tests[mode]();
