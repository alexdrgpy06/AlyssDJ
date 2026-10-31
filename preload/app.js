// Puente entre la UI (app://ui) y el proceso principal.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel) => (cb) => {
  const h = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('ytdj', {
  deck: {
    cmd: (id, cmd) => ipcRenderer.send('deck:cmd', id, cmd),
    show: (id, rect) => ipcRenderer.send('deck:show', id, rect),
    onState: on('deck:state'),
    onFrame: on('deck:frame'),
    onReady: on('deck:ready'),
  },
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    skip: () => ipcRenderer.invoke('update:skip'),
    later: () => ipcRenderer.invoke('update:later'),
    openRelease: (url) => ipcRenderer.invoke('update:open-release', url),
    onState: on('update:state'),
    setPlaying: (p) => ipcRenderer.send('app:playing', p),
  },
  video: {
    open: (opts) => ipcRenderer.invoke('video:open', opts),
    close: () => ipcRenderer.invoke('video:close'),
    state: () => ipcRenderer.invoke('video:state'),
    displays: () => ipcRenderer.invoke('video:displays'),
    show: (which) => ipcRenderer.send('video:show', which),
    onState: on('video:state'),
    localSrc: (key) => ipcRenderer.invoke('video:local-src', key),
    setDeckSource: (id, src) => ipcRenderer.send('video:deck-source', id, src),
    sync: (id, s) => ipcRenderer.send('video:sync', id, s),
  },
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    browsers: () => ipcRenderer.invoke('auth:browsers'),
    importBrowser: (id) => ipcRenderer.invoke('auth:import-browser', id),
    verify: () => ipcRenderer.invoke('auth:verify'),
    onChanged: on('auth:changed'),
  },
  lib: {
    search: (q) => ipcRenderer.invoke('lib:search', q),
    liked: () => ipcRenderer.invoke('lib:liked'),
    playlists: () => ipcRenderer.invoke('lib:playlists'),
    playlist: (id) => ipcRenderer.invoke('lib:playlist', id),
    radio: (videoId) => ipcRenderer.invoke('lib:radio', videoId),
    videoType: (videoId) => ipcRenderer.invoke('lib:video-type', videoId),
    importPlaylists: () => ipcRenderer.invoke('lib:import-playlists'),
    onImportProgress: on('lib:import-progress'),
    crates: () => ipcRenderer.invoke('crates:list'),
    crate: (id) => ipcRenderer.invoke('crates:get', id),
  },
  analysis: {
    request: (id, opts) => ipcRenderer.invoke('analysis:request', id, opts),
    cancel: (id) => ipcRenderer.invoke('analysis:cancel', id),
    get: (id) => ipcRenderer.invoke('analysis:get', id),
    list: () => ipcRenderer.invoke('analysis:list'),
    setMixEdit: (id, edit) => ipcRenderer.invoke('analysis:mixedit', id, edit),
    setMeta: (id, patch) => ipcRenderer.invoke('analysis:set-meta', id, patch),
    removeAudio: (id) => ipcRenderer.invoke('analysis:remove-audio', id),
    openCache: () => ipcRenderer.invoke('analysis:open-cache'),
    onEvent: on('analysis:event'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    pickDir: () => ipcRenderer.invoke('settings:pick-dir'),
    libraryDir: () => ipcRenderer.invoke('settings:library-dir'),
    openPath: (p) => ipcRenderer.invoke('path:open', p),
  },
  rec: {
    sources: () => ipcRenderer.invoke('rec:sources'),
    start: () => ipcRenderer.invoke('rec:start'),
    stop: () => ipcRenderer.invoke('rec:stop'),
    state: () => ipcRenderer.invoke('rec:state'),
    reveal: (f) => ipcRenderer.invoke('path:reveal', f),
    onEnded: on('rec:ended'),
  },
  tools: {
    check: () => ipcRenderer.invoke('tools:check'),
    install: () => ipcRenderer.invoke('tools:install'),
    onProgress: on('tools:progress'),
  },
  local: {
    list: () => ipcRenderer.invoke('local:list'),
    addFolder: () => ipcRenderer.invoke('local:add-folder'),
    removeFolder: (dir) => ipcRenderer.invoke('local:remove-folder', dir),
    register: (p) => ipcRenderer.invoke('local:register', p),
    pathFor: (file) => webUtils.getPathForFile(file),
    onEvent: on('local:event'),
  },
});
