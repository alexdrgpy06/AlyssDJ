// Análisis offline de una pista ya decodificada (mono, float32): waveform 3 bandas, BPM + beatgrid, tonalidad, ganancia.
// Funciones puras: las usa el worker de la app y el CLI de pruebas.
'use strict';

const WAVE_BINS_PER_SEC = 100;

// ---------- FFT radix-2 in-place ----------
function makeFft(n) {
  const levels = Math.log2(n);
  if (levels % 1) throw new Error('FFT size must be power of 2');
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i;
    let r = 0;
    for (let b = 0; b < levels; b++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    rev[i] = r;
  }
  const window = new Float64Array(n);
  for (let i = 0; i < n; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const mag = new Float64Array(n / 2);

  // Devuelve magnitudes de la trama samples[start .. start+n) con ventana Hann.
  return function magnitudes(samples, start) {
    for (let i = 0; i < n; i++) {
      const s = start + i < samples.length ? samples[start + i] : 0;
      re[rev[i]] = s * window[i];
      im[rev[i]] = 0;
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const tre = re[j + half] * cos[k] + im[j + half] * sin[k];
          const tim = -re[j + half] * sin[k] + im[j + half] * cos[k];
          re[j + half] = re[j] - tre;
          im[j + half] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
        }
      }
    }
    for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    return mag;
  };
}

// ---------- Waveform ----------
function onePole(cutoff, sr) {
  return 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
}

function waveform(samples, sr) {
  const binLen = Math.round(sr / WAVE_BINS_PER_SEC);
  const bins = Math.ceil(samples.length / binLen);
  const low = new Float32Array(bins);
  const mid = new Float32Array(bins);
  const high = new Float32Array(bins);
  const aL = onePole(200, sr);
  const aH = onePole(3000, sr);
  let l1 = 0, l2 = 0, h1 = 0, h2 = 0;
  for (let b = 0; b < bins; b++) {
    let pl = 0, pm = 0, ph = 0;
    const end = Math.min(samples.length, (b + 1) * binLen);
    for (let i = b * binLen; i < end; i++) {
      const x = samples[i];
      l1 += aL * (x - l1);
      l2 += aL * (l1 - l2);
      h1 += aH * (x - h1);
      h2 += aH * (h1 - h2);
      const lo = l2;
      const hi = x - h2;
      const mi = x - lo - hi;
      if (Math.abs(lo) > pl) pl = Math.abs(lo);
      if (Math.abs(mi) > pm) pm = Math.abs(mi);
      if (Math.abs(hi) > ph) ph = Math.abs(hi);
    }
    low[b] = pl;
    mid[b] = pm;
    high[b] = ph;
  }
  const q = (arr) => {
    let max = 1e-9;
    for (const v of arr) if (v > max) max = v;
    const out = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = Math.round(255 * Math.sqrt(arr[i] / max));
    return Buffer.from(out).toString('base64');
  };
  return { binsPerSec: WAVE_BINS_PER_SEC, low: q(low), mid: q(mid), high: q(high) };
}

// ---------- Onset envelope (spectral flux) ----------
const ONSET_N = 1024;
const ONSET_HOP = 256;
// Desfase entre el inicio de la trama con más flujo y el golpe real (calibrado con audio sintético).
const ONSET_LATENCY = 0.033;

function onsetEnvelope(samples, sr) {
  const fft = makeFft(ONSET_N);
  const frames = Math.max(0, Math.floor((samples.length - ONSET_N) / ONSET_HOP));
  const bins = ONSET_N / 2;
  const prev = new Float64Array(bins);
  const env = new Float64Array(frames);
  const lowEnv = new Float64Array(frames);
  const lowBins = Math.ceil((150 * ONSET_N) / sr);
  for (let f = 0; f < frames; f++) {
    const mag = fft(samples, f * ONSET_HOP);
    let flux = 0;
    let lowFlux = 0;
    for (let k = 1; k < bins; k++) {
      const v = Math.log1p(100 * mag[k]);
      const d = v - prev[k];
      if (d > 0) {
        flux += d;
        if (k <= lowBins) lowFlux += d;
      }
      prev[k] = v;
    }
    env[f] = flux;
    lowEnv[f] = lowFlux;
  }
  const w = Math.round((0.5 * sr) / ONSET_HOP);
  return { env: detrend(env, w), low: detrend(lowEnv, w), fps: sr / ONSET_HOP };
}

// Resta la media local (ventana w) y rectifica.
function detrend(env, w) {
  const out = new Float64Array(env.length);
  let acc = 0;
  for (let i = 0; i < env.length; i++) {
    acc += env[i];
    if (i >= w) acc -= env[i - w];
    out[i] = Math.max(0, env[i] - acc / Math.min(i + 1, w));
  }
  return out;
}

function normalized(env) {
  let max = 1e-12;
  for (const v of env) if (v > max) max = v;
  return env.map((v) => v / max);
}

