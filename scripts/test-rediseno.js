#!/usr/bin/env node
// Pruebas del rediseño de la interfaz.  Uso: node scripts/test-rediseno.js video-removed|video-media|tokens|shell|sources|automix|settings|e2e|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests['video-removed'] = async () => {
  // REQ-1: no queda nada de la vista de miniaturas
  for (const f of ['renderer/ministage.js', 'scripts/test-ministage.js', 'scripts/test-stage.js', 'scripts/stage-selftest.js']) assert.ok(!fs.existsSync(path.join(root, f)), `${f} debe borrarse`);
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const app = read('renderer/app.js');
  assert.ok(!/id="stage"|amv-stage|stage-grip|class="tile"/.test(html), 'HTML sin miniaturas');
  assert.ok(!/\.stage\b|\.tile\b|am-stage/.test(css), 'CSS sin miniaturas');
  assert.ok(!/MiniStage|ministage|syncStage|this\.stage|alyssdj\.stage/.test(app), 'app.js sin miniaturas');
  assert.ok(!/e\.key === '\['|e\.key === 'v'/.test(app), 'sin teclas V, [ y ]');
  assert.ok(!/setFrames|frameUrl|onFrame/.test(read('renderer/deck.js')), 'deck.js sin frames');
  assert.ok(!/grabFrame|deck:frame|setFrames/.test(read('preload/deck.js') + read('preload/app.js') + read('main/main.js')), 'sin IPC de frames');
  assert.ok(!/test-ministage/.test(read('.github/workflows/ci.yml')), 'CI sin la prueba borrada');
  // el menú de la ventana de video se conserva
  assert.ok(/id="video-panel"/.test(html) && /id="btn-video"/.test(html), 'el menú Video sigue');
  console.log('video-removed: OK');
};

tests['video-media'] = async () => {
  const { spawnSync } = require('child_process');
  const os = require('os');
  // estático: el contrato existe de punta a punta y main ya no deja visible la vista de un deck sin medio
  const main = read('main/main.js');
  assert.ok(/video:deck-media/.test(main) && /video:deck-media/.test(read('preload/app.js')), 'canal video:deck-media');
  assert.ok(!/video:deck-source|setDeckSource/.test(main + read('preload/app.js') + read('renderer/deck.js')), 'sin el canal antiguo');
  assert.ok(/m\.kind === 'stream'/.test(main), 'la vista de streaming solo se muestra con medio stream');
  assert.ok(/id="ph-A"/.test(read('renderer/video.html')), 'la ventana tiene pantalla de «sin video»');
  // e2e en Electron
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-media-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 150000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'video-media-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: path.join(root, 'docs/demo-audio') } });
  const f = path.join(tmp, 'video-media.json');
  assert.ok(fs.existsSync(f), 'la app no produjo resultado');
  const r = JSON.parse(fs.readFileSync(f, 'utf8')); if (process.env.DEBUG_MEDIA) console.log(JSON.stringify(r));
  for (const [k, v] of Object.entries(r)) assert.ok(!(v && v.__err), `${k}: ${JSON.stringify(v)}`);
  assert.ok(r.hasWin, 'se abrió la ventana de video');
  assert.strictEqual(r.emptyA.display, 'grid'); assert.strictEqual(r.emptyA.text, 'Sin pista');
  assert.strictEqual(r.emptyB.text, 'Sin pista');
  assert.deepStrictEqual(r.emptyVisible, [false, false], 'decks vacíos: la página de YouTube Music no se ve');
  assert.strictEqual(r.localNoVideo.text, 'Sin video'); assert.strictEqual(r.localVisible, false);
  assert.strictEqual(r.streamLoading.text, 'Cargando…'); assert.strictEqual(r.streamVisible, false);
  console.log('video-media: OK');
};

// contraste WCAG entre dos colores #rrggbb
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const token = (css, name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];

