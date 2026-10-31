---
change: 2026-10-31-automix-decks-compactos
type: feature
domains: [automix, ui]
paths: [renderer/styles.css, renderer/app.js, renderer/automix.js, renderer/index.html, scripts/test-automix-compact.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 466ea0c4b2d767aa37c4f1865ceb97f76215032fe2d43d2623810f9b6cca38df
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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
