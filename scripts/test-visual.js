#!/usr/bin/env node
// Pruebas del cambio automix-visual.  Uso: node scripts/test-visual.js model|ui|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

tests.model = async () => {
  const { beatPhase, beatInBar, deckRings, vizScene, pulseOf } = await import('../renderer/viz.js');
  // fase y compás: 120 BPM → beat de 0,5 s; rejilla desde 0,25 s
  near(beatPhase(0.25, 120, 0.25), 0, 1e-9, 'en el beat'); near(beatPhase(0.5, 120, 0.25), 0.5, 1e-9, 'a mitad'); near(beatPhase(0.74, 120, 0.25), 0.98, 1e-9, 'casi el siguiente');
  assert.strictEqual(beatPhase(5, 0, 0), 0, 'sin BPM'); assert.strictEqual(beatPhase(NaN, 120, 0), 0);
  assert.deepStrictEqual([0, 0.5, 1, 1.5, 2, 2.5].map((t) => beatInBar(t, 120, 0)), [0, 1, 2, 3, 0, 1], 'compás de 4');
  assert.strictEqual(beatInBar(-0.25, 120, 0), 3, 'antes de la rejilla no da negativos');
  const on = { level: 0.8, gain: 1, bpm: 120, offset: 0, playing: true };
  // REQ-1: cuatro anillos que se expanden con la fase; el pulso es máximo en el beat
  const a = deckRings({ ...on, pos: 0.5 }); const b = deckRings({ ...on, pos: 0.75 });
  assert.strictEqual(a.rings.length, 4); assert.ok(a.rings.every((r) => r.r >= 0 && r.r <= 1 && r.a >= 0));
  assert.ok(b.rings[1].r > a.rings[1].r, 'los anillos se expanden con la fase'); assert.ok(a.pulse > b.pulse, 'el pulso cae tras el beat'); near(deckRings({ ...on, pos: 0.5 }).pulse, 0.8, 1e-9, 'pulso = nivel en el beat');
  // el primer tiempo del compás marca más (grosor y opacidad) que los demás, y decae con la fase
  const down = deckRings({ ...on, pos: 2 }); const off = deckRings({ ...on, pos: 2.5 }); const downLate = deckRings({ ...on, pos: 2.4 });
  assert.ok(down.rings[0].w > off.rings[0].w, 'primer tiempo con más grosor'); assert.ok(down.rings[1].a > off.rings[1].a * 1.1); assert.ok(down.rings[1].w > downLate.rings[1].w, 'el acento decae');
  assert.strictEqual(deckRings({ ...on, pos: 2.5 }).rings[0].w, 1, 'beats sin acento: grosor base');
  // intensidad con el nivel y la ganancia del canal
  assert.ok(deckRings({ ...on, level: 1, pos: 0.7 }).intensity > deckRings({ ...on, level: 0.1, pos: 0.7 }).intensity);
  assert.strictEqual(deckRings({ ...on, gain: 0, pos: 0.7 }).intensity, 0); near(deckRings({ ...on, gain: 0.5, level: 1, pos: 0.7 }).intensity, 0.5, 1e-9, 'ganancia'); assert.ok(deckRings({ ...on, gain: 9, level: 1, pos: 0.7 }).intensity <= 1, 'acotada');
  assert.ok(deckRings({ ...on, level: 5, pos: 0.7 }).rings.every((r) => r.a <= 1.4), 'sin desbordes con niveles absurdos');
  // REQ-2: sin BPM respira con el nivel, en pausa quieto y tenue
  const nb = deckRings({ level: 0.9, gain: 1, bpm: 0, pos: 3, playing: true }); const nb2 = deckRings({ level: 0.1, gain: 1, bpm: 0, pos: 3, playing: true });
  assert.strictEqual(nb.rings.length, 1); assert.ok(nb.rings[0].r > nb2.rings[0].r, 'respira con el nivel'); assert.strictEqual(nb.pulse, 0);
  const paused = deckRings({ ...on, playing: false, pos: 1 }); const paused2 = deckRings({ ...on, playing: false, pos: 1.3 });
  assert.deepStrictEqual(paused, paused2, 'en pausa no depende de la posición'); assert.strictEqual(paused.pulse, 0); assert.ok(paused.rings.every((r) => r.a === 0.12)); assert.strictEqual(paused.intensity, 0);
  // REQ-4: movimiento reducido → estático (mismo resultado en cualquier posición, sin pulso)
  const r1 = deckRings({ ...on, pos: 0.6, reduced: true }); const r2 = deckRings({ ...on, pos: 1.1, reduced: true });
  assert.deepStrictEqual(r1, r2, 'estático'); assert.strictEqual(r1.pulse, 0); assert.ok(r1.rings.every((r) => r.a > 0), 'se ve');
  // REQ-3: transición: los dos decks a la vez, cada uno con la intensidad de su canal
  const s = vizScene([{ id: 'A', level: 0.8, gain: 0.25, bpm: 120, pos: 10, offset: 0, playing: true }, { id: 'B', level: 0.8, gain: 0.75, bpm: 124, pos: 4, offset: 0, playing: true }]);
  assert.deepStrictEqual(s.map((x) => x.id), ['A', 'B']); assert.ok(s[1].intensity > s[0].intensity * 2, 'B más fuerte que A según su ganancia');
  const sx = vizScene([{ id: 'A', level: 0.8, gain: 1, bpm: 120, pos: 0.5, offset: 0, playing: true }, { id: 'B', level: 0, gain: 0, bpm: 0, pos: 0, playing: false }]);
  assert.strictEqual(pulseOf(sx), sx[0].pulse, 'el latido de la portada sigue al deck más fuerte'); assert.strictEqual(pulseOf([]), 0);
  // REQ-6: el latido de la portada nunca pasa de 1 (+1,5 % de escala = 0,015·pulso)
  assert.ok(pulseOf(vizScene([{ id: 'A', level: 9, gain: 9, bpm: 120, pos: 0, offset: 0, playing: true }])) <= 1);
  console.log('model ok');
};

