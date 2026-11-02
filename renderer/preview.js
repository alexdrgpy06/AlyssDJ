// Preescucha de la Librería: una sola pista a la vez, por los auriculares, sin pasar por los decks ni por el master.
// Usa el archivo local de la pista (nunca descarga nada); el modelo (`startAt`) es puro y se prueba sin audio.
import { fileUrl } from './mixpreview.js';

// Segundo donde empieza: punto de entrada de mezcla (o inicio de la rejilla) si cae dentro de la pista; si no, el 25 %.
export function startAt(ana, duration) {
  const d = duration || ana?.duration || 0;
  const t = ana?.mixEdit?.in ?? ana?.mix?.mixIn ?? ana?.offset;
  if (Number.isFinite(t) && t >= 0 && (!d || t < d * 0.9)) return t;
  return d ? d * 0.25 : 0;
}

class Preview {
  constructor() {
    this.el = null;
    this.state = null; // { id, t, dur, cue } de la pista activa, o null
    this.subs = new Set();
    this.timer = null;
    this.volume = 0.8;
  }

  on(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  emit(e) {
    for (const fn of this.subs) fn(e);
  }

  // Empieza la pista, o la para si ya sonaba. Devuelve true si queda sonando.
  // opts: cueLabel (salida de auriculares), busy() (¿suena algún deck?), mkAudio() para pruebas.
  async toggle(track, ana, { cueLabel = '', busy = () => false, mkAudio = () => new Audio() } = {}) {
    const url = fileUrl(track, ana);
    if (!url) return false;
    if (this.state?.id === track.videoId) {
      this.stop();
      return false;
    }
    this.stop();
    const el = mkAudio();
    this.el = el;
    el.preload = 'auto';
    el.volume = this.volume;
    el.src = url;
    if (cueLabel && el.setSinkId) {
      try {
        const id = await globalThis.YTDJChain?.findSinkId(cueLabel);
        if (id) await el.setSinkId(id);
      } catch {
        // sin salida de auriculares disponible: se queda en la por defecto
      }
    }
    if (this.el !== el) return false; // otra pulsación llegó mientras se preparaba la salida
    const dur = ana?.duration || track.duration || 0;
    const at = startAt(ana, dur);
    const id = track.videoId;
    this.state = { id, t: at, dur, cue: !!cueLabel };
    el.addEventListener('loadedmetadata', () => {
      if (this.el !== el) return;
      if (!this.state.dur && el.duration) this.state.dur = el.duration;
      try { el.currentTime = startAt(ana, this.state.dur); } catch {} // eslint-disable-line no-empty
    }, { once: true });
    el.addEventListener('ended', () => this.el === el && this.stop());
    try { el.currentTime = at; } catch {} // eslint-disable-line no-empty
    try {
      await el.play();
    } catch {
      if (this.el === el) this.stop();
      return false;
    }
    if (this.el !== el) return false;
    this.emit({ type: 'start', id });
    this.timer = setInterval(() => {
      if (this.el !== el) return;
      this.state.t = el.currentTime;
      if (el.duration && !this.state.dur) this.state.dur = el.duration;
      // Sin auriculares, la preescucha sale por el master: no puede convivir con una mezcla.
      if (!this.state.cue && busy()) {
        this.stop();
        this.emit({ type: 'blocked', id });
        return;
      }
      this.emit({ type: 'tick', id, t: this.state.t, dur: this.state.dur });
    }, 250);
    this.timer.unref?.();
    return true;
  }

  seek(frac) {
    if (!this.el || !this.state?.dur) return;
    this.state.t = Math.max(0, Math.min(1, frac)) * this.state.dur;
    this.el.currentTime = this.state.t;
    this.emit({ type: 'tick', id: this.state.id, t: this.state.t, dur: this.state.dur });
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    const id = this.state?.id;
    const el = this.el;
    this.el = null;
    this.state = null;
    if (el) {
      try { el.pause(); el.removeAttribute?.('src'); el.load?.(); } catch {} // eslint-disable-line no-empty
    }
    if (id) this.emit({ type: 'end', id });
  }
}

export const preview = new Preview();
