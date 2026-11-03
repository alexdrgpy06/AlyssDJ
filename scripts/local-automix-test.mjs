// Prueba de AutoMix en modo local (se lanza desde test-local.js automix): las sugerencias salen de la música del equipo.
import assert from 'node:assert';
const calls = { radio: 0, search: 0, similar: [] };
let similar = [];
const listeners = [];
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { ytdj: { analysis: { onEvent: (cb) => listeners.push(cb), get: async () => null, request() {}, list: async () => [] },
  lib: { radio: async () => (calls.radio++, { ok: true, data: [{ videoId: 'YT1', title: 'Remoto', artist: 'Web' }] }), search: async () => (calls.search++, { ok: true, data: [{ videoId: 'YTSEED', title: 's', artist: 'a' }] }), popularity: async () => ({ ok: true, data: {} }) },
  local: { similar: async (id, n) => (calls.similar.push([id, n]), { ok: true, data: similar }) } } };
const { AutoMix } = await import('../renderer/automix.js');
const deck = (id) => ({ id, fxc: { slots: [{ on: false }, { on: false }, { on: false }], owners: [], set() {}, ramp() {} }, track: null, pos: 0, st: { playing: false, dur: 240, ready: true }, analysis: null, bpm() { return null; } });
function engine({ localMode = false, scope = 'all' } = {}) {
  const A = deck('A'), B = deck('B');
  const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast() {}, xfader: { value: -1 }, applyXf() {}, localMode, library: { effectiveScope: () => scope } };
  const am = new AutoMix(app); am.cfg.endless = true; am.cfg.popularity = true;
  A.track = { videoId: 'L0', title: 'Semilla', artist: 'Yo', local: true }; am.cur = A; am.on = true;
  return am;
}
const loc = (id, o = {}) => ({ videoId: id, title: id, artist: 'x', duration: 200, local: true, sources: ['Mi equipo'], ...o });

// REQ-6: en modo local la cola sale de local.similar y nunca toca YouTube Music
similar = [loc('L1'), loc('L2'), { videoId: 'YT9', title: 'Solo web', artist: 'w', duration: 200, sources: ['YouTube Music'] }, loc('L0')];
let am = engine({ localMode: true });
await am.ensureQueue(true);
assert.strictEqual(calls.radio + calls.search, 0, 'no se consulta YouTube Music en modo local');
assert.deepStrictEqual(calls.similar[0], ['L0', 30]);
assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['L1', 'L2'], `cola: ${am.queue.map((t) => t.videoId)}`);
assert.ok(am.queue.every((t) => t.local), 'solo pistas reproducibles del equipo');

// también con el ámbito «Mi equipo» y la red disponible
calls.similar.length = 0; am = engine({ scope: 'local' });
await am.ensureQueue(true);
assert.strictEqual(calls.radio, 0); assert.strictEqual(am.queue.length, 2);

// sin candidatas: aviso claro y sin salir a la red
similar = []; am = engine({ localMode: true });
await am.ensureQueue(true);
assert.strictEqual(am.queue.length, 0); assert.match(am.note, /Analiza más música/); assert.match(am.note, /Mi equipo/); assert.strictEqual(calls.radio, 0);

// con red y ámbito «Todo» la radio sigue siendo la de YouTube Music
similar = [loc('L1')]; am = engine();
await am.ensureQueue(true);
assert.strictEqual(calls.radio, 1, 'con red usa la radio'); assert.deepStrictEqual(am.queue.map((t) => t.videoId), ['YT1']);
console.log('local automix: OK');
