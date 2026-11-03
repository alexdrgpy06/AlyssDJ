// Pruebas del cambio automix-entrada-inteligente.
//   node --experimental-default-type=module scripts/test-entrada.js pick|plan   ·   node scripts/test-entrada.js ui|docs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const modes = (process.argv[2] || 'pick').split(',');
const tests = {};

// Análisis sintético: `phr` es la energía por frase (0–100); mixIn/introEnd se dan en frases.
function ana({ bpm = 124, offset = 0.3, phr, mixIn = 0, introEnd = 0, camelot = '8A', edit } = {}) {
  const phrase = (16 * 60) / bpm;
  const t = (k) => Math.round((offset + k * phrase) * 1000) / 1000;
  const body = phr.filter((v) => v >= 60);
  const out = { bpm, offset, camelot, duration: offset + phr.length * phrase + 1, mix: { phraseBeats: 16, phrases: phr, mixIn: t(mixIn), introEnd: t(introEnd), outroStart: t(phr.length - 3), mixOut: [{ t: t(phr.length - 3), score: 1, kind: 'outro' }], energy: body.length ? Math.round(body.reduce((a, b) => a + b, 0) / body.length) : 50 } };
  if (edit != null) out.mixEdit = { in: edit, outs: [] };
  out.phrase = phrase; out.at = t;
  return out;
}
const cur = (exitEnergy = 30) => ana({ phr: [80, 80, 80, 80, 80, 80, 80, 80, exitEnergy, exitEnergy, exitEnergy, exitEnergy], mixIn: 0, introEnd: 0 });
const shortIntro = () => ana({ phr: [25, 30, 80, 85, 85, 85, 85, 85, 80, 40, 30, 25], mixIn: 0, introEnd: 2 });
const longIntro = () => ana({ phr: [20, 20, 22, 22, 25, 25, 85, 85, 85, 85, 85, 85, 80, 40, 30, 25], mixIn: 0, introEnd: 6 });
const withDrop = () => ana({ phr: [30, 30, 32, 34, 36, 38, 40, 42, 95, 95, 95, 95, 90, 40, 30, 25], mixIn: 0, introEnd: 6 });

tests.pick = async () => {
  const { pickEntry, entryCandidates } = await import('../renderer/mixplan.js');
  // REQ-1: varios candidatos alineados a frase; la intro corta entra por su inicio
  const s = shortIntro(); const e1 = pickEntry(cur(), s, { exitAt: cur().at(8), seconds: 16 });
  assert.strictEqual(e1.kind, 'intro', `intro corta: ${JSON.stringify(e1)}`); assert.strictEqual(e1.t, s.mix.mixIn);
  // intro larga: salta a la frase que termina cuando llega la energía (REQ-5: el motivo lo cuenta)
  const l = longIntro(); const e2 = pickEntry(cur(), l, { exitAt: cur().at(8), seconds: 16 });
  assert.strictEqual(e2.kind, 'build', `intro larga: ${JSON.stringify(e2)}`); assert.match(e2.why, /salta la intro larga/); assert.ok(e2.t > l.mix.mixIn && e2.t < l.mix.introEnd);
  assert.ok(e2.cands.length >= 3 && e2.cands.some((c) => c.kind === 'intro') && e2.cands.some((c) => c.kind === 'strong'), 'se evaluaron varios puntos');
  // REQ-2: la energía de salida cuenta: si sale a tope, prefiere un punto con más energía que el inicio de la intro
  const d = withDrop(); const lo = pickEntry(cur(20), d, { exitAt: cur().at(8), seconds: 16 }); const hi = pickEntry(cur(95), d, { exitAt: cur(95).at(8), seconds: 16 });
  const energyOf = (a, t) => a.mix.phrases[Math.max(0, Math.floor((t - a.offset) / a.phrase + 1e-6))];
  assert.ok(energyOf(d, hi.t) >= energyOf(d, lo.t), `sale fuerte → entra con más energía (${energyOf(d, hi.t)} ≥ ${energyOf(d, lo.t)})`);
  assert.ok(entryCandidates(d, 16).some((c) => c.kind === 'drop'), 'el primer drop es candidato');
  // todos los automáticos en límite de frase y nunca antes del primer compás con música (ni en silencio)
  for (const a of [s, l, d]) for (const c of entryCandidates(a, 16)) {
    const k = (c.t - a.offset) / a.phrase; assert.ok(Math.abs(k - Math.round(k)) < 1e-3 || c.kind === 'build' || c.kind === 'intro', `en frase: ${c.kind} ${k}`); assert.ok(c.t >= a.mix.mixIn, 'no antes de que haya música');
    const en = energyOf(a, c.t); assert.ok(en > 0, 'no entra en silencio');
  }
  // longitud: no entra donde la transición se pasaría del final
  const tight = longIntro(); tight.duration = tight.mix.introEnd + 3;
  const e3 = pickEntry(cur(), tight, { exitAt: cur().at(8), seconds: 16 }); assert.ok(e3.t + 16 + 2 <= tight.duration || e3.kind === 'intro', `cabe: ${JSON.stringify(e3)}`);
  // compás y motivo siempre presentes
  for (const e of [e1, e2, lo, hi, e3]) { assert.ok(e.why && e.why.length > 8, 'motivo'); assert.ok(e.bar >= 1, 'compás'); }
  // REQ-3: lo del usuario manda, aunque no esté en límite de frase
  const u = longIntro(); u.mixEdit = { in: 12.345, outs: [] }; const e4 = pickEntry(cur(), u, { exitAt: 10, seconds: 16 });
  assert.deepStrictEqual([e4.kind, e4.t], ['edit', 12.345]); assert.match(e4.why, /marcaste/);
  // REQ-7: sin análisis, por el inicio y avisando
  const e5 = pickEntry(cur(), { videoId: 'x' }, { exitAt: 10, seconds: 16 }); assert.deepStrictEqual([e5.kind, e5.t], ['start', 0]); assert.match(e5.why, /sin análisis/);
  const e6 = pickEntry(cur(), { bpm: 120, offset: 0.4 }, { exitAt: 10, seconds: 16 }); assert.strictEqual(e6.kind, 'start'); assert.strictEqual(e6.t, 0.4);
  // pura: no muta nada
  const snap = JSON.stringify(l); pickEntry(cur(), l, { exitAt: 10, seconds: 16 }); assert.strictEqual(JSON.stringify(l), snap);
  console.log('entrada pick: OK');
};

