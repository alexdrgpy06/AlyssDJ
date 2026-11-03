---
domain: fx
paths: [docs/arquitectura/**, scripts/test-arquitectura.js, .specs/domains/**]
last_change: 2026-11-03-arquitectura-documentada
---
# fx · design

## Módulos del dominio

`shared/fx.js` (constructores Web Audio y `loop`), `renderer/fxchain.js` (modelo), `renderer/fxpanel.js` y `fxpad.js` (interfaz), `renderer/fxpresets.js` (presets en `alyssdj.fxpresets`), `renderer/fxcues.js` (cues musicales para AutoMix). Detalle en docs/arquitectura/02-shared-y-preload.md y 03-renderer.md.
