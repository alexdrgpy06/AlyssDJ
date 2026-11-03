---
change: 2026-11-03-interfaz-ordenada
type: refactor
domains: [ui]
paths: [renderer/index.html, renderer/styles.css, renderer/app.js, renderer/deck.js, renderer/automix.js, renderer/views.js, renderer/layout.js, scripts/test-*.js, docs/**]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 94cca885b310ae5d5ac2c70d970defdb4dfe1b27f66a72fcbbd85399eea769a7
approved_by: Alejandro Ramirez
approved_at: 2026-11-03
---
# Requirements · 2026-11-03-interfaz-ordenada

## Contexto

Alejandro ve **controles redundantes y desorganizados**. Inventario actual (de `renderer/index.html`):

- **AutoMix** está en tres sitios con los mismos controles: el botón de la barra superior (`#btn-automix`), la vista inmersiva (`imm-*`: iniciar, mezclar ahora, estilo, duración, saltar, cola) y la fuente «AutoMix» de la librería (`amv-*`: lo mismo más cola y ajustes).
- La barra superior mezcla sesión de YouTube Music, estado de herramientas, selector de 4 vistas, interruptor de ondas, AutoMix, Sampler, REC, MIDI, Ayuda y Ajustes, sin jerarquía clara.
- Cada deck tiene: STREAM/ARCHIVO, Analizar, Puntos, YTM, SYNC, CUE, 4 hot cues, 4 bancos (LOOP, JUMP/ROLL, FX, GRID) y ahora una tira de STEMS: demasiados botones con la misma importancia.
- Los ajustes y las acciones se reparten entre la barra, los decks, la librería y Ajustes sin criterio.

Objetivo: una interfaz coherente por tareas (tocar, mezclar, buscar, automatizar), sin duplicados, tomando como referencia el orden de Mixxx y djay (solo a nivel de interfaz pública).

## Requisitos

### REQ-1: Un solo lugar para cada acción
THE SYSTEM SHALL ofrecer cada acción de AutoMix (iniciar/detener, mezclar ahora, estilo, duración, saltar, cola) en un único panel de AutoMix, y las demás vistas SHALL limitarse a mostrar su estado y abrir ese panel.

### REQ-2: Barra superior jerarquizada
THE SYSTEM SHALL organizar la barra superior en tres zonas con una función clara cada una: vistas (izquierda), herramientas de mezcla — AutoMix, Sampler, REC — (centro) y sistema — sesión, MIDI, ayuda, ajustes — (derecha), mostrando la sesión y el estado de herramientas solo cuando requieren atención.

### REQ-3: Deck por prioridad
THE SYSTEM SHALL mostrar en cada deck, siempre visibles, solo el transporte (CUE, play, SYNC), el pitch, los hot cues y los stems; WHEN el usuario abre un banco (loop, jump/roll, FX, grid) o la información avanzada de la pista (fuente, Analizar, Puntos, YTM) THE SYSTEM SHALL mostrarlos en un panel plegable y recordar si estaba abierto.

### REQ-4: Sin controles que no aplican
WHILE un control no se puede usar (por ejemplo YTM sin pista de stream, Analizar en pista ya analizada, SYNC sin BPM) THE SYSTEM SHALL ocultarlo o atenuarlo con el motivo en su ayuda, en vez de dejarlo igual que los activos.

### REQ-5: Nombres y agrupación consistentes
THE SYSTEM SHALL usar el mismo nombre, icono y color para la misma acción en toda la app, y agrupar los ajustes de Ajustes por tarea (Audio, Librería, AutoMix, Stems, Entrada/MIDI, Aspecto, Sistema) con la búsqueda actual.

### REQ-6: Atajos y ayuda alineados
THE SYSTEM SHALL mantener los atajos de teclado existentes y reflejar en la ayuda («?») exactamente los controles que existen tras el reordenamiento.

### REQ-7: Accesible y responsivo
THE SYSTEM SHALL conservar el uso por teclado, las etiquetas accesibles y las vistas actuales a 1280×720 y a pantalla completa, sin controles cortados ni desplazamiento horizontal.

### REQ-8: Documentación y capturas al día
THE SYSTEM SHALL regenerar las capturas y actualizar `docs/` con la nueva disposición.

## Fuera de alcance

- Cambiar la paleta de colores o la tipografía (tokens visuales de la constitución).
- Nuevas funciones: este cambio solo reordena, une y oculta.
