import { register } from './controls.js';
import { makeKnob } from './knob.js';
import { analysisWave, liveWave, recordLive, drawScroll, drawOverview } from './waveform.js';
import { camelotColor } from './camelot.js';

const fmt = (t) => {
  const s = Math.max(0, t || 0);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
const setText = (el, s) => {
  if (el.textContent !== s) el.textContent = s;
};
// Portada propia para pistas sin carátula: degradado por título con anillos de vinilo e iniciales.
const coverCache = new Map();
function generatedCover(track) {
  const key = track.videoId || track.title || '';
  if (coverCache.has(key)) return coverCache.get(key);
  let h = 0;
  for (const ch of `${track.title}|${track.artist}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(90, 80, 10, 128, 128, 190);
  bg.addColorStop(0, `hsl(${hue} 75% 52%)`);
  bg.addColorStop(1, `hsl(${(hue + 50) % 360} 70% 16%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,.10)';
  g.lineWidth = 2;
  for (let r = 30; r < 190; r += 14) (g.beginPath(), g.arc(128, 128, r, 0, Math.PI * 2), g.stroke());
  const words = String(track.title || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
  const initials = ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || '♪';
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = '700 84px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(initials, 128, 132);
  const url = c.toDataURL('image/jpeg', 0.85);
  coverCache.set(key, url);
  return url;
}

const PITCH_RANGES = [6, 8, 16, 50];
const TRACK_KEY = (id) => `ytdj:track:${id}`;

export class Deck {
  constructor(id, app) {
    this.id = id;
    this.app = app;
    this.track = null;
    this.analysis = null;
    this.analyzing = null;
    this.source = 'stream';
    this.st = { pos: 0, dur: 0, playing: false, rate: 1, level: 0 };
    this.stAt = performance.now();
    this.wantPlay = false;
    this.pitch = 0;
    this.range = app.settings.pitchRange || 8;
    this.keylock = true;
    this.quantize = true;
    this.cuePoint = 0;
    this.cuePreview = false;
    this.hotcues = [null, null, null, null];
    this.loop = null;
    this.lastLoop = null;
    this.loopIn = null;
    this.syncLock = false;
    this.taps = [];
    this.tap = null; // { bpm, offset } cuando no hay análisis
    this.mix = { trim: 0, low: 0, mid: 0, high: 0, filter: 0, fader: 1, pfl: false };
    this.xf = 1;
    this.local = null;
    this.ovCache = {};
    this.trimTouched = false;
    this.fx = { on: false, type: 'echo', wet: 0.5, div: 0.75 };
    this.playedMs = 0;
    this.lastRender = performance.now();
    this.logged = false;
    this.streamPlayedMs = 0;
    this.saveRequested = false;
    this.zoom = 1;
    this.roll = null;
    this.lastFxBpm = 0;
    this.buildDeck();
  }

  // ---------- motores ----------
  sendStream(cmd) {
    window.ytdj.deck.cmd(this.id, cmd);
  }
  sendLocal(cmd) {
    this.local?.engine.handle(cmd);
  }
  transport(cmd) {
    if (this.source === 'local') this.sendLocal(cmd);
    else this.sendStream(cmd);
  }
  broadcast(cmd) {
    this.sendStream(cmd);
    this.sendLocal(cmd);
  }

  ensureLocal() {
    if (this.local) return this.local;
    const audio = new Audio();
    audio.preload = 'auto';
    const meta = { videoId: null, title: '', author: '', ready: false };
    const adapter = {
      async load(cmd, eng) {
        eng.attach(audio);
        meta.videoId = cmd.videoId;
        meta.ready = false;
        audio.src = cmd.url || `/cache/${encodeURIComponent(cmd.file)}`;
        await new Promise((res, rej) => {
          audio.addEventListener('loadedmetadata', res, { once: true });
          audio.addEventListener('error', () => rej(new Error('No se pudo abrir el audio local')), { once: true });
        });
        audio.currentTime = cmd.startAt || 0;
        meta.ready = true;
        if (cmd.play) await eng.handle({ type: 'play' });
      },
      meta: () => ({ ...meta, source: 'local' }),
    };
    const engine = window.YTDJEngine.createDeckEngine({
      adapter,
      onState: (s) => this.source === 'local' && this.applyState(s),
    });
    this.local = { engine, audio };
    engine.handle({ type: 'routing', ...this.app.routing() });
    engine.handle({ type: 'rate', rate: this.rate(), keylock: this.keylock });
    this.pushMix();
    return this.local;
  }

  onStreamState(s) {
    if (s.error) this.app.toast(`Deck ${this.id}: ${s.error}`, true);
    if (this.source === 'stream') this.applyState(s);
  }

  applyState(s) {
    this.st = s;
    this.stAt = performance.now();
    if (!this.track) return;
    if (!this.track.title && s.title) {
      this.track.title = s.title;
      this.track.artist = s.author;
    }
    // Sin Premium YT Music mete anuncios: su duración y posición no son de la pista.
    if (s.ad) return;
    if (s.dur && !this.track.duration) this.track.duration = s.dur;
    if (!this.analysis && s.dur && (!this.wave || this.wave.kind !== 'live' || this.wave.level.length < s.dur * 20)) {
      this.wave = liveWave(s.dur);
    }
    if (s.playing) recordLive(this.wave, s.pos, s.level);
  }

  // Una pista de YouTube que lleva 30 s sonando por streaming se guarda y analiza en segundo plano (si el ajuste está activo).
  tickSaveOnPlay(dtMs) {
    if (!this.track || this.track.local || this.source !== 'stream' || !this.st.playing || this.st.ad || this.saveRequested) return;
    if (this.app.settings.saveOnPlay === false) return;
    if (this.analysis?.saved) return void (this.saveRequested = true);
    this.streamPlayedMs += dtMs;
    if (this.streamPlayedMs < 30000) return;
    this.saveRequested = true;
    const { videoId, title, artist, thumb, duration } = this.track;
    this.analyzing = { stage: 'queued' };
    window.ytdj.analysis.request(videoId, { meta: { title, artist, thumb, trackDuration: duration }, save: true });
  }

  // ---------- tiempo, tempo y grid ----------
  pos() {
    const s = this.st;
    let p = s.pos;
    if (s.playing) p += ((performance.now() - this.stAt) / 1000) * (s.rate || 1);
    return s.dur ? Math.min(p, s.dur) : p;
  }
  rate() {
    return 1 + (this.pitch * this.range) / 100;
  }
  bpm() {
    return this.analysis?.bpm || this.tap?.bpm || null;
  }
  effBpm() {
    const b = this.bpm();
    return b ? b * this.rate() : null;
  }
  beats() {
    if (this.analysis?.bpm) return { bpm: this.analysis.bpm, offset: this.analysis.offset + (this.analysis.gridShift || 0) };
    if (this.tap) return { bpm: this.tap.bpm, offset: this.tap.offset };
    return null;
  }
  beatLen() {
    const b = this.beats();
    return b ? 60 / b.bpm : null;
  }
  phase(t = this.pos()) {
    const b = this.beats();
    if (!b) return null;
    const len = 60 / b.bpm;
    return ((((t - b.offset) / len) % 1) + 1) % 1;
  }
  snap(t, mode = 'round') {
    const b = this.beats();
    if (!this.quantize || !b) return t;
    const len = 60 / b.bpm;
    return b.offset + Math[mode]((t - b.offset) / len) * len;
  }

  // ---------- canal / mezcla ----------
  channelGain() {
    const f = this.mix.fader;
    return f * f * this.xf * this.app.masterGain;
  }
  isAudible() {
    return this.channelGain() > 0.05;
  }
  pushMix() {
    const { trim, low, mid, high, filter, pfl } = this.mix;
    this.lastFxBpm = this.effBpm() || 0;
    this.broadcast({
      type: 'mix', trim, low, mid, high, filter, pfl: pfl ? this.app.cueVol : 0, fader: this.channelGain(),
      fxType: this.fx.type, fxWet: this.fx.on ? this.fx.wet : 0, fxDiv: this.fx.div, bpm: this.lastFxBpm || 120,
    });
  }
  setMix(patch) {
    Object.assign(this.mix, patch);
    this.pushMix();
  }

  // ---------- carga y fuente ----------
  async load(track, { play = false, force = false } = {}) {
    if (!force && this.st.playing && this.isAudible()) {
      this.app.toast(`Deck ${this.id} está al aire. Páusalo o baja su canal para cargar otra pista.`, true);
      return;
    }
    this.sendLocal({ type: 'pause' });
    this.source = track.local ? 'local' : 'stream';
    this.track = { ...track };
    this.analysis = await window.ytdj.analysis.get(track.videoId);
    this.analyzing = null;
    this.wave = this.analysis ? analysisWave(this.analysis) : null;
    this.tap = null;
    this.taps = [];
    this.loop = this.lastLoop = null;
    this.loopIn = null;
    this.syncLock = false;
    const saved = JSON.parse(localStorage.getItem(TRACK_KEY(track.videoId)) || '{}');
    this.cuePoint = saved.cue ?? (this.analysis ? Math.max(0, this.analysis.offset + (this.analysis.gridShift || 0)) : 0);
    this.hotcues = saved.hot || [null, null, null, null];
    this.st = { pos: this.cuePoint, dur: track.duration || 0, playing: false, rate: this.rate(), level: 0 };
    this.wantPlay = play;
    this.broadcast({ type: 'loop' });
    this.playedMs = 0;
    this.logged = false;
    this.streamPlayedMs = 0;
    this.saveRequested = false;
    const savedId = !track.local && this.analysis?.saved?.localId;
    if (savedId) this.source = 'local'; // ya está guardada: se reproduce el archivo, sin streaming ni anuncios
    if (track.local || savedId) {
      this.sendStream({ type: 'pause' });
      const { engine } = this.ensureLocal();
      engine.handle({ type: 'load', videoId: track.videoId, url: `/localfile/${encodeURIComponent(savedId || track.videoId)}`, startAt: this.cuePoint, play })
        .catch((e) => this.app.toast(`No se pudo abrir ${track.title}: ${e.message}`, true));
    } else this.sendStream({ type: 'load', videoId: track.videoId, startAt: this.cuePoint, play });
    this.trimTouched = false;
    this.applyAutoGain();
    // Las pistas locales se analizan solas (no cuesta descargar nada); las de YouTube solo si se pidió.
    if (!this.analysis) {
      if (track.local ? this.app.settings.autoAnalyzeLocal !== false : this.app.settings.autoAnalyzeCue && !this.isAudible()) this.analyze();
    }
    this.app.onDeckLoaded(this);
  }

  async setSource(src) {
    if (!this.track || src === this.source) return;
    if (this.track.local) return this.app.toast('Es una pista local: solo se puede reproducir desde el archivo.');
    const savedId = this.analysis?.saved?.localId;
    if (src === 'local' && !this.analysis?.audio && !savedId) {
      this.app.toast('Esta pista no está guardada: analízala (o actívalo en Ajustes → Guardar en la librería) y podrás reproducir el archivo.', true);
      return;
    }
    const pos = this.pos();
    const playing = this.st.playing;
    if (src === 'local') {
      const { engine } = this.ensureLocal();
      this.sendStream({ type: 'pause' });
      this.source = 'local';
      await engine.handle({ type: 'load', videoId: this.track.videoId, file: this.analysis.audio, url: savedId ? `/localfile/${encodeURIComponent(savedId)}` : undefined, startAt: pos, play: playing });
    } else {
      this.sendLocal({ type: 'pause' });
      this.source = 'stream';
      this.sendStream({ type: 'seek', t: pos });
      if (playing) this.sendStream({ type: 'play' });
    }
    if (this.loop) this.broadcast({ type: 'loop', ...this.loop });
  }

  saveCues() {
    if (this.track) localStorage.setItem(TRACK_KEY(this.track.videoId), JSON.stringify({ cue: this.cuePoint, hot: this.hotcues }));
  }

  // ---------- análisis ----------
  analyze() {
    if (!this.track) return;
    if (this.analyzing) return window.ytdj.analysis.cancel(this.track.videoId);
    const { videoId, title, artist, thumb, duration, local, path } = this.track;
    this.analyzing = { stage: 'queued' };
    window.ytdj.analysis.request(videoId, { meta: { title, artist, thumb, trackDuration: duration }, file: local ? path : undefined });
  }

  onAnalysisEvent(ev) {
    if (ev.id !== this.track?.videoId) return;
    if (ev.stage === 'mixedit') {
      if (this.analysis) this.analysis.mixEdit = ev.mixEdit || undefined;
      return;
    }
    if (ev.stage === 'done') {
      this.analyzing = null;
      if (ev.analysis && !ev.analysis.mixEdit && this.analysis?.mixEdit) ev.analysis.mixEdit = this.analysis.mixEdit; // reanalizar no borra lo editado
      this.setAnalysis(ev.analysis);
    } else if (ev.stage === 'error' || ev.stage === 'cancelled') {
      this.analyzing = null;
    } else this.analyzing = ev;
  }

  setAnalysis(a) {
    const hadGrid = !!this.beats();
    this.analysis = a;
    this.wave = analysisWave(a);
    this.tap = null;
    if (!hadGrid && !this.st.playing && this.pos() < 0.5) {
      this.cuePoint = Math.max(0, a.offset + (a.gridShift || 0));
    }
    this.applyAutoGain();
  }

  applyAutoGain() {
    if (this.trimTouched || this.analysis?.autoGainDb == null) return;
    this.trimKnob?.set(this.analysis.autoGainDb);
  }

  async shiftGrid(ms) {
    if (this.analysis) {
      const gridShift = (this.analysis.gridShift || 0) + ms / 1000;
      this.analysis.gridShift = gridShift;
      window.ytdj.analysis.setMeta(this.track.videoId, { gridShift });
    } else if (this.tap) this.tap.offset += ms / 1000;
  }

  // ---------- transporte ----------
  seek(t) {
    const dur = this.st.dur || this.track?.duration || Infinity;
    t = Math.max(0, Math.min(t, dur - 0.05));
    this.transport({ type: 'seek', t });
    this.st = { ...this.st, pos: t };
    this.stAt = performance.now();
  }

  togglePlay() {
    if (!this.track) return;
    if (this.st.playing || this.wantPlay) {
      this.wantPlay = false;
      this.transport({ type: 'pause' });
    } else {
      this.wantPlay = true;
      this.transport({ type: 'play' });
    }
  }

  // CUE estilo CDJ: sonando → vuelve al cue y pausa; en pausa sobre el cue → preview mientras se mantiene;
  // en pausa en otro punto → fija el cue ahí.
  cue(down) {
    if (!this.track) return;
    if (down) {
      if (this.st.playing && !this.cuePreview) {
        this.wantPlay = false;
        this.transport({ type: 'pause' });
        this.seek(this.cuePoint);
      } else if (Math.abs(this.pos() - this.cuePoint) < 0.08) {
        this.cuePreview = true;
        this.transport({ type: 'play' });
      } else {
        this.cuePoint = this.snap(this.pos());
        this.seek(this.cuePoint);
        this.saveCues();
      }
    } else if (this.cuePreview) {
      this.cuePreview = false;
      if (!this.wantPlay) {
        this.transport({ type: 'pause' });
        this.seek(this.cuePoint);
      }
    }
  }

  hotcue(i, del = false) {
    if (!this.track) return;
    if (del) this.hotcues[i] = null;
    else if (this.hotcues[i] == null) this.hotcues[i] = this.snap(this.pos());
    else {
      this.seek(this.hotcues[i]);
      if (!this.st.playing) {
        this.wantPlay = true;
        this.transport({ type: 'play' });
      }
    }
    this.saveCues();
  }

  setLoop(loop) {
    this.loop = loop;
    if (loop) this.lastLoop = loop;
    this.broadcast(loop ? { type: 'loop', ...loop } : { type: 'loop' });
  }

  loopBeats(n) {
    const len = this.beatLen();
    if (!len) return this.app.toast('Para loops por beats hace falta el BPM: analiza la pista o usa TAP.', true);
    if (this.loop?.beats === n) return this.setLoop(null);
    const start = this.loop ? this.loop.in : this.snap(this.pos(), 'floor');
    this.setLoop({ in: start, out: start + n * len, beats: n });
  }

  loopInPress() {
    this.loopIn = this.snap(this.pos());
  }
  loopOutPress() {
    const out = this.snap(this.pos());
    if (this.loopIn != null && out > this.loopIn + 0.05) this.setLoop({ in: this.loopIn, out });
  }
  loopExit() {
    if (this.loop) this.setLoop(null);
    else if (this.lastLoop) this.setLoop(this.lastLoop);
  }

  setPitch(p) {
    this.pitch = Math.max(-1, Math.min(1, p));
    this.broadcast({ type: 'rate', rate: this.rate(), keylock: this.keylock });
    this.el.pitchFader.value = this.pitch;
  }

  setRange(r) {
    const rate = this.rate();
    this.range = r;
    this.setPitch((rate - 1) * 100 / r);
  }

  matchTempo(other) {
    const target = other.effBpm() / this.bpm();
    const need = Math.abs(target - 1) * 100;
    if (need > this.range) this.range = PITCH_RANGES.find((r) => r >= need) || 50;
    this.setPitch(((target - 1) * 100) / this.range);
  }

  // Desfase de fase respecto de otro deck, en beats (-0.5..0.5). Positivo = este deck va atrasado.
  phaseDiff(other) {
    const pa = other.phase();
    const pb = this.phase();
    if (pa == null || pb == null) return null;
    let d = pa - pb;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    return d;
  }

  alignPhase(other) {
    const d = this.phaseDiff(other);
    if (d == null) return;
    const shift = d * this.beatLen();
    if (this.st.playing && Math.abs(shift) < 0.06) {
      const amount = Math.sign(shift) * 0.05;
      this.transport({ type: 'bend', amount, ms: (Math.abs(shift) / (this.rate() * 0.05)) * 1000 });
    } else this.seek(this.pos() + shift);
  }

  // Iguala el tempo al del otro deck; si están a doble/mitad de tempo, usa la relación más cercana.
  matchTempoSmart(other, maxPct = 12) {
    const ob = other.effBpm();
    const b = this.bpm();
    if (!ob || !b) return false;
    const ratios = [1, 2, 0.5].map((f) => (ob * f) / b);
    const r = ratios.reduce((best, c) => (Math.abs(c - 1) < Math.abs(best - 1) ? c : best));
    if (Math.abs(r - 1) * 100 > maxPct) return false;
    const need = Math.abs(r - 1) * 100;
    if (need > this.range) this.range = PITCH_RANGES.find((x) => x >= need) || 50;
    this.setPitch(((r - 1) * 100) / this.range);
    return true;
  }

  remaining() {
    const dur = this.st.dur || this.track?.duration || 0;
    return dur ? dur - this.pos() : Infinity;
  }

  sync() {
    const other = this.app.other(this);
    if (this.syncLock) {
      this.syncLock = false;
      return;
    }
    if (!this.bpm() || !other.bpm()) return this.app.toast('SYNC necesita BPM en ambos decks (Analizar o TAP).', true);
    this.syncLock = true;
    this.matchTempo(other);
    this.alignPhase(other);
  }

  nudge(dir, down) {
    this.transport({ type: 'bend', amount: down ? dir * 0.04 : 0 });
  }

  jog(delta) {
    if (!this.track) return;
    if (this.st.playing) this.transport({ type: 'bend', amount: Math.max(-0.3, Math.min(0.3, delta * 0.01)), ms: 80 });
    else this.seek(this.pos() + delta * 0.03);
  }

  // ---------- salto, roll, rejilla ----------
  jump(beats) {
    const len = this.beatLen();
    if (!this.track) return;
    if (!len) return this.app.toast('Beat jump necesita BPM: analiza la pista o usa TAP.', true);
    this.seek(this.pos() + beats * len);
  }

  // Loop roll: mientras se mantiene pulsado repite un trozo; al soltar, la pista sigue donde habría estado (slip).
  rollStart(beats) {
    const b = this.beats();
    if (!this.track || this.roll) return;
    if (!b) return this.app.toast('Loop roll necesita BPM: analiza la pista o usa TAP.', true);
    const unit = beats * (60 / b.bpm);
    const pos = this.pos();
    const start = b.offset + Math.floor((pos - b.offset) / unit) * unit;
    this.roll = { origin: pos, t0: performance.now(), rate: this.st.rate || 1, prev: this.loop, playing: this.st.playing };
    this.setLoop({ in: start, out: start + unit });
  }

  rollEnd() {
    const r = this.roll;
    if (!r) return;
    this.roll = null;
    this.setLoop(r.prev || null);
    if (r.playing) this.seek(r.origin + ((performance.now() - r.t0) / 1000) * r.rate);
  }

  loopScale(f) {
    if (!this.loop) return;
    const len = (this.loop.out - this.loop.in) * f;
    if (len < 0.02) return;
    this.setLoop({ in: this.loop.in, out: this.loop.in + len, beats: this.loop.beats ? this.loop.beats * f : undefined });
  }

  setGridHere() {
    const len = this.beatLen();
    if (!this.track || !len) return this.app.toast('Para fijar la rejilla hace falta BPM: analiza la pista o usa TAP.', true);
    const off = ((this.pos() % len) + len) % len;
    if (this.analysis) {
      let shift = off - this.analysis.offset;
      shift = ((((shift + len / 2) % len) + len) % len) - len / 2;
      this.analysis.gridShift = shift;
      window.ytdj.analysis.setMeta(this.track.videoId, { gridShift: shift });
    } else if (this.tap) this.tap.offset = off;
    this.app.toast(`Rejilla fijada en ${fmt(this.pos())}`);
  }

  setBank(bank) {
    this.el.root.querySelectorAll('.bank-tabs [data-b]').forEach((b) => b.classList.toggle('on', b.dataset.b === bank));
    this.el.root.querySelectorAll('.pane').forEach((p) => (p.hidden = p.dataset.pane !== bank));
  }

  tapTempo() {
    const now = performance.now();
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 8) this.taps.shift();
    if (this.taps.length < 4) return;
    const iv = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1) / 1000;
    let bpm = 60 / iv / (this.st.playing ? this.st.rate || 1 : 1);
    while (bpm < 70) bpm *= 2;
    while (bpm >= 180) bpm /= 2;
    if (!this.analysis?.bpm) this.tap = { bpm: Math.round(bpm * 10) / 10, offset: this.pos() % (60 / bpm) };
  }

  // ---------- UI ----------
  buildDeck() {
    const root = document.getElementById('deck-tpl').content.firstElementChild.cloneNode(true);
    document.getElementById(`deck-${this.id}`).append(root);
    const q = (s) => root.querySelector(s);
    const el = (this.el = {
      root,
      vid: q('.vid'),
      rot: q('.vid .rot'),
      cover: q('.vid .cover'),
      headCover: q('.head-cover'),
      ring: q('.ring-fg'),
      plTime: q('.pl-time'),
      plBpm: q('.pl-bpm'),
      title: q('.title'),
      artist: q('.artist'),
      bpm: q('.bpm-val'),
      bpmBox: q('.bpm'),
      key: q('.key'),
      pitchVal: q('.pitch-val'),
      overview: q('canvas.overview'),
      elapsed: q('.elapsed'),
      remain: q('.remain'),
      state: q('.state'),
      play: q('.play'),
      cue: q('.cue'),
      hcs: [...root.querySelectorAll('.hc')],
      loopBtns: [...root.querySelectorAll('.loops [data-beats]')],
      sync: q('.sync'),
      keylock: q('.keylock'),
      quant: q('.quant'),
      pitchFader: q('.pitch-fader'),
      range: q('.range'),
      analyze: q('.analyze'),
      srcBtns: [...root.querySelectorAll('.source button')],
      viewYtm: q('.view-ytm'),
      mixPoints: q('.mix-points'),
      scroll: document.getElementById(`scroll-${this.id}`),
      spin: q('.platter .spin'),
      platter: q('.platter'),
    });
    q('.deck-letter').textContent = this.id;
    q('.art-letter').textContent = this.id;
    const P = `deck${this.id}`;
    const hold = (btn, id, fn) => {
      btn.addEventListener('pointerdown', (e) => !this.app.learning && e.button === 0 && fn(true));
      btn.addEventListener('pointerup', () => !this.app.learning && fn(false));
      btn.addEventListener('pointerleave', (e) => e.buttons && fn(false));
      register(id, { kind: 'button', press: fn }, btn);
    };
    const click = (btn, id, fn) => {
      btn.addEventListener('click', (e) => !this.app.learning && fn(e));
      register(id, { kind: 'button', press: (down) => down && fn({}) }, btn);
    };

    click(el.play, `${P}.play`, () => this.togglePlay());
    hold(el.cue, `${P}.cue`, (d) => this.cue(d));
    el.hcs.forEach((b, i) => {
      click(b, `${P}.hotcue${i + 1}`, (e) => this.hotcue(i, e.shiftKey));
      b.addEventListener('contextmenu', () => this.hotcue(i, true));
    });
    el.loopBtns.forEach((b) => click(b, `${P}.loop${b.dataset.beats}`, () => this.loopBeats(Number(b.dataset.beats))));
    click(q('.loop-in'), `${P}.loopIn`, () => this.loopInPress());
    click(q('.loop-out'), `${P}.loopOut`, () => this.loopOutPress());
    click(q('.loop-exit'), `${P}.loopExit`, () => this.loopExit());
    click(el.sync, `${P}.sync`, () => this.sync());
    click(q('.tap'), `${P}.tap`, () => this.tapTempo());
    click(q('.grid-l'), `${P}.gridLeft`, () => this.shiftGrid(-5));
    click(q('.grid-r'), `${P}.gridRight`, () => this.shiftGrid(5));
    click(el.keylock, `${P}.keylock`, () => {
      this.keylock = !this.keylock;
      this.broadcast({ type: 'rate', rate: this.rate(), keylock: this.keylock });
    });
    click(el.quant, `${P}.quantize`, () => (this.quantize = !this.quantize));
    hold(q('.nudge-up'), `${P}.nudgeUp`, (d) => this.nudge(1, d));
    hold(q('.nudge-down'), `${P}.nudgeDown`, (d) => this.nudge(-1, d));
    click(el.range, `${P}.pitchRange`, () => this.setRange(PITCH_RANGES[(PITCH_RANGES.indexOf(this.range) + 1) % PITCH_RANGES.length]));
    click(el.analyze, `${P}.analyze`, () => this.analyze());
    el.srcBtns.forEach((b) => b.addEventListener('click', () => this.setSource(b.dataset.src)));
    root.querySelectorAll('.bank-tabs [data-b]').forEach((b) => b.addEventListener('click', () => this.setBank(b.dataset.b)));
    root.querySelectorAll('[data-jump]').forEach((b) => click(b, `${P}.jump${b.dataset.jump}`, () => this.jump(Number(b.dataset.jump))));
    root.querySelectorAll('[data-roll]').forEach((b) => hold(b, `${P}.roll${b.dataset.roll}`, (d) => (d ? this.rollStart(Number(b.dataset.roll)) : this.rollEnd())));
    click(q('.loop-half'), `${P}.loopHalf`, () => this.loopScale(0.5));
    click(q('.loop-double'), `${P}.loopDouble`, () => this.loopScale(2));
    click(q('.grid-set'), `${P}.gridSet`, () => this.setGridHere());
    // FX
    const fxOn = q('.fx-on');
    click(fxOn, `${P}.fxOn`, () => {
      this.fx.on = !this.fx.on;
      this.pushMix();
    });
    root.querySelectorAll('[data-fx]').forEach((b) =>
      click(b, `${P}.fx.${b.dataset.fx}`, () => {
        this.fx.type = b.dataset.fx;
        root.querySelectorAll('[data-fx]').forEach((x) => x.classList.toggle('on', x === b));
        this.pushMix();
      }),
    );
    const wet = q('.fx-wet');
    wet.addEventListener('input', () => {
      this.fx.wet = Number(wet.value);
      this.pushMix();
    });
    register(`${P}.fxWet`, { kind: 'range', setNorm: (n) => ((wet.value = n), (this.fx.wet = n), this.pushMix()) }, wet);
    q('.fx-div').addEventListener('change', (e) => {
      this.fx.div = Number(e.target.value);
      this.pushMix();
    });
    this.setBank('loop');
    el.viewYtm.addEventListener('click', () => this.app.toggleYtmView(this.id));
    el.mixPoints.addEventListener('click', () => this.app.editDeckPoints(this));

    el.pitchFader.addEventListener('input', () => {
      this.syncLock = false;
      this.setPitch(Number(el.pitchFader.value));
    });
    el.pitchFader.addEventListener('dblclick', () => this.setPitch(0));
    register(`${P}.pitch`, { kind: 'range', setNorm: (n) => this.setPitch(n * 2 - 1) }, el.pitchFader);
    register(`${P}.jog`, { kind: 'relative', nudge: (d) => this.jog(d) }, el.platter);

    // Jog: arrastrar en círculo. Sonando = pitch bend; en pausa = búsqueda fina.
    el.platter.addEventListener('pointerdown', (e) => {
      if (this.app.learning) return;
      el.platter.setPointerCapture(e.pointerId);
      const r = el.platter.getBoundingClientRect();
      const angle = (ev) => (Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
      let last = angle(e);
      const move = (ev) => {
        const a = angle(ev);
        let d = a - last;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        last = a;
        this.jog(d / 3);
      };
      const up = () => {
        el.platter.removeEventListener('pointermove', move);
        el.platter.removeEventListener('pointerup', up);
      };
      el.platter.addEventListener('pointermove', move);
      el.platter.addEventListener('pointerup', up);
    });

    el.overview.addEventListener('pointerdown', (e) => {
      const dur = this.st.dur || this.track?.duration;
      if (!dur) return;
      const r = el.overview.getBoundingClientRect();
      this.seek(((e.clientX - r.left) / r.width) * dur);
    });
    el.scroll.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) this.zoom = Math.max(0.35, Math.min(5, this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      else if (!this.st.playing) this.seek(this.pos() + Math.sign(e.deltaY) * 0.05);
    });

    root.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('application/x-ytdj-track') || e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        root.classList.add('drop');
      }
    });
    root.addEventListener('dragleave', () => root.classList.remove('drop'));
    root.addEventListener('drop', async (e) => {
      e.preventDefault();
      root.classList.remove('drop');
      const t = e.dataTransfer.getData('application/x-ytdj-track');
      if (t) return this.load(JSON.parse(t));
      const file = e.dataTransfer.files[0];
      if (file) {
        const r = await window.ytdj.local.register(window.ytdj.local.pathFor(file));
        if (r.ok) this.load(r.data);
        else this.app.toast(r.error, true);
      }
    });
  }

  buildChannel(chEl) {
    const P = `deck${this.id}`;
    chEl.innerHTML = `<div class="ch-head">${this.id}</div>`;
    const slot = () => chEl.appendChild(document.createElement('div'));
    const knob = (key, label, opts, ctl) => {
      const k = makeKnob(slot(), {
        label,
        ...opts,
        onChange: (v) => {
          if (key === 'trim') this.trimTouched = true;
          this.setMix({ [key]: v });
        },
      });
      register(`${P}.${ctl}`, { kind: 'range', setNorm: (n) => k.setNorm(n) }, k.el);
      return k;
    };
    this.trimKnob = knob('trim', 'TRIM', { min: -12, max: 12, value: 0, def: 0, format: (v) => (Math.abs(v) < 0.05 ? 'TRIM' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`) }, 'trim');
    knob('high', 'HI', {}, 'eqHigh');
    knob('mid', 'MID', {}, 'eqMid');
    knob('low', 'LOW', {}, 'eqLow');
    knob('filter', 'FILTER', {}, 'filter');
    const pfl = document.createElement('button');
    pfl.className = 'pfl';
    pfl.textContent = 'CUE';
    pfl.title = 'Escuchar en auriculares (PFL)';
    chEl.append(pfl);
    const togglePfl = () => {
      this.setMix({ pfl: !this.mix.pfl });
      pfl.classList.toggle('on', this.mix.pfl);
    };
    pfl.addEventListener('click', () => !this.app.learning && togglePfl());
    register(`${P}.pfl`, { kind: 'button', press: (d) => d && togglePfl() }, pfl);
    const fader = document.createElement('input');
    Object.assign(fader, { type: 'range', min: 0, max: 1, step: 0.001, value: 1, className: 'vfader' });
    fader.setAttribute('aria-label', `Volumen deck ${this.id}`);
    const row = document.createElement('div');
    row.className = 'fader-row';
    const vu = document.createElement('div');
    vu.className = 'vu';
    vu.innerHTML = '<i></i>';
    row.append(vu, fader);
    chEl.append(row);
    fader.addEventListener('input', () => this.setMix({ fader: Number(fader.value) }));
    register(`${P}.volume`, { kind: 'range', setNorm: (n) => ((fader.value = n), this.setMix({ fader: n })) }, fader);
    this.vu = vu.firstElementChild;
  }

  render() {
    const nowT = performance.now();
    if (this.st.playing && this.track && !this.logged) {
      this.playedMs += nowT - this.lastRender;
      if (this.playedMs > 20000) {
        this.logged = true;
        this.app.logHistory(this.track);
      }
    }
    this.tickSaveOnPlay(Math.min(nowT - this.lastRender, 1000));
    this.lastRender = nowT;
    const el = this.el;
    const t = this.track;
    const pos = this.pos();
    const dur = this.st.dur || t?.duration || 0;

    if (this.syncLock) {
      const other = this.app.other(this);
      if (other.effBpm() && this.bpm() && Math.abs(other.effBpm() - this.effBpm()) > 0.005) this.matchTempo(other);
    }

    setText(el.title, t ? t.title || 'Cargando…' : 'Arrastra o carga una pista');
    setText(el.artist, t ? t.artist || '' : '—');
    const thumb = t ? t.thumb || generatedCover(t) : null;
    for (const c of [el.cover, el.headCover]) if (c.getAttribute('src') !== thumb) thumb ? (c.src = thumb) : c.removeAttribute('src');
    const eb = this.effBpm();
    setText(el.bpm, eb ? eb.toFixed(1) : '—');
    el.bpmBox.classList.toggle('est', !this.analysis?.bpm && !!this.tap);
    setText(el.key, this.analysis?.camelot ? `${this.analysis.camelot} · ${this.analysis.key}` : '—');
    const kc = camelotColor(this.analysis?.camelot);
    if (kc) el.key.style.setProperty('--k', kc);
    else el.key.style.removeProperty('--k');
    el.ring.style.strokeDashoffset = dur ? String(100 - Math.min(100, (pos / dur) * 100)) : '100';
    setText(el.plTime, fmt(pos).replace(/\.\d$/, ''));
    setText(el.plBpm, eb ? `${eb.toFixed(1)} BPM` : '');
    const pct = (this.rate() - 1) * 100;
    setText(el.pitchVal, `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`);
    setText(el.range, `±${this.range}`);
    setText(el.elapsed, fmt(pos));
    setText(el.remain, `-${fmt(dur - pos)}`);
    const loading = t && this.source === 'stream' && this.st.videoId === t.videoId && !this.st.ready;
    setText(el.state, this.st.ad ? 'anuncio (sin Premium)' : loading ? 'cargando…' : this.track?.local ? 'ARCHIVO LOCAL' : this.source === 'local' ? 'LOCAL · GUARDADA' : this.analysis?.saved ? 'GUARDADA' : '');

    el.play.classList.toggle('on', this.st.playing);
    el.cue.classList.toggle('on', !this.st.playing && Math.abs(pos - this.cuePoint) < 0.08 && !!t);
    el.hcs.forEach((b, i) => {
      const set = this.hotcues[i] != null;
      b.classList.toggle('set', set);
      setText(b.lastElementChild, set ? fmt(this.hotcues[i]).replace(/\.\d$/, '') : 'CUE');
    });
    el.loopBtns.forEach((b) => b.classList.toggle('on', this.loop?.beats === Number(b.dataset.beats)));
    el.sync.classList.toggle('on', this.syncLock);
    this.el.root.querySelector('.fx-on').classList.toggle('on', this.fx.on);
    if (this.fx.on && Math.abs((this.effBpm() || 0) - this.lastFxBpm) > 0.2) this.pushMix();
    el.keylock.classList.toggle('on', this.keylock);
    el.quant.classList.toggle('on', this.quantize);
    el.srcBtns.forEach((b) => {
      b.classList.toggle('on', b.dataset.src === this.source);
      if (b.dataset.src === 'local') b.disabled = !(this.track?.local || this.analysis?.audio || this.analysis?.saved);
      if (b.dataset.src === 'stream') b.disabled = !!this.track?.local;
    });

    const a = this.analyzing;
    el.analyze.classList.toggle('busy', !!a);
    el.analyze.classList.toggle('done', !a && !!this.analysis);
    setText(
      el.analyze.querySelector('span'),
      a
        ? a.stage === 'download'
          ? `Bajando ${Math.round((a.progress || 0) * 100)}%`
          : a.stage === 'analyze'
            ? 'Analizando…'
            : 'En cola…'
        : this.analysis
          ? 'Analizado ✓'
          : 'Analizar',
    );
    el.analyze.disabled = !t;

    const angle = `rotate(${(pos * 200) % 360}deg)`;
    el.spin.style.transform = angle;
    el.rot.style.transform = angle;
    const level = this.st.playing ? Math.min(1, this.st.level || 0) : 0;
    if (this.vu) this.vu.style.height = `${Math.round(level * 100)}%`;

    const view = {
      wave: this.wave,
      pos,
      dur,
      beats: this.beats(),
      cuePoint: t ? this.cuePoint : null,
      hotcues: this.hotcues,
      loop: this.loop,
      zoom: this.zoom,
      mixMarks: this.analysis?.mix ? { in: this.analysis.mix.mixIn, outroStart: this.analysis.mix.outroStart, outs: this.analysis.mix.mixOut.slice(0, 3).map((c) => c.t) } : null,
    };
    drawScroll(el.scroll, view);
    drawOverview(el.overview, view, this.ovCache);
  }
}
