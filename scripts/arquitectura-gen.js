'use strict';
// Genera docs/arquitectura: el registro `modulos.json` (mezclando lo curado a mano con lo leído del código) y los documentos que salen de él.
// Uso: node scripts/arquitectura-gen.js   (idempotente; conserva responsabilidad, dominio, debeVivir, notas y qa.visual)
const fs = require('fs');
const path = require('path');
const L = require('./arquitectura-lib');

const OUT = path.join(L.root, 'docs', 'arquitectura');
const CURATED = ['responsabilidad', 'dominio', 'debeVivir', 'notas'];

// Valores iniciales de lo curado (solo se usan si el registro aún no los tiene). dominio, debeVivir (si no es el propio archivo), notas.
const SEED = {
  'main/main.js': ['app', null, 'Mezcla arranque, ventanas, protocolo app:// y todos los canales IPC en un solo archivo (705 líneas): candidato a dividir por dominio.', 'Arranque de Electron: crea la ventana de la interfaz y las de los decks (YouTube Music), registra el protocolo app:// y todos los canales IPC, y enlaza los módulos de main/.'],
  'main/analysis-worker.js': ['analysis', null, null, 'Hilo de trabajo del análisis: recibe el audio decodificado de analyzer.js, llama a shared/analysis.js y devuelve la forma de onda, el BPM y la rejilla sin bloquear el proceso principal.'],
  'main/analysis-backlog.js': ['analysis'],
  'main/analyzer.js': ['analysis'],
  'main/analyze-cli.js': ['analysis'],
  'main/decode.js': ['analysis'],
  'main/auth-import.js': ['auth'],
  'main/export.js': ['export'],
  'main/genres.js': ['genres'],
  'main/library-save.js': ['library'],
  'main/local-library.js': ['library'],
  'main/local-search.js': ['library'],
  'main/mixedit.js': ['automix'],
  'main/net-gate.js': ['platform'],
  'main/playlists.js': ['library'],
  'main/selftest.js': ['platform'],
  'main/settings.js': ['settings'],
  'main/stems-device.js': ['stems'],
  'main/stems-worker.js': ['stems'],
  'main/stems.js': ['stems'],
  'main/tools.js': ['install'],
  'main/updater.js': ['updater'],
  'main/ytdlp.js': ['install'],
  'main/ytm-library.js': ['library'],
  'preload/app.js': ['app', null, 'Un solo objeto `window.api` con todos los grupos: crece con cada función nueva.'],
  'preload/deck.js': ['audio'],
  'shared/analysis.js': ['analysis'],
  'shared/deck-engine.js': ['audio'],
  'shared/dsp-chain.js': ['audio'],
  'shared/fx.js': ['fx'],
  'shared/scratch-math.js': ['jog'],
  'shared/scratch-worklet.js': ['jog'],
  'shared/scratch.js': ['jog'],
  'shared/stems-dsp.js': ['stems'],
  'shared/structure.js': ['automix'],
  'renderer/app.js': ['ui', null, 'Cableado de todo: decks, mezclador, librería, AutoMix, ajustes y atajos en 1232 líneas; las vistas deberían tener un archivo cada una.', 'Punto de entrada de la interfaz: crea los dos decks y el mezclador y cablea sesión, librería, AutoMix, sampler, grabación, vistas, ajustes, atajos y MIDI.'],
  'renderer/automix-add.js': ['automix'],
  'renderer/automix-compat.js': ['automix'],
  'renderer/automix-entry.js': ['automix'],
  'renderer/automix-origin.js': ['automix'],
  'renderer/automix-profiles.js': ['automix'],
  'renderer/automix-status.js': ['automix'],
  'renderer/automix-timeline.js': ['automix'],
  'renderer/automix.js': ['automix'],
  'renderer/camelot.js': ['library'],
  'renderer/controls.js': ['ui'],
  'renderer/deck.js': ['audio', null, 'Mezcla el deck (audio, ondas, cues, loops, FX) con su DOM: el modelo y la vista deberían separarse.', 'Un deck completo en la interfaz: carga la pista (streaming o archivo), motor de audio, ondas, cues, loops, tempo, stems, efectos y los controles de su plantilla DOM.'],
  'renderer/fxchain.js': ['fx'],
  'renderer/fxcues.js': ['fx'],
  'renderer/fxpad.js': ['fx'],
  'renderer/fxpanel.js': ['fx'],
  'renderer/fxpresets.js': ['fx'],
  'renderer/genres.js': ['genres'],
  'renderer/index.html': ['ui'],
  'renderer/knob.js': ['ui'],
  'renderer/layout.js': ['ui'],
  'renderer/library.js': ['library'],
  'renderer/midi.js': ['sampler-midi'],
  'renderer/mixeditor.js': ['automix'],
  'renderer/mixplan.js': ['automix'],
  'renderer/mixpreview.js': ['automix'],
  'renderer/playlists.js': ['library'],
  'renderer/preview.js': ['library'],
  'renderer/recipes.js': ['automix'],
  'renderer/sampler.js': ['sampler-midi'],
  'renderer/settings-ui.js': ['settings'],
  'renderer/source.js': ['video'],
  'renderer/splits.js': ['ui'],
  'renderer/stems.js': ['stems'],
  'renderer/update-ui.js': ['updater'],
  'renderer/views.js': ['ui'],
  'renderer/viz.js': ['automix'],
  'renderer/waveform.js': ['audio'],
};

