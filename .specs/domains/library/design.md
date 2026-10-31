---
domain: library
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-10-31-automix-buscar-y-agregar
---
# library · design

## Descarga a la librería y registro local

`ytdlp.downloadToLibrary` descarga directo a la carpeta destino (`-f bestaudio/best -S abr,asr`, metadatos incrustados, carátula en `.thumbs`); `Analyzer.registerSaved` registra el archivo en el índice local y copia el análisis bajo el id local; `ensureWritableDir` comprueba el primer ancestro existente antes de crear carpetas.

## mixedit

`main/mixedit.js` sanea y guarda `<id>.mixedit.json`; el analizador adjunta `mixEdit` y avisa con el evento `mixedit`; `renderer/mixeditor.js` y `mixpreview.js` dan el editor y la prueba de mezcla.

## .video y sincronización

El video va a `<librería>/.video/<id>.mp4` (oculto para el índice); el protocolo `localvideo/` lo sirve; `LocalVideo.apply` corrige deriva mayor de 80 ms; la ventana de video carga `video.html` con una página por deck local.

## popularidad y sugeridas

`ytm-library.parsePlays/popularity` (endpoint player, caché de 30 días), `mixplan.rankCandidates/bestInsertion`, `AutoMix.addSmart/suggestions/analyzeSuggestions` y `renderer/automix-add.js`.
