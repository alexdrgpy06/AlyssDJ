// Separación de stems con HTDemucs (ONNX): el preproceso y el posproceso de Demucs, sin ONNX ni DOM.
// El modelo recibe cada ventana en dos formas (onda `input` y espectrograma `x`) y devuelve la rama temporal y la de frecuencia;
// aquí se calcula la STFT, se suman las ramas con la iSTFT y se unen las ventanas con solape. La inferencia se inyecta
// (`infer`) para poder probar todo con un modelo falso. Salida por trozos ya finales: la memoria no crece con la duración.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTDJStemsDsp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SR = 44100;
  const W = 343980; // ventana del modelo (≈ 7,8 s)
  const HOP = 171990; // salto: solape del 50 %
  const NFFT = 4096;
  const HL = 1024;
  const FQ = 2048; // bins de frecuencia (sin Nyquist)
  const T = 336; // fotogramas por ventana
  const PAD = 1536;
  const STEMS = ['drums', 'bass', 'other', 'vocals']; // orden de salida del modelo (y de los canales del FLAC)

  // ---- FFT radix-2 de 4096 puntos
  const cosT = new Float64Array(NFFT / 2);
  const sinT = new Float64Array(NFFT / 2);
  for (let i = 0; i < NFFT / 2; i++) {
    cosT[i] = Math.cos((2 * Math.PI * i) / NFFT);
    sinT[i] = Math.sin((2 * Math.PI * i) / NFFT);
  }
  const rev = new Uint16Array(NFFT);
  for (let i = 0, b = Math.log2(NFFT); i < NFFT; i++) {
    let r = 0;
    for (let k = 0; k < b; k++) if (i & (1 << k)) r |= 1 << (b - 1 - k);
    rev[i] = r;
  }
  function fft(re, im, inv) {
    for (let i = 0; i < NFFT; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= NFFT; size <<= 1) {
      const half = size >> 1;
      const step = NFFT / size;
      for (let i = 0; i < NFFT; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cosT[k];
          const wi = inv ? sinT[k] : -sinT[k];
          const a = i + j;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  }
  const hann = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NFFT);
  const reflect = (i, n) => {
    while (i < 0 || i >= n) i = i < 0 ? -i : 2 * (n - 1) - i;
    return i;
  };

  // STFT de Demucs (`_spec`) de una ventana estéreo [L, R] de W muestras → Float32Array [4, FQ, T] (canal = c·2 + re/im).
  function spec(seg) {
    const out = new Float32Array(4 * FQ * T);
    const Lp = W + PAD + (PAD + T * HL - W);
    const re = new Float64Array(NFFT);
    const im = new Float64Array(NFFT);
    for (let c = 0; c < 2; c++) {
      for (let fr = 0; fr < T; fr++) {
        const frame = fr + 2;
        for (let n = 0; n < NFFT; n++) {
          const idx = reflect(frame * HL + n - NFFT / 2, Lp);
          re[n] = (seg[c][reflect(idx - PAD, W)] * hann[n]) / 64;
          im[n] = 0;
        }
        fft(re, im, false);
        for (let q = 0; q < FQ; q++) {
          out[(c * 2 * FQ + q) * T + fr] = re[q];
          out[((c * 2 + 1) * FQ + q) * T + fr] = im[q];
        }
      }
    }
    return out;
  }

  // iSTFT de una fuente (`_ispec`): z = [4, FQ, T] → [Float32Array W, Float32Array W].
  const ENV = (() => {
    const frames = T + 4;
    const env = new Float64Array(NFFT + HL * (frames - 1));
    for (let fr = 0; fr < frames; fr++) for (let n = 0; n < NFFT; n++) env[fr * HL + n] += hann[n] * hann[n];
    return env;
  })();
  function ispec(z) {
    const frames = T + 4;
    const res = [new Float64Array(ENV.length), new Float64Array(ENV.length)];
    const re = new Float64Array(NFFT);
    const im = new Float64Array(NFFT);
    for (let c = 0; c < 2; c++) {
      for (let fr = 0; fr < frames; fr++) {
        const src = fr - 2;
        re.fill(0);
        im.fill(0);
        if (src >= 0 && src < T) {
          for (let q = 0; q < FQ; q++) {
            re[q] = z[(c * 2 * FQ + q) * T + src];
            im[q] = z[((c * 2 + 1) * FQ + q) * T + src];
          }
        }
        for (let q = 1; q < NFFT / 2; q++) {
          re[NFFT - q] = re[q];
          im[NFFT - q] = -im[q];
        }
        fft(re, im, true);
        for (let n = 0; n < NFFT; n++) res[c][fr * HL + n] += (re[n] / NFFT) * 64 * hann[n];
      }
    }
    const out = [new Float32Array(W), new Float32Array(W)];
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < W; i++) {
        const p = i + PAD + NFFT / 2;
        out[c][i] = res[c][p] / (ENV[p] > 1e-11 ? ENV[p] : 1);
      }
    }
    return out;
  }

  // Media y desviación de la mezcla (mono) para normalizar como `demucs.separate`.
  function normalizeStats(L, R) {
    const n = L.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += (L[i] + R[i]) / 2;
    mean /= n || 1;
    let v = 0;
    for (let i = 0; i < n; i++) {
      const d = (L[i] + R[i]) / 2 - mean;
      v += d * d;
    }
    return { mean, std: Math.sqrt(v / Math.max(1, n - 1)) + 1e-5 };
  }

  // Cuántas ventanas hacen falta para `length` muestras.
  const windowsFor = (length) => (length <= W ? 1 : Math.ceil((length - W) / HOP) + 1);

  // Separa `mix` ([L, R] Float32Array, SIN normalizar). `infer({ input: Float32Array(2·W), x: Float32Array(4·FQ·T) })` →
  // { time: Float32Array(4·2·W), freq: Float32Array(4·4·FQ·T) } (con `direct`: solo `time`, y `x` llega null). `onChunk(Float32Array)` recibe audio final intercalado de
  // 8 canales (batería L R, bajo L R, resto L R, voz L R), en orden y sin huecos. `shouldStop()` cancela entre ventanas.
  async function separate(mix, { infer, onChunk, onProgress = () => {}, shouldStop = () => false, direct = false }) {
    const length = mix[0].length;
    const { std } = normalizeStats(mix[0], mix[1]);
    const nSeg = windowsFor(length);
    const span = 2 * W;
    const acc = Array.from({ length: 4 }, () => [new Float32Array(span), new Float32Array(span)]);
    const wsum = new Float32Array(span);
    const weight = new Float32Array(W);
    for (let i = 0; i < W; i++) weight[i] = Math.min(i + 1, W - i);
    let base = 0; // índice global de acc[..][..][0]
    const emit = (upTo) => {
      const n = Math.min(upTo, length) - base;
      if (n <= 0) return;
      const out = new Float32Array(n * 8);
      for (let i = 0; i < n; i++) {
        const w = wsum[i] || 1;
        for (let s = 0; s < 4; s++) {
          out[i * 8 + s * 2] = (acc[s][0][i] / w) * std;
          out[i * 8 + s * 2 + 1] = (acc[s][1][i] / w) * std;
        }
      }
      onChunk(out);
      // desplaza lo que queda a la izquierda
      for (let s = 0; s < 4; s++) for (let c = 0; c < 2; c++) {
        acc[s][c].copyWithin(0, n);
        acc[s][c].fill(0, span - n);
      }
      wsum.copyWithin(0, n);
      wsum.fill(0, span - n);
      base += n;
    };
    const t0 = Date.now();
    for (let k = 0; k < nSeg; k++) {
      if (shouldStop()) return false;
      const s0 = Math.min(k * HOP, Math.max(0, length - W));
      const seg = [new Float32Array(W), new Float32Array(W)];
      for (let c = 0; c < 2; c++) {
        const part = mix[c].subarray(s0, Math.min(length, s0 + W));
        for (let i = 0; i < part.length; i++) seg[c][i] = part[i] / std;
      }
      const input = new Float32Array(2 * W);
      input.set(seg[0], 0);
      input.set(seg[1], W);
      const x = direct ? null : spec(seg); // `direct`: el modelo lleva la STFT dentro y devuelve solo `time` (stems [4,2,W])
      const r = await infer({ input, x });
      for (let s = 0; s < 4; s++) {
        const xf = direct ? null : ispec(r.freq.subarray(s * 4 * FQ * T, (s + 1) * 4 * FQ * T));
        for (let c = 0; c < 2; c++) {
          const dst = acc[s][c];
          const off = s0 - base;
          for (let i = 0; i < W && s0 + i < length; i++) dst[off + i] += (r.time[(s * 2 + c) * W + i] + (xf ? xf[c][i] : 0)) * weight[i];
        }
      }
      for (let i = 0; i < W && s0 + i < length; i++) wsum[s0 - base + i] += weight[i];
      // todo lo anterior al inicio de la siguiente ventana ya es final
      emit(k + 1 < nSeg ? Math.min(Math.min((k + 1) * HOP, Math.max(0, length - W)), length) : length);
      const done = (k + 1) / nSeg;
      const el = (Date.now() - t0) / 1000;
      onProgress({ progress: done, etaS: done > 0 ? (el / done) * (1 - done) : null });
    }
    return true;
  }

  return { SR, W, HOP, NFFT, FQ, T, STEMS, spec, ispec, normalizeStats, windowsFor, separate };
});
