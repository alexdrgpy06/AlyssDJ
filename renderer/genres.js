// Géneros de las pistas en la interfaz: mapa id → etiquetas (viene del almacén de main), chips, filtro y editor.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

class GenreIndex {
  constructor() {
    this.map = new Map();
    this.vocab = [];
    this.listeners = new Set();
  }

  async load() {
    const r = await window.ytdj.genres?.all?.();
    if (!r) return;
    this.map = new Map(Object.entries(r.map || {}));
    this.vocab = r.vocabulary || [];
    this.emit();
    return this;
  }

  bind() {
    window.ytdj.genres?.onEvent?.(() => this.load());
  }

  on(fn) {
    this.listeners.add(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }

  of(id) {
    return this.map.get(id)?.genres || [];
  }

  // Alguna etiqueta de la pista está entre las elegidas (sin selección, todas pasan).
  matches(id, selected) {
    if (!selected?.size) return true;
    return this.of(id).some((g) => selected.has(g));
  }

  // Chips para una fila: hasta `max` y «+N».
  chips(id, max = 3) {
    const g = this.of(id);
    if (!g.length) return '';
    const shown = g.slice(0, max).map((x) => `<span class="gchip">${esc(x)}</span>`).join('');
    return `<span class="gchips" title="${esc(g.join(', '))}">${shown}${g.length > max ? `<span class="gchip more">+${g.length - max}</span>` : ''}</span>`;
  }
}

export const genres = new GenreIndex();

// Editor de etiquetas bajo una fila: Enter o coma añaden, Retroceso quita la última, Escape cierra.
export function openGenreEditor(tr, id, onClose) {
  closeGenreEditor();
  const cols = tr.children.length;
  const row = document.createElement('tr');
  row.className = 'gedit-row';
  row.innerHTML = `<td colspan="${cols}"><div class="gedit" role="group" aria-label="Géneros de la pista"><span class="gedit-chips"></span><input type="text" class="gedit-in" list="gedit-vocab" placeholder="Añadir género y pulsar Enter" aria-label="Añadir género" autocomplete="off" /><datalist id="gedit-vocab">${genres.vocab.map((v) => `<option value="${esc(v.name)}"></option>`).join('')}</datalist><button type="button" class="btn sm gedit-done">Listo</button></div></td>`;
  tr.after(row);
  let list = [...genres.of(id)];
  const chipsEl = row.querySelector('.gedit-chips');
  const input = row.querySelector('.gedit-in');
  const save = async () => {
    const r = await window.ytdj.genres.set(id, list);
    if (r?.ok === false) return;
    list = r?.data?.genres ? [...r.data.genres] : [...list]; // lo que quedó guardado ya va normalizado (mayúsculas, sin repetidos)
    paint();
    await genres.load();
  };
  const paint = () => {
    chipsEl.innerHTML = list.map((g, i) => `<span class="gchip edit">${esc(g)}<button type="button" data-i="${i}" aria-label="Quitar ${esc(g)}">×</button></span>`).join('');
  };
  const add = (text) => {
    const t = String(text).replace(/,/g, ' ').trim();
    if (!t || list.length >= 5 || list.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    list.push(t);
    paint();
    save();
  };
  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    list.splice(+b.dataset.i, 1);
    paint();
    save();
    input.focus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && list.length) {
      list.pop();
      paint();
      save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      closeGenreEditor();
      onClose?.();
    }
  });
  row.querySelector('.gedit-done').addEventListener('click', () => {
    add(input.value);
    closeGenreEditor();
    onClose?.();
  });
  paint();
  input.focus();
}

export function closeGenreEditor() {
  document.querySelector('.gedit-row')?.remove();
}
