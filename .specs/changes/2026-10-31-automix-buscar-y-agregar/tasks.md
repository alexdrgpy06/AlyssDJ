---
change: 2026-10-31-automix-buscar-y-agregar
---
# Tasks · 2026-10-31-automix-buscar-y-agregar

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [ ] 1.1 Popularidad: reproducciones de YouTube Music, caché y puntuación de candidatas (REQ-6, REQ-7) @coder [verify: node --experimental-default-type=module scripts/test-automix-add.js popularity]
- [ ] 1.2 Inserción óptima, agregar con aviso de posición y sin duplicados (REQ-2, REQ-3, REQ-4, REQ-8) @coder [verify: node --experimental-default-type=module scripts/test-automix-add.js insert]
- [ ] 1.3 Buscador en la vista de AutoMix y sugeridas con popularidad (REQ-1, REQ-5, REQ-7) @ui [verify: node scripts/test-automix-add.js e2e]
