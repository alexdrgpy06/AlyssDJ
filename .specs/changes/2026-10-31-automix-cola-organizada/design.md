---
change: 2026-10-31-automix-cola-organizada
status: approved
rev: 1
approved_rev: 1
approved_hash: 303cb67aae3f305284d27a7adabb26d42ffe765d58b3231d1cd67c972afbcd8c
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-automix-cola-organizada

## Enfoque
- `mixplan.orderChain({ cur, queue, analysisOf, isReady, pinned }) -> { queue, cost, scores }`: coste de arista = `scoreTransition` existente más penalización por salto de BPM > 8% y por cambio brusco de energía. Construcción voraz del vecino más cercano partiendo de `cur`, mejorada con 2-opt y or-opt limitados (por tiempo y por 100 pistas), respetando las posiciones fijadas (se ordena cada segmento libre entre fijadas, usando como anclas la pista anterior y la siguiente fijada). Pistas aún sin análisis van al final en su orden.
- `AutoMix.prepareAhead` pasa a `prepareAll(max=2)`: cola de análisis con prioridad por posición, pistas locales ya cuentan como listas.
- Recalcular en cada evento `analysis` de una pista de la cola; no toca `queue[0]` si ya está precargada.
- UI: columna BPM/Key/transición ya existe; se añaden el interruptor, «Reorganizar ahora» y «Deshacer» (pila de un nivel) y una insignia con el coste/calidad total.
- Pruebas: `scripts/test-queue-order.js` con colas sintéticas (BPM y claves conocidas): orden óptimo frente a fuerza bruta en colas de 7, restricciones de fijadas, tiempo con 100 pistas y que el resultado no empeora el coste del orden voraz anterior.

## Contratos
`orderChain` es pura y no muta la entrada.

## Visual Spec
Controles nuevos en la cabecera de la vista de AutoMix; mismo estilo.

## Amendments

## Domain deltas
### automix
#### ADDED spec: cola analizada y ordenada como cadena
WHEN se añade una pista a la cola de AutoMix THE SYSTEM SHALL analizarla sin esperar su turno, de a 2 como máximo, y ordenar las pistas analizadas como una cadena de coste mínimo (BPM gradual, tonalidad, energía) respetando lo fijado a mano y la pista ya precargada.
#### ADDED design: orderChain
`mixplan.orderChain` es exacto hasta 8 pistas libres y voraz con mejora local (intercambio e inserción, 120 ms) más allá; `AutoMix.prepareAhead` analiza toda la cola; `reorganizeNow` y `undoReorder` dan el control manual.