// Puntuación de una rejilla: energía media de onset en los beats, maximizada sobre la fase.
function combScore(env, period, phaseStep) {
  let best = -1;
  let bestPhase = 0;
  for (let ph = 0; ph < period; ph += phaseStep) {
    let s = 0;
    let n = 0;
    for (let t = ph; t < env.length - 1; t += period) {
      const i = Math.floor(t);
      const fr = t - i;
      s += env[i] * (1 - fr) + env[i + 1] * fr;
      n++;
    }
    s /= n || 1;
    if (s > best) {
      best = s;
      bestPhase = ph;
    }
  }
  return { score: best, phase: bestPhase };
}

function tempo(samples, sr, { min = 70, max = 180 } = {}) {
  const { env, low, fps } = onsetEnvelope(samples, sr);
  if (env.length < fps * 4) return { bpm: 0, offset: 0, confidence: 0 };

  // 1) Autocorrelación con prior perceptual (log-gauss centrado en 120 BPM).
  const lagMin = Math.floor((60 * fps) / 200);
  const lagMax = Math.ceil((60 * fps) / 60);
  let bestLag = 0;
  let bestVal = -Infinity;
  const ac = new Float64Array(lagMax + 2);
  for (let lag = lagMin; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    ac[lag] = s / (env.length - lag);
  }
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const v = ac[lag] * prior;
    if (v > bestVal) {
      bestVal = v;
      bestLag = lag;
    }
  }
  let bpm = (60 * fps) / bestLag;
  while (bpm < min) bpm *= 2;
  while (bpm >= max) bpm /= 2;

  // 2) Afinado fino con la rejilla sobre toda la pista.
  let best = { score: -1, bpm, phase: 0 };
  for (let cand = bpm - 2; cand <= bpm + 2; cand += 0.01) {
    const period = (60 * fps) / cand;
    const r = combScore(env, period, 0.5);
    if (r.score > best.score) best = { score: r.score, bpm: cand, phase: r.phase };
  }
  let out = best.bpm;
  if (Math.abs(out - Math.round(out)) < 0.05) out = Math.round(out);
  else if (Math.abs(out * 2 - Math.round(out * 2)) < 0.04) out = Math.round(out * 2) / 2;
  const period = (60 * fps) / out;
  // La fase se decide con más peso en graves: el bombo marca el beat; los hats en contratiempo engañan al flujo total.
  const lowN = normalized(low);
  const allN = normalized(env);
  const phaseEnv = lowN.map((v, i) => v + 0.3 * allN[i]);
  const { phase } = combScore(phaseEnv, period, 0.25);
  const { score } = combScore(env, period, 0.25);
  let mean = 0;
  for (const v of env) mean += v;
  mean /= env.length;
  const offset = (phase * ONSET_HOP) / sr + ONSET_LATENCY;
  const beatLen = 60 / out;
  return {
    bpm: Math.round(out * 100) / 100,
    offset: ((offset % beatLen) + beatLen) % beatLen,
    confidence: mean > 0 ? Math.min(1, score / mean / 4) : 0,
  };
}

// ---------- Tonalidad (Krumhansl-Kessler sobre cromagrama) ----------
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const CAMELOT_MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

function correlate(a, b) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
}

function key(samples, sr) {
  const N = 8192;
  const fft = makeFft(N);
  const chroma = new Float64Array(12);
  const binPc = new Int8Array(N / 2).fill(-1);
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    if (f < 55 || f > 2000) continue;
    binPc[k] = (((Math.round(12 * Math.log2(f / 440)) + 9) % 12) + 12) % 12;
  }
  for (let start = 0; start + N <= samples.length; start += N / 2) {
    const mag = fft(samples, start);
    let frame = 0;
    for (let k = 1; k < N / 2; k++) if (binPc[k] >= 0) frame += mag[k];
    if (frame < 1e-6) continue;
    for (let k = 1; k < N / 2; k++) if (binPc[k] >= 0) chroma[binPc[k]] += Math.sqrt(mag[k] / frame);
  }
  let best = { r: -2 };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = (p) => p.map((_, i) => p[(i - tonic + 12) % 12]);
    const rMaj = correlate(Array.from(chroma), rot(MAJOR));
    const rMin = correlate(Array.from(chroma), rot(MINOR));
    if (rMaj > best.r) best = { r: rMaj, tonic, minor: false };
    if (rMin > best.r) best = { r: rMin, tonic, minor: true };
  }
  const name = NAMES[best.tonic] + (best.minor ? 'm' : '');
  const camelot = (best.minor ? CAMELOT_MINOR : CAMELOT_MAJOR)[best.tonic] + (best.minor ? 'A' : 'B');
  return { key: name, camelot, keyConfidence: Math.round(best.r * 100) / 100 };
}

// ---------- Ganancia ----------
function loudness(samples) {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  const rmsDb = 10 * Math.log10(s / samples.length + 1e-12);
  const target = -12;
  return { rmsDb: Math.round(rmsDb * 10) / 10, autoGainDb: Math.max(-12, Math.min(12, Math.round((target - rmsDb) * 10) / 10)) };
}

function analyze(samples, sr) {
  return {
    version: 1,
    duration: samples.length / sr,
    ...tempo(samples, sr),
    ...key(samples, sr),
    ...loudness(samples),
    waveform: waveform(samples, sr),
  };
}

module.exports = { analyze, tempo, key, waveform, loudness, ANALYSIS_SR: 22050 };
