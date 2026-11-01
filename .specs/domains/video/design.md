---
domain: video
paths: [renderer/**, scripts/**, .github/**, docs/**]
last_change: 2026-11-01-rediseno-interfaz
---
# video · design

## videoKey y pickMedia

`Deck.videoKey` identifica la pista a la que pertenece `Deck.videoSrc`. `Deck.videoMedia()` calcula el medio del deck (`stream` solo con `source==='stream'`, pista cargada y `st.ready`; `local` con `videoSrc` de esa pista; si no, `none` con leyenda y portada) y `syncMedia()` lo envía por `video:deck-media` solo si cambia. Main guarda `deckMedia[id]` y `layoutVideo()` muestra la vista de YouTube Music únicamente con `kind:'stream'`; con `none` oculta la vista y la página `video.html` dibuja la pantalla negra (`#ph-A`, `#ph-B`). Ya no existen `pickMedia`, los fotogramas del stream (`deck:frame`, `grabFrame`) ni la vista de miniaturas.
