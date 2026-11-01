---
change: 2026-11-01-sin-video-fuentes-y-cola-analisis
status: approved
rev: 1
approved_rev: 1
approved_hash: b5395a3be61466da72a03fce79522e93c1541b73840d47be3a3694e1dc9448a6
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Design · 2026-11-01-sin-video-fuentes-y-cola-analisis

## Enfoque

Cuatro capas, de menor a mayor riesgo, cada una con su prueba: (1) retirar el video; (2) resolver la fuente de cada pista en un módulo puro y mostrarla; (3) una cola de análisis persistente en el proceso principal con su vista; (4) un sistema de vistas de trabajo en el renderer. El motor de audio, el analizador y el reproductor de YouTube Music no cambian.

### 1. Retirar el video (REQ-1)
Se borran: `renderer/video.html`, `video.js`, `localvideo.js`, `preload/video-window.js`, `scripts/test-video-local.js`, `video-local-selftest.js`, `video-live-selftest.js`, `video-media-selftest.js`, `docs/05-video-y-segunda-pantalla.md` y las pruebas `video-*` de `test-rediseno.js`. Se recorta: ventana, `layoutVideo`, `deckMedia`, IPC `video:*` y el protocolo `/localvideo/` en `main/main.js`; `video` en `preload/app.js`; `VIDEO_CSS`, `setVideoView`, `preferVideo`, `videoPref*` y el comando `videoView` en `preload/deck.js` (la guardia que revierte el autoplay se queda y ya no tiene excepción de «versión en video»); `videoSrc/videoKey/refreshVideo/tickVideo/syncMedia/videoMedia` y el botón `.pop` en `renderer/deck.js`; el panel `#video-panel`, `#btn-video` y el doble clic del plato en `app.js` e `index.html`; `downloadVideo`, `videoArgs`, `findVideo`, `videoPath`, `saveVideo`, `videoState` y `videoType` en `ytdlp.js`, `library-save.js`, `analyzer.js` y `ytm-library.js`. `settings.js` deja de tener `saveVideo`, `videoMaxHeight` y `videoPref`; al leer el archivo de ajustes se ignoran si existen. No se borra ninguna carpeta `.video`.

### 2. Fuente por pista (REQ-2)
`renderer/source.js` (puro, con prueba de unidad):

```
resolveSource({ track, analysis, preferSaved, forced }) →
  { source: 'file' | 'stream',
    origin: 'LOCAL' | 'GUARDADA' | 'STREAM',
    canSwitch: boolean,          // hay archivo y también stream
    why: string | null,          // razón cuando canSwitch es false y la pista no tiene archivo
    missing: boolean }           // tenía copia guardada y el archivo ya no existe
```
- `track.local` → `file`, origen `LOCAL`, no conmutable (no existe stream).
- Pista de YouTube con `analysis.saved` → origen `GUARDADA`; `file` si `preferSaved` (o `forced==='file'`), si no `stream`; conmutable.
- Sin copia → `stream`, origen `STREAM`, `canSwitch:false`, `why:'Analiza la pista para tener archivo'`.
- `Analyzer.get` añade `savedMissing:true` cuando el JSON dice que estuvo guardada y el archivo ya no existe; con `missing` el deck avisa una vez («La copia guardada ya no existe; suena por streaming») y la fila pasa a STREAM.
- `Deck.load` y `Deck.setSource` usan `resolveSource`; el estado `forced` se pierde al cargar otra pista. La etiqueta de origen sustituye al texto de estado actual («ARCHIVO LOCAL», «LOCAL · GUARDADA»); el selector `.source` pasa a `Archivo | Stream` y se deshabilita con `title` = `why`.
- Ajuste `preferSaved` (booleano, por defecto `true`), en Ajustes → Librería y música.
- Librería: la columna de título muestra, bajo el artista, un chip de origen (`ARCHIVO`, `GUARDADA`, `STREAM`) calculado con la misma función; el chip ✓ de análisis se mantiene en las acciones.

### 3. Cola de análisis persistente (REQ-3, REQ-4)
`main/analysis-backlog.js` (clase `Backlog`, recibe `analyzer`, `ytdlp.botBlocked`, ruta de archivo y `emit`; sin Electron, con prueba de unidad y analizador falso):

