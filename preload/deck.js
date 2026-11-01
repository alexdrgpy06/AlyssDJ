// Corre dentro de music.youtube.com (mundo aislado). Toma el <video> del reproductor de YT Music,
// lo pasa por la cadena DSP del deck y obedece los comandos del deck. Nada sale de la página salvo
// el estado de reproducción (posición, nivel, metadata) hacia la UI.
const { ipcRenderer, webFrame } = require('electron');
const { createDeckEngine } = require('../shared/deck-engine.js');

const deckId = (process.argv.find((a) => a.startsWith('--ytdj-deck=')) || '').split('=')[1];
let engine = null;
let expected = null; // { videoId, startAt, play }
let meta = { videoId: null, title: '', author: '', ready: false };
let lastMetaPoll = 0;
let settling = false;
let loadedId = null; // video_id que reporta el reproductor de YT Music

// La API del reproductor (loadVideoById, getVideoData…) vive en el main world de la página.
const playerCall = (expr) =>
  webFrame.executeJavaScript(`(() => { const p = document.getElementById('movie_player'); if (!p || !p.loadVideoById) return null; ${expr} })()`);

const adapter = {
  async load(cmd, eng) {
    expected = { videoId: cmd.videoId, startAt: cmd.startAt || 0, play: !!cmd.play };
    meta = { videoId: cmd.videoId, title: '', author: '', ready: false };
    settling = true;
    loadedId = null;
    const ok = await playerCall(`p.loadVideoById(${JSON.stringify(cmd.videoId)}, ${Number(cmd.startAt) || 0}); return true;`);
    if (!ok) ipcRenderer.send('deck:reload-at', cmd.videoId);
  },
  // Durante el cambio de pista, play/pause solo actualizan lo que se hará al terminar de cargar.
  play() {
    if (settling && expected) return void (expected.play = true);
    const v = engine.media;
    return v && v.play().catch((e) => console.warn('[ytdj] play', e.name));
  },
  pause() {
    if (settling && expected) expected.play = false;
    const v = engine.media;
    if (v) v.pause();
  },
  meta: () => ({ ...meta, ad: !!document.querySelector('#movie_player.ad-showing'), source: 'stream' }),
  tick(eng) {
    const v = document.querySelector('video');
    if (v && v !== eng.media) eng.attach(v);
    if (!v) return;
    // Sin pista cargada en el deck, YT Music retoma sola lo último que sonaba: debe quedarse callado y en pausa.
    if (!expected) {
      if (!v.paused) v.pause();
      if (!v.muted) v.muted = true;
      return;
    }
    // Mientras YT Music cambia de pista, silenciar: arranca sola y no debe sonar si el deck está al aire.
    if (settling) {
      if (!v.muted) v.muted = true;
      if (loadedId === expected.videoId && v.readyState >= 2) {
        settling = false;
        meta.ready = true;
        if (expected.startAt && Math.abs(v.currentTime - expected.startAt) > 0.3) v.currentTime = expected.startAt;
        if (expected.play) eng.handle({ type: 'play' });
        else v.pause();
        v.muted = false;
      }
    } else if (!eng.wantPlaying && !v.paused) v.pause();
    const now = performance.now();
    if (now - lastMetaPoll > (settling ? 100 : 500)) {
      lastMetaPoll = now;
      playerCall('const d = p.getVideoData(); return d ? { id: d.video_id, title: d.title, author: d.author } : null;').then((d) => {
        if (!d) return;
        loadedId = d.id;
        // YT Music avanzó solo a otra canción (autoplay/cola): volver a la pista del deck.
        if (d.id && expected && d.id !== expected.videoId && !settling) {
          v.pause();
          adapter.load({ videoId: expected.videoId, startAt: 0, play: false });
          return;
        }
        if (d.id === expected?.videoId) meta = { ...meta, title: d.title, author: d.author };
      });
      dismissDialogs();
    }
  },
};

// "¿Sigues ahí?" y similares pausan la reproducción tras un rato sin interacción.
function dismissDialogs() {
  const btn = document.querySelector('ytmusic-you-there-renderer button, ytmusic-you-there-renderer yt-button-renderer');
  if (btn) btn.click();
}

function boot() {
  engine = createDeckEngine({ adapter, onState: (s) => ipcRenderer.send('deck:state', s) });
  ipcRenderer.on('deck:cmd', (_e, cmd) => {
    return engine.handle(cmd).catch((err) => console.warn('[ytdj]', cmd.type, err.name, err.message));
  });
  ipcRenderer.send('deck:ready');
}

// En la URL de una pista (recarga de respaldo), retomar esa pista en cue.
window.addEventListener('DOMContentLoaded', () => {
  boot();
  const v = new URL(location.href).searchParams.get('v');
  if (v) {
    expected = { videoId: v, startAt: 0, play: false };
    meta = { videoId: v, title: '', author: '', ready: false };
    settling = true;
    loadedId = null;
  }
});
console.log('[ytdj] deck', deckId);
