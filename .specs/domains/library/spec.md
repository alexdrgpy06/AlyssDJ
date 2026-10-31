---
domain: library
paths: [main/analyzer.js, main/ytdlp.js, main/local-library.js, main/main.js, main/settings.js, preload/app.js, renderer/app.js, renderer/deck.js, renderer/library.js, renderer/index.html, docs/**]
last_change: 2026-10-31-arreglos-bot-y-pista-equivocada
---
# library · spec

## Guardar pistas de YouTube en la librería local

WHEN el usuario analiza una pista de YouTube o una lleva 30 s sonando por streaming y la opción correspondiente está activa THE SYSTEM SHALL conservar el audio en la mejor calidad que ofrezca YouTube, con etiquetas y carátula, en la carpeta de la librería de YouTube.
WHEN se guarda un archivo THE SYSTEM SHALL añadirlo a la pestaña Local con el análisis ya calculado y sin duplicarlo.
WHEN una pista de YouTube ya está guardada THE SYSTEM SHALL reproducirla desde el archivo (modo LOCAL).
IF la carpeta no es escribible o no hay espacio THEN THE SYSTEM SHALL mostrar la causa sin dejar parciales y sin colgarse.

## Pausa ante el bot-check de YouTube

WHEN yt-dlp falla porque YouTube pide confirmar que no es un bot THE SYSTEM SHALL mostrar un mensaje claro y no lanzar nuevas descargas durante 10 minutos.
