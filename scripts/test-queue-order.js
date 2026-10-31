// Pruebas del orden de la cola de AutoMix.  Uso: node --experimental-default-type=module scripts/test-queue-order.js chain|prepare|e2e
import assert from 'node:assert';

const mode = process.argv[2];
const tests = {};
const { orderChain, edgeCost, pickNext, bpmGap } = await import('../renderer/mixplan.js');

// ---------- entorno simulado del motor (como en test-automix-view) ----------
const listeners = [];
const requests = [];
const store = {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async (id) => store[id] || null, request: (id, o) => requests.push([id, o]) }, lib: { radio: async () => ({ ok: true, data: [] }), search: async () => ({ ok: true, data: [] }) } } };
const { AutoMix } = await import('../renderer/automix.js');
function fakeDeck(id) {
  return { id, track: null, pos: 0, pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, wantPlay: false, st: { playing: false, dur: 0, ready: false, videoId: null },
    async load(t) { this.track = t; this.st = { playing: false, dur: 200, ready: true, videoId: t.videoId }; }, togglePlay() {}, remaining() { return this.st.dur - this.pos; },
    bpm: () => null, setLoop() {}, matchTempoSmart: () => false, alignPhase() {}, phaseDiff: () => null, setPitch() {}, analyze() {}, transport() {} };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function setupEngine() {
  listeners.length = 0; requests.length = 0; for (const k of Object.keys(store)) delete store[k];
  const A = fakeDeck('A'), B = fakeDeck('B');
  const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast() {}, xfader: { value: -1 }, applyXf() {} };
  const am = new AutoMix(app);
  am.cfg.endless = false;
  A.track = { videoId: 'CUR', title: 'CUR', local: true };
  A.st = { playing: true, dur: 200, ready: true, videoId: 'CUR' };
  A.pos = 100; A.analysis = { bpm: 124, camelot: '8A', duration: 200, offset: 0 };
  am.on = true; am.cur = A;
  return { am, A, B };
}

// pistas sintéticas: BPM y clave Camelot conocidos
const KEYS = ['8A', '9A', '8B', '3A', '10A', '1B', '5A', '12B', '7A', '2B'];
const mk = (id, bpm, camelot, e = 50) => ({ t: { videoId: id, title: id }, a: { bpm, camelot, duration: 240, offset: 0, mix: { mixIn: 8, mixOut: [{ t: 200, score: 1 }], phrases: new Array(20).fill(e), phraseBeats: 16 } } });
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const make = (n, seed) => { const r = rng(seed); return Array.from({ length: n }, (_, i) => mk(`t${i}`, 95 + Math.round(r() * 55), KEYS[Math.floor(r() * KEYS.length)], 20 + Math.round(r() * 70))); };
const run = (items, cur, pinned = new Set(), opts = {}) => {
  const by = new Map(items.map((x) => [x.t.videoId, x.a]));
  return orderChain({ cur, queue: items.map((x) => x.t), analysisOf: (t) => by.get(t.videoId), pinned, ...opts });
};
const costOf = (order, items, cur) => { const by = new Map(items.map((x) => [x.t.videoId, x.a])); let c = cur ? edgeCost(cur, by.get(order[0])) : 0; for (let i = 1; i < order.length; i++) c += edgeCost(by.get(order[i - 1]), by.get(order[i])); return c; };
function* perms(a, k = 0) { if (k === a.length) return yield a.slice(); for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* perms(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } }

