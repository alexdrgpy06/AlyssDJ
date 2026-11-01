#!/usr/bin/env node
// Pruebas del cambio sin-video-fuentes-y-cola-analisis.  Uso: node scripts/test-sinvideo.js removed|source|backlog|queue-ui|views|immersive|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests.removed = async () => {
  // REQ-1: sin video en ningún punto
  for (const f of ['renderer/video.html', 'renderer/video.js', 'renderer/localvideo.js', 'preload/video-window.js', 'docs/05-video-y-segunda-pantalla.md', 'scripts/test-video-local.js', 'scripts/video-local-selftest.js']) assert.ok(!fs.existsSync(path.join(root, f)), `${f} debe borrarse`);
  const code = ['main/main.js', 'main/analyzer.js', 'main/ytdlp.js', 'main/library-save.js', 'main/ytm-library.js', 'preload/app.js', 'preload/deck.js', 'renderer/app.js', 'renderer/deck.js', 'renderer/index.html', 'renderer/styles.css'].map(read).join('\n');
  assert.ok(!/videoWin|layoutVideo|video:open|video:state|localvideo|downloadVideo|videoArgs|findVideo|saveVideo|videoMaxHeight|videoPref|VIDEO_CSS|setVideoView|preferVideo|video-panel|btn-video|vp-toggle|videoState/.test(code), 'quedan restos del video');
  assert.ok(!/class="pop"|i-popout|i-video/.test(read('renderer/index.html')), 'sin botón de video en el plato');
  // los ajustes antiguos se ignoran
  const fs2 = require('fs'); const os = require('os');
  const dir = fs2.mkdtempSync(path.join(os.tmpdir(), 'alyss-set-'));
  fs2.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ saveVideo: true, videoMaxHeight: 720, videoPref: true, keepAudio: true }));
  process.env.YTDJ_SETTINGS_DIR = dir;
  const S = require('../main/settings');
  const s = S.get();
  assert.ok(!('saveVideo' in s) && !('videoMaxHeight' in s) && !('videoPref' in s), 'ajustes de video ignorados');
  assert.strictEqual(s.keepAudio, true, 'el resto de ajustes se conserva');
  // el botón YTM de cada deck y el streaming se conservan
  assert.ok(/view-ytm/.test(read('renderer/index.html')) && /deck:show/.test(read('main/main.js')));
  // el analizador y yt-dlp siguen exportando lo de audio
  const L = require('../main/library-save'); const Y = require('../main/ytdlp');
  assert.ok(typeof L.findSaved === 'function' && typeof Y.downloadToLibrary === 'function' && typeof Y.download === 'function');
  console.log('removed: OK');
};

