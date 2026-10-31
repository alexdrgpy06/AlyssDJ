---
change: 2026-10-31-instaladores-win-mac
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-instaladores-win-mac

## Enfoque
- `electron-builder` como devDependency; configuración `build` en `package.json`: `appId com.alejandro.alyssdj`, `files` limitado a `main/ preload/ renderer/ shared/ package.json`, `win: nsis x64`, `mac: dmg [x64, arm64]`, icono generado a partir del logo en `build/icon.png`.
- yt-dlp y ffmpeg no se empaquetan: `ensureTools` ya los baja a la carpeta de datos (`toolDirs`) en el primer arranque; se comprueba que `toolDirs` apunte a `userData` cuando `app.isPackaged`.
- `.github/workflows/release.yml`: se dispara con `v*`, matriz windows/macos, `electron-builder --publish never` y `gh release upload`.
- CI: paso `npx electron-builder --dir` en windows y macos.
- `docs/00-instalacion.md`: sección «Instaladores» con SmartScreen/Gatekeeper (clic derecho → Abrir; `xattr -dr com.apple.quarantine`).

## Contratos
Artefactos: `AlyssDJ-Setup-<versión>.exe`, `AlyssDJ-<versión>-<arch>.dmg`.

## Visual Spec
Sin cambios de interfaz.

## Amendments
