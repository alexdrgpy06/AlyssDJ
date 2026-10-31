// Autoprueba con YouTube Music real: ¿distingue video musical (OMV) de audio con portada (ATV)?
const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.message}}})()`, true);
    await new Promise((r) => setTimeout(r, 9000)); // la vista de YouTube Music tarda en cargar
    const res = {};
    for (let i = 0; i < 6 && !res.search?.ok; i++) { res.search = await js(`return await window.ytdj.lib.search('daft punk one more time')`); if (!res.search?.ok) await new Promise((r) => setTimeout(r, 4000)); }
    res.atvId = res.search?.data?.[0]?.videoId;
    res.atv = res.atvId ? await js(`return await window.ytdj.lib.videoType(${JSON.stringify(res.atvId)})`) : null;
    res.omv = await js(`return await window.ytdj.lib.videoType('dQw4w9WgXcQ')`);
    fs.writeFileSync(path.join(process.env.YTDJ_SELFTEST_OUT, 'video-live.json'), JSON.stringify(res));
    win.close();
  });
};