tests.plan = async () => {
  const { planTransition, planNearest, pickEntry } = await import('../renderer/mixplan.js');
  const { previewPlan } = await import('../renderer/mixpreview.js');
  const c = cur(30); const l = longIntro(); const sh = shortIntro();
  // REQ-1: la transición programada usa el punto elegido (no el inicio de la intro) y lo deja en el plan
  const p = planTransition(c, l, { len: 16, exitMode: 'optimal', pos: 0 });
  assert.ok(p.entry && p.enterAt === p.entry.t, 'enterAt es la entrada elegida'); assert.strictEqual(p.entry.kind, 'build'); assert.ok(p.enterAt > l.mix.mixIn, 'salta la intro larga');
  assert.deepStrictEqual(p.entry, pickEntry(c, l, { exitAt: p.exitAt, seconds: p.seconds }), 'mismo criterio que pickEntry con su salida y su duración');
  assert.strictEqual(planTransition(c, sh, { len: 16, exitMode: 'optimal', pos: 0 }).entry.kind, 'intro', 'intro corta: por su inicio');
  for (const mode of ['optimal', 'intro-outro', 'outro-start', 'end']) { const q = planTransition(c, l, { len: 16, exitMode: mode, pos: 0 }); assert.ok(q.entry && q.enterAt === q.entry.t, `modo ${mode}`); }
  // REQ-3: la entrada editada manda en todos los caminos
  const ed = longIntro(); ed.mixEdit = { in: 20.5, outs: [] };
  assert.strictEqual(planTransition(c, ed, { len: 16, exitMode: 'optimal', pos: 0 }).enterAt, 20.5); assert.strictEqual(planNearest(c, ed, { pos: 5, len: 16 }).enterAt, 20.5);
  assert.strictEqual(previewPlan({ a: c, b: ed, exitAt: 40, len: 16 }).enterAt, 20.5, 'la preescucha también');
  // REQ-6: «Mezclar ahora» / «Siguiente» usan el mismo criterio, con duración corta si hace falta, y nunca en silencio
  for (const pos of [0, 20, 50]) {
    const n = planNearest(c, l, { pos, len: 8 }); assert.ok(n.entry, 'tiene entrada'); assert.ok(n.enterAt >= l.mix.mixIn, 'no antes de la música'); assert.ok(n.seconds <= 16);
    assert.deepStrictEqual(n.entry, pickEntry(c, l, { exitAt: n.exitAt, seconds: n.seconds }));
    const en = l.mix.phrases[Math.floor((n.enterAt - l.offset + 0.01) / l.phrase)]; assert.ok(en > 0, 'no entra en silencio');
  }
  assert.strictEqual(previewPlan({ a: c, b: l, exitAt: 40, len: 16 }).enterAt, pickEntry(c, l, { exitAt: 40, seconds: 16 }).t, 'preescucha = pickEntry');
  // sin BPM en alguna de las dos: fundido corto ahora mismo, con entrada coherente
  const nb = planNearest({ ...c, bpm: null }, l, { pos: 3, len: 16 }); assert.strictEqual(nb.kind, 'now'); assert.ok(Number.isFinite(nb.enterAt) && nb.entry);
  // REQ-7: la siguiente sin análisis entra por el inicio y avisa en el plan
  const un = { videoId: 'sin-analisis', duration: 200 };
  const pu = planTransition(c, un, { len: 16, exitMode: 'optimal', pos: 0 }); assert.strictEqual(pu.enterAt, 0); assert.strictEqual(pu.entry.kind, 'start'); assert.ok(pu.warnings.some((w) => /sin análisis/.test(w)), `aviso: ${JSON.stringify(pu.warnings)}`);
  const pn = planNearest(c, un, { pos: 3, len: 16 }); assert.ok(pn.warnings.some((w) => /sin análisis|sin BPM/.test(w)));
  // sin tocar lo demás: la salida y la duración siguen siendo las de siempre
  const base = planTransition(c, sh, { len: 16, exitMode: 'optimal', pos: 0 }); assert.ok(base.exitAt > 0 && base.seconds > 0 && base.beats >= 8);
  console.log('entrada plan: OK');
};

