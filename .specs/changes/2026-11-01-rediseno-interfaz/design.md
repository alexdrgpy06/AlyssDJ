---
change: 2026-11-01-rediseno-interfaz
status: approved
rev: 1
approved_rev: 1
approved_hash: cba0913efb8731e5030dbc944c6187bec650900b463088be35228f97cc24b224
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Design · 2026-11-01-rediseno-interfaz

## Enfoque

Rediseño por capas, de abajo arriba, sin tocar audio ni análisis: (1) quitar lo que sobra y arreglar la ventana de video; (2) sistema visual (tokens y componentes); (3) cada zona usando solo esos componentes; (4) pruebas, docs y capturas. El HTML y las clases que usan las pruebas y `deck.js`/`app.js` se conservan cuando es posible; lo que se mueve se mueve con su prueba.

### Video (REQ-1, REQ-2)
- Se borran `renderer/ministage.js`, `<section id="stage">`, `#amv-stage`, las reglas `.stage*`/`body.am-stage`, las teclas V, `[`, `]`, `Deck.setFrames`, el IPC `deck:frame` y `grabFrame` del preload, y `scripts/test-ministage.js`, `test-stage.js`, `stage-selftest.js`. Se mantiene `Deck.videoSrc/videoKey` (los usa la ventana de video). `localStorage['alyssdj.stage']` se ignora.
- Causa del NSYNC: `layoutVideo()` (main.js) hace visible la vista de YouTube Music de todo deck sin video local, aunque esté vacío o sea local sin video. Nuevo contrato: el renderer informa por deck el **medio** y main solo muestra la vista de streaming si el medio es `stream`.

### Contratos

```
video:deck-media  (renderer → main)  id: 'A'|'B',
  media: { kind: 'stream' }                         // pista de streaming cargada y lista
       | { kind: 'local', src: string }             // video local guardado de ESA pista
       | { kind: 'none', cover?: string, label: string }  // vacío o sin video
vwin:layout       (main → ventana de video)  { A: Tile|null, B: Tile|null }
  Tile = { x, y, width, height, src? , cover?, label? }
```
- `kind: 'stream'` solo si `source==='stream'`, hay `track` y el deck ya cargó esa pista (`expected` igual que el id cargado). En cualquier otro caso `none` con el texto «Sin pista» o «Sin video» y la portada si existe.
- `kind: 'none'` oculta la vista de streaming (`setVisible(false)`, `videoView off`) y `video.html` dibuja un fondo negro con portada atenuada y la leyenda.
- Compatibilidad: `video:deck-source` se mantiene como alias de `{kind:'local'|'none'}` mientras exista código que lo use; se elimina al terminar.

### Estructura (REQ-4, REQ-5)
```
┌ barra: [marca · sesión] ········ [AutoMix · Sampler · ● REC] ··· [MIDI · Video · ? · Ajustes] ┐
├ ondas A (cian) ─────────────────────────────────────────────────────────────────────────────┤
├ ondas B (rosa) ─────────────────────────────────────────────────────────────────────────────┤
├ consola ─ deck A ───────────┬─ mezclador ──────┬─ deck B ───────────┤
├ librería ─ fuentes │ barra de herramientas (búsqueda, acciones) │ tabla ───────────────────┤
```
- Barra: tres grupos separados por divisores; los botones de texto pasan a icono + etiqueta corta, el estado de herramientas (yt-dlp/ffmpeg) se mueve a Ajustes → Herramientas y solo aparece en la barra si falta algo.
- Cabecera de deck (patrón Mixxx/djay): portada 56 px a la izquierda; título y artista; fila de chips (fuente, estado de análisis); a la derecha BPM grande, tonalidad y pitch. Los tiempos pasan a la fila de la vista general. Igual en A y B (espejo horizontal solo del orden de columnas, no de la jerarquía).
- Mezclador: sin cambios funcionales; se alinea a la cuadrícula de 4 px, canales con etiqueta de color y VU junto al fader.
- Librería: `nav.tabs` pasa a `aside.sources` (columna de 168 px con icono + etiqueta + contador; 48 px solo iconos bajo 1100 px). `.tabs` deja de existir; el campo de búsqueda y las acciones por fuente pasan a `.lib-toolbar`. Los `data-tab` se conservan para no romper `library.show()`.
- AutoMix: `.am-controls` se divide en cuatro `<fieldset class="am-group">` con título. Los ids actuales (`amv-*`) se conservan.
- Ajustes: `<dialog id="settings">` con `nav.set-nav` a la izquierda y `section.set-pane[data-pane]` a la derecha; los `name=` de los campos no cambian, así que `settings.js` no cambia.

## Visual Spec

### Tokens
| Token | Valor |
|---|---|
| Espaciado | 4 · 8 · 12 · 16 · 24 · 32 (`--s-1`…`--s-6`) |
| Tipografía | 11 (etiquetas, mayúsculas con `.08em`) · 12 (secundario) · 13 (cuerpo) · 15 (títulos de pista) · 20 (títulos de panel) · 30 mono (BPM) |
| Radios | 4 (chips) · 6 (controles) · 10 (paneles) · 999 (píldoras y platos) |
| Elevación | 0 plano · 1 panel (`0 10px 30px #0008`) · 2 flotante (`0 18px 50px #000c`) |
| Superficies | las de la constitución (`#05070b` → `#181f2d`); sin degradados decorativos en paneles nuevos |
| Color | `--a` cian y `--b` rosa solo para identidad de deck; `--play` verde solo play/OK; `--cue` ámbar solo cue; `--warn`/`--err` estados. Acento de interfaz neutro (blanco azulado `#e9edf5` sobre `--raised-2`) para selección que no pertenece a un deck |
| Movimiento | 120 ms (estados), 200 ms (paneles), `ease`; todo bajo `@media (prefers-reduced-motion: reduce)` a 0 |

