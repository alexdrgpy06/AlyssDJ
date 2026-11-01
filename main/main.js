'use strict';
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { execFile } = require('child_process');
const { app, BrowserWindow, WebContentsView, ipcMain, protocol, session, shell, screen, dialog } = require('electron');
const settings = require('./settings');
const { Analyzer } = require('./analyzer');
const { YtmLibrary } = require('./ytm-library');
const ytdlp = require('./ytdlp');
const tools = require('./tools');
const authImport = require('./auth-import');
const { LocalLibrary } = require('./local-library');
const { createUpdater } = require('./updater');
const libSave = require('./library-save');

const ROOT = path.join(__dirname, '..');
const YTM = 'https://music.youtube.com/';
const PARTITION = 'persist:ytm';
// UA de Chrome normal: con el UA de Electron, Google suele bloquear el inicio de sesión.
const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const CHROME_UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
const DECKS = ['A', 'B'];

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('AlyssDJ');
if (process.env.YTDJ_USERDATA) app.setPath('userData', process.env.YTDJ_USERDATA);
app.userAgentFallback = CHROME_UA;
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

let win = null;
let ffmpegBin = 'ffmpeg';
let localLib = null;
let toolDirs = [];
let coversDir = '';
let libraryView = null;
let analyzer = null;
const decks = {}; // id → { view, ready, replay: {mix, routing, rate, loop}, pendingLoad }

function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

// ---------- protocolo app:// (UI + caché con soporte de Range para poder hacer seek) ----------
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, decodeURIComponent(rel)));
  return p.startsWith(base + path.sep) ? p : null;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.webm': 'audio/webm', '.opus': 'audio/ogg', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.aiff': 'audio/aiff', '.aif': 'audio/aiff', '.wma': 'audio/x-ms-wma' };

function serveFile(file, request) {
  if (!file || !fs.existsSync(file)) return new Response('not found', { status: 404 });
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const range = request.headers.get('range');
  const m = range && range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
      status: 206,
      headers: { 'content-type': type, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), {
    headers: { 'content-type': type, 'content-length': String(size), 'accept-ranges': 'bytes' },
  });
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    if (url.host === 'ui') {
      const rel = url.pathname.replace(/^\//, '');
      // La caché va bajo el mismo origen que la UI: si no, Web Audio recibe silencio por CORS.
      // Archivos locales: solo los que están en el índice (el renderer pide por id, nunca por ruta).
      if (rel.startsWith('cover/')) return serveFile(safeJoin(coversDir, `${decodeURIComponent(rel.slice(6))}.jpg`), request);
      if (rel === 'build/icon.png') return serveFile(path.join(ROOT, 'build/icon.png'), request);
      if (rel.startsWith('localfile/')) return serveFile(localLib.pathOf(decodeURIComponent(rel.slice(10))), request);
      if (rel.startsWith('cache/')) return serveFile(safeJoin(analyzer.cacheDir, rel.slice(6)), request);
      const base = rel.startsWith('shared/') ? ROOT : path.join(ROOT, 'renderer');
      return serveFile(safeJoin(base, rel || 'index.html'), request);
    }
    return new Response('not found', { status: 404 });
  });
}

// ---------- sesiones y permisos ----------
function setupSession(ses) {
  ses.setUserAgent(CHROME_UA);
  const allowed = new Set(['media', 'midi', 'midiSysex', 'speaker-selection', 'fullscreen']);
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
  ses.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));
}

// ---------- vistas de deck (music.youtube.com con tu sesión) ----------
function createDeckView(id) {
  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      preload: path.join(ROOT, 'preload', 'deck.js'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      additionalArguments: [`--ytdj-deck=${id}`],
    },
  });
  view.setVisible(false);
  view.setBackgroundColor('#000000');
  win.contentView.addChildView(view);
  const wc = view.webContents;
  wc.setAudioMuted(false);
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('did-start-navigation', (e) => {
    if (e.isMainFrame && !e.isSameDocument) decks[id].ready = false;
  });
  wc.on('render-process-gone', () => {
    decks[id].ready = false;
    send('deck:state', id, { error: 'La vista del deck se cerró; recargando…' });
    setTimeout(() => wc.loadURL(YTM), 1000);
  });
  decks[id] = { view, ready: false, replay: {}, pendingLoad: null };
  wc.loadURL(YTM);
}

