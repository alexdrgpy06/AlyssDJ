---
change: 2026-11-04-deck-descargar-pista
---
# Tasks · 2026-11-04-deck-descargar-pista

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 `Deck.unload` y `AutoMix.holds` con sus reglas (REQ-1, REQ-2, REQ-3) @coder [verify: xvfb-run -a node scripts/test-descargar-pista.js logic]
- [x] 1.2 Botón, icono y control `deckX.eject` en el deck (REQ-1) @ui [verify: xvfb-run -a node scripts/test-descargar-pista.js ui]
- [x] 1.3 Botón «Cargar pista», cabecera del deck en rejilla y textos con elipsis (REQ-4) @ui [verify: xvfb-run -a node scripts/test-descargar-pista.js header]
- [x] 1.4 Rótulos y motivos de AutoMix: `startLabel`, `disabledReason`, menú Radio al iniciar sin pista (REQ-5) @coder [verify: xvfb-run -a node scripts/test-descargar-pista.js labels]
- [x] 1.5 Documentación, inventario, arquitectura, referencias visuales y CI (REQ-1, REQ-2, REQ-3) @coder [verify: node scripts/test-descargar-pista.js docs]
