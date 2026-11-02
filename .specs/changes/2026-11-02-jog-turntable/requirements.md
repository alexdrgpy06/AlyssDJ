---
change: 2026-11-02-jog-turntable
type: feature
domains: [audio, ui]
paths: [renderer/deck.js, shared/deck-engine.js, renderer/styles.css, scripts/test-jog*.js]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-11-02-jog-turntable

## Contexto

Hoy el jog solo hace pitch bend si suena (±30 % durante 80 ms) o búsqueda fina en pausa. Tocar el plato no hace nada: no hay freno de vinil, ni scratch, ni arranque. Un plato de tocadiscos o de controlador real responde al tacto: al apoyar la mano el disco frena, arrastrarlo mueve el audio hacia delante o atrás, y al soltarlo vuelve a girar. El audio local (`<audio>`) no puede reproducir hacia atrás ni por debajo de ~0,06× de velocidad, y el de YouTube va por un iframe sin control fino, por lo que el scratch real exige un reproductor propio sobre un buffer decodificado (a validar en una prueba de viabilidad).

## Requisitos

### REQ-1: Tocar el plato frena el disco
WHEN el usuario pulsa el plato de un deck que suena THE SYSTEM SHALL frenar el audio y la rotación del plato en menos de 200 ms hasta quedar sujeto, como un vinilo retenido con la mano.

### REQ-2: Arrastrar hace scratch
WHILE el plato está sujeto y el usuario lo arrastra en círculo THE SYSTEM SHALL mover la posición de la pista con la mano, a su velocidad y en su sentido (hacia atrás incluido), y el plato SHALL girar con el puntero.

### REQ-3: Soltar reanuda
WHEN el usuario suelta el plato THE SYSTEM SHALL volver a la velocidad del deck con un arranque de unos 300 ms desde la posición alcanzada, o quedar en pausa si el deck estaba en pausa.

### REQ-4: Plato en pausa
WHILE el deck está en pausa THE SYSTEM SHALL permitir escuchar al arrastrar el plato (scrub) con el mismo comportamiento de REQ-2, sin reanudar al soltar.

### REQ-5: Respaldo sin buffer
IF la pista no tiene audio local decodificable (p. ej. streaming de YouTube) THEN THE SYSTEM SHALL ofrecer solo freno y arranque suaves con búsqueda al soltar, y avisarlo una vez en pantalla.

### REQ-6: Sin cortes en la mezcla
WHILE un deck está sujeto THE SYSTEM SHALL mantener su tempo, fase y SYNC coherentes al soltarlo, y AutoMix SHALL no iniciar transiciones sobre un deck sujeto.

## Fuera de alcance

- Backspin automático y efectos de vinilo sobre el botón de efectos (se evaluarán aparte).
- Entrada por MIDI de jog con sensor táctil (se mantiene el `nudge` actual).
- Time-stretch en el scratch.
