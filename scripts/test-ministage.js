#!/usr/bin/env node
// Lógica de la vista AutoMix (miniaturas): qué se muestra, qué deck está al aire y el tamaño.
// Uso: node --experimental-default-type=module scripts/test-ministage.js
import assert from 'assert';
import { pickMedia, airWeights, clampWidth, MIN_W, MAX_W } from '../renderer/ministage.js';

// REQ-2: solo el video de la pista cargada
const base = { trackId: 'abc', videoKey: 'abc', videoSrc: 'app://ui/localvideo/abc', source: 'local' };
assert.deepStrictEqual(pickMedia(base), { kind: 'video', src: base.videoSrc });
assert.deepStrictEqual(pickMedia({ ...base, trackId: 'xyz' }), { kind: 'cover', label: 'Solo audio' }, 'video de otra pista');
assert.deepStrictEqual(pickMedia({ ...base, videoKey: null }), { kind: 'cover', label: 'Solo audio' }, 'sin resolver aún');
assert.deepStrictEqual(pickMedia({ ...base, trackId: null }), { kind: 'cover' });
// REQ-5: sin video
assert.deepStrictEqual(pickMedia({ ...base, videoSrc: null }), { kind: 'cover', label: 'Solo audio' });
// stream: fotogramas recientes o portada
const st = { trackId: 'abc', source: 'stream', frameUrl: 'blob:f', frameAgeMs: 200 };
assert.deepStrictEqual(pickMedia(st), { kind: 'frame', src: 'blob:f' });
assert.deepStrictEqual(pickMedia({ ...st, frameAgeMs: 3000 }), { kind: 'cover' });
assert.deepStrictEqual(pickMedia({ ...st, videoKey: 'otra', videoSrc: 'x' }), { kind: 'frame', src: 'blob:f' });

// REQ-3: al aire
assert.deepStrictEqual(airWeights([0.9, 0]), [true, false]);
assert.deepStrictEqual(airWeights([0, 0.6]), [false, true]);
assert.deepStrictEqual(airWeights([0.5, 0.5]), [true, true], 'mezcla en curso');
assert.deepStrictEqual(airWeights([0.9, 0.1]), [true, false], 'el entrante apenas sube');
assert.deepStrictEqual(airWeights([0, 0]), [false, false]);

// REQ-4: tamaño
assert.strictEqual(clampWidth(10), MIN_W);
assert.strictEqual(clampWidth(9999), MAX_W);
assert.strictEqual(clampWidth(333.4), 333);
assert.strictEqual(clampWidth('x'), 320);
console.log('test-ministage: ok');
