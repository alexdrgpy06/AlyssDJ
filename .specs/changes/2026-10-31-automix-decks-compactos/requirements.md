---
change: 2026-10-31-automix-decks-compactos
type: feature
domains: [automix, ui]
paths: [renderer/styles.css, renderer/app.js, renderer/automix.js, renderer/index.html, scripts/test-automix-compact.js]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-10-31-automix-decks-compactos

## Contexto
Con AutoMix activo, la vista de AutoMix (lista y controles) compite por espacio con los decks completos. Los decks deben ocuparse menos mientras AutoMix corre.

## Requisitos
### REQ-1: Decks compactos con AutoMix
WHILE AutoMix está activo (o su panel abierto) THE SYSTEM SHALL mostrar los decks en modo compacto: plato y portada reducidos, bancos de funciones (loop/jump/fx/grid) colapsados, hot cues en una fila.
### REQ-2: Siempre
THE SYSTEM SHALL aplicar el modo compacto sin que el usuario deba activarlo, y restaurar los decks completos al detener AutoMix.
### REQ-3: No se pierde información clave
WHILE los decks están compactos THE SYSTEM SHALL seguir mostrando título, tiempo, BPM, tonalidad, forma de onda, play/cue/sync y el estado de la mezcla.
### REQ-4: Más espacio para la lista
WHILE los decks están compactos THE SYSTEM SHALL dar a la vista de AutoMix al menos el 40% de la altura de la ventana.

## Fuera de alcance
Cambios al algoritmo de mezcla.
