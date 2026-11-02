---
change: 2026-11-02-automix-sin-repetidas
status: approved
rev: 1
approved_rev: 1
approved_hash: 39d0706ff5d5f783e603992bddd29e28aa6ae83b5d2d9c0a74a659aa6a73a63b
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Design · 2026-11-02-automix-sin-repetidas

## Enfoque

- `songKey(track)` en `renderer/mixplan.js` (pura): título sin acentos, en minúsculas y sin paréntesis/corchetes que solo contengan ruido (official, video, audio, lyrics, remaster, visualizer, hd, clean, explicit, version, mv), más el primer artista (se corta en `,`, `&`, `x`, `feat`, `ft`, `with`, `and`). Devuelve `titulo|artista`. (REQ-3)
- `AutoMix.knownSongs()` reúne las claves de la cola, la pista actual, los dos decks y `histTracks` (pistas ya sonadas; se vacía junto con `history`). (REQ-1, REQ-2)
- `radioCandidates` filtra además por clave conocida y añade cada clave aceptada al conjunto, de modo que tampoco entran dos versiones en el mismo lote. (REQ-1)
- `suggestions` aplica el mismo filtro y deduplica entre `radioPool` y `libPool`. (REQ-2)
- En `tick()`, una cabeza con `prep.state === 'error'` deja de moverse al final: pasa a `{state:'ready', stream:true, error}` y se muestra una nota. La mezcla usa el plan existente con análisis vacío (fundido, sin tempo). (REQ-4)

## Contratos

- `songKey(t: {title, artist}) → string`, determinista y sin efectos.
- `histTracks: Track[]` nuevo en `AutoMix`, paralelo a `history: Set<videoId>`.
- Sin cambios de IPC ni de formato en disco.

## Decisiones

- Clave título+primer artista, no solo título: evita descartar canciones distintas con el mismo título (p. ej. "Intro").
- Agregar a mano sigue comparando solo por `videoId`: la decisión es del usuario.
- El respaldo por streaming reutiliza el mecanismo de `waitForReady` en vez de otro camino de mezcla.

## Visual Spec

Sin cambios de interfaz: solo cambia qué pistas aparecen en la cola y las sugeridas, y el texto de la nota.

## Amendments

## Domain deltas
### automix
#### ADDED spec: Sin canciones repetidas
WHEN AutoMix rellena la cola con la radio o sugiere pistas THE SYSTEM SHALL tratar como la misma canción las que comparten título normalizado (sin acentos ni ruido entre corchetes) y primer artista, aunque tengan distinto videoId, y no repetirla ni encadenarla dos veces seguidas.
IF el análisis o la descarga de la siguiente pista falla THEN THE SYSTEM SHALL mezclarla igualmente por streaming con fundido, sin tempo, y avisarlo en una nota.
#### ADDED design: songKey
`mixplan.songKey(track)` normaliza título y primer artista; `AutoMix.knownSongs()` reúne cola, historial y pista actual para filtrar el relleno y las sugerencias; una cabeza con preparación en error pasa a `ready` con `stream: true`.
