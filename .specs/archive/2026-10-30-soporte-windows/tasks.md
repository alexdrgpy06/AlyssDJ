---
change: 2026-10-30-soporte-windows
---
# Tasks · 2026-10-30-soporte-windows

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 ffmpeg estático descargado a bin/ en las tres plataformas (REQ-1) @coder [verify: node scripts/test-platform.js ffmpeg]
- [x] 1.2 Navegadores y rutas por plataforma, sin HOME (REQ-2, REQ-3) @coder [verify: node scripts/test-platform.js browsers && node scripts/test-auth-import.js]
- [x] 1.3 Guía de instalación por sistema y README (REQ-4) @pm [verify: test -f docs/00-instalacion.md && grep -q Windows README.md]
- [x] 1.4 Workflow de GitHub Actions en tres sistemas (REQ-5) @coder [verify: node scripts/test-platform.js ci]
- [x] 1.5 Licencia MIT, comprobación sin secretos y repo público (REQ-6) @pm [verify: node scripts/test-platform.js publico]
