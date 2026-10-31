---
change: 2026-10-31-instaladores-win-mac
type: feature
domains: [install]
paths: [docs/**, main/main.js, main/main.js, .github/workflows/ci.yml, .github/workflows/release.yml, build/**, .gitignore, package-lock.json, scripts/packaged-selftest.js, scripts/test-installers.js, package.json, build/**, .github/workflows/release.yml, main/main.js, main/tools.js, docs/**, README.md, scripts/test-installers.js]
commits: [5641f31, a3dcfa2, 9686331]
status: approved
rev: 1
approved_rev: 1
approved_hash: afa06a95fada963af185bb258da44fefd250469c0c2d81eeadcc0da030daffda
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-instaladores-win-mac

## Contexto
Hoy se instala con `git clone` + `npm install`. Para usarla sin Node, hacen falta un instalador de Windows (.exe) y uno de macOS (.dmg), publicados en GitHub Releases. No hay certificado de firma de código: Windows mostrará SmartScreen y macOS Gatekeeper.

## Requisitos
### REQ-1: Instalador de Windows
WHEN se publica una etiqueta `v*` THE SYSTEM SHALL construir en GitHub Actions un instalador `.exe` (NSIS, x64) de AlyssDJ y adjuntarlo a la Release.
### REQ-2: Imagen de disco de macOS
WHEN se publica una etiqueta `v*` THE SYSTEM SHALL construir un `.dmg` para Intel y Apple Silicon y adjuntarlo a la Release.
### REQ-3: Herramientas en la app instalada
WHILE la app corre empaquetada THE SYSTEM SHALL descargar yt-dlp y ffmpeg a la carpeta de datos del usuario en el primer arranque, sin Node ni npm.
### REQ-4: Construcción comprobable
WHEN se hace push o pull request THE SYSTEM SHALL construir la app sin publicar (`--dir`) en windows y macos y fallar si el paquete no contiene `main/main.js`.
### REQ-5: Aviso de no firmado
THE SYSTEM SHALL explicar en la guía de instalación cómo abrir un instalador no firmado en Windows (SmartScreen) y macOS (Gatekeeper).

## Fuera de alcance
Firma de código y notarización (requieren certificados de pago), actualizaciones automáticas, instalador de Linux (AppImage queda como opción futura). No puedo probar la instalación en un Windows o Mac reales desde aquí.
