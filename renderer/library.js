// Librería: búsqueda, Me gusta y playlists de YouTube Music + pistas ya analizadas.
import { genres, openGenreEditor, closeGenreEditor } from './genres.js';
import { camelotColor, keysCompatible, bpmCompatible } from './camelot.js';
import { resolveSource, originChip } from './source.js';
import { preview } from './preview.js';
import { fileUrl } from './mixpreview.js';
import { fmtSize } from './stems.js';

const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Library {
  constructor(app) {
    this.app = app;
    this.tab = 'search';
    this.rows = [];
    this.analyzed = new Map();
    this.jobs = new Map();
    this.body = document.getElementById('tracks');
    this.msg = document.getElementById('lib-msg');
    for (const bid of ['stems-clear', 'stems-clear-all']) {
      document.getElementById(bid)?.addEventListener('click', async () => {
        const st = this.app.stems;
        if (!Object.keys(st.done).length) return;
        if (window.confirm(`¿Borrar los stems de ${Object.keys(st.done).length} pistas? Liberas ${fmtSize(st.status.usedBytes)}.`)) await st.removeAll();
      });
    }
    this.search = document.getElementById('search');
    this.addFolder = document.getElementById('btn-add-folder');
    this.addFolder.addEventListener('click', () => this.chooseFolder());
    this.sort = null;
    this.onlyCompat = false;
    this.genreSel = new Set();
    this.bindGenres();
    this.bindFilters();
    app.preview = preview;
    preview.on((e) => this.onPreview(e));
    document.querySelectorAll('.tracks th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        this.sort = this.sort?.k === k ? { k, dir: -this.sort.dir } : { k, dir: 1 };
        this.render(this.base);
      }),
    );
    document.getElementById('only-compat').addEventListener('change', (e) => {
      this.onlyCompat = e.target.checked;
      this.render(this.base);
    });
    this.analyzeBtn = document.getElementById('btn-analyze-list');
    this.analyzeBtn.addEventListener('click', () => this.analyzeRows(this.base || this.rows, this.listName || 'Lista'));
    this.bl = { paused: false, pending: 0, lists: [], items: [] };
    this.bindQueue();
    this.exportBtn = document.getElementById('btn-export');
    this.exportMenu = document.getElementById('export-menu');
    this.exportSrc = null;
    this.bindExport();
    this.importBtn = document.getElementById('btn-import-pl');
    this.listBtn = document.getElementById('btn-automix-list');
    this.importBtn.addEventListener('click', () => this.importPlaylists());
    this.listBtn.addEventListener('click', () => {
      this.app.automix.start({ tracks: this.rows.filter((r) => r.videoId) });
      this.show('automix');
    });
    window.ytdj.lib.onImportProgress((p) => {
      this.setMsg(p.finished ? 'Importación terminada' : `Importando ${p.done + 1}/${p.total}: ${p.title || ''}${p.error ? ' (error)' : ''}`);
    });

    document.querySelectorAll('.sources [data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.show(b.dataset.tab)),
    );
    this.scope = 'all';
    try { this.scope = ['all', 'local', 'online'].includes(localStorage.getItem('alyssdj.search.scope')) ? localStorage.getItem('alyssdj.search.scope') : 'all'; } catch { /* sin almacenamiento */ }
    this.scopeBox = document.getElementById('search-scope');
    this.scopeBox.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-scope]');
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      this.setScope(b.dataset.scope);
    });
    this.scopeBox.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const bs = [...this.scopeBox.querySelectorAll('button[data-scope]')].filter((b) => b.getAttribute('aria-disabled') !== 'true');
      const i = bs.findIndex((b) => b.dataset.scope === this.scope);
      const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      if (n) { this.setScope(n.dataset.scope); n.focus(); }
    });
    window.addEventListener('online', () => this.onScopeChange());
    window.addEventListener('offline', () => this.onScopeChange());
    this.onScopeChange();
    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.show('search', this.search.value.trim());
    });
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.body.addEventListener('dblclick', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (tr && !e.target.closest('button')) this.app.cueDeck().load(this.rows[tr.dataset.i]);
    });
    this.body.addEventListener('dragstart', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (tr) e.dataTransfer.setData('application/x-ytdj-track', JSON.stringify(this.rows[tr.dataset.i]));
    });
    this.refreshAnalyzed();
  }

  // ---------- ámbito del buscador: Todo · Mi equipo · YouTube Music ----------
  // Sin red o en modo local solo se busca en el equipo, sea cual sea la elección guardada.
  offline() { return !!this.app.localMode || navigator.onLine === false; }

  effectiveScope() { return this.offline() ? 'local' : this.scope; }

  setScope(scope) {
    this.scope = scope;
    try { localStorage.setItem('alyssdj.search.scope', scope); } catch { /* sin almacenamiento */ }
    this.onScopeChange();
    if (this.tab === 'search' && this.search.value.trim()) this.show('search', this.search.value.trim());
  }

  onScopeChange() {
    if (!this.scopeBox) return;
    const eff = this.effectiveScope();
    const off = this.offline();
    this.scopeBox.querySelectorAll('button[data-scope]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.scope === eff));
      b.tabIndex = b.dataset.scope === eff ? 0 : -1;
      const blocked = off && b.dataset.scope !== 'local';
      if (blocked) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      b.title = blocked ? (this.app.localMode ? 'Modo local: la app no usa la red' : 'Sin conexión') : '';
    });
    const ph = { all: 'Buscar en tu equipo y en YouTube Music…', local: 'Buscar en tu equipo…', online: 'Buscar en YouTube Music…' }[eff];
    this.search.placeholder = ph;
    this.search.setAttribute('aria-label', ph.replace('…', ''));
  }

  // Filas locales con sus etiquetas de fuente (Mi equipo · Analizada · Importada…).
  srcTags(r) {
    return (r.sources || []).map((x) => `<span class="src-tag">${esc(x)}</span>`).join('');
  }

  isNetError(msg) {
    return navigator.onLine === false || /net::|ENOTFOUND|ECONN|ETIMEDOUT|fetch failed|network|offline|timed out|Modo local/i.test(String(msg || ''));
  }

  async runSearch(query) {
    const scope = this.effectiveScope();
    const offNote = this.app.localMode ? 'Modo local: solo tu equipo' : this.offline() ? 'Sin conexión: mostrando tu equipo' : '';
    let local = [];
    let total = 0;
    if (scope !== 'online') {
      this.setMsg('Buscando…');
      const r = await window.ytdj.lib.searchLocal({ q: query, ...this.filterOpts() });
      if (r?.ok) { local = r.data.rows; total = r.data.total; }
      if (scope === 'local') {
        this.setMsg(local.length ? `${total} en tu equipo${total > local.length ? ` (se muestran ${local.length})` : ''}${offNote ? ` · ${offNote}` : ''}` : offNote || 'Nada coincide en tu equipo');
        return this.render(local);
      }
      if (local.length) this.render(local); // lo local aparece al instante; lo online se añade cuando llega
      this.setMsg('Buscando en YouTube Music…');
    } else this.setMsg('Cargando…');
    const on = await this.onlineSearch(query);
    if (!on.ok) {
      if (scope === 'all' && this.isNetError(on.error)) {
        this.setMsg(`Sin conexión: mostrando tu equipo${local.length ? '' : ' (nada coincide)'}`);
        return local.length ? undefined : this.render([]);
      }
      this.setMsg(on.error.includes('aún no cargó') ? 'YouTube Music todavía está cargando, reintenta en unos segundos.' : `Error: ${on.error}`);
      return undefined;
    }
    const seen = new Set(local.map((r) => r.videoId));
    const merged = [...local, ...on.data.filter((r) => !seen.has(r.videoId))];
    this.setMsg(merged.length ? `${merged.length} resultados${local.length ? ` · ${local.length} en tu equipo` : ''}` : 'Sin resultados');
    return this.render(merged);
  }

  // Búsqueda en YouTube Music (punto único: las pruebas lo sustituyen porque `window.ytdj` es de solo lectura).
  onlineSearch(query) { return window.ytdj.lib.search(query); }

  // Filtros de BPM y tonalidad (los de género son los de la barra). Una pista sin análisis no pasa un filtro de BPM o tono.
  bindFilters() {
    this.fBpm = [0, 0];
    this.fKey = '';
    this.fCompat = false;
    const box = document.getElementById('lib-filters');
    const sel = document.getElementById('f-key');
    for (let n = 1; n <= 12; n++) for (const l of ['A', 'B']) sel.insertAdjacentHTML('beforeend', `<option value="${n}${l}">${n}${l}</option>`);
    const apply = () => {
      const num = (id) => Math.max(0, Math.round(Number(document.getElementById(id).value) || 0));
      this.fBpm = [num('f-bpm-min'), num('f-bpm-max')];
      this.fKey = sel.value;
      this.fCompat = document.getElementById('f-compat').checked;
      box.classList.toggle('active', this.filtersOn());
      sel.toggleAttribute('data-empty', !sel.value);
      document.getElementById('f-clear').hidden = !this.filtersOn();
      if (this.tab === 'search' && this.search.value.trim()) this.show('search', this.search.value.trim());
      else this.render();
    };
    box.addEventListener('input', apply);
    box.addEventListener('change', apply);
    document.getElementById('f-clear').addEventListener('click', () => {
      for (const id of ['f-bpm-min', 'f-bpm-max']) document.getElementById(id).value = '';
      sel.value = '';
      document.getElementById('f-compat').checked = false;
      this.genreSel.clear();
      this.genreLabel();
      apply();
    });
    sel.toggleAttribute('data-empty', true);
  }

  filtersOn() { return !!(this.fBpm?.[0] || this.fBpm?.[1] || this.fKey || this.genreSel.size); }

  // ¿Pasa la fila los filtros de BPM y tonalidad? (los de género los aplica `render`).
  passesAnalysisFilters(r) {
    if (!(this.fBpm?.[0] || this.fBpm?.[1] || this.fKey)) return true;
    const a = this.analyzed.get(r.videoId);
    if (this.fBpm[0] || this.fBpm[1]) {
      if (!a?.bpm) return false;
      if (this.fBpm[0] && a.bpm < this.fBpm[0]) return false;
      if (this.fBpm[1] && a.bpm > this.fBpm[1]) return false;
    }
    if (this.fKey) return this.fCompat ? keysCompatible(a?.camelot, this.fKey) : a?.camelot === this.fKey;
    return true;
  }

  filterOpts() {
    return { bpm: this.fBpm?.[0] || this.fBpm?.[1] ? this.fBpm : undefined, key: this.fKey || undefined, compatKey: this.fCompat, genres: this.genreSel.size ? [...this.genreSel] : undefined };
  }

  async refreshAnalyzed() {
    const list = await window.ytdj.analysis.list();
    this.analyzed = new Map(list.map((a) => [a.id, a]));
    document.getElementById('cnt-analyzed').textContent = list.length || '';
    if (this.tab === 'analyzed') this.show('analyzed');
    else this.render();
  }

  setMsg(s) {
    this.msg.textContent = s || '';
  }

  async show(tab, query) {
    this.tab = tab;
    this.exportSrc = tab === 'analyzed' ? 'all' : null;
    this.closeExport();
    this.exportBtn.hidden = true;
    document.dispatchEvent(new CustomEvent('alyss:tab', { detail: tab }));
    document.querySelectorAll('.sources [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const isAm = tab === 'automix';
    const isQ = tab === 'queue';
    document.getElementById('am-view').hidden = !isAm;
    document.getElementById('queue-view').hidden = !isQ;
    document.querySelector('.table-wrap').hidden = isAm || isQ;
    document.querySelector('.lib-toolbar').hidden = isAm || isQ;
    this.listName = { search: query ? `Búsqueda: ${query}` : 'Resultados', liked: 'Me gusta', local: 'Música local', history: 'Historial' }[tab] || 'Lista';
    if (isQ) {
      this.addFolder.hidden = this.importBtn.hidden = this.listBtn.hidden = this.analyzeBtn.hidden = true;
      return this.renderQueue();
    }
    if (isAm) {
      this.addFolder.hidden = this.importBtn.hidden = this.listBtn.hidden = this.analyzeBtn.hidden = true;
      this.setMsg('');
      return this.app.renderAutoMix();
    }
    this.addFolder.hidden = tab !== 'local';
    this.importBtn.hidden = !['playlists', 'imported'].includes(tab);
    const call = async (p, empty) => {
      this.setMsg('Cargando…');
      const r = await p;
      if (!r.ok) {
        this.setMsg(r.error.includes('aún no cargó') ? 'YouTube Music todavía está cargando, reintenta en unos segundos.' : `Error: ${r.error}`);
        return null;
      }
      this.setMsg(r.data.length ? `${r.data.length} resultados` : empty);
      return r.data;
    };
    if (tab === 'search') {
      if (!query) return this.render(this.rows.filter((r) => r.videoId));
      await this.runSearch(query);
    } else if (tab === 'liked') {
      const data = await call(window.ytdj.lib.liked(), 'No hay canciones con Me gusta (¿iniciaste sesión?)');
      if (data) this.render(data);
    } else if (tab === 'playlists') {
      const data = await call(window.ytdj.lib.playlists(), 'No hay playlists (¿iniciaste sesión?)');
      if (data) this.render(data.map((p) => ({ ...p, playlist: true })));
    } else if (tab === 'history') {
      const h = this.app.history();
      this.setMsg(h.length ? `${h.length} pistas reproducidas` : 'Aún no hay historial: aparece aquí lo que suena más de 20 s');
      this.render(h);
    } else if (tab === 'imported') {
      const lists = await window.ytdj.crates();
      this.setMsg(lists.length ? `${lists.length} playlists importadas` : 'Aún no importaste nada: pulsa “Importar mis playlists” (necesitas la sesión iniciada).');
      this.render(lists.map((l) => ({ browseId: l.id, title: l.title, subtitle: `${l.count} pistas · importada ${new Date(l.importedAt).toLocaleDateString()}`, thumb: l.thumb, playlist: true, crate: true })));
    } else if (tab === 'local') {
      this.setMsg('Leyendo carpetas…');
      const r = await window.ytdj.local.list();
      if (!r.ok) return this.setMsg(`Error: ${r.error}`);
      this.localDirs = r.data.dirs;
      const n = r.data.rows.length;
      this.setMsg(!r.data.dirs.length && !n ? 'Añade una carpeta de música o arrastra archivos a un deck' : `${n} pistas${r.data.pending ? ` · leyendo etiquetas (${r.data.pending})` : ''}`);
      this.render(r.data.rows);
    } else if (tab === 'analyzed') {
      const rows = [...this.analyzed.values()]
        .sort((a, b) => (b.analyzedAt || '').localeCompare(a.analyzedAt || ''))
        .map((a) => ({ videoId: a.id, local: !!a.local, title: a.title || a.id, artist: a.artist || '', thumb: a.thumb || `https://i.ytimg.com/vi/${a.id}/hqdefault.jpg`, duration: a.trackDuration || a.duration }));
      this.setMsg(`${rows.length} pistas analizadas`);
      this.render(rows);
    }
  }

  async chooseFolder() {
    const r = await window.ytdj.local.addFolder();
    if (!r.ok) return this.app.toast(r.error, true);
    this.localDirs = r.data.dirs;
    this.app.renderMusicDirs?.();
    if (this.tab === 'local') this.show('local');
  }

  onLocalEvent(ev) {
    // Terminó la lectura de etiquetas: refrescar si se está viendo la pestaña Local.
    if (ev.done && this.tab === 'local') this.show('local');
  }

  async importPlaylists() {
    this.importBtn.disabled = true;
    const r = await window.ytdj.lib.importPlaylists();
    this.importBtn.disabled = false;
    if (!r.ok) return this.app.toast(`No se pudo importar: ${r.error}`, true);
    const total = r.data.reduce((n, l) => n + l.count, 0);
    this.app.toast(`Importadas ${r.data.length} playlists (${total} pistas)`);
    this.show('imported');
  }

  async openPlaylist(p) {
    this.setMsg(`Cargando ${p.title}…`);
    const r = p.crate ? { ok: true, data: await window.ytdj.crate(p.browseId) } : await window.ytdj.lib.playlist(p.browseId);
    if (!r.ok) return this.setMsg(`Error: ${r.error}`);
    this.setMsg(`${p.title} · ${r.data.length} canciones`);
    this.listName = p.title;
    this.exportSrc = p.crate ? `crate:${p.browseId}` : null;
    this.render(r.data);
  }

  onClick(e) {
    const btn = e.target.closest('button');
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const row = this.rows[tr.dataset.i];
    if (row.playlist) return btn?.dataset.act === 'an-list' ? this.analyzePlaylist(row) : this.openPlaylist(row);
    const bar = e.target.closest('.pv-bar');
    if (bar && !btn) {
      const r = bar.getBoundingClientRect();
      return preview.seek((e.clientX - r.left) / r.width);
    }
    if (!btn) return;
    if (btn.dataset.act === 'prev') return this.togglePreview(row);
    if (btn.dataset.act === 'stems') return this.stemsAction(row);
    if (btn.dataset.act === 'A' || btn.dataset.act === 'B') this.app.decks[btn.dataset.act].load(row);
    if (btn.dataset.act === 'radio') {
      this.app.automix.start({ seed: row });
      this.show('automix');
    }
    if (btn.dataset.act === 'queue') {
      this.app.automix.add(row);
      this.app.toast(`En la cola de AutoMix: ${row.title}`);
    }
    if (btn.dataset.act === 'genres') {
      return openGenreEditor(tr, row.videoId, () => {
        this.render(this.base); // los chips de la fila reflejan lo guardado
        this.body.querySelector(`tr[data-id="${CSS.escape(row.videoId)}"] .gn`)?.focus();
      });
    }
    if (btn.dataset.act === 'analyze') {
      if (this.jobs.has(row.videoId)) window.ytdj.analysis.cancel(row.videoId);
      else window.ytdj.analysis.request(row.videoId, { meta: { title: row.title, artist: row.artist, thumb: row.thumb, trackDuration: row.duration }, file: row.local ? row.path : undefined });
    }
  }

  onAnalysisEvent(ev) {
    if (ev.stage === 'done') {
      this.jobs.delete(ev.id);
      const { waveform, ...rest } = ev.analysis;
      this.analyzed.set(ev.id, rest);
    } else if (ev.stage === 'error' || ev.stage === 'cancelled') {
      this.jobs.delete(ev.id);
      if (ev.error) this.app.toast(`Análisis falló: ${ev.error}`, true);
    } else this.jobs.set(ev.id, ev);
    this.updateRow(ev.id);
  }

  analyzeLabel(id) {
    const j = this.jobs.get(id);
    if (j) return [j.stage === 'download' ? `${Math.round((j.progress || 0) * 100)}%` : j.stage === 'analyze' ? 'Analizando' : 'En cola', 'busy'];
    const a = this.analyzed.get(id);
    if (a?.saved) return ['Guardada', 'done'];
    return a ? ['✓', 'done'] : ['Analizar', ''];
  }

  rowHtml(r, i) {
    if (r.playlist) {
      return `<tr class="pl" data-i="${i}"><td>${r.thumb ? `<img src="${esc(r.thumb)}" loading="lazy">` : ''}</td><td>${esc(r.title)}</td><td>${esc(r.subtitle)}</td><td class="num"></td><td class="num"></td><td></td><td class="actions"><button data-act="an-list" title="Analiza en segundo plano todas las pistas de esta lista">Analizar</button> Abrir ›</td></tr>`;
    }
    const a = this.analyzed.get(r.videoId);
    const [lbl, cls] = this.analyzeLabel(r.videoId);
    const compat = this.isCompat(r);
    const kc = camelotColor(a?.camelot);
    const info = resolveSource({ track: r, analysis: a, preferSaved: this.app.settings.preferSaved !== false });
    const chip = `<span class="src-chip${info.origin === 'STREAM' ? '' : ' file'}" title="${info.origin === 'STREAM' ? 'Suena por streaming desde YouTube Music' : 'Suena desde un archivo en este equipo'}">${originChip(info)}</span>`;
    const art = r.thumb ? `<img src="${esc(r.thumb)}" loading="lazy">` : '<div class="noart">♪</div>';
    const loaded = ['A', 'B'].filter((d) => this.app.decks[d]?.track?.videoId === r.videoId).map((d) => `loaded-${d}`).join(' ');
    return `<tr data-i="${i}" data-id="${esc(r.videoId)}" draggable="true" class="${loaded}${compat ? ' compat' : ''}">
      <td>${art}</td>
      <td title="${esc(r.title)}">${esc(r.title)}${preview.state?.id === r.videoId ? `<div class="pv-bar" style="--p:${preview.state.dur ? Math.min(1, preview.state.t / preview.state.dur) : 0}"><i></i></div>` : ''}</td>
      <td title="${esc(r.artist)}">${esc(r.artist)}${this.srcTags(r)}${chip}${genres.chips(r.videoId)}${this.stemsChip(r)}</td>
      <td class="num">${fmtDur(r.duration)}</td>
      <td class="num">${a?.bpm ? a.bpm.toFixed(1) : ''}</td>
      <td class="key">${a?.camelot ? `<span class="kchip" style="--k:${kc}">${a.camelot}</span>` : ''}</td>
      <td class="actions">${this.previewBtn(r, a)}${this.stemsBtn(r, a)}<button data-act="A" class="la">A</button><button data-act="B" class="lb">B</button><button data-act="radio" class="rd" title="Iniciar AutoMix (radio) desde esta pista">Radio</button><button data-act="queue" class="qq" title="Añadir a la cola de AutoMix" aria-label="Añadir a la cola">+</button><button data-act="genres" class="gn" title="Editar los géneros de esta pista" aria-label="Editar géneros">♯</button><button data-act="analyze" class="an ${cls}">${lbl}</button></td>
    </tr>`;
  }

  previewBtn(r, a) {
    const on = preview.state?.id === r.videoId;
    const ok = !!fileUrl(r, a);
    return `<button data-act="prev" class="pv${on ? ' on' : ''}"${ok ? '' : ' disabled'} aria-pressed="${on}" aria-label="Preescuchar ${esc(r.title)}" title="${ok ? (on ? 'Parar la preescucha' : 'Preescuchar por los auriculares') : 'Solo por streaming: guarda la pista para preescucharla'}">${on ? '■' : '▶'}</button>`;
  }

  togglePreview(row) {
    const decks = this.app.decks;
    return preview.toggle(row, this.analyzed.get(row.videoId), {
      cueLabel: this.app.settings.output?.cueLabel || '',
      busy: () => [decks.A, decks.B].some((d) => d?.st?.playing),
    });
  }

  // Repinta solo la fila que empieza o termina; el avance mueve la barra sin tocar la tabla.
  onPreview(e) {
    if (e.type === 'tick') {
      const tr = this.body.querySelector(`tr[data-id="${CSS.escape(e.id)}"]`);
      tr?.querySelector('.pv-bar')?.style.setProperty('--p', e.dur ? Math.min(1, e.t / e.dur) : 0);
      return;
    }
    this.updateRow(e.id);
    if (e.type === 'blocked') this.app.toast('Preescucha parada: suena un deck y no hay salida de auriculares.');
  }

  isCompat(r) {
    const a = this.analyzed.get(r.videoId);
    const ref = this.reference();
    return !!(a && ref && r.videoId !== ref.id && keysCompatible(a.camelot, ref.camelot) && bpmCompatible(a.bpm, ref.bpm));
  }

  sorted(rows) {
    if (!this.sort || rows.some((r) => r.playlist)) return rows;
    const { k, dir } = this.sort;
    const val = (r) => {
      const a = this.analyzed.get(r.videoId);
      if (k === 'title') return (r.title || '').toLowerCase();
      if (k === 'artist') return (r.artist || '').toLowerCase();
      if (k === 'dur') return r.duration || 0;
      if (k === 'bpm') return a?.bpm ?? null;
      if (k === 'key') return a?.camelot ? parseInt(a.camelot, 10) * 2 + (a.camelot.endsWith('B') ? 1 : 0) : null;
    };
    return [...rows].sort((x, y) => {
      const vx = val(x);
      const vy = val(y);
      if (vx == null && vy == null) return 0;
      if (vx == null) return 1; // sin dato siempre al final
      if (vy == null) return -1;
      return (typeof vx === 'string' ? vx.localeCompare(vy, 'es') : vx - vy) * dir;
    });
  }

  // Deck de referencia para resaltar compatibles: el que suena al aire; si no, el primero con análisis.
  reference() {
    const decks = [this.app.decks.A, this.app.decks.B].filter((d) => d.track && d.analysis?.camelot);
    const live = decks.find((d) => d.st.playing && d.isAudible()) || decks[0];
    return live ? { id: live.track.videoId, camelot: live.analysis.camelot, bpm: live.analysis.bpm } : null;
  }

  render(rows = this.base || this.rows) {
    this.base = rows;
    if (this.onlyCompat) rows = rows.filter((r) => r.playlist || this.isCompat(r));
    if (this.genreSel.size) rows = rows.filter((r) => r.playlist || genres.matches(r.videoId, this.genreSel));
    if (this.fBpm) rows = rows.filter((r) => r.playlist || this.passesAnalysisFilters(r));
    closeGenreEditor();
    rows = this.sorted(rows);
    this.rows = rows;
    document.querySelectorAll('.tracks th[data-sort]').forEach((th) => {
      th.classList.toggle('sorted', this.sort?.k === th.dataset.sort);
      th.classList.toggle('asc', this.sort?.k === th.dataset.sort && this.sort.dir === 1);
    });
    this.body.innerHTML = rows.map((r, i) => this.rowHtml(r, i)).join('');
    this.renderEmpty(rows);
    if (this.tab === 'imported') this.fillCrateCounts();
    this.listBtn.hidden = !rows.some((r) => r.videoId && !r.playlist);
    this.exportBtn.hidden = !this.exportSrc || !rows.some((r) => r.videoId && !r.playlist);
    this.analyzeBtn.hidden = !rows.some((r) => r.videoId && !r.playlist) || ['analyzed', 'automix', 'queue'].includes(this.tab);
  }

  // ---------- géneros: filtro de la barra ----------
  bindGenres() {
    this.genreBtn = document.getElementById('btn-genres');
    this.genreMenu = document.getElementById('genre-menu');
    const close = (refocus) => {
      this.genreMenu.hidden = true;
      this.genreBtn.setAttribute('aria-expanded', 'false');
      if (refocus) this.genreBtn.focus();
    };
    this.genreBtn.addEventListener('click', () => {
      const open = this.genreMenu.hidden;
      if (open) this.paintGenreMenu();
      this.genreMenu.hidden = !open;
      this.genreBtn.setAttribute('aria-expanded', String(open));
      if (open) this.genreMenu.querySelector('input,button')?.focus();
    });
    this.genreMenu.addEventListener('change', (e) => {
      const name = e.target.dataset.g;
      if (!name) return;
      e.target.checked ? this.genreSel.add(name) : this.genreSel.delete(name);
      this.paintGenreMenu(); // aparece o desaparece «Quitar el filtro»; el foco se queda en la casilla
      this.genreMenu.querySelector(`input[data-g="${CSS.escape(name)}"]`)?.focus();
      this.render(this.base);
    });
    this.genreMenu.addEventListener('click', (e) => {
      if (!e.target.closest('.gclear')) return;
      this.genreSel.clear();
      this.render(this.base);
      this.paintGenreMenu();
    });
    this.genreMenu.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), close(true)));
    document.addEventListener('pointerdown', (e) => !this.genreMenu.hidden && !e.target.closest('.genre-wrap') && close(false));
    genres.on(() => {
      this.paintGenreMenu();
      if (this.base && !document.querySelector('.gedit-row')) this.render(this.base); // con el editor abierto, la fila se actualiza al cerrarlo
    });
    genres.bind();
    genres.load();
  }

  genreLabel() {
    document.getElementById('btn-genres-label').textContent = this.genreSel.size ? `Géneros (${this.genreSel.size})` : 'Géneros';
  }

  paintGenreMenu() {
    const v = genres.vocab;
    this.genreBtn.hidden = !v.length;
    this.genreLabel();
    this.genreMenu.innerHTML = (this.genreSel.size ? '<button type="button" class="btn sm ghost gclear">Quitar el filtro</button>' : '') + v.map((g) => `<label><input type="checkbox" data-g="${esc(g.name)}"${this.genreSel.has(g.name) ? ' checked' : ''} />${esc(g.name)}<span class="n">${g.n}</span></label>`).join('');
  }

  // ---------- exportar a otros programas ----------
  bindExport() {
    const items = () => [...this.exportMenu.querySelectorAll('[role=menuitem]')];
    this.exportBtn.addEventListener('click', () => {
      if (this.exportMenu.hidden) {
        this.exportMenu.hidden = false;
        this.exportBtn.setAttribute('aria-expanded', 'true');
        items()[0].focus();
      } else this.closeExport(true);
    });
    this.exportMenu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fmt]');
      if (b) this.runExport(b.dataset.fmt);
    });
    this.exportMenu.addEventListener('keydown', (e) => {
      const list = items(); const i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); this.closeExport(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.exportMenu.hidden && !e.target.closest('.export-wrap')) this.closeExport();
    });
  }

  closeExport(refocus) {
    if (!this.exportMenu) return;
    this.exportMenu.hidden = true;
    this.exportBtn.setAttribute('aria-expanded', 'false');
    if (refocus) this.exportBtn.focus();
  }

  async runExport(format) {
    this.closeExport(true);
    if (!this.exportSrc) return;
    this.setMsg('Exportando…');
    const r = await window.ytdj.export.run(this.exportSrc, format);
    if (!r.ok) { this.setMsg(`No se pudo exportar: ${r.error}`); return this.app.toast(`No se pudo exportar: ${r.error}`, true); }
    if (r.data.canceled) return this.setMsg('');
    const { file, written, skipped } = r.data;
    const msg = `Exportadas ${written} pistas a ${file.split(/[\\/]/).pop()}${skipped ? ` · ${skipped} sin audio en el disco omitidas` : ''}`;
    this.setMsg(msg);
    this.app.toast(msg);
  }

  // ---------- cola de análisis ----------
  async analyzeRows(rows, name) {
    const tracks = (rows || []).filter((r) => r.videoId && !r.playlist).map((r) => ({ videoId: r.videoId, title: r.title, artist: r.artist, thumb: r.thumb, duration: r.duration, local: !!r.local, path: r.local ? r.path : undefined }));
    if (!tracks.length) return this.app.toast('Esta lista no tiene pistas.', true);
    const r = await window.ytdj.backlog.add({ name, tracks });
    this.app.toast(r.added ? `En la cola de análisis: ${r.added} pistas de «${name}»${r.skipped ? ` (${r.skipped} ya analizadas o en cola)` : ''}` : 'No hay nada nuevo que analizar: todo ya está analizado o en cola.');
  }

  async analyzePlaylist(p) {
    this.setMsg(`Leyendo ${p.title}…`);
    const r = p.crate ? { ok: true, data: await window.ytdj.crate(p.browseId) } : await window.ytdj.lib.playlist(p.browseId);
    if (!r.ok) return this.setMsg(`Error: ${r.error}`);
    this.setMsg('');
    this.analyzeRows(r.data, p.title);
  }

  async fillCrateCounts() {
    for (const [i, row] of this.rows.entries()) {
      if (!row.crate) continue;
      const tracks = await window.ytdj.crate(row.browseId);
      if (this.tab !== 'imported' || this.rows[i] !== row) return;
      const n = tracks.filter((t) => this.analyzed.has(t.videoId)).length;
      const cell = this.body.querySelector(`tr[data-i="${i}"] td:nth-child(3)`);
      if (cell) cell.textContent = `${row.subtitle} · ${n}/${tracks.length} analizadas`;
    }
  }

  bindQueue() {
    const api = window.ytdj.backlog;
    const apply = (st) => {
      this.bl = st;
      const c = document.getElementById('cnt-queue');
      c.textContent = st.pending || '';
      if (this.tab === 'queue') this.renderQueue();
    };
    api.state().then(apply);
    api.onEvent(apply);
    document.getElementById('qv-pause').addEventListener('click', async () => apply(this.bl.paused ? await api.resume() : await api.pause()));
    document.getElementById('qv-clear').addEventListener('click', async () => apply(await api.clearDone()));
    document.getElementById('qv-lists').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-qact]');
      if (!b) return;
      apply(await api[b.dataset.qact](b.dataset.list));
    });
  }

  renderQueue() {
    const st = this.bl;
    const itemLabel = (i) => {
      if (i.state === 'running') return i.stage === 'download' ? `Descargando ${Math.round((i.progress || 0) * 100)}%` : 'Analizando';
      return { queued: 'En cola', done: 'Hecha', error: i.error || 'Error' }[i.state];
    };
    document.getElementById('qv-status').textContent = st.pending
      ? `${st.pending} pendientes${st.paused ? ' · en pausa' : st.botBlocked ? ' · esperando a YouTube' : ' · analizando de a una'}`
      : 'Nada pendiente.';
    document.getElementById('qv-pause').textContent = st.paused ? 'Reanudar' : 'Pausar';
    document.getElementById('qv-pause').disabled = !st.lists.length;
    document.getElementById('qv-bot').hidden = !st.botBlocked;
    document.getElementById('qv-empty').hidden = !!st.lists.length;
    document.getElementById('qv-lists').innerHTML = st.lists.map((l) => {
      const items = st.items.filter((i) => i.listId === l.id);
      const pct = l.total ? Math.round((l.done / l.total) * 100) : 0;
      return `<section class="qv-card">
        <header><b title="${esc(l.name)}">${esc(l.name)}</b><span class="qv-count">${l.done}/${l.total}${l.error ? ` · ${l.error} con error` : ''}</span><span class="spacer"></span>
          ${l.error ? `<button class="btn sm" data-qact="retry" data-list="${esc(l.id)}">Reintentar errores</button>` : ''}
          <button class="btn ghost sm" data-qact="cancel" data-list="${esc(l.id)}" title="Quita la lista de la cola; lo ya analizado se conserva">Cancelar</button></header>
        <div class="qv-bar"><i style="width:${pct}%"></i></div>
        <ul class="qv-items">${items.map((i) => `<li class="qv-${i.state}"><span class="qv-t" title="${esc(i.title)}">${esc(i.title)}<small>${esc(i.artist)}</small></span><span class="qv-s" title="${esc(i.state === 'error' ? i.error : '')}">${esc(itemLabel(i))}</span></li>`).join('')}</ul>
      </section>`;
    }).join('');
  }

  // Estado vacío: qué pasa y qué hacer a continuación, según la fuente.
  renderEmpty(rows) {
    const el = document.getElementById('lib-empty');
    const none = !rows.length && !this.msg.textContent.startsWith('Cargando');
    el.hidden = !none;
    if (!none) return;
    const hint = {
      search: 'Escribe arriba y pulsa Enter para buscar en YouTube Music.',
      liked: 'No hay canciones con Me gusta. Inicia sesión en YouTube Music para verlas.',
      playlists: 'No hay playlists. Inicia sesión en YouTube Music para verlas.',
      imported: 'Aún no importaste nada. Pulsa «Importar mis playlists» (necesitas la sesión iniciada).',
      local: 'Añade una carpeta de música o arrastra archivos a un deck.',
      analyzed: 'Aún no hay pistas analizadas. Pulsa «Analizar» en cualquier pista.',
      history: 'Aquí aparece lo que suena más de 20 s.',
    }[this.tab] || 'Sin pistas.';
    document.getElementById('lib-empty-text').textContent = this.onlyCompat && this.base?.length ? 'Ninguna pista es compatible con el deck en juego. Desactiva «Solo compatibles».' : hint;
  }

  // ---------- stems ----------
  stemsBtn(r, a) {
    const v = this.app.stems.view(r.videoId, { hasFile: !!fileUrl(r, a) });
    const name = esc(r.title);
    const cfg = {
      off: ['Stems', '', ' disabled', v.why || 'Stems no está disponible'],
      none: ['Stems', '', '', 'Separa la pista en voz, batería, bajo y resto (en segundo plano)'],
      error: ['Stems', '', '', `${v.text || ''} · clic para reintentar`],
      work: [`${Math.round((this.app.stems.jobs[r.videoId]?.progress || 0) * 100)} %`, ' on', '', `${v.text || ''} · clic para cancelar`],
      ready: ['✓ Stems', ' on', '', `Stems listos (${fmtSize(this.app.stems.done[r.videoId]?.bytes)}) · clic para borrarlos`],
      active: ['✓ Stems', ' on', '', 'Stems listos · clic para borrarlos'],
    }[v.mode];
    return `<button data-act="stems" class="stm${cfg[1]}"${cfg[2]} aria-label="Stems de ${name}: ${esc(cfg[3])}" title="${esc(cfg[3])}">${cfg[0]}</button>`;
  }

  stemsChip(r) {
    const d = this.app.stems.done[r.videoId];
    return d ? `<span class="stm-chip" title="Stems · ${fmtSize(d.bytes)}">STEMS</span>` : '';
  }

  async stemsAction(row) {
    const st = this.app.stems;
    const id = row.videoId;
    const v = st.view(id, { hasFile: !!fileUrl(row, this.analyzed.get(id)) });
    if (v.mode === 'work') return st.cancel(id);
    if (v.mode === 'ready' || v.mode === 'active') {
      if (window.confirm(`¿Borrar los stems de «${row.title}»? Libera ${fmtSize(st.done[id]?.bytes)}.`)) await st.remove(id);
      return;
    }
    if (v.mode === 'none' || v.mode === 'error') {
      const r = await st.request(id);
      if (r && r.ok === false) this.app.toast(r.error, true);
    }
  }

  onStemsChange(id) {
    if (id) this.updateRow(id);
    else this.render();
    const st = this.app.stems;
    const n = Object.keys(st.done).length;
    const dev = document.getElementById('stems-device');
    if (dev) dev.textContent = st.deviceLine();
    const space = document.getElementById('stems-space');
    if (space) space.textContent = st.spaceLine(this.app.settings?.stemsQuotaGB || 5);
    const note = document.getElementById('stems-notice');
    if (note) { note.hidden = !st.notice; note.textContent = st.notice; }
    const sum = document.getElementById('stems-sum');
    if (sum) {
      sum.hidden = !n;
      document.getElementById('stems-sum-txt').textContent = st.summary();
    }
  }

  updateRow(id) {
    this.rows.forEach((r, i) => {
      if (r.videoId !== id) return;
      const tr = this.body.querySelector(`tr[data-i="${i}"]`);
      if (tr) tr.outerHTML = this.rowHtml(r, i);
    });
  }
}
