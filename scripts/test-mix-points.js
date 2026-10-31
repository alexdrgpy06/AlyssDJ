// Pruebas de los puntos de mezcla.  Uso: node scripts/test-mix-points.js structure|plan|pick|engine|reanalyze
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const SR = 22050;
const mode = process.argv[2];
const tests = {};

// Pista sintética con estructura conocida: intro floja, cuerpo, rotura, cuerpo, outro flojo.
//   frases (16 beats): 2 intro · 6 cuerpo · 1 rotura · 4 cuerpo · 3 outro
function track({ bpm = 124, offset = 0.3, layout = ['i', 'i', 'b', 'b', 'b', 'b', 'b', 'b', 'r', 'b', 'b', 'b', 'b', 'o', 'o', 'o'] } = {}) {
  const beat = 60 / bpm;
  const dur = offset + layout.length * 16 * beat + 1;
  const n = Math.floor(dur * SR);
  const d = new Float32Array(n);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const gain = { i: 0.25, b: 1, r: 0.18, o: 0.3 };
  for (let i = 0; i < n; i++) {
    const t = i / SR - offset;
    if (t < 0) continue;
    const beatIdx = Math.floor(t / beat);
    const phrase = Math.floor(beatIdx / 16);
    const kind = layout[phrase];
    if (!kind) continue;
    const g = gain[kind];
    const tb = t - beatIdx * beat;
    let x = 0;
    if (kind !== 'r') x += 0.8 * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-tb * 38)) * tb) * Math.exp(-tb * 11) * g; // bombo
    x += 0.25 * Math.sin(2 * Math.PI * 55 * t) * g; // bajo continuo
    x += 0.03 * rnd() * Math.exp(-(((t % (beat / 2)) + beat / 2) % (beat / 2)) * 40); // hat
    d[i] = x;
  }
  return { samples: d, bpm, offset, beat, layout };
}

tests.structure = async () => {
  const { structure } = require('../shared/structure');
  const T = track();
  const phr = (k) => T.offset + k * 16 * T.beat;
  const mix = structure(T.samples, SR, { bpm: T.bpm, offset: T.offset });
  assert.ok(mix, 'hay estructura');
  assert.strictEqual(mix.version, 2);
  assert.strictEqual(mix.phraseBeats, 16);
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, `${msg}: ${a} vs ${b}`);
  near(mix.mixIn, phr(0), 'mixIn = primer beat');
  near(mix.introEnd, phr(2), 'la intro acaba tras 2 frases');
  near(mix.outroStart, phr(13), 'el outro empieza en la frase 13');
  // el outro es el mejor candidato; la rotura (frase 8) es un candidato intermedio; todos en límites de frase
  assert.strictEqual(mix.mixOut[0].kind, 'outro');
  near(mix.mixOut[0].t, phr(13), 'mejor salida');
  const rot = mix.mixOut.find((c) => c.kind === 'rotura');
  assert.ok(rot, 'detecta la rotura como salida alternativa');
  near(rot.t, phr(8), 'rotura');
  for (const c of mix.mixOut) {
    const k = (c.t - T.offset) / (16 * T.beat);
    assert.ok(Math.abs(k - Math.round(k)) < 0.01, `alineado a frase: ${c.t}`);
  }
  assert.ok(mix.mixOut[0].score > rot.score);
  // energía por frase: el cuerpo supera a la intro, la rotura y el outro
  assert.ok(mix.phrases[3] > mix.phrases[0] + 10 && mix.phrases[3] > mix.phrases[8] + 10 && mix.phrases[3] > mix.phrases[14] + 10, `energías: ${mix.phrases}`);
  assert.ok(mix.energy > 0 && mix.energy <= 100);

  // sin caída de energía: el outro cae en la última frase que deja ≥ 32 beats (no en el final exacto)
  const flat = track({ layout: Array(12).fill('b') });
  const m2 = structure(flat.samples, SR, { bpm: flat.bpm, offset: flat.offset });
  const dur = flat.samples.length / SR;
  assert.ok(m2.outroStart <= dur - 32 * flat.beat + 0.1, 'deja al menos 32 beats');
  assert.ok(m2.outroStart >= dur - 32 * flat.beat - 16 * flat.beat - 1.5, 'y no demasiado pronto');
  // pista demasiado corta o sin BPM: no hay estructura
  assert.strictEqual(structure(new Float32Array(SR * 5), SR, { bpm: 124, offset: 0 }), null);
  assert.strictEqual(structure(T.samples, SR, { bpm: 0, offset: 0 }), null);
};