```
estado persistido  userData/analysis-queue.json
{ paused: boolean,
  lists: [{ id, name, addedAt }],
  items: [{ id /*videoId*/, listId, title, artist, thumb, duration, file?, state, error?, progress? }] }
state: 'queued' | 'running' | 'done' | 'error'
```
- `addList({ name, tracks })` → crea la lista, añade las pistas que `analyzer.get(id)` no tenga analizadas y que no estén ya en la cola (una pista en dos listas cuenta una vez, queda en la primera); devuelve `{ listId, added, skipped }`.
- Avance: solo cuando `!paused`, el analizador está libre (`running===null` y `queue` vacía) y `!botBlocked()`. Elige primero los ids que el renderer marca como cargados (`setPriority(ids)`), luego el orden de llegada. Entrega al analizador con `analyzer.request(id, { meta, file })` y escucha sus eventos (`download`, `analyze`, `done`, `error`) para actualizar `state/progress/error`; un error no detiene la cola. Las pistas pedidas a mano pasan por delante porque el analizador ya las tiene en su propia cola.
- Reanudación: al construir, todo `running` vuelve a `queued`. Escritura del archivo con debounce de 500 ms y escritura atómica (archivo temporal + renombrar). Si el bloqueo de bot está activo, un temporizador de 15 s reintenta avanzar.
- Operaciones: `pause()`, `resume()`, `cancelList(listId)`, `retry(listId)` (errores → queued), `clearDone()`, `state()`.
- IPC (`main/main.js`, `preload/app.js`): `backlog:add`, `backlog:state`, `backlog:pause`, `backlog:resume`, `backlog:cancel`, `backlog:retry`, `backlog:clear-done`, `backlog:priority`; evento `backlog:event` con el estado completo (se envía como máximo cada 250 ms).
- Vista: fuente `Análisis` (`data-tab="queue"`, icono `i-bars` con contador `#cnt-queue` de pendientes) abre `#queue-view`: cabecera con «Pausar / Reanudar» y «Quitar terminadas»; por lista una tarjeta con nombre, barra y `hechas/total`, botones «Reintentar errores» y «Cancelar»; por pista fila con estado, porcentaje y motivo del error. Estado vacío: «No hay nada en cola. Usa «Analizar lista» en cualquier lista.»
- Botones: `#btn-analyze-list` («Analizar lista») en `.lib-toolbar`, visible cuando la fuente muestra pistas (no listas), y botón «Analizar» por fila de lista (Playlists/Importadas) que primero obtiene las pistas (`lib.playlist` o `crate`). Las filas de Importadas muestran `n/m analizadas`.

### 4. Vistas de trabajo (REQ-5)
`renderer/views.js` (puro, con prueba de unidad):

```
VIEWS = ['mix','library','automix','waves']
STORE = 'alyssdj.view'            // localStorage { view, waves: 'top'|'deck' }
nextView({ current, prev, tab, userChoseSince }) → vista
```
- `body[data-view]` decide la disposición; `body[data-waves]` decide dónde están las ondas. Los perfiles `compact|normal|wide` siguen en `data-layout`.
- **mix**: disposición actual. **library**: aplica `am-compact` (ya existente) y la librería toma la altura. **waves**: se oculta `.library`; cada deck se reduce a una tira (título, BPM, tiempos, play, cue, sync) y `.waves` ocupa el resto con el mezclador al centro. **automix**: se oculta todo salvo `#immersive` (portada grande `min(46vh, 46vw)`, título, artista, BPM/tonalidad, «sigue», barra de transición, botones Iniciar/Mezclar ahora, estilo y duración con ids `imm-*` conectados a los mismos métodos de `AutoMix`).
- Ondas «en el deck»: el `<canvas id="scroll-X">` se mueve (reparent) a un hueco `.deck-scroll` entre la cabecera y la vista general; `.waves` se oculta. «Arriba» lo devuelve. No hay segundo dibujo: el mismo canvas y la misma rutina.
- `syncCompact()` pasa a depender solo de la vista (`library`) y se elimina la compactación por `automix.on`. Abrir la fuente AutoMix hace `setView('library')` guardando `prev`; al salir de ella vuelve a `prev` salvo que el usuario haya tocado el selector en medio (`userChoseSince`).
- Selector `#view-switch` (4 botones con icono y `title`, atajo en el `title`) en el grupo de herramientas de la barra; opción de ondas en Ajustes → Decks y diseño (`name="wavesMode"`, guarda también en `localStorage`) y en un botón del selector. Atajos Alt+1…4 en `bindKeyboard`.

## Visual Spec

