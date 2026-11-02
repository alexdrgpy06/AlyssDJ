// Pruebas de las recetas DJ de AutoMix (puras, sin audio).
//   node --experimental-default-type=module scripts/test-recipes.js [model|docs]
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
const mode = process.argv[2] || 'model';
const R = await import('../renderer/recipes.js');

const phrases = (n, v = 60) => new Array(n).fill(v);
const ana = (bpm, camelot = '8A', o = {}) => ({ bpm, camelot, offset: 0, duration: 240, mix: { mixIn: 0, introEnd: 32 * (60 / bpm), outroStart: 240 - 32 * (60 / bpm), phrases: phrases(30), phraseBeats: 16, ...(o.mix || {}) }, ...o, });
const plan = (cur, o = {}) => ({ exitAt: 200, enterAt: 0, seconds: 16 * (60 / cur.bpm) * 2, ...o });
const onGrid = (v, beat) => Math.abs(v / beat - Math.round(v / beat)) < 2e-3;

const tests = {};
tests.model = () => {
  // REQ-6: elección automática
  const A = ana(124), B = ana(124, '9A');
  assert.strictEqual(R.chooseStyle(A, B, plan(A), 'auto').style, 'bass');
  assert.strictEqual(R.chooseStyle(A, ana(124, '8A', { mix: { introEnd: 6, phrases: phrases(30) } }), plan(A), 'auto').style, 'filter', 'intro corta → filtro');
  assert.strictEqual(R.chooseStyle(A, ana(140), plan(A), 'auto').style, 'echo-cut', 'salto grande de BPM');
  assert.strictEqual(R.chooseStyle(A, ana(124, '3B'), plan(A), 'auto').style, 'filter', 'tonalidad en conflicto con tempo parecido: filtro largo, no corte');
  assert.strictEqual(R.chooseStyle(A, ana(133, '3B'), plan(A), 'auto').style, 'echo-cut', 'tonalidad en conflicto y tempo algo distinto');
  assert.strictEqual(R.chooseStyle(A, ana(128, '8A'), plan(A), 'auto').style, 'filter', 'BPM algo distinto');
  assert.strictEqual(R.chooseStyle({ ...A, bpm: null }, B, plan(A), 'auto').style, 'crossfade', 'sin BPM');
  assert.ok(R.chooseStyle(A, B, plan(A), 'auto').why.length > 5);
  assert.deepStrictEqual(R.chooseStyle(A, B, plan(A), 'filter'), { style: 'filter', why: 'estilo elegido' });
  // REQ-4: rotura de la saliente + entrante fuerte → corte en la caída
  const E = phrases(30, 70); for (let k = 12; k < 14; k++) E[k] = 15; for (let k = 14; k < 30; k++) E[k] = 80;
  const brk = ana(124, '8A', { mix: { phrases: E, phraseBeats: 16, introEnd: 6 } });
  const exit = 12 * 16 * (60 / 124) - 4;
  const dc = R.chooseStyle(brk, ana(124, '8A', { mix: { phrases: phrases(30, 90), introEnd: 6 } }), { exitAt: exit, enterAt: 0, seconds: 20 }, 'auto');
  assert.strictEqual(dc.style, 'drop-cut', dc.why);
  // REQ-1/2/3/5: rejilla y estructura de cada receta
  for (const bpm of [100, 124, 128, 140]) for (const style of ['bass', 'filter', 'crossfade', 'echo-cut', 'drop-cut']) {
    const cur = ana(bpm); const p = plan(cur); const rec = R.planRecipe({ style, cur, plan: p, level: 'subtle' });
    const beat = 60 / bpm;
    assert.ok(rec.len <= p.seconds + 1e-3 && rec.len > 0, `${style} ${bpm}: len ${rec.len}`);
    for (const gs of rec.gestures) {
      assert.ok(onGrid(gs.at, beat) && onGrid(gs.end, beat), `${style} ${bpm}: ${gs.id} fuera de la rejilla (${gs.at}-${gs.end})`);
      assert.ok(gs.at >= 0 && gs.end <= rec.len + 1e-3 && gs.end >= gs.at, `${style} ${gs.id} dentro de la mezcla`);
    }
  }
  const cur = ana(124), beat = 60 / 124;
  const bass = R.planRecipe({ style: 'bass', cur, plan: plan(cur) });
  const sw = bass.gestures.find((x) => x.id === 'swap-sale');
  assert.ok(bass.swapBeat % 16 === 0 && Math.abs(sw.at - bass.swapBeat * beat) < 2e-3, 'el swap cae en inicio de frase');
  assert.ok(sw.at >= 4 * beat && sw.end <= bass.len - 4 * beat, 'un compás limpio antes y después');
  assert.strictEqual(bass.gestures.find((x) => x.id === 'graves-entrante').to, -1, 'entra con el grave cortado');
  const fl = R.planRecipe({ style: 'filter', cur, plan: plan(cur) });
  const sweep = fl.gestures.find((x) => x.id === 'barrido-saliente');
  assert.ok((sweep.end - sweep.at) / beat >= 8 - 1e-6 && Math.abs(sweep.end - fl.len) < 1e-3, 'barrido de 8 o 16 pulsos al final');
  // el intercambio de graves dura un compás y los cortes se hacen con una rampa de un pulso (nada de saltos)
  assert.ok(Math.abs((sw.end - sw.at) - 4 * beat) < 2e-3, 'swap de un compás');
  // todas las recetas salvo el fundido llevan un bass swap (el grave cambia de pista con una rampa) y nunca un salto
  for (const st of ['bass', 'filter', 'echo-cut', 'drop-cut']) { const gsx = R.planRecipe({ style: st, cur, plan: plan(cur) }).gestures; assert.ok(gsx.some((x) => x.deck === 'from' && x.param === 'eqLow' && x.to === -1 && x.curve === 'ease') && gsx.some((x) => x.deck === 'to' && x.param === 'eqLow' && x.to === 0 && x.curve === 'ease'), `${st}: bass swap`); assert.ok(gsx.filter((x) => x.param === 'x').every((x) => x.curve === 'ease' && x.end > x.at), `${st}: crossfader con rampa`); }
  // en Auto la duración la sugiere el análisis y se respeta
  assert.strictEqual(R.chooseStyle(A, B, plan(A), 'auto').beats, 32); assert.strictEqual(R.chooseStyle(A, ana(140), plan(A), 'auto').beats, 8);
  assert.strictEqual(R.planRecipe({ style: 'echo-cut', cur, plan: plan(cur), beats: 8 }).len, 8 * beat);
  const ec = R.planRecipe({ style: 'echo-cut', cur, plan: plan(cur) });
  const echo = ec.gestures.find((x) => x.id === 'eco-salida');
  assert.ok(echo && Math.abs(echo.at - (ec.len - 4 * beat)) < 2e-3 && [0.5, 0.75].includes(echo.delay), 'eco en el último compás con retardo 1/2 o 3/4');
  assert.strictEqual(Math.round(ec.gestures.find((x) => x.id === 'fundido').end * 1000), Math.round(ec.len * 1000), 'el fundido termina en la línea de compás');
  // REQ-7: nivel de efectos
  const names = (lv, st) => R.planRecipe({ style: st, cur, plan: plan(cur), level: lv }).gestures.filter((x) => x.fx).map((x) => x.fx);
  assert.deepStrictEqual(names('off', 'echo-cut'), []); assert.deepStrictEqual(names('off', 'drop-cut'), []);
  assert.deepStrictEqual(names('subtle', 'echo-cut'), ['echo']); assert.deepStrictEqual(names('full', 'drop-cut'), ['reverb']);
  assert.ok(R.planRecipe({ style: 'bass', cur, plan: plan(cur), level: 'off' }).gestures.some((x) => x.param === 'eqLow'), 'EQ y filtro no dependen del nivel');
  // valores interpolados
  const gs = { at: 2, end: 4, from: 0, to: 1, curve: 'lin' };
  assert.strictEqual(R.gestureValue(gs, 1), null); assert.strictEqual(R.gestureValue(gs, 3), 0.5); assert.strictEqual(R.gestureValue(gs, 9), 1);
  console.log('recipes model: OK');
};
tests.docs = () => {
  const doc = readFileSync(new URL('../docs/04-automix.md', import.meta.url), 'utf8') + readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const lc = doc.toLowerCase();
  for (const w of ['Auto', 'bass swap + eco', 'en la caída', 'duración', 'rejilla']) assert.ok(lc.includes(w.toLowerCase()), `la documentación menciona «${w}»`);
  console.log('recipes docs: OK');
};
tests[mode]();
