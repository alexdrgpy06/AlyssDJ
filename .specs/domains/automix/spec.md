---
domain: automix
paths: [renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, renderer/deck.js, main/analyzer.js, docs/**]
last_change: 2026-10-30-automix-puntos-de-mezcla
---
# automix · spec

## Vista de AutoMix con cola editable

WHEN el usuario abre AutoMix THE SYSTEM SHALL mostrar la pista que suena, la siguiente, la cola con el estado de cada pista y los controles, y permitir reordenar, quitar, añadir, fijar a continuación y mezclar ahora (Mayús + →) sin interrumpir la mezcla.
WHEN una pista de YouTube entra en la cola THE SYSTEM SHALL descargarla sin sesión, analizarla y guardarla con antelación y cargarla en modo LOCAL, esperando hasta 20 s y saltando a otra lista si no está a tiempo.

## Mezclar en puntos óptimos con el BPM siempre en cuenta

WHEN AutoMix prepara una transición THE SYSTEM SHALL salir de la pista que suena en su mejor punto (alineado a una frase, no necesariamente el final), entrar en el punto de entrada de la siguiente y durar compases enteros acotados al tramo disponible.
WHILE decide la siguiente pista THE SYSTEM SHALL puntuar las listas por BPM, tonalidad y energía y poner primero la mejor, respetando el orden que el usuario fijó a mano.
IF el salto de BPM supera el 8 % THEN THE SYSTEM SHALL preferir otra candidata y, si no la hay, mezclar largo con filtro sin forzar el tempo y avisar.
WHEN se iguala el tempo THE SYSTEM SHALL limitar el ajuste a ±8 % y devolver el tempo natural gradualmente.
