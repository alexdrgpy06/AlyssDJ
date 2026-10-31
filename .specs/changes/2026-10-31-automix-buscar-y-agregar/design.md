---
change: 2026-10-31-automix-buscar-y-agregar
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-automix-buscar-y-agregar

## Enfoque
- `mixplan.bestInsertion({ cur, queue, track, analysisOf, pinned }) -> { index, delta }` (pura): prueba cada hueco posible (después de las fijadas/precargada) y devuelve el de menor aumento de coste de cadena.
- `AutoMix.addSmart(track, { next })`: si hay análisis, inserta con `bestInsertion` y avisa «quedó en la posición N»; si no, `add()` + `prepareAhead` y, al llegar el análisis, `reorder({ force })` (ya existente) con un registro `moves` para el aviso «movida de a a b».
- `AutoMix.suggestions()` (pura sobre datos ya cargados): candidatos = últimas radios (`this.radioPool`) ∪ analizadas de la librería (`analysis.list`), menos lo que ya está; coste = `edgeCost(último, candidato)` si hay análisis, si no `null`; ordena por coste y analiza en segundo plano de a una las 3 primeras sin análisis.
- UI: en `#am-view` un buscador con resultados (reutiliza `lib.search` y `local`/`analyzed` de `Library`) y un panel «Sugeridas»; atajo Enter para agregar el primer resultado.
- Pruebas: `scripts/test-automix-add.js` (inserción óptima frente a fuerza bruta, aviso de movimiento, sugerencias ordenadas, sin duplicados) y e2e de la vista.

## Contratos
`bestInsertion` no muta la cola; `suggestions()` devuelve `[{ track, cost|null, state }]`.

## Visual Spec
Buscador sobre la lista, resultados en filas con «Agregar» y «A continuación», panel de sugeridas bajo la cola; estilo oscuro de la app.

## Amendments
