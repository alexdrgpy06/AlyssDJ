---
domain: analysis
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-10-30-automix-puntos-de-mezcla
---
# analysis · spec

## Vínculo entre la pista de YouTube y su copia local

THE SYSTEM SHALL guardar en el análisis de la pista de YouTube la ruta y el id local de su copia, y dejar de considerarla guardada si el archivo desaparece.

## yt-dlp sin sesión

WHEN el sistema ejecuta yt-dlp para analizar o guardar una pista THE SYSTEM SHALL hacerlo sin cookies de ninguna sesión por defecto, con un runtime de JavaScript disponible.
IF yt-dlp responde que el formato no está disponible THEN THE SYSTEM SHALL reintentar una vez con una selección más abierta y, si falla, explicar la causa.

## Estructura de la pista

WHEN una pista se analiza THE SYSTEM SHALL calcular frases de 16 beats con su energía, el fin de la intro, el comienzo del outro, un punto de entrada y puntos de salida candidatos.
WHEN el tempo detectado sea ambiguo (3:2 o 2:1) THE SYSTEM SHALL decidir con los golpes graves.