function runApp(selftest, outFile) {
  const { spawnSync } = require('node:child_process'); const os = require('node:os');
  const music = path.join(root, 'docs/demo-audio');
  if (!fs.existsSync(path.join(music, 'Neon Drive.mp3'))) spawnSync('node', [path.join(root, 'scripts', 'make-demo-audio.js'), music], { stdio: 'ignore' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-entry-'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 280000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(root, 'scripts', selftest), YTDJ_USERDATA: path.join(dir, 'data'), YTDJ_SELFTEST_OUT: dir, YTDJ_DOCS_MUSIC: music }, stdio: 'ignore' });
  const f = path.join(dir, outFile); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err)); r.__dir = dir; return r;
}

tests.ui = async () => {
  const r = runApp('entrada-selftest.js', 'entrada.json');
  assert.ok(!r.auto.hidden && r.auto.strip && /^\d+:\d\d · compás \d+$/.test(r.auto.time) && r.auto.why.length > 8, `entrada visible con compás y motivo: ${JSON.stringify(r.auto)}`);
  assert.strictEqual(r.auto.entry.id, r.ids.B, 'es la de la pista que sigue'); assert.ok(!r.auto.auto && !r.auto.entry.user, 'automática: sin botón «Auto»'); assert.match(r.auto.aria, /compás/, 'accesible');
  assert.ok(r.moved.auto && /marcada por ti/.test(r.moved.why) && r.moved.entry.user, `se guardó como tuya: ${JSON.stringify(r.moved)}`);
  assert.ok(r.saved && Math.abs(r.saved.in - r.moved.entry.t) < 0.01, `guardada como punto editado: ${JSON.stringify(r.saved)}`);
  const bars = (t) => (t - r.moved.entry.offset) / (4 * r.moved.entry.beat); assert.ok(Math.abs(bars(r.saved.in) - Math.round(bars(r.saved.in))) < 0.02, 'va en un compás de la rejilla');
  assert.ok(r.saved.in > r.auto.entry.t - 1 || r.saved.in > 5, 'se movió hacia la mitad de la pista');
  assert.ok(r.key.saved && Math.abs(r.key.saved.in - (r.saved.in + 4 * r.moved.entry.beat)) < 0.05, `← → mueven un compás: ${JSON.stringify([r.saved, r.key.saved])}`);
  assert.ok(!r.reset.saved?.in && !r.reset.view.auto && !r.reset.view.entry.user, `«Auto» vuelve al cálculo: ${JSON.stringify(r.reset)}`); assert.ok(Math.abs(r.reset.view.entry.t - r.auto.entry.t) < 0.01, 'a la misma entrada automática');
  assert.ok(!r.unanalyzed.hidden && !r.unanalyzed.strip && /sin análisis/.test(r.unanalyzed.why), `sin análisis, por el inicio y avisando: ${JSON.stringify(r.unanalyzed)}`);
  console.log('entrada ui: OK');
};

tests.docs = async () => {
  const d = read('docs/04-automix.md');
  for (const re of [/Dónde entra la que sigue/, /Salta la intro larga/, /Primer drop/, /manda siempre/, /Mezclar ahora/, /sin análisis: entra por el inicio/, /Arrastra la línea/, /marcada por ti/, /Auto\*\* quita solo esa entrada/]) assert.match(d, re, `la guía menciona ${re}`);
  const html = read('renderer/index.html'); for (const id of ['amv-entry', 'amv-entry-time', 'amv-entry-why', 'amv-entry-strip', 'amv-entry-auto']) assert.ok(html.includes(`id="${id}"`), `control ${id}`);
  assert.match(html, /Tarjeta SIGUE/, 'la ayuda («?») lo explica');
  const inv = read('docs/inventario-controles.md'); for (const id of ['#amv-entry', '#amv-entry-strip', '#amv-entry-auto']) assert.ok(inv.includes(id), `inventario: ${id}`);
  assert.ok(/export function pickEntry/.test(read('renderer/mixplan.js')), 'pickEntry existe');
  assert.ok(!/b\.mixEdit\?\.in \?\? b\.mix\?\.mixIn/.test(read('renderer/mixpreview.js')), 'la preescucha usa pickEntry');
  console.log('entrada docs: OK');
};

const run = async () => { for (const m of modes) { if (!tests[m]) { console.error(`uso: test-entrada.js ${Object.keys(tests).join('|')}`); process.exit(2); } await tests[m](); } };
run().catch((e) => (console.error(e), process.exit(1)));
