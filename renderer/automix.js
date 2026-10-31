// AutoMix: DJ automático. La cola sale de una lista o de la "radio" de YouTube Music (pistas parecidas a la actual);
// la siguiente se precarga en el deck libre y se mezcla sola: tempo y fase igualados (si hay BPM), fundido, bass swap o filtro.
import { controls } from './controls.js';
import { planTransition, pickNext, bpmGap, PITCH_LIMIT, HOME_MS, MAX_BPM_GAP } from './mixplan.js';

const LS = 'alyssdj:automix';
const side = (id) => (id === 'A' ? -1 : 1);
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const posOf = (d) => (typeof d.pos === 'function' ? d.pos() : d.pos || 0);
const MIN_DUR = 90; // la radio mete mixes y pistas larguísimas: se descartan
const MAX_DUR = 600;

export class AutoMix {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.queue = [];
    this.history = new Set();
    this.cur = null;
    this.trans = null;
    this.filling = false;
    this.loadingNext = false;
    this.failUntil = 0;
    this.note = '';
    this.timer = null;
    this.listeners = new Set();
    this.prep = new Map(); // videoId → { state: 'queued'|'download'|'analyze'|'ready'|'error', progress, error }
    this.waitSince = 0;
    this.pendingMix = false;
    this.ana = new Map(); // videoId → análisis (BPM, tonalidad, estructura) para ordenar y planear
    this.pinned = new Set(); // pistas que el usuario colocó a mano: la ordenación automática no las mueve
    this.reanalyzed = new Set();
    this.plan = null;
    this.lastReorder = -Infinity;
    this.cfg = { len: 16, style: 'bass', matchTempo: true, analyze: true, endless: true, preferLocal: true, waitMs: 20000, optimalPoints: true, smartOrder: true };
    try {
      Object.assign(this.cfg, JSON.parse(localStorage.getItem(LS) || '{}'));
    } catch {}
    window.ytdj.analysis.onEvent((ev) => this.onAnalysis(ev));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const l of this.listeners) l();
  }
  setCfg(patch) {
    Object.assign(this.cfg, patch);
    try {
      localStorage.setItem(LS, JSON.stringify(this.cfg));
    } catch {}
    this.emit();
  }

  // Controles reales de la UI: así los knobs se mueven solos y MIDI/UI ven lo mismo.
  knob(deck, name, v) {
    controls.get(`deck${deck.id}.${name}`)?.setNorm((clamp(v, -1, 1) + 1) / 2);
  }
  setX(x) {
    this.app.xfader.value = clamp(x, -1, 1);
    this.app.applyXf();
  }

  // ---------- inicio / fin ----------
  // seed: pista con la que arranca. tracks: lista (la primera arranca, el resto va a la cola).
  async start({ seed, tracks } = {}) {
    const { A, B } = this.app.decks;
    if (this.on) this.stop();
    this.queue = [];
    this.history.clear();
    this.trans = null;
    let first = seed;
    if (tracks?.length) {
      const list = tracks.filter((t) => t.videoId);
      first = first || list[0];
      this.queue = list.filter((t) => t.videoId !== first?.videoId && !t.playlist);
    }
    let deck = [A, B].find((d) => d.track?.videoId === first?.videoId && d.st.playing);
    if (!first) {
      deck = [A, B].find((d) => d.track && d.st.playing) || [A, B].find((d) => d.track);
      first = deck?.track;
    }
    if (!first) return this.app.toast('Carga una pista, o usa “Radio” en la librería, para iniciar el AutoMix.', true);

    this.on = true;
    if (!deck) {
      deck = [A, B].find((d) => !d.st.playing) || A;
      this.setX(side(deck.id));
      await deck.load(first, { play: true, force: true });
    } else if (!deck.st.playing) {
      deck.togglePlay();
    }
    this.cur = deck;
    this.setX(side(deck.id));
    this.history.add(first.videoId);
    this.note = '';
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 250);
    this.ensureQueue();
    this.emit();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.on = false;
    if (this.trans) {
      for (const d of [this.trans.from, this.trans.to]) {
        this.knob(d, 'eqLow', 0);
        this.knob(d, 'filter', 0);
      }
    }
    this.trans = null;
    this.note = '';
    this.emit();
  }

  add(track) {
    if (!track?.videoId || this.queue.some((t) => t.videoId === track.videoId)) return;
    this.queue.push(track);
    this.emit();
  }
  insertNext(track) {
    if (!track?.videoId) return;
    this.queue = this.queue.filter((t) => t.videoId !== track.videoId);
    this.queue.unshift(track);
    this.pinned.add(track.videoId);
    this.emit();
  }
  remove(i) {
    const [t] = this.queue.splice(i, 1);
    if (t) this.pinned.delete(t.videoId);
    this.emit();
  }
  clear() {
    this.queue = [];
    this.pinned.clear();
    this.emit();
  }
  move(i, to) {
    if (i < 0 || i >= this.queue.length || to < 0 || to >= this.queue.length || i === to) return;
    const [t] = this.queue.splice(i, 1);
    this.queue.splice(to, 0, t);
    // Si el usuario reordena a mano, el orden que deja queda fijo; solo lo que se añada después se ordena solo.
    for (const x of this.queue) this.pinned.add(x.videoId);
    this.emit();
  }
  playNext(i) {
    this.move(i, 0);
  }

  // ---------- cola (radio de YouTube Music) ----------
  async ensureQueue(force = false) {
    if (this.filling || (!force && (this.queue.length >= 3 || performance.now() < this.failUntil))) return;
    if (!force && !this.cfg.endless && this.queue.length) return;
    this.filling = true;
    try {
      const seedTrack = this.queue[this.queue.length - 1] || this.cur?.track;
      if (!seedTrack) return;
      let vid = seedTrack.videoId;
      if (seedTrack.local) {
        // Pista local: se busca su equivalente en YouTube Music para sacar la radio.
        const q = await window.ytdj.lib.search(`${seedTrack.artist || ''} ${seedTrack.title || ''}`.trim());
        if (!q.ok || !q.data[0]) throw new Error(q.error || 'sin equivalente en YouTube Music');
        vid = q.data[0].videoId;
      }
      const r = await window.ytdj.lib.radio(vid);
      if (!r.ok) throw new Error(r.error);
      const known = new Set([
        ...this.history,
        ...this.queue.map((t) => t.videoId),
        this.app.decks.A.track?.videoId,
        this.app.decks.B.track?.videoId,
      ]);
      const fresh = r.data.filter((t) => !known.has(t.videoId) && (!t.duration || (t.duration >= MIN_DUR && t.duration <= MAX_DUR)));
      this.queue.push(...fresh.slice(0, 8));
      if (!fresh.length) throw new Error('la radio no devolvió pistas nuevas');
      this.note = '';
    } catch (e) {
      this.note = `Radio: ${String(e.message).includes('aún no cargó') ? 'YouTube Music todavía está cargando…' : e.message}`;
      this.failUntil = performance.now() + 6000;
    } finally {
      this.filling = false;
      this.emit();
    }
  }

  // ---------- preparación: analizar y usar el archivo (sin anuncios, con BPM) ----------
  isReady(track) {
    if (!track) return false;
    if (track.local || !this.cfg.preferLocal) return true;
    return this.prep.get(track.videoId)?.state === 'ready';
  }

  prepOf(track) {
    if (track.local) return { state: 'ready' };
    if (!this.cfg.preferLocal) return { state: 'stream' };
    return this.prep.get(track.videoId) || { state: 'idle' };
  }

  // Pide analizar y guardar las próximas pistas de YouTube; las que ya están guardadas quedan listas al instante.
  prepareAhead(n = 3) {
    for (const t of this.queue.slice(0, 6)) this.loadAna(t);
    if (!this.cfg.preferLocal) return;
    for (const t of this.queue.slice(0, n)) {
      if (t.local || this.prep.has(t.videoId)) continue;
      this.prep.set(t.videoId, { state: 'queued' });
      window.ytdj.analysis.get(t.videoId).then((a) => {
        if (a?.saved) return this.setPrep(t.videoId, { state: 'ready' });
        window.ytdj.analysis.request(t.videoId, { meta: { title: t.title, artist: t.artist, thumb: t.thumb, trackDuration: t.duration }, save: true });
      });
    }
  }

  setPrep(id, p) {
    this.prep.set(id, p);
    this.emit();
  }

  onAnalysis(ev) {
    if (ev.stage === 'done' && ev.analysis) {
      this.ana.set(ev.id, ev.analysis);
      this.emit(); // la vista muestra BPM, tonalidad y energía en cuanto llegan
    }
    if (!this.prep.has(ev.id)) return;
    if (ev.stage === 'queued') this.setPrep(ev.id, { state: 'queued' });
    else if (ev.stage === 'download') this.setPrep(ev.id, { state: 'download', progress: ev.progress || 0 });
    else if (ev.stage === 'analyze') this.setPrep(ev.id, { state: 'analyze' });
    else if (ev.stage === 'done') this.setPrep(ev.id, ev.analysis?.saved ? { state: 'ready' } : { state: 'error', error: 'No se pudo guardar el archivo' });
    else if (ev.stage === 'error') this.setPrep(ev.id, { state: 'error', error: ev.error });
    else if (ev.stage === 'cancelled') this.prep.delete(ev.id);
  }

  // ---------- análisis de las próximas pistas: BPM, tonalidad y estructura ----------
  loadAna(t) {
    if (this.ana.has(t.videoId)) return;
    this.ana.set(t.videoId, null);
    window.ytdj.analysis.get(t.videoId).then((a) => {
      if (a) this.ana.set(t.videoId, a);
      else this.ana.set(t.videoId, null);
      this.ensureStructure(t, a);
      // Una pista local de la cola se analiza por adelantado (es rápido y no descarga nada): así se puede ordenar y planear.
      if (!a && t.local && t.path && !this.reanalyzed.has(t.videoId)) {
        this.reanalyzed.add(t.videoId);
        window.ytdj.analysis.request(t.videoId, { meta: { title: t.title, artist: t.artist, thumb: t.thumb, trackDuration: t.duration }, file: t.path });
      }
    });
  }

  // Un análisis anterior sin estructura se recalcula con el archivo que ya está en el disco (sin volver a descargar).
  ensureStructure(t, a) {
    if (!a?.bpm || a.mix || this.reanalyzed.has(t.videoId)) return;
    const file = t.local ? t.path : a.saved?.path;
    if (!file) return;
    this.reanalyzed.add(t.videoId);
    window.ytdj.analysis.request(t.videoId, { meta: { title: t.title, artist: t.artist, thumb: t.thumb, trackDuration: t.duration }, ...(t.local ? { file, force: true } : { reuse: file, force: true }) });
  }

  // Ordena la cola por compatibilidad con lo que suena (BPM, tonalidad, energía), respetando lo fijado a mano.
  reorder() {
    if (!this.cfg.smartOrder || !this.cur || this.trans || this.queue.length < 2) return;
    const now = performance.now();
    if (now - this.lastReorder < 1500) return;
    this.lastReorder = now;
    const curAna = { ...(this.cur.analysis || this.ana.get(this.cur.track?.videoId) || {}) };
    if (!curAna.bpm) return;
    const r = pickNext({ cur: curAna, queue: this.queue, isReady: (t) => this.isReady(t), analysisOf: (t) => this.ana.get(t.videoId), pinned: this.pinned });
    if (r.queue.some((t, i) => t.videoId !== this.queue[i].videoId)) {
      this.queue = r.queue;
      this.emit();
    }
  }

  // ---------- bucle ----------
  ready(deck, track) {
    return !!track && deck.track?.videoId === track.videoId && deck.st.videoId === track.videoId && deck.st.dur > 0 && !!deck.st.ready && !deck.st.ad;
  }

  async preload(next) {
    const t = this.queue[0];
    this.loadingNext = true;
    try {
      await next.load(t, { play: false, force: true });
      if (this.cfg.analyze && !this.cfg.preferLocal && !t.local && !next.analysis) next.analyze();
    } finally {
      this.loadingNext = false;
    }
  }

  tick() {
    if (!this.on) return;
    if (this.trans) return this.stepTransition();
    const cur = this.cur;
    if (!cur?.track) return;
    const next = this.app.other(cur);
    this.ensureQueue();
    this.prepareAhead();
    // Una cabeza que falló al prepararse pasa al final: no bloquea la cola.
    if (this.queue.length > 1 && this.prepOf(this.queue[0]).state === 'error') {
      this.note = `No se pudo preparar “${this.queue[0].title}”; pasa al final de la cola`;
      this.move(0, this.queue.length - 1);
    }
    this.reorder();
    const head = this.queue[0];
    // Solo se precarga la cabeza cuando está lista (así el deck abre el archivo local y no el stream).
    if (head && this.isReady(head) && !this.loadingNext && !next.st.playing && next.track?.videoId !== head.videoId) this.preload(next);
    if (!cur.st.playing || !head) return; // pausado a mano o sin siguiente
    const rem = cur.remaining();
    if (this.pendingMix) {
      if (this.ready(next, head)) {
        this.pendingMix = false;
        this.startTransition(cur, next, this.makePlan(cur, next, head, { quick: true }));
      }
      return;
    }
    // Plan: mejor punto de salida de la pista que suena (alineado a una frase), no necesariamente el final.
    this.plan = this.makePlan(cur, next, head);
    if (posOf(cur) < this.plan.exitAt - 0.05) return this.resetWait();
    // Ya toca mezclar: si la siguiente no está lista se espera; pasado el tiempo, se salta a una que sí lo esté.
    if (!this.isReady(head)) return this.waitForReady(rem);
    this.resetWait();
    // Antes de mezclar, la siguiente debe tener su análisis (BPM y estructura) si va a salir de un archivo.
    const analysisPending = !next.analysis && (next.analyzing || next.source === 'local') && next.track?.videoId === head.videoId && rem > 12;
    const waitingAnalysis = (this.cfg.analyze && next.analyzing && rem > 25) || analysisPending;
    if (this.ready(next, head) && !waitingAnalysis) this.startTransition(cur, next, this.plan);
    else if (rem <= 1.2 && this.ready(next, head)) this.startTransition(cur, next, 2);
  }

  // Plan de la transición con los análisis de las dos pistas (los del deck si ya están cargados).
  makePlan(cur, next, head, { quick = false } = {}) {
    const curAna = { ...(cur.analysis || this.ana.get(cur.track?.videoId) || {}) };
    curAna.duration = curAna.duration || cur.st.dur || cur.track?.duration || 0;
    const nextAna = (next.track?.videoId === head.videoId && next.analysis) || this.ana.get(head.videoId) || {};
    return planTransition(curAna, nextAna, { len: quick ? Math.min(this.cfg.len, 6) : this.cfg.len, optimal: this.cfg.optimalPoints && !quick, pos: posOf(cur) });
  }

  resetWait() {
    this.waitSince = 0;
  }

  waitForReady(rem) {
    const now = performance.now();
    if (!this.waitSince) this.waitSince = now;
    this.note = `Preparando la siguiente pista… (${Math.round((now - this.waitSince) / 1000)} s)`;
    if (now - this.waitSince < this.cfg.waitMs) return;
    const idx = this.queue.findIndex((t) => this.isReady(t));
    if (idx > 0) {
      this.note = `“${this.queue[0].title}” no estaba lista: sigue “${this.queue[idx].title}”`;
      this.move(idx, 0);
    } else if (idx < 0) {
      // Ninguna lista: se mezcla la primera por streaming con fundido (sin tempo) y se avisa.
      this.note = 'Ninguna pista estuvo lista: se mezcla por streaming con fundido';
      this.app.toast(this.note, true);
      this.prep.set(this.queue[0].videoId, { state: 'ready', stream: true });
    }
    this.waitSince = 0;
  }

  // "Mezclar ahora": pasa ya a la siguiente pista lista; si aún no hay ninguna, se mezcla en cuanto la haya.
  mixNow() {
    if (!this.on || this.trans || !this.cur) return;
    const idx = this.queue.findIndex((t) => this.isReady(t));
    if (idx > 0) this.move(idx, 0);
    if (idx < 0) this.app.toast('La siguiente pista todavía se está preparando; se mezclará en cuanto esté lista.');
    this.pendingMix = true;
    this.emit();
  }

  skip() {
    this.mixNow();
  }

  // `plan` es el resultado de planTransition (o, por compatibilidad, una duración en segundos).
  startTransition(from, to, plan) {
    const p = typeof plan === 'number' ? { seconds: plan, style: null, tempo: true, enterAt: null, warnings: [] } : plan;
    if (from.loop) from.setLoop(null);
    to.setLoop(null);
    // La entrante arranca en su punto de entrada (no necesariamente el principio de la pista).
    if (p.enterAt != null && p.enterAt > 0.5 && to.seek) to.seek(p.enterAt);
    let tempo = false;
    const wantTempo = this.cfg.matchTempo && p.tempo !== false && from.bpm() && to.bpm();
    if (wantTempo) {
      tempo = to.matchTempoSmart(from, PITCH_LIMIT * 100); // ajuste limitado a ±8 %
      if (tempo) to.alignPhase(from);
    }
    to.wantPlay = true;
    to.transport({ type: 'play' });
    const style = p.style || this.cfg.style;
    const len = p.seconds;
    this.knob(to, 'eqLow', style === 'bass' ? -1 : 0);
    this.knob(to, 'filter', style === 'filter' ? 0.85 : 0);
    this.trans = { from, to, len, t0: performance.now(), tempo, style, lastPhase: 0, swapped: false, track: to.track, kind: p.kind, warnings: p.warnings || [] };
    this.note = `Mezclando ${from.id} → ${to.id}${tempo ? ' (tempo igualado)' : ''}${p.kind && p.kind !== 'final' ? ` · salida en ${p.kind}` : ''}`;
    this.emit();
  }

  stepTransition() {
    const t = this.trans;
    const now = performance.now();
    const p = Math.min(1, (now - t.t0) / 1000 / t.len);
    this.setX(side(t.from.id) + (side(t.to.id) - side(t.from.id)) * ease(p));
    if (t.style === 'bass' && p >= 0.5 && !t.swapped) {
      t.swapped = true;
      this.knob(t.to, 'eqLow', 0);
      this.knob(t.from, 'eqLow', -1);
    } else if (t.style === 'filter') {
      this.knob(t.from, 'filter', -0.9 * ease(p));
      this.knob(t.to, 'filter', 0.85 * (1 - ease(p)));
    }
    // Corrige la fase con pequeños empujones mientras suenan los dos.
    if (t.tempo && p < 0.7 && now - t.lastPhase > 600) {
      t.lastPhase = now;
      const d = t.to.phaseDiff(t.from);
      if (d != null && Math.abs(d) > 0.015) t.to.transport({ type: 'bend', amount: clamp(d * 0.12, -0.04, 0.04), ms: 500 });
    }
    if (p >= 1) this.finishTransition();
  }

  finishTransition() {
    const { from, to } = this.trans;
    this.trans = null;
    from.wantPlay = false;
    from.transport({ type: 'pause' });
    for (const d of [from, to]) {
      this.knob(d, 'eqLow', 0);
      this.knob(d, 'filter', 0);
    }
    to.syncLock = false;
    this.history.add(to.track.videoId);
    // La cola pudo editarse durante la mezcla: se quita la pista que entró, no «la primera».
    this.queue = this.queue.filter((t) => t.videoId !== to.track.videoId);
    this.cur = to;
    this.setX(side(to.id));
    this.glideTempoHome(to, HOME_MS);
    this.note = '';
    this.emit();
  }

  // Tras mezclar, el tempo vuelve poco a poco al original de la pista para no acumular desvío entre pistas.
  glideTempoHome(deck, ms = HOME_MS) {
    const p0 = deck.pitch;
    if (Math.abs(p0) < 0.001) return;
    const t0 = performance.now();
    let last = p0;
    const id = setInterval(() => {
      const f = Math.min(1, (performance.now() - t0) / ms);
      if (Math.abs(deck.pitch - last) > 1e-4 || deck.syncLock || !this.on) return clearInterval(id); // el usuario tomó el control
      last = p0 * (1 - f);
      deck.setPitch(last);
      if (f >= 1) clearInterval(id);
    }, 100);
  }

  snapshot() {
    const next = this.cur ? this.app.other(this.cur) : null;
    const t = this.trans;
    const curAna = this.cur?.analysis || this.ana.get(this.cur?.track?.videoId) || null;
    const items = this.queue.map((tr) => {
      const a = tr.local || this.ana.get(tr.videoId) ? this.ana.get(tr.videoId) : null;
      const g = bpmGap(curAna?.bpm, a?.bpm);
      return {
        ...tr,
        prep: this.prepOf(tr),
        bpm: a?.bpm || null,
        camelot: a?.camelot || null,
        energy: a?.mix?.energy ?? null,
        gapPct: g ? Math.round((g.ratio - 1) * 1000) / 10 : null, // + si hay que acelerar la entrante
        jump: !!g && g.gap > MAX_BPM_GAP,
        pinned: this.pinned.has(tr.videoId),
      };
    });
    return {
      on: this.on,
      cur: this.cur?.track || null,
      curDeck: this.cur?.id || null,
      curInfo: curAna ? { bpm: curAna.bpm || null, camelot: curAna.camelot || null, energy: curAna.mix?.energy ?? null } : null,
      next: this.queue[0] || null,
      nextReady: !!next && this.ready(next, this.queue[0]),
      queue: items,
      plan: this.plan ? { exitAt: this.plan.exitAt, kind: this.plan.kind, seconds: this.plan.seconds, warnings: this.plan.warnings, tempo: this.plan.tempo } : null,
      pos: this.cur ? posOf(this.cur) : null,
      trans: t ? { from: t.from.id, to: t.to.id, progress: Math.min(1, (performance.now() - t.t0) / 1000 / t.len), tempo: t.tempo, style: t.style, len: t.len, warnings: t.warnings } : null,
      progress: t ? Math.min(1, (performance.now() - t.t0) / 1000 / t.len) : null,
      rem: this.cur ? this.cur.remaining() : null,
      pendingMix: this.pendingMix,
      cfg: { ...this.cfg },
      note: this.note,
    };
  }
}
