// Módulo de autoprueba (lo carga scripts/test-login-flow.js): diálogo de login, error real sin navegador y
// importación con cookies sintéticas sobre la sesión real de Electron (carpeta de datos temporal).
'use strict';
const fs = require('fs');
const path = require('path');
const { session } = require('electron');
const authImport = require('../main/auth-import');

module.exports = (win) => {
  const out = process.env.YTDJ_SELFTEST_OUT;
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => wc.executeJavaScript(`(async()=>{ try { return await (async()=>{${code}})() } catch(e) { return { __err: e.stack.slice(0,300) } } })()`, true);
  const res = {};

  wc.once('did-finish-load', async () => {
    try {
      await wait(2500);
      // REQ-1 y REQ-5: el diálogo se abre y lista navegadores
      res.dialog = await js(`document.getElementById('btn-login').click(); await new Promise(r=>setTimeout(r,500)); const d=document.getElementById('login'); return { open: d.open, options: [...document.getElementById('login-browser').options].map(o=>o.textContent), hasImport: !!document.getElementById('login-import'), hasDirect: !!document.getElementById('login-direct') }`);
      const found = authImport.detectBrowsers();
      res.detectedInMain = found.map((b) => `${b.id}:${b.found}`);
      if (process.env.YTDJ_LOGIN_SHOT) fs.writeFileSync(path.join(process.env.YTDJ_LOGIN_SHOT), (await wc.capturePage()).toPNG());

      // REQ-4: si yt-dlp no encuentra el perfil, el mensaje es comprensible y no toca la sesión.
      // Se usa un yt-dlp de mentira: la prueba nunca debe leer un navegador real.
      const stub = path.join(out, 'fake-ytdlp.sh');
      fs.writeFileSync(stub, '#!/bin/sh\n[ "$1" = "--version" ] && { echo 0.0.0-test; exit 0; }\necho "ERROR: could not find firefox cookies database in /nada" >&2\nexit 1\n', { mode: 0o755 });
      await js(`await window.ytdj.settings.set({ ytdlpPath: ${JSON.stringify(stub)} }); return 1`);
      res.errorPath = await js(`const sel=document.getElementById('login-browser'); sel.innerHTML='<option value="firefox">x</option>'; document.getElementById('login-import').click(); for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,250)); const m=document.getElementById('login-msg'); if (m.classList.contains('err')) return { text: m.textContent, kind: 'err' }; } return { text: document.getElementById('login-msg').textContent, kind: 'none' }`);
      res.statusAfterError = await js('return await window.ytdj.auth.status()');

      // REQ-2, REQ-3, REQ-7: importación con cookies sintéticas en la sesión real
      const ses = session.fromPartition('persist:ytm');
      const T = '\t';
      const jar = [
        `#HttpOnly_.youtube.com${T}TRUE${T}/${T}TRUE${T}1900000000${T}__Secure-3PAPISID${T}synthetic-a`,
        `.google.com${T}TRUE${T}/${T}TRUE${T}0${T}SAPISID${T}synthetic-b`,
        `.example.com${T}TRUE${T}/${T}FALSE${T}1900000000${T}tracker${T}NO`,
      ].join('\n');
      const r = await authImport.importFromBrowser({ bin: 'x', browserId: 'firefox', session: ses, dump: async (_b, _i, f) => (fs.writeFileSync(f, jar), { stderr: '' }) });
      res.import = r;
      res.cookiesInSession = {
        youtube: (await ses.cookies.get({ domain: '.youtube.com' })).map((c) => c.name),
        google: (await ses.cookies.get({ domain: '.google.com' })).map((c) => c.name),
        example: (await ses.cookies.get({ domain: '.example.com' })).length,
      };
      res.statusAfterImport = await js('return await window.ytdj.auth.status()');
      // Con cookies falsas YouTube Music no reconoce la sesión: verify debe decirlo (false), no colgarse
      res.verifyWithFakeCookies = await js('return await window.ytdj.auth.verify()');
      await js('return await window.ytdj.auth.logout()');
      res.statusAfterLogout = await js('return await window.ytdj.auth.status()');
    } catch (e) {
      res.error = e.stack.slice(0, 400);
    }
    fs.writeFileSync(path.join(out, 'login-flow.json'), JSON.stringify(res, null, 2));
    win.close();
  });
};
