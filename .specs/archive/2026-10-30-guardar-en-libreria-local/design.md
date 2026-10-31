---
change: 2026-10-30-guardar-en-libreria-local
status: approved
rev: 1
approved_rev: 1
approved_hash: 020069e1a819ec37a15d0ba9f21ba8724220c7418f551155817451cba07d8a08
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Design · guardar-en-libreria-local

## Enfoque
El analizador ya baja el audio con yt-dlp. En vez de a la caché interna (y borrarlo), lo baja a la carpeta de la librería (`~/Música/AlyssDJ/YouTube` por defecto), con metadatos y carátula incrustados, y lo registra en el índice de música local. El análisis se copia bajo el id local para que la pista local no se vuelva a analizar.

## Contratos
- Ajustes nuevos: `saveOnAnalyze` (true), `saveOnPlay` (true), `libraryDir` (`~/Música/AlyssDJ/YouTube`); la carpeta se añade a `musicDirs`.
- yt-dlp: `-f bestaudio` (mejor bitrate disponible; con cookies Premium incluye el formato de mayor calidad), `-o "<dir>/%(artist,uploader)s - %(title)s [%(id)s].%(ext)s"`, `--embed-metadata --embed-thumbnail --no-overwrites`; si falla el embebido de carátula se reintenta sin él.
- `Analyzer.request(id, { meta, save })`: con `save` el audio no se borra; al terminar: `localLib.register(path)` y se escribe `cache/<localId>.json` con el análisis; el JSON de la pista de YouTube guarda `saved: { path, localId }`.
- `/localfile/<localId>` ya sirve el archivo; el deck de una pista de YouTube con `saved` carga con `url` local en modo LOCAL.
- Disparo por reproducción: el deck ya cuenta 20 s para el historial; un contador aparte de 30 s llama a `analysis.request(id, { save: true })` si `saveOnPlay` y no está guardada ni en cola.
- Descargas parciales: yt-dlp escribe en `.part`; ante error se borran los `.part` de ese id.

## Decisiones
- **Un solo archivo, sin copias:** se descarga directo al destino final, nada de caché intermedia.
- **Sin conversión:** se guarda el original para no perder calidad.
- **Cola única:** las descargas por reproducción usan la cola del analizador (una a la vez), así no compiten con el streaming en vivo.
- **Interruptores por defecto:** guardar al analizar activado; guardar lo que reproduzca, activado por petición expresa del usuario y visible en Ajustes.

## Domain deltas
### library
#### ADDED spec: Guardar pistas de YouTube en la librería local
WHEN el usuario analiza una pista de YouTube o una lleva 30 s sonando por streaming y la opción correspondiente está activa THE SYSTEM SHALL conservar el audio en la mejor calidad que ofrezca YouTube, con etiquetas y carátula, en la carpeta de la librería de YouTube.
WHEN se guarda un archivo THE SYSTEM SHALL añadirlo a la pestaña Local con el análisis ya calculado y sin duplicarlo.
WHEN una pista de YouTube ya está guardada THE SYSTEM SHALL reproducirla desde el archivo (modo LOCAL).
IF la carpeta no es escribible o no hay espacio THEN THE SYSTEM SHALL mostrar la causa sin dejar parciales y sin colgarse.
#### ADDED design: Descarga a la librería y registro local
`ytdlp.downloadToLibrary` descarga directo a la carpeta destino (`-f bestaudio/best -S abr,asr`, metadatos incrustados, carátula en `.thumbs`); `Analyzer.registerSaved` registra el archivo en el índice local y copia el análisis bajo el id local; `ensureWritableDir` comprueba el primer ancestro existente antes de crear carpetas.
### analysis
#### ADDED spec: Vínculo entre la pista de YouTube y su copia local
THE SYSTEM SHALL guardar en el análisis de la pista de YouTube la ruta y el id local de su copia, y dejar de considerarla guardada si el archivo desaparece.
