#!/usr/bin/env node
// Pruebas del cambio exportar-biblioteca.  Uso: node scripts/test-export.js model|ui|docs
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tests = {};

// Comprobación mínima de XML bien formado: etiquetas equilibradas, atributos entre comillas, sin & ni < sueltos.
function wellFormed(xml) {
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w.-]+="[^"<&]*(?:&(?:amp|lt|gt|quot|apos);[^"<&]*)*")*)\s*(\/?)>|<\?xml[^>]*\?>/g;
  let last = 0; let m;
  while ((m = re.exec(xml))) {
    const between = xml.slice(last, m.index); assert.ok(!/[<&]/.test(between.replace(/&(amp|lt|gt|quot|apos);/g, '')) && !/>/.test(between.replace(/\s/g, '').slice(0, 0)), `texto suelto: ${between}`);
    last = re.lastIndex;
    if (m[2] === undefined) continue;
    if (m[1]) assert.strictEqual(stack.pop(), m[2], `cierre inesperado ${m[2]}`); else if (!m[4]) stack.push(m[2]);
  }
  assert.strictEqual(xml.slice(last).trim(), ''); assert.deepStrictEqual(stack, [], 'etiquetas sin cerrar');
}

// CSV mínimo para la ida y vuelta.
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && s[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-export-'));
  const f1 = path.join(dir, 'Uno & "Dos" <3.m4a'); const f2 = path.join(dir, 'ñandú, año.mp3');
  fs.writeFileSync(f1, 'x'); fs.writeFileSync(f2, 'x');
  const exp = require('../main/export.js');
  const res = (id) => ({ a: f1, b: f2 }[id] || '');
  const ana = { bpm: 124.5, offset: 0.1234, key: 'A minor', camelot: '8A', mix: { mixIn: 16.5, introEnd: 15.2, outroStart: 200 } };
  return {
    dir, f1, f2, exp,
    entries: [
      exp.normalize({ videoId: 'a', title: 'Uno, "el primero"', artist: 'Ñu & Co', duration: 200.4 }, ana, res),
      exp.normalize({ videoId: 'b', title: 'Sin análisis', artist: '', duration: 90 }, null, res),
      exp.normalize({ videoId: 'c', title: 'Solo stream', artist: 'X', duration: 60 }, { bpm: 100 }, res),
    ],
  };
}

tests.model = async () => {
  const { entries, exp, f1, f2 } = fixture();
  // REQ-1: campos, análisis vacío y ruta solo si existe
  assert.deepStrictEqual([entries[0].bpm, entries[0].camelot, entries[0].path], [124.5, '8A', f1]);
  assert.deepStrictEqual([entries[1].bpm, entries[1].key, entries[1].mix, entries[1].path], [0, '', null, f2]); assert.strictEqual(entries[2].path, '', 'stream sin audio');
  // REQ-2: M3U8
  const m = exp.toM3u8(entries); const ml = m.text.split('\n');
  assert.strictEqual(ml[0], '#EXTM3U'); assert.strictEqual(ml[1], '#EXTINF:200,Ñu & Co - Uno, "el primero"'); assert.strictEqual(ml[2], f1); assert.strictEqual(ml[3], '#EXTINF:90,Sin análisis'); assert.strictEqual(ml[4], f2);
  assert.deepStrictEqual([m.written, m.skipped], [2, 1]); assert.ok(!m.text.includes('Solo stream'));
  // REQ-2: CSV con ida y vuelta, comas, comillas, acentos y pistas sin audio
  const c = exp.toCsv(entries); assert.ok(c.text.startsWith('\uFEFF')); const rows = parseCsv(c.text);
  assert.strictEqual(rows.length, 4); assert.deepStrictEqual(rows[0], ['título', 'artista', 'duración', 'BPM', 'tonalidad', 'Camelot', 'ruta', 'id']);
  assert.deepStrictEqual(rows[1], ['Uno, "el primero"', 'Ñu & Co', '200', '124.50', 'A minor', '8A', f1, 'a']); assert.strictEqual(rows[2][3], ''); assert.deepStrictEqual([rows[3][6], rows[3][3]], ['', '100.00']);
  assert.deepStrictEqual([c.written, c.skipped], [3, 0]);
  const nl = exp.toCsv([{ ...entries[0], title: 'línea\nnueva' }]); assert.strictEqual(parseCsv(nl.text)[1][0], 'línea\nnueva');
  // REQ-3: Rekordbox XML bien formado, con escapes, URI, tempo y marcas
  const x = exp.toRekordbox(entries, 'Mi "lista" & más'); wellFormed(x.text);
  assert.deepStrictEqual([x.written, x.skipped], [2, 1]); assert.ok(x.text.includes('<COLLECTION Entries="2">'));
  assert.ok(x.text.includes('Name="Uno, &quot;el primero&quot;"') && x.text.includes('Artist="Ñu &amp; Co"'), 'escapes');
  assert.ok(x.text.includes('TotalTime="200"') && x.text.includes('AverageBpm="124.50"') && x.text.includes('Tonality="8A"'));
  assert.ok(x.text.includes('<TEMPO Inizio="0.123" Bpm="124.50" Metro="4/4" Battito="1"/>')); assert.ok(!/<TRACK[^>]*Name="Sin análisis"[^>]*>\s*<TEMPO/.test(x.text), 'sin BPM no hay TEMPO');
  assert.ok(x.text.includes('<POSITION_MARK Name="Mezcla" Type="0" Start="16.500" Num="0"/>') && x.text.includes('Name="Intro" Type="0" Start="15.200" Num="1"') && x.text.includes('Name="Salida" Type="0" Start="200.000" Num="2"'));
  assert.ok(x.text.includes('Name="Mi &quot;lista&quot; &amp; más"') && x.text.includes('<TRACK Key="1"/>') && x.text.includes('<TRACK Key="2"/>') && !x.text.includes('Key="3"'));
  const loc = /Location="([^"]+)"/.exec(x.text)[1].replace(/&amp;/g, '&'); assert.ok(loc.startsWith('file://localhost/')); assert.ok(loc.endsWith('/' + encodeURIComponent(path.basename(f1))), loc); assert.ok(!/[ "<>]/.test(loc));
  assert.strictEqual(exp.fileUri('C:\\Música\\a b.mp3'), 'file://localhost/C:/M%C3%BAsica/a%20b.mp3', 'ruta de Windows');
  assert.strictEqual(exp.esc('a\u0001b\u0008<'), 'ab&lt;', 'caracteres de control');
  // REQ-4: escritura atómica y nombre seguro
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-exw-')); const out = path.join(dir, 'x.csv');
  exp.writeAtomic(out, 'hola'); assert.strictEqual(fs.readFileSync(out, 'utf8'), 'hola'); assert.ok(!fs.existsSync(out + '.tmp'));
  assert.throws(() => exp.writeAtomic(path.join(dir, 'no', 'existe', 'x.csv'), 'a')); assert.deepStrictEqual(fs.readdirSync(dir), ['x.csv'], 'sin temporales');
  assert.strictEqual(exp.safeName('a/b:c*?'), 'a_b_c__'); assert.strictEqual(exp.safeName(''), 'AlyssDJ');
  assert.deepStrictEqual(Object.keys(exp.FORMATS), ['m3u8', 'csv', 'rekordbox']);
  console.log('model ok');
};

const which = process.argv[2];
if (!tests[which]) { console.error('Uso: node scripts/test-export.js ' + Object.keys(tests).join('|')); process.exit(2); }
tests[which]().catch((e) => { console.error(e); process.exit(1); });
