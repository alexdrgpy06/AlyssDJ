---
change: 2026-11-01-sin-video-fuentes-y-cola-analisis
type: refactor
domains: [video, library, analysis, ui]
paths: [main/**, preload/**, renderer/**, shared/**, scripts/**, docs/**, README.md, .github/**]
commits: [90b7f61,b3faede,b3fe169,75108f5,e459faa,04bc632,b69f271,6d70ec3]
status: approved
rev: 1
approved_rev: 1
approved_hash: 472320927e4d6f7f6419b0b9371de4b61f336432d8091aab9259592769c90c01
approved_by: Alejandro Ramirez
approved_at: 2026-11-01
---
# Requirements · 2026-11-01-sin-video-fuentes-y-cola-analisis

## Contexto

El video no funciona bien y no importa: se retira por completo. Además, la lógica de fuente (archivo local o streaming) es confusa: un interruptor STREAM/LOCAL por deck que a veces no se puede usar, un cambio automático a «local» al cargar una pista guardada que el usuario no ve, y filas de la librería que no dicen de dónde sonará cada pista. Y el análisis solo se pide pista por pista: no hay forma de dejar una playlist entera analizándose en segundo plano, ni de ver qué falta.

Supuesto: «encolar análisis de playlists para futuro» se entiende como dejar listas enteras en una cola de análisis que sigue trabajando en segundo plano y sobrevive a cerrar la app. Si se refería a otra cosa, se corrige en esta revisión.

## Requisitos

### REQ-1: Sin video
THE SYSTEM SHALL no ofrecer, descargar ni reproducir video: sin menú «Video», ventana de video, botón ni doble clic en el plato para abrirla, descarga de video con yt-dlp, carpeta `.video`, estado de video del análisis ni los ajustes «Guardar también el video», «Calidad máxima del video» y «Preferir el video musical».
WHEN se actualice la app con esos ajustes guardados THE SYSTEM SHALL ignorarlos sin error y no tocar las carpetas `.video` que ya existan.
THE SYSTEM SHALL seguir reproduciendo el audio de YouTube Music por streaming y conservar el botón YTM de cada deck para iniciar sesión o depurar.

### REQ-2: La fuente de cada pista se decide sola y se ve
WHEN se carga una pista THE SYSTEM SHALL reproducir su archivo si la pista es un archivo local o tiene una copia guardada que existe, y por streaming en cualquier otro caso.
THE SYSTEM SHALL mostrar en cada deck una sola etiqueta de origen: «ARCHIVO LOCAL», «GUARDADA» (copia de una pista de YouTube) o «STREAM».
WHERE una pista de YouTube tiene copia guardada THE SYSTEM SHALL permitir cambiar entre archivo y streaming con un selector; WHERE no la tiene, el selector solo muestra «STREAM» deshabilitado con la razón (por ejemplo «Analiza la pista para tener archivo»).
IF el archivo guardado ya no existe al cargar la pista THEN THE SYSTEM SHALL reproducirla por streaming y avisar una vez.
THE SYSTEM SHALL ofrecer en Ajustes → Librería «Preferir la copia guardada cuando exista» (activado por defecto); desactivado, las pistas de YouTube cargan por streaming aunque estén guardadas.
THE SYSTEM SHALL mostrar en cada fila de la librería su origen (ARCHIVO, GUARDADA o STREAM) y si está analizada.

### REQ-3: Cola de análisis de listas
WHEN el usuario pulsa «Analizar lista» en una playlist, Importada, Me gusta, resultado de búsqueda o carpeta local THE SYSTEM SHALL encolar para análisis todas las pistas de la lista que aún no estén analizadas, sin duplicar las que ya están en la cola.
THE SYSTEM SHALL analizar de una en una, atender primero las pistas cargadas en un deck y seguir con la siguiente aunque una falle.
THE SYSTEM SHALL guardar la cola en disco y retomarla al volver a abrir la app, con las pistas en curso de vuelta a «en cola».
WHILE el bloqueo temporal de yt-dlp por comprobación de bot esté activo THE SYSTEM SHALL pausar el avance de la cola y reanudarla al terminar el bloqueo.

### REQ-4: Vista «Análisis»
THE SYSTEM SHALL añadir la fuente «Análisis» al panel de la librería, con un contador de pistas pendientes, que lista las listas encoladas con su progreso (hechas de total) y, por pista, su estado: en cola, descargando con porcentaje, analizando, hecha o error con su motivo.
THE SYSTEM SHALL permitir pausar y reanudar toda la cola, cancelar una lista, reintentar las que fallaron y quitar las terminadas.
THE SYSTEM SHALL mostrar en Importadas y Playlists cuántas pistas de cada lista están analizadas y un botón «Analizar» por lista.

### REQ-5: Vistas de trabajo como en otros programas de DJ
THE SYSTEM SHALL ofrecer en la barra superior un selector de vista con cuatro modos, como el cambio de disposición de Mixxx o las vistas de djay (tornamesa, 2 decks con librería y Automix inmersivo):
- **Mezcla**: la consola completa (decks, mezclador) con la librería debajo (la disposición actual).
- **Librería**: decks compactos (plato pequeño, hot cues en una fila, mezclador reducido) y la librería con casi toda la altura.
- **Automix**: vista inmersiva con la portada grande de la pista que suena, título, artista, BPM y tonalidad, la siguiente pista, la barra de la transición y los controles de AutoMix (iniciar, mezclar ahora, estilo, duración); los decks quedan ocultos pero siguen activos y sin video.
- **Ondas**: ondas apiladas grandes con una tira compacta por deck (título, BPM, play/cue) y el mezclador; sin librería.
THE SYSTEM SHALL ofrecer además la opción **Ondas: arriba | en el deck** (en el selector de vista y en Ajustes → Decks y diseño): «arriba» deja las ondas grandes apiladas a todo el ancho; «en el deck» quita la franja superior y muestra en cada deck su onda con desplazamiento grande (encima de la vista general de la pista), de modo que la franja superior libera su altura para la consola o la librería. La opción vale para las vistas Mezcla y Librería.
THE SYSTEM SHALL recordar la vista y la opción de ondas elegidas entre sesiones y permitir cambiarla con Alt+1, Alt+2, Alt+3 y Alt+4.
WHEN se abre la fuente AutoMix de la librería THE SYSTEM SHALL pasar a la vista Librería y al salir de ella volver a la vista que había, salvo que el usuario haya elegido otra mientras tanto.
THE SYSTEM SHALL mantener el audio, las ondas y los controles activos al cambiar de vista, y que cada vista respete los perfiles de pantalla compacto, normal y amplio.

### REQ-6: Sin regresiones
THE SYSTEM SHALL mantener el análisis por pista, el guardado en la librería local, AutoMix, los puntos de mezcla y los tres perfiles de diseño, con sus pruebas actualizadas, y actualizar la documentación y las capturas.

## Fuera de alcance

- Analizar varias pistas a la vez (sigue siendo una a la vez para no competir con la reproducción).
- Programar el análisis por horario o solo con el equipo inactivo.
- Cambiar el motor de audio o el reproductor de YouTube Music.
