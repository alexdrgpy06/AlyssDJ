---
change: 2026-11-01-vistas-y-ajustes
type: feature
domains: [ui]
paths: [renderer/views.js, renderer/app.js, renderer/index.html, renderer/styles.css, main/settings.js, scripts/**, docs/**, README.md, .github/**]
status: approved
rev: 2
approved_rev: 2
approved_hash: 859f21035f4cff3291f7e66614481d456879252068257aef60979c8d4d934ef4
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Requirements · 2026-11-01-vistas-y-ajustes

## Contexto

Pedido de Alejandro tras la v0.6.0: poder **achicar o agrandar las vistas arrastrando** (como el divisor de ondas de Mixxx o los paneles de djay) y **mejorar todo Ajustes**. Hoy las alturas de ondas, decks y librería son fijas por vista, y Ajustes tiene seis paneles planos, sin búsqueda, con opciones mezcladas (p. ej. «Ondas grandes» y «Diseño» en «Decks y diseño») y sin los ajustes de AutoMix ni de efectos, que viven en sus propios paneles. Este cambio es solo de interfaz y ajustes; los efectos, filtros y el AutoMix con efectos van en cambios aparte (`fx-cadena`, `automix-fx-cues`).

## Requisitos

### REQ-1: Divisores arrastrables
THE SYSTEM SHALL mostrar un divisor arrastrable entre las ondas y los decks, y otro entre los decks y la librería, en las vistas Mezcla y Librería (la vista Ondas ya ocupa toda la ventana). WHERE las ondas están en el deck THE SYSTEM SHALL mostrar solo el divisor de la librería.
WHEN el usuario arrastra un divisor THE SYSTEM SHALL cambiar el tamaño de las zonas contiguas en vivo, con un mínimo y un máximo por zona, sin que la ventana haga scroll.
WHEN el usuario hace doble clic en un divisor THE SYSTEM SHALL restaurar el tamaño por defecto de esa vista.
WHERE el divisor tiene el foco THE SYSTEM SHALL permitir moverlo con las flechas (paso de 8 px, 32 px con Mayús) y exponerlo como `role="separator"` con `aria-valuenow`.

### REQ-2: Tamaños recordados por vista
THE SYSTEM SHALL guardar el tamaño de cada divisor por vista y restaurarlo al volver a esa vista y al reabrir la app.
IF el tamaño guardado no cabe en la ventana actual THEN THE SYSTEM SHALL ajustarlo a los límites de la zona sin perder el valor guardado.
WHEN el usuario elige «Restablecer vistas» en Ajustes THE SYSTEM SHALL borrar todos los tamaños guardados.

### REQ-3: Ajustes por secciones, con búsqueda
THE SYSTEM SHALL organizar Ajustes en secciones por tema: General (diseño, ondas, vistas, actualizaciones), Audio, Decks, Librería y música, MIDI y Herramientas y cuenta; cada opción vive en una sola sección. Las opciones de AutoMix y de efectos se quedan donde se usan y no se duplican aquí.
THE SYSTEM SHALL ofrecer un campo de búsqueda que filtre las opciones por su etiqueta y su ayuda, y que lleve a la sección que las contiene.
WHEN la búsqueda no encuentra nada THE SYSTEM SHALL mostrar un mensaje «Sin resultados» con la opción de limpiar el campo.
WHEN Ajustes se abre THE SYSTEM SHALL mostrar la última sección usada en esa sesión, o General la primera vez.

### REQ-4: Ajustes que se aplican al cambiar
WHEN el usuario cambia una opción THE SYSTEM SHALL aplicarla y guardarla al instante, sin botón «Guardar», y mostrar una confirmación discreta.
IF guardar una opción falla THEN THE SYSTEM SHALL revertir el control a su valor anterior y explicar el motivo junto al control.
WHEN el usuario elige «Restablecer sección» THE SYSTEM SHALL devolver a sus valores por defecto solo las opciones de esa sección, previa confirmación.

### REQ-5: Compatibilidad
THE SYSTEM SHALL conservar los ajustes y las vistas guardados por versiones anteriores.
THE SYSTEM SHALL mantener la navegación por teclado de Ajustes (flechas entre secciones, Esc para cerrar) y el contraste de los controles nuevos.
WHEN la ventana mide 1366×768 THE SYSTEM SHALL mostrar los divisores sin desbordar ni solapar controles.

### REQ-6: Verificación y documentación
THE SYSTEM SHALL cubrir con pruebas automáticas el estado de los divisores (límites, restablecer, guardado), la búsqueda y los guardados de Ajustes, y la apertura en una sección.
THE SYSTEM SHALL actualizar la documentación y las capturas de las vistas y de Ajustes.

## Fuera de alcance

- Nuevos efectos, filtros, cadena de efectos o XY pad, y su sección de Ajustes (cambio `fx-cadena`).
- Efectos o cues automáticos en AutoMix (cambio `automix-fx-cues`).
- Vídeo o visualizador en la vista AutoMix (se decide aparte).
- Separación de pistas por IA (stems).
- Divisores que reordenen o muevan los decks de sitio.
