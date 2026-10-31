---
change: 2026-10-31-instaladores-win-mac
status: approved
rev: 1
approved_rev: 1
approved_hash: 53d406ecddeb3a1e4a1077a06e572574b5f620e849e779ffc318b14dd71e73e3
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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
