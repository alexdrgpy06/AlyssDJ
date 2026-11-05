---
domain: automix
paths: [renderer/automix.js, renderer/app.js, renderer/index.html, renderer/styles.css, renderer/library.js, renderer/deck.js, main/analyzer.js, docs/**]
last_change: 2026-11-04-automix-simple-y-continuo
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

## Un solo panel de control

THE SYSTEM SHALL ofrecer los controles de AutoMix (iniciar o detener, mezclar ahora, estilo, duración, siguiente, cola) únicamente en el panel de la fuente AutoMix; la vista Automix SHALL mostrar solo el estado y un botón para abrir ese panel, y el botón de la barra SHALL mostrar el estado (activo o mezclando).

## Entrada elegida entre varios puntos

WHEN AutoMix prepara una transición (programada, «Mezclar ahora» o «Siguiente») THE SYSTEM SHALL evaluar como puntos de entrada de la pista que sigue el inicio de la intro, la frase que salta una intro larga, la primera frase con energía y el primer drop, siempre en límite de frase y nunca antes del primer compás con música, y elegir el de menor coste según la energía de salida frente a la de entrada, que la entrada no se quede en una intro vacía al acabar la transición y que la transición quepa antes del final; WHEN la pista tiene una entrada editada a mano THE SYSTEM SHALL usarla tal cual; IF la pista no está analizada THEN THE SYSTEM SHALL entrar por el inicio y avisarlo.

## Estado, perfiles y robustez de AutoMix

THE SYSTEM SHALL describir en todo momento la fase de AutoMix (Detenido, Sonando, Preparando la siguiente, Esperando el punto de salida, Mezclando) con la cuenta atrás hasta la mezcla y el motivo de cualquier espera; WHERE el usuario elige un perfil (Suave, Club, Radio, Personalizado) THE SYSTEM SHALL fijar duración, estilo, orden y efectos con un clic y recordar el último; IF la pista que sigue no se puede abrir THEN THE SYSTEM SHALL descartarla, seguir con la siguiente de la cola sin silencio y explicarlo en el estado, o, si era la última, conservarla y avisar.

## Frenazo en la caída

WHEN la receta es «En la caída», el nivel de efectos es «Marcado» y la transición dura al menos 8 s THE SYSTEM SHALL frenar la pista que sale en los últimos 4 pulsos usando una ranura libre; IF no hay ranura libre THEN THE SYSTEM SHALL omitirlo y anotarlo.

## Empezar desde una radio

THE SYSTEM SHALL ofrecer en AutoMix un menú «Radio» con la pista que suena, la de cada deck, la primera de la lista abierta y una búsqueda como orígenes, y WHEN el usuario elige uno THE SYSTEM SHALL cargar esa pista, llenar la cola con su radio (o con pistas compatibles de la librería en modo local o sin sesión) e iniciar AutoMix; cada resultado del buscador de AutoMix tiene su botón «Radio».

## El otro deck cuenta como siguiente

WHEN AutoMix inicia sin lista propia y el otro deck tiene una pista distinta, analizada y sin salto de BPM mayor al 8 % ni tonalidad en choque THE SYSTEM SHALL usarla como la siguiente antes de pedir pistas a la radio.

## Entrada segura

WHEN la pista que sigue no tiene análisis THE SYSTEM SHALL esperar a que llegue y, si no llega, entrar en un punto seguro (el 8 % de su duración, entre 10 y 40 s) con fundido y filtro, nunca por el 0:00, y recalcular el plan cuando el análisis llegue.

## Transición continua

WHEN falta poco para la salida THE SYSTEM SHALL colocar la entrante en su punto de entrada, en pausa y sin sonido, y mezclar solo cuando esté lista; IF no lo está THEN sigue sonando la actual y, pasados 20 s, se pasa a la siguiente lista.

## Efectos según el origen

WHEN las dos pistas son archivos locales analizados THE SYSTEM SHALL usar la receta completa y los efectos de reproducción del nivel elegido; IF alguna es streaming o no tiene análisis THEN solo fundido y filtro, sin igualar tempo ni efectos.

## Misma canción con otro título cuenta como repetida

THE SYSTEM SHALL tratar como la misma canción la que difiere solo en créditos, «Remastered», «Official Video» u otros sufijos, no repetirla en la cola, la lista inicial, la radio ni las sugeridas, y pedir confirmación si el usuario la agrega.
