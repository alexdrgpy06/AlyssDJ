---
domain: ui
paths: [renderer/styles.css, renderer/app.js, renderer/index.html, main/settings.js, docs/**, scripts/test-layouts.js]
last_change: 2026-11-04-automix-simple-y-continuo
---
# ui · spec

## perfiles por tamaño de pantalla

WHEN cambia el tamaño de la ventana THE SYSTEM SHALL elegir el perfil compacto, normal o amplio según su tamaño, salvo que el usuario fije uno en Ajustes.

## Estructura en cuatro zonas

THE SYSTEM SHALL organizar la ventana en barra superior, ondas, consola (deck A, mezclador, deck B) y librería, con la barra agrupada en identidad y sesión, herramientas de la mezcla y sistema, y la misma cabecera de deck (portada, título, artista, BPM, tonalidad, tiempos, fuente) en ambos decks.

## Sistema visual único

THE SYSTEM SHALL usar una escala única de espaciado, tipografía, radios y elevaciones, y componentes únicos (botón, segmentado, interruptor, deslizador, estado vacío, diálogo); el cian y el rosa identifican solo a los decks A y B.

## Librería con panel de fuentes

THE SYSTEM SHALL mostrar las fuentes (Buscar, Me gusta, Playlists, Importadas, Local, Analizados, Historial, AutoMix) en un panel lateral, que bajo 1100 px de ancho se reduce a iconos, con la búsqueda y las acciones de la fuente en una barra de herramientas y un estado vacío con la siguiente acción.

## AutoMix por grupos

THE SYSTEM SHALL presentar los controles de AutoMix en los grupos Reproducción, Transición, Cola y Fuente, sin quitar funciones ni atajos.

## Ajustes por secciones

THE SYSTEM SHALL mostrar Ajustes con navegación lateral por secciones (Herramientas, Librería y música, Audio, Decks y diseño, MIDI, Cuenta), una a la vez y operable con flechas, conservando todos los campos.

## Accesibilidad y estados

THE SYSTEM SHALL mantener contraste mínimo 4.5:1 en texto, objetivos de clic de al menos 28 px en la consola y 32 px en la barra, foco visible y movimiento reducido cuando el sistema lo pide.

## Vistas de trabajo

THE SYSTEM SHALL ofrecer las vistas Mezcla, Librería, Automix y Ondas (Alt+1…4), la opción de ondas arriba o en el deck, recordarlas entre sesiones y, al abrir la fuente AutoMix de la librería, pasar a Librería y volver a la vista anterior al salir si el usuario no eligió otra.

## Controles de salida, saltar y barajar

THE SYSTEM SHALL mostrar el selector «Salir» en el grupo Transición, los botones «Barajar» y «Saltar siguiente» en el grupo Cola y «Saltar siguiente» en la vista Automix.

## Divisores de vistas

THE SYSTEM SHALL mostrar en Mezcla y Librería un divisor bajo las ondas y otro sobre la librería, arrastrables, con doble clic para restablecer y flechas (8 px; Mayús 32 px); el divisor de ondas fija su altura y el de librería la suya (manda el último movido, la zona contraria absorbe el resto), con mínimos de 90 px (ondas) y 150 px (librería) y sin desbordar la ventana; cada vista guarda su tamaño en `alyssdj.splits` y se recorta a la ventana sin perder el valor guardado.

## Ajustes por secciones con búsqueda

THE SYSTEM SHALL organizar Ajustes en General, Audio, Decks, Librería y música, MIDI y Herramientas y cuenta; ofrecer un buscador (/ o Ctrl+F; Esc limpia) que filtra por etiqueta y ayuda sin tildes ni mayúsculas y muestra «Sin resultados»; recordar la última sección durante la sesión.

## Guardado al cambiar y restablecer

WHEN el usuario cambia una opción THE SYSTEM SHALL guardarla al instante y mostrar «Guardado»; IF falla THEN restaura el control y explica el motivo; «Restablecer sección» (con confirmación) y «Restablecer vistas» devuelven sus valores por defecto.

## Panel FX, XY pad y RES

THE SYSTEM SHALL mostrar en el banco FX de cada deck tres ranuras (interruptor y nombre), tipo, cantidad y P de la ranura elegida y un pad XY (X cantidad, Y P; flechas ±0,02/±0,1; doble clic al centro) que enciende la ranura mientras se mantiene (ajuste `fxHold`); un knob RES junto a FILTER; todos los bancos miden lo mismo para que el deck no salte.

## Persistencia, MIDI y Ajustes de efectos

THE SYSTEM SHALL recordar la cadena de cada deck en `alyssdj.fx.<deck>` (ajuste `fxRemember`), conservarla al cargar pistas, registrar para MIDI learn `fx<n>On/Wet/P` y `res` (y mantener `fxOn`, `fxWet`, `fx.<tipo>` en la ranura 1) y ofrecer la sección «Efectos y filtros» con `fxHold`, `fxRemember` y `filterRes`.

## Selector Efectos y estado

THE SYSTEM SHALL mostrar el selector «Efectos» en el grupo Transición, el nivel en el estado de la transición, la nota «Efecto: …» y una etiqueta en la vista Automix mientras hay un movimiento.

## Visual de la vista Automix

THE SYSTEM SHALL dibujar en un lienzo detrás de la portada anillos que se expanden una vez por beat (con más fuerza en el primer tiempo del compás de 4), con el color del deck (A cian, B rosa), intensidad según el nivel de audio y la ganancia del canal, los dos decks a la vez en las transiciones, un anillo que respira sin BPM y anillos quietos y tenues en pausa; la portada escala hasta +1,5 % con el beat.

## Control, movimiento reducido y rendimiento

THE SYSTEM SHALL ofrecer el botón «Visual» (activado por defecto, recordado en `AutoMix.cfg.visual`), mostrar el visual estático con `prefers-reduced-motion`, dibujar a ≤ 30 fps solo con la vista Automix, la ventana y el visual activos, y no cambiar el audio.

## Editor y chips de género

THE SYSTEM SHALL ofrecer un editor de géneros por pista y mostrar los géneros como chips en la cola de AutoMix.

## Plato sujeto

WHILE un plato está sujeto THE SYSTEM SHALL marcarlo con la clase `held` y AutoMix SHALL no iniciar transiciones.

## Barra de progreso en la fila

WHILE una pista se preescucha THE SYSTEM SHALL mostrar su avance en una barra bajo el título que permite saltar con un clic.

## Tira STEMS en el deck

THE SYSTEM SHALL mostrar en cada deck una tira con Separar / progreso con tiempo restante y cancelar / Activar stems / cuatro botones (clic silencia, Mayús o Ctrl + clic aísla) y Completa, con `aria-pressed` y etiquetas que no dependen solo del color.

## Barra superior en tres zonas

THE SYSTEM SHALL organizar la barra superior en vistas (izquierda), herramientas de mezcla (centro) y sistema (derecha), y WHEN la sesión de YouTube Music está iniciada y las herramientas están completas THE SYSTEM SHALL reducir la sesión a un punto de estado y ocultar el aviso de herramientas.

## Menú del deck

THE SYSTEM SHALL ofrecer en cada deck con pista un menú «⋯» con la fuente, Analizar, Puntos de mezcla y YouTube Music, mostrando solo lo que aplica a la pista cargada, cerrándose con Esc o clic fuera.

## Bancos plegables

THE SYSTEM SHALL permitir abrir y cerrar cada banco de pads del deck (LOOP, JUMP/ROLL, FX, GRID) y recordar el banco abierto por deck.

## Ajustes por tarea

THE SYSTEM SHALL agrupar los ajustes en Aspecto y vistas, Audio, Decks, Efectos y filtros, Librería, Entrada y MIDI y Sistema, con la búsqueda de ajustes.

## Ámbito y filtros del buscador

THE SYSTEM SHALL ofrecer en el buscador el ámbito Todo, Mi equipo o YouTube Music (recordado entre sesiones) y, en la librería, filtros de BPM, tonalidad y compatibles con un botón para limpiarlos.

## AutoMix con la música del equipo

WHILE el modo local está activo o el ámbito es «Mi equipo» THE SYSTEM SHALL armar la cola de AutoMix con las pistas analizadas del equipo más compatibles (`local.similar`) sin consultar la radio de YouTube Music; IF no hay candidatas THEN THE SYSTEM SHALL avisar «Analiza más música de tu equipo para sugerir pistas».

## Mis listas y selección múltiple

THE SYSTEM SHALL mostrar «Mis listas» en las fuentes (nombre editable en línea, soltar pistas encima), un botón «＋» y un menú «Añadir a playlist» en cada fila, selección con clic, Ctrl/Cmd, Mayús y Ctrl+A, y una barra con añadir, quitar, cola de AutoMix y analizar cuando hay dos o más pistas seleccionadas.

## Entrada visible y editable en SIGUE

THE SYSTEM SHALL mostrar en la tarjeta «SIGUE» la entrada (tiempo y compás), el motivo en una frase y una tira con la energía por frase con una línea en el punto elegido; WHEN el usuario arrastra la línea o usa ← → THE SYSTEM SHALL guardarla en el compás más cercano como punto de entrada editado de esa pista, y «Auto» SHALL quitar solo esa entrada conservando las salidas.

## Línea de tiempo de la mezcla

THE SYSTEM SHALL dibujar la próxima transición con la energía de la pista que sale y de la que entra, el solape, los gestos de la receta y la posición actual; WHEN el usuario arrastra la salida, la entrada o el final del solape (o usa ← → y Mayús + ← →) THE SYSTEM SHALL guardar el punto en el compás más cercano o la duración y mostrar al instante el efecto; WHERE las dos pistas son archivos locales THE SYSTEM SHALL permitir escucharla por los auriculares.

## Presets, orden, ruta e Instant FX

THE SYSTEM SHALL permitir, desde el botón ⋯ del panel FX, elegir la división de beat, la ruta (este deck o ambos decks), mover la ranura antes o después y aplicar, guardar y borrar presets (siete de fábrica y hasta 40 propios); WHEN el usuario mantiene E, R, T, U, I u O THE SYSTEM SHALL aplicar la ranura 1–3 del deck A o B con una rampa de entrada de 30 ms y quitarla con otra de 60 ms al soltar, sin tocar una ranura que ya estaba encendida ni actuar al escribir en un campo de texto.

## Mapa de arquitectura mantenido por pruebas

THE SYSTEM SHALL mantener en docs/arquitectura un registro por módulo (modulos.json) y documentos generados, y fallar la integración continua si un módulo, canal IPC o cita de archivo diverge del código, y si una de las seis capturas de referencia cambia más del 0,5 % de sus píxeles.

## Controles de AutoMix completos y sin recortes

WHILE la ventana mide 1280×720 THE SYSTEM SHALL mostrar la barra de reproducción de AutoMix (iniciar o detener, mezclar ahora, siguiente y radio) fija arriba del panel y también en la vista Automix, la cola y el buscador a la vista, los ajustes de transición, cola y fuente plegados, los botones con borde y los segmentos de estilo sin recortar, y la barra superior sin textos partidos.

## Descargar la pista de un deck

WHEN el usuario pulsa «Descargar pista» (botón, atajo o MIDI) THE SYSTEM SHALL dejar el deck como recién abierto; IF está al aire THEN avisa y exige una segunda pulsación en 3 s; IF AutoMix la usa THEN no la descarga.

## Cargar pista y rótulos coherentes

WHILE un deck está vacío THE SYSTEM SHALL ofrecer «Cargar pista» con la ayuda «o arrastra una pista de la librería», y el botón de AutoMix dirá «Iniciar AutoMix» con una pista cargada o «Elegir radio…» (abre el menú Radio) sin ninguna, con el motivo de un botón deshabilitado en una línea de la barra.

## Panel de AutoMix simple

WHILE se ven los ajustes de AutoMix THE SYSTEM SHALL mostrar solo perfil (Suave, Club, Radio), duración y efectos, y dejar estilo, tempo, salida, cola, fuente y radio continua en un bloque plegado «Avanzado».
