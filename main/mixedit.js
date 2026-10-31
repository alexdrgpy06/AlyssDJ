// Ediciones manuales de los puntos de mezcla de una pista. Van en un archivo aparte (<id>.mixedit.json)
// para que volver a analizar la pista no las borre.
'use strict';
const fs = require('fs');
const path = require('path');

const MAX_OUTS = 6;
const MIN_GAP = 0.05; // dos salidas a menos de 50 ms son la misma

const file = (dir, id) => path.join(dir, `${id}.mixedit.json`);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Deja la edición en su forma canónica: entrada dentro de la pista y hasta 6 salidas sin repetir, en orden de preferencia.
function sanitize(edit, dur) {
  if (!edit || typeof edit !== 'object') return null;
  const inside = (t) => t != null && t >= 0 && (!dur || t < dur - 1);
  const t0 = num(edit.in);
  const outs = [];
  for (const o of Array.isArray(edit.outs) ? edit.outs : []) {
    const t = num(typeof o === 'number' ? o : o?.t);
    if (t == null || t <= 0 || (dur && t >= dur - 1)) continue;
    if (outs.some((x) => Math.abs(x.t - t) < MIN_GAP)) continue;
    outs.push({ t: Math.round(t * 1000) / 1000 });
    if (outs.length === MAX_OUTS) break;
  }
  if (!inside(t0) && !outs.length) return null;
  return { in: inside(t0) ? Math.round(t0 * 1000) / 1000 : null, outs, free: !!edit.free, updated: Date.now() };
}

function read(dir, id) {
  try {
    return JSON.parse(fs.readFileSync(file(dir, id), 'utf8'));
  } catch {
    return null;
  }
}

// edit = null restaura el cálculo automático. Devuelve la edición guardada (o null).
function write(dir, id, edit, dur) {
  const clean = sanitize(edit, dur);
  if (!clean) {
    fs.rmSync(file(dir, id), { force: true });
    return null;
  }
  fs.writeFileSync(file(dir, id), JSON.stringify(clean));
  return clean;
}

module.exports = { sanitize, read, write, MAX_OUTS };
