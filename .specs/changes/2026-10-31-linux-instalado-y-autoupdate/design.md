---
change: 2026-10-31-linux-instalado-y-autoupdate
status: approved
rev: 1
approved_rev: 1
approved_hash: 41bcd14fc0c772d5a0ee92940c5b3858501c3d16f836d6e3a7cc1965f26f32fa
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-linux-instalado-y-autoupdate

## Enfoque
- `electron-updater` (dependencia de producción) con proveedor `github` (owner alexdrgpy06, repo AlyssDJ); `main/updater.js`: `autoDownload = false`, comprobación al arrancar y cada 6 h solo si `app.isPackaged`; eventos IPC `update:available|progress|downloaded|error` y respuestas `update:download|install|skip|check`. «Omitir» guarda la versión en settings (`skipUpdate`).
- Instalar: `quitAndInstall` solo cuando ningún deck suena (el renderer informa `playing`); si suena, el botón queda pendiente hasta detener o cerrar la app (`autoInstallOnAppQuit = true`).
- macOS sin firma: `updater.mode = 'notify'` (solo avisa con enlace); se activa la instalación automática cuando exista firma (`CSC_LINK` en el release).
- Linux: `build.linux` AppImage x64 con icono y categoría AudioVideo; `scripts/install-linux.sh` descarga el último AppImage del release vía API pública, lo copia a `~/.local/opt/AlyssDJ/`, escribe el `.desktop` y el icono, enlaza `~/.local/bin/alyssdj` y ejecuta `update-desktop-database`/`gtk-update-icon-cache` si existen; sin release y dentro de un clon construye con `npm run dist:linux`. El AppImage se actualiza solo en su sitio (electron-updater usa `APPIMAGE`).
- `uninstall-linux.sh [--purge]` quita lo anterior; `--purge` también `~/.config/AlyssDJ` y la librería con confirmación.
- UI: banner no modal en la barra superior con acciones y barra de progreso; ajustes de actualización en Ajustes.
- Pruebas: `scripts/test-updater.js` con un servidor de releases falso (latest-linux.yml / latest.yml) y un `$HOME` temporal para el script de instalación (con `--from-dir` apuntando a un AppImage de mentira) que verifica archivos, `.desktop` válido y desinstalación.

## Contratos
Archivos del release: `AlyssDJ-<v>.AppImage`, `AlyssDJ-Setup-<v>.exe`, `AlyssDJ-<v>-<arch>.dmg`, `latest.yml`, `latest-linux.yml`, `latest-mac.yml`.

## Visual Spec
Banner de actualización discreto sobre la barra superior; el mismo estilo oscuro de la app.

## Amendments
