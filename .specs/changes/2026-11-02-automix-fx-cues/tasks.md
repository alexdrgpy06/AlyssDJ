---
change: 2026-11-02-automix-fx-cues
---
# Tasks · 2026-11-02-automix-fx-cues

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [~] 1.1 `fxCues`: subida, caída y rotura desde la energía por frase, con casos límite (REQ-1) @coder [verify: node scripts/test-fxcues.js cues] {claim: alex@alex-pc 2026-11-02T01:28:51-03:00}
- [ ] 2.1 `FxChain` con `owner` y `FxMoves`: reservar ranuras libres, soltar, restaurar y ceder al usuario (REQ-5) @coder [verify: node scripts/test-fxcues.js moves]
- [ ] 3.1 `planTransitionMoves` y `planTrackMoves`: tiempos, niveles, un movimiento a la vez (REQ-3, REQ-4) @coder [verify: node scripts/test-fxcues.js plan]
- [ ] 4.1 AutoMix: nivel `fxLevel`, movimientos en transición y durante la pista, limpieza y estado (REQ-2, REQ-3, REQ-4, REQ-5, REQ-6) @coder [verify: node scripts/test-fxcues.js engine]
- [ ] 5.1 Interfaz: selector «Efectos», etiqueta en la vista Automix (REQ-2, REQ-6) @ui [verify: node scripts/test-fxcues.js ui]
- [ ] 6.1 Regresión, documentación, capturas y lista de CI (REQ-7) @coder [verify: node scripts/test-fxcues.js docs]
