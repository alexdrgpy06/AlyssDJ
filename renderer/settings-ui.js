// Búsqueda de Ajustes: funciones puras (sin DOM) para filtrar opciones por texto.
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// rows: [{ pane, text }] → { panes: Set de secciones con resultados, hits: índices de las filas que coinciden }
// Todas las palabras de la consulta deben aparecer (en cualquier orden) en el texto de la fila.
export function settingsFilter(query, rows) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const hits = [];
  const panes = new Set();
  if (!words.length) return { panes, hits, active: false };
  rows.forEach((r, i) => {
    const t = norm(r.text);
    if (words.every((w) => t.includes(w))) {
      hits.push(i);
      panes.add(r.pane);
    }
  });
  return { panes, hits, active: true };
}

// Parche de ajustes que corresponde a un control del formulario (los tres de la salida de audio van juntos).
export function settingPatch(name, f) {
  switch (name) {
    case 'outputMode':
    case 'masterLabel':
    case 'cueLabel':
      return { output: { mode: f.outputMode.value, masterLabel: f.masterLabel.value, cueLabel: f.cueLabel.value } };
    case 'ytdlpPath':
      return { ytdlpPath: f.ytdlpPath.value.trim() };
    case 'pitchRange':
      return { pitchRange: Number(f.pitchRange.value) };
    case 'wavesMode':
      return null; // no es un ajuste de main: lo guarda el estado de las vistas
    default: {
      const el = f[name];
      if (!el) return null;
      return { [name]: el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value };
    }
  }
}

// Parche con los valores por defecto de las opciones de una sección.
export function sectionDefaults(names, defaults) {
  const patch = {};
  for (const n of names) {
    if (n === 'outputMode' || n === 'masterLabel' || n === 'cueLabel') patch.output = defaults.output;
    else if (n !== 'wavesMode' && n in defaults) patch[n] = defaults[n];
  }
  return patch;
}
