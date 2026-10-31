---
change: 2026-10-31-linux-instalado-y-autoupdate
type: feature
domains: [install]
paths: [scripts/**, main/settings.js, renderer/styles.css, renderer/update-ui.js, renderer/app.js, renderer/index.html, preload/app.js, scripts/**, .github/**, package-lock.json, package.json, build/**, scripts/install-linux.sh, scripts/uninstall-linux.sh, main/updater.js, main/main.js, renderer/app.js, renderer/index.html, preload/app.js, .github/workflows/release.yml, docs/**, README.md, scripts/test-updater.js]
commits: [25cece4]
status: approved
rev: 1
approved_rev: 1
approved_hash: 8cba73fe3bbb072fc60b3ecb7c45203da14d467dee640b87b8ad1f95ce373d2b
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-linux-instalado-y-autoupdate

## Contexto
En Linux hoy se corre desde el repo (`npm install` + `npm start`). Se quiere que un script la deje instalada como una app más (menú de aplicaciones, icono) y que, en los tres sistemas, la app instalada avise y se actualice sola cuando haya un release nuevo en GitHub. Complementa a `instaladores-win-mac`, que produce el .exe y el .dmg. Límite real: macOS solo se actualiza solo si la app está firmada y notarizada, y no hay certificado; en Mac el aviso enlazará a la descarga.

## Requisitos
### REQ-1: Instalación en Linux como app
WHEN el usuario ejecuta `scripts/install-linux.sh` THE SYSTEM SHALL instalar AlyssDJ para su usuario (sin sudo): el AppImage del último release en `~/.local/opt/AlyssDJ/`, una entrada de menú `alyssdj.desktop` con icono y el comando `alyssdj` en `~/.local/bin`.
IF no hay conexión o no existe un release THEN THE SYSTEM SHALL construir desde el repositorio local si se ejecuta desde un clon, o explicar qué falta.
### REQ-2: Desinstalar y reinstalar
WHEN el usuario ejecuta `scripts/uninstall-linux.sh` THE SYSTEM SHALL quitar lo instalado por el script y conservar los datos del usuario (librería y ajustes) salvo que pida `--purge`; volver a instalar sobre una instalación previa la reemplaza sin duplicar entradas.
### REQ-3: Release de Linux
WHEN se publica una etiqueta `v*` THE SYSTEM SHALL construir también un AppImage de Linux x64 y adjuntarlo al release junto con los archivos de actualización (`latest*.yml`).
### REQ-4: Buscar actualizaciones
WHILE la app corre empaquetada THE SYSTEM SHALL comprobar si hay un release nuevo al arrancar y cada 6 horas, sin bloquear la interfaz, y no hacerlo en desarrollo (`npm start`).
### REQ-5: Aviso y elección del usuario
WHEN hay una versión nueva THE SYSTEM SHALL avisar con su número y notas, ofrecer «Descargar e instalar», «Más tarde» y «Omitir esta versión», y descargar solo tras el sí del usuario.
### REQ-6: Instalar sin cortar la música
WHILE un deck esté sonando THE SYSTEM SHALL no reiniciar la app para instalar; la instalación espera a que el usuario cierre la app o confirme tras detener la reproducción.
### REQ-7: Control y privacidad
THE SYSTEM SHALL ofrecer en Ajustes «Buscar actualizaciones automáticamente» (activado) y «Comprobar ahora», consultar solo los releases públicos del repositorio sin enviar datos personales, y verificar la integridad de lo descargado.
### REQ-8: macOS sin firma
WHILE la app de macOS no esté firmada THE SYSTEM SHALL avisar de la nueva versión con un enlace a la página del release en lugar de instalarla sola.

## Fuera de alcance
Firma y notarización, canal beta, y paquetes .deb/.rpm/Flatpak. No puedo probar la actualización real entre dos versiones publicadas desde aquí.
