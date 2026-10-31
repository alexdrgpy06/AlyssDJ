#!/usr/bin/env node
// Pruebas de buscar y agregar desde AutoMix, popularidad e inserción óptima.
//   node --experimental-default-type=module scripts/test-automix-add.js popularity|insert|e2e
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = process.argv[2];
const tests = {};
const M = await import('../renderer/mixplan.js');
const { parsePlays, parseSongs, parseRadio } = require('../main/ytm-library');

// ---------- entorno simulado del motor ----------
const listeners = []; const requests = []; const net = { radio: [], plays: {}, popDelay: 0, library: [] };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async () => null, request: (id, o) => requests.push([id, o]), list: async () => net.library },
  lib: { radio: async () => ({ ok: true, data: net.radio }), search: async () => ({ ok: true, data: [] }), popularity: async (ids) => { if (net.popDelay) await new Promise((r) => setTimeout(r, net.popDelay)); return { ok: true, data: Object.fromEntries(ids.map((i) => [i, net.plays[i] || 0])) }; } } } };
const { AutoMix } = await import('../renderer/automix.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fakeDeck(id) {
  return { id, track: null, pos: 0, pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, wantPlay: false, st: { playing: false, dur: 0, ready: false, videoId: null },
    async load(t) { this.track = t; this.st = { playing: false, dur: 240, ready: true, videoId: t.videoId }; }, togglePlay() {}, remaining() { return this.st.dur - this.pos; }, bpm() { return this.analysis?.bpm || null; },
    setLoop() {}, matchTempoSmart: () => true, alignPhase() {}, phaseDiff: () => null, setPitch() {}, analyze() {}, seek() {}, transport() {} };
}
function engine({ curBpm = 124 } = {}) {
  listeners.length = 0; requests.length = 0; net.radio = []; net.plays = {}; net.popDelay = 0; net.library = [];
  const A = fakeDeck('A'), B = fakeDeck('B'); const toasts = [];
  const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast: (m) => toasts.push(m), xfader: { value: -1 }, applyXf() {} };
  const am = new AutoMix(app); am.cfg.endless = true;
  A.track = { videoId: 'CUR', title: 'CUR', artist: 'Daft Punk' }; A.analysis = ana(curBpm, '8A'); A.st = { playing: true, dur: 240, ready: true, videoId: 'CUR' }; A.pos = 30;
  am.ana.set('CUR', A.analysis); am.on = true; am.cur = A;
  return { am, A, B, toasts };
}
const ev = (e) => listeners.forEach((l) => l(e));
const done = (id, a) => ev({ id, stage: 'done', analysis: { id, duration: 240, offset: 0, mix: { mixIn: 8, mixOut: [{ t: 200 }], phrases: new Array(20).fill(60), phraseBeats: 16 }, ...a } });

const ana = (bpm, camelot = '8A', energy = 60) => ({ bpm, camelot, offset: 0, duration: 240, mix: { mixIn: 8, mixOut: [{ t: 200, score: 1 }], phrases: new Array(20).fill(energy), phraseBeats: 16 } });
const T = (id, o = {}) => ({ videoId: id, title: id, artist: 'x', ...o });

