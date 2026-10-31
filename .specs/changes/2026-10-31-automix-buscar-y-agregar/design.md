---
change: 2026-10-31-automix-buscar-y-agregar
status: approved
rev: 1
approved_rev: 1
approved_hash: d2f3bb0a02bac3abc0851d3577f604e183d41353cf3225f4287ce1dfdd5bd43a
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-automix-buscar-y-agregar

## Enfoque
- `mixplan.bestInsertion({ cur, queue, track, analysisOf, pinned }) -> { index, delta }` (pura): prueba cada hueco posible (después de las fijadas/precargada) y devuelve el de menor aumento de coste de cadena.
- `AutoMix.addSmart(track, { next })`: si hay análisis, inserta con `bestInsertion` y avisa «quedó en la posición N»; si no, `add()` + `prepareAhead` y, al llegar el análisis, `reorder({ force })` (ya existente) con un registro `moves` para el aviso «movida de a a b».
- `AutoMix.suggestions()` (pura sobre datos ya cargados): candidatos = últimas radios (`this.radioPool`) ∪ analizadas de la librería (`analysis.list`), menos lo que ya está; coste = `edgeCost(último, candidato)` si hay análisis, si no `null`; ordena por coste y analiza en segundo plano de a una las 3 primeras sin análisis.
- UI: en `#am-view` un buscador con resultados (reutiliza `lib.search` y `local`/`analyzed` de `Library`) y un panel «Sugeridas»; atajo Enter para agregar el primer resultado.
- Pruebas: `scripts/test-automix-add.js` (inserción óptima frente a fuerza bruta, aviso de movimiento, sugerencias ordenadas, sin duplicados) y e2e de la vista.

- Popularidad: `ytm-library.parsePlays(text)` convierte «856 M reproducciones», «135 k», «1,2 B plays», «34.861.726 visualizaciones» en número; `parseSongs` lo guarda en `plays`; `ytm-library.popularity(videoId)` usa el endpoint `player` (`videoDetails.viewCount`, comprobado con YouTube Music real) con caché en disco `popularity.json` (30 días) y cola de 3 en paralelo; IPC `lib:popularity(ids)`.
- Puntuación de candidatas (`mixplan.rankCandidates`, pura): `score = edgeCost + style − popBonus`, con `popBonus = peso · clamp((log10(plays) − 5) / 4, 0, 1)` (100 mil → 0, 1000 M → 1; pesos Poco 2, Medio 4, Mucho 8) y `style` = −1,5 si viene de la radio de la semilla, −1 mismo artista, −0,05·|Δaño| (tope −1); regla de seguridad: las que rompen (salto de BPM > 8% o clave incompatible) se ordenan siempre después de las que encajan, sea cual sea su popularidad.
- Radio: `ensureQueue` pide popularidad de las candidatas frescas y toma las 8 mejores según `rankCandidates` (sin esperar: si aún no llega, entra con popularidad desconocida y se reordena al llegar).

## Contratos
`bestInsertion` no muta la cola; `suggestions()` devuelve `[{ track, cost|null, state }]`.

## Visual Spec
Buscador sobre la lista, resultados en filas con «Agregar» y «A continuación», panel de sugeridas bajo la cola; estilo oscuro de la app.

## Amendments