tests.tokens = async () => {
  const css = read('renderer/styles.css');
  // REQ-3: escalas únicas
  for (const n of ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6', 'fs-1', 'fs-2', 'fs-3', 'fs-4', 'fs-5', 'fs-bpm', 'r-1', 'r-2', 'r-3', 'r-pill', 'sh-1', 'sh-2', 'dur-1', 'dur-2', 'ctl-h', 'sel']) assert.ok(new RegExp(`--${n}:`).test(css), `token --${n}`);
  // componentes únicos: interruptor, deslizador, vacío, segmentado neutro, botón primario neutro
  assert.ok(/input\[type='checkbox'\]::after/.test(css), 'interruptor');
  assert.ok(/input\[type='range'\]:not\(\.vfader\)/.test(css), 'deslizador');
  assert.ok(/\.empty \{/.test(css), 'estado vacío');
  assert.ok(/button\.primary, \.btn\.primary \{ background: var\(--sel\)/.test(css), 'botón primario neutro');
  assert.ok(/\.seg button\.on \{ background: var\(--accent, var\(--sel\)\)/.test(css), 'segmentado neutro fuera de decks');
  assert.ok(!/accent-color: var\(--a\)/.test(css.replace(/\.tools-bar progress[^}]*}/, '')), 'sin acento de deck en controles generales');
  // REQ-8: movimiento reducido y contraste
  assert.ok(/prefers-reduced-motion: reduce/.test(css));
  const bg = token(css, 'bg'); const surface = token(css, 'surface'); const raised = token(css, 'raised');
  for (const name of ['text', 'dim', 'faint']) for (const base of [bg, surface, raised]) {
    const c = contrast(token(css, name), base);
    assert.ok(c >= 4.5, `--${name} sobre ${base}: ${c.toFixed(2)}:1`);
  }
  for (const name of ['a', 'b', 'play', 'cue', 'warn', 'err']) assert.ok(contrast(token(css, name), surface) >= 4.5, `--${name} como texto`);
  console.log('tokens: OK');
};

tests.shell = async () => {
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  // REQ-4: cuatro zonas en orden y barra en tres grupos
  const order = ['class="topbar"', 'class="waves"', 'class="console"', 'class="library"'].map((k) => html.indexOf(k));
  assert.ok(order.every((i) => i > 0) && order.every((v, i) => !i || v > order[i - 1]), 'zonas: barra, ondas, consola, librería');
  const bar = html.slice(html.indexOf('class="topbar"'), html.indexOf('</header>'));
  assert.ok(/tb-id/.test(bar) && /tb-mix/.test(bar) && /tb-sys/.test(bar), 'tres grupos en la barra');
  const grp = (c) => bar.slice(bar.indexOf(c), bar.indexOf('</div>', bar.indexOf(c) + 40) + 6);
  for (const id of ['btn-automix', 'btn-sampler', 'btn-rec']) assert.ok(grp('tb-mix').includes(id) || bar.slice(bar.indexOf('tb-mix'), bar.indexOf('tb-sep')).includes(id), `${id} en herramientas de mezcla`);
  for (const id of ['btn-midi-learn', 'btn-video', 'btn-help', 'btn-settings']) assert.ok(bar.slice(bar.indexOf('tb-sys')).includes(id), `${id} en sistema`);
  // cabecera de deck: portada, título, artista, BPM, tonalidad, tiempos, fuente
  const tpl = html.slice(html.indexOf('<template id="deck-tpl">'), html.indexOf('</template>'));
  for (const k of ['head-art', 'class="title"', 'class="artist"', 'bpm-val', 'class="kchip key"', 'class="elapsed"', 'class="remain"', 'class="seg source"']) assert.ok(tpl.includes(k), `cabecera: ${k}`);
  assert.ok(/\.head-art \{/.test(css), 'estilo de la portada de cabecera');
  // el mezclador conserva sus controles
  for (const k of ['data-knob="master"', 'data-knob="cue"', 'id="xfader"', 'master-vu', 'class="ch" data-deck="A"', 'class="ch" data-deck="B"']) assert.ok(html.includes(k), `mezclador: ${k}`);
  // la barra solo avisa si falta una herramienta
  assert.ok(!/ffmpeg ✓/.test(read('renderer/app.js')), 'sin estado fijo de yt-dlp en la barra');
  console.log('shell: OK');
};

const mode = process.argv[2];
if (!tests[mode]) { console.error('modo desconocido:', mode, '| disponibles:', Object.keys(tests).join(', ')); process.exit(2); }
tests[mode]().catch((e) => { console.error(e); process.exit(1); });