tests.popularity = async () => {
  // REQ-7: parseo de las reproducciones tal como las muestra YouTube Music (es/en)
  for (const [txt, n] of [['856 M reproducciones', 856e6], ['135 k reproducciones', 135e3], ['1,2 B reproducciones', 1.2e9], ['34.861.726 visualizaciones', 34861726], ['2.3M views', 2.3e6], ['1.2B plays', 1.2e9], ['12 mil reproducciones', 12e3], ['3 millones reproducciones', 3e6], ['5 reproducciones', 5], ['26 M de vistas', 26e6], ['1,5 M de visualizaciones', 1.5e6], ['Daft Punk', 0], ['3:25', 0], ['', 0]]) assert.strictEqual(parsePlays(txt), n, `«${txt}»`);
  // la búsqueda trae las reproducciones en la 3.ª columna y ya no se confunde con el álbum
  const col = (t) => ({ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: t }] } } });
  const item = (id, plays) => ({ musicResponsiveListItemRenderer: { playlistItemData: { videoId: id }, flexColumns: [col('Tema ' + id), col('Artista'), col(plays)], fixedColumns: [{ musicResponsiveListItemFixedColumnRenderer: { text: { runs: [{ text: '3:25' }] } } }] } });
  const songs = parseSongs({ contents: [item('AAAAAAAAAAA', '856 M reproducciones'), item('BBBBBBBBBBB', 'Álbum Bueno')] });
  assert.strictEqual(songs[0].plays, 856e6); assert.strictEqual(songs[0].album, '', 'las reproducciones no son el álbum');
  assert.strictEqual(songs[1].plays, 0); assert.strictEqual(songs[1].album, 'Álbum Bueno');
  // la radio trae álbum y año del renglón de créditos
  const radio = parseRadio({ x: { playlistPanelVideoRenderer: { videoId: 'RRRRRRRRRRR', title: { runs: [{ text: 'Tema' }] }, longBylineText: { runs: [{ text: 'Daft Punk' }, { text: ' • ' }, { text: 'Discovery' }, { text: ' • ' }, { text: '2001' }] }, lengthText: { runs: [{ text: '3:20' }] } } } });
  assert.strictEqual(radio[0].year, 2001); assert.strictEqual(radio[0].album, 'Discovery');
  // y algunos temas de la radio (videos) traen las vistas en el renglón de créditos: no son el álbum
  const radio2 = parseRadio({ x: { playlistPanelVideoRenderer: { videoId: 'VVVVVVVVVVV', title: { runs: [{ text: 'Video' }] }, longBylineText: { runs: [{ text: 'Faul & Wad' }, { text: ' • ' }, { text: '26 M de vistas' }, { text: ' • ' }, { text: '2014' }] }, lengthText: { runs: [{ text: '3:20' }] } } } });
  assert.strictEqual(radio2[0].plays, 26e6); assert.strictEqual(radio2[0].album, ''); assert.strictEqual(radio2[0].year, 2014);
  // popScore: escala logarítmica
  assert.strictEqual(M.popScore(0), 0); assert.strictEqual(M.popScore(1e5), 0); assert.ok(Math.abs(M.popScore(1e9) - 1) < 1e-9); assert.ok(M.popScore(1e7) > M.popScore(1e6));
  const ref = ana(124, '8A');
  const rank = (cands, o = {}) => M.rankCandidates({ ref, cands, ...o }).map((c) => c.track.videoId);
  // REQ-6: entre candidatas de mezcla comparable, gana la más popular
  assert.deepStrictEqual(rank([{ track: T('rara', { plays: 2e4 }), analysis: ana(124, '8A') }, { track: T('hit', { plays: 9e8 }), analysis: ana(124, '8A') }, { track: T('media', { plays: 3e6 }), analysis: ana(124, '8A') }]), ['hit', 'media', 'rara']);
  // …pero una popular que NO encaja (salto de BPM > 8 % o clave incompatible) nunca va delante de una que sí encaja
  const r2 = rank([{ track: T('hit-salto', { plays: 2e9 }), analysis: ana(150, '8A') }, { track: T('hit-clave', { plays: 2e9 }), analysis: ana(124, '3B') }, { track: T('encaja', { plays: 1e3 }), analysis: ana(125, '9A') }]);
  assert.strictEqual(r2[0], 'encaja'); assert.deepStrictEqual(r2.slice(1).sort(), ['hit-clave', 'hit-salto']);
  // BPM y tonalidad siguen mandando entre las que encajan: un hit con BPM más lejano pierde contra una media mucho más cercana si el peso es bajo
  assert.strictEqual(rank([{ track: T('cercana', { plays: 1e6 }), analysis: ana(124, '8A') }, { track: T('hit-lejos', { plays: 1e9 }), analysis: ana(130, '10A') }], { popWeight: 'low' })[0], 'cercana');
  // el peso Mucho favorece más a la popular que Poco
  const spread = (w) => { const r = M.rankCandidates({ ref, cands: [{ track: T('a', { plays: 1e9 }), analysis: ana(128, '8A') }, { track: T('b', { plays: 1e5 }), analysis: ana(124, '8A') }], popWeight: w }); return r.find((x) => x.track.videoId === 'a').score - r.find((x) => x.track.videoId === 'b').score; };
  assert.ok(spread('high') < spread('mid') && spread('mid') < spread('low'));
  // «Priorizar lo popular» apagado: la popularidad no cuenta
  assert.strictEqual(M.rankCandidates({ ref, cands: [{ track: T('a', { plays: 9e9 }), analysis: ana(124, '8A') }], popularity: false })[0].popBonus, 0);
  // estilo: la de la radio de la semilla y del mismo artista/año cercano puntúan mejor; sin análisis no se castiga ni premia por coste
  const st = M.rankCandidates({ ref, refTrack: { artist: 'Daft Punk', year: 2001 }, cands: [{ track: T('radio', { fromRadio: true, artist: 'Otro', year: 1990 }), analysis: ana(124, '8A') }, { track: T('mismo', { artist: 'Daft Punk', year: 2003 }), analysis: ana(124, '8A') }, { track: T('nada', { artist: 'Zeta', year: 2020 }), analysis: ana(124, '8A') }] });
  assert.strictEqual(st.at(-1).track.videoId, 'nada'); assert.ok(st[0].style > st.at(-1).style);
  const un = M.rankCandidates({ ref, cands: [{ track: T('sin-analizar', { plays: 5e8 }) }, { track: T('analizada', { plays: 1e3 }), analysis: ana(124, '8A') }] });
  assert.ok(un.every((x) => x.fits), 'sin análisis se asume que encaja');
  console.log('automix-add popularity: OK');
};

