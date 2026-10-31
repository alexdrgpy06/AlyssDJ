---
change: 2026-10-31-deck-sin-pista-en-silencio
status: approved
rev: 1
approved_rev: 1
approved_hash: 3cf3c554df590b16ea77a60b2e3d4ccfdd650b89df49d85dbc7f31046a3882cb
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Design · 2026-10-31-deck-sin-pista-en-silencio

## Enfoque

En `tick` de `preload/deck.js`, si hay `<video>` pero no `expected` (ninguna pista cargada), se hace `v.pause()` y `v.muted = true` y se sale. Al cargar una pista, el camino de `settling` ya deja `muted = false` cuando está lista.

## Contratos

Prueba estática `scripts/test-stream-guard.js` (el preload solo corre dentro de la página de YouTube Music).

## Visual Spec

Sin cambios de interfaz.

## Domain deltas
### video
#### ADDED spec: Deck vacío en silencio
WHILE un deck de streaming no tiene pista cargada THE SYSTEM SHALL mantener en pausa y silenciado el reproductor de YouTube Music de ese deck.

## Amendments
