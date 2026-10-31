#!/usr/bin/env node
// Vista AutoMix con miniaturas de video.  Uso: node scripts/test-stage.js layout|live|e2e
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const mode = process.argv[2];

function run() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-stage-'));
  const music = path.join(root, 'docs/demo-audio');
  assert.ok(fs.existsSync(path.join(music, 'Neon Drive.mp3')), 'falta el audio de demostración: node scripts/make-demo-audio.js docs/demo-audio');
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 180000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'stage-selftest.js'), YTDJ_USERDATA: path.join(out, 'data'), YTDJ_DOCS_MUSIC: music, YTDJ_SELFTEST_OUT: out } });
  const f = path.join(out, 'stage.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  if (process.env.STAGE_SHOTS) for (const n of fs.readdirSync(out).filter((x) => x.endsWith('.png'))) fs.copyFileSync(path.join(out, n), path.join(process.env.STAGE_SHOTS, n));
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(r)) assert.ok(!v?.__err, `${k}: ${JSON.stringify(v)}`);
  return r;
}

const layout = (r) => {
  const l = r.layout;
  // REQ-1: sin decks ni mezclador grandes, con la franja y la cola; nada se sale
  assert.ok(l.bodyCls.includes('am-stage'), `clase am-stage: ${l.bodyCls}`);
  assert.strictEqual(l.consoleDisplay, 'none');
  assert.strictEqual(l.stageHidden, false);
  assert.ok(l.deckInDom, 'los decks siguen en el DOM (el audio no se toca)');
  assert.ok(l.libH > r.before.library.h + 150, `la cola gana sitio: ${Math.round(r.before.library.h)} → ${Math.round(l.libH)}`);
  assert.ok(l.sw <= l.w + 1 && l.sh <= l.h + 1, 'sin desplazamiento de página');
  assert.strictEqual(l.pressed, 'true');
  assert.ok(l.grip >= 32, 'asa con área táctil de 32 px');
  console.log('stage layout: OK');
};

const live = (r) => {
  const [idA, idB] = r.ids;
  const { A, B } = r.live;
  // REQ-2: el video es el de la pista cargada y va con el audio
  assert.strictEqual(A.kind, 'video');
  assert.strictEqual(A.track, idA);
  assert.strictEqual(A.vhidden, false);
  assert.ok(!A.vpaused, 'el video corre');
  assert.ok(Math.abs(A.vt - r.live.pos) <= 0.6, `video ${A.vt.toFixed(2)} vs deck ${r.live.pos.toFixed(2)}`);
  // REQ-3: al aire / en espera
  assert.ok(A.cls.includes('air') && B.cls.includes('wait'), `${A.cls} | ${B.cls}`);
  assert.ok(Number(B.op) < 1);
  // REQ-5: sin video → portada con etiqueta
  assert.strictEqual(B.kind, 'cover');
  assert.strictEqual(B.label, 'Solo audio');
  // REQ-2: al cambiar la pista no queda el video de la anterior ni un instante
  for (const s of [r.swapped, r.swapped2]) {
    assert.notStrictEqual(s.kind, 'video');
    assert.strictEqual(s.track, idB);
    assert.strictEqual(s.vsrc, null);
  }
  assert.strictEqual(r.swapped2.label, 'Solo audio');
  assert.strictEqual(r.noMini.kind, 'cover');
  assert.strictEqual(r.noMini.label, '', 'miniatura desactivada: solo portada');
  console.log('stage live: OK');
};

const e2e = (r) => {
  layout(r);
  live(r);
  // REQ-4: tamaño
  assert.strictEqual(r.size.key, 340);
  assert.strictEqual(r.size.bracket, 360);
  assert.strictEqual(r.size.max, 560);
  assert.strictEqual(r.size.min, 160);
  assert.ok(Math.abs(r.size.drag - 430) <= 1, `arrastre ${r.size.drag}`);
  assert.ok(Math.abs(r.size.ratio.mw / r.size.ratio.mh - 16 / 9) < 0.02, '16:9');
  assert.deepStrictEqual(JSON.parse(r.stored), { on: true, w: r.size.drag }, 'se recuerda');
  // REQ-6
  assert.ok(r.videoWin, 'el doble clic abre la ventana de video');
  // REQ-1: restaurar
  assert.ok(!r.otherTab.cls.includes('am-stage') && r.otherTab.display !== 'none' && r.otherTab.stageHidden, 'fuera de AutoMix vuelve la consola');
  assert.ok(!r.off.cls.includes('am-stage') && r.off.display !== 'none' && r.off.pressed === 'false');
  assert.ok(Math.abs(r.off.pos - r.posBefore) < 1, 'el deck conserva su posición');
  console.log('stage e2e: OK');
};

const tests = { layout, live, e2e };
if (!tests[mode]) (console.error('uso: test-stage.js layout|live|e2e'), process.exit(2));
try {
  tests[mode](run());
} catch (e) {
  console.error(e);
  process.exit(1);
}
