// Pruebas del cambio playlists-locales.  Uso: node scripts/test-playlists.js store|ipc|ui|select|order|smart|export|docs
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const mode = process.argv[2] || 'store';
const tests = {};

const T = (id, o = {}) => ({ videoId: id, title: `Tema ${id}`, artist: 'Artista', duration: 200, thumb: '', ...o });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-pl-'));

tests.store = async () => {
  const { PlaylistStore } = require('../main/playlists');
  const dir = tmp(); const file = path.join(dir, 'playlists-local.json');
  const meta = { a: { bpm: 128, camelot: '8A', genres: ['House'] }, b: { bpm: 100, camelot: '2B', genres: ['Techno'] }, c: { bpm: 0 }, d: { bpm: 90, camelot: '11A', genres: [] } };
  let smartFilter = null;
  const st = new PlaylistStore(file, { meta: (id) => meta[id], smart: (f) => { smartFilter = f; return [T('a'), T('b')]; } });
  // REQ-1: crear, renombrar, duplicar, borrar; resumen con pistas y duración
  const l = st.create('Warm up', { tracks: [T('a'), T('b'), T('a'), T('c', { duration: 100 })] });
  assert.strictEqual(l.tracks.length, 3, 'al crear no se repiten pistas');
  const s = st.list()[0]; assert.deepStrictEqual([s.name, s.kind, s.count, s.duration], ['Warm up', 'manual', 3, 500]);
  assert.throws(() => st.create('  '), /nombre/);
  assert.strictEqual(st.create('warm UP').name, 'warm UP 2', 'nombre repetido se numera');
  st.rename(l.id, 'Calentamiento'); assert.strictEqual(st.get(l.id).name, 'Calentamiento');
  const dup = st.duplicate(l.id); assert.match(dup.name, /Calentamiento \(copia\)/); assert.deepStrictEqual(dup.tracks.map((t) => t.videoId), ['a', 'b', 'c']);
  st.delete(dup.id); assert.throws(() => st.get(dup.id), /ya no existe/);
  // REQ-2: añadir de cualquier fuente sin duplicados, salvo que se pida
  assert.deepStrictEqual(st.add(l.id, [T('b'), T('d'), T('e', { local: true })]), { added: 2, skipped: 1 });
  assert.deepStrictEqual(st.add(l.id, [T('b')], { allowDup: true }), { added: 1, skipped: 0 });
  assert.ok(!('path' in st.get(l.id).tracks.find((t) => t.videoId === 'e')) && st.get(l.id).tracks.find((t) => t.videoId === 'e').local, 'sin rutas, conserva «local»');
  // REQ-3: quitar y deshacer en su sitio, sin tocar otras listas
  const other = st.create('Otra', { tracks: [T('d')] });
  st.remove(l.id, ['b']); // quita las dos copias
  const before = st.get(l.id).tracks.map((t) => t.videoId);
  const r = st.remove(l.id, ['a', 'd']);
  assert.strictEqual(r.removed.length, 2); assert.ok(!st.get(l.id).tracks.some((t) => ['a', 'd'].includes(t.videoId)));
  assert.strictEqual(st.restore(l.id, r.removed), 2); assert.deepStrictEqual(st.get(l.id).tracks.map((t) => t.videoId), before, 'deshacer devuelve el orden original');
  assert.strictEqual(st.get(other.id).tracks.length, 1, 'las otras listas no cambian');
  // REQ-5: ordenar (los sin dato van al final en ambos sentidos) y reordenar a mano
  st.sortBy(l.id, 'bpm', 1); assert.deepStrictEqual(st.get(l.id).tracks.map((t) => t.videoId).slice(0, 3), ['d', 'a', 'c'].filter((x) => before.includes(x)).slice(0, 3).length ? ['d', 'a', 'c'] : []);
  st.sortBy(l.id, 'bpm', -1); const last = st.get(l.id).tracks.map((t) => t.videoId); assert.strictEqual(last[0], 'a'); assert.ok(['c', 'e'].includes(last[last.length - 1]), 'sin BPM al final');
  st.sortBy(l.id, 'key', 1); assert.strictEqual(st.get(l.id).tracks[0].videoId, 'a'); assert.deepStrictEqual(st.get(l.id).sort, { k: 'key', dir: 1 });
  st.sortBy(l.id, 'title', -1); assert.strictEqual(st.get(l.id).tracks[0].title, 'Tema e');
  assert.throws(() => st.sortBy(l.id, 'nada'), /Orden/);
  const ids = st.get(l.id).tracks.map((t) => t.videoId); const rev = [...ids].reverse();
  st.reorder(l.id, rev); assert.deepStrictEqual(st.get(l.id).tracks.map((t) => t.videoId), rev); assert.strictEqual(st.get(l.id).sort, null, 'el orden manual borra el criterio');
  st.reorder(l.id, [rev[1]]); assert.strictEqual(st.get(l.id).tracks[0].videoId, rev[1], 'lo que falta queda al final');
  // REQ-6: lista inteligente: se resuelve sola y no admite edición manual
  const sm = st.create('Techno rápido', { kind: 'smart', filter: { bpm: [120, 140], genres: ['Techno'] } });
  assert.deepStrictEqual(st.get(sm.id).tracks.map((t) => t.videoId), ['a', 'b']); assert.deepStrictEqual(smartFilter, { bpm: [120, 140], genres: ['Techno'] });
  assert.throws(() => st.add(sm.id, [T('z')]), /inteligente/);
  assert.strictEqual(st.setFilter(sm.id, { key: '8A' }).filter.key, '8A');
  // REQ-7: copia de una importada
  const c = st.fromCrate({ id: 'PL1', title: 'Favoritas', tracks: [T('x'), T('y')] }); assert.strictEqual(c.name, 'Favoritas'); assert.strictEqual(c.tracks.length, 2);
  // REQ-8: persistencia atómica, archivo dañado y sin tocar música
  assert.ok(!fs.existsSync(`${file}.tmp`), 'no queda el temporal');
  const again = new PlaylistStore(file, {}); assert.strictEqual(again.list().length, st.list().length);
  fs.writeFileSync(file, '{no es json');
  const bad = new PlaylistStore(file, {}); assert.deepStrictEqual(bad.list(), []);
  assert.ok(fs.readdirSync(dir).some((f) => /playlists-local\.json\.bad-/.test(f)), 'conserva una copia del dañado');
  bad.create('Nueva'); assert.strictEqual(new PlaylistStore(file, {}).list().length, 1);
  assert.ok(!/fs\.(unlink|rm|writeFile)[^;]*(mp3|path\b)/i.test(read('main/playlists.js')) && !/unlinkSync|rmSync/.test(read('main/playlists.js')), 'nunca borra archivos de música');
  console.log('playlists store: OK');
};