function* perms(a, k = 0) { if (k === a.length) return yield a.slice(); for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* perms(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } }
const chainCost = (cur, list, by) => { let c = list.length && cur ? M.edgeCost(cur, by[list[0]]) : 0; for (let i = 1; i < list.length; i++) c += M.edgeCost(by[list[i - 1]], by[list[i]]); return c; };

tests.insert = async () => {
  const cur = ana(124, '8A');
  const by = { a: ana(122, '8A'), b: ana(126, '9A'), c: ana(130, '9A'), d: ana(135, '10A'), n: ana(128, '9A') };
  const queue = ['a', 'b', 'c', 'd'].map((id) => T(id));
  const r = M.bestInsertion({ cur, queue, track: T('n'), analysisOf: (t) => by[t.videoId] });
  // REQ-3: es el hueco de menor coste total frente a probar todos
  let opt = Infinity, optK = -1;
  for (let k = 0; k <= queue.length; k++) { const l = queue.map((t) => t.videoId); l.splice(k, 0, 'n'); const c = chainCost(cur, l, by); if (c < opt) ((opt = c), (optK = k)); }
  assert.strictEqual(r.index, optK, `hueco ${r.index} vs óptimo ${optK}`);
  // no muta la cola; sin análisis va al final y sin coste
  assert.deepStrictEqual(queue.map((t) => t.videoId), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(M.bestInsertion({ cur, queue, track: T('zz'), analysisOf: (t) => by[t.videoId] }), { index: 4, delta: null });
  // lo precargado (lock) no se desplaza: nunca en los primeros huecos
  assert.ok(M.bestInsertion({ cur, queue, track: T('n'), analysisOf: (t) => by[t.videoId], lock: 2 }).index >= 2);
  console.log('automix-add insert (puro): OK');
};

tests.e2e = async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const music = path.join(root, 'docs/demo-audio');
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), 'falta el audio de demostración: node scripts/make-demo-audio.js docs/demo-audio');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-add-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 240000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/automix-add-selftest.js'), YTDJ_USERDATA: path.join(out, 'data'), YTDJ_DOCS_MUSIC: music, YTDJ_SELFTEST_OUT: out } });
  const f = path.join(out, 'add.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.ADD_SHOTS) for (const n of ['add-search.png', 'add-suggest.png']) fs.copyFileSync(path.join(out, n), path.join(process.env.ADD_SHOTS, n));
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of ['search', 'search2', 'addLib', 'dup', 'enter', 'suggest', 'pop']) assert.ok(!r[k]?.__err, `${k}: ${JSON.stringify(r[k])}`);
  // REQ-1: resultados de la librería y de YouTube Music sin salir de la vista
  assert.strictEqual(r.search.hidden, false);
  assert.ok(r.search.rows.some((x) => x.title === 'Neon Drive' && /Librería/.test(x.sub)), `librería: ${JSON.stringify(r.search.rows)}`);
  assert.ok(r.search2.rows.length >= 3 && r.search2.rows.some((x) => /YouTube Music/.test(x.src)), 'resultados de YouTube Music');
  // REQ-7: reproducciones visibles («856 M»)
  assert.ok(r.search2.rows.some((x) => /^▶ \d/.test(x.plays)), `reproducciones: ${JSON.stringify(r.search2.rows.map((x) => x.plays))}`);
  // REQ-3: la de la librería (analizada) dice su posición y se coloca en su mejor lugar con aviso
  assert.match(r.addLib.hint, /→ posición \d/);
  assert.ok(r.addLib.queue.includes('Deep Signal'));
  assert.match(r.addLib.note, /quedó en la posición \d de \d/);
  // sin duplicados
  assert.strictEqual(r.dup.reason, 'dup'); assert.ok(r.dup.same);
  // Enter agrega la primera
  assert.ok(r.enter.has && r.enter.after === r.enter.before + 1, JSON.stringify(r.enter));
  // REQ-5: sugeridas visibles, con reproducciones y las sin analizar marcadas
  assert.ok(r.suggest.n >= 1 && r.suggest.hidden === false, JSON.stringify(r.suggest));
  // popularidad: se puede apagar
  assert.strictEqual(r.pop.before.checked, true); assert.strictEqual(r.pop.after.checked, false); assert.strictEqual(r.pop.after.disabled, true); assert.strictEqual(r.pop.after.cfg, false);
  console.log('automix-add e2e: OK', JSON.stringify({ sugeridas: r.suggest.rows.map((x) => `${x.t} ${x.plays}`).slice(0, 3) }));
};

