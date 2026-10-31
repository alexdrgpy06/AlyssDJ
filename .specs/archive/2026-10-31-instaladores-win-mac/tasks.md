---
change: 2026-10-31-instaladores-win-mac
---
# Tasks · 2026-10-31-instaladores-win-mac

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Configuración de electron-builder y herramientas en la app instalada (REQ-3) @coder [verify: node scripts/test-installers.js config]
- [x] 1.2 Workflow de release y construcción en CI (REQ-1, REQ-2, REQ-4) @coder [verify: node scripts/test-installers.js workflow]
- [x] 1.3 Guía: instaladores y avisos de no firmado (REQ-5) @pm [verify: grep -q Gatekeeper docs/00-instalacion.md]
