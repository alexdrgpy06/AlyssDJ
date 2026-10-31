// Pistas sintéticas con estructura conocida (intro floja, cuerpo, rotura, cuerpo, outro flojo) para pruebas.
'use strict';
const fs = require('fs');

const SR = 22050;
const GAIN = { i: 0.25, b: 1, r: 0.18, o: 0.3 };

function track({ bpm = 124, offset = 0.3, layout = ['i', 'i', 'b', 'b', 'b', 'b', 'b', 'b', 'r', 'b', 'b', 'b', 'b', 'o', 'o', 'o'] } = {}) {
  const beat = 60 / bpm;
  const n = Math.floor((offset + layout.length * 16 * beat + 1) * SR);
  const d = new Float32Array(n);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR - offset;
    if (t < 0) continue;
    const beatIdx = Math.floor(t / beat);
    const kind = layout[Math.floor(beatIdx / 16)];
    if (!kind) continue;
    const g = GAIN[kind];
    const tb = t - beatIdx * beat;
    let x = 0;
    if (kind !== 'r') x += 0.8 * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-tb * 38)) * tb) * Math.exp(-tb * 11) * g;
    x += 0.25 * Math.sin(2 * Math.PI * 55 * t) * g;
    x += 0.03 * rnd() * Math.exp(-(((t % (beat / 2)) + beat / 2) % (beat / 2)) * 40);
    d[i] = x;
  }
  return { samples: d, bpm, offset, beat, layout, duration: n / SR, outroStart: offset + layout.lastIndexOf('b') * 16 * beat + 16 * beat };
}

function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF'); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

module.exports = { track, writeWav, SR };
