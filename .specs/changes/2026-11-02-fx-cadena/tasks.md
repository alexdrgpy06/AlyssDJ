---
change: 2026-11-02-fx-cadena
---
# Tasks · 2026-11-02-fx-cadena

Formato: `- [ ] 1.1 Descripción (REQ-1) @rol [verify: comando] [runner: claude|hermes|orca]`

- [x] 1.1 Modelo `FxChain`: ranuras, límites, selección, rampas con reloj inyectable y persistencia (REQ-1, REQ-5) @coder [verify: node scripts/test-fx.js model]
- [x] 2.1 Motor `shared/fx.js` con tres ranuras en serie, siete tipos, P por tipo, resonancia y mensaje `mix` (REQ-1, REQ-2, REQ-4) @coder [verify: node scripts/test-fx.js engine]
- [x] 3.1 Deck: `fxSet`/`fxRamp`, panel de ranuras, XY pad con modo mantener, knob RES, MIDI y persistencia (REQ-3, REQ-4, REQ-5) @ui [verify: node scripts/test-fx.js ui]
- [x] 4.1 Ajustes «Efectos y filtros» (`fxHold`, `fxRemember`, `filterRes`) (REQ-6) @ui [verify: node scripts/test-fx.js settings]
- [~] 5.1 Regresión, documentación, capturas y lista de CI (REQ-7) @coder [verify: node scripts/test-fx.js docs] {claim: alex@alex-pc 2026-11-02T00:31:19-03:00}
