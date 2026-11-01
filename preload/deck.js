// Corre dentro de music.youtube.com (mundo aislado). Toma el <video> del reproductor de YT Music,
// lo pasa por la cadena DSP del deck y obedece los comandos del deck. Nada sale de la página salvo
// el estado de reproducción (posición, nivel, metadata) hacia la UI.
const { ipcRenderer, webFrame } = require('electron');
const { createDeckEngine } = require('../shared/deck-engine.js');

// Cadena de contenedores del <video> en music.youtube.com. Todos pasan a ocupar la ventana completa
// (el #main-panel original tiene un transform que rompe position:fixed en sus hijos).
const VIDEO_CSS = `
html, body { background: #000 !important; overflow: hidden !important; }
ytmusic-player-page#player-page { display: block !important; visibility: visible !important; position: fixed !important; inset: 0 !important;
  width: 100vw !important; height: 100vh !important; transform: none !important; translate: none !important; top: 0 !important;
  left: 0 !important; z-index: 2147483000 !important; background: #000 !important; opacity: 1 !important; pointer-events: none !important; }
ytmusic-popup-container, ytmusic-mealbar-promo-renderer, tp-yt-paper-dialog, ytmusic-consent-bump-v2-renderer, tp-yt-iron-overlay-backdrop,
ytmusic-notification-action-renderer, tp-yt-paper-toast { display: none !important; }
#main-panel { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
  transform: none !important; z-index: 2147483000 !important; background: #000 !important; margin: 0 !important; padding: 0 !important; }
#music-player-wrapper, ytmusic-player#player, #song-video, #song-video .player-wrapper, #movie_player,
#movie_player .html5-video-container {
  position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important;
  max-width: none !important; max-height: none !important; margin: 0 !important; padding: 0 !important;
  transform: none !important; aspect-ratio: auto !important; border-radius: 0 !important; }
#movie_player video { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
  height: 100% !important; object-fit: contain !important; }
#song-image { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important;
  z-index: 3 !important; background: #000 !important; display: flex; align-items: center; justify-content: center; }
#song-image yt-img-shadow, #song-image #thumbnail { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important;
  margin: 0 !important; max-width: none !important; max-height: none !important; }
#song-image, #song-image * { padding: 0 !important; box-sizing: border-box !important; transform: none !important; translate: none !important; scale: none !important; animation: none !important; transition: none !important; }
#song-image img { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; }
.ytp-chrome-bottom, .ytp-gradient-bottom, .ytp-gradient-top, .ytp-chrome-top, .ytp-pause-overlay, .ytp-ce-element,
.ytp-spinner, .ytp-contextmenu, .ytp-popup, .ytp-watermark, .ytp-iv-video-content, .ytp-cards-teaser, .ytp-paid-content-overlay
{ display: none !important; }
#movie_player, #movie_player * { cursor: none !important; }
`;

const deckId = (process.argv.find((a) => a.startsWith('--ytdj-deck=')) || '').split('=')[1];
let engine = null;
let expected = null; // { videoId, startAt, play }
let meta = { videoId: null, title: '', author: '', ready: false };
let lastMetaPoll = 0;
let settling = false;
let loadedId = null; // video_id que reporta el reproductor de YT Music
let videoCssKey = null;
let videoPref = false; // preferir el video musical (cambia el modo de reproducción de YT Music)
let videoPrefDone = null; // videoId para el que ya se aplicó la preferencia
let videoSwitchUntil = 0; // hasta cuándo es válido que YT Music pase a la versión en video (tras pulsar su botón)
let videoAltId = null; // id de esa versión en video, una vez vista

async function setVideoView(on) {
  if (on && !videoCssKey) videoCssKey = await webFrame.insertCSS(VIDEO_CSS);
  else if (!on && videoCssKey) {
    webFrame.removeInsertedCSS(videoCssKey);
    videoCssKey = null;
  }
}

// La API del reproductor (loadVideoById, getVideoData…) vive en el main world de la página.
const playerCall = (expr) =>
  webFrame.executeJavaScript(`(() => { const p = document.getElementById('movie_player'); if (!p || !p.loadVideoById) return null; ${expr} })()`);

const adapter = {
  async load(cmd, eng) {
    expected = { videoId: cmd.videoId, startAt: cmd.startAt || 0, play: !!cmd.play };
    meta = { videoId: cmd.videoId, title: '', author: '', ready: false };
    videoSwitchUntil = 0;
    videoAltId = null;
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
        preferVideo();
      }
    } else if (!eng.wantPlaying && !v.paused) v.pause();
    const now = performance.now();
    if (now - lastMetaPoll > (settling ? 100 : 500)) {
      lastMetaPoll = now;
      playerCall('const d = p.getVideoData(); return d ? { id: d.video_id, title: d.title, author: d.author } : null;').then((d) => {
        if (!d) return;
        loadedId = d.id;
        // YT Music avanzó solo a otra canción (autoplay/cola): volver a la pista del deck
        // (salvo que se haya pedido la versión en video, que tiene otro id).
        // Con «preferir video» solo vale el cambio a la versión en video que pidió el propio deck (una vez, y pronto).
        const isVideoSwitch = videoPref && (videoAltId === d.id || (!videoAltId && performance.now() < videoSwitchUntil));
        if (isVideoSwitch && d.id !== expected?.videoId) videoAltId = d.id;
        if (d.id && expected && d.id !== expected.videoId && !settling && !isVideoSwitch) {
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

function preferVideo() {
  if (!videoPref || !expected || videoPrefDone === expected.videoId) return;
  const toggle = document.querySelector('ytmusic-av-toggle');
  const btn = toggle && toggle.querySelector('.video-button');
  if (!toggle || !btn || toggle.hasAttribute('toggle-disabled')) return;
  videoPrefDone = expected.videoId;
  if (btn.getAttribute('aria-pressed') !== 'true') {
    videoSwitchUntil = performance.now() + 8000;
    btn.click();
  }
}

// "¿Sigues ahí?" y similares pausan la reproducción tras un rato sin interacción.
function dismissDialogs() {
  const btn = document.querySelector('ytmusic-you-there-renderer button, ytmusic-you-there-renderer yt-button-renderer');
  if (btn) btn.click();
}

function boot() {
  engine = createDeckEngine({ adapter, onState: (s) => ipcRenderer.send('deck:state', s) });
  ipcRenderer.on('deck:cmd', (_e, cmd) => {
    if (cmd.type === 'videoView') return setVideoView(!!cmd.on);
    if (cmd.type === 'videoPref') {
      videoPref = !!cmd.on;
      videoPrefDone = null;
      videoAltId = null;
      if (!videoPref) document.querySelector('ytmusic-av-toggle .song-button')?.click();
      else preferVideo();
      return;
    }
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