// Con YouTube Music de verdad (necesita internet): reproducciones en la búsqueda y por el endpoint de la pista, con caché.
tests.live = async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-pop-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/popularity-live-selftest.js'), YTDJ_USERDATA: path.join(out, 'data'), YTDJ_SELFTEST_OUT: out } });
  const r = JSON.parse(fs.readFileSync(path.join(out, 'pop-live.json'), 'utf8'));
  assert.ok(r.plays.length >= 3 && r.plays.some((p) => p.plays > 1e6), `la búsqueda trae reproducciones: ${JSON.stringify(r.plays)}`);
  assert.ok(r.plays.every((p) => !/reproduc/i.test(p.album)), 'las reproducciones no se cuelan como álbum');
  assert.ok(r.pop.ok && r.pop2.ok);
  const ids = Object.keys(r.pop.data);
  assert.ok(ids.length >= 3 && ids.some((i) => r.pop.data[i] > 1e6), `el endpoint de la pista da vistas: ${JSON.stringify(r.pop)}`);
  assert.deepStrictEqual(r.pop2.data, r.pop.data, 'la segunda consulta sale de la caché');
  assert.ok(r.ms2 < Math.max(300, r.ms / 3), `caché: ${r.ms2} ms frente a ${r.ms} ms`);
  console.log('automix-add live: OK', JSON.stringify({ plays: r.plays.map((p) => p.plays), ms: [r.ms, r.ms2] }));
};

