---
change: 2026-10-31-deck-sin-pista-en-silencio
type: fix
domains: [video]
paths: [preload/deck.js, scripts/**, .github/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 5ac1a462fe6c07890790b638ea9e5e7ed8f6369900e30267eae3ee52e6945881
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-deck-sin-pista-en-silencio

## Contexto

Con un deck sin pista cargada, la página de YouTube Music retoma sola lo último que sonaba (NSYNC) y suena aunque el deck esté vacío; la guardia del preload salía antes de actuar cuando no había pista esperada.

## Requisitos

### REQ-1: Deck vacío en silencio
WHILE un deck de streaming no tiene pista cargada THE SYSTEM SHALL mantener en pausa y silenciado el reproductor de YouTube Music de ese deck.
WHEN se carga una pista en ese deck THE SYSTEM SHALL reproducirla normalmente (silencio solo hasta que la pista esté lista).

## Fuera de alcance

- Cambiar la página de YouTube Music o su historial de reproducción.
