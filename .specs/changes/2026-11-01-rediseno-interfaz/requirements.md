---
change: 2026-11-01-rediseno-interfaz
type: refactor
domains: [ui, video]
paths: [renderer/**, main/main.js, preload/**, docs/**, scripts/**]
commits: [6ad8024,c411b2d,ce27e0c,0f3c054,8dca06b,616e69c,a7b25e8,3302946,8300bcc,1aaf942]
status: approved
rev: 1
approved_rev: 1
approved_hash: b41c0c008740739b50f22bf278ee60e39229d9cb5497fe068ca98a7d83c0c1a0
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Requirements · 2026-11-01-rediseno-interfaz

## Contexto

La interfaz creció por capas y se nota: la barra superior mezcla acciones sin orden, la barra de AutoMix tiene unos 15 controles en una fila, los ajustes son un formulario largo, la librería reparte ocho pestañas en una fila, y hay dos botones de «video» (menú y miniaturas). La vista de miniaturas de video no sirve (dos miniaturas pequeñas no aportan nada) y el menú de video sigue mostrando en el deck vacío o local la página de YouTube Music con lo último que sonaba (NSYNC).

Referencia de lógica de uso: Mixxx (cabecera de deck con título, BPM, tonalidad y tiempos; ondas apiladas; mezclador central con EQ y VU por canal; librería con panel lateral de fuentes) y djay (consola de dos decks con mezclador al centro, ondas arriba, navegador abajo, controles agrupados por función y poco cromo). Se toma su organización, no su apariencia ni sus recursos gráficos.

Supuesto: «lógica REA» se interpreta como «lógica de uso real de software de DJ». Si se refería a otra cosa, se corrige en esta revisión.

## Requisitos

### REQ-1: Sin miniaturas de video
THE SYSTEM SHALL no ofrecer la vista de miniaturas de video (botón «Vista de video», tiles, tecla V, teclas [ y ]) ni video en el plato ni en AutoMix.
WHEN se actualice la app con ese ajuste guardado THE SYSTEM SHALL ignorarlo sin error.

### REQ-2: La ventana de video solo muestra lo que suena en cada deck
WHEN la ventana de video muestra un deck THE SYSTEM SHALL mostrar el video solo si ese deck tiene su propia pista cargada (video local guardado, o video del streaming de esa misma pista).
IF un deck está vacío, o su pista no tiene video, THEN THE SYSTEM SHALL mostrar en su lugar una pantalla negra con la portada o la leyenda «Sin video», nunca la página de YouTube Music.
THE SYSTEM SHALL conservar el menú «Video» (abrir/cerrar, pantalla, completa, A | B | Auto) con la misma función.

### REQ-3: Sistema visual único
THE SYSTEM SHALL definir en `styles.css` una escala única de espaciado, tipografía, radios y elevaciones, y variantes únicas de botón (primario, normal, fantasma, icono), selector segmentado, interruptor y deslizador, y usarlas en todas las pantallas (barra, decks, mezclador, librería, AutoMix, ajustes, diálogos).
THE SYSTEM SHALL mantener el color del deck A (cian) y del deck B (rosa) como único código de identidad por deck en ondas, cabeceras, mezclador, cola y diálogos.

### REQ-4: Estructura al estilo de un software de DJ
THE SYSTEM SHALL organizar la ventana en cuatro zonas fijas: barra superior, ondas, consola (deck A · mezclador · deck B) y librería.
THE SYSTEM SHALL agrupar la barra superior en tres grupos: identidad y sesión; herramientas de la mezcla (AutoMix, Sampler, grabar); sistema (MIDI, video, ayuda, ajustes).
WHILE una pista está cargada THE SYSTEM SHALL mostrar en la cabecera de su deck portada, título, artista, BPM, tonalidad, tiempo transcurrido y restante y fuente, con una sola jerarquía tipográfica en ambos decks.
THE SYSTEM SHALL conservar el mezclador central con EQ, filtro, ganancia, cue y VU por canal, volumen maestro y crossfader.

### REQ-5: Librería con panel de fuentes
THE SYSTEM SHALL mostrar un panel lateral de fuentes (Buscar, Me gusta, Playlists, Importadas, Local, Analizados, Historial, AutoMix) en lugar de la fila de pestañas, con el campo de búsqueda y las acciones de la fuente seleccionada en una barra de herramientas encima de la tabla.
WHILE el ancho de la ventana es menor que 1100 px THE SYSTEM SHALL colapsar el panel a solo iconos.

### REQ-6: AutoMix ordenado por función
THE SYSTEM SHALL presentar AutoMix en grupos con título: Reproducción (iniciar, mezclar ahora), Transición (estilo, duración, tempo y fase, puntos óptimos), Cola (orden automático, reorganizar, deshacer, vaciar, rellenar con radio, popularidad) y Fuente (analizar y usar archivo, seguir con la radio).
THE SYSTEM SHALL mantener todas las funciones y atajos actuales de AutoMix.

### REQ-7: Ajustes por secciones
THE SYSTEM SHALL mostrar Ajustes con navegación lateral por secciones (Herramientas, Librería y música local, Audio, Decks y diseño, MIDI, Cuenta) y mostrar una sección a la vez.
THE SYSTEM SHALL conservar todos los ajustes actuales con los mismos nombres y efectos.

### REQ-8: Accesibilidad y estados
THE SYSTEM SHALL permitir operar toda la interfaz con teclado, con foco visible, contraste mínimo 4.5:1 en texto y objetivos de clic de al menos 28 px en la consola.
WHEN no hay pistas, sesión o resultados THE SYSTEM SHALL mostrar un estado vacío con la acción siguiente.
WHERE el sistema pide movimiento reducido THE SYSTEM SHALL desactivar animaciones no esenciales.

### REQ-9: Sin regresiones
THE SYSTEM SHALL mantener los tres perfiles de diseño (compacto, normal, amplio) y que las pruebas existentes de decks, AutoMix, puntos de mezcla, audio local y marca sigan pasando, actualizadas a la nueva estructura.
THE SYSTEM SHALL actualizar la documentación y regenerar las capturas.

## Fuera de alcance

- Cambiar el motor de audio, el análisis, yt-dlp o la forma de reproducir YouTube Music.
- Temas claros o personalizables por el usuario.
- Copiar recursos gráficos, nombres o iconografía de Mixxx o djay.