tests.engine = async () => {
  // REQ-3: analizada → al hueco de menor coste y dice dónde quedó
  {
    const { am } = engine();
    const by = { a: ana(122, '8A'), b: ana(126, '9A'), c: ana(130, '9A'), d: ana(135, '10A'), n: ana(128, '9A') };
    for (const [id, a] of Object.entries(by)) am.ana.set(id, a);
    am.queue = ['a', 'b', 'c', 'd'].map((id) => T(id, { local: true }));
    const r = am.addSmart(T('n', { local: true, title: 'Nueva' }));
    assert.ok(r.ok && !r.pending);
    assert.strictEqual(am.queue[r.index].videoId, 'n');
    assert.match(am.note, new RegExp(`posición ${r.index + 1} de 5`));
    // REQ-8 (sin duplicados): ni la de la cola ni la que suena
    const toasts = am.app.toast; let msg = ''; am.app.toast = (m) => (msg = m);
    assert.strictEqual(am.addSmart(T('n')).reason, 'dup'); assert.match(msg, /ya está/);
    assert.strictEqual(am.addSmart(T('CUR')).reason, 'dup');
    assert.strictEqual(am.queue.length, 5);
    am.app.toast = toasts;
    // «A continuación»
    am.addSmart(T('z', { local: true, title: 'Zeta' }), { next: true });
    assert.strictEqual(am.queue[0].videoId, 'z'); assert.ok(am.pinned.has('z'));
  }
  // REQ-3: sin analizar → al final, se manda a analizar y, al llegar, se mueve sola avisando «movida de a a b»
  {
    const { am } = engine();
    const by = { a: ana(150, '8A'), b: ana(124, '8A'), c: ana(140, '8A'), d: ana(130, '8A') };
    for (const [id, a] of Object.entries(by)) if (id !== 'b') am.ana.set(id, a);
    am.queue = ['a', 'c', 'd'].map((id) => T(id, { local: true }));
    const r = am.addSmart(T('b', { title: 'Cercana' }));
    assert.ok(r.pending); assert.strictEqual(am.queue.at(-1).videoId, 'b');
    assert.match(am.note, /la analizo/);
    await sleep(10);
    assert.ok(requests.some((q) => q[0] === 'b' && q[1].save === true), 'se manda a analizar');
    done('b', ana(124, '8A'));
    assert.match(am.note, /“Cercana” analizada: movida de 4 a [1-3]/, am.note);
    assert.ok(am.queue.findIndex((t) => t.videoId === 'b') < 3, 'ocupa un lugar mejor que el final');
    assert.ok(!am.moves.has('b'));
  }
  // REQ-6: la radio llena la cola con las MÁS POPULARES entre las de mezcla comparable
  {
    const { am } = engine();
    net.radio = Array.from({ length: 12 }, (_, i) => ({ videoId: `r${String(i).padStart(10, '0')}`, title: `R${i}`, artist: 'Otro', duration: 200, year: 2001 }));
    net.plays = Object.fromEntries(net.radio.map((t, i) => [t.videoId, 1e4 * Math.pow(3, i)])); // r11 es la más popular
    await am.ensureQueue(true);
    assert.strictEqual(am.queue.length, 8);
    assert.strictEqual(am.queue[0].videoId, `r${String(11).padStart(10, '0')}`, 'la más popular primero');
    assert.deepStrictEqual(am.queue.map((t) => t.videoId), Array.from({ length: 8 }, (_, i) => `r${String(11 - i).padStart(10, '0')}`), 'ordenadas por popularidad');
    assert.strictEqual(am.radioPool.length, 4, 'el resto va a las sugeridas');
    // «Priorizar lo popular» apagado: manda el orden de la radio
    const e2 = engine(); e2.am.cfg.popularity = false; net.radio = Array.from({ length: 5 }, (_, i) => ({ videoId: `s${String(i).padStart(10, '0')}`, title: `S${i}`, artist: 'Otro', duration: 200 })); net.plays = { s0000000004: 9e9 };
    await e2.am.ensureQueue(true);
    assert.strictEqual(e2.am.queue[0].videoId, 's0000000000', 'sin popularidad: orden de la radio');
    // si las reproducciones tardan, no se bloquea la cola
    const e3 = engine(); net.radio = [{ videoId: 't0000000000', title: 'T', artist: 'x', duration: 200 }]; net.popDelay = 6000;
    const t0 = Date.now(); await e3.am.ensureQueue(true);
    assert.ok(Date.now() - t0 < 5000, `espera como mucho 4 s (${Date.now() - t0} ms)`); assert.strictEqual(e3.am.queue.length, 1);
  }
  // REQ-5: sugeridas ordenadas por coste desde el final de la cola, con la popularidad; analiza de a una, solo analiza
  {
    const { am } = engine();
    am.queue = [T('q1', { artist: 'Daft Punk' })]; am.ana.set('q1', ana(124, '8A'));
    net.radio = [
      { videoId: 'p0000000001', title: 'Hit sin analizar', artist: 'Daft Punk', duration: 200, plays: 9e8, fromRadio: true },
      { videoId: 'p0000000002', title: 'Rara', artist: 'Nadie', duration: 200, plays: 1e3, fromRadio: true },
    ];
    net.library = [{ id: 'L1', bpm: 125, camelot: '9A', title: 'De la librería', artist: 'Mía', duration: 240, local: true, offset: 0, mix: { mixIn: 8, mixOut: [{ t: 200 }], phrases: new Array(20).fill(60), phraseBeats: 16 } }, { id: 'L2', bpm: 160, camelot: '3B', title: 'No encaja', artist: 'Mía', duration: 240, local: true }];
    net.plays = { p0000000001: 9e8, p0000000002: 1e3 };
    await am.refreshPools();
    const sg = am.suggestions();
    assert.ok(sg.length >= 3 && sg.length <= 6, `sugeridas: ${JSON.stringify(sg.map((x) => x.track.videoId))} radio=${am.radioPool.length} lib=${am.libPool.length} note=${am.note}`);
    assert.strictEqual(sg.at(-1).track.videoId, 'L2', 'la que no encaja, la última aunque esté analizada');
    assert.ok(sg.find((x) => x.track.videoId === 'L1').analyzed && sg.find((x) => x.track.videoId === 'L1').cost != null);
    const hit = sg.find((x) => x.track.videoId === 'p0000000001'); assert.ok(hit.plays === 9e8 && !hit.analyzed);
    assert.ok(sg.findIndex((x) => x.track.videoId === 'p0000000001') < sg.findIndex((x) => x.track.videoId === 'p0000000002'), 'la popular antes que la rara');
    am.analyzeSuggestions(sg); am.analyzeSuggestions(sg);
    await sleep(5);
    assert.strictEqual(requests.filter((q) => q[1].save === false).length, 1, 'de a una y sin guardar el audio');
    // ya en la cola no se sugiere
    am.addSmart(T('L1', { local: true }));
    assert.ok(!am.suggestions().some((x) => x.track.videoId === 'L1'));
  }
  console.log('automix-add engine: OK');
};

if (!tests[mode]) (console.error('uso: test-automix-add.js', Object.keys(tests).join('|')), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
