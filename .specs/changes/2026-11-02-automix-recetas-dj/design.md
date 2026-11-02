---
change: 2026-11-02-automix-recetas-dj
status: approved
rev: 1
approved_rev: 1
approved_hash: 1154f912c23942ebf99ce5fcf57f5be3fbc8be2e8f5851d15b00b8c1ff363b2a
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-automix-recetas-dj

## Enfoque

Nuevo módulo puro `renderer/recipes.js` (sin DOM ni audio), que sustituye los `if (style === ...)` de `stepTransition`:

1. `chooseStyle(cur, next, plan, cfgStyle)` → `{ style, why }`. Con estilo fijo devuelve ese. Con `auto` (REQ-6): sin BPM en alguna → `crossfade`; salto de BPM > `MAX_BPM_GAP` o tonalidad en conflicto (`camelot.js`) → `echo-cut` (eco y corte); salto moderado → `filter`; BPM y tonalidad compatibles con outro e intro de ≥ 8 compases → `bass`; si la saliente tiene rotura en `[exitAt, exitAt+seconds]` y la entrante entra en caída o frase de energía alta → `drop-cut` (REQ-4).
2. `planRecipe({ style, cur, next, plan, level })` → `[{ id, at, end, deck: 'from'|'to'|'x', param, to, curve, fx? }]`, con `at`/`end` en **tiempos de la mezcla** (0 = `exitAt`) redondeados a la rejilla de la saliente: `beat = 60/bpm`, compás = 4 tiempos, frase = `phraseBeats` (16). Los cambios mayores (swap de graves, corte) se anclan al inicio de frase más cercano a la mitad dentro de la mezcla; los demás, a inicios de compás. (REQ-1)
3. Recetas: `bass` (REQ-2: entrante `eqLow=-1` hasta el swap; swap en frase: entrante 0 / saliente −1 en ≤ 1 compás; crossfader suave), `filter` (REQ-3: `filter` de la saliente de 0 a −0,9 en los últimos 8 o 16 tiempos, entrante de 0,85 a 0 desde la entrada hasta la frase del swap), `echo-cut` (REQ-5: eco con retardo 1/2 o 3/4 de pulso lanzado en el tiempo 1 del último compás; al llegar a la línea de compás se baja el volumen de la saliente a 0 y la cola muere), `drop-cut` (REQ-4: crossfader a la entrante en un inicio de compás, graves cambiados a la vez, cola de eco/reverb de la saliente), `crossfade` (solo crossfader).
4. Nivel de efectos (REQ-7): `planRecipe` filtra gestos con `fx`: `off` los quita; `subtle` deja eco y reverb; `full` también el riser sobre cues de la pista (ese sigue en `planTrackMoves`, sin cambios). Los gestos de EQ/filtro nunca dependen del nivel.
5. Ejecución: `startTransition` llama a `chooseStyle` y `planRecipe` y guarda `trans.recipe`; `stepTransition` convierte el tiempo transcurrido en tiempo de mezcla y aplica cada gesto activo con `knob()`/`setX()` interpolando según su curva; los gestos con `fx` pasan por `FxMoves` como hoy. `planTransitionMoves` se reduce a la reverb de rotura que no cubre una receta.
6. Vista (REQ-8): `snapshot()` incluye `recipe: [{ id, at, end, label, state: 'wait'|'on'|'done' }]` y el estilo elegido con `why`; `views.js` lo pinta como una pista de gestos con el compás actual; `app.js` usa `why` en la nota.
7. Ajustes: `cfg.style` admite `'auto'` (nuevo valor por defecto) además de `bass`, `filter`, `crossfade`; el selector gana la opción «Auto».

## Contratos

- `chooseStyle(cur, next, plan, cfgStyle) → { style: 'bass'|'filter'|'echo-cut'|'drop-cut'|'crossfade', why: string }`
- `planRecipe(...) → Gesture[]` con `Gesture = { id, at, end, deck: 'from'|'to'|'x', param: 'eqLow'|'filter'|'volume'|'x', to: number, curve: 'lin'|'ease'|'step', fx?: 'echo'|'reverb' }`; determinista; todo `at`/`end` ∈ rejilla (múltiplo de beat) y ≤ `plan.seconds`.
- `snapshot().trans.recipe` y `.why` nuevos; sin cambios de IPC ni de disco.

## Decisiones

- Un módulo puro y no más lógica en `automix.js`: permite probar la rejilla y la elección sin audio (REQ-9).
- Anclar a la rejilla de la saliente: la entrante ya está alineada a ella por `alignPhase`.
- `auto` por defecto: es el comportamiento que pidió el usuario; los fijos siguen disponibles.
- No se añaden efectos de audio: eco, reverb, phaser, filtro y EQ ya existen.

## Visual Spec

En la vista de AutoMix, bajo la mezcla actual o planificada: una tira horizontal con la duración de la mezcla dividida en compases y un bloque por gesto (etiqueta corta: «graves», «filtro», «eco», «corte»), con color por deck, el gesto activo resaltado y una marca del compás actual. Debe leerse a 100 % y a ventana estrecha (los bloques se abrevian a su inicial) y respetar «reducir movimiento». Selector de estilo con «Auto» primero. El estilo elegido y su motivo aparecen en la nota existente.

## Amendments

### A1 · 2026-11-02
`planRecipe` devuelve `{ style, len, beat, swapBeat, gestures }` y no solo `Gesture[]`: `len` (≤ `plan.seconds`, múltiplo de compás) pasa a ser la duración de la transición, y las recetas de corte (`echo-cut`, `drop-cut`) duran 8 pulsos. Los gestos llevan `from`/`to` explícitos y el parámetro `fx` incluye `p` y `tailMs`; no hay parámetro `volume` (el corte usa el crossfader). Afecta a REQ-1, REQ-4 y REQ-5.

### A2 · 2026-11-02
`cfg.styleV` (2) migra una sola vez el estilo guardado a `auto`, porque las versiones anteriores guardaban `bass` por defecto. Afecta a REQ-6.