tests.chain = async () => {
  const cur = { bpm: 124, camelot: '8A', duration: 240, offset: 0, mix: { mixOut: [{ t: 200 }], phrases: new Array(20).fill(60), phraseBeats: 16 } };
  // REQ-2: exacto frente a fuerza bruta en 7 pistas (varias semillas)
  for (const seed of [1, 2, 3, 4, 5]) {
    const items = make(7, seed);
    const r = run(items, cur);
    let opt = Infinity;
    for (const p of perms(items.map((x) => x.t.videoId))) opt = Math.min(opt, costOf(p, items, cur));
    assert.ok(Math.abs(costOf(r.queue.map((t) => t.videoId), items, cur) - opt) < 1e-6, `semilla ${seed}: óptimo ${opt}`);
    assert.strictEqual(new Set(r.queue.map((t) => t.videoId)).size, 7, 'sin duplicar ni perder pistas');
  }
  // heurística (más de 8): dentro del 5% del óptimo en 9 pistas y mejor que el orden de entrada
  const items9 = make(9, 11);
  const r9 = run(items9, cur, new Set(), { budgetMs: 300 });
  let opt9 = Infinity; for (const p of perms(items9.map((x) => x.t.videoId))) opt9 = Math.min(opt9, costOf(p, items9, cur));
  assert.ok(r9.cost <= opt9 * 1.05 + 0.5, `heurística ${r9.cost} vs óptimo ${opt9}`);
  assert.ok(r9.cost <= costOf(items9.map((x) => x.t.videoId), items9, cur) + 1e-6, 'no empeora el orden de entrada');
  // REQ-2: la cadena no es peor que el orden voraz anterior (solo la siguiente) en 30 pistas
  const items30 = make(30, 7);
  const rc = run(items30, cur);
  const by = new Map(items30.map((x) => [x.t.videoId, x.a]));
  const old = pickNext({ cur, queue: items30.map((x) => x.t), isReady: () => true, analysisOf: (t) => by.get(t.videoId) }).queue.map((t) => t.videoId);
  assert.ok(rc.cost <= costOf(old, items30, cur) + 1e-6, `cadena ${rc.cost} ≤ voraz anterior ${costOf(old, items30, cur)}`);
  // REQ-3: progresión suave — en una cola con BPM repartidos, el orden resultante sube o baja casi monótono
  const sweep = [100, 140, 120, 108, 132, 116, 124, 104, 128].map((b, i) => mk(`s${i}`, b, '8A'));
  const rs = run(sweep, { bpm: 100, camelot: '8A', duration: 240, offset: 0, mix: sweep[0].a.mix });
  const bpms = rs.queue.map((t) => sweep.find((x) => x.t.videoId === t.videoId).a.bpm);
  let jumps = 0; for (let i = 1; i < bpms.length; i++) if (Math.abs(bpms[i] / bpms[i - 1] - 1) > 0.08) jumps++;
  assert.ok(jumps <= 1, `saltos >8%: ${jumps} en ${bpms}`);
  // REQ-4: lo fijado se queda donde está y lo demás se ordena alrededor
  const it = make(8, 21);
  const pins = new Set([it[2].t.videoId, it[5].t.videoId]);
  const rp = run(it, cur, pins);
  assert.strictEqual(rp.queue[2].videoId, it[2].t.videoId);
  assert.strictEqual(rp.queue[5].videoId, it[5].t.videoId);
  assert.strictEqual(new Set(rp.queue.map((t) => t.videoId)).size, 8);
  // pistas sin análisis: al final de los huecos libres, en su orden, y sin romper nada
  const mixed = make(6, 31);
  const q = mixed.map((x) => x.t);
  const anaOf = (t) => (['t1', 't3'].includes(t.videoId) ? null : mixed.find((x) => x.t.videoId === t.videoId).a);
  const rm = orderChain({ cur, queue: q, analysisOf: anaOf });
  assert.deepStrictEqual(rm.queue.slice(-2).map((t) => t.videoId), ['t1', 't3'], 'sin análisis al final y en su orden');
  // no muta la entrada
  const before = q.map((t) => t.videoId).join();
  orderChain({ cur, queue: q, analysisOf: anaOf });
  assert.strictEqual(q.map((t) => t.videoId).join(), before);
  // REQ-7: 100 pistas en menos de 200 ms
  const big = make(100, 99);
  const t0 = performance.now();
  run(big, cur, new Set(), { budgetMs: 120 });
  const ms = performance.now() - t0;
  assert.ok(ms < 200, `100 pistas en ${Math.round(ms)} ms`);
  // sin pista actual también funciona
  assert.strictEqual(run(make(5, 3), null).queue.length, 5);
  console.log('queue-order chain: OK', `100 pistas ${Math.round(ms)} ms`);
};

