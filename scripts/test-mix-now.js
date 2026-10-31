// Pruebas de «Mezclar ahora».  Uso: node --experimental-default-type=module scripts/test-mix-now.js plan|engine
import assert from 'node:assert';
const mode = process.argv[2];
const tests = {};
const { planNearest } = await import('../renderer/mixplan.js');

const cur = (o = {}) => ({ bpm: 120, offset: 0.5, duration: 240, mix: { mixOut: [{ t: 200, score: 9, kind: 'outro' }, { t: 90, score: 5, kind: 'break' }] }, ...o });
const nxt = (o = {}) => ({ bpm: 124, offset: 0.2, mix: { mixIn: 8 }, ...o });
const beat = 0.5; // 120 BPM

tests.plan = async () => {
  // REQ-1: la salida es la MÁS CERCANA por delante: aquí un límite de frase (cada 8 beats = 4 s) antes que la rotura de 90 s
  let p = planNearest(cur(), nxt(), { pos: 30.2, len: 16 });
  assert.strictEqual(p.kind, 'phrase');
  assert.ok(p.exitAt >= 31.2 && p.exitAt - 30.2 <= 4.0 + 1e-9, `salida ${p.exitAt}`);
  assert.ok(Math.abs(((p.exitAt - 0.5) / (8 * beat)) % 1) < 1e-6 || Math.abs(((p.exitAt - 0.5) / (8 * beat)) % 1 - 1) < 1e-6, 'en un límite de 8 beats de la rejilla');
  assert.ok(p.waitS >= 1 && p.waitS <= 12);
  // un punto de la pista más cercano que el límite de frase gana
  p = planNearest(cur({ mix: { mixOut: [{ t: 31.9, kind: 'break' }] } }), nxt(), { pos: 30.2 });
  assert.strictEqual(p.exitAt, 31.9); assert.strictEqual(p.kind, 'break');
  // las salidas EDITADAS cuentan (y sustituyen a las automáticas)
  p = planNearest(cur({ mixEdit: { outs: [{ t: 31.5 }] } }), nxt(), { pos: 30.2 });
  assert.strictEqual(p.exitAt, 31.5); assert.strictEqual(p.kind, 'edit');
  // nunca antes de pos + minLead ni más allá de maxWait
  p = planNearest(cur({ mix: { mixOut: [{ t: 30.5 }, { t: 60 }] } }), nxt(), { pos: 30.2, minLead: 1, maxWait: 12 });
  assert.ok(p.exitAt >= 31.2 && p.waitS <= 12 && p.exitAt !== 30.5 && p.exitAt !== 60);
  // REQ-2: entra por su punto de entrada (editado o automático), con tempo igualado
  assert.strictEqual(planNearest(cur(), nxt(), { pos: 30 }).enterAt, 8);
  assert.strictEqual(planNearest(cur(), nxt({ mixEdit: { in: 41.5 } }), { pos: 30 }).enterAt, 41.5);
  assert.strictEqual(planNearest(cur(), nxt(), { pos: 30 }).tempo, true);
  // REQ-3: compases enteros (múltiplo de 4 beats), mínimo 4, tope la duración configurada
  for (const len of [4, 6, 16, 32]) {
    p = planNearest(cur(), nxt(), { pos: 30, len });
    assert.strictEqual(p.beats % 4, 0, `len ${len}: ${p.beats} beats`);
    assert.ok(p.beats >= 4); assert.ok(p.seconds <= len + 2 * beat + 1e-9);
    assert.ok(Math.abs(p.seconds - p.beats * beat) < 1e-9);
  }
  // nunca pasa del final: cerca del final de la pista la transición se acorta
  p = planNearest(cur({ duration: 240, mix: { mixOut: [] } }), nxt(), { pos: 232, len: 16 });
  assert.ok(p.exitAt + p.seconds <= 240 - 1 + 1e-9, `acaba en ${p.exitAt + p.seconds}`);
  assert.ok(p.beats >= 4 && p.beats <= 12);
  // sin espacio para 4 beats: fundido corto ahora
  p = planNearest(cur({ duration: 240 }), nxt(), { pos: 238.5, len: 16 });
  assert.strictEqual(p.kind, 'now'); assert.ok(p.seconds <= 4 && p.waitS === 0);
  // REQ-4: sin BPM en alguna de las dos → fundido corto inmediato
  p = planNearest(cur({ bpm: null }), nxt(), { pos: 30 }); assert.strictEqual(p.kind, 'now'); assert.strictEqual(p.exitAt, 30);
  p = planNearest(cur(), nxt({ bpm: null }), { pos: 30 }); assert.strictEqual(p.kind, 'now'); assert.match(p.warnings[0], /sin BPM/);
  // salto brusco de BPM: filtro, sin forzar tempo, transición más larga
  p = planNearest(cur(), nxt({ bpm: 150 }), { pos: 30, len: 16 });
  assert.strictEqual(p.style, 'filter'); assert.strictEqual(p.tempo, false); assert.ok(p.seconds > 16 - 1); assert.match(p.warnings[0], /salto de BPM/);
  // la rejilla desplazada (gridShift) se respeta
  const g = planNearest(cur({ gridShift: 0.1, mix: { mixOut: [] } }), nxt(), { pos: 30.2 });
  assert.ok(Math.abs(((g.exitAt - 0.6) / (8 * beat)) % 1) < 1e-6 || Math.abs(((g.exitAt - 0.6) / (8 * beat)) % 1 - 1) < 1e-6);
  // no muta la entrada
  const c = cur(); const before = JSON.stringify(c); planNearest(c, nxt(), { pos: 30 }); assert.strictEqual(JSON.stringify(c), before);
  console.log('mix-now plan: OK');
};

