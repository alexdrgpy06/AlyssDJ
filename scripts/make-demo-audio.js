#!/usr/bin/env node
// Genera 4 pistas de demostración (MP3 con carátula y etiquetas) para probar AlyssDJ sin música propia
// y para las capturas de la documentación.   Uso: node scripts/make-demo-audio.js <carpeta-de-salida>
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// ffmpeg: el que baja AlyssDJ a bin/ si existe; si no, el del sistema.
const bundled = path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const FFMPEG = fs.existsSync(bundled) ? bundled : 'ffmpeg';
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'alyssdj-demo'));
fs.mkdirSync(out, { recursive: true });
const SR = 44100;

const TRACKS = [
  { title: 'Neon Drive', bpm: 124, first: 0.30, chord: [220, 261.63, 329.63], bass: 55, hue: '0x3b1d8f' },
  { title: 'Sunset Groove', bpm: 126, first: 0.18, chord: [146.83, 174.61, 220], bass: 73.42, hue: '0xb3401f' },
  { title: 'Night Pulse', bpm: 128, first: 0.22, chord: [164.81, 196, 246.94], bass: 82.41, hue: '0x0f6b7a' },
  { title: 'Deep Signal', bpm: 122, first: 0.12, chord: [196, 233.08, 293.66], bass: 49, hue: '0x1d7a3a' },
];

function render({ bpm, first, chord, bass }, seconds) {
  const n = SR * seconds;
  const d = new Float32Array(n);
  const P = 60 / bpm;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let hatPrev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const kb = t - first;
    let x = 0;
    if (kb >= 0) {
      const beat = Math.floor(kb / P);
      const tb = kb - beat * P;
      x += 0.85 * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-tb * 38)) * tb) * Math.exp(-tb * 11); // bombo
      const th = (kb + P / 2) % P;
      const hn = rnd();
      x += 0.16 * (hn - hatPrev) * Math.exp(-th * 55); // hi-hat a contratiempo
      hatPrev = hn;
      if (beat % 2 === 1) x += 0.22 * rnd() * Math.exp(-tb * 18); // clap en 2 y 4
      x += 0.34 * Math.sin(2 * Math.PI * bass * (tb + beat * P)) * Math.exp(-tb * 2.2) * (1 - Math.exp(-tb * 120)); // bajo
    }
    const pad = 0.55 + 0.45 * Math.sin(2 * Math.PI * t / (P * 8));
    for (const f of chord) x += 0.05 * pad * Math.sin(2 * Math.PI * f * t);
    d[i] = Math.max(-1, Math.min(1, x));
  }
  return d;
}

function wav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

for (const t of TRACKS) {
  const tmp = path.join(out, `${t.title}.wav`);
  const cover = path.join(out, `${t.title}.jpg`);
  const mp3 = path.join(out, `${t.title}.mp3`);
  wav(tmp, render(t, 110));
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${t.hue}:s=600x600`, '-vf',
    "geq=r='r(X,Y)+90*sin(X/55+Y/90)':g='g(X,Y)+70*sin(Y/45)':b='b(X,Y)+110*cos((X+Y)/70)'", '-frames:v', '1', cover]);
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', tmp, '-i', cover, '-map', '0', '-map', '1', '-c:a', 'libmp3lame', '-b:a', '160k',
    '-id3v2_version', '3', '-metadata', `title=${t.title}`, '-metadata', 'artist=AlyssDJ Demo', '-metadata', `album=Demo Set (${t.bpm} BPM)`, mp3]);
  fs.rmSync(tmp);
  fs.rmSync(cover);
  console.log(`${t.title}  ${t.bpm} BPM  → ${mp3}`);
}
console.log(`Listo en ${out}`);