const regFile = path.join(OUT, 'modulos.json');
const prev = fs.existsSync(regFile) ? JSON.parse(fs.readFileSync(regFile, 'utf8')) : {};
const info = L.scan();

function qaOf(f, i, old) {
  const t = i.pruebas;
  return {
    logica: t.logica[0] || null,
    estatica: t.estatica[0] || null,
    arranque: t.autopruebas[0] || null,
    visual: old?.qa?.visual ?? null,
  };
}

const reg = {};
for (const f of Object.keys(info)) {
  const i = info[f];
  const old = prev[f] || {};
  const [dominio, debeVivir, notas, resp] = SEED[f] || [];
  const entry = {
    capa: i.capa,
    dominio: old.dominio ?? dominio ?? null,
    responsabilidad: old.responsabilidad ?? (i.encabezado || resp || ''),
    api: i.api.map((e) => e.nombre),
    contrato: i.api.filter((e) => e.hace).map((e) => ({ nombre: e.nombre, hace: e.hace })),
    metodos: i.api.length ? i.metodos : [],
    depende: i.depende,
    usadoPor: i.usadoPor,
    persiste: i.persiste,
    debeVivir: old.debeVivir ?? debeVivir ?? f,
    ...(old.notas ?? notas ? { notas: old.notas ?? notas } : {}),
    lineas: i.lineas,
    qa: qaOf(f, i, old),
  };
  reg[f] = entry;
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(regFile, `${JSON.stringify(reg, null, 2)}\n`);

// ---- documentos ----
const link = (f) => `\`${f}\``;
const list = (a) => (a.length ? a.map(link).join(', ') : '—');
const esc = (s) => String(s).replace(/\|/g, '\\|');

function section(f) {
  const e = reg[f];
  const out = [`### ${link(f)}`, '', `**Dominio:** ${e.dominio || '—'} · **Líneas:** ${e.lineas}`, '', e.responsabilidad ? `${e.responsabilidad}` : '_Sin descripción en el archivo: documentar._', ''];
  if (e.api.length) {
    out.push('| Exporta | Qué hace |', '|---|---|');
    for (const n of e.api) out.push(`| \`${n}\` | ${esc(e.contrato.find((c) => c.nombre === n)?.hace || '—')} |`);
    out.push('');
  }
  if (e.metodos.length) {
    out.push('<details><summary>Métodos con contrato (' + e.metodos.length + ')</summary>', '', '| Método | Qué hace |', '|---|---|');
    for (const m of e.metodos) out.push(`| \`${esc(m.nombre)}\` | ${esc(m.hace)} |`);
    out.push('', '</details>', '');
  }
  out.push(`- **Depende de:** ${list(e.depende)}`, `- **Lo usan:** ${list(e.usadoPor)}`);
  if (e.persiste.length) out.push(`- **Guarda:** ${e.persiste.map((p) => `\`${p}\``).join(', ')}`);
  if (e.debeVivir !== f) out.push(`- **Debería vivir en:** ${link(e.debeVivir)}`);
  if (e.notas) out.push(`- **Nota:** ${e.notas}`);
  const q = e.qa;
  out.push(`- **Pruebas:** lógica ${q.logica ? link(`scripts/${q.logica}`) : '**sin prueba**'}${q.estatica ? ` · estática ${link(`scripts/${q.estatica}`)}` : ''}${q.arranque ? ` · en la app ${link(`scripts/${q.arranque}`)}` : ''}`, '');
  return out.join('\n');
}

const GEN = '<!-- Generado por scripts/arquitectura-gen.js desde docs/arquitectura/modulos.json: no editar a mano (edita el registro y regenera). -->';
function layerDoc(title, intro, layers) {
  const files = Object.keys(reg).filter((f) => layers.includes(f.split('/')[0]));
  return [`# ${title}`, '', GEN, '', intro, '', `${files.length} módulos.`, '', ...files.map(section)].join('\n');
}

