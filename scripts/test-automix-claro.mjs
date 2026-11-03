// Pruebas puras de «AutoMix claro»: estado, compatibilidad, perfiles y robustez. Sin Electron.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
const mode = process.argv[2] || 'all';
const run = (name, fn) => { if (mode === 'all' || mode === name) { fn(); console.log(`ok ${name}`); } };

const { describe, PHASES } = await import('../renderer/automix-status.js');
const { compat } = await import('../renderer/automix-compat.js');
const { PROFILES, applyProfile, detect, lastProfile } = await import('../renderer/automix-profiles.js');

const base = { on: true, trans: null, pendingMix: null, plan: null, pos: null, next: null, nextReady: false, queue: [], fx: { level: 'subtle' }, note: '' };

run('status', () => {
  assert.equal(describe({ ...base, on: false }).phase, 'stopped');
  assert.equal(describe({ ...base, on: false }).text, 'Detenido');
  assert.equal(describe(base).phase, 'playing');
  assert.match(describe(base).reason, /cola está vacía/);
  const prep = describe({ ...base, next: { title: 'Aria' }, nextReady: false, queue: [{ prep: { state: 'download' } }] });
  assert.equal(prep.phase, 'preparing');
  assert.match(prep.text, /Preparando la siguiente: Aria/);
  const far = describe({ ...base, next: { title: 'Aria' }, nextReady: true, plan: { exitAt: 200 }, pos: 20 });
  assert.equal(far.phase, 'playing');
  assert.match(far.text, /mezcla en 3:00/);
  const near = describe({ ...base, next: { title: 'Aria' }, nextReady: true, plan: { exitAt: 100 }, pos: 80 });
  assert.equal(near.phase, 'waiting');
  assert.equal(near.countdown, 20);
  assert.ok(near.text.startsWith(PHASES.waiting));
  const pend = describe({ ...base, pendingMix: { ready: true, kind: 'phrase', waitS: 4.26, seconds: 12 } });
  assert.equal(pend.phase, 'waiting');
  assert.match(pend.text, /^Mezclando en 4\.3 s · salida en frase · dura 12 s$/);
  assert.match(describe({ ...base, pendingMix: { ready: false } }).text, /en cuanto la siguiente esté lista/);
  const mix = describe({ ...base, trans: { from: 'A', to: 'B', style: 'bass', why: 'mismo BPM', tempo: true, len: 20, progress: 0.25, warnings: [] } });
  assert.equal(mix.phase, 'mixing');
  assert.match(mix.text, /^Mezclando A → B · bass swap \(mismo BPM\) · tempo igualado · efectos sutiles$/);
  assert.equal(mix.countdown, 15);
  const err = describe({ ...base, next: { title: 'X' }, nextReady: false, queue: [{ prep: { state: 'error', error: 'sin red' } }] });
  assert.match(err.reason, /Falló: sin red/);
});

run('compat', () => {
  const a = { bpm: 124, camelot: '8A', mix: { energy: 60 } };
  const good = compat(a, { bpm: 124.5, camelot: '8A', mix: { energy: 62 } }, { cost: 2 });
  assert.equal(good.level, 'good');
  assert.match(good.why, /misma tonalidad/);
  assert.match(good.why, /energía parecida/);
  const poor = compat(a, { bpm: 150, camelot: '3B', mix: { energy: 20 } }, { cost: 120 });
  assert.equal(poor.level, 'poor');
  assert.match(poor.why, /salto de BPM/);
  assert.match(poor.why, /cambio fuerte de energía/);
  assert.equal(compat(a, { bpm: 126, camelot: '9A', mix: { energy: 55 } }, { cost: 9 }).level, 'ok');
  const un = compat(a, {}, { analyzed: false, file: false });
  assert.equal(un.level, 'unknown');
  assert.deepEqual(un.marks, ['sin archivo', 'sin análisis']);
});

run('profiles', () => {
  const am = { cfg: { len: 8, style: 'bass', smartOrder: false, fxLevel: 'full' }, setCfg(p) { Object.assign(this.cfg, p); } };
  assert.equal(detect(am.cfg), 'custom');
  assert.ok(applyProfile(am, 'club'));
  assert.deepEqual({ ...am.cfg }, { len: 12, style: 'auto', smartOrder: true, fxLevel: 'subtle' });
  assert.equal(detect(am.cfg), 'club');
  assert.equal(lastProfile(), 'club');
  applyProfile(am, 'soft');
  assert.equal(detect(am.cfg), 'soft');
  applyProfile(am, 'custom');
  assert.equal(am.cfg.len, 24, 'Personalizado no cambia nada');
  assert.equal(lastProfile(), 'custom');
  assert.equal(applyProfile(am, 'nope'), false);
  assert.deepEqual(Object.keys(PROFILES), ['soft', 'club', 'radio', 'custom']);
});

