// Pruebas del motor de AutoMix con decks simulados.
//   node --experimental-default-type=module scripts/test-automix-view.js queue|prepare|mixnow
import assert from 'node:assert';

const mode = process.argv[2];

// ---------- entorno simulado ----------
const listeners = [];
const requests = [];
const store = {}; // videoId → análisis guardado
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = {
  ytdj: {
    analysis: {
      onEvent: (cb) => listeners.push(cb),
      get: async (id) => store[id] || null,
      request: (id, opts) => requests.push([id, opts]),
    },
    lib: { radio: async () => ({ ok: true, data: [] }), search: async () => ({ ok: true, data: [] }) },
  },
};
const { AutoMix } = await import('../renderer/automix.js');

function fakeDeck(id) {
  return {
    id, track: null, pos: 0, loads: [], pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, wantPlay: false,
    st: { playing: false, dur: 0, ready: false, videoId: null },
    async load(t) { this.loads.push(t.videoId); this.track = t; this.pos = 0; this.st = { playing: false, dur: t.duration || 200, ready: true, videoId: t.videoId }; },
    togglePlay() { this.st.playing = !this.st.playing; },
    remaining() { return this.st.dur - this.pos; },
    bpm: () => null, setLoop() {}, matchTempoSmart: () => false, alignPhase() {}, phaseDiff: () => null, setPitch() {}, analyze() {},
    transport(c) { if (c.type === 'play') this.st.playing = true; if (c.type === 'pause') this.st.playing = false; },
  };
}

function setup() {
  listeners.length = 0;
  requests.length = 0;
  for (const k of Object.keys(store)) delete store[k];
  const A = fakeDeck('A');
  const B = fakeDeck('B');
  const toasts = [];
  const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast: (m) => toasts.push(m), xfader: { value: -1 }, applyXf() {} };
  const am = new AutoMix(app);
  am.cfg.endless = false; // no pedir radio en las pruebas
  am.cfg.len = 4;
  const T = (id, extra = {}) => ({ videoId: id, title: `Pista ${id}`, artist: 'x', duration: 200, ...extra });
  return { am, A, B, app, toasts, T };
}

