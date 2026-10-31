---
domain: install
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-10-31-linux-instalado-y-autoupdate
---
# install · spec

## herramientas externas descargadas

WHEN no hay ffmpeg utilizable THE SYSTEM SHALL descargar un ffmpeg estático a `bin/` en Windows x64, Linux x64/arm64 y macOS x64/arm64, al instalar y al arrancar.
IF la descarga falla THEN THE SYSTEM SHALL mostrar el comando de instalación manual de la plataforma sin impedir que la app abra.

## instaladores de Windows y macOS

WHEN se publica una etiqueta v* THE SYSTEM SHALL construir y adjuntar a la Release un instalador .exe de Windows y un .dmg de macOS (Intel y Apple Silicon) sin firmar, y comprobar en cada cambio que el paquete arranca, baja sus herramientas y analiza una pista.

## Linux instalado como app y actualizaciones

WHEN el usuario ejecuta scripts/install-linux.sh THE SYSTEM SHALL instalar el AppImage del último release en el HOME del usuario con entrada de menú, icono y comando alyssdj, sin sudo, y poder quitarlo con uninstall-linux.sh conservando sus datos.
WHILE la app corre empaquetada THE SYSTEM SHALL buscar releases nuevos al arrancar y cada 6 horas, avisar y descargar solo con el permiso del usuario, sin reiniciar con un deck sonando; en macOS sin firma solo avisa con un enlace.
