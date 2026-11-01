---
change: 2026-11-01-automix-modo-salida
---
# Tasks · 2026-11-01-automix-modo-salida

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 `planTransition` con modo de salida y `introOutroSeconds` (REQ-1, REQ-2) @coder [verify: node scripts/test-salida.js plan]
- [x] 2.1 AutoMix: `exitMode()` derivado del ajuste heredado, `skipNext`, `shuffle` y snapshot (REQ-1, REQ-3, REQ-4) @coder [verify: node scripts/test-salida.js queue]
- [ ] 3.1 Selector «Salir», botones «Saltar siguiente» y «Barajar», estado «dura N s» y vista Automix (REQ-1, REQ-2, REQ-3, REQ-4) @ui [verify: node scripts/test-salida.js ui]
- [ ] 4.1 Regresión, documentación, capturas y lista de CI (REQ-5) @coder [verify: node scripts/test-salida.js docs]
