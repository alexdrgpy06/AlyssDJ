---
change: 2026-11-03-automix-entrada-inteligente
status: approved
rev: 1
approved_rev: 1
approved_hash: d67d3c41fd9398d3b96bffe1cf3944ccc7c170634fd493bc14b618dde3d37f41
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-automix-entrada-inteligente

## Enfoque

La elección del punto de entrada pasa a una función pura, `pickEntry(cur, next, { exitAt, seconds })` en `renderer/mixplan.js`, que sustituye a `mixEdit.in ?? mix.mixIn ?? offset` en `planTransition` y `planNearest` (los dos caminos de AutoMix: transición programada y «Mezclar ahora»/«Siguiente»). No cambia el análisis ni el punto de salida: usa lo que ya hay en `analysis.mix` (`mixIn`, `introEnd`, `phrases`, `energy`) y los cues de `fxCues` (`drop`).

**Candidatos** (todos alineados a frase por construcción, y todos ≥ `mixIn`, el primer compás con música, así que nunca entran en silencio):
- `intro`: `mix.mixIn`, el inicio de la intro.
- `build`: si la intro es larga, la frase en que hay que entrar para que la transición termine justo cuando llega la primera frase fuerte (`introEnd − seconds` alineado a frase). Es «salta la intro larga».
- `strong`: `mix.introEnd`, la primera frase con energía.
- `drop`: el primer cue `drop` de `fxCues` posterior a `mixIn`.
- `edit`: `mixEdit.in`. Si existe, **es el único candidato** y se usa tal cual (REQ-3).

**Puntuación** (menor es mejor): `W.energy · |energía de salida − energía de entrada|` + `ENTRY_DEAD · max(0, 0,6·energía media de la pista − energía al terminar la transición)` («aire muerto» si la entrada se queda en una intro vacía) + un sesgo pequeño por tipo (`intro` 0 < `build` .2 < `strong` .4 < `drop` .6) para no preferir lo aventurado sin motivo. Se descartan los candidatos en los que `t + seconds + 2` pasa del final de la pista.

**Sin análisis** (`next` sin BPM o sin `mix`): entra por `mix.mixIn ?? offset ?? 0` como hasta ahora, con `kind: 'start'` y el aviso «sin análisis: entra por el inicio» en `plan.warnings`.

## Contratos

```
pickEntry(cur, next, { exitAt, seconds }) → { t, kind, why, bar, cost, cands: [{ t, kind, cost }] }
  kind: 'edit' | 'intro' | 'build' | 'strong' | 'drop' | 'start'
  why:  frase corta («salta la intro larga: …», «entra en el primer drop», «punto de entrada que marcaste»)
  bar:  compás (1 = el primero de la rejilla)
planTransition / planNearest → { …, enterAt: entry.t, entry }
```

`plan.entry` viaja con el plan; `renderer/mixpreview.js` usa el mismo `pickEntry` para la preescucha. La tarjeta «SIGUE» (`#amv-entry`) pinta `entry` (tiempo, compás y motivo) y una tira de energía por frase de la pista (`<canvas>`, sin decodificar audio) con una línea en el punto elegido. Arrastrar la línea elige el compás más cercano y lo guarda con `analysis.setMixEdit(id, { in: t, outs, free })` (se conservan las salidas editadas); un botón «Auto» borra solo la entrada.

## Visual Spec

- Bajo el título de «SIGUE», una fila **Entrada** con `m:ss · compás N` en mono y el motivo en una frase en tono atenuado.
- Debajo, una tira de 28 px de alto con la energía por frase (barras finas con el color del deck que entra) y la línea de entrada en blanco; foco visible, arrastrable con ratón y con ← → (un compás) cuando tiene el foco.
- Si el punto es de usuario, la fila lo dice («marcado por ti») y aparece «Auto».
- Sin análisis, la tira no se dibuja y la fila muestra el aviso.

## Amendments

## Domain deltas
### automix
#### ADDED spec: Entrada elegida entre varios puntos
WHEN AutoMix prepara una transición (programada, «Mezclar ahora» o «Siguiente») THE SYSTEM SHALL evaluar como puntos de entrada de la pista que sigue el inicio de la intro, la frase que salta una intro larga, la primera frase con energía y el primer drop, siempre en límite de frase y nunca antes del primer compás con música, y elegir el de menor coste según la energía de salida frente a la de entrada, que la entrada no se quede en una intro vacía al acabar la transición y que la transición quepa antes del final; WHEN la pista tiene una entrada editada a mano THE SYSTEM SHALL usarla tal cual; IF la pista no está analizada THEN THE SYSTEM SHALL entrar por el inicio y avisarlo.
#### ADDED design: pickEntry
`renderer/mixplan.js` (`entryCandidates`, `pickEntry`) devuelve `{ t, kind, why, bar, cost, cands }`; `planTransition`, `planNearest` y `previewPlan` lo usan y el plan lleva `entry`; `energyAt` tolera 10 ms de redondeo en los límites de frase.
### ui
#### ADDED spec: Entrada visible y editable en SIGUE
THE SYSTEM SHALL mostrar en la tarjeta «SIGUE» la entrada (tiempo y compás), el motivo en una frase y una tira con la energía por frase con una línea en el punto elegido; WHEN el usuario arrastra la línea o usa ← → THE SYSTEM SHALL guardarla en el compás más cercano como punto de entrada editado de esa pista, y «Auto» SHALL quitar solo esa entrada conservando las salidas.
#### ADDED design: Tira de entrada
`renderer/automix-entry.js` (`EntryStrip`) pinta `snapshot().entry` (`AutoMix.entryOf`) y guarda con `analysis.setMixEdit`.
