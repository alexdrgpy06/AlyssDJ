const fs = require('fs'); const path = require('path');
module.exports = (win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (c) => win.webContents.executeJavaScript(`(async()=>{try{${c}}catch(e){return {__err:e.message}}})()`, true);
    await new Promise((r) => setTimeout(r, 9000));
    const res = {};
    for (let i = 0; i < 6 && !res.search?.ok; i++) { res.search = await js(`return await window.ytdj.lib.search('daft punk one more time')`); if (!res.search?.ok) await new Promise((r) => setTimeout(r, 4000)); }
    const top = (res.search?.data || []).slice(0, 5);
    res.plays = top.map((s) => ({ id: s.videoId, plays: s.plays, album: s.album }));
    const t0 = Date.now();
    res.pop = await js(`return await window.ytdj.lib.popularity(${JSON.stringify(top.map((s) => s.videoId))})`);
    res.ms = Date.now() - t0;
    const t1 = Date.now();
    res.pop2 = await js(`return await window.ytdj.lib.popularity(${JSON.stringify(top.map((s) => s.videoId))})`);
    res.ms2 = Date.now() - t1;
    fs.writeFileSync(path.join(process.env.YTDJ_SELFTEST_OUT, 'pop-live.json'), JSON.stringify(res));
    win.close();
  });
};
