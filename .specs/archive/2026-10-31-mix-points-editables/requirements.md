---
change: 2026-10-31-mix-points-editables
type: feature
domains: [automix, library]
paths: [docs/img/**, main/mixedit.js, renderer/mixeditor.js, renderer/mixpreview.js, scripts/mix-edit-selftest.js, renderer/deck.js, renderer/automix.js, renderer/mixplan.js, renderer/deck.js, renderer/waveform.js, renderer/app.js, renderer/index.html, renderer/styles.css, main/analyzer.js, preload/app.js, main/main.js, scripts/test-mix-edit.js]
commits: [411f9a7]
status: approved
rev: 1
approved_rev: 1
approved_hash: 4cff0b8af62b1c223532273168a79e0865e2c198412bb216488c115ae90bd7e3
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
---
# Requirements · 2026-10-31-mix-points-editables

## Contexto
AutoMix calcula puntos de entrada y varios de salida por pista (estructura por frases). Hoy no se ven ni se pueden corregir: si el análisis se equivoca, no hay remedio.

## Requisitos
### REQ-1: Ver los puntos
WHEN una pista analizada se muestra en un deck, en la vista de AutoMix o en el editor de mezcla THE SYSTEM SHALL dibujar sobre su onda el punto de entrada y todos los puntos de salida candidatos, con su puntuación.
### REQ-2: Editar varios puntos de salida
WHEN el usuario arrastra, añade (clic derecho o tecla) o borra un punto THE SYSTEM SHALL guardar la edición para esa pista, con hasta 6 puntos de salida y un punto de entrada, ajustados a la rejilla de beats (opcionalmente libres).
### REQ-3: AutoMix respeta lo editado
WHEN AutoMix planea la salida de una pista con puntos editados THE SYSTEM SHALL usar solo los editados, en el orden de preferencia indicado, y el comportamiento automático solo si no hay ediciones.
### REQ-4: Editar la pista en cola
WHEN el usuario abre una pista de la cola de AutoMix THE SYSTEM SHALL permitir editar sus puntos antes de que suene, y escucharlos con un botón «probar la mezcla» (pre-escucha por auriculares si hay salida cue).
### REQ-5: Restaurar
WHEN el usuario pulsa «Restaurar automático» THE SYSTEM SHALL descartar las ediciones y volver a los puntos calculados.
### REQ-6: Persistencia
THE SYSTEM SHALL conservar las ediciones entre sesiones, aunque la pista se vuelva a analizar.

## Fuera de alcance
Editar la rejilla de beats y automatizar efectos dentro de la transición.