### Componentes
- **Botón**: primario (relleno acento del contexto), normal, fantasma, icono (28×28 mínimo). Altura 28 (32 en barra y diálogos). Estado foco: anillo 2 px `#8fd8ff`.
- **Segmentado** (`.seg`): un solo estilo; el elegido usa el acento del deck si está dentro de un deck y el acento neutro fuera.
- **Interruptor** (`.switch`) reemplaza los casilleros sueltos de AutoMix y Ajustes; etiqueta a la derecha, ayuda en `small`.
- **Deslizador**: pista 4 px, tirador 14 px, valor en `output` mono.
- **Estado vacío**: icono 24 px, frase corta, una acción.
- **Diálogo**: ancho 720 (ajustes) / 520 (resto), cabecera con título 20 px y cierre, pie con acciones a la derecha.

### Contraste y objetivos
Texto secundario `#9ba6b8` sobre `#0b0e14` = 7,6:1; mínimo `--faint` `#6d788b` solo para metadatos no esenciales (4,6:1 sobre `#05070b`). Objetivos de clic ≥ 28 px en consola y ≥ 32 px en barra y diálogos.

### Perfiles
`compact` (<1280×780): consola con una fila menos de pads; panel de fuentes en iconos. `normal`: como arriba. `wide` (≥1920): escala `--ui-scale` actual.

## Domain deltas
### video
#### REMOVED spec: Miniatura de video correcta y redimensionable
#### ADDED spec: La ventana de video muestra solo el medio propio de cada deck
WHEN la ventana de video muestra un deck THE SYSTEM SHALL mostrar el video solo si ese deck tiene su propia pista cargada (video local guardado de esa pista, o streaming ya listo).
IF un deck está vacío, sin video o aún cargando THEN THE SYSTEM SHALL mostrar una pantalla negra con la portada atenuada y la leyenda «Sin pista», «Sin video» o «Cargando…», nunca la página de YouTube Music.
#### MODIFIED design: videoKey y pickMedia
`Deck.videoKey` identifica la pista a la que pertenece `Deck.videoSrc`. `Deck.videoMedia()` calcula el medio del deck (`stream` solo con `source==='stream'`, pista cargada y `st.ready`; `local` con `videoSrc` de esa pista; si no, `none` con leyenda y portada) y `syncMedia()` lo envía por `video:deck-media` solo si cambia. Main guarda `deckMedia[id]` y `layoutVideo()` muestra la vista de YouTube Music únicamente con `kind:'stream'`; con `none` oculta la vista y la página `video.html` dibuja la pantalla negra (`#ph-A`, `#ph-B`). Ya no existen `pickMedia`, los fotogramas del stream (`deck:frame`, `grabFrame`) ni la vista de miniaturas.
### ui
#### REMOVED design: Franja #stage
#### ADDED spec: Estructura en cuatro zonas
THE SYSTEM SHALL organizar la ventana en barra superior, ondas, consola (deck A, mezclador, deck B) y librería, con la barra agrupada en identidad y sesión, herramientas de la mezcla y sistema, y la misma cabecera de deck (portada, título, artista, BPM, tonalidad, tiempos, fuente) en ambos decks.
#### ADDED spec: Sistema visual único
THE SYSTEM SHALL usar una escala única de espaciado, tipografía, radios y elevaciones, y componentes únicos (botón, segmentado, interruptor, deslizador, estado vacío, diálogo); el cian y el rosa identifican solo a los decks A y B.
#### ADDED spec: Librería con panel de fuentes
THE SYSTEM SHALL mostrar las fuentes (Buscar, Me gusta, Playlists, Importadas, Local, Analizados, Historial, AutoMix) en un panel lateral, que bajo 1100 px de ancho se reduce a iconos, con la búsqueda y las acciones de la fuente en una barra de herramientas y un estado vacío con la siguiente acción.
#### ADDED spec: AutoMix por grupos
THE SYSTEM SHALL presentar los controles de AutoMix en los grupos Reproducción, Transición, Cola y Fuente, sin quitar funciones ni atajos.
#### ADDED spec: Ajustes por secciones
THE SYSTEM SHALL mostrar Ajustes con navegación lateral por secciones (Herramientas, Librería y música, Audio, Decks y diseño, MIDI, Cuenta), una a la vez y operable con flechas, conservando todos los campos.
#### ADDED spec: Accesibilidad y estados
THE SYSTEM SHALL mantener contraste mínimo 4.5:1 en texto, objetivos de clic de al menos 28 px en la consola y 32 px en la barra, foco visible y movimiento reducido cuando el sistema lo pide.
#### ADDED design: Tokens y componentes
`styles.css` define `--s-1…6`, `--fs-1…5`, `--fs-bpm`, `--r-1…3`, `--r-pill`, `--sh-1/2`, `--dur-1/2`, `--ctl-h`, `--ctl-h-lg` y la selección neutra `--sel`/`--sel-ink`. Todo `input[type=checkbox]` es un interruptor y todo `input[type=range]` (salvo faders y crossfader) usa el deslizador único, con acento `--accent` del deck o `--sel`.
#### ADDED design: Panel de fuentes y ajustes por secciones
`aside.sources` (botones `data-tab`, selector `.sources [data-tab]`) y `.lib-toolbar` sustituyen a `.tabs`; `#settings` usa `.set-nav` (rol tablist) y `.set-pane[data-pane]` con `App.setSettingsPane(id)`. AutoMix agrupa sus controles en `fieldset.am-group`.

## Amendments