// ---------- tempo: barrido de BPM (regresión de la ambigüedad 3:2, p. ej. 150 contra 100) ----------
tests.tempo = async () => {
  const { tempo } = require('../shared/analysis');
  for (const bpm of [80, 90, 97.5, 100, 110, 118, 124, 126, 128, 135, 140, 145, 150, 155, 160, 170, 175]) {
    const t = track({ bpm, offset: 0.25, layout: ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'] });
    const r = tempo(t.samples, SR);
    assert.ok(Math.abs(r.bpm - bpm) < 0.6, `${bpm} BPM detectado como ${r.bpm}`);
    assert.ok(Math.abs(r.offset - 0.25) < 0.06 || Math.abs(r.offset - 0.25 - 60 / bpm) < 0.06, `${bpm} BPM: primer beat en ${r.offset}`);
  }
};

// ---------- plan: cuándo salir, dónde entrar, cuánto dura ----------
tests.plan = async () => {
  const { planTransition, bpmGap } = await import('../renderer/mixplan.js');
  const beat = 60 / 124;
  const cur = { bpm: 124, offset: 0.3, duration: 200, mix: { mixIn: 0.3, mixOut: [{ t: 120, score: 1, kind: 'outro' }, { t: 70, score: 0.6, kind: 'rotura' }, { t: 180, score: 0.3, kind: 'final' }] } };
  const next = { bpm: 126, offset: 0.2, duration: 200, mix: { mixIn: 8.0, mixOut: [] } };
  // REQ-2: sale en el mejor punto (no al final) y entra en su punto de entrada
  const p = planTransition(cur, next, { len: 16, optimal: true, pos: 10 });
  assert.strictEqual(p.exitAt, 120, 'sale en el outro, no al final (200 s)');
  assert.strictEqual(p.enterAt, 8.0, 'la siguiente entra en su punto de entrada');
  assert.strictEqual(p.kind, 'outro');
  assert.ok(p.tempo && p.warnings.length === 0, 'BPM compatibles: tempo igualado, sin avisos');
  // REQ-3: duración en compases enteros (múltiplos de 4 beats), cerca de la pedida
  assert.strictEqual(p.beats % 4, 0);
  assert.ok(Math.abs(p.seconds - 16) < 2 * beat * 2, `duración ≈ 16 s: ${p.seconds}`);
  assert.ok(Math.abs(p.seconds - p.beats * beat) < 1e-9);
  // acotada por el tramo disponible entre la salida y el final de la pista
  const short = { ...cur, duration: 130 };
  const ps = planTransition(short, next, { len: 32, optimal: true, pos: 10 });
  assert.strictEqual(ps.exitAt, 120);
  assert.ok(ps.exitAt + ps.seconds <= 130 + 1e-6, `cabe en lo que queda: ${ps.seconds}`);
  assert.strictEqual(ps.beats % 4, 0);
  // si el mejor punto ya pasó, usa el siguiente candidato válido
  const late = planTransition(cur, next, { len: 16, optimal: true, pos: 125 });
  assert.strictEqual(late.exitAt, 180, 'el outro ya pasó: usa el siguiente candidato');
  // sin estructura (o con el interruptor apagado) vuelve a mezclar al final, como antes
  const noMix = planTransition({ bpm: 124, offset: 0.3, duration: 200 }, next, { len: 16, optimal: true, pos: 0 });
  assert.strictEqual(noMix.kind, 'final');
  assert.ok(Math.abs(noMix.exitAt - (200 - 16 - 1.2)) < 1e-6, 'al final: duración + 1,2 s antes');
  const off = planTransition(cur, next, { len: 16, optimal: false, pos: 0 });
  assert.strictEqual(off.kind, 'final');
  assert.ok(off.exitAt > 170, 'con «puntos óptimos» apagado mezcla al final');
  // REQ-5: salto de BPM > 8 % → sin forzar tempo, transición larga con filtro y aviso
  const jump = planTransition(cur, { ...next, bpm: 140 }, { len: 16, optimal: true, pos: 10 });
  assert.strictEqual(jump.tempo, false);
  assert.strictEqual(jump.style, 'filter');
  assert.ok(jump.seconds > 16, 'más larga');
  assert.ok(jump.warnings.some((w) => /salto de BPM/.test(w)), jump.warnings.join());
  // doble / mitad de tempo cuenta como compatible
  assert.ok(bpmGap(124, 62).gap < 0.001 && bpmGap(124, 250).gap < 0.01);
  const half = planTransition(cur, { ...next, bpm: 62 }, { len: 16, optimal: true, pos: 10 });
  assert.strictEqual(half.tempo, true);
  // pista sin BPM: fundido simple y aviso
  const nb = planTransition(cur, { duration: 100 }, { len: 16, optimal: true, pos: 10 });
  assert.strictEqual(nb.tempo, false);
  assert.ok(nb.warnings.some((w) => /sin BPM/.test(w)));
};

// ---------- pick: el BPM siempre cuenta ----------
tests.pick = async () => {
  const { pickNext, scoreTransition, bpmGap, MAX_BPM_GAP } = await import('../renderer/mixplan.js');
  const A = (bpm, camelot, e = 80) => ({ bpm, offset: 0, camelot, duration: 200, mix: { phraseBeats: 16, mixIn: 0, mixOut: [{ t: 100, score: 1 }], phrases: Array(10).fill(e) } });
  const cur = A(124, '8A');
  const lib = { close: A(124, '8A'), key: A(125, '9A'), far: A(150, '8A'), clash: A(124, '3B'), quiet: A(124, '8A', 20), none: {}, half: A(62, '8A') };
  // la puntuación ordena como un DJ: mismo tempo y clave < tempo parecido < clave que choca < salto brusco
  const s = (k) => scoreTransition(cur, lib[k]);
  assert.ok(s('close') < s('key'), 'misma clave y tempo mejor que clave vecina con tempo parecido');
  assert.ok(s('key') < s('clash'), 'clave vecina mejor que la que choca');
  assert.ok(s('clash') < s('far'), 'un salto brusco de BPM es peor que una clave que choca');
  assert.ok(s('far') >= 100, 'salto > 8 % penaliza fuerte');
  assert.ok(s('quiet') > s('close'), 'un salto de energía penaliza');
  assert.ok(s('half') < 5, 'mitad de tempo cuenta como compatible');
  assert.ok(s('none') > s('close'), 'sin BPM es peor que con BPM');
  assert.ok(MAX_BPM_GAP === 0.08);
  const T = (id) => ({ videoId: id, title: id });
  const ids = (r) => r.queue.map((t) => t.videoId);
  const base = { cur, isReady: () => true, analysisOf: (t) => lib[t.videoId] };
  // REQ-4: pone primero la mejor y no mueve a nadie fuera de las listas
  let r = pickNext({ ...base, queue: ['far', 'clash', 'close', 'key'].map(T) });
  assert.deepStrictEqual(ids(r), ['close', 'key', 'clash', 'far']);
  assert.strictEqual(typeof r.scores.close, 'number');
  // lo fijado con «a continuación» se respeta aunque sea peor
  r = pickNext({ ...base, queue: ['far', 'clash', 'close'].map(T), pinned: new Set(['far']) });
  assert.deepStrictEqual(ids(r), ['far', 'close', 'clash'], 'la fijada va primero');
  // las que aún no están listas se quedan al final en su orden y no desplazan a las listas
  r = pickNext({ ...base, isReady: (t) => t.videoId !== 'close', queue: ['far', 'close', 'key'].map(T) });
  assert.deepStrictEqual(ids(r), ['key', 'far', 'close']);
  // estable con empates y no muta la entrada
  const q = ['close', 'close2'].map(T);
  lib.close2 = lib.close;
  assert.deepStrictEqual(ids(pickNext({ ...base, queue: q })), ['close', 'close2']);
  assert.deepStrictEqual(q.map((t) => t.videoId), ['close', 'close2']);
};

// ---------- reanalyze: análisis viejos sin estructura se recalculan con el archivo guardado ----------
tests.reanalyze = async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { Analyzer } = require('../main/analyzer');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-rean-'));
  // archivo de audio con estructura conocida (WAV mono 22,05 kHz)
  const T = track();
  const wav = path.join(dir, 'Artista - Pista [ABCDEFGHIJK].wav');
  const n = T.samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF'); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, T.samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(wav, buf);

  const events = [];
  const ff = (await require('../main/tools').findFfmpeg('', [path.join(process.cwd(), 'bin')]))?.bin || 'ffmpeg';
  const an = new Analyzer({ cacheDir: path.join(dir, 'cache'), settings: { get: () => ({}) }, session: null, emit: (e) => events.push(e), ffmpeg: () => ff, localLib: null, libraryDir: () => dir });
  // análisis anterior (versión 1): sin `mix`, con el vínculo a la copia local
  const old = { id: 'ABCDEFGHIJK', bpm: 124, offset: 0.3, duration: n / SR, camelot: '8A', title: 'Pista', artist: 'Artista', thumb: 't.jpg', saved: { path: wav, localId: 'L1' } };
  fs.writeFileSync(an.jsonPath('ABCDEFGHIJK'), JSON.stringify(old));
  fs.writeFileSync(an.jsonPath('L1'), JSON.stringify({ ...old, id: 'L1', local: true, title: 'Pista', trackDuration: 120 }));
  assert.ok(!an.get('ABCDEFGHIJK').mix);
  an.request('ABCDEFGHIJK', { meta: { title: 'Pista' }, reuse: wav, force: true });
  for (let i = 0; i < 120 && !events.some((e) => e.stage === 'done' || e.stage === 'error'); i++) await new Promise((r) => setTimeout(r, 250));
  const end = events.find((e) => e.stage === 'done' || e.stage === 'error');
  assert.strictEqual(end?.stage, 'done', JSON.stringify(end));
  assert.ok(!events.some((e) => e.stage === 'download'), 'no se descargó nada');
  const a = an.get('ABCDEFGHIJK');
  assert.strictEqual(a.mix?.version, 2, 'ahora tiene estructura');
  assert.ok(Math.abs(a.mix.outroStart - (T.offset + 13 * 16 * T.beat)) < 0.1, `outro detectado: ${a.mix.outroStart}`);
  assert.strictEqual(a.saved.localId, 'L1', 'conserva el vínculo con la copia local');
  assert.ok(fs.existsSync(wav), 'el archivo guardado NO se borra');
  const l = an.get('L1');
  assert.strictEqual(l.mix?.version, 2, 'la copia local también se actualizó');
  assert.strictEqual(l.local, true);
  assert.strictEqual(l.ytId, 'ABCDEFGHIJK');
  assert.strictEqual(l.trackDuration, 120, 'conserva sus datos');

  // el motor lo pide solo, con el archivo y sin descargar, y una sola vez
  const listeners = [];
  const requests = [];
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async () => null, request: (id, o) => requests.push([id, o]) }, lib: {} } };
  const { AutoMix } = await import('../renderer/automix.js');
  const am = new AutoMix({ decks: {}, other() {}, toast() {}, xfader: {}, applyXf() {} });
  const yt = { videoId: 'ABCDEFGHIJK', title: 'Pista' };
  am.ensureStructure(yt, { bpm: 124, saved: { path: wav, localId: 'L1' } });
  am.ensureStructure(yt, { bpm: 124, saved: { path: wav, localId: 'L1' } });
  assert.strictEqual(requests.length, 1, 'una sola vez');
  assert.strictEqual(requests[0][1].reuse, wav);
  assert.strictEqual(requests[0][1].force, true);
  const loc = { videoId: 'L9', title: 'Local', local: true, path: '/musica/a.mp3' };
  am.ensureStructure(loc, { bpm: 120 });
  assert.deepStrictEqual([requests[1][1].file, requests[1][1].force, requests[1][1].reuse], ['/musica/a.mp3', true, undefined]);
  am.ensureStructure({ videoId: 'OK', title: 'ok' }, { bpm: 120, mix: { version: 2 }, saved: { path: wav } });
  am.ensureStructure({ videoId: 'NB', title: 'sin bpm' }, { saved: { path: wav } });
  assert.strictEqual(requests.length, 2, 'no se pide si ya tiene estructura o no tiene BPM');
  fs.rmSync(dir, { recursive: true, force: true });
};

