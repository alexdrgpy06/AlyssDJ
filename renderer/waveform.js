// Formas de onda: 3 bandas desde el análisis (yt-dlp) o mono "en vivo" construida mientras suena el stream.
const COLORS = { low: '#2a6dff', mid: '#f2a33a', high: '#f4f6f8', live: '#6c7480' };
export const HOTCUE_COLORS = ['#ff4d6d', '#3ddc84', '#4d9bff', '#ffcc4d'];
const PX_PER_SEC = 110;

function b64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function analysisWave(a) {
  return { kind: 'bands', bps: a.waveform.binsPerSec, low: b64(a.waveform.low), mid: b64(a.waveform.mid), high: b64(a.waveform.high), version: 1 };
}

export function liveWave(dur) {
  const bps = 20;
  return { kind: 'live', bps, level: new Float32Array(Math.ceil(dur * bps) + 1), version: 1 };
}

export function recordLive(w, pos, level) {
  if (!w || w.kind !== 'live') return;
  const i = Math.floor(pos * w.bps);
  if (i >= 0 && i < w.level.length) {
    const v = Math.min(1, Math.sqrt(level));
    if (v > w.level[i]) {
      w.level[i] = v;
      w.version++;
    }
  }
}

export function fitCanvas(c) {
  const dpr = devicePixelRatio || 1;
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
    return true;
  }
  return false;
}

function bandsAt(w, t) {
  const i = Math.floor(t * w.bps);
  if (i < 0) return null;
  if (w.kind === 'bands') {
    if (i >= w.low.length) return null;
    return [w.low[i] / 255, w.mid[i] / 255, w.high[i] / 255];
  }
  if (i >= w.level.length) return null;
  return [w.level[i]];
}

function drawColumn(ctx, x, mid, h, vals, scale = 1) {
  if (vals.length === 1) {
    const a = vals[0] * h * scale;
    ctx.fillStyle = COLORS.live;
    ctx.fillRect(x, mid - a, 1, a * 2);
    return;
  }
  const [lo, mi, hi] = vals;
  ctx.fillStyle = COLORS.low;
  ctx.fillRect(x, mid - lo * h * scale, 1, lo * h * scale * 2);
  ctx.fillStyle = COLORS.mid;
  ctx.fillRect(x, mid - mi * h * 0.75 * scale, 1, mi * h * 1.5 * scale);
  ctx.fillStyle = COLORS.high;
  ctx.fillRect(x, mid - hi * h * 0.45 * scale, 1, hi * h * 0.9 * scale);
}

// Vista desplazable centrada en la posición actual, con beatgrid, cues y loop.
export function drawScroll(c, v) {
  fitCanvas(c);
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const dpr = devicePixelRatio || 1;
  const pps = PX_PER_SEC * (v.zoom || 1) * dpr;
  const cx = Math.round(W / 2);
  ctx.clearRect(0, 0, W, H);
  if (!v.wave) return;
  const t0 = v.pos - cx / pps;
  const mid = H / 2;

  if (v.loop) {
    ctx.fillStyle = 'rgba(255, 204, 77, 0.12)';
    const x0 = (v.loop.in - t0) * pps;
    ctx.fillRect(x0, 0, (v.loop.out - v.loop.in) * pps, H);
  }
  for (let x = 0; x < W; x++) {
    const vals = bandsAt(v.wave, t0 + x / pps);
    if (vals) drawColumn(ctx, x, mid, H / 2 - 2, vals);
  }
  if (v.beats) {
    const len = 60 / v.beats.bpm;
    const first = Math.ceil((t0 - v.beats.offset) / len);
    for (let k = first; ; k++) {
      const t = v.beats.offset + k * len;
      const x = (t - t0) * pps;
      if (x > W) break;
      const bar = ((k % 4) + 4) % 4 === 0;
      ctx.fillStyle = bar ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)';
      ctx.fillRect(Math.round(x), 0, bar ? 2 : 1, bar ? H : H * 0.18);
      if (!bar) ctx.fillRect(Math.round(x), H * 0.82, 1, H * 0.18);
    }
  }
  const marker = (t, color) => {
    const x = Math.round((t - t0) * pps);
    if (x < -10 || x > W + 10) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, 2 * dpr, H);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 8 * dpr, 0);
    ctx.lineTo(x, 8 * dpr);
    ctx.fill();
  };
  if (v.cuePoint != null) marker(v.cuePoint, '#ffb020');
  v.hotcues?.forEach((t, i) => t != null && marker(t, HOTCUE_COLORS[i]));
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(cx - dpr, 0, 2 * dpr, H);
}

