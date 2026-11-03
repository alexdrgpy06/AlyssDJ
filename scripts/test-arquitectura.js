'use strict';
// Pruebas de la documentación de arquitectura: el registro y los documentos no pueden divergir del código.
// Uso: node scripts/test-arquitectura.js registry|ipc|docs   (varios separados por comas)
const fs = require('fs');
const path = require('path');
const L = require('./arquitectura-lib');

const DOCS = path.join(L.root, 'docs', 'arquitectura');
const modes = (process.argv[2] || 'registry,ipc,docs').split(',');
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error(`FALLO: ${m}`); } };
const readDoc = (n) => fs.readFileSync(path.join(DOCS, n), 'utf8');
const regen = 'ejecuta node scripts/arquitectura-gen.js';

function registry() {
  const reg = JSON.parse(readDoc('modulos.json'));
  const real = L.listModules();
  for (const f of real) ok(reg[f], `${f} no está en modulos.json (${regen})`);
  for (const f of Object.keys(reg)) {
    ok(fs.existsSync(path.join(L.root, f)), `${f} está en modulos.json pero el archivo no existe`);
    ok(fs.existsSync(path.join(L.root, reg[f].debeVivir)) || reg[f].debeVivir === f || /^(main|shared|preload|renderer)\//.test(reg[f].debeVivir), `${f}: debeVivir inválido`);
    ok(reg[f].dominio, `${f}: sin dominio`);
    ok(reg[f].responsabilidad && reg[f].responsabilidad.length > 10, `${f}: sin responsabilidad`);
  }
  const info = L.scan();
  for (const f of real) {
    if (!reg[f]) continue;
    ok(JSON.stringify(reg[f].depende) === JSON.stringify(info[f].depende), `${f}: dependencias del registro (${reg[f].depende}) ≠ código (${info[f].depende}); ${regen}`);
    ok(JSON.stringify(reg[f].api) === JSON.stringify(info[f].api.map((e) => e.nombre)), `${f}: API del registro ≠ código; ${regen}`);
    for (const d of reg[f].depende) ok(fs.existsSync(path.join(L.root, d)), `${f}: depende de ${d}, que no existe`);
  }
  console.log(`registry: ${real.length} módulos`);
}

function ipc() {
  const doc = readDoc('05-ipc-y-persistencia.md');
  const handlers = L.ipcHandlers();
  ok(handlers.length > 50, `solo ${handlers.length} canales leídos de main.js: el lector está roto`);
  for (const h of handlers) ok(doc.includes(`\`${h.canal}\``), `canal ${h.canal} sin documentar; ${regen}`);
  for (const m of doc.matchAll(/^\| `([\w:.\-]+)` \| (?:invoke|send) \|/gm)) ok(handlers.some((h) => h.canal === m[1]), `el documento lista el canal ${m[1]}, que ya no existe en main.js`);
  for (const r of L.appRoutes()) ok(doc.includes(`\`${r.ruta}\``), `ruta ${r.ruta} sin documentar`);
  const reg = JSON.parse(readDoc('modulos.json'));
  for (const [f, e] of Object.entries(reg)) for (const p of e.persiste) ok(doc.includes(`\`${p}\``), `clave ${p} (${f}) sin documentar`);
  console.log(`ipc: ${handlers.length} canales`);
}

function docs() {
  const need = ['README.md', '01-main.md', '02-shared-y-preload.md', '03-renderer.md', '04-vistas-y-componentes.md', '05-ipc-y-persistencia.md', '06-qa.md', '07-deuda.md', 'modulos.json'];
  for (const n of need) ok(fs.existsSync(path.join(DOCS, n)), `falta docs/arquitectura/${n}`);
  for (const n of need.filter((x) => x.endsWith('.md') && fs.existsSync(path.join(DOCS, x)))) {
    const t = readDoc(n);
    ok(t.trim().length > 200, `${n} está vacío`);
    for (const m of t.matchAll(/`((?:main|shared|preload|renderer|scripts|docs|\.github|\.specs)\/[\w.\-/]+\.(?:js|mjs|html|md|json|yml|png|css))(?::\d+)?`/g)) ok(fs.existsSync(path.join(L.root, m[1])), `${n} cita ${m[1]}, que no existe`);
    for (const m of t.matchAll(/\]\((\.\.?\/[^)#]+)(?:#[^)]*)?\)/g)) ok(fs.existsSync(path.join(DOCS, m[1])), `${n} enlaza ${m[1]}, que no existe`);
  }
  if (fs.existsSync(path.join(DOCS, 'modulos.json'))) {
    const reg = JSON.parse(readDoc('modulos.json'));
    for (const n of ['01-main.md', '02-shared-y-preload.md', '03-renderer.md']) {
      const t = readDoc(n);
      for (const f of Object.keys(reg)) if (f.startsWith({ '01-main.md': 'main/', '02-shared-y-preload.md': 'shared/', '03-renderer.md': 'renderer/' }[n]) || (n.startsWith('02') && f.startsWith('preload/'))) ok(t.includes(`### \`${f}\``), `${n} no documenta ${f}; ${regen}`);
    }
    const qa = readDoc('06-qa.md');
    for (const f of Object.keys(reg)) ok(qa.includes(`\`${f}\``), `06-qa.md no lista ${f}`);
  }
  const index = fs.readFileSync(path.join(L.root, 'docs', 'README.md'), 'utf8');
  ok(index.includes('arquitectura/README.md'), 'docs/README.md no enlaza arquitectura/README.md');
  console.log('docs: ok');
}

const table = { registry, ipc, docs };
for (const m of modes) { if (!table[m]) { console.error(`modo desconocido: ${m}`); process.exit(2); } table[m](); }
if (failed) { console.error(`${failed} fallos`); process.exit(1); }
console.log('ok');
