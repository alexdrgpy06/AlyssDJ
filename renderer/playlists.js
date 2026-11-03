// Playlists locales: sección «Mis listas» en las fuentes, menú «Añadir a playlist», selección múltiple y barras de acciones.
// La librería monta una instancia (`library.pls`); aquí vive todo lo que antes no existía: crear, poner, sacar, ordenar y listas inteligentes.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtTotal = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min` : `${Math.floor(s / 60)} min`);
const MIME = 'application/x-ytdj-tracks';
const mini = (r) => ({ videoId: r.videoId, title: r.title || '', artist: r.artist || '', duration: r.duration || 0, thumb: r.thumb || '', ...(r.local ? { local: true } : {}) });

export class PlaylistsUI {
  constructor(lib) {
    this.lib = lib;
    this.app = lib.app;
    this.lists = [];
    this.cur = null; // lista abierta: { id, name, kind, tracks, sort, filter }
    this.undo = null; // { id, removed }
    this.sel = new Set();
    this.anchor = -1;
    this.editing = null;
    this.dragging = null;
    this.dir = 1;
    this.src = $('#pl-sources');
    this.bar = $('#pl-bar');
    this.selBar = $('#sel-bar');
    this.menu = $('#pl-menu');
    this.smart = $('#pl-smart');
    $('#ps-key').innerHTML = $('#f-key').innerHTML;
    this.bind();
    window.ytdj.pl.onChange(() => this.refresh());
    this.refresh();
  }

  get open() { return !!this.cur && this.lib.tab === `pl:${this.cur.id}`; }

  async refresh() {
    const r = await window.ytdj.pl.list();
    if (!r.ok) return;
    this.lists = r.data;
    this.renderSources();
    if (this.open) {
      const l = this.lists.find((x) => x.id === this.cur.id);
      if (l) { this.lib.setMsg(this.summary(l)); this.cur.name = l.name; this.lib.listName = l.name; $('#pl-name').textContent = l.name; }
    }
  }

  summary(l) { return `${l.name} · ${l.count} pistas${l.duration ? ` · ${fmtTotal(l.duration)}` : ''}${l.kind === 'smart' ? ' · inteligente' : ''}`; }

  renderSources() {
    if (this.editing && this.src.querySelector('.pl-input')) return; // no se pisa el nombre que se está escribiendo
    this.src.innerHTML = this.lists.length ? this.lists.map((l) => {
      const icon = `<svg class="ic"><use href="#i-${l.kind === 'smart' ? 'smart' : 'list'}"/></svg>`;
      if (this.editing === l.id) return `<div class="pl-row editing" data-pl="${esc(l.id)}">${icon}<input class="pl-input" value="${esc(l.name)}" maxlength="80" aria-label="Nombre de la playlist" /></div>`;
      return `<button type="button" role="listitem" data-tab="pl:${esc(l.id)}" data-pl="${esc(l.id)}" class="${this.lib.tab === `pl:${l.id}` ? 'on' : ''}" title="${esc(this.summary(l))}">${icon}<span>${esc(l.name)}</span><em class="cnt">${l.count}</em></button>`;
    }).join('') : '<p class="pl-none">Aún no tienes listas</p>';
    const inp = this.src.querySelector('.pl-input');
    if (inp) { inp.focus(); inp.select(); }
  }

