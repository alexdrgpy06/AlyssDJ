const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const out = process.env.YTDJ_SELFTEST_OUT;
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.stack.slice(0,400)}}})()`, true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = {};
    win.setContentSize(1600, 960);
    await wait(2500);
    res.brand = await js(`const by=document.querySelector('.brand-by'); const tb=document.querySelector('.topbar'); return { normal: by.textContent, normalVisible: !!by.offsetParent, topbarOverflow: tb.scrollWidth > tb.clientWidth + 1 }`);
    res.about = await js(`document.getElementById('btn-help').click(); await new Promise(r=>setTimeout(r,300)); document.getElementById('btn-about').click(); await new Promise(r=>setTimeout(r,400)); const d=document.getElementById('about'); return { open: d.open, text: d.innerText, link: document.getElementById('about-link').textContent, img: document.querySelector('#about img').naturalWidth }`);
    fs.writeFileSync(path.join(out, 'about.png'), (await win.webContents.capturePage()).toPNG());
    await js(`document.getElementById('about-close').click(); document.getElementById('help-close').click(); return 1`);
    win.setContentSize(1280, 700);
    await wait(900);
    res.brand.compactVisible = await js(`return !!document.querySelector('.brand-by').offsetParent`);
    fs.writeFileSync(path.join(out, 'brand.json'), JSON.stringify(res));
    win.close();
  });
};