// Vista general de la pista completa. La parte estática se cachea en un canvas fuera de pantalla.
export function drawOverview(c, v, cache) {
  const resized = fitCanvas(c);
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  if (!v.wave || !v.dur) return;
  const key = `${W}x${H}:${v.wave.kind}:${v.wave.version}:${v.dur}`;
  if (resized || cache.key !== key) {
    cache.key = key;
    cache.canvas = cache.canvas || document.createElement('canvas');
    cache.canvas.width = W;
    cache.canvas.height = H;
    const o = cache.canvas.getContext('2d');
    o.clearRect(0, 0, W, H);
    const spp = v.dur / W;
    for (let x = 0; x < W; x++) {
      let best = null;
      for (let t = x * spp; t < (x + 1) * spp; t += 1 / v.wave.bps) {
        const b = bandsAt(v.wave, t);
        if (b && (!best || b[0] > best[0])) best = b;
      }
      if (best) drawColumn(o, x, H / 2, H / 2 - 1, best);
    }
  }
  ctx.drawImage(cache.canvas, 0, 0);
  const px = (t) => (t / v.dur) * W;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, px(v.pos), H);
  if (v.loop) {
    ctx.fillStyle = 'rgba(255, 204, 77, 0.3)';
    ctx.fillRect(px(v.loop.in), 0, Math.max(2, px(v.loop.out) - px(v.loop.in)), H);
  }
  const dpr = devicePixelRatio || 1;
  if (v.cuePoint != null) {
    ctx.fillStyle = '#ffb020';
    ctx.fillRect(px(v.cuePoint), 0, 2 * dpr, H);
  }
  v.hotcues?.forEach((t, i) => {
    if (t == null) return;
    ctx.fillStyle = HOTCUE_COLORS[i];
    ctx.fillRect(px(t), 0, 2 * dpr, H * 0.4);
  });
  // Puntos de mezcla del análisis: entrada (verde), región de outro (ámbar) y salidas candidatas.
  const mm = v.mixMarks;
  if (mm) {
    if (mm.outroStart != null) {
      ctx.fillStyle = 'rgba(255, 179, 36, 0.14)';
      ctx.fillRect(px(mm.outroStart), 0, W - px(mm.outroStart), H);
    }
    (mm.outs || []).forEach((t, i) => {
      ctx.fillStyle = i === 0 ? '#ffb324' : '#ffb32488';
      ctx.fillRect(px(t), H - 8 * dpr, 2 * dpr, 8 * dpr);
      ctx.beginPath();
      ctx.moveTo(px(t) - 4 * dpr, H);
      ctx.lineTo(px(t) + 4 * dpr, H);
      ctx.lineTo(px(t), H - 6 * dpr);
      ctx.fill();
    });
    if (mm.in != null) {
      ctx.fillStyle = '#3df08e';
      ctx.fillRect(px(mm.in), 0, 2 * dpr, 8 * dpr);
      ctx.beginPath();
      ctx.moveTo(px(mm.in) - 4 * dpr, 0);
      ctx.lineTo(px(mm.in) + 4 * dpr, 0);
      ctx.lineTo(px(mm.in), 6 * dpr);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(px(v.pos), 0, 2 * dpr, H);
}
