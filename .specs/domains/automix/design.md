---
domain: automix
paths: [renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, renderer/deck.js, main/analyzer.js, docs/**]
last_change: 2026-11-02-automix-recetas-dj
---
# automix · design

## Pestaña AutoMix y preparación anticipada

La vista es una pestaña de la librería que lee `AutoMix.snapshot()`; el motor mantiene `prep` por pista a partir de los eventos del analizador, precarga solo pistas listas y retira de la cola la pista que entró (no «la primera») al terminar una transición.

## Planificador de mezcla

`renderer/mixplan.js` (funciones puras: `planTransition`, `scoreTransition`, `pickNext`) decide salida, entrada, duración y orden; `automix.js` lo aplica en `tick()`; un análisis sin estructura se recalcula con el archivo ya guardado (`reuse`).

## orderChain

`mixplan.orderChain` es exacto hasta 8 pistas libres y voraz con mejora local (intercambio e inserción, 120 ms) más allá; `AutoMix.prepareAhead` analiza toda la cola; `reorganizeNow` y `undoReorder` dan el control manual.

## planNearest

`mixplan.planNearest` es pura; `AutoMix.mixNow` guarda un plan pendiente que `tick` inicia al llegar a la salida y la vista cuenta atrás con `snapshot().pendingMix`.

## Vista de video (MiniStage)

`body.am-stage` oculta `.console` y `.waves` sin sacarlos del DOM; `#stage` muestra dos teselas. `airWeights` usa fader² × crossfader (sin volumen general) y resalta ambas con mezcla en curso (> 0,15 en los dos).

## planTransition por modos

`renderer/mixplan.js` exporta `EXIT_MODES` e `introOutroSeconds`; `planTransition(cur, next, { len, exitMode, optimal, pos })` deriva el modo (`exitMode` o, si falta, `optimal === false` → `end`) y devuelve `mode`. `AutoMix.exitMode()` deriva el modo del ajuste guardado; `skipNext()` y `shuffle(rng)` operan sobre la cola; `snapshot()` expone `exitMode`, `canSkip` y `canShuffle`.

## FxMoves y propietario de ranura

`FxChain.owners[i]` (`'user'|'auto'`) y `Deck.fxSet/fxRamp(..., owner)`; `FxMoves` reserva (`claim`), mueve (`set`/`ramp`), suelta (`release`, con cola opcional) y barre (`sweep`); `AutoMix.fxStep` (transición) y `AutoMix.fxTrack` (pista que suena).

## songKey

`mixplan.songKey(track)` normaliza título y primer artista; `AutoMix.knownSongs()` reúne cola, historial y pista actual para filtrar el relleno y las sugerencias; una cabeza con preparación en error pasa a `ready` con `stream: true`.

## Limpieza en start()

`AutoMix.start()` resetea queue, radioPool, pinned, pendingMix, plan, undoStack y waitSince antes de arrancar el nuevo tema.

## recipes.js

`renderer/recipes.js` (puro): `chooseStyle` → `{style, why}`, `planRecipe` → `{style, len, beat, swapBeat, gestures}`, `gestureValue`; `AutoMix.recipeStep` los aplica y `previewRecipe` alimenta la tira de la vista.
