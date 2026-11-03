---
domain: stems
paths: [docs/arquitectura/**, scripts/test-arquitectura.js, .specs/domains/**]
last_change: 2026-11-03-arquitectura-documentada
---
# stems · design

## Módulos del dominio

`main/stems.js` (almacén y cola), `main/stems-worker.js` (proceso hijo), `main/stems-device.js` (selector de dispositivo), `shared/stems-dsp.js` (pre y posproceso) y `renderer/stems.js` (estado en la interfaz). Detalle en docs/arquitectura/01-main.md.
