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
