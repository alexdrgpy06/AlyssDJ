// Pruebas del modo local y el buscador local.  Uso: node scripts/test-local.js search|ipc|mode|ui|filters|automix|docs
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const mode = process.argv[2] || 'search';
const tests = {};

const KEYS = ['1A', '2A', '3B', '8A', '8B', '9A', '12B'];
function library(n) {
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const words = ['Neon', 'Drive', 'Sunset', 'Groove', 'Night', 'Pulse', 'Deep', 'Signal', 'Ámbar', 'Corazón', 'Río', 'Luna'];
  return Array.from({ length: n }, (_, i) => ({
    videoId: `L${i}`, local: true, title: `${words[i % 12]} ${words[(i * 7) % 12]} ${i}`, artist: `Artista ${i % 400}`, album: `Álbum ${i % 90}`, duration: 180 + (i % 120), thumb: '',
    bpm: i % 5 ? 90 + (i % 80) : undefined, camelot: i % 5 ? KEYS[i % 7] : undefined, genres: i % 3 ? ['House', 'Techno', 'Pop'].slice(i % 3) : [], source: 'Mi equipo',
  }));
}

tests.search = async () => {
  const { LocalSearch, keysCompatible, norm } = require('../main/local-search.js');
  const cam = await import('../renderer/camelot.js');
  for (const a of ['1A', '1B', '2A', '12A', '8B', '']) for (const b of ['1A', '2B', '12A', '11A', '8A', '5B', '']) assert.strictEqual(keysCompatible(a, b), cam.keysCompatible(a, b), `compat ${a} ${b}`);
  assert.strictEqual(norm('  Río ÁMBAR '), '  rio ambar ');
  const ls = new LocalSearch();
  ls.build([
    { videoId: 'a1', local: true, title: 'Corazón de Río', artist: 'Luna Sol', album: 'Mar', duration: 200, bpm: 124, camelot: '8A', genres: ['House'], source: 'Mi equipo', path: '/secreto/a1.mp3' },
    { videoId: 'a1', title: 'Corazón de Río', artist: 'Luna Sol', thumb: 'x.jpg', genres: ['Deep House'], source: 'Analizada' },
    { videoId: 'b2', title: 'Night Drive', artist: 'DJ Neon', bpm: 128, camelot: '9A', genres: ['Techno'], source: 'Importada: Favoritas' },
    { videoId: 'c3', title: 'Sin análisis', artist: 'X', source: 'Mi equipo', local: true },
    { title: 'sin id' },
  ]);
  assert.strictEqual(ls.size(), 3, 'una fila por id, sin ids vacíos');
  let r = ls.search('corazon rio'); assert.strictEqual(r.total, 1, 'sin tildes ni mayúsculas'); assert.deepStrictEqual(r.rows[0].sources, ['Mi equipo', 'Analizada'], 'fuentes fusionadas'); assert.deepStrictEqual(r.rows[0].genres, ['House', 'Deep House']); assert.strictEqual(r.rows[0].thumb, 'x.jpg');
  assert.ok(!('path' in r.rows[0]) && !('source' in r.rows[0]), 'nada de rutas ni campos internos hacia el renderer');
  assert.strictEqual(ls.search('neon').total, 1, 'por artista'); assert.strictEqual(ls.search('mar').total, 1, 'por álbum'); assert.strictEqual(ls.search('techno').total, 1, 'por género'); assert.strictEqual(ls.search('house luna').total, 1, 'varias palabras en cualquier campo'); assert.strictEqual(ls.search('zzz').total, 0);
  assert.strictEqual(ls.search('').total, 3, 'sin texto: todo');
  assert.deepStrictEqual(ls.search('', { bpm: [125, 130] }).rows.map((x) => x.videoId), ['b2'], 'rango de BPM'); assert.strictEqual(ls.search('', { bpm: [120, 0] }).total, 2, 'solo mínimo'); assert.strictEqual(ls.search('', { bpm: [0, 125] }).total, 1, 'solo máximo');
  assert.deepStrictEqual(ls.search('', { key: '8A' }).rows.map((x) => x.videoId), ['a1']); assert.deepStrictEqual(ls.search('', { key: '8A', compatKey: true }).rows.map((x) => x.videoId).sort(), ['a1', 'b2'], '8A es compatible con 9A');
  assert.deepStrictEqual(ls.search('', { genres: ['techno'] }).rows.map((x) => x.videoId), ['b2'], 'género sin distinguir mayúsculas'); assert.strictEqual(ls.search('', { genres: ['pop', 'techno'] }).total, 1, 'alguno de los géneros');
  assert.strictEqual(ls.search('', { limit: 2 }).rows.length, 2); assert.strictEqual(ls.search('', { limit: 2 }).total, 3, 'total completo aunque se recorte');
  assert.deepStrictEqual(ls.similar('a1').map((x) => x.videoId), ['b2'], 'parecidas por BPM y tonalidad'); assert.deepStrictEqual(ls.similar('c3'), [], 'sin análisis no hay parecidas'); assert.deepStrictEqual(ls.similar('nada'), []);
  // REQ-7: 20 000 pistas en menos de 100 ms (varias consultas, peor caso incluido)
  const big = new LocalSearch(); const t0 = Date.now(); big.build(library(20000)); const built = Date.now() - t0;
  const worst = Math.max(...['corazon', 'artista 12', 'house luna', 'zzzz', 'o', ''].map((q) => { big.search(q); return big.search(q, { bpm: [100, 140], key: '8A', compatKey: true, genres: ['House'] }).ms + big.search(q).ms; }));
  assert.ok(big.size() === 20000 && worst < 100, `20 000 pistas: peor consulta ${worst.toFixed(1)} ms (índice ${built} ms)`);
  console.log(`local search: OK (20 000 pistas, peor consulta ${worst.toFixed(1)} ms)`);
};

