// Editor de puntos de mezcla: ve y ajusta la entrada y hasta 6 salidas de una pista, y prueba la transición.
import { analysisWave, drawOverview } from './waveform.js';
import { fileUrl, startPreview } from './mixpreview.js';

const $ = (s) => document.querySelector(s);
const MAX_OUTS = 6;
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export class MixEditor {
  constructor(app) {
    this.app = app;
    this.dlg = $('#mixedit');
    this.canvas = $('#me-wave');
    this.cache = {};
    this.sel = null; // 'in' | índice de salida
    this.cursor = 0;
    this.drag = null;
    this.preview = null;
    this.bind();
  }

  // ---------- datos ----------
  open(track, ana, next = null) {
    if (!ana?.waveform) return this.app.toast('Esta pista aún no está analizada: no hay puntos que editar.', true);
    this.track = track;
    this.ana = ana;
    this.next = next; // { track, analysis } para la prueba
    this.wave = analysisWave(ana);
    this.dur = ana.duration || this.wave.low.length / this.wave.bps;
    this.cache = {};
    this.sel = null;
    this.cursor = ana.mixEdit?.in ?? ana.mix?.mixIn ?? 0;
    $('#me-title').textContent = `${track.title || ana.title || ''}${track.artist ? ' — ' + track.artist : ''}`;
    $('#me-meta').textContent = [ana.bpm ? `${ana.bpm.toFixed(1)} BPM` : '', ana.camelot, mmss(this.dur)].filter(Boolean).join(' · ');
    this.edit = ana.mixEdit ? { in: ana.mixEdit.in, outs: ana.mixEdit.outs.map((o) => ({ ...o })), free: !!ana.mixEdit.free } : null;
    $('#me-free').checked = !!this.edit?.free;
    this.dlg.showModal();
    this.render();
  }

  // Lo que se muestra: la edición del usuario o, mientras no hay, los candidatos automáticos.
  view() {
    if (this.edit) return { auto: false, in: this.edit.in, outs: this.edit.outs };
    const m = this.ana.mix || {};
    return { auto: true, in: m.mixIn ?? null, outs: (m.mixOut || []).slice(0, MAX_OUTS).map((c) => ({ t: c.t, score: c.score, kind: c.kind })) };
  }

  ensureEdit() {
    if (this.edit) return this.edit;
    const v = this.view();
    this.edit = { in: v.in, outs: v.outs.map((o) => ({ t: o.t })), free: $('#me-free').checked };
    return this.edit;
  }

  snap(t) {
    t = Math.max(0, Math.min(this.dur - 1.5, t));
    if ($('#me-free').checked || !this.ana.bpm) return Math.round(t * 1000) / 1000;
    const beat = 60 / this.ana.bpm;
    const step = this.shift ? beat * 16 : beat;
    const off = this.ana.offset || 0;
    return Math.round((off + Math.round((t - off) / step) * step) * 1000) / 1000;
  }

  commit() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(async () => {
      const saved = await window.ytdj.analysis.setMixEdit(this.track.videoId, this.edit ? { ...this.edit, free: $('#me-free').checked } : null);
      this.ana.mixEdit = saved || undefined;
      this.app.automix.ana.get(this.track.videoId) && (this.app.automix.ana.get(this.track.videoId).mixEdit = saved || undefined);
      this.edit = saved ? { in: saved.in, outs: saved.outs.map((o) => ({ ...o })), free: saved.free } : null;
      this.render();
    }, 250);
  }

  // ---------- dibujo ----------
  px(t) {
    return (t / this.dur) * this.canvas.width;
  }
  render() {
    if (!this.dlg.open) return;
    const c = this.canvas;
    drawOverview(c, { wave: this.wave, dur: this.dur, pos: 0, loop: null, hotcues: [], cuePoint: null }, this.cache);
    const ctx = c.getContext('2d');
    const dpr = devicePixelRatio || 1;
    const v = this.view();
    const H = c.height;
    // rejilla de frases: una línea tenue cada 16 beats
    if (this.ana.bpm) {
      const phrase = (60 / this.ana.bpm) * 16;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let t = this.ana.offset || 0; t < this.dur; t += phrase) ctx.fillRect(Math.round(this.px(t)), 0, 1, H);
    }
    const mark = (t, color, label, { dashed = false, selected = false } = {}) => {
      const x = Math.round(this.px(t));
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = (selected ? 4 : 2) * dpr;
      if (dashed) ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${11 * dpr}px system-ui, sans-serif`;
      const w = ctx.measureText(label).width + 10 * dpr;
      const lx = Math.min(x, c.width - w);
      ctx.fillRect(lx, 0, w, 16 * dpr);
      ctx.fillStyle = '#06080c';
      ctx.fillText(label, lx + 5 * dpr, 12 * dpr);
      ctx.restore();
    };
    if (v.in != null) mark(v.in, '#3ddc84', 'IN', { dashed: v.auto, selected: this.sel === 'in' });
    v.outs.forEach((o, i) => mark(o.t, '#ff4d6d', `${i + 1}${v.auto && o.score != null ? ' · ' + Math.round(o.score) : ''}`, { dashed: v.auto, selected: this.sel === i }));
    ctx.fillStyle = '#ffffffcc';
    ctx.fillRect(Math.round(this.px(this.cursor)) - dpr, 0, 2 * dpr, H);
    $('#me-hint').textContent = v.auto ? 'Automático (líneas discontinuas): mueve, añade o borra puntos para fijar los tuyos.' : 'Editado por ti: AutoMix usa solo estos puntos.';
    this.renderList(v);
    $('#me-reset').disabled = !this.edit && !this.ana.mixEdit;
    const can = this.canPreview();
    $('#me-preview').disabled = !can.ok && !this.preview;
    $('#me-preview').title = can.ok ? 'Escucha los últimos segundos de esta pista y la entrada de la siguiente (por auriculares si hay salida cue)' : can.why;
    $('#me-preview span').textContent = this.preview ? 'Detener prueba' : 'Probar la mezcla';
  }

  renderList(v) {
    const li = (inner, cls = '') => `<li class="${cls}">${inner}</li>`;
    let html = '';
    html += li(`<span class="dot in"></span><b>Entrada</b><span class="t">${v.in != null ? mmss(v.in) : '—'}</span><span></span>`, this.sel === 'in' ? 'sel' : '');
    v.outs.forEach((o, i) => {
      html += li(
        `<span class="dot out"></span><b>Salida ${i + 1}</b><span class="t">${mmss(o.t)}${v.auto && o.score != null ? ` <small>puntuación ${Math.round(o.score)}</small>` : ''}</span>
         <span class="acts"><button data-a="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Preferir antes">▲</button><button data-a="down" data-i="${i}" ${i === v.outs.length - 1 ? 'disabled' : ''} aria-label="Preferir después">▼</button><button data-a="rm" data-i="${i}" aria-label="Quitar">✕</button></span>`,
        this.sel === i ? 'sel' : '',
      );
    });
    $('#me-list').innerHTML = html;
    $('#me-add').disabled = v.outs.length >= MAX_OUTS;
  }

  canPreview() {
    if (!this.next?.analysis) return { ok: false, why: 'No hay una siguiente pista analizada en la cola.' };
    if (!fileUrl(this.track, this.ana)) return { ok: false, why: 'Esta pista aún no está guardada como archivo local.' };
    if (!fileUrl(this.next.track, this.next.analysis)) return { ok: false, why: 'La siguiente pista aún no está guardada como archivo local.' };
    if (!this.view().outs.length) return { ok: false, why: 'Añade una salida para probar.' };
    return { ok: true };
  }

  // ---------- interacción ----------
  tAt(e) {
    const r = this.canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * this.dur;
  }
  hit(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const v = this.view();
    const cands = [];
    if (v.in != null) cands.push({ key: 'in', x: (v.in / this.dur) * r.width });
    v.outs.forEach((o, i) => cands.push({ key: i, x: (o.t / this.dur) * r.width }));
    const best = cands.map((c) => ({ ...c, d: Math.abs(c.x - x) })).sort((a, b) => a.d - b.d)[0];
    return best && best.d <= 9 ? best.key : null;
  }

  addOut(t) {
    const edit = this.ensureEdit();
    if (edit.outs.length >= MAX_OUTS) return this.app.toast(`Máximo ${MAX_OUTS} puntos de salida`, true);
    edit.outs.push({ t: this.snap(t) });
    this.sel = edit.outs.length - 1;
    this.commit();
    this.render();
  }

  remove(i) {
    const edit = this.ensureEdit();
    if (i === 'in') edit.in = null;
    else edit.outs.splice(i, 1);
    this.sel = null;
    this.commit();
    this.render();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.shift = e.shiftKey;
      const k = this.hit(e);
      this.cursor = this.tAt(e);
      if (k == null) {
        this.sel = null;
        return this.render();
      }
      this.sel = k;
      this.ensureEdit();
      this.drag = k;
      c.setPointerCapture(e.pointerId);
      this.render();
    });
    c.addEventListener('pointermove', (e) => {
      if (this.drag == null) return (c.style.cursor = this.hit(e) != null ? 'ew-resize' : 'crosshair');
      this.shift = e.shiftKey;
      const t = this.snap(this.tAt(e));
      if (this.drag === 'in') this.edit.in = t;
      else this.edit.outs[this.drag].t = t;
      this.cursor = t;
      this.render();
    });
    const up = () => {
      if (this.drag == null) return;
      this.drag = null;
      this.commit();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => (e.preventDefault(), this.addOut(this.tAt(e))));
    c.addEventListener('dblclick', (e) => this.addOut(this.tAt(e)));
    $('#me-add').addEventListener('click', () => this.addOut(this.cursor));
    $('#me-setin').addEventListener('click', () => {
      this.ensureEdit().in = this.snap(this.cursor);
      this.sel = 'in';
      this.commit();
      this.render();
    });
    $('#me-free').addEventListener('change', () => this.edit && this.commit());
    $('#me-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      const li = e.target.closest('li');
      if (!b) {
        const idx = [...$('#me-list').children].indexOf(li);
        this.sel = idx <= 0 ? 'in' : idx - 1;
        return this.render();
      }
      const i = Number(b.dataset.i);
      const edit = this.ensureEdit();
      if (b.dataset.a === 'rm') return this.remove(i);
      const j = b.dataset.a === 'up' ? i - 1 : i + 1;
      [edit.outs[i], edit.outs[j]] = [edit.outs[j], edit.outs[i]];
      this.sel = j;
      this.commit();
      this.render();
    });
    this.dlg.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel != null && !(e.target.matches?.('input'))) this.remove(this.sel);
    });
    $('#me-reset').addEventListener('click', () => {
      this.edit = null;
      this.sel = null;
      this.ana.mixEdit = undefined;
      clearTimeout(this.saveT);
      window.ytdj.analysis.setMixEdit(this.track.videoId, null).then(() => {
        const a = this.app.automix.ana.get(this.track.videoId);
        if (a) a.mixEdit = undefined;
        this.render();
      });
    });
    $('#me-preview').addEventListener('click', () => (this.preview ? this.stopPreview() : this.startPreview()));
    $('#me-close').addEventListener('click', () => this.dlg.close());
    this.dlg.addEventListener('close', () => {
      this.stopPreview();
      this.app.automix.emit();
    });
    addEventListener('resize', () => this.render());
  }

  async startPreview() {
    const can = this.canPreview();
    if (!can.ok) return this.app.toast(can.why, true);
    const v = this.view();
    const exitAt = v.outs[this.sel != null && this.sel !== 'in' ? this.sel : 0].t;
    this.preview = await startPreview({
      aUrl: fileUrl(this.track, this.ana),
      bUrl: fileUrl(this.next.track, this.next.analysis),
      a: this.ana,
      b: this.next.analysis,
      exitAt,
      len: this.app.automix.cfg.len,
      cueLabel: this.app.settings.output?.cueLabel || '',
      silent: !!this.silentPreview,
      onEnd: () => ((this.preview = null), this.render()),
    });
    this.render();
  }

  stopPreview() {
    this.preview?.stop?.();
    this.preview = null;
  }
}
