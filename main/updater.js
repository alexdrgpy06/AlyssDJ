// Actualizaciones: comprueba si hay un release nuevo en GitHub (solo la API pública, sin enviar datos personales),
// avisa, y descarga e instala solo si el usuario lo acepta y no hay un deck sonando. En macOS sin firma solo avisa.
'use strict';

const HOURS = 6;
const REPO = 'alexdrgpy06/AlyssDJ';

function notesOf(info) {
  const n = info?.releaseNotes;
  if (!n) return '';
  return (Array.isArray(n) ? n.map((x) => x.note || '').join('\n') : String(n)).replace(/<[^>]+>/g, '').trim().slice(0, 1500);
}

// deps: { autoUpdater, settings, send, isPlaying, platform, isPackaged, now }. Todo inyectable para probarlo sin Electron.
function createUpdater({ autoUpdater, settings, send, isPlaying = () => false, platform = process.platform, isPackaged = true, setTimer = setInterval, clearTimer = clearInterval }) {
  const notifyOnly = platform === 'darwin'; // sin firma, macOS no puede instalarse sola
  let state = { stage: 'idle', version: null, notes: '', progress: 0, mode: notifyOnly ? 'notify' : 'install', url: null, error: null, manual: false };
  let timer = null;
  const emit = (patch = {}) => {
    state = { ...state, ...patch };
    send('update:state', state);
  };

  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = !notifyOnly;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('update-available', (info) => {
      if (settings.get().skipUpdate === info.version && !state.manual) return emit({ stage: 'idle' });
      emit({ stage: 'available', version: info.version, notes: notesOf(info), url: `https://github.com/${REPO}/releases/tag/v${info.version}`, error: null });
    });
    autoUpdater.on('update-not-available', () => emit({ stage: state.manual ? 'none' : 'idle' }));
    autoUpdater.on('download-progress', (p) => emit({ stage: 'downloading', progress: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', () => emit({ stage: 'downloaded', progress: 100 }));
    autoUpdater.on('error', (e) => emit({ stage: state.manual ? 'error' : 'idle', error: state.manual ? String(e?.message || e).slice(0, 200) : null }));
  }

  async function check({ manual = false } = {}) {
    if (!isPackaged || !autoUpdater) return emit({ stage: 'none', manual }) && state;
    if (!manual && settings.get().autoUpdate === false) return state;
    if (['downloading', 'downloaded'].includes(state.stage)) return state;
    state.manual = manual;
    emit({ stage: 'checking', manual });
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      emit({ stage: manual ? 'error' : 'idle', error: manual ? String(e?.message || e).slice(0, 200) : null });
    }
    return state;
  }

  function start(delayMs = 15000) {
    if (!isPackaged || !autoUpdater) return;
    setTimeout(() => check(), delayMs);
    timer = setTimer(() => check(), HOURS * 3600 * 1000);
    timer.unref?.();
  }

  return {
    start,
    check,
    state: () => state,
    // Solo se descarga tras el sí del usuario; en macOS sin firma no se descarga: se abre la página del release.
    async download() {
      if (state.stage !== 'available' || notifyOnly) return { ok: false, reason: notifyOnly ? 'notify' : 'estado' };
      emit({ stage: 'downloading', progress: 0 });
      try {
        await autoUpdater.downloadUpdate();
        return { ok: true };
      } catch (e) {
        emit({ stage: 'error', error: String(e?.message || e).slice(0, 200) });
        return { ok: false, reason: 'error' };
      }
    },
    // No se reinicia con música sonando: la instalación espera a que el usuario pare los decks (o cierre la app).
    install() {
      if (state.stage !== 'downloaded') return { ok: false, reason: 'estado' };
      if (isPlaying()) return { ok: false, reason: 'playing' };
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    },
    skip() {
      if (state.version) settings.set({ skipUpdate: state.version });
      emit({ stage: 'idle' });
    },
    later: () => emit({ stage: 'idle' }),
    stop: () => timer && clearTimer(timer),
  };
}

module.exports = { createUpdater, REPO, HOURS };
