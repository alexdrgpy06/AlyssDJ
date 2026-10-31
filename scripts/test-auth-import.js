// Pruebas de main/auth-import.js sin tocar navegadores reales: cookies sintéticas y un "yt-dlp" simulado.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('../main/auth-import');

const T = '\t';
const jar = [
  '# Netscape HTTP Cookie File',
  `#HttpOnly_.youtube.com${T}TRUE${T}/${T}TRUE${T}1900000000${T}__Secure-3PAPISID${T}secret-1`,
  `.google.com${T}TRUE${T}/${T}TRUE${T}0${T}SAPISID${T}secret-2`,
  `music.youtube.com${T}FALSE${T}/${T}TRUE${T}1900000000${T}VISITOR${T}v3`,
  `.example.com${T}TRUE${T}/${T}FALSE${T}1900000000${T}tracker${T}NO`,
  `.notyoutube.com${T}TRUE${T}/${T}FALSE${T}1900000000${T}evil${T}NO`,
  `.google.com.evil.io${T}TRUE${T}/${T}FALSE${T}1900000000${T}evil2${T}NO`,
].join('\n');

// parseNetscape + filtro por dominio
const parsed = A.parseNetscape(jar);
assert.strictEqual(parsed.length, 6);
assert.ok(parsed[0].httpOnly && parsed[0].name === '__Secure-3PAPISID');
const kept = parsed.filter((c) => A.isYoutubeGoogle(c.domain)).map((c) => c.name);
assert.deepStrictEqual(kept, ['__Secure-3PAPISID', 'SAPISID', 'VISITOR']);
assert.ok(!A.isYoutubeGoogle('notyoutube.com') && !A.isYoutubeGoogle('google.com.evil.io') && A.isYoutubeGoogle('.accounts.google.com'));

// toElectron: cookies de sesión reciben vencimiento; __Host- sin dominio
const sess = A.toElectron(parsed[1], 1000);
assert.strictEqual(sess.expirationDate, 1000 + 14 * 86400);
assert.strictEqual(A.toElectron({ ...parsed[0], name: '__Host-x' }).domain, undefined);

// detectBrowsers con un HOME falso
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'alyss-home-'));
assert.strictEqual(A.detectBrowsers(home, 'linux').every((b) => !b.found), true, 'sin perfiles: lista completa marcada como no encontrada');
fs.mkdirSync(path.join(home, '.mozilla/firefox'), { recursive: true });
assert.deepStrictEqual(A.detectBrowsers(home, 'linux').map((b) => b.id), ['firefox']);

(async () => {
  const set = [];
  const session = { cookies: { set: async (c) => set.push(c) } };
  let tmpUsed;
  // importación correcta: solo youtube/google, y el temporal desaparece
  const dump = async (_bin, _id, file) => (fs.writeFileSync(file, jar), (tmpUsed = file), { stderr: '' });
  const r = await A.importFromBrowser({ bin: 'x', browserId: 'firefox', session, dump });
  assert.strictEqual(r.count, 3);
  assert.deepStrictEqual(set.map((c) => c.name), ['__Secure-3PAPISID', 'SAPISID', 'VISITOR']);
  assert.ok(!fs.existsSync(tmpUsed), 'el temporal se borra');

  // errores: sin cookies, sin sesión, navegador inválido; la sesión no se toca y el temporal se borra
  set.length = 0;
  const fail = async (opts, re) => {
    await assert.rejects(A.importFromBrowser({ bin: 'x', session, ...opts }), re);
    assert.strictEqual(set.length, 0);
  };
  await fail({ browserId: 'firefox', dump: async (_b, _i, f) => (fs.writeFileSync(f, ''), { stderr: 'ERROR: could not find firefox cookies database in /x' }) }, /No se encontró el perfil/);
  await fail({ browserId: 'chrome', dump: async (_b, _i, f) => (fs.writeFileSync(f, ''), { stderr: 'ERROR: Failed to decrypt with DPAPI/keyring' }) }, /llavero/);
  await fail({ browserId: 'firefox', dump: async (_b, _i, f) => (fs.writeFileSync(f, `.example.com${T}TRUE${T}/${T}FALSE${T}0${T}a${T}b`), { stderr: '' }) }, /no tiene cookies de YouTube/);
  await fail({ browserId: 'firefox', dump: async (_b, _i, f) => (fs.writeFileSync(f, `.youtube.com${T}TRUE${T}/${T}TRUE${T}0${T}VISITOR${T}x`), { stderr: '' }) }, /no tiene la sesión/);
  await fail({ browserId: '--exec=evil', dump }, /no soportado/);
  const leftovers = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(`alyssdj-cookies-${process.pid}-`));
  assert.deepStrictEqual(leftovers, [], 'no quedan temporales');
  console.log('auth-import: todas las pruebas OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
