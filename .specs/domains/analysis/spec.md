---
domain: analysis
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-11-02-generos
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

## Cola de análisis de listas

WHEN el usuario pide «Analizar lista» THE SYSTEM SHALL encolar las pistas no analizadas ni ya en cola, analizarlas de una en una (las cargadas en un deck primero), seguir tras un error, guardar la cola en disco y retomarla al abrir la app, y esperar mientras dure el bloqueo de yt-dlp por comprobación de bot.
THE SYSTEM SHALL ofrecer la vista Análisis con el avance por lista y pista, pausar, reanudar, cancelar una lista, reintentar errores y quitar terminadas.

## Cues musicales derivados de la energía por frase

THE SYSTEM SHALL derivar de `mix.phrases` (sin reanalizar) cues `build`, `drop` y `break` alineados a la rejilla: caída = salto ≥ 30 % y ≥ 12 puntos que destaca (≥ 1,8× la media de los demás saltos) dentro de un tramo creciente; rotura = caída ≥ 30 % y ≥ 12 puntos que se queda baja una frase más; subida = ≥ 3 frases crecientes que suman ≥ 25 %, que termina en su caída; vacío sin BPM, rejilla o con menos de 4 frases.

## Género desde el archivo

WHEN se analiza o indexa un archivo local con etiqueta de género THE SYSTEM SHALL registrar ese género como origen archivo sin pisar uno manual.
