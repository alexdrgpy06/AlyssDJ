// Autoprueba: pinta el aviso de actualización en cada estado (sin tocar la red).
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    await new Promise((r) => setTimeout(r, 2500));
    const snap = `const b=document.getElementById('update-banner'); return { hidden:b.hidden, text:document.getElementById('upd-text').textContent, go:document.getElementById('upd-go').hidden?null:document.getElementById('upd-go').textContent, skipVisible:!document.getElementById('upd-skip').hidden, bar:!document.getElementById('upd-bar').hidden, fill:document.getElementById('upd-fill').style.width }`;
    const show = (st) => `const m = await import('./update-ui.js'); m.renderUpdate(${JSON.stringify(st)}); ` + snap;
    const res = {};
    res.available = await js(show({ stage: 'available', version: '9.9.9', notes: 'Mejoras en AutoMix\nOtra línea', mode: 'install', progress: 0 }));
    fs.writeFileSync(path.join(out, 'updater.png'), (await win.webContents.capturePage()).toPNG());
    res.downloading = await js(show({ stage: 'downloading', version: '9.9.9', progress: 37, mode: 'install' }));
    res.downloaded = await js(show({ stage: 'downloaded', version: '9.9.9', progress: 100, mode: 'install' }));
    res.notify = await js(show({ stage: 'available', version: '9.9.9', notes: '', mode: 'notify', url: 'https://github.com/alexdrgpy06/AlyssDJ/releases/tag/v9.9.9' }));
    res.idle = await js(show({ stage: 'idle' }));
    res.setting = await js(`document.getElementById('btn-settings').click(); await new Promise(r=>setTimeout(r,500)); return { checked: document.querySelector('#settings form').autoUpdate.checked, btn: !!document.getElementById('btn-check-update') }`);
    fs.writeFileSync(path.join(out, 'updater.json'), JSON.stringify(res));
    win.close();
  });
};
