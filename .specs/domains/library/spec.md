---
domain: library
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-11-02-generos
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
