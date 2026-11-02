---
domain: ui
paths: [renderer/styles.css, renderer/app.js, renderer/index.html, main/settings.js, docs/**, scripts/test-layouts.js]
last_change: 2026-11-01-vistas-y-ajustes
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
