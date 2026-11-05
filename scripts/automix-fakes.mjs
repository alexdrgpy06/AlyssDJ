// Entorno simulado del motor de AutoMix para pruebas puras (sin Electron): decks falsos, análisis y red controlables.
export const net = { radio: [], listeners: [] };
export const T = (id, o = {}) => ({ videoId: id, title: id, artist: 'x', ...o });
export const ana = (bpm, camelot = '8A', o = {}) => ({ bpm, camelot, offset: 0, duration: 240, mix: { mixIn: 8, mixOut: [{ t: 200, score: 1 }], phrases: new Array(20).fill(60), phraseBeats: 16 }, ...o });

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { ytdj: { analysis: { onEvent: (cb) => net.listeners.push(cb), get: async () => null, request() {}, list: async () => [] },
  lib: { radio: async () => ({ ok: true, data: net.radio }), search: async () => ({ ok: true, data: [] }), popularity: async () => ({ ok: true, data: {} }) } } };
const { AutoMix } = await import('../renderer/automix.js');

export const fakeDeck = (id) => ({ id, fxc: { slots: [{ on: false }, { on: false }, { on: false }], owners: [], set() {}, ramp() {} }, fxSet() {}, fxRamp() {}, track: null, pos: 0, pitch: 0, loop: null, syncLock: false, analyzing: null, analysis: null, st: { playing: false, dur: 240 }, seeks: [],
  async load(t) { this.track = t; this.st = { playing: false, dur: 240, ready: true, videoId: t.videoId }; }, togglePlay() { this.st.playing = true; }, remaining() { return this.st.dur - this.pos; }, bpm() { return this.analysis?.bpm || null; },
  setLoop() {}, matchTempoSmart: () => true, alignPhase() {}, phaseDiff: () => null, setPitch() {}, analyze() {}, seek(t) { this.seeks.push(t); this.pos = t; }, transport() {} });

// A suena con `curTrack`; B puede traer una pista. Devuelve { am, A, B, app, toasts }.
export function engine({ cur = T('a'), curAna = ana(124, '8A'), b = null, bAna = null } = {}) {
  const A = fakeDeck('A'), B = fakeDeck('B'); const toasts = [];
  const app = { decks: { A, B }, other: (d) => (d === A ? B : A), toast: (m) => toasts.push(m), xfader: { value: 0 }, applyXf() {}, localMode: false };
  const am = new AutoMix(app); am.cfg.endless = false;
  A.track = cur; A.analysis = curAna; A.st = { playing: true, dur: 240, ready: true, videoId: cur.videoId }; am.ana.set(cur.videoId, curAna);
  if (b) { B.track = b; B.analysis = bAna; B.st = { playing: false, dur: 240, ready: true, videoId: b.videoId }; if (bAna) am.ana.set(b.videoId, bAna); }
  return { am, A, B, app, toasts };
}
