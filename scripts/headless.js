// Comando para lanzar Electron en las pruebas. En Linux de escritorio usa una pantalla virtual (xvfb) para que la ventana de
// la app no aparezca encima de lo que estés haciendo; en la CI (que ya corre bajo xvfb), Windows y macOS no cambia nada.
// YTDJ_VISIBLE=1 fuerza la ventana real.  Uso: spawnSync(...require('./headless.js')(['.']), opts)
'use strict';
const { spawnSync } = require('child_process');

let has;
module.exports = (args = ['.']) => {
  const electron = require('electron');
  if (has === undefined) has = process.platform === 'linux' && !process.env.CI && !process.env.YTDJ_VISIBLE && spawnSync('which', ['xvfb-run']).status === 0;
  return has ? ['xvfb-run', ['-a', electron, ...args]] : [electron, args];
};