// Pone a A sonando como pista en juego dentro de AutoMix.
function playing(am, A, T, id = 'CUR', rem = 100) {
  A.track = T(id, { local: true });
  A.st = { playing: true, dur: 200, ready: true, videoId: id };
  A.pos = 200 - rem;
  am.on = true;
  am.cur = A;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ids = (am) => am.queue.map((t) => t.videoId);
const tests = {};

// REQ-2: cambios al vuelo en la cola, también con una transición en curso
tests.queue = async () => {
  const { am, A, B, T } = setup();
  for (const id of ['a', 'b', 'c', 'd']) am.add(T(id, { local: true }));
  am.add(T('a')); // sin duplicados
  assert.deepStrictEqual(ids(am), ['a', 'b', 'c', 'd']);
  am.move(2, 0);
  assert.deepStrictEqual(ids(am), ['c', 'a', 'b', 'd'], 'subir/arrastrar');
  am.move(0, 3);
  assert.deepStrictEqual(ids(am), ['a', 'b', 'd', 'c'], 'bajar');
  am.move(9, 0); am.move(0, 9); am.move(1, 1); // fuera de rango o igual: no hace nada
  assert.deepStrictEqual(ids(am), ['a', 'b', 'd', 'c']);
  am.playNext(3);
  assert.deepStrictEqual(ids(am), ['c', 'a', 'b', 'd'], 'a continuación');
  am.insertNext(T('z', { local: true }));
  assert.deepStrictEqual(ids(am), ['z', 'c', 'a', 'b', 'd']);
  am.insertNext(T('b', { local: true }));
  assert.deepStrictEqual(ids(am), ['b', 'z', 'c', 'a', 'd'], 'una pista existente pasa al frente sin duplicarse');
  am.remove(1);
  assert.deepStrictEqual(ids(am), ['b', 'c', 'a', 'd']);

  // con una transición en curso se puede editar y al terminar sale la pista que entró, no «la primera»
  playing(am, A, T);
  am.queue = [T('n1', { local: true }), T('n2', { local: true }), T('n3', { local: true })];
  await B.load(am.queue[0]);
  am.startTransition(A, B, 4);
  assert.ok(am.trans, 'hay transición');
  am.move(2, 0); // n3 pasa al frente mientras n1 está entrando
  am.add(T('n4', { local: true }));
  am.remove(am.queue.findIndex((t) => t.videoId === 'n2'));
  assert.deepStrictEqual(ids(am), ['n3', 'n1', 'n4']);
  am.finishTransition();
  assert.deepStrictEqual(ids(am), ['n3', 'n4'], 'se quita n1 (la que entró) y se conserva lo editado');
  assert.strictEqual(am.cur, B);
  am.clear();
  assert.deepStrictEqual(ids(am), []);
};

// REQ-5, REQ-6, REQ-7: preparación anticipada, estado por pista, espera y salto
tests.prepare = async () => {
  const { am, A, B, T, toasts } = setup();
  playing(am, A, T, 'CUR', 100);
  const yt = ['y1', 'y2', 'y3', 'y4'].map((id) => T(id));
  am.queue = [...yt];
  // se piden las 3 primeras con save:true (descarga sin sesión + análisis + guardado), no la cuarta
  am.prepareAhead();
  await sleep(10);
  assert.deepStrictEqual(requests.map((r) => r[0]), ['y1', 'y2', 'y3']);
  assert.ok(requests.every((r) => r[1].save === true));
  assert.strictEqual(am.prepOf(yt[0]).state, 'queued');
  assert.strictEqual(am.prepOf(yt[3]).state, 'idle');
  // estados por pista a partir de los eventos del analizador
  const ev = (e) => listeners.forEach((l) => l(e));
  ev({ id: 'y1', stage: 'download', progress: 0.42 });
  assert.deepStrictEqual(am.prepOf(yt[0]), { state: 'download', progress: 0.42 });
  ev({ id: 'y1', stage: 'analyze' });
  assert.strictEqual(am.prepOf(yt[0]).state, 'analyze');
  ev({ id: 'y2', stage: 'error', error: 'This video is unavailable' });
  assert.strictEqual(am.prepOf(yt[1]).state, 'error');
  assert.match(am.prepOf(yt[1]).error, /unavailable/);
  // una pista ya guardada está lista al instante
  store.y9 = { saved: { path: '/x', localId: 'L1' } };
  am.queue = [T('y9')];
  am.prepareAhead();
  await sleep(10);
  assert.strictEqual(am.prepOf(am.queue[0]).state, 'ready');
  assert.strictEqual(requests.filter((r) => r[0] === 'y9').length, 0, 'no se vuelve a pedir lo ya guardado');
  // no se precarga la cabeza mientras no está lista (así el deck abre el archivo local y no el stream)
  am.queue = [yt[0], yt[2]];
  am.tick();
  await sleep(5);
  assert.deepStrictEqual(B.loads, [], 'no precarga si no está lista');
  ev({ id: 'y1', stage: 'done', analysis: { saved: { path: '/x', localId: 'L1' } } });
  am.tick();
  await sleep(5);
  assert.deepStrictEqual(B.loads, ['y1'], 'con la cabeza lista, se precarga');
  // si «done» llega sin archivo guardado es un error, no «lista»
  ev({ id: 'y3', stage: 'done', analysis: { bpm: 120 } });
  assert.strictEqual(am.prepOf(yt[2]).state, 'error');

  // espera de 20 s (aquí 40 ms) y salto a la siguiente lista
  {
    const c = setup();
    playing(c.am, c.A, c.T, 'CUR', 3); // ya toca mezclar
    c.am.cfg.waitMs = 40;
    const [h, s2] = [c.T('h1'), c.T('h2')];
    c.am.queue = [h, s2];
    c.am.prep.set('h1', { state: 'download', progress: 0.1 });
    c.am.prep.set('h2', { state: 'ready' });
    c.am.tick();
    assert.deepStrictEqual(ids(c.am), ['h1', 'h2'], 'primero espera');
    assert.match(c.am.note, /Preparando la siguiente/);
    await sleep(60);
    c.am.tick();
    assert.deepStrictEqual(ids(c.am), ['h2', 'h1'], 'pasado el tiempo, salta a la que sí está lista');
    assert.match(c.am.note, /no estaba lista/);
  }
  // si ninguna está lista: mezcla por streaming con fundido y lo avisa
  {
    const c = setup();
    playing(c.am, c.A, c.T, 'CUR', 3);
    c.am.cfg.waitMs = 20;
    c.am.queue = [c.T('s1'), c.T('s2')];
    c.am.prep.set('s1', { state: 'analyze' });
    c.am.prep.set('s2', { state: 'queued' });
    c.am.tick();
    await sleep(40);
    c.am.tick();
    assert.ok(c.am.isReady(c.am.queue[0]), 'se marca para mezclar por streaming');
    assert.ok(c.toasts.some((m) => /streaming con fundido/.test(m)), 'avisa');
  }
  // una cabeza que falló pasa al final y no bloquea
  {
    const c = setup();
    playing(c.am, c.A, c.T, 'CUR', 100);
    c.am.queue = [c.T('e1'), c.T('e2', { local: true })];
    c.am.prep.set('e1', { state: 'error', error: 'x' });
    c.am.tick();
    assert.deepStrictEqual(ids(c.am), ['e2', 'e1']);
  }
  // REQ-7: con «usar archivo» apagado se comporta como antes (todo cuenta como listo y no se pide nada)
  {
    const c = setup();
    c.am.cfg.preferLocal = false;
    c.am.queue = [c.T('p1')];
    assert.ok(c.am.isReady(c.am.queue[0]));
    c.am.prepareAhead();
    assert.strictEqual(requests.length, 0);
  }
};

// REQ-3, REQ-4: mezclar ahora y progreso
tests.mixnow = async () => {
  {
    const { am, A, B, T, toasts } = setup();
    playing(am, A, T, 'CUR', 150);
    am.queue = [T('x1'), T('x2', { local: true })];
    am.prep.set('x1', { state: 'download', progress: 0.3 });
    am.mixNow();
    assert.deepStrictEqual(ids(am), ['x2', 'x1'], 'usa la primera pista lista');
    assert.ok(am.pendingMix);
    am.tick();
    await sleep(5);
    assert.deepStrictEqual(B.loads, ['x2'], 'la precarga');
    am.tick();
    assert.ok(am.trans, 'inicia la transición');
    assert.ok(am.trans.len <= 6, 'con duración corta');
    assert.strictEqual(am.pendingMix, false);
    // progreso (REQ-4): de qué deck a cuál y cuánto va
    const snap = am.snapshot();
    assert.deepStrictEqual([snap.trans.from, snap.trans.to], ['A', 'B']);
    assert.ok(snap.trans.progress >= 0 && snap.trans.progress <= 1);
    assert.strictEqual(typeof snap.trans.tempo, 'boolean');
    // mientras hay transición, «mezclar ahora» no hace nada
    am.mixNow();
    assert.strictEqual(am.pendingMix, false);
    assert.strictEqual(toasts.length, 0);
  }
  // sin ninguna lista: avisa y mezcla en cuanto haya una
  {
    const { am, A, B, T, toasts } = setup();
    playing(am, A, T, 'CUR', 150);
    am.queue = [T('w1')];
    am.prep.set('w1', { state: 'analyze' });
    am.mixNow();
    assert.ok(toasts.some((m) => /preparando/.test(m)), 'avisa que la siguiente no está lista');
    am.tick();
    await sleep(5);
    assert.deepStrictEqual(B.loads, []);
    assert.ok(!am.trans);
    am.prep.set('w1', { state: 'ready' });
    am.tick();
    await sleep(5);
    am.tick();
    assert.ok(am.trans, 'en cuanto está lista, mezcla');
  }
  // la barra de progreso avanza con el tiempo
  {
    const { am, A, B, T } = setup();
    playing(am, A, T, 'CUR', 150);
    am.queue = [T('q1', { local: true })];
    await B.load(am.queue[0]);
    am.startTransition(A, B, 2);
    const p0 = am.snapshot().trans.progress;
    await sleep(300);
    assert.ok(am.snapshot().trans.progress > p0);
  }
};

if (!tests[mode]) {
  console.error(`modo desconocido: ${mode}. Disponibles: ${Object.keys(tests).join(', ')}`);
  process.exit(2);
}
try {
  await tests[mode]();
  console.log(`automix-view ${mode}: OK`);
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
