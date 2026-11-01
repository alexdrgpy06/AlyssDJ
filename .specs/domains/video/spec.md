---
domain: video
paths: [docs/**, main/main.js, main/settings.js, preload/video-window.js, renderer/localvideo.js, renderer/video.html, renderer/video.js, scripts/video-live-selftest.js, scripts/video-local-selftest.js, main/ytm-library.js, main/analyzer.js, main/main.js, main/ytdlp.js, main/library-save.js, main/analyzer.js, main/ytm-library.js, preload/**, renderer/deck.js, renderer/app.js, renderer/video.html, renderer/video.js, renderer/index.html, renderer/styles.css, scripts/test-video-local.js]
last_change: 2026-11-01-sin-video-fuentes-y-cola-analisis
---
# video · spec

## Sin video en el plato y pista correcta en el stream

THE SYSTEM SHALL no ofrecer ni reproducir video; WHILE el stream reproduce una pista distinta de la cargada THE SYSTEM SHALL volver a la del deck, sin excepción de versión en video.

## Deck vacío en silencio

WHILE un deck de streaming no tiene pista cargada THE SYSTEM SHALL mantener en pausa y silenciado el reproductor de YouTube Music de ese deck.
