---
domain: install
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-10-30-soporte-windows
---
# install · design

## ensureFfmpeg

`tools.ensureFfmpeg` baja `ffmpeg-<plataforma>-<arq>.gz` (eugeneware/ffmpeg-static b6.1.1), lo descomprime con `zlib` y lo deja en `bin/`; `findFfmpeg` busca configurado, `bin/`, sistema.