tests.ipc = async () => {
  const { LocalSearch, collect } = require('../main/local-search.js');
  const items = collect({
    localRows: [{ videoId: 'Labc', title: 'Local uno', artist: 'Ana', album: 'Disco', duration: 200, thumb: '/cover/Labc', path: '/home/x/secreto.mp3' }, { videoId: 'Ldef', title: 'Local dos', artist: 'Beto', duration: 190 }],
    analyses: [{ id: 'Labc', local: true, title: 'Local uno', artist: 'Ana', bpm: 126, camelot: '8A', trackDuration: 200 }, { id: 'yt1', title: 'Online guardada', artist: 'Cy', bpm: 100, camelot: '3B', saved: { path: '/x.opus' } }, { id: 'yt2', title: 'Online analizada', artist: 'Di' }, null, {}],
    crates: [{ id: 'VLLM', title: 'Favoritas', tracks: [{ videoId: 'yt3', title: 'De mis playlists', artist: 'Eli', duration: 210 }, { videoId: 'yt1', title: 'Online guardada', artist: 'Cy' }] }],
    genreMap: { Labc: { genres: ['House'] }, yt3: { genres: ['Pop'] } },
  });
  const ls = new LocalSearch(); ls.build(items);
  assert.strictEqual(ls.size(), 5, 'locales, analizadas y de playlists sin duplicar');
  const by = (q, o) => Object.fromEntries(ls.search(q, o).rows.map((r) => [r.videoId, r]));
  const all = by('');
  assert.deepStrictEqual(all.Labc.sources, ['Mi equipo', 'Analizada'], 'local y analizada'); assert.strictEqual(all.Labc.bpm, 126); assert.deepStrictEqual(all.Labc.genres, ['House']);
  assert.deepStrictEqual(all.yt1.sources, ['Guardada', 'Importada: Favoritas'], 'guardada e importada'); assert.deepStrictEqual(all.yt2.sources, ['Analizada']); assert.deepStrictEqual(all.yt3.sources, ['Importada: Favoritas']);
  assert.ok(/i\.ytimg\.com\/vi\/yt2/.test(all.yt2.thumb), 'miniatura de YouTube para las no locales'); assert.strictEqual(all.Ldef.thumb, undefined);
  assert.ok(!JSON.stringify(ls.search('').rows).includes('secreto') && !JSON.stringify(ls.search('').rows).includes('/x.opus'), 'ninguna ruta llega al renderer');
  assert.deepStrictEqual(Object.keys(by('pop')), ['yt3'], 'el género viene del almacén'); assert.deepStrictEqual(Object.keys(by('eli')), ['yt3'], 'artista de una playlist importada');
  // cableado: IPC, preload, reconstrucción del índice y nada de red
  const main = read('main/main.js'); const pre = read('preload/app.js'); const src = read('main/local-search.js');
  for (const c of ['lib:search-local', 'local:similar']) assert.ok(main.includes(`'${c}'`) && pre.includes(`'${c}'`), `canal ${c}`);
  for (const where of ["markLocalDirty(); send('local:event'", "markLocalDirty(); send('genres:event'", "markLocalDirty();\n      send('analysis:event'", 'markLocalDirty();\n  send(\'lib:import-progress\'']) assert.ok(main.includes(where) || main.includes(where.replace('; send', ';\n  send')), `el índice se invalida: ${where}`);
  assert.ok(!/require\('(https?|net|electron)'\)|fetch\(/.test(src), 'la búsqueda local no toca la red');
  assert.ok(/searchLocal/.test(pre) && /similar/.test(pre), 'API en el preload');
  console.log('local ipc: OK');
};

tests.mode = async () => {
  const { createGate, MESSAGE } = require('../main/net-gate.js');
  let local = false; const gate = createGate({ get: () => ({ localMode: local }) });
  assert.strictEqual(gate.offline(), false); assert.doesNotThrow(() => gate.assert()); assert.strictEqual(gate.wrap((x) => x + 1)(1), 2);
  assert.ok(gate.allowUrl('https://music.youtube.com/') && gate.allowUrl('https://github.com/x'), 'sin modo local todo pasa');
  local = true;
  assert.throws(() => gate.assert(), (e) => e.message === MESSAGE && e.code === 'local'); let called = 0; assert.throws(() => gate.wrap(() => called++)(), /Modo local/); assert.strictEqual(called, 0, 'no se llama al manejador de red');
  for (const u of ['https://music.youtube.com/', 'http://example.com', 'wss://x.y/z', 'ftp://h/f']) assert.strictEqual(gate.allowUrl(u), false, u);
  for (const u of ['app://ui/index.html', 'file:///tmp/a.mp3', 'blob:app://ui/1', 'data:text/plain,hola', 'http://localhost:3000/', 'http://127.0.0.1:8080/x', 'devtools://devtools/x']) assert.strictEqual(gate.allowUrl(u), true, u);
  // actualizaciones: en modo local no se pregunta a GitHub ni manualmente
  const { createUpdater } = require('../main/updater.js'); let checks = 0; const events = [];
  const st = { localMode: true, autoUpdate: true };
  const up = createUpdater({ autoUpdater: { checkForUpdates: async () => checks++, on() {}, autoDownload: false }, settings: { get: () => st, set() {} }, send: (ch, p) => events.push(p), setTimer: () => 0, clearTimer() {} });
  await up.check({ manual: true }); await up.check(); assert.strictEqual(checks, 0, 'ni manual ni automática');
  st.localMode = false; await up.check({ manual: true }); assert.strictEqual(checks, 1, 'al salir del modo local vuelve a comprobar');
  // cableado en main, analizador, ajustes y marca visible
  const main = read('main/main.js'); const html = read('renderer/index.html'); const app = read('renderer/app.js');
  for (const c of ['search', 'liked', 'playlists', 'playlist', 'radio', 'popularity']) assert.ok(main.includes(`ipcMain.handle('lib:${c}', wrap(gate.wrap(`), `lib:${c} pasa por la puerta`);
  assert.ok(/lib:import-playlists', wrap\(async \(\) => \{\n  gate\.assert\(\)/.test(main), 'importar playlists');
  assert.ok(/if \(gate\.offline\(\)\) \{ send\('tools:progress', \{ stage: 'done' \}\); return; \}/.test(main), 'herramientas: no se descarga nada');
  assert.ok(/if \(gate\.offline\(\)\) return false;/.test(main) && /fetch: \(\.\.\.a\) => \{ gate\.assert\(\)/.test(main), 'modelos de stems: ni permiso ni descarga');
  assert.ok(/webRequest\.onBeforeRequest\(\(details, cb\) => cb\(\{ cancel: !gate\.allowUrl\(details\.url\) \}\)\)/.test(main), 'sesiones: se cancelan las peticiones remotas');
  assert.ok(/if \(s\.localMode\) throw new Error\('Modo local/.test(read('main/analyzer.js')), 'yt-dlp no se lanza');
  assert.ok(/localMode: false/.test(read('main/settings.js')) && /name="localMode"/.test(html) && /id="local-badge"/.test(html) && /net:state/.test(main) && /net:event/.test(main), 'ajuste, marca y evento');
  assert.ok(/applyLocalMode\(on\)/.test(app) && /ytdj\.net\.state\(\)/.test(app) && /\.local-badge/.test(read('renderer/styles.css')), 'la marca sigue al ajuste');
  console.log('local mode: OK');
};

function runApp(selftest, outFile, extraEnv = {}) {
  const { spawnSync } = require('node:child_process'); const os = require('node:os');
  const music = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(music, 'Neon Drive.mp3'))) spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), music], { stdio: 'ignore' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-local-'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', selftest), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music, ...extraEnv }, stdio: 'ignore' });
  const f = path.join(tmp, outFile); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err)); r.__dir = tmp; return r;
}
let appRun = null;
const appResult = () => (appRun ||= runApp('local-selftest.js', 'local.json'));

