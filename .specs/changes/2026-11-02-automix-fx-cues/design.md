---
change: 2026-11-02-automix-fx-cues
status: approved
rev: 1
approved_rev: 1
approved_hash: c40705b7d5d2a1fd0440792c924d66b99b7381c68f15511fdd8e33af15ee8050
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-automix-fx-cues

## Enfoque

Tres piezas, todas en el renderer y sin tocar el motor de audio ni el análisis guardado: (1) un módulo puro que deriva cues de la energía por frase, (2) un planificador puro de «movimientos» (qué efecto, en qué deck y cuándo) y (3) un ejecutor que reserva ranuras libres de la cadena de efectos, las mueve y las devuelve; AutoMix lo llama desde sus ciclos existentes.

### Cues (REQ-1) — `renderer/fxcues.js`
- `fxCues(ana)` → `[{ t, kind: 'build'|'drop'|'break', strength, end? }]` ordenado por `t`. Usa `ana.mix.phrases` (energía 0–100 por frase de `phraseBeats` = 16), `ana.bpm` y `ana.offset`; `t(k) = offset + k·phraseBeats·60/bpm`. Vacío si falta BPM, rejilla o hay < 4 frases.
- **Caída** en la frase k: `(E[k] − E[k−1]) / max(E[k−1], 10) ≥ 0,30`. **Rotura** en k: `(E[k−1] − E[k]) / max(E[k−1], 10) ≥ 0,30` y `E[k+1] < 0,85·E[k−1]` (queda baja ≥ 1 frase; la última frase no cuenta). **Subida**: tramo de ≥ 3 frases con energía estrictamente creciente y `E[último] ≥ 1,25·E[primero]`; si una caída cae dentro del tramo, la subida termina en esa caída (`end = t(k)`); si no, `end = t(último + 1)`. `strength` es el cambio relativo acotado a 0–1.
- Determinista y sin efectos laterales; se calcula al pedirlo desde el análisis ya cargado (cache por `videoId` + `phrases.length` en AutoMix), sin repetir el análisis.

### Movimientos (REQ-3, REQ-4) — `planMoves`
- `planTransitionMoves({ level, cur, next, plan, pos })` → movimientos de transición, con tiempos relativos a la salida: **eco de salida** (`deck: 'from'`, `slot tipo echo p 0,5`, inicia al 75 % de la transición, rampa de `wet` 0 → 0,6 durante el 25 % final; no si `plan.seconds < 4`) y **reverb de rotura** (si el estilo no es «Filtro» y la saliente tiene una `break` en `[exitAt, exitAt + seconds]`: `reverb p 0,8`, sube `wet` 0 → 0,5 en 1 beat desde `break.t` y termina en `break.t + 16 beats` o al acabar la transición). Nada si `level === 'off'`.
- `planTrackMoves({ level, cues, pos, exitAt, phraseSec })` → solo con `level === 'full'` y fuera de transición: **riser** (subida con caída pareada a ≤ 1 frase: `phaser p 0,7`, `wet` = 0,5 · progreso de la subida, mandado por posición; se corta de golpe en `drop.t`) y **reverb de rotura** (como arriba). Un movimiento a la vez, al menos una frase entre ellos, ninguno en los 8 s previos a `exitAt` ni si la posición saltó más de 2 s (el usuario movió la aguja).

### Ejecutor — `FxMoves` (REQ-5)
- `claim(deck, want)` busca la primera ranura con `on === false` que no esté reservada, guarda su estado previo `{type,on,wet,p}` y la configura con `fxSet(slot, {type, p, wet: 0, on: true}, 'auto')`. Sin ranura libre → `null` y la nota «sin ranura libre para <movimiento>».
- `FxChain` guarda `owners[i]` (`'user'` por defecto, `'auto'` cuando `set`/`ramp` reciben `{ owner: 'auto' }`); `Deck.fxSet(slot, patch, owner)` y `fxRamp(slot, target, s, owner)` lo propagan. Si tras un `claim` el `owner` vuelve a `'user'`, el ejecutor suelta la ranura sin tocarla más (el usuario manda).
- `release(deck, slot, afterMs = 0)` restaura el estado previo (inmediato o tras la cola del eco: 4 s); `releaseAll()` al detener AutoMix, saltar, cancelar la mezcla o terminar un movimiento. El restaurado también pasa por `owner: 'auto'` para no contarse como cambio del usuario.

### Integración en AutoMix (REQ-2, REQ-5, REQ-6)
- `cfg.fxLevel` = `'off'|'subtle'|'full'` (por defecto `'subtle'`), guardado con el resto en `alyssdj:automix`.
- `startTransition` pide `planTransitionMoves` y los guarda en `this.trans.moves`; `stepTransition` los inicia según el progreso `p` y la posición de la saliente; `finishTransition` suelta los movimientos con su cola (4 s). `tick` (fuera de transición) evalúa `planTrackMoves` sobre la pista que suena. `stop()`, `skip()`, `cancelMix()` y el fin de pista llaman a `releaseAll()`.
- `snapshot()` añade `fx: { level, active: ['eco de salida', …] }`; la nota de la mezcla y la vista Automix lo muestran; con `off` no aparece nada.

### Interfaz
Selector `#amv-fx` «Efectos» en el grupo Transición (Apagado · Sutil · Marcado, con título explicativo) y una etiqueta `#imm-fx` en la vista inmersiva; los estilos reutilizan `.am-exit`.

## Contratos

```js
// renderer/fxcues.js
fxCues(ana)                          // → [{ t, kind, strength, end? }]
planTransitionMoves({ level, cur, next, plan, pos })
planTrackMoves({ level, cues, pos, exitAt, phraseSec, last })
new FxMoves({ now })  .claim(deck, want) .release(deck, slot, afterMs) .releaseAll() .active()
// renderer/fxchain.js
chain.set(i, patch, { owner }) ; chain.ramp(i, target, s, { owner }) ; chain.owners
// Deck
deck.fxSet(slot, patch, owner = 'user') ; deck.fxRamp(slot, target, seconds, owner = 'user')
```

## Visual Spec

- El selector «Efectos» sigue el patrón de «Salir» (`label.am-exit`, `select`), con las opciones en español y descripción en `title`.
- En la vista Automix, una etiqueta pequeña (`.imm-chip`) bajo la barra de la transición con el movimiento en curso, en color neutro (no cian/rosa), visible solo mientras hay movimiento.

## Amendments
