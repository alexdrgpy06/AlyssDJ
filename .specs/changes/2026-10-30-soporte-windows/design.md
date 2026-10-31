---
change: 2026-10-30-soporte-windows
status: approved
rev: 1
approved_rev: 1
approved_hash: 723925d208c0714369882a9b6cd3d115f05a1f498662498d9142602cfac7b4a4
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Design · 2026-10-30-soporte-windows

## Enfoque
- `main/tools.js`: `ensureFfmpeg({dirs,onProgress,log})` descarga `ffmpeg-<plataforma>-<arq>.gz` de los releases de eugeneware/ffmpeg-static (b6.1.1) con el `download` existente, lo descomprime con `zlib.gunzip` (sin `tar`, igual en los tres sistemas) y lo deja como `bin/ffmpeg[.exe]`. `findFfmpeg` busca también en `bin/`. `scripts/setup.js` y `ensureTools` lo llaman en lugar del `npm install ffmpeg-static`.
- `main/auth-import.js`: cada navegador gana rutas por plataforma (`win32`, `darwin`, `linux`); `detectBrowsers` filtra por `process.platform`.
- `findYtdlp`: `os.homedir()` en vez de `process.env.HOME`.
- CI: `.github/workflows/ci.yml`, matriz ubuntu/windows/macos, Node 22, `npm install`, pruebas rápidas (`scripts/test-*.js` sin e2e), y en Linux `xvfb-run` para la autoprueba de arranque de Electron. `shell: bash` para que las variables de entorno funcionen igual.
- `docs/00-instalacion.md` + README: pasos por sistema y tabla «verificado por CI / sin verificar».
- Licencia MIT, repo público con `gh repo edit --visibility public`.

## Contratos
`ensureFfmpeg -> { bin, version, installed }`; error con mensaje de `installHint()`.

## Visual Spec
Sin cambios de interfaz.

## Amendments
