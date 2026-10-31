---
domain: library
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-10-30-guardar-en-libreria-local
---
# library · design

## Descarga a la librería y registro local

`ytdlp.downloadToLibrary` descarga directo a la carpeta destino (`-f bestaudio/best -S abr,asr`, metadatos incrustados, carátula en `.thumbs`); `Analyzer.registerSaved` registra el archivo en el índice local y copia el análisis bajo el id local; `ensureWritableDir` comprueba el primer ancestro existente antes de crear carpetas.
