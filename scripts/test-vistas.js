#!/usr/bin/env node
// Pruebas del cambio vistas-y-ajustes.  Uso: node scripts/test-vistas.js state|ui|search|save|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

tests.state = async () => {
  const { SplitState, clampSplit, SPLITVIEWS, STEP, STEP_BIG } = await import('../renderer/splits.js');
  assert.deepStrictEqual(SPLITVIEWS, ['mix', 'library']);
  assert.deepStrictEqual([STEP, STEP_BIG], [8, 32]);
  // REQ-1: límites por zona y ventana
  assert.strictEqual(clampSplit('waves', 10, 900), 90, 'mínimo de las ondas');
  assert.strictEqual(clampSplit('waves', 900, 900), 405, 'máximo = 45 %');
  assert.strictEqual(clampSplit('lib', 10, 900), 150);
  assert.strictEqual(clampSplit('lib', 900, 900), 495, 'máximo = 55 %');
  assert.strictEqual(clampSplit('lib', 900, 200), 150, 'en una ventana pequeña vale el mínimo');
  // el resto de la ventana manda: barra + consola fijas, y cada zona deja a la otra su mínimo
  assert.strictEqual(clampSplit('waves', 900, 960, 587), 223, '960 − 587 − 150');
  assert.strictEqual(clampSplit('lib', 900, 960, 587), 283, '960 − 587 − 90');
  // arrastrar: manda el último
  const s = new SplitState();
  assert.strictEqual(s.active('mix'), null, 'sin tocar: tamaño por defecto');
  assert.deepStrictEqual(s.drag('mix', 'waves', 200.4), { which: 'waves', px: 200 });
  assert.deepStrictEqual(s.drag('mix', 'lib', 300), { which: 'lib', px: 300 });
  assert.deepStrictEqual(s.get('mix'), { last: 'lib', waves: 200, lib: 300 }, 'el otro valor se conserva');
  assert.strictEqual(s.drag('mix', 'bad', 5), null);
  assert.strictEqual(s.drag('nope', 'waves', 5), null);
  assert.strictEqual(s.drag('mix', 'waves', NaN), null);
  // cada vista es independiente
  assert.strictEqual(s.active('library'), null);
  s.drag('library', 'lib', 260);
  // REQ-1: restablecer una vista; REQ-2: todas
  s.reset('mix');
  assert.strictEqual(s.active('mix'), null);
  assert.deepStrictEqual(s.active('library'), { which: 'lib', px: 260 });
  // REQ-2: guardado y lectura (también datos dañados)
  const back = new SplitState(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(back.active('library'), { which: 'lib', px: 260 });
  const bad = new SplitState({ mix: { last: 'x', waves: -4, lib: 'a' }, library: { waves: 120 } });
  assert.strictEqual(bad.active('mix'), null);
  assert.deepStrictEqual(bad.active('library'), { which: 'waves', px: 120 }, 'sin last, usa el valor que exista');
  s.resetAll();
  assert.strictEqual(s.active('library'), null);
  console.log('state ok');
};

tests.ui = async () => {
  const html = read('renderer/index.html'); const css = read('renderer/styles.css'); const app = read('renderer/app.js');
  assert.ok(html.includes('data-split="waves"') && html.includes('data-split="lib"') && (html.match(/role="separator"/g) || []).length >= 2, 'dos separadores accesibles');
  assert.ok(/bindSplits/.test(app) && /dblclick/.test(app) && /ArrowDown/.test(app) && /alyssdj\.splits|SPLIT_STORE/.test(app));
  assert.ok(/--split-waves/.test(css) && /--split-lib/.test(css) && /row-resize/.test(css));
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-vistas-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'vistas-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const r = JSON.parse(fs.readFileSync(path.join(tmp, 'vistas.json'), 'utf8'));
  const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
  const noScroll = (x, m) => assert.ok(x.sw <= x.w && x.sh <= x.ih + 1, `${m}: sin scroll (${x.sw}x${x.sh} en ${x.w}x${x.ih})`);
  // REQ-1: por defecto, accesibles y sin personalizar
  assert.strictEqual(r.def.split, null); assert.strictEqual(r.def.wsp.role, 'separator'); assert.strictEqual(r.def.lsp.role, 'separator');
  assert.ok(Number(r.def.wsp.min) < Number(r.def.wsp.max));
  // arrastre real: las ondas crecen lo que se arrastra y la librería cede
  near(r.waves60.waves, r.def.waves + 60, 3, 'ondas +60'); assert.ok(r.waves60.lib < r.def.lib); assert.strictEqual(r.waves60.split, 'waves'); noScroll(r.waves60, 'ondas +60');
  // máximo: lo que deja libre la consola sin quitar el mínimo a la librería
  near(r.wavesMax.waves, r.def.waves + r.def.lib - 150, 3, 'máximo de las ondas'); assert.ok(r.wavesMax.lib >= 149); noScroll(r.wavesMax, 'máximo');
  // doble clic restablece
  assert.strictEqual(r.reset.split, null); near(r.reset.waves, r.def.waves, 2, 'restablecido');
  // la librería manda al arrastrar su divisor y respeta el máximo (55 %)
  near(r.lib80.lib, r.reset.lib + 40, 4, 'librería +40'); assert.strictEqual(r.lib80.split, 'lib'); noScroll(r.lib80, 'librería +40');
  near(r.libMax.lib, r.def.waves + r.def.lib - 90, 3, 'máximo de la librería'); assert.ok(r.libMax.waves >= 89); noScroll(r.libMax, 'máximo librería');
  // teclado: 8 px, 32 px con Mayús; ↑ agranda la librería
  near(r.kbUp.lib, r.kbBase.lib + 8, 2, '↑ 8 px'); near(r.kbUpBig.lib, r.kbUp.lib + 32, 2, 'Mayús+↑ 32 px'); near(r.kbDown.lib, r.kbUpBig.lib - 8, 2, '↓ 8 px');
  // REQ-2: cada vista tiene su tamaño; se guarda en localStorage
  assert.strictEqual(r.libViewDefault.split, null, 'la vista Librería no hereda el tamaño de Mezcla');
  assert.strictEqual(r.mixBack.split, 'lib'); near(r.mixBack.lib, r.kbDown.lib, 2, 'Mezcla recuerda su tamaño');
  assert.ok(r.mixBack.stored?.mix?.lib > 0, 'guardado');
  // ondas en el deck: solo el divisor de la librería; en la vista Ondas ninguno
  assert.strictEqual(r.deckWaves.wsp, null); assert.ok(r.deckWaves.lsp); assert.strictEqual(r.wavesView.wsp, null); assert.strictEqual(r.wavesView.lsp, null);
  // REQ-5: ventana pequeña: recortado sin perder lo guardado ni desbordar
  assert.ok(r.small.waves < 430 && r.small.lib >= 149, `recortado: ${r.small.waves}`); noScroll(r.small, '1366×768');
  assert.strictEqual(r.stored.waves, 430, 'el valor guardado se conserva');
  console.log('ui ok');
};

tests.search = async () => {
  const { settingsFilter, norm } = await import('../renderer/settings-ui.js');
  assert.strictEqual(norm('Música ACTUALIZACIÓN'), 'musica actualizacion');
  const rows = [{ pane: 'decks', text: 'Rango de pitch' }, { pane: 'decks', text: 'Curva del crossfader' }, { pane: 'general', text: 'Buscar actualizaciones automáticamente' }, { pane: 'library', text: 'Preferir la copia guardada' }];
  assert.deepStrictEqual(settingsFilter('', rows), { panes: new Set(), hits: [], active: false });
  assert.deepStrictEqual(settingsFilter('PITCH', rows).hits, [0]);
  assert.deepStrictEqual(settingsFilter('actualizacion', rows).hits, [2], 'sin tildes ni mayúsculas');
  assert.deepStrictEqual(settingsFilter('crossfader curva', rows).hits, [1], 'palabras en cualquier orden');
  assert.deepStrictEqual([...settingsFilter('r', rows).panes].sort(), ['decks', 'general', 'library'], 'varias secciones');
  assert.strictEqual(settingsFilter('zzz', rows).hits.length, 0);
  const html = read('renderer/index.html');
  // REQ-3: secciones por tema y cada opción en una sola
  const panes = [...html.matchAll(/<section class="set-pane" data-pane="(\w+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(panes.sort(), ['audio', 'decks', 'general', 'library', 'midi', 'tools']);
  const names = [...html.slice(html.indexOf('id="settings"')).matchAll(/name="(\w+)"/g)].map((m) => m[1]);
  assert.strictEqual(new Set(names).size, names.length, 'cada opción aparece una vez');
  assert.ok(html.includes('id="set-search"') && html.includes('id="set-empty"') && html.includes('id="btn-reset-views"'));
  const { spawnSync } = require('child_process'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-ajustes-'));
  spawnSync(require('electron'), ['.'], { cwd: root, timeout: 170000, env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'ajustes-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp } });
  const r = JSON.parse(fs.readFileSync(path.join(tmp, 'ajustes.json'), 'utf8'));
  assert.ok(r.first.open && r.first.tabs[0] === 'general*' && r.first.panes.join() === 'general', JSON.stringify(r.first.tabs));
  assert.deepStrictEqual(r.first.tabs.map((t) => t.replace(/[*~]/g, '')), ['general', 'audio', 'decks', 'library', 'midi', 'tools']);
  assert.ok(r.first.sw <= r.first.cw && r.first.h <= r.first.ih, 'cabe en 1366×768');
  assert.deepStrictEqual(r.pitch.panes, ['decks']); assert.strictEqual(r.pitch.shown.length, 1); assert.ok(/pitch/i.test(r.pitch.shown[0]));
  assert.ok(r.pitch.tabs.some((t) => t.startsWith('general') && t.endsWith('~')), 'las secciones sin resultados se atenúan');
  assert.deepStrictEqual(r.curve.panes, ['decks']);
  assert.deepStrictEqual(r.upd.panes, ['general'], 'sin tildes ni mayúsculas');
  assert.deepStrictEqual(r.help.panes, ['library'], 'busca también en la ayuda');
  assert.ok(r.none.empty && r.none.panes.length === 0, 'sin resultados');
  assert.ok(!r.cleared.empty && r.cleared.q === '' && r.cleared.panes.join() === 'general', 'limpiar vuelve a la sección');
  assert.ok(r.esc.open && r.esc.q === '' && !r.esc.empty, 'Esc limpia y no cierra');
  assert.strictEqual(r.remember.panes.join(), 'audio', 'recuerda la última sección');
  assert.strictEqual(r.arrow.panes.join(), 'decks', 'flecha abajo: siguiente sección');
  assert.strictEqual(r.arrowSearch.panes.join(), 'decks', 'las flechas en el buscador no cambian de sección');
  console.log('search ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('uso: test-vistas.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
