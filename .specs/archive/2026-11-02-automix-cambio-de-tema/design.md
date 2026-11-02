---
change: 2026-11-02-automix-cambio-de-tema
status: approved
rev: 1
approved_rev: 1
approved_hash: b5269279903c2198d8ff05e2cc053e7ff677065365eaa429afc96567b6dc4619
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-automix-cambio-de-tema

## Enfoque

`AutoMix.start()` (renderer/automix.js) gana un paso de limpieza tras `stop()` y antes de cargar el tema nuevo:

1. Reinicia `queue`, `radioPool`, `pinned`, `pendingMix`, `plan`, `undoStack`, `waitSince` e `history`/`histTracks`. (REQ-2)
2. Una vez elegido el deck del tema nuevo (el que ya suena con esa pista, o uno libre), recorre ambos decks: EQ grave y filtro a neutro, y el deck distinto del elegido que suene o tenga `wantPlay` se pausa. (REQ-1, REQ-3)
3. Si la pista ya suena en un deck, no se recarga ni se reinicia. (REQ-3)

## Contratos

Sin cambios de API ni de datos; `start({ seed, tracks })` mantiene su firma.

## Decisiones

- La limpieza vive en `start()` y no en `stop()`: detener el AutoMix a mano no debe pausar la música que el usuario sigue escuchando.

## Visual Spec

Sin cambios de interfaz.

## Amendments

## Domain deltas
### automix
#### ADDED spec: Cambio de tema o radio
WHEN el usuario inicia AutoMix con otro tema o una radio mientras otro está activo THE SYSTEM SHALL parar el anterior, vaciar su cola, radio, fijadas, plan y deshacer, devolver EQ y filtro de ambos decks a neutro, y no heredar nada de la sesión previa.
WHILE una pista del tema anterior suena THE SYSTEM SHALL dejarla sonar y pausar solo el deck que no suena.
#### ADDED design: Limpieza en start()
`AutoMix.start()` resetea queue, radioPool, pinned, pendingMix, plan, undoStack y waitSince antes de arrancar el nuevo tema.
