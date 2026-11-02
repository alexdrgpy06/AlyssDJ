---
change: 2026-11-02-automix-transicion-suave
status: approved
rev: 2
approved_rev: 2
approved_hash: 1dd53cf112dbd95178e93c569ffa646e651cdcb2929c9f1452d15082543506c9
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-automix-transicion-suave

## Enfoque

- **Gestos suaves (REQ-2):** `AutoMix.startTransition` arranca un `stepTimer` de 40 ms que llama a `stepTransition` (el `tick` de 250 ms sigue para el resto); se limpia en `finishTransition` y `stop`. Los cortes de `recipes.js` (`corte`, `graves-entran/salen`) pasan de `step` a `ease` sobre un pulso; el único `step` que queda es el corte inicial del grave de la entrante.
- **Bass swap en toda receta (REQ-1):** `echo-cut` y `drop-cut` incorporan `swap-entra/sale` (o `graves-entran/salen` en el último pulso de la caída). La duración del intercambio es `SW = min(4, nBeats - swap)` pulsos y el swap se limita a `nBeats - 8` para dejar un compás limpio.
- **Auto decide duración (REQ-3):** `chooseStyle` devuelve además `beats` (8, 16 o 32 según compatibilidad); `planRecipe({ beats })` lo respeta acotado al tramo disponible y a compases. `AutoMix.maxLen()` da al plan hasta 32 s en Auto para que el análisis tenga margen; con estilo fijo se usa `cfg.len`.
- **Tonalidad en conflicto (REQ-4):** con tempo ≤ 3 % → `filter` (bass swap con filtro); si no → `echo-cut` (bass swap corto con eco).

- **Siguiente (REQ-5):** en `tick`, `pendingMix` espera hasta 8 s a que la entrante tenga `mix` (estructura) antes de planificar, y recalcula el plan si salió con `enterAt` 0 y el análisis llegó después. La mezcla de emergencia (`rem ≤ 1,2 s`) pasa ahora un plan con el `enterAt` de `makeNearestPlan` en vez de un número (que lo dejaba en `null`).

## Contratos

```js
chooseStyle(cur, next, plan, cfgStyle) → { style, why, beats? }
planRecipe({ style, cur, plan, level, beats? }) → { style, len, beat, swapBeat, gestures }
AutoMix.maxLen() → segundos
```

Etiquetas: `STYLE_LABEL['echo-cut'] = 'bass swap + eco'`, `['drop-cut'] = 'bass swap en la caída'`; botones «Bass + eco» y «En la caída».

## Visual Spec

Solo cambian los textos de dos botones del selector de estilo y la tira de gestos (que ahora muestra «graves» y «fundido» en vez de «corte»). Sin cambios de layout.

## Amendments

## Domain deltas
### automix
#### ADDED spec: Transiciones suaves con bass swap
WHEN AutoMix mezcla con cualquier receta distinta del fundido THE SYSTEM SHALL cortar el grave de la entrante al empezar e intercambiar los graves con una rampa de un compás, y aplicar el crossfader, el EQ y el filtro con rampas actualizadas cada 40 ms como máximo.
WHILE el estilo es Auto THE SYSTEM SHALL elegir con el análisis la receta y su duración (8, 16 o 32 pulsos), y con tonalidades en conflicto y tempo parecido usar bass swap con filtro en vez de un corte.
WHEN el usuario pulsa «Siguiente» o «Mezclar ahora» y la entrante se está analizando THE SYSTEM SHALL esperar su análisis hasta 8 s y entrar siempre por su punto de entrada, también en la mezcla de emergencia.
#### ADDED design: Gestos cada 40 ms y duración sugerida
`AutoMix.startTransition` arranca un `stepTimer` de 40 ms (sin retener el proceso en pruebas); `chooseStyle` devuelve `beats` y `planRecipe({ beats })` lo respeta; `maxLen()` da hasta 32 s al plan en Auto; `pendingMix` espera `prep.state === 'analyze'` hasta 8 s.
