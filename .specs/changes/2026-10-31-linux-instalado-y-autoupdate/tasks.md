---
change: 2026-10-31-linux-instalado-y-autoupdate
---
# Tasks · 2026-10-31-linux-instalado-y-autoupdate

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Auto-update en los tres sistemas: comprobación, aviso, descarga con permiso y sin cortar la música (REQ-4, REQ-5, REQ-6, REQ-7, REQ-8) @coder [verify: node scripts/test-updater.js unit && node scripts/test-updater.js ui]
- [x] 1.2 AppImage de Linux y archivos de actualización en el release (REQ-3) @coder [verify: node scripts/test-install-linux.js config]
- [x] 1.3 Scripts de instalación y desinstalación en Linux (REQ-1, REQ-2) @coder [verify: node scripts/test-install-linux.js script]
