---
change: 2026-10-31-mix-points-editables
---
# Tasks · 2026-10-31-mix-points-editables

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Almacén de ediciones y plan que las respeta (REQ-2, REQ-3, REQ-5, REQ-6) @coder [verify: node --experimental-default-type=module scripts/test-mix-edit.js store]
- [x] 1.2 Editor de puntos y prueba de mezcla (REQ-1, REQ-4) @ui [verify: node scripts/test-mix-edit.js e2e]
