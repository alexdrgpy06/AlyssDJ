---
domain: automix
paths: [renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, renderer/deck.js, main/analyzer.js, docs/**]
last_change: 2026-11-02-automix-transicion-suave
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

## decks compactos con AutoMix

WHILE AutoMix está activo o su vista abierta THE SYSTEM SHALL mostrar los decks y el mezclador compactos y dar a la vista de AutoMix al menos el 40% de la altura de la ventana.

## cola analizada y ordenada como cadena

WHEN se añade una pista a la cola de AutoMix THE SYSTEM SHALL analizarla sin esperar su turno, de a 2 como máximo, y ordenar las pistas analizadas como una cadena de coste mínimo (BPM gradual, tonalidad, energía) respetando lo fijado a mano y la pista ya precargada.

## puntos de mezcla editables

WHEN el usuario edita la entrada o las salidas (hasta 6) de una pista THE SYSTEM SHALL guardarlas aparte y hacer que AutoMix use solo las editadas, en su orden de preferencia, también tras reanalizar.

## Mezclar ahora busca lo más cercano

WHEN el usuario pulsa «Mezclar ahora» THE SYSTEM SHALL elegir como salida el punto más cercano por delante (punto de la pista, editado o límite de frase de 8 beats, a lo sumo 12 s), entrar en la siguiente por su punto de entrada con el tempo igualado, durar compases enteros y poder cancelarse con otra pulsación.

## buscar y agregar desde AutoMix con popularidad

WHEN el usuario busca y agrega desde la vista de AutoMix THE SYSTEM SHALL colocar la pista en el hueco de menor coste de la cadena (o analizarla y moverla al llegar su análisis) y sugerir qué sigue según BPM, tonalidad, energía, estilo y popularidad, sin anteponer nunca una popular que no encaje.

## Vista de video sin decks grandes

WHEN el usuario activa «Vista de video» en la pestaña AutoMix THE SYSTEM SHALL ocultar los decks y el mezclador, mostrar una miniatura por deck con título, tiempo restante y progreso, y resaltar el deck al aire; al desactivarla o salir de la pestaña SHALL restaurar la consola sin perder el estado de los decks.

## Modo de salida

THE SYSTEM SHALL ofrecer el selector «Salir» con los modos Mejor punto (por defecto), Outro y intro, Inicio del outro y Final de la pista; los puntos de salida editados mandan en cualquier modo; sin outro marcado sale como en Final de la pista y lo avisa; el ajuste heredado «puntos óptimos» se traduce (activado → Mejor punto, apagado → Final de la pista).

## Duración adaptada

WHILE el modo es «Outro y intro» THE SYSTEM SHALL durar el menor entre el outro restante de la saliente y el intro de la entrante (si solo se conoce uno, ese; si ninguno, la duración elegida), entre 4 y 48 s y sin pasar del outro de la entrante, y mostrar la duración de la próxima mezcla en el estado.

## Saltar siguiente y barajar

THE SYSTEM SHALL permitir quitar la pista que sigue (no durante una transición ni con menos de dos pistas) y barajar al azar las pistas no fijadas sin mover las fijadas ni la que ya se prepara, apagando «Orden automático» y permitiendo «Deshacer».

## Nivel de efectos y movimientos de DJ

THE SYSTEM SHALL ofrecer el ajuste `fxLevel` (`off`, `subtle` por defecto, `full`): en transiciones, eco de salida (último 25 %, wet 0 → 0,6, cola de 4 s) y reverb de rotura (salvo estilo Filtro); en `full`, además, riser (phaser) en las subidas con corte en la caída y reverb en las roturas, un movimiento a la vez, una frase de separación, nunca en los 8 s previos a la salida ni tras un salto de la aguja.

## Seguridad de los efectos de AutoMix

THE SYSTEM SHALL usar solo ranuras apagadas, ceder la ranura si el usuario la toca, omitir el movimiento (con nota) si no hay ranura libre y devolver las ranuras a su estado previo al terminar, detener, saltar o cambiar de pista.

## Sin canciones repetidas

WHEN AutoMix rellena la cola con la radio o sugiere pistas THE SYSTEM SHALL tratar como la misma canción las que comparten título normalizado (sin acentos ni ruido entre corchetes) y primer artista, aunque tengan distinto videoId, y no repetirla ni encadenarla dos veces seguidas.
IF el análisis o la descarga de la siguiente pista falla THEN THE SYSTEM SHALL mezclarla igualmente por streaming con fundido, sin tempo, y avisarlo en una nota.

## Cambio de tema o radio

WHEN el usuario inicia AutoMix con otro tema o una radio mientras otro está activo THE SYSTEM SHALL parar el anterior, vaciar su cola, radio, fijadas, plan y deshacer, devolver EQ y filtro de ambos decks a neutro, y no heredar nada de la sesión previa.
WHILE una pista del tema anterior suena THE SYSTEM SHALL dejarla sonar y pausar solo el deck que no suena.

## Recetas de DJ

WHEN AutoMix prepara una mezcla en modo Auto THE SYSTEM SHALL elegir la receta (bass swap, filtro, fundido, eco y corte o corte en la caída) según BPM, tonalidad, estructura y duración de outro e intro, y mostrar el motivo.
WHILE una receta está en curso THE SYSTEM SHALL aplicar sus gestos de graves, filtro, fundido y efecto sobre la rejilla de la pista que sale, con el intercambio de graves en inicios de frase.
WHERE el nivel de efectos es «apagado» THE SYSTEM SHALL omitir los gestos de efecto.

## Transiciones suaves con bass swap

WHEN AutoMix mezcla con cualquier receta distinta del fundido THE SYSTEM SHALL cortar el grave de la entrante al empezar e intercambiar los graves con una rampa de un compás, y aplicar el crossfader, el EQ y el filtro con rampas actualizadas cada 40 ms como máximo.
WHILE el estilo es Auto THE SYSTEM SHALL elegir con el análisis la receta y su duración (8, 16 o 32 pulsos), y con tonalidades en conflicto y tempo parecido usar bass swap con filtro en vez de un corte.
WHEN el usuario pulsa «Siguiente» o «Mezclar ahora» y la entrante se está analizando THE SYSTEM SHALL esperar su análisis hasta 8 s y entrar siempre por su punto de entrada, también en la mezcla de emergencia.
