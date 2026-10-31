---
domain: install
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-10-31-instaladores-win-mac
---
# install · spec

## herramientas externas descargadas

WHEN no hay ffmpeg utilizable THE SYSTEM SHALL descargar un ffmpeg estático a `bin/` en Windows x64, Linux x64/arm64 y macOS x64/arm64, al instalar y al arrancar.
IF la descarga falla THEN THE SYSTEM SHALL mostrar el comando de instalación manual de la plataforma sin impedir que la app abra.

## instaladores de Windows y macOS

WHEN se publica una etiqueta v* THE SYSTEM SHALL construir y adjuntar a la Release un instalador .exe de Windows y un .dmg de macOS (Intel y Apple Silicon) sin firmar, y comprobar en cada cambio que el paquete arranca, baja sus herramientas y analiza una pista.
