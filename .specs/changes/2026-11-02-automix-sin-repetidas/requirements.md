---
change: 2026-11-02-automix-sin-repetidas
type: fix
domains: [automix]
paths: [renderer/automix.js, renderer/mixplan.js, scripts/test-automix-add.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 63ae4102206ce7863e4a4daf16f07354693b652104b85446ae8245e3c53d17d0
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-automix-sin-repetidas

## Contexto

La radio de YouTube Music devuelve la misma canción con varios `videoId` (otra subida, otro crédito de artistas). El filtro del AutoMix comparaba solo `videoId`, así que la cola y las sugeridas mostraban "Thank You (Not So Bad)" dos veces seguidas.

## Requisitos

### REQ-1: Una sola versión de cada canción al rellenar con la radio
WHEN el AutoMix rellena la cola con candidatas de la radio THE SYSTEM SHALL descartar toda candidata cuya canción (título normalizado y primer artista) ya suena, está en la cola, ya sonó en la sesión o ya aparece antes en el mismo lote.

### REQ-2: Las sugeridas no repiten canciones
WHEN el AutoMix calcula las sugeridas THE SYSTEM SHALL excluir las que son la misma canción que una que suena, está en la cola o ya sonó, y mostrar una sola versión de cada canción.

### REQ-3: Misma canción pese a diferencias de formato
WHEN dos pistas difieren solo en acentos, mayúsculas, ruido entre paréntesis (official, video, remaster…) o en los créditos tras el primer artista THE SYSTEM SHALL tratarlas como la misma canción.

### REQ-4: Mezclar aunque falle el análisis o la descarga
IF una pista de la cola no se puede analizar o descargar THEN THE SYSTEM SHALL mantenerla en su lugar y mezclarla por streaming con fundido y sin igualar tempo, avisando en la nota, en vez de saltarla o detener el AutoMix.

## Fuera de alcance

- Agregar a mano una pista ya presente (sigue avisando solo por `videoId`).
- Canciones distintas con título parecido.
