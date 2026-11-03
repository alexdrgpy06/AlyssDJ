# 04 · Vistas y componentes

Estructura de la ventana tal como la define [renderer/index.html](../../renderer/index.html): qué hay en cada vista, qué IDs y clases usan el código y las pruebas, de qué estado dependen y qué eventos mueven cada pieza. La plantilla del deck (`#deck-tpl`) se instancia dos veces, en `#deck-A` y `#deck-B`.

## Vistas de trabajo

El estado vive en [renderer/views.js](../../renderer/views.js) (`ViewState`, clave `alyssdj.view`): la interfaz solo escribe `view` y `waves` en el `<body>`; el CSS decide qué se ve.

| Vista | `data-view` | Atajo | Qué muestra | Ondas |
|---|---|---|---|---|
| Mezcla | `mix` | Alt+1 | Dos decks grandes, mezclador, librería abajo | arriba o en el deck |
| Librería | `library` | Alt+2 | Decks compactos (plato pequeño, pads en una fila) y librería amplia | arriba o en el deck |
| Automix | `automix` | Alt+3 | Vista inmersiva `#immersive`: portada, visualizador, siguiente pista | propias |
| Ondas | `waves` | Alt+4 | Ondas grandes de ambos decks | propias |

Abrir la fuente «AutoMix» de la librería pasa temporalmente a Librería y vuelve a la vista anterior si nadie eligió otra (`enterAutomixTab` / `leaveAutomixTab`). Selector: `#view-switch`; ondas «arriba / en el deck»: `#waves-toggle`. Los divisores arrastrables (`renderer/splits.js`) guardan su tamaño por vista.

## Barra superior (`header.topbar`)

| Elemento | ID | Eventos |
|---|---|---|
| Selector de vista | `#view-switch` | clic en `[data-view]` → `ViewState.set` |
| Ondas arriba/deck | `#waves-toggle` | `setWaves` |
| AutoMix (cola) | `#btn-automix`, `#btn-automix-count` | abre la fuente AutoMix |
| Sampler | `#btn-sampler` → `#sampler-panel` (`#sp-pads`, `#sp-vol`) | F1–F8 |
| Grabar | `#btn-rec` | `MediaRecorder` sobre la mezcla |
| Modo local | `#local-badge` | visible con el ajuste `localMode` |
| Herramientas | `#tools-status` | estado de yt-dlp/ffmpeg |
| Sesión | `#session`, `#session-dot`, `#session-label`, `#btn-login` | `auth:*` |
| MIDI / ayuda / ajustes | `#btn-midi-learn`, `#btn-help`, `#btn-settings` | abren diálogo |
| Aviso de actualización | `#update-banner`, `#upd-*` | `update:state` |

## Deck (`#deck-tpl` → `section.deck`)

Componente más grande de la interfaz; lo implementa [renderer/deck.js](../../renderer/deck.js) con el motor de [shared/deck-engine.js](../../shared/deck-engine.js).

| Zona | Clases principales | Estado que refleja | Eventos |
|---|---|---|---|
| Cabecera | `.deck-head`, `.head-art`, `.title`, `.artist`, `.badges` | pista cargada, BPM, tonalidad (`.kchip`) | arrastrar pista, carga |
| Menú ⋯ | `.deck-more`, `.deck-menu` (`role="menu"`) | fuente `.seg.source` (`data-src="stream|local"`) | Analizar (`.analyze`), Puntos de mezcla (`.mix-points`), YouTube Music (`.view-ytm`) |
| Plato | `.platter`, `.ring-bg`, `.ring-fg`, `.spin` | posición y velocidad | arrastrar = jog / scratch |
| Transporte | `.transport`, `.play`, `.cue`, `.sync`, `.nudge-down/up` | reproduciendo, cue | Z/X/Q, A/S (deck A); M/N/P, K/L (deck B) |
| Tempo | `.pitch-fader`, `.pitch-val`, `.range`, `.keylock`, `.quant` | tempo y rango | arrastrar, doble clic = 0 |
| Cues y loops | `.hotcues`, `.loops`, `.loop-in/out/half/double/exit`, `.jumps`, `.roll` | cues, loop activo | clic, mantener |
| Rejilla | `.gridpane`, `.grid-l`, `.grid-r`, `.grid-set` | beatgrid | ajuste fino |
| Efectos | `.fxpane` (módulo `fxpanel.js`) | tres ranuras, cantidad, P, destino | véase [02 · Decks](../02-decks-y-mezclador.md) |
| Stems | `.stems`, `.stems-bar`, `.stems-btns`, `.stems-off` | separación y volumen por voz/batería/bajo/resto | `stems:*` |
| Ondas del deck | `.overview`, `.deck-scroll` | análisis de la pista | clic = saltar |

