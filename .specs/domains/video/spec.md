---
domain: video
paths: [docs/**, main/main.js, main/settings.js, preload/video-window.js, renderer/localvideo.js, renderer/video.html, renderer/video.js, scripts/video-live-selftest.js, scripts/video-local-selftest.js, main/ytm-library.js, main/analyzer.js, main/main.js, main/ytdlp.js, main/library-save.js, main/analyzer.js, main/ytm-library.js, preload/**, renderer/deck.js, renderer/app.js, renderer/video.html, renderer/video.js, renderer/index.html, renderer/styles.css, scripts/test-video-local.js]
last_change: 2026-11-01-rediseno-interfaz
---
# video · spec

## video local de pistas con video real

WHEN se guarda una pista con video real (OMV/UGC) THE SYSTEM SHALL descargar también su video, sin audio y hasta la calidad elegida, y usarlo en la miniatura del deck y la ventana de video sincronizado con el audio local.

## Sin video en el plato y pista correcta en el stream

THE SYSTEM SHALL mostrar solo la portada en el plato y ofrecer el video en la ventana de video y en la vista de AutoMix; WHILE el stream reproduce una pista distinta de la cargada THE SYSTEM SHALL volver a la del deck, salvo el cambio a la versión en video pedido por el propio deck (una vez, 8 s).

## Deck vacío en silencio

WHILE un deck de streaming no tiene pista cargada THE SYSTEM SHALL mantener en pausa y silenciado el reproductor de YouTube Music de ese deck.

## La ventana de video muestra solo el medio propio de cada deck

WHEN la ventana de video muestra un deck THE SYSTEM SHALL mostrar el video solo si ese deck tiene su propia pista cargada (video local guardado de esa pista, o streaming ya listo).
IF un deck está vacío, sin video o aún cargando THEN THE SYSTEM SHALL mostrar una pantalla negra con la portada atenuada y la leyenda «Sin pista», «Sin video» o «Cargando…», nunca la página de YouTube Music.
