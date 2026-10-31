---
domain: platform
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-10-30-soporte-windows
---
# platform · spec

## soporte multiplataforma

WHEN se detectan navegadores THE SYSTEM SHALL usar las rutas de perfil de la plataforma actual (Linux, Windows, macOS).
WHEN se hace push o pull request THE SYSTEM SHALL ejecutar en CI las pruebas rápidas y el arranque de la app en ubuntu, windows y macos.
