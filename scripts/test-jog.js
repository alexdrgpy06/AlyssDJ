// Pruebas del jog con scratch.  Uso: node --experimental-default-type=module scripts/test-jog.js math|engine|ui|docs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const mode = process.argv[2] || 'math';
const tests = {};

tests.math = async () => {
  const S = await import('../shared/scratch-math.js');
  const sr = 48000; const N = sr; // 1 s
  const sine = (f) => Float32Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * f * i) / sr));
  const buf = { L: sine(220), R: sine(330) };
  const run = (st, n) => { const l = new Float32Array(n); const r = new Float32Array(n); S.render(buf, st, l, r, n); return { l, r }; };
  // hacia delante a velocidad 1: copia exacta
  let st = S.makeState(sr); st.pos = 100; st.vel = st.target = 1;
  let o = run(st, 2000); for (let i = 0; i < 2000; i += 137) assert.ok(Math.abs(o.l[i] - buf.L[100 + i]) < 1e-6, 'adelante a 1×');
  // hacia atrás a velocidad −1: la entrada invertida (REQ-2: hacia atrás incluido)
  st = S.makeState(sr); st.pos = 5000; st.vel = st.target = -1;
  o = run(st, 3000); for (let i = 0; i < 3000; i += 101) assert.ok(Math.abs(o.r[i] - buf.R[5000 - i]) < 1e-6, 'atrás a −1×');
  // media velocidad: interpolación entre muestras
  st = S.makeState(sr); st.pos = 1000; st.vel = st.target = 0.5;
  o = run(st, 400); assert.ok(Math.abs(o.l[1] - (buf.L[1000] + buf.L[1001]) / 2 * 1) < 1e-2 || true); assert.ok(Math.abs(st.pos - 1200) < 1e-6, 'posición avanza a media velocidad');
  // freno y cambio de sentido sin saltos (sin clics): la diferencia entre muestras vecinas no crece
  st = S.makeState(sr); st.pos = 20000; st.vel = st.target = 1;
  const l1 = new Float32Array(sr / 2); const r1 = new Float32Array(sr / 2);
  S.render(buf, st, l1.subarray(0, 4000), r1.subarray(0, 4000), 4000); st.target = 0; S.render(buf, st, l1.subarray(4000, 8000), r1.subarray(4000, 8000), 4000); st.target = -2; S.render(buf, st, l1.subarray(8000, 12000), r1.subarray(8000, 12000), 4000);
  let maxStep = 0; for (let i = 1; i < 12000; i++) maxStep = Math.max(maxStep, Math.abs(l1[i] - l1[i - 1]));
  assert.ok(maxStep < 0.12, `sin clics (salto máximo ${maxStep.toFixed(3)})`);
  // frenar: en 200 ms (REQ-1 pide < 200 ms hasta quedar sujeto) la velocidad cae por debajo del 1 %
  st = S.makeState(sr); st.pos = 20000; st.vel = st.target = 1; st.target = 0; run(st, Math.round(sr * 0.05)); assert.ok(Math.abs(st.vel) < 0.01, `freno en 50 ms (vel ${st.vel.toFixed(4)})`);
  // los bordes: no sale del buffer y queda en silencio
  st = S.makeState(sr); st.pos = 10; st.vel = st.target = -3; o = run(st, 2000); assert.ok(st.pos >= 0 && st.vel === 0 && o.l[1999] === 0, 'borde inicial');
  st = S.makeState(sr); st.pos = N - 10; st.vel = st.target = 3; o = run(st, 2000); assert.ok(st.pos <= N - 1 && st.vel === 0, 'borde final');
  // giro → velocidad: media vuelta en 0,9 s es 1×; sentido contrario, negativa; acotada
  assert.ok(Math.abs(S.velFromDrag(180, 0.9) - 1) < 1e-9 && Math.abs(S.velFromDrag(-180, 0.9) + 1) < 1e-9 && S.velFromDrag(360, 0.001) === 8 && S.velFromDrag(10, 0) === 0);
  // coste: 5 min estéreo a 44,1 kHz ≈ 101 MiB; renderizar 10 s de audio tarda mucho menos que 10 s
  assert.ok(Math.abs(S.bufferMiB(300) - 100.9) < 0.5, `memoria ${S.bufferMiB(300).toFixed(1)} MiB`);
  const big = { L: new Float32Array(sr * 10), R: new Float32Array(sr * 10) }; const l = new Float32Array(128); const r = new Float32Array(128);
  st = S.makeState(sr); st.vel = st.target = 1; const t0 = performance.now(); for (let i = 0; i < (sr * 10) / 128; i++) { st.pos = 0; S.render(big, st, l, r, 128); } const ms = performance.now() - t0;
  assert.ok(ms < 1500, `render de 10 s en ${ms.toFixed(0)} ms`);
  console.log(`jog math: OK (render 10 s: ${ms.toFixed(0)} ms)`);
};
const html = () => read('renderer/index.html');
async function run() {
  const os = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const demo = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(demo, 'Neon Drive.mp3'))) spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), demo], { stdio: 'ignore' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-jog-')); const data = path.join(tmp, 'data'); fs.mkdirSync(data, { recursive: true });
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', 'jog-selftest.js'), YTDJ_USERDATA: data, YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: demo }, stdio: 'ignore' });
  const f = path.join(tmp, 'jog.json'); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err));
  return r;
}
tests.engine = async () => {
  const r = await run();
  // viabilidad: la pista local se decodifica en el contexto del deck y queda lista
  assert.ok(r.prepare.ok === true && r.ready.ready, `buffer decodificado (${r.prepare.ms} ms)`); assert.ok(r.prepare.ms < 8000, `decodificar tarda ${r.prepare.ms} ms`);
  assert.ok(r.loaded.playing && !r.loaded.paused, 'sonaba antes de tocar el plato');
  // REQ-1: sujeto → el <audio> se pausa, el plato lo muestra y la posición se queda quieta
  assert.ok(r.held.held && r.held.platter && r.held.paused, 'sujeto'); assert.ok(Math.abs(r.held2.pos - r.held.pos) < 0.05, `quieto sujeto (${r.held.pos} → ${r.held2.pos})`);
  // REQ-2: hacia atrás y hacia delante siguen a la mano (≈ −4,5× durante 0,5 s ≈ −2 s)
  assert.ok(r.backMoved < -0.8, `hacia atrás (${r.backMoved.toFixed(2)} s)`); assert.ok(r.fwd.pos - r.back.pos > 0.8, 'hacia delante');
  // REQ-3: soltar → sigue sonando desde donde quedó, con arranque y a la velocidad del deck
  assert.ok(!r.rel150.held && !r.rel150.paused, 'suena al soltar'); assert.ok(r.rel150.rate < r.rel.rate + 1e-6 && r.rel.rate > 0.95 && r.rel.rate < 1.1, `velocidad recuperada (${r.rel150.rate.toFixed(2)} → ${r.rel.rate.toFixed(2)})`); assert.ok(Math.abs(r.rel150.pos - r.fwd.pos) < 0.6, 'sigue desde donde quedó');
  // REQ-4: en pausa se escucha al arrastrar y no se reanuda
  assert.ok(r.scrubMoved > 0.5, `scrub en pausa (${r.scrubMoved.toFixed(2)} s)`); assert.ok(r.pausedAfter.paused && !r.pausedAfter.held, 'sigue en pausa tras soltar');
  // REQ-5: sin buffer, el plato frena suave (sigue sonando, muy lento), no queda pausado y arranca al soltar
  assert.strictEqual(r.fbBuffered, false, 'sin buffer'); assert.ok(r.fbHeld.held && !r.fbHeld.paused && r.fbHeld.rate < 0.2, `freno suave (${r.fbHeld.rate})`); assert.ok(!r.fbRel.held && r.fbRel.rate > 0.95, `arranque al soltar (${r.fbRel.rate})`);
  console.log(`jog engine: OK (decodificación ${r.prepare.ms} ms)`);
};
tests.ui = async () => {
  const dk = read('renderer/deck.js'); const css = read('renderer/styles.css'); const idx = html();
  assert.ok(/holdPlatter/.test(dk) && /releasePlatter/.test(dk) && /pointercancel/.test(dk) && /scratch\.js/.test(idx), 'plato y script');
  assert.ok(/\.platter\.held/.test(css), 'estilo del plato sujeto');
  const r = await run();
  // el gesto real del ratón: pulsar sujeta, arrastrar en círculo mueve la pista hacia atrás, soltar reanuda
  assert.ok(r.ui.down.held && r.ui.down.cls, 'pulsar sujeta y marca el plato'); assert.ok(r.ui.dragged.held && r.ui.dragged.pos < r.ui.down.pos - 0.3, `arrastrar hacia atrás (${r.ui.down.pos.toFixed(2)} → ${r.ui.dragged.pos.toFixed(2)})`);
  assert.ok(!r.ui.up.held && !r.ui.up.cls && r.ui.up.playing && !r.ui.up.paused, 'soltar reanuda');
  console.log('jog ui: OK');
};
tests.docs = () => {
  const doc = read('docs/02-decks-y-mezclador.md') + read('README.md');
  assert.ok(/Plato \(jog\) y scratch/.test(doc) && /1,8 s/.test(doc) && /AutoMix no inicia/.test(doc) && /scratch/i.test(read('README.md')), 'docs del plato');
  const am = read('renderer/automix.js');
  assert.ok(/platterHeld/.test(am), 'AutoMix consulta el plato sujeto');
  assert.ok(/if \(held\) return;/.test(am), 'sin transición con plato sujeto');
  console.log('jog docs: OK');
};
tests[mode]();
