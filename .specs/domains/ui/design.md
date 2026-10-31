---
domain: ui
paths: [renderer/library.js, scripts/automix-compact-selftest.js, renderer/styles.css, renderer/app.js, renderer/automix.js, renderer/index.html, scripts/test-automix-compact.js]
last_change: 2026-10-31-vistas-por-pantalla
---
# ui · design

## clase am-compact

`body.am-compact` reduce plato, oculta los bancos de funciones y compacta el mezclador; se activa desde `syncCompact` con el evento `alyss:tab` y el estado de AutoMix.

## layout.js

`profileFor`, `scaleFor` y `resolve` son puros; `body[data-layout]` activa el CSS compacto (comparte reglas con `am-compact`) y el amplio escala con `zoom` según `--ui-scale`.