Los paneles `[data-pane="loop|jump|fx|grid"]` alternan lo que se ve bajo el plato (`.pads`).

## Mezclador (`section.mixer`)

| Elemento | ID / clase | Estado | Eventos |
|---|---|---|---|
| Canal A / B | `.ch[data-deck]` | trim, EQ de 3 bandas, filtro, fader, VU | knobs ([renderer/knob.js](../../renderer/knob.js)) y `.vfader` |
| Maestro y cue | `.knob-slot[data-knob="master|cue"]`, `#vu-master` | volumen maestro, nivel de auriculares | arrastrar, rueda, doble clic = valor por defecto |
| Crossfader | `#xfader` | −1 … 1 | ← / → del teclado |

## Librería (`section.library`)

| Zona | IDs | Estado | Eventos |
|---|---|---|---|
| Fuentes | `.sources`, `#pl-sources`, `#pl-new`, `#pl-new-smart` | fuente elegida, listas locales | clic de fuente; crear lista |
| Búsqueda | `#search-form`, `#search`, `#search-scope` | alcance (YouTube Music / Mi equipo) y modo local | enviar |
| Filtros | `#lib-filters`, `#f-bpm-min`, `#f-bpm-max`, `#f-key`, `#f-compat`, `#f-clear`, `#btn-genres` | filtros activos | cambio de campo |
| Acciones de lista | `#btn-import-pl`, `#btn-automix-list`, `#btn-analyze-list`, `#btn-export`, `#btn-add-folder` | lista actual | clic |
| Barra de lista | `#pl-toolbar`, `#pl-name`, `#pl-rename`, `#pl-dup`, `#pl-del`, `#pl-order`, `#pl-dir`, `#pl-undo` | lista local abierta | renombrar, duplicar, ordenar |
| Selección | `#sel-bar`, `#sel-count`, `#sel-add`, `#sel-remove`, `#sel-queue`, `#sel-analyze`, `#sel-clear` | pistas marcadas | casillas, Mayús+clic |
| Lista inteligente | `#pl-smart`, `#ps-*` | reglas de BPM, tonalidad, géneros | cambio de regla |
| Pistas | `#tracks`, `#lib-empty` | resultados | doble clic = cargar; arrastrar a un deck |
| Cola de análisis | `#queue-view`, `#qv-*` | pistas pendientes y en curso | pausar, vaciar |

## Panel de AutoMix (`#am-view`)

Lo pinta `renderAutoMix` de [renderer/app.js](../../renderer/app.js) a partir de `AutoMix.snapshot()`; el estado en frase sale de la función pura `describe(snap)` de [renderer/automix-status.js](../../renderer/automix-status.js).

| Zona | IDs | Qué muestra |
|---|---|---|
| Ahora suena | `#amv-cur`, `#amv-cur-sub`, `#amv-status`, `#amv-bar`, `#amg-play` | pista actual, fase, cuenta atrás |
| Línea de tiempo | `#amtl`, `#amtl-cv`, `#amtl-info`, `#amtl-preview` | salida de A y entrada de B |
| Transición | `#amv-recipe`, `#amv-note`, `#amv-mix`, `#amv-toggle` | estilo, nota de efectos, «mezclar ahora» |
| Siguiente | `#amv-next`, `#amv-next-sub`, `#amv-entry*` | pista que sigue y su punto de entrada elegido |
| Sugerencias | `#amv-suggest` | pistas para añadir (YouTube Music + librería) |

## Vista inmersiva (`#immersive`)

`#imm-bg`, `#imm-viz` (anillos que laten, [renderer/viz.js](../../renderer/viz.js)), `#imm-cover`, `#imm-title`, `#imm-artist`, `#imm-bpm`, `#imm-key`, `#imm-origin`, `#imm-bar`, `#imm-fx`, `#imm-next`, `#imm-open`, `#imm-viz-toggle`.

## Diálogos

| Diálogo | ID | Contenido | Quién lo abre |
|---|---|---|---|
| Puntos de mezcla | `#mixedit` | onda, entrada y hasta 6 salidas, prueba de mezcla ([renderer/mixeditor.js](../../renderer/mixeditor.js)) | ⋯ del deck, cola de AutoMix |
| Ajustes | `#settings` | siete páginas (`data-pane`): general, audio, decks, efectos, librería, MIDI, herramientas; búsqueda `#set-search` | `#btn-settings` |
| Sesión | `#login` | iniciar sesión o importar de un navegador | `#btn-login` |
| Acerca de | `#about` | versión y enlace | `#btn-about` |
| Ayuda | `#help` | atajos por deck, mezcla y vistas | `#btn-help` |
| YouTube Music | `#ytm-float-A`, `#ytm-float-B` | la página de cada deck, para iniciar sesión o depurar | `.view-ytm` |

Aviso transitorio: `#toast`.