tests.ui = async () => {
  const html = read('renderer/index.html'); const app = read('renderer/app.js'); const css = read('renderer/styles.css');
  assert.ok(html.includes('id="imm-viz"') && html.includes('id="imm-viz-toggle"') && /aria-hidden="true"/.test(html.slice(html.indexOf('id="imm-viz"') - 40, html.indexOf('id="imm-viz"') + 60)), 'lienzo oculto a lectores de pantalla y botón');
  assert.ok(/new Visualizer/.test(app) && /visual: am\.cfg\.visual === false/.test(app) && /\.imm-viz/.test(css));
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-visual-'));
  spawnSync(...require('./headless.js')(['.']), { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'visual-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const f = path.join(tmp, 'visual.json'); assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!r.__err, JSON.stringify(r.__err));
  // REQ-1/4: lienzo detrás de la portada, activo por defecto y del tamaño de la vista
  assert.ok(r.start.vis && !r.start.hidden && r.start.pressed === 'true' && r.start.cfg !== false); near(r.start.cw, r.start.iw, 2, 'ancho'); near(r.start.ch, r.start.ih, 2, 'alto'); assert.strictEqual(r.start.role, 'true');
  // REQ-5: ≤ 30 fps; se detiene fuera de la vista y con la ventana oculta; vuelve al regresar
  assert.ok(r.fps <= 32 && (r.rafFires < 5 || r.fps >= 5), `cuadros por segundo: ${r.fps} (rAF: ${r.rafFires})`); assert.deepStrictEqual(r.stopped, { raf: 0, drawn: 0 }, 'parado fuera de la vista Automix'); assert.ok(r.resumed.raf !== 0, 'reanuda al volver');
  assert.deepStrictEqual(r.docHidden, { raf: 0, drawn: 0 }, 'parado con la ventana oculta'); assert.ok(r.docShown.raf !== 0);
  // REQ-4: botón, recuerdo y apagado
  assert.ok(r.off.hidden && r.off.pressed === 'false' && r.off.cfg === false && r.off.raf === 0 && r.off.tf === '', 'apagado: oculto, sin bucle y portada a escala 1'); assert.strictEqual(r.offLater.frames, r.off.frames, 'apagado no dibuja');
  assert.ok(r.offPersisted.hidden && r.offPersisted.cfg === false, 'recordado entre sesiones'); assert.ok(!r.on.hidden && r.on.pressed === 'true' && r.on.raf !== 0, 'se vuelve a encender');
  assert.strictEqual(r.reduced.raf, 0, 'movimiento reducido: sin bucle'); assert.strictEqual(r.reduced.drawn, 0, 'y sin más cuadros'); assert.ok(r.reduced.hasFrame, 'con un cuadro estático');
  // REQ-1: color por deck (A cian: azul > rojo · B rosa: rojo > azul) y contenido
  assert.ok(r.onlyA.n > 500 && r.onlyA.b > r.onlyA.r + 20, `A cian ${JSON.stringify(r.onlyA)}`); assert.ok(r.onlyB.n > 500 && r.onlyB.r > r.onlyB.b - 10 && r.onlyB.r > r.onlyA.r + 40, `B rosa ${JSON.stringify(r.onlyB)}`);
  assert.ok(r.both.n >= Math.max(r.onlyA.n, r.onlyB.n), 'los dos a la vez');
  // REQ-2: en pausa tenue, sin BPM un anillo
  assert.ok(r.paused.n > 0 && r.paused.n < r.onlyA.n, 'pausa: tenue'); assert.ok(r.noBpm.n > 0 && r.noBpm.n < r.onlyA.n, 'sin BPM: un anillo');
  // REQ-6: la portada late con el beat y vuelve a 1 entre beats
  const sc = (t) => Number((/scale\(([\d.]+)\)/.exec(t) || [])[1] || 1); assert.ok(sc(r.beat) > 1.01 && sc(r.beat) <= 1.0151, `latido ${r.beat}`); assert.ok(sc(r.offBeat) < sc(r.beat), 'entre beats, menos');
  // REQ-5: rendimiento
  assert.ok(r.perf.avg < 8, `un cuadro tarda ${r.perf.avg.toFixed(2)} ms de media (${r.perf.w}×${r.perf.h})`);
  assert.ok(r.small.sw <= r.small.w && r.small.sh <= r.small.hh + 1, '1366×768 sin desbordes');
  console.log('ui ok');
};

tests.docs = async () => {
  const d4 = read('docs/04-automix.md'); const d2 = read('docs/02-decks-y-mezclador.md'); const rd = read('README.md');
  for (const k of ['El visual', 'anillos', 'beat', 'igual para pistas locales', 'botón **Visual**', '30 cuadros', 'movimiento reducido', 'No es vídeo', 'img/47-visual-automix.png']) assert.ok(d4.includes(k), `04: ${k}`);
  assert.ok(/anillos al ritmo del beat/.test(d2) && /anillos que laten/.test(rd));
  assert.ok(fs.existsSync(path.join(root, 'docs/img/47-visual-automix.png')), 'captura');
  const ci = read('.github/workflows/ci.yml');
  assert.ok(/for m in model docs; do node scripts\/test-visual\.js/.test(ci), 'CI rápida: model y docs'); assert.ok((ci.match(/test-visual\.js ui/g) || []).length === 2, 'CI con ventana: ui (Linux y resto)');
  console.log('docs ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-visual.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
