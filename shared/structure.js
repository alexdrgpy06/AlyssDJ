// Estructura de una pista a partir de su rejilla: energía por frase de 16 beats, fin de la intro, comienzo del outro
// y puntos de mezcla candidatos. Funciones puras; las usa el análisis y las pruebas.
'use strict';

const PHRASE_BEATS = 16;
const STRONG = 0.6; // una frase es "fuerte" si su energía es ≥ 60 % de la mediana de la pista
const round3 = (v) => Math.round(v * 1000) / 1000;

// Energía (RMS) de la señal filtrada a < 2 kHz: refleja el bombo y el bajo, no los hats.
function beatEnergies(samples, sr, bpm, offset) {
  const beatLen = 60 / bpm;
  const nBeats = Math.max(0, Math.floor((samples.length / sr - offset) / beatLen));
  const a = 1 - Math.exp((-2 * Math.PI * 2000) / sr);
  const out = new Float64Array(nBeats);
  let lp = 0;
  let b = 0;
  let acc = 0;
  let n = 0;
  let nextEnd = Math.round((offset + beatLen) * sr);
  const start = Math.round(offset * sr);
  for (let i = start; i < samples.length && b < nBeats; i++) {
    lp += a * (samples[i] - lp);
    acc += lp * lp;
    n++;
    if (i + 1 >= nextEnd) {
      out[b++] = Math.sqrt(acc / Math.max(1, n));
      acc = 0;
      n = 0;
      nextEnd = Math.round((offset + (b + 1) * beatLen) * sr);
    }
  }
  return out;
}

const median = (arr) => {
  const s = [...arr].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// rms → 0..100 (−45 dBFS = 0, −10 dBFS = 100)
const toScale = (rms) => Math.max(0, Math.min(100, Math.round(((20 * Math.log10(rms + 1e-9) + 45) / 35) * 100)));

function structure(samples, sr, { bpm, offset }) {
  if (!bpm || bpm <= 0) return null;
  const beatLen = 60 / bpm;
  const phraseLen = PHRASE_BEATS * beatLen;
  const duration = samples.length / sr;
  const E = beatEnergies(samples, sr, bpm, offset);
  const nPhr = Math.floor(E.length / PHRASE_BEATS);
  if (nPhr < 4) return null; // demasiado corta para hablar de estructura
  const P = [];
  for (let k = 0; k < nPhr; k++) {
    let s = 0;
    for (let b = 0; b < PHRASE_BEATS; b++) s += E[k * PHRASE_BEATS + b];
    P.push(s / PHRASE_BEATS);
  }
  const max = Math.max(...P);
  const loud = P.filter((v) => v > 0.05 * max);
  const M = median(loud.length ? loud : P) || 1;
  const rel = P.map((v) => v / M);
  const tAt = (k) => round3(offset + k * phraseLen);

  // Inicio útil: primera frase con algo de música (salta silencios iniciales).
  let first = rel.findIndex((r) => r >= 0.12);
  if (first < 0) first = 0;
  const mixIn = tAt(first);
  // Fin de la intro: primera frase fuerte.
  let intro = rel.findIndex((r) => r >= STRONG);
  if (intro < 0) intro = 0;
  const introEnd = tAt(intro);

  // Comienzo del outro: la energía cae y no vuelve. Se busca la última frase fuerte.
  let lastStrong = -1;
  for (let k = nPhr - 1; k >= 0; k--) {
    if (rel[k] >= STRONG) {
      lastStrong = k;
      break;
    }
  }
  const fallbackK = Math.max(0, Math.floor((E.length - 32) / PHRASE_BEATS)); // deja ≥ 32 beats hasta el final
  let outroK = lastStrong >= 0 && lastStrong < nPhr - 1 ? lastStrong + 1 : fallbackK;
  if (tAt(outroK) < 0.5 * duration) outroK = fallbackK; // un "outro" en la primera mitad no es un outro
  const outroStart = tAt(outroK);

  // Candidatos de salida: el outro (mejor), las roturas (una frase fuerte seguida de una floja) y el último límite de frase.
  const cands = [{ t: outroStart, score: 1, kind: 'outro' }];
  for (let k = 0; k < nPhr - 1; k++) {
    if (rel[k] >= 0.8 && rel[k + 1] < STRONG && tAt(k + 1) >= 0.35 * duration && k + 1 !== outroK) cands.push({ t: tAt(k + 1), score: 0.6, kind: 'rotura' });
  }
  const lastK = Math.max(0, Math.floor((E.length - PHRASE_BEATS) / PHRASE_BEATS));
  if (lastK !== outroK) cands.push({ t: tAt(lastK), score: 0.3, kind: 'final' });
  cands.sort((x, y) => y.score - x.score || x.t - y.t);

  const abs = P.map(toScale);
  const body = abs.filter((_, k) => rel[k] >= STRONG);
  return {
    version: 2,
    phraseBeats: PHRASE_BEATS,
    introEnd,
    outroStart,
    mixIn,
    mixOut: cands,
    phrases: abs,
    energy: body.length ? Math.round(body.reduce((s, v) => s + v, 0) / body.length) : Math.round(abs.reduce((s, v) => s + v, 0) / abs.length),
  };
}

module.exports = { structure, beatEnergies, PHRASE_BEATS, STRONG };
