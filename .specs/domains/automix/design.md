---
domain: automix
paths: [renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, renderer/deck.js, main/analyzer.js, docs/**]
last_change: 2026-10-31-automix-cola-organizada
---
# automix · design

## Pestaña AutoMix y preparación anticipada

La vista es una pestaña de la librería que lee `AutoMix.snapshot()`; el motor mantiene `prep` por pista a partir de los eventos del analizador, precarga solo pistas listas y retira de la cola la pista que entró (no «la primera») al terminar una transición.

## Planificador de mezcla

`renderer/mixplan.js` (funciones puras: `planTransition`, `scoreTransition`, `pickNext`) decide salida, entrada, duración y orden; `automix.js` lo aplica en `tick()`; un análisis sin estructura se recalcula con el archivo ya guardado (`reuse`).

## orderChain

`mixplan.orderChain` es exacto hasta 8 pistas libres y voraz con mejora local (intercambio e inserción, 120 ms) más allá; `AutoMix.prepareAhead` analiza toda la cola; `reorganizeNow` y `undoReorder` dan el control manual.
