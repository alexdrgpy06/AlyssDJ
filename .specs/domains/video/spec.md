---
domain: video
paths: [docs/**, main/main.js, main/settings.js, preload/video-window.js, renderer/localvideo.js, renderer/video.html, renderer/video.js, scripts/video-live-selftest.js, scripts/video-local-selftest.js, main/ytm-library.js, main/analyzer.js, main/main.js, main/ytdlp.js, main/library-save.js, main/analyzer.js, main/ytm-library.js, preload/**, renderer/deck.js, renderer/app.js, renderer/video.html, renderer/video.js, renderer/index.html, renderer/styles.css, scripts/test-video-local.js]
last_change: 2026-10-31-automix-vista-video
---
# video · spec

## video local de pistas con video real

WHEN se guarda una pista con video real (OMV/UGC) THE SYSTEM SHALL descargar también su video, sin audio y hasta la calidad elegida, y usarlo en la miniatura del deck y la ventana de video sincronizado con el audio local.

## Miniatura de video correcta y redimensionable

WHILE una miniatura de la vista de video muestra video THE SYSTEM SHALL reproducir solo el video cuyo id coincide con la pista cargada en el deck, sincronizado con el audio; IF no coincide o la pista no tiene video real THEN SHALL mostrar su portada («Solo audio»). El ancho de cada miniatura SHALL poder cambiarse entre 160 y 560 px en 16:9 y recordarse; el doble clic abre la ventana de video del deck.
