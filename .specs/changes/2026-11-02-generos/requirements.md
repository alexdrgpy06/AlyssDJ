---
change: 2026-11-02-generos
type: feature
domains: [library, analysis, ui]
paths: [main/**, renderer/library.js, renderer/automix.js, renderer/mixplan.js, preload/app.js, scripts/test-generos.js]
commits: []
status: draft
rev: 1
approved_rev: null
approved_hash: null
approved_by: null
---
# Requirements · 2026-11-02-generos

## Contexto

Las pistas no tienen género: la librería solo filtra por texto y el AutoMix elige por BPM, tonalidad, artista y popularidad. Un DJ agrupa y mezcla por género (house con house, techno con techno) y el género ayuda a elegir receta (las mezclas largas de graves son propias de house y techno; un corte seco encaja en hip hop o pop). Fuentes posibles: los metadatos que ya devuelve yt-dlp (`genre`, `categories`, `tags`), las etiquetas de los archivos locales (ID3/MP4 `genre`) y lo que el usuario escriba a mano; no hay detección automática por audio.

## Requisitos

### REQ-1: Género por pista
THE SYSTEM SHALL guardar con cada pista analizada o guardada una lista de géneros (texto libre normalizado, 0 a 5) y su origen (`metadatos`, `archivo` o `manual`), sin perder lo escrito a mano cuando se vuelva a analizar.

### REQ-2: Lectura automática
WHEN se analiza o se registra una pista THE SYSTEM SHALL rellenar sus géneros a partir de los metadatos de YouTube Music/yt-dlp o de las etiquetas del archivo local, si existen y no hay géneros manuales.

### REQ-3: Edición manual
WHEN el usuario edita los géneros de una pista en la librería THE SYSTEM SHALL permitir añadir y quitar etiquetas con autocompletado de las ya usadas, y guardarlas como `manual`.

### REQ-4: Ver y filtrar
THE SYSTEM SHALL mostrar los géneros como chips en las filas de la librería y la cola del AutoMix, y permitir filtrar la librería por uno o varios géneros.

### REQ-5: Género en el AutoMix
WHEN el AutoMix ordena la cola o puntúa sugeridas THE SYSTEM SHALL preferir candidatas que compartan algún género con la pista de referencia, sin descartar las que no lo comparten y sin penalizar a las que no tienen género.

### REQ-6: Exportar con género
WHEN el usuario exporta la librería THE SYSTEM SHALL incluir los géneros en CSV y en Rekordbox XML (`Genre`).

## Fuera de alcance

- Detectar el género por análisis de audio.
- Géneros jerárquicos o sinónimos (house ≈ deep house).
- Recetas distintas por género (se evaluará aparte).
