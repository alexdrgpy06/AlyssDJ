// Reproduce un video silenciado sincronizado con el audio de un deck local: posición, pausa y velocidad.
// Lo usan la miniatura del deck y la ventana de video; el audio nunca sale de aquí.
export const MAX_DRIFT = 0.08; // s: por encima se corrige la posición

export function wantedTime(sync, now = performance.now()) {
  // `sync.at` es el instante (performance.now) en que se midió `t`; mientras suena, avanza con la velocidad
  return sync.playing ? sync.t + ((now - sync.at) / 1000) * (sync.rate || 1) : sync.t;
}

export class LocalVideo {
  constructor(el) {
    this.el = el;
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    this.src = null;
  }

  setSource(src) {
    if (src === this.src) return;
    this.src = src;
    if (src) {
      this.el.src = src;
      this.el.load();
    } else {
      this.el.removeAttribute('src');
      this.el.load();
    }
  }

  // sync = { t, playing, rate, at }. Devuelve la deriva corregida (para las pruebas).
  apply(sync, now = performance.now()) {
    const el = this.el;
    if (!this.src || el.readyState < 1) return null;
    const want = wantedTime(sync, now);
    const dur = el.duration || Infinity;
    const clamped = Math.max(0, Math.min(want, dur - 0.05));
    const rate = Math.max(0.0625, Math.min(16, sync.rate || 1));
    if (el.playbackRate !== rate) el.playbackRate = rate;
    const drift = el.currentTime - clamped;
    if (Math.abs(drift) > MAX_DRIFT || !sync.playing) {
      if (Math.abs(drift) > 0.01) el.currentTime = clamped;
    }
    if (sync.playing && want < dur) el.paused && el.play().catch(() => {});
    else !el.paused && el.pause();
    return drift;
  }
}
