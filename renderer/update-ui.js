// Pinta el aviso de actualización según el estado que manda el proceso principal.
const $ = (s) => document.querySelector(s);

export function describe(st) {
  const v = st.version ? ` ${st.version}` : '';
  switch (st.stage) {
    case 'available':
      return { text: `Hay una versión nueva de AlyssDJ:${v}${st.notes ? ` — ${st.notes.split('\n')[0].slice(0, 90)}` : ''}`, go: st.mode === 'notify' ? 'Ver descarga' : 'Descargar e instalar', skip: true, later: true, bar: false };
    case 'downloading':
      return { text: `Descargando la versión${v}… ${st.progress || 0}%`, go: null, skip: false, later: false, bar: true };
    case 'downloaded':
      return { text: `La versión${v} está lista. Se instalará al cerrar la app, o ahora si no hay música sonando.`, go: 'Reiniciar e instalar', skip: false, later: true, bar: false };
    case 'error':
      return { text: `No se pudo buscar o descargar la actualización${st.error ? `: ${st.error}` : ''}`, go: null, skip: false, later: true, bar: false };
    default:
      return null;
  }
}

export function renderUpdate(st, { toast } = {}) {
  const status = $('#upd-status');
  if (status) status.textContent = { checking: 'Buscando…', none: 'Estás al día.', error: st.error ? `Error: ${st.error}` : 'No se pudo comprobar.', available: `Disponible: ${st.version || ''}` }[st.stage] || '';
  const d = describe(st);
  const el = $('#update-banner');
  if (!d) return void (el.hidden = true);
  el.hidden = false;
  $('#upd-text').textContent = d.text;
  $('#upd-bar').hidden = !d.bar;
  $('#upd-fill').style.width = `${st.progress || 0}%`;
  $('#upd-go').hidden = !d.go;
  if (d.go) $('#upd-go').textContent = d.go;
  $('#upd-skip').hidden = !d.skip;
  $('#upd-later').hidden = !d.later;
}