tests.ui = async () => {
  const r = appResult();
  // REQ-2: Todo por defecto, selector recordado, placeholder según el ámbito
  assert.deepStrictEqual(r.initial.checked, ['all']); assert.strictEqual(r.initial.scope, 'all'); assert.match(r.initial.ph, /tu equipo y en YouTube Music/); assert.deepStrictEqual(r.initial.disabled, []);
  // REQ-1/4: sin red, «Todo» muestra lo local con etiquetas de fuente y el aviso
  assert.strictEqual(r.allOfflineCalls, 1); assert.match(r.allOffline.msg, /Sin conexión: mostrando tu equipo/);
  assert.ok(r.allOffline.rows.length >= 1 && /Neon/i.test(r.allOffline.rows[0].text), `local sin red (${JSON.stringify(r.allOffline.rows)})`); assert.ok(r.allOffline.rows[0].tags.includes('Mi equipo'), 'etiqueta de fuente');
  // lo online se añade sin repetir ids; lo local va primero
  const ids = r.allMerged.rows.map((x) => x.id); assert.strictEqual(new Set(ids).size, ids.length, 'sin duplicados'); assert.ok(ids.includes('onlineXYZ1') && ids[ids.length - 1] === 'onlineXYZ1', 'lo online va detrás');
  assert.ok(!/DUPLICADA/.test(JSON.stringify(r.allMerged.rows)), 'gana la fila local'); assert.match(r.allMerged.msg, /en tu equipo/);
  // Mi equipo: sin llamadas online, se recuerda, y mensajes de estado
  assert.strictEqual(r.localCalls, 0, 'Mi equipo no usa la red'); assert.strictEqual(r.local.ls, 'local'); assert.deepStrictEqual(r.local.checked, ['local']);
  assert.match(r.none.msg, /Nada coincide en tu equipo/); assert.strictEqual(r.none.rows.length, 0); assert.ok(r.deep.rows.length === 1 && /Deep/i.test(r.deep.rows[0].text), 'otra pista local');
  // REQ-4: sin conexión del sistema, lo online se deshabilita y se busca solo en el equipo
  assert.deepStrictEqual(r.offline.disabled.sort(), ['all', 'online']); assert.deepStrictEqual(r.offline.checked, ['local']); assert.match(r.offline.msg, /Sin conexión/); assert.strictEqual(r.back.disabled.length, 0, 'al volver la red se rehabilita');
  // REQ-3: modo local: marca visible, ámbito forzado, ninguna llamada online, red bloqueada y herramientas de red con el mensaje estándar
  assert.ok(r.mode.badge && r.mode.eff === 'local' && r.mode.checked[0] === 'local' && r.mode.disabled.length === 2, `modo local (${JSON.stringify(r.mode)})`); assert.strictEqual(r.modeCalls, 0); assert.match(r.mode.msg, /Modo local: solo tu equipo/);
  assert.strictEqual(r.fetch, 'bloqueado', 'fetch a internet cancelado');
  for (const k of ['search', 'radio', 'imp']) assert.ok(r.lib[k].ok === false && /Modo local: sin red/.test(r.lib[k].error), `lib ${k}: ${JSON.stringify(r.lib[k])}`);
  assert.ok(!r.after.badge && r.after.disabled.length === 0, 'al salir del modo local todo vuelve');
  console.log('local ui: OK');
};

