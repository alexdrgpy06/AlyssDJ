---
domain: video
paths: [renderer/**, scripts/**, .github/**, docs/**]
last_change: 2026-10-31-automix-vista-video
---
# video · design

## videoKey y pickMedia

El deck guarda `videoKey` (id de la pista a la que pertenece `videoSrc`) y lo vacía al cargar otra pista; `pickMedia` (renderer/ministage.js) solo devuelve `video` si `videoKey === trackId` y el deck suena desde archivo. Tamaño y estado se guardan en `localStorage['alyssdj.stage']`.
