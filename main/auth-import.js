// Importa la sesión de YouTube Music desde un navegador instalado. Google bloquea el inicio de sesión dentro de
// Electron, así que se reutiliza la sesión que el usuario ya tiene en su navegador: yt-dlp (que sabe descifrar las
// cookies de cada navegador) las vuelca a un archivo temporal, se filtran las de youtube.com y google.com en memoria
// y se cargan en la sesión de la app. El temporal se borra siempre y los valores nunca se registran.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const BROWSERS = [
  { id: 'firefox', label: 'Firefox', dirs: ['.mozilla/firefox', '.config/mozilla/firefox', '.var/app/org.mozilla.firefox/.mozilla/firefox', '.var/app/org.mozilla.firefox/config/mozilla/firefox', 'snap/firefox/common/.mozilla/firefox'] },
  { id: 'chrome', label: 'Google Chrome', dirs: ['.config/google-chrome', '.var/app/com.google.Chrome/config/google-chrome'] },
  { id: 'chromium', label: 'Chromium', dirs: ['.config/chromium', '.var/app/org.chromium.Chromium/config/chromium', 'snap/chromium/common/chromium'] },
  { id: 'brave', label: 'Brave', dirs: ['.config/BraveSoftware/Brave-Browser'] },
  { id: 'edge', label: 'Microsoft Edge', dirs: ['.config/microsoft-edge'] },
  { id: 'vivaldi', label: 'Vivaldi', dirs: ['.config/vivaldi'] },
  { id: 'opera', label: 'Opera', dirs: ['.config/opera'] },
];
const PUBLIC_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // vídeo público: solo sirve para que yt-dlp cargue y guarde el jar
const SESSION_COOKIES = /^(__Secure-3PAPISID|SAPISID|__Secure-1PAPISID)$/;
const SESSION_DAYS = 14; // las cookies "de sesión" del navegador se guardan unos días para que sobrevivan a cerrar la app

function detectBrowsers(home = os.homedir()) {
  const found = BROWSERS.filter((b) => b.dirs.some((d) => fs.existsSync(path.join(home, d)))).map(({ id, label }) => ({ id, label, found: true }));
  return found.length ? found : BROWSERS.map(({ id, label }) => ({ id, label, found: false }));
}

function isYoutubeGoogle(domain) {
  const d = String(domain || '').replace(/^\./, '').toLowerCase();
  return d === 'youtube.com' || d.endsWith('.youtube.com') || d === 'google.com' || d.endsWith('.google.com');
}

// Formato Netscape de yt-dlp: dominio, subdominios, ruta, seguro, expira, nombre, valor (las HttpOnly llevan el prefijo #HttpOnly_).
function parseNetscape(text) {
  const out = [];
  for (let line of String(text).split(/\r?\n/)) {
    let httpOnly = false;
    if (line.startsWith('#HttpOnly_')) {
      httpOnly = true;
      line = line.slice('#HttpOnly_'.length);
    } else if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length < 7) continue;
    out.push({ domain: f[0], path: f[2] || '/', secure: f[3] === 'TRUE', expires: Number(f[4]) || 0, name: f[5], value: f.slice(6).join('\t'), httpOnly });
  }
  return out;
}

function toElectron(c, now = Date.now() / 1000) {
  const host = c.domain.replace(/^\./, '');
  const base = {
    url: `https://${host}${c.path}`,
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure || c.name.startsWith('__Secure-') || c.name.startsWith('__Host-'),
    httpOnly: c.httpOnly,
    expirationDate: c.expires > 0 ? c.expires : now + SESSION_DAYS * 86400,
  };
  if (!c.name.startsWith('__Host-')) base.domain = c.domain; // las __Host- no admiten dominio
  return base;
}

const FRIENDLY = [
  [/could not find .* cookies database|cookies database .* not found|no such file/i, 'No se encontró el perfil de ese navegador. Abre el navegador, inicia sesión en music.youtube.com y vuelve a intentar.'],
  [/failed to decrypt|keyring|kwallet|secretstorage|dpapi/i, 'No se pudieron descifrar las cookies (el navegador las protege con el llavero del sistema). Prueba con Firefox o desbloquea el llavero.'],
  [/database is locked|locked/i, 'El navegador tiene la base de cookies bloqueada. Ciérralo y vuelve a intentar.'],
];

function dumpCookies(bin, browserId, file) {
  return new Promise((resolve) => {
    const args = ['--cookies-from-browser', browserId, '--cookies', file, '--simulate', '--skip-download', '--no-warnings', '--ignore-errors', '--playlist-items', '1', PUBLIC_URL];
    execFile(bin, args, { timeout: 90000, maxBuffer: 4 * 1024 * 1024 }, (err, _out, stderr) => resolve({ error: err, stderr: String(stderr || '') }));
  });
}

async function importFromBrowser({ bin, browserId, session, dump = dumpCookies, tmpDir = os.tmpdir() }) {
  if (!BROWSERS.some((b) => b.id === browserId)) throw new Error('Navegador no soportado');
  const file = path.join(tmpDir, `alyssdj-cookies-${process.pid}-${Date.now()}.txt`);
  try {
    fs.writeFileSync(file, '', { mode: 0o600 });
    const { stderr } = await dump(bin, browserId, file);
    const all = fs.existsSync(file) ? parseNetscape(fs.readFileSync(file, 'utf8')) : [];
    const cookies = all.filter((c) => isYoutubeGoogle(c.domain));
    if (!cookies.length) {
      const hit = FRIENDLY.find(([re]) => re.test(stderr));
      throw new Error(hit ? hit[1] : 'Ese navegador no tiene cookies de YouTube. Inicia sesión en music.youtube.com en él y vuelve a intentar.');
    }
    if (!cookies.some((c) => SESSION_COOKIES.test(c.name))) throw new Error('Ese navegador no tiene la sesión de YouTube iniciada. Entra en music.youtube.com con tu cuenta Premium y vuelve a intentar.');
    for (const c of cookies) await session.cookies.set(toElectron(c));
    return { count: cookies.length };
  } finally {
    fs.rmSync(file, { force: true });
  }
}

module.exports = { BROWSERS, detectBrowsers, isYoutubeGoogle, parseNetscape, toElectron, dumpCookies, importFromBrowser };
