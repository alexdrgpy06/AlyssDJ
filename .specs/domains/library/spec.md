---
domain: library
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-11-03-playlists-locales
---
# library · spec

## Guardar pistas de YouTube en la librería local

WHEN una pista de YouTube ya está guardada THE SYSTEM SHALL reproducirla desde el archivo si «Preferir la copia guardada» está activo (por defecto), y por streaming si no; el usuario puede cambiar a mano mientras exista la copia.
IF la carpeta no es escribible o no hay espacio THEN THE SYSTEM SHALL mostrar la causa sin dejar parciales y sin colgarse.
IF el archivo guardado ya no existe al cargar la pista THEN THE SYSTEM SHALL reproducirla por streaming y avisar una vez.

## Pausa ante el bot-check de YouTube

WHEN yt-dlp falla porque YouTube pide confirmar que no es un bot THE SYSTEM SHALL mostrar un mensaje claro y no lanzar nuevas descargas durante 10 minutos.

## Origen visible de cada pista

THE SYSTEM SHALL mostrar el origen (ARCHIVO LOCAL, GUARDADA o STREAM) en cada deck y un chip de origen (ARCHIVO o STREAM) en cada fila de la librería; el selector archivo/stream del deck solo se puede usar si existen ambas fuentes y, si no, explica por qué.

## Exportar a otros programas

THE SYSTEM SHALL permitir exportar «todo lo analizado» o una playlist importada a M3U8, CSV (UTF-8 con BOM) y Rekordbox XML (`COLLECTION` con tempo, tonalidad Camelot y marcas Mezcla/Intro/Salida) desde un botón «Exportar» de la Librería, omitir de M3U8 y Rekordbox las pistas sin archivo de audio en el disco (y avisar cuántas), conservarlas en el CSV con la ruta vacía, y escribir el archivo a un temporal que se renombra.

## Géneros por pista

THE SYSTEM SHALL guardar hasta 5 géneros normalizados por pista, con origen metadatos, archivo o manual (el manual prevalece), permitir editarlos y filtrar la librería por género, y exportarlos en la columna «género» del CSV y el atributo Genre de Rekordbox.
WHEN AutoMix puntúa candidatas THE SYSTEM SHALL dar una bonificación a las que comparten género con la pista de referencia.

## Preescucha desde la Librería

WHEN el usuario pulsa ▶ en una fila con la pista disponible como archivo local THE SYSTEM SHALL reproducirla por la salida de auriculares (o la de por defecto) sin cargarla en ningún deck, empezando en su punto de entrada de mezcla o, sin análisis, al 25 % de su duración.
WHEN se inicia otra preescucha, se pulsa de nuevo en la misma pista o esta termina THE SYSTEM SHALL parar la anterior, de modo que suene una sola.
IF la pista solo existe por streaming THEN THE SYSTEM SHALL mostrar ▶ deshabilitado con una ayuda y no descargar nada.

## Almacén de stems

THE SYSTEM SHALL guardar los stems en `userData/stems` con un índice, marcar en la Librería las pistas que los tienen (chip con el tamaño) y permitir borrarlos por pista o todos, indicando cuánto ocupan.

## Preparación automática y cuota de stems

WHEN el ajuste de preparación es automático y la GPU está comprobada, o es «Siempre» THE SYSTEM SHALL separar la pista cargada en un deck (prioridad 0) y la siguiente de AutoMix (prioridad 1) antes que las peticiones manuales (prioridad 2); WHILE los stems superen la cuota (5 GB por defecto) THE SYSTEM SHALL borrar primero los menos usados, sin tocar los cargados en un deck ni el recién hecho.

## Buscar en todo lo local

WHEN el usuario busca con el ámbito «Mi equipo» o «Todo» THE SYSTEM SHALL consultar un índice local (archivos, pistas guardadas, analizadas y de listas) sin tildes ni mayúsculas por título, artista, álbum y género, sin exponer la ruta de los archivos, y filtrar por BPM, tonalidad y compatibilidad con la pista cargada; WHILE no hay conexión THE SYSTEM SHALL mostrar los resultados locales con un aviso en lugar de un error.

## Playlists locales

THE SYSTEM SHALL guardar playlists propias (manuales o inteligentes) en `userData/playlists-local.json` de forma atómica, conservar una copia `.bad-…` si el archivo está dañado, no modificar nunca archivos de música, y permitir crearlas, renombrarlas, duplicarlas y borrarlas con su número de pistas y duración.

## Poner, sacar y ordenar pistas

WHEN el usuario arrastra pistas a una lista, usa «Añadir a playlist» o la barra de selección THE SYSTEM SHALL añadirlas sin repetir la pista en la misma lista; WHEN las quita THE SYSTEM SHALL conservar archivos y demás listas y permitir deshacer en su posición original; THE SYSTEM SHALL ordenar por título, artista, BPM, tonalidad, género o duración (las pistas sin dato al final) y permitir reordenar arrastrando, guardando el resultado.

## Listas inteligentes

THE SYSTEM SHALL resolver una lista inteligente a partir de sus filtros (BPM, tonalidad y compatibles, géneros, solo analizadas, solo con stems) sobre el índice local cada vez que se abre, sin permitir editar sus pistas a mano.
