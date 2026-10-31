// Autoprueba de perfiles: cambia el tamaño de la ventana y mide.
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack}}})()`, true);
    const measure = `const r=(s)=>{const b=document.querySelector(s).getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right,h:b.height}}; return { layout:document.body.dataset.layout, w:innerWidth, h:innerHeight, scale:document.body.style.getPropertyValue('--ui-scale'), sh:document.documentElement.scrollHeight, bodyH:document.body.getBoundingClientRect().height, sw:document.documentElement.scrollWidth, console:r('.console'), library:r('.library'), deckA:r('#deck-A .deck'), mixer:r('.mixer'), topbar:r('.topbar') }`;
    const res = { sizes: {} };
    await wait(2500);
    for (const [w, h] of [[1366, 768], [1600, 960], [2560, 1440]]) {
      win.setContentSize(w, h);
      await wait(900);
      res.sizes[`${w}x${h}`] = await js(measure);
      fs.writeFileSync(path.join(out, `layout-${w}x${h}.png`), (await win.webContents.capturePage()).toPNG());
    }
    // ajuste manual: forzar compacto en 1600x960
    win.setContentSize(1600, 960);
    await wait(500);
    await js(`document.getElementById('btn-settings').click(); await new Promise(r=>setTimeout(r,500)); const f=document.querySelector('#settings form'); res=f.layoutMode.value; f.layoutMode.value='compact'; document.querySelector('#settings').close(); return 1`);
    await wait(1200);
    res.forced = await js(measure);
    res.saved = await js(`return (await window.ytdj.settings.get()).layoutMode`);
    fs.writeFileSync(path.join(out, 'layouts.json'), JSON.stringify(res));
    win.close();
  });
};
