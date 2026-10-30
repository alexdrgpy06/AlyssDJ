// Decodifica cualquier archivo a PCM mono float32 con ffmpeg.
'use strict';
const { spawn } = require('child_process');

function decode(file, sr, ffmpeg = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-']);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg ${code}: ${err.trim()}`));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
  });
}

module.exports = { decode };
