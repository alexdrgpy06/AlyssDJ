// Librería: búsqueda, Me gusta y playlists de YouTube Music + pistas ya analizadas.
import { camelotColor, keysCompatible, bpmCompatible } from './camelot.js';

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
    this.search = document.getElementById('search');
    this.addFolder = document.getElementById('btn-add-folder');
    this.addFolder.addEventListener('click', () => this.chooseFolder());
    this.sort = null;
    this.onlyCompat = false;
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

    document.querySelectorAll('.tabs [data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.show(b.dataset.tab)),
    );
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

  async refreshAnalyzed() {
    const list = await window.ytdj.analysis.list();
    this.analyzed = new Map(list.map((a) => [a.id, a]));
    if (this.tab === 'analyzed') this.show('analyzed');
    else this.render();
  }

  setMsg(s) {
    this.msg.textContent = s || '';
  }

  async show(tab, query) {
    this.tab = tab;
    document.dispatchEvent(new CustomEvent('alyss:tab', { detail: tab }));
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const isAm = tab === 'automix';
    document.getElementById('am-view').hidden = !isAm;
    document.querySelector('.table-wrap').hidden = isAm;
    if (isAm) {
      this.addFolder.hidden = this.importBtn.hidden = this.listBtn.hidden = true;
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
      const data = await call(window.ytdj.lib.search(query), 'Sin resultados');
      if (data) this.render(data);
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
    this.render(r.data);
  }

  onClick(e) {
    const btn = e.target.closest('button');
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const row = this.rows[tr.dataset.i];
    if (row.playlist) return this.openPlaylist(row);
    if (!btn) return;
    if (btn.dataset.act === 'A' || btn.dataset.act === 'B') this.app.decks[btn.dataset.act].load(row);
    if (btn.dataset.act === 'radio') {
      this.app.automix.start({ seed: row });
      this.show('automix');
    }
    if (btn.dataset.act === 'queue') {
      this.app.automix.add(row);
      this.app.toast(`En la cola de AutoMix: ${row.title}`);
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
      return `<tr class="pl" data-i="${i}"><td>${r.thumb ? `<img src="${esc(r.thumb)}" loading="lazy">` : ''}</td><td>${esc(r.title)}</td><td>${esc(r.subtitle)}</td><td class="num"></td><td class="num"></td><td></td><td class="actions">Abrir ›</td></tr>`;
    }
    const a = this.analyzed.get(r.videoId);
    const [lbl, cls] = this.analyzeLabel(r.videoId);
    const compat = this.isCompat(r);
    const kc = camelotColor(a?.camelot);
    const art = r.thumb ? `<img src="${esc(r.thumb)}" loading="lazy">` : '<div class="noart">♪</div>';
    const loaded = ['A', 'B'].filter((d) => this.app.decks[d]?.track?.videoId === r.videoId).map((d) => `loaded-${d}`).join(' ');
    return `<tr data-i="${i}" data-id="${esc(r.videoId)}" draggable="true" class="${loaded}${compat ? ' compat' : ''}">
      <td>${art}</td>
      <td title="${esc(r.title)}">${esc(r.title)}</td>
      <td title="${esc(r.artist)}">${esc(r.artist)}</td>
      <td class="num">${fmtDur(r.duration)}</td>
      <td class="num">${a?.bpm ? a.bpm.toFixed(1) : ''}</td>
      <td class="key">${a?.camelot ? `<span class="kchip" style="--k:${kc}">${a.camelot}</span>` : ''}</td>
      <td class="actions"><button data-act="A" class="la">A</button><button data-act="B" class="lb">B</button><button data-act="radio" class="rd" title="Iniciar AutoMix (radio) desde esta pista">Radio</button><button data-act="queue" class="qq" title="Añadir a la cola de AutoMix" aria-label="Añadir a la cola">+</button><button data-act="analyze" class="an ${cls}">${lbl}</button></td>
    </tr>`;
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
    rows = this.sorted(rows);
    this.rows = rows;
    document.querySelectorAll('.tracks th[data-sort]').forEach((th) => {
      th.classList.toggle('sorted', this.sort?.k === th.dataset.sort);
      th.classList.toggle('asc', this.sort?.k === th.dataset.sort && this.sort.dir === 1);
    });
    this.body.innerHTML = rows.map((r, i) => this.rowHtml(r, i)).join('');
    this.listBtn.hidden = !rows.some((r) => r.videoId && !r.playlist);
  }

  updateRow(id) {
    this.rows.forEach((r, i) => {
      if (r.videoId !== id) return;
      const tr = this.body.querySelector(`tr[data-i="${i}"]`);
      if (tr) tr.outerHTML = this.rowHtml(r, i);
    });
  }
}