function deckCmd(id, cmd) {
  const d = decks[id];
  if (!d) return;
  if (['mix', 'routing', 'rate', 'loop'].includes(cmd.type)) d.replay[cmd.type] = { ...(d.replay[cmd.type] || {}), ...cmd };
  if (!d.ready) {
    if (cmd.type === 'load') d.pendingLoad = cmd;
    return;
  }
  d.view.webContents.send('deck:cmd', cmd);
}

function deckIdOf(sender) {
  return DECKS.find((id) => decks[id]?.view.webContents.id === sender.id);
}

ipcMain.on('deck:ready', (e) => {
  const id = deckIdOf(e.sender);
  if (!id) return;
  const d = decks[id];
  d.ready = true;
  for (const cmd of Object.values(d.replay)) e.sender.send('deck:cmd', cmd);
  if (d.pendingLoad) {
    e.sender.send('deck:cmd', d.pendingLoad);
    d.pendingLoad = null;
  }
  send('deck:ready', id);
});
ipcMain.on('deck:state', (e, state) => {
  const id = deckIdOf(e.sender);
  if (id) send('deck:state', id, state);
});
// La vista no tiene reproductor (p. ej. tras un error): recargar en la URL de la pista.
ipcMain.on('deck:reload-at', (e, videoId) => {
  const id = deckIdOf(e.sender);
  if (id) decks[id].view.webContents.loadURL(`${YTM}watch?v=${encodeURIComponent(videoId)}`);
});
ipcMain.on('deck:cmd', (_e, id, cmd) => deckCmd(id, cmd));
ipcMain.on('deck:show', (_e, id, rect) => {
  const d = decks[id];
  if (!d) return;
  if (rect) {
    attach(id, win);
    d.view.setBounds({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
    d.view.setVisible(true);
  } else d.view.setVisible(false);
});

// La vista de YouTube Music de un deck se muestra flotando sobre la ventana principal (botón YTM).
function attach(id, host) {
  const v = decks[id]?.view;
  if (!v || !host || host.isDestroyed()) return;
  host.contentView.addChildView(v);
}

// ---------- acerca de ----------
ipcMain.handle('app:info', () => ({ name: 'AlyssDJ', version: app.getVersion(), org: 'AlystechPY', author: 'Alejandro Ramírez', license: 'MIT', repo: 'https://github.com/alexdrgpy06/AlyssDJ' }));
ipcMain.handle('app:open-repo', () => shell.openExternal('https://github.com/alexdrgpy06/AlyssDJ'));

// ---------- actualizaciones ----------
let updater = null;
let anyPlaying = false;
ipcMain.on('app:playing', (_e, playing) => (anyPlaying = !!playing));
ipcMain.handle('update:state', () => updater?.state() || { stage: 'idle' });
ipcMain.handle('update:check', () => updater?.check({ manual: true }));
ipcMain.handle('update:download', () => updater?.download());
ipcMain.handle('update:install', () => updater?.install());
ipcMain.handle('update:skip', () => updater?.skip());
ipcMain.handle('update:later', () => updater?.later());
ipcMain.handle('update:open-release', (_e, url) => (/^https:\/\/github\.com\/alexdrgpy06\/AlyssDJ\/releases\//.test(String(url)) ? shell.openExternal(url) : null));
// ---------- sesión de YouTube Music ----------
async function authStatus() {
  const ses = session.fromPartition(PARTITION);
  const cookies = await ses.cookies.get({ domain: '.youtube.com' });
  return { loggedIn: cookies.some((c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID') };
}

function openLogin() {
  const login = new BrowserWindow({
    width: 520,
    height: 720,
    parent: win,
    title: 'Iniciar sesión en YouTube Music',
    webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true },
  });
  // Google rechaza el inicio de sesión en navegadores embebidos basados en Electron; con la huella de Firefox a veces lo deja pasar.
  login.webContents.setUserAgent(FIREFOX_UA);
  login.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=' + encodeURIComponent(YTM));
  login.webContents.on('did-navigate', (_e, url) => {
    if (url.startsWith(YTM)) setTimeout(() => !login.isDestroyed() && login.close(), 800);
  });
  login.on('closed', async () => {
    reloadViews();
    send('auth:changed', await authStatus());
  });
}

function reloadViews() {
  for (const id of DECKS) decks[id].view.webContents.loadURL(YTM);
  libraryView.webContents.loadURL(YTM);
}

ipcMain.handle('auth:status', authStatus);
ipcMain.handle('auth:login', () => openLogin());
ipcMain.handle('auth:logout', async () => {
  await session.fromPartition(PARTITION).clearStorageData();
  reloadViews();
  const st = await authStatus();
  send('auth:changed', st);
  return st;
});

// Importar la sesión desde un navegador instalado (Google bloquea el login dentro de Electron).
ipcMain.handle('auth:browsers', () => authImport.detectBrowsers());
ipcMain.handle('auth:import-browser', async (_e, browserId) => {
  try {
    const tool = await ytdlp.findYtdlp(settings.get().ytdlpPath);
    if (!tool) throw new Error('yt-dlp todavía no está instalado: espera a que termine de descargarse (arriba a la derecha) o usa Ajustes → Instalar / actualizar herramientas.');
    const r = await authImport.importFromBrowser({ bin: tool.bin, browserId, session: session.fromPartition(PARTITION) });
    reloadViews();
    const st = await authStatus();
    send('auth:changed', st);
    return { ok: true, data: { count: r.count, ...st } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
// Comprueba con la propia página de YouTube Music si la sesión quedó iniciada (LOGGED_IN de su configuración).
ipcMain.handle('auth:verify', async () => {
  for (let i = 0; i < 20; i++) {
    try {
      const v = await libraryView.webContents.executeJavaScript('(window.ytcfg && window.ytcfg.data_ && "LOGGED_IN" in window.ytcfg.data_) ? !!window.ytcfg.data_.LOGGED_IN : null');
      if (v !== null) return { loggedIn: v };
    } catch {}
    await new Promise((r) => setTimeout(r, 750));
  }
  return { loggedIn: null };
});

// ---------- biblioteca ----------
const library = new YtmLibrary(() => libraryView?.webContents, { cacheFile: () => path.join(app.getPath('userData'), 'popularity.json') });
const wrap = (fn) => async (_e, ...args) => {
  try {
    return { ok: true, data: await fn(...args) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
ipcMain.handle('lib:search', wrap((q) => library.search(q)));
ipcMain.handle('lib:liked', wrap(() => library.liked()));
ipcMain.handle('lib:playlists', wrap(() => library.playlists()));
ipcMain.handle('lib:playlist', wrap((id) => library.playlist(id)));
ipcMain.handle('lib:radio', wrap((videoId) => library.radio(videoId)));
ipcMain.handle('lib:popularity', wrap((ids) => library.popularityMany(Array.isArray(ids) ? ids.filter((x) => /^[\w-]{6,20}$/.test(x)) : [])));

// Importar playlists: copia título y pistas de cada lista (y Me gusta) a disco para usarlas sin conexión y en AutoMix.
const cratesFile = () => path.join(app.getPath('userData'), 'playlists.json');
const readCrates = () => {
  try { return JSON.parse(fs.readFileSync(cratesFile(), 'utf8')); } catch { return []; }
};
ipcMain.handle('lib:import-playlists', wrap(async () => {
  const lists = [{ browseId: 'VLLM', title: 'Canciones que me gustan', thumb: '' }, ...(await library.playlists())];
  const out = [];
  for (let i = 0; i < lists.length; i++) {
    const pl = lists[i];
    send('lib:import-progress', { done: i, total: lists.length, title: pl.title });
    try {
      const tracks = await library.browseSongs(pl.browseId, 40);
      out.push({ id: pl.browseId, title: pl.title, thumb: pl.thumb, tracks, importedAt: new Date().toISOString() });
    } catch (e) {
      send('lib:import-progress', { done: i, total: lists.length, title: pl.title, error: e.message });
    }
  }
  fs.writeFileSync(cratesFile(), JSON.stringify(out));
  send('lib:import-progress', { done: lists.length, total: lists.length, finished: true });
  return out.map(({ tracks, ...l }) => ({ ...l, count: tracks.length }));
}));
ipcMain.handle('crates:list', () => readCrates().map(({ tracks, ...l }) => ({ ...l, count: tracks.length })));
ipcMain.handle('crates:get', (_e, id) => readCrates().find((c) => c.id === id)?.tracks || []);

// ---------- análisis (yt-dlp, siempre a pedido) ----------
ipcMain.handle('analysis:request', (_e, id, opts) => analyzer.request(id, opts));
ipcMain.handle('analysis:cancel', (_e, id) => analyzer.cancel(id));
ipcMain.handle('analysis:get', (_e, id) => analyzer.get(id));
ipcMain.handle('analysis:list', () => analyzer.list());
ipcMain.handle('analysis:mixedit', (_e, id, edit) => analyzer.setMixEdit(id, edit));
ipcMain.handle('analysis:set-meta', (_e, id, patch) => analyzer.setMeta(id, patch));
ipcMain.handle('analysis:remove-audio', (_e, id) => analyzer.removeAudio(id));
ipcMain.handle('analysis:open-cache', () => shell.openPath(analyzer.cacheDir));

// ---------- ajustes y herramientas ----------
ipcMain.handle('settings:get', () => settings.get());
// Carpeta donde se guardan las pistas de YouTube analizadas/reproducidas; forma parte de las carpetas de música.
const musicHome = () => {
  try {
    return app.getPath('music');
  } catch {
    return path.join(app.getPath('userData'), 'Music'); // sin carpeta de Música del sistema (perfil raro o entorno aislado)
  }
};
const libraryDir = () => settings.get().libraryDir || libSave.defaultLibraryDir(musicHome());
function syncMusicDirs() {
  const st = settings.get();
  if (st.saveOnAnalyze === false && st.saveOnPlay === false) return;
  const dirs = libSave.withLibraryDir(st.musicDirs, libraryDir());
  if (dirs.length !== (st.musicDirs || []).length) settings.set({ musicDirs: dirs });
}
ipcMain.handle('settings:set', (_e, patch) => {
  settings.set(patch);
  syncMusicDirs();
  return settings.get();
});
ipcMain.handle('settings:pick-dir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Carpeta de la librería de YouTube', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('settings:library-dir', () => libraryDir());
ipcMain.handle('path:open', (_e, p) => shell.openPath(p));
ipcMain.handle('tools:check', async () => {
  const st = settings.get();
  const yt = await ytdlp.findYtdlp(st.ytdlpPath);
  const ff = await tools.findFfmpeg(st.ffmpegPath, toolDirs);
  return { ytdlp: yt, ffmpeg: ff, ffmpegHint: ff ? '' : tools.installHint() };
});

// Instala lo que falte (yt-dlp se descarga solo; ffmpeg se detecta y, si no está, se avisa cómo instalarlo).
let ensuring = null;
function ensureTools() {
  if (ensuring) return ensuring;
  ensuring = (async () => {
    const st = settings.get();
    try {
      const ff = await tools.ensureFfmpeg({ dirs: toolDirs, configured: st.ffmpegPath });
      ffmpegBin = ff.bin;
      if (ff.installed) send('tools:progress', { stage: 'installed', version: ff.version });
    } catch (e) {
      send('tools:progress', { stage: 'error', error: e.message });
    }
    try {
      const r = await tools.ensureYtdlp({
        dirs: toolDirs,
        configured: st.ytdlpPath,
        onProgress: (p) => send('tools:progress', { stage: 'ytdlp', progress: p }),
      });
      if (r.installed) send('tools:progress', { stage: 'installed', version: r.version });
      tools.maybeUpdate(r.bin, toolDirs).catch(() => {});
    } catch (e) {
      send('tools:progress', { stage: 'error', error: e.message });
    }
    send('tools:progress', { stage: 'done' });
  })().finally(() => (ensuring = null));
  return ensuring;
}
ipcMain.handle('tools:install', () => ensureTools());

// ---------- grabación de la mezcla (Linux: monitor de PulseAudio/PipeWire + ffmpeg) ----------
// Las vistas de YouTube Music suenan en otros procesos, así que la mezcla completa solo se puede capturar a la salida.
let rec = null;
const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { timeout: 8000 }, (err, out) => resolve(err ? '' : String(out))));
async function monitorSources() {
  const out = await run('pactl', ['list', 'short', 'sources']);
  return out.split('\n').map((l) => l.split('\t')[1]).filter((n) => n && n.endsWith('.monitor'));
}
ipcMain.handle('rec:sources', wrap(async () => {
  const def = (await run('pactl', ['get-default-sink'])).trim();
  return { sources: await monitorSources(), default: def ? `${def}.monitor` : '' };
}));
ipcMain.handle('rec:start', wrap(async () => {
  if (process.platform !== 'linux') throw new Error('La grabación de la mezcla está disponible en Linux (PulseAudio/PipeWire) por ahora.');
  if (rec) throw new Error('Ya se está grabando');
  const def = (await run('pactl', ['get-default-sink'])).trim();
  const source = settings.get().recordSource || (def && `${def}.monitor`);
  if (!source) throw new Error('No se encontró la salida de audio a grabar (¿está pactl/PipeWire disponible?)');
  const dir = path.join(musicHome(), 'AlyssDJ');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const file = path.join(dir, `mix-${stamp}.mp3`);
  const p = require('child_process').spawn(ffmpegBin, ['-y', '-loglevel', 'error', '-f', 'pulse', '-i', source, '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '256k', file]);
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  rec = { p, file, t0: Date.now(), err: () => err };
  p.on('close', () => { if (rec?.p === p) { rec = null; send('rec:ended', { file, error: err.trim() }); } });
  return { file, source };
}));
ipcMain.handle('rec:stop', wrap(async () => {
  if (!rec) return null;
  const r = rec;
  rec = null;
  const closed = new Promise((res) => r.p.once('close', res));
  r.p.stdin.write('q');
  setTimeout(() => r.p.kill('SIGINT'), 4000);
  await closed;
  const size = fs.existsSync(r.file) ? fs.statSync(r.file).size : 0;
  if (!size) throw new Error(r.err().trim().split('\n').pop() || 'La grabación quedó vacía');
  return { file: r.file, seconds: Math.round((Date.now() - r.t0) / 1000), size };
}));
ipcMain.handle('rec:state', () => (rec ? { recording: true, file: rec.file, t0: rec.t0 } : { recording: false }));
ipcMain.handle('path:reveal', (_e, f) => shell.showItemInFolder(f));

// ---------- música local ----------
const musicDirs = () => settings.get().musicDirs || [];
const localSnapshot = () => ({ rows: localLib.list(musicDirs()), dirs: musicDirs(), pending: localLib.pending() });
ipcMain.handle('local:list', wrap(() => (localLib.scan(musicDirs()), localSnapshot())));
ipcMain.handle('local:add-folder', wrap(async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Añadir carpeta de música', properties: ['openDirectory'] });
  if (!r.canceled && r.filePaths[0]) {
    const dirs = [...new Set([...musicDirs(), r.filePaths[0]])];
    settings.set({ musicDirs: dirs });
    localLib.scan(dirs);
  }
  return localSnapshot();
}));
ipcMain.handle('local:remove-folder', wrap((dir) => (settings.set({ musicDirs: musicDirs().filter((d) => d !== dir) }), localSnapshot())));
ipcMain.handle('local:register', wrap((p) => localLib.register(p)));

// ---------- arranque ----------
app.whenReady().then(() => {
  registerAppProtocol();
  setupSession(session.defaultSession);
  const ytm = session.fromPartition(PARTITION);
  setupSession(ytm);

  coversDir = path.join(app.getPath('userData'), 'covers');
  // Instalada, la carpeta de la app puede ser de solo lectura: yt-dlp y ffmpeg van a la carpeta de datos del usuario.
  toolDirs = app.isPackaged ? [path.join(app.getPath('userData'), 'bin')] : [path.join(ROOT, 'bin'), path.join(app.getPath('userData'), 'bin')];
  ytdlp.setManagedDirs(toolDirs);
  localLib = new LocalLibrary({
    file: path.join(app.getPath('userData'), 'local-index.json'),
    coversDir,
    ffmpeg: () => ffmpegBin,
    emit: (ev) => send('local:event', ev),
  });
  analyzer = new Analyzer({
    localLib,
    libraryDir,
    ffmpeg: () => ffmpegBin,
    cacheDir: path.join(app.getPath('userData'), 'cache'),
    settings,
    session: ytm,
    emit: (ev) => send('analysis:event', ev),
  });

  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0b0d10',
    title: 'AlyssDJ',
    webPreferences: { preload: path.join(ROOT, 'preload', 'app.js'), contextIsolation: true, sandbox: true },
  });
  win.loadURL('app://ui/index.html');

  for (const id of DECKS) createDeckView(id);
  libraryView = new WebContentsView({ webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } });
  libraryView.setVisible(false);
  win.contentView.addChildView(libraryView);
  libraryView.webContents.setAudioMuted(true);
  libraryView.webContents.loadURL(YTM);

  syncMusicDirs();
  win.webContents.once('did-finish-load', () => ensureTools());
  if (app.isPackaged) {
    updater = createUpdater({ autoUpdater: require('electron-updater').autoUpdater, settings, send: (ch, p) => send(ch, p), isPlaying: () => anyPlaying, platform: process.platform, isPackaged: true });
    updater.start();
  }
  if (process.env.YTDJ_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  if (process.env.YTDJ_SELFTEST) require(process.env.YTDJ_SELFTEST_MODULE || './selftest')(win, decks);
});

app.on('window-all-closed', () => app.quit());

