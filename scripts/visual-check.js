#!/usr/bin/env node
// Comprobación visual: lanza la app en silencio, captura vistas fijas a 1280×720 y las compara con docs/arquitectura/referencias.
// Uso: node scripts/visual-check.js [--approve [nombre…]]   (xvfb-run -a si no hay pantalla; headless.js lo hace solo en Linux)
// Falla si alguna captura difiere en más del 0,5 % de sus píxeles o no tiene referencia. `--approve` copia las capturas actuales a las referencias.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const refs = path.join(root, 'docs', 'arquitectura', 'referencias');
const args = process.argv.slice(2);
const approve = args.includes('--approve');
const only = args.filter((a) => !a.startsWith('--'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-vc-'));
const music = path.join(tmp, 'audio');
const cleanup = () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} };
try {
  fs.mkdirSync(refs, { recursive: true });
  const gen = spawnSync('node', [path.join(__dirname, 'make-demo-audio.js'), music], { cwd: root, encoding: 'utf8' });
  if (gen.status !== 0) { console.error(gen.stderr || gen.stdout); process.exit(1); }
  const run = spawnSync(...require('./headless.js')(['.']), {
    cwd: root, timeout: 170000, encoding: 'utf8',
    env: { ...process.env, YTDJ_SELFTEST: '1', YTDJ_SELFTEST_MODULE: path.join(__dirname, 'visual-check-selftest.js'), YTDJ_USERDATA: path.join(tmp, 'data'), YTDJ_SELFTEST_OUT: tmp, YTDJ_DOCS_MUSIC: music, YTDJ_VISUAL_REFS: refs },
  });
  const f = path.join(tmp, 'visual-check.json');
  if (!fs.existsSync(f)) { console.error('la app no produjo resultado', run.stderr?.slice(-400)); process.exit(1); }
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const e of r.errores) console.error('error:', e);
  for (const c of r.capturas) console.log(`${c.ok ? 'ok   ' : 'FALLO'} ${c.nombre.padEnd(12)} ${c.pct === null ? c.motivo : `${c.pct} % distinto${c.motivo ? ` (${c.motivo})` : ''}`}`);
  if (approve) {
    const names = r.capturas.map((c) => c.nombre).filter((n) => !only.length || only.includes(n));
    for (const n of names) fs.copyFileSync(path.join(tmp, `${n}.png`), path.join(refs, `${n}.png`));
    console.log(`referencias aprobadas: ${names.join(', ') || 'ninguna'}`);
    process.exit(r.errores.length ? 1 : 0);
  }
  const bad = r.capturas.filter((c) => !c.ok);
  // VISUAL_CHECK_SOFT=1 (CI): las diferencias de píxeles solo se informan, porque las fuentes del runner no son las de las referencias; los fallos de ejecución siguen fallando
  if (process.env.VISUAL_CHECK_SOFT === '1' && !r.errores.length && r.capturas.length >= 6 && bad.length) { console.warn(`aviso: ${bad.length} capturas distintas (modo informativo)`); console.log('ok (informativo)'); return; }
  if (r.errores.length || bad.length || r.capturas.length < 6) { console.error(`${bad.length} capturas distintas${r.capturas.length < 6 ? `, solo ${r.capturas.length} de 6` : ''}. Si el cambio es intencionado: node scripts/visual-check.js --approve`); process.exit(1); }
  console.log('ok');
} finally { cleanup(); }
