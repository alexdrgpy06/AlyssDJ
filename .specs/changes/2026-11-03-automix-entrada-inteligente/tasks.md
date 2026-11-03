---
change: 2026-11-03-automix-entrada-inteligente
---
# Tasks · 2026-11-03-automix-entrada-inteligente

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 `pickEntry`: candidatos, puntuación, motivo y entradas del usuario o sin análisis (REQ-1, REQ-2, REQ-3, REQ-5, REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-entrada.js pick]
- [x] 1.2 Usarlo en `planTransition`, `planNearest` y la preescucha (REQ-1, REQ-3, REQ-6, REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-entrada.js plan]
- [x] 1.3 Tarjeta «SIGUE»: entrada, compás, motivo, tira de energía y mover la línea guarda el punto (REQ-4, REQ-5) @ui [verify: xvfb-run -a node scripts/test-entrada.js ui]
- [x] 1.4 Guía, ayuda y CI (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7) @pm [verify: node scripts/test-entrada.js docs]
