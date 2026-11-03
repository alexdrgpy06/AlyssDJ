'use strict';
// Lectura del código para el mapa de arquitectura: módulos, exportaciones, dependencias, IPC y claves de persistencia.
// Lo usan scripts/arquitectura-gen.js (que escribe docs/arquitectura) y scripts/test-arquitectura.js (que comprueba que no diverge).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const LAYERS = { main: 'principal', preload: 'preload', shared: 'compartido', renderer: 'interfaz' };
const rel = (f) => path.relative(root, f).split(path.sep).join('/');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function listModules() {
  const out = [];
  for (const dir of Object.keys(LAYERS)) {
    for (const n of fs.readdirSync(path.join(root, dir)).sort()) {
      if (/\.(js|mjs)$/.test(n) || (dir === 'renderer' && n === 'index.html')) out.push(`${dir}/${n}`);
    }
  }
  return out;
}

// Primer bloque de comentarios `//` del archivo (sin shebang ni 'use strict').
function header(src) {
  const lines = src.split('\n').filter((l) => !/^#!|^'use strict'|^"use strict"/.test(l.trim()));
  const out = [];
  for (const l of lines) {
    const m = /^\s*\/\/\s?(.*)$/.exec(l);
    if (m) out.push(m[1].trim());
    else if (!l.trim() && !out.length) continue;
    else break;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// Comentario `//` inmediatamente encima de la línea i.
function docAbove(lines, i) {
  const out = [];
  for (let k = i - 1; k >= 0; k--) {
    const m = /^\s*\/\/\s?(.*)$/.exec(lines[k]);
    if (!m) break;
    out.unshift(m[1].trim());
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// Exportaciones públicas: ESM (`export …`), CommonJS (`module.exports`) y UMD (`return { … }` al final) con su comentario.
function exportsOf(file, src) {
  const lines = src.split('\n');
  const list = [];
  const add = (name, kind, i) => { if (!list.some((e) => e.nombre === name)) list.push({ nombre: name, tipo: kind, hace: i >= 0 ? docAbove(lines, i) : '' }); };
  lines.forEach((l, i) => {
    let m;
    if ((m = /^export\s+(?:async\s+)?function\*?\s+(\w+)/.exec(l))) add(m[1], 'función', i);
    else if ((m = /^export\s+class\s+(\w+)/.exec(l))) add(m[1], 'clase', i);
    else if ((m = /^export\s+(?:const|let|var)\s+(\w+)/.exec(l))) add(m[1], 'valor', i);
    else if ((m = /^export\s*\{([^}]*)\}/.exec(l))) for (const n of m[1].split(',')) { const nm = n.trim().split(/\s+as\s+/).pop(); if (nm) add(nm, 'valor', i); }
  });
  let m = /module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/m.exec(src);
  if (!m) m = /return\s*\{([^{}]*)\};?\s*\}\);?\s*$/m.exec(src);
  if (m) for (const part of m[1].split(',')) { const nm = part.trim().split(':')[0].trim(); if (/^\w+$/.test(nm)) { const idx = lines.findIndex((l) => new RegExp(`^\\s*(?:async\\s+)?(?:function\\s+${nm}\\b|class\\s+${nm}\\b|const\\s+${nm}\\b)`).test(l)); add(nm, 'valor', idx); } }
  else if ((m = /module\.exports\s*=\s*(?:async\s+)?(?:function\s*(\w*)|class\s+(\w+)|(\w+))/.exec(src))) add(m[1] || m[2] || m[3] || path.basename(file, '.js'), 'valor', -1);
  // métodos públicos con comentario (clases exportadas): el contrato de lo que importa
  const methods = [];
  lines.forEach((l, i) => {
    const mm = /^  (?:static\s+)?(?:async\s+)?(?:get\s+)?(\w+)\(([^)]*)\)\s*\{\s*$/.exec(l);
    if (mm && !/^(constructor|if|for|while|switch|catch|function)$/.test(mm[1]) && !mm[1].startsWith('_')) {
      const d = docAbove(lines, i);
      if (d && !/^[-=#*\s]*$/.test(d) && !/^-{3,}/.test(d)) methods.push({ nombre: `${mm[1]}(${mm[2].replace(/\s+/g, ' ').trim()})`, hace: d });
    }
  });
  return { api: list, metodos: methods };
}

const resolveDep = (from, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  for (const cand of [base, `${base}.js`, `${base}.mjs`]) if (fs.existsSync(path.join(root, cand)) && fs.statSync(path.join(root, cand)).isFile()) return cand;
  return base;
};

function depsOf(file, src) {
  const out = new Set();
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  for (const re of [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, /\bnew Worker\([^)]*['"](\.\.?\/[^'"]+)['"]/g]) {
    let m;
    while ((m = re.exec(stripped))) { const d = resolveDep(file, m[1]); if (d && /^(main|preload|shared|renderer)\//.test(d)) out.add(d); }
  }
  return [...out].sort();
}

// Quién carga el archivo por etiqueta <script> (los módulos UMD de shared/ no se importan: los carga index.html).
function scriptTags() {
  const html = read('renderer/index.html');
  const out = [];
  for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) out.push(m[1].replace(/^\//, ''));
  return out.map((s) => (s.startsWith('shared/') ? s : `renderer/${s}`));
}

function persistenceOf(file, src) {
  const out = new Set();
  const stripped = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  for (const m of stripped.matchAll(/['"`]((?:alyssdj|ytdj)[.:][\w.:\-]*)(?:\$\{[^}]*\})?['"`]/g)) out.add(`localStorage:${m[1]}`);
  for (const m of stripped.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*['"]([\w.:\-]+)['"]/g)) out.add(`localStorage:${m[1]}`);
  for (const m of stripped.matchAll(/(?:^|[^\w.])LS\s*=\s*['"]([\w.:\-]+)['"]|STORE\s*=\s*['"]([\w.:\-]+)['"]/g)) out.add(`localStorage:${m[1] || m[2]}`);
  if (/^(main|shared)\//.test(file)) for (const m of stripped.matchAll(/['"]([\w\-]+\.(?:json|jsonl))['"]/g)) out.add(`userData:${m[1]}`);
  return [...out].sort();
}

// ----- IPC: canal → tipo → manejador (main.js) → llamadores (preload/app.js) -----
function ipcHandlers() {
  const src = read('main/main.js');
  const out = [];
  src.split('\n').forEach((l, i) => {
    const m = /ipcMain\.(handle|on|once)\(\s*'([^']+)'/.exec(l);
    if (m) out.push({ canal: m[2], tipo: m[1] === 'handle' ? 'invoke' : 'send', linea: i + 1 });
  });
  return out;
}

// Llamadores: recorre preload/app.js llevando la cuenta de grupos (`  lib: {`) y entradas (`    popularity: (...) => ipcRenderer.invoke('x')`).
function ipcCallers() {
  const src = read('preload/app.js').split('\n');
  const out = {};
  let group = '';
  for (const l of src) {
    const g = /^  (\w+): \{/.exec(l);
    if (g) group = g[1];
    const e = /^    (\w+): .*?(?:ipcRenderer\.(?:invoke|send)\(\s*'([^']+)'|\bon\(\s*'([^']+)'\))/.exec(l);
    if (e) { const canal = e[2] || e[3]; (out[canal] ||= []).push(`${group}.${e[1]}`); }
  }
  // el preload del deck (dentro de YouTube Music) habla por los mismos canales
  for (const l of read('preload/deck.js').split('\n')) for (const m of l.matchAll(/ipcRenderer\.(?:send|invoke|on)\(\s*'([^']+)'/g)) (out[m[1]] ||= []).push('preload/deck.js');
  return out;
}

// Rutas del protocolo app://
function appRoutes() {
  const src = read('main/main.js').split('\n');
  const out = [];
  src.forEach((l, i) => { const m = /rel\.startsWith\('([\w/\-]+)'\)|startsWith\('(\/?[\w/\-]+\/)'\)/.exec(l); if (m && /app|rel/.test(l)) out.push({ ruta: `app://${m[1] || m[2]}`, linea: i + 1 }); });
  return out;
}

// Pruebas que usan cada módulo: `logica` (lo importan o requieren y lo ejecutan) y `estatica` (leen su texto).
function testUsage(mods) {
  const scripts = fs.readdirSync(path.join(root, 'scripts')).filter((n) => /\.(js|mjs)$/.test(n));
  const texts = Object.fromEntries(scripts.map((n) => [n, read(`scripts/${n}`)]));
  const out = {};
  for (const mod of mods) {
    const base = path.posix.basename(mod);
    const logica = [];
    const estatica = [];
    const arranque = [];
    for (const n of scripts) {
      if (!/^(test-|.*-test\.)/.test(n)) continue;
      const t = texts[n];
      const esc = base.replace(/\./g, '\\.');
      const imp = new RegExp(`(?:import\\(|require\\(|from\\s+)\\s*['"][^'"]*${mod.replace(/\./g, '\\.')}['"]|(?:import\\(|require\\(|from\\s+)\\s*['"][^'"]*/${esc}['"]`).test(t);
      const txt = new RegExp(`read\\(\\s*['"\`]${mod.replace(/\./g, '\\.')}['"\`]|readFileSync\\([^)]*${esc}`).test(t);
      if (imp) logica.push(n);
      else if (txt) estatica.push(n);
    }
    for (const n of scripts) if (/-selftest\.js$/.test(n) && new RegExp(`\\b${base.replace(/\.js$/, '').replace(/[-.]/g, '[-._]?')}\\b`).test(texts[n]) && !/^(rediseno|fx-ui)/.test(n)) arranque.push(n);
    out[mod] = { logica: logica.sort(), estatica: estatica.sort(), autopruebas: arranque.sort() };
  }
  return out;
}

function scan() {
  const mods = listModules();
  const tags = scriptTags();
  const info = {};
  for (const f of mods) {
    const src = read(f);
    const isJs = f.endsWith('.js') || f.endsWith('.mjs');
    info[f] = {
      capa: LAYERS[f.split('/')[0]],
      encabezado: isJs ? header(src) : 'Documento HTML de la interfaz: estructura de las vistas, decks, mezclador, librería y diálogos.',
      ...(isJs ? exportsOf(f, src) : { api: [], metodos: [] }),
      depende: isJs ? depsOf(f, src) : tags.map((t) => t),
      persiste: isJs ? persistenceOf(f, src) : [],
      lineas: src.split('\n').length,
    };
  }
  const usedBy = {};
  for (const [f, i] of Object.entries(info)) for (const d of i.depende) (usedBy[d] ||= new Set()).add(f);
  for (const t of tags) (usedBy[t] ||= new Set()).add('renderer/index.html');
  for (const [f, i] of Object.entries(info)) i.usadoPor = [...(usedBy[f] || [])].filter((x) => x !== f).sort();
  const tests = testUsage(mods);
  for (const f of mods) info[f].pruebas = tests[f];
  return info;
}

module.exports = { root, LAYERS, rel, read, listModules, header, exportsOf, depsOf, persistenceOf, ipcHandlers, ipcCallers, appRoutes, scan, scriptTags };
