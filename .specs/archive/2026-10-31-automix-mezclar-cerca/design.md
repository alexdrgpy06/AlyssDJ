---
change: 2026-10-31-automix-mezclar-cerca
status: approved
rev: 1
approved_rev: 1
approved_hash: 1ab210294b57aef92754bf02366cc6f3905e8a82697a335fc2197ecb121326e4
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-automix-mezclar-cerca

## Enfoque
- `mixplan.planNearest(cur, next, { pos, len, minLead = 1, maxWait = 12 })` (pura): candidatos de salida = `mixEdit.outs` o `mix.mixOut` ∪ múltiplos de 8 beats de la rejilla (`offset + k·8·beat`); elige el de menor `t ≥ pos + minLead` con `t − pos ≤ maxWait` y espacio suficiente; duración = `floor(min(len, dur − t − 1) / beat / 4) · 4` beats (mínimo 4); entrada = `mixEdit.in ?? mix.mixIn ?? offset`. Sin BPM → `{ exitAt: pos, seconds: min(len, 4), kind: 'now' }`.
- `AutoMix.mixNow` guarda `this.pendingMix = { plan }` y `tick` inicia la transición cuando `posOf(cur) ≥ plan.exitAt − 0.02` y la siguiente está lista; la vista muestra la cuenta atrás con `snapshot().pendingMix`.
- Pruebas: `scripts/test-mix-now.js` (puras: elección de la salida más cercana con candidatos y rejilla, compases enteros, sin BPM, límites de espera) y con el motor simulado (inicio en la posición prevista).

## Contratos
`planNearest -> { exitAt, enterAt, beats, seconds, kind: 'edit'|'auto'|'phrase'|'now', waitS }`.

## Visual Spec
Texto de cuenta atrás en la barra de estado de AutoMix y botón «Cancelar» junto a «Mezclar ahora».

## Amendments

## Domain deltas
### automix
#### ADDED spec: Mezclar ahora busca lo más cercano
WHEN el usuario pulsa «Mezclar ahora» THE SYSTEM SHALL elegir como salida el punto más cercano por delante (punto de la pista, editado o límite de frase de 8 beats, a lo sumo 12 s), entrar en la siguiente por su punto de entrada con el tempo igualado, durar compases enteros y poder cancelarse con otra pulsación.
#### ADDED design: planNearest
`mixplan.planNearest` es pura; `AutoMix.mixNow` guarda un plan pendiente que `tick` inicia al llegar a la salida y la vista cuenta atrás con `snapshot().pendingMix`.
