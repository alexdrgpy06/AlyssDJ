---
change: 2026-11-03-interfaz-ordenada
status: approved
rev: 1
approved_rev: 1
approved_hash: 952820265dd9bb683035fc6b1bd2c3da87a78a244c7698866b38ddda2babe920
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Design · 2026-11-03-interfaz-ordenada

## Enfoque

Es un reordenamiento: no se añade ninguna función ni se cambian los tokens. Se hace en cuatro frentes, de menor a mayor riesgo.

### 1. AutoMix: un solo panel de control (REQ-1)
Hoy los mismos controles existen en la vista inmersiva (`imm-*`, `app.js:422–492`), en la fuente AutoMix de la librería (`amv-*`) y en un botón de la barra (`#btn-automix`).
- **Panel de AutoMix = la fuente AutoMix de la librería** (ya contiene todo: reproducción, transición, cola, fuente). Es el único sitio con botones de acción.
- **Vista Automix (inmersiva)** pasa a ser de solo lectura: portada, SUENA / SIGUE, estado, barra y visual. Conserva un único botón «Abrir panel de AutoMix» (lleva a la fuente AutoMix) y los atajos (`A`, Mayús + →) siguen funcionando. Se eliminan de ella iniciar, mezclar ahora, estilo, duración, saltar y cola.
- **Botón de la barra** `#btn-automix`: indicador de estado (punto verde si está activo, texto «AutoMix» / «AutoMix · mezclando 0:12») que abre el panel; ya no inicia ni detiene.
- Decisión: se prefiere el panel de la librería y no la vista inmersiva como panel único porque ya tiene cola, ajustes y búsqueda; la contrapartida es que arrancar AutoMix desde la vista inmersiva requiere un clic más (o el atajo `A`). Si Alejandro prefiere lo contrario, se invierte sin cambiar el resto.

### 2. Barra superior en tres zonas (REQ-2)
`header.topbar` se reordena sin añadir elementos:
- **Izquierda — vistas**: logotipo, selector de las 4 vistas, interruptor de ondas.
- **Centro — herramientas de mezcla**: AutoMix (estado), Sampler, REC.
- **Derecha — sistema**: pastilla de sesión, MIDI, Ayuda, Ajustes.
- La pastilla de sesión de YouTube Music y `#tools-status` solo ocupan sitio cuando hay algo que hacer (sin sesión, herramientas ausentes o error); con sesión iniciada y herramientas listas se reducen a un punto de estado con su ayuda.

### 3. Deck por prioridad (REQ-3, REQ-4)
Siempre visible: transporte (CUE, play, SYNC), plato, pitch, 4 hot cues y tira de stems.
- **Menú «⋯» en la cabecera del deck** (popover accesible, `aria-haspopup="menu"`) con: fuente STREAM/ARCHIVO, Analizar, Puntos y YTM. Cada entrada se muestra solo si aplica (REQ-4): STREAM/ARCHIVO si hay versión local y de stream; Analizar si no está analizada; YTM si hay pista de stream; Puntos si hay análisis.
- **Bancos plegables**: las pestañas LOOP · JUMP/ROLL · FX · GRID quedan como una fila fina; ninguna abierta por defecto salvo la última usada (se recuerda por deck en `localStorage` `alyssdj.deck.bank.<A|B>`); pulsar la pestaña abierta la cierra. Con el banco cerrado el deck gana altura en vista Librería.
- Los controles sin efecto (SYNC sin BPM, KEY/QUANT sin pista) se atenúan y su ayuda dice por qué.

### 4. Ajustes por tarea y consistencia (REQ-5, REQ-6)
Las secciones actuales (General, Herramientas y cuenta, Efectos y filtros, Librería y música local, Salida de audio, Decks, MIDI) pasan a: **Audio** (salida, decks), **Librería** (carpetas, guardado), **AutoMix** (estilo, salida, efectos, popularidad, fuente), **Stems**, **Entrada y MIDI**, **Aspecto** (vistas, ondas, visual), **Sistema** (herramientas, cuenta, actualizaciones). La búsqueda de Ajustes se mantiene. Un solo nombre por acción: «Mezclar ahora», «Siguiente» (no «Saltar»), «Analizar», «Puntos de mezcla», «Ondas». Un inventario `docs/inventario-controles.md` lista cada control con su nombre, icono y dónde vive; la ayuda («?») se genera/actualiza a partir de él en la misma tarea.

## Contratos

