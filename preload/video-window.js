// Preload de la ventana de video: recibe la disposición y la sincronización desde el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ytdjVideo', {
  onLayout: (cb) => ipcRenderer.on('vwin:layout', (_e, l) => cb(l)),
  onSync: (cb) => ipcRenderer.on('vwin:sync', (_e, id, s) => cb(id, s)),
});
