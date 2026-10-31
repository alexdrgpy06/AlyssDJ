---
change: 2026-10-31-mix-points-editables
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Design · 2026-10-31-mix-points-editables

## Enfoque
- Datos: `analysis.mixEdit = { in: t|null, outs: [{t, pref}], free: bool, updated }` guardado aparte del análisis (archivo `<id>.mixedit.json`), de modo que reanalizar no lo borra.
- `mixplan.plan(analysis, mixEdit)`: si `mixEdit.outs.length` usa esos candidatos (ordenados por `pref`, sin puntuación); si no, el cálculo actual.
- UI: `renderer/mixeditor.js`: editor modal con la onda completa (reutiliza `waveform.drawOverview`), marcadores arrastrables (entrada verde, salidas rojas numeradas), clic derecho añade, Supr borra, ajuste a beats/frases por defecto, lista lateral con orden y botón «Restaurar automático». Se abre desde la fila de la cola de AutoMix y desde el deck (botón «Puntos de mezcla»).
- «Probar la mezcla»: reproduce los últimos 20 s antes de la salida elegida seguidos de los primeros 20 s de la siguiente, solo por cue.
- IPC: `analysis:mixedit:get/set`; el analizador lo devuelve junto con el análisis.

## Contratos
`mixEdit.outs.length <= 6`; tiempos en segundos de la pista.

## Visual Spec
Editor con onda a lo ancho, marcadores con tiradores de 44 px de alto, lista de puntos y acciones; mismo estilo oscuro de la app.

## Amendments