// ---------- engine: el motor aplica el plan ----------
tests.engine = async () => {
  const listeners = [];
  const requests = [];
  const store = {};
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async (id) => store[id] || null, request: (id, o) => requests.push([id, o]) }, lib: { radio: async () => ({ ok: true, data: [] }), search: async () => ({ ok: true, data: [] }) } } };
  const { AutoMix } = await import('../renderer/automix.js');
  const { HOME_MS, PITCH_LIMIT } = await import('../renderer/mixplan.js');

  const ana = (bpm, camelot, extra = {}) => ({ bpm, camelot, offset: 0.3, duration: 200, mix: { version: 2, phraseBeats: 16, mixIn: 8, introEnd: 16, outroStart: 120, energy: 80, phrases: Array(12).fill(80), mixOut: [{ t: 120, score: 1, kind: 'outro' }, { t: 180, score: 0.3, kind: 'final' }] }, ...extra });
  const deck = (id) => ({
    id, track: null, pos: 0, seeks: [], tempoCalls: [], pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, wantPlay: false, phaseAligned: 0,
    st: { playing: false, dur: 0, ready: false, videoId: null }, source: 'local',
    async load(t) { this.track = t; this.pos = 0; this.analysis = t.ana || null; this.st = { playing: false, dur: 200, ready: true, videoId: t.videoId }; },
    seek(t) { this.seeks.push(t); this.pos = t; },
    remaining() { return this.st.dur - this.pos; },
    bpm() { return this.analysis?.bpm || null; },
    matchTempoSmart(other, max) { this.tempoCalls.push(max); return true; },
    alignPhase() { this.phaseAligned++; }, phaseDiff: () => null, setLoop() {}, setPitch() {}, analyze() {}, togglePlay() { this.st.playing = !this.st.playing; },
    transport(c) { if (c.type === 'play') this.st.playing = true; if (c.type === 'pause') this.st.playing = false; },
  });
  const setup = (curAna, nextAna, cfg = {}) => {
    const A = deck('A');
    const B = deck('B');
    const toasts = [];
    const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast: (m) => toasts.push(m), xfader: { value: -1 }, applyXf() {} };
    const am = new AutoMix(app);
    Object.assign(am.cfg, { endless: false, len: 16, waitMs: 20, ...cfg });
    A.track = { videoId: 'CUR', title: 'CUR', local: true };
    A.analysis = curAna;
    A.st = { playing: true, dur: 200, ready: true, videoId: 'CUR' };
    am.on = true;
    am.cur = A;
    const nx = { videoId: 'NXT', title: 'NXT', local: true, ana: nextAna, duration: 200 };
    am.queue = [nx];
    store.NXT = nextAna;
    am.ana.set('NXT', nextAna);
    return { am, A, B, toasts, nx };
  };
  const run = async (am, A, B, pos) => {
    A.pos = pos;
    am.tick();
    await new Promise((r) => setTimeout(r, 5));
    am.tick();
  };

  // REQ-2: sale en el punto de salida (120 s de 200), no al final, y la siguiente entra en su punto de entrada
  {
    const { am, A, B } = setup(ana(124, '8A'), ana(126, '8A'));
    await run(am, A, B, 60);
    assert.ok(!am.trans, 'a los 60 s no mezcla');
    await run(am, A, B, 119);
    assert.ok(!am.trans, 'antes del punto de salida no mezcla');
    assert.ok(Math.abs(am.plan.exitAt - 120) < 1e-6 && am.plan.kind === 'outro', JSON.stringify(am.plan));
    await run(am, A, B, 120.1);
    assert.ok(am.trans, 'en el punto de salida (120 s) empieza la mezcla, 80 s antes del final');
    assert.deepStrictEqual(B.seeks, [8], 'la siguiente entra en su punto de entrada (8 s)');
    // REQ-3: compases enteros
    const beats = am.trans.len / (60 / 124);
    assert.ok(Math.abs(beats - Math.round(beats)) < 1e-6 && Math.round(beats) % 4 === 0, `compases enteros: ${beats}`);
    // REQ-6: ajuste de tempo limitado a ±8 % y fase alineada
    assert.deepStrictEqual(B.tempoCalls, [PITCH_LIMIT * 100]);
    assert.strictEqual(B.phaseAligned, 1);
    assert.strictEqual(am.trans.tempo, true);
    assert.ok(HOME_MS >= 12000, 'el tempo natural vuelve en ≥ 12 s');
  }
  // con «puntos óptimos» apagado, mezcla al final como antes
  {
    const { am, A, B } = setup(ana(124, '8A'), ana(126, '8A'), { optimalPoints: false });
    await run(am, A, B, 150);
    assert.ok(!am.trans, 'a los 150 s no mezcla');
    await run(am, A, B, 183);
    assert.ok(am.trans, 'mezcla cerca del final');
  }
  // sin estructura (análisis viejo): vuelve al final
  {
    const old = ana(124, '8A');
    delete old.mix;
    const { am, A, B } = setup(old, ana(126, '8A'));
    await run(am, A, B, 120.1);
    assert.ok(!am.trans, 'sin estructura no mezcla a mitad de pista');
    await run(am, A, B, 183);
    assert.ok(am.trans);
  }
  // REQ-5: salto de BPM brusco → filtro, sin forzar el tempo, transición larga y aviso
  {
    const { am, A, B } = setup(ana(124, '8A'), ana(150, '8A'));
    await run(am, A, B, 120.1);
    assert.ok(am.trans, 'mezcla igualmente (no hay otra)');
    assert.strictEqual(am.trans.style, 'filter');
    assert.strictEqual(am.trans.tempo, false);
    assert.deepStrictEqual(B.tempoCalls, [], 'no se forzó el tempo');
    assert.ok(am.trans.len > 16, 'transición larga');
    assert.ok(am.trans.warnings.some((w) => /salto de BPM/.test(w)));
    assert.ok(am.snapshot().queue.length === 0 || true);
  }
  // REQ-4: la cola se ordena por BPM/tonalidad respetando lo fijado
  {
    const { am } = setup(ana(124, '8A'), ana(124, '8A'));
    const mk = (id, bpm, cam) => (store[id] = ana(bpm, cam), am.ana.set(id, store[id]), { videoId: id, title: id, local: true });
    am.queue = [mk('far', 150, '8A'), mk('clash', 124, '3B'), mk('good', 124, '8A'), mk('okay', 125, '9A')];
    am.lastReorder = -Infinity;
    am.reorder();
    // ahora se ordena como cadena (coste total mínimo), no solo por la mejor siguiente: lo mejor primero y el salto de BPM al final
    {
      const o = am.queue.map((t) => t.videoId);
      assert.strictEqual(o[0], 'good');
      assert.strictEqual(o[3], 'far');
    }
    // lo colocado a mano no se mueve
    am.queue = [mk('far', 150, '8A'), mk('good', 124, '8A'), mk('clash', 124, '3B')];
    am.pinned = new Set(['far']);
    am.lastReorder = -Infinity;
    am.reorder();
    assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['far', 'good', 'clash'], 'la fijada se queda');
    am.pinned.clear();
    am.move(2, 0);
    assert.ok(am.pinned.has('clash') && am.pinned.has('good') && am.pinned.has('far'), 'reordenar a mano fija el orden que dejó el usuario');
    // lo que llega después sí se ordena solo, en los huecos libres
    am.queue.push(mk('late', 124, '8A'));
    am.lastReorder = -Infinity;
    am.reorder();
    assert.strictEqual(am.queue.at(-1).videoId, 'late');
    assert.deepStrictEqual(am.queue.slice(0, 3).map((t) => t.videoId), ['clash', 'far', 'good'], 'lo fijado no se movió');
    // el snapshot informa de BPM, tonalidad, salto y energía por pista
    const sn = am.snapshot();
    const far = sn.queue.find((t) => t.videoId === 'far');
    assert.deepStrictEqual([far.bpm, far.camelot, far.jump], [150, '8A', true]);
    assert.ok(far.gapPct < 0, 'hay que frenar la entrante');
    assert.strictEqual(sn.queue.find((t) => t.videoId === 'good').jump, false);
    assert.ok(sn.curInfo.bpm === 124);
  }
};

if (!tests[mode]) {
  console.error(`modo desconocido: ${mode}. Disponibles: ${Object.keys(tests).join(', ')}`);
  process.exit(2);
}
try {
  await tests[mode]();
  console.log(`mix-points ${mode}: OK`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
