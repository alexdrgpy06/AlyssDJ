---
change: 2026-11-02-automix-transicion-suave
---
# Tasks · 2026-11-02-automix-transicion-suave

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Recetas con bass swap y rampas, duración sugerida por Auto (REQ-1, REQ-2, REQ-3, REQ-4) @coder [verify: node --experimental-default-type=module scripts/test-recipes.js model]
- [x] 1.2 Gestos cada 40 ms, etiquetas, documentación y pruebas de AutoMix (REQ-2, REQ-3) @coder [verify: node --experimental-default-type=module scripts/test-recipes.js docs]
- [x] 1.3 «Siguiente» espera el análisis y entra por el mejor punto (REQ-5) @coder [verify: node --experimental-default-type=module scripts/test-mix-now.js engine]