  // ---------- eventos ----------
  bind() {
    this.src.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-pl]');
      if (b) this.lib.show(`pl:${b.dataset.pl}`);
    });
    const commit = (inp, keep) => {
      if (!this.editing) return;
      const id = inp.closest('[data-pl]').dataset.pl; this.editing = null;
      const name = inp.value.trim();
      if (!keep && name) window.ytdj.pl.rename(id, name).then((r) => { if (!r.ok) this.app.toast(r.error, true); this.refresh(); if (this.cur?.id === id && r.ok) this.cur.name = r.data.name; });
      else this.refresh();
    };
    this.src.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('pl-input')) return;
      if (e.key === 'Enter') { e.preventDefault(); commit(e.target, false); }
      if (e.key === 'Escape') { e.preventDefault(); commit(e.target, true); }
    });
    this.src.addEventListener('focusout', (e) => { if (e.target.classList.contains('pl-input') && this.editing) commit(e.target, e.target.dataset.keep === '1'); });
    // soltar pistas sobre una lista de las fuentes
    const over = (e) => e.dataTransfer.types.includes(MIME) && !!e.target.closest('button[data-pl]');
    this.src.addEventListener('dragover', (e) => {
      if (!over(e)) return;
      const b = e.target.closest('button[data-pl]');
      if (this.listOf(b.dataset.pl)?.kind === 'smart') return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; b.classList.add('drop');
    });
    this.src.addEventListener('dragleave', (e) => e.target.closest?.('button[data-pl]')?.classList.remove('drop'));
    this.src.addEventListener('drop', (e) => {
      const b = e.target.closest('button[data-pl]');
      if (!b || !e.dataTransfer.types.includes(MIME)) return;
      e.preventDefault(); b.classList.remove('drop');
      let rows = []; try { rows = JSON.parse(e.dataTransfer.getData(MIME)); } catch { /* nada */ }
      this.addTo(b.dataset.pl, rows);
    });
    $('#pl-new').addEventListener('click', () => this.newList());
    $('#pl-new-smart').addEventListener('click', () => this.newList([], 'smart'));
    // barra de la lista abierta
    $('#pl-rename').addEventListener('click', () => { if (this.cur) { this.editing = this.cur.id; this.renderSources(); } });
    $('#pl-dup').addEventListener('click', async () => {
      const r = await window.ytdj.pl.duplicate(this.cur.id);
      if (!r.ok) return this.app.toast(r.error, true);
      this.app.toast(`Duplicada como «${r.data.name}»`); this.lib.show(`pl:${r.data.id}`);
    });
    $('#pl-del').addEventListener('click', async () => {
      if (!this.cur || !window.confirm(`¿Borrar la playlist «${this.cur.name}»? Las pistas y sus archivos no se tocan.`)) return;
      const r = await window.ytdj.pl.delete(this.cur.id);
      if (!r.ok) return this.app.toast(r.error, true);
      this.cur = null; this.app.toast('Playlist borrada'); this.lib.show('local');
    });
    const sortNow = async () => {
      const k = $('#pl-order').value;
      if (!k || !this.cur) return;
      const r = await window.ytdj.pl.sort(this.cur.id, k, this.dir);
      if (!r.ok) return this.app.toast(r.error, true);
      this.apply(r.data);
    };
    $('#pl-order').addEventListener('change', sortNow);
    $('#pl-dir').addEventListener('click', () => {
      this.dir = -this.dir; $('#pl-dir').setAttribute('aria-pressed', String(this.dir < 0)); $('#pl-dir').textContent = this.dir < 0 ? '↓' : '↑';
      sortNow();
    });
    $('#pl-undo').addEventListener('click', () => this.undoLast());
    $('#pl-filters').addEventListener('click', () => { this.smart.hidden = !this.smart.hidden; $('#pl-filters').setAttribute('aria-expanded', String(!this.smart.hidden)); });
    this.smart.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = (id) => { const v = Number($(id).value); return v > 0 ? v : 0; };
      const filter = { bpm: [n('#ps-bmin'), n('#ps-bmax')], key: $('#ps-key').value || '', compat: $('#ps-compat').checked, genres: $('#ps-genres').value.split(',').map((x) => x.trim()).filter(Boolean), analyzed: $('#ps-an').checked, stems: $('#ps-st').checked };
      const r = await window.ytdj.pl.setFilter(this.cur.id, filter);
      if (!r.ok) return this.app.toast(r.error, true);
      this.apply(r.data); this.app.toast('Filtros guardados');
    });
    // selección y acciones
    $('#sel-add').addEventListener('click', (e) => this.menuFor(this.selectedRows(), e.currentTarget));
    $('#sel-remove').addEventListener('click', () => this.remove([...this.sel]));
    $('#sel-queue').addEventListener('click', () => {
      const rows = this.selectedRows(); rows.forEach((r) => this.app.automix.add(r));
      this.app.toast(`En la cola de AutoMix: ${rows.length} pistas`);
    });
    $('#sel-analyze').addEventListener('click', () => this.lib.analyzeRows(this.selectedRows(), this.lib.listName || 'Selección'));
    $('#sel-clear').addEventListener('click', () => this.clearSel());
    // menú «Añadir a playlist»
    this.menu.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const rows = this.menuRows; this.closeMenu();
      if (b.dataset.new) this.newList(rows); else this.addTo(b.dataset.id, rows);
    });
    this.menu.addEventListener('keydown', (e) => {
      const items = [...this.menu.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); this.closeMenu(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    document.addEventListener('pointerdown', (e) => { if (!this.menu.hidden && !e.target.closest('#pl-menu')) this.closeMenu(); });
    // teclado: Ctrl+A y Ctrl+Z dentro de la librería
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (!a?.closest?.('.table-wrap, #pl-toolbar, .sources')) return;
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); this.selectAll(); }
      else if (e.key.toLowerCase() === 'z' && this.undo) { e.preventDefault(); this.undoLast(); }
    });
    // reordenar arrastrando dentro de una lista manual
    const tb = this.lib.body;
    tb.addEventListener('dragover', (e) => {
      if (!this.canReorder() || !this.dragging) return;
      const tr = e.target.closest('tr[data-i]'); if (!tr) return;
      e.preventDefault();
      const r = tr.getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2;
      tb.querySelectorAll('.drop-before, .drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
      tr.classList.add(after ? 'drop-after' : 'drop-before');
    });
    tb.addEventListener('dragleave', (e) => { if (!tb.contains(e.relatedTarget)) tb.querySelectorAll('.drop-before, .drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); });
    tb.addEventListener('drop', (e) => {
      if (!this.canReorder() || !this.dragging) return;
      const tr = e.target.closest('tr[data-i]'); if (!tr) return;
      e.preventDefault();
      const r = tr.getBoundingClientRect(); const after = e.clientY > r.top + r.height / 2;
      tb.querySelectorAll('.drop-before, .drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
      this.moveTo(tr.dataset.id, after);
    });
    tb.addEventListener('dragend', () => { this.dragging = null; tb.querySelectorAll('.drop-before, .drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); });
    this.lib.body.closest('.table-wrap').setAttribute('tabindex', '-1');
  }

  listOf(id) { return this.lists.find((l) => l.id === id); }

  // ---------- abrir una lista ----------
  async onShow(tab) {
    if (!tab.startsWith('pl:')) this.cur = null;
    if (this.lastTab !== tab) { this.sel.clear(); this.anchor = -1; }
    this.lastTab = tab;
    $('#pl-toolbar').hidden = !tab.startsWith('pl:');
    this.bar.hidden = !tab.startsWith('pl:');
    this.smart.hidden = true;
    this.paintBars();
  }

  async openList(id) {
    const r = await window.ytdj.pl.get(id);
    if (!r.ok) { this.cur = null; this.lib.setMsg(`Error: ${r.error}`); return this.lib.render([]); }
    this.lib.sort = null; // se ve el orden guardado de la lista
    this.apply(r.data);
  }

  // Pinta la lista (`data` de `pl.get`) y ajusta las barras.
  apply(data) {
    this.cur = data;
    this.lib.listName = data.name;
    this.lib.exportSrc = `pl:${data.id}`;
    const l = this.listOf(data.id);
    const total = data.tracks.reduce((n, t) => n + (t.duration || 0), 0);
    this.lib.setMsg(l ? this.summary({ ...l, count: data.tracks.length, duration: total }) : `${data.name} · ${data.tracks.length} pistas`);
    this.lib.render(data.tracks);
    const smart = data.kind === 'smart';
    $('#pl-name').textContent = data.name;
    $('#pl-order').hidden = $('#pl-dir').hidden = smart;
    $('#pl-order').value = data.sort?.k || '';
    $('#pl-filters').hidden = !smart;
    if (smart) {
      const f = data.filter || {};
      $('#ps-bmin').value = f.bpm?.[0] || ''; $('#ps-bmax').value = f.bpm?.[1] || ''; $('#ps-key').value = f.key || '';
      $('#ps-compat').checked = !!f.compat; $('#ps-genres').value = (f.genres || []).join(', '); $('#ps-an').checked = !!f.analyzed; $('#ps-st').checked = !!f.stems;
      if (!Object.keys(f).length) { this.smart.hidden = false; $('#pl-filters').setAttribute('aria-expanded', 'true'); }
    }
    this.paintBars();
    this.renderSources();
  }

  emptyHint() { return this.cur?.kind === 'smart' ? 'Ninguna pista cumple los filtros: cámbialos con «Filtros».' : 'Esta lista está vacía: arrastra pistas aquí o usa «＋» en una fila.'; }

  // ---------- crear y poner ----------
  async newList(rows = [], kind = 'manual') {
    const tracks = rows.filter((r) => r.videoId && !r.playlist).map(mini);
    const r = await window.ytdj.pl.create(kind === 'smart' ? 'Lista inteligente' : 'Nueva playlist', { kind, tracks });
    if (!r.ok) return this.app.toast(r.error, true);
    this.editing = r.data.id;
    await this.refresh();
    if (kind === 'smart' || !rows.length) this.lib.show(`pl:${r.data.id}`);
    else this.app.toast(`Playlist creada con ${tracks.length} pistas: ponle nombre`);
  }

  async fromCrate(crateId) {
    const r = await window.ytdj.pl.fromCrate(crateId);
    if (!r.ok) return this.app.toast(r.error, true);
    this.app.toast(`Guardada como «${r.data.name}» (${r.data.tracks.length} pistas): ya puedes editarla`);
    await this.refresh();
  }

  async addTo(id, rows) {
    const tracks = (rows || []).filter((r) => r.videoId && !r.playlist).map(mini);
    if (!tracks.length) return;
    const r = await window.ytdj.pl.add(id, tracks);
    if (!r.ok) return this.app.toast(r.error, true);
    const name = this.listOf(id)?.name || 'la playlist';
    this.app.toast(r.data.added ? `Añadidas ${r.data.added} a «${name}»${r.data.skipped ? ` (${r.data.skipped} ya estaban)` : ''}` : `Ya estaban en «${name}»`);
    if (this.open && this.cur.id === id) this.openList(id);
  }

  menuFor(rows, anchor) {
    rows = (rows || []).filter((r) => r.videoId && !r.playlist);
    if (!rows.length) return;
    this.menuRows = rows; this.menuAnchor = anchor;
    const manual = this.lists.filter((l) => l.kind === 'manual');
    this.menu.innerHTML = `${manual.map((l) => `<button role="menuitem" type="button" data-id="${esc(l.id)}">${esc(l.name)} <em>${l.count}</em></button>`).join('')}${manual.length ? '<hr>' : ''}<button role="menuitem" type="button" data-new="1"><svg class="ic"><use href="#i-plus"/></svg>Nueva playlist…</button>`;
    this.menu.hidden = false;
    const a = anchor.getBoundingClientRect(); const m = this.menu.getBoundingClientRect();
    this.menu.style.left = `${Math.max(8, Math.min(innerWidth - m.width - 8, a.right - m.width))}px`;
    this.menu.style.top = `${a.bottom + m.height + 8 > innerHeight ? Math.max(8, a.top - m.height - 4) : a.bottom + 4}px`;
    anchor.setAttribute('aria-expanded', 'true');
    this.menu.querySelector('button').focus();
  }

  closeMenu(refocus) {
    this.menu.hidden = true;
    this.menuAnchor?.setAttribute('aria-expanded', 'false');
    if (refocus) this.menuAnchor?.focus();
  }

  // ---------- quitar y deshacer ----------
  async remove(ids) {
    if (!this.cur || this.cur.kind === 'smart' || !ids.length) return;
    const r = await window.ytdj.pl.remove(this.cur.id, ids);
    if (!r.ok) return this.app.toast(r.error, true);
    if (!r.data.removed.length) return;
    this.undo = { id: this.cur.id, removed: r.data.removed };
    this.sel.clear();
    this.app.toast(`Quitadas ${r.data.removed.length} de «${this.cur.name}» (Ctrl+Z para deshacer)`);
    await this.openList(this.cur.id);
  }

  async undoLast() {
    if (!this.undo) return;
    const { id, removed } = this.undo; this.undo = null;
    const r = await window.ytdj.pl.restore(id, removed);
    if (!r.ok) return this.app.toast(r.error, true);
    this.app.toast(`Devueltas ${r.data} pistas`);
    if (this.cur?.id === id) await this.openList(id); else this.paintBars();
  }

  // ---------- reordenar a mano ----------
  canReorder() { return this.open && this.cur.kind === 'manual' && !this.lib.sort && this.lib.rows.length === this.cur.tracks.length; }

  async moveTo(targetId, after) {
    const ids = this.dragging; this.dragging = null;
    if (!ids?.length || ids.includes(targetId)) return;
    const order = this.lib.rows.map((r) => r.videoId).filter((v) => !ids.includes(v));
    const at = order.indexOf(targetId) + (after ? 1 : 0);
    const keep = this.lib.rows.map((r) => r.videoId).filter((v) => ids.includes(v));
    order.splice(at, 0, ...keep);
    const r = await window.ytdj.pl.reorder(this.cur.id, order);
    if (!r.ok) return this.app.toast(r.error, true);
    this.apply(r.data);
  }

  dragRows(row) {
    const rows = this.sel.has(row.videoId) && this.sel.size > 1 ? this.selectedRows() : [row];
    this.dragging = rows.map((r) => r.videoId);
    return rows;
  }

  // ---------- selección múltiple ----------
  selectedRows() { return this.lib.rows.filter((r) => r.videoId && this.sel.has(r.videoId)); }

  select(e, tr, row) {
    if (!row?.videoId) return;
    const i = Number(tr.dataset.i);
    if (e.shiftKey && this.anchor >= 0) {
      const [a, b] = [Math.min(this.anchor, i), Math.max(this.anchor, i)];
      if (!(e.ctrlKey || e.metaKey)) this.sel.clear();
      this.lib.rows.slice(a, b + 1).forEach((r) => r.videoId && this.sel.add(r.videoId));
    } else if (e.ctrlKey || e.metaKey) {
      if (!this.sel.delete(row.videoId)) this.sel.add(row.videoId);
      this.anchor = i;
    } else {
      const only = this.sel.size === 1 && this.sel.has(row.videoId);
      this.sel.clear(); if (!only) this.sel.add(row.videoId);
      this.anchor = i;
    }
    this.lib.body.closest('.table-wrap').focus({ preventScroll: true });
    this.paintSel();
  }

  selectAll() {
    this.lib.rows.forEach((r) => r.videoId && !r.playlist && this.sel.add(r.videoId));
    this.paintSel();
  }

  clearSel() { this.sel.clear(); this.anchor = -1; this.paintSel(); }

  paintSel() {
    this.lib.body.querySelectorAll('tr[data-i]').forEach((tr) => tr.classList.toggle('sel', this.sel.has(tr.dataset.id)));
    this.paintBars();
  }

  // Tras pintar la tabla: lo seleccionado que ya no se ve deja de estar seleccionado.
  afterRender() {
    const vis = new Set(this.lib.rows.map((r) => r.videoId));
    for (const id of [...this.sel]) if (!vis.has(id)) this.sel.delete(id);
    this.paintBars();
  }

  paintBars() {
    const n = this.sel.size; const inList = this.open;
    $('#sel-count').textContent = `${n} seleccionadas`;
    this.selBar.hidden = n < 2;
    $('#sel-remove').hidden = !(inList && this.cur.kind === 'manual');
    $('#pl-undo').hidden = !(this.undo && inList && this.undo.id === this.cur.id);
    $('#pl-toolbar').hidden = !inList && n < 2;
  }
}
