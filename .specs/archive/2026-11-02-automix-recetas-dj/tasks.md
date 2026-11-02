---
change: 2026-11-02-automix-recetas-dj
---
# Tasks · 2026-11-02-automix-recetas-dj

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Módulo puro recipes.js: chooseStyle y planRecipe sobre la rejilla (REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-9) @coder [verify: node --experimental-default-type=module scripts/test-recipes.js]
- [x] 1.2 Motor: startTransition/stepTransition ejecutan la receta, estilo auto por defecto, snapshot con receta (REQ-1, REQ-6, REQ-7, REQ-8) @coder [verify: node scripts/test-automix-add.js engine]
- [x] 1.3 Vista: tira de gestos, selector Auto y nota con el motivo (REQ-8) @ui [verify: node scripts/test-automix-view.js queue]
- [x] 1.4 Documentación y captura (REQ-8) @coder [verify: node scripts/test-recipes.js docs]
