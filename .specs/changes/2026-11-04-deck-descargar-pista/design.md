---
change: 2026-11-04-deck-descargar-pista
status: approved
rev: 1
approved_rev: 1
approved_hash: 39623d92c8eea564b248ce78e096712d4f0320d09dc1761c914f7982e91804b5
approved_by: Alejandro Ramirez
approved_at: 2026-11-04
---
# Design · 2026-11-04-deck-descargar-pista

## Enfoque

`Deck.unload({ confirm })` en `renderer/deck.js`: comprueba REQ-2 (al aire → aviso; segunda pulsación en 3 s confirma) y REQ-3 (`app.automix.holds(deck)` → aviso); pausa local y stream, pone `track`, `analysis`, `wave`, `srcInfo`, `cuePoint`, `hotcues`, `loop`, `syncLock`, `wantPlay` y `st` a su estado inicial, descarga el audio local (`audio.removeAttribute('src')`) y llama a `app.onDeckLoaded(this)` para que la librería, la cola de análisis y los stems se actualicen. `AutoMix.holds(deck)` es `true` si `on` y el deck es `cur` o su pista es la cabeza ya preparada de la cola.

UI: botón `.deck-eject` (icono nuevo `i-eject`) en `.badges` junto a `.deck-more`, deshabilitado sin pista; control registrado `deckX.eject` (atajo y MIDI). La vista del deck ya admite `track = null` (`render()` muestra «Arrastra o carga una pista»).

Cargar y textos: el deck vacío muestra `.deck-load` («Cargar pista», abre un `<input type=file accept=audio/*>` y registra el archivo con `local.register`) y la línea de ayuda; la cabecera pasa a una rejilla de tres columnas (portada · título/artista con elipsis · BPM/tonalidad) con `.deck-eject` y `.deck-more` en una columna fija a la derecha. En AutoMix, `startLabel(snap, decks)` (puro, en `automix-status.js`) devuelve el rótulo del botón principal y `disabledReason(snap)` la frase de motivo que se pinta en `#am-hint` bajo la barra; el menú Radio y «Cargar pista» comparten un diccionario `LABELS`.

## Contratos

```js
Deck.unload({ force = false } = {}): boolean   // true si se descargó
AutoMix.holds(deck): boolean
```

## Visual Spec

Icono de expulsar (triángulo sobre barra) de 16 px con el estilo de `.icon-btn`, tooltip «Descargar pista», `aria-label` «Descargar la pista del deck X», deshabilitado (opacidad 0,4) si el deck está vacío; foco visible.

## Amendments

## Domain deltas
### ui
#### ADDED spec: Descargar la pista de un deck
WHEN el usuario pulsa «Descargar pista» (botón, atajo o MIDI) THE SYSTEM SHALL dejar el deck como recién abierto; IF está al aire THEN avisa y exige una segunda pulsación en 3 s; IF AutoMix la usa THEN no la descarga.
#### ADDED spec: Cargar pista y rótulos coherentes
WHILE un deck está vacío THE SYSTEM SHALL ofrecer «Cargar pista» con la ayuda «o arrastra una pista de la librería», y el botón de AutoMix dirá «Iniciar AutoMix» con una pista cargada o «Elegir radio…» (abre el menú Radio) sin ninguna, con el motivo de un botón deshabilitado en una línea de la barra.
#### ADDED design: Deck.unload y rótulos
`Deck.unload({ force })`, `Deck.pickFile`, `AutoMix.holds(deck)`, `startLabel`, `disabledReason` y `LABELS` (automix-status.js); controles `deckX.eject`, `.deck-eject`, `.deck-load`, `#am-hint`.