// ---------- motor con decks simulados ----------
const listeners = [];
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async () => null, request() {} }, lib: { radio: async () => ({ ok: true, data: [] }), search: async () => ({ ok: true, data: [] }) } } };
const { AutoMix } = await import('../renderer/automix.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fakeDeck(id) {
  return { id, track: null, pos: 0, pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, wantPlay: false, st: { playing: false, dur: 0, ready: false, videoId: null }, seeks: [], tempoCalls: 0,
    async load(t) { this.track = t; this.st = { playing: false, dur: 240, ready: true, videoId: t.videoId }; }, togglePlay() { this.st.playing = !this.st.playing; }, remaining() { return this.st.dur - this.pos; },
    bpm() { return this.analysis?.bpm || null; }, setLoop() {}, matchTempoSmart() { this.tempoCalls++; return true; }, alignPhase() {}, phaseDiff: () => null, setPitch() {}, analyze() {}, seek(t) { this.seeks.push(t); },
    transport(c) { if (c.type === 'play') this.st.playing = true; if (c.type === 'pause') this.st.playing = false; } };
}
function setupEngine({ curBpm = 120, nextBpm = 124 } = {}) {
  const A = fakeDeck('A'), B = fakeDeck('B');
  const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast() {}, xfader: { value: -1 }, applyXf() {} };
  const am = new AutoMix(app);
  am.cfg.endless = false; am.cfg.len = 16;
  const curAna = { bpm: curBpm, offset: 0.5, duration: 240, camelot: '8A', mix: { mixIn: 4, mixOut: [{ t: 200, score: 9, kind: 'outro' }] } };
  A.track = { videoId: 'CUR', title: 'CUR', local: true }; A.analysis = curAna; A.st = { playing: true, dur: 240, ready: true, videoId: 'CUR' }; A.pos = 30.2;
  am.ana.set('CUR', curAna);
  const t = { videoId: 'N1', title: 'N1', local: true, duration: 240 };
  am.ana.set('N1', { bpm: nextBpm, offset: 0.2, duration: 240, camelot: '8A', mix: { mixIn: 8 } });
  am.queue = [t];
  const load = B.load.bind(B);
  B.load = async (tr) => { await load(tr); B.analysis = am.ana.get(tr.videoId); }; // el deck real trae el análisis al cargar
  am.on = true; am.cur = A;
  return { am, A, B };
}

tests.engine = async () => {
  // REQ-1/5: no arranca de inmediato; espera a la salida más cercana y avisa cuánto falta
  {
    const { am, A, B } = setupEngine();
    am.mixNow();
    assert.ok(am.pendingMix);
    am.tick(); await sleep(5); am.tick();
    assert.ok(!am.trans, 'no arranca de inmediato');
    const s = am.snapshot().pendingMix;
    assert.ok(s.ready && s.waitS >= 1 - 1e-9 && s.waitS <= 12, JSON.stringify(s));
    assert.ok(['phrase', 'bar', 'edit', 'outro', 'break', 'auto'].includes(s.kind));
    const exitAt = am.pendingMix.plan.exitAt;
    assert.ok(exitAt - 30.2 <= 4.0 + 1e-9, `salida ${exitAt} (a lo sumo una frase de 8 beats)`);
    // el tiempo pasa: aún no, y al llegar a la salida, arranca
    A.pos = exitAt - 0.5; am.tick(); assert.ok(!am.trans, 'antes de la salida, no');
    A.pos = exitAt + 0.01; am.tick();
    assert.ok(am.trans, 'al llegar a la salida, arranca');
    assert.strictEqual(am.pendingMix, false);
    // REQ-2/3: la entrante entra por su punto de entrada, con tempo igualado y compases enteros
    assert.deepStrictEqual(B.seeks, [8], 'entra por su mixIn');
    assert.ok(B.tempoCalls > 0, 'tempo igualado');
    assert.strictEqual(Math.round(am.trans.len / 0.5) % 4, 0, `${am.trans.len} s = compases enteros`);
  }
  // una segunda pulsación cancela
  {
    const { am } = setupEngine();
    am.mixNow(); assert.ok(am.pendingMix);
    am.mixNow(); assert.strictEqual(am.pendingMix, false); assert.match(am.note, /cancelada/);
    am.tick(); await sleep(5); am.tick(); assert.ok(!am.trans, 'cancelada: no arranca');
  }
  // con la pista pausada no espera: arranca ya
  {
    const { am, A } = setupEngine(); A.st.playing = false;
    am.mixNow(); am.tick(); await sleep(5); am.tick();
    assert.ok(am.trans, 'pausada: arranca de inmediato');
  }
  // REQ-4: sin BPM, fundido corto inmediato
  {
    const { am } = setupEngine({ nextBpm: null });
    am.mixNow(); am.tick(); await sleep(5); am.tick();
    assert.ok(am.trans && am.trans.len <= 4, `fundido corto (${am.trans?.len})`);
  }
  // salto brusco: filtro y sin forzar el tempo
  {
    const { am, B } = setupEngine({ nextBpm: 150 });
    am.mixNow(); am.tick(); await sleep(5); am.tick();
    const exitAt = am.pendingMix.plan.exitAt; setupEngine; am.cur.pos = exitAt + 0.01; am.tick();
    assert.ok(am.trans && am.trans.style === 'filter' && B.tempoCalls === 0);
  }
  console.log('mix-now engine: OK');
};

if (!tests[mode]) (console.error('uso: test-mix-now.js', Object.keys(tests).join('|')), process.exit(2));
tests[mode]().catch((e) => (console.error(e), process.exit(1)));
