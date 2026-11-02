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
