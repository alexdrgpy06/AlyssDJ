---
domain: ui
paths: [renderer/library.js, scripts/automix-compact-selftest.js, renderer/styles.css, renderer/app.js, renderer/automix.js, renderer/index.html, scripts/test-automix-compact.js]
last_change: 2026-11-04-automix-simple-y-continuo
---
# ui · design

## clase am-compact

`body.am-compact` reduce plato, oculta los bancos de funciones y compacta el mezclador; se activa desde `syncCompact` con el evento `alyss:tab` y el estado de AutoMix.

## layout.js

`profileFor`, `scaleFor` y `resolve` son puros; `body[data-layout]` activa el CSS compacto (comparte reglas con `am-compact`) y el amplio escala con `zoom` según `--ui-scale`.

## Acerca de y marca

Diálogo `#about` con `app:info`, marca «by AlystechPY» en la barra superior (oculta en compacto) e identificador py.alystech.alyssdj.

## Tokens y componentes

`styles.css` define `--s-1…6`, `--fs-1…5`, `--fs-bpm`, `--r-1…3`, `--r-pill`, `--sh-1/2`, `--dur-1/2`, `--ctl-h`, `--ctl-h-lg` y la selección neutra `--sel`/`--sel-ink`. Todo `input[type=checkbox]` es un interruptor y todo `input[type=range]` (salvo faders y crossfader) usa el deslizador único, con acento `--accent` del deck o `--sel`.

## Panel de fuentes y ajustes por secciones

`aside.sources` (botones `data-tab`, selector `.sources [data-tab]`) y `.lib-toolbar` sustituyen a `.tabs`; `#settings` usa `.set-nav` (rol tablist) y `.set-pane[data-pane]` con `App.setSettingsPane(id)`. AutoMix agrupa sus controles en `fieldset.am-group`.

## Máquina de vistas

`renderer/views.js` (`ViewState`: `set`, `setWaves`, `enterAutomixTab`, `leaveAutomixTab`, `effectiveWaves`, `compact`, `toJSON`) con `body[data-view]` y `body[data-waves]`; las ondas «en el deck» mueven el mismo canvas a `.deck-scroll`; la vista inmersiva es `#immersive` conectada a los métodos de `AutoMix`.

## SplitState y helpers de Ajustes

`renderer/splits.js` (`SplitState`, `clampSplit(which, px, inner, fixed)`), `renderer/settings-ui.js` (`settingsFilter`, `settingPatch`, `sectionDefaults`); IPC `settings:defaults`; `settings.set` escribe antes de actualizar la caché.

## FxChain, fxpanel y fxpad

`renderer/fxchain.js` (modelo puro con rampas y reloj inyectable), `renderer/fxpanel.js` (panel y MIDI), `renderer/fxpad.js` (pad); `Deck.fxSet(slot, patch)` y `Deck.fxRamp(slot, target, seconds)` para el AutoMix.

## viz.js

`renderer/viz.js` exporta `beatPhase`, `beatInBar`, `deckRings`, `vizScene`, `pulseOf` (puros) y `Visualizer` (bucle con rAF limitado, cuadro estático solo cuando cambia algo visible en movimiento reducido).

## Inventario de controles

`docs/inventario-controles.md` lista cada control, su lugar y los retirados; `scripts/test-orden.js` (modos automix, topbar, deck, banks, layout, docs) y `scripts/orden-selftest.js` lo comprueban a 1280×720.

## Módulo de la interfaz

`renderer/playlists.js` (`PlaylistsUI`) lo monta `Library` (`library.pls`) con ganchos en `show`, `render`, `onClick` y el arrastre de filas.

## Tira de entrada

`renderer/automix-entry.js` (`EntryStrip`) pinta `snapshot().entry` (`AutoMix.entryOf`) y guarda con `analysis.setMixEdit`.

## Timeline, compatibilidad en la cola y botón de la barra

`renderer/automix-timeline.js` (`Timeline`, `geometry`, `hit`) sobre `snapshot().timeline` (`AutoMix.timelineOf`); la cola pinta `compat` con ✓ ~ ! ? y etiquetas «sin análisis» / «sin archivo»; `#btn-automix` lleva `data-phase` y `#btn-automix-count` como tarjeta compacta en todas las vistas.

## fxpresets, move, route y mirrorFx

`renderer/fxpresets.js` (`FxPresets`, `FACTORY`) guarda en `alyssdj.fxpresets`; `FxChain.move`, `d` y `route` en el modelo; `fxpanel.js` monta el popover `.fx-pop` y `hold(i, down)`; `Deck.mirrorFx` copia las ranuras con ruta `both` al otro deck.

## Herramientas del mapa

`scripts/arquitectura-lib.js` (lectura del código), `arquitectura-gen.js` (escribe registro y documentos), `test-arquitectura.js` (registry, ipc, docs) y `visual-check.js` con `visual-check-selftest.js` (comparación dentro de Electron, `--approve` para aceptar un cambio intencionado).

## Barra de reproducción y menú Radio

`#am-transport` (sticky) con `#amv-toggle`, `#amv-mix`, `#amv-skip` y `#amv-radio`; `#am-more` (`<details>`) con las tres fieldset; `.imm-controls` con `#imm-toggle`, `#imm-mix`, `#imm-skip` y `#imm-radio`; `App.bindRadioMenu(btn, menu)` comparte el menú y se cierra con Esc o clic fuera.

## Deck.unload y rótulos

`Deck.unload({ force })`, `Deck.pickFile`, `AutoMix.holds(deck)`, `startLabel`, `disabledReason` y `LABELS` (automix-status.js); controles `deckX.eject`, `.deck-eject`, `.deck-load`, `#am-hint`.

## Panel simple

`#am-more` contiene `.am-simple` (`#amv-profile`, `#amv-len`, `#amv-fx`) y `#am-adv` con el resto; la tarjeta SIGUE muestra `#amv-entry-safe`.
