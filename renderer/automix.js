// AutoMix: DJ automático. La cola sale de una lista o de la "radio" de YouTube Music (pistas parecidas a la actual);
// la siguiente se precarga en el deck libre y se mezcla sola: tempo y fase igualados (si hay BPM), fundido, bass swap o filtro.
import { controls } from './controls.js';
import { planTransition, planNearest, rankCandidates, bestInsertion, pickNext, orderChain, edgeCost, bpmGap, PITCH_LIMIT, HOME_MS, MAX_BPM_GAP } from './mixplan.js';

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
    this.radioPool = []; // candidatas de la radio que no entraron a la cola: alimentan las sugeridas
    this.libPool = []; // pistas ya analizadas de la librería
    this.libPoolAt = -Infinity;
    this.poolAt = -Infinity;
    this.moves = new Map(); // agregadas sin analizar: se avisa dónde acaban cuando llega su análisis
    this.suggestBusy = new Set();
    this.cfg = { popularity: true, popWeight: 'mid', len: 16, style: 'bass', matchTempo: true, analyze: true, endless: true, preferLocal: true, waitMs: 20000, optimalPoints: true, smartOrder: true };
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
    this.prepareAhead();
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
  // Candidatas frescas de la radio de YouTube Music para `seedTrack`, con sus reproducciones, ordenadas por BPM, tonalidad,
  // estilo y popularidad. No toca la cola.
  async radioCandidates(seedTrack) {
    let vid = seedTrack.videoId;
    if (seedTrack.local) {
      // Pista local: se busca su equivalente en YouTube Music para sacar la radio.
      const q = await window.ytdj.lib.search(`${seedTrack.artist || ''} ${seedTrack.title || ''}`.trim());
      if (!q.ok || !q.data[0]) throw new Error(q.error || 'sin equivalente en YouTube Music');
      vid = q.data[0].videoId;
    }
    const r = await window.ytdj.lib.radio(vid);
    if (!r.ok) throw new Error(r.error);
    const known = new Set([...this.history, ...this.queue.map((t) => t.videoId), this.app.decks.A.track?.videoId, this.app.decks.B.track?.videoId]);
    const fresh = r.data.filter((t) => !known.has(t.videoId) && (!t.duration || (t.duration >= MIN_DUR && t.duration <= MAX_DUR))).map((t) => ({ ...t, fromRadio: true }));
    const noPlays = fresh.filter((t) => !t.plays); // algunas ya traen las vistas en sus créditos
    if (this.cfg.popularity && noPlays.length && window.ytdj.lib.popularity) {
      // Las reproducciones llegan en segundos; si tardan, la candidata entra sin ellas y la cola se reordena con el análisis.
      const pop = await Promise.race([window.ytdj.lib.popularity(noPlays.map((t) => t.videoId)), new Promise((res) => setTimeout(() => res(null), 4000))]).catch(() => null);
      if (pop?.ok) for (const t of noPlays) t.plays = pop.data[t.videoId] || 0;
    }
    const last = this.queue[this.queue.length - 1] || this.cur?.track;
    const ref = this.ana.get(last?.videoId) || this.cur?.analysis || null;
    const ranked = rankCandidates({ ref, refTrack: last || null, cands: fresh.map((t) => ({ track: t, analysis: this.ana.get(t.videoId) })), popularity: this.cfg.popularity, popWeight: this.cfg.popWeight });
    return ranked.map((c) => c.track);
  }

  async ensureQueue(force = false) {
    if (this.filling || (!force && (this.queue.length >= 3 || performance.now() < this.failUntil))) return;
    if (!force && !this.cfg.endless && this.queue.length) return;
    this.filling = true;
    try {
      const seedTrack = this.queue[this.queue.length - 1] || this.cur?.track;
      if (!seedTrack) return;
      const cands = await this.radioCandidates(seedTrack);
      this.queue.push(...cands.slice(0, 8));
      this.radioPool = [...cands.slice(8), ...this.radioPool].slice(0, 30);
      if (!cands.length) throw new Error('la radio no devolvió pistas nuevas');
      this.note = '';
    } catch (e) {
      this.note = `Radio: ${String(e.message).includes('aún no cargó') ? 'YouTube Music todavía está cargando…' : e.message}`;
      this.failUntil = performance.now() + 6000;
    } finally {
      this.filling = false;
      this.emit();
    }
  }

  // ---------- agregar ----------
  isKnown(id) {
    return this.queue.some((t) => t.videoId === id) || this.cur?.track?.videoId === id || this.app.decks.A.track?.videoId === id || this.app.decks.B.track?.videoId === id;
  }

  // Agrega una pista. Analizada → va al hueco de menor coste de la cadena; sin analizar → al final, se analiza y se mueve sola.
  // { next: true } la pone la siguiente. Devuelve { ok, index, moved, reason }.
  addSmart(track, { next = false, analysis = null } = {}) {
    if (!track?.videoId) return { ok: false, reason: 'invalid' };
    if (this.isKnown(track.videoId)) {
      this.app.toast(`“${track.title || 'La pista'}” ya está en la cola o suena ahora.`, true);
      return { ok: false, reason: 'dup' };
    }
    const t = { ...track };
    if (analysis && !this.ana.get(t.videoId)) this.ana.set(t.videoId, analysis);
    if (next) {
      this.insertNext(t);
      this.note = `“${t.title}” suena a continuación`;
      this.emit();
      return { ok: true, index: 0 };
    }
    const a = this.ana.get(t.videoId);
    if (a?.bpm) {
      const curAna = this.cur ? { ...(this.cur.analysis || this.ana.get(this.cur.track?.videoId) || {}) } : null;
      const head = this.queue[0];
      const lock = head && (this.loadingNext || (this.cur && this.app.other(this.cur).track?.videoId === head.videoId)) ? 1 : 0;
      const r = bestInsertion({ cur: curAna?.bpm ? curAna : null, queue: this.queue, track: t, analysisOf: (x) => this.ana.get(x.videoId), lock });
      this.queue.splice(r.index, 0, t);
      this.note = `“${t.title}” quedó en la posición ${r.index + 1} de ${this.queue.length} (la que mejor encaja)`;
      this.prepareAhead();
      this.emit();
      return { ok: true, index: r.index };
    }
    this.queue.push(t);
    this.moves.set(t.videoId, { from: this.queue.length });
    this.note = `“${t.title}” agregada al final: la analizo para ver dónde encaja`;
    this.loadAna(t);
    this.prepareAhead();
    this.emit();
    return { ok: true, index: this.queue.length - 1, pending: true };
  }

  // Cuando llega el análisis de una agregada sin analizar: dónde quedó (y de dónde se movió).
  settleMoves() {
    for (const [id, m] of [...this.moves]) {
      if (!this.ana.get(id)?.bpm) continue;
      const to = this.queue.findIndex((t) => t.videoId === id);
      this.moves.delete(id);
      if (to < 0) continue;
      const title = this.queue[to].title;
      this.note = to + 1 === m.from ? `“${title}” analizada: ya estaba en su mejor lugar (posición ${to + 1})` : `“${title}” analizada: movida de ${m.from} a ${to + 1}`;
    }
  }

  // ---------- sugeridas: qué iría a continuación ----------
  async refreshPools() {
    const now = performance.now();
    if (now - this.libPoolAt > 60000) {
      this.libPoolAt = now;
      try {
        const list = (await window.ytdj.analysis.list()) || [];
        this.libPool = list.filter((a) => a.bpm && a.id && !a.ytId).map((a) => {
          if (!this.ana.get(a.id)) this.ana.set(a.id, a);
          return { videoId: a.id, title: a.title || a.id, artist: a.artist || '', thumb: a.thumb || '', duration: a.trackDuration || a.duration || 0, local: !!a.local };
        });
      } catch {}
    }
    const seed = this.queue[this.queue.length - 1] || this.cur?.track;
    if (seed && now - this.poolAt > 60000 && !this.poolBusy) {
      this.poolAt = now;
      this.poolBusy = true;
      try {
        const cands = await this.radioCandidates(seed);
        const have = new Set(this.radioPool.map((t) => t.videoId));
        this.radioPool = [...cands.filter((t) => !have.has(t.videoId)), ...this.radioPool].slice(0, 30);
      } catch {}
      this.poolBusy = false;
    }
    this.emit();
  }

  suggestions(limit = 6) {
    const last = this.queue[this.queue.length - 1] || this.cur?.track;
    const ref = this.ana.get(last?.videoId) || this.cur?.analysis || null;
    const seen = new Set();
    const cands = [...this.radioPool, ...this.libPool]
      .filter((t) => !this.isKnown(t.videoId) && !this.history.has(t.videoId) && !seen.has(t.videoId) && seen.add(t.videoId))
      .map((t) => ({ track: t, analysis: this.ana.get(t.videoId) }));
    const ranked = rankCandidates({ ref, refTrack: last || null, cands, popularity: this.cfg.popularity, popWeight: this.cfg.popWeight });
    return ranked.slice(0, limit).map((c) => ({ track: c.track, cost: c.cost, fits: c.fits, plays: c.track.plays || 0, analyzed: !!c.analysis?.bpm, popBonus: c.popBonus }));
  }

  // Analiza en segundo plano (solo analiza, no guarda) las mejores sugeridas que aún no tienen BPM, de a una.
  analyzeSuggestions(list) {
    if (!this.cfg.analyze || this.suggestBusy.size >= 1) return;
    const busy = [...this.prep.values()].filter((p) => ['queued', 'download', 'analyze'].includes(p.state)).length;
    if (busy >= 2) return;
    const c = list.slice(0, 3).find((s) => !s.analyzed && !s.track.local && !this.suggestBusy.has(s.track.videoId) && !this.suggestTried?.has(s.track.videoId));
    if (!c) return;
    (this.suggestTried ??= new Set()).add(c.track.videoId);
    this.suggestBusy.add(c.track.videoId);
    window.ytdj.analysis.request(c.track.videoId, { meta: { title: c.track.title, artist: c.track.artist, thumb: c.track.thumb, trackDuration: c.track.duration }, save: false });
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
    const p = this.prep.get(track.videoId);
    return !p || p.state === 'checking' ? { state: 'idle' } : p;
  }

  // Analiza y guarda TODA la cola (no solo las próximas), de a 2 a la vez y en el orden de la cola.
  // Las pistas ya guardadas quedan listas al instante y no ocupan uno de los 2 puestos.
  prepareAhead(n = Infinity, maxParallel = 2) {
    for (const t of this.queue) this.loadAna(t);
    if (!this.cfg.preferLocal) return;
    for (const t of this.queue) {
      if (t.local || this.prep.has(t.videoId)) continue;
      this.prep.set(t.videoId, { state: 'checking' });
      window.ytdj.analysis.get(t.videoId).then((a) => {
        if (this.prep.get(t.videoId)?.state !== 'checking') return;
        this.setPrep(t.videoId, a?.saved ? { state: 'ready' } : { state: 'idle' });
        this.prepareAhead(n, maxParallel);
      });
    }
    const busy = () => [...this.prep.values()].filter((p) => ['queued', 'download', 'analyze'].includes(p.state)).length;
    let started = 0;
    for (const t of this.queue) {
      if (started >= n || busy() >= maxParallel) break;
      if (this.prep.get(t.videoId)?.state !== 'idle') continue;
      started++;
      this.prep.set(t.videoId, { state: 'queued' });
      window.ytdj.analysis.request(t.videoId, { meta: { title: t.title, artist: t.artist, thumb: t.thumb, trackDuration: t.duration }, save: true });
    }
  }

  setPrep(id, p) {
    this.prep.set(id, p);
    this.emit();
  }

  onAnalysis(ev) {
    if (ev.stage === 'mixedit') {
      const a = this.ana.get(ev.id);
      if (a) a.mixEdit = ev.mixEdit || undefined;
      this.emit();
      return;
    }
    if (ev.stage === 'error') this.suggestBusy.delete(ev.id);
    if (ev.stage === 'done' && ev.analysis) {
      if (!ev.analysis.mixEdit && this.ana.get(ev.id)?.mixEdit) ev.analysis.mixEdit = this.ana.get(ev.id).mixEdit;
      this.ana.set(ev.id, ev.analysis);
      this.suggestBusy.delete(ev.id);
      if (this.queue.some((t) => t.videoId === ev.id)) this.reorder({ force: true });
      this.settleMoves();
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

  // Ordena la cola como una cadena (BPM suave, tonalidad, energía) a partir de lo que suena, respetando lo fijado a mano
  // y la pista que ya se está precargando. Con `manual` ignora el interruptor y la regla de «al menos 3 analizadas».
  reorder({ force = false, manual = false } = {}) {
    if (this.queue.length < 2 || this.trans) return false;
    if (!manual && !this.cfg.smartOrder) return false;
    const now = performance.now();
    if (!force && !manual && now - this.lastReorder < 1500) return false;
    this.lastReorder = now;
    const curAna = this.cur ? { ...(this.cur.analysis || this.ana.get(this.cur.track?.videoId) || {}) } : null;
    const analysisOf = (t) => this.ana.get(t.videoId);
    const analyzed = this.queue.filter((t) => analysisOf(t)?.bpm).length;
    if (!manual && analyzed < 3) return false;
    const pins = new Set(manual ? [] : this.pinned); // «Reorganizar ahora» suelta lo fijado por reordenar a mano
    const head = this.queue[0];
    const other = this.cur ? this.app.other(this.cur) : null;
    if (head && (this.loadingNext || other?.track?.videoId === head.videoId)) pins.add(head.videoId); // ya se está preparando para sonar
    const r = orderChain({ cur: curAna?.bpm ? curAna : null, queue: this.queue, analysisOf, pinned: pins });
    this.chain = { cost: r.cost, scores: r.scores };
    if (!r.moved) return false;
    this.undoStack = this.queue.slice();
    this.queue = r.queue;
    this.emit();
    return true;
  }

  // Botón «Reorganizar ahora»: ordena aunque el interruptor esté apagado y suelta lo que el orden manual había fijado.
  reorganizeNow() {
    const moved = this.reorder({ manual: true });
    if (!moved) this.note = 'La cola ya está en el mejor orden que encuentro.';
    this.emit();
    return moved;
  }

  undoReorder() {
    if (!this.undoStack) return false;
    const ids = new Set(this.queue.map((t) => t.videoId));
    const prev = this.undoStack.filter((t) => ids.has(t.videoId));
    const extra = this.queue.filter((t) => !prev.some((p) => p.videoId === t.videoId));
    this.queue = [...prev, ...extra];
    this.undoStack = null;
    for (const t of this.queue) this.pinned.add(t.videoId); // lo que se deshace queda como lo dejó el usuario
    this.emit();
    return true;
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
    // «Mezclar ahora»: espera a la siguiente lista, elige la salida más cercana y arranca al llegar a ella.
    if (this.pendingMix && head) {
      if (this.ready(next, head)) {
        const pm = this.pendingMix;
        if (!pm.plan) pm.plan = this.makeNearestPlan(cur, next, head);
        if (!cur.st.playing || pm.plan.kind === 'now' || posOf(cur) >= pm.plan.exitAt - 0.02) {
          this.pendingMix = false;
          this.startTransition(cur, next, pm.plan);
        } else this.emit(); // la cuenta atrás de la vista
      }
      return;
    }
    if (!cur.st.playing || !head) return; // pausado a mano o sin siguiente
    const rem = cur.remaining();
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
  // Plan de «Mezclar ahora»: la salida y la entrada más cercanas (frase de 8 beats, punto de la pista o editado).
  makeNearestPlan(cur, next, head) {
    const curAna = { ...(cur.analysis || this.ana.get(cur.track?.videoId) || {}) };
    curAna.duration = curAna.duration || cur.st.dur || cur.track?.duration || 0;
    const nextAna = (next.track?.videoId === head.videoId && next.analysis) || this.ana.get(head.videoId) || {};
    return planNearest(curAna, nextAna, { pos: posOf(cur), len: this.cfg.len });
  }

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
    if (this.pendingMix) return this.cancelMix(); // una segunda pulsación cancela
    const idx = this.queue.findIndex((t) => this.isReady(t));
    if (idx > 0) this.move(idx, 0);
    if (idx < 0) this.app.toast('La siguiente pista todavía se está preparando; se mezclará en cuanto esté lista.');
    this.pendingMix = { plan: null };
    this.emit();
  }

  cancelMix() {
    this.pendingMix = false;
    this.note = 'Mezcla cancelada';
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
    let prevAna = curAna;
    const items = this.queue.map((tr) => {
      const a = tr.local || this.ana.get(tr.videoId) ? this.ana.get(tr.videoId) : null;
      const g = bpmGap(curAna?.bpm, a?.bpm);
      const cost = prevAna?.bpm && a?.bpm ? edgeCost(prevAna, a) : null;
      prevAna = a?.bpm ? a : prevAna;
      return {
        cost: cost == null ? null : Math.round(cost * 10) / 10,
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
      suggestions: this.suggestions(),
      chain: { canUndo: !!this.undoStack, total: items.reduce((x, i) => x + (i.cost || 0), 0), analyzed: items.filter((i) => i.bpm).length },
      plan: this.plan ? { exitAt: this.plan.exitAt, kind: this.plan.kind, seconds: this.plan.seconds, warnings: this.plan.warnings, tempo: this.plan.tempo } : null,
      pos: this.cur ? posOf(this.cur) : null,
      trans: t ? { from: t.from.id, to: t.to.id, progress: Math.min(1, (performance.now() - t.t0) / 1000 / t.len), tempo: t.tempo, style: t.style, len: t.len, warnings: t.warnings } : null,
      progress: t ? Math.min(1, (performance.now() - t.t0) / 1000 / t.len) : null,
      rem: this.cur ? this.cur.remaining() : null,
      pendingMix: this.pendingMix ? { ready: !!this.pendingMix.plan, kind: this.pendingMix.plan?.kind || null, waitS: this.pendingMix.plan && this.cur ? Math.max(0, this.pendingMix.plan.exitAt - posOf(this.cur)) : null, seconds: this.pendingMix.plan?.seconds ?? null } : null,
      cfg: { ...this.cfg },
      note: this.note,
    };
  }
}
