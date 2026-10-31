---
change: 2026-10-31-mix-points-editables
status: approved
rev: 1
approved_rev: 1
approved_hash: e67d51024b0ebcfd0bad7eba4cd91fbbf6faab275242b064ad6a9780ffa61cac
approved_by: Alejandro Ramirez
approved_at: 2026-10-31
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

## Domain deltas
### automix
#### ADDED spec: puntos de mezcla editables
WHEN el usuario edita la entrada o las salidas (hasta 6) de una pista THE SYSTEM SHALL guardarlas aparte y hacer que AutoMix use solo las editadas, en su orden de preferencia, también tras reanalizar.
### library
#### ADDED design: mixedit
`main/mixedit.js` sanea y guarda `<id>.mixedit.json`; el analizador adjunta `mixEdit` y avisa con el evento `mixedit`; `renderer/mixeditor.js` y `mixpreview.js` dan el editor y la prueba de mezcla.
