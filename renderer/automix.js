// AutoMix: DJ automático. La cola sale de una lista o de la "radio" de YouTube Music (pistas parecidas a la actual);
// la siguiente se precarga en el deck libre y se mezcla sola: tempo y fase igualados (si hay BPM), fundido, bass swap o filtro.
import { controls } from './controls.js';

const LS = 'alyssdj:automix';
const side = (id) => (id === 'A' ? -1 : 1);
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
    this.cfg = { len: 16, style: 'bass', matchTempo: true, analyze: false, endless: true };
    try {
      Object.assign(this.cfg, JSON.parse(localStorage.getItem(LS) || '{}'));
    } catch {}
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
  remove(i) {
    this.queue.splice(i, 1);
    this.emit();
  }
  clear() {
    this.queue = [];
    this.emit();
  }
  move(i, to) {
    if (to < 0 || to >= this.queue.length) return;
    this.queue.splice(to, 0, this.queue.splice(i, 1)[0]);
    this.emit();
  }

  // ---------- cola (radio de YouTube Music) ----------
  async ensureQueue() {
    if (this.filling || this.queue.length >= 3 || performance.now() < this.failUntil) return;
    if (!this.cfg.endless && this.queue.length) return;
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

  // ---------- bucle ----------
  ready(deck, track) {
    return !!track && deck.track?.videoId === track.videoId && deck.st.videoId === track.videoId && deck.st.dur > 0 && !!deck.st.ready && !deck.st.ad;
  }

  async preload(next) {
    const t = this.queue[0];
    this.loadingNext = true;
    try {
      await next.load(t, { play: false, force: true });
      if (this.cfg.analyze && !t.local && !next.analysis) next.analyze();
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
    const head = this.queue[0];
    if (head && !this.loadingNext && !next.st.playing && next.track?.videoId !== head.videoId) this.preload(next);
    if (!cur.st.playing || !head) return; // pausado a mano o sin siguiente
    const rem = cur.remaining();
    const lead = this.cfg.len + 1.2;
    if (rem > lead) return;
    const waitingAnalysis = this.cfg.analyze && next.analyzing && rem > 25;
    if (this.ready(next, head) && !waitingAnalysis) this.startTransition(cur, next, this.cfg.len);
    else if (rem <= 1.2 && this.ready(next, head)) this.startTransition(cur, next, 2);
  }

  skip() {
    if (!this.on || this.trans || !this.cur) return;
    const next = this.app.other(this.cur);
    if (this.ready(next, this.queue[0])) this.startTransition(this.cur, next, Math.min(this.cfg.len, 6));
    else this.app.toast('La siguiente pista todavía se está cargando…');
  }

  startTransition(from, to, len) {
    if (from.loop) from.setLoop(null);
    to.setLoop(null);
    let tempo = false;
    if (this.cfg.matchTempo && from.bpm() && to.bpm()) {
      tempo = to.matchTempoSmart(from);
      if (tempo) to.alignPhase(from);
    }
    to.wantPlay = true;
    to.transport({ type: 'play' });
    const style = this.cfg.style;
    this.knob(to, 'eqLow', style === 'bass' ? -1 : 0);
    this.knob(to, 'filter', style === 'filter' ? 0.85 : 0);
    this.trans = { from, to, len, t0: performance.now(), tempo, style, lastPhase: 0, swapped: false };
    this.note = `Mezclando ${from.id} → ${to.id}${tempo ? ' (tempo igualado)' : ''}`;
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
    this.queue.shift();
    this.cur = to;
    this.setX(side(to.id));
    this.glideTempoHome(to);
    this.note = '';
    this.emit();
  }

  // Tras mezclar, el tempo vuelve poco a poco al original de la pista para no acumular desvío entre pistas.
  glideTempoHome(deck, ms = 12000) {
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
    return {
      on: this.on,
      cur: this.cur?.track || null,
      next: this.queue[0] || null,
      nextReady: !!next && this.ready(next, this.queue[0]),
      queue: this.queue,
      progress: this.trans ? Math.min(1, (performance.now() - this.trans.t0) / 1000 / this.trans.len) : null,
      rem: this.cur ? this.cur.remaining() : null,
      note: this.note,
    };
  }
}