- IDs: se retiran `imm-toggle`, `imm-mix`, `imm-style`, `imm-len`, `imm-skip`, `imm-queue`; se añade `imm-open` («Abrir panel de AutoMix») y `deck-more` (menú «⋯») por deck. `amv-*` no cambia.
- `AutoMix` (clase) no cambia su API; `app.js` deja de enlazar los `imm-*` retirados.
- `localStorage`: `alyssdj.deck.bank.A|B` ∈ `loop|jump|fx|grid|""`.
- Pruebas que referencian IDs retirados (`test-sinvideo.js immersive`, `test-automix-view.js`, `test-vistas.js`) se actualizan en la tarea que los retira.

## Visual Spec

Lectura: consola de DJ para una persona que mezcla en directo, modo Operate, densidad alta.
- Superficies, color, tipografía y movimiento: los de la constitución y `styles.css` (sin cambios); acento neutro blanco azulado para selección fuera de un deck.
- Barra: altura 44 px, tres grupos separados por `.tb-sep`; objetivos ≥ 32 px; el centro no se parte en dos líneas a 1280 px.
- Deck: cabecera con título, artista, BPM/tonalidad y «⋯» (28×28); banco como `seg` de 28 px; cerrado, sin panel.
- Menú «⋯»: ancho 220 px, elementos de 32 px, foco visible, `Esc` cierra y devuelve el foco.
- Estados: sin pista (deck con «Arrastra o carga una pista», menú vacío oculto) · cargando · cargada · error (causa exacta en la cabecera).
- Teclado: `Tab` recorre barra → deck A → mezclador → deck B → librería; las pestañas de banco con flechas; atajos actuales intactos.
- Responsive: ≥ 1280×720 sin desplazamiento horizontal; por debajo de 1100 px el selector de vistas muestra solo iconos.
- Referencias: orden de zonas de djay y de Mixxx (solo disposición pública), sin copiar recursos.

## Amendments

### A1 · 2026-11-03
El diseño menciona la tecla `A` como atajo de AutoMix, pero `A` es el nudge − del deck A y no existe atajo de inicio/parada. Los atajos de AutoMix que se conservan son solo `Mayús + →` (mezclar ahora). Afecta a REQ-1 (sin cambio de comportamiento).

### A2 · 2026-11-03
Los ajustes ya estaban agrupados por tema en siete paneles con búsqueda; las secciones AutoMix y Stems del diseño no existen todavía en Ajustes (AutoMix vive en su panel y los stems llegan con `stems-gpu-automaticos`). En vez de mover opciones entre paneles (riesgo para `settings.js` y las pruebas por `name=`), se mantienen los ids de panel y se renombran por tarea: Aspecto y vistas, Audio, Decks, Efectos y filtros, Librería, Entrada y MIDI, Sistema; «Actualizaciones» pasa de General a Sistema. Afecta a REQ-5.

## Domain deltas
### ui
#### ADDED spec: Barra superior en tres zonas
THE SYSTEM SHALL organizar la barra superior en vistas (izquierda), herramientas de mezcla (centro) y sistema (derecha), y WHEN la sesión de YouTube Music está iniciada y las herramientas están completas THE SYSTEM SHALL reducir la sesión a un punto de estado y ocultar el aviso de herramientas.
#### ADDED spec: Menú del deck
THE SYSTEM SHALL ofrecer en cada deck con pista un menú «⋯» con la fuente, Analizar, Puntos de mezcla y YouTube Music, mostrando solo lo que aplica a la pista cargada, cerrándose con Esc o clic fuera.
#### ADDED spec: Bancos plegables
THE SYSTEM SHALL permitir abrir y cerrar cada banco de pads del deck (LOOP, JUMP/ROLL, FX, GRID) y recordar el banco abierto por deck.
#### ADDED spec: Ajustes por tarea
THE SYSTEM SHALL agrupar los ajustes en Aspecto y vistas, Audio, Decks, Efectos y filtros, Librería, Entrada y MIDI y Sistema, con la búsqueda de ajustes.
#### ADDED design: Inventario de controles
`docs/inventario-controles.md` lista cada control, su lugar y los retirados; `scripts/test-orden.js` (modos automix, topbar, deck, banks, layout, docs) y `scripts/orden-selftest.js` lo comprueban a 1280×720.
### automix
#### ADDED spec: Un solo panel de control
THE SYSTEM SHALL ofrecer los controles de AutoMix (iniciar o detener, mezclar ahora, estilo, duración, siguiente, cola) únicamente en el panel de la fuente AutoMix; la vista Automix SHALL mostrar solo el estado y un botón para abrir ese panel, y el botón de la barra SHALL mostrar el estado (activo o mezclando).
