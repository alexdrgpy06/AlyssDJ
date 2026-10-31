---
domain: install
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-10-31-linux-instalado-y-autoupdate
---
# install · design

## ensureFfmpeg

`tools.ensureFfmpeg` baja `ffmpeg-<plataforma>-<arq>.gz` (eugeneware/ffmpeg-static b6.1.1), lo descomprime con `zlib` y lo deja en `bin/`; `findFfmpeg` busca configurado, `bin/`, sistema.

## electron-builder

`package.json > build` (sin asar), icono en `build/`, `release.yml` con matriz windows/macos y `test-installers.js packaged` en el CI; instalada, las herramientas van a la carpeta de datos del usuario.

## updater y scripts

`main/updater.js` (electron-updater con GitHub, inyectable), `renderer/update-ui.js` (aviso), `scripts/install-linux.sh` y `uninstall-linux.sh`; `release.yml` publica AppImage y latest*.yml.
