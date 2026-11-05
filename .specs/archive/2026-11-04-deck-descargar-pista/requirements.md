---
change: 2026-11-04-deck-descargar-pista
type: feature
domains: [audio, ui]
paths: [renderer/deck.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/automix.js, scripts/test-descargar-pista.js, docs/02-decks-y-mezclador.md]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 9e6101af2e38eb7cf0880e9c4f43038907fc1ac42bc7aba76d7664dcc80b3ee5
approved_by: Alejandro Ramirez
approved_at: 2026-11-04
---
# Requirements · 2026-11-04-deck-descargar-pista

## Contexto

Un deck solo puede cargar otra pista encima: no hay forma de **sacar** la pista cargada (como el botón de expulsar de un reproductor), un deck vacío no tiene botón para **cargar** y los textos de cabecera y de los botones de iniciar y radio quedan mal situados o poco claros. Quedan decks con una pista que ya no quieres, y AutoMix la sigue viendo como «el otro deck».

## Requisitos

### REQ-1: Descargar la pista de un deck
WHEN el usuario pulsa «Descargar pista» de un deck (botón visible junto a ⋯, atajo de la lista de controles y MIDI) THE SYSTEM SHALL detener el audio, dejar el deck como recién abierto (sin título, onda, cues, loops, sync, tempo propio ni FX de pista) y volver a mostrar «Arrastra o carga una pista».

### REQ-2: No cortar lo que suena
IF el deck está al aire (suena y su canal es audible) THEN THE SYSTEM SHALL no descargarlo y avisar «Deck X está al aire. Páusalo o baja su canal para descargar la pista», salvo que se confirme con una segunda pulsación en 3 s.

### REQ-3: AutoMix y la librería se enteran
WHEN se descarga la pista de un deck THE SYSTEM SHALL quitarla de «cargada en un deck» para la librería (marca de carga, prioridad de análisis y stems) y, IF AutoMix la está usando como la que suena o como la siguiente ya preparada, THEN THE SYSTEM SHALL avisar «AutoMix la está usando: detenlo o espera a que termine la mezcla» y no descargarla.

### REQ-4: Cargar pista visible y textos bien situados
WHILE un deck está vacío THE SYSTEM SHALL mostrar en su cabecera un botón «Cargar pista» (abre el selector de archivos de audio) y debajo la ayuda «o arrastra una pista de la librería», y WHILE tiene pista THE SYSTEM SHALL mostrar en una fila fija título, artista, BPM y tonalidad sin recortes ni solaparse con ⋯ y «Descargar pista», con el título en una línea (puntos suspensivos y el texto completo en el tooltip).

### REQ-5: Botones de iniciar y radio coherentes
WHEN AutoMix está detenido THE SYSTEM SHALL rotular el botón principal según lo que hará («Iniciar AutoMix» con una pista cargada, «Elegir radio…» sin pista, que abre el menú Radio en vez de solo avisar) y mostrar el motivo en una línea bajo la barra cuando un botón está deshabilitado (por ejemplo «Mezclar ahora: AutoMix detenido»); el menú Radio y el botón «Cargar pista» SHALL usar las mismas palabras en el panel, la vista Automix y la librería.

## Fuera de alcance
Borrar la pista de la librería o del disco; deshacer la descarga.