- Selector de vista: segmentado de 4 botones de 32 px con icono + etiqueta corta (Mezcla, Librería, Automix, Ondas); el activo usa el acento neutro `--sel`. En ancho < 1100 px solo iconos.
- Chips de origen: 11 px, mayúsculas, `ARCHIVO`/`GUARDADA` con borde `--ok`, `STREAM` con borde `--line-2`; en el deck, junto a las etiquetas de análisis.
- Vista Análisis: tarjetas `--surface` con radio `--r-3`; barra de 6 px con el gradiente A→B; estados con color: en cola `--dim`, en curso `--warn`, hecha `--ok`, error `--err`.
- Vista Automix: portada con radio `--r-3` y sombra `--sh-2`, fondo con la misma portada desenfocada al 12 %; título 20 px, BPM mono 30 px; botón primario grande de 40 px; sin elementos decorativos animados (sin consumo de CPU adicional).
- Todas las vistas respetan los tamaños mínimos de control del rediseño anterior (28 px en consola, 32 px en barra).

## Domain deltas
### video
#### REMOVED spec: video local de pistas con video real
#### REMOVED spec: La ventana de video muestra solo el medio propio de cada deck
#### MODIFIED spec: Sin video en el plato y pista correcta en el stream
THE SYSTEM SHALL no ofrecer ni reproducir video; WHILE el stream reproduce una pista distinta de la cargada THE SYSTEM SHALL volver a la del deck, sin excepción de versión en video.
#### REMOVED design: videoKey y pickMedia
### library
#### REMOVED design: .video y sincronización
#### MODIFIED spec: Guardar pistas de YouTube en la librería local
WHEN una pista de YouTube ya está guardada THE SYSTEM SHALL reproducirla desde el archivo si «Preferir la copia guardada» está activo (por defecto), y por streaming si no; el usuario puede cambiar a mano mientras exista la copia.
IF la carpeta no es escribible o no hay espacio THEN THE SYSTEM SHALL mostrar la causa sin dejar parciales y sin colgarse.
IF el archivo guardado ya no existe al cargar la pista THEN THE SYSTEM SHALL reproducirla por streaming y avisar una vez.
#### ADDED spec: Origen visible de cada pista
THE SYSTEM SHALL mostrar el origen (ARCHIVO LOCAL, GUARDADA o STREAM) en cada deck y un chip de origen (ARCHIVO o STREAM) en cada fila de la librería; el selector archivo/stream del deck solo se puede usar si existen ambas fuentes y, si no, explica por qué.
#### ADDED design: Resolución de fuente
`renderer/source.js` exporta `resolveSource({ track, analysis, preferSaved, forced })` → `{ source, origin, canSwitch, why, missing }`. `Analyzer.get` añade `savedMissing` cuando el archivo guardado ya no existe. El ajuste `preferSaved` (por defecto `true`) vive en `main/settings.js`.
### analysis
#### ADDED spec: Cola de análisis de listas
WHEN el usuario pide «Analizar lista» THE SYSTEM SHALL encolar las pistas no analizadas ni ya en cola, analizarlas de una en una (las cargadas en un deck primero), seguir tras un error, guardar la cola en disco y retomarla al abrir la app, y esperar mientras dure el bloqueo de yt-dlp por comprobación de bot.
THE SYSTEM SHALL ofrecer la vista Análisis con el avance por lista y pista, pausar, reanudar, cancelar una lista, reintentar errores y quitar terminadas.
#### ADDED design: Backlog persistente
`main/analysis-backlog.js` (`Backlog`) guarda `userData/analysis-queue.json` (escritura atómica con retardo) con listas e ítems (`queued|running|done|error`), entrega de a uno al `Analyzer` solo cuando está libre y `!botBlocked()`, escucha sus eventos y notifica por `backlog:event` (máx. cada 250 ms). IPC `backlog:add|state|pause|resume|cancel|retry|clear-done|priority`.
### ui
#### ADDED spec: Vistas de trabajo
THE SYSTEM SHALL ofrecer las vistas Mezcla, Librería, Automix y Ondas (Alt+1…4), la opción de ondas arriba o en el deck, recordarlas entre sesiones y, al abrir la fuente AutoMix de la librería, pasar a Librería y volver a la vista anterior al salir si el usuario no eligió otra.
#### ADDED design: Máquina de vistas
`renderer/views.js` (`ViewState`: `set`, `setWaves`, `enterAutomixTab`, `leaveAutomixTab`, `effectiveWaves`, `compact`, `toJSON`) con `body[data-view]` y `body[data-waves]`; las ondas «en el deck» mueven el mismo canvas a `.deck-scroll`; la vista inmersiva es `#immersive` conectada a los métodos de `AutoMix`.

## Amendments
