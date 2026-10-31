---
change: 2026-10-31-automix-mezclar-cerca
---
# Tasks · 2026-10-31-automix-mezclar-cerca

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 planNearest: salida y entrada más cercanas, en compases enteros (REQ-1, REQ-2, REQ-3, REQ-4) @coder [verify: node --experimental-default-type=module scripts/test-mix-now.js plan]
- [x] 1.2 «Mezclar ahora» usa el plan, con cuenta atrás y cancelar (REQ-1, REQ-5) @coder [verify: node --experimental-default-type=module scripts/test-mix-now.js engine]
