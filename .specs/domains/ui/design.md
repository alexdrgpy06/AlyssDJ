---
domain: ui
paths: [renderer/library.js, scripts/automix-compact-selftest.js, renderer/styles.css, renderer/app.js, renderer/automix.js, renderer/index.html, scripts/test-automix-compact.js]
last_change: 2026-11-01-sin-video-fuentes-y-cola-analisis
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
