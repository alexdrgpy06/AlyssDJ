---
domain: sources
paths: [main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/library.js, renderer/app.js, renderer/index.html, renderer/source.js, docs/**, scripts/test-*.js]
last_change: 2026-11-03-modo-local-y-buscador
---
# sources · design

## Compuerta de red

`main/net-gate.js` (`createGate`: `offline`, `assert`, `wrap`, `allowUrl`) envuelve los manejadores `lib:*`, el actualizador, el analizador, la descarga del modelo de stems y `webRequest.onBeforeRequest` de las sesiones; el ajuste `localMode` emite `net:event` al cambiar.
