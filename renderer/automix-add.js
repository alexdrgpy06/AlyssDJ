// Buscar y agregar desde la vista de AutoMix: resultados (YouTube Music + librería), sugeridas para continuar y su pintado.
import { camelotColor } from './camelot.js';
import { bestInsertion } from './mixplan.js';

const $ = (s) => document.querySelector(s);
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 856000000 → «856 M»; 135000 → «135 k»; 1200000000 → «1,2 B»
export function fmtPlays(n) {
  if (!n || n < 1000) return n ? String(n) : '';
  const f = (v) => (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ','));
  if (n >= 1e9) return `${f(n / 1e9)} B`;
  if (n >= 1e6) return `${f(n / 1e6)} M`;
  return `${f(n / 1e3)} k`;
}

const chips = (t, a) => `${t.plays ? `<span class="am-plays" title="${t.plays.toLocaleString('es')} reproducciones">▶ ${fmtPlays(t.plays)}</span>` : ''}${a?.bpm ? `<span class="bpm">${a.bpm.toFixed(1)}</span>` : ''}${a?.camelot ? `<span class="kchip" style="--k:${camelotColor(a.camelot)}">${a.camelot}</span>` : ''}`;
const art = (t) => (t.thumb ? `<img src="${esc(t.thumb)}" alt="" loading="lazy">` : '<div class="noart">♪</div>');

export class AddPanel {
  constructor(app) {
    this.app = app;
    this.results = [];
    this.q = '';
    this.timer = null;
    this.seq = 0;
    const input = $('#amv-search');
    input.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.search(input.value.trim()), 350);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(this.timer);
        this.search(input.value.trim()).then(() => this.results[0] && this.add(0, { next: e.shiftKey }));
      }
      if (e.key === 'Escape') this.clear();
    });
    $('#amv-results').addEventListener('click', (e) => this.onClick(e, 'results'));
    $('#amv-sug-list').addEventListener('click', (e) => this.onClick(e, 'sug'));
  }

  clear() {
    $('#amv-search').value = '';
    this.q = '';
    this.results = [];
    this.render();
  }

  async search(q) {
    this.q = q;
    const seq = ++this.seq;
    if (q.length < 2) {
      this.results = [];
      return this.render();
    }
    const am = this.app.automix;
    const norm = (x) => String(x || '').toLowerCase();
    const hit = (t) => `${norm(t.title)} ${norm(t.artist)}`.includes(norm(q));
    // librería: pistas locales (todas) y lo ya analizado
    const [yt, local] = await Promise.all([window.ytdj.lib.search(q).catch(() => ({ ok: false })), window.ytdj.local.list().catch(() => ({ ok: false }))]);
    if (seq !== this.seq) return; // llegó una búsqueda más nueva
    const lib = [];
    const seen = new Set();
    const localRows = local?.ok ? local.data.rows || [] : [];
    for (const t of [...(am.libPool || []), ...localRows]) {
      if (!t?.videoId || seen.has(t.videoId) || !hit(t)) continue;
      seen.add(t.videoId);
      lib.push({ ...t, local: t.local ?? true, source: 'Librería' });
    }
    const net = (yt.ok ? yt.data : []).filter((t) => !seen.has(t.videoId)).map((t) => ({ ...t, source: 'YouTube Music' }));
    this.results = [...lib.slice(0, 6), ...net.slice(0, 10)];
    for (const t of this.results) am.loadAna(t); // trae el análisis guardado de las que lo tengan
    this.render();
    // las reproducciones que la búsqueda no trajo (librería) y el análisis cargado llegan un instante después
    setTimeout(() => seq === this.seq && this.render(), 600);
  }

  // Posición que tendría si se agregara ahora (solo si ya está analizada).
  predicted(t) {
    const am = this.app.automix;
    const a = am.ana.get(t.videoId);
    if (!a?.bpm || am.isKnown(t.videoId)) return null;
    const cur = am.cur ? { ...(am.cur.analysis || am.ana.get(am.cur.track?.videoId) || {}) } : null;
    const r = bestInsertion({ cur: cur?.bpm ? cur : null, queue: am.queue, track: t, analysisOf: (x) => am.ana.get(x.videoId) });
    return r.index + 1;
  }

  rowHtml(t, i, kind) {
    const am = this.app.automix;
    const a = am.ana.get(t.videoId);
    const known = am.isKnown(t.videoId);
    const pos = this.predicted(t);
    const sub = [t.artist, kind === 'results' ? t.source : '', t.album].filter(Boolean).join(' · ');
    return `<li class="am-res" data-i="${i}">${art(t)}
      <div class="am-info"><b title="${esc(t.title)}">${esc(t.title)}</b><small>${esc(sub)}</small></div>
      <span class="am-meta">${chips(t, a)}${kind === 'sug' && t.cost != null ? `<span class="am-q ${t.cost < 6 ? 'good' : t.cost < 14 ? 'ok' : 'poor'}" title="Calidad de la transición desde el final de la cola">${t.cost < 6 ? '●●●' : t.cost < 14 ? '●●○' : '●○○'}</span>` : ''}${kind === 'sug' && !t.analyzed ? '<small class="am-wait">analizando…</small>' : ''}${kind === 'sug' && t.fits === false ? '<small class="am-misfit" title="Salto de BPM o tonalidad incompatible">no encaja</small>' : ''}</span>
      <span class="am-hint">${known ? 'ya está en la cola' : pos ? `→ posición ${pos}` : a ? '' : 'se analizará'}</span>
      <span class="am-actions"><button class="btn sm" data-act="add" ${known ? 'disabled' : ''}>Agregar</button><button class="btn ghost sm" data-act="next" ${known ? 'disabled' : ''} title="Ponerla la siguiente">A continuación</button></span></li>`;
  }

  render() {
    const ul = $('#amv-results');
    ul.hidden = !this.q || this.q.length < 2;
    ul.innerHTML = this.results.length ? this.results.map((t, i) => this.rowHtml(t, i, 'results')).join('') : this.q.length >= 2 ? '<li class="am-empty">Sin resultados.</li>' : '';
  }

  renderSuggestions(list) {
    const ul = $('#amv-sug-list');
    this.sug = list.map((s) => ({ ...s.track, cost: s.cost, analyzed: s.analyzed, fits: s.fits }));
    const sig = this.sug.map((t) => `${t.videoId}:${t.analyzed ? 1 : 0}:${t.plays || 0}:${t.cost}:${this.app.automix.isKnown(t.videoId) ? 1 : 0}`).join('|');
    if (ul.dataset.sig === sig) return;
    ul.dataset.sig = sig;
    $('#amv-suggest').hidden = !this.sug.length;
    ul.innerHTML = this.sug.map((t, i) => this.rowHtml(t, i, 'sug')).join('');
  }

  onClick(e, kind) {
    const b = e.target.closest('button[data-act]');
    const li = e.target.closest('li[data-i]');
    if (!b || !li) return;
    this.add(Number(li.dataset.i), { next: b.dataset.act === 'next', kind });
  }

  add(i, { next = false, kind = 'results' } = {}) {
    const t = (kind === 'sug' ? this.sug : this.results)[i];
    if (!t) return;
    const am = this.app.automix;
    const { source, cost, analyzed, fits, ...track } = t;
    const r = am.addSmart(track, { next });
    if (r.ok) {
      this.app.toast(am.note);
      this.render();
      if (kind === 'sug') this.renderSuggestions(am.suggestions());
    }
  }
}