function runApp(selftest, outFile, extraEnv = {}) {
  const { spawnSync } = require('node:child_process');
  const music = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(music, 'Neon Drive.mp3'))) spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), music], { stdio: 'ignore' });
  const dir = tmp();
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', selftest), YTDJ_USERDATA: path.join(dir, 'data'), YTDJ_SELFTEST_OUT: dir, YTDJ_DOCS_MUSIC: music, YTDJ_EXPORT_FILE: path.join(dir, 'export.out'), ...extraEnv }, stdio: 'ignore' });
  const f = path.join(dir, outFile); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err)); r.__dir = dir; return r;
}
let appRun = null;
const appResult = () => (appRun ||= runApp('playlists-selftest.js', 'playlists.json'));

tests.ipc = async () => {
  const main = read('main/main.js'); const pre = read('preload/app.js');
  for (const c of ['list', 'get', 'create', 'rename', 'duplicate', 'delete', 'add', 'remove', 'restore', 'reorder', 'sort', 'set-filter', 'from-crate']) assert.ok(main.includes(`'pl:${c}'`) && pre.includes(`'pl:${c}'`), `canal pl:${c}`);
  assert.ok(main.includes("'pl:event'") && /pl: \{/.test(pre), 'evento de cambios');
  const r = appResult().ipc;
  assert.ok(r.created.ok && r.created.data.tracks.length === 2, `crear: ${JSON.stringify(r.created)}`);
  assert.ok(r.list.ok && r.list.data.some((l) => l.name === 'Prueba' && l.count === 2), 'aparece en la lista con su número de pistas');
  assert.ok(r.get.data.tracks.every((t) => t.local && /\.mp3$/.test(t.path)), `las locales llegan con su ruta: ${JSON.stringify(r.get.data.tracks)}`);
  assert.deepStrictEqual(r.dup.data, { added: 1, skipped: 1 }, 'sin duplicados');
  assert.ok(r.events >= 1, 'avisa de los cambios');
  assert.ok(r.bad.ok === false && /ya no existe/.test(r.bad.error), 'error claro');
  assert.ok(r.export_m3u8.r.ok && /#EXTM3U/.test(r.export_m3u8.text) && /Neon Drive/.test(r.export_m3u8.text), `M3U8: ${JSON.stringify(r.export_m3u8)}`);
  assert.ok(/Neon Drive/.test(r.export_csv.text || ''), 'CSV'); assert.ok(/DJ_PLAYLISTS|<COLLECTION/.test(r.export_rekordbox.text || ''), 'Rekordbox XML');
  assert.ok(r.crate.ok && r.crate.data.name === 'Favoritas YT' && r.crate.data.tracks.length === 2, 'importada → local'); assert.ok(r.crateBad.ok === false);
  assert.ok(r.del.ok && r.file, 'borrar y archivo en userData');
  console.log('playlists ipc: OK');
};

tests.ui = async () => {
  const r = appResult().ui;
  assert.match(r.empty, /Aún no tienes listas/, 'sin listas se invita a crear una');
  assert.ok(r.editing.has && r.editing.focused && r.editing.val === 'Nueva playlist', `nombre en línea: ${JSON.stringify(r.editing)}`);
  assert.ok(r.afterName.length === 1 && /^Mi set ?0$/.test(r.afterName[0].text), `renombrar con Intro: ${JSON.stringify(r.afterName)}`);
  assert.ok(r.bar.toolbar && r.bar.bar && r.bar.name === 'Mi set' && /vacía/.test(r.bar.empty) && r.bar.tab.startsWith('pl:'), `lista nueva abierta: ${JSON.stringify(r.bar)}`);
  assert.ok(r.local.length >= 3, 'pistas locales'); assert.ok(r.menu.open && r.menu.focus && r.menu.items.some((i) => /^Mi set/.test(i)) && r.menu.items.some((i) => /Nueva playlist/.test(i)), `menú: ${JSON.stringify(r.menu)}`);
  assert.match(r.afterAdd[0].text, /Mi set ?1$/, 'se añadió desde la fila'); assert.match(r.dupToast, /Ya estaban/, 'sin duplicados'); assert.match(r.afterDrop[0].text, /Mi set ?2$/, 'soltar sobre la lista añade');
  assert.ok(r.fromMenu.editing, `nueva desde el menú: ${JSON.stringify(r.fromMenu)}`);
  assert.strictEqual(r.open.rows.length, 2, 'la lista abierta muestra sus pistas'); assert.match(r.open.msg, /Mi set · 2 pistas/); assert.ok(r.open.exp, 'se puede exportar'); assert.deepStrictEqual(r.open.on, [r.setId]);
  assert.strictEqual(r.renamed.name, 'Set de viernes'); assert.ok(r.renamed.src.some((x) => /Set de viernes/.test(x.text)));
  assert.match(r.dup.name, /Set de viernes \(copia\)/); assert.ok(r.dup.src.length >= 3);
  assert.ok(!r.del.src.some((x) => /copia/.test(x.text)) && !r.del.tab.startsWith('pl:'), `borrada: ${JSON.stringify(r.del)}`);
  assert.strictEqual(r.files, r.filesBefore, 'los archivos de música siguen ahí');
  console.log('playlists ui: OK');
};

tests.select = async () => {
  const r = appResult().sel; const S = (a) => [...a].sort();
  assert.ok(r.one.sel.length === 1 && !r.one.bar, 'un clic selecciona una pista y no abre la barra');
  assert.ok(r.ctrl.sel.length === 2 && r.ctrl.bar && /^2 seleccionadas/.test(r.ctrl.count) && !r.ctrl.remove && r.ctrl.tb, `Ctrl+clic suma: ${JSON.stringify(r.ctrl)}`);
  assert.strictEqual(r.range.sel.length, 3, 'Mayús+clic selecciona el rango');
  assert.strictEqual(r.all.sel.length, r.total, 'Ctrl+A selecciona todo'); assert.ok(r.cleared.sel.length === 0 && !r.cleared.bar, 'Cancelar limpia');
  assert.ok(r.expectAdded.length === 2 && r.expectAdded.every((id) => r.added.includes(id)), `añadir en bloque: ${JSON.stringify(r.added)}`);
  assert.strictEqual(r.q1 - r.q0, 2, 'a la cola de AutoMix'); assert.deepStrictEqual(S(r.an), S(r.expectAdded), 'analizar la selección');
  assert.ok(r.inList.remove && r.inList.sel.length === 2, 'dentro de una lista se puede quitar');
  assert.strictEqual(r.removed.rows.length, r.before.length - 2); assert.ok(r.removed.undo && /Quitadas 2/.test(r.removed.toast), `quitar: ${JSON.stringify(r.removed)}`); assert.strictEqual(r.removed.setCount, 2, 'las demás listas no cambian');
  assert.deepStrictEqual(r.restored, r.before, 'Deshacer devuelve las pistas a su sitio'); assert.deepStrictEqual(r.restoredKey, r.before, 'Ctrl+Z también');
  assert.strictEqual(r.filesAfter, appResult().ui.filesBefore, 'quitar de una lista no borra archivos');
  console.log('playlists select: OK');
};

tests.order = async () => {
  const r = appResult().order; const nrm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  assert.ok(r.start.length >= 3, 'la lista tiene pistas que ordenar');
  assert.deepStrictEqual(r.asc, [...r.start].sort((a, b) => (nrm(a) < nrm(b) ? -1 : nrm(a) > nrm(b) ? 1 : 0)), `por título: ${JSON.stringify(r.asc)}`);
  assert.deepStrictEqual(r.desc, [...r.asc].reverse(), 'sentido inverso'); assert.strictEqual(r.pressed, 'true');
  assert.deepStrictEqual(r.saved.rows, r.desc, 'el orden queda guardado'); assert.strictEqual(r.saved.select, 'title');
  assert.ok(r.dur.every((d, i) => i === 0 || r.dur[i - 1] >= d), `por duración (descendente): ${JSON.stringify(r.dur)}`);
  assert.strictEqual(r.drag.after[0], r.drag.before[2], 'arrastrar la tercera fila al principio'); assert.deepStrictEqual(r.drag.after, [r.drag.before[2], ...r.drag.before.filter((_, i) => i !== 2)]);
  assert.match(r.drag.mark, /drop-before/, 'se ve dónde caerá'); assert.strictEqual(r.drag.select, '', 'el orden manual borra el criterio'); assert.strictEqual(r.drag.saved.sort, null);
  assert.deepStrictEqual(r.drag.saved.tracks.map((t) => t.videoId), r.drag.after, 'y se guarda');
  console.log('playlists order: OK');
};

tests.smart = async () => {
  const r = appResult().smart;
  assert.ok(r.created.tab.startsWith('pl:') && r.created.panel && !r.created.order && r.created.filtersBtn && !r.created.rm, `lista inteligente nueva: ${JSON.stringify(r.created)}`);
  assert.strictEqual(r.house.rows.length, 2, `género House: ${JSON.stringify(r.house)}`); assert.match(r.house.msg, /inteligente/);
  assert.deepStrictEqual(r.analyzed.rows.sort(), r.house.rows.filter((id) => r.anIds.includes(id)).sort(), 'solo analizadas: las House que tienen análisis');
  assert.strictEqual(r.stems.rows.length, 0, 'solo con stems: nada'); assert.match(r.stems.empty, /Ninguna pista cumple/, 'y lo explica');
  assert.strictEqual(r.updated.rows.length, 3, 'se actualiza sola al cambiar un género');
  assert.ok(r.add.ok === false && /inteligente/.test(r.add.error), 'no se edita a mano'); assert.ok(!r.menu.includes(r.id) && r.menu.length >= 1, 'no aparece en «Añadir a playlist»');
  assert.deepStrictEqual(r.filter.genres, ['House']); assert.strictEqual(r.filter.analyzed, false);
  console.log('playlists smart: OK');
};

tests.export = async () => {
  const r = appResult().exp;
  assert.ok(r.imported.length === 1 && r.imported[0].btn, `importada con botón: ${JSON.stringify(r.imported)}`);
  assert.ok(r.crate.some((l) => l.name === 'Favoritas YT' && l.count === 2), `importada → local: ${JSON.stringify(r.crate)}`);
  assert.ok(r.crateBtn && !r.crateBtnList, 'el botón de copiar solo aparece en playlists importadas');
  assert.ok(/#EXTM3U/.test(r.ui_m3u8.text || '') && /Exportadas 2/.test(r.ui_m3u8.msg), `M3U8 desde la interfaz: ${JSON.stringify(r.ui_m3u8)}`); assert.ok(r.ui_csv.text && r.ui_csv.text.split('\n').length >= 3, 'CSV');
  const got = new Set([...(r.automix.queue || []), r.automix.cur, ...(r.automix.decks || [])]);
  assert.strictEqual(r.automix.tab, 'automix'); assert.ok(r.setIds.length >= 2 && r.setIds.every((id) => got.has(id)), `a AutoMix: ${JSON.stringify(r.automix)} vs ${JSON.stringify(r.setIds)}`);
  console.log('playlists export: OK');
};

tests.docs = async () => {
  const d = read('docs/03-libreria-y-playlists.md');
  for (const re of [/Mis listas/, /Quitar de la lista/, /Deshacer/, /Ctrl\+A/, /Ordenar por/, /arrastrar filas/, /inteligentes/, /Guardar como lista/, /M3U8/, /playlists-local\.json/, /Nunca tocan tus archivos/]) assert.match(d, re, `la guía menciona ${re}`);
  const html = read('renderer/index.html');
  for (const id of ['pl-new', 'pl-new-smart', 'pl-sources', 'pl-bar', 'sel-bar', 'pl-menu', 'btn-crate-pl', 'pl-order', 'pl-undo']) assert.ok(html.includes(`id="${id}"`), `control ${id}`);
  assert.match(html, /Mis listas/, 'la ayuda («?») lo explica');
  const inv = read('docs/inventario-controles.md'); for (const id of ['#pl-new', '#sel-bar', '#pl-menu', '#btn-crate-pl']) assert.ok(inv.includes(id), `inventario: ${id}`);
  assert.match(read('docs/README.md'), /tus propias listas/, 'índice');
  console.log('playlists docs: OK');
};

// Varios modos separados por coma comparten una sola ejecución de la app (más rápido en CI).
const modes = mode.split(',');
if (modes.some((m) => !tests[m])) { console.error(`uso: test-playlists.js ${Object.keys(tests).join('|')}`); process.exit(2); }
(async () => { for (const m of modes) await tests[m](); })().catch((e) => (console.error(e), process.exit(1)));
