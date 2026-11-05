---
change: 2026-11-03-automix-inicio-y-controles
status: approved
rev: 1
approved_rev: 1
approved_hash: e8446057885b5f4c051b986d81348c153490f9afdfb940abd895e4f6fbe4bb0d
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-automix-inicio-y-controles

## Enfoque

La lógica nueva va en un módulo puro, `renderer/automix-origin.js` (sin DOM), y las dos vistas (panel e inmersiva) solo la pintan y llaman a los mismos métodos de `AutoMix`.

- **Orígenes de radio** (`radioOrigins({ decks, list, query })`): devuelve la lista ordenada de orígenes disponibles: `playing` (pista que suena), `deckA`/`deckB` (pista cargada en cada deck, si hay), `list` (primera pista de la lista abierta, si hay) y `search` (siempre; enfoca el buscador del panel). Cada uno trae `{ id, label, sub, track }`; sin pista no se ofrece. Un origen con pista llama a `AutoMix.start({ seed: track })`, que ya carga la pista, llena la cola con su radio (o con sugerencias locales en modo local o sin sesión) e inicia.
- **Búsqueda como origen**: cada resultado de `#amv-results` gana un botón «Radio» que llama a `start({ seed })`; el botón existente «Añadir» no cambia.
- **El otro deck cuenta** (`otherDeckHead(cur, other, ana)`): si `start()` no recibe `tracks`, la cola está vacía y el otro deck tiene una pista distinta de la que suena y analizada, se devuelve como cabeza de cola cuando `bpmGap ≤ MAX_BPM_GAP` y la tonalidad no choca (`keysCompatible` o sin dato); si no, `null` y se usa la radio como hasta ahora. `start()` la pone con `queue.unshift` y `ensureQueue()` rellena detrás desde ella.
- **Panel**: el grupo «Reproducción» pasa a una barra fija arriba del panel (`position: sticky`) con Iniciar/Detener, Mezclar ahora, Siguiente y «Radio ▾» (menú con los orígenes). Debajo van las tres tarjetas, la cola con su buscador y, plegado por defecto en un `<details>`, «Ajustes de AutoMix» con Transición, Cola y Fuente. Todos los botones de `.am-row` usan el mismo estilo (borde visible, sin `ghost`), los segmentos de estilo envuelven en vez de recortarse.
- **Vista inmersiva**: `.imm-controls` gana `#imm-toggle`, `#imm-mix`, `#imm-skip` y `#imm-radio` (mismo menú); `renderImmersive` sincroniza su estado (texto, deshabilitado) con `snapshot()` igual que el panel.
- **Barra superior**: `#btn-automix span`, `#session-label` y los botones de la barra no se parten (`white-space: nowrap`); la etiqueta de AutoMix se acorta a «AutoMix» + punto y cuenta atrás.

## Contratos

```js
// renderer/automix-origin.js
export function radioOrigins({ decks, list, query }): Array<{ id: 'playing'|'deckA'|'deckB'|'list'|'search', label: string, sub: string, track: Track|null }>
export function otherDeckHead(cur: Deck, other: Deck, ana: Map<videoId, Analysis>): Track | null
// AutoMix
start({ seed, tracks })   // sin cambios de firma; con cola vacía puede tomar la pista del otro deck
```

## Visual Spec

Sin colores ni tipografías nuevas: los tokens de `styles.css`. A 1280×720 la barra fija mide 40 px (`--ctl-h-lg`), las tres tarjetas se compactan a una fila, la cola ocupa el resto con desplazamiento propio y «Ajustes de AutoMix» queda plegado. Estados: sin pista → «Radio» ofrece solo «Buscar»; con AutoMix activo → «Detener», «Mezclar ahora» y «Siguiente» habilitados; mezclando → «Mezclar ahora» deshabilitado. Foco visible en todos los botones y el menú «Radio» se cierra con Esc.

## Domain deltas
### automix
#### ADDED spec: Empezar desde una radio
THE SYSTEM SHALL ofrecer en AutoMix un menú «Radio» con la pista que suena, la de cada deck, la primera de la lista abierta y una búsqueda como orígenes, y WHEN el usuario elige uno THE SYSTEM SHALL cargar esa pista, llenar la cola con su radio (o con pistas compatibles de la librería en modo local o sin sesión) e iniciar AutoMix; cada resultado del buscador de AutoMix tiene su botón «Radio».
#### ADDED spec: El otro deck cuenta como siguiente
WHEN AutoMix inicia sin lista propia y el otro deck tiene una pista distinta, analizada y sin salto de BPM mayor al 8 % ni tonalidad en choque THE SYSTEM SHALL usarla como la siguiente antes de pedir pistas a la radio.
#### ADDED design: automix-origin.js
`radioOrigins({ decks, list })` devuelve los orígenes disponibles y `otherDeckHead(cur, other, ana)` la pista del otro deck apta; `AutoMix.start` hace `queue.unshift` de esa pista cuando no recibe `tracks`.
### ui
#### ADDED spec: Controles de AutoMix completos y sin recortes
WHILE la ventana mide 1280×720 THE SYSTEM SHALL mostrar la barra de reproducción de AutoMix (iniciar o detener, mezclar ahora, siguiente y radio) fija arriba del panel y también en la vista Automix, la cola y el buscador a la vista, los ajustes de transición, cola y fuente plegados, los botones con borde y los segmentos de estilo sin recortar, y la barra superior sin textos partidos.
#### ADDED design: Barra de reproducción y menú Radio
`#am-transport` (sticky) con `#amv-toggle`, `#amv-mix`, `#amv-skip` y `#amv-radio`; `#am-more` (`<details>`) con las tres fieldset; `.imm-controls` con `#imm-toggle`, `#imm-mix`, `#imm-skip` y `#imm-radio`; `App.bindRadioMenu(btn, menu)` comparte el menú y se cierra con Esc o clic fuera.

## Amendments
### A1 · 2026-11-03
Cambio: la vista inmersiva recupera iniciar, mezclar ahora y siguiente (el rediseño anterior las había retirado) y la etiqueta de la barra pasa de «AutoMix · activo / mezclando» a «AutoMix activo / Mezclando».
Motivo: sin ellas no se puede iniciar ni controlar AutoMix desde la vista Automix; la etiqueta corta evita partirse en dos líneas.
Afecta: REQ-2, REQ-4.