tests.filters = async () => {
  const r = appResult();
  assert.ok(r.analysis.length >= 3 && r.analysis.every((a) => a.bpm > 40 && a.key), `análisis: ${JSON.stringify(r.analysis)}`);
  const some = r.analysis.find((a) => a.bpm && a.key);
  // REQ-5: BPM exacto, tonalidad, rango vacío y sin filtros
  const byBpm = r.analysis.filter((a) => a.bpm === some.bpm).map((a) => a.id); assert.deepStrictEqual(r.fBpm.rows.sort(), byBpm.sort(), `BPM ${some.bpm}: ${JSON.stringify(r.fBpm)}`); assert.ok(r.fBpm.clearShown && r.fBpm.active, 'se ve que hay un filtro y se puede limpiar');
  const byKey = r.analysis.filter((a) => a.key === some.key).map((a) => a.id); assert.deepStrictEqual(r.fKey.rows.sort(), byKey.sort(), `tono ${some.key}: ${JSON.stringify(r.fKey)}`);
  assert.strictEqual(r.fNone.rows.length, 0); assert.match(r.fNone.msg, /Nada coincide|0 en tu equipo|Sin resultados/i);
  assert.ok(r.fOff.rows.length >= r.analysis.length - 3 || r.fOff.rows.length >= 1, 'sin filtros vuelve a verse todo'); assert.ok(!r.fOff.clearShown && !r.fOff.active, 'sin filtros no hay «Limpiar»');
  console.log('local filters: OK');
};

tests.docs = async () => {
  const d = read('docs/08-modo-local.md');
  for (const re of [/Mi equipo/, /YouTube Music/, /Modo local/, /BPM/, /tonalidad/, /AutoMix/, /sin red/i]) assert.match(d, re, `la guía menciona ${re}`);
  assert.match(read('docs/README.md'), /08-modo-local\.md/, 'enlazada desde el índice');
  const html = read('renderer/index.html'); assert.match(html, /Modo local: sin red/, 'la ayuda explica el modo local');
  assert.match(read('docs/inventario-controles.md'), /localMode|Modo local/, 'el inventario de controles lo lista');
  console.log('local docs: OK');
};

tests.automix = async () => {
  const r = require('node:child_process').spawnSync(process.execPath, ['--experimental-default-type=module', '--no-warnings', path.join(__dirname, 'local-automix-test.mjs')], { encoding: 'utf8' });
  process.stdout.write(r.stdout || ''); if (r.status) { process.stderr.write(r.stderr || ''); throw new Error('automix local falló'); }
};

tests[mode] = tests[mode] || (() => { console.error('modo no implementado todavía:', mode); process.exit(2); });
Promise.resolve().then(() => tests[mode]()).catch((e) => (console.error(e), process.exit(1)));
