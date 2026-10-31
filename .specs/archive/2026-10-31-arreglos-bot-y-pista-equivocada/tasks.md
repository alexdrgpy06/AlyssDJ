---
change: 2026-10-31-arreglos-bot-y-pista-equivocada
---
# Tasks · 2026-10-31-arreglos-bot-y-pista-equivocada

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Pausa y mensaje claro ante el bot-check de YouTube (REQ-1) @coder [verify: node scripts/test-bot-check.js]
- [x] 1.2 Guardia del deck con «Preferir el video musical» (REQ-2) @coder [verify: node --check preload/deck.js]
- [x] 1.3 Quitar el video del plato y el ajuste de miniatura; fotogramas solo con la vista de video (REQ-3) @coder [verify: node scripts/test-video-local.js e2e]