tests.prepare = async () => {
  const { am, B } = setupEngine();
  const bpms = { a: 150, b: 126, c: 140, d: 122, e: 132, f: 128 };
  const q = Object.keys(bpms).map((id) => ({ videoId: id, title: id, artist: 'x', duration: 200 }));
  am.queue = q.slice();
  // REQ-1: toda la cola se manda a analizar, de a 2, en el orden de la cola, guardando el archivo
  am.prepareAhead();
  await sleep(10);
  assert.deepStrictEqual(requests.map((r) => r[0]), ['a', 'b'], '2 en paralelo, en orden');
  assert.ok(requests.every((r) => r[1].save === true));
  const ev = (e) => listeners.forEach((l) => l(e));
  const finish = (id) => { store[id] = { id, bpm: bpms[id], camelot: '8A', duration: 200, offset: 0, saved: { path: '/x', localId: `L${id}` }, mix: { mixIn: 8, mixOut: [{ t: 180, score: 1 }], phrases: new Array(12).fill(60), phraseBeats: 16 } }; ev({ id, stage: 'done', analysis: store[id] }); };
  // llegan análisis: antes de 3 analizadas no se reordena (REQ-2), la cola sigue como entró
  finish('a'); am.prepareAhead(); await sleep(5);
  finish('b'); am.prepareAhead(); await sleep(5);
  assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['a', 'b', 'c', 'd', 'e', 'f'], 'con 2 analizadas no se reordena');
  assert.deepStrictEqual(requests.map((r) => r[0]), ['a', 'b', 'c', 'd'], 'al liberarse un hueco entra la siguiente');
  // REQ-5: al llegar la tercera análisis se recalcula el orden de las no fijadas
  finish('c'); await sleep(5);
  const order1 = am.queue.map((t) => t.videoId);
  assert.notDeepStrictEqual(order1, ['a', 'b', 'c', 'd', 'e', 'f'], 'se reordenó al llegar la tercera');
  assert.ok(am.undoStack, 'queda un nivel de deshacer');
  // las analizadas (a,b,c) quedan encadenadas desde 124 BPM sin saltar al 150 primero
  assert.ok(order1.indexOf('b') < order1.indexOf('a'), '126 antes que 150');
  // deshacer
  assert.ok(am.undoReorder());
  assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['a', 'b', 'c', 'd', 'e', 'f'], 'deshacer vuelve al orden anterior');
  // «Reorganizar ahora» ordena aunque el orden automático esté apagado y suelte lo fijado por move()
  am.cfg.smartOrder = false;
  for (const id of ['d', 'e', 'f']) finish(id);
  assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['a', 'b', 'c', 'd', 'e', 'f'], 'apagado: no se mueve solo');
  assert.ok(am.reorganizeNow(), 'manual: sí ordena');
  const ordered = am.queue.map((t) => t.videoId);
  const bp = ordered.map((id) => bpms[id]);
  let jumps = 0; for (let i = 1; i < bp.length; i++) if (Math.abs(bp[i] / bp[i - 1] - 1) > 0.08) jumps++;
  assert.ok(jumps <= 1, `cadena suave: ${bp}`);
  assert.ok(am.snapshot().chain.analyzed === 6 && am.snapshot().queue.every((i) => i.cost != null), 'la vista recibe el coste de cada transición');
  // REQ-4/5: la pista que ya se está precargando y las fijadas a mano no se mueven
  am.cfg.smartOrder = true;
  am.undoStack = null;
  const head = am.queue[0].videoId;
  await B.load(am.queue[0]); // la cabeza ya está cargada en el deck libre
  am.pinned.clear(); am.pinned.add(am.queue[3].videoId);
  const pinnedId = am.queue[3].videoId;
  am.queue = [am.queue[0], ...am.queue.slice(1).reverse()];
  const pinPos = am.queue.findIndex((t) => t.videoId === pinnedId);
  am.reorder({ force: true });
  assert.strictEqual(am.queue[0].videoId, head, 'la cabeza precargada no se mueve');
  assert.strictEqual(am.queue[pinPos].videoId, pinnedId, 'lo fijado se queda');
  console.log('queue-order prepare: OK');
};

tests.e2e = async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-queue-'));
  spawnSync(createRequire(import.meta.url)('electron'), ['.'], { cwd: root, timeout: 120000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts/queue-order-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'queue.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.QUEUE_SHOT) fs.copyFileSync(path.join(tmp, 'queue.png'), process.env.QUEUE_SHOT);
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.ok(!r.__err, JSON.stringify(r));
  assert.deepStrictEqual(r.before, ['Pista a', 'Pista b', 'Pista c', 'Pista d', 'Pista e']);
  assert.notDeepStrictEqual(r.after, r.before, 'REQ-6: «Reorganizar ahora» cambia el orden');
  assert.strictEqual(r.after.length, 5);
  assert.ok(r.q.length === 5 && r.q.every((c) => /good|ok|poor/.test(c)), `REQ-6: calidad en cada pista ${r.q}`);
  assert.match(r.quality, /5\/5 analizadas/);
  assert.strictEqual(r.undoOn, true, 'REQ-6: Deshacer disponible');
  assert.deepStrictEqual(r.undone, r.before, 'REQ-6: Deshacer vuelve al orden anterior');
  assert.match(r.label, /Orden automático/);
  console.log('queue-order e2e: OK', r.after.join(' → '));
};

if (!tests[mode]) (console.error('uso: test-queue-order.js', Object.keys(tests).join('|')), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