fs.writeFileSync(path.join(OUT, '01-main.md'), `${layerDoc('01 · Proceso principal (`main/`)', 'Todo lo que corre en Node/Electron sin DOM: ventanas, procesos hijos (yt-dlp, ffmpeg, stems), disco y red. La lógica pura (sin Electron) se prueba desde `scripts/test-*.js` sin abrir la app.', ['main'])}\n`);
fs.writeFileSync(path.join(OUT, '02-shared-y-preload.md'), `${layerDoc('02 · Compartido y preload (`shared/`, `preload/`)', '`shared/` se carga como `<script>` en la interfaz (UMD: también se puede `require` en pruebas) y lo comparten el análisis, el motor de deck y los efectos. `preload/` es el puente: `preload/app.js` expone `window.api` a la interfaz y `preload/deck.js` corre dentro de YouTube Music.', ['shared', 'preload'])}\n`);
fs.writeFileSync(path.join(OUT, '03-renderer.md'), `${layerDoc('03 · Interfaz (`renderer/`)', 'Módulos que corren en la ventana: algunos son puros (sin DOM) y se prueban en Node; los que tocan el DOM se prueban dentro de Electron con autopruebas (`YTDJ_SELFTEST_MODULE`).', ['renderer'])}\n`);

// 05 · IPC, rutas y persistencia
const handlers = L.ipcHandlers();
const callers = L.ipcCallers();
const routes = L.appRoutes();
const ipc = [`# 05 · IPC, rutas y persistencia`, '', GEN, '', '## Canales IPC', '', `${handlers.length} canales registrados en [main/main.js](../../main/main.js). Llamador = grupo y función de \`window.api\` en [preload/app.js](../../preload/app.js).`, '', '| Canal | Tipo | Manejador | Llamadores |', '|---|---|---|---|'];
for (const h of handlers) ipc.push(`| \`${h.canal}\` | ${h.tipo} | \`main/main.js:${h.linea}\` | ${(callers[h.canal] || []).map((c) => `\`${c}\``).join(', ') || '—'} |`);
const orphan = Object.keys(callers).filter((c) => !handlers.some((h) => h.canal === c));
ipc.push('', `Canales que el preload llama o escucha sin manejador \`ipcMain\` (eventos que envía \`main.js\` a la ventana, p. ej. \`webContents.send\`): ${orphan.length ? orphan.map((c) => `\`${c}\``).join(', ') : 'ninguno'}.`);
ipc.push('', '## Rutas `app://`', '', 'El protocolo `app://` sirve la interfaz y los datos locales sin abrir `file://`:', '', '| Ruta | Definida en |', '|---|---|');
for (const r of routes) ipc.push(`| \`${r.ruta}\` | \`main/main.js:${r.linea}\` |`);
const keys = [];
for (const f of Object.keys(reg)) for (const p of reg[f].persiste) keys.push([p, f]);
ipc.push('', '## Persistencia', '', 'Lo que se guarda y quién es el dueño (el módulo que lo lee y escribe).', '', '| Clave | Dueño |', '|---|---|');
for (const [k, f] of keys.sort()) ipc.push(`| \`${k}\` | \`${f}\` |`);
fs.writeFileSync(path.join(OUT, '05-ipc-y-persistencia.md'), `${ipc.join('\n')}\n`);

// 06 · matriz de QA
const qa = ['# 06 · Matriz de QA', '', GEN, '', 'Cada módulo frente a sus tres pruebas: **lógica** (importa el módulo y ejecuta su código), **estática** (lee su texto) y **en la app** (autoprueba dentro de Electron). La comprobación visual de las vistas está en `scripts/visual-check.js`. `—` marca un hueco.', '', '| Módulo | Dominio | Lógica | Estática | En la app | Visual |', '|---|---|---|---|---|---|'];
const t = (x) => (x ? `\`${x}\`` : '—');
let huecos = 0;
for (const [f, e] of Object.entries(reg)) {
  if (!e.qa.logica && !e.qa.estatica && !e.qa.arranque) huecos++;
  qa.push(`| \`${f}\` | ${e.dominio || '—'} | ${t(e.qa.logica)} | ${t(e.qa.estatica)} | ${t(e.qa.arranque)} | ${t(e.qa.visual)} |`);
}
const sinLogica = Object.entries(reg).filter(([f, e]) => !e.qa.logica && !f.endsWith('.html'));
qa.push('', `## Huecos`, '', `- Sin ninguna prueba: **${huecos}** módulos.`, `- Sin prueba de lógica (solo estática o en la app): **${sinLogica.length}** módulos — ${sinLogica.map(([f]) => `\`${f}\``).join(', ') || 'ninguno'}.`);
fs.writeFileSync(path.join(OUT, '06-qa.md'), `${qa.join('\n')}\n`);

console.log(`${Object.keys(reg).length} módulos, ${handlers.length} canales, ${routes.length} rutas, ${keys.length} claves`);