tests.source = async () => {
  const { resolveSource } = await import('../renderer/source.js');
  const yt = { videoId: 'abc' };
  // REQ-2: archivo local → siempre archivo, sin alternativa
  assert.deepStrictEqual(resolveSource({ track: { local: true } }), { source: 'file', origin: 'LOCAL', canSwitch: false, why: null, missing: false });
  // copia guardada: se usa sola con preferSaved; sin él, streaming; siempre conmutable
  const saved = { saved: { path: '/x', localId: 'L1' } };
  assert.strictEqual(resolveSource({ track: yt, analysis: saved }).source, 'file');
  assert.strictEqual(resolveSource({ track: yt, analysis: saved }).origin, 'GUARDADA');
  assert.strictEqual(resolveSource({ track: yt, analysis: saved, preferSaved: false }).source, 'stream');
  assert.ok(resolveSource({ track: yt, analysis: saved, preferSaved: false }).canSwitch);
  assert.strictEqual(resolveSource({ track: yt, analysis: saved, forced: 'stream' }).source, 'stream');
  assert.strictEqual(resolveSource({ track: yt, analysis: saved, preferSaved: false, forced: 'file' }).source, 'file');
  // audio de la caché: conmutable pero no se usa solo
  const cached = { audio: 'abc.m4a' };
  assert.strictEqual(resolveSource({ track: yt, analysis: cached }).source, 'stream');
  assert.ok(resolveSource({ track: yt, analysis: cached }).canSwitch);
  assert.strictEqual(resolveSource({ track: yt, analysis: cached, forced: 'file' }).source, 'file');
  // sin copia: streaming, no conmutable, con razón
  const none = resolveSource({ track: yt, analysis: { bpm: 120 } });
  assert.deepStrictEqual([none.source, none.origin, none.canSwitch, none.missing], ['stream', 'STREAM', false, false]);
  assert.ok(/Analiza la pista/.test(none.why));
  // la copia desapareció
  const gone = resolveSource({ track: yt, analysis: { savedMissing: true } });
  assert.deepStrictEqual([gone.source, gone.canSwitch, gone.missing], ['stream', false, true]);
  // el analizador marca savedMissing
  const { Analyzer } = require('../main/analyzer');
  const os = require('os'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-an-'));
  const an = new Analyzer({ cacheDir: dir, settings: { get: () => ({}) }, emit() {} });
  fs.writeFileSync(an.jsonPath('GONE0000001'), JSON.stringify({ id: 'GONE0000001', bpm: 120, saved: { path: path.join(dir, 'no-existe.m4a'), localId: 'L' } }));
  assert.strictEqual(an.get('GONE0000001').savedMissing, true);
  assert.strictEqual(an.get('GONE0000001').saved, undefined);
  fs.writeFileSync(an.jsonPath('HERE0000001'), JSON.stringify({ id: 'HERE0000001', bpm: 120, saved: { path: __filename, localId: 'L' } }));
  assert.strictEqual(an.get('HERE0000001').savedMissing, undefined);
  // ajuste y piezas de interfaz
  assert.strictEqual(require('../main/settings').get().preferSaved, true, 'preferSaved por defecto');
  assert.ok(/name="preferSaved"/.test(read('renderer/index.html')) && /resolveSource/.test(read('renderer/deck.js')) && /src-chip/.test(read('renderer/library.js')));
  // e2e en Electron
  const { spawnSync } = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-source-'));
  const music = path.join(tmp, 'music');
  const gen = spawnSync(process.execPath, [path.join(__dirname, 'make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), `sin audio de demostración: ${gen.stderr || gen.stdout}`);
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 150000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'source-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
  const f = path.join(tmp, 'source.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(r)) assert.ok(!(v && v.__err), `${k}: ${JSON.stringify(v)}`);
  assert.strictEqual(r.local.state, 'ARCHIVO LOCAL'); assert.strictEqual(r.local.source, 'local'); assert.deepStrictEqual(r.local.na, ['true', 'true']);
  assert.ok(['STREAM', 'cargando…'].includes(r.stream.state), `estado: ${r.stream.state}`); assert.strictEqual(r.stream.origin, 'STREAM'); assert.strictEqual(r.stream.source, 'stream'); assert.ok(/Analiza la pista/.test(r.stream.titles[1]), `razón visible: ${r.stream.titles}`);
  assert.strictEqual(r.afterSwitch, 'stream', 'sin alternativa no cambia');
  assert.ok(r.chips.length >= 1 && r.chips.every((c) => c === 'ARCHIVO'), `chips: ${r.chips}`);
  assert.strictEqual(r.pref, false);
  console.log('source: OK');
};

tests.backlog = async () => {
  const os = require('os');
  const { Backlog } = require('../main/analysis-backlog');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-bl-'));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mkAn = (done = new Set()) => ({ running: null, queue: [], asked: [], cancelled: [], get: (id) => (done.has(id) ? { id } : null), request(id, o) { this.running = { id }; this.asked.push({ id, o }); }, cancel(id) { this.cancelled.push(id); } });
  const tr = (id, extra = {}) => ({ videoId: id, title: `T ${id}`, artist: 'A', duration: 100, ...extra });
  const mk = (an, name, o = {}) => new Backlog({ analyzer: an, file: path.join(dir, name), saveMs: 5, notifyMs: 5, botError: 'BOT', ...o });
  const reply = async (bl, an, ev) => { an.running = null; bl.onAnalyzerEvent(ev); await wait(15); };

  // REQ-3: encola solo lo no analizado y sin duplicar; una a la vez
  const an = mkAn(new Set(['yaAnalizada']));
  const bl = mk(an, 'a.json');
  let r = bl.addList({ name: 'Playlist A', tracks: [tr('p1'), tr('p2'), tr('yaAnalizada'), tr('p1'), tr('p3')] });
  assert.deepStrictEqual([r.added, r.skipped], [3, 2]);
  assert.deepStrictEqual(an.asked.map((a) => a.id), ['p1'], 'pide solo una al analizador');
  assert.strictEqual(bl.state().pending, 3);
  assert.strictEqual(bl.addList({ name: 'Otra', tracks: [tr('p1'), tr('p2')] }).added, 0, 'lo ya en cola no se duplica');
  assert.strictEqual(bl.addList({ name: 'Carpeta', tracks: [tr('f1', { local: true, path: '/musica/f1.mp3' })] }).added, 1);
  bl.onAnalyzerEvent({ id: 'p1', stage: 'download', progress: 0.4 });
  assert.strictEqual(bl.state().items.find((i) => i.id === 'p1').progress, 0.4);
  await reply(bl, an, { id: 'p1', stage: 'done' });
  assert.deepStrictEqual(an.asked.map((a) => a.id), ['p1', 'p2'], 'sigue con la siguiente');
  // un error no detiene la cola
  await reply(bl, an, { id: 'p2', stage: 'error', error: 'sin audio' });
  assert.strictEqual(bl.state().items.find((i) => i.id === 'p2').state, 'error');
  assert.strictEqual(an.asked.at(-1).id, 'p3');
  await reply(bl, an, { id: 'p3', stage: 'done' });
  assert.strictEqual(an.asked.at(-1).id, 'f1');
  assert.strictEqual(an.asked.at(-1).o.file, '/musica/f1.mp3', 'archivo local: se analiza donde está');
  await reply(bl, an, { id: 'f1', stage: 'done' });
  const st = bl.state();
  assert.deepStrictEqual([st.pending, st.lists[0].total, st.lists[0].done, st.lists[0].error], [0, 3, 2, 1]);
  // reintentar errores y quitar terminadas
  bl.retry(st.lists[0].id); await wait(10);
  assert.strictEqual(an.asked.at(-1).id, 'p2');
  await reply(bl, an, { id: 'p2', stage: 'done' });
  bl.clearDone();
  assert.deepStrictEqual([bl.state().lists.length, bl.state().items.length], [0, 0]);

  // lo pedido a mano pasa primero: no se entrega nada mientras el analizador esté ocupado
  const an2 = mkAn(); an2.running = { id: 'manual' };
  const b2 = mk(an2, 'b.json');
  b2.addList({ name: 'L', tracks: [tr('m1')] });
  assert.strictEqual(an2.asked.length, 0, 'espera a que el analizador se libere');
  await reply(b2, an2, { id: 'manual', stage: 'done' });
  assert.deepStrictEqual(an2.asked.map((a) => a.id), ['m1']);

  // las pistas cargadas en un deck van primero
  const an3 = mkAn(); an3.running = { id: 'x' };
  const b3 = mk(an3, 'c.json');
  b3.addList({ name: 'L', tracks: [tr('n1'), tr('n2'), tr('n3')] });
  b3.setPriority(['n3']);
  await reply(b3, an3, { id: 'x', stage: 'done' });
  assert.strictEqual(an3.asked[0].id, 'n3');

  // pausa y reanudación
  const an4 = mkAn(); const b4 = mk(an4, 'd.json');
  b4.pause(); b4.addList({ name: 'L', tracks: [tr('q1'), tr('q2')] });
  assert.strictEqual(an4.asked.length, 0, 'en pausa no avanza');
  b4.resume();
  assert.strictEqual(an4.asked.length, 1);

  // bloqueo de bot: no avanza; un error de bot devuelve la pista a la cola y no la marca como fallida
  let blocked = false;
  const an5 = mkAn(); const b5 = mk(an5, 'e.json', { botBlocked: () => blocked });
  b5.addList({ name: 'L', tracks: [tr('b1'), tr('b2')] });
  blocked = true;
  await reply(b5, an5, { id: 'b1', stage: 'error', error: 'BOT' });
  assert.strictEqual(b5.state().items.find((i) => i.id === 'b1').state, 'queued', 'el bloqueo no es culpa de la pista');
  assert.strictEqual(an5.asked.length, 1, 'con el bloqueo activo no se pide nada más');
  assert.strictEqual(b5.state().botBlocked, true);
  blocked = false; b5.pump();
  assert.strictEqual(an5.asked.length, 2, 'al terminar el bloqueo reanuda');
  b5.flush();

  // cancelar una lista
  const an6 = mkAn(); const b6 = mk(an6, 'f.json');
  const l6 = b6.addList({ name: 'L', tracks: [tr('c1'), tr('c2')] });
  b6.cancelList(l6.listId);
  assert.deepStrictEqual(an6.cancelled, ['c1']); assert.strictEqual(b6.state().items.length, 0);

  // persistencia: sobrevive al reinicio y lo que estaba en curso vuelve a «en cola»
  const an7 = mkAn(); const b7 = mk(an7, 'g.json');
  b7.addList({ name: 'Guardada', tracks: [tr('s1'), tr('s2')] });
  b7.pause(); b7.flush();
  assert.ok(!fs.existsSync(path.join(dir, 'g.json.tmp')), 'escritura atómica: no queda el temporal');
  const an8 = mkAn(); const b8 = mk(an8, 'g.json');
  const s8 = b8.state();
  assert.deepStrictEqual([s8.paused, s8.lists[0].name, s8.items.map((i) => i.state)], [true, 'Guardada', ['queued', 'queued']]);
  b8.resume(); assert.strictEqual(an8.asked[0].id, 's1');
  // archivo dañado: cola vacía sin romper
  fs.writeFileSync(path.join(dir, 'h.json'), '{no es json');
  assert.strictEqual(mk(mkAn(), 'h.json').state().items.length, 0);
  // con el analizador real: eventos y estado «ya analizada» (get)
  assert.ok(/new Backlog/.test(read('main/main.js')) && /backlog:add/.test(read('main/main.js')) && /backlog:/.test(read('preload/app.js')), 'conectada en main y preload');
  console.log('backlog: OK');
};

tests['queue-ui'] = async () => {
  const html = read('renderer/index.html'); const lib = read('renderer/library.js');
  assert.ok(/data-tab="queue"/.test(html) && /id="cnt-queue"/.test(html) && /id="queue-view"/.test(html) && /id="btn-analyze-list"/.test(html), 'fuente, contador, vista y botón');
  assert.ok(/data-act="an-list"/.test(lib) && /analyzePlaylist/.test(lib) && /fillCrateCounts/.test(lib), 'botón Analizar por playlist y conteo en Importadas');
  assert.ok(/backlog\.setPriority/.test(read('renderer/app.js')), 'prioridad de los decks');
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-qui-')); const music = path.join(tmp, 'music');
  const gen = spawnSync(process.execPath, [path.join(__dirname, 'make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), `sin audio de demostración: ${gen.stderr || gen.stdout}`);
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'queue-ui-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music } });
  const f = path.join(tmp, 'queue-ui.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.QUEUE_UI_SHOT) fs.copyFileSync(path.join(tmp, 'queue.png'), process.env.QUEUE_UI_SHOT);
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(r)) assert.ok(!(v && v.__err), `${k}: ${JSON.stringify(v)}`);
  assert.strictEqual(r.btnVisible, true, '«Analizar lista» visible con pistas');
  assert.strictEqual(r.counter, '2', 'contador de pendientes');
  assert.deepStrictEqual([r.paused.cards, r.paused.items, r.paused.view, r.paused.table, r.paused.empty], [1, 2, true, true, true]);
  assert.ok(/en pausa/.test(r.paused.status) && r.paused.pauseBtn === 'Reanudar', `pausa visible: ${r.paused.status}`);
  assert.strictEqual(r.again.added, 0, 'no duplica');
  assert.deepStrictEqual([r.done.pending, r.done.done, r.done.total], [0, 2, 2], `terminó: ${JSON.stringify(r.done)}`);
  assert.strictEqual(r.done.card, '2/2'); assert.strictEqual(r.done.counter, '');
  assert.ok(r.analyzed >= 2, 'quedaron analizadas');
  assert.deepStrictEqual(r.cleared, { cards: 0, empty: true });
  console.log('queue-ui: OK');
};

tests.views = async () => {
  const { ViewState, VIEWS } = await import('../renderer/views.js');
  // REQ-5: máquina de estados
  assert.deepStrictEqual(VIEWS, ['mix', 'library', 'automix', 'waves']);
  let v = new ViewState({ view: 'basura', waves: 'x' });
  assert.deepStrictEqual([v.view, v.waves], ['mix', 'top'], 'valores guardados inválidos → por defecto');
  v = new ViewState({ view: 'waves', waves: 'deck' });
  assert.strictEqual(v.effectiveWaves(), 'top', 'en Ondas las ondas van arriba');
  v.set('library'); assert.strictEqual(v.effectiveWaves(), 'deck'); assert.ok(v.compact());
  v.set('mix'); assert.ok(!v.compact());
  // fuente AutoMix: Librería y vuelta a la anterior
  v = new ViewState({ view: 'mix' });
  v.enterAutomixTab(); assert.strictEqual(v.view, 'library');
  assert.strictEqual(v.toJSON().view, 'mix', 'no se guarda la vista temporal');
  v.leaveAutomixTab(); assert.strictEqual(v.view, 'mix');
  // si el usuario eligió otra vista dentro, se respeta
  v.enterAutomixTab(); v.set('waves'); v.leaveAutomixTab(); assert.strictEqual(v.view, 'waves');
  // elegir la misma vista Librería también cuenta como elección
  v = new ViewState({ view: 'waves' }); v.enterAutomixTab(); v.set('library'); v.leaveAutomixTab(); assert.strictEqual(v.view, 'library');
  // entrar dos veces no pisa la vista previa
  v = new ViewState({ view: 'waves' }); v.enterAutomixTab(); v.enterAutomixTab(); v.leaveAutomixTab(); assert.strictEqual(v.view, 'waves');
  assert.strictEqual(v.set('inexistente'), 'waves');
  // interfaz
  const html = read('renderer/index.html'); const css = read('renderer/styles.css'); const app = read('renderer/app.js');
  for (const k of ['data-view="mix"', 'data-view="library"', 'data-view="waves"', 'id="waves-toggle"', 'class="deck-scroll"', 'name="wavesMode"']) assert.ok(html.includes(k), k);
  assert.ok(/Digit\(\[1-4\]\)/.test(app) && /bindViews/.test(app) && !/syncCompact/.test(app), 'atajos Alt+1…4 y sin compactación por AutoMix activo');
  assert.ok(/body\[data-view='waves'\]/.test(css) && /body\[data-waves='deck'\]/.test(css));
  // e2e
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-views-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'views-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'views.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const flat = { ...r, ...Object.fromEntries(Object.entries(r.small).map(([k, x]) => [`small-${k}`, x])) };
  for (const [k, x] of Object.entries(flat)) assert.ok(!(x && x.__err), `${k}: ${JSON.stringify(x)}`);
  assert.deepStrictEqual([r.mix.view, r.mix.compact, r.mix.canvasIn], ['mix', false, 'wave-row']);
  assert.ok(r.mix.waveTop && r.mix.library && r.mix.console, 'Mezcla: ondas, consola y librería visibles');
  assert.deepStrictEqual([r.library.view, r.library.compact], ['library', true]);
  assert.ok(r.library.library.h > r.mix.library.h + 100, `Librería gana altura: ${r.library.library.h} vs ${r.mix.library.h}`);
  assert.deepStrictEqual([r.waves.view, r.waves.library], ['waves', null], 'Ondas oculta la librería');
  assert.ok(r.waves.waveTop.h > 300, `ondas grandes: ${r.waves.waveTop.h}`);
  assert.strictEqual(r.back.view, 'mix');
  assert.deepStrictEqual([r.deckWaves.waves, r.deckWaves.waveTop, r.deckWaves.canvasIn], ['deck', null, 'deck-scroll'], 'ondas en el deck: sin franja y el canvas dentro del deck');
  assert.ok(r.deckWaves.deckScroll && r.deckWaves.library.h > r.mix.library.h, 'la altura de la franja pasa a la librería');
  assert.strictEqual(r.wavesWithDeckOpt.waves, 'top', 'la vista Ondas ignora «en el deck»');
  assert.deepStrictEqual([r.topAgain.waves, r.topAgain.canvasIn], ['top', 'wave-row']);
  assert.deepStrictEqual([r.amIn.view, r.amOut.view, r.amChosen.view], ['library', 'mix', 'waves'], 'AutoMix: entra a Librería, vuelve, y respeta la elección');
  assert.deepStrictEqual(r.saved, { view: 'library', waves: 'deck' }, 'se recuerda');
  for (const [k, x] of Object.entries(r.small)) assert.ok(x.sw <= x.w + 1, `1366x768 ${k}: desplazamiento horizontal`);
  assert.ok(r.small.library.library.h >= 150 && r.small.mix.library.h >= 120, `1366x768: librería visible ${r.small.mix.library.h}/${r.small.library.library.h}`);
  console.log('views: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
